# Gen 14 — CRITICAL Issues (15 issues)

**Generated:** 2026-04-16 | **Status:** All OPEN

---

## RP-C01: Karma Service HTTP Routes Return 501 — Never Mounted

**Severity:** CRITICAL | **Category:** Architecture | **Status:** OPEN

**Files:**
- `rez-karma-service/src/routes/index.ts` (lines with 501 stubs)
- `rez-karma-service/src/routes/karmaRoutes.ts` (implementations exist but unused)
- `rez-karma-service/src/routes/verifyRoutes.ts` (implementations exist but unused)
- `rez-karma-service/src/routes/batchRoutes.ts` (implementations exist but unused)

**Issue:**
```typescript
// routes/index.ts — what exists:
router.use('/api/karma', (_req, res) => {
  res.status(501).json({ success: false, message: 'Not yet implemented' });
});
router.use('/api/karma/verify', (_req, res) => { ... 501 });
router.use('/api/karma/batch', (_req, res) => { ... 501 });
```
Full implementations exist in `karmaRoutes.ts`, `verifyRoutes.ts`, and `batchRoutes.ts` but were never connected to the main Express app. The karma service is deployed but all user-facing endpoints return 501.

**Impact:** Karma user profile, verification, and batch processing are completely non-functional through the HTTP API. Gamification loop is broken.
**Affected Services:** rez-karma-service, rez-app-consumer, rez-app-admin
**Est. Fix:** 1h — Replace the 501 stubs with proper `app.use()` calls to the actual route handlers.

---

## RP-C02: CrossAppSyncService Webhook Delivery Is Dead Code

**Severity:** CRITICAL | **Category:** Data Sync | **Status:** OPEN

**File:** `Rendez/rendez-backend/src/merchantservices/CrossAppSyncService.ts:261-293`

**Issue:**
```typescript
// ACTUAL HTTP CALL — COMMENTED OUT:
// const response = await axios.post(webhookUrl, { event, data, timestamp: Date.now() });
// return response.data;
// Only logs: "Simulated webhook delivery"
```
Every order status update, cashback update, and product update that should flow from merchant app to consumer app is silently discarded. Webhook registrations are also in-memory — cleared on every restart.

**Impact:** Merchant changes (order status, product updates, cashback approvals) never reach the consumer app. Users see stale data. "Fixing merchant doesn't appear in consumer" is the root symptom.
**Affected Services:** Rendez, rez-app-consumer, rez-backend (monolith)
**Est. Fix:** 2h — Uncomment and fix the webhook call, replace in-memory webhook registry with MongoDB persistence.

---

## RP-C03: syncOrders() + syncCashback() Are No-Ops

**Severity:** CRITICAL | **Category:** Data Sync | **Status:** OPEN

**File:** `Rendez/rendez-backend/src/merchantservices/SyncService.ts:396-409`

**Issue:**
Both methods return `{ synced: 0 }` but the route handler wraps this as `{ success: true, result: { synced: 0 } }`. The `synced: 0` is masked by `success: true`.

**Impact:** Any system relying on these endpoints believes sync succeeded when nothing was synced. Merchant data stays out of consumer app indefinitely.
**Affected Services:** Rendez, rez-app-consumer
**Est. Fix:** 1h — Implement the actual sync logic or return `{ success: false }` with an error message.

---

## RP-C04: Double Karma Credit — Both Services Credit Karma

**Severity:** CRITICAL | **Category:** Financial | **Status:** OPEN

**Files:**
- `rez-karma-service/src/services/earnRecordService.ts`
- `rez-karma-service/src/services/karmaService.ts`

**Issue:** Both `earnRecordService` and `karmaService` credit karma for the same earn event. Users receive double karma on every verified earn record.

**Impact:** Karma pool is depleted 2x faster than designed. Loyalty costs are 100% higher than intended. No audit trail of which service actually credited the karma.
**Affected Services:** rez-karma-service, rez-app-consumer (gamification display)
**Est. Fix:** 2h — Identify which service should be the sole author of karma credits. Disable the duplicate path.

