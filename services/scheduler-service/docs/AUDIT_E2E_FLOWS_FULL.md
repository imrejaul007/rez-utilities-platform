# End-to-End Flow Audit Report

**Date:** 2026-04-10
**Scope:** Cross-application E2E flow audit — Consumer App, Merchant App, Admin App, Backend Monolith, and Microservices
**Auditor:** Code Quality Analyzer

---

## Executive Summary

Nine critical end-to-end flows were traced across all REZ applications. Of these:

- **3 flows are functionally complete** (OTP Auth, Admin Merchant Management, Hotel/OTA Booking)
- **3 flows are partially working with significant gaps** (Order Placement, Payment/Webhook, Search)
- **3 flows have critical broken links** (Merchant Onboarding, Coin/Wallet, Analytics)

The most severe issue is the **Razorpay `payment.captured` webhook not triggering merchant notification or coin credit**, meaning a paid order leaves the merchant unnotified and the consumer uncredited. The second most critical is the **analytics batch endpoint silently discarding all events** — the backend logs receipt but does not persist to any store.

---

## Flow Status Matrix

| Flow | Status | Broken At | Severity |
|------|--------|-----------|----------|
| 1. Consumer OTP Auth | Complete | No critical breaks | Low |
| 2. Merchant Onboarding | Partial | No admin notification after registration; merchant service mismatch | High |
| 3. Order Placement | Partial | Merchant notification is best-effort only; order worker in "shadow/dual mode" | Medium |
| 4. Payment Flow | Broken | `payment.captured` webhook does not trigger merchant notification or coin credit | Critical |
| 5. Coin/Wallet Operations | Partial | Wallet microservice is separate; monolith's coin expiry job runs but wallet service calls are not wired to it | Medium |
| 6. Admin Merchant Management | Partial | Token/Redis cache not explicitly purged on suspension (relies on 60s cache TTL) | Medium |
| 7. Analytics Flow | Broken | Batch endpoint receives events but does not persist them (logs only) | Critical |
| 8. Search Flow | Partial | Consumer calls monolith search; search microservice is separate and not consistently used | Medium |
| 9. Hotel/OTA Booking | Complete (with env risk) | Missing env var `REZ_OTA_WEBHOOK_SECRET` would break coin credit silently | High |

---

## Detailed Flow Analysis

---

### Flow 1: Consumer OTP Auth

**Status: COMPLETE**

**Trace:**

1. Consumer app screen triggers `authApi.sendOtp()` in `/rezapp/nuqta-master/services/authApi.ts:235`
2. Calls `POST /user/auth/send-otp` on the monolith
3. Route: `/rezbackend/rez-backend-master/src/routes/authRoutes.ts` — applies `otpPerIpLimiter` then `otpLimiter` then `validate(authSchemas.sendOTP)` then `sendOTP` controller
4. Controller: `authController.ts:sendOTP` — normalizes phone, creates user if new, stores OTP hash in Redis, sends SMS via `SMSService`
5. Consumer submits OTP: `authApi.verifyOtp()` calls `POST /user/auth/verify-otp`
6. Controller: `authController.ts:verifyOTP` — looks up user, checks Redis for pending signup, validates OTP, generates `accessToken` + `refreshToken` via centralized helpers, sets httpOnly cookies, returns tokens
7. Consumer stores tokens; subsequent calls attach `Authorization: Bearer <token>` header

**Issues Found:**

- Minor: PIN auth (`/verify-pin`) generates tokens correctly but calls `generateToken` and `generateRefreshToken` inline rather than through the centralized service layer — duplicates logic already in `tokenHelper.ts`. Risk of divergence if token config changes.
- The `has-pin` endpoint enforces a constant-time guard against timing-based enumeration, which is correct.

---

### Flow 2: Merchant Onboarding

**Status: PARTIAL — Missing admin notification after registration**

**Trace:**

1. Merchant app calls `authService.register()` in `/rezmerchant/rez-merchant-master/services/api/auth.ts:73` — `POST merchant/auth/register`
2. Backend: `/rezbackend/rez-backend-master/src/merchantroutes/auth.ts:303` — validates schema, checks for duplicate email, hashes password, creates `Merchant` document with `verificationStatus: 'pending'`, sends verification email, auto-creates a store for the merchant, returns JWT
3. Admin sees merchant via `GET /api/admin/merchants` filtered by `status=pending`

**Issues Found:**

