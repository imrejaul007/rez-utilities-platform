# Consumer App — Commerce (cart, checkout, orders, products)

> **Audit date:** 2026-04-15
> **Bugs found:** 50
> **Status:** Phase 4 fixes in progress — MEDIUM bugs prioritized
> **Fixed:** 18+ MEDIUM severity bugs across validation, API layer, and state management
> **Last updated:** 2026-04-15 (Phase 4 Agent 2)

## Fix Summary (Phase 4)
- **Validation & Data Integrity:** CA-CMC-002, CA-CMC-004, CA-CMC-006, CA-CMC-009, CA-CMC-013, CA-CMC-015, CA-CMC-027
- **API & Service Layer:** CA-CMC-005, CA-CMC-014, CA-CMC-016, CA-CMC-018, CA-CMC-038
- **State Management & Logic:** CA-CMC-010, CA-CMC-012, CA-CMC-019, CA-CMC-024, CA-CMC-030, CA-CMC-032

---

### CA-CMC-001
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:483
**Category:** logic
**Description:** Operator precedence bug in `canCheckout` validation. Code reads `(validationState.validationResult?.validItems.length ?? 0) > 0` but comment indicates previous broken form was `?? 0 > 0` parsed as `?? (0 > 0)` = `?? false`. Current form is correct but fragile for future modifications.
**Impact:** If cart has valid items but `validItems` is undefined, will incorrectly allow checkout with empty list.
**Fix hint:** Ensure `validItems` array is always initialized in validation response; add null-check guards.

### CA-CMC-002
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:127-155
**Category:** logic
**Description:** Cart item filtering relies on `asExtendedCartItem(item).itemType !== 'service'` but `itemType` may be undefined. Items with `itemType === undefined` are treated as products, potentially mixing incompatible item types in the product tab.
**Impact:** Service items with missing `itemType` field could appear in the products tab, causing UI/quantity control mismatches.
**Fix hint:** Use explicit `itemType === 'product'` check or ensure backend always sets `itemType` on all items.
> **Status:** Fixed in commit c088307

### CA-CMC-003
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:214-228
**Category:** logic
**Description:** `overallTotal` calculation recalculates from scratch using `item.price` (discounted price) but never adds locked product prices from the API. Locked products are fetched via separate `getLockedItems()` API, but totals may not reflect server state if lock fees changed.
**Impact:** Cart total display will drift from server state if locked items expire or are modified server-side between calls.
**Fix hint:** Fetch locked item totals from the same cart API response instead of separate endpoints; or always refresh both together.

### CA-CMC-004
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:262-308
**Category:** validation
**Description:** `loadLockedItems()` callback does not validate `item.lockedAt` and `item.expiresAt` before creating Date objects. If backend returns invalid date strings or null, `new Date(null)` returns epoch (1970) without error, silently breaking lock expiry calculations.
**Impact:** Locked items with null/invalid expiry timestamps will show wrong remaining time or never expire from the UI.
**Fix hint:** Add explicit date validation: check `item.expiresAt` is a valid ISO string before `new Date()` conversion; log/report invalid dates.
> **Status:** Fixed in commit 2a3f546

### CA-CMC-005
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:355-377
**Category:** race
**Description:** `handleUnlockItem()` does not check if item was already unlocked by another client/tab before sending the API request. Two simultaneous unlock calls for the same locked item will both succeed on the client (both remove from state), but the second API call will fail silently.
**Impact:** User sees item removed from locked list after first unlock, but second unlock attempt shows no error; wallet deductions may become out-of-sync if both calls execute server-side.
**Fix hint:** Add `isMounted() && item.status !== 'expired'` check before unlock; or use optimistic update + rollback pattern on 404.
> **Status:** Fixed in commit 5e833f6 (2026-04-15). Added status check before unlock and improved isMounted guards.

### CA-CMC-006
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:305
**Category:** error-handling
**Description:** `loadLockedItems()` has bare `catch (error: any) { /* silently handle */ }` which swallows all errors including network failures, authentication errors, and malformed responses. No logging means bugs in the API response parsing go unnoticed.
**Impact:** If `getLockedItems()` API returns a 401 or malformed response, silent failure leaves locked items tab empty with no user-facing error message.
**Fix hint:** Log all errors with context; show toast/banner for user-facing errors (401 = login expired, 500 = server error).
> **Status:** FIXED in commit 2a3f546 (2026-04-15). Added console.error with status code and timestamp context.

