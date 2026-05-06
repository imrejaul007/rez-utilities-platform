# Bug Report: Booking Logic & Cancellation Rules

**Audit Date:** 2026-04-13
**Layer:** Service bookings, table bookings, OTA bookings, cancellation policy enforcement
**Status:** CRITICAL — cancellation policy is contractually wrong and merchant refunds are broken

---

## C16 — CancellationPolicy model exists but is never consulted at cancellation time {#c16}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Every cancellation uses a hardcoded 2-hour window regardless of merchant-configured policy. Merchants who set a 24-hour policy have an unenforceable contract with customers.

**What is happening:**
`CancellationPolicy` model stores per-store settings:
- `freeCancelHours` (default: 24)
- `lateFeeType`, `lateFeeValue`
- `noShowFeeType`, `noShowFeeValue`

`cancelBooking()` in `serviceBookingController.ts` (lines 622-633) ignores this model entirely:
```typescript
// HARDCODED — CancellationPolicy is never fetched here
const twoHoursBefore = new Date(bookingTime.getTime() - 2 * 60 * 60 * 1000);
if (now >= twoHoursBefore) {
  throw new Error('Cancellation not allowed within 2 hours of booking');
}
```

**Files involved:**
- `rezbackend/rez-backend-master/src/models/CancellationPolicy.ts` — model with `freeCancelHours` (never read at cancel time)
- `rezbackend/rez-backend-master/src/controllers/serviceBookingController.ts:622-633` — hardcoded 2h window

**Fix:**
```typescript
const policy = await CancellationPolicy.findOne({ store: booking.store });
const freeHours = policy?.freeCancelHours ?? 2;
const cutoff = new Date(bookingTime.getTime() - freeHours * 60 * 60 * 1000);
if (now >= cutoff) {
  // apply late fee if configured, or reject
}
```

---

## C17 — Email confirmation says "24h free cancellation" but code enforces 2 hours {#c17}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Users book based on the email guarantee, then get rejected when trying to cancel at 5h before their appointment. Legal liability for false advertising.

**What is happening:**
`serviceBookingController.ts` line 329, inside the booking confirmation email template:
```
"Free cancellation up to 24 hours before your appointment"
```

Actual enforcement (lines 622-633): 2-hour window for all non-travel bookings.

A user who reads the email and tries to cancel at 23 hours before will be rejected by the backend. This is a direct contradiction between the promise and the enforcement.

**Files involved:**
- `rezbackend/rez-backend-master/src/controllers/serviceBookingController.ts:329` — email template (24h claim)
- `rezbackend/rez-backend-master/src/controllers/serviceBookingController.ts:622-633` — enforcement (2h)

**Fix:**
Either:
1. Make the email dynamic: `Free cancellation up to ${policy.freeCancelHours} hours before your appointment` (after fixing C16)
2. Or change the hardcoded enforcement to 24h as a platform default, matching the email

---

## H18 — Merchant cancellation triggers no payment refund {#h18}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** When a merchant cancels a paid booking, the customer's payment is not refunded. Customer must escalate manually.

**What is happening:**
`PUT /api/merchant/services/bookings/:id/status` with `status: 'cancelled'` calls:
```typescript
booking.cancel('Cancelled by merchant', 'merchant');
// booking.cancel() only sets status + cancellationReason
// No refund logic, no gateway call, no notification to customer about refund
```

Compare to user cancellation (`cancelBooking()` in `serviceBookingController.ts`) which does trigger a gateway refund (Razorpay/Stripe) wrapped in a MongoDB session.

**Files involved:**
- `rezbackend/rez-backend-master/src/merchantroutes/services.ts:566-576` — merchant cancel (no refund)
- `rezbackend/rez-backend-master/src/controllers/serviceBookingController.ts` — user cancel (has refund)

