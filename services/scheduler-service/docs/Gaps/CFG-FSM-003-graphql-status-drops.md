# CFG-003: GraphQL Status Map Drops `out_for_delivery`, `returned`, `refunded` — Hardcoded 15%/85% Fees

**Severity:** CRITICAL
**Category:** Config / GraphQL / Business Logic
**Gap ID:** CFG-003
**Services Affected:** rezbackend
**Status:** ACTIVE
**Est Fix:** 2 hours
**Related:** CRITICAL-013 (order statuses out of sync), CFG-FSM-001 (FSM duplication)

---

## Description

The GraphQL `statusMap` collapses 3 distinct order states into generic ones. The GraphQL `OrderStatus` enum cannot represent `out_for_delivery`, `returned`, or `refunded`. Additionally, platform fees are hardcoded at 15%/85% instead of using configured values.

### Affected File

`src/config/graphqlSetup.ts` (lines 295-307)

```typescript
const statusMap: Record<string, string> = {
  placed: 'PENDING',
  confirmed: 'CONFIRMED',
  preparing: 'PREPARING',
  ready: 'READY',
  dispatched: 'CONFIRMED',       // <-- dispatched merged into CONFIRMED
  out_for_delivery: 'CONFIRMED', // <-- LOST: out_for_delivery → CONFIRMED
  delivered: 'COMPLETED',
  cancelling: 'CANCELLED',
  cancelled: 'CANCELLED',
  returned: 'CANCELLED',         // <-- LOST: returned → CANCELLED
  refunded: 'CANCELLED',          // <-- LOST: refunded → CANCELLED
};
```

### GraphQL OrderStatus Enum

```typescript
// Only has: PENDING | CONFIRMED | PREPARING | READY | COMPLETED | CANCELLED
// Missing: OUT_FOR_DELIVERY, RETURNED, REFUNDED, FAILED, DISPATCHED
```

### Hardcoded Platform Fees (line 595)

```typescript
platformFee: Math.round(subtotal * 0.15 * 100) / 100,    // 15% hardcoded
merchantPayout: Math.round(subtotal * 0.85 * 100) / 100, // 85% hardcoded
```

This ignores `MERCHANT_COMMISSION_RATE` (2.5%) and `MERCHANT_SETTLEMENT_RATE` from `economicsConfig.ts`. Actual commission should be 2.5% + 18% GST on commission = ~2.95%.

### Impact

- GraphQL queries return `CONFIRMED` for orders that are actually `out_for_delivery` — users see wrong status
- Returned and refunded orders show as `CANCELLED` — users can't distinguish
- Platform fee calculation charges 15% instead of the configured ~2.95% — massive revenue loss
- Merchant payouts are 85% instead of configured ~97.05%

### Fix Direction

```typescript
// Fix statusMap:
const statusMap: Record<string, string> = {
  placed: 'PENDING',
  confirmed: 'CONFIRMED',
  preparing: 'PREPARING',
  ready: 'READY',
  dispatched: 'DISPATCHED',           // ADD: new enum value
  out_for_delivery: 'OUT_FOR_DELIVERY', // ADD: new enum value
  delivered: 'COMPLETED',
  cancelling: 'CANCELLING',
  cancelled: 'CANCELLED',
  returned: 'RETURNED',               // ADD: new enum value
  refunded: 'REFUNDED',               // ADD: new enum value
};

// Fix GraphQL enum:
enum OrderStatus {
  PENDING
  CONFIRMED
  PREPARING
  READY
  DISPATCHED
  OUT_FOR_DELIVERY
  COMPLETED
  CANCELLING
  CANCELLED
  RETURNED
  REFUNDED
}

// Fix platform fee:
import { MERCHANT_COMMISSION_RATE, MERCHANT_SETTLEMENT_RATE } from './economicsConfig';

const commission = subtotal * MERCHANT_COMMISSION_RATE;
const gstOnCommission = commission * 0.18;
const platformFee = commission + gstOnCommission;
const merchantPayout = subtotal - platformFee;
```
