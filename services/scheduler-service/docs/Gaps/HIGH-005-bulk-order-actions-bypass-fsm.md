# HIGH-005: Merchant Service Bulk Order Actions Bypass State Machine

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

Bulk order actions (confirm, cancel, update) in the merchant service directly write status changes without going through the order FSM. This allows invalid state transitions in bulk.

---

## Code Reference

**File:** `rez-merchant-service/src/routes/orders.ts:218-279`

```typescript
// Bypasses FSM — direct status write
await Order.updateMany(
  { _id: { $in: orderIds } },
  { $set: { status: newStatus } }  // ← No FSM validation
);
```

---

## Impact

- Bulk status changes can violate FSM rules
- Order state machine enforcement is skipped
- Dual writes create inconsistent state between monolith and merchant service

---

## Fix Required

Use the order service FSM validation for all bulk operations:
```typescript
import { transitionOrderStatus } from '@rez/shared/orderStateMachine';

for (const orderId of orderIds) {
  await transitionOrderStatus(orderId, newStatus);
}
```

---

## Related

- [CRITICAL-009-three-payment-fsms](CRITICAL-009-three-payment-fsms.md)
- [CRITICAL-008-dual-authority](CRITICAL-008-dual-authority.md)
