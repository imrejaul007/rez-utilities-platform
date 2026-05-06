# Gaps: Cross-Repository Mismatches — Audit 2026-04-16

**28 cross-repo mismatches across 7 repositories** (16 type/enum + 12 API contract)

---

## Summary Matrix

| Gap ID | Type | Repo A | Type/Field A | Repo B | Type/Field B | Severity |
|---------|------|--------|---------------|--------|---------------|---------|
| XREP-01 | Type drift | rez-now | `WalletBalance` (coins/rupees) | rez-shared | `WalletBalance` (rez/prive/promo) | HIGH |
| XREP-02 | Enum drift | rez-now | `WebOrderStatus` (6 values) | rez-shared | `OrderStatus` (15 values) | HIGH |
| XREP-03 | Enum drift | rez-shared | `normalizeLoyaltyTier` ('DIAMOND'→'platinum') | rez-shared/enums | `normalizeLoyaltyTier` ('DIAMOND'→'diamond') | MEDIUM |
| XREP-04 | Missing type | rez-now | All types local | rez-shared | Canonical types unused | CRITICAL |
| XREP-05 | Field mismatch | rez-karma-service | `startOf('week')` (locale) | rez-karma-service/batch | `startOf('isoWeek')` (ISO) | MEDIUM |
| XREP-06 | Type mismatch | rez-now | `PaymentStatusResult` (6 values) | rez-shared | `PaymentStatus` (10 values) | MEDIUM |
| XREP-07 | Enum drift | rez-karma-service | `coinType: 'karma_points'` (query) | rez-karma-service | `coinType: 'rez'` (credit) | HIGH |
| XREP-08 | Missing import | rez-now | 0 shared imports | rez-shared | `@karim4987498/shared` | CRITICAL |
| XREP-09 | Status mismatch | consumer-app | `'completed'` (polling) | rez-shared | `'paid'` (canonical) | CRITICAL |
| XREP-10 | Field mismatch | consumer-app | `AddressType.HOME = 'HOME'` | rez-shared | `'home'` (lowercase) | MEDIUM |
| XREP-11 | Type mismatch | consumer-app | `KarmaProfile` (14 fields) | rez-shared | `IKarmaProfile` (20 fields) | HIGH |
| XREP-12 | Enum drift | consumer-app | `CoinType.branded_coin` | rez-shared | `CoinType.branded` | HIGH |
| XREP-13 | Missing export | rez-karma-service | `ConversionRate` local | rez-shared | `ConversionRate` not exported | LOW |
| XREP-14 | Field mismatch | rez-now | `WalletTransaction.type` (credit/debit) | rez-shared | `CoinTransactionType` (6 values) | LOW |
| XREP-15 | Type mismatch | consumer-app | `BookingStatus` (4 values) | rez-shared | `BookingStatus` (9 values) | MEDIUM |
| XREP-16 | Schema drift | rez-karma-service | `userTimezone` not in schema | rez-karma-service/karmaEngine | `userTimezone` param used | LOW |

---

## XREP-01: WalletBalance — Two Completely Different Shapes

**Severity:** HIGH
**Gap ID:** XREP-01
**Status:** ACTIVE

### Shape A — rez-now/lib/types/index.ts:184
```typescript
WalletBalance = { coins: number, rupees: number, tier: 'bronze'|'silver'|'gold'|'platinum'|null }
```

### Shape B — rez-shared/src/types/wallet.ts:5
```typescript
WalletBalance = { rez: number, prive: number, promo: number, branded: number, cashback: number, total: number }
```

### Shape C — rez-shared/src/types/wallet.types.ts:77
```typescript
WalletBalance = { total: number, available: number, pending: number, cashback: number }
```

### Root Cause
Three different `WalletBalance` types in three locations. rez-now defines its own because it doesn't import from shared. Two different types in shared itself.

### Impact
If rez-now ever consumes `WalletBalance` from shared, every component reading `.coins` or `.rupees` breaks.

### Fix Direction
Define ONE canonical `WalletBalance` in shared. Have all repos import it.

---

## XREP-02: Order Status — Completely Different Enums

**Severity:** HIGH
**Gap ID:** XREP-02
**Status:** ACTIVE

### Shape A — rez-now/lib/types/index.ts:119
```typescript
WebOrderStatus = 'pending_payment' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
```

### Shape B — rez-shared/src/orderStatuses.ts:24
```typescript
ORDER_STATUSES = 15 values including 'placed', 'dispatched', 'out_for_delivery',
  'failed_delivery', 'return_requested', 'returned', 'refunded'
```

### Root Cause
rez-now defines its own `WebOrderStatus` without importing the canonical `OrderStatus`.

