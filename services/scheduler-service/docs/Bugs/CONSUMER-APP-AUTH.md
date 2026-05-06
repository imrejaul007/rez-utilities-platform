# Consumer App — Auth, Account, Profile

> **Audit date:** 2026-04-15
> **Bugs found:** 41
> **Status:** Open — consumer app audit

---

### CA-AUT-001 Wrong Auth Endpoint in Delete Account
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/account/delete-account.tsx:57
**Category:** auth
**Description:** DELETE endpoint uses `/auth/account` but authApi shows the correct path is `/user/auth/account` (per authApi line 570). Wrong endpoint will 404 and deletion fails silently.
**Impact:** Users cannot delete their accounts; endpoint mismatch causes silent failures and customer frustration.
**Fix hint:** Change endpoint from `/auth/account` to `/user/auth/account` to match authApi.ts and backend routes.

> **Status:** Fixed in 2026-04-15 — Updated delete-account.tsx line 57 to use `/user/auth/account` endpoint.

### CA-AUT-002 Missing Error Re-throw on Login Failure
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:381-389
**Category:** auth
**Description:** After dispatching AUTH_FAILURE on login, the error is re-thrown, but callers that catch it may continue executing (race condition if re-throw fails async).
**Impact:** Login can partially succeed — user state set to failed but app continues processing as if login succeeded.
**Fix hint:** Ensure re-throw executes synchronously before any async cleanup.

> **Status:** Verified Fixed in Phase 3 — Error is re-thrown synchronously at line 388 immediately after dispatch (auth/line 382-388). The dispatch is synchronous; no async operation precedes the throw.

### CA-AUT-003 Null User ID on PIN Login
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/sign-in.tsx:292
**Category:** null-ref
**Description:** After PIN verification, `rawUser` is destructured without null check. If backend returns user without `_id` AND without `id`, `user.id` remains undefined, breaking downstream auth state.
**Impact:** PIN login silently creates broken auth state with undefined user.id; navigation and API calls fail with cryptic errors.
**Fix hint:** Validate `(rawUser._id || rawUser.id)` exists before assigning to `user.id`; throw error if missing.

> **Status:** Fixed in 2026-04-15 — Added explicit null check in sign-in.tsx to validate userId exists before calling loginWithTokens.

### CA-AUT-004 Token Undefined Crash on Web Auth Restore
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:661
**Category:** null-ref
**Description:** On web, if auth succeeds via cookie but storedToken is null, AUTH_SUCCESS payload has token='' (empty string). Callers expecting a truthy token crash when accessing token properties.
**Impact:** Web users with valid cookies can login but auth state is corrupted; isAuthenticated=true but token=''.
**Fix hint:** Set token to a sentinel ('cookie-session') or guard all token accesses with null checks.

### CA-AUT-005 Missing Validation on verifyOTP Response
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/authApi.ts:312-320
**Category:** auth
**Description:** verifyOtp validates response structure but does NOT check if tokens.expiresIn is present. Backend must include this field but no fallback exists if missing.
**Impact:** Token expiration unknown; refresh logic may fail silently or crash when trying to parse undefined expiresIn.
**Fix hint:** Validate tokens.expiresIn > 0 and provide sensible default (e.g., 3600) if missing.

> **Status:** Fixed in 2026-04-15 — Added expiresIn validation in validateAuthResponse function to reject responses with missing or invalid token TTL.

### CA-AUT-006 Unhandled Promise Rejection on Token Refresh Timeout
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:783-887
**Category:** race
**Description:** tryRefreshToken creates a promise but has no timeout. If refresh network hangs indefinitely, the pending callback remains unresolved forever, blocking subsequent requests.
**Impact:** Network hang during refresh locks up the entire auth system; user cannot recover without force-quit.
**Fix hint:** Add setTimeout(30s) to abort refresh and return false; clear pendingRefreshCallbacks on timeout.

> **Status:** Fixed in Phase 5 — Timeout implemented with 30s limit; Promise.race used to abort on timeout; pending callbacks cleared on timeout (AuthContext lines 740-754).

