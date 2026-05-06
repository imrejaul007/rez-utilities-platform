# Gaps: RENDEZ BACKEND

**Service:** `rendez-backend/` (Node.js/Express/Prisma/Socket.IO)
**Source:** Deep audit 2026-04-16 (Rendez monorepo)
**Total Issues:** 35 (4 CRITICAL, 10 HIGH, 12 MEDIUM, 9 LOW) — +6 from deep service audit 2026-04-16

---

## Issues by Category

| Category | CRITICAL | HIGH | MEDIUM | LOW |
|----------|----------|------|--------|-----|
| Security | 3 | 1 | 4 | 2 |
| Payment / Financial | 1 | 4 | 1 | — |
| Functional | — | 2 | 4 | 1 |
| Performance | — | — | 2 | 1 |
| Data & Sync | — | 2 | — | 1 |
| Business Logic | — | — | 1 | 1 |
| Architecture | — | — | — | 1 |
| Offline / Sync | — | — | — | 1 |

---

## Files

| File | Description |
|------|-------------|
| `CRITICAL.md` | All critical security and payment issues |
| `HIGH.md` | High-severity functional and financial issues |
| `MEDIUM.md` | Medium-severity bugs and quality issues |
| `LOW.md` | Low-severity code quality and maintainability |

---

## Quick Reference

| ID | Severity | Title | Location |
|----|----------|-------|----------|
| RZ-B-C1 | CRITICAL | Gift voucher endpoint leaks QR codes via ID enumeration | `gift.ts:80`, `GiftService.ts:180` |
| RZ-B-C2 | CRITICAL | Payment webhook race condition — double reward issuance | `webhooks/rez.ts:49` |
| RZ-B-C3 | CRITICAL | Query params cast to `any` bypasses enum validation | `wallet.ts:32`, `admin.ts:150` |
| RZ-B-C4 | CRITICAL | Socket `read_receipt` bypasses `matchId` ownership check | `socketServer.ts:155` |
| RZ-B-H1 | HIGH | HMAC recomputed inline; empty secret allows unsigned requests | `experienceCredits.ts:35` |
| RZ-B-H2 | HIGH | 7 plan routes missing ID validation | `plans.ts:72-149` |
| RZ-B-H3 | HIGH | Reward trigger fire-and-forget — silent failure loses user rewards | `MeetupService.ts:101` |
| RZ-B-H4 | HIGH | Redis NX lock expires during long reward process | `MeetupService.ts:98` |
| RZ-B-H5 | HIGH | Gift expired webhook always returns success for missing records | `webhooks/rez.ts:34` |
| RZ-B-H6 | HIGH | REZ API called after DB commit — split-brain on timeout | `GiftService.ts:133` |
| RZ-B-H7 | HIGH | Unnecessary type cast weakens `isSuspended` safety | `auth.ts:62` |
