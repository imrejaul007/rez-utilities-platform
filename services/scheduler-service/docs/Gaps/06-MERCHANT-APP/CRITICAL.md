# ReZ Merchant App — CRITICAL Issues

**Generated:** 2026-04-16 | **Severity:** CRITICAL | **Count:** 16 (+2 new from deep POS audit)

---

## G-MA-C01: Wallet Balance Display Off by 100x

**Status:** OPEN
**Risk Category:** Financial / Live Fraud
**Source:** payment-auditor

**File:** `app/payouts/index.tsx:276, 281, 284, 402, 406`

```tsx
<Text style={styles.balanceAmount}>
  {walletData ? formatRupees(walletData.balance.available * 100) : '—'}
</Text>
```

**Issue:** `formatRupees` divides by 100 to convert paise → rupees. But `balance.available` is already in rupees. The `* 100` cancels out the division, displaying the raw number. If backend sends Rs.5,000: shows ₹5,000. If backend sends 5,00,000 paise (Rs.5,000): shows ₹5,00,000 — a **100x inflation**.

**Impact:** Merchant sees ₹5,00,000 when they have ₹5,000. Requests ₹4,000 withdrawal → backend receives ₹4,00,000 debit (100x too much).

**Fix:** Remove `* 100` — change to `formatRupees(walletData.balance.available)`. Verify API unit first.

**Prevention:** Add unit annotation to `WalletBalance` type (`// in rupees`). Add integration test that verifies balance display matches API response.

---

## G-MA-C02: Double Coin Deduction — Customer Loses Discount

**Status:** OPEN
**Risk Category:** Financial / Business Logic
**Source:** payment-auditor

**File:** `app/pos/index.tsx:235 (def), 247 (compute), 711 (apply)`

```tsx
// Line 247: coinRedemption.discountApplied computed but NEVER in payload
const discountAmount = (discount || 0) + (discountPercent ? subtotal * ...) + (coinRedemption?.discountApplied || 0);

// Line 675-689: payload built — coinRedemption not included
const payload = { items, subtotal, discountAmount, paymentMethod, storeId, ... };

// Line 711: finalAmount subtracts coin discount from backend bill amount
const finalAmount = bill.amount - (coinDiscountApplied > 0 ? coinDiscountApplied : 0);
```

**Issue:** Backend creates bill at FULL `subtotal`. Frontend deducts `coinDiscountApplied` from displayed payment amount. Customer pays less, but coins were issued on the full amount. Merchant revenue leaks.

**Impact:** Coin over-issuance + merchant revenue loss. A customer redeeming Rs.100 on Rs.500 bill: backend bills Rs.500 (coins on Rs.500), customer pays Rs.400, but coin pool was charged for Rs.500.

**Fix:** Add `coinRedemption: { amount: coinDiscountApplied, consumerId: consumerIdForCoins }` to the payload sent to `merchant/pos/bill`. Backend must deduct coins from bill total, not just payment amount.

---

## G-MA-C03: Offline Bill Sync Loses Coin Discount Entirely

**Status:** OPEN
**Risk Category:** Financial / Offline
**Source:** payment-auditor, sync-auditor

**Files:**
- `app/pos/index.tsx:658-674` (enqueue)
- `services/offlinePOSQueue.ts:224-230` (BillDataFields interface)
- `services/offlinePOSQueue.ts:232-249` (sync)

```tsx
// app/pos/index.tsx:658
posService.enqueueFullBill(
  items, activeStore?._id, tableNumber || undefined,
  confirmedSplitCount > 1 ? confirmedSplitCount : undefined
);
// coinDiscountApplied and consumerIdForCoins NOT included
```

**Issue:** When billing offline, `coinDiscountApplied` and `consumerIdForCoins` are never stored in the offline queue. When `syncOfflineQueue` POSTs to `merchant/pos/offline-sync`, it has no coin data. Backend creates bill at full amount. Customer who applied Rs.200 discount is charged Rs.200 extra.

**Impact:** Silent overcharge with no recovery path. Customer charged full amount despite having redeemed coins.

**Fix:** Add `coinDiscountApplied: number` and `consumerIdForCoins: string | null` to `BillDataFields` interface. Store them in `enqueueFullBill()`. Include them in sync payload.

---

## G-MA-C04: Cart Cleared Before SQLite Confirms Write

**Status:** OPEN
**Risk Category:** Financial / Offline
**Source:** sync-auditor

**File:** `app/pos/index.tsx:658-675`

```tsx
// Line 658: enqueueBill called
posService.enqueueFullBill(...);

// Line 659: cart cleared immediately — BEFORE write confirms
setCart([]);
```