**Fix:**
Add refund logic to the merchant cancel path, mirroring the user cancel flow:
```typescript
if (booking.paymentStatus === 'paid' && booking.paymentAmount > 0) {
  await refundService.processRefund(booking, 'Merchant cancellation', 'full');
}
```

---

## H19 — Admin cancellation of travel bookings triggers no refund {#h19}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Admin can force-cancel any travel booking (flight, hotel, train) with no automatic refund. User is stranded.

**What is happening:**
`PUT /api/admin/travel/bookings/:id/status` with `status: 'cancelled'` (lines 402-411):
```typescript
booking.status = 'cancelled';
booking.cancelledAt = new Date();
booking.cancellationReason = 'Cancelled by admin';
await booking.save();
// No gateway refund. No cashback clawback reversal. No notification.
```

**Files involved:**
- `rezbackend/rez-backend-master/src/routes/admin/travel.ts:402-411`

**Fix:**
Admin cancel should call `travelCancellationService.cancelWithRefund(booking, 'admin', 100)` — issuing a 100% refund regardless of the tiered refund policy (admin override).

---

## H21 — Slot booking is non-atomic: counter increment and booking document are separate DB operations {#h21}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Server crash between the two operations leaves the slot counter incremented with no booking record. Slot is permanently blocked.

**What is happening:**
`serviceBookingController.ts` lines 113-148:
```typescript
// Operation 1: atomic counter increment
const slotDoc = await SlotBookingCount.findOneAndUpdate(
  { serviceId, storeId, date, slotTime },
  { $inc: { bookingCount: 1 } },
  { upsert: true, returnDocument: 'after' }
);

if (slotDoc.bookingCount > maxBookingsPerSlot) {
  await SlotBookingCount.findOneAndUpdate(/* rollback $inc: -1 */);
  throw 'Slot full';
}

// ... (gap here — crash = counter incremented, no booking)

// Operation 2: separate write
const booking = new ServiceBooking({ ...data });
await booking.save(); // ← NOT in same transaction as Operation 1
```

A crash or timeout between the two operations results in:
- Counter says 1 booking exists for this slot
- No `ServiceBooking` document exists
- Slot appears full. No booking was made. User gets no booking.
- No recovery mechanism.

**Files involved:**
- `rezbackend/rez-backend-master/src/controllers/serviceBookingController.ts:113-302`

**Fix:**
Wrap both operations in a MongoDB session:
```typescript
const session = await mongoose.startSession();
session.startTransaction();
try {
  const slotDoc = await SlotBookingCount.findOneAndUpdate(/* ... */, { session });
  const booking = await ServiceBooking.create([data], { session });
  await session.commitTransaction();
} catch (e) {
  await session.abortTransaction();
  throw e;
}
```

---

## H35 — Table booking capacity guard has same non-atomic race condition {#h35}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Over-capacity table bookings possible when two users book the last available seats simultaneously.

**What is happening:**
`tableBookingController.ts` lines 91-131: `findOneAndUpdate` with `$expr` guard prevents the over-capacity write, but if the guard fails, a compensating `$inc: { totalSeatsUsed: -partySize }` runs as a **separate operation**. A crash between the failed write and the compensating decrement creates a phantom capacity reservation.

Also: `upsert: true` can create a new capacity-tracking document disconnected from actual `TableBooking` records, allowing the capacity counter and real booking records to drift.

**Files involved:**
- `rezbackend/rez-backend-master/src/controllers/tableBookingController.ts:91-131`

**Fix:**
Use a MongoDB session transaction that wraps the capacity check, the booking creation, and any rollback in a single atomic unit.

---

## M17 — OTA hotel bookings have zero availability enforcement in the monolith {#m17}
> **Status:** FIXED — availability conflict check added at booking creation in Hotel OTA microservice; atomic transaction with SELECT FOR UPDATE NOWAIT prevents race conditions; blocked/maintenance rooms now correctly rejected; inventory release consolidated through InventoryEngine across all paths (hold expiry, cancellation, payment failure webhook); availability pre-check endpoint added for frontend early feedback.

