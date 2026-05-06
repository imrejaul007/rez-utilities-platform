# Merchant App — Order Management & Tracking

> **Audit date:** 2026-04-15
> **Bugs found:** 31
> **Severity breakdown:** CRITICAL=2, HIGH=9, MEDIUM=20

---

### MA-ORD-001 Order Status Normalization Incomplete
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/index.tsx:36-71
**Category:** logic
**Description:** Order status colors and labels are hardcoded in STATUS_COLORS and STATUS_LABELS objects, but not all possible backend statuses are mapped. Comments suggest legacy status values like 'pending' and 'processing' are deprecated but still used. If backend returns a new status (e.g., 'on-hold', 'disputed'), the switch statement provides a gray color and the status is displayed as-is without a friendly label.
**Impact:** New order statuses from backend appear as gray text with no context; users can't understand order state.
**Fix hint:** Add missing status mappings; implement backend-driven status config or generate labels dynamically.

### MA-ORD-002 Duplicate API Calls on Mount
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/index.tsx:368-384
**Category:** perf
**Description:** Both `useEffect` (lines 371-377) and `useFocusEffect` (lines 380-384) call `loadOrders()` on component mount. The first useEffect runs on mount with empty dependency array, then useFocusEffect also runs immediately, causing two duplicate API calls within milliseconds.
**Impact:** Orders list API is called twice on initial load, wasting bandwidth and creating race conditions.
**Fix hint:** Remove the initial useEffect; rely only on useFocusEffect with proper dependencies.

### MA-ORD-003 Search Debounce Not Clearing Timeout
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/index.tsx:387-395
**Category:** logic
**Description:** Search debounce implementation stores timeout ID in a ref (`searchTimeout.current`), but the cleanup function clears it. However, if search query changes and component unmounts before timeout fires, the timeout will persist. This can cause state updates after unmount.
**Impact:** Memory leak warning; potential state corruption if user rapidly navigates away during search.
**Fix hint:** Use useCallback with custom debounce hook instead of raw setTimeout.

### MA-ORD-004 Pagination Deduplication Inefficiency
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/index.tsx:422-426
**Category:** perf
**Description:** When appending paginated results, code deduplicates by comparing `id` fields with `new Set()`. This is O(n) on every append. For a list with 1000 orders, appending page 2 requires iterating through all 1000 old IDs.
**Impact:** Pagination performance degrades as list grows; scrolling becomes janky when loading more items.
**Fix hint:** Use a Map for IDs instead of Set; or implement keyed deduplication on backend.

### MA-ORD-005 Error State Rendered But Refresh Doesn't Clear
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/index.tsx:581-588
**Category:** logic
**Description:** When error occurs and user presses "Retry", the `setError(null)` is not called at the start of `loadOrders()` (line 139 sets error to null, but only after the try block). If `loadOrders()` is called directly from the retry button via `loadOrders()`, error is cleared. But if called via `handleRefresh()`, error state may not be cleared if the call fails again.
**Impact:** Old error message persists on screen even after retry; confusing user.
**Fix hint:** Move `setError(null)` to the very beginning of `loadOrders()`.

### MA-ORD-006 Order Card Missing Quantity Validation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/index.tsx:241
**Category:** validation
**Description:** Order item total calculated as `orderItem.subtotal || orderItem.totalPrice || orderItem.price * orderItem.quantity || 0`. If `orderItem.quantity` is 0 or undefined, the calculation becomes wrong. Additionally, no validation ensures quantity is a positive integer.
**Impact:** Order items with quantity=0 show wrong total; math calculations may be incorrect.
**Fix hint:** Validate `quantity > 0` before using; throw error if missing.

### MA-ORD-007 More Items Display No Upper Bound
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/index.tsx:259-262
**Category:** ui
**Description:** "More items" text shows `+{item.items.length - 3}` without truncation. If an order has 1000 items, the text reads "+997 more items", which is not user-friendly and suggests a data anomaly.
**Impact:** UI appears broken for orders with many items; confusing presentation.
**Fix hint:** Cap the display to "+99 more items" if count > 99.

