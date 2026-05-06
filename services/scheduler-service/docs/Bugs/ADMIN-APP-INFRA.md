# Admin App Infrastructure Bugs (ADMIN-APP-INFRA)

## AA-INF-001: JWT Payload Parsing Without Verification

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx` (lines 51, 81)

**Category:** Token Validation

**Description:** The application decodes JWT tokens client-side using base64 decoding (`atob()`) without cryptographic verification. While comments claim "no verification needed, backend is authoritative," an attacker can craft a malicious JWT with arbitrary claims (role, id, email) that will be accepted and processed by the app. The client-side role check is only cosmetic; a compromised or spoofed token reaches the frontend state.

**Impact:** Privilege escalation. A user could craft a JWT with role='SUPER_ADMIN' and bypass frontend RBAC, even if the backend rejects it. Session hijacking via token tampering becomes easier. If the token storage is compromised, attackers can silently escalate permissions.

**Fix hint:** Never trust decoded JWT payloads. Always validate the cryptographic signature using a public key (RS256) or backend endpoint. Treat all decoded claims as untrusted user input. Consider storing only the token and fetching user profile via `/api/admin/auth/me` on app load, then validating backend response.

---

## AA-INF-002: No Timeout on JWT Parsing Failures

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx` (lines 68-73)

**Category:** Error Handling

**Description:** If the JWT payload parsing fails (e.g., malformed token, missing base64 padding), the catch block silently deletes the token and logs nothing. No error telemetry is sent. An attacker can flood the app with invalid tokens to force token deletion and session loss.

**Impact:** Denial of Service (DoS). Defenders have no visibility into token parsing failures. Silent failure makes debugging and security incident detection harder.

**Fix hint:** Log JWT parsing errors with the token shape (not the secret), so you can detect token injection attacks. Add rate-limiting per user to prevent token-flooding DoS.

---

## AA-INF-003: Unvalidated Role Assignment on Login

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx` (line 86)

**Category:** Input Validation

**Description:** In the `login()` function, if the JWT payload lacks a `role` claim, it defaults to `'ADMIN'` without checking against `VALID_ADMIN_ROLES`. An attacker can craft a token with `role: undefined` and the app will automatically grant ADMIN privileges.

**Impact:** Privilege escalation. Bypasses frontend RBAC. A non-admin user token can be manipulated to grant admin access on the client.

**Fix hint:** Always validate the role against `VALID_ADMIN_ROLES` before assigning it. Throw an error if the role is missing or invalid; do not default to ADMIN.

> **Status:** Fixed in commit 5c3aac9 (2026-04-15)
> **Notes:** Added VALID_ADMIN_ROLES constant and isValidRole() type guard. Updated login function to validate user role before dispatch, rejecting login if role is invalid.

---

## AA-INF-004: No Token Expiration Check Client-Side

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx`

**Category:** Session Management

**Description:** The JWT is decoded and stored, but there is no check for the `exp` claim. The token could be expired, yet the app will treat it as valid until the backend rejects an API call. This creates a race condition where the UI appears authenticated but API calls fail.

**Impact:** Poor UX (unexpected API failures) and reduced visibility into token expiration. An attacker can keep a stolen token alive longer by preventing the app from checking expiration.

**Fix hint:** Extract and validate the `exp` claim in the JWT. If the token is expired or within 5 minutes of expiry, proactively refresh or logout. Optionally implement a token refresh strategy.

---

## AA-INF-005: No Secure Storage Verification on Restore

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx` (lines 44-76)

**Category:** Secure Storage

**Description:** When restoring the session from SecureStore on app launch, the app does not verify that the token was actually stored securely. On some platforms, SecureStore may fall back to plain text or weak encryption if the secure enclave is unavailable.

**Impact:** Token leakage via unencrypted storage on devices without a secure enclave. No feedback to admins about storage security level.

**Fix hint:** Check if SecureStore is truly secure by querying the platform. If not, warn the admin or deny login. Use AsyncStorage only as a fallback for non-sensitive data.

---

## AA-INF-006: No Socket Authentication

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/socket.ts` (lines 17-22)

