# Bug Report 16 — Cross-Service Data Flow Audit
**Audit Agent:** Senior Distributed Systems Engineer (25yr exp)
**Audit Date:** 2026-04-14
**Scope:** Inter-service HTTP calls, event flows, shared collection conflicts, admin-merchant status reflection
**Files Audited:** 42 source files across 9 services

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 8 |
| MEDIUM | 6 |
| LOW | 4 |
| **Total** | **23** |

---

## CRITICAL

### CS-C1 — Double-Consumption on ALL Critical BullMQ Queues (Silent Data Corruption) {#cs-c1}
> **Status:** ✅ FIXED — cutover env vars now set in docker-compose.microservices.yml (rez-backend-worker service, 2026-04-14)

**Severity:** CRITICAL
**Files:**
- `rezbackend/rez-backend-master/src/workers/index.ts`, lines 307–316
- `docker-compose.microservices.yml`, lines 89–283

**What is wrong:**

The monolith's `startCriticalWorkers()` includes conditional cutover flags:
```typescript
const gamificationWorker = process.env.GAMIFICATION_WORKER_EXTERNAL === 'true' ? null : startGamificationWorker();
const orderWorker = process.env.ORDER_WORKER_EXTERNAL === 'true' ? null : startOrderWorker();
const walletWorker = process.env.WALLET_WORKER_EXTERNAL === 'true' ? null : startWalletWorker();
const paymentEventsWorker = process.env.PAYMENT_EVENTS_WORKER_EXTERNAL === 'true' ? null : startPaymentEventsWorker();
```

`docker-compose.microservices.yml` deploys `rez-gamification-service`, `rez-order-service`, `rez-wallet-service`, `rez-notification-events` as active containers — **without setting any of these cutover env vars on the monolith**. Both the monolith worker dyno and the standalone microservice workers are active consumers on the same five queues.

BullMQ does not error on multiple consumers — it load-balances jobs across all active consumers. Each job is delivered to exactly ONE worker. When both the monolith worker and the standalone microservice worker are active:
- **gamification-events**: ~50% of gamification events (achievements, streaks, challenges) are processed by the wrong worker, producing inconsistent state
- **order-events**: ~50% of settlement enqueues are silently swallowed by the monolith worker (different code path)
- **wallet-events**: ~50% of balance-change notifications and merchant settlement cache invalidations are lost
- **notification-events**: ~50% of push/email/SMS/in-app notifications never fire

**Impact:** Coin awards are lost. Notifications drop. Order settlements fail half the time. Completely silent — no errors thrown, jobs are just consumed by the wrong process.

**Fix:** For each standalone service deployed, set the corresponding env var to `'true'` on the monolith worker dyno:
```
GAMIFICATION_WORKER_EXTERNAL=true
ORDER_WORKER_EXTERNAL=true
WALLET_WORKER_EXTERNAL=true
NOTIFICATION_WORKER_EXTERNAL=true
PAYMENT_EVENTS_WORKER_EXTERNAL=true
```
Add these to `docker-compose.microservices.yml` under the monolith service's `environment` block.

---

### CS-C2 — Admin Approve/Suspend/Reject Does NOT Reach rez-merchant-service (Suspended Merchants Retain API Access) {#cs-c2}
> **Status:** ✅ FIXED (2026-04-13 — internal endpoint created and wired)

**Severity:** CRITICAL
**File:** `rezbackend/rez-backend-master/src/routes/admin/merchants.ts`, lines 410–531 (approve), 665–872 (suspend), 538–662 (reject)

**What is wrong:**

When admin approves, suspends, or rejects a merchant, the monolith updates the `merchants` MongoDB collection directly. The only cross-service signals are the notification queue and a socket emission. There is **zero HTTP call** to `rez-merchant-service` to invalidate its auth cache, JWT blacklist, or merchant session.

`rez-merchant-service` issues its own JWTs to merchants. When a merchant is suspended:
1. The monolith sets `merchant.isActive = false` in MongoDB.
2. `rez-merchant-service` has no cache-bust mechanism from this event.
3. A suspended merchant's JWT — issued by `rez-merchant-service` — remains valid until expiry.
4. The merchant can continue all API calls to `rez-merchant-service` (orders, products, POS) until the JWT TTL expires.

