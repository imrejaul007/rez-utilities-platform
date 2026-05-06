# HIGH-010: Coin Type Normalization Lost in Legacy Data

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

The `nuqta` → `rez` legacy coin type mapping exists in `rez-shared` but old transactions with `nuqta` coin type may not be normalized when read from the database. Old transaction records with `nuqta` type can't be queried by `rez` type.

---

## Code Reference

**File:** `rez-shared/src/constants/coins.ts`

```typescript
export const LEGACY_COIN_TYPE_MAP = {
  nuqta: 'rez',
  // Maps old to new, but only for write-time normalization
};

// Reading old records:
const transactions = await Transaction.find({ coinType: 'rez' });
// Old 'nuqta' transactions are MISSING from results
```

---

## Impact

- Old `nuqta` transactions invisible to `rez` queries
- Balance calculations may be wrong for historical data
- User transaction history is incomplete

---

## Fix Required

1. Migration to normalize legacy coin types:
   ```javascript
   db.transactions.updateMany(
     { coinType: 'nuqta' },
     { $set: { coinType: 'rez' } }
   );
   ```

2. Or update queries to include legacy types:
   ```typescript
   const transactions = await Transaction.find({
     coinType: { $in: ['rez', 'nuqta'] }
   });
   ```

---

## Related

- [CRITICAL-008-dual-authority](CRITICAL-008-dual-authority.md)
