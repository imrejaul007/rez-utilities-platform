# rez-payment-service

Razorpay payment gateway service for the REZ platform. Handles payment initiation, capture, refunds, webhook processing, and automated reconciliation of stuck payments.

---

## 1. Purpose

`rez-payment-service` owns all non-travel, non-coin payment flows on REZ:

- Initiate Razorpay orders with server-side authoritative amount assertion (prevents client-side price tampering)
- Capture payments after Razorpay checkout completes on the client
- Process refunds (merchant/admin only)
- Handle Razorpay webhooks — `payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`
- Replay-prevention using a Redis nonce store (25-hour TTL, key `pay:nonce:<razorpayPaymentId>`)
- Concurrency lock using Redis mutex to serialize simultaneous initiations for the same order
- Full payment state machine enforced at the Mongoose schema level
- Automated background reconciliation — every 15 minutes for stuck-processing payments, every 5 minutes for stuck-pending payments
- Immutable `TransactionAuditLog` written for every state transition
- Internal signature oracle (`POST /pay/verify`) for service-to-service signature verification

---

## 2. Tech Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript 5.x |
| Runtime | Node.js >= 20 |
| Framework | Express 4.x |
| Database | MongoDB (Mongoose 8.x) |
| Cache / State | Redis (ioredis 5.x) — nonce store, initiation mutex |
| Payment gateway | Razorpay Node SDK 2.x |
| Input validation | Zod 4.x |
| Cron scheduler | node-cron 3.x (runs inside the main process) |
| Error tracking | Sentry (`@sentry/node` 7.x) |
| Logging | Winston |
| Tracing | W3C `traceparent` header propagation |

**Ports**

| Purpose | Default |
|---------|---------|
| HTTP API | `4001` |
| Health sidecar | `4101` |

---

## 3. Architecture

```
Mobile app / Web
      │
      ▼
rez-api-gateway ──► rez-payment-service :4001
                          │
            ┌─────────────┼──────────────────┐
            ▼             ▼                  ▼
        MongoDB         Redis            Razorpay API
     (payments,       (nonces,          (create order,
     audit logs,       init mutex)       refund, fetch)
      orders)
            │
            ▼
      node-cron
   (reconciliation
      jobs inside
      same process)
```

**Callers of this service**
- `rez-api-gateway` — proxies all `/pay/*` and `/api/payment/*` routes
- `rez-wallet-service` — calls `GET /internal/merchants/:id/payment-regularity` (credit score feature)
- Internal services — `POST /internal/pay/deduct`, `GET /internal/pay/:paymentId`, `POST /pay/verify`
- Razorpay webhook server — `POST /pay/webhook/razorpay`

**Services this service calls**
- Razorpay REST API
- `WALLET_SERVICE_URL` (optional) — to credit coins after payment capture (if configured)
- `mongoose.connection.collection('orders')` — reads from the shared MongoDB `orders` collection for authoritative amount assertion

---

## 4. All API Routes

Routes have dual-path aliases. Native path (`/pay/...`) listed; compat path shown inline.

### Consumer Routes
All consumer routes require `Authorization: Bearer <jwt>` (via `requireAuth` middleware).

#### POST /pay/initiate
Compat: `POST /api/payment/initiate`

Creates a Razorpay order and a pending `Payment` document.

**Important security behavior:**
- Only `purpose: "order"` is allowed on the client-facing route (all others are rejected with 400)
- Amount is asserted against the authoritative order total from the `orders` MongoDB collection (`assertAuthoritativeOrderAmount`). If the amounts differ by more than ₹0.01, the request is rejected
- A Redis mutex (`payment:init:<orderId>`, 10-second TTL) serializes concurrent initiations for the same order
- Idempotency via `orchestratorIdempotencyKey`: if a pending/processing payment already exists for this key, the existing one is returned instead of creating a new Razorpay order

**Request body** (validated by Zod)
```json
{
  "orderId": "64a...",
  "amount": 299.00,
  "paymentMethod": "razorpay",
  "purpose": "order",
  "orchestratorIdempotencyKey": "checkout-session-abc123",
  "userDetails": {
    "name": "Reza Ahmed",
    "email": "reza@example.com",
    "phone": "+919876543210"
  },
  "metadata": { "source": "mobile_app" }
}
```

