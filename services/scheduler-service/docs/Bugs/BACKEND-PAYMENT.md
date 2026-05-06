# Payment Service Bug Audit (BE-PAY-###)

## BE-PAY-001
**Title:** Floating-point precision in refund full/partial detection causes status misclassification

**Severity:** HIGH

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 470-471, 738-739)

> **Status:** Fixed in commit TBD (2026-04-15)

**Category:** Amount calculations, refund flows

**Description:**
The refund flow uses floating-point comparison to decide full vs partial refund status:
```javascript
const isFullRefund = Math.round((reservedPayment.refundedAmount ?? 0) * 100) >= Math.round(reservedPayment.amount * 100);
```
While the paise conversion is correct, the `refundedAmount` field in the Payment schema has no decimal place constraint. If a caller passes `refundedAmount: 99.999` and `amount: 100`, the comparison may classify a 99.999 refund as full (if rounding behavior differs). The fix uses paise consistently but the underlying data type should validate precision.

**Impact:**
Merchants could see refunds marked as "full" when only partial refunds occurred, leading to reconciliation errors and over-payment of settlement amounts.

**Fix hint:**
Add schema validation: `refundedAmount: { type: Number, default: 0, set: (v) => Math.round(v * 100) / 100 }` to enforce paise precision on write.

---

## BE-PAY-002
**Title:** Replay attack on webhook events when Redis is unavailable; local nonce cache is process-scoped

**Severity:** CRITICAL

**File:** `/rez-payment-service/src/routes/paymentRoutes.ts` (lines 54-74)

> **Status:** Fixed in commit TBD (2026-04-15)

**Category:** Replay attacks, gateway webhook handling

**Description:**
The `isReplayedPaymentId()` function protects against duplicate webhook processing via Redis. However, when Redis is unavailable, it falls back to a process-scoped in-memory Map (`_localNonceCache`). In multi-instance deployments (typical production), a malicious actor can replay a webhook event to a different instance that has never seen the `razorpayPaymentId`, bypassing the replay guard entirely and causing duplicate coin credits or double charges.

**Impact:**
In production with multiple payment-service replicas, replaying a `payment.captured` webhook to a fresh instance would mark the payment as completed twice, crediting the wallet twice and corrupting balance records.

**Fix hint:**
When Redis is unavailable, either: (1) reject the webhook with 503 Service Unavailable, or (2) use a mandatory distributed cache (e.g., shared database entry) with distributed lock semantics before processing any webhook.

---

## BE-PAY-003
**Title:** Missing amount precision validation on initiate; accepts floats with arbitrary decimal places

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/routes/paymentRoutes.ts` (line 11-20) and `paymentService.ts` (line 181-191)

**Category:** Amount calculations

**Description:**
The `initiateSchema` accepts `amount: z.number().positive().finite().max(500000)` with no decimal place constraint. Callers can submit `amount: 1.23456789`, which gets stored directly. When passed to Razorpay, it's multiplied by 100 and rounded: `Math.round(1.23456789 * 100) = 123`. But the Payment document stores the original 1.23456789, creating a mismatch between what the user will receive in rupees vs what the database records.

**Impact:**
Settlement reconciliation, refund calculations, and audit logs report incorrect amounts. Particularly problematic when refunds are issued against a mangled original amount.

**Fix hint:**
Enforce `z.number().multipleOf(0.01)` on the schema, or use Decimal.js for amount handling. Validate that `amount === Math.round(amount * 100) / 100` before storing.

---

## BE-PAY-004
**Title:** Idempotency key uniqueness constraint allows concurrent duplicate initiations if key is not provided

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 202-263)

**Category:** Idempotency keys, double-spend prevention

**Description:**
The unique index on `metadata.orchestratorIdempotencyKey` (line 131 in Payment.ts) is `sparse: true`, meaning documents without this field are excluded. If a caller submits two concurrent initiate requests without an `orchestratorIdempotencyKey`, both requests pass the uniqueness check and acquire the lock. The second request then creates a second Payment and Razorpay order. The lock pattern prevents TOCTOU but only if idempotency key is provided—it does not enforce single-order-per-user semantics.

**Impact:**
Two concurrent checkout attempts by the same user on the same order without idempotency keys create two separate Payment records and two Razorpay orders, leading to double charges if both are captured.

**Fix hint:**
Add a compound unique index on `(orderId, user, status)` for `status: 'pending' | 'processing'`, or require `orchestratorIdempotencyKey` on all calls to `/pay/initiate`.

---

## BE-PAY-005
**Title:** Gateway webhook signature verification is timing-safe but verifyHandler exposes verification as an oracle

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/routes/paymentRoutes.ts` (lines 210-222)

