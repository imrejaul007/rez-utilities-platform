# KARMA SERVICE — SECURITY GAPS

**Service:** `rez-karma-service`
**Date:** 2026-04-16
**Severity:** 11 CRITICAL, 6 HIGH, 6 MEDIUM, 1 LOW

---

## CRITICAL

---

### G-KS-C1 — Hardcoded Default QR Secret

**File:** `src/engines/verificationEngine.ts` — lines 176, 575
**Severity:** CRITICAL
**Category:** Security / Hardcoded Secret

**Code:**
```typescript
// Line 176:
const secret = process.env.QR_SECRET || 'default-karma-qr-secret';

// Line 575:
const secret = process.env.QR_SECRET || 'default-karma-qr-secret';
```

**Root Cause:** When `QR_SECRET` env var is unset, both `validateQRCode()` and `generateEventQRCodes()` fall back to `'default-karma-qr-secret'`. This value is publicly known. An attacker can generate valid check-in/check-out QR codes for any event, forge attendance, and steal karma rewards.

**Fix:**
```typescript
const secret = process.env.QR_SECRET;
if (!secret) {
  throw new Error('[FATAL] QR_SECRET environment variable is not set');
}
```

**Prevention:** Add `QR_SECRET` to required env vars validation at startup. See `src/index.ts` lines 130-136.

**Status:** ACTIVE

---

### G-KS-C2 — Auth Middleware Trusts Response With Zero Validation

**File:** `src/middleware/auth.ts` — lines 41-49
**Severity:** CRITICAL
**Category:** Security / Auth Bypass

**Code:**
```typescript
const response = await axios.post<AuthPayload>(
  `${authServiceUrl}/api/auth/verify`,
  { token },
  { timeout: 5000 },
);

req.userId = response.data.userId;
req.userRole = response.data.role;
req.userPermissions = response.data.permissions;
```

**Root Cause:** `requireAuth` proxies to the auth service but validates nothing from the response. No JWT decode, no shape validation. Garbage auth responses inject arbitrary userIds into requests.

**Fix:**
```typescript
if (!response.data?.userId || typeof response.data.userId !== 'string') {
  res.status(401).json({ success: false, message: 'Invalid auth response' });
  return;
}
```

**Better alternative:** Decode JWT locally using `jwtSecret` instead of proxying.

**Status:** ACTIVE

---

### G-KS-C3 — jwtSecret Unvalidated at Startup

**File:** `src/config/index.ts` — line 22
**Severity:** CRITICAL
**Category:** Security / Env Management

**Code:**
```typescript
export const jwtSecret = process.env.JWT_SECRET as string;
```

**Root Cause:** `JWT_SECRET` is cast as `string` but never validated. If missing, `jwtSecret` is `undefined`. Unlike `MONGODB_URI` and `REDIS_URL` which are validated in `src/index.ts` lines 130-136, `JWT_SECRET` is not checked.

**Fix:** Add `JWT_SECRET` to the required env vars check in `src/index.ts`:
```typescript
const required = ['MONGODB_URI', 'REDIS_URL', 'JWT_SECRET'];
```

**Status:** ✅ FIXED (2026-04-17) — jwtSecret validation added to startup checks

---

### G-KS-C4 — Horizontal Privilege Escalation on Profile Routes

**File:** `src/routes/karmaRoutes.ts` — lines 29-80, 86-100, 106-119
**Severity:** CRITICAL
**Category:** Security / Broken Object Reference Level Authorization

**Code:**
```typescript
router.get('/user/:userId', requireAuth, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const profile = await getKarmaProfile(userId);
  // No ownership check — any authenticated user can read any profile
```

**Root Cause:** Any authenticated user can retrieve any other user's karma profile, level info, conversion history, badges.

**Fix:**
```typescript
if (req.userId !== userId && req.userRole !== 'admin' && req.userRole !== 'superadmin') {
  res.status(403).json({ success: false, message: 'Access denied' });
  return;
}
```

Applies to: `/user/:userId` (line 29), `/user/:userId/history` (line 86), `/user/:userId/level` (line 106).

**Status:** ACTIVE

---

### G-KS-C5 — Batch Stats Endpoint Unauthenticated

