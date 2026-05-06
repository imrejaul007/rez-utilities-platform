# CROSS-SERVICE: Money Atomicity Issues

**Date:** 2026-04-16
**Severity:** CRITICAL — Financial loss risk

---

## Double-Credit Risks

| ID | Location | Issue | Impact |
|----|----------|-------|--------|
| C10 | `payoutRoutes.ts` | Merchant payout race condition | Double payout |
| CS-C1 | BullMQ workers | Double-consume on 5 queues | ~50% events lost |
| CS-C5 | `payment-service` | Coin credit fire-and-forget | Coins permanently lost |
| SD-03 | `wallet-service` | `idempotencyKey` non-unique | Double credits |
| RZ-B-C2 | `webhooks/rez.ts` | Payment webhook race condition | Double reward |
| G-KS-C7 | `earnRecordService.ts` | Idempotency key with UUID suffix | Duplicate EarnRecords |
| BL-C5 | monolith | Wallet credit not in transaction | Double-credit on Redis lock loss |

---

## Missing Transactions

| ID | Location | Issue |
|----|----------|-------|
| C16 | Slot booking | Counter + document separate ops |
| C17 | Table booking | Capacity guard + rollback separate ops |
| H21 | Slot booking | Non-atomic counter + document |
| H35 | Table booking | Non-atomic capacity guard |
| CS-C4 | `rez-wallet-service` | Stores `storeId` (string) not `store` (ObjectId) |

---

## The Fix Pattern

```typescript
// For wallet operations:
const session = await mongoose.startSession();
session.startTransaction();
try {
  const wallet = await Wallet.findOneAndUpdate(
    { userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { session, new: true }
  );
  if (!wallet) throw new InsufficientBalanceError();

  await LedgerEntry.create([{ ... }], { session });
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}

// For idempotency:
const idempotencyKey = `earn_${bookingId}`; // NO random suffix
const existing = await EarnRecord.findOne({ idempotencyKey });
if (existing) return existing; // return existing, don't create
```

---

## Prevention Checklist

- [ ] Every wallet operation in a MongoDB session transaction
- [ ] Every idempotency key = `{operation}_{entityId}` (no UUID suffix)
- [ ] BullMQ concurrency = 1 per queue
- [ ] BullMQ with `attempts: 3` + exponential backoff
- [ ] DLQ monitoring with alerts
- [ ] Integration test: concurrent payment webhooks → only one reward

---

## Status: ACTIVE