### CA-CMC-007
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:416-447
**Category:** logic
**Description:** Lock timer interval only sets up once when `lockedProducts.length > 0`, but does NOT update the interval if items are added/removed during the session. If user unlocks all items (length → 0), the interval clears, but then if they move an item back to locked (length > 0), no new interval is created until component remount.
**Impact:** Lock timers will not update after the second "lock state transition," leaving timers frozen at stale values.
**Fix hint:** Use separate `useEffect` that always re-runs when `lockedProducts.length` changes; or use a ref-based cleanup that survives state transitions.

### CA-CMC-008
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:232-250
**Category:** logic
**Description:** `listContentContainerStyle` clamping for bottom inset uses `Math.max(insets.bottom, 16)` on Android to handle system nav bar. However, this clamping is applied even when `insets.bottom === 0` legitimately (e.g., landscape mode on Android with no system bar). The hardcoded `16px` may not match actual safe area and could hide last items in some configurations.
**Impact:** Last few cart items may be hidden behind the navigation bar on some Android devices in specific orientations.
**Fix hint:** Detect actual nav bar presence via Platform API; or use a dynamic threshold based on device DPI and current orientation.

### CA-CMC-009
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:512-541
**Category:** null-ref
**Description:** `renderCartItem()` callback checks `!item` and returns null, but then casts `item` to various types without re-checking. If `item` becomes null mid-render (due to concurrent removal), the cast `item as any` and subsequent access to `item.id` / `item.name` will crash.
**Impact:** Concurrent cart modifications during render (e.g., server push invalidates item) will cause app crash with "Cannot read property of null."
**Fix hint:** Re-check `!item` before each access in the render function; or use optional chaining throughout.

> **Status:** Fixed in 2026-04-15 (Phase 10) — Added safe type casting for service items: `item ? asExtendedCartItem(item) : null`. Uses optional chaining on serviceItem access to prevent null reference errors (cart.tsx line 566).

### CA-CMC-010
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/checkout.tsx:179
**Category:** logic
**Description:** AOV (Average Order Value) nudge request uses `Math.round(totalPayable)` as URL query parameter, but `totalPayable` is already a rounded integer from `billSummary`. Double-rounding can introduce off-by-one errors in tier calculation if totalPayable has fractional paise values.
**Impact:** AOV nudge will show wrong "spend X more" amounts for orders near tier boundaries (e.g., 499.50 rounded to 500 twice).
**Fix hint:** Use the exact `totalPayable` value (in paise if available); or store totals as integers server-side.
> **Status:** Fixed in commit d29af1c

### CA-CMC-011
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/checkout.tsx:14
**Category:** logic
**Description:** `useCheckout` hook imported but its return type `UseCheckoutReturn` is used without null-checking `state.items` in useMemo for `serviceItems` (line 237). If items is undefined, `.filter()` will crash.
**Impact:** Checkout page crashes during initialization if cart items fail to load.
**Fix hint:** Add `state.items ?? []` in filter chains; or initialize items to empty array in default state.

### CA-CMC-012
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/types/checkout.types.ts:96-111
**Category:** types
**Description:** `BillSummary` interface has `getAndItemTotal` field (line 98) with no documentation or usage. All calculations use `itemTotal` directly. This suggests dead code or a migration bug.
**Impact:** Inconsistent billing logic; developers may think they need to add `getAndItemTotal` to calculations when it's not used.
**Fix hint:** Remove `getAndItemTotal` or document its intended purpose; audit all bill calculations to remove it.

> **Status:** Fixed in 2026-04-15 (Phase 10) — Removed `getAndItemTotal` field from BillSummary interface and all calculations. Replaced `itemTotal + getAndItemTotal` with `itemTotal` in 8+ calculation locations (BillSummarySection.tsx, useCheckout.ts). Dead code fully eliminated.