---

## RP-C05: Batch Pool Decrement Before Record Save — No Transaction

**Severity:** CRITICAL | **Category:** Financial | **Status:** OPEN

**File:** `rez-karma-service/src/services/batchService.ts`

**Issue:** Batch service decrements the karma pool **before** saving the earn record to MongoDB. If the save fails, the pool is permanently corrupted with no transaction rollback.

**Impact:** Karma pool can go negative or permanently lose capacity without any way to recover. Pool accounting is unreliable.
**Affected Services:** rez-karma-service
**Est. Fix:** 2h — Wrap the decrement and save in a MongoDB transaction, or decrement only after successful save.

---

## RP-C06: Referral Credit Is Fire-and-Forget — No Retry

**Severity:** CRITICAL | **Category:** Financial | **Status:** OPEN

**File:** `ReferralService.ts` (any service with referral logic)

**Issue:** Referral credit is called with no try/catch, no retry mechanism, no DLQ, and no compensating transaction. If the credit fails, the referrer never receives their bonus.

**Impact:** Users who refer friends lose out on referral bonuses silently. No way to detect or recover failed referral credits.
**Affected Services:** All services with referral logic
**Est. Fix:** 1h — Add retry with exponential backoff + DLQ for failed referral credits.

---

## RP-C07: Referral Credit Race Condition

**Severity:** CRITICAL | **Category:** Financial | **Status:** OPEN

**File:** `ReferralService.ts`

**Issue:** Referral credit has a race condition where concurrent referral completions can result in double credit or inconsistent state.

**Impact:** Same as RP-C06 but triggered by concurrent calls. Either double-credit or silent failure depending on race outcome.
**Affected Services:** All services with referral logic
**Est. Fix:** 1h — Add idempotency key based on `(referrerId, refereeId, referralId)`.

---

## RP-C08: Admin Auth Bypass — requireAdmin Is Undefined

**Severity:** CRITICAL | **Category:** Security | **Status:** OPEN

**File:** `rez-karma-service/src/routes/batchRoutes.ts:220`

**Issue:**
```typescript
// Line 8: import { requireAdminAuth } from '../middleware/adminAuth.js';
// Line 220: router.get('/stats', requireAdmin, ...); // requireAdmin is UNDEFINED
```
The route references `requireAdmin` but only `requireAdminAuth` is imported. At runtime, `requireAdmin` is `undefined`, so calling it throws a `ReferenceError`. This means the route handler is called directly without any auth check — financial batch statistics are exposed to anyone.

**Impact:** Unauthenticated access to batch statistics (total batches, executed batches, coin totals, karma totals). Confidential operational metrics exposed.
**Affected Services:** rez-karma-service, rez-app-admin
**Est. Fix:** 1h — Add `import { requireAdminAuth as requireAdmin }` to batchRoutes.ts, or replace `requireAdmin` with `requireAdminAuth`.

---

## RP-C09: Wallet Service Calls Have No Authentication

**Severity:** CRITICAL | **Category:** Security | **Status:** OPEN

**File:** `rez-karma-service/src/services/walletIntegration.ts`

**Issue:** The `creditUserWallet()` and `getKarmaBalance()` functions use a raw `axios` client with no API key, no bearer token, and no HMAC signature. They connect to `WALLET_SERVICE_URL` (defaults to `http://rez-wallet-service:4004`). No `Authorization` header is set on any wallet service call.

**Impact:** If the internal network is compromised, anyone reaching port 4004 on that host can credit arbitrary wallets or read balances.
**Affected Services:** rez-karma-service, rez-wallet-service
**Est. Fix:** 2h — Add service-to-service JWT or HMAC authentication. Set `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` on all wallet service requests.

---

## RP-C10: JWT Secret Fallback in Test Files

**Severity:** CRITICAL | **Category:** Security | **Status:** OPEN

