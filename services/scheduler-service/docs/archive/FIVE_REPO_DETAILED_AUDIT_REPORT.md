# Five Repo Detailed Audit Report

This document consolidates the current deep audit findings across the five primary repositories in this workspace:

- `rezbackend/rez-backend-master`
- `rezapp/nuqta-master`
- `rezadmin/rez-admin-main`
- `rezmerchant/rez-merchant-master`
- `rez-web-menu`

Important note:
- This is a line-backed engineering audit based on the deep review work completed so far.
- It is not a false claim that every line of every file in all five repos has been fully audited.
- `rezbackend` received the deepest review by far.

---

## DO IMMEDIATELY — Live Danger Items

These four items are live and dangerous right now. Nothing else should start until these are done.

### 1. Consumer wallet top-up calls admin-only endpoint

- Repo: `rezapp/nuqta-master`
- File: `components/wallet/TopupModal.tsx`, `services/walletApi.ts`
- Problem: The wallet top-up modal calls a direct top-up endpoint that is now admin-only. Every user who attempts to add money hits a blocked path.
- Action: Route wallet funding through the supported public payment gateway flow. Remove the direct admin credit call.

### 2. Consumer client attempts to self-credit loyalty wallet

- Repo: `rezapp/nuqta-master`
- File: `components/FashionHeader.js`, `services/walletApi.ts`
- Problem: The client calls an admin-only credit endpoint to fix perceived loyalty/wallet balance drift. This will fail silently or with errors in production.
- Action: Remove the client-side credit call entirely. Loyalty sync must be backend-driven only.

### 3. Merchant POS fakes financial success on failure

- Repo: `rezmerchant/rez-merchant-master`
- File: `services/api/pos.ts`
- Problem: On API failure, POS code returns a synthetic bill, synthetic pending status, or synthetic paid result. Merchants may believe a payment succeeded when it did not.
- Action: Remove all fake-success fallbacks. On failure, surface the real error to the merchant.

### 4. Admin web stores bearer tokens in localStorage

- Repo: `rezadmin/rez-admin-main`
- File: `services/storage.ts`, `services/api/apiClient.ts`
- Problem: Admin tokens and refresh tokens are stored in browser-readable storage. XSS anywhere in the admin app equals full platform takeover.
- Immediate compensating control: Restrict the admin app to a VPN or IP allowlist right now if cookie/session auth migration is not immediate.
- Full fix: Phase 6 — migrate to httpOnly cookie/session auth.

---

## 1. Backend Audit

Repo:
- `rezbackend/rez-backend-master`

Overall risk:
- Critical

Launch recommendation:
- Do not launch high-volume or high-trust financial flows until payment, refund, cancellation, and worker recovery behavior are stabilized and re-tested.

### Critical Findings

#### 1. Wallet top-up integrity risk in payment confirmation path

- Severity: Critical
- Location:
  - `src/controllers/walletPaymentController.ts`
  - `src/services/paymentGatewayService.ts`
- Problem:
  - Payment confirmation and wallet credit handling were previously capable of drifting out of sync.
  - The codebase has had multiple paths where status was moved ahead of durable wallet mutation or durable accounting writes.
- Impact:
  - Paid-but-not-funded wallets
  - Broken support escalations
  - Reconciliation drift
- Fix direction:
  - One canonical transactional wallet top-up path only
  - No split-brain confirm-vs-credit logic

#### 2. Refund ceiling and cumulative refund correctness risk

- Severity: Critical
- Location:
  - `src/services/refundService.ts`
- Problem:
  - Refund logic has been vulnerable to validating against original payment amount instead of remaining refundable amount.
- Impact:
  - Over-refunds
  - Direct financial loss
- Fix direction:
  - Enforce cumulative refundable amount atomically in the write path

#### 3. Payment record retention and auditability risk

- Severity: Critical
- Location:
  - `src/models/Payment.ts`
- Problem:
  - TTL-based cleanup on payment records is unsafe if it applies to settled financial records.
- Impact:
  - Lost audit trail
  - Lost dispute evidence
  - Lost reconciliation support
- Fix direction:
  - TTL pending/abandoned intents only, never settled canonical payment rows

### High Findings

#### 4. Fragmented cancellation behavior

- Severity: High
- Location:
  - `src/controllers/orderCancelController.ts`
  - `src/jobs/paymentReconciliationJob.ts`
  - `src/jobs/orderLifecycleJobs.ts`
  - `src/routes/admin/orders.ts`
- Problem:
  - Different flows cancel orders differently.
