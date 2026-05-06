# ReZ Platform — Unified 100% Fix Plan
## All Audits · All Codebases · One Plan

**Generated:** 2026-04-17
**Scope:** 2,726 unique bugs across 18 audit generations, 15+ codebases (verified 2026-04-17)
**Status:** IN PROGRESS — P0 type/CRITICAL/HIGH fixes complete (16 issues fixed 2026-04-17). AdBazaar P0 security fixes complete (AB-C1, AB-C2, AB-C3, AB-C4, AB-C5 fixed 2026-04-17). Consumer wallet idempotency complete (7 mutations fixed 2026-04-17).
**Approach:** Fix-by-pattern: one fix resolves N bugs. Root causes first.

---

## Executive Summary

| Phase | Strategy | Bugs Resolved | Est. Effort |
|-------|----------|--------------|-------------|
| **P0 — NOW** | Type canonicalization | ~400 | ~40h |
| **P1 — Week 1** | Financial atomicity + Security | ~250 | ~80h |
| **P2 — Week 2** | Per-app systematic cleanup | ~500 | ~120h |
| **P3 — Week 3-4** | Architecture enforcement | ~600 | ~150h |
| **P4 — Week 5-8** | Remaining fixes | ~800 | ~200h |
| **P5 — Ongoing** | Governance + Fitness Tests | ALL | ~40h |
| **TOTAL** | | **~2,726** | **~630h / ~16 weeks** |

**Key insight:** 80% of bugs come from 5 root diseases. Fix the diseases, not the symptoms.

---

## PHASE 0 — Type & Enum Canonicalization (~40h)

*One fix, resolves 100+ bugs. Highest leverage.*

---

### T-01: CoinType — Consolidate to 1 Definition

**Problem:** 7 definitions across 6 packages. Frontend has 4 values, backend has 6.

**Action:** Create canonical `CoinType` in `packages/shared-types/src/enums/coinType.ts`:
```typescript
// The ONE canonical CoinType
export const COIN_TYPE_VALUES = ['rez', 'prive', 'branded', 'promo', 'cashback', 'referral'] as const;
export type CoinType = (typeof COIN_TYPE_VALUES)[number];

// Normalize any legacy variant
export function normalizeCoinType(type: string): CoinType {
  const map: Record<string, CoinType> = {
    nuqta: 'rez', wasil_coins: 'rez', wasil_bonus: 'rez',
    earning: 'rez', promo: 'promo', branded: 'branded',
    prive: 'prive', cashback: 'cashback', referral: 'referral',
  };
  return map[type.toLowerCase()] ?? 'rez';
}
```

**Remove from:**
- `packages/rez-shared/src/constants/coins.ts` → import from shared-types
- `packages/shared-enums/src/index.ts` → import from shared-types
- `rez-shared/src/constants/coins.ts` → import from shared-types
- `rez-app-consumer/types/wallet.ts` → use canonical
- All other local definitions

**Resolves:** XF-11-H02, N-02, N-04, G-MA-L63, G-MA-L64, CS-T1, CS-T2, CS-E1

**Effort:** 8h

---

### T-02: PaymentStatus — Consolidate to 1 Definition

**Problem:** 5 definitions across services. Consumer uses 8 values, backend uses 11.

**Action:** Use `shared-types` 11-state FSM as canonical. Map consumer/merchant subsets:
```typescript
// packages/shared-types/src/enums/paymentStatus.ts
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  AUTHORIZED = 'authorized',
  COMPLETED = 'completed',  // consumer calls this 'paid'
  PAID = 'paid',
  PARTIALLY_REFUNDED = 'partially_refunded',
  REFUNDED = 'refunded',
  REFUND_INITIATED = 'refund_initiated',
  REFUND_PROCESSING = 'refund_processing',
  REFUND_FAILED = 'refund_failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

// Consumer alias
export type ConsumerPaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed';
```

**Resolves:** G-MA-L63, G-MA-L67, N-05, CS-E5, CS-E9, CS-E2

**Effort:** 6h

---

### T-03: normalizeCoinType — Single Implementation

**Problem:** 3 implementations with different fallback values ('rez' vs 'wasil_coins' vs 'earning').

**Action:** Keep one implementation in `packages/shared-types`. Remove from `shared-enums`, `rez-shared`.

**Resolves:** XF-11-H03

