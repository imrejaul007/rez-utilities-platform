# REZ System Remediation Plan

**Created:** 2026-04-12  
**Scope:** All 31 bugs documented in this Bugs folder  
**Philosophy:** Fix foundation first. Don't build features on broken ground.

---

## Priority Order (Non-Negotiable)

```
Layer 1: Data Models    ← Fix first. Everything else reads from here.
Layer 2: API Contracts  ← Fix second. Frontend can't work without this.
Layer 3: Enums/Logic    ← Fix third. Correct behavior after contracts work.
Layer 4: Auth/Sync      ← Fix fourth. Security + sync complete the system.
```

---

## WEEK 1 — STOP THE BLEEDING (Emergency fixes, no feature work)

**Goal:** Prevent active data corruption and close security vulnerabilities.

---

### Day 1 — Environment variable emergency patch (30 minutes)

**Owner:** Backend + DevOps  
**No code change required — just env vars**

Set in ALL production environments immediately:
```bash
REWARD_REZ_EXPIRY_DAYS=0       # Fix C3 — REZ coins must never expire
REWARD_BRANDED_EXPIRY_DAYS=180 # Fix M7 — Branded coins expire in 6 months per spec
```

Verify on Render/Railway/deployment platform that these are set before next server restart.

**Test:** After setting, call `GET /api/wallet/config` and verify `coinExpiryConfig.rez` returns 0.

---

### Day 1–2 — Auth security patches in wallet + payment services

**Owner:** Backend team  
**Bugs fixed:** C4, C5, C6

**Step 1 — Fail closed on Redis outage (C4)**  
In both `rez-wallet-service/src/middleware/auth.ts` and `rez-payment-service/src/middleware/auth.ts`:

Replace:
```typescript
} catch {
  // Redis unavailable — fail open
}
```
With:
```typescript
} catch (redisErr) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({ 
      error: 'Auth service temporarily unavailable',
      code: 'AUTH_SERVICE_UNAVAILABLE'
    });
  }
  // fail open only in development/test
}
```

**Step 2 — Single secret per service (C5)**  
In `rez-wallet-service/src/middleware/auth.ts`, replace the multi-secret loop with:
```typescript
const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
if (decoded.role && decoded.role !== 'user') {
  return res.status(403).json({ error: 'User token required for this endpoint' });
}
```
Create a separate `requireMerchantAuth` middleware for merchant-wallet routes that verifies against `JWT_MERCHANT_SECRET`.

**Step 3 — Standardize blacklist key format (C6)**  
Agree on one format. Recommended: `blacklist:{sha256(token)}`  
Update:
- `rezbackend/src/middleware/auth.ts` `blacklistToken()` function
- `rezbackend/src/middleware/merchantauth.ts` `blacklistToken()` function  
- `rez-wallet-service/src/middleware/auth.ts` blacklist check
- `rez-payment-service/src/middleware/auth.ts` blacklist check

All four must use identical key format.

**Test:** Log out a merchant user. Attempt a wallet API call with the old token. Confirm 401.

---

### Day 2–3 — Fix sync no-ops to return honest errors

**Owner:** Backend team  
**Bugs fixed:** C7, C8

**Step 1 — Mark dead sync endpoints as 501 (C8)**  
In `rezbackend/src/merchantroutes/sync.ts`:
```typescript
router.post('/orders', requireAuth, async (req, res) => {
  return res.status(501).json({
    success: false,
    message: 'Order sync not yet implemented. Orders are managed by the user backend directly.',
    code: 'NOT_IMPLEMENTED'
  });
});

router.post('/cashback', requireAuth, async (req, res) => {
  return res.status(501).json({
    success: false,
    message: 'Cashback sync not yet implemented.',
    code: 'NOT_IMPLEMENTED'
  });
});
```

**Step 2 — Fix CrossAppSyncService to actually send HTTP (C7)**  
In `CrossAppSyncService.ts` (lines 261–293), uncomment the HTTP call:
```typescript
async sendToCustomerApp(webhookUrl: string, event: string, data: any) {
  const payload = { event, data, timestamp: Date.now() };
  const signature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(JSON.stringify(payload))
    .digest('hex');
    
  const response = await axios.post(webhookUrl, payload, {
    headers: { 'X-REZ-Signature': signature },
    timeout: 5000
  });
  return response.data;
}
```

