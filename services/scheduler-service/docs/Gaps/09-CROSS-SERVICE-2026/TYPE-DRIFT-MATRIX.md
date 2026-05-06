# Type/Enum Drift Matrix — All Repos

**Date:** 2026-04-16
**Scope:** All codebases

---

## Coin Type Enums

| Repo | File | `rez` | `prive` | `branded` | `promo` | `cashback` | `referral` |
|------|------|:-----:|:-------:|:---------:|:-------:|:----------:|:----------:|
| **Gen 1-7** | `rezbackend/constants/coinTypes.ts` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Gen 1-7** | `rez-wallet-service/Wallet.ts` | ✓ | ✓ | ✓ | ✓ | **✗** | **✗** |
| **Gen 1-7** | `rez-merchant-service/Wallet.ts` | ✓ | ✓ | **?** | **?** | **?** | **?** |
| **Gen 1-7** | `LedgerEntry.coinType` | ✓ | ✓ | **?** | **?** | **✗** | **✗** |
| **AdBazaar** | N/A (no wallet) | N/A | N/A | N/A | N/A | N/A | N/A |
| **AdBazaar** | QR scan: 2 coin types | scan | bonus | N/A | N/A | N/A | N/A |

---

## Booking/Order Status Enums

| Repo | File | Confirmed | Paid | Executing | Completed | Cancelled | Disputed | Refunded |
|------|------|:---------:|:----:|:---------:|:---------:|:---------:|:--------:|:--------:|
| **Gen 1-7** | `OrderStatus` enum | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ |
| **Gen 1-7** | `PaymentStatus` enum | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ |
| **AdBazaar** | `BookingStatus` enum | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **?** |
| **Rendez** | `OrderStatus` | ✓ | ✓ | ✗ | ✓ | ✓ | **?** | **?** |

### Status Transition Issues

| Repo | Problem |
|------|---------|
| Gen 1-7 | `OrderStatus` and `PaymentStatus` are separate enums — desync possible |
| AdBazaar | `paid` status counted as pending payout (should only be `executing`) |
| AdBazaar | No `refunded` status — refunds stay in `paid` |
| Rendez | `completed` → `cancelled` transition allowed (should be one-way) |

---

## User Role Enums

| Repo | File | buyer | vendor | admin | merchant | partner |
|------|------|:-----:|:------:|:-----:|:--------:|:-------:|
| **Gen 1-7** | `UserRole` enum | ✓ | ✓ | ✓ | ✗ | ✓ |
| **Gen 1-7** | `VendorRole` enum | ✗ | ✓ | ✗ | ✓ | ✗ |
| **AdBazaar** | `user.role` field | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Rendez** | `user.role` | ✓ | ✓ | **?** | ✗ | ✗ |

---

## IKP (Karma) Level Enums

| Repo | File | values |
|------|------|--------|
| Gen 8 | `shared-types/enums/karma.ts` | canonical: BRONZE, SILVER, GOLD, PLATINUM, DIAMOND |
| Gen 8 | `karma-service/KarmaLevel.ts` | Local enum — unverified against canonical |
| Gen 8 | `karma-ui/karmaService.ts` | Uses string literals — no enum reference |

---

## Shared Types Package Usage

| Repo | Uses `rez-shared`? | Status |
|------|-------------------|--------|
| `rezbackend` | Partial | Drift issues (SD-08) |
| `rez-wallet-service` | Partial | Drift issues (SD-08) |
| `rez-merchant-service` | Partial | Drift issues (SD-08) |
| `rez-payment-service` | No | Local types only |
| `rez-order-service` | No | Local types only |
| `rez-karma-service` | **Yes** | Fixed in Gen 8 |
| `rez-gamification-service` | No | Local types only |
| `rez-now` | **No — zero imports** | CRITICAL — 16 duplicate types (Gen 11) |
| `rez-app-consumer` | Partial | Missing IKarmaProfile fields (Gen 11) |
| `adBazaar` | No | Zod schemas (local) |
| `Rendez` | No | TypeScript interfaces (local) |

