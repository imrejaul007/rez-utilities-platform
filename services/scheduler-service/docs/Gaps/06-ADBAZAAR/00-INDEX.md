# AdBazaar — Gap Analysis Index

**Generated:** 2026-04-17
**Scope:** adBazaar (Next.js + Supabase + Razorpay marketplace)
**Audit Method:** 3-agent parallel deep audit (Security + Business Logic + Code Structure) + Round 2 + Round 3 deep source scans
**Status:** 37 FIXED — 74 OPEN — across 3 audit rounds

---

## IMPORTANT — Source of Truth for Fixes

**The definitive fix documentation has been moved to:**
```
/Users/rejaulkarim/Documents/ReZ Full App/adBazaar/FIXES-REQUIRED.md
```

This file contains:
- Complete fix requirements with code examples
- Priority-ordered fix checklist
- File index with issue mappings
- Database migration requirements

**Quick summary:** `/Users/rejaulkarim/Documents/ReZ Full App/adBazaar/FIXES-SUMMARY.md`

---

## Folder Structure

```
06-ADBAZAAR/
├── 00-INDEX.md                    ← You are here
├── SECURITY.md                    ← 17 issues (5 CRIT, 5 HIGH, 4 MED, 3 LOW)
├── BUSINESS-LOGIC.md             ← 8 issues (2 CRIT, 3 HIGH, 2 MED, 1 LOW)
├── PAYMENT.md                     ← 7 issues (1 CRIT, 2 HIGH, 2 MED, 2 LOW)
├── DATA-SYNC.md                   ← 4 issues (1 CRIT, 1 HIGH, 2 MED)
├── ARCHITECTURE.md               ← 4 issues (0 CRIT, 0 HIGH, 2 MED, 2 LOW)
└── 07-NEW-FINDINGS.md           ← 71 new issues across 2 rounds (10 CRIT, 20 HIGH, 33 MED, 8 LOW) — 2026-04-17

FIXES-REQUIRED.md                 ← MAIN FIX DOCUMENT (for development team)
FIXES-SUMMARY.md                  ← Executive summary
```

---

## Summary by Severity (Combined — All Rounds)

| Category | CRITICAL | HIGH | MEDIUM | LOW | Total | Fixed |
|----------|----------|------|--------|-----|-------|-------|
| Security | 5 | 5 | 4 | 3 | **17** | 10 |
| Business Logic | 2 | 3 | 2 | 1 | **8** | 4 |
| Payment/Financial | 1 | 2 | 2 | 2 | **7** | 2 |
| Data Sync | 1 | 1 | 2 | 0 | **4** | 0 |
| Architecture | 0 | 0 | 2 | 2 | **4** | 0 |
| Round 2 New | 6 | 10 | 19 | 5 | **40** | 10 |
| Round 3 New | 4 | 10 | 14 | 3 | **31** | 11 |
| **TOTAL** | **19** | **31** | **45** | **16** | **111** | **37** |
| **Remaining OPEN** | 10 | 22 | 39 | 12 | **83** | — |

---

## Quick Navigation — CRITICAL Issues

| ID | File | Title | Status |
|----|------|-------|--------|
| AB-C1 | `SECURITY.md` | `rez_user_id` spoofable via URL query param — coin fraud | FIXED |
| AB-C2 | `SECURITY.md` | No rate limiting on QR scan, view count, listings APIs | FIXED |
| AB-C3 | `SECURITY.md` | Full bank account numbers + IFSC in profile API | FIXED |
| AB-C4 | `SECURITY.md` | No idempotency key on booking creation | FIXED |
| AB-C5 | `SECURITY.md` | Payment amount never verified server-side | FIXED |
| AB-P1 | `PAYMENT.md` | Messages table `body` column — API inserts `content` — broken | FIXED |
| AB-B1 | `BUSINESS-LOGIC.md` | Visit bonus coins (100) promised in UI, never credited | FIXED |
| AB-B2 | `BUSINESS-LOGIC.md` | `purchase_bonus_pct` always hardcoded to 5, advertiser config ignored | FIXED |
| AB-D1 | `DATA-SYNC.md` | No real-time sync — notifications fire-and-forget | PARTIAL |

## Quick Navigation — HIGH Issues

| ID | File | Title |
|----|------|-------|
| AB-B3 | `BUSINESS-LOGIC.md` | Refund webhook does NOT update booking status |
| AB-B4 | `BUSINESS-LOGIC.md` | Inquiry-accepted bookings stuck in "Confirmed" |
| AB-B5 | `BUSINESS-LOGIC.md` | Earnings aggregates include refunded bookings |
| AB-P3 | `PAYMENT.md` | `paid` status counted as pending payout |
| AB-D2 | `DATA-SYNC.md` | Attribution records never populate `booking_id` |
| AB-H1 | `SECURITY.md` | `createServerClient` silently falls back to anon key |
| AB-H2 | `SECURITY.md` | Admin auth uses fragile manual cookie parsing |
| AB-H3 | `SECURITY.md` | Fire-and-forget promises swallow all errors |
| AB-H4 | `SECURITY.md` | `RAZORPAY_KEY_ID` unnecessarily in API response |
| AB-H5 | `SECURITY.md` | Empty `next.config.ts` — no security headers |

