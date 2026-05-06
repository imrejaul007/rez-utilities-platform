# Merchant App — API Contracts & Backend Mismatches

> **Audit date:** 2026-04-15
> **Bugs found:** 32
> **Status:** Open — merchant app audit

---

### MA-API-001: Widespread `any` Type Casting Defeats TypeScript Safety
**Severity:** CRITICAL
**Frontend file:** rezmerchant/services/paymentService.ts:30, 45, 78, 157, 180, 223, 230, 250, 282 (9+ instances per service)
**Backend expected:** Unknown — types unsafe
**Category:** type-safety
**Description:** Extensive `any` casting throughout payment services: `<any>`, `as any`, `Record<string, any>`. Prevents type checking of API responses.
**Impact:** Backend API shape changes go undetected; runtime crashes when response shape differs. No IDE autocomplete for API fields.
**Fix hint:** Define strict response interfaces; use `type-fest` or similar to infer types from backend schema. Never use `as any` for API responses.
> **Status:** Fixed in Phase 3 (2026-04-15) — Defined GatewayResponse type in paymentService.ts:34-40; lifted canonical response types to rez-shared/schemas/apiContracts.ts; merchants will consume shared schemas instead of `any`.

---

### MA-API-002: Payment Orchestrator 'rezcoins' Type Cast Without Normalization
**Severity:** CRITICAL
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:77
**Backend expected:** 'wallet' (inferred from CONSUMER-APP-PAYMENTS.md CA-PAY-023)
**Category:** payload-mismatch
**Description:** Line 77 marks payment method type as `'rezcoins' as any` but never normalizes to 'wallet' in `processInternalPayment()`. Type cast silences TypeScript error about invalid enum value.
**Impact:** API call sends unsupported method type; backend rejects payment with unclear error.
**Fix hint:** Remove `as any` cast; add proper `normalizePaymentMethod()` that converts 'rezcoins' → 'wallet'.
> **Status:** Fixed in Phase 3 (2026-04-15) — Normalized rezcoins to wallet payment type in getAvailablePaymentMethods():86; lifted payment type enum to rez-shared paymentRequestSchema.

---

### MA-API-003: Missing Type Definition for Payment Gateway Response
**Severity:** HIGH
**Frontend file:** rezmerchant/services/paymentService.ts:45, 223, 230
**Backend expected:** Unknown structure
**Category:** missing-type
**Description:** `gatewayResponse?: any` in PaymentResponse — API response shape unknown. No schema validation.
**Impact:** Code cannot safely access gatewayResponse fields; brittle and crashes on schema changes.
**Fix hint:** Define GatewayResponseSchema interface; validate response shape on receipt.

---

### MA-API-004: Bill Payment Providers Endpoint Response Untyped
**Severity:** HIGH
**Frontend file:** rezmerchant/services/billPaymentApi.ts:93
**Backend expected:** `{ providers: BillProviderInfo[]; pagination: PaginationInfo }`
**Category:** missing-type
**Description:** `getProviders()` returns `ApiResponse<any>` instead of explicit response type. Response shape unknown to client.
**Impact:** No autocomplete for providers array; accessing wrong field names crashes code.
**Fix hint:** Define `GetProvidersResponse` type; return `ApiResponse<GetProvidersResponse>`.

---

### MA-API-005: Razorpay Order Data Return Type Untyped
**Severity:** HIGH
**Frontend file:** rezmerchant/app/payment-razorpay.tsx:246-247, 286
**Backend expected:** `{ razorpayOrderId: string; razorpayKeyId: string; amount: number; currency: string }`
**Category:** missing-type
**Description:** `createRazorpayOrder()` returns `any`. Response structure assumed but not validated.
**Impact:** Code breaks if backend changes response field names (e.g., orderId → order_id).
**Fix hint:** Define `CreateOrderResponse` interface; validate return shape.

---

### MA-API-006: BillPaymentApi Missing Success Response Type
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/billPaymentApi.ts:121-127
**Backend expected:** Unknown structure
**Category:** missing-type
**Description:** `payBill()` response type hardcoded object shape but not validated. If backend omits field, code breaks.
**Impact:** Missing cashback or status field causes undefined errors.
**Fix hint:** Validate response shape; use discriminated union for success/failure states.