### Gen 11 — Consumer App Type Drift (2026-04-16)

| Entity | Local (consumer/rez-now) | Canonical (rez-shared) | Gap |
|--------|--------------------------|----------------------|-----|
| `WalletBalance` | `{ coins, rupees, tier }` (3 shapes) | `{ rez, prive, promo, branded, cashback, total }` | XREP-01, CS-T6 |
| `WebOrderStatus` | 6 values | 15 values | XREP-02, CS-E9 |
| `PaymentStatusResult` | 6 values | 10 values | XREP-06, CS-E13 |
| `PaymentStatus` terminal | `'completed'` | `'paid'` | NA-CRIT-08, CS-E10 |
| `KarmaProfile` | 14 fields | 20 fields (IKarmaProfile) | XREP-08, CS-T8 |
| `CoinType` (branded) | `'branded_coin'` | `'branded'` | XREP-12, CS-E15 |
| `BookingStatus` | 4 values | 9 values | XREP-15, CS-E16 |
| `AddressType` | `'HOME'`, `'WORK'` | `'home'`, `'work'` | XREP-10, CS-E14 |
| `WalletTransaction.type` | `'credit' \| 'debit'` | 6-value CoinTransactionType | XREP-14, CS-E17 |
| `normalizeLoyaltyTier` | Two conflicting mappings | N/A (internal conflict) | XREP-03, CS-E12 |
| `coinType` credit vs query | `'rez'` vs `'karma_points'` | N/A (mismatch) | XREP-07, CS-E11 |

### Missing `@/types/unified` (Build Failure — Gen 11)

| File | Import | Status |
|------|--------|--------|
| `services/ordersApi.ts` | `@/types/unified` | CRITICAL — build fails |
| `services/cartApi.ts` | `@/types/unified` | CRITICAL — build fails |
| `services/storesApi.ts` | `@/types/unified` | CRITICAL — build fails |
| `services/productsApi.ts` | `@/types/unified` | CRITICAL — build fails |
| `services/authApi.ts` | `@/types/unified` | CRITICAL — build fails |
| `contexts/AuthContext.tsx` | `@/types/unified` | CRITICAL — build fails |
| `contexts/CartContext.tsx` | `@/types/unified` | CRITICAL — build fails |

### Shared Types Not Used Where They Should Be

| Entity | Canonical Location | Used In |
|--------|-------------------|---------|
| `IKarmaProfile` | `rez-shared/types/karma.ts` | `karma-service` ✓, `karma-ui` ✗ |
| `IUser` | `rez-shared/types/user.ts` | None consistently |
| `CoinType` | `rez-shared/enums/coin.ts` | `rezbackend` partial |
| `BookingStatus` | `rez-shared/enums/booking.ts` | AdBazaar ✗ (local enum) |
| `OrderStatus` | `rez-shared/enums/order.ts` | Gen 1-7 partial |

---

## Fix: Centralized Enum/Type Registry

All enums and types should be defined once in `rez-shared` and imported everywhere:

```typescript
// rez-shared/src/enums/index.ts
export { CoinType } from './coin'
export { BookingStatus, BookingStatusTransitions } from './booking'
export { UserRole, VendorRole } from './user'
export { KarmaLevel } from './karma'
export { OrderStatus, PaymentStatus } from './order'

// rez-shared/src/types/index.ts
export { IUser, IUserProfile } from './user'
export { IKarmaProfile, IEarnRecord } from './karma'
export { IWallet, ILedgerEntry, ICoinTransaction } from './wallet'
export { IBooking, IPayment, IRefund } from './booking'
```

All codebases should import from `rez-shared`, not define local enums.

---

## Consumer App API Contract Mismatches (Gen 11 — 2026-04-16)

