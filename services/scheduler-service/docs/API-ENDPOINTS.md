# ReZ Backend API Endpoints

Complete catalog of all API endpoints across ReZ microservices. All services behind the API Gateway accept requests with `/api` prefix stripped automatically.

Last updated: 2026-04-16

## Service Health Checks

All services expose health endpoints for monitoring:

- `GET /health` — Liveness check (process is alive)
- `GET /health/live` — Detailed liveness status
- `GET /health/ready` — Readiness check (dependencies OK)
- `GET /healthz` — Alias for `/health`

## Auth Service (port 4002)

Authentication, user management, OTP, PIN, JWT tokens.

- `POST /auth/otp/send` — Send OTP to phone number
- `POST /auth/otp/verify` — Verify OTP and create user if new
- `POST /auth/login-pin` — Login with PIN (for existing users)
- `GET /auth/has-pin` — Check if user has PIN set
- `POST /auth/set-pin` — Set or update user PIN
- `POST /auth/complete-onboarding` — Mark user as onboarded
- `PATCH /auth/profile` — Update user profile (name, email, etc.)
- `DELETE /auth/account` — Delete user account
- `POST /auth/admin/login` — Admin login (email + password)
- `POST /auth/guest` — Create guest session
- `POST /auth/refresh` — Refresh JWT token using refresh token
- `POST /auth/mfa/setup` — Setup MFA
- `POST /auth/mfa/verify` — Verify MFA
- `GET /health` — Health check

Note: Routes accept both direct paths (`/auth/*`) and gateway-prefixed paths (`/api/user/auth/*`).

## Order Service (port 3006)

Order management, order status tracking, streaming updates.

- `GET /health` — Liveness check
- `GET /health/live` — Process alive
- `GET /health/ready` — Deep readiness (MongoDB + Redis)
- `GET /orders` — List orders
  - Query params: `merchantId`, `userId`, `status`, `page` (default 1), `limit` (default 20)
  - Returns paginated orders with total count
- `GET /orders/stream` — Server-Sent Events stream for live order updates
  - Query params: `merchantId` (required)
  - Uses MongoDB change streams or polls if replica set unavailable
- `GET /orders/:id` — Get single order by ObjectId
- `GET /orders/summary/:userId` — Get order summary (30-day stats) — internal token required
- `PATCH /orders/:id/status` — Update order status with state machine validation
  - Body: `{ status: string }`
  - Valid transitions enforced: placed → confirmed → preparing → ready → dispatched → out_for_delivery → delivered
- `POST /orders/:id/cancel` — Cancel an order
  - Body: `{ reason?: string }`
  - Can only cancel orders in: placed, confirmed, preparing, ready, dispatched, out_for_delivery

All order routes require authentication (JWT or internal token).

## Payment Service (port 4001)

Payment initiation, capture, refund, status, Razorpay webhooks.

- `GET /health` — Health check
- `GET /health/live` — Liveness
- `GET /health/ready` — Readiness (MongoDB + Redis)
- `POST /pay/initiate` — Initiate payment
  - Body: `{ amount, userId, merchantId, orderId, ... }`
  - Returns: payment ID and Razorpay order details
- `POST /pay/capture` — Capture (complete) payment
  - Body: `{ paymentId, razorpayPaymentId, razorpayOrderId, ... }`
- `POST /pay/refund` — Refund payment
  - Body: `{ paymentId, amount?, reason? }`
- `GET /pay/status/:paymentId` — Get payment status
- `POST /pay/verify` — Verify payment signature
  - Body: `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }`
- `POST /pay/webhook/razorpay` — Razorpay webhook receiver (raw body for HMAC)

Routes also available under `/api/payment/*` prefix.

## Wallet Service (port 4003)

User wallet, transactions, payouts, credits, merchant wallets, credit scoring.

### Consumer Wallet
- `GET /api/wallet/balance` — Get user's current wallet balance and coin count
- `GET /api/wallet/transactions` — List wallet transactions (paginated)
  - Query: `page`, `limit`, `type` (credit/debit)
- `GET /api/wallet/summary` — Get wallet summary (balance, last transaction, etc.)
- `POST /api/wallet/credit` — Credit user's wallet (internal/admin)
  - Body: `{ userId, amount, coins, reason }`
- `POST /api/wallet/debit` — Debit from wallet
  - Body: `{ userId, amount, reason }`
