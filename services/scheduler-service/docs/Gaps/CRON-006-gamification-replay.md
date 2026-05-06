# CRON-006: Gamification Worker Replays Entire Event on Partial Failure Retry

**Severity:** HIGH
**Category:** Business Logic / Idempotency
**Gap ID:** CRON-006
**Services Affected:** rez-gamification-service
**Status:** ACTIVE
**Est Fix:** 3 hours
**Related:** HIGH-005 (bulk actions bypass FSM)

---

## Description

When a sub-operation in the gamification worker fails, the error is rethrown and BullMQ retries the entire event. Already-succeeded sub-operations (e.g., streak already incremented, achievement already awarded) run again on retry.

### Affected File

`src/worker.ts:168-274`

```typescript
const errors: string[] = [];
// 1. Achievement progress
try { ... } catch (err: any) { errors.push(`achievement:${err.message}`); }
// 2. Challenge progress
try { ... } catch (err: any) { errors.push(`challenge:${err.message}`); }
// ... 5 more sub-operations

if (errors.length > 0) {
  logger.warn('[Worker] Some handlers failed', { eventId: event.eventId, errors });
  throw new Error(`Partial failure: ${errors.join('; ')}`); // Rethrown — entire event retried
}
```

The retry replays the ENTIRE event. Already-succeeded operations run again.

### Assessment

The streak update uses atomic `findOneAndUpdate` with upsert — re-processing the same event on retry is safe (idempotent). The achievement check at `achievementWorker.ts:281-335` uses `upsertedCount === 0` as a DB guard, preventing double-award.

However, the wallet service call (if it was the failing sub-operation) would be retried, potentially creating duplicate coin credits unless the wallet service itself is idempotent.

### Impact

- If the wallet credit is the failing sub-operation, retry causes double credit
- If notification dispatch is the failing sub-operation, retry sends duplicate notifications
- Achievement already-awarded is protected by DB guard — safe
- Streak increment is protected by atomic upsert — safe

### Fix Direction

1. For non-idempotent sub-operations (wallet credit, notifications): add idempotency keys
2. Implement partial retry — only retry the failed sub-operation, not the entire event
3. Use a saga pattern with checkpoint state:

```typescript
interface EventProcessingState {
  eventId: string;
  completedSteps: string[];
  failedStep: string | null;
}

// After each sub-operation, write checkpoint to Redis
await redis.hset(`gamification:checkpoint:${eventId}`, {
  streakCompleted: 'true',
  achievementCompleted: 'true',
  // ...
});

// On retry, read checkpoint and skip completed steps
const checkpoint = await redis.hgetall(`gamification:checkpoint:${eventId}`);
if (checkpoint.streakCompleted !== 'true') {
  await updateStreak(event);
}
```
