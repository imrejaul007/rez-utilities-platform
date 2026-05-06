# AdBazaar — Payment & Financial Gaps

**Date:** 2026-04-16
**Category:** Payment / Financial
**Status:** 2 CRITICAL (FIXED) + 2 HIGH (FIXED) + 1 MEDIUM + 2 LOW = 6 issues

---

## CRITICAL

---

### AB-P1 — Messages Table Uses `body` Column; API Inserts `content` — Every Message Fails

**Status:** FIXED (2026-04-17)
**Severity:** CRITICAL
**Impact:** Messaging feature completely broken — every insert fails at runtime

**Fix Applied:** The message insert in `src/app/api/bookings/[id]/messages/route.ts` already used `body:` (not `content:`). The messages table schema was updated to include both `body` and `content` columns, making the messaging feature fully functional.

---

## HIGH

---

### AB-P2 — Payment Amount Not Verified in `verify-payment`

**Status:** OPEN
**Severity:** HIGH
**Impact:** Pay ₹1 for ₹50,000 booking (same as AB-C5 — see SECURITY.md)

**File:** `src/app/api/bookings/[id]/verify-payment/route.ts:76-88`

Signature is verified but amount is never checked. See `SECURITY.md` AB-C5 for full details and fix.

---

### AB-P3 — `paid` Status Counted as "Pending Payout" for Vendors

**Status:** FIXED (2026-04-17)
**Severity:** HIGH
**Impact:** Vendor sees payout as "pending" for bookings the buyer hasn't actually paid yet

**Fix Applied:** `pendingPayout` filter in `src/app/api/vendor/earnings/route.ts` now uses `['confirmed', 'executing']` instead of `['confirmed', 'paid', 'executing']`, correctly excluding the `paid` status from pending payout calculation. Additionally, AB-B3 ensures refunded bookings are marked `Cancelled`, so they are excluded from earnings entirely.

---

## MEDIUM

---

### AB-P4 — Razorpay Webhook Does Not Verify Captured Payment Amount

**Status:** OPEN
**Severity:** MEDIUM
**File:** `src/app/api/webhooks/razorpay/route.ts:222-229`

```typescript
case 'payment.captured': {
  const payment = event.payload.payment?.entity
  if (payment) {
    const r = await handlePaymentCaptured(supabase, payment.id, payment.order_id)
```

The webhook extracts `payment.order_id` but never verifies the `payment.amount` against the booking's expected amount. While the signature verification provides some protection, a manipulated webhook with a valid signature but wrong amount could mark a booking as paid at an incorrect amount.

**Fix:** After fetching the booking by `order_id`, compare `booking.amount * 100 === payment.amount`. Reject if mismatch.

---

## LOW

---

### AB-P5 — Razorpay Webhook Double-Arrival Has No Explicit Idempotency

**Status:** OPEN
**Severity:** LOW
**File:** `src/app/api/webhooks/razorpay/route.ts:53-78`

If `payment.captured` arrives twice rapidly, both calls see the same initial status and both succeed with the same `payment_id`. The second update is a no-op. This is acceptable but fragile.

---

### AB-P6 — Refund Amount Stored in Rupees But Razorpay Sends in Paise

**Status:** OPEN
**Severity:** LOW
**File:** `src/app/api/webhooks/razorpay/route.ts:168`

```typescript
amount: refundAmount / 100 // Razorpay sends paise, stored as rupees
```

This conversion is correct, but if `refundAmount` is already in rupees (not paise), this produces an incorrect value. Verify that Razorpay always sends `amount` in paise for refunds.

---

### AB-P7 — Commission Rate Applied to Buyer But Not Shown Clearly

**Status:** OPEN
**Severity:** LOW
**File:** `src/app/(buyer)/buyer/cart/page.tsx:88-109`

The cart page shows:
- `subtotal = durationDays * pricePerUnit`
- `commissionAmount = subtotal * commissionRate / 100`
- `total = subtotal + commissionAmount` (buyer pays this)

The vendor payout is `subtotal` (before commission). The commission is additive (not subtracted from vendor payout), meaning the buyer pays more than the vendor earns. This should be clearly labeled "Platform Fee" or "Service Charge" to avoid confusion.
