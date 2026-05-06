# ReZ Platform — StayOwn Audit Report
**Date:** 2026-04-16
**Scope:** Full codebase audit across 24 services, 3 mobile apps, 1 monolith backend
**Methodology:** 6 parallel specialized agents + independent verification
**Total Bugs Found:** 82+ across 15 categories

---

## Executive Summary

This is your honest truth about the ReZ platform's current state. Your dev is not exaggerating — there are real, serious issues across every layer. But they are **fixable**.

### Damage Assessment

| Layer | Status | Critical Issues |
|-------|--------|----------------|
| **Payments** | PARTIALLY FIXED | 4/5 critical bugs fixed in microservices. Monolith still vulnerable. 2 new CRITICALs found. |
| **Security** | AT RISK | 4 CRITICAL unfixed, 9 HIGH unfixed |
| **API Contracts** | BROKEN | 2 HIGH mismatches silently breaking orders |
| **Architecture** | FRAGILE | BullMQ double-consume still possible |
| **Karma System** | CRASHED | P0: entire karma system dead due to syntax error |
| **Enums** | INCONSISTENT | Different services use different values for same concepts |
| **Real-time** | CRITICAL BROKEN | 3 CRITICAL issues: socket never connects, duplicate detection broken, sync race |
| **Offline Sync** | CRITICAL BROKEN | Check-then-act races, stale refs, mid-upload failures |
| **Finance/BNPL** | AT RISK | Non-atomic settlement, repay capacity OR logic, no idempotency |

---

## CRITICAL — Fix Before Anything Else

### P0: Karma System is Dead 🔴

**Bug ID:** P0-KARMA-001
**Category:** BUSINESS_LOGIC (Runtime Crash)
**File:** `rez-karma-service/src/services/karmaService.ts` lines 128 & 195

```typescript
// Line 128
const startOfWeek = moment().startOf('week').toDate();
let weeklyKarmaEarned = profile.thisWeekKarmaEarned;

// ... 65 lines of code ...

// Line 195 — SYNTAX ERROR
const startOfWeek = moment().startOf('week').toDate();
```

**Impact:** `SyntaxError: Identifier 'startOfWeek' has already been declared` at load time. The entire `addKarma` function is dead. No karma can be added to any user profile. Weekly cap enforcement, level-ups, and karma accumulation are completely broken. This is the most impactful bug in the system.

**Fix:** Remove the duplicate at line 195.

---

### CRITICAL #1: API Contract — Orders Always Fail Vouchers 🔴

**Bug ID:** API-001
**Category:** API_CONTRACT
**Severity:** HIGH (breaks vouchers silently)
**Files:**
- Frontend: `rez-app-consumer/services/ordersApi.ts` lines 170-210
- Backend: `rezbackend/.../orderCreateController.ts` lines 329-334

| | Field |
|---|---|
| Frontend sends | `couponCode`, `redemptionCode` |
| Backend expects | `couponCode`, `redemptionCode`, **`voucherCode`**, **`offerRedemptionCode`** |

**Impact:** `voucherCode` (partner vouchers with RED-xxx format) and `offerRedemptionCode` (flash sale cashback vouchers) are NEVER applied. Users enter valid voucher codes but get zero discount. This silently kills revenue.

**Fix:** Add `voucherCode?: string` and `offerRedemptionCode?: string` to `CreateOrderRequest` in `ordersApi.ts`.

---

### CRITICAL #2: Admin Can't Filter Orders by Merchant 🔴

**Bug ID:** API-002
**Category:** DATA_SYNC
**Severity:** HIGH (breaks admin filtering)
**Files:**
- Frontend: `rez-app-admin/services/api/orders.ts` line 18
- Backend: `rezbackend/.../orderQueryController.ts` lines 331-340

The admin expects `store.merchantId` but the backend never populates it.

**Impact:** Admin "Filter by merchant" shows ALL orders. Multi-merchant dashboard is useless.

**Fix:** Add `merchantId` to the store `$lookup` projection: `.populate('store', '_id name logo merchantId')`.

---

### CRITICAL #3: OTP Bruteforce — Merchant Accounts Hackable 🔴

**Bug ID:** BE-MER-OTP-001
**Category:** SECURITY
**File:** `rez-merchant-service/src/routes/auth.ts` lines 496-517

```typescript
const storedOtp = await redis.get(`merchant_otp:${phone}`);
if (!storedOtp || storedOtp !== String(otp)) {
  res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  return;
}
```

No rate limiting. No lockout. No attempt counter. 6-digit OTP (900,000 combinations) with 5-minute window. An attacker can brute-force any merchant account.

**Attack:** Run a script → 900,000 guesses → full merchant account access → money.

**Fix:** Add Redis-backed rate limiter: increment on failed attempt, lock after 3 failures, 15-min lockout.

---

### CRITICAL #4: SSRF + Auth Bypass in Karma Service 🔴

**Bug ID:** SEC-KARMA-SSRF-001
**Category:** SECURITY
**File:** `rez-karma-service/src/middleware/auth.ts` lines 41-61

```typescript
const response = await axios.post(
  `${authServiceUrl}/api/auth/verify`,
  { token },
  { timeout: 5000 },  // NO TLS VALIDATION
);
req.userId = response.data.userId;
req.userRole = response.data.role;
```

Any service that controls `AUTH_SERVICE_URL` env var can redirect the auth call to an attacker-controlled server that returns `role: admin, permissions: ['*']`. The karma service then treats the attacker as a full admin.

**Fix:** Replace outbound HTTP call with local JWT verification using shared secret. Never trust external HTTP responses for auth.

