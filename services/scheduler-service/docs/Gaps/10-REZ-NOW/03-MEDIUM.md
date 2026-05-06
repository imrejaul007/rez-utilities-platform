# ReZ NoW — MEDIUM Issues (60)

**Fix within 1-2 sprints.**

---

## NW-MED-001: showToast called with object instead of positional args

- **Categories:** 1 (Functional)
- **Severity:** MEDIUM
- **File:** `components/order/PrintReceipt.tsx:73-76, 79-82, 85-88`
- **Finding:** `showToast({ message: '...', type: 'success' })` is called with an object, but the `useUIStore` signature is `showToast(message: string, type?: string)`. The toast will display `[object Object]` or silently fail.
- **Impact:** After printing, users see no feedback or see garbage text instead of "Receipt sent to printer".
- **Fix:** Change all `showToast({ message: ..., type: ... })` to `showToast('Receipt sent to printer', 'success')`.

---

## NW-MED-002: reorder.ts silently swallows all errors including network failures

- **Categories:** 1 (Functional), 12 (Edge Cases)
- **Severity:** MEDIUM
- **File:** `lib/api/reorder.ts:44-90`
- **Finding:** The `prefillCartFromOrder` function wraps everything in a `try/catch` that silently returns `false`. If the backend returns an item with `quantity: 0`, the loop corrects it to 1 silently.
- **Impact:** Silent failures give no user feedback. Malformed quantities are silently normalized.
- **Fix:** Log errors to telemetry. Distinguish between "item not found" (silent) and "network error" (show toast).

---

## NW-MED-003: Rating submission accepts any number — no range validation

- **Categories:** 1 (Functional)
- **Severity:** MEDIUM
- **File:** `lib/api/orders.ts:15-28`
- **Finding:** `rateOrder` accepts `rating: number` with no `rating < 1 || rating > 5` guard. Extremely long comments are accepted.
- **Impact:** Users can submit `rating: 0` or `rating: 999`. Wastes server resources.
- **Fix:** Add `if (!Number.isInteger(rating) || rating < 1 || rating > 5)` throw. Limit comments to 1000 chars.

---

## NW-MED-004: Status string comparison may fail on case mismatch

- **Categories:** 4 (Enum/Status)
- **Severity:** MEDIUM
- **File:** `lib/hooks/useOrderPolling.ts:9`
- **Finding:** `TERMINAL_STATUSES` uses lowercase. If the backend ever returns `'COMPLETED'` or `'Completed'`, `TERMINAL_STATUSES.includes(order.status)` silently fails.
- **Impact:** Polling never stops. UI shows "preparing" forever even when order is done.
- **Fix:** Normalize status to lowercase at the API boundary via Axios response interceptor.

---

## NW-MED-005: Coupon and AvailableCoupon interfaces incompatible

- **Categories:** 3 (API Contract)
- **Severity:** MEDIUM
- **Files:**
  - `lib/api/coupons.ts:3-10` — `Coupon` with `minOrderValue`
  - `lib/types/index.ts:227-233` — `AvailableCoupon` with `minOrderAmount` (different name!)
- **Finding:** The two interfaces have the same fields under different names. `getStoreCoupons` returns `Coupon[]` but consumers expect `AvailableCoupon[]`.
- **Impact:** TypeScript may catch this at compile time, but if the backend changes the response shape, they diverge silently.
- **Fix:** Use a single `Coupon` interface. Remove the duplicate `AvailableCoupon` type.

---

## NW-MED-006: cancelOrder has no idempotency key — double cancellation possible

- **Categories:** 6 (Payment)
- **Severity:** MEDIUM
- **File:** `lib/api/cancellation.ts`
- **Finding:** `cancelOrder` sends `{ reason }` with no idempotency key. If the network times out after the backend processes cancellation but before the response reaches the frontend, retrying could trigger double-cancellation.
- **Impact:** Race condition on order cancellation. Potential double refunds.
- **Fix:** Add `makeIdempotencyKey('cancel', orderNumber)`.

---

## NW-MED-007: WalletBalance.rupees stored vs derived ambiguity

- **Categories:** 5 (Business Logic), 12 (Edge Cases)
- **Severity:** MEDIUM
- **Files:**
  - `lib/types/index.ts:186`
  - `app/wallet/WalletClient.tsx:83-88`
- **Finding:** `rupees = coins / 100` is a derived field. If the backend ever sends `rupees` independently, the frontend would show different values. Fractional rupee values (e.g., "Rs 1.50") are possible.
- **Impact:** Display shows fractional rupee values or inconsistent amounts.
- **Fix:** Always compute `rupees` client-side from `coins`. Remove `rupees` from interface or document it as derived.

---

## NW-MED-008: Socket not cleaned up when UPI modal closes

- **Categories:** 7 (Real-time Sync)
- **Severity:** MEDIUM
- **File:** `components/checkout/PaymentOptions.tsx:107-110`
- **Finding:** When the user closes the UPI waiting modal, the socket remains connected and subscribed. If a late `payment:confirmed` event arrives after dismissal, it can trigger an unexpected `window.location.href` redirect.
- **Impact:** Race condition that could redirect users mid-flow.
- **Fix:** Call `disconnect()` from `usePaymentConfirmation` when the modal closes.

