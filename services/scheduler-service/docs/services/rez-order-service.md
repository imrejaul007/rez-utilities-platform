# rez-order-service

## 1. Purpose

rez-order-service is the dedicated order lifecycle microservice for the REZ platform. It owns:

1. **HTTP API** — Provides order reads, status updates, cancellation, an SSE real-time stream for the merchant dashboard, and a 30-day spend summary endpoint consumed by the wallet/payment eligibility flow.

2. **BullMQ worker** — Consumes `order-events` and handles asynchronous side effects: cache invalidation, settlement triggering (via `wallet-events`), cancellation notifications (via `notification-events`), and delivery tracking hooks.

The service is a **Phase C Strangler Fig extraction** from the REZ backend monolith. It reads and writes the shared `orders` MongoDB collection using `strict: false` models, meaning it stays schema-agnostic and forward-compatible with any monolith schema changes.

**Current deployment status:** The HTTP server is implemented and production-ready but has not yet been promoted to a Render web service. The BullMQ worker is the primary deployed component. Port 4005 is reserved for when the HTTP server is promoted.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20.x |
| Language | TypeScript 5.9 |
| HTTP framework | Express 4.21 |
| Database | MongoDB (shared collection via Mongoose `strict: false`) |
| Queue (consume) | BullMQ 5 — `order-events` |
| Queue (produce) | BullMQ 5 — `wallet-events`, `notification-events` |
| Queue broker | Redis via ioredis 5 |
| Security | Helmet, CORS (configurable) |
| Observability | Winston (logging), Sentry 7, W3C traceparent |
| Build | tsc |

---

## 3. Architecture

```
                  ┌─────────────────────────────────────────────┐
                  │            rez-order-service                 │
                  │                                              │
rezbackend ───────┤──► POST /api/orders (written by monolith)   │
                  │                                              │
Internal callers  │                                              │
(X-Internal-Token)│──► GET  /orders (list)                      │──► MongoDB
                  │──► GET  /orders/stream (SSE)                 │
                  │──► GET  /orders/:id                          │
                  │──► PATCH /orders/:id/status                  │
                  │──► POST  /orders/:id/cancel                  │
                  │──► GET  /orders/summary/:userId              │
                  │                                              │
BullMQ worker ◄───┤── consumes: order-events                    │──► Redis
                  │── produces: wallet-events                    │
                  │── produces: notification-events              │
                  └─────────────────────────────────────────────┘
```

**Who calls this service:**
- The rezbackend monolith creates orders in MongoDB directly. The order-service is called by internal services (payment, wallet, merchant dashboard) to read order state and advance status.
- The merchant dashboard connects to `/orders/stream` via SSE for real-time order feed.

**What this service calls:**
- MongoDB `orders` collection (reads and status updates via `findOneAndUpdate`).
- Redis/BullMQ: publishes to `wallet-events` (settlement on delivery) and `notification-events` (cancellation push notification).

**Auth model:** Every route below `/health` requires `X-Internal-Token`. There are no public endpoints except health checks. This service is never directly exposed to consumers.

---

## 4. All API Routes

### 4.1 Health (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health/live` | Liveness probe: always 200 if process is alive |
| GET | `/health` | Shallow health: checks MongoDB connection state |
| GET | `/health/ready` | Deep readiness: checks MongoDB + Redis (pings both) |

**Readiness response (ready):**
```json
{
  "status": "ready",
  "service": "rez-order-service",
  "checks": { "mongodb": "ok", "redis": "ok" },
  "uptime": 123.4,
  "timestamp": "2026-04-08T12:00:00.000Z"
}
```

---

### 4.2 All routes below require `X-Internal-Token`

The `requireInternalToken` middleware is applied at the application level with `app.use(requireInternalToken)` — it runs for every route after the health probes.

---

### 4.3 Order Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/orders/summary/:userId` | Internal | 30-day spend summary for a user |
| GET | `/internal/orders/summary/:userId` | Internal | Alias for the above (both handlers point to the same function) |

