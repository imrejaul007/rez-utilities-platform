# rez-catalog-service

## 1. Purpose

rez-catalog-service is the read-optimised catalog API for the REZ platform. It gives consumers (the mobile app, the web menu, and aggregator integrations) a fast, consistent view of products and categories without adding read pressure to the merchant backend.

The service has two responsibilities:

1. **HTTP server** — Serves read-only catalog endpoints publicly and a small set of write endpoints exclusively to internal callers. All writes are protected by `X-Internal-Token`.

2. **BullMQ worker** — Consumes the `catalog-events` queue and handles product side effects: Redis cache invalidation, low-stock alerts, and (placeholder) aggregator sync to Swiggy/Zomato.

It does not own the `products` or `categories` collections. It reads from the same MongoDB database as the merchant service using `strict: false` models that do not enforce a schema, ensuring it remains forward-compatible with any schema changes made by the merchant service.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20.x |
| Language | TypeScript 5.9 |
| HTTP framework | Express 4.21 |
| Database | MongoDB via Mongoose 8 (`strict: false` models) |
| Queue | BullMQ 5 (consumer) |
| Cache/Queue broker | Redis via ioredis 5 |
| Security | Helmet |
| Observability | Winston (logging), Sentry 7 |
| Build | tsc |

---

## 3. Architecture

```
Internet / App Clients
        │
        ▼
API Gateway (nginx)
        │  strips /api/ prefix before forwarding
        ▼
rez-catalog-service  :3005 (HTTP + BullMQ worker in same process)
        │
        ├── MongoDB (reads products + categories collections — shared with monolith)
        ├── Redis  (BullMQ queue; direct cache key invalidation)
        └── (future) Aggregator APIs (Swiggy, Zomato)

rez-merchant-service
        │
        └── publishes events → catalog-events (Redis/BullMQ queue)
```

**Who calls this service:**
- Consumer clients (mobile app, web menu) call public read endpoints directly via the gateway.
- Internal services (rez-merchant-service, rezbackend monolith) call write endpoints with `X-Internal-Token`.

**What this service calls:**
- MongoDB (read-only for most endpoints; write on internal product create/update/delete).
- Redis (BullMQ queue consumption; direct `DEL` for cache invalidation).

**Gateway prefix stripping:**

The gateway forwards requests with the full path including `/api/`. The service strips this prefix internally:

```typescript
app.use((req, _res, next) => {
  if (req.url.startsWith('/api/')) req.url = req.url.replace(/^\/api/, '');
  next();
});
```

So a gateway request to `/api/products?storeId=X` becomes `/products?storeId=X` inside the service.

---

## 4. All API Routes

### 4.1 Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Returns `{ status, service, uptime, db }`. 503 if MongoDB disconnected. |

---

### 4.2 Products — Public reads (no auth required)

| Method | Path | Query params | Description |
|--------|------|-------------|-------------|
| GET | `/products` | storeId, category, search, page, limit | Paginated active product list |
| GET | `/products/featured` | lat, lng, limit | Featured products sorted by viewCount. lat/lng included in response metadata for client-side geo-filtering. |
| GET | `/products/:productId` | — | Single product by ObjectId |
| GET | `/products/merchant/:merchantId` | search, page, limit | All active products for a merchant |
| GET | `/categories` | — | All active categories, sorted by order then name |
| GET | `/categories/:categoryId/products` | page, limit | Products for a category. categoryId can be an ObjectId or a URL slug. |

**Pagination defaults:** page=1, limit=20. Max limit: 100.

**Search:** Uses `$regex` with `escapeRegex()` applied to user input before building the pattern. This prevents ReDoS attacks by escaping all regex metacharacters (`[.*+?^${}()|[\]\\]`).

**Featured products response:**
```json
{
  "success": true,
  "data": {
    "products": [...],
    "location": { "lat": 12.97, "lng": 77.59 },
    "note": "Sorted by popularity; geo-proximity filtering available via /api/products?search="
  }
}
```

**Category by slug or ObjectId:**

The service automatically detects whether `categoryId` is a valid MongoDB ObjectId and queries either `{ _id: <oid> }` or `{ slug: <string> }` accordingly.

---

### 4.3 Products — Internal writes (`X-Internal-Token` required)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/products` | Internal | Create product. Required body fields: `name` (string), `price` (positive number), `merchantId` (string). |
| PATCH | `/products/:id` | Internal | Update product. Body must include `merchantId` for ownership validation. Field allowlist enforced (see below). |
| DELETE | `/products/:id` | Internal | Soft delete (sets `isActive: false`). Query param: `merchantId` (required). |

**PATCH allowlist** — only these fields may be updated via the catalog service:

```
name, description, price, compareAtPrice, images, thumbnail,
category, subcategory, tags, sku, barcode, stock, unit,
weight, dimensions, variants, addOns, preparationTime,
taxRate, discount, isAvailable, sortOrder, metadata
```

Fields like `merchantId`, `storeId`, `viewCount` are stripped even if present in the request body.

