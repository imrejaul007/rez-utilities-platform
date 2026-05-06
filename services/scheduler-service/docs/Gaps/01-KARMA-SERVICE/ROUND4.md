# KARMA SERVICE — ROUND 4 AUDIT (Additional Findings)

**Service:** `rez-karma-service`
**Source:** Round 4 deep audit 2026-04-16
**New Issues:** 57 across config, routes, business logic, tests, middleware, cross-layer
**Deduplicated:** Overlaps with G-KS-C19, G-KS-C20, G-KS-F6, G-KS-F7, G-KS-F8 removed

> **Prior audit total: 59 issues (C1–C20, H1–H8, F1–F12, B1–B14, L1).**
> **New audit adds: 57 more. Grand total: 116 issues.**

---

## NEW CRITICAL (3 — All Cross-Layer)

### G-KS-C21 — Stub routes shadow all karma endpoints — feature completely non-functional

**File:** `src/routes/index.ts:13-15` + `src/index.ts:112-115`
**Severity:** CRITICAL
**Category:** Backend / Routes

**Root cause:** `routes/index.ts` registers `router.use('/api/karma', stub)` where the stub returns `501 Not Yet Implemented` for ALL `/api/karma/*` paths. In `index.ts`, this router is registered at `app.use('/', routes)` BEFORE `app.use('/api/karma', karmaRoutes)`. Since Express matches prefix routes in registration order, every karma API call hits the stub and returns 501.

**Impact:** Every consumer API call — getKarmaProfile, check-in, check-out, getEarnRecord — returns 501. The karma feature is completely non-functional in production.

**Fix:** Remove the `router.use('/api/karma', ...)` stub block from `routes/index.ts`, or ensure karmaRoutes is registered before the catch-all stub.

---

### G-KS-C22 — 5 consumer API calls hit unimplemented endpoints

**File:** `src/routes/index.ts` + `src/routes/karmaRoutes.ts`
**Severity:** CRITICAL
**Category:** Backend / Routes

**Consumer calls with no backend handler:**

| Consumer Call | Route Called | Status |
|---|---|---|
| `getNearbyEvents('/karma/events')` | `GET /api/karma/events` | NOT registered |
| `getEventDetail('/karma/event/${id}')` | `GET /api/karma/event/:id` | NOT registered |
| `joinEvent('/karma/event/join')` | `POST /api/karma/event/join` | NOT registered |
| `leaveEvent('/karma/event/${id}/leave')` | `DELETE /api/karma/event/:id/leave` | NOT registered |
| `getMyBooking('/karma/booking/${id}')` | `GET /api/karma/booking/:id` | NOT registered |
| `getWalletBalance('/karma/wallet/balance')` | `GET /api/karma/wallet/balance` | Stub returns 501 |
| `getTransactions('/karma/wallet/transactions')` | `GET /api/karma/wallet/transactions` | Stub returns 501 |

**Root cause:** Consumer service was written against a Phase 2 API contract that was never implemented in the backend.

**Fix:** Implement all 7 missing route handlers in `src/routes/`.

---

### G-KS-C23 — KarmaEvent type has 30+ consumer fields with zero backend coverage

**File:** `src/types/index.ts:86-105` vs `rez-app-consumer/services/karmaService.ts:43-75`
**Severity:** CRITICAL
**Category:** Cross-Layer / Type

**Root cause:** Consumer `KarmaEvent` interface defines fields like `description`, `date`, `time`, `location`, `organizer`, `baseKarmaPerHour`, `maxKarmaPerEvent`, `expectedDurationHours`, `impactUnit`, `impactMultiplier`, `capacity`, `maxVolunteers`, `confirmedVolunteers`, `verificationMode`, `gpsRadius`, `isJoined`, `qrCodes`. Backend `IKarmaEvent` only has 9 fields (`merchantEventId`, `ngoId`, `category`, `impactUnit`, `impactMultiplier`, `difficulty`, `expectedDurationHours`, `baseKarmaPerHour`, `maxKarmaPerEvent`).

**Impact:** If `getNearbyEvents` were implemented (G-KS-C22), the returned events would be missing most fields the consumer UI renders. Users see empty event cards with no description, date, location, or capacity.

**Fix:** Align backend IKarmaEvent model with consumer type. Or restrict consumer UI to fields that backend actually provides.

---

## NEW HIGH — Config & Infrastructure (2)

### G-KS-H9 — Internal service token sent but never validated before use

**File:** `src/workers/autoCheckoutWorker.ts:173-174`
**Severity:** HIGH
**Category:** Middleware/Config

**Root cause:** `INTERNAL_SERVICE_TOKEN` is read and sent as `X-Internal-Token` header, but its value is never checked for emptiness before use. If the env var is unset, the notification endpoint receives `X-Internal-Token: ` (empty string). If the notification service treats empty string as valid, any caller can spoof notifications.

**Fix:**
```typescript
const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
if (!internalToken) {
  logger.warn('[AutoCheckoutWorker] INTERNAL_SERVICE_TOKEN not set, skipping notification');
  return;
}
```

---

### G-KS-H10 — `axios ^1.7.9` may resolve to SSRF-vulnerable version

**File:** `package.json:25`
**Severity:** HIGH
**Category:** Dependencies