**Query:** Aggregates over the last 30 days. Only orders in status `confirmed`, `preparing`, `ready`, `out_for_delivery`, `delivered`, `partially_refunded`, or `refunded` are counted (pending/cancelled orders are excluded).

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSpend30d": 4250.00,
    "orderCount30d": 12,
    "avgOrderValue": 354.17,
    "paymentHistory": 1
  }
}
```

`paymentHistory` is `1` if the user has any qualifying orders in the window, `0` otherwise. This is used by the wallet service to determine payment eligibility.

**Amount resolution:** The aggregation uses `$ifNull` to handle both `totals.total` and `totals.paidAmount` field shapes, ensuring compatibility with both old and new order document formats.

---

### 4.4 List Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/orders` | Internal | Paginated order list |

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `merchantId` | string (ObjectId) | Filter by merchant |
| `userId` | string (ObjectId) | Filter by customer |
| `status` | string | Filter by status (validated against VALID_STATUSES enum) |
| `page` | number | Default 1 |
| `limit` | number | Default 20, max 100 |

**Response:**
```json
{
  "success": true,
  "data": [...],
  "total": 148,
  "page": 1,
  "limit": 20
}
```

---

### 4.5 SSE Order Stream

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/orders/stream` | Internal | Server-Sent Events stream for merchant dashboard |

**Query parameters:** `merchantId` (required, ObjectId)

**Important:** This route is registered **before** `GET /orders/:id`. If registered after, Express would match `/orders/stream` as `{ id: "stream" }` and the `:id` handler would return `400 Invalid order id`.

**Behaviour:**

- Sends an immediate `{ connected: true }` event on connection.
- Polls MongoDB every **3 seconds** for orders in status `placed`, `confirmed`, `preparing` belonging to the merchant.
- Sends a `heartbeat` (`: ping\n\n`) every **15 seconds** to keep the connection alive through proxies.
- After **5 minutes** (OS-01 cap), sends a `reconnect` event and closes the connection. The client is expected to reconnect.
- On client disconnect (`req.on('close')`), all timers and intervals are cleared.

**SSE event format:**
```
data: {"connected":true}

data: {"orders":[...],"timestamp":"2026-04-08T12:00:03.000Z"}

: ping

event: reconnect
data: {"reason":"max_lifetime"}
```

**Response headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

`X-Accel-Buffering: no` disables nginx proxy buffering, which would otherwise buffer SSE events and cause the stream to appear stalled.

---

### 4.6 Single Order

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/orders/:id` | Internal | Fetch a single order by MongoDB ObjectId |

Returns `400` if `:id` is not a valid ObjectId, `404` if not found.

---

### 4.7 Update Order Status

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | `/orders/:id/status` | Internal | Advance order through the state machine |

**Request body:**
```json
{ "status": "confirmed" }
```

**State machine — valid transitions:**

| Current status | Allowed next statuses |
|---------------|----------------------|
| `placed` | `confirmed`, `cancelled`, `cancelling` |
| `confirmed` | `preparing`, `cancelled`, `cancelling` |
| `preparing` | `ready`, `cancelled`, `cancelling` |
| `ready` | `dispatched`, `cancelled`, `cancelling` |
| `dispatched` | `out_for_delivery`, `delivered`, `cancelled` |
| `out_for_delivery` | `delivered`, `cancelled` |
| `delivered` | `returned`, `refunded` |
| `cancelling` | `cancelled`, `placed`, `confirmed`, `preparing`, `ready` |
| `cancelled` | `refunded` |
| `returned` | `refunded` |
| `refunded` | *(terminal)* |

**Timestamp fields set automatically:**

When status is advanced, the corresponding timestamp field is written to the document:

| Status | Field written |
|--------|--------------|
| `confirmed` | `confirmedAt` |
| `preparing` | `preparingAt` |
| `ready` | `readyAt` |
| `dispatched` | `dispatchedAt` |
| `out_for_delivery` | `outForDeliveryAt` |
| `delivered` | `deliveredAt` |
| `cancelled` | `cancelledAt` |
| `returned` | `returnedAt` |
| `refunded` | `refundedAt` |

**Optimistic concurrency control:**

The `findOneAndUpdate` filter includes `{ _id, status: currentStatus }`. If another request has already changed the status between the read and the write, the update returns `null` and the service responds with:

```json
{
  "success": false,
  "message": "Concurrent update conflict: order status is now 'confirmed', not 'placed'",
  "currentStatus": "confirmed"
}
```
HTTP status: `409 Conflict`.

**Audit log:** Every status change is written to Winston as `[OrderAudit] status_update` with orderId, from/to statuses, correlationId, requestId, and IP.

**Error responses:**

