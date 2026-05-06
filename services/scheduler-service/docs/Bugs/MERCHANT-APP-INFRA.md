# Merchant App — Infra (hooks, contexts, utils, stores, providers)

> **Audit date:** 2026-04-15
> **Bugs found:** 28
> **Status:** Open — merchant app infrastructure audit

---

### MA-INF-001 SocketContext Promise.all without cancellation check on rejection
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/SocketContext.tsx:146-259
**Category:** async
**Description:** Promise.all([getIO(), getAuthToken(), getUser()]) resolves before checking cancelled flag (line 146-147). If promise rejects, the catch handler (line 250) checks cancelled, but the handlers (line 173-242) attached to socket are never removed if cancelled=true during pending async work.
**Impact:** Memory leak of socket event handlers; socket.on() references persist even if component unmounts during Promise.all wait.
**Fix hint:** Move cancelled check to both resolve and reject paths; clean up handlers in catch block if cancelled.

---

### MA-INF-002 OfflineQueueContext autoSync closure captures stale status
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/OfflineQueueContext.tsx:412-427
**Category:** closure
**Description:** setupNetworkMonitoring() (line 412) captures autoSync and status in closure but doesn't include them in any dependency tracking. When network reconnects (line 420), the condition `(status?.pending || 0) > 0` (line 422) may read stale status from when listener was attached.
**Impact:** Auto-sync on network reconnect uses stale pending count; may sync zero items or miss items added after setup.
**Fix hint:** Store autoSync and status in refs; update refs when state changes; read from refs in network listener.

---

### MA-INF-003 OfflineQueueContext setupEventListeners missing cleanup
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/OfflineQueueContext.tsx:391-406
**Category:** memory
**Description:** setupEventListeners() (line 391) calls billUploadQueueService.on() three times (lines 393, 398, 403) but doesn't return unsubscribe functions. The cleanup() function (line 433) calls removeAllListeners() but listeners attached here are never deregistered explicitly.
**Impact:** Event listeners accumulate on every provider remount; potential memory leak and duplicate event firing.
**Fix hint:** Store unsubscribe functions returned from .on() calls; call them in cleanup().

---

### MA-INF-004 LocationContext Promise.race() with async initPromise not properly awaited
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/LocationContext.tsx:111-123
**Category:** promise
**Description:** initPromise is defined as `async () => { ... }` (line 111) but called as `initPromise()` (line 123) inside Promise.race(). The race() call doesn't await the returned promise — it races the Function constructor itself, not its execution.
**Impact:** Location initialization never completes; permission status never loads; always uses default Bangalore location.
**Fix hint:** Either call initPromise() before race or wrap: `Promise.race([initPromise(), timeoutPromise])`.

---

### MA-INF-005 CartContext calculateTotals doesn't validate discount sign
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/CartContext.tsx:171-191
**Category:** validation
**Description:** calculateTotals (line 171) reads item.discount (line 186) without validating it's non-negative. If API returns negative discount, it inflates the total instead of reducing it (Math.max(0, ...) only prevents negation, not inflation).
**Impact:** Malicious or corrupted API response with negative discount inflates cart total, breaking billing.
**Fix hint:** Assert discount >= 0 before use; throw or log if invalid.

---

### MA-INF-006 CartContext missing dependency in useMemo for totalPrice calculation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/CartContext.tsx:182-191
**Category:** hook
**Description:** calculateTotals() is called inside reducer but calculateTotals itself depends on item.discountedPrice and item.originalPrice. If these values change outside the reducer context, the memoized total is stale.
**Impact:** Price changes in items don't propagate to total until state is recomputed by the reducer.
**Fix hint:** Memoize calculateTotals with proper dependencies or move calculation to derived state.

---

