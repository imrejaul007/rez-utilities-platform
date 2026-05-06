# REZ Complete Bug Fix Execution Plan

**Created:** 2026-04-13  
**Total Bugs:** 31 (8 Critical, 13 High, 10 Medium)  
**Total Sprints:** 5  
**Rule:** No sprint starts until previous sprint is fully tested and verified.

---

## Dependency Map (Why Order Matters)

```
C3 (env vars) ──────────────────────────────────────────► can be done in 30 min, do it NOW
C4+C5+C6 (auth) ────────────────────────────────────────► security, do Day 1
C7+C8 (sync no-ops) ─────────────────────────────────── ► stop false signals, do Day 2
C1 (cointransactions schema) ───┐
                                ├──► must be fixed before C2, H6, H7 make sense
H13 (wallet.currency) ──────────┘
C2 (cashback/referral coins) ──────► depends on C1 (unified schema first)
H6 (merchantwallet uniqueness) ────► depends on C1 (schema unification)
H7 (cashback collections) ─────────► depends on H2, H3, H4 being fixed first
H1 (transaction list empty) ───────► independent, fast fix
H2+H3+H4 (cashback routes) ────────► independent, fast fixes
H5 (payment field name) ───────────► independent
H8 (phantom loyalty balance) ──────► depends on H13 (wallet.currency fixed first)
H9+H10 (streak bugs) ──────────────► need rez-shared package first
H11 (prive→rez) ───────────────────► simple 1-line fix, any time
H12 (localStorage XSS) ────────────► independent security fix
M1 (expiry job) ────────────────── ► depends on C2 (coin types must be complete first)
M2 (order status migration) ───────► DB migration, independent
M3 (getLastSyncDate) ───────────── ► depends on C7 sync being real first
M4 (sync stats leak) ──────────────► independent, 2-line fix
M5 (MerchantLoyaltyConfig shared) ─► needs rez-shared package
M6 (LoyaltyReward ObjectIds) ──────► DB migration, independent
M7 (branded expiry env var) ───────► same fix as C3, do same day
M8 (debitInPriorityOrder) ─────────► depends on C2 (all coin types tracked)
M9 (campaign eligibility) ─────────► independent service creation
M10 (cookie auth) ─────────────────► depends on C4 auth being solid first
```

---

## SPRINT 0 — PRE-WORK (Do Before Writing Any Code)

**Time: 2 hours**  
**Purpose: Environment + foundation decisions**

### 0.1 Set critical environment variables (30 min)
On ALL production + staging environments (Render/Railway/Vercel):

```bash
REWARD_REZ_EXPIRY_DAYS=0        # REZ coins never expire — fixes C3
REWARD_BRANDED_EXPIRY_DAYS=180  # Branded coins expire in 180 days — fixes M7
WEBHOOK_SECRET=<generate-32-char-random>  # For C7 webhook signing
```

**Verify:** Restart each service. Hit `GET /api/wallet/config` on the backend. Confirm `coinExpiryConfig.rez === 0`.

### 0.2 Decide on rez-shared package structure (30 min)
Check if `packages/rez-shared` already has content:

```bash
ls /Users/rejaulkarim/Documents/ReZ\ Full\ App/packages/
```

Create the folder structure that all sprints will populate:
```
packages/rez-shared/src/
  models/          ← canonical MongoDB schemas
  types/           ← TypeScript interfaces for all DTOs
  config/          ← shared constants (streakMilestones, currencyRules)
  utils/           ← shared utilities (timezone helpers)
```

### 0.3 Identify which cashback router is actively mounted (30 min)
Read `rezbackend/rez-backend-master/src/server.ts` (or `app.ts`) and find:
- Is `src/routes/merchant/cashback.ts` mounted?
- Is `src/merchantroutes/cashback.ts` mounted?
- Are both mounted at the same path?

This determines whether H2, H3, H4 fixes go in the new or old router file.

### 0.4 Audit duplicate MerchantWallet records (30 min)
Run on production MongoDB before fixing H6:
```javascript
db.merchantwallets.aggregate([
  { $group: { _id: "$merchant", count: { $sum: 1 }, ids: { $push: "$_id" } } },
  { $match: { count: { $gt: 1 } } }
])
```
Note the count. You need this before writing migration code.

---

## SPRINT 1 — SECURITY & INTEGRITY (Week 1, Days 1–3)

**Goal:** Stop data corruption. Close security holes. No user-visible feature work.  
**Bugs:** C1, C3, C4, C5, C6, C7, C8, M7

---

### TASK 1.1 — Fix auth in wallet-service (C4 + C5)
**File:** `rez-wallet-service/src/middleware/auth.ts`  
**Time:** 2 hours

**Change 1 — Fail closed on Redis outage (C4):**
Find the try/catch block around the blacklist check (lines 51–69). Replace the catch body:
```typescript
} catch (redisErr) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({
      error: 'Auth service temporarily unavailable',
      code: 'AUTH_SERVICE_UNAVAILABLE'
    });
  }
  // fail open in development only
  console.warn('[Auth] Redis unavailable — failing open (dev mode only)');
}
```

**Change 2 — Remove multi-secret loop (C5):**
Find the secrets loop (lines 26–40). Replace the entire block:
```typescript
let decoded: JWTPayload;
try {
  decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
} catch {
  return res.status(401).json({ error: 'Invalid or expired token' });
}

// Reject merchant and admin tokens from user wallet endpoints
if (decoded.role && !['user', 'consumer'].includes(decoded.role)) {
  return res.status(403).json({ 
    error: 'User token required. Use merchant wallet API for merchant operations.',
    code: 'WRONG_TOKEN_TYPE'
  });
}
```

Add a new `requireMerchantAuth` middleware at the bottom of the file:
```typescript
export async function requireMerchantAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_MERCHANT_SECRET!) as JWTPayload;
    req.merchantId = decoded.merchantId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid merchant token' });
  }
}
```

Update merchant wallet routes to use `requireMerchantAuth` instead of `requireAuth`.

**Test:**
- Call user wallet API with a merchant JWT → should get 403
- Kill Redis → call any wallet API in production → should get 503
- Normal user token → should pass

---