**Scope:** Frontend types vs. backend API responses in `rez-app-consumer/src/services/`

| # | Mismatch | File | Expected / Canonical | Actual / Bug | Severity |
|---|----------|------|---------------------|--------------|----------|
| API-01 | `CoinType` missing `cashback`/`referral` | `types/wallet.ts:25` | `['rez','prive','branded','promo','cashback','referral']` from `coinTypes.ts` | `['rez','promo','branded','prive']` — TypeScript rejects valid backend values | **CRITICAL** |
| API-02 | Three different `PaymentStatus` unions | `payment.types.ts` vs `order.ts` vs `paymentService.ts` | One canonical source | 3 different literal unions — `'paid'` in `order.ts`, missing refund states in `paymentService.ts` | **HIGH** |
| API-03 | `pointsApi.getBalance()` reads wrong wallet paths | `pointsApi.ts:107-116` | `w.balance.available` = available; `w.totalValue` or `w.statistics.totalEarned` = lifetime | `earned` ← `w.balance.available` (wrong); `lifetimeEarned` ← `w.balance.total` (current balance, not lifetime); `spent` hardcoded to `0` | **HIGH** |
| API-04 | `getProductDiscount()` crashes on optional `price` | `product-unified.types.ts:325-330` | `product.price` is optional — needs null guard | Reads `.discount`, `.original`, `.current` on undefined `product.price` — TypeError at runtime | **HIGH** |
| API-05 | Two `PaginatedResponse` interfaces with different fields | `api.types.ts:20` vs `store.types.ts:373` | One canonical shape | `{ items, totalCount }` vs `{ data, total, totalPages }` — same name, different shapes | **MEDIUM** |
| API-06 | `FulfillmentType` values unverified against backend | `checkout.types.ts:7` | Canonical `@rez/shared` (not verified) | Hardcodes `'delivery' \| 'pickup' \| 'drive_thru' \| 'dine_in'` — backend may use different values | **MEDIUM** |
| API-07 | `Expl oreStore.cashback` is string, `cashbackRate` is number | `exploreApi.ts:20-21` | Consistent typing | `cashback: string` ("5%") vs `cashbackRate: number` — arithmetic on `.cashback` returns NaN | **MEDIUM** |
| API-08 | `COIN_TYPES` constant missing 2 backend types | `checkout.types.ts:406` | Backend: `['rez','prive','branded','promo']` | Only `REZ` and `PROMO` defined — unused but would silently fail for `branded`/`prive` | **LOW** |
| API-09 | Duplicate `TransactionMetadata` interface | `walletApi.ts:145, 303` | One definition | Same interface defined twice with identical content | **LOW** |
| API-10 | `performDailyCheckIn` field name mismatch | `pointsApi.ts:422-429` vs `gamificationApi.ts:317-343` | `coinsEarned`, `bonusEarned` | `pointsApi.ts` expects `pointsEarned`, `bonus`, `nextReward` — all undefined; `gamificationApi.ts` normalizes correctly | **MEDIUM** |
| API-11 | `ValidateCouponResponse.type` case sensitivity | `couponApi.ts:139` | Matches backend case | `'PERCENTAGE' \| 'FIXED'` uppercase — backend may send lowercase | **LOW** |
| API-12 | `apiClient` unwrap depth inconsistency | Multiple services | Consistent single-unwrap | `feedApi.ts` double-unwrap `response.data.data`; most services single-unwrap; batch deduplication may alter depth | **MEDIUM** |

### Unread/Unverified Files (Degraded Confidence)

The following files were not directly audited — findings are from agent reports with limited file access. Treat as **DEFERRED** pending direct read:

