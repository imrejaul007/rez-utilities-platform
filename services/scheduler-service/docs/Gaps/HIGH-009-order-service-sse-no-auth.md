# HIGH-009: Order Service SSE Endpoint Has No Authorization

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

The SSE stream endpoint `/stream/:merchantId` does not verify that the requesting user owns the merchant. Any authenticated user can subscribe to any merchant's order updates.

---

## Code Reference

**File:** `rez-order-service/src/httpServer.ts`

```typescript
// SSE endpoint — no auth on merchantId
app.get('/stream/:merchantId', (req, res) => {
  // No check: req.user.merchantId === req.params.merchantId
  const { merchantId } = req.params;
  // Anyone can subscribe to any merchant's stream
});
```

---

## Impact

- Merchant A can see Merchant B's order updates
- Competitor espionage — see order volume, timing, customer details
- Real-time business intelligence leakage

---

## Fix Required

```typescript
app.get('/stream/:merchantId', requireAuth, (req, res) => {
  if (req.user.merchantId !== req.params.merchantId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Continue stream...
});
```

---

## Related

- [CRITICAL-006-admin-cron-consumer-auth](CRITICAL-006-admin-cron-consumer-auth.md)
- [CRITICAL-014-static-files-unauthenticated](CRITICAL-014-static-files-unauthenticated.md)
