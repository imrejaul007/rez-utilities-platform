# BULL-005: Home-Grown DLQ Uses Raw Redis List — Max 1000 Entries, No Retry, No Replay

**Severity:** HIGH
**Category:** BullMQ / Dead Letter Queue
**Gap ID:** BULL-005
**Services Affected:** rez-gamification-service
**Status:** ACTIVE
**Est Fix:** 3 hours
**Related:** MEDIUM-014 (no DLQ monitoring for notifications)

---

## Description

Gamification service uses raw Redis `LPUSH`/`LTRIM` for a DLQ instead of a BullMQ queue. The DLQ has a hard limit of 1000 entries — older entries are silently dropped. No job metadata, no retry, no replay mechanism.

### Affected Files

- `src/worker.ts:360-376`
- `src/workers/achievementWorker.ts:370-386`
- `src/workers/storeVisitStreakWorker.ts:305-321`

### Code Pattern

```typescript
// gamification worker.ts:361-376
if (job && job.attemptsMade >= (job.opts?.attempts ?? 1)) {
  const dlqKey = `dlq:${QUEUE_NAME}`;
  await bullmqRedis.lpush(dlqKey, JSON.stringify({...}));
  await bullmqRedis.ltrim(dlqKey, 0, 999);  // Max 1000 entries — older entries DROPPED
  logger.error(`[DLQ] Job moved to dead-letter queue`, {...});
}
```

### Issues

1. **Raw Redis list, not BullMQ queue** — no job metadata, no retry, no UI
2. **`LTRIM 0 999` drops oldest entries** — critical failed jobs permanently lost
3. **No idempotency guard** — if DLQ write fires twice (race), same job added twice
4. **No DLQ processing** — entries written but never consumed/inspected
5. **Inconsistent across services**:
   - `dlq:gamification-events` (worker.ts)
   - `dlq:achievement-events` (achievementWorker.ts)
   - `dlq:store-visit-events` (storeVisitStreakWorker.ts)
   - `notification-dlq` queue (notification-events — CORRECT pattern)

### Compare with Correct DLQ Pattern

In `notification-events/src/workers/dlqWorker.ts`:
```typescript
const dlqQueue = new Queue('notification-dlq', { connection: redis });
await dlqQueue.add('failed-notification', jobData, {
  attempts: 0,  // Don't retry
  removeOnComplete: false,  // Keep in DLQ
});
```

### Impact

- Critical gamification failures silently lost after 1000 DLQ entries
- No visibility into DLQ size, contents, or patterns
- Cannot replay failed jobs for debugging
- Inconsistent DLQ naming makes cross-service DLQ monitoring impossible

### Fix Direction

Replace raw Redis lists with BullMQ queues:
```typescript
import { Queue } from 'bullmq';

// Create a DLQ queue (per service, not per queue)
const gamificationDlq = new Queue('gamification-dlq', { connection: redis });

// On job failure (after all retries exhausted):
await gamificationDlq.add('failed-job', {
  originalQueue: QUEUE_NAME,
  jobId: job.id,
  failedReason: job.failedReason,
  attemptsMade: job.attemptsMade,
  data: job.data,
  timestamp: new Date().toISOString(),
}, {
  attempts: 0,  // Don't auto-retry from DLQ
  removeOnComplete: false,
});

// DLQ monitoring:
const counts = await gamificationDlq.getJobCounts();
logger.info('[DLQ] Gamification DLQ status', counts);
```
