# rez-ads-service

## 1. Purpose, Tech Stack, and Architecture Position

**Purpose**: Self-serve display ad platform for REZ merchants. Merchants create ads, submit them for admin review, and approved ads are served to consumers in the REZ app. The service manages the full ad lifecycle: draft → pending_review → active/rejected → paused/completed. It tracks impressions and clicks with atomic MongoDB updates and auto-completes ads when budgets are exhausted.

**Architecture position**: Standalone HTTP API service sitting alongside rez-backend. Merchants interact via the rez-merchant dashboard. The consumer REZ app (nuqta-master) calls the serve endpoints to display ads at specific placements. REZ admin panel calls the admin endpoints for moderation. The service does not integrate with BullMQ — all operations are synchronous HTTP.

**Current deployment status**: Port 4007. NOT yet deployed to Render. Runs locally only.

**Future extension**: An `appId` field will be added to `AdCampaign` when sister apps launch, enabling cross-app ad serving from a single platform.

**Tech stack**:
- Runtime: Node.js 18+, TypeScript
- Framework: Express 4 with `express-async-errors`
- Database: MongoDB via Mongoose 8
- Authentication: JWT (jsonwebtoken)
- Security: Helmet, CORS (open — all origins), tracing middleware
- Default port: **4007**

---

## 2. API Routes

### Authentication

Three distinct auth middlewares enforce role-based access:

| Middleware | Header | Token claim checked | Sets on `req` |
|------------|--------|---------------------|---------------|
| `verifyConsumer` | `Authorization: Bearer {token}` | `userId`/`_id`/`id` | `req.userId` |
| `verifyMerchant` | `Authorization: Bearer {token}` | `merchant._id` or `merchantId` or `_id` | `req.merchantId` |
| `verifyAdmin` | `Authorization: Bearer {token}` | `role === 'admin'` OR `isAdmin === true` OR `user.role === 'admin'` | `req.isAdmin`, `req.userId` |

All three use the same `JWT_SECRET`. Token format: standard JWT Bearer in `Authorization` header.

---

### Merchant Routes — `/merchant/ads`

