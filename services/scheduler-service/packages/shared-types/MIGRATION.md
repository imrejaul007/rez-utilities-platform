# Migration Guide: Adopting @rez/shared-types

This guide provides step-by-step instructions for migrating backend services to use the canonical type definitions from the `@rez/shared-types` package.

## Table of Contents

1. [Services to Migrate](#services-to-migrate)
2. [Migration Steps](#migration-steps)
3. [Service-by-Service Details](#service-by-service-details)
4. [Verification Checklist](#verification-checklist)
5. [Incremental Migration Strategy](#incremental-migration-strategy)

## Services to Migrate

The following services currently have local type definitions and need to migrate to @rez/shared-types:

1. **rez-auth-service** — User auth types
2. **rez-payment-service** — Payment models and FSM
3. **rez-wallet-service** — Wallet and coin transaction models
4. **rez-finance-service** — Finance transaction models
5. **rez-notification-events** — Event schema validation

## Migration Steps

### Prerequisites

1. Ensure @rez/shared-types is published and available in your package registry
2. Add @rez/shared-types as a dependency in the service's `package.json`
3. Review the canonical type definitions in `/packages/shared-types/src/entities/`

### Standard Migration Process

#### Step 1: Add Canonical Reference Comments (✅ ALREADY DONE)

All services now include reference comments at the top of their type files:

```typescript
// Canonical types: @rez/shared-types/entities/{entity}
// TODO: Migrate to import from @rez/shared-types when package is published
```

This serves as a checkpoint for future migration.

#### Step 2: Install @rez/shared-types Dependency

```bash
npm install @rez/shared-types
# or
yarn add @rez/shared-types
```

#### Step 3: Update Imports

Replace local type imports with imports from @rez/shared-types:

**Before:**
```typescript
import { IPayment } from './models/Payment';
import { PaymentStatus } from './types/payment.types';
```

**After:**
```typescript
import { IPayment, PaymentStatus } from '@rez/shared-types/entities/payment';
import { PaymentStatus } from '@rez/shared-types/enums';
```

#### Step 4: Remove or Deprecate Local Type Files

Once all imports are updated, local type files can be:
- Deleted if completely redundant with shared types
- Marked as `@deprecated` if they extended shared types
- Kept as service-specific extensions (with clear inheritance from shared types)

#### Step 5: Run Tests and Build

```bash
npm run build
npm test
npm run lint
```

#### Step 6: Commit and Push

```bash
git add .
git commit -m "migrate({service}): adopt @rez/shared-types canonical types"
git push origin feature/{service}/shared-types-migration
```

---

## Service-by-Service Details

### 1. rez-auth-service

**Files to Migrate:**
- `src/types/user.types.ts`

**Current State:**
- Canonical reference comment ✅ added
- 7 UserRole values verified ✅
- Gender enum includes `prefer_not_to_say` ✅
- `isVerified` is NOT hardcoded ✅

**Migration Changes:**

```typescript
// Before
export interface AuthServiceUser {
  role: string;
  // ... other fields
}

// After
import { IUser, UserRole } from '@rez/shared-types/entities/user';
import { UserRole } from '@rez/shared-types/enums';

export type AuthServiceUser = IUser;
```

**Files to Update:**
- All imports of `AuthServiceUser` throughout the service

**Validation:**
```bash
npm test -- --testPathPattern="auth"
```

---

### 2. rez-payment-service

**Files to Migrate:**
- `src/models/Payment.ts`

**Current State:**
- Canonical reference comment ✅ added
- All 11 payment statuses ✅ verified
- `partially_refunded` status ✅ added to enum
- State transition FSM ✅ updated for `partially_refunded`

**Migration Changes:**

```typescript
// Before
import { Payment as PaymentModel } from './models/Payment';

// After
import { IPayment, PAYMENT_STATE_TRANSITIONS } from '@rez/shared-types/entities/payment';
import { PaymentStatus } from '@rez/shared-types/enums';
```

**11 Payment Statuses (All Present):**
1. pending
2. processing
3. completed
4. failed
5. cancelled
6. expired
7. refund_initiated
8. refund_processing
9. refunded
10. refund_failed
11. partially_refunded ✅ (newly added in this round)

**State Transitions Updated:**
- `refund_processing` → can now transition to `partially_refunded`
- `partially_refunded` → can transition back to `refund_initiated` (for additional refunds)

**Files to Update:**
- All payment schema validation code
- All payment status checks in routes and services

**Validation:**
```bash
npm test -- --testPathPattern="payment"
```

---

### 3. rez-wallet-service

**Files to Migrate:**
- `src/models/Wallet.ts`
- `src/models/CoinTransaction.ts`

**Current State:**
- Canonical reference comments ✅ added to both
- `CoinTransaction.status` field ✅ present with 3 statuses
- All 6 coin types ✅ verified: promo, branded, prive, cashback, referral, rez
- Coin priority ✅ order: promo → branded → prive → cashback → referral → rez

**Migration Changes:**

```typescript
// Before
import { CoinTransaction as CoinTransactionModel } from './models/CoinTransaction';
import { Wallet as WalletModel } from './models/Wallet';

// After
import { ICoinTransaction, IWallet, COIN_PRIORITY } from '@rez/shared-types/entities/wallet';
import { CoinType, CoinTransactionType, TransactionStatus } from '@rez/shared-types/enums';
```

**Coin Transaction Status (All Present):**
- completed ✅
- pending ✅
- failed ✅

**6 Coin Types (All Present):**
1. rez
2. prive
3. branded
4. promo
5. cashback
6. referral

**Priority Order (Fixed in shared-types):**
```
['promo', 'branded', 'prive', 'cashback', 'referral', 'rez']
```

**Files to Update:**
- All coin transaction creation and lookup logic
- All wallet balance calculation functions
- Import statements for coin-related types

**Validation:**
```bash
npm test -- --testPathPattern="wallet|coin"
```

---

### 4. rez-finance-service

**Files to Migrate:**
- `src/models/FinanceTransaction.ts`

**Current State:**
- Canonical reference comment ✅ added
- `success` status ✅ removed (enforces canonical `completed`)
- Pre-save hook normalizes legacy `success` → `completed` ✅
- All 4 statuses present ✅: pending, completed, failed, refunded
- All 5 transaction types present ✅: bnpl_payment, bill_payment, recharge, emi_payment, credit_card_payment

**Migration Changes:**

```typescript
// Before
export type FinanceTxStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type FinanceTxType = 'bnpl_payment' | 'bill_payment' | 'recharge' | 'emi_payment' | 'credit_card_payment';

// After
import { IFinanceTransaction, FinanceTxStatus, FinanceTxType } from '@rez/shared-types/entities/finance';
import { FinanceTransactionStatus, FinanceTransactionType } from '@rez/shared-types/enums';
```

**Transaction Statuses (All Present):**
- pending
- completed (canonical - replaces legacy 'success')
- failed
- refunded

**Transaction Types (All Present):**
1. bnpl_payment
2. bill_payment
3. recharge
4. emi_payment
5. credit_card_payment

**Files to Update:**
- All finance transaction creation and validation code
- Status checks in routes and services
- Remove legacy 'success' → 'completed' normalization hooks (shared-types provides this)

**Validation:**
```bash
npm test -- --testPathPattern="finance"
```

---

### 5. rez-notification-events

**Files to Migrate:**
- `src/schemas/eventSchemas.ts`

**Current State:**
- Canonical reference comment ✅ added
- Channel enum includes `in_app` ✅
- Email resolution fallback ✅ exists (handles: payload.data.email → payload.to → User.email lookup)
- Zod schema validation ✅ enforces strict runtime validation

**Migration Changes:**

```typescript
// Before
export const notificationEventSchema = z.discriminatedUnion('eventType', [...]);

// After
import { INotificationEvent, NotificationChannel } from '@rez/shared-types/entities/notification';
import { NotificationType, NotificationChannel } from '@rez/shared-types/enums';
```

**Notification Channels (All Present):**
1. push
2. email (with fallback resolution ✅)
3. sms
4. whatsapp
5. in_app ✅

**Email Resolution Fallback (Already Implemented):**
```
1. event.payload.data.email (event producer provided)
2. event.payload.to (legacy compatibility)
3. MongoDB User lookup by userId (final fallback)
```

**Event Types Currently Validated:**
- coin_earned
- streak_at_risk
- streak_milestone
- payment_received
- order_update
- generic (fallback for unknown types)

**Files to Update:**
- Event type definitions in `src/worker.ts`
- Event creation functions throughout the codebase
- All event enums and channel references

**Validation:**
```bash
npm test -- --testPathPattern="notification|event"
```

---

## Verification Checklist

For each service migration, verify:

- [ ] All imports updated to use `@rez/shared-types`
- [ ] Local type files removed or marked deprecated
- [ ] Build succeeds: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] No type errors in TypeScript compilation
- [ ] Service still communicates correctly with other services
- [ ] Enum values match expected canonical values
- [ ] State transitions (payment, finance) still work correctly
- [ ] No regression in runtime behavior

### Run Full Validation

```bash
# In the service directory
npm run build
npm test
npm run lint

# Commit and push
git add .
git commit -m "migrate({service}): adopt @rez/shared-types canonical types"
git push origin feature/{service}/shared-types-migration
```

---

## Incremental Migration Strategy

Services **do NOT** need to migrate all at once. The migration can be done incrementally:

### Recommended Order (By Dependency):

1. **rez-auth-service** (minimal dependencies)
2. **rez-payment-service** (depends on enums, no service dependencies)
3. **rez-wallet-service** (wallet is core, depended on by payment service)
4. **rez-finance-service** (depends on payment, wallet concepts)
5. **rez-notification-events** (can migrate independently)

### One Service at a Time:

Each service can be migrated independently without blocking others:

```bash
# Step 1: Create feature branch for one service
git checkout -b feature/rez-auth-service/shared-types-migration

# Step 2: Follow the migration steps above
npm install @rez/shared-types
# Update imports...
# Run tests...

# Step 3: Create PR and merge
git push origin feature/rez-auth-service/shared-types-migration
# Create PR, review, merge

# Step 4: Repeat for next service
```

### Service-to-Service Compatibility:

- During migration, services using old type files and services using shared types are **fully compatible**
- No coordination needed between services
- Each service can migrate at its own pace
- Once all services are migrated, can consider consolidating build output

---

## Post-Migration Cleanup

Once all 5 services are migrated:

1. **Remove duplicate type definitions:**
   - Delete local type files (or deprecate if extended)
   - Rely solely on @rez/shared-types imports

2. **Consolidate enum exports:**
   - If any service re-exports enums, can remove those re-exports
   - Import directly from @rez/shared-types

3. **Update CI/CD:**
   - Ensure @rez/shared-types is built before dependent services
   - Update build order in docker-compose or deployment scripts

4. **Documentation:**
   - Update service READMEs to mention @rez/shared-types dependency
   - Document breaking changes in CHANGELOG

---

## Troubleshooting

### Issue: Cannot find module '@rez/shared-types'

**Solution:**
```bash
# Ensure the package is built and available
cd packages/shared-types
npm run build

# Link it locally for development
npm link
cd ../path/to/service
npm link @rez/shared-types
```

### Issue: Type mismatch between local and shared types

**Solution:**
- Verify the shared type is the canonical source
- Update local code to match shared type structure
- Run `npm test` to catch breaking changes
- Check git history in shared-types for recent changes

### Issue: Enum values don't match between local and shared

**Solution:**
- Always prefer shared-types enum values as canonical
- Update local code to use shared enum values
- Verify all service tests still pass
- Check service-to-service communication still works

---

## Questions?

Refer to:
- `/packages/shared-types/src/entities/` — Type definitions
- `/packages/shared-types/src/enums/index.ts` — Canonical enum values
- Individual service documentation for migration-specific details
