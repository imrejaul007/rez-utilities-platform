# HIGH-011: Loyalty Tier Has 'DIMAOND' Typo — Broken Tier Matching

## Severity: HIGH
## Date Discovered: 2026-04-16

---

## Issue Summary

The `LoyaltyTier` normalization in `rez-shared` corrects the typo `'DIMAOND'` → `'platinum'`, but if the database has `'DIMAOND'` stored, queries for `'diamond'` tier won't match it.

---

## Code Reference

**File:** `rez-shared/src/constants/coins.ts`

```typescript
const LoyaltyTier = {
  DIMAOND: 'platinum',  // Typo correction — DIMAOND → platinum
  // Missing: diamond: 'diamond' mapping
};

// DB has: { loyaltyTier: 'DIMAOND' }
// Query for: 'diamond' tier — NO MATCH
```

---

## Impact

- Users with 'diamond' in DB aren't matched by 'diamond' tier queries
- Tier-based feature gating fails for affected users
- Gamification rewards based on tier may skip these users

---

## Fix Required

```typescript
const LoyaltyTier = {
  DIMAOND: 'platinum',  // Fix typo
  diamond: 'diamond',    // Add mapping
  platinum: 'platinum',
  gold: 'gold',
  silver: 'silver',
};

export function normalizeTier(tier: string): string {
  return LoyaltyTier[tier.toUpperCase()] ?? tier.toLowerCase();
}
```

---

## Related

- [CRITICAL-013-order-statuses-out-of-sync](CRITICAL-013-order-statuses-out-of-sync.md)
