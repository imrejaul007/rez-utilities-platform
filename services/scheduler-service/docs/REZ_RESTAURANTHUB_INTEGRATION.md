# REZ ↔ RestaurantHub Integration — Full Documentation

> Last updated: 2026-04-08  
> Status: **Complete** — all 5 phases implemented, Prisma migrations applied, build clean

---

## 1. What RestaurantHub Is

RestaurantHub (`Resturistan App/restauranthub/`) is a LinkedIn-style B2B/B2C SaaS platform for restaurants.

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 App Router + Tailwind + shadcn/ui |
| Backend API | NestJS + Prisma + PostgreSQL (`restauranthub_dev`) |
| Monorepo | Turborepo (`apps/web`, `apps/api`, `packages/rez-client`) |

---

## 2. Business Case

REZ is an operational merchant platform (POS, orders, wallet, staff). RestaurantHub is a professional B2B layer (jobs, marketplace, training, analytics, fintech). Together:

| REZ provides | RestaurantHub unlocks |
|---|---|
| Verified merchant identity | Trusted B2B profiles without a new signup |
| Transaction history | Credit scoring for working capital |
| Staff shift gaps | Auto-posted job listings |
| Purchase orders | Marketplace demand signals |
| Wallet/coin balance | Cross-platform loyalty surface |

---

## 3. Architecture Overview

```
REZ Merchant App
      │
      │  POST /auth/rez-bridge  (REZ JWT → RH JWT)
      ▼
RestaurantHub API (NestJS)
      │
      ├── modules/auth/rez-bridge/      ← SSO bridge
      ├── modules/users/                ← webhook consumer
      ├── modules/jobs/                 ← shift gap → job
      ├── modules/marketplace/          ← RFQ, supplier registry
      ├── modules/analytics/            ← benchmarks, gap detection
      ├── modules/training/             ← gap → course recommendation
      └── modules/fintech/              ← credit score, NBFC proxy
      │
      ▼
packages/rez-client/                    ← circuit-breaker HTTP client
      │
      ├── → rez-merchant-service        (merchant identity, shifts, POs)
      ├── → rez-wallet-service          (credit score, wallet balance)
      ├── → rez-payment-service         (NBFC proxy)
      ├── → analytics-events            (benchmarks)
      └── → rez-catalog (stub)          (marketplace categories/suppliers)
```

---

## 4. Auth Bridge — How SSO Works

**Flow:**

1. REZ Merchant App calls `POST /auth/rez-bridge` with its REZ JWT in the body
2. `RezMerchantStrategy` (Passport) verifies the token using `REZ_JWT_SECRET`
3. Bridge controller fetches merchant profile from `rez-merchant-service`
4. User is upserted in RestaurantHub PostgreSQL with `rezMerchantId` + `rezVerified: true`
5. A RestaurantHub JWT is issued — the merchant is now logged in to both platforms

**Key files:**

| File | Purpose |
|------|---------|
| [rez-bridge.controller.ts](../Resturistan%20App/restauranthub/apps/api/src/modules/auth/rez-bridge/rez-bridge.controller.ts) | `POST /auth/rez-bridge` handler |
| [rez-merchant.strategy.ts](../Resturistan%20App/restauranthub/apps/api/src/modules/auth/rez-bridge/rez-merchant.strategy.ts) | Passport strategy for REZ JWT verification |
| [rez-bridge.module.ts](../Resturistan%20App/restauranthub/apps/api/src/modules/auth/rez-bridge/rez-bridge.module.ts) | NestJS module wiring |
| [rez-bridge.dto.ts](../Resturistan%20App/restauranthub/apps/api/src/modules/auth/rez-bridge/rez-bridge.dto.ts) | Request/response DTOs |

**Environment variables required:**

```env
REZ_JWT_SECRET=<must match rezbackend JWT_SECRET>
REZ_MERCHANT_SERVICE_URL=https://rez-merchant-service-n3q2.onrender.com
INTERNAL_SERVICE_TOKEN=<shared internal service token>
INTERNAL_BRIDGE_TOKEN=<webhook guard token>
```

---

