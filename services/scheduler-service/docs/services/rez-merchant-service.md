# rez-merchant-service

## 1. Purpose

rez-merchant-service is the primary API backend for every merchant-facing operation in the REZ platform. It owns the full merchant lifecycle: registration, authentication, store configuration, product management, order fulfilment, POS, table management, staff scheduling, payroll, GST reporting, khata (customer credit ledger), loyalty and engagement programs, analytics, fraud detection, dispute management, and payout requests.

All `/api/merchant/*` traffic arriving at the API gateway is proxied here. The service also accepts direct paths (without the `/api/merchant` prefix) for inter-service and development traffic. It does not expose any consumer-facing endpoints — those belong to the REZ backend monolith.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20.x |
| Language | TypeScript 5.4 |
| HTTP framework | Express 4.18 |
| Database | MongoDB via Mongoose 8 |
| Cache | Redis (ioredis 5) |
| Auth | JWT (jsonwebtoken 9) + bcrypt 5 |
| File uploads | Multer + Cloudinary |
| Validation | Zod 4 |
| Security | Helmet, express-mongo-sanitize, express-rate-limit, rate-limit-redis |
| Observability | Winston (logging), Sentry 7, W3C traceparent propagation |
| Testing | Jest 29 + Supertest |
| Build | tsc |

---

## 3. Architecture

```
Internet
    │
    ▼
API Gateway (nginx)
    │  proxies /api/merchant/* with full path
    ▼
rez-merchant-service  :4005
    │
    ├── MongoDB (shared DB with monolith)
    ├── Redis (response caching, rate-limit counters)
    └── Cloudinary (product/store image storage)
```

**Who calls this service:**
- The API gateway routes all authenticated merchant dashboard traffic here.
- The REZ backend monolith may call internal endpoints using `X-Internal-Token`.

**What this service calls:**
- MongoDB (reads/writes own collections).
- Redis (cache get/set/del).
- Cloudinary (media upload endpoints).
- No direct HTTP calls to other microservices at runtime; side effects (payouts, settlements) are handled by the wallet service reading shared MongoDB data or via the gateway.

**Route mounting — dual-prefix pattern:**

Every domain router is mounted twice:

```typescript
app.use('/', coreRouter);              // direct / dev access
app.use('/api/merchant', coreRouter);  // production gateway prefix
```

This means a route defined as `/products` is accessible at both `/products` and `/api/merchant/products`.

---

## 4. All API Routes

All routes require `Authorization: Bearer <merchant-jwt>` unless marked `[PUBLIC]` or `[INTERNAL]`.

Rate limits unless otherwise noted: **100 requests / 15 min** (general), **10 requests / 15 min** (auth endpoints).

### 4.1 Auth (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Register new merchant account + create default store |
| POST | `/auth/login` | Public | Login (merchant owner or MerchantUser staff) |
| POST | `/auth/refresh` | Public | Exchange refresh token for new access token |
| GET | `/auth/me` | JWT | Fetch own merchant record + stores |
| PUT | `/auth/profile` | JWT | Update profile (excludes password/email/refreshTokenHash) |
| PUT | `/auth/change-password` | JWT | Change password (verifies current password first) |
| POST | `/auth/logout` | JWT | Invalidate refresh token |

**Login response shape:**
```json
{
  "success": true,
  "data": {
    "token": "eyJ...",
    "refreshToken": "hex64...",
    "role": "owner",
    "permissions": ["all"],
    "merchant": { "id": "...", "businessName": "...", "verificationStatus": "pending" }
  }
}
```

**Roles and permissions:**

| Role | Permissions |
|------|------------|
| `owner` | `["all"]` |
| `manager` | orders, products, stores, team, analytics, settings |
| `staff` | orders, products |
| `cashier` | orders, pos |
| `viewer` | analytics |

**Account lockout:** 5 failed attempts → 30-minute lockout.

---

