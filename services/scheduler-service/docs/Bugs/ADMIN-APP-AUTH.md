# Admin App Authentication Audit Report

**Total Bugs Found:** 24 | CRITICAL: 3 | HIGH: 8 | MEDIUM: 9 | LOW: 4

---

## Critical Severity

### AA-AUT-001 No Session Timeout Implementation
**Severity:** CRITICAL
**File:** app/contexts/AuthContext.tsx:1-132
**Category:** security
**Description:** The AuthContext does not implement any session timeout mechanism. Tokens persisted in SecureStore are valid indefinitely unless manually cleared. No activity-based session expiration exists, allowing stolen tokens to grant indefinite access.
**Impact:** Compromised credentials can be exploited indefinitely. Admin sessions continue even after extended inactivity, violating security best practices.
**Fix hint:** Implement a session timeout using Redux middleware or a useEffect hook that tracks last activity and invalidates tokens after N minutes of inactivity. Store token issued-at timestamp in the JWT and validate expiry client-side before each API call.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Added lastActivityAt tracking with 30-minute inactivity timeout. Implemented useEffect hook checking every 60 seconds. Calls logout() if SESSION_TIMEOUT_MS exceeded.

### AA-AUT-002 JWT Token Signature Verification Not Performed
**Severity:** CRITICAL
**File:** app/contexts/AuthContext.tsx:51-66, 81-89
**Category:** security
**Description:** The JWT is decoded using `atob()` without verifying the signature. A malicious actor can craft a JWT with any role/sub/email and inject it into SecureStore. The frontend trusts the token payload unconditionally.
**Impact:** Privilege escalation: an attacker can inject a token with `role: 'SUPER_ADMIN'` to access all admin features without valid backend credentials.
**Fix hint:** Do NOT verify the signature on the frontend (backend is authoritative). Instead, validate the JWT structure strictly and reject malformed tokens. Always validate user permissions by querying the backend GET /api/admin/auth/me endpoint before allowing access to sensitive screens.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Added strict JWT structure validation (parts.length === 3). Added role validation against VALID_ADMIN_ROLES. Invalid tokens rejected immediately. isAuthenticated now includes role check.

### AA-AUT-003 No Audit Logging for Authentication Events
**Severity:** CRITICAL
**File:** app/services/api/auth.ts:9-27
**Category:** audit-logging
**Description:** No audit logging is implemented for login, logout, or failed authentication attempts. Admin actions cannot be traced to individual users or reviewed for suspicious patterns.
**Impact:** Compliance violations (SOC 2, HIPAA if applicable). Cannot detect or respond to account compromise, lateral movement, or insider threats.
**Fix hint:** Add server-side audit logging for all auth events: login (success/fail), logout, password change, 2FA enable/disable, token generation. Log IP, user agent, timestamp, and action details.

> **Status:** Deferred — Backend implementation required
> **Reason:** Audit logging must be implemented server-side in auth.ts endpoint handlers. Frontend cannot collect IP/user-agent reliably. Backend must log all auth events with timestamp, IP, user agent, user ID. Recommend: add audit service in backend `/admin/auth/login` handler to log all login attempts (success/failure).

---

## High Severity

### AA-AUT-004 Missing Rate Limiting on Login Attempts
**Severity:** HIGH
**File:** app/(auth)/login.tsx:37-81
**Category:** security
**Description:** The login endpoint has no client-side rate limiting or server-side throttling. An attacker can attempt unlimited credential guesses in rapid succession.
**Impact:** Brute force attacks on admin credentials are feasible. Account takeover via password guessing.
**Fix hint:** Implement client-side rate limiting (max 5 login attempts per minute, then lock UI for 15 seconds). Server-side: track failed attempts per IP/email and lock account after 5 failures for 30 minutes.

> **Status:** Deferred — Backend rate limiting + Frontend UI required
> **Reason:** Rate limiting requires both backend (per-IP/per-email tracking) and frontend (cooldown UI). Backend must: (1) track failed login attempts, (2) lock account/IP after N failures, (3) return 429 status. Frontend must: (1) track local attempt count, (2) show countdown timer on rate limit, (3) disable submit button during cooldown.

### AA-AUT-005 TOTP Secret Exposed in Login UI
**Severity:** HIGH
**File:** app/(auth)/login.tsx:189-212
**Category:** security
**Description:** The TOTP setup secret (`setupSecret`) is displayed in plain text and made selectable. The secret is shown in the `setupUri` which may be cached in browser history or screenshots.
**Impact:** If a screenshot is taken during TOTP setup or if the device is accessed by an attacker, the secret can be used to generate valid TOTP codes.
**Fix hint:** Never display the secret after initial setup confirmation. Show a "Secret securely saved" message. Display QR code only once and do not render the secret string unless explicitly requested via a hidden/protected view.

