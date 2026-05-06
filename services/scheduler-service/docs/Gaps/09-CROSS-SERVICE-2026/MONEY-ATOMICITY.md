# Cross-Service: Money Atomicity Gaps

**Date:** 2026-04-16
**Updated:** 2026-04-16 (Gen 10 merchant audit added)
**Severity:** 6 CRITICAL, 8 HIGH, 6 MEDIUM (was: 4 CRITICAL, 6 HIGH, 4 MEDIUM)

---

## Overview

Financial operations that span multiple services (payment → wallet → ledger) have insufficient atomicity guarantees. The pattern: payment succeeds, wallet update fails silently, ledger diverges.

---

## CS-M1 — PaymentMachine In-Memory Only (CRITICAL)

**File:** `rez-payment-service/src/routes/paymentRoutes.ts:17-41, 369-381`
**Also affects:** `A10-C4`

**Finding:**
Fresh `PaymentMachine` instantiated per webhook event, always starting in `PENDING` state. No DB state read before transition.

**Crosses:** payment → wallet

**Impact:** Double wallet credit on Razorpay webhook retry when Redis unavailable.

---

## CS-M2 — debitInPriorityOrder Has No Guaranteed Atomicity (CRITICAL)

**File:** `rez-wallet-service/src/services/walletService.ts:614-771`
**Also affects:** `A10-C4` (same issue, different layer)

**Finding:**
Multi-type debit loop uses separate `Wallet.updateOne` calls. If MongoDB isn't a replica set, `startTransaction()` is a no-op. Process crash between aggregate debit and per-type sub-array updates leaves balance divergent from breakdown.

**Crosses:** wallet → ledger

**Impact:** Aggregate balance and per-type breakdown diverge after crash.

---

## CS-M3 — Merchant Credit TOCTOU Outside Transaction (CRITICAL)

**File:** `rez-wallet-service/src/routes/internalRoutes.ts:266-274`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md` SEC-5

**Finding:**
Idempotency check reads `MerchantWalletTransaction` before the session/transaction starts. Two concurrent requests both pass pre-check, both enter transaction, first one wins by race.

**Crosses:** internal route → wallet

**Impact:** Unnecessary abort-retry load under contention.

---

## CS-M4 — No Idempotency on Wallet Mutations (HIGH)

**File:** `rez-app-admin/services/api/userWallets.ts` (all mutation methods)
**Also affects:** `A10-H12`

**Finding:**
`adjustBalance`, `reverseCashback`, `freezeWallet`, `unfreezeWallet` lack idempotency keys.

**Crosses:** admin → wallet

**Impact:** Duplicate credit/debit on network retry.

---

## CS-M5 — Welcome Coins Race Window (HIGH)

**File:** `rez-wallet-service/src/routes/walletRoutes.ts:184-209`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md`

**Finding:**
`hasWelcomeCoinsTransaction` DB read happens before `creditCoins` write, with a race window. Idempotency key `welcome_${userId}` provides eventual dedup but doesn't prevent the race.

**Crosses:** auth → wallet

**Impact:** Two simultaneous welcome coin claims both enter the credit path.

---

## CS-M6 — No OrderId Path in Merchant Credit (HIGH)

