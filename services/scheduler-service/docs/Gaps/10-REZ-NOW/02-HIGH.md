# ReZ NoW — HIGH Issues (15)

**Fix before public launch. Significant business impact.**

---

## NW-HIGH-001: ServicesCatalog and AppointmentsCatalog are no-op placeholders

- **Categories:** 1 (Functional), 13 (Architecture)
- **Severity:** HIGH
- **Files:**
  - `components/catalog/ServicesCatalog.tsx`
  - `components/catalog/AppointmentsCatalog.tsx`
- **Finding:** Both components return hardcoded "coming soon" placeholder text. The `StoreInfo.displayMode` can be `'services'` or `'appointments'`, which would render these components to real users who enabled these store modes. No API calls are made, no slots are fetched, no booking flow exists.
- **Impact:** Service businesses and appointment-based stores (salons, clinics) see "coming soon" with no way to accept bookings.
- **Fix:** Either implement fully or gate behind a feature flag and remove the nav option.

---

## NW-HIGH-002: handleApplyFromModal calls undefined applyCode function

- **Categories:** 1 (Functional), 13 (Architecture)
- **Severity:** HIGH — runtime crash
- **File:** `components/cart/CouponInput.tsx:56-65`
- **Finding:** `handleApplyFromModal` calls `applyCode(selectedCode)` at line 61, but `applyCode` is not a function in scope. This is a silent runtime error — clicking "Apply" from the OffersModal when not logged in throws `applyCode is not defined`.
- **Impact:** Coupon flow breaks entirely for logged-out users.
- **Fix:** Rename inner `applyCode` function (line 67) to `applyCodeInternal` and call that from both `handleApply` and `handleApplyFromModal`.

---

## NW-HIGH-003: ReservationSuggestion POSTs directly to non-existent endpoint

- **Categories:** 1 (Functional), 13 (Architecture)
- **Severity:** HIGH — AI chat reservations silently fail
- **File:** `components/chat/ReservationSuggestion.tsx:60-91`
- **Finding:** The component POSTs directly to `/api/reservations` using raw `fetch`, bypassing the typed `createReservation` function in `lib/api/reservations.ts`. There is likely no `/api/reservations` route in the Next.js app.
- **Impact:** Reservation confirmations from AI chat suggestions silently fail.
- **Fix:** Replace `fetch` call with `createReservation(storeSlug, params)` from `lib/api/reservations.ts`.

---

## NW-HIGH-004: Auth refresh queue silently swallows failures for all queued requests

- **Categories:** 11 (Security)
- **Severity:** HIGH
- **File:** `lib/api/client.ts:150-160`
- **Finding:** When token refresh fails, every request queued waiting for the refresh gets silently rejected. The `rez:session-expired` event fires, but if the handler has a bug, all queued API calls fail with no feedback.
- **Impact:** Multiple API calls silently fail after token expiry. User sees no indication of why.
- **Fix:** Reject each queued promise explicitly with `refreshQueue.forEach((cb) => cb(data.accessToken ?? ''))`.

---

## NW-HIGH-005: BillStatus type uses lowercase; code uses uppercase variants not in type

- **Categories:** 4 (Enum/Status)
- **Severity:** HIGH
- **Files:**
  - `lib/types/index.ts:264`
  - `app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:23`
  - `components/merchant/reconcile/TransactionList.tsx:39`
- **Finding:** `BillStatus` is `'pending' | 'paid' | 'cancelled' | 'expired'` (lowercase). But PayDisplayClient defines its own `PendingPayment` with `'pending' | 'confirmed' | 'rejected'` — where `'confirmed'` and `'rejected'` are NOT in `BillStatus`. `TransactionList` uses `'completed' | 'pending'`. No consistent status enum exists.
- **Impact:** TypeScript type narrowing on `bill.status === 'confirmed'` always returns false.
- **Fix:** Define a canonical `PaymentStatus` union: `'pending' | 'confirmed' | 'rejected' | 'cancelled'` and use it everywhere.
- **Cross-Repo:** Related to enum fragmentation in `09-CROSS-SERVICE-2026/ENUM-FRAGMENTATION.md`

---

