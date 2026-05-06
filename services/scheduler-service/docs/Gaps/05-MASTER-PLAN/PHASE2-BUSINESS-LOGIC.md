# Phase 2: Business Logic Fixes

**Timeline:** This Week
**Total Issues:** 13 (9 HIGH + 4 MEDIUM)
**Estimated Effort:** ~4.5 hours

---

## Fix Sequence

---

### Fix 1: Duplicate const startOfWeek (G-KS-B1)

**File:** `src/services/karmaService.ts` — lines 122-123, 190

**Action:** Remove the duplicate declaration at line 190. Declare `startOfWeek` once at line 122 and use it for both the cap check and the accumulation logic.

---

### Fix 2: Karma Input Validation (G-KS-B2)

**File:** `src/services/karmaService.ts` — top of `addKarma` function

```typescript
// ADD at the top of addKarma():
if (typeof karma !== 'number' || !Number.isFinite(karma) || karma <= 0) {
  logger.warn('[Karma] addKarma rejected invalid karma value', { userId, karma });
  throw new Error('Karma value must be a positive finite number');
}
```

**Verify:** Unit test with negative, NaN, Infinity, and 0 values — all should throw.

---

### Fix 3: Kill Switch Sets PAUSED (G-KS-B3)

**File:** `src/services/batchService.ts` — line 693

```typescript
// CHANGE:
$set: {
  status: 'DRAFT',  // was 'DRAFT'
// TO:
$set: {
  status: 'PAUSED',
```

---

### Fix 4: Auto-Checkout Creates EarnRecord (G-KS-B4)

**File:** `src/workers/autoCheckoutWorker.ts` — after line 124

After the `findByIdAndUpdate` call, add EarnRecord creation with partial credit:

```typescript
const { createEarnRecord } = await import('../services/earnRecordService.js');
try {
  await createEarnRecord({
    userId: booking.userId.toString(),
    eventId: booking.eventId.toString(),
    bookingId: booking._id.toString(),
    karmaEarned: Math.floor((booking.karmaEarned as number ?? 0) * 0.5),
    verificationSignals: {
      qr_in: true,
      qr_out: true,
      gps_match: 0,
      ngo_approved: false,
      photo_proof: false,
    },
    confidenceScore: 0.3,
    csrPoolId: (booking.csrPoolId as string) ?? '',
  });
  logger.info('[AutoCheckout] Created partial EarnRecord', { bookingId: booking._id });
} catch (err) {
  logger.error('[AutoCheckout] Failed to create EarnRecord', { bookingId: booking._id, err });
}
```

---

### Fix 5: Decay Worker Daily Schedule (G-KS-B5)

**File:** `src/workers/decayWorker.ts` — line 26

```typescript
// CHANGE:
cronTime: batchCronSchedule, // '59 23 * * 0' (weekly)

// TO:
cronTime: '0 0 * * *', // Daily at midnight UTC
```

Also update the JSDoc comment to say "daily" consistently.

---

### Fix 6: GPS Score Continuous at Boundary (G-KS-B6)

**File:** `src/engines/karmaEngine.ts` — lines 172-173, 244-246

```typescript
// REPLACE the scoring function with continuous version:
if (distanceMeters <= radiusMeters) {
  const ratio = distanceMeters / radiusMeters;
  return Math.round((1 - ratio * 0.5) * 100) / 100; // 1.0 at center, 0.5 at edge
}
// Outside: linear falloff from 0.5 to 0
const excess = distanceMeters - radiusMeters;
return Math.max(0, Math.round((0.5 - excess / radiusMeters * 0.5) * 100) / 100);
```

---

### Fix 7: Standardize Week Boundaries (G-KS-B7)

**Files:** `src/services/karmaService.ts`, `src/services/batchService.ts`, `src/services/earnRecordService.ts`

Replace all `moment().startOf('week')` with `moment().startOf('isoWeek')` to use Monday-based ISO weeks consistently across:
- Weekly karma cap checking
- Weekly coin conversion batches
- Decay scheduling

Search for `startOf('week')` across all service files and replace with `startOf('isoWeek')`.