The socket `merchant-status-changed` emission only reaches the merchant's React Native app dashboard room, not the `rez-merchant-service` process itself.

**Impact:** Suspended or rejected merchants retain full API access to merchant endpoints until their JWT expires. This is a security gap for fraud or ToS violation suspensions.

**Fix:** In the admin suspend/reject/approve handlers, after `merchant.save()`, call `rez-merchant-service`'s internal endpoint (e.g., `POST /internal/merchants/:id/invalidate-session`) to flush any cached merchant session and blacklist all active JWTs for that merchant. The call should be fire-and-forget (non-fatal) but logged. This endpoint must be added to `rez-merchant-service`.

---

### CS-C3 — Gamification Service Writes Directly to `coinledgers` AND Calls Wallet Service: Dedup Key Consumed Before Wallet Credit {#cs-c3}
> **Status:** ✅ FULLY FIXED — previously only achievementWorker.ts was corrected; storeVisitStreakWorker.ts and httpServer.ts visit milestone path now also follow wallet-first ordering

**Severity:** CRITICAL
**Files:**
- `rez-gamification-service/src/workers/achievementWorker.ts`, lines 154–200
- `rez-gamification-service/src/workers/storeVisitStreakWorker.ts`, lines 106–157
- `rez-gamification-service/src/httpServer.ts`, lines 33–94 (`creditCoinsViaWalletService`)

**What is wrong:**

In `awardAchievementCoins()`, the gamification service:
1. Upserts a `coinledgers` document with `$setOnInsert` (direct MongoDB write to shared `coinledgers` collection) — consumes the idempotency key
2. Then calls `creditCoinsViaWalletService()` which POSTs to `wallet-service /internal/credit`

If `creditCoinsViaWalletService` returns `false` (wallet service down), the `coinledgers` entry already exists. On BullMQ retry, `upsertedCount === 0` — the retry logic sees the dedup key as consumed and returns early, **permanently skipping the wallet credit**.

The code at `achievementWorker.ts` lines 188–200 explicitly acknowledges this as an unrecovered discrepancy but says "Reconciliation via `/internal/reconcile` will surface this." However, the `/internal/reconcile` endpoint only checks wallet-vs-CoinTransaction divergence, NOT coinledger-vs-wallet divergence.

**Impact:** Every wallet service outage during an achievement unlock permanently orphans the coin credit — coins are ledgered but never reach the user's spendable wallet balance. The reconcile endpoint does NOT surface this discrepancy.

**Fix:**
- Remove the `coinledgers` pre-write in gamification workers. Let wallet service be the single authoritative writer.
- Use the `idempotencyKey` already passed to `/internal/credit` for deduplication within the wallet service itself.
- On `credited === false`, do NOT return early — throw so BullMQ retries the entire job.

---

### CS-C4 — `rez-wallet-service /internal/merchant/credit` Upsert Uses `storeId` (String) But Schema Requires `store` (ObjectId) {#cs-c4}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Files:**
- `rez-wallet-service/src/routes/internalRoutes.ts`, lines 159–163
- `rez-wallet-service/src/models/MerchantWallet.ts`, line 46 (`store: required: true, type: ObjectId`)

**What is wrong:**

The upsert at line 161:
```typescript
{ $setOnInsert: { merchant: ..., storeId, balance: {...}, statistics: {...} } }
```
stores `storeId` as a loose string field, but the `MerchantWallet` schema defines the field as `store` (not `storeId`) with `required: true` and type `ObjectId`. The upsert will either:
- Fail Mongoose validation on the first write (leaving the wallet uncreated), or
- Succeed via raw MongoDB (bypassing Mongoose validation), creating a document with `storeId` as a string key that Mongoose cannot query using the `store` field

Any downstream code querying `{ store: storeId }` (including `MerchantWalletSchema.index({ store: 1 })`) will miss these documents.

Additionally, the wallet-service `$setOnInsert` only initializes `totalWithdrawals` — `held`, `averageOrderValue`, and `totalRefunds` default to `undefined`, causing NaN/undefined arithmetic in the monolith's `creditOrder()` method.

**Impact:** Merchant wallets created via the microservice path are schema-invalid. Settlement reports querying by store return no data. Statistics calculations produce NaN.

**Fix:** Change line 161's `$setOnInsert` to use `store: new mongoose.Types.ObjectId(storeId)` (not `storeId: storeId`) and include all required statistics defaults: `held: 0, averageOrderValue: 0, totalRefunds: 0`.