### TASK 1.2 — Fix auth in payment-service (C4)
**File:** `rez-payment-service/src/middleware/auth.ts`  
**Time:** 30 min

Same change as Task 1.1 — replace the catch body:
```typescript
} catch (redisErr) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({
      error: 'Auth service temporarily unavailable',
      code: 'AUTH_SERVICE_UNAVAILABLE'
    });
  }
}
```

---

### TASK 1.3 — Standardize token blacklist key format (C6)
**Files:** 4 files  
**Time:** 1 hour

Decide on format: `blacklist:{sha256(token)}` — no role prefix.

**File 1: `rezbackend/src/middleware/auth.ts` — `blacklistToken()` function:**
```typescript
export async function blacklistToken(token: string): Promise<void> {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const ttl = 15 * 60; // 15 minutes = max JWT lifetime
  await redis.setex(`blacklist:${hash}`, ttl, '1');
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return (await redis.exists(`blacklist:${hash}`)) === 1;
}
```

**File 2: `rezbackend/src/middleware/merchantauth.ts` — `blacklistToken()`:**
Same implementation — use the shared function or copy it.

**File 3: `rez-wallet-service/src/middleware/auth.ts` — blacklist check:**
```typescript
const hash = crypto.createHash('sha256').update(token).digest('hex');
const isBlacklisted = await redis.exists(`blacklist:${hash}`);
```

**File 4: `rez-payment-service/src/middleware/auth.ts` — blacklist check:**
Same as File 3.

**Test:**
- Log out merchant → attempt wallet-service API call → should 401
- Log out user → attempt payment-service API call → should 401

---

### TASK 1.4 — Fix sync no-ops to return 501 (C8)
**File:** `rezbackend/rez-backend-master/src/merchantroutes/sync.ts`  
**Time:** 30 min

Find `POST /orders` and `POST /cashback` handlers (lines 239–294). Replace their bodies:
```typescript
router.post('/orders', requireAuth, async (req, res) => {
  return res.status(501).json({
    success: false,
    error: 'Order sync not implemented. Orders are managed by the user backend directly.',
    code: 'NOT_IMPLEMENTED'
  });
});

router.post('/cashback', requireAuth, async (req, res) => {
  return res.status(501).json({
    success: false,
    error: 'Cashback sync not implemented.',
    code: 'NOT_IMPLEMENTED'
  });
});
```

**Test:** Call `POST /api/sync/orders` → confirm 501 response (not 200 with synced: 0).

---

### TASK 1.5 — Implement CrossAppSyncService HTTP delivery (C7)
**File:** `rezbackend/rez-backend-master/src/merchantservices/CrossAppSyncService.ts`  
**Time:** 3 hours

**Step 1 — Create WebhookRegistration MongoDB model:**
Create `rezbackend/src/models/WebhookRegistration.ts`:
```typescript
const WebhookRegistrationSchema = new Schema({
  merchantId: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true },
  targetApp: { type: String, enum: ['consumer', 'admin'], required: true },
  webhookUrl: { type: String, required: true },
  events: [{ type: String }],
  secret: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  lastDeliveredAt: Date,
  failureCount: { type: Number, default: 0 }
}, { timestamps: true });
```

**Step 2 — Replace in-memory Map with MongoDB queries:**
In `CrossAppSyncService.ts`, replace `customerAppWebhooks: Map<string, string>` with:
```typescript
private async getWebhookUrl(merchantId: string, targetApp: string): Promise<string | null> {
  const reg = await WebhookRegistration.findOne({ merchantId, targetApp, isActive: true });
  return reg?.webhookUrl ?? null;
}
```

**Step 3 — Uncomment and implement the HTTP call (lines 261–293):**
```typescript
async sendToCustomerApp(webhookUrl: string, event: string, data: any): Promise<void> {
  const payload = { event, data, timestamp: Date.now() };
  const signature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(JSON.stringify(payload))
    .digest('hex');

  await axios.post(webhookUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-REZ-Signature': `sha256=${signature}`,
      'X-REZ-Event': event
    },
    timeout: 5000
  });
}
```

**Step 4 — Add retry via BullMQ:**
Create a BullMQ queue `webhook-delivery`. When `sendToCustomerApp` fails, add to the queue with 3 retries and exponential backoff. Add a dead-letter queue handler that marks `WebhookRegistration.isActive = false` after 5 consecutive failures.

**Test:** Create a test webhook receiver (ngrok or staging). Register it. Trigger an order update. Confirm HTTP delivery arrives.

---

### TASK 1.6 — Stop merchant-service CoinTransaction corruption (C1)
**File:** `rez-merchant-service/src/models/CoinTransaction.ts`  
**Time:** 1 hour

Add the missing required fields that the `cointransactions` collection expects:
```typescript
const CoinTransactionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coinType: { 
    type: String, 
    required: true, 
    enum: ['rez', 'prive', 'branded', 'promo', 'cashback', 'referral']
  },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true },
  source: { type: String, required: true },
  description: { type: String, required: true },
  storeId: { type: Schema.Types.ObjectId, ref: 'Store' },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'reversed'], default: 'completed' }
}, { timestamps: true });
```

Remove the old `coins: Number` field. Any merchant-service code that wrote to `coins` must be updated to write to `amount` with a proper `coinType`.

**Migration script** to identify bad existing records:
```javascript
// Run on MongoDB to find merchant-service written records
db.cointransactions.find({ 
  coinType: { $exists: false },
  storeId: { $exists: true }
}).count()
// If > 0, these need manual review/repair
```

**Test:** Create a coin transaction through the merchant service. Confirm `coinType`, `source`, `description` are all present.

---

### Sprint 1 Checklist
- [ ] C3: Env vars set (`REWARD_REZ_EXPIRY_DAYS=0`, `REWARD_BRANDED_EXPIRY_DAYS=180`)
- [ ] C4: wallet-service fails closed on Redis outage
- [ ] C4: payment-service fails closed on Redis outage
- [ ] C5: wallet-service uses single JWT_SECRET for user endpoints
- [ ] C5: requireMerchantAuth added for merchant wallet routes
- [ ] C6: blacklist key format standardized across all 4 files
- [ ] C7: CrossAppSyncService HTTP call implemented
- [ ] C7: Webhook registrations persisted to MongoDB
- [ ] C8: syncOrders and syncCashback return 501
- [ ] C1: merchant-service CoinTransaction schema has coinType, source, description
- [ ] M7: REWARD_BRANDED_EXPIRY_DAYS=180 set in all environments

