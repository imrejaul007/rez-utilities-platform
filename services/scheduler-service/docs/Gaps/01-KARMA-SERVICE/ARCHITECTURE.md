# KARMA SERVICE — ARCHITECTURE GAPS

**Service:** `rez-karma-service`
**Date:** 2026-04-16
**Severity:** 5 MEDIUM, 3 LOW

---

## MEDIUM

---

### G-KS-A1 — lastDecayAppliedAt Not in Schema — Relies on (any) Cast

**File:** `src/models/KarmaProfile.ts`; `src/services/karmaService.ts`; `src/engines/karmaEngine.ts`
**Severity:** MEDIUM
**Category:** Architecture / Schema Integrity

**Code:**
```typescript
// karmaEngine.ts:294 and karmaService.ts:299:
(profile as any).lastDecayAppliedAt = delta.lastDecayAppliedAt;
```

**Root Cause:** `lastDecayAppliedAt` is referenced in `KarmaProfileDelta` type and `applyDailyDecay` sets it, but `KarmaProfileSchema` does **not** define it as a field. The field is set via `(profile as any)`, bypassing Mongoose schema validation.

**Fix:** Add to `KarmaProfileSchema`:
```typescript
lastDecayAppliedAt: { type: Date },
```

**Status:** ACTIVE

---

### G-KS-A2 — Missing Compound Indexes on EarnRecord

**File:** `src/models/EarnRecord.ts` — line 76
**Severity:** MEDIUM
**Category:** Architecture / Performance

**Root Cause:** `createWeeklyBatch` aggregates on `{ status, approvedAt }` without indexes. `checkBatchAnomalies` queries on `csrPoolId + status + approvedAt`. Full collection scans every Sunday as the collection grows.

**Fix:**
```typescript
EarnRecordSchema.index({ status: 1, approvedAt: 1, csrPoolId: 1 });
EarnRecordSchema.index({ userId: 1, status: 1, convertedAt: 1 });
```

**Status:** ACTIVE

---

### G-KS-A3 — No Concurrency Lock on Batch Scheduler

**File:** `src/workers/batchScheduler.ts` — line 70
**Severity:** MEDIUM
**Category:** Architecture / Reliability

**Code:**
```typescript
job = new CronJob(schedule, runWeeklyBatchCreation);
```

**Root Cause:** No lock prevents concurrent execution. Two concurrent runs could create duplicate batches.

**Fix:**
```typescript
const lockKey = 'batch-scheduler-lock';
const lockToken = randomUUID();
const lockAcquired = await redis.set(lockKey, lockToken, 'NX', 'EX', 3600);
if (!lockAcquired) { logger.warn('[BatchScheduler] Previous run still in progress'); return; }
try { await createWeeklyBatch(); }
finally { if ((await redis.get(lockKey)) === lockToken) await redis.del(lockKey); }
```

**Status:** ACTIVE

---

### G-KS-A4 — karma_events Collection May Not Exist — Anomaly Detection Silently Fails

**File:** `src/services/batchService.ts` — lines 606-628
**Severity:** MEDIUM
**Category:** Architecture / Data Integrity

**Code:**
```typescript
$lookup: {
  from: 'karma_events', // This collection may not exist
  localField: 'eventId',
  foreignField: '_id',
  as: 'event',
},
{ $unwind: { path: '$event', preserveNullAndEmptyArrays: true } },
{ $group: { _id: '$event.ngoId', count: { $sum: 1 } } },
```

**Root Cause:** If `karma_events` collection doesn't exist, `$event.ngoId` is always `null`, and the NGO anomaly check never triggers.

**Fix:** Ensure `karma_events` collection exists and is populated, or query the events collection from the merchant service.

**Status:** ACTIVE

---

### G-KS-A5 — PAUSED Status Is Dead Code

**File:** `src/models/Batch.ts` — line 56
**Severity:** MEDIUM
**Category:** Architecture / Code Quality

**Root Cause:** `PAUSED` is defined in the schema enum but never set anywhere. `pauseAllPendingBatches` sets `'DRAFT'` (see G-KS-B3).

**Fix:** Either implement pause properly (`status: 'PAUSED'` in kill switch) or remove `'PAUSED'` from the enum.

**Status:** ACTIVE

---

## LOW

---

### G-KS-A6 — Workers Not Stopped on Graceful Shutdown

**File:** `src/index.ts` — lines 144-168
**Severity:** LOW
**Category:** Architecture / Lifecycle

**Fix:** Import and call `stopDecayWorker()`, `stopBatchScheduler()`, `stopAutoCheckoutWorker()` in the shutdown handler.

**Status:** ACTIVE

---

### G-KS-A7 — Dead Code: timestamp ?? new Date() Fallback Unreachable

**File:** `src/services/auditService.ts` — lines 55-56
**Severity:** LOW
**Category:** Architecture / Code Quality

**Code:**
```typescript
timestamp: entry.timestamp ?? new Date(), // unreachable — timestamp is required
```

**Fix:** Remove the dead fallback.

**Status:** ACTIVE

---

### G-KS-A8 — Template Literal in Comment Uses Wrong Quotes

**File:** `src/services/batchService.ts` — line 539
**Severity:** LOW
**Category:** Architecture / Code Quality

**Code:**
```typescript
// title: '+${record.cappedCoins} ReZ Coins from your impact this week',
```

**Fix:** Use backticks: `// title: \`+${record.cappedCoins} ReZ Coins...\`,`

**Status:** ACTIVE

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| G-KS-A1 | MEDIUM | lastDecayAppliedAt not in schema — uses (any) cast | ACTIVE |
| G-KS-A2 | MEDIUM | Missing compound indexes on EarnRecord | ACTIVE |
| G-KS-A3 | MEDIUM | No concurrency lock on batch scheduler | ACTIVE |
| G-KS-A4 | MEDIUM | karma_events collection may not exist — anomaly detection fails | ACTIVE |
| G-KS-A5 | MEDIUM | PAUSED status is dead code | ACTIVE |
| G-KS-A6 | LOW | Workers not stopped on graceful shutdown | ACTIVE |
| G-KS-A7 | LOW | Dead code: timestamp ?? new Date() unreachable | ACTIVE |
| G-KS-A8 | LOW | Template literal in comment uses wrong quotes | ACTIVE |