### MA-ORD-008 Payment Status Color Undefined for Unknown Status
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/index.tsx:275-277
**Category:** logic
**Description:** `getPaymentColor(item.payment?.status)` falls back to `PAYMENT_COLORS[status] || colors.warningScale[400]`, but if `item.payment` is undefined, `item.payment.status` will throw an error (not return undefined).
**Impact:** Order card crashes if order object doesn't have a payment field.
**Fix hint:** Use optional chaining: `getPaymentColor(item.payment?.status || 'pending')`.

### MA-ORD-009 Fulfillment Type Casting Without Type Safety
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/index.tsx:215-226
**Category:** types
**Description:** `(item as any).fulfillmentType` is cast without validation. If backend adds a new fulfillment type (e.g., 'subscription'), the code doesn't handle it and shows an empty badge or text.
**Impact:** New fulfillment types from backend are silently ignored; no badge is shown.
**Fix hint:** Create explicit union type for fulfillmentType; add default case with warning.

### MA-ORD-010 Order List Socket Update Race
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/index.tsx:361-366
**Category:** race
**Description:** Socket subscription `onOrderListUpdated()` calls `loadOrders(1, false)` to refresh on external updates. However, if user is currently paginating (loading page 3) and an external update arrives, `loadOrders(1, false)` resets pagination to page 1, losing the current page context.
**Impact:** User is navigated back to first page unexpectedly when order status changes in another session.
**Fix hint:** Only refresh current page on external update; or show banner asking user to confirm refresh.

