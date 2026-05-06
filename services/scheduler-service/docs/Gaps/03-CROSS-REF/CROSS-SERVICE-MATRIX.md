# CROSS-REF: Issue → Existing Audit Doc Matrix

**Date:** 2026-04-16
**Purpose:** Map each new gap to related existing audit documents for cross-reference

---

## Karma Service Gaps → Existing Audit Docs

| Gap ID | Title | Related Existing Doc | Notes |
|--------|-------|----------------------|-------|
| G-KS-C1 | Hardcoded QR secret | `docs/Bugs/BACKEND-KARMA.md` | New finding — not in prior audit |
| G-KS-C2 | Auth unvalidated | `docs/Bugs/BACKEND-AUTH.md` | Related to auth proxy pattern |
| G-KS-C3 | jwtSecret unvalidated | `docs/Bugs/BACKEND-AUTH.md` | Related to env validation |
| G-KS-C4 | Horizontal privilege | `docs/Bugs/BACKEND-KARMA.md` | New finding |
| G-KS-C5 | Unauthenticated stats | `docs/Bugs/BACKEND-KARMA.md` | New finding |
| G-KS-C6 | TimingSafeEqual throws | `docs/Bugs/BACKEND-KARMA.md` | Crypto vulnerability |
| G-KS-C7 | Idempotency collision | `docs/Bugs/BACKEND-KARMA.md` | New finding |
| G-KS-C8 | String vs ObjectId auth | `docs/Bugs/BACKEND-AUTH.md` | Auth bypass pattern |
| G-KS-C9 | Admin role case-sensitive | `docs/Bugs/BACKEND-AUTH.md` | Role normalization |
| G-KS-B1 | Duplicate const | `docs/static-analysis/SA2-field-consistency.md` | TypeScript strict mode issue |
| G-KS-B2 | No karma validation | `docs/Bugs/BACKEND-KARMA.md` | Input validation |
| G-KS-B3 | Kill switch wrong status | `docs/Bugs/BACKEND-KARMA.md` | Batch logic |
| G-KS-B4 | Auto-checkout no EarnRecord | `docs/Bugs/BACKEND-KARMA.md` | Data loss |
| G-KS-B5 | Decay runs weekly not daily | `docs/Bugs/BACKEND-KARMA.md` | Cron config |
| G-KS-B6 | GPS score discontinuous | `docs/Bugs/BACKEND-KARMA.md` | Scoring algorithm |
| G-KS-B7 | Mixed week boundaries | `docs/static-analysis/SA2-field-consistency.md` | Date handling |
| G-KS-B8 | Non-atomic CSR pool | `docs/Bugs/BACKEND-FINANCE.md` | Financial integrity |
| G-KS-F1 | ObjectId throws | `docs/Bugs/BACKEND-KARMA.md` | Input validation |
| G-KS-F2 | String vs ObjectId batchId | `docs/static-analysis/SA2-field-consistency.md` | Type safety |
| G-KS-F3 | GPS falls back to (0,0) | `docs/Bugs/BACKEND-KARMA.md` | Checkout logic |
| G-KS-F4 | parseInt NaN | `docs/Bugs/BACKEND-KARMA.md` | Query params |
| G-KS-A1 | lastDecayAppliedAt missing | `docs/Bugs/BACKEND-KARMA.md` | Schema gap |
| G-KS-A2 | Missing indexes | `docs/static-analysis/SA5-route-mapping.md` | Performance |
| G-KS-A3 | No concurrency lock | `docs/Bugs/BACKEND-KARMA.md` | Scheduler reliability |
| G-KS-A4 | karma_events missing | `docs/Bugs/BACKEND-KARMA.md` | Anomaly detection |
| G-KS-A5 | PAUSED dead code | `docs/Bugs/BACKEND-KARMA.md` | Batch status |
| G-KS-A6 | Workers not stopped | `docs/Bugs/BACKEND-KARMA.md` | Lifecycle |
| G-KS-E1 | Silent return 0 | `docs/Bugs/BACKEND-WALLET.md` | Wallet integration |
| G-KS-E2 | QR clock drift | `docs/Bugs/BACKEND-KARMA.md` | QR validation |
| G-KS-E3 | Silent audit failures | `docs/Bugs/BACKEND-KARMA.md` | Audit trail |