Allowed `paymentMethod` values: `cod`, `wallet`, `razorpay`, `upi`, `card`, `netbanking`

**Response 200**
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_a1b2c3d4e5f60001",
    "gatewayOrderId": "order_Razorpay123456",
    "amount": 299.00,
    "currency": "INR",
    "keyId": "rzp_live_XXXXXXXXXX"
  }
}
```

**Error 400** — Amount mismatch with authoritative order total  
**Error 400** — `purpose` is not `"order"`  
**Error 503** — Concurrent initiation lock unavailable (retry in a moment)

---

#### POST /pay/capture
Compat: `POST /api/payment/capture`

Verifies the Razorpay signature and marks the payment as completed.

**Replay prevention:** The `razorpayPaymentId` is stored in Redis with `SET NX EX 90000` (25 hours). A second capture attempt for the same ID returns 409. Falls back to an in-process Map if Redis is unavailable.

**Request body** (validated by Zod)
```json
{
  "paymentId": "pay_a1b2c3d4e5f60001",
  "razorpayPaymentId": "pay_Razorpay789ABC",
  "razorpayOrderId": "order_Razorpay123456",
  "razorpaySignature": "<hmac-sha256 signature>"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_a1b2c3d4e5f60001",
    "status": "completed"
  }
}
```

**Error 409** — Payment already captured (replay detected)  
**Error 400** — Invalid payment signature or payment not found

---

#### POST /pay/refund
Compat: `POST /api/payment/refund`

Initiates a Razorpay refund. Only `merchant`, `admin`, `super_admin`, and `operator` roles may call this.

**IDOR guard:** The `processRefund` service function verifies the payment belongs to the caller's user ID (non-admin callers cannot refund another user's payment).

**Request body** (validated by Zod)
```json
{
  "paymentId": "pay_a1b2c3d4e5f60001",
  "amount": 150.00,
  "reason": "Customer request"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "refundId": "rfnd_Razorpay999XYZ",
    "status": "refund_initiated"
  }
}
```

**Error 400** — Refund amount exceeds payment total, or payment is not in `completed` state  
**Error 403** — Role is not merchant/admin

---

#### GET /pay/status/:paymentId
Compat: `GET /api/payment/status/:orderId`

Get payment status and full audit trail.

**Response 200**
```json
{
  "success": true,
  "data": {
    "payment": {
      "paymentId": "pay_a1b2c3d4e5f60001",
      "orderId": "64a...",
      "amount": 299.00,
      "currency": "INR",
      "status": "completed",
      "paymentMethod": "razorpay",
      "purpose": "order_payment",
      "completedAt": "2026-04-08T10:05:00.000Z",
      "gatewayResponse": {
        "gateway": "razorpay",
        "transactionId": "pay_Razorpay789ABC",
        "timestamp": "2026-04-08T10:05:00.000Z"
      }
    },
    "auditTrail": [
      { "action": "capture", "previousStatus": "pending", "newStatus": "completed", "createdAt": "..." },
      { "action": "initiate", "newStatus": "pending", "createdAt": "..." }
    ]
  }
}
```

---

#### GET /api/razorpay/config
Returns the Razorpay public key ID so the client can initialize the Razorpay checkout SDK.

**Response 200** `{ "success": true, "data": { "key_id": "rzp_live_XXXXXXXXXX" } }`

---

#### POST /api/razorpay/create-order
Compat route for the monolith. Creates a Razorpay order after asserting the authoritative amount.

**Request body**
```json
{
  "amount": 299.00,
  "receipt": "rcpt_REZ-1234",
  "orderId": "64a...",
  "notes": { "orderId": "64a..." }
}
```

**Error 400** — Amount mismatch or authoritative order amount not found

---

#### GET /pay/merchant/settlements
Compat: `GET /api/payment/merchant/settlements`

List completed payments attributed to the authenticated merchant.

**Query params:** `page=1`, `limit=20`

**Authorization:** `req.merchantId` (from JWT) or `admin` role required

---

### Webhook Route

#### POST /pay/webhook/razorpay
Compat: `POST /api/payment/webhook/razorpay`

**No auth required** — secured by Razorpay HMAC signature verification.

**Critical setup:** This route receives a raw `Buffer` body (not parsed JSON) because Express mounts `express.raw()` for these two paths in `index.ts`. The raw body is required for correct HMAC verification. Do not add `express.json()` middleware before these paths.

**Handled events:**

| Event | Handler | Behavior |
|-------|---------|----------|
| `payment.captured` | `handleWebhookCaptured` | Marks payment `completed`, writes audit log |
| `payment.failed` | `handleWebhookFailed` | Marks payment `failed`, writes audit log. Skips if already in terminal state |
| `refund.processed` | `handleWebhookRefundProcessed` | Marks payment `refunded` once Razorpay confirms funds landed |
| `refund.failed` | `handleWebhookRefundFailed` | Marks payment `refund_failed` |

All handlers are idempotent — a duplicate webhook for an already-terminal payment is silently acknowledged.

**Signature verification:** `crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody)`. Uses `crypto.timingSafeEqual` to prevent timing attacks. Returns 400 on invalid signature.

**Response 200** `{ "success": true }` — always, unless signature is invalid or a 500 server error occurs

---

### Internal Routes

#### POST /pay/verify
Compat: `POST /api/razorpay/verify-payment`

Requires `X-Internal-Token`. Signature oracle — verifies a Razorpay payment signature server-side. **Never expose to public consumers** — a user-accessible verify endpoint is a signature oracle that can be used to forge captures.

**Request body**
```json
{
  "razorpayOrderId": "order_Razorpay123456",
  "razorpayPaymentId": "pay_Razorpay789ABC",
  "razorpaySignature": "<signature>"
}
```

**Response 200** `{ "success": true, "data": { "valid": true } }`

---

#### POST /internal/pay/deduct
Requires `X-Internal-Token`. Programmatically initiate a payment deduction from a server-side caller (e.g. subscription billing, order service). Does not go through the authoritative amount assertion check.

**Request body** (validated by Zod)
```json
{
  "userId": "64a...",
  "orderId": "64b...",
  "amount": 199.00,
  "paymentMethod": "wallet",
  "purpose": "order",
  "metadata": { "subscriptionId": "sub_123" }
}
```

---

#### GET /internal/pay/:paymentId
Requires `X-Internal-Token`. Fetch payment status for service-to-service queries.

---

### Health

#### GET /health
Returns current state of MongoDB and Redis connections. Sidecar server on `HEALTH_PORT` runs a similar check.

---

## 5. Background Jobs / Workers

Both jobs are managed by `node-cron` and started inside the main process via `startReconciliationJobs()` in `src/jobs/reconciliation.ts`.

### Job 1 — Stuck Processing Recovery (`*/15 * * * *`)
Runs every 15 minutes. Finds all `Payment` documents with `status: "processing"` and `updatedAt` older than 30 minutes. For each, fetches the actual payment status from Razorpay:
- If Razorpay says `captured` → marks payment `completed`
- If Razorpay says `failed` → marks payment `failed`
- Otherwise skips (payment may still be processing on the gateway side)

Processes in batches of 50 using cursor-based pagination (`_id: { $gt: lastId }`) to avoid loading the full collection.

### Job 2 — Stuck Pending Expiry (`*/5 * * * *`)
Runs every 5 minutes. Bulk-updates all `Payment` documents with `status: "pending"` and `createdAt` older than 1 hour to `status: "expired"`. Uses `Payment.updateMany` for efficiency.

Both jobs write `TransactionAuditLog` entries for every status change they make. Failures are logged but do not crash the process — the next scheduled run will retry.

---

## 6. Security Mechanisms

### Authoritative Amount Assertion
`assertAuthoritativeOrderAmount(orderId, amount)` looks up the order in the shared `orders` MongoDB collection and rejects the payment if the amounts differ by more than ₹0.01. This prevents a client from downgrading the amount client-side before calling the payment API.

### Replay Prevention (Nonce Store)
After a successful capture, `razorpayPaymentId` is written to Redis with `SET NX EX 90000` (25 hours). A second capture attempt for the same `razorpayPaymentId` is rejected with 409. Local `Map` fallback when Redis is unavailable.

### Razorpay Signature Verification
All payment captures verify `HMAC-SHA256(razorpayOrderId|razorpayPaymentId, RAZORPAY_KEY_SECRET)` using `crypto.timingSafeEqual`.

Webhooks verify `HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)`. Raw body is preserved via `express.raw()` mounted before `express.json()` for webhook paths.

### Redis Mutex (Initiation Lock)
`acquireLock("payment:init:<orderId>", 10000)` uses `SET NX PX` with a UUID token. Released via Lua compare-and-delete to prevent another process from releasing a lock it doesn't own.

### Payment State Machine
Mongoose pre-save hook enforces valid transitions:

```
pending → processing, cancelled, expired
processing → completed, failed, cancelled
completed → refund_initiated
refund_initiated → refund_processing, refunded, refund_failed
refund_processing → refunded, refund_failed
refund_failed → refund_initiated  (retry allowed)
refunded → (terminal)
failed → (terminal)
cancelled → (terminal)
expired → (terminal)
```

Any attempt to write an invalid transition (e.g. `completed → pending`) raises a Mongoose validation error.

### Idempotency on Payment Initiation
Unique sparse index on `metadata.orchestratorIdempotencyKey` prevents two concurrent requests from creating two Razorpay orders for the same checkout session. Double-checked after acquiring the Redis lock (double-checked locking pattern).

### IDOR Guard on Refunds
`processRefund` verifies that the `payment.user` matches the calling user ID. Non-admin callers cannot refund another user's payment. A warning is logged for every IDOR attempt.

### Internal Auth
`requireInternalToken` middleware — scoped token map from `INTERNAL_SERVICE_TOKENS_JSON`, timing-safe comparison.

### Webhook Raw Body
`express.raw({ type: 'application/json', limit: '1mb' })` is applied only to the two webhook paths in `index.ts`. All other paths use `express.json()`. This is critical — if you add new middleware that parses JSON before the webhook handler runs, signature verification will silently break.

---

## 7. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Consumer JWT signing secret (for `requireAuth` middleware) |
| `INTERNAL_SERVICE_TOKENS_JSON` | JSON map of caller service tokens for internal routes |

One of `INTERNAL_SERVICE_TOKENS_JSON` or `INTERNAL_SERVICE_TOKEN` must be set.

### Optional (but functionally important)

| Variable | Default | Description |
|----------|---------|-------------|
| `RAZORPAY_KEY_ID` | — | Razorpay API key ID. Without this, all payment initiations fail |
| `RAZORPAY_KEY_SECRET` | — | Razorpay API secret. Without this, signature verification always fails |
| `RAZORPAY_WEBHOOK_SECRET` | — | Razorpay webhook signing secret. Without this, all webhook calls are rejected |
| `RAZORPAY_CURRENCY` | `INR` | Default currency for Razorpay orders |
| `WALLET_SERVICE_URL` | — | URL of rez-wallet-service. Without this, coin credit after payment capture is skipped |
| `PORT` | `4001` | HTTP API port |
| `HEALTH_PORT` | `4101` | Sidecar health port |
| `NODE_ENV` | `production` | Environment label |
| `CORS_ORIGIN` | `https://rez.money` | Comma-separated allowed origins |
| `SENTRY_DSN` | — | Sentry DSN; omit to disable |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | Sentry trace sampling (0–1) |
| `SERVICE_NAME` | `rez-payment-service` | Service name in logs and Sentry |
| `INTERNAL_SERVICE_TOKEN` | — | Legacy single token (deprecated) |

