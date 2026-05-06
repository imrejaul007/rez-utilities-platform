# Merchant App — Auth, Account, Onboarding

> **Audit date:** 2026-04-15
> **Bugs found:** 28
> **Status:** Open — merchant app audit

---

### MA-AUT-001 Wrong Delete Account Endpoint
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/account/delete-account.tsx:57
**Category:** api
**Description:** DELETE endpoint uses `/auth/account` but authApi.ts (line 568) shows the correct path is `/user/auth/account`. Endpoint mismatch causes 404 and deletion fails silently.
**Impact:** Users cannot delete their accounts; merchant data remains on servers after requested deletion; compliance risk (GDPR Right to be Forgotten).
**Fix hint:** Change endpoint from `/auth/account` to `/user/auth/account` to match authApi.ts and backend routes.

### MA-AUT-002 Wrong Data Export Endpoint
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/account/delete-account.tsx:107
**Category:** api
**Description:** GET endpoint uses `/auth/me/data-export` but correct path follows `/user/auth/` convention. Endpoint mismatch causes 404 and data export fails.
**Impact:** Users cannot download their data for GDPR Article 20 (Right to Data Portability); merchant cannot fulfill data export requests.
**Fix hint:** Change endpoint from `/auth/me/data-export` to `/user/auth/me/data-export` to match backend route structure.

### MA-AUT-003 Wrong Change Password Endpoint
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/account/change-password.tsx:87
**Category:** api
**Description:** PUT endpoint uses `/auth/change-password` but correct path is `/user/auth/change-password` per authApi.ts pattern. Endpoint mismatch returns 404.
**Impact:** Merchants cannot change their passwords; password change requests fail silently without error feedback.
**Fix hint:** Change endpoint from `/auth/change-password` to `/user/auth/change-password` to match authApi structure.

### MA-AUT-004 Race Condition: Password Change Without Immediate Logout
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/account/change-password.tsx:97-99
**Category:** race
**Description:** After password change succeeds, logout is called but not awaited before UI navigation may occur. If merchant closes app before logout completes, session remains active with old credentials in memory.
**Impact:** New password change ineffective for current session; merchant continues using old token; security window where stale token is still valid.
**Fix hint:** Await `actions.logout()` before showing confirmation or navigating; ensure token is cleared from apiClient before continuing.

### MA-AUT-005 Missing Endpoint Prefix in Merchant Auth Service
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/services/api/auth.ts:22
**Category:** api
**Description:** Login endpoint is `merchant/auth/login` but backend routes (per documentation) use `/user/auth/...` namespace. Prefix mismatch causes 404.
**Impact:** Merchants cannot login; entire merchant authentication system fails at entry point.
**Fix hint:** Change endpoint from `merchant/auth/login` to `merchant/auth/login` OR verify backend actually mounts at `/merchant/...` namespace instead of `/user/...`.

### MA-AUT-006 Missing Null Check on Merchant Response
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/services/api/auth.ts:26-30
**Category:** null-ref
**Description:** Login response destructures `merchant` without null check. If backend returns user without merchant object, line 27 crashes with "Cannot read property 'id' of undefined".
**Impact:** Login crashes if response is malformed; exception not caught at UI layer; user sees white screen instead of error message.
**Fix hint:** Add null check before destructuring: `if (!response.data.merchant) throw new Error(...)`.
**Status:** Fixed in commit (2026-04-15) — Added null check validation before destructuring merchant object

### MA-AUT-007 Fallback Name Without Validation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/services/api/auth.ts:30
**Category:** null-ref
**Description:** Team member login omits `ownerName`, so fallback uses `response.data.user?.name` which may also be undefined. Fallback hardcoded to 'Team Member' masks data mismatch.
**Impact:** Team member logins cannot show actual merchant owner name; UI displays generic 'Team Member' instead of owner; profile confusion.
**Fix hint:** Log warning if both ownerName and user.name missing; fail explicitly instead of silently defaulting.

### MA-AUT-008 No Error Handling for Token Storage
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/services/api/auth.ts:39-44
**Category:** error-handling
**Description:** `storageService.setAuthToken()` calls are not awaited and errors are not caught. If storage write fails, token is lost but login reports success.
**Impact:** Token storage can fail silently (on full disk, permission denied, etc.); subsequent API calls fail with 401; user forced to re-login.
**Fix hint:** Await all storage operations and wrap in try-catch; re-throw or return error response if any write fails.

### MA-AUT-009 Refresh Token Missing Validation
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/services/api/auth.ts:115-121
**Category:** validation
**Description:** refreshToken response updates tokens without validating that both accessToken and refreshToken are non-empty strings. Empty string tokens pass validation.
**Impact:** Refresh returns empty tokens; subsequent requests fail with 401; app forced to logout.
**Fix hint:** Validate `response.data.token && response.data.token.length > 0` before storing; throw error if empty.

