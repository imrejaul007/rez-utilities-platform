# rez-wallet-service

Coin wallet and ledger service for the REZ platform. Manages consumer coin balances, merchant settlement wallets, double-entry ledger entries, payout lifecycle, and merchant credit scoring.

---

## 1. Purpose

`rez-wallet-service` is the single source of truth for all coin activity on the platform:

- Consumer wallet CRUD — balance, credit, debit, transaction history
- Welcome-coin issuance (50 nuqta on first registration)
- Merchant wallet management — credits from completed orders, withdrawal requests, bank details
- Payout lifecycle — request, process, fail (internal, called by finance/admin service)
- Double-entry ledger — every credit/debit writes a `platform_float ↔ user_wallet` pair to `ledgerentries`
- Reconciliation endpoint — compares `wallet.balance.available` vs `CoinTransaction` ledger sum
- Merchant credit scoring — assembles REZ operational data and returns a tiered credit score (bronze/silver/gold/platinum)
- Prometheus-compatible metrics exposed at `/metrics`

---

## 2. Tech Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript 5.x |
| Runtime | Node.js >= 20 |
| Framework | Express 4.x |
| Database | MongoDB (Mongoose 7.x) |
| Cache | Redis (ioredis 5.x) — balance cache (5 min TTL), sliding-window rate limiter |
| Queue | BullMQ 5 — optional worker (`worker.ts`) |
| Error tracking | Sentry (`@sentry/node` 7.x) |
| Logging | Winston |
| Tracing | W3C `traceparent` header propagation |

**Ports**

| Purpose | Default |
|---------|---------|
| HTTP API | `4004` |

---

## 3. Architecture

```
Mobile app / Web / Other services
            │
            ▼
     rez-api-gateway
            │
      ┌─────┴──────┐
      ▼            ▼
Consumer        Internal
routes          routes
(JWT auth)   (X-Internal-Token)
      │            │
      └─────┬──────┘
            ▼
   rez-wallet-service :4004
            │
   ┌────────┼────────────┐
   ▼        ▼            ▼
MongoDB   Redis      External calls
(wallets, (balance   (credit-score
 txns,    cache,     route only:
 ledger)  rate limit) analytics,
                      payment-svc,
                      merchant-svc)
```

**Callers of this service**
- `rez-api-gateway` — consumer and merchant wallet routes
- `rez-order-service` / `rezbackend` — `POST /internal/credit`, `POST /internal/debit`, `POST /internal/merchant/credit`
- `rez-finance-service` / admin — payout routes, reconcile endpoint
- `rez-gamification-service` — coin credits via internal route
- `rez-payment-service` — does not currently call wallet directly; wallet credit on payment capture is a planned integration

**Services this service calls (credit-score route only)**
- `analytics-events` — monthly revenue history
- `rez-payment-service` — merchant payment regularity
- `rez-merchant-service` — order stats, dispute rate, account age

---

## 4. All API Routes

Routes have dual-path aliases. Native path listed; compat path shown inline.

### Consumer Wallet Routes
All routes under this group require `Authorization: Bearer <consumer-jwt>`.

#### GET /balance
Compat: `GET /api/wallet/balance`

Returns current wallet balance including coins, branded coins, savings insights, and statistics. Result is cached in Redis for 5 minutes per user.