| Condition | Status | Message |
|-----------|--------|---------|
| Missing status | 400 | `status field is required` |
| Invalid status value | 400 | `Invalid status. Must be one of: ...` |
| Invalid ObjectId | 400 | `Invalid order id` |
| Order not found | 404 | `Order not found` |
| Forbidden transition | 422 | `Cannot transition from 'X' to 'Y'` + `allowedTransitions` |
| Concurrent conflict | 409 | `Concurrent update conflict` + `currentStatus` |

---

### 4.8 Cancel Order

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/orders/:id/cancel` | Internal | Cancel an order (shortcut that bypasses the full state machine for common cancellation) |

**Request body (optional):**
```json
{ "reason": "Customer requested cancellation" }
```

Only orders in `placed`, `confirmed`, `preparing`, or `ready` may be cancelled via this endpoint. Orders in `dispatched`, `out_for_delivery`, `delivered`, or terminal states return `422`.

Uses the same optimistic concurrency pattern as the status update endpoint: the `findOneAndUpdate` filter includes the current status. Returns `409` on conflict.

**Audit log:** Written as `[OrderAudit] order_cancelled` with orderId, reason, correlationId, requestId, and IP.

---

## 5. Background Jobs / Workers

### Queue consumed: `order-events`

**Concurrency:** 10 concurrent jobs. **Rate limit:** 300 jobs/second.

**Event types and handlers:**

| Event type | Handler |
|-----------|---------|
| Any event | Invalidates merchant dashboard cache: `merchant:orders:<merchantId>`, `merchant:revenue:<merchantId>`, `store:orders:<storeId>` |
| Any event | Invalidates customer cache: `user:orders:<userId>`, `user:recent-orders:<userId>` |
| `order.shipped`, `order.out_for_delivery`, `order.delivered` | Logs delivery tracking update (future: wire to delivery tracking service) |
| `order.delivered` | Publishes `wallet.merchant_settlement` event to `wallet-events` queue (5 retry attempts, exponential backoff starting at 10s) |
| `order.cancelled` | Publishes `order_cancelled` notification to `notification-events` queue (3 retry attempts, exponential backoff starting at 5s) |

**Settlement event published on delivery:**
```json
{
  "eventId": "settlement:<orderId>:<timestamp>",
  "eventType": "wallet.merchant_settlement",
  "userId": "<userId>",
  "merchantId": "<merchantId>",
  "payload": {
    "amount": 450.00,
    "source": "order_delivery",
    "description": "Settlement for order ORD-001234",
    "referenceId": "<orderId>",
    "referenceModel": "Order"
  },
  "createdAt": "2026-04-08T12:00:00.000Z"
}
```

The `jobId` is set to `settlement:<orderId>:<timestamp>` to make jobs idempotent — BullMQ deduplicates jobs with the same ID if the first is still in the queue.

**Cancellation notification published:**
```json
{
  "eventId": "notif:cancel:<orderId>",
  "eventType": "order_cancelled",
  "userId": "<userId>",
  "channels": ["push", "in_app"],
  "payload": {
    "title": "Order Cancelled",
    "body": "Your order was cancelled: <reason>",
    "data": { "orderId": "...", "orderNumber": "ORD-001234", "screen": "OrderDetail" },
    "channelId": "orders",
    "priority": "high"
  },
  "category": "orders",
  "source": "order-worker"
}
```

**Failure behaviour (OS-06):** If any handler throws, the worker re-throws the error. BullMQ marks the job as failed and schedules a retry based on the worker configuration. This ensures settlement and notification events are not silently dropped.

**OrderEvent shape:**
```typescript
{
  eventId: string;
  eventType: string;
  userId: string;
  merchantId?: string;
  storeId?: string;
  payload: {
    orderId: string;
    orderNumber?: string;
    previousStatus?: string;
    newStatus?: string;
    amount?: number;
    items?: Array<{ productId: string; name: string; quantity: number; price: number }>;
    cancelReason?: string;
    refundAmount?: number;
  };
  createdAt: string;  // ISO 8601
}
```

---

## 6. Security Mechanisms

### 6.1 Internal Token Authentication (`src/middleware/internalAuth.ts`)

All routes except `/health`, `/health/live`, and `/health/ready` require:
```
X-Internal-Token: <token>
X-Internal-Service: <service-name>
```

The middleware uses `INTERNAL_SERVICE_TOKENS_JSON` (scoped per-service map). `crypto.timingSafeEqual` is used for comparison to prevent timing attacks. Returns `401` on invalid token, `503` if the env var is not configured.

The auth middleware is applied at the application level (`app.use(requireInternalToken)`) after health routes are registered, ensuring health probes always pass without a token.

### 6.2 HTTP Security Headers

Helmet is applied globally.

### 6.3 CORS

CORS is configured with `CORS_ORIGIN` (comma-separated list). Defaults to `https://rez.money`. Credentials are allowed. This primarily matters for the SSE stream endpoint, which may be opened from the merchant dashboard web application.