**Category:** Signature verification

**Description:**
The `verifyHandler` is protected by `requireInternalToken` (line 221), which is correct. However, the middleware acceptance list should be explicitly documented. If an attacker can forge an internal token, they can craft payment signatures without accessing the `RAZORPAY_KEY_SECRET`. The `verifySignature` function itself is correct (uses `crypto.timingSafeEqual`), but the endpoint is a signature oracle if internal-token auth is weak.

**Impact:**
If internal authentication is compromised, attackers can verify arbitrary `razorpaySignature` values without possessing Razorpay credentials.

**Fix hint:**
Add integration tests verifying `requireInternalToken` rejects invalid tokens. Document that this endpoint must never be exposed to untrusted callers.

---

## BE-PAY-006
**Title:** capturePayment re-check inside transaction but IDOR is checked before lock acquisition

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 321-350)

**Category:** IDOR, transaction atomicity

**Description:**
The IDOR check (lines 334-341) happens before the transaction starts, reading the Payment document outside the session. Between the IDOR check and `session.withTransaction()`, a concurrent request could modify the `user` field (via admin endpoint, for example), causing the ownership check to be stale. The re-check inside the transaction (no explicit re-check shown) would see the modified state.

**Impact:**
A race condition where admin changes a payment's user between the IDOR guard and the transaction start could allow a user to capture another user's payment.

**Fix hint:**
Move the IDOR check inside `session.withTransaction()`, before reading the full document. Use `session` for all ownership lookups.

---

## BE-PAY-007
**Title:** Refund amount validation uses >= but refunds can exceed original amount if not guarded at gateway

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 430-441)

**Category:** Amount calculations, double-spend prevention

**Description:**
The refund flow validates `$lte: [{ $add: ['$refundedAmount', amount] }, '$amount']` (line 434), which prevents refunding more than the original amount. However, if the Razorpay API allows refunding more than originally paid (e.g., due to a bug in Razorpay or a network retry creating duplicate refunds on the Razorpay side), the guard does not help. The payment service would reject it, but if Razorpay mistakenly processes a second refund and the payment service retries the API call, the outcome is unpredictable.

**Impact:**
If Razorpay processes a refund for more than was paid, the Payment record will not reflect the true state, and reconciliation will report missing money.

**Fix hint:**
Add a post-refund reconciliation: after Razorpay initiates a refund, query Razorpay's refund status endpoint to confirm the amount matches before updating the Payment status.

---

## BE-PAY-008
**Title:** processRefund reversal of DB reservation if Razorpay fails uses findOneAndUpdate without session

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 452-466)

**Category:** Transaction atomicity, refund flows

**Description:**
In the processRefund flow, if Razorpay fails after the DB reservation is made (line 460-463), the code reverses the reservation:
```javascript
await Payment.findOneAndUpdate({ paymentId }, { $inc: { refundedAmount: -amount } });
```
This is outside the session and outside a transaction. If the reversal fails (e.g., network error), the refundedAmount is stuck as reserved, blocking future refund attempts. The reversal should be part of the transaction or use a separate session with retry logic.

**Impact:**
A failed Razorpay refund followed by a failed DB reversal leaves the payment in a limbo state where refundedAmount is reserved but the refund was never processed, blocking legitimate retries.

**Fix hint:**
Move the reversal into a separate `session.withTransaction()` block, and retry the reversal up to 3 times before throwing.