**File:** `rez-wallet-service/src/routes/internalRoutes.ts:362-397`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md`

**Finding:**
When `orderId` is absent, the code falls through to a non-idempotent pattern. Two concurrent calls both credit the merchant wallet.

**Crosses:** order → merchant wallet

**Impact:** Double merchant credit on retry.

---

## CS-M7 — Partial Refund Idempotency Key Encodes Mutable Values (MEDIUM)

**File:** `rez-wallet-service/src/services/walletService.ts:878`
**Also affects:** `CODEBASE_ISSUES_AUDIT.md`

**Finding:**
```ts
const idempotencyKey = `partial_refund:${originalTransactionId}:${userId}:${refundAmount}:${originalAmount}`;
```

If caller retries with different `refundAmount`, the idempotency key changes and a second refund can be issued.

**Crosses:** payment → wallet

**Impact:** Refund amount correction triggers new refund.

---

## CS-M8 — debitForCoinAward Has No Transaction (MEDIUM)

**File:** `rez-wallet-service/src/services/merchantWalletService.ts:360-387`

**Finding:**
Two separate writes (`findOneAndUpdate` + `create`) without a transaction wrapper. Crash between the two writes leaves balance debited but no transaction record.

**Crosses:** gamification → merchant wallet

**Impact:** Ledger gap — balance shows debit but no record.

---

## CS-M9 — Visit Milestone Dedup Key Has 1-Second Collision Window (HIGH)

**File:** `rez-wallet-service/src/services/walletService.ts` · `rez-gamification-service/src/httpServer.ts`
**Gap IDs:** NA-HIGH-05, XREP-05
**Severity:** HIGH

**Finding:**
```typescript
// Dedup key uses 1-second resolution:
Math.floor(Date.now() / 1000)  // resets every second