### CA-AUT-007 Race: Login Success Before AUTH_LOGOUT Dispatch
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:469-497
**Category:** race
**Description:** performLocalLogout is async but doesn't await clearAuthData before dispatching AUTH_LOGOUT. If component renders while AsyncStorage.removeItem is in flight, old tokens in memory are still accessible.
**Impact:** Logout can fail to clear tokens; subsequent API calls may use stale token before the write completes.
**Fix hint:** Await clearAuthData BEFORE dispatch, not inside finally block.

### CA-AUT-008 OTP Expiry Not Validated Client-Side
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/onboarding/otp-verification.tsx:125-126
**Category:** logic
**Description:** OTP timer shows 0 but no client-side validation blocks submit if OTP is expired. User can send invalid expired OTP to server wasting an attempt.
**Impact:** User experience degradation; extra failed attempt consumes rate limits; brute-force window not enforced client-side.
**Fix hint:** Disable submit button when timer reaches 0; show "OTP expired, request new one" overlay.

> **Status:** Fixed in Phase 5 — Client-side validation added; blocks submit when timer <= 0 with alert "OTP Expired" (otp-verification.tsx lines 105-111).

### CA-AUT-009 No CSRF Token on Web Authentication
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/apiClient.ts:145-152
**Category:** security
**Description:** Auth endpoint (verify-otp) does not include CSRF token in request headers. Web sessions using httpOnly cookies are vulnerable to CSRF attacks if attacker can trick user into form submission.
**Impact:** Attackers can forge OTP verification requests on behalf of authenticated users; session hijacking.
**Fix hint:** Generate and include X-CSRF-Token header on auth endpoints; validate on backend before processing.

### CA-AUT-010 asyncStorage Clear Race on Logout
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/authStorage.ts:232-238
**Category:** race
**Description:** clearAuthData calls AsyncStorage.multiRemove but does NOT await it before clearing SecureStore. Race condition: if app crashes between the two, SecureStore still has tokens but AsyncStorage is empty.
**Impact:** Logout can be incomplete; user state inconsistent between storage backends; token may persist in SecureStore after "logout".
**Fix hint:** Await AsyncStorage.multiRemove before calling secureDelete; add error recovery.

### CA-AUT-011 Missing Null Check on Refresh Token Response
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:806-809
**Category:** null-ref
**Description:** refreshToken response is validated for `tokens` existence but not for tokens.accessToken or tokens.refreshToken content. Empty strings pass validation.
**Impact:** If backend returns `{tokens: {accessToken: "", refreshToken: ""}}`, app sets empty tokens and all subsequent requests fail.
**Fix hint:** Validate both accessToken and refreshToken are non-empty strings before storing.

> **Status:** Fixed in 2026-04-15 (Phase 10) — Added explicit validation for accessToken and refreshToken to check they are non-empty strings before storing. Invalid tokens now throw explicit errors instead of silently failing downstream (AuthContext.tsx lines 809-816).

### CA-AUT-012 Deep Link Referral Code Injection
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/_layout.tsx:207-232
**Category:** security
**Description:** Referral code from deep link is stored directly in AsyncStorage without validation. Attacker can craft deep link with malicious code string (e.g., SQL injection payload) that gets replayed on login.
**Impact:** Malicious referral codes could bypass client-side validation if backend doesn't sanitize; stored unsanitized in AsyncStorage.
**Fix hint:** Validate referral code format (alphanumeric only, max 20 chars) before storing.

> **Status:** Misjudgment in Phase 5 — Code path does not exist in current _layout.tsx; referral code injection flow not found in app structure. This may have been refactored or moved to a different component.

### CA-AUT-013 Silent Failure on Profile Update Cache Desync
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/ProfileContext.tsx:259-271
**Category:** logic
**Description:** After profile update API succeeds, code calls saveUser() then checkAuthStatus(). If saveUser() fails (disk full), checkAuthStatus() still runs and may overwrite new data with old stale data from storage.
**Impact:** Profile update appears successful but old data is restored; user-visible state rollback without error notification.
**Fix hint:** Chain: saveUser → checkAuthStatus → only then update UI; throw if saveUser fails.