---

## BE-PAY-009
**Title:** handleWebhookCaptured does not verify the Payment was actually paid by Razorpay before crediting wallet

**Severity:** HIGH

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 524-618)

> **Status:** Fixed in commit TBD (2026-04-15)

**Category:** Gateway webhook handling, settlement

**Description:**
The webhook handler marks a payment as completed based on the `payment.captured` webhook event, but does not verify that the `razorpayPaymentId` in the webhook matches the one in the Payment.gatewayResponse. A malicious actor could craft a webhook with a valid Razorpay signature (if they have access to `RAZORPAY_WEBHOOK_SECRET`) and a fake `razorpayOrderId` + `razorpayPaymentId`, causing the service to credit the wallet without actual payment.

**Impact:**
Free wallet credits without actual Razorpay payment if webhook secret is leaked.

**Fix hint:**
Add a verification step: fetch the payment details from Razorpay API using the `razorpayPaymentId` and confirm status is "captured" and amount matches the Payment record.

---

## BE-PAY-010
**Title:** Concurrency lock TTL of 10 seconds may be insufficient for slow Razorpay API calls

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 68-69, 232-239)

**Category:** Idempotency keys, concurrency

**Description:**
The `INIT_LOCK_TTL_MS = 10_000` (10 seconds) is meant to cover "one Razorpay API call + DB write" (line 227 comment). However, Razorpay's API is not guaranteed to respond within 10 seconds, and the service includes a `withTimeout()` of 10 seconds (razorpayService.ts line 20). If Razorpay times out at 9.5 seconds, the lock will expire before the timeout is reached, allowing a second request to acquire the lock and create a duplicate order.

**Impact:**
Under high latency conditions (e.g., Razorpay experiencing slowness), two concurrent requests could both time out waiting for Razorpay, but the second request's lock would be acquired and create a duplicate Payment record.

**Fix hint:**
Increase `INIT_LOCK_TTL_MS` to 30 seconds, or ensure lock TTL is always greater than the maximum expected operation duration.

---

## BE-PAY-011
**Title:** Webhook deduplication uses event-id but Razorpay guarantees are not documented

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/routes/paymentRoutes.ts` (lines 294-304)

**Category:** Gateway webhook handling, replay attacks

**Description:**
The webhook handler deduplicates based on `x-razorpay-event-id` with a 24-hour TTL. The code assumes Razorpay guarantees this ID is unique per event delivery. However, if Razorpay reuses event IDs across different events (e.g., due to recycling), a second payment.captured event with the same ID would be rejected even if it is a different payment.

**Impact:**
Low impact in practice, but if Razorpay event-ID recycling occurs, legitimate webhooks could be dropped.

**Fix hint:**
Document the assumption: "Assume Razorpay event IDs are globally unique per webhook delivery; if recycled, add (eventId, eventType) to the dedup key."

---

## BE-PAY-012
**Title:** walletCredited flag updated separately from payment completion, allowing race condition

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 387-393, 585-591)

**Category:** Settlement, transaction atomicity

**Description:**
After `capturePayment()` completes the transaction (line 378), the code attempts to credit the wallet (line 388). If this fails, a separate `findByIdAndUpdate` sets `walletCredited: true` (line 389). However, this update is outside the transaction. A race condition could cause:
1. Wallet credit succeeds, but update to set `walletCredited` is delayed.
2. Another process reads the payment, sees `walletCredited: false`, and attempts to credit again.

**Impact:**
Wallet could be credited multiple times for a single payment if the `walletCredited` flag update is delayed or fails.

**Fix hint:**
Include the `walletCredited` flag update in the main transaction, or use a separate idempotency check on the wallet side (e.g., check if the payment's coins are already in the user's wallet).

---

## BE-PAY-013
**Title:** Amount assertion in createRazorpayOrderHandler does not validate against all possible order sources

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/routes/paymentRoutes.ts` (lines 236-266)

**Category:** Amount calculations, ledger correctness

