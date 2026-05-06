# RENDEZ ADMIN — CRITICAL GAPS

**App:** `rendez-admin/`
**Date:** 2026-04-16
**Severity:** 4 CRITICAL

---

### RZ-A-C1 — ALL API Calls Missing Authorization Header

**Status:** OPEN
**Severity:** CRITICAL
**Impact:** Admin dashboard is completely non-functional — every API call returns 401

**Files:** 9 pages all make API calls without the required `Authorization: Bearer` header.

```typescript
// Every page has this pattern:
const { data } = await fetch(`${API_URL}/endpoint`)
// MISSING: headers: { Authorization: `Bearer ${token}` }
```

**Fix:** Extract token from localStorage/cookie and add to all fetch calls:
```typescript
const token = localStorage.getItem('auth_token')
const { data } = await fetch(`${API_URL}/endpoint`, {
  headers: { Authorization: `Bearer ${token}` }
})
```

---

### RZ-A-C2 — No Next.js Middleware — All Routes Publicly Accessible

**Status:** OPEN
**Severity:** CRITICAL
**Impact:** Admin routes have zero authentication — anyone can access admin pages

**File:** No `middleware.ts` file exists in the project.

**Fix:** Create `middleware.ts`:
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const token = req.cookies.get('auth_token')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!login|api|_next/static|_next/image|favicon.ico).*)']
}
```

---

### RZ-A-C3 — API URL Mismatch Across Dashboard vs Other Pages

**Status:** OPEN
**Severity:** CRITICAL
**Impact:** Dashboard uses wrong API URL — all calls fail

**File:** `src/app/dashboard/page.tsx:109`

```typescript
// Dashboard uses:
const API_URL = 'http://localhost:5000'

// Other pages use:
const API_URL = process.env.NEXT_PUBLIC_API_URL
```

**Fix:** Use consistent environment variable everywhere:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
```

---

### RZ-A-C4 — System Health Status Hardcoded Fake Data

**Status:** OPEN
**Severity:** CRITICAL
**Impact:** Health dashboard shows fake data — no actual monitoring

**File:** `src/app/dashboard/page.tsx:220`

```typescript
// Hardcoded fake data:
const healthData = {
  api: 'operational',
  database: 'operational',
  redis: 'operational',
}
// All values are always 'operational' regardless of actual state
```

**Fix:** Fetch real health data:
```typescript
const { data } = await fetch(`${API_URL}/health`, {
  headers: { Authorization: `Bearer ${token}` }
})
```
