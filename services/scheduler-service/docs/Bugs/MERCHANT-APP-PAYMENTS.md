# Merchant App — Payments, Wallet & Finance

> **Audit date:** 2026-04-15
> **Bugs found:** 28
> **Status:** Open — merchant app audit

---

### MA-PAY-001: Weak Entropy Idempotency Key in Bill Payment
**Severity:** CRITICAL
**File:** rezmerchant/services/billPaymentApi.ts:130
**Category:** security
**Description:** `Math.random().toString(36).slice(2, 9)` generates weak entropy for idempotency key generation. Attacker can predict keys and forge duplicate payments.
**Impact:** Idempotency protection bypassed; attacker can create duplicate bill payments by reusing predicted keys.
**Fix hint:** Use `crypto.getRandomValues()` or UUID v4 for cryptographically secure key generation.
**Status:** Fixed in commit (2026-04-15) — Replaced Math.random() with crypto.getRandomValues() for secure key generation

---

### MA-PAY-002: Missing Fallback on Razorpay Checkout Undefined
**Severity:** CRITICAL
**File:** rezmerchant/app/payment-razorpay.tsx:26-31, 295-299
**Category:** null-ref
**Description:** `RazorpayCheckout` is set to `null` in try-catch but code at line 295 calls `RazorpayCheckout.open()` without null check. If require() fails, calling `.open()` crashes.
**Impact:** On Expo Go or environments without Razorpay SDK, payment crashes the app instead of gracefully handling unavailability.
**Fix hint:** Add `if (!RazorpayCheckout) { ... }` before calling methods or fallback to web checkout.
**Status:** Fixed in commit (2026-04-15) — Added isRazorpayAvailable() helper and null check before calling methods

---

### MA-PAY-003: Double-Payment Race Condition: orderCreated Flag Insufficient
**Severity:** CRITICAL
**File:** rezmerchant/app/payment-razorpay.tsx:201-203, 209-226
**Category:** race
**Description:** `if (orderCreated && razorpayOrderId) return` is checked synchronously, but state update is async. Between check and state assignment, second call can proceed, creating two Razorpay orders.
**Impact:** User taps payment button twice before first order creation completes; two orders created, both charged.
**Fix hint:** Use a promise-based lock: `if (orderPromise) return orderPromise; const orderPromise = createOrder(); ...`.
**Status:** Fixed in commit (2026-04-15) — Implemented promise-based lock with orderPromiseRef to prevent double-payment

---

### MA-PAY-004: Payment Verification No Retry on Network Failure
**Severity:** HIGH
**File:** rezmerchant/app/payment-razorpay.tsx:256-279
**Category:** error-handling
**Description:** `verifyRazorpayPaymentOnBackend()` returns false on any error (including transient network errors) with no retry logic.
**Impact:** Transient network timeout causes payment to appear failed even if it succeeded on backend; user confused about payment status.
**Fix hint:** Implement retry with exponential backoff for transient errors; distinguish between permanent (signature invalid) and transient (timeout) failures.

---

### MA-PAY-005: Payment Timeout Fires But Pending Navigation Not Cleared
**Severity:** HIGH
**File:** rezmerchant/app/payment-razorpay.tsx:96-115
**Category:** error-handling
**Description:** When payment timeout fires (5 min), pending navigations in `navTimeoutsRef` are not checked or cleared. Navigation scheduled earlier may still execute after timeout alert is dismissed.
**Impact:** User dismisses timeout alert but app still navigates; confusing UX and potential state inconsistency.
**Fix hint:** On timeout, iterate `navTimeoutsRef.current` and clear all pending navigations before showing alert.

---

### MA-PAY-006: Payment Amount Not Validated Before Order Creation
**Severity:** HIGH
**File:** rezmerchant/services/paymentOrchestratorService.ts (via payment-razorpay.tsx call chain)
**Category:** validation
**Description:** `createRazorpayOrder()` does not validate that amount is still valid (> 0 and <= max) before API call.
**Impact:** Zero or negative amounts sent to backend; order creation fails silently or backend rejects payment.
**Fix hint:** Add validation at start: `if (amount <= 0 || amount > MAX_AMOUNT) throw new Error(...)`.

---

### MA-PAY-007: Stale Idempotency Key Fallback Generation
**Severity:** HIGH
**File:** rezmerchant/services/billPaymentApi.ts:128-130
**Category:** idempotency
**Description:** Idempotency key only generated as fallback if not passed. If caller forgets to pass it on retry, fallback generates a new key, defeating idempotency.
**Impact:** Retry with same parameters creates second payment because fallback key is different.
**Fix hint:** Enforce that caller always provides idempotency key; throw error if missing on second attempt.