### Impact
Values like `'out_for_delivery'`, `'return_requested'`, `'refunded'` render as raw strings in rez-now.

### Fix Direction
Import `OrderStatus` from shared into rez-now. Create a display mapping. Never redefine the enum.

---

## XREP-03: normalizeLoyaltyTier — Two Opposite Behaviors

**Severity:** MEDIUM
**Gap ID:** XREP-03
**Status:** ACTIVE

### coins.ts:139
```typescript
'DIAMOND' → 'platinum'  // diamond normalizes to platinum
'DIMAOND' → 'platinum'   // typo also normalizes to platinum
```

### enums.ts:20
```typescript
'DIAMOND' → 'diamond'   // diamond is a distinct tier
'DIMAOND' → 'platinum'   // typo normalizes to platinum
```

### Root Cause
Two separate P0-ENUM-3 fixes created conflicting mappings. One treats diamond as platinum-alias, the other as distinct tier.

### Impact
Same user loyalty tier normalizes to different values across services.

### Fix Direction
Consolidate to one normalizer. Choose: is `diamond` a distinct tier or a platinum alias? Align with product.

---

## XREP-04: rez-now Completely Disconnected from Shared Types

**Severity:** CRITICAL
**Gap ID:** XREP-04
**Status:** ACTIVE

### Description
`rez-now` has **zero dependency** on `@karim4987498/shared`. ALL types defined locally. The `package.json` confirms this.

### Impact
16 duplicate enum/type definitions (XREP-01, XREP-02, XREP-06, XREP-14). Type drift guaranteed over time.

### Fix Direction
Add `@karim4987498/shared` to rez-now's dependencies. Replace local type definitions with imports.

---

## XREP-05: Week Boundary — locale vs ISO Week

**Severity:** MEDIUM
**Gap ID:** XREP-05
**Status:** ACTIVE

### karmaService.ts:128
```typescript
moment().startOf('week')    // locale-dependent (typically Sunday)
```

### batchService.ts:577
```typescript
moment(weekOf).startOf('isoWeek')  // always Monday
```

### Impact
Weekly cap boundaries differ between karma earning and coin conversion. Users may be incorrectly capped or uncapped.

### Fix Direction
Use `startOf('isoWeek')` consistently everywhere.

---

## XREP-06: Payment Status — Different Enum Values

**Severity:** MEDIUM
**Gap ID:** XREP-06
**Status:** ACTIVE

### Shape A — rez-now/lib/api/scanPayment.ts:49
```typescript
PaymentStatusResult.status = 'initiated' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired'
```

### Shape B — rez-shared/src/paymentStatuses.ts
```typescript
PaymentStatus = 10 values including 'refund_initiated', 'refund_processing', 'refunded', 'refund_failed'
```

### Fix Direction
Import `PaymentStatus` from shared. Create display subset with explicit documentation.

---

## XREP-07: karma Credits One Coin Type, Queries Another

**Severity:** HIGH
**Gap ID:** XREP-07
**Status:** ACTIVE

### `creditUserWallet()` — credits with
```typescript
coinType: 'rez'
```

### `getKarmaBalance()` — queries with
```typescript
coinType: 'karma_points'
```

### Fix Direction
Align coinType across both functions. Check the wallet service's actual `CoinType` enum.

---

## XREP-08: Consumer App Missing Canonical Types

**Severity:** HIGH
**Gap ID:** XREP-08
**Status:** ACTIVE

### consumer-app stores
`KarmaProfile` has 14 fields. Canonical `IKarmaProfile` has 20 fields.
- Missing: `_id`, `eventsJoined`, `checkIns`, `approvedCheckIns`, `lastActivityAt`, `levelHistory`, `conversionHistory`, etc.

### Fix Direction
Import canonical type and extend with client-only fields.

---

## XREP-09: Payment Status Enum Mismatch — completed vs paid

**Severity:** CRITICAL
**Gap ID:** XREP-09
**Status:** ACTIVE

### polling code
```typescript
status === 'completed' || status === 'failed' || status === 'cancelled'
```

### canonical
```typescript
'paid'  // terminal success state
```

### Impact
Payment polling never terminates after successful payment. Users wait up to 90 seconds.

### Fix Direction
Add `'paid'` to terminal state check. Apply `normalizePaymentStatus` from shared.

---

## XREP-10: AddressType SCREAMING_CASE vs lowercase

**Severity:** MEDIUM
**Gap ID:** XREP-10
**Status:** ACTIVE

### addressApi.ts:6
```typescript
HOME = 'HOME'
WORK = 'WORK'
OTHER = 'OTHER'
```

### canonical
```typescript
'home' | 'work' | 'other'
```

### Fix Direction
Change `AddressType` values to lowercase. Add normalization before API submission.

---

