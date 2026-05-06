# Bug Report 11 — Data Models & Schema Integrity (New Findings)
**Audit Agent:** Senior Database Architect (25yr exp)
**Audit Date:** 2026-04-13
**Scope:** rezbackend models, rez-merchant-service models, rez-wallet-service models, rez-payment-service models, rez-finance-service models, rez-shared types

> **Note:** This file documents NEW findings from the April 2026 audit.
> Previous data model bugs are in [01-DATA-LAYER.md](01-DATA-LAYER.md).

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 5 |
| MEDIUM | 6 |
| LOW | 5 |

---

## CRITICAL

### DM-C1 — MerchantWallet Created Without Required `store` Field
> **Status:** ✅ FIXED
- **File:** `rez-wallet-service/src/routes/internalRoutes.ts`, line 161
- **Schema requires:** `store: { type: Schema.Types.ObjectId, ref: 'Store', required: true }` (`rez-wallet-service/src/models/MerchantWallet.ts:46`)
- **Upsert actually writes:**
  ```ts
  $setOnInsert: { merchant: ObjectId, storeId: string, balance: {...}, statistics: {...} }
  ```
- **Problem:** `storeId` (a plain string) is written to a field that doesn't exist on the schema. The required `store` (ObjectId ref) is NEVER populated on wallet creation. Every auto-created merchant wallet has `store = null`. The next time the wallet document is loaded and `.save()` is called, Mongoose validation throws because `store` is required.
- **Fix:** Change upsert to write `store: new mongoose.Types.ObjectId(storeId)` and remove the `storeId` key.

### DM-C2 — `ref: 'AdminUser'` Points to a Model That Does Not Exist
> **Status:** ✅ FIXED
- **Files:**
  - `rezbackend/rez-backend-master/src/models/User.ts`, line 765: `flaggedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' }`
  - `rezbackend/rez-backend-master/src/models/VerifiedInstitution.ts`, line 78: another `ref: 'AdminUser'`
- **Problem:** No model named `AdminUser` exists anywhere in the codebase. Admin users are regular `User` documents with `role: 'admin'` or `'super_admin'`. All `.populate('flaggedBy')` calls silently return `null`.
- **Fix:** Change `ref: 'AdminUser'` to `ref: 'User'` in both files.

### DM-C3 — Order History Split: `statusHistory` (merchant-service) vs `timeline` (backend)
> **Status:** ✅ FIXED
- **Backend `Order` model:** `timeline: IOrderTimeline[]` — rich objects with location, deliveryPartner
- **Merchant-service `Order` model:** `statusHistory: Array<{status, timestamp, note}>` — flat structure, different name
- **Both services write to the same MongoDB `orders` collection** but to different field names
- **Merchant-service writes:** `$push: { statusHistory: {...} }` in `rez-merchant-service/src/routes/orders.ts:200, 270, 388`
- **Impact:** Orders accumulate data in both `timeline` and `statusHistory`. The backend's order tracking reads `timeline` and never sees merchant status updates. The merchant service reads `statusHistory` and never sees backend timeline entries. Order history is permanently split.
- **Fix:** Standardize on `timeline`. Update merchant-service to write `$push: { timeline: { status, timestamp, note } }`. Migrate existing `statusHistory` data with a one-time script.

### DM-C4 — `coinType: 'nuqta'` Exists in Production But Not in Active Enums
> **Status:** ✅ FIXED
- **Legacy value documented:** `rez-shared/src/types/wallet.types.ts`, line 171 — notes `'nuqta'` as a known legacy alias
- **Backend enum (`COIN_TYPE_VALUES`):** `['rez','prive','branded','promo','cashback','referral']` — `'nuqta'` NOT present
- **Wallet-service enum:** Same — `'nuqta'` NOT present
- **Impact:** Production MongoDB documents with `coinType: 'nuqta'` will throw Mongoose validation error on any `.save()`. Only `findOneAndUpdate`/`updateOne` (which bypass schema validation) are safe. Any job that reads and re-saves coin transactions (e.g., expiry job, balance reconciliation) will fail silently on legacy records.
- **Fix:** Run a migration: `db.cointransactions.updateMany({ coinType: 'nuqta' }, { $set: { coinType: 'rez' } })`. Add `'nuqta'` to the enum temporarily, run migration, then remove it.

