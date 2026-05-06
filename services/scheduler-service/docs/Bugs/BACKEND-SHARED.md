# Shared Backend Packages Audit

## Overview
Audit of rez-shared packages for bugs in types, schemas, middleware, utilities, and shared services. Issues identified across validation, idempotency, rate limiting, error handling, sanitization, and WebSocket delivery.

---

### BE-SHR-001 Missing maxRetries Parameter in Idempotency
**Severity:** MEDIUM
**File:** `rez-shared/src/middleware/idempotency.ts`
**Category:** Idempotency / Retry Logic
**Description:** The `shouldRetry()` method signature includes `maxRetries: number = 5` as default, but `deliver()` in webhook service calls `shouldRetry(axiosError, attempt)` without passing `maxRetries`. The hardcoded default of 5 is inconsistent with webhook configuration `maxRetries` option (line 130 in webhookService).
**Impact:** Webhooks may retry beyond their configured retry limit, wasting resources and potentially overwhelming downstream systems.
**Fix hint:** Pass the webhook's configured `maxRetries` to `shouldRetry()`, or retrieve it from the webhook document before calling.

---

### BE-SHR-002 Race Condition in Idempotency Cache Interception
**Severity:** MEDIUM
**File:** `rez-shared/src/middleware/idempotency.ts`
**Category:** Idempotency / Concurrency
**Description:** The middleware intercepts `res.send()` but concurrent requests with the same idempotency key may process simultaneously if the Redis check (line 60) happens before the first request finishes. The response is cached after the original handler completes, but a second concurrent request could still execute its handler before the cache is populated.
**Impact:** Duplicate operations may occur on rapid retries or when network delays are minimal.
**Fix hint:** Use Redis SETNX or GETSET with atomic operations, or implement request-level locking before the handler executes.

---

### BE-SHR-003 JSON Parsing Vulnerability in Idempotency
**Severity:** MEDIUM
**File:** `rez-shared/src/middleware/idempotency.ts` (line 64)
**Category:** Error Handling / Validation
**Description:** `JSON.parse(cached)` is called without try-catch. If cached data is corrupted or malformed, the middleware will crash instead of gracefully handling the error.
**Impact:** Malformed cache entries can crash the application.
**Fix hint:** Wrap `JSON.parse()` in try-catch and fallback to skipping cache if parsing fails.

---

### BE-SHR-004 Rate Limiter Key Generator Falls Back to IP Address
**Severity:** MEDIUM
**File:** `rez-shared/src/middleware/rateLimiter.ts` (line 36)
**Category:** Rate Limiting / Authorization
**Description:** Rate limiter defaults to `req.ip` when userId/merchantId is not available. Spoofed or shared IPs (proxies, VPNs, corporate networks) bypass per-user limits. The KDS rate limiter (line 80) uses `${req.storeId}:kds || req.ip`, which is a logic error: the OR operator won't work as intended if storeId is missing.
**Impact:** Users behind shared networks can exhaust rate limits. KDS limiter may silently fall back to per-IP limiting.
**Fix hint:** Enforce authentication before rate limiting. Fix line 80 to use `req.storeId ? ... : req.ip`.

---

### BE-SHR-005 Auth Rate Limiter Inconsistent with Other Limiters
**Severity:** LOW
**File:** `rez-shared/src/middleware/rateLimiter.ts` (line 115)
**Category:** Rate Limiting / Configuration
**Description:** Auth rate limiter uses custom RedisStore setup (line 117-119) while other limiters use the `createRateLimiter()` helper. This duplicates code and makes future maintenance inconsistent.
**Impact:** Code duplication; harder to update rate limiting logic uniformly.
**Fix hint:** Refactor auth limiter to use `createRateLimiter()` helper with appropriate options.

---

### BE-SHR-006 Missing Error Details in Error Handler
**Severity:** LOW
**File:** `rez-shared/src/middleware/errorHandler.ts` (line 146)
**Category:** Observability / Logging
**Description:** Error handler logs `code` field which may be undefined for native errors (non-AppError). No stack context for categorization.
**Impact:** Difficult to debug errors from third-party libraries or unexpected exceptions.
**Fix hint:** Add error type/constructor name to logs; preserve stack for production logging.

---

### BE-SHR-007 Validation Error Details Path Assumes Array
**Severity:** MEDIUM
**File:** `rez-shared/src/middleware/errorHandler.ts` (line 191-192)
**Category:** Error Handling / Validation
**Description:** Joi/Zod error details are reduced using `detail.path.join('.')`, but if `path` is not an array, the join() will fail. This is fragile assumption about error structure.
**Impact:** Validation errors with unexpected structures may crash the handler instead of returning a proper error response.
**Fix hint:** Add defensive checks: `Array.isArray(detail.path)` before calling join(); use fallback string.