### 6.4 Optimistic Concurrency

All write operations (status update, cancel) include the current order status in the MongoDB update filter. This prevents two concurrent requests from both succeeding on the same document — the second write will find no matching document and return a `409 Conflict` response with the current state, allowing the caller to retry with correct information.

### 6.5 State Machine Enforcement

The transition table is defined inline in `httpServer.ts`. Every status update is validated against this table before any database write. Terminal states (`refunded`) have an empty allowed-transition list, making them truly final.

---

## 7. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string (shared DB with monolith) |
| `REDIS_URL` | Yes | Redis URL for BullMQ queues |
| `INTERNAL_SERVICE_TOKENS_JSON` | Yes* | JSON map `{ serviceName: token }` for internal auth |
| `INTERNAL_SERVICE_TOKEN` | Yes* | Fallback token (validated at startup, not used at runtime) |
| `PORT` | No | HTTP listen port (default: `3006` in combined mode, `4005` in httpServer standalone) |
| `HEALTH_PORT` | No | Secondary health-only server port. Starts only if > 0. |
| `CORS_ORIGIN` | No | Comma-separated allowed CORS origins (default: `https://rez.money`) |
| `REDIS_TLS` | No | Set to `"true"` to enable TLS on Redis connection |
| `SENTRY_DSN` | No | Sentry DSN for error reporting |
| `NODE_ENV` | No | Environment label |

*One of the two token env vars must be present at startup validation, but only `INTERNAL_SERVICE_TOKENS_JSON` is consulted at runtime by `internalAuth.ts`.

---

## 8. Data Models

### Order (`orders` collection)

The service uses a `strict: false` Mongoose model (`OrderService_Order`) to read the monolith's `orders` collection without schema enforcement. The canonical order shape (as understood by the service) is:

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | MongoDB document ID |
| `orderNumber` | String | Human-readable order number (e.g., `ORD-001234`) |
| `user` | ObjectId | Ref: User |
| `merchant` | ObjectId | Ref: Merchant |
| `store` | ObjectId | Ref: Store |
| `items[]` | Array | productId, name, quantity, price |
| `totals` | Object | `total`, `paidAmount` (amount resolution uses `$ifNull` on both) |
| `status` | String | See state machine above |
| `payment` | Object | method, status, transactionId, paidAt |
| `cancelReason` | String | Set on cancellation |
| `cancelledAt` | Date | Set on cancellation |
| `confirmedAt`, `preparingAt`, `readyAt`, `dispatchedAt`, `outForDeliveryAt`, `deliveredAt`, `returnedAt`, `refundedAt` | Date | Set automatically on status transition |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

**Indexes:**
- `{ user: 1, createdAt: -1 }` — used by the 30-day summary aggregation
- `{ _id: 1 }` — explicit index for single-order lookup

---

## 9. Local Development

### Prerequisites

- Node.js 20.x
- MongoDB (shared DB with other services or local copy with `orders` collection)
- Redis

### Setup

```bash
cd rez-order-service

npm install

cat > .env << 'EOF'
MONGODB_URI=mongodb://localhost:27017/rez_dev
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKENS_JSON={"rezbackend":"dev_token","rez-merchant-service":"dev_token"}
PORT=4005
CORS_ORIGIN=http://localhost:3000
EOF
```

### Run modes

The service has three independent entrypoints:

```bash
# 1. HTTP server only (no BullMQ worker)
npm run dev
# or after build: npm start  (runs dist/httpServer.js)

# 2. BullMQ worker only
npm run dev:worker
# or after build: npm run start:worker  (runs dist/worker.js)

# 3. Combined (HTTP + worker, as in production)
# ts-node src/index.ts
# or after build: npm run start:combined  (runs dist/index.js)
```

