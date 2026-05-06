# UNIFIED SOLUTION PLAN — ALL CODEBASES

**Generated:** 2026-04-16
**Total Issues:** 2,700+
**Total Fix Effort:** ~600+ hours (estimated)

---

## Quick Start: 5-Minute Fixes

These take 5 minutes each and eliminate major risks:

| # | Fix | File | Why Now |
|---|-----|------|---------|
| 1 | Remove duplicate `const startOfWeek` | karmaService.ts:195 | Karma system is DEAD |
| 2 | Add `showToast` import | checkout.tsx | Blocks entire checkout |
| 3 | Throw if jwtSecret missing | karma config/index.ts:22 | No default secret |
| 4 | Throw if QR_SECRET missing | karma verificationEngine.ts | Forgeable QR codes |
| 5 | Add auth to batch stats | karma batchRoutes.ts:220 | Internal data exposed |
| 6 | Fix TimingSafeEqual length check | karma verificationEngine.ts:183 | HMAC bypass |
| 7 | Add HMAC key validation | internalAuth.ts:40-46 | ALL internal endpoints open |
| 8 | Add JWT alg whitelist | gateway authMiddleware.ts:65 | Token forgery possible |
| 9 | Replace Math.random() | offlineSyncService.ts:436 | Predictable IDs |
| 10 | Fix HMAC key env var | rez-order-service internalAuth.ts | Internal auth bypassed |

---

## Phase 1: Stop the Bleeding (Today)

**Goal:** Fix the 53 CRITICAL bugs. These break production or cause financial loss.

### Phase 1A: 5-Minute Fixes (Do First)

```
TOTAL: ~45 minutes

1. karmaService.ts:195 — Remove duplicate const startOfWeek (P0)
2. checkout.tsx — Add showToast import (CRITICAL runtime crash)
3. karma config/index.ts:22 — Fail on missing jwtSecret
4. karma verificationEngine.ts:176 — Fail on missing QR_SECRET
5. karma batchRoutes.ts:220 — Add requireAdminAuth
6. karma verificationEngine.ts:183 — Check lengths before timingSafeEqual
7. internalAuth.ts:40-46 — Throw if INTERNAL_SERVICE_TOKEN unset
8. gateway authMiddleware.ts:65 — Add algorithms: ['HS256']
9. offlineSyncService.ts:436 — Replace Math.random() with uuid
10. rez-order-service internalAuth.ts — Use .value not .name
```

### Phase 1B: Hour-Long Security Fixes

```
TOTAL: ~6 hours

Security:
- BE-MER-OTP-001 — Add rate limiter to /auth/verify-otp (30m)
- SEC-KARMA-SSRF-001 — Replace HTTP auth call with local JWT (15m)
- SEC-MER-SENS-001 — Add AES-256-GCM for bankDetails (2h)
- SEC-MER-INJECT-001 — Fix prototype pollution in customers.ts (30m)
- CS-S3 — Make Redis fail-closed (15m)
- CS-S4 — Add SSE merchant ownership check (30m)
- CS-S-M1 — Add IDOR guard on order detail (30m)
- CS-S-M2 — Require PIN fallback for biometric (1h)

Financial:
- FE-PAY-001 — Add event dedup to monolith webhook (30m)
- FE-PAY-002 — Add CAS guard to PaymentMachine (30m)
- CS-M9 — Fix dedup key collision (10m)
- CS-M12 — Fix offline idempotency key order (1h)
- CS-M13 — Fix silent bill removal (1h)
```

### Phase 1C: Consumer App Critical Fixes

```
TOTAL: ~12 hours

- NA-CRIT-02 — Bill amount server-side verification (4h)
- NA-CRIT-04 — Create/replace @/types/unified imports (4h)
- NA-CRIT-07 — Add isSubmittingRef guard (30m)
- NA-CRIT-08 — Add 'paid' to payment polling terminal check (30m)
- NA-CRIT-11 — Move wallet balance to secure storage (2h)
- NA-CRIT-10 — Wire UPI payment flow or add deep link (2h)
- NA-CRIT-05 — Integrate expo-camera for QR check-in (8h)
```

### Phase 1D: Merchant/Admin/Backend Critical Fixes

