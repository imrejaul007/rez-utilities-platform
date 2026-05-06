# KARMA SERVICE — FUNCTIONAL GAPS

**Service:** `rez-karma-service`
**Date:** 2026-04-16
**Severity:** 5 HIGH, 5 MEDIUM, 2 LOW

---

## HIGH

---

### G-KS-F1 — mongoose.Types.ObjectId Throws on Invalid userId — No Route-Level Validation

**File:** `src/services/karmaService.ts` — lines 67-69; `src/routes/karmaRoutes.ts`
**Severity:** HIGH
**Category:** Functional / Input Validation

**Code:**
```typescript
// karmaService.ts:67-69:
profile = await KarmaProfile.create({
  userId: new mongoose.Types.ObjectId(userId), // throws on invalid string
  ...
});
```

**Root Cause:** `getOrCreateProfile` calls `new mongoose.Types.ObjectId(userId)` which throws `BSONError` on invalid strings. `karmaRoutes.ts` passes `userId` from params without validation.

**Fix in karmaRoutes.ts:**
```typescript
if (!mongoose.Types.ObjectId.isValid(userId)) {
  res.status(400).json({ success: false, message: 'Invalid userId format' });
  return;
}
```

**Status:** ACTIVE

---

### G-KS-F2 — EarnRecord batchId Typed as String vs ObjectId — Inconsistent

**File:** `src/services/batchService.ts` — line 285
**Severity:** HIGH
**Category:** Functional / Type Safety

**Code:**
```typescript
const records = await EarnRecord.find({ batchId: batch._id.toString() }).lean();
```

**Root Cause:** `EarnRecordSchema` defines `batchId` as `Schema.Types.ObjectId`. Mixing string/ObjectId is error-prone.

**Fix:**
```typescript
const records = await EarnRecord.find({
  batchId: new Types.ObjectId(batch._id)
}).lean();
```

**Status:** ACTIVE

---

## MEDIUM

---

### G-KS-F3 — GPS Checkout Score Falls Back to (0,0) When Event Coords Missing

**File:** `src/engines/verificationEngine.ts` — lines 408-419
**Severity:** MEDIUM
**Category:** Functional / Edge Case

**Code:**
```typescript
if (gpsCoords) {
  signals.gps_match = Math.max(
    signals.gps_match,
    checkGPSProximity(
      (raw.eventLatitude as number) ?? 0,  // Falls back to Atlantic Ocean
      (raw.eventLongitude as number) ?? 0,
```

**Root Cause:** When `eventLatitude`/`eventLongitude` are missing from the booking, proximity is computed from `(0, 0)`. Users with valid GPS check-ins get penalized at checkout.

**Fix:** Store event coordinates on the booking at creation time.

**Status:** ACTIVE

---

### G-KS-F4 — parseInt NaN Silently Used as Query Limit

**File:** `src/routes/karmaRoutes.ts` — lines 92-93
**Severity:** MEDIUM
**Category:** Functional / Edge Case

**Code:**
```typescript
const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10), 100);
```

**Root Cause:** `Math.min(NaN, 100)` returns `NaN`, used as the query limit — could return all records.

**Fix:**
```typescript
const rawLimit = parseInt(String(req.query.limit ?? '20'), 10);
const limit = Math.min(isNaN(rawLimit) ? 20 : rawLimit, 100);
```

**Status:** ACTIVE

---

## LOW

---

### G-KS-F5 — Floating-Point Precision in Confidence Score

**File:** `src/engines/verificationEngine.ts` — line 105
**Severity:** LOW
**Category:** Functional / Edge Case

**Fix:**
```typescript
return parseFloat(score.toFixed(2));
```

**Status:** ACTIVE

---

### G-KS-F6 — `gps_match` Stored as Boolean Instead of Number — Precision Loss

**File:** `src/services/earnRecordService.ts` — lines 101-104
**Severity:** HIGH
**Category:** Functional / Data Loss

**Code:**
```typescript
const storedSignals: VerificationSignals = {
 ...verificationSignals,
 gps_match: verificationSignals.gps_match >= 0.5, // ← converts to 0/1 binary
};
```

**Root Cause:** `calculateConfidenceScore` multiplies `gps_match` by `SIGNAL_WEIGHTS.gps_match` (0.15). After this conversion, the raw proximity information is lost — a user 10m and a user 90m from the event center both produce `gps_match = 1`. Confidence scoring loses all distance discrimination.

**Fix:**
```typescript
const storedSignals: VerificationSignals = {
 ...verificationSignals,
 gps_match: verificationSignals.gps_match, // keep full numeric precision
};
```

**Status:** ACTIVE

---

### G-KS-F7 — `recordConversion` String userId in ObjectId Query — CastError

**File:** `src/services/karmaService.ts` — line 373
**Severity:** HIGH
**Category:** Functional / Runtime Crash

**Code:**
```typescript
const profile = await KarmaProfile.findOne({ userId });  // userId is string, schema expects ObjectId
```

**Root Cause:** Mongoose throws `CastError: Cast to ObjectId failed for value "..."` when the string doesn't match ObjectId format. This crashes the entire conversion flow. Counterpart to G-KS-F1 (which was partially fixed in `getOrCreateProfile`).

**Fix:**
```typescript
const profile = await KarmaProfile.findOne({
 userId: new mongoose.Types.ObjectId(userId),
});
```

**Status:** ACTIVE

---

### G-KS-F8 — Batch Execution String userId in ObjectId Query — CastError Crashes All Conversions

**File:** `src/services/batchService.ts` — lines 480-494
**Severity:** HIGH
**Category:** Functional / Runtime Crash

