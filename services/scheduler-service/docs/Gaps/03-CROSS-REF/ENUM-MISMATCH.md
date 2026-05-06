# CROSS-REF: Enum & Status Mismatches

**Date:** 2026-04-16
**Severity:** 2 HIGH, 5 MEDIUM, 1 LOW
**Updated:** 2026-04-16 — Canonical types verified against `packages/shared-types/`

---

## G-CR-X2 — CoinType: branded_coin vs branded

**Consumer App:** `app/karma/wallet.tsx:33`; `services/karmaService.ts:166`
**Canonical:** `packages/shared-types/src/enums/index.ts:71-78`
**Backend Service:** `src/services/karmaService.ts:166`

### The Three-Way Mismatch

| Layer | Value Used | Should Be |
|-------|-----------|-----------|
| UI local type | `'branded_coin'` (snake_case with `_coin`) | `'branded'` |
| Backend service | `'branded_coin'` (snake_case with `_coin`) | `'branded'` |
| Canonical enum | `'branded'` (no suffix) | — |

**Related Gaps:** G-KU-H2 (karma UI)

**Fix:** Update both the backend service and frontend to use canonical `'branded'` value.

**Status:** FIXED (2026-04-17) — `branded_coin` no longer present in codebase; all references consistently use `branded`

---

## G-CR-X3 — EarnRecord Status (GOOD — No Mismatch)

**Consumer App:** `services/karmaService.ts:134`
**Backend Service:** `src/services/earnRecordService.ts`
**Canonical:** `packages/shared-types/src/entities/karma.ts:30-34`

### Values

| Value | Local | Backend | Canonical | Status |
|-------|-------|---------|-----------|--------|
| `APPROVED_PENDING_CONVERSION` | ✓ | ✓ | ✓ | CONSISTENT |
| `CONVERTED` | ✓ | ✓ | ✓ | CONSISTENT |
| `REJECTED` | ✓ | ✓ | ✓ | CONSISTENT |
| `ROLLED_BACK` | ✓ | ✓ | ✓ | CONSISTENT |

**Status:** ✅ CONSISTENT — No action needed

---

## G-CR-X4 — Booking Status: snake_case vs kebab-case Risk

**Consumer App:** `services/karmaService.ts:90`
**Backend Service:** `src/routes/verifyRoutes.ts`
**Canonical:** Unknown (not yet verified)

### Values

| Layer | Value Used |
|-------|-----------|
| UI local type | `'checked_in'` (snake_case) |
| Backend service | `'checked_in'` (appears to use snake_case) |
| Canonical | Unknown — not yet verified |

**Risk:** If canonical type uses `'checked-in'` (kebab-case) or `'checkedIn'` (camelCase), the UI comparison `booking?.status !== 'checked_in'` will silently fail.

**Related Gaps:** G-KU-C2 (fragile check-in logic)

**Fix:** Verify canonical Booking status format. Use the authoritative `qrCheckedIn` boolean instead of string comparison. See G-KU-C2.

**Status:** ACTIVE — Needs canonical verification

---

## G-CR-X5 — Batch Status

**Backend Service:** `src/models/Batch.ts:56`

### Values

| Value | Defined | Ever Set |
|-------|---------|----------|
| `DRAFT` | ✓ | ✓ |
| `READY` | ✓ | ✓ |
| `EXECUTED` | ✓ | ✓ |
| `PARTIAL` | ✓ | ✓ |
| `PAUSED` | ✓ | **NEVER** (dead code) |

**Related Gaps:** G-KS-A5 (PAUSED is dead code)

**Status:** ACTIVE — See G-KS-A5

---

## G-CR-X7 — EarnRecordStatus — Consumer Duplicates Inline Instead of Importing

**Consumer App:** `services/karmaService.ts` line 134
**Canonical:** `packages/shared-types/src/entities/karma.ts` lines 30-34

**Code:**
```typescript
// Consumer — bespoke inline definition (governance violation):
status: 'APPROVED_PENDING_CONVERSION' | 'CONVERTED' | 'REJECTED' | 'ROLLED_BACK';

// Canonical — should be imported:
export type EarnRecordStatus = 'APPROVED_PENDING_CONVERSION' | 'CONVERTED' | 'REJECTED' | 'ROLLED_BACK';
```

**Root Cause:** Values match exactly, but the consumer re-defines the type inline rather than importing from `@rez/shared-types`. Any backend change to these values silently breaks the consumer (no compile-time warning). The `statusConfig` map in `my-karma.tsx` line 137 also hardcodes these string literals directly.

**Fix:**
```typescript
import { EarnRecordStatus } from '@rez/shared-types';
```

**Status:** ACTIVE

---

## G-CR-X8 — Consumer `CoinType` Completely Different From Canonical

**Consumer App:** `services/karmaService.ts` line 166; `wallet.tsx` line 33
**Canonical:** `packages/shared-types/src/enums/index.ts` lines 71-78

**Code:**
```typescript
// Consumer — bespoke type:
type CoinType = 'karma_points' | 'rez_coins' | 'all';

// Canonical:
enum CoinType {
  PROMO = 'promo',
  BRANDED = 'branded',
  PRIVE = 'prive',
  CASHBACK = 'cashback',
  REFERRAL = 'referral',
  REZ = 'rez',
}
```

