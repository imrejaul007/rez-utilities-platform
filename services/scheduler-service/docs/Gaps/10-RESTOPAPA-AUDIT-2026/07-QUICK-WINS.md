# Gen 14 — Quick Wins (12 fixes under 30 minutes)

**Generated:** 2026-04-16 | **Status:** All OPEN

These 12 fixes can be completed in under 30 minutes each and have disproportionately high impact. They address the most deceptive, dangerous, or frequently-hit bugs.

---

| # | Fix | File | Est. | Impact | ID |
|---|-----|------|------|--------|-----|
| 1 | Import `requireAdminAuth` as `requireAdmin` in batchRoutes.ts | `batchRoutes.ts:8` | 5m | Exposes admin auth bypass | RP-C08 |
| 2 | Add `merchantId` to store populate() call | `orderController.ts` | 10m | Fixes admin merchant filter data leak | RP-C15 |
| 3 | Add `voucherCode` + `offerRedemptionCode` to CreateOrderRequest | `ordersApi.ts` | 10m | Enables voucher redemptions | RP-C14 |
| 4 | Wire karma routes instead of 501 stubs | `routes/index.ts` | 15m | Karma service becomes functional | RP-C01 |
| 5 | Uncomment webhook HTTP call in CrossAppSyncService | `CrossAppSyncService.ts:261` | 15m | Merchant-consumer sync restored | RP-C02 |
| 6 | Add idempotency key to referral credit | `ReferralService.ts` | 15m | Prevents double referral credit | RP-C07 |
| 7 | Replace hardcoded `WEEKLY_COIN_CAP = 300` with import | `karmaService.ts` | 5m | Cap no longer silently diverges | RP-H09 |
| 8 | Add client-side min 50 coins validation | `walletApi.ts` | 5m | Users see redemption limit upfront | RP-M25 |
| 9 | Remove duplicate `startOfWeek` computation | `karmaService.ts:195` | 5m | Cleaner code, less maintenance risk | RP-H10 |
| 10 | Add `reconnectionAttempts: 10` to consumer socket | `realTimeService.ts` | 5m | No infinite reconnect loop | RP-M23 |
| 11 | Normalize order confirmation status check | `confirmation.tsx:253` | 5m | Orders don't show confirmed prematurely | RP-L01 |
| 12 | Add circuit breaker to auth middleware | `auth.ts:57` | 15m | Prevents retry storms during auth outages | RP-H15 |

---

## Detailed Instructions

### QW-1: Fix Admin Auth Bypass (5 min)
**File:** `rez-karma-service/src/routes/batchRoutes.ts`

Add to line 8 imports:
```typescript
import { requireAdminAuth as requireAdmin } from '../middleware/adminAuth.js';
```

### QW-2: Fix Admin Merchant Filter (10 min)
**File:** `rezbackend/src/controllers/orderController.ts`

Find the store populate call and add `merchantId`:
```typescript
.populate('store', '_id name logo merchantId')
```

### QW-3: Add Missing Order Fields (10 min)
**File:** `rez-app-consumer/services/ordersApi.ts`

Add to `CreateOrderRequest` interface:
```typescript
voucherCode?: string;
offerRedemptionCode?: string;
```

### QW-4: Wire Karma Routes (15 min)
**File:** `rez-karma-service/src/routes/index.ts`

Replace the 501 stubs with actual routes:
```typescript
import karmaRouter from './karmaRoutes.js';
import verifyRouter from './verifyRoutes.js';
import batchRouter from './batchRoutes.js';

router.use('/api/karma', karmaRouter);
router.use('/api/karma/verify', verifyRouter);
router.use('/api/karma/batch', batchRouter);
```

### QW-5: Restore Webhook Delivery (15 min)
**File:** `Rendez/rendez-backend/src/merchantservices/CrossAppSyncService.ts`

Uncomment and fix the HTTP call around line 261:
```typescript
const response = await axios.post(webhookUrl, { event, data, timestamp: Date.now() });
return response.data;
```

### QW-6: Add Referral Idempotency (15 min)
**File:** `ReferralService.ts`

Add idempotency key:
```typescript
const idempotencyKey = `referral:${referrerId}:${refereeId}:${referralId}`;
```

### QW-7: Import WEEKLY_COIN_CAP (5 min)
**File:** `rez-karma-service/src/services/karmaService.ts`

Replace inline `300` with:
```typescript
import { WEEKLY_COIN_CAP } from '../engines/karmaEngine.js';
```

### QW-8: Client-Side Redemption Validation (5 min)
**File:** `rez-app-consumer/services/walletApi.ts`

Before sending redemption request:
```typescript
if (amount < 50) {
  return { success: false, error: 'Minimum redemption is 50 coins' };
}
```

### QW-9: Remove Duplicate startOfWeek (5 min)
**File:** `rez-karma-service/src/services/karmaService.ts`

Remove the second `startOfWeek` computation at line 195. Use the first computed value.

### QW-10: Add Socket Reconnect Cap (5 min)
**File:** `rez-app-consumer/services/realTimeService.ts`

Add to socket initialization options:
```typescript
reconnectionAttempts: 10
```

### QW-11: Normalize Status Check (5 min)
**File:** `rez-app-consumer/app/order/[storeSlug]/confirmation.tsx:253`

Replace `'paid'` with `'completed'` in the status filter.

### QW-12: Add Auth Circuit Breaker (15 min)
**File:** `rez-karma-service/src/middleware/auth.ts`

Add circuit breaker pattern around auth service calls to prevent retry storms during outages.
