# REZ Finance Service

Last updated: 2026-04-08  
Repo: `git@github.com:imrejaul007/rez-finance-service.git`  
Deploy: `https://rez-finance-service.onrender.com`  
Port: 4005 (HTTP) | 4105 (health-only sidecar)

---

## Overview

`rez-finance-service` is a standalone Node.js/TypeScript microservice that powers the finance layer across the REZ ecosystem — consumer app, Hotel OTA, and future platforms. It is independent but integrates via internal service calls and the nginx API gateway.

**Products covered:**
- **BORROW** — personal loans, instant loans, BNPL (Buy Now Pay Later), credit cards
- **CREDIT HUB** — ReZ Score (proprietary behavioral scoring), bureau score integration
- **PAY & MANAGE** — bill payment, mobile recharge
- **GROW** — FDs, insurance (Phase 4, not yet implemented)

---

## Architecture

```
Consumer App (rez-master)
  └── Finance tab       → GET /api/finance/borrow/offers
  └── Checkout (BNPL)   → POST /api/finance/borrow/bnpl/check

Hotel OTA (apps/api)
  └── /v1/bookings/:id/hold  → GET /internal/finance/contextual-offer (server-to-server)

API Gateway (nginx)
  └── /api/finance/*    → proxy to rez-finance-service:4005

rez-finance-service
  ├── borrowRoutes       — consumer-facing loan/BNPL flows
  ├── creditRoutes       — ReZ Score, bureau, check/refresh
  ├── payRoutes          — bill pay, recharge, transaction history
  ├── internalRoutes     — contextual-offer, score/refresh, bnpl/settle, emi/paid
  └── partnerRoutes      — HMAC-verified inbound webhooks from lending partners
```

---

## ReZ Score Engine

Proprietary behavioral credit scoring, range 300–850. Weights:

| Factor | Weight | Source |
|--------|--------|--------|
| Payment history | 35% | order service `/internal/orders/summary/:userId` |
| Spending patterns | 20% | wallet service `/internal/balance/:userId` |
| Order frequency | 15% | order service |
| Store visit frequency | 10% | gamification (future) |
| Wallet activity | 10% | wallet service |
| Account age | 10% | `user.createdAt` in order service |

Score is cached in `CreditProfile` (MongoDB). Stale threshold: 7 days. Score refresh is triggered by:
- explicit `POST /credit/score/refresh` call
- internal `POST /internal/score/refresh` call
- BNPL eligibility check (if no profile exists)

**Eligibility bands:**

| Score | Band | Max BNPL limit |
|-------|------|---------------|
| 700–850 | Excellent | ₹50,000 |
| 600–699 | Good | ₹25,000 |
| 500–599 | Fair | ₹10,000 |
| 300–499 | Poor | ₹0 (not eligible) |

---

## Coin Rewards

Finance events that award rez coins:

| Event | Coins | Idempotency key |
|-------|-------|-----------------|
| Loan application submitted | 50 | `finance:loan_apply:{userId}:{applicationId}` |
| Loan disbursed | 200 | `finance:loan_disbursed:{userId}:{applicationId}` |
| First EMI paid | 100 | `finance:emi_first_paid:{userId}:{applicationId}` |
| First BNPL order | 30 | `finance:bnpl_first_order:{userId}:{orderId}` |
| Credit score checked | 10 | `finance:score_check:{userId}:no-ref` |

Coins are credited via `POST /internal/credit` on `rez-wallet-service` with `coinType: 'nuqta'` and the idempotency key in the `referenceId` field.

---

## API Routes

### Consumer routes (require `Authorization: Bearer <user-jwt>`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/borrow/offers` | Loan + BNPL offers for the user |
| POST | `/borrow/apply` | Submit loan application |
| GET | `/borrow/applications` | User's application history |
| POST | `/borrow/bnpl/check` | BNPL eligibility check for an order amount |
| POST | `/borrow/bnpl/create` | Create a BNPL order |
| GET | `/credit/score` | Get current ReZ Score + tips |
| POST | `/credit/score/check` | Check score and award coins if first check |
| POST | `/credit/score/refresh` | Force score refresh |
| GET | `/pay/billers` | Available billers by category |
| POST | `/pay/bill` | Pay a bill |
| POST | `/pay/recharge` | Mobile recharge |
| GET | `/pay/transactions` | User's finance transaction history |

