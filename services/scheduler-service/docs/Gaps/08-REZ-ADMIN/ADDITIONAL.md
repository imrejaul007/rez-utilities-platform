# REZ Admin App — Additional Issues (Deep Audit)

**Date:** 2026-04-16
**Source:** Follow-up deep audit of `rez-app-admin/`
**Total:** 19 new issues (3 CRITICAL, 6 HIGH, 7 MEDIUM, 3 LOW)

---

## CRITICAL (3 new issues)

---

### NEW-A-C1 — `Number()` in Wallet Adjustment Accepts `Infinity`

**File:** `app/(dashboard)/wallet-adjustment.tsx:270, 312`

```ts
// Line 270 — adjustAmount
const amt = Number(adjustAmount);
if (!amt || amt <= 0) return;

// Line 312 — reverseAmount (same pattern)
const amt = Number(reverseAmount);
if (!amt || amt <= 0) return;
```

**Finding:** `A10-H13` documents this bug for `adjustAmount` only. But `reverseAmount` on line 312 has the identical pattern. Both can accept `Number("1e1000")` = `Infinity`, which passes the `!amt` check.

**Impact:** Financial operations with `Infinity` amounts reach the backend.

**Fix:**
```ts
const amt = parseFloat(adjustAmount);
if (!amt || amt <= 0 || !Number.isFinite(amt)) return;
```

**Category:** Financial / Functional Bug

---

### NEW-A-C2 — Dashboard Layout Uses `isLoading` Instead of `isInitializing` for Auth Guard

**File:** `app/(dashboard)/_layout.tsx:13, 16-28`

```tsx
const { isAuthenticated, isLoading } = useAuth();
if (isLoading) { return <ActivityIndicator />; }
if (!isAuthenticated) { return <Redirect href="/(auth)/login" />; }
```

**Finding:** Root layout uses `isInitializing` (dedicated flag during `checkStoredToken`). Dashboard layout uses `isLoading`, which starts `false` during initial load. On rapid launches or cached state, the redirect fires before auth context fully resolves.

**Impact:** Brief unauthenticated state visible before redirect, or redirect before auth resolves.

**Fix:**
```tsx
const { isAuthenticated, isInitializing } = useAuth();
if (isInitializing) { return <ActivityIndicator />; }
if (!isAuthenticated) { return <Redirect href="/(auth)/login" />; }
```

**Category:** UX / Functional Bug

---

### NEW-A-C3 — `app/contexts/AuthContext.tsx` Unused Duplicate with Conflicting Auth Model

**File:** `app/contexts/AuthContext.tsx` (entire file — 174 lines, zero imports)

This file defines a completely separate `AuthContext` and `useAuth()` that:
- Uses `AdminUser` with `id` instead of `_id`
- Validates JWT role via `VALID_ADMIN_ROLES.includes()` with `as any`
- Only supports `'SUPER_ADMIN'` (uppercase) vs canonical uses `'super_admin'`
- Has a logout function that does NOT clear React Query cache

Zero imports across the entire codebase reference this file.

**Impact:**
1. Dead code increases bundle size
2. If a developer mistakenly imports from the wrong location, they get a completely different auth model
3. The duplicate has weaker role checking

**Fix:** Delete `app/contexts/AuthContext.tsx` entirely.

**Category:** Architecture / Security

---

## HIGH (6 new issues)

---

### NEW-A-H1 — Query Key Factory Uses Untyped `any` for Filters — Cache Collisions

**File:** `hooks/queries/queryKeys.ts:10, 19, 26, 33, 47, 54`

```ts
list: (filters?: any) => [...queryKeys.merchants.all, 'list', filters] as const,
```

**Finding:** All filter objects typed as `any`. `useMerchants({ status: 'active' })` and `useMerchants({ status: 'pending' })` produce identical query keys (both stringify to `'[object Object]'`). React Query returns the same cached result for both filter combinations.

**Impact:** Selecting "pending merchants" actually shows "active merchants" from cache. Admins see wrong data when switching filters.

**Fix:**
```ts
list: (filters?: { page?: number; limit?: number; status?: string; search?: string }) =>
  [...queryKeys.merchants.all, 'list', JSON.stringify(filters)] as const,
```

**Category:** Data & Sync / Functional Bug

---

### NEW-A-H2 — React Query `select` Returns Data Even on `success: false` Responses