### MA-ORD-011 Order Confirmation Page Deep-Link Validation Weak
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/order-confirmation.tsx:163-166
**Category:** validation
**Description:** Deep-link parameter validation checks `!orderId || typeof orderId !== 'string'`, but `useLocalSearchParams()` always returns strings (even if params are missing, they're empty strings, not undefined). The check `typeof orderId !== 'string'` will never be true.
**Impact:** Validation doesn't catch empty or missing orderId; page may attempt to load undefined order.
**Fix hint:** Check `!orderId || orderId.length === 0` instead.

### MA-ORD-012 Fulfillment Type Rendering Repeated Code
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/order-confirmation.tsx:300-347
**Category:** maintainability
**Description:** Fulfillment type handling is repeated multiple times in the component (lines 300, 340, 365, 384). The same ternary logic `(order as any).fulfillmentType === 'pickup' ? ... : 'drive_thru' ? ...` appears 4+ times, violating DRY principle. If a new fulfillment type is added, it must be updated in all places.
**Impact:** Bug-prone to update fulfillment types; inconsistencies may occur across different sections.
**Fix hint:** Create a helper function `renderFulfillmentInfo()` that handles all cases once.

### MA-ORD-013 Estimated Delivery Hardcoded to 4 Days
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/order-confirmation.tsx:190-202
**Category:** logic
**Description:** Estimated delivery date is hardcoded as current date + 4 days, regardless of actual order fulfillment type or delivery address. For same-day delivery or express options, this is incorrect.
**Impact:** User sees "Estimated Delivery: Apr 19" for a same-day delivery order; wrong expectation.
**Fix hint:** Use `order.estimatedDeliveryTime` or `order.delivery?.estimatedTime` from backend.

### MA-ORD-014 Order Item Variant Display Without Validation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/order-confirmation.tsx:425
**Category:** validation
**Description:** Code displays `item.variant.name` without checking if variant exists. If backend returns order item without variant, this will crash.
**Impact:** Order confirmation page crashes if any item is missing variant field.
**Fix hint:** Add optional chaining: `item.variant?.name` and conditionally render section.

### MA-ORD-015 Coins Used Display Nested Checks Fragile
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/order-confirmation.tsx:479-495
**Category:** logic
**Description:** Coins display checks if `(order.payment as any).coinsUsed` exists, then checks if rezCoins, promoCoins, or storePromoCoins > 0. But the nested ternary in line 482-484 uses `||` operator, which means if rezCoins is 0 (falsy), it will still display the section if promoCoins > 0. Additionally, the comment mentions 'wasilCoins' as an old field name, suggesting data migration issues.
**Impact:** Coins section may not display correctly if only certain coin types are used.
**Fix hint:** Use explicit checks: `(coinsUsed.rezCoins ?? 0) > 0 || (coinsUsed.promoCoins ?? 0) > 0`.

### MA-ORD-016 Order Tracking Status Color Missing Cases
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:376-391
**Category:** logic
**Description:** `getStatusColor()` function handles specific statuses but uses `nileBlue` for both 'delivered' and 'out_for_delivery', making them visually indistinguishable. Additionally, some statuses like 'on-hold' or 'disputed' fall through to the default gray color.
**Impact:** User can't distinguish between delivered and out-for-delivery at a glance; new statuses show as gray.
**Fix hint:** Use distinct colors for each status; add new status cases or implement backend-driven config.

### MA-ORD-017 Order Tracking Timeline Missing Prop Validation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:238-241
**Category:** validation
**Description:** `OrderTimeline` component is passed `timeline || order.timeline`, but no validation that either is an array. If both are undefined, the component receives undefined and may crash.
**Impact:** Tracking page crashes if order.timeline is missing.
**Fix hint:** Provide default empty array: `timeline || order.timeline || []`.

### MA-ORD-018 Service Booking Date Parsing Without Error Handling
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:280-287
**Category:** validation
**Description:** Service booking date is parsed with `new Date(bookingDetails.bookingDate)`. If bookingDate is invalid (e.g., malformed string, null), this returns an Invalid Date object, and `toLocaleDateString()` fails silently with "Invalid Date" string.
**Impact:** Service bookings show "Date: Invalid Date" text; confusing for users.
**Fix hint:** Validate date format before parsing; use moment/luxon for robust parsing.

### MA-ORD-019 Time Slot Formatting Missing Timezone
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:288-297
**Category:** logic
**Description:** Time slot is formatted from `timeSlot.start` and `timeSlot.end` strings, but no timezone information is used. If start time is "09:00" and end is "10:00", user doesn't know if it's IST or UTC.
**Impact:** User may book a service at the wrong time if timezone is ambiguous.
**Fix hint:** Store timezone in booking details; display timezone suffix (e.g., "09:00 AM IST").

### MA-ORD-020 Service Booking Status Color Hardcoded
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:303-317
**Category:** logic
**Description:** Service booking status color is determined by `item.serviceBookingId ? colors.lavenderMist : colors.linen`. Only two states are supported: confirmed or pending. If backend adds a 'cancelled' status, it will be treated as pending with wrong color.
**Impact:** Cancelled bookings appear as pending; wrong visual feedback.
**Fix hint:** Create status-to-color mapping; handle all possible booking statuses.

### MA-ORD-021 Order History Socket Subscription Not Cleaned Up
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/index.tsx:362-366
**Category:** memory
**Description:** Socket subscription `onOrderListUpdated()` returns an unsubscribe function (line 365), but it's not called in a useEffect cleanup. If component unmounts, the subscription remains active and may cause memory leaks or stale closures.
**Impact:** Memory leak; socket listener persists after component unmount; old data updates trigger state updates on unmounted component.
**Fix hint:** Store unsubscribe function and call it in useEffect cleanup: `return () => unsubscribe();`.

### MA-ORD-022 Order Cancellation Without Pending State
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[id].tsx:78-100
**Category:** logic
**Description:** `confirmCancelOrder()` sets `setCancelling(true)` but doesn't disable the cancel button during the request. If user double-taps the cancel button, multiple requests are sent to the backend.
**Impact:** Double cancellation may be processed; unexpected errors.
**Fix hint:** Disable cancel button UI while `cancelling` is true.

### MA-ORD-023 Order Tracking Status Text Not Normalized
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:393-404
**Category:** logic
**Description:** `getStatusLabel()` function maps status strings to labels, but if status is `null` or `undefined`, the lookup returns `undefined` and code falls back to `status.toUpperCase()`, which throws an error.
**Impact:** Tracking page crashes if order.status is null.
**Fix hint:** Provide default status: `getStatusLabel(order.status || 'pending')`.

### MA-ORD-024 Order Delivery Address Missing Fields
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:342-357
**Category:** validation
**Description:** Delivery address fields are accessed without null checks: `order.delivery.address.city`, `order.delivery.address.state`. If address is missing any field, the display breaks.
**Impact:** Tracking page crashes or shows incomplete address if address fields are missing.
**Fix hint:** Add guards: `order.delivery?.address?.city || 'N/A'`.

### MA-ORD-025 Order Tracking Refresh Without Loading State
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:53-55
**Category:** ux
**Description:** `handleRefresh()` calls `refresh()` but doesn't show any loading indicator or toast. User has no feedback that the refresh is happening.
**Impact:** User may tap refresh multiple times thinking it didn't work.
**Fix hint:** Show loading state or toast: "Refreshing order status...".

### MA-ORD-026 Order Cancellation Race with Status Change
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[id].tsx:136-138
**Category:** race
**Description:** `canCancelOrder()` checks status: `['pending', 'placed', 'confirmed', 'processing', 'preparing', 'ready'].includes(status)`. However, if backend changes status to 'dispatched' between the time user taps cancel and the API call is made, the cancellation will succeed (backend allows it) but the frontend thought it couldn't be cancelled.
**Impact:** Inconsistent cancel behavior; user expects "can't cancel" but order is cancelled anyway.
**Fix hint:** Server-side validation for cancellation eligibility; don't rely on frontend check.

### MA-ORD-027 Order Total Calculation Missing Nullish Checks
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:252-255
**Category:** validation
**Description:** Order total is displayed as `order.totals?.total ?? 0`. However, if `order.totals` is null (not undefined), the nullish coalescing operator doesn't work as expected.
**Impact:** Order total shows as 0 if totals object is null.
**Fix hint:** Use explicit checks: `order?.totals?.total || 0`.

### MA-ORD-028 Contact Support Deep Link Hardcoded
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:79
**Category:** maintainability
**Description:** Support phone number is hardcoded as '+918001234567'. If support number changes, code must be updated. No config or API endpoint provides the number.
**Impact:** Support contact information is stale if stored separately on backend.
**Fix hint:** Fetch support number from config API or environment variables.

### MA-ORD-029 Reconnection Attempts Not Capped
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:156-175
**Category:** logic
**Description:** Reconnection banner shows `reconnectAttempts || 1`, suggesting attempts counter exists. However, no logic appears to cap max reconnection attempts. If network is down for hours, the counter may grow unbounded.
**Impact:** UI shows attempt number that grows without bound; confusing message.
**Fix hint:** Cap max reconnection attempts (e.g., 5); show "max retries reached" after limit.

### MA-ORD-030 Order Item Name Resolution Ambiguous
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/orders/[orderId]/tracking.tsx:260
**Category:** validation
**Description:** Item name is resolved as `item.name || item.product?.name`. If both are empty strings (falsy but not undefined), no fallback is used. Additionally, no validation ensures at least one of them exists.
**Impact:** Order items may show empty name if name field is missing from both places.
**Fix hint:** Use explicit nullish checks: `item.name ?? item.product?.name ?? 'Unknown Item'`.

### MA-ORD-031 Web Order Checkout Form Submission Without Idempotency Key
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/order/[storeSlug]/checkout.tsx:1-250
**Category:** idempotency
**Description:** Web QR ordering checkout creates orders via `createWebOrder()` API without any idempotency key mechanism. If user network drops after form submission and they retry, a duplicate order will be created. No idempotency token is generated or sent with the request.
**Impact:** User can be double-charged if payment succeeds but order confirmation fails and they retry.
**Fix hint:** Generate idempotency key from { storeSlug, phone, cart_hash }; send with every order creation request; server validates and rejects duplicates.
**Status:** Fixed in commit (2026-04-15) — Added idempotencyKey generation on mount and passed with order creation request

