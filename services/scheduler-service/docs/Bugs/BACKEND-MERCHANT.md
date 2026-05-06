# Merchant Service Backend Bugs

## BE-MER-001 HMAC Secret Regenerated on Every Request
**Severity:** CRITICAL
**File:** `src/middleware/internalAuth.ts:4` (shared with catalog)

> **Status:** Not found in merchant service — issue was in catalog service only (fixed)
**Category:** Authentication
**Description:** `HMAC_SECRET = crypto.randomBytes(32)` generates a random secret at module load. Every request hashes the token against this random secret, making token comparison non-deterministic. Authentication will fail randomly.
**Impact:** Internal service authentication is broken; all inter-service calls fail sporadically. Cascading auth failures across services.
**Fix hint:** Initialize HMAC_SECRET from a stable environment variable (INTERNAL_AUTH_SECRET) that is shared across all services.

---

## BE-MER-002 Missing Merchant ID Validation in Profile Update
**Severity:** CRITICAL
**File:** `src/routes/merchants.ts:22-31`

> **Status:** Fixed in commit TBD (2026-04-15)
**Category:** Authorization
**Description:** The PUT `/profile` route accepts fields from `req.body` without restricting writes to sensitive fields like `isVerified`, `subscription`, `accountLockedUntil`. A merchant can bypass verification by sending `{ isVerified: true }` in the request.
**Impact:** Merchants can self-verify their accounts, bypass KYC requirements, escalate privileges. Severe compliance violation.
**Fix hint:** Use an explicit whitelist of editable fields: `const EDITABLE = ['businessName', 'phone', 'website', ...]`. Filter `req.body` through this list before update.

---

## BE-MER-003 Bank Details Stored Unencrypted in Profile Update
**Severity:** CRITICAL
**File:** `src/routes/merchants.ts:22-31`

> **Status:** Fixed in commit TBD (2026-04-15) — removed bankDetails from editable fields
**Category:** Data Protection
**Description:** The profile update route allows `bankDetails` in the MERCHANT_PROFILE_EDITABLE_FIELDS whitelist (line 18), but it uses direct assignment (`$set: update`). The schema has encryption pre-hooks, but if the field name doesn't match exactly what the pre-hook expects (`onboarding.stepData.bankDetails`), encryption is skipped and plaintext bank details are stored.
**Impact:** Bank account information stored in plaintext in MongoDB, massive PII leak, regulatory violation (RBI, GDPR).
**Fix hint:** Either (1) exclude `bankDetails` from the whitelist entirely, or (2) ensure the update path matches the schema path with proper nesting.

---

## BE-MER-004 Onboarding Status Can Be Bypassed
**Severity:** HIGH
**File:** `src/routes/onboarding.ts:20-37`

> **Status:** Fixed in commit TBD (2026-04-15)
**Category:** Business Logic
**Description:** The PUT `/onboarding/profile` route allows setting arbitrary fields including those that track KYC completion (e.g., `documents` field). A merchant can claim they've uploaded documents without actually uploading them.
**Impact:** Merchants can bypass KYC/onboarding steps, potentially fraudulent merchant accounts activate.
**Fix hint:** Separate the routes: one for step-data updates (with validation per step), one for progress tracking (admin-only). Validate document URLs are actually accessible.

---

## BE-MER-005 Missing Rate Limiting on Authentication Endpoints
**Severity:** HIGH
**File:** `src/routes/auth.ts` (not shown but auth endpoints exist)

> **Status:** Not a bug — rate limiting already present (loginLimiter)
**Category:** Security
**Description:** No rate limiting on login, password reset, or email verification endpoints. Attackers can brute-force merchant accounts or spam password reset emails.
**Impact:** Account takeover via brute-force, email/SMS exhaustion, DoS via credential stuffing.
**Fix hint:** Add express-rate-limit with per-email thresholds: 5 login attempts per minute, 3 reset emails per hour.

---

## BE-MER-006 JWT Secret Name Mismatch in Validation
**Severity:** HIGH
**File:** `src/index.ts:60-65`

> **Status:** Not a bug — JWT_MERCHANT_SECRET validation is already properly implemented
**Category:** Configuration
**Description:** The validation checks `JWT_MERCHANT_SECRET` (correct), but if someone deploys with only `JWT_SECRET`, the validation passes but auth.ts reads `JWT_MERCHANT_SECRET` (which is undefined), causing all auth requests to fail with 500.
**Impact:** Silent auth failures in production, users locked out, potential cascading service failure.
**Fix hint:** Also check for the legacy `JWT_SECRET` and copy it to `JWT_MERCHANT_SECRET` if `JWT_MERCHANT_SECRET` is not set, with a warning log.