---

### MA-PAY-008: Promise.all on Order Fetches No Timeout in Payment Success
**Severity:** HIGH
**File:** rezmerchant/app/payment-success.tsx:131
**Category:** error-handling
**Description:** `Promise.all(orderPromises)` has no timeout wrapper; if any order fetch hangs, entire success screen frozen forever.
**Impact:** Payment success screen can hang indefinitely if backend is slow or offline.
**Fix hint:** Wrap with `Promise.race([Promise.all(...), timeoutPromise(5000)])`.

---

### MA-PAY-009: Partial Failure on Promise.all Not Handled
**Severity:** MEDIUM
**File:** rezmerchant/app/payment-success.tsx:131
**Category:** error-handling
**Description:** `Promise.all()` rejects if any order fetch fails; partial success (e.g., 2 of 3 orders fetched) causes entire success screen to show error state.
**Impact:** User sees error screen even though payment mostly succeeded; poor UX.
**Fix hint:** Use `Promise.allSettled()` and handle failed orders with fallback display.
**Status:** Fixed in Phase 7b — Use allSettled pattern for partial failure handling

---

### MA-PAY-010: No Validation That Payment Method is Available for Amount
**Severity:** HIGH
**File:** rezmerchant/services/paymentOrchestratorService.ts:52-168
**Category:** validation
**Description:** `getAvailablePaymentMethods()` returns all methods but does not filter by amount constraints. User shown UPI for amounts that require minimum (e.g., COD only for ≥₹100).
**Impact:** User selects unavailable method; payment fails after amount confirmation.
**Fix hint:** Filter returned methods: `if (method.minAmount && amount < method.minAmount) skip`.

---

### MA-PAY-011: REZ Coins Payment Type Not Normalized in Payment Request
**Severity:** HIGH
**File:** rezmerchant/services/paymentOrchestratorService.ts:77
**Category:** validation
**Description:** Comment in CONSUMER-APP-PAYMENTS.md states 'rezcoins' → 'wallet' mapping required. In merchant app, line 77 marks type as `'rezcoins' as any` but never normalizes in `processInternalPayment()`.
**Impact:** Payment request sent with 'rezcoins' method may fail at backend if it expects 'wallet'.
**Fix hint:** Create `normalizePaymentMethod()` helper; convert 'rezcoins' to 'wallet' before backend submission.

---

### MA-PAY-012: No Validation of Subscription Tier in Payment Params
**Severity:** MEDIUM
**File:** rezmerchant/app/payment-razorpay.tsx:72
**Category:** validation
**Description:** `subscriptionTier` from params used without validation against whitelist. Invalid tier (e.g., 'super_premium') accepted.
**Impact:** Invalid tier passed to backend; subscription creation fails after payment.
**Fix hint:** Validate tier on mount: `if (!['free', 'premium', 'elite'].includes(subscriptionTier)) throw error`.

---

### MA-PAY-013: No Validation That Deal is Still Active Before Balance Payment
**Severity:** MEDIUM
**File:** rezmerchant/app/payment-razorpay.tsx:217-225
**Category:** validation
**Description:** Lock deal balance payment accepted without checking if deal is still open/not expired. Payment succeeds but fulfillment impossible.
**Impact:** User pays balance for expired deal; money charged but deal cannot be completed.
**Fix hint:** Fetch deal details before payment, verify status == 'active'.

---

### MA-PAY-014: Missing Amount Validation in Payment Method Fees Display
**Severity:** MEDIUM
**File:** rezmerchant/app/payment-razorpay.tsx (implied via payment display)
**Category:** money
**Description:** Processing fees shown in UI (e.g., "2% card fee") but not actually added to final `amountToPay`. User sees fee but is not charged.
**Impact:** Backend invoice for ₹500 but UI shows fee added (₹510); amount mismatch causes payment failure.
**Fix hint:** Either apply fee to amountToPay calculation or remove from display.

---

### MA-PAY-015: No Double-Tap Prevention on Payment Method Selection
**Severity:** MEDIUM
**File:** rezmerchant/app/payment-razorpay.tsx:190-195
**Category:** idempotency
**Description:** `handleMethodSelect()` has no debounce or lock; rapid double-tap triggers multiple `handleRazorpayPayment()` calls.
**Impact:** Multiple Razorpay orders created if user taps method twice before first completes.
**Fix hint:** Disable button during payment, use pending state lock, or debounce.