In production on Render, the HTTP server and worker run in the same process via `dist/index.js` on port `3006` (the default from `index.ts`). When promoting to a standalone Render web service, the `dist/httpServer.js` entrypoint uses port `4005`.

### Build

```bash
npm run build
```

### Type-check

```bash
npm run lint
```

### Tests

```bash
npm test
# Uses Node's built-in test runner (node --test test/)
```

### Health checks

```bash
# Liveness (always 200)
curl http://localhost:4005/health/live

# Shallow health (MongoDB only)
curl http://localhost:4005/health

# Deep readiness (MongoDB + Redis)
curl http://localhost:4005/health/ready
```

### Test an order status update

```bash
curl -X PATCH http://localhost:4005/orders/<orderId>/status \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: dev_token" \
  -H "X-Internal-Service: rezbackend" \
  -d '{"status":"confirmed"}'
```

### Test the SSE stream

```bash
curl -N \
  -H "X-Internal-Token: dev_token" \
  -H "X-Internal-Service: rezbackend" \
  "http://localhost:4005/orders/stream?merchantId=<merchantId>"
```

---

## 10. Common Errors and Troubleshooting

### `401 Invalid internal token`

The `X-Internal-Token` header value does not match the token for the service named in `X-Internal-Service`. Both headers are required. Verify:
1. `INTERNAL_SERVICE_TOKENS_JSON` is valid JSON.
2. The key in the JSON matches the `X-Internal-Service` header value exactly.
3. The token value matches the `X-Internal-Token` header value exactly (no trailing newlines or spaces).

### `503 Internal auth not configured — set INTERNAL_SERVICE_TOKENS_JSON`

The `INTERNAL_SERVICE_TOKENS_JSON` env var is absent or empty. Set it before starting the service.

### `422 Cannot transition from 'X' to 'Y'`

The requested status is not reachable from the current status. The response includes `allowedTransitions`. Common mistakes:
- Skipping states (e.g., `placed` → `delivered` is not allowed; must pass through intermediate states).
- Trying to transition out of a terminal state (`refunded` → anything).

### `409 Concurrent update conflict`

Two requests tried to update the same order status simultaneously. The first write won. The response body includes the `currentStatus` after the conflict. Retry with the correct current state.

### SSE stream shows stale data / no updates after 5 minutes

The service closes SSE connections after 5 minutes (OS-01 cap) and sends a `reconnect` event. The client dashboard must handle this event and re-open the connection. If the client is not reconnecting, add an event listener:
```javascript
eventSource.addEventListener('reconnect', () => {
  eventSource.close();
  // Re-open after a short delay
  setTimeout(() => connectToStream(), 500);
});
```

### SSE stream not updating in browser despite nginx proxy

Set `X-Accel-Buffering: no` on the response (the service already does this). Also ensure nginx does not set `proxy_buffering on` for the SSE path. If behind an nginx reverse proxy, add:
```nginx
location /orders/stream {
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 310s;
}
```

### Worker not processing `order-events` jobs

1. Check Redis is reachable: `redis-cli -u $REDIS_URL ping`
2. Check the queue name — it must be exactly `order-events`.
3. Look for `[Worker] Error` logs. Common causes: Redis auth failures, TLS mismatches.
4. Verify `REDIS_TLS=true` if using a TLS-only Redis provider (e.g., Upstash).

### Settlement not triggered after order delivery

The worker publishes to `wallet-events` only when `eventType === 'order.delivered'`. Verify:
1. The event was published to `order-events` with `eventType: 'order.delivered'`.
2. The event payload includes `merchantId` (required for settlement).
3. Check for `[Worker] Job failed` logs — settlement enqueue failures cause the job to re-throw and BullMQ will retry.

### `400 Invalid userId` on `/orders/summary/:userId`

The `:userId` path param is not a valid 24-hex-char MongoDB ObjectId. Verify the caller is passing the MongoDB `_id` of the user document, not an application-level user identifier.

### Orders missing from summary despite existing in the database

The 30-day summary only counts orders with status in: `confirmed`, `preparing`, `ready`, `out_for_delivery`, `delivered`, `partially_refunded`, `refunded`. Orders in `placed`, `cancelling`, `cancelled`, or `returned` status are intentionally excluded. This matches payment eligibility criteria — only committed/successful orders count toward spend history.
