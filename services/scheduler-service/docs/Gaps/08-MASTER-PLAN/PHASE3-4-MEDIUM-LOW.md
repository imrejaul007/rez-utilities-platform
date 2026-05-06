# PHASE 3 & 4 — MEDIUM + LOW Issues

**Date:** 2026-04-16
**Scope:** All codebases
**Total MEDIUM:** ~1,162 | **Total LOW:** ~278
**Estimated Effort:** ~240 hours (MEDIUM) + ~40 hours (LOW)

---

## AdBazaar MEDIUM + LOW (11 MEDIUM + 7 LOW)

See [06-ADBAZAAR/ARCHITECTURE.md](../06-ADBAZAAR/ARCHITECTURE.md) and individual files.

### MEDIUM (11 issues)

| # | ID | Title | File | Effort |
|---|-----|-------|------|--------|
| 1 | AB-M1 | `rez_user_id` format not validated | `qr/scan/[slug]/route.ts:72` | 15 min |
| 2 | AB-M2 | Listing search uses user input in `ilike` | `listings/route.ts:59` | 10 min |
| 3 | AB-M3 | Unverified email inserted on registration | `register/page.tsx:49` | 30 min |
| 4 | AB-M4 | Broadcast title/body unvalidated | `bookings/route.ts:169` | 15 min |
| 5 | AB-M5 | `payableStatuses` includes `Confirmed` | `verify-payment/route.ts:58` | 10 min |
| 6 | AB-M6 | Proof upload read-modify-write race | `bookings/[id]/proof/route.ts:96` | 1 hour |
| 7 | AB-D3 | Cron freshness fetches ALL listings | `cron/freshness/route.ts:32` | 30 min |
| 8 | AB-D4 | REZ coin credit no retry queue | `qr/scan/[slug]/route.ts:106` | 2 hours |
| 9 | AB-P4 | Razorpay webhook amount not verified | `webhooks/razorpay/route.ts:107` | 30 min |
| 10 | AB-A1 | No wallet table — refunds don't adjust earnings | `vendor/earnings/route.ts` | 3 hours |
| 11 | AB-A2 | IP cooldown blocks all users on shared networks | `qr/scan/[slug]/route.ts:50` | 1 hour |
| | | | **Subtotal** | **~10 hours** |

### LOW (7 issues)

| # | ID | Title | File | Effort |
|---|-----|-------|------|--------|
| 1 | AB-L1 | DB error messages propagated to API | Multiple | 30 min |
| 2 | AB-L2 | No server-side password complexity enforcement | `register/page.tsx:228` | 15 min |
| 3 | AB-L3 | Fragile `includes()` cookie name matching | `lib/adminAuth.ts:16` | 10 min |
| 4 | AB-L4 | `bulk_discount_pct` never applied | `bookings/route.ts:86` | 30 min |
| 5 | AB-A3 | Duplicate merchant routing layer | `merchantroutes/` | 1 hour |
| 6 | AB-A4 | Dead code: `getBroadcastStatus` | `lib/marketing.ts:43` | 5 min |
| 7 | AB-P5 | Webhook double-arrival has no explicit idempotency | `webhooks/razorpay/route.ts:53` | 15 min |
| | | | **Subtotal** | **~3 hours** |

---

## AB-A1 Fix — No Wallet Table (Architecture Fix)

**Create `vendor_ledger` table:**

```sql
CREATE TABLE vendor_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES users(id),
  booking_id UUID REFERENCES bookings(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('earning', 'refund', 'payout_initiated', 'payout_completed')),
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  reference_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_ledger_vendor ON vendor_ledger(vendor_id, created_at DESC);
CREATE UNIQUE INDEX idx_vendor_ledger_idempotency
  ON vendor_ledger(vendor_id, reference_id, event_type)
  WHERE reference_id IS NOT NULL;
```

**Update earnings API:**
```typescript
const { data: entries } = await supabase
  .from('vendor_ledger')
  .select('amount')
  .eq('vendor_id', vendorId)
  .order('created_at', { ascending: false })

const totalEarnings = entries.reduce((sum, e) => sum + Number(e.amount), 0)
```

**Insert on booking completion:**
```typescript
await supabase.from('vendor_ledger').insert({
  vendor_id: booking.vendor_id,
  booking_id: booking.id,
  event_type: 'earning',
  amount: booking.vendor_payout,
  balance_after: currentBalance + Number(booking.vendor_payout),
  reference_id: booking.id,
})
```

