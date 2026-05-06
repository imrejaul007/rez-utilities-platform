# RENDEZ ADMIN — MEDIUM SEVERITY GAPS

**App:** `rendez-admin/`
**Date:** 2026-04-16
**Severity:** 19 MEDIUM (+9 new from deep page audit)

---

### RZ-A-M1 — TanStack Query Not Used for Data Fetching

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** No caching, no background refetch, no stale-while-revalidate

All pages use raw `fetch` instead of TanStack Query which is already installed.

**Fix:** Wrap data fetching with `useQuery`:
```typescript
const { data, isLoading, refetch } = useQuery({
  queryKey: ['users'],
  queryFn: () => fetch(`${API_URL}/users`).then(r => r.json()),
  staleTime: 5 * 60 * 1000,
})
```

---

### RZ-A-M2 — Dead Code: Unused Helper Functions

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** Maintenance confusion

**File:** `src/lib/utils.ts`

Functions like `formatCurrency`, `truncateText`, `generateId` are defined but never used.

**Fix:** Remove dead code and add ESLint rule:
```typescript
// .eslintrc.json
"no-unused-vars": "error"
```

---

### RZ-A-M3 — Inconsistent Date Formatting Across Pages

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** Admin sees different date formats on different pages

**Fix:** Use a single date utility:
```typescript
// src/lib/date.ts
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(date))
```

---

### RZ-A-M4 — No Loading Skeletons — Flash of Unstyled Content

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** Pages jump from blank to loaded

**Fix:** Add skeleton loaders:
```typescript
{isLoading ? (
  <div className="animate-pulse space-y-4">
    <div className="h-8 bg-gray-200 rounded" />
    <div className="h-32 bg-gray-100 rounded" />
  </div>
) : <Content data={data} />}
```

---

### RZ-A-M5 — Form Validation Only Client-Side

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** Admins can bypass validation via API directly

**Fix:** Add server-side validation in API routes.

---

### RZ-A-M6 — Dashboard Metrics Refresh on Every Route Change

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** No memoization — expensive calculations on every render

**Fix:** Wrap expensive computations with `useMemo`:
```typescript
const totalRevenue = useMemo(() =>
  orders.reduce((sum, o) => sum + o.amount, 0),
  [orders]
)
```

---

### RZ-A-M7 — No Error Boundaries — App Crashes Entirely

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** A single component crash takes down the whole admin panel

**Fix:** Add error boundary:
```typescript
<ErrorBoundary>
  <Dashboard />
</ErrorBoundary>
```

---

### RZ-A-M8 — Sensitive Data Logged to Console in Production

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** Token and user data exposed in browser console

**Fix:** Remove console.log and use telemetry:
```typescript
import { logger } from '@/lib/telemetry'
logger.info('User action', { userId, action })
```

---

### RZ-A-M9 — Offline Indicator Missing

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** Admin doesn't know when they lose connection

**Fix:** Add offline detection:
```typescript
const [online, setOnline] = useState(navigator.onLine)
useEffect(() => {
  window.addEventListener('online', () => setOnline(true))
  window.addEventListener('offline', () => setOnline(false))
}, [])
if (!online) return <OfflineBanner />
```

---

### RZ-A-M10 — Image Upload No Compression — Large Payloads

**Status:** OPEN
**Severity:** MEDIUM
**Impact:** Admin can upload 10MB+ images that slow down the app

**Fix:** Compress images before upload:
```typescript
const compress = async (file: File) => {
  const img = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.width / 2
  canvas.height = img.height / 2
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob>((res) =>
    canvas.toBlob(b => res(b!), 'image/webp', 0.8)
  )
}
```

---

### RZ-A-M11 — Search Triggers Without Debounce — Race Condition on Rapid Input

**File:** `src/app/users/page.tsx` (lines ~39-44)
**Status:** ACTIVE
**Severity:** MEDIUM
**Category:** Data & Sync

```typescript
const handleSearch = (e) => {
  setSearch(e.target.value);
  if (e.target.value.length === 0 || e.target.value.length >= 2) {
    fetchUsers(e.target.value); // fires on EVERY keystroke at len >= 2
  }
};
```

**Root Cause:** No debounce. Rapid typing fires multiple overlapping `fetch` requests. The last response to arrive (which may not be from the last request sent) wins and updates the table with stale results.

**Fix:** Add debounce (300ms) or use an `AbortController` to cancel in-flight requests.

---