**Effort:** 2h

---

### T-04: OrderStatus — Verify & Lock

**Problem:** 5 definitions but all agree on 11 values. Minor ordering differences.

**Action:** Import from `shared-types` everywhere. Verify all 5 definitions match.

**Resolves:** G-MA-L64, CS-E3, CS-E4, CS-E7, CS-T5

**Effort:** 3h

---

### T-05: EarnRecordStatus — Verify Consistency

**Good news:** 3 definitions are already identical. Verify no drift.

**Resolves:** XF-11-M02

**Effort:** 1h

---

### T-06: Add ESLint Fitness Tests

**Action:** Add to `scripts/arch-fitness/`:

```bash
#!/bin/bash
# no-bespoke-enums.sh
# Fails if any file defines CoinType, PaymentStatus, OrderStatus locally
for type in CoinType PaymentStatus OrderStatus EarnRecordStatus; do
  count=$(grep -r "type $type" src/ --include="*.ts" | grep -v "shared-types" | wc -l)
  if [ $count -gt 0 ]; then
    echo "ERROR: $type defined outside shared-types"
    exit 1
  fi
done
```

**Resolves:** AF-1, AF-2, AF-3 (prevents future recurrence)

**Effort:** 3h

---

## PHASE 1 — Financial Atomicity + Security (~80h)

*Fix the bugs that drain wallets or expose data.*

---

### F-01: Karma Profile Race Condition (CRITICAL)

**File:** `rez-karma-service/src/services/earnRecordService.ts:280-318`
**Bug:** `profile.lifetimeKarma += karmaEarned` — non-atomic read-modify-write

**Fix:**
```typescript
// BEFORE (race condition):
const profile = await KarmaProfile.findById(profileId);
profile.lifetimeKarma += karmaEarned;
await profile.save();

// AFTER (atomic):
await KarmaProfile.updateOne(
  { _id: profileId },
  { $inc: { lifetimeKarma: karmaEarned, currentKarma: karmaEarned } }
);
```

**Resolves:** XF-11-C01 (CRITICAL)

**Effort:** 1h

---

### F-02: TOCTOU in getOrCreateProfile

**File:** `rez-karma-service/src/services/karmaService.ts:67-72`
**Bug:** Check-then-create race on concurrent calls

**Fix:**
```typescript
// Use upsert to atomically create-or-get
const profile = await KarmaProfile.findOneAndUpdate(
  { userId },
  { $setOnInsert: { userId, lifetimeKarma: 0, currentKarma: 0, createdAt: new Date() } },
  { upsert: true, new: true }
);
```

**Resolves:** XF-11-H01 (HIGH)

**Effort:** 1h

---

### F-03: Finance Service Auth Fail-Open

**File:** `rez-finance-service/src/auth.ts`
**Bug:** Auth falls through when Redis unavailable

**Fix:** Reject requests when Redis unavailable:
```typescript
try {
  const session = await redis.get(`session:${token}`);
} catch (err) {
  return res.status(503).json({ error: 'Auth unavailable' });
}
```

**Resolves:** XF-11-H04 (HIGH)

**Effort:** 2h

---

### F-05: Consumer App — Wallet Mutations Missing Idempotency Headers (CRITICAL)

**Files:** `rez-app-consumer/services/walletApi.ts`, `rez-app-consumer/services/priveApi.ts`, `rez-app-consumer/app/redeem-coins.tsx`, `rez-app-consumer/app/wallet/transfer.tsx`

**Bug:** 6 wallet mutation methods accept `idempotencyKey` but do not forward it as an HTTP header to the backend's Idempotency-Key middleware. 4 methods have no idempotency parameter at all. Network retries can cause double-debits.

**Fixes applied (2026-04-17):**
- `initiateTransfer`: Added `Idempotency-Key` header forwarding (was only in body)
- `sendGift`: Added `Idempotency-Key` header forwarding (was only in body)
- `redeemCoins`: Added `idempotencyKey` param + header (was absent)
- `claimGift`: Added `idempotencyKey` param + header (was absent)
- `purchaseGiftCard`: Added header forwarding (was only in body)
- `confirmTransfer`: Added `idempotencyKey` param + header (was absent)
- `redeem-coins.tsx`: Added idempotency key generation + passing
- `transfer.tsx`: Added idempotency key to both `confirmTransfer` calls
- `priveApi.redeemCoins`: Added header forwarding (was only in body)

