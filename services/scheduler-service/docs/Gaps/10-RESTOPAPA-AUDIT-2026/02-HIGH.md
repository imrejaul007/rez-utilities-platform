# Gen 14 — HIGH Severity Issues (29 issues — 6 MISSING from first pass)

**Generated:** 2026-04-16 | **Status:** All OPEN

> **6 issues added 2026-04-16** from UX/Perf audit agent — homepage loading, sequential API calls, hardcoded ObjectId, missing button states, POS offline queue. Also added from merchant POS audit: bill data persistence race condition, missing consumer ID in bill, offline queue no idempotency key.

---

## Pre-Existing HIGH Issues (RP-H01 through RP-H23)

*(See full descriptions below — these were documented in the first pass)*

RP-H01 through RP-H23 cover: enum fragmentation, POS refund impossible, wallet cache invalidation gap, 15-min product staleness, phantom balance, gamification fail-open, no real-time admin, disconnected cashback collections, hardcoded cap, duplicate computation, hardcoded conversion rate, notification commented out, undefined KDS priority, wallet field truncation, auth fail-open, triple balance fallback, duplicate delivery field, separate wallet systems, dual payout no idempotency, socket room ownership, currency mismatch, no ledger FK, ghost user proxy.

## RP-H01: Enum Fragmentation — 15+ Status String Variants Across 6 Repos

**Severity:** HIGH | **Category:** Enum/Status | **Status:** OPEN

**Files:** Multiple across all 6 repos

**Issue:** No shared canonical enum. Each service defines its own status literals:

| Service | File | Status Values |
|---------|------|--------------|
| `rez-contracts` | transaction.schema.json | `"pending" \| "processing" \| "completed" \| "failed" \| "cancelled" \| "refunded"` |
| `rez-app-consumer` | paymentService.ts | `"pending" \| "processing" \| "completed" \| "failed" \| "cancelled"` |
| `rez-app-consumer` | subscriptionApi.ts | `"paid" \| "failed" \| "pending"` |
| `rez-app-consumer` | pointsApi.ts | `"pending" \| "completed" \| "cancelled" \| "expired"` |
| `rez-app-consumer` | bonusZoneApi.ts | `"pending" \| "verified" \| "credited" \| "rejected" \| "expired"` |
| `rez-app-marchant` | pos.ts | `"pending" \| "paid" \| "cancelled" \| "expired"` |
| `rez-app-marchant` | wallet.ts | `"pending" \| "completed" \| "failed" \| "cancelled"` |
| `rez-app-admin` | payroll.ts | `"processed" \| "pending" \| "failed"` |
| `rez-karma-service` | EarnRecord | `'PENDING' \| 'VERIFIED' \| 'CONVERTED' \| 'FAILED'` (uppercase) |

**Impact:** Orders can appear stuck in "pending" because the status string doesn't match what the UI expects. Payment confirmation checks (`status === 'completed'`) fail if backend returns `'COMPLETED'` or `'COMPLETE'`.
**Est. Fix:** 4h — Define all status enums in `rez-contracts` and import everywhere. Enforce via `no-bespoke-enums.sh` fitness test.

---

## RP-H02: POS Bill Uses `paid` — Canonical Uses `completed` — Refund Impossible

**Severity:** HIGH | **Category:** Enum/Status | **Status:** OPEN

**Files:**
- `rez-app-marchant/services/api/pos.ts` (POS bills use `'pending' | 'paid' | 'cancelled' | 'expired'`)
- `rez-contracts/transaction.schema.json` (canonical uses `'completed'`)

**Issue:** POS bills use `paid` instead of `completed` and lack `processing`, `refunded` states entirely. A refund flow (POS → refund → status would be "refunded") is impossible because POS bills never had a "refunded" state.

**Impact:** Merchants requesting a bill refund won't see it reflected. POS refund workflow is completely broken.
**Est. Fix:** 1h — Align POS bill statuses with canonical transaction schema.

---

## RP-H03: Wallet Service Redis Cache Not Invalidated by Monolith

**Severity:** HIGH | **Category:** Data Sync | **Status:** OPEN

**Issue:** When `rez-wallet-service` credits/debits a wallet, it invalidates its own Redis cache keys. The monolith has its own Redis cache for wallets (`wallet:{userId}`, `wallet:balance:{userId}`). The wallet service does not invalidate the monolith's cache keys.

**Impact:** After a wallet-service mutation, users see stale balances in the monolith for the duration of the cache TTL.
**Affected Services:** rez-wallet-service, rezbackend
**Est. Fix:** 2h — Either use a shared cache namespace with cross-invalidation, or publish a cache invalidation event.

