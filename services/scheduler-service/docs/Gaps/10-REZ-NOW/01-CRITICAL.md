# ReZ NoW — CRITICAL Issues (14)

**Fix before any deployment. These involve real money loss, security breaches, or silent data destruction.**

---

## NW-CRIT-001: Idempotency key uses `Date.now()` — double coin credit on retry

- **Categories:** 6 (Payment), 11 (Security)
- **Severity:** CRITICAL — real money loss
- **Files:**
  - `lib/api/client.ts:73-75`
  - `lib/api/orders.ts:67`
  - `lib/api/scanPayment.ts:34`
- **Finding:** `makeIdempotencyKey` embeds `Date.now()` in the key. Every retry generates a new key. If `creditCoins` or `creditScanPayCoins` is called twice (network timeout + retry), both requests reach the backend as distinct operations.
- **Impact:** Users receive double coin credits. Real money loss with no detection.
- **Fix:** Remove `Date.now()` — use `${type}:${key}` as the idempotency key.
  ```typescript
  // BROKEN
  return `${type}:${key}:${Date.now()}`;
  // FIXED
  return `${type}:${key}`;
  ```
- **Cross-Repo:** Related to XF-1 (fire-and-forget coin credits) in `09-CROSS-SERVICE-2026/XF-1-FIRE-AND-FORGET.md`

---

## NW-CRIT-002: Payment verification always returns `{ verified: true }`

- **Categories:** 6 (Payment), 11 (Security)
- **Severity:** CRITICAL
- **Files:**
  - `lib/api/payment.ts:38-39`
  - `lib/api/scanPayment.ts:26-27`
  - `app/[storeSlug]/pay/checkout/page.tsx:157-165`
- **Finding:** `verifyPayment` and `verifyScanPayment` hardcode `return { verified: true }` after checking `data.success`. The actual Razorpay signature verification result from the backend is ignored. The Razorpay `handler` callback never captures `response.razorpay_signature` — it's missing entirely.
- **Impact:** Fake payments can be credited to wallets if the backend signature check has any gap.
- **Fix:** Capture `response.razorpay_signature` in the handler. Extract `data.data?.verified` from the backend response.

---

## NW-CRIT-003: Merchant panel has zero auth protection

- **Categories:** 11 (Security)
- **Severity:** CRITICAL — live data exposure
- **File:** `middleware.ts:14`
- **Finding:** `PROTECTED_PATHS` covers `['/profile', '/orders', '/wallet', '/checkout']`. All `/merchant/*` routes — dashboard, bill-builder, pay-display, reconcile — are completely open. Any person who guesses or enumerates a store slug can access merchant features.
- **Impact:** Full merchant panel takeover. Revenue data exposed. Payment confirm/reject actions available to anyone.
- **Fix:** Add `/merchant` to `PROTECTED_PATHS`. Require role-scoped JWT with store ownership verification.

---

## NW-CRIT-004: Socket.IO connects once per menu item — N items = N WebSocket connections

- **Categories:** 10 (Performance), 13 (Architecture)
- **Severity:** CRITICAL — infrastructure failure
- **File:** `components/menu/MenuItem.tsx:36-59`
- **Finding:** Every `MenuItem` component mounts its own Socket.IO connection. A store with 30 menu items opens 30 simultaneous WebSocket connections to the same host.
- **Impact:** Browser connection limits exhausted. Pages freeze on mobile. Server WebSocket infrastructure fails under load.
- **Fix:** Create a single shared Socket.IO connection per store via React context or Zustand store.

---

## NW-CRIT-005: Waiter call endpoints have no authorization

- **Categories:** 11 (Security)
- **Severity:** CRITICAL
- **Files:**
  - `lib/api/waiter.ts:22-28` (customer calls waiter — publicClient)
  - `lib/api/waiterStaff.ts:28-37` (staff resolves calls — publicClient)
- **Finding:** Both endpoints use `publicClient` (no auth). `updateCallStatus` has no store-slug check and no ownership validation. An attacker can call or cancel waiter calls for any store.
- **Impact:** Denial of service on waiter calls. Trolls cancel all waiter calls at a busy restaurant.
- **Fix:** All waiter endpoints require `authClient` with store-scoped JWT. Server must verify the call's `storeSlug` matches the authenticated user's access.