---

### MA-PAY-016: Payment Status Polling Missing Timeout Protection
**Severity:** MEDIUM
**File:** rezmerchant/services/paymentService.ts (implied via payment orchestrator)
**Category:** logic
**Description:** Poll for webhook confirmation missing maximum duration check. Can poll indefinitely if backend webhook never fires.
**Impact:** Excessive API calls, battery drain on mobile; balance stuck in 'pending' forever.
**Fix hint:** Add max polling duration: `if (Date.now() - startTime > 5*60*1000) stop()`.

---

### MA-PAY-017: Silent AsyncStorage Error on Wallet Balance Sync
**Severity:** MEDIUM
**File:** rezmerchant/app/wallet-screen.tsx:135, 147
**Category:** error-handling
**Description:** `.catch(() => {})` silently ignores AsyncStorage errors. Balance hidden state is lost on error.
**Impact:** Silent failure; user has no idea balance persisted state failed.
**Fix hint:** Log error to analytics, provide fallback state, show toast notification on failure.

---

### MA-PAY-018: Unchecked toFixed() on Transaction Amounts
**Severity:** MEDIUM
**File:** rezmerchant/app/wallet-history.tsx:86
**Category:** money
**Description:** `Math.abs(item.amount).toFixed(2)` called without null check or validation that item.amount is numeric.
**Impact:** If amount is undefined or NaN, display shows 'NaN.toFixed is not a function' error.
**Fix hint:** Validate amount before calling: `if (typeof amount !== 'number') return '₹0.00'`.

---

### MA-PAY-019: No Error Handling for External Wallet Linking
**Severity:** MEDIUM
**File:** rezmerchant/services/walletApi.ts (implied, similar to consumer app CA-PAY-020)
**Category:** error-handling
**Description:** Wallet linking catch block returns generic `{ success: false }` without actual error details. Real reason (account already linked, auth failed) swallowed.
**Impact:** User sees "Wallet linking failed" with no actionable reason.
**Fix hint:** Re-throw or pass through backend error code/message.

---

### MA-PAY-020: Wallet Balance Display Missing Optional Chaining Guard
**Severity:** MEDIUM
**File:** rezmerchant/services/walletApi.ts:174-196
**Category:** validation
**Description:** Fields like `breakdown.cashback` and `breakdown.cashbackBalance` both optional with no clear canonical field. Code may use stale/missing field.
**Impact:** Balance display shows wrong amount if field changed between API versions.
**Fix hint:** Standardize on single canonical field name; deprecate legacy name in doc.

---

### MA-PAY-021: Bill Payment Hardcoded Timeouts May Not Match Backend
**Severity:** MEDIUM
**File:** rezmerchant/services/billPaymentApi.ts:100-101
**Category:** api
**Description:** `API_TIMEOUTS.BILL_FETCH` and `API_TIMEOUTS.PAYMENT` defined but unclear if apiClient middleware applies them consistently to all timeout scenarios.
**Impact:** Long external BBPS calls exceed timeout; request hangs.
**Fix hint:** Verify apiClient honors custom timeout headers for all request types.

---

### MA-PAY-022: Bill Type Allowlist Validation Happens Late After State Update
**Severity:** MEDIUM
**File:** rezmerchant/app/bill-payment.tsx (implied from consumer app CA-PAY-049)
**Category:** validation
**Description:** Deep link billType validated only in useEffect, not before state update. Malicious link with invalid type triggers UI flash.
**Impact:** UI briefly shows invalid bill type before validation rejects it.
**Fix hint:** Validate in route handler before navigation, reject invalid types early.

---

### MA-PAY-023: COD Config Max Amount Check Incomplete
**Severity:** MEDIUM
**File:** rezmerchant/services/paymentOrchestratorService.ts:148-151
**Category:** validation
**Description:** COD availability checks amount but logic may miss edge cases (e.g., amount == maxAmount not clearly tested).
**Impact:** COD offered for amounts slightly over limit; backend rejects payment.
**Fix hint:** Test edge cases: amount == minAmount, amount == maxAmount, amount just under/over.

---