**Root cause:** Axios < 1.7.8 is vulnerable to credential leakage via absolute URL in proxy configs. The `^` constraint should resolve to >= 1.7.8, but npm resolution can lock to lower patch versions. `walletIntegration.ts` uses `axios.create({ baseURL })` which constructs absolute URLs.

**Fix:**
```bash
npm install axios@">=1.7.9"
npm ls axios  # verify
```
Also disable proxy for internal calls:
```typescript
const client = axios.create({ baseURL, proxy: false });
```

---

## NEW HIGH — Business Logic & Routes (9)

### G-KS-H11 — Weekly karma cap bypassed through `updateProfileStats`

**File:** `src/services/earnRecordService.ts:273`
**Severity:** HIGH
**Category:** Business Logic

**Root cause:** `createEarnRecord` calls `updateProfileStats` which directly modifies `profile.lifetimeKarma`, `profile.activeKarma`, and `profile.thisWeekKarmaEarned` without ever calling `addKarma`. The weekly cap enforcement in `addKarma` (line 140 of `karmaService.ts`) is never reached for records created via `createEarnRecord`.

**Impact:** Users can earn unlimited karma per week through the `processCheckOut` path — the weekly cap is completely bypassed.

**Fix:** Refactor `updateProfileStats` to call `addKarma` (which enforces the cap), or duplicate the cap check inside `updateProfileStats`.

---

### G-KS-H12 — Duplicate `startOfWeek` variable declaration in `addKarma`

**File:** `src/services/karmaService.ts:128, 195`
**Severity:** HIGH
**Category:** Code Quality

**Root cause:** `const startOfWeek = moment().startOf('week').toDate()` declared twice in the same function scope. Line 128 (weekly cap reset check) and line 195 (tracking update) shadow each other. The first declaration is dead code. Fragile maintenance hazard.

**Fix:** Remove the duplicate at line 195; keep only the declaration at line 128.

---

### G-KS-H13 — Inconsistent week boundary across services (ISO vs locale)

**File:** `src/services/batchService.ts:577` vs `src/services/karmaService.ts:128`
**Severity:** HIGH
**Category:** Business Logic / Timezone

**Root cause:**
- `getWeeklyCoinsUsed` (batchService): `moment(weekOf).startOf('isoWeek')` — week starts Monday 00:00 UTC
- `addKarma` (karmaService): `moment().startOf('week')` — locale-dependent (Sunday in en-US)
- `getWeekStart` (earnRecordService): custom ISO logic

**Impact:** Weekly cap enforcement uses different boundaries than coin cap tracking. A user near a week boundary could have cap enforced differently depending on code path.

**Fix:** Standardize all week calculations to `startOf('isoWeek')` everywhere, or use a shared utility.

---

### G-KS-H14 — `decayWorker` lacks job-level distributed locking

**File:** `src/workers/decayWorker.ts:27-28` vs `src/services/karmaService.ts:266-327`
**Severity:** HIGH
**Category:** Cron/Workers

**Root cause:** `runDecayJob` calls `applyDecayToAll` which acquires per-user Redis locks. But the outer orchestration has no cluster-wide lock. Two instances of the service could both call `applyDecayToAll` simultaneously — both load the full profile list and race to acquire locks, causing duplicate lock contention and potential double-decay for users processed after the lock list is rebuilt. The Redis lock TTL is 10s; a slow run could let a second run process the same user.

**Fix:** Wrap the entire `runDecayJob` in a cluster-wide distributed lock:
```typescript
const jobLock = await redis.set('decay-job-lock', token, 'NX', 'EX', 300);
if (!jobLock) { logger.info('[DecayWorker] Previous run still in progress, skipping'); return; }
```

---

### G-KS-H15 — `applyDecayToAll` loads all profiles without pagination

**File:** `src/services/karmaService.ts:259`
**Severity:** HIGH
**Category:** Performance / Business Logic

**Root cause:** `KarmaProfile.find({ activeKarma: { $gt: 0 } }).lean()` fetches ALL active profiles into memory in a single query. With a large user base, this causes OOM. The for-loop then iterates sequentially over all profiles with per-user Redis locks.

**Fix:** Use cursor-based pagination:
```typescript
const cursor = KarmaProfile.find({ activeKarma: { $gt: 0 } }).lean().batchSize(500);
for await (const profile of cursor) { /* process */ }
```

---

### G-KS-H16 — `createWeeklyBatch` has no record limit in aggregation pipeline

**File:** `src/services/batchService.ts:112`
**Severity:** HIGH
**Category:** Batch Processing

**Root cause:** The `$match` aggregation uses `$group` over potentially all `APPROVED_PENDING_CONVERSION` records with no `$limit`. If thousands of records exist, the pipeline holds them all in memory. If pools already have READY batches from a previous run, duplicates could be created.

**Fix:** Add `$limit: 50000` as safety ceiling. Check for existing non-executed batches for the same week before creating new ones.

---

### G-KS-H17 — Batch execution is fully sequential, unbounded for-loop

**File:** `src/services/batchService.ts:421`
**Severity:** HIGH
**Category:** Batch Processing

