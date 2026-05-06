# ReZ NoW — LOW Issues (50)

**Fix in backlog. Minor polish and naming issues.**

---

## NW-LOW-001: crypto.randomUUID() called in SSR render without polyfill guards

- **File:** `components/store/GoogleReviews.tsx:14`
- **Finding:** `crypto.randomUUID()` called unconditionally. In Next.js SSR contexts, this could fail on older Node.js versions.
- **Fix:** Use React's `useId()` hook for stable IDs instead.

---

## NW-LOW-002: PromoBanner applies arbitrary bgColor strings as inline styles

- **File:** `components/menu/PromoBanner.tsx:20-36`
- **Finding:** `bgColor` string is applied as a Tailwind class name via `resolveClassName` with no sanitization.
- **Fix:** Validate `bgColor` against a whitelist of allowed Tailwind classes.

---

## NW-LOW-003: DeliveryAddress type defined twice in different files

- **Files:** `lib/types/index.ts` and `lib/api/delivery.ts`
- **Finding:** The same type is defined in two places.
- **Fix:** Define once in `lib/types/index.ts` and import everywhere.

---

## NW-LOW-004: Wallet and orders pages duplicate the same auth cookie check

- **Files:** `app/wallet/page.tsx` and `app/orders/page.tsx`
- **Finding:** Identical auth cookie validation duplicated in both files.
- **Fix:** Extract to a shared `checkAuth()` utility.

---

## NW-LOW-005: roundUpRupees name is misleading — returns rounding delta, not total

- **File:** `lib/utils/currency.ts:21-24`
- **Finding:** The function returns the amount needed to round up, not the rounded total. Name suggests otherwise.
- **Fix:** Rename to `getRoundingAmount` and clarify in JSDoc.

---

## NW-LOW-006: TIER_CONFIG has no fallback for unknown tier strings

- **File:** `app/wallet/WalletClient.tsx:75`
- **Finding:** `TIER_CONFIG` uses string keys. If `balance.tier` is an unexpected string, the lookup returns `undefined`.
- **Fix:** Add a default case for unknown tiers.

---

## NW-LOW-007: isUPIAvailable detection via User-Agent regex — unreliable

- **File:** `lib/utils/upi.ts:51-54`
- **Finding:** UA string detection fails on emulated devices, desktop browsers with mobile UA, and some mobile browsers.
- **Fix:** Use feature detection instead of UA string: check if `window.location.href = 'phonepe://...'` navigates away.

---

## NW-LOW-008: formatINRCompact renders ₹5,000 as ₹5.0k — inconsistent decimals

- **File:** `lib/utils/currency.ts:11-18`
- **Finding:** `toFixed(1)` always shows one decimal place: `₹5.0k` instead of `₹5k`.
- **Fix:** Strip trailing zeros: `.replace(/\.0k$/, 'k')`.

---

## NW-LOW-009: redeemStamps response validation missing — throws on non-2xx

- **File:** `lib/api/loyalty.ts:30-39`
- **Finding:** If the backend returns an error response, accessing `data.rewardCode` throws. No `try/catch`.
- **Fix:** Add `if (!data.success || !data.rewardCode) throw new Error(...)` before accessing fields.

---

## NW-LOW-010: OrderHistoryClient calls undefined STATUS_COLOUR (likely STATUS_COLORS)

- **File:** `app/orders/OrderHistoryClient.tsx`
- **Finding:** `STATUS_COLOUR` may be misspelled — likely should be `STATUS_COLORS`.
- **Fix:** Verify the correct export name from `lib/types/index.ts`.

---

## NW-LOW-011: Duplicate CouponInput components in cart and checkout folders

- **Files:** `components/cart/CouponInput.tsx` and `components/checkout/CouponInput.tsx`
- **Finding:** Nearly identical components exist in two locations.
- **Fix:** Consolidate to one shared component. Import from `components/cart/CouponInput.tsx`.

---