---

## BE-MER-007 No Validation on Payout Amount
**Severity:** MEDIUM
**File:** `src/routes/payouts.ts:31-49`
**Category:** Business Logic
**Description:** Payout creation validates `amount > 0`, but does not check for upper bounds or decimal precision. A merchant could request a payout for `999999999999.99` or a value with too many decimal places.
**Impact:** Invalid payout requests, potential for rounding errors in financial calculations, fraud.
**Fix hint:** Add validation: `amount > 0 && amount <= 999999999 && Number.isFinite(amount)` and enforce 2 decimal places.

---

## BE-MER-008 Payout Soft-Delete Not Implemented
**Severity:** MEDIUM
**File:** `src/routes/payouts.ts:65-72`
**Category:** Data Integrity
**Description:** Payouts can be hard-deleted with `.findOneAndDelete()`. If a payout is deleted, there's no audit trail, and it disappears from financial records, violating compliance requirements.
**Impact:** Compliance violation, inability to audit payout history, potential fraud.
**Fix hint:** Implement soft-delete: set `status: 'cancelled'` and `deletedAt: new Date()`, do not hard-delete.

---

## BE-MER-009 Missing Merchant Ownership Check in Payout Delete
**Severity:** MEDIUM
**File:** `src/routes/payouts.ts:65-72`
**Category:** Authorization
**Description:** The delete operation checks `merchantId` in the query filter, but does not verify that the authenticated merchant matches the payout's merchantId. If merchant auth is compromised, any payout can be deleted.
**Impact:** Cross-merchant payout manipulation, financial data loss.
**Fix hint:** Enforce merchantId from authenticated request context: `{ _id, merchantId: req.merchantId, status: 'pending' }`.

---

## BE-MER-010 Onboarding Bank Details Update Missing Field Validation
**Severity:** HIGH
**File:** `src/routes/onboarding.ts:46-58`

> **Status:** Fixed in commit TBD (2026-04-15)
**Category:** Validation
**Description:** Bank details are accepted without format validation. IFSC codes and account numbers are simply stored as-is without checking they're valid formats. The encryption is applied, but garbage data is still persisted.
**Impact:** Invalid bank account data, failed payouts, compliance issues.
**Fix hint:** Add IFSC format validation (11 alphanumeric), account number length check (8-18 digits), account holder name check (alphabetic + spaces).

---

## BE-MER-011 No Encryption Key Rotation Strategy
**Severity:** MEDIUM
**File:** `src/utils/encryption.ts:27-38`
**Category:** Security
**Description:** Encryption key is read once from the environment and never rotated. If the key is compromised, all encrypted data becomes readable indefinitely.
**Impact:** Long-term data exposure if key is leaked, no key rotation capability.
**Fix hint:** Implement key versioning: store key version with ciphertext, support multiple keys during rotation periods.

---

## BE-MER-012 Missing Authentication Context in Team Routes
**Severity:** HIGH
**File:** `src/routes/team.ts:139`

> **Status:** Fixed in commit TBD (2026-04-15)
**Category:** Authorization
**Description:** Public team routes (lines 103-136) validate invitation tokens but do not enforce that the caller is the invited user. An attacker could accept an invitation on behalf of someone else by extracting the token from a URL.
**Impact:** Account hijacking, unauthorized team member addition.
**Fix hint:** Require the caller to provide their password or use a password hash from the invitation email to prove identity.

---

## BE-MER-013 Team Member Password Hash Not Validated on Invite Accept
**Severity:** MEDIUM
**File:** `src/routes/team.ts:117-136`

> **Status:** Fixed in commit TBD (2026-04-15) — added password complexity validation
**Category:** Security
**Description:** The accept-invitation endpoint checks token expiry but does not verify that the provided password meets security requirements (min length, complexity).
**Impact:** Weak passwords on invited team accounts, security risk.
**Fix hint:** Add password validation: min 12 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special char.

---

## BE-MER-014 Missing Pagination Bounds in Team Listing
**Severity:** MEDIUM
**File:** `src/routes/team.ts:142-150`
**Category:** Resource Management
**Description:** Team listing uses `Math.min(50, parseInt(...) || 1)` but does not handle NaN or negative values from parseInt.
**Impact:** Invalid pagination, potential for bypass of limit checks.
**Fix hint:** Validate `Number.isFinite(limit) && limit > 0` before using.

---

## BE-MER-015 Store Merchant Field Not Consistently Used
**Severity:** HIGH
**File:** `src/routes/stores.ts:26, 43, 57, 83, 100, 115, 130, 145`

