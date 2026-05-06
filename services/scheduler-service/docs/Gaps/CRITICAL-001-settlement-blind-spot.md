# CRITICAL-001: Settlement Blind Spot — Merchant Field vs MerchantId Field Mismatch

## Severity: P0 — Revenue Leak

## Date Discovered: 2026-04-16
## Phase: Phase 6 — Business Logic Consistency + Settlement Logic

---

## Issue Summary

The merchant settlement service queries orders by the `merchant` field, but the backend monolith writes `merchantId`. This means all orders placed through the monolith are **completely invisible** to settlement calculations. Merchants are systematically underpaid.

---

## Affected Services

| Service | Role |
|---------|------|
| `rez-merchant-service` | Settlement queries |
| `rezbackend/rez-backend-master` | Order creation (monolith) |

---

## Code References

### Merchant Service — Settlement Query
**File:** `rez-merchant-service/src/services/settlementService.ts:49`

```typescript
const orders = await Order.find({
  merchant: merchantId,  // ← Queries 'merchant' field
  status: 'delivered',
  settlementStatus: 'pending',
  createdAt: { $gte: startDate, $lte: endDate }
});
```

### Monolith — Order Creation
**File:** `rezbackend/rez-backend-master/src/models/Order.ts`

```typescript
merchantId: {
  type: String,
  required: true,
  index: true
}
// Writes: { merchantId: "MCH_xxx" }
```

---

## Impact

- **ALL monolith orders** (the majority of orders) are excluded from settlement
- Merchant earnings are systematically undercalculated
- No audit trail of missed settlements
- The longer shadow mode runs, the larger the gap grows

---

## Root Cause

The merchant service was extracted as a microservice but the monolith retains `merchantId` field naming. The settlement service was written to match a hypothetical service-based schema (`merchant`) rather than the actual monolith schema (`merchantId`).

---

## Verification Query

```javascript
// Check for orders with merchantId that don't appear in settlement
db.orders.find({ 
  merchantId: { $exists: true },
  merchant: { $exists: false },
  status: 'delivered'
}).count()

// Check if any orders have the 'merchant' field at all
db.orders.find({ merchant: { $exists: true } }).count()
```

---

## Fix Required

1. Change settlement query to use `merchantId` field:
   ```typescript
   const orders = await Order.find({
     merchantId: merchantId,  // ← Match actual monolith field
     status: 'delivered',
     settlementStatus: 'pending',
     createdAt: { $gte: startDate, $lte: endDate }
   });
   ```

2. Create a migration to backfill `merchant` from `merchantId` for any orders that may have been written with both fields

3. Add a reconciliation report comparing `merchantId`-based vs `merchant`-based queries

---

## Related Gaps

- [CRITICAL-008-dual-authority](CRITICAL-008-dual-authority.md) — Root cause: dual authority enabled this
- [CRITICAL-009-three-payment-fsms](CRITICAL-009-three-payment-fsms.md) — Same extraction pattern caused FSM forks
