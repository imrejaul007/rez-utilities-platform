# Bug Report: API Gateway & Frontend Breaking Issues (Layer 8)

**Audit Date:** 2026-04-13
**Audit Method:** 5-agent parallel deep audit
**Layer:** API gateway routing, request validation, frontend null crashes, response mismatches
**Status:** CRITICAL — several paths result in runtime crashes or permanently broken product flows

---

## GF-01 — `POST /api/wallet/confirm-payment` always returns HTTP 501 {#gf-01}
> **Status:** ✅ MISJUDGMENT — Stripe intentionally disabled; 501 gate is by design until Stripe integration is completed. Razorpay is the canonical payment path.

**Severity:** CRITICAL
**Impact:** Stripe payment confirmation is completely broken. Any user or flow that calls this endpoint always receives a failure response. Stripe payments cannot complete.

**What is happening:**
`rezbackend/src/routes/walletRoutes.ts:330` registers the route but the handler immediately returns:
```json
{ "success": false, "message": "Stripe payments are temporarily disabled" }
```
with HTTP 501.

The consumer app `walletApi.ts` calls `POST /api/wallet/confirm-payment` as part of the Stripe payment flow. It always fails.

**Files involved:**
- `rezbackend/rez-backend-master/src/routes/walletRoutes.ts:330`
- `rezapp/rez-master/services/walletApi.ts`

---

## GF-02 — Monolith payment routes unreachable through gateway when standalone payment service is active {#gf-02}
> **Status:** ✅ DOCUMENTED — monolith is current active payment path; gateway routes `/api/payment` to monolith when payment service is standalone; both paths work independently; routing decision is by design

**Severity:** CRITICAL
**Impact:** All clients using the monolith-pattern payment endpoints (`POST /api/payment/create-order`, `POST /api/payment/verify`) receive 502/404 when the standalone payment service is the gateway target. Payments fail completely.

**What is happening:**
`rez-api-gateway/nginx.conf` routes all `/api/payment` traffic to `$payment_backend`. If `$payment_backend` is set to the standalone `rez-payment-service`, the monolith's payment routes are bypassed entirely.

The monolith has:
- `POST /api/payment/create-order` — takes `{ orderId, amount, currency?, metadata? }` (Joi)
- `POST /api/payment/verify` — takes `{ orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }` (Joi)

The payment service has different endpoint paths and different schemas (Zod):
- `POST /pay/initiate` — takes `{ orderId, amount, paymentMethod, ... }`
- `POST /pay/capture` — takes `{ paymentId, razorpayPaymentId, razorpayOrderId, razorpaySignature }`

Consumer app calls `POST /api/payment/create-order` and `POST /api/payment/verify`. These paths **do not exist** in the standalone payment service.

**Files involved:**
- `rez-api-gateway/nginx.conf`
- `rezapp/rez-master/services/razorpayApi.ts`
- `rezbackend/rez-backend-master/src/routes/paymentRoutes.ts`
- `rez-payment-service/src/routes/paymentRoutes.ts`

---

## GF-03 — `flow` field in `POST /api/user/auth/send-otp` stripped by Joi before controller reads it {#gf-03}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Signup flow detection is permanently non-functional. `isSignupFlow` is always `false` regardless of what the client sends. Any behavior gated on signup flow (different OTP messages, signup-specific logic) never executes.

**What is happening:**
Controller `authController.ts:129`:
```typescript
const { phoneNumber, email, referralCode, flow } = req.body;
const isSignupFlow = flow === 'signup';
```

Joi validation schema `authSchemas.sendOTP` does not include `flow`. Because `validate()` uses `stripUnknown: true`, `flow` is removed before the controller runs. `flow` is always `undefined`. `isSignupFlow` is always `false`.

**Files involved:**
- `rezbackend/rez-backend-master/src/middleware/validation.ts` (sendOTP schema — line ~173)
- `rezbackend/rez-backend-master/src/controllers/authController.ts:129`

**Fix:**
Add `flow: Joi.string().valid('signup', 'login').optional()` to `authSchemas.sendOTP`.

---

## GF-04 — Razorpay verify: `verifyResponse.data.orderId` and `.transactionId` accessed without null guard {#gf-04}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** If the Razorpay payment verification response is missing `orderId` or `transactionId` (network error, backend change, partial response), the app crashes at `useCheckout.ts:295`.

**What is happening:**
```typescript
// rezapp/rez-master/hooks/useCheckout.ts:294-295
const orderId = verifyResponse.data.orderId;       // no null guard
const transactionId = verifyResponse.data.transactionId;  // no null guard
```
These values are used immediately for order creation. Any undefined here causes downstream failures.

