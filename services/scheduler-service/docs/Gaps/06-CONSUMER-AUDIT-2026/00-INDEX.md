# Gaps: Consumer App Comprehensive Audit — 2026-04-16

**Audit Date:** 2026-04-16
**Scope:** `rez-app-consumer/` (2,241 source files) + `rez-now/` + `rez-shared/` + `rez-karma-service/`
**Method:** 10 parallel specialized agents reading source end-to-end
**Total Issues Found:** 118 unique bugs (12 CRIT, 28 HIGH, 30 MED, 24 LOW + 16 XREP + 8 N-0X) — verified by grep 2026-04-17
**New vs Existing:** ~20 genuinely NEW issues not in `docs/Bugs/CONSUMER-APP-*.md` (559 bugs documented there)
**Technical Debt Estimate:** ~200 hours base + ~25h service-layer fixes

---

## Files

| File | Description |
|------|-------------|
| `00-INDEX.md` | This file |
| `01-CRITICAL.md` | 11 CRITICAL issues (app-breaking) |
| `02-HIGH.md` | 24 HIGH issues (significant business impact) |
| `03-MEDIUM.md` | 22 MEDIUM issues (2-sprint fix) |
| `04-LOW.md` | 12 LOW issues (polish) |
| `05-CROSS-REPO-MISMATCHES.md` | Enum/type mismatches across ALL repos |
| `06-SYSTEMIC-ROOTS.md` | 6 root diseases causing multiple bugs |
| `07-QUICK-WINS.md` | Fixes under 1 hour each |
| `08-REMEDIATION-PLAN.md` | Phase-by-phase fix roadmap |
| `09-ADDITIONAL-FINDINGS.md` | 25 service-layer Part A + 7 Part D findings + cross-refs (4 CRIT, 4 HIGH, 8 MED, 12 LOW) |

---

## Summary by Severity (Grep-Verified 2026-04-17)

| Severity | Count | Source |
|----------|-------|--------|
| CRITICAL | 12 | 11 from 01-CRITICAL.md + 1 NA2-CRIT-01 (ADDITIONAL-FINDINGS.md Part A) |
| HIGH | 28 | 24 from 02-HIGH.md + 4 NA2-HIGH-01–04 (ADDITIONAL-FINDINGS.md Part A) |
| MEDIUM | 30 | 22 from 03-MEDIUM.md + 8 NA2-MED-01–08 (ADDITIONAL-FINDINGS.md Part A) |
| LOW | 24 | 12 from 04-LOW.md + 12 NA2-LOW-01–12 (ADDITIONAL-FINDINGS.md Part A) |
| XREP | 16 | CROSS-REPO-MISMATCHES.md |
| N-0X | 8 | ADDITIONAL-FINDINGS.md Part D (N-01 through N-08) |
| **TOTAL** | **118** | grep-verified unique IDs across all consumer app audit files |

---

## Gap ID Prefixes (New Audit)

| Prefix | Domain | Count |
|--------|--------|-------|
| `NA-CRIT-###` | New Audit: CRITICAL | 11 |
| `NA-HIGH-###` | New Audit: HIGH | 24 |
| `NA-MED-###` | New Audit: MEDIUM | 22 |
| `NA-LOW-###` | New Audit: LOW | 12 |
| `XREP-###` | Cross-Repo Mismatch | 16 |
| `NA2-CRIT-###` | Additional Service-Layer: CRITICAL | 1 |
| `NA2-HIGH-###` | Additional Service-Layer: HIGH | 4 |
| `NA2-MED-###` | Additional Service-Layer: MEDIUM | 8 |
| `NA2-LOW-###` | Additional Service-Layer: LOW | 12 |

---

## Gap ID Prefixes (Systemic/Architecture)

| Prefix | Domain | Count |
|--------|--------|-------|
| `SYS-ROOT-###` | Root systemic disease | 6 |
| `XREP-###` | Cross-repo mismatch | 16+ |

---

## How to Use

1. Read `06-SYSTEMIC-ROOTS.md` first — understand the 6 root diseases
2. Read `01-CRITICAL.md` — fix these TODAY
3. Read `07-QUICK-WINS.md` — pick off sub-1-hour fixes
4. Read `05-CROSS-REPO-MISMATCHES.md` — see how all repos diverge
5. Read `08-REMEDIATION-PLAN.md` — get the phase-by-phase roadmap