**Insert on refund:**
```typescript
await supabase.from('vendor_ledger').insert({
  vendor_id: booking.vendor_id,
  booking_id: booking.id,
  event_type: 'refund',
  amount: -booking.vendor_payout,
  balance_after: currentBalance - Number(booking.vendor_payout),
  reference_id: refundId,
})
```

---

## AB-D3 Fix — Pagination for Cron Freshness

```typescript
// src/app/api/cron/freshness/route.ts
let lastId: string | null = null;
const batchSize = 100;
const allListings = [];

while (true) {
  let query = supabase
    .from('listings')
    .select('id, freshness_score, ...')
    .eq('status', 'active')
    .order('id')
    .limit(batchSize);

  if (lastId) query = query.gt('id', lastId);

  const { data: listings } = await query;
  if (!listings?.length) break;

  allListings.push(...listings);
  lastId = listings[listings.length - 1].id;

  // Process batch
  for (const listing of listings) {
    await processListingFreshness(listing);
  }
}
```

---

## AB-M6 Fix — Atomic Array Append for Proof Upload

```typescript
// BEFORE: Read-modify-write
const existingProof = booking.proof_of_execution ?? []
const newProof = [...existingProof, ...uploadedUrls]
await supabase.from('bookings').update({ proof_of_execution: newProof }).eq('id', booking.id)

// AFTER: Use Supabase RPC for atomic append
const { data: updated } = await supabase.rpc('append_proof_urls', {
  booking_id: booking.id,
  new_urls: uploadedUrls,
})
```

**PostgreSQL function:**
```sql
CREATE OR REPLACE FUNCTION append_proof_urls(
  booking_id UUID,
  new_urls TEXT[]
) RETURNS bookings AS $$
DECLARE
  result bookings;
BEGIN
  UPDATE bookings
  SET proof_of_execution = proof_of_execution || new_urls
  WHERE id = booking_id
  RETURNING * INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Cross-Codebase Pattern Groups (MEDIUM)

| Pattern | AdBazaar | Gen 1–7 | Fix |
|---------|----------|---------|-----|
| Fire-and-forget notifications | AB-D1, AB-H3 | Gen 1–7 | DLQ + retry cron |
| No pagination on list APIs | AB-D3 | Gen 1–7 | Cursor-based pagination |
| Read-modify-write race conditions | AB-M6 | Gen 1–7 | Atomic DB operations |
| Missing server-side validation | AB-M2, AB-M4 | Gen 1–7 | Zod schemas at API boundary |
| Duplicate route files | AB-A3 | Gen 1–7 | Audit and merge |

---

## Phase 3 + 4 Grand Total

| Source | MEDIUM | LOW | Effort |
|--------|--------|-----|--------|
| AdBazaar | 11 | 7 | ~13 hours |
| Karma Service | 48 | 17 | ~22 hours |
| Karma UI | 25 | 4 | ~8 hours |
| Consumer App Gen 11 | 22 | 12 | ~10 hours |
| Gen 1–7 | ~1,000 | ~250 | ~240 hours |
| **TOTAL** | **~1,104** | **~293** | **~298 hours** |

---

## Recommended Sprint Structure

| Sprint | Focus | Issues | Hours |
|--------|-------|--------|-------|
| Sprint 5 | AdBazaar Security Hardening | AB-M*, AB-L* | 16 hours |
| Sprint 6 | AdBazaar Architecture | AB-A1, AB-A2, AB-D3 | 10 hours |
| Sprint 7 | Gen 1–7 Security + Auth | ~100 issues | 40 hours |
| Sprint 8 | Gen 1–7 Payment/Financial | ~80 issues | 40 hours |
| Sprint 9 | Gen 1–7 Data Consistency | ~120 issues | 40 hours |
| Sprint 10 | Gen 1–7 UX + Performance | ~100 issues | 40 hours |
| Sprint 11+ | Remaining Gen 1–7 + Tech Debt | ~500 issues | 80 hours |

**Total: 11 sprints × 40 hours ≈ 5.5 months at full-time**

---

## Tech Debt Backlog (LOW priority)

| Issue | Codebase | Effort |
|-------|----------|--------|
| Dead code cleanup | All | 8 hours |
| Remove hardcoded values | All | 4 hours |
| Add integration test suite | All | 16 hours |
| Performance profiling | All | 8 hours |
| API documentation | All | 8 hours |
| Database migration cleanup | All | 4 hours |
