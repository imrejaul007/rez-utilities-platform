# Master Remediation Plan — All Codebases

**Generated:** 2026-04-16
**Scope:** ALL 2,726 verified issues across Gen 1–18 (corrected 2026-04-17)
**Total Estimated Effort:** ~504 hours across 10 weeks
**Approach:** Fix highest-leverage cross-service issues first, then per-codebase cleanup

---

## Grand Summary

| Tier | Count | Strategy | Est. Hours |
|------|-------|----------|-----------|
| CRITICAL (P0) | 240 | Fix immediately — security/financial/data-loss risk | ~120h |
| HIGH (P1) | 603 | Fix in sprint cycles — broken features | ~300h |
| MEDIUM (P2) | 1,439 | Fix in maintenance — degraded UX | ~200h |
| LOW (P3) | 444 | Fix opportunistically — polish | ~80h |
| **TOTAL** | **2,726** | | **~700h / 14 weeks** |

---

## Phase 1: Cross-Service Security & Atomicity (Week 1–2)

**Rationale:** Fix the issues that can drain wallets, forge tokens, or leak data across ALL services simultaneously.

### Phase 1A — Critical Security (20 issues, ~20h)

| # | Issue | File | Fix | Est. | Status |
|---|-------|------|-----|------|--------|
| CS-S1 | HMAC key from env var NAME not value | internalAuth.ts | Use `process.env[key]` not literal string | 1h | **FIXED** (already in code) |
| CS-S2 | JWT verify without algorithm whitelist | authMiddleware.ts | Add `algorithms: ['HS256']` | 1h | **FIXED** (already in code) |
| CS-S4 | SSE stream no ownership check | httpServer.ts | Add merchantId validation | 2h | **FIXED** (already in code) |
| CS-S11 | Custom HS256 timing attack | httpServer.ts | Replace with `crypto.timingSafeEqual` | 1h | **FIXED** (already in code) |
| CS-S3 | Redis fail-open outside prod | httpServer.ts | Remove fail-open, always deny | 2h | **FIXED** (already in code) |
| CS-S6 | requireMerchant CSRF bypass | authMiddleware.ts | Add CSRF token check | 2h | **FIXED** — PR #108 (rez-backend) |
| G-KS-C1 | Hardcoded QR secret forgeable | verificationEngine.ts | Remove hardcoded secret | 1h | **FIXED** — PR #10 (Karma) |
| G-KS-C3 | jwtSecret unvalidated at startup | config/index.ts | Add startup validation | 1h | **FIXED** — PR #10 (Karma) |
| G-KS-C4 | Horizontal privilege escalation | karmaRoutes.ts | Add userId ownership check | 2h | **FIXED** — PR #10 (Karma) |
| G-KS-C5 | Batch stats endpoint unauthenticated | batchRoutes.ts | Add requireAuth | 1h | **FIXED** — PR #10 (Karma) |
| G-KS-C6 | TimingSafeEqual throws on length | verificationEngine.ts | Add length check before compare | 1h | **FIXED** — PR #10 (Karma) |
| A10-C5 | HMAC key from env var NAME | internalAuth.ts | Use env var VALUE | 1h | **FIXED** (already in code) |
| A10-H9 | JWT alg:none not mitigated | authMiddleware.ts | Add algorithm whitelist | 1h | **FIXED** (already in code) |
| A10-H10 | Missing role guards | admin-settings | Add role checks | 2h | NOT FIXED |
| AB-C1 | `rez_user_id` spoofable via URL | qr/scan/route.ts | Move userId to request body | 1h | NOT FIXED (see AUDIT-VERIFY-2026-04-17) |
| AB-C2 | No rate limiting on public APIs | All API routes | Add rate limiter middleware | 2h | NOT FIXED (see AUDIT-VERIFY-2026-04-17) |
| AB-C3 | Full bank account numbers exposed | profile/route.ts | Mask account numbers | 1h | NOT FIXED (see AUDIT-VERIFY-2026-04-17) |
| AB-C4 | No idempotency on booking | bookings/route.ts | Add idempotency key | 2h | NOT FIXED (see AUDIT-VERIFY-2026-04-17) |
| AB-C5 | Payment amount never verified | verify-payment/route.ts | Verify amount server-side | 1h | NOT FIXED (see AUDIT-VERIFY-2026-04-17) |
| RZ-A-C2 | No middleware on Rendez admin | No middleware.ts | Create middleware.ts | 2h | NOT FIXED |

