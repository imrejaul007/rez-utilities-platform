# Cross-Repo Type/Enum Consistency Audit

**Date:** 2026-04-17
**Scope:** All 10+ repos across the REZ ecosystem
**Method:** 4 parallel agent scans (shared-types, consumer app, merchant/admin apps, rez-now/karma)
**Total New Issues Found:** 28 (3 CRIT, 8 HIGH, 9 MED, 8 LOW)
**Relationship:** Extends existing `TYPE-DRIFT-MATRIX.md` — all issues here are NEW findings not previously documented

---

## Executive Summary

The REZ ecosystem has **no enforced canonical type registry**. Each service defines its own enums and types locally, creating 3-way mismatches on critical financial types (OrderStatus, PaymentStatus, TransactionStatus). The architecture governance rule "No Bespoke Enums" is not enforced — `rez-now`, `rez-karma-service`, and `adBazaar` all define types with zero imports from shared packages.

**Canonical sources (conflicting):**
1. `packages/shared-types/src/enums/index.ts` — Primary canonical (but missing 3 OrderStatus values)
2. `rez-shared/src/orderStatuses.ts` — Secondary canonical (14 values, includes `failed_delivery`, `return_requested`, `return_rejected`)
3. `rez-shared/enums/src/index.ts` — Legacy canonical (UPPERCASE values, 7 OrderStatus values)
4. `rez-shared/src/constants/coins.ts` — Coin types canonical

---

## Gap IDs

| Prefix | Domain | Count |
|--------|--------|-------|
| `CT-CRIT-###` | Cross-Type: CRITICAL | 3 |
| `CT-HIGH-###` | Cross-Type: HIGH | 8 |
| `CT-MED-###` | Cross-Type: MEDIUM | 9 |
| `CT-LOW-###` | Cross-Type: LOW | 8 |

---

## CRITICAL Issues

### CT-CRIT-01 — OrderStatus: Three Conflicting Canonical Sources

**Severity:** CRITICAL
**Affects:** All repos using OrderStatus
**Root Cause:** No single authoritative source for OrderStatus

**Source A — `packages/shared-types/src/enums/index.ts` (11 values):**
```typescript
export enum OrderStatus {
  PLACED = 'placed', CONFIRMED = 'confirmed', PREPARING = 'preparing',
  READY = 'ready', DISPATCHED = 'dispatched', OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered', CANCELLED = 'cancelled', CANCELLING = 'cancelling',
  RETURNED = 'returned', REFUNDED = 'refunded',
}
```
**Missing:** `failed_delivery`, `return_requested`, `return_rejected`

**Source B — `rez-shared/src/orderStatuses.ts` (14 values, canonical for Phase 7):**
```typescript
export const ORDER_STATUSES = [
  'placed', 'confirmed', 'preparing', 'ready', 'dispatched', 'out_for_delivery',
  'failed_delivery', 'delivered', 'cancelling', 'cancelled', 'return_requested',
  'return_rejected', 'returned', 'refunded',
] as const;
```
**Has all 14 values.** Also exports `LinearOrderStatus`, `TerminalOrderStatus`, `ActiveOrderStatus`, `PastOrderStatus`.

**Source C — `rez-shared/enums/src/index.ts` (7 values, legacy UPPERCASE):**
```typescript
export enum OrderStatus {
  CART = 'CART', CHECKOUT = 'CHECKOUT', PAID = 'PAID',
  FULFILLED = 'FULFILLED', DELIVERED = 'DELIVERED', CANCELLED = 'CANCELLED', REFUNDED = 'REFUNDED',
}
```
**Legacy only — should be deprecated.**

**Consumer app:** `types/order.ts` defines local string union matching Source A (11 values). Does NOT import from shared-types.
**rez-now:** `lib/types/index.ts` defines `WebOrderStatus` with only 6 values (XREP-02).
**Admin app:** `rez-now-orders.tsx` defines reduced 7-value `OrderStatus`.
**Merchant service:** Uses Source A (11 values).

**Impact:** A service using Source B (`failed_delivery`) will fail type-checking against Source A's 11-value enum. Runtime mismatches possible when statuses cross service boundaries.

**Fix:** Designate `rez-shared/src/orderStatuses.ts` as the SINGLE canonical source. Deprecate `rez-shared/enums/src/index.ts`. Have `packages/shared-types/src/enums/index.ts` re-export from `rez-shared/src/orderStatuses.ts`. Enforce via arch-fitness test.

**Status:** ACTIVE

---

### CT-CRIT-02 — PaymentStatus: Three Definitions, Missing `partially_refunded`

**Severity:** CRITICAL
**Affects:** All repos using PaymentStatus
**Root Cause:** Three independent definitions with different value sets

**Source A — `packages/shared-types/src/enums/index.ts` (11 values):**
```typescript
export enum PaymentStatus {
  PENDING = 'pending', PROCESSING = 'processing', COMPLETED = 'completed',
  FAILED = 'failed', CANCELLED = 'cancelled', EXPIRED = 'expired',
  REFUND_INITIATED = 'refund_initiated', REFUND_PROCESSING = 'refund_processing',
  REFUNDED = 'refunded', REFUND_FAILED = 'refund_failed', PARTIALLY_REFUNDED = 'partially_refunded',
}
```

