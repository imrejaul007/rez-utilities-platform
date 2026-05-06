# Phase 1: Critical Security Fixes

**Timeline:** Today
**Total Issues:** 11 CRITICAL + 1 HIGH = 12 issues
**Estimated Effort:** ~2.5 hours

---

## Fix Sequence

Execute fixes in this order. Each fix is independent.

---

### Fix 1: Hardcoded Default QR Secret (G-KS-C1)

**File:** `src/engines/verificationEngine.ts` — lines 176, 575

```typescript
// REPLACE lines 176 and 575:
const secret = process.env.QR_SECRET || 'default-karma-qr-secret';

// WITH:
const secret = process.env.QR_SECRET;
if (!secret) {
  throw new Error('[FATAL] QR_SECRET environment variable is not set');
}
```

**Also add to `src/index.ts` startup validation (near line 130):**
```typescript
if (!process.env.QR_SECRET) {
  logger.error('[Config] QR_SECRET is not set');
  process.exit(1);
}
```

**Verify:** Unit test calling `validateQRCode` with no `QR_SECRET` env var throws error.

---

### Fix 2: Auth Middleware Response Validation (G-KS-C2)

**File:** `src/middleware/auth.ts` — after line 41

```typescript
// REPLACE the unvalidated assignment:
// req.userId = response.data.userId;
// req.userRole = response.data.role;
// req.userPermissions = response.data.permissions;

// WITH:
if (!response.data?.userId || typeof response.data.userId !== 'string') {
  res.status(401).json({ success: false, message: 'Invalid auth response' });
  return;
}
req.userId = response.data.userId;
req.userRole = response.data.role || '';
req.userPermissions = Array.isArray(response.data.permissions) ? response.data.permissions : [];
```

**Better alternative (recommended):** Decode JWT locally using `jwtSecret` instead of proxying.

---

### Fix 3: jwtSecret Validation at Startup (G-KS-C3)

**File:** `src/index.ts` — near line 130

```typescript
// ADD to required env vars array:
const required = ['MONGODB_URI', 'REDIS_URL', 'JWT_SECRET', 'QR_SECRET'];
```

---

### Fix 4: Ownership Check on Profile Routes (G-KS-C4)

**File:** `src/routes/karmaRoutes.ts` — after line 29

```typescript
// ADD after requireAuth and before getKarmaProfile:
if (req.userId !== userId && req.userRole !== 'admin' && req.userRole !== 'superadmin') {
  res.status(403).json({ success: false, message: 'Access denied' });
  return;
}
```

Apply to: `/user/:userId` (line 29), `/user/:userId/history` (line 86), `/user/:userId/level` (line 106).

---

### Fix 5: Add Auth to Batch Stats (G-KS-C5)

**File:** `src/routes/batchRoutes.ts` — line 220

```typescript
// CHANGE:
router.get('/stats', async ...
// TO:
router.get('/stats', requireAdminAuth, async ...
```

---

### Fix 6: TimingSafeEqual Length Check (G-KS-C6)

**File:** `src/engines/verificationEngine.ts` — line 183

```typescript
// REPLACE:
if (!crypto.timingSafeEqual(Buffer.from(decoded.sig), Buffer.from(expectedSig))) {

// WITH:
if (
  decoded.sig.length !== expectedSig.length ||
  !crypto.timingSafeEqual(Buffer.from(decoded.sig), Buffer.from(expectedSig))
) {
```

---

### Fix 7: Idempotency Key — Remove UUID Suffix (G-KS-C7)

**File:** `src/services/earnRecordService.ts` — line 82

```typescript
// REPLACE:
const idempotencyKey = `earn_${bookingId}_${uuidv4().slice(0, 8)}`;

// WITH:
const idempotencyKey = `earn_${bookingId}`;
```

**Verify:** Write integration test that calls `createEarnRecord` twice with same `bookingId` and confirms only 1 record exists.

---

### Fix 8: String vs ObjectId Ownership Check (G-KS-C8)

**File:** `src/routes/verifyRoutes.ts` — lines 207-215

