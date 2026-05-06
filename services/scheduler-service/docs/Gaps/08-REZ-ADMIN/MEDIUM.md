# REZ Admin App — MEDIUM Gaps (Gen 10)

**Count:** 20 MEDIUM issues
**App:** `rez-app-admin/` + backend services
**Date:** 2026-04-16

---

## A10-M1 — LocalStorage XSS Risk Acknowledged and Accepted

**File:** `services/storage.ts:30-35`
**Severity:** MEDIUM
**Category:** Security

**Finding:**
```ts
// localStorage is not encrypted and is accessible to any JS running on the same origin
// the XSS risk is accepted.
localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(data));
```

**Impact:** Any XSS vector on the admin domain grants full access to the JWT.

**Status:** ACKNOWLEDGED — mitigation in progress (httpOnly cookies Phase 6)

---

## A10-M2 — requireMerchant Accepts Cookie Token Without CSRF Protection

**File:** `rez-api-gateway/src/shared/authMiddleware.ts:93-135`
**Severity:** MEDIUM
**Category:** Security

**Finding:**
`requireMerchant` accepts `merchant_access_token` from cookies alongside Bearer headers. GET requests to malicious pages auto-send cookies.

**Impact:** CSRF attacks possible on merchant-facing endpoints.

**Status:** ACTIVE

---

## A10-M3 — Four Nested Theme Providers, Two Are Dead

**File:** `app/_layout.tsx:366-378`
**Severity:** MEDIUM
**Category:** Architecture

**Finding:**
React Navigation `ThemeProvider` + `AdminThemeProvider` (zero consumers) + `AuthProvider` + `QueryClientProvider`. Three providers active. `AdminThemeProvider` provides a gold palette that no screen ever references.

**Impact:** Confusion, bundle bloat, potential render issues.

**Status:** ACTIVE

---

## A10-M4 — Unauthorized assign Sends Empty POST Body

**File:** `services/api/disputes.ts:95-97`
**Severity:** MEDIUM
**Category:** API Contracts

**Finding:**
```ts
async assign(id: string) {
  return apiClient.post(`/admin/disputes/${id}/assign`, {});
}
```

Sending `{}` body is ambiguous. The backend may reject it, accept it as "assign to self", or interpret it differently.

**Impact:** Dispute assignment may fail silently or assign to wrong person.

**Status:** ACTIVE

---

## A10-M5 — StatusFilter Type Missing `'pending'`

**File:** `app/(dashboard)/orders.tsx:24`
**Severity:** MEDIUM
**Category:** Functional Bug
**See:** `A10-H4`

---

## A10-M6 — socketConnectionLost Banner Never Resets

**File:** `app/(dashboard)/live-monitor.tsx:345`
**Severity:** MEDIUM
**Category:** UX

**Finding:**
```ts
const [socketConnectionLost, setSocketConnectionLost] = useState(false);
```

Set to `true` on `reconnect_failed` but never set back to `false`.

**Impact:** "Connection lost" banner persists after successful reconnection.

**Fix:**
```ts
socketService.on('connect', () => setSocketConnectionLost(false));
```

**Status:** ACTIVE

---

## A10-M7 — React Query Not Used for Wallet/Financial Data

**Files:** `wallet.tsx` · `user-wallets.tsx` · `wallet-adjustment.tsx`
**Severity:** MEDIUM
**Category:** Data & Sync

**Finding:**
All use raw `useState` + manual API calls. No automatic cache invalidation, no background refetch, no retry.

**Impact:** No automatic stale-data refresh for financial operations.

**Status:** ACTIVE

---

## A10-M8 — approvalThreshold Never Refreshes After Load

**File:** `app/(dashboard)/wallet-adjustment.tsx:232`
**Severity:** MEDIUM
**Category:** UX

**Finding:**
```ts
useEffect(() => {
  adminActionsService.getApprovalThreshold().then(setApprovalThreshold);
}, []); // fetched once, never again
```

If backend changes the threshold while an admin has the page open, the displayed threshold message is stale.

**Impact:** Admin initiates action thinking no approval needed, discovers approval required on submit.

**Status:** ACTIVE

---

## A10-M9 — Unreachable response.status === 202 Check

**File:** `services/api/userWallets.ts:155-167`
**Severity:** MEDIUM
**Category:** Error Handling

**Finding:**
```ts
if (response.success) { return { status: 200 }; }
if (response.status === 202) { /* unreachable */ }
```

**Impact:** Dead code. Pending approval state never handled.

**Status:** ACTIVE

---

## A10-M10 — Errors Swallowed, Empty Data Returned as Success

**Files:** `vouchers.ts:86` · `support.ts:75`
**Severity:** MEDIUM
**Category:** Error Handling

**Finding:**
```ts
} catch (error) {
  return { vouchers: [], pagination: {...} };
}
```