**Code:**
```typescript
await KarmaProfile.updateOne(
 { userId: record.userId },  // record.userId is string, schema expects ObjectId
 { $push: { conversionHistory: { ... } } },
);
```

**Root Cause:** Same as G-KS-F7. `record.userId` from `EarnRecord` is a string. `KarmaProfileSchema.userId` is `Schema.Types.ObjectId`. This crashes the entire `executeBatch` loop — no user in the batch gets their conversion recorded.

**Fix:**
```typescript
await KarmaProfile.updateOne(
 { userId: new Types.ObjectId(record.userId) },
 { $push: { conversionHistory: { ... } } },
);
```

**Status:** ACTIVE

---

### G-KS-F9 — Haversine NaN When `a > 1` — Corrupts Confidence Score

**File:** `src/engines/verificationEngine.ts` — lines 237-241
**Severity:** MEDIUM
**Category:** Functional / Runtime Crash

**Code:**
```typescript
const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
const distanceMeters = EARTH_RADIUS_M * c;  // NaN if a > 1
```

**Root Cause:** Due to floating-point rounding, `a` can exceed 1.0 for nearly-antipodal points. `Math.sqrt(1 - a)` produces `NaN`. This propagates: `distanceMeters = NaN`, `gps_match = NaN`, `calculateConfidenceScore` returns `NaN`, EarnRecord stores `NaN` as `confidenceScore`. The entire karma validation ecosystem is corrupted.

**Fix:**
```typescript
const clampedA = Math.max(0, Math.min(1, a));
const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
```

**Status:** ACTIVE

---

### G-KS-F10 — `adminId` (String) Cast as `Types.ObjectId` — Invalid BSON Stored

**File:** `src/services/batchService.ts` — lines 468, 509
**Severity:** MEDIUM
**Category:** Functional / Data Corruption

**Code:**
```typescript
record.convertedBy = adminId as unknown as Types.ObjectId;  // string stored in ObjectId field
batch.executedBy = adminId as unknown as Types.ObjectId;     // same issue
```

**Root Cause:** `adminId` is a `string` (from `req.userId ?? 'unknown'`). The double-cast suppresses TypeScript errors but stores a plain string in an ObjectId field. Future queries that match these fields as ObjectIds will never find matches — `EarnRecord.find({ convertedBy: someObjectId })` always returns empty.

**Fix:**
```typescript
record.convertedBy = Types.ObjectId.isValid(adminId)
 ? new Types.ObjectId(adminId)
 : new Types.ObjectId(); // fallback
```

**Status:** ACTIVE

---

### G-KS-F11 — `toResponse` Converts `_id` to String But Not `userId/eventId/bookingId`

**File:** `src/services/earnRecordService.ts` — lines 344-346
**Severity:** LOW
**Category:** Functional / Type Safety

**Code:**
```typescript
function toResponse(doc: EarnRecordDocument): EarnRecordResponse {
 return {
  id: (doc._id as mongoose.Types.ObjectId).toString(), // converted
  userId: doc.userId,  // raw — likely ObjectId
  eventId: doc.eventId,  // raw
  bookingId: doc.bookingId,  // raw
```

**Root Cause:** API responses have `_id` as string but `userId`/`eventId`/`bookingId` as Mongoose ObjectId objects. Consumers expecting consistent string fields get type mismatches.

**Fix:**
```typescript
userId: typeof doc.userId === 'object' && doc.userId !== null
 ? (doc.userId as mongoose.Types.ObjectId).toString()
 : String(doc.userId),
// ... same for eventId, bookingId
```

**Status:** ACTIVE

---

### G-KS-F12 — `csrPoolId` Defaults to Empty String Despite `required: true` in Schema

**File:** `src/engines/verificationEngine.ts` — lines 446-454
**Severity:** LOW
**Category:** Functional / Data Integrity

**Code:**
```typescript
csrPoolId: (raw.csrPoolId as string) ?? '', // empty string bypasses required: true
```

**Root Cause:** Mongoose ObjectId validation accepts `''` as a valid value for `required: true` fields. EarnRecords get created with meaningless `csrPoolId: ''`, and batch creation will never match them.

**Fix:**
```typescript
csrPoolId: (raw.csrPoolId as string) || undefined,
// And update schema: csrPoolId: { type: String, required: false }
```

**Status:** ACTIVE

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| G-KS-F1 | HIGH | ObjectId throws on invalid userId — no route validation | ACTIVE |
| G-KS-F2 | HIGH | EarnRecord batchId string vs ObjectId inconsistency | ACTIVE |
| G-KS-F6 | HIGH | gps_match stored as boolean instead of number — precision loss | ACTIVE |
| G-KS-F7 | HIGH | recordConversion string userId to ObjectId field — CastError | ACTIVE |
| G-KS-F8 | HIGH | batch execution string userId to ObjectId query — CastError | ACTIVE |
| G-KS-F3 | MEDIUM | GPS checkout falls back to (0,0) — penalizes valid check-ins | ACTIVE |
| G-KS-F4 | MEDIUM | parseInt NaN silently used as query limit | ACTIVE |
| G-KS-F9 | MEDIUM | Haversine NaN when a > 1 — corrupts confidence score | ACTIVE |
| G-KS-F10 | MEDIUM | adminId string cast as Types.ObjectId — invalid BSON stored | ACTIVE |
| G-KS-F5 | LOW | Floating-point precision in confidence score | ACTIVE |
| G-KS-F11 | LOW | toResponse converts _id to string but not userId/eventId/bookingId | ACTIVE |
| G-KS-F12 | LOW | csrPoolId defaults to '' bypassing required: true on schema | ACTIVE |
