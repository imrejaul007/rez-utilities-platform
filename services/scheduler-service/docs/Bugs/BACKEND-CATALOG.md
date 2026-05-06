# Catalog Service Backend Bugs

## BE-CAT-001 Missing Error Handler Middleware Chain
**Severity:** HIGH
**File:** `src/httpServer.ts:426-429`

> **Status:** Fixed in commit TBD (2026-04-15)
**Category:** Error Handling
**Description:** The global error handler is defined but catch blocks in routes call `next(err)` without proper error transformation. Errors thrown in route handlers bubble up unformatted, causing inconsistent error responses and potentially leaking stack traces in logs.
**Impact:** Inconsistent error response format across endpoints, potential information disclosure of internal server structure, debugging difficulty for clients.
**Fix hint:** Add a custom error class extending Error and transform all catch blocks to throw structured errors that the global handler can process uniformly.

---

## BE-CAT-002 Missing Input Validation on Pagination Parameters
**Severity:** MEDIUM
**File:** `src/httpServer.ts:115-116`
**Category:** Validation
**Description:** `Math.min` and `Math.max` are applied to string values after `parseInt`, but if `parseInt` fails (returns NaN), the Math functions pass NaN through unchanged, resulting in invalid queries.
**Impact:** Invalid pagination queries with NaN values cause MongoDB errors or unexpected result sets, degraded UX.
**Fix hint:** Validate `parseInt` result with `Number.isFinite()` before passing to Math functions.

---

## BE-CAT-003 Unvalidated ObjectId Conversion in List Products Merchant
**Severity:** MEDIUM
**File:** `src/httpServer.ts:171-203`
**Category:** Input Validation
**Description:** The `/products/merchant/:merchantId` endpoint directly uses `String(req.params['merchantId'])` without validating it is a valid ObjectId. If the caller passes an invalid ID, the MongoDB query succeeds (returning empty) instead of failing fast with 400.
**Impact:** Silent failures, unclear error reporting, potential for malformed queries propagating through logs.
**Fix hint:** Add `if (!mongoose.isValidObjectId(merchantId)) return res.status(400).json(...)` before querying.

---

## BE-CAT-004 Missing Ownership Validation on Product Delete
**Severity:** CRITICAL
**File:** `src/httpServer.ts:305-333`

> **Status:** Fixed in commit TBD (2026-04-15)
**Category:** Authorization
**Description:** The DELETE `/products/:id` endpoint accepts merchantId as a query parameter instead of deriving it from the authenticated request context. A caller can forge `?merchantId=other-id` to soft-delete products owned by another merchant.
**Impact:** Cross-merchant product deletion, severe tenant isolation violation, data loss.
**Fix hint:** Pass merchantId from authenticated token (req.merchantId or header) instead of accepting it as a query parameter. Enforce ownership check at the MongoDB level with `{ _id, merchantId: authenticatedMerchantId }`.

---

## BE-CAT-005 Inconsistent Model Import Pattern Creates Memory Leak Risk
**Severity:** LOW
**File:** `src/models/Product.ts:18-20, src/models/Category.ts:17-19`
**Category:** Code Quality
**Description:** Models use a check `mongoose.models['CatalogService_Product']` to avoid re-registering, but if the same file is required multiple times, Mongoose's internal caching may cause stale references if the module is cleared between imports.
**Impact:** Rare connection pool exhaustion in development, confusion with model re-registration in tests.
**Fix hint:** Use a consistent pattern: `export const Product = mongoose.model<IProduct>('CatalogService_Product', ProductSchema);` without the ternary check (Mongoose handles deduplication internally).

---

## BE-CAT-006 No Rate Limiting on Catalog Endpoints
**Severity:** MEDIUM
**File:** `src/httpServer.ts`
**Category:** Security
**Description:** Catalog endpoints (GET /products, GET /categories, GET /featured) have no rate limiting. A malicious actor can issue unlimited requests to enumerate the catalog or perform DoS attacks.
**Impact:** Resource exhaustion, potential DoS vulnerability, unmetered data export.
**Fix hint:** Add express-rate-limit middleware with per-IP thresholds (e.g., 100 requests/minute for public endpoints, stricter for merchant endpoints).

