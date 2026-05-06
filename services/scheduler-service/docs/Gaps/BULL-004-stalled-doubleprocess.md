# BULL-004: No Job Timeout on Workers — Stalled Jobs Double-Process

**Severity:** HIGH
**Category:** BullMQ / Idempotency
**Gap ID:** BULL-004
**Services Affected:** rez-scheduler-service, rezbackend
**Status:** ACTIVE
**Est Fix:** 2 hours
**Related:** HIGH-005 (bulk order actions bypass FSM), BULL-005

---

## Description

BullMQ's default stall detection fires if a job's `lockDuration` (default 30s) expires before completion. With no custom `lockDuration` and no overall job timeout, slow jobs are marked as stalled and re-queued while still running — double processing.

### Affected Files

- `src/workers/index.ts` — scheduler service workers
- `src/services/QueueService.ts:491-781` — backend QueueService workers

### Code Pattern

```typescript
// Most processors have timeout on axios calls but no job-level timeout:
const response = await axios.post(url, data, {
  timeout: 30000,  // 30s timeout on HTTP
  // But: if axios returns at 29s and MongoDB write takes 60s, total = 89s
  // BullMQ default lockDuration = 30s → stall fires at 30s mark
  // Job is re-queued while original is still writing to MongoDB
});
```

BullMQ default: `lockDuration: 30000` (30s). If a job takes longer than 30s (e.g., slow DB write after HTTP call), it's marked stalled and re-queued.

### Impact

- Slow jobs double-process: original runs + re-queued copy
- Email sent twice (double email)
- Settlement reconciliation runs twice
- Coin credits applied twice (unless wallet service is idempotent)

### Fix Direction

```typescript
// Per-worker configuration:
const worker = new Worker(name, processor, {
  connection: redis,
  lockDuration: 60000,  // 1 minute lock
  maxStalledCount: 1,   // Fail after 1 stall
  stalledInterval: 30000,
});

// Per-job timeout:
await queue.add('job-name', data, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
});
```

Also add explicit timeouts to all async operations:
```typescript
const result = await Promise.race([
  doWork(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Job timeout')), 60000)),
]);
```