## NW-LOW-012: Scan-pay coin formula is 100x smaller than order coin formula

- **File:** `app/[storeSlug]/pay/page.tsx:59-61`
- **Finding:** Scan-pay uses `Math.floor((parsedRupees / 10) * ((baseCashbackPercent || 0) / 100))`. With `parsedRupees` already in rupees, this divides by 10 again. For ₹500 at 5%: scan-pay shows 0 coins, checkout shows 2.
- **Fix:** Align formulas: `effectiveAmount / 100 / 10 * (baseCashbackPercent / 100)`.

---

## NW-LOW-013: Bill Builder allows zero-price custom items

- **File:** `app/[storeSlug]/merchant/bill-builder/BillBuilderClient.tsx:90-98`
- **Finding:** `customPrice` of `'0'` or `''` passes validation, adding zero-price items.
- **Fix:** Check `isNaN(pricePaise) || pricePaise <= 0` and show an error.

---

## NW-LOW-014: Bill Builder allows negative discount — adds to total

- **File:** `app/[storeSlug]/merchant/bill-builder/BillBuilderClient.tsx:100-104`
- **Finding:** No check for negative discount values. A negative `parseFloat` could add to the total instead of subtracting.
- **Fix:** Use `Math.max(0, Math.round(...))` and validate `discountPaise <= subtotal`.

---

## NW-LOW-015: geoLocation timeout shows error but offers no fallback

- **File:** `app/[storeSlug]/checkout/page.tsx:108-121`
- **Finding:** 10-second geolocation timeout fires `showToast` but offers no address autocomplete fallback.
- **Fix:** Provide a Google Places autocomplete fallback when geolocation times out.

---

## NW-LOW-016: PaymentOptions has no disabled state when UPI links can't be built

- **File:** `components/checkout/PaymentOptions.tsx:118-150`
- **Finding:** When `vpa` is not set, the UPI section is hidden. But the collapsed "Other methods" Razorpay button has no disabled state.
- **Fix:** Show an informative error state when `rzpFailed` is true.

---

## NW-LOW-017: Merchant layout silently swallows auth errors — no login redirect

- **File:** `app/[storeSlug]/merchant/layout.tsx:46`
- **Finding:** `load()` wraps `getMerchantStores` in a try/catch that silently swallows all errors.
- **Impact:** Merchant sees blank switcher when session expires — no error, no redirect.
- **Fix:** Show an error banner with a login redirect when `getMerchantStores` fails with a 401.

---

## NW-LOW-018: MultiStoreAnalytics ignores selectedOutlet — shows all-outlet totals

- **File:** `components/merchant/MultiStoreAnalytics.tsx:62-64`
- **Finding:** `selectedOutlet` is accepted but summary cards always show aggregate data.
- **Fix:** Add a per-outlet stats API endpoint, or filter `stats.outletBreakdown` for the selected outlet.

---

## NW-LOW-019: Chat AI metadata.items cast with `as OrderItem[]` — no type guard

- **File:** `components/chat/ChatMessage.tsx:44-47`
- **Finding:** AI backend can return `metadata.items` with any shape. Cast with `as OrderItem[]` — if malformed, `OrderSuggestion` renders broken data.
- **Fix:** Use a type guard instead of `as` casting.

---

## NW-LOW-020: useTrack imported but error return value ignored

- **File:** `components/menu/MenuItem.tsx:11`
- **Finding:** `useTrack` is imported but its error return value is not used.
- **Fix:** Handle the error case from `useTrack`.

---

## NW-LOW-021: cancelOrder refund field access without optional chaining

- **File:** `lib/api/cancellation.ts:12`
- **Finding:** `refundInitiated: Boolean(data.refundInitiated)` — if the backend doesn't return `refundInitiated`, it's `undefined` cast to `false`. Fragile coupling.
- **Fix:** Use `data.data?.refundInitiated ?? false`.

---

## NW-LOW-022: Coin credit hook has coinsDone in dependency array — hooks violation