Move webhook registration from in-memory Map to MongoDB (`WebhookRegistration` collection).

**Test:** Trigger an order status update in merchant. Confirm consumer app receives the webhook event.

---

### Day 3 — Block merchant-service CoinTransaction writes

**Owner:** Backend + Merchant service team  
**Bug fixed:** C1

**Immediate (stop corruption):** Add strict schema validation to `rez-merchant-service/CoinTransaction.ts`:
```typescript
// Replace existing schema with import from rez-shared
import { CoinTransactionSchema } from 'rez-shared/models/CoinTransaction';
```

If `rez-shared` doesn't have a unified schema yet, at minimum add to the merchant service schema:
```typescript
coinType: { type: String, required: true, enum: COIN_TYPE_VALUES },
source: { type: String, required: true },
description: { type: String, required: true }
```

Remove the `coins: Number` top-level field.

**Migration:** Run a repair script on the `cointransactions` collection to identify and flag merchant-service-written documents (identifiable by presence of `storeId` without `coinType`).

---

## WEEK 2 — FIX THE CORE PRODUCT (Frontend-facing bugs)

**Goal:** Restore broken core features in the merchant app.

---

### Fix merchant wallet transaction list (H1)

**Owner:** Backend OR Frontend (pick one — Day 1 of week 2)

**Option A — Fix backend response (recommended):**  
In `rez-wallet-service/src/routes/merchantWalletRoutes.ts` (line 59):
```typescript
// Change from:
res.json({ success: true, data: result.transactions, pagination: result.pagination });

// To:
res.json({ success: true, data: { transactions: result.transactions, pagination: result.pagination } });
```

**Test:** Open merchant wallet history page. Confirm transaction list populates.

---

### Fix cashback approve/reject (H2)

**Owner:** Backend — Day 1–2 of week 2

Add to `src/routes/merchant/cashback.ts`:
```typescript
router.put('/:id/approve', merchantAuth, validateRequest(approveSchema), cashbackController.approveCashbackRequest);
router.put('/:id/reject', merchantAuth, validateRequest(rejectSchema), cashbackController.rejectCashbackRequest);
```

Verify `server.ts` mounts `src/routes/merchant/cashback.ts` (not only `merchantroutes/cashback.ts`). If both are mounted at the same path, de-duplicate by removing `merchantroutes/cashback.ts` after porting all missing routes.

**Test:** Approve a cashback request from merchant app. Confirm status updates.

---

### Fix bulk cashback field name (H3)

**Owner:** Backend — Day 2 of week 2

In `src/routes/merchant/cashback.ts` (line 147), change:
```typescript
cashbackIds: Joi.array().items(Joi.string()).required()
// to:
requestIds: Joi.array().items(Joi.string()).required()
```

OR update frontend to send `cashbackIds`. Update `merchantroutes/cashback.ts` to match.

Pick one name. Document it. Align both files.

**Test:** Select multiple cashback requests, click bulk approve. Confirm 200 response.

---

### Fix cashback export method (H4)

**Owner:** Backend — Day 2 of week 2

Change `src/routes/merchant/cashback.ts` (line 62):
```typescript
router.post('/export', merchantAuth, cashbackController.exportCashback);
```

(POST is better for export since query params can be complex.)

Update `merchantroutes/cashback.ts` (line 744) to also use POST.

**Test:** Click export button in merchant cashback section. Confirm file download initiates.

---

### Fix payment method field mismatch (H5)

**Owner:** Backend — Day 3 of week 2

Create mapping in the monolith's payment initiation handler:
```typescript
// Normalize incoming paymentMethodType → paymentMethod before forwarding to payment service
const paymentMethod = req.body.paymentMethodType || req.body.paymentMethod;
```

Update the shared type in `rez-shared/src/types/payment.ts`:
```typescript
type PaymentMethod = 'cod' | 'wallet' | 'razorpay' | 'upi' | 'card' | 'netbanking';
```

Both services validate against this shared type.

---

## WEEK 3 — DATA INTEGRITY

**Goal:** Fix the structural data model issues that cause phantom balances and invisible records.

---

