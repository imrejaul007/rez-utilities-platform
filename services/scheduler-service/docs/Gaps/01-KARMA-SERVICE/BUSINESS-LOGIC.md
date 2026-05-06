# KARMA SERVICE — BUSINESS LOGIC GAPS

**Service:** `rez-karma-service`
**Date:** 2026-04-16
**Severity:** 9 HIGH, 4 MEDIUM

---

## HIGH

---

### G-KS-B1 — Duplicate `const startOfWeek` — Compile Error + Wrong Week Boundary

**File:** `src/services/karmaService.ts` — lines 128, 195
**Severity:** HIGH
**Category:** Business Logic / Functional Bug
**Updated:** 2026-04-16 — line numbers confirmed as 128 and 195 in actual file

**Code:**
```typescript
// Line 128:
const WEEKLY_COIN_CAP = 300;
const startOfWeek = moment().startOf('week').toDate();

// Line 195:
const startOfWeek = moment().startOf('week').toDate();
```

**Root Cause:** `const startOfWeek` is declared twice in the same function scope (`addKarma`). In TypeScript with `strict: true`, this is a compile-time error. Even if it somehow compiles, the second declaration shadows the first, meaning the weekly cap check and the karma accumulation use different week boundaries.

**Fix:** Remove the duplicate declaration. `startOfWeek` should be declared once and used for both:
```typescript
const startOfWeek = moment().startOf('week').toDate();
// Use for both cap check AND accumulation
```

**Status:** ACTIVE

---

### G-KS-B2 — No Karma Input Validation — Accepts Negative/NaN/Infinity

**File:** `src/services/karmaService.ts` — lines 106-144
**Severity:** HIGH
**Category:** Business Logic / Edge Case

**Code:**
```typescript
export async function addKarma(
  userId: string,
  karma: number,
  options?: { ... },
): Promise<void> {
  const profile = await getOrCreateProfile(userId);
  profile.lifetimeKarma += karma;   // negative karma = subtract
  profile.activeKarma += karma;    // negative karma = subtract
  profile.thisWeekKarmaEarned += karma;
```

**Root Cause:** `karma: number` has no runtime validation. Callers can pass negative numbers, `NaN`, `Infinity`, or `0`. A malicious actor crafting a checkout request with `karmaEarned: -1000` would corrupt karma balances.

**Fix:**
```typescript
if (typeof karma !== 'number' || !Number.isFinite(karma) || karma <= 0) {
  logger.warn('[Karma] addKarma rejected invalid karma value', { userId, karma });
  throw new Error('Karma value must be a positive finite number');
}
```

**Status:** ACTIVE

---

### G-KS-B3 — Kill Switch Sets Wrong Status

**File:** `src/services/batchService.ts` — lines 687-697
**Severity:** HIGH
**Category:** Business Logic / Data Integrity

**Code:**
```typescript
export async function pauseAllPendingBatches(reason: string): Promise<number> {
  const result = await Batch.updateMany(
    { status: { $in: ['READY', 'DRAFT'] } },
    {
      $set: {
        status: 'DRAFT',   // ← WRONG: should be 'PAUSED'
        pauseReason: reason,
        pausedAt: new Date(),
      },
    },
  );
```

**Root Cause:** Sets `status: 'DRAFT'` instead of `status: 'PAUSED'`. Paused batches are indistinguishable from drafts, and the execution guard could pass.

**Fix:**
```typescript
$set: {
  status: 'PAUSED', // was 'DRAFT'
  pauseReason: reason,
  pausedAt: new Date(),
},
```

**Status:** ACTIVE

---

### G-KS-B4 — Auto-Checkout Does Not Create EarnRecord

**File:** `src/workers/autoCheckoutWorker.ts` — lines 119-124
**Severity:** HIGH
**Category:** Business Logic / Data Loss

**Code:**
```typescript
await EventBookingModel.findByIdAndUpdate(booking._id, {
  qrCheckedOut: true,
  qrCheckedOutAt: eventEndTime,
  verificationStatus: 'partial',
  notes: 'Auto-checkout: user forgot to check out',
});
// ← NO EarnRecord created — karma is lost
```

**Root Cause:** Users who forget to check out are not credited any karma. The comment says "users who forget to check out still receive partial credit" but the code does not implement this.

