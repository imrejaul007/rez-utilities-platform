# HIGH Bugs — Master Consolidated List

**Source:** All 13 audit generations consolidated
**Total HIGH Issues:** ~100 unique bugs (many overlap under different IDs)
**Deduplication:** 150+ HIGH appearances reduce to ~100 unique issues

---

## Category 1: Financial Integrity & Business Logic

### F-01: Rewards Preview Formula 50% Inaccurate

**Files:** `rez-app-consumer/hooks/usePaymentFlow.ts:185-202`
**Severity:** HIGH
**Sources:** NA-HIGH-02, CS-E11
**Est Fix:** 3 hours

`rewardsPreview.coinsToEarn` uses only `baseCashbackPercent`. Backend applies category rate (2.5-6%), subscription multiplier (1x-3x), Prive multiplier (1x-2x), and 15% hard cap. Discrepancy up to 50%.

**Fix:** Server-side preview endpoint or show range until that exists.

---

### F-02: Karma Credits `'rez'` Coins But Queries `'karma_points'`

**Files:** `rez-karma-service/src/services/walletIntegration.ts:115-134`
**Severity:** HIGH
**Sources:** NA-HIGH-03, G-KU-H2
**Est Fix:** 30 minutes

`getKarmaBalance()` queries `coinType: 'karma_points'` but `creditUserWallet()` credits `coinType: 'rez'`. Always returns 0.

**Fix:** Align `coinType` across both functions.

---

### F-03: Visit Milestone Dedup Key 1-Second Collision Window

**Files:** `rez-wallet-service/src/services/walletService.ts`; `rez-gamification-service/src/httpServer.ts`
**Severity:** HIGH
**Sources:** NA-HIGH-05, CS-M9
**Est Fix:** 30 minutes

`Math.floor(Date.now() / 1000)` resets dedup key every second. Concurrent visit events within same second produce identical keys — milestone rewards silently lost.

**Fix:** Use `Date.now()` at millisecond resolution or append UUID.

---

### F-04: Rewards Hook Idempotency Silent Drop

**Files:** `rez-finance-service/src/services/rewardsHookService.ts`
**Severity:** HIGH
**Sources:** NA-HIGH-06, F001-C15
**Est Fix:** 2 hours

Idempotency check is applied BEFORE wallet service call, not as a distributed two-phase commit. If wallet times out without writing ledger entry, retry silently drops.

**Fix:** Idempotency check AFTER downstream call succeeds, or wallet service owns the idempotency key.

---

### F-05: Floating-Point Truncation on Coin Redemption

**Files:** `rez-app-consumer/app/bill-payment.tsx`
**Severity:** HIGH
**Sources:** NA-HIGH-07, CS-E11
**Est Fix:** 1 hour

`Math.floor((fetchedBill.amount * (selectedProvider.maxRedemptionPercent / 100)))` truncates IEEE 754 epsilon downward. `577 * 0.05 = 28.85`, floor to 28 instead of expected 29.

**Fix:** `(amountInPaise * maxRedemptionPercent) / 100` then `Math.round`.

---

### F-06: Hardcoded Day Reward Values

**Files:** `rez-app-consumer/services/gamificationApi.ts`
**Severity:** HIGH
**Sources:** NA-HIGH-08
**Est Fix:** 1 hour

`dayRewards: [10, 15, 20, 25, 30, 40, 100]` hardcoded as fallback when server unreachable. Server values ignored.

**Fix:** Remove hardcoded fallback. Show "Rewards unavailable" when server unreachable.

---

### F-07: Leaderboard Rank Off-by-One

**Files:** `rez-gamification-service/src/httpServer.ts`
**Severity:** HIGH
**Sources:** NA-HIGH-09
**Est Fix:** 1 hour

`rank: start + i + 1` creates 1-off error throughout the slice. Every user sees rank 1 higher than reality.

**Fix:** `rank: userIndex + 1`

---

### F-08: Dedup Key Collision (Visit Milestone, Gamification)

**Files:** `rez-wallet-service/src/services/walletService.ts`
**Severity:** HIGH
**Sources:** CS-M9, FE-PAY-005
**Est Fix:** 10 minutes

Millisecond-level collision on `Math.floor(Date.now() / 1000)`. Duplicate dedup key = silent reward loss.

**Fix:** `Date.now()` at ms resolution.

---

### F-09: Finance Silent Coin Failure

**Files:** `rez-finance-service/src/...`
**Severity:** HIGH
**Sources:** F001-C15, CS-M10
**Est Fix:** 2 hours

Finance service swallows errors from wallet service calls. Coins silently not credited with no error, no retry, no user notification.

**Fix:** Throw on failure, add retry queue with DLQ.

---

### F-10: Finance Rewards Hook Wrong Endpoint + Fields

**Files:** `rez-finance-service/src/services/rewardsHookService.ts`
**Severity:** HIGH
**Sources:** F001-C15
**Est Fix:** 2 hours

Rewards hook calls wrong endpoint with wrong field names. Coin credits fail silently.

**Fix:** Verify endpoint URL and field names match wallet service contract.

---

### F-11: Welcome Coins Race Condition

**Files:** `rez-auth-service/src/...`
**Severity:** HIGH
**Sources:** F001-C15
**Est Fix:** 1 hour

Welcome coin credit fires on auth without distributed lock. Concurrent signups or retries can double-credit.

**Fix:** Add Redis NX lock around welcome coin credit.

---

### F-12: Coin Rate Divergence Hardcoded 1:1

**Files:** `rez-finance-service/src/...`
**Severity:** HIGH
**Sources:** F001-C10, CS-E11
**Est Fix:** 1 hour

Hardcoded 1:1 coin rate instead of reading from `COIN_TO_INR_RATE` env var. If env var changes, finance and payment diverge.

**Fix:** Import from `@rez/shared` and remove hardcoded constant.

---

### F-13: Loyalty Tier Typo `'DIMAOND'`

**Files:** `rez-shared/src/constants/coins.ts`
**Severity:** HIGH
**Sources:** HIGH-011, F001-C16, CS-E12
**Est Fix:** 15 minutes

`LoyaltyTier.DIMAOND = 'platinum'` corrects typo but missing `diamond: 'diamond'` mapping. Users with `'diamond'` in DB aren't matched by tier queries.

**Fix:** Add `diamond: 'diamond'` to mapping. Run migration for `'DIMAOND'` → `'platinum'`.

---

### F-14: Coin Type Normalization Lost for Legacy Data

**Files:** `rez-shared/src/constants/coins.ts`
**Severity:** HIGH
**Sources:** HIGH-010, CS-E15
**Est Fix:** 2 hours

`LEGACY_COIN_TYPE_MAP.nuqta = 'rez'` only normalizes writes. Reading old `nuqta` records returns 0 results for `rez` queries. Historical balances wrong.

**Fix:** Run migration to update all `nuqta` → `rez`. Or update reads to `$in: ['rez', 'nuqta']`.

---

### F-15: Adjust Balance Can Go Negative

**Files:** `rez-app-consumer/stores/walletStore.ts:70-88`
**Severity:** HIGH
**Sources:** NA-HIGH-04
**Est Fix:** 15 minutes

`adjustBalance(delta)` adds delta without checking if result goes negative. Race condition on optimistic update could show negative balance.

**Fix:** `const newBalance = Math.max(0, currentBalance + delta)`

---

### F-16: No Wallet Balance Check Before Gift Send

**Files:** `rendez-app/src/app/GiftPickerScreen.tsx:45-54`
**Severity:** HIGH
**Sources:** RZ-M-P1
**Est Fix:** 30 minutes

Gift mutation fires without checking wallet balance first. Cryptic backend error if insufficient.

**Fix:** Fetch balance first, show "Insufficient balance" alert.

---

### F-17: Withdrawal No Upper Bound on Cashback Approval

**Files:** `rezmerchant/app/(cashback)/[id].tsx:54`
**Severity:** HIGH
**Sources:** G-MA-H03
**Est Fix:** 15 minutes

`approvedAmount > cashback.requestedAmount` not checked. Can approve more than requested.

**Fix:** `if (approvedAmount > cashback.requestedAmount) return error`

---

### F-18: Inconsistent Withdrawal Unit — Paise vs Rupees

**Files:** `rezmerchant/services/api/wallet.ts:137` vs `rezmerchant/app/payouts/index.tsx:241`
**Severity:** HIGH
**Sources:** G-MA-H04
**Est Fix:** 30 minutes

Payouts page converts `rupees * 100` but wallet service expects `amount` with no conversion. Undocumented unit.

**Fix:** Document unit in type. Add `amountPaise: number` annotation. Normalize both.

---

### F-19: Discount Percentage Not Capped at 100%

**Files:** `rezmerchant/services/api/pos.ts:200-220`
**Severity:** HIGH
**Sources:** G-MA-H06
**Est Fix:** 15 minutes

`discountPercent = 120` → `total = subtotal * (1 - 1.2)` = negative total.

**Fix:** `if (discountPercent > 100) discountPercent = 100`

---

### F-20: Payment Service Hardcodes Coin Cap at 10,000

**Files:** `rez-payment-service/src/services/paymentService.ts`
**Severity:** HIGH
**Sources:** HIGH-012, FE-PAY-013
**Est Fix:** 30 minutes

`Math.min(Math.floor(payment.amount), 10000)` — Rs 50,000 purchase earns only 10,000 coins.

**Fix:** Import `MAX_COINS_PER_TRANSACTION` from `@rez/shared`.

---

### F-21: Monolith Webhook Trusts Payload Without Verification

**Files:** `rezbackend/.../src/controllers/webhookController.ts`
**Severity:** HIGH
**Sources:** FE-PAY-013
**Est Fix:** 30 minutes

Microservice verifies Razorpay payload but monolith does NOT. If monolith is still in webhook routing, fake webhooks credit wallets.

**Fix:** Add `razorpay.getPaymentDetails()` verification to monolith webhook handler.

---

### F-22: Math.random() Used for Payment IDs

**Files:** `rezbackend/.../src/utils/razorpayUtils.ts:412`; `rezbackend/.../src/merchantroutes/pos.ts:547`; `rezbackend/.../src/services/integrationService.ts:221`
**Severity:** HIGH
**Sources:** NA-CRIT-09, NW-CRIT-001
**Est Fix:** 30 minutes

`Math.random()` for payment IDs, receipt IDs, batch IDs. Not cryptographically random — collisions possible.

**Fix:** Replace all with `crypto.randomUUID()`.

---

### F-23: Reconciliation Amounts Double-Divided

**Files:** `rez-now/components/merchant/reconcile/TransactionList.tsx:24-26`
**Severity:** HIGH
**Sources:** NW-HIGH-006
**Est Fix:** 15 minutes

`formatPaise(tx.amount)` calls `formatINR(tx.amount / 100)`. If backend sends rupees instead of paise, display is 100x too small.

**Fix:** Assert amounts > 10000. Document unit in type definition.

---

### F-24: Redeem Stamps No Idempotency Key

**Files:** `rez-now/lib/api/loyalty.ts:30-39`
**Severity:** HIGH
**Sources:** NW-HIGH-007
**Est Fix:** 15 minutes

`redeemStamps(storeSlug)` sends no idempotency key. Rapid click race condition could generate duplicate reward codes.

**Fix:** `makeIdempotencyKey('loyalty-redeem', storeSlug + userId)`

---

### F-25: Client-Side Coupon Validation Without Server Re-validation

**Files:** `rez-now/components/checkout/CouponInput.tsx:41-69`
**Severity:** HIGH
**Sources:** NW-HIGH-008
**Est Fix:** 30 minutes

`applyCode` does client-side `coupons.find()` against cached list. No server-side validation at checkout. Users could modify JS to apply any coupon.