---

## RP-H04: Product Updates 15 Minutes Stale in Admin

**Severity:** HIGH | **Category:** Data Sync | **Status:** OPEN

**Issue:** Merchant product changes sync to user-side `Product` model only via: (1) manual trigger `POST /api/sync/trigger`, or (2) auto-sync at 15-minute default interval. No event is published to notify admin. Admin views of product catalogs can be up to 15 minutes stale.

**Impact:** Admin sees outdated product data. Cashback and pricing rules may be stale. Admin decisions based on stale data.
**Affected Services:** rez-app-admin, rez-merchant-service
**Est. Fix:** 2h — Replace polling with event-driven cache invalidation.

---

## RP-H05: UserLoyalty.coins.available Is Phantom Balance

**Severity:** HIGH | **Category:** Data Sync | **Status:** OPEN

**File:** `rezbackend/src/models/UserLoyalty.ts` (lines 49-58)

**Issue:** `UserLoyalty` maintains its own `coins.available` counter locally. `CoinTransaction.getUserBalance()` reads from `Wallet.balance.available`. No code path keeps `UserLoyalty.coins.available` in sync with either.

**Impact:** Any UI component displaying `UserLoyalty.coins.available` shows incorrect data.
**Affected Services:** rez-app-consumer, rez-app-admin, rezbackend
**Est. Fix:** 2h — Remove phantom balance field or implement proper synchronization.

---

## RP-H06: Gamification Event Emitter Fail-Open

**Severity:** HIGH | **Category:** Data Sync | **Status:** OPEN

**Issue:** Gamification events use an in-process EventEmitter as the primary mechanism. If the EventEmitter fails and the BullMQ enqueue also fails, the event is lost (fail-open).

**Impact:** Users may not receive streak, milestone, or challenge rewards silently. No way to detect or recover lost gamification events.
**Affected Services:** rez-gamification-service, rez-wallet-service
**Est. Fix:** 1h — Add a third persistence layer (DB write) as fallback before EventEmitter + BullMQ.

---

## RP-H07: Admin Dashboard Has No Real-Time Update Mechanism

**Severity:** HIGH | **Category:** Data Sync | **Status:** OPEN

**Issue:** Admin dashboard reads from MongoDB directly. No push or invalidation mechanism exists. Admin sees data eventually but not in real-time.

**Impact:** Admin CSR pool views, order monitoring, and fraud dashboards show stale data.
**Affected Services:** rez-app-admin
**Est. Fix:** 2h — Add WebSocket or SSE for real-time admin updates.

---

## RP-H08: Two Disconnected Cashback Collections

**Severity:** HIGH | **Category:** Data Sync | **Status:** OPEN

**Files:**
- `rezbackend` — `cashbackrequests` collection
- `rez-merchant-service` — `cashbacks` collection

**Issue:** Cashback approval in the merchant portal writes to `cashbacks`. Cashback credit in the backend reads from `cashbackrequests`. Neither service knows the other exists.

**Impact:** Cashback paid to users has zero traceability to merchant-side approval. Audit trail is broken.
**Affected Services:** rez-app-marchant, rez-app-consumer, rezbackend
**Est. Fix:** 2h — Unify into one cashback collection with a single source of truth.

---

## RP-H09: Hardcoded WEEKLY_COIN_CAP = 300 Inline

**Severity:** HIGH | **Category:** Architecture | **Status:** OPEN

**File:** `rez-karma-service/src/services/karmaService.ts`

**Issue:** Weekly karma cap is hardcoded as `300` inline in `addKarma()` rather than importing `WEEKLY_COIN_CAP` from `karmaEngine.ts` where it is already defined.

**Impact:** If the cap ever changes in karmaEngine, the service will continue using the old value. Inconsistency between configured cap and enforced cap.
**Affected Services:** rez-karma-service
**Est. Fix:** 0.5h — Replace hardcoded `300` with `import { WEEKLY_COIN_CAP } from '../engines/karmaEngine.js'`.

---

## RP-H10: Duplicate startOfWeek Computation in addKarma()

**Severity:** HIGH | **Category:** Architecture | **Status:** OPEN

**File:** `rez-karma-service/src/services/karmaService.ts:128 and 195`

**Issue:** `startOfWeek` is computed twice in the same function. Also the cap is hardcoded inline (see RP-H09).

**Impact:** Redundant computation; potential for divergence if the two computations are edited independently.
**Affected Services:** rez-karma-service
**Est. Fix:** 0.5h — Compute `startOfWeek` once at the top of the function and reuse.

---

## RP-H11: Karma Profile Route Re-Implements Conversion Rate

