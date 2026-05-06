# Merchant App — System (admin, settings, profile, menu, notifications, help, support, legal, config)

> **Audit date:** 2026-04-15
> **Bugs found:** 18
> **Status:** Open — merchant app system audit

---

### MA-SYS-001 App layout startup checks use module-level guards with no reset
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/_layout.tsx:81-105
**Category:** startup
**Description:** _startupChecksRun and _fontTimedOut are module-level booleans (lines 84-85) that prevent startup checks from running more than once per app session. On web with router.replace(), the layout remounts but checks are skipped because the guard remains true.
**Impact:** Startup checks skipped on navigation that triggers layout remount (web navigation, state resets); config validation doesn't re-run.
**Fix hint:** Use localStorage or state to track startup completion per navigation stack, not globally.

---

### MA-SYS-002 Settings page doesn't validate biometric support before saving
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/settings.tsx:92-136
**Category:** settings
**Description:** handleBiometricsToggle (line 92) authenticates before enabling biometrics (line 123) but the success check (line 128) doesn't validate that the saved setting actually matches the device capability. A device that revokes biometric access after auth is saved won't be detected.
**Impact:** Users enable biometric login on a device, then disable biometrics in OS settings; app still thinks it's enabled.
**Fix hint:** Verify biometric status on app startup; disable setting if hardware/enrollment changes.

---

### MA-SYS-003 Settings AsyncStorage persistence not wrapped in error boundary
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/settings.tsx:75-78
**Category:** error-handling
**Description:** The useEffect (line 75) that persists settings to AsyncStorage (line 77) catches all errors silently (line 77 .catch(() => {})). If AsyncStorage quota is exceeded, the setting is lost without user notification.
**Impact:** Settings silently fail to persist; user loses preferences on app restart if quota exceeded.
**Fix hint:** Log persistence errors; show toast if save fails; implement quota management strategy.

---

### MA-SYS-004 Settings biometrics toggle doesn't check isMounted before setSettings
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/settings.tsx:129-131
**Category:** hook
**Description:** handleBiometricsToggle (line 92) calls setSettings (line 130) after async LocalAuthentication.authenticateAsync() (line 123) without checking if component is mounted. If user navigates away during biometric prompt, setState fires on unmounted component.
**Impact:** Memory leak warning in dev mode; stale state updates.
**Fix hint:** Check isMounted() before setState; use useCallback with cleanup.

---

### MA-SYS-005 Profile page fetchLiveProfile callback not properly memoized
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/profile/index.tsx:78-99
**Category:** hook
**Description:** fetchLiveProfile (line 78) is defined inline and used in both useEffect (line 103) and useFocusEffect (line 108). The dependency array in useFocusEffect (line 109) includes [fetchLiveProfile] which causes re-registration on every render.
**Impact:** useFocusEffect registers and unregisters callback multiple times per navigation; unnecessary API calls.
**Fix hint:** Wrap fetchLiveProfile in useCallback with stable dependencies []; move API logic inside useCallback.

---

### MA-SYS-006 Profile page doesn't check isMounted before setState in fetchLiveProfile
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/profile/index.tsx:78-99
**Category:** hook
**Description:** The cancellation check (line 83) happens before authService.getProfile() but the response (line 82-94) doesn't check if component is still mounted when calling setLiveUserData (line 88). Navigation away during API call will update unmounted component.
**Impact:** Memory leak; stale state updates after profile page unmounts.
**Fix hint:** Add isMounted check before setLiveUserData; use AbortController for fetch.

---

### MA-SYS-007 Profile page REZ tier logic doesn't validate rezScoreData existence
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/profile/index.tsx:136-150
**Category:** null-safety
**Description:** The useQuery for rezScoreData (line 136) is enabled when isAuthenticated && !authLoading but REZ_TIER_THRESHOLDS (line 144) is computed even if rezScoreData is null or undefined. Rendering code may access rezScoreData.score without null check.
**Impact:** Undefined reference if query hasn't loaded; potential runtime error.
**Fix hint:** Validate rezScoreData before rendering tier information; show skeleton/placeholder while loading.

---

### MA-SYS-008 Profile page user data merge doesn't handle null avatar properly
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/profile/index.tsx:114-122
**Category:** null-safety
**Description:** The user merge (line 114-122) uses `liveUserData?.avatar !== undefined ? ... : contextUser.avatar`. If liveUserData.avatar is null (from API response), the ternary chooses null over contextUser.avatar, losing the fallback.
**Impact:** Avatar can switch from valid image to null if API explicitly returns null instead of omitting field.
**Fix hint:** Use `liveUserData?.avatar ?? contextUser.avatar` to treat null and undefined same.

---