**Fix:** Always call `POST /api/web-ordering/coupon/validate` at checkout.

---

### F-26: Client-Side Prices in localStorage Manipulatable

**Files:** `rez-now/lib/api/payment.ts:20-26`
**Severity:** HIGH
**Sources:** NW-HIGH-009, NA-CRIT-02
**Est Fix:** 1 hour

`createRazorpayOrder` accepts `subtotal` from client (localStorage). Users could modify prices before checkout.

**Fix:** Backend re-validates prices from canonical catalog source, not client-submitted values.

---

### F-27: Gift Send Doesn't Invalidate Wallet Balance

**Files:** `rendez-app/src/app/GiftPickerScreen.tsx:47-50`
**Severity:** HIGH
**Sources:** RZ-M-F2
**Est Fix:** 5 minutes

`onSuccess` invalidates only `['messages']`, not `['wallet-balance']`. UI shows stale balance after sending gift.

**Fix:** Add `queryClient.invalidateQueries({ queryKey: ['wallet-balance'] })`

---

### F-28: Confirm Modal Dismisses Before Mutation Fires

**Files:** `rendez-app/src/app/GiftPickerScreen.tsx:57-75`
**Severity:** HIGH
**Sources:** RZ-M-F5
**Est Fix:** 10 minutes

`setConfirmVisible(false)` closes modal BEFORE mutation fires. If mutation fails, no confirmation dialog, user must navigate back.

**Fix:** `sendMutation.mutate(payload, { onSuccess: () => setConfirmVisible(false), onError: () => {} })`

---

### F-29: Referral Credit No Distributed Lock — Double Credit Possible

**Files:** `rendez-backend/src/services/ReferralService.ts:55-80`
**Severity:** HIGH
**Sources:** RZ-B-B2
**Est Fix:** 30 minutes

Eligibility check (`meetupCount === 1`) and credit not atomic. Two concurrent meetups both pass check before either credits — referrer double-credited.

**Fix:** Redis NX lock around check-and-credit operation.

---

### F-30: Referral applyCode Doesn't Verify Profile Completion

**Files:** `rendez-backend/src/services/ReferralService.ts:95-120`
**Severity:** HIGH
**Sources:** RZ-B-B3
**Est Fix:** 1 hour

`referralCount` incremented immediately on code apply, before referred user completes profile. Abandoned signups inflate referrer count.

**Fix:** Track credit as "pending" until referred user completes profile creation.

---

### F-31: Gift Expired Webhook Always Returns Success for Missing Records

**Files:** `rendez-backend/src/routes/webhooks/rez.ts:34`
**Severity:** HIGH
**Sources:** RZ-B-H5
**Est Fix:** 15 minutes

Always returns `{ received: true }` even when voucher not found. Prevents REZ from detecting sync issues.

**Fix:** `if (!gift) return res.status(404).json({ received: false, error: 'Gift not found' })`

---

### F-32: REZ API Called After DB Commit — Split-Brain on Timeout

**Files:** `rendez-backend/src/services/GiftService.ts:123-138`
**Severity:** HIGH
**Sources:** RZ-B-H6
**Est Fix:** 1 hour

DB status updated to ACCEPTED before REZ API call succeeds. If API times out, split-brain — DB says accepted, REZ says pending.

**Fix:** Idempotency key in DB record. Two-phase pattern or outbox table.

---

### F-33: Reward Trigger Fire-and-Forget — Silent Failure Loses Rewards

**Files:** `rendez-backend/src/services/MeetupService.ts:98-104`
**Severity:** HIGH
**Sources:** RZ-B-H3
**Est Fix:** 1 hour

`._triggerRewardAndNotify(...).catch(console.error)` fires asynchronously. If it fails permanently, lock expires and reward is lost. User sees "coins incoming" that never arrive.

**Fix:** BullMQ job with retries: `attempts: 3, backoff: { type: 'exponential', delay: 5000 }`

---

### F-34: Redis NX Lock Expires During Long Reward Process

**Files:** `rendez-backend/src/services/MeetupService.ts:98`
**Severity:** HIGH
**Sources:** RZ-B-H4
**Est Fix:** 30 minutes

Lock TTL 5 minutes. If `_triggerRewardAndNotify` takes longer (network latency), lock expires and concurrent checkin triggers duplicate reward.

**Fix:** Lock heartbeat renewal during reward process, or DB-backed pessimistic lock.

---

### F-35: CSR Pool Non-Atomic Decrement

**Files:** `rez-karma-service/src/services/batchService.ts:474-477`
**Severity:** HIGH
**Sources:** G-KS-B8
**Est Fix:** 20 minutes

`$inc: { coinPoolRemaining: -cappedCoins }` without CAS guard. Concurrent batches could over-deplete pool.

**Fix:** Add `coinPoolRemaining: { $gte: cappedCoins }` to filter; check `modifiedCount === 0`.

---

### F-36: Kill Switch Sets Wrong Status

**Files:** `rez-karma-service/src/services/batchService.ts:687-697`
**Severity:** HIGH
**Sources:** G-KS-B3
**Est Fix:** 5 minutes

`pauseAllPendingBatches` sets `status: 'DRAFT'` instead of `status: 'PAUSED'`. Paused batches indistinguishable from drafts.

**Fix:** `$set: { status: 'PAUSED' }`

---

### F-37: Decay Worker Runs Weekly, Not Daily

**Files:** `rez-karma-service/src/workers/decayWorker.ts:26`
**Severity:** HIGH
**Sources:** G-KS-B5
**Est Fix:** 5 minutes

Comment says "daily" but `cronTime = '59 23 * * 0'` — weekly Sunday 23:59.

**Fix:** `cronTime: '0 0 * * *'` (daily at midnight UTC)

---

### F-38: createEarnRecord Bypasses addKarma — No Level History

**Files:** `rez-karma-service/src/services/earnRecordService.ts:138,219-236`
**Severity:** HIGH
**Sources:** G-KS-B9
**Est Fix:** 1 hour

Primary production path (`createEarnRecord`) calls `updateProfileStats` instead of `addKarma`. Level upgrades, activity history, weekly cap tracking all bypassed.

**Fix:** `createEarnRecord` should call `addKarma` or merge `updateProfileStats` into `addKarma`.

---

### F-39: eventsCompleted Double-Increment

**Files:** `rez-karma-service/src/services/earnRecordService.ts:228-236,300-302`
**Severity:** HIGH
**Sources:** G-KS-B10, F001-C5
**Est Fix:** 1 hour

`eventsCompleted += 1` appears in both `recordKarmaEarned` and `updateProfileStats`. Karma inflation depending on which code path was used.

**Fix:** Consolidate increment to single site in `addKarma`.

---

### F-40: eventsJoined Never Incremented — Trust Score Broken

**Files:** `rez-karma-service/src/services/karmaService.ts:151-174`; `earnRecordService.ts:299-305`
**Severity:** HIGH
**Sources:** G-KS-B11
**Est Fix:** 30 minutes

`eventsJoined` never incremented anywhere. `calculateTrustScore` weights completion rate at 30% — always 0 for all users.

**Fix:** Increment `eventsJoined` alongside `eventsCompleted` in `addKarma`.

---

### F-41: avgEventDifficulty Never Updated — 15% Trust Weight Lost

**Files:** `rez-karma-service/src/services/earnRecordService.ts:299-305`
**Severity:** HIGH
**Sources:** G-KS-B12
**Est Fix:** 30 minutes

`updateProfileStats` updates `avgConfidenceScore` but NOT `avgEventDifficulty`. 15% of trust score permanently zero for all users.

**Fix:** Add `avgEventDifficulty` running average update in `updateProfileStats`.

---

### F-42: Pre-Computed rezCoinsEarned Never Validated

**Files:** `rez-karma-service/src/services/batchService.ts:289-302,439-445`
**Severity:** HIGH
**Sources:** G-KS-B14
**Est Fix:** 30 minutes

`rezCoinsEarned` stored at record creation but ignored at batch execution. If intermediate value becomes 0/null, user receives 0 coins with no audit trail.

**Fix:** Compare pre-computed vs live calculation; log discrepancies.

---

### F-43: WEEKLY_COIN_CAP Hardcoded Instead of Imported

**Files:** `rez-karma-service/src/services/karmaService.ts:127`
**Severity:** HIGH
**Sources:** G-KS-B13
**Est Fix:** 5 minutes

`WEEKLY_COIN_CAP = 300` hardcoded but correctly imported from `karmaEngine.js` elsewhere. Duplicate can diverge silently.

**Fix:** `import { WEEKLY_COIN_CAP } from '../engines/karmaEngine.js'`

---

### F-44: Auto-Checkout Doesn't Create EarnRecord — Karma Lost

**Files:** `rez-karma-service/src/workers/autoCheckoutWorker.ts:119-124`
**Severity:** HIGH
**Sources:** G-KS-B4
**Est Fix:** 30 minutes

Users who forget to check out get zero karma. Comment says "partial credit" but code doesn't implement it.

**Fix:** Create partial EarnRecord with `confidenceScore: 0.3` after auto-checkout.

---

### F-45: No Karma Input Validation — Accepts Negative/NaN/Infinity

**Files:** `rez-karma-service/src/services/karmaService.ts:106-144`
**Severity:** HIGH
**Sources:** G-KS-B2
**Est Fix:** 15 minutes

`addKarma(karma: number)` has no runtime validation. Malicious actor crafts `karmaEarned: -1000` and corrupts balances.

**Fix:** `if (!Number.isFinite(karma) || karma <= 0) throw new Error('Karma must be positive finite number')`

---

### F-46: Duplicate Const startOfWeek (Compile Error + Wrong Boundary)

**Files:** `rez-karma-service/src/services/karmaService.ts:128,195`
**Severity:** HIGH (P0-KARMA-001 duplicate)
**Sources:** G-KS-B1, NA-HIGH-12, F001-C17
**Est Fix:** 5 minutes

Duplicate `const startOfWeek` declaration. TypeScript with `strict: true` is compile error. Also: uses `startOf('week')` in karmaService vs `startOf('isoWeek')` in batchService — different week boundaries for same weekly cap.

**Fix:** Remove duplicate declaration. Standardize to `startOf('isoWeek')` everywhere.

---

### F-47: Mixed startOf('week') vs isoWeek — Inconsistent Week Boundaries

**Files:** Multiple karma service files
**Severity:** HIGH
**Sources:** G-KS-B7, CS-E18
**Est Fix:** 30 minutes

`karmaService.ts` uses locale-aware Sunday; `batchService.ts` uses ISO Monday. Weekly karma cap and weekly coin conversion use different boundaries.

**Fix:** Standardize all to `startOf('isoWeek')`.

---

### F-48: Payment Service Non-Atomic Wallet Credit

**Files:** `rez-payment-service/src/services/paymentService.ts`
**Severity:** HIGH
**Sources:** HIGH-002
**Est Fix:** 30 minutes

`walletCredited` flag and BullMQ job enqueue not atomic. Crash between steps = double credit on retry.

**Fix:** Use job ID as idempotency key: `jobId: wallet-credit-${paymentId}`

---

### F-49: Payment Service Rejects Legacy Token

**Files:** `rez-payment-service/src/middleware/internalAuth.ts`
**Severity:** HIGH
**Sources:** HIGH-003
**Est Fix:** 30 minutes

Payment service accepts only `INTERNAL_SERVICE_TOKENS_JSON` (new format). Wallet service accepts both. Backend monolith may use legacy — cannot communicate with payment service.

**Fix:** Accept both formats with fallback.

---

### F-50: Payment Service Sends Secret in Body Not Header

**Files:** `rez-payment-service/src/services/paymentService.ts`
**Severity:** HIGH
**Sources:** HIGH-001, F001-C11
**Est Fix:** 15 minutes