**POST /products response:**
```json
{
  "success": true,
  "productId": "64a1bc...",
  "product": { "_id": "...", "name": "...", "price": 299, "merchantId": "...", "isActive": true, ... }
}
```

---

## 5. Background Jobs / Workers

### Queue consumed: `catalog-events`

**Concurrency:** 10 concurrent jobs. **Rate limit:** 200 jobs/second.

**Event types handled:**

| Event type | Behaviour |
|-----------|-----------|
| Any event | Cache invalidation: deletes `products:list`, `products:featured`, `products:trending`, `product:<productId>`, `category:<categoryId>`, `products:store:<storeId>` from Redis |
| `product.stock_changed` | If `newStock <= lowStockThreshold` (default 5): logs a low-stock alert. Future: publishes to notification queue. |
| `product.created` | Cache invalidation (above) |
| `product.updated` | Cache invalidation (above) |
| `product.deleted` | Cache invalidation (above) |
| `product.eighty_sixed` | Cache invalidation (above) |
| `menu.updated` | Aggregator sync placeholder (logged; wiring to Swiggy/Zomato pending) |

**CatalogEvent shape:**
```typescript
{
  eventId: string;
  eventType: string;
  merchantId: string;
  storeId?: string;
  payload: {
    productId?: string;
    categoryId?: string;
    menuId?: string;
    productName?: string;
    changes?: Record<string, any>;
    stockDelta?: number;
    previousStock?: number;
    newStock?: number;
    lowStockThreshold?: number;
    bulkCount?: number;
  };
  createdAt: string;  // ISO 8601
}
```

**Failure handling:** If any handler inside the job fails, the error is recorded but does not re-throw — the job is marked complete with warnings logged. This is intentional: cache invalidation failures should not block the job retry loop.

**Worker lifecycle:** The worker is started in `main()` in `index.ts` alongside the HTTP server. Both run in the same Node.js process.

---

## 6. Security Mechanisms

### 6.1 Internal Token Authentication (`src/middleware/internalAuth.ts`)

Write endpoints (`POST /products`, `PATCH /products/:id`, `DELETE /products/:id`) require:
```
X-Internal-Token: <token>
X-Internal-Service: <service-name>
```

The middleware reads `INTERNAL_SERVICE_TOKENS_JSON` (a JSON object mapping service names to tokens) and validates with `crypto.timingSafeEqual`. Example:

```json
{ "rez-merchant-service": "tok_abc123", "rezbackend": "tok_def456" }
```

If `INTERNAL_SERVICE_TOKENS_JSON` is not set, the middleware returns `503 Internal auth not configured`. Both the header and the expected token must match in length before the timing-safe comparison runs, preventing length-oracle attacks.

The legacy `INTERNAL_SERVICE_TOKEN` (single shared token, used in rez-merchant-service) is **not** supported here. Only the scoped map is accepted.

### 6.2 ReDoS Protection

All user-supplied `search` query parameters are passed through `escapeRegex()` before being used in a MongoDB `$regex` filter:

```typescript
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### 6.3 HTTP Security Headers

Helmet is applied globally, setting `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, and other standard headers.

### 6.4 Field Allowlist on Write

The PATCH endpoint explicitly allowlists updatable fields. Attempting to update `merchantId`, `storeId`, `viewCount`, or any unlisted field silently ignores those keys — they are never written to MongoDB.

---

## 7. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string (shared DB with monolith) |
| `REDIS_URL` | Yes | Redis URL for BullMQ and cache invalidation |
| `INTERNAL_SERVICE_TOKENS_JSON` | Yes* | JSON map of `{ serviceName: token }` for write auth |
| `INTERNAL_SERVICE_TOKEN` | Yes* | Legacy fallback token (not used; kept for parity with startup validation) |
| `PORT` | No | HTTP listen port (default: `3005`) |
| `HEALTH_PORT` | No | Legacy plain-HTTP health port. If set > 0, a second HTTP server starts on this port. |
| `REDIS_TLS` | No | Set to `"true"` to enable TLS for Redis connection (e.g., Upstash) |
| `SENTRY_DSN` | No | Sentry DSN for error reporting |
| `NODE_ENV` | No | Environment label (default: `development`) |

*One of `INTERNAL_SERVICE_TOKENS_JSON` or `INTERNAL_SERVICE_TOKEN` must be set, but only `INTERNAL_SERVICE_TOKENS_JSON` actually authorises write requests.

---

## 8. Data Models

The service uses `strict: false` Mongoose models that read from the monolith's existing collections. There is no schema enforcement — all documents are returned as-is.

### Product (`products` collection)

Registered as `CatalogService_Product` to avoid model name conflicts if the catalog service is ever loaded in the same process as the merchant service.

**Key fields read by the catalog service:**