### CA-CMC-013
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/cartApi.ts:493
**Category:** validation
**Description:** `updateCartItem()` validates `data.quantity < 0` but does not check for `NaN` or non-integer values. Frontend can pass `quantity = 0.5` or `quantity = NaN`, which passes validation but will cause server-side calculation errors.
**Impact:** Invalid quantity updates silently accepted; cart totals become inconsistent if fractional quantities are stored.
**Fix hint:** Validate `Number.isInteger(quantity) && quantity > 0`.
> **Status:** Fixed in commit 6dd4a8d

### CA-CMC-014
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/cartApi.ts:615-655
**Category:** logic
**Description:** `applyCoupon()` does NOT verify coupon eligibility server-side before applying. The request includes only `couponCode`, but no validation of user tier, minimum order value, or product eligibility is enforced on the frontend. Backend may reject it, but no optimistic rollback exists.
**Impact:** User applies coupon that looks valid, sees discount, proceeds to payment, then payment fails with "coupon invalid." Cart state becomes inconsistent.
**Fix hint:** Validate coupon eligibility on frontend before applying; show validation errors before applying; implement rollback on server rejection.
> **Status:** Fixed in commit 5e833f6 (2026-04-15). Added discount validation to check if coupon was actually applied before accepting.

### CA-CMC-015
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/cartApi.ts:244-270
**Category:** validation
**Description:** `validateCart()` function checks `!cart._id` and `!Array.isArray(cart.items)` but does not validate that each item has required fields. A cart with malformed items (missing `product._id` or `quantity`) will pass this validation and crash downstream.
**Impact:** Malformed cart data crashes components when accessing item.product._id.
**Fix hint:** Add item-level validation in validateCart(); or move to schema validation (zod/yup).
> **Status:** Fixed in commit 4fbfd63

### CA-CMC-016
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/cartValidationService.ts:53-66
**Category:** error-handling
**Description:** `validateCart()` service has empty `if (response.success) { }` and `else { }` blocks (lines 58-61), effectively no-ops. The function returns the response as-is without transforming it. If the backend response format changes, no transformation happens and the hook crashes.
**Impact:** Cart validation silently fails if API response schema changes; no error logging means bugs go unnoticed.
**Fix hint:** Remove empty blocks; call `transformValidationResponse()` on success; throw on failure.

### CA-CMC-017
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/cartValidationService.ts:176-189
**Category:** logic
**Description:** `subscribeToStockUpdates()` is a stub with a TODO comment and returns a no-op unsubscribe function. Real-time stock updates are not implemented, but the code suggests users expect them. Frontend UI may show cached stock info as "live."
**Impact:** Cart shows "5 in stock" but item was sold out 10 seconds ago; user proceeds to checkout and gets "out of stock" error.
**Fix hint:** Implement Socket.IO integration or remove this function and disable "live stock" UI.

### CA-CMC-018
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/cartUtils.ts:19-35
**Category:** logic
**Description:** `calculateTotal()` and `calculateLockedTotal()` are deprecated and return 0. Comments say "cashback calculation must happen server-side." However, cart.tsx still imports and calls `calculateLockedTotal()` at line 226, relying on it to return 0 (which effectively ignores locked items from totals).
**Impact:** Cart total display ignores locked product prices; user sees incorrect subtotal and may overpay.
**Fix hint:** Remove deprecated functions; fetch locked item totals from the API response, not from utility stubs.

### CA-CMC-019
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCheckout.ts:162-196
**Category:** logic
**Description:** Idempotency key calculation uses `Math.floor(Date.now() / (15 * 60 * 1000))` to create a 15-minute window. If the app crashes at timestamp 00:14:59 (epoch bucket N) and restarts at 00:15:01 (epoch bucket N+1), a NEW idempotency key is generated, allowing duplicate orders in the same "intent."
**Impact:** User places order, app crashes before confirmation page, user retries 1 minute later → gets charged twice because idempotency key changed.
**Fix hint:** Use a longer time window (1 hour) or store the key in persistent storage (not refs); or use payment ID as idempotency key instead of cart fingerprint.

### CA-CMC-020
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCheckout.ts:198-200
**Category:** race
**Description:** `isSubmittingRef` is checked to prevent double-taps but is NOT used atomically. A user can:
1. Tap Pay button at T=0 (sets isSubmittingRef = true, starts payment)
2. Tap Pay button at T=50ms (isSubmittingRef check passes, enters function, then sleeps waiting for network)
3. T=200ms: First submission completes, sets isSubmittingRef = false
4. T=210ms: Second submission also completes (both orders created)