---

### CS-C5 — Payment Coin Credit Is Permanently Lost on Wallet Service Downtime (Fire-and-Forget With No Retry) {#cs-c5}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**File:** `rez-payment-service/src/services/paymentService.ts`, lines 13–51 (`creditWalletAfterPayment`), line 361, line 548

**What is wrong:**

After a successful Razorpay capture, `creditWalletAfterPayment()` is called with `.catch(() => {})`. This is fire-and-forget with zero retry. If the wallet service is unavailable at the moment of payment capture (even a 30-second restart), the user's earned coins (1 coin per ₹1, up to 10,000 coins per transaction) are permanently lost. There is no `coinsCredited` flag stored in the `Payment` document to allow replay. The same fire-and-forget pattern exists at line 548 for the webhook capture path.

**Impact:** Any payment processed during a wallet service restart loses all associated coins. With no dedup key persisted, even a manual replay would double-credit users who did receive their coins.

**Fix:**
1. Store the idempotency key `pay-credit-${payment.paymentId}` in the `Payment` document with a boolean `coinsCredited` flag
2. After failure, enqueue a retry job to the `wallet-events` BullMQ queue (5 retry attempts, exponential backoff)
3. Add a scheduled reconciliation job that queries completed payments where `coinsCredited !== true` and retries the credit

---

## HIGH

### CS-H1 — Gamification `/achievements/:userId` Always Shows `total_coins: 0` Due to Wrong Balance Field {#cs-h1}
> **Status:** ✅ FIXED

**Severity:** HIGH
**File:** `rez-gamification-service/src/httpServer.ts`, line 311

**What is wrong:**
```typescript
const totalCoins: number =
  (walletDoc?.rezBalance as number) ?? (walletDoc?.balance as number) ?? 0;
```
Neither the wallet-service `Wallet` model nor the monolith `Wallet` model defines a `rezBalance` field. The actual balance is at `wallet.balance.available` (an object, not a number). The fallback `walletDoc?.balance` resolves to the balance subdocument object `{ total, available, pending, cashback }` — not a number — so `?? 0` always fires and `totalCoins` is always `0`.

**Impact:** Achievement progress display is broken for coin-based milestones (`coin_century`, `coin_thousand`). Users always see 0% progress regardless of actual balance.

**Fix:**
```typescript
const rezCoin = (walletDoc?.coins as any[])?.find((c: any) => c.type === 'rez');
const totalCoins: number = rezCoin?.amount ?? (walletDoc?.balance?.available as number) ?? 0;
```
This matches the pattern already used correctly in `achievementWorker.ts` line 131.

---

### CS-H2 — Credit Score Calls Two Non-Existent Endpoints on rez-payment-service and rez-merchant-service {#cs-h2}
> **Status:** ✅ FIXED (2026-04-13 — both missing endpoints implemented)

**Severity:** HIGH
**Files:**
- `rez-wallet-service/src/routes/creditScore.ts`, lines 108–148
- `rez-payment-service/src/routes/paymentRoutes.ts` — no `/internal/merchants/:id/payment-regularity` route
- `rez-merchant-service/src/routes/` — no `/internal/merchants/:id/order-stats` route

**What is wrong:**

`creditScore.ts` calls:
1. `GET ${REZ_PAYMENT_SERVICE_URL}/internal/merchants/${merchantId}/payment-regularity` — endpoint does NOT exist in `rez-payment-service`
2. `GET ${REZ_MERCHANT_SERVICE_URL}/internal/merchants/${merchantId}/order-stats` — endpoint does NOT exist in `rez-merchant-service`

Both calls return silent default values on 404: `onTimeRate: 0.5`, `ordersPerMonth: 0`. The credit score is always computed with half-fabricated data.

**Impact:** Merchant credit scores are unreliable. `paymentRegularity` always defaults to `0.5` (neutral), and order stats always default to `0`. Finance module decisions based on credit scores are made on fabricated inputs.

**Fix:** Either implement the missing endpoints in `rez-payment-service` and `rez-merchant-service`, or remove the external calls and compute these values directly from data available within `rez-wallet-service`.

---

### CS-H3 — `rez-order-service` GET Routes Are Completely Unauthenticated (BOLA Exposure) {#cs-h3}
> **Status:** ✅ FIXED