### 4.2 Merchant Profile (`/merchant-profile`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/merchant-profile` | Full merchant record + store count |
| PUT | `/merchant-profile` | Update business info (businessName, businessType, phone, email, address, logo, gstNumber, panNumber) |
| GET | `/merchant-profile/stores` | All stores owned by this merchant |

---

### 4.3 Stores (`/stores`)

CRUD for Store documents. All require JWT.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stores` | List all stores for merchant |
| POST | `/stores` | Create store |
| GET | `/stores/:id` | Get store by ID |
| PUT | `/stores/:id` | Update store |
| DELETE | `/stores/:id` | Delete store |

---

### 4.4 Products (`/products`)

| Method | Path | Query params | Description |
|--------|------|-------------|-------------|
| GET | `/products` | storeId, page, limit, search, category, isActive, lowStock | Paginated product list (2-min Redis cache) |
| GET | `/products/validate-sku` | sku, storeId | Check SKU uniqueness |
| GET | `/products/categories` | storeId | Distinct category list (5-min cache) |
| GET | `/products/:id` | — | Single product |
| POST | `/products` | — | Create product (field allowlist enforced) |
| PUT | `/products/:id` | — | Full update (field allowlist enforced) |
| PATCH | `/products/:id` | — | Partial update: lowStockAlert, isActive, isAvailable, sortOrder, inventory.* |
| DELETE | `/products/:id` | — | Soft delete (sets isActive: false) |
| POST | `/products/bulk-import` | — | Bulk import from JSON array (partial success, ordered: false) |
| POST | `/products/bulk` | — | Bulk create |
| POST | `/products/bulk-action` | — | Bulk activate/deactivate; body: `{ productIds, action }` |
| GET | `/products/:id/variants` | — | List product variants |
| POST | `/products/:id/variants` | — | Add variant |
| POST | `/products/:id/86` | — | Mark item 86'd (out of stock) |
| DELETE | `/products/:id/86` | — | Un-86 item (restore availability) |

Cache is invalidated on any write via `cacheDel('products:<merchantId>:*')`.

---

### 4.5 Categories (`/categories`)

Standard CRUD for category documents scoped to the merchant.

---

### 4.6 Orders (`/orders`)

| Method | Path | Query params | Description |
|--------|------|-------------|-------------|
| GET | `/orders` | storeId, page, limit, status, dateFrom, dateTo | Paginated order list |
| GET | `/orders/stats/summary` | — | Aggregate stats: totalOrders, todayOrders, pendingOrders, revenue (5-min cache) |
| GET | `/orders/:id` | — | Single order (with store + product population) |
| PATCH | `/orders/:id/status` | — | Update status (state machine enforced; body: `{ status, note }`) |

**Order state machine (merchant transitions only):**

The merchant can advance orders through a subset of states. The full state machine lives in `src/utils/orderStateMachine.ts`. Invalid transitions return:
```json
{
  "success": false,
  "message": "Invalid status transition: \"confirmed\" → \"delivered\". Allowed: [preparing]",
  "currentStatus": "confirmed",
  "validNextStatuses": ["preparing"]
}
```

---

### 4.7 POS (`/pos`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/pos/create-order` | Create a POS order (source: "pos", status: "completed") |
| GET | `/pos/products` | Active products for a store (with regex search, ReDoS-safe) |
| GET | `/pos/recent-orders` | Last 50 POS orders for a store |

**Required body for create-order:** `storeId`, `items[]`

---

### 4.8 Table Management (`/table-management`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/table-management/table-status` | All table configs for a store |
| PATCH | `/table-management/:tableId/status` | Update table status: available / occupied / reserved |
| POST | `/table-management/dine-in/start-order` | Open a dine-in TableSession |
| GET | `/table-management/table-orders/:tableId` | Active (open) session for a table |

---

### 4.9 Analytics (`/analytics`)

All results cached in Redis for 5 minutes. Period options: `week`, `month` (default), `quarter`, `year`.