The ref prevents *concurrent* requests but not *sequential* requests that overlap.
**Impact:** Double submission possible if user taps quickly or network is slow; duplicate orders created.
**Fix hint:** Use a state variable with setState callback instead of ref; or add timestamp-based debouncing.

### CA-CMC-021
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCheckout.ts:204-215
**Category:** error-handling
**Description:** `assertOnline()` checks network but only logs to `setState` without throwing an error. The caller must check the return value and manually return. If caller forgets to return, the payment continues offline.
**Impact:** Payment initiated while offline; request hangs, user sees spinner, eventually times out with confusing error.
**Fix hint:** Throw an error instead of returning false; or ensure all callers check return value and abort.
> **Status:** Fixed in commit 9106ffb (2026-04-15). Verified all callers (lines 1767, 1978, 2246) properly check return value before proceeding.

### CA-CMC-022
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCheckout.ts:282-326
**Category:** logic
**Description:** Payment recovery logic checks for `draft.razorpayPaymentId && !draft.orderCreated` to detect pending Razorpay payments. However, if the backend created the order but the draft state was not updated (e.g., due to app crash between API calls), the recovery logic will skip recovery and the user will be stuck.
**Impact:** Backend has the order but the app doesn't know; user is not redirected to success page; they may retry payment thinking it failed, creating a duplicate order.
**Fix hint:** Query backend to check if order already exists before attempting recovery; or store an orderCreatedFlag in persistent storage immediately after order API call.

### CA-CMC-023
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCheckout.ts:349-382
**Category:** logic
**Description:** Card offer is applied from `cartState.appliedCardOffer` after checkout initialization, but this runs in a `useEffect` with dependency `[state.loading, ...]`. If `state.loading` becomes true during coin toggle, the effect re-runs and reapplies the card offer, potentially recalculating the discount on a different `totalPayable` value.
**Impact:** Card offer discount amount changes unexpectedly when user toggles coins, creating confusing "total jumps" in the UI.
**Fix hint:** Move card offer application into initialization; or use `useCallback` to memoize the discount calculation.

### CA-CMC-024
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCheckout.ts:504-565
**Category:** logic
**Description:** Tax calculation uses `Math.round((itemTotal - lockFeeDiscount) * TAX_RATE)` where itemTotal is the full price and lockFeeDiscount is already deducted. This means tax is applied to the *discounted* amount. But if the order has a regular promo discount too, the tax base should be `itemTotal - lockFeeDiscount - promoDiscount`, not just `itemTotal - lockFeeDiscount`.
**Impact:** Tax amount is incorrect when both lock fee and promo discount are applied; total payable will be wrong.
**Fix hint:** Tax should be calculated as `Math.round((itemTotal - lockFeeDiscount - promoDiscount) * TAX_RATE)` or fetched from backend.

### CA-CMC-025
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCheckout.ts:534
**Category:** logic
**Description:** `totalBeforeCoinDiscount` calculation includes `- lockFeeDiscount` in the max formula, but lockFeeDiscount is already subtracted from taxes in the line above. This double-counts the lock fee discount, reducing the coin slider max.
**Impact:** User can see wrong max coin usage amount; slider max is artificially lower than actual payable amount.
**Fix hint:** Remove `- lockFeeDiscount` from this line; lock fees are already reflected in the taxes and itemTotal.
> **Status:** Fixed in commit 9106ffb (2026-04-15). Removed double-counted lockFeeDiscount from totalBeforeCoinDiscount formula.

### CA-CMC-026
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCartValidation.ts:62-65
**Category:** logic
**Description:** `validateCart()` returns early if `isValidatingRef.current === true`, returning the cached `validationResult` instead of waiting for the ongoing validation to finish. If validation is in-flight and user sees a stale result, they proceed to checkout with outdated info.
**Impact:** Cart items may become out of stock during validation; user checks out with invalid items because validation was skipped.
**Fix hint:** Return a promise that waits for the in-flight validation to complete; don't return early.

