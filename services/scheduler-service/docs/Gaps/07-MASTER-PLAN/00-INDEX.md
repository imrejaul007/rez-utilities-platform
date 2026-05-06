# MASTER FIX PLAN — ALL CODEBASES

> **⚠️ DEPRECATED — Use [../08-MASTER-PLAN/00-INDEX.md](../08-MASTER-PLAN/00-INDEX.md) for the latest unified fix plan.**
> This version is superseded by 08-MASTER-PLAN which includes Gen 10 Admin App, Gen 11 Consumer App, and updated cross-service analysis.

**Date:** 2026-04-16
**Scope:** All codebases — ReZ consumer/merchant/admin + backend + Karma + Rendez

---

## All CRITICAL Issues — Priority Order

### Phase 0 — Prerequisites (Do First)

Before any fix PR, restore CI/build across ALL codebases:

| P0 | Task | Command |
|----|------|---------|
| P0-A | `tsc --noEmit` green across all repos | Each repo has `npm run type-check` |
| P0-B | ESLint clean | `npm run lint` |
| P0-C | Build succeeds | `npm run build` |
| P0-D | Tests pass | `npm test` |
| P0-E | Wire Sentry + telemetry | On every service |

---

### Phase 1 — Rendez App (Gen 9)

#### Phase 1A — Admin Dashboard (Fix Today)

| Priority | ID | Issue | Fix |
|----------|----|-------|-----|
| 1 | RZ-A-C1 | ALL API calls missing Authorization header | Add `Authorization: Bearer` to every fetch |
| 2 | RZ-A-C2 | No middleware.ts | Create Next.js middleware with HttpOnly cookie |
| 3 | RZ-A-C3 | API URL mismatch across pages | Create shared `src/lib/api.ts` |
| 4 | RZ-A-C4 | System health hardcoded | Add real backend health endpoint + fetch |

#### Phase 1B — Rendez Backend (Fix This Week)

| Priority | ID | Issue | Fix |
|----------|----|-------|-----|
| 1 | RZ-B-C2 | Payment webhook race condition — double reward | Atomic check-and-update in transaction |
| 2 | RZ-B-C1 | Gift voucher authorization bypass | Verify caller owns the gift |
| 3 | RZ-B-C3 | Query param cast to `any` | Validation helper for enums |
| 4 | RZ-B-H3 | Reward trigger fire-and-forget | BullMQ job with retries |
| 5 | RZ-B-H4 | Redis lock expires mid-process | Lock renewal / DB lock |

#### Phase 1C — Rendez Mobile App (Fix This Week)

| Priority | ID | Issue | Fix |
|----------|----|-------|-----|
| 1 | RZ-M-S1 | Referral code never consumed | Wire `pending_referral_code` to profile creation |
| 2 | RZ-M-F1 | Gift inbox never refreshes | Fix query key invalidation |
| 3 | RZ-M-F4 | Photo deletion never syncs | Wire `deletePhoto` API call |
| 4 | RZ-M-F3 | Like stale closure | Use `queryClient.getQueryData` |
| 5 | RZ-M-E1 | Empty profile name crash | Guard `profile.name?.[0]` |
| 6 | RZ-M-P1 | No balance check before gift send | Fetch balance first |
| 7 | RZ-M-B1 | Age NaN sent to backend | Numeric-only filter on age input |

---

### Phase 2 — Karma Service (Gen 8)

| Priority | ID | Issue | Fix |
|----------|----|-------|-----|
| 1 | G-KS-C1 | Hardcoded default QR secret | Validate `QR_SECRET` at startup |
| 2 | G-KS-C2 | Auth middleware no validation | Validate auth response shape |
| 3 | G-KS-C3 | jwtSecret unvalidated | Add to startup validation |
| 4 | G-KS-C4 | Privilege escalation on profile routes | Ownership check on all routes |
| 5 | G-KS-C5 | Batch stats unauthenticated | Add `requireAdminAuth` |
| 6 | G-KS-C6 | TimingSafeEqual throws on length mismatch | Check length first |
| 7 | G-KS-C7 | Idempotency key collision | Remove UUID suffix |
| 8 | G-KS-C8 | String vs ObjectId ownership bypass | Convert before comparison |
| 9 | G-KS-C9 | Admin role case-sensitive | Normalize role to lowercase |

---

### Phase 3 — ReZ Gen 1–7 CRITICAL Issues

See [docs/Bugs/00-INDEX.md](../../Bugs/00-INDEX.md) for all 78 CRITICAL bugs from Audits 1–7.

Top priority (money/security):