---

## NW-CRIT-006: 10-second payment timeout shows fake success UI

- **Categories:** 6 (Payment), 7 (Real-time)
- **Severity:** CRITICAL — chargeback risk
- **Files:**
  - `lib/hooks/usePaymentConfirmation.ts:68-74`
  - `app/[storeSlug]/pay/confirm/[paymentId]/page.tsx`
- **Finding:** After 10s timeout, the confirm page sets `setConfirmed(true)` and shows "Payment Successful!" — full success UI including coin earnings. Razorpay UPI payments can take up to 15 minutes.
- **Impact:** User sees paid confirmation while payment may still be pending. User leaves, later disputes the charge.
- **Fix:** After timeout, show "Payment may still be processing — check back in a few minutes." Add a "Check payment status" button that polls the backend.

---

## NW-CRIT-007: Offline queue silently discards orders after MAX_RETRIES

- **Categories:** 8 (Offline), 6 (Payment)
- **Severity:** CRITICAL — silent data loss with financial impact
- **File:** `lib/utils/offlineQueue.ts:123-127`
- **Finding:** After 3 failed retries, the IndexedDB record is deleted with no user notification. No toast, no banner, no retry button.
- **Impact:** User pays, order submission fails 3 times, user has no confirmation. Real financial loss with no trace.
- **Fix:** Emit a `rez:order-sync-failed` custom event. Show a persistent banner: "Order couldn't be synced. Contact support."
- **Cross-Repo:** Similar pattern in `rez-app-consumer` offline queue (GEN-11 NA-CRIT-03)

---

## NW-CRIT-008: Pay-display confirm/reject API paths are structurally wrong

- **Categories:** 3 (API Contract), 6 (Payment)
- **Severity:** CRITICAL — merchant actions silently fail
- **File:** `app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:54-69`
- **Finding:** Both `confirmPayment` and `rejectPayment` use `paymentId` as the URL path segment: `/api/web-ordering/store/{paymentId}/confirm`. The correct path is `/api/web-ordering/store/{storeSlug}/payments/{paymentId}/confirm`. The `storeSlug` is available but unused.
- **Impact:** API returns 404. Merchant confirm/reject actions silently fail. Payments stuck in limbo.
- **Fix:** Change URLs to `.../store/${storeSlug}/payments/${paymentId}/confirm|reject`.

---

## NW-CRIT-009: Reorder creates `price: 0` items

- **Categories:** 1 (Functional), 5 (Business Logic)
- **Severity:** CRITICAL — merchant loses all revenue on reorder
- **Files:**
  - `app/orders/OrderHistoryClient.tsx:271-283`
  - `lib/api/reorder.ts:66-82`
- **Finding:** `handleReorder` sets both `price` and `basePrice` to `0` when adding items to cart. `itemId` is set to `item.name` (e.g., "Butter Chicken"), not the actual `menuItemId`.
- **Impact:** Merchant loses full revenue on every reorder. Customer gets free food.
- **Fix:** Use the real `menuItemId` and preserve the original `price` from `OrderResponse.data.items[i]`.

---

## NW-CRIT-010: ScanPayOrderResponse.paymentId doesn't exist in backend response

- **Categories:** 3 (API Contract)
- **Severity:** CRITICAL — silent payment tracking failure
- **Files:**
  - `lib/types/index.ts:286-292`
  - `lib/api/scanPayment.ts:4-14`
- **Finding:** `ScanPayOrderResponse` defines `paymentId`, but `createScanPayOrder` only returns `{ razorpayOrderId, amount, currency, keyId }`. `paymentId` comes from the Razorpay SDK callback after UPI completes, not from backend order creation.
- **Impact:** Any code reading `.paymentId` gets `undefined`. Payment tracking and coin credit fail silently.
- **Fix:** Remove `paymentId` from `ScanPayOrderResponse`. `paymentId` is only available from the Razorpay SDK callback.

---

## NW-CRIT-011: Coupon endpoint enumerable + unauthenticated coupon list

- **Categories:** 11 (Security)
- **Severity:** CRITICAL
- **Files:**
  - `lib/api/cart.ts:16-27`
  - `lib/api/coupons.ts:12-18`
