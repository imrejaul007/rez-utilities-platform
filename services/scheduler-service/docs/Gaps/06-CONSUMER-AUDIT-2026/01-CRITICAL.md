# Gaps: Consumer App CRITICAL Issues — Audit 2026-04-16

**11 CRITICAL Issues — Fix immediately**

---

## NA-CRIT-01: Payment Method Cards Completely Non-Interactive

**Severity:** CRITICAL
**Files:** `app/payment.tsx` (entire card grid), `app/payment-methods.tsx` (entire card grid)
**Category:** Functional / UX
**Gap ID:** NA-CRIT-01
**Status:** ACTIVE
**Est Fix:** 2 hours
**Related:** CA-PAY-### (prior audit)

### Description
Every payment option card (Paytm, PhonePe, Amazon Pay, Tabby, Tamara, EMI options, UPI, Cards, Net Banking, Wallets) is rendered as a `Pressable` component with **zero `onPress` handlers**. Users see payment methods visually but tapping them does nothing. Additionally, the "Add new card" pressable checks `cardNumber && cardNumber.length >= 13` but `cardNumber` is local state never set on this screen — the condition is permanently false.

### Root Cause
Payment method selection UI was scaffolded without wiring selection state to the checkout flow.

### Impact
Users cannot select any payment method. Only path to payment is the hidden "Pay Instantly" button that bypasses all method selection.

### Fix Direction
Add `onPress` handlers to each payment method card that sets `selectedPaymentMethod` state. Wire `handleRazorpayPayment()` to use the selected method.

---

## NA-CRIT-02: Bill Amount Completely Client-Controlled — Fraud Vector

**Severity:** CRITICAL
**Files:** `services/billVerificationService.ts`, `app/bill-upload-enhanced.tsx`, `services/billUploadAnalytics.ts`
**Category:** Security / Financial Integrity
**Gap ID:** NA-CRIT-02
**Status:** ACTIVE
**Est Fix:** 4 hours
**Related:** CA-PAY-002 (float precision), CA-PAY-003 (idempotency), CA-SEC-### (prior security)

### Description
The `amount` sent to the backend for cashback calculation is computed entirely by the client. The server receives the image and claimed amount independently and trusts the client. No cryptographic binding between image and amount. No server-side OCR verification of claimed amount. The entire bill verification flow sends FormData with `merchantId`, `amount`, `billDate` — all computed client-side.

### Exploit Path
1. User photographs a Rs.50 bill
2. App computes amount via OCR or manual entry
3. Attacker modifies `amount` to Rs.50,000 via MITM or local state manipulation
4. Server accepts the image and inflated amount
5. Rewards credited against the forged bill's inflated amount

### Root Cause
Verification workflow processes the image for OCR but cashback is computed from `req.body.amount` (client-supplied) rather than from extracted OCR value. No server-side reconciliation.

### Impact
Direct financial fraud. Unbounded coin generation. Cashback budget drain.

### Fix Direction
Server must compute cashback from OCR-extracted amount. If using OCR, validate OCR result server-side. Amount should never originate from client. Add cryptographic commitment scheme (hash of image stored server-side, amount validated against it).

---

## NA-CRIT-03: `new Blob()` Used in React Native — Crashes on iOS/Android

**Severity:** CRITICAL
**Files:** `services/cacheService.ts:216,362,765`; `services/billUploadAnalytics.ts:982`
**Category:** Runtime Crash
**Gap ID:** NA-CRIT-03
**Status:** FIXED (2026-04-17) — Replaced `new Blob([data]).size` with `new TextEncoder().encode(data).length` in cacheService.ts + billUploadAnalytics.ts
**Est Fix:** 30 minutes
**Related:** CA-INF-### (prior infra)

### Description
`new Blob([jsonString]).size` is a **browser-only Web API**. It does NOT exist in React Native and throws `ReferenceError: Blob is not defined` at runtime on iOS and Android.

### Root Cause
Web-era code was not updated when ported to React Native. Cache size estimation uses the Blob Web API for byte count.

### Impact
Cache size estimation silently fails on mobile. `estimateSize()` and `actualSize` calculations throw, breaking cache eviction entirely. `billUploadAnalytics.ts:982` crashes the analytics pipeline.

### Fix Direction
Replace `new Blob([jsonString]).size` with `new TextEncoder().encode(jsonString).length` for cross-platform byte count.

---

## NA-CRIT-04: `@/types/unified` Does Not Exist — Build Fails

**Severity:** CRITICAL
**Files:**
- `services/ordersApi.ts:7`
- `services/cartApi.ts:12`
- `services/storesApi.ts:11`
- `services/productsApi.ts:11`
- `services/authApi.ts:10`
- `contexts/AuthContext.tsx:14`
- `contexts/CartContext.tsx:55`

**Category:** TypeError / Build Failure
**Gap ID:** NA-CRIT-04
**Status:** FIXED (2026-04-17) — Created `types/unified/index.ts` + `types/unified/guards.ts` with all exported types and 32 type guards
**Est Fix:** 4 hours
**Related:** CA-API-### (prior API contract issues)

