# Consumer App — Payments, Wallet & Finance

> **Audit date:** 2026-04-15
> **Bugs found:** 65
> **Status:** Open — consumer app audit

---

### [CA-PAY-001] Missing null check after optional chaining in transaction status
**Severity:** MEDIUM
**File:** app/transactions/index.tsx:171
**Category:** null-ref
**Description:** `transaction.status?.current` can be undefined when accessing in display, but no fallback shown in render.
**Impact:** Transaction status badge may show undefined text or crash.
**Fix hint:** Provide default value: `transaction.status?.current ?? 'completed'`.
> **Status:** Fixed in commit 1ff261a

### [CA-PAY-002] Float precision loss in cashback calculations
**Severity:** HIGH
**File:** app/bill-upload-enhanced.tsx:184
**Category:** money
**Description:** `estimatedCashback.toFixed(2)` rounds but doesn't handle accumulated float precision errors from prior calculations.
**Impact:** Off-by-penny errors in cashback display or credit.
**Fix hint:** Use Big integer arithmetic or precise decimal library for multi-step calculations.

### [CA-PAY-003] No idempotency for bill payment retry logic
**Severity:** CRITICAL
**File:** app/bill-payment.tsx:230-260
**Category:** idempotency
**Description:** Exponential backoff retry loop has no idempotency key — repeated failures can cause duplicate payments.
**Impact:** User charged multiple times on transient network failures.
**Fix hint:** Generate idempotencyKey once at start, pass via header on all retries.
> **Status:** Fixed in commit 8a020db (2026-04-15). Added idempotency key generation at start of payment flow.

### [CA-PAY-004] Stale closure in wallet balance update
**Severity:** HIGH
**File:** stores/walletStore.ts:66-83
**Category:** race
**Description:** `adjustBalance()` closure captures stale `state.walletData` if multiple rapid updates fire.
**Impact:** Balance inconsistency after concurrent earn + spend events.
**Fix hint:** Use functional update: `set(state => ({ ... }))` with fresh state read.

### [CA-PAY-005] Missing amount validation in Razorpay order creation
**Severity:** HIGH
**File:** app/payment-razorpay.tsx:286
**Category:** validation
**Description:** `createRazorpayOrder()` does not validate that `amount` is still valid before API call.
**Impact:** Zero/negative amounts sent to backend, order creation fails silently.
**Fix hint:** Add `if (amount <= 0) throw new Error(...)` at function start.

### [CA-PAY-006] Race condition: orderCreated flag not preventing double-submission
**Severity:** CRITICAL
**File:** app/payment-razorpay.tsx:201-203
**Category:** race
**Description:** `if (orderCreated && razorpayOrderId) return` is insufficient — flag can be set to true async, but second call still proceeds.
**Impact:** Two Razorpay orders created if user taps button twice before first order creation completes.
**Fix hint:** Use a promise-based lock: `if (orderPromise) return orderPromise;`.
> **Status:** Fixed in commit 5e833f6 (2026-04-15). Implemented promise-based lock using ref to prevent concurrent order creation.

### [CA-PAY-007] Missing error boundary for payment success state transitions
**Severity:** HIGH
**File:** app/payment-razorpay.tsx:370-475
**Category:** error-handling
**Description:** `handlePaymentSuccess()` has no catch wrapper around router navigation — errors thrown in success callback are unhandled.
**Impact:** Payment succeeds but app crashes due to navigation error, user thinks payment failed.
**Fix hint:** Wrap entire success logic in try-catch with final navigation guaranteed.

### [CA-PAY-008] Bill payment polling has no timeout protection
**Severity:** HIGH
**File:** app/bill-payment.tsx:358-390
**Category:** logic
**Description:** Poll for webhook confirmation has no maximum duration — can poll indefinitely if backend webhook never fires.
**Impact:** Excessive API calls, battery drain, pending balance forever.
**Fix hint:** Add max polling duration: `if (Date.now() - startTime > 5*60*1000) stop()`.