**BREAK 1 — No admin notification fired on merchant registration.** The `/merchant/auth/register` handler sends a verification email to the merchant but does **not** publish any event or notification to alert admins that a new merchant is pending review. Admins must proactively poll the pending list. There is no push notification, email, or socket event to the admin on new merchant sign-up.

**BREAK 2 — Merchant service routing mismatch.** The merchant app client (`/rezmerchant/rez-merchant-master/services/api/client.ts:18`) has logic to route certain `merchant/` paths to `rez-merchant-service` (port 3007 in dev) via `EXPO_PUBLIC_MERCHANT_SERVICE_URL`. However, the standalone `rez-merchant-service` at `/rez-merchant-service/src/` has its own router definitions that may not be fully in sync with what the monolith exposes at `/api/merchant/*`. In production, no nginx reverse proxy config was found to enforce the path split. The routing decision is made client-side in the app, creating a consistency risk between what the app sends and what service receives it.

**BREAK 3 — Merchant app auth flow is email+password.** The consumer app uses phone/OTP. The merchant app uses email+password (`LoginRequest` in `auth.ts`). There is no OTP fallback or MFA for merchant login, creating an asymmetry.

---

### Flow 3: Order Placement (Critical Path)

**Status: PARTIAL — Merchant notification is best-effort; BullMQ order worker in shadow mode**

**Trace:**

1. Consumer adds to cart → calls `POST /api/orders` with cart items, payment method
2. Route: `orderRoutes.ts` — idempotency middleware → validation → `createOrder` controller (`orderCreateController.ts`)
3. Controller validates stock, deducts coins if used, creates Order document in a MongoDB session transaction, clears cart
4. Post-response async: publishes `order.placed` event to BullMQ via `publishOrderEvent()` (`orderQueue.ts:91`)
5. Fires `merchantNotificationService.notifyNewOrder()` — creates in-app notification, sends push/SMS for high-priority
6. Emits socket events: `orderSocketService.emitMerchantNewOrder()`, `emitToMerchant('new_order')`, `emitToMerchant('order-event')` — three socket emissions for backward compatibility
7. Fires `pushNotificationService.sendPushToUser()` for consumer confirmation push

**Issues Found:**

**BREAK 1 — BullMQ order worker is in shadow/dual mode.** The `orderQueue.ts` worker comment explicitly states: *"Phase A — shadow/dual mode: Controllers continue to do direct DB writes + existing notification calls. This queue runs in parallel."* The worker processes events for analytics, cache invalidation, and merchant dashboard updates — but the primary notification path is still the inline direct call in the controller. If the worker is disabled (`DISABLE_ORDER_WORKER=true`) or fails, analytics and cache are silently lost but primary notifications still work.

**BREAK 2 — Merchant notification on payment capture webhook is missing.** The Razorpay `payment.captured` webhook handler (`razorpayController.ts`) updates order payment status atomically but does **not** trigger any merchant notification, push notification, or `publishOrderEvent`. A merchant using Razorpay online payment will have their order marked paid but receive no additional notification at the payment stage. The merchant notification that fires is only at `createOrder` time (COD-equivalent moment), not when payment is confirmed.

**BREAK 3 — P1-9 BullMQ retry for failed merchant notifications exists** but the fallback job type is not verified to have a registered BullMQ consumer. If all three notification channels fail (SMS, socket, in-app), a BullMQ retry job is enqueued but only if there is a registered worker listening for that queue.

---

### Flow 4: Payment Flow

**Status: BROKEN — Webhook does not credit coins; no merchant notification post-payment**

**Trace:**

1. Consumer calls `POST /api/razorpay/create-order` — controller fetches DB order, derives amount server-side (correct), creates Razorpay order
2. Consumer pays via Razorpay SDK → Razorpay fires `POST /api/razorpay/webhook`
3. Webhook route: raw body captured for HMAC verification (`req.rawBody`), `validateWebhookPayload`, `rateLimitWebhooks`, `handleRazorpayWebhook`
4. `payment.captured` handler: verifies HMAC, finds order via `paymentGateway.gatewayOrderId` or `payment.transactionId`, atomically updates `payment.status = 'paid'` with `$ne` guard, pushes timeline entry
5. End

**Issues Found:**