### Fix cashback + referral coin tracking (C2)

1. Add `cashback` and `referral` to `LedgerEntry.coinType` enum (backend model)
2. Add `cashback` and `referral` to `rez-wallet-service/Wallet.coins[].type` enum
3. Add entries to `currencyRules.ts` for both types:
   ```typescript
   cashback: { priority: 0, expiryDays: 0, isTransferable: false },
   referral: { priority: 0, expiryDays: 90, isTransferable: false }
   ```
4. Run reconciliation: find all CoinTransaction docs with `coinType: 'cashback'` or `'referral'` that have no corresponding LedgerEntry. Create the missing ledger entries.

---

### Fix merchant wallet uniqueness (H6)

1. Remove `merchantId` field from `rez-merchant-service/MerchantWallet.ts`
2. Keep only `merchant: ObjectId` with ref `'Merchant'`
3. Run: `db.merchantwallets.find()` — identify any duplicates where two docs share the same merchant ObjectId
4. Merge duplicate wallets: sum balances, concatenate transaction history, keep the older `_id`

---

### Fix Cashback collection unification (H7)

Create a migration plan:
1. Add `merchantCashbackId` field to `cashbackrequests` (FK → `cashbacks._id`)
2. Create a reconciliation script that links existing records by `merchantId` + `userId` + `amount` + date window
3. Going forward: when merchant approves in `cashbacks`, emit an event that creates a `cashbackrequests` record
4. Long-term target: deprecate `cashbacks` collection entirely, move merchant cashback management to `cashbackrequests`

---

### Fix UserLoyalty phantom balance (H8)

Add a post-save hook to `Wallet` model:
```typescript
WalletSchema.post('save', async function(wallet) {
  await UserLoyalty.findOneAndUpdate(
    { user: wallet.user },
    { 'coins.available': wallet.balance.available },
    { upsert: false }
  );
});
```

Or remove `UserLoyalty.coins.available` as a stored field and compute it on-the-fly in the loyalty query.

---

### Remove prive→rez normalization (H11)

Remove from `rezbackend/src/services/walletService.ts` (lines 68–71):
```typescript
// Remove this:
const coinType: LedgerCoinType = rawCoinType === 'prive' ? 'rez' : (rawCoinType as LedgerCoinType);

// Use this:
const coinType: LedgerCoinType = rawCoinType as LedgerCoinType;
```

Run migration to reclassify existing `LedgerEntry` records where `coinType === 'rez'` and the source CoinTransaction has `coinType === 'prive'`.

---

### Standardize Wallet.currency (H13)

1. Agree on `'REZ_COIN'` as canonical value
2. Update `rezbackend/Wallet.ts` default from `'RC'` to `'REZ_COIN'`
3. Keep `'RC'` in the enum for backwards compatibility during migration
4. Run: `db.wallets.updateMany({ currency: 'RC' }, { $set: { currency: 'REZ_COIN' } })`
5. After 30 days, remove `'RC'` from enum

---

## WEEK 4 — BUSINESS LOGIC CONSISTENCY

**Goal:** Align streak, coin priority, and expiry logic across all services.

---

### Unify streak milestone amounts (H9)

Create `rez-shared/src/config/streakMilestones.ts`:
```typescript
export const STREAK_MILESTONES = {
  store_visit: [
    { days: 3, coins: 50 },
    { days: 7, coins: 200 },   // canonical: 200 (not 150)
    { days: 30, coins: 500 }
  ],
  login: [
    { days: 3, coins: 50 },
    { days: 7, coins: 200 },
    { days: 14, coins: 500 }
  ]
};
```

Update both `streakService.ts` and `storeVisitStreakWorker.ts` to import from this file.

---

### Fix streak timezone (H10)

Move `getISTDayStart()` and `isNextISTDay()` to `rez-shared/src/utils/timezone.ts`.

Update `storeVisitStreakWorker.ts`:
```typescript
import { isNextISTDay } from 'rez-shared/utils/timezone';
// Replace: dayDiff logic
// With: isNextISTDay(lastVisitDate, currentDate)
```

---

### Build coin expiry job (M1)

