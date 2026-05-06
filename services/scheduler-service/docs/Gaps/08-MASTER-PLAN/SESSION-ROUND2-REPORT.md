# Session Round 2 Audit Report

**Date:** 2026-04-17
**Scope:** Phase 1 CRITICAL fixes continuation + Phase 2 begins
**Auditor:** Permanent Auditor Agent

---

## Fixes Completed This Session

### AdBazaar P0 Security Fixes (AB-C1 through AB-C5)

All 5 P0 security fixes verified on disk. Source: `adBazaar/` repo.

| ID | Issue | File | Status | Verification |
|----|-------|------|--------|--------------|
| AB-C1 | QR scan spoofing (`rez_user_id` via URL param) | `src/app/api/qr/scan/[slug]/route.ts` | ✅ FIXED | GET handler removed URL param; POST uses authenticated Supabase session. DLQ for failed credits added. |
| AB-C2 | No rate limiting on public endpoints | `src/middleware.ts` | ✅ FIXED | In-memory sliding window: 20 req/min (qr/scan), 100 req/min (other API). Periodic cleanup. |
| AB-C3 | Full bank account numbers + IFSC exposed | `src/app/api/profile/route.ts` | ✅ FIXED | GET/PATCH mask account: `XXXX{last4}`, IFSC: `{first4}XXXX{last3}`. |
| AB-C4 | No idempotency key on booking creation | `src/app/api/bookings/route.ts` | ✅ FIXED | `Idempotency-Key` header read; existing booking check; `idempotency_key` column inserted. |
| AB-C5 | Payment amount never verified server-side | `src/app/api/bookings/[id]/verify-payment/route.ts` | ✅ FIXED | `razorpay_amount` compared against `booking.amount * 100` in paise. |

### Cross-Repository Security Fixes

| ID | Issue | Repo | Status | Verification |
|----|-------|------|--------|--------------|
| CS-S6 | CSRF timing attack fix | rez-backend | ✅ FIXED | PR#108 merged |
| CS-M1 | PaymentMachine double credit | payment-service | IN PROGRESS | Backend-services agent |
| CS-E1 | normalizeOrderStatus three-way mismatch | all surfaces | IN PROGRESS | Type-enum-drift agent |
| CS-A1 | VoucherBrand defined 3x (runtime crash) | admin | IN PROGRESS | Backend-services agent |
| CS-A3 | Finance rewards hook non-existent routes | finance-service | IN PROGRESS | Backend-services agent |

### Karma Service Security Fixes

| ID | Issue | File | Status | Verification |
|----|-------|------|--------|--------------|
| G-KS-C3 | jwtSecret unvalidated at startup | `src/config/index.ts` + startup | ✅ FIXED | JWT_SECRET added to required env vars check |
| G-KS-C5 | Batch stats endpoint unauthenticated | `src/routes/batchRoutes.ts` | ✅ FIXED | requireAdminAuth added to `/stats` route |
| G-KS-C6 | TimingSafeEqual throws on length mismatch | `src/engines/verificationEngine.ts` | ✅ FIXED | Length check added before timingSafeEqual call |
| G-KS-C7-21 | Business logic + UI issues | karma-service | IN PROGRESS | karma-service agent |
| G-KS-H9-H25 | Round 4 HIGH findings | karma-service | IN PROGRESS | karma-service agent |

### Consumer App Fixes

| ID | Issue | Repo | Status | Verification |
|----|-------|------|--------|--------------|
| F-05 | Wallet idempotency (6 methods) | rez-app-consumer | ✅ FIXED | `walletApi.ts` + `priveApi.ts` — `Idempotency-Key` header forwarding + crypto CSPRNG keys |
| CS-T/E types | Math.random, console.log, types | rez-app-consumer | IN PROGRESS | Consumer-app agent |

### Architecture Fitness Tests

| ID | Issue | Repo | Status | Verification |
|----|-------|------|--------|--------------|
| AF-1-5 | 5 arch fitness tests (enums, idempotency, buttons, logs, Math.random) | rez-scheduler-service | ✅ COMMITTED | 5 scripts in `scripts/arch-fitness/` + GitHub workflow |
| AF-TBD | Remaining arch fitness tests | all repos | IN PROGRESS | Fitness-tests agent |

### Cross-Service Unified Fixes

| ID | Issue | Status | Verification |
|----|-------|--------|--------------|
| XF-1 | Coin credit DLQ (failed_coin_credits table + cron) | ✅ FIXED | AdBazaar `failed_coin_credits` table created; DLQ insert on REZ API failures |

---

## Fixes In Progress (9 Agents Running)

| Agent | Repo | Fixing | Status |
|-------|------|--------|--------|
| karma-service | rez-karma-service | G-KS-C7-21, business logic, UI issues | Running |
| consumer-app | rez-app-consumer | CS-T/E types, Math.random, console.log | Running |
| AdBazaar | adBazaar | AB-B1, AB-B2, AB-P1, AB-D1 | Running |
| merchant-app | rezmerchant | G-MA-C15, C16, H39-44 | Running |
| admin-app | rez-app-admin | A10-C1-8, A10-H1-17, A10-M/L | Running |
| backend-services | rez-backend + payment + finance | CS-M1, CS-E1, CS-A1, CS-A3, HIGH-001-015 | Running |
| type-enum-drift | all repos | CS-T1-2, CS-E1-9, canonical types | Running |
| vesper-remaining | vesper-app | Gen 16 (Vesper), Gen 12 (ReZ NoW), remaining Gen | Running |
| fitness-tests | all repos | Arch fitness scripts + GitHub workflows | Running |