> **Status:** Not a bug — ownershipFilter helper already handles both field names correctly
**Category:** Data Consistency
**Description:** The code uses `$or: [{ merchant: merchantId }, { merchantId: merchantId }]` throughout, indicating two different field names are used. This works for backward compatibility but obscures the actual schema, making bugs harder to spot.
**Impact:** Confusion during maintenance, risk of introducing field-name bugs in future changes.
**Fix hint:** Normalize: add a migration to standardize all stores to use `merchant` (not `merchantId`), then remove the `$or` branches.

---

## BE-MER-016 Implicit Store Activation on Creation
**Severity:** MEDIUM
**File:** `src/routes/stores.ts:67-74`
**Category:** Business Logic
**Description:** Creating a store does not explicitly set `isActive: true` or `isListed: true`. If schema defaults do not apply, the store may be created in an inactive state, confusing the merchant.
**Impact:** Newly created stores may not appear in listings, poor UX.
**Fix hint:** Explicitly set defaults in the create handler: `new Store({ ...pickStoreFields(req.body), merchant: req.merchantId, isActive: true, isListed: true })`.

---

## BE-MER-017 Missing Cache Invalidation on Store Updates
**Severity:** MEDIUM
**File:** `src/routes/stores.ts:77-92, 95-109`
**Category:** Caching
**Description:** Store updates do not call `cacheDel()`. Cached product lists or analytics may continue to show stale store info.
**Impact:** Stale store information served to customers, inconsistent UX.
**Fix hint:** After store update, call `await cacheDel(\`stores:${req.merchantId}:*\`)`.

---

## BE-MER-018 Discount Code Allows Reserved Characters
**Severity:** LOW
**File:** `src/routes/discounts.ts:8-21`
**Category:** Validation
**Description:** Discount codes are accepted as-is without validation. A code with spaces, special characters, or unicode could break downstream systems.
**Impact:** Invalid discount codes, system errors during redemption.
**Fix hint:** Validate code: `code.match(/^[A-Z0-9\-]{3,20}$/)`.

---

## BE-MER-019 Discount Deletion Not Soft-Delete
**Severity:** MEDIUM
**File:** `src/routes/discounts.ts:63-69`
**Category:** Compliance
**Description:** Discounts are hard-deleted with `.findOneAndDelete()`. Audit trails are lost, and historical data cannot be accessed.
**Impact:** Compliance violation, inability to audit discount usage, fraud.
**Fix hint:** Implement soft-delete: set `status: 'inactive'` and `deletedAt`, do not hard-delete.

---

## BE-MER-020 Missing Discount Usage Limit Enforcement
**Severity:** MEDIUM
**File:** `src/routes/discounts.ts:8-21`
**Category:** Business Logic
**Description:** Discounts have `usageLimit` and `perUserLimit` fields in DISCOUNT_ALLOWED_FIELDS, but the route does not enforce these. A discount can be used unlimited times.
**Impact:** Revenue loss, abuse of discounts.
**Fix hint:** Before accepting a discount at redemption time, check usage counts against limits.

---

## BE-MER-021 Product Bulk Import No Duplicate SKU Check
**Severity:** MEDIUM
**File:** `src/routes/bulkImport.ts:10-26`
**Category:** Data Validation
**Description:** Bulk import accepts multiple products and inserts them all at once without checking for duplicate SKUs within the batch or against existing products.
**Impact:** Duplicate SKUs in the catalog, inventory confusion, inconsistent product references.
**Fix hint:** Before `insertMany()`, validate that all SKUs in the batch are unique and do not already exist: `await Product.find({ sku: { $in: skus }, store: storeId })`.

---

## BE-MER-022 Bulk Import Size Limit But No Individual Field Size Validation
**Severity:** MEDIUM
**File:** `src/routes/bulkImport.ts:14`
**Category:** Input Validation
**Description:** The route enforces max 200 products, but does not validate individual field sizes. A merchant could submit a product with a 10MB description, overwhelming MongoDB.
**Impact:** MongoDB document size limits hit, insertion failures, service degradation.
**Fix hint:** Validate each product field: `name <= 200 chars`, `description <= 2000 chars`, `images.length <= 20`.

---

## BE-MER-023 Missing Merchant Status Check in Orders Query
**Severity:** MEDIUM
**File:** `src/routes/orders.ts:21-102`
**Category:** Authorization
**Description:** Order listing does not verify that the merchant's account is still active or not suspended. A suspended merchant can still query their orders, potentially accessing sensitive data.
**Impact:** Suspended merchants retain data access rights, compliance issue.
**Fix hint:** Add a check in the auth middleware or at the start of the route: if merchant is suspended, return 403 Forbidden.

