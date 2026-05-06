# REZ Admin App — HIGH Gaps (Gen 10)

**Count:** 17 HIGH issues
**App:** `rez-app-admin/` + backend services
**Date:** 2026-04-16

---

## Data Sync & Cache Issues

---

## A10-H1 — No Mutation-Side Cache Invalidation

**File:** All `hooks/queries/` files
**Severity:** HIGH
**Category:** Data & Sync

**Finding:**
All React Query hooks (`useOrders`, `useMerchants`, `useDashboard`, etc.) define query configurations but none of them define `onSuccess` handlers to invalidate related queries after mutations.

```ts
// hooks/queries/useOrders.ts — no onSuccess invalidation
const useOrders = () => useQuery({
  queryKey: queryKeys.orders.list,
  queryFn: ordersService.getAll,
  staleTime: 2 * 60 * 1000,
  // No onSuccess → cache never invalidated
});
```

After approving an order, the order list stays stale for up to 5 minutes. Admin sees the old state even after their action succeeded.

**Impact:** Stale data after every mutation action.

**Fix:**
```ts
const useApproveOrder = () => useMutation({
  mutationFn: (orderId: string) => ordersService.approveOrder(orderId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
  },
});
```

**Status:** ACTIVE
**Cross-ref:** `A10-C1` (Socket doesn't invalidate cache)

---

## A10-H2 — Duplicate CoinDrop Type Definitions

**Files:** `services/api/extraRewards.ts:39-57` · `services/api/cashStore.ts:101-117`
**Severity:** HIGH
**Category:** API Contracts
**Root Cause:** RC-6

**Finding:**
`CoinDrop` type is defined twice for the same `admin/coin-drops` endpoint:

| Field | extraRewards.ts | cashStore.ts |
|-------|----------------|-------------|
| `storeId` | `string \| { _id, name, logo }` | `string` only |
| `boostedCashback` | present | MISSING |
| `storeName` | present | present |

**Impact:** Type mismatch causes runtime crashes when switching between screens.

**Status:** ACTIVE

---

## A10-H3 — Duplicate DoubleCashbackCampaign Field Mismatch

**Files:** `services/api/extraRewards.ts:14-37` · `services/api/cashStore.ts:78-99`
**Severity:** HIGH
**Category:** API Contracts
**Root Cause:** RC-6

**Finding:**
`minOrderValue` is optional in `extraRewards.ts` but required in `cashStore.ts`. `usageCount` and `createdBy` exist in one but not the other.

**Impact:** Create/edit forms will have validation mismatches.

**Status:** ACTIVE

---

## A10-H4 — StatusFilter Type Missing `'pending'`

**File:** `app/(dashboard)/orders.tsx:24`
**Severity:** HIGH
**Category:** Functional Bug

**Finding:**
```ts
type StatusFilter =
  | 'all' | 'placed' | 'confirmed' | 'preparing' | 'ready'
  | 'dispatched' | 'out_for_delivery' | 'delivered'
  | 'cancelling' | 'cancelled' | 'returned' | 'refunded';
  // Note: 'pending' is absent
```

But `OrderStats.byStatus` in `services/api/orders.ts:102` returns `pending` counts from the backend. Users cannot filter to see pending orders from the dashboard.

**Impact:** Admins can't find orders in `pending` state.

**Fix:** Add `'pending'` to the `StatusFilter` type.

**Status:** ACTIVE
**Cross-ref:** `A10-C8`

---

## Enum / Status Issues

---

## A10-H5 — Payment Status Colors Missing 7 of 11 Canonical States

**File:** `app/(dashboard)/orders.tsx:252`
**Severity:** HIGH
**Category:** Enum/Status

**Finding:**
```ts
const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case 'paid': return colors.success;
    case 'pending': return colors.warning;
    case 'failed':
    case 'refunded': return colors.error;
    default: return colors.icon; // everything else → gray
  }
};
```

Missing canonical statuses: `'awaiting_payment'`, `'processing'`, `'authorized'`, `'partially_refunded'`, `'expired'`, `'cancelled'`, `'unknown'`. All show as gray — indistinguishable from unknown errors.

**Impact:** Payment states like `awaiting_payment` and `processing` show as gray, confusing admins.

**Status:** ACTIVE

---

## A10-H6 — Three Competing normalizeOrderStatus Implementations

**Files:** `constants/orderStatuses.ts` · `types/index.ts` · `types/rez-shared-types.ts`
**Severity:** HIGH
**Category:** Enum/Status
**Root Cause:** RC-1

**Finding:**
Each has a `LEGACY_STATUS_MAP` with the same approach. `orders.tsx` imports from `constants/orderStatuses.ts`, not the canonical `@rez/shared` shim. If the two diverge, data normalizes inconsistently.

**Impact:** Same order status renders differently in different parts of the admin app.

**Status:** ACTIVE

---

## A10-H7 — Status Transition Map Allows Invalid `dispatched→delivered`

**File:** `app/(dashboard)/orders.tsx:61`
**Severity:** HIGH
**Category:** Business Logic

**Finding:**
```ts
dispatched: ['out_for_delivery', 'delivered', 'cancelled'],
```

An admin can mark a `dispatched` order as `delivered` directly, bypassing the `out_for_delivery` step. Correct should be `['out_for_delivery', 'cancelled']`.

**Impact:** Invalid order state transitions — orders skip delivery confirmation step.

**Fix:** Remove `'delivered'` from `dispatched` transitions.

**Status:** ACTIVE

---

## A10-H8 — Live Monitor Shows `out_for_delivery` and `cancelling` as Gray/Unlabeled

**File:** `app/(dashboard)/live-monitor.tsx:137, 152`
**Severity:** HIGH
**Category:** Enum/Status

**Finding:**
Both `orderStatusColor` and `orderStatusLabel` are missing `'cancelling'` and `'out_for_delivery'`. These canonical statuses fall through to `default` (gray, raw unformatted string).

**Impact:** Live order feed shows in-transit orders as gray with label "out_for_delivery".

**Status:** ACTIVE

---

## Security Issues

---

## A10-H9 — JWT Algorithm Confusion (`alg: none`) Not Mitigated

**File:** `rez-api-gateway/src/shared/authMiddleware.ts:65`
**Severity:** HIGH
**Category:** Security

**Finding:**
```ts
const decoded = jwt.verify(token, secret) as {...};
// no algorithms: ['HS256'] option
```

Without `algorithms: ['HS256']`, `jwt.verify` accepts tokens with `alg: 'none'`, stripping the signature entirely.

**Impact:** Attacker with any token structure can forge a valid token.

**Fix:**
```ts
jwt.verify(token, secret, { algorithms: ['HS256'] });
```

**Status:** ACTIVE
**Cross-ref:** `CODEBASE_ISSUES_AUDIT.md` SEC-4

---

## A10-H10 — Platform Settings Save Has No Role Guard

**File:** `app/(dashboard)/admin-settings.tsx:135-163`
**Severity:** HIGH
**Category:** Security

**Finding:**
```ts
const handleSave = () => {
  apiClient.patch('admin/settings', payload);
  // No hasRole(ADMIN_ROLES.SUPER_ADMIN) check
};
```

Any authenticated admin (support, operator, admin, super_admin) can modify `cashbackMultiplier`, `maintenanceMode`, and `maxCoinsPerDay`. Meanwhile `admin-users.tsx` correctly guards with `hasRole`.

**Impact:** Support-level admins can change platform-wide financial settings.

**Fix:**
```ts
if (!hasRole(ADMIN_ROLES.SUPER_ADMIN)) {
  showAlert('Access Denied', 'Only super admins can modify platform settings');
  return;
}
```

**Status:** ACTIVE

---

## A10-H11 — Web Socket Connects with Null Auth Token

**File:** `services/socket.ts:26, 113`
**Severity:** HIGH
**Category:** Security

**Finding:**
```ts
const token = await storageService.getAuthToken();
this.socket = io(this.connectionUrl, {
  auth: token ? { token } : undefined, // null on web with COOKIE_AUTH_ENABLED
});
```

On web with `COOKIE_AUTH_ENABLED=true`, the socket connects without credentials.

**Impact:** Web admins are unauthenticated at the socket layer — real-time features may fail silently.

**Status:** ACTIVE
**Cross-ref:** `A10-C1` (Socket doesn't invalidate cache)

---

## Financial Issues

---

## A10-H12 — No Idempotency Keys on Wallet Mutations

**Files:** `services/api/userWallets.ts` (all mutation methods)
**Severity:** HIGH
**Category:** Financial

**Finding:**
`adjustBalance`, `reverseCashback`, `freezeWallet`, and `unfreezeWallet` all lack idempotency keys. Meanwhile `orders.ts` `refundOrder` correctly generates one.

**Impact:** Network retries can cause duplicate credit/debit/freeze operations.

**Fix:** Add idempotency key to all wallet mutation methods:
```ts
const idempotencyKey = `${userId}:${action}:${Date.now()}`;
return apiClient.post('/admin/wallet/adjust', { ..., idempotencyKey });
```

**Status:** ACTIVE
**Cross-ref:** `A10-C4` (PaymentMachine in-memory), `CODEBASE_ISSUES_AUDIT.md` SEC-5C

---

## A10-H13 — `Infinity` Amount Passes Validation

**File:** `app/(dashboard)/wallet-adjustment.tsx:271`
**Severity:** HIGH
**Category:** Financial

**Finding:**
```ts
const amt = Number(adjustAmount);
if (!amt || amt <= 0) return;
// Number("1e1000") = Infinity → !Infinity = false → passes validation
```

Contrast with `user-wallets.tsx:207` which correctly uses `!Number.isFinite(amt)`.

**Impact:** `Infinity` amount can be submitted to the API.

**Fix:**
```ts
const amt = parseFloat(adjustAmount);
if (!amt || amt <= 0 || !Number.isFinite(amt)) return;
```

**Status:** ACTIVE

---

## Architecture Issues

---

## A10-H14 — 82 Service Files, Identical 5-Line CRUD Pattern

**Files:** All `services/api/*.ts` files
**Severity:** HIGH
**Category:** Architecture

**Finding:**
Every service file follows the same template:
```ts
class XxxService {
  async getAll() { return apiClient.get(...) }
  async getById(id) { return apiClient.get(...) }
  async create(d) { return apiClient.post(...) }
  async update(id,d){ return apiClient.put(...) }
  async delete(id) { return apiClient.delete(...) }
}
```

677 total API calls, zero shared extraction.

**Impact:** If `apiClient.get()` signature changes, all 86 files need updating. Inconsistent error handling across 82 files.

**Fix:** Create a generic repository base class or use an ORM-style wrapper.

**Status:** ACTIVE

---

## A10-H15 — Inconsistent Stale Times Across Domains

**File:** `config/reactQuery.ts:21-45`
**Severity:** HIGH
**Category:** Data & Sync

**Finding:**
| Domain | Stale Time | Issue |
|--------|-----------|-------|
| Dashboard | 2 min | OK |
| Orders | 2 min | OK |
| Fraud | 2 min | OK |
| Merchants | 5 min | Stale approval status |
| Campaigns | 5 min | Stale active/inactive |
| Feature Flags | 10 min | OK |
| useFraudConfig | 10 min | Inconsistent with fraud (2 min) |
| useMerchantCampaignRuleStats | 10 min | Inconsistent with campaigns (5 min) |

**Impact:** Some domains show stale data for 5+ minutes while others refresh at 2 minutes.

**Fix:** Standardize stale times to 1 minute for all real-time data (orders, dashboard), 5 minutes for configuration data.

**Status:** ACTIVE

---

## A10-H16 — Two Conflicting hasRole Implementations

**Files:** `contexts/AuthContext.tsx:430-443` · `app/_layout.tsx:76-95`
**Severity:** HIGH
**Category:** Architecture

**Finding:**
`AuthContext.hasRole()` uses numeric level comparison. `isAdminRole()` uses `VALID_ADMIN_ROLES.includes()` string matching. `hasRole('admin')` and `isAdminRole('admin')` have different permission surfaces.

**Impact:** Same user has different permissions depending on which function is called.

**Fix:** Consolidate into one implementation, import from one place.

**Status:** ACTIVE

---

## A10-H17 — roleHierarchy Not Synchronized with VALID_ADMIN_ROLES

**File:** `contexts/AuthContext.tsx:433-443`
**Severity:** HIGH
**Category:** Architecture

**Finding:**
```ts
const roleHierarchy = { support: 60, operator: 70, admin: 80, super_admin: 100 };
// NOT synced with constants/roles.ts ADMIN_ROLES
```

Also: no `viewer` entry in `roleHierarchy`, but `admin-settings.tsx` exposes it as a creatable role.

**Impact:** Updates to `roles.ts` silently don't affect `hasRole`.

**Fix:** Import `VALID_ADMIN_ROLES` and `ADMIN_ROLES` from `constants/roles.ts` and use those as the source of truth.

**Status:** ACTIVE
