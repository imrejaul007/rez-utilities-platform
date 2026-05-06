# Vesper App — MEDIUM Severity Issues

**Date:** 2026-04-16
**Source:** Full codebase audit of `vesper-app/`
**Total:** 8 MEDIUM issues

---

## VS-M1 — Refresh Token Revocation Has No Error Handling

**File:** `server/src/utils/jwt.ts:75-83`

```ts
export async function revokeRefreshToken(token: string): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET as string);
    if (payload.jti) await getRedis().del(`${REFRESH_TOKEN_PREFIX}${payload.jti}`);
  } catch {
    // Token already invalid — silent swallow
  }
}
```

**Finding:** The catch block silently swallows all errors. If `getRedis().del()` throws (e.g., Redis connection drops mid-operation), the error is ignored. The caller (`revokeAllUserTokens`) has no way to know if revocation succeeded.

**Impact:** Silent revocation failures. User believes they logged out but refresh token may remain valid.

**Fix:**
```ts
} catch (err) {
  logger.warn('[JWT] revokeRefreshToken failed:', err);
  throw new Error('Failed to revoke token');
}
```

**Category:** Error Handling / Reliability

---

## VS-M2 — 30-Day Refresh Token Expiry Too Long for High-Value App

**File:** `server/src/utils/jwt.ts:15`

```ts
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 30; // 30 days
```

**Finding:** 30-day refresh token expiry is the maximum safe value. For a luxury dating app targeting HNW individuals, a stolen refresh token gives an attacker 30 days of access. REZ uses 7 days. Industry standard for financial apps is 1-7 days.

**Impact:** Prolonged access window for stolen tokens. No step-up auth on high-value operations.

**Fix:** Reduce to 7 days and require re-authentication weekly.

**Category:** Security — Token Management

---

## VS-M3 — No Automatic Refresh Token Rotation

**File:** `server/src/routes/auth.ts` (login endpoint)

**Finding:** The refresh endpoint issues a new refresh token but does not rotate (invalidate old). If a user logs in on multiple devices, all refresh tokens remain valid indefinitely. No detection of token theft via Refresh Token Rotation (OWASP RECOMMENDATION).

**Impact:** Token theft goes undetected. All old refresh tokens remain valid even after a new login.

**Fix:** On refresh, invalidate the old refresh token after issuing a new one:
```ts
await revokeRefreshToken(oldRefreshToken);
const newRefreshToken = await generateRefreshToken(userId);
```

**Category:** Security — Token Rotation

---

## VS-M4 — API Response Unwrapping Assumes `res.data.data` Always Exists

**File:** `src/api/client.ts:11`

```ts
return res.data.data ?? res.data;
```

**Finding:** The generic API wrapper uses `??` fallback for response unwrapping. If the backend returns `{ data: { data: null } }` (null success), it returns `null` which TypeScript casts to `T`. Components receive `null` and crash when accessing `.map()` or `.length`.

**Impact:** Null responses from backend cause runtime crashes in consuming components.

**Fix:**
```ts
const result = res.data.data ?? res.data;
if (result === null || result === undefined) {
  throw new Error(`API ${url} returned null`);
}
return result as T;
```

**Category:** Type Safety / Reliability

---

## VS-M5 — `revokeAllUserTokens` Scan May Not Complete Before Response

**File:** `server/src/utils/jwt.ts:85-97`

```ts
export async function revokeAllUserTokens(userId: string): Promise<void> {
  // ...
  do {
    const scanResult = await redis.scan(cursor, { MATCH: `${REFRESH_TOKEN_PREFIX}*`, COUNT: 100 });
    // ...
  } while (cursor !== 0);
}
```

**Finding:** `revokeAllUserTokens` uses `SCAN` with `COUNT: 100`. For users with thousands of sessions (power users), this can take many iterations. The `await` waits for completion, but there is no timeout.

**Impact:** Logout endpoint hangs for users with many active sessions. Frontend may timeout and show "logged out" before tokens are actually revoked.

**Fix:** Add timeout and batch operations:
```ts
const timeout = 5000; // 5s max
const deadline = Date.now() + timeout;
do {
  const scanResult = await redis.scan(cursor, { MATCH: `${REFRESH_TOKEN_PREFIX}*`, COUNT: 100 });
  // process batch
  cursor = scanResult.cursor;
} while (cursor !== 0 && Date.now() < deadline);
```

**Category:** Performance / Reliability

---

## VS-M6 — JWT Library Throws on Invalid `alg` Before v9.0.0

**File:** `server/package.json` (implicit — jsonwebtoken version)

**Finding:** `jsonwebtoken` versions before 9.0.0 throw a type error when `algorithms` option is set but the token's `alg` doesn't match. If VS-C1 is fixed by adding `algorithms: ['HS256']`, tokens signed with a different algorithm (e.g., RS256 from a hypothetical external IdP) would cause a hard error rather than graceful rejection.

**Impact:** If the app ever integrates with external identity providers, token verification breaks.

**Fix:** Already addressed in VS-C1 fix. Ensure `jsonwebtoken` is >= 9.0.0:
```json
"jsonwebtoken": "^9.0.0"
```

**Category:** Dependency / Compatibility

---

## VS-M7 — No Account Lockout After Failed Login Attempts

**File:** `server/src/routes/auth.ts`

**Finding:** No tracking of failed login attempts per account. An attacker can brute force passwords indefinitely without account lockout or progressive delay.

**Impact:** Credential stuffing and brute force attacks are unhindered.

**Fix:** Track failed attempts in Redis:
```ts
const key = `login:fail:${email}`;
const attempts = await redis.incr(key);
if (attempts === 1) await redis.expire(key, 900); // 15min window
if (attempts > 5) return res.status(429).json({ error: 'Too many attempts' });
```

**Category:** Security — Authentication

---

## VS-M8 — GraphQL Subscriptions / WebSocket Auth Not Audited

**File:** `server/src/websocket/chat.ts`

**Finding:** WebSocket authentication was not audited in this session. WebSocket connections may bypass the JWT verification that HTTP routes use. Chat real-time functionality may be accessible without valid tokens.

**Impact:** Unknown — WebSocket auth needs dedicated audit.

**Fix:** Audit `server/src/websocket/chat.ts` for auth middleware.

**Category:** Security — Unknown

---

## Summary

| ID | Title | Severity | File | Est. | Status |
|----|-------|---------|------|------|--------|
| VS-M1 | Refresh revocation no error handling | MEDIUM | `server/src/utils/jwt.ts:75` | 30m | ACTIVE |
| VS-M2 | 30-day refresh token too long | MEDIUM | `server/src/utils/jwt.ts:15` | 5m | ACTIVE |
| VS-M3 | No automatic refresh token rotation | MEDIUM | `server/src/routes/auth.ts` | 1h | ACTIVE |
| VS-M4 | API unwrapping crashes on null | MEDIUM | `src/api/client.ts:11` | 30m | ACTIVE |
| VS-M5 | revokeAllUserTokens may timeout | MEDIUM | `server/src/utils/jwt.ts:85` | 30m | ACTIVE |
| VS-M6 | jsonwebtoken version compatibility | MEDIUM | `server/package.json` | 5m | ACTIVE |
| VS-M7 | No account lockout on failed logins | MEDIUM | `server/src/routes/auth.ts` | 1h | ACTIVE |
| VS-M8 | WebSocket auth not audited | MEDIUM | `server/src/websocket/chat.ts` | 2h | ACTIVE |