---

## NW-MED-009: Socket connect failure silently hangs — no user feedback

- **Categories:** 7 (Real-time Sync)
- **Severity:** MEDIUM
- **File:** `lib/hooks/usePaymentConfirmation.ts:103-105`
- **Finding:** `socket.on('connect_error', () => { })` — empty handler. If the server is unreachable, the user sees "Payment timed out" after 10s instead of "Cannot connect to server."
- **Impact:** Confusing error messages when server is down.
- **Fix:** On `connect_error`, set a `connectionFailed` flag and shorten the timeout to 5s.

---

## NW-MED-010: Multiple Socket.IO connections on rapid modal open/close

- **Categories:** 7 (Real-time Sync), 10 (Performance)
- **Severity:** MEDIUM
- **File:** `lib/hooks/usePaymentConfirmation.ts:62-106`
- **Finding:** Each `subscribe()` call creates a new Socket.IO connection. Rapid open/close cycles accumulate orphan connections.
- **Impact:** Browser resource leaks. Server WebSocket capacity saturation.
- **Fix:** Always call `disconnect()` before creating a new socket.

---

## NW-MED-011: Cart cleared on store switch without confirmation dialog

- **Categories:** 8 (Offline), 9 (UX)
- **Severity:** MEDIUM
- **Files:**
  - `lib/store/cartStore.ts`
  - `app/[storeSlug]/StoreContextProvider.tsx:32-34`
- **Finding:** `setStore` clears the cart when switching stores with no confirmation. Users lose their cart when navigating between stores.
- **Impact:** Lost cart items. Frustrated users who switch between nearby stores.
- **Fix:** Show a confirmation dialog when `cartItems.length > 0` and the user is about to switch stores.

---

## NW-MED-012: authStore.isLoggedIn persists independently of token validity

- **Categories:** 2 (Data & Sync)
- **Severity:** MEDIUM
- **File:** `lib/store/authStore.ts:35-42`
- **Finding:** `partialize` persists both `user` and `isLoggedIn`. But `isLoggedIn` is computed from token presence. If tokens are cleared but zustand rehydrates from old data, `isLoggedIn` could be `true` with no actual tokens.
- **Impact:** UI state desync after hard refresh.
- **Fix:** Derive `isLoggedIn` from token presence. Don't persist it.

---

## NW-MED-013: Coupon.discountValue unit ambiguous (paise vs percent)

- **Categories:** 5 (Business Logic)
- **Severity:** MEDIUM
- **File:** `lib/api/coupons.ts:7`
- **Finding:** `discountType === 'percent'` means `discountValue` is a percentage. `discountType === 'flat'` means `discountValue` is in paise. No JSDoc clarifies the unit.
- **Impact:** Developers misreading the code will compute the wrong discount.
- **Fix:** Add JSDoc or use distinct types with clear unit documentation.

---

## NW-MED-014: UPI fallback fires in 2 seconds — real UPI payments take 5-15s

- **Categories:** 10 (Performance)
- **Severity:** MEDIUM
- **File:** `components/checkout/PaymentOptions.tsx:102` + `lib/utils/upi.ts:68`
- **Finding:** `openUPIApp(upiLinks[urlKey], fallbackUrl, 2000)` — 2 seconds is far too aggressive. Real UPI payments routinely take 5-15 seconds.
- **Impact:** False "Payment timed out" on legitimate UPI payments. Users abandon and pay again → double charge risk.
- **Fix:** Increase to 15000ms. Add a visible countdown timer in the modal.

---

## NW-MED-015: Razorpay script loaded on every page mount — 150KB blocking

- **Categories:** 10 (Performance)
- **Severity:** MEDIUM
- **File:** `lib/hooks/useRazorpay.ts:45-56`
- **Finding:** The Razorpay script (~150KB) is loaded on every page mount, even on pages that never initiate a payment.
- **Impact:** Blocked page render on slow 3G connections.
- **Fix:** Use `<link rel="preload">` in the `<head>` for the payment page only, or lazy-load when the user reaches the payment step.

---

## NW-MED-016: OffersModal re-fetches coupons on every modal open — no caching

- **Categories:** 10 (Performance)
- **Severity:** MEDIUM
- **File:** `components/cart/OffersModal.tsx:76-84`
- **Finding:** `getAvailableCoupons(storeSlug)` fires on every modal open. Rapid open/close cycles generate N network requests.
- **Impact:** Unnecessary API calls. Poor performance on slow networks.
- **Fix:** Cache coupons in component state or module-level variable with a 5-minute TTL.

---

## NW-MED-017: search.ts uses raw fetch — bypasses Axios deduplication

- **Categories:** 10 (Performance), 13 (Architecture)
- **Severity:** MEDIUM
- **File:** `lib/api/search.ts`
- **Finding:** `searchStores` and `getFeaturedStores` use raw `fetch` with `AbortSignal.timeout(8000)`, not the Axios `publicClient` which has a 15s timeout and request deduplication.
- **Impact:** Redundant HTTP requests on every search. Inconsistent API timeout.
- **Fix:** Use `deduplicatedGet` from `client.ts` or `publicClient.get()` instead of raw `fetch`.

---

## NW-MED-018: UPI retry button doesn't distinguish failure modes

