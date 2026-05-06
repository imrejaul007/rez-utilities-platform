# RENDEZ BACKEND — HIGH GAPS

**Service:** `rendez-backend/`
**Date:** 2026-04-16
**Severity:** 10 HIGH (+3 new from deep service audit)

---

### RZ-B-H1 — HMAC Recomputed Inline; Empty Secret Allows Unsigned Requests

**File:** `src/routes/experienceCredits.ts` (lines ~11-12, ~35-42)
**Severity:** HIGH
**Category:** Security
**Status:** ACTIVE

**Code:**
```typescript
// Line 11-12: reads from env correctly
const REZ_SECRET = env.REZ.WEBHOOK_SECRET;

// Line 35-42: recomputes HMAC inline instead of using cached constant
const sig = (req.headers['x-rez-signature'] as string || '').replace('sha256=', '');
const expected = crypto.createHmac('sha256', REZ_SECRET).update(req.rawBody).digest('hex');
```

**Root Cause:** The HMAC is recomputed on every request. If `REZ_SECRET` is `undefined` or empty string, the `timingSafeEqual` at line ~42 will still run with empty buffers, potentially allowing unsigned requests through.

**Fix:**
```typescript
if (!REZ_SECRET) {
  throw new Error('[FATAL] REZ.WEBHOOK_SECRET environment variable is not set');
}
// Use the cached REZ_SECRET constant
const expected = crypto.createHmac('sha256', REZ_SECRET).update(req.rawBody).digest('hex');
```

---

### RZ-B-H2 — 7 Plan Routes Missing ID Validation

**File:** `src/routes/plans.ts` (lines 72-149)
**Severity:** HIGH
**Category:** Functional
**Status:** ACTIVE

**Code:** The following routes receive `req.params.id` but do NOT validate with `isValidId()`:
- `GET /plans/:id` (line 72)
- `DELETE /plans/:id/apply` (line 103)
- `GET /plans/:id/applications` (line 111)
- `POST /plans/:id/select/:applicantId` (line 119)
- `POST /plans/:id/reselect/:applicantId` (line 128)
- `POST /plans/:id/confirm` (line 136)
- `POST /plans/:id/cancel` (line 144)

**Root Cause:** Malformed IDs (non-CUID strings) will cause a Prisma runtime error that surfaces as a 500, rather than a clean 400 with an `INVALID_ID` message.

**Fix:** Add `isValidId()` guard to all plan routes that take path parameters:
```typescript
router.get('/:id', async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid plan ID' });
  }
  // ... handler
});
```

---

### RZ-B-H3 — Reward Trigger Fire-and-Forget — Silent Failure Loses User Rewards

**File:** `src/services/MeetupService.ts` (lines ~98-104)
**Severity:** HIGH
**Category:** Payment / Financial
**Status:** ACTIVE

**Code:**
```typescript
const acquired = await redis.set(lockKey, '1', 'EX', 300, 'NX');
if (acquired === 'OK') {
 this._triggerRewardAndNotify(...).catch(
  (err) => console.error('[Meetup] Reward trigger failed:', err),
 );
}
```

**Root Cause:** The reward trigger fires asynchronously with no retry mechanism. If `_triggerRewardAndNotify` fails permanently (REZ backend down, etc.), the lock expires after 5 minutes and the reward is lost. Users see "Meetup validated! Reward coins incoming" but the coins never arrive.

**Fix:** Use a BullMQ job with retries:
```typescript
if (acquired === 'OK') {
 await rewardQueue.add('trigger-meetup-reward', {
   matchId, bookingId, user1Id, user2Id
 }, {
   attempts: 3,
   backoff: { type: 'exponential', delay: 5000 },
   removeOnComplete: true,
   removeOnFail: false,
 });
}
```

---

### RZ-B-H4 — Redis NX Lock Expires During Long Reward Process

**File:** `src/services/MeetupService.ts` (line ~98)
**Severity:** HIGH
**Category:** Payment / Financial / Architecture
**Status:** ACTIVE

**Code:**
```typescript
const acquired = await redis.set(lockKey, '1', 'EX', 300, 'NX'); // 5-minute TTL
```