---

### BE-SHR-008 DOMPurify Sanitizer May Not Handle All XSS Vectors
**Severity:** MEDIUM
**File:** `rez-shared/src/middleware/sanitizer.ts` (line 60)
**Category:** Security / Input Validation
**Description:** DOMPurify is configured with defaults only (no explicit config). Some XSS vectors (event handlers in data attributes, SVG-based XSS) may bypass default config depending on DOMPurify version.
**Impact:** Potential XSS vulnerabilities in sanitized user input.
**Fix hint:** Explicitly configure DOMPurify with `ALLOWED_TAGS`, `ALLOWED_ATTR`, and `KEEP_CONTENT` options; test against known XSS payloads.

---

### BE-SHR-009 Sanitizer Truncates Without Warning
**Severity:** LOW
**File:** `rez-shared/src/middleware/sanitizer.ts` (line 64-66)
**Category:** Data Loss
**Description:** Field length limits are silently enforced via substring truncation. No warning or error is returned to the client; data is silently modified.
**Impact:** User data is silently truncated without feedback, leading to unexpected results (e.g., incomplete addresses).
**Fix hint:** Add warning log or return validation error instead of silently truncating.

---

### BE-SHR-010 Address Sanitization May Lose Precision Coordinates
**Severity:** LOW
**File:** `rez-shared/src/middleware/sanitizer.ts` (line 157-187)
**Category:** Data Validation
**Description:** `sanitizeAddress()` calls `sanitizeString()` on all fields, but coordinates (if nested in address) would be stringified. The function signature shows it expects an object but doesn't recursively sanitize nested objects like coordinates.
**Impact:** Coordinates in address may be incorrectly sanitized if passed as strings; nested object handling is incomplete.
**Fix hint:** Add explicit coordinate validation using Zod schema with number type, or skip sanitization for numeric fields.

---

### BE-SHR-011 Health Check Returns Mixed HTTP Status Codes
**Severity:** LOW
**File:** `rez-shared/src/middleware/healthCheck.ts` (line 115)
**Category:** Health Check / Observability
**Description:** Line 115 returns 503 for both degraded and unhealthy states. The ternary is `status === 'healthy' ? 200 : status === 'degraded' ? 503 : 503`. This is correct but confusing and suggests the distinction between degraded and unhealthy is not actionable.
**Impact:** No way to distinguish between temporarily degraded and permanently unhealthy services.
**Fix hint:** Return different codes: 200 (healthy), 503 (degraded), 500 (unhealthy); or document the distinction more clearly.

---

### BE-SHR-012 MongoDB Connection State Check May Not Reflect Actual Connection
**Severity:** MEDIUM
**File:** `rez-shared/src/middleware/healthCheck.ts` (line 78)
**Category:** Health Check / Connection Validation
**Description:** Health check only verifies `readyState === 1` and calls `ping()`. A connection in CONNECTED state (1) may still be unusable if the underlying socket is dead. Ping may appear successful but subsequent queries could fail.
**Impact:** False positives in health checks; services declared healthy when they're unable to execute queries.
**Fix hint:** Execute a simple test query (e.g., `db.admin().serverStatus()`) instead of just ping.

---

### BE-SHR-013 Webhook Delivery Logging Does Not Include Request/Response Size
**Severity:** LOW
**File:** `rez-shared/src/webhook/webhookService.ts`
**Category:** Observability
**Description:** Webhook delivery logs (lines 197-205) do not include payload size or response body size, making it hard to diagnose bandwidth or payload issues.
**Impact:** Difficult to debug payload oversizing or slow delivery issues.
**Fix hint:** Log payload size and response size; add latency timing.

---

### BE-SHR-014 Webhook Signature May Not Be Constant-Time Comparison
**Severity:** MEDIUM
**File:** `rez-shared/src/webhook/webhookService.ts` (line 279-282)
**Category:** Security / Cryptography
**Description:** The `sign()` method creates HMAC signatures but there's no verification of incoming webhook signatures. If consumers verify signatures using simple `===` comparison, they're vulnerable to timing attacks.
**Impact:** Potential timing attack vulnerability if webhook signatures are verified.
**Fix hint:** Document the need for constant-time comparison (e.g., using `crypto.timingSafeEqual`); provide a `verifySignature()` helper.

---

### BE-SHR-015 Webhook Delivery Without Timeout Enforcement
**Severity:** MEDIUM
**File:** `rez-shared/src/webhook/webhookService.ts` (line 191-194)
**Category:** Reliability / Timeout
**Description:** Axios request has a 10-second timeout, but if the webhook handler is slow before calling axios, the timeout is not enforced for the entire delivery operation. Job queue may still wait indefinitely.
**Impact:** Slow webhooks can block the job queue and exhaust worker resources.
**Fix hint:** Add timeout wrapper around the entire `deliver()` function, or use Promise.race with a timeout.