**Description:**
The `createRazorpayOrderHandler` calls `assertAuthoritativeOrderAmount()`, which queries the `orders` collection for `totals.total` or `totals.paidAmount`. However, some orders may store amount in a different field (e.g., `finalAmount`, `subtotal + tax`). The assertion only checks two fields, so an order with amount stored elsewhere would pass the assertion with a mismatched amount.

**Impact:**
Orders with custom amount fields could be charged a different amount than their stored total.

**Fix hint:**
Ensure all order sources use consistent field names (e.g., `totals.total`), or make the assertion configurable per order type.

---

## BE-PAY-014
**Title:** Missing rate limiting on payment initiation; no per-user throttle

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/routes/paymentRoutes.ts` (lines 77-127)

**Category:** Concurrency, idempotency

**Description:**
The initiate endpoint has no rate limiting. A malicious user could rapidly submit initiate requests, each creating a new Razorpay order and Payment document, exhausting Razorpay's API quota or filling the database. The lock only prevents concurrent requests for the same `orderId`, not per-user throttling.

**Impact:**
Denial of service: an attacker could spam initiate requests, consuming Razorpay API quota and slowing legitimate payments.

**Fix hint:**
Add per-user rate limiting: `redis.incr('payment:initiate:${userId}')` with a 60-second TTL and max 10 requests per minute.

---

## BE-PAY-015
**Title:** Refund metadata stored in audit log but not immutable; admin could modify refund reason after creation

**Severity:** LOW

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 482-494)

**Category:** Ledger correctness, audit trail

**Description:**
The refund reason is stored in the audit log's `metadata.reason` field. The `PaymentAuditLog` model does not have immutability constraints (no `immutable: true` on the collection). An admin with database access could modify historical audit logs, changing the refund reason retroactively.

**Impact:**
Audit trail tampering: refund reasons could be altered after the fact.

**Fix hint:**
Add `timestamps: true` and `__v` versioning to PaymentAuditLog, or use a read-only audit service with separate write permissions.

---

## BE-PAY-016
**Title:** capturePayment assumes gatewayResponse exists but webhook handler may populate it lazily

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 359-363, 550-557)

**Category:** Transaction atomicity, gateway webhook handling

**Description:**
In `capturePayment`, the code sets `payment.gatewayResponse` for the first time (line 359-363). However, `handleWebhookCaptured` also populates this field (line 552-557). If both the capture API call and webhook fire concurrently, both transactions could modify `gatewayResponse`, and Mongoose's last-write-wins semantics could cause one to overwrite the other, losing data (e.g., the `source: 'webhook'` flag).

**Impact:**
Lost audit information: the source of the payment capture (API vs webhook) could be overwritten.

**Fix hint:**
Use `$set` with conditional logic: only set `gatewayResponse` if it's currently `null`, or use a sub-document versioning strategy.

---

## BE-PAY-017
**Title:** getMerchantSettlements does not validate merchantId ownership; any merchant can query any other merchant's settlements

**Severity:** HIGH

**File:** `/rez-payment-service/src/routes/paymentRoutes.ts` (lines 358-375)

> **Status:** Fixed in commit TBD (2026-04-15)

**Category:** IDOR, merchant isolation

**Description:**
The `settlementsHandler` accepts `req.merchantId` without validating that the authenticated user actually owns that merchant. An attacker could forge a `merchantId` in the JWT or query parameter and retrieve settlements for another merchant.

**Impact:**
Information disclosure: a merchant could view another merchant's payment history and settlement amounts.

**Fix hint:**
Verify that `req.merchantId` matches the authenticated merchant from the JWT payload. Cross-check against a `merchants` collection if necessary.

---

## BE-PAY-018
**Title:** Refund can be initiated for a payment not owned by the current user if merchant role check is bypassed

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/routes/paymentRoutes.ts` (lines 164-192)

**Category:** IDOR, authorization

**Description:**
The refund handler checks `req.userRole` but does not verify that the authenticated user is a merchant for the payment's order. A user with a forged or elevated `merchant` role could refund any payment if the role check in line 167 is not properly enforced by middleware.

