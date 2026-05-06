# rez-search-service

## 1. Purpose, Tech Stack, and Architecture Position

**Purpose:** Standalone HTTP service responsible for all discovery and search workloads in the REZ platform. It handles store search, product search, homepage feed construction, personalized recommendations, autocomplete/suggestions, search history, and trending data. The monolith routes any search-related path to this service.

**Architecture position:** Phase C extraction from the REZ monolith using the Strangler Fig pattern. Sits behind `rez-api-gateway`. Both the consumer mobile app and the monolith call this service — the monolith does so via its backward-compatible `/api/*` alias paths. No other service calls this service; it is purely read-facing except for the search-history write endpoints.

**Tech stack:**

| Layer | Technology |
|---|---|
| Runtime | Node.js >= 20 |
| Language | TypeScript 5.x |
| HTTP framework | Express 4 |
| Database | MongoDB (via Mongoose 8 / raw collection access) |
| Cache | Redis (ioredis 5) |
| Authentication | JWT (jsonwebtoken 9) |
| Security | helmet, cors |
| Observability | Winston (structured logs), Sentry (`@sentry/node` 7), custom tracing middleware |

---

## 2. API Routes

All routes are registered at the root (`app.use('/', router)`). Every route has both a **native path** (clean URL) and one or more **monolith compat aliases** for backward compatibility. Authentication is either `requireAuth` (JWT mandatory), `optionalAuth` (JWT decoded if present, anonymous allowed), or none (open).

### Rate Limiters

| Limiter | Max requests | Window | Applied to |
|---|---|---|---|
| `searchLimiter` | 60 req/IP | 60 s | All search + trending + filters routes |
| `autocompleteLimiter` | 120 req/IP | 60 s | Autocomplete + suggestions routes |

Both limiters are backed by Redis counters per IP (`rl:search:<ip>`, `rl:autocomplete:<ip>`). They fail-open: if Redis is unavailable, the request passes through.

---

### Store Search

**GET `/search/stores`**
Aliases: `GET /api/stores/search`, `GET /api/stores/search/advanced`
Auth: optional | Rate limit: `searchLimiter`

Query parameters:

| Param | Type | Description |
|---|---|---|
| `q` / `search` | string | Free-text search query (MongoDB `$text`) |
| `lat` | float | User latitude — activates geo-near stage |
| `lng` | float | User longitude |
| `radius` | int | Geo search radius in metres (default 5000) |
| `category` | string | Filter by category slug (`categories.slug`) |
| `page` | int | Page number (default 1) |
| `limit` | int | Results per page (default 20) |
| `userId` | string | Optional userId for personalisation boost |

Response:
```json
{
  "success": true,
  "data": {
    "stores": [
      {
        "_id": "...",
        "name": "...",
        "slug": "...",
        "logo": "...",
        "address": {},
        "rating": 4.5,
        "reviewCount": 120,
        "distance": 320,
        "cashbackRate": 5,
        "categories": [],
        "isOpen": true,
        "location": {},
        "relevance_score": 0.7812
      }
    ],
    "total": 143,
    "page": 1,
    "hasMore": true
  }
}
```

**Ranking algorithm:** The service fetches `limit * 3` candidates, computes a `relevance_score` for each, re-ranks, then paginates. Score = `(visit_count / max_visit_count) * 0.35 + hasActiveOffer * 0.25 + userPreviouslyVisited * 0.40`. With geo: distance is the primary sort key using 500 m bands; relevance_score breaks ties within a band. Without geo: sort purely by relevance_score descending.

---

### Nearby Stores

**GET `/api/stores/nearby`**
Auth: optional | Rate limit: `searchLimiter`

Query parameters: `lat`, `lng`, `radius` (default 5000 m), `limit` (default 20), `userId`.

Delegates to `searchStores` with empty query string. Returns same shape as store search.

---

### Product Search

**GET `/search/products`**
Alias: `GET /api/products/search`
Auth: optional | Rate limit: `searchLimiter`

Query parameters:

| Param | Type | Description |
|---|---|---|
| `q` | string | Free-text query |
| `storeId` | ObjectId string | Filter to a specific store |
| `category` | string | Category slug |
| `categoryId` | ObjectId string | Category by ID (takes precedence over `category`) |
| `minPrice` | float | Minimum price filter |
| `maxPrice` | float | Maximum price filter |
| `page` | int | Default 1 |
| `limit` | int | Default 20 |

