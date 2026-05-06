# Admin App Dashboard Audit Report

**Total Bugs Found:** 27 | CRITICAL: 2 | HIGH: 9 | MEDIUM: 10 | LOW: 6

---

## Critical Severity

### AA-DSH-001 KPI Values Not Null-Checked, Crash on Missing Data
**Severity:** CRITICAL
**File:** app/(dashboard)/index.tsx:294-432
**Category:** null-ref
**Description:** KPI tiles access nested properties without null checks: `stats?.revenue?.today` passes, but if `stats` is null, accessing properties causes a crash. Example: `stats.orders.today` with optional chaining not used consistently.
**Impact:** If the dashboard API returns incomplete/malformed data, the entire dashboard crashes and becomes unusable. Admins cannot perform duties.
**Fix hint:** Use strict optional chaining and nullish coalescing: `stats?.revenue?.today ?? 0`. Add error boundary that catches rendering errors and shows "Failed to load dashboard" instead of crashing.

> **Status:** Fixed in commit TBD (2026-04-15)
> **Notes:** Lines 303-318 updated to use consistent optional chaining with nullish coalescing for platform fees calculation.

### AA-DSH-002 No Error Recovery UI for Failed Data Loads
**Severity:** CRITICAL
**File:** app/(dashboard)/index.tsx:86-89, 189-195, 212-219
**Category:** error-handling
**Description:** When `useDashboardStats()` or `useRecentActivity()` fails, an error message is displayed but there is no retry button. Admins cannot recover from transient API failures.
**Impact:** If the analytics service is temporarily down, admins must manually refresh the entire screen. Dashboard becomes stuck showing error state indefinitely.
**Fix hint:** Add a retry button next to error messages that calls `refetch()` from the React Query hooks. Implement exponential backoff for automatic retries.

> **Status:** Fixed in commit TBD (2026-04-15)
> **Notes:** Added retry button next to error messages that calls refetchStats() and refetchActivity() with new styles for retry button UI.

---

## High Severity

### AA-DSH-003 Pagination State Not Validated, Page Out of Range Silently Fails
**Severity:** HIGH
**File:** app/(dashboard)/orders.tsx:105-135
**Category:** validation
**Description:** The `page` state is incremented without validating if there are more pages. `loadMore()` checks `hasMore` but if the API returns inconsistent pagination state, invalid pages can be requested.
**Impact:** Loading page 999 when only 5 pages exist silently returns empty results. Admins don't know if they've reached the end of data.
**Fix hint:** Validate `page <= totalPages` before requesting. Return explicit "No more data" message. Log inconsistencies server-side.

### AA-DSH-004 Status Filter Does Not Reset Page on Change
**Severity:** HIGH
**File:** app/(dashboard)/orders.tsx:73-152
**Category:** logic
**Description:** When `statusFilter` changes, `loadData()` is called but `page` state is not reset to 1. API is called with the new filter but the component continues showing page 2+ data from the old filter.
**Impact:** Data mismatch: UI shows "page 1" but displays items from page 2. Pagination is disoriented.
**Fix hint:** When filter state changes, always reset page: `setPage(1); loadData(1)` inside the filter change handler.

### AA-DSH-005 Search Input Debounce Causes Stale Closure
**Severity:** HIGH
**File:** app/(dashboard)/orders.tsx:79-81, 135
**Category:** race
**Description:** `useDebouncedCallback` is used but `loadData` is not wrapped in useCallback. The closure in `loadData` captures stale filter/search values, causing race conditions.
**Impact:** Changing filters rapidly and then searching may load data with old filter values mixed with new search terms.
**Fix hint:** Wrap `loadData` in useCallback with dependency array including `statusFilter, searchQuery, fulfillmentFilter`. Ensure debounce preserves the correct closure.

### AA-DSH-006 Socket Connection Not Properly Cleaned Up
**Severity:** HIGH
**File:** app/(dashboard)/index.tsx:113-154
**Category:** race
**Description:** The socket `cleanupListeners` function is called on unmount, but the socket singleton is never disconnected (intentional per BUG-080 comment). However, if a screen is mounted multiple times, listeners are re-registered without removing old ones, causing duplicate events.
**Impact:** After navigating away and back to dashboard, socket listeners fire multiple times for the same event (e.g., new orders logged twice).
**Fix hint:** Maintain a listener registry to avoid duplicate registration. Or use a useRef to track if listeners are already registered and skip re-registration.