**Root Cause:** The Redis NX lock has a 5-minute TTL, but `_triggerRewardAndNotify` involves multiple DB operations and external API calls (REZ reward trigger, profile updates, FCM notifications). If this takes longer than 5 minutes (network latency), the lock expires and a concurrent checkin could trigger a duplicate reward.

**Fix:** Implement lock renewal as a heartbeat during the reward process, or use a database-backed pessimistic lock with `SELECT ... FOR UPDATE` instead of Redis NX.

---

### RZ-B-H5 — Gift Expired Webhook Always Returns Success for Missing Records

**File:** `src/routes/webhooks/rez.ts` (line ~34)
**Severity:** HIGH
**Category:** Security / Reliability
**Status:** ACTIVE

**Code:**
```typescript
router.post('/gift-expired', verifyRezWebhook, async (req, res) => {
 try {
  const { voucher_id } = req.body;
  const gift = await prisma.gift.findFirst({ where: { rezVoucherId: voucher_id } });
  if (gift) {
   await prisma.gift.update({ where: { id: gift.id }, data: { status: GiftStatus.EXPIRED } });
  }
  res.json({ received: true }); // Always returns success
 } catch (err) { next(err); }
});
```

**Root Cause:** Always returns `{ received: true }` even when the voucher is not found. This prevents REZ from detecting sync issues.

**Fix:**
```typescript
if (!gift) return res.status(404).json({ received: false, error: 'Gift not found' });
await prisma.gift.update({ where: { id: gift.id }, data: { status: GiftStatus.EXPIRED } });
res.json({ received: true });
```

---

### RZ-B-H6 — REZ API Called After DB Commit — Split-Brain on Timeout

**File:** `src/services/GiftService.ts` (lines ~123-138)
**Severity:** HIGH
**Category:** Payment / Financial
**Status:** ACTIVE

**Code:**
```typescript
// DB update happens first
const atomicUpdate = await prisma.gift.updateMany({
 where: { id: giftId, receiverId, status: GiftStatus.PENDING },
 data: { status: GiftStatus.ACCEPTED, acceptedAt: new Date(), messageUnlocked: true },
});
if (atomicUpdate.count === 0) throw new AppError(404, 'Gift not found or already actioned');

// REZ API call happens AFTER DB commit — if this fails, split-brain
if (gift.rezVoucherId) {
 await rezGift.activateVoucher(gift.rezVoucherId);
} else if (gift.rezHoldId) {
 await rezWallet.releaseHold(gift.rezHoldId, receiverRezId);
}
```

**Root Cause:** DB status is updated to ACCEPTED before the REZ API call succeeds. If the REZ API call times out, the status reverts, but the REZ API call may have actually succeeded on their end.

**Fix:** Use an idempotency key stored in the DB record. Make the REZ API call within a two-phase pattern, or use an outbox table to ensure eventual consistency.

---

### RZ-B-H7 — Unnecessary Type Cast Weakens `isSuspended` Safety

**File:** `src/middleware/auth.ts` (line ~62)
**Severity:** HIGH
**Category:** Code Quality / Security
**Status:** ACTIVE

**Code:**
```typescript
if ((profile as typeof profile & { isSuspended?: boolean }).isSuspended) {
```

**Root Cause:** The Profile model has `isSuspended Boolean @default(false)` as a non-optional field. The type cast is unnecessary and actually weakens type safety by making `isSuspended` optional when it isn't.

**Fix:**
```typescript
if (profile.isSuspended) {
```

---

### RZ-B-B1 — ModerationService blockUser Doesn't Check messageState Before Cascade

**File:** `src/services/ModerationService.ts` (lines ~17-29)
**Severity:** HIGH
**Category:** Functional / Data & Sync
**Status:** ACTIVE

**Code:**
```typescript
async blockUser(blockerId: string, blockedId: string): Promise<void> {
  await prisma.$transaction([
    prisma.block.upsert({...}),
    prisma.match.updateMany({
      where: { OR: [{ user1Id: blockerId, user2Id: blockedId }, ...] },
      data: { status: 'UNMATCHED' },
    }),
    // MessageRequest entries NOT cleaned up
    // MessageState entries NOT cleaned up
  ]);
}
```

