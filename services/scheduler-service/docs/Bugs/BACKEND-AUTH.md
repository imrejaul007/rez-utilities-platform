# REZ Auth Service - Bug Report

## Summary
Auth service audit identified 35 bugs across authentication, authorization, token management, OTP verification, session handling, and data validation.

---

### BE-AUTH-001 OTP Verification Returns Boolean Without Context
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:114
**Category:** error-handling
**Description:** `otpService.verifyOTP()` returns a boolean (true/false), making it impossible to distinguish between "OTP expired", "OTP invalid", and "rate limited". All failures map to the same 401 response.
**Impact:** Client cannot differentiate failure reasons; UX is unclear whether to retry or request new OTP.
**Fix hint:** Return an object with error type: `{ success: boolean; reason: 'expired' | 'invalid' | 'locked' }`.

---

### BE-AUTH-002 OTP Hash Not Time-Safe
**Severity:** MEDIUM
**File:** rez-auth-service/src/services/otpService.ts:6-9
**Category:** security
**Description:** `hashOTP()` creates hash and compares it in the Lua script, but the comparison in Lua is simple `~=` (not equal), which is not timing-safe. An attacker can measure response time to infer hash byte-by-byte.
**Impact:** OTP brute-force attack complexity reduced; 6-digit OTP space (~1M) becomes feasible.
**Fix hint:** Use HMAC comparison that's constant-time at the Redis script level.

---

### BE-AUTH-003 OTP Lockout Timer Resets on Each Failure
**Severity:** MEDIUM
**File:** rez-auth-service/src/services/otpService.ts:150-158
**Category:** logic
**Description:** Each failed OTP attempt increments fail counter and calls `redis.expire(failKey, LOCKOUT_TTL)` only on the first failure. On subsequent failures within the window, the expire call is skipped, but the lock timer is checked. This creates a race where the counter expires before lockout activates.
**Impact:** After 4 failures, the 5th can come at 29+ minutes (the counter resets every 30 min window independently), extending attack window.
**Fix hint:** Always call `redis.expire(failKey, LOCKOUT_TTL)` to refresh timer, or use redis INCR with PSETEX.

---

### BE-AUTH-004 OTP Rate Limiting Does Not Account for Country Code
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:95-96
**Category:** validation
**Description:** `sendOTP()` rate limiting is based on phone number alone, but country code is not consistently validated. A user sending OTP to `+919876543210` vs `919876543210` (without +) might bypass phone-based rate limits if they're keyed differently.
**Impact:** Attacker sends OTP 3x per minute with different country code formats to exceed intended SMS quota.
**Fix hint:** Normalize phone number before rate limiting in middleware (strip all non-digits, then format consistently).

---

### BE-AUTH-005 Concurrent OTP Verification Creates Duplicates
**Severity:** HIGH
**File:** rez-auth-service/src/services/otpService.ts:141-145
**Category:** race
**Description:** While the Lua script is atomic, two concurrent calls to `verifyOTP()` on the same phone with the same OTP are possible if the OTP hasn't been deleted yet. The first caller wins, but the second also reads the key as not-found and increments the failure counter twice.
**Impact:** Legitimate concurrent requests (e.g., accidental double-click) increment failure counter twice, locking out the user prematurely.
**Fix hint:** Increment failure counter atomically within the Lua script ONLY after the comparison fails.

---

### BE-AUTH-006 Missing Phone Number Validation in Change Phone
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:643-650
**Category:** validation
**Description:** In `changePhoneRequestHandler()`, the parsed phone is never validated to ensure it's different from the user's current phone. User can request OTP for their own phone, then "verify" it to perform a no-op update.
**Impact:** Wasted SMS quota and confusion in logs; potential state inconsistency if used as an implicit "resend OTP" mechanism.
**Fix hint:** Add check: `if (newFullPhone === user.phoneNumber) return 400 with "Cannot change to same number"`.

---

