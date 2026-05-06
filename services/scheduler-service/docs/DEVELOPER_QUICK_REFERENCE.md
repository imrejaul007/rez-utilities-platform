# Developer Quick Reference — Restaurant System

## State Machine Validation (Merchant Orders)

### Basic Usage

```typescript
import { isValidMerchantTransition, assertMerchantTransition, getMerchantNextStatuses } from '@/utils/orderStateMachine';

// Check if a transition is allowed
if (isValidMerchantTransition('preparing', 'ready')) {
  // Transition is valid
  await Order.findByIdAndUpdate(orderId, { status: 'ready' });
}

// Get all valid next statuses
const nextStatuses = getMerchantNextStatuses('confirmed');
// Returns: ['preparing']

// Assert transition or throw error
try {
  assertMerchantTransition('placed', 'ready'); // ❌ Throws: skip preparing
} catch (error) {
  console.error(error.message);
  // Output: Invalid merchant status transition: "placed" → "ready". Allowed from "placed": [confirmed]
}
```

### In Express Routes

```typescript
import { isValidMerchantTransition, getMerchantNextStatuses } from '@/utils/orderStateMachine';

router.patch('/:id/status', async (req, res) => {
  const { status, note } = req.body;
  const order = await Order.findById(req.params.id);

  // Validate transition
  if (!isValidMerchantTransition(order.status, status)) {
    const allowed = getMerchantNextStatuses(order.status);
    return res.status(400).json({
      success: false,
      message: `Invalid transition: "${order.status}" → "${status}"`,
      currentStatus: order.status,
      validNextStatuses: allowed,
    });
  }

  // Transition is valid, update order
  const updated = await Order.findByIdAndUpdate(
    req.params.id,
    {
      $set: { status },
      $push: { statusHistory: { status, timestamp: new Date(), note } },
    },
    { new: true }
  );

  res.json({ success: true, data: updated });
});
```

### Merchant-Allowed Transitions

```
confirmed  → preparing
preparing  → ready
ready      → dispatched
dispatched → out_for_delivery
out_for_delivery → delivered
```

**Merchants CANNOT:**
- Skip steps (e.g., confirm → ready)
- Cancel orders
- Revert to previous states
- Go directly to delivered (must go through dispatched)

---

## Offer Validation (Offer Schema Enforcement)

### Basic Usage

```typescript
import { validateOffer, sanitizeOffer, getAllowedFieldsForType } from '@/utils/offerValidator';
import { OfferType } from '@/utils/offerValidator';

const offerData = {
  title: 'Summer Sale',
  offerType: 'discount',
  discountType: 'percentage',
  discountValue: 20,
  startDate: new Date('2026-04-10'),
  endDate: new Date('2026-04-30'),
  minOrderAmount: 500,
  isActive: true,
};

// Validate
const { isValid, errors } = validateOffer(offerData);
if (!isValid) {
  console.error('Validation errors:', errors);
  return res.status(400).json({ errors });
}

// Sanitize (remove unexpected fields)
const clean = sanitizeOffer(offerData);
// Result: only allowed fields for 'discount' type

// Get allowed fields for a type
const allowed = getAllowedFieldsForType(OfferType.DISCOUNT);
// Returns: ['title', 'description', 'discountType', 'discountValue', ...]
```

### Validation in Routes

```typescript
import { validateOffer, sanitizeOffer } from '@/utils/offerValidator';

router.post('/offers', async (req, res) => {
  const { isValid, errors } = validateOffer(req.body);

  if (!isValid) {
    return res.status(400).json({
      success: false,
      errors,
      message: 'Offer validation failed',
    });
  }

  // Remove any unexpected fields
  const cleanOffer = sanitizeOffer(req.body);

  // Create offer
  const offer = await Offer.create({
    ...cleanOffer,
    merchant: req.merchantId,
  });

  res.json({ success: true, data: offer });
});
```

### Supported Offer Types