Response:
```json
{
  "success": true,
  "data": {
    "products": [{ "_id": "...", "name": "...", "price": 150, "image": "...", "store": "...", "category": {}, "rating": 4.2 }],
    "total": 45,
    "page": 1,
    "hasMore": false,
    "activeFilters": { "category": "drinks", "maxPrice": 300 }
  }
}
```

Returns 400 if `categoryId` is not a valid MongoDB ObjectId.

---

### Search Filters

**GET `/search/filters`**
Alias: `GET /api/products/filters`
Auth: none | Rate limit: `searchLimiter`

Returns all available filter options for the product search UI.

Response:
```json
{
  "success": true,
  "data": {
    "categories": [{ "id": "...", "name": "Beverages", "slug": "beverages" }],
    "priceRange": { "min": 10, "max": 1200 }
  }
}
```

---

### Trending Stores

**GET `/search/trending`**
Alias: `GET /api/stores/trending`
Auth: none | Rate limit: `searchLimiter`

Query: `limit` (1–20, default 10). Pulls from `userstreaks` collection — stores with the most unique check-ins in the last 7 days. Cached in Redis for 5 minutes.

Response:
```json
{
  "success": true,
  "data": [
    {
      "storeId": "...",
      "storeName": "Biryani House",
      "logo": "https://...",
      "category": "Indian",
      "city": "Bangalore",
      "checkInCount": 47
    }
  ]
}
```

---

### Trending by Category

**GET `/search/trending-by-category`**
Auth: none | Rate limit: `searchLimiter`

No query params. Returns top 5 categories each with their top 3 trending stores from the last 7 days. In-memory cache with 10-minute TTL (module-level variable, cleared only on restart).

Response:
```json
{
  "success": true,
  "data": [
    {
      "categoryId": "...",
      "categoryName": "Fast Food",
      "stores": [
        { "storeId": "...", "storeName": "...", "logo": "...", "visitCount": 23 }
      ]
    }
  ]
}
```

---

### Search Suggestions (simple prefix)

**GET `/search/suggestions?q=<query>`**
Auth: none | Rate limit: `autocompleteLimiter`

Minimum query length: 2 characters. Returns up to 8 mixed store + category results via prefix regex match against `stores.name` and `categories.name`. In-process `Map` cache with 60-second TTL keyed by lowercased query.

Response (array, not wrapped):
```json
[
  { "type": "store", "id": "...", "name": "McDonald's", "logo": "https://..." },
  { "type": "category", "id": "...", "name": "Mcafe" }
]
```

Returns 400 if `q` is shorter than 2 characters.

---

### Autocomplete (fuzzy, full)

**GET `/search/suggest`**
Aliases: `GET /api/search/autocomplete`, `GET /search/autocomplete`
Auth: none | Rate limit: `autocompleteLimiter`

Query: `q` (string), `limit` (default 5). Runs 6 parallel MongoDB queries — prefix and fuzzy regex for stores, categories, and products. Results are deduplicated (prefix wins tie) and merged into a structured response. Cached in Redis for 5 minutes.

Response:
```json
{
  "success": true,
  "data": {
    "stores": [{ "id": "...", "name": "KFC", "slug": "kfc", "type": "store" }],
    "categories": [{ "id": "...", "name": "Fried Chicken", "slug": "fried-chicken", "type": "category" }],
    "products": [{ "id": "...", "name": "KFC Bucket", "type": "product" }]
  }
}
```

---

### Homepage Feed

**GET `/home/feed`**
Alias: `GET /api/homepage`
Auth: optional | Rate limit: none

Query: `lat` (float), `lng` (float), `city` (string). Returns a sections array containing whichever of the following are non-empty:

| Section type | Title | Data source | Cache TTL |
|---|---|---|---|
| `nearby` | Near You | `$geoNear` on `stores` | 5 min (Redis) |
| `trending` | Trending Now | Top 10 by `storepayments` count last 7 days | 15 min (Redis) |
| `recentlyVisited` | Visit Again | Last 5 distinct stores in `storevisits` | 5 min (Redis) |
| `topOffers` | Best Offers | `stores` sorted by `cashbackRate` desc | 15 min (Redis) |
| `newStores` | Just Opened | `stores` created in last 30 days | 1 hr (Redis) |