### BE-AUTH-007 Upsert Creates Multiple Users on Concurrent OTP Verify
**Severity:** HIGH
**File:** rez-auth-service/src/routes/authRoutes.ts:125-139
**Category:** race
**Description:** The comment claims atomic upsert eliminates the TOCTOU race, but `findOneAndUpdate` with `returnDocument: 'after'` is atomic. However, if two requests verify OTP for the same phone simultaneously, both might execute the upsert before either sees the other's result. MongoDB's unique index prevents duplicates, but the first request's upsert is lost.
**Impact:** Race condition between two concurrent OTP verifications results in one user's session creation being silently ignored.
**Fix hint:** Ensure unique index on `phoneNumber`, catch duplicate key errors, and retry once.

---

### BE-AUTH-008 New User Detection Based on Timestamp is Flaky
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:141
**Category:** logic
**Description:** `isNewUser = Math.abs(user.createdAt.getTime() - now.getTime()) < 1000` uses a 1-second window. If the OTP verification is delayed by network latency, `now` and `createdAt` might differ by more than 1s, causing `isNewUser` to be false even for brand-new accounts.
**Impact:** New user onboarding flow is triggered incorrectly; frontend UX breaks.
**Fix hint:** Use the upsert result's `matchedCount === 0` instead of timestamp comparison.

---

### BE-AUTH-009 Device Hash Not Normalized for User-Agent
**Severity:** MEDIUM
**File:** rez-auth-service/src/services/deviceService.ts:4-8
**Category:** validation
**Description:** `computeFingerprint()` uses raw headers (user-agent, accept-language, x-forwarded-for) without normalizing. Browser minor version changes trigger new device hash, allowing the same user to accumulate infinite "unique devices".
**Impact:** Device trust mechanism fails; after each browser update, user is marked as suspicious.
**Fix hint:** Normalize user-agent to major version only, remove minor versions and build numbers.

---

### BE-AUTH-010 Device Trust Requires Opaque Threshold
**Severity:** MEDIUM
**File:** rez-auth-service/src/services/deviceService.ts:19-21
**Category:** validation
**Description:** Device trust thresholds are hardcoded (`count >= 3` for trusted, `uniqueDevices > 10` for suspicious) with no explanation. Why 3? Why 10? These are security-critical values.
**Impact:** Trust model is undocumented; thresholds can't be tuned for security vs. usability.
**Fix hint:** Move to environment variables with documented reasoning.

---

### BE-AUTH-011 Device Tracking Failure Silently Defaults to "new"
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:159-165
**Category:** error-handling
**Description:** If `assessRisk()` or `recordDevice()` throws, it's caught silently and defaults to `deviceRisk = 'new'`. This masks Redis outages and makes device tracking unreliable.
**Impact:** Redis outage causes all logins to be marked as "new device", triggering unnecessary 2FA flows.
**Fix hint:** Log the error and propagate as a warning response, or fail gracefully with a degraded flag.

---

### BE-AUTH-012 PIN Validation Accepts Numbers as Strings
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:223
**Category:** validation
**Description:** `bcrypt.compare(String(pin), pinHash)` converts pin to string, but `pin` can be submitted as a number in JSON. If `pin: 1234` is sent, `String(1234) === "1234"`, but if spaces or format is unexpected, comparison fails silently.
**Impact:** PIN login can fail for valid PINs if they're submitted in unexpected formats.
**Fix hint:** Validate pin format first: `/^\d{4,6}$/.test(String(pin)) || throw 400`.

---

### BE-AUTH-013 PIN Lockout Not Blacklisted in Redis
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:213-221
**Category:** validation
**Description:** PIN lockout is checked at the start of `loginPinHandler()`, but if the user is currently locked and doesn't clear the lock key within the 15-minute window, they remain locked even if they switch devices. No server-side lockout tracking beyond Redis.
**Impact:** User locked out on one device cannot login from another device; confusing UX.
**Fix hint:** Track lockout in MongoDB with timestamps, and only allow unlock after explicit timeout or admin action.

---