`secret: internalSecret` sent in JSON body. Auth middleware expects `X-Internal-Token` header. Wallet credit silently fails.

**Fix:** `axios.post(url, body, { headers: { 'X-Internal-Token': internalSecret } })`

---

### F-51: Authorized Payment State Has No Inbound Path

**Files:** `rez-shared/src/paymentStatuses.ts`
**Severity:** HIGH
**Sources:** HIGH-013
**Est Fix:** 15 minutes

`'authorized'` in `PAYMENT_STATUSES` but no transition leads to it. Dead state — if any code sets payment to `authorized`, FSM validation passes but state is unreachable.

**Fix:** Either remove `'authorized'` from statuses, or add `processing: ['authorized']` and `authorized: ['paid']`.

---

### F-52: Coin Formula Off by Factor of 10

**Files:** `rez-now/app/[storeSlug]/pay/checkout/page.tsx:126`
**Severity:** HIGH
**Sources:** NA-HIGH-01
**Est Fix:** 10 minutes

`(effectiveAmount / 100 / 10)` double-divides. Rs 100 payment with 10% cashback = 0 coins instead of 10.

**Fix:** `(effectiveAmount / 100) * ((baseCashbackPercent || 0) / 100)`

---

### F-53: SKU Validation Fail-Open Allows Duplicates

**Files:** `rezmerchant/services/api/products.ts:911-916`
**Severity:** HIGH
**Sources:** G-MA-H10
**Est Fix:** 15 minutes

Catch block returns `{ isAvailable: true }` on error. Unreachable server = duplicates allowed.

**Fix:** Return `{ isAvailable: false, message: 'Could not validate — please try again' }`

---

### F-54: Gift Voucher Authorization Bypass

**Files:** `rendez-backend/src/routes/gift.ts:80`
**Severity:** HIGH
**Sources:** RZ-B-C1
**Est Fix:** 30 minutes

Gift retrieval doesn't verify caller owns the profileId from JWT. Any user can retrieve any voucher QR code.

**Fix:** Verify `caller.profileId === voucher.ownerId` from JWT.

---

---

## Category 2: Security

### S-01: Token Blacklist Fails Open When Redis Down

**Files:** `rez-auth-service/src/services/tokenService.ts:74-105`
**Severity:** HIGH
**Sources:** SEC-AUTH-REDIS-FAIL-001
**Est Fix:** 15 minutes

When Redis unavailable, fallback to MongoDB. If MongoDB ALSO fails, assumes token is valid. Revoked tokens work in degraded environments.

**Fix:** Fail closed — default to DENY when both Redis and MongoDB unavailable.

---

### S-02: HMAC Empty Secret Allows Unsigned Requests

**Files:** `rendez-backend/src/routes/experienceCredits.ts:11-42`
**Severity:** HIGH
**Sources:** RZ-B-H1
**Est Fix:** 10 minutes

If `REZ_SECRET` is undefined/empty, `timingSafeEqual` runs with empty buffers. Unsigned requests may pass.

**Fix:** `if (!REZ_SECRET) throw new Error('[FATAL] REZ.WEBHOOK_SECRET is not set')`

---

### S-03: MD5 Used for Image Integrity Hash

**Files:** `rez-app-consumer/services/billVerificationService.ts`; `rez-app-consumer/services/imageHashService.ts:342`
**Severity:** HIGH
**Sources:** NA-HIGH-19
**Est Fix:** 1 hour

MD5 is cryptographically broken. Combined with NA-CRIT-02 (client-controlled amount), enables mass cashback fraud.

**Fix:** Replace with SHA-256 or use existing perceptual hash.

---

### S-04: IDOR on Bill and Transaction Access

**Files:** `rez-app-consumer/services/billVerificationService.ts`; `services/walletApi.ts`
**Severity:** HIGH
**Sources:** NA-HIGH-20
**Est Fix:** 2 hours

`getBillById` and `getTransactionById` accept any ID without verifying authenticated user owns that record. GDPR violation.

**Fix:** Add `userId: authenticatedUserId` to all query filters at service layer.

---

### S-05: Auth Tokens in localStorage — XSS Vulnerable

**Files:** `rez-app-consumer/services/authStorage.ts:153-197`
**Severity:** HIGH
**Sources:** NA-HIGH-21, NW-CRIT-014
**Est Fix:** 2 hours

On web, tokens written to localStorage. Any XSS exposes all tokens — full account takeover.

**Fix:** `httpOnly; Secure; SameSite=Strict` cookies or `sessionStorage` with short token rotation.

---

### S-06: Client-Side Fraud Detection Complete Fail-Open

**Files:** `rez-app-consumer/services/fraudDetectionService.ts:502,632`
**Severity:** HIGH
**Sources:** NA-HIGH-22
**Est Fix:** 3 hours

`verifyInstagramAccount()` returns `isVerified: true` by default without actual verification. `performFraudCheck()` returns `allowed: true` on any error.

**Fix:** All fraud checks must be server-side. Client checks are UX only, never authoritative.

---

### S-07: Device Fingerprint in AsyncStorage — Tamperable

**Files:** `rez-app-consumer/services/securityService.ts:191-204`
**Severity:** HIGH
**Sources:** NA-HIGH-23
**Est Fix:** 2 hours

Client-side fingerprint with djb2 hash of simple properties. Trivially spoofed. Multi-account fraud, device-banning evasion.

**Fix:** Server-side device fingerprint with HMAC signature.

---

### S-08: parseInt(age) Sends NaN to Backend

**Files:** `rendez-app/src/app/ProfileSetupScreen.tsx:36-49`
**Severity:** HIGH
**Sources:** RZ-M-B1
**Est Fix:** 10 minutes

`parseInt('twenty') === NaN` — button disabled (good) but mutation sends `{ age: NaN }` to backend.

**Fix:** Validate before mutation: `const ageNum = parseInt(age); if (isNaN(ageNum) || ageNum < 18) return`

---

### S-09: Age Input Allows Non-Numeric Paste

**Files:** `rendez-app/src/app/ProfileSetupScreen.tsx:89`
**Severity:** HIGH
**Sources:** RZ-M-E2
**Est Fix:** 10 minutes

No numeric guard on text input. `keyboardType="numeric"` doesn't prevent paste of "twenty". NaN sent to backend.

**Fix:** `onChangeText={(t) => setAge(t.replace(/\D/g, '').slice(0, 2))}` — `LoginScreen.tsx:130` already does this.

---

### S-10: 7 Plan Routes Missing ID Validation

**Files:** `rendez-backend/src/routes/plans.ts:72-149`
**Severity:** HIGH
**Sources:** RZ-B-H2
**Est Fix:** 30 minutes

`GET /plans/:id`, `DELETE /plans/:id/apply`, `POST /plans/:id/select/:applicantId`, etc. Malformed IDs cause Prisma runtime error → 500.

**Fix:** Add `isValidId()` guard to all path params.

---

### S-11: 7 Route Plans: POST /plans/:id/select/:applicantId No Ownership Check

**Files:** `rendez-backend/src/routes/plans.ts:119`
**Severity:** HIGH
**Sources:** RZ-B-H2
**Est Fix:** 15 minutes

`POST /plans/:id/select/:applicantId` doesn't verify caller owns the plan. Any user can select applicants for any plan.

**Fix:** Verify `plan.ownerId === caller.profileId`

---

### S-12: Unnecessary Type Cast Weakens isSuspended Safety

**Files:** `rendez-backend/src/middleware/auth.ts:62`
**Severity:** HIGH
**Sources:** RZ-B-H7
**Est Fix:** 5 minutes

`(profile as typeof profile & { isSuspended?: boolean }).isSuspended` makes non-optional field optional. Weaker type safety.

**Fix:** `if (profile.isSuspended) {`

---

### S-13: Socket read_receipt Bypasses MatchId Ownership

**Files:** `rendez-backend/src/realtime/socketServer.ts:155`
**Severity:** HIGH
**Sources:** RZ-B-C4
**Est Fix:** 30 minutes

Socket `read_receipt` event doesn't verify `matchId` ownership. User can mark any message in any match as read.

**Fix:** Add `matchId` ownership check on message query.

---

### S-14: Platform Settings Save Has No Role Guard

**Files:** `rez-app-admin/app/(dashboard)/admin-settings.tsx:135-163`
**Severity:** HIGH
**Sources:** A10-H10
**Est Fix:** 15 minutes

Any authenticated admin (support, operator, admin, super_admin) can modify `cashbackMultiplier`, `maintenanceMode`, `maxCoinsPerDay`. `hasRole(ADMIN_ROLES.SUPER_ADMIN)` missing.

**Fix:** `if (!hasRole(ADMIN_ROLES.SUPER_ADMIN)) return alert('Access Denied')`

---

### S-15: Web Socket Connects with Null Auth Token

**Files:** `rez-app-admin/services/socket.ts:26,113`
**Severity:** HIGH
**Sources:** A10-H11
**Est Fix:** 15 minutes

On web with `COOKIE_AUTH_ENABLED=true`, socket connects without credentials. Admins unauthenticated at socket layer.

**Fix:** Use cookie-based auth for socket, or require token even when `COOKIE_AUTH_ENABLED`.

---

### S-16: Two Conflicting hasRole Implementations

**Files:** `rez-app-admin/contexts/AuthContext.tsx:430-443` vs `app/_layout.tsx:76-95`
**Severity:** HIGH
**Sources:** A10-H16
**Est Fix:** 1 hour

`AuthContext.hasRole()` uses numeric level. `isAdminRole()` uses `includes()` string match. Same user has different permissions depending on which function called.

**Fix:** Consolidate to one implementation. Import from one place.

---

### S-17: roleHierarchy Not Synced with VALID_ADMIN_ROLES

**Files:** `rez-app-admin/contexts/AuthContext.tsx:433-443`
**Severity:** HIGH
**Sources:** A10-H17
**Est Fix:** 30 minutes

`roleHierarchy` has `support: 60, operator: 70, admin: 80, super_admin: 100` — NOT synced with `constants/roles.ts`. No `viewer` in hierarchy but `admin-settings.tsx` exposes it as creatable role.

**Fix:** Import `VALID_ADMIN_ROLES` from `constants/roles.ts` as source of truth.

---

### S-18: Uncapped deductCoins in Monolith

**Files:** `rezbackend/.../src/services/walletService.ts`
**Severity:** HIGH
**Sources:** FE-PAY-005
**Est Fix:** 30 minutes

`deductCoins` has no upper bound check. `Math.abs()` on negative input means any amount can be deducted.

**Fix:** `if (amount > wallet.balance) throw new Error('Insufficient balance')`

---

### S-19: BNPL Non-Atomic Settlement

**Files:** `rez-payment-service/src/services/paymentService.ts`
**Severity:** HIGH
**Sources:** FE-PAY-006
**Est Fix:** 1 hour

BNPL settlement: credit merchant + debit user + record transaction — not wrapped in atomic transaction. Partial failure leaves system inconsistent.

**Fix:** Wrap in MongoDB transaction or use two-phase commit pattern.

---

### S-20: Admin Cron Uses Consumer JWT Auth

**Files:** `rezbackend/.../src/routes/admin.ts`
**Severity:** HIGH
**Sources:** F001-C6
**Est Fix:** 1 hour

Admin cron endpoints use consumer JWT auth instead of service-to-service auth. Could allow consumer to trigger admin operations.

**Fix:** Use HMAC service-to-service auth for all cron endpoints.

---

### S-21: Firebase JSON on Disk

**Files:** `rezbackend/.../`
**Severity:** HIGH
**Sources:** F001-C12
**Est Fix:** 1 hour

Firebase credentials stored on disk as JSON file. In source code = credentials in git. If committed = credentials exposed.

