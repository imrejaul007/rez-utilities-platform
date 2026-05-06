# Consumer App — Infra (hooks, contexts, utils, stores)

> **Audit date:** 2026-04-15
> **Bugs found:** 30
> **Status:** Open — consumer app audit

---

### [CA-INF-001] useCallback with empty dependency array captures stale state
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useAnalytics.ts:20-43
**Category:** hook
**Description:** trackEvent callback (line 20) depends on currentLocation from state but the dependency array only captures it at definition time. If Location context updates, trackEvent will send stale data.
**Impact:** Enriched event data sent to backend uses old location for potentially hours, breaking location-based analytics.
**Fix hint:** Add currentLocation to trackEvent's dependency array.

### [CA-INF-002] NotificationProvider loadSettings not wrapped in useCallback
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/NotificationContext.tsx:130-157
**Category:** context
**Description:** loadSettings is defined inline but depends on isAuthenticated and user.id. Any parent re-render causes new function reference, breaking effect dependencies.
**Impact:** Redundant calls to userSettingsApi.getUserSettings() on every render cascade.
**Fix hint:** Wrap loadSettings in useCallback with [isAuthenticated, user?.id] deps.

### [CA-INF-003] Race condition in LocationProvider initialization
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/LocationContext.tsx:94-146
**Category:** context
**Description:** initPromise() is async but called directly without awaiting inside the race() competition. The race promise completes before initPromise's async work finishes.
**Impact:** Location permission status may never load; default Bangalore location always used.
**Fix hint:** Ensure initPromise returns a pending promise before entering race.

### [CA-INF-004] AsyncStorage race condition in AuthContext checkAuthStatus
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:721-755
**Category:** memory
**Description:** Background profile sync fires Promise.resolve().then() without awaiting the full result. If component unmounts during fetch, storedUser comparison (line 747) operates on stale closure data.
**Impact:** Memory leak risk; profile updates may not reflect server state on rapid navigation.
**Fix hint:** Check isCancelledRef before every await in background profile sync.

### [CA-INF-005] Missing cleanup for announce timeout in useAccessibility
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useAccessibility.ts:218-235
**Category:** hook
**Description:** The announce() callback clears announceTimeoutRef on new calls but does not handle the case where announceTimeoutRef.current is assigned inside the setTimeout but the component unmounts before the timeout fires.
**Impact:** Stale timeout reference may attempt to call unmounted component state.
**Fix hint:** Store timeoutId directly instead of relying on ref cleanup during timeout assignment.

### [CA-INF-006] Cache service initialization race on concurrent calls
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/cacheService.ts:86-123
**Category:** cache
**Description:** ensureInitialized() checks this.initialized but initializing flag is set AFTER the check. Two concurrent calls can both pass the initialized check and both run initialize().
**Impact:** Cache index loaded twice, AsyncStorage read twice, duplicate initialization overhead.
**Fix hint:** Set initializing=true before async work starts, not after.

### [CA-INF-007] saveCacheIndex not awaited in cache eviction loop
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/cacheService.ts:296-312
**Category:** cache
**Description:** The evictIfNeeded() method removes entries in a loop (line 306) but each this.remove() call triggers saveCacheIndex() without await. Concurrent removals may lose data.
**Impact:** Cache state becomes inconsistent; entries may be lost after eviction.
**Fix hint:** Batch evict operations and save index once after loop completes.

### [CA-INF-008] DecompressionError swallowing real parse failures in cache
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/cacheService.ts:185-206
**Category:** error-handling
**Description:** decompress() catches all errors and returns null (line 203), including JSON.parse() failures. Real corruption is indistinguishable from compression failures, breaking debugging.
**Impact:** Corrupted cache entries silently fail to load; no logging of parse errors.
**Fix hint:** Log parse errors separately; only suppress pako-specific failures.

