# REZ FULL APP — MASTER RECOVERY PLAN
**Compiled:** 2026-04-12  
**Branch:** `audit/recovery-phase`  
**Source:** 8-agent deep forensic audit (Architecture · Database · API · Auth · Frontend-Backend · Routing · State · QA)

---

## EXECUTIVE SUMMARY

The REZ codebase is a mid-migration strangler-fig architecture: a 1,911-route Express monolith being carved into microservices, with 3 mobile/web frontends. The codebase is **functionally broken in several user-facing flows right now**, silently returning wrong data in others, and has financial integrity gaps that could cause real monetary loss.

**5 flows broken in production today:**
1. Entire loyalty/rewards screen — 404 on every call
2. Merchant app: virtually all API calls 404 in dev (wrong port fallback)
3. Merchant Khata (credit ledger) — route commented out, no replacement
4. Merchant onboarding admin routes accessible by ANY merchant (privilege escalation)
5. GST reports always return ₹0 (wrong field names in aggregation)

**Financial integrity risks:**
- Coin expiry job can push wallet balance negative
- Payout request has no balance guard — merchant can request ₹999,999 with ₹0 balance
- Admin commission has no idempotency key — double commission on retry
- Concurrent COD orders can oversell last-unit stock

---

## CLUSTER 1 — DATA MODELS (Fix First)

### Root Cause
Three services write to the same MongoDB collections with diverging schemas. There is no single source of truth.

### C1-1 — `cointransactions` collection schema bifurcation [CRITICAL]
**Root cause:** Two writers, two schemas, same collection.
- `rezbackend` writes `{ balance: Number }` (single snapshot)
- `rez-wallet-service` writes `{ balanceBefore: Number, balanceAfter: Number, coinType: String }`
- Financial reconciliation across services produces incorrect totals

**Fix:**
1. Run migration: add `balanceBefore: 0, balanceAfter: balance, coinType: 'nuqta'` to all backend-written docs where these fields are absent
2. Update `rezbackend/src/models/CoinTransaction.ts`: add `coinType`, rename `balance` → keep both for one release cycle
3. Update all rezbackend writers to populate `balanceBefore`/`balanceAfter`
**File:** `rezbackend/src/models/CoinTransaction.ts` + `rez-wallet-service/src/models/CoinTransaction.ts`

### C1-2 — `notifications` collection incompatible type enums [CRITICAL]
**Root cause:** `rez-wallet-service` defines its own inline Notification schema with a completely different `type` enum from `rezbackend/src/models/Notification.ts`. Same collection, incompatible values.
- Backend: `'info' | 'success' | 'warning' | 'error' | 'promotional'`
- Wallet service: `'order' | 'payment' | 'withdrawal' | 'system' | 'promotion' | 'review' | 'visit' | 'wallet'`

**Fix:** Create `rez-wallet-service/src/models/MerchantNotification.ts` using the canonical backend enum. Remove inline schema from `merchantNotificationService.ts`.
**File:** `rez-wallet-service/src/services/merchantNotificationService.ts:21–27`

### C1-3 — `stores` collection dual FK (`merchantId` ref User vs `merchant` ref Merchant) [CRITICAL]
**Root cause:** `rezbackend/src/models/Store.ts:692` refs `'User'`; `rez-merchant-service/src/models/Store.ts:44` refs `'Merchant'`. Different ObjectId namespaces. Store ownership queries return empty results for cross-service documents.

**Fix:**
1. One-time migration: for all Store docs, set `merchant = Merchant._id` by matching via email
2. Update `rezbackend/Store.ts`: `merchantId: { ref: 'Merchant' }` (change ref target, keep field name temporarily)
3. Phase out `merchantId` in favor of `merchant` across all queries
**Files:** `rezbackend/src/models/Store.ts:692`, `rez-merchant-service/src/models/Store.ts:44`

### C1-4 — GST routes always return ₹0 [CRITICAL — already broken in production]
**Root cause:** `rez-merchant-service/src/routes/gst.ts` has three bugs:
- `status: 'completed'` never matches Order status enum (valid: `'delivered'`, etc.)
- `$sum: '$total'` should be `$sum: '$totals.total'`
- `$cgst`, `$sgst`, `$igst` do not exist in Order schema

