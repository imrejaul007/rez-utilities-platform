# BULL-001: `removeOnComplete: true` Means "Don't Remove" — Unbounded Redis Memory Growth

**Severity:** CRITICAL
**Category:** BullMQ / Memory Leak
**Gap ID:** BULL-001
**Services Affected:** rezbackend
**Status:** ACTIVE
**Est Fix:** 1 hour
**Related:** BULL-006 (stale delayed jobs)

---

## Description

BullMQ's `removeOnComplete` accepts a boolean or an object. When set to `true` (boolean), it's treated as a no-op — completed jobs are NOT removed from Redis. This causes unbounded completed-job accumulation.

### Affected File

`src/services/QueueService.ts:273-278, 295-300`

```typescript
// Analytics processor:
return this.analyticsQueue.add('calculate-analytics', data, {
  attempts: 2,
  backoff: { type: 'fixed', delay: 10000 },
  removeOnComplete: true,  // <-- BUG: boolean true = don't remove
  removeOnFail: { count: 50 },
});

// Audit log queue:
return this.auditLogQueue.add('write-audit-log', data, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,  // <-- BUG: unbounded completed jobs retained
  removeOnFail: { count: 500, age: 604800 },
});
```

### BullMQ Behavior Reference

| `removeOnComplete` Value | Effect |
|--------------------------|--------|
| `true` (boolean) | Treated as count limit `true` → `Infinity` → **jobs NOT removed** |
| `{ count: 100 }` | Remove completed jobs, keep last 100 |
| `{ age: 3600 }` | Remove jobs older than 1 hour |
| `false` (boolean) | Don't remove (opposite of intended behavior) |

### Impact

- Completed analytics jobs accumulate indefinitely in Redis
- Redis memory grows unbounded — eventually Redis OOM or eviction
- `SCARD` on completed job lists grows to millions
- `FLUSHDB` or manual cleanup required periodically

### Fix Direction

```typescript
// Fix: use object form
return this.analyticsQueue.add('calculate-analytics', data, {
  attempts: 2,
  backoff: { type: 'fixed', delay: 10000 },
  removeOnComplete: { count: 100 },  // Keep last 100
  removeOnFail: { count: 50, age: 86400 },  // Keep failed jobs for 24h
});
```

Also audit all other queues in the codebase for the same pattern.
