# REZ API Gateway - Bug Report

## Summary
Gateway audit identified 28 bugs across routing, rate limiting, auth middleware, caching, error handling, and security.

---

### BE-GW-001 Missing Error Handler Response
**Severity:** HIGH
**File:** rez-api-gateway/src/shared/authMiddleware.ts:42
**Category:** error-handling
**Description:** In `requireUser()`, the catch block does not return after sending the error response, allowing execution to continue to `next()`. This calls the next middleware even though authentication failed.
**Impact:** Authenticated request handlers can be reached without valid tokens, bypassing auth protection entirely.
**Fix hint:** Add `return;` statement after `res.status(401)` in all three middleware functions.

> **Status:** Misjudgment — Express middleware structure correctly prevents next() on auth failure (try block calls next only on success, catch block sends response without return, then function ends naturally)

---

### BE-GW-002 Missing Error Handler Response in requireMerchant
**Severity:** HIGH
**File:** rez-api-gateway/src/shared/authMiddleware.ts:81
**Category:** error-handling
**Description:** Same issue as BE-GW-001 - catch block at line 80 lacks return after error response.
**Impact:** Merchant auth can be bypassed; unauthenticated users reach protected merchant routes.
**Fix hint:** Add `return;` after `res.status(401)` at line 81.

> **Status:** Misjudgment — Express middleware structure correctly prevents next() on auth failure (same pattern as BE-GW-001)

---

### BE-GW-003 Missing Error Handler Response in requireAdmin
**Severity:** HIGH
**File:** rez-api-gateway/src/shared/authMiddleware.ts:111
**Category:** error-handling
**Description:** Same missing return in catch block - admin auth protection disabled.
**Impact:** Unverified users can access admin routes by reaching the next() call.
**Fix hint:** Add `return;` after line 111.

> **Status:** Misjudgment — Express middleware structure correctly prevents next() on auth failure (same pattern as BE-GW-001 and BE-GW-002)

---

### BE-GW-004 No Null Check on Authorization Header Slice
**Severity:** MEDIUM
**File:** rez-api-gateway/src/shared/authMiddleware.ts:22, 55, 92
**Category:** null-ref
**Description:** Code does `header?.startsWith('Bearer ') ? header.slice(7) : undefined` but never validates that `header` exists before the slice operation. If header is null/undefined, startsWith throws.
**Impact:** Unpredictable middleware behavior on malformed authorization headers.
**Fix hint:** Check `header && header.startsWith()` or use optional chaining throughout.

---

### BE-GW-005 Empty Token String Accepted
**Severity:** MEDIUM
**File:** rez-api-gateway/src/shared/authMiddleware.ts:22
**Category:** validation
**Description:** After `header.slice(7)`, there is no check that the resulting token is non-empty. A header of exactly "Bearer " (7 chars) results in token='', which is then passed to jwt.verify().
**Impact:** Invalid/empty tokens can be submitted for verification; unexpected JWT errors.
**Fix hint:** Add `if (!token || token.length === 0)` check before jwt.verify().

---

### BE-GW-006 JWT Secret Environment Variable Race Condition
**Severity:** MEDIUM
**File:** rez-api-gateway/src/shared/authMiddleware.ts:29, 62, 99
**Category:** validation
**Description:** `process.env.JWT_SECRET` is checked but if it changes between the check and jwt.verify(), the code fails. No defensive copy.
**Impact:** Potential for environment variable updates to cause token verification failures in flight.
**Fix hint:** Store `process.env.JWT_SECRET` in a const variable at module load time.

---

### BE-GW-007 Silent Exception Swallowing
**Severity:** MEDIUM
**File:** rez-api-gateway/src/shared/authMiddleware.ts:41
**Category:** error-handling
**Description:** `catch` block catches all errors without logging or differentiating between JWT verification failures and other errors (e.g., network issues).
**Impact:** Difficult to debug token verification problems; logs are missing.
**Fix hint:** Add logging: `logger.warn('Token verification failed', { error: err.message })` in all catch blocks.

---

### BE-GW-008 No Validation of JWT Payload Structure
**Severity:** MEDIUM
**File:** rez-api-gateway/src/shared/authMiddleware.ts:36
**Category:** validation
**Description:** After decoding, no check that `decoded.userId` or `decoded.role` exist. Malformed JWTs with missing fields are assigned to `req.userId = undefined`.
**Impact:** Downstream services receive undefined userId, causing null-ref errors or security bypasses.
**Fix hint:** Validate payload structure: `if (!decoded.userId || !decoded.role) throw new Error('Invalid token structure')`.

---

### BE-GW-009 Cookie Fallback Security Regression
**Severity:** HIGH
**File:** rez-api-gateway/src/shared/authMiddleware.ts:54
**Category:** security
**Description:** `cookieToken` is retrieved without validation that req.cookies exists. If cookies middleware is not loaded, reading `(req as any).cookies` returns undefined, causing confusing auth bypass.
**Impact:** Auth bypass if middleware chain is misconfigured.
**Fix hint:** Ensure express.cookieParser() is loaded before authMiddleware, or add defensive checks.