---

### CRITICAL #5: Bank Details Stored in Plaintext 🔴

**Bug ID:** SEC-MER-SENS-001
**Category:** SECURITY / COMPLIANCE
**Files:**
- `rez-merchant-service/src/routes/onboarding.ts` line 53-54
- `rez-merchant-service/src/routes/walletMerchant.ts` line 155-157

```typescript
const bankDetails: Record<string, string> = { accountNumber, ifscCode, accountHolderName, bankName };
await Merchant.findByIdAndUpdate(req.merchantId, { $set: { bankDetails } }, ...);
```

Bank account numbers, IFSC codes, and names are stored in MongoDB without encryption. `ENCRYPTION_KEY` exists but is **never used**.

**Impact:** GDPR/RBI violation. Any database leak exposes every merchant's bank details.

**Fix:** Implement AES-256-GCM field-level encryption for `bankDetails` using `ENCRYPTION_KEY`.

---

### CRITICAL #6: MongoDB Object Injection — Prototype Pollution 🔴

**Bug ID:** SEC-MER-INJECT-001
**Category:** SECURITY
**File:** `rez-merchant-service/src/routes/customers.ts` lines 93-126

```typescript
const hp: any = {};
if (allergies !== undefined) hp['healthProfile.allergies'] = String(allergies).slice(0, 500);

await CustomerMeta.findOneAndUpdate(
  { merchantId: mid, userId },
  { $set: hp },  // hp constructed from req.body keys
  { upsert: true },
);
```

`hp` is built from computed dot-notation keys derived from `req.body`. Attacker sends `{ "__proto__": { "isAdmin": true } }` → pollutes object prototype → potential application behavior change.

**Fix:** Validate input as scalar strings. Use explicit nested object construction instead of computed dot-notation.

---

## HIGH — Fix Within Days

### BE-PAY-009: Monolith Webhook Trusts Payload Without Verification 🔴

**Bug ID:** FE-PAY-013 (Monolith only)
**Category:** PAYMENT_SECURITY
**File:** `rezbackend/.../src/controllers/webhookController.ts` `handleRazorpayPaymentCaptured`

The **microservice** (`rez-payment-service`) correctly calls `razorpay.getPaymentDetails()` to verify the payment before crediting. But the **backend monolith** does NOT verify — it trusts the webhook payload.

If the monolith is still receiving Razorpay webhooks, fake webhooks can credit wallets without real payments.

**Impact:** Fake payment confirmation → wallet credited → real money lost.

**Note:** `rez-payment-service` IS fixed (line 569: `await razorpay.getPaymentDetails(razorpayPaymentId)`). The question is whether the monolith is still in the webhook routing path.

**Fix:** Add `razorpay.getPaymentDetails()` verification to `handleRazorpayPaymentCaptured` in the monolith.

---

### MATH.RANDOM() Used for Payment IDs 🔴

**Bug IDs:** Multiple
**Category:** SECURITY / ARCHITECTURE
**Files:**
- `rezbackend/.../src/utils/razorpayUtils.ts:412` — `generateReceiptId` uses `Math.random()`
- `rezbackend/.../src/merchantroutes/pos.ts:547` — `PAY-OFFLINE-${Date.now()}-${Math.random()}` for payment ID
- `rezbackend/.../src/services/integrationService.ts:221` — batch ID
- `rezbackend/.../src/utils/correlationContext.ts:42` — correlation ID

**Impact:** `Math.random()` is NOT cryptographically random. Payment ID collisions can cause duplicate payment processing. Receipt ID collisions can break payment lookup.

**Fix:** Replace all with `crypto.randomUUID()` or `crypto.randomBytes()`.

---

### Token Blacklist Fails Open When Redis Down ⚠️

**Bug ID:** SEC-AUTH-REDIS-FAIL-001
**Category:** SECURITY
**File:** `rez-auth-service/src/services/tokenService.ts` lines 74-105

When Redis is unavailable, the token blacklist check falls back to MongoDB. If MongoDB ALSO fails, the code **assumes the token is valid** — granting access to tokens that were just invalidated by logout.

**Fix:** Fail closed when Redis unavailable. Default to DENY, not ALLOW.

---

### Duplicate Const Causes SyntaxError in Karma ⚠️

Already listed as P0-KARMA-001 above.

---

### Wallet Service URL Defaults to Localhost ⚠️

**Bug ID:** FE-PAY-MISC
**Category:** ARCHITECTURE
**File:** `rez-payment-service/src/services/paymentService.ts` line 16

```typescript
const walletUrl = process.env.WALLET_SERVICE_URL;
if (!walletUrl) {
  logger.warn('[WalletCredit] WALLET_SERVICE_URL not set — skipping coin credit');
  return;  // SILENTLY SKIPS — user never gets coins
}
```

If `WALLET_SERVICE_URL` is not set, coin credits are silently skipped. No error. No retry queue. No user notification. The payment succeeds but the user gets zero coins.

**Fix:** Fail loudly (throw error), not silently. Add a circuit breaker with retry.

---

## API Contract Issues (13 Bugs)

