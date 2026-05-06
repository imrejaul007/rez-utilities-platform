# Health Score Breakdown — FORENSIC-001

## Overall Health Score: 35/100
## Verdict: RECOVERABLE — Structural Surgery Required

---

## Scoring Methodology

| Dimension | Weight | Score | Rationale |
|-----------|--------|-------|-----------|
| Security | 25% | 18/100 | 7 auth failures, secrets on disk, no auth on 3 services |
| Data Integrity | 25% | 22/100 | Dual authority, FSM forks, 2x karma inflation |
| Financial Logic | 20% | 25/100 | Settlement blind spot, TOCTOU race, coin divergence |
| Operational Reliability | 15% | 45/100 | Silent failures, no DLQ, fails-open rate limiter |
| Architecture | 15% | 65/100 | Copy-based extraction is correct pattern, but dual authority kills it |

---

## Per-Service Health Scores

| Service | Score | Critical | High | Medium | Low | Info |
|---------|-------|---------|------|--------|-----|------|
| `rez-auth-service` | 45/100 | 1 | 1 | 1 | 0 | 0 |
| `rez-payment-service` | 28/100 | 2 | 4 | 3 | 1 | 0 |
| `rez-wallet-service` | 38/100 | 2 | 1 | 2 | 1 | 0 |
| `rez-order-service` | 35/100 | 1 | 3 | 2 | 0 | 0 |
| `rez-merchant-service` | 32/100 | 1 | 1 | 2 | 0 | 0 |
| `rez-catalog-service` | 22/100 | 1 | 1 | 1 | 0 | 0 |
| `rez-search-service` | 42/100 | 0 | 2 | 1 | 0 | 0 |
| `rez-karma-service` | 10/100 | 3 | 0 | 0 | 0 | 0 |
| `rez-finance-service` | 30/100 | 1 | 1 | 1 | 0 | 0 |
| `rez-notification-events` | 55/100 | 0 | 1 | 1 | 0 | 1 |
| `rez-media-events` | 25/100 | 1 | 0 | 0 | 0 | 0 |
| `rez-api-gateway` | 50/100 | 0 | 1 | 1 | 1 | 1 |
| `rez-backend` (monolith) | 30/100 | 5 | 3 | 5 | 2 | 1 |
| `rez-shared` | 40/100 | 0 | 2 | 2 | 0 | 0 |
| `rez-ads-service` | N/A | 0 | 0 | 0 | 0 | 0 |
| `rez-gamification-service` | 60/100 | 0 | 0 | 1 | 0 | 0 |
| `rez-scheduler-service` | 55/100 | 0 | 0 | 1 | 0 | 0 |

---

## Score Distribution

| Score Range | Count | Services |
|------------|-------|----------|
| 0-20 (Critical) | 1 | karma-service |
| 21-40 (Poor) | 5 | payment-service, wallet-service, order-service, merchant-service, catalog-service, backend, media-events |
| 41-60 (Fair) | 6 | auth-service, search-service, notification-events, api-gateway, gamification-service, scheduler-service, shared |
| 61-80 (Good) | 0 | — |
| 81-100 (Excellent) | 0 | — |

---

## Category Breakdown

| Category | Finding Count | Highest Severity | Score Impact |
|----------|-------------|-----------------|-------------|
| Security | 9 | CRITICAL | -18 |
| Data Integrity | 7 | CRITICAL | -14 |
| Financial Logic | 5 | CRITICAL | -12 |
| Architecture | 4 | CRITICAL | -8 |
| Business Logic | 5 | CRITICAL | -8 |
| Build/Deployment | 1 | CRITICAL | -3 |
| Performance | 4 | MEDIUM | -3 |
| Reliability | 5 | HIGH | -4 |
| Validation | 4 | MEDIUM | -2 |
| Observability | 3 | MEDIUM | -1 |

---

## Critical Path Analysis

The most dangerous path (most revenue/security impact):

```
Razorpay Webhook
  → razorpay_webhooks collection
  → payment-service webhook handler
  → wallet credit (CRITICAL-010: hardcoded rate)
  → wallet service (CRITICAL-003: TOCTOU race)
  → settlement calculation (CRITICAL-001: blind spot)
  → merchant payout (underpaid)
```

Each hop in this path has at least one critical finding.

---

## What Would Bring Score to 50+

1. Fix CRITICAL-001 (settlement blind spot) → +5 points
2. Fix CRITICAL-004/002 (auth failures) → +5 points
3. Fix CRITICAL-005 (karma 2x inflation) → +3 points
4. Fix CRITICAL-008 (dual authority) → +10 points
5. Fix CRITICAL-009 (FSM unification) → +5 points

**Target: 63/100 after P0+P1 fixes**

---

## What Would Bring Score to 75+

All of the above plus:
- Fix CRITICAL-013/016 (status sync) → +3 points
- Fix CRITICAL-014 (static file auth) → +2 points
- Fix HIGH-001 through HIGH-015 → +8 points
- Implement shadow mode cutover → +5 points

**Target: 81/100 after P2 fixes**
