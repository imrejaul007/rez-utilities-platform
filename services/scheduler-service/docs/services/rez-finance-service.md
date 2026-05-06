# rez-finance-service

## 1. Purpose, Tech Stack, and Architecture Position

**Purpose**: Provides embedded financial services within the REZ app: credit scoring, loan applications, Buy Now Pay Later (BNPL), bill payment, mobile recharge, and partner offer management. The REZ Score is a proprietary behavioral credit score (300–850 range) calculated from the user's transaction history, visit frequency, wallet balance, and payment behavior — distinct from a bureau CIBIL score (bureau integration is planned for Phase 2).

**Architecture position**: Consumer-facing API server for the REZ app. Depends on rez-wallet-service (to award coins) and rez-backend's order data (for 30-day spend signals). Receives partner status updates via webhooks from FinBox and partner banks. Exposes internal endpoints called by rez-backend, Hotel OTA, and Resturistan during checkout flows.

**Tech stack**:
- Runtime: Node.js 20+, TypeScript
- Framework: Express 4
- Database: MongoDB via Mongoose 8
- Cache: Redis (IORedis) — score caching, reward deduplication
- Queue: BullMQ 5 (imported but jobs are enqueued by producers, not this service)
- Validation: Zod
- Error tracking: Sentry (optional)
- Background jobs: `node-cron`
- Security: Helmet, CORS, HMAC webhook verification, JWT authentication
- Default HTTP port: **4005**
- Health server port: **4105**

---

## 2. API Routes

### Consumer-facing routes (JWT Bearer token auth)

All routes under `/finance/borrow`, `/finance/credit`, and `/finance/pay` use the `authenticateUser` middleware. The JWT is signed with `JWT_SECRET` and must contain `userId`, `_id`, or `id` as the user identifier claim.

---

#### Borrow Routes — `/finance/borrow`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/finance/borrow/offers` | List pre-approved loan/card offers for the user |
| POST | `/finance/borrow/apply` | Apply for a loan or credit card |
| GET | `/finance/borrow/applications` | List user's loan applications |
| GET | `/finance/borrow/applications/:id` | Get a single application |
| POST | `/finance/borrow/bnpl/check` | Check BNPL eligibility for an order amount |
| POST | `/finance/borrow/bnpl/create` | Create a BNPL order |

**GET /finance/borrow/offers**

Triggers a background offer refresh for the user (fire-and-forget), then returns active pre-approved offers from `PartnerOffer` collection.

Response:
```json
{
  "success": true,
  "offers": [
    {
      "partnerId": "finbox",
      "type": "personal_loan",
      "maxAmount": 150000,
      "interestRate": 14.5,
      "tenure": 24,
      "expiresAt": "..."
    }
  ]
}
```

**POST /finance/borrow/apply**

Validated by Zod schema:
```json
{
  "partnerOfferId": "string (required)",
  "amount": "number > 0 (required)",
  "tenure": "integer > 0 (required — months)",
  "context": {
    "screen": "string",
    "orderId": "string (optional)",
    "bookingId": "string (optional)"
  }
}
```

Response (201):
```json
{
  "success": true,
  "application": { "...LoanApplication document..." },
  "redirectUrl": "https://finbox.in/apply/..."
}
```

**POST /finance/borrow/bnpl/check**

Check if the user is eligible for BNPL on a specific order amount.

```json
{ "amount": 2500, "orderId": "order123" }
```

Response:
```json
{
  "success": true,
  "eligible": true,
  "bnplLimit": 10000,
  "availableLimit": 7500
}
```

**POST /finance/borrow/bnpl/create**

```json
{
  "amount": 2500,
  "orderId": "order123",
  "merchantId": "merchant456 (optional)"
}
```

Response (201):
```json
{
  "success": true,
  "transaction": { "...FinanceTransaction document..." }
}
```

---

#### Credit Routes — `/finance/credit`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/finance/credit/score` | Get user's REZ Score + eligibility bands + tips |
| POST | `/finance/credit/score/check` | Check score and earn daily coins reward |
| POST | `/finance/credit/score/refresh` | Force a score recalculation |

**GET /finance/credit/score**

Returns cached score (6-hour TTL in Redis). Auto-refreshes if score is older than 24 hours.

