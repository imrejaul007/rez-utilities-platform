# CROSS-REF: Type Divergence — Local vs Canonical

**Date:** 2026-04-16
**Severity:** 2 CRITICAL, 3 HIGH, 3 MEDIUM, 2 LOW
**Updated:** 2026-04-16 — Canonical types verified against `packages/shared-types/src/entities/karma.ts`

---

## G-CR-X1 — KarmaProfile vs IKarmaProfile

**Consumer App:** `services/karmaService.ts:13-25`
**Canonical:** `packages/shared-types/src/entities/karma.ts:106-131`

### Field Comparison

| Field | Local KarmaProfile | Canonical IKarmaProfile | Status |
|-------|-------------------|-------------------------|--------|
| `_id` | Missing | `string` | **MISSING** |
| `userId` | `string` | `string` | OK |
| `lifetimeKarma` | `number` | `number` | OK |
| `activeKarma` | `number` | `number` | OK |
| `level` | `'L1' \| 'L2' \| 'L3' \| 'L4'` | `KarmaLevel` enum | **MISMATCH** |
| `eventsCompleted` | `number` | `number` | OK |
| `eventsJoined` | Missing | `number` | **MISSING** |
| `totalHours` | `number` | `number` | OK |
| `trustScore` | `number` | `number` | OK |
| `badges` | `KarmaBadge[]` | `IBadge[]` | **MISMATCH** |
| `lastActivityAt` | Missing | `Date` | **MISSING** |
| `levelHistory` | Missing | `ILevelHistoryEntry[]` | **MISSING** |
| `conversionHistory` | Missing | `IConversionHistoryEntry[]` | **MISSING** |
| `thisWeekKarmaEarned` | Missing | `number` | **MISSING** |
| `weekOfLastKarmaEarned` | Missing | `Date` | **MISSING** |
| `avgEventDifficulty` | Missing | `number` | **MISSING** |
| `avgConfidenceScore` | Missing | `number` | **MISSING** |
| `checkIns` | Missing | `number` | **MISSING** |
| `approvedCheckIns` | Missing | `number` | **MISSING** |
| `activityHistory` | Missing | `Date[]` | **MISSING** |
| `createdAt` | Missing | `Date` | **MISSING** |
| `updatedAt` | Missing | `Date` | **MISSING** |
| `conversionRate` | `number` | **Missing** | Client-only (OK) |
| `nextLevelAt` | `number` | **Missing** | Client-only (OK) |
| `decayWarning` | `string \| null` | **Missing** | Client-only (OK) |

### Missing Fields: 14
### Extra Fields (client-only): 3
### Mismatched Types: 2

**Root Cause:** The local type was created independently without importing from the canonical shared-types package. The local type is missing 14 canonical fields and has 3 extra client-only fields.

**Related Gaps:** G-KU-H1 (karma UI)

**Fix:** Import canonical type and extend with client-only fields. See G-KU-H1 for fix.

**Status:** ACTIVE

---

## G-CR-X2 — KarmaEvent vs IKarmaEvent

**Consumer App:** `services/karmaService.ts:43-75`
**Canonical:** `packages/shared-types/src/entities/karma.ts:137-155`

### Field Comparison

| Field | Local KarmaEvent | Canonical IKarmaEvent | Status |
|-------|-----------------|----------------------|--------|
| `_id` | `string` | `string` | OK |
| `name` | `string` | `string` | OK |
| `description` | `string` | `string` | OK |
| `karmaReward` | Missing | `number` | **MISSING** |
| `maxKarmaPerEvent` | `number` | Missing | Client-enriched (OK) |
| `difficulty` | `'easy' \| 'medium' \| 'hard'` | `number` (0-1) | **MISMATCH** |
| `category` | `'environment' \| ...` | **Missing** | Client-enriched (OK) |
| `status` | `'draft' \| 'published' \| ...` | **Missing** | Client-enriched (OK) |
| `maxAttendees` | Missing | `number` | **MISSING** |
| `maxVolunteers` | `number` | Missing | Client-enriched (OK) |
| `currentAttendees` | Missing | `number` | **MISSING** |
| `confirmedVolunteers` | `number` | Missing | Client-enriched (OK) |
| `startTime` | Missing | `Date` | **MISSING** |
| `endTime` | Missing | `Date` | **MISSING** |
| `date` | `string` | Missing | Client-enriched (OK) |
| `time` | `{start, end}` | Missing | Client-enriched (OK) |
| `location.name` | Missing | `string` | **MISSING** |
| `location.coords` | `coords?: {lat, lng}` | `coords: {lat, lng}` | **MISMATCH** |
| `location.address` | `address: string` | Missing | Client-enriched (OK) |
| `location.city` | `city: string` | Missing | Client-enriched (OK) |
| `verificationMode` | `'qr' \| 'gps' \| 'manual'` | **Missing** | Client-enriched (OK) |
| `expectedDurationHours` | `number` | **Missing** | Client-enriched (OK) |
| `ngoId` | `string` | **Missing** | Client-enriched (OK) |
| `ngoName` | `string` | **Missing** | Client-enriched (OK) |

