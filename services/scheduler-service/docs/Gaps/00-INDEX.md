# ReZ Platform — Master Gap Registry

**Generated:** 2026-04-16
**Scope:** ALL codebases — ReZ consumer/merchant/admin apps + all backend services + Karma service + Rendez app
**Status:** Active — **2,726 issues** across 18 audit generations; **16 P0 fixes completed 2026-04-17** + **16 additional fixes completed 2026-04-17 session 2** (see UNIFIED-FIX-PLAN.md §Status Tracker + SESSION-ROUND2-REPORT.md)

---

## How to Read This Registry

1. **Pick your layer** — which codebase/service are you working on?
2. **Check severity** — CRITICAL bugs are marked `[CRITICAL]` and must be fixed before scaling
3. **Read the specific gap doc** for exact file:line references, code snippets, and fix suggestions
4. **Check cross-ref** — many bugs exist in multiple places with different IDs
5. **Mark as fixed** in the gap doc's status table when resolved
6. **Update burn-down** in `docs/BURN_DOWN_DASHBOARD.md`

---

## Master Count (All Audits)

| Generation | Codebase | CRITICAL | HIGH | MEDIUM | LOW | Total |
|-----------|----------|----------|------|--------|-----|-------|
| **Gen 1–7** | ReZ Consumer App | 26 | 103 | 375 | 55 | **559** |
| **Gen 1–7** | ReZ Merchant App | 14 | 49 | 258 | 29 | **350** |
| **Gen 1–7** | ReZ Admin App | 25 | 84 | 153 | 59 | **321** |
| **Gen 1–7** | ReZ Backend (all services) | 13 | 59 | 281 | 80 | **434** |
| **Gen 8** | Karma Service (backend) | 9 | 8 | 15 | 6 | **38** |
| **Gen 8** | Karma UI (consumer) | 3 | 7 | 7 | 3 | **20** |
| **Gen 9** | Rendez Backend | 4 | 10 | 12 | 9 | **35** |
| **Gen 9** | Rendez App (mobile) | 5 | 11 | 32 | 13 | **61** |
| **Gen 9** | Rendez Admin | 4 | 7 | 19 | 14 | **44** |
| **Gen 10** | AdBazaar (Next.js + Supabase) | 19 | 31 | 45 | 16 | **111** |
| **Gen 10** | **ReZ Merchant App (rezmerchant/)** | **16** | **44** | **75** | **149** | **284** |
| **Gen 11** | Consumer App (2026-04-16) | 12 | 28 | 30 | 24 | **118** |
| **Gen 10** | ReZ Admin App (rez-app-admin/) | 11 | 23 | 27 | 11 | **72** |
| **Gen 12** | ReZ NoW (Next.js consumer app) | 14 | 15 | 35 | 25 | **89** |
| **Gen 13** | FORENSIC-001 — Backend Forensic (all services) | 17 | 15 | 20 | 8 | **60** |
| **Gen 14** | RestoPapa / ReZ Full Audit (2026-04-16) | 17 | 29 | 30 | 17 | **93** |
| **Gen 15** | Backend Deep Sweep (Workers+BullMQ+Config+Routes+API+Schema) | 22 | 58 | 55 | 25 | **160** |
| **Gen 16** | Vesper App (React Native + Node.js server) | 3 | 5 | 8 | 5 | **21** |
| **Gen 17** | Backend Cross-Section Sweep (Enum+Socket+DB+Err+CORS+Date) | 10 | 23 | 18 | 0 | **51** |
| **Gen 18** | Merchant App + Consumer App + Cross-Service (2026-04-17) | 4 | 10 | 6 | 16 | **36** |
| **Gen 19** | Cross-Repo Type/Enum Consistency (2026-04-17) | 3 | 8 | 9 | 8 | **28** |
| | **TOTAL** | **243** | **611** | **1,448** | **452** | **2,754** |

> Note: ~20 bugs were reclassified as **MISJUDGMENT** (confirmed not real bugs). ~70 remain **DEFERRED** pending product decisions or infra.
> **+21 new bugs documented from deep screen/service audit 2026-04-16** (Rendez App: +12 MEDIUM +3 HIGH; Rendez Backend: +2 MEDIUM +3 HIGH +1 LOW)
> **+160 new bugs from Backend Deep Sweep (2026-04-16)** — Workers/BullMQ (+32), Config/FSM (+35), Routes (+38), API Contract (+19), Schema (+59)
> **+22 new bugs from deferred file deep audit (2026-04-16)** — Rendez Admin pages (+3 CRIT +4 MED +2 LOW), Rendez Backend (+2 MED +1 LOW), Rendez App authStore (+1 CRIT +2 MED)
> **+51 new bugs from Backend Cross-Section Sweep (2026-04-17)** — Enum drift (+9), Socket.IO (+9), DB naming (+10), Error format (+6), Date/timezone (+8), Middleware (+9)
> **+17 new bugs from Merchant App deep audit (2026-04-16)** — CRITICAL: +2 (C15 IDOR order detail, C16 coin redemption fire-and-forget); HIGH: +6 (H39-H44); MEDIUM: +4 (M73-M76); LOW: +5 (L102-L106)
> **+7 new bugs from Consumer App Gen 11 deep scan (2026-04-16)** — N-01 CRITICAL missing homepage.types.ts; N-02 HIGH BackendCoinBalance type mismatch; N-03 HIGH AddressType case mismatch; N-04 MEDIUM wasilCoins field drift; N-05 MEDIUM PaymentStatus terminal state; N-06 LOW validateBatchResponse dead code; N-07 LOW double /api prefix
> **+9 new cross-service bugs from Gen 18 audit (2026-04-16)** — XF-11: karma race (C01 CRIT), TOCTOU profile (H01 HIGH), triple CoinType (H02 HIGH), duplicate normalizeCoinType (H03 HIGH), finance auth fail-open (H04 HIGH), in-memory rate limit Maps (M01 MEDIUM), EarnRecordStatus local def (M02 MEDIUM), test secret (L01 LOW), Math.random jitter (L02 LOW)
> **+36 new bugs from gap ecosystem audit (2026-04-17)** — duplicate ID fixes in Merchant App (+43 new unique IDs), INDEX math corrections, type fragmentation report (7 definitions of CoinType across 6 packages), 6 new Gen 18 cross-service findings
> **+28 new bugs from cross-repo type/enum consistency scan (2026-04-17)** — CT-CRIT-01/02/03 (3 CRIT), CT-HIGH-01 through CT-HIGH-08 (8 HIGH), CT-MED-01 through CT-MED-09 (9 MED), CT-LOW-01 through CT-LOW-08 (8 LOW) — canonical type registry has 3-way conflicts on OrderStatus, PaymentStatus, TransactionStatus; governance Rule 4 violated in data/walletData.ts
> **Grand total: 2,754 issues across 19 audit generations**