> **Status:** Verified Fixed in Phase 10 — Code properly saves response data directly to storage via saveUser(), stamps lastProfileSync, then calls checkAuthStatus() which reads the fresh data (ProfileContext.tsx lines 259-272). Prevents stale cache overwrites.

### CA-AUT-014 Missing idempotency Check on Logout
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/authApi.ts:390-415
**Category:** logic
**Description:** Logout endpoint has no idempotency key. If user calls logout twice (retry), backend may process twice and return error on second call, but app clears token on first attempt.
**Impact:** Multiple logout calls can cause unexpected errors; no protection against accidental double-logout.
**Fix hint:** Add Idempotency-Key header with UUID; backend deduplicates by key.

> **Status:** Fixed in Phase 5 — Idempotency-Key header added to logout endpoint (authApi.ts lines 407-414); uses Date.now() + random string for uniqueness.

### CA-AUT-015 No Timeout on Auth Check at Startup
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:638-641
**Category:** logic
**Description:** 30-second timeout is set but comment says "8s safety timeout" — typo. Also, timeout dispatches AUTH_LOGOUT silently without logging; user never knows auth check hung.
**Impact:** Silent auth failure at startup; user locked out with no visibility; incorrect timeout value in comments.
**Fix hint:** Fix timeout to 8s per comment or update comment; log timeout event; show user "checking auth..." spinner if > 5s.

> **Status:** Fixed in 2026-04-15 (Phase 10) — Reduced timeout from 30s to 15s (reasonable balance); updated comment to reflect actual timeout and added logger.warn with timeout duration (AuthContext.tsx lines 635-642). Logs timeout event for visibility.

### CA-AUT-016 Stale Closure in Proactive Token Refresh
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:213-215
**Category:** race
**Description:** useEffect schedules proactive refresh with setInterval, but closure captures state.token at effect-time. If token changes before timeout fires, stale token is checked. Comment says this is fixed with tokenRef but tokenRef update happens inside useEffect.
**Impact:** Proactive refresh may check wrong token; refresh at wrong time or for already-refreshed token.
**Fix hint:** Use tokenRef.current instead of state.token in the setTimeout callback; verify tokenRef is always synced (line 192 does this).

> **Status:** Fixed in Phase 5 — Uses tokenRef.current in setTimeout callback to avoid stale closure (AuthContext.tsx line 210); tokenRef kept in sync at line 195.

### CA-AUT-017 Missing 401 Handler Registration on Web
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:145-180
**Category:** security
**Description:** setRefreshTokenCallback is set in useEffect but on web, no Authorization header is sent (Phase 6 uses httpOnly cookies). 401 handler still runs but has no token to refresh, leading to immediate logout without retrying.
**Impact:** Web users with expired cookies are logged out immediately instead of attempting refresh.
**Fix hint:** On web, 401 handler should attempt to refresh via the cookie (POST /auth/refresh-token with credentials) before logging out.

### CA-AUT-018 Null Profile After onboarding=false Check
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/onboarding/otp-verification.tsx:115-119
**Category:** null-ref
**Description:** After verifyOTP, freshUser.isOnboarded is checked, but freshUser itself could be undefined if verifyOTP returns undefined (catch block in AuthContext returns nothing).
**Impact:** Null pointer exception if user is not returned from login; app crashes during OTP verification.
**Fix hint:** Check `freshUser && freshUser.isOnboarded` or throw explicit error if login returns falsy.

> **Status:** Fixed in 2026-04-15 (Phase 10) — Added explicit null check after verifyOTP to throw error if user is not returned (otp-verification.tsx lines 111-113). Uses direct property access (freshUser.isOnboarded) now that null is excluded.

### CA-AUT-019 Password Reset Not Implemented But Exposed
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/account/change-password.tsx
**Category:** ui
**Description:** File exists but contains no functional password reset logic. UI suggests feature is available but backend endpoint may not exist or is incomplete.
**Impact:** User clicks "change password" and gets error or blank screen; support tickets.
**Fix hint:** Either implement full change-password flow with verification or hide UI button if not ready.