### [CA-PAY-009] Unchecked parseFloat in bill simulator
**Severity:** MEDIUM
**File:** app/bill-simulator/index.tsx:249
**Category:** validation
**Description:** `parseFloat(inputText)` returns NaN if input is non-numeric, no validation before multiplication.
**Impact:** Calculated values become NaN, display broken.
**Fix hint:** Validate `!isNaN(parsed)` before using in calculations.

### [CA-PAY-010] toLocaleString() assumes numeric values in transaction display
**Severity:** MEDIUM
**File:** app/transactions/index.tsx:171
**Category:** ui
**Description:** `balanceAfter.toLocaleString()` called without null check or type guard.
**Impact:** Transaction detail view crashes if `balanceAfter` is undefined.
**Fix hint:** Add `?.toString()` and optional chaining.

### [CA-PAY-011] No signature verification on Razorpay payments (client-side only)
**Severity:** CRITICAL
**File:** app/payment-razorpay.tsx:256-278
**Category:** security
**Description:** `verifyRazorpayPaymentOnBackend()` is called for some flows but not all; no client-side signature validation.
**Impact:** Attacker can forge Razorpay data locally and bypass payment (relies entirely on backend).
**Fix hint:** Always enforce backend verification; never trust client-side Razorpay data.
> **Status:** Fixed in commit 5e833f6 (2026-04-15). Added field validation, require response confirmation, prevent client-side data trust.

### [CA-PAY-012] Missing AsyncStorage error handling in wallet balance sync
**Severity:** MEDIUM
**File:** app/wallet-screen.tsx:141-148
**Category:** error-handling
**Description:** `AsyncStorage.getItem()` errors are caught but silently ignored with `.catch(() => {})`.
**Impact:** Silent failure — balance hidden state is lost on errors, no user notification.
**Fix hint:** Log to error reporter, provide fallback state.

### [CA-PAY-013] Coin rate fetched but not used if async completes after mount
**Severity:** MEDIUM
**File:** app/redeem-coins.tsx:94-96
**Category:** race
**Description:** `getConversionRate()` result assigned without `if (!cancelled)` check.
**Impact:** After component unmounts, stale rate update occurs (memory leak + bug).
**Fix hint:** Add cancellation check before `setCoinRate()`.

### [CA-PAY-014] No validation that redeemed coins amount does not exceed balance
**Severity:** HIGH
**File:** app/redeem-coins.tsx:122-144
**Category:** validation
**Description:** `handleSubmit()` calls `walletApi.redeemCoins()` without re-checking balance (already checked client-side, but no server-side guard visible).
**Impact:** Race condition: balance changes between validation and submission.
**Fix hint:** Rely on backend validation only; remove client-side pre-checks or re-validate server-side.

### [CA-PAY-015] BillPaymentApi timeout not applied consistently
**Severity:** MEDIUM
**File:** services/billPaymentApi.ts:101, 133
**Category:** api
**Description:** BILL_FETCH and PAYMENT timeouts defined but unclear if apiClient honors all timeout headers.
**Impact:** Long external BBPS calls can exceed default timeout, requests hang.
**Fix hint:** Verify apiClient middleware applies custom timeouts correctly.

### [CA-PAY-016] Bill upload image hash for duplicates but no server-side check
**Severity:** MEDIUM
**File:** services/billUploadQueueService.ts:194-200
**Category:** validation
**Description:** Client generates image hash for duplicate detection, but no server-side validation that hash matches image.
**Impact:** Attacker can submit old bill image with fake hash, bypass duplicate check.
**Fix hint:** Server must recalculate hash and reject mismatches.

### [CA-PAY-017] Queue retry logic reuses same image data without re-validation
**Severity:** MEDIUM
**File:** services/billUploadQueueService.ts:181-190
**Category:** validation
**Description:** Bill image retried from queue without re-running OCR/fraud checks.
**Impact:** Stale OCR data causes wrong amounts uploaded on retry.
**Fix hint:** Force re-verification on manual queue retry.