**Files:** `hooks/queries/useOrders.ts:17, 25, 35` · `hooks/queries/useDashboard.ts:10, 18` · `hooks/queries/useMerchants.ts:22, 32, 41, 49`

```ts
select: (res) => res.data,
```

**Finding:** All query hooks use `select: (res) => res.data`. If `apiClient` returns `{ success: false, message: '...' }` (no `data` field), `res.data` is `undefined`. The query appears to succeed with no error thrown. Components receive `undefined` and silently display blank lists.

**Impact:** Silent data failures — admins see blank lists believing there are zero results.

**Fix:**
```ts
select: (res) => {
  if (!res.success) throw new Error(res.message || 'Query failed');
  return res.data;
},
```

**Category:** Data & Sync / Error Handling

---

### NEW-A-H3 — Unused `app/contexts/AuthContext` Logout Does NOT Clear React Query Cache

**File:** `app/contexts/AuthContext.tsx:121-125`

```tsx
const logout = useCallback(async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  setToken(null);
  setUser(null);
  // No queryClient.clear() — STALE DATA LEAKS
}, []);
```

**Finding:** The canonical `contexts/AuthContext.tsx` correctly calls `queryClient.clear()` on logout. The unused `app/contexts/AuthContext.tsx` does NOT. If any code path imports from the wrong context, logout would not clear the cache.

**Impact:** Stale data from previous admin session leaks into next session.

**Fix:** Delete `app/contexts/AuthContext.tsx` (resolves both `NEW-A-C3` and `NEW-A-H3`).

**Category:** Data & Sync / Security

---

### NEW-A-H4 — `getApprovalThreshold` Silent Fallback to 50000 Makes API Failures Indistinguishable

**File:** `services/api/adminActions.ts:121-130`

```ts
async getApprovalThreshold(): Promise<number> {
  try {
    const response = await apiClient.get<{ threshold: number }>('admin/admin-actions/threshold');
    if (response.success && response.data) { return response.data.threshold; }
    return 50000; // Silent fallback
  } catch {
    return 50000; // Silent fallback
  }
}
```

**Finding:** Fallback to `50000` makes API failures indistinguishable from legitimate default. Admins cannot tell if the API is up or down.

**Impact:** Admins cannot distinguish "API is down" from "threshold is 50000". `handleAdjust` logic silently uses wrong threshold value on failed fetches.

**Fix:**
```ts
} catch (error) {
  logger.error('[AdminActions] getApprovalThreshold failed:', error);
  throw error; // Let callers handle it
}
```

**Category:** Functional Bug / Error Handling

---

### NEW-A-H5 — Socket Reconnection Hardcoded to ~25 Seconds Max

**File:** `services/socket.ts:34`

```ts
reconnectionAttempts: 5,
reconnectionDelay: 1000,
reconnectionDelayMax: 5000,
// Max reconnect: 1+2+3+4+5 × 5000ms ≈ ~25 seconds
```

**Finding:** After ~25 seconds, admin gets "Connection lost" banner requiring manual refresh. No configuration mechanism — all constants hardcoded.

**Impact:** Mission-critical admin dashboard loses real-time updates on transient network issues > 25s. Admins must manually refresh.

**Fix:** Increase to 10 attempts with exponential backoff up to 30 seconds, expose via `API_CONFIG`.

**Category:** Performance / UX

---

### NEW-A-H6 — App Status Endpoint Exposes Maintenance Mode to Unauthenticated Users

**File:** `app/_layout.tsx:294-336`

```tsx
const response = await fetch(`${baseUrl}/config/app-status`, {
  // No Authorization header — unauthenticated request
});
```

**Finding:** App-status endpoint fetched before auth layer resolves. No `Authorization` header sent. Any unauthenticated user can determine whether platform is in maintenance mode.

**Impact:** Information disclosure to unauthenticated users. Violates principle of least disclosure.

**Fix:** Move app-status check to after authentication, or require shared secret header.

**Category:** Security / Information Disclosure

---

## MEDIUM (7 new issues)

---

### NEW-A-M1 — No Mutation Hooks — All Mutations Use Raw Service Calls Outside React Query API

**Files:** All `hooks/queries/*.ts` — zero mutation hooks exist