All routes require `verifyMerchant`. The merchant can only see and modify their own ads (`merchantId` is scoped from the JWT, not from the request body).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/merchant/ads` | List merchant's ads with pagination |
| POST | `/merchant/ads` | Create a new ad (starts as `draft`) |
| GET | `/merchant/ads/analytics` | Aggregate stats for the merchant's ads |
| GET | `/merchant/ads/:id` | Get a single ad |
| PUT | `/merchant/ads/:id` | Update a draft or rejected ad |
| PATCH | `/merchant/ads/:id/submit` | Submit ad for admin review |
| PATCH | `/merchant/ads/:id/pause` | Pause an active ad |
| PATCH | `/merchant/ads/:id/activate` | Reactivate a paused ad |
| DELETE | `/merchant/ads/:id` | Soft-delete (draft or paused only) |

**GET /merchant/ads**

Query params: `status` (optional filter), `page` (default 1), `limit` (1–50, default 20)

Response:
```json
{
  "success": true,
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 45, "pages": 3 }
}
```

**POST /merchant/ads**

Required fields: `storeId`, `title`, `headline`, `description`, `ctaText`, `imageUrl`, `placement`, `bidType`, `startDate`, `bidAmount`, `dailyBudget`, `totalBudget`

Optional fields: `ctaUrl`, `targetSegment` (default `all`), `targetLocation`, `targetInterests`, `endDate`

Validation:
- `bidAmount`, `dailyBudget`, `totalBudget` must be non-negative numbers
- `startDate` required
- `placement` must be one of: `home_banner`, `explore_feed`, `store_listing`, `search_result`
- `bidType` must be `CPC` or `CPM`
- `targetSegment` must be one of: `all`, `new`, `loyal`, `lapsed`, `nearby`

Request body:
```json
{
  "storeId": "64abc... (required)",
  "title": "string max 150 (required)",
  "headline": "string max 90 (required)",
  "description": "string max 200 (required)",
  "ctaText": "string max 30 (required)",
  "ctaUrl": "https://... (optional)",
  "imageUrl": "https://... (required)",
  "placement": "home_banner | explore_feed | store_listing | search_result (required)",
  "targetSegment": "all | new | loyal | lapsed | nearby (default: all)",
  "targetLocation": { "city": "Bangalore", "radiusKm": 5 },
  "targetInterests": ["coffee", "food"],
  "bidType": "CPC | CPM (required)",
  "bidAmount": 5.00,
  "dailyBudget": 500,
  "totalBudget": 5000,
  "startDate": "2026-04-08T00:00:00.000Z (required)",
  "endDate": "2026-04-30T00:00:00.000Z (optional)"
}
```

Response (201): the created `AdCampaign` document with `status: 'draft'`.

**GET /merchant/ads/analytics**

Returns aggregate totals across all of the merchant's ads:
```json
{
  "success": true,
  "data": {
    "totalImpressions": 12400,
    "totalClicks": 248,
    "totalSpend": 1240.00,
    "activeCount": 3
  }
}
```

**PUT /merchant/ads/:id**

Only allowed when `status` is `draft` or `rejected`. Editing a rejected ad resets its status back to `draft` and clears `rejectionReason`.

Editable fields: `title`, `headline`, `description`, `ctaText`, `ctaUrl`, `imageUrl`, `placement`, `targetSegment`, `targetLocation`, `targetInterests`, `bidType`, `bidAmount`, `dailyBudget`, `totalBudget`, `startDate`, `endDate`

**PATCH /merchant/ads/:id/submit**

Transitions: `draft` → `pending_review`. Only draft ads can be submitted.

**PATCH /merchant/ads/:id/pause**

Transitions: `active` → `paused`.

**PATCH /merchant/ads/:id/activate**

Transitions: `paused` → `active`.

**DELETE /merchant/ads/:id**

Soft-delete: sets `status = 'completed'`. Only allowed for `draft` or `paused` ads. Active ads cannot be deleted — pause first.

---

### Admin Routes — `/admin/ads`

All routes require `verifyAdmin` (JWT with `role === 'admin'` or `isAdmin === true`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/ads` | List all ads with filters |
| GET | `/admin/ads/stats` | Network-wide aggregate stats |
| GET | `/admin/ads/:id` | Get single ad with merchant + store populated |
| PATCH | `/admin/ads/:id/approve` | Approve a pending_review ad → active |
| PATCH | `/admin/ads/:id/reject` | Reject a pending_review ad |
| PATCH | `/admin/ads/:id/pause` | Force-pause an active ad |

**GET /admin/ads**

Query params: `status`, `merchantId`, `placement`, `from` (ISO date), `to` (ISO date), `page`, `limit` (1–100, default 20)

Response includes populated `merchantId` (businessName, email) and `storeId` (name) fields.

**GET /admin/ads/stats**

Returns network-wide totals:
```json
{
  "success": true,
  "data": {
    "byStatus": {
      "draft": 12,
      "pending_review": 5,
      "active": 23,
      "paused": 4,
      "rejected": 8,
      "completed": 31
    },
    "totalImpressions": 450000,
    "totalClicks": 9000,
    "totalSpend": 45000.00
  }
}
```

**PATCH /admin/ads/:id/approve**