> **Status:** Deferred — Frontend UI changes required
> **Reason:** TOTP secret exposure is a UI security issue. Frontend must: (1) hide secret text (only show QR code), (2) add warning not to screenshot, (3) require admin to enter TOTP code to confirm setup, (4) do not cache secret in component state longer than needed. Implement: hide secret field, show only QR code and 6-digit input.

### AA-AUT-006 No Password Reset / Account Recovery Flow
**Severity:** HIGH
**File:** app/(auth)/login.tsx:1-357
**Category:** validation
**Description:** No password reset or account recovery mechanism exists. If an admin forgets their password, there is no self-service recovery—manual backend intervention required.
**Impact:** Disruption to admin availability. If password is lost and no backup admin exists, platform operations may be blocked.
**Fix hint:** Implement forgot-password flow: email verification OTP → password reset. Store recovery codes during TOTP setup for account recovery without authenticator device.

> **Status:** Deferred — Backend forgot-password + Email + Frontend UI required
> **Reason:** Password reset requires: (1) backend forgot-password endpoint with email OTP verification, (2) email service integration, (3) password reset token with expiry, (4) frontend forgot-password screen. Implement: POST `/api/admin/auth/forgot-password`, POST `/api/admin/auth/reset-password/{token}`.

### AA-AUT-007 TOTP Setup Token Never Validated for Expiry
**Severity:** HIGH
**File:** app/(auth)/login.tsx:63-100
**Category:** security
**Description:** The `setupToken` returned during TOTP setup (`error.setupToken`) is used without validation of expiry. A stale token could be replayed or used out of band.
**Impact:** An attacker with an old setup token could attempt to enable TOTP on a compromised account.
**Fix hint:** Backend must issue short-lived setup tokens (5-minute expiry). Frontend must validate server response includes `expiresAt` and reject expired tokens. Store expiry timestamp in state.

> **Status:** Deferred — Backend setup token + Frontend validation required
> **Reason:** Setup token expiry validation requires: (1) backend to return `expiresAt` in setup token response, (2) frontend to check expiry before using token, (3) reject expired tokens with clear message. Implement: backend returns `{ setupToken, expiresAt }`, frontend validates `new Date(expiresAt) > now()` before using token.

### AA-AUT-008 No RBAC Permission Checks Before API Calls
**Severity:** HIGH
**File:** app/services/api/apiClient.ts:15-41, app/(dashboard)/fraud-config.tsx
**Category:** security
**Description:** The API client does not enforce role-based access control. A user with `MODERATOR` role can make API calls intended for `SUPER_ADMIN` only. Backend grants/denies access, but no client-side pre-flight check prevents unnecessary requests or data leakage.
**Impact:** Privilege escalation via direct API calls. Client-side guards (like `hasRole()`) exist on screens but not on API calls themselves.
**Fix hint:** Add a permission check wrapper around sensitive API calls: `guardedPost('/admin/fraud-config', ...)` that rejects if `!hasRole(required)` before sending the request.

> **Status:** Deferred — Frontend RBAC wrapper utility required
> **Reason:** Client-side RBAC checks require creating guardian wrapper functions. Backend enforcement is mandatory. Frontend can add: (1) guardedPost/guardedGet wrapper functions, (2) check user role before API call, (3) throw error if unauthorized. Implement: create apiGuard.ts with requireRole(role) middleware.

### AA-AUT-009 Logout Does Not Invalidate Backend Session
**Severity:** HIGH
**File:** app/services/api/auth.ts:24-26, app/(dashboard)/settings.tsx:172-182
**Category:** security
**Description:** The logout call silently fails (`await apiClient.post('/api/admin/auth/logout').catch(() => {})`). If the API call fails, the token remains valid on the server, and the session is not revoked.
**Impact:** Logged-out admin sessions remain active on the backend. A leaked token can still be used to make API calls.
**Fix hint:** Make the logout API call mandatory (do not swallow errors). If logout fails, show an error and retain the token in SecureStore. Only clear the token after confirmed server-side revocation.