**Finding:** Every mutation in every screen calls service methods directly (outside React Query). No `useMutation` hooks with `onSuccess`/`onError`/`onSettled`. No automatic cache invalidation.

**Impact:** After any create/update/delete, affected lists remain stale until manually refreshed. Admins may act on outdated data.

**Fix:** Create mutation hooks that call `queryClient.invalidateQueries()` on success:
```ts
export const useCreateOrder = () => useMutation({
  mutationFn: orderService.create,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: orderKeys.all }),
});
```

**Category:** Data & Sync (same root cause as `A10-H1`)

---

### NEW-A-M2 — `AdminUser.level` Always `undefined` at Runtime

**File:** `services/api/auth.ts:7-16`

```ts
export interface AdminUser {
  _id: string;
  // ...
  level: number; // ← Declared as required
}
```

**Finding:** JWT token payload never includes `level`. The field comes from MongoDB `Admin` document in login response. If `apiClient.get('admin/auth/me')` omits `level`, the field is `undefined`. Any numeric comparison on `user.level` silently fails.

**Impact:** `user.level` comparisons return `undefined`, causing silent permission failures.

**Fix:** Make `level` optional: `level?: number;`

**Category:** Type Safety / Functional Bug

---

### NEW-A-M3 — Live Monitor Countdown Desync from Refresh Interval

**File:** `app/(dashboard)/live-monitor.tsx:54, 491-496`

```ts
const REFRESH_INTERVAL = 10; // seconds
countdownRef.current = setInterval(() => {
  setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL : c - 1));
}, 1000);
```

**Finding:** Countdown resets to 10 when it reaches 1, showing `1, 10, 9...` instead of `1, refreshing...`. The 10-second interval and 1-second countdown are not synchronized — refresh fires at any countdown value.

**Impact:** Minor UX confusion — admin may think refresh is imminent at countdown=1, but it fires independently.

**Fix:** Reset to `REFRESH_INTERVAL - 1` or use `c <= 0` to show "refreshing..." state.

**Category:** UX

---

### NEW-A-M4 — Two `AdminUser` Types with Conflicting Field Names

**Files:**
- `services/api/auth.ts:7-16` (used) — `_id: string`, has `level`, `permissions`, no `walletId`
- `app/contexts/AuthContext.tsx:14-23` (unused) — `id: string`, no `level`, no `permissions`, has `walletId`

| Field | auth.ts | app/contexts/AuthContext.tsx |
|-------|---------|----------------------------|
| `_id` vs `id` | `_id` | `id` |
| `level` | present | absent |
| `permissions` | present | absent |
| `walletId` | absent | present |

**Impact:** Any component importing from the wrong context gets a type with completely different fields. `id` vs `_id` would cause runtime crashes.

**Fix:** Delete `app/contexts/AuthContext.tsx`.

**Category:** Architecture / Type Safety

---

### NEW-A-M5 — `logoutAllDevices` Error Swallowed, Local Session Still Cleared

**File:** `app/(dashboard)/settings.tsx:185-201`

```tsx
try {
  await authService.logoutAllDevices();
} catch {
  // Even if the API call fails, proceed with local logout...
}
await authLogout(); // ← continues even on API failure
```

**Finding:** API failure silently swallowed. Local session cleared regardless. Admin has no indication the remote logout-all failed.

**Impact:** Admin believes all sessions terminated, but some remain active on other devices. Security risk if device was compromised.

**Fix:**
```tsx
} catch (err: any) {
  showAlert('Warning', `Could not logout other sessions: ${err.message}. This session was cleared.`, 'warning');
  return;
}
await authLogout();
```

**Category:** Security / Functional Bug

---

### NEW-A-M6 — `AdminUser.role` Type Allows Non-Admin Roles

**File:** `services/api/auth.ts:11`

```ts
role: 'user' | 'consumer' | 'merchant' | 'admin' | 'support' | 'operator' | 'super_admin';
```

**Finding:** `AdminUser` type for the admin app includes `'user'`, `'consumer'`, `'merchant'` — roles that should never authenticate to the admin panel. `VALID_ADMIN_ROLES` correctly excludes these, but the type doesn't enforce it.

**Impact:** If backend returns a `user`-role token, the app stores it. The numeric hierarchy treats `'user'` as level 0, so access is denied — but the token is still stored, creating false authorization.