**Pattern:** All wallet mutations now auto-generate a CSPRNG key via `generateIdempotencyKey()` (which uses `crypto.getRandomValues()` instead of `Math.random()`) and forward it as `Idempotency-Key` header. Callers pass the key to ensure retries use the same key.

**Effort:** 2h

---

### F-04: Merchant App — All Wallet Balance 100x Off

**File:** `app/payouts/index.tsx:276,281,284,402,406`
**Bug:** `formatRupees(walletData.balance.available * 100)` — double multiply

**Fix:** Remove `* 100` from all occurrences

**Resolves:** G-MA-C01 (CRITICAL — live fraud)

**Effort:** 1h

---

### F-05: Merchant App — IDOR Order Access (2 instances)

**Files:** `app/(dashboard)/orders/[id].tsx:117, G-MA-C15`
**Bug:** No merchant/store ownership check

**Fix:** After fetch, assert:
```typescript
if (order.storeId !== activeStore._id || order.merchantId !== merchantId) {
  router.replace('/403');
  return;
}
```

**Resolves:** G-MA-C05, G-MA-C15 (CRITICAL)

**Effort:** 2h

---

### F-06: Biometric Bypass on Unavailable Devices

**File:** `utils/biometric.ts:52-56`
**Bug:** Returns `success: true` when biometrics unavailable

**Fix:**
```typescript
if (!available) {
  return { success: false, reason: 'BIOMETRIC_UNAVAILABLE' };
}
```

**Resolves:** G-MA-C06 (CRITICAL)

**Effort:** 1h

---

### F-07: Coin Redemption Fire-and-Forget

**File:** `app/pos/index.tsx:693-702`
**Bug:** `apiClient.post(...).catch(() => {})` — no blocking, no retry

**Fix:**
```typescript
try {
  await apiClient.post('merchant/wallet/redeem-coins', { ... });
} catch (e) {
  Alert.alert('Coin redemption failed', 'Discount may not have applied. Contact support.');
  return; // block payment
}
```

**Resolves:** G-MA-C16 (CRITICAL)

**Effort:** 1h

---

### F-08: Double Coin Deduction + Offline Loss

**Files:** `app/pos/index.tsx:235-711`
**Bug:** Coin discount computed but never included in payload

**Fix:** Add `coinRedemption` to bill payload:
```typescript
const payload = {
  items, subtotal, discountAmount, paymentMethod, storeId,
  coinRedemption: coinDiscountApplied > 0 ? {
    amount: coinDiscountApplied,
    consumerId: consumerIdForCoins
  } : undefined,
  // ... rest
};
```

**Also fix:** `BillDataFields` interface in `offlinePOSQueue.ts` — add `coinDiscountApplied` and `consumerIdForCoins`.

**Resolves:** G-MA-C02, G-MA-C03, G-MA-C04 (CRITICAL)

**Effort:** 4h

---

### F-09: Offline Queue — Cart Cleared Before SQLite Confirms

**File:** `app/pos/index.tsx:658-675`
**Bug:** `setCart([])` called before `enqueueFullBill()` confirms

**Fix:** Wrap in try/catch:
```typescript
try {
  await posService.enqueueFullBill(...);
  setCart([]);
  showToast('Saved Offline');
} catch (err) {
  showAlert('Offline Save Failed', 'Bill could not be saved. Try again.');
}
```

**Resolves:** G-MA-C04

**Effort:** 1h

---

### F-10: Offline Queue — No Idempotency Key Before Insert

**File:** `services/offlinePOSQueue.ts:58-80`
**Bug:** `clientTxnId` assigned AFTER INSERT — crash between insert and assign

**Fix:** Generate ID BEFORE INSERT:
```typescript
const clientTxnId = generateTxnId();
billData.clientTxnId = clientTxnId;
db.runSync(
  'INSERT INTO pending_bills (store_id, client_txn_id, ...) VALUES (?, ?, ...)',
  [storeId, clientTxnId, ...]
);
```

**Resolves:** G-MA-C08 (CRITICAL — double-charge risk)

**Effort:** 1h

---

### F-11: Failed Offline Bills Silently Dropped After 5 Retries

**File:** `services/offlinePOSQueue.ts:260-263`
**Bug:** After 5 failures, bill marked as success and removed