- **Categories:** 9 (UX)
- **Severity:** MEDIUM
- **File:** `components/checkout/PaymentOptions.tsx:240-244`
- **Finding:** The "Retry" button is shown for both timeout and failure states. The resolution path is different for each.
- **Impact:** Users who saw "Payment timed out" may not realize they should check their UPI app first — retrying could cause a double charge.
- **Fix:** After timeout, query `checkPaymentStatus(paymentId)` before showing the retry button.

---

## NW-MED-019: No minimum amount guard before creating Razorpay order

- **Categories:** 9 (UX)
- **Severity:** MEDIUM
- **File:** `lib/api/payment.ts:20-26`
- **Finding:** `createRazorpayOrder` accepts any `subtotal` value. If `subtotal` is `0` (empty cart edge case), a Rs.0 Razorpay order is created.
- **Impact:** Users see a payment UI for a Rs.0 order — confusing and wasteful.
- **Fix:** Validate `if (subtotal < 100) throw new Error('Minimum order amount is Rs.1')` before calling.

---

## NW-MED-020: OffersModal Apply button not disabled when below minimum order

- **Categories:** 9 (UX)
- **Severity:** MEDIUM
- **File:** `components/cart/OffersModal.tsx:145-151`
- **Finding:** Apply buttons are not disabled when `coupon.minOrderAmount` exceeds the current cart subtotal. The user clicks Apply, sees a loading state, then gets an error toast.
- **Impact:** Poor UX — unnecessary API call and error toast.
- **Fix:** Disable Apply buttons for coupons whose `minOrderAmount` exceeds the current cart subtotal.

---

## NW-MED-021: printReceipt browser fallback corrupts binary ESC/POS data

- **Categories:** 1 (Functional), 10 (Performance)
- **Severity:** MEDIUM
- **File:** `lib/hooks/useThermalPrinter.ts:290-306`
- **Finding:** When Bluetooth printing fails, the code does `String.fromCharCode(...receipt)` where `receipt` is a `Uint8Array` of binary ESC/POS bytes. This produces garbled text or throws on large arrays.
- **Impact:** Browser print fallback produces garbage output. Customers cannot print receipts.
- **Fix:** For the text fallback, generate a plain-text HTML receipt (not raw ESC/POS bytes).

---

## NW-MED-022: getFeaturedStores silent failure cached for 5 minutes

- **Categories:** 10 (Performance), 9 (UX)
- **Severity:** MEDIUM
- **File:** `lib/api/search.ts:62-72`
- **Finding:** If `getFeaturedStores()` throws, it falls back to `[]`. The `next: { revalidate: 300 }` caching means a transient failure gets cached for 5 minutes.
- **Impact:** Featured stores section is blank for up to 5 minutes after an API failure. Users may think the app is broken.
- **Fix:** Implement exponential backoff retry (max 3 attempts) before falling back to `[]`. Show a "Could not load" message.

---

## NW-MED-023: SplitBillModal allows 0 or negative amounts

- **Categories:** 12 (Edge Cases)
- **Severity:** MEDIUM
- **File:** `components/checkout/SplitBillModal.tsx`
- **Finding:** `totalAmount` has no validation — could be 0 or negative (manipulated via DevTools). Split math produces invalid per-person amounts.
- **Impact:** Zero-price or negative-price split bills possible.
- **Fix:** Add `if (totalAmount < 100) throw new Error('Bill amount must be at least Rs.1')` guard.

---

## NW-MED-024: localId() in billStore uses Date.now() — collision on same-millisecond calls

- **Categories:** 13 (Architecture)
- **Severity:** MEDIUM
- **File:** `lib/store/billStore.ts:31-33`
- **Finding:** `localId()` uses `Date.now() + ++idCounter`. If two `addItem` calls happen in the same millisecond, they could produce the same ID.
- **Impact:** Race condition in local state — one item overwrites another.
- **Fix:** Use `crypto.randomUUID()` instead of `Date.now()`.

---

## NW-MED-025: NFC data passed to payment handler without validation

- **Categories:** 12 (Edge Cases)
- **Severity:** MEDIUM
- **File:** `components/payment/NfcPayButton.tsx:14-17`
- **Finding:** `onNfcConfirmed(lastRecord.data)` receives raw NFC record data with no validation. A crafted NFC tag could inject arbitrary data.
- **Impact:** Potential data injection into the payment flow.
- **Fix:** Validate the NFC record format before invoking `onNfcConfirmed`.

---

## NW-MED-026: Offline queued orders have no TTL — stale orders submitted days later

- **Categories:** 8 (Offline)
- **Severity:** MEDIUM
- **File:** `lib/utils/offlineQueue.ts`
- **Finding:** An order queued today could be retried after multiple app opens over days. If the store's menu has changed, stale order gets submitted.
- **Impact:** Stale orders submitted at changed prices. Confusing failures.
- **Fix:** Add `createdAt` field. Reject orders older than 24 hours.

---

## NW-MED-027: getScanPayHistory returns untyped data

- **Categories:** 3 (API Contract)
- **Severity:** MEDIUM
- **File:** `lib/api/scanPayment.ts:43-47`
- **Finding:** `return data.data as unknown` — no type contract. Any change to the backend response shape breaks silently.
- **Impact:** Type safety gap. Callers have no IDE autocomplete.
- **Fix:** Define a `ScanPayHistoryItem` interface and return `data.data as ScanPayHistoryItem[]`.