- **File:** `app/[storeSlug]/pay/confirm/[paymentId]/page.tsx:61-73`
- **Finding:** The `useEffect` sets `coinsDone` as state AND includes it in the dependency array. ESLint rule-of-hooks violation.
- **Fix:** Use a `useRef` for the "already credited" guard instead of state.

---

## NW-LOW-023: GoogleReviews relativeTime has off-by-one in week calculation

- **File:** `components/store/GoogleReviews.tsx:94-103`
- **Finding:** `relativeTime` checks for years before checking for months. A date 30 days old passes the year check and falls through to months.
- **Impact:** Dates between 30 days and 1 year show "0 years ago" instead of "~1 month ago".
- **Fix:** Fix the conditional ordering — check years before months.

---

## NW-LOW-024: Razorpay key ID never validated server-side before checkout

- **File:** `app/[storeSlug]/pay/checkout/page.tsx:148-149`
- **Finding:** `NEXT_PUBLIC_RAZORPAY_KEY_ID` is passed to `openPayment` with no validation. If missing, the app crashes or passes empty string.
- **Fix:** Validate the key ID is present and has the expected `rzp_...` format before allowing the Pay button.

---

## NW-LOW-025: sendOtp returns hasPIN but PIN login is not implemented in the UI

- **File:** `lib/api/auth.ts:4-12`
- **Finding:** `sendOtp` returns `{ isNewUser, hasPIN }` where `hasPIN` indicates PIN-based login. But the auth UI only offers OTP — `hasPIN` is unused.
- **Fix:** Add a PIN entry option to the login modal for returning users.

---

## NW-LOW-026: cancelBill has no ownership check before cancelling

- **File:** `lib/api/merchantBill.ts:72-75`
- **Finding:** `cancelBill(billId)` uses `authClient` but doesn't pass `storeSlug` or any ownership context. A user with any auth token could cancel any bill if the backend doesn't validate ownership by `billId`.
- **Impact:** Unauthorized bill cancellation if backend doesn't guard by ownership.
- **Fix:** Pass `storeSlug` in the request body so the backend can verify the authenticated user owns the store.

---

## NW-LOW-027: setOrderStatus has no authorization check — merchant-only endpoint called with authClient

- **File:** `lib/api/orders.ts:76-85`
- **Finding:** `setOrderStatus` is marked as "merchant use only" but uses `authClient` with no role check. Any authenticated user could update order status if the backend doesn't enforce merchant role.
- **Impact:** Unrestricted order status updates if backend lacks role-based access control.
- **Fix:** Ensure the backend validates the authenticated user has a merchant role for the relevant store before applying status updates.

---

## NW-LOW-028: callWaiter in store.ts has no debounce — multiple rapid taps create N requests

- **File:** `lib/api/store.ts:22-28`
- **Finding:** `callWaiter` in `store.ts` is a thin wrapper with no debouncing, no idempotency, and no client-side rate limit. The component layer handles cooldown via `sessionStorage`, but the API call itself is unprotected.
- **Impact:** Rapid network requests if cooldown logic is bypassed (e.g., via Playwright).
- **Fix:** Add `makeIdempotencyKey('waiter', storeSlug + tableNumber)` to prevent duplicate waiter calls.

---

## NW-LOW-029: Reservation date field naming inconsistency between API layers

- **Files:**
  - `lib/api/reservations.ts:27-32` — uses `date` field
  - `lib/api/catalog.ts:24-32` — `bookAppointment` uses `date` field
- **Finding:** Both use `date` consistently here, but `lib/api/store.ts` (ReservationSuggestion) and `components/` likely expect different field names. See NW-HIGH-003 for the full context.
- **Impact:** Cross-component reservation flows may fail with missing field errors.
- **Fix:** Standardize to `date` as ISO date string. Document the contract in shared-types.

---

## NW-LOW-030: getStoreCoupons and getAvailableCoupons duplicate the same API call with different return types