**BREAK 1 — No coin credit on payment.captured.** The webhook handler for `payment.captured` updates the order status to paid but does **not** call `walletService.credit()`, `awardCoins()`, or `publishOrderEvent('order.payment_confirmed')`. Coins that should be earned on a completed purchase are never credited via the Razorpay webhook path. The `verifyRazorpayPayment` endpoint (front-end verification path) also does not credit coins. Coins are only awarded if the `createOrder` flow uses them as payment (deduction), not as a reward for paying.

**BREAK 2 — No merchant notification on payment.captured.** Neither the webhook handler nor the `verifyRazorpayPayment` endpoint calls `merchantNotificationService` after confirming payment. A merchant who receives a Razorpay-paid order has no server-side push notification that payment was confirmed.

**BREAK 3 — No `publishOrderEvent('order.payment_confirmed')` after webhook.** The BullMQ order queue defines `order.payment_confirmed` as a valid event type but the Razorpay webhook does not publish it. Analytics, cache invalidation, and merchant CRM snapshot are therefore not updated when Razorpay confirms payment.

**BREAK 4 — `payment.failed` handler uses `.save()` but `payment.captured` uses `findOneAndUpdate`.** Inconsistency: the `payment.failed` branch calls `order.save()` (instance method on a non-lean document) while `payment.captured` uses `findOneAndUpdate` (atomic). The `.save()` path in `payment.failed` is correct (the document was found without `.lean()`), but the inconsistency introduces future maintenance risk.

---

### Flow 5: Coin/Wallet Operations

**Status: PARTIAL — Monolith wallet service is functional; standalone wallet microservice is isolated**

**Trace (earning path):**

1. Coins are awarded via `walletService.credit()` in the monolith — creates `CoinTransaction`, atomically increments `Wallet` balance via `$inc`, writes `LedgerEntry`, publishes `walletQueue` event
2. Consumer reads balance via `GET /api/wallet/balance` → `walletController.ts` → `walletService`
3. Consumer sees balance in `walletApi.ts` response

**Coin Expiry:**

- `ScheduledJobService.ts` registers an `expire-coins` cron job importing `triggerManualCoinExpiry` from `jobs/expireCoins`
- `cronJobs.ts` registers `scheduleCoinExpiry` daily at 1 AM and branded coin expiry at 2 AM
- Both are registered — coin expiry is wired and running

**Issues Found:**

**BREAK 1 — Standalone `rez-wallet-service` is isolated.** The wallet microservice at `/rez-wallet-service/` has its own routes (`walletRoutes`, `merchantWalletRoutes`, `internalRoutes`, `payoutRoutes`, `creditScoreRoutes`) and connects to its own MongoDB instance. The consumer app and monolith both call `walletService` in the monolith — they do **not** call the standalone service. The standalone service is effectively running in parallel but disconnected from the main coin-earning flows. There is no clear event bridge from monolith coin events to the standalone wallet service.

**BREAK 2 — No coin credit after Razorpay payment** (see Flow 4, BREAK 1). This is the most common earn trigger for consumers and it is missing.

**BREAK 3 — Cashback claim flow.** The `cashbackService.ts` exists in the monolith but the consumer app calls `/api/cashback/*`. Whether this routes to the monolith or to a microservice depends on API gateway configuration. No gateway configuration was found that would re-route cashback to a dedicated service, so it lands on the monolith — which is correct but unverified in staging.

---

### Flow 6: Admin Merchant Management

**Status: PARTIAL — Approval/suspension work, but Redis cache creates a 60-second enforcement gap**

**Trace (approval):**

1. Admin app calls `POST /api/admin/merchants/:id/approve` (requires `requireSeniorAdmin`)
2. Handler: sets `verificationStatus = 'verified'`, `isActive = true`, saves, writes audit log, emits `merchant_approved` socket event globally via `getIO().emit()` — broadcasts to all connected clients
3. Merchant app middleware (`merchantauth.ts`) checks `isActive` on every request — both from Redis cache (60s TTL) and from DB on cache miss

**Trace (suspension):**

1. Admin calls `POST /api/admin/merchants/:id/suspend`
2. Handler: sets `isActive = false`, deactivates all products via `Product.updateMany`, invalidates store caches via `CacheInvalidator.invalidateStore()`, emits `merchant_suspended` socket event to `merchant:<id>` room, publishes suspension notification via `publishNotificationEvent`, cancels all pending orders via `cancelOrderCore`
3. Merchant auth middleware will block on next request — either immediately if cache entry is updated, or within 60 seconds when cache TTL expires