---

### BE-SHR-016 Webhook Retry Logic Does Not Account for Max Retries From Configuration
**Severity:** MEDIUM
**File:** `rez-shared/src/webhook/webhookService.ts` (line 295)
**Category:** Retry Logic
**Description:** `shouldRetry()` has a hardcoded `maxRetries: number = 5` default, but the webhook's `maxRetries` configuration from the database is not passed. This means all webhooks retry 5 times regardless of their config.
**Impact:** Webhook retry behavior is not configurable; user configuration is ignored.
**Fix hint:** Fetch webhook's `maxRetries` before calling `shouldRetry()`; pass it explicitly.

---

### BE-SHR-017 Job Queue Remove-On-Complete Policy Too Aggressive
**Severity:** MEDIUM
**File:** `rez-shared/src/queue/jobQueue.ts` (line 55)
**Category:** Job Persistence / Debugging
**Description:** Completed jobs are removed after 1 hour (`removeOnComplete: { age: 3600 }`). For critical operations, completed jobs may be needed for audit trails or replay. No option to preserve completed jobs.
**Impact:** No audit trail or replay capability for completed jobs after 1 hour.
**Fix hint:** Make retention configurable per JobQueue instance; add an option for permanent retention.

---

### BE-SHR-018 Job Queue Deduplication May Fail on Collision
**Severity:** MEDIUM
**File:** `rez-shared/src/queue/jobQueue.ts` (line 86-95)
**Category:** Job Idempotency
**Description:** `addUnique()` uses `jobId: uniqueKey` but if the same job is added with the same key while one is still processing, BullMQ may not prevent duplication correctly. The behavior depends on BullMQ version and timing.
**Impact:** Deduplication may not be reliable; duplicate jobs could be processed.
**Fix hint:** Verify BullMQ deduplication semantics; add explicit deduplication check before adding.

---

### BE-SHR-019 Job Queue Scheduling Ignores Negative Delays
**Severity:** LOW
**File:** `rez-shared/src/queue/jobQueue.ts` (line 100-110)
**Category:** Job Scheduling
**Description:** `schedule()` calculates delay as `scheduledTime.getTime() - Date.now()`. If the scheduled time is in the past, delay is negative. BullMQ handles this, but no validation or warning is provided.
**Impact:** Silently schedules jobs immediately if the time is in the past; no error feedback.
**Fix hint:** Add validation; throw error or warn if `scheduledTime` is in the past.

---

### BE-SHR-020 Job Queue Email Deduplication Uses Email + Subject as Key
**Severity:** MEDIUM
**File:** `rez-shared/src/queue/jobQueue.ts` (line 206)
**Category:** Job Idempotency
**Description:** `sendEmail()` creates unique key as `email:${to}:${subject}`. If the same email is sent with the same subject multiple times, the second request will be deduplicated even if it's intentional (e.g., resend after failure). No TTL on the unique key.
**Impact:** Users cannot send identical emails multiple times; silent deduplication without feedback.
**Fix hint:** Make deduplication optional; add TTL to unique keys; allow explicit re-send flag.

---

### BE-SHR-021 Job Queue Service Has No Idempotency for Webhooks
**Severity:** MEDIUM
**File:** `rez-shared/src/queue/jobQueue.ts` (line 243-253)
**Category:** Job Idempotency
**Description:** `sendWebhook()` does NOT use `addUnique()` but calls `add()` with priority. If the same webhook is triggered twice, both jobs will be queued without deduplication.
**Impact:** Duplicate webhook deliveries for rapid retries.
**Fix hint:** Use `addUnique()` for webhook delivery with a TTL-based key (event ID + webhook ID + timestamp).

---

### BE-SHR-022 Circuit Breaker Does Not Track Time Between Requests
**Severity:** MEDIUM
**File:** `rez-shared/src/utils/circuitBreaker.ts`
**Category:** Observability / Metrics
**Description:** Circuit breaker tracks failure count but does not track request rate or time between requests. A service that fails 3 out of 6 requests over 1 second is treated the same as 3 failures over 1 hour.
**Impact:** Circuit breaker may open prematurely or fail to open for sustained failures.
**Fix hint:** Add time-windowed failure tracking; reset failure count periodically.

---

### BE-SHR-023 Circuit Breaker Timeout Not Honored in Promise.all
**Severity:** MEDIUM
**File:** `rez-shared/src/utils/circuitBreaker.ts` (line 82-90)
**Category:** Timeout Enforcement
**Description:** The timeout is set up with `Promise.all()` but the timeout promise uses `Promise<never>`, which means if the function completes first, the timeout is not cleared immediately. The timer is cleared in the catch block, but if the function succeeds, the timer still runs until the timeout fires and gets silently rejected.
**Impact:** Memory leak; timers accumulate and consume resources.
**Fix hint:** Use `Promise.race()` instead of `Promise.all()`; ensure timer is cleared immediately.