### Phase 1B — Money Atomicity (10 issues, ~15h)

| # | Issue | File | Fix | Est. |
|---|-------|------|-----|------|
| CS-M1 | PaymentMachine in-memory double credit | paymentRoutes.ts | Persist to DB, add idempotency | 4h |
| CS-M2 | debitInPriorityOrder atomicity | wallet-service | Wrap in MongoDB session | 3h |
| CS-M3 | Merchant credit TOCTOU | order-service | Add optimistic lock | 2h |
| CS-M4 | No idempotency on wallet mutations | wallet-service | Add idempotency keys | 2h | FIXED — consumer walletApi.ts + priveApi.ts (2026-04-17) |
| CS-M5 | Welcome coins race window | auth-service | Add distributed lock | 2h |
| CS-M6 | No-orderId path in wallet | wallet-service | Require orderId | 1h |
| CS-M7 | Partial refund idempotency key mutable | payment-service | Fix key encoding | 2h |
| CS-M8 | debitForCoinAward no transaction | gamification | Add transaction | 2h |
| A10-C4 | In-memory PaymentMachine | paymentRoutes.ts | DB-backed state machine | 4h |
| A10-H12 | No idempotency on financial ops | wallet API | Add idempotency keys | 2h |

---

## Phase 2: Type & Enum Normalization (Week 2–3)

**Rationale:** One fix resolves 10–100 instances. Centralizing types/enums eliminates entire categories of bugs.

### Phase 2A — Shared Types (8 issues, ~12h)

| # | Issue | Files | Fix | Est. |
|---|-------|-------|-----|------|
| CS-T1 | KarmaProfile 14 fields missing | karmaService.ts + shared | Import IKarmaProfile, remove local type | 3h |
| CS-T2 | KarmaEvent `difficulty` type mismatch | karmaService.ts + shared | Use IKarmaEvent, convert difficulty | 2h |
| CS-A1 | VoucherBrand defined 3 times | extraRewards.ts + cashStore.ts + shared | Define canonical in shared, remove local | 3h |
| CS-A2 | CoinDrop storeId type mismatch | extraRewards.ts + cashStore.ts | Unify to string | 1h |
| CS-A3 | DoubleCashbackCampaign minOrderValue | extraRewards.ts + cashStore.ts | Unify to required field | 1h |
| CS-T4 | Order `_id` vs `id` | orders.tsx:971 | Use `._id` everywhere | 1h |
| CS-T5 | DoubleCashbackCampaign optional vs required | extraRewards.ts + cashStore.ts | Align with canonical | 1h |
| CS-S12 | Shared package exports drift | package.json | Rebuild and verify exports | 1h |

### Phase 2B — Enum Normalization (6 issues, ~10h)

| # | Issue | Files | Fix | Est. |
|---|-------|-------|-----|------|
| CS-E1 | Three normalizeOrderStatus implementations | 3 files | Merge to single @rez/shared implementation | 4h |
| CS-E2 | Payment status colors missing 7 states | orders.tsx + 2 surfaces | Add all 7 states to color map | 2h |
| CS-E3 | Live monitor missing `out_for_delivery` | live-monitor.tsx | Add missing status | 1h |
| CS-E5 | Consumer uses `completed` not `delivered` | consumer screens | Replace with canonical `delivered` | 2h |
| CS-E4 | Status transition allows invalid skip | orders.tsx:61 | Remove `delivered` from dispatched transitions | 1h |
| CS-E9 | Consumer app wrong status strings | consumer screens | Replace all non-canonical statuses | 2h |