- **Files:**
  - `lib/api/coupons.ts:12-19` — `getStoreCoupons` returns `Coupon[]` (uses `minOrderValue`)
  - `lib/api/cart.ts:30-36` — `getAvailableCoupons` returns `AvailableCoupon[]` (uses `minOrderAmount`)
- **Finding:** Both functions call the same backend endpoint (`/api/web-ordering/store/${storeSlug}/coupons`) but return incompatible types. `Coupon` has `minOrderValue`, `AvailableCoupon` has `minOrderAmount`.
- **Impact:** Type inconsistency across the codebase. Callers using different imports get different field names for the same data.
- **Fix:** Remove one of the two functions. Use a single `getAvailableCoupons` with a canonical `Coupon` interface. Update all callers to import from the same source.

---

## NW-LOW-031: getWalletTransactions returns untyped transactions array

- **File:** `lib/api/wallet.ts:10-19`
- **Finding:** `getWalletTransactions` returns `{ transactions: WalletTransaction[], pagination: ... }` but `data.data` is cast directly without a type assertion. The response shape may not match `WalletTransaction`.
- **Impact:** Type mismatch between what the backend returns and what the frontend expects.
- **Fix:** Add `as WalletTransaction[]` or define a `WalletTransactionResponse` interface.

---

## NW-LOW-032: share.ts hardcodes BASE_URL instead of using environment variable

- **File:** `lib/utils/share.ts:3`
- **Finding:** `const BASE_URL = 'https://reznow.in'` is hardcoded. `lib/api/client.ts` correctly uses `process.env.NEXT_PUBLIC_API_URL` for the API base.
- **Impact:** Store share URLs break if `reznow.in` domain changes. Inconsistent environment variable usage.
- **Fix:** Replace with `process.env.NEXT_PUBLIC_BASE_URL || 'https://reznow.in'`.

---

## NW-LOW-033: exportReconciliationCSV builds URL without using Axios client

- **Files:**
  - `lib/api/merchant.ts:109-117` — returns URL for client to fetch
  - `lib/api/reconcile.ts:58-85` — uses raw `fetch` to download
- **Finding:** `exportReconciliationCSV` in `reconcile.ts` builds a full URL with raw `fetch`, extracting the token from `localStorage` directly. This bypasses the auth interceptor and the token guard in `client.ts`.
- **Impact:** Token leakage if URL construction has a bug. Inconsistent auth token handling.
- **Fix:** Use the Axios `authClient` to download the CSV blob. Let the interceptor handle the token injection.

---

## NW-LOW-034: AI chat response type ChatResponse doesn't match AIMessage usage in getChatHistory

- **File:** `lib/api/chat.ts`
- **Finding:** `sendChatMessage` returns `ChatResponse`. `getChatHistory` returns `AIMessage[]`. These are structurally similar but not identical — `AIMessage` has `createdAt`, `ChatResponse` has `type`. Callers receive two different shapes for the same concept.
- **Impact:** Inconsistent type for chat messages. Harder to write generic chat utilities.
- **Fix:** Unify to a single `ChatMessage` interface used by both functions.

---

## NW-LOW-035: Auth refresh queue silently drops requests when publicClient.post fails

- **File:** `lib/api/client.ts:137-154`
- **Finding:** When `isRefreshing = true` and a queued request's callback is called with a new token, the request uses `authClient(originalRequest)`. If `publicClient.post('/auth/token/refresh', ...)` in the refresh path throws (network error), the catch block sets `isRefreshing = false`, clears the queue, and rejects the original error — but **no queued request receives the failure**. Their `.catch()` is never called.
- **Impact:** When refresh fails, queued requests hang forever (neither resolve nor reject). Users experience silently frozen UI.
- **Fix:** In the catch block of the refresh attempt, iterate through `refreshQueue` and reject each pending promise with the error.

---

## NW-LOW-036: Staff PIN gate uses guessable derivation from storeSlug — not real security

