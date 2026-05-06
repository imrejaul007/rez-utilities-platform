# Cross-Repo: Complete Gap Analysis — All Repos vs All Repos

**Date:** 2026-04-16
**Scope:** ALL repos in the workspace + sibling repos

---

## Repo Inventory

| Repo | Type | Path | Status |
|------|------|------|--------|
| `rez-app-admin/` | React Native/Expo | Main admin app | **ACTIVE AUDIT** |
| `rez-app-consumer/` | React Native/Expo | Consumer app | Prior audits (Gen 1-7) |
| `rez-backend/` (rezbackend) | Express monolith | Legacy backend | Prior audits |
| `rez-payment-service/` | Express + Mongoose | Microservice | Prior audits |
| `rez-wallet-service/` | Express + Mongoose | Microservice | Prior audits |
| `rez-order-service/` | Express + Mongoose | Microservice | Prior audits |
| `rez-auth-service/` | Express + Mongoose | Microservice | Prior audits |
| `rez-karma-service/` | Express + Mongoose | Microservice | Gen 8 audit |
| `rez-finance-service/` | Express + Mongoose | Microservice | Prior audits |
| `rez-merchant-service/` | Express + Mongoose | Microservice | Prior audits |
| `rez-api-gateway/` | Express | API Gateway | Prior audits |
| `rez-shared/` | TypeScript library | Shared types | Prior audits |
| `rez-admin/` (legacy) | React Native/Expo | Old admin app | Deprecated |
| `rez-web-menu/` | Next.js | Web menu | Prior audits |
| `Hotel OTA/` | Node.js | Hotel integration | Prior audits |
| `Resturistan App/` | React Native/Expo | Restaurant app | Prior audits |

---

## Cross-Repo Issue Matrix

### Payment → Wallet

| Issue | Source Repo | Target Repo | Severity |
|-------|------------|-------------|----------|
| PaymentMachine in-memory, double credit | payment-service | wallet-service | CRITICAL |
| No idempotency on wallet mutations | admin | wallet-service | HIGH |
| Welcome coins race window | auth-service | wallet-service | HIGH |
| Partial refund idempotency key mutable | payment-service | wallet-service | MEDIUM |
| debitForCoinAward no transaction | gamification | wallet-service | MEDIUM |

### Finance → Wallet/Order

| Issue | Source Repo | Target Repo | Severity |
|-------|------------|-------------|----------|
| Finance calls non-existent routes | finance-service | wallet-service | HIGH |
| Finance rewards hook wrong endpoint+fields | finance-service | wallet-service | HIGH |
| Approval stats uses wrong field | finance-service | internal | MEDIUM |

### Admin → Backend

| Issue | Source Repo | Target Repo | Severity |
|-------|------------|-------------|----------|
| Socket null auth on web | admin | all real-time | HIGH |
| HMAC key from env var name | order-service | all internal | CRITICAL |
| SSE no merchant ownership check | order-service | order-service | CRITICAL |
| Redis fail-open outside prod | order-service | auth | MEDIUM |
| JWT alg:none not mitigated | gateway | all consumers | HIGH |
| Missing role guards | admin | admin-settings | HIGH |

### Consumer ↔ Backend

| Issue | Source Repo | Target Repo | Severity |
|-------|------------|-------------|----------|
| KarmaProfile type drift | consumer | shared | CRITICAL |
| KarmaEvent type drift | consumer | shared | HIGH |
| Consumer uses `completed` not `delivered` | consumer | order-service | MEDIUM |

### All Surfaces ↔ Shared Types

| Issue | Source Repo | Target Repo | Severity |
|-------|------------|-------------|----------|
| normalizePaymentStatus never used | all surfaces | shared | MEDIUM |
| 3 normalizeOrderStatus implementations | all surfaces | shared | CRITICAL |
| Payment status colors missing 7 states | admin, consumer, merchant | shared | HIGH |

---

## Same Issue, Different Repos (Duplicates)

| Issue Pattern | Appears In | Count |
|-------------|-----------|-------|
| No idempotency on financial mutations | wallet, admin, payment | 5 |
| Inconsistent stale times | admin, consumer | 8 |
| Hardcoded colors | admin (3 systems) | 1 pattern |
| Duplicate service files | admin (82 files) | 1 pattern |
| Timing attack in HMAC | order-service, gateway | 2 |
| Redis fail-open | order-service, marketing | 3 |
| Missing role guards | admin, merchant | 6 |
| Same response unwrapping pattern | admin (82 files), consumer | 100+ |

---

## Duplicate Type Definitions (Same Data, Different Files)

| Data | File A | File B | Impact |
|------|--------|--------|--------|
| `VoucherBrand` | `vouchers.ts` | `cashStore.ts` | Runtime crash |
| `CoinDrop` | `extraRewards.ts` | `cashStore.ts` | Type mismatch |
| `DoubleCashbackCampaign` | `extraRewards.ts` | `cashStore.ts` | Validation mismatch |
| `KarmaProfile` | `karmaService.ts` (consumer) | `shared-types/karma.ts` | Runtime crash |
| `KarmaEvent` | `karmaService.ts` (consumer) | `shared-types/karma.ts` | Wrong rendering |
| `normalizeOrderStatus` | `constants/orderStatuses.ts` | `types/index.ts` | Inconsistent normalization |
| `AdminUser` | `AuthContext.tsx` | `storage.ts` | Type mismatch |
| `Colors` | `DesignTokens.ts` | `Colors.ts` | Conflicting values |

---

## Root Cause → Cross-Repo Patterns

| Root Cause | Pattern | Repos Affected |
|-----------|---------|---------------|
| RC-1: No single source of truth | Type duplication | admin, consumer, shared |
| RC-2: Frontend computes backend logic | Wrong field names | admin ← backend |
| RC-3: Fire-and-forget financial ops | No idempotency, atomicity gaps | payment, wallet, admin |
| RC-4: Real-time bypasses server-state | Socket not invalidating cache | admin |
| RC-5: Token refresh race conditions | TOCTOU in auth | admin, gateway |
| RC-6: Duplicate implementations | Same endpoint, different code | admin (82 files) |
| RC-7: Shared types not imported | Type drift | consumer, admin, shared |
| RC-8: No build-time contract validation | `as any` casts everywhere | all frontends |
| RC-9: Redis as only truth | Fail-open patterns | order, marketing |
| RC-10: No capability scoping | Broad token scope | all internal services |