---

## SPRINT 2 — CORE PRODUCT FIXES (Week 2, Days 4–8)

**Goal:** Restore broken merchant app features. All user-visible fixes.  
**Bugs:** H1, H2, H3, H4, H5, H12

---

### TASK 2.1 — Fix merchant wallet transaction list (H1)
**File:** `rez-wallet-service/src/routes/merchantWalletRoutes.ts` line 59  
**Time:** 30 min

Change the response envelope:
```typescript
// Before:
res.json({ success: true, data: result.transactions, pagination: result.pagination });

// After:
res.json({ 
  success: true, 
  data: { 
    transactions: result.transactions, 
    pagination: result.pagination 
  } 
});
```

**Test:** Open merchant app → Wallet → Transactions. Confirm list is populated. Check pagination works (scroll to bottom, confirm more items load).

---

### TASK 2.2 — Fix cashback approve/reject 404 (H2)
**File:** `rezbackend/rez-backend-master/src/routes/merchant/cashback.ts`  
**Time:** 1 hour

**Step 1 — Add the missing routes:**
```typescript
// Add after existing routes, before module.exports
router.put(
  '/:id/approve',
  merchantAuth,
  validateRequest(Joi.object({
    approvedAmount: Joi.number().positive().required(),
    paymentMethod: Joi.string().optional(),
    notes: Joi.string().optional()
  })),
  cashbackController.approveCashbackRequest
);

router.put(
  '/:id/reject',
  merchantAuth,
  validateRequest(Joi.object({
    rejectionReason: Joi.string().required(),
    notes: Joi.string().optional()
  })),
  cashbackController.rejectCashbackRequest
);
```

**Step 2 — Verify the controller functions exist:**
Check `rezbackend/src/controllers/cashbackController.ts` for `approveCashbackRequest` and `rejectCashbackRequest`. If they only exist in `merchantroutes/cashback.ts`, copy them to the controller file.

**Step 3 — Check which router is mounted in server.ts:**
If both `src/routes/merchant/cashback.ts` AND `src/merchantroutes/cashback.ts` are mounted at the same path, that causes conflicts. After adding routes to the new file, remove them from `merchantroutes/cashback.ts`.

**Test:** From merchant app, open a cashback request and click Approve. Confirm status changes to 'approved'. Repeat for Reject.

---

### TASK 2.3 — Fix bulk cashback field name (H3)
**File:** `rezbackend/rez-backend-master/src/routes/merchant/cashback.ts` line 147  
**Time:** 20 min

Change the Joi schema for bulk-action:
```typescript
// Change:
cashbackIds: Joi.array().items(Joi.string()).required()
// To:
requestIds: Joi.array().items(Joi.string()).required()
```

Also update the controller to use `requestIds` consistently:
```typescript
const { requestIds, action, approvedAmount, rejectionReason, paymentMethod, notes } = req.body;
```

Also update `src/merchantroutes/cashback.ts` line 381 to use `requestIds` (already does — just verify it matches).

**Test:** Select 3+ cashback requests. Click bulk approve. Confirm 200 response and all selected items are approved.

---

### TASK 2.4 — Fix cashback export method (H4)
**File:** `rezbackend/rez-backend-master/src/routes/merchant/cashback.ts` line 62  
**Time:** 20 min

Change:
```typescript
router.get('/export', merchantAuth, cashbackController.exportCashback);
// To:
router.post('/export', merchantAuth, cashbackController.exportCashback);
```

Also update `src/merchantroutes/cashback.ts` line 744:
```typescript
router.post('/export', ...);  // change from router.get
```

**Test:** Click the Export button in merchant cashback section. Confirm file download initiates (CSV/Excel depending on your format).

---

### TASK 2.5 — Fix payment method field name mismatch (H5)
**Files:** `rezbackend/src/routes/walletRoutes.ts`, `rez-payment-service/src/routes/paymentRoutes.ts`  
**Time:** 1 hour

**Step 1 — Create shared payment types in rez-shared:**
Create `packages/rez-shared/src/types/payment.ts`:
```typescript
export type PaymentMethod = 
  | 'cod' 
  | 'wallet' 
  | 'razorpay' 
  | 'upi' 
  | 'card' 
  | 'netbanking';

export interface PaymentInitiateDTO {
  paymentMethod: PaymentMethod;
  amount: number;
  currency?: string;
  orderId?: string;
  description?: string;
}
```

**Step 2 — Update monolith walletRoutes.ts (line 305):**
```typescript
// Add normalization at the top of the handler:
const paymentMethod = req.body.paymentMethod || req.body.paymentMethodType;
if (!paymentMethod) {
  return res.status(400).json({ error: 'paymentMethod is required' });
}
// Replace req.body.paymentMethodType usage with paymentMethod throughout the handler
```

**Step 3 — Update payment-service validation schema:**
Confirm it uses `paymentMethod` (it already does). Add `cod` and `razorpay` to the monolith's accepted values if they're missing.

**Test:** Initiate a payment from the frontend. Confirm the monolith and payment-service both process it without field validation errors.

---

### TASK 2.6 — Fix merchant web token storage (H12)
**File:** `rezmerchant/rez-merchant-master/services/storage.ts` line 15  
**Time:** 1 hour

Change the constant:
```typescript
// Before:
const COOKIE_AUTH_ENABLED = false;

// After:
const COOKIE_AUTH_ENABLED = typeof document !== 'undefined'; 
// true on web (uses cookies), false on native (uses SecureStore)
```

Update `client.ts` to ensure when cookie auth is enabled, it sets `withCredentials: true` on axios:
```typescript
if (COOKIE_AUTH_ENABLED) {
  axiosInstance.defaults.withCredentials = true;
  // Don't set Authorization header — cookie is sent automatically
} else {
  axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}
```

Update the backend middleware to extract tokens from cookies on merchant routes:
In `rezbackend/src/middleware/merchantauth.ts`, update `extractToken()`:
```typescript
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return req.cookies?.rez_merchant_token ?? null;
}
```