**Issues Found:**

**BREAK 1 — 60-second enforcement window on suspension.** When a merchant is suspended, the Redis auth cache key (`merchant:auth:<merchantId>`) is **not explicitly deleted**. The suspension sets `isActive = false` in MongoDB, but the middleware serves the cached auth result (which has `isActive: true`) for up to 60 more seconds. A suspended merchant can continue making API calls for up to one minute. For high-risk suspensions (fraud), this is a meaningful gap. The fix is to call `redisService.del(cacheKey)` inside the suspend handler.

**BREAK 2 — Approval socket event is a global broadcast.** The approval handler calls `getIO().emit('merchant_approved', ...)` — this broadcasts to **all** connected clients, not just the target merchant. Any consumer app or admin app connected via socket will receive this event. This is not a security break (no sensitive data in the payload) but is architecturally incorrect; it should use `getIO().to('merchant:' + merchant._id).emit(...)`.

**BREAK 3 — Merchant onboarding notification gap** (see Flow 2, BREAK 1 — no notification to admin on new registration).

---

### Flow 7: Analytics Flow

**Status: BROKEN — Batch endpoint receives events but does not persist them**

**Trace:**

1. Consumer app `analyticsService.ts` batches events and calls `POST /analytics/batch` via `apiClient.post('/analytics/batch', { events })` (line 339)
2. Backend route: `analyticsRoutes.ts` maps `/analytics/batch` and `/analytics/events` to `handleBatchEvents`
3. `handleBatchEvents` handler: validates the array, logs count, returns `{ success: true, message: "Received N events" }`
4. **No write to any database or queue**

**Issues Found:**

**BREAK 1 — Critical: analytics batch handler is a no-op stub.** The handler explicitly reads: `logger.info([Analytics] Received batch of N events); res.json({ success: true, message: Received N events });`. There is no call to any store, no BullMQ publish, no `AnalyticsEvent.insertMany()`. All consumer behavior events (add to cart, product views, purchase funnel) are silently discarded. The admin analytics dashboard (`StoreAnalytics` model) can only be populated via the `POST /analytics/track` endpoint which writes to `StoreAnalytics.trackEvent()` — but the consumer app does not call `/analytics/track`; it calls `/analytics/batch`.

**BREAK 2 — Admin analytics dashboard is decoupled from consumer events.** `analyticsController.getAnalyticsDashboard()` queries `StoreAnalytics` which is populated by `POST /analytics/track`. The merchant analytics dashboard in the merchant app calls `GET /merchant/analytics/*`. Neither is fed by the consumer `/analytics/batch` endpoint. The analytics data the admin sees reflects only events fired by explicit `trackEvent` calls in the backend (e.g., store visits from `storeVisitController`), not the consumer-side event stream.

**BREAK 3 — No wiring from BullMQ analytics queue to frontend dashboards.** The `analyticsQueue.ts` defines a BullMQ queue for batch-writing analytics events, but the consumer batch endpoint does not publish to it.

---

### Flow 8: Search Flow

**Status: PARTIAL — Consumer calls monolith; search microservice is separately deployed**

**Trace:**

1. Consumer app calls `searchApi.ts` → `GET /products/search`, `GET /stores/search`, `GET /stores/search/advanced`, `GET /search/autocomplete`
2. All these route to the **monolith** backend (`searchRoutes.ts` → `searchController.ts`)
3. `searchController.ts` searches MongoDB directly using regex and Haversine distance — no Elasticsearch, no Typesense
4. The `rez-search-service` microservice (`/rez-search-service/`) has its own `searchService.ts` that also queries MongoDB with personalized ranking (popularity, offers, prior visits)

**Issues Found:**

**BREAK 1 — Two separate search implementations coexist.** The monolith's `searchController.ts` and the `rez-search-service/src/services/searchService.ts` both search MongoDB independently. They have different ranking strategies, different result shapes, and different cache strategies. The consumer app is currently hitting the monolith. The `rez-search-service` has routes that mirror monolith paths (e.g., `/api/stores/search`, `/api/stores/nearby`) to allow drop-in routing, but whether the API gateway is routing to it in production is unknown — no gateway config was found in the audited directories.

**BREAK 2 — No Elasticsearch or Typesense in the search path.** Despite references to these in architecture docs, both the monolith search and the microservice search query MongoDB directly via aggregation pipelines and regex. Full-text search quality and performance will degrade at scale.

