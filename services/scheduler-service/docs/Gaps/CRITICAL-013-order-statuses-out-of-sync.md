# CRITICAL-013: Order Statuses Out of Sync — 14 vs 11 Definitions

## Severity: P1 — Data Consistency / State Machine

## Date Discovered: 2026-04-16
## Phase: Phase 3 — Enum & Status Consistency + Phase 8 — State Machine

---

## Issue Summary

The canonical shared package defines 14 order statuses, but the backend monolith FSM only defines 11. Three statuses (`failed_delivery`, `return_requested`, `return_rejected`) are missing from the backend FSM. Additionally, `getOrderProgress()` returns different values for the `returned` status in each location.

---

## Affected Services

| Service | File | Status Count |
|---------|------|-------------|
| `rez-shared` | `src/orderStatuses.ts` | 14 |
| `rez-backend` (monolith) | `src/config/orderStateMachine.ts` | 11 |
| `rez-order-service` | `src/httpServer.ts` | 9 (hardcoded) |

---

## Code Reference

### Canonical — Shared Package (14 statuses)
**File:** `rez-shared/src/orderStatuses.ts`

```typescript
export const ORDER_STATUSES = [
  'placed', 'confirmed', 'preparing', 'ready', 'dispatched',
  'out_for_delivery', 'failed_delivery', 'delivered', 'cancelling',
  'cancelled', 'return_requested', 'return_rejected', 'returned', 'refunded',
] as const;
// 14 statuses
```

### Backend FSM (11 statuses — missing 3)
**File:** `rezbackend/.../src/config/orderStateMachine.ts`

```typescript
export const ORDER_STATUSES = [
  'placed', 'confirmed', 'preparing', 'ready', 'dispatched',
  'out_for_delivery', 'delivered', 'cancelled', 'cancelling',
  'returned', 'refunded',
] as const;
// 11 statuses — missing: failed_delivery, return_requested, return_rejected
```

### Progress Mismatch — `returned` status
**Shared package:**
```typescript
// rez-shared/src/orderStatuses.ts
export function getOrderProgress(status: string): number {
  // ...
  if (status === 'returned') return 100;  // ← 100% complete
}
```

**Backend:**
```typescript
// rezbackend/.../src/config/orderStateMachine.ts
// returned: 0% — no progress
// Returns 0 for 'returned', treating it as incomplete
```

---

## Impact

- **Orders in `return_requested` / `return_rejected` / `failed_delivery` are invalid in backend FSM** — attempting to transition to these statuses throws FSM errors
- **Progress calculations differ** between frontend (uses shared package) and backend (uses monolith FSM)
- **Frontend shows 100%** for returned orders, backend shows 0%
- **Order filtering fails** — queries for `return_requested` orders may return empty results in monolith
- **Return flow is broken** in the monolith path

---

## Verification

```javascript
// Check if any orders have the missing statuses (from monolith's perspective)
db.orders.find({ status: { $in: ['failed_delivery', 'return_requested', 'return_rejected'] } })
// If count > 0, those orders cannot be processed by backend FSM
```

---

## Fix Required

1. **Align backend FSM with shared package:**
   ```typescript
   // rezbackend/.../src/config/orderStateMachine.ts
   export const ORDER_STATUSES = [
     'placed', 'confirmed', 'preparing', 'ready', 'dispatched',
     'out_for_delivery', 'failed_delivery', 'delivered', 'cancelling',
     'cancelled', 'return_requested', 'return_rejected', 'returned', 'refunded',
   ] as const;
   ```

2. **Add missing transitions:**
   ```typescript
   ORDER_TRANSITIONS: {
     // ... existing transitions
     delivered: ['cancelling', 'return_requested', 'failed_delivery'],
     failed_delivery: ['dispatched', 'cancelled'],  // Retry or cancel
     return_requested: ['return_rejected', 'returned'],
     return_rejected: ['return_requested', 'returned'],  // Can appeal
   }
   ```

3. **Fix progress calculation:**
   ```typescript
   // Backend: update getOrderProgress to match shared package
   if (status === 'returned') return 100;  // Was 0
   ```

4. **Use shared package's FSM exclusively:**
   ```typescript
   import { ORDER_STATUSES, ORDER_TRANSITIONS, getOrderProgress } from '@rez/shared';
   // Delete local definitions from backend
   ```

---

## Related Gaps

- [CRITICAL-009-three-payment-fsms](CRITICAL-009-three-payment-fsms.md) — Same FSM fork pattern
- [CRITICAL-008-dual-authority](CRITICAL-008-dual-authority.md) — Same root cause
- [CRITICAL-016-returned-progress-mismatch](CRITICAL-016-returned-progress-mismatch.md) — Same issue, different scope