### [CA-PAY-018] Payment idempotency key generated with random, not cryptographic entropy
**Severity:** MEDIUM
**File:** app/pay-in-store/payment.tsx:82
**Category:** security
**Description:** `Math.random().toString(36).slice(2)` generates weak entropy for idempotency key.
**Impact:** Attacker can predict idempotency keys, forge duplicate payments.
**Fix hint:** Use `crypto.getRandomValues()` or UUID v4.

### [CA-PAY-019] UPI manual entry in web/Expo Go has no verification
**Severity:** HIGH
**File:** app/pay-in-store/payment.tsx:139-143
**Category:** security
**Description:** Comment says "cannot verify server-side" for manual UPI ID entry.
**Impact:** User can enter fake UPI ID, payment fails but transaction recorded.
**Fix hint:** Validate UPI ID format; require Razorpay SDK on native only.

### [CA-PAY-020] External wallet linking returns success even on error silently
**Severity:** MEDIUM
**File:** services/externalWalletApi.ts:82-100
**Category:** error-handling
**Description:** `linkWallet()` catch returns `{ success: false }` with generic message, actual error is swallowed.
**Impact:** User sees generic error instead of specific failure reason (e.g., account already linked).
**Fix hint:** Re-throw or pass through backend error details.

### [CA-PAY-021] Payment orchestrator COD max amount check incomplete
**Severity:** MEDIUM
**File:** services/paymentOrchestratorService.ts:146-150
**Category:** validation
**Description:** COD availability checked but logic appears cut off (file read limit reached).
**Impact:** COD max amount validation may not be enforced.
**Fix hint:** Complete COD config checks: amount >= min AND <= max.

### [CA-PAY-022] Wallet API balance response has both legacy and new field names
**Severity:** MEDIUM
**File:** services/walletApi.ts:174-196
**Category:** validation
**Description:** `breakdown.cashback` and `breakdown.cashbackBalance` both optional; unclear which is authoritative.
**Impact:** Code may use stale field, causing balance display errors.
**Fix hint:** Standardize on single canonical field, deprecate old name.

### [CA-PAY-023] Payment method transform rule not enforced at all call sites
**Severity:** HIGH
**File:** types/payment.types.ts:4-7
**Category:** validation
**Description:** Comment states 'rezcoins' → 'wallet' mapping required, but no enforcement in actual payment service.
**Impact:** Payment requests sent with 'rezcoins' method fail at backend.
**Fix hint:** Create `normalizePaymentMethod()` helper, call before API submission.

### [CA-PAY-024] No check that payment method is available for amount/currency
**Severity:** MEDIUM
**File:** services/paymentOrchestratorService.ts:52-100
**Category:** validation
**Description:** `getAvailablePaymentMethods()` returns methods but does not filter by amount or currency constraints.
**Impact:** User shown unavailable methods for zero amount or unsupported currency.
**Fix hint:** Filter methods by `minAmount`, `maxAmount`, `supportedCurrencies` at return.

### [CA-PAY-025] Cashback capped but no audit log of cap applied
**Severity:** MEDIUM
**File:** services/billPaymentApi.ts:50-51, 57
**Category:** validation
**Description:** `cappedAt` field exists but no server log confirms cap was enforced.
**Impact:** Disputes: user claims promised cashback was missing, no evidence cap was applied.
**Fix hint:** Log cashback cap decisions with timestamp, reason.

### [CA-PAY-026] Transaction category labels hardcoded with no i18n
**Severity:** LOW
**File:** app/wallet-history.tsx:51-63
**Category:** ui
**Description:** Category labels hardcoded English strings, no translation.
**Impact:** Non-English users see English transaction labels.
**Fix hint:** Move labels to i18n JSON, use translation keys.

### [CA-PAY-027] Payment amount not validated as integer paise on conversion
**Severity:** MEDIUM
**File:** app/pay-in-store/payment.tsx:159
**Category:** money
**Description:** `Math.round(paymentData.remainingAmount * 100)` converts to paise but original amount may be non-standard precision.
**Impact:** Rounding errors: ₹100.555 becomes 10055 paise (₹100.55) instead of 10056.
**Fix hint:** Validate all amounts are whole paise (no thirds of paise).

