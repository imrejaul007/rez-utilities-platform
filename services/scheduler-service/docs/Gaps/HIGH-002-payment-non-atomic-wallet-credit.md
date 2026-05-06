# HIGH-002: Payment Service Non-Atomic Wallet Credit — Potential Double Credit

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

The `walletCredited` flag and the BullMQ job enqueue are not atomic. If the service crashes between setting the flag and enqueuing the job (or vice versa), the wallet could be credited twice.

---

## Code Reference

**File:** `rez-payment-service/src/services/paymentService.ts`

```typescript
// NOT ATOMIC
await Payment.updateOne({ _id: paymentId }, { walletCredited: true });  // Step 1

await walletCreditQueue.add('credit', { userId, amount });              // Step 2
// If crash between Step 1 and 2: double credit on retry
// If crash before Step 1: double credit on retry
```

---

## Impact

- Double coin credits on payment webhook retries
- User gets 2x coins
- Financial reconciliation discrepancy

---

## Fix Required

Use idempotency key in the BullMQ job so retries don't duplicate:
```typescript
await walletCreditQueue.add('credit',
  { userId, amount, paymentId },
  {
    jobId: `wallet-credit-${paymentId}`,  // Idempotent by job ID
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  }
);

await Payment.updateOne({ _id: paymentId }, { walletCredited: true, walletCreditJobId: jobId });
```

---

## Related

- [CRITICAL-003-merchant-withdrawal-race-condition](CRITICAL-003-merchant-withdrawal-race-condition.md)
- [CRITICAL-005-karma-2x-inflation](CRITICAL-005-karma-2x-inflation.md)
