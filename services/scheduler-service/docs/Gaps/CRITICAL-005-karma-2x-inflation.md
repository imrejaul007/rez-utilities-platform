# CRITICAL-005: Karma 2x Inflation — Double Increment on Same Event

## Severity: P0 — Business Logic / Data Integrity

## Date Discovered: 2026-04-16
## Phase: Phase 6 — Business Logic Consistency

---

## Issue Summary

Karma points are incremented **twice** for every qualifying action through two separate code paths:
1. `updateProfileStats()` in `earnRecordService.ts`
2. `karmaService.recordKarmaEarned()` → `addKarma()` in `karmaService.ts`

---

## Affected Services

| Service | Impact |
|---------|--------|
| `rez-karma-service` | All karma-earning events credit double points |

---

## Code Reference

### Path 1 — earnRecordService.ts
**File:** `rez-karma-service/src/services/earnRecordService.ts`

```typescript
// Called when an earn record is created
async function updateProfileStats(userId: string, karmaAmount: number) {
  // ...
  await KarmaProfile.findOneAndUpdate(
    { userId },
    { $inc: { totalKarma: karmaAmount } }  // ← FIRST increment
  );
}
```

### Path 2 — karmaService.ts (redundant)
**File:** `rez-karma-service/src/services/karmaService.ts`

```typescript
// In recordKarmaEarned():
async function recordKarmaEarned(userId: string, karmaAmount: number) {
  // ...
  await addKarma(userId, karmaAmount);  // ← SECOND increment (duplicate)
}

async function addKarma(userId: string, amount: number) {
  await KarmaProfile.findOneAndUpdate(
    { userId },
    { $inc: { totalKarma: amount } }  // ← Increments AGAIN
  );
}
```

### Call Chain

```
User action (order placed, review written, etc.)
  ↓
earnRecordService.createEarnRecord()
  ├── karmaService.recordKarmaEarned()
  │     └── addKarma()                    ← INCREMENT #1
  └── updateProfileStats()                 ← INCREMENT #2 (same karmaAmount)
```

---

## Impact

- Every karma-earning action credits **2x the intended amount**
- Loyalty tier calculations are wrong
- Gamification rewards are inflated
- Leaderboards are distorted
- Historical karma totals are permanently incorrect
- BNPL eligibility and credit scoring may be affected

---

## Root Cause

The karma service was likely refactored and `updateProfileStats()` was kept as a legacy entry point while `recordKarmaEarned()` was added as a new path. Both paths were left active without removing the redundant increment.

---

## Verification

```javascript
// Place an order and verify karma increment
// Before fix: +20 karma (intended +10, doubled)
// After fix: +10 karma
```

```javascript
// Check for duplicate increments in recent karma events
db.karma_events.find({}).sort({createdAt: -1}).limit(10)
// Look for multiple events for same actionId
```

---

## Fix Required

1. **Identify which path is the intended one** — review the codebase to determine which call path is the authoritative source
2. **Remove the redundant increment** — disable `updateProfileStats()` karma increment OR disable `recordKarmaEarned()` in the earn record flow
3. **Fix historical data** — run a correction query:
   ```javascript
   // Halve all karma totals (requires careful analysis of audit log)
   db.karma_profiles.find().forEach(profile => {
     db.karma_profiles.updateOne(
       { _id: profile._id },
       { $set: { totalKarma: Math.floor(profile.totalKarma / 2) } }
     );
   });
   ```
4. **Add integration test** to prevent regression

---

## Related Gaps

- [CRITICAL-017-karma-wont-compile](CRITICAL-017-karma-wont-compile.md) — Same service, different bug
- [CRITICAL-004-karma-auth-404](CRITICAL-004-karma-auth-404.md) — Same service, auth bypass