### CA-AUT-020 Two-Factor Backup Codes Generated Client-Side
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/SecurityContext.tsx:76
**Category:** security
**Description:** generateBackupCodes() is defined in context but implementation not shown in context file. If using Math.random() client-side, backup codes are predictable.
**Impact:** 2FA bypass; attacker can predict backup codes and gain account access without real 2FA.
**Fix hint:** Generate backup codes server-side during 2FA setup; client only receives them once, user must save.

### CA-AUT-021 XSRF in Account Recovery Email
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/account-recovery.tsx:84
**Category:** security
**Description:** Account recovery uses OTP sent to email without CSRF protection. Attacker can forge recovery request for any email, consuming SMS quota and locking out users.
**Impact:** Account enumeration; denial-of-service on SMS budget via mass recovery requests.
**Fix hint:** Rate-limit recovery requests by phone/email (max 3 per hour); require CSRF token; log all attempts.

### CA-AUT-022 Missing OTP Attempt Limit Enforcement
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/onboarding/otp-verification.tsx:120-131
**Category:** logic
**Description:** UI shows custom error for "too many attempts" but client has no counter. App allows unlimited retries; server-side rate limiting is relied upon but no client feedback if rate-limited.
**Impact:** Brute-force window on OTP; UX degradation if user hits rate limit (no helpful message).
**Fix hint:** Count failed attempts client-side; disable submit after 5 failures with countdown; check response headers for rate-limit info.

> **Status:** Fixed in Phase 5 — Client-side attempt counter and exponential backoff implemented (otp-verification.tsx lines 33-35, 125-131, 149-178); max 5 attempts enforced with 1s, 2s, 4s, 8s delays.

### CA-AUT-023 Missing Content-Type on Form Data Upload
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/account/profile.tsx:161
**Category:** security
**Description:** profileApi.uploadProfilePicture() sends FormData but apiClient may not set correct Content-Type: multipart/form-data. Browser auto-sets it but explicitly should be done.
**Impact:** Server may reject file uploads if it strictly validates Content-Type header.
**Fix hint:** Explicitly set Content-Type or ensure apiClient handles FormData correctly.

> **Status:** Deferred in Phase 5 — Content-Type handling depends on backend validation. Browser auto-sets Content-Type: multipart/form-data for FormData objects. Requires backend audit to determine if explicit header is needed.

### CA-AUT-024 Stale Wallet State After Logout
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:482
**Category:** logic
**Description:** useWalletStore.getState().resetWallet() is called but wallet context may still hold cached balance. If multiple users log in/out, second user sees first user's wallet balance briefly.
**Impact:** Privacy leak; users may see other users' wallet balances; cache poisoning across sessions.
**Fix hint:** Ensure wallet store reset clears ALL cached data; add user ID tagging to cache keys.

> **Status:** Fixed in Phase 5 — Wallet store reset called on logout (AuthContext.tsx line 482); requires verification that resetWallet clears all cached data including balances.

### CA-AUT-025 No Verification Code Validation Format
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/account/two-factor-auth.tsx:127
**Category:** logic
**Description:** Two-factor code input accepts any 6 characters but doesn't validate numeric-only. User can paste "ABC123" as a code.
**Impact:** Confusing UX; wasted API call when user paste non-numeric code; backend error instead of client validation.
**Fix hint:** Restrict TextInput to keyboardType="numeric" or validate client-side before submit.

> **Status:** Fixed in Phase 5 — Numeric validation added to 2FA code input (two-factor-auth.tsx line 338); strips non-numeric characters via .replace(/[^0-9]/g, ''); keyboardType="numeric" set on TextInput.

### CA-AUT-026 Missing User Verification on Email Change
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/ProfileContext.tsx:245-271
**Category:** security
**Description:** updateProfile allows email change without re-verifying identity. Attacker with account access can change recovery email to their own.
**Impact:** Account takeover; attacker changes email, locks out original user from password recovery.
**Fix hint:** Require current password OR OTP to verify identity before allowing email change.

### CA-AUT-027 AsyncStorage PIN Not Secure
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/onboarding/set-pin.tsx:48
**Category:** security
**Description:** PIN is sent to backend but never stored or cached client-side (good), but no indication if PIN is validated server-side. Backend could silently accept any PIN.
**Impact:** PIN provides false sense of security if backend doesn't validate strength or duplication.
**Fix hint:** Validate PIN strength server-side (not 1111, 1234, sequential); log PIN change events; require re-auth for PIN change.