## 5. Prisma Schema Changes

**Migration 1:** `20260406224207_rez_integration_full`

Added to existing models:

| Model | Fields added |
|-------|-------------|
| `User` | `rezMerchantId String? @unique`, `rezVerified Boolean @default(false)`, `consentTier Int @default(0)`, `courseCompletions CourseCompletion[]` |
| `Profile` | `rezMerchantId`, `rezUserId`, `rezStoreId`, `rezVerified` |
| `Job` | `source String?`, `rezMerchantId String?`, `rezShiftDate String?` |

New models added: `CourseCompletion`

**Migration 2:** `20260407053442_add_rfq_vendor_credit_models`

New models:

| Model | Purpose |
|-------|---------|
| `Rfq` | Marketplace request-for-quote submissions |
| `VendorApplication` | Supplier/vendor onboarding registrations |
| `CreditApplication` | Working capital credit applications (NBFC proxy) |

---

## 6. Module Reference

### 6.1 Jobs Module — Shift Gap → Job Posting

- REZ merchant service detects shift gaps via `ShiftGapDetector`
- Webhooks fire to `POST /webhooks/rez/shift-gaps` (RestaurantHub)
- `ShiftSyncService` converts gap data into draft `Job` records with `source: 'rez-sync'`
- `POST /webhooks/rez/hire-confirmed` auto-closes jobs when REZ records a hire

**Key files:**
- [shift-sync.service.ts](../Resturistan%20App/restauranthub/apps/api/src/modules/jobs/shift-sync.service.ts)
- [shift-webhook.controller.ts](../Resturistan%20App/restauranthub/apps/api/src/modules/jobs/shift-webhook.controller.ts)
- [rez-merchant-service/src/utils/ShiftGapDetector.ts](../rez-merchant-service/src/utils/ShiftGapDetector.ts)

---

### 6.2 Marketplace Module

- `GET /marketplace/categories` — from REZ catalog service
- `GET /marketplace/suppliers` — paginated, filterable by city + category
- `GET /marketplace/demand-signals` — aggregated from `rez-merchant-service` (k-anonymity: 5+ merchant floor)
- `POST /marketplace/rfq` — creates `Rfq` record in PostgreSQL
- `POST /marketplace/vendors/register` — creates `VendorApplication` in PostgreSQL

**Privacy:** Demand signals are never returned if fewer than 5 merchants contributed to the signal.

**Key files:**
- [marketplace.service.ts](../Resturistan%20App/restauranthub/apps/api/src/modules/marketplace/marketplace.service.ts)
- [MarketplaceDemandAggregator.ts](../rez-merchant-service/src/utils/MarketplaceDemandAggregator.ts)

---

### 6.3 Analytics Module — Peer Benchmarking

- `GET /analytics/dashboard` — returns revenue, orders, staff, food cost % for authenticated merchant
- `GET /analytics/benchmark` — compares merchant to anonymized peer group
- `GET /analytics/gaps` — identifies operational gaps (food cost high, staff gaps, training deficit)

**Privacy:** Peer benchmarks require minimum 10-merchant peer group. Peer IDs are HMAC-SHA256 anonymized. Raw peer data is never returned.

**Key files:**
- [analytics.service.ts](../Resturistan%20App/restauranthub/apps/api/src/modules/analytics/analytics.service.ts)
- [BenchmarkEngine.ts](../analytics-events/src/engines/BenchmarkEngine.ts)
- [AnonymizationPipeline.ts](../analytics-events/src/pipelines/AnonymizationPipeline.ts)

---

### 6.4 Training Module — Gap-Driven Recommendations

- `GET /training/feed` — personalized course feed based on detected operational gaps
- `GET /training/courses/:slug` — course detail
- `POST /training/courses/:slug/complete` — marks course complete, updates `CourseCompletion`

**Gap → Course mapping:**

| Operational Gap | Recommended Course |
|---|---|
| High food cost | food-cost-101 |
| Staff gaps | staff-scheduling-basics |
| Low revenue | menu-engineering |
| No supplier integration | supplier-negotiation |

