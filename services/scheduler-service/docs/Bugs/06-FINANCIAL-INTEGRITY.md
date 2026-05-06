# Bug Report: Financial Integrity & Payment Flow

**Audit Date:** 2026-04-13
**Layer:** Wallet service, payment service, finance service, coin credit flows
**Status:** CRITICAL — financial losses occurring silently in production

---

## C9 — Coin credit after payment is fire-and-forget with no retry, no DLQ, no flag {#c9}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Users who pay successfully never receive coins. No alert fires. No record shows the failure.

**What is happening:**
In both `capturePayment` and `handleWebhookCaptured`, the call to award coins after a successful Razorpay payment is:

```typescript
creditWalletAfterPayment(paymentId, userId, amount).catch(() => {})
```

- `.catch(() => {})` silently swallows all errors
- The `walletCredited: Boolean` field on the `Payment` model is **never set to `true`** — it stays `false` forever after a successful credit, making the field useless for auditing
- There is no retry queue, no dead-letter queue, no cron that re-tries failed credits
- The reconciliation cron (`runReconciliation()`) recovers stuck payments but does **not** call `creditWalletAfterPayment` for recovered payments

**Files involved:**
- `rez-payment-service/src/services/paymentCaptureService.ts` — `.catch(() => {})` on wallet credit
- `rez-payment-service/src/services/webhookService.ts` — same pattern
- `rez-payment-service/src/models/Payment.ts` — `walletCredited: Boolean` (default false, never updated)
- `rez-payment-service/src/services/reconciliationService.ts` — `runReconciliation()` missing wallet credit call

**Scenario causing loss:**
1. User pays ₹500 at 14:00
2. Razorpay webhook fires at 14:00:01
3. Payment captured successfully
4. Wallet service has a 2-second restart at 14:00:02
5. `creditWalletAfterPayment` fails silently
6. `walletCredited` stays `false`
7. No retry. User never gets coins. No alert. No way to find this in logs at scale.

**Fix:**
1. Write `walletCredited = true` + `walletCreditedAt = now` after successful credit
2. Add a BullMQ `wallet-credit-events` queue with 5 retry attempts, exponential backoff
3. Add a cron (every 15 min) that finds `Payment` where `status='completed'` and `walletCredited=false` and re-attempts credit with the stable idempotency key `pay-credit-{paymentId}`
4. Call `creditWalletAfterPayment` inside `runReconciliation()` for recovered payments

---

## C10 — Merchant double-payout race condition in payoutRoutes.ts {#c10}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** A merchant can receive 2× their requested withdrawal amount simultaneously.

**What is happening:**
`POST /payouts/request` in `rez-wallet-service/src/routes/payoutRoutes.ts`:

```typescript
// Step 1 — read (not atomic with step 2)
const wallet = await MerchantWallet.findOne({ merchantId });
if (wallet.balance.available < amountPaise) throw 'Insufficient';

// Step 2 — write (separate operation, balance NOT decremented here)
await db.collection('merchantpayouts').insertOne({ amountPaise, status: 'pending' });
```

The balance deduction only happens at `PATCH /payouts/:id/process` time. Between request and process, any number of concurrent payout requests can pass the balance check.

There is also a **second parallel payout system**: `merchantWalletService.requestWithdrawal()` which IS atomic (moves funds to `balance.pending` via `findOneAndUpdate` with balance guard). The two systems write to different collections (`merchantpayouts` vs `MerchantWalletTransaction`) with no mutual exclusion.

**Files involved:**
- `rez-wallet-service/src/routes/payoutRoutes.ts` — non-atomic balance check
- `rez-wallet-service/src/services/merchantWalletService.ts` — `requestWithdrawal()` (correct, atomic)
- Collections: `merchantpayouts` (raw, no Mongoose schema) vs `MerchantWalletTransaction` (Mongoose model)

**Example:**
Merchant balance: ₹10,000. Two simultaneous `POST /payouts/request` for ₹8,000 each. Both pass balance check. Both insert. Total committed: ₹16,000. Financial loss: ₹6,000.

