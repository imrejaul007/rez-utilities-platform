# Admin App Security Bugs (ADMIN-APP-SECURITY)

## AA-SEC-001: Insufficient RBAC Enforcement on Deep Links

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/_layout.tsx` (lines 130-136)

**Category:** RBAC

**Description:** The app redirects to `/(dashboard)` if the user is authenticated and has a valid admin role, but does not enforce RBAC on individual deep links. An attacker can deep-link directly to a sensitive page (e.g., `/(dashboard)/wallet-adjustment`) and the app will allow access if authenticated, regardless of their actual role.

**Impact:** Role-based access control bypass. A MODERATOR can access SUPER_ADMIN-only pages if they construct the deep link manually.

**Fix hint:** Add a per-route RBAC check. Before rendering each dashboard screen, verify that `user.role` is in the allowed roles for that route. Return an "Access Denied" screen if not.

---

## AA-SEC-002: No RBAC Check on Cash Store Screen Entry

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/(dashboard)/cash-store.tsx` (lines 1-100)

**Category:** RBAC

**Description:** The cash-store screen does not check the user's role before rendering. Any authenticated admin can access the Cash Store management interface, even if they lack the FINANCE_ADMIN or equivalent role.

**Impact:** Unauthorized admins can create/delete vouchers, coupons, and campaigns, causing data loss and financial impact.

**Fix hint:** Add a `useAuth()` hook call and render an "Access Denied" screen if the user does not have the required role (e.g., FINANCE_ADMIN or SUPER_ADMIN).

> **Status:** Fixed in commit f88c5a6 (2026-04-15)
> **Notes:** Added useAuth() hook and RBAC check requiring SUPER_ADMIN role. Returns "Access Denied" screen with error message if user lacks required role.

---

## AA-SEC-003: Weak Password Complexity Validation

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/(dashboard)/settings.tsx` (line 115)

**Category:** Authentication

**Description:** The password complexity regex requires at least one uppercase, lowercase, digit, and special character, but allows passwords as short as 8 characters. This is weak for admin accounts.

**Impact:** Weak admin passwords that can be brute-forced.

**Fix hint:** Increase minimum password length to 12 characters. Consider requiring at least 2 special characters or using a password strength meter (zxcvbn library).

---

## AA-SEC-004: No TOTP Enforcement for Super Admins

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/(auth)/login.tsx` (lines 30-36)

**Category:** Authentication

**Description:** TOTP (Time-based One-Time Password) is optional during login. Super Admins should be required to use TOTP, but the current flow allows them to skip it.

**Impact:** Weaker authentication for super admins. If their password is compromised, an attacker gains full access without a second factor.

**Fix hint:** Enforce TOTP for SUPER_ADMIN and ADMIN roles. Return an error if the user's role requires TOTP but they don't provide it.

---

## AA-SEC-005: TOTP Setup Token Not Rate-Limited

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/(auth)/login.tsx` (lines 63-74)

**Category:** Authentication

**Description:** The `setupToken` issued during TOTP setup is not validated for expiry or rate-limited. An attacker can request TOTP setup multiple times and potentially reuse old setup tokens.

**Impact:** TOTP bypass. An attacker can setup TOTP with their own authenticator app and maintain access to the account.

**Fix hint:** Expire setupToken after 5 minutes. Rate-limit TOTP setup requests to 3 per hour per user.

---

## AA-SEC-006: No Audit Logging of Admin Role Changes

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx`

**Category:** Audit Logging

**Description:** When a user logs in with a different role (e.g., after role reassignment), there is no audit log entry. The admin session state changes silently.

**Impact:** No visibility into role changes. Insider threats and privilege escalation attacks are undetected.

**Fix hint:** Log all role changes with timestamp, user ID, old role, new role, and the source (login, admin update, etc.).

---

## AA-SEC-007: Hardcoded Sentry DSN Exposure in Client Code

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/_layout.tsx` (line 20-23)

**Category:** Secrets Management

**Description:** The Sentry DSN is read from `process.env.EXPO_PUBLIC_SENTRY_DSN`. While "PUBLIC" implies it's meant to be public, exposing a DSN allows attackers to inject false error reports or enumerate your Sentry project.

**Impact:** Attackers can spam error reports, disrupting your monitoring. They can exfiltrate error stack traces.

**Fix hint:** Even public DSNs should be validated and rate-limited on the client. Consider using a proxy that validates the request source before forwarding to Sentry.

---

## AA-SEC-008: No Rate Limiting on Bulk Operations

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts` (lines 418-422)

**Category:** DoS Prevention

**Description:** The `bulkResolveAnomalies()` endpoint accepts an array of IDs with no size limit. An attacker can pass 1,000,000 IDs to crash the backend.

**Impact:** Denial of Service (DoS). Backend resource exhaustion.

**Fix hint:** Limit the `ids` array to a maximum of 100 items. Require pagination for larger operations.

---

## AA-SEC-009: No CSRF Token Validation

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** CSRF Prevention