**Fix:** Move to UNRECOVERABLE:
```typescript
if (bill.attempts >= 5) {
  await db.runSync(
    'UPDATE pending_bills SET status = ? WHERE id = ?',
    ['UNRECOVERABLE', bill.id]
  );
  notifyMerchant('Bill sync permanently failed. Contact support.');
}
```

**Resolves:** G-MA-C09 (CRITICAL)

**Effort:** 1h

---

### F-12: SocketContext — Non-Existent getSocket() Method

**File:** `contexts/SocketContext.tsx:112`
**Bug:** `ss.getSocket?.()` always returns undefined — ALL socket events dead

**Fix:** Add to `SocketService`:
```typescript
public getSocket(): Socket | null {
  return this.socket;
}

public async queueEvent(event: string, ...args: any[]): Promise<void> {
  const queued = { event, args, timestamp: Date.now(), id: uuid() };
  await AsyncStorage.setItem('socket_queue', JSON.stringify([...await this.getQueuedEvents(), queued]));
}
```

Then fix `SocketContext.emit`:
```typescript
const socket = socketService.getSocket();
if (!socket || !socketService.isConnected()) {
  await socketService.queueEvent(event, ...args);
}
```

**Resolves:** G-MA-C11, G-MA-C07, G-MA-C12 (CRITICAL)

**Effort:** 4h

---

### F-13: Offline Queue — Wrong API Paths

**File:** `services/offline.ts:332-387`
**Bug:** All offline actions route to `/api/products` instead of `/merchant/products`

**Fix:** Update all queue methods:
```typescript
// Before: endpoint: '/api/products'
// After:
return this.executeOfflineAction({ endpoint: '/merchant/products', method: 'POST', data });
```

**Resolves:** G-MA-C12 (CRITICAL)

**Effort:** 2h

---

### F-14: Cache Never Invalidated After Mutations

**File:** `services/offline.ts:69-387`
**Bug:** Mutate methods don't call `cacheData()` after sync

**Fix:** Add to each mutation:
```typescript
if (result.success) {
  await this.cacheData('products', await this.getCachedProducts());
}
```

**Resolves:** G-MA-C13 (CRITICAL)

**Effort:** 2h

---

### F-15: Pending Orders Tab Always Zero

**File:** `hooks/useOrdersDashboard.ts:222-240`
**Bug:** Filter uses `'pending'` but OrderStatus starts at `'placed'`

**Fix:**
```typescript
const filteredOrders = orders.filter(o =>
  activeFilter === 'pending' ? o.status === 'placed' : o.status === activeFilter
);
```

**Resolves:** G-MA-C14 (CRITICAL)

**Effort:** 1h

---

## PHASE 2 — Per-App Systematic Cleanup (~120h)

*Fix app-specific patterns in batches.*

---

### M-01: Merchant App — All `as any` Casts (Batch)

Files affected: `contexts/SocketContext.tsx`, `services/offline.ts`, `services/offlinePOSQueue.ts`, `services/api/orders.ts`, `services/api/settlements.ts`

**Pattern:** Replace `as any` with proper typed interfaces:
```typescript
// Define interfaces:
interface SocketServicePublic { getSocket(): Socket | null; isConnected(): boolean; }
interface OrderListResponse { total?: number; pagination?: { total?: number }; }

// Use:
const ss = socketService as SocketServicePublic;
```

**Resolves:** G-MA-L87, G-MA-L88, G-MA-L104, G-MA-L103

**Effort:** 8h

---

### M-02: Merchant App — All Empty Catch Blocks (Batch)

Pattern: Find all `} catch {}` patterns across merchant app:
```bash
grep -rn '} catch {}' services/ app/ --include="*.ts" --include="*.tsx"
```

Fix each with logging:
```typescript
} catch (error) {
  logger.warn('[MerchantApp] Operation failed', { error, context });
}
```

**Resolves:** G-MA-L66, G-MA-L70, G-MA-L83, G-MA-L84, G-MA-L85, G-MA-L86, G-MA-L94, G-MA-L95, G-MA-L106

**Effort:** 10h

---

### M-03: Merchant App — All `console.error` → Logger