---

## Cross-Repo Notes

AdBazaar is a **standalone Next.js app** with its own Supabase database. It integrates with the REZ ecosystem via:
- `REZ_API_BASE_URL` — credits coins via `/api/adbazaar/scan`
- `REZ_MARKETING_SERVICE_URL` — marketing broadcasts
- REZ webhooks for visit/purchase attribution

AdBazaar shares **zero MongoDB collections** with REZ backend. All data is in Supabase PostgreSQL.

**Key cross-repo issues (see `docs/Gaps/09-CROSS-SERVICE-2026/`):**
- [XF-1](docs/Gaps/09-CROSS-SERVICE-2026/XF-1-FIRE-AND-FORGET.md) — REZ coin credit fire-and-forget
- [XF-2](docs/Gaps/09-CROSS-SERVICE-2026/XF-2-USER-SPOOFING.md) — `rez_user_id` spoofing from AdBazaar to REZ
- [XF-3](docs/Gaps/09-CROSS-SERVICE-2026/XF-3-ATTRIBUTION-DUAL.md) — Dual attribution tracking
- [XF-4](docs/Gaps/09-CROSS-SERVICE-2026/XF-4-WALLET-EARNINGS-MISMATCH.md) — REZ wallet vs AdBazaar earnings
- [XF-6](docs/Gaps/09-CROSS-SERVICE-2026/XF-6-SCHEMA-API-MISMATCH.md) — Column name mismatches

---

## Quick Fix Wins (Under 1 Hour Each)

| ID | Fix | Time | Severity | Status |
|----|-----|------|---------|--------|
| AB-P1 | Change `content:` → `body:` in messages/route.ts:90 | 5 min | CRITICAL | FIXED |
| AB-H1 | Throw instead of fallback in createServerClient | 5 min | HIGH | FIXED |
| AB-B2 | Change `purchase_bonus_pct: 5` → `qr.purchase_bonus_pct ?? 5` | 5 min | CRITICAL | FIXED |
| AB-H4 | Remove RAZORPAY_KEY_ID from API response | 5 min | HIGH | FIXED |
| AB-P3 | Remove `paid` from pending payout filter | 5 min | HIGH | FIXED |
| AB-B5 | Add `refunded` to earnings exclusion filter | 5 min | HIGH | FIXED |
| AB-C3 | Remove/mask bank fields from profile `.select()` | 15 min | CRITICAL | FIXED |
| AB-A4 | Delete dead `getBroadcastStatus` function | 5 min | LOW | — |
| AB-L3 | Replace `includes()` with `startsWith()` for cookie matching | 10 min | LOW | FIXED |

---

## Status Tracker