### Missing from Local: 6 (karmaReward, maxAttendees, currentAttendees, startTime, endTime, location.name)
### Extra in Local: 15 (client-enriched display fields)
### Type Mismatches: 2 (difficulty type, location structure)

**Root Cause:** The local type was created to support rich UI display (category badges, difficulty labels, verification mode, capacity tracking). The canonical type is a simplified backend model. This is acceptable as long as the divergence is intentional and documented.

**Related Gaps:** G-KU-C3 (karma UI)

**Fix:** Rename local type to `KarmaEventClient`, document it enriches the canonical type. See G-KU-C3 for fix.

**Status:** ACTIVE

---

## G-CR-X7 — `Level` vs `KarmaLevel` — Name Divergence

**Local:** `src/types/index.ts` line 1
**Canonical:** `packages/shared-types/src/entities/karma.ts` line 15

**Code:**
```typescript
// Local (karma service):
export type Level = 'L1' | 'L2' | 'L3' | 'L4';

// Canonical:
export type KarmaLevel = 'L1' | 'L2' | 'L3' | 'L4'; // same values, different name
```

**Root Cause:** Values match exactly. Name diverged during independent authoring. Any consumer importing `Level` from `@rez/shared-types` will fail — `KarmaLevel` is what's exported. The local `Level` type is never available to consumers.

**Fix:** Rename local `Level` to `KarmaLevel` and re-export from shared-types.

**Status:** ACTIVE

---

## G-CR-X8 — `ConversionRate` vs `KarmaConversionRate` — Name Divergence

**Local:** `src/types/index.ts` line 3
**Canonical:** `packages/shared-types/src/entities/karma.ts` line 21

**Code:**
```typescript
// Local:
export type ConversionRate = 0.25 | 0.5 | 0.75 | 1.0;

// Canonical:
export type KarmaConversionRate = 0.25 | 0.5 | 0.75 | 1.0; // same values, different name
```

**Root Cause:** Values match exactly. Name diverged during independent authoring.

**Fix:** Rename local `ConversionRate` to `KarmaConversionRate` and export from shared-types.

**Status:** ACTIVE

---

## G-CR-X7b — `IKarmaEvent` Canonical Is Fundamentally Wrong — 15 Fields Missing

**Canonical:** `packages/shared-types/src/entities/karma.ts` lines 137-155
**Local:** `src/models/KarmaEvent.ts` + `src/types/index.ts`

**CRITICAL:** The canonical `IKarmaEvent` omits every core field of the actual model:

| Field | Canonical IKarmaEvent | Local KarmaEvent Model | Status |
|-------|----------------------|----------------------|--------|
| `_id` | `string` | `string` | OK |
| `name` | `string` | `string` | OK |
| `karmaReward` | `number` | `baseKarmaPerHour` | **MISMATCH** |
| `difficulty` | `number` | `EventDifficulty` union | **MISMATCH** |
| `maxAttendees` | `number` | `maxVolunteers` | **MISMATCH** |
| `currentAttendees` | `number` | `confirmedVolunteers` | **MISMATCH** |
| `startTime` | `Date` | `eventStartTime` | **MISMATCH** |
| `endTime` | `Date` | `eventEndTime` | **MISMATCH** |
| `location.name` | `string` | `eventAddress` | **MISMATCH** |
| `isActive` | `boolean` | `isPublished` | **MISMATCH** |
| `createdBy` | `string` | `createdBy` | OK |
| `merchantEventId` | **Missing** | `string` | **MISSING** |
| `ngoId` | **Missing** | `string` | **MISSING** |
| `category` | **Missing** | `EventCategory` | **MISSING** |
| `impactUnit` | **Missing** | `string` | **MISSING** |
| `impactMultiplier` | **Missing** | `number` | **MISSING** |
| `expectedDurationHours` | **Missing** | `number` | **MISSING** |
| `baseKarmaPerHour` | **Missing** | `number` | **MISSING** |
| `maxKarmaPerEvent` | **Missing** | `number` | **MISSING** |
| `qrCodes` | **Missing** | `{ checkIn, checkOut }` | **MISSING** |
| `gpsRadius` | **Missing** | `number` | **MISSING** |

**Impact:** Any consumer importing `IKarmaEvent` from `@rez/shared-types` gets a stub with 15 fields that don't match the karma service's actual model. Field names (`karmaReward` vs `baseKarmaPerHour`), types (`number` vs string union), and concepts (`maxAttendees` vs `maxVolunteers`) all diverge.