---

## Phase 3: Per-Codebase Critical & High Fixes (Week 3–6)

### 3A: ReZ Admin App (53 issues, ~60h)

Priority order:

1. **A10-C1** — Socket doesn't invalidate React Query cache (~2h)
2. **A10-C2** — Three competing VoucherBrand types (~3h)
3. **A10-C3** — Opposite query param names (~1h)
4. **A10-C6** — SSE no ownership check (~2h)
5. **A10-C7** — Three conflicting color systems (~4h)
6. **A10-C8** — Refund modal Rs. 0 and #undefined (~1h)
7. **A10-H1-H4** — Cache invalidation + duplicate types (~5h)
8. **A10-H5-H8** — Enum/status issues (~6h)
9. **A10-H11** — Socket null auth on web (~2h)
10. **A10-H13-H17** — Architecture issues including 82 duplicate files (~20h)
11. **A10-M1-M20** — Medium issues (~15h)
12. **A10-L1-L8** — Low issues (~5h)

### 3B: ReZ Consumer App (69 issues, ~55h)

Priority order:

1. **CS-T1, CS-T2** — Type drift fixes (~5h)
2. **CS-E5, CS-E9** — Status string fixes (~5h)
3. **CS-E2** — Payment status colors (~2h)
4. **Consumer Gen 11 Criticals** — 11 critical issues (~20h)
5. **Consumer Gen 11 Highs** — 24 high issues (~15h)
6. **Consumer Gen 11 Mediums** — 22 medium issues (~8h)

### 3C: Karma Service (116 issues, ~70h)

1. **G-KS-C1-C23** — 16 critical security issues (~24h)
2. **G-KS-H1-H25** — 23 high issues (~25h)
3. **G-KS-M17-M44** — 28 medium issues (~16h)
4. **G-KS-L2-L9** — 8 low issues (~4h)
5. **Remaining issues** — (~3h)

### 3D: AdBazaar (38 issues, ~40h)

1. **AB-C1-C5** — 5 critical security (~8h)
2. **AB-B1-B2, AB-P1, AB-D1** — Business logic + payment + data sync (~10h)
3. **Remaining 30 issues** — (~22h)

### 3E: Rendez App + Admin (73 issues, ~45h)

1. **RZ-B-C1-C3** — Backend criticals (~5h)
2. **RZ-A-C1-C4** — Admin criticals (~4h)
3. **RZ-M-F1-F4, RZ-M-S1** — App functional (~4h)
4. **Remaining** — (~32h)

---

## Phase 4: Systemic Architecture Fixes (Week 6–8)

These are the root cause fixes that prevent future bugs:

| # | Fix | Impact | Est. |
|---|-----|--------|------|
| AF-1 | Add `no-bespoke-enums` fitness test | Prevents future enum duplication | 2h |
| AF-2 | Add `no-bespoke-idempotency` fitness test | Prevents future fire-and-forget | 2h |
| AF-3 | Add `no-as-any` lint rule | Prevents `as any` casts | 2h |
| AF-4 | Enforce @rez/shared imports via ESLint | Prevents type drift | 3h |
| AF-5 | Build-time type contract validation | Prevents hardcoded response shapes | 5h |
| AF-6 | Centralize all normalizeOrderStatus to @rez/shared | Eliminates CS-E1 | 4h |
| AF-7 | Replace in-memory PaymentMachine with DB-backed | Eliminates CS-M1, A10-C4 | 6h |
| AF-8 | Add capability scoping to internal tokens | Limits blast radius of compromised tokens | 8h |
| AF-9 | Socket.io cache invalidation pattern | Eliminates CS-E7, A10-C1 | 4h |
| AF-10 | React Query cache key convention enforcement | Prevents RC-7 query key mismatches | 3h |

---

## Phase 5: Testing & Governance (Week 8–10)