**Root cause:** The for-loop iterates over all pending records sequentially. For a batch with 10,000 records at ~200ms per record, total execution time is ~33 minutes. If the job times out or the process crashes mid-way, the batch is left in an inconsistent PARTIAL state with no retry mechanism.

**Fix:** Process records in chunks of 100 using `Promise.all` with error isolation per record. Add `maxConcurrency: 5` for wallet credits. Implement retry logic for failed records.

---

### G-KS-H18 — `convertKarmaToCoins` doesn't guard against NaN/Infinity

**File:** `src/engines/karmaEngine.ts:132-141`
**Severity:** HIGH
**Category:** Business Logic

**Root cause:** Check is `karma < 0` but `NaN`, `Infinity`, and `-Infinity` all pass this check (since `NaN < 0` is `false`). If a caller passes `Math.sqrt(-1)` or `1/0`, `convertKarmaToCoins` returns `NaN` or `Infinity`. `Math.floor(Infinity * rate)` returns `Infinity`. Coin credits of `Infinity` would corrupt the wallet.

**Fix:**
```typescript
if (typeof karma !== 'number' || !Number.isFinite(karma)) {
  throw new Error('Invalid karma value');
}
```

---

### G-KS-H19 — `getKarmaHistory` crashes on null `batchId`

**File:** `src/services/karmaService.ts:447`
**Severity:** HIGH
**Category:** Null/Undefined

**Root cause:** `entry.batchId.toString()` called on potentially null field. If `batchId` is `undefined` (corrupted data or older migration), throws `TypeError: Cannot read property 'toString' of undefined`. `GET /api/karma/user/:userId/history` throws 500.

**Fix:**
```typescript
const batchId = entry.batchId ? String(entry.batchId) : undefined;
```

---

## NEW HIGH — Cross-Layer Contracts (3)

### G-KS-H20 — History endpoint returns conversion data, not earn records

**File:** `src/routes/karmaRoutes.ts:108` + `src/services/karmaService.ts:438-449`
**Severity:** HIGH
**Category:** Cross-Layer

**Root cause:** Backend returns `{ history: Array<{ karmaConverted, coinsEarned, rate, batchId, convertedAt }> }` (conversion history). Consumer expects `{ records: EarnRecord[], total: number, page: number, pages: number }` (earn history). The shapes are completely different.

**Fix:** Either change backend to return earn records from `getUserEarnRecords`, or rename the response to `{ conversionHistory: ... }` and have consumer map appropriately.

---

### G-KS-H21 — EarnRecord missing `eventName` in backend response

**File:** `src/services/earnRecordService.ts:28-47` (EarnRecordResponse)
**Severity:** HIGH
**Category:** Cross-Layer

**Root cause:** `EarnRecordResponse` type has `eventId` but no `eventName`. The MongoDB EarnRecord model also lacks an `eventName` field. Consumer type has `eventName?: string` and UI uses `record.eventName ?? 'Event'`.

**Fix:** Populate `eventName` by joining with the KarmaEvent collection when returning earn records, or have consumer fetch event names separately.

---

### G-KS-H22 — `nextLevelAt` is nullable on backend but not on consumer type

**File:** `src/types/index.ts:179` vs `rez-app-consumer/services/karmaService.ts:23`
**Severity:** HIGH
**Category:** Cross-Layer

**Root cause:** Backend returns `nextLevelAt: number | null` (null for L4). Consumer type declares `nextLevelAt: number` (NOT nullable). UI uses `levelCfg.next?.toLocaleString()` which masks the runtime issue, but the type contract is wrong.

**Fix:** Change consumer `KarmaProfile.nextLevelAt` to `number | null`.

---

## NEW HIGH — Verification & Security (3)

### G-KS-H23 — QR codes generated but never persisted, expire in 5 minutes

**File:** `src/engines/verificationEngine.ts:577-614`
**Severity:** HIGH
**Category:** Security

**Root cause:** `generateEventQRCodes` creates QR codes with `ts: Date.now()`. The 5-minute expiry in `validateQRCode` (line 171) means codes expire before NGOs can print and distribute them. QR codes are never saved to the KarmaEvent model, never delivered to NGOs, and no regeneration schedule exists.

**Impact:** Phase 3 QR verification feature is non-functional. NGOs cannot use QR codes.

**Fix:** Save generated QR codes to the KarmaEvent model. Remove or extend the 5-minute expiry. Add `POST /api/karma/events/:eventId/regenerate-qr` admin endpoint.

---

### G-KS-H24 — `karmaEarned` read from untrusted cross-service booking field

**File:** `src/engines/verificationEngine.ts:452`
**Severity:** HIGH
**Category:** Security

**Root cause:** `karmaEarned: (raw.karmaEarned as number) ?? 0` reads `karmaEarned` directly from the EventBooking document (a cross-service model owned by the merchant service). No validation that this value is positive, non-zero, or within the `maxKarmaPerEvent` cap.

**Impact:** A malicious merchant could set `karmaEarned: 999999` on a booking and the karma system awards it without independent validation.

**Fix:** Calculate `karmaEarned` inside the karma service using `calculateKarmaEarned(event, hours)` with the KarmaEvent fetched from the local model.

---

### G-KS-H25 — Checkout GPS score uses check-in coordinates as fallback