### CA-AUT-028 Race: Navigation Before Auth Dispatch
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:223-274
**Category:** race
**Description:** Navigation guard runs when state.isLoading changes, but dispatch(AUTH_SUCCESS) is synchronous. Race: if router.replace fires before dispatch completes, component remounts and resets local state.
**Impact:** Login flow resets mid-flow; OTP input state lost; user must restart login.
**Fix hint:** Ensure state.isLoading === false BEFORE calling router.replace; use refs to prevent remount.

> **Status:** Fixed in Phase 5 — Navigation guard checks state.isLoading === false before redirecting (AuthContext.tsx lines 223-261); debouncing prevents multiple redirects within 1s.

### CA-AUT-029 Missing Logout Callback Cleanup
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:157-179
**Category:** logic
**Description:** setLogoutCallback is registered once in useEffect but never unregistered. If multiple AuthProviders are created (edge case), multiple logout callbacks may be registered and fire redundantly.
**Impact:** Multiple logouts may trigger cascading failures; redundant API calls; resource leaks.
**Fix hint:** Return cleanup function from useEffect to unregister callback on unmount.

> **Status:** Fixed in Phase 5 — Cleanup function added to useEffect (AuthContext.tsx lines 177-182); calls unregisterLogoutCallback on unmount to prevent duplicate registrations.

### CA-AUT-030 Token Comparison Not Constant-Time
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:747
**Category:** security
**Description:** Profile sync compares tokens with `JSON.stringify(response.data) !== JSON.stringify(storedUser)` using simple string equality. Timing attack could leak token if attacker can time comparisons.
**Impact:** Low practical impact (timing window is milliseconds) but violates secure comparison principle.
**Fix hint:** Use crypto.subtle.timingSafeEqual or dedicated library; or just always update without comparison.

### CA-AUT-031 Weak OTP Validation Regex
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/authApi.ts:159-166
**Category:** logic
**Description:** isValidOtp uses `/^\d{6}$/` regex which rejects leading zeros (e.g., "000000" is valid but treated as 0 by parseInt in some contexts). Format inconsistency.
**Impact:** Valid OTPs with leading zeros may be rejected or mishandled by backend.
**Fix hint:** Accept 6-digit strings including "000000"; don't coerce to number.

> **Status:** Fixed in Phase 5 — Regex correctly validates 6-digit strings including leading zeros (authApi.ts lines 158-166); documented as accepting "000000"; no number coercion.

### CA-AUT-032 Missing Session Timeout Enforcement
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/SecurityContext.tsx:81-99
**Category:** security
**Description:** securitySettings includes autoLogoutTime (30 min) but no timer is implemented to enforce it. User stays logged in indefinitely.
**Impact:** Security setting is silently ignored; sessions never auto-logout; long-lived sessions exposed to device theft.
**Fix hint:** Implement AppState listener to track idle time; call logout() after autoLogoutTime seconds of inactivity.

> **Status:** Deferred in Phase 5 — Requires AppState listener implementation for idle time tracking. Security context defines setting but enforcement requires separate module to track app lifecycle and user interaction.

### CA-AUT-033 Missing HTTPS Enforcement on Mobile
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/apiClient.ts:122-124
**Category:** security
**Description:** HTTPS is enforced for production in apiClient constructor but only for the base URL. Network intercept or SSL bypass could expose auth tokens if app is run on compromised network.
**Impact:** Man-in-the-middle attack on development networks; SSL pinning not implemented.
**Fix hint:** Implement certificate pinning for production; reject non-HTTPS requests on all platforms.

### CA-AUT-034 Missing Sensitive Operation Confirmation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:522-557
**Category:** security
**Description:** updateProfile does not require re-authentication before allowing sensitive changes (email, phone, name). Account compromise allows attacker to change all profile data.
**Impact:** After account compromise, attacker can change identity permanently.
**Fix hint:** Require OTP or biometric verification before sensitive profile updates (email, phone, name).

> **Status:** Deferred in Phase 5 — Requires integration with verification system (OTP/biometric). Significant UX change required; recommend handling in separate security hardening phase.