- `POST /api/wallet/payment` — Pay from wallet (debit and create transaction)
  - Body: `{ userId, amount, metadata }`
- `POST /api/wallet/welcome-coins` — Award welcome bonus coins
  - Body: `{ userId, coins }`
- `GET /api/wallet/conversion-rate` — Get current coin ↔ rupee exchange rate

### Credit Score Routes
- `GET /api/wallet/credit-score/user/:userId` — Get user's credit score
- `POST /api/wallet/credit-score/recalculate` — Recalculate credit score
- `GET /api/wallet/credit-score/factors` — Get score calculation factors

### Merchant Wallet
- `GET /api/wallet/merchant/:merchantId/balance` — Merchant wallet balance
- `GET /api/wallet/merchant/:merchantId/transactions` — Merchant transaction history
- `POST /api/wallet/merchant/:merchantId/credit` — Credit merchant wallet

### Payouts
- `POST /api/wallet/payout/initiate` — Request payout to bank
  - Body: `{ merchantId, amount, bankAccountId }`
- `GET /api/wallet/payout/:payoutId` — Get payout status
- `GET /api/wallet/payouts` — List payouts (query: merchantId, status)

### Reconciliation
- `POST /api/wallet/reconciliation/sync` — Sync wallet with external payment system
- `GET /api/wallet/reconciliation/report` — Reconciliation report

- `GET /health` — Health check

## Finance Service (port 4005)

Credit offerings, borrowing, payment plans, partner integrations.

- `GET /health` — Health check
- `GET /api/credit/eligibility/:userId` — Check credit eligibility
- `POST /api/credit/apply` — Apply for credit
  - Body: `{ userId, loanAmount, tenure }`
  - Returns: eligibility, interest rate, monthly payment
- `GET /api/credit/offers/:userId` — Get personalized credit offers
- `GET /api/borrow/plans` — List available borrowing plans
- `POST /api/borrow/plan/:planId/accept` — Accept borrowing plan
  - Body: `{ userId, amount, tenure }`
- `GET /api/borrow/status/:userId` — Get user's borrowing status
- `POST /api/pay/emi` — Make EMI payment
  - Body: `{ userId, planId, amount }`
- `GET /api/partner/status` — Get partner integration status (internal)
- `POST /api/internal/rewards-hook` — Award coins on finance events (internal)

## Marketing Service (port 4006)

Campaign management, audience segmentation, broadcasts, analytics.

- `GET /health` — Health check
- `GET /api/campaigns` — List campaigns
  - Query: `merchantId`, `status`, `page`, `limit`
- `POST /api/campaigns` — Create campaign
  - Body: `{ name, description, budget, targetAudience, startDate, endDate }`
- `GET /api/campaigns/:id` — Get campaign details
- `PATCH /api/campaigns/:id` — Update campaign
- `DELETE /api/campaigns/:id` — Delete campaign
- `GET /api/audiences` — List audience segments
  - Query: `merchantId`, `page`, `limit`
- `POST /api/audiences` — Create audience segment
  - Body: `{ name, criteria: { age, location, purchaseHistory, ... } }`
- `GET /api/audiences/:id` — Get audience details
- `GET /api/broadcasts` — List broadcasts
- `POST /api/broadcasts` — Create broadcast
  - Body: `{ campaignId, audience, message, sendAt }`
- `GET /api/broadcasts/:id/status` — Get broadcast status
- `GET /api/analytics` — Campaign performance analytics
  - Query: `campaignId`, `startDate`, `endDate`
- `GET /api/adbazaar` — Ad marketplace endpoints
- `GET /api/keywords` — Ad keyword management
- `POST /api/keywords/suggest` — Get keyword suggestions

## Merchant Service (port 4007)

Merchant profiles, products, orders, analytics, team management, outlets.

**Note:** This is the largest service with 80+ routes. Listing key endpoints:

### Merchant Profile
- `GET /api/merchants/:id` — Get merchant profile
- `PATCH /api/merchants/:id` — Update merchant profile
- `GET /api/merchants/:id/dashboard` — Merchant dashboard (KPIs, charts)
- `GET /api/merchants/:id/analytics` — Merchant analytics and reports

### Products & Catalog
- `GET /api/merchants/:id/products` — List merchant products
  - Query: `category`, `status`, `page`, `limit`