**Fix:** Use Firebase Admin SDK with env vars or metadata service. Add `firebase-credentials.json` to `.gitignore`.

---

### S-22: Static Files Served Without Auth

**Files:** `media-events/http.ts`
**Severity:** HIGH
**Sources:** F001-C14
**Est Fix:** 30 minutes

Static file serving has no auth check. Private files publicly accessible.

**Fix:** Add auth check before serving. Ensure only authenticated users access their own files.

---

### S-23: Search Service Paths Not Routed Through Gateway

**Files:** `rez-api-gateway/nginx.conf`
**Severity:** HIGH
**Sources:** HIGH-014
**Est Fix:** 1 hour

`/search/stores`, `/home/feed`, `/recommend/*`, `/search/history` not routed through NGINX. Clients need direct search service URL — infrastructure leak.

**Fix:** Add all search routes to nginx.conf with proper proxy_pass.

---

### S-24: Idempotency Keys Missing

**Files:** `rez-app-admin/services/api/userWallets.ts` (all mutations); `rez-now/lib/api/payment.ts:28-40`
**Severity:** HIGH
**Sources:** A10-H12, AB-C4, NW-HIGH-014
**Est Fix:** 30 minutes

Wallet mutations (adjustBalance, reverseCashback, freezeWallet, unfreezeWallet) and payment verification lack idempotency keys. Network retries can cause duplicate operations.

**Fix:** `makeIdempotencyKey('wallet-adjust', userId + action + Date.now())`

---

### S-25: Idempotency Key Missing in AdBazaar Booking

**Files:** `adBazaar/src/app/api/bookings/[id]/verify-payment/route.ts`
**Severity:** HIGH
**Sources:** AB-C4
**Est Fix:** 1 hour

Booking payment verification lacks idempotency key. Retry on network timeout could double-process payment.

**Fix:** Add `Idempotency-Key` header with `bookingId + timestamp`.

---

### S-26: isNaN Fails on Infinity in Payment Validation

**Files:** `rezmerchant/utils/paymentValidation.ts:96`; `rezmerchant/app/(dashboard)/wallet.tsx:501-518`
**Severity:** HIGH
**Sources:** G-MA-H09, A10-H13
**Est Fix:** 10 minutes

`isNaN(Infinity) === false` — Infinity passes all amount validation. Submitting `1e1000` as amount bypasses all guards.

**Fix:** `Number.isFinite(amount)` replaces `!isNaN(amount)`.

---

### S-27: Missing Rate Limiting in AdBazaar

**Files:** `adBazaar/src/app/api/...`
**Severity:** HIGH
**Sources:** AB-C2
**Est Fix:** 30 minutes

AdBazaar API endpoints lack rate limiting. Brute-force enumeration of campaigns, QR codes, booking slots possible.

**Fix:** Add `express-rate-limit` middleware. 100 req/min per IP for general routes, 10 req/min for auth routes.

---

### S-28: Refresh Permissions Dedup Flag Never Resets on Logout

**Files:** `rezmerchant/contexts/AuthContext.tsx:177-201`
**Severity:** HIGH
**Sources:** G-MA-H18
**Est Fix:** 10 minutes

`isRefreshingPermissionsRef` set to `true` during refresh. If `logout()` called mid-refresh, `finally` never runs. After re-login, `refreshPermissions` returns immediately — permissions never refreshed.

**Fix:** Reset in logout handler: `isRefreshingPermissionsRef.current = false`

---

### S-29: Dashboard Join Silently Swallows Errors

**Files:** `rezmerchant/services/api/socket.ts:134`
**Severity:** HIGH
**Sources:** G-MA-H19
**Est Fix:** 10 minutes

`this.joinMerchantDashboard().catch(() => {})` silently ignores errors. Merchant silently fails to rejoin on every reconnect.

**Fix:** Log and emit: `.catch((err) => { console.error('[Socket] Dashboard join failed:', err); emit('connection-error') })`

---

### S-30: Auth Refresh Queue Silently Swallows Failures

**Files:** `rez-now/lib/api/client.ts:150-160`
**Severity:** HIGH
**Sources:** NW-HIGH-004
**Est Fix:** 15 minutes

When token refresh fails, every queued request silently rejected. User sees no indication of why all API calls fail.

**Fix:** Reject each queued promise with `refreshQueue.forEach((cb) => cb(data.accessToken ?? ''))`

---

---

## Category 3: Architecture & Code Quality

### A-01: Missing utils/apiUtils.ts — 6+ Services Crash

**Files:** `rez-app-consumer/services/authApi.ts:6`; `services/cartApi.ts`; `services/offersApi.ts`; etc.
**Severity:** HIGH
**Sources:** NA-HIGH-10
**Est Fix:** 1 hour

All these files import `withRetry`, `createErrorResponse`, `logApiRequest`, `logApiResponse` from `@/utils/apiUtils` — **file does not exist**.

**Fix:** Create `utils/apiUtils.ts` exporting these utilities, or wire into existing `logger.ts`.

---

### A-02: Duplicate Service Pairs — Migration Never Completed

**Files:** `rez-app-consumer/services/orderApi.ts` + `services/ordersApi.ts`; `services/productApi.ts` + `services/productsApi.ts`; `services/reviewApi.ts` + `services/reviewsApi.ts`
**Severity:** HIGH
**Sources:** NA-HIGH-11
**Est Fix:** 2 hours

Three pairs of overlapping services. Deprecation only in comments — nothing prevents importing wrong one.

**Fix:** Delete deprecated files. Add build-time check that errors on deprecated imports.

---

### A-03: Wallet Store + WalletContext Conflicting Data Sources

**Files:** `rez-app-consumer/stores/walletStore.ts` + `contexts/WalletContext.tsx`
**Severity:** HIGH
**Sources:** NA-HIGH-12
**Est Fix:** 4 hours

Store has `refreshWallet` as noop `async () => {}` — real implementation in Context. But `_setFromProvider` overwrites everything on every render. Two-layer architecture with undefined priority.

**Fix:** Consolidate to ONE source: Zustand with real API calls, OR Context with Zustand selectors. Remove dual-pattern.

---

### A-04: Duplicate Coin Calculation Logic in 4+ Locations

**Files:** `rez-app-consumer/services/earningsCalculationService.ts`; `hooks/usePaymentFlow.ts`; `hooks/useCheckoutUI.ts`; `services/paymentService.ts`
**Severity:** HIGH
**Sources:** NA-HIGH-13
**Est Fix:** 3 hours

Coin/cashback calculations scattered. Different parts of app show different "coins earned" values. NA-HIGH-02 has explicit TODO to replace with server-side call.

**Fix:** Single `coinCalculationService` in `rez-shared`. All consumers import from one place.

---

### A-05: 56 any Type Occurrences Across 17 Store Files

**Files:** Every store file in `rez-app-consumer/stores/`
**Severity:** HIGH
**Sources:** NA-HIGH-14
**Est Fix:** 8+ hours

`any` bypasses TypeScript entirely. Backend change adding wrong-type field silently corrupts in-memory state.

**Fix:** Strict interfaces for all API responses. Zod for runtime validation. Replace `any` with discriminated unions.

---

### A-06: hotelOtaApi.ts Bypasses All API Infrastructure

**Files:** `rez-app-consumer/services/hotelOtaApi.ts:156-168`
**Severity:** HIGH
**Sources:** NA-HIGH-15
**Est Fix:** 30 minutes

`otaFetch()` uses raw `fetch()` — no timeout, no retry, no auth injection, no Sentry, no circuit breaker. Hotel OTA slowness hangs app indefinitely.

**Fix:** `AbortController.timeout(15000)`, retry on 5xx, wrap errors with Sentry reporting.

---

### A-07: Silent Error Swallowing Across ALL Service Files

**Files:** `rez-app-consumer/services/cacheService.ts`; `imageCacheManager.ts`; `imageCacheService.ts`; `productCacheService.ts`; etc.
**Severity:** HIGH
**Sources:** NA-HIGH-16
**Est Fix:** 4-6 hours

Every async operation has `catch (_error) { /* silently handle */ }`. Cache misses, API failures, storage errors completely invisible to users and developers.

**Fix:** Replace silent catches with centralized error reporting, surface user-friendly messages, add error boundaries.

---

### A-08: Circular Store Imports in selectors.ts

**Files:** `rez-app-consumer/stores/selectors.ts:1-219`
**Severity:** HIGH
**Sources:** NA-HIGH-24
**Est Fix:** 2 hours

Highest-concentration import point — imports from 8 stores. Any circular import in one store crashes entire selector module, breaking all components.

**Fix:** Split into per-store selector files (`auth.selectors.ts`, `wallet.selectors.ts`, etc.).

---

### A-09: 82 Service Files — Identical 5-Line CRUD Pattern

**Files:** All `rez-app-admin/services/api/*.ts`
**Severity:** HIGH
**Sources:** A10-H14
**Est Fix:** 4 hours

677 total API calls, zero shared extraction. Every service file is identical 5-line CRUD template. If `apiClient.get()` signature changes, 82 files need updating.

**Fix:** Generic repository base class or ORM-style wrapper.

---

### A-10: Inconsistent Stale Times Across Domains

**Files:** `rez-app-admin/config/reactQuery.ts:21-45`
**Severity:** HIGH
**Sources:** A10-H15
**Est Fix:** 1 hour

Merchants 5 min stale, Campaigns 5 min stale, Feature Flags 10 min, Fraud 2 min. Some domains show stale data for 5+ minutes.

**Fix:** 1 minute for real-time (orders, dashboard), 5 minutes for configuration.

---

### A-11: No Mutation-Side Cache Invalidation

**Files:** All `rez-app-admin/hooks/queries/*.ts`
**Severity:** HIGH
**Sources:** A10-H1, A10-C1
**Est Fix:** 2 hours

All React Query hooks define query configs but NONE define `onSuccess` handlers to invalidate related queries. After approving order, admin sees old state for up to 5 minutes.

**Fix:** Add `onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })` to all mutations.

---

### A-12: Ping Interval Accumulates on Every Reconnect

**Files:** `rezmerchant/services/api/socket.ts:597,121-124`
**Severity:** HIGH
**Sources:** G-MA-H12
**Est Fix:** 10 minutes

`startPingInterval()` called on every `connect`. `stopPingInterval()` only on `disconnect`. On reconnect: new interval without stopping old. Up to 6 concurrent intervals.

**Fix:** `this.stopPingInterval()` before `this.startPingInterval()`

---

### A-13: Socket Subscriptions Not Restored After Reconnect

**Files:** `rezmerchant/services/api/socket.ts:153`
**Severity:** HIGH
**Sources:** G-MA-H14
**Est Fix:** 30 minutes

On reconnect: only `joinMerchantDashboard()` called. `subscribeToMetrics`, `subscribeToOrders`, `subscribeToCashback`, `subscribeToProducts` NOT re-established.

**Fix:** `this.resubscribeAll()` on reconnect.

---

### A-14: Socket Gives Up After 5 Reconnects Silently

**Files:** `rezmerchant/services/api/socket.ts:66`
**Severity:** HIGH
**Sources:** G-MA-H15
**Est Fix:** 15 minutes

`reconnectionAttempts: 5` stops trying silently. No distinction between "never connected" and "permanently failed". UI shows only `isConnected: false`.

**Fix:** Emit `'connection-failed'` event. Show explicit "Connection Failed" with retry button.

---

### A-15: Dead Letter Queue Unbounded

**Files:** `rezmerchant/services/offline.ts:42,185-190`
**Severity:** HIGH
**Sources:** G-MA-H17
**Est Fix:** 10 minutes

`MAX_DEAD_LETTER_LENGTH = 1000` stores full request payloads (potentially several KB each). 7-day TTL but only keeps most recent 1000 — unbounded growth.