| Type | Required Fields | Notes |
|---|---|---|
| `DISCOUNT` | title, discountType, discountValue, startDate, endDate | % or fixed amount |
| `CASHBACK` | title, cashbackType, cashbackValue, startDate, endDate | Coin rewards |
| `DEAL` | title, discountValue, startDate, endDate | Product-specific deal |
| `FLASH_SALE` | title, discountValue, startDate, endDate | Time-limited sale |
| `LOYALTY` | title, startDate, endDate | Member rewards |
| `GIFT_CARD` | title, startDate, endDate | Prepaid balance |
| `VOUCHER` | title, startDate, endDate | Code-based discount |
| `DYNAMIC_PRICING` | title, startDate, endDate | Time/demand-based |

---

## Common Patterns

### 1. Complete Order Status Flow (For Reference)

```typescript
// 1. Customer creates order → 'placed'
const order = await Order.create({
  orderNumber: generateOrderNumber(),
  status: 'placed',
  user: customerId,
  items: [...],
  payment: { method: 'razorpay', status: 'awaiting_payment' },
});

// 2. Customer completes payment → order ready for merchant
// (Status stays 'placed' until merchant confirms)

// 3. Merchant receives notification, reviews order
// Can accept → 'confirmed' or reject → 'cancelled'

await Order.findByIdAndUpdate(orderId, {
  status: 'confirmed',
  $push: { statusHistory: { status: 'confirmed', timestamp: new Date() } }
});

// 4. Kitchen staff see order in KDS (Kitchen Display System)
// Merchant moves: preparing → ready → dispatched → out_for_delivery → delivered

// 5. After delivery, customer can:
// - Leave rating (stays 'delivered')
// - Return items → 'returned' → eventually 'refunded'
```

### 2. Handling Invalid Transitions

```typescript
// ❌ BAD: Don't allow arbitrary transitions
status: req.body.status // Could be anything!

// ✅ GOOD: Validate against state machine
const { isValidMerchantTransition, getMerchantNextStatuses } = require('./orderStateMachine');

if (!isValidMerchantTransition(currentStatus, newStatus)) {
  const validNext = getMerchantNextStatuses(currentStatus);
  throw new AppError(
    `Cannot move from ${currentStatus} to ${newStatus}. Valid options: ${validNext.join(', ')}`,
    400,
    'INVALID_TRANSITION'
  );
}
```

### 3. Monitoring SLA Breaches

```typescript
import { SLA_THRESHOLDS } from '@/utils/orderStateMachine';

const checkSLABreach = (order) => {
  const threshold = SLA_THRESHOLDS[order.status];
  if (!threshold) return false; // Terminal status

  const minutesElapsed = (Date.now() - order.createdAt) / 60000;
  return minutesElapsed > threshold;
};

// In KDS, use this to highlight orders in red
const isBreached = checkSLABreach(order);
// Use for timer color: isBreached ? 'red' : 'amber'
```

### 4. Offer Creation Checklist

```typescript
// Before creating an offer:
const offersCheckList = {
  hasTitle: !!offer.title,
  hasValidType: Object.values(OfferType).includes(offer.offerType),
  hasValidDates: new Date(offer.startDate) < new Date(offer.endDate),
  isTypeComplete: validateOffer(offer).isValid,
  hasNoUnexpectedFields: sanitizeOffer(offer) === offer,
};

const allChecksPassed = Object.values(offersCheckList).every(Boolean);
if (!allChecksPassed) {
  throw new Error('Offer validation failed');
}
```

---

## Testing Tips

### Unit Test: State Machine

```typescript
import { isValidMerchantTransition } from '@/utils/orderStateMachine';

describe('Order State Machine', () => {
  it('should allow confirmed → preparing', () => {
    expect(isValidMerchantTransition('confirmed', 'preparing')).toBe(true);
  });

  it('should reject confirmed → delivered (skip steps)', () => {
    expect(isValidMerchantTransition('confirmed', 'delivered')).toBe(false);
  });

  it('should reject placed → preparing (not allowed for merchants)', () => {
    expect(isValidMerchantTransition('placed', 'preparing')).toBe(false);
  });
});
```

### Unit Test: Offer Validation

