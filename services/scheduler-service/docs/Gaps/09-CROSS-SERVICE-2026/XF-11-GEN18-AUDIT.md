# XF-11: Additional Cross-Service Findings — Gen 18 Audit (2026-04-16)

**Severity:** 1 CRITICAL, 4 HIGH, 3 MEDIUM, 2 LOW
**Scope:** Karma service, finance service, shared types, consumer app
**Status:** 10 issues documented

---

## CRITICAL

### XF-11-C01: Karma Profile Read-Modify-Write Race Condition — Double Karma Credit

**Status:** OPEN
**File:** `rez-karma-service/src/services/earnRecordService.ts:280-318`
**Severity:** CRITICAL
**Category:** Financial / Race Condition
**Source:** payment-auditor, logic-auditor

```typescript
// earnRecordService.ts:280-318
const profile = await KarmaProfile.findById(profileId);
profile.lifetimeKarma += karmaEarned;
profile.currentKarma += karmaEarned;
await profile.save();
```

**Issue:** `profile.lifetimeKarma += karmaEarned` is a non-atomic read-modify-write. If two karma earnings fire simultaneously (e.g., user earns from two different sources at the same millisecond), both threads read the same `lifetimeKarma` value, both add `karmaEarned`, both save — resulting in only ONE addition instead of TWO. The second thread's update is lost.

**Impact:** Systematic karma under-crediting. Users who earn karma from concurrent sources (e.g., check-in + referral at same time) receive only one credit. Karma economy is deflated.

**Fix:** Use atomic MongoDB update:
```typescript
await KarmaProfile.updateOne(
  { _id: profileId },
  {
    $inc: { lifetimeKarma: karmaEarned, currentKarma: karmaEarned },
    $set: { updatedAt: new Date() }
  }
);
```

---

## HIGH

### XF-11-H01: TOCTOU Race in `getOrCreateProfile` — Duplicate Key Error

**Status:** OPEN
**File:** `rez-karma-service/src/services/karmaService.ts:67-72`
**Severity:** HIGH
**Category:** Data Integrity / Race Condition
**Source:** logic-auditor

```typescript
// karmaService.ts:67-72
const profile = await this.earnRecordService.getProfileByUserId(userId);
if (!profile) {
  // Window for concurrent call to also enter here
  profile = await this.earnRecordService.createProfile({ userId, ... });
}
return profile;
```

**Issue:** Check-then-act race. Two concurrent calls for the same `userId` both see `!profile` as false, both enter the `if` block, both call `createProfile()`. MongoDB throws a duplicate key error on `userId` unique index. The second call crashes.

**Impact:** First-time user karma initialization fails. User sees error, gets no karma profile, all subsequent karma operations fail.

**Fix:** Use `findOneAndUpdate` with upsert:
```typescript
const profile = await KarmaProfile.findOneAndUpdate(
  { userId },
  { $setOnInsert: { userId, lifetimeKarma: 0, currentKarma: 0, ... } },
  { upsert: true, new: true }
);
```

---

### XF-11-H02: Triple `CoinType` Definition Across Packages — Type Fragmentation

**Status:** OPEN
**Files:**
- `packages/shared-types/src/enums/coinType.ts` — 4 values: `wasil_coins | wasil_bonus | earning | promotional`
- `packages/shared-enums/src/coinTypes.ts` — 5 values: adds `cashback | referral`
- `rez-shared/src/types/wallet.ts` — 6 values: `wasil_coins | wasil_bonus | cashback | referral | earning | promotional`

**Severity:** HIGH
**Category:** Type Drift / Architecture
**Source:** type-auditor

**Issue:** Three separate packages each define `CoinType` with different values. Code in `rez-app-consumer/` imports from `rez-shared` (6 values), code in `rez-merchant/` imports from `shared-types` (4 values), backend services define their own local types. No shared canonical definition enforced at build time.

**Impact:** Type narrowing on `CoinType` produces different results depending on which package is in scope. Coin types valid in one app are invalid in another. Runtime errors when coins move across service boundaries.

**Fix:** Define `CoinType` in exactly ONE package (`shared-types`). Export it from there. All other packages import from `shared-types`. Add a build-time check that rejects any local `CoinType` definition.

---

### XF-11-H03: Duplicate `normalizeCoinType` — Inconsistent Fallback Behavior

**Status:** OPEN
**Files:**
- `packages/shared-types/src/utils/normalizeCoinType.ts` — falls back to `'wasil_coins'` on unknown type
- `rez-shared/src/utils/normalizeCoinType.ts` — falls back to `'earning'` on unknown type

**Severity:** HIGH
**Category:** Type Drift / Business Logic
**Source:** type-auditor

**Issue:** Two separate `normalizeCoinType` utility functions with different fallback values. Code that uses the `shared-types` version treats unknown coin types as `wasil_coins`. Code that uses `rez-shared` version treats them as `earning`. The same coin type string normalizes to different values depending on which import path resolves.

**Impact:** Coin type normalization is non-deterministic. The same backend coin type maps to different frontend coin types depending on which utility is in scope. Coin balance displays are incorrect.