Response:
```json
{
  "success": true,
  "rezScore": 720,
  "bureauScore": null,
  "bureauProvider": null,
  "eligibility": {
    "maxLoanAmount": 216000,
    "maxCreditCardLimit": 144000,
    "bnplEnabled": true,
    "bnplLimit": 10000
  },
  "tips": ["Great profile! You are eligible for our best offers."],
  "updatedAt": "2026-04-08T10:00:00.000Z"
}
```

**POST /finance/credit/score/check**

Awards coins once per calendar day (dedup key: `finance:score_reward:{userId}:{YYYY-MM-DD}`, 24-hour TTL). Coin amount configured by `COINS_CREDIT_SCORE_CHECK` (default 10).

Response:
```json
{
  "success": true,
  "rezScore": 720,
  "coinsAwarded": 10
}
```

---

#### Pay Routes — `/finance/pay`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/finance/pay/billers` | List supported billers |
| POST | `/finance/pay/bill` | Pay a bill |
| POST | `/finance/pay/recharge` | Mobile/FASTag recharge |
| GET | `/finance/pay/transactions` | User's last 30 pay transactions |

**GET /finance/pay/billers** (no auth required — static catalog)

Response:
```json
{
  "success": true,
  "billers": [
    { "id": "jio", "name": "Jio", "type": "mobile", "logoUrl": "/logos/jio.png" },
    { "id": "airtel", "name": "Airtel", "type": "mobile", "logoUrl": "/logos/airtel.png" },
    { "id": "bsnl", "name": "BSNL", "type": "mobile", "logoUrl": "/logos/bsnl.png" },
    { "id": "fastag", "name": "FASTag", "type": "fastag", "logoUrl": "/logos/fastag.png" },
    { "id": "bescom", "name": "BESCOM (Electricity)", "type": "electricity", "logoUrl": "/logos/bescom.png" },
    { "id": "bwssb", "name": "BWSSB (Water)", "type": "water", "logoUrl": "/logos/bwssb.png" }
  ]
}
```

Note: Phase 1 stub — no real payment gateway. `status` is set to `success` immediately. Phase 2 will integrate a live aggregator.

**POST /finance/pay/bill**

```json
{ "billerId": "jio", "accountNumber": "9876543210", "amount": 299 }
```

Awards 5 coins on success via `rewardsHookService.awardCoins()`.

**POST /finance/pay/recharge**

```json
{ "operator": "airtel", "accountNumber": "9876543210", "amount": 399 }
```

Awards 5 coins on success.

---

### Partner webhook routes — `/finance/partner/webhook`

Per-partner HMAC signature verification. The secret is resolved from an environment variable named `PARTNER_WEBHOOK_SECRET_{PARTNER_ID_UPPERCASE}` (e.g. for partner `finbox`: `PARTNER_WEBHOOK_SECRET_FINBOX`).