---

### BE-GW-010 Inconsistent Token Location Logic
**Severity:** MEDIUM
**File:** rez-api-gateway/src/shared/authMiddleware.ts:55
**Category:** logic
**Description:** `requireMerchant()` allows token from either Authorization header OR cookie, but `requireUser()` and `requireAdmin()` only allow header. Inconsistency creates security confusion.
**Impact:** Unpredictable auth behavior; developers may assume cookies work everywhere.
**Fix hint:** Standardize: decide whether cookies are supported, then apply consistently or document the exception.

---

### BE-GW-011 Nginx Rate Limiting Zone Not Applied to Auth Routes
**Severity:** HIGH
**File:** rez-api-gateway/nginx.conf:133
**Category:** validation
**Description:** Auth zone is configured at line 133 as `rate=20r/m` but the /api/auth location at line 512 uses `limit_req zone=auth_limit burst=5` - burst=5 allows 5 requests immediately, then rate-limited. This is contradictory to strict auth limits.
**Impact:** 5 concurrent invalid auth attempts bypass the 20r/m limit momentarily.
**Fix hint:** Change `burst=5` to `burst=1` or remove burst for auth endpoints to enforce strict rate limiting.

---

### BE-GW-012 Cloudflare IP List Not Updated
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf:103-126
**Category:** perf
**Description:** Cloudflare IPv4 ranges are hardcoded at 2026-04-10, but Cloudflare updates these ranges regularly. Static ranges can become outdated within months.
**Impact:** Real client IPs may not be extracted correctly after Cloudflare IP changes, breaking rate limiting and logging.
**Fix hint:** Use a dynamic IP list from Cloudflare API or implement periodic updates.

---

### BE-GW-013 Real IP Extraction from Loopback Enabled
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf:123
**Category:** security
**Description:** `set_real_ip_from 127.0.0.1/32` allows localhost to override X-Forwarded-For, which is necessary for internal health checks but can be spoofed if there's any way to reach nginx directly from localhost.
**Impact:** Attacker with localhost access could spoof X-Forwarded-For to bypass rate limiting.
**Fix hint:** Restrict this directive to internal health checks only, or move to a separate internal server block.

---

### BE-GW-014 Auth Cache Bypass Not Enforced
**Severity:** HIGH
**File:** rez-api-gateway/nginx.conf:189-192
**Category:** cache
**Description:** `proxy_cache_bypass $auth_cache_skip` skips cache for authenticated requests, but the auth header might be empty string "", which evaluates to 0 in the map (cache NOT skipped). A legitimate Authorization header would have `default 1`, skipping cache correctly.
**Impact:** Authenticated user data cached and served to next request if header format is unexpected.
**Fix hint:** Change `default 1` to explicitly check for Bearer token: `~^Bearer\s+ 1; default 0;`.

---

### BE-GW-015 /health/services Route Exposes Internal Architecture
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf:345-354
**Category:** security
**Description:** While restricted to 10.0.0.0/8 and 127.0.0.1, this endpoint returns full internal service URLs in JSON. If anyone gains access to Render internal network, all backend services are visible.
**Impact:** Information disclosure of internal topology; eases reconnaissance for internal attack.
**Fix hint:** Move to a separate internal-only port or require authentication header.

---

### BE-GW-016 Missing Circuit Breaker Recovery
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf:358-366
**Category:** error-handling
**Description:** `proxy_next_upstream` retries 502/503/504 but no exponential backoff or recovery timeout. If backend is degraded, all requests retry immediately, amplifying load.
**Impact:** Cascading failures during partial outages; DDoS-like amplification of failed requests.
**Fix hint:** Implement exponential backoff or use a real circuit breaker upstream.

---

### BE-GW-017 Payment Route Disables All Retries Silently
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf:522
**Category:** validation
**Description:** `proxy_next_upstream off;` disables retries for /api/payment to avoid duplicate charges, but if the backend fails, the client never gets a response (timeout or error), leaving them uncertain.
**Impact:** Payment requests timeout without clarity; customer doesn't know if charge went through.
**Fix hint:** Return 202 Accepted instead of retrying, but ensure the backend is idempotent and clients can query status.

---

### BE-GW-018 Socket.io Timeout Not Documented
**Severity:** LOW
**File:** rez-api-gateway/nginx.conf:714-715
**Category:** validation
**Description:** Socket.io has 86400s (24h) timeout, but real-world connections often timeout at 60-90 seconds due to proxies. 24h is unrealistic.
**Impact:** Socket.io connections forcefully closed by intermediate proxies after 60s, causing client disconnect.
**Fix hint:** Document and test actual timeout limits; consider reducing to 300s (5 min) with heartbeat.

