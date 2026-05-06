# ReZ Merchant App — Gap Analysis

**Generated:** 2026-04-16
**Scope:** `rezmerchant/` — 705 source files
**Agents:** 6 specialized auditors (payment, api, logic, security, sync, ux)
**Total Findings:** 284

---

## Folder Structure

```
06-MERCHANT-APP/
├── 00-INDEX.md                      ← You are here
├── CRITICAL.md                      ← 16 CRITICAL issues (fix before release)
├── HIGH.md                          ← 44 HIGH issues (fix within 1 week)
├── MEDIUM.md                        ← 75 MEDIUM issues (fix within 2 weeks)
└── LOW.md                          ← 149 LOW issues (fix within 1 month)
```

---

## Summary by Severity

| Layer | CRITICAL | HIGH | MEDIUM | LOW | Total |
|-------|----------|------|--------|-----|-------|
| Merchant App | 16 | 44 | 75 | 149 | **284** |

---

## Quick Navigation

### Phase 1 — CRITICAL (Fix Before Release)

| ID | File | Title |
|----|------|-------|
| G-MA-C01 | `CRITICAL.md` | Wallet balance display off by 100x — live fraud risk |
| G-MA-C02 | `CRITICAL.md` | Double coin deduction — customer loses discount |
| G-MA-C03 | `CRITICAL.md` | Offline bill sync loses coin discount |
| G-MA-C04 | `CRITICAL.md` | Cart cleared before SQLite confirms write |
| G-MA-C05 | `CRITICAL.md` | IDOR: order detail without store ownership check |
| G-MA-C06 | `CRITICAL.md` | Biometric silently bypasses on unavailable devices |
| G-MA-C07 | `CRITICAL.md` | Queued socket events lost on app crash |
| G-MA-C08 | `CRITICAL.md` | Offline queue no idempotency — double-charge risk |
| G-MA-C09 | `CRITICAL.md` | Failed offline bills silently dropped after 5 retries |
| G-MA-C10 | `CRITICAL.md` | Batch sync no atomicity — partial failure |
| G-MA-C11 | `CRITICAL.md` | SocketContext.emit calls non-existent method — all real-time dead |
| G-MA-C12 | `CRITICAL.md` | Offline queue routes to wrong API paths — silent failure |
| G-MA-C13 | `CRITICAL.md` | Cache never invalidated after mutations |
| G-MA-C14 | `CRITICAL.md` | Pending orders tab always shows zero |
| G-MA-C15 | `CRITICAL.md` | IDOR: order detail exposes any merchant's orders |
| G-MA-C16 | `CRITICAL.md` | Coin redemption fire-and-forget — discount applied but never recorded |

### Phase 2 — HIGH (Fix Within 1 Week)

| Category | Count | Key Issues |
|----------|-------|-----------|
| Financial | 11 | No withdrawal validation, wrong payment status enum, unbounded cashback |
| Data Sync | 10 | Ping interval leak, subscriptions not restored, dead letter queue |
| API Contract | 6 | Type mismatches, wrong endpoints, missing fields |
| Business Logic & Enum | 11 | Status duplicated 4+ places, FSM drift |

---

## Root Causes

1. **No canonical type library** — `OrderStatus`, `PaymentStatus`, `CashbackStatus`, `Order`, `CashbackRequest`, `Product` all exist in 3-7 locations with divergent definitions
2. **No API contract enforcement** — Client maintains hardcoded FSM maps and endpoint paths that drift from backend
3. **Offline architecture has no transaction safety** — SQLite writes non-atomic, idempotency keys assigned after inserts, batch syncs non-transactional

---

## How to Use This Gap Registry

1. **Start with CRITICAL.md** — these break money or security
2. **Cross-reference with shared-types** — many enum issues are shared with other apps
3. **Check 03-CROSS-REF/TYPE-DIVERGENCE.md** — for type mismatches across services
4. **Mark as fixed** in the specific gap doc's status table
5. **Verify** with tests before closing

---

## Cross-Reference to Other Audits

| Issue | Other Audit | Connection |
|-------|------------|------------|
| OrderStatus enum drift | karma-service, consumer-app | Same canonical enum used differently |
| PaymentStatus mismatch | 03-CROSS-REF/ENUM-MISMATCH.md | Payment status values differ across apps |
| Type divergence | 03-CROSS-REF/TYPE-DIVERGENCE.md | Product/Order types not aligned |
| Offline architecture | rez-backend offline POS | Sync patterns need alignment |