| ID | Severity | Issue | Frontend | Backend |
|----|----------|-------|----------|---------|
| **API-001** | HIGH | `voucherCode`, `offerRedemptionCode` missing | ordersApi.ts | orderCreateController.ts |
| **API-002** | HIGH | `store.merchantId` missing | admin orders.ts | orderQueryController.ts |
| **API-003** | MEDIUM | `totals.deliveryFee` vs `totals.delivery` | ordersApi.ts:106 | orderCreateController.ts:1271 |
| **API-004** | MEDIUM | Admin: same `deliveryFee` mismatch | admin orders.ts:36 | orderCreateController.ts:1271 |
| **API-005** | MEDIUM | `Transaction.id` vs `transactionId` | walletApi.ts:335 | walletPaymentController.ts:970 |
| **API-006** | LOW | `cashback` vs `cashbackBalance` | walletApi.ts:244 | walletBalanceController.ts:273 |
| **API-007** | MEDIUM | `IVerifyPaymentResponse` TypeScript blindness | paymentService.ts | paymentController.ts:264 |
| **API-008** | LOW | Analytics error handling hides real errors | merchant orders.ts:286 | N/A |
| **API-009** | MEDIUM | `paymentMethod` ignored in wallet payment | walletApi.ts:668 | walletPaymentController.ts:754 |
| **API-010** | MEDIUM | `storeId` optional, breaks analytics | walletApi.ts:446 | walletPaymentController.ts:756 |
| **API-011** | MEDIUM | `wasilCoins` ignored at checkout | ordersApi.ts:201 | orderCreateController.ts:527 |
| **API-012** | LOW | `paymentId` vs `gatewayPaymentId` | paymentService.ts:57 | paymentController.ts:375 |
| **API-013** | LOW | Nested `order.orderNumber` vs flat | N/A | orderQueryController.ts:595 |

---

## Enum & Status Issues (5 Bugs)

| ID | Severity | Issue |
|----|----------|-------|
| **P1-ENUM-001** | HIGH | `packages/shared-enums` (deprecated) has only 4 loyalty tiers; canonical has 5. `DIAMOND` missing. |
| **P1-ENUM-002** | HIGH | `packages/shared-enums` has `transfer`/`gift` transaction types that the wallet service rejects. |
| **P2-ENUM-003** | MEDIUM | `normalizeLoyaltyTier` maps `DIAMOND → platinum` but `diamond` is a valid tier. Inconsistent. |
| **P2-ENUM-004** | MEDIUM | `OrderPaymentStatus` schema missing `'expired'`, includes wrong FSM values. |
| **P3-ENUM-005** | MEDIUM | Order schema missing `'failed_delivery'`, `'return_requested'`, `'return_rejected'` that FSM references. |

---

## Business Logic Errors (8 Bugs)

| ID | Severity | Issue |
|----|----------|-------|
| **P0-KARMA-001** | P0 | Duplicate `const startOfWeek` — karma system dead. Fix: remove line 195. |
| **P1-LOGIC-001** | HIGH | Gamification tiers (bronze/silver/gold/platinum) mean DIFFERENT things in gamification service vs karma engine. Users see inconsistent tiers. |
| **P1-LOGIC-002** | HIGH | Three systems define different coin rewards for same streak milestones (backend: 30/50/100, gamification: 50/200/500, worker: 50/150). |
| **P2-BUSINESS-001** | MEDIUM | Gamification reads wallet balance two different ways; fragile fallback to `balance.available`. |
| **FE-PAY-001** | HIGH | Webhook returns 200 on internal error — Razorpay doesn't retry, event lost. |
| **FE-PAY-003** | HIGH | `PaymentMachine` created per-request with no persisted state — concurrent webhooks can race. |
| **FE-PAY-004** | HIGH | Float precision in Payment model pre-save hook — `refundedAmount` can become `99.9999999`. |
| **FE-PAY-009** | HIGH | `coinsToRupeesAsync` uses `parseFloat` which can produce precision errors. |

---

## Architecture Issues (5 Bugs)

| ID | Severity | Issue |
|----|----------|-------|
| **P1-ARCH-001** | HIGH | BullMQ double-consume: if `GAMIFICATION_WORKER_EXTERNAL=true` not set, both monolith AND gamification service consume `gamification-events` queue → duplicate streak increments, double coin credits. |
| **P2-ARCH-002** | MEDIUM | No authoritative source of truth for gamification. 3 systems write to `wallets`, `cointransactions`, `userstreaks`. |
| **P2-ARCH-003** | MEDIUM | Two incompatible achievement definition formats (26 achievements in backend, 7 in gamification worker). |
| **CS-C1** | HIGH | BullMQ double-consume across ALL queues — `GAMIFICATION_WORKER_EXTERNAL`, `ORDER_WORKER_EXTERNAL`, `PAYMENT_WORKER_EXTERNAL` etc. must all be set. |
| **ARCH-MULTI** | MEDIUM | `rez-shared` changes affect ALL 11+ microservices — no automated regression testing across fleet. |

---

## Real-Time & Sync Issues (23 Bugs)

The most complex category. Key issues:

| ID | Severity | Issue |
|----|----------|-------|
| **RT-001** | HIGH | `SocketContext` — when app backgrounds, orders remain in subscription map but server room may expire. Stale subscriptions on reconnect. |
| **RT-002** | MEDIUM | SSE endpoint lifetime cap (5 min) sends `max_lifetime` reconnect event but server doesn't auto-reconnect. |
| **RT-003** | MEDIUM | Change streams in order service don't auto-reconnect when connection drops. |
| **SYNC-001** | HIGH | `OfflineQueueContext` — network listener captures stale `status` ref. Auto-sync never triggers after network recovers. |
| **SYNC-002** | MEDIUM | `offlineSyncService.syncAll()` — check-then-set `isSyncing` race condition allows concurrent syncs. |
| **SYNC-003** | MEDIUM | `billUploadQueueService` — `findDuplicateBill` compares `Date.now()` to itself instead of bill timestamps. Never detects real duplicates. |
| **SYNC-004** | MEDIUM | `useOfflineCart` imports `offlineQueueService` directly instead of singleton from context. Instance mismatch possible. |