### [CA-PAY-028] No debounce on bill payment provider fetch, rapid type changes trigger multiple API calls
**Severity:** MEDIUM
**File:** app/bill-payment.tsx (implied, providers loaded on selectedType change)
**Category:** api
**Description:** Provider list refetched every time user changes bill type with no debounce.
**Impact:** Excessive API calls if user quickly clicks multiple bill types.
**Fix hint:** Debounce selectedType changes before calling getProviders().

### [CA-PAY-029] Wallet balance display hides for entire app, not just wallet screen
**Severity:** MEDIUM
**File:** app/wallet-screen.tsx:84, 141-148
**Category:** ui
**Description:** `@wallet_balance_hidden` AsyncStorage key shared across all screens; hiding balance on wallet hides it everywhere.
**Impact:** User expects balance hidden only on wallet screen, but it's hidden in header/dashboard too.
**Fix hint:** Use separate storage keys per screen: `@wallet_screen_balance_hidden` vs `@dashboard_balance_hidden`.

### [CA-PAY-030] Bill history pagination state not reset on filter change
**Severity:** MEDIUM
**File:** app/bill-history.tsx (implied, pagination state management not shown)
**Category:** logic
**Description:** Filter change likely does not reset `page` to 1; infinite scroll on new filter loads page 2+ with wrong results.
**Impact:** User applies filter, sees old bills from previous filter on first scroll.
**Fix hint:** Reset pagination state in filter change handler.

### [CA-PAY-031] Refund request field 'reason' is optional but not shown to user
**Severity:** LOW
**File:** services/billPaymentApi.ts:154-159
**Category:** ui
**Description:** `requestRefund()` accepts optional reason, but UI never collects it.
**Impact:** Refunds submitted without reason; backend support team lacks context.
**Fix hint:** Prompt user for refund reason before submission.

### [CA-PAY-032] RazorpayCheckout.open() in native app throws if not in Expo Dev Client
**Severity:** HIGH
**File:** app/payment-razorpay.tsx:26-31
**Category:** error-handling
**Description:** `require('react-native-razorpay')` is in try-catch, but code later assumes RazorpayCheckout exists without null check.
**Impact:** If require() fails, RazorpayCheckout is undefined; calling .open() crashes.
**Fix hint:** Check `if (!RazorpayCheckout)` before calling methods.

### [CA-PAY-033] Payment success screen fetches orders in Promise.all but doesn't handle partial failures
**Severity:** MEDIUM
**File:** app/payment-success.tsx:130-145
**Category:** error-handling
**Description:** `Promise.all()` rejects if any order fetch fails; partial success not handled.
**Impact:** If 1 of 3 orders fails to fetch, entire success screen shows error.
**Fix hint:** Use `Promise.allSettled()`, handle failed orders with fallback display.

### [CA-PAY-034] Coin redemption success data not cleared, re-render shows old success state
**Severity:** MEDIUM
**File:** app/redeem-coins.tsx:148
**Category:** logic
**Description:** After redemption, `successData` is set but never cleared on screen navigation away.
**Impact:** If user goes back to redeem screen, old success state is shown briefly.
**Fix hint:** Clear `successData` on mount or on navigation away.

### [CA-PAY-035] Coin to rupee rate uses DEFAULT fallback if backend never returns value
**Severity:** MEDIUM
**File:** app/redeem-coins.tsx:94-96
**Category:** validation
**Description:** If `walletApi.getConversionRate()` never completes, rate stays at DEFAULT_COIN_TO_RUPEE_RATE (0.5).
**Impact:** User sees 0.5x rate when live rate might be 0.1x, redeems more coins than intended.
**Fix hint:** Add timeout to rate fetch; show loading state until rate received.

### [CA-PAY-036] Bill verification service response parsing has no error handling
**Severity:** MEDIUM
**File:** services/billUploadService.ts:190-200
**Category:** error-handling
**Description:** JSON.parse() of xhr.responseText can throw SyntaxError if response is malformed.
**Impact:** Upload appears to succeed but then crashes on parse, transaction state unclear.
**Fix hint:** Wrap JSON.parse() in try-catch, return specific error code.