- Impact:
  - Reservation release drift
  - Refund drift
  - Cashback reversal drift
  - Inconsistent timelines and notifications
- Fix direction:
  - One `cancelOrderCore` used by all paths (partially done — `cancelOrderService.ts` added)

#### 5. Shared Redis/BullMQ failure domain

- Severity: High
- Location:
  - `src/workers/index.ts`
  - `src/workers/merchantEventWorker.ts`
  - `src/workers/broadcastWorker.ts`
  - `src/config/redis-pool.ts`
- Problem:
  - Payment, rewards, analytics, notifications, broadcast, and merchant-events all cluster around shared Redis/BullMQ availability.
- Impact:
  - One Redis flap can degrade multiple critical domains at once
- Evidence:
  - Production `ECONNRESET` logs clustered across multiple workers
- Fix direction:
  - Separate critical and noncritical workers
  - Add queue lag, stalled job, reconnect, and DLQ alerts

#### 6. CORS rejection path is operationally noisy

- Severity: Medium
- Location:
  - `src/config/middleware.ts`
  - `src/middleware/errorHandler.ts`
- Problem:
  - Blocked origins flow through generic error handling and read too much like server errors.
- Impact:
  - Noisy incident signals
  - Misleading operational debugging
- Fix direction:
  - Return explicit blocked-origin responses and classify separately

### Structural Problems

- Money-moving logic is duplicated across controllers, services, webhooks, jobs, and admin routes.
- State machines exist, but adoption is incomplete.
- Existing health/readiness endpoints are a good foundation, but worker observability is still insufficient.

---

## 2. Consumer App Audit

Repo:
- `rezapp/nuqta-master`

Overall risk:
- High

Launch recommendation:
- Do not ship the current wallet top-up UI path as-is.

### Critical Findings

#### 1. Wallet top-up UI is broken

- Severity: Critical
- Location:
  - `components/wallet/TopupModal.tsx`
  - `services/walletApi.ts`
- Problem:
  - The wallet top-up modal still attempts to call a direct top-up endpoint that the service now explicitly blocks as admin-only.
- Impact:
  - Users cannot successfully add money through this flow
- Fix direction:
  - Route wallet funding into the supported public payment/gateway flow

### High Findings

#### 2. Client-side loyalty wallet credit attempt

- Severity: High
- Location:
  - `components/FashionHeader.js`
  - `services/walletApi.ts`
- Problem:
  - The consumer client tries to correct loyalty/wallet balance by calling an admin-only credit endpoint.
- Impact:
  - Broken self-healing logic
  - False wallet/loyalty displays
- Fix direction:
  - Loyalty sync must be backend-driven only

#### 3. Recharge validation is regionally incorrect

- Severity: High
- Location:
  - `app/recharge.tsx`
- Problem:
  - The screen assumes a 10-digit mobile number while the same file supports non-India country prefixes.
- Impact:
  - Recharge breaks for other regions
- Fix direction:
  - Validate by E.164 or region-specific rules

#### 4. Payment methods exposed without full UX support

- Severity: High
- Location:
  - `services/paymentService.ts`
  - `app/payment.tsx`
- Problem:
  - Methods like card can be exposed even though the details/submit flow is incomplete.
- Impact:
  - Dead-end payment method selection
- Fix direction:
  - Hide unsupported methods until implemented

### Security Findings

#### 5. Web-mode auth uses browser-readable storage

- Severity: High
- Location:
  - `utils/authStorage.ts`
- Problem:
  - Web stores access/refresh tokens in localStorage.
- Impact:
  - XSS means session takeover
- Fix direction:
  - Use cookie/session auth for browser surfaces

### Reliability Findings

#### 6. API client assumes all responses are JSON

- Severity: Medium
- Location:
  - `services/apiClient.ts`
- Problem:
  - Non-JSON failures get misparsed
- Impact:
  - Harder incident diagnosis
- Fix direction:
  - Add content-type aware parsing

---

## 3. Admin App Audit

Repo:
- `rezadmin/rez-admin-main`

Overall risk:
- High

Launch recommendation:
- Only acceptable behind a hardened admin origin and strict web security posture.
- **Immediate compensating control:** Put the admin app behind a VPN or IP allowlist until the localStorage auth migration is complete.

### Critical Findings

#### 1. Admin bearer auth stored in localStorage

- Severity: Critical
- Location:
  - `services/storage.ts`
- Problem:
  - Admin tokens and refresh tokens are stored in browser-readable storage on web.
