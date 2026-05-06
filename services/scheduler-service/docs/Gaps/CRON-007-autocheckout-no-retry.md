# CRON-007: autoCheckoutWorker Cron Has No Try/Catch — Failures Silently Suppressed

**Severity:** HIGH
**Category:** Error Handling / Silent Failure
**Gap ID:** CRON-007
**Services Affected:** rez-karma-service
**Status:** ACTIVE
**Est Fix:** 30 minutes
**Related:** CRON-003, CRON-004

---

## Description

The `processForgottenCheckouts()` call in the cron `onTick` has no try/catch. If it throws, node-cron's error handling may suppress it with no visibility.

### Affected File

`src/workers/autoCheckoutWorker.ts:215-221`

```typescript
cronJob = new CronJob('0 * * * *', async () => {
  logger.info('[AutoCheckoutWorker] Starting hourly scan...');
  const result = await processForgottenCheckouts();  // No try/catch!
  if (onComplete) { onComplete(result); }
});
```

The function returns a result object with errors, but the caller never inspects it for failures. Errors accumulate in `result.errors` but are only logged at line 146 — no escalation.

### Impact

- If `processForgottenCheckouts()` throws, the failure is suppressed by node-cron
- Hourly scan silently stops — no notifications sent, no monitoring alert
- Admin has no visibility into why bookings are no longer being auto-checked out

### Fix Direction

```typescript
cronJob = new CronJob('0 * * * *', async () => {
  logger.info('[AutoCheckoutWorker] Starting hourly scan...');
  try {
    const result = await processForgottenCheckouts();
    if (result.errors.length > 0) {
      logger.warn('[AutoCheckoutWorker] Scan completed with errors', {
        processed: result.processed,
        errorCount: result.errors.length,
        sampleErrors: result.errors.slice(0, 5),
      });
    } else {
      logger.info('[AutoCheckoutWorker] Scan completed', { processed: result.processed });
    }
    if (onComplete) { onComplete(result); }
  } catch (err) {
    logger.error('[AutoCheckoutWorker] Scan crashed', {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    // Forward to BullMQ for retry with alerting
    throw err; // Re-throw so node-cron logs it
  }
});
```