**Severity:** HIGH
**File:** `rez-order-service/src/httpServer.ts`, lines 168, 285–286

**What is wrong:**

The main `GET /orders` and `GET /orders/:id` routes are completely unprotected — no auth at all. The code comment at line 168 states: "Pure GET routes for order listing/viewing are intentionally left open". This means any internet-accessible client can enumerate all orders by merchantId or userId without authentication.

The internal `GET /internal/orders/summary/:userId` (lines 285–286) correctly uses `requireInternalToken`. But the public GET routes have no protection.

**Impact:** Full order history for any user or merchant is publicly readable if the order service port is externally routable. Classic BOLA (Broken Object Level Authorization) exposure.

**Fix:** Apply `requireOrderAuth` middleware to `GET /orders` and `GET /orders/:id`. The comment's intent (allow gateway-proxied access without internal tokens) can be achieved by using JWT verification rather than leaving the routes fully open.

---

### CS-H4 — `storevisits` Collection Schema Divergence Causes Visit-Based Achievements to Never Unlock {#cs-h4}
> **Status:** ✅ FIXED — achievementWorker.ts already casts userId to ObjectId before all three collection queries (userstreaks, wallets, storevisits). docker-compose.microservices.yml updated with rez-backend-worker service and all five cutover env vars (2026-04-14)

**Severity:** HIGH
**Files:**
- `rezbackend/rez-backend-master/src/models/StoreVisit.ts`, line 19 (`storeId: Types.ObjectId`, `userId: Types.ObjectId`)
- `rez-merchant-service/src/models/StoreVisit.ts`, line 7 (`storeId: Schema.Types.Mixed`)
- `rez-gamification-service/src/workers/achievementWorker.ts`, line 112 (queries `{ userId }` as raw string)

**What is wrong:**

The monolith writes `userId` as a Mongoose `ObjectId`. The gamification worker queries `StoreVisits.countDocuments({ userId })` where `userId` is a plain string from the event payload. MongoDB does not coerce ObjectId vs string in equality comparisons. The count always returns 0.

**Impact:** `visit_count` in `getUserStats` is always 0. All visit-count-based achievements (`first_checkin`, `fifth_checkin`, `tenth_checkin`) never unlock even after reaching the threshold. Streaks based on visit count are permanently broken.

**Fix:** Cast `userId` to ObjectId before the query:
```typescript
const userOid = new mongoose.Types.ObjectId(userId);
StoreVisits.countDocuments({ userId: userOid });
```

---

### CS-H5 — `wallet-events` `merchant-settlement` Jobs Only Invalidate Cache — Never Actually Credit Merchant Wallet {#cs-h5}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Files:**
- `rez-order-service/src/worker.ts`, lines 104–135
- `rez-wallet-service/src/worker.ts`, lines 130–139

**What is wrong:**

The order worker enqueues `wallet.merchant_settlement` events to `wallet-events` when an order is delivered. The wallet service worker processes these events but only does:
```typescript
if (event.eventType === 'wallet.merchant_settlement' && event.merchantId) {
  await bullmqRedis.del(`merchant:wallet:${event.merchantId}`);
  await bullmqRedis.del(`merchant:revenue:${event.merchantId}`);
}
```

**It only invalidates Redis cache keys. It does NOT call `/internal/merchant/credit` or increment `MerchantWallet.balance.available`.** The merchant wallet balance is never updated for orders processed through the microservice order flow.

**Impact:** Merchants processing orders through the microservice stack never receive settlement credits to their wallet. This is a direct financial loss — every order processed through the queue path results in ₹0 merchant credit.

**Fix:** In the wallet-service worker's `wallet.merchant_settlement` handler, call `merchantWalletService.creditMerchant()` using `payload.referenceId` (the `orderId`) as the idempotency key, then invalidate cache.

---

### CS-H6 — Admin User Suspend Does Not Invalidate `rez-merchant-service` Sessions for Merchant-Users {#cs-h6}
> **Status:** ✅ FIXED

**Severity:** HIGH
**File:** `rezbackend/rez-backend-master/src/routes/admin/users.ts`, lines 229–238

**What is wrong:**