**Severity:** HIGH | **Category:** Architecture | **Status:** OPEN

**File:** `rez-karma-service/src/routes/karmaRoutes.ts`

**Issue:** Karma profile endpoint returns `conversionRate` computed inline with hardcoded values (L1→0.25, L2→0.5, L3→0.75, L4→1.0) rather than calling `getConversionRate()` from `karmaEngine.ts`.

**Impact:** Two sources of truth for conversion rates. If engine logic changes, the route silently returns stale values.
**Affected Services:** rez-karma-service
**Est. Fix:** 0.5h — Import and call `getConversionRate()` from karmaEngine.

---

## RP-H12: Karma Conversion Notification Commented Out

**Severity:** HIGH | **Category:** Business Logic | **Status:** OPEN

**File:** `rez-karma-service/src/services/batchService.ts`

**Issue:**
```typescript
// Phase 2: call notification service (push + in-app)
// await notificationService.send(record.userId, {...});
```
Notification is commented out as a Phase 2 placeholder. Users who earn karma coins from batch conversions receive no notification.

**Impact:** Users do not know they received coin credits from karma conversions. Poor user experience for the core loyalty loop.
**Affected Services:** rez-karma-service, rez-app-consumer
**Est. Fix:** 1h — Uncomment and wire up the notification call.

---

## RP-H13: Merchant KDS Priority Sort Undefined

**Severity:** HIGH | **Category:** Business Logic | **Status:** OPEN

**File:** Backend `merchant/orders.ts` (line 49)

**Issue:** KDS advertises `sortBy='priority'` but the Order schema does not define what `priority` means or how it is computed. Is it a stored field or computed at query time?

**Impact:** KDS ranking may silently fail. Orders are returned in default order rather than priority-sorted.
**Affected Services:** rez-app-marchant, rezbackend
**Est. Fix:** 1h — Define the `priority` field in the Order schema and implement the sorting logic.

---

## RP-H14: Wallet Microservice Truncates 3+ Fields

**Severity:** HIGH | **Category:** Architecture | **Status:** OPEN

**File:** `rez-wallet-service/models/Wallet.ts`

**Issue:** Wallet microservice schema is missing: `categoryBalances`, `limits`, `settings`, `savingsInsights`, `statistics.totalRefunds/topups/withdrawals`. When the microservice writes a wallet document, all absent fields are unset (Mongoose `strict: false` behavior or direct overwrite).

**Impact:** User wallet intelligence data is permanently zeroed on every wallet-service write. Users lose access to spending insights and category breakdowns.
**Affected Services:** rez-wallet-service, rezbackend, rez-app-consumer
**Est. Fix:** 2h — Add missing fields to wallet microservice schema. Migrate existing documents.

---

## RP-H15: Auth Service 503 Fails Open for Admin Routes

**Severity:** HIGH | **Category:** Security | **Status:** OPEN

**File:** `rez-karma-service/src/middleware/auth.ts:57`

**Issue:** When the auth service is unreachable (network error, not a 401 response), `requireAuth` returns HTTP 503. This means protected routes are temporarily open during auth service outages.

**Impact:** During auth service downtime, all karma operations halt. If any service or load balancer treats 503 as a bypass signal, the system could be exposed.
**Affected Services:** rez-karma-service
**Est. Fix:** 1h — Fail-closed for admin routes (503 = deny). Add circuit breaker to prevent retry storms.

---

## RP-H16: Triple Fallback for Wallet Balance

**Severity:** HIGH | **Category:** API Contract | **Status:** OPEN

**File:** `rez-app-consumer/services/coinSyncService.ts`

**Issue:**
```typescript
let balance = response.data.balance?.available;
if (balance === undefined) { balance = response.data.coins?.available; }
if (balance === undefined && Array.isArray(response.data.balance)) {
  balance = response.data.balance[0]?.available;
}
```
Code tries three different response shapes. Comment says "SINGLE SOURCE OF TRUTH: Wallet API" but implementation shows uncertainty.

**Impact:** Balance displayed to user may be wrong depending on which fallback path fires.
**Affected Services:** rez-app-consumer, rez-wallet-service
**Est. Fix:** 1h — Standardize wallet API response shape. Remove all fallbacks.

---

## RP-H17: order.totals.delivery vs order.delivery.deliveryFee

**Severity:** HIGH | **Category:** API Contract | **Status:** OPEN

**File:** `rez-app-consumer/services/ordersApi.ts:71, 106`

**Issue:** Delivery cost exists in two places on the Order type: `order.totals.delivery` and `order.delivery.deliveryFee`. Same data in two locations.