**Fix:** `if (deadLetter.length >= 1000) deadLetter.shift()` for oldest-first eviction.

---

### A-16: Buffering Flag Not Cleared on Subsequent Reconnects

**Files:** `rezmerchant/services/api/orderQueue.ts:35`
**Severity:** HIGH
**Sources:** G-MA-H20
**Est Fix:** 10 minutes

`clear()` called only on first connect (hasConnectedBefore guard). Subsequent reconnects skip `clear()` — `isBuffering` stays `true` until next NetInfo poll.

**Fix:** `isBuffering = false` in reconnect handler.

---

### A-17: Sync Triggered Without Internet Reachability Check

**Files:** `rezmerchant/hooks/useNetworkStatus.ts:139`
**Severity:** HIGH
**Sources:** G-MA-H21
**Est Fix:** 15 minutes

`triggerSync()` checks `isConnected` but not `isInternetReachable`. Wi-Fi with captive portal: `isConnected=true, isInternetReachable=false` — sync guaranteed to fail.

**Fix:** `if (isConnected && isInternetReachable) triggerSync()`

---

### A-18: Offline Sync Timeout Silently Ignored

**Files:** `rezmerchant/services/offline.ts:255`
**Severity:** HIGH
**Sources:** G-MA-H11
**Est Fix:** 15 minutes

`config.timeout: 10000` passed directly to `apiClient.post()`. Axios doesn't accept raw timeout in that position — ignored. Requests hang indefinitely.

**Fix:** Configure timeout via axios defaults or `AbortSignal.timeout(10000)`.

---

### A-19: ServicesCatalog and AppointmentsCatalog Placeholder No-ops

**Files:** `rez-now/components/catalog/ServicesCatalog.tsx`; `components/catalog/AppointmentsCatalog.tsx`
**Severity:** HIGH
**Sources:** NW-HIGH-001
**Est Fix:** 8 hours

Both return hardcoded "coming soon". StoreInfo can be `'services'` or `'appointments'` — real users see no-op. Booking flow doesn't exist.

**Fix:** Implement fully or gate behind feature flag. Remove nav option until implemented.

---

### A-20: HandleApplyFromModal Calls Undefined Function

**Files:** `rez-now/components/cart/CouponInput.tsx:56-65`
**Severity:** HIGH
**Sources:** NW-HIGH-002
**Est Fix:** 10 minutes

`handleApplyFromModal` calls `applyCode(selectedCode)` — function not in scope. Runtime crash: `applyCode is not defined`.

**Fix:** Rename inner `applyCode` to `applyCodeInternal`, call from both `handleApply` and `handleApplyFromModal`.

---

### A-21: ReservationSuggestion POSTs to Non-Existent Endpoint

**Files:** `rez-now/components/chat/ReservationSuggestion.tsx:60-91`
**Severity:** HIGH
**Sources:** NW-HIGH-003
**Est Fix:** 15 minutes

POSTs directly to `/api/reservations` using raw `fetch`, bypassing typed `createReservation` function. Endpoint likely doesn't exist.

**Fix:** Replace `fetch` with `createReservation(storeSlug, params)` from `lib/api/reservations.ts`.

---

### A-22: WaiterCallStatus Extracts Wrong Nested Field

**Files:** `rez-now/lib/api/waiter.ts:35-40`
**Severity:** HIGH
**Sources:** NW-HIGH-010
**Est Fix:** 15 minutes

`getWaiterCallStatus` returns `{ status: data.status ?? data.data?.status ?? 'pending' }`. Axios response status code (200) used before nested status — always returns 200, falls to `'pending'`.

**Fix:** Extract from correct path: `data.data?.status ?? 'pending'`

---

### A-23: Pay-Display Socket Dedup Uses Stale Closure

**Files:** `rez-now/app/[storeSlug]/merchant/pay-display/PayDisplayClient.tsx:125-131`
**Severity:** HIGH
**Sources:** NW-HIGH-011
**Est Fix:** 15 minutes

Socket handler references `payments` from closure at mount time. 5 payments arrive before `fetchRecentPayments` resolves — dedup uses empty array → duplicates shown.

**Fix:** Use ref for dedup: `seenRef.current.has(payment.id)` with ref updates on each payment.

---

### A-24: CancelOrder Endpoint Path Inconsistent

**Files:** `rez-now/lib/api/cancellation.ts:7-9` vs `lib/api/orders.ts:11`
**Severity:** HIGH
**Sources:** NW-HIGH-013
**Est Fix:** 15 minutes

`POST /api/web-ordering/orders/.../cancel` (plural) vs `POST /api/web-ordering/order/.../cancel` (singular). Two different endpoints, potentially different handlers.

**Fix:** Consolidate to one. Deprecate the duplicate.

---

### A-25: Frontend Counts checkinCount >= 2, Backend Counts rewardStatus === 'TRIGGERED'

**Files:** `rendez-admin/src/app/meetups/page.tsx:60`
**Severity:** HIGH
**Sources:** RZ-A-H1
**Est Fix:** 15 minutes

Admin filter: `checkinCount >= 2`. Backend eligibility: `rewardStatus === 'TRIGGERED'`. Return different results. Admins and backend disagree on reward qualification.

**Fix:** Align frontend filter to `rewardStatus === 'TRIGGERED'`.

---

### A-26: 40+ Models Use Schema.Types.Mixed — No Validation

**Files:** Throughout `rezbackend/.../`
**Severity:** HIGH
**Sources:** HIGH-015
**Est Fix:** 8+ hours

`metadata: { type: Schema.Types.Mixed }` disables Mongoose validation. Invalid data can be written. No migration path for Mixed fields. TypeScript can't enforce structure.

**Fix:** Audit all Mixed fields with `grep -rn "Schema.Types.Mixed"`. Replace with typed subdocuments where possible.

---

---

## Category 4: Data Sync & Real-Time

### D-01: Socket 'reconnecting' State Never Shown in UI

**Files:** `rezmerchant/services/api/socket.ts:162`
**Severity:** HIGH
**Sources:** G-MA-H13
**Est Fix:** 15 minutes

`reconnect_attempt` handler sets `connectionState = 'reconnecting'` but emits on `'reconnecting'` event, not `'connection-status'`. SocketContext listens only on `'connection-status'`. UI never shows "Reconnecting...".

**Fix:** `this.emitToListeners('connection-status', 'reconnecting')`

---

### D-02: No Duplicate Detection in Offline Queue

**Files:** `rezmerchant/services/offline.ts:124-157`; `app/pos/offline.tsx:176`
**Severity:** HIGH
**Sources:** G-MA-H16
**Est Fix:** 30 minutes

Queue generates idempotency key from timestamp+sequence. No check for existing identical action. Double-tap "Approve Cashback" → two identical actions queued.

**Fix:** Before enqueueing: `const existing = queue.find(a => a.endpoint === endpoint && JSON.stringify(a.data) === JSON.stringify(data))`

---

### D-03: Every Fetch Has No response.ok Check

**Files:** All pages in `rendez-admin/src/app/`
**Severity:** HIGH
**Sources:** RZ-A-H3
**Est Fix:** 4 hours

Every fetch ignores errors: `const res = await fetch(url); const data = await res.json()` throws on non-ok without try/catch. API failures completely invisible.

**Fix:** Add `if (!res.ok) { setError(...); return }` to every fetch.

---

### D-04: Real-Time Updates Not Connected to UI

**Files:** `rendez-admin/src/lib/socket.ts`
**Severity:** HIGH
**Sources:** RZ-A-H6
**Est Fix:** 1 hour

WebSocket connected but `socket.on('order_update', (data) => { console.log(...) })` — MISSING: `setOrders(prev => ...)`. UI never updates.

**Fix:** Connect socket events to React state: `socket.on('order_update', (data) => setOrders(prev => prev.map(...)))`

---

### D-05: No Pagination — 100 User Cap

**Files:** `rendez-admin/src/app/users/page.tsx`
**Severity:** HIGH
**Sources:** RZ-A-H2
**Est Fix:** 2 hours

`supabase.from('users').select('*')` returns max 100 rows. No way to see more. Admins can't manage growing user base.

**Fix:** Cursor-based pagination: `.range(page * pageSize, (page + 1) * pageSize - 1)` with pagination controls.

---

### D-06: Experience Credit Invalidation Incorrect

**Files:** `rendez-app/src/app/CreatePlanScreen.tsx:128-151`
**Severity:** HIGH
**Sources:** RZ-M-A2
**Est Fix:** 15 minutes

Plan creation may consume credit server-side but mobile invalidates `experience-credits` by query key name. If API returns consumed credit's updated status, local cache still shows as AVAILABLE.

**Fix:** Invalidate by exact key: `queryClient.invalidateQueries({ queryKey: ['experience-credits', consumedCreditId] })`

---

---

## Category 5: API Contracts & Type Enums

### E-01: Three Competing normalizeOrderStatus Implementations

**Files:** `rez-app-admin/constants/orderStatuses.ts`; `types/index.ts`; `types/rez-shared-types.ts`
**Severity:** HIGH
**Sources:** A10-H6, CS-E19
**Est Fix:** 1 hour

Each has `LEGACY_STATUS_MAP` with same approach but different code. `orders.tsx` imports from `constants/orderStatuses.ts`, not canonical `@rez/shared`. If they diverge, data normalizes inconsistently.

**Fix:** Single canonical in `@rez/shared`. All imports from one place.

---

### E-02: OrderStatus Duplicated Across 4+ Files with Different Values

**Files:** `rezmerchant/types/api.ts`; `app/orders/live.tsx`; `app/(dashboard)/aggregator-orders.tsx`; `app/kds/index.tsx`
**Severity:** HIGH
**Sources:** G-MA-H28, CS-E19, F001-C13
**Est Fix:** 2 hours

`types/api.ts` canonical: `placed, confirmed, preparing...` — `app/orders/live.tsx` MISSING `placed` — `aggregator-orders.tsx` has entirely different set.

**Fix:** `shared/constants/orderStatus.ts` with canonical values. All files import from here.

---

### E-03: Payment Status Colors Missing 7 of 11 Canonical States

**Files:** `rez-app-admin/app/(dashboard)/orders.tsx:252`
**Severity:** HIGH
**Sources:** A10-H5
**Est Fix:** 1 hour

`getPaymentStatusColor` handles only `'paid'`, `'pending'`, `'failed'`, `'refunded'`. Missing: `'awaiting_payment'`, `'processing'`, `'authorized'`, `'partially_refunded'`, `'expired'`, `'cancelled'`, `'unknown'`. All gray.

**Fix:** Add all canonical statuses to color map.

---

### E-04: Live Monitor Missing 'cancelling' and 'out_for_delivery'

**Files:** `rez-app-admin/app/(dashboard)/live-monitor.tsx:137,152`
**Severity:** HIGH
**Sources:** A10-H8
**Est Fix:** 15 minutes

Both `orderStatusColor` and `orderStatusLabel` missing these canonical statuses. Fall through to default (gray, raw string "out_for_delivery").

**Fix:** Add `'cancelling'` and `'out_for_delivery'` to both maps.

---

### E-05: StatusFilter Type Missing 'pending'

**Files:** `rez-app-admin/app/(dashboard)/orders.tsx:24`
**Severity:** HIGH
**Sources:** A10-H4
**Est Fix:** 5 minutes

`StatusFilter` type has 13 values but `'pending'` is absent. `OrderStats.byStatus` returns `pending` counts from backend. Admins can't filter to see pending orders.

**Fix:** Add `'pending'` to `StatusFilter` type.

---

### E-06: PaymentStatus Wrong Whitelist in Validator

