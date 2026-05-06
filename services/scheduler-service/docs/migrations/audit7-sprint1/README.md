# Audit 7 — Sprint 1: MongoDB Migrations

10 migration scripts for high-priority deferred bugs.

**Schema-verified against actual collection definitions** — field names confirmed from:
- `rez-wallet-service/src/models/CoinTransaction.ts` (cointransactions)
- `rez-wallet-service/src/models/Wallet.ts` (wallets)
- `rez-order-service/src/models/Order.ts` (orders)
- `rez-shared/src/types/booking.types.ts` + backend Booking models (bookings)

## Prerequisites

```bash
npm install mongodb
```

## Run All Migrations

```bash
# 1. Audit all migrations (dry run, shows what would change)
node run.js audit

# 2. Preview each migration individually (dry run)
node run.js up

# 3. Apply for real
node run.js up real
```

## Run Individual Migration

```bash
# Dry run
node 00_C2_cointransaction_typename_backfill.js up

# For real
DRY_RUN=false node 00_C2_cointransaction_typename_backfill.js up

# Rollback (dry run)
node 00_C2_cointransaction_typename_backfill.js down
```

## Migration Order

| # | File | Bug | Target | Description | Risk |
|---|------|-----|--------|-------------|------|
| 1 | `00_C2_...` | C2 | `cointransactions` | Backfill missing `coinType` from `category` for cashback/referral docs | MEDIUM |
| 2 | `01_ENUM02_...` | ENUM-02 | `cointransactions` | Normalize `coinType` from UPPERCASE to lowercase | MEDIUM |
| 3 | `02_SD01_...` | SD-01 | `transactionAuditLogs` | Dedup + normalize Schema B→A (refType→entityType, etc.) | HIGH |
| 4 | `03_SD04_...` | SD-04 | `wallets` | Recompute `statistics` from `cointransactions` (totalEarned, totalSpent, etc.) | HIGH |
| 5 | `04_SD05_...` | SD-05 | `orders` | Normalize `payment.status` from string to `{value, updatedAt, by}` | MEDIUM |
| 6 | `05_FM01_...` | FM-01 | `bookings/orders` | `table_booking` → `table.booking` (underscore→dot casing) | MEDIUM |
| 7 | `06_FM01_...` | F-M1 | `orders` | Backfill `cashbackAmount` = `totalAmount × cashbackPercentage / 100` | MEDIUM |
| 8 | `07_SD02_...` | SD-02 | `wallets` | Add `rezBalance` = `balance.total` to wallets missing it | LOW |
| 9 | `08_SD03_...` | SD-03 | `wallets` | Unique sparse index on `(idempotencyKey, userId)` | LOW |
| 10 | `09_DM01_...` | DM-01 | `orders` | Normalize legacy payment statuses to canonical values | MEDIUM |

## Environment Variables

```bash
# MongoDB connection (uses default if not set)
export MONGODB_URI='mongodb+srv://work_db_user:RmptskyDLFNSJGCA@cluster0.ku78x6g.mongodb.net/rez-app?retryWrites=true&w=majority'

# Default is DRY RUN. Set to false to apply changes:
export DRY_RUN=false
```

## Rollback

Each migration has a `down` function. Rollback in reverse order:

```bash
for i in 09 08 07 06 05 04 03 02 01 00; do
  node "${i}"_*.js down
done
```

## Safety Notes

- All migrations default to DRY RUN mode — run `audit` first
- `02_SD01` creates `transactionAuditLogs_backup_SD01` before deleting duplicates
- All mark documents with `migrationId` + `migratedAt` for traceability
- Run on staging before production
- Low-traffic window recommended for HIGH risk migrations (02, 03)
- `DRY_RUN=false` is required to apply any changes