### BE-AUTH-014 PIN Common Patterns Incomplete
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:59-68
**Category:** validation
**Description:** Common PIN list includes obvious patterns (0000, 1111, 123456) but misses others like sequential (2345, 5678), reverse (9876, 4321 - already there), and repeating digits (1221, 3332). An adversary can test missing patterns first.
**Impact:** PIN security is weaker than assumed; common patterns aren't fully blocked.
**Fix hint:** Generate all 4-6 digit common patterns algorithmically instead of hardcoding.

---

### BE-AUTH-015 Password Reset Flow Not Implemented
**Severity:** HIGH
**File:** rez-auth-service/src/routes/authRoutes.ts
**Category:** api
**Description:** Audit scope lists "password reset" as a feature, but no `/auth/password/reset` or `/auth/password/change` endpoints exist in the code.
**Impact:** Users with forgotten PIN/passwords have no recovery mechanism.
**Fix hint:** Implement password reset flow: request (email/SMS), verify (token), reset (new PIN).

---

### BE-AUTH-016 2FA Not Implemented
**Severity:** HIGH
**File:** rez-auth-service/src/routes/authRoutes.ts
**Category:** api
**Description:** Audit scope lists "2FA" as a feature, but only OTP and PIN are implemented. No TOTP, SMS-based 2FA second factor, or authenticator app support exists.
**Impact:** Users cannot enable 2FA; single-factor authentication only.
**Fix hint:** Add TOTP support (time-based OTP) and optional SMS second factor.

---

### BE-AUTH-017 Refresh Token Rotation Doesn't Handle Concurrent Requests
**Severity:** MEDIUM
**File:** rez-auth-service/src/services/tokenService.ts:306-310
**Category:** race
**Description:** `rotateRefreshToken()` uses `redis.set(..., 'NX')` to atomically blacklist the old token, but if two concurrent requests try to rotate the same token, the first wins and the second gets `null` return, throwing "Refresh token already used". This is intentional, but the error handling doesn't clarify it's due to concurrency, not replay.
**Impact:** Legitimate concurrent refresh requests (e.g., multiple tabs) fail; user gets logged out.
**Fix hint:** Return a more specific error: "Refresh token already rotated in another request" with a 409 status.

---

### BE-AUTH-018 Refresh Token MongoDB Recording is Best-Effort
**Severity:** MEDIUM
**File:** rez-auth-service/src/services/tokenService.ts:357-366
**Category:** error-handling
**Description:** Recording new refresh token in MongoDB (line 357) is non-fatal; if it fails, the code logs a warning and continues. This means the new token is issued but not tracked, making single-use enforcement fail if Redis is also down.
**Impact:** If both Redis and MongoDB are unavailable, refresh token single-use enforcement is completely bypassed.
**Fix hint:** Fail the rotation if MongoDB write fails (unless already in a degraded state).

---

### BE-AUTH-019 Token Expiry Hardcoded in JWT Issuance
**Severity:** MEDIUM
**File:** rez-auth-service/src/services/tokenService.ts:43-52
**Category:** validation
**Description:** `getExpiry()` returns hardcoded durations like '15m', '24h', '60m' based on role, but there's no validation that these align with the client's expectations. If a client expects '8h' tokens but gets '15m', it breaks.
**Impact:** Token expiry mismatch causes frequent re-authentication; UX degradation.
**Fix hint:** Document expected expiry in API spec; consider making it environment-tunable.

---

### BE-AUTH-020 Admin Token Expiry Fallback Chain is Confusing
**Severity:** LOW
**File:** rez-auth-service/src/services/tokenService.ts:45-48
**Category:** validation
**Description:** Admin token expiry falls back through `JWT_ADMIN_EXPIRES_IN` → `JWT_EXPIRES_IN` → '60m'. If only `JWT_EXPIRES_IN` is set, admins get different expiry than consumers. This is implicit and error-prone.
**Impact:** Config mistakes lead to unexpected admin token durations.
**Fix hint:** Explicitly require `JWT_ADMIN_EXPIRES_IN` in env validation, or document the fallback chain clearly.

---