---

## Karma UI Gaps → Existing Audit Docs

| Gap ID | Title | Related Existing Doc | Notes |
|--------|-------|----------------------|-------|
| G-KU-C1 | totalHours undefined | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Type mismatch |
| G-KU-C2 | Fragile check-in logic | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Booking status |
| G-KU-C3 | KarmaEvent type divergent | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Type fragmentation |
| G-KU-H1 | KarmaProfile divergent | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Type fragmentation |
| G-KU-H2 | CoinType mismatch | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Enum mismatch |
| G-KU-H3 | No rapid-scan debounce | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Duplicate submissions |
| G-KU-H4 | Stale nav params | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Navigation state |
| G-KU-H5 | Empty catch block | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Silent failures |
| G-KU-H6 | Unknown status fallback | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Enum handling |
| G-KU-H7 | Empty object booking | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | API contract |
| G-KU-M1 | joinEvent null data | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | API contract |
| G-KU-M2 | Spinner on refocus | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | UX |
| G-KU-M3 | Hardcoded level thresholds | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Business logic |
| G-KU-M4 | No real-time sync | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Real-time |
| G-KU-M5 | No auth guard scan | `docs/Bugs/CONSUMER-APP-SECURITY.md` | Auth |
| G-KU-M6 | Empty catch everywhere | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Error handling |
| G-KU-M7 | Unknown difficulty | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Enum safety |
| G-KU-L1 | No-op variable | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Code quality |
| G-KU-L2 | Hardcoded partners | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Placeholder data |
| G-KU-L3 | useFocusEffect refetch | `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | Performance |

---

## Cross-Service Gaps → Existing Audit Docs

| Gap ID | Title | Related Existing Doc | Notes |
|--------|-------|----------------------|-------|
| G-CR-X1 | KarmaProfile missing 14 fields | `docs/Bugs/09-TYPE-FRAGMENTATION.md` | Type fragmentation |
| G-CR-X2 | CoinType branded mismatch | `docs/Bugs/09-TYPE-FRAGMENTATION.md` | Enum divergence |
| G-CR-X3 | EarnRecord status (consistent) | `docs/Bugs/09-TYPE-FRAGMENTATION.md` | ✅ No action needed |
| G-CR-X4 | Booking status unverified | `docs/Bugs/09-TYPE-FRAGMENTATION.md` | Needs canonical check |
| G-CR-X5 | PAUSED dead code | `docs/Bugs/BACKEND-KARMA.md` | Batch status |
| G-CR-X6 | Karma level unverified | `docs/Bugs/09-TYPE-FRAGMENTATION.md` | Needs canonical check |

---

## Pattern Analysis

### Most Referenced Existing Docs

| Doc | References | Pattern |
|-----|-----------|---------|
| `docs/Bugs/BACKEND-KARMA.md` | 24 | Recurring karma service issues |
| `docs/Bugs/CONSUMER-APP-GAMIFICATION.md` | 17 | Recurring gamification/consumer issues |
| `docs/Bugs/09-TYPE-FRAGMENTATION.md` | 4 | Type/enum divergence |
| `docs/Bugs/BACKEND-AUTH.md` | 4 | Auth patterns |
| `docs/Bugs/BACKEND-FINANCE.md` | 1 | Financial integrity |

### Key Insight
The karma gaps overlap heavily with existing `BACKEND-KARMA.md` and `CONSUMER-APP-GAMIFICATION.md` docs. This means many of these issues may have been partially identified before but not fully fixed or tracked to completion.
