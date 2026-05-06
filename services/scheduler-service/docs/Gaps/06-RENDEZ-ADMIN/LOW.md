# RENDEZ ADMIN — LOW GAPS

**App:** `rendez-admin/`
**Date:** 2026-04-16
**Severity:** 10 LOW

---

### RZ-A-L1 — No TypeScript Types Directory
**File:** No `src/types/` directory
**Status:** ACTIVE

All interfaces defined inline in each page. Shared types duplicated across 8+ files.

### RZ-A-L2 — Inline Styles Everywhere — No CSS/SCSS
**File:** All pages
**Status:** ACTIVE

Color tokens (`#7c3aed`, `#10b981`) repeated across 8 files. No shared design system.

### RZ-A-L3 — No Shared API Client
**File:** All pages
**Status:** ACTIVE

Each page independently constructs fetch calls with its own API constant and auth header pattern. Root cause of RZ-A-C1 and RZ-A-C3.

### RZ-A-L4 — FraudFlag Profile Field Name Mismatch
**File:** `src/app/fraud/page.tsx` (line ~12)
**Status:** ACTIVE

```typescript
profile: { id: string; name: string; city: string; phone: string };
// Backend returns: { user: { id, name, phone, city } }
// Code accesses: f.profile?.name — always undefined
```

### RZ-A-L5 — Meetup Interface Missing Backend Fields
**File:** `src/app/meetups/page.tsx` (lines ~6-18)
**Status:** ACTIVE

Missing `matchId`, `rezRewardRef`, `triggeredAt` that backend returns.

### RZ-A-L6 — `applicantCount` Interface Shadowing `_count.applications`
**File:** `src/app/plans/page.tsx` (line ~22)
**Status:** ACTIVE

### RZ-A-L7 — No City Filter in Users Page
**File:** `src/app/users/page.tsx`
**Status:** ACTIVE

Backend supports `city` and `isVerified` query params but frontend search only sends `search`.

### RZ-A-L8 — No Debounce on User Search
**File:** `src/app/users/page.tsx` (lines ~41-43)
**Status:** ACTIVE

### RZ-A-L9 — Client-Side Pagination on 500 Records
**File:** `src/app/gifts/page.tsx` (line ~51)
**Status:** ACTIVE

### RZ-A-L10 — Hardcoded Pagination Size — No Server Hint
**File:** `src/app/gifts/page.tsx` (line ~51)
**Status:** ACTIVE

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-A-L1 | LOW | No TypeScript types directory | ACTIVE |
| RZ-A-L2 | LOW | Inline styles everywhere | ACTIVE |
| RZ-A-L3 | LOW | No shared API client | ACTIVE |
| RZ-A-L4 | LOW | FraudFlag profile field mismatch | ACTIVE |
| RZ-A-L5 | LOW | Meetup missing backend fields | ACTIVE |
| RZ-A-L6 | LOW | applicantCount interface shadowing | ACTIVE |
| RZ-A-L7 | LOW | No city filter in users page | ACTIVE |
| RZ-A-L8 | LOW | No debounce on user search | ACTIVE |
| RZ-A-L9 | LOW | Client-side pagination on 500 records | ACTIVE |
| RZ-A-L10 | LOW | Hardcoded page size, no server hint | ACTIVE |