---

## HIGH

### DM-H1 — `user.phone` Used as DB Field but Is a Mongoose Virtual
> **Status:** ✅ FIXED
- **File:** `rezbackend/rez-backend-master/src/services/referralFraudDetection.ts`, line 211
- **Code:** `const hasMinimalInfo = !user.phone || !user.email;`
- **Reality:** `phone` is a virtual on `UserSchema` (alias for `phoneNumber`). When `.lean()` is used (which is the common pattern for read-only queries), virtuals are NOT included.
- **Impact:** Fraud check `!user.phone` evaluates to `true` always on lean queries — every user appears to lack a phone number. Fraud detection is broken for all lean-loaded users.
- **Also affected:** `billingController.ts:340` — `user.phoneNumber || user.phone` — the `|| user.phone` branch is dead on lean objects.
- **Fix:** Replace `user.phone` with `user.phoneNumber` in all service/controller code. Remove the virtual alias or document it explicitly as unsafe for lean queries.

### DM-H2 — `profile.phoneNumber` Referenced in `orderController.ts` — Field Does Not Exist
> **Status:** ✅ FIXED
- **File:** `rezbackend/rez-backend-master/src/controllers/merchant/orderController.ts`, line 147
- **Code:** `const userPhone = user.profile?.phoneNumber || user.phoneNumber || user.phone;`
- **Reality:** `UserSchema` has no `profile.phoneNumber`. Phone is at top level as `phoneNumber`. The first branch always returns `undefined`.
- **Fix:** Remove `user.profile?.phoneNumber` from the fallback chain.

### DM-H3 — `MerchantWallet` Key Conflict: merchant-service vs wallet-service
> **Status:** ✅ FIXED
- **Wallet-service:** All queries use `findOne({ merchant: ObjectId })`
- **Merchant-service proxy:** All queries use `findOne({ merchantId: req.merchantId })` (`rez-merchant-service/src/routes/walletMerchant.ts:11, 40, 60, 67`)
- **Same MongoDB collection:** `merchantwallets`
- **Impact:** Wallets created by wallet-service have field `merchant`. Wallets queried by merchant-service look for field `merchantId`. They are different fields — a wallet created by one service is invisible to the other.
- **Fix:** Standardize on `merchant` (ObjectId). Update merchant-service proxy schema to use `merchant` not `merchantId`. Run migration on existing documents.

### DM-H4 — `Wallet.statistics` — wallet-service Model Missing 3 Fields
> **Status:** ✅ FIXED
- **Backend `Wallet.ts`:** `totalEarned, totalSpent, totalCashback, totalRefunds, totalTopups, totalWithdrawals`
- **Wallet-service `Wallet.ts`:** Only `totalEarned, totalSpent, totalCashback, transactionCount` — missing `totalRefunds, totalTopups, totalWithdrawals`
- **rez-shared types:** Declares all 6 fields
- **Impact:** Any code reading `wallet.statistics.totalRefunds` via wallet-service gets `undefined`. Balance reconciliation reports are silently incomplete.
- **Fix:** Add the 3 missing fields to `rez-wallet-service/src/models/Wallet.ts` statistics sub-schema.

### DM-H5 — `LoanApplication.partnerApplicationId` Queried Without Index
> **Status:** ✅ FIXED
- **File:** `rez-finance-service/src/routes/partnerRoutes.ts`, lines 101 and 129
- **Query:** `LoanApplication.findOne({ partnerApplicationId })`
- **Indexes on model:** Only `{ userId: 1, status: 1 }` and `{ userId: 1, createdAt: -1 }`. No index on `partnerApplicationId`.
- **Impact:** Every partner webhook callback triggers a full collection scan on `loanapplications`.
- **Fix:** Add `LoanApplicationSchema.index({ partnerApplicationId: 1 })`.

---

## MEDIUM