Transitions: `pending_review` → `active`. Sets `reviewedBy` (admin's userId) and `reviewedAt`.

**PATCH /admin/ads/:id/reject**

Requires `rejectionReason` in request body (non-empty string). Transitions: `pending_review` → `rejected`. Sets `reviewedBy`, `reviewedAt`, `rejectionReason`.

```json
{ "rejectionReason": "Ad contains misleading claims about pricing." }
```

**PATCH /admin/ads/:id/pause**

Force-pauses an active ad (admin override, no merchant action required). Transitions: `active` → `paused`.

---

### Consumer (Serve) Routes — `/ads`

All routes require `verifyConsumer` (user JWT from consumer app).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ads/serve` | Get one active ad for a placement |
| POST | `/ads/impression` | Record an ad impression |
| POST | `/ads/click` | Record an ad click |

**GET /ads/serve**

Query params: `placement` (required): `home_banner`, `explore_feed`, `store_listing`, `search_result`

Returns one active ad that:
- Has `status === 'active'`
- Has `startDate <= now`
- Has `endDate > now` OR no `endDate`
- Has `totalSpent < totalBudget` (budget check via `$expr`)

If multiple qualifying ads exist, one is selected at random (round-robin via `Math.random()`).

Returns only safe fields: `_id`, `title`, `headline`, `description`, `ctaText`, `ctaUrl`, `imageUrl`, `placement`, `merchantId`, `storeId`.

Response (ad found):
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "10% off at Brew Bar",
    "headline": "Best Coffee in BTM",
    "description": "Use code REZ10 for 10% off your first order",
    "ctaText": "Order Now",
    "ctaUrl": "https://...",
    "imageUrl": "https://...",
    "placement": "home_banner",
    "merchantId": "...",
    "storeId": "..."
  }
}
```

Response (no ads available):
```json
{ "success": true, "data": null }
```

**POST /ads/impression**

Records an impression and, for CPM ads, charges `bidAmount / 1000` to `totalSpent`. Uses an atomic MongoDB aggregation pipeline update to avoid lost-update races.

```json
{ "adId": "64abc..." }
```

Response: `{"success":true,"message":"Impression recorded"}`

Returns 404 if ad is not found or not `active`.

**POST /ads/click**

Records a click and, for CPC ads, adds `bidAmount` to `totalSpent`. Uses an atomic aggregation pipeline update that also sets `status = 'completed'` if `totalSpent >= totalBudget` after this click — budget exhaustion is handled in a single round-trip.

```json
{ "adId": "64abc..." }
```

Response: `{"success":true,"message":"Click recorded"}`

---

### Health

**GET /health**

```json
{ "status": "ok", "service": "rez-ads-service", "ts": "2026-04-08T10:00:00.000Z" }
```

---

## 3. Background Workers and Jobs

None. This service has no BullMQ workers, no cron jobs, and no async processing. All operations are synchronous HTTP request-response.

---

## 4. Security Mechanisms

- **JWT auth**: Three distinct middleware functions enforce consumer, merchant, and admin access. All use the same `JWT_SECRET`. Admin check validates `role === 'admin'` or `isAdmin === true` in the token payload.
- **Merchant scoping**: `req.merchantId` is extracted from the JWT — it cannot be spoofed via request body. All merchant routes filter by `merchantId: new Types.ObjectId(req.merchantId)` to ensure merchants can only see their own ads.
- **Atomic budget updates**: Impression and click tracking use MongoDB aggregation pipeline updates (`[{$set: {...}}]`) to atomically increment counters and update `totalSpent` and `status` in a single write. This prevents race conditions in high-concurrency scenarios.
- **Helmet**: Standard security headers.
- **CORS**: Currently open (`cors()` with no origin restriction). This should be restricted to known origins before production deployment.
- **Soft deletes**: Ads are never hard-deleted from the database. `DELETE` sets `status = 'completed'`, preserving the record for analytics and audit.

---

## 5. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `ADS_MONGO_URI` or `MONGO_URI` | MongoDB connection string (`ADS_MONGO_URI` takes precedence) |
| `JWT_SECRET` | JWT signing secret (shared with rez-auth-service) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4007` | HTTP server port |
| `NODE_ENV` | `production` | Logging behavior |

There is no Redis dependency. This service does not use BullMQ.

---

## 6. Data Models

### AdCampaign (`adcampaigns`)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `merchantId` | ObjectId | Required, indexed | Owning merchant |
| `storeId` | ObjectId | Required | Associated store |
| `title` | String | Required, max 150 | Internal campaign name |
| `headline` | String | Required, max 90 | Display headline |
| `description` | String | Required, max 200 | Ad body text |
| `ctaText` | String | Required, max 30 | Button label |
| `ctaUrl` | String | Optional | Button destination URL |
| `imageUrl` | String | Required | Ad creative image URL |
| `placement` | Enum | Required, indexed | `home_banner`, `explore_feed`, `store_listing`, `search_result` |
| `targetSegment` | Enum | Default `all` | `all`, `new`, `loyal`, `lapsed`, `nearby` |
| `targetLocation` | Object | Optional | `{city?: string, radiusKm?: number}` |
| `targetInterests` | String[] | Optional | Interest tags |
| `bidType` | Enum | Required | `CPC` or `CPM` |
| `bidAmount` | Number | Required, min 0 | ₹ per click (CPC) or per 1000 impressions (CPM) |
| `dailyBudget` | Number | Required, min 0 | Max ₹/day |
| `totalBudget` | Number | Required, min 0 | Lifetime budget cap |
| `totalSpent` | Number | Default 0 | Running total ₹ spent |
| `startDate` | Date | Required, indexed | Campaign start |
| `endDate` | Date | Optional, indexed | Campaign end (no end = evergreen) |
| `status` | Enum | Default `draft`, indexed | `draft`, `pending_review`, `active`, `paused`, `rejected`, `completed` |
| `rejectionReason` | String | Optional | Admin rejection message |
| `impressions` | Number | Default 0 | Total impressions |
| `clicks` | Number | Default 0 | Total clicks |
| `ctr` | Virtual | — | `(clicks / impressions) * 100` — included in `toJSON` and `toObject` |
| `reviewedBy` | ObjectId | Optional | Admin who reviewed |
| `reviewedAt` | Date | Optional | Review timestamp |

**Compound indexes**:
- `{startDate, endDate}` — for date-range queries
- `{merchantId, status}` — for merchant dashboard queries
- `{status, placement, startDate, endDate}` — for ad serving queries (most critical)

**Ad lifecycle state machine**:
```
draft → pending_review → active → paused → active (reactivate)
                      → rejected → draft (after edit + resubmit)
active → completed (budget exhausted via atomic click update)
draft | paused → completed (soft delete)
```

---

## 7. Local Development and Testing

### Setup

```bash
cd rez-ads-service
cp .env.example .env   # fill in ADS_MONGO_URI, JWT_SECRET

npm install
npm run dev            # ts-node-dev on port 4007
```

Minimum `.env`:
```env
ADS_MONGO_URI=mongodb://localhost:27017/rez-ads
JWT_SECRET=dev-jwt-secret
```

### Generate test JWTs

```javascript
const jwt = require('jsonwebtoken');

// Consumer token
const consumerToken = jwt.sign({ userId: '64abc123def456789012345' }, 'dev-jwt-secret');

// Merchant token (flat merchantId)
const merchantToken = jwt.sign({ merchantId: '64def456ghi789012345678' }, 'dev-jwt-secret');

// Merchant token (nested merchant object)
const merchantToken2 = jwt.sign({
  merchant: { _id: '64def456ghi789012345678' }
}, 'dev-jwt-secret');

// Admin token
const adminToken = jwt.sign({ role: 'admin', _id: '64aaa111bbb222ccc333ddd' }, 'dev-jwt-secret');
```

### Test the full ad lifecycle

```bash
# 1. Merchant creates an ad
curl -X POST http://localhost:4007/merchant/ads \
  -H "Authorization: Bearer {merchantToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "64abc123def456789012345",
    "title": "Summer Sale",
    "headline": "50% off everything",
    "description": "Limited time offer at Brew Bar BTM",
    "ctaText": "Order Now",
    "imageUrl": "https://example.com/ad.jpg",
    "placement": "home_banner",
    "bidType": "CPC",
    "bidAmount": 5.00,
    "dailyBudget": 200,
    "totalBudget": 2000,
    "startDate": "2026-04-08T00:00:00.000Z"
  }'