---

## BE-CAT-007 Missing Search Input Sanitization in Featured Products
**Severity:** MEDIUM
**File:** `src/httpServer.ts:71-109`
**Category:** Input Validation
**Description:** While the `/products` endpoint has `escapeRegex()`, the `/products/featured` endpoint does not use search input at all. If a future implementation adds search to featured products without escaping, ReDoS attacks are possible.
**Impact:** Potential ReDoS vulnerability if search feature is added.
**Fix hint:** Add a pre-check to reject dangerously complex search strings or enforce escapeRegex() universally.

---

## BE-CAT-008 Regex Escape Function Not Imported But Used in Two Locations
**Severity:** LOW
**File:** `src/httpServer.ts:38-40, 142-143, 182-183, 385`
**Category:** Code Quality
**Description:** `escapeRegex()` is defined in the same file and used in multiple places. The function is correct, but there is no test coverage or documentation that it must remain synchronized with MongoDB regex injection patterns.
**Impact:** If escapeRegex() is modified incorrectly, all regex queries become vulnerable to ReDoS.
**Fix hint:** Extract to a shared utility module (src/utils/sanitize.ts), add unit tests, and document the function's security requirements.

---

## BE-CAT-009 Category Detail Endpoint Missing 404 Status Code
**Severity:** LOW
**File:** `src/httpServer.ts:373-418`
**Category:** HTTP Semantics
**Description:** The `/categories/:categoryId/products` endpoint returns `404 Not Found` for missing categories, but the error response is not checked for consistency. Some 404 handlers return `{ success: false }` while others omit this field.
**Impact:** Inconsistent API contract, client parsing errors.
**Fix hint:** Standardize all 404 responses to include `{ success: false, message: '...' }`.

---

## BE-CAT-010 Worker Job Failure Logging Missing Job Details
**Severity:** MEDIUM
**File:** `src/worker.ts:116-122`
**Category:** Observability
**Description:** Job failure handler logs `job?.name` which may be undefined. If a job has no name set, the log is incomplete, making it hard to debug failures.
**Impact:** Incomplete logs, difficult troubleshooting, silent failures in job processing.
**Fix hint:** Log `job?.id` and `event.eventType` (from unpacked payload) instead of `job?.name`.

---

## BE-CAT-011 Redis Connection Error Recovery Not Implemented for Worker
**Severity:** MEDIUM
**File:** `src/worker.ts:125-127`
**Category:** Resilience
**Description:** The worker has an error handler but no automatic reconnection logic. If Redis drops, the worker logs the error and continues, potentially losing jobs in flight.
**Impact:** Silent job loss, undelivered catalog updates, cache invalidation failures.
**Fix hint:** Implement exponential backoff reconnection or restart the worker on critical Redis errors.

---

## BE-CAT-012 Worker Concurrency Hardcoded
**Severity:** LOW
**File:** `src/worker.ts:111-113`
**Category:** Configuration
**Description:** Worker concurrency is hardcoded to 10 with a limiter of 200 req/s. This is not configurable via environment variables, making it impossible to tune for different deployment sizes without code changes.
**Impact:** Suboptimal performance in high-load or low-load deployments.
**Fix hint:** Read `WORKER_CONCURRENCY` and `WORKER_RATE_LIMIT` from env with sensible defaults.

---

## BE-CAT-013 HMAC Initialization Happens Every Request
**Severity:** LOW
**File:** `src/middleware/internalAuth.ts:4`

> **Status:** Fixed in commit TBD (2026-04-15) — CRITICAL severity fix
**Category:** Performance
**Description:** `HMAC_SECRET` is generated with `crypto.randomBytes(32)` at module load time, but this is non-deterministic. Every request that calls `hmac()` will produce different hashes for the same input (because the secret is random). The middleware then tries to compare these random hashes, which will always fail unless the token matches exactly.
**Impact:** Internal token authentication will fail unpredictably; the feature is effectively broken due to non-deterministic secret generation.
**Fix hint:** Either (1) read HMAC_SECRET from a stable environment variable, or (2) remove the HMAC layer and compare tokens directly with timing-safe comparison.

