# Vesper App — Gap Registry (Gen 16)

**App:** `vesper-app/` (React Native mobile + Node.js server)
**Generated:** 2026-04-16
**Scope:** Full codebase audit — mobile app + server backend
**Total Issues:** 21 (3 CRITICAL, 5 HIGH, 8 MEDIUM, 5 LOW)

---

## Source References

All findings are documented in this folder:
- `01-CRITICAL.md` — 3 critical issues
- `02-HIGH.md` — 5 high-severity issues
- `03-MEDIUM.md` — 8 medium issues
- `04-LOW.md` — 5 low issues

---

## Severity Summary

| Severity | Count | Must Fix Before Launch? |
|----------|-------|------------------------|
| CRITICAL | 3 | YES |
| HIGH | 5 | YES |
| MEDIUM | 8 | Eventually |
| LOW | 5 | Nice to have |
| **TOTAL** | **21** | |

---

## CRITICAL Issues (Quick Reference)

| ID | Title | File | Risk |
|----|-------|------|------|
| VS-C1 | `jwt.verify()` without `algorithms` — algorithm confusion attack | `server/src/utils/jwt.ts:48,59,78` | Token forgery |
| VS-C2 | OrderStatus enum incompatible with REZ canonical | `server/src/types/index.ts:12` | Cross-platform data corruption |
| VS-C3 | PaymentStatus enum incompatible with REZ canonical | `server/src/types/index.ts:17` | Cross-platform payment failures |

---

## Quick Fixes

| ID | Fix | Est. |
|----|-----|------|
| VS-C1 | Add `{ algorithms: ['HS256'] }` to all jwt.verify calls | 10 min |
| VS-C2 | Align OrderStatus with REZ canonical or use shared package | 2h |
| VS-C3 | Align PaymentStatus with REZ canonical or use shared package | 1h |
| VS-H1 | Add rate limiting to all public endpoints | 2h |
| VS-M1 | Add error handling to refresh token revocation | 30 min |

---

**Last Updated:** 2026-04-16
**Next:** Read `01-CRITICAL.md` for all critical issues with full details.