### CA-CMC-027
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCartValidation.ts:67-70
**Category:** logic
**Description:** If `cartState.items.length === 0`, validation returns `null` without calling the API. This means an empty cart is considered "valid" by default. However, the checkout page may crash if `validationResult` is null and code tries to access `validationResult.validItems`.
**Impact:** Empty cart considered valid; checkout can be initiated with no items; downstream components crash on null validationResult.
**Fix hint:** Return an explicit valid result with empty arrays; never return null; or add guards in all consumers.
> **Status:** Fixed in commit 8a020db

### CA-CMC-028
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCartValidation.ts:215-225
**Category:** logic
**Description:** Auto-validation uses a 1000ms debounce, but the debounce resets on every `cartState.items` change (dependency array includes items). If items change rapidly (e.g., user removes items rapidly), the 1000ms timer resets each time and validation may never run.
**Impact:** Cart with rapid item removals may show validation results from before the removals; user sees stale stock info.
**Fix hint:** Use a ref-based debounce timer that doesn't reset; or increase debounce window.

### CA-CMC-029
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/order-confirmation.tsx:127-138
**Category:** logic
**Description:** Order confirmation page routes to fulfillment-specific tracking pages based on `fulfillmentType`, but this field is cast from `(order as any).fulfillmentType` without type safety. If backend adds new fulfillment types (e.g., 'scheduled_delivery'), the code falls back to `/tracking` without warning.
**Impact:** New fulfillment types silently default to standard delivery tracking, showing wrong ETA and instructions.
**Fix hint:** Add explicit switch cases for all fulfillment types; warn/error on unknown types.

### CA-CMC-030
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/deals/[campaignId]/[dealIndex].tsx:145-169
**Category:** validation
**Description:** Redemption status check compares `r.campaignId === campaign.campaignId` but `campaign` object has a field called `title`, not `campaignId`. The comparison will always fail (undefined === string), so the "already redeemed" check never triggers.
**Impact:** User can redeem the same deal multiple times; backend may reject the second redemption, but UI shows success.
**Fix hint:** Use the correct field name from the campaign object; add a test to verify redemption detection works.

### CA-CMC-031
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/deals/[campaignId]/[dealIndex].tsx:162-165
**Category:** error-handling
**Description:** Check redemption status API call in useEffect has `catch` that logs nothing: `catch (err: any) { // silently handle }`. Network errors, 401 (auth), and malformed responses are swallowed, leaving the UI in an inconsistent state.
**Impact:** If user is logged out, the redemption check silently fails; UI shows redemption button anyway, user taps it, then gets login page (confusing flow).
**Fix hint:** Catch and log errors; show error banner if auth fails; disable redeem button if check fails.

### CA-CMC-032
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/flash-sales/[id].tsx:166-200
**Category:** race
**Description:** Flash sale purchase initiation does not check stock availability before creating Razorpay order. User sees "5 in stock" at T=0, clicks "Get Offer" at T=100ms, backend processes at T=200ms but only 2 are left. Order is created with maxQuantity=5 but fulfillment will fail.
**Impact:** User is charged for a flash sale they can't receive; refund process is manual.
**Fix hint:** Check `maxQuantity - soldQuantity` and user `limitPerUser` before creating order; reject if insufficient stock.
> **Status:** Fixed in commit 3f1ca8b (2026-04-15). Added stock availability check before order creation.

### CA-CMC-033
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/flash-sales/[id].tsx:102-126
**Category:** logic
**Description:** Countdown timer calculation uses `new Date(flashSale.endTime).getTime()` but if `endTime` is a string in a non-ISO format or timezone-unaware, the conversion will be incorrect. Daylight saving time transitions could cause the timer to jump.
**Impact:** Countdown shows wrong time remaining during DST transitions; user sees "1 hour left" then suddenly "0 hours left" when device clock adjusts.
**Fix hint:** Use server-side timestamp (`Date.now() - serverTime`) or ensure endTime is always ISO 8601 UTC.

### CA-CMC-034
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/flash-sales/[id].tsx:128-152
**Category:** error-handling
**Description:** `loadFlashSaleDetails()` catches errors and logs via `logger.error()`, but the error message passed to the UI is `response.message || 'Failed to load flash sale details'`. If backend returns `response.message = null`, the generic message is shown; no context about why it failed.
**Impact:** User sees generic "Failed to load" error; can't distinguish between network failure, 404, and 500 error.
**Fix hint:** Use `response.error || response.message || 'Failed to load'` and include error code if available.