**Impact:** UI display could read the wrong field. Maintenance nightmare. Potential for stale/incorrect delivery cost in reports.
**Affected Services:** rez-app-consumer, rezbackend
**Est. Fix:** 0.5h — Pick one authoritative field. Remove the duplicate.

---

## RP-H18: Merchant and Consumer Wallets Are Separate Systems

**Severity:** HIGH | **Category:** Architecture | **Status:** OPEN

**Files:**
- `rez-app-marchant/services/api/wallet.ts`
- Consumer wallet services

**Issue:** Merchant wallet tracks merchant balance, bank details, and settlement cycles — completely separate from consumer wallet. No shared wallet infrastructure. Different coin types, different APIs, different business rules.

**Impact:** No unified wallet view across the platform. Complex reconciliation when merchant wants to pay out consumer.
**Affected Services:** rez-app-marchant, rez-app-consumer
**Est. Fix:** 4h — Design a unified wallet architecture. This is a large refactor.

---

## RP-H19: Dual Payout System Without Settlement Idempotency

**Severity:** HIGH | **Category:** Financial | **Status:** OPEN

**Files:**
- `rez-app-marchant/services/api/payouts.ts`
- `rezbackend/walletMerchant.ts`

**Issue:** Settlement processor lacks an idempotency key. Concurrent calls to settlement could result in double payouts.

**Impact:** Direct financial loss. Merchant receives double payout.
**Affected Services:** rez-app-marchant, rezbackend
**Est. Fix:** 2h — Add idempotency key `(merchantId, payoutRequestId)` to settlement processor.

---

## RP-H20: Merchant Socket Room Ownership Not Validated

**Severity:** HIGH | **Category:** Security | **Status:** OPEN

**File:** `rez-app-marchant/services/api/socket.ts:121, 172-228, 410-427`

**Issue:** After socket connects and authenticates via JWT, the client emits `join-merchant-dashboard(merchantId)` with the merchant ID from local storage. There is no server-side validation that the authenticated merchant is actually the owner of that merchantId.

**Impact:** A merchant could theoretically emit `join-merchant-dashboard(otherMerchantId)` and receive events for a rival's dashboard.
**Affected Services:** rez-app-marchant
**Est. Fix:** 1h — Validate `socket.auth.merchantId === emitted merchantId` on the server side.

---

## RP-H21: Wallet Currency Default Mismatch — RC vs REZ_COIN

**Severity:** HIGH | **Category:** Data Sync | **Status:** OPEN

**Files:**
- `rezbackend/models/Wallet.ts` (defaults to `'RC'`)
- `rez-wallet-service/models/Wallet.ts` (defaults to `'REZ_COIN'`)

**Issue:** Backend defaults to `'RC'`, wallet service defaults to `'REZ_COIN'`. Mixed values in the same `wallets` collection.

**Impact:** Any `currency === 'RC'` filter misses wallet-service-created documents.
**Affected Services:** rez-wallet-service, rezbackend
**Est. Fix:** 0.5h — Standardize to one currency code. Migrate existing records.

---

## RP-H22: Concurrent Fiat + Coin Ledger with No Linking FK

**Severity:** HIGH | **Category:** Data Sync | **Status:** OPEN

**Issue:** `Transaction.ts` (fiat) and `CoinTransaction.ts` (coins) are separate collections with no foreign key. Cashback credit (CoinTransaction) and fiat Transaction recording happen simultaneously with no transactional guarantee.

**Impact:** Fiat and coin transactions can diverge permanently after any partial failure.
**Affected Services:** All financial-handling services
**Est. Fix:** 2h — Add a `transactionGroupId` FK linking fiat and coin transactions.

---

## RP-H23: Ghost User Proxy Writes Directly to Users Collection

**Severity:** HIGH | **Category:** Architecture | **Status:** OPEN

**File:** `rez-merchant-service/src/models/User.ts`

**Issue:** Merchant service defines a User model with `strict: false`. This writes arbitrary unvalidated fields directly to the shared `users` collection, bypassing all canonical validation.

**Impact:** Any field name collision silently overwrites legitimate user data. No validation on merchant-service user writes.
**Affected Services:** rez-merchant-service, rezbackend
**Est. Fix:** 2h — Remove direct user writes from merchant service. Use API calls instead.

---

## RP-H24: Homepage Loading Shows Nothing on Initial Mount

**Severity:** HIGH | **Category:** UX | **Status:** OPEN

**File:** `rez-app-consumer/hooks/useHomepage.ts` + `rez-app-consumer/components/homepage/*.tsx`

