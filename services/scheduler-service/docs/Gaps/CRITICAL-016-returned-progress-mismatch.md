# CRITICAL-016: Returned Order Progress Mismatch — Backend 0%, Shared Package 100%

## Severity: P1 — Business Logic / User Experience

## Date Discovered: 2026-04-16
## Phase: Phase 3 — Enum & Status Consistency

---

## Issue Summary

`getOrderProgress()` in the backend returns 0% for `returned` orders, but the shared package returns 100%. Frontend apps that import from the shared package show `returned` orders as 100% complete, while backend API responses show 0%. Users see contradictory progress indicators.

---

## Affected Services

| Service | File | `returned` Progress |
|---------|------|--------------------|
| `rez-shared` | `src/orderStatuses.ts` | 100% |
| `rez-backend` (monolith) | `src/config/orderStateMachine.ts` | 0% |
| Frontend apps | Import from shared | 100% |

---

## Code Reference

### Shared Package — Returns 100%
**File:** `rez-shared/src/orderStatuses.ts`

```typescript
export function getOrderProgress(status: string): number {
  switch (status) {
    case 'placed': return 5;
    case 'confirmed': return 15;
    case 'preparing': return 30;
    case 'ready': return 45;
    case 'dispatched': return 60;
    case 'out_for_delivery': return 75;
    case 'delivered': return 90;
    case 'returned': return 100;  // ← 100% — order fully resolved
    case 'refunded': return 100;
    // ...
  }
  return 0;
}
```

### Backend — Returns 0%
**File:** `rezbackend/.../src/config/orderStateMachine.ts`

```typescript
export function getOrderProgress(status: string): number {
  switch (status) {
    case 'placed': return 5;
    // ... similar until 'returned'
    case 'returned': return 0;  // ← 0% — treated as incomplete/error state
    case 'refunded': return 100;
    // ...
  }
  return 0;
}
```

---

## Impact

- **User confusion** — same order shows 100% in app (shared package) and 0% in notifications/email (backend)
- **Inconsistent UX** — progress bar jumps from 90% to 100% in app, but notification shows 0%
- **Return flow appears broken** — users see "in progress" for an order they returned
- **Data inconsistency** — analytics from backend show returns as incomplete

---

## Root Cause

Two independent implementations of `getOrderProgress()` with different semantics:
- Backend treats `returned` as an error state (0%)
- Shared package treats `returned` as a completed resolution (100%)

The shared package's interpretation is correct — a returned order is fully resolved from the user's perspective.

---

## Fix Required

1. **Align backend with shared package:**
   ```typescript
   // In rezbackend/.../src/config/orderStateMachine.ts
   case 'returned': return 100;  // ← Was 0, should be 100
   ```

2. **Ensure all consumers use shared package:**
   ```typescript
   import { getOrderProgress } from '@rez/shared';
   // Delete local getOrderProgress from backend
   ```

3. **Audit all progress calculations:**
   ```javascript
   // Find all getOrderProgress implementations
   grep -r "getOrderProgress" --include="*.ts" .
   ```

---

## Related Gaps

- [CRITICAL-013-order-statuses-out-of-sync](CRITICAL-013-order-statuses-out-of-sync.md) — Same duplicate definition pattern
- [CRITICAL-009-three-payment-fsms](CRITICAL-009-three-payment-fsms.md) — Same root cause: duplicate FSM definitions