**Test:** Open merchant app on web browser. Log in. Open DevTools → Application → Cookies. Confirm `rez_merchant_token` is set as httpOnly. Confirm no token in localStorage.

---

### Sprint 2 Checklist
- [ ] H1: Merchant wallet transactions response envelope fixed
- [ ] H2: Cashback approve route added to primary router
- [ ] H2: Cashback reject route added to primary router
- [ ] H3: `requestIds` field name consistent across frontend + backend
- [ ] H4: Export route changed to POST in both backend router files
- [ ] H5: `paymentMethod` normalized in monolith, shared type created
- [ ] H12: Merchant web uses httpOnly cookies instead of localStorage

---

## SPRINT 3 — DATA INTEGRITY (Week 3, Days 9–13)

**Goal:** Fix structural data model issues. These require MongoDB migrations.  
**Bugs:** C2, H6, H7, H8, H11, H13

---

### TASK 3.1 — Standardize Wallet.currency to 'REZ_COIN' (H13)
**File:** `rezbackend/rez-backend-master/src/models/Wallet.ts` line 279  
**Time:** 30 min + migration

**Code change:**
```typescript
currency: {
  type: String,
  enum: ['REZ_COIN', 'NC', 'INR', 'RC'],  // keep 'RC' for backwards compat
  default: 'REZ_COIN'  // changed from 'RC'
}
```

**MongoDB migration:**
```javascript
db.wallets.updateMany(
  { currency: 'RC' },
  { $set: { currency: 'REZ_COIN' } }
);
// Verify:
db.wallets.countDocuments({ currency: 'RC' }); // should be 0
```

After 30 days, remove `'RC'` from the enum.

**Test:** Create a new wallet via the backend. Confirm `currency === 'REZ_COIN'`. Query by `currency: 'REZ_COIN'` — confirm existing wallets are found.

---

### TASK 3.2 — Add cashback + referral to LedgerEntry and Wallet enums (C2)
**Files:** 2 model files + 1 config file  
**Time:** 1 hour + reconciliation script

**File 1: `rezbackend/rez-backend-master/src/models/LedgerEntry.ts` (line 49):**
```typescript
// Before:
coinType: { type: String, enum: ['rez', 'promo', 'branded', 'prive'] }

// After:
coinType: { type: String, enum: ['rez', 'promo', 'branded', 'prive', 'cashback', 'referral'] }
```

**File 2: `rez-wallet-service/src/models/Wallet.ts` (line 60):**
```typescript
// coins[].type enum — add cashback and referral:
type: { type: String, enum: ['rez', 'prive', 'branded', 'promo', 'cashback', 'referral'] }
```

**File 3: `rezbackend/src/config/currencyRules.ts` — add missing types:**
```typescript
cashback: { priority: 0, expiryDays: 0, isTransferable: false, label: 'Cashback Coins' },
referral: { priority: 0, expiryDays: 90, isTransferable: false, label: 'Referral Coins' }
```

**Reconciliation script** — run after schema changes:
```javascript
// Find CoinTransaction docs with cashback/referral that have no LedgerEntry
const orphaned = await CoinTransaction.find({
  coinType: { $in: ['cashback', 'referral'] }
}).lean();

for (const txn of orphaned) {
  const ledgerExists = await LedgerEntry.exists({ 
    referenceId: txn._id.toString() 
  });
  if (!ledgerExists) {
    console.log('Missing ledger entry for:', txn._id, txn.coinType, txn.amount);
    // Create the missing LedgerEntry here
  }
}
```

**Test:** Credit a cashback coin transaction. Confirm a `LedgerEntry` with `coinType: 'cashback'` is created. Check `Wallet.coins[]` — confirm a `cashback` type bucket exists.

---

### TASK 3.3 — Fix merchant wallet uniqueness (H6)
**File:** `rez-merchant-service/src/models/MerchantWallet.ts`  
**Time:** 1 hour + migration

**Code change:**
```typescript
// Before (remove both of these):
merchant: { type: Schema.Types.Mixed }
merchantId: { type: Schema.Types.Mixed }

// After (only this):
merchant: { type: Schema.Types.ObjectId, ref: 'Merchant', required: true, unique: true }
```

Update all merchant-service code that references `merchantId` on the MerchantWallet model to use `merchant` instead.

**Migration — find and merge duplicates:**
```javascript
// Step 1: Find duplicates
const dupes = db.merchantwallets.aggregate([
  { $group: { _id: "$merchant", count: { $sum: 1 }, ids: { $push: "$_id" } } },
  { $match: { count: { $gt: 1 } } }
]).toArray();

// Step 2: For each set of duplicates, keep the oldest, merge balances
for (const dupe of dupes) {
  const wallets = db.merchantwallets.find({ _id: { $in: dupe.ids } })
                                    .sort({ createdAt: 1 }).toArray();
  const primary = wallets[0];
  const rest = wallets.slice(1);
  
  let totalBalance = primary.balance || 0;
  for (const w of rest) { totalBalance += (w.balance || 0); }
  
  db.merchantwallets.updateOne({ _id: primary._id }, { $set: { balance: totalBalance } });
  db.merchantwallets.deleteMany({ _id: { $in: rest.map(w => w._id) } });
}
```

**Test:** Create two merchants. Confirm each gets exactly one wallet. Try to create a duplicate wallet for a merchant → confirm unique index error is thrown.

---

### TASK 3.4 — Link the two Cashback collections (H7)
**Time:** 2 hours

This is a bridge solution until full unification can be done.

**Step 1 — Add cross-reference field to both models:**

In `rezbackend/src/models/Cashback.ts` (cashbackrequests collection), add:
```typescript
merchantCashbackId: { type: Schema.Types.ObjectId, ref: 'Cashback' }  // ref to cashbacks coll
```

In `rez-merchant-service/src/models/Cashback.ts` (cashbacks collection), add:
```typescript
cashbackRequestId: { type: Schema.Types.ObjectId }  // ref to cashbackrequests coll
```

**Step 2 — When merchant approves a cashback, emit an event to create the cashbackrequests record:**