**BREAK 3 — `rez-api-gateway` directory exists but has no routing config traced.** The consumer app's `config/env.ts` references `EXPO_PUBLIC_API_BASE_URL` which should be the API gateway, but whether `/stores/search` is proxied to `rez-search-service` vs. the monolith is not enforced in any config file found in the repo.

---

### Flow 9: Hotel/OTA Booking

**Status: COMPLETE — with one critical env var risk**

**Trace:**

1. Consumer calls `hotelOtaApi.ts` — first calls `POST /v1/auth/rez-sso` on Hotel OTA API with REZ access token to exchange for OTA JWT
2. Consumer searches hotels, selects room, calls hold then confirm on Hotel OTA API (`partner-rez.routes.ts`)
3. Hotel OTA `BookingService.confirm()` calls `RezWebhookService.sendBookingConfirmed()` — fires `POST <REZ_API_BASE_URL>/api/travel-webhooks/ota-booking-confirmed` with HMAC signature and `rez_coin_to_credit_paise`
4. REZ backend `travelWebhookController.ts:handleOtaBookingConfirmed` verifies HMAC, converts paise to coin units, calls `awardCoins()` with idempotency key `ota_booking_<bookingId>`
5. Coins are credited to user wallet; duplicate webhook delivery is handled gracefully

**Issues Found:**

**BREAK 1 — Env var name mismatch.** The Hotel OTA sends the webhook signature in the `X-HMAC-Signature` header using secret `REZ_WEBHOOK_SECRET`. The REZ backend handler reads `process.env.REZ_OTA_WEBHOOK_SECRET || process.env.REZ_WEBHOOK_SECRET`. If `REZ_OTA_WEBHOOK_SECRET` is not set, it falls back to `REZ_WEBHOOK_SECRET` — which is the **same** env var the Hotel OTA uses. This means the secret must match on both sides through whichever env var name is deployed. Any mismatch silently rejects all OTA coin credits with `500 Webhook secret not configured`.

**BREAK 2 — `sendStayCompleted` webhook fires to `/webhooks/ota/stay-completed`** on REZ backend but no handler for this route was found in `travelWebhookRoutes.ts` or any other routes file. Stay-completion bonus coins are never credited.

**BREAK 3 — Hotel OTA calls `BookingService.confirm()` from three separate places** (`booking.service.ts`, `payment-orchestration.service.ts`, `booking-state-machine.service.ts`) — each calls `RezWebhookService.sendBookingConfirmed()`. The idempotency guard in the backend (`duplicate referenceId`) should handle this, but it means three webhook delivery attempts may fire in rapid succession on a single booking confirmation event.

---

## Cross-App Data Contract Issues

| Issue | Consumer App | Merchant App | Backend | Impact |
|-------|-------------|--------------|---------|--------|
| Merchant routing split (monolith vs. rez-merchant-service) | N/A | `client.ts:shouldRouteToMerchantService()` | Both expose `/api/merchant/*` | Requests may land on wrong service without gateway enforcement |
| `payment.status` field naming | `paymentService.ts` uses `razorpay_order_id` field | N/A | Controller uses `razorpayOrderId` camelCase in body | Minor: verify-payment endpoint accepts both via destructuring |
| Wallet balance response shape | `walletApi.ts` handles `breakdown.cashback` and `breakdown.cashbackBalance` as alternates | N/A | Monolith may send either field depending on code path | Fragile: dual-field handling in client masks backend inconsistency |
| Analytics event shape | `analyticsService.ts` sends named events to `/analytics/batch` | N/A | Batch handler does not persist — all events dropped | Critical data loss |
| Search result shape | Monolith `searchController` vs. `rez-search-service` `searchService` return different structures | N/A | Both active | Frontend may get inconsistent pagination and ranking fields |

---

## Missing Event Handlers

| Event / Webhook | Where It Should Fire | Current Status |
|----------------|---------------------|----------------|
| `order.payment_confirmed` BullMQ event | After Razorpay `payment.captured` webhook | NOT published |
| Merchant notification after payment.captured | `merchantNotificationService.notifyNewOrder()` or new notify type | NOT called |
| Consumer push notification after payment.captured | `pushNotificationService.sendPushToUser()` | NOT called |
| Admin notification on new merchant registration | `publishNotificationEvent` or email to admin | MISSING |
| Stay-completed coin credit from Hotel OTA | `/webhooks/ota/stay-completed` route | ROUTE DOES NOT EXIST |
| Analytics batch event persistence | `AnalyticsEvent.insertMany()` or `publishAnalyticsEvent()` | HANDLER IS STUB |
| Merchant Redis cache invalidation on suspension | `redisService.del('merchant:auth:<id>')` | NOT called (60s lag) |

