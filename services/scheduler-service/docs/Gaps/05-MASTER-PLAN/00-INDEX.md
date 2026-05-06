# Master Remediation Plan — Karma App Gaps

> **⚠️ DEPRECATED — Use [../08-MASTER-PLAN/00-INDEX.md](../08-MASTER-PLAN/00-INDEX.md) for the unified fix plan across ALL codebases.**

**Date:** 2026-04-16
**Total Issues:** 64 (11 CRITICAL, 19 HIGH, 25 MEDIUM, 10 LOW)
**Scope:** karma-service + karma consumer app + cross-service alignment

---

## Execution Phases

| Phase | Focus | Issues | Timeline |
|-------|-------|--------|----------|
| **Phase 1** | Critical Security | 11 CRITICAL | Today |
| **Phase 2** | Business Logic | 9 HIGH (logic) + 4 CRITICAL | This week |
| **Phase 3** | Data & UX | 10 HIGH (data/UX) + 24 MEDIUM | This sprint |

---

## Phase 1: Critical Security (Today)

See [PHASE1-SECURITY.md](PHASE1-SECURITY.md) for full detail.

**All 11 issues must be fixed before any production deployment.**

| # | Gap ID | Title | File | Effort |
|---|--------|-------|------|--------|
| 1 | G-KS-C1 | Hardcoded default QR secret | `verificationEngine.ts` | 10 min |
| 2 | G-KS-C2 | Auth middleware trusts response | `auth.ts` | 15 min |
| 3 | G-KS-C3 | jwtSecret unvalidated | `config/index.ts` | 5 min |
| 4 | G-KS-C4 | Horizontal privilege escalation | `karmaRoutes.ts` | 10 min |
| 5 | G-KS-C5 | Batch stats unauthenticated | `batchRoutes.ts` | 5 min |
| 6 | G-KS-C6 | TimingSafeEqual throws | `verificationEngine.ts` | 5 min |
| 7 | G-KS-C7 | Idempotency key collision | `earnRecordService.ts` | 10 min |
| 8 | G-KS-C8 | String vs ObjectId auth bypass | `verifyRoutes.ts` | 10 min |
| 9 | G-KS-C9 | Karma-to-coin conversion broken | `walletIntegration.ts` | 15 min |
| 10 | G-KS-C10 | EarnRecord schema vs canonical mismatch | `EarnRecord.ts` | 30 min |
| 11 | G-KS-H1 | Admin role check case-sensitive | `adminAuth.ts` | 10 min |

**Phase 1 Total Effort:** ~2.5 hours

---

## Phase 2: Business Logic (This Week)

See [PHASE2-BUSINESS-LOGIC.md](PHASE2-BUSINESS-LOGIC.md) for full detail.

| # | Gap ID | Title | File | Effort |
|---|--------|-------|------|--------|
| 1 | G-KS-B1 | Duplicate const — compile error + wrong boundary | `karmaService.ts` | 15 min |
| 2 | G-KS-B2 | No karma validation — accepts negative/NaN | `karmaService.ts` | 15 min |
| 3 | G-KS-B3 | Kill switch sets wrong status | `batchService.ts` | 5 min |
| 4 | G-KS-B4 | Auto-checkout no EarnRecord — karma lost | `autoCheckoutWorker.ts` | 30 min |
| 5 | G-KS-B5 | Decay runs weekly not daily | `decayWorker.ts` | 5 min |
| 6 | G-KS-B6 | GPS score discontinuous at boundary | `karmaEngine.ts` | 20 min |
| 7 | G-KS-B7 | Mixed week boundaries | Multiple files | 30 min |
| 8 | G-KS-B8 | Non-atomic CSR pool decrement | `batchService.ts` | 20 min |
| 9 | G-KS-C10 | NoSQL injection risk | `batchRoutes.ts` | 15 min |
| 10 | G-KS-C11 | Rate limiting disabled without Redis | `index.ts` | 20 min |
| 11 | G-KS-E1 | Silent return 0 on wallet failure | `walletIntegration.ts` | 10 min |

**Phase 2 Total Effort:** ~3 hours

---

## Phase 3: Data & UX (This Sprint)

See [PHASE3-DATA-UX.md](PHASE3-DATA-UX.md) for full detail.

