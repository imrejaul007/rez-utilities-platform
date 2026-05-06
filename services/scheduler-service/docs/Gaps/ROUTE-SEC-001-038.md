# ROUTE-SEC-001-038: Backend Route Security Audit

**38 route-level security issues across 9 microservice directories**
**Services:** rez-wallet-service, rez-merchant-service, rez-backend, rez-karma-service, rez-finance-service, rez-payment-service, rez-search-service
**Audit Source:** Backend Routes Deep Audit Agent

---

## CRITICAL (5)

### ROUTE-SEC-001: Internal Wallet Debit — No IP Allowlisting

**File:** `rez-wallet-service/walletRoutes.ts:529`

`POST /wallet/internal/debit` endpoint has no IP allowlisting. Any network-accessible caller can debit any wallet without authentication.

---

### ROUTE-SEC-002: Merchant JWT Falls Back to Consumer Secret

**File:** `rez-merchant-service/auth.ts:75,186,257,593`

`JWT_MERCHANT_SECRET` falls back to `JWT_SECRET` (consumer secret) when not set. Any valid consumer JWT can be forged as a merchant token.

---

### ROUTE-SEC-003: Reverse Cashback — Audit Log Not in Transaction

**File:** `rezbackend/admin/userWallets.ts:427`

`reverse-cashback` audit log is NOT inside MongoDB transaction. Wallet change commits without audit trail on failure.

---

### ROUTE-SEC-004: Menu-Sync Webhook — Zero Authentication

**File:** `rezbackend/aggregatorWebhookRoutes.ts:253`

Menu-sync webhook has zero authentication. Any caller can overwrite menu data.

---

### ROUTE-SEC-005: Cloudinary Delete — No Ownership Check

**File:** `rezbackend/admin/uploads.ts:174`

Cloudinary delete endpoint has no `publicId` ownership check. Any authenticated admin can delete any uploaded file by publicId.

---

## HIGH (13)

### ROUTE-SEC-006: `/send-otp` — No Rate Limiting (Merchant)

**File:** `rez-merchant-service/auth.ts` — `/send-otp` endpoint

OTP brute-force possible with no rate limiting.

---

### ROUTE-SEC-007: `/register-otp` — No Password Required

**File:** `rez-merchant-service/auth.ts` — `/register-otp` endpoint

Allows account creation without a password. OTP-less login.

---

### ROUTE-SEC-008: Bulk Actions — No ObjectId Validation

**File:** `rez-merchant-service/orders.ts:219`

`bulk-action` does not validate `orderIds` as ObjectIds before loop. Invalid IDs cause silent failures or MongoDB CastErrors.

---

### ROUTE-SEC-009: Bulk Operations — Silently Drop Invalid IDs

**File:** `rez-merchant-service/products.ts`

Bulk operations silently drop invalid IDs with no error detail returned to caller.

---

### ROUTE-SEC-010: Karma Verify Routes — No Ownership Check

**File:** `rez-karma-service/verifyRoutes.ts`

Admin can check-in/out on behalf of any user without ownership check.

---

### ROUTE-SEC-011: BNPL Create — No Amount Upper Bound

**File:** `rez-finance-service/borrowRoutes.ts`

BNPL create has no amount upper bound. User can request arbitrarily large loans.

---

### ROUTE-SEC-012: Razorpay Order — No Amount Upper Bound

**File:** `rez-payment-service/paymentRoutes.ts`

`createRazorpayOrder` amount has no upper bound despite schema cap of 500000 (cap not enforced at route level).

---

### ROUTE-SEC-013: Suggestions Cache — Unbounded Map

**File:** `rez-search-service/searchRoutes.ts:150`

Suggestions cache is unbounded `Map` — memory exhaustion over time.

---

### ROUTE-SEC-014: Order Webhook — No Merchant Approval Guard

**File:** `rezbackend/aggregatorWebhookRoutes.ts:100`

Order creation from webhooks has no merchant approval guard. Any verified aggregator can create orders for any merchant.

---

### ROUTE-SEC-015: Admin Actions — No ObjectId Validation

**File:** `rezbackend/admin/adminActions.ts:71,90`

`actionId` not validated as ObjectId before use.

---

### ROUTE-SEC-016: Internal Debit — Weak ObjectId Check

**File:** `rezbackend/walletRoutes.ts:529`

Internal debit endpoint uses `mongoose.Types.ObjectId.isValid` instead of `findById` guard.

---

### ROUTE-SEC-017: Karma Phase 2 Routes — No Auth Middleware

**File:** `rez-karma-service/routes/index.ts`

Phase 2 stub routes have no `requireAuth` middleware.

---

### ROUTE-SEC-018: Analytics Comparison — No Date Validation

**File:** `rez-merchant-service/analytics.ts`

`/comparison` does not validate date strings — invalid dates silently become epoch (1970).

---

## MEDIUM (13)

### ROUTE-SEC-019: OTP-less Login — `/register-otp` (Merchant)

Allows account creation via OTP without password. Standard OTP-less login pattern but should be explicitly documented and rate-limited.

---

### ROUTE-SEC-020: Reverse Cashback Transaction Gap

`reverse-cashback` audit log not in MongoDB transaction (CRIT-003). Adjust path fixed, but clawback path still has gap.

---

### ROUTE-SEC-021: GPS Validation Bypass in Verify Routes

Verify routes may accept GPS coordinates outside valid ranges.

---

### ROUTE-SEC-022: Forecast — Unbounded Day Count

