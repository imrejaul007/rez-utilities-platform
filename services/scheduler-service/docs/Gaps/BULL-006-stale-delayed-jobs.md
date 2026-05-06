# BULL-006: Stale Delayed Job Accumulation — `clean(0, 10000)` Only Removes 10K Per Startup

**Severity:** HIGH
**Category:** BullMQ / Memory Management
**Gap ID:** BULL-006
**Services Affected:** rezbackend
**Status:** ACTIVE
**Est Fix:** 1 hour
**Related:** BULL-001 (unbounded Redis growth)

---

## Description

`ScheduledJobService` cleans stale delayed jobs at startup with `queue.clean(0, 10000, 'delayed')`. This removes only 10,000 per invocation. If 500,000+ stale delayed jobs exist, the remaining 490,000+ fire in rapid succession on next startup.

### Affected File

`src/services/ScheduledJobService.ts:628-636`

```typescript
// Drain accumulated delayed instances left over from previous restarts.
await this.queue.clean(0, 10000, 'delayed');  // Only 10K per invocation

// Also: hardcoded cleanup limits:
await this.queue.clean(24 * 60 * 60 * 1000, 1000, 'completed');  // Only 1000
await this.queue.clean(72 * 60 * 60 * 1000, 1000, 'failed');       // Only 1000
```

### Impact

- After prolonged outage, 490,000+ stale delayed jobs fire at once on restart
- Each fires a settlement reconciliation, notification, etc. — massive load spike
- `clean(0, 10000)` on large sorted sets can take 30+ seconds
- `clean(age, count, 'completed')` with `count=1000` means fail jobs grow unbounded over time

### Fix Direction

```typescript
async function cleanStaleJobs(queue: Queue, type: 'delayed' | 'completed' | 'failed'): Promise<void> {
  const BATCH_SIZE = 50000;
  let totalCleaned = 0;

  while (true) {
    const cleaned = await queue.clean(0, BATCH_SIZE, type);
    totalCleaned += cleaned;
    if (cleaned < BATCH_SIZE) break;
  }

  logger.info(`[ScheduledJobService] Cleaned ${totalCleaned} stale ${type} jobs`);
}

// Use loop for delayed (potentially huge):
await cleanStaleJobs(this.queue, 'delayed');

// Use reasonable limits for completed/failed:
await this.queue.clean(24 * 60 * 60 * 1000, 10000, 'completed');
await this.queue.clean(72 * 60 * 60 * 1000, 10000, 'failed');
```

### References
- BULL-001: `removeOnComplete: true` causes unbounded completed job growth