**File:** `src/routes/batchRoutes.ts` — line 220
**Severity:** CRITICAL
**Category:** Security / Information Disclosure

**Code:**
```typescript
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
```

**Root Cause:** `/api/karma/batch/stats` has no `requireAuth` or `requireAdminAuth`. Exposes `totalCoinsIssued` — financial supply data.

**Fix:**
```typescript
router.get('/stats', requireAdminAuth, async ...
```

**Status:** ✅ FIXED (2026-04-17) — requireAdminAuth added to batch stats route

---

### G-KS-C6 — Timing Attack on crypto.timingSafeEqual

**File:** `src/engines/verificationEngine.ts` — lines 183-185
**Severity:** CRITICAL
**Category:** Security / Timing Oracle

**Code:**
```typescript
if (!crypto.timingSafeEqual(Buffer.from(decoded.sig), Buffer.from(expectedSig))) {
  return { valid: false, error: 'QR code signature verification failed' };
}
```

**Root Cause:** `crypto.timingSafeEqual` throws `RangeError` if buffers have different lengths. An attacker can distinguish "length mismatch" from "wrong signature" via timing.

**Fix:**
```typescript
if (decoded.sig.length !== expectedSig.length ||
  !crypto.timingSafeEqual(Buffer.from(decoded.sig), Buffer.from(expectedSig))) {
  return { valid: false, error: 'QR code signature verification failed' };
}
```

**Status:** ✅ FIXED (2026-04-17) — Length check added before timingSafeEqual call

---

### G-KS-C7 — Idempotency Key Collision Causes Duplicate EarnRecords

**File:** `src/services/earnRecordService.ts` — lines 82-83
**Severity:** CRITICAL
**Category:** Security / Data Integrity

**Code:**
```typescript
const idempotencyKey = `earn_${bookingId}_${uuidv4().slice(0, 8)}`;
```

**Root Cause:** The idempotency key includes a random UUID suffix. Two identical retry requests for the same `bookingId` generate **different** keys, so the duplicate check never fires. Retried requests create duplicate EarnRecords — users are **double-credited karma**.

**Fix:**
```typescript
const idempotencyKey = `earn_${bookingId}`;
```

**Status:** ACTIVE

---

### G-KS-C8 — String vs ObjectId Ownership Check Always Bypassed

**File:** `src/routes/verifyRoutes.ts` — lines 207-215
**Severity:** CRITICAL
**Category:** Security / Auth Bypass

**Code:**
```typescript
if (req.userId !== (raw.userId as string) && req.userRole !== 'admin' && req.userRole !== 'superadmin') {
```

**Root Cause:** `req.userId` (string) !== `raw.userId` (ObjectId) is always `true`. The ownership check **always** fails for non-admin users. Any authenticated user can read any booking's full details.

**Fix:**
```typescript
const bookingOwnerId = typeof raw.userId === 'object'
  ? (raw.userId as mongoose.Types.ObjectId).toString()
  : String(raw.userId);
if (req.userId !== bookingOwnerId && req.userRole !== 'admin' && req.userRole !== 'superadmin') {
```

**Status:** ACTIVE

---

### G-KS-C9 — Karma-to-Coin Conversion Is Completely Broken

**File:** `src/services/walletIntegration.ts` — lines 116-134
**Severity:** CRITICAL
**Category:** Security / Finance / Data Integrity
**Added:** 2026-04-16 (missed in initial audit)

**Code:**
```typescript
export async function creditUserWallet(
  userId: string,
  coins: number,
  coinType: string = 'rez',
): Promise<void> {
  const response = await axios.post(
    `${walletServiceUrl}/api/wallet/credit`,  // ← WRONG endpoint
    { userId, amount: coins, coinType },
  );
}
```

**Root Cause:** Two simultaneous failures:
1. **Wrong endpoint:** `walletServiceUrl/api/wallet/credit` does not exist. The wallet service only exposes `/internal/credit`.
2. **Missing auth header:** `/internal/credit` requires `requireInternalToken` middleware. No `x-internal-token` header is sent.