| Method | Path | Query params | Description |
|--------|------|-------------|-------------|
| GET | `/analytics/overview` | period, storeId | Revenue, order counts, product summary |
| GET | `/analytics/sales/trends` | period, storeId | Daily revenue + order count time series |
| GET | `/analytics/sales/by-time` | period | Orders aggregated by hour of day |
| GET | `/analytics/revenue/breakdown` | period | Revenue by payment method |
| GET | `/analytics/products/performance` | period | Top 50 products by revenue |
| GET | `/analytics/customers/insights` | period | Customer spend summary + top 10 customers |
| POST | `/analytics/export` | — | Queue an export job (returns exportId) |

---

### 4.10 GST (`/gst`)

| Method | Path | Query params | Description |
|--------|------|-------------|-------------|
| GET | `/gst/gstr1` | storeId, month (YYYY-MM) | GSTR-1: total sales, tax, order count for month |
| GET | `/gst/gstr3b` | storeId, month (YYYY-MM) | GSTR-3B: taxable value, CGST, SGST, IGST for month |

---

### 4.11 Khata / Customer Credit (`/khata`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/khata` | List all credit accounts (search by name/phone) |
| POST | `/khata` | Add credit entry (upserts by phone; increments balance) |
| GET | `/khata/:customerId` | Single credit account |
| POST | `/khata/:customerId/payment` | Record payment (decrements balance) |

---

### 4.12 Payouts (`/payouts`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/payouts` | List payouts (filter: storeId, status) |
| GET | `/payouts/:id` | Single payout |
| POST | `/payouts` | Request payout (body: amount, bankAccountId, notes; status always starts as "pending") |
| PUT | `/payouts/:id` | Update notes only (only on pending payouts) |
| DELETE | `/payouts/:id` | Delete payout request |

Status transitions (pending → processing → completed/failed) are handled by rez-wallet-service, not here.

---

### 4.13 Staff Shifts (`/staff-shifts`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/staff-shifts` | List shifts (query: storeId, weekStart) |
| POST | `/staff-shifts` | Upsert weekly rota (body: storeId, staffId, staffName, weekStartDate, shifts[]) |
| GET | `/staff-shifts/:staffId/:weekStart` | Single staff member's rota for a week |
| DELETE | `/staff-shifts/:shiftId` | Delete rota entry |

---

### 4.14 Disputes (`/disputes`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/disputes` | List disputes for merchant's stores (filter: status) |
| GET | `/disputes/:id` | Single dispute (ownership-checked) |
| POST | `/disputes/:id/respond` | Submit merchant response (sets status to "under_review") |

---

### 4.15 Finance Domain (`/payroll`, `/expenses`, `/wallet`, `/khata`, `/waste`, `/subscription`, `/bulk-import`, `/bulk`, `/bizdocs`, `/purchase-orders`, `/suppliers`, `/corporate`)

All standard CRUD scoped to the authenticated merchant. See router file `src/routers/finance.ts` for the full route file map.

---

### 4.16 Campaigns Domain (`/broadcasts`, `/campaign-rules`, `/campaign-roi`, `/campaign-recommendations`, `/campaigns`, `/campaign-simulator`, `/attribution`, `/growth`, `/social-media`, `/customer-insights`)

Full campaign management: broadcast messages, rule-based triggers, ROI tracking, AI recommendations, A/B simulator, and attribution analysis.

---

### 4.17 Engagement Domain (`/offers`, `/cashback`, `/discounts`, `/discount-rules`, `/gift-cards`, `/store-vouchers`, `/punch-cards`, `/stamp-cards`, `/loyalty-tiers`, `/coins`, `/upsell-rules`, `/notifications`, `/events`, `/voucher-redemptions`, `/deal-redemptions`)

Complete customer loyalty stack: offers, cashback, discounts, gift cards, vouchers, punch cards, stamp cards, loyalty tier management, and coin operations.

---