```bash
grep -rn 'console.error' services/ app/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Replace with `logger.error()` from `rez-shared/telemetry`.

**Resolves:** G-MA-L106

**Effort:** 3h

---

### M-04: Merchant App — All `Math.random()` → UUID

```bash
grep -rn 'Math.random()' services/ app/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__
```

Replace with:
```typescript
import { v4 as uuidv4 } from 'uuid';
uuidv4(); // cryptographically random
```

**Resolves:** G-MA-L71, G-MA-L74, G-MA-L76, G-MA-L90, G-MA-L91, G-MA-L92

**Effort:** 5h

---

### M-05: Merchant App — All `Date.now()` for IDs → UUID

```bash
grep -rn 'Date.now()' services/offline.ts services/offlinePOSQueue.ts app/pos/
```

Replace idempotency keys:
```typescript
import { v4 as uuidv4 } from 'uuid';
idempotencyKey: uuidv4(),
```

**Resolves:** G-MA-H39, G-MA-L99, G-MA-L96

**Effort:** 4h

---

### M-06: Merchant App — Batch Sync Atomicity

**File:** `services/offlinePOSQueue.ts:232-275`
**Bug:** 25 of 50 bills removed on 26th failure → double-charge on retry

**Fix:** Sync one bill at a time with per-bill ACK:
```typescript
for (const bill of pendingBills) {
  try {
    const result = await syncBill(bill);
    if (result.success) {
      await db.runSync('DELETE FROM pending_bills WHERE id = ?', [bill.id]);
    } else {
      await db.runSync('UPDATE pending_bills SET attempts = attempts + 1 WHERE id = ?', [bill.id]);
    }
  } catch (err) {
    logger.error('Bill sync failed', { billId: bill.id, error: err });
  }
}
```

**Resolves:** G-MA-C10 (CRITICAL)

**Effort:** 3h

---

### M-07: Consumer App — Missing `homepage.types.ts`

**File:** `types/homepage.types.ts` (doesn't exist)
**Bug:** 19 imports fail

**Action:** Create `types/homepage.types.ts` with types expected by importing files. Search imports to determine what types are needed:
```bash
grep -r "from 'types/homepage.types'" --include="*.ts" --include="*.tsx"
```

**Resolves:** N-01 (CRITICAL — build blocker)

**Effort:** 2h

---

### M-08: Consumer App — AddressType Uppercase/Lowercase Mismatch

**File:** `types/profile.types.ts`, `screens/profile/AddressScreen.tsx`
**Bug:** Uses `'HOME'` but backend expects `'home'`

**Fix:** Normalize before API call:
```typescript
const normalized = addressType.toLowerCase() as AddressType;
// or change the enum to lowercase
```

**Resolves:** N-03 (HIGH)

**Effort:** 1h

---

### M-09: Consumer App — Double `/api` Prefix

**File:** `services/api/homepageApi.ts`, `services/api/activityFeedApi.ts`
**Bug:** Endpoints double-prefix with `/api`

**Fix:**
```typescript
// Before: `${API_BASE_URL}/api/activity/feed`
// After: `${API_BASE_URL}/activity/feed`
```

**Resolves:** N-07 (LOW)

**Effort:** 1h

---

## PHASE 3 — Architecture Enforcement (~150h)

*Build the systems that prevent future bugs.*

---

### A-01: Shared Types Package Enforcement

**Action:** Enforce at build time that no package defines canonical types locally:
1. Add `no-bespoke-enums.sh` to CI/CD pre-commit hook
2. Add `no-bespoke-idempotency.sh` to pre-commit
3. Add `no-as-any` ESLint rule: `{"rules": {"@typescript-eslint/no-explicit-any": "error"}}`
4. Add `no-console-log.sh` — enforce `rez-shared/telemetry` logger only

**Effort:** 12h

---

### A-02: React Query Cache Invalidation Patterns

**Files:** All apps with socket connections
**Bug:** Socket events fire but TanStack Query cache not invalidated

**Fix:** Create shared pattern:
```typescript
// hooks/useSocketWithQueryInvalidation.ts
export function useSocketWithQueryInvalidation() {
  const queryClient = useQueryClient();
  // On socket event, invalidate relevant queries:
  socketService.on('order:updated', (data) => {
    queryClient.invalidateQueries({ queryKey: ['orders', data.orderId] });
    queryClient.invalidateQueries({ queryKey: ['order', data.orderId] });
  });
}
```

**Effolves:** A10-C1, CS-E7, CS-E9, RZ-M-F1

**Effort:** 8h

---

### A-03: Redis-Based Rate Limiting (Replace In-Memory)

**Files:** `rez-app-consumer/src/services/rateLimiter.ts`, `rateLimitMiddleware.ts`, `requestLimiter.ts`

**Fix:** Use Redis with TTL:
```typescript
const key = `rate:${userId}:${endpoint}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 60);
if (count > limit) return 429;
```