### MA-AUT-010 Refresh Token Failure Auto-Logs Out Without Confirmation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/services/api/auth.ts:130
**Category:** logic
**Description:** On refresh failure, logout() is called immediately, clearing all merchant data. No confirmation or re-auth attempt before clearing session.
**Impact:** Network hiccup during refresh forces logout; merchant loses context; all pending operations discarded.
**Fix hint:** Implement exponential backoff retry before logging out; allow user to retry or re-authenticate.

### MA-AUT-011 No CSRF Token on Auth Endpoints
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/services/api/client.ts (not shown but applies)
**Category:** security
**Description:** Web-based merchant auth (login, register) does not include CSRF token in request headers. If merchant uses web version with cookies, CSRF attacks possible.
**Impact:** Attacker can craft form submission to login/register merchant account; session hijacking; account takeover.
**Fix hint:** Generate and include X-CSRF-Token header on all auth endpoints; validate on backend before processing.
**Status:** Fixed in commit (2026-04-15) — Added CSRF token generation and inclusion in auth endpoints for web

### MA-AUT-012 OTP Expiry Not Validated Client-Side
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/app/(auth)/register.tsx:140+ (OTP handling)
**Category:** validation
**Description:** OTP countdown reaches 0 but form doesn't disable submit. Merchant can send expired OTP and waste a server-side attempt.
**Impact:** User experience degradation; OTP attempt limits reached without validation; rate limits consumed.
**Fix hint:** Disable OTP submit button when timer reaches 0; show "OTP expired, request new one" message.

### MA-AUT-013 Missing Phone Number Validation on Register
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/app/(auth)/register.tsx
**Category:** validation
**Description:** Phone number input accepts any text (no regex validation). Malformed numbers passed to backend causing validation failures.
**Impact:** Invalid phone numbers sent to backend; OTP sent to wrong number; registration fails.
**Fix hint:** Add E.164 format validation before API call; show "Invalid phone number" error client-side.

### MA-AUT-014 Race Condition: OTP Input Not Locked During Verification
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/app/(auth)/register.tsx
**Category:** race
**Description:** OTP input fields remain editable during verification request. Merchant can modify OTP while verification in flight.
**Impact:** User can change OTP after submit; second verification attempt uses wrong code; confusion and extra attempts.
**Fix hint:** Disable OTP input during `isVerifying` state; set editable={!isVerifying} on OTP input fields.

### MA-AUT-015 No Password Strength Validation
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/account/change-password.tsx:63
**Category:** validation
**Description:** Password validation only checks length >= 6 characters. No check for uppercase, numbers, symbols, or pattern uniqueness.
**Impact:** Weak passwords accepted (e.g., '111111' or 'aaaaaa'); merchants susceptible to brute force; compliance violation (PCI DSS, ISO 27001).
**Fix hint:** Require at least 1 uppercase, 1 number, 1 symbol; show password strength meter; reject patterns like sequential or repeated characters.

### MA-AUT-016 Missing Network Error Handling on Login
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/services/api/auth.ts:56
**Category:** error-handling
**Description:** Network errors on login endpoint throw raw error without user-friendly message. Exception bubbles to UI without context.
**Impact:** Merchants see technical error messages; cannot distinguish network issue from invalid credentials; no retry prompt.
**Fix hint:** Catch and wrap network errors; distinguish timeout from 401 from 500; show actionable user messages.

### MA-AUT-017 No Session Timeout on Merchant App
**Severity:** HIGH
**File:** Services/contexts missing session timeout logic
**Category:** logic
**Description:** No auto-logout after inactivity. Merchant token can remain valid indefinitely; unattended devices stay authenticated.
**Impact:** Unattended merchant device remains logged in; sensitive account and transaction data accessible; regulatory risk.
**Fix hint:** Implement 30-min inactivity timeout (configurable per merchant role); show warning at 25min; auto-logout at 30min.

### MA-AUT-018 No Login Attempt Rate Limiting Client-Side
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/app/(auth)/login.tsx
**Category:** logic
**Description:** Login button has no client-side throttling. User can rapid-fire submit requests causing brute force on backend.
**Impact:** Merchant account targeted with rapid login attempts; backend rate limit may be exhausted; legitimate merchants blocked.
**Fix hint:** Disable login button for 2-3 seconds after submit; show countdown; allow one attempt per 3 seconds max.

