# AdBazaar — Data Sync & Consistency Gaps

**Date:** 2026-04-16
**Category:** Data Sync / Consistency
**Status:** 1 CRITICAL + 1 HIGH + 2 MEDIUM = 4 issues

---

## CRITICAL

---

### AB-D1 — No Real-Time Sync — Notifications Are Fire-and-Forget

**Status:** PARTIALLY FIXED (2026-04-17)
**Severity:** CRITICAL
**Impact:** Users see stale data; failed notifications silently lost; no push mechanism

**Fix Applied:** Key fire-and-forget patterns have been replaced with proper error handling:
- `triggerMarketingBroadcast` in bookings/route.ts now uses `await` with try/catch instead of `Promise.resolve().catch(() => {})`
- `emailNewBooking` in bookings/route.ts is properly awaited
- Razorpay webhook handlers now log and propagate errors rather than silently swallowing them
- Refund handler uses `refundSaved` flag to accurately track success

**Remaining Gaps:** Full real-time sync (Supabase Realtime, WebSockets, SSE) and a retry mechanism for failed REZ coin credits are still pending. These require architectural changes beyond a bug-fix session.

---

## HIGH

---

### AB-D2 — Attribution Records Never Populate `booking_id` Column

**Status:** OPEN
**Severity:** HIGH
**Impact:** Attribution linking is indirect and fragile; unlinkable records possible

**Files:**
- `src/app/api/webhooks/rez-visit/route.ts:44-51`
- `src/app/api/webhooks/rez-purchase/route.ts:45-51`

```typescript
// Both webhooks insert attribution but never set booking_id:
await supabase.from('attribution').insert({
  scan_event_id: scanEventId,
  qr_id: scanEvent.qr_id,
  rez_visit_id: visitId,
  visit_timestamp: visitTimestamp,
  // NO booking_id here
})
```

The `attribution` table has a `booking_id` column, but webhooks never populate it. Attribution is linked to bookings via `qr_codes.booking_id` fallback:
```typescript
// attribution/route.ts:123-131
const bookingId = attr.booking_id ?? qrToBooking.get(attr.qr_id ?? '')
```

This works if QR codes have `booking_id` set at creation. For standalone campaign QR codes without `booking_id`, attribution records are unlinkable to any booking.

**Fix:** When a booking is created from a QR code campaign, update the `attribution` records to link to the new booking:
```typescript
await supabase.from('attribution').update({ booking_id: booking.id })
  .eq('scan_event_id', scanEventId)
  .is('booking_id', null)
```

---

## MEDIUM

---

### AB-D3 — Cron Freshness Processes All Listings Without Pagination

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** Serverless function timeout with thousands of listings

**File:** `src/app/api/cron/freshness/route.ts:32-40`

```typescript
const { data: listings, error } = await supabase
  .from('listings').select('id, freshness_score, ...').eq('status', 'active')
```

Fetches **ALL** active listings in one query. With thousands of listings, this will timeout in Vercel's serverless function (max 10s). The loop then processes them sequentially with individual UPDATE calls (N+1 pattern).

**Fix:** Add pagination with cursor-based iteration:
```typescript
let lastId = null;
while (true) {
  let query = supabase.from('listings').select('...').eq('status', 'active').limit(100);
  if (lastId) query = query.gt('id', lastId);
  const { data: listings } = await query;
  if (!listings?.length) break;
  // Process batch
  lastId = listings[listings.length - 1].id;
}
```

---

### AB-D4 — REZ Coin Credit Is Fire-and-Forget — No Retry Queue

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** Users who should receive coins never receive them; no detection, no retry

**File:** `src/app/api/qr/scan/[slug]/route.ts:106-131`

If the REZ API call fails (network error, 5xx, timeout), the scan event records `rez_coins_credited: false` but:
- No retry is attempted
- No alert fires
- No reconciliation job exists
- No dead-letter queue

This is a **data integrity issue** — the coin credit failure is invisible.

**Fix:** Implement a retry queue:
1. Store failed coin credit events in a `failed_coin_credits` table
2. Create a cron job that retries failed events every 15 minutes
3. After 3 failed retries, flag for manual review
4. Alert when failure rate exceeds threshold