**Files:** `rezmerchant/utils/paymentValidation.ts:33`
**Severity:** HIGH
**Sources:** G-MA-H29
**Est Fix:** 30 minutes

Validator defines `'pending' | 'completed' | 'failed' | 'cancelled'` — but canonical is `'pending' | 'awaiting_payment' | 'processing' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'`. `'completed'` should be `'paid'`. Missing 7 states.

**Fix:** Update whitelist to match canonical enum.

---

### E-07: CashbackStatus Filter Missing 'approved' and 'expired'

**Files:** `rezmerchant/hooks/queries/useCashback.ts:23`
**Severity:** HIGH
**Sources:** G-MA-H30
**Est Fix:** 15 minutes

Filter: `'pending' | 'paid' | 'rejected'`. Canonical: `'pending' | 'approved' | 'rejected' | 'paid' | 'expired'`. Missing `'approved'`, `'expired'`.

**Fix:** Add missing values to filter type and UI.

---

### E-08: OrderStatus FSM Allows Invalid `dispatched→delivered`

**Files:** `rez-app-admin/app/(dashboard)/orders.tsx:61`
**Severity:** HIGH
**Sources:** A10-H7
**Est Fix:** 10 minutes

`dispatched: ['out_for_delivery', 'delivered', 'cancelled']` allows direct `dispatched → delivered` skip. Correct: `['out_for_delivery', 'cancelled']`.

**Fix:** Remove `'delivered'` from `dispatched` transitions.

---

### E-09: Client-Side Order FSM Not Synced with Backend

**Files:** `rezmerchant/services/api/orders.ts:44-72`
**Severity:** HIGH
**Sources:** G-MA-H31
**Est Fix:** 1 hour

FSM manually maintained, not auto-synced. Client and backend FSM can drift. Client may allow transitions backend rejects, or block transitions backend allows.

**Fix:** Fetch FSM from backend on app load, or CI check comparing against `rezbackend/src/config/orderStateMachine.ts`.

---

### E-10: OrderFilters Defined 3x with Different Fields

**Files:** `rezmerchant/types/api.ts:485`; `types/orders.ts:6`; `services/api/orders.ts:4`
**Severity:** HIGH
**Sources:** G-MA-H32
**Est Fix:** 1 hour

Different consumers import different `OrderFilters` definitions. `types/api.ts` adds `paymentStatus`, `orderNumber` — `types/orders.ts` does NOT. Different components see different fields.

**Fix:** Unify in `types/api.ts`. Remove from `types/orders.ts`.

---

### E-11: 'viewer' Role in Zod Schema But Not in MerchantRole Type

**Files:** `rezmerchant/utils/validation/schemas.ts:269`
**Severity:** HIGH
**Sources:** G-MA-H33
**Est Fix:** 10 minutes

Zod: `z.enum(['admin', 'manager', 'staff', 'viewer'])` — MerchantRole: `'owner' | 'admin' | 'manager' | 'staff' | 'cashier'`. `'viewer'` not valid but Zod accepts it.

**Fix:** Change to `'cashier'` or add `'viewer'` to `MerchantRole` if backend supports.

---

### E-12: Analytics Fallback Uses Wrong Status Keys

**Files:** `rezmerchant/services/api/orders.ts:306-315`
**Severity:** HIGH
**Sources:** G-MA-H34
**Est Fix:** 15 minutes

`pending: metricsData.orders?.pending || 0` — `'pending'` not in `OrderStatus`. `completed: metricsData.orders?.completed || 0` — `'completed'` not in `OrderStatus`. Analytics always 0.

**Fix:** Use `placed` instead of `pending`, `paid` instead of `completed`.

---

### E-13: CashbackRequest Defined 3 Times with Different Shapes

**Files:** `rezmerchant/shared/types/cashback.ts`; `types/cashback.ts`; `types/api.ts:331-374`
**Severity:** HIGH
**Sources:** G-MA-H36
**Est Fix:** 1 hour

Three definitions with different fields. Components using different definitions get incompatible data shapes at runtime.

**Fix:** Keep canonical in `shared/types/cashback.ts`. Remove others.

---

### E-14: Product Type Defined 3 Times with Different Fields

**Files:** `rezmerchant/shared/types/products.ts`; `types/products.ts`; `types/api.ts`
**Severity:** HIGH
**Sources:** G-MA-H37
**Est Fix:** 1 hour

`types/api.ts` Product has `is86d?: boolean`, `restores86At?: string` — NOT in `shared/types/products.ts`. Components using shared type miss 86'd tracking fields.

**Fix:** Unify in `shared/types/products.ts`. Add missing fields. Remove duplicates.

---

### E-15: PaymentStatus Has 3 Separate Definitions

**Files:** `rezmerchant/types/api.ts`; `services/api/payments.ts` (raw string); `utils/paymentValidation.ts` (wrong)
**Severity:** HIGH
**Sources:** G-MA-H38
**Est Fix:** 1 hour

Three definitions with different values. `utils/paymentValidation.ts` has `'completed'` which is not in canonical enum.

**Fix:** Keep canonical in `types/api.ts`. Fix wrong values in `paymentValidation.ts`. Replace raw `status: string` in `payments.ts`.

---

### E-16: OrderHistoryItem Defined Twice with Incompatible Shapes

**Files:** `rez-now/lib/types/index.ts:164-172`; `lib/api/orderHistory.ts:3-13`
**Severity:** HIGH
**Sources:** NW-HIGH-012
**Est Fix:** 30 minutes

Type definition has `status: WebOrderStatus` (typed). API layer has `status: string` (untyped). API layer adds `paymentStatus`, `storeLogo`, `scheduledFor` not in type.

**Fix:** Delete duplicate in `lib/api/orderHistory.ts`. Extend canonical type with missing fields.

---

### E-17: BillStatus Type Uses Lowercase; Code Uses Uppercase

**Files:** `rez-now/lib/types/index.ts:264`; `components/merchant/reconcile/TransactionList.tsx:39`
**Severity:** HIGH
**Sources:** NW-HIGH-005
**Est Fix:** 30 minutes

`BillStatus` = `'pending' | 'paid' | 'cancelled' | 'expired'` (lowercase). PayDisplayClient defines `PendingPayment` with `'confirmed'`, `'rejected'` — NOT in BillStatus. TypeScript narrowing on `'confirmed'` always false.

**Fix:** Canonical `PaymentStatus`: `'pending' | 'confirmed' | 'rejected' | 'cancelled'` everywhere.

---

### E-18: pending_payment Status Absent from STATUS_STEPS

**Files:** `rez-now/app/[storeSlug]/order/[orderNumber]/page.tsx:27`
**Severity:** HIGH
**Sources:** NW-HIGH-015
**Est Fix:** 15 minutes

`STATUS_STEPS = ['confirmed', 'preparing', 'ready', 'completed']`. `pending_payment` (set when Razorpay order created but payment not confirmed) excluded. Progress bar silent. User has no clear action path.

**Fix:** Add `pending_payment` as first step or handle with dedicated UI + "Retry payment" button.

---

### E-19: Profile Name Mapping Stored as undefined

**Files:** `rezmerchant/services/api/auth.ts:183-185`
**Severity:** HIGH
**Sources:** G-MA-H23
**Est Fix:** 15 minutes

`const { name, ...rest } = updates; payload = { ...rest, ownerName: name }`. Sends `ownerName` to backend. Response User uses `name` but never populated. After profile update: `user.name === undefined`.

**Fix:** Merge response: `{ ...user, name: response.data.name || response.data.ownerName }`

---

### E-20: SocialMediaService Accesses response.data.post — Likely Undefined

**Files:** `rezmerchant/services/api/socialMedia.ts:105-117`
**Severity:** HIGH
**Sources:** G-MA-H24
**Est Fix:** 10 minutes

`return response.data.post` — backend likely returns `SocialMediaPost` directly, not `{ post: SocialMediaPost }`. Always returns `undefined`.

**Fix:** `return response.data` (assuming direct return).

---

### E-21: Export/Import Bypass apiClient — No Token Refresh, No CSRF

**Files:** `rezmerchant/services/api/products.ts:375-382,427-434`
**Severity:** HIGH
**Sources:** G-MA-H25
**Est Fix:** 30 minutes

Uses raw `fetch()` with `buildApiUrl()` instead of `apiClient`. Bypasses axios interceptor chain: token refresh, CSRF headers, device fingerprint.

**Fix:** `apiClient.get()` with `responseType: 'blob'` for exports. `FormData` for imports via `apiClient`.

---

### E-22: GetVisitStats Throws Instead of Safe Fallback

**Files:** `rezmerchant/services/api/storeVisits.ts:79-93`
**Severity:** HIGH
**Sources:** G-MA-H26
**Est Fix:** 15 minutes

`throw new Error(...)` on failure. Unlike `coinsService.getStats` which returns fallback on error.

**Fix:** `return { totalVisits: 0, uniqueVisitors: 0, avgSessionDuration: 0, ... }`

---

### E-23: storeId Query Param Defined But Never Sent

**Files:** `rezmerchant/services/api/orders.ts:104-109`
**Severity:** HIGH
**Sources:** G-MA-H27
**Est Fix:** 10 minutes

`OrderSearchParams` defines `storeId?: string` — but `getOrders()` never appends `storeId` to URLSearchParams. Multi-store merchants cannot filter orders by store.

**Fix:** `if (params.storeId) params.append('storeId', params.storeId)`

---

### E-24: updateOrderStatus Type Mismatch — Two Incompatible Order Interfaces

**Files:** `rezmerchant/services/api/orders.ts:240`
**Severity:** HIGH
**Sources:** G-MA-H22
**Est Fix:** 1 hour

`types/api.ts` Order expects `paymentStatus: PaymentStatus` (required, 8 values). `types/orders.ts` Order requires `paymentMethod: PaymentMethod` (required) and `paymentStatus`. Different required/optional fields between interfaces.

**Fix:** Unify `Order` interface in `types/api.ts`. Remove `types/orders.ts` duplicate.

---

### E-25: Booking Status Colors Inconsistent with Backend

**Files:** `rendez-admin/src/app/bookings/page.tsx`
**Severity:** HIGH
**Sources:** RZ-A-H7
**Est Fix:** 15 minutes

Status color mapping: `pending: yellow, confirmed: green, completed: blue, cancelled: gray`. Missing: `'executing': blue`, `'paid': orange`, `'disputed': red`, `'refunded': purple`.

**Fix:** Add all status colors to map.

---

### E-26: deletePhoto API Defined But Never Called

**Files:** `rendez-app/src/api/api.ts:102`
**Severity:** HIGH
**Sources:** RZ-M-X1
**Est Fix:** 30 minutes

API method exists: `deletePhoto: (index: number) => api.delete('/upload/photo/${index}')` — but never called from `ProfileEditScreen.tsx`. Photo deletion from backend is no-op.

**Fix:** Wire `deletePhoto` into `ProfileEditScreen.tsx`.

---

### E-27: ProfileEditScreen Age Field Never Sent in Update

**Files:** `rendez-app/src/screens/ProfileEditScreen.tsx:200-215`
**Severity:** HIGH
**Sources:** RZ-M-B8
**Est Fix:** 10 minutes

Age loaded from profile (line 35), rendered in form (line 95), NOT included in `updateMutation.mutate()` payload. Users cannot update age.

**Fix:** Add `age: parseInt(age)` to mutate payload.

---

### E-28: MeetupScreen Booking Date Format Not Validated

**Files:** `rendez-app/src/screens/MeetupScreen.tsx:95`
**Severity:** HIGH
**Sources:** RZ-M-B5
**Est Fix:** 30 minutes

`bookingDate` stored as free-text string. No validation ensures format backend accepts. Backend may reject with 400 — user confused.

**Fix:** Date picker component with ISO date string output. Validate format before mutation.