In the merchant cashback approve handler, after saving to `cashbacks`:
```typescript
// Publish event via BullMQ
await cashbackQueue.add('merchantApproved', {
  merchantCashbackId: savedCashback._id,
  userId: savedCashback.userId,
  merchantId: savedCashback.merchantId,
  amount: savedCashback.approvedAmount,
  approvedAt: new Date()
});
```

In the backend, create a BullMQ worker that listens to `merchantApproved` and creates a `cashbackrequests` record with `merchantCashbackId` set.

**Step 3 — Reconciliation script for existing records:**
```javascript
// Match by merchantId + userId + amount + date within a 48-hour window
const merchantCashbacks = db.cashbacks.find({ cashbackRequestId: null }).toArray();
for (const mc of merchantCashbacks) {
  const match = db.cashbackrequests.findOne({
    merchant: mc.merchantId,
    user: mc.userId,
    'amount': mc.approvedAmount,
    createdAt: { 
      $gte: new Date(mc.createdAt - 48*60*60*1000),
      $lte: new Date(mc.createdAt + 48*60*60*1000)
    }
  });
  if (match) {
    db.cashbacks.updateOne({ _id: mc._id }, { $set: { cashbackRequestId: match._id } });
    db.cashbackrequests.updateOne({ _id: match._id }, { $set: { merchantCashbackId: mc._id } });
  }
}
```

**Test:** Approve a cashback in merchant app. Confirm a cashbackrequests record is created in backend DB with matching `merchantCashbackId`.

---

### TASK 3.5 — Fix UserLoyalty phantom balance (H8)
**File:** `rezbackend/rez-backend-master/src/models/Wallet.ts`  
**Time:** 1 hour

**Option A — Post-save hook (recommended for real-time accuracy):**
Add to the Wallet schema after all field definitions:
```typescript
WalletSchema.post('save', async function(wallet) {
  try {
    const UserLoyalty = mongoose.model('UserLoyalty');
    await UserLoyalty.findOneAndUpdate(
      { user: wallet.user },
      { $set: { 'coins.available': wallet.balance.available } },
      { upsert: false }  // don't create if not exists
    );
  } catch (err) {
    // Non-critical — log but don't fail the wallet save
    console.error('[Wallet] Failed to sync loyalty balance:', err);
  }
});
```

**Option B — Compute on-the-fly (cleaner architecture):**
In the loyalty query controller, instead of reading `UserLoyalty.coins.available`, query the wallet directly:
```typescript
const wallet = await Wallet.findOne({ user: userId }).select('balance.available');
const availableCoins = wallet?.balance?.available ?? 0;
```

Recommend Option B — removes the stale data problem permanently.

**Test:** Credit 100 coins to a user. Open loyalty dashboard. Confirm the displayed balance matches `Wallet.balance.available`.

---

### TASK 3.6 — Remove prive→rez normalization (H11)
**File:** `rezbackend/rez-backend-master/src/services/walletService.ts` lines 68–71  
**Time:** 30 min + migration

**Code change:**
```typescript
// Remove this line:
const coinType: LedgerCoinType = rawCoinType === 'prive' ? 'rez' : (rawCoinType as LedgerCoinType);

// Replace with:
const coinType: LedgerCoinType = rawCoinType as LedgerCoinType;
```

**Migration — reclassify misattributed ledger entries:**
```javascript
// Find LedgerEntry records that were written as 'rez' but came from prive CoinTransactions
const ledgerEntries = await LedgerEntry.find({ coinType: 'rez' });
for (const entry of ledgerEntries) {
  if (entry.referenceId) {
    const coinTxn = await CoinTransaction.findById(entry.referenceId);
    if (coinTxn?.coinType === 'prive') {
      await LedgerEntry.updateOne({ _id: entry._id }, { $set: { coinType: 'prive' } });
    }
  }
}
```

**Test:** Credit prive coins to a user. Check the `ledgerentries` collection. Confirm `coinType === 'prive'` (not `'rez'`).

---

### Sprint 3 Checklist
- [ ] H13: `Wallet.currency` default is `'REZ_COIN'`, MongoDB migration run
- [ ] C2: `cashback` and `referral` added to LedgerEntry enum
- [ ] C2: `cashback` and `referral` added to Wallet.coins[].type enum
- [ ] C2: Added to currencyRules.ts with expiry/priority values
- [ ] C2: Reconciliation script run — missing ledger entries created
- [ ] H6: MerchantWallet uses `merchant: ObjectId` only
- [ ] H6: Duplicate wallet records merged via migration
- [ ] H7: Cross-reference fields added to both cashback collections
- [ ] H7: Event emitted on merchant approval → creates cashbackrequests record
- [ ] H7: Reconciliation script run for existing records
- [ ] H8: UserLoyalty.coins.available synced from Wallet or computed on-the-fly
- [ ] H11: prive→rez normalization removed
- [ ] H11: Migration run to reclassify misattributed ledger entries

---

## SPRINT 4 — BUSINESS LOGIC ALIGNMENT (Week 4, Days 14–18)

**Goal:** Consistent business rules across all services.  
**Bugs:** H9, H10, M1, M2, M8, M9

---

### TASK 4.1 — Create rez-shared timezone utilities (H10 prerequisite)
**File:** `packages/rez-shared/src/utils/timezone.ts`  
**Time:** 1 hour

```typescript
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

export function toISTDate(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

export function getISTDayStart(date: Date): Date {
  const ist = toISTDate(date);
  return new Date(Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate()
  ) - IST_OFFSET_MS);
}

export function getISTDateString(date: Date): string {
  const ist = toISTDate(date);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
}

export function isNextISTDay(earlier: Date, later: Date): boolean {
  const earlyStr = getISTDateString(earlier);
  const laterStr = getISTDateString(later);
  const earlyDate = new Date(earlyStr);
  const laterDate = new Date(laterStr);
  const diffDays = (laterDate.getTime() - earlyDate.getTime()) / (24 * 60 * 60 * 1000);
  return diffDays === 1;
}

export function isSameISTDay(a: Date, b: Date): boolean {
  return getISTDateString(a) === getISTDateString(b);
}
```

---

