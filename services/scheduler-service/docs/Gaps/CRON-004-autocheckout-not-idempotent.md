# CRON-004: autoCheckoutWorker Not Idempotent — Duplicate Notifications on Retry

**Severity:** CRITICAL
**Category:** Idempotency / Notification
**Gap ID:** CRON-004
**Services Affected:** rez-karma-service
**Status:** ACTIVE
**Est Fix:** 2 hours

---

## Description

The `sendAutoCheckoutNotification` function has no deduplication key. If the same booking is processed twice (due to CRON-001 firing on multiple pods, or a retry after partial failure), two notifications fire for the same booking.

### Affected File

`src/workers/autoCheckoutWorker.ts:160-195`

```typescript
async function sendAutoCheckoutNotification(userId: string, bookingId: string): Promise<void> {
  // No dedup key — if called twice for same booking, two notifications fire
  const response = await fetch(`${notificationServiceUrl}/api/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': process.env.INTERNAL_SERVICE_TOKEN || '', // empty if unset!
    },
    body: JSON.stringify({ userId, bookingId, type: 'auto_checkout_reminder' }),
  });
}
```

And at line 135:
```typescript
await sendAutoCheckoutNotification(raw.userId as string, booking._id.toString());
```

### Additional Issue

Line 171-173: `INTERNAL_SERVICE_TOKEN || ''` means blank auth headers are sent if the env var is unset. The notification service may silently reject or accept these.

### Impact

- Users receive duplicate auto-checkout reminders when:
  - Multiple pods fire the cron simultaneously (CRON-001)
  - The outer loop retries after a partial failure
  - The cron fires twice due to clock drift or restart
- Blank auth token may cause notification API to return 401 — but the error is swallowed by `.catch(() => {})`

### Fix Direction

1. Add idempotency check using Redis:
```typescript
async function sendAutoCheckoutNotification(userId: string, bookingId: string): Promise<void> {
  const dedupKey = `autocheckout:sent:${bookingId}`;
  const alreadySent = await redis.set(dedupKey, '1', 'EX', 86400, 'NX');
  if (!alreadySent) {
    logger.info(`[AutoCheckout] Notification already sent for booking ${bookingId}`);
    return;
  }
  // ... proceed with notification
}
```

2. Validate auth token at startup:
```typescript
if (!process.env.INTERNAL_SERVICE_TOKEN) {
  throw new Error('INTERNAL_SERVICE_TOKEN is required but not set');
}
```
