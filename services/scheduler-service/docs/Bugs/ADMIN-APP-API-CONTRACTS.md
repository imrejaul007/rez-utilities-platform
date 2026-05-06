# Admin App API Contract Bugs (ADMIN-APP-API-CONTRACTS)

## AA-API-001: Untyped API Response Handling in Cash Store

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/(dashboard)/cash-store.tsx` (line 76)

**Category:** Type Safety

**Description:** The API response is accessed as `res.success` and `res.data` but no TypeScript type is defined. If the backend changes the response shape, the app will not catch the error at compile time.

**Impact:** Runtime errors when API contract changes. Type drift between client and backend.

**Fix hint:** Define a strict response type: `interface ApiResponse<T> { success: boolean; data?: T; message?: string; }`. Require all API calls to use this type.

> **Status:** Fixed in Phase 3 (2026-04-15) — Lifted canonical apiResponseSchema to rez-shared/schemas/apiContracts.ts; admin codebases will import and validate responses against shared schema.

---

## AA-API-002: Missing Error Response Typing

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts` (lines 28-38)

**Category:** Type Safety

**Description:** The error interceptor catches errors but only assumes the response has a `message` field. If the backend returns an error object with a different structure, the error message will be undefined.

**Impact:** Silent error messages. Users see "An unexpected error occurred" instead of the actual backend error.

**Fix hint:** Define an error response type and validate it in the interceptor. Fall back to a structured error message if the backend response is unexpected.

> **Status:** Fixed in Phase 3 (2026-04-15) — Lifted canonical errorResponseSchema to rez-shared/schemas/apiContracts.ts; admin apiClient will validate errors against shared schema with fallback.

---

## AA-API-003: Auth Service Missing Token Validation Response

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/auth.ts` (lines 10-13)

**Category:** API Design

**Description:** The `login()` function expects the backend to return `{ token: string; user: AdminUser }`. However, there's no validation that the returned token is a valid JWT or that the user object matches the expected schema.

**Impact:** If the backend returns an invalid token, the app will store it and fail later. Type drift between frontend and backend user schemas.

**Fix hint:** Add runtime validation of the login response using a library like `zod` or `io-ts`. Validate the JWT structure before storing.

---

## AA-API-004: Karma Admin Service Missing Batch Execution Confirmation

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts` (lines 334-338)

**Category:** API Design

**Description:** The `executeBatch()` endpoint does not require a confirmation token or checksum. An attacker with a valid token can call the API multiple times to execute the same batch twice.

**Impact:** Double-execution of batch conversions, duplicate coin issuance, financial loss.

**Fix hint:** Add an idempotency key to the request (e.g., `idempotencyKey: UUID`). The backend should return 409 Conflict if the same key is used twice within a time window.

---

## AA-API-005: No Validation of Pagination Parameters

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts` (lines 318-326)

**Category:** Input Validation

**Description:** The `getBatches()` function accepts `page` and `limit` without validation. An attacker can pass `limit: 1000000` to exhaust the backend.

**Impact:** Denial of Service (DoS). Backend resource exhaustion.

**Fix hint:** Validate that `page >= 1` and `limit <= 100`. Add server-side validation as well.

---

## AA-API-006: Inconsistent API Response Structures

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts`

**Category:** API Design

**Description:** Some endpoints return paginated data (e.g., `getBatches()` returns `{ batches: [], pagination: {} }`), while others return direct arrays (e.g., `getCSRPools()` returns `CSRPool[]`). No consistent wrapper.

**Impact:** Inconsistent client code. Each endpoint requires different parsing logic, increasing bug surface.

**Fix hint:** Standardize all API responses to use the same wrapper: `{ success: boolean; data: T; pagination?: {} }`. Update all service methods.

---

## AA-API-007: Missing Request/Response Logging

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** Observability

**Description:** The Axios interceptor does not log requests or responses. If a bug occurs, there's no visibility into what was sent/received.

**Impact:** Harder to debug API issues. No audit trail of admin API calls.

**Fix hint:** Add a logging interceptor that logs `[method] [url] [statusCode] [duration]`. Scrub sensitive fields (passwords, tokens).

---

## AA-API-008: No Content-Type Validation in Responses

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** API Design

**Description:** The client does not check the Content-Type header of API responses. If a proxy or CDN returns HTML error pages instead of JSON, the app will try to parse HTML as JSON and crash.

**Impact:** App crashes on unexpected response types. No graceful fallback.

**Fix hint:** Check Content-Type header in the response interceptor. If not `application/json`, log a warning and return an error.

---

## AA-API-009: Unvalidated URL Path Parameters

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts` (lines 328-331)

**Category:** Input Validation

**Description:** The `getBatchPreview(batchId: string)` function does not validate that `batchId` is a valid ObjectId or UUID. An attacker can pass `batchId: "'; DROP TABLE batches; --"` to potentially exploit SQL injection.

**Impact:** Depends on backend validation. If the backend is not properly prepared, SQL injection is possible.

**Fix hint:** Validate that `batchId` matches the expected format (e.g., MongoDB ObjectId: `/^[0-9a-f]{24}$/i`). Throw an error for invalid IDs.

---

## AA-API-010: No Retry Logic for Transient Failures

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** Reliability

**Description:** If an API call fails due to a transient error (e.g., 503 Service Unavailable), the app does not retry automatically. The admin must manually retry.

**Impact:** Reduced reliability. Transient backend issues cause admin operations to fail.

**Fix hint:** Implement exponential backoff retry logic for transient errors (5xx, network timeouts). Limit retries to 3 attempts.

---

## AA-API-011: Missing API Versioning

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** API Design

**Description:** The API client does not include a version header. If the backend API changes, the client has no way to signal that it expects a specific version.

**Impact:** Breaking changes in the backend API will silently break the client.

**Fix hint:** Add an `X-API-Version: 1` header to all requests. The backend can use this to route to the correct handler or return appropriate responses.

---

## AA-API-012: No Type Coercion for Number Fields

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts` (lines 74-88)

