# HIGH-003: Payment Service Rejects Legacy Token — Breaks Existing Deployments

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

The payment service only accepts `INTERNAL_SERVICE_TOKENS_JSON` (scoped tokens) and rejects legacy `INTERNAL_SERVICE_TOKEN`. The wallet service accepts both. If any service still uses the legacy token pattern, it cannot communicate with the payment service.

---

## Code Reference

**File:** `rez-payment-service/src/middleware/internalAuth.ts`

```typescript
if (!scopedTokens) {
  return res.status(503).json({
    error: 'Internal auth not configured — set INTERNAL_SERVICE_TOKENS_JSON'
  });
  return;  // ← ONLY accepts new format
}
```

**File:** `rez-wallet-service/src/middleware/internalAuth.ts`

```typescript
// ACCEPTS BOTH:
const legacyToken = process.env.INTERNAL_SERVICE_TOKEN;
const scopedTokens = process.env.INTERNAL_SERVICE_TOKENS_JSON;
```

---

## Impact

- Backend monolith may use legacy token — cannot call payment service
- If any existing deployment uses legacy token, it's broken after payment service update
- Silent breakage — payment service returns 503 instead of explaining the incompatibility

---

## Fix Required

Payment service should accept both formats:
```typescript
const legacyToken = process.env.INTERNAL_SERVICE_TOKEN;
const scopedTokensJson = process.env.INTERNAL_SERVICE_TOKENS_JSON;

if (!legacyToken && !scopedTokensJson) {
  return res.status(503).json({ error: 'Internal auth not configured' });
}

if (scopedTokensJson) {
  // New format
} else if (legacyToken) {
  // Legacy format
}
```

---

## Related

- [CRITICAL-011-internal-service-key-unvalidated](CRITICAL-011-internal-service-key-unvalidated.md)
- [CRITICAL-002-catalog-auth-broken](CRITICAL-002-catalog-auth-broken.md)