### 4.18 Operations Domain (`/brands`, `/bundles`, `/dynamic-pricing`, `/recipes`, `/integrations`, `/store-visits`, `/floor-plan`)

Restaurant/retail operations: recipe management with ingredient tracking, floor plan editor, dynamic pricing rules, and third-party integrations.

---

### 4.19 Support Domain (`/support`, `/disputes`, `/audit`, `/fraud`, `/moderation`, `/liability`, `/services`, `/videos`, `/patch-tests`, `/prive`)

Dispute resolution, fraud signals, audit trails, content moderation, merchant liability tracking, and the Prive premium membership module.

---

### 4.20 Other Routes

| Domain | Routes |
|--------|--------|
| Dashboard | `/dashboard` — aggregated stats widget data |
| Uploads | `/uploads` — Multer + Cloudinary for product/store images |
| Sync | `/sync` — catalog sync triggers |
| Onboarding | `/onboarding` — 5-step onboarding wizard (business info → store details → bank details → documents → verification) |
| Outlets | `/outlets` — multi-outlet management |
| Merchants (admin) | `/merchants` — admin-level merchant list/status operations |

---

## 5. Background Jobs / Workers

rez-merchant-service does **not** run a BullMQ worker. It is a pure HTTP service. However, it **produces** side effects that downstream queues consume:

- On order status update: cache invalidation for dashboard data.
- On payout request creation: the wallet service polls pending payouts from MongoDB.
- On product write: cache entries are deleted immediately (synchronous, not queued).

---

## 6. Security Mechanisms

### 6.1 JWT Authentication (`src/middleware/auth.ts`)

```
Authorization: Bearer <token>
```

Token is also accepted from a `merchant_access_token` cookie. The JWT is signed with `JWT_MERCHANT_SECRET` and contains `{ merchantId, merchantUserId?, role, permissions }`. The decoded values are attached to `req.merchantId`, `req.merchantUserId`, `req.merchantRole`, `req.merchantPermissions`.

### 6.2 Internal Token (`src/middleware/internalAuth.ts`)

Service-to-service calls use `X-Internal-Token: <token>`. Validated with `crypto.timingSafeEqual` against `INTERNAL_SERVICE_TOKEN`. Nginx strips this header on inbound requests from outside, ensuring only co-located services can supply it.

### 6.3 Rate Limiting

- General: 100 requests / 15 minutes per IP.
- Auth routes (`/auth`, `/api/merchant/auth`): 10 requests / 15 minutes.
- Redis-backed store configured via `rate-limit-redis`.

### 6.4 Input Sanitization

- `express-mongo-sanitize`: strips `$` and `.` from user-supplied JSON to prevent NoSQL injection.
- Field allowlists on product create/update (`PRODUCT_CREATE_ALLOWED_FIELDS`, `PRODUCT_EDITABLE_FIELDS`) prevent mass-assignment attacks.
- Payout creation always forces `status: 'pending'` regardless of body content.
- Search queries use regex escaping to prevent ReDoS.

### 6.5 Encryption at Rest

Bank account details (`accountNumber`, `ifscCode`) in the Merchant onboarding step are encrypted with AES-256-GCM before every save (via a Mongoose `pre('save')` hook). API responses return masked versions (e.g., `****1234`). The `getDecryptedBankDetails()` instance method is for admin-only use.

### 6.6 CORS

Allowed origins are configured via `CORS_ALLOWED_ORIGINS` (comma-separated). `localhost` is always allowed. All other origins are rejected.

### 6.7 Security Headers

Helmet sets standard HTTP security headers on all responses.

---