**Resolves:** XF-11-M01 (MEDIUM)

**Effort:** 4h

---

### A-04: BullMQ Configuration Fixes

**Fix all BULL-00x patterns:**
- `BULL-001`: Change `removeOnComplete: true` → `false` and add manual cleanup
- `BULL-002`: Add `jobId` + `attempts` guard to coinExpiry loop
- `BULL-003-007`: Add distributed locks, removeOnComplete fixes, retry limits

**Effort:** 16h

---

### A-05: node-cron → BullMQ Migration

**Fix all CRON-00x patterns:**
- Replace `node-cron` with BullMQ scheduled jobs
- Add distributed lock via Redis `SET NX` pattern
- Remove all `onComplete` async fire-and-forget

**Effort:** 20h

---

### A-06: Token Expiry / Refresh Mechanism

**Files:** `contexts/AuthContext.tsx`, `authStore.ts`, `services/storage.ts`
**Bug:** No token refresh, `atob()` without verification

**Fix:**
1. Decode JWT `exp` field properly (verify with `jwt-decode` package)
2. Refresh token before expiry
3. Move tokens to SecureStore on mobile

**Effort:** 8h

---

## PHASE 4 — Remaining Fixes (~200h)

*Less systematic but important fixes by category.*

---

### R-01: Rendez App — 54 bugs

Priority order:
1. RZ-B-C1 (QR enumeration) — 1h
2. RZ-B-C2 (payment webhook race) — 2h
3. RZ-A-C1 (missing auth header on ALL 9 pages) — 4h
4. RZ-A-C2 (no middleware) — 2h
5. RZ-M-A6, A7 (scroll + pagination) — 2h
6. RZ-M-A8, A9, A10 (wrong navigation) — 1h
7. RZ-M-B5 (date format validation) — 1h
8. RZ-M-B8 (age field not sent) — 1h
9. RZ-B-B1 (blockUser no cascade) — 2h
10. RZ-B-B2 (referrer credit no lock) — 2h
11. Remaining ~42 bugs — ~35h

**Subtotal:** ~53h

---

### R-02: AdBazaar — 111 bugs

**COMPLETED:**
- AB-C1 (rez_user_id spoofing) — Fixed 2026-04-17. GET endpoint no longer accepts `rez_user_id` from URL. Coin credit now via authenticated POST endpoint at `POST /api/qr/scan/[slug]`. New `ScanPageClient.tsx` handles coin credit via browser session.
- AB-C2 (rate limiting) — Fixed 2026-04-17. In-memory sliding window rate limiter added to `middleware.ts`: 20 req/min per IP for `/api/qr/scan`, 100 req/min per IP for other `/api/` routes.
- AB-C3 (bank account exposure) — Fixed 2026-04-17. `GET /api/profile` and `PATCH /api/profile` now mask bank account numbers (`XXXX1234`) and IFSC codes.
- AB-C4 (no idempotency) — Fixed 2026-04-17. `POST /api/bookings` now reads `Idempotency-Key` header, checks for existing booking, and inserts `idempotency_key` column. Migration `supabase/migrations/009_add_booking_idempotency_key.sql` created.
- AB-C5 (payment amount verification) — Fixed 2026-04-17. `verify-payment/route.ts` now verifies `razorpay_amount` against booking amount in paise.

Priority:
1. ~~AB-C1 (rez_user_id spoofing)~~ — ✅ FIXED
2. ~~AB-C2 (rate limiting)~~ — ✅ FIXED
3. ~~AB-C4 (no idempotency)~~ — ✅ FIXED
4. ~~AB-C5 (payment verification)~~ — ✅ FIXED
5. AB2-C1-C6 (Round 2 criticals) — 8h
6. AB-B1 (visit bonus coins) — 1h
7. AB-B2 (hardcoded bonus pct) — 0.5h
8. AB-P1 (messages body/content mismatch) — 1h
9. AB-D1 (fire-and-forget notifications) — 2h
10. Remaining ~90 bugs — ~85h

