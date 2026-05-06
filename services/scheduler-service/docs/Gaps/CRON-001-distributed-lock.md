# CRON-001: All node-cron Jobs Fire on Every Pod — No Distributed Lock

**Severity:** CRITICAL
**Category:** Concurrency / Multi-Instance Safety
**Gap ID:** CRON-001
**Services Affected:** rez-karma-service, rez-notification-events, rez-gamification-service, rezbackend
**Status:** ACTIVE
**Est Fix:** 3 hours
**Related:** BULL-001 (BullMQ worker concurrency)

---

## Description

All node-cron based jobs across 4 services fire on every pod/instance simultaneously. There is no distributed lock mechanism (Redis SETNX, Redlock, MongoDB advisory lock) to ensure a cron job runs on only one instance.

### Affected Files and Lines

| Service | File | Lines | Job |
|---------|------|-------|-----|
| rez-karma-service | `src/workers/decayWorker.ts` | 25 | Karma decay scheduler |
| rez-karma-service | `src/workers/batchScheduler.ts` | 70 | Weekly batch scheduler |
| rez-karma-service | `src/workers/autoCheckoutWorker.ts` | 215 | Hourly auto-checkout scanner |
| rez-notification-events | `src/workers/streakAtRiskWorker.ts` | 129 | Daily streak notification |
| rez-gamification-service | `src/worker.ts` | — | Gamification event worker |
| rezbackend | `src/config/cronJobs.ts` | 99-111 | Integration reconciliation, etc. |

### Code Pattern

```typescript
// decayWorker.ts:23-35
cronJob = new CronJob(cronExpr, async () => {
  logger.info('[DecayWorker] Running decay job...');
  await runDecayJob();  // No lock check
  if (onComplete) { onComplete(); }
});
```

No `SETNX` lock acquisition before `runDecayJob()`. If 3 pods of karma-service are running, `runDecayJob()` executes 3× per cron schedule.

### Impact

- **Data corruption**: 3× karma decay runs simultaneously — karma values decayed 3× faster than intended
- **Duplicate notifications**: Streak-at-risk notifications sent 3× per day instead of 1×
- **Duplicate batch jobs**: Weekly batch creation runs 3× — possible duplicate karma records
- **Auto-checkout race**: Multiple pods process the same forgotten bookings — duplicate checkout processing
- **Increased load**: 3× Redis/MongoDB operations, 3× notification API calls

### Fix Direction

Implement Redis-based distributed lock using SETNX pattern:

```typescript
import Redis from 'ioredis';

const LOCK_TTL_SECONDS = 300; // 5 minute max lock

async function withDistributedLock(lockKey: string, fn: () => Promise<void>): Promise<void> {
  const redis = new Redis(process.env.REDIS_URL);
  const lockValue = `${process.env.HOSTNAME || 'pod'}-${Date.now()}`;
  const acquired = await redis.set(lockKey, lockValue, 'EX', LOCK_TTL_SECONDS, 'NX');
  if (!acquired) {
    logger.info(`[Lock] Could not acquire lock for ${lockKey}, skipping`);
    return;
  }
  try {
    await fn();
  } finally {
    // Only release if we still own the lock (compare-and-delete)
    const current = await redis.get(lockKey);
    if (current === lockValue) {
      await redis.del(lockKey);
    }
  }
}

// Usage:
cronJob = new CronJob('0 * * * *', async () => {
  await withDistributedLock('lock:decay-job', runDecayJob);
});
```

### References
- BullMQ `Scheduler` provides distributed scheduling via Redis
- Redlock algorithm for multi-pod consensus
- `redis-semaphore` npm package for distributed mutex
