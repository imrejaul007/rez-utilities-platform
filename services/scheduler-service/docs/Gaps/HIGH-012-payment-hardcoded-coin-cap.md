# HIGH-012: Payment Service Hardcodes Coin Cap at 10,000

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

The payment service caps coins at 10,000 per transaction with `Math.min(Math.floor(payment.amount), 10000)`. This hardcoded cap diverges from any configurable limit and applies even for large purchases that should earn more.

---

## Code Reference

**File:** `rez-payment-service/src/services/paymentService.ts`

```typescript
const coinsToCredit = Math.min(Math.floor(payment.amount), 10000);
// A ₹50,000 purchase earns only 10,000 coins instead of 50,000
// No environment variable to adjust this cap
```

---

## Impact

- High-value users get capped coin rewards
- Incentive misalignment for premium purchases
- No configurable cap per shared package

---

## Fix Required

Move to shared package config:
```typescript
import { MAX_COINS_PER_TRANSACTION } from '@rez/shared';
const coinsToCredit = Math.min(
  Math.floor(payment.amount * COIN_TO_INR_RATE),
  MAX_COINS_PER_TRANSACTION
);
```

---

## Related

- [CRITICAL-010-coin-rate-divergence](CRITICAL-010-coin-rate-divergence.md)