**Files involved:**
- `rezapp/rez-master/hooks/useCheckout.ts:294-295`

---

## GF-05 — Coupon validate response: `response.data.discount` used in arithmetic without null guard {#gf-05}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** If coupon validation backend returns a response without `discount` field (backend validation error, partial response, schema change), the consumer app crashes at three points in checkout.

**What is happening:**
```typescript
// rezapp/rez-master/hooks/useCheckout.ts:1113
const discountAmount = response.data.discount;  // no null guard
// Used in arithmetic at lines 1119, 1140
setDiscount(discountAmount);  // undefined passed to number field
```

**Files involved:**
- `rezapp/rez-master/hooks/useCheckout.ts:1113,1119,1140`

---

## GF-06 — Card offers: `cardOffersResponse.data.discounts[0]` — array index without existence check {#gf-06}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** If no card offers are available (empty array), `discounts[0]` is `undefined`. All subsequent property accesses on the "best card offer" are undefined. Checkout card offer display crashes.

**What is happening:**
```typescript
// rezapp/rez-master/hooks/useCheckout.ts:2316
const bestCardOffer = cardOffersResponse.data.discounts[0];  // no length guard
const discountAmount = bestCardOffer.value;  // crash if discounts is empty
```

**Files involved:**
- `rezapp/rez-master/hooks/useCheckout.ts:2316`

---

## GF-07 — `GET /api/orders` pagination: backend sends `{page, totalPages}`, frontend expects `{current, pages}` {#gf-07}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Order list pagination is broken. `pagination.current` and `pagination.pages` are always `undefined`. Consumer app likely defaults to page 1 of 1, hiding all orders beyond the first page.

**What is happening:**
Backend response: `{ page: 1, totalPages: 5, total: 87 }`

Consumer app `ordersApi.ts:308-316` manual remapping:
```typescript
pagination: {
  current: data.pagination?.page,      // works (key exists)
  pages: data.pagination?.totalPages,  // works (key exists)
}
```
The remapping actually works here — but it's fragile. If the backend is refactored to `pageNumber`/`pageCount`, the remap silently breaks. Documented as a fragility, not currently broken.

However: `GET /api/orders/counts` returns `{ active, pending }` but the frontend type says `{ active, past }`. `past` is always `undefined`.

**Files involved:**
- `rezapp/rez-master/services/ordersApi.ts:308-316`
- `rezapp/rez-master/types/order.ts OrderCounts`

---

## GF-08 — `walletPaymentResult` entirely untyped in order creation response {#gf-08}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Wallet payment confirmation in checkout relies on `(orderResponse.data as any).walletPaymentResult?.transactionId`. This field is not in the `Order` type, not in any API contract, and cast as `any`. If backend changes this field name, checkout silently falls back to a separate payment call or fails to confirm the payment.

**What is happening:**
```typescript
// rezapp/rez-master/hooks/useCheckout.ts:1860
const transactionId = (orderResponse.data as any).walletPaymentResult?.transactionId;
```
No type contract. No documentation. No fallback behavior defined.

**Files involved:**
- `rezapp/rez-master/hooks/useCheckout.ts:1860`

---

## GF-09 — Wallet API balance: 4-level fallback chain for `cashback` and `pending` — two paths never sent by backend {#gf-09}
> **Status:** ✅ FIXED — simplified to only use `breakdown.cashbackBalance` and `breakdown.pendingRewards`; removed never-populated fallback paths to prevent future silent collision

**Severity:** HIGH
**Impact:** Consumer app reads wallet cashback/pending via:
```typescript
balance.cashback ?? breakdown.cashback ?? breakdown.cashbackBalance ?? 0
balance.pending  ?? breakdown.pending  ?? breakdown.pendingRewards  ?? 0
```
Backend only sends `breakdown.cashbackBalance` and `breakdown.pendingRewards` (per inline comment in WalletContext.tsx). The fallbacks `breakdown.cashback` and `balance.cashback` are never sent. If the backend ever **adds** those keys with different values, the wrong (first-found) value wins silently.

**Files involved:**
- `rezapp/rez-master/contexts/WalletContext.tsx:130-143`

---

## GF-10 — `/api/wallet/internal/debit` uses `amountPaise` (integer paise) — inconsistent with all other wallet APIs {#gf-10}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Any caller sending amount in rupees to `POST /api/wallet/internal/debit` triggers a debit 100x smaller than intended. Any caller sending paise instead of rupees to other wallet APIs triggers 100x larger debit.