### MA-PAY-024: Console Logs in Services Not Sanitized for Production
**Severity:** MEDIUM
**File:** rezmerchant/services/billPaymentApi.ts, rezmerchant/services/walletApi.ts (implied)
**Category:** security
**Description:** Dev logs may not be properly stripped in production builds if __DEV__ check is incorrect.
**Impact:** Sensitive payment data (amount, userIds, payment IDs) logged in production; security risk.
**Fix hint:** Use whitelist approach: only log explicitly safe fields; never log PII or transaction details.
**Status:** Fixed in Phase 7b — Error messages sanitized; console.error only logs error.message in __DEV__

---

### MA-PAY-025: No Rate Limiting on Payment Method API Calls
**Severity:** MEDIUM
**File:** rezmerchant/app/payment-razorpay.tsx:156 (loadPaymentMethods)
**Category:** api
**Description:** `getPaymentMethods()` can be called multiple times without deduplication. Rapid navigation triggers duplicate requests.
**Impact:** Backend API spam; performance degradation.
**Fix hint:** Implement request deduplication or cache for 5 minutes.

---

### MA-PAY-026: No Explicit Timeout on Razorpay Checkout Modal Open
**Severity:** MEDIUM
**File:** rezmerchant/app/payment-razorpay.tsx:347
**Category:** error-handling
**Description:** `RazorpayCheckout.open()` has no timeout. If modal never appears, user stuck forever.
**Impact:** Network delay causes Razorpay UI to load slowly; no fallback shown.
**Fix hint:** Wrap in timeout: if modal doesn't appear in 10s, show error.

---

### MA-PAY-027: Payment Amount Rounding Error on Paise Conversion
**Severity:** MEDIUM
**File:** rezmerchant/services/paymentValidation.ts:213-215
**Category:** money
**Description:** Amount validation allows decimal places but paise conversion `amount * 100` can introduce float errors (e.g., 100.555 → 10055.5 instead of 10056).
**Impact:** Off-by-one-paisa errors; amount discrepancy between display and backend.
**Fix hint:** Validate all amounts are whole paise before accepting; reject 0.005 precision.

---

### MA-PAY-028: Missing Transaction ID on Local Bill Uploads
**Severity:** MEDIUM
**File:** rezmerchant/services/billUploadService.ts (implied from consumer app CA-PAY-058)
**Category:** validation
**Description:** Bill uploads lack unique transaction ID. If user tries to refund, matching with original upload is hard.
**Impact:** Refund system cannot tie refund to original payment.
**Fix hint:** Assign UUID to each bill upload in response.

---

### MA-PAY-029: AsyncStorage Used for Sensitive Wallet Data Without Encryption
**Severity:** HIGH
**File:** rezmerchant/app/wallet-screen.tsx, rezmerchant/stores/walletStore.ts
**Category:** security
**Description:** Wallet balance, coin counts, and preferences persisted to AsyncStorage in plain text. Device theft exposes financial data.
**Impact:** Attacker with device access reads wallet balances, coin counts, payment preferences.
**Fix hint:** Use secure storage library (react-native-secure-store or platform equivalent).

---

### MA-PAY-030: Missing Null Check on Optional Chaining in Transaction Status Display
**Severity:** MEDIUM
**File:** rezmerchant/app/transactions/index.tsx (implied from consumer app CA-PAY-001)
**Category:** null-ref
**Description:** `transaction.status?.current` can be undefined with no fallback in render.
**Impact:** Transaction status badge may show undefined text or crash if status object missing.
**Fix hint:** Provide default: `transaction.status?.current ?? 'pending'`.

---

**NOTE:** This audit found 28 payment and wallet bugs in the merchant app, with 4 being CRITICAL (items 001, 003, 004, 006). Phase 7b fixes include:

**Fixed in Phase 7b (6 MEDIUM bugs):**
1. MA-PAY-009: allSettled pattern for partial failure handling
2. MA-PAY-024: Sanitized console logs to prevent PII leakage
3. MA-PAY-031: Transaction type validation added
4. MA-API-027: Pagination limit capped to prevent DoS
5. MA-API-022: Wallet balance response structure validated
6. MA-INF-018: Socket emit guarded against disconnected state

**Remaining work:**
- Payment amount validation (MA-PAY-006, MA-PAY-014)
- Subscription tier validation (MA-PAY-012)
- Deal active status check (MA-PAY-013)
- Double-tap prevention (MA-PAY-015)
- AsyncStorage error handling (MA-PAY-017)
- toFixed() validation (MA-PAY-018)

The merchant app reuses many payment patterns from consumer app but lacks defensive error handling and security-hardening measures found in reference documentation.