**Source B — `rez-shared/src/paymentStatuses.ts` (10 values):**
```typescript
export const PAYMENT_STATUSES = [
  'pending', 'processing', 'completed', 'failed', 'cancelled', 'expired',
  'refund_initiated', 'refund_processing', 'refunded', 'refund_failed',
] as const;
```
**Missing:** `PARTIALLY_REFUNDED` (present in Source A but not Source B)

**Source C — `rez-shared/enums/src/index.ts` (4 values, UPPERCASE legacy):**
```typescript
export enum PaymentStatus {
  INIT = 'INIT', PENDING = 'PENDING', SUCCESS = 'SUCCESS', FAILED = 'FAILED',
}
```

**Consumer app:** Local string union in `types/order.ts` and `types/payment.types.ts` (identical, 11 values). Does NOT import from shared-types. Also has `PaymentStatus` in `services/paymentService.ts` used for polling (NA-CRIT-08).

**Merchant service:** Uses Source A (11 values) via `types/api.ts` (marked canonical).

**Merchant service — service domain:** `services/api/services.ts` defines SEPARATE `PaymentStatus`:
```typescript
type PaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded' | 'failed';
```
This is completely different (5 values). Used for service bookings, not orders.

**Impact:** `partially_refunded` status from Source A will crash type-checking against Source B's 10-value set. Consumer app's local type may diverge from backend Source A at runtime.

**Fix:** Designate Source A as canonical. Add `PARTIALLY_REFUNDED` to Source B. Consolidate merchant service's service-domain PaymentStatus as `ServicePaymentStatus` (different name, different domain).

**Status:** ACTIVE

---

### CT-CRIT-03 — TransactionStatus: Three Definitions with Opposite Case Conventions

**Severity:** CRITICAL
**Affects:** Wallet transactions, ledger entries, all financial operations
**Root Cause:** No canonical TransactionStatus; services define wire format and display format independently

**Source A — `packages/shared-types/src/enums/index.ts` (3 values):**
```typescript
export enum TransactionStatus {
  COMPLETED = 'completed', PENDING = 'pending', FAILED = 'failed',
}
```

**Source B — `rez-shared/src/types/wallet.types.ts` (6 wire values):**
```typescript
export type BackendTransactionStatus =
  | 'completed' | 'pending' | 'failed' | 'cancelled' | 'processing' | 'reversed';
```

**Source C — `rez-shared/src/types/wallet.types.ts` (6 display values):**
```typescript
export type TransactionStatus =
  | 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED' | 'PROCESSING' | 'REVERSED';
```

**Consumer app — VIOLATION:** `data/walletData.ts:306-310` defines its own `TransactionStatus` enum:
```typescript
export enum TransactionStatus {
  COMPLETED = 'completed', PENDING = 'pending', FAILED = 'failed',
}
```
This is a verbatim duplicate of Source A, violating governance Rule 4 ("No Bespoke Enums"). The same file also imports `TransactionStatus` from `@/types/wallet.types` at line 13, creating two conflicting imports for the same type name.

**Impact:** Backend returns `BackendTransactionStatus` values (`cancelled`, `processing`, `reversed`) that don't exist in the consumer's local enum. UI display uses SCREAMING_CASE but backend returns lowercase. Transaction lookups by status will silently miss cases.

**Fix:**
1. Designate Source A as canonical. Remove `data/walletData.ts` local enum. Import from `@/types/rez-shared-types`.
2. Rename `BackendTransactionStatus` → `TransactionStatus` (wire) and `TransactionStatus` → `TransactionStatusDisplay` (UI). Add normalization function.
3. Enforce arch-fitness test: no local `TransactionStatus` enum anywhere in consumer app.

**Status:** ACTIVE

---

## HIGH Issues

### CT-HIGH-01 — CoinType Normalization Incomplete — 12 Legacy Variants Unhandled

**Severity:** HIGH
**Canonical:** `packages/shared-types/src/enums/coinType.ts`
**Consumer:** `services/walletIntegration.ts`, `services/karmaService.ts`

`normalizeCoinType()` handles:
- `nuqta`, `wasil_coins`, `wasil_bonus`, `earning`, `earnings`, `karma_points`, `karma_coins`, `rez_coins` → `CoinType.REZ`
- `branded_coin`, `branded_coins` → `CoinType.BRANDED`
- `prive_coins` → `CoinType.PRIVE`
- `reward`, `bonus`, `promotional`, `promotional_coins` → `CoinType.PROMO`

**Unmapped legacy variants still in codebase (verified by grep):**
- `scancoin` (AdBazaar scan events)
- `scan_coin` (AdBazaar)
- `bonus_coin` (AdBazaar)
- `referral_coin` (AdBazaar)
- `hotel_coin` (consumer app)
- `hotel_brand` (consumer app — mismatch with `branded`)
- `earn` (consumer app karmaService.ts)
- `spend` (consumer app — type mismatch in transaction)
- `reversed` (walletApi.ts transaction type)
- `bonus` (consumer app — used in checkout but not in normalizeCoinType)