### [CA-PAY-037] Upload progress calculation divides by zero if event.total is 0
**Severity:** LOW
**File:** services/billUploadService.ts:162-167
**Category:** math
**Description:** `event.loaded / event.total * 100` has no guard if event.total is 0.
**Impact:** Progress percentage becomes Infinity/NaN, display breaks.
**Fix hint:** Add `if (event.total === 0) return 0;` guard.

### [CA-PAY-038] EventEmitter silently swallows listener errors
**Severity:** MEDIUM
**File:** services/billUploadQueueService.ts:51-56
**Category:** error-handling
**Description:** `emit()` catches listener exceptions with empty catch block.
**Impact:** Queue event listener bugs are silent, queue state becomes inconsistent.
**Fix hint:** Log caught errors to error reporter.

### [CA-PAY-039] Bill upload queue retry uses exponential backoff but hits minimum before max
**Severity:** LOW
**File:** services/billUploadQueueService.ts:129-137
**Category:** logic
**Description:** Retry delay calculation unclear if it respects maxRetryDelayMs.
**Impact:** Retries may back off longer than configured max.
**Fix hint:** Clamp retry delay: `Math.min(calculatedDelay, maxRetryDelayMs)`.

### [CA-PAY-040] No mechanism to cancel in-flight bill uploads
**Severity:** MEDIUM
**File:** services/billUploadService.ts:155-200
**Category:** error-handling
**Description:** XHR upload stored in activeUploads map but no method to abort.
**Impact:** If user navigates away mid-upload, request continues burning bandwidth.
**Fix hint:** Add `cancelUpload(uploadId)` method that calls `xhr.abort()`.

### [CA-PAY-041] Payment method fees shown but not added to final amount
**Severity:** HIGH
**File:** app/payment-razorpay.tsx:548
**Category:** money
**Description:** Fee percentage displayed to user but final amount charged does not include fee.
**Impact:** User sees "Fee: 2%" but is not charged the fee; backend invoice mismatch.
**Fix hint:** Either apply fee in amountToPay or remove fee from display.

### [CA-PAY-042] No prevention of double-tap on payment method selection
**Severity:** MEDIUM
**File:** app/payment-razorpay.tsx:190-195
**Category:** idempotency
**Description:** `handleMethodSelect()` has no debounce or lock; rapid taps trigger multiple `handleRazorpayPayment()` calls.
**Impact:** Multiple Razorpay orders created if user taps method twice.
**Fix hint:** Disable button during payment, or add pending state lock.

### [CA-PAY-043] ReZ wallet payment requires no verification but can credit unlimited coins
**Severity:** CRITICAL
**File:** services/paymentOrchestratorService.ts:59-71
**Category:** security
**Description:** Wallet method marked as always available with no balance check.
**Impact:** User can claim payment with wallet without having balance; backend must validate.
**Fix hint:** Add client-side wallet balance validation before enabling method.
> **Status:** Fixed in commit 5e833f6 (2026-04-15). Added wallet balance API check before enabling wallet payment method.

### [CA-PAY-044] Bill date parsed but not validated to be not in future
**Severity:** MEDIUM
**File:** types/billVerification.types.ts (implied via BillUploadData.billDate)
**Category:** validation
**Description:** Bill upload accepts any date, including future dates.
**Impact:** User uploads bill dated next month; app accepts it; backend rejects on review.
**Fix hint:** Validate `billDate <= today` before submission.

### [CA-PAY-045] No timeout on Razorpay open() call
**Severity:** MEDIUM
**File:** app/payment-razorpay.tsx:347-354
**Category:** error-handling
**Description:** `RazorpayCheckout.open()` has no timeout; if UI never appears, user stuck.
**Impact:** Network delay causes Razorpay to load slowly or hang; no fallback shown.
**Fix hint:** Set timeout: if modal doesn't open in 10s, show error.

### [CA-PAY-046] Payment verification on backend may timeout but client doesn't retry
**Severity:** HIGH
**File:** app/payment-razorpay.tsx:445
**Category:** error-handling
**Description:** `verifyRazorpayPaymentOnBackend()` returns false on any error, no retry.
**Impact:** Transient network error causes payment to appear failed even if it succeeded.
**Fix hint:** Implement retry with exponential backoff in verification.