---

## 8. Data Models

### `payments` collection (Payment model)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `paymentId` | string | Internal ID: `pay_<16-char hex>`. Unique index |
| `orderId` | string | REZ order reference. Indexed |
| `user` | ObjectId | Ref to User |
| `amount` | number | In rupees |
| `currency` | string | Default `INR` |
| `paymentMethod` | string | `upi`, `card`, `wallet`, `netbanking`, `stripe`, `razorpay`, `paypal` |
| `purpose` | string | `wallet_topup`, `order_payment`, `event_booking`, `financial_service`, `other` |
| `status` | string | FSM-controlled (see state machine above) |
| `userDetails.name` | string | |
| `userDetails.email` | string | |
| `userDetails.phone` | string | |
| `metadata` | Mixed | Free-form. Key fields: `razorpayOrderId`, `orchestratorIdempotencyKey`, `merchantId` |
| `gatewayResponse.gateway` | string | `razorpay` |
| `gatewayResponse.transactionId` | string | Razorpay payment ID (`pay_...`) |
| `gatewayResponse.source` | string | `webhook` when set by webhook handler |
| `failureReason` | string | Set on failed/expired |
| `walletCredited` | boolean | Whether coins were credited after capture |
| `walletCreditedAt` | Date | |
| `completedAt` | Date | |
| `failedAt` | Date | |
| `expiresAt` | Date | 30-min TTL from initiation. MongoDB TTL index expires non-completed payments. Cleared on completion |
| `refundedAmount` | number | Cumulative refunded amount |

