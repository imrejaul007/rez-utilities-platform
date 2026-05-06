# CRITICAL-003: Merchant Withdrawal TOCTOU Race Condition

## Severity: P0 — Financial / Race Condition

## Date Discovered: 2026-04-16
## Phase: Phase 6 — Business Logic Consistency

---

## Issue Summary

The merchant withdrawal operation performs a non-atomic check-then-update pattern. Concurrent withdrawal requests can both pass the balance check simultaneously, resulting in overdrafts. This is a textbook Time-Of-Check-Time-Of-Use (TOCTOU) vulnerability.

---

## Affected Services

| Service | Impact |
|---------|--------|
| `rez-wallet-service` | Merchant wallet withdrawals can overdraft |

---

## Code Reference

**File:** `rez-wallet-service/src/services/merchantWalletService.ts:121-164`

```typescript
// STEP 1: Read current balance (non-atomic)
const wallet = await MerchantWallet.findOne({ merchantId });

// STEP 2: Check balance (both concurrent requests pass this check)
if (wallet.availableBalance < amount) {
  throw new Error('Insufficient balance');
}

// STEP 3: Update balance (both writes succeed, wallet goes negative)
// Gap between step 1-2 and step 3 allows race
await MerchantWallet.findOneAndUpdate(
  { merchantId, availableBalance: { $gte: amount } },
  { $inc: { availableBalance: -amount } }
);
```

### Concurrent Execution Scenario

```
Request A: reads balance = 1000
Request B: reads balance = 1000
Request A: balance check passes (1000 >= 800)
Request B: balance check passes (1000 >= 800)
Request A: withdraws 800 → balance = 200
Request B: withdraws 800 → balance = 200 (should be -600)

Result: Wallet is 200 instead of -600. Merchant has 800 extra coins.
```

Note: The `findOneAndUpdate` with `$gte` filter provides some protection, but the balance check in application code (step 2) is the real vulnerability — it gives the appearance of safety while the actual atomic update can race.

---

## Impact

- Merchant wallets can be overdrawn
- Financial reconciliation will reveal discrepancies
- Attackers could exploit this for coin theft
- The `$gte` filter in the atomic update provides a partial safeguard but is insufficient

---

## Root Cause

The withdrawal flow was written with a check in application code followed by a separate update. This is a classic split-operation anti-pattern. MongoDB's `findOneAndUpdate` with a conditional filter can atomically enforce the balance check within a single operation.

---

## Fix Required

Replace the non-atomic pattern with a fully atomic operation:

```typescript
// Single atomic operation — balance check is enforced by MongoDB
const result = await MerchantWallet.findOneAndUpdate(
  {
    merchantId,
    availableBalance: { $gte: amount }  // Atomic balance check
  },
  {
    $inc: { availableBalance: -amount },
    $push: {
      transactions: {
        type: 'debit',
        amount,
        balanceAfter: availableBalance - amount,  // computed
        timestamp: new Date()
      }
    }
  },
  { returnDocument: 'after' }
);

if (!result) {
  throw new Error('Insufficient balance or wallet not found');
}
```

Also add a post-update invariant check:
```typescript
if (result.availableBalance < 0) {
  // Log critical alert — should never happen with atomic update
  logger.critical('MERCHANT_WALLET_OVERDRAFT', { merchantId, amount });
}
```

---

## Related Gaps

- [CRITICAL-008-dual-authority](CRITICAL-008-dual-authority.md) — Dual writes could cause additional race conditions
- [CRITICAL-001-settlement-blind-spot](CRITICAL-001-settlement-blind-spot.md) — Same wallet, different query field
