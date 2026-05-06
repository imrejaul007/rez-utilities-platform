# Bug Report: Missed Items Addendum

**Audit Date:** 2026-04-14
**Source:** Cross-check of all 6-agent Business Logic Audit findings against existing bug files
**Status:** Items confirmed missing from all prior bug files

---

## MA-M1 — Campaign `maxBenefit` cap checked at creation but never at redemption {#ma-m1}
> **Status:** ✅ FIXED — atomic `totalBenefitIssued` counter added to `campaignController.ts:495-508`. `redeemDeal()` now uses `findOneAndUpdate` with `$expr: { $lt: ['$totalBenefitIssued', '$maxBenefit'] }` to atomically check and increment the cap before creating redemption records. Concurrent requests cannot both pass the cap check.

**Severity:** MEDIUM
**Impact:** A deal campaign configured with a financial ceiling can exceed that ceiling once live. Admin safety guardrails at creation time are bypassed at runtime.

**What is happening:**
`POST /api/admin/campaigns` validates:
```typescript
if (campaign.maxBenefit > 100000) {
  // requires engineering approval — creation blocked
}
```

`redeemDeal()` in `campaignController.ts` (lines 458–535) checks: `isActive`, `startTime`, `endTime`, `purchaseLimit`. It does **not** check `campaign.maxBenefit` against the total coins/cashback already issued for this campaign.

If a campaign has `maxBenefit: ₹5,000` and 1,000 users each redeem ₹10 of benefit, the total benefit issued will be ₹10,000 — 2× the admin-configured ceiling, with no enforcement.

**Files involved:**
- `rezbackend/rez-backend-master/src/routes/admin/campaigns.ts` — `maxBenefit` validated on creation only
- `rezbackend/rez-backend-master/src/controllers/campaignController.ts:458-535` — `redeemDeal()` missing `maxBenefit` check

**Fix:**
Add an atomic counter on `Campaign.totalBenefitIssued` (sum of all deal coin/cashback values issued). At redemption time:
```typescript
if (campaign.maxBenefit > 0) {
  const updated = await Campaign.findOneAndUpdate(
    { _id: campaignId, totalBenefitIssued: { $lt: campaign.maxBenefit } },
    { $inc: { totalBenefitIssued: dealCoinValue } },
    { returnDocument: 'after' }
  );
  if (!updated) throw new AppError('Campaign benefit limit reached', 400);
}
```

---

## MA-M2 — `dailySpendLimit` field on Wallet schema defined but never enforced by any code {#ma-m2}
> **Status:** ✅ FIXED — monolith already had enforcement in `walletService.ts` (lines 367-382). Wallet microservice now also enforces via `limits` subdocument added to `Wallet.ts` + dailySpendLimit checks in `debitCoins()` and `debitInPriorityOrder()`. Hotel OTA already treats wallet debit as fire-and-forget.

**Severity:** MEDIUM
**Impact:** Admin or compliance team may configure a daily spend ceiling believing it is enforced. It is not. Users can debit their wallet unlimited times per day regardless.

**What was fixed:**
1. Monolith `walletService.ts` — dailySpendLimit check before debit (line 367) + `$inc: {'limits.dailySpent'}` after commit + Mongoose pre-save hook resets `dailySpent` on new calendar day.
2. Wallet microservice `Wallet.ts` — added `ILimits` interface + `limits` subdocument with same defaults (`dailySpendLimit: 10000`, `dailySpent: 0`, `lastResetDate: Date.now`). Both `debitCoins()` and `debitInPriorityOrder()` now check and increment `dailySpent` with new-day reset detection.
3. Hotel OTA (`booking.service.ts`) — already treats wallet debit as fire-and-forget; daily limit exceeded returns 429 `DAILY_LIMIT_EXCEEDED`, logged as warning, booking proceeds.

---

## MA-M3 — `postPaymentProcessed` flag set before session commits — webhook log stays `processing` on crash {#ma-m3}
> **Status:** ✅ FIXED — WebhookLog now updated inside `handlePaymentSuccess()` transaction in `PaymentService.ts`

**Severity:** MEDIUM (monitoring gap, not financial loss)
**Impact:** If the server crashes after the wallet credit session commits but before `WebhookLog.findOneAndUpdate({processed:true})` runs, the webhook log permanently shows `processing`. Retry cron will re-run `processRazorpayEvent()`, which finds `postPaymentProcessed: true` and correctly skips the pipeline — but the `WebhookLog` is never marked `success`. False-positive alerts fire indefinitely for this payment.

**What was happening:**
Webhook processing flow:
```
1. WebhookLog.create({eventId, status:'processing'})    ← sets initial state
2. processRazorpayEvent()
   → handlePaymentSuccess() inside session.withTransaction()  ← coins credited here
3. WebhookLog.findOneAndUpdate({processed:true, status:'success'})  ← crash here?
```

If step 3 was never reached (process crash, OOM kill), `WebhookLog` stayed in `processing`.

**What was fixed:**
`PaymentService.handlePaymentSuccess()` now accepts an optional `webhookLogId` parameter. When provided, it updates `WebhookLog.processed` inside the same MongoDB transaction as the payment, just before `session.commitTransaction()`. The update is wrapped in try-catch so a log failure does NOT roll back the payment.

