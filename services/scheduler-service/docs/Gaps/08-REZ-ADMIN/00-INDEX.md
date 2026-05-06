# REZ Admin App (Gen 10) — Gap Registry

**App:** `rez-app-admin/` (current React Native/Expo admin app)
**Generated:** 2026-04-16
**Audit Source:** Fresh codebase audit — 13 categories
**Total Issues:** 72 (11 CRITICAL, 23 HIGH, 27 MEDIUM, 11 LOW)

> **+19 issues** found in follow-up deep audit (2026-04-16). See [ADDITIONAL.md](ADDITIONAL.md).

---

## Source References

All findings from this audit are documented in a structured report at the root:
- `docs/ADMIN-AUDIT-GEN10-REPORT.md` — Full narrative report with all findings
- `docs/Gaps/08-REZ-ADMIN/` — This folder, each issue as a standalone doc

---

## Folder Structure

```
docs/Gaps/08-REZ-ADMIN/
├── 00-INDEX.md                              ← You are here
├── CRITICAL.md                              ← 8 critical issues
├── HIGH.md                                  ← 17 high-severity issues
├── MEDIUM.md                                ← 20 medium issues
└── LOW.md                                   ← 8 low issues
```

---

## Severity Summary

| Severity | Count | Must Fix Before Scale? |
|----------|-------|----------------------|
| CRITICAL | 8 | YES |
| HIGH | 17 | YES |
| MEDIUM | 20 | Eventually |
| LOW | 8 | Nice to have |
| **TOTAL** | **53** | |

---

## CRITICAL Issues (Quick Reference)

| ID | Title | File | Risk |
|----|-------|------|------|
| A10-C1 | Socket events don't invalidate React Query cache | `services/socket.ts:148` | Data desync |
| A10-C2 | Three competing VoucherBrand type definitions | `vouchers.ts`/`cashStore.ts` | Runtime crash |
| A10-C3 | Same endpoint, opposite query param names | `extraRewards.ts`/`cashStore.ts` | Silent failure |
| A10-C4 | In-memory PaymentMachine provides zero cross-request protection | `paymentRoutes.ts:17` | Double payment |
| A10-C5 | Internal auth HMAC key derived from env var name, not value | `internalAuth.ts:40` | Unauthenticated |
| A10-C6 | SSE order stream has no merchant ownership check | `httpServer.ts:473` | Data exposure |
| A10-C7 | Three conflicting color systems, one is dead code | Multiple files | Confusion |
| A10-C8 | Order refund modal shows Rs. 0 and `#undefined` | `orders.tsx:971` | Wrong refunds |

---

## Cross-Reference: Existing Audit Overlaps

| Issue | Also Appears In | ID |
|-------|----------------|-----|
| Payment webhook race | `CODEBASE_ISSUES_AUDIT.md` | SEC-1 |
| SSE auth bypass | `CODEBASE_ISSUES_AUDIT.md` | SEC-2 |
| Redis fail-open | `INTERNAL_AUTH_AUDIT.md` | Gap 1 |
| HMAC key derivation | `INTERNAL_AUTH_AUDIT.md` | Gap 1 |
| JWT algorithm confusion | `CODEBASE_ISSUES_AUDIT.md` | SEC-4 |
| No role guards | `CODEBASE_ISSUES_AUDIT.md` | SEC-3/4 |
| PaymentMachine in-memory | `CODEBASE_ISSUES_AUDIT.md` | SEC-CRIT-1 |
| Idempotency missing | `CODEBASE_ISSUES_AUDIT.md` | SEC-5C |

---

## Root Cause Summary

| Root Cause | Appears In |
|-----------|-----------|
| RC-1: No single source of truth for types/enums | A10-C2, A10-C3, A10-C7 |
| RC-2: Frontend computes what backend should own | A10-C8, A10-H4 |
| RC-3: Fire-and-forget for financial ops | A10-C4, A10-H12, A10-H13 |
| RC-4: Real-time events don't update server-state UI | A10-C1, A10-H11 |
| RC-5: Token refresh race conditions | A10-H9, A10-H10 |
| RC-6: Duplicate service implementations | A10-C2, A10-C3, A10-C7 |
| RC-7: Socket auth not synchronized with HTTP auth | A10-C6 (backend), A10-H9 |

---

## Adding New Gaps

1. Add to appropriate severity file (CRITICAL/HIGH/MEDIUM/LOW)
2. ID format: `A10-{severity}-{number}`
3. Example: `A10-C1`, `A10-H12`, `A10-M5`, `A10-L2`
4. Include: file:line, description, impact, fix snippet, status

---

**Last Updated:** 2026-04-16
**Next:** Read `CRITICAL.md` for all critical issues with full details.