When admin suspends a user (`POST /api/admin/users/:id/suspend`), the handler:
1. Sets `user.isActive = false`
2. Calls `redisService.del('auth:user:${id}')` — clears monolith auth cache
3. Sets `allLogout:${id}` in Redis — invalidates JWTs verified by the **monolith's** auth middleware only

`rez-merchant-service` uses its own JWT verification middleware and its own Redis connection. The `allLogout:${userId}` key written by the monolith is only checked by the monolith's middleware, not by `rez-merchant-service`'s middleware.

If the suspended user is also a merchant, their `rez-merchant-service` JWT remains valid until expiry.

**Impact:** Suspended users who are also merchants retain full merchant API access until JWT expiry. For fraud/abuse cases, this window can be hours to days.

**Fix:** After `redisService.set('allLogout:...')`, call `rez-merchant-service`'s internal session-invalidation endpoint, or write a `merchantAllLogout:${userId}` key that `rez-merchant-service` middleware checks. Alternatively, ensure both services share the same Redis instance and both middlewares check the same `allLogout:` key namespace.

---

### CS-H7 — `cashback` Queue Events Listener Monitors Non-Existent Queue Name (Sharded vs Unsharded Mismatch) {#cs-h7}
> **Status:** ✅ MISJUDGMENT — not a real bug

**Severity:** HIGH
**Files:**
- `rezbackend/rez-backend-master/src/config/bullmq-queues.ts`, lines 362–373 (`QueueEvents` on `'cashback'`)
- `rezbackend/rez-backend-master/src/services/QueueService.ts`, lines 131–177 (sharded `cashback-0`, `cashback-1`, etc.)

**What is wrong:**

`bullmq-queues.ts` registers a `QueueEvents` failure alerter on queue named `'cashback'`. `QueueService` creates sharded queues named `cashback-0`, `cashback-1`, etc. with their own workers. These are **different queue names** — the `QueueEvents('cashback')` listener monitors a queue that is never published to. In `workers/index.ts` (the critical worker startup path), there is no `cashbackWorker` started — only `QueueService` internal workers, which only run if `QueueService.initialize()` is called separately.

**Impact:** Cashback hold-to-credit jobs may queue indefinitely if QueueService is not initialized in the worker process. Failure monitoring on the `'cashback'` queue is completely ineffective — failures in the sharded queues are invisible.

**Fix:** Add an explicit health check that verifies cashback worker consumers are registered. Consolidate sharded and non-sharded cashback queue names.

---

### CS-H8 — No Admin Route to Update Merchant Business Data — Admin Panel Cannot Edit Merchant Profiles {#cs-h8}
> **Status:** ✅ FIXED

**Severity:** HIGH
**File:** `rezbackend/rez-backend-master/src/routes/admin/merchants.ts` (no PATCH/PUT update handler)

**What is wrong:**

The admin route file (1,190 lines) covers: list, stats, create, get-by-id, approve, reject, suspend, reactivate, live-status, and feature-flags. There is **no route for updating merchant business name, logo, address, or other profile data**. Admin updates to merchant data must go through `rez-merchant-service` directly, but the admin panel (`rezadmin`) communicates with the monolith (`rezbackend`). There is no proxy or forwarding from monolith admin routes to `rez-merchant-service` for profile updates.

**Impact:** Admin cannot update merchant business details through the admin panel. If `rezadmin` calls `rez-merchant-service` directly for updates, those updates bypass the monolith's audit logging and admin authentication checks.

**Fix:** Add `PATCH /api/admin/merchants/:id` to the monolith admin routes, which forwards the update to `rez-merchant-service` via its internal API, then updates the monolith's `merchants` collection for consistency.

---

## MEDIUM

### CS-M1 — Gamification `coin_earned` Notification EventId Uses `Date.now()` — Duplicate Notifications on Retry {#cs-m1}
> **Status:** ✅ FIXED — rez-gamification-service/src/worker.ts uses `job.id` (stable across retries) via `enqueueCoinEarnedNotification(event.userId, coins, event.type, job.id)` and the eventId is built as `coin-earned-${userId}-${source}-${jobId}` (no Date.now())

**Severity:** MEDIUM
**File:** `rez-gamification-service/src/worker.ts`, line 108

**What is wrong:**
```typescript
eventId: `coin-earned-${userId}-${source}-${Date.now()}`
```
`Date.now()` makes the eventId non-deterministic. On BullMQ job retry, a new `coin_earned` notification is enqueued with a different eventId. The notification service has no deduplication for notification events.