**Fix:** After auto-checkout, create a partial EarnRecord:
```typescript
const { createEarnRecord } = await import('../services/earnRecordService.js');
await createEarnRecord({
  userId: raw.userId as string,
  eventId,
  bookingId: booking._id.toString(),
  karmaEarned: Math.floor((raw.karmaEarned as number ?? 0) * 0.5),
  verificationSignals: { qr_in: true, qr_out: true, gps_match: 0, ngo_approved: false, photo_proof: false },
  confidenceScore: 0.3,
  csrPoolId: raw.csrPoolId as string ?? '',
});
```

**Status:** ACTIVE

---

### G-KS-B5 — Decay Worker Runs Weekly, Not Daily

**File:** `src/workers/decayWorker.ts` — line 26
**Severity:** HIGH
**Category:** Business Logic / Configuration Mismatch

**Code:**
```typescript
/**
 * Decay Worker — daily cron job for karma decay
 * Runs at midnight UTC every day (0 0 * * *).
 */
job = new CronJob({
  cronTime: batchCronSchedule, // batchCronSchedule = '59 23 * * 0' (weekly, Sunday 23:59)
```

**Root Cause:** The comment says "daily" but `cronTime` is set to `'59 23 * * 0'` — weekly on Sunday at 23:59.

**Fix:**
```typescript
cronTime: '0 0 * * *', // Daily at midnight UTC
```

**Status:** ACTIVE

---

## MEDIUM

---

### G-KS-B6 — GPS Proximity Score Has Minimum 0.5 — Discontinuous at Boundary

**File:** `src/engines/karmaEngine.ts` — lines 172-173, 244-246
**Severity:** MEDIUM
**Category:** Business Logic / Scoring

**Code:**
```typescript
if (distanceMeters <= radiusMeters) {
  return Math.max(0.5, 1 - distanceMeters / radiusMeters);
}
// Outside:
return 0;
```

**Root Cause:** Score is always >= 0.5 inside radius and drops to 0 outside. A user at 99% of the radius gets ~0.505; at 100.01% gets 0. The boundary is abrupt and discontinuous.

**Fix:** Normalize to be continuous at boundary:
```typescript
if (distanceMeters <= radiusMeters) {
  const ratio = distanceMeters / radiusMeters;
  return Math.round((1 - ratio * 0.5) * 100) / 100;
}
const excess = distanceMeters - radiusMeters;
return Math.max(0, Math.round((0.5 - excess / radiusMeters * 0.5) * 100) / 100);
```

**Status:** ACTIVE

---

### G-KS-B7 — Mixed startOf('week') vs isoWeek — Inconsistent Week Boundaries

**File:** Multiple files
**Severity:** MEDIUM
**Category:** Business Logic / Data Consistency

**Code:**
```typescript
// karmaService.ts: Uses moment().startOf('week') — locale-aware, Sunday in en_US
const startOfWeek = moment().startOf('week').toDate();

// batchService.ts: Uses startOf('isoWeek') — always Monday
const startOfWeek = moment(weekOf).startOf('isoWeek');

// earnRecordService.ts: Manual Sunday/Monday calculation
day === 0 ? -6 : 1
```

**Root Cause:** Weekly karma caps and weekly coin conversion batches are measured against **different week boundaries**.

**Fix:** Standardize all week calculations to use `startOf('isoWeek')` everywhere.

**Status:** ACTIVE

---

### G-KS-B8 — Non-Atomic CSR Pool Decrement — Race Condition

**File:** `src/services/batchService.ts` — lines 474-477
**Severity:** MEDIUM
**Category:** Business Logic / Financial Integrity

**Code:**
```typescript
await CSRPool.updateOne(
  { _id: batch.csrPoolId },
  { $inc: { coinPoolRemaining: -cappedCoins, issuedCoins: cappedCoins } },
);
```

**Root Cause:** No race condition guard. Concurrent batch executions could over-deplete the pool.

**Fix:**
```typescript
const result = await CSRPool.updateOne(
  { _id: batch.csrPoolId, coinPoolRemaining: { $gte: cappedCoins } },
  { $inc: { coinPoolRemaining: -cappedCoins, issuedCoins: cappedCoins } },
);
if (result.modifiedCount === 0) {
  throw new Error(`Pool ${batch.csrPoolId} insufficient balance`);
}
```

**Status:** ACTIVE

---

### G-KS-B9 — `createEarnRecord` Bypasses `addKarma` — No Level History, No Activity History

