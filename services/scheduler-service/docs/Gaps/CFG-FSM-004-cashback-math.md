# CFG-004: Cashback Validation Multiplies Rate by 100 — Rate Is Already a Percentage

**Severity:** CRITICAL
**Category:** Config / Math / Business Logic
**Gap ID:** CFG-004
**Services Affected:** rezbackend
**Status:** ACTIVE
**Est Fix:** 1 hour

---

## Description

`validateMerchantCashback` multiplies `merchantMaxRate` by 100 when the rate is already a percentage (0-100). The comparison `rate > 20` where `rate=0.15` always evaluates to `false` — the validation is broken.

### Affected File

`src/config/rewardConfig.ts` (lines 243-254)

```typescript
export function validateMerchantCashback(rate: number): { isValid: boolean; error?: string } {
  if (rate < 0 || rate > 100) {
    return { isValid: false, error: `Cashback rate must be 0-100, got ${rate}` };
  }
  if (rate > CASHBACK_CONFIG.merchantMaxRate * 100) {
    // merchantMaxRate is 0.20
    // So this checks: rate > 0.20 * 100 = 20
    // If rate = 0.15 (decimal): 0.15 > 20? FALSE (always passes)
    // If rate = 15 (percentage): 15 > 20? FALSE (allows up to 20%)
    return {
      isValid: false,
      error: `Cashback ${rate}% exceeds max allowed ${CASHBACK_CONFIG.merchantMaxRate * 100}%`,
      // Printf shows "20%" — misleading if rate was passed as decimal
    };
  }
  return { isValid: true };
}
```

The function accepts rates from 0-100 (enforced by first check), meaning `merchantMaxRate` is compared against `0.20 * 100 = 20`. The guard is:
- `rate=15` (percentage): `15 > 20` → false → passes ✓
- `rate=0.15` (decimal): `0.15 > 20` → false → passes ✓ (but wrong intent)
- `rate=25` (percentage): `25 > 20` → true → blocked ✓

If `rate` can be passed as decimal (0.02 = 2%), then `0.02 > 20` is false — the guard never fires.

### Impact

- If rates are passed as decimals: `merchantMaxRate` guard never fires
- A merchant could set 100% cashback if rate is 1.0 (100%)
- The validation message prints `merchantMaxRate * 100` which is always `20` — confusing if rate was decimal

### Fix Direction

```typescript
export function validateMerchantCashback(rate: number): { isValid: boolean; error?: string } {
  // Normalize: if rate looks like a decimal (<= 1), convert to percentage
  const rateAsPercent = rate <= 1 ? rate * 100 : rate;

  if (rateAsPercent < 0 || rateAsPercent > 100) {
    return { isValid: false, error: `Cashback rate must be 0-100, got ${rate}` };
  }

  const maxPercent = CASHBACK_CONFIG.merchantMaxRate <= 1
    ? CASHBACK_CONFIG.merchantMaxRate * 100
    : CASHBACK_CONFIG.merchantMaxRate;

  if (rateAsPercent > maxPercent) {
    return {
      isValid: false,
      error: `Cashback ${rateAsPercent.toFixed(2)}% exceeds max allowed ${maxPercent}%`,
    };
  }

  return { isValid: true };
}
```

Or standardize all rates to decimal format (0.0-1.0) and remove all `* 100` multipliers.