**Files:**
- `Rendez/rendez-backend/src/tests/setup.ts:11`
- `Rendez/rendez-backend/src/tests/criticalPath.test.ts:82`

**Issue:** Both files use `process.env.JWT_SECRET = 'test-secret-rendez'` and `JWT_SECRET = process.env.JWT_SECRET || 'test-secret-rendez'`. While these are in test files, if any build or deployment pipeline accidentally bundles test code into production, the fallback secret would be active.

**Impact:** If the env var is misconfigured in production, auth uses the hardcoded test secret.
**Affected Services:** Rendez
**Est. Fix:** 0.5h — Throw an error instead of falling back to a test secret. Fail builds with missing env vars via CI check.

---

## RP-C11: 3 Incompatible CoinTransaction Schemas, Same Collection

**Severity:** CRITICAL | **Category:** Data Sync | **Status:** OPEN

**Files:**
- `rezbackend/models/CoinTransaction.ts` — writes: `coinType, source, description, balance, coinStatus`
- `rez-wallet-service/models/CoinTransaction.ts` — writes: `coinType, source, balanceBefore, balanceAfter, sourceId`
- `rez-merchant-service/models/CoinTransaction.ts` — writes: `coins, storeId, orderId, reason, status`

**Issue:** Three services define the same Mongoose model with completely different field names. All three write to the same `cointransactions` collection. The merchant service writes `coins: Number` directly — not `coinType` — so the monolith's required fields are never set.

**Impact:** Active data corruption. Balance calculations include malformed records. Audit trails are unreliable. Any query for `coinType` misses merchant-service records.
**Affected Services:** All wallet/coin-handling services
**Est. Fix:** 4h — Define canonical CoinTransaction schema in shared-types. Migrate existing records. Enforce via fitness test.

---

## RP-C12: cashback + referral Coins Invisible in Wallet/Ledger

**Severity:** CRITICAL | **Category:** Data Sync | **Status:** OPEN

**Files:**
- `coinTypes.ts` (declares 6 coin types including cashback, referral)
- `rez-wallet-service/models/Wallet.ts` (only 4 coin types: rez, prive, branded, promo)
- `LedgerEntry.ts` (also excludes cashback and referral)

**Issue:** `coinTypes.ts` declares 6 coin types but `Wallet.coins[].type` only supports 4. Cashback and referral coin types are declared but never actually stored in the wallet or ledger.

**Impact:** Double-entry accounting is broken for cashback and referral coins. Financial liability is undercounted. Users may not be able to redeem cashback coins even though they exist.
**Affected Services:** rez-wallet-service, rezbackend
**Est. Fix:** 2h — Add cashback and referral to Wallet.coin type enum. Add LedgerEntry support.

---

## RP-C13: IEarnRecord.verificationSignals — Canonical vs Actual Mismatch

**Severity:** CRITICAL | **Category:** API Contract | **Status:** OPEN

**Files:**
- Canonical: `packages/shared-types/src/entities/karma.ts`
- Actual: `rez-karma-service/src/models/EarnRecord.ts`

**Issue:**
```typescript
// Canonical type defines:
verificationSignals: { gps_match?: number; qr_verified?: boolean; face_verified?: boolean; manual_override?: boolean }

// Actual EarnRecord model uses:
{ qr_in, qr_out, gps_match, ngo_approved, photo_proof }
```
Entirely different field names — `qr_verified` vs `qr_in`/`qr_out`, no `face_verified` in actual model.

**Impact:** Any consumer/admin app importing the canonical type gets wrong field names. Calls to karma service will use wrong field keys. Type-safe serialization breaks.
**Affected Services:** rez-karma-service, packages/shared-types, rez-app-consumer, rez-app-admin
**Est. Fix:** 2h — Either update the canonical type to match the actual model, or update the model to match the canonical type. Choose one canonical and enforce.

---

## RP-C14: Frontend Missing voucherCode + offerRedemptionCode in Order Payload

