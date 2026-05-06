# CROSS-SERVICE: Enum Fragmentation

**Date:** 2026-04-16
**Severity:** HIGH across all codebases

---

## Known Enum Mismatches

### TransactionStatus

| Codebase | Value | Used For |
|----------|-------|---------|
| Backend | `'completed'` | Payment FSM |
| Consumer UI | `'success'` | Wallet badges |

### CashbackStatus

| Codebase | Value | Used For |
|----------|-------|---------|
| Backend | `'pending'`, `'approved'`, `'rejected'` | DB |
| Consumer UI | `'PENDING'`, `'APPROVED'`, `'DENIED'` | Display |

### CoinType

| Codebase | Values | Used For |
|----------|--------|---------|
| rez-shared | `cashback`, `referral`, `branded` | Central enum |
| Consumer | `cashback`, `referral`, `branded`, `prive` | Legacy + new |
| Backend | `cashback`, `referral`, `branded_coin` | `branded_coin` not in shared |
| Karma Service | `branded_coin` vs `branded` | Two-way mismatch |

### BookingStatus

| Codebase | Value | Used For |
|----------|-------|---------|
| Backend | `'checked_in'` (snake_case) | Booking FSM |
| Karma UI | `'checked-in'` (kebab-case) | KarmaEvent Booking |

### PaymentStatus (Collision)

| Location | States |
|----------|--------|
| Payment FSM | 10 states |
| Order sub-document | 8 states |

---

## Prevention

Create a single shared enum registry at `packages/shared-types/src/enums/`:

```typescript
// packages/shared-types/src/enums/
export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum CashbackStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
}

export enum CoinType {
  CASHBACK = 'cashback',
  REFERRAL = 'referral',
  BRANDED = 'branded',
}
```

Then import everywhere — never define enums locally.

---

## Status: ACTIVE

See individual gap files for specific locations of each mismatch.
