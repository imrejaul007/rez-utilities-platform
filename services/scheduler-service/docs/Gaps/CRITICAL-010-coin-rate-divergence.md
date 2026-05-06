# CRITICAL-010: Coin Rate Divergence — Payment Service Hardcodes 1:1, Wallet Service Uses Env Var

## Severity: P1 — Business Logic / Financial Consistency

## Date Discovered: 2026-04-16
## Phase: Phase 4 — API Contract Validation + Phase 6 — Business Logic

---

## Issue Summary

The coin-to-INR conversion rate is defined in two places with different values:
- **Payment service** hardcodes `1:1` (1 INR = 1 coin)
- **Wallet service** reads from `COIN_TO_INR_RATE` environment variable

During shadow mode, the same payment can result in different coin amounts depending on which service processes it.

---

## Affected Services

| Service | Rate Source | Value |
|---------|-----------|-------|
| `rez-payment-service` | Hardcoded | `1:1` (always) |
| `rez-wallet-service` | Env var `COIN_TO_INR_RATE` | Configurable |

---

## Code Reference

### Payment Service — Hardcoded
**File:** `rez-payment-service/src/services/paymentService.ts`

```typescript
async creditWalletAfterPayment(payment: Payment) {
  const coinsToCredit = Math.min(Math.floor(payment.amount), 10000);
  //                              ↑ Hardcoded 1:1 rate
  //                              ↑ 10000 coin cap
  await walletService.credit(userId, coinsToCredit, 'purchase');
}
```

### Wallet Service — Environment Variable
**File:** `rez-wallet-service/src/services/walletService.ts`

```typescript
const COIN_TO_INR_RATE = parseFloat(process.env.COIN_TO_INR_RATE || '1');
// If env var changes, rate changes for wallet operations
// But payment service always uses 1:1 regardless of this value
```

---

## Impact

- **Inconsistent coin awards** — same payment credited differently depending on processing path
- **Hardcoded cap** — payment service caps at 10,000 coins; wallet service has no cap
- **Rate drift** — if `COIN_TO_INR_RATE` is changed in wallet service, payment service ignores it
- **User confusion** — users see different coin amounts for the same spend
- **Accounting discrepancies** — total coins issued differs from expected

---

## Root Cause

The payment service was extracted early when the rate was assumed to be 1:1. The wallet service was designed to be configurable. The two were never synchronized.

---

## Verification

```javascript
// Same ₹500 payment
// Via payment service: 500 coins (hardcoded 1:1)
// Via wallet service directly: 500 * COIN_TO_INR_RATE coins

// If COIN_TO_INR_RATE = 0.5 (future promotion):
// Payment service credits: 500 coins (wrong)
// Wallet service would credit: 250 coins (correct per new rate)
```

---

## Fix Required

1. **Define canonical rate in shared package:**
   ```typescript
   // rez-shared/src/constants/coins.ts
   export const COIN_TO_INR_RATE = parseFloat(process.env.COIN_TO_INR_RATE || '1');
   ```

2. **Both services import from shared package:**
   ```typescript
   import { COIN_TO_INR_RATE } from '@rez/shared';
   const coinsToCredit = Math.floor(payment.amount * COIN_TO_INR_RATE);
   ```

3. **Remove hardcoded cap from payment service** OR define it centrally:
   ```typescript
   import { MAX_COINS_PER_TRANSACTION } from '@rez/shared';
   const coinsToCredit = Math.min(
     Math.floor(payment.amount * COIN_TO_INR_RATE),
     MAX_COINS_PER_TRANSACTION
   );
   ```

4. **Validate rate on startup:**
   ```typescript
   if (isNaN(COIN_TO_INR_RATE) || COIN_TO_INR_RATE <= 0) {
     throw new Error('COIN_TO_INR_RATE must be a positive number');
   }
   ```

---

## Related Gaps

- [CRITICAL-008-dual-authority](CRITICAL-008-dual-authority.md) — Same root cause
- [CRITICAL-011-internal-service-key-unvalidated](CRITICAL-011-internal-service-key-unvalidated.md) — Same pattern of env var misuse