### [CA-PAY-047] Coin balance not re-fetched after redemption completes
**Severity:** MEDIUM
**File:** app/redeem-coins.tsx:124-144
**Category:** logic
**Description:** After successful redeem, balance state is set via response but wallet context not refreshed.
**Impact:** If user views wallet screen, they see old balance until next refresh.
**Fix hint:** Call `refreshWallet()` after successful redemption.

### [CA-PAY-048] Net Bank timeout (5-10 min) hardcoded in UI text but backend timeout may differ
**Severity:** LOW
**File:** services/paymentService.ts:139-147
**Category:** validation
**Description:** Fallback payment methods show "5-10 minutes" but actual backend timeout is undefined.
**Impact:** User waits 15 min after being told 10; confusion.
**Fix hint:** Fetch actual timeout from backend or use generic "Up to 30 minutes" text.

### [CA-PAY-049] Bill type allowlist validation happens late after user selection
**Severity:** MEDIUM
**File:** app/bill-payment.tsx:67-69
**Category:** validation
**Description:** Deep link type validated only in useEffect, not before state update.
**Impact:** Malicious deep link with invalid type can trigger UI flash.
**Fix hint:** Validate in URL handler before navigation, reject invalid types early.

### [CA-PAY-050] Razorpay order ID pre-created for deals but fallback amount/currency sent wrong
**Severity:** HIGH
**File:** app/payment-razorpay.tsx:210-215
**Category:** money
**Description:** For deals, pre-created order ID is used, but `amount` and `currency` from params may differ from actual order.
**Impact:** Display shows ₹500, but pre-created order is for ₹1000; user confirms wrong amount.
**Fix hint:** Fetch actual order details from backend, verify amount matches params.

### [CA-PAY-051] Lock deal balance payment has no validation that deal is still available
**Severity:** MEDIUM
**File:** app/payment-razorpay.tsx:217-225
**Category:** validation
**Description:** Balance payment accepted without checking if deal is still open/not expired.
**Impact:** User pays balance for expired deal; payment succeeds but fulfillment impossible.
**Fix hint:** Fetch deal details, verify status == 'active' before payment.

### [CA-PAY-052] Subscription upgrade missing validation for valid tier name
**Severity:** MEDIUM
**File:** app/payment-razorpay.tsx:72
**Category:** validation
**Description:** `subscriptionTier` from params used without validation against allowed tiers.
**Impact:** Invalid tier (e.g., 'super_premium') accepted, leads to backend error.
**Fix hint:** Validate tier against whitelist: ['free', 'premium', 'elite'].

### [CA-PAY-053] Payment session timeout fires but does not clear navigations in queue
**Severity:** MEDIUM
**File:** app/payment-razorpay.tsx:96-115
**Category:** error-handling
**Description:** On timeout, pending navigation timeouts in `navTimeoutsRef` are not checked; if timeout fires, navigation still queued.
**Impact:** After timeout alert, navigation still executes after user dismissal.
**Fix hint:** Clear all pending navigations when timeout fires.

### [CA-PAY-054] Cashback preview amount not refreshed if user changes amount without re-submitting
**Severity:** MEDIUM
**File:** app/pay-in-store/payment.tsx (implied via paymentFlow)
**Category:** ui
**Description:** User changes amount in input, preview should update but may not if hook doesn't track change.
**Impact:** User sees old cashback estimate for new amount.
**Fix hint:** Ensure `amountToPay` dependency triggers preview re-calculation.

### [CA-PAY-055] No handling for Razorpay user dismissal in web checkout
**Severity:** MEDIUM
**File:** app/payment-razorpay.tsx:356-365
**Category:** error-handling
**Description:** `openWebRazorpayCheckout()` always shows error; no graceful handling for dismissal.
**Impact:** User sees "Payment Not Available" even if they just canceled normally.
**Fix hint:** Distinguish between error (payment unavailable) and dismissal (user canceled).

