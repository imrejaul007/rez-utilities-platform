# Cross-Repo Issues — Bugs That Exist in Multiple Repos

**Purpose:** One fix resolves N instances. These are the highest-leverage bugs.

---

## Same Bug, Multiple Repos

| Pattern | Repos | Count | Fix | Instances |
|---------|-------|-------|-----|-----------|
| No idempotency on financial mutations | wallet, admin, payment | 5 | Add idempotency keys | CS-M1, CS-M4, CS-M6, A10-H12, A10-C4 |
| Three normalizeOrderStatus implementations | all surfaces | 100+ | Merge to @rez/shared | CS-E1, A10-H6 |
| Inconsistent stale times | admin, consumer | 8 | Define canonical in shared | A10-H1 |
| Hardcoded colors | admin (3 systems) | 3 | Use DesignTokens from shared | A10-C7 |
| Duplicate service files | admin | 82 | Create shared service layer | A10-H15 |
| Timing attack in HMAC | order-service, gateway | 2 | Use crypto.timingSafeEqual | CS-S11 | **FIXED** (already in code) |
| Redis fail-open | order-service, marketing | 3 | Always deny on Redis fail | CS-S3, A10-M19 | **FIXED** (already in code) |
| Missing role guards | admin, merchant | 6 | Add role middleware | A10-H10 |
| Same response unwrapping pattern | admin, consumer | 100+ | Standardize response format | A10-H17 |
| Type drift: KarmaProfile | consumer, shared | 2 | Import from shared | CS-T1, G-KU-C3 |
| Type drift: KarmaEvent | consumer, shared | 2 | Import from shared | CS-T2 |
| Payment status colors missing states | admin, consumer, merchant | 3 | Add missing states | CS-E2, A10-H5 |
| Same `VoucherBrand` type defined 3x | admin | 3 | Define canonical in shared | A10-C2 |
| `CoinDrop.storeId` type mismatch | admin (2 screens) | 2 | Unify to string | CS-A2, A10-H2 |
| HMAC key from env var NAME | order-service, gateway | 4 | Use env var VALUE | CS-S1, A10-C5 | **FIXED** (already in code) |
| Same `DoubleCashbackCampaign` defined 2x | admin | 2 | Define canonical in shared | CS-T5, A10-H3 |
| JWT alg:none not mitigated | gateway, admin | 2 | Add algorithm whitelist | CS-S2, A10-H9 | **FIXED** (already in code) |
| `requireMerchant` CSRF bypass | gateway | 1 | Add CSRF token check | CS-S6 | **FIXED** — PR #108 (rez-backend) |
| Consumer uses `completed` not `delivered` | consumer, admin | 5+ | Replace with canonical | CS-E5, CS-E9, A10-H14 |
| LocalStorage XSS | admin | 1 | Sanitize before render | A10-M2 |

---

## One Fix Resolves Many

### Fix 1: Centralize normalizeOrderStatus → eliminates 100+ status rendering bugs
**Fixes:** CS-E1, A10-H6, CS-E3, CS-E4, CS-E5, CS-E7, CS-E9, and all consumer/admin/merchant status rendering issues

### Fix 2: HMAC key uses env var VALUE → fixes 4 unauthenticated endpoints
**Fixes:** CS-S1 (order-service), CS-S1 (payment-service), CS-S1 (wallet-service), A10-C5

### Fix 3: JWT verify with algorithm whitelist → fixes token forgery on 5+ services
**Fixes:** CS-S2, A10-H9

### Fix 4: Import IKarmaProfile/IKarmaEvent from shared → eliminates 2 runtime crashes
**Fixes:** CS-T1, CS-T2, G-KU-C3

### Fix 5: Define VoucherBrand in shared → eliminates 3 runtime crashes
**Fixes:** A10-C2, CS-A1

### Fix 6: PaymentMachine DB-backed → eliminates 2 double-credit vulnerabilities
**Fixes:** CS-M1, A10-C4

### Fix 7: Add idempotency keys to wallet mutations → eliminates 4 financial race conditions
**Fixes:** CS-M1, CS-M4, CS-M6, A10-H12

### Fix 8: Redis always denies → eliminates 3 unauthorized access vulnerabilities
**Fixes:** CS-S3, A10-M19

### Fix 9: Shared normalizePaymentStatus → eliminates payment status gray screens
**Fixes:** CS-E2, CS-E6, A10-H5

### Fix 10: Socket invalidates React Query cache → eliminates stale data bugs
**Fixes:** A10-C1, CS-E7, RZ-M-F1

---

## Duplicate Type Definitions

These types are defined identically in multiple places without sharing a source:

| Type | Location A | Location B | Impact |
|------|-----------|-----------|--------|
| `VoucherBrand` | `services/api/vouchers.ts` | `services/api/cashStore.ts` | Runtime crash when passing between screens |
| `CoinDrop` | `services/api/extraRewards.ts` | `services/api/cashStore.ts` | Type mismatch on storeId |
| `DoubleCashbackCampaign` | `services/api/extraRewards.ts` | `services/api/cashStore.ts` | Validation mismatch |
| `KarmaProfile` | `services/karmaService.ts` (consumer) | `packages/shared-types/karma.ts` | Runtime crash |
| `KarmaEvent` | `services/karmaService.ts` (consumer) | `packages/shared-types/karma.ts` | Wrong rendering |
| `normalizeOrderStatus` | `constants/orderStatuses.ts` | `types/index.ts` | Inconsistent normalization |
| `AdminUser` | `AuthContext.tsx` | `storage.ts` | Type mismatch |
| `Colors` | `DesignTokens.ts` | `Colors.ts` | Conflicting values |

---

## Root Cause → Multiple Bug Pattern

| Root Cause | Bugs It Produces | Count |
|-----------|-----------------|-------|
| RC-1: No single source of truth | All enum/type duplication bugs | 30+ |
| RC-3: Fire-and-forget financial ops | Double-credit, no idempotency bugs | 15+ |
| RC-5: `as any` everywhere | Hardcoded response shape crashes | 100+ |
| RC-7: Query key mismatch | Cache never invalidates | 10+ |
| RC-17: Hardcoded response shapes | `.id` vs `._id`, missing fields | 20+ |
| RC-18: Three normalizeOrderStatus | Status renders differently across surfaces | 100+ |
| RC-20: Type drift | Runtime crashes when backend returns canonical | 10+ |