**Impact:** Transactions with these legacy coin types bypass normalization and fail silently. Users lose coins because the type doesn't map to any known `CoinType` value.

**Fix:** Extend `normalizeCoinType()` to handle all 12 unmapped variants. Add integration test.

**Status:** ACTIVE

---

### CT-HIGH-02 — LoyaltyTier: Three Definitions, `diamond` Missing from Canonical

**Severity:** HIGH
**Affects:** All apps showing user loyalty tiers

**Source A — `packages/shared-types/src/enums/index.ts` (4 values):**
```typescript
export enum LoyaltyTier {
  BRONZE = 'bronze', SILVER = 'silver', GOLD = 'gold', PLATINUM = 'platinum',
}
```
**Missing:** `diamond`

**Source B — `rez-shared/src/enums.ts` (5 values):**
```typescript
export const LOYALTY_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'] as const;
```

**Source C — `rez-shared/src/constants/coins.ts` (5 values but mapping broken):**
```typescript
const LOYALTY_TIER = {
  BRONZE: 'bronze', SILVER: 'silver', GOLD: 'gold',
  PLATINUM: 'platinum', DIAMOND: 'platinum',  // <-- TYPO + WRONG VALUE
  DIMAOND: 'platinum',  // <-- DIMAOND (not DIAMOND) also maps to 'platinum'
};
```

**Consumer app:** `types/checkout.types.ts:71` uses `'diamond'` in string literals — this value does NOT exist in Source A (canonical), only in Source B.

**Impact:** Backend may assign `diamond` tier but consumer app's canonical `LoyaltyTier` enum rejects it as a type error. Users with diamond tier silently degraded to platinum.

**Fix:**
1. Add `DIAMOND = 'diamond'` to Source A (canonical).
2. Fix typo `DIMAOND` → `DIAMOND` in Source C.
3. Verify all 5 tiers have distinct `coinMultiplier` values.

**Status:** ACTIVE

---

### CT-HIGH-03 — PaymentMethod: Four Conflicting Definitions with Wrong Case

**Severity:** HIGH
**Affects:** Checkout flow, payment method selection, backend API calls

**Source A — `packages/shared-types/src/enums/index.ts` (4 values, lowercase):**
```typescript
export enum PaymentMethod {
  UPI = 'upi', CARD = 'card', WALLET = 'wallet', NETBANKING = 'netbanking',
}
```

**Consumer — `types/payment.types.ts` (6 values):**
```typescript
export type PaymentMethodType = 'upi' | 'card' | 'wallet' | 'netbanking' | 'cod' | 'rezcoins';
```
Adds `cod` and `rezcoins`. `rezcoins` is a UI-only concept mapped to `'wallet'` before backend calls (acceptable extension).

**Consumer — `types/checkout.types.ts` (interface, different shape):**
```typescript
export interface PaymentMethod {
  type: 'upi' | 'card' | 'netbanking' | 'wallet' | 'paylater' | 'emi';
  id: string; name: string; ...
}
```
Same name but completely different shape (object with fields vs enum). Comments misleadingly reference `@rez/shared-types/src/enums/PaymentMethod`.

**Consumer — `services/paymentMethodApi.ts:139-144` (UPPERCASE values):**
```typescript
export enum PaymentMethodType {
  CARD = 'CARD', BANK_ACCOUNT = 'BANK_ACCOUNT', UPI = 'UPI', WALLET = 'WALLET',
}
```
**Wrong case** — backend expects lowercase `'card'`, `'upi'`, `'wallet'`. This enum sends UPPERCASE to backend → silent payment method failures.

**Impact:** Payment method selection uses UPPERCASE enum values that backend rejects. Users select UPI but backend receives `'UPI'` (invalid) → payment silently fails.

**Fix:**
1. Delete `services/paymentMethodApi.ts` local enum. Import `PaymentMethod` from shared-types.
2. Extend `PaymentMethod` enum to include `'cod'` and `'paylater'` if they're valid backend values.
3. Add `CardType`, `CardBrand`, `BankAccountType` to shared-types if used across repos.
4. Keep `checkout.types.ts` interface as `CheckoutPaymentMethod` (different name).

**Status:** ACTIVE

---

### CT-HIGH-04 — AddressType: Case Mismatch + `OFFICE` vs `WORK`

**Severity:** HIGH
**Affects:** Address saving, address lookups, delivery routing
**Root Cause:** Different case conventions and value names across repos
**Already documented:** XREP-10, CS-E14

**rez-app-consumer (`app/account/addresses.tsx`):**
```typescript
type AddressType = 'HOME' | 'WORK' | 'OTHER';  // UPPERCASE values
```

**rezmerchant (`services/addressApi.ts`):**
```typescript
export enum AddressType {
  HOME = 'HOME', WORK = 'WORK', OTHER = 'OTHER',
}
```
Also UPPERCASE. But backend schema may expect lowercase.

