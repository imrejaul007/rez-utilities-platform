# ReZ Merchant App — HIGH Severity Issues

**Generated:** 2026-04-16 | **Severity:** HIGH | **Count:** 38

---

## FINANCIAL (11 issues)

---

### G-MA-H01: No Amount Validation in withdrawal request

**Status:** OPEN
**File:** `services/api/wallet.ts:137`
**Source:** payment-auditor

```typescript
async requestWithdrawal(amount: number): Promise<...> {
  const response = await apiClient.post('merchant/wallet/withdraw', { amount });
  // No min/max/NaN/Infinity validation
}
```

**Fix:** Add validation: `amount > 0`, `amount <= availableBalance`, `amount <= maxWithdrawal`, `Number.isFinite(amount)`.

---

### G-MA-H02: Payment filter sends 'completed' instead of 'paid'

**Status:** OPEN
**File:** `app/(dashboard)/payments.tsx:21, 34, 46, 190`
**Source:** payment-auditor

```tsx
type StatusFilter = 'all' | 'completed' | 'failed'; // Line 21
// Backend PaymentStatus uses 'paid', not 'completed'
```

**Fix:** Change `StatusFilter` to `'all' | 'paid' | 'failed' | 'pending'`. Update UI labels.

---

### G-MA-H03: Cashback approval has no upper bound

**Status:** OPEN
**File:** `app/(cashback)/[id].tsx:54`
**Source:** payment-auditor, security-auditor

```typescript
const approvedAmount = parseFloat(customAmount);
if (isNaN(approvedAmount) || approvedAmount <= 0) {
  showAlert('Error', 'Please enter a valid amount'); return;
}
// NO upper bound check against request.requestedAmount
```

**Fix:** `if (approvedAmount > cashback.requestedAmount) { setError('Amount exceeds requested'); return; }`

---

### G-MA-H04: Inconsistent withdrawal unit — paise vs rupees

**Status:** OPEN
**File:** `services/api/wallet.ts:137` vs `app/payouts/index.tsx:241`
**Source:** payment-auditor

```typescript
// Payouts page: expects paise
apiClient.post('merchant/payouts/request', { amountPaise: Math.round(rupees * 100) });

// Wallet service: undocumented unit
apiClient.post('merchant/wallet/withdraw', { amount }); // No conversion
```

**Fix:** Normalize both to same unit. Document in `WalletTransaction` type. Add `amountPaise: number` annotation.

---

### G-MA-H05: Wallet balance unit unclear across services

**Status:** OPEN
**File:** `services/api/coins.ts:188`
**Source:** payment-auditor

```typescript
async getWalletBalance(): Promise<WalletBalanceResponse> {
  // Returns { available: number, total: number } — what unit?
}
```

**Fix:** Add `unit: 'rupees' | 'paise' | 'coins'` field to `WalletBalanceResponse`. Or use `amountPaise: number`.

---

### G-MA-H06: Discount percentage not capped at 100%

**Status:** OPEN
**File:** `services/api/pos.ts:200-220`
**Source:** logic-auditor

```typescript
if (discountPercent > 0) {
  total = subtotal * (1 - discountPercent / 100);
}
// If discountPercent=120%: total = subtotal * (1 - 1.2) = negative
// Math.max only guards fixed discount, not percentage
```

**Fix:** Add validation: `if (discountPercent > 100) discountPercent = 100`.

---

### G-MA-H07: Coin award — no integer/zero check

**Status:** OPEN
**File:** `app/(dashboard)/coins.tsx:156-165`
**Source:** security-auditor, payment-auditor

```typescript
const amount = parseInt(coinAmount);
if (isNaN(amount) || amount <= 0) { showAlert('Invalid Amount'); return; }
// Only checks: > 0, <= 1000 max
// No check: fractional amounts (parseInt('5.5') = 5), explicit 0 (parseInt('0') = 0)
// 0 is <= 0 → blocked, but parseInt('0') === 0, parseFloat('0.0') === 0 → parseInt('0') IS 0 → blocked
// Actually: parseInt('0') = 0, 0 <= 0 is true → blocked. parseFloat('0.5') = 0.5, 0.5 <= 0 is false → ALLOWED
```

**Fix:** `if (!Number.isInteger(amount) || amount <= 0 || amount > maxCoinsPerAward)`

---

### G-MA-H08: Withdrawal zero-padding bypass

**Status:** OPEN
**File:** `app/(dashboard)/wallet.tsx:501-518`
**Source:** security-auditor