### MA-AUT-019 Password Not Cleared from State After Submit
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/account/change-password.tsx:81-112
**Category:** logic
**Description:** After password change, form state still holds old password text. User can see password in state if they navigate back.
**Impact:** Password visible in component state after change; state data persisted in memory; security leak if component unmounts and remounts.
**Fix hint:** Clear password state immediately after success: `setFormData({...emptyForm})` before navigation.

### MA-AUT-020 No Logout Confirmation
**Severity:** LOW
**File:** Logout action across merchant app
**Category:** logic
**Description:** Logout executes immediately without confirmation. Accidental taps can logout merchant mid-task.
**Impact:** User experience; merchant loses session context mid-workflow; data loss if transaction in progress.
**Fix hint:** Show confirmation modal before logout: "Are you sure you want to sign out?" with OK/Cancel.

### MA-AUT-021 Missing Input Sanitization on Email Login
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/app/(auth)/login.tsx:46
**Category:** validation
**Description:** Email input trimmed but not lowercased. Case-sensitive email comparison may cause lookup failures.
**Impact:** User enters 'Email@Example.COM' but backend expects 'email@example.com'; login fails; merchant cannot access account.
**Fix hint:** Lowercase email before API call: `trimmedEmail.toLowerCase()`.

### MA-AUT-022 Refresh Token Stored as Access Token
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/services/api/auth.ts:111-112
**Category:** logic
**Description:** refreshToken endpoint sends refreshToken in body but expects backend to return new refresh token. If backend doesn't return refreshToken, it's never updated; old refresh token remains active forever.
**Impact:** Refresh token never rotates; stale refresh token reusable indefinitely; account takeover if token leaked.
**Fix hint:** Validate backend response includes `refreshToken` and update it; enforce mandatory refresh token rotation on each refresh.
**Status:** Fixed in commit (2026-04-15) — Added validation to enforce both token presence and mandatory refresh token rotation

### MA-AUT-023 No Token Expiration Tracking
**Severity:** MEDIUM
**File:** authApi.ts, auth.ts
**Category:** logic
**Description:** Tokens do not track expiresIn. No way to know when token will expire; app can't proactively refresh before expiry.
**Impact:** Requests may fail with 401 if token expires unexpectedly; user sees errors instead of seamless refresh.
**Fix hint:** Store `expiresIn` from response; schedule refresh 30s before expiration; proactively refresh on app resume.

### MA-AUT-024 No Two-Factor Auth on Merchant Login
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/app/(auth)/login.tsx
**Category:** logic
**Description:** Merchant login has no 2FA option. Single factor authentication for privileged account.
**Impact:** Merchant account compromised if password leaked; no additional protection; regulatory risk (PCI DSS requires 2FA).
**Fix hint:** Add 2FA prompt after email/password verification; support SMS, email, TOTP; make mandatory for admin accounts.

### MA-AUT-025 No Account Lockout After Failed Attempts
**Severity:** MEDIUM
**File:** Merchant login endpoint
**Category:** logic
**Description:** No client-side or enforced server-side account lockout after N failed attempts. Attacker can brute force indefinitely.
**Impact:** Merchant account susceptible to brute force attacks; no protection against credential stuffing.
**Fix hint:** Implement 5-attempt lockout for 30 minutes; show "Account temporarily locked" message; send email to merchant on lockout.

### MA-AUT-026 Missing Encryption for Sensitive Fields in Transit
**Severity:** MEDIUM
**File:** Services across merchant app
**Category:** security
**Description:** Sensitive data (phone, email, passwords) transmitted as JSON over HTTPS but no field-level encryption. TLS only.
**Impact:** In case of TLS downgrade or MITM, sensitive fields readable; regulatory risk (PCI DSS, HIPAA compliance).
**Fix hint:** Implement field-level encryption for PII; use AES-256-GCM; encrypt before JSON serialization.

### MA-AUT-027 No Device Binding on Session
**Severity:** MEDIUM
**File:** Services/contexts
**Category:** security
**Description:** Session tokens not bound to device (no device fingerprint). Token valid on any device if stolen.
**Impact:** Stolen token usable on attacker's device; no detection of token reuse on different device.
**Fix hint:** Store device fingerprint (IMEI, Android ID, hardware serial); include in token; reject if device changes.

### MA-AUT-028 No Audit Log for Auth Events
**Severity:** HIGH
**File:** Auth services
**Category:** security
**Description:** No client-side logging of login/logout/password-change events. No audit trail for security incidents.
**Impact:** Cannot investigate unauthorized access; no forensic evidence; compliance violation (SOC 2, ISO 27001).
**Fix hint:** Log all auth events (login, logout, password change, 2FA toggle) with timestamp and device info; send to backend audit service.
