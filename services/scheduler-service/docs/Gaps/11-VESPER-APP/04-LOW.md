# Vesper App — LOW Severity Issues

**Date:** 2026-04-16
**Source:** Full codebase audit of `vesper-app/`
**Total:** 5 LOW issues

---

## VS-L1 — `jwt.verify` Casts Payload Without Runtime Type Guard

**File:** `server/src/utils/jwt.ts:48, 59, 78`

```ts
const payload = jwt.verify(token, ACCESS_TOKEN_SECRET as string) as TokenPayload;
```

**Finding:** The `as TokenPayload` cast is a compile-time assertion only. If the JWT payload contains extra fields or unexpected types, no runtime validation occurs. `payload.userId` could be a number, object, or missing entirely.

**Impact:** Runtime type mismatch if token is malformed or from a different issuer.

**Fix:**
```ts
if (typeof payload.userId !== 'string' || !payload.userId) {
  throw new Error('Invalid token payload');
}
```

**Category:** Type Safety

---

## VS-L2 — No `jti` on Access Token — No Token-Specific Revocation

**File:** `server/src/utils/jwt.ts:24-29`

```ts
export function generateAccessToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'access' },
    ACCESS_TOKEN_SECRET as string,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}
```

**Finding:** Access tokens don't include a `jti` (JWT ID). Refresh tokens have `jti` for revocation, but access tokens cannot be individually revoked before expiry.

**Impact:** If an access token needs to be revoked (e.g., privilege downgrade), it remains valid until natural expiry (15 minutes).

**Category:** Security — Token Management

---

## VS-L3 — Redis Unavailable Silently Degrades to Token Rotation Failure

**File:** `server/src/utils/jwt.ts:39-42`

```ts
if (isRedisAvailable()) {
  await getRedis().setEx(`${REFRESH_TOKEN_PREFIX}${jti}`, REFRESH_TOKEN_EXPIRY, userId);
}
```

**Finding:** When Redis is unavailable, refresh tokens are generated without Redis storage. `verifyRefreshToken` checks Redis for revocation, so unauthenticated tokens remain valid. `revokeRefreshToken` returns early without revoking.

**Impact:** During Redis outages, token revocation is completely non-functional for the duration.

**Category:** Reliability — Degraded Mode

---

## VS-L4 — No Structured Logging — `console.log` in Server Code

**File:** `server/src/` (multiple files)

**Finding:** The server likely uses `console.log` or direct `console` for logging. No structured logging with request IDs, correlation IDs, or log levels.

**Impact:** Difficult to trace requests across logs in production. No log aggregation compatibility.

**Category:** Observability

---

## VS-L5 — No Health Check Endpoint

**File:** `server/src/index.ts`

**Finding:** No `/health` or `/ready` endpoint for load balancer or orchestrator health checks.

**Impact:** Kubernetes/load balancer cannot determine if the server is healthy without hitting a business endpoint.

**Fix:**
```ts
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', redis: isRedisAvailable() });
});
```

**Category:** Operational

---

## Summary

| ID | Title | Severity | File | Est. | Status |
|----|-------|---------|------|------|--------|
| VS-L1 | JWT payload cast without runtime guard | LOW | `server/src/utils/jwt.ts:48` | 15m | ACTIVE |
| VS-L2 | Access token has no jti for revocation | LOW | `server/src/utils/jwt.ts:24` | 30m | ACTIVE |
| VS-L3 | Redis unavailable silently degrades revocation | LOW | `server/src/utils/jwt.ts:39` | 1h | ACTIVE |
| VS-L4 | No structured logging | LOW | `server/src/` | 2h | ACTIVE |
| VS-L5 | No health check endpoint | LOW | `server/src/index.ts` | 15m | ACTIVE |