**Fix (safe — no data risk):**
```typescript
// gst.ts:20
status: { $in: ['delivered', 'returned', 'refunded'] }
// gst.ts:21
{ $sum: '$totals.total' }
// gst.ts:38
{ $sum: '$totals.subtotal' }
// Remove cgst/sgst/igst aggregation until fields exist
```
**File:** `rez-merchant-service/src/routes/gst.ts:20,21,37,38`

### C1-5 — `paymentStatus: 'completed'` in merchant app — should be `'paid'` [CRITICAL]
**Root cause:** `rezmerchant/rez-merchant-master/types/orders.ts:35` declares `paymentStatus: 'completed'` but the backend Order model stores `payment.status: 'paid'`. Merchant never sees paid orders.

**Fix:** Change type union from `'completed'` → `'paid'`. Zero DB impact.
**File:** `rezmerchant/rez-merchant-master/types/orders.ts:35`

### C1-6 — Coin expiry job negative balance risk [CRITICAL]
**Root cause:** `rezbackend/src/jobs/expireCoins.ts:701` does `$inc: {'balance.available': -expiredAmount}` with NO `$gte` balance floor. Parallel `coinExpiry.ts` has the guard; `expireCoins.ts` does not.

**Fix:**
```typescript
// expireCoins.ts:701
Wallet.findOneAndUpdate(
  { user: userId, 'balance.available': { $gte: expiryData.expiredAmount } },
  { $inc: { 'balance.available': -expiryData.expiredAmount, 'balance.total': -expiryData.expiredAmount } }
)
```
Also add a unique Redis lock key to `expireCoins.ts` to prevent concurrent execution with `coinExpiry.ts`.
**File:** `rezbackend/src/jobs/expireCoins.ts:701`

### C1-7 — Payout no balance guard [CRITICAL]
**Root cause:** `rez-wallet-service/src/routes/payoutRoutes.ts:51-84` creates payout document without checking `balance.available >= requestedAmount`. Merchant with ₹0 balance can request any payout.

**Fix:** Before creating payout document, check:
```typescript
const wallet = await MerchantWallet.findOne({ merchant: merchantId });
if (!wallet || wallet.balance.available < amountPaise) {
  return res.status(400).json({ success: false, message: 'Insufficient balance' });
}
```
Also add `mongoose.isValidObjectId(merchantId)` guard before new `ObjectId()` cast.
**File:** `rez-wallet-service/src/routes/payoutRoutes.ts:51-84`

### C1-8 — Financial field types missing min:0 [HIGH]
**Fix:** Add `min: 0` to all financial Number fields in:
- `rez-merchant-service/src/models/Order.ts:62` (all totals fields)
- `rez-wallet-service/src/models/MerchantWalletTransaction.ts:55` (amount field)

### C1-9 — Populate failures (models not registered in microservices) [HIGH]
**Root cause:** `rez-wallet-service` refs `'Store'` and `'Merchant'` but never registers those models.

**Fix:** Create minimal read-only model stubs in `rez-wallet-service/src/models/`:
- `Merchant.ts` — `{ strict: false }` proxy for populate to work
- `Store.ts` — `{ strict: false }` proxy for populate to work
**File:** `rez-wallet-service/src/models/CoinTransaction.ts:30`, `Wallet.ts:68,75`

### C1-10 — Ghost User schema in rez-merchant-service [HIGH]
**Root cause:** `rez-merchant-service/src/models/User.ts` is a `strict:false` proxy to the `users` collection, enabling cross-service DB writes. `patchTests.ts` writes user data directly.

**Fix:** Replace reads in `exports.ts` and `patchTests.ts` with internal HTTP call to `rez-auth-service GET /internal/auth/user/:id`. Delete `User.ts` once calls are migrated.
**File:** `rez-merchant-service/src/models/User.ts`

---

## CLUSTER 2 — API CONTRACTS (Fix Second)

### Root Cause
Frontend and backend evolved independently. Method mismatches, wrong field names, missing endpoints, and missing frontend service files cause guaranteed 404s and silent data corruption.

### C2-1 — Consumer profile update: PUT vs PATCH [CRITICAL — every profile save fails]
**File:** `rezapp/nuqta-master/services/authApi.ts:~480`
**Fix:** Change `apiClient.put('/user/auth/profile', ...)` → `apiClient.patch('/user/auth/profile', ...)`