- **File:** `app/[storeSlug]/staff/StaffDashboardClient.tsx:11-15`
- **Finding:** `getExpectedPin()` derives the PIN from `storeSlug.replace(/\D/g, '').slice(-4).padStart(4, '0')`. A malicious actor who knows the store slug can trivially compute the PIN.
- **Impact:** Staff PIN is not a secret — it can be computed from the URL alone. Any user who can access `/staff` can derive the PIN without any internal knowledge.
- **Fix:** Use a server-generated random PIN stored in the database, sent via SMS to the store manager on setup. Or use a proper auth flow with store-scoped JWT.

---

## NW-LOW-037: BillBuilderClient constructs payment URL using `window.location.origin` at runtime

- **File:** `app/[storeSlug]/merchant/bill-builder/BillBuilderClient.tsx:385`
- **Finding:** `navigator.clipboard.writeText(url)` builds URL with `window.location.origin` — if accessed via a share link from a different domain (e.g., embedded in WhatsApp with `https://reznow.in` as the origin), the URL is correct. But if accessed via a redirect or deep link, `window.location.origin` could differ from the canonical domain, generating incorrect URLs.
- **Impact:** Copied payment links could contain the wrong domain in edge cases.
- **Fix:** Use `process.env.NEXT_PUBLIC_APP_URL` instead of `window.location.origin` to build the payment URL.

---

## NW-LOW-038: `billStore.ts` `localId()` uses `Date.now()` — collision possible under fast adds

- **File:** `lib/store/billStore.ts:31-33`
- **Finding:** `function localId() { return \`item_${Date.now()}_${++idCounter}\`; }` — if two adds happen in the same millisecond (e.g., rapid button taps), `Date.now()` is identical. `idCounter` helps but if the component re-mounts, `idCounter` resets to 0. Combined with `Date.now()` from the same millisecond, collisions are possible.
- **Related:** NW-MED-024 already documents this for `offlineQueue.ts`.
- **Fix:** Use `crypto.randomUUID()` instead of `Date.now() + idCounter`.

---

## NW-LOW-039: Merchant PayDisplayClient has no `authToken` passed to Socket.IO

- **File:** `app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:108-112`
- **Finding:** `io(SOCKET_URL, { transports: ['websocket'], ... })` — the Socket.IO connection is unauthenticated. The merchant dashboard listens for `payment:received`, `payment:confirmed`, and `payment:rejected` events without any auth token.
- **Impact:** Anyone who knows the store slug can connect to the merchant's Socket.IO namespace and receive payment events for that store. They can see customer names, amounts, and phone numbers in real time.
- **Fix:** Pass an auth token in the Socket.IO handshake: `io(SOCKET_URL, { auth: { token: getAuthToken() }, ... })`. The backend should validate the token before allowing connection to the merchant namespace.

---

## NW-LOW-040: `getBillDetails` imported from wrong module in scan-pay checkout

- **File:** `app/[storeSlug]/pay/checkout/page.tsx:10`
- **Finding:** `getBillDetails` is imported from `@/lib/api/bill` — the stub file with minimal implementation. The full `getBillDetails` in `lib/api/merchantBill.ts` uses `publicClient` and returns a fully-typed `BillDetails` interface with status, expiresAt, razorpayOrderId, and more. The stub in `lib/api/bill.ts` returns `MerchantBill` which lacks these fields.
- **Impact:** The scan-pay checkout code relies on `(bill as any).razorpayOrderId` and `(bill as any).razorpay_order_id` — casting because the imported type is incomplete. If the stub's return type doesn't match what the backend actually sends, the cast silently breaks.
- **Fix:** Change the import to `@/lib/api/merchantBill` which has the correct `BillDetails` interface.

---

## NW-LOW-041: `lib/api/search.ts` uses raw `fetch` instead of `deduplicatedGet`

