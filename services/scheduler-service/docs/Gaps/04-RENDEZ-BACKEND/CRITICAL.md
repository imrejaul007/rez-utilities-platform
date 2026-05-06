# RENDEZ BACKEND — CRITICAL GAPS

**Service:** `rendez-backend/`
**Date:** 2026-04-16
**Severity:** 4 CRITICAL

---

### RZ-B-C1 — Gift Voucher Authorization Bypass via ID Enumeration

**File:** `src/routes/gift.ts` (line ~80) + `src/services/GiftService.ts` (line ~180)
**Severity:** CRITICAL
**Category:** Security / Authorization
**Status:** ACTIVE

**Code:**
```typescript
// GiftService.ts:180-186
async getVoucher(profileId: string, giftId: string): Promise<object> {
 const gift = await prisma.gift.findFirst({
  where: { id: giftId, receiverId: profileId, status: GiftStatus.ACCEPTED },
 });
 if (!gift || !gift.rezVoucherId) throw new AppError(404, 'Voucher not found');
 return rezGift.getVoucher(gift.rezVoucherId); // Returns QR code + merchant details
```

**Root Cause:** The `GET /gifts/:giftId/voucher` route handler passes a `profileId` parameter but does not verify it matches the authenticated user's ID. The `receiverId: profileId` check in the Prisma query is based on a caller-supplied value. If the backend route handler does not validate that the authenticated user is the `profileId` being queried, an attacker with a valid JWT can enumerate gift CUIDs and retrieve voucher QR codes for any accepted gift. The CUID format is predictable.

**Fix:**
```typescript
// In route handler — verify the caller is querying their own profile
const authenticatedProfileId = req.user!.id; // from JWT
if (profileId !== authenticatedProfileId) {
  return res.status(403).json({ success: false, message: 'Access denied' });
}
```

**Prevention:** Add integration test that verifies User A cannot access User B's voucher. Add an opaque voucher token instead of exposing the gift CUID in URLs.

---

### RZ-B-C2 — Payment Webhook Race Condition — Double Reward Issuance

**File:** `src/routes/webhooks/rez.ts` (line ~49)
**Severity:** CRITICAL
**Category:** Payment / Financial / Race Condition
**Status:** ACTIVE

**Code:**
```typescript
// BUG: status check is OUTSIDE the transaction
const checkins = await prisma.meetupCheckin.findMany({
 where: { bookingId: booking_id }
});
if (checkins.length >= 2) {
 await prisma.$transaction(async (tx) => {
  // Re-check inside transaction — but the count check is already done
  const currentReward = await tx.reward.findFirst({
   where: { bookingId: booking_id }
  });
  if (!currentReward || currentReward.status !== 'PENDING') return;
  await rewardService.triggerMeetupReward(...);
 });
}
```

**Root Cause:** If two payment webhooks for the same booking arrive concurrently (e.g., duplicate webhook delivery from REZ), **both** can pass `checkins.length >= 2` before either commits the reward status update. Inside the transaction, each sees `status === 'PENDING'` because neither has committed yet. Both call `triggerMeetupReward`, potentially issuing duplicate coins.

**Fix:**
```typescript
// Atomic check-and-update inside a single transaction
const updated = await prisma.$transaction(async (tx) => {
 const existing = await tx.reward.findFirst({
  where: { bookingId: booking_id, status: 'PENDING' }
 });
 if (!existing) return null;
 await tx.reward.update({
  where: { id: existing.id },
  data: { status: 'TRIGGERED' }
 });
 return existing;
});
if (!updated) return res.json({ received: true });
await rewardService.triggerMeetupReward(...);
```

**Prevention:** Add BullMQ idempotency key based on `booking_id + event_type`. Add integration test that fires two concurrent webhooks and verifies only one reward is issued.

---

### RZ-B-C3 — Query Parameter Direct Enum Cast to `any` Bypasses Validation

**File:** `src/routes/wallet.ts` (line ~32) + `src/routes/admin.ts` (line ~150)
**Severity:** CRITICAL
**Category:** Security / Type Safety / API Contract
**Status:** ACTIVE