### C2-2 — Consumer loyalty screen: all URL paths wrong [CRITICAL — entire screen is 404]
**Root cause:** `loyaltyApi.ts` calls `/loyalty/points`, `/loyalty/stats`, `/loyalty/rewards`, `/loyalty/transactions`, `/loyalty/earn-points`, `/loyalty/my-rewards` — NONE exist in backend.
Backend serves: `/loyalty/points/balance`, `/loyalty/catalog`, `/loyalty/tier`, `/loyalty/redemptions`, `/loyalty/points/history`

**Fix:** Update all paths in `rezapp/nuqta-master/services/loyaltyApi.ts` to match backend routes.
**File:** `rezapp/nuqta-master/services/loyaltyApi.ts` (all endpoints)

### C2-3 — Notifications: `read` vs `isRead` field mismatch [HIGH — all notifications appear unread]
**Root cause:** Backend model field: `isRead`. Frontend interface declares: `read`.

**Fix:** Update `rezapp/nuqta-master/services/notificationsApi.ts` Notification interface:
```typescript
isRead: boolean; // was: read
```
Update all component usages from `notification.read` → `notification.isRead`.

### C2-4 — Missing `GET /notifications/:id` in monolith [CRITICAL — detail fetch always 404]
**Fix:** Add to `rezbackend/src/routes/notificationRoutes.ts`:
```typescript
router.get('/:notificationId', authenticate, getNotificationById);
```

### C2-5 — Push token registration path mismatch [HIGH]
**Frontend calls:** `POST /notifications/register-push-token`
**Backend has:** `POST /notifications/register-token`
**Fix:** Update `rezapp/nuqta-master/services/earningsNotificationService.ts:87` to use `/notifications/register-token`

### C2-6 — Consumer wallet: `POST /wallet/withdraw` missing [HIGH]
**Root cause:** Monolith `walletRoutes.ts` has no `/withdraw` for consumers. Only merchant wallet has withdraw.
**Fix:** Add `POST /wallet/withdraw` consumer route in `rezbackend/src/routes/walletRoutes.ts`

### C2-7 — Merchant broadcasts: no frontend service file [CRITICAL]
**Root cause:** `rez-merchant-service` has full CRUD for `/broadcasts/` but `rezmerchant/services/api/` has no `broadcasts.ts`.
**Fix:** Create `rezmerchant/rez-merchant-master/services/api/broadcasts.ts` with CRUD calls.

### C2-8 — Merchant disputes: no frontend service file [HIGH]
**Fix:** Create `rezmerchant/rez-merchant-master/services/api/disputes.ts`

### C2-9 — Merchant wallet summary missing `statistics` and `bankDetails` [HIGH]
**Root cause:** `rez-wallet-service` returns only `{ balance }`. Merchant app expects `{ balance, statistics, bankDetails }`.
**Fix:** Update `merchantWalletRoutes.ts` `getWalletHandler` to return full `MerchantWallet` document.

### C2-10 — Consumer review service: 8 missing backend endpoints [HIGH]
`PATCH /reviews/:id/feature`, `/unfeature`, `/pin`, `/unpin`, `GET /reviews/pending`, `POST /reviews/bulk-moderate`, `GET /reviews/analytics`, `GET /reviews/suggestions` are called in `reviewsApi.ts` but don't exist.
**Fix:** Either implement these 8 routes in `rezbackend/src/routes/reviewRoutes.ts` OR consolidate `reviewsApi.ts` into `reviewApi.ts` (which has correct paths) and remove dead calls.

### C2-11 — `reviewsApi.ts` uses wrong URL pattern [HIGH]
Calls `GET /reviews/:targetType/:targetId` — backend uses `/reviews/store/:id` or `/reviews/product/:id`.
Also sends `PATCH /reviews/:id` — backend has `PUT /reviews/:id`.
**Fix:** Consolidate into `reviewApi.ts` which already has correct patterns.

### C2-12 — Order `out_for_delivery` missing from list filter enum [HIGH]
`rez-merchant-service/src/routes/orders.ts:27` — status filter Joi validation doesn't include `'out_for_delivery'`. Filtering merchant orders by that status returns 422.
**Fix:** Add `'out_for_delivery'` to Joi validation in `routes/orders.ts:27`

### C2-13 — Merchant dev port hardcoded wrong [HIGH]
`rezmerchant/services/api/client.ts:19` fallback is `localhost:3007` but service runs on `localhost:4005`.
**Fix:** Change dev fallback to `http://localhost:4005/api`

