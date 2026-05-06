# RENDEZ ADMIN — LOW SEVERITY GAPS

**App:** `rendez-admin/`
**Date:** 2026-04-16
**Severity:** 14 LOW (+4 new from deep page audit)

---

### RZ-A-L1 — No Shared Types — All Data Uses `any`

**Status:** OPEN
**Severity:** LOW
**Impact:** Type safety completely bypassed

**Fix:** Define interfaces for all API responses:
```typescript
interface User { id: string; name: string; email: string; role: UserRole }
interface Booking { id: string; status: BookingStatus; amount: number }
```

---

### RZ-A-L2 — Inline Styles Instead of Tailwind Classes

**Status:** OPEN
**Severity:** LOW
**Impact:** Inconsistent styling, hard to maintain

**Fix:** Extract to Tailwind classes or CSS modules.

---

### RZ-A-L3 — No TypeScript `as` Assertions — Uses `any` Implicitly

**Status:** OPEN
**Severity:** LOW
**Impact:** Runtime errors possible

**Fix:** Add strict TypeScript config:
```json
// tsconfig.json
{ "strict": true, "noImplicitAny": true }
```

---

### RZ-A-L4 — No `export` on Shared Utility Functions

**Status:** OPEN
**Severity:** LOW
**Impact:** Harder to test and reuse utilities

**Fix:** Export all shared utilities:
```typescript
export function formatCurrency(amount: number) { ... }
export function formatDate(date: string) { ... }
```

---

### RZ-A-L5 — Duplicate Color Definitions Across Components

**Status:** OPEN
**Severity:** LOW
**Impact:** Inconsistent UI

**Fix:** Define theme in Tailwind config:
```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: { brand: '#6366f1', danger: '#ef4444' }
  }
}
```

---

### RZ-A-L6 — No Keyboard Shortcuts for Common Actions

**Status:** OPEN
**Severity:** LOW
**Impact:** Slower admin workflow

**Fix:** Add keyboard shortcuts:
```typescript
useEffect(() => {
  const handler = (e) => {
    if (e.key === 'n' && e.ctrlKey) createNewOrder()
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

---

### RZ-A-L7 — No Confirmation Dialog Before Delete Actions

**Status:** OPEN
**Severity:** LOW
**Impact:** Accidental deletion possible

**Fix:** Add confirmation dialog:
```typescript
const handleDelete = (id: string) => {
  if (confirm('Delete this item? This cannot be undone.')) {
    deleteItem(id)
  }
}
```

---

### RZ-A-L8 — Pagination Controls Not Disabled During Loading

**Status:** OPEN
**Severity:** LOW
**Impact:** User can double-click during load

**Fix:** Disable controls while loading:
```typescript
<button disabled={isLoading} onClick={nextPage}>Next</button>
```

---

### RZ-A-L9 — Favicon Is Missing or Default

**Status:** OPEN
**Severity:** LOW
**Impact:** Branded icon missing

**Fix:** Add `public/favicon.ico` with branded icon.

---

### RZ-A-L10 — No Empty State Messages — Blank Pages on No Data

**Status:** OPEN
**Severity:** LOW
**Impact:** Unclear whether data is loading or empty

**Fix:** Add empty state:
```typescript
if (!data?.length) return <EmptyState message="No users found" />
```

---

### RZ-A-L11 — Age Displayed as Raw Number with No Fallback for Null

**File:** `src/app/users/page.tsx` (line ~123)
**Status:** ACTIVE
**Severity:** LOW
**Category:** Data & Sync

```tsx
<td>{u.age}</td>  // where age is number | null in the database
```

**Root Cause:** Prisma returns `null` for nullable fields. React renders `null` as the string "null" in the table, producing a confusing "null" label in the age column.

**Fix:** `<td>{u.age ?? '—'}</td>`

---

### RZ-A-L12 — API URL Variable Inconsistent Construction Across Admin Pages

**File:** `src/app/users/page.tsx` (line ~4) vs other admin pages
**Status:** ACTIVE
**Severity:** LOW
**Category:** API Contract

```typescript
// This page:
const API = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';
// Other pages:
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
```

**Root Cause:** The `replace('/api/v1', '')` strips a version prefix that may or may not exist. If `NEXT_PUBLIC_API_URL = 'http://localhost:4000/api/v1'`, users/page uses `'http://localhost:4000'` while other pages use `'http://localhost:4000/api/v1'` — the base URL differs by page.

**Fix:** Standardize on a single URL construction pattern via a shared lib.

---

### RZ-A-L13 — No Token Expiry / Refresh Mechanism in Auth Store

**File:** `rendez-app/src/store/authStore.ts` (lines ~15-16)
**Status:** ACTIVE
**Severity:** LOW
**Category:** Business Logic

```typescript
interface AuthState {
  token: string | null;
  profile: UserProfile | null;
  // No refreshToken, no expiry tracking
}
```

**Root Cause:** The store only stores the JWT. If the token expires, the store continues to hold the expired token and all API calls silently fail with 401. No refresh flow, no `jwt.exp` decoding, no re-auth trigger.

**Fix:** Decode JWT on store hydration to track expiry. Implement a refresh flow when within 5 minutes of expiry.

---

### RZ-A-L14 — `UserProfile` Interface Missing `intent` Field

**File:** `rendez-app/src/store/authStore.ts` (lines ~4-12)
**Status:** ACTIVE
**Severity:** LOW
**Category:** Data & Sync

```typescript
interface UserProfile {
  id: string; name: string; photos: string[];
  rezUserId?: string; city?: string; age?: number; gender?: string;
  // intent field MISSING — backend returns it but it's silently dropped
}
```

**Fix:** Add `intent?: string` to `UserProfile`.

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-A-L1 | LOW | No shared types — all data uses `any` | ACTIVE |
| RZ-A-L2 | LOW | Inline styles instead of Tailwind | ACTIVE |
| RZ-A-L3 | LOW | No TypeScript `as` assertions | ACTIVE |
| RZ-A-L4 | LOW | No `export` on shared utilities | ACTIVE |
| RZ-A-L5 | LOW | Duplicate color definitions | ACTIVE |
| RZ-A-L6 | LOW | No keyboard shortcuts | ACTIVE |
| RZ-A-L7 | LOW | No confirmation dialog before delete | ACTIVE |
| RZ-A-L8 | LOW | Pagination not disabled during loading | ACTIVE |
| RZ-A-L9 | LOW | Favicon missing | ACTIVE |
| RZ-A-L10 | LOW | No empty state messages | ACTIVE |
| RZ-A-L11 | LOW | Null age renders as "null" | ACTIVE |
| RZ-A-L12 | LOW | API URL variable inconsistent construction | ACTIVE |
| RZ-A-L13 | LOW | No token expiry / refresh mechanism | ACTIVE |
| RZ-A-L14 | LOW | UserProfile missing `intent` field | ACTIVE |