**Code:**
```typescript
// wallet.ts:32-33
...(status && { status: status as 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REDEEMED' | 'EXPIRED' }),
...(type && { giftType: type as 'COIN' | 'MERCHANT_VOUCHER' }),

// admin.ts:150-153
...(status && { status: status as any }),
...(type && { giftType: giftType as any }),
```

**Root Cause:** `status as any` completely bypasses TypeScript's type system. A user sending `?status=malicious_value` passes through without validation. While Prisma rejects invalid enum values at the DB level, the `as any` pattern creates a type-safety gap that could become exploitable if Prisma's validation changes, or if these values are used in other contexts before reaching Prisma.

**Fix:**
```typescript
// Create validation helper
function toEnum<T extends string>(val: string, allowed: readonly string[]): T | undefined {
 return allowed.includes(val) ? val as T : undefined;
}

// Use it:
const status = toEnum<'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REDEEMED' | 'EXPIRED'>(
  req.query.status as string,
  ['PENDING', 'ACCEPTED', 'REJECTED', 'REDEEMED', 'EXPIRED']
);
if (!status) {
  return res.status(400).json({ success: false, message: 'Invalid status value' });
}
```

**Prevention:** Add a Zod schema for query params and validate before use. Add ESLint rule `no-explicit-any`.

---

---

### RZ-B-C4 — Socket `read_receipt` Bypasses `matchId` Ownership Check

**File:** `src/realtime/socketServer.ts` (line ~155)
**Severity:** CRITICAL
**Category:** Security / Real-Time / Authorization
**Status:** ACTIVE

**Code:**
```typescript
// socketServer.ts:155-161
socket.on('read_receipt', async ({ matchId, messageId }: { matchId: string; messageId: string }) => {
  try {
    await prisma.message.updateMany({
      where: { id: messageId, senderId: { not: profileId } },
      data: { read: true },
    });
    socket.to(`match:${matchId}`).emit('read', { messageId, readBy: profileId });
  } catch (err) {
    console.error('[WS] read_receipt error:', err);
  }
});
```

**Root Cause:** The `where` clause only checks `senderId !== profileId`. It does **not** verify that the `messageId` belongs to the `matchId` in the same event payload. A malicious user who knows (or can guess) a `messageId` from any other match they participate in can send `{ matchId: theirMatch, messageId: victimMessageId }`. If the victim's message exists in the DB and was not sent by the attacker, Prisma will mark it as read and broadcast a `read` event to the victim's match room. This enables read-receipt spoofing: a user can mark their victim's messages as read without actually having seen them.

The `join_match` handler correctly validates `matchId` ownership (line ~89), but `read_receipt` skips the equivalent check. The `Message` model has a `matchId` field (`Message.state → MessageState.match`), but the current query doesn't traverse it.

**Fix:**
```typescript
// Fetch the message first to verify it belongs to the caller's match room
const message = await prisma.message.findFirst({
  where: {
    id: messageId,
    senderId: { not: profileId },
    state: { match: { id: matchId } }, // explicit ownership
  },
});
if (!message) return; // silently ignore — not a security error, just wrong matchId

await prisma.message.update({
  where: { id: messageId },
  data: { read: true },
});
socket.to(`match:${matchId}`).emit('read', { messageId, readBy: profileId });
```

**Prevention:** Add a cross-reference test that attempts read_receipt with a `messageId` from a different match and verifies it is rejected. Add a Socket.IO middleware that maintains a `Set<matchId[]>` of joined rooms per socket and validates `matchId ∈ joinedRooms` on every event.

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-B-C1 | CRITICAL | Gift voucher authorization bypass via ID enumeration | ACTIVE |
| RZ-B-C2 | CRITICAL | Payment webhook race condition — double reward issuance | ACTIVE |
| RZ-B-C3 | CRITICAL | Query param cast to `any` bypasses enum validation | ACTIVE |
| RZ-B-C4 | CRITICAL | Socket `read_receipt` bypasses `matchId` ownership check | ACTIVE |