**Consumer (`services/addressApi.ts` in rez-app-consumer):**
```typescript
export enum AddressType {
  HOME = 'home', OFFICE = 'work', OTHER = 'other',
}
```
**Lowercase values but `OFFICE = 'work'`** — the enum key is `OFFICE` but the value is `'work'`. If backend returns `'office'`, this enum won't match (expects `'work'`).

**Impact:** Addresses saved with type `'office'` from backend won't match `'work'` in the consumer enum → address type displays as empty/blank in UI.

**Fix:** Standardize: lowercase values (`'home'`, `'work'`, `'other'`), PascalCase keys (`Home`, `Work`, `Other`). Add `normalizeAddressType()`. Import from shared-types.

**Status:** ACTIVE (XREP-10)

---

### CT-HIGH-05 — BookingStatus: Four Incompatible Definitions Across Repos

**Severity:** HIGH
**Affects:** Booking management, service appointments, table reservations
**Root Cause:** No canonical BookingStatus; each service defines independently

**Canonical:** None — `BookingStatus` has no entry in `packages/shared-types/src/enums/index.ts`.

**Consumer app (`types/offers.types.ts`):**
```typescript
type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
```
**4 values.** Missing: `assigned`, `in_progress`, `expired`, `refunded`, `no_show`.

**Merchant service (`services/api/services.ts`):**
```typescript
type BookingStatus =
  | 'pending' | 'confirmed' | 'assigned' | 'in_progress'
  | 'completed' | 'cancelled' | 'no_show';
```
**7 values.** Missing: `expired`, `refunded`. Has `assigned` and `in_progress` that consumer lacks.

**AdBazaar (`src/types/index.ts`):**
```typescript
type BookingStatus =
  | 'inquiry' | 'quoted' | 'confirmed' | 'paid'
  | 'executing' | 'completed' | 'disputed' | 'cancelled';
```
**8 values.** Completely different vocabulary — `inquiry`, `quoted`, `executing`, `disputed` not present in any other definition.

**Backend (`rez-shared/src/types/booking.types.ts`):**
```typescript
export type BookingStatus =
  | 'pending' | 'confirmed' | 'assigned' | 'in_progress'
  | 'completed' | 'cancelled' | 'no_show' | 'refunded' | 'expired';
```
**9 values.** Most complete. Matches consumer on 4, merchant on 6, AdBazaar on 2.

**Impact:** Consumer app displays booking statuses that backend never returns (`assigned`, `in_progress`, `expired`). Backend returns statuses consumer doesn't know (`refunded`, `expired`). Booking status display shows raw values or empty strings.

**Fix:**
1. Designate `rez-shared/src/types/booking.types.ts` as canonical for BookingStatus.
2. Add BookingStatus enum to `packages/shared-types/src/enums/index.ts`.
3. Update consumer app `types/offers.types.ts` to import from shared-types.
4. Add `executing` and `disputed` from AdBazaar if applicable to other booking domains.

**Status:** ACTIVE

---

### CT-HIGH-06 — `rez-now` Zero Shared Imports — 16 Local Type Duplicates

**Severity:** HIGH
**Affects:** All rez-now screens and services
**Root Cause:** `rez-now` has no dependency on `rez-shared` or `packages/shared-types`
**Already partially documented:** XREP-04, CS-T1

`rez-now/package.json` has **zero imports** from shared packages. All types defined locally.

**Locally defined types in `rez-now/lib/types/index.ts`:**
- `WebOrderStatus` (6 values — different from canonical OrderStatus 11 values)
- `PaymentStatusResult` (different from PaymentStatus)
- `WalletBalance` (3-field vs 6-field canonical)
- All product, store, order, payment, address types

**Impact:** rez-now coin transactions use different types than wallet service → double-credit or lost credits. Order status display shows wrong values.

**Fix:** Add `@rez/shared-types` to `rez-now/package.json`. Replace all local type definitions with imports from shared-types. Ref: XREP-04.

**Status:** ACTIVE (XREP-04)

---

### CT-HIGH-07 — `rez-karma-service` Isolated — No Shared-Types Import

**Severity:** HIGH
**Affects:** Karma service, gamification, leaderboard
**Root Cause:** `rez-karma-service` depends on `@karim4987498/shared` (different package), NOT `@rez/shared-types`

`rez-karma-service/package.json` imports from `@karim4987498/shared` — not the REZ shared types package. All types defined locally in `src/types/index.ts`.

**Impact:** Karma profile fields diverge from `IKarmaProfile` in `packages/shared-types/src/entities/karma.ts`. Karma credits use wrong coin types (CT-HIGH-01). The canonical karma entity types are never used.

**Fix:**
1. Add `packages/shared-types` as a dependency to `rez-karma-service`.
2. Replace local karma types with imports from `packages/shared-types/src/entities/karma.ts`.
3. Use `normalizeCoinType()` for all coin type operations.

**Status:** ACTIVE

---

### CT-HIGH-08 — `data/walletData.ts` Duplicate `TransactionStatus` Enum — Governance Violation

**Severity:** HIGH
**Affects:** Wallet data, transaction display
**Root Cause:** Architecture Rule 4 violation ("No Bespoke Enums")
**Already documented:** Issue N-4 in AUDIT-VERIFY-2026-04-17.md