`recentlyVisited` is only included when the JWT identifies a user.

Response:
```json
{
  "success": true,
  "data": {
    "sections": [
      { "type": "nearby", "title": "Near You", "stores": [ ... ] },
      { "type": "trending", "title": "Trending Now", "stores": [ ... ] }
    ]
  }
}
```

---

### Homepage Sections Config

**GET `/home/sections`**
Alias: `GET /api/homepage/sections`
Auth: none

Returns the static ordered list of section types. No DB call; useful for the frontend to know available sections and their display order.

Response:
```json
{
  "success": true,
  "data": {
    "sections": [
      { "type": "nearby", "title": "Near You", "order": 1 },
      { "type": "trending", "title": "Trending Now", "order": 2 },
      { "type": "recentlyVisited", "title": "Visit Again", "order": 3 },
      { "type": "topOffers", "title": "Best Offers", "order": 4 },
      { "type": "newStores", "title": "Just Opened", "order": 5 }
    ]
  }
}
```

---

### User Context (homepage widget data)

**GET `/api/homepage/user-context`**
Auth: optional

Aggregates wallet balance, active voucher count, cart item count, and subscription tier for the homepage banner widgets. Returns zeros for all fields when unauthenticated — never returns an error.

Response:
```json
{
  "success": true,
  "data": {
    "walletBalance": 250,
    "totalSaved": 1200,
    "voucherCount": 3,
    "offersCount": 0,
    "cartItemCount": 2,
    "subscription": { "tier": "gold", "status": "active" }
  }
}
```

Collections queried: `wallets`, `vouchers`, `carts`, `subscriptions`. On any error, returns the zero-value shape (graceful degradation — homepage must not break if this call fails).

---

### Personalized Recommendations

**GET `/recommend/personalized`**
Alias: `GET /api/recommendations/products/personalized`
Auth: required | Rate limit: none

Query: `limit` (default 10). Algorithm:
1. Find the user's top 50 completed payments in `storepayments`, grouped by store.
2. Extract category slugs from those stores.
3. Return active stores in those categories that the user has NOT visited, sorted by rating.
4. Fallback (no order history): return top-rated active stores.

Cached in Redis for 5 minutes keyed by `userId`.

---

### Store Recommendations (similar stores)

**GET `/recommend/store/:storeId`**
Alias: `GET /api/recommendations/store/:storeId`
Auth: optional

Query: `limit` (default 5). Co-occurrence algorithm: finds the last 200 visitors to this store, then finds which other stores those users also visited (co-visit frequency), returns the top `limit` stores. Cached in Redis for 15 minutes.

---

### Trending Recommendations

**GET `/recommend/trending`**
Alias: `GET /api/recommendations/trending`
Auth: none

Query: `city` (string), `category` (string), `limit` (default 10). Ranks by transaction count in `storepayments` from the last 7 days. Filtered by city regex and category slug if supplied. Cached 15 minutes.

---

### Picked For You

**GET `/recommend/picked-for-you`**
Alias: `GET /api/recommendations/picked-for-you`
Auth: required

Query: `limit` (default 10). Blended result: 50% from personalized categories, 50% highly-rated (>= 4.0) stores the user has not visited. Deduplicated and capped at `limit`. Cached 5 minutes.

---

### Search History — Save

**POST `/search/history`**
Alias: `POST /api/search/history`
Auth: required

Body:
```json
{ "query": "biryani" }
```

Saves query (lowercased, trimmed) to `searchhistories` collection with the authenticated `userId`.

Response: `{ "success": true }`. Returns 400 if `query` is absent.

---

### Search History — Get Recent

**GET `/search/history`**
Aliases: `GET /api/search/history`, `GET /api/search/history/recent`
Auth: required

Query: `limit` (1–50, default 10). Returns the user's most recent distinct search queries.

Response:
```json
{
  "success": true,
  "data": [
    { "query": "pizza", "createdAt": "2024-01-15T..." }
  ]
}
```

---

### Popular Searches

**GET `/search/history/popular`**
Alias: `GET /api/search/history/popular`
Auth: optional

Query: `limit` (1–50, default 10). Aggregates the most-searched queries across all users in the last 24 hours. Cached in Redis for 1 hour.