## 7. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_MERCHANT_SECRET` | Yes | Secret for signing merchant JWTs |
| `JWT_SECRET` | Yes (if JWT_MERCHANT_SECRET not set) | Fallback JWT secret |
| `JWT_MERCHANT_EXPIRES_IN` | No | JWT TTL (default: `7d`) |
| `REDIS_URL` | No | Redis connection URL (default: `redis://localhost:6379`) |
| `PORT` | No | HTTP listen port (default: `4005`) |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated list of allowed CORS origins |
| `INTERNAL_SERVICE_TOKEN` | No | Shared secret for X-Internal-Token validation |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary account name (uploads) |
| `CLOUDINARY_API_KEY` | No | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No | Cloudinary API secret |
| `ENCRYPTION_KEY` | No | AES-256 key for bank detail encryption (32 bytes hex) |
| `SENTRY_DSN` | No | Sentry DSN for error tracking |
| `SENTRY_TRACES_SAMPLE_RATE` | No | Sentry trace sampling rate (default: `0.1`) |
| `NODE_ENV` | No | Environment label (default: `production`) |

---

## 8. Data Models

### Merchant (`merchants` collection)

| Field | Type | Notes |
|-------|------|-------|
| `businessName` | String | Required, max 100 chars |
| `ownerName` | String | Required, max 50 chars |
| `email` | String | Unique, lowercase |
| `password` | String | `select: false`; bcrypt hash |
| `phone` | String | Required |
| `businessAddress` | Object | street, city, state, zipCode, country, coordinates |
| `verificationStatus` | Enum | `pending` / `verified` / `rejected` |
| `isActive` | Boolean | Default true |
| `emailVerified` | Boolean | Default false |
| `failedLoginAttempts` | Number | Login lockout counter |
| `accountLockedUntil` | Date | Cleared on successful login |
| `refreshTokenHash` | String | SHA-256 of refresh token; `select: false` |
| `onboarding` | Object | 5-step wizard state; bankDetails are AES-256 encrypted |
| `currentPlan` | Enum | `starter` / `growth` / `pro` |
| `planExpiresAt` | Date | Subscription expiry |

**Virtual:** `computedStatus` derives `approved` / `suspended` / `rejected` / `pending` from `verificationStatus + isActive`.

**Indexes:** email (unique), verificationStatus, isActive, city, state, onboarding.status, phone.

### Order (`orders` collection)

| Field | Type | Notes |
|-------|------|-------|
| `orderNumber` | String | Unique |
| `user` | ObjectId | Ref: User |
| `store` | ObjectId | Ref: Store |
| `merchant` | ObjectId | Ref: Merchant |
| `items[]` | Array | product, name, image, quantity, price, subtotal, variant |
| `totals` | Object | subtotal, tax, delivery, discount, cashback, total, paidAmount, platformFee, merchantPayout |
| `payment` | Object | method, status, transactionId, paidAt |
| `status` | Enum | placed → confirmed → preparing → ready → dispatched → out_for_delivery → delivered → returned/refunded |
| `statusHistory[]` | Array | Audit trail of status changes with timestamps and notes |
| `deliveryAddress` | Mixed | — |
| `estimatedDelivery` | Date | — |

**Indexes:** `{ store, createdAt }`, `{ merchant, createdAt }`, `{ orderNumber }`.

### Product (`products` collection)

| Field | Type | Notes |
|-------|------|-------|
| `store` | ObjectId | Required |
| `merchant` | ObjectId | Required |
| `name` | String | Required, trimmed |
| `pricing` | Object | original, selling, discount, currency (INR), gst |
| `inventory` | Object | stock, isAvailable, lowStockThreshold, variants[], unlimited |
| `isActive` | Boolean | False = soft-deleted |
| `isVeg` | Boolean | For F&B |
| `sku` / `barcode` | String | Optional identifiers |
| `itemType` | String | Default: `product` |

**Text index:** name + description (powers `/products?search=`).

### CustomerCredit (`customercredits` collection) — Khata

| Field | Type | Notes |
|-------|------|-------|
| `merchantId` | ObjectId | Scoped to merchant |
| `customerPhone` | String | Unique key per merchant |
| `customerName` | String | — |
| `balance` | Number | Running balance (positive = owed to merchant) |
| `transactions[]` | Array | amount, type (credit/payment), note, date |
| `lastActivityAt` | Date | For sorting |

