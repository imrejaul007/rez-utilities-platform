# RENDEZ ADMIN — HIGH GAPS

**App:** `rendez-admin/`
**Date:** 2026-04-16
**Severity:** 7 HIGH

---

### RZ-A-H1 — `applicantCount` Declared But Undefined — Backend Returns `_count.applications`

**File:** `src/app/plans/page.tsx` (line ~22)
**Severity:** HIGH
**Category:** Functional
**Status:** ACTIVE

**Code:**
```typescript
interface Plan { applicantCount: number; } // declared
// Backend returns: { _count: { applications: N } }
// NOT: { applicantCount: N }
```

---

### RZ-A-H2 — Frontend Counts `checkinCount >= 2`, Backend Counts `rewardStatus === 'TRIGGERED'`

**File:** `src/app/meetups/page.tsx` (line ~60)
**Severity:** HIGH
**Category:** Data & Sync
**Status:** ACTIVE

**Code:**
```typescript
// Frontend:
validated: enriched.filter((r) => r.checkinCount >= 2).length,
// Backend:
validated: enriched.filter((r) => r.rewardStatus === 'TRIGGERED').length,
```

---

### RZ-A-H3 — Meetup Status Filter Labels Misleading vs Actual Reward State

**File:** `src/app/meetups/page.tsx` (line ~47)
**Severity:** HIGH
**Category:** Functional
**Status:** ACTIVE

Filter tabs show `['ALL', 'TRIGGERED', 'PENDING', 'FAILED']` filtering on `Reward.status`, but these are displayed as meetup validation statuses.

---

### RZ-A-H4 — Gift Stats Computed From 500-Record Subset Only

**File:** `src/app/gifts/page.tsx` (lines ~60-72)
**Severity:** HIGH
**Category:** Data & Sync
**Status:** ACTIVE

```typescript
const s: GiftStats = {
 total: data.length, // Only loaded page, not all gifts
 totalValuePaise: data.reduce((s, g) => s + g.amountPaise, 0),
};
```

Backend returns `take: 500`. If there are more than 500 gifts, all KPI cards show incomplete totals.

---

### RZ-A-H5 — No Pagination — 100 User Cap With No Indicator

**File:** `src/app/users/page.tsx`
**Severity:** HIGH
**Category:** Performance
**Status:** ACTIVE

Backend enforces `take: 100`. Frontend renders all returned users in a single table. Admins cannot see beyond the 100 newest records.

---

### RZ-A-H6 — Inconsistent API Base URL Construction (Part of RZ-A-C3)

**File:** `src/app/coordinator/page.tsx` (line ~77) vs all other pages
**Severity:** HIGH
**Category:** Architecture / API Contract
**Status:** ACTIVE

Same root cause as RZ-A-C3.

---

### RZ-A-H7 — Every Fetch Has No `response.ok` Check — All Failures Silent

**File:** All pages
**Severity:** HIGH
**Category:** Functional
**Status:** ACTIVE

**Code (pattern on every page):**
```typescript
fetch(`${API}/admin/users/${id}/suspend`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ reason: 'Admin action' }),
});
// No response.ok check — suspend could fail but UI proceeds as if success
```

Network errors, 4xx, and 5xx responses all fail silently. Admins get no feedback when suspend/dismiss/cancel/resolve actions fail.

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| RZ-A-H1 | HIGH | applicantCount undefined vs _count.applications | ACTIVE |
| RZ-A-H2 | HIGH | Frontend/backend validation count mismatch | ACTIVE |
| RZ-A-H3 | HIGH | Status filter labels misleading | ACTIVE |
| RZ-A-H4 | HIGH | Gift stats from 500-record subset only | ACTIVE |
| RZ-A-H5 | HIGH | No pagination — 100 user cap | ACTIVE |
| RZ-A-H6 | HIGH | API base URL inconsistency | ACTIVE |
| RZ-A-H7 | HIGH | Every fetch silent failure — no response.ok | ACTIVE |