| # | Task | Est. |
|---|------|------|
| T-1 | Write integration tests for all financial operations | 16h |
| T-2 | Write e2e tests for socket → cache invalidation | 8h |
| T-3 | Write contract tests for all API endpoints | 12h |
| T-4 | Run arch fitness tests on all repos | 4h |
| T-5 | Verify all CRITICAL fixes with manual testing | 8h |
| T-6 | Update BURN_DOWN_DASHBOARD.md | 2h |
| T-7 | Document all fixes in COMMIT messages | 4h |
| T-8 | Final cross-repo verification | 6h |

---

## Quick Wins (< 1 hour each)

These 27 fixes can be done in under an hour and have high impact:

| ID | Fix | Est. |
|----|-----|------|
| G-KS-C6 | Add length check before TimingSafeEqual | 15m |
| G-KS-C7 | Fix idempotency key collision | 30m |
| A10-L5 | Remove 677 `__DEV__` console statements from bundle | 30m |
| A10-M10 | Fix dashboard double-fetch | 15m |
| A10-M11 | Fix division by zero in analytics | 15m |
| A10-M14 | Fix response.json without content-type | 15m |
| A10-M15 | Fix FlatList index-as-key | 15m |
| A10-M19 | Fix Redis fail-open | 30m |
| A10-L2 | Fix login alert UX | 15m |
| A10-L3 | Fix modal closes before API confirm | 15m |
| A10-L7 | Fix hardcoded en-IN locale | 10m |
| CS-E7 | Fix hardcoded `placed` in socket new order | 15m |
| CS-E8 | Fix lock fee calculation to use totals.lockFeeDiscount | 30m |
| CS-S10 | Validate INTERNAL_SERVICE_TOKEN and INTERNAL_SERVICE_KEY match | 15m |
| CS-M6 | Require orderId in wallet operations | 30m |
| CS-A5 | Fix order status filter to include 'pending' | 15m |
| G-KS-C6 | Add length check before TimingSafeEqual | 15m |
| G-KS-C7 | Fix idempotency key collision | 30m |
| AB-B1 | Fix visit bonus coins never credited | 30m |
| AB-B2 | Remove hardcoded purchase_bonus_pct = 5 | 15m |
| AB-P1 | Fix messages table body vs content mismatch | 30m |
| RZ-A-C3 | Fix API URL mismatch in Rendez admin | 15m |
| RZ-A-C4 | Replace fake health data with real | 15m |
| RZ-M-F1 | Fix gift inbox query key invalidation | 30m |
| RZ-M-F4 | Fix photo removal local-only | 30m |
| RZ-M-S1 | Fix referral code stored but never consumed | 30m |
| RZ-M-E1 | Fix profile.name[0] crash on empty profile | 15m |
| A10-C8 | Fix refund modal #undefined | 15m |

---

## Progress Tracking

After each fix, update:

1. Mark issue as **FIXED** in the gap doc's status table
2. Run `npm run burn-down` to update metrics
3. Verify with arch fitness tests: `scripts/arch-fitness/*.sh`
4. Update CROSS_VERIFICATION_INDEX.txt

---

## Additional Phase Files

| File | Description |
|------|-------------|
| [PHASE2-HIGH.md](PHASE2-HIGH.md) | All HIGH issues with fix details |
| [PHASE3-4-MEDIUM-LOW.md](PHASE3-4-MEDIUM-LOW.md) | MEDIUM + LOW issues + sprint plan |
| [XF-UNIFIED.md](XF-UNIFIED.md) | Cross-repo unified fixes (6 families, ~21h) |

See also: [09-CROSS-SERVICE-2026/XF-1-FIRE-AND-FORGET.md](../09-CROSS-SERVICE-2026/XF-1-FIRE-AND-FORGET.md) for fire-and-forget DLQ detail. **XF-1 is now FIXED** (AdBazaar PR #6).

---

**Last Updated:** 2026-04-17
**Maintainer:** Architect-on-Call (weekly rotation)
**SLA:** All CRITICAL fixed within 1 week, HIGH within 2 weeks