- `POST /api/merchants/:id/products` — Create product
  - Body: `{ name, description, price, category, images }`
- `GET /api/merchants/:id/products/:productId` — Get product details
- `PATCH /api/merchants/:id/products/:productId` — Update product
- `DELETE /api/merchants/:id/products/:productId` — Delete product
- `GET /api/merchants/:id/categories` — List product categories
- `GET /api/merchants/:id/brands` — List merchant brands
- `POST /api/merchants/:id/variants` — Manage product variants
- `GET /api/merchants/:id/inventory` — Inventory status

### Orders
- `GET /api/merchants/:id/orders` — List merchant orders
- `PATCH /api/merchants/:id/orders/:orderId/status` — Update order status
- `GET /api/merchants/:id/order-summary` — Order summary stats

### Team & Outlets
- `GET /api/merchants/:id/team` — List team members
- `POST /api/merchants/:id/team` — Add team member
- `PATCH /api/merchants/:id/team/:memberId` — Update team member role/permissions
- `GET /api/merchants/:id/outlets` — List merchant outlets/stores
- `POST /api/merchants/:id/outlets` — Create outlet
- `PATCH /api/merchants/:id/outlets/:outletId` — Update outlet
- `GET /api/merchants/:id/outlets/:outletId/staff` — Outlet staff

### Promotions & Campaigns
- `GET /api/merchants/:id/campaigns` — List campaigns
- `POST /api/merchants/:id/campaigns` — Create campaign
- `GET /api/merchants/:id/discounts` — List discount rules
- `POST /api/merchants/:id/discounts` — Create discount
- `GET /api/merchants/:id/offers` — List offers
- `GET /api/merchants/:id/loyalty-config` — Loyalty program config
- `POST /api/merchants/:id/loyalty-tiers` — Manage loyalty tiers

### Finances & Payouts
- `GET /api/merchants/:id/payouts` — List payouts
- `POST /api/merchants/:id/payout-request` — Request payout
- `GET /api/merchants/:id/finances` — Financial summary (revenue, expenses, etc.)
- `GET /api/merchants/:id/settlements` — Settlement history

### Compliance & Documents
- `GET /api/merchants/:id/documents` — Business documents (KYC, GST, etc.)
- `POST /api/merchants/:id/documents` — Upload documents
- `GET /api/merchants/:id/compliance` — Compliance status

### Analytics & Intelligence
- `GET /api/merchants/:id/performance` — Performance metrics
- `GET /api/merchants/:id/customer-insights` — Customer behavior analytics
- `GET /api/merchants/:id/demand-signals` — Demand forecasting
- `GET /api/merchants/:id/fraud-detection` — Fraud alerts

- `GET /health` — Health check

## Catalog Service (port 4008)

Product catalog, categories, search, metadata.

- `GET /health` — Health check
- `GET /api/catalog/categories` — List product categories
  - Query: `parent`, `page`, `limit`
- `GET /api/catalog/categories/:id` — Get category details
- `GET /api/catalog/brands` — List brands
- `GET /api/catalog/products` — List products
  - Query: `category`, `brand`, `searchQuery`, `page`, `limit`, `sort`
- `GET /api/catalog/products/:id` — Get product details
- `GET /api/catalog/search` — Search products by name/description
- `GET /api/catalog/trending` — Get trending products
- `GET /api/catalog/:id` — Generic catalog item lookup

## Search Service (port 4009)

Full-text search, recommendations, search history.

- `GET /health` — Health check
- `GET /api/search` — Search across catalog
  - Query: `q` (search query), `filters` (category, brand, price), `page`, `limit`
- `GET /api/search/autocomplete` — Search suggestions
- `GET /api/search/recommendations` — Get product recommendations for user
  - Query: `userId`, `limit`
- `GET /api/search/trending` — Trending searches/products
- `GET /api/search/history` — Get user's search history
  - Query: `userId`, `limit`
- `POST /api/search/history` — Save search query to history
  - Body: `{ userId, query }`
- `POST /api/search/feedback` — Track search result click/conversion for ranking

## Scheduler Service (port 4010)

Job scheduling, cron jobs, async task orchestration.

- `GET /health` — Health check
- `POST /api/schedule` — Schedule a job
  - Body: `{ name, jobType, payload, scheduleTime, recurrence?, priority? }`
  - Returns: job ID