### MA-SYS-009 Admin campaigns page doesn't have error boundary
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/admin/campaigns.tsx
**Category:** error-handling
**Description:** Admin pages (campaigns.tsx, faqs.tsx, social-media-posts.tsx) don't appear to wrap their content in withErrorBoundary() like profile page does (see profile/index.tsx line 1).
**Impact:** Admin page crashes are unhandled; user gets white screen instead of fallback UI.
**Fix hint:** Wrap export with withErrorBoundary(); ensure all admin pages have error boundaries.

---

### MA-SYS-010 Profile page useUserStatistics result not guarded before use
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/profile/index.tsx:126
**Category:** null-safety
**Description:** The useUserStatistics hook result (line 126) is used without null check. If isLoading=false but statistics=null (due to error), rendering code that accesses statistics.* will crash.
**Impact:** If useUserStatistics hook errors, profile page crashes instead of showing error state.
**Fix hint:** Check `if (statsError) { return <ErrorView /> }` before rendering statistics.

---

### MA-SYS-011 Settings don't persist across app terminate on iOS
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/settings.tsx:75-78
**Category:** persistence
**Description:** Settings are persisted to AsyncStorage synchronously in useEffect (line 77) but on iOS, if the app is terminated during write, AsyncStorage may not flush to disk. The next launch will load stale settings.
**Impact:** Settings changes can be lost on app termination; unreliable persistence.
**Fix hint:** Persist on app pause; use AsyncStorage.multiSet() to batch writes; implement backup save.

---

### MA-SYS-012 Profile edit flow doesn't invalidate cache on save
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/profile/index.tsx:70-111
**Category:** cache
**Description:** The fetchLiveProfile callback (line 78) manually fetches fresh user data, but doesn't call useQuery invalidateQueries(). Other components using useQuery for user data won't know the profile was edited unless they're on the profile screen.
**Impact:** Stale user data in other screens after profile edit; cached queries not invalidated.
**Fix hint:** Export queryClient from a context; call queryClient.invalidateQueries(['user-profile']) on navigation back.

---

### MA-SYS-013 Admin FAQs doesn't validate API response structure
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/admin/faqs.tsx
**Category:** validation
**Description:** Without seeing the full file, admin pages likely don't validate API responses before rendering. If API returns unexpected structure, render will crash or display corrupted data.
**Impact:** Invalid API response crashes admin pages; no graceful error handling.
**Fix hint:** Validate API responses with zod or similar; show error state if validation fails.

---

### MA-SYS-014 Layout environment variable validation doesn't fail loudly
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/_layout.tsx:32-42
**Category:** config
**Description:** Missing required env vars are logged as console.error (line 35) but the app continues to run. If EXPO_PUBLIC_API_BASE_URL is missing, the app starts but all API calls fail.
**Impact:** Hard-to-debug failures; app appears to work but doesn't; missing config not detected until API calls.
**Fix hint:** Throw error in dev/staging if required vars missing; show red screen instead of silently failing.

---

### MA-SYS-015 Settings switch toggle doesn't optimistically update UI
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/settings.tsx:84-89
**Category:** ux
**Description:** handleToggleSetting (line 84) updates state immediately (line 85) but AsyncStorage save is async and uncaught errors are silently ignored (line 77). If save fails, UI shows enabled but server thinks disabled.
**Impact:** Settings UI/server mismatch; user confusion when setting appears saved but isn't.
**Fix hint:** Only update state after AsyncStorage.setItem() succeeds; revert on failure; show error toast.

---

### MA-SYS-016 Profile QR code page doesn't handle missing store data
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/profile/qr-code.tsx
**Category:** null-safety
**Description:** Without seeing full file, the QR code page likely displays store QR code data without validating that store data exists. If store API fails, rendering code crashes.
**Impact:** QR code page crashes if store data missing; no fallback UI.
**Fix hint:** Guard store data with null checks; show placeholder QR if data unavailable.

---

### MA-SYS-017 Profile partner page doesn't validate partner data structure
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/profile/partner.tsx
**Category:** validation
**Description:** Partner page likely receives partner data from context or API without validation. Unexpected schema causes rendering crashes.
**Impact:** Invalid partner data crashes page; no graceful error handling.
**Fix hint:** Validate partner data with zod; show error state if structure invalid.

---

### MA-SYS-018 Settings doesn't persist theme preference to server
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/settings.tsx:75-78
**Category:** persistence
**Description:** Settings are persisted to AsyncStorage (line 77) but not synced to backend. If user logs in from another device, theme preference is lost; settings are device-local.
**Impact:** Settings don't sync across devices; lost on device change.
**Fix hint:** Call settings API to persist; sync on logout; load user settings on login.