---

## Bugs Remaining (Cumulative)

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 240 | 25 | 215 |
| HIGH | 603 | 0 | 603 |
| MEDIUM | 1,439 | 0 | 1,439 |
| LOW | 444 | 0 | 444 |
| **TOTAL** | **2,726** | **25** | **2,701** |

### Breakdown of Fixed CRITICAL Issues (25 total)

**Session 1 (2026-04-17 morning):**
- NA-CRIT-03: `new Blob()` crash (iOS/Android)
- NA-CRIT-04: Missing `types/unified/index.ts` (build blocker)
- NA-CRIT-06: Missing `showToast` import
- NA-CRIT-07: Double-tap payment submit guard
- NA-CRIT-08: Payment polling `'paid'` terminal check
- NA-CRIT-09: `Math.random()` -> `crypto.randomUUID()` (13 files)
- NA-CRIT-10: UPI payment wired to backend
- NA-CRIT-11: SecureWalletStorage (SecureStore + XOR migration)
- NA-HIGH-01: Coin formula `/10` factor removed
- NA-HIGH-03: CoinType alignment
- NA-HIGH-04: `Math.max(0)` floor guard
- NA-HIGH-07: `Math.floor` -> `Math.round` on redemption caps
- NA-HIGH-08: Hardcoded dayRewards fallback removed
- NA2-CRIT-01: 5 `.catch(() => {})` -> `logger.error()`
- QR-checkin: Silent catches -> `logger.error()`
- CoinType: `cashback`, `referral` added to types
- Karma: Wallet balance route + `getRezCoinBalance()`

**Session 2 (2026-04-17 afternoon):**
- AB-C1: QR scan spoofing fix (Bearer auth)
- AB-C2: Rate limiting (in-memory sliding window)
- AB-C3: Bank account masking (XXXX + IFSC masking)
- AB-C4: Booking idempotency (Idempotency-Key header)
- AB-C5: Payment amount verification (razorpay_amount check)
- XF-1: Coin credit DLQ (`failed_coin_credits` table)
- G-KS-C3: jwtSecret validation at startup
- G-KS-C5: Batch stats route `requireAdminAuth`
- G-KS-C6: `timingSafeEqual` length check
- CS-S6: CSRF timing attack (rez-backend PR#108)

---

## Documentation Updates

This session updated the following docs:

| Doc | Changes |
|-----|---------|
| `docs/Gaps/00-INDEX.md` | Updated session 2 status header |
| `docs/Gaps/01-KARMA-SERVICE/SECURITY.md` | G-KS-C3, C5, C6 marked FIXED; duplicate table entries removed |
| `docs/Gaps/06-ADBAZAAR/SECURITY.md` | AB-C1 through AB-C5 marked FIXED |
| `docs/Gaps/08-MASTER-PLAN/PHASE1-CRITICAL.md` | Already showed AB-C1-5 as FIXED (unchanged) |
| `docs/Gaps/08-MASTER-PLAN/UNIFIED-FIX-PLAN.md` | P1 status updated: 0 -> 5 completed |
| `docs/Gaps/08-MASTER-PLAN/SESSION-ROUND2-REPORT.md` | Created (this file) |

---

## Known Issues Noted During Audit

### AdBazaar `middleware.ts` Bug (Non-Critical)

**File:** `src/middleware.ts` line 126

The middleware references `res` which is undefined in the current scope. The correct constant should be `NextResponse`:
```typescript
// Line 126 — WRONG:
return res
// Should be:
return NextResponse.redirect(new URL('/login', req.url))
```

**Impact:** Routes that reach line 126 throw `ReferenceError: res is not defined`. Affects `/login` and `/register` routes when redirecting authenticated users.

**Status:** Noted — not in scope for current agents. Requires fix in adBazaar agent or separate ticket.

---

## Next Steps

1. **Await agent completions** — 9 agents running; verify each PR merges cleanly
2. **Fix AB-C1-5 business logic** — AB-B1 (visit bonus), AB-B2 (hardcoded bonus pct), AB-P1 (messages), AB-D1 (fire-and-forget) still open
3. **Karma service G-KS-C7-21** — C7 (idempotency collision) is CRITICAL and in progress
4. **Round 2 AdBazaar issues** — AB2-C1 through AB2-C6 (QR bypass, commission double, RLS fallback, razorpay capture, payout simulated mode, marketing errors)
5. **Round 3 AdBazaar issues** — AB3-C1 through AB3-C4 (campaign IDOR, vendor role, campaign orphan state, signature throw)
6. **Type canonicalization** — CS-T1-2, CS-E1-9 still in progress across all repos

---

**Last Updated:** 2026-04-17
**Maintainer:** Permanent Auditor Agent
**Next Audit:** Upon agent completion notifications