**Impact:** Every karma→coin conversion via `createEarnRecord` → `updateEarnRecordStatus` → `creditUserWallet()` silently fails. Users earn karma but **never receive ReZ coins**. The feature appears to work (no error surfaced) but coins never appear in their wallet. This is a **silent financial failure** — users are told their karma will convert to coins but it never does.

**Fix:**
```typescript
export async function creditUserWallet(
  userId: string,
  coins: number,
  coinType: string = 'rez',
): Promise<void> {
  const response = await axios.post(
    `${walletServiceUrl}/internal/credit`,
    { userId, amount: coins, coinType },
    {
      headers: {
        'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    },
  );
  if (!response.data?.success) {
    throw new Error(`Wallet credit failed: ${response.data?.message ?? 'unknown error'}`);
  }
}
```

Also update `getKarmaBalance` to use the correct endpoint:
```typescript
const response = await axios.get(
  `${walletServiceUrl}/internal/balance`,
  { params: { userId, coinType }, headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN } },
);
```

**Prevention:** Add integration test that calls `creditUserWallet` and verifies the wallet balance increased.

**Status:** ACTIVE

---

### G-KS-C10 — EarnRecord Schema vs Canonical Type — Completely Different Shapes

**File:** `src/models/EarnRecord.ts` vs `packages/shared-types/src/entities/karma.ts`
**Severity:** CRITICAL
**Category:** Architecture / Schema vs Type Divergence
**Added:** 2026-04-16 (missed in initial audit)

**Code:**
```typescript
// MongoDB model EarnRecordSchema — verificationSignals subdocument:
{
  qr_in: Boolean,
  qr_out: Boolean,
  gps_match: Number,       // 0-1
  ngo_approved: Boolean,
  photo_proof: Boolean,
}

// Canonical IEarnRecord — verificationSignals:
{
  gps_match?: number,
  qr_verified?: boolean,
  face_verified?: boolean,
  manual_override?: boolean,
}
```

**Root Cause:** The two types share **zero field names**. The data stored in MongoDB (`qr_in`, `qr_out`, `ngo_approved`, `photo_proof`) cannot be safely mapped to the canonical `IEarnRecord` type (`gps_match`, `qr_verified`, `face_verified`, `manual_override`). Any consumer reading earn records from the karma service API will get completely wrong data shapes. The verification signals used by the karma engine (QR in/out, NGO approval, photo proof) are not compatible with what the canonical type defines (face verification, manual override).

**Fix:** Align the model schema to match the canonical `IEarnRecord` verificationSignals shape. This is a breaking schema change that requires migration.

```typescript
// Update EarnRecordSchema verificationSignals:
{
  gps_match: { type: Number, min: 0, max: 1 },     // renamed from gps_match (same name, but now matches canonical)
  qr_verified: Boolean,                            // was qr_in + qr_out
  face_verified: Boolean,                           // was photo_proof (renamed)
  manual_override: Boolean,                         // was ngo_approved (renamed)
}
```

Note: This requires a data migration since existing records use the old field names.

**Status:** ACTIVE

---

## HIGH

---

### G-KS-H1 — Admin Role Check Case-Sensitive

**File:** `src/middleware/adminAuth.ts` — lines 15-35
**Severity:** HIGH
**Category:** Security / Auth Bypass

**Code:**
```typescript
const adminRoles = ['admin', 'superadmin'];
if (!req.userRole || !adminRoles.includes(req.userRole)) {
```

**Root Cause:** `'ADMIN'`, `'SuperAdmin'`, `'super_admin'` silently fail the admin check.

**Fix:**
```typescript
const normalizedRole = (req.userRole || '').toLowerCase().replace('_', '');
if (!['admin', 'superadmin'].includes(normalizedRole)) { ... }
```

**Status:** ACTIVE

---

### G-KS-H2 — `conversionHistory[].rate` Schema vs Canonical Mismatch

**File:** `src/models/KarmaProfile.ts` vs `packages/shared-types/src/entities/karma.ts`
**Severity:** HIGH
**Category:** Architecture / Schema vs Type Divergence
**Added:** 2026-04-16 (missed in initial audit)