### TASK 4.2 — Unify streak milestone config (H9)
**File:** `packages/rez-shared/src/config/streakMilestones.ts`  
**Time:** 30 min

```typescript
export const STREAK_MILESTONES: Record<string, Array<{ days: number; coins: number }>> = {
  store_visit: [
    { days: 3,  coins: 50  },
    { days: 7,  coins: 200 },   // CANONICAL: 200 coins (not 150)
    { days: 14, coins: 350 },
    { days: 30, coins: 500 }
  ],
  login: [
    { days: 3,  coins: 50  },
    { days: 7,  coins: 200 },
    { days: 14, coins: 500 }
  ],
  order: [
    { days: 3,  coins: 75  },
    { days: 7,  coins: 250 },
    { days: 14, coins: 600 }
  ]
};
```

**Update `rezbackend/src/services/streakService.ts`:**
```typescript
import { STREAK_MILESTONES } from 'rez-shared/config/streakMilestones';
// Remove local STREAK_MILESTONES constant
```

**Update `rez-gamification-service/src/workers/storeVisitStreakWorker.ts`:**
```typescript
import { STREAK_MILESTONES } from 'rez-shared/config/streakMilestones';
// Remove local milestone array
const milestone = STREAK_MILESTONES.store_visit.find(m => m.days === currentStreak);
```

**Fix timezone while here (H10):**
```typescript
import { isNextISTDay, isSameISTDay } from 'rez-shared/utils/timezone';

// Replace:
const dayDiff = Math.floor((now - lastVisit) / (1000 * 60 * 60 * 24));

// With:
const isNext = isNextISTDay(lastVisit, now);
const isSame = isSameISTDay(lastVisit, now);
```

**Test:** Have a user check in at 11:30 PM IST. Then check in at 12:30 AM IST (next calendar day). Confirm streak increments. Check that 7-day streak pays exactly 200 coins (not 150 or 350).

---

### TASK 4.3 — Add debitInPriorityOrder to monolith (M8)
**File:** `rezbackend/rez-backend-master/src/services/walletService.ts`  
**Time:** 2 hours

Add the method:
```typescript
async debitInPriorityOrder(
  userId: string, 
  totalAmount: number, 
  description: string,
  orderId?: string
): Promise<{ debited: Array<{ coinType: string; amount: number }> }> {
  const PRIORITY_ORDER = ['promo', 'branded', 'prive', 'rez'];
  let remaining = totalAmount;
  const debited: Array<{ coinType: string; amount: number }> = [];

  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) throw new Error('Wallet not found');

  for (const coinType of PRIORITY_ORDER) {
    if (remaining <= 0) break;
    
    const bucket = wallet.coins.find(
      c => c.type === coinType && 
           c.amount > 0 && 
           (!c.expiryDate || c.expiryDate > new Date())
    );
    if (!bucket) continue;

    const deductAmount = Math.min(bucket.amount, remaining);
    await this.debitCoins(userId, deductAmount, coinType as any, description, orderId);
    debited.push({ coinType, amount: deductAmount });
    remaining -= deductAmount;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient coins. Short by ${remaining} coins.`);
  }

  return { debited };
}
```

**Find all calls to `deductCoins()` in the monolith that hardcode `coinType: 'rez'`:**
```bash
grep -rn "deductCoins\|debitCoins" rezbackend/rez-backend-master/src/ | grep -v "node_modules"
```

For each call site that hardcodes a coin type without a user-specific reason, replace with `debitInPriorityOrder()`.

**Test:** Give a user 100 promo coins and 200 rez coins. Make a payment of 80 coins. Confirm promo coins are debited first, not rez coins.

---

### TASK 4.4 — Build coin expiry job (M1)
**File:** `rezbackend/rez-backend-master/src/jobs/expireCoins.ts` (new file)  
**Time:** 3 hours

```typescript
import { Wallet } from '../models/Wallet';
import { ledgerService } from '../services/ledgerService';
import { notificationService } from '../services/notificationService';

const EXPIRED_POOL_ACCOUNT = '000000000000000000000003';
const WARNING_DAYS_BEFORE = 7;