**Description:** The app does not include a CSRF token in requests. If an attacker tricks an admin into visiting a malicious website, the attacker's site can make API calls on the admin's behalf using their JWT token.

**Impact:** Cross-Site Request Forgery (CSRF) attacks. Attackers can execute admin actions without the admin's knowledge.

**Fix hint:** Generate a CSRF token on the backend for each session. Include it in all state-changing requests (POST, DELETE, PATCH). Validate on the server.

---

## AA-SEC-010: No Clickjacking Protection

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin`

**Category:** Web Security

**Description:** The app does not set X-Frame-Options or Content-Security-Policy headers (if deployed as a web app). An attacker can embed the admin panel in an iframe and trick admins into clicking hidden buttons.

**Impact:** Clickjacking attacks. Admins unknowingly perform dangerous actions.

**Fix hint:** Set `X-Frame-Options: DENY` header. Implement frame-busting JavaScript: `if (self !== top) { top.location = self.location; }`.

---

## AA-SEC-011: No Session Timeout Warning

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx`

**Category:** Session Management

**Description:** The app does not warn the admin when their session is about to expire. If their token expires during a long form submission, the request fails silently.

**Impact:** Poor UX. Admin loses work due to silent session expiration.

**Fix hint:** Implement a session timeout warning at 80% of the session lifetime. Show a modal asking the admin to confirm if they want to stay logged in.

---

## AA-SEC-012: No Sensitive Data Scrubbing in Error Messages

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts` (lines 30-36)

**Category:** Data Protection

**Description:** Error messages from the backend are returned as-is to the client. If the backend leaks sensitive data in error messages (e.g., "User ID 12345 not found"), this is exposed to the UI.

**Impact:** Information disclosure. Sensitive data (IDs, emails, PII) leaks through error messages.

**Fix hint:** Scrub error messages on the client. Only show generic error messages to the UI. Log detailed errors server-side for debugging.

---

## AA-SEC-013: No Content Security Policy (CSP) Headers

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin`

**Category:** Web Security

**Description:** If the app is deployed as a web app, it does not set Content-Security-Policy headers. Attackers can inject external scripts.

**Impact:** XSS attacks. Attackers inject malicious JavaScript to steal tokens or perform actions.

**Fix hint:** Set CSP headers: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; ...`.

---

## AA-SEC-014: No Subresource Integrity (SRI) for CDN Resources

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin`

**Category:** Web Security

**Description:** If the app loads JavaScript or CSS from CDNs, it does not validate integrity using SRI. A compromised CDN can inject malicious code.

**Impact:** Man-in-the-Middle (MITM) attacks on CDN resources. Malicious code injection.

**Fix hint:** Add `integrity` attributes to all external script/link tags. Generate hashes using `openssl dgst -sha384`.

---

## AA-SEC-015: No X-Content-Type-Options Header

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin`

**Category:** Web Security

**Description:** The backend does not set `X-Content-Type-Options: nosniff`. Browsers may MIME-sniff responses and execute them as scripts.

**Impact:** MIME-sniff attacks. Attackers upload files that browsers execute as scripts.

**Fix hint:** Set `X-Content-Type-Options: nosniff` on the backend for all responses.

---

## AA-SEC-016: No Secure, HttpOnly Cookie Flags

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin`

**Category:** Session Management

**Description:** If the app uses cookies for session management (inferred from auth flow), they are not marked as Secure or HttpOnly. JavaScript can steal them.

**Impact:** Token theft via XSS. JavaScript can access and exfiltrate session cookies.

**Fix hint:** Set cookie flags: `Set-Cookie: token=...; Secure; HttpOnly; SameSite=Strict; Path=/; Domain=...`.

---

## AA-SEC-017: No API Request Signing

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** API Security

**Description:** API requests are not signed. Only the JWT token authenticates the client. If the token is leaked, all requests can be replayed by an attacker.

**Impact:** Token-based MITM attacks. Stolen tokens can be replayed indefinitely.

**Fix hint:** Implement request signing using HMAC or RSA. Include a timestamp and nonce to prevent replay attacks.

---

## AA-SEC-018: No Anomaly Detection in Admin Actions

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin`

**Category:** Threat Detection

**Description:** The app does not detect anomalous admin behavior (e.g., admin logging in from a new country, making 100 API calls in 10 seconds). These patterns could indicate account compromise.

**Impact:** Account compromise goes undetected. Attackers can operate freely.

**Fix hint:** Log all admin actions with IP, geolocation, user-agent. Implement alerting for anomalies (new IP, unusual times, bulk actions).

---

## AA-SEC-019: Dangerous Bulk Delete Without Confirmation

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/(dashboard)/learning-content.tsx` (lines 142-162)

**Category:** Data Protection

**Description:** The learning content delete functionality does not show a confirmation dialog with the item details. An admin could accidentally delete critical content.

**Impact:** Accidental data deletion. No audit trail of who deleted what.

**Fix hint:** Show a confirmation dialog: "Are you sure you want to delete [item title]? This action cannot be undone." Log the deletion with admin ID and reason.