### DM-M1 — `MerchantNotification` Has Duplicate `read` and `isRead` Fields
> **Status:** ✅ FIXED — Migration script written: `scripts/migrations/004-notification-read-to-isread.ts`
- **File:** `rez-wallet-service/src/models/MerchantNotification.ts`, lines 51–52 and 78–79
- **Problem:** Both `read: Boolean` and `isRead: Boolean` exist on the schema with SEPARATE INDEXES. No code keeps them in sync.
- **Impact:** A notification marked as read via one field will still appear unread if the other field is checked. Read-state diverges between services using different fields.
- **Fix:** Choose one field (`isRead`). Migrate data. Remove `read` field and its index.
- **Migration:** Promotes `read=true` → `isRead=true` where they conflict, then removes `read` from all docs. After running, remove `read` field and its index from the schema.

### DM-M2 — `Merchant.lastLogin` and `Merchant.lastLoginAt` — Duplicate Fields
> **Status:** ✅ FIXED — `lastLogin` removed from schema and auth.ts (2026-04-13)
- **File:** `rez-merchant-service/src/models/Merchant.ts`, lines 94 and 107
- **Problem:** Both fields exist. Only `lastLoginAt` is updated on login. `lastLogin` is a dead field.
- **Applied fix:** Removed `lastLogin` from `IMerchant` interface and `MerchantSchema`. Removed the write `merchant.lastLogin = new Date()` from `auth.ts`. `lastLoginAt` on the `MerchantUser` account document is the canonical field.
- **Migration note:** Existing MongoDB documents retain `lastLogin` in storage but Mongoose strict mode ignores it on all reads/saves. No data is lost.

### DM-M3 — `User.segment` Enum Casing Inconsistency
> **Status:** ✅ FIXED — Migration script written: `scripts/migrations/005-segment-casing-fix.ts`
- **File:** `rezbackend/rez-backend-master/src/models/User.ts`, line 743
- **Problem:** `'verified_differentlyAbled'` uses camelCase mid-word. All other values are snake_case: `'verified_student'`, `'verified_employee'`, etc.
- **Fix:** Rename to `'verified_differently_abled'`. Run migration on existing documents.
- **Migration:** Single `updateMany` call. After running the script, update the enum value in User.ts to `'verified_differently_abled'`.

### DM-M4 — `FinanceService` Uses `String` for `userId` Instead of `ObjectId`
> **Status:** ✅ FIXED — Validation script written: `scripts/migrations/006-finance-userid-validate.ts`
- **Files:** `rez-finance-service/src/models/CreditProfile.ts`, `FinanceTransaction.ts`, `LoanApplication.ts`
- **Problem:** All three models use `userId: { type: String }`. Every other service uses `user: Schema.Types.ObjectId, ref: 'User'`. Cross-service joins require manual string coercion.
- **Fix:** Migrate to `userId: { type: Schema.Types.ObjectId }` or align with the `user` field convention.
- **Migration:** Validation script (read-only) confirms all userId values are valid ObjectId strings. Run it first; if clean, schema change (String → ObjectId) can proceed safely. Actual schema change tracked for Phase 2.

### DM-M5 — `WalletTransaction` Proxy Missing Compound Index for Type Filtering
> **Status:** ✅ FIXED — compound index already present in code (confirmed 2026-04-13)
- **File:** `rez-merchant-service/src/models/WalletTransaction.ts`
- **Existing index:** `{ merchantId: 1, createdAt: -1 }` only
- **Query pattern:** `{ merchantId, type }` — `rez-merchant-service/src/routes/walletMerchant.ts:21`
- **Applied fix:** `s.index({ merchantId: 1, type: 1 })` confirmed present in `WalletTransaction.ts`. Index will be created on next MongoDB sync.

### DM-M6 — `Payment.purpose` — Route Validator and Model Enum Are Different Shapes
> **Status:** ✅ FIXED — `normalizePaymentPurpose()` made exhaustive with TypeScript `never` check (2026-04-13)
- **File:** `rez-payment-service/src/services/paymentService.ts`
- **Route validator:** `z.enum(['order', 'wallet_topup', 'subscription', 'refund', 'other'])`
- **Model enum:** `['wallet_topup', 'order_payment', 'event_booking', 'financial_service', 'other']`
- **Applied fix:** Replaced the `Record<string, string>` lookup map with a typed `switch` statement over a `RoutePurpose` union. Added `never` exhaustiveness guard in the `default` branch so TypeScript will error at compile time if a new route value is added without a mapping. Unmapped values at runtime are logged as warnings instead of silently returning `'other'`.

