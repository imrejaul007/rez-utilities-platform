# BULL-007: DLQ Cleanup Archives Without Deduplication — Duplicate Archives on Re-run

**Severity:** HIGH
**Category:** BullMQ / Data Integrity
**Gap ID:** BULL-007
**Services Affected:** rez-notification-events
**Status:** ACTIVE
**Est Fix:** 1 hour
**Related:** BULL-005 (homegrown DLQ issues)

---

## Description

The DLQ cleanup worker archives dead-letter entries to MongoDB using `insertMany` without deduplication. If the cleanup runs twice within the same `archiveCutoff` window, documents are inserted again.

### Affected File

`src/workers/dlqWorker.ts:221-233`

```typescript
if (toArchive.length > 0) {
  await DlqArchive.insertMany(toArchive.map((doc: any) => ({
    ...doc,
    archivedAt: now.toISOString(),
    originalCollection: 'dlq_log',
  })));
  // No unique index on _id or deduplication check
}
```

### Impact

- Duplicate DLQ archive entries if cleanup runs twice
- No unique constraint prevents duplicate archives
- Over time, archive collection grows with duplicate entries
- Analytics on archive data (failure patterns, retry rates) become inaccurate

### Fix Direction

```typescript
// Option A: Use upsert with dedup key
await Promise.all(
  toArchive.map((doc) =>
    DlqArchive.updateOne(
      { dlqId: doc.dlqId, originalCollection: doc.originalCollection },
      { $set: { ...doc, archivedAt: now.toISOString() } },
      { upsert: true },
    ),
  ),
);

// Option B: Add unique index and use insertMany with ordered: false + continueOnError
await DlqArchive.createIndexes([
  { key: { dlqId: 1, originalCollection: 1 }, unique: true },
]);

// Option C: Mark archived items in dlq_log before inserting to archive
await DlqLog.updateMany(
  { _id: { $in: toArchive.map((d) => d._id) } },
  { $set: { archived: true, archivedAt: now.toISOString() } },
);
```