### Description
These files import utilities (`toOrder`, `canCancelOrder`, `isCartItemAvailable`, `isUserVerified`, `isStoreVerified`) and types (`UnifiedOrder`, `UnifiedOrderItem`) from `@/types/unified`. The file `./types/unified.ts` **does not exist** anywhere in the codebase.

### Root Cause
A migration to a unified types module was started but never completed. The file was never created.

### Impact
TypeScript compilation fails on import. If TypeScript strictness is relaxed, runtime throws `Module not found`. All order creation, cart operations, store/product verification, and user verification code paths are broken.

### Fix Direction
Create `types/unified.ts` exporting all required utilities and types. Or replace imports with inline implementations and canonical types from `@rez/shared`.

---

## NA-CRIT-05: QR Check-In Has Zero QR Scanning Code

**Severity:** CRITICAL
**File:** `app/qr-checkin.tsx`
**Category:** Missing Feature / Data Handling
**Gap ID:** NA-CRIT-05
**Status:** ACTIVE
**Est Fix:** 8 hours

### Description
The screen title says "Earn REZ Coins" with a camera icon, but there is **zero camera or QR library integration**. The screen is purely a manual amount-entry form. No `Camera`, `BarCodeScanner`, `expo-camera`, or any QR library is imported or used. `handleSubmit` sends `paymentMethod: 'cash'` hardcoded — there is no actual QR verification.

### Root Cause
The screen was designed for QR scanning but camera integration was never implemented.

### Impact
Users expecting to scan a merchant QR code see a manual form instead. REZ coins cannot be legitimately earned via QR without camera scan.

### Fix Direction
Integrate `expo-camera` for QR scanning. Parse QR payload, validate against merchant backend, then credit coins.

---

## NA-CRIT-06: `showToast` Called But Never Imported in Checkout

**Severity:** CRITICAL
**File:** `app/checkout.tsx` (entire file)
**Category:** Runtime Crash
**Gap ID:** NA-CRIT-06
**Status:** FIXED (2026-04-17) — Added `import { showToast } from '@/components/common/ToastManager'` to checkout.tsx
**Est Fix:** 5 minutes
**Related:** CA-CMC-### (prior commerce)

### Description
`handleContinueToCheckout` calls `showToast({ type: 'warning', message: '...' })` but `showToast` is never imported in the file. At runtime, this throws `ReferenceError: showToast is not defined`.

### Root Cause
The `showToast` utility was refactored to a different import path or the import was accidentally removed during a merge.

### Impact
Users cannot proceed to checkout — the error is thrown before navigation, **blocking the entire order flow**.

### Fix Direction
Add correct import from `@/utils/toast` (or whichever path `showToast` lives at). Verify call signature matches.

---

## NA-CRIT-07: Double-Tap on Payment Submit — No Guard

**Severity:** CRITICAL
**Files:**
- `app/bill-upload-enhanced.tsx:387` (submit button)
- `hooks/useCheckoutUI.ts:349` (handleConfirmOrder)

**Category:** Financial / Concurrent Actions
**Gap ID:** NA-CRIT-07
**Status:** FIXED (2026-04-17) — Added `isSubmittingRef` synchronous guard on bill-upload-enhanced.tsx submit handler
**Est Fix:** 30 minutes
**Related:** CA-PAY-003 (prior idempotency)

### Description
Both the bill upload submit button and `handleConfirmOrder` have **no debouncing or press guard**. `handleConfirmOrder` sets `processingPayment` AFTER dispatching — a double-tap between render cycles fires the order twice. The `usePressGuard` hook exists at `hooks/usePressGuard.ts` but is not used on either button.

### Root Cause
The `usePaymentFlow` hook correctly implements `isSubmittingRef` but this pattern was not applied to checkout confirmation or bill upload.

### Impact
**Duplicate order creation. Duplicate bill uploads. Potential double-charging.**

### Fix Direction
Add `isSubmittingRef` guard to both `handleConfirmOrder` and the bill upload submit handler, mirroring the pattern in `usePaymentFlow.ts:363-419`.

---

## NA-CRIT-08: Payment Polling Never Terminates

**Severity:** CRITICAL
**File:** `services/paymentService.ts:243`
**Category:** Enum Mismatch / Data Sync
**Gap ID:** NA-CRIT-08
**Status:** FIXED (2026-04-17) — Added `'paid'` terminal check + `normalizePaymentStatus` + 5min wall-clock timeout to paymentService.ts
**Est Fix:** 30 minutes
**Related:** CA-PAY-### (prior payments)

### Description
`pollPaymentStatus` checks for terminal states as `status === 'completed' || status === 'failed' || status === 'cancelled'`. But the canonical `OrderPaymentStatus` type uses `'paid'` as the terminal success state. If the backend returns `'paid'`, polling continues indefinitely until the 30-attempt timeout (90 seconds).

