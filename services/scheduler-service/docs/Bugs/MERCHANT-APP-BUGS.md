# Merchant App — Master Bug Index

> **Audit target:** `rezmerchant` (React Native + Expo Router)
> **Method:** Exhaustive static source reading (12 parallel audit agents, domain-scoped)
> **Caveat:** `npm install`/`tsc`/`eslint` could not be run during the audit; all findings come from source reading. Phase 0 of the remediation plan restores build/CI so the lint/TS pass can cross-check these findings.
> **Related:** See [UNIFIED-REMEDIATION-PLAN.md](UNIFIED-REMEDIATION-PLAN.md) for the cross-app fix plan.

---

## Severity totals

| Severity | Count |
|----------|------:|
| CRITICAL | 14 |
| HIGH | 49 |
| MEDIUM | 258 |
| LOW | 29 |
| **Total** | **350** |

## Domain breakdown

| # | Domain | File | Prefix | CRIT | HIGH | MED | LOW | Total |
|--:|--------|------|--------|-----:|-----:|----:|----:|------:|
| 1 | Auth / Onboarding | [MERCHANT-APP-AUTH.md](MERCHANT-APP-AUTH.md) | MA-AUT | 3 | 7 | 16 | 2 | 28 |
| 2 | Stores / Catalog | [MERCHANT-APP-STORES.md](MERCHANT-APP-STORES.md) | MA-STR | 0 | 4 | 22 | 2 | 28 |
| 3 | Orders / Fulfillment | [MERCHANT-APP-ORDERS.md](MERCHANT-APP-ORDERS.md) | MA-ORD | 1 | 4 | 26 | 0 | 31 |
| 4 | Payments / Wallet | [MERCHANT-APP-PAYMENTS.md](MERCHANT-APP-PAYMENTS.md) | MA-PAY | 3 | 8 | 19 | 0 | 30 |
| 5 | Gamification | [MERCHANT-APP-GAMIFICATION.md](MERCHANT-APP-GAMIFICATION.md) | MA-GAM | 1 | 5 | 31 | 5 | 42 |
| 6 | Discovery / UGC | [MERCHANT-APP-DISCOVERY.md](MERCHANT-APP-DISCOVERY.md) | MA-DSC | 0 | 0 | 25 | 3 | 28 |
| 7 | Travel verticals | [MERCHANT-APP-TRAVEL.md](MERCHANT-APP-TRAVEL.md) | MA-TRV | 0 | 6 | 18 | 4 | 28 |
| 8 | Infra / State | [MERCHANT-APP-INFRA.md](MERCHANT-APP-INFRA.md) | MA-INF | 0 | 3 | 24 | 2 | 29 |
| 9 | Components | [MERCHANT-APP-COMPONENTS.md](MERCHANT-APP-COMPONENTS.md) | MA-CMP | 0 | 1 | 23 | 7 | 31 |
| 10 | API contracts | [MERCHANT-APP-API-CONTRACTS.md](MERCHANT-APP-API-CONTRACTS.md) | MA-API | 2 | 6 | 22 | 2 | 32 |
| 11 | Security | [MERCHANT-APP-SECURITY.md](MERCHANT-APP-SECURITY.md) | MA-SEC | 4 | 5 | 16 | 0 | 25 |
| 12 | System / Admin / Support | [MERCHANT-APP-SYS.md](MERCHANT-APP-SYS.md) | MA-SYS | 0 | 0 | 16 | 2 | 18 |

## Bug-ID prefix map

| Prefix | Domain |
|--------|--------|
| MA-AUT | Auth / onboarding |
| MA-STR | Stores / catalog |
| MA-ORD | Orders / fulfillment |
| MA-PAY | Payments / wallet / khata |
| MA-GAM | Gamification / rewards / referral |
| MA-DSC | Discovery / UGC / offers |
| MA-TRV | Travel verticals (flight/hotel/bus/train/cab) |
| MA-INF | Infra / contexts / stores / hooks |
| MA-CMP | Shared components |
| MA-API | API contract / type drift |
| MA-SEC | Security / PII / deep-links |
| MA-SYS | Admin, settings, help, notifications |

## Progress tracking

When a bug is merged, append below the bug heading in its category file:

```
> **Status:** Fixed in <PR#> (<YYYY-MM-DD>)
```

Weekly CI job should regenerate severity totals by re-counting `**Severity:**` lines in each file.