Response:
```json
{
  "success": true,
  "data": [
    { "query": "biryani", "count": 312 }
  ]
}
```

---

## 3. Background Workers / Jobs

This service has no BullMQ workers or cron jobs. All data is read from MongoDB collections populated by other services (`storepayments`, `storevisits`, `userstreaks`). The only write operation is `POST /search/history`.

---

## 4. Security Mechanisms

| Mechanism | Detail |
|---|---|
| JWT authentication | `requireAuth` verifies `Authorization: Bearer <token>` using `JWT_SECRET`. `optionalAuth` does the same but allows anonymous access. |
| Helmet | Sets standard security HTTP headers on all responses. |
| CORS | Restricted to `CORS_ORIGIN` env var (comma-separated list). Defaults to `https://rez.money`. |
| Rate limiting | Redis-backed per-IP counters. 60 req/min for search, 120 req/min for autocomplete. Fail-open. |
| Input body size limit | `express.json({ limit: '256kb' })` |
| Regex escaping | All user-supplied query strings are escaped before use in MongoDB regex (`/[.*+?^${}()|[\]\\]/g`). |
| Sentry | Error monitoring with `SENTRY_DSN`. Request and error handlers registered. Trace sample rate configurable via `SENTRY_TRACES_SAMPLE_RATE`. |

---

## 5. Environment Variables

### Required

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string. Must point to the same cluster as the monolith (shared collections). |
| `REDIS_URL` | Redis connection URL. Used for both rate limiting and caching. |
| `JWT_SECRET` | Shared JWT secret — must match the value used by `rez-auth-service`. |

### Optional

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4003` | HTTP API listen port. |
| `HEALTH_PORT` | `4103` | Separate health-check server port. |
| `SERVICE_NAME` | `rez-search-service` | Service label for logs and Sentry. |
| `NODE_ENV` | `production` | Sets Sentry environment tag. |
| `CORS_ORIGIN` | `https://rez.money` | Comma-separated list of allowed origins. |
| `SENTRY_DSN` | unset | Sentry DSN. Sentry is disabled when absent. |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | Fraction of requests traced by Sentry (0.0–1.0). |

---

## 6. Data Models

The service reads from MongoDB collections shared with the monolith. There are no Mongoose schemas defined in this service — all access is via raw `mongoose.connection.collection()`.

### `stores`

Key fields read:

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | string | Text-indexed for `$text` search |
| `slug` | string | URL slug |
| `isActive` | boolean | Filters out inactive stores |
| `categories` | `[{ _id, name, slug }]` | Used for category filtering and recommendation |
| `address` | object | Includes `city` |
| `location` | `{ type: 'Point', coordinates: [lng, lat] }` | 2dsphere index required for geo queries |
| `rating` | number | |
| `reviewCount` | number | |
| `cashbackRate` | number | |
| `visit_count` | number | Used for popularity ranking |
| `hasActiveOffer` | boolean | Used for offer-boost ranking |
| `activeOffersCount` | number | Alternative offer signal |
| `isOpen` | boolean | |
| `logo` | string | URL |
| `merchantId` | string | Used to distinguish merchants in trending |
| `createdAt` | Date | |

**Required indexes:**
- `location`: `2dsphere` (geo-near queries fail without this)
- `name`: text index (for `$text` search)
- `isActive`: 1 (frequent filter)
- `categories.slug`: 1 (category filter)

### `products`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | string | Text-indexed |
| `isActive` | boolean | |
| `price` | number | |
| `store` | ObjectId | Ref to `stores` |
| `category` | ObjectId or `{ slug }` | |
| `rating` | number | |
| `image` | string | |

### `categories`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | string | |
| `slug` | string | |

### `storevisits`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | |
| `storeId` | ObjectId | |
| `createdAt` | Date | |

### `storepayments`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | |
| `storeId` | ObjectId | |
| `status` | string | `'completed'` used for recommendations |
| `createdAt` | Date | |

### `userstreaks`

| Field | Type | Notes |
|---|---|---|
| `userId` | string / ObjectId | |
| `type` | string | `'store_visit'` for trending data |
| `lastStoreId` | string / ObjectId | The store from the last visit (used for trending aggregation) |
| `updatedAt` | Date | Used to filter last 7 days |