| File | Reason Not Audited | Known Issues |
|------|-------------------|--------------|
| `rendez-app/src/screens/ApplicantsScreen.tsx` | Agent report only | None documented |
| `rendez-app/src/screens/RequestInboxScreen.tsx` | Agent report only | None documented |
| `rendez-app/src/screens/SettingsScreen.tsx` | Agent report only | None documented |
| `rendez-app/src/screens/OnboardingScreen.tsx` | Agent report only | None documented |
| `rendez-app/src/screens/ExperienceWalletScreen.tsx` | Agent report only | None documented |
| `rendez-admin/src/app/users/page.tsx` | Agent report only | RZ-A-H5 (no pagination) |
| `rendez-admin/src/app/moderation/page.tsx` | Agent report only | None documented |
| `rendez-admin/src/app/fraud/page.tsx` | Agent report only | None documented |
| `rendez-backend/src/services/ModerationService.ts` | Agent report only | None documented |
| `rendez-backend/src/services/ReferralService.ts` | Agent report only | `referredBy`, `referralCount`, `inviteCode` in schema unverified |
| `rendez-backend/src/services/MessageRequestService.ts` | Agent report only | RZ-B-M5 (no pagination) |
| `rendez-backend/src/middleware/rateLimiter.ts` | Agent report only | None documented |
| `rendez-backend/src/middleware/partnerAudit.ts` | Agent report only | None documented |
| `rendez-backend/src/routes/experienceCredits.ts` | Agent report only | RZ-B-M10 (unnecessary DB re-fetch) |
| `rendez-backend/src/routes/requests.ts` | Agent report only | RZ-B-M5 (no pagination) |
| `rendez-backend/src/workers/trustDecayWorker.ts` | Agent report only | RZ-B-M6 (loads all profiles into memory) |
| `rendez-backend/src/workers/planWorkers.ts` | Agent report only | RZ-B-M1 (no concurrency) |
| `rendez-backend/src/jobs/queue.ts` | Agent report only | None documented |
| `rendez-backend/src/config/database.ts` | Agent report only | Prisma singleton not verified |
| `rendez-app/src/store/authStore.ts` | Agent report only | Zustand store logic (logout cascade, multi-tab sync) not audited |

### Additional Cross-Repo Field Discrepancies (Beyond Enum/Type Drift)

| Category | Field | ReZ Consumer App | ReZ Merchant App | Rendez Backend | Canonical |
|----------|-------|-----------------|-----------------|----------------|-----------|
| User ID | Primary key | `_id` (MongoDB ObjectId) | `id` | `id` (Prisma cuid) | `_id` in shared-types |
| User phone | Phone field | `phoneNumber` | `phone` | `phone` | `phoneNumber` in shared-types |
| Order delivery fee | Fee naming | `totals.delivery` | `totals.delivery` | N/A (Rendez has no order model) | `delivery` |
| Order delivery fee alt names | Fee alternatives | `deliveryFee`, `shipping`, `delivery_fee`, `shippingCost` | `delivery` | — | `delivery` |
| Order item total | Item price field | `subtotal` (canonical), `totalPrice` (legacy) | `total` | — | `subtotal` |
| Payment status | Terminal success | `'completed'` | `'paid'` | — | `'paid'` |
| Price model | Pricing structure | Flat `price: number` + `pricing: { selling, mrp }` (4 shapes) | `{ regular, sale, cost }` | — | `{ selling, mrp }` |
| Coordinates | Geo format | `[lng, lat]` (GeoJSON tuple) in store types; `{ lat, lng }` object in cart | — | `lat`, `lng` (separate Float) | GeoJSON `[lng, lat]` |
| Product images | Image shape | `{ id, uri, ... }` | `{ url, alt, isPrimary }` | — | `{ url?, alt?, isPrimary? }` |
| Merchant address | Street field | `address` | `street` | — | `address` |
| Merchant pincode | Postal code | `pincode` | `zipCode` | — | `pincode` |
| Socket rate limiter | Persistence | In-memory Map — lost on restart | N/A | In-memory `msgRateLimits` Map — lost on restart | Redis with TTL |