---

## Folder Structure

```
docs/Gaps/
├── 00-INDEX.md                              ← You are here
│
├── 01-KARMA-SERVICE/                       ← rez-karma-service (Gen 8)
│   ├── 00-INDEX.md
│   ├── SECURITY.md                          ← 9 security gaps (6 CRIT, 3 HIGH)
│   ├── BUSINESS-LOGIC.md                   ← 8 business logic gaps
│   ├── FUNCTIONAL.md                       ← 4 functional gaps
│   ├── ARCHITECTURE.md                     ← 7 architecture gaps
│   └── ERROR-HANDLING.md                   ← 4 error handling gaps
│
├── 02-KARMA-UI/                           ← rez-app-consumer karma module (Gen 8)
│   ├── 00-INDEX.md
│   ├── CRITICAL.md                         ← 3 critical gaps
│   ├── HIGH.md                             ← 7 high-severity gaps
│   ├── MEDIUM.md                           ← 7 medium gaps
│   └── LOW.md                             ← 3 low gaps
│
├── 03-CROSS-REF/                          ← Cross-service type/enum alignment (Gen 8)
│   ├── 00-INDEX.md
│   ├── TYPE-DIVERGENCE.md
│   ├── ENUM-MISMATCH.md
│   └── CROSS-SERVICE-MATRIX.md
│
├── 04-RENDEZ-BACKEND/                     ← Rendez app backend (Gen 9, NEW)
│   ├── 00-INDEX.md
│   ├── CRITICAL.md
│   ├── HIGH.md
│   ├── MEDIUM.md
│   └── LOW.md
│
├── 05-RENDEZ-APP/                         ← Rendez mobile app (Gen 9, NEW)
│   ├── 00-INDEX.md
│   ├── CRITICAL.md
│   ├── HIGH.md
│   ├── MEDIUM.md
│   └── LOW.md
│
├── 06-MERCHANT-APP/                       ← rezmerchant (Gen 10, NEW — 2026-04-16)
│   ├── 00-INDEX.md
│   ├── CRITICAL.md                          ← 14 critical gaps
│   ├── HIGH.md                              ← 38 high-severity gaps
│   ├── MEDIUM.md                           ← 56 medium gaps
│   └── LOW.md                              ← 62 low gaps
│
├── 06-CONSUMER-AUDIT-2026/               ← Consumer app full audit (Gen 11, NEW — 2026-04-16)
│   ├── 00-INDEX.md
│   ├── 01-CRITICAL.md                      ← 11 critical issues (app-breaking)
│   ├── 02-HIGH.md                          ← 24 high-severity issues
│   ├── 03-MEDIUM.md                        ← 22 medium issues
│   ├── 04-LOW.md                           ← 12 low issues
│   ├── 05-CROSS-REPO-MISMATCHES.md        ← 16 enum/type mismatches across repos
│   ├── 06-SYSTEMIC-ROOTS.md               ← 6 architectural root diseases
│   ├── 07-QUICK-WINS.md                   ← 26 fixes under 1 hour
│   ├── 08-REMEDIATION-PLAN.md             ← 5-phase roadmap (~159h / 9 weeks)
│   └── 09-ADDITIONAL-FINDINGS.md          ← 52 expanded issues (3 CRIT, 9 HIGH, 17 MED, 17 LOW)
│
├── 06-ADBAZAAR/                           ← imrejaul007/adBazaar (Gen 10, NEW — 2026-04-16)
│   ├── 00-INDEX.md
│   ├── SECURITY.md                          ← 17 security gaps (5 CRIT, 5 HIGH, 4 MED, 3 LOW)
│   ├── BUSINESS-LOGIC.md                   ← 8 business logic gaps (2 CRIT, 3 HIGH, 2 MED, 1 LOW)
│   ├── PAYMENT.md                          ← 6 payment gaps (1 CRIT, 2 HIGH, 1 MED, 2 LOW)
│   ├── DATA-SYNC.md                        ← 4 data sync gaps (1 CRIT, 1 HIGH, 2 MED)
│   └── ARCHITECTURE.md                     ← 4 architecture gaps (2 MED, 2 LOW)
│
├── 07-RENDEZ-ADMIN/                       ← Rendez admin dashboard (Gen 9)
│   ├── 00-INDEX.md
│   ├── CRITICAL.md
│   ├── HIGH.md
│   ├── MEDIUM.md
│   └── LOW.md
│
├── 08-REZ-ADMIN/                         ← rez-app-admin (Gen 10 — 2026-04-16)
│   ├── 00-INDEX.md
│   ├── CRITICAL.md                         ← 11 critical gaps (+3 from deep audit)
│   ├── HIGH.md                              ← 23 high-severity gaps (+6 from deep audit)
│   ├── MEDIUM.md                           ← 27 medium gaps (+7 from deep audit)
│   ├── LOW.md                              ← 11 low gaps (+3 from deep audit)
│   └── ADDITIONAL.md                       ← 19 additional issues from deep audit
│
├── 08-MASTER-PLAN/                        ← Unified fix priority + cross-repo mapping
│   ├── 00-INDEX.md                        ← Master plan (144 CRIT, 367 HIGH, ~480h)
│   ├── PHASE1-CRITICAL.md                 ← All CRITICAL gaps, all codebases
│   ├── PHASE2-HIGH.md                     ← All HIGH gaps, all codebases
│   ├── PHASE3-4-MEDIUM-LOW.md             ← MEDIUM + LOW issues + sprint plan
│   ├── XF-UNIFIED.md                      ← Cross-repo unified fixes (6 families)
│   └── CROSS-REPO-ISSUES.md               ← One-fix-resolves-many patterns
│
├── 09-CROSS-SERVICE-2026/                ← Gen 8-11 cross-service gaps (2026-04-16)
│   ├── 00-INDEX.md
│   ├── CROSS-REPO-ANALYSIS.md            ← All repos vs all repos matrix
│   ├── MONEY-ATOMICITY.md                 ← Payment/wallet/ledger double-credit risks
│   ├── ENUM-FRAGMENTATION.md              ← Status string mismatches across all codebases
│   ├── TYPE-DRIFT.md                       ← Local types vs shared-types package
│   ├── API-CONTRACT-MISMATCHES.md         ← Frontend expects vs backend returns
│   ├── SECURITY-ROOT-CAUSE.md             ← 12 security root cause patterns
│   ├── XF-1-FIRE-AND-FORGET.md          ← Fire-and-forget coin credit DLQ
│   ├── XF-2-USER-SPOOFING.md            ← rez_user_id spoofing + HMAC fix
│   ├── XF-3-ATTRIBUTION-DUAL.md          ← Dual attribution systems fix
│   ├── XF-4-WALLET-EARNINGS-MISMATCH.md ← Vendor ledger architecture
│   ├── XF-5-NOTIFICATION-GAP.md          ← BullMQ vs fire-and-forget
│   ├── XF-6-SCHEMA-API-MISMATCH.md      ← Column name mismatches
│   ├── XF-7-REV-NOW-DISCONNECTED.md    ← rez-now defines all types locally
│   ├── XF-8-PAYMENT-TERMINAL-STATE.md   ← 'completed' vs 'paid' mismatch
│   ├── XF-9-KARMA-COINTYPE-SPLIT.md    ← karma credits 'rez' but queries 'karma_points'
│   ├── XF-10-CLIENT-CONTROLS-SECURITY.md ← Client-side bill amount + fingerprint
│   ├── XF-11-GEN18-AUDIT.md            ← 9 new cross-service bugs (1 CRIT, 4 HIGH, 2 MED, 2 LOW)
│   ├── TYPE-DRIFT-MATRIX.md             ← Full type/enum matrix
│   ├── CROSS-REP-TYPE-CONSISTENCY.md  ← 28 new cross-repo type/enum issues (2026-04-17)
│   └── CROSS-SERVICE-CALL-MAP.md        ← Inter-service call dependencies
│
├── 10-REZ-NOW/                         ← ReZ NoW (Next.js consumer app — Gen 12)
│   ├── 00-INDEX.md                        ← 89 issues (14 CRIT, 15 HIGH, 35 MED, 25 LOW)
│   ├── 01-CRITICAL.md                     ← 14 critical issues
│   ├── 02-HIGH.md                         ← 15 high-severity issues
│   ├── 03-MEDIUM.md                       ← 35 medium issues
│   ├── 04-LOW.md                          ← 25 low issues
│   ├── 05-CROSS-REPO-MISMATCHES.md       ← 10+ cross-repo type/enum mismatches
│   ├── 06-SYSTEMIC-ROOTS.md               ← 6 root cause diseases
│   ├── 07-REMEDIATION-PLAN.md            ← Phase-by-phase fix roadmap
│   └── 08-CROSS-SERVICE-GAPS.md          ← Cross-service integration gaps
│
├── 11-VESPER-APP/                      ← Vesper dating app (React Native + Node.js — Gen 16)
│   ├── 00-INDEX.md                        ← 21 issues (3 CRIT, 5 HIGH, 8 MED, 5 LOW)
│   ├── 01-CRITICAL.md                     ← 3 critical issues
│   ├── 02-HIGH.md                         ← 5 high-severity issues
│   ├── 03-MEDIUM.md                       ← 8 medium issues
│   └── 04-LOW.md                          ← 5 low issues
│
├── 10-CONSOLIDATED/                      ← Unified master bug list — all audits
│   ├── 00-INDEX.md                        ← 2,689 issues consolidated
│   ├── CRITICAL-MASTER.md                  ← All CRITICAL bugs across all repos
│   ├── HIGH-MASTER.md                      ← All HIGH bugs across all repos
│   ├── CROSS-SERVICE-MASTER.md             ← Cross-repo issues (XF-1 through XF-6)
│   ├── DUPLICATE-MASTER.md                ← Same bug under different IDs
│   └── SOLUTION-PLAN-MASTER.md            ← Unified fix priority across all codebases
│
├── 10-RESTOPAPA-AUDIT-2026/              ← RestoPapa / ReZ full audit — Gen 14 (2026-04-16)
│   ├── 00-INDEX.md                        ← 93 issues (17 CRIT, 29 HIGH, 30 MED, 17 LOW)
│   ├── 01-CRITICAL.md                     ← 17 critical issues
│   ├── 02-HIGH.md                         ← 29 high-severity issues
│   ├── 03-MEDIUM.md                       ← 30 medium issues
│   ├── 04-LOW.md                          ← 17 low issues
│   ├── 05-CROSS-REPO-MISMATCHES.md        ← 17 cross-repo mismatches
│   ├── 06-SYSTEMIC-ROOTS.md               ← 5 root cause diseases
│   ├── 07-QUICK-WINS.md                  ← 12 fixes under 30 min
│   └── 08-REMEDIATION-PLAN.md            ← ~95h / 5 phases / 6 weeks
│
└── Root-level audit files (Gen 13-17)   ← FORENSIC-001 + Backend Deep Sweep + Cross-Section Sweep
    │
    ├── FORENSIC-001 (Gen 13) — 60 issues (17 CRIT, 15 HIGH, 20 MED, 8 LOW)
    │   ├── CRITICAL-001-settlement-blind-spot.md
    │   ├── CRITICAL-002-catalog-auth-broken.md
    │   ├── CRITICAL-003-merchant-withdrawal-race-condition.md
    │   ├── CRITICAL-004-karma-auth-404.md
    │   ├── CRITICAL-005-karma-2x-inflation.md
    │   ├── CRITICAL-006-admin-cron-consumer-auth.md
    │   ├── CRITICAL-007-fraudflag-missing.md
    │   ├── CRITICAL-008-dual-authority.md
    │   ├── CRITICAL-009-three-payment-fsms.md
    │   ├── CRITICAL-010-coin-rate-divergence.md
    │   ├── CRITICAL-011-internal-service-key-unvalidated.md
    │   ├── CRITICAL-012-firebase-json-on-disk.md
    │   ├── CRITICAL-013-order-statuses-out-of-sync.md
    │   ├── CRITICAL-014-static-files-unauthenticated.md
    │   ├── CRITICAL-015-silent-coin-failure.md
    │   ├── CRITICAL-016-returned-progress-mismatch.md
    │   ├── CRITICAL-017-karma-wont-compile.md
    │   ├── HIGH-001-payment-webhook-secret-in-body.md
    │   ├── HIGH-002-payment-non-atomic-wallet-credit.md
    │   ├── HIGH-003-payment-auth-incompatible-legacy.md
    │   ├── HIGH-004-order-invalid-nested-object.md
    │   ├── HIGH-005-bulk-order-actions-bypass-fsm.md
    │   ├── HIGH-006-bnpl-eligibility-or-instead-of-and.md
    │   ├── HIGH-007-search-rate-limiter-fails-open.md
    │   ├── HIGH-008-order-service-unused-schemas.md
    │   ├── HIGH-009-order-service-sse-no-auth.md
    │   ├── HIGH-010-coin-type-normalization-lost.md
    │   ├── HIGH-011-loyalty-tier-typo-diamond.md
    │   ├── HIGH-012-payment-hardcoded-coin-cap.md
    │   ├── HIGH-013-authorized-state-no-inbound-path.md
    │   ├── HIGH-014-search-paths-not-routed-gateway.md
    │   ├── HIGH-015-schema-mixed-types-40-models.md
    │   ├── MEDIUM-001-020-summary.md
    │   ├── LOW-001-008-summary.md
    │   ├── CROSS-REFERENCE-ALL-AUDITS.md
    │   ├── SOLUTION-PLAN.md
    │   ├── HEALTH-SCORE-BREAKDOWN.md
    │   ├── ARCHITECTURE-MAP.md
    │   ├── ROOT-CAUSE-ANALYSIS.md
    │   ├── PHASE-COVERAGE.md
    │   └── SERVICE-INVENTORY.md
    │
    └── Backend Deep Sweep (Gen 15) — 160 issues (22 CRIT, 58 HIGH, 55 MED, 25 LOW)
        ├── CRON-001-distributed-lock.md
        ├── CRON-002-async-oncomplete.md
        ├── CRON-003-batchscheduler-silent.md
        ├── CRON-004-autocheckout-not-idempotent.md
        ├── CRON-005-autocheckout-oom.md
        ├── CRON-006-gamification-replay.md
        ├── CRON-007-autocheckout-no-retry.md
        ├── CRON-008-offerrefresh-oom.md
        ├── CRON-009-shutdown-missing.md
        ├── CRON-010-seeding-silent.md
        ├── BULL-001-removeoncomplete.md
        ├── BULL-002-coinexpiry-flood.md
        ├── BULL-003-scheduler-throughput.md
        ├── BULL-004-stalled-doubleprocess.md
        ├── BULL-005-homegrown-dlq.md
        ├── BULL-006-stale-delayed-jobs.md
        ├── BULL-007-dlq-archive-dedup.md
        ├── CFG-FSM-001-duplicate-payment-fsm.md
        ├── CFG-FSM-002-diamond-typo.md
        ├── CFG-FSM-003-graphql-status-drops.md
        ├── CFG-FSM-004-cashback-math.md
        ├── CFG-FSM-005-high.md
        ├── CFG-FSM-006-medium.md
        ├── API-MISMATCH-001-019.md
        ├── ROUTE-SEC-001-038.md
        ├── DEEP-CODE-001-015.md
        └── SCHEMA-001-059.md

    └── Backend Cross-Section Sweep (Gen 17) — 51 issues (10 CRIT, 23 HIGH, 18 MED)
        ├── ENUM-DRIFT-001.md                   ← 9 enum inconsistencies (2 CRIT, 3 HIGH, 4 MED)
        ├── SOCKET-IO-001.md                   ← 9 Socket.IO mismatches (2 CRIT, 4 HIGH, 3 MED)
        ├── DB-NAMING-001.md                   ← 10 DB naming issues (3 CRIT, 3 HIGH, 4 MED)
        ├── ERR-FORMAT-001.md                   ← 6 error format issues (0 CRIT, 3 HIGH, 3 MED)
        ├── DATE-TZ-001.md                     ← 8 date/timezone issues (2 CRIT, 3 HIGH, 3 MED)
        ├── MIDDLEWARE-001.md                   ← 9 middleware issues (0 CRIT, 5 HIGH, 4 MED)
        └── ENV-DRIFT-001-023.md               ← 23 env var drift issues (2 CRIT, 6 HIGH, 8 MED, 7 LOW)
```