---

## Security Issues (17 Bugs)

| ID | Severity | Issue |
|----|----------|-------|
| **BE-MER-OTP-001** | CRITICAL | OTP brute-force — no rate limiting, no lockout |
| **SEC-KARMA-SSRF-001** | CRITICAL | SSRF + auth bypass in karma service |
| **SEC-MER-SENS-001** | CRITICAL | Bank details plaintext — GDPR/RBI violation |
| **SEC-MER-INJECT-001** | CRITICAL | MongoDB object injection via prototype pollution |
| **SEC-KARMA-EVT-001** | HIGH | Karma event endpoints have no merchant ownership check — any merchant can modify any merchant's karma events |
| **SEC-MER-PROTO-001** | HIGH | Prototype pollution via `$addToSet` on `internalTags` |
| **SEC-MER-CREDIT-001** | HIGH | Customer credit endpoint accepts negative `amount` — can corrupt ledger |
| **SEC-KARMA-BATCH-001** | HIGH | Duplicate `const` — karma addKarma dead (same as P0-KARMA-001) |
| **SEC-SCHED-INV-TOK-001** | HIGH | Scheduler auth silently skips validation if `JWT_SECRET` is empty string |
| **SEC-AUTH-REDIS-FAIL-001** | HIGH | Token blacklist fails open when Redis + MongoDB both down |
| **SEC-KARMA-CAMP-001** | MEDIUM | Arbitrary field overwrite in karma campaign update |
| **SEC-MER-INVITE-001** | MEDIUM | Invitation rate limiter fails open on Redis error |
| **SEC-MER-HEALTH-002** | MEDIUM | Health profile accessible to any merchant via userId enumeration |
| **SEC-MER-AUTH-DEV-001** | MEDIUM | Merchant auth bypasses in non-production environments |
| **SEC-AUTH-ENUM-001** | MEDIUM | User enumeration via `/auth/has-pin` endpoint |
| **SEC-AUTH-HTTPS-001** | LOW | Karma auth axios call doesn't enforce HTTPS |
| **SEC-MER-OTP-BOMB-001** | LOW | OTP send endpoint has no per-phone rate limit |

### Confirmed FIXED (from previous audits):
- **BE-PAY-002**: Replay attack when Redis unavailable → ✅ Fixed (fails closed, throws error)
- **BE-PAY-025**: Double wallet credit → ✅ Fixed (atomic `findOneAndUpdate` with `walletCredited` guard)
- **BE-PAY-001**: Float precision in refunds → ✅ Fixed (`Math.round`, model setter)
- **BE-PAY-009**: Webhook verification (microservice) → ✅ Fixed (calls `razorpay.getPaymentDetails`)
- **BE-MER-002**: KYC bypass via profile update → ✅ Mitigated (field allowlist)
- **BE-PAY-017**: IDOR in settlements → ✅ Mitigated (merchantId from JWT, not request param)

---

## Priority Fix Order

### NOW (today):
1. **P0-KARMA-001** — Remove duplicate `const startOfWeek` at karmaService.ts:195
2. **API-001** — Add `voucherCode` + `offerRedemptionCode` to CreateOrderRequest
3. **API-002** — Add `store.merchantId` to admin order response
4. **BE-MER-OTP-001** — Add rate limiting to `/auth/verify-otp`
5. **SEC-KARMA-SSRF-001** — Replace HTTP auth call with local JWT verification
6. **SEC-MER-SENS-001** — Encrypt `bankDetails` field

### THIS WEEK:
7. **SEC-MER-INJECT-001** — Fix prototype pollution in customers.ts
8. **SEC-KARMA-EVT-001** — Add ownership check to karma event endpoints
9. **SEC-MER-CREDIT-001** — Validate `amount > 0` in customer credit creation
10. **SEC-AUTH-REDIS-FAIL-001** — Fail closed on token blacklist Redis failure
11. **API-003/004** — Fix `totals.deliveryFee` vs `totals.delivery` mismatch
12. **SYNC-001** — Fix stale network status ref in OfflineQueueContext

### THIS MONTH:
13. **P1-ARCH-001** — Ensure `GAMIFICATION_WORKER_EXTERNAL=true` set in ALL environments
14. **P1-ENUM-001** — Deprecate `packages/shared-enums`, migrate all imports to `@rez/shared`
15. **P1-LOGIC-001** — Namespace gamification tiers vs karma levels
16. **FE-PAY-013** — Add Razorpay verification to monolith webhook
17. **SEC-SCHED-INV-TOK-001** — Fail fast on missing JWT_SECRET
18. **RT-001/002/003** — Fix socket reconnection and change stream reconnection
19. **API-009** — Log `paymentMethod` in wallet payment records
20. **API-011** — Handle or remove `wasilCoins`

---

## Data Sync Truth Table

| Data Type | Source of Truth | Readers | Risk |
|-----------|----------------|---------|------|
| Wallet balance | `wallets` collection | gamification, karma, payment | Race conditions between 3 writers |
| Karma profile | `karmaprofiles` collection | karma service only | System DEAD due to syntax error |
| Orders | `orders` collection | order service, backend, admin, merchant | API contract mismatches |
| Payments | `payments` collection | payment service, backend | Monolith vs microservice divergence |
| Achievements | 2 conflicting definitions | gamification worker, backend | Users get different rewards |
| Loyalty tiers | 2 conflicting definitions | gamification, karma | Inconsistent display |
| Coin transactions | `cointransactions` + `coinledgers` | gamification, karma, wallet | Double-entry ledger not enforced |