### `searchhistories`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | |
| `query` | string | Lowercased, trimmed |
| `createdAt` | Date | |

### `wallets`, `vouchers`, `carts`, `subscriptions`

Read only for `/api/homepage/user-context`. See the monolith data model for full field definitions.

---

## 7. Local Development and Testing

### Prerequisites

- Node.js >= 20
- Running MongoDB instance with the REZ database
- Running Redis instance

### Setup

```bash
cd rez-search-service
cp .env.example .env       # create if absent; populate the three required vars
npm install
```

Minimum `.env`:
```
MONGODB_URI=mongodb://localhost:27017/rez
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-dev-secret
```

### Run in development

```bash
npm run dev          # ts-node src/index.ts — watches nothing, restart manually
```

Service binds to `http://localhost:4003` (API) and `http://localhost:4103` (health).

### Build and run compiled

```bash
npm run build        # tsc — outputs to dist/
npm start            # node dist/index.js
```

### Type-check (lint)

```bash
npm run lint         # tsc --noEmit
```

### Tests

```bash
npm test             # node --test test/
```

Tests live in `test/` at the service root. The framework is Node.js built-in test runner.

### Useful curl commands

```bash
# Search stores near a location
curl "http://localhost:4003/search/stores?lat=12.9716&lng=77.5946&radius=3000"

# Autocomplete
curl "http://localhost:4003/search/suggest?q=bir&limit=5"

# Homepage feed
curl "http://localhost:4003/home/feed?lat=12.97&lng=77.59"

# Search with JWT
curl -H "Authorization: Bearer <token>" \
  "http://localhost:4003/recommend/personalized?limit=5"
```

### MongoDB indexes to create locally

```js
// stores
db.stores.createIndex({ location: '2dsphere' })
db.stores.createIndex({ name: 'text' })
db.stores.createIndex({ isActive: 1 })
db.stores.createIndex({ 'categories.slug': 1 })

// products
db.products.createIndex({ name: 'text' })
db.products.createIndex({ isActive: 1 })

// searchhistories
db.searchhistories.createIndex({ userId: 1, createdAt: -1 })
```

---

## 8. Troubleshooting

**Service won't start — "Missing required env vars"**
Set `MONGODB_URI`, `REDIS_URL`, and `JWT_SECRET` in the environment or `.env` file.

**Geo-near queries return 500 with "no index found for $geoNear"**
The `stores` collection is missing its 2dsphere index. Create it: `db.stores.createIndex({ location: '2dsphere' })`.

**`$text` search returns no results**
The `stores` or `products` collection is missing its text index. Run `db.stores.createIndex({ name: 'text' })`.

**Autocomplete / suggestions returning stale data**
The 5-minute Redis cache may be serving an old result. Flush the key: `redis-cli DEL "search:autocomplete_v2:<hash>"`. The hash is the MD5 of `JSON.stringify({ query, limit })` (first 12 hex chars). In development, flush all search keys with `redis-cli KEYS "search:*" | xargs redis-cli DEL`.

**Rate limit 429 in development**
The limiter uses your IP. In local dev all requests come from `::1` or `127.0.0.1`, so 60 req/min is hit fast if you run automated tests. You can temporarily raise the limit in `src/middleware/rateLimiter.ts` or flush the counter: `redis-cli DEL "rl:search:::1"`.

**Trending-by-category returns empty array**
This endpoint needs `userstreaks` documents with `type: 'store_visit'` and `updatedAt` within the last 7 days. In a fresh dev environment there are no streaks. Seed some test data or call `POST /internal/visit` on the gamification service.

**`/api/homepage/user-context` always returns zeros**
Either the user is not authenticated (expected), or the `wallets` / `vouchers` / `carts` / `subscriptions` collections are empty. The endpoint is designed to degrade gracefully to zeros rather than returning an error.

**JWT token rejected on `/recommend/personalized`**
Confirm `JWT_SECRET` matches the value in `rez-auth-service`. The token must contain `{ userId: "<string>" }` in its payload.

**Redis connection errors in logs**
The service fails-open for caching — all routes still function, just slower. Check `REDIS_URL` format: `redis://[:password@]host:port[/db]`.

**Sentry events not appearing**
Set `SENTRY_DSN` and redeploy. Without the DSN, Sentry is fully disabled and no errors are forwarded.