---

### Fix 8: Atomic CSR Pool Decrement (G-KS-B8)

**File:** `src/services/batchService.ts` — lines 474-477

```typescript
// REPLACE the update call:
const result = await CSRPool.updateOne(
  { _id: batch.csrPoolId, coinPoolRemaining: { $gte: cappedCoins } },
  { $inc: { coinPoolRemaining: -cappedCoins, issuedCoins: cappedCoins } },
);

if (result.modifiedCount === 0) {
  throw new Error(`Pool ${batch.csrPoolId} insufficient balance for record ${recordIdStr}`);
}
```

---

### Fix 9: NoSQL Injection Prevention (G-KS-C10)

**File:** `src/routes/batchRoutes.ts` — lines 273-276

```typescript
// REPLACE raw query param usage with sanitized values:
const action = typeof req.query.action === 'string'
  ? req.query.action.replace(/[${}]/g, '') : undefined;
const adminId = typeof req.query.adminId === 'string'
  ? req.query.adminId.replace(/[${}]/g, '') : undefined;
const batchId = mongoose.Types.ObjectId.isValid(req.query.batchId as string)
  ? req.query.batchId as string : undefined;
```

---

### Fix 10: Rate Limit Fallback Store (G-KS-C11)

**File:** `src/index.ts` — line 39

Use an in-memory fallback store when Redis is unavailable. Import `rate-limit-memory` and switch stores based on Redis status.

---

### Fix 11: Upgrade bcrypt (G-KS-H3)

**File:** `package.json`

```bash
npm install bcrypt@^5.2.0
# OR use bcryptjs as pure-JS alternative:
npm install bcryptjs@^2.4.3
```

---

### Fix 12: conversionHistory Rate Schema Alignment (G-KS-H2)

**File:** `src/models/KarmaProfile.ts`

```typescript
// CHANGE rate field in conversionHistory subdocument:
rate: {
  type: Number,
  enum: [0.25, 0.5, 0.75, 1.0],  // was: { min: 0, max: 1 }
}
```

---

### Fix 13: Add Test Coverage for Critical Paths (G-KS-H4)

**Files:** `src/__tests__/`

Add integration tests using `mongodb-memory-server` for:
```typescript
// src/__tests__/karmaService.test.ts — ADD:
test('addKarma rejects negative karma', async () => {
  await expect(addKarma('user123', -100)).rejects.toThrow();
});
test('addKarma rejects NaN', async () => {
  await expect(addKarma('user123', NaN)).rejects.toThrow();
});
test('addKarma caps weekly limit at 300', async () => {
  // Set up profile with 299 karma this week, add 10 → should cap
});

// src/__tests__/earnRecordService.test.ts — ADD:
test('createEarnRecord is idempotent for same bookingId', async () => {
  await createEarnRecord({ bookingId: 'booking123', ... });
  await createEarnRecord({ bookingId: 'booking123', ... });
  const records = await EarnRecord.find({ bookingId: 'booking123' });
  expect(records.length).toBe(1);
});

// src/__tests__/walletIntegration.test.ts — ADD:
test('creditUserWallet calls /internal/credit with auth header', async () => {
  // Mock axios, verify endpoint and headers
});
```

---

### Fix 14: Wallet Balance Return Typed Result (G-KS-E1) — Already partially fixed in Phase 1

**File:** `src/services/walletIntegration.ts`

Ensure `getKarmaBalance` uses the correct `/internal/balance` endpoint with auth header (done in G-KS-C9 fix).

---

## Phase 2 Verification Checklist

- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Unit test: `addKarma` rejects negative/NaN/Infinity values
- [ ] Unit test: GPS score is continuous at radius boundary (test at 0%, 50%, 100%, 101%)
- [ ] Integration test: Auto-checkout creates partial EarnRecord
- [ ] Manual: Verify decay worker cron expression is `0 0 * * *`
- [ ] Manual: Verify all week boundary calculations use `isoWeek`
- [ ] Manual: Verify CSR pool decrement prevents over-depletion
- [ ] `npm audit` passes (no high/critical vulnerabilities)