---

## NW-MED-028: auth.ts API paths inconsistent — some have /api prefix, some don't

- **Categories:** 3 (API Contract)
- **Severity:** MEDIUM
- **File:** `lib/api/auth.ts:48-52`
- **Finding:** `refreshToken` calls `/auth/token/refresh` (no `/api`). `sendOtp` and `verifyOtp` use `/api/user/auth/send-otp` (with `/api`). The inconsistency suggests fragile coupling.
- **Impact:** If the backend normalizes to `/api/...` for all endpoints, token refresh silently fails.
- **Fix:** Standardize all API paths with a consistent `/api` prefix. Centralize base path in `client.ts`.

---

## NW-MED-029: No rate limiting on OTP endpoint

- **Categories:** 11 (Security)
- **Severity:** MEDIUM
- **File:** `lib/api/auth.ts:4-12`
- **Finding:** `sendOtp` has no client-side cooldown. An attacker could script rapid OTP requests to any phone number.
- **Impact:** SMS spam. OTP provider cost abuse.
- **Fix:** Disable the send button for 30s after sending. Ensure backend enforces rate limits per IP/phone.

---

## NW-MED-030: BillBuilderStore has no persistence but CartStore does

- **Categories:** 13 (Architecture)
- **Severity:** MEDIUM
- **File:** `lib/store/billStore.ts`
- **Finding:** `CartStore` uses `persist` middleware. `BillBuilderStore` does not. Bill splitting work is lost on page reload.
- **Impact:** Users doing bill splitting on desktop lose all work on reload.
- **Fix:** Add `persist` middleware to `BillBuilderStore` with a 1-hour TTL.

---

## NW-MED-031: console.log used in Socket.IO hooks — fitness test violation

- **Categories:** 13 (Architecture)
- **Severity:** MEDIUM
- **File:** `lib/hooks/useOrderSocket.ts:27, 31, 41`
- **Finding:** `console.log` and `console.warn` calls. Per project fitness tests, all logging must use `rez-shared/telemetry`.
- **Impact:** Fitness test failure on every PR. No centralized log control.
- **Fix:** Replace `console.*` calls with the centralized telemetry logger.

---

## NW-MED-032: SearchHighlight only highlights first occurrence of query

- **Categories:** 9 (UX)
- **Severity:** MEDIUM
- **File:** `components/menu/SearchHighlight.tsx:15-40`
- **Finding:** Only the first occurrence of the search query is highlighted.
- **Impact:** Misleading highlights. Users may miss matching items.
- **Fix:** Use a regex with global flag to replace all occurrences.

---

## NW-MED-033: Checkout page flashes empty before redirect on empty cart

- **Categories:** 9 (UX)
- **Severity:** MEDIUM
- **File:** `app/[storeSlug]/checkout/page.tsx:162-165`
- **Finding:** When `items.length === 0`, `router.replace()` silently redirects. The user sees a flash of the checkout page.
- **Impact:** Confusing UX flash.
- **Fix:** Show a brief "Your cart is empty" toast before redirecting.

---

## NW-MED-034: Waiter cooldown per-tab via sessionStorage — bypassable via multi-tab

- **Categories:** 7 (Real-time Sync)
- **Severity:** MEDIUM
- **File:** `components/menu/WaiterCallButton.tsx:21-29`
- **Finding:** The cooldown uses `sessionStorage` keyed by `storeSlug + tableNumber`. A user with multiple tabs can bypass the cooldown.
- **Impact:** Cooldown is bypassable by multi-tab abuse.
- **Fix:** Use `localStorage` instead of `sessionStorage`. Add server-side rate limiting as the authoritative control.

---

## NW-MED-035: Cancel reason falls back to 'Other' silently when user enters empty custom text

- **Categories:** 1 (Functional)
- **Severity:** MEDIUM
- **File:** `components/order/CancelOrderModal.tsx:35-46`
- **Finding:** `buildReason()` falls back to `'Other'` when `selectedReason === 'other'` and `otherText.trim()` is empty — silently.
- **Impact:** Cancellation reason is generic when user intended to provide specific feedback.
- **Fix:** Require `otherText` when `selectedReason === 'other'` before enabling the submit button.

---

## NW-MED-036: Duplicate push notification implementations with conflicting API paths

- **Categories:** 3 (API Contract), 13 (Architecture)
- **Severity:** MEDIUM
- **Files:**
  - `lib/push/webPush.ts` — POSTs to `/api/web-ordering/push/subscribe`
  - `lib/utils/pushNotifications.ts` — POSTs to `/api/notifications/push-subscribe`
- **Finding:** Two implementations of push subscription exist with **different backend API paths**. `pushNotifications.ts` has `unsubscribeFromPush()` which `webPush.ts` lacks. VAPID key conversion returns `Uint8Array` in `webPush.ts` but `ArrayBuffer` in `pushNotifications.ts`.
- **Impact:** Depending on which implementation is used, push subscriptions are created against the wrong backend endpoint. The `webPush.ts` version silently fails if the backend only has the `/api/notifications/push-subscribe` route.
- **Fix:** Consolidate to one implementation. Determine the correct backend endpoint and use it everywhere. Extract `unsubscribeFromPush` into the shared module.