### [CA-PAY-056] Coin approval at redemption time, not at balance check time
**Severity:** LOW
**File:** app/redeem-coins.tsx:114-122
**Category:** logic
**Description:** Validation error for max coins is shown but stored in state; user sees stale error if balance changes.
**Impact:** UI shows "Max 500 coins" but balance is actually 600; user confused.
**Fix hint:** Re-validate on each input change, not just once.

### [CA-PAY-057] Bill simulator calculates earnings with hardcoded percentages, not backend rates
**Severity:** MEDIUM
**File:** app/bill-simulator/index.tsx (implied)
**Category:** validation
**Description:** Local cashback calculation does not fetch actual rate from backend.
**Impact:** Simulator shows 5% cashback but actual payment gives 3%; user disappointed.
**Fix hint:** Fetch provider-specific rates from backend before displaying simulator.

### [CA-PAY-058] No unique transaction ID assigned to local bill uploads
**Severity:** MEDIUM
**File:** services/billUploadService.ts:96-145
**Category:** validation
**Description:** Bill uploads lack transaction ID; if user tries to refund, matching becomes hard.
**Impact:** Refund system cannot tie refund to original upload.
**Fix hint:** Assign UUID to each bill upload, return in response.

### [CA-PAY-059] AsyncStorage used for sensitive data without encryption
**Severity:** HIGH
**File:** app/wallet-screen.tsx:56, stores/walletStore.ts:3
**Category:** security
**Description:** Wallet balance and preference data persisted to AsyncStorage in plain text.
**Impact:** Attacker with device access can read wallet balances, coin counts.
**Fix hint:** Use secure storage library (e.g., react-native-secure-store).

### [CA-PAY-060] Console logs in bill upload service not sanitized in prod
**Severity:** MEDIUM
**File:** services/billUploadService.ts:7-11
**Category:** security
**Description:** Dev logs use `__DEV__` check but production logging not shown; unclear if logs go to analytics.
**Impact:** Sensitive upload data may be logged if __DEV__ is defined incorrectly.
**Fix hint:** Always strip sensitive data from logs; use whitelist approach.

### [CA-PAY-061] No rate limiting on payment method API calls
**Severity:** MEDIUM
**File:** app/payment-methods.tsx (implied, loadPaymentMethods)
**Category:** api
**Description:** `getPaymentMethods()` can be called multiple times without rate limit.
**Impact:** Rapid navigation can spam backend with duplicate requests.
**Fix hint:** Add request deduplication or 5-min cache for payment methods.

### [CA-PAY-062] Incomplete transaction status on network error cannot be recovered
**Severity:** HIGH
**File:** app/transactions/incomplete.tsx (implied)
**Category:** error-handling
**Description:** If transaction fetch fails mid-load, incomplete transactions cannot be retried.
**Impact:** User stuck viewing stale/incomplete transaction list forever.
**Fix hint:** Provide explicit "Retry" button on transaction list error state.

### [CA-PAY-063] RazorpayService key ID used but never verified against backend
**Severity:** MEDIUM
**File:** services/razorpayService.ts:34-48
**Category:** security
**Description:** Key ID from environment never validated; stale key used if env not reloaded.
**Impact:** If Razorpay rotates keys, old app instances still use old key; failures.
**Fix hint:** Fetch valid key ID from backend on app start, compare with env.

### [CA-PAY-064] No analytics for payment failures, only success
**Severity:** LOW
**File:** app/payment-razorpay.tsx (implied)
**Category:** validation
**Description:** `handlePaymentFailure()` does not log analytics event.
**Impact:** No visibility into why payments fail; support team blind.
**Fix hint:** Log failure reason, error code, payment method to analytics.

### [CA-PAY-065] Order confirmation waits for multiple order fetches but doesn't timeout
**Severity:** MEDIUM
**File:** app/payment-success.tsx:130-135
**Category:** error-handling
**Description:** `Promise.all()` on order fetches has no timeout; can hang forever.
**Impact:** Payment success screen frozen if backend is slow.
**Fix hint:** Wrap Promise.all with timeout: `Promise.race([Promise.all(...), timeoutPromise])`.
```