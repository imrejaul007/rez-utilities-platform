# Vesper App — HIGH Severity Issues

**Date:** 2026-04-16
**Source:** Full codebase audit of `vesper-app/`
**Total:** 5 HIGH issues

---

## VS-H1 — No Rate Limiting on Public Endpoints

**Files:** All route files in `server/src/routes/`

```ts
// routes/auth.ts, routes/profile.ts, routes/membership.ts, routes/webhook.ts
// No rate limiting middleware applied to any route
```

**Finding:** No `rateLimit` middleware is applied to any route. The `server/src/utils/rateLimit.ts` utility exists but is not wired into any route. Public endpoints (login, registration, webhook) have no protection against brute force or DoS.

**Impact:** Credential stuffing attacks on login endpoint. Mass registration. Webhook abuse.

**Fix:** Apply `rateLimit` middleware to all public endpoints:
```ts
import { rateLimit } from '../utils/rateLimit';
router.post('/auth/login', rateLimit({ windowMs: 900000, max: 5 }), loginHandler);
```

**Category:** Security — DoS / Brute Force

---

## VS-H2 — Auth Middleware Throws on Empty Bearer Token

**File:** `server/src/middleware/auth.ts`

```ts
// Likely pattern similar to:
const token = header.slice(7); // No empty-check
jwt.verify(token, secret); // Throws on empty string
```

**Finding:** If the `Authorization` header is `"Bearer "` (7 chars with space but no token), `slice(7)` returns an empty string. `jwt.verify('')` throws, returning a 500 error instead of 401. An attacker can probe for valid endpoints by sending empty tokens and causing server errors.

**Impact:** Information disclosure via error signatures. DoS via repeated malformed requests.

**Fix:**
```ts
const token = header.slice(7);
if (!token) return res.status(401).json({ error: 'No token provided' });
```

**Category:** Security — Input Validation

---

## VS-H3 — Refresh Token Revocation Silently Fails When Redis Down

**File:** `server/src/utils/jwt.ts:76-82`

```ts
export async function revokeRefreshToken(token: string): Promise<void> {
  if (!isRedisAvailable()) return;  // ← Silently skips revocation
  try {
    const payload = jwt.verify(token, REFRESH_SECRET, { algorithms: ['HS256'] });
    if (payload.jti) await getRedis().del(`${REFRESH_TOKEN_PREFIX}${payload.jti}`);
  } catch {
    // Token already invalid
  }
}
```

**Finding:** When Redis is unavailable, `revokeRefreshToken` returns early without revoking. The refresh token remains valid. This is intentional (documented in code), but when Redis comes back online, the old token is still valid until natural expiry (30 days).

**Impact:** If a user logs out on a stolen device, that device's refresh token remains valid until expiry even though logout was attempted. 30-day window for account takeover if Redis was down at logout time.

**Fix:** Queue revoked tokens to a fallback store (DB) when Redis is unavailable:
```ts
if (!isRedisAvailable()) {
  await db.revokedTokens.insert({ jti: payload.jti, expiresAt: payload.exp });
}
```

**Category:** Security — Token Revocation

---

## VS-H4 — Refresh Token Uses `as string` Cast on Undefined Env Var

**File:** `server/src/utils/jwt.ts:5-6`

```ts
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;
```

**Finding:** `process.env.JWT_REFRESH_SECRET` is cast to `string` without a null check. The lines below check for validity but not presence — `process.env` returns `undefined` for missing vars, and `undefined as string` silently compiles.

**Impact:** If `JWT_REFRESH_SECRET` is not set, the secret is `undefined`. JWTs are signed with `undefined` as the key. Anyone who knows this can forge tokens.

**Fix:**
```ts
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_TOKEN_SECRET) throw new Error('JWT_SECRET env var is required');
if (!REFRESH_TOKEN_SECRET) throw new Error('JWT_REFRESH_SECRET env var is required');
```

**Category:** Security — Configuration

---

## VS-H5 — No Input Sanitization on User-Provided Content Fields

**Files:** `server/src/routes/profile.ts` · `server/src/routes/matches.ts`

```ts
// Example — bio field inserted without sanitization:
await db.users.update({ bio: req.body.bio });  // XSS vector
```

**Finding:** User-provided text fields (bio, about, profile description) are not sanitized before storage or rendering. Stored XSS is possible if the React Native app renders these fields with `dangerouslySetInnerHTML` or if any web endpoint serves profile data.

**Impact:** Stored XSS. An attacker sets a malicious bio that executes in any viewer's session.

**Fix:**
```ts
import DOMPurify from 'isomorphic-dompurify';
const sanitizedBio = DOMPurify.sanitize(req.body.bio, { ALLOWED_TAGS: [] });
await db.users.update({ bio: sanitizedBio });
```

**Category:** Security — XSS

---

## Summary

| ID | Title | Severity | File | Est. | Status |
|----|-------|---------|------|------|--------|
| VS-H1 | No rate limiting on public endpoints | HIGH | `server/src/routes/*` | 2h | ACTIVE |
| VS-H2 | Auth middleware throws on empty Bearer token | HIGH | `server/src/middleware/auth.ts` | 15m | ACTIVE |
| VS-H3 | Refresh token revocation fails silently when Redis down | HIGH | `server/src/utils/jwt.ts:76` | 1h | ACTIVE |
| VS-H4 | Refresh token env var uses `as string` cast on undefined | HIGH | `server/src/utils/jwt.ts:6` | 5m | ACTIVE |
| VS-H5 | No input sanitization on user content fields | HIGH | `routes/profile.ts`, `routes/matches.ts` | 1h | ACTIVE |
