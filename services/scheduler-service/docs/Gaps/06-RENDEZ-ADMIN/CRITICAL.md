# RENDEZ ADMIN — CRITICAL GAPS

**App:** `rendez-admin/`
**Date:** 2026-04-16
**Severity:** 4 CRITICAL

---

### RZ-A-C1 — ALL API Calls Missing Authorization Header — Admin Completely Non-Functional

**File:** 9 pages (dashboard, users, moderation, gifts, meetups, fraud, plans, coordinator)
**Severity:** CRITICAL
**Category:** Security
**Status:** ACTIVE

**Root Cause:** The backend `adminAuth` middleware requires `Authorization: Bearer <ADMIN_API_KEY>` on every `/admin/*` route. The frontend stores the key in `sessionStorage` but **fails to send it on most API calls**.

Affected endpoints (all return 401 silently):
| File | Endpoint |
|------|----------|
| `dashboard/page.tsx:109-110` | `/admin/stats`, `/admin/stats/timeseries` |
| `users/page.tsx:30` | `/admin/users` |
| `users/page.tsx:49,60` | `/admin/users/:id/suspend`, `/admin/users/:id/unsuspend` |
| `moderation/page.tsx:29` | `/admin/reports` |
| `gifts/page.tsx:55` | `/admin/gifts` |
| `meetups/page.tsx:48` | `/admin/meetups` |
| `fraud/page.tsx:31` | `/admin/fraud` |
| `plans/page.tsx:44,58` | `/admin/plans` |
| `coordinator/page.tsx:77-78` | `/admin/coordinator/plans` |

**Fix Pattern:**
```typescript
const adminKey = sessionStorage.getItem('rendez_admin_key');
fetch(`${API}/admin/users?${params}`, {
 headers: { 'Authorization': `Bearer ${adminKey}` },
})
.then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
.then(data => { /* handle data */ })
.catch(err => { setError(err.message); });
```

**Prevention:** Create a shared API client (`src/lib/api.ts`) that injects the auth header automatically.

---

### RZ-A-C2 — No Next.js Middleware — All Routes Publicly Accessible

**File:** No `middleware.ts` exists
**Severity:** CRITICAL
**Category:** Security
**Status:** ACTIVE

**Code:**
```typescript
// layout.tsx — entirely client-side, bypassed by direct URL access
useEffect(() => {
 if (pathname === '/login') { setAuthed(true); return; }
 const key = sessionStorage.getItem('rendez_admin_key');
 if (!key) { router.replace('/login'); }
}, [pathname, router]);
```

**Root Cause:** No server-side route protection. Direct navigation to `/dashboard` renders the page shell before JS hydrates. SSR would serve the page to anyone.

**Fix:** Create `middleware.ts` at project root:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
 const path = req.nextUrl.pathname;
 if (path === '/login') return NextResponse.next();
 const adminKey = req.cookies.get('rendez_admin_key')?.value;
 if (!adminKey) return NextResponse.redirect(new URL('/login', req.url));
 return NextResponse.next();
}

export const config = {
 matcher: ['/((?!login|_next/static|_next/image|favicon.ico).*)'],
};
```
Note: Login must set an HttpOnly cookie instead of `sessionStorage`.

---

### RZ-A-C3 — API URL Mismatch Across Dashboard vs Other Pages

**File:** `dashboard/page.tsx:109` + `login/page.tsx:18` vs all other pages
**Severity:** CRITICAL
**Category:** API Contract
**Status:** ACTIVE

**Code:**
```typescript
// dashboard/login: uses this pattern — correct for /admin/* paths
const ADMIN_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// All other pages: strip /api/v1 from the URL
const API = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';
```

**Root Cause:** If `NEXT_PUBLIC_API_URL` is set to `https://api.example.com/api/v1`, dashboard/login hit `https://api.example.com/api/v1/admin/stats` while other pages hit `https://api.example.com/admin/users`. These are internally consistent IF the backend mounts at `/admin`, but the inconsistent pattern means any URL change breaks pages differently.

**Fix:** Unify into a single `src/lib/api.ts`:
```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';
export const API = `${BASE_URL}`;
```

---

### RZ-A-C4 — System Health Status Is Hardcoded Fake Data

**File:** `dashboard/page.tsx` (lines ~220-234)
**Severity:** CRITICAL
**Category:** UX / Data & Sync
**Status:** ACTIVE

**Code:**
```typescript
{[
 { label: 'Backend API', status: 'Operational', ok: true },
 { label: 'REZ Partner API', status: 'Connected', ok: true },
 { label: 'Gift Catalog Cache', status: 'Active', ok: true },
 { label: 'Background Workers', status: 'Running', ok: true },
 { label: 'WebSocket (Socket.io)', status: 'Live', ok: true },
].map((s) => ( ))}
```

**Root Cause:** All five system indicators are hardcoded to "green/ok=true". These show green even when the backend is down. The dashboard fetches `/admin/stats` (which silently fails due to missing auth header from RZ-A-C1) but never uses its result for real status.

**Fix:** Add a real health check endpoint to the backend and fetch it:
```typescript
const [health, setHealth] = useState<Record<string, boolean>>({});
useEffect(() => {
 fetch(`${API}/health`)
  .then(r => r.json())
  .then(data => setHealth(data))
  .catch(() => setHealth({}));
}, []);
```

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-A-C1 | CRITICAL | ALL API calls missing Authorization header | ACTIVE |
| RZ-A-C2 | CRITICAL | No Next.js middleware — routes publicly accessible | ACTIVE |
| RZ-A-C3 | CRITICAL | API URL mismatch across pages | ACTIVE |
| RZ-A-C4 | CRITICAL | System health hardcoded fake data | ACTIVE |
