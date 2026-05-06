# Gaps: RENDEZ ADMIN DASHBOARD

**App:** `rendez-admin/` (Next.js 14/TanStack Query)
**Source:** Deep audit 2026-04-16 (Rendez monorepo)
**Total Issues:** 31 (4 CRITICAL, 7 HIGH, 10 MEDIUM, 10 LOW)

---

## Issues by Category

| Category | CRITICAL | HIGH | MEDIUM | LOW |
|----------|----------|------|--------|-----|
| Security | 2 | — | 1 | 1 |
| API Contract | 1 | 1 | — | 1 |
| Functional | — | 2 | 3 | 2 |
| Data & Sync | 1 | 2 | 2 | 1 |
| UX / Flow | — | — | 1 | 1 |
| Business Logic | — | 1 | 1 | — |
| Architecture | — | 1 | 1 | 2 |
| Offline / Sync | — | — | 1 | — |
| Performance | — | — | — | 1 |
| Enum / Status | — | — | — | 1 |

---

## Files

| File | Description |
|------|-------------|
| `CRITICAL.md` | Auth headers missing, no middleware, fake health status, URL mismatch |
| `HIGH.md` | Type mismatches, wrong calculations, no pagination, silent fetch failures |
| `MEDIUM.md` | Inconsistent API patterns, TanStack unused, dead code |
| `LOW.md` | No shared types, inline styles, fraud flag field mismatch |

---

## Quick Reference

| ID | Severity | Title | Location |
|----|----------|-------|----------|
| RZ-A-C1 | CRITICAL | ALL API calls missing `Authorization: Bearer` header — admin completely non-functional | 9 pages |
| RZ-A-C2 | CRITICAL | No Next.js middleware — all routes publicly accessible | No `middleware.ts` |
| RZ-A-C3 | CRITICAL | API URL mismatch across dashboard vs other pages | `dashboard/page.tsx:109` |
| RZ-A-C4 | CRITICAL | System health status hardcoded fake data | `dashboard/page.tsx:220` |
| RZ-A-H7 | HIGH | Every fetch has no `response.ok` check — all failures silent | All pages |
| RZ-A-H5 | HIGH | No pagination — 100 user cap with no indicator | `users/page.tsx` |
| RZ-A-H2 | HIGH | Frontend counts `checkinCount >= 2`, backend counts `rewardStatus === 'TRIGGERED'` | `meetups/page.tsx:60` |