| ID | Severity | Status | Fixed In |
|----|----------|--------|---------|
| AB-C1 | CRITICAL | FIXED | 2026-04-17 |
| AB-C2 | CRITICAL | FIXED | 2026-04-17 |
| AB-C3 | CRITICAL | FIXED | 2026-04-17 |
| AB-C4 | CRITICAL | FIXED | 2026-04-17 |
| AB-C5 | CRITICAL | FIXED | 2026-04-17 |
| AB-B1 | CRITICAL | FIXED | 2026-04-17 |
| AB-B2 | CRITICAL | FIXED | 2026-04-17 |
| AB-P1 | CRITICAL | FIXED | 2026-04-17 |
| AB-D1 | CRITICAL | PARTIAL | 2026-04-17 |
| AB-H1 | HIGH | FIXED | 2026-04-17 |
| AB-H2 | HIGH | OPEN | — |
| AB-H3 | HIGH | OPEN | — |
| AB-H4 | HIGH | FIXED | 2026-04-17 |
| AB-H5 | HIGH | DEFERRED | — |
| AB-B3 | HIGH | FIXED | 2026-04-17 |
| AB-B4 | HIGH | OPEN | — |
| AB-B5 | HIGH | FIXED | 2026-04-17 |
| AB-P2 | HIGH | OPEN | — |
| AB-P3 | HIGH | FIXED | 2026-04-17 |
| AB-D2 | HIGH | OPEN | — |
| AB-M1 | MEDIUM | FIXED | 2026-04-17 |
| AB-M2 | MEDIUM | OPEN | — |
| AB-M3 | MEDIUM | OPEN | — |
| AB-M4 | MEDIUM | FIXED | 2026-04-17 |
| AB-M5 | MEDIUM | OPEN | — |
| AB-M6 | MEDIUM | OPEN | — |
| AB-P4 | MEDIUM | OPEN | — |
| AB-P5 | MEDIUM | OPEN | — |
| AB-D3 | MEDIUM | OPEN | — |
| AB-D4 | MEDIUM | OPEN | — |
| AB-A1 | MEDIUM | OPEN | — |
| AB-A2 | MEDIUM | OPEN | — |
| AB-A3 | LOW | OPEN | — |
| AB-A4 | LOW | OPEN | — |
| AB-P6 | LOW | OPEN | — |
| AB-P7 | LOW | OPEN | — |
| AB-L1 | LOW | OPEN | — |
| AB-L2 | LOW | OPEN | — |
| AB-L3 | LOW | FIXED | 2026-04-17 |
| **Round 2 — New Findings (2026-04-17)** | | | |
| AB2-C1 | CRITICAL | OPEN | — |
| AB2-C2 | CRITICAL | OPEN | — |
| AB2-C3 | CRITICAL | FIXED | 2026-04-17 |
| AB2-C4 | CRITICAL | FIXED | 2026-04-17 |
| AB2-C5 | CRITICAL | FIXED | 2026-04-17 |
| AB2-C6 | CRITICAL | FIXED | 2026-04-17 |
| AB2-H1 | HIGH | OPEN | — |
| AB2-H2 | HIGH | OPEN | — |
| AB2-H3 | HIGH | OPEN | — |
| AB2-H4 | HIGH | OPEN | — |
| AB2-H5 | HIGH | FIXED | 2026-04-17 |
| AB2-H6 | HIGH | OPEN | — |
| AB2-H7 | HIGH | FIXED | 2026-04-17 |
| AB2-H8 | HIGH | OPEN | — |
| AB2-H9 | HIGH | OPEN | — |
| AB2-H10 | HIGH | OPEN | — |
| AB2-M1 | MEDIUM | FIXED | 2026-04-17 |
| AB2-M2 | MEDIUM | FIXED | 2026-04-17 |
| AB2-M3 | MEDIUM | FIXED | 2026-04-17 |
| AB2-M4 | MEDIUM | FIXED | 2026-04-17 |
| AB2-M5 | MEDIUM | FIXED | 2026-04-17 |
| AB2-M6 | MEDIUM | OPEN | — |
| AB2-M7 | MEDIUM | OPEN | — |
| AB2-M8 | MEDIUM | OPEN | — |
| AB2-M9 | MEDIUM | FIXED | 2026-04-17 |
| AB2-M10 | MEDIUM | FIXED | 2026-04-17 |
| AB2-M11 | MEDIUM | FIXED | 2026-04-17 |
| AB2-M12 | MEDIUM | OPEN | — |
| AB2-M13 | MEDIUM | OPEN | — |
| AB2-M14 | MEDIUM | OPEN | — |
| AB2-M15 | MEDIUM | OPEN | — |
| AB2-M16 | MEDIUM | FIXED | 2026-04-17 |
| AB2-M17 | MEDIUM | FIXED | 2026-04-17 |
| AB2-M18 | MEDIUM | FIXED | 2026-04-17 |
| AB2-M19 | MEDIUM | FIXED | 2026-04-17 |
| AB2-L1 | LOW | OPEN | — |
| AB2-L2 | LOW | OPEN | — |
| AB2-L3 | LOW | OPEN | — |
| AB2-L4 | LOW | OPEN | — |
| AB2-L5 | LOW | OPEN | — |
| **Round 3 — Additional Findings (2026-04-17)** | | | |
| AB3-C1 | CRITICAL | FIXED | 2026-04-17 |
| AB3-C2 | CRITICAL | FIXED | 2026-04-17 |
| AB3-C3 | CRITICAL | FIXED | 2026-04-17 |
| AB3-C4 | CRITICAL | FIXED | 2026-04-17 |
| AB3-H1 | HIGH | FIXED | 2026-04-17 |
| AB3-H2 | HIGH | OPEN | — |
| AB3-H3 | HIGH | FIXED | 2026-04-17 |
| AB3-H4 | HIGH | FIXED | 2026-04-17 |
| AB3-H5 | HIGH | FIXED | 2026-04-17 |
| AB3-H6 | HIGH | FIXED | 2026-04-17 |
| AB3-H7 | HIGH | FIXED | 2026-04-17 |
| AB3-H8 | HIGH | FIXED | 2026-04-17 |
| AB3-H9 | HIGH | FIXED | 2026-04-17 |
| AB3-H10 | HIGH | FIXED | 2026-04-17 |
| AB3-M1 | MEDIUM | OPEN | — |
| AB3-M2 | MEDIUM | OPEN | — |
| AB3-M3 | MEDIUM | FIXED | 2026-04-17 |
| AB3-M4 | MEDIUM | OPEN | — |
| AB3-M5 | MEDIUM | FIXED | 2026-04-17 |
| AB3-M6 | MEDIUM | FIXED | 2026-04-17 |
| AB3-M7 | MEDIUM | FIXED | 2026-04-17 |
| AB3-M8 | MEDIUM | FIXED | 2026-04-17 |
| AB3-M9 | MEDIUM | FIXED | 2026-04-17 |
| AB3-M10 | MEDIUM | FIXED | 2026-04-17 |
| AB3-M11 | MEDIUM | FIXED | 2026-04-17 |
| AB3-M12 | MEDIUM | FIXED | 2026-04-17 |
| AB3-M13 | MEDIUM | OPEN | — |
| AB3-M14 | MEDIUM | OPEN | — |
| AB3-L1 | LOW | FIXED | 2026-04-17 |
| AB3-L2 | LOW | FIXED | 2026-04-17 |
| AB3-L3 | LOW | FIXED | 2026-04-17 |