---

## What's Actually Good

These parts are solid — don't touch them:

- **Payment microservice webhook handler** — excellent security (HMAC, event dedup, Razorpay verification, atomic wallet credit)
- **Merchant auth refresh token** — crypto.randomBytes, SHA-256 hash, proper cookie flags
- **OTP generation** — `crypto.randomInt` (not Math.random)
- **Password hashing** — bcrypt with cost factor 12
- **Input sanitization** — express-mongo-sanitize applied everywhere
- **Rate limiting** — Redis-backed, applied to auth endpoints
- **Email enumeration prevention** — forgot-password always returns same response
- **Merchant logout** — properly blacklists token in Redis
- **Payment state machine** — PENDING → SUCCESS/FAILED with terminal state protection

---

*Report generated by StayOwn audit — 2026-04-16*
*Total: 82+ bugs across 15 categories. 6 CRITICAL unfixed, 13 HIGH unfixed.*
*Priority: Fix P0 first (karma dead), then CRITICALs, then HIGHs.*

---

## Appendix: Payment & Financial Services Audit (28 Additional Findings)

> Findings from dedicated payment/finance service audit covering rez-payment-service, rez-wallet-service, rez-finance-service, and backend monolith payment controllers.

### Known Issues Status

| ID | Issue | Status |
|----|-------|--------|
| **BE-PAY-001** | Float precision in paise calculations | PARTIALLY FIXED — integer paise in some paths, not all |
| **BE-PAY-002** | Replay attack when Redis unavailable | ✅ FIXED in paymentRoutes.ts — throws error when Redis unavailable |
| **BE-PAY-009** | Webhook payment verification | ✅ FIXED in paymentService.ts — calls `razorpay.getPaymentDetails()` before crediting |
| **BE-PAY-025** | Double wallet credit | ✅ FIXED — atomic `findOneAndUpdate` with `walletCredited` flag |

### CRITICAL Payment Findings

**FE-PAY-001 (CRITICAL — Security)**
**File:** `rezbackend/.../src/controllers/paymentController.ts` `handleRazorpayWebhook`
No event-ID deduplication. Razorpay sends `payload.payment.event.id` that should be tracked with Redis `SET NX`. Without it, the same webhook can be processed multiple times.

**Fix:** Add Redis dedup: `if (await redis.set(\`webhook:razorpay:${eventId}\`, '1', 'EX', 86400, 'NX')) return res.ok()`.

---

**FE-PAY-002 (CRITICAL — Business Logic)**
**File:** `rez-payment-service/src/routes/paymentRoutes.ts`
`PaymentMachine` is created fresh per request. The state machine's `transition()` checks current state from DB, but if two webhooks arrive simultaneously, both read the same state before either writes — defeating the state guard entirely.

**Fix:** Use `findOneAndUpdate` with CAS filter (`status: { $in: validPreviousStates }`) inside the transition function. The machine is fine; the execution pattern needs atomicity.

---

**FE-PAY-026 (CRITICAL — Cross-Service)**
**File:** `rez-payment-service/src/services/paymentService.ts` + `rezbackend/.../Order.ts`
Dual payment status systems: microservice sets `payment.status = 'paid'`, but the monolith's `Order.payment.status` enum may not accept `'paid'` (uses different enum set). The `order.payment.status` field may only accept `'completed'`.

**Impact:** Cross-service status sync fails silently. Orders can be marked paid in the payment service but remain in a limbo state in the monolith's Order document.

**Fix:** Normalize on a single status value. Use `completed` consistently, or use the canonical `rez-shared/paymentStatuses` enum.

---

### HIGH Payment Findings

**FE-PAY-003 (HIGH — Business Logic)**
**File:** `rez-payment-service/src/services/paymentService.ts`
Float precision issue in refund amount calculation: `amount - refunded` uses floating-point subtraction before the result is passed to `Math.round`.

**Fix:** Convert to paise first: `Math.round((amount - refundedAmount) * 100)`.

---

**FE-PAY-004 (HIGH — Business Logic)**
**File:** `rez-payment-service/src/models/Payment.ts`
Pre-save hook compares `refundedAmount` vs `amount` as floats before rounding. `refundedAmount = 99.99999...` passes the check incorrectly.

**Fix:** Use `Math.round(this.refundedAmount)` in the comparison: `if (Math.round(this.refundedAmount) > Math.round(this.amount))`.

---

**FE-PAY-005 (HIGH — Business Logic)**
**File:** `rezbackend/.../src/services/coinService.ts` line 281
`deductCoins` has NO amount cap. The wallet-service's `debitCoins` caps at `MAX_COIN_OPERATION = 1,000,000`. Code calling `deductCoins` bypasses this cap.

**Fix:** Apply the same `MAX_COIN_OPERATION` cap to `coinService.deductCoins`.

---

**FE-PAY-006 (HIGH — Data & Sync)**
**File:** `rez-finance-service/src/services/bnplService.ts`
`settleBnplOrder` reads BNPL order, checks status, then updates — not atomic. Two concurrent settle calls can both pass the status check.

**Fix:** Use `findOneAndUpdate` with CAS filter: `{ _id: orderId, status: { $in: ['due', 'overdue'] } }`.

---

**FE-PAY-007 (HIGH — Business Logic)**
**File:** `rez-payment-service/src/services/paymentService.ts`
`handleWebhookRefundProcessed` converts `event.payload.payment.entity.amount` from rupees to paise: `* 100`. This is a float multiply that can produce `9999.9999`.

**Fix:** Use `Math.round(event.payload.payment.entity.amount * 100)`.

---