> **Status:** Deferred — Frontend error handling + Backend logout endpoint required
> **Reason:** Mandatory logout requires: (1) frontend to NOT swallow logout errors, (2) show user error if logout fails, (3) backend to implement session revocation on logout. Frontend must: (1) remove `.catch(() => {})` swallow, (2) show error toast on logout failure, (3) retry logout. Backend must: (1) implement token revocation list or session tracking, (2) invalidate token on logout.

### AA-AUT-010 No Login Attempt Logging or Monitoring
**Severity:** HIGH
**File:** app/(auth)/login.tsx:37-81
**Category:** audit-logging
**Description:** Login attempts (success and failure) are not logged. Failed logins may indicate credential compromise but generate no alert.
**Impact:** Cannot detect brute force attempts, credential stuffing, or account compromise in real time.
**Fix hint:** Log all login attempts (success/failure) to backend with timestamp, IP, user agent, and reason for failure. Implement alerting for 3+ failed attempts in 5 minutes.

> **Status:** Deferred — Backend logging + Alerting infrastructure required
> **Reason:** Login logging requires backend to: (1) log all login attempts with IP, user agent, timestamp, status, (2) implement alerting service for suspicious patterns, (3) expose audit logs. Frontend can send attempt data but backend must persist and analyze. Backend must: (1) POST `/api/admin/auth/log-attempt` with details, (2) implement alerting rules.

---

## Medium Severity

### AA-AUT-011 AdminUser Missing `lastLoginAt` Field
**Severity:** MEDIUM
**File:** app/contexts/AuthContext.tsx:14-22
**Category:** types
**Description:** The `AdminUser` interface does not track `lastLoginAt`. Admin lastLogin timestamp should be captured to detect inactive accounts and suspicious session patterns.
**Impact:** Cannot identify inactive admin accounts or detect unauthorized access patterns based on login history.
**Fix hint:** Add `lastLoginAt?: string` to AdminUser interface. Update on successful login. Display in settings UI and use for session timeout logic.

> **Status:** Fixed in commit 9bd8b4d (2026-04-15)
> **Changes:** Added `lastLoginAt?: string` to AdminUser interface. Set to current timestamp on login. Restored from JWT payload on session restore.