In contrast, `storeVisitStreakWorker.ts` line 56 correctly uses `coin-earned-${userId}-${source}` without `Date.now()`.

**Fix:** Use `coin-earned-${userId}-${source}-${job.id}` — BullMQ job ID is stable across retries.

---

### CS-M2 — `creditIntelligenceService` Has No Circuit Breaker on Inter-Service HTTP Calls {#cs-m2}
> **Status:** ✅ FIXED — `fetchWalletData` and `fetchOrderData` each have a 3-second axios timeout and are wrapped in try-catch; on any failure they log a warning and return safe defaults so the credit score calculation continues without cascading the error

**Severity:** MEDIUM
**File:** `rez-finance-service/src/services/creditIntelligenceService.ts`, lines 159–171

**What is wrong:** `fetchWalletData` uses `axios.get(...)` with a 5-second timeout but does not handle non-2xx responses that axios treats as resolved. Under slow (not down) wallet service, TCP connect succeeds but response is delayed beyond the declared timeout in some Node.js scenarios. Also no retry or circuit breaker.

**Fix:** Use `axios.get({ timeout: 5000, validateStatus: (s) => s < 500 })` and handle non-200 responses explicitly.

---

### CS-M3 — `store-visit-events` Worker Creates New BullMQ Queue Connection on Every Job {#cs-m3}
> **Status:** ✅ FIXED — rez-gamification-service/src/worker.ts uses `getAchievementQueue()` singleton (module-level `_achievementQueue` variable, initialized once). Comment reads "CS-M3 fix: singleton so we don't create+destroy a Queue connection per job"

**Severity:** MEDIUM
**File:** `rez-gamification-service/src/worker.ts`, lines 290–295

**What is wrong:**
```typescript
const achievementQueue = new Queue('achievement-events', { connection: bullmqRedis });
await achievementQueue.add('visit_checked_in', event, {...});
await achievementQueue.close();
```
A new `Queue` instance is created and immediately closed **inside the BullMQ worker callback** — this is called for every `visit_checked_in` event. Creating and destroying queue connections per job exhausts the Redis connection pool under high load.

**Fix:** Create the `achievementQueue` instance once at module level as a singleton (same pattern as `_notifQueue` used elsewhere in the file).

---

### CS-M4 — `rez-order-service` SSE Change Stream Endpoint Has No Authentication {#cs-m4}
> **Status:** ✅ FIXED — rez-order-service/src/httpServer.ts line 453: `app.get('/orders/stream', requireOrderAuth, ...)` — `requireOrderAuth` middleware is applied before the SSE handler

**Severity:** MEDIUM
**File:** `rez-order-service/src/httpServer.ts`, line 453

**What is wrong:** `GET /orders/stream?merchantId=<id>` opens a Server-Sent Events connection that streams all real-time order status changes for a given merchant. This endpoint has **no authentication check** — any client knowing a merchantId (a publicly visible ObjectId) can subscribe to real-time order updates for any merchant.

**Impact:** Competitor or malicious actor can monitor any merchant's order volume and timing in real-time.

**Fix:** Apply `requireOrderAuth` middleware to the SSE route.

---

### CS-M5 — Two Separate Credit Scoring Implementations in rez-finance-service and rez-wallet-service {#cs-m5}
> **Status:** ⏳ PHASE 2 — NOT a runtime bug. Two services score fundamentally different entities: `rez-finance-service` scores consumers (300-850 CIBIL-like range, 8 inputs); `rez-wallet-service` scores merchants (0-100 + tier, 5 inputs). Both are internally consistent. Canonical proxy endpoint (`GET /internal/credit-score/:merchantId`) requires `rez-finance-service` to gain merchant data access first.

**Severity:** MEDIUM
**Files:**
- `rez-finance-service/src/services/creditIntelligenceService.ts`
- `rez-wallet-service/src/routes/creditScore.ts`

**What is wrong:** Both services implement merchant credit scoring with different data sources and different computation logic. They can return different scores for the same merchant depending on which endpoint is called. No canonical source of truth for credit scores exists.

**Fix:** Designate one service as authoritative for credit scores. Have the other proxy to it via `GET /internal/credit-score/:merchantId`.

---