```typescript
const amount = parseFloat(withdrawAmount);
if (isNaN(amount) || amount <= 0) { showAlert('Invalid Amount'); return; }
// "000.01" → 0.01 → allowed if minWithdrawalAmount is 0
```

**Fix:** `if (amount < minWithdrawalAmount) { ... }` with non-zero `minWithdrawalAmount`.

---

### G-MA-H09: isNaN fails on Infinity in payment validation

**Status:** OPEN
**File:** `utils/paymentValidation.ts:96`
**Source:** payment-auditor

```typescript
if (typeof amount !== 'number' || isNaN(amount)) { ... }
// isNaN(Infinity) === false — Infinity passes validation
```

**Fix:** Replace with `Number.isFinite(amount)`.

---

### G-MA-H10: SKU validation fail-open allows duplicates

**Status:** OPEN
**File:** `services/api/products.ts:911-916`
**Source:** logic-auditor

```typescript
} catch (error) {
  // If we can't validate, assume it's available to avoid blocking
  return { isAvailable: true, message: 'Could not validate SKU uniqueness' };
}
// Unreachable server → duplicates allowed
```

**Fix:** Return `{ isAvailable: false, message: 'Could not validate SKU — please try again' }` on network error.

---

### G-MA-H11: Offline sync timeout silently ignored

**Status:** OPEN
**File:** `services/offline.ts:255`
**Source:** logic-auditor

```typescript
executeOfflineAction() sends config.timeout: 10000 directly to apiClient.post()
// axios doesn't accept raw timeout in that position — ignored
```

**Fix:** Configure timeout via axios defaults or use `AbortSignal.timeout(10000)`.

---

## DATA SYNC & REAL-TIME (10 issues)

---

### G-MA-H12: Ping interval accumulates on every reconnect

**Status:** OPEN
**File:** `services/api/socket.ts:597, 121-124`
**Source:** sync-auditor

```typescript
// startPingInterval() called on every 'connect' event
// stopPingInterval() called only on 'disconnect'
// On reconnect: new interval starts without stopping the old one
// With reconnectionAttempts: 5 → up to 6 concurrent intervals
```

**Fix:** Stop existing interval before starting a new one:
```typescript
this.stopPingInterval(); // add this before startPingInterval()
this.startPingInterval();
```

---

### G-MA-H13: Socket 'reconnecting' state never shown in UI

**Status:** OPEN
**File:** `services/api/socket.ts:162`
**Source:** sync-auditor

```typescript
// reconnect_attempt handler sets connectionState = 'reconnecting'
// but emits on 'reconnecting' event, not 'connection-status'
// SocketContext listens only on 'connection-status'
// UI never shows "Reconnecting..." state
```

**Fix:** Emit `'reconnecting'` also as `'connection-status'`:
```typescript
this.emitToListeners('connection-status', 'reconnecting');
```

---

### G-MA-H14: Socket subscriptions not restored after reconnect

**Status:** OPEN
**File:** `services/api/socket.ts:153`
**Source:** sync-auditor, api-auditor

```typescript
// On reconnect: only joinMerchantDashboard() called
// subscribeToMetrics, subscribeToOrders, subscribeToCashback, subscribeToProducts
// are NOT re-established
```

**Fix:** Re-subscribe on reconnect:
```typescript
socket.on('reconnect', async () => {
  await this.rejoinMerchantDashboard();
  await this.replayBufferedOrderEvents();
  this.resubscribeAll(); // new method: re-subscribe to all event channels
});
```

---

### G-MA-H15: Socket gives up after 5 reconnects silently

**Status:** OPEN
**File:** `services/api/socket.ts:66`
**Source:** sync-auditor

```typescript
reconnectionAttempts: 5 // stops trying silently
// connectionState may be 'error' but UI shows only isConnected: false
// No distinction between "never connected" and "permanently failed"
```

**Fix:** Show explicit "Connection Failed" state with retry button. Emit `'connection-failed'` event to SocketContext.

---

### G-MA-H16: No duplicate detection in offline queue

**Status:** OPEN
**File:** `services/offline.ts:124-157`, `app/pos/offline.tsx:176`
**Source:** sync-auditor

```typescript
// queueOfflineAction generates idempotency key from timestamp+sequence
// No check whether identical action already exists in queue
// Double-tap "Approve Cashback" → two identical actions queued
```