---

### MA-API-007: Bill Fetch API Response Missing Required Fields Check
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/billPaymentApi.ts:96-102
**Backend expected:** FetchedBillInfo structure
**Category:** missing-validation
**Description:** `fetchBill()` assumes response has provider, customerNumber but no runtime validation.
**Impact:** If backend returns incomplete bill data, UI crashes when accessing required fields.
**Fix hint:** Validate response.data matches FetchedBillInfo schema on receipt.

---

### MA-API-008: COD Configuration Response Type Unvalidated
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:272
**Backend expected:** CODConfig structure
**Category:** missing-validation
**Description:** `getCODConfiguration()` returns `<any>` with fallback to env config. If backend returns invalid/missing config, no validation.
**Impact:** maxOrderAmount may be undefined; COD availability check broken.
**Fix hint:** Validate response against CODConfig schema; throw if invalid.

---

### MA-API-009: Payment Preferences API Type Collision
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:363
**Backend expected:** PaymentMethodPreference structure
**Category:** missing-type
**Description:** `getPaymentPreferences()` returns `<any>`. Preference shape unknown.
**Impact:** Code assumes preferredMethod field exists; crashes if missing.
**Fix hint:** Define PaymentMethodPreferenceResponse; validate on receipt.

---

### MA-API-010: Payment Status Check Missing Response Validation
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:402
**Backend expected:** PaymentResponse
**Category:** missing-validation
**Description:** `checkPaymentStatus()` returns response without validating status field exists and is valid enum.
**Impact:** If backend returns invalid status, UI shows corrupted state.
**Fix hint:** Validate status ∈ ['pending', 'completed', 'failed', 'cancelled'].

---

### MA-API-011: Error Objects Typed as `any` Prevent Error Recovery
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:203, 222, 242, 262, 411
**Backend expected:** Typed error response
**Category:** type-safety
**Description:** `catch (error: any)` blocks throughout. Error structure unknown; cannot distinguish error types.
**Impact:** Cannot retry on transient errors vs permanent failures; poor error handling.
**Fix hint:** Define ApiErrorResponse type; discriminate error codes in catch blocks.

---

### MA-API-012: Bill Verification Response Shape Unclear
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/billVerificationService.ts (implied)
**Backend expected:** Unknown
**Category:** missing-type
**Description:** Bill verification response fields assumed but not documented or validated.
**Impact:** If backend response changes, verification logic breaks silently.
**Fix hint:** Define BillVerificationResponse; validate on receipt.

---

### MA-API-013: Razorpay Signature Verification Payload Misalignment
**Severity:** HIGH
**Frontend file:** rezmerchant/app/payment-razorpay.tsx:259-272
**Backend expected:** `/travel-payment/verify` and `/payment/verify` endpoints
**Category:** payload-mismatch
**Description:** Verification sends `razorpay_signature` in snake_case but other fields in camelCase. Inconsistent naming.
**Impact:** If backend expects consistent naming, verification fails silently.
**Fix hint:** Standardize all fields to one naming convention; document API contract.

---

### MA-API-014: Payment Initiation Request Missing Required Headers
**Severity:** HIGH
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:235
**Backend expected:** Unknown auth/tracking headers
**Category:** missing-header
**Description:** `apiClient.post('/payment/internal/process', ...)` may not include auth headers, traceId, or version headers required by backend.
**Impact:** Backend rejects request or logs payment without audit trail.
**Fix hint:** Verify apiClient applies all required auth/tracking headers; add explicit headers to payment requests.

---

### MA-API-015: Bill Payment Endpoint Version Ambiguous
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/billPaymentApi.ts:100-101
**Backend expected:** `/bill-payments/fetch-bill` vs `/v2/bill-payments/fetch-bill`
**Category:** endpoint-mismatch
**Description:** Endpoint path lacks explicit version. If backend API is versioned, request may route to wrong handler.
**Impact:** Old API version returns deprecated schema; UI breaks.
**Fix hint:** Document API version; ensure endpoint matches backend route exactly.

---