**Severity:** CRITICAL | **Category:** API Contract | **Status:** OPEN

**Files:**
- Frontend: `rez-app-consumer/services/ordersApi.ts` (lines 170-210)
- Backend: `rezbackend/src/controllers/orderCreateController.ts` (lines 329-334)

**Issue:** Backend `orderCreateController.ts` destructures `voucherCode` and `offerRedemptionCode` from `req.body`, but `CreateOrderRequest` interface in `ordersApi.ts` does not include these fields.

**Impact:** If backend marks these as required → 400 on all orders. If optional → voucher/offer redemptions silently ignored. Users can't use vouchers.
**Affected Services:** rez-app-consumer, rezbackend (order service)
**Est. Fix:** 1h — Add `voucherCode?: string` and `offerRedemptionCode?: string` to `CreateOrderRequest` interface.

---

## RP-C15: Admin Missing store.merchantId in Order Response

**Severity:** CRITICAL | **Category:** API Contract | **Status:** OPEN

**Files:**
- Frontend: `rez-app-admin/services/api/orders.ts` (line 18)
- Backend: `rezbackend/src/controllers/orderController.ts`

**Issue:** Admin app expects `order.store: { _id, name, merchantId }` for merchant-based filtering. Backend likely only populates `_id` and `name`. Backend's `.populate('store', '_id name logo')` is missing `merchantId` in field selection.

**Impact:** Admin's "Filter by merchant" returns ALL orders regardless of merchant. Multi-merchant admin shows mixed data. Potential data leak: admins see orders from unauthorized merchants.
**Affected Services:** rez-app-admin, rezbackend
**Est. Fix:** 1h — Add `merchantId` to the store populate call in orderController.ts.

---

## RP-C16: Cart Optimistic Update Has No Rollback — Ghost Items After Failure

**Severity:** CRITICAL | **Category:** UX | **Status:** OPEN

**Files:**
- `rez-app-consumer/contexts/CartContext.tsx`
- `rez-app-consumer/services/offlineQueueService.ts`

**Issue:** When `addItem` is called, the reducer dispatches `ADD_ITEM` immediately (line 699), updating the UI optimistically. If the subsequent API call fails, `catch` at line 849 adds to `offlineQueueService` for later retry — but the item is ALREADY in local state. If the offline queue also fails (e.g., storage quota exceeded), the item remains in local state but will never sync. No mechanism exists to detect and remove items that failed to sync.

**Impact:** User sees items in cart that never reached the backend. Checkout may proceed with ghost items. User pays for items the backend doesn't know about.
**Affected Services:** rez-app-consumer, rezbackend
**Est. Fix:** 2h — Add rollback on persistent sync failure. Show user feedback when sync fails persistently. Add a `syncStatus` field to cart items.

---

## RP-C17: Consumer Offline Queue Silently Drops on QuotaExceededError

**Severity:** CRITICAL | **Category:** Offline | **Status:** OPEN

**Files:**
- `rez-app-consumer/stores/offlineQueueStore.ts`
- `rez-app-consumer/contexts/OfflineQueueContext.tsx`

**Issue:** `addToQueue` wraps the call in try/catch and re-throws after setting error. But `syncQueue` (line 69) catches errors and only sets `{ error: err.message }` without throwing. The `OfflineQueueContext.tsx` catches sync errors and calls `onSyncError` callback — but if the provider is rendered without these callbacks (the default), errors are silently swallowed. If storage quota is exceeded during queue processing, bills queued offline may never sync without user awareness.

**Impact:** User queues bills offline, app shows "saved", but the queue silently fails on sync. User never knows their bills were lost.
**Affected Services:** rez-app-consumer, rezbackend
**Est. Fix:** 1h — Add persistent error banner when offline queue fails. Persist failed items for manual retry. Always call `onSyncError` even without explicit callbacks.

---

> **Count: 17 CRITICAL issues** (added RP-C16, RP-C17 from UX/Perf audit agent findings)