export async function runCoinExpiryJob(): Promise<void> {
  const now = new Date();
  const warningThreshold = new Date(now.getTime() + WARNING_DAYS_BEFORE * 24 * 60 * 60 * 1000);

  // 1. Expire coins that are past their expiry date
  const walletsWithExpired = await Wallet.find({
    'coins': { $elemMatch: { expiryDate: { $lt: now }, amount: { $gt: 0 } } }
  });

  for (const wallet of walletsWithExpired) {
    for (const bucket of wallet.coins) {
      if (bucket.expiryDate && bucket.expiryDate < now && bucket.amount > 0) {
        const expiredAmount = bucket.amount;
        
        await ledgerService.transfer({
          from: wallet.user.toString(),
          to: EXPIRED_POOL_ACCOUNT,
          amount: expiredAmount,
          coinType: bucket.type,
          description: `Coin expiry: ${bucket.type}`,
          source: 'expiry'
        });

        bucket.amount = 0;
        
        await notificationService.send(wallet.user, {
          type: 'COINS_EXPIRED',
          title: 'Coins Expired',
          body: `${expiredAmount} ${bucket.type} coins have expired.`
        });
      }
    }
    await wallet.save();
  }

  // 2. Warn users about coins expiring in next 7 days
  const walletsExpiringSoon = await Wallet.find({
    'coins': { $elemMatch: { 
      expiryDate: { $gt: now, $lt: warningThreshold }, 
      amount: { $gt: 0 } 
    }}
  });

  for (const wallet of walletsExpiringSoon) {
    for (const bucket of wallet.coins) {
      if (bucket.expiryDate && bucket.expiryDate > now && bucket.expiryDate < warningThreshold) {
        const daysLeft = Math.ceil((bucket.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        await notificationService.send(wallet.user, {
          type: 'COINS_EXPIRING_SOON',
          title: 'Coins Expiring Soon',
          body: `${bucket.amount} ${bucket.type} coins expire in ${daysLeft} days. Use them before they're gone!`
        });
      }
    }
  }
}
```

**Schedule the job** — add to `rezbackend/src/jobs/scheduler.ts` (or create it):
```typescript
import cron from 'node-cron';
import { runCoinExpiryJob } from './expireCoins';

// Run at 00:30 IST every day (UTC 19:00 previous day = 00:30 IST)
cron.schedule('0 19 * * *', async () => {
  console.log('[CoinExpiry] Starting expiry job');
  await runCoinExpiryJob();
  console.log('[CoinExpiry] Job complete');
});
```

**Test:** Manually set a coin's `expiryDate` to 1 minute in the future. Wait 1 minute. Run the job manually. Confirm: coin bucket zeroed, LedgerEntry created with `to: expired_pool`, notification sent.

---

### TASK 4.5 — MongoDB migration for order status values (M2)
**Time:** 30 min (migration only, no code change)

```javascript
// Run on production MongoDB
use rezdb;

db.orders.updateMany({ status: 'pending' },   { $set: { status: 'placed' } });
db.orders.updateMany({ status: 'completed' }, { $set: { status: 'delivered' } });
db.orders.updateMany({ status: 'done' },      { $set: { status: 'delivered' } });
db.orders.updateMany({ status: 'rejected' },  { $set: { status: 'cancelled' } });

// Verify
db.orders.distinct('status');
// Should not contain: 'pending', 'completed', 'done', 'rejected'
```

After running: remove the legacy status mapper from the admin frontend (`rezadmin/rez-admin-main/constants/orderStatuses.ts`).

---

### TASK 4.6 — Centralize campaign eligibility (M9)
**File:** `rezbackend/rez-backend-master/src/services/campaignEligibilityService.ts` (new)  
**Time:** 2 hours

```typescript
export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export async function checkCampaignEligibility(
  userId: string, 
  campaignId: string
): Promise<EligibilityResult> {
  const [campaign, user, participation] = await Promise.all([
    Campaign.findById(campaignId),
    User.findById(userId).select('subscription tier city'),
    CampaignParticipation.findOne({ user: userId, campaign: campaignId })
  ]);

  if (!campaign) return { eligible: false, reason: 'Campaign not found' };
  if (!campaign.isActive) return { eligible: false, reason: 'Campaign not active' };
  
  const now = new Date();
  if (campaign.startsAt > now) return { eligible: false, reason: 'Campaign not started' };
  if (campaign.endsAt < now)   return { eligible: false, reason: 'Campaign ended' };
  
  if (campaign.targetCity && campaign.targetCity !== user?.city) {
    return { eligible: false, reason: 'Not in target city' };
  }
  
  if (campaign.requiredTier && user?.tier < campaign.requiredTier) {
    return { eligible: false, reason: 'Insufficient tier' };
  }
  
  if (campaign.maxParticipants) {
    const count = await CampaignParticipation.countDocuments({ campaign: campaignId });
    if (count >= campaign.maxParticipants) {
      return { eligible: false, reason: 'Campaign full' };
    }
  }
  
  if (participation) return { eligible: false, reason: 'Already participating' };

  return { eligible: true };
}
```

Update all campaign join endpoints to call this service.

---

### Sprint 4 Checklist
- [ ] rez-shared timezone utilities created and exported
- [ ] H9: STREAK_MILESTONES unified in rez-shared, both services import from it
- [ ] H10: storeVisitStreakWorker uses IST day boundaries
- [ ] M8: debitInPriorityOrder added to monolith, payment flows updated
- [ ] M1: expireCoins.ts job created, scheduled via cron
- [ ] M1: 7-day advance warning notification working
- [ ] M2: MongoDB order status migration run, legacy mapper removed
- [ ] M9: campaignEligibilityService created, campaign join handlers updated

---

## SPRINT 5 — CLEANUP & STRUCTURAL HARDENING (Week 5, Days 19–25)

**Goal:** Fix medium-severity issues, eliminate duplicate code, prevent regression.  
**Bugs:** M3, M4, M5, M6, M10 + architectural items

---

### TASK 5.1 — Fix getLastSyncDate to query MongoDB (M3)
**File:** `rezbackend/rez-backend-master/src/merchantservices/SyncService.ts` lines 167–170  
**Time:** 30 min

```typescript
async getLastSyncDate(type: string): Promise<Date | null> {
  const record = await SyncHistoryModel.findOne({ type })
    .sort({ completedAt: -1 })
    .select('completedAt')
    .lean();
  return record?.completedAt ?? null;
}
```

Update all callers of `getLastSyncDate()` to await the promise (it was previously synchronous).

---

### TASK 5.2 — Scope sync statistics to merchant (M4)
**File:** `rezbackend/rez-backend-master/src/merchantroutes/sync.ts` lines 188–204  
**Time:** 20 min

```typescript
router.get('/statistics', requireAuth, validateMerchantId, async (req, res) => {
  const merchantId = req.merchant._id;
  const stats = await SyncService.getSyncStatistics(merchantId);
  res.json({ success: true, data: stats });
});
```

Update `SyncService.getSyncStatistics()` to accept `merchantId` parameter and filter results.

---

### TASK 5.3 — Move MerchantLoyaltyConfig to rez-shared (M5)
**File:** `packages/rez-shared/src/models/MerchantLoyaltyConfig.ts` (new)  
**Time:** 1 hour

Copy the schema from either service (they're identical). Then:

In `rezbackend/src/models/MerchantLoyaltyConfig.ts`:
```typescript
// Replace entire file with:
export { MerchantLoyaltyConfig, MerchantLoyaltyConfigDocument } from 'rez-shared/models/MerchantLoyaltyConfig';
```

In `rez-merchant-service/src/models/MerchantLoyaltyConfig.ts`:
```typescript
// Replace entire file with:
export { MerchantLoyaltyConfig, MerchantLoyaltyConfigDocument } from 'rez-shared/models/MerchantLoyaltyConfig';
```

---

### TASK 5.4 — Migrate LoyaltyReward to ObjectId references (M6)
**File:** `rezbackend/rez-backend-master/src/models/LoyaltyReward.ts`  
**Time:** 2 hours + migration

**Code change:**
```typescript
// Before:
customerPhone: { type: String, required: true }
storeSlug: { type: String, required: true }

// After:
userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }
storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true }
// Keep for legacy lookup:
customerPhone: { type: String }  // optional, for migration reference only
storeSlug: { type: String }      // optional, for migration reference only
```

**Migration script:**
```javascript
const rewards = db.loyaltyrewards.find({ 
  userId: { $exists: false } 
}).toArray();