**Fix:**
```ts
role: 'admin' | 'support' | 'operator' | 'super_admin';
```

**Category:** Type Safety / Security

---

### NEW-A-M7 — `globalAlertRef` Module-Level Variable Race Condition

**File:** `contexts/AlertContext.tsx:45, 319, 324`

```ts
let globalAlertRef: AlertContextType | null = null; // line 45
globalAlertRef = contextValue; // line 319 — set on every render
globalAlertRef = null; // line 324 — cleared on unmount
```

**Finding:** Module-level mutable variable set synchronously during render. If two `AlertProvider` instances are mounted, the second overwrites the global ref. The first's unmount sets it to `null`, breaking the second instance.

**Impact:** In rare nested-provider scenarios, `globalAlertRef` can be `null` when accessed, causing `TypeError: Cannot read property showAlert of null`.

**Fix:** Use a WeakMap keyed by provider instance, or a ref-based approach.

**Category:** Edge Case / Reliability

---

## LOW (3 new issues)

---

### NEW-A-L1 — `AdminUser` Type Has No `walletId` Despite Unused Context Defining It

**File:** `app/contexts/AuthContext.tsx:19` (unused)

The unused `app/contexts/AuthContext.tsx` defines `walletId?: string`. The canonical `services/api/auth.ts` does not. No code accesses `user.walletId` for admin users.

**Impact:** Dead field in unused code.

**Category:** Type Safety

---

### NEW-A-L2 — `logoutAllDevices` No Idempotency Key — Backend May Process Twice

**File:** `services/api/auth.ts`

The `logoutAllDevices` method does not include an idempotency key. On network timeout, the backend may process the logout-all command twice.

**Impact:** Minor — worst case is two logout-all operations (idempotent from user's perspective).

**Category:** Reliability

---

### NEW-A-L3 — `isAdminRole` Uses `as any` for Role Check

**File:** `app/_layout.tsx:80`

```tsx
if (VALID_ADMIN_ROLES.includes(role as any)) {
```

**Finding:** `role` is `string | undefined`. `VALID_ADMIN_ROLES` is `readonly AdminRole[]`. The `includes` expects `AdminRole`, not `string`. `as any` bypasses TypeScript. This is actually correct at runtime — the fix is a type guard:

```ts
if (isValidAdminRole(role)) { return true; }
```

**Category:** Type Safety

---

## Summary

| Severity | Count | Issues |
|----------|-------|--------|
| CRITICAL | 3 | NEW-A-C1, NEW-A-C2, NEW-A-C3 |
| HIGH | 6 | NEW-A-H1 through NEW-A-H6 |
| MEDIUM | 7 | NEW-A-M1 through NEW-A-M7 |
| LOW | 3 | NEW-A-L1 through NEW-A-L3 |
| **TOTAL** | **19** | |

### By Category

| Category | Count | Issues |
|----------|-------|--------|
| Data & Sync | 4 | NEW-A-H1, NEW-A-H2, NEW-A-H3, NEW-A-M1 |
| Functional Bug | 4 | NEW-A-C1, NEW-A-H4, NEW-A-M2, NEW-A-M5 |
| Architecture | 3 | NEW-A-C3, NEW-A-M4, NEW-A-M6 |
| Type Safety | 3 | NEW-A-M2, NEW-A-M4, NEW-A-M6 |
| Security | 2 | NEW-A-H3, NEW-A-H6 |
| UX | 2 | NEW-A-C2, NEW-A-H5 |
| Error Handling | 1 | NEW-A-H4 |
| Info Disclosure | 1 | NEW-A-H6 |
| Reliability | 1 | NEW-A-M7 |

### Quick Fixes

| ID | Fix | Est. |
|----|-----|------|
| NEW-A-C3 + NEW-A-M4 + NEW-A-H3 | Delete `app/contexts/AuthContext.tsx` | 5 min |
| NEW-A-H1 | Add typed filter params to queryKeys | 30 min |
| NEW-A-H2 | Throw on `!res.success` in React Query select | 1h |
| NEW-A-H4 | Throw instead of silent fallback in getApprovalThreshold | 15 min |
| NEW-A-M2 | Make `level` optional in AdminUser | 5 min |
| NEW-A-M6 | Remove non-admin roles from AdminUser type | 5 min |
| NEW-A-L3 | Replace `as any` with type guard | 5 min |