### MA-INF-007 LocationContext initializeLocation doesn't handle timeout cleanup
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/LocationContext.tsx:94-146
**Category:** cleanup
**Description:** The timeoutPromise (line 108) creates a timeout that rejects after 3s, but if the initPromise resolves before timeout, the setTimeout is never cleared. The timeout handler still fires after 3s, potentially dispatching stale state.
**Impact:** Race condition between initialization success and timeout rejection; stale state updates after initialization complete.
**Fix hint:** Clear timeout on successful resolve; use AbortController or explicit cancellation.

---

### MA-INF-008 ProfileContext mapBackendUserToProfileUser rebuilds on every call
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/ProfileContext.tsx:24-127
**Category:** performance
**Description:** mapBackendUserToProfileUser is a function that runs on every provider render without memoization. It re-creates the entire User object, including nested objects like wallet and preferences, even if backendUser hasn't changed.
**Impact:** Unnecessary re-renders of child components; memory churn from repeated object creation.
**Fix hint:** Memoize this function with useCallback or move outside component; cache previous result.

---

### MA-INF-009 GamificationContext missing dependency in load effect
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/GamificationContext.tsx:392-441
**Category:** hook
**Description:** The Promise.allSettled() call (line 441) fetches achievements, coins, and challenges but the effect that triggers this doesn't depend on feature flags or authentication state changes, only on mount.
**Impact:** Feature flag changes at runtime don't trigger re-fetch; data is stale if flags toggle.
**Fix hint:** Add featureFlags and isAuthenticated to effect dependency array.

---

### MA-INF-010 useCachedQuery dedupeRequest doesn't handle promise rejection cleanup
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/hooks/useCachedQuery.ts:45-61
**Category:** promise
**Description:** The finally() block (line 55) deletes from ongoingRequests after fetch completes, but if the fetcher() throws, subsequent requests for the same key immediately retry instead of waiting for the original promise. The cleanup is correct, but the dedup assumes all callers handle the same error the same way.
**Impact:** Error handling is not shared; each caller that catches the error may retry independently, defeating dedup purpose.
**Fix hint:** Consider using a separate error state or sentinel value; wrap errors in a result object.

---

### MA-INF-011 useCachedQuery isMounted ref checked but not initialized consistently
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/hooks/useCachedQuery.ts:111-180
**Category:** hook
**Description:** isMounted ref (line 111) is set to true initially, but if the hook's cleanup runs before the first fetch completes, isMounted.current is set to false (line 189), and subsequent mounts won't reset it back to true.
**Impact:** Hook disabled after unmount; subsequent mounts of the same hook instance don't work.
**Fix hint:** Initialize isMounted to true on mount in useEffect; reset in cleanup function.

---

### MA-INF-012 ThemeContext useTheme returns new object every call without memoization
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/ThemeContext.tsx:79-100
**Category:** hook
**Description:** The return object (line 85-99) is created fresh on every useTheme() call without useMemo. Components that destructure `const { colors, isDark } = useTheme()` get new object references every render.
**Impact:** Child components using useTheme() re-render unnecessarily; breaks memoization in descendants.
**Fix hint:** Wrap return in useMemo with [isDark, resolved.themeMode] dependencies.

---

### MA-INF-013 OfflineQueueContext onQueueChange callback captured in stale closure
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/OfflineQueueContext.tsx:153-157
**Category:** closure
**Description:** The useEffect (line 153) depends on [status, onQueueChange] but onQueueChange is a callback prop that may be stale if the parent doesn't memoize it. Every time the parent re-renders with a new onQueueChange, this effect fires even if status hasn't changed.
**Impact:** Callback is called unnecessarily on every parent render; potential duplicate queue change notifications.
**Fix hint:** Document that onQueueChange should be memoized with useCallback in parent; use useRef to track if callback changed.

---

### MA-INF-014 OfflineQueueContext refreshQueue called without loading state guard
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/OfflineQueueContext.tsx:308-320
**Category:** state
**Description:** refreshQueue (line 308) calls Promise.all() without setting isLoading=true before the async call. Multiple concurrent calls to refreshQueue can fire simultaneously, causing race conditions in queue state.
**Impact:** Race condition; queue state may reflect out-of-order responses; last-call-wins race.
**Fix hint:** Add setError(null) at start; consider queuing refreshes or using a flag to prevent concurrent calls.

