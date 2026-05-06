# Quick Wins — Fixes Under 1 Hour Each

**24 quick fixes across 69 total issues. Each takes 10 minutes to 1 hour.**

---

## CRITICAL Quick Wins

### QW-CRIT-01: Fix Payment Method Cards — Zero `onPress` Handlers

**Gap:** NA-CRIT-01
**Severity:** CRITICAL
**Est Fix:** 30 minutes
**Files:** `app/payment-methods.tsx`, `app/payment.tsx`
**Priority:** P0

The payment method cards render but do nothing when tapped. Add `onPress` handlers or replace with a `<Pressable>` wrapper that navigates or calls the payment flow.

---

### QW-CRIT-02: Fix `showToast` Import in Checkout

**Gap:** NA-CRIT-06
**Severity:** CRITICAL
**Est Fix:** 5 minutes
**File:** `app/checkout.tsx`
**Priority:** P0

```typescript
// MISSING — add this import:
import { showToast } from '@/components/ui/toast';
```

---

### QW-CRIT-03: Fix Payment Polling Terminal State

**Gap:** NA-CRIT-08, XREP-09
**Severity:** CRITICAL
**Est Fix:** 10 minutes
**File:** `services/paymentService.ts:243`
**Priority:** P0

The polling loop checks for `'completed'` but the backend returns `'paid'` as terminal success.

```typescript
// CURRENT (broken):
if (['completed', 'failed', 'cancelled'].includes(status)) {

// FIX:
if (['paid', 'completed', 'failed', 'cancelled'].includes(status)) {
```

---

### QW-CRIT-04: Remove Git Merge Conflict Markers

**Gap:** NA-MED-11
**Severity:** MEDIUM → P1 for build
**Est Fix:** 15 minutes
**File:** `rez-karma-service/src/routes/karmaRoutes.ts:98-110`
**Priority:** P1

```typescript
// REMOVE these lines entirely:
<<<<<<< HEAD
=======
>>>>>>> origin/main

// REPLACE with merged logic:
let limit = parseInt(String(req.query.limit ?? '20'), 10);
if (isNaN(limit) || limit < 1) limit = 20;
if (limit > 100) limit = 100;
```

---

### QW-CRIT-05: Replace `Math.random()` with UUID

**Gap:** NA-CRIT-09
**Severity:** CRITICAL
**Est Fix:** 15 minutes
**File:** `services/offlineSyncService.ts:436`
**Priority:** P0

```typescript
// CURRENT:
dedupKey: `${event}_${userId}_${Date.now()}_${Math.random()}`

// FIX:
import { v4 as uuidv4 } from 'uuid';
dedupKey: `${event}_${userId}_${Date.now()}_${uuidv4()}`
```

---

## HIGH Quick Wins

### QW-HIGH-01: Fix Coin Formula Double-Division

**Gap:** NA-HIGH-01
**Severity:** HIGH
**Est Fix:** 10 minutes
**File:** `rez-now/app/[storeSlug]/pay/checkout/page.tsx:126`
**Priority:** P1

```typescript
// CURRENT (buggy):
Math.floor((effectiveAmount / 100 / 10) * ((baseCashbackPercent || 0) / 100))

// FIX:
Math.floor((effectiveAmount / 100) * ((baseCashbackPercent || 0) / 100))
```

---

### QW-HIGH-02: Align karma Credits and Queries Coin Type

**Gap:** NA-HIGH-03, XREP-07
**Severity:** HIGH
**Est Fix:** 30 minutes
**File:** `rez-karma-service/src/services/walletIntegration.ts`
**Priority:** P1

`creditUserWallet()` uses `coinType: 'rez'`. `getKarmaBalance()` queries `coinType: 'karma_points'`. Align both to use the same value. Check the wallet service's canonical `CoinType` enum first.

---

### QW-HIGH-03: Prevent Negative Wallet Balance

**Gap:** NA-HIGH-04
**Severity:** HIGH
**Est Fix:** 15 minutes
**File:** `stores/walletStore.ts:70-88`
**Priority:** P1

```typescript
// CURRENT:
totalBalance += delta;

// FIX:
totalBalance = Math.max(0, totalBalance + delta);
```

---

### QW-HIGH-04: Fix Dedup Key Collision Window

**Gap:** NA-HIGH-05
**Severity:** HIGH
**Est Fix:** 30 minutes
**Files:** `rez-wallet-service/src/services/walletService.ts`, `rez-gamification-service/src/httpServer.ts`
**Priority:** P1

```typescript
// CURRENT (1-second resolution):
Math.floor(Date.now() / 1000)

// FIX (millisecond resolution):
Date.now()
```

---

### QW-HIGH-05: Create Missing `utils/apiUtils.ts`

**Gap:** NA-HIGH-10
**Severity:** HIGH
**Est Fix:** 1 hour
**Files:** `services/authApi.ts`, `services/cartApi.ts`, `services/offersApi.ts`, `services/wishlistApi.ts`, `services/profileApi.ts`, `services/productApi.ts`, `services/homepageApi.ts`
**Priority:** P1