## NW-HIGH-006: Reconcile amounts double-divided if backend sends rupees instead of paise

- **Categories:** 2 (Data & Sync)
- **Severity:** HIGH
- **File:** `components/merchant/reconcile/TransactionList.tsx:24-26`
- **Finding:** `formatPaise(tx.amount)` calls `formatINR(tx.amount / 100)`. If the backend sends `amount` in rupees instead of paise (common bug), the display is 100x too small.
- **Impact:** A Rs 500 payment displays as Rs 5. Merchant reconciliation is completely wrong.
- **Fix:** Add explicit unit validation. Assert amounts > 10000 (assuming no legitimate transaction < Rs 100). Document unit in type definition.

---

## NW-HIGH-007: redeemStamps has no idempotency key — race condition on rapid clicks

- **Categories:** 5 (Business Logic), 6 (Payment)
- **Severity:** HIGH
- **Files:**
  - `lib/api/loyalty.ts:30-39`
  - `components/order/LoyaltyWidget.tsx:112-129`
- **Finding:** `redeemStamps(storeSlug)` sends the request with auth headers but the backend has no idempotency protection. If the user spams "Confirm" rapidly, multiple requests could be in-flight before the backend confirms the first.
- **Impact:** Race condition could cause double reward code generation.
- **Fix:** Add idempotency key: `makeIdempotencyKey('loyalty-redeem', storeSlug + userId)`.

---

## NW-HIGH-008: Client-side coupon validation without server re-validation at checkout

- **Categories:** 5 (Business Logic)
- **Severity:** HIGH
- **File:** `components/checkout/CouponInput.tsx:41-69`
- **Finding:** `applyCode` does a client-side `coupons.find()` against a cached list. No server-side validation at checkout time.
- **Impact:** A user could modify the JS to apply any coupon. If the checkout API trusts client-submitted coupon codes without server re-validation, unauthorized discounts result.
- **Fix:** Always call `POST /api/web-ordering/coupon/validate` server-side at checkout time.

---

## NW-HIGH-009: Client-side prices in localStorage — can be manipulated before checkout

- **Categories:** 11 (Security)
- **Severity:** HIGH
- **File:** `lib/api/payment.ts:20-26`
- **Finding:** `createRazorpayOrder` accepts `subtotal` from the client. `CartItem.price` comes from the cart store which is client-state (persisted in localStorage).
- **Impact:** A user with technical knowledge could modify cart prices in localStorage and pay less than the actual order value.
- **Fix:** Backend must re-validate prices from the canonical catalog source, not trust client-submitted prices.

---

## NW-HIGH-010: getWaiterCallStatus extracts wrong nested field — always returns 'pending'

- **Categories:** 4 (Enum/Status)
- **Severity:** HIGH
- **File:** `lib/api/waiter.ts:35-40`
- **Finding:** `getWaiterCallStatus` returns `{ status: data.status ?? data.data?.status ?? 'pending' }`. If the backend returns `status: 'resolved'` nested in `data.data`, the outer `data.status` (the Axios response status code, e.g., `200`) would be used first, producing `status: 200` which falls through to `'pending'`.
- **Impact:** Waiter call status is always `'pending'` regardless of actual backend state.
- **Fix:** Extract from the correct nested path: `data.data?.status ?? 'pending'`.

---

## NW-HIGH-011: Pay-display socket dedup uses stale closure — payments added as duplicates

- **Categories:** 7 (Real-time Sync)
- **Severity:** HIGH
- **File:** `app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:125-131`
- **Finding:** The `socket.on('payment:received')` handler references `payments` from the closure created at mount time. If 5 payments arrive before `fetchRecentPayments` resolves, the dedup check uses an empty array.
- **Impact:** Duplicate payment cards appear in the kiosk. A merchant could confirm the same payment multiple times.
- **Fix:** Use a ref for dedup checking: `seenRef.current.has(payment.id)` with ref updates on each payment.

---

## NW-HIGH-012: OrderHistoryItem defined twice with incompatible shapes

- **Categories:** 3 (API Contract), 4 (Enum/Status)
- **Severity:** HIGH
- **Files:**
  - `lib/types/index.ts:164-172`
  - `lib/api/orderHistory.ts:3-13`
