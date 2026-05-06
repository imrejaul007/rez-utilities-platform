# Gaps Documentation — Index

## Forensic Audit Finding ID: FORENSIC-001
## Date: 2026-04-16
## Health Score: 35/100
## Verdict: RECOVERABLE — Structural Surgery Required

---

## Critical Issues (P0) — 17 Documents

| # | ID | Title | Service | Category |
|---|-----|-------|---------|----------|
| 1 | CRITICAL-001 | Settlement blind spot | merchant-service | Revenue |
| 2 | CRITICAL-002 | Catalog auth broken | catalog-service | Security |
| 3 | CRITICAL-003 | Merchant withdrawal TOCTOU | wallet-service | Financial |
| 4 | CRITICAL-004 | Karma auth 404 | karma-service | Security |
| 5 | CRITICAL-005 | Karma 2x inflation | karma-service | Data Integrity |
| 6 | CRITICAL-006 | Admin cron consumer auth | backend | Security |
| 7 | CRITICAL-007 | FraudFlag model missing | backend | Security |
| 8 | CRITICAL-008 | Dual authority | ALL | Architecture |
| 9 | CRITICAL-009 | Three payment FSMs | backend/payment | FSM |
| 10 | CRITICAL-010 | Coin rate divergence | payment/wallet | Financial |
| 11 | CRITICAL-011 | Internal key unvalidated | ALL | Security |
| 12 | CRITICAL-012 | Firebase JSON on disk | backend | Security |
| 13 | CRITICAL-013 | Order statuses out of sync | backend/shared | FSM |
| 14 | CRITICAL-014 | Static files unauthenticated | media-events | Security |
| 15 | CRITICAL-015 | Silent coin failure | finance-service | Reliability |
| 16 | CRITICAL-016 | Returned progress mismatch | backend/shared | Data Integrity |
| 17 | CRITICAL-017 | Karma won't compile | karma-service | Build |

---

## High Issues (P1) — 15 Documents

| # | ID | Title |
|---|-----|-------|
| 1 | HIGH-001 | Payment webhook secret in body |
| 2 | HIGH-002 | Non-atomic wallet credit |
| 3 | HIGH-003 | Payment auth rejects legacy token |
| 4 | HIGH-004 | Order invalid nested object |
| 5 | HIGH-005 | Bulk order actions bypass FSM |
| 6 | HIGH-006 | BNPL eligibility OR instead of AND |
| 7 | HIGH-007 | Search rate limiter fails open |
| 8 | HIGH-008 | Order Zod schemas unused |
| 9 | HIGH-009 | Order SSE no auth |
| 10 | HIGH-010 | Coin type normalization lost |
| 11 | HIGH-011 | Loyalty tier 'DIMAOND' typo |
| 12 | HIGH-012 | Payment hardcoded coin cap |
| 13 | HIGH-013 | authorized state no inbound path |
| 14 | HIGH-014 | Search paths not routed gateway |
| 15 | HIGH-015 | 40+ Schema.Types.Mixed |

---

## Medium Issues — 20 Items

| File | Count |
|------|-------|
| MEDIUM-001-020-summary.md | 20 |

---

## Low Issues — 8 Items

| File | Count |
|------|-------|
| LOW-001-008-summary.md | 8 |

---

## Informational — 5 Items

| File | Count |
|------|-------|
| LOW-001-008-summary.md | 5 |

---

## Cross-Reference & Planning

| File | Description |
|------|-------------|
| CROSS-REFERENCE-ALL-AUDITS.md | Gap clustering, service mapping, cross-report comparison |
| SOLUTION-PLAN.md | Phased remediation plan with effort estimates |

---

## Total Findings: 65

- 17 Critical (P0)
- 15 High (P1)
- 20 Medium (P2)
- 8 Low (P3)
- 5 Informational

## Root Causes: 5

1. **Copy-based extraction** — monolith retained logic while services got copies
2. **No monorepo** — services in separate repos, FSMs/enums forked
3. **Shared MongoDB cluster** — no database-level isolation
4. **No shared schema registry** — `Schema.Types.Mixed` in 40+ models
5. **No cutover mechanism** — shadow mode runs indefinitely