---

## NW-MED-037: Analytics endpoint unauthenticated + raw fetch bypass

- **Categories:** 11 (Security), 10 (Performance), 13 (Architecture)
- **Severity:** MEDIUM
- **File:** `lib/analytics/events.ts`
- **Finding:** `track()` fires events to `NEXT_PUBLIC_ANALYTICS_URL` using raw `fetch` with `keepalive: true`. User data (userId, storeSlug, orderNumber, amounts) is sent to the analytics endpoint with no auth headers. Raw `fetch` bypasses the Axios deduplication layer and has no timeout.
- **Impact:** User order data sent to an external analytics service without authentication — potential PII exposure. Inconsistent timeout vs Axios (15s). `keepalive: true` sends even after page unload, which may fail silently.
- **Fix:** Add auth headers to the analytics request, or use the Axios `publicClient` with proper timeout. If analytics is internal, add an `Authorization` header with a service token.

---

## NW-MED-038: rateOrder uses publicClient instead of authClient

- **Categories:** 11 (Security)
- **Severity:** MEDIUM
- **File:** `lib/api/orders.ts:22-28`
- **Finding:** `rateOrder` uses `publicClient` (no auth) for a POST request to `/api/web-ordering/orders/${orderNumber}/rating`. While the backend may guard this endpoint by order-number scoping, relying on implicit scoping rather than explicit auth is fragile.
- **Impact:** If the backend doesn't validate that the caller owns the order, anyone can submit ratings for any order number.
- **Fix:** Use `authClient` instead of `publicClient` in `rateOrder`.

---

## NW-MED-039: Offline queue silently discards orders after MAX_RETRIES with no user notification

- **Categories:** 8 (Offline)
- **Severity:** MEDIUM
- **Files:**
  - `lib/utils/offlineQueue.ts:111-134`
- **Finding:** `incrementRetry` deletes the order from IndexedDB when `retries >= MAX_RETRIES` without emitting any event or notifying the user. The `registerBackgroundSync` function silently fails if `SyncManager` is unavailable.
- **Impact:** Users lose their offline orders with no feedback. Fire-and-forget pattern for background sync means failures are invisible.
- **Fix:** Emit a `rez:order-sync-failed` custom event on the window before deleting. Show a persistent banner to the user. Log to telemetry.

---

## NW-MED-040: getBillDetails duplicated with incompatible response shapes across files

- **Categories:** 3 (API Contract)
- **Severity:** MEDIUM
- **Files:**
  - `lib/api/bill.ts:4-9` — uses `publicClient`, returns `MerchantBill`
  - `lib/api/merchantBill.ts:78-82` — uses `publicClient`, returns `BillDetails`
- **Finding:** Two different files expose `getBillDetails` with incompatible types. `bill.ts` returns `MerchantBill` from `types/index.ts`. `merchantBill.ts` returns `BillDetails` (defined locally). The two types have different field sets. Which is the canonical type?
- **Impact:** Type drift. Callers may import from the wrong module and get runtime errors.
- **Fix:** Consolidate to one `getBillDetails` in `lib/api/merchantBill.ts` (the more complete implementation). Delete `lib/api/bill.ts`.

---

## NW-MED-041: getRecommendations has no error handling or type safety

- **Categories:** 1 (Functional), 3 (API Contract)
- **Severity:** MEDIUM
- **File:** `lib/api/store.ts:38-43`
- **Finding:** `getRecommendations` calls `publicClient.get('/api/web-ordering/recommendations', { params: { storeSlug } })` and returns `data.data || []` with no type annotation, no error handling, and no null guard.
- **Impact:** Network failure returns `undefined` instead of `[]`. No type safety for callers. No IDE autocomplete.
- **Fix:** Add a typed return interface (`RecommendationItem[]`). Wrap in try/catch, returning `[]` on error. Validate `data.data` exists before returning.

---

## NW-MED-042: PayDisplayClient constructs malformed API paths — causes 404 on confirm/reject

- **Audit:** Round 2
- **Categories:** 1 (Functional), 2 (API Contract)
- **Severity:** MEDIUM
- **Files:**
  - `app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:54-69`
- **Finding:** `confirmPayment` calls `authClient.post('/api/web-ordering/store/${paymentId}/confirm', ...)` — `${paymentId}` is substituted where the store slug should be. Same bug in `rejectPayment`. Correct path should be `/api/web-ordering/store/${storeSlug}/confirm` with `paymentId` in the request body.
- **Impact:** Every "Confirm" and "Reject" button on the Pay Display kiosk returns HTTP 404. No payment can be manually confirmed or rejected.
- **Related:** NW-CRIT-008 was partially documented but the actual code-level bug is different — NW-CRIT-008 referenced "fix URL paths" but the real issue is `${paymentId}` in the URL instead of `${storeSlug}`.
- **Fix:** Change both URLs to use `${storeSlug}` as the path param. Move `paymentId` into the request body `{ paymentId }`.

---

## NW-MED-043: SearchSection and SearchResultsClient both use raw fetch, bypassing Axios