### StaffShift (`staffshifts` collection)

Upserted on `{ storeId, staffId, weekStartDate, merchantId }`. Stores per-day shift data for a full week.

### TableSession (`tablesessions` collection)

Tracks dine-in sessions: storeId, tableId, guestCount, merchantId, status (open/closed), openedAt, closedAt.

### Other collections

The service reads/writes ~60 additional collections including: `stores`, `categories`, `payouts`, `payrollrecords`, `expenses`, `supplierpurchaseorders`, `supplierrecords`, `wastelogs`, `recipes`, `discounts`, `offers`, `cashbacks`, `giftvouchers`, `loyaltytiers`, `punchcards`, `stampCards`, `broadcasts`, `disputerecords`, `auditlogs`, `fraudsignals`.

---

## 9. Local Development

### Prerequisites

- Node.js 20.x
- MongoDB (local or Atlas connection string)
- Redis (local or Upstash/Redis Cloud URL)

### Setup

```bash
cd rez-merchant-service

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
MONGODB_URI=mongodb://localhost:27017/rez_dev
JWT_MERCHANT_SECRET=dev_merchant_secret_min_32_chars_long
REDIS_URL=redis://localhost:6379
PORT=4005
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
INTERNAL_SERVICE_TOKEN=dev_internal_token
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
EOF

# Start in development mode (ts-node, no build required)
npm run dev
```

### Build and run compiled output

```bash
npm run build
npm start
```

### Test

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Type-check (no emit)

```bash
npm run lint
```

### Health check

```bash
curl http://localhost:4005/health
curl http://localhost:4005/health/live
curl http://localhost:4005/health/ready
```

---

## 10. Common Errors and Troubleshooting

### `[FATAL] Missing required env vars: MONGODB_URI`

Set `MONGODB_URI` in your `.env` file. The service calls `process.exit(1)` if either `MONGODB_URI` or a JWT secret is absent.

### `401 Authentication required` on all protected routes

Your JWT has expired (default TTL is 7 days) or the `JWT_MERCHANT_SECRET` does not match the one used to sign the token. Use `POST /auth/refresh` with a valid refresh token to obtain a new access token.

### `423 Account locked. Try again in N minutes`

The account has 5+ consecutive failed login attempts. Wait for the 30-minute lockout to expire or reset `failedLoginAttempts` and `accountLockedUntil` directly in MongoDB for development.

### `400 Invalid status transition`

The merchant is attempting an order status change that the state machine does not permit (e.g., jumping from `placed` to `delivered`). The response body includes `validNextStatuses` to show what transitions are allowed from the current status.

### `CORS: origin 'X' not allowed`

Add the origin to `CORS_ALLOWED_ORIGINS` in the environment. Localhost is always allowed regardless.

### `503 Internal auth not configured`

`INTERNAL_SERVICE_TOKEN` is not set. Set it to any string; it only needs to match across services.

### Redis cache not invalidating

If `cacheDel` calls return without error but stale data persists, verify the Redis URL is reachable and that the key pattern used in the `del` call (e.g., `products:<merchantId>:*`) is correct. Redis `DEL` with glob patterns requires a `SCAN + DEL` loop — check that your `cacheSet` helper uses the same key format.

### Bank details showing as `****`

This is intentional. The `toJSON` transform masks encrypted fields in all API responses. Use `merchant.getMaskedBankDetails()` to get the last-N-digits format or `merchant.getDecryptedBankDetails()` in admin-only code paths.

### Cloudinary upload errors

Verify `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` are set. Upload endpoints use Multer to receive the file in memory before forwarding to Cloudinary. Max JSON body size is 1 MB.

### High memory / slow start

The service registers ~89 route files through 9 aggregating routers. On cold start, all Mongoose models are compiled. This is expected overhead. On Render's free tier, cold starts may take 20–30 seconds on the first request.