### Root Cause
`paymentService.ts` was written with `'completed'` as a status value, but the canonical type uses `'paid'`. No `normalizePaymentStatus()` from shared is applied to backend responses.

### Impact
Users see a loading spinner for **up to 90 seconds** after successful payment, then see a timeout error instead of confirmation.

### Fix Direction
Add `'paid'` to terminal state check: `if (status === 'paid' || status === 'failed' || status === 'cancelled' || status === 'completed')`. Import `normalizePaymentStatus` from shared.

---

## NA-CRIT-09: `Math.random()` for ID Generation in Offline Sync

**Severity:** CRITICAL
**File:** `services/offlineSyncService.ts:436`
**Category:** Security / Architecture
**Gap ID:** NA-CRIT-09
**Status:** FIXED (2026-04-17) — Replaced `Math.random()` with `crypto.randomUUID()` in 13 files across consumer + merchant apps
**Est Fix:** 10 minutes
**Related:** CA-SEC-### (prior security)

### Description
`generateId()` uses `Date.now() + Math.random().toString(36)` instead of `uuid` or `crypto.randomUUID()`. Violates the codebase's own `no-math-random-for-ids.sh` fitness test.

### Root Cause
The service was written without using the canonical ID generation utility.

### Impact
Predictable offline action IDs. ID collision possible under rapid queuing. **Violates security architecture.**

### Fix Direction
Replace `generateId()` with `uuid.v4()` from the `react-native-uuid` package already in the codebase.

---

## NA-CRIT-10: UPI Payment Flow Silently Does Nothing

**Severity:** CRITICAL
**File:** `app/pay-in-store/payment.tsx:210-235`
**Category:** Functional / Silent Failure
**Gap ID:** NA-CRIT-10
**Status:** FIXED (2026-04-17) — Wired handleUpiPayment to POST /store-payment/confirm with paymentId, transactionId, idempotencyKey
**Est Fix:** 2 hours
**Related:** CA-PAY-### (prior payments)

### Description
`handleUpiPayment()` shows an error message but **makes zero API calls**. The function sets `setUpiError('UPI payments require the REZ native app...')` but never calls `apiClient.post('/store-payment/initiate')` or any equivalent. The payment is never initiated server-side.

### Root Cause
UPI collect flow was scaffolded but never wired to the backend.

### Impact
Users on Expo Go or web who select UPI as payment method can enter a valid UPI ID and tap pay — they receive only an error toast. The payment silently dies.

### Fix Direction
Either (a) implement real server-side UPI collect flow where app sends UPI ID to backend and polls for status, or (b) route users to native app via deep link with "Open in REZ App" button.

---

## NA-CRIT-11: Wallet Balance Persisted in Plain AsyncStorage

**Severity:** CRITICAL
**File:** `stores/walletStore.ts:51-53` (self-acknowledged as CA-PAY-059)
**Category:** Security / Financial
**Gap ID:** NA-CRIT-11
**Status:** FIXED (2026-04-17) — Created `utils/secureWalletStorage.ts` with expo-secure-store (native) + XOR fallback (web), with migration path
**Est Fix:** 2 hours
**Related:** CA-SEC-003 (prior auth storage), CA-SEC-002 (prior encryption)

### Description
Wallet balance, total balance, available balance, branded coins, and raw backend data are persisted **unencrypted** to AsyncStorage via Zustand's persist middleware. AsyncStorage is unencrypted on both iOS and Android. On a rooted/jailbroken device, any app can read these values.

### Root Cause
Zustand `persist` middleware stores all wallet data to AsyncStorage without encryption.

### Impact
Sensitive financial data readable by other apps on the same device. Combined with any auth token leakage, an attacker could read the victim's wallet balance.

### Fix Direction
Replace `persist` with `createJSONStorage` backed by `expo-secure-store`. Or fetch balances fresh from API on every session and remove financial data from persistence entirely.

---

## Status Table

| ID | Status | Fix Priority | Owner |
|----|--------|-------------|-------|
| NA-CRIT-01 | ACTIVE | P0 | needs merchant implementation |
| NA-CRIT-02 | ACTIVE | P0 | backend change required |
| NA-CRIT-03 | **FIXED** | — | 2026-04-17 (remaining Blob at cacheService:774 also fixed) |
| NA-CRIT-04 | **FIXED** | — | 2026-04-17 |
| NA-CRIT-05 | ACTIVE | P0 | expo-camera integration needed |
| NA-CRIT-06 | **FIXED** | — | 2026-04-17 |
| NA-CRIT-07 | **FIXED** | — | 2026-04-17 |
| NA-CRIT-08 | **FIXED** | — | 2026-04-17 |
| NA-CRIT-09 | **FIXED** | — | 2026-04-17 |
| NA-CRIT-10 | **FIXED** | — | 2026-04-17 |
| NA-CRIT-11 | **FIXED** | — | 2026-04-17 |