---

## BE-CAT-014 Missing req.merchantId Assertion in Product Creation
**Severity:** CRITICAL
**File:** `src/httpServer.ts:207-246`

> **Status:** Fixed in commit TBD (2026-04-15)
**Category:** Authorization
**Description:** POST `/products` accepts merchantId in the request body without validating it against the authenticated context. A user can create products for any merchantId, bypassing tenant isolation.
**Impact:** Cross-merchant product injection, severe data pollution.
**Fix hint:** Enforce `merchantId` to match the authenticated request context. Extract from middleware-set req.merchantId or internalAuth header, not from req.body.

---

## BE-CAT-015 Category Filter Missing ObjectId Validation
**Severity:** MEDIUM
**File:** `src/httpServer.ts:130-137`
**Category:** Input Validation
**Description:** The `category` query parameter is not validated with `mongoose.isValidObjectId()`. Invalid IDs are passed to MongoDB unchanged, potentially causing errors or unexpected query behavior.
**Impact:** Invalid queries, degraded UX, potential for subtle bugs in filtering.
**Fix hint:** Add ObjectId validation for category parameter before using in query.

---

## BE-CAT-016 Missing Index on Featured Products Filter
**Severity:** MEDIUM
**File:** `src/models/Product.ts:14-16`
**Category:** Database Performance
**Description:** The featured products endpoint queries `{ isFeatured: true, isActive: true }` but the schema only has an index on `{ 'isFeatured': 1, 'isActive': 1 }`. For high-volume catalogs, this could result in full collection scans.
**Impact:** Slow featured product queries, potential performance degradation at scale.
**Fix hint:** Verify the index is properly defined and covers the sort field (viewCount).

---

## BE-CAT-017 No Validation for Stock Delta in Events
**Severity:** MEDIUM
**File:** `src/worker.ts:73-88`
**Category:** Data Validation
**Description:** The low-stock alert checks `event.payload.newStock <= threshold` without validating that `newStock` is a non-negative number. Negative stock could trigger false alerts.
**Impact:** False low-stock alerts, potential for inventory monitoring confusion.
**Fix hint:** Validate `typeof newStock === 'number' && newStock >= 0` before threshold comparison.

---

## BE-CAT-018 Product Update Missing Sorting Field Validation
**Severity:** LOW
**File:** `src/httpServer.ts:275-280`
**Category:** Data Validation
**Description:** The `sortOrder` field is in the ALLOWED_FIELDS list for updates but no validation ensures it is a non-negative number. Invalid values could cause sorting bugs.
**Impact:** Unpredictable product ordering in category views.
**Fix hint:** Add validation: `if (fields.sortOrder !== undefined && typeof fields.sortOrder !== 'number') return res.status(400)...`.

---

## BE-CAT-019 Cache Invalidation Race Condition
**Severity:** MEDIUM
**File:** `src/worker.ts:56-67`
**Category:** Concurrency
**Description:** Multiple cache invalidation keys are deleted sequentially in a for loop. If a product update and a category update fire simultaneously, the cache invalidation ordering is non-deterministic, leading to stale cache hits.
**Impact:** Stale product/category data served to clients after updates.
**Fix hint:** Use Redis MSET or Pipeline to delete all keys atomically in a single transaction.

---

## BE-CAT-020 No Content-Type Validation on Product Updates
**Severity:** LOW
**File:** `src/httpServer.ts:250`
**Category:** Input Validation
**Description:** PATCH `/products/:id` does not validate that the request body is valid JSON. If malformed JSON is sent, the error response may leak internal Mongoose error details.
**Impact:** Information disclosure, potential parsing errors.
**Fix hint:** Rely on express.json() error handler, but log sanitized error messages without schema details.

---