**Indexes:**
- `{ paymentId: 1 }` unique
- `{ orderId: 1 }` 
- `{ user: 1, status: 1 }`
- `{ status: 1, createdAt: 1 }` — reconciliation queries
- `{ status: 1, updatedAt: 1 }` — stuck-processing queries
- `{ metadata.razorpayOrderId: 1 }` sparse — webhook lookup
- `{ metadata.merchantId: 1, status: 1, completedAt: -1 }` sparse — merchant settlements
- `{ metadata.orchestratorIdempotencyKey: 1 }` unique sparse — deduplication
- `{ expiresAt: 1 }` TTL index with `partialFilterExpression: { status: { $nin: ['completed'] } }` — auto-expires non-completed payments

### `transactionauditlogs` collection (TransactionAuditLog model)

Immutable record of every payment state transition.

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `action` | string | `initiate`, `capture`, `fail`, `refund`, `refund_confirmed`, `refund_failed`, `reconcile` |
| `paymentId` | string | |
| `userId` | string | |
| `merchantId` | string | Optional; set on refund |
| `amount` | number | |
| `previousStatus` | string | |
| `newStatus` | string | |
| `gatewayResponse` | Mixed | Raw gateway data |
| `metadata` | Mixed | Additional context |
| `createdAt` | Date | |