| Priority | ID | Issue | Impact |
|----------|----|-------|--------|
| 1 | C9 | Coin credit fire-and-forget — no retry/DLQ | User loses coins |
| 2 | C10 | Merchant double-payout race | Financial loss |
| 3 | CS-C1 | BullMQ double-consume on 5 queues | ~50% events lost |
| 4 | CS-C5 | Payment coin credit silent failure | Coins permanently lost |
| 5 | AS2-C1 | Raw JWTs in Redis | Token exposure |
| 6 | SD-03 | Idempotency key non-unique | Double credits |
| 7 | BL-C1 | All push notifications are stubs | No user notifications |
| 8 | BL-C2 | Dual Razorpay webhooks | Missing cancellations |

---

## All HIGH Issues — Priority Order

### Rendez App

| Priority | ID | Issue | Location |
|----------|----|-------|----------|
| 1 | RZ-M-F2 | Gift send doesn't invalidate wallet | `GiftPickerScreen.tsx` |
| 2 | RZ-M-F5 | Confirm modal dismisses before mutation | `GiftPickerScreen.tsx` |
| 3 | RZ-M-D1 | Query key mismatch (same as RZ-M-F1) | `GiftInboxScreen.tsx` |
| 4 | RZ-M-A2 | Experience credit invalidation | `CreatePlanScreen.tsx` |
| 5 | RZ-M-E2 | Age input non-numeric paste | `ProfileSetupScreen.tsx` |
| 6 | RZ-M-X1 | deletePhoto API never called | `api.ts` |
| 7 | RZ-A-H7 | Every fetch silent failure | All pages |
| 8 | RZ-A-H5 | No user pagination | `users/page.tsx` |
| 9 | RZ-A-H2 | Frontend/backend count mismatch | `meetups/page.tsx` |
| 10 | RZ-A-H1 | applicantCount undefined | `plans/page.tsx` |
| 11 | RZ-B-H1 | HMAC recomputed inline | `experienceCredits.ts` |
| 12 | RZ-B-H2 | 7 plan routes missing ID validation | `plans.ts` |
| 13 | RZ-B-H5 | Gift expired always returns success | `webhooks/rez.ts` |
| 14 | RZ-B-H6 | REZ API after DB commit | `GiftService.ts` |
| 15 | RZ-B-H7 | Unnecessary type cast | `auth.ts` |

### Karma Service

| Priority | ID | Issue | Location |
|----------|----|-------|----------|
| 1 | G-KS-C7 | Idempotency key collision | `earnRecordService.ts` |
| 2 | G-KS-C8 | String vs ObjectId bypass | `verifyRoutes.ts` |
| 3 | G-KS-C9 | Admin role case-sensitive | `adminAuth.ts` |

### Karma UI

| Priority | ID | Issue | Location |
|----------|----|-------|----------|
| 1 | G-KU-F1 | totalHours not in type | `event/[id].tsx:350` |
| 2 | G-KU-F2 | Fragile check-in logic | `event/[id].tsx:176` |
| 3 | G-KU-F3 | KarmaEvent type divergence | `karmaService.ts:43` |
| 4 | G-KU-H1 | KarmaProfile divergence | Multiple files |
| 5 | G-KU-H2 | CoinType mismatch | Multiple files |
| 6 | G-KU-H3 | No rapid-scan debounce | Scan screen |
| 7 | G-KU-H4 | eventId stale on navigation | Multiple files |

---

## Medium Issues

See individual gap files for the full list of MEDIUM issues per codebase. Priority within MEDIUM:

1. **Performance** — N+1 queries, missing pagination, memory loads
2. **Data & Sync** — Redis as only source of truth, cache invalidation issues
3. **Functional** — Silent failures, empty catch blocks
4. **Architecture** — Duplicate code, inconsistent patterns

---

## Cross-Repo Issues (Fix Once, Affects Multiple)

These bugs span multiple codebases and should be fixed in a shared location:

| # | Issue | Shared Fix Location |
|---|-------|---------------------|
| CR-1 | Query key factories missing across all TanStack Query apps | Create `src/utils/queryKeys.ts` |
| CR-2 | API client not shared — auth headers not injected | Create `src/lib/apiClient.ts` |
| CR-3 | Enum validation inconsistent | Use Zod in all route handlers |
| CR-4 | No `expo-secure-store` TTL — token never expires | Add token refresh flow |
| CR-5 | TanStack Query installed but unused (Rendez admin) | Initialize `QueryClientProvider` |
| CR-6 | Color tokens hardcoded in 60+ screens | Create shared design tokens |
| CR-7 | No shared API contract types | Create `src/types/api.ts` |
| CR-8 | Socket.IO reconnection pattern inconsistent | Create shared `useRealtime` hook |

---

## How to Execute Fixes

1. **Pick a phase** above based on severity
2. **Read the specific gap doc** for exact file:line and fix code
3. **Check if it's a cross-repo issue** — fix in shared location first
4. **Write a failing test** before the fix (where applicable)
5. **Fix and verify** — run `tsc --noEmit` and `npm test`
6. **Mark as fixed** in the gap doc's status table
7. **Update burn-down** in `docs/BURN_DOWN_DASHBOARD.md`