**Fix:** Before enqueueing, check for duplicate:
```typescript
const existing = queue.find(a =>
  a.endpoint === endpoint && JSON.stringify(a.data) === JSON.stringify(data)
);
if (existing) return { success: false, reason: 'Duplicate action already queued' };
```

---

### G-MA-H17: Dead letter queue unbounded

**Status:** OPEN
**File:** `services/offline.ts:42, 185-190`
**Source:** sync-auditor

```typescript
MAX_DEAD_LETTER_LENGTH = 1000 // stores full request payloads
// Each failed action can be several KB
// 7-day TTL purge → recent 1000 entries persist indefinitely
```

**Fix:** Add size cap with oldest-removal: `if (deadLetter.length >= 1000) deadLetter.shift()`.

---

### G-MA-H18: refreshPermissions dedup flag never resets on logout

**Status:** OPEN
**File:** `contexts/AuthContext.tsx:177-201`
**Source:** api-auditor

```typescript
// isRefreshingPermissionsRef set to true during refresh
// finally block sets it to false
// If logout() called mid-refresh → finally never runs
// After re-login: refreshPermissions returns immediately, permissions never refreshed
```

**Fix:** Reset in logout handler:
```typescript
logout: () => {
  isRefreshingPermissionsRef.current = false; // add this
  ...
}
```

---

### G-MA-H19: joinMerchantDashboard silently swallows errors

**Status:** OPEN
**File:** `services/api/socket.ts:134`
**Source:** api-auditor

```typescript
this.joinMerchantDashboard().catch(() => {}); // Silent failure
// Merchant silently fails to rejoin dashboard room on every reconnect
```

**Fix:** Log and notify:
```typescript
this.joinMerchantDashboard().catch((err) => {
  console.error('[Socket] Dashboard join failed:', err);
  this.emitToListeners('connection-error', 'Failed to join merchant dashboard');
});
```

---

### G-MA-H20: Buffering flag not cleared on subsequent reconnects

**Status:** OPEN
**File:** `services/api/orderQueue.ts:35`
**Source:** sync-auditor

```typescript
// clear() called on first connect only (hasConnectedBefore guard)
// On subsequent reconnects, hasConnectedBefore is true → clear() NOT called
// isBuffering remains true until next NetInfo poll
```

**Fix:** Always clear on reconnect:
```typescript
socket.on('reconnect', () => {
  this.isBuffering = false;
  // ... rest of reconnect logic
});
```

---

### G-MA-H21: Sync triggered without internet reachability check

**Status:** OPEN
**File:** `hooks/useNetworkStatus.ts:139`
**Source:** sync-auditor

```typescript
triggerSync() checks isConnected but syncOfflineActions() makes HTTP requests
// Wi-Fi with captive portal: isConnected=true, isInternetReachable=false
// sync proceeds and guaranteed to fail
```

**Fix:** Check both:
```typescript
if (networkStatus.isConnected && networkStatus.isInternetReachable) {
  triggerSync();
}
```

---

## API CONTRACT (6 issues)

---

### G-MA-H22: updateOrderStatus type mismatch — two incompatible Order interfaces

**Status:** OPEN
**File:** `services/api/orders.ts:240`
**Source:** api-auditor

```typescript
// types/api.ts Order expects paymentStatus: PaymentStatus (required, 8 values)
// types/orders.ts Order requires paymentMethod: PaymentMethod (required) and paymentStatus
// The two interfaces are incompatible on required vs optional fields
```

**Fix:** Unify `Order` interface in `types/api.ts`. Remove `types/orders.ts` duplicate. Export from shared types.

---

### G-MA-H23: updateProfile name mapping — stored user has name: undefined

**Status:** OPEN
**File:** `services/api/auth.ts:183-185`
**Source:** api-auditor

```typescript
const { name, ...rest } = updates as any;
const payload = { ...rest, ...(name !== undefined ? { ownerName: name } : {}) };
// Sends ownerName to backend
// Response User object uses 'name' but never populates it from response
// After profile update: stored user.name === undefined
```

**Fix:** After successful update, merge response:
```typescript
const updated = await apiClient.put<User>('merchant/profile', payload);
dispatch({ type: 'UPDATE_USER', payload: { ...user, name: updated.data.name || updated.data.ownerName } });
```

---

### G-MA-H24: socialMediaService accesses response.data.post — likely undefined

**Status:** OPEN
**File:** `services/api/socialMedia.ts:105-117`
**Source:** api-auditor

```typescript
if (response.success && response.data) {
  return response.data.post; // Backend likely returns data directly
  // response.data is SocialMediaPost, not { post: SocialMediaPost }
}
```