**Response 200**
```json
{
  "success": true,
  "data": {
    "balance": {
      "total": 1250,
      "available": 1200,
      "pending": 0,
      "cashback": 50
    },
    "rupeesEquivalent": 600.00,
    "pendingCashback": 50,
    "coins": [
      { "type": "nuqta", "amount": 1200, "isActive": true }
    ],
    "brandedCoins": [],
    "savingsInsights": {
      "totalSaved": 800,
      "thisMonth": 150,
      "avgPerVisit": 42.5,
      "lastCalculated": "2026-04-08T10:00:00.000Z"
    },
    "statistics": {
      "totalEarned": 2000,
      "totalSpent": 800,
      "totalCashback": 50,
      "transactionCount": 24
    },
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

#### GET /transactions
Compat: `GET /api/wallet/transactions`

**Query params:** `page=1`, `limit=20` (max 100), `coinType=nuqta`

**Response 200**
```json
{
  "success": true,
  "data": [...],
  "pagination": { "total": 48, "page": 1, "hasMore": true }
}
```

---

#### GET /summary
Compat: `GET /api/wallet/summary`

Returns aggregated credit/debit totals for all-time and current month.

**Response 200**
```json
{
  "success": true,
  "data": {
    "allTime": [
      { "_id": "credit", "total": 2000, "count": 18 },
      { "_id": "debit", "total": 800, "count": 6 }
    ],
    "thisMonth": [
      { "_id": "credit", "total": 300, "count": 4 }
    ]
  }
}
```

---

#### POST /credit
Compat: `POST /api/wallet/credit`

**Authorization:** JWT required; only `admin`, `super_admin`, `operator` roles may call this consumer-facing route. All other roles receive 403. For service-to-service credits use `POST /internal/credit`.

**Request body**
```json
{
  "amount": 100,
  "coinType": "nuqta",
  "source": "admin",
  "description": "Promotional credit",
  "sourceId": "promo_event_123",
  "merchantId": "64a...",
  "idempotencyKey": "promo-event-user-xyz-001"
}
```

**Response 200** `{ "success": true, "data": { "balance": 1300, "transactionId": "64b..." } }`

---

#### POST /debit
Compat: `POST /api/wallet/payment`

**Rate limit:** 10 debit operations per minute per user (sliding-window, Redis sorted sets, fail-open if Redis is down)

**Request body**
```json
{
  "amount": 50,
  "coinType": "nuqta",
  "source": "order",
  "description": "Order #REZ-1234 payment",
  "sourceId": "order_64a...",
  "idempotencyKey": "debit-order-64a-user-xyz"
}
```

**Response 200** `{ "success": true, "data": { "balance": 1150, "transactionId": "64c..." } }`

**Error 400** — `"Insufficient balance"` or `"Wallet is frozen"`  
**Error 429** — Rate limit exceeded (10 debits/min)

---

#### POST /welcome-coins
Compat: `POST /api/wallet/welcome-coins`

Credits 50 nuqta coins with idempotency key `welcome_<userId>` — safe to call multiple times; only credits once.

**Rate limit:** 3 requests per day per user

**Response 200** `{ "success": true, "data": { "balance": 50, "transactionId": "..." } }`

**Error 400** — If already credited (idempotency key duplicate)

---

#### GET /conversion-rate
Compat: `GET /api/wallet/conversion-rate`

Returns the current coin-to-rupee exchange rate. No auth required (read-only public info, but still goes through auth middleware from the router-level `requireAuth`).

**Response 200**
```json
{
  "success": true,
  "data": {
    "coinToRupeeRate": 0.5,
    "exampleConversion": { "coins": 100, "rupees": 50.00 }
  }
}
```

---

### Merchant Wallet Routes
All routes require `Authorization: Bearer <jwt>` with role `merchant`, `admin`, `super_admin`, or `operator`.

The merchant ID is resolved from `req.merchantId` (set by auth middleware from the JWT `merchantId` claim) with fallback to `req.userId`.

#### GET /merchant-wallet/
Compat: `GET /api/merchant/wallet`

Returns merchant wallet balance and statistics.

**Response 200**
```json
{
  "success": true,
  "data": {
    "balance": { "total": 45000, "available": 42000, "pending": 3000, "withdrawn": 0 },
    "statistics": {
      "totalSales": 150000,
      "totalPlatformFees": 7500,
      "netSales": 142500,
      "totalOrders": 312,
      "totalWithdrawals": 0
    }
  }
}
```

---

#### GET /merchant-wallet/transactions
Compat: `GET /api/merchant/wallet/transactions`

**Query params:** `page=1`, `limit=20` (max 100)

---

#### POST /merchant-wallet/withdraw
Compat: `POST /api/merchant/wallet/withdraw`

**Request body** `{ "amount": 10000 }`

Creates a withdrawal request record in `MerchantWalletTransaction`. Moving balance to `pending` and then to `withdrawn` happens via the payout routes when admin processes it.

---

#### GET /merchant-wallet/withdrawals
Compat: `GET /api/merchant/wallet/withdrawals`

**Query params:** `page=1`, `limit=20`, `status=pending|processed|failed`

Returns withdrawal request history with full pagination metadata.

---

#### PUT /merchant-wallet/bank-details
Compat: `PUT /api/merchant/wallet/bank-details`

**Request body**
```json
{
  "accountNumber": "1234567890",
  "ifscCode": "HDFC0001234",
  "accountHolderName": "Merchant Name",
  "bankName": "HDFC Bank",
  "upiId": "merchant@upi"
}
```
IFSC code is validated against `/^[A-Z]{4}0[A-Z0-9]{6}$/`.

---

#### GET /merchant-wallet/stats
Compat: `GET /api/merchant/wallet/stats`

Returns aggregated performance statistics for the merchant.

---

### Internal Routes
All routes at `/internal/*` require `X-Internal-Token` and `X-Internal-Service` headers.

#### POST /internal/credit
Credit coins to a user's wallet. Called by order service, gamification service, etc.

**Hard cap:** amount must be ≤ 1,000,000 coins per operation.

**Request body**
```json
{
  "userId": "64a...",
  "amount": 150,
  "coinType": "nuqta",
  "source": "order",
  "description": "Loyalty reward for order #REZ-5678",
  "sourceId": "order_64a...",
  "merchantId": "64b...",
  "idempotencyKey": "credit-order-64a-150",
  "operationType": "loyalty_credit",
  "referenceModel": "Order"
}
```
`coinType` accepts `nuqta`, `prive`, `branded`, `promo`. The legacy alias `rez` is normalized to `nuqta`.

**Response 200** `{ "success": true, "data": { "balance": 1350, "transactionId": "64c..." } }`

---

#### POST /internal/debit
Debit coins from a user's wallet.

**Request body** — same shape as `/internal/credit` minus `merchantId`

**Error 400** — `"Insufficient balance"` or `"Wallet is frozen"`

---

#### GET /internal/balance/:userId
Get a user's current wallet balance for service-to-service use. Returns the same shape as consumer `GET /balance`.

---

#### POST /internal/merchant/credit
Credit to a merchant wallet after an order completes.

**Idempotency:** enforced via unique index on `MerchantWalletTransaction.orderId`. A duplicate `orderId` returns the existing balance without crediting again.

**Request body**
```json
{
  "merchantId": "64a...",
  "storeId": "64b...",
  "amount": 500,
  "platformFee": 25,
  "orderId": "64c...",
  "orderNumber": "REZ-5678",
  "description": "Order REZ-5678 completed"
}
```
Net credited amount = `amount - platformFee`.

**Response 200** `{ "success": true, "data": { "balance": { ... } } }`

---

#### GET /internal/reconcile
Wallet reconciliation tool — compares `wallet.balance.available` against CoinTransaction ledger sum for each wallet.

**Query params:** `limit=100` (max 100), `threshold=0.01`

**Response 200**
```json
{
  "success": true,
  "summary": {
    "walletsChecked": 100,
    "discrepanciesFound": 2,
    "threshold": 0.01,
    "limit": 100,
    "generatedAt": "2026-04-08T10:00:00.000Z"
  },
  "discrepancies": [
    {
      "walletId": "64a...",
      "userId": "64b...",
      "walletBalance": 1000,
      "ledgerBalance": 950,
      "diff": 50.0,
      "isFrozen": false
    }
  ]
}
```

---

### Payout Routes (Internal)
All payout routes require `X-Internal-Token`. Routes are at root level (no `/internal` prefix).

#### GET /payouts
List merchant payout history.

**Query params:** `merchantId` (required), `page=1`, `limit=20`

#### POST /payouts/request
Create a payout request. Sets status to `pending`.

**Request body** `{ "merchantId": "...", "storeId": "...", "amountPaise": 10000, "bankAccountId": "..." }`

#### GET /payouts/pending
List all pending payouts across all merchants (admin dashboard use).

#### PATCH /payouts/:id/process
Mark a payout as processed. Moves `amountPaise` from `balance.pending` to `balance.withdrawn` on the merchant wallet.

**Request body** `{ "transactionRef": "NEFT12345" }` (optional)

#### PATCH /payouts/:id/fail
Mark a payout as failed. Returns funds from `balance.pending` back to `balance.available`.

**Request body** `{ "reason": "Bank rejected" }` (optional)

---

### Credit Score Route (Internal)

#### GET /credit-score/:merchantId
Requires `X-Internal-Token`. Computes and returns a merchant credit score derived from REZ operational data. Results cached in-process for 24 hours.

**Response 200** (eligible)
```json
{
  "success": true,
  "cached": false,
  "data": {
    "score": 72,
    "tier": "gold",
    "maxCreditLine": 75000,
    "recommendedTenor": 30,
    "eligibleForSupplierTerms": true,
    "factors": [
      { "factor": "Revenue Stability", "impact": "positive", "description": "Consistent monthly revenue (avg ₹42,000)" },
      { "factor": "Payment Regularity", "impact": "positive", "description": "88% of payments made on time" },
      { "factor": "Dispute Rate", "impact": "neutral", "description": "1.2% dispute rate — slightly above ideal" },
      { "factor": "Account Age", "impact": "neutral", "description": "8 months of REZ history" },
      { "factor": "Supplier Order Frequency", "impact": "positive", "description": "15.0 orders/month — strong supplier engagement" }
    ],
    "computedAt": "2026-04-08T10:00:00.000Z",
    "dataMonthsAvailable": 8
  }
}
```

**Response 200** (ineligible — less than 3 months data)
```json
{
  "success": true,
  "ineligible": true,
  "reason": "Only 2 month(s) of data available...",
  "dataMonthsAvailable": 2
}
```

**Scoring weights:**

| Factor | Weight | Source |
|--------|--------|--------|
| Revenue stability (coefficient of variation) | 30% | analytics-events service |
| Payment regularity (on-time rate 0-1) | 25% | rez-payment-service |
| Dispute rate (fraction of orders) | 20% | rez-merchant-service |
| Account age (months on platform) | 15% | rez-merchant-service |
| Supplier order frequency (orders/month) | 10% | rez-merchant-service |

**Credit tiers:**

| Score range | Tier | Max credit line | Tenor |
|-------------|------|-----------------|-------|
| 0-40 | bronze | ₹0 | 15 days |
| 41-60 | silver | ₹25,000 | 15 days |
| 61-80 | gold | ₹75,000 | 30 days |
| 81-100 | platinum | ₹2,00,000 | 45 days |

---

### Health

#### GET /health/live
Liveness probe — always returns 200 while the process is alive.

#### GET /health/ready
Readiness probe — checks MongoDB ping and Redis ping. Returns 503 if MongoDB is down.

#### GET /health
Backward-compatible health check. Returns 503 if MongoDB is disconnected.

#### GET /healthz
Simple `{ "status": "ok" }` for basic load balancer checks.

#### GET /metrics
Requires `X-Internal-Token`. Returns Prometheus text-format metrics:
- `http_requests_total`, `http_errors_total`
- `wallet_transactions_total{type="..."}` 
- `wallet_balance_operations_total{op="credit"|"debit"}`
- `wallet_http_requests_total{method,route,status}`
- `wallet_http_duration_seconds_sum`, `wallet_http_duration_seconds_count`

---

## 5. Background Jobs / Workers

### BullMQ Worker (`worker.ts`)
An optional BullMQ worker is loaded dynamically at startup and at shutdown (`stopWalletWorker()`). The queue name and job types depend on which events are configured in `worker.ts`. The worker is gracefully drained before process exit.

### No cron jobs
This service does not have any scheduled cron tasks.

---

## 6. Security Mechanisms

### Auth Middleware (`middleware/auth.ts`)
Verifies consumer JWTs using `JWT_SECRET`. Attaches `req.userId`, `req.userRole`, and `req.merchantId` to the request.

### Internal Auth (`middleware/internalAuth.ts`)
Scoped token map from `INTERNAL_SERVICE_TOKENS_JSON`. Timing-safe comparison via `crypto.timingSafeEqual`. Falls back to legacy `INTERNAL_SERVICE_TOKEN` if no map is configured.

### Sliding-Window Debit Rate Limiter
Implemented directly in `walletRoutes.ts` using Redis sorted sets:
- Key: `rl:wallet:debit:<userId>`
- Window: 60,000 ms
- Limit: 10 operations
- Behavior: **fail-open** when Redis is unavailable (allows through to prevent blocking payments during Redis downtime)

### Welcome Coins Rate Limit
- Key: `rl:wallet:welcome:<userId>`
- Window: 24 hours
- Limit: 3 requests
- Idempotency key `welcome_<userId>` in the service layer also ensures only one credit lands

### Atomic Coin Operations
Both `creditCoins` and `debitCoins` use MongoDB sessions (transactions) with:
- Idempotency check inside the transaction (prevents TOCTOU race)
- Atomic balance update with guard conditions (`balance.available: { $gte: amount }` and `isFrozen: { $ne: true }`)
- Double-entry ledger pair written inside the same session

### Balance Cache Invalidation
Redis balance cache (`wallet:balance:<userId>`, 5-min TTL) is deleted immediately after any credit or debit, before the response is sent.

### Coin Operation Hard Cap
All internal credit/debit calls enforce `amount ≤ 1,000,000` to prevent runaway coin issuance from misconfigured callers.

### CORS / Helmet
Standard helmet headers. CORS origin from `CORS_ORIGIN` env var.

---

## 7. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `INTERNAL_SERVICE_TOKENS_JSON` | JSON map of caller service tokens for internal routes |

One of `INTERNAL_SERVICE_TOKENS_JSON` or `INTERNAL_SERVICE_TOKEN` must be set.

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4004` | HTTP API port |
| `NODE_ENV` | `production` | Environment label |
| `CORS_ORIGIN` | `https://rez.money` | Comma-separated allowed CORS origins |
| `JWT_SECRET` | — | Required for consumer auth middleware to decode tokens |
| `JWT_MERCHANT_SECRET` | — | Required for merchant token verification |
| `JWT_ADMIN_SECRET` | — | Required for admin token verification |
| `COIN_TO_RUPEE_RATE` | `0.50` | Coin-to-rupee conversion rate (must be in range (0, 10]) |
| `ANALYTICS_EVENTS_URL` | `https://analytics-events-37yy.onrender.com` | Used by credit-score route |
| `REZ_PAYMENT_SERVICE_URL` | `https://rez-payment-service.onrender.com` | Used by credit-score route |
| `REZ_MERCHANT_SERVICE_URL` | `https://rez-merchant-service-n3q2.onrender.com` | Used by credit-score route |
| `SENTRY_DSN` | — | Sentry DSN; omit to disable |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | Sentry trace sampling (0–1) |
| `INTERNAL_SERVICE_TOKEN` | — | Legacy single token (deprecated) |

---

## 8. Data Models

### `wallets` collection (Wallet model)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `user` | ObjectId | Unique index — one wallet per user |
| `balance.total` | number | All coins including pending |
| `balance.available` | number | Spendable coins |
| `balance.pending` | number | Coins not yet settled |
| `balance.cashback` | number | Pending cashback |
| `coins` | array | Per-type coin buckets (`rez`/`nuqta`, `prive`, `branded`, `promo`) |
| `coins[].type` | string | Coin type enum |
| `coins[].amount` | number | Balance for this coin type |
| `coins[].expiryDate` | Date | Optional expiry |
| `brandedCoins` | array | Merchant-specific coin balances |
| `brandedCoins[].merchantId` | ObjectId | |
| `brandedCoins[].amount` | number | |
| `brandedCoins[].expiresAt` | Date | 6-month expiry set at earn time |
| `statistics.totalEarned` | number | |
| `statistics.totalSpent` | number | |
| `statistics.transactionCount` | number | |
| `savingsInsights.totalSaved` | number | |
| `savingsInsights.thisMonth` | number | |
| `isActive` | boolean | |
| `isFrozen` | boolean | Frozen wallets block both credit and debit |

**Indexes:** `{ user: 1 }` unique

### `cointransactions` collection (CoinTransaction model)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `user` | ObjectId | |
| `type` | string | `credit` or `debit` |
| `coinType` | string | `nuqta`, `prive`, `branded`, `promo` |
| `amount` | number | |
| `balanceBefore` | number | Snapshot for audit |
| `balanceAfter` | number | Snapshot for audit |
| `source` | string | e.g. `order`, `cashback`, `referral`, `admin` |
| `sourceId` | string | ID of the source entity (orderId, etc.) |
| `description` | string | Human-readable |
| `merchantId` | ObjectId | Optional |
| `idempotencyKey` | string | Unique sparse index — prevents duplicate credits/debits |

**Indexes:**
- `{ user: 1, createdAt: -1 }` — transaction history queries
- `{ user: 1, coinType: 1, createdAt: -1 }` — type-filtered history
- `{ idempotencyKey: 1 }` unique sparse — deduplication
- `{ sourceId: 1 }` — lookup by order/source

### `merchantwallets` collection (MerchantWallet model)

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `merchant` | ObjectId | Ref to User |
| `store` | ObjectId | Ref to Store |
| `balance.total` | number | |
| `balance.available` | number | Available for withdrawal |
| `balance.pending` | number | In-flight withdrawals |
| `balance.withdrawn` | number | Historical total withdrawn |
| `statistics.totalSales` | number | |
| `statistics.totalPlatformFees` | number | |
| `statistics.netSales` | number | |
| `statistics.totalOrders` | number | |
| `statistics.totalWithdrawals` | number | |
| `bankDetails` | object | accountNumber, ifscCode, accountHolderName, bankName, upiId |
| `lastSettlementAt` | Date | |

### `merchantwallettransactions` collection

| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | |
| `merchantId` | ObjectId | Ref to MerchantWallet._id |
| `type` | string | `credit`, `debit`, `withdrawal` |
| `amount` | number | Gross amount |
| `platformFee` | number | |
| `netAmount` | number | `amount - platformFee` |
| `orderId` | ObjectId | Unique sparse index — idempotency on merchant credit |
| `orderNumber` | string | |
| `status` | string | `pending`, `completed`, `failed` |

**Key index:** `{ orderId: 1 }` unique sparse — prevents double-crediting same order

### `ledgerentries` collection (raw, written by walletService)

Double-entry bookkeeping. Every coin operation produces two entries.

| Field | Type | Notes |
|-------|------|-------|
| `pairId` | string | UUID linking the two sides of a double entry |
| `accountType` | string | `user_wallet` or `platform_float` |
| `accountId` | ObjectId | Wallet ID or platform float constant |
| `direction` | string | `credit` or `debit` |
| `amount` | number | |
| `coinType` | string | (`prive` is mapped to `nuqta` in the ledger) |
| `operationType` | string | e.g. `loyalty_credit`, `order_coin_deduction`, `cashback` |
| `referenceId` | string | idempotencyKey or sourceId or transactionId |
| `referenceModel` | string | e.g. `Order`, `WalletService` |
| `yearMonth` | string | `YYYY-MM` partition key |
| `metadata.microservice` | string | `rez-wallet-service` |

### `merchantpayouts` collection (raw, written by payoutRoutes)

| Field | Type | Notes |
|-------|------|-------|
| `merchantId` | string | |
| `storeId` | string | |
| `amountPaise` | number | In paise (1/100 rupee) |
| `status` | string | `pending`, `processed`, `failed` |
| `requestedAt` | Date | |
| `processedAt` | Date | |
| `transactionRef` | string | Bank NEFT/IMPS reference |
| `bankAccountId` | string | Optional |

### Redis key schema

| Key pattern | Value | TTL | Purpose |
|-------------|-------|-----|---------|
| `wallet:balance:<userId>` | JSON string | 5 min | Balance cache |
| `rl:wallet:debit:<userId>` | sorted set | 60 s (pexpire) | Debit rate limiter |
| `rl:wallet:welcome:<userId>` | sorted set | 24 h | Welcome-coins rate limiter |

---

## 9. Local Development

### Prerequisites
- Node.js >= 20
- MongoDB with replica set (required for multi-document transactions in creditCoins/debitCoins)
- Redis

### Setup
```bash
cd rez-wallet-service
cp .env.example .env   # if exists, otherwise create manually
npm install
npm run dev            # ts-node src/index.ts
```

**Minimal `.env` for local dev**
```env
MONGODB_URI=mongodb://localhost:27017/rez?replicaSet=rs0
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-consumer
JWT_MERCHANT_SECRET=dev-secret-merchant
JWT_ADMIN_SECRET=dev-secret-admin
INTERNAL_SERVICE_TOKENS_JSON={"rez-test-service":"dev-internal-token"}
COIN_TO_RUPEE_RATE=0.50
PORT=4004
```

> MongoDB must be running as a replica set (even a single-node `rs0`) because `creditCoins` and `debitCoins` use `mongoose.startSession()` for multi-document transactions.

**Starting a single-node replica set locally:**
```bash
mongod --replSet rs0 --dbpath /tmp/mongo-rs0 --port 27017
# In mongo shell:
rs.initiate()
```

### Build and lint
```bash
npm run build    # tsc
npm run lint     # tsc --noEmit
npm test         # node --test test (if test/ directory exists)
```

---

## 10. Common Errors and Troubleshooting

### `Transaction numbers are only allowed on a replica set member or mongos`
MongoDB is running in standalone mode. The creditCoins and debitCoins functions require transactions. Start MongoDB with a replica set configuration (see local dev section above).

### `[FATAL] Missing required env vars: MONGODB_URI, REDIS_URL`
Service exits immediately. Check environment configuration.

### `[FATAL] COIN_TO_RUPEE_RATE=15 is outside valid range`
`COIN_TO_RUPEE_RATE` must be in `(0, 10]`. This check runs at module import time and will crash the service on startup if the value is misconfigured.

### Balance cache showing stale data
The Redis balance cache has a 5-minute TTL and is deleted on every credit/debit. If a direct MongoDB write was made without going through `walletService.ts`, the cache will be stale. Manually delete the key: `DEL wallet:balance:<userId>`.

### Merchant credit returning `idempotent: true` unexpectedly
The unique index on `MerchantWalletTransaction.orderId` means the same `orderId` can only be credited once. If you need to re-credit (e.g. after a rollback), you must delete the existing `MerchantWalletTransaction` document for that `orderId` first.

### Debit rate limit being hit in load tests
The debit limiter is **fail-open** (allows through) when Redis is down, but in normal operation it enforces 10 debits/minute. For load testing, temporarily remove the rate limit check or use different `userId` values per test user.

### Reconciliation showing large discrepancies for new wallets
Wallets created via `getOrCreateWallet` start with balance 0 but may have zero `CoinTransaction` records. `ledgerBalance` will be 0 and `walletBalance` will be 0 — these show diff = 0 and are not flagged. Discrepancies appear when a direct MongoDB update modified `balance.available` without creating a corresponding `CoinTransaction`. Fix with a compensating credit/debit via internal routes.

### Credit score route returning stale data
The credit score is cached in-process (Node.js `Map`) for 24 hours. Cache survives process restarts only if the process doesn't restart. To force a fresh score, there is no invalidation API — restart the service or wait for cache expiry.

### Internal routes returning 401 with correct token
Check that `X-Internal-Service` header matches the key in `INTERNAL_SERVICE_TOKENS_JSON`. The middleware requires both the header and the matching token. Verify: `curl -H "X-Internal-Service: rez-order-service" -H "X-Internal-Token: <token>" http://localhost:4004/internal/balance/<userId>`.
