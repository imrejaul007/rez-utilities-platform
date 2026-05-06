# CRON-002: node-cron `onComplete` Callback Cannot Be Async — Errors Silently Swallowed

**Severity:** CRITICAL
**Category:** Error Handling / Async Safety
**Gap ID:** CRON-002
**Services Affected:** rez-karma-service
**Status:** ACTIVE
**Est Fix:** 1 hour
**Related:** CRON-001

---

## Description

`node-cron`'s `onComplete` callback is synchronous. If it contains an async operation, thrown errors are uncaught and crash the process. The node-cron library does not support async `onComplete` callbacks.

### Affected File

`src/workers/decayWorker.ts:28-33`

```typescript
onComplete: () => {
  logger.info('Decay cron job completed');
  // This is sync. If it were async, uncaught rejection would crash the process.
},
```

The `onComplete` callback on line 30 is synchronous by design. Any async operation here (e.g., DB write, Redis update) would silently swallow errors via unhandled promise rejection.

### Impact

- Async errors in `onComplete` cause unhandled promise rejections
- Process can crash under load when decay completes and tries async cleanup
- No visibility into why the process crashed

### Fix Direction

Move all cleanup logic into `onTick` with try/finally:

```typescript
onTick: async () => {
  const lockKey = 'lock:decay-job';
  const acquired = await acquireLock(lockKey);
  if (!acquired) return;

  try {
    await runDecayJob();
    logger.info('Decay cron job completed');
  } catch (err) {
    logger.error('Decay cron job failed', { error: (err as Error).message });
  } finally {
    await releaseLock(lockKey);
  }
}
```

Do not use `onComplete` for any meaningful cleanup. Use try/finally inside `onTick` instead.