**File:** `src/services/earnRecordService.ts` — lines 138, 219-236
**Severity:** HIGH
**Category:** Business Logic / Data Loss

**Code:**
```typescript
// createEarnRecord — only calls updateProfileStats, never calls addKarma:
await updateProfileStats(userId, karmaEarned, confidenceScore, level);

// Compare with recordKarmaEarned which does both:
await profile.save();
await addKarma(userId, karmaEarned, { ... });  // ← createEarnRecord skips this
```

**Root Cause:** `addKarma` (karmaService.ts) handles: level upgrade checks + `levelHistory` appending, `lastActivityAt` updates, `activityHistory` maintenance, weekly cap check with `weekOfLastKarmaEarned` tracking. `createEarnRecord` (the **primary production path** after verification) calls only `updateProfileStats`, bypassing all of these. Users who earn karma through check-in/check-out never have their level history recorded, their activity tracked for decay decisions, or their weekly cap enforced correctly.

Additionally, `updateProfileStats` uses ISO-week boundaries (`getWeekStart`) while `addKarma`'s cap check uses locale-aware Sunday — **different week boundaries for the same weekly cap**.

**Fix:** `createEarnRecord` should call `addKarma` instead of `updateProfileStats`, or `updateProfileStats` should be merged into `addKarma`.

**Status:** ACTIVE

---

### G-KS-B10 — `eventsCompleted` Double-Increment in `recordKarmaEarned` Path

**File:** `src/services/earnRecordService.ts` — lines 228-236, 300-302
**Severity:** HIGH
**Category:** Business Logic / Data Integrity

**Code:**
```typescript
// recordKarmaEarned — increments once:
profile.eventsCompleted += 1;
await profile.save();

// updateProfileStats — ALSO increments:
profile.eventsCompleted += 1;  // second increment for createEarnRecord path
```

**Root Cause:** `eventsCompleted += 1` appears in both `recordKarmaEarned` and `updateProfileStats`. A user who earns karma through `createEarnRecord` (primary path) has `eventsCompleted` incremented exactly once (by `updateProfileStats`). A user who goes through `recordKarmaEarned` also has it incremented exactly once. But since these are **different code paths writing the same field**, the count depends on which path was used — not the actual number of events completed. This corrupts `calculateTrustScore`'s completion rate (`eventsCompleted / eventsJoined`).

**Fix:** Consolidate `eventsCompleted += 1` to a single increment site — either in `addKarma` or `updateProfileStats`, not both.

**Status:** ACTIVE

---

### G-KS-B11 — `eventsJoined` Never Incremented — Trust Score Completion Rate Always 0

**File:** `src/services/karmaService.ts` — lines 151-174; `src/services/earnRecordService.ts` — lines 299-305
**Severity:** HIGH
**Category:** Business Logic / Scoring

**Code:**
```typescript
// Neither addKarma nor updateProfileStats ever increments eventsJoined:
const completionRate = profile.eventsJoined > 0
  ? profile.eventsCompleted / profile.eventsJoined  // ← always 0 because eventsJoined is always 0
  : 0;
```

**Root Cause:** `eventsJoined` is never incremented anywhere in the codebase. `calculateTrustScore` weights completion rate at 30% — this entire component is permanently disabled. Any user, regardless of engagement, loses the full 30% trust-score weight.

**Fix:** Increment `eventsJoined` when a user first joins an event. If "joined" means "completed" in this domain, increment alongside `eventsCompleted` in `addKarma`:
```typescript
profile.eventsCompleted += 1;
profile.eventsJoined += 1;
```

**Status:** ACTIVE

---

### G-KS-B12 — `avgEventDifficulty` Never Updated via `updateProfileStats`

**File:** `src/services/earnRecordService.ts` — lines 299-305
**Severity:** HIGH
**Category:** Business Logic / Scoring

**Code:**
```typescript
// updateProfileStats — updates avgConfidenceScore but NOT avgEventDifficulty:
profile.eventsCompleted += 1;
profile.checkIns += 1;
profile.avgConfidenceScore =
 (profile.avgConfidenceScore * (profile.checkIns - 1) + confidenceScore) / profile.checkIns;
// avgEventDifficulty ← never updated; stays 0 or initial value forever
```

**Root Cause:** `calculateTrustScore` weights `avgEventDifficulty` at 15%. Any user whose profile is updated exclusively through `createEarnRecord` / `updateProfileStats` (the primary production path) has `avgEventDifficulty = 0` — permanently losing the full 15% trust-score weight.