**File:** `rez-app-consumer/data/walletData.ts:306-310`
```typescript
export enum TransactionStatus {
  COMPLETED = 'completed', PENDING = 'pending', FAILED = 'failed',
}
```

This is a verbatim duplicate of `TransactionStatus` in `packages/shared-types/src/enums/index.ts`. The same file also imports `TransactionStatus` from `@/types/wallet.types` at line 13, creating two conflicting import paths.

**Additional:** `TransactionMetadata` interface defined twice (lines 145-171 and 303-329) — same content, duplicate TypeScript lint error.

**Impact:** TypeScript compilation may fail with "duplicate identifier" errors. Two different `TransactionStatus` values in scope → confusion about which one is used.

**Fix:**
1. Delete `TransactionStatus` enum from `data/walletData.ts`.
2. Import from `@/types/rez-shared-types` instead.
3. Deduplicate `TransactionMetadata` interface to single definition.
4. Run `scripts/arch-fitness/no-bespoke-enums.sh` to catch future violations.

**Status:** ACTIVE

---

## MEDIUM Issues

### CT-MED-01 — `OrderStatus` Canonical Incomplete — Missing 3 Terminal States

**Severity:** MEDIUM
**Canonical:** `packages/shared-types/src/enums/index.ts`

The canonical `OrderStatus` enum is missing 3 terminal states that exist in `rez-shared/src/orderStatuses.ts`:
- `failed_delivery` — order delivery attempt failed, requires reschedule or refund
- `return_requested` — customer requested return, under review
- `return_rejected` — return request denied

**Impact:** Backend returns `failed_delivery`, `return_requested`, or `return_rejected` but consumer app's type definition rejects them → TypeScript errors in production builds, runtime crashes when these statuses appear.

**Fix:** Add `FAILED_DELIVERY`, `RETURN_REQUESTED`, `RETURN_REJECTED` to canonical `OrderStatus` enum in `packages/shared-types`.

**Status:** ACTIVE

---

### CT-MED-02 — `LoyaltyTier` Coins Constant Has Typo + Wrong Mapping

**Severity:** MEDIUM
**File:** `rez-shared/src/constants/coins.ts`

```typescript
const LOYALTY_TIER = {
  BRONZE: 'bronze', SILVER: 'silver', GOLD: 'gold',
  PLATINUM: 'platinum', DIAMOND: 'platinum',  // DIAMOND → 'platinum' (wrong!)
  DIMAOND: 'platinum',  // TYPO: DIMAOND → 'platinum' (should be 'diamond')
};
```

Two bugs:
1. `DIAMOND` maps to `'platinum'` instead of `'diamond'`
2. `DIMAOND` is a typo that shadows the `DIAMOND` key (objects with same value win/lose unpredictably in JS)

**Impact:** Code using `LOYALTY_TIER['DIAMOND']` gets `'platinum'` instead of `'diamond'`. Users at diamond tier get platinum rewards.

**Fix:** Correct `DIAMOND: 'platinum'` → `DIAMOND: 'diamond'`. Remove `DIMAOND` entry entirely.

**Status:** ACTIVE

---

### CT-MED-03 — Merchant Service Separate `PaymentStatus` for Service Domain

**Severity:** MEDIUM
**File:** `rezmerchant/services/api/services.ts`

The merchant service defines its own `PaymentStatus` for service bookings:
```typescript
type PaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded' | 'failed';
```

This is a domain-specific type for service appointments, different from the order payment `PaymentStatus` (11 values). Same name, different domain, different values.

**Impact:** Type confusion when same variable name used across order and service payment contexts. No type error but wrong values accepted.

**Fix:** Rename to `ServicePaymentStatus` with a comment explaining it's for the service-booking domain. Import canonical `PaymentStatus` for order payments separately.

**Status:** ACTIVE

---

### CT-MED-04 — Admin App Reduced `OrderStatus` — Missing 4 Canonical Values

**Severity:** MEDIUM
**File:** `rez-app-admin/app/(dashboard)/rez-now-orders.tsx`

```typescript
type OrderStatus = 'all' | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
```

**7 values.** Canonical has 11. Missing: `dispatched`, `out_for_delivery`, `cancelling`, `returned`, `refunded`.

**Impact:** Admin can't filter orders by `returned`, `refunded`, `cancelling`, `out_for_delivery` statuses. These orders show up in default "all" filter but can't be isolated.

**Fix:** Import `OrderStatus` from `rez-shared-types`. Add `'dispatched'`, `'out_for_delivery'`, `'cancelling'`, `'returned'`, `'refunded'`.

**Status:** ACTIVE

---

### CT-MED-05 — Consumer App Duplicate `PaymentStatus` String Union

**Severity:** MEDIUM
**Files:** `rez-app-consumer/types/order.ts`, `rez-app-consumer/types/payment.types.ts`

Both files define identical `PaymentStatus` string unions:
```typescript
// Both files have:
export type PaymentStatus =
  | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  | 'expired' | 'refund_initiated' | 'refund_processing' | 'refunded'
  | 'refund_failed' | 'partially_refunded';
```