- Impact:
  - XSS becomes full admin takeover
- Fix direction:
  - Move to httpOnly cookie/session auth

### High Findings

#### 2. Refresh token flow is browser-side

- Severity: High
- Location:
  - `services/api/apiClient.ts`
- Problem:
  - Refresh token is read from storage and sent directly from frontend code.
- Impact:
  - Same XSS blast radius persists through token rotation
- Fix direction:
  - Move refresh to backend-controlled session handling

#### 3. API client assumes JSON responses

- Severity: Medium
- Location:
  - `services/api/apiClient.ts`
- Problem:
  - Empty/HTML responses become parser noise
- Impact:
  - Poor failure handling
- Fix direction:
  - Add safe response parsing

### Contract Findings

#### 4. Admin payment/order contract drift

- Severity: Medium
- Location:
  - `services/api/orders.ts`
- Problem:
  - Admin types are narrower than real backend status complexity
- Impact:
  - Misread states in operational dashboards
- Fix direction:
  - Generate contracts from backend source of truth

---

## 4. Merchant App Audit

Repo:
- `rezmerchant/rez-merchant-master`

Overall risk:
- Medium-High

Launch recommendation:
- Do not trust POS and merchant payment outcomes until fail-open behavior is removed.

### High Findings

#### 1. POS APIs fail open with fake financial state

- Severity: High
- Location:
  - `services/api/pos.ts`
- Problem:
  - On API failure, POS code returns synthetic bill, synthetic pending status, or synthetic paid result.
- Impact:
  - Merchant may see false payment success
- Fix direction:
  - Never fabricate financial truth on failure

#### 2. Merchant web auth storage is not hardened enough

- Severity: High
- Location:
  - `services/storage.ts`
- Problem:
  - Browser path still relies on web-readable token storage patterns.
- Impact:
  - Merchant XSS can become account takeover
- Fix direction:
  - Separate native secure storage from web session strategy

### Medium Findings

#### 3. Mixed networking patterns create drift risk

- Severity: Medium
- Location:
  - `services/api/audit.ts`
  - `services/api/products.ts`
  - `services/api/cashback.ts`
- Problem:
  - Some APIs use shared client behavior, others use raw fetch
- Impact:
  - Auth retry and timeout handling become inconsistent
- Fix direction:
  - Standardize on one networking abstraction

---

## 5. Web Menu Audit

Repo:
- `rez-web-menu`

Overall risk:
- Medium-High

Launch recommendation:
- Functional, but browser auth/session handling needs hardening.

### High Findings

#### 1. JWT and refresh token stored in localStorage

- Severity: High
- Location:
  - `src/api/client.ts`
- Problem:
  - Public web ordering stores auth tokens in browser-readable storage.
- Impact:
  - XSS becomes session/account takeover
- Fix direction:
  - Move to cookie/session auth

### Medium Findings

#### 2. Receipt token is not enforced

- Severity: Medium
- Location:
  - `src/pages/ReceiptPage.tsx`
- Problem:
  - Receipt token is acknowledged but unused
- Impact:
  - Security theater and possible misunderstanding of receipt access protection
- Fix direction:
  - Verify server-side or remove the placeholder security messaging

#### 3. Checkout depends on browser token assumptions

- Severity: High
- Location:
  - `src/api/client.ts`
  - `src/pages/CheckoutPage.tsx`
- Problem:
  - Payment creation/verification depends on browser token/session assumptions
- Impact:
  - Session bugs or XSS affect payment flows
- Fix direction:
  - Reduce client token exposure and align with canonical backend flow

---

## Cross-Repo Themes

### Theme 1: Browser-readable auth is repeated

Affected repos:
- `rezadmin`
- `rezapp` web mode
- `rezmerchant` web mode
- `rez-web-menu`

### Theme 2: Backend is still the main system-of-record risk

- If backend money/state consistency is wrong, all clients inherit the failure.

### Theme 3: Contract drift is a platform-wide problem

- Backend enums, docs, validators, and client types are not yet aligned enough.

### Theme 4: Financial UIs must not fake success

- Merchant POS is the clearest example today.

---

## Cross-Repo Priorities (Corrected Execution Order)

1. Fix the 4 live-danger items above before anything else
2. Add Redis/queue/DLQ/readiness observability to backend
3. Build canonical payment orchestrator in shadow mode only
4. Enforce state machine transitions
5. Harden accounting/ledger layer
6. Split worker blast radius
7. Migrate browser auth away from localStorage
8. Generate shared contracts from backend source types