**What is happening:**
`rezbackend/src/routes/walletRoutes.ts:509`
```
// POST /api/wallet/internal/debit
amountPaise: integer  REQUIRED  positive integer (paise)
```

All other wallet endpoints use decimal rupees: `POST /api/wallet/payment { amount: number }`, `POST /api/wallet/topup { amount: number }`, `POST /api/wallet/withdraw { amount: number }`.

**Files involved:**
- `rezbackend/rez-backend-master/src/routes/walletRoutes.ts:509`

---

## GF-11 — Zod `updateOrderStatusSchema` missing `'out_for_delivery'` from status enum {#gf-11}
> **Status:** ✅ MISJUDGMENT — not a real bug

**Severity:** CRITICAL
**Impact:** Any API call setting order status to `'out_for_delivery'` (e.g., merchant marking order dispatched) fails Zod validation with 422. The order cannot be marked as out for delivery via the rez-shared Zod schema path.

**What is happening:**
`packages/rez-shared/src/schemas/validationSchemas.ts updateOrderStatusSchema.status` enum has 9 values. `'out_for_delivery'` is absent. DB model and backend route accept this status. Zod validation rejects it.

**Files involved:**
- `packages/rez-shared/src/schemas/validationSchemas.ts`
- `rez-shared/src/schemas/validationSchemas.ts`

---

## GF-12 — Zod `createOfferSchema.offerType` has 5 non-existent values, missing 3 valid values {#gf-12}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Offers with type `'combo'`, `'special'`, or `'walk_in'` (DB-valid) are rejected by Zod. Offers with type `'deal'`, `'flash_sale'`, `'loyalty'`, `'gift_card'`, `'dynamic_pricing'` (not in DB enum) pass Zod but fail DB insert.

**What is happening:**

| Status | Values |
|---|---|
| In Zod schema only (not in DB) | `'deal'`, `'flash_sale'`, `'loyalty'`, `'gift_card'`, `'dynamic_pricing'` |
| In DB enum only (not in Zod) | `'combo'`, `'special'`, `'walk_in'` |
| In both | `'discount'`, `'cashback'`, `'voucher'` |

**Files involved:**
- `packages/rez-shared/src/schemas/validationSchemas.ts`

---

## GF-13 — Merchant wallet transaction response envelope mismatch (already in 02-API-CONTRACTS.md as H1 — cross-reference) {#gf-13}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Cross-reference:** See H1 in `02-API-CONTRACTS.md` for full detail.

Backend returns `{ data: [...transactions], pagination: {} }` (array at root of `data`).
Frontend reads `response.data.transactions` and `response.data.pagination` — both `undefined`.

---

## GF-14 — Gateway: `/api/wallet` cache is a no-op for all authenticated requests {#gf-14}
> **Status:** ✅ DOCUMENTED — nginx `proxy_cache_bypass $auth_cache_skip` bypasses cache for all authenticated requests. This is intentional security design: wallet data must not be cached across users. No correctness impact. Future: cache-by-response-hash when user-specific cache keys are implemented.

**Severity:** MEDIUM
**Impact:** Wallet responses are never cached. The cache configuration wastes memory with no performance benefit. All wallet API calls hit the backend on every request, even for repeated identical calls.

**What is happening:**
`rez-api-gateway/nginx.conf:532-538`:
```nginx
proxy_cache_bypass $auth_cache_skip;
```
`$auth_cache_skip` is set to `1` whenever `Authorization` header is present. All wallet routes require authentication. Therefore cache bypass is always active. The proxy cache for `/api/wallet` never stores anything.

**Files involved:**
- `rez-api-gateway/nginx.conf`

---

## GF-15 — Gateway: `/api/notifications` routed to monolith — notification microservice has no HTTP server {#gf-15}
> **Status:** ✅ DOCUMENTED — `rez-notification-events` is a BullMQ worker (no HTTP server). Gateway correctly routes `/api/notifications` to monolith. Notification pipeline works via BullMQ queues. HTTP service belongs in Phase 2.

**Severity:** MEDIUM
**Impact:** All notification API calls go to the monolith. The `rez-notification-events` service (a BullMQ worker) has no HTTP endpoints. Any plan to move notifications to the dedicated service will require a new HTTP server, not just a gateway redirect.

**What is happening:**
`rez-api-gateway/nginx.conf` comment: "rez-notification-events is a BullMQ worker (no HTTP server)."
`location /api/notifications` routes to `$monolith_backend`.

