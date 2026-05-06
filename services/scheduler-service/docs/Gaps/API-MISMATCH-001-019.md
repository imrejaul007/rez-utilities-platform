# API-MISMATCH-001-019: Frontend-Backend API Contract Mismatches

**19 critical API contract mismatches between consumer app and backend services**
**Services:** rez-app-consumer, rez-payment-service, rez-wallet-service, rez-karma-service, rez-finance-service, rez-order-service
**Audit Source:** Frontend-Backend Type Mismatch Audit Agent

---

## CRITICAL (7)

### API-MISMATCH-001: POST /wallet/payment — Payload Incompatibility

**Consumer app:** `services/walletApi.ts:162` sends `{ amount, orderId, storeId, description }`

**Wallet service:** `walletRoutes.ts:147-161` expects `{ amount, coinType, source, description }`

`source` is required, `orderId`/`storeId` are never referenced. Every consumer wallet payment fails validation.

---

### API-MISMATCH-002: Razorpay Verify Endpoint — Internal-Only Accidentally Called by Frontend

**Consumer app:** `services/paymentService.ts:322` calls `POST /payment/verify`

**Payment service:** `paymentRoutes.ts` — `/api/razorpay/verify-payment` requires `requiresInternalToken`

Consumer app cannot verify payments — every verification call returns 401/403.

---

### API-MISMATCH-003: Karma Service — Wrong Endpoint Paths

**Consumer app:** `services/karmaService.ts` calls:
- `GET /karma/level/${userId}` — wrong path
- `GET /karma/user/${userId}/history` — correct

**Karma service:** `karmaRoutes.ts:29,92,120` defines:
- `GET /api/karma/user/:userId/level` — correct path
- `GET /api/karma/user/:userId/history` — correct

Karma level endpoint returns 404 on consumer app.

---

### API-MISMATCH-004: Payment Initiation — Non-Existent Endpoint

**Consumer app:** `services/paymentService.ts:171` calls `POST /wallet/initiate-payment`

**No service defines this endpoint.** Payment service has:
- `POST /pay/initiate`
- `POST /api/payment/initiate`

Consumer payment initiation always fails.

---

### API-MISMATCH-005: Payment Status — Wrong Path

**Consumer app:** `services/paymentService.ts:194` calls `GET /wallet/payment-status/${paymentId}`

**Payment service:** defines `GET /pay/status/:paymentId` and `GET /api/payment/status/:paymentId}`

Every payment status poll fails with 404.

---

### API-MISMATCH-006: Payment Status Response — Field Name Mismatch

**Consumer app:** `PaymentStatusResponse` expects `status: 'pending'|'processing'|'completed'|'failed'|'cancelled'`

**Payment service:** returns `{ paymentId, status, gatewayResponse }` with potentially different enum values

---

### API-MISMATCH-007: Profile Endpoint — Wrong Path and Method

**Consumer app:** `services/profileApi.ts` calls `GET /user/profile` and `PUT /user/profile`

**Backend:** `authRoutes.ts` defines `GET /user/auth/profile` and `PATCH /user/auth/profile`

Profile fetch and update always return 404.

---

## HIGH (12)

### API-MISMATCH-008: Razorpay Order Amount — Rupees vs Paise

**Consumer app:** `services/razorpayService.ts:103` sends amount in rupees (not converted to paise)

**Payment service:** divides by 100 expecting paise — `amount=500` becomes 5 paise

All Razorpay orders created at 1% of intended amount.

---

### API-MISMATCH-009: Transaction Pagination — Missing Fields

**Consumer app:** expects `{ transactions, pagination: { total, page, totalPages, hasMore, hasPrev } }`

**Wallet service:** returns `{ transactions, pagination: { total, page, hasMore } }` — missing `totalPages`, `hasPrev`

Pagination normalization computes `current` incorrectly.

---

### API-MISMATCH-010: Order List — Double-Nested Response

**Consumer app:** `services/ordersApi.ts:336-346` expects `data: orderArray`

**Order service:** returns `{ success, data: { orderArray }, total, page, limit }` — two levels of nesting

---

### API-MISMATCH-011: Karma History — Response Wrapper Mismatch

**Consumer app:** expects flat array from history endpoint

**Karma service:** returns `{ history: [...] }` — not a flat array

Karma history renders as empty or `[object Object]` in UI.

---

### API-MISMATCH-012: Karma Level — Response Not Unwrapped

**Karma service:** returns `{ level, points, nextLevel, progress }` (or nested at `response.data.level`)

**Consumer app:** accesses `response.level` directly

---

### API-MISMATCH-013: Finance BNPL Offers — Non-Standard Envelope

**Finance service:** `borrowRoutes.ts` returns `{ success, offers }` (no `data` wrapper)

**Consumer app:** expects `response.data.offers`

---

### API-MISMATCH-014: Finance Credit Score — No Envelope

**Finance service:** `creditRoutes.ts` returns spread of credit score result — no `{success, data}` envelope

**Consumer app:** expects ApiResponse wrapper on all endpoints

---

### API-MISMATCH-015: User Identity — `id` vs `_id`

**Consumer app:** accesses `user.id`

**Backend:** returns MongoDB `{ _id: ObjectId }` — `_id`, not `id`

Every `user.id` access returns `undefined`.

---

### API-MISMATCH-016: Store Data — Deeply Nested Extraction

**Store endpoints:** return deeply nested structures

**Consumer app:** `services/storesApi.ts:227` must extract `(response.data as any).store || response.data`

---

### API-MISMATCH-017: Booking Status — Enum Value Mismatch

**Consumer app:** `BookingStatus: 'confirmed'|'pending'|'cancelled'|'completed'`

**Backend:** some endpoints use `CONFIRMED`, `PENDING` (uppercase), others use lowercase

---

### API-MISMATCH-018: Merchant Auth — Nested Response

**Merchant service:** `GET /auth/me` returns `{ merchant, stores }` — merchant nested

**Merchant app:** may expect flat merchant object

---

### API-MISMATCH-019: Wallet Balance — Ambiguous Cashback Fields

**Wallet service:** returns both `cashback` and `cashbackBalance` but semantics are unclear

**Consumer app:** marks both as optional — accommodates either shape defensively

---

## Status Table

| ID | Status | Est Fix |
|----|--------|---------|
| API-MISMATCH-001 | ACTIVE | 1h |
| API-MISMATCH-002 | ACTIVE | 1h |
| API-MISMATCH-003 | ACTIVE | 30m |
| API-MISMATCH-004 | ACTIVE | 1h |
| API-MISMATCH-005 | ACTIVE | 30m |
| API-MISMATCH-006 | ACTIVE | 1h |
| API-MISMATCH-007 | ACTIVE | 30m |
| API-MISMATCH-008 | ACTIVE | 30m |
| API-MISMATCH-009 | ACTIVE | 1h |
| API-MISMATCH-010 | ACTIVE | 1h |
| API-MISMATCH-011 | ACTIVE | 1h |
| API-MISMATCH-012 | ACTIVE | 30m |
| API-MISMATCH-013 | ACTIVE | 1h |
| API-MISMATCH-014 | ACTIVE | 1h |
| API-MISMATCH-015 | ACTIVE | 2h |
| API-MISMATCH-016 | ACTIVE | 1h |
| API-MISMATCH-017 | ACTIVE | 1h |
| API-MISMATCH-018 | ACTIVE | 1h |
| API-MISMATCH-019 | ACTIVE | 30m |