### C2-14 — Standardize response shapes across services [MEDIUM]
Non-standard shapes found in:
- `rez-auth-service` OTP endpoints (flat, no `data:{}` wrapper)
- `rez-wallet-service` transaction pagination (`pagination` at root vs inside `data`)
- `rez-merchant-service` auth token (`data.token` vs standard `data.tokens.accessToken`)
**Fix:** Document and standardize to `{ success, message, data: T, meta?: { pagination } }` across all services.

---

## CLUSTER 3 — AUTHENTICATION & SECURITY (Fix Third)

### Root Cause
Auth guards were applied inconsistently as features were added across 3 parallel merchant route namespaces. Privilege escalation exists today.

### C3-1 — Merchant admin routes use merchant auth (PRIVILEGE ESCALATION) [CRITICAL]
**Root cause:** `rezbackend/src/merchantroutes/onboarding.ts:573,615,640,662` — 4 admin-only routes protected by `authenticateMerchant` instead of admin auth. Any active merchant can:
- List all pending merchant verifications
- Read onboarding analytics for all merchants
- Request documents on any merchant's behalf

**Fix (immediate):**
```typescript
// onboarding.ts:573,615,640,662
// Replace:
authenticateMerchant, requireMerchant
// With:
authenticate, requireAdmin
```

### C3-2 — Cross-service merchant token blacklist mismatch [HIGH]
**Root cause:** `rez-merchant-service` blacklists tokens using SHA-256 hash as key (`blacklist:merchant:{sha256(token)}`). `rezbackend` uses raw token as key (`blacklist:merchant_token:{token}`). A merchant who logs out via the microservice remains authenticated on the monolith.

**Fix:** Standardize key format across both services. Recommend: `blacklist:merchant:{sha256(token)}` in both.
**Files:** `rezbackend/src/middleware/merchantauth.ts:20`, `rez-merchant-service/src/middleware/auth.ts:48`

### C3-3 — `merchantStoreRoutes.ts` uses consumer auth guard [HIGH]
**Root cause:** `rezbackend/src/routes/merchantStoreRoutes.ts` uses `requireAuth` (consumer JWT) instead of `merchantAuth`. Any consumer token can call merchant store endpoints.

**Fix:** Replace `requireAuth` with `authenticateMerchant` (or `merchantAuth`) on all routes in `merchantStoreRoutes.ts`.

### C3-4 — Consumer refresh token: no rotation [HIGH]
**Root cause:** `rezbackend/src/controllers/authController.ts` `refreshToken` handler issues new access token but does NOT rotate (invalidate old) refresh token. Stolen refresh tokens are valid for the full 7-day window.

**Fix:** Implement rotation: blacklist old refresh token hash in Redis, issue new refresh token, return both.

### C3-5 — IDOR: activity feed and gamification achievements [HIGH]
**Root cause:**
- `GET /api/social/users/:userId/activities` — no ownership check; any authenticated user can read any user's activities
- `GET /api/gamification/achievements` — `req.params.userId` not compared against `req.userId`

**Fix:** Add ownership guard:
```typescript
if (req.params.userId !== String(req.userId)) {
  return res.status(403).json({ success: false, message: 'Access denied' });
}
```
Or replace with `/me/activities` and `/me/achievements` endpoints.

### C3-6 — Web localStorage token storage [HIGH]
**Root cause:** Both merchant and consumer apps use `AsyncStorage` on web (`Platform.OS === 'web'`), which maps to `localStorage` — exposed to XSS.

**Fix:** Enable httpOnly cookie auth for web deployments. Set `COOKIE_AUTH_ENABLED = true` in storage service when platform is web, or explicitly document that web builds are not supported for security-sensitive deployments.

### C3-7 — Admin orchestrator routes missing explicit auth [MEDIUM]
`routes.ts:842` mounts `adminOrchestratorRoutes` without explicit `authTokenMiddleware, requireAdminMiddleware`.
**Fix:** Change mount to:
```typescript
app.use('/api/admin/orchestrator', authTokenMiddleware, requireAdminMiddleware, adminOrchestratorRoutes)
```

### C3-8 — Hardcoded credentials in scripts [HIGH]
`scripts/resetMerchantPasswords.ts`: `DEV_PASSWORD = 'Merchant@123'`
`scripts/seedDemoData.ts`: `Admin@123`, `Customer@123`, `Merchant@123`
**Fix:** Remove hardcoded values; use env vars or CLI prompts.

