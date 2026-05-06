# CRON-005: autoCheckoutWorker Sequential Loop — OOM Risk at Scale

**Severity:** CRITICAL
**Category:** Performance / Memory Safety
**Gap ID:** CRON-005
**Services Affected:** rez-karma-service
**Status:** ACTIVE
**Est Fix:** 2 hours

---

## Description

`processForgottenCheckouts` loads ALL matching bookings into memory with `.lean()`, then iterates sequentially with individual MongoDB lookups per booking. No pagination, no cursor, no parallelism.

### Affected File

`src/workers/autoCheckoutWorker.ts:73-144`

```typescript
const bookings = await EventBookingModel.find({
  qrCheckedIn: true,
  qrCheckedOut: false,
}).lean();  // Loads ALL matching bookings into memory at once

for (const booking of bookings) {  // Sequential, no batch
  // ...
  const event = await KarmaEvent.findById(eventId).lean();  // N queries per booking
}
```

### Impact

- If 50,000 bookings have `qrCheckedIn=true` and no checkout:
  - All 50,000 documents loaded into Node heap simultaneously
  - 50,000 sequential MongoDB lookups for event data
  - Job takes hours to complete
  - Node process may OOM under memory pressure
- Even 5,000 bookings at 1 query each = 5,000 round-trips

### Fix Direction

```typescript
async function processForgottenCheckouts(): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;
  const BATCH_SIZE = 100;

  // Use cursor for memory efficiency
  const cursor = EventBookingModel.find({
    qrCheckedIn: true,
    qrCheckedOut: false,
  }).cursor({ batchSize: BATCH_SIZE });

  for await (const booking of cursor) {
    try {
      await processBooking(booking);
      processed++;
    } catch (err) {
      errors.push(`booking ${booking._id}: ${(err as Error).message}`);
    }
  }

  return { processed, errors };
}
```

Also batch the event lookups:
```typescript
const eventIds = bookings.map(b => b.eventId);
const events = await KarmaEvent.find({ _id: { $in: eventIds } }).lean();
const eventMap = new Map(events.map(e => [e._id.toString(), e]));
```