---

## Relationship to Existing Audit (559 bugs)

This audit was conducted AFTER the 2026-04-15 audit (`docs/Bugs/CONSUMER-APP-*.md`).

The prior audit had 559 bugs. This audit found ~69 additional issues, of which **~20 are genuinely new** (not covered in the prior 559). The remaining ~49 are new findings in areas the prior audit partially covered.

Key areas this audit examined that the prior audit didn't deeply cover:
- `rez-now/` (QR/Scan & Pay) — entirely new
- `rez-shared/` package alignment — new cross-repo analysis
- `rez-karma-service/` backend alignment — new
- Data sync / real-time / offline flows — deeper than prior
- API contract deep-dive — verified against actual service code
- Performance bottlenecks — new analysis

---

## CRITICAL Issues (Fix Today)

| ID | Title | File | Type | Est Fix |
|----|-------|------|------|--------|
| NA-CRIT-01 | Payment method cards — zero onPress handlers | `app/payment.tsx` | Functional | 2h |
| NA-CRIT-02 | Bill amount client-controlled — fraud vector | `billVerificationService.ts` | Security | 4h |
| NA-CRIT-03 | `new Blob()` crashes on iOS/Android | `cacheService.ts:216` | Runtime | 30m |
| NA-CRIT-04 | `@/types/unified` doesn't exist — build fails | `ordersApi.ts:7` + 6 others | TypeError | 4h |
| NA-CRIT-05 | QR check-in has no camera/QR code | `app/qr-checkin.tsx` | Missing | 8h |
| NA-CRIT-06 | `showToast` called but never imported in checkout | `app/checkout.tsx` | Runtime | 5m |
| NA-CRIT-07 | Double-tap on payment submit — no guard | `bill-upload-enhanced.tsx:387` | Financial | 30m |
| NA-CRIT-08 | Payment polling never terminates | `paymentService.ts:243` | Enum | 30m |
| NA-CRIT-09 | `Math.random()` for ID generation | `offlineSyncService.ts:436` | Security | 10m |
| NA-CRIT-10 | UPI payment silently does nothing | `pay-in-store/payment.tsx:210` | Functional | 2h |
| NA-CRIT-11 | Wallet balance in plain AsyncStorage | `walletStore.ts:51` | Security | 2h |
| NA2-CRIT-01 | 13 fire-and-forget calls + Sentry swallowed in homepageDataService | `services/homepageDataService.ts` | Data Loss | 2h |

---

## New Findings vs Prior Audit

See `03-CROSS-REF/03-NEW-FINDINGS.md` for a mapping of which issues in this audit are genuinely new vs already documented.

**Genuinely new (not in prior 559 bugs):**
- rez-now coin formula off by factor of 10
- karma service credits wrong coin type
- merge conflict in karmaRoutes.ts
- duplicate startOfWeek in karmaService.ts
- week boundary inconsistency (locale vs ISO)
- conflicting normalizeLoyaltyTier in two shared files
- missing apiUtils.ts (6+ services affected)
- hotelOtaApi bypasses all API infrastructure
- dual Zustand + Context pattern causing drift
- 56 `any` types in stores
- circular imports in selectors.ts
- perceptual hash unreachable in bill verification
- rewards hook idempotency silent drop
- visit milestone dedup 1-second collision
- leaderboard rank off-by-one
- no offline indicator anywhere
- creator-apply window.addEventListener leak
- usePoints polling interval leak
- checkout 609 lines no memoization
- flash-sale and deal success missing haptics

**Service-layer additions (09-ADDITIONAL-FINDINGS.md):**
- 13 fire-and-forget homepage API calls silently swallow errors
- 13+ `as any` casts in MainStorePage.tsx — complete type safety bypass
- `isTokenValid()` no-op exported as public API
- Certificate pinning TODOs in apiClient — MITM risk on compromised devices
- 9 silent `.catch(() => {})` across app screens and hooks
- Coupon validation not implemented — any code applies to any cart
- Hardcoded partner brand names in karma wallet
- Fake uptime reported by backendMonitoringService
- Socket.IO stock updates not integrated — polling only
- `Linking.openURL` silently fails on phone call
- Analytics events all tagged version `1.0.0` regardless of actual version
