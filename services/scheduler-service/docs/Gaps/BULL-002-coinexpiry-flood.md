# BULL-002: coinExpiry Unbounded Loop — Redis Flood with No Batch Delay

**Severity:** CRITICAL
**Category:** BullMQ / Redis Flood
**Gap ID:** BULL-002
**Services Affected:** rezbackend
**Status:** ACTIVE
**Est Fix:** 2 hours
**Related:** CRON-005 (same pattern — unbounded loops)

---

## Description

`coinExpiry.ts` runs three sequential loops (7-day, 3-day, 24-hour warnings), each potentially enqueueing tens of thousands of BullMQ jobs synchronously. No batching, no delays, no rate limiting.

### Affected File

`src/jobs/coinExpiry.ts:47-126`

```typescript
const sevenDayUsers = await aggregateWindow(in3d, in7d);
// could be 100,000+ users
logger.info(`[CoinExpiry] 7-day warning: ${sevenDayUsers.length} users`);

for (const entry of sevenDayUsers) {  // Sequential, no delay
  try {
    await notificationQueue.add('coin_expiry_warning', {
      userId: entry._id.toString(),
      coins: entry.totalCoins,
      expiresAt: expiryDate.toISOString(),
    });
  } catch (err) {
    logger.error(`[CoinExpiry] Failed to enqueue 7-day warning for user ${entry._id}:`, err);
  }
}
// Same for 3-day and 24-hour windows
```

### Impact

- Three sequential loops each potentially calling `notificationQueue.add()` 100,000+ times
- Each `add()` call is synchronous and individually awaits
- Blocks the event loop for the entire duration (could be minutes)
- Redis connection used for all three loops — potential connection exhaustion
- If the cron fires multiple times (CRON-001), hundreds of thousands of jobs created

### Fix Direction

```typescript
async function sendExpiryWarnings(
  windowUsers: Array<{ _id: ObjectId; totalCoins: number }>,
  windowName: string,
): Promise<void> {
  const BATCH_SIZE = 500;
  const BATCH_DELAY_MS = 100;

  for (let i = 0; i < windowUsers.length; i += BATCH_SIZE) {
    const batch = windowUsers.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map((entry) =>
        notificationQueue.add('coin_expiry_warning', {
          userId: entry._id.toString(),
          coins: entry.totalCoins,
          window: windowName,
        }),
      ),
    );
    if (i + BATCH_SIZE < windowUsers.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
}
```