**Code:**
```typescript
// Model schema:
rate: { type: Number, min: 0, max: 1 }  // any decimal 0-1

// Canonical:
rate: KarmaConversionRate = 0.25 | 0.5 | 0.75 | 1.0  // only 4 specific values
```

**Root Cause:** Any conversion with a non-standard rate (e.g., 0.33) would be accepted by the model but violate the canonical type contract. The schema allows any value 0-1 but the type restricts to 4 discrete values.

**Fix:** Update the schema to validate against the canonical rate values:
```typescript
rate: {
  type: Number,
  enum: [0.25, 0.5, 0.75, 1.0],
}
```

**Status:** ACTIVE

---

### G-KS-H3 — `bcrypt ^5.1.1` Has Known CVEs

**File:** `package.json`
**Severity:** HIGH
**Category:** Security / Dependencies
**Added:** 2026-04-16 (missed in initial audit)

**Root Cause:** `bcrypt` v5.1.x has documented vulnerabilities. The package should be upgraded.

**Fix:**
```bash
npm install bcrypt@^5.2.0
# OR use bcryptjs as a pure-JS alternative:
npm install bcryptjs@^2.4.3
```

**Status:** ACTIVE

---

### G-KS-H4 — Critical Business Logic Has Zero Test Coverage

**File:** `src/__tests__/` (existing tests are shallow)
**Severity:** HIGH
**Category:** Quality / Risk
**Added:** 2026-04-16 (missed in initial audit)

| Critical path | Test coverage |
|---------------|--------------|
| `addKarma()` | **NONE** |
| `createEarnRecord()` | **NONE** |
| `creditUserWallet()` | **NONE** |
| `applyDecayToAll()` | **NONE** |
| `processCheckIn` + `processCheckOut` (real DB) | **NONE** |
| `batchService` | **NONE** |

Existing tests only cover route handlers (mocked) and math functions (`calculateConfidenceScore`, `getApprovalStatus`, `checkGPSProximity`). The karma service's most critical paths have zero coverage.

**Fix:** Add integration tests for all critical paths above. Use a test database (e.g., `mongodb-memory-server`) for tests that require MongoDB.

**Status:** ACTIVE

---

## MEDIUM

---

### G-KS-C11 — NoSQL Injection Risk in Audit Log Query

**File:** `src/routes/batchRoutes.ts` — lines 273-276
**Severity:** MEDIUM
**Category:** Security / Injection

**Code:**
```typescript
const action = req.query.action as string | undefined;
const adminId = req.query.adminId as string | undefined;
const batchId = req.query.batchId as string | undefined;
```

**Root Cause:** `req.query` values used in MongoDB query filters without sanitization.

**Fix:**
```typescript
const action = typeof req.query.action === 'string'
  ? req.query.action.replace(/[${}]/g, '') : undefined;
const batchId = mongoose.Types.ObjectId.isValid(req.query.batchId as string)
  ? req.query.batchId as string : undefined;
```

**Status:** ACTIVE

---

### G-KS-C12 — Rate Limiting Disabled When Redis Unavailable

**File:** `src/index.ts` — line 39
**Severity:** MEDIUM
**Category:** Security / Availability

**Code:**
```typescript
if (redis.status === 'ready' || redis.status === 'connect') {
  app.use(rateLimit({ ... }));
}
```

**Root Cause:** Redis outage = complete bypass of rate limiting.

**Fix:** Use an in-memory fallback store when Redis is unavailable.

**Status:** ACTIVE

---

### G-KS-M1 — `ILevelHistoryEntry.reason` Silently Ignored

**File:** `src/services/karmaService.ts` — line 312
**Severity:** MEDIUM
**Category:** Architecture / Data Integrity
**Added:** 2026-04-16 (missed in initial audit)

**Code:**
```typescript
const entry: ILevelHistoryEntry = {
  level: delta.newLevel,
  earnedAt: new Date(),
  reason: 'decay', // BE-KAR-007 FIX: Record decay as reason
};
```

**Root Cause:** `ILevelHistoryEntry` type has no `reason` field. The Mongoose schema has no `reason` field in the `levelHistory` embedded schema. This field is set but **never persisted**. The fix comment is misleading — the field is silently dropped.