**Fix:**
1. Deprecate the `payoutRoutes.ts` path entirely. Route all payout requests through `merchantWalletService.requestWithdrawal()`.
2. OR fix `payoutRoutes.ts` to use atomic `findOneAndUpdate` that decrements `balance.available` and moves to `balance.pending` in a single operation (same pattern as `requestWithdrawal`).
3. Add Mongoose model + validation to replace raw `db.collection('merchantpayouts')`.

---

## H14 — `walletCredited` flag never set — payment records unreliable for audit {#h14}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Operators cannot audit which payments resulted in coin credits. Reconciliation has no signal to retry.

**What is happening:**
`Payment` model has fields:
```typescript
walletCredited: { type: Boolean, default: false }
walletCreditedAt: Date
```

These fields are defined but the value is never changed from `false`. No code in the payment service writes `walletCredited = true`. Consequence: every payment record looks like the coin credit failed, even when it succeeded.

**Files involved:**
- `rez-payment-service/src/models/Payment.ts` — field defined, never written
- `rez-payment-service/src/services/paymentCaptureService.ts` — `creditWalletAfterPayment` call with no follow-up write

**Fix:**
In `creditWalletAfterPayment`, on successful HTTP response from wallet service:
```typescript
await Payment.findByIdAndUpdate(paymentId, {
  walletCredited: true,
  walletCreditedAt: new Date()
});
```

---

## H15 — Reconciliation job marks payment `completed` but never credits wallet {#h15}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Any user whose payment is recovered via the 15-minute reconciliation cron loses their coins permanently.

**What is happening:**
`reconciliationService.ts` runs every 15 minutes and finds `processing` payments older than 30 minutes. It polls Razorpay and marks them `completed` if Razorpay confirms capture. It does **not** call `creditWalletAfterPayment` after marking them complete.

This affects any payment where:
- The webhook was missed or failed
- The primary capture flow timed out
- Redis was down during the capture

**Files involved:**
- `rez-payment-service/src/services/reconciliationService.ts` — `runReconciliation()` missing wallet credit call

**Fix:**
After marking payment `completed`:
```typescript
await creditWalletAfterPayment(payment._id, payment.userId, payment.amount);
```
The idempotency key `pay-credit-{paymentId}` in the wallet service will prevent double-credit if the webhook also fires.

---

## H16 — Coin deduction is not atomic with payment — no saga/compensation {#h16}
> **Status:** ⏳ DEFERRED — saga pattern requires order-service refactor; tracked for Phase 2

**Severity:** HIGH
**Impact:** User can lose coins with no order created if the service crashes at the wrong moment.

**What is happening:**
When a user redeems coins at checkout:
1. Wallet service `/internal/debit` is called → coins deducted
2. Order service confirms the order → separate HTTP call

These are two separate HTTP calls with no distributed transaction. If the order service crashes or returns an error after step 1 completes, the user's coins are gone with no corresponding order.

There is no compensating transaction (saga rollback) visible in the codebase.

**Files involved:**
- `rezbackend/rez-backend-master/src/controllers/storePaymentController.ts` — payment + coin deduction sequence
- `rez-wallet-service/src/services/walletService.ts` — `debitCoins()` (correct internally, no saga support)

**Fix:**
Implement a saga pattern:
1. Create order in `pending` state
2. Debit coins with `referenceId = orderId`
3. Confirm order
4. If step 3 fails: call `creditCoins` with same `referenceId` to reverse deduction (idempotent refund)

---

## H17 — `instantRewardService` uses `Date.now()` in referenceId — double coins on retry {#h17}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Coin awards are not idempotent. Any retry (BullMQ, webhook re-delivery, network timeout) double-awards coins.

**What is happening:**
```typescript
// instantRewardService.ts
referenceId: `checkin:${storeId}:${userId}:${Date.now()}`
referenceId: `billupload:${userId}:${Date.now()}`
```

`Date.now()` changes on every call. This means the `CoinTransaction` idempotency index (`{user, idempotencyKey}`) sees a different key each retry and allows a new insert. The same check-in event can award coins 2, 3, or N times.

**Files involved:**
- `rezbackend/rez-backend-master/src/services/instantRewardService.ts` — `onVisitCheckin()`, `onBillUpload()`