- **Audit:** Round 3
- **Categories:** 10 (Performance), 13 (Architecture)
- **File:** `lib/api/search.ts:48-56` and `:63-72`
- **Finding:** `searchStores()` and `getFeaturedStores()` both use raw `fetch()` instead of the Axios client or the `deduplicatedGet` utility defined in `lib/api/client.ts`. Raw `fetch` bypasses the auth token injection, retry logic, and error normalization that `authClient` provides.
- **Impact:** No auth token on search requests (breaks if search ever requires auth). No deduplication of concurrent search requests. NW-MED-043 documents the same bug in the UI layer; this is the API-layer root cause.
- **Fix:** Replace raw `fetch` with `deduplicatedGet` from `lib/api/client.ts`, which uses the Axios `publicClient` and provides in-flight request deduplication.

---

## NW-LOW-042: PayDisplayClient dedup closure uses stale `payments` state

- **Audit:** Round 3
- **Categories:** 1 (Functional), 13 (Architecture)
- **File:** `app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:125-131`
- **Finding:** The socket `payment:received` handler closes over `payments` state: `if (payments.some((p) => p.id === payment.id)) return;`. The `useEffect` that sets up this socket intentionally omits `payments` from its dependency array (`// intentionally omit payments from deps` at line 153). This means the dedup check always uses the *initial* empty `payments` array — never updated with new payments from the real-time stream.
- **Impact:** Duplicate payments are not deduped on re-renders. If the socket emits the same payment twice (network re-delivery), it gets added twice. Only `setPayments` updates trigger re-render, but the effect closure doesn't re-run.
- **Fix:** Use a `useRef` for dedup tracking: `const seenIds = useRef(new Set<string>())` and check `if (seenIds.current.has(payment.id)) return;` inside the handler. Add `seenIds.current.add(payment.id)` after the dedup check.

---

## NW-LOW-043: `formatTime` in StoreFooter crashes on malformed time strings

- **Audit:** Round 3
- **Categories:** 12 (Edge Cases)
- **File:** `components/store/StoreFooter.tsx:23-31`
- **Finding:** `formatTime(time: string)` splits on `:` and parses with `parseInt`. If `time` is `undefined`, `null`, or an empty string, `hStr.split(':')` returns `['undefined']` and `parseInt('undefined', 10)` returns `NaN`. `NaN >= 12` is `false`, so `h` stays `NaN`, and `NaN >= 12 ? 'pm' : 'am'` gives `'am'`. Then `NaN > 12` is `false`, so `NaN` stays `NaN`, and `NaN === 0` is `false`, so `h` becomes `NaN`. The final return is `'NaN:NaNam'` — a broken display.
- **Impact:** If `store.operatingHours` contains a malformed time string, the footer crashes with a visual "NaN" label.
- **Fix:** Guard with `if (!time || !time.includes(':')) return '—'`. Validate `!isNaN(h)` before using `h`.

---

## NW-LOW-044: KitchenChatDrawer optimistic ID uses `Date.now()` — collisions possible on fast double-tap

- **Audit:** Round 3
- **Categories:** 12 (Edge Cases), 1 (Functional)
- **File:** `components/table/KitchenChatDrawer.tsx:92`
- **Finding:** `const optimisticId = 'optimistic-${Date.now()}'` — if the user double-taps the send button rapidly before the socket acknowledgment arrives, both messages get `Date.now()` from the same millisecond and collide in the `messages` array (React uses `msg.id` as the key, so the second one overwrites the first).
- **Impact:** Double-send appears as a single message, silently dropping one message from the user's perspective.
- **Fix:** Add a local incrementing counter for optimistic IDs: `let idCounter = 0; const optimisticId = 'optimistic-${Date.now()}-${++idCounter}'`.

---

## NW-LOW-045: `validateCoupon` casts response without `data.success` guard