**Fix:** Either add `reason` to `ILevelHistoryEntry` in the model and canonical type, or remove the assignment:
```typescript
// Option A — add the field:
const entry: ILevelHistoryEntry = {
  level: delta.newLevel,
  earnedAt: new Date(),
  reason: 'decay',
};
// Then update model schema:
// levelHistory: [{ level: String, earnedAt: Date, reason: String }]

// Option B — remove the dead assignment:
const entry: ILevelHistoryEntry = {
  level: delta.newLevel,
  earnedAt: new Date(),
};
```

**Status:** ACTIVE

---

### G-KS-M2 — `IConversionHistoryEntry.batchId` Type Mismatch

**File:** `src/models/KarmaProfile.ts` vs `packages/shared-types/src/entities/karma.ts`
**Severity:** MEDIUM
**Category:** Architecture / Schema vs Type Divergence
**Added:** 2026-04-16 (missed in initial audit)

- Model: `batchId: mongoose.Types.ObjectId`
- Canonical: `batchId: string`

Type system inconsistency between packages — not caught by TypeScript.

**Fix:** Normalize to `string` (ObjectId serializes to string in JSON).

**Status:** ACTIVE

---

### G-KS-M3 — `moment` Deprecated + `moment-timezone` Not Declared

**File:** `package.json`
**Severity:** MEDIUM
**Category:** Architecture / Technical Debt
**Added:** 2026-04-16 (missed in initial audit)

`moment` is deprecated. `moment-timezone` is used but not declared as a dependency.

**Fix:** Migrate to `date-fns` + `date-fns-tz`, or declare `moment-timezone` explicitly.

**Status:** ACTIVE

---

## LOW

---

### G-KS-C14 — No Auth Check on `getEarnRecord` — Any User Can Read Any Record

**File:** `src/services/earnRecordService.ts` — lines 151-154
**Severity:** CRITICAL
**Category:** Security / Broken Object Reference Level Authorization

**Code:**
```typescript
// getEarnRecord is callable by any authenticated user:
export async function getEarnRecord(recordId: string): Promise<EarnRecordResponse | null> {
 const record = await EarnRecord.findById(recordId).lean();
 if (!record) return null;
 return toResponse(record as EarnRecordDocument); // ← returns full record, no auth check
}
```

**Root Cause:** `getEarnRecord` is a public service function. Any authenticated user who knows (or iterates) a record's `_id` can read its full details — `karmaEarned`, `conversionRateSnapshot`, `rezCoinsEarned`, `verificationSignals`. This is information disclosure and potential financial intelligence gathering.

**Fix:**
```typescript
export async function getEarnRecord(
 recordId: string,
 requestingUserId?: string,
): Promise<EarnRecordResponse | null> {
 if (!mongoose.Types.ObjectId.isValid(recordId)) return null;
 const record = await EarnRecord.findById(recordId).lean();
 if (!record) return null;

 const recordOwnerId = typeof record.userId === 'object'
  ? (record.userId as mongoose.Types.ObjectId).toString()
  : String(record.userId);
 if (requestingUserId && recordOwnerId !== requestingUserId) return null;

 return toResponse(record as EarnRecordDocument);
}
```

**Status:** ACTIVE

---

### G-KS-H5 — `batchId` Not Validated in `getBatchPreview` and `checkBatchAnomalies`

**File:** `src/services/batchService.ts` — lines 277, 285, 668
**Severity:** HIGH
**Category:** Security / Input Validation

**Code:**
```typescript
// getBatchPreview — batchId used in Batch.findById, EarnRecord.find, CSRPool.findById
export async function getBatchPreview(batchId: string): Promise<BatchPreview | null> {
 const batch = await Batch.findById(batchId).lean();
 // ... batchId flows to 4 more queries without validation
}

// checkBatchAnomalies — same issue
const batch = await Batch.findOne({ _id: batchId }).lean();
```

**Root Cause:** `batchId` flows through 5 MongoDB queries without `mongoose.Types.ObjectId.isValid()` checks. While Mongoose returns null for malformed IDs, the unvalidated string also appears in audit-sensitive operations (batch anomalies). If ever called from non-admin context, this becomes a horizontal enumeration vector.

