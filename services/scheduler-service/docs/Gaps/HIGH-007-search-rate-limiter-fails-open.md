# HIGH-007: Search Service Rate Limiter Fails Open on Redis Errors

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

The search service rate limiter logs a warning on Redis errors but allows the request through. Under Redis failure, rate limiting is completely bypassed.

---

## Code Reference

**File:** `rez-search-service/src/middleware/rateLimiter.ts`

```typescript
try {
  const result = await redis.incr(key);
} catch (err) {
  logger.warn('Rate limiter Redis error', { error: err.message });
  return next();  // ← Allows request through on Redis failure
}
```

---

## Impact

- Rate limiting bypassed during Redis outage
- DDoS amplification — attackers can flood the search service
- No protection when it's most needed

---

## Fix Required

Fail closed — reject requests when rate limiting can't be verified:
```typescript
try {
  const result = await redis.incr(key);
} catch (err) {
  logger.error('Rate limiter Redis error — blocking request', { error: err.message });
  return res.status(503).json({ error: 'Service temporarily unavailable' });
}
```

---

## Related

- [CRITICAL-015-silent-coin-failure](CRITICAL-015-silent-coin-failure.md)
- [CRITICAL-007-fraudflag-missing](CRITICAL-007-fraudflag-missing.md)
