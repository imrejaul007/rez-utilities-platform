# AdBazaar — Architecture & Structural Gaps

**Date:** 2026-04-16
**Category:** Architecture
**Status:** 0 CRITICAL + 0 HIGH + 2 MEDIUM + 1 LOW = 3 issues

---

## MEDIUM

---

### AB-A1 — No Wallet Table — Earnings Derived but Refunds Don't Adjust

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** Refunded bookings permanently inflate vendor earnings with no negative adjustment

**File:** `src/app/api/vendor/earnings/route.ts`

AdBazaar has **no `wallets` or `balances` table**. Vendor earnings are always computed by aggregating `vendor_payout` across bookings:

```typescript
const totalRevenue = rows
  .filter(b => b.status !== 'disputed' && b.status !== 'cancelled')
  .reduce((s, b) => s + Number(b.vendor_payout ?? 0), 0)
```

When a booking is refunded (see AB-B3), the earnings aggregate still includes it. There is no negative adjustment because:
1. No mutable `balance` field exists to decrement
2. The refund only creates a `refunds` record but doesn't reverse the earnings

**Fix:** After implementing refund status update (AB-B3), create a `vendor_ledger` table that records every earnings event (+vendor_payout on booking completion) and every deduction (-refund amount on refund). Earnings = SUM of ledger entries.

---

### AB-A2 — IP Cooldown Blocks All Users on Shared Networks

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** QR scan blocked for everyone on a coffee shop/office/college network

**File:** `src/app/api/qr/scan/[slug]/route.ts:50-66`

```typescript
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const { data: recentScan } = await supabase.from('scan_events')
  .select('id').eq('qr_id', qr.id).eq('ip_address', ip)
  .gte('timestamp', yesterday).single()
if (recentScan) {
  return NextResponse.redirect(`${appUrl}/scan/${slug}?coins=0&reason=already_scanned`)
}
```

A single IP address is shared by potentially hundreds of users in:
- Corporate networks (NAT)
- Coffee shops / libraries
- University campuses
- Mobile carriers with CG-NAT

One user scanning locks out everyone sharing their IP for 24 hours.

**Fix:** Supplement IP-based cooldown with device fingerprint + user-authenticated cooldown. A logged-in user should have a per-user cooldown separate from the IP cooldown.

---

## LOW

---

### AB-A3 — Duplicate Merchant Routing Layer

**Status:** OPEN
**Severity:** LOW
**Impact:** Two parallel cashback route files — maintenance confusion, collision risk

**Files:**
- `src/routes/merchant/cashback.ts` (newer, Joi validation)
- `src/merchantroutes/cashback.ts` (older, less structured)

Both may be mounted at the same path in `server.ts`, causing route conflicts. Any code path can hit either file depending on import order.

**Fix:** Audit which routes exist only in `merchantroutes/` and port them to `routes/`. Remove the `merchantroutes/` mount point. Delete `merchantroutes/cashback.ts` and other duplicate route files.

---

### AB-A4 — Dead Code: `getBroadcastStatus` Never Called

**Status:** OPEN
**Severity:** LOW
**Impact:** Maintenance confusion

**File:** `src/lib/marketing.ts:43-56`

`getBroadcastStatus(broadcastId)` is defined but never called anywhere in the codebase. Dead code.