**File:** `src/engines/verificationEngine.ts:391-401`
**Severity:** HIGH
**Category:** Business Logic

**Root cause:** When `gpsCoords` is undefined at checkout, `checkGPSProximity` compares the check-in GPS against itself — `gps_match = 1.0`. A user who forgot to check out with GPS gets a perfect GPS score added to their confidence. Combined with QR signals, this can push a genuinely unverified checkout over the 0.60 threshold.

**Fix:** When `gpsCoords` is undefined at checkout, set `gps_match = 0`. Only compute GPS match when both check-in and check-out coordinates are available.

---

## NEW MEDIUM — Config & Middleware (4)

### G-KS-M17 — Helmet uses defaults — CSP, referrerPolicy, cross-origin headers disabled

**File:** `src/index.ts:33`
**Severity:** MEDIUM

**Root cause:** `app.use(helmet())` uses all defaults. In Helmet 8.x, `contentSecurityPolicy`, `crossOriginEmbedderPolicy`, `crossOriginResourcePolicy`, and `referrerPolicy` are disabled unless explicitly enabled.

**Fix:** Configure all critical directives:
```typescript
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], objectSrc: ["'none'"] }},
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

---

### G-KS-M18 — No X-Request-ID / correlation ID for distributed tracing

**File:** `src/index.ts:24-29`
**Severity:** MEDIUM

**Root cause:** W3C traceparent propagation extracts the incoming trace but does not generate a unique request ID for new requests, and does not attach a correlation ID to outbound service calls. Without request IDs, tracing a single user request across multiple services is impossible in log aggregators.

**Fix:**
```typescript
app.use((req, res, next) => {
  req.headers['x-request-id'] = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});