```typescript
// REPLACE the auth block:
if (
  req.userId !== (raw.userId as string) &&
  req.userRole !== 'admin' &&
  req.userRole !== 'superadmin'
) {

// WITH:
const bookingOwnerId = typeof raw.userId === 'object'
  ? (raw.userId as mongoose.Types.ObjectId).toString()
  : String(raw.userId);
if (
  req.userId !== bookingOwnerId &&
  req.userRole !== 'admin' &&
  req.userRole !== 'superadmin'
) {
  res.status(403).json({ success: false, message: 'Access denied' });
  return;
}
```

---

### Fix 9: Karma-to-Coin Conversion (G-KS-C9) ← **MOST URGENT — silently breaks coin rewards**

**File:** `src/services/walletIntegration.ts`

This is the most critical because it silently breaks the core karma→coin reward feature. Every user who converts karma is silently NOT receiving their coins.

```typescript
// REPLACE creditUserWallet entirely:
export async function creditUserWallet(
  userId: string,
  coins: number,
  coinType: string = 'rez',
): Promise<void> {
  const response = await axios.post(
    `${walletServiceUrl}/internal/credit`,  // was '/api/wallet/credit'
    { userId, amount: coins, coinType },
    {
      headers: {
        'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN,  // was missing
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    },
  );
  if (!response.data?.success) {
    throw new Error(`Wallet credit failed: ${response.data?.message ?? 'unknown'}`);
  }
}

// ALSO fix getKarmaBalance:
export async function getKarmaBalance(userId: string): Promise<{
  balance: number;
  available: boolean;
}> {
  try {
    const response = await axios.get(
      `${walletServiceUrl}/internal/balance`,
      {
        params: { userId, coinType: 'karma_points' },
        headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN },
        timeout: 5000,
      },
    );
    return { balance: response.data?.balance ?? 0, available: true };
  } catch {
    return { balance: 0, available: false };
  }
}
```

**Verify:** Integration test that calls `creditUserWallet` and verifies wallet balance increased.

---

### Fix 10: EarnRecord Schema vs Canonical Type Alignment (G-KS-C10)

**File:** `src/models/EarnRecord.ts`

This is a schema migration — requires data migration for existing records.

```typescript
// REPLACE the verificationSignals subdocument schema:
verificationSignals: {
  gps_match: { type: Number, min: 0, max: 1 },   // renamed from gps_match (keep same name, matches canonical)
  qr_verified: Boolean,                           // was: qr_in + qr_out combined
  face_verified: Boolean,                         // was: photo_proof (renamed)
  manual_override: Boolean,                       // was: ngo_approved (renamed)
}
```

**IMPORTANT:** Requires a MongoDB migration to rename fields in existing documents:
```javascript
// Migration script needed:
db.earn_records.updateMany(
  {},
  {
    $rename: {
      'verificationSignals.qr_in': 'verificationSignals.qr_verified',
      'verificationSignals.photo_proof': 'verificationSignals.face_verified',
      'verificationSignals.ngo_approved': 'verificationSignals.manual_override',
    }
  }
);
```

---

### Fix 11: Admin Role Case Normalization (G-KS-C9 / G-KS-H1)

**File:** `src/middleware/adminAuth.ts` — lines 15-35

```typescript
// REPLACE the role check:
const adminRoles = ['admin', 'superadmin'];
if (!req.userRole || !adminRoles.includes(req.userRole)) {

// WITH:
const normalizedRole = (req.userRole || '').toLowerCase().replace('_', '');
if (!['admin', 'superadmin'].includes(normalizedRole)) {
```

---

## Phase 1 Verification Checklist

After all fixes are applied:

- [ ] `npm run build` passes with no errors
- [ ] `npm test` passes with no failures
- [ ] Unit test: auth middleware rejects malformed auth service response
- [ ] Unit test: validateQRCode throws when QR_SECRET is unset
- [ ] Integration test: idempotency prevents duplicate EarnRecords
- [ ] Integration test: user A cannot read user B's profile (expects 403)
- [ ] Integration test: user A cannot read user B's booking (expects 403)
- [ ] Manual: `curl` to `/api/karma/batch/stats` without auth returns 401
- [ ] Manual: `curl` to `/api/karma/user/:otherUserId` without admin role returns 403
- [ ] **Integration test: `creditUserWallet` — karma→coin conversion actually credits the wallet** ← MOST IMPORTANT
- [ ] Manual: Create earn record, convert to coins, verify coins appear in wallet balance
- [ ] Verify EarnRecord MongoDB migration ran and fields were renamed
