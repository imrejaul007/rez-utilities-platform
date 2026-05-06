# HIGH-008: Order Service Zod Schemas Never Applied to Routes

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

Zod validation schemas are defined in the order service for payment statuses and order creation, but they are never applied to any route. Invalid data can enter the system without validation.

---

## Code Reference

**File:** `rez-order-service/src/httpServer.ts`

```typescript
// Schema defined but NEVER used:
const ORDER_PAYMENT_STATUSES = ['pending', 'awaiting_payment', 'processing',
  'authorized', 'paid', 'partially_refunded', 'failed', 'refunded'];

// createOrderSchema defined but never applied to any POST /orders route
const createOrderSchema = z.object({ /* ... */ });
```

---

## Impact

- No input validation on order creation
- Invalid payment statuses can be written
- Schema drift from what the code "intends" vs what it actually accepts

---

## Fix Required

Apply schemas to routes:
```typescript
router.post('/orders',
  validateBody(createOrderSchema),
  async (req, res) => { /* handler */ }
);
```

---

## Related

- [CRITICAL-013-order-statuses-out-of-sync](CRITICAL-013-order-statuses-out-of-sync.md)
