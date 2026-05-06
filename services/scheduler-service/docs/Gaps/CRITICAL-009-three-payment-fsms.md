# CRITICAL-009: Three Competing Payment FSMs — No Single Source of Truth

## Severity: P0 — Business Logic / State Machine

## Date Discovered: 2026-04-16
## Phase: Phase 5 — Payment Flow Validation + Phase 8 — State Machine Validation

---

## Issue Summary

Three different finite state machines define payment status transitions in three different places:
1. **Backend monolith FSM** — `financialStateMachine.ts`
2. **Payment service FSM** — `Payment.ts` VALID_TRANSITIONS
3. **Shared package FSM** — `paymentStatuses.ts`

All three define different transitions. During shadow mode, both the monolith and payment service execute transitions independently, resulting in split-brain payment states.

---

## Affected Services

| FSM | File | Statuses | Transitions |
|-----|------|----------|-------------|
| Backend monolith | `rezbackend/.../config/financialStateMachine.ts` | 5 lifecycle FSMs | Allows `failed→pending` retry |
| Payment service | `rez-payment-service/src/models/Payment.ts` | 1 FSM | Blocks `failed` as terminal |
| Shared package | `rez-shared/src/paymentStatuses.ts` | 1 FSM | Has `partially_refunded` |

---

## FSM Comparison — Key Differences

| Transition | Backend FSM | Payment Service | Result |
|-----------|-------------|-----------------|--------|
| `failed → pending` | ✅ Allowed (retry) | ❌ Blocked (terminal) | Shadow mode split-brain |
| `refund_failed → refund_initiated` | ✅ Allowed | ❌ Blocked | Inconsistent refunds |
| `processing → cancelled` | ❌ Not defined | ✅ Allowed | Gap in FSM coverage |
| `partially_refunded` | ❌ Not in FSM | ✅ In VALID_TRANSITIONS | Orphaned state |
| `refunded → completed` | ❌ Blocked | ❌ Blocked | ✅ Consistent |
| `pending → processing` | ✅ Allowed | ✅ Allowed | ✅ Consistent |

---

## Code Reference

### Backend FSM — Allows Retry from Failed
**File:** `rezbackend/.../config/financialStateMachine.ts`

```typescript
PAYMENT_TRANSITIONS: {
  failed: ['pending'],  // ← Allows retry — 3 retries max
}
```

### Payment Service — Blocks Retry from Failed
**File:** `rez-payment-service/src/models/Payment.ts`

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  failed: [],  // ← BLOCKED — terminal state
  refund_failed: [],  // ← BLOCKED — terminal
  partially_refunded: ['refund_initiated'],
  // ...
};
```

### Shared Package — Has `partially_refunded`
**File:** `rez-shared/src/paymentStatuses.ts`

```typescript
export const PAYMENT_STATUSES = [
  'pending', 'processing', 'authorized', 'paid',
  'failed', 'refund_initiated', 'refunded',
  'partially_refunded', 'refund_failed'
] as const;
```

---

## Impact

- **Shadow mode creates diverged states** — monolith says "retry pending", payment service says "failed terminal"
- **Payment reconciliation impossible** — no consistent state to query
- **Refund logic breaks** — `refund_failed` can be retried in backend but not in payment service
- **FSM violations** — operations that work in one system fail in the other
- **Testing coverage gap** — tests pass in isolation but fail in integration

---

## Root Cause

Each extraction copied the FSM independently. The shared package (`rez-shared`) was created but not adopted consistently — the payment service and backend both define their own FSMs, and they don't agree.

---

## Fix Required

1. **Establish canonical FSM in shared package:**
   ```typescript
   // rez-shared/src/stateMachines/paymentStateMachine.ts
   export const PAYMENT_STATE_MACHINE = {
     states: ['pending', 'processing', 'authorized', 'paid',
              'failed', 'refund_initiated', 'partially_refunded',
              'refund_failed', 'refunded'],
     transitions: {
       pending: ['processing', 'cancelled', 'expired'],
       processing: ['completed', 'failed', 'cancelled'],
       completed: ['refund_initiated', 'partially_refunded'],
       refund_initiated: ['refunded', 'refund_failed'],
       partially_refunded: ['refund_initiated', 'refunded'],
       refund_failed: ['refund_initiated'],  // Allow retry
       failed: ['pending'],  // Allow retry
     }
   };
   ```

2. **Remove FSM duplication** — delete local FSMs from backend and payment service; import from shared package

3. **Enforce FSM at DB level** via Mongoose middleware:
   ```typescript
   PaymentSchema.pre('save', function(next) {
     const allowed = PAYMENT_STATE_MACHINE.transitions[this.status];
     if (!allowed.includes(this.previousStatus)) {
       throw new Error(`Invalid transition: ${this.previousStatus} → ${this.status}`);
     }
     next();
   });
   ```

4. **Disable shadow mode** — after FSM is unified, stop running both systems concurrently

---

## Related Gaps

- [CRITICAL-008-dual-authority](CRITICAL-008-dual-authority.md) — Same root cause
- [CRITICAL-013-order-statuses-out-of-sync](CRITICAL-013-order-statuses-out-of-sync.md) — Same pattern of FSM fork
- [CRITICAL-001-settlement-blind-spot](CRITICAL-001-settlement-blind-spot.md) — Same extraction pattern caused this