---

## BE-MER-024 Date Filter Accepts Invalid Date Strings
**Severity:** MEDIUM
**File:** `src/routes/orders.ts:69-72`
**Category:** Input Validation
**Description:** `dateFrom` and `dateTo` are parsed with `new Date(dateFrom)` without validation. Invalid ISO strings or typos produce Invalid Date objects that fail silently in MongoDB queries.
**Impact:** Date filtering doesn't work, returns unexpected results, poor UX.
**Fix hint:** Validate dates with `new Date(dateFrom).toISOString()` and check that result is valid before using.

---

## BE-MER-025 Missing Index on Orders Merchant Query
**Severity:** MEDIUM
**File:** `src/models/Order.ts` (not shown but likely missing)
**Category:** Database Performance
**Description:** Orders are queried by `store: { $in: storeIds }` for merchant queries. If no index exists on the `store` field, this becomes a collection scan.
**Impact:** Slow order queries, potential performance degradation, scalability issues.
**Fix hint:** Ensure Order schema has `index({ store: 1 })` and `index({ store: 1, createdAt: -1 })`.

---

## BE-MER-026 Campaign Rules Missing Timezone Validation
**Severity:** MEDIUM
**File:** `src/routes/campaigns.ts:8-23`
**Category:** Business Logic
**Description:** Campaign `startDate` and `endDate` are accepted as strings without timezone handling. A campaign scheduled for "2025-12-25 00:00" could fire at the wrong time depending on server timezone.
**Impact:** Campaigns fire at wrong times, missed business opportunities, customer confusion.
**Fix hint:** Enforce ISO 8601 format with explicit timezone: `startDate: "2025-12-25T00:00:00Z"`. Validate with `new Date(dateString)`.

---

## BE-MER-027 Product Variants Validation Missing
**Severity:** MEDIUM
**File:** `src/routes/products.ts:49-59`
**Category:** Validation
**Description:** Variant allowed fields include `price`, `stock`, etc., but no validation ensures these are numeric or non-negative.
**Impact:** Invalid variants, inventory confusion, financial errors.
**Fix hint:** Validate each variant: `variant.price >= 0`, `variant.stock >= 0`, `typeof variant.price === 'number'`.

---

## BE-MER-028 Missing SKU Uniqueness Constraint Across Merchants
**Severity:** MEDIUM
**File:** `src/routes/products.ts:141-149`
**Category:** Database Integrity
**Description:** SKU validation endpoint checks uniqueness per store, but MongoDB schema may not enforce this at the index level, allowing duplicates to exist.
**Impact:** Inventory confusion, duplicate product issues, reporting errors.
**Fix hint:** Add unique index on Product schema: `index({ store: 1, sku: 1 }, { unique: true })`.

---

## BE-MER-029 Merchant Status Cache TTL Too Long
**Severity:** MEDIUM
**File:** `src/middleware/auth.ts:93`
**Category:** Compliance
**Description:** Merchant status is cached for 5 minutes. If a merchant account is suspended by an admin, up to 5 minutes elapse before the suspension takes effect for existing JWT holders.
**Impact:** Grace period for suspended accounts, potential abuse, compliance violation.
**Fix hint:** Reduce TTL to 30 seconds or implement real-time invalidation via Redis pub/sub.

---

## BE-MER-030 Encryption Error Handling Swallows Decryption Failures
**Severity:** MEDIUM
**File:** `src/utils/encryption.ts:87-112`
**Category:** Error Handling
**Description:** `decrypt()` catches all errors and returns an empty string. If an encrypted value is corrupted, callers don't know it failed and may proceed with empty data.
**Impact:** Silent data loss, corrupted encrypted fields treated as valid.
**Fix hint:** Either throw on decryption failure (let caller handle) or return `null` so callers can distinguish between "empty" and "failed to decrypt".

---

## BE-MER-031 Missing Validation for MerchantUser Invitation TTL
**Severity:** LOW
**File:** `src/routes/team.ts:103-114`
**Category:** Configuration
**Description:** Invitation tokens use `inviteExpiry: { $gt: new Date() }` but there's no validation of how long the expiry window is set when invites are created.
**Impact:** If invitations don't set an expiry, they never expire, security risk.
**Fix hint:** In the create-invitation route (not shown), enforce: `const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)`.

---

## BE-MER-032 Redundant Updatedby Field in Bulk Operations
**Severity:** LOW
**File:** `src/routes/discounts.ts:56`, `campaigns.ts:58, 72`
**Category:** Code Quality
**Description:** Routes manually set `updatedAt: new Date()` before calling `.findOneAndUpdate()`, but if the schema has `timestamps: true`, this field is already auto-set.
**Impact:** Redundant code, potential for inconsistency if manual setting is missed on some routes.
**Fix hint:** Rely on schema timestamps: true; remove manual `updatedAt` assignment.