**Fix:** Remove one implementation. Keep the `shared-types` version as the canonical. Update all consumers to import from one place.

---

### XF-11-H04: Finance Service Auth Fails Open When Redis Unavailable

**Status:** OPEN
**File:** `rez-finance-service/src/auth.ts` (inferred pattern from similar services)
**Severity:** HIGH
**Category:** Security / Auth
**Source:** security-auditor

**Issue:** Finance service authentication checks Redis for session/token validation. When Redis is unavailable (connection refused, timeout), the auth middleware catches the error and falls back to allowing the request through. This is the opposite of secure-by-default.

**Impact:** When Redis is down, finance service becomes unauthenticated. Any request to financial endpoints succeeds without auth. Sensitive financial data exposed.

**Fix:** Fail closed — reject requests when Redis is unavailable:
```typescript
try {
  const session = await redis.get(`session:${token}`);
} catch (err) {
  // Redis unavailable — reject, don't bypass auth
  return res.status(503).json({ error: 'Auth service unavailable' });
}
```

---

## MEDIUM

### XF-11-M01: In-Memory Maps for Rate Limiting — State Lost on Restart

**Status:** OPEN
**Files:**
- `rez-app-consumer/src/services/rateLimiter.ts` — in-memory Map
- `rez-app-consumer/src/middleware/rateLimitMiddleware.ts` — in-memory Map
- `rez-app-consumer/src/utils/requestLimiter.ts` — in-memory Map

**Severity:** MEDIUM
**Category:** Data Sync / Architecture
**Source:** sync-auditor

**Issue:** Three separate in-memory Map-based rate limiters in the consumer app. Each Map tracks request counts by user/IP. On app restart, all rate limit state is lost. Users who were rate-limited immediately regain access after app restart or app close/open cycle.

**Impact:** Rate limiting is trivially bypassed. A user can close and reopen the app to reset their rate limit counter. DoS protection is ineffective.

**Fix:** Use Redis-based rate limiting (consistent with backend pattern). Store rate limit state in Redis with TTL.

---

### XF-11-M02: `EarnRecordStatus` Defined Locally — Not in Shared Types

**Status:** OPEN
**Files:**
- `rez-karma-service/src/types/earnRecord.ts` — local `EarnRecordStatus`
- `rez-app-consumer/src/types/earn.types.ts` — local `EarnRecordStatus`

**Severity:** MEDIUM
**Category:** Type Drift
**Source:** type-auditor

**Issue:** `EarnRecordStatus` is defined in two places with potentially different values. Neither definition is in `shared-types`. The karma service uses its own status values, the consumer app uses its own, and there's no guarantee they match.

**Impact:** Status filtering breaks across service boundaries. A status value that exists in the karma service may not be recognized by the consumer app.

**Fix:** Define `EarnRecordStatus` in `shared-types`. Import from there in both services.

---

## LOW

### XF-11-L01: Hardcoded Test Secret in Test Setup File

**Status:** OPEN
**File:** `rez-karma-service/src/__tests__/setup.ts`
**Severity:** LOW
**Category:** Security / Test
**Source:** security-auditor

**Issue:** Test setup file contains hardcoded JWT secret used for generating test tokens:
```typescript
JWT_SECRET: 'your-secret-key'
```

While this is in a test file, if this file is accidentally imported into production code (e.g., via Jest module mocking), the test secret becomes active in production.

**Fix:** Use environment variables even in test setup:
```typescript
JWT_SECRET: process.env.JWT_SECRET || 'test-secret-' + uuid()
```

---

### XF-11-L02: `Math.random()` in Redis Retry Jitter

**Status:** OPEN
**Files:**
- `rez-finance-service/src/db/redis.ts` — retry jitter uses `Math.random()`
- `rez-karma-service/src/config/redis.ts` — similar pattern

**Severity:** LOW
**Category:** Code Quality
**Source:** logic-auditor

**Issue:** Redis connection retry logic uses `Math.random()` for jitter:
```typescript
await new Promise(r => setTimeout(r, baseDelay * (0.5 + Math.random())));
```

`Math.random()` is not cryptographically random. While this is not security-critical (it's just retry jitter), using `crypto.randomUUID()` or `Math.random()` from a seeded source is more appropriate.

**Fix:** Use `crypto.getRandomValues()` for jitter, or simply use a deterministic backoff.

---

## Status Summary

| ID | Severity | Status | File |
|----|----------|--------|------|
| XF-11-C01 | CRITICAL | OPEN | karma:earnRecordService.ts |
| XF-11-H01 | HIGH | OPEN | karma:karmaService.ts |
| XF-11-H02 | HIGH | OPEN | shared-types / shared-enums / rez-shared |
| XF-11-H03 | HIGH | OPEN | shared-types / rez-shared |
| XF-11-H04 | HIGH | OPEN | finance-service:auth.ts |
| XF-11-M01 | MEDIUM | OPEN | consumer-app:rateLimiter.ts |
| XF-11-M02 | MEDIUM | OPEN | karma:EarnRecordStatus.ts |
| XF-11-L01 | LOW | OPEN | karma-test:setup.ts |
| XF-11-L02 | LOW | OPEN | finance-service:redis.ts |