**Severity:** MEDIUM
**Impact:** Direct writes to `OtaBooking` via the monolith bypass all availability checks delegated to the Hotel OTA panel.

**Root cause found in Hotel OTA microservice (`Hotel OTA/apps/api/`):**
- `BookingService.hold()` had inline inventory-locking logic that used `SELECT FOR UPDATE` (blocking, not fail-fast) and did NOT check `is_blocked` — blocked/maintenance rooms could be booked
- No post-decrement oversell guard existed in the inline path
- `InventoryEngine.lockInventory()` (the correct implementation with `FOR UPDATE NOWAIT`, `is_blocked` check, and oversell guard) was never called by `BookingService`
- Inventory release on hold expiry, cancellation, and payment failure used three separate inline raw SQL UPDATE queries instead of the shared `InventoryEngine.releaseInventory()` method

**Files changed:**
- `Hotel OTA/apps/api/src/services/booking.service.ts` — replaced inline `SELECT FOR UPDATE` with `InventoryEngine.lockInventory()` (adds `is_blocked` check, `NOWAIT` fail-fast locking, post-decrement oversell guard); replaced inline inventory release in `cancel()` with `InventoryEngine.releaseInventory()`
- `Hotel OTA/apps/api/src/routes/booking.routes.ts` — replaced inline raw SQL inventory release in Razorpay `payment.failed` webhook with `InventoryEngine.releaseInventory()`
- `Hotel OTA/apps/api/src/jobs/workers.ts` — replaced inline raw SQL inventory release in hold-expiry worker with `InventoryEngine.releaseInventory()`
- `Hotel OTA/apps/api/src/routes/hotel.routes.ts` — added `GET /api/hotels/:hotel_id/rooms/:room_type_id/availability` endpoint (non-locking snapshot read via `InventoryEngine.checkAvailability()`) for frontend pre-check before the payment screen

**ORM:** Prisma with PostgreSQL (raw queries via `$queryRaw` / `$executeRaw` for row-level locking)

**Hotel panel frontend:** No changes required — the booking initiation flow goes through the API; the new availability endpoint is available for frontend use if needed for pre-flight UX.

---

## M18 — Merchant can mark a booking `completed` directly from `pending` state {#m18}
> **Status:** ⏳ DEFERRED — state machine guard on instance method requires coordinated merchant flow testing

**Severity:** MEDIUM
**Impact:** Booking state machine can be bypassed by merchants — a booking can jump from pending to completed, unlocking cashback and loyalty rewards without the actual service being rendered.

**What is happening:**
The merchant route (`merchantroutes/services.ts` line 573) calls `booking.complete()` directly. The `complete()` instance method on `ServiceBooking` does not check that the booking is in an allowed pre-completion state.

Compare to the consumer-facing `completeBooking` controller (line 730) which checks:
```typescript
const completableStatuses = ['confirmed', 'assigned', 'in_progress'];
if (!completableStatuses.includes(booking.status)) throw 'Cannot complete';
```

The merchant route bypasses this guard by calling the instance method directly without the status pre-check.

**Files involved:**
- `rezbackend/rez-backend-master/src/merchantroutes/services.ts:573` — calls `booking.complete()` directly
- `rezbackend/rez-backend-master/src/controllers/serviceBookingController.ts:730` — has guard (consumer path only)
- `rezbackend/rez-backend-master/src/models/ServiceBooking.ts` — `complete()` method has no status guard

**Fix:**
Add status validation to the `ServiceBooking.complete()` instance method:
```typescript
complete() {
  const allowed = ['confirmed', 'assigned', 'in_progress'];
  if (!allowed.includes(this.status)) {
    throw new Error(`Cannot complete booking with status: ${this.status}`);
  }
  this.status = 'completed';
  // ...
}
```