**Duplicate** — same name, same values, identical content, two files. This creates two separate type declarations in the same compilation unit that TypeScript silently merges. However, this pattern is fragile and easy to accidentally diverge.

**Impact:** Adding a new status to one file but not the other introduces silent divergence.

**Fix:** Delete one copy. Import `PaymentStatus` from `@/types/rez-shared-types` in both files.

**Status:** ACTIVE

---

### CT-MED-06 — `CoinType` COIN_TYPES Key Case Inconsistency

**Severity:** MEDIUM
**File:** `rez-app-consumer/types/checkout.types.ts:410-417`

```typescript
export const COIN_TYPES = {
  PROMO: 'promo', BRANDED: 'branded', PRIVE: 'prive',
  CASHBACK: 'cashback', REFERRAL: 'referral', REZ: 'rez',
} as const;
```

Uses UPPER_CASE keys (`PROMO`, `REZ`) while the canonical enum uses PascalCase (`PROMO`, `REZ`). Values match canonical, but the object structure differs.

**Impact:** `Object.keys(COIN_TYPES)` returns `['PROMO', 'BRANDED', ...]` vs enum iteration returns `['PROMO', 'BRANDED', ...]` — same, but fragile. Any code doing `CoinType.PROMO` (enum access) vs `COIN_TYPES.PROMO` (object access) works but looks inconsistent.

**Fix:** Import `CoinType` enum from shared-types and use it directly. Delete local `COIN_TYPES` const. Or use `as const` with PascalCase keys to match enum style.

**Status:** ACTIVE

---

### CT-MED-07 — `NetworkType` Enum Duplicated in Consumer App

**Severity:** MEDIUM
**Files:** `config/imageQuality.ts`, `services/prefetchService.ts`

Two different `NetworkType` enums with different values:

**`config/imageQuality.ts`:**
```typescript
enum NetworkType {
  WIFI = 'wifi', CELLULAR_4G = '4g', CELLULAR_3G = '3g',
  CELLULAR_2G = '2g', SLOW = 'slow', OFFLINE = 'offline',
}
```

**`services/prefetchService.ts`:**
```typescript
enum NetworkType {
  WIFI, CELLULAR_5G, CELLULAR_4G, CELLULAR_3G, CELLULAR_2G, OFFLINE, UNKNOWN,
}
```

Overlapping but different. `prefetchService.ts` has `CELLULAR_5G` and `UNKNOWN` that `imageQuality.ts` lacks. `imageQuality.ts` has `SLOW` that `prefetchService.ts` lacks.

**Impact:** Code in `prefetchService.ts` using `NetworkType.WIFI` imports from that file's enum. Code in `imageQuality.ts` using `NetworkType.WIFI` imports from its own. Same value (`'wifi'`) but different enum instances → comparison failures.

**Fix:** Create single `NetworkType` enum in `types/network.ts`. Import everywhere. Add `CELLULAR_5G` and `UNKNOWN`. Deprecate `SLOW`.

**Status:** ACTIVE

---

### CT-MED-08 — `DeliveryStatus` Has No Canonical — Overlaps with OrderStatus

**Severity:** MEDIUM
**File:** `rez-app-consumer/types/order.ts:34-43`

```typescript
export type DeliveryStatus =
  | 'pending' | 'confirmed' | 'preparing' | 'ready'
  | 'dispatched' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';
```

**9 values.** `DeliveryStatus` overlaps heavily with `OrderStatus` (which has 11 values including all 9 of these). There's no canonical definition of `DeliveryStatus` anywhere.

**Impact:** A delivery can be `'failed'` but `OrderStatus` doesn't have `'failed'` — it has `'failed_delivery'`. Confusion about which type to use for delivery-related status.

**Fix:** Define `DeliveryStatus` in `rez-shared/types/delivery.types.ts` as a separate domain type. Use `OrderStatus` for order lifecycle, `DeliveryStatus` for delivery-specific states.

**Status:** ACTIVE

---

### CT-MED-09 — Karma Service Uses String `'rez'` Instead of `CoinType.REZ`

**Severity:** MEDIUM
**Files:** `rez-karma-service/src/services/karmaService.ts`, `rez-karma-service/src/types/index.ts`

The karma service does NOT import `CoinType` from shared-types. Coin transactions use the string literal `'rez'` directly:
```typescript
coinType: 'rez'  // hardcoded, not CoinType.REZ
```

**Impact:** If backend ever changes the coin type string from `'rez'` to something else, karma service won't catch it via type checking. No compile-time safety.

**Fix:** Import `CoinType` from shared-types. Use `CoinType.REZ` instead of string literal `'rez'`.

**Status:** ACTIVE

---

## LOW Issues

### CT-LOW-01 — Consumer App `AddressType` Enum: `OFFICE` Key with `WORK` Value

**Severity:** LOW
**File:** `rez-app-consumer/services/addressApi.ts:6-10`

```typescript
export enum AddressType {
  HOME = 'home', OFFICE = 'work', OTHER = 'other',
}
```

Key is `OFFICE` but value is `'work'`. If backend returns `addressType: 'office'` (lowercase), this enum won't match (expects `'work'`).