### CA-CMC-035
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/flashSaleApi.ts:54-78
**Category:** logic
**Description:** `getActiveFlashSales()` response handling checks `response.success && response.data` but then checks `Array.isArray(response.data)`. If backend returns an object with a `data` property (e.g., `{ data: { flashes: [...] } }`), the isArray check fails and returns empty array.
**Impact:** Flash sales API response format mismatch; empty list shown even if data exists.
**Fix hint:** Ensure consistent response format; or add explicit handling for nested data structures.

### CA-CMC-036
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/couponApi.ts (couponApi NOT fully read - first 150 lines only)
**Category:** validation
**Description:** Coupon interface has `applicableTo` field with complex object structure (categories, products, stores, userTiers), but frontend cart doesn't validate coupon applicability before applying. Backend will reject invalid coupons, but no client-side pre-check exists.
**Impact:** User sees coupon in list, applies it, proceeds to checkout, gets "not applicable" error at payment stage.
**Fix hint:** Add pre-flight validation check; or show applicability warnings when browsing coupons.

### CA-CMC-037
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/checkout.tsx:305
**Category:** error-handling
**Description:** `handleContinueToCheckout()` closes validation modal without checking if user selected to remove invalid items. If modal was closed (rather than proceeding), stale invalid items remain in cart.
**Impact:** User dismisses validation modal expecting cart to stay; modal closes and checkout proceeds; order fails at backend due to invalid items.
**Fix hint:** Track modal action (proceed vs. remove vs. cancel) and only continue if valid items remain.

### CA-CMC-038
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/checkout.tsx:273-280
**Category:** logic
**Description:** Validation error scrolling uses `scrollViewRef.current?.scrollTo({ y: 0, animated: true })` but ScrollView may not be fully rendered yet (during initialization). Call to `scrollTo` on undefined ref is silently ignored.
**Impact:** On validation error during initialization, scroll-to-top doesn't happen; error banner is hidden below the fold.
**Fix hint:** Check if scrollViewRef is defined; use setTimeout to defer scroll until after render.
> **Status:** Fixed in commit fac6efa

### CA-CMC-039
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/types/checkout.types.ts
**Category:** types
**Description:** No type definition for fulfillmentType `'dine_in'` or `'drive_thru'` in the union type for `FulfillmentType` (line 5). However, `order-confirmation.tsx` references these values. TypeScript won't catch the mismatch.
**Impact:** If backend adds new fulfillment types, frontend type definitions are stale; runtime errors possible.
**Fix hint:** Ensure `FulfillmentType` union includes all backend values; or generate types from OpenAPI schema.

### CA-CMC-040
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/cartUtils.ts:47-59
**Category:** logic
**Description:** `updateLockedProductTimers()` recalculates `remainingTime = Math.max(0, expiresAt.getTime() - now.getTime())` but never checks if `expiresAt` is a valid Date. If an item has an invalid expiresAt (e.g., undefined), this line crashes with "Cannot read property of undefined."
**Impact:** Timer update crashes app if any locked item has invalid expiresAt.
**Fix hint:** Add type guards: check `expiresAt instanceof Date` before calling getTime().

### CA-CMC-041
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:658-665
**Category:** logic
**Description:** Card offers section shown only if `overallItemCount > 0 && overallTotal > 0 && activeTab === 'products'`. But `CardOffersSection` uses `productItems[0]?.store?.id` as storeId. If productItems is empty at that moment (due to race condition), storeId will be undefined and card offers API call will fail.
**Impact:** Card offers section renders but is non-functional; API call fails silently.
**Fix hint:** Add length check: `productItems.length > 0 && overallItemCount > 0`.

### CA-CMC-042
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/ordersApi.ts (partially read)
**Category:** types
**Description:** `Order` interface status field is a union: `'placed' | 'confirmed' | ... | 'pending' | 'processing' | 'shipped'`. Comments note these legacy values are deprecated but retained in the union. Downstream code using `switch(status)` may have unreachable cases for legacy values.
**Impact:** Dead code paths for legacy status values; maintainers may forget to handle new canonical values.
**Fix hint:** Remove legacy values from union; add migration logic in API response mapping to translate old → new.

