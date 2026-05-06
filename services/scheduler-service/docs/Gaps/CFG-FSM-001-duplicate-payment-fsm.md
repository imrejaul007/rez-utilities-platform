# CFG-001: Payment FSM Defined Twice — 6 Divergences Between Payment.ts and financialStateMachine.ts

**Severity:** CRITICAL
**Category:** Config / FSM / Duplicate
**Gap ID:** CFG-001
**Services Affected:** rez-payment-service, rezbackend, rez-shared
**Status:** ACTIVE
**Est Fix:** 3 hours
**Related:** CRITICAL-009 (three payment FSMs), CRITICAL-013 (order statuses out of sync)

---

## Description

The payment FSM is defined in two files with 6 divergences. This is the backend + shared package version of CRITICAL-009 (which also covers the payment service).

### File A: `rez-payment-service/src/models/Payment.ts` (lines 53-65)

```typescript
export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'failed'],
  processing: ['authorized', 'failed'],  // ← processing→cancelled missing
  authorized: ['captured', 'failed'],    // ← authorized→cancelled missing
  captured: ['refunded', 'partially_refunded'],
  refunded: [],
  partially_refunded: ['refunded'],
  failed: [],        // ← terminal: no retry allowed
};
```

### File B: `rezbackend/rez-backend-master/src/config/financialStateMachine.ts` (lines 25-36)

```typescript
export const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'failed', 'cancelled'],
  processing: ['confirmed', 'cancelled', 'failed'],
  confirmed: ['captured', 'refunded', 'failed'],
  captured: ['refunded', 'cancelled', 'partially_refunded'],
  cancelled: [],
  failed: ['pending'],  // ← retry allowed
  refunded: [],
  partially_refunded: ['refunded', 'cancelled'],
};
```

### Divergences

| # | Aspect | Payment.ts | financialStateMachine.ts |
|---|--------|-----------|------------------------|
| 1 | `processing` transitions | `['authorized', 'failed']` | `['confirmed', 'cancelled', 'failed']` |
| 2 | `processing→cancelled` | Missing | Exists |
| 3 | `authorized` state | Has `authorized` state | Does NOT have `authorized` state |
| 4 | `authorized→cancelled` | Missing | N/A |
| 5 | `failed` transitions | `[]` (terminal) | `['pending']` (retry allowed) |
| 6 | `partially_refunded` target | `'refunded'` only | `'refunded', 'cancelled'` |

### Impact

- Payment service (Payment.ts) blocks retry for failed payments — backend allows it
- `authorized` state exists in payment service but not in backend FSM — impossible to transition from it in backend
- `processing→cancelled` exists in backend but not payment service — status writes diverge
- Users experience inconsistent payment behavior depending on which service processes the payment

### Fix Direction

1. Designate `financialStateMachine.ts` as the canonical FSM
2. Update `Payment.ts` to match
3. Delete `VALID_TRANSITIONS` from `Payment.ts` — import from shared
4. Add database-level invariant enforcement:
```typescript
// In Payment model pre-save hook:
const validNextStates = PAYMENT_TRANSITIONS[this.status];
if (!validNextStates.includes(nextStatus)) {
  throw new Error(`Invalid payment transition: ${this.status} → ${nextStatus}`);
}
```
5. See CRITICAL-009 for the full picture across all 3 FSM definitions
