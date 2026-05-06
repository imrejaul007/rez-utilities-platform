# CRON-003: batchScheduler Catches and Swallows All Errors — Job Fails Silently

**Severity:** CRITICAL
**Category:** Error Handling / Silent Failure
**Gap ID:** CRON-003
**Services Affected:** rez-karma-service
**Status:** ACTIVE
**Est Fix:** 1 hour
**Related:** CRITICAL-015 (finance service silent coin failure), NA2-HIGH-04

---

## Description

`batchScheduler.ts` wraps the weekly batch creation in a try/catch that never rethrows. If `createWeeklyBatch()` permanently fails (e.g., schema mismatch, DB down), the job silently fails every week with only log entries.

### Affected File

`src/workers/batchScheduler.ts:48-53`

```typescript
async function runWeeklyBatchCreation(): Promise<void> {
  log.info('[BatchScheduler] Starting weekly batch creation...');
  try {
    const batches = await createWeeklyBatch();
    // ...
  } catch (err) {
    log.error('[BatchScheduler] Weekly batch creation failed', {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    // Don't rethrow — keep the cron job alive for the next scheduled run
    // <-- PROBLEM: no rethrow, no BullMQ retry, no DLQ, no alert
  }
}
```

### Impact

- Weekly batch creation silently fails every week if `createWeeklyBatch()` is broken
- No BullMQ retry mechanism — job is lost on failure
- No DLQ entry for later inspection
- No alert escalation (PagerDuty, Slack)
- Karma weekly batch records stop being created — users stop earning weekly batch karma

### Fix Direction

```typescript
async function runWeeklyBatchCreation(): Promise<void> {
  log.info('[BatchScheduler] Starting weekly batch creation...');
  const result = await runWithRetry(createWeeklyBatch, {
    retries: 3,
    backoff: { type: 'exponential', delay: 60000 },
    onFailed: (err) => {
      // Send alert
      logger.error('[BatchScheduler] Batch creation failed after retries', { error: err.message });
    },
  });
  if (!result.success) {
    throw new Error(`Batch creation failed: ${result.error?.message}`);
  }
}
```

Or forward to a BullMQ queue with retry and DLQ configured.