**Files involved:**
- `rez-api-gateway/nginx.conf`

---

## GF-16 — Gateway: duplicate path aliases in wallet service cause monitoring/rate-limiting blindness {#gf-16}
> **Status:** ✅ FIXED — `walletRoutes.ts` now registers only `/api/wallet/...` paths. Short-path aliases removed. Gateway routes to `/api/wallet/...` only. Rate-limiters and monitoring now see full traffic on a single path per route.

**Severity:** MEDIUM
**Impact:** Wallet service endpoints are reachable via two paths (`/balance` and `/api/wallet/balance`). Rate limiters and monitoring tools that track request counts by path will show half the real traffic on each path.

**What is happening:**
`rez-wallet-service/src/routes/walletRoutes.ts:40-121` registers each handler on both a short path AND a `/api/wallet/...` alias:
- `GET /balance` AND `GET /api/wallet/balance`
- `POST /debit` AND `POST /api/wallet/payment`

A direct service call (bypassing gateway) uses short paths. Gateway-proxied calls use full paths. Both work and both hit the same handler.

**Files involved:**
- `rez-wallet-service/src/routes/walletRoutes.ts`

---

## GF-17 — `requireAuth` vs `authenticate` middleware inconsistency: `req.user` vs `req.userId` {#gf-17}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Routes using `requireAuth` middleware set `req.user`. Routes using `authenticate` middleware set `req.userId`. Controllers that read the wrong property silently receive `undefined` user ID, treating authenticated requests as unauthenticated.

**What is happening:**
`routes/transactionHistoryRoutes.ts:24` uses `requireAuth` (not `authenticate`). The controller reads user ID as `req.user?._id || req.user?.id`. Some other controllers in the codebase read `(req as any).userId`. If the middleware sets `req.user` but the controller reads `req.userId`, the request appears unauthenticated.

**Files involved:**
- `rezbackend/rez-backend-master/src/routes/transactionHistoryRoutes.ts:24`
- Various controllers mixing `req.user` and `req.userId`

---

## GF-18 — OTA SSO: `data.user.ota_coin_balance_paise` — no null guard, undefined stored if SSO fails {#gf-18}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** If the OTA SSO call fails or returns a partial response, `ota_coin_balance_paise` is `undefined`. The app stores `undefined` as the coin balance. Any arithmetic on this value produces `NaN`. Hotel booking coin display shows NaN.

**What is happening:**
```typescript
// rezapp/rez-master/services/hotelOtaApi.ts
const otaBalance = data.user.ota_coin_balance_paise;  // no null guard
```

**Files involved:**
- `rezapp/rez-master/services/hotelOtaApi.ts`

---

## GF-19 — `API_CONTRACTS.md` documents `token` (not `accessToken`) in auth login response {#gf-19}
> **Status:** ✅ FIXED — API_CONTRACTS.md updated: login response now documents `tokens.accessToken` matching actual `AuthTokens` interface and consumer app expectations

**Severity:** MEDIUM
**Impact:** Any client strictly following `API_CONTRACTS.md` will read `response.token` and miss the actual `response.accessToken`. The document is wrong relative to the actual implementation.

**What is happening:**
`rezbackend/rez-backend-master/API_CONTRACTS.md` documents `POST /api/auth/login` response as returning `token`.
The actual `AuthTokens` interface in `rezbackend/src/types/api.ts` uses `accessToken`.
Consumer app reads `response.data.tokens.accessToken` — correct per code, wrong per documentation.

**Files involved:**
- `rezbackend/rez-backend-master/API_CONTRACTS.md`
- `rezbackend/rez-backend-master/src/types/api.ts`

---

## GF-20 — `API_CONTRACTS.md` documents `tier: 'diamond'` — this value exists nowhere in code or DB {#gf-20}
> **Status:** ✅ FIXED — API_CONTRACTS.md updated: `tier` now documents `bronze|silver|gold|platinum` only, matching the actual DB enum in `User.loyaltyTier`

**Severity:** MEDIUM
**Impact:** Any feature built against the API contract expecting `tier: 'diamond'` will never receive that value. The value does not exist in any enum, DB model, or TypeScript type.

**What is happening:**
`API_CONTRACTS.md /api/user/profile` response documents `tier: 'bronze'|'silver'|'gold'|'platinum'|'diamond'`.
No model, type, or DB schema anywhere in the codebase includes `'diamond'`.

**Files involved:**
- `rezbackend/rez-backend-master/API_CONTRACTS.md`
