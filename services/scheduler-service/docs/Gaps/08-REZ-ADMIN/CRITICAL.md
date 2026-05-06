# REZ Admin App — CRITICAL Gaps (Gen 10)

**Count:** 8 CRITICAL issues
**App:** `rez-app-admin/`
**Date:** 2026-04-16

---

## A10-C1 — Socket Events Don't Invalidate React Query Cache

**File:** `services/socket.ts:148-165` · `hooks/useAdminSocket.ts`
**Severity:** CRITICAL
**Category:** Data & Sync
**Root Cause:** RC-4 — Real-time events don't update server-state UI

**Finding:**
When `order:created` fires via Socket.IO, the event updates local component state only. The React Query cache is never invalidated. Any tab showing the order list via React Query will display stale data for up to 5 minutes (or 2 minutes for orders) even though real-time data has already arrived.

```ts
// services/socket.ts:148
this.socket.on('order:created', callback);
// callback updates local state only — no queryClient.invalidateQueries()
```

**Impact:**
- Order dashboard shows wrong counts after new orders arrive
- Revenue/metrics don't update in real time
- Admins take actions on stale financial data
- User wallet balance shown in dashboard doesn't reflect real-time credits

**Fix:**
```ts
// In useAdminSocket.ts — add cache invalidation:
const queryClient = useQueryClient();
socketService.onNewOrder((data) => {
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
});
```

**Status:** ACTIVE
**Cross-ref:** `A10-H11` (Socket reconnect uses stale token)

---

## A10-C2 — Three Competing VoucherBrand Type Definitions

**Files:** `services/api/vouchers.ts:13-39` · `services/api/cashStore.ts:21-39`
**Severity:** CRITICAL
**Category:** API Contracts
**Root Cause:** RC-1 — No single source of truth for types

**Finding:**
Both `vouchers.ts` and `cashStore.ts` define `VoucherBrand` for the same `admin/vouchers` endpoint with completely different field sets:

| Field | vouchers.ts | cashStore.ts |
|-------|------------|-------------|
| `slug` | MISSING | present |
| `rating` | MISSING | present |
| `logoColor` | present | MISSING |
| `backgroundColor` | present | MISSING |
| `termsAndConditions` | present | MISSING |

**Impact:**
Pages importing from `vouchers.ts` crash at runtime when the backend returns the `cashStore.ts` shape. Admin sees a blank screen when viewing voucher brands.

**Fix:**
1. Designate one file as the canonical source (prefer `cashStore.ts` — more fields)
2. Remove the duplicate from `vouchers.ts` and import from `cashStore.ts`
3. Create shared type in `types/` and have both import from there

**Status:** ACTIVE
**Also see:** `A10-C3`, `A10-H2`, `A10-H3`

---

## A10-C3 — Same Endpoint, Opposite Query Param Names

**Files:** `services/api/extraRewards.ts:244` · `services/api/cashStore.ts:455-458`
**Severity:** CRITICAL
**Category:** API Contracts
**Root Cause:** RC-6 — Duplicate service implementations

**Finding:**
Both files hit the same `admin/coin-drops/stores` endpoint but send different query param names:

```ts
// extraRewards.ts — sends ?q=search
params.append('q', search);

// cashStore.ts — sends ?search=search
queryParams.append('search', search);
```

**Impact:**
One of these always returns unfiltered results. Coin drop store search silently fails for whichever file is wrong. Admins can't find the stores they need when configuring coin drops.

**Fix:**
1. Check backend endpoint to determine correct param name
2. Standardize on one convention
3. Extract shared endpoint definitions into a single config

**Status:** ACTIVE

---

## A10-C4 — In-Memory PaymentMachine Provides Zero Cross-Request Protection

**File:** `rez-payment-service/src/routes/paymentRoutes.ts:17-41, 369-381`
**Severity:** CRITICAL
**Category:** Financial / Backend
**Root Cause:** RC-3 — Fire-and-forget for financial operations

**Finding:**
A fresh `PaymentMachine` is instantiated per webhook event, always starting in `PENDING` state. If Razorpay delivers two `payment.captured` events (retry scenario) and Redis is temporarily unavailable:

```ts
// paymentRoutes.ts:371
const machine = createPaymentMachine(); // always starts PENDING
if (!machine.canTransition({ type: 'SUCCESS', transactionId: paymentEntity.id })) {
```

The Redis replay guard (line 189) fails closed when Redis is down. The in-memory machine has no knowledge of the actual payment's current DB state.

**Impact:**
Double credit on payment capture — user wallet credited twice for the same payment.

**Fix:**
Read actual payment status from MongoDB before transitioning:
```ts
const payment = await Payment.findById(paymentId);
if (payment.status === 'SUCCESS') return; // already processed
const machine = createPaymentMachine();
machine.restore(payment.status); // restore actual state
```

**Status:** ACTIVE
**Cross-ref:** `A10-H12` (No idempotency on wallet mutations)

---

## A10-C5 — Internal Auth HMAC Key Derived from Env Var Name, Not Value