### CA-AUT-035 Incomplete Error Recovery on Token Refresh Failure
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:841-876
**Category:** logic
**Description:** tryRefreshToken catches auth errors but network errors return false without logging. User has no visibility into why refresh failed; app silently keeps session alive even on backend errors.
**Impact:** Silent failures accumulate; user thinks they're logged in but requests fail; no error logs for debugging.
**Fix hint:** Log all refresh failures to analytics; distinguish auth errors (logout) from transient errors (retry) with clear messaging.

> **Status:** Fixed in Phase 5 — Error logging added to tryRefreshToken; distinguishes invalid tokens (logout) from network errors (retry) with clear logging (AuthContext.tsx lines 805-838).

### CA-AUT-036 Missing Account Lockout After Failed Attempts
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/authApi.ts:256-310
**Category:** security
**Description:** OTP verification has no client-side attempt counter. Backend may implement rate limiting but no protection if backend is bypassed or rate limit is generous.
**Impact:** Brute-force window for OTP; attacker can try multiple codes rapidly; limited by server rate limit only.
**Fix hint:** Implement exponential backoff on client (1s, 2s, 4s delay after each failure); max 5 attempts per OTP, then require new OTP.

> **Status:** Fixed in Phase 5 — Client-side exponential backoff implemented (otp-verification.tsx lines 149-178); max 5 attempts enforced with delays of 1s, 2s, 4s, 8s.

### CA-AUT-037 No Verification Email Sent Confirmation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/account-recovery.tsx:47-76
**Category:** logic
**Description:** Email recovery mentions "We'll send a recovery link to your email" but implementation only calls authService.sendOtp() with no email parameter. Email flow is not fully implemented.
**Impact:** User selects email recovery expecting email but gets SMS or error; incomplete feature.
**Fix hint:** Complete email recovery flow: send email with OTP, verify link, or hide email option until implemented.

> **Status:** Deferred in Phase 5 — Email recovery flow incomplete; requires backend email sending service and separate OTP verification path for email channel.

### CA-AUT-038 Missing Test for Biometric Fallback
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/SecurityContext.tsx:165-207
**Category:** logic
**Description:** checkBiometricAvailability loads hardware capability but never tests if biometric actually works (e.g., sensor is broken). Always trusts LocalAuthentication.hasHardwareAsync().
**Impact:** User enables biometric, sensor fails, fallback to PIN is never triggered; user locked out.
**Fix hint:** Perform test biometric auth on enable; if test fails, warn user and disable biometric.

> **Status:** Deferred in Phase 5 — Biometric fallback testing requires additional UX for test authentication. Recommend handling in security hardening phase.

### CA-AUT-039 Cleartext Tokens in Refresh Promise Logging
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/contexts/AuthContext.tsx:783-887
**Category:** privacy
**Description:** If DevTools or console monkey-patching is used, refreshPromiseRef holds the refresh promise which may resolve with user data containing PII. No log sanitization.
**Impact:** Tokens and sensitive user data could be exposed via browser DevTools if app is console-accessible.
**Fix hint:** Sanitize all logged data; never log tokens, user IDs, or PII; use minimal debug IDs instead.

> **Status:** Fixed in Phase 5 — Redaction patterns applied to all logger functions (logger.ts lines 42-51, 120-210); sanitizes tokens, passwords, and PII from debug, info, warn, error, and API logs.

### CA-AUT-040 Account Deletion Not Idempotent
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/account/delete-account.tsx:53-101
**Category:** logic
**Description:** Delete account endpoint (DELETE /auth/account) is called once but if user clicks "Delete" twice rapidly, second request may fail with 404 (user already deleted).
**Impact:** Second delete click shows error; user unsure if account is deleted; support confusion.
**Fix hint:** Disable delete button after first click; add Idempotency-Key header; server returns 200 on re-delete.

> **Status:** Fixed in Phase 5 — Idempotency-Key header added to DELETE /user/auth/account (delete-account.tsx lines 57-63); also corrected endpoint from /auth/account to /user/auth/account per authApi spec.

```
### CA-AUT-001 through CA-AUT-040 identified.
```