# CRITICAL-008: Dual Authority — Every Entity Has 2+ Concurrent Writers

## Severity: P0 — Architecture / Data Consistency

## Date Discovered: 2026-04-16
## Phase: Phase 1 — Architecture Mapping + Phase 8 — State Machine Validation

---

## Issue Summary

Both the backend monolith and extracted microservices write to the **same MongoDB collections** concurrently. There is no database-level isolation, no ownership assignment, and no coordination mechanism. Every entity can be modified by multiple services simultaneously.

---

## Affected Services — All of Them

| Service | Collections Written |
|---------|---------------------|
| `rez-backend` (monolith) | orders, payments, wallets, users, merchants, products, karma_events, settlements, etc. |
| `rez-payment-service` | payments |
| `rez-wallet-service` | wallets, transactions |
| `rez-order-service` | orders |
| `rez-merchant-service` | orders (merchant fields), settlements |
| `rez-catalog-service` | products, categories, inventory |
| `rez-karma-service` | karma_profiles, karma_events |
| `rez-notification-events` | notifications |
| `rez-finance-service` | BNPL records, rewards |

---

## Problematic Collections

```javascript
// Every one of these collections has 2+ services writing to it
db.orders.getClusteringRole()        // Multiple writers
db.payments.getClusteringRole()      // monolith + payment-service
db.wallets.getClusteringRole()       // monolith + wallet-service
db.products.getClusteringRole()      // monolith + catalog-service
db.settlements.getClusteringRole()   // monolith + merchant-service
```

### Specific Dual-Write Conflicts

| Collection | Monolith Writes | Service Writes | Conflict |
|-----------|----------------|----------------|---------|
| `orders` | All fields | Status updates, payment info | Field-level overwrites |
| `payments` | `status`, `method` | `status`, `transactionId` | Status race conditions |
| `wallets` | Balance on purchase | Balance on withdrawal | TOCTOU race |
| `orders.merchant` vs `merchantId` | Writes `merchantId` | Queries `merchant` | Settlement blind spot |

---

## Code Reference

**Monolith — writes to payments:**
```typescript
// rezbackend/.../src/services/paymentService.ts
await Payment.findByIdAndUpdate(paymentId, {
  status: 'completed',
  transactionId: razorpayPayment.id
});
```

**Payment Service — also writes to payments:**
```typescript
// rez-payment-service/src/services/paymentService.ts
await Payment.findByIdAndUpdate(paymentId, {
  status: 'completed',
  razorpayPaymentId: razorpayPayment.id,
  walletCredited: true
});
```

---

## Impact

- **Lost updates** — last-write-wins with no coordination
- **Inconsistent state** — one service overwrites another's changes
- **Settlement discrepancies** — as in CRITICAL-001
- **Wallet overdrafts** — as in CRITICAL-003
- **Payment state races** — FSM violations from concurrent transitions
- **Impossible to debug** — which service last wrote a field?

---

## Root Cause

The **strangler fig pattern** was applied incorrectly. Extractors copied business logic OUT of the monolith into services, but did NOT remove that logic from the monolith. The MongoDB cluster was shared to avoid migration complexity. There is no cutover mechanism — shadow mode runs indefinitely.

---

## Fix Required

This is an architectural issue requiring phased resolution:

### Phase 1: Assign Ownership (Immediate)
Create an **entity ownership map** and enforce it via code:

```typescript
// In rez-shared/src/constants/entityOwnership.ts
export const ENTITY_OWNERSHIP = {
  orders: 'rez-order-service',
  payments: 'rez-payment-service',
  wallets: 'rez-wallet-service',
  products: 'rez-catalog-service',
  karma_profiles: 'rez-karma-service',
  // etc.
} as const;

// Enforce at middleware level — reject writes from non-owners
```

### Phase 2: Event Sourcing with Conflict Resolution
Replace direct writes with event log:

```typescript
// All mutations go through an event bus
await eventBus.emit({
  entity: 'payment',
  entityId: paymentId,
  action: 'status_changed',
  payload: { from: 'pending', to: 'completed' },
  source: 'payment-service',  // Must match ENTITY_OWNERSHIP
  timestamp: Date.now()
});
```

### Phase 3: Database Isolation
Move each service to its own database/collection prefix:

```javascript
// Payment service: rez_payment_{env}.payments
// Order service: rez_order_{env}.orders
// etc.
```

### Phase 4: Cutover
Implement a feature flag-based cutover from monolith to service for each entity.

---

## Related Gaps

- [CRITICAL-001-settlement-blind-spot](CRITICAL-001-settlement-blind-spot.md) — Direct consequence
- [CRITICAL-003-merchant-withdrawal-race-condition](CRITICAL-003-merchant-withdrawal-race-condition.md) — Direct consequence
- [CRITICAL-009-three-payment-fsms](CRITICAL-009-three-payment-fsms.md) — Same root cause
- [CRITICAL-013-order-statuses-out-of-sync](CRITICAL-013-order-statuses-out-of-sync.md) — Same root cause
