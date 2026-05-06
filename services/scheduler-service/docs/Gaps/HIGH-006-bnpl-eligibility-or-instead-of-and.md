# HIGH-006: BNPL Eligibility Uses OR Instead of AND — Wrong Logic

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

BNPL eligibility check uses OR instead of AND: a user is rejected if they have a wallet balance OR if they have zero orders. Should be: must have low balance AND minimum order history.

---

## Code Reference

**File:** `rez-finance-service/src/services/bnplService.ts:79`

```typescript
// WRONG — OR logic
const eligible = walletBalance < minRepayment || orderCount === 0;

// This rejects:
// - Users with low balance AND history (should be eligible)
// - Users with no balance but orders (should be ineligible)

// CORRECT — AND logic
const eligible = walletBalance < minRepayment && orderCount >= minOrderCount;
```

---

## Impact

- Eligible users rejected from BNPL
- Eligible users can't access buy-now-pay-later
- Revenue loss from declined conversions

---

## Fix Required

```typescript
const eligible = walletBalance < minRepayment && orderCount >= minOrderCount;
```

---

## Related

- [CRITICAL-015-silent-coin-failure](CRITICAL-015-silent-coin-failure.md)