**Fix:**
```typescript
export async function getBatchPreview(batchId: string): Promise<BatchPreview | null> {
 if (!mongoose.Types.ObjectId.isValid(batchId)) return null;
 // ...
}
```

**Status:** ACTIVE

---

### G-KS-H6 — `getKarmaBalance` Uses Public Endpoint Without Auth + Silent Failure

**File:** `src/services/walletIntegration.ts` — lines 115-134
**Severity:** HIGH
**Category:** Security / Authentication + Error Handling

**Code:**
```typescript
// getKarmaBalance calls public /api/wallet/balance without x-internal-token
const response = await client.get('/api/wallet/balance', {
 params: { coinType: 'karma_points' },
 // ← NO auth header
});
// On any error: returns 0 silently — caller cannot distinguish "zero balance" from "service down"
```

**Root Cause:** Two issues: (1) calls a public wallet endpoint without service-to-service auth — any network caller can query karma balance; (2) silent `return 0` on failure means callers like `getBatchPreview` cannot detect unavailability, potentially issuing incorrect coin amounts.

**Fix:**
```typescript
export async function getKarmaBalance(userId: string): Promise<{ balance: number; available: boolean }> {
 try {
  const response = await client.get('/internal/balance', {
   params: { userId, coinType: 'karma_points' },
   headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN },
  });
  return { balance: response.data?.balance ?? 0, available: true };
 } catch {
  return { balance: 0, available: false };
 }
}
```

**Status:** ACTIVE

---

### G-KS-C15 — `adminId` and `batchId` in Audit Log Query Unvalidated (Extends G-KS-C11)

**File:** `src/routes/batchRoutes.ts` — lines 271-286; `src/services/auditService.ts` — lines 80-84
**Severity:** MEDIUM
**Category:** Security / NoSQL Injection

**Code:**
```typescript
// batchRoutes.ts — adminId and batchId used raw in audit log query:
const adminId = req.query.adminId as string | undefined; // ← NOT validated
const batchId = req.query.batchId as string | undefined;   // ← NOT validated

// auditService.ts — passed directly to MongoDB filter:
if (adminId) filter.adminId = adminId;
if (batchId) filter.batchId = batchId;
```

**Root Cause:** G-KS-C11 documented the missing validation for `action`, `startDate`, and `endDate` — but `adminId` and `batchId` were missed. Both flow raw into MongoDB query filters where NoSQL operators (`{ "$gt": "" }`) could be injected by an admin-level attacker.

**Fix:**
```typescript
const adminId = typeof req.query.adminId === 'string' && mongoose.Types.ObjectId.isValid(req.query.adminId)
 ? req.query.adminId : undefined;
const batchId = typeof req.query.batchId === 'string' && mongoose.Types.ObjectId.isValid(req.query.batchId)
 ? req.query.batchId : undefined;
```

**Status:** ACTIVE

---

### G-KS-C16 — Kill Switch `reason` Not Length-Limited or Sanitized

**File:** `src/routes/batchRoutes.ts` — lines 189-214; `src/services/batchService.ts` — lines 687-705
**Severity:** MEDIUM
**Category:** Security / Input Validation / Injection

**Code:**
```typescript
const reason = (req.body?.reason as string) ?? 'No reason provided'; // ← no limit
// Stored in MongoDB and audit log without sanitization:
pauseReason: reason,  // unbounded string in DB
```

**Root Cause:** Arbitrary-length string stored in MongoDB (storage DoS) and audit logs (log injection). If ever rendered in a UI, potential stored XSS vector.

**Fix:**
```typescript
const rawReason = req.body?.reason;
const reason = typeof rawReason === 'string'
 ? rawReason.slice(0, 500).replace(/[^\x20-\x7E\s]/g, '') // ASCII printable + spaces, max 500
 : 'No reason provided';
```

**Status:** ACTIVE

---

### G-KS-C17 — Two Logger Instances With Inconsistent Format Settings

**File:** `src/config/logger.ts`; `src/utils/logger.ts`
**Severity:** MEDIUM
**Category:** Security / Observability