- **Audit:** Round 2
- **Categories:** 1 (Functional), 2 (API Contract)
- **Severity:** MEDIUM
- **Files:**
  - `app/SearchSection.tsx:164-167`
  - `app/search/SearchResultsClient.tsx:142-144`
- **Finding:** Both search components use raw `fetch()` instead of the Axios client. This bypasses auth token injection, retry deduplication, and error normalization. NW-MED-017 documented the bug for `lib/api/search.ts` but the same issue exists in the UI components that call that endpoint.
- **Impact:** Search requests don't include auth tokens when required. No centralized retry/deduplication. Inconsistent error handling across search surfaces.
- **Fix:** Create a typed `searchStores(q, limit)` function in `lib/api/search.ts` using the Axios client, and have both `SearchSection` and `SearchResultsClient` import and use it.

---

## NW-MED-044: Two push notification implementations with divergent API paths

- **Audit:** Round 1
- **Categories:** 2 (API Contract), 4 (Architecture)
- **Severity:** MEDIUM
- **Files:**
  - `lib/push/webPush.ts:12-15` — uses `/api/web-push/subscribe`
  - `lib/utils/pushNotifications.ts:23-27` — uses `/api/push/subscribe`
- **Finding:** Two separate files implement the same push subscription feature. One calls `/api/web-push/subscribe`, the other calls `/api/push/subscribe`. `PushPromptBanner` imports from `lib/push/webPush.ts` (the one with the wrong path). `ProfileClient` imports from `lib/push/webPush.ts` as well.
- **Impact:** Push subscriptions may fail if the wrong API path doesn't exist. Two separate files to maintain. `subscribeToPush` in `lib/utils/pushNotifications.ts` is completely unused.
- **Fix:** Delete `lib/utils/pushNotifications.ts`. Consolidate on `lib/push/webPush.ts`. Ensure the single implementation calls the correct endpoint `/api/push/subscribe`.

---

## NW-MED-045: Analytics fires unauthenticated with user PII, no rate limiting

- **Audit:** Round 1
- **Categories:** 3 (Business Logic), 4 (Architecture)
- **Severity:** MEDIUM
- **Files:**
  - `lib/analytics/events.ts`
- **Finding:** `track()` fires a raw `fetch()` to `process.env.NEXT_PUBLIC_ANALYTICS_URL` with no auth token and no rate limiting. Payload includes `event.name`, `event.storeSlug`, `event.userId`, `event.userPhone`, and custom `properties`. User phone is sent to a third-party analytics endpoint.
- **Impact:** User PII (phone numbers) sent to analytics without consent. Fire-and-forget pattern means failures are invisible. No rate limiting allows unlimited events.
- **Fix:** Strip PII from analytics payloads. Use a batch queue with a 100-event flush. Add retry on failure. Consider using a privacy-safe analytics proxy.

---

## NW-MED-046: Razorpay key passed as empty string — no validation before payment

- **Audit:** Round 2
- **Categories:** 1 (Functional), 3 (Business Logic)
- **Severity:** MEDIUM
- **Files:**
  - `app/[storeSlug]/pay/checkout/page.tsx:149`
  - `app/[storeSlug]/checkout/page.tsx:222-223`
- **Finding:** `openPayment({ key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '' })` — if the env var is empty string, Razorpay is opened with an empty key and fails. The checkout page has a dev-only console.error but no guard that prevents the call. The scan-pay checkout has no guard at all.
- **Impact:** User clicks Pay, Razorpay popup opens with invalid key, payment fails. User is confused. Confirmed as NW-LOW-024 relates but is more severe — NW-LOW-024 mentions "format validation", this is "empty string" validation.
- **Fix:** Guard at the top of the payment flow: if `!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID`, show a user-facing error message and disable the Pay button, rather than letting it fail at the Razorpay SDK level.

---

## NW-MED-047: `rateOrder` uses `publicClient` instead of `authClient` — rating any order without auth

- **Audit:** Round 1
- **Categories:** 1 (Functional), 3 (Business Logic), 4 (Security)
- **Severity:** MEDIUM
- **File:** `lib/api/orders.ts:15-28`
- **Finding:** `rateOrder` calls `publicClient.post('/api/web-ordering/orders/${orderNumber}/rating', payload, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })` using `publicClient`. This sends no auth token. Any user can rate any order if they know the order number.
- **Impact:** Order rating is unauthenticated. A malicious user could mass-rate orders they didn't place. The `X-Requested-With` header is not a security control — it's trivially spoofable.
- **Fix:** Change to `authClient`. The backend should verify the user owns the order before accepting the rating.

---

## NW-MED-048: `bookAppointment` uses `publicClient` — unauthenticated appointment booking

- **Audit:** Round 3
- **Categories:** 3 (API Contract), 11 (Security)
- **Severity:** MEDIUM
- **File:** `lib/api/catalog.ts:34-37`
- **Finding:** `bookAppointment` uses `publicClient` (no auth) to POST appointment bookings to `/api/appointments/${storeSlug}/book`. The payload includes `customerPhone` and `customerName` — fields that identify a specific person.
- **Impact:** Any unauthenticated user can book appointments at any store on behalf of any phone number. A malicious actor could flood a salon's booking calendar with fake appointments for a competitor's number.
- **Fix:** Use `authClient` instead of `publicClient`. The backend should validate that the authenticated user's phone matches the `customerPhone` field, or the field should be derived server-side from the auth token.

