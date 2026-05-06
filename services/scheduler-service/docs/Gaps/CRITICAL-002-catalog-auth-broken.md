# CRITICAL-002: Catalog Service Internal Auth Broken — Runtime HMAC Key Generation

## Severity: P0 — Security / Service Communication Failure

## Date Discovered: 2026-04-16
## Phase: Phase 7 — Security Validation

---

## Issue Summary

The catalog service generates its HMAC secret at **runtime** using `crypto.randomBytes(32)` on every startup. Every internal service call to the catalog service fails authentication because callers cannot know the randomly generated secret.

---

## Affected Services

| Service | Impact |
|---------|--------|
| `rez-catalog-service` | All internal auth fails |
| `rez-backend` (monolith) | Cannot call catalog service |
| `rez-order-service` | Cannot call catalog service |
| `rez-merchant-service` | Cannot call catalog service |

---

## Code Reference

**File:** `rez-catalog-service/src/middleware/internalAuth.ts:4`

```typescript
const HMAC_SECRET = crypto.randomBytes(32).toString('hex');
// Generated fresh on EVERY startup — callers have no way to know this key
```

All callers use a **static** key from environment variables. The catalog service generates a new random key every time. The result is complete auth failure on every internal call.

---

## Impact

- Catalog service is **unreachable** by any internal service
- Product lookups, inventory checks, pricing — all fail
- The entire catalog service is effectively non-functional for inter-service communication
- Any cached HMAC key stored by callers becomes invalid after every catalog service restart

---

## Root Cause

The `internalAuth.ts` was likely copy-pasted from an authentication generator pattern that was meant for session secrets, not for shared secrets between services. The `crypto.randomBytes()` pattern is correct for generating one-time session secrets but catastrophic for shared-secret HMAC validation.

---

## Verification

```bash
# Restart catalog service and observe all internal calls receiving 401
# Call from any service:
curl -X POST http://rez-catalog-service.internal/api/catalog/products \
  -H "X-Internal-Timestamp: ..." \
  -H "X-Internal-Signature: ..." \
  # Always fails — signature uses env var key, service uses random key
```

---

## Fix Required

1. Replace runtime generation with environment variable:
   ```typescript
   const HMAC_SECRET = process.env.INTERNAL_HMAC_SECRET;
   if (!HMAC_SECRET) {
     throw new Error('INTERNAL_HMAC_SECRET environment variable is required');
   }
   ```

2. Ensure all callers are configured with the same `INTERNAL_HMAC_SECRET` value

3. Add a startup health check that verifies `HMAC_SECRET` is set and matches expected format

4. Rotate the secret across all services using a deployment process (not manual)

---

## Related Gaps

- [CRITICAL-011-internal-service-key-unvalidated](CRITICAL-011-internal-service-key-unvalidated.md) — Same pattern of env var misuse
- [CRITICAL-004-karma-auth-404](CRITICAL-004-karma-auth-404.md) — Different auth failure mode but same root cause