---

## CLUSTER 4 — ROUTING & INFRASTRUCTURE (Fix Fourth)

### Root Cause
No gateway routing config exists in the codebase. All routing behavior is encoded in comments, not code. The merchant app silently falls to the monolith when `EXPO_PUBLIC_MERCHANT_SERVICE_URL` is unset.

### C4-1 — Missing `EXPO_PUBLIC_MERCHANT_SERVICE_URL` = mass 404 in production [CRITICAL]
**Root cause:** Without this env var, ALL merchant-specific routes fall through to the monolith, which has those routes **commented out**. This is the single highest-impact misconfiguration risk.

**Fix:**
1. Set `EXPO_PUBLIC_MERCHANT_SERVICE_URL` in production EAS build secrets pointing to rez-merchant-service URL
2. Add a startup assertion in `rezmerchant/services/api/client.ts` that throws if `MERCHANT_SERVICE_URL` is undefined in non-dev builds

### C4-2 — No gateway routing config in repo [HIGH]
**Root cause:** `/rez-api-gateway/src/` contains only an auth middleware helper. No nginx.conf, no proxy table. The actual routing rules only exist in source code comments.

**Fix:** Add nginx.conf or gateway routing config to `rez-api-gateway/` and commit it to version control. This makes the routing architecture reviewable and testable.

### C4-3 — Dev port discrepancy (3007 vs 4005) [HIGH]
Already covered in C2-13 above.

### C4-4 — `storeReviewRoutes` mounted with `:storeId` but no `mergeParams` [MEDIUM]
`routes.ts:511`: `app.use('/api/stores/:storeId/reviews', storeReviewRoutes)` — the `:storeId` param is inaccessible inside the sub-router unless it is created with `{ mergeParams: true }`.

**Fix:** Add `mergeParams: true` when creating the reviews router in `storeReviewRoutes.ts`.

### C4-5 — `payment.failed` webhook overwrites `paid` status [MEDIUM]
**Root cause:** `razorpayController.ts:363` uses `order.save()` on the failed branch without a CAS guard. Concurrent `payment.captured` + `payment.failed` webhooks: captured wins atomically, but save() on stale in-memory document resets status to `failed`.

**Fix:** Replace `order.paymentStatus = 'failed'; await order.save()` with:
```typescript
await Order.findOneAndUpdate(
  { _id: order._id, 'payment.status': { $nin: ['paid'] } },
  { $set: { 'payment.status': 'failed' } }
)
```

### C4-6 — `merchantNotificationService` blocks order delivery [HIGH]
**Root cause:** `orderUpdateController.ts:523` `await merchantNotificationService.notifyPaymentReceived(...)` blocks the entire order delivery handler during FCM outages (30-second hang).

**Fix:** Convert to fire-and-forget:
```typescript
merchantNotificationService.notifyPaymentReceived(order).catch(err =>
  logger.warn('Non-blocking notification failure', { err })
);
```

### C4-7 — Admin commission credit no idempotency key [HIGH]
**Root cause:** `orderUpdateController.ts:549` calls `adminWalletService.creditOrderCommission(...)` with no idempotency key. Retry on delivered webhook = double commission.

**Fix:** Pass idempotency key: `admin_commission:${orderId}` to the credit call, matching the pattern used for `purchase_reward:${orderId}` on line 371.

---

## CLUSTER 5 — UI STATE & FRONTEND (Fix Fifth)

### Root Cause
Incomplete migration from Context to Zustand in the consumer app means two state systems run in parallel. Caches are not cleared on logout. Three independent fetch paths for wallet data.

### C5-1 — TanStack cache not cleared on logout (consumer + merchant) [HIGH]
**Files:**
- `rezapp/nuqta-master/contexts/AuthContext.tsx:~467`
- `rezmerchant/rez-merchant-master/contexts/AuthContext.tsx:~265`

**Fix:** Add `queryClient.clear()` to `performLocalLogout()` and merchant `logout()`. The admin app already does this correctly.

### C5-2 — Persisted wallet balance visible to next user [HIGH]
**Root cause:** `rezapp/stores/walletStore.ts` Zustand persist writes wallet balance to AsyncStorage on every update. Never cleared on logout.

**Fix:** Add `resetWallet()` action to store and call it in `performLocalLogout()`.