**Issue:** `useHomepageBatch()` returns `isLoading: true && !data`. When the component first mounts, if there is any cached data from a previous render, `data` may be truthy — making `loading: false` even during the initial fetch. User sees nothing with no skeleton or loading indicator. There is no distinction between "showing cached data while refetching" vs "showing current data."

**Impact:** User may interact with stale homepage data thinking it is current, or see a blank page during initial load.
**Affected Services:** rez-app-consumer
**Est. Fix:** 0.5h — Use a distinct state for initial load (no data yet) vs background refresh (has data). Show skeleton during initial load.

---

## RP-H25: useFashionData Makes 4 Sequential Uncached API Calls Per Render

**Severity:** HIGH | **Category:** Performance | **Status:** OPEN

**File:** `rez-app-consumer/hooks/useFashionData.ts:531-536`

**Issue:** `useEffect` with 4 separate dependency functions calls `fetchFeaturedStores`, `fetchFashionStores`, `fetchFeaturedProducts`, `fetchCategories` directly — none wrapped in `useCallback`. No React Query or caching layer. Every component mount fires 4 sequential HTTP requests. No debouncing, no deduplication, no pagination. Each has independent loading states but the parent has no control over when they resolve.

**Impact:** 4 sequential HTTP requests on every page visit. Slow perceived performance on 3G. Each render can trigger 4 new fetches.
**Affected Services:** rez-app-consumer
**Est. Fix:** 1h — Wrap fetch functions in `useCallback`. Use React Query for caching. Parallelize the 4 calls.

---

## RP-H26: Hardcoded MongoDB ObjectId in Fashion Product Filter

**Severity:** HIGH | **Category:** Security | **Status:** OPEN

**File:** `rez-app-consumer/hooks/useFashionData.ts:320`

**Issue:**
```typescript
const FASHION_CATEGORY_ID = '68ecdb9f55f086b04de299ef';
```
This MongoDB ObjectId is hardcoded as a literal string. It is environment-specific and will differ between dev/staging/production. If the backend changes this ID, all fashion products silently disappear from the consumer app.

**Impact:** Fashion products silently fail to appear across environments. No error, no fallback — just a blank section.
**Affected Services:** rez-app-consumer
**Est. Fix:** 0.5h — Move to `EXPO_PUBLIC_FASHION_CATEGORY_ID` env var. Add fallback behavior if category doesn't exist.

---

## RP-H27: Checkout Pay Button Has No Loading State

**Severity:** HIGH | **Category:** UX | **Status:** OPEN

**File:** `rez-app-consumer/app/pay-in-store/payment.tsx:74-79`

**Issue:** `usePaymentFlow` returns `isProcessing` but the `PayButtonWithRewards` component does not show an `ActivityIndicator` or disable state when processing. User taps Pay and sees no feedback while the payment processes. They may tap again, causing duplicate submissions.

**Impact:** Duplicate payment submissions. Poor user experience during payment processing.
**Affected Services:** rez-app-consumer
**Est. Fix:** 0.5h — Add `isProcessing` check to disable button and show loading indicator in `PayButtonWithRewards`.

---

## RP-H28: POS Offline Queue Silently Drops Orders

**Severity:** HIGH | **Category:** Financial | **Status:** OPEN

**File:** `rez-app-marchant/app/pos/index.tsx` + `rez-app-marchant/services/offlinePOSQueue.ts`

**Issue:** When billing offline, `coinDiscountApplied` and `consumerIdForCoins` are never stored in the offline queue. When `syncOfflineQueue` POSTs to `merchant/pos/offline-sync`, it has no coin data. Backend creates bill at full amount. Customer who applied Rs.200 discount is charged Rs.200 extra with no recovery path.

**Impact:** Silent overcharge. Customer charged full amount despite having redeemed coins. No traceability.
**Affected Services:** rez-app-marchant, rezbackend
**Est. Fix:** 2h — Add `coinDiscountApplied` and `consumerIdForCoins` to `BillDataFields` interface. Store in `enqueueFullBill()`. Include in sync payload.

---

## RP-H29: POS Offline Queue Has No Idempotency Key

**Severity:** HIGH | **Category:** Financial | **Status:** OPEN

**File:** `rez-app-marchant/services/offlinePOSQueue.ts:232-249`

**Issue:** When syncing offline bills, the queue POSTs to `merchant/pos/offline-sync` without an idempotency key. If the sync request times out and is retried, the same bill can be submitted twice, resulting in double billing.

**Impact:** Double billing on retry. Customer charged twice for the same offline order.
**Affected Services:** rez-app-marchant, rezbackend
**Est. Fix:** 1h — Add idempotency key `(storeId + billId + timestamp)` to each offline sync request.