**Key files:**
- [training.service.ts](../Resturistan%20App/restauranthub/apps/api/src/modules/training/training.service.ts)

---

### 6.5 Fintech Module — Working Capital

- `GET /fintech/credit-profile` — fetches 5-factor credit score from `rez-wallet-service`
- `POST /fintech/apply` — submits credit application, routes to NBFC proxy in `rez-payment-service`
- `GET /fintech/applications/:id` — application status (DB-first, falls back to payment service)
- `GET /fintech/credit-history` — wallet transactions of type `credit`
- `POST /fintech/pay-supplier` — initiates supplier payment using credit line (stub until NBFC live)

**Credit score factors (5-factor):**

| Factor | Weight |
|--------|--------|
| Revenue stability (6-month trend) | 25% |
| Payment regularity | 20% |
| Dispute rate | 20% |
| Account age | 15% |
| Order frequency | 20% |

**Eligibility tiers:**

| Score | Tier | Max Credit Line |
|-------|------|----------------|
| 70–100 | Gold | ₹5,00,000 |
| 50–69 | Silver | ₹2,00,000 |
| < 50 | Bronze | Not eligible |

**Key files:**
- [fintech.service.ts](../Resturistan%20App/restauranthub/apps/api/src/modules/fintech/fintech.service.ts)
- [CreditScoreCalculator.ts](../rez-wallet-service/src/engines/CreditScoreCalculator.ts)
- [nbfc-partner.ts](../rez-payment-service/src/integrations/nbfc-partner.ts)

---

## 7. rez-client Package

`packages/rez-client/` — NestJS injectable HTTP client used by all integration modules.

**Features:**
- Circuit breaker: opens after 5 failures, resets after 30 seconds (via `opossum`)
- Retry: 3 attempts with 200ms/400ms/800ms exponential backoff
- Auth header: `X-Internal-Token` on every request
- Graceful degradation: returns empty arrays / null when REZ is down

**Clients:**

| Client | Methods |
|--------|---------|
| `RezMerchantClient` | `getMerchant`, `getMerchantStats`, `getMerchantStores`, `getPurchaseOrders`, `getStaffShifts`, `getShiftGaps` |
| `RezAnalyticsClient` | `getBenchmarks`, `getGaps` |
| `RezCatalogClient` | `getCategories`, `getSuppliers` |
| `RezWalletClient` | `getWalletBalance`, `getTransactions` |

---

## 8. REZ-Side Changes

### rez-merchant-service

| Addition | Purpose |
|----------|---------|
| `ShiftGapDetector.ts` | Detects open shifts > 4h unfilled, fires webhook to RH |
| `shiftGapBridge.ts` | Route: `POST /internal/shift-gaps/sync` |
| `MarketplaceDemandAggregator.ts` | Aggregates purchase patterns with k-anonymity floor |
| `demandSignals.ts` | Route: `GET /demand-signals` |

### rez-wallet-service

| Addition | Purpose |
|----------|---------|
| `CreditScoreCalculator.ts` | 5-factor credit scoring engine |
| `creditScore.ts` | Route: `GET /credit-score/:merchantId` |

### rez-payment-service

| Addition | Purpose |
|----------|---------|
| `nbfc-partner.ts` | `StubNbfcPartner` + `getNbfcPartner` factory (swappable when NBFC is live) |

### analytics-events

| Addition | Purpose |
|----------|---------|
| `BenchmarkEngine.ts` | Peer group computation (min 10 merchants) |
| `AnonymizationPipeline.ts` | HMAC-SHA256 peer ID anonymization |
| `benchmarks.ts` | Route: `GET /benchmarks` |

### REZ Merchant App (Expo)

| Addition | Purpose |
|----------|---------|
| `app/staff-shifts/post-to-hub.tsx` | UI: post shift gap to RestaurantHub jobs board |
| `components/TrainingNudgeNotification.tsx` | Push notification bridging training gap to course |

---

## 9. Web UI Pages Wired