Verification uses `X-Partner-Signature` header (accepts both `sha256={hex}` and plain hex). Raw body is captured via `verify` callback in `express.json()` and stored as `req.rawBody`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/finance/partner/webhook/:partnerId/application` | Application status update from partner |
| POST | `/finance/partner/webhook/:partnerId/disbursal` | Disbursal confirmation from partner |

If the webhook secret for a partner is not configured, returns 503 (not 401) to distinguish misconfiguration from invalid signatures.

**POST /finance/partner/webhook/:partnerId/application**

```json
{
  "partnerApplicationId": "finbox-app-123",
  "status": "pending | under_review | approved | disbursed | rejected",
  "interestRate": 14.5,
  "emi": 5200,
  "rejectionReason": "Low income",
  "disbursedAmount": 100000
}
```

Looks up `LoanApplication` by `partnerApplicationId`, calls `loanService.updateStatus()`, writes audit log.

**POST /finance/partner/webhook/:partnerId/disbursal**

```json
{
  "partnerApplicationId": "finbox-app-123",
  "disbursedAmount": 100000
}
```

Updates application status to `disbursed`.

---

### Internal routes — `/internal/finance`

Protected by `requireInternalToken` middleware. Token must be present in `INTERNAL_SERVICE_TOKENS_JSON` (same pattern as rez-marketing-service: `x-internal-token` + `x-internal-service` headers). All internal routes emit an audit log entry.

| Method | Path | Called by | Description |
|--------|------|-----------|-------------|
| POST | `/internal/finance/contextual-offer` | Order service, Hotel OTA, Resturistan | Get a credit offer for user at checkout |
| POST | `/internal/finance/score/refresh` | Analytics, wallet service | Force score recalculation |
| POST | `/internal/finance/bnpl/settle` | Payment service | Settle BNPL after successful payment |
| POST | `/internal/finance/emi/paid` | Payment service | Mark first EMI as paid (awards coins) |

**POST /internal/finance/contextual-offer**

```json
{
  "userId": "string (required)",
  "screen": "booking_checkout | post_spend_upsell | ... (required)",
  "orderId": "string (optional)",
  "amount": 2500
}
```

Returns a contextual credit offer tailored to the user's current context. Powered by `creditIntelligenceService.getContextualCreditOffer()`.

**POST /internal/finance/bnpl/settle** (high-risk — credits wallet)

```json
{ "txId": "string" }
```

**POST /internal/finance/emi/paid** (high-risk — awards coins)

```json
{ "applicationId": "string" }
```

Calls `loanService.markFirstEmiPaid()` which awards coins via rez-wallet-service.

---

### Health

- `GET /health` on port 4105: `{"status":"ok","uptime":...}` or 503
- `GET /healthz` on port 4105: same
- `GET /ready` on port 4105: `{"status":"ready"}`

---

## 3. Background Workers and Jobs

### offerRefresh cron job

- **Schedule**: `0 */6 * * *` (every 6 hours)
- **No queue** — runs directly in-process

Fetches all `CreditProfile` documents where `rezScoreUpdatedAt >= 30 days ago` (active users). For each user, calls `partnerService.refreshOffersForUser()` in batches of 50 with a 500ms delay between batches to avoid partner API rate limits.

---

## 4. ReZ Score Engine

The score engine (`src/engines/rezScoreEngine.ts`) is a deterministic function with no external calls.

**Inputs** (`ScoreInputs`):
| Field | Weight | Description |
|-------|--------|-------------|
| `paymentHistory` | 35% | Fraction of on-time payments (0–1) |
| `totalSpend30d` | 20% | Total REZ spend in last 30 days (₹) |
| `orderCount30d` | 15% | Orders placed in last 30 days |
| `visitFrequency` | 10% | App visits per week |
| `walletBalance` | 10% | Current REZ wallet balance (₹) |
| `accountAgeDays` | 10% | Days since first REZ transaction |

**Score range**: 300–850 (mirrors CIBIL scale)

**Normalization**: Each factor is normalized to 0–1 against defined maximums (e.g. `totalSpend30d` max = ₹50,000, `orderCount30d` max = 30). Score = 300 + (weighted sum) × 550.

**Eligibility bands**:
| Score | Loan multiplier | Card multiplier | BNPL limit |
|-------|----------------|-----------------|------------|
| 750+ | 50x monthly spend | 40x monthly spend | ₹15,000 |
| 650–749 | 30x | 20x | ₹10,000 |
| 550–649 | 15x | 10x | ₹5,000 |
| 450–549 | 8x | 5x | ₹2,000 |
| <450 | 0 | 0 | ₹0 (BNPL disabled) |

---

## 5. Security Mechanisms

- **JWT user auth**: `authenticateUser` middleware validates Bearer JWT against `JWT_SECRET`. Extracts `userId`/`_id`/`id` claim.
- **Partner webhook HMAC**: `X-Partner-Signature` (SHA256 HMAC) using per-partner secret from `PARTNER_WEBHOOK_SECRET_{PARTNER_ID}`. Raw body captured via `express.json()` verify callback. Uses `timingSafeEqual` for constant-time comparison.
- **Internal token auth**: `requireInternalToken` — scoped token map from `INTERNAL_SERVICE_TOKENS_JSON`.
- **Partner webhook 503 vs 401**: Missing secret returns 503 to distinguish misconfiguration (ops issue) from invalid signature (security event). This prevents false security alerts during deployment.
- **Audit logging**: All internal routes and partner webhooks log `action`, `partnerId`/`path`, `correlationId` (from `x-correlation-id` header), and caller IP.
- **Sentry**: Optional error tracking. Configured with `SENTRY_DSN`. Traces sampled at `SENTRY_TRACES_SAMPLE_RATE` (default 0.1).
- **Helmet + CORS**: Standard security headers. CORS origin configurable via `CORS_ORIGIN`.
- **Score cache dedup**: Redis key `finance:score_reward:{userId}:{date}` prevents awarding coins more than once per day per user.

---

## 6. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection URL |
| `JWT_SECRET` | Shared JWT signing secret (same as rez-auth-service) |
| `INTERNAL_SERVICE_TOKENS_JSON` | JSON map of `{serviceName: secret}` for internal routes |

### Partner integration

| Variable | Description |
|----------|-------------|
| `FINBOX_API_KEY` | FinBox aggregator API key (stub mode if absent) |
| `PARTNER_WEBHOOK_SECRET_FINBOX` | HMAC secret for FinBox webhooks (503 if absent) |
| `WALLET_SERVICE_URL` | URL of rez-wallet-service (coins not awarded if absent) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4005` | HTTP server port |
| `HEALTH_PORT` | `4105` | Health server port |
| `CORS_ORIGIN` | `https://rez.money` | Comma-separated allowed origins |
| `COINS_CREDIT_SCORE_CHECK` | `10` | Coins awarded per daily score check |
| `SENTRY_DSN` | — | Sentry DSN for error tracking |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | Sentry trace sample rate (0–1) |
| `NODE_ENV` | `production` | Environment name |
| `EXPERIAN_CLIENT_ID` | — | Phase 2: Experian bureau integration (stub if absent) |