**Fix:**
```typescript
profile.avgEventDifficulty =
 (profile.avgEventDifficulty * (profile.eventsCompleted - 1) + (difficulty ?? 0)) / profile.eventsCompleted;
```

**Status:** ACTIVE

---

### G-KS-B13 — `WEEKLY_COIN_CAP` Hardcoded Instead of Imported

**File:** `src/services/karmaService.ts` — line 127
**Severity:** MEDIUM
**Category:** Business Logic / Drift Risk

**Code:**
```typescript
const WEEKLY_COIN_CAP = 300; // ← developer knew this should be imported (see comment)
```
The codebase already imports `WEEKLY_COIN_CAP` correctly from `karmaEngine.js` in `batchService.ts`.

**Root Cause:** Duplicate constant can diverge silently. If `karmaEngine.ts`'s cap changes, `karmaService.ts`'s cap check uses a stale value.

**Fix:**
```typescript
import { WEEKLY_COIN_CAP } from '../engines/karmaEngine.js';
// Remove the local const WEEKLY_COIN_CAP = 300;
```

**Status:** ACTIVE

---

### G-KS-B14 — Pre-Computed `rezCoinsEarned` Stored but Never Validated During Execution

**File:** `src/services/batchService.ts` — lines 289-302, 439-445
**Severity:** MEDIUM
**Category:** Business Logic / Data Integrity

**Code:**
```typescript
// At record creation: stored but never read back:
rezCoinsEarned: Math.floor(karmaEarned * conversionRate),  // earnRecordService.ts

// At batch execution: recomputed, stored value ignored:
const rawCoins = Math.floor(record.karmaEarned * record.conversionRateSnapshot);
record.rezCoinsEarned = cappedCoins;  // only written, never compared
```

**Root Cause:** If `karmaEarned` or `conversionRateSnapshot` somehow evaluates to 0/null between record creation and execution (migration bug, manual edit), the user receives 0 coins. The pre-computed `rezCoinsEarned` provides no audit trail or consistency guarantee because it is never compared against the live calculation.

**Fix:** In `executeBatch`, compare pre-computed against live calculation and flag discrepancies:
```typescript
const expectedCoins = record.rezCoinsEarned ?? Math.floor(record.karmaEarned * record.conversionRateSnapshot);
if (Math.abs(expectedCoins - rawCoins) > 0) {
 logger.warn('[Batch] Coin amount mismatch', { recordId: recordIdStr, stored: expectedCoins, recalculated: rawCoins });
}
```

**Status:** ACTIVE

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| G-KS-B1 | HIGH | Duplicate const startOfWeek — compile error + wrong boundary | ACTIVE |
| G-KS-B9 | HIGH | `createEarnRecord` bypasses `addKarma` — no level history, no activity history | ACTIVE |
| G-KS-B10 | HIGH | `eventsCompleted` double-increment in `recordKarmaEarned` path | ACTIVE |
| G-KS-B11 | HIGH | `eventsJoined` never incremented — trust score completion rate always 0 | ACTIVE |
| G-KS-B12 | HIGH | `avgEventDifficulty` never updated via `updateProfileStats` — 15% trust weight always 0 | ACTIVE |
| G-KS-B2 | HIGH | No karma input validation — accepts negative/NaN/Infinity | ACTIVE |
| G-KS-B3 | HIGH | Kill switch sets 'DRAFT' instead of 'PAUSED' | ACTIVE |
| G-KS-B4 | HIGH | Auto-checkout does not create EarnRecord — karma lost | ACTIVE |
| G-KS-B5 | HIGH | Decay worker runs weekly, not daily | ACTIVE |
| G-KS-B6 | MEDIUM | GPS score discontinuous at radius boundary | ACTIVE |
| G-KS-B13 | MEDIUM | `WEEKLY_COIN_CAP` hardcoded instead of imported — duplicate can diverge | ACTIVE |
| G-KS-B14 | MEDIUM | Pre-computed `rezCoinsEarned` stored but never validated during batch execution | ACTIVE |
| G-KS-B7 | MEDIUM | Mixed startOf('week') vs isoWeek — inconsistent boundaries | ACTIVE |
| G-KS-B8 | MEDIUM | Non-atomic CSR pool decrement — race condition | ACTIVE |