**Fix:**
Use a stable deterministic key:
```typescript
referenceId: `checkin:${storeId}:${userId}:${visitId}`
referenceId: `billupload:${userId}:${billId}`
```
The entity ID (visitId, billId) is already available at call time and is naturally idempotent.

---

## H33 — `debitInPriorityOrder` balanceBefore computed from stale in-memory variable {#h33}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** CoinTransaction audit records have wrong `balanceBefore`/`balanceAfter` values for multi-tier debits. Reconciliation produces incorrect results.

**What is happening:**
`debitInPriorityOrder` in the wallet service:
1. Reads wallet balance → stores in `runningBalance` (in-memory)
2. Plans the split across coin types (promo → branded → prive → rez)
3. Executes a single `findOneAndUpdate` with the total amount
4. Writes individual `CoinTransaction` records per tier using `runningBalance - tierAmount` as `balanceBefore`

If a concurrent debit fires between step 1 (read) and step 3 (atomic write), `runningBalance` is stale. The `CoinTransaction` records will show incorrect before/after snapshots, while the actual balance is correctly updated by the `$gte` guard.

**Files involved:**
- `rez-wallet-service/src/services/walletService.ts` — `debitInPriorityOrder()`

**Fix:**
Derive `balanceBefore` from the value returned by `findOneAndUpdate` (the pre-update document snapshot), not from the pre-read in-memory variable.

---

## M11 — Finance service bill pay / recharge are Phase 1 stubs reachable in production {#m11}
> **Status:** ⏳ DEFERRED — Phase 2 feature; 501 gate added, aggregator integration not yet built

**Severity:** MEDIUM
**Impact:** Users can create phantom `pending` FinanceTransaction records with no real gateway call. Accumulates unresolved debt records.

**What is happening:**
`rez-finance-service/src/routes/payRoutes.ts`:
```typescript
// POST /finance/pay/bill
logger.warn('STUB: bill payment not yet implemented');
// Creates FinanceTransaction with status: 'pending'
// No actual payment gateway call
```

If these routes are accessible in production (no environment gate), users can POST to them and get a `pending` transaction back. No money moves. No coins award. Record sits in DB forever.

**Files involved:**
- `rez-finance-service/src/routes/payRoutes.ts` — bill pay and recharge stubs

**Fix:**
Either: gate behind `if (process.env.PHASE >= 2)` and return 501 Not Implemented in Phase 1, OR add an explicit `enabled: false` config check that returns a clear error response.

---

## M12 — Redis rate limiter on wallet debit fails OPEN — unlimited debits on Redis failure {#m12}
> **Status:** ✅ FIXED

**Severity:** MEDIUM
**Impact:** If Redis goes down, the 10 debits/minute per user rate limit is completely disabled.

**What is happening:**
`walletRoutes.ts: checkWalletRateLimit()` returns `true` (allow) on Redis connection error. This means during any Redis outage, the debit endpoint accepts unlimited requests per user per minute. MongoDB's transaction and balance guard still prevents negative balance, but creates unnecessary DB pressure and bypasses the DoS protection.

**Files involved:**
- `rez-wallet-service/src/routes/walletRoutes.ts` — `checkWalletRateLimit()` fail-open behavior

**Fix:**
On Redis unavailable, return `false` (deny) with a 503 response that is retryable, rather than allowing through. Or use a circuit breaker pattern with a local in-memory fallback counter.

---

## M13 — WalletOperationQueue drain is credits-only — debits hard-fail on Redis downtime {#m13}
> **Status:** ⏳ DEFERRED — debit queue fallback requires significant rework; documented as known limitation

**Severity:** MEDIUM
**Impact:** During Redis downtime, coin credits are queued and eventually applied; coin debits hard-fail with 503. A partial flow (debit attempted before Redis failure, credit applied after recovery) can leave the balance higher than expected.

**What is happening:**
`server.ts` initializes a `walletOperationQueue` that drains every 5 seconds for `creditCoins()` operations only. `debitCoins()` has no equivalent fallback queue.

**Files involved:**
- `rez-wallet-service/src/server.ts` — `walletOperationQueue` drain loop

**Fix:**
Either extend the drain queue to cover debits with the same idempotency guarantee, or document explicitly that debits will fail during Redis downtime and ensure the caller has a retry path.