# 2. Merchant submits for review
curl -X PATCH http://localhost:4007/merchant/ads/{adId}/submit \
  -H "Authorization: Bearer {merchantToken}"

# 3. Admin approves
curl -X PATCH http://localhost:4007/admin/ads/{adId}/approve \
  -H "Authorization: Bearer {adminToken}"

# 4. Consumer app requests an ad
curl "http://localhost:4007/ads/serve?placement=home_banner" \
  -H "Authorization: Bearer {consumerToken}"

# 5. Record impression
curl -X POST http://localhost:4007/ads/impression \
  -H "Authorization: Bearer {consumerToken}" \
  -H "Content-Type: application/json" \
  -d '{"adId":"{adId}"}'

# 6. Record click
curl -X POST http://localhost:4007/ads/click \
  -H "Authorization: Bearer {consumerToken}" \
  -H "Content-Type: application/json" \
  -d '{"adId":"{adId}"}'
```

### Verify budget auto-complete

Set a small `totalBudget` (e.g. `10`) and `bidAmount: 5` with `bidType: CPC`. After 2 clicks, `totalSpent (10) >= totalBudget (10)` and the ad status should automatically change to `completed`.

---

## 8. Troubleshooting

**`ADS_MONGO_URI or MONGO_URI is required`**: The service exits immediately on boot if neither variable is set. Set at least `MONGO_URI` in your `.env`.

**`GET /ads/serve` returns `{"data": null}` with active ads in the database**: Check that:
1. The ad's `status` is exactly `active` (not `pending_review`)
2. `startDate <= now`
3. `endDate > now` OR `endDate` is null/missing
4. `totalSpent < totalBudget` — if the budget is exhausted, the ad is filtered out

If the budget check is failing unexpectedly, inspect `totalSpent` and `totalBudget` directly in MongoDB: `db.adcampaigns.findOne({_id: ObjectId("...")}, {totalSpent:1, totalBudget:1})`

**JWT auth 401 "Merchant identity not found in token"**: The `verifyMerchant` middleware looks for `merchant._id`, `merchantId`, or `_id` in the token payload. If the JWT was issued with a different structure (e.g. `{id: "..."}` without the `merchantId` key), it will fail. Ensure the merchant JWT includes one of these fields.

**Admin 401 "Admin access required"**: The `verifyAdmin` middleware checks `role === 'admin'`, `isAdmin === true`, or `user.role === 'admin'`. Make sure the admin JWT includes one of these. The rez-admin service must issue tokens with one of these claims.

**Impression/click returning 404**: The ad must have `status === 'active'` at the time of the event. If the ad was paused or completed between serve and impression/click, the update will return no document and trigger the 404.

**Budget exhaustion race condition**: The service uses atomic aggregation pipeline updates to prevent this. Two concurrent clicks will both increment correctly and the budget check happens within the same write operation. If you're seeing `totalSpent > totalBudget`, this indicates the budget check is not functioning — verify the MongoDB version supports aggregation pipeline updates (MongoDB 4.2+).

**CORS blocking**: The current `cors()` middleware allows all origins. If you're seeing CORS errors, it's likely a browser issue unrelated to this service, or a proxy is stripping CORS headers. For production, configure `cors({ origin: ['https://app.rez.money', 'https://merchant.rez.money'] })` before deployment.

**Ad not appearing for a specific placement**: Verify the `placement` value matches exactly. Valid values are case-sensitive: `home_banner`, `explore_feed`, `store_listing`, `search_result`. The consumer app must pass the exact string.

**Deployment to Render**: The service is not yet deployed. When deploying:
1. Set `ADS_MONGO_URI` and `JWT_SECRET` in Render environment
2. Note: The `appId` field does not exist on the model yet. When sister apps are launched, `AdCampaign` will need an `appId` field and the serve route will need to filter by `appId`.