---

## 7. Data Models

### CreditProfile (`creditprofiles`)

One document per user. Updated on each score refresh.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | Unique user identifier |
| `bureauScore` | Number | External CIBIL/Experian score (null until Phase 2) |
| `bureauProvider` | String | `experian` or `crif` |
| `bureauFetchedAt` | Date | When bureau score was fetched |
| `rezScore` | Number | REZ proprietary score (300–850) |
| `rezScoreUpdatedAt` | Date | Last score calculation time |
| `factors.totalSpend30d` | Number | Spend input for scoring |
| `factors.orderCount30d` | Number | Order count input |
| `factors.avgOrderValue` | Number | Average order value |
| `factors.visitFrequency` | Number | Visits/week |
| `factors.paymentHistory` | Number | 0–1 fraction on-time |
| `factors.walletBalance` | Number | Wallet balance at scoring time |
| `factors.coinsBalance` | Number | Coins balance at scoring time |
| `eligibility.maxLoanAmount` | Number | ₹ pre-approved loan limit |
| `eligibility.maxCreditCardLimit` | Number | ₹ credit card limit |
| `eligibility.bnplEnabled` | Boolean | BNPL available |
| `eligibility.bnplLimit` | Number | ₹ BNPL limit |
| `tips` | String[] | Credit improvement suggestions |

Indexed on `userId` (unique).

### LoanApplication (`loanapplications`)

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | Applicant |
| `merchantId` | String | Set for BNPL/merchant financing |
| `partnerId` | String | Which lender/aggregator fulfilled this |
| `partnerApplicationId` | String | External application ID (for webhook matching) |
| `type` | Enum | `personal`, `instant`, `merchant`, `bnpl` |
| `amount` | Number | Requested/approved amount ₹ |
| `tenure` | Number | Months |
| `interestRate` | Number | APR % |
| `emi` | Number | Monthly EMI ₹ |
| `status` | Enum | `pending`, `pre_approved`, `submitted`, `under_review`, `approved`, `disbursed`, `rejected`, `cancelled` |
| `rejectionReason` | String | Reason if rejected |
| `context.screen` | String | Where in app the loan was initiated |
| `context.orderId` | String | Associated order |
| `coinsAwarded` | Number | Coins given for this application event |
| `firstEmiPaid` | Boolean | Tracks first EMI payment for coin reward |
| `disbursedAt` | Date | Disbursal timestamp |

Indexes: `{userId, status}`, `{userId, createdAt: -1}`

### FinanceTransaction (`financetransactions`)

| Field | Type | Description |
|-------|------|-------------|
| `userId` | String | User |
| `type` | Enum | `bnpl_payment`, `bill_payment`, `recharge`, `emi_payment`, `credit_card_payment` |
| `status` | Enum | `pending`, `success`, `failed`, `refunded` |
| `amount` | Number | Transaction amount ₹ |
| `currency` | String | Default `INR` |
| `operator` | String | Mobile operator or biller name |
| `billerId` | String | Biller ID from catalog |
| `accountNumber` | String | Mobile number, CA number, or FASTag ID |
| `loanApplicationId` | String | Linked loan application |
| `orderId` | String | Linked REZ order |
| `partnerId` | String | Gateway or internal (`rez_internal`) |
| `partnerTxId` | String | Partner transaction reference |
| `failureReason` | String | Failure description |
| `coinsAwarded` | Number | Coins given for this transaction |

