# SA3: API Contract Extraction Report
Generated: 2026-04-12 | Branch: audit/recovery-phase

---

## CRITICAL MISMATCHES (runtime failures)

### 1. Wallet Microservice Transactions — Envelope Mismatch (BREAKING)
- **Backend** (`rez-wallet-service/src/routes/walletRoutes.ts:49`): Returns `{ success, data: transactionsArray, pagination: {...} }` — `data` is array, `pagination` at ROOT level
- **Frontend** (`walletApi.ts:168-178`): Reads `response.data.transactions` (undefined) and `response.data.pagination` (undefined)
- **Impact**: Merchant + Consumer transaction lists silently empty when routed through microservice

### 2. Merchant Wallet Transactions — Same Shape Bug
- **Backend** (`rezbackend/src/merchantroutes/wallet.ts:80-87`): Returns `{ success, data: result.transactions, pagination: result.pagination }` — `data` is array, pagination at ROOT
- **Frontend** (`rezmerchant/services/wallet.ts:93-111`): Reads `response.data.transactions` (undefined) and `response.data.pagination` (undefined)
- **Impact**: Merchant transaction list always empty

### 3. `POST /api/wallet/withdraw` — accountDetails Type Mismatch
- **Backend** (`walletRoutes.ts:225-229`): Joi requires `accountDetails: Joi.object().required()`
- **Frontend** (`walletApi.ts:207-210`): `accountDetails?: string` (optional string)
- **Impact**: Any withdrawal attempt → Joi 400 error

### 4. Consumer `AuthResponse.tokens.expiresIn` — Field Never Sent
- **Backend**: `verify-otp` and `verify-pin` return `{ data: { user, tokens: { accessToken, refreshToken } } }` — no `expiresIn`
- **Frontend** (`authApi.ts:72-78`): `AuthResponse.tokens.expiresIn: number`
- **Impact**: Any TTL check against `tokens.expiresIn` receives `undefined`; auth session logic broken

### 5. Orders Pagination — Type Mismatch (Partially Compensated)
- **Backend**: Returns `{ page, totalPages, total, limit }`
- **`ordersApi.ts:296-303`**: Has normalization shim `pag.current ?? pag.page ?? 1` — OK
- **Deprecated `orderApi.ts`**: No normalization shim — passes raw `{ page, totalPages }` to components expecting `{ current, pages }`

### 6. `POST /api/wallet/confirm-payment` — Hardcoded 404
- Route handler always returns 404 (Stripe disabled). Dead endpoint — callers always fail.

### 7. Consumer `ordersApi.ts` — PATCH vs Merchant PUT Order Status
- Consumer `ordersApi.ts:433`: sends `PATCH /orders/:orderId/status` — requires `requireAdmin` middleware
- Merchant app correctly uses `PUT /api/merchant/orders/:id/status`
- Any consumer trying to update order status gets 403

---

## SHAPE DIVERGENCES (silent bugs)

### 8. `breakdown.cashback` vs `breakdown.cashbackBalance`
- Backend sends `breakdown.cashbackBalance`
- Frontend `walletApi.ts:69`: declares both optional — code reading `breakdown.cashback` gets `undefined`

### 9. Consumer `GET /orders/analytics` (deprecated `orderApi.ts:164`) → 404
- No backend `/orders/analytics` route. Backend has `/orders/stats` and `/orders/counts` instead.

### 10. `GET /api/user/auth/statistics` Deeply Nested Shape
- Frontend expects 8 deeply nested keys (user/wallet/orders/videos/projects/offers/vouchers/summary)
- Any absent key causes "Cannot read properties of undefined" crash in UI

---

## PAGINATION ENVELOPE INCONSISTENCY (4 distinct shapes)
| Service | Shape |
|---------|-------|
| Consumer backend (orders) | `data.pagination.{ page, totalPages, total, limit }` |
| Wallet microservice | Root-level `pagination.{ total, page, hasMore }`, `data` = array |
| Merchant backend (wallet) | Root-level `pagination`, `data` = array |
| Consumer backend (service bookings) | `meta.pagination` |
| Frontend normalization | Each service compensates differently |

---

## MISSING BACKEND ROUTES
| Frontend call | Status |
|--------------|--------|
| `GET /orders/analytics` (deprecated orderApi.ts) | ❌ No backend route (404) |

---

## DEAD BACKEND ROUTES (no frontend caller)
| Route | Notes |
|-------|-------|
| `GET /api/orders/live/:orderId` (SSE) | Real-time tracking — no EventSource caller in any frontend |
| `POST /api/orders/:orderId/reorder` | No consumer caller |
| `GET /api/orders/:orderId/financial` | No consumer caller |
| `GET /api/orders/refunds` | Can request refund but can't list them |
| `PUT /api/service-bookings/:id/complete` | No consumer caller |
| `POST /api/service-bookings/:id/rate` | No consumer caller |

---

## WALLET MICROSERVICE DUPLICATE REGISTRATION
`rez-wallet-service/src/routes/walletRoutes.ts`: routes registered at BOTH `/balance` AND `/api/wallet/balance` — double-handling risk depending on mount prefix.

---

## MERCHANT ORDER STATUS FSM
- Merchant backend allows: `confirmed, preparing, ready, dispatched, out_for_delivery, delivered, cancelled`
- Consumer backend allows a broader set including `placed, cancelling, returned, refunded`
- Merchant app FSM matches merchant backend — consistent