- **Audit:** Round 4
- **Categories:** 3 (API Contract), 12 (Edge Cases)
- **File:** `lib/api/cart.ts:27`
- **Finding:** `return data as CouponValidateResponse` — if the backend returns `{ success: false, message: "..." }`, the function silently returns a success-typed object with `success: false`. Unlike `validateCart`, `validateCoupon` does not throw on failure.
- **Impact:** Callers checking `response.success` may not handle the failure path correctly. Should throw like other API functions.
- **Fix:** Change to: `if (!data.success) throw new Error(data.message || 'Invalid coupon'); return data as CouponValidateResponse;`

---

## NW-LOW-046: `validateCart` untyped return — no runtime shape validation

- **Audit:** Round 4
- **Categories:** 3 (API Contract), 12 (Edge Cases)
- **File:** `lib/api/cart.ts:10-13`
- **Finding:** `return data.data as { validItems: CartItem[]; unavailableItems: string[] }` casts without runtime validation. If the backend returns `{ validItems: null }`, callers calling `.map()` on `null` throw `TypeError`.
- **Impact:** Silent type mismatch. Runtime crashes on malformed backend responses.
- **Fix:** Define a `CartValidationResult` interface in `lib/types`. Add `if (!data.data) return { validItems: [], unavailableItems: [] }` guard.

---

## NW-LOW-047: `getWalletTransactions` no `data.success` check — silent null on error

- **Audit:** Round 4
- **Categories:** 1 (Functional), 3 (API Contract)
- **File:** `lib/api/wallet.ts:18`
- **Finding:** `return { transactions: data.data, pagination: data.pagination }` with no `data.success` check. If backend returns `{ success: false, data: null }`, returns `{ transactions: null }`.
- **Impact:** `transactions.map(...)` throws `TypeError` on error.
- **Fix:** Add `if (!data.success) throw new Error(data.message || 'Failed to load transactions');`

---

## NW-LOW-048: `AppointmentSlotPicker` passes empty strings for required booking fields

- **Audit:** Round 4
- **Categories:** 1 (Functional), 12 (Edge Cases)
- **File:** `components/catalog/AppointmentSlotPicker.tsx:68-71`
- **Finding:** `bookAppointment({ customerPhone: '', customerName: '', ... })` — `customerPhone` and `customerName` are hardcoded to `''`. The backend requires these for appointment confirmation.
- **Impact:** Appointments booked without customer identification. Backend validation errors, no-show handling failures, or silent data corruption.
- **Fix:** Collect name and phone from the authenticated user's profile, or add input fields to the booking confirmation UI before calling `bookAppointment`.

---

## NW-LOW-049: `LoyaltyWidget` destructures `storeSlug` from props but doesn't declare it in interface

- **Audit:** Round 4
- **Categories:** 13 (Architecture), 12 (Edge Cases)
- **File:** `components/order/LoyaltyWidget.tsx:16-27,67`
- **Finding:** `storeSlug` is destructured from props (line 67) and used throughout the component, but it is not declared in `LoyaltyWidgetProps`. TypeScript allows this — if a caller omits `storeSlug`, it is `undefined` and the component silently uses `undefined` in API URLs.
- **Impact:** If `storeSlug` is accidentally omitted from the JSX, `redeemStamps` (already broken at NW-MED-052) would call `undefined/loyalty/redeem`.
- **Fix:** Add `storeSlug: string` to `LoyaltyWidgetProps`. Add a guard that throws if undefined.

---

## NW-LOW-050: `useMenuSearch` item tag matching doesn't handle tags field

- **Audit:** Round 4
- **Categories:** 9 (UX), 1 (Functional)
- **File:** `lib/hooks/useMenuSearch.ts:68-70`
- **Finding:** `useMenuSearch` matches on `item.name` and `item.description` but not `item.tags` (an array of strings). Menu items often have tags like "spicy", "vegan", "gluten-free" that users would want to search by.
- **Impact:** Users searching "vegan" or "spicy" get no results even when matching items exist.
- **Fix:** Add `item.tags?.some(tag => tag.toLowerCase().includes(needle))` to the filter condition.

---

## Status Tracking

All 50 LOW issues are OPEN. Update status as fixes are applied.