### CS-M6 — `/leaderboard/me` Runs Full Collection Aggregation (Up to 1000 Docs) on Every Request {#cs-m6}
> **Status:** ✅ FIXED — `/leaderboard/me` now caches the full aggregation result in Redis under key `leaderboard:me:full` with a 60-second TTL using the existing `bullmqRedis` IORedis client; Redis errors fall back gracefully to a fresh DB aggregation

**Severity:** MEDIUM
**File:** `rez-gamification-service/src/httpServer.ts`, lines 442–453

**What is wrong:**
```typescript
const allAggregated = await CoinTransactions.aggregate([
  { $match: { type: 'earned' } },
  { $group: { _id: '$user', lifetimeCoins: { $sum: '$amount' } } },
  { $sort: { lifetimeCoins: -1 } },
  { $limit: 1000 },
]).toArray();
```
This aggregation runs on every `/leaderboard/me` request with no caching. With a growing `cointransactions` collection this becomes increasingly slow.

**Fix:** Cache the full leaderboard result (same `leaderboardCache` mechanism used by `/leaderboard`) and use it for the `findIndex` lookup rather than re-running the aggregation each time.

---

## LOW

### CS-L1 — `rez-order-service` Order Model Registered as `OrderService_Order` (Unnecessary Cargo-Cult Naming) {#cs-l1}
> **Status:** ✅ FIXED — rez-order-service/src/models/Order.ts now registers as `'Order'` and checks `mongoose.models['Order']`. The `OrderService_Order` guard is removed (2026-04-14)

**Severity:** LOW
**File:** `rez-order-service/src/models/Order.ts`, lines 58–60

**What is wrong:** The model is registered under `OrderService_Order` to avoid conflicting with the monolith's `Order` model. In the microservice setup the order service has its own Mongoose instance — no conflict is possible. The `OrderService_Order` naming is cargo-cult code from when services shared a process. It creates confusingly named models in any introspection or debugging context.

**Fix:** Use `Order` as the model name. Remove the `OrderService_Order` guard.

---

### CS-L2 — `MerchantWallet` Schema Has `transactions` Array in Monolith But Removed in rez-wallet-service {#cs-l2}
> **Status:** ⏳ DEFERRED — the Mongoose schema field is commented out (`// transactions: [MerchantWalletTransactionSchema], -- REMOVED`) but `creditOrder()` and `requestWithdrawal()` instance methods still use `$push: { transactions: ... }` and `this.transactions` for the idempotency check and `getTransactionHistory()`. Full removal requires migrating those methods to use the `MerchantWalletTransaction` collection, which is a larger refactor tracked for schema sync sprint

**Severity:** LOW
**Files:**
- `rezbackend/rez-backend-master/src/models/MerchantWallet.ts`, line 63 (`transactions: IMerchantWalletTransaction[]`)
- `rez-wallet-service/src/models/MerchantWallet.ts`, line 36 (comment: "MW-FIX-001: transactions array removed")

**What is wrong:** The monolith's `MerchantWallet` schema still has a `transactions` embedded array with its own subdocument schema (lines 83–132). The wallet service correctly removed it in favor of a separate `MerchantWalletTransaction` collection. Any monolith code that calls `wallet.transactions.push()` or reads `wallet.transactions` is operating on data invisible to the wallet service's reads.

**Fix:** Remove the `transactions` embedded array from the monolith's `MerchantWallet` schema. Migrate any monolith code that appends to `wallet.transactions` to insert into the `MerchantWalletTransaction` collection.

---

### CS-L3 — `rez-wallet-service` Credit Score Module Logs `console.error` at Module Load Time {#cs-l3}
> **Status:** ✅ FIXED (2026-04-13 — console.error at module load removed; per-fetcher logger.warn calls remain)

**Severity:** LOW
**File:** `rez-wallet-service/src/routes/creditScore.ts`, lines 33–39

**What is wrong:** Missing service URL check uses `console.error` at module load time (not in a request handler), bypassing the structured logger. Fires on every startup in development, making developers think the service is broken.

**Fix:** Move the check to the first actual request handler invocation and use `logger.warn`.

---