### Redis key schema

| Key pattern | Value | TTL | Purpose |
|-------------|-------|-----|---------|
| `pay:nonce:<razorpayPaymentId>` | `"1"` | 25 hours (90000 s) | Replay prevention |
| `payment:init:<orderId>` | UUID token | 10 seconds | Initiation concurrency lock |

---

## 9. Local Development

### Prerequisites
- Node.js >= 20
- MongoDB (replica set for transactions, though payment capture uses `session.withTransaction()`)
- Redis
- A Razorpay test account (key ID + secret from Razorpay dashboard Test mode)

### Setup
```bash
cd rez-payment-service
npm install
# Create .env
npm run dev
```

**Minimal `.env` for local dev**
```env
MONGODB_URI=mongodb://localhost:27017/rez?replicaSet=rs0
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-consumer
INTERNAL_SERVICE_TOKENS_JSON={"rez-test-service":"dev-internal-token"}
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXX
RAZORPAY_KEY_SECRET=test_secret_XXXXXXXXXX
RAZORPAY_WEBHOOK_SECRET=test_webhook_secret
PORT=4001
```

Without `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`, the service starts and logs a warning but payment initiations will fail at the Razorpay SDK call.

### Webhook testing locally
Use the [Razorpay webhook simulator](https://dashboard.razorpay.com/app/webhooks) or ngrok:
```bash
ngrok http 4001
# In Razorpay dashboard, add webhook URL: https://<ngrok-subdomain>.ngrok.io/pay/webhook/razorpay
```

### Testing reconciliation jobs immediately
The cron jobs run on a schedule. To trigger them manually:
```typescript
import { runReconciliation, recoverStuckPayments } from './src/services/reconciliationService';
await runReconciliation();
await recoverStuckPayments();
```

### Build and lint
```bash
npm run build    # tsc
npm run lint     # tsc --noEmit
npm test         # node --test test
```

---

## 10. Common Errors and Troubleshooting

### `RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET required`
Thrown when `createOrder` or any Razorpay call is attempted without credentials. Set both env vars. The service starts without them (with a warning) but all payment initiations fail.

### `RAZORPAY_WEBHOOK_SECRET required`
Thrown during webhook signature verification. The webhook always returns 400 without this var. Ensure it matches the webhook secret set in the Razorpay dashboard.

### `Invalid payment signature` on capture
Three possible causes:
1. Client passed wrong values for `razorpayOrderId`, `razorpayPaymentId`, or `razorpaySignature`
2. `RAZORPAY_KEY_SECRET` env var does not match the key used to create the order
3. Signature was computed by the client incorrectly (should be `HMAC-SHA256(orderId + "|" + paymentId, keySecret)`)

### `Amount mismatch: expected X, got Y`
The amount the client sent in `POST /pay/initiate` does not match `orders.totals.total` for that `orderId`. Either the order was updated after the client loaded the checkout page, or the client attempted to pass a lower amount. Refresh the order total on the client and retry.

### `Authoritative order amount not found`
The `orderId` provided in `POST /api/razorpay/create-order` does not exist in the `orders` MongoDB collection. Confirm the correct `orderId` is being passed (it can be the MongoDB `_id`, `orderId` string field, or `orderNumber` field).

### `A payment initiation for this order is already in progress`
The Redis initiation lock (`payment:init:<orderId>`) is held by another concurrent request. This is expected on double-taps. The client should wait 1–2 seconds and retry. If this error persists beyond 10 seconds (the lock TTL), the lock was not released cleanly — check Redis for the key.

### `Payment already captured` (409) on a valid payment
The `pay:nonce:<razorpayPaymentId>` key already exists in Redis. Causes:
1. The client double-submitted the capture request
2. The request previously succeeded but the client didn't receive the response (network timeout)

In case 2, fetch the payment status via `GET /pay/status/:paymentId` — the payment is already `completed` and the order can proceed.

### Webhook events not updating payment status
1. Check `RAZORPAY_WEBHOOK_SECRET` matches the Razorpay dashboard exactly
2. Confirm the webhook URL is registered in Razorpay for the correct events (`payment.captured`, `payment.failed`, `refund.processed`, `refund.failed`)
3. Verify the request is reaching the service with a raw `Buffer` body — if any middleware parses it as JSON before the route handler, the HMAC will fail
4. Check the service logs for `Webhook: invalid signature rejected`

### Payments stuck in `processing` not being reconciled
The reconciliation job only picks up payments where `updatedAt < now - 30 minutes`. Check:
1. The cron job is running — look for `[cron] Reconciliation cron jobs scheduled` in startup logs
2. `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are set — the job calls `razorpay.getPaymentDetails()` for each stuck payment and will silently skip any payment that errors
3. The `gatewayResponse.transactionId` field is set on the stuck payment — if it's null the job skips it

### `Invalid payment transition: completed → pending`
A Mongoose pre-save hook enforces the state machine. Something in the codebase is trying to move a completed payment back to pending. Check the code path and use `updateOne` with a filter on the current status rather than fetching, modifying, and saving.

### Reconciliation job crashing the process
The `runReconciliation` and `recoverStuckPayments` functions are wrapped in try/catch inside the cron callbacks. Individual payment errors are caught and logged. If the entire cron callback throws, it is caught at the top level and logged without crashing the process. If you see the service crash every 15 minutes, look for an uncaught exception outside the reconciliation logic (e.g. a MongoDB connection error that throws synchronously).
