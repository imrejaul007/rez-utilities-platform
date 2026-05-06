# CRITICAL-004: Karma Service Auth Route Returns 404 on Every Authenticated Call

## Severity: P0 — Security / Authentication Bypass

## Date Discovered: 2026-04-16
## Phase: Phase 7 — Security Validation

---

## Issue Summary

The karma service calls the auth service at `/api/auth/verify` to validate JWT tokens, but the auth service defines `/api/auth/validate`. Every authenticated request to the karma service returns a 404 from the auth service, effectively **disabling authentication** for all karma service endpoints.

---

## Affected Services

| Service | Impact |
|---------|--------|
| `rez-karma-service` | All authenticated endpoints return 404 from auth service |

---

## Code Reference

### Karma Service — Wrong Auth Endpoint
**File:** `rez-karma-service/src/middleware/auth.ts:42`

```typescript
const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';
const verifyUrl = `${authServiceUrl}/api/auth/verify`;
//              ↑ Wrong endpoint — auth service uses /api/auth/validate
```

### Auth Service — Actual Endpoint
**File:** `rez-auth-service/src/routes/auth.ts` (presumed)

```typescript
// Auth service defines:
router.post('/api/auth/validate', ...);
// NOT /api/auth/verify
```

### Request Flow

```
Client → Karma Service → GET /api/auth/verify → Auth Service
                                              ↓
                                     404 Not Found
                                              ↓
                                     authServiceUrl returns 404
                                              ↓
                              Middleware doesn't return — falls through
                                              ↓
                              Request proceeds WITHOUT authentication
```

---

## Impact

- **Authentication is silently bypassed** — the auth middleware doesn't return early on 404, it falls through, allowing unauthenticated requests to proceed
- All karma service endpoints are publicly accessible
- User karma can be modified by anyone
- Karma earning rules can be manipulated
- Points can be credited/debited without authorization

---

## Root Cause

The endpoint name (`verify` vs `validate`) was not synchronized when the karma service was extracted. The auth service may have been refactored after the karma service was written.

---

## Verification

```bash
# Any request to karma service — the auth call returns 404
curl -X GET http://localhost:3005/api/karma/profile \
  -H "Authorization: Bearer <valid-jwt>"
# Returns: { success: false, error: 'Auth service returned non-200' }
# or: proceeds without auth (depends on error handling)
```

---

## Fix Required

1. Change the endpoint URL in `rez-karma-service/src/middleware/auth.ts`:
   ```typescript
   const verifyUrl = `${authServiceUrl}/api/auth/validate`;
   //                                                   ↑ validate, not verify
   ```

2. Add error handling for auth service failures:
   ```typescript
   if (authResponse.status === 404) {
     logger.error('AUTH_ENDPOINT_NOT_FOUND', {
       expected: '/api/auth/validate',
       received: '/api/auth/verify'
     });
   }
   if (!authResponse.ok) {
     return res.status(401).json({ error: 'Authentication failed' });
   }
   ```

3. Add integration test that validates auth service connectivity on startup

---

## Related Gaps

- [CRITICAL-006-admin-cron-consumer-auth](CRITICAL-006-admin-cron-consumer-auth.md) — Different auth failure mode but same auth middleware
- [CRITICAL-002-catalog-auth-broken](CRITICAL-002-catalog-auth-broken.md) — Different auth failure but same consequence
