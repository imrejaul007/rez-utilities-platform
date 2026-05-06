# Gen 14 — MEDIUM Severity Issues (30 issues)

**Generated:** 2026-04-16 | **Status:** All OPEN

---

## API Contract Issues

### RP-M01: pointsApi.getBalance() Has No Real /points Endpoint
**File:** `rez-app-consumer/services/pointsApi.ts`
**Issue:** `getBalance()` calls `walletApi.getBalance()` and maps the response — there is no dedicated `/points` endpoint. It's a leaky proxy over wallet API.
**Est. Fix:** 0.5h — Either implement a real `/points` endpoint or document that it's just a wallet proxy.

### RP-M02: Merchant Order Sort `priority` Field — Unclear Semantics
**File:** `rezbackend/src/routes/merchant/orders.ts:49`
**Issue:** KDS advertises `sortBy='priority'` but no schema definition of what `priority` means.
**Est. Fix:** 1h — Define priority computation and document it.

### RP-M03: Local Status Transition Maps Must Stay Synced with Backend FSM
**File:** `rez-app-marchant/services/api/orders.ts`
**Issue:** Merchant app maintains `VALID_STATUS_TRANSITIONS` map locally, mirroring the backend FSM. No shared enum or import. If backend FSM changes, the local map becomes stale.
**Est. Fix:** 1h — Import FSM from shared package or remove local FSM.

### RP-M04: Local Enums Not Imported from shared-types
**File:** `rez-app-consumer/services/ordersApi.ts` + `rez-app-marchant/services/api/orders.ts`
**Issue:** Consumer and merchant apps define their own local `OrderStatus` and `CoinType` enums rather than importing from `packages/shared-types`.
**Est. Fix:** 1h — Import from shared-types. Enforce via ESLint.

### RP-M05: POS Bill Status Uses `paid` Instead of `completed`
**File:** `rez-app-marchant/services/api/pos.ts`
**Issue:** POS uses `'paid'` but canonical schema uses `'completed'`. Inconsistent with payment flow.
**Est. Fix:** 0.5h — Align with canonical schema.

### RP-M06: breakdown.cashback vs breakdown.cashbackBalance Dual Field
**File:** `rez-app-consumer/services/walletApi.ts`
**Issue:** Transaction breakdown has both `cashback` and `cashbackBalance` fields. Unclear which is authoritative.
**Est. Fix:** 0.5h — Pick one authoritative field name. Remove the duplicate.

### RP-M07: Consumer App Payment Fallback Exposes Test Stripe Keys
**File:** `rez-app-consumer/services/paymentService.ts:93-107`
**Issue:** `__DEV__` fallback returns hardcoded payment method stubs (razorpay_upi, razorpay_wallet, razorpay_netbanking) when backend is unavailable. Developers might confuse dev fallback with real production methods.
**Est. Fix:** 0.5h — Add `STRIPE_ENABLED` and `RAZORPAY_ENABLED` feature flags rather than relying solely on `__DEV__`.

### RP-M08: Razorpay Signature Verification Entirely Backend-Dependent
**File:** `rez-app-consumer/services/razorpayService.ts:316` + `razorpayApi.ts:138`
**Issue:** Frontend sends `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` to backend. Frontend does NOT independently verify. Defense-in-depth is missing.
**Est. Fix:** 1h — Add client-side HMAC verification using razorpay key_id (public).

### RP-M09: Product Creation Response Schema Unverified
**File:** `rez-app-marchant/services/api/products.ts:32-65` vs `productController.ts`
**Issue:** Merchant app sends `CreateProductRequest` with 15+ fields. Backend controller response schema has not been verified to include all these fields.
**Est. Fix:** 1h — Verify backend response includes all fields. Document the contract.

---

## Architecture Issues

### RP-M10: Path-Based Routing Ambiguity in Merchant Client
**File:** `rez-app-marchant/services/api/client.ts`
**Issue:** Merchant client routes `merchant/*` paths to `rez-merchant-service` while everything else goes to the monolith. No clear documentation of which path hits which service.
**Est. Fix:** 1h — Document the routing rules. Add runtime warnings for misconfiguration.