---

### E-29: KarmaProfile Diverges from Canonical IKarmaProfile

**Files:** `rez-app-consumer/services/karmaService.ts:13-25` vs `packages/shared-types/src/entities/karma.ts:106-131`
**Severity:** HIGH
**Sources:** G-KU-H1
**Est Fix:** 2 hours

KarmaProfile missing `_id`, `eventsJoined`, `checkIns`, `approvedCheckIns`, `avgEventDifficulty`, `avgConfidenceScore`. Has `conversionRate`, `nextLevelAt`, `decayWarning` (client-only). Date fields use `string` vs `Date`.

**Fix:** Import from `@rez/shared-types` as base, extend with client-only fields.

---

### E-30: CoinType Three-Way Mismatch: branded_coin/branded/all

**Files:** `rez-app-consumer/app/karma/wallet.tsx:33`; `services/karmaService.ts:166`; `packages/shared-types/src/enums/index.ts:71-78`
**Severity:** HIGH
**Sources:** G-KU-H2, CS-E15
**Est Fix:** 30 minutes

Wallet UI: `'karma_points' | 'rez_coins' | 'all'`. karmaService: `'karma_points' | 'rez_coins' | 'branded_coin'` (snake_case). Canonical: `'promo' | 'branded' | 'prive' | 'cashback' | 'referral' | 'rez'` (no `_coin`). Three-way mismatch.

**Fix:** Align all to canonical enum from `@rez/shared-types`.

---

### E-31: EarnRecord Status Unknown Values Fall Back to "Pending"

**Files:** `rez-app-consumer/app/karma/my-karma.tsx:136-142`
**Severity:** HIGH
**Sources:** G-KU-H6
**Est Fix:** 15 minutes

`const status = statusConfig[record.status] ?? statusConfig.APPROVED_PENDING_CONVERSION`. Unknown status (backend adds `'EXPIRED'`) silently falls to yellow "Pending" badge. User sees misleading status.

**Fix:** `const displayStatus = status ?? { label: 'Unknown', color: '#6B7280', bg: '#F3F4F6' }; console.warn('Unknown earn record status')`

---

### E-32: Booking Response Empty Object Causes Malformed State

**Files:** `rez-app-consumer/app/karma/event/[id].tsx:56-61`
**Severity:** HIGH
**Sources:** G-KU-H7
**Est Fix:** 15 minutes

`ApiResponse<Booking | null>` → `res.data` is `Booking | null | undefined`. Backend returns `{}` (empty object) → truthy, `setBooking({})` called. State has no `_id` — all subsequent UI silently fails.

**Fix:** `if (bookingRes.success && bookingRes.data && bookingRes.data._id) setBooking(...) else setBooking(null)`

---

### E-33: Empty Catch Block on History Fetch — Silent Failure

**Files:** `rez-app-consumer/app/karma/my-karma.tsx:196`
**Severity:** HIGH
**Sources:** G-KU-H5
**Est Fix:** 10 minutes

`catch { /* non-fatal ← SILENT */ }`. When `getKarmaHistory` fails, `history` stays previous value. User sees "No karma earned yet" — indistinguishable from real empty vs network failure.

**Fix:** `catch { setHistoryError(true); setTimeout(() => setHistoryError(false), 3000) }`

---

### E-34: Query Key Mismatch for Gift Inbox

**Files:** `rendez-app/src/app/GiftInboxScreen.tsx:35-42`
**Severity:** HIGH
**Sources:** RZ-M-D1
**Est Fix:** 10 minutes

`acceptMutation` and `rejectMutation` invalidate `['gifts']` instead of `['gifts', tab]`. Wrong tab's data refreshed.

**Fix:** Invalidate exact tab key: `queryClient.invalidateQueries({ queryKey: ['gifts', activeTab] })`

---

---

## Category 6: Functional Bugs

### L-01: Store Visit Queue Button Permanently Disabled

**Files:** `rez-app-consumer/app/store-visit.tsx`
**Severity:** HIGH
**Sources:** NA-HIGH-18
**Est Fix:** 1 hour

`(gettingQueue || !!queueNumber) && styles.buttonDisabled` — once `queueNumber` is set, button stays disabled permanently. Payment method preference never sent to any API.

**Fix:** Use `isLoading` for disabled condition. Include `paymentMethod` in API payloads.

---

### L-02: Inconsistent 0-Amount Validation

**Files:** `rez-app-consumer/app/payment.tsx` vs `app/pay-in-store/enter-amount.tsx`
**Severity:** HIGH
**Sources:** NA-HIGH-17
**Est Fix:** 1 hour

Some screens reject 0-amount, others silently pass to backend. Zero-amount transactions could bypass payment processing → free coin credits.

**Fix:** Shared `validateAmount` utility in `rez-shared/utils` enforced at `apiClient` layer for payment endpoints.

---

### L-03: No Rapid-Scan Debounce — Duplicate API Calls

**Files:** `rez-app-consumer/app/karma/scan.tsx:75-108`
**Severity:** HIGH
**Sources:** G-KU-H3
**Est Fix:** 30 minutes

`scanState !== 'idle'` guard prevents concurrent processing, but once first request is in-flight, camera could continue scanning. Backend must be idempotent — client sends no idempotency key.

**Fix:** `if (lastScanRef.current === qrCode) return` to prevent same-code re-scan.

---

### L-04: eventId/mode from useLocalSearchParams Stale on Navigation

**Files:** `rez-app-consumer/app/karma/scan.tsx:38-45,54-72`
**Severity:** HIGH
**Sources:** G-KU-H4
**Est Fix:** 15 minutes

`useState` initial values set once on mount. If user navigates to same scan screen with different params (event A → event B), component uses stale state from first mount.

**Fix:** `useEffect(() => { if (eventId !== activeEventId) setActiveEventId(eventId) }, [eventId])`

---

### L-05: BlockUser Doesn't Clean MessageRequest/MessageState

**Files:** `rendez-backend/src/services/ModerationService.ts:17-29`
**Severity:** HIGH
**Sources:** RZ-B-B1
**Est Fix:** 1 hour

Transaction unmatches users but does NOT clean `MessageRequest` and `MessageState` records. Orphaned data. Double-block also leaves inconsistent state.

**Fix:** Clean up `MessageRequest` and `MessageState` within transaction. Add guard to prevent double-blocking.

---

### L-06: Voucher Codes Shown to Users Not Eligible

**Files:** `rendez-admin/src/app/vouchers/page.tsx`
**Severity:** HIGH
**Sources:** RZ-A-H5
**Est Fix:** 1 hour

`supabase.from('vouchers').select('*')` shows all vouchers regardless of eligibility. Users see codes they can't use.

**Fix:** Filter vouchers by user eligibility: `.eq('user_id', userId).lte('min_order_value', user.totalSpent)`

---

### L-07: Dashboard Uses localStorage Instead of Supabase Auth

**Files:** `rendez-admin/src/app/dashboard/page.tsx`
**Severity:** HIGH
**Sources:** RZ-A-H4
**Est Fix:** 1 hour

Token stored in localStorage. Supabase expects auth in HTTP-only cookies. `getSession()` returns null — auth state empty.

**Fix:** Use Supabase auth for session management: `const { data: { session } } = await supabase.auth.getSession()`

---

---

## Status Summary