**Subtotal:** ~97.5h

---

### R-03: Karma Service — 116 bugs

See existing `01-KARMA-SERVICE/SECURITY.md` + `BUSINESS-LOGIC.md` for full detail.

**Priority:**
1. G-KS-C1 (hardcoded QR secret) — 1h
2. G-KS-C2 (auth middleware trust) — 2h
3. G-KS-C4 (privilege escalation) — 2h
4. G-KS-C7 (idempotency collision) — 1h
5. Remaining ~110 bugs — ~75h

**Subtotal:** ~81h

---

### R-04: Admin App — 72 bugs

Priority:
1. A10-C3 (opposite query params) — 1h
2. A10-C5 (HMAC key name vs value) — 1h
3. A10-C6 (SSE no ownership) — 2h
4. A10-C7 (three color systems) — 4h
5. A10-C8 (Rs.0 refund) — 1h
6. A10-H9 (JWT alg:none) — 1h
7. A10-H12 (no idempotency) — 2h
8. Remaining ~62 bugs — ~55h

**Subtotal:** ~67h

---

### R-05: Vesper App — 21 bugs

Priority:
1. VS-C1 (jwt.verify no algorithms) — 1h
2. VS-C2 (OrderStatus mismatch) — 1h
3. VS-C3 (PaymentStatus mismatch) — 1h
4. Remaining ~18 bugs — ~14h

**Subtotal:** ~17h

---

### R-06: ReZ NoW — 139 bugs

See `10-REZ-NOW/08-REMEDIATION-PLAN.md` for full detail.

**Subtotal:** ~80h

---

### R-07: RestoPapa — 93 bugs

See `10-RESTOPAPA-AUDIT-2026/08-REMEDIATION-PLAN.md` for full detail.

**Subtotal:** ~95h

---

### R-08: Backend Deep Sweep — 160 bugs

Priority by category:
1. CRON-001 (node-cron no lock) — 3h
2. BULL-001-007 (BullMQ config) — 16h
3. CFG-001 (payment FSM duplicate) — 8h
4. CFG-002 (diamond tier typo) — 1h
5. ROUTE-001 (internal debit no allowlist) — 2h
6. ROUTE-002 (merchant JWT fallback) — 3h
7. DEEP-001 (ObjectId validation) — 2h
8. Remaining ~125 bugs — ~100h

**Subtotal:** ~135h

---

## PHASE 5 — Governance (~40h)

*Prevent future drift.*

---

### G-01: Arch Fitness Tests in CI/CD

Add to `.github/workflows/arch-fitness.yml`:
```yaml
- name: Run arch fitness tests
  run: |
    ./scripts/arch-fitness/no-bespoke-enums.sh
    ./scripts/arch-fitness/no-bespoke-idempotency.sh
    ./scripts/arch-fitness/no-as-any.sh
    ./scripts/arch-fitness/no-console-log.sh
    ./scripts/arch-fitness/no-math-random-for-ids.sh
```

**Effort:** 4h

---

### G-02: Burn-Down Dashboard Automation

Add `npm run burn-down` that parses all gap docs and generates metrics.

**Effort:** 8h

---

## Quick Wins — Under 30 Minutes Each

These can be fixed immediately without deep analysis:

| ID | Fix | Files | Est. |
|----|-----|-------|------|
| G-MA-C14 | Change `'pending'` filter to `'placed'` | useOrdersDashboard.ts | 15m |
| G-MA-L93 | Confirm sessionTimeout callback IS null-checked | sessionTimeout.ts:83 | 5m |
| N-06 | Remove dead `validateBatchResponse` call or use it | homepageApi.ts | 15m |
| G-MA-L15 | Add minimum session timeout guard | AuthContext.tsx | 10m |
| G-MA-L26 | Add NaN guard on item total | orders/[id].tsx:100 | 10m |
| G-MA-L27 | Add NaN guard in formatCurrency | orders/[id].tsx | 10m |
| G-MA-L89 | Guard avgOrdersPerCustomer division | customerInsights.ts | 10m |
| G-MA-L100 | Guard avgOrdersPerCustomer division | customerInsights.ts | 10m |
| G-MA-L38 | Extract magic numbers to constants | offline.ts, products.ts, offlinePOSQueue.ts | 30m |
| G-MA-L45 | Add pagination to POS catalog | app/pos/index.tsx | 30m |
| G-MA-L50 | Warn on excess discount | services/api/pos.ts | 15m |
| G-MA-L61 | Fix `??` vs `\|\|` on zero | services/api/dashboard.ts | 10m |
| G-MA-L71 | Replace Math.random() for variant IDs | utils/variantHelpers.ts | 15m |
| G-MA-L79 | Use jwtDecode instead of atob | AuthContext.tsx | 20m |
| G-MA-L84 | Replace empty catch with logging | services/offline.ts | 15m |
| G-MA-L98 | Validate MIME type on upload | services/api/onboarding.ts | 15m |
| N-07 | Remove double `/api` prefix | activityFeedApi.ts | 10m |
| XF-11-L02 | Replace Math.random() with crypto | redis.ts | 15m |

