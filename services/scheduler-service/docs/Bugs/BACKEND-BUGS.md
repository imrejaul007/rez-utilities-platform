# Backend — Master Bug Index

> **Audit target:** All Node.js/TypeScript microservices in `/rez-*`, `rez-shared`, `rezbackend`, `analytics-events`, `packages/`.
> **Method:** Exhaustive static source reading (6 parallel agents covering 15 services).
> **Caveat:** Build/CI not green during audit; findings from source reading. Backend bugs cascade to all three client apps — fixes must ship with strict contract tests.
> **Related:** See [UNIFIED-REMEDIATION-PLAN.md](UNIFIED-REMEDIATION-PLAN.md).

---

## Severity totals

| Severity | Count |
|----------|------:|
| CRITICAL | 13 |
| HIGH | 59 |
| MEDIUM | 281 |
| LOW | 80 |
| **Total** | **434** |

## Service breakdown

| # | Service | File | Prefix | CRIT | HIGH | MED | LOW | Total |
|--:|---------|------|--------|-----:|-----:|----:|----:|------:|
| 1 | API Gateway | [BACKEND-GATEWAY.md](BACKEND-GATEWAY.md) | BE-GW | 0 | 8 | 18 | 2 | 28 |
| 2 | Auth Service | [BACKEND-AUTH.md](BACKEND-AUTH.md) | BE-AUTH | 0 | 7 | 26 | 2 | 35 |
| 3 | Catalog Service | [BACKEND-CATALOG.md](BACKEND-CATALOG.md) | BE-CAT | 2 | 1 | 16 | 9 | 28 |
| 4 | Merchant Service | [BACKEND-MERCHANT.md](BACKEND-MERCHANT.md) | BE-MER | 3 | 7 | 26 | 4 | 40 |
| 5 | Order Service | [BACKEND-ORDER.md](BACKEND-ORDER.md) | BE-ORD | 6 | 9 | 17 | 3 | 35 |
| 6 | Payment Service | [BACKEND-PAYMENT.md](BACKEND-PAYMENT.md) | BE-PAY | 1 | 4 | 18 | 4 | 27 |
| 7 | Wallet Service | [BACKEND-WALLET.md](BACKEND-WALLET.md) | BE-WAL | 0 | 0 | 23 | 4 | 27 |
| 8 | Finance Service | [BACKEND-FINANCE.md](BACKEND-FINANCE.md) | BE-FIN | 0 | 2 | 21 | 3 | 26 |
| 9 | Search Service | [BACKEND-SEARCH.md](BACKEND-SEARCH.md) | BE-SRC | 1 | 3 | 27 | 4 | 35 |
| 10 | Gamification Service | [BACKEND-GAMIFICATION.md](BACKEND-GAMIFICATION.md) | BE-GAM | 0 | 4 | 13 | 5 | 22 |
| 11 | Karma Service | [BACKEND-KARMA.md](BACKEND-KARMA.md) | BE-KAR | 0 | 4 | 9 | 9 | 22 |
| 12 | Marketing Service | [BACKEND-MARKETING.md](BACKEND-MARKETING.md) | BE-MKT | 0 | 5 | 11 | 6 | 22 |
| 13 | Ads Service | [BACKEND-ADS.md](BACKEND-ADS.md) | BE-ADS | 0 | 4 | 10 | 8 | 22 |
| 14 | Shared packages | [BACKEND-SHARED.md](BACKEND-SHARED.md) | BE-SHR | 0 | 0 | 19 | 11 | 30 |
| 15 | Events pipeline | [BACKEND-EVENTS.md](BACKEND-EVENTS.md) | BE-EVT | 0 | 1 | 28 | 6 | 35 |

## Money-critical services (elevated attention)

Four services directly touch ledger state — they take Phase 1 priority in the unified plan:

- **rez-order-service** (6 CRIT / 9 HIGH) — order→payment coupling, inventory reservation, refund trigger
- **rez-payment-service** (1 CRIT / 4 HIGH) — gateway callbacks, webhook signature, idempotency
- **rez-wallet-service** (23 MED concurrency issues) — balance updates, debit/credit atomicity
- **rez-finance-service** — ledger, settlement, loan/BNPL disbursement

## Bug-ID prefix map

| Prefix | Service |
|--------|---------|
| BE-GW | API gateway |
| BE-AUTH | Authentication service |
| BE-CAT | Catalog (products/categories/brands) |
| BE-MER | Merchant registry |
| BE-ORD | Order lifecycle |
| BE-PAY | Payment gateway integration |
| BE-WAL | Wallet balance / transactions |
| BE-FIN | Finance / ledger / loans / BNPL |
| BE-SRC | Search / indexing |
| BE-GAM | Gamification engine |
| BE-KAR | Karma scoring |
| BE-MKT | Marketing campaigns |
| BE-ADS | Ads serving / fraud |
| BE-SHR | Shared packages (types/schemas/utils) |
| BE-EVT | Event pipeline (notif/media/analytics) |