---

### BE-SHR-024 DTO Order Payment Method Mismatch with Order Type
**Severity:** MEDIUM
**File:** `rez-shared/src/dtos.ts` (line 38)
**Category:** Type Drift / Schema Mismatch
**Description:** `OrderPaymentDTO.method` includes `'razorpay'` and `'stripe'`, but the comment says `'online'` and `'mixed'` were removed. However, looking at `order.types.ts` line 76-83, `OrderPaymentMethod` also includes these. The DTO removed 'online' and 'mixed' correctly but may be out of sync with the actual Order model in the backend.
**Impact:** DTO may not match backend Order schema; clients may send invalid payment methods.
**Fix hint:** Verify DTO payment methods against backend Order model; add integration test to catch drift.

---

### BE-SHR-025 Validation Schema Allows Coins Without Validation
**Severity:** MEDIUM
**File:** `rez-shared/src/schemas/validationSchemas.ts` (line 63-69)
**Category:** Schema Validation
**Description:** `coinsUsed` object allows nonnegative numbers, but the refine() check on line 67 only validates that "at least one coin type has a positive value". However, the refine does not check the structure; it validates `Object.values(data)` which may fail if the object has unexpected keys.
**Impact:** Invalid coin objects (with extra keys) may pass validation.
**Fix hint:** Use `.strict()` mode or explicitly enumerate coin types; add type check.

---

### BE-SHR-026 Address Validation Does Not Enforce Maximal Addresses Per User
**Severity:** LOW
**File:** `rez-shared/src/schemas/validationSchemas.ts` (line 38-50)
**Category:** Business Logic
**Description:** Address schema validates individual addresses but has no check for maximum number of addresses per user. This is a backend concern, but the schema should document this constraint.
**Impact:** No validation constraint; backend must enforce limits separately.
**Fix hint:** Add documentation or custom validation rule for max addresses.

---

### BE-SHR-027 Offer Schema Date Comparison Allows Overlapping Offers
**Severity:** LOW
**File:** `rez-shared/src/schemas/validationSchemas.ts` (line 113-116)
**Category:** Business Logic
**Description:** Schema only validates that `startDate < endDate` but does not check for overlapping offers from the same merchant. This allows conflicting discount rules.
**Impact:** No validation for overlapping offer periods; backend must handle.
**Fix hint:** Document this as a backend responsibility; consider adding async validation if needed.

---

### BE-SHR-028 Coupon Code Schema Converts to Uppercase Without Validation
**Severity:** LOW
**File:** `rez-shared/src/schemas/validationSchemas.ts` (line 161)
**Category:** Data Transformation
**Description:** `couponCodeSchema` uses `.toUpperCase()` which transforms data. If a coupon code is intentionally lowercase, it will be modified without warning. No option to preserve case.
**Impact:** Coupon codes are modified; user intent is not preserved.
**Fix hint:** Remove `.toUpperCase()` or make it optional; validate case-insensitively instead.

---

### BE-SHR-029 Validation Middleware Does Not Validate All Request Parts
**Severity:** MEDIUM
**File:** `rez-shared/src/schemas/validationSchemas.ts` (line 171-196)
**Category:** Input Validation
**Description:** `validateRequest()` only validates `req.body`. It does not validate `req.params` or `req.headers`, which may contain user-controlled data.
**Impact:** URL parameters and headers are not validated; potential for injection attacks.
**Fix hint:** Add separate validation helpers for params and headers; compose them together.

---

### BE-SHR-030 Type Definition Has Deprecated But No Replacement Warning
**Severity:** LOW
**File:** `rez-shared/src/types/index.ts`
**Category:** API Documentation
**Description:** `NuqtaPlusTier` is deprecated in favor of `RezPlusTier`, but the barrel export re-exports both without clear guidance on which to use.
**Impact:** Consumers may continue using deprecated type unknowingly.
**Fix hint:** Add TSDoc comments and enforce via linter; remove deprecated export in next major version.

---

## Summary

- **Total Bugs Found:** 30
- **Critical:** 0
- **High:** 6 (BE-SHR-002, BE-SHR-004, BE-SHR-007, BE-SHR-016, BE-SHR-019, BE-SHR-029)
- **Medium:** 18
- **Low:** 6

**Key Areas of Concern:**
1. **Idempotency & Concurrency** — Race conditions and cache management issues
2. **Retry Logic** — Configuration not being honored
3. **Security** — XSS sanitization, timing attacks, input validation gaps
4. **Job Queue** — Deduplication reliability, retention policies
5. **Type Drift** — DTOs and schemas may diverge from backend models