```
TOTAL: ~15 hours

- F001-C1 — Fix settlement merchant vs merchantId (2h)
- F001-C3 — Atomic merchant withdrawal (1h)
- F001-C7 — Create FraudFlag model (2h)
- F001-C6 — Fix admin cron auth (1h)
- F001-C12 — Remove Firebase JSON from disk (1h)
- F001-C14 — Add auth to static files (30m)
- CS-M14 — Batch sync partial failure fix (2h)
- CS-M15 — Include coinRedemption in POS payload (2h)
- CS-M16 — Store coin data in offline queue (1h)
- RZ-B-C1 — Fix gift voucher authorization (30m)
- RZ-B-C2 — Atomic webhook reward (1h)
- RZ-B-C4 — Fix socket read_receipt ownership (30m)
- NW-CRIT-003 — Protect merchant routes (2h)
- NW-CRIT-002 — Fix payment verification (30m)
```

### Phase 1E: AdBazaar Critical Fixes

```
TOTAL: ~3 hours

- AB-C1 — Fix rez_user_id from session (30m)
- AB-C5 — Verify payment amount server-side (1h)
- AB-C4 — Add idempotency key to booking (1h)
- AB-C2 — Add rate limiting (30m)
```

**Phase 1 Total: ~36 hours**

---

## Phase 2: Close the Gaps (This Week)

**Goal:** Fix HIGH severity bugs. These don't break production but cause data loss or incorrect behavior.

### HIGH Priority by Category

```
FINANCIAL INTEGRITY (~8h):
- FE-PAY-003/004/007 — Float precision in payment service (2h)
- FE-PAY-005 — Uncapped deductCoins in monolith (30m)
- FE-PAY-006 — Non-atomic BNPL settlement (1h)
- FE-PAY-013 — Hardcoded 10k coin cap (30m)
- FE-PAY-016 — No idempotency on wallet refund (1h)
- FE-PAY-027 — Monolith deductCoins bypasses wallet safeguards (1h)
- G-KS-B4 — Auto-checkout missing EarnRecord (30m)
- G-KS-B10 — eventsCompleted double-increment (1h)

DATA SYNC (~6h):
- RS-003 — Bill upload sync race (30m)
- RS-004 — Offline sync race (30m)
- RS-005/006 — OfflineQueueContext stale refs (1h)
- RS-007 — Bill upload mid-network failure (2h)
- RS-008 — useOfflineCart wrong import (30m)
- RS-009/010 — Socket stale closure/reconnect (2h)

ENUM/TYPE MISMATCHES (~6h):
- CS-E10 — Payment status 'completed' vs 'paid' (30m)
- CS-E11 — karma credits 'rez' queries 'karma_points' (30m)
- CS-E12 — normalizeLoyaltyTier opposite in two files (1h)
- CS-E15 — CoinType branded_coin vs branded (1h)
- CS-E19 — OrderStatus fragmented 7x (2h)
- CS-E20 — Merchant PaymentStatus 'completed' vs 'paid' (1h)

ARCHITECTURE (~8h):
- P1-ARCH-001 — BullMQ double-consume fix (2h)
- P2-ARCH-002 — No authoritative source of truth (3h)
- P2-ARCH-003 — Achievement format mismatch (2h)
- ARCH-MULTI — No regression testing across fleet (1h)

KARMA SERVICE (~5h):
- G-KS-B2 — No karma input validation (15m)
- G-KS-B3 — Kill switch sets wrong status (5m)
- G-KS-B5 — Decay worker runs weekly not daily (5m)
- G-KS-B6 — GPS score discontinuous (20m)
- G-KS-B7 — Mixed week boundaries (30m)
- G-KS-B8 — Non-atomic CSR pool (20m)
- G-KS-B9 — createEarnRecord bypasses addKarma (1h)
- G-KS-B11 — eventsJoined never incremented (30m)
- G-KS-B12 — avgEventDifficulty never updated (30m)
```

**Phase 2 Total: ~33 hours**

---

## Phase 3: Fix the Foundation (This Month)

**Goal:** Address architectural root causes. These won't break anything today but generate bugs indefinitely until fixed.

### Architectural Fixes

```
ROOT CAUSE RC-1: No single source of truth for types/enums
- Create canonical shared-types package (8h)
- Migrate all 100+ duplicate type definitions
- Add CI check: no new local type definitions

ROOT CAUSE RC-2: Frontend computes what backend should own
- Move all cashback/reward calculations to backend (16h)
- Remove client-side `total.toFixed(2)` financial calculations
- Add server-side amount verification on all financial endpoints

ROOT CAUSE RC-3: Fire-and-forget for financial operations
- Wrap all coin credit/deduct calls in BullMQ jobs (8h)
- Add dead-letter queue for failed financial operations
- Create reconciliation cron job (4h)

ROOT CAUSE RC-4: In-memory state machines
- Replace all in-memory PaymentMachines with DB-persisted CAS (4h)
- Add transaction safety to all multi-step operations (8h)

ROOT CAUSE RC-5: No TypeScript contract at boundary
- Add Zod schemas to all API endpoints (12h)
- Generate TypeScript types from Zod schemas
- Remove all `as any` casts in API routes

ROOT CAUSE RC-6: Copy-paste without shared abstraction
- Extract all duplicate service files to shared packages (16h)
- Dedup 82 identical admin service files (8h)

ROOT CAUSE RC-7: TanStack Query cache invalidation missing
- Audit all socket.io event handlers for cache invalidation (4h)
- Add queryClient.invalidateQueries() to all real-time handlers
- Create shared useRealtime hook (4h)
```