### CS-L4 — adBazaar Broadcast Call to rez-marketing-service Uses Wrong Endpoint Path {#cs-l4}
> **Status:** ✅ FIXED — rez-marketing-service/src/routes/adbazaar.ts implements `POST /adbazaar/broadcast` and `GET /adbazaar/status/:broadcastId`. The route is registered in index.ts as `app.use('/adbazaar', adBazaarRoutes)`. Full broadcast pipeline: rate-limit check, MarketingCampaign creation, segment resolution, per-user notification-events jobs, broadcastlogs record

**Severity:** LOW
**Files:**
- `rez-marketing-service/src/routes/` — no `/adbazaar/broadcast` route registered

**What is wrong:** The adBazaar integration attempt to call `POST /adbazaar/broadcast` on `rez-marketing-service` hits a 404. The handler logs a warning and silently drops the broadcast. AdBazaar-sourced campaign notifications are never delivered.

**Fix:** Implement the `/adbazaar/broadcast` route in `rez-marketing-service`, or update the adBazaar caller to use the correct existing endpoint.

---

## Inter-Service HTTP Call Inventory

| Caller | Target | Endpoint | Failure Behavior |
|--------|--------|----------|-----------------|
| `rez-gamification-service` | `rez-wallet-service` | `POST /internal/credit` | ✅ FIXED — wallet-first ordering in all workers (achievement, streak, visit milestone); throw on failure enables BullMQ retry safely |
| `rez-payment-service` | `rez-wallet-service` | `POST /internal/credit` | ✅ FIXED — BullMQ wallet-credit queue with idempotency key + 5 retries + exponential backoff; reconciliation cron catches any missed credits |
| `rez-finance-service` | `rez-wallet-service` | `GET /internal/balance/:userId` | Returns defaults `{ balance: 0, coins: 0 }` |
| `rez-finance-service` | `rez-order-service` | `GET /internal/orders/summary/:userId` | Returns defaults `{ totalSpend: 0, orderCount: 0 }` |
| `rez-wallet-service` | `rez-payment-service` | `GET /internal/merchants/:id/payment-regularity` | ✅ Endpoint implemented (CS-H2 fix) — returns real on-time rate |
| `rez-wallet-service` | `rez-merchant-service` | `GET /internal/merchants/:id/order-stats` | ✅ Endpoint implemented (CS-H2 fix) — returns real order stats |
| `rez-wallet-service` | `analytics-events` | `GET /merchants/:id/revenue/monthly` | Returns empty array, score uses zero revenue history |
| `adBazaar` | `rez-marketing-service` | `POST /adbazaar/broadcast` | **ENDPOINT DOES NOT EXIST** — logs warning, broadcast dropped (CS-L4) |

**No circular HTTP call chains found.** Payment-service → wallet-service (one direction). Gamification-service → wallet-service (one direction). Wallet-service → payment-service and merchant-service (for credit scoring only — neither calls back).

## BullMQ Queue Publisher/Consumer Inventory

| Queue | Publishers | Consumers | Status |
|-------|-----------|-----------|--------|
| `gamification-events` | monolith | monolith worker OR `rez-gamification-service` | **DOUBLE-CONSUME RISK** unless `GAMIFICATION_WORKER_EXTERNAL=true` |
| `order-events` | monolith | monolith worker OR `rez-order-service` | **DOUBLE-CONSUME RISK** unless `ORDER_WORKER_EXTERNAL=true` |
| `wallet-events` | monolith, `rez-order-service` | monolith worker OR `rez-wallet-service` | **DOUBLE-CONSUME RISK** unless `WALLET_WORKER_EXTERNAL=true` |
| `notification-events` | monolith, gamification, order, wallet | monolith worker OR `rez-notification-events` | **DOUBLE-CONSUME RISK** unless `NOTIFICATION_WORKER_EXTERNAL=true` |
| `achievement-events` | `rez-gamification-service/worker.ts` | `achievementWorker.ts` | Correct: single consumer |
| `store-visit-events` | `qrCheckinRoutes.ts` | `storeVisitStreakWorker.ts` | Correct: single consumer |
| `rewards` | monolith asyncOffloadHelper | monolith `rewardWorker` | Monolith-only, no microservice overlap |
| `cashback-N` (sharded) | monolith `QueueService` | monolith `QueueService` workers | Only active if `QueueService.initialize()` called (CS-H7) |
| `payment-events` | monolith | monolith OR `rez-payment-service` | **DOUBLE-CONSUME RISK** unless `PAYMENT_EVENTS_WORKER_EXTERNAL=true` |