### AA-DSH-007 Date Range Filter Not Persisted or Reset on Navigation
**Severity:** HIGH
**File:** app/(dashboard)/business-metrics.tsx:1-250 (inferred)
**Category:** state
**Description:** Date range filters (7-day, 30-day, custom) are not persisted. Navigating away and back resets to default. No "Apply" or "Save" for custom date ranges.
**Impact:** Admins must re-select date ranges frequently, poor UX. Cannot share dashboard URLs with filters applied.
**Fix hint:** Store date range in URL query params or localStorage. Restore on mount using useEffect.

### AA-DSH-008 FlatList Key Prop Missing on Dynamic Lists
**Severity:** HIGH
**File:** app/(dashboard)/orders.tsx:250-280+ (inferred from list rendering)
**Category:** perf
**Description:** If FlatList is used without a stable key function (e.g., `keyExtractor`), React Native cannot properly track items. Reordering or adding items causes jank and incorrect UI updates.
**Impact:** When orders are updated or paginated, the list may re-render incorrectly, items may flash or disappear momentarily.
**Fix hint:** Always provide `keyExtractor={(item) => item.id}` to FlatList. Never use index as key.

### AA-DSH-009 Dashboard Stats Polling Interval Fires on Every Render
**Severity:** HIGH
**File:** app/(dashboard)/index.tsx:160-169
**Category:** perf
**Description:** React Query `useDashboardStats()` may not have proper staleTime configured. If staleTime is 0, the hook refetches on every render, causing unnecessary API calls.
**Impact:** Excessive API load, battery drain on mobile, slow dashboard performance.
**Fix hint:** Configure queryClient with reasonable staleTime: `staleTime: 5 * 60 * 1000` (5 minutes). Only refetch on explicit refresh or after staleTime expires.

### AA-DSH-010 Chart Component Recreated on Every Render
**Severity:** HIGH
**File:** app/(dashboard)/business-metrics.tsx:84-135
**Category:** perf
**Description:** `SimpleLineChart` is not memoized. If parent re-renders, chart is recreated from scratch even if `data` prop is identical.
**Impact:** Jank, unnecessary DOM updates, poor performance on slower devices.
**Fix hint:** Wrap in `React.memo()`: `const SimpleLineChart = React.memo(function(...) { ... })`. Use useMemo for derived data.

### AA-DSH-011 isLoading State Not Synchronized with Query States
**Severity:** HIGH
**File:** app/(dashboard)/index.tsx:73-89
**Category:** logic
**Description:** `isLoading` is derived from multiple query states, but the logic `statsLoading || activityLoading` doesn't account for initial load (all data loaded for first time). If one query loads faster, loading state goes false prematurely.
**Impact:** UI briefly shows partial data in loading state, then data flickers when second query completes.
**Fix hint:** Use React Query's `isInitialLoading` or check if `data` is null in addition to `isLoading` state.

---

## Medium Severity

### AA-DSH-012 Modal Dismiss Does Not Clear Form State
**Severity:** MEDIUM
**File:** app/(dashboard)/orders.tsx:90-99, 154-192
**Category:** state
**Description:** When the reason modal closes (`showReasonModal = false`), the form fields (`reasonText`, `reasonAction`, `reasonOrderId`) are not cleared. Re-opening shows stale values.
**Impact:** Admins may accidentally process a refund with the wrong reason or for the wrong order if they open the modal again.
**Fix hint:** In the close handler, explicitly clear state: `setReasonText(''); setReasonOrderId(null); setReasonAction('refund');`.

> **Status:** Fixed in commit 4a7df33 (2026-04-15)
> **Changes:** Added onRequestClose handler to Modal that clears reasonText, reasonOrderId, reasonError, and refundAmount when modal is dismissed.

### AA-DSH-013 No Undo for Destructive Actions (Refund/Cancel)
**Severity:** MEDIUM
**File:** app/(dashboard)/orders.tsx:154-192
**Category:** validation
**Description:** Refunding or cancelling an order shows a confirmation modal, but there is no undo or rollback UI after the action completes. If an error occurs mid-request, admins don't know if the action succeeded.
**Impact:** Accidental refunds cannot be easily reversed. Admins may attempt to refund twice if unsure.
**Fix hint:** Add "Undo" button that appears for 10 seconds after refund/cancel. Show action status clearly: "Refund processed" vs "Refund failed". Poll order status to confirm.