### RZ-A-M12 — `reviewedBy` Always Set to String Literal `'admin'` Instead of Actual Admin ID

**File:** `src/app/moderation/page.tsx` (line ~43)
**Status:** ACTIVE
**Severity:** MEDIUM
**Category:** Business Logic

```typescript
body: JSON.stringify({ status, reviewedBy: 'admin' })
```

**Root Cause:** The admin key is stored in sessionStorage but never decoded. The `reviewedBy` field on every report record is the literal string `'admin'` regardless of which admin performed the action, making audit attribution impossible.

**Fix:** Store the admin ID alongside the sessionStorage token and use it here. Alternatively, decode the JWT from the admin key to extract the admin ID.

---

### RZ-A-M13 — Moderation Action Button Stuck in Loading State on Error

**File:** `src/app/moderation/page.tsx` (lines ~40-50)
**Status:** ACTIVE
**Severity:** MEDIUM
**Category:** Functional

```typescript
const resolve = async (id: string, status: string) => {
  setActing(id);
  await fetch(`${API}/admin/reports/${id}`, { method: 'PATCH', ... });
  setActing(null);
  fetchReports();
};
```

**Root Cause:** If the `fetch` throws (network error) or returns a non-ok status, `setActing(null)` is still called but `fetchReports()` runs immediately. The table updates with stale data before the request fully settles. More critically, the `acting` state is never cleared if there's an unhandled exception — the button stays in "..." permanently.

**Fix:** Wrap in try/catch with `finally`:
```typescript
try {
  const r = await fetch(...);
  if (!r.ok) throw new Error();
} finally {
  setActing(null);
}
fetchReports();
```

---

### RZ-A-M14 — Fraud Resolve State Never Cleared on Error

**File:** `src/app/fraud/page.tsx` (lines ~40-45)
**Status:** ACTIVE
**Severity:** MEDIUM
**Category:** Functional

```typescript
const resolve = async (id: string) => {
  setResolving(id);
  await fetch(`${API}/admin/fraud/${id}/resolve`, { method: 'PATCH' });
  setResolving(null);
  fetchFlags();
};
```

**Root Cause:** Same as RZ-A-M13. If the `fetch` fails, `setResolving(null)` is skipped and the button stays stuck in "...". `fetchFlags()` also never runs on failure.

**Fix:** Wrap in try/catch with `finally`, check response `ok` status.

---

### RZ-A-M15 — Duplicate BullMQ `removeRepeatable` Failure Silently Suppressed

**File:** `rendez-backend/src/jobs/queue.ts` (lines ~43-51)
**Status:** ACTIVE
**Severity:** MEDIUM
**Category:** Functional

```typescript
await Promise.all([
  giftExpiryQueue.removeRepeatable('check-expired-gifts', { every: 5 * 60 * 1000 }),
  // ... 6 more
]).catch(() => {}); // ← ALL errors silently swallowed

await Promise.all([
  giftExpiryQueue.add('check-expired-gifts', {}, { repeat: { every: 5 * 60 * 1000 } }),
  // ... 6 more
]);
```