---

## Gen 14 CRITICAL Issues (15) — RestoPapa Audit

| ID | Title | File |
|----|-------|------|
| RP-C01 | Karma routes return 501 — never mounted | `routes/index.ts` |
| RP-C02 | CrossAppSyncService webhook is dead code | `CrossAppSyncService.ts` |
| RP-C03 | syncOrders/syncCashback are no-ops | `SyncService.ts` |
| RP-C04 | Double karma credit | `earnRecordService.ts` + `karmaService.ts` |
| RP-C05 | Batch pool decrement before save — no transaction | `batchService.ts` |
| RP-C06 | Referral credit fire-and-forget, no retry | `ReferralService.ts` |
| RP-C07 | Referral credit race condition | `ReferralService.ts` |
| RP-C08 | Admin auth bypass — requireAdmin undefined | `batchRoutes.ts:220` |
| RP-C09 | Wallet service calls have no authentication | `walletIntegration.ts` |
| RP-C10 | JWT secret fallback in test files | `setup.ts:11` |
| RP-C11 | 3 incompatible CoinTransaction schemas | 3 model files |
| RP-C12 | cashback/referral coins invisible in wallet/ledger | Wallet + Ledger models |
| RP-C13 | IEarnRecord.verificationSignals mismatch | `karma.ts` vs `EarnRecord.ts` |
| RP-C14 | Frontend missing voucherCode fields | `ordersApi.ts` vs `orderCreateController.ts` |
| RP-C15 | Admin missing store.merchantId | `orders.ts` vs `orderController.ts` |
| RP-C16 | Cart optimistic update no rollback — ghost items | `CartContext.tsx` |
| RP-C17 | Consumer offline queue silently drops on QuotaExceededError | `offlineQueueStore.ts` |