**Category:** API Security

**Description:** The WebSocket connection is established without any authentication. The socket.io client connects to the server but does not send the JWT token in the handshake. The backend may assume any authenticated HTTP client can upgrade to WebSocket.

**Impact:** Unauthenticated users can connect to the WebSocket and receive real-time events (e.g., new orders). An attacker on the same network can intercept WebSocket frames and access sensitive data.

**Fix hint:** Pass the JWT token in the socket.io client config: `{ auth: { token: getToken() } }`. Verify the token on the server during the upgrade handshake.

---

## AA-INF-007: Socket Callback Memory Leak on Unmount

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/socket.ts` (lines 56-64)

**Category:** Resource Management

**Description:** The `onConnectionLost` and `onNewOrder` callbacks are stored in module-level Sets. If a component registers a callback but never unregisters it (e.g., missing cleanup in useEffect), the callback will persist across unmounts and cause memory leaks.

**Impact:** Memory leak. Long-running sessions accumulate dead callbacks, slowing down the app and potentially causing out-of-memory crashes.

**Fix hint:** Require all callers to unregister callbacks in useEffect cleanup. Add a warning log if callbacks are registered but not cleaned up after a certain time.

---

## AA-INF-008: Hardcoded HTTP Fallback for API

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/config/api.ts` (line 12)

**Category:** Configuration

**Description:** The API URL defaults to `http://localhost:4000` if `EXPO_PUBLIC_API_URL` is not set. This is insecure for production because it assumes localhost is always available and secure, and may fall back to HTTP on a staging environment if misconfigured.

**Impact:** Man-in-the-Middle (MITM) attacks if the app connects to an unintended server. Tokens and user data transmitted over HTTP.

**Fix hint:** Never default to localhost in production. Require `EXPO_PUBLIC_API_URL` to be explicitly set. Validate the URL is HTTPS in production.

---

## AA-INF-009: No Certificate Pinning

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** Network Security

**Description:** The Axios client does not implement certificate pinning. The app trusts any valid certificate issued by any Certificate Authority, making it vulnerable to MITM attacks if a CA is compromised.

**Impact:** An attacker with access to a compromised CA can intercept all API traffic and steal tokens, user data, and session state.

**Fix hint:** Implement certificate pinning using a library like `@react-native-community/netinfo` or by configuring the native HTTP client on iOS (NSURLSession) and Android (OkHttp).

---

## AA-INF-010: No Error Telemetry on Auth Failures

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/auth.ts` (lines 19-21)

**Category:** Observability

**Description:** The `getCurrentUser()` function silently catches all errors and returns null. No logging or error tracking is sent. If the backend is down or the token is revoked, the admin has no visibility.

**Impact:** Reduced observability. Admins may not know why they're logged out. Security incidents (e.g., token revocation attacks) are invisible.

**Fix hint:** Log authentication failures with structured logging (include user ID, error code, timestamp). Send to error tracking (Sentry, etc.).

---

## AA-INF-011: Missing Rate Limiting on Login Endpoint

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/(auth)/login.tsx`

**Category:** API Security

**Description:** The login endpoint accepts any email and password combination without client-side rate limiting. An attacker can attempt unlimited brute-force attacks on admin accounts.

**Impact:** Brute-force attacks on admin credentials. If the backend does not rate-limit, attackers can enumerate valid admin emails and crack passwords.

**Fix hint:** Implement client-side rate-limiting (max 3 login attempts per 15 minutes per IP/device). Backend must also enforce rate-limiting.

---