**Fix:** `return response.data;` (assuming backend returns `SocialMediaPost` directly).

---

### G-MA-H25: Export/import bypass apiClient — no token refresh, no CSRF

**Status:** OPEN
**File:** `services/api/products.ts:375-382, 427-434`
**Source:** api-auditor

```typescript
// Uses raw fetch() with buildApiUrl() instead of apiClient
// Bypasses axios interceptor chain: token refresh, CSRF headers, device fingerprint
```

**Fix:** Use `apiClient.get()` with responseType: 'blob' for exports. Use FormData for imports via apiClient.

---

### G-MA-H26: getVisitStats throws instead of returning safe fallback

**Status:** OPEN
**File:** `services/api/storeVisits.ts:79-93`
**Source:** api-auditor

```typescript
if (response.success && response.data) {
  return response.data;
}
throw new Error(response.error || 'Failed to get visit stats');
// Unlike coinsService.getStats which returns fallback on error
```

**Fix:** Return safe fallback:
```typescript
return { totalVisits: 0, uniqueVisitors: 0, avgSessionDuration: 0, ... };
```

---

### G-MA-H27: storeId query param defined but never sent in order search

**Status:** OPEN
**File:** `services/api/orders.ts:104-109`
**Source:** api-auditor

```typescript
OrderSearchParams defines storeId?: string
// but getOrders() never appends storeId to URLSearchParams
// Multi-store merchants cannot filter orders by store
```

**Fix:** Append `storeId` to params:
```typescript
if (params.storeId) params.append('storeId', params.storeId);
```

---

## BUSINESS LOGIC & ENUM (11 issues)

---

### G-MA-H28: OrderStatus duplicated across 4+ files with DIFFERENT values

**Status:** OPEN
**Files:** `types/api.ts`, `types/dashboard.ts`, `shared/type.ts`, `app/orders/live.tsx`, `app/(dashboard)/aggregator-orders.tsx`, `app/kds/rez-now-orders.tsx`, `app/kds/index.tsx`
**Source:** logic-auditor

| Location | Statuses |
|----------|---------|
| `types/api.ts` (canonical) | placed, confirmed, preparing, ready, out_for_delivery, delivered, cancelled, cancelling, refunded |
| `app/orders/live.tsx` | pending, confirmed, preparing, ready, dispatched, delivered, cancelled, returned — **MISSING placed** |
| `aggregator-orders.tsx` | pending, accepted, preparing, ready, picked_up, delivered, cancelled — **DIFFERENT set** |
| `app/kds/index.tsx` | new, preparing, ready — **SHORT list** |

**Fix:** Create `shared/constants/orderStatus.ts` with canonical values. All other files import from here.

---

### G-MA-H29: PaymentStatus wrong whitelist in paymentValidation.ts

**Status:** OPEN
**File:** `utils/paymentValidation.ts:33`
**Source:** logic-auditor

```typescript
// Validator defines: 'pending' | 'completed' | 'failed' | 'cancelled'
// Canonical PaymentStatus: 'pending' | 'awaiting_payment' | 'processing' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
// 'completed' should be 'paid'
// Missing: awaiting_payment, processing, authorized, partially_refunded
```

**Fix:** Update whitelist to match canonical. Currently imported but never called — verify all call sites before removing.

---

### G-MA-H30: CashbackStatus filter missing 'approved' and 'expired'

**Status:** OPEN
**File:** `hooks/queries/useCashback.ts:23`
**Source:** logic-auditor

```typescript
// Filter type: 'pending' | 'paid' | 'rejected'
// Canonical: 'pending' | 'approved' | 'rejected' | 'paid' | 'expired'
// Missing: 'approved', 'expired'
```

**Fix:** Add missing values to filter type and UI.

---

### G-MA-H31: Client-side order FSM not synced with backend

**Status:** OPEN
**File:** `services/api/orders.ts:44-72`
**Source:** payment-auditor, security-auditor

```typescript
private readonly VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  placed: ['confirmed', 'cancelled', 'cancelling'],
  // ... manually maintained, not auto-synced
};
```

**Client-side validation is UX only, NOT a security control.** Backend is authoritative. If client and backend FSM drift, client may allow transitions backend rejects or block transitions backend allows.

**Fix:** Fetch FSM from backend on app load, or add CI check comparing against `rezbackend/src/config/orderStateMachine.ts`.

---

