# CRITICAL-011: Internal Service Key Unvalidated — Silent Failure When Empty

## Severity: P1 — Security / Authentication

## Date Discovered: 2026-04-16
## Phase: Phase 7 — Security Validation

---

## Issue Summary

Internal service authentication keys (`INTERNAL_SERVICE_KEY`, `INTERNAL_SERVICE_TOKENS_JSON`) are accepted even when empty or unset. Requests proceed without authentication, effectively bypassing all inter-service security.

---

## Affected Services

| Service | Key Checked |
|---------|------------|
| `rez-payment-service` | `INTERNAL_SERVICE_TOKENS_JSON` |
| `rez-wallet-service` | `INTERNAL_SERVICE_TOKEN` |
| `rez-order-service` | `INTERNAL_SERVICE_TOKEN` |
| `rez-catalog-service` | `INTERNAL_HMAC_SECRET` (runtime-generated — CRITICAL-002) |
| `rez-auth-service` | `INTERNAL_SERVICE_TOKEN` |

---

## Code Reference

### Payment Service — Silent Failure on Empty Config
**File:** `rez-payment-service/src/middleware/internalAuth.ts`

```typescript
const scopedTokens = process.env.INTERNAL_SERVICE_TOKENS_JSON
  ? JSON.parse(process.env.INTERNAL_SERVICE_TOKENS_JSON)
  : undefined;

// No validation that the parsed result is non-empty
// Empty string parses to empty object {} — all tokens accepted as invalid

if (!scopedTokens) {
  // This only fires when env var is completely absent
  // An empty string "" or "[]" passes through
  return res.status(503).json({ error: 'Internal auth not configured' });
}
```

### Wallet Service — Legacy Token Accepted When Empty
**File:** `rez-wallet-service/src/middleware/internalAuth.ts`

```typescript
const legacyToken = process.env.INTERNAL_SERVICE_TOKEN;
if (!legacyToken) {
  // Only blocks when completely absent
  // Empty string "" bypasses check
}
```

---

## Impact

- If `INTERNAL_SERVICE_TOKENS_JSON` is set to `""` or `"{}"`, any request passes auth
- If `INTERNAL_SERVICE_TOKEN` is set to `""`, any request passes auth
- All internal service endpoints become publicly accessible
- Finance service can fake wallet credits (CRITICAL-015)
- Payment service webhook can be spoofed
- Settlement can be manipulated

---

## Verification

```bash
# Test with empty token
curl -X POST http://payment-service.internal/webhook/razorpay \
  -H "X-Internal-Token: " \
  -H "X-Internal-Service: backend"
# Should return 503 but may return 200 if empty string bypasses check
```

---

## Fix Required

1. **Validate env vars on startup:**
   ```typescript
   function validateInternalAuthConfig() {
     const tokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;
     if (!tokensJson || tokensJson.trim() === '') {
       throw new Error('INTERNAL_SERVICE_TOKENS_JSON must be a non-empty JSON string');
     }
     const tokens = JSON.parse(tokensJson);
     if (typeof tokens !== 'object' || Object.keys(tokens).length === 0) {
       throw new Error('INTERNAL_SERVICE_TOKENS_JSON must contain at least one service token');
     }
   }

   validateInternalAuthConfig();
   ```

2. **Validate incoming tokens:**
   ```typescript
   export function requireInternalToken(req, res, next) {
     const token = req.headers['x-internal-token'];
     if (!token || typeof token !== 'string' || token.trim() === '') {
       return res.status(401).json({ error: 'Missing internal token' });
     }
     // Continue with validation...
   }
   ```

3. **Add health check endpoint:**
   ```typescript
   app.get('/health/auth', (req, res) => {
     const configured = !!process.env.INTERNAL_SERVICE_TOKENS_JSON;
     const valid = configured && Object.keys(tokens).length > 0;
     res.json({ authConfigured: valid });
   });
   ```

---

## Related Gaps

- [CRITICAL-002-catalog-auth-broken](CRITICAL-002-catalog-auth-broken.md) — Same pattern, different implementation
- [CRITICAL-004-karma-auth-404](CRITICAL-004-karma-auth-404.md) — Same pattern of missing validation
- [CRITICAL-006-admin-cron-consumer-auth](CRITICAL-006-admin-cron-consumer-auth.md) — Same pattern of missing role check
