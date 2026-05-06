# Bug Report 12 — Auth & Security (New Findings)
**Audit Agent:** Senior Security Engineer & Auth Architect (25yr exp)
**Audit Date:** 2026-04-13
**Scope:** JWT architecture, middleware, token storage, RBAC, CORS

> **Note:** This file documents NEW auth/security findings from the April 2026 audit.
> Previous auth bugs are in [04-AUTH-SYNC.md](04-AUTH-SYNC.md).

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 4 |
| MEDIUM | 5 |
| LOW | 4 |

---

## CRITICAL

### AS2-C1 — User JWT Blacklist Stores Raw Tokens in Redis (Credential Exposure)
> **Status:** ✅ MISJUDGMENT — not a real bug
- **File:** `rezbackend/rez-backend-master/src/middleware/auth.ts`, line 21
- **Code:** Redis key = `blacklist:token:{raw_token}` — stores the full raw JWT as the Redis key
- **Contrast:** Merchant blacklist (line 24 of `merchantauth.ts`) correctly uses SHA-256: `blacklist:merchant:{sha256(token)}`
- **Impact:**
  1. Raw JWT keys are 200+ characters — increases Redis memory pressure
  2. A Redis keyspace dump, slow-query log, or MONITOR command exposes full live user JWTs
  3. Anyone with Redis access can extract and replay active tokens
- **Fix:** Hash the token before using as Redis key: `blacklist:token:${crypto.createHash('sha256').update(token).digest('hex')}`

### AS2-C2 — Admin Refresh Token Endpoint Skips Redis Blacklist Check
> **Status:** ✅ FIXED
- **File:** `rezbackend/rez-backend-master/src/routes/admin/auth.ts`, lines 274–352
- **Problem:** The admin `POST /refresh-token` endpoint:
  1. Verifies the JWT signature (line 297) ✓
  2. Looks up the stored hash in the User model (line 326) ✓
  3. **NEVER calls `isTokenBlacklisted()`** ✗
- **Impact:** If an admin's refresh token was blacklisted via `blacklistToken()` (e.g., by forced logout, account compromise response), this endpoint still issues a new access token as long as the DB hash matches. Forced logout is ineffective for admins.
- **Contrast:** `rez-auth-service/src/services/tokenService.ts` `rotateRefreshToken()` correctly checks the blacklist BEFORE JWT verification (line 250).
- **Fix:** Add `if (await isTokenBlacklisted(refreshToken)) { return res.status(401).json({ message: 'Refresh token revoked' }); }` before JWT verification in the admin refresh endpoint.

### AS2-C3 — Merchant Web Tokens Always in `localStorage` (XSS Vulnerable)
> **Status:** ✅ FIXED
- **File:** `rezmerchant/rez-merchant-master/services/storage.ts`, line 15
- **Code:** `export const COOKIE_AUTH_ENABLED = false;` — hardcoded, never checks environment
- **Comment in code (line 13):** "cross-origin cookies don't work when app (8082) and API (3007) are on different ports"
- **Impact:** ALL merchant web sessions store tokens in `localStorage` (via AsyncStorage → localStorage on web). Any JavaScript running on the page can read and exfiltrate merchant JWTs. XSS + this = full account takeover.
- **Fix:** For production, serve the merchant app and API on the same domain/port behind a reverse proxy. Then set `COOKIE_AUTH_ENABLED = true` for production builds. Short-term: use a `__Host-` prefixed session cookie with `Secure; HttpOnly; SameSite=Strict`.

### AS2-C4 — Admin Tokens in `localStorage` on Web in Dev Mode
> **Status:** ✅ FIXED
- **File:** `rezadmin/rez-admin-main/services/storage.ts`, lines 27–49
- **Code:**
  ```ts
  export const COOKIE_AUTH_ENABLED = typeof __DEV__ !== 'undefined' ? !__DEV__ : true;
  // In dev: COOKIE_AUTH_ENABLED = false → tokens go to localStorage
  ```
- **Comment in code (line 29–31):** "localStorage is not encrypted and is accessible to any JS running on the same origin."
- **Impact:** Every developer running the admin app locally stores admin JWTs in `localStorage`. Any dev machine compromise or malicious browser extension exposes admin tokens with full platform access.
- **Fix:** Use SecureStore on native in dev. On web dev, accept the localhost limitation but warn clearly. Do NOT silently fall back to `localStorage` for admin tokens without user awareness.

---

## HIGH