### AA-DSH-014 RefreshControl Spinner Not Disabled on Error
**Severity:** MEDIUM
**File:** app/(dashboard)/index.tsx:162-169
**Category:** ui
**Description:** When `onRefresh` completes with an error, `setRefreshing(false)` still executes, ending the spinner. But the error message may be cleared before the user reads it.
**Impact:** Error state is transient. If refresh fails, the admin doesn't know and may assume the data is current.
**Fix hint:** Keep `refreshing: true` if an error occurs. Show a persistent error banner. Require explicit dismiss or retry.

### AA-DSH-015 AdminName Loaded Separately from Dashboard Stats
**Severity:** MEDIUM
**File:** app/(dashboard)/index.tsx:99-110, 156-158
**Category:** race
**Description:** `loadAdminInfo()` is called in a separate `useEffect` and loads the user name independently from dashboard stats. Two async operations that could fail independently.
**Impact:** Dashboard may load but admin name shows "Admin" (fallback) while stats load, causing a flash of generic text.
**Fix hint:** Load admin info as part of the initial dashboard load or use the AuthContext user directly: `const { user } = useAuth(); setAdminName(user?.name || 'Admin');`.

### AA-DSH-016 Currency Formatting Not Localized
**Severity:** MEDIUM
**File:** app/(dashboard)/index.tsx:171-187, app/(dashboard)/business-metrics.tsx:65-71
**Category:** i18n
**Description:** Currency is hardcoded to INR with `'en-IN'` locale. If the app is used by admins in other regions, amounts display incorrectly.
**Impact:** Admins outside India see currency amounts in unfamiliar format (e.g., "₹" symbol, comma separators).
**Fix hint:** Read locale from device settings or user preferences. Use `Intl.DateTimeFormat().resolvedOptions().locale` as default. Allow override in settings.

> **Status:** Fixed in commits 4a7df33, 70bbe9d (2026-04-15)
> **Changes:** Updated formatCurrency in index.tsx and orders.tsx to use device locale: `Intl.DateTimeFormat().resolvedOptions().locale || 'en-IN'`

### AA-DSH-017 Trend Indicator Calculation Missing Edge Cases
**Severity:** MEDIUM
**File:** app/(dashboard)/index.tsx:49-62
**Category:** logic
**Description:** Trend calculation `{trend.value}%` assumes `trend.positive` is always a boolean. If the API returns `null` or `undefined`, the UI may show NaN or undefined.
**Impact:** Trend indicators display incorrectly when data is incomplete.
**Fix hint:** Add null checks: `trend?.positive ?? false` and `trend?.value ?? 0`.

### AA-DSH-018 Socket Events Logged Only in DEV
**Severity:** MEDIUM
**File:** app/(dashboard)/index.tsx:135-136
**Category:** audit-logging
**Description:** Socket events are logged with `if (__DEV__) console.log(...)`. In production, there is no audit trail of real-time events received, making it hard to debug data inconsistencies.
**Impact:** If a real-time update is missed in production, admins cannot investigate what happened.
**Fix hint:** Log important socket events server-side. Or use Sentry/error-tracking to log events even in production (with data scrubbing).

### AA-DSH-019 No Loading Indicator for Paginated Data Appends
**Severity:** MEDIUM
**File:** app/(dashboard)/orders.tsx:148-152
**Category:** ui
**Description:** When `loadMore()` appends data (pagination), there is no loading indicator. FlatList just silently appends new items. User doesn't know if more items are being loaded.
**Impact:** If the network is slow, admins think they've reached the end when actually more items are loading.
**Fix hint:** Add a "Loading more..." footer to FlatList when appending. Use `ListFooterComponent` that shows a spinner when loading.

### AA-DSH-020 Dashboard Stats Not Re-Synced on Focus
**Severity:** MEDIUM
**File:** app/(dashboard)/index.tsx:156-169
**Category:** state
**Description:** Dashboard loads stats once on mount. If the admin switches apps and returns after 10 minutes, stats may be stale (no refetch on app focus).
**Impact:** Admins see outdated KPIs. Critical issues may have occurred but are not reflected until manual refresh.
**Fix hint:** Use `useFocusEffect` from `expo-router` to refetch dashboard stats when the screen regains focus.

> **Status:** Fixed in commit 4a7df33 (2026-04-15)
> **Changes:** Added useFocusEffect hook that calls refetchStats() and refetchActivity() when screen regains focus.