**Root Cause:** The consumer defines its own `CoinType` values that have zero overlap with the canonical enum. `'karma_points'`, `'rez_coins'`, `'all'` do not exist in the canonical enum. The wallet filter in `wallet.tsx` uses `COIN_TYPE_CONFIG['karma_points']` which will be `undefined` if canonical types are enforced.

**Fix:** Import `CoinType` from `@rez/shared-types` and use canonical values.

**Status:** ACTIVE

---

## G-CR-X9 — Consumer `getMyEvents` Uses Invalid Status Values

**Consumer App:** `services/karmaService.ts` line 287
**Backend:** `KarmaEventStatus` = `'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled'`

**Code:**
```typescript
async getMyEvents(status?: 'upcoming' | 'ongoing' | 'past'): Promise<ApiResponse<KarmaEvent[]>>
```

**Root Cause:** `'upcoming'` and `'past'` are not valid `KarmaEventStatus` values. `'upcoming'` maps to no known status. `'past'` maps to `'completed'` but the mapping is implicit and never enforced. The UI never calls `getMyEvents` — this is dead code with incorrect types.

**Fix:** Remove `getMyEvents` or fix to use valid `KarmaEventStatus` values.

**Status:** ACTIVE

---

## G-CR-X10 — Consumer `KarmaEvent.difficulty` Inline vs Canonical `number`

**Consumer App:** `services/karmaService.ts` line 67
**Backend:** `EventDifficulty = 'easy' | 'medium' | 'hard'`
**Canonical:** `IKarmaEvent.difficulty: number`

**Code:**
```typescript
// Consumer:
difficulty: 'easy' | 'medium' | 'hard'

// Backend:
export type EventDifficulty = 'easy' | 'medium' | 'hard'

// Canonical (WRONG):
difficulty: number  // ← plain number, not a union
```

**Root Cause:** The canonical `IKarmaEvent` defines `difficulty` as `number`. Both the consumer and backend use `'easy' | 'medium' | 'hard'` string unions. The canonical is wrong — it should use `EventDifficulty`. Any consumer importing `IKarmaEvent` gets `difficulty: number` but the actual API returns string values.

**Fix:** Update canonical `IKarmaEvent.difficulty` to `EventDifficulty` type.

**Status:** ACTIVE

---

## G-CR-X11 — Consumer `Transaction.type` Not In Canonical Enum

**Consumer App:** `services/karmaService.ts` line 165; `wallet.tsx` lines 35-39
**Canonical:** `CoinTransactionType` enum

**Code:**
```typescript
// Consumer:
type: 'earned' | 'converted' | 'spent' | 'bonus'

// Canonical:
enum CoinTransactionType {
  EARNED = 'earned',    // ← matches
  SPENT = 'spent',     // ← matches
  BONUS = 'bonus',     // ← matches
  // 'converted' NOT in canonical
}
```

**Root Cause:** Consumer uses `'converted'` which has no canonical equivalent. Consumer uses lowercase `'earned'` but canonical uses `EARNED = 'earned'` (values match, naming convention differs). The wallet filter at `wallet.tsx` line 277 uses `COIN_TYPE_CONFIG` for consumer-side coin types, not canonical `CoinType`.

**Fix:** Import `CoinTransactionType` from `@rez/shared-types`, replace `'converted'` with canonical equivalent or add it to the enum.

**Status:** ACTIVE

---

## G-CR-X6 — Karma Level

**Consumer App:** `services/karmaService.ts:18`
**Canonical:** `packages/shared-types/src/entities/karma.ts`

### Values

| Layer | Type |
|-------|------|
| UI local | `'L1' \| 'L2' \| 'L3' \| 'L4'` (string union) |
| Canonical | `KarmaLevel` enum (presumably) |

**Risk:** If canonical uses numeric levels or different strings, the `LEVEL_CONFIG` mapping in `home.tsx` will produce wrong labels.

**Related Gaps:** G-KU-H1 (KarmaProfile divergence), G-KU-M3 (hardcoded level thresholds)

**Status:** ACTIVE — Needs canonical verification

---

## Summary

| Gap | Severity | Consumer vs Backend vs Canonical | Status |
|-----|----------|-------|--------|
| G-CR-X2 | HIGH | `branded_coin` (all 3 layers) vs `branded` (canonical) | ACTIVE |
| G-CR-X3 | — | EarnRecordStatus values consistent | ✅ OK |
| G-CR-X4 | MEDIUM | Booking status `checked_in` unverified against canonical | ACTIVE |
| G-CR-X5 | LOW | BatchStatus `PAUSED` is dead code | ACTIVE |
| G-CR-X6 | MEDIUM | KarmaLevel `L1-L4` — consumer inline, not imported | ACTIVE |
| G-CR-X7 | MEDIUM | EarnRecordStatus consumer inline duplicate, not imported | ACTIVE |
| G-CR-X8 | HIGH | Consumer CoinType completely different from canonical enum | ACTIVE |
| G-CR-X9 | MEDIUM | Consumer getMyEvents uses invalid `'upcoming'`/`'past'` status | ACTIVE |
| G-CR-X10 | MEDIUM | Consumer difficulty string union vs canonical `number` — canonical wrong | ACTIVE |
| G-CR-X11 | MEDIUM | Consumer Transaction.type `'converted'` not in canonical enum | ACTIVE |