Create `rezbackend/src/jobs/expireCoins.ts`:
```typescript
export async function runCoinExpiryJob() {
  const now = new Date();
  
  // Find expired coin buckets
  const wallets = await Wallet.find({
    'coins.expiryDate': { $lt: now },
    'coins.amount': { $gt: 0 }
  });
  
  for (const wallet of wallets) {
    for (const coinBucket of wallet.coins) {
      if (coinBucket.expiryDate < now && coinBucket.amount > 0) {
        // 1. Write to expired_pool via LedgerEntry
        await ledgerService.transfer({
          from: wallet.user.toString(),
          to: EXPIRED_POOL_ACCOUNT,
          amount: coinBucket.amount,
          coinType: coinBucket.type,
          description: `Coin expiry: ${coinBucket.type}`
        });
        // 2. Zero out the bucket
        coinBucket.amount = 0;
        // 3. Notify user
        await notificationService.sendCoinExpiryNotification(wallet.user, coinBucket);
      }
    }
    await wallet.save();
  }
}
```

Schedule as a nightly cron at 00:30 IST. Also add 7-day advance expiry warning job.

---

### Add debitInPriorityOrder to monolith (M8)

Port from `rez-wallet-service/src/services/walletService.ts`:
```typescript
async debitInPriorityOrder(userId: string, totalAmount: number, description: string) {
  const priority = ['promo', 'branded', 'prive', 'rez'];
  let remaining = totalAmount;
  
  const wallet = await Wallet.findOne({ user: userId });
  
  for (const coinType of priority) {
    if (remaining <= 0) break;
    const bucket = wallet.coins.find(c => c.type === coinType && c.amount > 0);
    if (!bucket) continue;
    
    const deductAmount = Math.min(bucket.amount, remaining);
    await this.debitCoins(userId, deductAmount, coinType, description);
    remaining -= deductAmount;
  }
  
  if (remaining > 0) throw new Error('Insufficient coins across all types');
}
```

Update monolith payment flows to use `debitInPriorityOrder()` instead of hardcoded `coinType: 'rez'`.

---

## BACKLOG (No date yet — after core stabilization)

| Bug | Description |
|-----|-------------|
| M2 | Admin order status migration — normalize legacy status values in DB |
| M3 | Fix `getLastSyncDate()` to query MongoDB instead of in-memory |
| M4 | Scope `/api/sync/statistics` to authenticated merchant only |
| M5 | Move `MerchantLoyaltyConfig` to `rez-shared/` |
| M6 | Migrate `LoyaltyReward` to use ObjectId refs instead of phone/slug |
| M9 | Centralize campaign eligibility checking |
| M10 | Enable httpOnly cookie auth for merchant web |
| — | Wallet service Redis cache invalidation cross-service coordination |
| — | Merge `merchantroutes/` into `routes/` — remove duplicate routing layer |
| — | Add shared TypeScript types package (`rez-shared/src/types`) for all DTOs |

---

## Architectural Changes Needed (Beyond Individual Bug Fixes)

### 1. Unified schema package (`rez-shared/src/models/`)
Move these models to shared:
- `CoinTransaction` — currently 3 incompatible versions
- `MerchantLoyaltyConfig` — currently duplicated
- `WalletConfig` — referenced by 3 services

All services import from `rez-shared`. No local model copies.

### 2. Single API contract definition (`rez-shared/src/types/api/`)
Define all request/response DTOs in one place. Both frontend and backend import from the same package. Contract mismatches become type errors at build time.

### 3. Working event bus
Replace `CrossAppSyncService` in-memory queue with BullMQ for ALL cross-app events. Every service publishes and subscribes via a shared queue connection. No direct HTTP calls between services for event delivery.

### 4. Coin expiry audit trail
The `expired_pool` ledger account exists in `LedgerEntry.ts` but is never written to. Complete the accounting:
- Every expired coin debit writes to `expired_pool`
- Monthly reconciliation report: earned vs spent vs expired by coin type
- This is required for accurate financial liability reporting

---

## Definition of Done

For each bug fix, the following must pass before closing:

- [ ] Code change merged to `main`
- [ ] Unit test covering the specific fix
- [ ] Integration test if the bug involved cross-service communication
- [ ] Manual QA on staging environment
- [ ] No regression in related features
- [ ] Bug entry in this document updated with "Fixed in commit: [hash]"
