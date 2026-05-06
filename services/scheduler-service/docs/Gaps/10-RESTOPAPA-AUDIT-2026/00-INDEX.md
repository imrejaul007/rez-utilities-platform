# RestoPapa / ReZ Platform Audit — Generation 14 (2026-04-16)

**Generated:** 2026-04-16
**Scope:** Rendez, rez-app-consumer, rez-app-marchant, rez-app-admin, rez-karma-service, rez-contracts
**Method:** 4 parallel audit agents — Functional/Business/Payment, Data/Sync/Architecture, Security/Enum/Edge Case, UX/Performance/Offline
**Total Issues Found:** 93 across 13 categories
**Status:** Open — no fixes applied yet

---

## Audit Agents & Coverage

| Agent | Coverage | Issues Found |
|-------|---------|-------------|
| functional-auditor | Functional bugs, business logic, payment/financial | ~40 |
| data-arch-auditor | Data sync, API contracts, architecture | ~40 |
| security-auditor | Security, enum/status, edge cases, real-time | ~15 |
| ux-perf-auditor | UX/flow gaps, performance, offline | ~20 |

---

## Master Count

| Severity | Count | Categories |
|----------|-------|-----------|
| **CRITICAL** | 17 | Payment, Security, Data Sync, Architecture, UX |
| **HIGH** | 29 | Enum, Business Logic, Data Sync, Architecture, UX, Performance |
| **MEDIUM** | 30 | Architecture, UX, Edge Case, Real-time |
| **LOW** | 17 | Enum, Architecture, Edge Case |
| **TOTAL** | **93** | |

---

## Folder Structure

```
docs/Gaps/10-RESTOPAPA-AUDIT-2026/
├── 00-INDEX.md                          ← You are here
├── 01-CRITICAL.md                      ← 17 critical issues
├── 02-HIGH.md                          ← 29 high-severity issues
├── 03-MEDIUM.md                        ← 30 medium issues
├── 04-LOW.md                           ← 17 low issues
├── 05-CROSS-REPO-MISMATCHES.md         ← Cross-repo API/type/enum mismatches
├── 06-SYSTEMIC-ROOTS.md                ← 5 root cause diseases
├── 07-QUICK-WINS.md                    ← 12 fixes under 30 minutes
└── 08-REMEDIATION-PLAN.md              ← 4-phase fix roadmap
```

---

## CRITICAL Issues (Fix First) (17 issues)

| ID | Category | Title | File | Est. |
|----|----------|-------|------|------|
| RP-C01 | Architecture | Karma service routes return 501 — never mounted | `karma-service/src/routes/index.ts` | 1h |
| RP-C02 | Data Sync | CrossAppSyncService webhook delivery is dead code | `CrossAppSyncService.ts:261-293` | 2h |
| RP-C03 | Data Sync | syncOrders/syncCashback are no-ops returning success | `SyncService.ts:396-409` | 1h |
| RP-C04 | Financial | Double karma credit — earnRecordService + karmaService both credit | `earnRecordService.ts` + `karmaService.ts` | 2h |
| RP-C05 | Financial | Batch pool decrement before record save — no transaction | `batchService.ts` | 2h |
| RP-C06 | Financial | Referral credit fire-and-forget with no retry | `ReferralService.ts` | 1h |
| RP-C07 | Financial | Referral credit race condition | `ReferralService.ts` | 1h |
| RP-C08 | Security | Admin auth bypass — requireAdmin undefined | `batchRoutes.ts:220` | 1h |
| RP-C09 | Security | Wallet service calls have no authentication | `walletIntegration.ts` | 2h |
| RP-C10 | Security | JWT secret fallback in test files | `setup.ts:11` | 0.5h |
| RP-C11 | Data Sync | 3 incompatible CoinTransaction schemas, same collection | 3 model files | 4h |
| RP-C12 | Data Sync | cashback/referral coins invisible in wallet/ledger | Wallet + Ledger models | 2h |
| RP-C13 | API Contract | IEarnRecord.verificationSignals — canonical vs actual mismatch | `karma.ts` vs `EarnRecord.ts` | 2h |
| RP-C14 | API Contract | Frontend missing voucherCode/offerRedemptionCode in order payload | `ordersApi.ts` vs `orderCreateController.ts` | 1h |
| RP-C15 | API Contract | Admin missing store.merchantId in order response | `orders.ts` vs `orderController.ts` | 1h |
| RP-C16 | UX | Cart optimistic update no rollback — ghost cart items after failure | `CartContext.tsx` | 2h |
| RP-C17 | Offline | Consumer offline queue silently drops on QuotaExceededError | `offlineQueueStore.ts` | 1h |

---

## Root Causes

| # | Root Cause | Drives |
|---|-----------|--------|
| RP-RC1 | No shared schema contracts — IEarnRecord, CoinTransaction, TransactionAuditLog all have 2-3 incompatible definitions | C-11, C-12, C-13, H-01, H-02 |
| RP-RC2 | Routes written but never wired — karma HTTP routes, batch notification, CrossAppSync webhook all dead code | C-01, C-02, H-12 |
| RP-RC3 | Service-to-service auth is nonexistent — wallet integration, auth fallback, admin stats all trust by network position | C-08, C-09, H-15, M-12 |
| RP-RC4 | Fire-and-forget for financial operations — referral credit, batch notification, gamification events all lack retry/DLQ | C-05, C-06, C-07, M-07 |
| RP-RC5 | Frontend and backend evolved independently — missing fields, wrong field names, different response shapes | C-14, C-15, H-09, M-04, M-06 |

---

## How to Read

1. **Fix CRITICALs first** — 15 issues that can drain wallets, corrupt data, or expose financial info
2. **Check cross-repo** — many issues appear in multiple places with different IDs
3. **Read specific gap doc** for exact file:line references and fix suggestions
4. **Mark as fixed** in the gap doc's status table when resolved
5. **Cross-reference** with FORENSIC-001, Gen 8-13 gap docs — many issues are duplicates

---

## Cross-References to Existing Gaps

| This Audit | Existing Gap | Relationship |
|-----------|-------------|-------------|
| RP-C08 (requireAdmin undefined) | G-KS-C5 (batch stats unauthenticated) | Same file, different analysis |
| RP-C09 (wallet no auth) | XF-2 (user spoofing) | Same root cause family |
| RP-C11 (3 CoinTransaction schemas) | F001-C5, CS-M4 | Same issue, multiple Gens |
| RP-C13 (IEarnRecord mismatch) | G-KS-C10, XREP-11 | Same type drift |
| RP-C14 (missing voucherCode) | CRIT-002 (API contract) | Same contract issue |
| RP-C15 (missing merchantId) | CRIT-003 (API contract) | Same contract issue |
| RP-C01 (501 routes) | G-KS-C4 (auth 404) | Different karma routes |

---

**Last Updated:** 2026-04-16
**Next Step:** Read `01-CRITICAL.md` for detailed fix instructions, then `08-REMEDIATION-PLAN.md` for the phased fix approach.