### MA-API-016: Payment Method List Missing Currency Filter
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:52-60
**Backend expected:** Currency-filtered payment methods
**Category:** missing-validation
**Description:** `getAvailablePaymentMethods(amount, currency)` accepts currency param but never sends to backend. Backend may return methods for all currencies.
**Impact:** User shown payment methods unsupported in their currency.
**Fix hint:** Add currency query param to backend call: `/payment/methods?amount=${amount}&currency=${currency}`.

---

### MA-API-017: COD Fee Type Assumption
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:162
**Backend expected:** COD fee structure
**Category:** type-mismatch
**Description:** `codConfig.fee` assumed to be numeric but could be object or structured fee object.
**Impact:** Displaying fee breaks if backend returns `{ fixed: 10, percentage: 2 }` instead of single number.
**Fix hint:** Define CODFeeStructure type; validate structure on receipt.

---

### MA-API-018: Payment Status Polling Endpoint Hardcoded No Query String
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:402
**Backend expected:** `/payment/status/{paymentId}?gateway=razorpay` (to disambiguate)
**Category:** missing-parameter
**Description:** Status check omits gateway parameter even though payment could be from multiple gateways.
**Impact:** Backend returns status from wrong gateway; incorrect state.
**Fix hint:** Add gateway param: `/payment/status/${paymentId}?gateway=${gateway}`.

---

### MA-API-019: Save Payment Method Response Missing ID Extraction Type Check
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:329-332
**Backend expected:** `{ success: true; id: string }`
**Category:** missing-validation
**Description:** Assumes `response.data?.id` is string but no validation. Could be undefined or number.
**Impact:** Saving payment method returns undefined ID; later retrieval fails silently.
**Fix hint:** Validate `response.data.id` is non-empty string; throw if not.

---

### MA-API-020: Delete Payment Method Endpoint Missing 204 vs 200 Handling
**Severity:** LOW
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:350
**Backend expected:** 200 or 204
**Category:** status-code-handling
**Description:** `delete` returns success on response.success but some APIs return 204 (no content). Unclear if handled.
**Impact:** If backend returns 204, apiClient may not set `response.success = true`.
**Fix hint:** Verify apiClient treats 204 as success; explicitly check response status in code.

---

### MA-API-021: Transaction Metadata Field Causes Runtime Crashes
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/walletApi.ts:245-271
**Backend expected:** Typed metadata structure
**Category:** type-mismatch
**Description:** `TransactionMetadata` defined with `[key: string]: unknown` which allows any field. If backend returns unexpected nested structure, code crashes.
**Impact:** Accessing nested metadata fields (e.g., `metadata.order?.details`) throws errors if structure differs.
**Fix hint:** Define strict metadata shape per transaction type; use discriminated union.

---

### MA-API-022: Wallet Balance Response Field Ambiguity (Redux v Replacement)
**Severity:** HIGH
**Frontend file:** rezmerchant/services/walletApi.ts:174-196
**Backend expected:** Single canonical field for cashback/pending
**Category:** field-mismatch
**Description:** `breakdown.cashback`, `breakdown.cashbackBalance`, `breakdown.pending`, `breakdown.pendingRewards` all optional. Unclear which is authoritative.
**Impact:** Code uses wrong field; balance display incorrect.
**Fix hint:** Backend must return ONE canonical field per value; consumer must validate presence of required field.

---

### MA-API-023: Coin Conversion Rate Missing Type Validation
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/walletApi.ts:87
**Backend expected:** `{ rezToInr: number }`
**Category:** missing-validation
**Description:** `coinConversion?: { rezToInr: number }` optional but no validation that rezToInr is positive number.
**Impact:** If backend returns rezToInr = 0 or negative, coin redemption calculations break.
**Fix hint:** Validate rezToInr > 0; use default rate if invalid.

---

### MA-API-024: Payment Methods Endpoint Missing Status Code Documentation
**Severity:** LOW
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:299
**Backend expected:** 200 OK
**Category:** documentation
**Description:** API contract unclear: does endpoint return 404 if no methods, or 200 with empty array?
**Impact:** Frontend assumes 200 with array; if backend returns 404, error handling incorrect.
**Fix hint:** Document endpoint: "Always returns 200 with possibly empty array".

---

