# analytics-events

## 1. Purpose, Tech Stack, and Architecture Position

**Purpose:** Dual-role service handling (a) real-time analytics event ingestion and persistence from the consumer app and web menu, and (b) nightly merchant analytics aggregation with peer benchmarking. It is the analytics backbone of the REZ platform. All merchant dashboard data flows through this service.

**Architecture position:** Phase C extraction from the REZ monolith using the Strangler Fig pattern. Runs two concurrent processes in one Node.js process:
- A **BullMQ worker** consuming the `analytics-events` queue (events published by the monolith and other services).
- A **BullMQ nightly scheduler** (`merchant-aggregation-scheduler`) that aggregates per-merchant metrics at 2 AM UTC.
- An **Express HTTP API** serving merchant analytics and benchmark queries.

This service is called by:
- The consumer mobile app (batch event ingestion)
- `rez-web-menu` (web event ingestion)
- The merchant dashboard backend (analytics summary and benchmarks)
- Other internal services via `X-Internal-Token`

**Tech stack:**

| Layer | Technology |
|---|---|
| Runtime | Node.js 20.x |
| Language | TypeScript 5.x |
| HTTP framework | Express 4 |
| Queue | BullMQ 5 (backed by Redis) |
| Database | MongoDB (Mongoose 7 / raw collection access) |
| Cache | Redis (ioredis 5) |
| Security | helmet |
| Observability | Winston, Sentry (`@sentry/node` 7), Prometheus-format `/metrics` endpoint |

---

## 2. API Routes

The HTTP server listens on `PORT` (default 3002).

### Authentication

Most routes require an `X-Internal-Token` header. The middleware (`requireInternalToken`) reads the scoped token map from `INTERNAL_SERVICE_TOKENS_JSON` (a JSON object mapping `serviceName → token`). The caller must also send `X-Internal-Service: <serviceName>`. Tokens are compared with `crypto.timingSafeEqual` to prevent timing attacks.

Two ingestion routes are **intentionally open** (no token required) because they receive high-volume fire-and-forget traffic from the consumer app and web.

---

### Event Ingestion — Web Events (open)

**POST `/api/analytics/web-events`**
Auth: none

Receives browser/web events from `rez-web-menu`. Fire-and-forget: always returns 200 immediately, then asynchronously writes to MongoDB. Write errors are silently swallowed (non-critical path).

Body:
```json
{
  "event": "page_view",
  "properties": { "path": "/home", "userId": "..." }
}
```

Response (immediate, before write):
```json
{ "success": true }
```

Written to collection: `webevents` — fields: `event`, `properties`, `receivedAt`.

---

### Event Ingestion — Batch App Events (open)

**POST `/api/analytics/batch`**
Auth: none

Receives batched events from the consumer mobile app's `analyticsService.ts`. Fire-and-forget: always returns 200, then bulk inserts to MongoDB. On insert failure, logs the drop count and continues.