### C5-3 — Consolidate 3 wallet fetch paths to 1 [HIGH]
**Root cause:** `WalletContext`, `hooks/queries/useWallet.ts`, and `hooks/useWallet.ts` all call `walletApi.getBalance()` independently with no coordination.

**Fix:** Designate `WalletContext` (with its dedup logic) as the single wallet data source. Update `hooks/queries/useWallet.ts` to read from `useWalletContext()` instead of making its own API call. Deprecate `hooks/useWallet.ts`.

### C5-4 — Cancel order mutation does not invalidate `useOrderHistory` [MEDIUM]
**Root cause:** `useOrderHistory` uses manual `useState` — TanStack invalidation doesn't reach it. After cancel, order history shows stale status.

**Fix:** Add an `onSuccess` callback to `useCancelOrder` mutation that calls `useOrderHistory`'s `refetch()`, or migrate order history to use TanStack `useQuery` with the same cache key.

### C5-5 — Merchant order mutation doesn't refresh `useOrdersDashboard` [HIGH]
**Root cause:** Same pattern — `useOrdersDashboard` is manual state, not TanStack. Mutations invalidate TanStack but the orders screen doesn't use TanStack.

**Fix:** Either migrate orders screen to TanStack `useOrders` hook, or add explicit `fetchOrders()` call in all mutation `onSuccess` callbacks in `useOrdersDashboard`.

### C5-6 — `useRealTimeUpdates` causes infinite subscription registration [MEDIUM]
**Root cause:** `useDashboardRealTime` useEffect deps include `realTime` — a new object reference every render.

**Fix:** Extract stable references from `realTime`:
```typescript
const { subscribeToMetrics, subscribeToSystemNotifications } = realTime;
useEffect(() => { ... }, [subscribeToMetrics, subscribeToSystemNotifications]);
```

### C5-7 — No real-time mechanism for admin → merchant state updates [MEDIUM]
**Root cause:** Admin merchant approval/rejection is a pure REST call. Merchant app receives no push notification.

**Fix (short-term):** Emit a socket event from the backend after merchant status change. Add listener in merchant app's `AuthContext` that refreshes the merchant profile.

### C5-8 — Wallet balance field name aliases in consumer app [MEDIUM]
**Root cause:** Frontend `WalletBalanceResponse.breakdown.cashback` vs backend returns `breakdown.cashbackBalance`.

**Fix:** Standardize backend walletBalanceController to return `cashback` (not `cashbackBalance`) OR update frontend interface to map `cashbackBalance → cashback` in `walletApi.ts`.

---

## FINAL ROOT CAUSE ENGINE

### Why fixing one thing breaks another

1. **CoinTransaction schema** — Fixing `balanceBefore`/`balanceAfter` in rezbackend requires a migration. Any code reading `balance` (single field) in analytics or admin tools breaks until those reads are updated.

2. **walletService.credit() extraction** — Moving to HTTP calls breaks MongoDB session atomicity. Cannot fix without a distributed transaction strategy (saga pattern or outbox pattern).

3. **Store merchantId → merchant** — Changing this FK requires updating 102+ query sites in the monolith AND running a data migration. Any deployment window must ensure both old and new field are populated simultaneously.

4. **`rez-shared` adoption** — rezmerchant uses Zod 4; backend uses Zod 3. Cannot share Zod schemas without resolving this version boundary first.

