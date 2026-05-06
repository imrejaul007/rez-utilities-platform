# Gaps: Systemic Root Diseases — Audit 2026-04-16

**6 root diseases causing 40+ of the ~69 issues**

These are not individual bugs — they are the **architectural diseases** that generate bugs. Fix the roots.

---

## SYS-ROOT-01: rez-now Completely Disconnected from Shared Types

**Root Disease:** rez-now defines ALL types locally. Zero imports from `@karim4987498/shared`.

**Symptoms Caused:**
- XREP-01: `WalletBalance` 3 different shapes
- XREP-02: `WebOrderStatus` vs `OrderStatus` (6 vs 15 values)
- XREP-04: 0 shared imports, 16 duplicate types
- XREP-06: `PaymentStatusResult` vs `PaymentStatus`
- XREP-14: `WalletTransaction.type` simplified vs rich

**Bugs Generated:** 5+ high/critical gaps

**Fix:** Add `@karim4987498/shared` to rez-now's `package.json`. Replace local type definitions with imports.

---

## SYS-ROOT-02: No Canonical Coin Calculation Source

**Root Disease:** Coin/cashback calculations exist in 4+ locations with different formulas.

**Symptoms Caused:**
- NA-HIGH-01: Coin formula off by factor of 10 (rez-now checkout)
- NA-HIGH-02: rewardsPreview 50% inaccurate (usePaymentFlow)
- NA-HIGH-07: Floating-point truncation on redemption
- NA-HIGH-08: Hardcoded day reward values
- NA-HIGH-13: Duplicate calculation logic in 4+ places
- NA-HIGH-14: 56 `any` types in stores

**Bugs Generated:** 6+ high/critical gaps

**Fix:** Create `coinCalculationService` in `rez-shared` with canonical formulas. All consumers import from one place.

---

## SYS-ROOT-03: Client Trusts Itself for Security

**Root Disease:** Client-side enforcement of server-side rules. Bill amount, fraud checks, and amount validation are all computed client-side.

**Symptoms Caused:**
- NA-CRIT-02: Client-controlled bill amount — fraud vector
- NA-HIGH-19: MD5 for image integrity (broken crypto)
- NA-HIGH-20: IDOR on bill/transaction access
- NA-HIGH-22: Client-side fraud detection fail-open
- NA-HIGH-23: Device fingerprint tamperable
- NA-MED-21: Perceptual hash unreachable

**Bugs Generated:** 6+ high/critical gaps

**Fix:** All security decisions must be server-authoritative. Client can pre-filter for UX but never be the enforcement point.

---

## SYS-ROOT-04: Dual Zustand + Context Pattern Causing Data Drift

**Root Disease:** Zustand store (with noop defaults) + Context provider (with real implementation). No single source of truth.

**Symptoms Caused:**
- NA-HIGH-12: Wallet store + context conflicting data sources
- NA-HIGH-15: hotelOtaApi bypasses all infrastructure
- NA-MED-04: RealTimeService and SocketContext disconnected
- NA-MED-16: Default timeout 30s (not centralized)
- NA-MED-17: Missing haptic feedback (inconsistent)
- G-KU-H1: KarmaProfile diverges from canonical

**Bugs Generated:** 6+ gaps

**Fix:** Consolidate to ONE source per data type. Either Zustand with real API calls, or Context with Zustand selectors. Never both.

---

## SYS-ROOT-05: No Circuit Breaker, No Timeout Discipline

**Root Disease:** 17+ services, zero circuit breakers, inconsistent timeout configuration.

**Symptoms Caused:**
- NA-HIGH-15: hotelOtaApi has no timeout, no retry
- NA-MED-15: No circuit breaker on any service
- NA-MED-16: Default timeout 30s (too slow for mobile)
- NA-MED-01: Socket reconnection silently drops events
- NA-CRIT-08: Payment polling never terminates (90s timeout)

**Bugs Generated:** 5+ gaps

**Fix:** Centralize timeout in `apiClient.ts`. Implement per-service circuit breaker (3 fails → 60s fast-fail).

---

## SYS-ROOT-06: Enum/Type Fragmentation Across Services

**Root Disease:** Same enum defined in multiple places with different values. No canonical source.

**Symptoms Caused:**
- XREP-03: Two conflicting `normalizeLoyaltyTier` behaviors
- XREP-07: karma credits 'rez', queries 'karma_points'
- XREP-09: Payment status 'completed' vs 'paid'
- XREP-10: AddressType 'HOME' vs 'home'
- XREP-12: CoinType 'branded_coin' vs 'branded'
- XREP-15: BookingStatus 4 vs 9 values
- NA-HIGH-11: Duplicate service pairs (migration abandoned)

**Bugs Generated:** 7+ gaps

**Fix:** Extract all shared enums to `rez-shared/enums/`. Publish as npm package. All services import from one place. Add lint rule to prevent local enum definitions for shared types.

---

## Impact Summary

| Root Disease | Gaps Caused | Est Fix Hours |
|-------------|-------------|--------------|
| SYS-ROOT-01: rez-now disconnected | 5+ | 8h |
| SYS-ROOT-02: No canonical coin calc | 6+ | 4h |
| SYS-ROOT-03: Client trusts itself | 6+ | 12h |
| SYS-ROOT-04: Dual store+context | 6+ | 16h |
| SYS-ROOT-05: No circuit breaker | 5+ | 8h |
| SYS-ROOT-06: Enum fragmentation | 7+ | 6h |

**Total systemic fix: ~54 hours** — resolves 35+ of 69 issues