Body:
```json
{
  "events": [
    {
      "name": "store_viewed",
      "properties": { "storeId": "..." },
      "userId": "user123",
      "sessionId": "sess456",
      "platform": "ios",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

Response: `{ "success": true }`

Written to collection: `appevents` — fields: `name`, `properties`, `userId`, `sessionId`, `platform`, `timestamp`, `receivedAt`.

---

### Merchant Analytics Summary

**GET `/api/analytics/merchant/:merchantId/summary`**
Auth: `X-Internal-Token` required

Query parameters:

| Param | Values | Default | Description |
|---|---|---|---|
| `period` | `Nd` (e.g. `7d`, `30d`), `1m`, `3m`, `1y` | `30d` | Lookback window. Max 365 days. |

Reads from the `merchantanalytics` collection (written by the nightly aggregation job). Aggregates across the date range and returns:

Response:
```json
{
  "success": true,
  "data": {
    "merchantId": "abc123",
    "period": "30d",
    "revenue": 152000,
    "visitors": 843,
    "topProducts": [
      { "productId": "...", "name": "Chicken Biryani", "revenue": 45000, "quantity": 300 }
    ],
    "newVsReturning": { "new": 512, "returning": 331, "ratio": 0.607 },
    "days": [
      { "date": "2024-01-15", "revenue": 5200, "visitors": 28 }
    ]
  }
}
```

Returns up to 10 top products sorted by revenue. `days` array is sorted ascending by date, one entry per day that has data.

---

### Merchant Coin Summary

**GET `/api/analytics/merchant/:merchantId/coin-summary`**
Auth: `X-Internal-Token` required

Query: `days` (1–90, default 30). Aggregates from the `cointransactions` collection (live, not the nightly rollup). Groups by store, returning coin distribution across the merchant's stores. In-memory cache, 5-minute TTL per `merchantId:days` key.

Validates that `merchantId` is a valid MongoDB ObjectId (400 otherwise).

Response:
```json
{
  "success": true,
  "data": {
    "merchantId": "...",
    "periodDays": 30,
    "totalTransactions": 412,
    "totalCoinsPaid": 20600,
    "topStores": [
      { "storeId": "...", "storeName": "...", "transactionCount": 150, "totalCoins": 7500 }
    ]
  }
}
```

---

### Platform Analytics Summary (admin)

**GET `/api/analytics/platform/summary`**
Auth: `X-Internal-Token` required

Query: `period` (same format as merchant summary). Aggregates the `merchantanalytics` collection across all merchants. Returns platform-wide revenue, visitors, top 10 merchants by revenue, new vs returning ratio, and daily trend array.

Response:
```json
{
  "success": true,
  "data": {
    "period": "30d",
    "revenue": 4500000,
    "visitors": 25000,
    "topMerchants": [{ "merchantId": "...", "revenue": 152000 }],
    "newVsReturning": { "new": 15000, "returning": 10000, "ratio": 0.6 },
    "days": [{ "date": "2024-01-15", "revenue": 150000, "visitors": 832 }]
  }
}
```

---

### Merchant Benchmarks

**GET `/benchmarks/:merchantId`**
Auth: `X-Internal-Token` required

Returns how the merchant compares against their anonymized peer group (same city + cuisine + size category). Peers must number at least 10 — below that threshold, returns `insufficient_data: true`.

`merchantId` must be at least 3 characters (string; not necessarily an ObjectId).

Response (sufficient data):
```json
{
  "success": true,
  "data": {
    "merchantId": "abc123",
    "peerGroup": {
      "city": "bangalore",
      "cuisineType": "indian",
      "sizeCategory": "medium",
      "merchantCount": 24
    },
    "foodCostPct": { "value": 32.5, "peerAvg": 35.1, "percentile": 72 },
    "avgOrderValue": { "value": 485, "peerAvg": 412, "percentile": 65 },
    "staffCostPct": { "value": 18.0, "peerAvg": 22.3, "percentile": 68 },
    "monthlyRevenue": { "value": 485000, "peerAvg": 310000, "percentile": 78 },
    "repeatCustomerRate": { "value": 44.2, "peerAvg": 38.6, "percentile": 61 },
    "computedAt": "2024-01-15T02:15:00Z"
  }
}
```

Response (insufficient peer data):
```json
{
  "success": true,
  "data": null,
  "insufficient_data": true,
  "message": "Not enough peer data for your city/cuisine combination — minimum 10 restaurants required"
}
```

**Percentile interpretation:** For cost metrics (`foodCostPct`, `staffCostPct`), percentile is inverted — a higher percentile means you beat more peers (lower cost is better). For revenue/AOV/repeat rate metrics, higher percentile = better.

**Caching:** Results are cached in-process for 1 hour per `merchantId`.

---

### Peer Group Stats

**GET `/benchmarks/peer-group?city=bangalore&cuisine=indian`**
Auth: `X-Internal-Token` required

Returns anonymized aggregate statistics for a city + cuisine peer group. Individual merchant data is never exposed. Returns `insufficient: true` when fewer than 10 merchants qualify.

Both `city` and `cuisine` are required. Validation: only `[a-z0-9 \-]` characters allowed (400 otherwise).

Response:
```json
{
  "success": true,
  "data": {
    "city": "bangalore",
    "cuisineType": "indian",
    "merchantCount": 24,
    "avgFoodCostPct": 35.1,
    "avgOrderValue": 412,
    "avgStaffCostPct": 22.3,
    "avgMonthlyRevenue": 310000,
    "avgRepeatCustomerRate": 38.6,
    "insufficient": false
  }
}
```

Cached in-process for 1 hour per `city:cuisine` key.

---

### Prometheus Metrics

**GET `/metrics`**
Auth: none (assumed internal network only)

Returns Prometheus text exposition format.

Metrics exposed:
- `process_uptime_seconds` — process uptime gauge
- `http_requests_total` — total HTTP requests counter
- `http_errors_total` — total 5xx responses counter

---

### Health Check

The service starts a separate health server on `HEALTH_PORT` (default 3102). See the `startHealthServer` function in `src/health.ts`.

---

## 3. Background Workers and Jobs

### Analytics Events Worker

**Queue consumed:** `analytics-events`
**Concurrency:** 15 workers
**Rate limit:** 500 jobs/second

Processes `AnalyticsQueueEvent` messages:

```typescript
interface AnalyticsQueueEvent {
  eventId: string;
  eventType: string;
  userId: string;
  data: {
    entityId?: string;
    entityType?: string;
    amount?: number;
    storeId?: string;
    category?: string;
    source?: string;
    metadata?: Record<string, any>;
  };
  sourceEventId?: string;
  createdAt: string;
}
```

Processing steps per event:
1. **Idempotent upsert** to `analyticsevents` collection using `eventId` as the dedup key (`$setOnInsert`). E11000 duplicate key errors are treated as success (safe retry).
2. **Daily metric roll-up** — increments `count` and `totalAmount` in `dailymetrics` collection keyed by `{ date, eventType }`.

On failure: BullMQ retries with default backoff. Permanently failed jobs are logged but not dead-lettered (no DLQ in this worker).

---

### Merchant Aggregation Scheduler (nightly)

**Queue:** `merchant-aggregation-scheduler`
**Schedule:** `0 2 * * *` — 2:00 AM UTC daily
**Job name:** `merchant-aggregation-nightly`
**Retry:** 2 attempts, exponential backoff starting at 30 seconds
**Concurrency:** 1 (single worker instance)

The scheduler uses BullMQ's `upsertJobScheduler` so the repeatable job definition is idempotent — safe to restart the service.

**What it does:**

For the current date, it fetches all distinct `merchantId` values from `stores` where `isActive: true`, then processes them in batches of 10 concurrently using `Promise.allSettled` (individual merchant failures do not abort the batch).

For each merchant, three aggregations run in parallel:

1. **Daily revenue** — sums `amount` from `storepayments` where `{ merchantId, status: 'success', createdAt: <today> }`.

2. **Visitor stats** — from `storevisits` for the current month:
   - Groups by `userId` to get unique visitor count.
   - Cross-references prior visits before this month to classify each visitor as new vs returning.
   - Stores per-user visit frequency (top 100 users).

3. **Top products** — unwinds `items` from `posbills` (paid bills for today), groups by product, sums revenue and quantity, returns top 10 by revenue.

All three results are upserted to `merchantanalytics` with key `{ merchantId, date }`.

The job result (`{ merchants: N, date: "YYYY-MM-DD" }`) is logged on completion.

---

## 4. Security Mechanisms

| Mechanism | Detail |
|---|---|
| Internal token auth | All analytics query routes (`/api/analytics/*`, `/benchmarks/*`) require `X-Internal-Token`. Token is validated per-service using `INTERNAL_SERVICE_TOKENS_JSON`. Timing-safe comparison via `crypto.timingSafeEqual`. Returns 503 if the env var is not set (misconfiguration guard). |
| Open ingestion endpoints | `/api/analytics/web-events` and `/api/analytics/batch` are intentionally open — they accept writes from untrusted clients. No secrets are embedded in responses. Write errors are silently ignored (no data leakage). |
| Helmet | Sets standard security HTTP headers. |
| Input sanitisation (benchmarks) | `city` and `cuisine` query params are validated against `/^[a-z0-9 \-]+$/` before use in MongoDB regex to prevent ReDoS. `merchantId` must be >= 3 characters. |
| Anonymization pipeline | Before any peer data is used in benchmarking, `merchantId` is replaced with a deterministic HMAC-SHA256 opaque key using `ANONYMIZATION_SALT`. Customer PII fields (`customerId`, `customerName`, `customerEmail`) are stripped. Any remaining string fields matching email or phone patterns are also dropped. Individual merchant data is never returned via peer-group endpoints. |
| Minimum peer group size | `BenchmarkEngine` enforces a minimum of 10 merchants in a peer group before returning comparison data. Below this threshold, `null` is returned. |
| Sentry | Error monitoring with `SENTRY_DSN`. |

---

## 5. Environment Variables

### Required

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string. Shared with the monolith — must point to the same database. |
| `REDIS_URL` | Redis connection URL. Used by BullMQ for queues. |
| `INTERNAL_SERVICE_TOKENS_JSON` | JSON object mapping service names to their shared secrets. Example: `{"merchant-dashboard":"secret1","rez-admin":"secret2"}` |

### Optional

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3002` | HTTP API listen port. |
| `HEALTH_PORT` | `3102` | Separate health-check server port. |
| `NODE_ENV` | `development` | Sets Sentry environment. |
| `SENTRY_DSN` | unset | Sentry DSN. Sentry initialises only when set. |
| `ANONYMIZATION_SALT` | `rez-benchmark-anon-salt` | HMAC salt for merchant ID anonymization. **Change this in production.** Salt rotation invalidates existing anonymized keys (benchmark grouping resets). |

---

## 6. Data Models

All collections are shared with the monolith. Access is via raw `mongoose.connection.collection()`.

### `analyticsevents` (written by this service)

| Field | Type | Notes |
|---|---|---|
| `eventId` | string | Unique dedup key. Unique index recommended. |
| `eventType` | string | e.g. `store_viewed`, `order_placed` |
| `userId` | string | |
| `data` | object | `{ entityId, entityType, amount, storeId, category, source, metadata }` |
| `sourceEventId` | string | Optional upstream event ID |
| `processedAt` | Date | When this service persisted it |
| `createdAt` | Date | Original event timestamp |

**Required index:** `{ eventId: 1 }` unique.

### `dailymetrics` (written by this service)

| Field | Type | Notes |
|---|---|---|
| `date` | string | `YYYY-MM-DD` |
| `eventType` | string | |
| `count` | number | Incremented per event |
| `totalAmount` | number | Summed from `data.amount` |

**Required index:** `{ date: 1, eventType: 1 }` unique.

### `merchantanalytics` (written by nightly job, read by HTTP routes and BenchmarkEngine)

| Field | Type | Notes |
|---|---|---|
| `merchantId` | string | |
| `date` | string | `YYYY-MM-DD` |
| `revenue` | number | Daily revenue from `storepayments` |
| `uniqueVisitors` | number | |
| `newCustomers` | number | |
| `returningCustomers` | number | |
| `newVsReturningRatio` | number | `newCustomers / uniqueVisitors` |
| `topProducts` | array | `[{ productId, name, revenue, quantity }]` top 10 |
| `visitFrequency` | array | `[{ userId, visits }]` top 100 |
| `computedAt` | Date | When the job ran |
| `city` | string | Copied from merchant/store data (used by BenchmarkEngine) |
| `cuisineType` | string | Copied from merchant/store data |
| `orderCount` | number | Used by BenchmarkEngine for size classification |
| `foodCostAmount` | number | Used by BenchmarkEngine |
| `staffCostAmount` | number | Used by BenchmarkEngine |

**Required index:** `{ merchantId: 1, date: 1 }` unique.

### `webevents` (written by web-events endpoint)

| Field | Type | Notes |
|---|---|---|
| `event` | string | Event name |
| `properties` | object | Arbitrary event properties |
| `receivedAt` | Date | |

### `appevents` (written by batch endpoint)

| Field | Type | Notes |
|---|---|---|
| `name` | string | Event name |
| `properties` | object | |
| `userId` | string | |
| `sessionId` | string | |
| `platform` | string | `'mobile'` default |
| `timestamp` | Date | Original client timestamp |
| `receivedAt` | Date | Server receipt time |

### Source collections (read-only)

| Collection | Purpose |
|---|---|
| `storepayments` | Revenue aggregation — filtered by `{ merchantId, status: 'success' }` |
| `storevisits` | Visitor stats — filtered by `{ merchantId, createdAt }` |
| `posbills` | Top products — filtered by `{ merchantId, status: 'paid' }` |
| `stores` | Merchant enumeration — `distinct('merchantId', { isActive: true })` |
| `cointransactions` | Coin summary — filtered by `{ merchantId, createdAt }` |

---

## 7. Local Development and Testing

### Prerequisites

- Node.js 20.x
- MongoDB (shared with monolith, or a seeded local copy)
- Redis

### Setup

```bash
cd analytics-events
cp .env.example .env      # if absent, create manually
npm install
```

Minimum `.env`:
```
MONGODB_URI=mongodb://localhost:27017/rez
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKENS_JSON={"dev-client":"dev-secret"}
```

### Run in development

```bash
npm run dev           # ts-node src/index.ts
```

Service starts:
- HTTP API on `http://localhost:3002`
- Health server on `http://localhost:3102`
- BullMQ analytics-events worker
- BullMQ nightly scheduler (registers the 2 AM cron job)

### Build and run compiled

```bash
npm run build && npm start
```

### Type-check

```bash
npm run lint          # tsc --noEmit
```

### Calling protected routes locally

```bash
curl -H "X-Internal-Token: dev-secret" \
     -H "X-Internal-Service: dev-client" \
     "http://localhost:3002/api/analytics/merchant/abc123/summary?period=7d"
```

### Triggering the nightly job manually

The job scheduler registers a repeatable job in BullMQ. To trigger it immediately without waiting for 2 AM, use a BullMQ admin UI (e.g. Bull Board) or add a job directly to the queue:

```js
const { Queue } = require('bullmq');
const q = new Queue('merchant-aggregation-scheduler', {
  connection: { host: 'localhost', port: 6379 }
});
await q.add('merchant_aggregation_run', {});
```

### Posting test events

```bash
# Batch events
curl -X POST http://localhost:3002/api/analytics/batch \
  -H "Content-Type: application/json" \
  -d '{"events":[{"name":"store_viewed","userId":"u1","platform":"ios","timestamp":"2024-01-15T10:00:00Z"}]}'

# Web event
curl -X POST http://localhost:3002/api/analytics/web-events \
  -H "Content-Type: application/json" \
  -d '{"event":"page_view","properties":{"path":"/home"}}'
```

---

## 8. Troubleshooting

**Service won't start — worker or scheduler fails to connect**
Redis must be reachable at `REDIS_URL`. BullMQ requires Redis >= 6.2. Check with `redis-cli ping`.

**`GET /benchmarks/:merchantId` always returns `insufficient_data: true`**
The `merchantanalytics` collection needs at least 10 records for other merchants in the same `city` and `cuisineType` as the target merchant. In development, seed test data or lower `MIN_PEER_GROUP_SIZE` temporarily (hardcoded to 10 in `BenchmarkEngine.ts`).

**`GET /benchmarks/:merchantId` returns `null` (no data at all)**
The merchant has no records in `merchantanalytics` for the last 30 days. Either the nightly job has not run yet, or the merchant has no activity in `storepayments` / `storevisits`. Trigger the job manually (see above).

**Nightly job not running**
Confirm the BullMQ repeatable job was registered: connect to Bull Board or inspect Redis: `redis-cli ZRANGE "bull:merchant-aggregation-scheduler:repeat" 0 -1 WITHSCORES`. The job should appear with a next-run timestamp. If the service crashed at startup before `startMerchantAggregationScheduler()` completed, restart cleanly.

**`/api/analytics/merchant/:id/summary` returns an empty `days` array**
The nightly aggregation has not yet run for the requested date range. The `merchantanalytics` collection is populated only by the 2 AM job; real-time data is not backfilled. This is expected for a freshly deployed environment.

**Internal token authentication failing (401)**
- Confirm `INTERNAL_SERVICE_TOKENS_JSON` is valid JSON.
- Confirm the caller is sending both `X-Internal-Token` and `X-Internal-Service` headers.
- The service name in `X-Internal-Service` must exactly match a key in `INTERNAL_SERVICE_TOKENS_JSON`.
- The service returns 503 (not 401) when `INTERNAL_SERVICE_TOKENS_JSON` is not set at all.

**Batch events being dropped / logged as failed**
The batch endpoint catches insert errors and logs them at error level but still returns 200. Check logs for `[batch] insertMany failed`. The most common cause is a schema validation error on the `appevents` collection if validation was added on the MongoDB side.

**Anonymization salt warning**
If `ANONYMIZATION_SALT` is not set, the service falls back to the hardcoded default `rez-benchmark-anon-salt`. This means merchant anonymized keys are predictable in any environment using the default. Set a unique salt per environment in production.

**High memory usage**
The `benchmarkCache` and `peerGroupCache` Maps are module-level and never evicted — they only expire (1-hour TTL checked on access). On a large platform with thousands of merchants, these maps can grow. If this becomes an issue, replace with Redis-backed caching.
