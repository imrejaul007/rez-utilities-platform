# CFG-002: DIAMOND Tier Mapped to 'platinum' in coins.ts — 'diamond' in enums.ts

**Severity:** CRITICAL
**Category:** Config / Enum / Data Integrity
**Gap ID:** CFG-002
**Services Affected:** rez-shared
**Status:** ACTIVE
**Est Fix:** 1 hour
**Related:** HIGH-011 (loyalty tier typo), CFG-FSM-003 (duplicate normalizeLoyaltyTier)

---

## Description

The `LOYALTY_TIER` constant in `coins.ts` maps `DIAMOND: 'platinum'`, treating Diamond tier users as Platinum. The `normalizeLoyaltyTier` function in `enums.ts` correctly maps `DIAMOND: 'diamond'`.

### File A: `rez-shared/src/constants/coins.ts` (lines 123-131)

```typescript
export const LOYALTY_TIER = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  PLATINUM: 'platinum',
  STARTER: 'bronze',
  DIAMOND: 'platinum',     // <-- BUG: Diamond treated as Platinum
  DIMAOND: 'platinum',     // <-- BUG: typo also maps to Platinum
} as const;
```

### File B: `rez-shared/src/enums.ts` (lines 23-31)

```typescript
const tierMap: Record<string, LoyaltyTier> = {
  'BRONZE': 'bronze',
  'SILVER': 'silver',
  'GOLD': 'gold',
  'PLATINUM': 'platinum',
  'STARTER': 'bronze',
  'DIAMOND': 'diamond',    // <-- CORRECT: Diamond is Diamond
  'DIMAOND': 'platinum',    // <-- typo maps to Platinum
};
```

### `normalizeLoyaltyTier` — Two Exports, Two Behaviors

**From `coins.ts` (lines 139-147):**
```typescript
const map: Record<string, LoyaltyTier> = {
  'DIAMOND': 'platinum',    // WRONG
  'DIMAOND': 'platinum',
};
```

**From `enums.ts` (lines 20-31):**
```typescript
const tierMap: Record<string, LoyaltyTier> = {
  'DIAMOND': 'diamond',     // CORRECT
  'DIMAOND': 'platinum',
};
```

### Impact

- Diamond tier users get Platinum benefits instead of Diamond benefits
- `REWARD_REF_DIAMOND_PER` in `rewardConfig.ts` silently returns PLATINUM tier config for Diamond users
- Cashback rates, earning caps, and referral bonuses all use wrong tier
- Diamond is the highest tier — users paying Diamond prices get lower rewards

### Fix Direction

```typescript
// coins.ts — Fix LOYALTY_TIER:
export const LOYALTY_TIER = {
  // ...
  DIAMOND: 'diamond',    // FIX
  DIMAOND: 'diamond',    // FIX: typo maps to correct tier
} as const;

// coins.ts — Fix normalizeLoyaltyTier map:
const map: Record<string, LoyaltyTier> = {
  'DIAMOND': 'diamond',  // FIX
  'DIMAOND': 'diamond',  // FIX: typo maps to Diamond, not Platinum
};

// Remove the duplicate export — use enums.ts normalizeLoyaltyTier everywhere
// OR: consolidate to one shared normalizeLoyaltyTier in coins.ts and delete from enums.ts
```