```typescript
import { validateOffer } from '@/utils/offerValidator';

describe('Offer Validation', () => {
  it('should validate correct discount offer', () => {
    const { isValid } = validateOffer({
      title: 'Sale',
      offerType: 'discount',
      discountType: 'percentage',
      discountValue: 20,
      startDate: new Date('2026-04-10'),
      endDate: new Date('2026-04-30'),
      isActive: true,
    });
    expect(isValid).toBe(true);
  });

  it('should reject offer with missing required fields', () => {
    const { isValid, errors } = validateOffer({
      title: 'Sale',
      offerType: 'discount',
      // Missing discountType, discountValue, dates
    });
    expect(isValid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should catch startDate > endDate', () => {
    const { isValid, errors } = validateOffer({
      title: 'Bad Sale',
      offerType: 'discount',
      discountType: 'percentage',
      discountValue: 20,
      startDate: new Date('2026-04-30'),
      endDate: new Date('2026-04-10'), // End before start!
      isActive: true,
    });
    expect(isValid).toBe(false);
    expect(errors.some(e => e.includes('startDate'))).toBe(true);
  });
});
```

---

## Troubleshooting

### "Invalid merchant status transition"

**Cause:** Trying to move order from state A → B, but merchant can only move A → C

**Solution:** Check `getMerchantNextStatuses(currentStatus)` to see valid options

**Example:**
```typescript
// ❌ Error: placed → preparing (not in merchant transitions)
// ✅ Correct: placed → confirmed → preparing
```

### Offer validation rejecting valid data

**Cause:** Unknown field in offer document, or type mismatch

**Solution:** Use `sanitizeOffer()` to remove unexpected fields

**Example:**
```typescript
const dirty = {
  title: 'Sale',
  offerType: 'discount',
  discountValue: 20,
  unknownField: 'spam', // ← Will trigger warning
};

const clean = sanitizeOffer(dirty);
// unknownField is removed, validation passes
```

### Category cache not invalidating across pods

**Cause:** Changes made on pod A, but pod B still using stale cache

**Solution:** Publish to Redis pub/sub on admin updates

```typescript
await redisService.publish('cache:invalidate', JSON.stringify({
  key: 'category-root-map'
}));
```

---

## Performance Notes

### Order Creation (11 DB queries)

- ✅ Product revalidation: Batched (1 query instead of N)
- ✅ SmartSpend lookup: Batched (1 query instead of N)
- ✅ Coin balance: Cached in Wallet object
- ⚠️ Could optimize further: Combine wallet read + write

### KDS Real-Time

- ✅ Socket.IO broadcasts order updates
- ✅ Each merchant only receives orders for their stores
- ⚠️ Monitor connection count for memory leaks
- ⚠️ Test with 1000+ concurrent KDS clients

### Offer Validation

- ✅ Runs at API layer (before DB write)
- ⏱️ Negligible overhead (~1-2 ms per offer)
- ✅ Prevents invalid data at source

---

## Links & References

- **State Machine:** [rez-merchant-service/src/utils/orderStateMachine.ts](../rez-merchant-service/src/utils/orderStateMachine.ts)
- **Offer Validator:** [rez-merchant-service/src/utils/offerValidator.ts](../rez-merchant-service/src/utils/offerValidator.ts)
- **Architecture Docs:** [docs/RESTAURANT_SYSTEM_ARCHITECTURE.md](./RESTAURANT_SYSTEM_ARCHITECTURE.md)
- **Integration Tests:** [tests/integration/orderFlow.integration.test.ts](../tests/integration/orderFlow.integration.test.ts)
- **Merchant Orders Route:** [rez-merchant-service/src/routes/orders.ts](../rez-merchant-service/src/routes/orders.ts)
- **KDS Component:** [rez-merchant/app/kds/index.tsx](../rezmerchant/rez-merchant-master/app/kds/index.tsx)

---

## Support

For questions or issues with the state machine or offer validation:

1. Check the comprehensive docs: [RESTAURANT_SYSTEM_ARCHITECTURE.md](./RESTAURANT_SYSTEM_ARCHITECTURE.md)
2. Run integration tests for reference: `npm test -- orderFlow.integration.test.ts`
3. Review code comments in utility files
4. Check Linear project "INGEST" for related issues