**Code:**
```typescript
// config/logger.ts — uses colorized human-readable format in non-production:
process.env.NODE_ENV === 'production' ? winston.format.json() : winston.format.colorize()
// utils/logger.ts — always JSON:
winston.format.json() // always JSON
```

**Root Cause:** Security-critical events flow through `config/logger.ts` (batch operations, admin actions). In non-production, they use human-readable format that strips field names and omits metadata — making security events invisible in structured log aggregators (Datadog, Splunk). An attacker operating in staging leaves no machine-parseable forensic trace.

**Fix:** Consolidate to a single logger, always JSON format. All security-sensitive components should use the same logger instance.

**Status:** ACTIVE

---

### G-KS-C18 — `userTimezone` Used in Decay But Never Defined in Schema

**File:** `src/services/karmaService.ts` — line 289; `src/engines/karmaEngine.ts` — lines 201-202
**Severity:** MEDIUM
**Category:** Architecture / Data Integrity

**Code:**
```typescript
// karmaService.ts — userTimezone read from profile but schema has no such field:
const delta = applyDailyDecay(plainProfile as Parameters<typeof applyDailyDecay>[0], profile.userTimezone);

// karmaEngine.ts — falls back to UTC when undefined:
const tz = userTimezone || 'UTC';
```

**Root Cause:** `profile.userTimezone` is always `undefined` (no schema field). `applyDailyDecay` always uses UTC regardless of what BE-KAR-006 ("Use user's timezone") intended. If the field were added to the schema, no input validation exists — invalid timezone strings would cause `moment.tz()` to throw and crash the decay worker.

**Fix:** Either add `userTimezone` to the schema with enum/array validation, or remove the unused parameter and accept UTC behavior.

**Status:** ACTIVE

---

### G-KS-C19 — Missing `await` on `detectFraudAnomalies` — Unhandled Promise

**File:** `src/routes/verifyRoutes.ts` — line 217
**Severity:** CRITICAL
**Category:** Security / Reliability

**Code:**
```typescript
const anomalies = await detectFraudAnomalies(bookingId); // ← missing await
```

**Root Cause:** The `await` keyword is absent. The Promise is created and assigned to `anomalies`, but execution continues without waiting. If `detectFraudAnomalies` throws (MongoDB timeout, etc.), the error is unhandled — the process crashes with an unhandled promise rejection. The 200 response is sent before the function completes. If the function returns `[]` due to timing, fraud goes undetected and the client gets clean results.

**Fix:**
```typescript
const anomalies = await detectFraudAnomalies(bookingId); // add await
```

**Status:** ACTIVE

---

### G-KS-C20 — `requireAdmin` Referenced But Not Imported — Module Load Crash

**File:** `src/routes/batchRoutes.ts` — lines 13, 220
**Severity:** CRITICAL
**Category:** Security / Deployment

**Code:**
```typescript
// Line 13 — imports:
import { requireAdminAuth } from '../middleware/adminAuth.js';

// Line 220 — references undefined identifier:
router.get('/stats', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
```

**Root Cause:** Only `requireAdminAuth` is imported. `requireAdmin` is referenced but never imported. At module load time, Node.js throws `ReferenceError: requireAdmin is not defined`. The entire batch routes module fails to load, crashing the karma service on startup. The `/batch/stats` endpoint (which exposes financial supply data: total coins issued, karma converted) is inaccessible regardless of auth — the module itself never initializes.

**Fix:**
```typescript
// Option A — use the correct imported name:
router.get('/stats', requireAdminAuth, async ...)

// Option B — import both:
// import { requireAdmin, requireAdminAuth } from '../middleware/adminAuth.js';
```

**Status:** ACTIVE

---

### G-KS-L1 — `userId` Not Validated at `createEarnRecord` Service Boundary

**File:** `src/services/earnRecordService.ts` — lines 69-141
**Severity:** LOW
**Category:** Security / Input Validation

**Code:**
```typescript
export async function createEarnRecord(params: CreateEarnRecordParams): Promise<EarnRecordResponse> {
 const { userId, ... } = params;
 // userId used directly in KarmaProfile.findOne and new EarnRecord({ userId })
 // No ObjectId validation at service boundary
```