## XREP-11: KarmaProfile vs IKarmaProfile — 6 Fields Missing

**Severity:** HIGH
**Gap ID:** XREP-11
**Status:** ACTIVE

### Missing from local KarmaProfile
- `_id`, `eventsJoined`, `checkIns`, `approvedCheckIns`, `lastActivityAt`, `levelHistory`, `conversionHistory`, `thisWeekKarmaEarned`, `weekOfLastKarmaEarned`, `avgEventDifficulty`, `avgConfidenceScore`, `activityHistory`, `createdAt`, `updatedAt`

### Fix Direction
Import canonical `IKarmaProfile`. Extend with client-only fields (`conversionRate`, `nextLevelAt`, `decayWarning`).

---

## XREP-12: CoinType branded_coin vs branded

**Severity:** HIGH
**Gap ID:** XREP-12
**Status:** ACTIVE

### consumer-app
`CoinType.branded_coin`

### rez-shared
`CoinType.branded`

### Impact
Branded coin config fails to match. Wrong styling or no branded coins shown.

### Fix Direction
Choose one canonical value. Update all services and apps.

---

## XREP-13: ConversionRate Not Exported from Shared

**Severity:** LOW
**Gap ID:** XREP-13
**Status:** ACTIVE

### karma-service
```typescript
ConversionRate = 0.25 | 0.5 | 0.75 | 1.0  // local definition
```

### shared
No corresponding export.

### Fix Direction
Export `ConversionRate` from shared as canonical type.

---

## XREP-14: WalletTransaction.type — Simplified vs Rich

**Severity:** LOW
**Gap ID:** XREP-14
**Status:** ACTIVE

### rez-now
```typescript
WalletTransaction.type = 'credit' | 'debit'
```

### rez-shared
```typescript
CoinTransactionType = 'earned' | 'spent' | 'expired' | 'refunded' | 'bonus' | 'branded_award'
```

### Fix Direction
Add display-layer mapping: `{ credit: 'earned' | 'bonus', debit: 'spent' | 'expired' }`.

---

## XREP-15: BookingStatus — 4 vs 9 Values

**Severity:** MEDIUM
**Gap ID:** XREP-15
**Status:** ACTIVE

### consumer-app bookingApi.ts:22
4 values: `'pending'`, `'confirmed'`, `'cancelled'`, `'completed'`

### canonical rez-shared
9 values: `'pending'`, `'confirmed'`, `'assigned'`, `'in_progress'`, `'no_show'`, `'cancelled'`, `'completed'`, `'refunded'`, `'expired'`

### Fix Direction
Import `BookingStatus` from shared.

---

## XREP-16: userTimezone Not in Schema but Used in Engine

**Severity:** LOW
**Gap ID:** XREP-16
**Status:** ACTIVE

### karmaEngine.ts
`applyDailyDecay()` accepts `userTimezone` parameter.

### KarmaProfile.ts schema
`userTimezone` field missing from schema.

### Impact
Decay calculations always fall back to UTC. For non-UTC timezones, decay boundary is wrong by up to several hours.

### Fix Direction
Add `userTimezone?: string` to `IKarmaProfile` and `KarmaProfileSchema`.

---

## Status Table

| ID | Status | Fix Priority |
|----|--------|-------------|
| XREP-01 | ACTIVE | P1 |
| XREP-02 | ACTIVE | P1 |
| XREP-03 | ACTIVE | P2 |
| XREP-04 | ACTIVE | P0 |
| XREP-05 | ACTIVE | P2 |
| XREP-06 | ACTIVE | P2 |
| XREP-07 | ACTIVE | P1 |
| XREP-08 | ACTIVE | P1 |
| XREP-09 | ACTIVE | P0 |
| XREP-10 | ACTIVE | P2 |
| XREP-11 | ACTIVE | P1 |
| XREP-12 | ACTIVE | P1 |
| XREP-13 | ACTIVE | P3 |
| XREP-14 | ACTIVE | P3 |
| XREP-15 | ACTIVE | P2 |
| XREP-16 | ACTIVE | P3 |
| API-01 | ACTIVE | P0 |
| API-02 | ACTIVE | P1 |
| API-03 | ACTIVE | P1 |
| API-04 | ACTIVE | P1 |
| API-05 | ACTIVE | P2 |
| API-06 | ACTIVE | P2 |
| API-07 | ACTIVE | P2 |
| API-08 | ACTIVE | P3 |
| API-09 | ACTIVE | P3 |
| API-10 | ACTIVE | P2 |
| API-11 | ACTIVE | P3 |
| API-12 | ACTIVE | P2 |

---

## API Contract Mismatches (API-01 through API-12)

**Source:** Deep verification 2026-04-16 — frontend services reading wrong response paths or wrong shapes
**Scope:** `rez-app-consumer/src/services/`