**Fix:** Rewrite `IKarmaEvent` in `packages/shared-types/src/entities/karma.ts` to match the actual karma service model fields exactly.

**Status:** ACTITICAL

---

## G-CR-X9 — `IEarnRecord` Canonical Missing 8 Fields — verificationSignals Shape Wrong

**Canonical:** `packages/shared-types/src/entities/karma.ts` lines 50-68
**Local:** `src/types/index.ts` lines 107-126

**CRITICAL:** The canonical `IEarnRecord` is missing 8 fields that the local model stores, and the `verificationSignals` shape is completely different:

| Field | Local EarnRecord | Canonical IEarnRecord | Status |
|-------|-----------------|----------------------|--------|
| `_id` | `string` | `string` | OK |
| `userId` | `string` | `string` | OK |
| `eventId` | `string` | `string` | OK |
| `bookingId` | `string` | **Missing** | **MISSING** |
| `karmaEarned` | `number` | `number` | OK |
| `activeLevelAtApproval` | `Level` | **Missing** | **MISSING** |
| `conversionRateSnapshot` | `number` | **Missing** | **MISSING** |
| `csrPoolId` | `string` | **Missing** | **MISSING** |
| `verificationSignals` | `{qr_in, qr_out, gps_match, ngo_approved, photo_proof}` | `{gps_match, qr_verified, face_verified, manual_override}` | **WRONG SHAPE** |
| `confidenceScore` | `number` | **Missing** | **MISSING** |
| `status` | `EarnRecordStatus` | `EarnRecordStatus` | OK |
| `batchId` | `string` | **Missing** | **MISSING** |
| `rezCoinsEarned` | `number` | **Missing** | **MISSING** |
| `idempotencyKey` | `string` | **Missing** | **MISSING** |
| `convertedBy` | `string` | `approvedBy` | **NAME MISMATCH** |
| `updatedAt` | `Date` | **Missing** | **MISSING** |

**Impact:** The canonical `IEarnRecord` is structurally incompatible with what the karma service actually stores. Consumers expecting canonical fields will read `undefined` for `bookingId`, `confidenceScore`, `csrPoolId`, `batchId`, `rezCoinsEarned`, `idempotencyKey`. The `verificationSignals` field names are completely different.

**Fix:** Rewrite `IEarnRecord` in `karma.ts` to match the local model. Align `verificationSignals` field names between canonical and local model.

**Status:** ACTITICAL

---

## G-CR-X10 — `IConversionBatch` in Canonical Has No Local Equivalent

**Canonical:** `packages/shared-types/src/entities/karma.ts` lines 161-165
**Local:** `src/models/Batch.ts`

**Code:**
```typescript
// Canonical IConversionBatch fields:
{ _id, status, totalRecords, approvedRecords, rejectedRecords,
  totalKarma, totalCoins, averageRate, executedAt, createdBy, createdAt, updatedAt }

// Local IBatch fields:
{ _id, csrPoolId, weekStart, weekEnd, status, totalEarnRecords,
  anomalyFlags, executedBy, executedAt, pauseReason, pausedAt, createdAt, updatedAt }
```

**Root Cause:** `IConversionBatch` describes conversion execution records (tracking individual batch operations). The local `Batch` model describes CSR pool-based weekly aggregation. These are different concepts — `createdBy` vs `executedBy`, `approvedRecords` vs `totalEarnRecords`, no `csrPoolId` in canonical.

**Fix:** Either add a `ConversionBatch` model to the karma service, or remove `IConversionBatch` from canonical and reconcile with the existing `IBatch` interface.

**Status:** ACTIVE

---

## G-CR-X11 — `KarmaProfileDelta` Not in Local Types

**Canonical:** `packages/shared-types/src/entities/karma.ts` lines 167-174
**Local:** Not defined anywhere in `src/types/index.ts`

**Code:**
```typescript
// Canonical — returned by applyDailyDecay():
export interface KarmaProfileDelta {
  activeKarmaChange: number;
  levelChange: boolean;
  oldLevel?: Level;
  newLevel?: Level;
  lastDecayAppliedAt?: Date;
}
```

**Root Cause:** `applyDailyDecay()` in `karmaEngine.ts` returns this type, but it's not exported from `src/types/index.ts`. Consumer apps importing from the karma service have no type for the decay response.

**Fix:** Add `KarmaProfileDelta` to `src/types/index.ts`.

**Status:** ACTIVE

---

## G-CR-X12 — `ILevelInfo.benefits` Missing from Local Types

**Canonical:** `packages/shared-types/src/entities/karma.ts` lines 179-185
**Local:** `src/types/index.ts` lines 176-181