### RP-M11: EventBooking Uses strict: false Mongoose Schema
**File:** `rez-karma-service/src/engines/verificationEngine.ts`
**Issue:** EventBooking model uses `strict: false` to share schema across services. Typos in field names are silently ignored.
**Est. Fix:** 1h — Enable `strict: true` and create a shared schema package.

### RP-M12: Local Enums Not from shared-types
**File:** Individual apps
**Issue:** Each app defines `OrderStatus` and `CoinType` locally rather than importing from `packages/shared-types`.
**Est. Fix:** 1h — Same as RP-M04, consolidate here.

### RP-M13: Duplicate TransactionMetadata Interface in Same File
**File:** `rez-app-consumer/services/walletApi.ts:145 and 303`
**Issue:** `TransactionMetadata` interface defined twice in the same file with the same name.
**Est. Fix:** 0.25h — Remove duplicate. Keep one definition.

### RP-M14: Merchant Loyalty Config Schema Duplicated Byte-for-Byte
**File:** `rezbackend/src/models/MerchantLoyaltyConfig.ts` + `rez-merchant-service/src/models/MerchantLoyaltyConfig.ts`
**Issue:** Both files are byte-for-byte identical. Any schema migration must be applied in both places manually.
**Est. Fix:** 1h — Move to shared package. Enforce via fitness test.

### RP-M15: LoyaltyReward Uses customerPhone + storeSlug Instead of ObjectIds
**File:** `rezbackend/src/models/LoyaltyReward.ts:7-10`
**Issue:** All other models use `Types.ObjectId` for user and store references. `storeSlug` is a mutable string — a store rebrand orphans all `LoyaltyReward` records.
**Est. Fix:** 2h — Replace phone/slug with ObjectId references. Add migration.

### RP-M16: Batch Stats Uses Raw MongoDB Aggregation in Route Handler
**File:** `rez-karma-service/src/routes/batchRoutes.ts`
**Issue:** Batch stats endpoint uses raw MongoDB aggregation pipeline instead of using the `Batch` model or a service layer. Business logic in route layer.
**Est. Fix:** 1h — Move aggregation to service layer.

### RP-M17: Analytics Uses Math.random() for Internal Session IDs
**File:** `AnalyticsService.ts`, `CustomProvider.ts`, `searchAnalyticsService.ts`
**Issue:** Analytics files use `Math.random()` for generating internal analytics session IDs. Not security-critical but inconsistent with platform standards.
**Est. Fix:** 0.25h — Replace with `crypto.randomUUID()`.

---

## Data Sync Issues

### RP-M18: getLastSyncDate() Reads In-Memory Array — Full Re-Sync After Restart
**File:** `Rendez/rendez-backend/src/merchantservices/SyncService.ts:167-170`
**Issue:** `syncHistory` is an in-memory array. `getLastSyncDate()` reads from it, not from MongoDB. After restart, `lastSyncDate` is always null.
**Est. Fix:** 0.5h — Read from `SyncHistoryModel` collection instead of in-memory array.

### RP-M19: /api/sync/statistics Leaks Global Stats to Any Authenticated Merchant
**File:** `Rendez/rendez-backend/src/merchantroutes/sync.ts:188-204`
**Issue:** `GET /sync/statistics` returns global aggregate data for all merchants. Every other route in the file scopes results to the authenticated merchant.
**Est. Fix:** 0.5h — Add `merchantId` filter to aggregate statistics query.

### RP-M20: Wallet Prive Coins Reclassified as Rez in Ledger
**File:** `walletService.ts` (backend)
**Issue:** Prive coin transactions get reclassified as `rez` in the ledger. Ledger does not track `prive` coin type.
**Est. Fix:** 1h — Add `prive` to LedgerEntry.coinType enum.

---

## Security Issues