| ID | Title | File | Impact | Severity |
|----|-------|------|--------|----------|
| API-01 | `CoinType` missing `cashback`/`referral` | `types/wallet.ts:25` | TypeScript rejects valid backend values — runtime crash | **CRITICAL** |
| API-02 | Three different `PaymentStatus` unions | `payment.types.ts` vs `order.ts` vs `paymentService.ts` | Same codebase defines PaymentStatus 3 different ways | **HIGH** |
| API-03 | `pointsApi.getBalance()` reads wrong response paths | `pointsApi.ts:107-116` | `earned` ← `balance.available` (wrong); `lifetimeEarned` ← `balance.total` (current balance); `spent` hardcoded `0` | **HIGH** |
| API-04 | `getProductDiscount()` crashes on optional `product.price` | `product-unified.types.ts:325-330` | TypeError when `price` is undefined — same pattern in 3 other files | **HIGH** |
| API-05 | Two `PaginatedResponse` interfaces with different field names | `api.types.ts:20` vs `store.types.ts:373` | `{ items, totalCount }` vs `{ data, total, totalPages }` — same name | **MEDIUM** |
| API-06 | `FulfillmentType` values unverified against backend | `checkout.types.ts:7` | Hardcoded values may not match backend accepted values | **MEDIUM** |
| API-07 | `ExploreStore.cashback` string vs `cashbackRate` number | `exploreApi.ts:20-21` | Arithmetic on `.cashback` returns NaN | **MEDIUM** |
| API-08 | `COIN_TYPES` constant missing 2 backend types | `checkout.types.ts:406` | Unused but would silently fail for `branded`/`prive` coin types | **LOW** |
| API-09 | Duplicate `TransactionMetadata` interface | `walletApi.ts:145, 303` | Same interface defined twice in same file | **LOW** |
| API-10 | `performDailyCheckIn` field name mismatch | `pointsApi.ts:422-429` vs `gamificationApi.ts:317-343` | `pointsApi` expects `pointsEarned`/`bonus` but backend sends `coinsEarned`/`bonusEarned` — all undefined | **MEDIUM** |
| API-11 | `ValidateCouponResponse.type` uppercase vs backend case | `couponApi.ts:139` | `'PERCENTAGE'\|'FIXED'` may not match backend lowercase | **LOW** |
| API-12 | `apiClient` unwrap depth inconsistent across services | Multiple service files | `feedApi.ts` double-unwrap `response.data.data`; others single-unwrap; batch dedup may alter depth | **MEDIUM** |

### API-01 Detail: CoinType Fragmentation

| Source | `cashback` | `referral` |
|--------|:----------:|:----------:|
| `coinTypes.ts` (backend canonical) | ✓ | ✓ |
| `types/wallet.ts` (consumer) | ✗ | ✗ |
| `checkout.types.ts` `COIN_TYPES` | ✗ | ✗ |

### API-03 Detail: `pointsApi.getBalance()` Wrong Paths

| Field | Code Reads | Should Read |
|-------|-----------|-------------|
| `earned` | `w.balance.available` | `w.statistics.totalEarned` or `w.totalValue` |
| `lifetimeEarned` | `w.balance.total` (current balance) | `w.statistics.totalEarned` |
| `spent` | `0` (hardcoded) | `w.statistics.totalSpent` |

### API-04 Detail: Products with Optional `price`

Three files access `product.price.discount` / `.original` / `.current` without guards:

| File | Line | Pattern |
|------|------|---------|
| `product-unified.types.ts` | 325-330 | `getProductDiscount()` |
| `data/bundleData.ts` | 367-375 | `bundle.mainProduct.price.original` |
| `hooks/useGoingOutPage.ts` | 87 | `product.price.original` |

### API-10 Detail: `performDailyCheckIn` Response Normalization

```
Backend sends: { coinsEarned, bonusEarned, streak, nextReward, message }
gamificationApi normalizes: coinsEarned ✓, bonusEarned → bonus ✓
pointsApi expects:          pointsEarned ✗, bonus ✗, nextReward ✗, message ✗
```

All fields from `pointsApi.performDailyCheckIn()` are `undefined`.

### API-12 Detail: Response Unwrap Depth by Service

| Service | Unwrap Depth | Pattern |
|---------|-------------|---------|
| `walletApi` | 1 (`response.data`) | Standard |
| `gamificationApi` | 1 (`response.data`) | Standard |
| `feedApi` | 2 (`response.data.data`) | Double-unwrap |
| `couponApi` | 1 | Standard |
| `homepageApi` | 1 | Standard (has comment explaining it) |
| Batch dedup wrapper | Unknown | May differ per call |

---