**FE-PAY-013 (HIGH — Business Logic)**
**File:** `rez-wallet-service/src/services/walletService.ts` `creditCoins`
Hard-coded `10000` coin credit cap: `if (amount > 10000) throw new Error('...')`. No environment-based override.

**Fix:** Move to config/env var: `parseInt(process.env.MAX_WELCOME_COINS || '10000', 10)`.

---

**FE-PAY-016 (HIGH — Business Logic)**
**File:** `rez-payment-service/src/services/paymentService.ts` `handleWebhookCaptured`
Wallet refund path (`coinsUsed`) has no idempotency guard. If the webhook is retried, coins are refunded twice.

**Fix:** Add idempotency key: `SET NX refund:coins:${orderId}` before processing.

---

**FE-PAY-027 (HIGH — Cross-Service)**
**File:** `rezbackend/.../src/services/coinService.ts` vs `rez-wallet-service/src/services/walletService.ts`
Monolith `deductCoins` vs wallet-service `debitCoins`:

| Feature | `deductCoins` (monolith) | `debitCoins` (wallet-service) |
|---------|---------------------------|-------------------------------|
| Amount cap | None | MAX_COIN_OPERATION (1M) |
| Daily spend limit | Not checked | Checked |
| Coin expiry check | Not implemented | Implemented |
| Frozen wallet guard | Not checked | Checked |
| Priority order debit | Not supported | Supported |

**Impact:** Any code path using `coinService.deductCoins` bypasses all financial safeguards.

**Fix:** Deprecate monolith path; route all coin operations through wallet-service.

---

### MEDIUM Payment Findings

**FE-PAY-008 (MEDIUM):** BNPL repayment capacity uses OR logic — user qualifies if ANY threshold is met. Should use AND. `rez-finance-service/src/services/bnplService.ts`.

**FE-PAY-009 (MEDIUM):** `coinsToRupeesAsync` uses `parseFloat` — precision errors in conversion. `rez-payment-service/src/services/paymentService.ts`.

**FE-PAY-010 (MEDIUM):** `POST /api/wallet/payment` route accepts `'wallet'` as `paymentMethod` but wallet should be handled internally. `rez-wallet-service/src/routes/walletRoutes.ts`.

**FE-PAY-011 (MEDIUM):** Consumer wallet debit without merchantId breaks analytics. `rez-wallet-service/src/routes/walletRoutes.ts`.

**FE-PAY-012 (MEDIUM):** BNPL order status not synced to credit profile on creation. `rez-finance-service/src/services/bnplService.ts`.

**FE-PAY-014 (MEDIUM):** Refund ceiling guard in payment service uses `$expr` — not all MongoDB deployments support `$expr` in updates.

**FE-PAY-015 (MEDIUM):** `FinanceTransaction` uses paise precision validation but `CoinTransaction` uses float for `amount`. Inconsistent.

**FE-PAY-017 (MEDIUM):** `OrderPaymentStatus` schema missing `'expired'`; includes `'captured'` which is not a valid order status.

**FE-PAY-018 (MEDIUM):** Finance transaction normalization converts `'success'` to `'completed'` but wallet service uses `'success'` as valid.

**FE-PAY-019 (MEDIUM):** Stripe webhook handler doesn't verify Stripe signature — trusts raw payload. `rezbackend/.../src/controllers/paymentController.ts`.

**FE-PAY-020 (MEDIUM):** BNPL repayment capacity check uses OR instead of AND. `rez-finance-service/src/services/bnplService.ts`.

**FE-PAY-021 (MEDIUM):** Consumer wallet credit lacks idempotency key. `rez-wallet-service/src/routes/walletRoutes.ts`.

### LOW Payment Findings

**FE-PAY-022 (LOW):** `POST /api/wallet/payment` doesn't return a payment reference ID. Hard to reconcile.

**FE-PAY-023 (LOW):** `POST /api/finance/recharge` and `/api/finance/pay` return 501 — stubs not implemented.

**FE-PAY-024 (LOW):** Zero-amount payment creates a `Payment` document with `amount: 0`. Wasteful.

**FE-PAY-028 (LOW — Cross-Service):** Payment model enum allows `['upi', 'card', 'wallet', 'netbanking']` but route schema allows `['cod', 'wallet', 'razorpay', 'upi', 'card', 'netbanking']`. Mismatch on `'cod'` and `'razorpay'`.

---

## Appendix: Real-Time Sync & BullMQ Audit (22 Additional Findings)

> Findings from dedicated real-time sync, BullMQ double-consume, and offline handling audit covering order service, notification service, consumer app, and backend workers.

### CRITICAL Real-Time / Offline Findings

**RS-001 (CRITICAL — Real-Time Sync)**
**File:** `rez-app-consumer/hooks/useOrderListSocket.ts` lines 38-59
`useOrderListSocket` attaches event listeners but never calls `socket.connect()` or verifies connection state. If the socket isn't already connected from `SocketContext`, all listeners are dead.

**Impact:** Order list updates silently never arrive. Users see stale order lists indefinitely.

**Fix:** Add `if (!socket.connected) return;` guard and call `socket.connect()` if not connected.

---

**RS-002 (CRITICAL — Offline Sync)**
**File:** `rez-app-consumer/services/billUploadQueueService.ts` lines 831-848
`findDuplicateBill` compares `Math.abs(Date.now() - Date.now()) < 60000` — always evaluates to `true` since both sides call `Date.now()` in the same execution tick.

**Impact:** All bill uploads within 5 minutes of each other are incorrectly flagged as duplicates. Legitimate uploads are silently blocked.