**File:** `rez-order-service/src/middleware/internalAuth.ts:40-46`
**Severity:** CRITICAL
**Category:** Security / Backend
**Root Cause:** RC-3 — Financial ops without proper safeguards

**Finding:**
```ts
const hmacKey = Buffer.from(
  process.env.INTERNAL_SERVICE_TOKEN || 'fallback', 'utf8'
);
```

`Buffer.from('INTERNAL_SERVICE_TOKEN')` — the HMAC key is the literal string `"INTERNAL_SERVICE_TOKEN"`, not the secret value. If the env var is unset, the key is literally `"fallback"`.

**Impact:**
All internal service-to-service endpoints (`/internal/orders/*`, `/internal/wallet/*`) are effectively unauthenticated. Any caller with any token value can access every internal mutation endpoint.

**Fix:**
```ts
const rawSecret = process.env.INTERNAL_SERVICE_TOKEN;
if (!rawSecret) {
  res.status(503).json({ success: false, message: 'Internal auth not configured' });
  return;
}
const hmacKey = Buffer.from(rawSecret, 'utf8');
```

**Status:** ACTIVE
**Cross-ref:** `CODEBASE_ISSUES_AUDIT.md` SEC-1 (same issue, payment service pattern)

---

## A10-C6 — SSE Order Stream Has No Merchant Ownership Check

**File:** `rez-order-service/src/httpServer.ts:473-533`
**Severity:** CRITICAL
**Category:** Security / Backend
**Root Cause:** RC-4 — Real-time events bypass auth checks

**Finding:**
```ts
app.get('/orders/stream', requireOrderAuth, (req, res) => {
  const { merchantId } = req.query as Record<string, string>;
  // NO check: authUser.merchantId === merchantId
  let cleanupStream = setupChangeStream(merchantId, res);
});
```

Any authenticated user can subscribe to any merchant's real-time order stream by passing `?merchantId=<validObjectId>`. No ownership verification.

**Impact:**
Full visibility into any merchant's orders, customer data, and status updates. A competitor could monitor a merchant's order flow in real time.

**Fix:**
```ts
const { merchantId } = req.query as Record<string, string>;
const authMerchant = req.authUser?.merchantId;
if (merchantId !== authMerchant) {
  res.status(403).json({ success: false, message: 'Not authorized for this merchant' });
  return;
}
```

**Status:** ACTIVE

---

## A10-C7 — Three Conflicting Color Systems, One Is Dead Code

**Files:** `constants/DesignTokens.ts` · `constants/Colors.ts` · `contexts/ThemeContext.tsx`
**Severity:** CRITICAL
**Category:** Architecture
**Root Cause:** RC-1 — No single source of truth

**Finding:**
| System | `primary` value | Used By |
|--------|-----------------|---------|
| `DesignTokens.Colors.primary[500]` | `#EF4444` (red) | `app/_layout.tsx` |
| `Colors.light.tint` | `#DC2626` (red, different) | All screen components |
| `ThemeContext.lightColors.primary` | `#C9A962` (gold) | **Zero consumers** |

The `AdminThemeProvider` wraps the entire app but no component ever calls `useTheme()` from `ThemeContext`.

**Impact:**
- Admin app renders with mismatched color values
- Confusing codebase — developers don't know which system to use
- Wrong colors applied by mistake
- Dead code increases bundle size

**Fix:**
1. Audit which system is correct (likely `Colors.ts` based on component usage)
2. Remove `ThemeContext.tsx` entirely
3. Consolidate `DesignTokens.ts` into `constants/Colors.ts`
4. Use one export: `import { Colors } from '@/constants/Colors'`

**Status:** ACTIVE

---

## A10-C8 — Order Refund Modal Shows Rs. 0 and `#undefined`

**File:** `app/(dashboard)/orders.tsx:971, 979, 973`
**Severity:** CRITICAL
**Category:** Functional Bug
**Root Cause:** RC-2 — Frontend computes what backend should own

**Finding:**
```tsx
// Line 971 — .id doesn't exist on Order type
Order #{selectedOrder.id}  // → "Order #undefined"

// Line 973 — .customerName doesn't exist on Order type
Customer: {selectedOrder.customerName}  // → renders nothing

// Line 979 — .totalAmount doesn't exist on Order type
Total: {formatCurrency(selectedOrder.totalAmount)}  // → "Total: Rs. 0"
```

The `Order` interface defines `_id`, nested `user.profile` fields, and `totals.total` — not `id`, `customerName`, or `totalAmount`.

**Impact:**
Admin cannot verify order details before confirming a refund. They see "Order #undefined, Total: Rs. 0" and must cancel to check the actual order in a separate screen.

**Fix:**
```tsx
Order #{(selectedOrder as any).orderNumber || selectedOrder._id}
Customer: {selectedOrder.user?.profile?.firstName || selectedOrder.user?.phoneNumber || '—'}
Total: {formatCurrency(selectedOrder.totals?.total || 0)}
```

**Status:** ACTIVE
**Cross-ref:** `A10-H4` (StatusFilter type missing `'pending'`)