| Route | Data source |
|-------|------------|
| `/jobs` | `GET /jobs` — live fetch with REZ Sync badge |
| `/marketplace` | `GET /marketplace/categories`, `/suppliers`, `/demand-signals` |
| `/marketplace/rfq-modal` | `POST /marketplace/rfq` |
| `/vendor/onboarding` | `POST /marketplace/vendors/register` |
| `/training` | `GET /training/feed` — personalized gap-driven feed |
| `/training/[slug]` | `GET /training/courses/:slug` + `POST .../complete` |
| `/wallet` | `GET /fintech/credit-profile` + REZ wallet balance |
| `/payments/working-capital` | `POST /fintech/apply` |
| `/profile` | REZ verified badge + `POST /users/consent` |
| `/analytics` | `GET /analytics/dashboard` via `analytics-dashboard.tsx` |

---

## 10. Consent Tier System

Users must grant consent before REZ operational data is used in RH features.

| Tier | What's shared |
|------|--------------|
| 0 (default) | Nothing — REZ data not used |
| 1 | Identity only (name, city, verified badge) |
| 2 | Full — analytics, benchmarks, training recommendations, credit scoring |

Endpoint: `POST /users/consent` (JWT-guarded)  
Profile endpoint: `GET /users/:id/rez-profile`

---

## 11. Webhook Guard Pattern

All inbound webhooks from REZ services use the `INTERNAL_BRIDGE_TOKEN` header check:

```
POST /webhooks/rez/merchant-created   → UsersModule
POST /webhooks/rez/merchant-updated   → UsersModule
POST /webhooks/rez/shift-gaps         → JobsModule
POST /webhooks/rez/hire-confirmed     → JobsModule
```

The guard rejects requests with `401` if `x-internal-token` header does not match `INTERNAL_BRIDGE_TOKEN`.

---

## 12. Environment Variables — Full Reference

**RestaurantHub API (`apps/api/.env`):**

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/restauranthub_dev

# Auth
JWT_SECRET=<rh-specific jwt secret>

# REZ Integration
REZ_JWT_SECRET=<must match rezbackend JWT_SECRET exactly>
REZ_MERCHANT_SERVICE_URL=https://rez-merchant-service-n3q2.onrender.com
REZ_WALLET_SERVICE_URL=https://rez-wallet-service-36vo.onrender.com
REZ_PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
INTERNAL_SERVICE_TOKEN=<shared REZ internal service token>
INTERNAL_BRIDGE_TOKEN=<webhook guard token for inbound REZ webhooks>
```

**REZ Merchant Service (Render env):**

```env
RESTAURANTHUB_API_URL=https://<restauranthub-api-domain>
INTERNAL_SERVICE_TOKEN=<same as above>
```

---

## 13. Deployment Checklist

- [ ] `REZ_JWT_SECRET` set in RestaurantHub API env — must equal `JWT_SECRET` in rezbackend
- [ ] `INTERNAL_SERVICE_TOKEN` set in both RestaurantHub API and all REZ microservices
- [ ] `INTERNAL_BRIDGE_TOKEN` set in RestaurantHub API
- [ ] Prisma migrations applied: `prisma migrate deploy` on production DB
- [ ] `rez-merchant-service` redeployed with ShiftGapDetector + DemandAggregator routes
- [ ] `rez-wallet-service` redeployed with CreditScoreCalculator route
- [ ] `rez-payment-service` redeployed with NBFC stub route
- [ ] `analytics-events` redeployed with BenchmarkEngine + benchmarks route
- [ ] Circuit breaker health: verify `GET /health` on rez-client returns 200 for all downstream services
- [ ] Consent tier defaults to 0 — no PII leak possible at launch

---

## 14. Known Stubs / Future Work

| Item | Status | Notes |
|------|--------|-------|
| NBFC partner | Stub (`StubNbfcPartner`) | Replace with real NBFC when partner agreement signed |
| REZ catalog service | Stub (returns mock categories/suppliers) | Wire to real catalog when available |
| Demand signal floor | 5 merchants hardcoded | Tune based on actual merchant density |
| Peer benchmark floor | 10 merchants hardcoded | Tune based on data volume |
| `rez-client` workspace package resolution | Module alias workaround | Full workspace symlink when monorepo is hoisted |
