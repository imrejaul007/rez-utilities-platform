# Gaps: Consumer App LOW Issues — Audit 2026-04-16

**12 LOW Issues — Polish & Cleanup**

---

### NA-LOW-01: `import * as Clipboard` Scattered 18+ Times

**Severity:** LOW
**Files:** `app/flash-sale-success.tsx`, `app/deal-success.tsx`, `app/payment-success.tsx`, `app/share-savings.tsx`, `app/referral/*.tsx`, `app/profile/qr-code.tsx`, and 10+ more
**Category:** Code Quality / Duplication
**Gap ID:** NA-LOW-01
**Status:** ACTIVE

### Description
`expo-clipboard` imported with wildcard syntax in 18+ separate files.

### Fix Direction
Create a `<CopyButton>` or `<CopyableText>` component encapsulating the clipboard logic. Reuse across all screens.

---

### NA-LOW-02: Bare `console.log/warn/error` Throughout Codebase

**Severity:** LOW
**Files:** `app/_layout.tsx`, `app/brands.tsx`, `app/flash-sales/[id].tsx`, `app/search.tsx`, `app/Store.tsx`, and many more
**Category:** Code Quality / Best Practices
**Gap ID:** NA-LOW-02
**Status:** ACTIVE

### Description
Despite the `no-console-log.sh` fitness test, bare `console.*` calls exist without `__DEV__` guards.

### Fix Direction
Run `scripts/arch-fitness/no-console-log.sh` on every PR. Replace with centralized `@/utils/logger`.

---

### NA-LOW-03: Two Incompatible Image Cache Implementations Coexist

**Severity:** LOW
**Files:** `services/imageCacheManager.ts`, `services/imageCacheService.ts`
**Category:** Performance / Duplicate Code
**Gap ID:** NA-LOW-03
**Status:** ACTIVE

### Description
Both cache images with overlapping responsibilities. Images may be cached twice (doubling storage usage).

### Fix Direction
Choose one canonical implementation (prefer `imageCacheService` with TTL/memory/disk tier separation). Remove `imageCacheManager`.

---

### NA-LOW-04: `usePoints.ts` Polling Interval Not Cleaned Up

**Severity:** LOW
**Files:** `hooks/usePoints.ts:51`
**Category:** Memory Leak
**Gap ID:** NA-LOW-04
**Status:** ACTIVE

### Description
`setInterval` for balance polling has no `useEffect` cleanup returning `clearInterval`.

### Fix Direction
Add `return () => clearInterval(pollingIntervalRef.current)` in useEffect.

---

### NA-LOW-05: `window.addEventListener` with No Cleanup in creator-apply.tsx

**Severity:** LOW
**Files:** `app/creator-apply.tsx:70`
**Category:** Memory Leak
**Gap ID:** NA-LOW-05
**Status:** ACTIVE

### Description
`window.addEventListener('focus', onFocus)` has no matching `removeEventListener`.

### Fix Direction
Store listener reference and call `window.removeEventListener('focus', onFocus)` in useEffect cleanup.

---

### NA-LOW-06: Luhn Algorithm Implemented Twice, Differently

**Severity:** LOW
**Files:** `services/paymentService.ts:331`, `services/paymentValidation.ts:55`
**Category:** Code Quality / Duplicate Code
**Gap ID:** NA-LOW-06
**Status:** ACTIVE

### Description
`paymentValidation.ts` has the radix-fix (BUG-035). `paymentService.ts` lacks it.

### Fix Direction
Delete `paymentService.ts`'s Luhn implementation. Call `PaymentValidator.validateCardNumber()` instead.

---

### NA-LOW-07: Duplicate Currency Formatting Logic

**Severity:** LOW
**Files:** `stores/regionStore.ts:362`, `rez-shared/src/utils/currency.ts`
**Category:** Code Quality / Duplicate Code
**Gap ID:** NA-LOW-07
**Status:** ACTIVE

### Description
Two formatters with slightly different output (`"12,500"` vs `"12,500.00"`).

### Fix Direction
Deprecate `regionStore.formatPrice`. Use `rez-shared/src/utils/currency.ts` everywhere.

---

### NA-LOW-08: `isTokenValid()` Always Returns False

**Severity:** LOW
**Files:** `services/authTokenService.ts`
**Category:** Dead Code
**Gap ID:** NA-LOW-08
**Status:** ACTIVE

### Description
`isTokenValid()` method body is empty or returns `false`. All requests bypass it.

### Fix Direction
Implement by decoding the JWT and checking the `exp` claim. Or remove the method entirely.

---

### NA-LOW-09: Luhn Radix Parameter Bug

**Severity:** LOW
**Files:** `services/paymentService.ts:331-346`
**Category:** Code Quality
**Gap ID:** NA-LOW-09
**Status:** ACTIVE (BUG-035 fix not applied in paymentService)

### Description
Luhn implementation uses `parseInt(number[i])` without radix. Should be `parseInt(number[i], 10)`.

### Fix Direction
Add `, 10` radix parameter.

---

### NA-LOW-10: `CoinTogglesSection` No Debounce on Slider

**Severity:** LOW
**Files:** `hooks/useCheckoutUI.ts` from `app/checkout.tsx`
**Category:** Performance
**Gap ID:** NA-LOW-10
**Status:** ACTIVE

### Description
`onCoinToggle` fires on every slider drag event, triggering recalculation each time.

### Fix Direction
Add `useDebounce` wrapper to the coin toggle handler.

---

### NA-LOW-11: Duplicate Currency Formatting — Two Different Outputs

**Severity:** LOW
**Files:** `stores/regionStore.ts`, `rez-shared/src/utils/currency.ts`
**Category:** Architecture / Inconsistency
**Gap ID:** NA-LOW-11
**Status:** ACTIVE

### Description
Same amount displays as `"12,500"` in one place and `"12,500.00"` in another.

### Fix Direction
Standardize on one formatter across the codebase.

---

### NA-LOW-12: `usePoints` Interval Cleanup Missing

**Severity:** LOW
**Files:** `hooks/usePoints.ts`
**Category:** Memory Leak
**Gap ID:** NA-LOW-12
**Status:** ACTIVE

### Description
`setInterval` created without corresponding `clearInterval` in cleanup.

### Fix Direction
Add cleanup in useEffect return.

---

## Status Table

| ID | Status | Fix Priority | Owner |
|----|--------|-------------|-------|
| NA-LOW-01 | ACTIVE | P4 | ? |
| NA-LOW-02 | ACTIVE | P4 | ? |
| NA-LOW-03 | ACTIVE | P4 | ? |
| NA-LOW-04 | **FIXED** | — | 2026-04-17 |
| NA-LOW-05 | **FIXED** | — | 2026-04-17 |
| NA-LOW-06 | ACTIVE | P4 | ? |
| NA-LOW-07 | ACTIVE | P4 | ? |
| NA-LOW-08 | ACTIVE | P4 | ? |
| NA-LOW-09 | **FIXED** | — | 2026-04-17 |
| NA-LOW-10 | ACTIVE | P4 | ? |
| NA-LOW-11 | ACTIVE | P4 | ? |
| NA-LOW-12 | **FIXED** | — | 2026-04-17 |