---

## Quick Navigation — CRITICAL Issues Only

### FORENSIC-001 — Backend Forensic Audit (Gen 13, NEW — Fix First)

| ID | Title | File | Category |
|----|-------|------|----------|
| F001-C1 | Settlement blind spot (merchant vs merchantId) | `merchant-service/settlementService.ts` | Revenue |
| F001-C2 | Catalog service auth broken (runtime HMAC key) | `catalog-service/internalAuth.ts` | Security |
| F001-C3 | Merchant withdrawal TOCTOU race condition | `wallet-service/merchantWalletService.ts` | Financial |
| F001-C4 | Karma auth route 404 (wrong endpoint) | `karma-service/auth.ts` | Security |
| F001-C5 | Karma 2x inflation (double increment) | `karma-service/earnRecordService.ts` | Data |
| F001-C6 | Admin cron uses consumer JWT auth | `backend/routes/admin.ts` | Security |
| F001-C7 | FraudFlag model missing (silent drop) | `backend/` | Security |
| F001-C8 | Dual authority (root cause — 2+ writers) | ALL | Architecture |
| F001-C9 | Three payment FSMs (root cause) | `backend/` + `payment/` + `shared/` | FSM |
| F001-C10 | Coin rate divergence (hardcoded 1:1 vs env) | `payment-service/` | Financial |
| F001-C11 | Internal service key unvalidated | `ALL services/` | Security |
| F001-C12 | Firebase JSON on disk | `backend/` | Security |
| F001-C13 | Order statuses out of sync (14 vs 11) | `backend/` + `shared/` | FSM |
| F001-C14 | Static files served without auth | `media-events/http.ts` | Security |
| F001-C15 | Finance service silent coin failure | `finance-service/` | Reliability |
| F001-C16 | Returned progress mismatch (0% vs 100%) | `backend/` + `shared/` | Data |
| F001-C17 | Karma service won't compile | `karma-service/karmaService.ts` | Build |