---

### BE-GW-019 No Custom Error Handler for Upstream Errors
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf
**Category:** error-handling
**Description:** No custom `error_page` directives for 502/503/504. Nginx returns default HTML error page, not JSON API response expected by clients.
**Impact:** Frontend receives HTML error pages instead of JSON, causing parsing failures.
**Fix hint:** Add `error_page 502 503 504 /errors/gateway-unavailable.json;` with JSON error handler.

---

### BE-GW-020 CORS Allow-Credentials Without Same-Site
**Severity:** HIGH
**File:** rez-api-gateway/nginx.conf:296-297
**Category:** security
**Description:** `Access-Control-Allow-Credentials: true` is set, but no Same-Site cookie attribute is enforced by the gateway. This allows cross-origin cookie leakage if cookies are present.
**Impact:** Credential leak via cross-origin requests if cookies are used alongside tokens.
**Fix hint:** Add explicit `SameSite=Strict` to Set-Cookie headers, or remove credentials support if not needed.

---

### BE-GW-021 CSP Too Permissive
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf:277
**Category:** security
**Description:** CSP `script-src 'self'` allows any script from same domain, and `object-src 'none'` is good but `default-src 'self'` allows inline styles and unsafe eval.
**Impact:** XSS vulnerabilities in any upstream service can execute scripts due to overly permissive CSP.
**Fix hint:** Tighten to `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; ...`.

---

### BE-GW-022 Admin Routes Not Separated by IP
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf:676-693
**Category:** security
**Description:** Admin routes at /api/admin/ route to the monolith with merchant_limit rate limiting, not a stricter IP-based allowlist. Any client can access if they have a valid token.
**Impact:** Admin endpoints accessible to any authenticated user, not restricted to known admin IPs.
**Fix hint:** Add IP allowlist for /api/admin/ or use a separate server block for admin traffic.

---

### BE-GW-023 Gzip Compression May Leak Secrets
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf:58-64
**Category:** security
**Description:** Gzip is enabled on all responses, including those with Bearer tokens in response bodies. Gzip can leak information via compression ratio attacks (BREACH).
**Impact:** Attacker with MITM capability can infer token patterns from compression length.
**Fix hint:** Disable gzip for authenticated responses or disable gzip entirely if tokens appear in responses.

---

### BE-GW-024 Upstream Timeout Mismatch
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf:37-40
**Category:** validation
**Description:** `proxy_read_timeout 60s` is global, but socket.io overrides to 86400s. If a backend service has a 30s operation, nginx times out before the service completes, returning 504 to client.
**Impact:** Legitimate slow operations fail with 504 Gateway Timeout; clients retry, overloading backend.
**Fix hint:** Increase default read timeout to 120s or create service-specific timeouts.

---

### BE-GW-025 No Request Validation Before Forwarding
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf
**Category:** validation
**Description:** No content-length or body-size validation before forwarding to backends. POST bodies up to 50M are accepted (line 55) without schema validation.
**Impact:** Backends receive malformed payloads; DoS possible via oversized requests.
**Fix hint:** Add request body schema validation using a WAF or validate content-type + length combinations.

---

### BE-GW-026 Cache Key Includes Plain Authorization Header
**Severity:** HIGH
**File:** rez-api-gateway/nginx.conf:376, 393, 732
**Category:** cache
**Description:** `proxy_cache_key "$request_method$request_uri$http_authorization"` includes the full Authorization header in cache key. If two users have Bearer tokens that differ only in case or whitespace, they share a cache key.
**Impact:** One user's cached response serves another user if token formatting is slightly different.
**Fix hint:** Hash the token: use a map to extract and hash the Bearer value before cache_key.

---

### BE-GW-027 No X-Forwarded-Host Header Set
**Severity:** LOW
**File:** rez-api-gateway/nginx.conf:315-319
**Category:** header-forwarding
**Description:** `proxy_set_header Host $proxy_host` sets the Host to the upstream address, not the original request host. This breaks URL generation in upstreams that use Host to build links.
**Impact:** Redirect URLs and HATEOAS links point to internal service addresses instead of the gateway.
**Fix hint:** Set `proxy_set_header X-Forwarded-Host $http_host;` to preserve original host.

---

### BE-GW-028 Merchant Authorization Format Not Validated
**Severity:** MEDIUM
**File:** rez-api-gateway/nginx.conf:139-142
**Category:** validation
**Description:** `map $http_authorization $merchant_rate_key` does not validate Bearer token format - any value in Authorization header becomes a rate limit key. A header like `Authorization: not-a-token` is accepted as a valid merchant key.
**Impact:** Rate limiting bypassed if attacker uses arbitrary Authorization header values to create unique rate limit buckets per request.
**Fix hint:** Map only valid Bearer tokens: `~^Bearer\s+[\w\-]+$ $http_authorization; default $binary_remote_addr;`.