- **Finding:** `validateCoupon` has no rate limiting — an attacker can brute-force enumerate all valid coupon codes. `getStoreCoupons` uses `publicClient` (no auth) and reveals the full active coupon list to anyone.
- **Impact:** High-value coupons discovered and exploited across all attacker orders.
- **Fix:** Require CAPTCHA after 3 failed attempts per user per hour. Don't expose coupon codes to unauthenticated users.
- **Cross-Repo:** Similar coupon validation gaps in `rez-app-consumer` (GEN-11)

---

## NW-CRIT-012: UPI socket subscribes to razorpayOrderId instead of paymentId

- **Categories:** 7 (Real-time Sync)
- **Severity:** CRITICAL — UPI payments always show "timed out"
- **File:** `components/checkout/PaymentOptions.tsx:95-103`
- **Finding:** When UPI is selected, `startUPIPayment` subscribes to `razorpayOrderId`. But UPI payments use a separate `paymentId` from the backend. The `payment:confirmed` event fires with the UPI `paymentId`, which doesn't match the subscription.
- **Impact:** Payment succeeds in Razorpay but the UI shows "timed out" anyway. User pays and sees failure screen. Chargeback likely.
- **Fix:** Call backend to initiate UPI intent (returns a `paymentId`), then subscribe using that `paymentId`.

---

## NW-CRIT-013: NFC creates a Razorpay order with zero user confirmation

- **Categories:** 11 (Security), 1 (Functional)
- **Severity:** CRITICAL
- **File:** `app/[storeSlug]/pay/checkout/page.tsx:182-212`
- **Finding:** `handleNfcConfirmed` immediately calls `createScanPayOrder` when an NFC tag is read — no user confirmation, no amount review. Every NFC tap creates a new order even if one was already created.
- **Impact:** Phantom Razorpay orders created on repeated NFC taps. Account spam. Potential unauthorized charges.
- **Fix:** Require user confirmation before order creation. Check for existing pending orders before creating new ones.

---

## NW-CRIT-014: Tokens stored in plain localStorage — XSS exposure

- **Categories:** 11 (Security)
- **Severity:** CRITICAL — full account takeover via XSS
- **File:** `lib/api/client.ts:37-51`
- **Finding:** Both `accessToken` and `refreshToken` are stored in plain text in `localStorage`. Any XSS vector (store page, third-party script, browser extension) can read and replay these tokens.
- **Impact:** Full account takeover via any injected script.
- **Fix:** Store tokens in `httpOnly` cookies set by the backend on login. If localStorage is unavoidable, encrypt with a key derived from the user agent.
- **Cross-Repo:** Related to NW-CRIT-011 (tokens in AsyncStorage) in `06-CONSUMER-AUDIT-2026/01-CRITICAL.md`

---

## Status Tracking

| ID | Title | Status | Fixed By | Commit |
|----|-------|--------|----------|--------|
| NW-CRIT-001 | Idempotency key Date.now() | OPEN | — | — |
| NW-CRIT-002 | Payment verification hardcoded true | OPEN | — | — |
| NW-CRIT-003 | Merchant routes unprotected | OPEN | — | — |
| NW-CRIT-004 | N Socket.IO connections per menu | OPEN | — | — |
| NW-CRIT-005 | Waiter endpoints unauthenticated | OPEN | — | — |
| NW-CRIT-006 | 10s timeout shows fake success | OPEN | — | — |
| NW-CRIT-007 | Offline queue silently discards | OPEN | — | — |
| NW-CRIT-008 | Pay-display API paths wrong | OPEN | — | — |
| NW-CRIT-009 | Reorder creates price:0 items | OPEN | — | — |
| NW-CRIT-010 | paymentId not in backend response | OPEN | — | — |
| NW-CRIT-011 | Coupon enumeration + unauth list | OPEN | — | — |
| NW-CRIT-012 | UPI socket subscribes to wrong ID | OPEN | — | — |
| NW-CRIT-013 | NFC creates orders without confirm | OPEN | — | — |
| NW-CRIT-014 | Tokens in plain localStorage | OPEN | — | — |