### G-MA-H32: OrderFilters defined 3x with different fields

**Status:** OPEN
**Files:** `types/api.ts:485`, `types/orders.ts:6`, `services/api/orders.ts:4`
**Source:** payment-auditor

```typescript
// types/api.ts: adds paymentStatus, orderNumber
// types/orders.ts: does NOT include paymentStatus, orderNumber
// Different consumers import different definitions
```

**Fix:** Unify in `types/api.ts`. Remove from `types/orders.ts`. Re-export from `shared/types/orders.ts`.

---

### G-MA-H33: 'viewer' role in Zod schema but not in MerchantRole type

**Status:** OPEN
**File:** `utils/validation/schemas.ts:269`
**Source:** logic-auditor

```typescript
z.enum(['admin', 'manager', 'staff', 'viewer'] as const)
// MerchantRole: 'owner' | 'admin' | 'manager' | 'staff' | 'cashier'
// 'viewer' is NOT a valid MerchantRole
```

**Fix:** Change to `'cashier'`. Or add `'viewer'` to `MerchantRole` if backend supports it.

---

### G-MA-H34: Analytics fallback uses wrong status keys

**Status:** OPEN
**File:** `services/api/orders.ts:306-315`
**Source:** logic-auditor

```typescript
statusBreakdown: {
  pending: metricsData.orders?.pending || 0, // 'pending' not in OrderStatus
  confirmed: 0,
  ...
  delivered: metricsData.orders?.completed || 0, // 'completed' not in OrderStatus
}
```

**Fix:** Use `placed` instead of `pending`, `paid` instead of `completed`.

---

### G-MA-H35: Status normalization scattered across 7+ locations

**Status:** OPEN
**Files:** `services/api/orders.ts`, `hooks/useWebOrders.ts`, `app/(dashboard)/orders.tsx`, `app/(dashboard)/aggregator-orders.tsx`, `app/kds/rez-now-orders.tsx`, `app/kds/index.tsx`, `services/api/cashback.ts`
**Source:** logic-auditor

**Fix:** Extract to `shared/constants/orderStatus.ts` and `shared/constants/cashbackStatus.ts`. All files import from canonical.

---

### G-MA-H36: CashbackRequest defined 3 times with different shapes

**Status:** OPEN
**Files:** `shared/types/cashback.ts`, `types/cashback.ts`, `types/api.ts:331-374`
**Source:** logic-auditor

**Fix:** Keep canonical in `shared/types/cashback.ts`. Remove others. Ensure all consumers import from shared.

---

### G-MA-H37: Product type defined 3 times with different fields

**Status:** OPEN
**Files:** `shared/types/products.ts`, `types/products.ts`, `types/api.ts`
**Source:** logic-auditor

```typescript
// types/api.ts Product has is86d?: boolean, restores86At?: string
// shared/types/products.ts does NOT have these fields
// Components using types/api Product won't see 86'd tracking fields
```

**Fix:** Unify in `shared/types/products.ts`. Add `is86d` and `restores86At` fields. Remove duplicates.

---

### G-MA-H38: PaymentStatus has 3 separate definitions

**Status:** OPEN
**Files:** `types/api.ts`, `services/api/payments.ts` (raw string), `utils/paymentValidation.ts` (wrong)
**Source:** logic-auditor

**Fix:** Keep canonical in `types/api.ts`. Replace raw `status: string` in payments.ts with `PaymentStatus` type. Fix wrong values in paymentValidation.ts.

---

## NEW — Deep POS Audit Findings (2026-04-16)

### G-MA-H39: CartId Collision via Date.now() — Duplicate Items Silently Overwrite

**Status:** OPEN
**File:** `app/pos/index.tsx` (lines 446, 469, 532, 754)
**Source:** Deep POS audit

**Code:**
```typescript
// Line 446 (modifier item):
cartId: `${product.id}-${Date.now()}`,
// Line 469 (no-modifier item):
cartId: `${product.id}-${Date.now()}`,
// Line 532 (custom item):
id: `custom-${Date.now()}`,
// Line 754 (upsell item):
const id = `upsell-${suggestion.productId}-${Date.now()}`;
```

**Issue:** `Date.now()` has millisecond resolution. Rapid taps (barcode scan, quick adds) can land in the same millisecond, producing duplicate cartIds. The second item silently overwrites the first in cart state.

**Fix:** Replace all `Date.now()` with UUID: `import { v4 as uuidv4 } from 'uuid'` → `cartId: uuidv4()`.

---