### ReZ NoW (Gen 12, NEW — Fix First)

| ID | Title | File |
|----|-------|------|
| NW-CRIT-001 | Idempotency key uses Date.now() — double coin credit on retry | `lib/api/client.ts:73` |
| NW-CRIT-002 | Payment verification hardcoded to { verified: true } | `lib/api/payment.ts:39` |
| NW-CRIT-003 | Merchant panel has zero auth — /merchant/* routes unprotected | `middleware.ts:14` |
| NW-CRIT-004 | Socket.IO connects per MenuItem — N items = N connections | `components/menu/MenuItem.tsx:36` |
| NW-CRIT-005 | Waiter call endpoints have no authorization | `lib/api/waiter.ts:22` |
| NW-CRIT-006 | 10s payment timeout shows fake success UI | `lib/hooks/usePaymentConfirmation.ts:68` |
| NW-CRIT-007 | Offline queue silently discards orders after MAX_RETRIES | `lib/utils/offlineQueue.ts:123` |
| NW-CRIT-008 | Pay-display confirm/reject API paths structurally wrong | `PayDisplayClient.tsx:54` |
| NW-CRIT-009 | Reorder creates price:0 items — merchant loses revenue | `OrderHistoryClient.tsx:271` |
| NW-CRIT-010 | ScanPayOrderResponse.paymentId doesn't exist in backend response | `lib/types/index.ts:286` |
| NW-CRIT-011 | Coupon enumeration possible — unauthenticated coupon list | `lib/api/coupons.ts:12` |
| NW-CRIT-012 | UPI socket subscribes to razorpayOrderId instead of paymentId | `PaymentOptions.tsx:95` |
| NW-CRIT-013 | NFC creates Razorpay order with zero user confirmation | `pay/checkout/page.tsx:182` |
| NW-CRIT-014 | Tokens stored in plain localStorage — XSS exposure | `lib/api/client.ts:37` |

### AdBazaar (Gen 10, NEW — Fix First)

| ID | Title | File |
|----|-------|------|
| AB-C1 | `rez_user_id` spoofable via URL query param — coin fraud | `qr/scan/[slug]/route.ts:72` |
| AB-C2 | No rate limiting on public endpoints | Multiple APIs |
| AB-C3 | Full bank account numbers + IFSC exposed in profile API | `profile/route.ts:26` |
| AB-C4 | No idempotency key on booking creation | `bookings/route.ts:102` |
| AB-C5 | Payment amount never verified server-side | `verify-payment/route.ts:76` |
| AB-B1 | Visit bonus coins promised in UI but never credited | `qr/scan/[slug]/route.ts` |
| AB-B2 | `purchase_bonus_pct` hardcoded to 5 — advertiser config ignored | `bookings/route.ts:139` |
| AB-P1 | Messages table `body` vs API `content` — every message fails | `messages/route.ts:90` |
| AB-D1 | No real-time sync — notifications fire-and-forget | All notification insertion points |

### AdBazaar Round 2 (2026-04-17 — 6 New CRITICAL)

| ID | Title | File |
|----|-------|------|
| AB2-C1 | QR cooldown bypassable via `X-Forwarded-For` spoofing | `qr/scan/[slug]/route.ts:53` |
| AB2-C2 | Commission applied twice on quote-based bookings | `inquiries/[id]/accept/route.ts:49` |
| AB2-C3 | `createServerClient` falls back to anon key (RLS disabled) | `lib/supabase.ts:4` |
| AB2-C4 | Razorpay webhook never verifies `payment.captured === true` | `webhooks/razorpay/route.ts:223` |
| AB2-C5 | Payout silently falls back to simulated mode in production | `vendor/payout/route.ts:131` |
| AB2-C6 | Marketing broadcast errors silently discarded | `bookings/route.ts:174` |

### AdBazaar Round 3 (2026-04-17 — 4 New CRITICAL)

| ID | Title | File |
|----|-------|------|
| AB3-C1 | Campaign IDOR — buyer can remove other buyers' bookings | `campaigns/[id]/route.ts:60` |
| AB3-C2 | Vendor listing POST has no role verification | `vendor/listings/route.ts:60` |
| AB3-C3 | Campaign booking updates not awaited — orphan state | `campaigns/route.ts:108` |
| AB3-C4 | `verifyPaymentSignature` throws on length mismatch — silent false | `lib/razorpay.ts:34` |

### Vesper App (Gen 16, NEW — Fix First)

| ID | Title | File |
|----|-------|------|
| VS-C1 | `jwt.verify()` without `algorithms` — algorithm confusion attack | `server/src/utils/jwt.ts:48,59,78` |
| VS-C2 | OrderStatus enum incompatible with REZ canonical | `server/src/types/index.ts:12` |
| VS-C3 | PaymentStatus enum incompatible with REZ canonical | `server/src/types/index.ts:17` |

### ReZ Admin App (Gen 10, NEW — Fix First)

| ID | Title | File |
|----|-------|------|
| A10-C1 | Socket events don't invalidate React Query cache | `services/socket.ts:148` |
| A10-C2 | Three competing VoucherBrand type definitions | `vouchers.ts` vs `cashStore.ts` |
| A10-C3 | Same endpoint, opposite query param names | `extraRewards.ts` vs `cashStore.ts` |
| A10-C4 | In-memory PaymentMachine no cross-request protection | `paymentRoutes.ts:17-41, 369-381` |
| A10-C5 | HMAC key from env var NAME not value | `internalAuth.ts:40-46` |
| A10-C6 | SSE order stream no merchant ownership check | `httpServer.ts:473-533` |
| A10-C7 | Three conflicting color systems | `DesignTokens.ts`, `Colors.ts`, `ThemeContext.tsx` |
| A10-C8 | Order refund modal shows Rs. 0 and `#undefined` | `orders.tsx:971-979` |

### Rendez App (Gen 9, NEW — Fix First)

| ID | Codebase | Title | File |
|----|----------|-------|------|
| RZ-B-C1 | Backend | Gift voucher endpoint leaks QR codes via ID enumeration | `gift.ts:80` |
| RZ-B-C2 | Backend | Payment webhook race condition — double reward issuance | `webhooks/rez.ts:49` |
| RZ-B-C3 | Backend | Query params cast to `any` bypasses enum validation | `wallet.ts:32` |
| RZ-B-C4 | Backend | Socket `read_receipt` bypasses `matchId` ownership check | `socketServer.ts:155` |
| RZ-A-C1 | Admin | ALL API calls missing `Authorization: Bearer` header | 9 pages |
| RZ-A-C2 | Admin | No Next.js middleware — all routes publicly accessible | No `middleware.ts` |
| RZ-A-C3 | Admin | API URL mismatch across dashboard vs other pages | `dashboard/page.tsx:109` |
| RZ-A-C4 | Admin | System health status is hardcoded fake data | `dashboard/page.tsx:220` |
| RZ-M-F1 | App | Gift inbox query key invalidation wrong — inbox never refreshes | `GiftInboxScreen.tsx:48` |
| RZ-M-F3 | App | Like mutation uses stale closure over `feed` array | `DiscoverScreen.tsx:302` |
| RZ-M-F4 | App | Photo removal is local-only — never synced to backend | `ProfileEditScreen.tsx:129` |
| RZ-M-S1 | App | Referral code from deep link stored but never consumed | `useDeepLink.ts:130` |
| RZ-M-E1 | App | `profile.name[0]` crashes on empty profile | `ProfileDetailScreen.tsx:191` |

### Karma Service (Gen 8)

| ID | Title | File |
|----|-------|------|
| G-KS-C1 | Hardcoded default QR secret — forgeable QR codes | `verificationEngine.ts:176` |
| G-KS-C2 | Auth middleware trusts response with zero validation | `auth.ts:41` |
| G-KS-C3 | jwtSecret unvalidated at startup | `config/index.ts:22` |
| G-KS-C4 | Horizontal privilege escalation on profile routes | `karmaRoutes.ts:29` |
| G-KS-C5 | Batch stats endpoint unauthenticated | `batchRoutes.ts:220` |
| G-KS-C6 | TimingSafeEqual throws on length mismatch | `verificationEngine.ts:183` |
| G-KS-C7 | Idempotency key collision — duplicate EarnRecords | `earnRecordService.ts:204` |

### Karma UI (Gen 8)

| ID | Title | File |
|----|-------|------|
| G-KU-C1 | `event.totalHours` not in type — runtime crash | `event/[id].tsx:350` |
| G-KU-C2 | Fragile check-in logic — status string vs boolean | `event/[id].tsx:176` |
| G-KU-C3 | KarmaEvent type completely divergent from canonical | `karmaService.ts:43` |

### ReZ Gen 1–7 (Backend, Consumer, Merchant, Admin)

See [docs/Bugs/00-INDEX.md](../Bugs/00-INDEX.md) for full listing of all CRITICAL bugs from Audits 1–7.

---

## Gen 15 CRITICAL Issues (22) — Backend Deep Sweep

### Workers / BullMQ (CRON/BULL)

| ID | Title | File |
|----|-------|------|
| CRON-001 | All node-cron jobs fire on every pod — no distributed lock | `decayWorker.ts`, `batchScheduler.ts`, `autoCheckoutWorker.ts`, `streakAtRiskWorker.ts` |
| CRON-002 | node-cron `onComplete` cannot be async — async errors crash process | `decayWorker.ts:30` |
| CRON-003 | batchScheduler catches all errors and never rethrows | `batchScheduler.ts:48-53` |
| CRON-004 | autoCheckoutWorker not idempotent — duplicate notifications | `autoCheckoutWorker.ts:160-195` |
| CRON-005 | autoCheckoutWorker loads ALL bookings into memory — OOM risk | `autoCheckoutWorker.ts:73-77` |
| BULL-001 | `removeOnComplete: true` means "don't remove" — Redis memory leak | `QueueService.ts:275,297` |
| BULL-002 | coinExpiry unbounded loop — Redis flood with 100K+ jobs | `coinExpiry.ts:76-125` |

### Config / FSM / Enum (CFG)

| ID | Title | File |
|----|-------|------|
| CFG-001 | Payment FSM defined twice — 6 divergences between Payment.ts and financialStateMachine.ts | `Payment.ts:53-65` vs `financialStateMachine.ts:25-36` |
| CFG-002 | DIAMOND tier mapped to 'platinum' in coins.ts, 'diamond' in enums.ts | `coins.ts:123-131` vs `enums.ts:23-31` |
| CFG-003 | GraphQL status map drops `out_for_delivery`/`returned`/`refunded`; hardcoded 15%/85% fees | `graphqlSetup.ts:295-307` |
| CFG-004 | Cashback validation multiplies rate by 100 when rate is already a percentage | `rewardConfig.ts:247` |

### API Contract / Routes / Deep Code

| ID | Title | File |
|----|-------|------|
| API-001 | Wallet payment: consumer sends `{orderId,storeId}` but backend expects `{coinType,source}` | `walletApi.ts` vs `walletRoutes.ts` |
| API-002 | Razorpay verify endpoint is internal-only but called by frontend | `paymentService.ts` vs `paymentRoutes.ts` |
| API-003 | Karma level/history endpoints have wrong paths on consumer app | `karmaService.ts` vs `karmaRoutes.ts` |
| API-004 | Payment initiation calls non-existent `/wallet/initiate-payment` endpoint | `paymentService.ts:171` |
| API-005 | Payment status polls wrong path `/wallet/payment-status/${id}` | `paymentService.ts:194` |
| ROUTE-001 | Internal wallet debit has no IP allowlisting | `walletRoutes.ts:529` |
| ROUTE-002 | Merchant JWT falls back to consumer secret — tokens forged | `auth.ts:75,186,257,593` |
| ROUTE-003 | Reverse cashback audit log not in MongoDB transaction | `userWallets.ts:427` |
| ROUTE-004 | Menu-sync webhook has zero authentication | `aggregatorWebhookRoutes.ts:253` |
| ROUTE-005 | Cloudinary delete has no publicId ownership check | `uploads.ts:174` |
| DEEP-001 | `applyForLoan()` uses user-supplied userId without ObjectId validation | `loanService.ts:9-27` |
| DEEP-002 | Service reports ready before MongoDB is connected | `index.ts:34-37` |

### Gen 17 CRITICAL Issues (10) — Backend Cross-Section Sweep

### Enum / Schema

| ID | Title | File |
|----|-------|------|
| ENUM-001 | ORDER_STATUS backend has 14, payment service has 11; `partially_refunded` is a dead state | `shared-types/` vs `payment-service/` |
| ENUM-002 | USER_TIERS missing `diamond` tier; gamification service has DIAMOND | `shared-types/` vs `gamification/` |
| DB-NAME-001 | 6 shared collections have dual-writer risk — orders, stores, merchants, wallets, payments, notifications | Multiple services |
| DB-NAME-002 | `Categorys` broken Mongoose plural — collection named `categorys`, queries fail | `catalog-service/` |
| DB-NAME-003 | `Activitys` broken Mongoose plural — collection named `activitys` | `catalog-service/` |

### Socket / Date

| ID | Title | File |
|----|-------|------|
| SOCKET-001 | Backend emits `messaging:new_message`, consumer listens for `message:received` — messages silently dropped | `backend/` vs `consumer-app/` |
| SOCKET-002 | `@/types/socket.types` file does not exist — TypeScript build blocker, all socket types are `any` | `socketService.ts` |
| DATE-001 | `Math.random()` for correlation/request IDs — cryptographically insecure, predictable | Multiple services |
| DATE-002 | `toLocaleDateString()` without timezone — dates display wrong by ±N days depending on server TZ | Multiple services |

### Env / Auth

| ID | Title | File |
|----|-------|------|
| ENV-001 | `QR_SECRET` hardcoded fallback `'karma-qr-secret'` — forgeable check-in/check-out QR codes | `merchant/qrGenerator.ts:12` |
| ENV-002 | `JWT_SECRET` placeholder checks allow `'your-fallback-secret'` — service starts insecure | `validateEnv.ts:100-118` |



All prior audit findings are in `docs/Bugs/`:

| File | Description | Bug Count |
|------|-------------|-----------|
| [docs/Bugs/00-INDEX.md](../Bugs/00-INDEX.md) | Master index — all bugs by audit | ~1,664 |
| [docs/Bugs/UNIFIED-REMEDIATION-PLAN.md](../Bugs/UNIFIED-REMEDIATION-PLAN.md) | 6-phase unified fix plan | — |
| [docs/Bugs/BACKEND-BUGS.md](../Bugs/BACKEND-BUGS.md) | All backend service bugs | 434 |
| [docs/Bugs/CONSUMER-APP-BUGS.md](../Bugs/CONSUMER-APP-BUGS.md) | Consumer app bugs | 559 |
| [docs/Bugs/MERCHANT-APP-BUGS.md](../Bugs/MERCHANT-APP-BUGS.md) | Merchant app bugs | 350 |
| [docs/Bugs/ADMIN-APP-BUGS.md](../Bugs/ADMIN-APP-BUGS.md) | Admin app bugs | 321 |
| [docs/Bugs/CONSUMER-APP-REMEDIATION-PLAN.md](../Bugs/CONSUMER-APP-REMEDIATION-PLAN.md) | Consumer fix plan | — |

---

## Root Causes (Gen 1–14 Common Patterns)

Gen 14 identified **5 new root diseases** (RP-SYS-1 through RP-SYS-5) that compound existing root causes. **Fixing them resolves ~75% of Gen 14 issues.** Full analysis: [`10-RESTOPAPA-AUDIT-2026/06-SYSTEMIC-ROOTS.md`](./10-RESTOPAPA-AUDIT-2026/06-SYSTEMIC-ROOTS.md)

| # | Root Cause | Gen |
|---|-----------|-----|
| RC-1 | No single source of truth — enums/models/rules independently in 3-5 places | Gen 1–14 |
| RC-3 | Fire-and-forget for financial ops — no retry/DLQ/compensation | Gen 1–14 |
| RP-SYS-1 | No shared schema contracts — 3 incompatible definitions per concept | Gen 14 |
| RP-SYS-2 | Routes written but never wired — dead code masquerading as working | Gen 14 |
| RP-SYS-3 | Service-to-service auth nonexistent — trust by network position | Gen 14 |
| RP-SYS-4 | Fire-and-forget financial ops — no transaction, no idempotency | Gen 14 |
| RP-SYS-5 | Frontend/backend evolved separately — no contract-first development | Gen 14 |

These patterns appear across ALL audit generations and are the source of most bugs:

| # | Root Cause | Appears In |
|---|-----------|-----------|
| RC-1 | No single source of truth — data models, enums, business rules defined independently in 3–5 places | Gen 1–11 |
| RC-2 | Frontend computes what backend should own — cashback, coins, validation all client-side | Gen 1–11 |
| RC-3 | Fire-and-forget for financial operations — no retry, no DLQ, no compensating transaction | Gen 1–11 |
| RC-4 | Non-atomic multi-step operations — slot booking, table reservation, payout all split | Gen 1–7 |
| RC-5 | No TypeScript contract at frontend-backend boundary — `get<any>()` everywhere | Gen 1–11 |
| RC-6 | Incomplete features shipped as live — dead handlers, hardcoded multipliers, "Coming Soon" CTAs | Gen 1–7 |
| RC-7 | Query key mismatch in TanStack Query — cache never invalidates correctly | Gen 9–11 |
| RC-8 | Admin dashboard missing auth headers on every API call — completely non-functional | Gen 9 (Rendez) |
| RC-9 | Referral system broken end-to-end — deep link codes stored but never consumed | Gen 9 (Rendez) |
| RC-10 | Redis as only source of truth for critical state — no DB backup | Gen 8–10 |
| RC-11 | Fire-and-forget for async operations — silently swallowing errors | Gen 10 (AdBazaar) |
| RC-12 | No WebSocket/SSE/Supabase Realtime — all updates via page-load polling | Gen 10 (AdBazaar) |
| RC-13 | No wallet/ledger table — earnings always derived, refunds don't adjust | Gen 10 (AdBazaar) |
| RC-14 | Supabase schema vs API route mismatch — column name differences | Gen 10 (AdBazaar) |
| RC-15 | Duplicate service files with identical implementations — copy-paste without shared abstraction | Gen 10 (Admin, 82 files) |
| RC-16 | In-memory state machines for financial operations — no persistence, no idempotency, no concurrency safety | Gen 10–11 |
| RC-17 | Hardcoded response shapes — frontend assumes backend returns exact structure without validation | Gen 10–11 |
| RC-18 | Three competing normalizeOrderStatus implementations — each surface defines its own | Gen 1–11 |
| RC-19 | Real-time updates bypass server-state — socket events fire without invalidating React Query cache | Gen 10–11 |
| RC-20 | Type drift between local and canonical types — no build-time contract enforcement | Gen 8–11 |
| RC-21 | No shared Socket.IO connection per store — every component creates its own connection | Gen 12 (ReZ NoW) |
| RC-22 | Merchant routes not in PROTECTED_PATHS — entire merchant panel publicly accessible | Gen 12 (ReZ NoW) |
| RC-23 | NFC/waiter real-world entry points have no confirmation step | Gen 12 (ReZ NoW) |
| RC-24 | Copy-based extraction (not move-based) — monolith retained logic while services got copies | Gen 13 (FORENSIC-001) |
| RC-25 | No monorepo — services in separate repos, FSMs/enums independently forked | Gen 13 (FORENSIC-001) |
| RC-26 | Shared MongoDB cluster — no database-level isolation enabling dual writes | Gen 13 (FORENSIC-001) |
| RC-27 | No shared schema registry — Schema.Types.Mixed in 40+ models | Gen 13 (FORENSIC-001) |
| RC-28 | No cutover mechanism — shadow mode runs indefinitely with no migration path | Gen 13 (FORENSIC-001) |
| RC-29 | Three competing FSM definitions — backend, payment service, shared package all diverge | Gen 13 (FORENSIC-001) |
| RC-30 | node-cron in multi-instance deployments — no distributed lock, every pod fires every job | Gen 15 (Deep Sweep) |
| RC-31 | BullMQ used incorrectly — `removeOnComplete: true` means unbounded growth, no lockDuration causes double-processing | Gen 15 (Deep Sweep) |
| RC-32 | Homegrown DLQ instead of BullMQ queues — entries lost, no replay, max 1000 cap | Gen 15 (Deep Sweep) |
| RC-33 | Frontend/backend evolved independently — no contract-first API design, every endpoint has envelope/type mismatches | Gen 15 (Deep Sweep) |
| RC-34 | Routes written but never validated against actual service implementations — dead handlers everywhere | Gen 15 (Deep Sweep) |
| RC-35 | Schema model copy-pasted across 9 services — 40+ Mixed types, inconsistent indexes, wrong refs | Gen 15 (Deep Sweep) |
| RC-36 | No Redis/BullMQ connection pooling strategy — single connection shared across all workers | Gen 15 (Deep Sweep) |
| RC-37 | Socket.IO event names evolved independently — emitter and consumer use different event names, messages silently dropped | Gen 17 (Cross-Section) |
| RC-38 | Env var names drift across services — each service defines its own name for the same setting (WALLET_SERVICE_URL, CORS_ORIGIN, FRONTEND_URL) | Gen 17 (Cross-Section) |
| RC-39 | MongoDB collection models copy-pasted into each service — no shared model registry, dual-writers cause data loss | Gen 17 (Cross-Section) |
| RC-40 | No error format standard — each service uses different envelope shape (`success`, `data`, `message`, `error` mixed arbitrarily) | Gen 17 (Cross-Section) |

---

## Deferred Items (Low Confidence — Not Directly Audited)

All previously deferred files have been audited. See confirmed tables below.

### CONFIRMED (deep screen/service audit 2026-04-16)

| File | Issues Found |
|------|-------------|
| `ApplicantsScreen.tsx` | RZ-M-A6 (scroll disabled), RZ-M-A7 (no pagination) |
| `RequestInboxScreen.tsx` | RZ-B-M5 confirmed (no pagination) |
| `SettingsScreen.tsx` | RZ-M-A8 (wrong nav: wallet), RZ-M-A9 (wrong nav: gift), RZ-M-A10 (Alert.alert for links) |
| `OnboardingScreen.tsx` | RZ-M-A11 (scroll disabled on Android) |
| `ExperienceWalletScreen.tsx` | RZ-M-A12 (hardcoded tier thresholds) |
| `ModerationService.ts` | RZ-B-B1 (blockUser no cascade cleanup), RZ-B-M12 (reportUser no rate limit) |
| `ReferralService.ts` | RZ-B-B2 (no distributed lock), RZ-B-B3 (no profile completion check) |
| `MessageRequestService.ts` | RZ-B-M11 (shadowScore gaming — decline no rate limit) |
| `experienceCredits.ts` route | RZ-B-M10 confirmed (unnecessary DB re-fetch) |
| `requests.ts` route | RZ-B-M5 confirmed (no pagination) |
| `trustDecayWorker.ts` | RZ-B-M6 confirmed (loads all profiles into memory) |
| `planWorkers.ts` | RZ-B-M1 confirmed (no concurrency) |
| `rateLimiter.ts` | No issues found (verified clean) |

### CONFIRMED (additional deep audit 2026-04-16 — Rendez Admin pages + Auth Store)

| File | Issues Found |
|------|-------------|
| `users/page.tsx` | CRIT: missing auth header; HIGH: r.json() no ok check, User interface mismatch; MED: undebounced search, null age, inconsistent API URL |
| `moderation/page.tsx` | CRIT: missing auth header; HIGH: r.json() no ok check; MED: reviewedBy always 'admin', acting state never cleared |
| `fraud/page.tsx` | CRIT: missing auth header; HIGH: r.json() no ok check, profile/user field mismatch; MED: resolving state never cleared |
| `jobs/queue.ts` | HIGH: removeRepeatable silent failure creates duplicate jobs; MED: Prisma singleton not guarded in production |
| `partnerAudit.ts` | MED: res.on('finish') listener not removed after firing |
| `authStore.ts` | CRIT: unhandled SecureStore rejection locks app; HIGH: setToken silently fails, no token expiry; MED: SecureStore error handling missing |
| `database.ts` | No issues found (verified clean) |

## Adding New Gaps

1. Identify the layer (KARMA-SERVICE / KARMA-UI / RENDEZ-BACKEND / RENDEZ-APP / RENDEZ-ADMIN / ADBAZAAR / REZ-NOW / VESPER-APP / FORENSIC-001)
2. Assign severity: CRITICAL / HIGH / MEDIUM / LOW
3. Pick the category: SECURITY / BUSINESS-LOGIC / FUNCTIONAL / ARCHITECTURE / ERROR-HANDLING / UX
4. Create file: `{layer}/{CATEGORY}.md` or append to existing
5. Update this INDEX.md with the new entry
6. Add to appropriate phase in `07-MASTER-PLAN/`
7. Add bug ID in format: `NW-{CRIT|HIGH|MED|LOW}-###` for REZ-NOW, `AB-{C|H|M|L}-###` for AdBazaar, `VS-{C|H|M|L}-###` for VESPER-APP, `F001-C##` for FORENSIC-001 backend forensic
8. Cross-reference with `09-CROSS-SERVICE-2026/` for cross-repo duplicates
9. For Gen 15 backend sweep: use prefixes `CRON-` (cron/workers), `BULL-` (BullMQ), `CFG-` (config/FSM), `API-` (API mismatch), `ROUTE-` (route security), `DEEP-` (deep code), `SCHEMA-` (schema)
10. For Gen 17 cross-section sweep: use prefixes `ENUM-` (enum drift), `SOCKET-` (Socket.IO), `DB-NAME-` (DB collection naming), `ERR-FMT-` (error format), `DATE-` (date/timezone), `MID-` (middleware/CORS/rate-limit), `ENV-` (env var drift)

---

**Last Updated:** 2026-04-17 (Gen 19 added: cross-repo type/enum consistency — 28 new issues, CT-CRIT-01 through CT-LOW-08)
