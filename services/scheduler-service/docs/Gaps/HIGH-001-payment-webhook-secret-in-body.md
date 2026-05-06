# HIGH-001: Payment Service Sends Secret in JSON Body, Not Auth Header

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

The payment service sends `secret: internalSecret` in the JSON request body when calling internal services (wallet credit), but internal auth middleware expects `X-Internal-Token` in headers. The secret is also sent as `INTERNAL_SERVICE_TOKENS_JSON` (a JSON string) instead of the expected JSON object format.

---

## Code Reference

**File:** `rez-payment-service/src/services/paymentService.ts`

```typescript
// Webhook handler credits wallet
await axios.post(`${walletUrl}/api/wallet/credit`, {
  secret: internalSecret,  // ← Sent in BODY, not HEADER
  // Auth middleware expects: X-Internal-Token header
});

// Token passed as JSON string instead of parsed object:
const token = INTERNAL_SERVICE_TOKENS_JSON;  // ← JSON string
// Should be: JSON.parse(INTERNAL_SERVICE_TOKENS_JSON)
```

---

## Impact

- Wallet credit from payment webhook silently fails
- Users don't receive coins for successful payments
- No error thrown — auth middleware rejects but call completes

---

## Fix Required

1. Send token in header:
   ```typescript
   await axios.post(`${walletUrl}/api/wallet/credit`, body, {
     headers: { 'X-Internal-Token': internalSecret }
   });
   ```

2. Parse JSON string on startup:
   ```typescript
   const INTERNAL_SERVICE_TOKENS_JSON = JSON.parse(
     process.env.INTERNAL_SERVICE_TOKENS_JSON || '{}'
   );
   ```

---

## Related

- [CRITICAL-011-internal-service-key-unvalidated](CRITICAL-011-internal-service-key-unvalidated.md)
- [CRITICAL-015-silent-coin-failure](CRITICAL-015-silent-coin-failure.md)
