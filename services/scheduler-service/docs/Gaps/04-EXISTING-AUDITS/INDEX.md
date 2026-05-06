# Existing Audit Reports — Mapped to Gap Analysis

**Date:** 2026-04-16
**Purpose:** Show how existing audit documents relate to the new gap registry

---

## Full App Audits

| File | Scope | Key Findings | Gap Overlap |
|------|-------|-------------|-------------|
| `docs/AUDIT_ADMIN_FULL.md` | Admin app | Security, API contracts | LOW — separate app |
| `docs/AUDIT_BACKEND_FULL.md` | All backend services | Security, business logic | MEDIUM — overlaps auth, karma |
| `docs/AUDIT_CONSUMER_FULL.md` | Consumer app | UI/UX, API contracts | MEDIUM — overlaps gamification |
| `docs/AUDIT_E2E_FLOWS_FULL.md` | Cross-service flows | 5 critical flows broken | HIGH — voucherCode, merchantId |
| `docs/AUDIT_GATEWAY_SHARED_FULL.md` | API gateway + shared | Gateway routing, shared types | MEDIUM — shared types divergence |
| `docs/AUDIT_MERCHANT_FULL.md` | Merchant app | Security, orders, payments | LOW — separate app |

---

## Bug Registry (docs/Bugs/)

### Karma-Related Bug Files

| File | Coverage | Gap Overlap |
|------|----------|-------------|
| `BACKEND-KARMA.md` | Karma service backend issues | **HIGH** — 24 of 35 karma gaps overlap |
| `CONSUMER-APP-GAMIFICATION.md` | Consumer gamification/karma UI | **HIGH** — 17 of 20 karma UI gaps overlap |
| `09-TYPE-FRAGMENTATION.md` | Type/enum fragmentation across apps | **HIGH** — 4 cross-ref gaps mapped |
| `BACKEND-AUTH.md` | Auth service issues | MEDIUM — auth proxy, role checks |
| `BACKEND-FINANCE.md` | Finance service issues | MEDIUM — CSR pool, wallet |
| `BACKEND-WALLET.md` | Wallet service issues | LOW — wallet integration |
| `10-CALCULATION-MISMATCHES.md` | Cross-service calculation errors | MEDIUM — karma calculations |

### Key Finding
**`BACKEND-KARMA.md`** and **`CONSUMER-APP-GAMIFICATION.md`** are the most relevant existing docs — they document issues in the same components this audit examined. 41 of 55 gaps (75%) map back to these files.

---

## Static Analysis Reports (docs/static-analysis/)

| File | Coverage | Gap Overlap |
|------|----------|-------------|
| `SA1-architecture.md` | Service architecture | LOW |
| `SA2-field-consistency.md` | Field/type consistency | **MEDIUM** — week boundaries, type safety |
| `SA3-api-contracts.md` | API contract validation | **MEDIUM** — voucherCode, profile routes |
| `SA4-auth-flow.md` | Auth flow analysis | **MEDIUM** — auth proxy, role checks |
| `SA5-route-mapping.md` | Route mapping | LOW — indexes, performance |
| `SA6-consumer-state-flow.md` | Consumer state | LOW — real-time sync |
| `SA7-admin-merchant-state-flow.md` | Admin/merchant state | LOW |
| `SA8-duplication-devsetup.md` | Code duplication | LOW |

---

## Phase Reports (Root Directory)

| File | Coverage | Gap Overlap |
|------|----------|-------------|
| `PHASE_2_3_CROSS_VERIFICATION_REPORT.md` | 5 E2E flows, API contracts | **HIGH** — CRF-001 voucherCode, CRF-002 merchantId |
| `CRITICAL_FINDINGS_SUMMARY.txt` | 3 CRITICAL + 2 HIGH cross-service issues | **HIGH** — CRF-001, CRF-002, CRF-003 |
| `REMEDIATION_GUIDE.md` | Step-by-step fixes for critical issues | HIGH — remediation steps |
| `PHASE-11-BUG-FIX-REPORT.md` | Phase 11 fixes | MEDIUM |
| `LOGIC-AUDIT-FIXES-VERIFIED.md` | Logic audit fixes | MEDIUM |

---

## Phase Reports (docs/Bugs/)

| File | Coverage | Gap Overlap |
|------|----------|-------------|
| `AUTONOMOUS-FIX-REPORT-PHASE-3-2026-04-15.md` | Phase 3 fixes | MEDIUM |
| `AUTONOMOUS-FIX-REPORT-PHASE-4-2026-04-15.md` | Phase 4 fixes | MEDIUM |
| `AUTONOMOUS-FIX-REPORT-PHASE-5-2026-04-15.md` | Phase 5 fixes | MEDIUM |
| `PHASE-3-AGENT-8-REPORT.md` | Agent 8 karma analysis | **HIGH** — karma service |
| `PHASE-7D-MEDIUM-BUG-AUDIT.md` | Medium severity bugs | MEDIUM |
| `PHASE-10-HIGH-BUG-GROOMING-REPORT.md` | High severity bugs | HIGH |
| `PHASE-6-AUTONOMOUS-FIX-REPORT-2026-04-16.md` | Phase 6 fixes | MEDIUM |

---

## Prioritized Reading for Gap Context

To understand the history of each gap category before diving into fixes:

1. **Security gaps (G-KS-C*)** → Read `docs/Bugs/BACKEND-AUTH.md` + `docs/AUDIT_BACKEND_FULL.md`
2. **Business logic gaps (G-KS-B*)** → Read `docs/Bugs/BACKEND-KARMA.md` + `PHASE_2_3_CROSS_VERIFICATION_REPORT.md`
3. **Type divergence (G-CR-X*, G-KU-C3, G-KU-H1)** → Read `docs/Bugs/09-TYPE-FRAGMENTATION.md`
4. **Consumer UI gaps (G-KU-*)** → Read `docs/Bugs/CONSUMER-APP-GAMIFICATION.md`
5. **Enum mismatches (G-CR-X2, G-CR-X4)** → Read `docs/Bugs/09-TYPE-FRAGMENTATION.md`

---

## Gap vs Existing Doc: What's NEW

Issues identified in this audit that do NOT appear in existing docs:

| Gap ID | Why It's New |
|--------|-------------|
| G-KS-C1 | Hardcoded default QR secret — not previously documented |
| G-KS-C5 | Unauthenticated batch stats endpoint — not previously documented |
| G-KS-C6 | TimingSafeEqual throws on length mismatch — new crypto finding |
| G-KS-C7 | Idempotency key collision with UUID suffix — not previously documented |
| G-KS-B4 | Auto-checkout doesn't create EarnRecord — not previously documented |
| G-KS-B5 | Decay worker runs weekly not daily — not previously documented |
| G-KS-B6 | GPS score discontinuous at boundary — not previously documented |
| G-KS-B8 | Non-atomic CSR pool decrement — not previously documented |
| G-KS-A4 | karma_events collection may not exist — not previously documented |
| G-KU-C1 | event.totalHours not in type — new runtime crash |
| G-KU-H3 | No rapid-scan debounce — not previously documented |
| G-KU-H4 | eventId/mode stale on navigation — not previously documented |
| G-KU-H7 | Booking empty object not validated — not previously documented |
| G-KU-M4 | No real-time sync — not previously documented |
| G-KU-M5 | No auth guard on scan screen — not previously documented |
| G-KU-M6 | Every catch block empty — not previously documented |
| G-KU-M7 | Unknown difficulty silently defaults — not previously documented |

**16 of 62 gaps (26%) are entirely new findings** not covered in any existing audit document.