**Issue:** `enqueueFullBill()` wraps SQLite insert in try/catch that silently fails. If SQLite throws (disk full, DB locked), the bill is not stored but the cart IS cleared. Merchant sees "Saved Offline" but the bill is gone.

**Impact:** Lost sale, zero indication of failure.

**Fix:**
```tsx
try {
  await posService.enqueueFullBill(...);
  setCart([]);
  showToast('Saved Offline');
} catch (err) {
  showAlert('Offline Save Failed', 'Bill could not be saved. Please try again.');
  // DO NOT clear cart
}
```

---

## G-MA-C05: IDOR — Order Detail Without Store Ownership Check

**Status:** OPEN
**Risk Category:** Security / Authorization
**Source:** security-auditor

**File:** `app/(dashboard)/orders/[id].tsx:117`

```typescript
const data = await ordersService.getOrderById(id);
// id comes from useLocalSearchParams() — any string
// No verification that this order belongs to the authenticated merchant's store
```

**Issue:** Any authenticated merchant can request any order by ID. Backend must enforce ownership, but the client makes no attempt to validate store ownership before the API call.

**Impact:** Merchant A can view Merchant B's order details, customer info, payment data.

**Fix:** Attach `activeStore._id` to the request. Backend must cross-check that `order.storeId === merchant.storeId`. Add client-side guard:
```typescript
const order = await ordersService.getOrderById(id, activeStore._id);
if (order.storeId !== activeStore._id) {
  throw new Error('Unauthorized');
}
```

---

## G-MA-C06: Biometric Silently Bypasses on Unavailable Devices

**Status:** OPEN
**Risk Category:** Security / Authorization
**Source:** security-auditor

**File:** `utils/biometric.ts:52-56`

```typescript
export async function requireBiometric(reason: string): Promise<BiometricResult> {
  const available = await isBiometricAvailable();
  if (!available) {
    return { success: true }; // Silent allow-through
  }
  // ...
}
```

**Issue:** On devices without biometric hardware (older phones, some tablets), `requireBiometric()` silently returns `success: true` with no fallback. Physical access to a device without biometrics bypasses withdrawals, bank detail updates.

**Impact:** Anyone with physical device access can perform sensitive financial operations.

**Fix:**
```typescript
if (!available) {
  // Require PIN/password fallback, or flag device and require re-auth
  return { success: false, reason: 'BIOMETRIC_UNAVAILABLE' };
}
```

---

## G-MA-C07: Queued Socket Events Lost on App Crash

**Status:** OPEN
**Risk Category:** Data Loss / Real-Time
**Source:** sync-auditor

**File:** `contexts/SocketContext.tsx:110-126`

```typescript
const ss = socketService as any;
const socket = ss.getSocket?.(); // getSocket() doesn't exist!
if (!socket || !socketService.isConnected()) {
  ss.queueEvent(event, ...args); // stored in-memory only
}
```

**Issue:** `queueEvent()` stores events in memory (socketService singleton). If app crashes while offline, all queued emit events (order status updates, cashback approvals) are permanently lost.

**Impact:** Critical actions submitted while socket was temporarily disconnected are silently dropped. No recovery.

**Fix:** Persist queued events to AsyncStorage:
```typescript
async queueEvent(event: string, ...args: any[]) {
  const queued = { event, args, timestamp: Date.now(), id: uuid() };
  await AsyncStorage.setItem('socket_queue', JSON.stringify([...await this.getQueuedEvents(), queued]));
}
// On reconnect: replay all queued events
```

---

## G-MA-C08: Offline Queue No Idempotency — Double-Charge Risk

**Status:** OPEN
**Risk Category:** Financial / Offline
**Source:** sync-auditor, payment-auditor

**File:** `services/offlinePOSQueue.ts:58-80`

```typescript
// Line 74-80: clientTxnId assigned AFTER INSERT
const insertResult = db.runSync(
  'INSERT INTO pending_bills (store_id, bill_data, ...) VALUES (?, ?, ...)',
  [storeId, JSON.stringify(billData), ...]
);
// clientTxnId set here — AFTER the row is inserted
if (!billData.clientTxnId) {
  billData.clientTxnId = generateTxnId();
}
```

**Issue:** If app crashes between INSERT and `clientTxnId` assignment, bill stored without transaction ID. On sync, server sees `LEGACY-{id}`. Next crash recovery sends same bill with new ID. Server duplicate detection fails.

**Impact:** Double-charge on crash recovery.

**Fix:** Generate and assign `clientTxnId` BEFORE INSERT:
```typescript
const clientTxnId = generateTxnId();
billData.clientTxnId = clientTxnId;
const insertResult = db.runSync(
  'INSERT INTO pending_bills (store_id, client_txn_id, bill_data, ...) VALUES (?, ?, ?, ...)',
  [storeId, clientTxnId, JSON.stringify(billData), ...]
);
```