### BE-AUTH-021 Token Blacklist Check Before JWT Verify is Redundant
**Severity:** LOW
**File:** rez-auth-service/src/services/tokenService.ts:73-76
**Category:** validation
**Description:** `validateToken()` checks Redis blacklist before calling `jwt.verify()`, but an expired token is not in the blacklist. An expired token passes the blacklist check but fails jwt.verify(), requiring two separate error handlers.
**Impact:** Confusing error flows; expired vs. revoked tokens handled differently.
**Fix hint:** Check blacklist AFTER jwt.verify to avoid redundant checks.

---

### BE-AUTH-022 MongoDB Fallback Check is Timezone-Unsafe
**Severity:** MEDIUM
**File:** rez-auth-service/src/services/tokenService.ts:92-96
**Category:** types
**Description:** `new Date(user.lastLogoutAt).getTime() / 1000` converts to seconds, but `decoded.iat` (issued-at in seconds). If `lastLogoutAt` is stored in a different timezone or database is restarted, the comparison can be off by hours.
**Impact:** Token invalidation after logout is unreliable during timezone transitions or database resets.
**Fix hint:** Store and compare all timestamps as UTC epoch seconds, not Date objects.

---

### BE-AUTH-023 Merchant Token Validation Missing Role Check
**Severity:** HIGH
**File:** rez-auth-service/src/services/tokenService.ts:115-125
**Category:** validation
**Description:** For merchant tokens, the secret selection checks `role === 'merchant'`, but doesn't validate that the role claim is actually present in the token. A consumer token with no role claim would fall through to the default JWT_SECRET check.
**Impact:** A malformed token with no role claim bypasses role-based secret selection.
**Fix hint:** Add `if (!role) throw new Error('Token missing role claim')` before secret selection.

---

### BE-AUTH-024 Email Verification Token Not Consumed on MongoDB Failure
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:809
**Category:** idempotency
**Description:** `emailService.verifyEmailToken()` deletes the Redis token AFTER the MongoDB write. If MongoDB write fails (e.g., email already taken), the token is consumed but the email is not verified, leaving the user unable to retry.
**Impact:** Failed email verification leaves token consumed; user must re-request verification email.
**Fix hint:** Delete token after successful MongoDB write confirmation, or add token replay detection.

---

### BE-AUTH-025 Email Duplicate Check Allows Unverified Duplicates
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:760-765
**Category:** validation
**Description:** `emailVerifyRequestHandler()` checks only for verified emails: `'auth.emailVerified': true`. A user can claim email A, then another user can claim email A if the first user's email is not yet verified. After both verify, one email is lost.
**Impact:** Email race condition; one user's email claim is silently overwritten.
**Fix hint:** Reject emails that are pending verification (have a token in Redis).

---

### BE-AUTH-026 Admin Password Upgrade is Non-Atomic
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:471-475
**Category:** race
**Description:** After verifying legacy plaintext password, `bcrypt.hash()` is called asynchronously and updateOne is scheduled in `.then()`, but login continues before the hash is updated. If login happens again before hash updates, plaintext password is re-hashed.
**Impact:** Plaintext passwords remain in DB longer than necessary; multiple hash upgrades race each other.
**Fix hint:** Make hash upgrade synchronous, or use a queued task to batch upgrades.

---

### BE-AUTH-027 Guest Token Doesn't Validate storeId Format Fully
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:507-519
**Category:** validation
**Description:** `guestHandler()` validates storeId is a valid ObjectId and checks if store is active, but doesn't verify the store belongs to the authenticated user. Any guest can create a token for any store in the system.
**Impact:** Guest users can spoof tokens for other merchants' stores.
**Fix hint:** Add check: `if (store.merchantId && store.merchantId !== req.merchantId) return 403`.

---

### BE-AUTH-028 Guest Token Embeds Unencrypted StoreId
**Severity:** MEDIUM
**File:** rez-auth-service/src/services/tokenService.ts:54-62
**Category:** security
**Description:** `generateAccessToken()` accepts `extra` object and embeds merchantId directly in JWT: `{ userId, role, ...extra }`. This leaks storeId in the token payload (readable without signature verification).
**Impact:** Any observer (proxy, CDN log) can see which store a guest is accessing.
**Fix hint:** Don't embed storeId in token; instead, validate it server-side on each request.