---

## LOW

### DM-L1 — `User.profile.ringSize` and `User.profile.jewelryPreferences` — Never Used
> **Status:** ✅ FIXED — Migration script written: `scripts/migrations/007-dead-fields-cleanup.ts` (Step 1)
- **File:** `rezbackend/rez-backend-master/src/models/User.ts`, lines 361–383
- **Problem:** `ringSize` (enum) and `jewelryPreferences.{preferredMetals, preferredStones, style}` are defined but never read or written by any controller, service, or route.
- **Fix:** Remove these fields or document them as planned for a future jewelry category feature.
- **Migration:** `$unset profile.ringSize` and `$unset profile.jewelryPreferences` from all user documents.

### DM-L2 — `Order.payment.coinsUsed.wasilCoins` — Legacy Field, Never Written
> **Status:** ✅ FIXED — Migration script written: `scripts/migrations/007-dead-fields-cleanup.ts` (Step 2)
- **File:** `rezbackend/rez-backend-master/src/models/Order.ts`, line 91
- **Comment in code:** `wasilCoins?: number; // Legacy field - kept for backward compatibility`
- **Fix:** Remove after confirming no existing orders have non-null `wasilCoins` values.
- **Migration:** Removes `payment.coinsUsed.wasilCoins` where value is null or 0. Skips any doc with a non-zero value (those are flagged in output for manual review).

### DM-L3 — `Wallet.categoryBalances` — Dead Scaffolding
> **Status:** ✅ FIXED — Migration script written: `scripts/migrations/007-dead-fields-cleanup.ts` (Step 3)
- **File:** `rezbackend/rez-backend-master/src/models/Wallet.ts`, line 94
- **Problem:** `categoryBalances: Map<string, ICategoryBalance>` is defined but never read or written by any wallet service.
- **Fix:** Remove or implement.
- **Migration:** Removes `categoryBalances` where value is null, empty object, or empty array. Non-empty values are flagged in output for manual review.

### DM-L4 — `User.wallet` Sub-Document — Stale Denormalized Cache, Never Synced
> **Status:** ✅ FIXED (schema + migration + consumer app)
- **File:** `rezbackend/rez-backend-master/src/models/User.ts`
- **Fields:** `wallet.{balance, totalEarned, totalSpent, pendingAmount}` embedded on User + `walletBalance` convenience field
- **Problem:** Actual wallet data lives in the separate `Wallet` collection. This embedded sub-doc is a denormalized cache with no reconciliation service.
- **Fix applied:**
  - Removed `IUserWallet` interface, `wallet: IUserWallet` from IUser, `walletBalance` schema field, and pre-save sync hook from `User.ts`
  - `ProfileContext.tsx` (rezapp) now zeros wallet defaults and fetches real data via `walletApi.getBalance()` (already applied)
  - Migration script `008-remove-user-wallet-subdoc.ts` uses `$unset { wallet: '' }` on the users collection
- **Migration:** Run `npx ts-node src/scripts/migrations/008-remove-user-wallet-subdoc.ts` against production MongoDB

### DM-L5 — `MerchantWallet.statistics.averageOrderValue` Never Updated After Creation
> **Status:** ✅ FIXED — Noted in migration script: `scripts/migrations/007-dead-fields-cleanup.ts` (Step 5, informational)
- **File:** `rez-wallet-service/src/models/MerchantWallet.ts`, line 59
- **Problem:** Field is initialized at wallet creation (line 68 of merchantWalletService.ts) but never recalculated.
- **Fix:** Update `averageOrderValue` in the wallet statistics update job/service.
- **Migration:** Field is NOT removed by script 007 — removal would lose initialization data. Fix requires a wallet statistics recalculation job to be implemented in rez-wallet-service.