**Impact:**
Unauthorized refunds if role-based authorization is weak.

**Fix hint:**
Add a second IDOR check in `processRefund`: verify that the authenticated merchant's store matches the payment's order's merchant store.

---

## BE-PAY-019
**Title:** statusHandler parameter ambiguity: both paymentId and orderId map to the same variable

**Severity:** LOW

**File:** `/rez-payment-service/src/routes/paymentRoutes.ts` (lines 194-208)

**Category:** Ledger correctness

**Description:**
Line 197: `const paymentId = req.params.paymentId || req.params.orderId;`. The route has two paths (line 207-208), one with `:paymentId` and one with `:orderId`. If a caller provides an `orderId` that looks like a `paymentId` (e.g., both are hex strings), the service might return the wrong payment or fail to find a match.

**Impact:**
Potential data lookup mismatch; a payment for order X could be returned when querying for orderId X if the IDs collide in format.

**Fix hint:**
Validate that the parameter matches the expected format: `paymentId` starts with `pay_`, `orderId` is an ObjectId or order number.

---

## BE-PAY-020
**Title:** No limit on number of audits returned per payment; could cause memory exhaustion

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 513-515)

**Category:** Concurrency, ledger correctness

**Description:**
The `getPaymentAuditTrail` function returns up to 200 audit logs (hard-coded limit). A payment with many refund attempts could have more than 200 entries. The API response would truncate silently, and the client would see an incomplete audit trail without indication of truncation.

**Impact:**
Silent data loss: audit trails longer than 200 entries are truncated without client knowledge.

**Fix hint:**
Add `hasMore` flag to the response, and support pagination via `skip` and `limit` query parameters.

---

## BE-PAY-021
**Title:** Razorpay order creation receipt field uses random bytes but should be idempotent

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/routes/paymentRoutes.ts` (line 255)

**Category:** Idempotency keys

**Description:**
If the `receipt` parameter is not provided, it generates a new one: `receipt || \`rcpt_${crypto.randomBytes(8).toString('hex')}\``. Two concurrent requests for the same order without a receipt would generate different receipts, creating separate Razorpay orders. The service should derive the receipt from a stable source (e.g., order ID) to ensure idempotency.

**Impact:**
Concurrent payment initiations without explicit receipts could create duplicate Razorpay orders.

**Fix hint:**
Derive receipt from orderId: `receipt || \`rcpt_${orderId.substring(0, 16)}\``, ensuring the same order always gets the same Razorpay receipt.

---

## BE-PAY-022
**Title:** Festival between payment capture in session and walletCreditedAt timestamp could cause time-skew issues

**Severity:** LOW

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 357-358, 389)

**Category:** Settlement, timestamp precision

**Description:**
The `completedAt` timestamp is set to `new Date()` inside the transaction (line 357), but `walletCreditedAt` is set separately after the transaction (line 389). If the wallet credit is delayed by several seconds, the timestamps will be inconsistent, and reconciliation logic relying on `walletCreditedAt - completedAt` delta could misinterpret the delay as a system lag or failure.

**Impact:**
Reconciliation heuristics based on timestamp deltas could incorrectly flag a successful wallet credit as delayed.

**Fix hint:**
Set both timestamps in the same transaction, or use a single `credentialsAppliedAt` field.

---

## BE-PAY-023
**Title:** expiresAt TTL index uses partialFilterExpression but does not account for expired payments that are already completed

**Severity:** LOW

**File:** `/rez-payment-service/src/models/Payment.ts` (lines 120-123)

**Category:** Settlement, ledger correctness

**Description:**
The TTL index is `{ expiresAt: 1 }` with `partialFilterExpression: { status: { $nin: ['completed'] } }`. This ensures completed payments are never auto-deleted. However, if a payment is marked as "expired" after failing to complete, the `expiresAt` field is never set, so the TTL index never triggers, and the document persists forever. This is correct behavior, but could accumulate many expired payment records.

**Impact:**
Database bloat: expired payment records are never automatically cleaned up. (Note: this is likely intentional for audit purposes.)

