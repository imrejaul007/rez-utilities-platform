# Gaps: KARMA SERVICE BACKEND

**Service:** `rez-karma-service`
**Source:** Deep audit 2026-04-16
**Total Issues:** 116 (16 CRITICAL, 32 HIGH, 44 MEDIUM, 24 LOW)
> Updated 2026-04-16: Added 57 Round 4 findings (C21-C23, H9-H25, M17-M44, L2-L9). Key additions: stub routes shadow all karma endpoints (CRITICAL), 5 unimplemented endpoints (CRITICAL), missing indexes (MEDIUM), zero test coverage (MEDIUM)

---

## Issues by Category

| Category | CRITICAL | HIGH | MEDIUM | LOW |
|----------|----------|------|--------|-----|
| Security | 10 | 3 | 2 | 1 |
| Business Logic | 3 | 14 | 10 | 2 |
| Functional | — | 2 | 4 | 1 |
| Architecture | — | 2 | 12 | 5 |
| Error Handling | — | — | 4 | 1 |
| Routes/Backend | 3 | 5 | 8 | 1 |
| Tests | — | — | 4 | — |

---

## Files

| File | Description |
|------|-------------|
| `SECURITY.md` | All security vulnerabilities (11 issues) |
| `BUSINESS-LOGIC.md` | Karma calculations, weekly caps, decay, batch logic (8 issues) |
| `FUNCTIONAL.md` | Type mismatches, input validation, compilation errors (4 issues) |
| `ARCHITECTURE.md` | Schema gaps, indexes, worker lifecycle, logging (7 issues) |
| `ERROR-HANDLING.md` | Silent failures, wallet errors, clock skew (5 issues) |
| `EDGE-CASES.md` | *(merged into FUNCTIONAL.md and ERROR-HANDLING.md)* |
| `ROUND4.md` | Round 4 deep audit: stub routes, missing endpoints, indexes, tests (57 issues) |