// Two concurrent visit events within the same second produce identical keys
```

**Crosses:** gamification → wallet

**Impact:** Users lose milestone coin rewards when multiple visits recorded within the same second.

---

## CS-M10 — Rewards Hook Idempotency Silent Drop (HIGH)

**File:** `rez-finance-service/src/services/rewardsHookService.ts`
**Gap ID:** NA-HIGH-06
**Severity:** HIGH

**Finding:**
Idempotency check is applied BEFORE the wallet service call, not as a distributed two-phase commit. If wallet service times out, the retry uses the same idempotency key — the rewardsHook level accepts it (already claimed) but wallet may not have written the ledger entry.

**Crosses:** finance → wallet

**Impact:** Users do not receive coins from financial events (loan disbursement, credit card signup, BNPL activation) when wallet call fails on first attempt.

---

## CS-M11 — Floating-Point Truncation on Coin Redemption (MEDIUM)

**File:** `app/bill-payment.tsx`
**Gap ID:** NA-HIGH-07
**Severity:** MEDIUM

**Finding:**
```typescript
Math.floor((fetchedBill.amount * (selectedProvider.maxRedemptionPercent / 100)))
// IEEE 754: 1000 * 0.07 = 70.0000000004 → Math.floor → 70 (off by 1)
```

**Crosses:** consumer app → wallet

**Impact:** Users shown fewer redeemable coins than the provider's percentage allows. Systematic under-redemption at scale.

---

## CS-M12 — Offline Bill Idempotency Key Assigned After INSERT (CRITICAL)

**File:** `rezmerchant/services/offlinePOSQueue.ts:58-80`
**Gap ID:** G-MA-C08
**Severity:** CRITICAL
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
```typescript
// clientTxnId assigned AFTER INSERT:
const insertResult = db.runSync(
  'INSERT INTO pending_bills (...) VALUES (...)',
  [...billData, ...]
);
if (!billData.clientTxnId) {
  billData.clientTxnId = generateTxnId();
}
// If crash between INSERT and assignment, bill stored without idempotency key
```

**Crosses:** Merchant App Gen 10 → Backend (POS bill endpoint)

**Impact:** If app crashes between INSERT and idempotency key assignment, same bill syncs with a new ID on retry → server-side duplicate detection fails → **double-charge**.

---

## CS-M13 — Failed Offline Bills Silently Removed from Queue (CRITICAL)

**File:** `rezmerchant/services/offlinePOSQueue.ts:260-263`
**Gap ID:** G-MA-C09
**Severity:** CRITICAL
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
```typescript
} else if (bill.attempts >= 5) {
  markBillSuccess(bill.id!); // REMOVED from queue as if it SUCCEEDED
}
```

**Crosses:** Merchant App Gen 10 → Backend

**Impact:** After 5 failed sync attempts, bill is silently dropped from queue with no merchant notification. Revenue lost with zero trace. Same pattern as CS-M10 (rewards hook idempotency drop).

---

## CS-M14 — Batch Sync No Atomicity — Partial Failure Re-sends All (CRITICAL)

**File:** `rezmerchant/services/offlinePOSQueue.ts:232-275`
**Gap ID:** G-MA-C10
**Severity:** CRITICAL
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
```
Server processes 25 of 50 bills → those 25 REMOVED from queue
26th errors → remaining 25 stay in queue
Next retry: ALL 50 sent again
Relies entirely on server-side idempotency
```

**Crosses:** Merchant App Gen 10 → Backend

**Impact:** If server idempotency has any gap, **double-charge** occurs. No client-side transactional safety.

---

## CS-M15 — Coin Redemption Not in POS Payment Payload (CRITICAL)

**File:** `rezmerchant/app/pos/index.tsx:247,675-689,711`
**Gap ID:** G-MA-C02
**Severity:** CRITICAL
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
```typescript
// Line 247: coinRedemption.discountApplied computed
const discountAmount = ... + (coinRedemption?.discountApplied || 0);
// Line 675-689: payload built — coinRedemption NOT included
const payload = { items, subtotal, discountAmount, paymentMethod, storeId };
// Line 711: finalAmount subtracts coin discount from backend bill amount
const finalAmount = bill.amount - (coinDiscountApplied > 0 ? coinDiscountApplied : 0);
```

**Crosses:** Merchant App Gen 10 → Backend → Wallet

**Impact:** Backend creates bill at FULL `subtotal`. Coins are issued on the full amount. Customer pays reduced amount but merchant revenue based on full bill. Coin pool over-issued. Merchant revenue leaks.

---

## CS-M16 — Offline Bill Sync Loses Coin Discount Entirely (CRITICAL)

**File:** `rezmerchant/app/pos/index.tsx:658-674` + `services/offlinePOSQueue.ts:224-230`
**Gap ID:** G-MA-C03
**Severity:** CRITICAL
**Updated:** 2026-04-16 (Gen 10 merchant audit added)

**Finding:**
`coinDiscountApplied` and `consumerIdForCoins` are never stored in the offline queue. When `syncOfflineQueue` POSTs to `merchant/pos/offline-sync`, no coin data is sent. Backend creates bill at full amount.

**Crosses:** Merchant App Gen 10 → Backend → Wallet

**Impact:** Silent overcharge. Customer who applied Rs.200 coin discount is charged Rs.200 extra when offline. No recovery path.

---

## Status Table

| ID | Title | Severity | Crosses | Status |
|----|-------|---------|---------|--------|
| CS-M1 | PaymentMachine in-memory only | CRITICAL | payment → wallet | ACTIVE |
| CS-M2 | debitInPriorityOrder no guaranteed atomicity | CRITICAL | wallet → ledger | ACTIVE |
| CS-M3 | Merchant credit TOCTOU | CRITICAL | internal → wallet | ACTIVE |
| CS-M12 | Offline idempotency key after INSERT | CRITICAL | Merchant → Backend | ACTIVE |
| CS-M13 | Failed offline bills silently removed | CRITICAL | Merchant → Backend | ACTIVE |
| CS-M14 | Batch sync partial failure re-sends all | CRITICAL | Merchant → Backend | ACTIVE |
| CS-M15 | Coin redemption not in POS payload | CRITICAL | Merchant → Backend → Wallet | ACTIVE |
| CS-M16 | Offline bill loses coin discount | CRITICAL | Merchant → Backend → Wallet | ACTIVE |
| CS-M9 | Dedup key 1-second collision window | HIGH | gamification → wallet | ACTIVE |
| CS-M10 | Rewards hook idempotency silent drop | HIGH | finance → wallet | ACTIVE |
| CS-M4 | No idempotency on wallet mutations | HIGH | admin → wallet | ACTIVE |
| CS-M5 | Welcome coins race window | HIGH | auth → wallet | ACTIVE |
| CS-M6 | No OrderId path in merchant credit | HIGH | order → wallet | ACTIVE |
| CS-M7 | Partial refund idempotency key mutable | MEDIUM | payment → wallet | ACTIVE |
| CS-M8 | debitForCoinAward no transaction | MEDIUM | gamification → wallet | ACTIVE |
| CS-M11 | Floating-point truncation on redemption | MEDIUM | consumer → wallet | ACTIVE |