**Code:**
```typescript
// Canonical:
export interface ILevelInfo {
  level: KarmaLevel;
  minKarma: number;
  maxKarma?: number;
  conversionRate: KarmaConversionRate;
  benefits: string[]; // ← MISSING in local
}

// Local — no benefits field
```

**Root Cause:** The local `LevelInfo` type predates the canonical `ILevelInfo`. The `benefits` array is in the canonical but not in the local type.

**Fix:** Add `benefits: string[]`, `minKarma`, `maxKarma` to `LevelInfo` in `src/types/index.ts`.

**Status:** ACTIVE

---

## G-CR-X13 — `VerificationStatus` Canonical Enum vs Local Type — Different Values

**Canonical:** `packages/shared-types/src/enums/index.ts` lines 180-184
**Local:** `src/types/index.ts` line 13

**Code:**
```typescript
// Canonical:
export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',   // ← 'approved' not in local
  REJECTED = 'rejected',
}

// Local:
export type VerificationStatus = 'pending' | 'partial' | 'verified' | 'rejected';
//  'partial' and 'verified' not in canonical
```

**Root Cause:** Local type has 4 values (`pending`, `partial`, `verified`, `rejected`). Canonical enum has 3 (`pending`, `approved`, `rejected`). Values `partial`/`verified` are local-only; `approved` is canonical-only. The karma verification engine internally uses `ApprovalStatus` (`'verified' | 'partial' | 'rejected'`) — a third separate type.

**Fix:** Decide on canonical values. If `pending | partial | verified | rejected` is correct, replace the enum in `enums/index.ts` with a type alias.

**Status:** ACTIVE

---

## G-CR-X14 — `CSRPoolStatus` and `ApprovalStatus` Not Exported from Shared-Types

**Local:** `src/types/index.ts` lines 31, 48
**Canonical:** Not exported from `packages/shared-types`

**Code:**
```typescript
// Local — used but not available to consumers:
export type CSRPoolStatus = 'active' | 'depleted' | 'expired';
export type ApprovalStatus = 'verified' | 'partial' | 'rejected';  // verificationEngine.ts:48
```

**Impact:** `CSRPoolStatus` is used in `src/models/CSRPool.ts` but is never available to consumer apps importing from `@rez/shared-types`. `ApprovalStatus` has no canonical equivalent at all.

**Fix:** Export both from `packages/shared-types/src/entities/karma.ts`.

**Status:** ACTIVE

---

## G-CR-X15 — `IKarmaProfile` Missing `updatedAt: Date`

**Local:** `src/models/KarmaProfile.ts` (Mongoose `timestamps: true`)
**Canonical:** `packages/shared-types/src/entities/karma.ts` lines 106-131

**Code:**
```typescript
// Mongoose schema: timestamps: { createdAt: true, updatedAt: true }
profileSchema.set('timestamps', true);

// Canonical IKarmaProfile — NO updatedAt field
```

**Root Cause:** The Mongoose schema automatically manages `updatedAt` via `timestamps: true`. The canonical `IKarmaProfile` interface omits it. Any consumer reading `IKarmaProfile.updatedAt` gets `undefined`.

**Fix:** Add `updatedAt: Date` to `IKarmaProfile` in `packages/shared-types/src/entities/karma.ts`.

**Status:** ACTIVE

---

## Summary Table

| Gap | Severity | Local | Canonical | Status |
|-----|----------|-------|---------|--------|
| G-CR-X1 | CRITICAL | KarmaProfile missing 14 fields | IKarmaProfile 23 fields | ACTIVE |
| G-CR-X2 | HIGH | KarmaEvent type divergent | IKarmaEvent | ACTIVE |
| G-CR-X7 | HIGH | `Level` naming | `KarmaLevel` | ACTIVE |
| G-CR-X8 | MEDIUM | `ConversionRate` naming | `KarmaConversionRate` | ACTIVE |
| G-CR-X7b | CRITICAL | IKarmaEvent canonical fundamentally wrong — 15 fields missing | | ACTIVE |
| G-CR-X9 | CRITICAL | IEarnRecord canonical missing 8 fields + verificationSignals shape wrong | | ACTIVE |
| G-CR-X10 | HIGH | IConversionBatch has no local equivalent | | ACTIVE |
| G-CR-X11 | MEDIUM | KarmaProfileDelta missing from local types | | ACTIVE |
| G-CR-X12 | LOW | ILevelInfo.benefits missing from local | | ACTIVE |
| G-CR-X13 | MEDIUM | VerificationStatus enum vs local type — different values | | ACTIVE |
| G-CR-X14 | LOW | CSRPoolStatus/ApprovalStatus not exported from shared-types | | ACTIVE |
| G-CR-X15 | MEDIUM | IKarmaProfile missing updatedAt | | ACTIVE |