Callers cannot distinguish network failure from zero results.

**Fix:** Return error or throw so callers can handle appropriately.

**Status:** ACTIVE

---

## A10-M11 — uploadFile Retry Consumes FormData Stream

**File:** `services/api/apiClient.ts:298-327`
**Severity:** MEDIUM
**Category:** Error Handling

**Finding:**
After a 401 during upload, the FormData stream is already consumed. Token refresh succeeds but the retry attempt fails because the stream is exhausted.

**Impact:** User must manually re-initiate the upload after session refresh.

**Status:** ACTIVE

---

## A10-M12 — response.json() Without Content-Type Check

**File:** `services/api/apiClient.ts:129, 306`
**Severity:** MEDIUM
**Category:** Error Handling

**Finding:**
```ts
const data = await response.json(); // throws on empty body or non-JSON
```

A 204 No Content or non-JSON error page throws `SyntaxError` caught as "Network error".

**Impact:** Error messages hide actual failure modes.

**Status:** ACTIVE

---

## A10-M13 — No Lazy Loading on 100+ Screens

**Files:** `_layout.tsx:38-732` · `App.tsx:16`
**Severity:** MEDIUM
**Category:** Performance

**Finding:**
All 100+ screens are registered synchronously at module load. `analytics-dashboard.tsx`, `fraud-queue.tsx`, `orders.tsx` (1365 lines), `merchants.tsx` (1727 lines) all bundled eagerly.

**Impact:** Slow app startup, large initial bundle size.

**Status:** ACTIVE

---

## A10-M14 — Division by Zero if today === 0 but todayPlatformFees > 0

**File:** `app/(dashboard)/index.tsx:326-327`
**Severity:** MEDIUM
**Category:** Edge Case

**Finding:**
```tsx
`${((stats.revenue.todayPlatformFees / stats.revenue.today) * 100).toFixed(0)}%`
```

Guard checks individual values but division uses `today > 0` (not `>=`).

**Impact:** `Infinity` display if only refund transactions exist.

**Status:** ACTIVE

---

## A10-M15 — FlatList Uses Array Index as Key

**Files:** `orders.tsx:823` · `merchants.tsx:1025`
**Severity:** MEDIUM
**Category:** Edge Case

**Finding:**
```tsx
{items?.map((item, index) => <View key={index} />)}
```

Index-as-key in lists that can be reordered causes incorrect component reuse.

**Status:** ACTIVE

---

## A10-M16 — 70+ `as any` Casts on router.push Calls

**Files:** `index.tsx` · `settings.tsx` · multiple other screens
**Severity:** MEDIUM
**Category:** Type Safety

**Finding:**
Route typos like `'(/dashboard)/orderz'` will silently fail at runtime. No build-time route validation.

**Impact:** Navigation errors only discovered at runtime.

**Status:** ACTIVE

---

## A10-M17 — Dashboard Refetches on Every Tab Switch

**File:** `app/(dashboard)/index.tsx:163-169`
**Severity:** MEDIUM
**Category:** Performance

**Finding:**
```ts
useFocusEffect(
  useCallback(() => {
    refetchStats(); // forces network call every focus
    refetchActivity();
  }, [refetchStats, refetchActivity])
);
```

`staleTime: 2 * 60 * 1000` means React Query wouldn't refetch anyway. Focus effect bypasses this entirely.

**Impact:** Unnecessary API calls on every tab navigation.

**Status:** ACTIVE

---

## A10-M18 — Wallet Mutations Don't Invalidate Query Cache

**Files:** `wallet-adjustment.tsx` · `user-wallets.tsx`
**Severity:** MEDIUM
**Category:** Data & Sync

**Finding:**
Wallet operations (credit, debit, freeze) succeed and then manually call `loadUsers(1)`. No optimistic update, no cache invalidation via React Query.

**Impact:** Stale data visible until manual reload completes.

**Status:** ACTIVE

---

## A10-M19 — Redis Fail-Open Outside Production on Blacklist Check

**File:** `rez-order-service/src/httpServer.ts:202-224`
**Severity:** MEDIUM
**Category:** Security / Backend

**Finding:**
```ts
} catch {
  if (process.env.NODE_ENV === 'production') {
    res.status(503).json({ success: false });
    return;
  }
  logger.warn('Redis unavailable — failing open');
}
```

In staging (`NODE_ENV !== 'production'`), revoked tokens remain valid when Redis is down.

**Impact:** Revoked tokens work in staging environments.

**Status:** ACTIVE

---

## A10-M20 — StatusTransitionMap Allows dispatched→delivered Skip

**File:** `app/(dashboard)/orders.tsx:61`
**Severity:** MEDIUM
**Category:** Business Logic
**See:** `A10-H7`