| # | Gap ID | Title | File | Effort |
|---|--------|-------|------|--------|
| 1 | G-KU-C1 | totalHours not in type — runtime crash | `event/[id].tsx` | 5 min |
| 2 | G-KU-C2 | Fragile check-in logic | `event/[id].tsx` | 10 min |
| 3 | G-KU-C3 | KarmaEvent type divergent | `karmaService.ts` | 30 min |
| 4 | G-KU-H1 | KarmaProfile divergent from canonical | `karmaService.ts` | 30 min |
| 5 | G-KU-H2 | CoinType branded mismatch | `wallet.tsx` | 15 min |
| 6 | G-KU-H3 | No rapid-scan debounce | `scan.tsx` | 15 min |
| 7 | G-KU-H4 | eventId/mode stale on navigation | `scan.tsx` | 10 min |
| 8 | G-KU-H5 | Empty catch block on history | `my-karma.tsx` | 10 min |
| 9 | G-KU-H6 | Unknown status fallback to Pending | `my-karma.tsx` | 10 min |
| 10 | G-KU-H7 | Booking empty object not validated | `event/[id].tsx` | 10 min |
| 11 | G-KS-A1 | lastDecayAppliedAt missing from schema | `KarmaProfile.ts` | 10 min |
| 12 | G-KS-A2 | Missing compound indexes | `EarnRecord.ts` | 15 min |
| 13 | G-KS-A3 | No concurrency lock on scheduler | `batchScheduler.ts` | 20 min |
| 14 | G-KS-E2 | QR clock drift window | `verificationEngine.ts` | 10 min |
| 15 | G-KS-E3 | Silent audit failures for critical actions | `auditService.ts` | 15 min |
| 16 | G-KU-M1 | joinEvent null data no error | `event/[id].tsx` | 10 min |
| 17 | G-KU-M2 | Spinner on every tab refocus | `my-karma.tsx`, `wallet.tsx` | 20 min |
| 18 | G-KU-M3 | Hardcoded level thresholds | `home.tsx` | 5 min |
| 19 | G-KU-M4 | No real-time sync | All screens | 60 min |
| 20 | G-KU-M5 | No auth guard on scan | `scan.tsx` | 15 min |
| 21 | G-KU-M6 | Every catch block empty | 5 files | 30 min |
| 22 | G-KU-M7 | Unknown difficulty defaults to medium | `event/[id].tsx` | 10 min |
| 23 | G-CR-X1 | KarmaProfile 14 missing fields | `karmaService.ts` | 45 min |
| 24 | G-CR-X2 | CoinType branded mismatch | Multiple files | 20 min |
| 25 | G-CR-X4 | Booking status canonical unverified | Multiple files | 15 min |
| 26 | G-CR-X6 | Karma level canonical unverified | Multiple files | 15 min |
| 27 | G-KS-A4 | karma_events collection missing | `batchService.ts` | 30 min |
| 28 | G-KS-A5 | PAUSED status dead code | `Batch.ts` | 10 min |
| 29 | G-KS-F1 | ObjectId throws on invalid userId | `karmaRoutes.ts` | 10 min |
| 30 | G-KS-F3 | GPS checkout falls back to (0,0) | `verificationEngine.ts` | 20 min |
| 31 | G-KS-F4 | parseInt NaN as query limit | `karmaRoutes.ts` | 5 min |

**Phase 3 Total Effort:** ~8 hours

---

## LOW Priority (Tech Debt Backlog)

| Gap ID | Title | Effort |
|--------|-------|--------|
| G-KS-C12 | Two logger instances | 15 min |
| G-KS-A6 | Workers not stopped on shutdown | 10 min |
| G-KS-A7 | Dead code: timestamp fallback | 5 min |
| G-KS-A8 | Template literal wrong quotes | 5 min |
| G-KS-E4 | Dead code: timestamp fallback (UI) | 5 min |
| G-KS-E5 | Template literal wrong quotes (UI) | 5 min |
| G-KS-F5 | Floating-point precision | 5 min |
| G-KS-F2 | String vs ObjectId batchId | 10 min |
| G-KU-L1 | filteredEvents no-op | 5 min |
| G-KU-L2 | Hardcoded partner names | 20 min |
| G-KU-L3 | useFocusEffect refetch | 15 min |

---

## Progress Tracking

After each phase is complete, update status in each gap doc from `ACTIVE` to `RESOLVED` and record the PR/commit in the doc.
