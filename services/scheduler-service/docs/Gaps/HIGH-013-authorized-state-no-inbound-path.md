# HIGH-013: 'authorized' Payment Status Has No Inbound Path

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

The `authorized` state is defined in `PAYMENT_TRANSITIONS` but no transition leads to it. It exists in the status enum but is unreachable in normal flow.

---

## Code Reference

**File:** `rez-shared/src/paymentStatuses.ts`

```typescript
export const PAYMENT_STATUSES = [
  'pending', 'processing', 'authorized', 'paid',  // 'authorized' defined
  // ...
];

// No transition leads to 'authorized' in PAYMENT_TRANSITIONS
export const PAYMENT_TRANSITIONS = {
  pending: ['processing', 'cancelled', 'expired'],
  processing: ['completed', 'failed'],  // No 'authorized'
  // ...
};
```

---

## Impact

- Dead state in FSM — `authorized` is unreachable
- If any code sets payment to `authorized`, FSM validation passes but it's invalid
- Confusion in payment status reporting

---

## Fix Required

Either remove `authorized` from statuses (if not used) or add a transition path to it:
```typescript
processing: ['completed', 'failed', 'authorized'],
authorized: ['paid'],  // Transition to paid after capture
```

---

## Related

- [CRITICAL-009-three-payment-fsms](CRITICAL-009-three-payment-fsms.md)