---

## Dependency Graph

```
Phase 0 (Types) ──┬──► Phase 1 (Financial) ──► Phase 2 (Per-App) ──► Phase 3 (Architecture) ──► Phase 4 (Remaining)
                  │         │
                  │         └──► Phase 5 (Governance) ←─┐
                  │                                       │
                  └───────────────────────────────────────┘
```

**Note:** Type canonicalization (Phase 0) should happen BEFORE all other phases, since it resolves foundational type mismatches that affect all downstream fixes.

---

## Verification Checklist

After each fix, verify:
- [ ] `npm run type-check` passes
- [ ] `npm run build` passes
- [ ] `npm run burn-down` — mark issue as FIXED in gap doc
- [ ] Run affected fitness tests: `scripts/arch-fitness/*.sh`
- [ ] Test on both iOS and Android (mobile apps)

---

## Status Tracker

| Phase | Description | Bugs | Completed | Remaining |
|-------|-------------|------|-----------|-----------|
| P0 | Type canonicalization | ~400 | 15 | ~385 |
| P1 | Financial + Security | ~250 | 5 | ~245 |
| P2 | Per-app systematic | ~500 | 0 | ~500 |
| P3 | Architecture | ~600 | 0 | ~600 |
| P4 | Remaining | ~800 | 0 | ~800 |
| P5 | Governance | ~40 | 0 | ~40 |

### Completed Fixes (2026-04-17)

**P0 — Consumer App CRITICAL:**
- NA-CRIT-03: `new Blob()` → `TextEncoder().encode().length` (cacheService.ts, billUploadAnalytics.ts)
- NA-CRIT-04: Created `types/unified/index.ts` + `types/unified/guards.ts`
- NA-CRIT-06: Added `showToast` import to checkout.tsx
- NA-CRIT-07: Added `isSubmittingRef` guard to bill-upload-enhanced.tsx
- NA-CRIT-08: Added `'paid'` terminal check + 5min timeout to paymentService.ts
- NA-CRIT-09: `Math.random()` → `crypto.randomUUID()` in 13 files
- NA-CRIT-10: Wired UPI payment to backend POST /store-payment/confirm
- NA-CRIT-11: Created `secureWalletStorage.ts` (SecureStore + XOR migration)

**P0 — Karma Service CRITICAL:**
- NA-CRIT-09 equivalent: `getKarmaBalance()` → `getRezCoinBalance()` + added `/api/karma/wallet/balance` + `/api/karma/wallet/transactions` routes

**P0 — Consumer App HIGH:**
- NA-HIGH-01: Removed `/ 10` factor from coin formula in rez-now checkout
- NA-HIGH-03: Same as NA-CRIT-09 equivalent (CoinType alignment)
- NA-HIGH-04: Added `Math.max(0)` floor guard to walletStore adjustBalance
- NA-HIGH-07: `Math.floor` → `Math.round` on 4 redemption cap calculations
- NA-HIGH-08: Removed hardcoded dayRewards fallback in gamificationApi.ts

**P0 — Additional:**
- NA2-CRIT-01: 5 `.catch(() => {})` → `logger.error()` in homepageDataService.ts
- QR-checkin: 2 silent catches → `logger.error()` in qr-checkin.tsx

**P0 — Type/Enum:**
- CoinType: Added `cashback`, `referral` to consumer app types + overlays

---

**Last Updated:** 2026-04-17
**Maintainer:** Architect-on-Call (weekly rotation)
**SLA:** CRITICAL within 1 week, HIGH within 2 weeks, all within 16 weeks
