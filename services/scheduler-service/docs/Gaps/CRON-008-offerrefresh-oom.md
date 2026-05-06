# CRON-008: offerRefresh Loads All User IDs Into Memory

**Severity:** HIGH
**Category:** Performance / Memory Safety
**Gap ID:** CRON-008
**Services Affected:** rez-finance-service
**Status:** ACTIVE
**Est Fix:** 1 hour
**Related:** CRON-005 (same pattern)

---

## Description

`offerRefreshJob` loads all user IDs from `CreditProfile` into memory before processing in batches. If 500,000 profiles were updated in 30 days, this loads 500,000 ObjectIds.

### Affected File

`src/jobs/offerRefresh.ts:16-49`

```typescript
const profiles = await CreditProfile.find({
  rezScoreUpdatedAt: { $gte: cutoff }
})
  .select('userId')
  .lean();

logger.info('[OfferRefresh] Refreshing offers for users', { count: profiles.length });

for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
  const batch = profiles.slice(i, i + BATCH_SIZE);
  await Promise.allSettled(batch.map((p) => partnerService.refreshOffersForUser(p.userId)));
  if (i + BATCH_SIZE < profiles.length) {
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }
}
```

### Impact

- 500,000 `userId` ObjectIds loaded into heap at once (~20MB+ depending on serialization)
- Processing loop loads all IDs, then processes in batches — the batch processing is good but the initial load defeats it
- Under MongoDB memory pressure, the `.lean()` query itself may fail

### Fix Direction

```typescript
const cursor = CreditProfile.find({
  rezScoreUpdatedAt: { $gte: cutoff }
})
  .select('userId')
  .batchSize(500)
  .cursor();

let batch: Types.ObjectId[] = [];

for await (const profile of cursor) {
  batch.push(profile.userId);
  if (batch.length >= BATCH_SIZE) {
    await processBatch(batch);
    batch = [];
  }
}

if (batch.length > 0) {
  await processBatch(batch);
}
```