Create the file with stub implementations:

```typescript
// utils/apiUtils.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3
): Promise<T> { /* ... */ }

export function createErrorResponse(message: string, code: string) { /* ... */ }

export function logApiRequest(endpoint: string, params: unknown) { /* ... */ }
export function logApiResponse(endpoint: string, response: unknown) { /* ... */ }
```

Then implement each fully and wire into existing `logger.ts`/`errorReporter.ts`.

---

### QW-HIGH-06: Fix Store Visit Queue Button State

**Gap:** NA-HIGH-18
**Severity:** HIGH
**Est Fix:** 1 hour
**File:** `app/store-visit.tsx`
**Priority:** P1

```typescript
// CURRENT (button stays disabled after queue assigned):
disabled={gettingQueue || !!queueNumber}

// FIX (separate loading from result):
disabled={gettingQueue}

// Also: ensure paymentMethod preference is sent in API payload
```

---

### QW-HIGH-07: Remove Duplicate `startOfWeek` Declaration

**Gap:** NA-MED-12
**Severity:** MEDIUM
**Est Fix:** 5 minutes
**File:** `rez-karma-service/src/services/karmaService.ts:128`
**Priority:** P1

Remove line 128. Keep line 195.

---

### QW-HIGH-08: Use ISO Week Consistently

**Gap:** XREP-05, NA-MED-13
**Severity:** MEDIUM
**Est Fix:** 15 minutes
**Files:** `rez-karma-service/src/services/karmaService.ts:128`, `rez-karma-service/src/services/batchService.ts:577`
**Priority:** P1

```typescript
// Replace:
moment().startOf('week')    // locale-dependent

// With:
moment().startOf('isoWeek') // always Monday
```

---

### QW-HIGH-09: Fix Floating-Point Truncation on Redemption

**Gap:** NA-HIGH-07
**Severity:** HIGH
**Est Fix:** 1 hour
**File:** `app/bill-payment.tsx`
**Priority:** P1

```typescript
// CURRENT (floating-point truncation):
Math.floor((fetchedBill.amount * (selectedProvider.maxRedemptionPercent / 100)))

// FIX (integer arithmetic):
Math.round((fetchedBill.amountInPaise * selectedProvider.maxRedemptionPercent) / 100)
```

---

### QW-HIGH-10: Add Haptic Feedback to Success Screens

**Gap:** NA-MED-17
**Severity:** MEDIUM
**Est Fix:** 30 minutes
**Files:** `app/flash-sale-success.tsx`, `app/deal-success.tsx`
**Priority:** P2

```typescript
import * as Haptics from 'expo-haptics';
// Add in useEffect or on success:
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
```

---

## MEDIUM Quick Wins

### QW-MED-01: Add `clearInterval` Cleanup to `usePoints.ts`

**Gap:** NA-LOW-04, NA-LOW-12
**Severity:** LOW
**Est Fix:** 10 minutes
**File:** `hooks/usePoints.ts:51`
**Priority:** P2

```typescript
useEffect(() => {
  const interval = setInterval(/* ... */);
  return () => clearInterval(interval);
}, []);
```

---

### QW-MED-02: Add `removeEventListener` Cleanup to `creator-apply.tsx`

**Gap:** NA-LOW-05
**Severity:** LOW
**Est Fix:** 10 minutes
**File:** `app/creator-apply.tsx:70`
**Priority:** P2

```typescript
useEffect(() => {
  const handler = () => {/* ... */};
  window.addEventListener('focus', handler);
  return () => window.removeEventListener('focus', handler);
}, []);
```

---

### QW-MED-03: Fix Luhn Radix Parameter in `paymentService.ts`

**Gap:** NA-LOW-09
**Severity:** LOW
**Est Fix:** 5 minutes
**File:** `services/paymentService.ts:331-346`
**Priority:** P2

```typescript
// CURRENT:
parseInt(number[i])

// FIX:
parseInt(number[i], 10)
```

---

### QW-MED-04: AddressType to Lowercase

**Gap:** NA-MED-07, XREP-10
**Severity:** MEDIUM
**Est Fix:** 15 minutes
**Files:** `services/addressApi.ts:6-10`
**Priority:** P2

```typescript
// CURRENT:
enum AddressType { HOME = 'HOME', WORK = 'WORK', OTHER = 'OTHER' }

// FIX:
enum AddressType { HOME = 'home', WORK = 'work', OTHER = 'other' }

// Also add normalization in API submission layer
```

---

### QW-MED-05: `isTokenValid()` Dead Code

**Gap:** NA-LOW-08
**Severity:** LOW
**Est Fix:** 20 minutes
**File:** `services/authTokenService.ts`
**Priority:** P2

Either implement properly (decode JWT, check `exp` claim) or remove the method entirely.

---

### QW-MED-06: Add Coin Slider Debounce