---

### BE-AUTH-029 Missing Rate Limiting on Profile Updates
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:408-409
**Category:** validation
**Description:** `updateProfileHandler()` is rate-limited with `authLimiter` (30/min/IP), but individual fields like avatar, dateOfBirth can be updated without further validation. An attacker can spam profile updates 30 times per minute.
**Impact:** Profile updates can be spammed; no per-field rate limiting.
**Fix hint:** Add per-field rate limiting or require email confirmation for profile changes.

---

### BE-AUTH-030 Delete Account Doesn't Expire Active Sessions
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:418-427
**Category:** idempotency
**Description:** `deleteAccountHandler()` sets `isActive: false` and blacklists the current token, but doesn't blacklist all other tokens issued to that user. Other devices can still use their tokens.
**Impact:** Account deletion is incomplete; user can still be impersonated on other devices.
**Fix hint:** On account deletion, set `lastLogoutAt` to now to invalidate all tokens via MongoDB fallback.

---

### BE-AUTH-031 Onboarding Can Be Repeated
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:340-343
**Category:** idempotency
**Description:** `completeOnboardingHandler()` checks if already onboarded and returns early, but doesn't prevent re-submission of onboarding data. Subsequent calls with different profile data are silently ignored.
**Impact:** User thinks profile was updated but it wasn't; no error feedback.
**Fix hint:** Return 409 Conflict if already onboarded and trying to submit data again.

---

### BE-AUTH-032 Phone Number Stored Redundantly
**Severity:** MEDIUM
**File:** rez-auth-service/src/routes/authRoutes.ts:38-50
**Category:** validation
**Description:** User document has both `phoneNumber` and `phone` fields (line 40). Code checks both in findOne queries but updates both inconsistently. This dual-field design is error-prone.
**Impact:** Inconsistent phone fields; queries might miss users if only one field is updated.
**Fix hint:** Consolidate to a single `phoneNumber` field; migrate legacy `phone` data.

---

### BE-AUTH-033 OTP Sent in Logs for Development
**Severity:** HIGH
**File:** rez-auth-service/src/services/otpService.ts:108-110
**Category:** security
**Description:** `EXPOSE_DEV_OTP=true && NODE_ENV !== 'production'` logs OTP to stderr/logs: `logger.warn(\`[DEV ONLY] OTP=\${otp}\`)`. If deployment is misconfigured and NODE_ENV is not 'production', OTP is logged in cleartext.
**Impact:** OTP exposure in logs; if logs are centralized, OTP leakage to log aggregation systems.
**Fix hint:** Remove logging; use a secure development flow (e.g., test SMS service with known numbers).

---

### BE-AUTH-034 Internal User Lookup Not Authorized
**Severity:** HIGH
**File:** rez-auth-service/src/routes/authRoutes.ts:619-633
**Category:** rbac
**Description:** `/internal/auth/user/:id` requires `requireInternalToken` but doesn't validate that the caller is authorized to fetch that specific user's data. Any internal service with a valid token can fetch any user.
**Impact:** Internal service compromise leaks all user data; no service-to-service isolation.
**Fix hint:** Add scoped token validation: tokens should specify which user IDs they're allowed to access.

---

### BE-AUTH-035 Environment Variable Validation Incomplete
**Severity:** MEDIUM
**File:** rez-auth-service/src/index.ts:26-45
**Category:** validation
**Description:** `validateEnv()` checks for required variables but doesn't validate their format (e.g., JWT_SECRET should be >16 bytes, MONGODB_URI should be a valid URI). Invalid format env vars pass validation and fail at runtime.
**Impact:** Configuration errors aren't caught at startup; failures occur during request handling.
**Fix hint:** Add format validators: `validateJWTSecret()`, `validateMongoURI()`, etc.