### [CA-INF-009] UpdateTTL doesn't persist index immediately
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/cacheService.ts:768-782
**Category:** cache
**Description:** updateTTL() modifies the index in-memory (line 777-778) but saveCacheIndex() is commented out (line 779 should save but doesn't). TTL changes are lost on app restart.
**Impact:** Cache TTL modifications are ephemeral; restarting app reverts TTL to original value.
**Fix hint:** Uncomment or re-add saveCacheIndex() call after updateTTL.

### [CA-INF-010] Missing timeout cleanup in apiClient makeRequest catch
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/apiClient.ts:414-420
**Category:** api-client
**Description:** In catch block, clearTimeout(timeoutId) is called but timeoutId comes from outside the try block scope. If fetch throws before timeoutId is assigned, this clears undefined.
**Impact:** Timeout timer may leak if fetch throws synchronously before AbortController setup.
**Fix hint:** Ensure timeoutId is always cleared; handle null case.

### [CA-INF-011] Request registry unregister called with null after successful fetch
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/apiClient.ts:303
**Category:** memory
**Description:** The registryId is unregistered AFTER fetch resolves but if requestRegistry.register() was never called (external condition), unregister(null) is called.
**Impact:** Memory leak if requestRegistry doesn't handle null keys gracefully.
**Fix hint:** Check if registryId is non-null before calling unregister().

### [CA-INF-012] Stale closure in proactive token refresh setTimeout
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:201-221
**Category:** hook
**Description:** The setTimeout callback (line 214) references state.token directly instead of tokenRef. Even though tokenRef is kept in sync (line 192), if the effect re-runs before the timeout fires, state.token may be stale in the closure.
**Impact:** Token refresh may attempt refresh with an old token, causing unnecessary 401 failures.
**Fix hint:** Use tokenRef.current inside the setTimeout callback.

### [CA-INF-013] race condition between setHasExplicitlyLoggedOut and router redirect
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:225-274
**Category:** hook
**Description:** Navigation guard checks shouldRedirectToSignIn (line 238) and then calls AsyncStorage.getItem (line 254) which is async. User could have navigated during the await, making the redirect stale.
**Impact:** Redirect may fire after user has already progressed to OTP screen, resetting form state.
**Fix hint:** Check currentSegmentsRef before AND after AsyncStorage read; abort if stale.

### [CA-INF-014] useWallet deprecation warning fires on every render
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useWallet.ts:182-189
**Category:** hook
**Description:** The deprecation warning useEffect has an empty dependency array but calls __DEV__ guard every render. The warn should only fire once per component mount.
**Impact:** Console warnings accumulate in dev mode; performance impact from repeated re-renders.
**Fix hint:** Move __DEV__ check outside useEffect or use useRef to track if warning was shown.

### [CA-INF-015] Missing dependency in useResolvedTheme selector
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/ThemeContext.tsx:79-100
**Category:** state
**Description:** useTheme() calls useResolvedTheme() but does not memoize the returned object. Every call returns a new object reference, breaking shallow equality in child components.
**Impact:** Components using `const { colors } = useTheme()` re-render unnecessarily even if theme doesn't change.
**Fix hint:** Wrap return object in useMemo with [resolved] dependencies.

### [CA-INF-016] Uncaught error in ErrorLogger.log sentry block
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/errorHandler.ts:180-193
**Category:** error-handling
**Description:** The Sentry integration uses dynamic require() which may throw, but no outer try-catch protects the Sentry code itself (lines 185-189). If Sentry throws, the entire error log operation fails.
**Impact:** Error logging may fail in production if Sentry SDK has issues.
**Fix hint:** Wrap the Sentry block in a second try-catch.

### [CA-INF-017] analyticsService.generateSessionId uses deprecated substr()
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/analyticsService.ts:83-86
**Category:** types
**Description:** Line 85 correctly uses .substring() but comment references .substr() which is deprecated in JS spec.
**Impact:** No runtime impact but misleading comment; may confuse developers.
**Fix hint:** Update comment to reference .substring() instead.

### [CA-INF-018] analyticsService trackAddToCart calls useRegionStore outside hook
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/analyticsService.ts:132-144
**Category:** hook
**Description:** trackAddToCart() calls useRegionStore.getState().getCurrency() directly inside a method. AnalyticsService is a plain class, not a React component. Using Zustand getState() in non-hook context may miss reactivity.
**Impact:** Currency from trackAddToCart always reads stale region store value, never updates even if region changes.
**Fix hint:** Pass currency as parameter to trackAddToCart() instead of reading store.

### [CA-INF-019] CartContext calculateTotals vulnerability to negative discounts
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/CartContext.tsx:171-191
**Category:** validation
**Description:** calculateTotals() clamps final line total to 0 (line 187) but doesn't validate that item.discount is non-negative. Negative discount would inflate total. No input validation on discount field.
**Impact:** Malicious API response with negative discount inflates cart total, exposing billing logic bug.
**Fix hint:** Validate discount >= 0 before subtracting; throw or log invalid state.

### [CA-INF-020] RequestDeduplicator.cleanup doesn't clear timeout in all paths
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/requestDeduplicator.ts:244-256
**Category:** memory
**Description:** cleanup() clears timeout (line 250) but is called from multiple places. If cancel() is called before cleanup(), timeoutId is cleared twice; if cleanup() fails to clear before timeout fires, leak occurs.
**Impact:** Timeout leaks possible if request completes before cleanup or if cancel sequence is reversed.
**Fix hint:** Use a flag to mark request as cleaned; idempotent cleanup.

### [CA-INF-021] Missing abort condition in RequestDeduplicator timeout race
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/requestDeduplicator.ts:113-157
**Category:** api-client
**Description:** Promise.race() between requestPromise and timeoutPromise (line 147) means both promises continue running. If timeout wins, requestPromise still executes in background, leaking work.
**Impact:** Aborted requests still consume network bandwidth and CPU after timeout; memory leak of in-flight promise.
**Fix hint:** Abort request via controller when timeout is reached, not just cleanup map entry.

### [CA-INF-022] Stale closure in AuthContext loginWithTokens analytics call
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:601-629
**Category:** hook
**Description:** loginWithTokens() calls analytics.setUserId() inside the function (line 620) but analytics is a module import. If called from multiple contexts rapidly, setUserId might race with other auth events.
**Impact:** Analytics user ID may be set to wrong user if rapid login/logout occurs.
**Fix hint:** Ensure analytics.setUserId() is idempotent or queue user ID changes.

### [CA-INF-023] useOfflineQueue missing dependency on refreshQueue
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useOfflineQueue.ts:108-170
**Category:** hook
**Description:** useOfflineQueue() destructs refreshQueue from context but doesn't memoize return value. Callers can't use this hook in useEffect dependency arrays reliably.
**Impact:** Effects that depend on queue actions may not re-run when queue state changes.
**Fix hint:** Memoize return object with useMemo including all action/state values.

### [CA-INF-024] useAccessibility listeners can leak on platform === 'ios' branch
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/hooks/useAccessibility.ts:154-175
**Category:** hook
**Description:** reduceMotionListenerRef and reduceTransparencyListenerRef are conditionally added on iOS but cleanup tries to remove all three (line 182-191). If listeners return undefined on non-iOS, calling .remove() fails silently but structure is inconsistent.
**Impact:** Accessibility listeners may not be properly cleaned up on android; inconsistent listener state.
**Fix hint:** Check if listener exists before calling .remove() in cleanup.

### [CA-INF-025] Token refresh infinite loop if isRefreshing never clears
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:783-893
**Category:** hook
**Description:** tryRefreshToken() sets isRefreshing=true but if refreshPromise throws synchronously before finally block, isRefreshing stays true forever. Next 401 will return existing promise infinitely.
**Impact:** Token refresh failures cause permanent auth lockout.
**Fix hint:** Use try-finally to ensure isRefreshing is reset even on synchronous throws.

> **Status:** Fixed in 2026-04-15 — Verified finally block (line 877) ensures isRefreshingToken.current is reset even on synchronous throws. Added CA-INF-025 comment documenting this protection.

### [CA-INF-026] authStorage.nativeDelete doesn't handle concurrent removes
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/authStorage.ts:128-131
**Category:** memory
**Description:** nativeDelete() removes from both SecureStore and AsyncStorage sequentially. If multiple logout calls happen, second delete will error on already-deleted AsyncStorage item.
**Impact:** Logout may fail or throw if called twice rapidly.
**Fix hint:** Wrap AsyncStorage.removeItem in try-catch; ignore "not found" errors.

### [CA-INF-027] CacheService.setMany doesn't batch AsyncStorage writes
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/cacheService.ts:724-731
**Category:** cache
**Description:** setMany() loops and calls this.set() sequentially, each triggering saveCacheIndex(). Should batch all writes then save index once.
**Impact:** O(n) AsyncStorage writes for n items instead of 1; severe performance degradation for cache warming.
**Fix hint:** Collect entries, batch save to AsyncStorage, update index once.

### [CA-INF-028] Missing PII filter in logger calls
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/logger.ts (inferred from usage)
**Category:** security
**Description:** Error handler logs user objects and API responses without sanitization. Phone numbers, emails, tokens may be logged to console and Sentry.
**Impact:** PII leakage in debug logs and error tracking service.
**Fix hint:** Sanitize error details before logging; remove sensitive fields from API responses.

### [CA-INF-029] AuthContext doesn't handle network-only auth failures
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:841-876
**Category:** error-handling
**Description:** tryRefreshToken() treats network errors and token rejection identically (lines 847-855). Network failures match isInvalidToken regex. Will logout user on transient network error.
**Impact:** Temporary network issues cause unexpected logouts.
**Fix hint:** Distinguish network errors (no status) from auth errors (401/403 status).

### [CA-INF-030] Missing exhaustive dependency in useEffect chains
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:721-755
**Category:** hook
**Description:** Background profile sync uses isCancelledRef but doesn't include it in the implicit effect dependency. The effect (line 721) runs after checkAuthStatus() but isCancelledRef changes aren't tracked.
**Impact:** Cancelled sync doesn't abort; stale profile data overwrites fresh data.
**Fix hint:** Add isCancelledRef.current check inside promise chain; restructure effect.
```