**Fix:** Change to `Math.abs(new Date(bill.timestamp).getTime() - new Date(formData.billDate).getTime()) < 5 * 60 * 1000`.

---

**RS-003 (CRITICAL — Offline Sync)**
**File:** `rez-app-consumer/services/billUploadQueueService.ts` lines 339-344
`if (this.isSyncing) throw new Error('Already syncing')` followed by `this.isSyncing = true`. The async gap between check and assignment allows concurrent calls to both pass.

**Impact:** Concurrent sync calls both proceed, causing double-upload of bills and duplicate coin credits.

**Fix:** Replace with atomic CompareAndSet: `if (!await this.syncingLock.acquire()) throw new Error('Already syncing')` using a mutex.

---

### HIGH Real-Time / Offline Findings

**RS-004 (HIGH — Offline Sync)**
**File:** `rez-app-consumer/services/offlineSyncService.ts` lines 191-239
Same check-then-act race as RS-003 on `isSyncing`. React StrictMode double-invocation makes this even more likely to trigger.

**Fix:** Atomic flag or mutex around the entire sync operation.

---

**RS-005 (HIGH — Offline Sync)**
**File:** `rez-app-consumer/contexts/OfflineQueueContext.tsx` lines 411-428
The `useEffect` network listener has no reactive dependency on `status` from `useNetworkStatus()`. The callback closes over the initial `status` value and never updates.

**Impact:** Auto-sync may not trigger when network recovers, or may trigger erroneously when it drops.

**Fix:** Add `status` to the dependency array, or use a ref getter pattern.

---

**RS-006 (HIGH — Offline Sync)**
**File:** `rez-app-consumer/contexts/OfflineQueueContext.tsx` lines 411-428
The `useEffect` dependencies array doesn't include `autoSync`. If `autoSync` changes at runtime, the old listener continues with stale behavior.

**Fix:** Add `autoSync` to the dependency array.

---

**RS-007 (HIGH — Offline Sync)**
**File:** `rez-app-consumer/services/billUploadQueueService.ts` lines 597-712
If network drops during `uploadBill`, `attempt` increments but the upload restarts from scratch on reconnect. No idempotency key or partial-progress tracking.

**Impact:** On reconnect, bill may be re-uploaded without server deduplication, causing duplicate bills and double coin awards.

**Fix:** Add idempotency key (e.g., `billId + attempt`) to upload headers, and persist `attempt` count before each upload.

---

**RS-008 (HIGH — Offline Sync)**
**File:** `rez-app-consumer/hooks/useOfflineCart.ts` line 3
Direct module import `import { offlineQueueService }` instead of the context singleton. If context provides a wrapped version, the hook bypasses it.

**Fix:** Accept `offlineQueueService` as parameter or from context.

---

### MEDIUM Real-Time / Offline Findings

**RS-009 (MEDIUM — Real-Time):** `resubscribeAll` stale closure in `SocketContext.tsx` — when component re-renders (token refresh), `resubscribeAll` is recreated but `handleConnect` may reference old version. Duplicate subscriptions possible.

**RS-010 (MEDIUM — Real-Time):** Token refresh causes full socket disconnect/reconnect. Socket.IO supports token updates via `socket.auth = { token }` without disconnection.

**RS-011 (MEDIUM — Real-Time):** `useEarningsSocket` cleanup function removes listener from current socket but if `socket` reference changes, old listener leaks on old socket.

**RS-012 (MEDIUM — Real-Time):** SSE heartbeat ping write has no failure detection. Dead SSE connections accumulate on server indefinitely.

**RS-013 (MEDIUM — Real-Time):** MongoDB change streams in order service have no automatic reconnection. Stream errors leave zombie SSE connections open.

**RS-014 (MEDIUM — Edge Case):** Order FSM allows `cancelling → placed` transition. Race between cancellation and status update could revert order to placed.

**RS-015 (MEDIUM — Offline Sync):** `wallet-queue.ts` publish is fail-open — wallet events silently dropped on Redis error. No fallback or retry.

**RS-016 (MEDIUM — Offline Sync):** Merchant event bus uses `setImmediate` fire-and-forget for Tier 1 events. Process crash loses events with no persistence.

**RS-017 (MEDIUM — Offline Sync):** Merchant `ORDER_PAID` handler has no transaction safety. `processReward` and `updateCustomerSnapshot` in separate try/catch blocks.

### LOW Real-Time / Offline Findings

**RS-018 (LOW — Offline Sync):** `MAX_QUEUE_SIZE` check runs after deduplication in `offlineSyncService`. Duplicate actions count toward limit even when blocked.

**RS-019 (LOW — BullMQ):** `DISABLE_ORDER_WORKER` env var not aligned with other workers (`ORDER_WORKER_EXTERNAL`). This asymmetry enables the double-consume problem.

**RS-020 (LOW — Edge Case):** Duplicate `order.delivered` events not deduplicated in monolith `orderQueue.ts`. BullMQ's `jobId: event.eventId` provides some protection but isn't verified.

**RS-021 (LOW — Edge Case):** `OrderTotalsSchema` allows `total: 0` via `z.number().nonnegative()`. Zero-amount orders can be placed, triggering reward logic incorrectly.

**RS-022 (LOW — Real-Time):** SSE endpoint 5-minute lifetime cap sends `reconnect` event but server provides no automatic reconnection guidance to clients.

---

## Complete Findings Index