- **Finding:** `OrderHistoryItem` in types uses `status: WebOrderStatus` (typed). `OrderHistoryItem` in API layer uses `status: string` (untyped). The API layer adds `paymentStatus`, `storeLogo`, `scheduledFor` fields not in the canonical type.
- **Impact:** TypeScript cannot enforce correctness. Status values outside the union fall through silently.
- **Fix:** Delete the duplicate in `lib/api/orderHistory.ts`. Extend the canonical `OrderHistoryItem` with missing fields.

---

## NW-HIGH-013: cancelOrder endpoint path inconsistent — orders vs order (plural)

- **Categories:** 3 (API Contract)
- **Files:**
  - `lib/api/cancellation.ts:7-9` — `POST /api/web-ordering/orders/${orderNumber}/cancel`
  - `lib/api/orders.ts:11` — `POST /api/web-ordering/order/${orderNumber}/cancel` (singular!)
- **Finding:** These are two different endpoints. One uses `orders`, the other uses `order`. If both are called in different code paths, behavior may differ.
- **Impact:** Cancellation may hit the wrong handler depending on which import is used.
- **Fix:** Consolidate to one endpoint. Deprecate the duplicate.

---

## NW-HIGH-014: verifyPayment (order payment) missing idempotency key

- **Categories:** 3 (API Contract), 6 (Payment)
- **Severity:** HIGH
- **File:** `lib/api/payment.ts:28-40`
- **Finding:** `verifyPayment` sends no `Idempotency-Key` header. If the verification request is retried due to a network error, the backend could process the verification twice.
- **Impact:** On retry, the same order could be verified twice. Combined with missing signature verification (NW-CRIT-002), this creates payment processing risks.
- **Fix:** Add `Idempotency-Key` header: `makeIdempotencyKey('verify-order', orderNumber)`.

---

## NW-HIGH-015: pending_payment status absent from STATUS_STEPS — progress bar silent

- **Categories:** 1 (Functional), 7 (Real-time)
- **Severity:** HIGH
- **File:** `app/[storeSlug]/order/[orderNumber]/page.tsx:27`
- **Finding:** `STATUS_STEPS` is `['confirmed', 'preparing', 'ready', 'completed']`. The `pending_payment` status (set when a Razorpay order is created but payment is not yet confirmed) is excluded. The progress bar silently does nothing.
- **Impact:** Users in `pending_payment` state have no clear action path. The order page shows a spinner indefinitely.
- **Fix:** Add `pending_payment` as the first step or handle it with a dedicated UI state that offers a "Retry payment" button.

---

## Status Tracking

| ID | Title | Status | Fixed By | Commit |
|----|-------|--------|----------|--------|
| NW-HIGH-001 | ServicesCatalog/AppointmentsCatalog placeholders | OPEN | — | — |
| NW-HIGH-002 | applyCode undefined function crash | OPEN | — | — |
| NW-HIGH-003 | ReservationSuggestion wrong endpoint | OPEN | — | — |
| NW-HIGH-004 | Auth refresh queue swallows failures | OPEN | — | — |
| NW-HIGH-005 | BillStatus type/enum inconsistency | OPEN | — | — |
| NW-HIGH-006 | Reconcile amounts unit ambiguity | OPEN | — | — |
| NW-HIGH-007 | redeemStamps no idempotency key | OPEN | — | — |
| NW-HIGH-008 | Checkout coupon client-side only | OPEN | — | — |
| NW-HIGH-009 | Client-side prices manipulatable | OPEN | — | — |
| NW-HIGH-010 | WaiterCallStatus wrong field extraction | OPEN | — | — |
| NW-HIGH-011 | Pay-display socket dedup stale closure | OPEN | — | — |
| NW-HIGH-012 | OrderHistoryItem duplicate definition | OPEN | — | — |
| NW-HIGH-013 | cancelOrder endpoint path inconsistency | OPEN | — | — |
| NW-HIGH-014 | verifyPayment no idempotency key | OPEN | — | — |
| NW-HIGH-015 | pending_payment not in STATUS_STEPS | OPEN | — | — |