---

## AA-SEC-020: No Encryption of Sensitive Data at Rest

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx` (lines 47-49)

**Category:** Data Protection

**Description:** The JWT token is stored in SecureStore, but if the device is compromised, the token can be extracted. There's no additional encryption layer.

**Impact:** Token theft if the device is compromised or stolen.

**Fix hint:** Encrypt the token before storing it in SecureStore using a device-specific key (not derivable from the token itself).

---

## AA-SEC-021: No Admin Action Confirmation for Destructive Operations

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/(dashboard)/wallet-adjustment.tsx`

**Category:** Data Protection

**Description:** The wallet adjustment screen allows admins to credit/debit wallets without a secondary approval from another admin. A single rogue admin can drain wallets.

**Impact:** Financial theft. A single compromised admin account can cause loss.

**Fix hint:** Implement a maker-checker pattern: one admin initiates the adjustment, another admin approves it. Both are logged.

---

## AA-SEC-022: No Request Signing for High-Risk Operations

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts` (lines 334-338)

**Category:** API Security

**Description:** The batch execution endpoint does not require explicit confirmation or request signing. An attacker with a valid token can execute batches silently.

**Impact:** Unauthorized batch execution. Attacker can issue coins without approval.

**Fix hint:** Require a signed confirmation (hash of batch details + timestamp + admin ID) before execution. The backend validates the signature.

---

## AA-SEC-023: No Admin Session Logging

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx`

**Category:** Audit Logging

**Description:** When an admin logs in, there is no server-side logging of the login event (timestamp, IP, user-agent). Sessions are invisible.

**Impact:** No audit trail. Insider threats and compromised accounts are undetectable.

**Fix hint:** Log all login/logout events on the server with IP, user-agent, timestamp, location. Alert if suspicious patterns detected.

---

## AA-SEC-024: No Permission Elevation Workflow

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/_layout.tsx` (lines 67-86)

**Category:** RBAC

**Description:** Admin roles are hardcoded in `VALID_ADMIN_ROLES`. There's no way for a lower-privileged admin to request higher privileges, and no approval workflow for privilege escalation.

**Impact:** Admins cannot escalate permissions even when needed, causing operational friction. No audit trail for privilege escalation.

**Fix hint:** Implement a privilege escalation request workflow. Lower-privileged admins can request higher roles, which requires approval from SUPER_ADMIN.

---

## AA-SEC-025: No Rate Limiting on API Calls per Admin

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** DoS Prevention

**Description:** The app does not track the number of API calls per admin. An attacker with a valid token can make unlimited requests.

**Impact:** Denial of Service (DoS). Attackers can overload the backend.

**Fix hint:** Implement client-side rate limiting: track API calls per minute and throttle requests if they exceed a threshold (e.g., 100 requests/minute).

---

## AA-SEC-026: No Tamper Detection on Local Data

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx`

**Category:** Data Integrity

**Description:** User data (name, role, email) stored in React state is not signed or checksummed. An attacker can modify the state to reflect a higher role.

**Impact:** In-memory privilege escalation. While the backend is authoritative, the UI will reflect the tampered role.

**Fix hint:** Add a hash/signature to user data that is verified before use. This prevents in-memory tampering from affecting the UI logic.

---

## AA-SEC-027: No Timestamp Validation on API Responses

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts`

**Category:** API Security

**Description:** API responses include timestamps (e.g., `createdAt`, `executedAt`), but they are not validated against the client clock. An attacker can forge timestamps.

**Impact:** Data integrity issues. Admins cannot trust timestamps in the UI.

**Fix hint:** Validate that timestamps in API responses are within a reasonable skew (e.g., ±5 minutes of current time). Reject responses with future or very old timestamps.

---

## AA-SEC-028: No Protection Against Token Reuse

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx`

**Category:** Authentication

**Description:** If a JWT is leaked, it can be used indefinitely until it expires. There's no mechanism to revoke it early or blacklist it.

**Impact:** Token leaks are exploitable for the duration of the token's lifetime (potentially hours).

**Fix hint:** Implement token revocation: maintain a server-side blacklist of revoked tokens. Check it on every API call.

---

## AA-SEC-029: No Geolocation Validation on Login

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/(auth)/login.tsx`

**Category:** Threat Detection

**Description:** The app does not validate that the login location makes sense. An admin logging in from a different country than usual is not flagged.

**Impact:** Account compromise goes undetected. Attackers can operate from different locations.

**Fix hint:** Log login geolocation (based on IP). Alert admins if they login from a new country or country that would require impossible travel.

---

## AA-SEC-030: No Data Minimization in Admin APIs

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts`

**Category:** Data Protection

**Description:** The `KarmaProfile` interface includes all user data (badges, conversion history, etc.), even if not needed by the admin UI. This is excessive data exposure.

**Impact:** Larger API responses, more data in memory, higher risk of data leaks.

**Fix hint:** Implement query-based data selection. Allow admins to request only the fields they need (e.g., `?fields=userId,lifetimeKarma,level`).