## BE-CAT-021 Missing Validation on Category Slug in Product Lookup
**Severity:** MEDIUM
**File:** `src/httpServer.ts:381-385`
**Category:** Input Validation
**Description:** When a categoryId is a slug (not ObjectId), the code calls `escapeRegex(categoryId)` but does not validate that the slug contains only valid characters. A malicious slug with backslashes could still cause ReDoS if escapeRegex() is ever modified.
**Impact:** Potential ReDoS vulnerability if escapeRegex() implementation changes.
**Fix hint:** Whitelist valid slug characters: `[a-z0-9-]` before using in regex.

---

## BE-CAT-022 Pagination Limit Not Applied to Aggregate Operations
**Severity:** MEDIUM
**File:** (Potential in analytics or aggregation routes not shown but common pattern)
**Category:** Resource Management
**Description:** While aggregate endpoints enforce a 100-limit on find(), if aggregation pipelines are added, they may not enforce limits, allowing unbounded result sets.
**Impact:** Memory exhaustion, potential OOM for large aggregations.
**Fix hint:** Enforce `$limit` stage in all aggregation pipelines.

---

## BE-CAT-023 Missing Timezone Handling in Date Filters
**Severity:** MEDIUM
**File:** `src/httpServer.ts:69-72`
**Category:** Data Handling
**Description:** The featured products endpoint accepts `lat` and `lng` but does not validate them are valid numbers in the correct range (-90 to 90 for latitude, -180 to 180 for longitude). Invalid coordinates could cause geospatial query failures.
**Impact:** Silent filtering failures, incorrect product recommendations.
**Fix hint:** Add validation: `if (lat && (lat < -90 || lat > 90)) return res.status(400)...`.

---

## BE-CAT-024 Status Code Inconsistency on Product Creation
**Severity:** LOW
**File:** `src/httpServer.ts:238`
**Category:** HTTP Semantics
**Description:** Product creation returns `201 Created` with productId, but does not include Location header per REST standards.
**Impact:** Minor API contract violation, clients cannot follow the Location header to the created resource.
**Fix hint:** Add `res.location(\`/products/${result.insertedId}\`)` before the JSON response.

---

## BE-CAT-025 No Audit Trail for Product Deletions
**Severity:** MEDIUM
**File:** `src/httpServer.ts:305-333`
**Category:** Compliance
**Description:** Soft-delete operations log nothing. Regulatory requirements may mandate audit trails for data modifications, especially in financial/commerce contexts.
**Impact:** Compliance violations, inability to audit who deleted what and when.
**Fix hint:** Emit an event to an audit log queue (BullMQ) with user ID, timestamp, and product details.

---

## BE-CAT-026 Missing Max Retry Configuration on Worker
**Severity:** LOW
**File:** `src/worker.ts:42-114`
**Category:** Resilience
**Description:** The worker is created without specifying `defaultJobOptions.attempts` or `defaultJobOptions.backoff`, so failed jobs use BullMQ defaults. Unclear what the retry behavior is.
**Impact:** Unpredictable job retry behavior, potential for either excessive retries or premature abandonment.
**Fix hint:** Explicitly set `defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 2000 } }`.

---

## BE-CAT-027 Unescaped Category ID in Regex
**Severity:** MEDIUM
**File:** `src/httpServer.ts:385`
**Category:** Input Validation
**Description:** When categoryId is treated as a slug in the products-by-category route, the slug is escaped but there's no whitelist check that it contains only valid slug characters. If the escape function is ever bypassed, ReDoS becomes possible.
**Impact:** Potential ReDoS vulnerability if escapeRegex() is ever modified or if a variant code path is added.
**Fix hint:** Validate slug format with regex `/^[a-z0-9\-]+$/i` before proceeding.

---

## BE-CAT-028 Missing Query Timeout Protection
**Severity:** MEDIUM
**File:** `src/httpServer.ts`
**Category:** Performance
**Description:** MongoDB queries in the catalog service have no timeout specified. A complex find with deep population could hang indefinitely.
**Impact:** Resource exhaustion, hanging requests, potential cascade failures.
**Fix hint:** Set `maxTimeMS` on find queries: `.find(...).maxTimeMS(5000)`.
