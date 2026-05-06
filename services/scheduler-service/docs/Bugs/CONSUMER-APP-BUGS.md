# Consumer App — Exhaustive Bug Audit (Master Index)

> **Audit date:** 2026-04-15
> **Scope:** `rez-app-consumer` (React Native + Expo Router) — 2,758 source files across app routes, services, hooks, components, utils, contexts, stores
> **Analysis types:** Static, Runtime/Logic, API contract/Backend mismatch, Security
> **Method:** 10 parallel domain-scoped audit agents reading source files end-to-end
> **Status:** Open — remediation plan in [CONSUMER-APP-REMEDIATION-PLAN.md](CONSUMER-APP-REMEDIATION-PLAN.md)

## Totals

- **TOTAL BUGS:** 559
- **CRITICAL:** 26
- **HIGH:** 103
- **MEDIUM:** 375
- **LOW:** 55

## Breakdown by Domain

| # | Domain | File | Total | CRIT | HIGH | MED | LOW |
|---|--------|------|-------|------|------|-----|-----|
| 1 | Travel Module | [CONSUMER-APP-TRAVEL.md](CONSUMER-APP-TRAVEL.md) | 75 | 0 | 14 | 51 | 10 |
| 2 | Commerce & Orders | [CONSUMER-APP-COMMERCE.md](CONSUMER-APP-COMMERCE.md) | 50 | 5 | 17 | 28 | 0 |
| 3 | Payments & Wallet | [CONSUMER-APP-PAYMENTS.md](CONSUMER-APP-PAYMENTS.md) | 65 | 4 | 14 | 40 | 7 |
| 4 | Auth & Account | [CONSUMER-APP-AUTH.md](CONSUMER-APP-AUTH.md) | 41 | 6 | 12 | 21 | 1 |
| 5 | Gamification & Rewards | [CONSUMER-APP-GAMIFICATION.md](CONSUMER-APP-GAMIFICATION.md) | 60 | 4 | 9 | 40 | 7 |
| 6 | Discovery, Stores, Social | [CONSUMER-APP-DISCOVERY.md](CONSUMER-APP-DISCOVERY.md) | 55 | 0 | 7 | 35 | 13 |
| 7 | Hooks / Contexts / Utils / Stores | [CONSUMER-APP-INFRA.md](CONSUMER-APP-INFRA.md) | 30 | 2 | 7 | 15 | 6 |
| 8 | Component Library | [CONSUMER-APP-COMPONENTS.md](CONSUMER-APP-COMPONENTS.md) | 130 | 0 | 14 | 116 | 0 |
| 9 | API Contracts & Backend Mismatch | [CONSUMER-APP-API-CONTRACTS.md](CONSUMER-APP-API-CONTRACTS.md) | 15 | 3 | 3 | 8 | 1 |
| 10 | Security | [CONSUMER-APP-SECURITY.md](CONSUMER-APP-SECURITY.md) | 40 | 2 | 6 | 21 | 10 |

## Bug ID Prefixes

| Prefix | Domain |
|--------|--------|
| `CA-TRV-###` | Travel (flight/hotel/train/bus/cab) |
| `CA-CMC-###` | Commerce (cart/checkout/order/product) |
| `CA-PAY-###` | Payments, wallet, bills, refunds |
| `CA-AUT-###` | Auth, account, profile, onboarding |
| `CA-GAM-###` | Gamification, achievements, referral, games |
| `CA-DSC-###` | Discovery, stores, feed, UGC, social |
| `CA-INF-###` | Infra: hooks, contexts, utils, stores |
| `CA-CMP-###` | Shared component library |
| `CA-API-###` | API contracts & backend mismatch |
| `CA-SEC-###` | Security findings |

## Caveats

- `npm install` in `rez-app-consumer` timed out; bug findings are from static source reading, not `tsc`/`eslint`. A follow-up tooling pass should validate with real compiler output.
- Component library file hit agent output limit — `CONSUMER-APP-COMPONENTS.md` covers the most-used components; a second pass is listed in the remediation plan.
- Bug IDs are unique within this consumer-app audit. Prior historic audits (see `00-INDEX.md`) use different prefixes (C*, H*, M*, SD, FM, API).