**Fix:** Rename key to `Work` with value `'work'`. Import from shared-types.

**Status:** ACTIVE

---

### CT-LOW-02 — Merchant App `CardType`, `CardBrand`, `BankAccountType` — No Canonical

**Severity:** LOW
**File:** `rezmerchant/services/paymentMethodApi.ts`

Three enums defined locally with no canonical:
- `CardType`: `CREDIT`, `DEBIT`
- `CardBrand`: `VISA`, `MASTERCARD`, `AMEX`, `RUPAY`, `DISCOVER`, `OTHER`
- `BankAccountType`: `SAVINGS`, `CURRENT`

**Impact:** If another service (consumer app, payment gateway) uses different values, card/bank lookups fail.

**Fix:** Add to `packages/shared-types/src/enums/index.ts` if used across multiple services.

**Status:** ACTIVE

---

### CT-LOW-03 — `ImageContext` Enum Only in Consumer App

**Severity:** LOW
**File:** `rez-app-consumer/config/imageQuality.ts`

```typescript
export enum ImageContext {
  THUMBNAIL, CARD, DETAIL, HERO, AVATAR, ICON, BANNER, GALLERY, PREVIEW,
}
```

No canonical. Used for image quality decisions. If used across apps (consumer + merchant + admin), needs centralization.

**Fix:** Add to `packages/shared-types/src/enums/index.ts`.

**Status:** ACTIVE

---

### CT-LOW-04 — `UploadErrorCode` Not Centralized

**Severity:** LOW
**File:** `rez-app-consumer/types/upload.types.ts`

```typescript
export enum UploadErrorCode {
  NETWORK_ERROR, TIMEOUT, FILE_TOO_LARGE, INVALID_FILE_TYPE,
  FILE_NOT_FOUND, PERMISSION_DENIED, INSUFFICIENT_STORAGE,
  SERVER_ERROR, CANCELLED, VALIDATION_ERROR, UNKNOWN_ERROR, CHECKSUM_MISMATCH,
}
```

12 error codes. Not shared with merchant or admin apps.

**Fix:** Add to `packages/shared-types/src/enums/index.ts`.

**Status:** ACTIVE

---

### CT-LOW-05 — `ActivityType` Enum — Merchant Service Only

**Severity:** LOW
**File:** `rezmerchant/services/activityApi.ts`

```typescript
export enum ActivityType {
  ORDER, CASHBACK, REVIEW, VIDEO, PROJECT, VOUCHER, OFFICE, REFERRAL, WALLET, ACHIEVEMENT,
}
```

9 values. Not shared.

**Status:** ACTIVE (low priority — domain-specific)

---

### CT-LOW-06 — `GroupBuyingSocketEvents` — Consumer App Only

**Severity:** LOW
**File:** `rez-app-consumer/types/groupBuying.types.ts`

```typescript
export enum GroupBuyingSocketEvents {
  JOIN_GROUP_ROOM, LEAVE_GROUP_ROOM, GROUP_UPDATE, MEMBER_JOINED,
  MEMBER_LEFT, TIER_CHANGED, GROUP_READY, GROUP_EXPIRED,
  NEW_MESSAGE, SEND_MESSAGE,
}
```

10 socket events. Group-buying feature-specific.

**Status:** ACTIVE (low priority — feature-specific)

---

### CT-LOW-07 — `resolveOrderStatus` in Consumer App — Inconsistent with Canonical

**Severity:** LOW
**File:** `rez-app-consumer/utils/resolveOrderStatus.ts`

Status resolution utility that maps raw API status strings to display labels. May not handle all 14 canonical `OrderStatus` values (especially `failed_delivery`, `return_requested`, `return_rejected`).

**Impact:** Unknown statuses display as empty strings or "Unknown Status".

**Fix:** Add handling for all 14 canonical order statuses. Import canonical status list and assert exhaustiveness.

**Status:** ACTIVE

---

### CT-LOW-08 — `PaginatedResponse` Two Shapes in Consumer App

**Severity:** LOW
**Files:** `rez-app-consumer/types/api.types.ts:20`, `rez-app-consumer/types/store.types.ts:373`

Two different `PaginatedResponse` interfaces:
- `{ items: T[]; totalCount: number }` — `api.types.ts`
- `{ data: T[]; total: number; totalPages: number }` — `store.types.ts`

Same name, different shape. Already documented as API-05 in TYPE-DRIFT-MATRIX.md.

**Impact:** Services returning paginated data use different response shapes → client-side parsing must know which shape to expect.

**Fix:** Standardize on one canonical `PaginatedResponse<T>` shape. Add `totalPages` and `page` fields for cursor-less pagination.

**Status:** ACTIVE (API-05)

---

## Cross-Reference: Previously Documented Issues (Extended Below)

These issues are already tracked in other gap documents but are confirmed/extended by this scan:

| ID | Title | Status | Extended By |
|----|-------|--------|-------------|
| XREP-01 | WalletBalance has 3 different shapes | ACTIVE | Confirmed: rez-now (3 fields) vs shared-types (6 fields) |
| XREP-02 | WebOrderStatus 6 vs OrderStatus 15 | ACTIVE | Confirmed: rez-now only has 6 values |
| XREP-03 | normalizeLoyaltyTier conflicting | ACTIVE | Extended: `DIAMOND: 'platinum'` typo confirmed |
| XREP-04 | rez-now zero shared imports | ACTIVE | Confirmed: package.json has zero shared deps |
| XREP-06 | PaymentStatusResult 6 vs PaymentStatus 10 | ACTIVE | Extended: also missing `partially_refunded` |
| XREP-09 | Payment status 'completed' vs 'paid' | ACTIVE | Confirmed: consumer uses `completed`, backend returns `paid` |
| XREP-10 | AddressType case mismatch | ACTIVE | Extended: `OFFICE='work'` enum key/value mismatch |
| XREP-12 | CoinType 'branded_coin' vs 'branded' | **FIXED** | `branded_coin` no longer in codebase |
| XREP-15 | BookingStatus 4 vs 9 values | ACTIVE | Extended: 4 different definitions across repos |
| CS-E12 | normalizeLoyaltyTier conflict | ACTIVE | Confirmed with typo |
| CS-E14 | AddressType case | ACTIVE | Confirmed |
| CS-E15 | CoinType branded_coin | **FIXED** | Confirmed fixed |
| CS-E16 | BookingStatus mismatch | ACTIVE | Extended to 4 conflicting definitions |
| API-05 | PaginatedResponse two shapes | ACTIVE | Confirmed |

---

## Canonical Source Registry

### Designation: SINGLE Source of Truth Per Type

| Type | Designated Canonical | File |
|------|---------------------|------|
| `OrderStatus` | `rez-shared/src/orderStatuses.ts` | 14-value string union + sub-types |
| `PaymentStatus` | `packages/shared-types/src/enums/index.ts` | 11-value enum (+ `PARTIALLY_REFUNDED`) |
| `TransactionStatus` | `packages/shared-types/src/enums/index.ts` | 3-value enum (wire), separate display type |
| `BackendTransactionStatus` | `rez-shared/src/types/wallet.types.ts` | 6-value wire format |
| `CoinType` | `packages/shared-types/src/enums/index.ts` + `coinType.ts` | 6-value enum + normalization |
| `PaymentMethod` | `packages/shared-types/src/enums/index.ts` | 4-value enum (+ `cod`, `paylater` if needed) |
| `BookingStatus` | `rez-shared/src/types/booking.types.ts` | 9-value string union |
| `AddressType` | `packages/shared-types/src/enums/index.ts` (NEW) | `'home' \| 'work' \| 'other'` |
| `LoyaltyTier` | `packages/shared-types/src/enums/index.ts` | 5-value enum (add `diamond`) |
| `UserRole` | `packages/shared-types/src/enums/index.ts` | Existing |
| `VerificationStatus` | `packages/shared-types/src/enums/index.ts` | Existing |

---

## Quick Wins (Under 30 min Each)

1. **CT-LOW-02** — Fix `TransactionMetadata` duplicate in `walletApi.ts` (dedupe to one definition)
2. **CT-LOW-07** — Add `failed_delivery`, `return_requested`, `return_rejected` to `resolveOrderStatus.ts`
3. **CT-MED-02** — Fix `DIMAOND` typo in `rez-shared/src/constants/coins.ts`
4. **CT-LOW-01** — Rename `AddressType.OFFICE` → `AddressType.Work` in `services/addressApi.ts`
5. **CT-LOW-08** — Standardize `PaginatedResponse` to single shape in `types/api.types.ts`

---

## Medium Effort (1-4 hours Each)

1. **CT-CRIT-01** — Consolidate `OrderStatus` canonical: add missing 3 values to `packages/shared-types`
2. **CT-CRIT-02** — Consolidate `PaymentStatus`: add `PARTIALLY_REFUNDED` to `rez-shared/paymentStatuses.ts`
3. **CT-CRIT-03** — Remove duplicate `TransactionStatus` from `data/walletData.ts`
4. **CT-HIGH-03** — Delete `paymentMethodApi.ts` uppercase enum; import from shared-types
5. **CT-MED-07** — Merge `NetworkType` enums into single `types/network.ts`
6. **CT-HIGH-05** — Add `BookingStatus` to `packages/shared-types/src/enums/index.ts`

---

## Long Term (1+ days Each)

1. **CT-HIGH-06** — Add `@rez/shared-types` to `rez-now/package.json`; migrate all local types
2. **CT-HIGH-07** — Add `packages/shared-types` to `rez-karma-service`; migrate karma types to `IKarmaProfile`
3. **CT-HIGH-01** — Extend `normalizeCoinType()` with 12 unmapped legacy variants

---

## Summary Count

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 3 | All ACTIVE |
| HIGH | 8 | All ACTIVE |
| MEDIUM | 9 | All ACTIVE |
| LOW | 8 | All ACTIVE |
| **TOTAL** | **28** | **0 FIXED** |

---

*Generated: 2026-04-17*
*Method: 4 parallel agent scans across all repos*
