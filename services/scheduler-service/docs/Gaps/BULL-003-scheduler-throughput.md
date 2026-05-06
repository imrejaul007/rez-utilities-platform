# BULL-003: Scheduler Worker `concurrency: 1` + `limiter: { max: 1 }` = 12 Jobs/Min Max Throughput

**Severity:** HIGH
**Category:** BullMQ / Throughput
**Gap ID:** BULL-003
**Services Affected:** rez-scheduler-service
**Status:** ACTIVE
**Est Fix:** 1 hour
**Related:** CRITICAL-009 (three competing FSMs — different service)

---

## Description

The scheduler service worker is configured with both `concurrency: 1` and `limiter: { max: 1, duration: 5000 }`. The limiter is redundant with concurrency=1 and caps throughput at 12 jobs/minute. With 15 registered job queues, one slow job blocks all others.

### Affected File

`src/workers/index.ts:57-65`

```typescript
const worker = new Worker(jobName, async (job: Job) => {
  await processor(job);
}, {
  connection: redis,
  concurrency: 1,  // Only 1 concurrent job
  limiter: {
    max: 1,
    duration: 5000,  // Rate-limited to 1 per 5 seconds = 12/min
  },
});
```

### Impact

- With 15 queues, at most 1 job active across entire service
- A single slow job (settlement reconciliation at 30s) blocks all other queues
- Throughput: 12 jobs/minute maximum
- The `limiter` is completely redundant with `concurrency: 1` and adds overhead

### Fix Direction

```typescript
// Option A: Use per-queue concurrency
const worker = new Worker(jobName, async (job: Job) => {
  await processor(job);
}, {
  connection: redis,
  concurrency: 5,  // 5 concurrent jobs per worker
  limiter: {
    max: 20,      // 20 per duration
    duration: 5000,
  },
});

// Option B: Use BullMQ Scheduler for delayed/repeatable jobs
// Don't use node-cron at all — use BullMQ's built-in scheduling
const scheduler = new Scheduler({ connection: redis });
await scheduler.add(
  {
    name: 'settlement-reconciliation',
    data: {},
    opts: {
      repeat: { pattern: '0 0 * * *' },  // Daily at midnight
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 },
    },
  },
);
```