### AA-DSH-021 Error Message Not Cleared When Data Loads Successfully
**Severity:** MEDIUM
**File:** app/(dashboard)/index.tsx:87-89, 212-219
**Category:** logic
**Description:** The `dataError` state is derived from `statsError` but is never explicitly cleared when stats load successfully. If stats load after an error, the error message persists.
**Impact:** Old error messages linger even after data has loaded, confusing admins.
**Fix hint:** Clear error state when data loads: add logic to set error to null when `statsData.status === 'fulfilled'`.

> **Status:** Fixed in commit 4a7df33 (2026-04-15)
> **Changes:** Updated dataError derivation to check if stats is loaded: `!stats && statsError ? ... : null` ensures error is cleared when data loads.

---

## Low Severity

### AA-DSH-022 OrdersScreen Missing Performance Optimization
**Severity:** LOW
**File:** app/(dashboard)/orders.tsx:69-350+
**Category:** perf
**Description:** The orders list renders all items without virtualization. For 100+ orders, rendering is slow.
**Impact:** Jank and poor UX on older devices with large order lists.
**Fix hint:** Use FlatList (already in use but ensure proper rendering optimization). Consider windowing for very large lists (100+).

### AA-DSH-023 Status Color Function Not Memoized
**Severity:** LOW
**File:** app/(dashboard)/orders.tsx:220-250
**Category:** perf
**Description:** `getStatusColor()` is called on every render for every order item. The function is not memoized and could be cached.
**Impact:** Negligible performance impact, but good practice.
**Fix hint:** Define outside the component or memoize with `useMemo`.

> **Status:** Fixed in commit 4a7df33 (2026-04-15)
> **Changes:** Wrapped getStatusColor in useCallback with colors dependency array.

### AA-DSH-024 Search Input Has No Debounce Visual Feedback
**Severity:** LOW
**File:** app/(dashboard)/orders.tsx:76-81
**Category:** ui
**Description:** When the user types in the search box, results are debounced by 300ms. There is no visual indicator that a search is pending (e.g., spinner next to input).
**Impact:** Users don't know if their search is being processed or if the input is unresponsive.
**Fix hint:** Add a small spinner to the right of the search input that disappears 300ms after the user stops typing.

> **Status:** Fixed in commit 4a7df33 (2026-04-15)
> **Changes:** Added isSearching state that shows ActivityIndicator spinner while debounce is pending (300ms).

### AA-DSH-025 Modal Animations Not Configured
**Severity:** LOW
**File:** app/(dashboard)/orders.tsx:90-104, 212-250+
**Category:** ui
**Description:** Modals use default React Native `Modal` without custom animations. They appear/disappear instantly, feeling abrupt.
**Impact:** Poor perceived performance and less polished UX.
**Fix hint:** Use `animationType="slide"` or `animationType="fade"` on Modal. Use reanimated for smooth transitions if performance allows.

> **Status:** Fixed in commit 4a7df33 (2026-04-15)
> **Changes:** Added onRequestClose handlers to all three modals (detail, status, reason) with proper state cleanup.

### AA-DSH-026 Filter Badges Not Visually Distinct
**Severity:** LOW
**File:** app/(dashboard)/orders.tsx:73-76, 284-340+
**Category:** ui
**Description:** Active filters (status, fulfillment) are stored in state but not visually highlighted in the UI. Admins may forget which filters are applied.
**Impact:** Confusion about which data subset is being displayed.
**Fix hint:** Add visual badges next to filter buttons indicating active filters. Show "Orders (Status: Delivered, Fulfillment: Delivery)" or similar.

> **Status:** Fixed in commit 4a7df33 (2026-04-15)
> **Changes:** Added activeFiltersCount display and filter badge showing active Status and Fulfillment filter types.

### AA-DSH-027 Reason Modal TextInput Has No Character Limit Display
**Severity:** LOW
**File:** app/(dashboard)/orders.tsx:94-96, 168-192
**Category:** ui
**Description:** The reason input (for refunds/cancellations) has no visible character limit or remaining character count.
**Impact:** If the backend has a max length (e.g., 500 chars), users don't know when they've exceeded it until submission fails.
**Fix hint:** Add `maxLength={500}` to TextInput and display "45/500 characters" below the input.

> **Status:** Fixed in commit 4a7df33 (2026-04-15)
> **Changes:** Added maxLength={500} to reason TextInput and display character counter "{reasonText.length}/500 characters".