### RP-M21: Auth Service 503 Fails Open for Non-Admin Routes
**File:** `rez-karma-service/src/middleware/auth.ts:57`
**Issue:** When auth service is unreachable, `requireAuth` returns HTTP 503. While this is less severe for non-admin routes, it can cause denial-of-service on karma operations.
**Est. Fix:** 1h — Add circuit breaker. Consider fail-closed for critical routes.

### RP-M22: Merchant Socket No Room Ownership Validation
**File:** `rez-app-marchant/services/api/socket.ts:121, 172-228`
**Issue:** Socket `join-merchant-dashboard(merchantId)` — no server-side validation that the authenticated merchant is the owner.
**Est. Fix:** 1h — See RP-H20 (same issue, also HIGH severity).

---

## Real-Time Issues

### RP-M23: Consumer App Socket.IO Has No Reconnect Limit
**File:** `rez-app-consumer/services/realTimeService.ts:587-606`
**Issue:** Consumer app socket has no `reconnectionAttempts` cap. If the backend is permanently down, the client attempts reconnection indefinitely. The merchant app has `reconnectionAttempts: 5` — consumer app does not.
**Est. Fix:** 0.5h — Add `reconnectionAttempts: 10` cap. Show persistent "Connection Lost" banner instead of looping.

### RP-M24: Socket.IO Reconnect Loop — No Circuit Breaker
**File:** `rez-app-consumer/services/realTimeService.ts`
**Issue:** After `connect_error`, `reconnect_attempt`, `reconnect` events are handled with `devLog` but no circuit breaker. Persistent backend outage causes continuous reconnect attempts.
**Est. Fix:** 0.5h — Same as RP-M23.

---

## Edge Case Issues

### RP-M25: Wallet Redemption Min 50 Coins Not Shown to User
**File:** `rez-app-consumer/services/walletApi.ts`
**Issue:** Backend enforces `amount >= 50` minimum but the client has no validation before sending. User gets a server error they weren't warned about.
**Est. Fix:** 0.5h — Add client-side validation: `if (amount < 50) return { success: false, error: 'Minimum redemption is 50 coins' }`.

### RP-M26: Bill Verification Accepts Amount Below 50
**File:** `rez-app-consumer/services/billVerificationService.ts:545-549`
**Issue:** `if (!data.amount || data.amount < 50)` — minimum bill amount is 50, but `PaymentValidator.validateAmount()` sets minimum of 1. User could upload a Rs. 30 bill, get it verified (if OCR reads it as >50), earn karma on it, then discover it was below the minimum.
**Est. Fix:** 0.5h — Add `>= 50` check before OCR submission, not after.

### RP-M27: Math.random() in Bill Upload Queue Service Jitter
**File:** `rez-app-consumer/services/billUploadQueueService.ts:724`
**Issue:** `const jitter = delay * 0.2 * (Math.random() - 0.5)` — uses `Math.random()` for retry jitter. Not security-critical but non-uniform.
**Est. Fix:** 0.25h — Use `crypto.getRandomValues()` for jitter, or note that this is acceptable for non-security jitter.

---

## UX/Performance Issues

### RP-M28: Cart Optimistic Update Without Rollback
**Issue:** Cart dispatches `ADD_ITEM` to state before API confirmation. If both the API and the offline queue fail (e.g., storage quota), the UI shows items that will never reach the backend. No reconciliation mechanism.
**Est. Fix:** 2h — Add rollback on failed sync. Show user feedback when sync fails.

### RP-M29: Offline Queue Silently Discards After MAX_RETRIES
**Issue:** Offline queue silently swallows errors after `MAX_RETRIES`. User loses data without knowing.
**Est. Fix:** 1h — Show persistent error banner when offline queue fails. Persist failed items for manual retry.

### RP-M30: POS Expiry Reconciliation Missing
**Issue:** POS bills have an expiry mechanism but no reconciliation process to handle expired bills that were partially processed.
**Est. Fix:** 2h — Add a reconciliation worker that checks for expired bills with inconsistent state.