for (const reward of rewards) {
  const user = db.users.findOne({ phoneNumber: reward.customerPhone });
  const store = db.stores.findOne({ slug: reward.storeSlug });
  
  if (user && store) {
    db.loyaltyrewards.updateOne(
      { _id: reward._id },
      { $set: { userId: user._id, storeId: store._id } }
    );
  } else {
    console.log('Cannot migrate:', reward._id, reward.customerPhone, reward.storeSlug);
  }
}
```

---

### TASK 5.5 — Enable httpOnly cookie auth for merchant web (M10)
Already partially done in Task 2.6 (H12). Verify:
- Backend reads `req.cookies?.rez_merchant_token` on merchant routes
- Backend sets the cookie on login with `httpOnly: true, sameSite: 'strict', secure: true`
- Merchant web build has `withCredentials: true` on axios

**File:** `rezbackend/src/controllers/merchantAuthController.ts` — login handler:
```typescript
// Set cookie on successful login:
res.cookie('rez_merchant_token', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000  // 15 minutes
});
res.cookie('rez_merchant_refresh', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/merchant/auth/refresh',  // restrict to refresh endpoint only
  maxAge: 7 * 24 * 60 * 60 * 1000     // 7 days
});
```

---

### TASK 5.6 — Eliminate duplicate merchant routing layer
**Time:** 3 hours

The system has two parallel cashback route files:
- `src/routes/merchant/cashback.ts` (newer, Joi validation)
- `src/merchantroutes/cashback.ts` (older, less structured)

After Sprints 2–4 have moved all needed functionality into the new router:
1. Audit which routes still exist only in `merchantroutes/cashback.ts`
2. Port any remaining routes to `src/routes/merchant/cashback.ts`
3. In `server.ts`, remove the mount point for `merchantroutes/cashback.ts`
4. Delete `merchantroutes/cashback.ts`
5. Repeat for other files in `merchantroutes/` that have counterparts in `routes/merchant/`

---

### Sprint 5 Checklist
- [ ] M3: getLastSyncDate queries MongoDB, not in-memory array
- [ ] M4: sync statistics scoped to authenticated merchant
- [ ] M5: MerchantLoyaltyConfig moved to rez-shared, both services re-export
- [ ] M6: LoyaltyReward migrated to userId/storeId ObjectIds
- [ ] M10: Merchant web uses httpOnly cookies end-to-end
- [ ] Duplicate merchantroutes/ layer eliminated

---

## FINAL VERIFICATION — After All Sprints

### Full regression test checklist

**Merchant App:**
- [ ] Login → stays logged in, refresh works
- [ ] Wallet transactions page → shows real data (H1)
- [ ] Cashback list → can approve single request (H2)
- [ ] Cashback list → can reject single request (H2)
- [ ] Cashback list → bulk approve 3 items (H3)
- [ ] Cashback → export to CSV/Excel (H4)
- [ ] Make a payment → completes without error (H5)
- [ ] Logout → old token rejected on next API call (C6)
- [ ] No tokens visible in browser localStorage (H12)

**Consumer App:**
- [ ] Order placed in consumer → status visible in merchant dashboard (C7)
- [ ] Coin balance shown on loyalty screen matches actual wallet (H8)
- [ ] 7-day streak → pays 200 coins (H9)
- [ ] Check-in at 12:30 AM IST → streak increments correctly (H10)
- [ ] Promo coins spent before REZ coins during checkout (M8)
- [ ] Coins near expiry → notification received 7 days before (M1)

**Admin App:**
- [ ] Order history shows all orders including pre-migration statuses (M2)
- [ ] Merchant statistics shows only that merchant's data (M4)

**Security:**
- [ ] POST /api/sync/orders → 501 Not Implemented (C8)
- [ ] POST /api/sync/cashback → 501 Not Implemented (C8)
- [ ] Merchant JWT rejected by user wallet endpoints (C5)
- [ ] Redis killed → wallet API returns 503 in production (C4)
- [ ] Expired merchant token rejected by wallet-service (C6)

**Data integrity:**
- [ ] New CoinTransaction via merchant-service has coinType, source, description (C1)
- [ ] Cashback coin credit → LedgerEntry created with coinType: 'cashback' (C2)
- [ ] Referral coin credit → LedgerEntry created with coinType: 'referral' (C2)
- [ ] Prive coin credit → LedgerEntry shows 'prive' not 'rez' (H11)
- [ ] New wallet created → currency is 'REZ_COIN' (H13)
- [ ] Merchant wallet → no duplicate wallets for same merchant (H6)
- [ ] REZ coins have no expiry date (C3)
- [ ] Branded coins have 180-day expiry (M7)

---

## Bug Status Tracker

| Bug | Sprint | Status | Fixed In |
|-----|--------|--------|----------|
| C1 | 1 | Open | — |
| C2 | 3 | Open | — |
| C3 | 0 | Open | — |
| C4 | 1 | Open | — |
| C5 | 1 | Open | — |
| C6 | 1 | Open | — |
| C7 | 1 | Open | — |
| C8 | 1 | Open | — |
| H1 | 2 | Open | — |
| H2 | 2 | Open | — |
| H3 | 2 | Open | — |
| H4 | 2 | Open | — |
| H5 | 2 | Open | — |
| H6 | 3 | Open | — |
| H7 | 3 | Open | — |
| H8 | 3 | Open | — |
| H9 | 4 | Open | — |
| H10 | 4 | Open | — |
| H11 | 3 | Open | — |
| H12 | 2 | Open | — |
| H13 | 3 | Open | — |
| M1 | 4 | Open | — |
| M2 | 4 | Open | — |
| M3 | 5 | Open | — |
| M4 | 5 | Open | — |
| M5 | 5 | Open | — |
| M6 | 5 | Open | — |
| M7 | 0 | Open | — |
| M8 | 4 | Open | — |
| M9 | 4 | Open | — |
| M10 | 5 | Open | — |

Update "Status" to `In Progress` / `Done` and fill in commit hash as each bug is fixed.