**Gap:** NA-MED-19, NA-LOW-10
**Severity:** MEDIUM
**Est Fix:** 30 minutes
**Files:** `hooks/useCheckoutUI.ts`
**Priority:** P2

```typescript
// Wrap onCoinToggle with debounce:
const debouncedCoinToggle = useDebouncedCallback(
  (amount) => handleCoinToggle(amount),
  300
);
```

---

## LOW Quick Wins

### QW-LOW-01: Add Coin Slider Debounce to `CoinTogglesSection`

**Gap:** NA-LOW-10
**Severity:** LOW
**Est Fix:** 30 minutes
**File:** `hooks/useCheckoutUI.ts`
**Priority:** P3

Add `useDebounce` wrapper to the coin toggle handler.

---

### QW-LOW-02: Remove Duplicate Luhn in `paymentService.ts`

**Gap:** NA-LOW-06
**Severity:** LOW
**Est Fix:** 15 minutes
**Files:** `services/paymentService.ts:331`, `services/paymentValidation.ts:55`
**Priority:** P3

Delete `paymentService.ts`'s Luhn implementation. Call `PaymentValidator.validateCardNumber()` instead.

---

### QW-LOW-03: Standardize Currency Formatter

**Gap:** NA-LOW-07, NA-LOW-11
**Severity:** LOW
**Est Fix:** 30 minutes
**Files:** `stores/regionStore.ts`, `rez-shared/src/utils/currency.ts`
**Priority:** P3

Deprecate `regionStore.formatPrice`. Use `rez-shared/src/utils/currency.ts` everywhere.

---

### QW-LOW-04: Create `<CopyButton>` Component

**Gap:** NA-LOW-01
**Severity:** LOW
**Est Fix:** 1 hour
**Files:** 18+ files with `import * as Clipboard`
**Priority:** P3

Create `components/CopyButton.tsx` and `components/CopyableText.tsx` encapsulating clipboard logic. Replace all scattered imports.

---

## Quick Wins Summary Table

| ID | Gap(s) | Fix | Est Time | Priority |
|----|--------|-----|---------|---------|
| QW-CRIT-01 | NA-CRIT-01 | Add onPress to payment cards | 30m | P0 |
| QW-CRIT-02 | NA-CRIT-06 | Import showToast in checkout | 5m | P0 |
| QW-CRIT-03 | NA-CRIT-08, XREP-09 | Add 'paid' to terminal states | 10m | P0 |
| QW-CRIT-04 | NA-MED-11 | Remove merge conflict markers | 15m | P1 |
| QW-CRIT-05 | NA-CRIT-09 | Replace Math.random with uuid | 15m | P0 |
| QW-HIGH-01 | NA-HIGH-01 | Remove double-division in coin formula | 10m | P1 |
| QW-HIGH-02 | NA-HIGH-03, XREP-07 | Align karma coinType across functions | 30m | P1 |
| QW-HIGH-03 | NA-HIGH-04 | Add Math.max(0) guard on balance | 15m | P1 |
| QW-HIGH-04 | NA-HIGH-05 | Use ms resolution for dedup key | 30m | P1 |
| QW-HIGH-05 | NA-HIGH-10 | Create missing apiUtils.ts | 1h | P1 |
| QW-HIGH-06 | NA-HIGH-18 | Fix queue button disabled state | 1h | P1 |
| QW-HIGH-07 | NA-MED-12 | Remove duplicate startOfWeek | 5m | P1 |
| QW-HIGH-08 | XREP-05, NA-MED-13 | Use isoWeek everywhere | 15m | P1 |
| QW-HIGH-09 | NA-HIGH-07 | Integer arithmetic on redemption | 1h | P1 |
| QW-HIGH-10 | NA-MED-17 | Add haptics to success screens | 30m | P2 |
| QW-MED-01 | NA-LOW-04, NA-LOW-12 | Add clearInterval cleanup | 10m | P2 |
| QW-MED-02 | NA-LOW-05 | Add removeEventListener cleanup | 10m | P2 |
| QW-MED-03 | NA-LOW-09 | Add radix to Luhn parseInt | 5m | P2 |
| QW-MED-04 | NA-MED-07, XREP-10 | Lowercase AddressType | 15m | P2 |
| QW-MED-05 | NA-LOW-08 | Implement or remove isTokenValid | 20m | P2 |
| QW-MED-06 | NA-MED-19, NA-LOW-10 | Debounce coin slider | 30m | P2 |
| QW-LOW-01 | NA-LOW-10 | Debounce CoinTogglesSection | 30m | P3 |
| QW-LOW-02 | NA-LOW-06 | Delete duplicate Luhn impl | 15m | P3 |
| QW-LOW-03 | NA-LOW-07, NA-LOW-11 | Standardize currency formatter | 30m | P3 |
| QW-LOW-04 | NA-LOW-01 | Create CopyButton component | 1h | P3 |

**Total: 26 quick wins, ~9.5 hours total estimated time**