- `GET /api/schedule/:id` — Get job details and status
- `GET /api/schedule` — List scheduled jobs
  - Query: `status`, `type`, `page`, `limit`
- `PATCH /api/schedule/:id` — Update/reschedule job
  - Body: `{ scheduleTime?, recurrence?, priority? }`
- `DELETE /api/schedule/:id` — Cancel job
- `POST /api/schedule/:id/retry` — Manually retry failed job
- `GET /api/admin/schedule/stats` — Admin statistics (internal token)
  - Returns: success rate, average execution time, failures

## Notification Events (port 3001)

Background job worker service (BullMQ-based). No HTTP routes except health.

- `GET /health` — Health check
- `GET /health/ready` — Readiness check

**Note:** This service processes notifications, SMS, email, push asynchronously. Jobs enqueued by other services.

## Analytics Events (port 3002)

Event ingestion (web, mobile), merchant analytics, benchmarks.

- `GET /health` — Health check
- `GET /health/ready` — Readiness check
- `GET /metrics` — Prometheus metrics (internal token required)
  - Returns: process uptime, HTTP request count, error count
- `POST /api/analytics/web-events` — Ingest web events (fire-and-forget)
  - Body: `{ event: string, properties: object }`
  - Always returns 200 immediately
- `POST /api/analytics/batch` — Batch event ingestion from mobile app
  - Body: `{ events: [{ name, properties, userId, sessionId, timestamp }] }`
- `GET /api/analytics` — Merchant analytics data (internal token required)
  - Query: `merchantId`, `startDate`, `endDate`, `metric`
- `GET /api/analytics/merchant/:merchantId` — Merchant-specific analytics
- `GET /benchmarks` — Industry benchmarks (internal token required)
  - Query: `metric`, `category`, `timeRange`
- `GET /benchmarks/compare` — Compare merchant against benchmarks

## Karma Service (port 4011)

User karma points, gamification, leaderboards, verification.

- `GET /health` — Health check
- `GET /api/karma` — Get user's karma points
  - Query: `userId`
  - Returns: total points, level, rank, recent achievements
- `POST /api/karma` — Award karma to user (internal)
  - Body: `{ userId, points, action, description }`
- `GET /api/karma/leaderboard` — Global karma leaderboard
  - Query: `limit`, `offset`, `timeRange` (all-time, monthly, weekly)
- `GET /api/karma/leaderboard/friends` — Friend leaderboard
  - Query: `userId`, `limit`
- `POST /api/verify/:actionType` — Verify action eligibility for karma
  - Body: `{ userId, metadata }`
  - Returns: isEligible, reason
- `GET /api/karma/achievements` — Get user's achievements
  - Query: `userId`
- `POST /api/karma/checkout` — Karma-assisted checkout (Rez Now)
  - Body: `{ userId, orderId, paymentMethod }`

## API Gateway

The API Gateway (port 3000) routes requests to backend services:

- Gateway accepts `/api/*` paths and routes to appropriate service
- Prefix stripping: `/api/auth/*` → `rez-auth-service:/auth/*`
- Service discovery via environment variables or internal DNS
- Rate limiting, authentication middleware applied
- CORS configured for web clients

## Authentication

### User JWT Token
- Bearer token in `Authorization: Bearer <token>` header
- Decoded claims: `userId`, `role`, `iat`, `exp`
- Roles: `consumer`, `merchant`, `admin`, `super_admin`, `operator`

### Internal Service Token
- `X-Internal-Token` header
- Used for service-to-service calls
- Validates against `INTERNAL_SERVICE_TOKENS_JSON` (scoped per service)

### Public Routes
- Health endpoints require no authentication
- Web event ingestion (`/api/analytics/web-events`) allows anonymous
- Metrics require internal token

## Rate Limiting

Most POST/PATCH/DELETE routes rate-limited per user/IP:
- Auth routes: 5 requests/min per phone
- Wallet operations: 10 requests/min per user
- General: 30 requests/min per IP

## Response Format

Standard response envelope (most services):

```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "error": null
}
```

Error response:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE" /* optional */
}
```

Health check response:

```json
{
  "status": "ok" | "degraded" | "unhealthy",
  "service": "service-name",
  "checks": {
    "mongodb": "ok" | "error",
    "redis": "ok" | "error"
  },
  "uptime": 1234.567,
  "timestamp": "2026-04-16T10:30:00.000Z"
}
```