```

---

### G-KS-M19 — Auth service error response body not logged for non-401 failures

**File:** `src/middleware/auth.ts:51-60`
**Severity:** MEDIUM

**Root cause:** When auth service returns a non-401 error (e.g., 500 with error details), the axios error object is silently dropped. No structured logging of auth service failures. A 503 from auth service is indistinguishable from a network timeout.

**Fix:**
```typescript
logger.warn('[Auth] Auth service error', {
  status: axiosErr.response?.status,
  data: axiosErr.response?.data,
  message: axiosErr.message,
});
```

---

### G-KS-M20 — Health check exposes MongoDB connection error details

**File:** `src/index.ts:73-75`
**Severity:** MEDIUM

**Root cause:** MongoDB ping failure message is returned in the `/health/ready` response body: `checks.mongodb = 'error: ${err.message}'`. Mongoose error messages include hostnames, port numbers, and potentially credential fragments.

**Fix:**
```typescript
logger.error('[Health] MongoDB ping failed', { error: err instanceof Error ? err.message : String(err) });
checks.mongodb = 'error: connection failed';
```

---

## NEW MEDIUM — Routes & Batch Processing (6)

### G-KS-M21 — No per-admin rate limit on batch execute endpoint

**File:** `src/routes/batchRoutes.ts:147`
**Severity:** MEDIUM

**Root cause:** Only the global IP-based rate limiter applies to all routes. A compromised admin account could trigger unlimited batch executions at the global rate limit.

**Fix:** Add targeted rate limit for the execute endpoint:
```typescript
const batchExecuteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Batch execution rate limit exceeded' },
});
router.post('/:id/execute', batchExecuteLimiter, requireAdminAuth, async ...
```

---

### G-KS-M22 — Batch scheduler has no distributed lock

**File:** `src/workers/batchScheduler.ts:61-80`
**Severity:** MEDIUM

**Root cause:** Two concurrent scheduler instances (e.g., two pods) could both fire `createWeeklyBatch()` simultaneously, creating duplicate batches for the same CSR pool with the same records.

**Fix:** Acquire Redis distributed lock before batch creation:
```typescript
const lockKey = 'batch-scheduler-lock';
const lockToken = randomUUID();
const lockAcquired = await redis.set(lockKey, lockToken, 'NX', 'EX', 3600);
if (!lockAcquired) { log.info('[BatchScheduler] Previous run still in progress'); return; }
```

---

### G-KS-M23 — `startDate`/`endDate` not validated as dates in audit log query

**File:** `src/routes/batchRoutes.ts:275-276`
**Severity:** MEDIUM

**Root cause:** Query params passed directly to `new Date()`. While modern Node.js returns `Invalid Date` for injection attempts, the coercion is fragile.

**Fix:**
```typescript
function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}
```

---

### G-KS-M24 — Batch execution has no idempotency key — retried requests cause double-execution

**File:** `src/routes/batchRoutes.ts:147-182`
**Severity:** MEDIUM

**Root cause:** `executeBatch` creates idempotency keys for individual records inside the batch, but the batch-level execution has no idempotency key. An admin hitting "Execute" twice (timeout, retry) while the first execution is mid-flight starts a second execution loop. Records processed by the first run (but not yet marked CONVERTED) get re-processed.

**Fix:** Add batch-level idempotency key from request header:
```typescript
const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;
if (idempotencyKey) {
  const cached = await redis.get(`batch-execute:${idempotencyKey}`);
  if (cached) { res.status(409).json({ success: false, message: 'Execution already in progress' }); return; }
  await redis.set(`batch-execute:${idempotencyKey}`, req.userId, 'EX', 300);
}
```

---

### G-KS-M25 — Audit log route missing `status` parameter validation

**File:** `src/routes/batchRoutes.ts:33`
**Severity:** MEDIUM

**Root cause:** `status` query parameter is passed directly to MongoDB query. Mongoose ignores unknown enum values silently (returns 0 results), so risk is low but the pattern is fragile.

**Fix:**
```typescript
import type { BatchStatus } from '../types/index.js';
const validStatuses: BatchStatus[] = ['DRAFT', 'READY', 'EXECUTED', 'PARTIAL', 'PAUSED'];
const status = _req.query.status as string | undefined;
if (status && validStatuses.includes(status as BatchStatus)) { filter.status = status; }
```

---

### G-KS-M26 — `pauseAllPendingBatches` sets status to `DRAFT` instead of `PAUSED`

**File:** `src/services/batchService.ts:687-705`
**Severity:** MEDIUM

**Root cause:** The kill switch sets `status: 'DRAFT'` instead of `status: 'PAUSED'`. The `pauseReason` and `pausedAt` metadata suggest `PAUSED` is the intended state, but the status field is wrong.

**Fix:** Change `status: 'DRAFT'` to `status: 'PAUSED'` at line 692.

---

## NEW MEDIUM — Business Logic & Data Integrity (6)

### G-KS-M27 — Missing event GPS defaults to (0, 0) instead of error

**File:** `src/engines/verificationEngine.ts:309-314`
**Severity:** MEDIUM

**Root cause:** `(booking as Record<string, unknown>).eventLatitude as number ?? 0` — the nullish coalescing default of `0` is a valid latitude (on the equator). If an event has no stored coordinates, `checkGPSProximity` computes distance from lat=0, lng=0 instead of returning 0 or throwing. A Bangalore user checking in at an event with no coordinates gets a near-zero GPS match score.

**Fix:** Check for undefined coordinates and return 0 (no GPS signal) instead of defaulting to (0, 0).

---

### G-KS-M28 — `calculateConsistencyScore` wraps incorrectly around year boundaries

**File:** `src/engines/karmaEngine.ts:323`
**Severity:** MEDIUM

**Root cause:** `activityHistory.map((d) => moment(d).dayOfYear())` — for Dec 31 (day 365) and Jan 1 (day 1), the gap is computed as 364 days instead of 1 day, skewing the consistency score downward.

**Fix:** Use epoch days: `moment(d).unix() / 86400` to compute gaps in absolute days.

---

### G-KS-M29 — Weekly cap not enforced at earn record creation time

**File:** `src/services/earnRecordService.ts:69-141`
**Severity:** MEDIUM

**Root cause:** `createEarnRecord` creates EarnRecords with `APPROVED_PENDING_CONVERSION` without checking weekly coin cap. The cap is only enforced at batch execution time. If cap is exhausted, the EarnRecord is still created with a pre-computed `rezCoinsEarned`. Users see pending earn records that ultimately convert to 0 coins with no notification.

**Fix:** Validate weekly cap at earn record creation. If exhausted, create record with `capExceededAtCreation: true` and `rezCoinsEarned: 0`. Notify user at earn time.

---

### G-KS-M30 — No Redis cache on profile lookups — every request hits MongoDB

**File:** `src/services/karmaService.ts:50-62`
**Severity:** MEDIUM

**Root cause:** `getKarmaProfile` and `getOrCreateProfile` make direct MongoDB queries with no caching layer. `getLevelInfo` calls `getOrCreateProfile` on every request.

**Fix:** Add Redis cache with 60-second TTL:
```typescript
const cached = await redis.get(`karma:profile:${userId}`);
if (cached) return JSON.parse(cached);
// ... after DB query:
await redis.set(`karma:profile:${userId}`, JSON.stringify(profile), 'EX', 60);
```

---

### G-KS-M31 — `getConversionRate` rate upper bound is 2 instead of 1

**File:** `src/engines/karmaEngine.ts:115-119`
**Severity:** MEDIUM

**Root cause:** Validation checks `rate < 0 || rate > 2` but conversion rates should never exceed 1.0. The `rate > 2` check is unreachable for current inputs. Could be tightened.

**Fix:** Change upper bound to 1.0: `if (rate < 0 || rate > 1)`.

---

### G-KS-M32 — `userTimezone` field missing from schema, decay always UTC

**File:** `src/workers/decayWorker.ts:33` + `src/services/karmaService.ts:289`
**Severity:** MEDIUM

**Root cause:** The cron runs in UTC (`timeZone: 'UTC'`). Inside `applyDecayToAll`, `userTimezone` is read from `profile.userTimezone` but it is not defined in the KarmaProfile schema. Decay always uses UTC. A Bangalore user inactive for 29 days 23 hours UTC (30 days IST) would NOT trigger decay.

**Fix:** Add `userTimezone?: string` to KarmaProfile schema. Store timezone on first check-in from GPS coordinates. Use it in decay calculations.

---

## NEW MEDIUM — Database Indexes (4)

### G-KS-M33 — Missing `{ eventId, qrCheckedInAt }` compound index for fraud detection

**File:** `src/engines/verificationEngine.ts:546-561`
**Severity:** MEDIUM

**Root cause:** `detectFraudAnomalies` queries `EventBooking` on `{ eventId, qrCheckedInAt: { $gte, $lte } }`. Existing index at line 23 is `{ eventId: 1, status: 1 }` — different field combination. Full collection scan on eventbookings table.

**Fix:**
```typescript
EventBookingSchema.index({ eventId: 1, qrCheckedInAt: 1 });
```

---

### G-KS-M34 — Auto-checkout worker may use different EventBooking model instance

**File:** `src/workers/autoCheckoutWorker.ts:31,73-76`
**Severity:** MEDIUM

**Root cause:** `autoCheckoutWorker.ts` defines its own `EventBookingSchema` with indexes. `verificationEngine.ts` defines a separate schema with different indexes. Mongoose deduplicates by name, but which registration wins depends on import order. One set of indexes may not be applied.

**Fix:** Extract `EventBookingModel` into `src/models/EventBooking.ts` and import in both places.

---

### G-KS-M35 — Missing `{ userId, qrCheckedInAt }` compound index for GPS fraud query

**File:** `src/engines/verificationEngine.ts:508-513`
**Severity:** MEDIUM

**Root cause:** GPS fraud query uses `{ userId, qrCheckedInAt: { $gte } }` — existing index `{ userId: 1, eventId: 1 }` partially helps but a compound index on `{ userId: 1, qrCheckedInAt: -1 }` would be more selective.

**Fix:**
```typescript
EventBookingSchema.index({ userId: 1, qrCheckedInAt: -1 });
```

---

### G-KS-M36 — Missing `{ status, approvedAt }` compound index for pending conversion

**File:** `src/services/earnRecordService.ts:256-262`
**Severity:** MEDIUM

**Root cause:** `getPendingConversionRecords` queries `{ status: 'APPROVED_PENDING_CONVERSION' }` with sort on `approvedAt`. Existing indexes are `{ status: 1 }` and `{ createdAt: 1 }`. For millions of records, this does a full index scan on status followed by in-memory sort on approvedAt.

**Fix:**
```typescript
EarnRecordSchema.index({ status: 1, approvedAt: 1 });
```

---

## NEW MEDIUM — Tests (4)

### G-KS-M37 — `verifyRoutes.test.ts` re-implements handlers, doesn't test real code

**File:** `src/__tests__/verifyRoutes.test.ts:89-213`
**Severity:** MEDIUM

**Root cause:** Test creates its own inline Express handlers that duplicate real route logic. The actual `verifyRoutes.ts` is never imported. Changes to the real routes would not break any test.

**Fix:** Import and mount actual `verifyRoutes.ts` in tests. Mock underlying services (`processCheckIn`, `processCheckOut`, `detectFraudAnomalies`) instead of mocking Mongoose models.

---

### G-KS-M38 — `karmaRoutes.test.ts` mocks auth instead of exercising real middleware

**File:** `__tests__/karmaRoutes.test.ts:39`
**Severity:** MEDIUM

**Root cause:** Test mocks `requireAuth` directly, setting `userId` and `userRole`. The actual `auth.ts` middleware makes an HTTP call to the auth service — never exercised in tests.

**Fix:** Use a test JWT signed with the real `JWT_SECRET`, or create an integration test suite with a mock auth service.

---

### G-KS-M39 — `smoke.test.ts` tests `/metrics` endpoint that doesn't exist

**File:** `__tests__/smoke.test.ts:38-45`
**Severity:** MEDIUM

**Root cause:** Test expects a `/metrics` endpoint but no such route is registered. Test always fails with 404.

**Fix:** Either implement `/metrics` endpoint (using `process.uptime()` and `process.memoryUsage()`) or remove this test case.

---

### G-KS-M40 — `addKarma` weekly cap has zero test coverage

**File:** `src/services/karmaService.ts:110-213`
**Severity:** MEDIUM

**Root cause:** `addKarma` contains the weekly cap check at line 140, but no test exercises it. G-KS-H11 (cap bypass through `updateProfileStats`) would not be caught by existing tests since neither code path is covered.

**Fix:** Add unit tests for `addKarma`: normal karma addition, cap enforcement at exactly 300, cap reset on new week, and cap bypass attempt detection.

---

## NEW MEDIUM — Cross-Layer Contracts (4)

### G-KS-M41 — Consumer sends `page` for history but backend ignores it

**File:** `src/routes/karmaRoutes.ts:103` + `rez-app-consumer/services/karmaService.ts:263-264`
**Severity:** MEDIUM

**Root cause:** Consumer sends `{ page: 1 }` to history endpoint. Backend reads `req.query.limit` and ignores `page` entirely, returning all records up to limit with no pagination metadata.

**Fix:** Implement proper pagination in `getKarmaHistory` using `skip/limit`. Return `{ records, total, page, pages }` wrapper.

---

### G-KS-M42 — Error response shapes inconsistent across routes

**File:** Multiple route files
**Severity:** MEDIUM

| Route | Error Shape |
|---|---|
| `karmaRoutes.ts:35, 41, 100, 128` | `{ error: '...' }` |
| `verifyRoutes.ts:99, 106, 111, 134, 146` | `{ success: false, message: '...' }` |
| `batchRoutes.ts:72, 119, 180` | `{ success: false, message: '...' }` |
| Global error handler `index.ts:122` | `{ success: false, message }` |

**Fix:** Standardize all karma service error responses to `{ success: false, message: string, code?: string }`.

---

### G-KS-M43 — HTTP 207 Multi-Status unhandled by apiClient

**File:** `src/routes/batchRoutes.ts:171`
**Severity:** MEDIUM

**Root cause:** Batch execution returns `res.status(result.success ? 200 : 207)` for partial success. The `apiClient` only treats 2xx as success — 207 is treated as an error.

**Fix:** Either return 200 with `{ partial: true, ... }` in the body, or handle 207 specifically in apiClient.

---

### G-KS-M44 — Verify routes return `status` but consumer expects `verificationStatus`

**File:** `src/routes/verifyRoutes.ts:130, 177` vs `rez-app-consumer/services/karmaService.ts:99`
**Severity:** MEDIUM

**Root cause:** Backend returns `status: result.status` (ApprovalStatus). Consumer `Booking` type has `verificationStatus: 'pending' | 'partial' | 'verified' | 'rejected'` — different field name and includes `'pending'` which the backend never returns for check-in.

**Fix:** Rename backend response field from `status` to `verificationStatus`. Align allowed values with consumer type.

---

## NEW LOW (8)

### G-KS-L2 — `INTERNAL_SERVICE_TOKEN` and `NOTIFICATION_SERVICE_URL` not validated at startup

**File:** `src/index.ts:130-136`
**Severity:** LOW

**Root cause:** `NOTIFICATION_SERVICE_URL` and `INTERNAL_SERVICE_TOKEN` are used in production but not in the startup validation list. If missing, notification path silently degrades.

**Fix:** Add to recommended (warn-only) env var list:
```typescript
const recommended = ['INTERNAL_SERVICE_TOKEN'];
recommended.forEach((k) => {
  if (!process.env[k]) logger.warn(`[CONFIG] Recommended env var ${k} is not set`);
});
```

---

### G-KS-L3 — Cron workers not explicitly stopped during graceful shutdown

**File:** `src/index.ts:144-169`
**Severity:** LOW

**Root cause:** `stopDecayWorker()`, `stopBatchScheduler()`, and `stopAutoCheckoutWorker()` are not called during graceful shutdown. An in-progress `createWeeklyBatch()` could be interrupted mid-operation, leaving batches in an incomplete state.

**Fix:**
```typescript
stopDecayWorker();
stopBatchScheduler();
stopAutoCheckoutWorker();
// Then close server and DB connections
```

---

### G-KS-L4 — Batch execution lacks pre-start audit log entry

**File:** `src/services/batchService.ts:356-542`
**Severity:** LOW

**Root cause:** `executeBatch` logs after completion. If the process crashes mid-execution, there is no record that the execution was attempted. The audit log write (line 513) happens after the status update, so a crash between status update and audit log leaves an executed batch with no audit trail.

**Fix:** Log before execution begins:
```typescript
log.info('executeBatch: starting', { batchId, adminId, recordCount: records.length });
```

---

### G-KS-L5 — Redis cache key schema lacks namespace prefix

**File:** `src/services/karmaService.ts:266` — `decay-lock:${userId}`
**Severity:** LOW

**Root cause:** Redis keys use ad-hoc prefixes. If other services use the same Redis instance, key collisions are possible. No `karma:` namespace.

**Fix:** Define `KARMA_REDIS_PREFIX = 'karma:'` and use `karma:decay-lock:{userId}` for all karma Redis keys.

---

### G-KS-L6 — `getOrCreateProfile` doesn't validate userId format

**File:** `src/services/karmaService.ts:67-94`
**Severity:** LOW

**Root cause:** `getOrCreateProfile` creates a profile even for invalid userIds (doesn't validate ObjectId format). Garbage profiles can be created for arbitrary strings.

**Fix:** Add ObjectId validation to `getOrCreateProfile`.

---

### G-KS-L7 — `rezCoinsEarned` pre-computed and stale in API responses

**File:** `src/services/earnRecordService.ts:121`
**Severity:** LOW

**Root cause:** `rezCoinsEarned: Math.floor(karmaEarned * conversionRate)` computed at EarnRecord creation. If weekly cap reduces the amount at batch execution, the API response still shows the pre-cap amount.

**Fix:** Set `rezCoinsEarned` to `null` or `0` at creation. Only populate after batch execution.

---

### G-KS-L8 — Conversion rate computed from `profile.level` instead of stored snapshot

**File:** `src/routes/karmaRoutes.ts:65-72`
**Severity:** LOW

**Root cause:** Response computes conversion rate from `profile.level`, but EarnRecords store `conversionRateSnapshot` at approval time. A user's level could change between earning karma and viewing the profile.

**Fix:** Return `null` for historical rates. Label current level rate as "current level rate."

---

### G-KS-L9 — Admin panel karma routes have no admin UI

**File:** `src/routes/batchRoutes.ts`
**Severity:** LOW

**Root cause:** Karma service has full admin routes (batch management, decay trigger, audit logs), but `rez-app-admin` has zero karma-related files. Admin operations must be done via raw API calls.

**Fix:** No code fix needed — admin panel is separate work. Document as a known gap.

---

## Status Summary

| ID | Severity | Title |
|----|----------|-------|
| G-KS-C21 | CRITICAL | Stub routes shadow all karma endpoints — feature non-functional |
| G-KS-C22 | CRITICAL | 5 consumer API calls hit unimplemented endpoints |
| G-KS-C23 | CRITICAL | KarmaEvent type has 30+ consumer fields with zero backend coverage |
| G-KS-H9 | HIGH | Internal service token sent but never validated |
| G-KS-H10 | HIGH | axios ^1.7.9 may resolve to SSRF-vulnerable version |
| G-KS-H11 | HIGH | Weekly karma cap bypassed through updateProfileStats |
| G-KS-H12 | HIGH | Duplicate startOfWeek variable in addKarma |
| G-KS-H13 | HIGH | Inconsistent week boundary across services (ISO vs locale) |
| G-KS-H14 | HIGH | decayWorker lacks job-level distributed locking |
| G-KS-H15 | HIGH | applyDecayToAll loads all profiles without pagination |
| G-KS-H16 | HIGH | createWeeklyBatch has no record limit in aggregation |
| G-KS-H17 | HIGH | Batch execution is fully sequential, unbounded |
| G-KS-H18 | HIGH | convertKarmaToCoins doesn't guard against NaN/Infinity |
| G-KS-H19 | HIGH | getKarmaHistory crashes on null batchId |
| G-KS-H20 | HIGH | History endpoint returns conversion data, not earn records |
| G-KS-H21 | HIGH | EarnRecord missing eventName in backend response |
| G-KS-H22 | HIGH | nextLevelAt nullable on backend but not on consumer |
| G-KS-H23 | HIGH | QR codes generated but never persisted, expire in 5 min |
| G-KS-H24 | HIGH | karmaEarned read from untrusted cross-service booking field |
| G-KS-H25 | HIGH | Checkout GPS score uses check-in coordinates as fallback |
| G-KS-M17 | MEDIUM | Helmet uses defaults — CSP, referrerPolicy disabled |
| G-KS-M18 | MEDIUM | No X-Request-ID for distributed tracing |
| G-KS-M19 | MEDIUM | Auth service error response body not logged |
| G-KS-M20 | MEDIUM | Health check exposes MongoDB error details |
| G-KS-M21 | MEDIUM | No per-admin rate limit on batch execute |
| G-KS-M22 | MEDIUM | Batch scheduler lacks distributed lock |
| G-KS-M23 | MEDIUM | startDate/endDate not validated as dates |
| G-KS-M24 | MEDIUM | Batch execution has no idempotency key |
| G-KS-M25 | MEDIUM | Audit log status param not validated |
| G-KS-M26 | MEDIUM | pauseAllPendingBatches sets DRAFT not PAUSED |
| G-KS-M27 | MEDIUM | Missing event GPS defaults to (0,0) |
| G-KS-M28 | MEDIUM | calculateConsistencyScore year-boundary wrap |
| G-KS-M29 | MEDIUM | Weekly cap not enforced at earn record creation |
| G-KS-M30 | MEDIUM | No Redis cache on profile lookups |
| G-KS-M31 | MEDIUM | getConversionRate rate upper bound is 2 not 1 |
| G-KS-M32 | MEDIUM | userTimezone missing from schema, decay always UTC |
| G-KS-M33 | MEDIUM | Missing {eventId, qrCheckedInAt} index for fraud detection |
| G-KS-M34 | MEDIUM | Auto-checkout may use different EventBooking model |
| G-KS-M35 | MEDIUM | Missing {userId, qrCheckedInAt} index for GPS fraud |
| G-KS-M36 | MEDIUM | Missing {status, approvedAt} index for conversion |
| G-KS-M37 | MEDIUM | verifyRoutes tests re-implement handlers |
| G-KS-M38 | MEDIUM | karmaRoutes tests mock auth instead of real middleware |
| G-KS-M39 | MEDIUM | smoke.test.ts tests non-existent /metrics endpoint |
| G-KS-M40 | MEDIUM | addKarma weekly cap has zero test coverage |
| G-KS-M41 | MEDIUM | Consumer sends page, backend ignores it |
| G-KS-M42 | MEDIUM | Error response shapes inconsistent |
| G-KS-M43 | MEDIUM | HTTP 207 Multi-Status unhandled by apiClient |
| G-KS-M44 | MEDIUM | Verify routes return status vs consumer expects verificationStatus |
| G-KS-L2 | LOW | INTERNAL_SERVICE_TOKEN not validated at startup |
| G-KS-L3 | LOW | Cron workers not stopped during graceful shutdown |
| G-KS-L4 | LOW | Batch execution lacks pre-start audit log |
| G-KS-L5 | LOW | Redis cache key schema lacks namespace |
| G-KS-L6 | LOW | getOrCreateProfile doesn't validate userId |
| G-KS-L7 | LOW | rezCoinsEarned pre-computed and stale |
| G-KS-L8 | LOW | Conversion rate from level not snapshot |
| G-KS-L9 | LOW | Admin panel karma routes have no admin UI |

**Grand total: 116 issues** (59 existing + 57 new)