5. **Consolidating merchantroutes/ → routes/merchant/** — The two namespaces use different session properties (`req.merchant?.stores` vs `req.merchant?.storeId`). Merging without auditing all 78 files creates silent `undefined` access bugs.

---

## PRIORITY EXECUTION ORDER

```
Week 1 — DATA INTEGRITY (no deploy risk, safe migrations)
  ✅ Fix paymentStatus 'completed' → 'paid' (merchant types)
  ✅ Fix GST aggregation field paths
  ✅ Add min:0 to financial fields
  ✅ Fix coin expiry balance floor ($gte guard)
  ✅ Add payout balance guard
  ✅ Register Merchant + Store model stubs in rez-wallet-service
  ✅ Fix cointransactions schema (add migration script)

Week 2 — SECURITY (before next feature deploy)
  ✅ Fix merchant onboarding admin routes (PRIVILEGE ESCALATION - IMMEDIATE)
  ✅ Fix merchantStoreRoutes auth guard
  ✅ Fix cross-service blacklist key mismatch
  ✅ Add IDOR guards on activity feed + gamification
  ✅ Remove hardcoded credentials from scripts
  ✅ Fix orchestrator route explicit auth

Week 3 — API CONTRACTS (unblock broken features)
  ✅ Fix consumer profile PUT → PATCH
  ✅ Fix loyalty API paths (all 6 endpoints)
  ✅ Fix notification isRead field + add GET /:id route
  ✅ Fix push token registration path
  ✅ Add consumer wallet withdraw endpoint
  ✅ Create merchant broadcasts.ts + disputes.ts service files
  ✅ Fix merchant wallet summary response shape
  ✅ Fix review API consolidation

Week 4 — STATE & CACHING (prevent data leaks)
  ✅ Add queryClient.clear() on consumer logout
  ✅ Add queryClient.clear() on merchant logout
  ✅ Clear persisted wallet store on logout
  ✅ Fix coin credit TOCTOU (atomic coinsCredited flag)
  ✅ Fix admin commission idempotency key
  ✅ Fix payment.failed webhook CAS guard
  ✅ Fix merchantNotification blocking await → fire-and-forget

Week 5 — ROUTING & DEV EXPERIENCE
  ✅ Fix merchant dev port (3007 → 4005)
  ✅ Add EXPO_PUBLIC_MERCHANT_SERVICE_URL validation on startup
  ✅ Add nginx.conf / gateway routing config to rez-api-gateway
  ✅ Fix storeReviewRoutes mergeParams
  ✅ Fix response shape standardization

Week 6 — CONSOLIDATION
  ✅ Consolidate 3 wallet fetch paths
  ✅ Migrate orders screen to TanStack in merchant app
  ✅ Fix useRealTimeUpdates infinite subscription
  ✅ Implement admin → merchant real-time status push
  ✅ Standardize wallet breakdown field names
```

---

## REBUILD vs REFACTOR DECISION

### Rebuild (do NOT do this for the whole system)
A full rebuild is not warranted. The data layer, auth logic, and core order FSM are sound. The business logic exists — it just needs architectural cleanup.

### Refactor Priority Targets

| Target | Decision | Why |
|--------|----------|-----|
| `merchantroutes/` (78 files) | **Refactor** (thin controller extraction) | Logic exists; just needs layer separation |
| `loyaltyApi.ts` | **Refactor** (path fixes only) | Routes exist on backend; only frontend paths wrong |
| `reviewsApi.ts` | **Replace** with `reviewApi.ts` | Already has correct paths; dead file |
| `rez-merchant-service` models (67 proxies) | **Consolidate** to rez-shared interfaces | No logic — just schema declarations |
| `routes/admin/payroll.ts` | **Rebuild** (completely wrong) | Hardcoded salaries, inline schema, mock data |
| `routes/admin/platformStats.ts` | **Rebuild** (zeroed data) | Returns blank data; needs real aggregation |
| `walletService.ts` (894 lines) | **Extract + decompose** | Split into `coinService`, `balanceService`, `redemptionService` |
| `rez-api-gateway` | **Build** (doesn't exist) | No routing config at all |

### Long-Term Architecture Target (12+ weeks)
```
                    ┌─────────────────┐
                    │   rez-api-gateway│  ← nginx config committed to repo
                    │  (proper proxy) │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       rez-auth-service  rezbackend    rez-merchant-service
       (OTP/JWT only)   (consumer     (merchant domain
                         core +        complete)
                         admin)
              ▼
       rez-wallet-service
       (financial ledger)
```
The monolith should be progressively reduced — not replaced — by moving merchant routes to rez-merchant-service and extracting wallet operations to rez-wallet-service. The `merchantroutes/` directory is the primary candidate for migration.

---

## MONITORING CHECKLIST (Implement Before Any Deploy)

- [ ] Alert on `balance.available < 0` in `wallets` collection
- [ ] Alert on `merchantwallettransactions` with negative `amount`
- [ ] Alert on GST report returning 0 orders (was always zero — now detectable)
- [ ] Alert on `payout.request` where amount > merchant `balance.available`
- [ ] Log `coinsCredited` flag race window (two concurrent credits same orderNumber)
- [ ] Alert on `payment.failed` webhook firing on an order already `paid`
- [ ] Track percentage of merchant API calls falling through to monolith 404s

---

*Generated by 8-agent forensic audit on `audit/recovery-phase` branch.*  
*Total findings: 47 CRITICAL/HIGH, 31 MEDIUM, 12 LOW across 250+ source files.*