---

### MA-INF-015 useMarketingInbox fetchInbox doesn't check if mounted before setMessages
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/hooks/useMarketingInbox.ts:10-23
**Category:** hook
**Description:** fetchInbox (line 10) is async and calls setMessages (line 16) without checking if component is still mounted. If the hook unmounts before the API response arrives, it sets state on unmounted component.
**Impact:** Memory leak warning in dev mode; stale state updates after unmount.
**Fix hint:** Add isMounted ref; check before setMessages; return cleanup from useEffect to mark unmounted.

---

### MA-INF-016 OfflineQueueContext isPending closure captures stale queue
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/OfflineQueueContext.tsx:329-335
**Category:** closure
**Description:** isPending (line 329) includes [queue] in deps but returns a stable function reference. If queue changes, the old reference is stale. Components calling isPending(billId) from a cached ref will search stale queue.
**Impact:** isPending returns wrong status if queue changes between function capture and invocation.
**Fix hint:** Move isPending logic to context; return fresh reference on queue change or use useCallback properly.

---

### MA-INF-017 ProfileContext useMemo missing dependency on authUser
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/ProfileContext.tsx:149-150
**Category:** hook
**Description:** The user useMemo (line 149) calls mapBackendUserToProfileUser(authUser) but mapBackendUserToProfileUser is not memoized. If authUser identity changes (by reference), useMemo doesn't recalculate because mapBackendUserToProfileUser returns a new object each time.
**Impact:** User object stale if authUser changes; child components don't see new data.
**Fix hint:** Memoize mapBackendUserToProfileUser or move it inside useMemo body.

---

### MA-INF-018 SocketContext resubscribeAll doesn't guard against null socketRef
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/SocketContext.tsx:293-307
**Category:** null-safety
**Description:** resubscribeAll (line 293) checks `if (!socketRef.current) return` (line 294) but then emits events with `socketRef.current?.emit()` (line 297-305). If socketRef becomes null between the guard and emit, optional chaining prevents errors but subscriptions silently fail.
**Impact:** Silent subscription failures after socket disconnect/reconnect; client doesn't know subs failed.
**Fix hint:** Log failures or queue subscriptions if socket not ready; retry with exponential backoff.

---

### MA-INF-019 CartContext reducer CART_LOADED doesn't validate payload structure
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/CartContext.tsx:199-200
**Category:** validation
**Description:** CART_LOADED action (line 199) receives action.payload as CartItemWithQuantity[] but doesn't validate that each item has required fields. Missing quantity, price, or other fields can crash calculateTotals().
**Impact:** Invalid API response can corrupt cart state; crashes on missing fields.
**Fix hint:** Validate payload structure; map and sanitize API response before dispatching CART_LOADED.

---

### MA-INF-020 LocationContext getCurrentLocation doesn't cancel pending request on unmount
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/LocationContext.tsx:188-228
**Category:** cleanup
**Description:** getCurrentLocation (line 188) is async but doesn't use AbortController or cancelled flag. If the component unmounts during geolocation fetch, the response still dispatches state even after unmount.
**Impact:** Memory leak; stale state updates after unmount; potential state corruption if location changes.
**Fix hint:** Add cancelled flag or AbortSignal; check before dispatch; cleanup on unmount.

---

### MA-INF-021 GamificationContext achievementQueue unbounded growth
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/GamificationContext.tsx:131-139
**Category:** memory
**Description:** ACHIEVEMENT_UNLOCKED (line 126) appends to achievementQueue without limit (line 131-138). The ACHIEVEMENT_SHOWN (line 141) removes shown items, but if shown items are never displayed, queue grows unbounded.
**Impact:** Memory leak; achievementQueue grows without bounds if achievements unlock but aren't shown.
**Fix hint:** Implement max queue size; trim old items if queue exceeds limit; add TTL to achievements.

---