`webhookController.ts:465` and `webhookController.ts:1446` now pass `webhookLogId` to `handlePaymentSuccess()` for both Razorpay and Stripe payment events.

```typescript
// PaymentService.ts — inside handlePaymentSuccess, before commit:
if (opts?.webhookLogId) {
  try {
    await WebhookLog.findByIdAndUpdate(
      opts.webhookLogId,
      { $set: { processed: true, processedAt: new Date(), status: 'success' } },
      { session }
    );
  } catch (logErr) {
    logger.error('[PAYMENT SERVICE] MA-M3: WebhookLog update failed inside transaction:', logErr);
  }
}
await session.commitTransaction();
```

**Files involved:**
- `rezbackend/rez-backend-master/src/services/PaymentService.ts` — `handlePaymentSuccess()` with webhookLogId option
- `rezbackend/rez-backend-master/src/controllers/webhookController.ts` — passes webhookLogId to handlePaymentSuccess

---

## MA-L1 — BullMQ `gamification-events` worker uses `Date.now()` in `coin-earned` notification eventId — duplicate notifications on retry {#ma-l1}
> **Status:** ✅ FIXED — `eventId` now uses `job.id` (stable across BullMQ retries) instead of `Date.now()`. `rez-gamification-service/src/worker.ts:129-130` uses `\`coin-earned-${userId}-${source}-${jobId ?? Date.now()}\`` — BullMQ job IDs are stable across retries so notifications won't duplicate.

**Severity:** LOW
**Impact:** When a BullMQ gamification job retries, the `coin_earned` push notification is sent to the user again. Users receive duplicate "You earned X coins" notifications for the same event.

**What was happening:**
`rez-gamification-service/src/worker.ts` used `Date.now()` in the `eventId`:
```typescript
eventId: `coin-earned-${userId}-${source}-${Date.now()}`
```

On BullMQ job retry (e.g., worker crash mid-processing), `Date.now()` produces a new value. The notification deduplication layer uses `eventId` as the key. A new `eventId` on each retry means a new notification fires.

Compare: `storeVisitStreakWorker.ts` and `achievementWorker.ts` both use stable IDs derived from `userId + visitId/achievementType`.

**What was fixed:**
`rez-gamification-service/src/worker.ts:129-130`:
```typescript
// MA-L1 FIX: Use stable job.id instead of Date.now() to prevent duplicate notifications on BullMQ retry
eventId: `coin-earned-${userId}-${source}-${jobId ?? Date.now()}`,
```
BullMQ job IDs are stable across retries — fallback to `Date.now()` only when `jobId` is absent (non-BullMQ context).

---

## MA-L2 — `coinExpiryPolicy.ts` does not handle `'prive'` coin type — TypeScript type error on call {#ma-l2}
> **Status:** ✅ FIXED — `'prive'` added to `CoinType` union and `COIN_EXPIRY_CONFIG` in `coinExpiryPolicy.ts`. Prive coins now get a 365-day TTL from earned date (matches `currencyRules.ts`).

**Severity:** LOW
**Impact:** Any code calling `getCoinExpiryDate(earnedAt, 'prive')` would fail a TypeScript type check. Without the `prive` entry, the function would return `undefined` TTL, making Privé coins invisible to the daily expiry cron.

**What was fixed:**
`rezbackend/rez-backend-master/src/utils/coinExpiryPolicy.ts:16-17`:
```typescript
// MA-L2 FIX: Added 'prive' — was missing, causing coin expiry jobs to fail for Prive coin holders
export type CoinType = 'rez' | 'promo' | 'branded' | 'trial' | 'prive';
```
And the config entry:
```typescript
prive: 365, // Prive premium coins: 12-month expiry
```

---

## MA-L3 — Walk-in store visits are never attributed to user accounts — loyalty permanently lost for unregistered shoppers {#ma-l3}
> **Status:** ✅ FIXED (Phase 1 — phone lookup) — `getQueueNumber` in `storeVisitController.ts` now attempts `User.findOne({ phoneNumber: customerPhone })` when `req.userId` is absent, attaching `userId` to walk-in visits for registered users. Gamification events then fire normally via the existing `if (visit.userId)` guard in `updateVisitStatusByMerchant`. Retroactive attribution job for historical walk-in visits remains Phase 2.

**Severity:** LOW
**Impact:** A customer who visits a store without scanning QR (walk-in recorded by merchant) never receives loyalty credit even if they are a registered REZ user with the same phone number.

**What is happening:**
`StoreVisit.userId` is optional (no `required: true`). Walk-in visits created by the merchant have no `userId`. The gamification event handlers check:
```typescript
if (visit.userId) {
  gamificationEventBus.emit('visit_checked_in', { userId: visit.userId });
}
```
If `userId` is absent, the event is skipped entirely. No streak update, no milestone credit, no loyalty record.

There is no customer matching logic (e.g., match by phone number) to retroactively attribute walk-in visits to a registered user account.

**Files involved:**
- `rezbackend/rez-backend-master/src/models/StoreVisit.ts` — `userId` optional
- `rezbackend/rez-backend-master/src/controllers/storeVisitController.ts` — `if (visit.userId)` guard

**Fix (phased):**
1. Short-term: When merchant creates a walk-in visit with a phone number, attempt a `User.findOne({ phone })` lookup and attach `userId` if found.
2. Long-term: Add a retroactive attribution job that matches existing walk-in visits to user accounts by phone.
