# CRITICAL-015: Finance Service Silent Coin Award Failure — No Retry, No Alerting

## Severity: P1 — Business Logic / Reliability

## Date Discovered: 2026-04-16
## Phase: Phase 6 — Business Logic Consistency + Phase 11 — Error Handling

---

## Issue Summary

The finance service attempts to award coins for rewards, BNPL repayments, and referral bonuses via the wallet service. When `WALLET_SERVICE_URL` is unset or the call fails, the error is caught and silently dropped — no retry, no dead-letter queue, no alerting. Users don't receive coins and never know why.

---

## Affected Services

| Service | Impact |
|---------|--------|
| `rez-finance-service` | All coin awards silently fail if wallet service unreachable |

---

## Code Reference

**File:** `rez-finance-service/src/services/rewardsHookService.ts:28-31`

```typescript
// Finance service tries to credit coins
const walletUrl = process.env.WALLET_SERVICE_URL;
if (!walletUrl) {
  // Silent failure — no error thrown, no log at error level
  logger.warn('WALLET_SERVICE_URL not configured — skipping coin credit');
  return;  // ← User never gets their coins
}

// HTTP call to wallet service
try {
  await axios.post(`${walletUrl}/api/wallet/credit`, { /* ... */ });
} catch (err) {
  // Silent failure — only warn, no retry, no DLQ
  logger.warn('Wallet credit failed', { error: err.message });
  return;  // ← Coins not credited, user loses out
}
```

Compare with correct pattern from other services:
```typescript
// Should use BullMQ for reliable delivery
await walletCreditQueue.add('credit', {
  userId, amount, reason, retryCount: 0
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnFail: false  // Keep in failed queue for inspection
});
```

---

## Impact

- **Users silently lose coin rewards** — BNPL repayment bonuses, referral rewards, loyalty points
- **No dead-letter queue** — failed awards are never retried
- **No alerting** — operations team has no visibility into failed awards
- **Revenue impact** — gamification incentives fail, reducing engagement
- **Trust erosion** — users expect coins when promised

---

## Root Cause

The finance service was built in isolation without adopting the shared idempotency patterns from `rez-shared/idempotency`. The BullMQ pattern used in other services was not applied here.

---

## Fix Required

1. **Implement BullMQ for reliable coin awards:**
   ```typescript
   import { Queue } from 'bullmq';
   import { getRedisConnection } from '@rez/shared';

   const walletCreditQueue = new Queue('wallet-credit', {
     connection: getRedisConnection(),
     defaultJobOptions: {
       attempts: 3,
       backoff: { type: 'exponential', delay: 1000 },
       removeOnFail: false  // Preserve for investigation
     }
   });

   // In rewards hook:
   await walletCreditQueue.add('credit', {
     userId,
     amount,
     reason: 'bnpl_repayment_bonus',
     idempotencyKey: `bnpl-${repaymentId}-bonus`,
     timestamp: Date.now()
   });
   ```

2. **Add a failed jobs worker:**
   ```typescript
   // Process failed coin awards
   walletCreditQueue.on('failed', (job, err) => {
     logger.error('WALLET_CREDIT_FAILED', {
       jobId: job.id,
       userId: job.data.userId,
       amount: job.data.amount,
       reason: err.message,
       attempts: job.attemptsMade
     });
     // Alert operations team
    alertService.notify('finance-ops', `Coin award failed for user ${job.data.userId}`);
   });
   ```

3. **Add health check:**
   ```typescript
   app.get('/health/wallet-queue', async (req, res) => {
     const failedCount = await walletCreditQueue.getFailedCount();
     const waitingCount = await walletCreditQueue.getWaitingCount();
     res.json({
       walletServiceConfigured: !!process.env.WALLET_SERVICE_URL,
       failedCredits: failedCount,
       pendingCredits: waitingCount,
       healthy: failedCount === 0
     });
   });
   ```

---

## Related Gaps

- [CRITICAL-007-fraudflag-missing](CRITICAL-007-fraudflag-missing.md) — Same silent failure pattern
- [CRITICAL-011-internal-service-key-unvalidated](CRITICAL-011-internal-service-key-unvalidated.md) — Same env var misuse
