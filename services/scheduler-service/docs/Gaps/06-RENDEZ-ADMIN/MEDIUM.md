# RENDEZ ADMIN — MEDIUM GAPS

**App:** `rendez-admin/`
**Date:** 2026-04-16
**Severity:** 10 MEDIUM

---

### RZ-A-M1 — Stats Cached as Null on 401 — Empty Cards, No Error Message
**File:** `src/app/dashboard/page.tsx` (lines ~108-114)
**Status:** ACTIVE

### RZ-A-M2 — Gift Status Filter Badges Reflect Partial Data
**File:** `src/app/gifts/page.tsx` (lines ~190-193)
**Status:** ACTIVE

### RZ-A-M3 — Meetup Status Filter Doesn't Reset Pagination State
**File:** `src/app/meetups/page.tsx` (line ~59)
**Status:** ACTIVE

### RZ-A-M4 — Plan Cancel Failure Leaves UI Out of Sync
**File:** `src/app/plans/page.tsx` (lines ~53-66)
**Status:** ACTIVE

### RZ-A-M5 — Auto-Set `expiresAt` Overwrites Manual Edits
**File:** `src/app/coordinator/page.tsx` (lines ~130-136)
**Status:** ACTIVE

```typescript
const handleScheduledAt = (val: string) => {
 handleChange('scheduledAt', val);
 if (val) {
  const exp = new Date(new Date(val).getTime() + 24 * 3600 * 1000);
  handleChange('expiresAt', exp.toISOString().slice(0, 16)); // overwrites any manual edit
 }
};
```

### RZ-A-M6 — Uses `window.location.href` Instead of Router
**File:** `src/app/login/page.tsx` (line ~24)
**Status:** ACTIVE

### RZ-A-M7 — TanStack Query Installed But Never Initialized
**File:** `package.json` + `src/app/layout.tsx`
**Status:** ACTIVE

`@tanstack/react-query` is in dependencies but the app never wraps in `QueryClientProvider`. All data fetching is raw `fetch` with no retry, no cache, no deduplication.

### RZ-A-M8 — API Path Inconsistency (Part of RZ-A-C3)
**File:** `src/app/coordinator/page.tsx` (line ~121)
**Status:** ACTIVE

### RZ-A-M9 — `metadata` Export in Client Component Ignored
**File:** `src/app/layout.tsx` (line ~6)
**Status:** ACTIVE

### RZ-A-M10 — Hardcoded Gift Type Strings — No Unknown-Type Fallback
**File:** `src/app/gifts/page.tsx` (lines ~70, ~219)
**Status:** ACTIVE

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-A-M1 | MEDIUM | Stats null on 401 — empty cards | ACTIVE |
| RZ-A-M2 | MEDIUM | Gift filter badges partial data | ACTIVE |
| RZ-A-M3 | MEDIUM | Meetup filter no pagination reset | ACTIVE |
| RZ-A-M4 | MEDIUM | Plan cancel failure UI out of sync | ACTIVE |
| RZ-A-M5 | MEDIUM | Auto-set expiresAt overwrites manual edits | ACTIVE |
| RZ-A-M6 | MEDIUM | window.location.href instead of router | ACTIVE |
| RZ-A-M7 | MEDIUM | TanStack Query installed but unused | ACTIVE |
| RZ-A-M8 | MEDIUM | API path inconsistency | ACTIVE |
| RZ-A-M9 | MEDIUM | metadata export in client component | ACTIVE |
| RZ-A-M10 | MEDIUM | Hardcoded gift types — no fallback | ACTIVE |