**Category:** Type Safety

**Description:** Fields like `totalEarnRecords`, `totalKarma`, `karmaEarned` are typed as `number` but the backend may return strings. No coercion or validation ensures the type matches.

**Impact:** Type errors at runtime when doing arithmetic on string values. Silent data corruption.

**Fix hint:** Use a schema validator (zod, io-ts) to coerce and validate all API response types at deserialization time.

---

## AA-API-013: Missing Rate Limit Headers Handling

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** API Design

**Description:** The client does not check rate limit headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`). If the backend is rate-limiting, the client has no visibility.

**Impact:** Admin operations hit rate limits unexpectedly with no warning.

**Fix hint:** Parse rate limit headers and show a warning UI if remaining quota is low. Use this to implement client-side rate limiting (delay subsequent requests).

---

## AA-API-014: No Timeout Handling for Long Bulk Operations

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts` (lines 418-422)

**Category:** Timeout Handling

**Description:** The `bulkResolveAnomalies()` endpoint processes multiple IDs but the client timeout is still 15 seconds. If there are 1000 anomalies to resolve, the request will timeout.

**Impact:** Bulk operations fail due to timeout, leaving the system in an inconsistent state.

**Fix hint:** Create a separate client for long-running operations with a 60+ second timeout. Alternatively, implement polling (return a job ID, poll for completion).

---

## AA-API-015: Missing Batch Operation Atomicity Contract

**Severity:** HIGH

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts` (lines 334-338)

**Category:** API Design

**Description:** The `executeBatch()` endpoint does not document or enforce atomicity. If it fails midway, the client has no visibility into how many records were processed.

**Impact:** Data inconsistency. Admin cannot determine which records were processed and which were not.

**Fix hint:** Define a contract: `executeBatch()` is all-or-nothing (ACID), or it returns `{ success: number; failed: number; errors: [] }` so the admin knows exactly what happened.

---

## AA-API-016: No Implicit Field Filtering in Responses

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts` (lines 47-71)

**Category:** API Design

**Description:** The `EarnRecord` interface includes fields like `verificationSignals`, `confidenceScore`, and `convertedBy`. If the backend changes these field names, the client will silently receive `undefined` values.

**Impact:** Silent data loss. Admin dashboard shows incomplete information.

**Fix hint:** Use a strict schema validator (zod) that fails loudly if required fields are missing. This ensures the client and backend stay in sync.

---

## AA-API-017: Untyped Socket.io Events

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/socket.ts` (lines 37-39)

**Category:** Type Safety

**Description:** Socket.io events (e.g., `'order:created'`) are not typed. If the backend sends a different event structure, the client will not catch the error.

**Impact:** Runtime errors when socket events arrive with unexpected shapes.

**Fix hint:** Define strict types for all socket events: `interface OrderCreatedEvent { orderId: string; merchantName: string; amount: number }`. Validate incoming data at deserialization.

---

## AA-API-018: Missing Mutual TLS for Admin APIs

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** API Security

**Description:** The admin API client does not use mutual TLS (mTLS). Only the server is authenticated; the client is not.

**Impact:** An attacker with network access can impersonate the admin client.

**Fix hint:** Generate client certificates and configure the HTTP client to use mTLS. This is especially important for admin-only APIs.

---

## AA-API-019: No Query String Sanitization

**Severity:** MEDIUM

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts` (lines 318-326)

**Category:** Input Validation

**Description:** Query parameters like `status`, `page`, `limit` are passed directly to the Axios `params` object. No validation that they match expected values.

**Impact:** If an attacker passes `status: "INVALID_STATUS"`, the backend may return an error or unexpected results.

**Fix hint:** Validate query parameters against a whitelist. Use TypeScript enums to enforce valid values at compile time.

---

## AA-API-020: Missing API Response Decompression

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** Performance

**Description:** The client does not request gzip compression for responses. Axios handles decompression automatically, but the client could optimize by explicitly setting Accept-Encoding.

**Impact:** Slightly larger response sizes for large exports.

**Fix hint:** Add `Accept-Encoding: gzip` header to requests. Ensure the server is configured to gzip responses.

---

## AA-API-021: No API Documentation Versioning

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/karmaAdmin.ts`

**Category:** API Design

**Description:** The service definitions lack comments documenting the API contract (required fields, response codes, error messages). Future changes may break the client silently.

**Impact:** Maintenance burden. Difficult to update APIs without breaking the client.

**Fix hint:** Add JSDoc comments to all service methods. Document the API contract (request/response schemas, error codes).

---

## AA-API-022: Missing Etag / Cache-Control Headers

**Severity:** LOW

**File:** `/sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezadmin/app/services/api/apiClient.ts`

**Category:** API Design

**Description:** The client does not leverage HTTP caching headers (ETag, Cache-Control). Every request is sent to the backend even if the data hasn't changed.

**Impact:** Wasted bandwidth, slower performance.

**Fix hint:** Configure Axios to support HTTP caching. The server should include Cache-Control and ETag headers in responses.