| ID | Severity | Category |
|----|----------|----------|
| **P0-KARMA-001** | P0 | Business Logic |
| **API-001** | HIGH | API Contract |
| **API-002** | HIGH | API Contract |
| **API-003** | MEDIUM | API Contract |
| **API-004** | MEDIUM | API Contract |
| **API-005** | LOW | API Contract |
| **API-006** | LOW | API Contract |
| **API-007** | MEDIUM | API Contract |
| **API-008** | LOW | API Contract |
| **API-009** | MEDIUM | API Contract |
| **API-010** | MEDIUM | API Contract |
| **API-011** | MEDIUM | API Contract |
| **API-012** | LOW | API Contract |
| **API-013** | LOW | API Contract |
| **BE-MER-OTP-001** | CRITICAL | Security |
| **SEC-KARMA-SSRF-001** | CRITICAL | Security |
| **SEC-MER-SENS-001** | CRITICAL | Security |
| **SEC-MER-INJECT-001** | CRITICAL | Security |
| **SEC-KARMA-EVT-001** | HIGH | Security |
| **SEC-MER-PROTO-001** | HIGH | Security |
| **SEC-MER-CREDIT-001** | HIGH | Security |
| **SEC-SCHED-INV-TOK-001** | HIGH | Security |
| **SEC-AUTH-REDIS-FAIL-001** | HIGH | Security |
| **SEC-KARMA-CAMP-001** | MEDIUM | Security |
| **SEC-MER-INVITE-001** | MEDIUM | Security |
| **SEC-MER-HEALTH-002** | MEDIUM | Security |
| **SEC-MER-AUTH-DEV-001** | MEDIUM | Security |
| **SEC-AUTH-ENUM-001** | MEDIUM | Security |
| **SEC-AUTH-HTTPS-001** | LOW | Security |
| **SEC-MER-OTP-BOMB-001** | LOW | Security |
| **P1-ENUM-001** | HIGH | Enum |
| **P1-ENUM-002** | HIGH | Enum |
| **P2-ENUM-003** | MEDIUM | Enum |
| **P2-ENUM-004** | MEDIUM | Enum |
| **P3-ENUM-005** | MEDIUM | Enum |
| **FE-PAY-001** | CRITICAL | Payment |
| **FE-PAY-002** | CRITICAL | Payment |
| **FE-PAY-003** | HIGH | Payment |
| **FE-PAY-004** | HIGH | Payment |
| **FE-PAY-005** | HIGH | Payment |
| **FE-PAY-006** | HIGH | Payment |
| **FE-PAY-007** | HIGH | Payment |
| **FE-PAY-008** | MEDIUM | Payment |
| **FE-PAY-009** | MEDIUM | Payment |
| **FE-PAY-010** | MEDIUM | Payment |
| **FE-PAY-011** | MEDIUM | Payment |
| **FE-PAY-012** | MEDIUM | Payment |
| **FE-PAY-013** | HIGH | Payment |
| **FE-PAY-014** | MEDIUM | Payment |
| **FE-PAY-015** | MEDIUM | Payment |
| **FE-PAY-016** | HIGH | Payment |
| **FE-PAY-017** | MEDIUM | Payment |
| **FE-PAY-018** | MEDIUM | Payment |
| **FE-PAY-019** | MEDIUM | Payment |
| **FE-PAY-020** | MEDIUM | Payment |
| **FE-PAY-021** | MEDIUM | Payment |
| **FE-PAY-022** | LOW | Payment |
| **FE-PAY-023** | LOW | Payment |
| **FE-PAY-024** | LOW | Payment |
| **FE-PAY-026** | CRITICAL | Cross-Service |
| **FE-PAY-027** | HIGH | Cross-Service |
| **FE-PAY-028** | LOW | Cross-Service |
| **P1-LOGIC-001** | HIGH | Business Logic |
| **P1-LOGIC-002** | HIGH | Business Logic |
| **P2-BUSINESS-001** | MEDIUM | Business Logic |
| **P1-ARCH-001** | HIGH | Architecture |
| **P2-ARCH-002** | MEDIUM | Architecture |
| **P2-ARCH-003** | MEDIUM | Architecture |
| **CS-C1** | HIGH | Architecture |
| **ARCH-MULTI** | MEDIUM | Architecture |
| **RT-001** | HIGH | Real-Time |
| **RT-002** | MEDIUM | Real-Time |
| **RT-003** | MEDIUM | Real-Time |
| **SYNC-001** | HIGH | Sync |
| **SYNC-002** | MEDIUM | Sync |
| **SYNC-003** | MEDIUM | Sync |
| **SYNC-004** | MEDIUM | Sync |
| **RS-001** | CRITICAL | Real-Time/Offline |
| **RS-002** | CRITICAL | Offline Sync |
| **RS-003** | CRITICAL | Offline Sync |
| **RS-004** | HIGH | Offline Sync |
| **RS-005** | HIGH | Offline Sync |
| **RS-006** | HIGH | Offline Sync |
| **RS-007** | HIGH | Offline Sync |
| **RS-008** | HIGH | Offline Sync |
| **RS-009** | MEDIUM | Real-Time |
| **RS-010** | MEDIUM | Real-Time |
| **RS-011** | MEDIUM | Real-Time |
| **RS-012** | MEDIUM | Real-Time |
| **RS-013** | MEDIUM | Real-Time |
| **RS-014** | MEDIUM | Edge Case |
| **RS-015** | MEDIUM | Offline Sync |
| **RS-016** | MEDIUM | Offline Sync |
| **RS-017** | MEDIUM | Offline Sync |
| **RS-018** | LOW | Offline Sync |
| **RS-019** | LOW | BullMQ |
| **RS-020** | LOW | Edge Case |
| **RS-021** | LOW | Edge Case |
| **RS-022** | LOW | Real-Time |