**Root Cause:** The transaction unmatches the user but does NOT clean up `MessageRequest` and `MessageState` records. If the Prisma schema has cascade delete on `MessageState` but not `MessageRequest`, orphaned records remain. Additionally, if `blockUser` is called twice on the same pair, the second call's `updateMany` returns `{ count: 0 }` but the transaction proceeds, potentially leaving inconsistent state.

**Fix:** Clean up `MessageRequest` and `MessageState` entries within the transaction. Add a guard to prevent double-blocking.

---

### RZ-B-B2 — Referral Credit Has No Distributed Lock — Double Credit Possible

**File:** `src/services/ReferralService.ts` (lines ~55-80)
**Severity:** HIGH
**Category:** Payment / Financial / Race Condition
**Status:** ACTIVE

**Code:**
```typescript
async creditReferrerIfEligible(referrerId: string, newProfileId: string): Promise<void> {
  const referrer = await prisma.profile.findUnique({ where: { id: referrerId } });
  if (referrer.meetupCount === 1) {
    // Credit the referrer
    await this.rewardReferrer(referrerId, newProfileId);
  }
}
```

**Root Cause:** The eligibility check (`meetupCount === 1`) and the credit operation are not atomic. If two meetups are validated within the same time window (e.g., concurrent checkins from different devices or a retry), both pass the `meetupCount === 1` check before either credit completes. The referrer gets credited twice.

**Fix:** Add a Redis distributed lock around the check-and-credit operation, or use a database-backed idempotency key:
```typescript
const lockKey = `referral:${referrerId}:${newProfileId}`;
const acquired = await redis.set(lockKey, '1', 'EX', 60, 'NX');
if (acquired !== 'OK') return; // already being processed
try {
  // check meetupCount and credit
} finally {
  await redis.del(lockKey);
}
```

---

### RZ-B-B3 — Referral applyCode Doesn't Verify Profile Completion

**File:** `src/services/ReferralService.ts` (lines ~95-120)
**Severity:** HIGH
**Category:** Business Logic / Functional
**Status:** ACTIVE

**Code:**
```typescript
async applyCode(profileId: string, code: string): Promise<boolean> {
  const referrer = await this.findByCode(code);
  await prisma.profile.update({
    where: { id: profileId },
    data: { referredBy: referrer.id, referralCount: { increment: 1 } },
  });
  return true;
}
```

**Root Cause:** After `applyCode` is called, the referrer's `referralCount` is incremented immediately. But there is no guarantee that the `newProfileId` completes profile creation (name, age, photo). If the user abandons signup after applying the code, the referrer's `referralCount` is inflated with a user who never became active.

**Fix:** Track referral credit as "pending" until the referred user completes profile creation (e.g., `referredProfileComplete: true`). Only credit after both conditions are met: (1) code applied, (2) profile fully created.

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-B-H1 | HIGH | HMAC recomputed inline; empty secret allows unsigned requests | ACTIVE |
| RZ-B-H2 | HIGH | 7 plan routes missing ID validation | ACTIVE |
| RZ-B-H3 | HIGH | Reward trigger fire-and-forget — silent failure loses rewards | ACTIVE |
| RZ-B-H4 | HIGH | Redis NX lock expires during long reward process | ACTIVE |
| RZ-B-H5 | HIGH | Gift expired webhook always returns success for missing records | ACTIVE |
| RZ-B-H6 | HIGH | REZ API called after DB commit — split-brain on timeout | ACTIVE |
| RZ-B-H7 | HIGH | Unnecessary type cast weakens `isSuspended` safety | ACTIVE |
| RZ-B-B1 | HIGH | blockUser doesn't clean MessageRequest/MessageState | ACTIVE |
| RZ-B-B2 | HIGH | Referral credit has no distributed lock — double credit possible | ACTIVE |
| RZ-B-B3 | HIGH | Referral applyCode doesn't verify profile completion | ACTIVE |
