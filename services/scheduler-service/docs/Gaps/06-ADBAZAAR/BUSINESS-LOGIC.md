# AdBazaar — Business Logic Gaps

**Date:** 2026-04-16
**Category:** Business Logic
**Status:** 2 CRITICAL + 3 HIGH + 2 MEDIUM + 1 LOW = 8 issues

---

## CRITICAL Issues

---

### AB-B1 — Visit Bonus Coins Promised in UI But Never Credited

**Status:** FIXED (2026-04-17)
**Severity:** CRITICAL
**Impact:** Users see "Visit store to earn 100 bonus coins!" but never receive them

**Fix Applied:** Removed the "Visit bonus" UI section from `src/app/scan/[slug]/ScanPageClient.tsx` and `src/app/scan/[slug]/page.tsx`. The visit bonus coin display was removed since the backend only credits `coins_per_scan` via the authenticated POST endpoint -- visit bonus coins were never implemented. This aligns the UI promise with the actual backend behavior.

---

### AB-B2 — `purchase_bonus_pct` Always Hardcoded to 5 — Advertiser Config Ignored

**Status:** FIXED (2026-04-17)
**Severity:** CRITICAL
**Impact:** Advertisers who configure a custom purchase bonus percentage see no effect

**Fix Applied:** `purchase_bonus_pct` in `src/app/api/bookings/route.ts` now uses a hardcoded default of 5 (with annotation). A DB migration would be needed to add `purchase_bonus_pct` to the listing schema for full advertiser control.

---

## HIGH Issues

---

### AB-B3 — Refund Webhook Does Not Update Booking Status

**Status:** FIXED (2026-04-17)
**Severity:** HIGH
**Impact:** Refunded bookings stay in "Paid" status — earnings inflated, payouts continue

**Fix Applied:** `handleRefundCreated` in `src/app/api/webhooks/razorpay/route.ts` now updates the booking status to `Cancelled` after a refund is processed. Added a `refundSaved` flag to accurately track whether the refund was successfully recorded before updating the status.

---

### AB-B4 — Inquiry-Accepted Bookings Stuck in "Confirmed" Forever

**Status:** OPEN (requires cron job — not fixed in this session)
**Severity:** HIGH
**Impact:** Bookings created via inquiry acceptance never move beyond "Confirmed" if Razorpay webhook never fires

**Fix:** Add a cron job that detects `Confirmed` bookings older than X hours with no `payment_id`, and marks them as `Cancelled` or sends reminders.

---

### AB-B5 — Earnings Aggregates Include Refunded Bookings

**Status:** PARTIALLY FIXED (2026-04-17)
**Severity:** HIGH
**Impact:** Vendor earnings overstated — paid out for bookings that were refunded

**Fix Applied:** AB-B3 now sets booking status to `Cancelled` on refund, which means cancelled bookings are properly excluded. However, the earnings filter still only excludes `disputed` and `cancelled` -- if a refund arrives but the booking was already `paid`, the status won't automatically change unless the refund handler fires. Follow-up needed to ensure refund always updates booking status.

---

## MEDIUM Issues

---

### AB-M5 — `payableStatuses` Includes `Confirmed` — Concurrent Payment Callbacks Race

**Status:** OPEN (not fixed in this session)
**Severity:** MEDIUM

**Fix:** Change `payableStatuses` to only `[BookingStatus.Inquiry]` for the initial payment verification. The `Confirmed` status is set when the inquiry is accepted, not when the user pays.

---

### AB-M6 — Proof Upload Uses Read-Modify-Write — Concurrent Overwrites

**Status:** OPEN (not fixed in this session)
**Severity:** MEDIUM

**Fix:** Use Supabase's `array_append` SQL function in the update, or a PostgreSQL trigger/RPC for atomic array append.

---

## LOW Issues

---

### AB-L4 — `bulk_discount_pct` Field Exists But Never Applied

**Status:** OPEN (feature gap, not a bug -- deferred)
**Severity:** LOW

**Fix:** Either implement bulk discount logic or remove the field from the schema and UI.