## AA-INF-012: Axios Timeout Not Set for Long Operations

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts` (line 16)

**Category:** Timeout Handling

**Description:** Axios is configured with a 15-second timeout globally. However, some admin operations (e.g., bulk exports, batch executions) may legitimately take longer. A 15-second timeout will prematurely abort valid requests.

**Impact:** Admin operations fail unexpectedly. Long-running batch jobs are interrupted mid-process, potentially leaving the system in an inconsistent state.

**Fix hint:** Allow per-endpoint timeout overrides. Increase the global timeout to 30-60s for admin operations, or implement a separate long-timeout client for batch operations.

---

## AA-INF-013: No Interceptor for 401 Token Refresh

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** Session Management

**Description:** The Axios interceptor attaches the JWT token to every request but does not handle 401 responses. If the token expires mid-session, the API will return 401, and the app will not automatically refresh or logout.

**Impact:** Admins are stuck with an invalid token. API calls fail silently or with generic error messages. No seamless token refresh.

**Fix hint:** Add a response interceptor that catches 401 errors, refreshes the token (if a refresh token is available), and retries the original request. If refresh fails, logout the user.

---

## AA-INF-014: Shared Axios Client Instance Across Routes

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts` (line 44)

**Category:** State Management

**Description:** The `apiClient` is instantiated once at module load and reused globally. If the token is updated (e.g., via refresh), the interceptor reads the token at request time from SecureStore, which is correct. However, if an interceptor is added dynamically, it may not be registered on all existing requests.

**Impact:** Difficult to debug interceptor behavior. Race conditions if interceptors are added/removed dynamically.

**Fix hint:** Document that interceptors are registered at module load time. If dynamic interceptor changes are needed, use a factory function to create per-request clients.

---

## AA-INF-015: No Graceful Degradation for Offline Mode

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/config/api.ts`

**Category:** Reliability

**Description:** The app does not implement offline detection or queue. If the network is unavailable, API calls fail immediately with no retry mechanism or offline message.

**Impact:** Admin operations fail immediately on network loss. No offline-first capabilities.

**Fix hint:** Implement a network state listener. Show an "offline" banner and queue failed requests for retry when the network is restored.

---

## AA-INF-016: useAuth Hook No Error Boundary

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/contexts/AuthContext.tsx` (lines 127-131)

**Category:** Error Handling

**Description:** The `useAuth()` hook throws an error if used outside the AuthProvider. However, there's no global error boundary wrapping the entire app that catches this error gracefully.

**Impact:** If useAuth is accidentally called outside the provider, the app crashes without a helpful error message.

**Fix hint:** Wrap the entire app in an ErrorBoundary at the root level. Also, catch the "useAuth outside provider" error and log it with details.

---

## AA-INF-017: No Service Worker / Background Sync

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin`

**Category:** Reliability

**Description:** The app does not implement background sync for failed requests. If an admin action fails due to network loss, there's no automatic retry.

**Impact:** Admin operations are fragile and require manual retry.

**Fix hint:** Use a service worker (web) or background fetch API (native) to queue and retry failed admin actions.

---

## AA-INF-018: Missing MIME Type Validation on File Uploads

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/(dashboard)/upload-bill-stores.tsx` (inferred)

**Category:** Input Validation

**Description:** File upload endpoints likely accept any MIME type without validation. An attacker could upload a malicious executable disguised as an image.

**Impact:** Malware injection, server resource exhaustion.

**Fix hint:** Validate MIME types and file extensions on the client before upload. The backend must also validate before storing.

---

## AA-INF-019: No Connection Pool Reuse for Karma Service

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts` (lines 20-40)

**Category:** Performance

**Description:** The `buildClient()` function creates a new Axios instance for every API call. This prevents connection pooling and HTTP/2 server push optimizations.

**Impact:** Slower API performance, wasted resources on connection setup.

**Fix hint:** Create a singleton client for the Karma service, similar to the main apiClient. Reuse it across all Karma Admin calls.

---

## AA-INF-020: No Request Deduplication for Concurrent API Calls

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts`

**Category:** API Optimization

**Description:** If two screens call `getBatches()` at the same time, two separate HTTP requests are sent. There's no caching or request deduplication.

**Impact:** Wasted bandwidth, slower UI updates, increased backend load.

**Fix hint:** Implement request caching with React Query (already in use) or use a simple in-memory cache with expiry. Deduplicate concurrent requests with the same parameters.