| Field | Purpose |
|-------|---------|
| `isActive` | Always filtered: only `true` documents are returned in public reads |
| `isFeatured` | Filtered on `/products/featured` |
| `store` | ObjectId; used for per-store filtering |
| `category` | ObjectId or string; used for category filtering |
| `viewCount` | Used for sorting featured products by popularity |
| `name`, `description` | Regex search targets |
| `merchantId` | String; used in merchant-scoped product queries (direct collection API, not Mongoose model) |

**Indexes:**
- `{ store: 1, isActive: 1 }`
- `{ category: 1, isActive: 1 }`
- `{ isFeatured: 1, isActive: 1 }`

### Category (`categories` collection)

Registered as `CatalogService_Category`.

**Key fields:**

| Field | Purpose |
|-------|---------|
| `isActive` | Filtered on all reads |
| `order` | Sort order in listing |
| `name` | Alphabetical fallback sort |
| `slug` | URL-friendly identifier for category lookup by slug |

**Indexes:**
- `{ isActive: 1, order: 1 }`
- `{ slug: 1 }`

---

## 9. Local Development

### Prerequisites

- Node.js 20.x
- MongoDB (shared with other REZ services, or a local copy seeded with test data)
- Redis

### Setup

```bash
cd rez-catalog-service

npm install

cat > .env << 'EOF'
MONGODB_URI=mongodb://localhost:27017/rez_dev
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_TOKENS_JSON={"rez-merchant-service":"dev_token","rezbackend":"dev_token"}
PORT=3005
EOF

# Development mode (ts-node, no compile step)
npm run dev
```

### Build and run

```bash
npm run build
npm start
```

### Type-check

```bash
npm run lint
```

### Health check

```bash
curl http://localhost:3005/health
```

### Test a product list

```bash
curl "http://localhost:3005/products?page=1&limit=5"
```

### Test an internal write

```bash
curl -X POST http://localhost:3005/products \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: dev_token" \
  -H "X-Internal-Service: rez-merchant-service" \
  -d '{"name":"Test Product","price":199,"merchantId":"64a1bc000000000000000001"}'
```

### Simulate a BullMQ catalog event (using Redis CLI)

```bash
# The catalog-events queue uses BullMQ's JSON job format
# Use the BullMQ dashboard or inject via another service's publish logic
# For quick local testing, you can use the BullMQ test helper or publish via code:

node -e "
const { Queue } = require('bullmq');
const { default: IORedis } = require('ioredis');
const conn = new IORedis('redis://localhost:6379', { maxRetriesPerRequest: null });
const q = new Queue('catalog-events', { connection: conn });
q.add('catalog-event', {
  eventId: 'test-1',
  eventType: 'product.updated',
  merchantId: 'test-merchant',
  storeId: 'test-store',
  payload: { productId: 'test-product' },
  createdAt: new Date().toISOString()
}).then(() => { console.log('Enqueued'); conn.quit(); });
"
```

---

## 10. Common Errors and Troubleshooting

### `503 Internal auth not configured — set INTERNAL_SERVICE_TOKENS_JSON`

The `INTERNAL_SERVICE_TOKENS_JSON` environment variable is not set. Set it to a JSON string mapping at least one service name to a token:

```
INTERNAL_SERVICE_TOKENS_JSON={"rez-merchant-service":"your_token_here"}
```

### `401 Invalid internal token` on write requests

The token in `X-Internal-Token` does not match the value for the service named in `X-Internal-Service`. Both headers must be present. Verify the token values match across services.

### `400 Invalid product id` on `PATCH /products/:id`

The `:id` segment is not a valid MongoDB ObjectId (24 hex chars). Ensure you are passing the `_id` field from MongoDB, not a custom `productId` field.

### `404 Product not found or not owned by merchant` on PATCH/DELETE

The product exists but `merchantId` in the request body/query does not match the `merchantId` stored on the document. This is an ownership check — verify the correct merchantId is being passed.

### Products return empty on `/products`

All queries filter `isActive: true`. Products that have been soft-deleted (`isActive: false`) are never returned. Confirm the product has not been deactivated.

### Featured products not returning expected results

`/products/featured` filters `{ isFeatured: true, isActive: true }` and sorts by `viewCount desc`. If `viewCount` is not set on documents (it may not be in older monolith data), products are sorted by `createdAt desc` as a secondary sort. Update products to set `viewCount` if ranking by popularity is needed.

### BullMQ worker not consuming events

1. Verify `REDIS_URL` is reachable from the service process: `redis-cli -u $REDIS_URL ping`
2. Check for `[Redis] Connection closed` or `[Redis] Error` log lines.
3. Ensure the queue name is exactly `catalog-events` (case-sensitive).
4. Check the BullMQ dashboard or `LLEN bull:catalog-events:wait` in Redis for queued jobs.

### `503` on health check

MongoDB is not connected. Check `MONGODB_URI` and MongoDB server status. The health endpoint distinguishes `readyState === 1` (connected) from `readyState === 2` (connecting) — both return `200`; only fully disconnected returns `503`.

### Service starts on wrong port

The catalog service defaults to port `3005`. The merchant service also historically targeted `4005`. Verify `PORT=3005` is set in the environment to avoid port conflicts.