---

## Priority Issues

### P0 — Breaks core revenue/trust flows immediately

**P0-1: Razorpay webhook does not credit coins or notify merchant after payment.captured**
- File: `/rezbackend/rez-backend-master/src/controllers/razorpayController.ts` — `handleRazorpayWebhook` case `'payment.captured'`
- After the `Order.findOneAndUpdate`, add: `publishOrderEvent('order.payment_confirmed')`, call `merchantNotificationService.notifyOrderPaid()`, and call `walletService.credit()` (or `awardCoins()`) to give the consumer their earned coins
- The coin earn rate should be derived from the store's coin config, not hardcoded

**P0-2: Analytics batch endpoint is a stub — all consumer events are discarded**
- File: `/rezbackend/rez-backend-master/src/routes/analyticsRoutes.ts` — `handleBatchEvents`
- The handler must call `publishAnalyticsEvent()` (the BullMQ queue exists) or write directly to `AnalyticsEvent` collection
- Without this, no consumer behavior data reaches admin dashboards

### P1 — Breaks important flows; workarounds exist

**P1-1: Admin receives no notification when a merchant registers**
- File: `/rezbackend/rez-backend-master/src/merchantroutes/auth.ts` — `POST /register` handler
- After `merchant.save()`, call `publishNotificationEvent` targeting admin role with `notification.admin` type
- Severity: Admins must manually poll the pending merchant list

**P1-2: Merchant suspension does not immediately invalidate Redis auth cache**
- File: `/rezbackend/rez-backend-master/src/routes/admin/merchants.ts` — `POST /:id/suspend` handler
- After `merchant.save()`, call `redisService.del('merchant:auth:' + merchant._id.toString())`
- Severity: Suspended merchants retain API access for up to 60 seconds

**P1-3: Hotel OTA `stay_completed` webhook target route is missing**
- File: `/rezbackend/rez-backend-master/src/routes/travelWebhookRoutes.ts`
- Add `router.post('/stay-completed', handleOtaStayCompleted)` and implement handler to award stay-completion bonus coins
- Without this, hotel post-stay coin bonuses are never issued

**P1-4: Merchant approval emits global socket broadcast**
- File: `/rezbackend/rez-backend-master/src/routes/admin/merchants.ts` — `POST /:id/approve`
- Change `getIO().emit('merchant_approved', ...)` to `getIO().to('merchant:' + merchant._id).emit(...)`

### P2 — Technical debt; does not break flows in happy path

**P2-1: Two search implementations coexisting without routing clarity**
- Monolith `searchController.ts` and `rez-search-service` search independently from MongoDB
- Need API gateway routing to consistently send search requests to one authoritative service

**P2-2: BullMQ order worker is in permanent "shadow/dual mode"**
- `orderQueue.ts` comment states "Phase A — shadow/dual mode" — controllers still do direct notification calls in-request
- Side effects (analytics, cache) run twice in some paths; the migration to queue-first has stalled

**P2-3: `rez-wallet-service` microservice is isolated**
- The standalone wallet service has its own DB connection and route handlers but is not called by the monolith coin flows
- Monolith `walletService.ts` and the microservice will diverge without an explicit architectural decision to deprecate one

**P2-4: Merchant registration auto-creates a store with `foreignField: 'merchantId'` but admin merchant lookup uses `foreignField: 'merchant'`**
- `admin/merchants.ts` lookup: `from: 'stores', localField: '_id', foreignField: 'merchantId'`
- If the Store model uses `merchant` as the field name (not `merchantId`), the admin stores lookup returns empty arrays
- Verify `Store` schema field name matches the lookup's `foreignField`

**P2-5: Hotel OTA fires `sendBookingConfirmed` from three separate code paths**
- `booking.service.ts`, `payment-orchestration.service.ts`, `booking-state-machine.service.ts` all call `RezWebhookService.sendBookingConfirmed()`
- Backend idempotency guard handles duplicates, but three fire attempts per booking increases Razorpay/REZ webhook traffic unnecessarily

---

*End of report.*