**Root Cause:** No defense-in-depth. If called from a future code path without upstream validation, invalid `userId` values store as strings in ObjectId fields, breaking cross-service queries.

**Fix:**
```typescript
if (!mongoose.Types.ObjectId.isValid(userId)) {
 throw new Error('Invalid userId format in createEarnRecord');
}
```

**Status:** ACTIVE

---

### G-KS-C13 — Two Separate Logger Instances

**File:** `src/config/logger.ts` + `src/utils/logger.ts`
**Severity:** LOW
**Category:** Security / Observability

**Fix:** Consolidate to `src/utils/logger.ts`, remove `src/config/logger.ts`.

**Status:** ACTIVE

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| G-KS-C1 | CRITICAL | Hardcoded default QR secret | ACTIVE |
| G-KS-C2 | CRITICAL | Auth middleware trusts response unvalidated | ACTIVE |
| G-KS-C3 | CRITICAL | jwtSecret unvalidated at startup | ✅ FIXED |
| G-KS-C4 | CRITICAL | Horizontal privilege escalation on profile routes | ACTIVE |
| G-KS-C5 | CRITICAL | Batch stats endpoint unauthenticated | ✅ FIXED |
| G-KS-C6 | CRITICAL | TimingSafeEqual throws on length mismatch | ✅ FIXED |
| G-KS-C7 | CRITICAL | Idempotency key collision — duplicate EarnRecords | ACTIVE |
| G-KS-C8 | CRITICAL | String vs ObjectId ownership check bypass | ACTIVE |
| G-KS-C9 | CRITICAL | Karma-to-coin conversion completely broken (wrong endpoint + no auth) | ACTIVE |
| G-KS-C10 | CRITICAL | EarnRecord schema vs canonical type — completely different shapes | ACTIVE |
| G-KS-C14 | CRITICAL | No auth on getEarnRecord — any user can read any record | ACTIVE |
| G-KS-C19 | CRITICAL | Missing await on detectFraudAnomalies — unhandled promise | ACTIVE |
| G-KS-C20 | CRITICAL | requireAdmin referenced but not imported — module load crash | ACTIVE |
| G-KS-H1 | HIGH | Admin role check case-sensitive | ACTIVE |
| G-KS-H2 | HIGH | conversionHistory[].rate schema vs canonical mismatch | ACTIVE |
| G-KS-H3 | HIGH | bcrypt ^5.1.1 has known CVEs | ACTIVE |
| G-KS-H4 | HIGH | Critical business logic zero test coverage | ACTIVE |
| G-KS-H5 | HIGH | batchId unvalidated in getBatchPreview/checkBatchAnomalies | ACTIVE |
| G-KS-H6 | HIGH | getKarmaBalance uses public endpoint without auth + silent 0 | ACTIVE |
| G-KS-H7 | HIGH | trustScore never calculated or returned in profile route | ACTIVE |
| G-KS-H8 | HIGH | createdAt/updatedAt/weekOfLastKarmaEarned missing from profile response | ACTIVE |
| G-KS-C11 | MEDIUM | NoSQL injection risk in audit log query | ACTIVE |
| G-KS-C12 | MEDIUM | Rate limiting disabled when Redis unavailable | ACTIVE |
| G-KS-C15 | MEDIUM | adminId/batchId in audit log query unvalidated (extends C11) | ACTIVE |
| G-KS-C16 | MEDIUM | Kill switch reason not length-limited or sanitized | ACTIVE |
| G-KS-C17 | MEDIUM | Two loggers with inconsistent format — security events lost | ACTIVE |
| G-KS-C18 | MEDIUM | userTimezone used in decay but never defined in schema | ACTIVE |
| G-KS-M1 | MEDIUM | ILevelHistoryEntry.reason silently ignored | ACTIVE |
| G-KS-M2 | MEDIUM | IConversionHistoryEntry.batchId type mismatch | ACTIVE |
| G-KS-M3 | MEDIUM | moment deprecated + moment-timezone not declared | ACTIVE |
| G-KS-L1 | LOW | userId not validated at createEarnRecord service boundary | ACTIVE |
| G-KS-C13 | LOW | Two separate logger instances | ACTIVE |