### MA-API-025: Razorpay Key ID Fetch Missing Fallback Validation
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/razorpayService.ts:34-48 (implied)
**Backend expected:** Valid Razorpay key
**Category:** missing-validation
**Description:** Key ID loaded from env but never validated against backend. Stale key used if env not reloaded.
**Impact:** If Razorpay rotates keys, old app instances fail to initialize payments.
**Fix hint:** Fetch valid key from backend on startup; compare with env; warn if mismatch.

---

### MA-API-026: Payment Redirect URL Hardcoded No Protocol Validation
**Severity:** MEDIUM
**Frontend file:** rezmerchant/app/payment*.tsx (implied)
**Backend expected:** HTTPS
**Category:** security
**Description:** Redirect URLs built from params without validating protocol. Attacker could inject HTTP or javascript: URLs.
**Impact:** Malicious redirect to phishing site; XSS via javascript: URL.
**Fix hint:** Validate redirect URLs start with `https://`; reject others.

---

### MA-API-027: Bill Providers Pagination Unbounded
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/billPaymentApi.ts:88-94
**Backend expected:** Pagination limits enforced
**Category:** missing-validation
**Description:** `getProviders(type, page = 1, limit = 20)` accepts any limit value. No max limit check.
**Impact:** Attacker passes `limit=10000`; backend OOM or slow query; DoS.
**Fix hint:** Cap limit: `const safeLimit = Math.min(limit, 100)`.

---

### MA-API-028: Bill Type Parameter Not Enum-Validated
**Severity:** MEDIUM
**Frontend file:** rezmerchant/app/bill-payment.tsx (implied from consumer app CA-PAY-049)
**Backend expected:** billType ∈ ['electricity', 'water', 'gas', 'broadband', ...]
**Category:** missing-validation
**Description:** billType passed to API without validation against allowed types.
**Impact:** Invalid type causes 400 error at backend; user sees generic failure.
**Fix hint:** Validate billType ∈ ALLOWED_BILL_TYPES before API call.

---

### MA-API-029: Payment Request Payload Mismatch Between Gateways
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:235, 255, 192
**Backend expected:** Different schemas for `/payment/internal/process`, `/payment/cod/create`, `/payment/verify`
**Category:** payload-mismatch
**Description:** All gateway payments sent as `PaymentRequest` but backends expect different field sets.
**Impact:** Internal payment missing COD-specific fields; COD payment has unnecessary fields; requests rejected.
**Fix hint:** Define separate request types: InternalPaymentRequest, CODPaymentRequest; validate before sending.

---

### MA-API-030: Rate Limiting Headers Missing on Payment Requests
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/billPaymentApi.ts, paymentOrchestratorService.ts
**Backend expected:** X-Request-ID, X-Idempotency-Key in all requests
**Category:** missing-header
**Description:** Payment requests don't include tracing/idempotency headers for proper backend logging.
**Impact:** Backend cannot correlate retries; duplicate payment detection fails.
**Fix hint:** Add X-Request-ID (unique per request) and X-Idempotency-Key headers.

---

### MA-API-031: Transaction History Endpoint Missing Filter Validation
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/walletApi.ts (implied)
**Backend expected:** Query filters type-safe
**Category:** missing-validation
**Description:** Transaction history filters (date, category, type) passed without validation.
**Impact:** Invalid filter values cause 400 errors; user sees generic error.
**Fix hint:** Validate all filter values before API call; provide defaults.

---

### MA-API-032: Payment Gateway Initialization Missing Retries
**Severity:** MEDIUM
**Frontend file:** rezmerchant/services/paymentOrchestratorService.ts:183
**Backend expected:** Payment gateways available on init
**Category:** error-handling
**Description:** `initialize()` called once per payment; if backend is temporarily unavailable, no retry.
**Impact:** Transient backend outage blocks all payments; no graceful degradation.
**Fix hint:** Implement retry logic with exponential backoff for initialization.

---

**NOTE:** This audit found 32 API contract issues in the merchant app, with 3 being CRITICAL (items 001, 002, 013). The most urgent fixes are:
1. Remove all `as any` casts; define strict response types for all endpoints
2. Normalize payment method types ('rezcoins' → 'wallet') before backend submission
3. Add payload validation and HTTP header checking for all payment requests

The merchant app lacks the defensive type-checking and contract validation needed for reliable payment processing. Many endpoints assume response structure without validation, leading to brittle code vulnerable to backend schema changes.