---

## NW-MED-049: KitchenChatDrawer socket unauthenticated — table messages exposed to anyone

- **Audit:** Round 3
- **Categories:** 11 (Security), 12 (Edge Cases)
- **Severity:** MEDIUM
- **File:** `components/table/KitchenChatDrawer.tsx:52-56`
- **Finding:** `io(`${SOCKET_URL}/table`, { transports: ['websocket'], ... })` — the Socket.IO `/table` namespace is connected without any auth token. No `auth` object is passed in the handshake options.
- **Impact:** Anyone who knows the store slug and table number (visible in the URL) can connect to the `/table` namespace and send/receive messages for that table. Customer allergy alerts and special requests are visible to eavesdroppers.
- **Fix:** Pass auth token in the Socket.IO handshake: `io(SOCKET_URL, { auth: { token: getAuthToken() }, ... })`. The backend must validate the token before allowing connection to the table namespace.

---

## NW-MED-050: KitchenChatDrawer unread counter counts ALL messages, not just unread

- **Audit:** Round 3
- **Categories:** 9 (UX), 1 (Functional)
- **Severity:** MEDIUM
- **File:** `components/table/KitchenChatDrawer.tsx:156-159`
- **Finding:** The floating badge shows `messages.length` — the total number of messages ever sent. Once the user opens the drawer and reads all messages, the badge still shows the count. There is no "unread" tracking.
- **Impact:** Badge shows a stale count after messages are read. Users who have already seen their messages still see a notification badge.
- **Fix:** Add a `unreadCount` state that increments on each incoming message while the drawer is closed, and resets to 0 when the drawer is opened.

---

## NW-MED-051: `deduplicatedGet` utility is defined but never used anywhere

- **Audit:** Round 3
- **Categories:** 13 (Architecture)
- **Severity:** MEDIUM
- **File:** `lib/api/client.ts:16-33`
- **Finding:** `deduplicatedGet<T>()` is exported from `lib/api/client.ts` but no file in the codebase imports or calls it. All search, catalog, and store data fetching uses raw `fetch` or Axios directly. The deduplication logic exists but is dead code.
- **Impact:** Wasted development effort. The utility is not being used to deduplicate in-flight requests. Search components (`SearchSection`, `SearchResultsClient`) use raw `fetch` directly instead of this utility.
- **Fix:** Either wire up `deduplicatedGet` in `lib/api/search.ts` and other heavy-read paths, or remove it to avoid misleading future developers into thinking deduplication is implemented.

---

## NW-MED-052: `redeemStamps` URL uses literal template string — loyalty redemption always 404s

- **Audit:** Round 4
- **Categories:** 3 (API Contract), 1 (Functional)
- **Severity:** MEDIUM
- **File:** `lib/api/loyalty.ts:31`
- **Finding:** `` `/api/web-ordering/store/${storeSlug}/loyalty/redeem` `` — the variable `storeSlug` is defined as a function parameter but never used inside the function body. The URL is a literal string that literally contains the characters `${storeSlug}`. Every call to `redeemStamps` hits a 404. Additionally, the function lacks a `data.success` check before accessing `data.rewardCode`.
- **Impact:** Users cannot redeem loyalty stamp rewards. The loyalty widget shows rewards but clicking "Redeem" silently fails.
- **Fix:** Fix the URL to actually interpolate: `` `/api/web-ordering/store/${storeSlug}/loyalty/redeem` `` (ensure the template literal is properly closed). Add `if (!data.success) throw new Error(...)` before accessing fields.

---

## NW-MED-053: `usePaymentConfirmation` socket connect_error swallowed silently

- **Audit:** Round 4
- **Categories:** 1 (Functional), 13 (Architecture)
- **Severity:** MEDIUM
- **File:** `lib/hooks/usePaymentConfirmation.ts:103-105`
- **Finding:** `socket.on('connect_error', () => { ... });` is an empty arrow function — connection errors are silently swallowed with no logging, no user feedback, and no state update. The hook then falls through to polling, but the user has no indication that the real-time channel failed.
- **Impact:** Socket connection failures are invisible to users. Operators cannot diagnose why real-time confirmation isn't working. Users may wait indefinitely if polling also fails silently.
- **Fix:** Log via telemetry logger and set an explicit `connectionFailed: true` state that renders a user-visible warning: "Real-time updates unavailable — check your connection."

---

## NW-MED-054: `useOrderSocket` socket event validates only orderNumber, not storeId

- **Audit:** Round 4
- **Categories:** 11 (Security), 1 (Functional)
- **Severity:** MEDIUM
- **File:** `lib/hooks/useOrderSocket.ts:34-38`
- **Finding:** The `web-order:status-update` event handler checks `data.orderNumber === orderNumber` but does NOT validate `data.storeId`. Any client on the same Socket.IO namespace can broadcast a forged status update for any order number they know.
- **Impact:** A malicious actor who knows an order number can fake order status changes (e.g., mark an order as "completed" before it is). The authorization is implicit by knowing the order number.
- **Fix:** Validate `data.storeId` matches the expected store for the current user before calling `onStatusUpdate`. The backend should also include a signed HMAC or JWT in the socket event to prevent client-side forgery.

---