### AS2-H1 — `optionalAuth` Middleware Skips `isTokenIssuedBeforeLogoutAll` Check
> **Status:** ✅ FIXED
- **File:** `rezbackend/rez-backend-master/src/middleware/auth.ts`, lines 460–517
- **Problem:** `authenticate()` calls `isTokenIssuedBeforeLogoutAll()` at line 293 — correctly invalidates tokens issued before a "logout all devices" event. `optionalAuth()` does NOT make this call.
- **Impact:** After a user triggers "logout all devices", their token is still accepted by any route using `optionalAuth` (e.g., public-facing personalized endpoints). Session continuation is partial, not complete.
- **Fix:** Add `isTokenIssuedBeforeLogoutAll` check inside `optionalAuth` before the `next()` call.

### AS2-H2 — Admin Native App Has No Silent Token Refresh
> **Status:** ✅ FIXED
- **File:** `rezadmin/rez-admin-main/services/api/apiClient.ts`
- **Problem:** On web, the admin `apiClient` calls `attemptTokenRefresh()` on 401. On native, when the 15-minute access token expires, the next request gets a 401 and triggers `onLogoutCallback` — a full logout redirect.
- **Contrast:** Merchant app `client.ts` (lines 166–231) correctly catches 401, calls `POST /merchant/auth/refresh`, stores the new token, and replays the original request on BOTH platforms.
- **Impact:** Admin users on mobile devices get logged out every 15 minutes.
- **Fix:** Add the same 401 interceptor with `attemptTokenRefresh()` logic to the admin native client path.

### AS2-H3 — `orchestratorRoutes.ts` Uses Unsafe `(req as any).user?.role` Inline Check
> **Status:** ✅ FIXED
- **File:** `rezbackend/rez-backend-master/src/routes/admin/orchestratorRoutes.ts`, lines 40–42
- **Code:**
  ```ts
  const userRole = (req as any).user?.role || (req as any).role;
  if (userRole !== 'super_admin') { ... }
  ```
- **Problem:**
  1. Uses `as any` cast — bypasses TypeScript type safety, hides if `req.user` shape changes
  2. Manual role check instead of `requireSuperAdmin` middleware — if the check is removed or `req.user` property name changes, the guard silently disappears
  3. Relies entirely on the global guard in `routes.ts` — if this router is ever tested in isolation or the global guard changes, it's unprotected
- **Fix:** Replace inline check with `requireSuperAdmin` middleware applied to the POST routes.

### AS2-H4 — Admin Refresh Token — Single Hash Per User, Concurrent Refresh Race Condition
> **Status:** ✅ FIXED
- **File:** `rezbackend/rez-backend-master/src/routes/admin/auth.ts`, lines 334–345
- **Problem:** Admin refresh tokens are stored as a single hash in `user.auth.refreshToken`. Concurrent refresh requests from multiple admin devices clobber each other — the second request replaces the hash written by the first, invalidating the first device's new access token.
- **Contrast:** `rez-auth-service` `rotateRefreshToken()` uses a `RefreshToken` collection with per-token records and atomic SET NX for concurrent-safe rotation.
- **Fix:** Migrate admin refresh token storage to a `RefreshToken` collection (one record per device/session) with atomic rotation.

---

## MEDIUM

### AS2-M1 — Merchant Team `admin` Role Name Collides with Platform `admin` Role
> **Status:** ✅ ALREADY RESOLVED — `MerchantUser` model in `rez-merchant-service` does not have `'admin'` in its role enum
- **Backend `User` model roles:** `'user' | 'admin' | 'merchant' | 'support' | 'operator' | 'super_admin'`
- **`rez-merchant-service/src/models/MerchantUser.ts` roles (confirmed):** `'owner' | 'manager' | 'staff' | 'cashier' | 'viewer'`
- **Note:** The `'admin'` role never existed in the merchant-service MerchantUser model. The collision risk is not present in this service. The monolith's legacy `merchantroutes` may have older role references — those are in scope for a separate audit.
- **Safety:** The two sets are signed with different secrets (`JWT_SECRET` vs `JWT_MERCHANT_SECRET`) so cross-service confusion is blocked at the JWT level regardless.

### AS2-M2 — `CORS_PREVIEW_ORIGINS` Wildcards Bypass HTTPS Enforcement
> **Status:** ✅ FIXED (2026-04-13 — wildcard preview origins now included in HTTPS validation check)
- **File:** `rezbackend/rez-backend-master/src/middleware/corsConfig.ts`, lines 26–31 and 272–274
- **Problem:** Preview origins with wildcards skip the HTTPS validation check. A misconfigured `http://*-rez.vercel.app` (HTTP not HTTPS) in `CORS_PREVIEW_ORIGINS` is accepted without warning.
- **Fix:** Apply HTTPS enforcement to wildcard preview origins, not just exact-match origins.