### MA-INF-022 useOfflineQueue return value not memoized
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/hooks/useOfflineQueue.ts:108-200
**Category:** hook
**Description:** The hook returns an object with computed properties (isEmpty, hasPendingUploads, etc.) but doesn't memoize the return value. Each call creates new object references, breaking dependency arrays in caller components.
**Impact:** Callers using this hook in useEffect deps will re-run every render even if values haven't changed.
**Fix hint:** Already has useMemo for individual computed values; wrap final return object in useMemo with all deps.

---

### MA-INF-023 SocketContext event handlers not type-safe on socket.on() calls
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/SocketContext.tsx:236-242
**Category:** types
**Description:** socket.on() calls (line 236-242) pass event names as strings (SocketEvents enum values) but socket type is `any`. No compile-time validation that handler signature matches event payload.
**Impact:** Runtime errors if handler signature doesn't match event payload shape; refactoring breaks silently.
**Fix hint:** Type socket properly as Socket<ServerToClientEvents, ClientToServerEvents>; validate handler signatures.

---

### MA-INF-024 CartContext doesn't handle currency conversion in totals
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/CartContext.tsx:182-191
**Category:** calculation
**Description:** calculateTotals (line 182) uses item prices directly without checking if they're in the current region's currency. If region changes mid-session, prices are still calculated in old currency.
**Impact:** Multi-region apps show wrong totals after region switch; currency mismatch.
**Fix hint:** Include currency in calculateTotals; convert prices or clear cart on region change.

---

### MA-INF-025 ProfileContext completionStatus useEffect missing dependency
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/ProfileContext.tsx:131-160
**Category:** hook
**Description:** The _profileCompletionLoaded module-level guard (line 132) persists across component remounts. If the provider remounts (e.g., auth state changes), completionStatus is never reloaded because _profileCompletionLoaded is already true.
**Impact:** Profile completion status becomes stale if provider remounts; user sees cached status.
**Fix hint:** Move _profileCompletionLoaded to useRef; reset it per provider instance, not globally.

---

### MA-INF-026 OfflineQueueContext value useMemo missing callback dependencies
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/OfflineQueueContext.tsx:448-495
**Category:** hook
**Description:** The useMemo (line 448) wraps all context value callbacks and includes them in deps (line 474-494). But syncQueue and retryFailed also include onSyncComplete/onSyncError in their deps (line 238), creating a chain that forces re-renders if props change.
**Impact:** Provider re-renders propagate to all consumers even if queue state unchanged; performance impact.
**Fix hint:** Separate stable context value from callback deps; memoize callbacks independently.

---

### MA-INF-027 useCachedQuery retry logic doesn't implement exponential backoff
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/hooks/useCachedQuery.ts:125-175
**Category:** api-client
**Description:** The retry loop (line 125) uses a fixed retryDelay (line 92) with no exponential increase. Retrying every 1s for 3 attempts causes thundering herd if many hooks retry simultaneously.
**Impact:** Retry storms; excessive API load during outages.
**Fix hint:** Implement exponential backoff: delay = retryDelay * (2 ** attempt) + jitter.

---

### MA-INF-028 LocationContext doesn't persist location across app restarts
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/LocationContext.tsx:94-146
**Category:** persistence
**Description:** LocationProvider doesn't load cached location from AsyncStorage on initialization. Every app start uses the default Bangalore location, losing the last user location.
**Impact:** UX regression; users always start with wrong location after app restart.
**Fix hint:** Load cached location in initializeLocation; fallback to default if missing.

---

### MA-INF-029 SocketContext doesn't handle token expiry during subscription
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/contexts/SocketContext.tsx:146-290
**Category:** auth
**Description:** The socket connects with authToken (line 167) but if token expires while socket is connected, the socket doesn't re-authenticate. Subscriptions continue with stale token; backend rejects events.
**Impact:** Silent failure of real-time updates; user doesn't see stock/price updates after token refresh.
**Fix hint:** Listen for token expiry; reconnect socket with new token or implement auth refresh on socket level.