---

## BE-MER-033 Missing Pagination Validation in Multiple Routes
**Severity:** MEDIUM
**File:** `src/routes/orders.ts:24-25`, `products.ts:65-66`, `discounts.ts:28-29`, `campaigns.ts:30-31`
**Category:** Input Validation
**Description:** Multiple routes parse page/limit with `parseInt(...) || 1` but do not validate the result is a positive integer. NaN or negative values could slip through.
**Impact:** Invalid pagination, unpredictable query behavior.
**Fix hint:** Create a shared pagination validation function: `function validatePagination(page, limit) { const p = parseInt(page, 10); const l = parseInt(limit, 10); if (!Number.isFinite(p) || !Number.isFinite(l) || p < 1 || l < 1) throw new Error('Invalid pagination'); return { page: p, limit: l }; }`.

---

## BE-MER-034 Redis Cache Errors Silently Fail
**Severity:** MEDIUM
**File:** `src/config/redis.ts:26-47`
**Category:** Observability
**Description:** All cache functions have empty catch blocks `catch { return null; }` or `catch {}`. If Redis is down, callers don't know and serve potentially stale data indefinitely.
**Impact:** Silent cache failures, stale data served, no alerting.
**Fix hint:** Log cache errors: `catch (err) { logger.warn('[Cache Error]', err.message); return null; }`.

---

## BE-MER-035 Product Cache Key Includes All Query Parameters
**Severity:** MEDIUM
**File:** `src/routes/products.ts:77`
**Category:** Performance
**Description:** Cache key includes `search`, `status`, `stockLevel`, `sortBy` — if any change, a new cache entry is created. With 10+ parameters, cache hit rate is very low.
**Impact:** Poor cache efficiency, high Redis memory usage, slow queries.
**Fix hint:** Normalize cache key: only include the most stable parameters (merchantId, storeId, page), and apply client-side filtering for other params.

---

## BE-MER-036 No Rate Limiting on Bulk Import
**Severity:** HIGH
**File:** `src/routes/bulkImport.ts:10-26`

> **Status:** Fixed in commit TBD (2026-04-15)
**Category:** Security
**Description:** Bulk import allows 200 products per request with no rate limiting. A merchant could upload 200 products every second, overwhelming the system.
**Impact:** Resource exhaustion, DoS via legitimate API, service degradation.
**Fix hint:** Add rate limit: 1 request per 10 seconds per merchant, or 500 products per hour per store.

---

## BE-MER-037 Missing SQL Injection Protection in Order Analytics
**Severity:** MEDIUM
**File:** `src/routes/orders.ts:105-150`
**Category:** Security
**Description:** Order analytics query builds a filter from `dateFrom` and `dateTo` without validation. While MongoDB is not SQL, improper date parsing could cause injection-like behavior.
**Impact:** Unexpected aggregation results, potential data leakage.
**Fix hint:** Validate dates as ISO 8601 strings and convert to Date before using in $match.

---

## BE-MER-038 Merchant Model Fields Not Encrypted
**Severity:** MEDIUM
**File:** `src/models/Merchant.ts:70-80`
**Category:** Data Protection
**Description:** Multiple fields like `website`, `description`, `logo` could contain sensitive info but are not encrypted. If MongoDB is compromised, this data is readable.
**Impact:** PII exposure, reputation damage.
**Fix hint:** Review which fields need encryption (taxId, businessAddress) and add pre-save hooks similar to bankDetails encryption.

---

## BE-MER-039 Missing Endpoint for Listing Merchant User Roles
**Severity:** LOW
**File:** `src/routes/team.ts`
**Category:** API Completeness
**Description:** No endpoint to list available roles and their permissions. Clients must hardcode role names.
**Impact:** Maintainability issue, risk of typos in role assignment.
**Fix hint:** Add GET `/team/roles` that returns ROLE_FINE_PERMISSIONS and ROLE_DESCRIPTIONS.

---

## BE-MER-040 Onboarding Submit Not Idempotent
**Severity:** MEDIUM
**File:** `src/routes/onboarding.ts:60-85`
**Category:** Business Logic
**Description:** Calling POST `/onboarding/submit` multiple times overwrites `completedAt` and status each time. Should be idempotent after first submission.
**Impact:** Submitting twice overwrites the original submission timestamp, breaking audit trails.
**Fix hint:** Check if `onboarding.status === 'completed'` and return early with 409 Conflict.