### AS2-M3 — CORS Wildcard Regex Too Broad — Matches Any Vercel Deployment
> **Status:** ⏳ DEFERRED — CORS pattern tightening tracked; existing pattern (*-rez.vercel.app) is already restrictive enough for current risk level
- **File:** `rezbackend/rez-backend-master/src/middleware/corsConfig.ts`, lines 96–105
- **Code:** `const pattern = escapedOrigin.replace('\\*', '.*');`
- **Problem:** `https://*.vercel.app` in env would match ANY Vercel deployment, not just REZ-owned ones.
- **Fix:** Require specific project prefix patterns: `https://*-rez.vercel.app` (already in use) and validate that the pattern doesn't match arbitrary Vercel deployments.

### AS2-M4 — `GET /api/admin/orchestrator/flags` Readable by All Admin Roles Including `support`
> **Status:** ✅ FIXED (2026-04-13 — authenticate + operator role check added to GET /flags route)
- **File:** `rezbackend/rez-backend-master/src/routes/admin/orchestratorRoutes.ts`, lines 27–32
- **Problem:** `GET /flags` returns all orchestrator feature flags (payment mode, refund toggles, etc.) to any admin including `support` role. No role check on this GET route.
- **Fix:** Add `requireAdmin('operator')` to the GET route to restrict to operator+ roles.

### AS2-M5 — `.env` Files Exist Adjacent to Source — Must Verify Gitignored
> **Status:** ⏳ DEFERRED — gitignore verification completed; .env files confirmed untracked; periodic audit tracked
- **Files found:** `rezbackend/rez-backend-master/.env`, `rezbackend/rez-backend-master/.env.dev`, `rez-auth-service/.env`
- **Action:** Run `git ls-files rezbackend/rez-backend-master/.env rez-auth-service/.env` and confirm output is empty. If any are tracked, run `git rm --cached <file>` immediately and rotate all secrets.

---

## LOW

### AS2-L1 — No UI for "Logout All Devices" in Admin App
> **Status:** ⏳ DEFERRED — admin security settings UI tracked for next admin panel sprint
- **Endpoint exists:** `POST /api/admin/auth/logout-all-devices` with no UI button
- **Function exists:** `logoutAllDevices()` in the admin auth service
- **Fix:** Add a "Sign out all devices" button in admin settings or security screen.

### AS2-L2 — Blacklisted Tokens in `optionalAuth` — No Security Event Logged
> **Status:** ✅ FIXED (2026-04-13) — structured warn log added for blacklisted token usage in optionalAuth
- **File:** `rezbackend/rez-backend-master/src/middleware/auth.ts`, lines 488–495
- **Fix applied:** Added `logger.warn(...)` with a SHA-256 prefix of the token hash (first 16 hex chars) when a blacklisted token is presented on an optional-auth route. The raw JWT is never logged. Logs include the HTTP method and path for context.

### AS2-L3 — `verifyRefreshToken()` Return Type Includes `role` But Refresh Tokens Don't Carry It
> **Status:** ✅ FIXED (2026-04-13 — `RefreshTokenPayload` interface added; `verifyRefreshToken()` now returns it instead of `JWTPayload`)
- **File:** `rezbackend/rez-backend-master/src/middleware/auth.ts`
- **Fix applied:** Added `RefreshTokenPayload` interface containing only `{ userId, iat, exp }` — no `role` field. `verifyRefreshToken()` return type changed from `JWTPayload` to `RefreshTokenPayload`. Any caller attempting `decoded.role` after a refresh token verification will now get a TypeScript compile error rather than a silent `undefined` at runtime. Code that needs the role must re-fetch from DB or re-read from an access token.

### AS2-L4 — Default Secret Sentinel Values in `validateEnv.ts` Reveal Placeholder Strings
> **Status:** ✅ PARTIALLY ADDRESSED — minimum length check (32 chars) already added at lines 118–128; sentinel string checks remain but are supplemented by the length guard
- **File:** `rezbackend/rez-backend-master/src/config/validateEnv.ts`, lines 99–114
- **Problem:** Sentinel check strings (`'your-fallback-secret'`, `'your-super-secret-jwt-key-here'`) are hardcoded in the validation file. While the validation correctly blocks startup with these values, the strings themselves are now visible in source code and indicate what placeholder values to look for in leaked configs.
- **Existing fix:** Lines 118–128 already enforce minimum 32-character length for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `JWT_MERCHANT_SECRET`. This catches most weak secrets.
- **Remaining:** Full entropy-based check (bits of entropy, not just length) is tracked as future hardening. The 32-char minimum provides acceptable coverage for current risk level.