Index: `{userId, createdAt: -1}`

### PartnerOffer (model in `src/models/PartnerOffer.ts`)

Stores pre-approved offers fetched from FinBox and partner lenders. Refreshed every 6 hours by the `offerRefresh` job.

---

## 8. Local Development and Testing

### Setup

```bash
cd rez-finance-service
cp .env.example .env    # fill in MONGODB_URI, REDIS_URL, JWT_SECRET, INTERNAL_SERVICE_TOKENS_JSON

npm install
npm run dev             # ts-node
```

Minimum `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/rez
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret
INTERNAL_SERVICE_TOKENS_JSON={"rez-backend":"dev-internal-secret"}
```

Without `FINBOX_API_KEY`, the partner service runs in stub mode and returns mock offers. Without `WALLET_SERVICE_URL`, coins are logged as a warning but not actually awarded.

### Testing consumer routes

Generate a JWT for dev testing:
```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: '64abc123def456789012345' }, 'dev-jwt-secret');
console.log(token);
```

```bash
# Get score
curl -H "Authorization: Bearer {token}" http://localhost:4005/finance/credit/score

# Check score and earn coins
curl -X POST -H "Authorization: Bearer {token}" http://localhost:4005/finance/credit/score/check

# Pay a bill
curl -X POST -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"billerId":"jio","accountNumber":"9876543210","amount":299}' \
  http://localhost:4005/finance/pay/bill
```

### Testing internal routes

```bash
curl -X POST \
  -H "x-internal-token: dev-internal-secret" \
  -H "x-internal-service: rez-backend" \
  -H "Content-Type: application/json" \
  -d '{"userId":"64abc123def456789012345","screen":"checkout","amount":2500}' \
  http://localhost:4005/internal/finance/contextual-offer
```

### Testing partner webhooks

Generate the HMAC signature:
```bash
echo -n '{"partnerApplicationId":"test-123","status":"approved"}' | \
  openssl dgst -sha256 -hmac "your-secret" | cut -d' ' -f2
```

```bash
curl -X POST \
  -H "X-Partner-Signature: {sha256hex}" \
  -H "Content-Type: application/json" \
  -d '{"partnerApplicationId":"test-123","status":"approved"}' \
  http://localhost:4005/finance/partner/webhook/finbox/application
```

---

## 9. Troubleshooting

**`Missing required env vars: INTERNAL_SERVICE_TOKENS_JSON`**: This causes immediate `process.exit(1)` on boot. Set the variable to a valid JSON string, e.g. `{"rez-backend":"secret123"}`.

**Score not updating (always returns cached value)**: Score is cached in Redis for 6 hours (`finance:score:{userId}`). Call `POST /finance/credit/score/refresh` to force invalidation and recalculation, or `DEL finance:score:{userId}` in Redis.

**Coins not awarded after bill pay or score check**: `WALLET_SERVICE_URL` is not set or rez-wallet-service is unreachable. The service logs a warning at startup. Check `rewardsHookService` logs for HTTP errors.

**Partner webhook returning 503**: `PARTNER_WEBHOOK_SECRET_{PARTNER_ID}` is not set. The env var name is derived from the `partnerId` path parameter — all non-alphanumeric characters are replaced with `_` and uppercased. For `partnerId=finbox`, the var is `PARTNER_WEBHOOK_SECRET_FINBOX`.

**Partner webhook returning 401 "Invalid partner signature"**: HMAC mismatch. Most common causes: (1) the request body was modified by a proxy (e.g. whitespace normalization), (2) the raw body was not captured — verify that `req.rawBody` is set (requires the verify callback in `express.json()`), (3) the partner is signing with a different algorithm or encoding.

**BNPL check returns ineligible for all users**: If the user has no `CreditProfile` document, `bnplService.checkEligibility()` may default to a score of 0, which maps to `bnplLimit: 0`. Ensure users have a `CreditProfile` created by calling the score endpoint at least once.

**offerRefresh job running but no offers appearing**: `FINBOX_API_KEY` is not set — partner service is in stub mode. In stub mode, `refreshOffersForUser()` may return empty mock data. Set the real key and monitor the 6-hour cron logs for errors.

**Sentry not capturing errors**: Verify `SENTRY_DSN` is set. Sentry is initialized before Express is set up. If `process.exit(1)` is called during env validation, Sentry may not flush. Check that `SENTRY_TRACES_SAMPLE_RATE` is not `0`.