---

## G-MA-C09: Failed Offline Bills Silently Dropped After 5 Retries

**Status:** OPEN
**Risk Category:** Financial / Offline
**Source:** logic-auditor, sync-auditor

**File:** `services/offlinePOSQueue.ts:260-263`

```typescript
} else if (bill.attempts >= 5) {
  // Give up after 5 attempts
  markBillSuccess(bill.id!); // REMOVED from queue as if it succeeded
}
```

**Issue:** After 5 failed sync attempts, the bill is silently removed from the queue as if it succeeded. Merchant has zero record that the bill was lost.

**Impact:** Revenue loss with no indication.

**Fix:**
```typescript
if (bill.attempts >= 5) {
  // Move to dead letter / unrecoverable queue with user notification
  await db.runSync(
    'UPDATE pending_bills SET status = ? WHERE id = ?',
    ['UNRECOVERABLE', bill.id]
  );
  notifyMerchant('Unrecoverable bill: offline sync failed permanently');
}
```

---

## G-MA-C10: Batch Sync No Atomicity — Partial Failure

**Status:** OPEN
**Risk Category:** Financial / Offline
**Source:** sync-auditor

**File:** `services/offlinePOSQueue.ts:232-275`

```typescript
// Server processes 25 of 50 successfully
// Those 25 are REMOVED from queue
// 26th errors → remaining 25 not removed
// Next retry: all 50 sent again
```

**Issue:** No transactional safety. Server processes 25 bills → removed from queue → 26th errors → remaining bills stay. Next retry sends all 50 again. Relies entirely on server-side idempotency.

**Impact:** If server duplicate detection has a gap, double-charge occurs.

**Fix:** Either: (1) use per-bill acknowledgment and only remove each bill individually after server confirms, or (2) use server-side transaction with all-or-nothing batch, or (3) sync one bill at a time with individual ACK.

---

## G-MA-C11: SocketContext.emit Calls Non-Existent Method — All Real-Time Dead

**Status:** OPEN
**Risk Category:** Functional / Real-Time
**Source:** api-auditor

**File:** `contexts/SocketContext.tsx:112-126`

```typescript
const ss = socketService as any;
const socket = ss.getSocket?.(); // getSocket() does NOT exist on SocketService
if (!socket || !socketService.isConnected()) {
  ss.queueEvent(event, ...args); // queueEvent also doesn't exist
}
```

**Issue:** `SocketService` has `getConnectionState()`, `isConnected()`, `getStats()`, `getSocketInternal()` (private). There is NO `getSocket()` public method. `ss.getSocket?.()` always returns `undefined`. Every `emit()` call routes to the fallback (queueEvent) which also doesn't exist. **No socket event has ever been emitted.**

**Impact:** All real-time features are dead code: order notifications, metrics updates, cashback alerts, product sync, waiter calls.

**Fix:**
```typescript
// Step 1: Add to SocketService
public getSocket(): Socket | null {
  return this.socket;
}

// Step 2: Add queueEvent to SocketService (with AsyncStorage persistence)
public async queueEvent(event: string, ...args: any[]): Promise<void> {
  // persist to AsyncStorage for crash recovery
}

// Step 3: Fix SocketContext.emit
const socket = socketService.getSocket();
```

---

## G-MA-C12: Offline Queue Routes to Wrong API Paths

**Status:** OPEN
**Risk Category:** API Contract / Offline
**Source:** api-auditor

**File:** `services/offline.ts:332-387`

```typescript
// queueProductCreate: '/api/products' → normalizeEndpoint strips → 'products'
// But backend uses: 'merchant/products'
// Result: routes to non-existent endpoint

queueOrderUpdate: '/api/orders' → 'orders' → not 'merchant/orders'
queueCashbackApproval: '/api/cashback/' → 'cashback/' → not 'merchant/cashback/'
```

**Issue:** All offline queue methods use `/api/` prefixed paths. Backend uses `merchant/*` routes. `normalizeEndpoint()` strips `/api/` but doesn't add `merchant/`. Every queued offline action silently fails.

**Impact:** All offline product/order/cashback actions are dead. Dead-letter queue fills with all of them.

**Fix:** Update all queue methods to use correct paths:
```typescript
// Before
async queueProductCreate(data: Product) {
  return this.executeOfflineAction({ endpoint: '/api/products', method: 'POST', data });
}
// After
return this.executeOfflineAction({ endpoint: '/merchant/products', method: 'POST', data });
```

---

## G-MA-C13: Cache Never Invalidated After Mutations

**Status:** OPEN
**Risk Category:** Data Sync / Offline
**Source:** api-auditor