### AA-AUT-012 Email Format Validation Regex is Permissive
**Severity:** MEDIUM
**File:** app/(auth)/login.tsx:43-48
**Category:** validation
**Description:** The email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` is overly permissive and does not validate TLD length or reject common typos. Example: `admin@..com` matches.
**Impact:** Invalid emails slip through and cause failed API requests, poor UX.
**Fix hint:** Use RFC 5322 subset or a proven library like `email-validator`. Or rely on backend validation and only perform basic format checks (`includes('@')`) on the frontend.

### AA-AUT-013 Missing 2FA Backup Codes
**Severity:** MEDIUM
**File:** app/(auth)/login.tsx:83-103
**Category:** security
**Description:** TOTP is enforced without backup codes. If the admin loses their authenticator app or device, they cannot regain access.
**Impact:** Account lockout if authenticator is lost. No recovery mechanism except manual backend intervention.
**Fix hint:** Generate 10 single-use backup codes during TOTP setup. Display once, mark as "saved securely". Allow admin to regenerate (with password confirmation). Accept backup codes in the TOTP input field.

### AA-AUT-014 Password Change Does Not Invalidate Other Sessions
**Severity:** MEDIUM
**File:** app/(dashboard)/settings.tsx:101-161
**Category:** security
**Description:** When an admin changes their password via settings, the current session token remains valid. If an attacker has stolen the old password, they can still use the old token to access the API.
**Impact:** Changing password does not immediately revoke existing sessions, leaving a window for token-based attacks.
**Fix hint:** After password change, invalidate all existing JWT tokens server-side (via token revocation list or UUID-based token tracking). Force all sessions to re-authenticate.

### AA-AUT-015 No Password Complexity Enforcement in Backend
**Severity:** MEDIUM
**File:** app/(dashboard)/settings.tsx:114-122
**Category:** validation
**Description:** Password complexity is enforced only on the frontend (uppercase, lowercase, digit, special char). Backend may not validate, allowing bypasses via direct API calls.
**Impact:** Weak passwords can be set via API calls that circumvent client-side validation.
**Fix hint:** Duplicate the complexity regex check on the backend. Reject passwords that do not meet the same criteria.

### AA-AUT-016 Token Interceptor Does Not Handle 401 Responses
**Severity:** MEDIUM
**File:** app/services/api/apiClient.ts:28-38
**Category:** error-handling
**Description:** When the backend returns 401, the client does not clear the stale token or redirect to login. The error is passed through as a generic error message.
**Impact:** If a token expires or is revoked server-side, the client continues using the invalid token until SecureStore is manually cleared.
**Fix hint:** Intercept 401 responses and call a logout handler that clears the token and redirects to login. Return a specific error type so callers can handle 401 differently.

### AA-AUT-017 User Role Label Mapping Uses lowercase/snake_case Inconsistently
**Severity:** MEDIUM
**File:** app/(dashboard)/settings.tsx:184-212
**Category:** types
**Description:** `getRoleLabel()` uses lowercase role strings (`'super_admin'`) but the backend returns uppercase (`'SUPER_ADMIN'`). Fallback to "Unknown" if case mismatch.
**Impact:** Admin role is not displayed correctly in settings UI. Confuses users about their actual role.
**Fix hint:** Ensure roles are consistently uppercase (SUPER_ADMIN, ADMIN, etc.). Update both getRoleLabel and getRoleColor to use consistent casing.

### AA-AUT-018 useAuth Throws Error if Not Inside Provider
**Severity:** MEDIUM
**File:** app/contexts/AuthContext.tsx:127-131
**Category:** error-handling
**Description:** The useAuth hook throws an error if called outside AuthProvider. If a screen is wrapped outside the provider hierarchy, the app crashes at runtime.
**Impact:** Developer error during refactoring can cause runtime crashes. Hard to debug.
**Fix hint:** Add a fallback useAuth hook that returns a disabled state or useAuth + error boundary combination. Document provider requirement clearly.

---

## Low Severity

### AA-AUT-019 No Logout Confirmation
**Severity:** LOW
**File:** app/(dashboard)/settings.tsx:172-182
**Category:** ui
**Description:** The logout confirmation modal shows "Logout" as the button text instead of "Confirm" or "Yes". Inconsistent with best practices for destructive actions.
**Impact:** Minor UX confusion. Users may misread the button.
**Fix hint:** Rename button to "Confirm Logout" or use a secondary destructive button style.

### AA-AUT-020 isAuthenticated Doesn't Account for Role Validation
**Severity:** LOW
**File:** app/contexts/AuthContext.tsx:114
**Category:** logic
**Description:** `isAuthenticated` returns `!!token && !!user` without validating that the user role is in `VALID_ADMIN_ROLES`. A user with an unrecognized role will be marked as authenticated.
**Impact:** Non-admin users (with unrecognized roles) can bypass role checks if only `isAuthenticated` is tested instead of role-specific guards.
**Fix hint:** Add role validation to isAuthenticated: `!!token && !!user && VALID_ADMIN_ROLES.includes(user.role)`.

### AA-AUT-021 Login Error Messages Leak Information
**Severity:** LOW
**File:** app/(auth)/login.tsx:59-76
**Category:** security
**Description:** Error messages distinguish between "Invalid credentials" and other errors. This can leak information about which accounts exist (user enumeration).
**Impact:** Attackers can use error messages to enumerate valid admin email addresses.
**Fix hint:** Return generic error message: "Invalid email or password" for all auth failures. Log detailed error server-side only.

### AA-AUT-022 No Client-Side Rate Limiting UX
**Severity:** LOW
**File:** app/(auth)/login.tsx:55-79
**Category:** ui
**Description:** The login button disables while loading, but there is no visual feedback for rate-limit lockout or remaining retry time.
**Impact:** After failed login attempts, the user is locked out but doesn't know when they can retry.
**Fix hint:** Add a countdown timer if rate limited: "Try again in 45 seconds". Disable button and show remaining time.

### AA-AUT-023 TOTP Validation Does Not Check Code Age
**Severity:** LOW
**File:** app/(auth)/login.tsx:50-53, 89-91
**Category:** security
**Description:** TOTP codes are accepted without checking if they were recently used (replay protection). Same code can be used multiple times within the 30-second window.
**Impact:** If a TOTP code is leaked, an attacker has 30 seconds to reuse it multiple times.
**Fix hint:** Backend must track used TOTP codes (last N used codes) and reject replays. Frontend cannot prevent this alone.

### AA-AUT-024 No Explicit User Consent for TOTP Enablement
**Severity:** LOW
**File:** app/(auth)/login.tsx:83-103
**Category:** security
**Description:** TOTP setup shows the secret but does not require explicit confirmation before saving. User might enable TOTP accidentally.
**Impact:** Accidental 2FA enablement can lock admin out if they lose the authenticator app.
**Fix hint:** Require admin to enter a TOTP code after setup before confirming enablement. Show checkbox: "I have saved my recovery codes" before allowing confirmation.

