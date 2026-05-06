# XF-4 — Wallet vs Earnings Derivation Mismatch

**Date:** 2026-04-16
**Family:** XF-4
**Severity:** HIGH
**Spans:** AdBazaar ↔ REZ ecosystem

---

## Summary

The REZ ecosystem has a sophisticated multi-coin wallet system with double-entry ledger accounting. AdBazaar has no wallet model — vendor earnings are always computed by aggregating `vendor_payout` from the bookings table. This creates a fundamental accounting mismatch.

---

## REZ Ecosystem: Full Wallet Model

**Architecture:**
- `rez-wallet-service`: Dedicated microservice managing all user/merchant wallets
- `Wallet` schema: 6 coin types (rez, prive, branded, promo, cashback, referral)
- `LedgerEntry` collection: Double-entry accounting — every debit has a corresponding credit
- `CoinTransaction` collection: Immutable audit trail of all coin movements
- BullMQ: Async processing of all wallet operations
- Redis: Temporary state management

**Known issues (Gen 1-7):**
- `docs/Bugs/01-DATA-LAYER.md` C1-C2: Three incompatible schemas writing to `cointransactions`
- `docs/Bugs/06-FINANCIAL-INTEGRITY.md` C9-C10: Coin credit fire-and-forget, merchant double-payout race
- `docs/Bugs/06-SCHEMA-DIVERGENCE.md` SD-02: Wallet schema 3 fields truncated by microservice

---

## AdBazaar: No Wallet — Earnings Derived from Bookings

**Architecture:**
- `bookings` table: Single source of truth for all financial state
- `vendor_earnings` computed: `SUM(vendor_payout)` WHERE `status NOT IN ('disputed', 'cancelled')`
- No ledger, no double-entry accounting
- No per-coin-type balances

**Problem:** When a booking is refunded, there's no mutable balance to decrement. The earnings aggregate still includes the refunded booking (see [AB-A1](../06-ADBAZAAR/ARCHITECTURE.md#AB-A1)).

```typescript
// earnings/route.ts:36-37
const totalRevenue = rows
  .filter(b => b.status !== 'disputed' && b.status !== 'cancelled')
  .reduce((s, b) => s + Number(b.vendor_payout ?? 0), 0)
// Refunded 'paid' bookings NOT excluded
```

---

## The Cross-Repo Mismatch

| Aspect | REZ Ecosystem | AdBazaar |
|--------|--------------|----------|
| **Earnings Model** | Double-entry ledger (debit/credit pairs) | Derived aggregate from bookings |
| **Refund Handling** | Ledger entry: debit vendor wallet | No adjustment (earnings still count) |
| **Balance Type** | Per-coin-type (6 types) | Single vendor_payout sum |
| **Audit Trail** | `CoinTransaction` + `LedgerEntry` | `bookings` table only |
| **Payout Tracking** | `payout_id` on wallet ledger entries | `payout_id` on booking |
| **Reconciliation** | Possible (ledger must balance) | Impossible (no ledger) |

**Critical gap:** AdBazaar refunds don't reverse vendor earnings. A ₹50,000 booking that is fully refunded still shows ₹50,000 in vendor earnings. The vendor could be paid out for this booking before the refund processes.

---

## Fix Architecture

### Short-term: Add Refund Status to Earnings Filter

```typescript
// earnings/route.ts
// After AB-B3 is fixed (booking status updated on refund):
const totalRevenue = rows
  .filter(b => !['disputed', 'cancelled', 'refunded'].includes(b.status))
  .reduce((s, b) => s + Number(b.vendor_payout ?? 0), 0)
```

### Medium-term: Vendor Ledger Table

```sql
CREATE TABLE vendor_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES users(id),
  booking_id UUID REFERENCES bookings(id),
  event_type TEXT NOT NULL, -- 'earning' | 'refund' | 'payout_initiated' | 'payout_completed'
  amount DECIMAL(12,2) NOT NULL, -- positive for credit, negative for debit
  balance_after DECIMAL(12,2) NOT NULL, -- running balance
  reference_id TEXT, -- refund_id, payout_id, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compound index for fast balance queries
CREATE INDEX idx_vendor_ledger_vendor_balance
  ON vendor_ledger(vendor_id, created_at DESC);

-- Idempotency: unique constraint on reference_id + event_type
CREATE UNIQUE INDEX idx_vendor_ledger_idempotency
  ON vendor_ledger(vendor_id, reference_id, event_type)
  WHERE reference_id IS NOT NULL;
```

**Earnings calculation becomes:**
```typescript
// earnings/route.ts
const { data: ledger } = await supabase
  .from('vendor_ledger')
  .select('amount')
  .eq('vendor_id', vendorId)
  .order('created_at', { ascending: false })

const totalEarnings = ledger.reduce((s, e) => s + Number(e.amount), 0)
```

### Long-term: Integrate AdBazaar with REZ Wallet

AdBazaar could leverage the REZ wallet system for vendor payouts:
1. On booking completion: Create `LedgerEntry` in REZ wallet (via API call)
2. On refund: Create negative `LedgerEntry` (debit)
3. Payout = withdrawal from REZ wallet

This aligns AdBazaar with the REZ financial model and enables cross-platform fund transfers.

---

## Related Issues

- [AB-A1](../06-ADBAZAAR/ARCHITECTURE.md#AB-A1) — No wallet table, refunds don't adjust
- [AB-B3](../06-ADBAZAAR/BUSINESS-LOGIC.md#AB-B3) — Refund webhook doesn't update booking status
- [AB-B5](../06-ADBAZAAR/BUSINESS-LOGIC.md#AB-B5) — Earnings include refunded bookings
- [AB-P3](../06-ADBAZAAR/PAYMENT.md#AB-P3) — `paid` counted as pending payout
- Gen 1-7 `docs/Bugs/01-DATA-LAYER.md` — Full wallet model issues

---

## Effort Estimate

| Task | Effort | Priority |
|------|--------|----------|
| Fix refund status update on booking (AB-B3) | 1 hour | HIGH |
| Add refund to earnings filter (AB-B5) | 15 min | HIGH |
| Create `vendor_ledger` Supabase table + indexes | 2 hours | HIGH |
| Update booking completion to insert ledger entry | 2 hours | HIGH |
| Update refund webhook to insert negative ledger entry | 1 hour | HIGH |
| Update earnings API to query ledger | 1 hour | HIGH |
| Add idempotency constraint on ledger | 30 min | MEDIUM |
| Integrate with REZ wallet (long-term) | 16 hours | LOW |

**Total: ~8 hours (short/medium term)**
