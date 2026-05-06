# HIGH-004: Order Service Worker Writes Invalid Nested Object

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

The order service worker writes a nested object `{ value: 'failed', updatedAt: new Date() }` to `payment.status`, but the schema expects a flat string. This creates a document that will fail subsequent FSM checks.

---

## Code Reference

**File:** `rez-order-service/src/worker.ts:211`

```typescript
// WRONG — writes nested object
case 'payment_failed':
  await Order.findByIdAndUpdate(orderId, {
    'payment.status': { value: 'failed', updatedAt: new Date() }  // ← Nested object
  });

// CORRECT — flat string
case 'payment_failed':
  await Order.findByIdAndUpdate(orderId, {
    'payment.status': 'failed'
  });
```

---

## Impact

- Payment status field corrupted with invalid data
- Subsequent FSM transitions fail on type mismatch
- Orders stuck in invalid state

---

## Fix Required

Replace with flat string assignment and use `$set` with the correct path.

---

## Related

- [CRITICAL-009-three-payment-fsms](CRITICAL-009-three-payment-fsms.md)
- [CRITICAL-013-order-statuses-out-of-sync](CRITICAL-013-order-statuses-out-of-sync.md)