| # | ID | Title | Category | Status | Effort |
|---|----|-------|----------|--------|--------|
| 1 | F-01 | Rewards preview 50% inaccurate | Financial | ACTIVE | 3h |
| 2 | F-02 | karma credits 'rez' queries 'karma_points' | Financial | ACTIVE | 30m |
| 3 | F-03 | Visit milestone dedup key 1-sec collision | Financial | ACTIVE | 30m |
| 4 | F-04 | Rewards hook idempotency silent drop | Financial | ACTIVE | 2h |
| 5 | F-05 | Floating-point truncation on redemption | Financial | ACTIVE | 1h |
| 6 | F-06 | Hardcoded day reward values | Financial | ACTIVE | 1h |
| 7 | F-07 | Leaderboard rank off-by-one | Financial | ACTIVE | 1h |
| 8 | F-08 | Dedup key collision (gamification) | Financial | ACTIVE | 10m |
| 9 | F-09 | Finance silent coin failure | Financial | ACTIVE | 2h |
| 10 | F-10 | Finance rewards hook wrong endpoint | Financial | ACTIVE | 2h |
| 11 | F-11 | Welcome coins race condition | Financial | ACTIVE | 1h |
| 12 | F-12 | Coin rate divergence hardcoded 1:1 | Financial | ACTIVE | 1h |
| 13 | F-13 | Loyalty tier typo 'DIMAOND' | Financial | ACTIVE | 15m |
| 14 | F-14 | Coin type normalization lost (nuqta) | Financial | ACTIVE | 2h |
| 15 | F-15 | Adjust balance can go negative | Financial | ACTIVE | 15m |
| 16 | F-16 | No wallet balance check before gift | Financial | ACTIVE | 30m |
| 17 | F-17 | Cashback approval no upper bound | Financial | ACTIVE | 15m |
| 18 | F-18 | Withdrawal unit inconsistency | Financial | ACTIVE | 30m |
| 19 | F-19 | Discount percentage not capped at 100% | Financial | ACTIVE | 15m |
| 20 | F-20 | Payment service hardcoded coin cap | Financial | ACTIVE | 30m |
| 21 | F-21 | Monolith webhook trusts payload | Financial | ACTIVE | 30m |
| 22 | F-22 | Math.random() for payment IDs | Financial | ACTIVE | 30m |
| 23 | F-23 | Reconciliation double-division | Financial | ACTIVE | 15m |
| 24 | F-24 | Redeem stamps no idempotency key | Financial | ACTIVE | 15m |
| 25 | F-25 | Coupon validation client-side only | Financial | ACTIVE | 30m |
| 26 | F-26 | Client-side prices manipulatable | Financial | ACTIVE | 1h |
| 27 | F-27 | Gift send doesn't invalidate wallet | Data Sync | ACTIVE | 5m |
| 28 | F-28 | Confirm modal dismisses before mutation | Functional | ACTIVE | 10m |
| 29 | F-29 | Referral credit no distributed lock | Financial | ACTIVE | 30m |
| 30 | F-30 | Referral applyCode doesn't verify completion | Financial | ACTIVE | 1h |
| 31 | F-31 | Gift expired webhook always returns success | Financial | ACTIVE | 15m |
| 32 | F-32 | REZ API called after DB commit | Financial | ACTIVE | 1h |
| 33 | F-33 | Reward trigger fire-and-forget | Financial | ACTIVE | 1h |
| 34 | F-34 | Redis lock expires during reward process | Financial | ACTIVE | 30m |
| 35 | F-35 | CSR pool non-atomic decrement | Financial | ACTIVE | 20m |
| 36 | F-36 | Kill switch sets wrong status | Financial | ACTIVE | 5m |
| 37 | F-37 | Decay worker runs weekly not daily | Financial | ACTIVE | 5m |
| 38 | F-38 | createEarnRecord bypasses addKarma | Financial | ACTIVE | 1h |
| 39 | F-39 | eventsCompleted double-increment | Financial | ACTIVE | 1h |
| 40 | F-40 | eventsJoined never incremented | Financial | ACTIVE | 30m |
| 41 | F-41 | avgEventDifficulty never updated | Financial | ACTIVE | 30m |
| 42 | F-42 | Pre-computed rezCoinsEarned unvalidated | Financial | ACTIVE | 30m |
| 43 | F-43 | WEEKLY_COIN_CAP hardcoded | Financial | ACTIVE | 5m |
| 44 | F-44 | Auto-checkout no EarnRecord | Financial | ACTIVE | 30m |
| 45 | F-45 | No karma input validation | Financial | ACTIVE | 15m |
| 46 | F-46 | Duplicate const startOfWeek (P0 duplicate) | Financial | ACTIVE | 5m |
| 47 | F-47 | Mixed week boundaries (week vs isoWeek) | Financial | ACTIVE | 30m |
| 48 | F-48 | Payment service non-atomic wallet credit | Financial | ACTIVE | 30m |
| 49 | F-49 | Payment service rejects legacy token | Financial | ACTIVE | 30m |
| 50 | F-50 | Payment service sends secret in body | Security | ACTIVE | 15m |
| 51 | F-51 | Authorized state no inbound path | API | ACTIVE | 15m |
| 52 | F-52 | Coin formula off by factor of 10 | Financial | ACTIVE | 10m |
| 53 | F-53 | SKU validation fail-open | Financial | ACTIVE | 15m |
| 54 | F-54 | Gift voucher authorization bypass | Security | ACTIVE | 30m |
| 55 | S-01 | Token blacklist fails open | Security | ACTIVE | 15m |
| 56 | S-02 | HMAC empty secret allows unsigned | Security | ACTIVE | 10m |
| 57 | S-03 | MD5 for image integrity hash | Security | ACTIVE | 1h |
| 58 | S-04 | IDOR on bill/transaction access | Security | ACTIVE | 2h |
| 59 | S-05 | Auth tokens in localStorage | Security | ACTIVE | 2h |
| 60 | S-06 | Client-side fraud detection fail-open | Security | ACTIVE | 3h |
| 61 | S-07 | Device fingerprint tamperable | Security | ACTIVE | 2h |
| 62 | S-08 | parseInt(age) sends NaN | Security | ACTIVE | 10m |
| 63 | S-09 | Age input non-numeric paste | Security | ACTIVE | 10m |
| 64 | S-10 | 7 plan routes missing ID validation | Security | ACTIVE | 30m |
| 65 | S-11 | Plan select no ownership check | Security | ACTIVE | 15m |
| 66 | S-12 | Unnecessary type cast weakens safety | Security | ACTIVE | 5m |
| 67 | S-13 | Socket read_receipt bypass matchId | Security | ACTIVE | 30m |
| 68 | S-14 | Platform settings no role guard | Security | ACTIVE | 15m |
| 69 | S-15 | WebSocket connects null auth | Security | ACTIVE | 15m |
| 70 | S-16 | Two conflicting hasRole implementations | Security | ACTIVE | 1h |
| 71 | S-17 | roleHierarchy not synced | Security | ACTIVE | 30m |
| 72 | S-18 | Uncapped deductCoins | Security | ACTIVE | 30m |
| 73 | S-19 | BNPL non-atomic settlement | Financial | ACTIVE | 1h |
| 74 | S-20 | Admin cron uses consumer JWT | Security | ACTIVE | 1h |
| 75 | S-21 | Firebase JSON on disk | Security | ACTIVE | 1h |
| 76 | S-22 | Static files no auth | Security | ACTIVE | 30m |
| 77 | S-23 | Search paths not routed gateway | Security | ACTIVE | 1h |
| 78 | S-24 | Idempotency keys missing | Security | ACTIVE | 30m |
| 79 | S-25 | AdBazaar booking no idempotency key | Security | ACTIVE | 1h |
| 80 | S-26 | isNaN fails on Infinity | Security | ACTIVE | 10m |
| 81 | S-27 | AdBazaar missing rate limiting | Security | ACTIVE | 30m |
| 82 | S-28 | Refresh permissions flag not reset | Security | ACTIVE | 10m |
| 83 | S-29 | Dashboard join silently swallows | Security | ACTIVE | 10m |
| 84 | S-30 | Auth refresh queue swallows failures | Security | ACTIVE | 15m |
| 85 | A-01 | Missing utils/apiUtils.ts | Architecture | ACTIVE | 1h |
| 86 | A-02 | Duplicate service pairs | Architecture | ACTIVE | 2h |
| 87 | A-03 | Wallet store + context conflict | Architecture | ACTIVE | 4h |
| 88 | A-04 | Duplicate coin calc 4+ locations | Architecture | ACTIVE | 3h |
| 89 | A-05 | 56 any types in stores | Architecture | ACTIVE | 8h+ |
| 90 | A-06 | hotelOtaApi bypasses infra | Architecture | ACTIVE | 30m |
| 91 | A-07 | Silent error swallowing everywhere | Architecture | ACTIVE | 4-6h |
| 92 | A-08 | Circular store imports | Architecture | ACTIVE | 2h |
| 93 | A-09 | 82 identical CRUD service files | Architecture | ACTIVE | 4h |
| 94 | A-10 | Inconsistent stale times | Data Sync | ACTIVE | 1h |
| 95 | A-11 | No mutation cache invalidation | Data Sync | ACTIVE | 2h |
| 96 | A-12 | Ping interval accumulation | Data Sync | ACTIVE | 10m |
| 97 | A-13 | Socket subscriptions not restored | Data Sync | ACTIVE | 30m |
| 98 | A-14 | Socket gives up silently | Data Sync | ACTIVE | 15m |
| 99 | A-15 | Dead letter queue unbounded | Data Sync | ACTIVE | 10m |
| 100 | A-16 | Buffering flag not cleared | Data Sync | ACTIVE | 10m |
| 101 | A-17 | Sync without internet check | Data Sync | ACTIVE | 15m |
| 102 | A-18 | Offline sync timeout ignored | Data Sync | ACTIVE | 15m |
| 103 | A-19 | ServicesCatalog placeholder no-ops | Architecture | ACTIVE | 8h |
| 104 | A-20 | applyCode undefined function | Architecture | ACTIVE | 10m |
| 105 | A-21 | ReservationSuggestion wrong endpoint | Architecture | ACTIVE | 15m |
| 106 | A-22 | WaiterCallStatus wrong field | Architecture | ACTIVE | 15m |
| 107 | A-23 | Pay-display dedup stale closure | Data Sync | ACTIVE | 15m |
| 108 | A-24 | CancelOrder endpoint inconsistency | API | ACTIVE | 15m |
| 109 | A-25 | Frontend/backend count mismatch | Architecture | ACTIVE | 15m |
| 110 | A-26 | 40+ Schema.Types.Mixed models | Architecture | ACTIVE | 8h+ |
| 111 | D-01 | Socket reconnecting state not shown | Data Sync | ACTIVE | 15m |
| 112 | D-02 | No dedup in offline queue | Data Sync | ACTIVE | 30m |
| 113 | D-03 | Every fetch no response.ok check | Data Sync | ACTIVE | 4h |
| 114 | D-04 | Real-time updates not connected | Data Sync | ACTIVE | 1h |
| 115 | D-05 | No pagination — 100 cap | Data Sync | ACTIVE | 2h |
| 116 | D-06 | Credit invalidation incorrect | Data Sync | ACTIVE | 15m |
| 117 | E-01 | 3 normalizeOrderStatus implementations | API | ACTIVE | 1h |
| 118 | E-02 | OrderStatus 4+ files different values | API | ACTIVE | 2h |
| 119 | E-03 | Payment status colors missing 7 states | API | ACTIVE | 1h |
| 120 | E-04 | Live monitor missing statuses | API | ACTIVE | 15m |
| 121 | E-05 | StatusFilter missing 'pending' | API | ACTIVE | 5m |
| 122 | E-06 | PaymentStatus wrong whitelist | API | ACTIVE | 30m |
| 123 | E-07 | CashbackStatus missing values | API | ACTIVE | 15m |
| 124 | E-08 | Order FSM invalid transition | API | ACTIVE | 10m |
| 125 | E-09 | Client FSM not synced with backend | API | ACTIVE | 1h |
| 126 | E-10 | OrderFilters 3x different fields | API | ACTIVE | 1h |
| 127 | E-11 | 'viewer' role in schema not type | API | ACTIVE | 10m |
| 128 | E-12 | Analytics fallback wrong keys | API | ACTIVE | 15m |
| 129 | E-13 | CashbackRequest 3x definitions | API | ACTIVE | 1h |
| 130 | E-14 | Product type 3x definitions | API | ACTIVE | 1h |
| 131 | E-15 | PaymentStatus 3x definitions | API | ACTIVE | 1h |
| 132 | E-16 | OrderHistoryItem 2x definitions | API | ACTIVE | 30m |
| 133 | E-17 | BillStatus lowercase vs uppercase | API | ACTIVE | 30m |
| 134 | E-18 | pending_payment not in STATUS_STEPS | API | ACTIVE | 15m |
| 135 | E-19 | Profile name mapping undefined | API | ACTIVE | 15m |
| 136 | E-20 | SocialMedia response.data.post undefined | API | ACTIVE | 10m |
| 137 | E-21 | Export/import bypass apiClient | API | ACTIVE | 30m |
| 138 | E-22 | GetVisitStats throws | API | ACTIVE | 15m |
| 139 | E-23 | storeId query param never sent | API | ACTIVE | 10m |
| 140 | E-24 | updateOrderStatus type mismatch | API | ACTIVE | 1h |
| 141 | E-25 | Booking status colors inconsistent | API | ACTIVE | 15m |
| 142 | E-26 | deletePhoto never called | Functional | ACTIVE | 30m |
| 143 | E-27 | ProfileEditScreen age never sent | Functional | ACTIVE | 10m |
| 144 | E-28 | MeetupScreen date not validated | Functional | ACTIVE | 30m |
| 145 | E-29 | KarmaProfile diverges from canonical | API | ACTIVE | 2h |
| 146 | E-30 | CoinType three-way mismatch | API | ACTIVE | 30m |
| 147 | E-31 | EarnRecord unknown status fallback | API | ACTIVE | 15m |
| 148 | E-32 | Booking response empty object | API | ACTIVE | 15m |
| 149 | E-33 | Empty catch block on history | Functional | ACTIVE | 10m |
| 150 | E-34 | Query key mismatch gift inbox | Data Sync | ACTIVE | 10m |
| 151 | L-01 | Queue button permanently disabled | Functional | ACTIVE | 1h |
| 152 | L-02 | Inconsistent 0-amount validation | Functional | ACTIVE | 1h |
| 153 | L-03 | No rapid-scan debounce | Functional | ACTIVE | 30m |
| 154 | L-04 | eventId stale on navigation | Functional | ACTIVE | 15m |
| 155 | L-05 | BlockUser no MessageRequest cleanup | Functional | ACTIVE | 1h |
| 156 | L-06 | Vouchers shown to ineligible users | Functional | ACTIVE | 1h |
| 157 | L-07 | Dashboard uses localStorage auth | Functional | ACTIVE | 1h |

---

## Pattern: HIGH Issues Reduce to ~100 Unique When Deduplicated

The 150+ HIGH appearances across all audits reduce to ~100 unique bugs when deduplicated. Key patterns:

| Pattern | Unique Count | Examples |
|---------|------------|---------|
| Type/enum fragmentation | ~15 | E-01 through E-34 |
| Fire-and-forget financial ops | ~12 | F-04, F-09, F-33, F-34, F-48 |
| Duplicate implementations | ~10 | A-02, A-04, A-09, E-13, E-14, E-15 |
| Cache invalidation missing | ~8 | D-01, D-06, F-27, A-11 |
| Missing input validation | ~8 | F-45, S-26, L-02, F-19 |
| Silent error swallowing | ~6 | A-07, D-03, E-33, S-29 |
| Socket/real-time issues | ~6 | A-12, A-13, A-14, A-23, D-01 |

**Conclusion:** Fixing RC-1 (shared types), RC-3 (BullMQ+idempotency), RC-6 (shared packages), and RC-7 (cache invalidation) will resolve ~40% of HIGH issues.

---

**Last Updated:** 2026-04-16