**File:** `services/offline.ts:69-387`

```typescript
// cacheData() stores products, orders, cashback
async cacheData<T>(key: string, data: T) { ... }

// But queueProductCreate/Update/Delete and queueOrderUpdate
// do NOT call cacheData() after successful sync
// Offline cache always returns stale data
```

**Issue:** `cacheData()` stores data. Mutation methods (queueProductCreate, queueProductUpdate, queueProductDelete, queueOrderUpdate) never call `cacheData()` after a successful sync. After creating a product offline, syncing, and coming back online, `getCachedProducts()` still returns the old list.

**Impact:** Merchants see stale product/order lists after offline sync.

**Fix:** Call `cacheData()` after successful sync in each mutation method:
```typescript
async queueProductCreate(data: Product) {
  const result = await this.executeOfflineAction(...);
  if (result.success) {
    await this.cacheData('products', await this.getCachedProducts());
  }
  return result;
}
```

---

## G-MA-C14: Pending Orders Tab Always Shows Zero

**Status:** OPEN
**Risk Category:** Functional / Business Logic
**Source:** logic-auditor

**File:** `hooks/useOrdersDashboard.ts:222-240`

```typescript
const counts: Record<string, number> = {
  all: orders.length,
  pending: 0,    // ← NOT a valid OrderStatus value
  placed: 0,     // ← canonical starting state
  ...
};

// Filter: activeFilter === 'pending'
const filteredOrders = orders.filter(o => o.status === 'pending');
// matches NOTHING — OrderStatus uses 'placed' as initial state
```

**Issue:** The "pending" orders tab counts `orders.filter(o => o.status === 'pending')`. But `OrderStatus` enum never includes `'pending'` — the canonical starting state is `'placed'`. The filter matches zero orders.

**Impact:** Merchants cannot see orders in the "pending" state — the tab is permanently empty.

**Fix:**
```typescript
// Option 1: Change filter key from 'pending' to 'placed'
const counts: Record<string, number> = {
  all: orders.length,
  placed: 0,  // 'pending' tab now maps to 'placed'
  ...
};

// Option 2: Add 'pending' as alias for 'placed' in filter
const filteredOrders = orders.filter(o =>
  activeFilter === 'pending'
    ? o.status === 'placed'
    : o.status === activeFilter
);
```

---

## G-MA-C15: IDOR — Order Detail Exposes Any Merchant's Orders

**Status:** OPEN
**Risk Category:** Security / Data Leak
**Source:** Deep POS audit 2026-04-16

**File:** `app/(dashboard)/orders/[id].tsx`

**Code:**
```typescript
// Component fetches order by ID from URL params — NO ownership check:
const { data: order } = useQuery({
  queryKey: ['order', id],
  queryFn: () => ordersService.getOrderById(id),
});
```

**Issue:** The order detail page fetches `ordersService.getOrderById(id)` with only the order ID from the URL. There is no verification that the fetched order belongs to the currently authenticated merchant/store. If a merchant guesses or learns another merchant's order ID, they can view full order details (customer name, phone, address, items, payment info) at `/orders/{otherMerchantOrderId}`.

**Impact:** Customer PII (name, phone, address) exposed to unauthorized merchants. Violates GDPR/privacy requirements.

**Fix:** After fetching, assert `order.merchantId === currentMerchantId` and `order.storeId === currentStoreId`. Redirect or show 404 if ownership check fails:
```typescript
if (order.merchantId !== merchant.id) {
  router.replace('/403');
  return;
}
```

---

## G-MA-C16: Coin Redemption Fire-and-Forget — Discount Applied But Never Recorded

**Status:** OPEN
**Risk Category:** Financial / Data Integrity
**Source:** Deep POS audit 2026-04-16

**File:** `app/pos/index.tsx` (lines ~693-702)

**Code:**
```typescript
if (coinDiscountApplied > 0 && consumerIdForCoins) {
  apiClient
    .post('merchant/wallet/redeem-coins', { ... })
    .catch((e: any) => {
      if (__DEV__) console.warn('[POS] Coin redemption API call failed:', e);
    });
}
```

**Issue:** The coin redemption API is called without `await` and with only a `__DEV__` warning log. In production, if the call fails silently, the user sees their discount applied but the backend never records the redemption. Coins can be double-spent.

**Impact:** Financial data integrity failure. Coins can be redeemed without backend record. Revenue loss.

**Fix:** Await the call and make it a blocking part of the payment flow:
```typescript
try {
  await apiClient.post('merchant/wallet/redeem-coins', { ... });
} catch (e) {
  Alert.alert('Coin redemption failed', 'Your discount may not have applied. Please contact support.');
  return; // block payment until resolved
}
```