**Root Cause:** The `.catch(() => {})` suppresses all errors from `removeRepeatable`. If removal fails (job doesn't exist, Redis unavailable, wrong repeat key format), the code proceeds to `add` a new repeatable job. BullMQ creates duplicate workers running on the same schedule, doubling or multiplying workload on every process restart.

**Fix:** Log errors instead of swallowing them:
```typescript
.catch((err) => {
  console.error('[Jobs] removeRepeatable failed:', err);
});
```

---

### RZ-A-M16 — Prisma Singleton Guard Missing in Production

**File:** `rendez-backend/src/config/database.ts` (line ~19)
**Status:** ACTIVE
**Severity:** MEDIUM
**Category:** Architecture

```typescript
if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Root Cause:** In production, `globalForPrisma.prisma` is never set. In serverless warm invocations or multiple Jest workers, each import creates a new `PrismaClient` instance. Prisma has an upper bound on connection pool size; multiple instances exhaust it.

**Fix:** Always assign to `globalForPrisma.prisma`:
```typescript
globalForPrisma.prisma = prisma; // dev-only guard is a remnant of older Prisma
```

---

### RZ-A-M17 — `partnerAudit` Event Listener Not Removed After Firing

**File:** `rendez-backend/src/middleware/partnerAudit.ts` (lines ~50-53)
**Status:** ACTIVE
**Severity:** MEDIUM
**Category:** Performance

```typescript
res.on('finish', () => {
  entry.status = res.statusCode;
  log(entry);
});
```

**Root Cause:** The `finish` event fires exactly once, but the listener holds references to `req`, `res`, `entry`, and the closure scope until response completion. On high-throughput servers with expensive `log()` serialization, this adds memory pressure. The idiomatic fix is to remove the listener after firing.

**Fix:**
```typescript
const handler = () => {
  entry.status = res.statusCode;
  log(entry);
  res.removeListener('finish', handler);
};
res.on('finish', handler);
```

---

### RZ-A-M18 — Unhandled SecureStore Rejection Locks App in Perpetual Loading

**File:** `rendez-app/src/store/authStore.ts` (lines ~44-50)
**Status:** ACTIVE
**Severity:** MEDIUM
**Category:** Functional

```typescript
loadToken: async () => {
  const [token, onboarded] = await Promise.all([
    SecureStore.getItemAsync('rendez_token'),
    SecureStore.getItemAsync('rendez_onboarded'),
  ]);
  set({ token, isLoading: false, hasSeenOnboarding: onboarded === '1' });
},
```

**Root Cause:** `SecureStore.getItemAsync` can reject (device keychain unavailable, Android emulator, permissions). If it rejects, `Promise.all` rejects, `loadToken()` rejects with no `.catch()`. The Zustand store never updates `isLoading: false`, leaving the app permanently stuck.

**Fix:**
```typescript
loadToken: async () => {
  try {
    const [token, onboarded] = await Promise.all([...]);
    set({ token, isLoading: false, hasSeenOnboarding: onboarded === '1' });
  } catch {
    set({ token: null, isLoading: false, hasSeenOnboarding: false });
  }
},
```

---

### RZ-A-M19 — `setToken` Silently Fails If SecureStore Throws

**File:** `rendez-app/src/store/authStore.ts` (lines ~32-35)
**Status:** ACTIVE
**Severity:** MEDIUM
**Category:** Functional

```typescript
setToken: async (token) => {
  await SecureStore.setItemAsync('rendez_token', token); // can throw
  set({ token });
},
```

**Root Cause:** If `SecureStore.setItemAsync` throws (keychain full, permission denied), the exception propagates uncaught and `set({ token })` is never called. The user is effectively logged in (store updated) but their token is not persisted. On next app restart, `loadToken` finds no token and logs the user out.

**Fix:**
```typescript
setToken: async (token) => {
  try {
    await SecureStore.setItemAsync('rendez_token', token);
  } catch (err) {
    console.warn('[Auth] Failed to persist token:', err);
  }
  set({ token });
},
```

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-A-M1 | MEDIUM | TanStack Query not used | ACTIVE |
| RZ-A-M2 | MEDIUM | Dead code: unused helpers | ACTIVE |
| RZ-A-M3 | MEDIUM | Inconsistent date formatting | ACTIVE |
| RZ-A-M4 | MEDIUM | No loading skeletons | ACTIVE |
| RZ-A-M5 | MEDIUM | Form validation client-side only | ACTIVE |
| RZ-A-M6 | MEDIUM | Dashboard metrics refetch on route change | ACTIVE |
| RZ-A-M7 | MEDIUM | No error boundaries | ACTIVE |
| RZ-A-M8 | MEDIUM | Sensitive data logged to console | ACTIVE |
| RZ-A-M9 | MEDIUM | Offline indicator missing | ACTIVE |
| RZ-A-M10 | MEDIUM | Image upload no compression | ACTIVE |
| RZ-A-M11 | MEDIUM | Search triggers without debounce — race condition | ACTIVE |
| RZ-A-M12 | MEDIUM | reviewedBy always literal 'admin' — no attribution | ACTIVE |
| RZ-A-M13 | MEDIUM | Moderation action button stuck on error | ACTIVE |
| RZ-A-M14 | MEDIUM | Fraud resolve button stuck on error | ACTIVE |
| RZ-A-M15 | MEDIUM | BullMQ removeRepeatable silent failure creates duplicates | ACTIVE |
| RZ-A-M16 | MEDIUM | Prisma singleton not guarded in production | ACTIVE |
| RZ-A-M17 | MEDIUM | partnerAudit listener not removed after firing | ACTIVE |
| RZ-A-M18 | MEDIUM | SecureStore rejection locks app in loading state | ACTIVE |
| RZ-A-M19 | MEDIUM | setToken silently fails if SecureStore throws | ACTIVE |