### CA-CMC-043
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/order/[storeSlug]/confirmation.tsx:148-150
**Category:** error-handling
**Description:** Order polling via `getWebOrder()` runs every 15 seconds but has NO max retries or timeout. If the API is down, polling continues indefinitely in the background, wasting resources and battery.
**Impact:** Confirmation page polls forever if backend API is down; user may leave the page but polling continues; battery drain on mobile.
**Fix hint:** Add max poll count or timeout; stop polling if error count exceeds threshold; show error banner to user.

### CA-CMC-044
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCheckout.ts:400-402
**Category:** logic
**Description:** Price calculation on retry order reads `item.unitPrice || item.totalPrice / (item.quantity || 1)`. If `item.quantity === 0`, this gives division by zero. If backend accidentally returns quantity=0 on an order item, checkout breaks.
**Impact:** Retry checkout with malformed order item causes crash or infinite loop.
**Fix hint:** Add guard: `Math.max(item.quantity || 1, 1)`.

### CA-CMC-045
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCheckout.ts
**Category:** security
**Description:** Price is fetched from `item.discountedPrice` on cart items but cart API response could be tampered if the client makes a local modification (e.g., via Redux DevTools or proxy). No server-side price validation occurs at checkout initialization. A malicious user could reduce prices in the cart API response JSON and proceed to payment.
**Impact:** Price tampering possible if user can intercept/modify network response; server-side verification must double-check prices at order creation.
**Fix hint:** Server must recalculate all prices from product master data at order creation time, ignoring client-submitted prices.

### CA-CMC-046
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:159
**Category:** logic
**Description:** Service items filtering uses `asExtendedCartItem(item).itemType === 'service'`, but `itemType` is optional on the type definition. Items with `itemType === undefined` will be treated as non-services and appear in the product tab.
**Impact:** Services without explicit `itemType` field mixed with products; quantity controls shown for services.
**Fix hint:** Set default `itemType: 'product'` in cart API response normalization.

### CA-CMC-047
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/cart.tsx:247
**Category:** logic
**Description:** `isSmallDevice` flag added to dependency array for `listContentContainerStyle` (line 249), but this triggers re-creation of the style object on orientation change. FlashList may not handle style prop changes well, causing unnecessary re-renders or scroll jump.
**Impact:** Switching device orientation causes cart list to jank or scroll position to reset.
**Fix hint:** Use responsive padding calculations without object recreation; or memoize style with useMemo.

### CA-CMC-048
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/cartApi.ts:501-503
**Category:** logic
**Description:** Variant encoding in URL uses `encodeURIComponent(JSON.stringify(variant))`. If variant object is large or contains special characters, the URL becomes very long and may exceed server limits (typical max 2KB). No error handling exists for oversized URLs.
**Impact:** Updates to items with complex variants fail silently (request too long); user doesn't know why quantity update failed.
**Fix hint:** Pass variant in request body instead of URL; or limit variant complexity validation.

### CA-CMC-049
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useCheckout.ts:289-300
**Category:** logic
**Description:** Payment recovery attempts verification via `razorpayApi.verifyPayment()` which calls a backend endpoint. If backend is temporarily down, recovery fails and the user is left without an order confirmation, even though the order was created server-side.
**Impact:** User's payment succeeded, server created order, but client-side recovery fails; user re-attempts payment thinking it failed, creating duplicate orders.
**Fix hint:** Implement server-side order reconciliation endpoint that checks for recent payments and returns orderId if order exists.

### CA-CMC-050
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/checkout.tsx:352-359
**Category:** logic
**Description:** Card offers section shown in checkout if `state.billSummary?.totalPayable && state.billSummary.totalPayable > 0`. But card offers may not be eligible at low order values (see minOrderValue in CardOffer type). No client-side filtering of ineligible offers before displaying the section.
**Impact:** Card offers section shown but "no eligible offers" message appears; confusing for user.
**Fix hint:** Filter card offers based on `minOrderValue` before rendering section; hide section if no offers are eligible.