## NW-MED-055: `usePaymentConfirmation` subscribe race — disconnect + setState ordering bug

- **Audit:** Round 4
- **Categories:** 1 (Functional), 12 (Edge Cases)
- **Severity:** MEDIUM
- **File:** `lib/hooks/usePaymentConfirmation.ts:62-74`
- **Finding:** `subscribe()` calls `disconnect()` (tears down old socket asynchronously) then immediately calls `setState({ phase: 'waiting' })`. If the old socket's `payment:confirmed` handler fires between these two calls, that event is processed, then immediately overwritten by the new `waiting` state — silently losing the payment confirmation.
- **Impact:** A confirmed payment is lost if the user rapidly re-triggers the subscription (e.g., taps "pay" twice, or the UPI app returns before the socket reconnects).
- **Fix:** Set `phase: 'waiting'` before calling `disconnect()`, or use a `subscriptionId` guard: ignore events whose `razorpayOrderId` does not match the current subscription ID.

---

## NW-MED-056: Two `cancelOrder` implementations with conflicting signatures

- **Audit:** Round 4
- **Categories:** 3 (API Contract), 13 (Architecture)
- **Severity:** MEDIUM
- **Files:**
  - `lib/api/cancellation.ts:3-13` — accepts `(orderNumber, reason)`, returns `{ refundInitiated }`, calls `/api/web-ordering/orders/${orderNumber}/cancel` (plural)
  - `lib/api/orders.ts:10-13` — accepts only `(orderNumber)`, returns `void`, calls `/api/web-ordering/order/${orderNumber}/cancel` (singular)
- **Finding:** Two `cancelOrder` functions with three conflicts: parameter shape, return type, and API path. Callers importing from either file get different behavior.
- **Impact:** The `reason` parameter is silently dropped in `orders.ts` (calling code may pass it but it's ignored). The path difference means one may 404 if the backend only supports one convention.
- **Fix:** Delete `cancellation.ts`. Update `orders.ts:cancelOrder` to accept `(orderNumber, reason)` and use the correct API path. Export a single canonical `cancelOrder` from one location.

---

## NW-MED-057: `updateCallStatus` uses `publicClient` for staff-only waiter endpoint

- **Audit:** Round 4
- **Categories:** 11 (Security)
- **Severity:** MEDIUM
- **File:** `lib/api/waiterStaff.ts:32`
- **Finding:** `updateCallStatus` uses `publicClient` (no auth) to PATCH `/api/web-ordering/waiter/call/:requestId`. This is a staff operation — acknowledging or resolving a waiter call.
- **Impact:** Any unauthenticated user can acknowledge their own waiter call, prematurely marking it resolved and denying themselves service. If the backend doesn't enforce ownership, any user can resolve any call.
- **Fix:** Change to `authClient`. Add a comment if this is intentionally public (kiosk mode) and add backend rate limiting.

---

## NW-MED-058: `getWaiterCallStatus` fragile triple-fallback to empty string

- **Audit:** Round 4
- **Categories:** 12 (Edge Cases), 1 (Functional)
- **Severity:** MEDIUM
- **File:** `lib/api/waiter.ts:28`
- **Finding:** `return { success: data.success, requestId: data.data?.requestId ?? data.requestId ?? '' }` — three levels of fallback, with the final default being `''`. If all three resolve to falsy values, callers receive a valid-looking `WaiterCallResponse` with `requestId: ''`.
- **Impact:** Callers polling for waiter call status get a silent success with an empty `requestId`. Downstream calls to `getWaiterCallStatus` with `requestId: ''` may silently fail or create phantom entries.
- **Fix:** Throw an `Error` instead of returning empty string when `requestId` cannot be determined.

---

## NW-MED-059: Duplicate `ReconciliationResult`/`ReconciliationTransaction` definitions

- **Audit:** Round 4
- **Categories:** 13 (Architecture), 3 (API Contract)
- **Severity:** MEDIUM
- **Files:**
  - `lib/api/merchant.ts:33-55`
  - `lib/api/reconcile.ts:3-23`
- **Finding:** Identical interfaces `ReconciliationTransaction` and `ReconciliationResult` are copy-pasted in both files.
- **Impact:** Maintenance hazard — updating one doesn't update the other. If a field is added to one, the other silently diverges.
- **Fix:** Move both interfaces to `lib/types/index.ts` as `ReconciliationTransaction` and `ReconciliationResult`. Import in both API files. Delete the local definitions.

---

## NW-MED-060: `getLoyaltyStatus` returns `data.data` with no `data.success` check

- **Audit:** Round 4
- **Categories:** 1 (Functional), 3 (API Contract)
- **Severity:** MEDIUM
- **File:** `lib/api/loyalty.ts:23-28`
- **Finding:** Unlike every other function in the codebase, `getLoyaltyStatus` does not check `data.success`. If the backend returns `{ success: false, message: "..." }`, the function returns `undefined` silently.
- **Impact:** Callers receive `undefined` and attempt to destructure `.stamps` on undefined, throwing a runtime `TypeError`.
- **Fix:** Add `if (!data.success) throw new Error(data.message || 'Failed to load loyalty status');` before the return.

---

## Status Tracking

All 60 MEDIUM issues are OPEN. Update status as fixes are applied.