### Data Sync Fixes

```
- RS-012 — SSE heartbeat failure detection (2h)
- RS-013 — Change stream reconnection (3h)
- RS-014 — Order FSM `cancelling -> placed` invalid transition (30m)
- RS-015 — Wallet queue fail-open (2h)
- RS-016 — Merchant event bus persistence (3h)
- RS-017 — Merchant ORDER_PAID transaction safety (2h)
- RS-018 — Queue size check before dedup (30m)
- RS-019 — Standardize DISABLE_ORDER_WORKER vs *_WORKER_EXTERNAL (1h)
```

### Medium/Batch Fixes

```
All MEDIUM and LOW issues across all codebases:
- Consumer App: ~34 issues (~20h)
- Merchant App: ~118 issues (~60h)
- Admin App: ~28 issues (~15h)
- Karma Service: ~23 issues (~12h)
- Backend Services: ~300 issues (~150h)
- Rendez: ~40 issues (~20h)
- AdBazaar: ~18 issues (~8h)
- ReZ NoW: ~60 issues (~30h)

Total Phase 3: ~400+ hours
```

---

## Phase 4: Cross-Repo Consolidation (Next Month)

```
UNIFIED CROSS-REPO FIXES:

1. Enum/Type Canonical Package
   - IKarmaProfile → canonical across all 5 surfaces
   - OrderStatus → single definition, all imports from it
   - PaymentStatus → single definition, 'paid' as terminal
   - CoinType → single definition, 'branded' not 'branded_coin'

2. Shared Financial Patterns
   - All wallet operations → wallet-service only
   - All coin operations → BullMQ jobs with DLQ
   - All idempotency → Redis SET NX pattern
   - All CAS → findOneAndUpdate with filter

3. Shared Real-Time Patterns
   - Single Socket.IO context per app
   - useRealtime hook with query invalidation
   - Change stream reconnection wrapper
   - SSE heartbeat with failure detection

4. Shared Auth Patterns
   - Service-to-service → HMAC with shared secret
   - Client auth → JWT with algorithm whitelist
   - Internal endpoints → env var validation at startup

5. Shared API Patterns
   - Shared apiClient.ts with auth injection
   - Shared queryKeys.ts factory
   - Shared error handling middleware
   - Shared Zod validation schemas
```

---

## Effort Summary

| Phase | Focus | Hours |
|-------|-------|-------|
| Phase 1A | 5-minute fixes | 0.75 |
| Phase 1B | Security hour-fixes | 6 |
| Phase 1C | Consumer app CRITICALs | 12 |
| Phase 1D | Backend/merchant/admin CRITICALs | 15 |
| Phase 1E | AdBazaar CRITICALs | 3 |
| **Phase 1 Total** | **Stop the bleeding** | **~37** |
| Phase 2 | HIGH severity | ~33 |
| Phase 3 | Architecture + Medium | ~400+ |
| Phase 4 | Cross-repo consolidation | ~100+ |
| **TOTAL** | | **~570+ hours** |

---

## Parallel Execution Plan

### Week 1 (37 hours)
- **Track A (Security):** Phase 1A + 1B in parallel
- **Track B (Consumer):** Phase 1C in parallel with Track A
- **Track C (Backend):** Phase 1D in parallel with Track A

### Week 2-3 (33 hours)
- **Track A:** Financial integrity fixes
- **Track B:** Data sync fixes
- **Track C:** Enum/type fixes + karma service

### Month 2-3 (~400 hours)
- Architecture fixes (RC-1 through RC-7)
- Medium and LOW batch fixes
- Cross-repo consolidation

---

## How to Execute

1. **Pick a phase** above based on available time
2. **Read the specific gap doc** for exact file:line and fix code
3. **Check for duplicates** — many bugs appear under different IDs
4. **Write a test first** (where applicable)
5. **Fix and verify** — run `tsc --noEmit` and `npm test`
6. **Mark as fixed** in the gap doc's status table
7. **Update burn-down** in `docs/BURN_DOWN_DASHBOARD.md`

---

**Last Updated:** 2026-04-16