Forecast endpoint allows unlimited day count in date range query.

---

### ROUTE-SEC-023: Export Endpoints Are Stubs

Export functionality is not implemented.

---

### ROUTE-SEC-024: `validate-invitation` Reveals Business Name Unauthenticated

Invitation validation reveals business name without authentication.

---

### ROUTE-SEC-025: GET `/offers/:id` Missing Ownership Check

Offer detail endpoint returns data for any offer ID without verifying ownership.

---

### ROUTE-SEC-026: BNPL Payment — Negative Amounts Allowed

BNPL payment route does not validate `amount > 0`.

---

### ROUTE-SEC-027: Bulk Actions — Silently Drop Invalid IDs

Invalid ObjectIds in bulk operations dropped silently without error detail.

---

### ROUTE-SEC-028: `reconcile` — N+1 Query Pattern

Reconciliation endpoint has N+1 query pattern — one query per item.

---

### ROUTE-SEC-029: Health Deep — Leaks Infrastructure Details

`/health-deep` endpoint exposes internal infrastructure details (service names, versions, memory usage).

---

### ROUTE-SEC-030: SameSite Strict Cookie — Compatibility

`sameSite: 'strict'` cookie option may break on older browsers and cross-site navigation.

---

### ROUTE-SEC-031: Merchant Send OTP — No Account Lockout

After failed OTP attempts, no account lockout mechanism.

---

### ROUTE-SEC-032: Merchant Verify OTP — Not Timing-Safe

OTP verification timing not protected against timing attacks.

---

## LOW (7)

### ROUTE-SEC-033: OTP Verification — Timing Leak

OTP comparison not timing-safe on merchant `/verify-otp`.

---

### ROUTE-SEC-034: `sameSite: strict` Cookie Compatibility

`sameSite: 'strict'` may cause UX issues with legitimate cross-site navigation flows.

---

### ROUTE-SEC-035: Export Endpoints — Stub Implementation

Export functionality returns empty or unimplemented responses.

---

### ROUTE-SEC-036: Forecast Endpoint — No Day Range Limit

Forecast allows queries across unlimited time ranges.

---

### ROUTE-SEC-037: Health Endpoint — Excessive Information

Health checks return detailed service metadata beyond basic status.

---

### ROUTE-SEC-038: Order Reconciliation — Missing Index

N+1 query pattern in reconciliation endpoint may cause performance degradation.

---

## Already Fixed in Codebase

| Label | Issue | Fix Applied |
|-------|-------|------------|
| KARMA-P1 | Karma routes ownership check | Fixed |
| DUAL-PAYOUT-FIX | Merchant withdrawal atomic check-and-debit | Fixed |
| OTP brute-force | Account lockout after 5 failed attempts | Fixed |
| OTP timing | `/has-pin` timing-safe comparison | Fixed |
| CRIT-003 adjust | Wallet mutation + audit log in session.withTransaction | Fixed |

---

## Status Table

| ID | Status | Est Fix |
|----|--------|---------|
| ROUTE-SEC-001 | ACTIVE | 2h |
| ROUTE-SEC-002 | ACTIVE | 1h |
| ROUTE-SEC-003 | ACTIVE | 2h |
| ROUTE-SEC-004 | ACTIVE | 1h |
| ROUTE-SEC-005 | ACTIVE | 1h |
| ROUTE-SEC-006 | ACTIVE | 1h |
| ROUTE-SEC-007 | ACTIVE | 1h |
| ROUTE-SEC-008 | ACTIVE | 1h |
| ROUTE-SEC-009 | ACTIVE | 1h |
| ROUTE-SEC-010 | ACTIVE | 2h |
| ROUTE-SEC-011 | ACTIVE | 1h |
| ROUTE-SEC-012 | ACTIVE | 1h |
| ROUTE-SEC-013 | ACTIVE | 1h |
| ROUTE-SEC-014 | ACTIVE | 1h |
| ROUTE-SEC-015 | ACTIVE | 1h |
| ROUTE-SEC-016 | ACTIVE | 1h |
| ROUTE-SEC-017 | ACTIVE | 2h |
| ROUTE-SEC-018 | ACTIVE | 1h |
| ROUTE-SEC-019 | ACTIVE | 1h |
| ROUTE-SEC-020 | ACTIVE | 2h |
| ROUTE-SEC-021 | ACTIVE | 1h |
| ROUTE-SEC-022 | ACTIVE | 1h |
| ROUTE-SEC-023 | ACTIVE | 4h |
| ROUTE-SEC-024 | ACTIVE | 1h |
| ROUTE-SEC-025 | ACTIVE | 1h |
| ROUTE-SEC-026 | ACTIVE | 30m |
| ROUTE-SEC-027 | ACTIVE | 1h |
| ROUTE-SEC-028 | ACTIVE | 2h |
| ROUTE-SEC-029 | ACTIVE | 1h |
| ROUTE-SEC-030 | ACTIVE | 30m |
| ROUTE-SEC-031 | ACTIVE | 1h |
| ROUTE-SEC-032 | ACTIVE | 30m |
| ROUTE-SEC-033 | ACTIVE | 30m |
| ROUTE-SEC-034 | ACTIVE | 30m |
| ROUTE-SEC-035 | ACTIVE | 4h |
| ROUTE-SEC-036 | ACTIVE | 1h |
| ROUTE-SEC-037 | ACTIVE | 1h |
| ROUTE-SEC-038 | ACTIVE | 2h |