**Fix hint:**
If storage is a concern, add a separate cleanup job to archive old expired payments to a cold-storage collection.

---

## BE-PAY-024
**Title:** Merchant settlement history does not verify order ownership; potential information disclosure

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 687-705)

**Category:** IDOR, merchant isolation

**Description:**
The `getMerchantSettlements` function filters by `'metadata.merchantId': merchantId`. However, the Payment model's `metadata` field is untyped (Mixed), and there is no guarantee that `metadata.merchantId` is always populated. If a payment is created without a merchantId in metadata, it won't be returned, and the merchant could miss settlements.

**Impact:**
Incomplete settlement history if metadata is inconsistently populated.

**Fix hint:**
Require `metadata.merchantId` on all payment initiations, and validate it matches the authenticated merchant before returning settlements.

---

## BE-PAY-025
**Title:** Concurrent webhook and capture API could both credit wallet; no idempotency on wallet credit

**Severity:** HIGH

**File:** `/rez-payment-service/src/services/paymentService.ts` (lines 387-393, 585-591)

**Category:** Double-spend prevention, settlement

**Description:**
If both the capture API call (lines 387-393) and the webhook handler (lines 585-591) execute concurrently, both will attempt to credit the wallet via `creditWalletAfterPayment()`. The BullMQ job has `jobId: \`pay-credit-${payment.paymentId}\`` (line 41), which should deduplicate on retry. However, if the first credit succeeds and the second credit is enqueued before the `walletCredited: true` flag is set, both jobs will execute independently, crediting the wallet twice.

**Impact:**
Wallet balance corruption: coins credited twice for a single payment.

**Fix hint:**
Set `walletCredited: true` inside the transaction that marks the payment as completed, before enqueueing the wallet credit job. Or use a distributed idempotency key in the wallet service itself.

---

## BE-PAY-026
**Title:** No validation that razorpaySignature is hex-encoded before timingSafeEqual comparison

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/services/razorpayService.ts` (lines 50-62)

**Category:** Signature verification

**Description:**
The `verifySignature` function assumes the signature is hex-encoded and calls `Buffer.from(signature, 'hex')`. If the signature is not valid hex (e.g., contains non-hex characters), `Buffer.from()` will silently truncate or return a malformed buffer, causing the comparison to fail even for valid signatures.

**Impact:**
Valid signatures with non-standard encoding could be rejected. (Impact is low because Razorpay always provides hex-encoded signatures, but the error handling is implicit.)

**Fix hint:**
Validate hex encoding: `if (!/^[a-f0-9]+$/i.test(signature)) throw new Error('Invalid signature encoding');`

---

## BE-PAY-027
**Title:** withTimeout promise race can leave dangling Razorpay API request if timeout fires

**Severity:** MEDIUM

**File:** `/rez-payment-service/src/services/razorpayService.ts` (lines 22-29)

**Category:** Idempotency keys, double-spend prevention

**Description:**
The `withTimeout` function uses `Promise.race()`, which does not cancel the original promise. If the timeout fires at 10 seconds, the Razorpay API request continues in the background. If the caller retries, a new request is made, and both could eventually complete, creating two orders/refunds.

**Impact:**
Duplicate Razorpay operations if the client retries after a timeout.

**Fix hint:**
Use AbortController to cancel the Razorpay API request when the timeout fires, or implement idempotency at the Razorpay API level (Razorpay's SDK may support this natively).

---

## Summary

Total bugs identified: 27

**Critical (2):** BE-PAY-001 (floating-point precision), BE-PAY-002 (replay attacks with degraded Redis)
**High (3):** BE-PAY-009 (webhook verification), BE-PAY-017 (merchant IDOR), BE-PAY-025 (double-wallet credit)
**Medium (18):** Various amount calculation, idempotency, transaction, and authorization issues
**Low (4):** Parameter ambiguity, audit immutability, TTL cleanup, timestamp precision

Focus remediation on Critical and High issues first, particularly replay protection and wallet double-crediting.