### G-MA-H40: Missing Idempotency Key on PUT/DELETE Offline Actions

**Status:** OPEN
**File:** `services/offline.ts` (lines 248-277)
**Source:** Deep POS audit

**Code:**
```typescript
private async executeOfflineAction(action: OfflineAction): Promise<void> {
  const config = {
    headers: { 'X-Idempotency-Key': action.idempotencyKey }, // only used for POST
  };
  if (action.method === 'POST') {
    await apiClient.post(endpoint, action.data, config); // idempotency key sent ✓
  }
  if (action.method === 'PUT') {
    await apiClient.put(endpoint, action.data, config); // idempotency key may not be forwarded
  }
  await apiClient.delete(endpoint, config); // idempotency key absent
}
```

**Issue:** The idempotency key is in `config.headers` but `apiClient.put` and `apiClient.delete` may not forward headers from the config object. PUT and DELETE offline actions are replayed without idempotency protection — same action retried after timeout could execute twice on the server.

**Fix:** Verify `apiClient.put`/`delete` forward config headers. If not, pass idempotency key as query param or body field for PUT/DELETE.

---

### G-MA-H41: Socket Queued Events Never Replayed on Reconnection

**Status:** OPEN
**File:** `contexts/SocketContext.tsx` (lines 110-126)
**Source:** Deep POS audit

**Code:**
```typescript
const emit = useCallback((event: string, ...args: any[]) => {
  const ss = socketService as any;
  const socket = ss.getSocket?.();
  if (!socket || !socketService.isConnected()) {
    if (__DEV__) console.warn(`[Socket] Not connected; queuing event: ${event}`);
    if (ss.queueEvent) {
      ss.queueEvent(event, ...args); // queued, but...
    }
    return; // ← returns WITHOUT ever calling socketService.emit
  }
  socketService.emit(event, ...args);
}, []);
```

**Issue:** When offline, events are queued via `ss.queueEvent()` but the function returns without ever calling `socketService.emit()`. When the socket reconnects, queued events are never flushed and replayed — permanently lost.

**Fix:** `socketService.emit()` should handle its own offline queue internally. Or ensure the wrapper calls `socketService.emit()` after `ss.queueEvent()` to register the event for replay.

---

### G-MA-H42: Biometric Denial Silently Continues — No User Feedback

**Status:** OPEN
**File:** `app/payouts/index.tsx` (lines 216-222)
**Source:** Deep POS audit

**Code:**
```typescript
const handleRequestPayout = async () => {
  const authenticated = await authenticateWithBiometrics();
  if (!authenticated) return; // ← silently returns, no user feedback
  // ... payout logic
};
```

**Issue:** When biometric auth fails or is denied, the function returns silently with no error message to the user. The merchant has no idea why the payout request didn't proceed.

**Fix:** Add `Alert.alert` on authentication failure explaining what happened and offering alternatives (PIN fallback, retry).

---

### G-MA-H43: TXN ID Format Inconsistency Between Offline Flows

**Status:** OPEN
**File:** `services/offlinePOSQueue.ts` (lines 6-9) vs `services/offline.ts`
**Source:** Deep POS audit

**Code:**
```typescript
// offlinePOSQueue.ts — mixed format:
return `TXN-${Date.now()}-${uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
// offline.ts — different format:
idempotencyKey: `offline-${now}-${sequence}` // underscore prefix, hyphen-separated
```

**Issue:** Two different transaction ID formats used across offline flows. Format inconsistency makes audit log correlation difficult. Both use `Date.now()` so collision risk is the same.

**Fix:** Use a single canonical transaction ID generator across both files. `offline.ts` should import from `offlinePOSQueue.ts`.

---

### G-MA-H44: useOrdersDashboard Double-Fetch on Initial Load

**Status:** OPEN
**File:** `hooks/useOrdersDashboard.ts` (lines 379-381)
**Source:** Deep POS audit

**Code:**
```typescript
useEffect(() => {
  fetchOrders();
}, [fetchOrders]); // fetchOrders is memoized with [selectedStoreId, sortBy] deps
```

**Issue:** On component mount, `selectedStoreId` starts as `undefined`. The effect fires `fetchOrders(undefined)`. When `activeStore` loads and `selectedStoreId` updates, the effect fires again with the correct store ID. Two fetches on initial load (one unnecessary).

**Fix:** Guard inside `fetchOrders`: `if (!selectedStoreId) return;`. Or only mount the effect once `activeStore?._id` is available.