### Internal routes (require `x-internal-token` + `x-internal-service`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/internal/finance/contextual-offer` | Contextual offer for checkout/hotel hold flows |
| POST | `/internal/score/refresh` | Trigger score refresh for a user (order service, etc.) |
| POST | `/internal/bnpl/settle` | Settle a BNPL order after delivery |
| POST | `/internal/emi/paid` | Record EMI payment from payment service |

### Partner webhook routes (require `x-partner-signature` HMAC-SHA256)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/finance/partner/webhook/:partnerId/application` | Application status update from lending partner |
| POST | `/finance/partner/webhook/:partnerId/disbursal` | Disbursal notification from lending partner |

Partner secret env var: `PARTNER_WEBHOOK_SECRET_{PARTNER_ID_UPPERCASE}` (e.g. `PARTNER_WEBHOOK_SECRET_FINBOX`).

---

## Partner Integration

The service uses an `IAggregatorAdapter` interface so multiple lending partners can be plugged in:

```typescript
interface IAggregatorAdapter {
  fetchOffers(userId: string, rezScore: number): Promise<PartnerOffer[]>;
  submitApplication(applicationId: string, userData: object): Promise<{ externalRef: string }>;
}
```

**Phase 1:** FinBox (`src/integrations/aggregator/finbox.ts`). Returns empty offers if `FINBOX_API_KEY` is not configured (safe for dev/staging).

**Offer refresh:** BullMQ cron runs every 6 hours, refreshes offers in batches of 50 with 500ms inter-batch delay.

---

## Data Models

| Model | Collection | Purpose |
|-------|-----------|---------|
| `LoanApplication` | loanapplications | Loan/BNPL/credit card applications, state machine |
| `CreditProfile` | creditprofiles | ReZ Score, bureau score, eligibility, tips per user |
| `PartnerOffer` | partneroffers | Cached offers from lending partners (TTL indexed) |
| `FinanceTransaction` | financetransactions | Bill pay, recharge, EMI, BNPL payment records |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | yes | Shared MongoDB Atlas URI |
| `REDIS_URL` | yes | Upstash Redis URL |
| `JWT_SECRET` | yes | Shared JWT secret (consumer auth) |
| `INTERNAL_SERVICE_TOKEN` | yes | Shared internal token (fallback) |
| `INTERNAL_SERVICE_TOKENS_JSON` | recommended | Per-service scoped tokens map |
| `WALLET_SERVICE_URL` | yes | e.g. `https://rez-wallet-service-36vo.onrender.com` |
| `ORDER_SERVICE_URL` | yes | e.g. `https://rez-order-service.onrender.com` |
| `FINBOX_API_KEY` | no | FinBox aggregator key (empty = skip) |
| `PARTNER_WEBHOOK_SECRET_FINBOX` | yes (prod) | HMAC secret for FinBox webhook verification |
| `SENTRY_DSN` | no | Sentry error tracking |
| `PORT` | no | Defaults to 4005 |

---

## Integration Points

### Consumer App (`rezapp/rez-master`)

- `services/financeApi.ts` — typed API client
- `app/(tabs)/finance.tsx` — Finance tab: score card, eligibility pills, tips, partner offers
- `app/order/[storeSlug]/checkout.tsx` — BNPL eligibility banner above Place Order button

### Hotel OTA (`Hotel OTA/apps/api`)

- `src/services/financeIntegration.service.ts` — calls `/internal/finance/contextual-offer`
- `src/routes/booking.routes.ts` — `/hold` response includes `finance_offer` field

### API Gateway (`rez-api-gateway/nginx.conf`)

- `/api/finance` proxies to `$finance_backend` (no caching, `x-request-id` forwarded)
- `FINANCE_SERVICE_URL` env var in `render.yaml`

---

## Tests

```bash
cd rez-finance-service
node --test test/access-guards.test.js    # 10 source-level access guard tests
node --test test/integration-guards.test.js  # 4 contract tests (wallet/order endpoints)
```

Tests are source-level (no running server needed) — they read the TypeScript source files and assert the correct middleware order, required field names, and endpoint paths.
