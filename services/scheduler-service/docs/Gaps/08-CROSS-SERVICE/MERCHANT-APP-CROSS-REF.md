# CROSS-REF: Merchant App (Gen 10) → Existing Audits & Cross-Service Issues

**Date:** 2026-04-16
**Source:** 170 findings from 6-agent audit of `rezmerchant/`

---

## Merchant App Gaps → Existing Audit Docs

| Merchant Gap ID | Title | Related Existing Doc | Connection |
|----------------|-------|---------------------|-----------|
| G-MA-C01 | Wallet balance ×100 inflation | `docs/Bugs/BACKEND-WALLET.md` | Unit mismatch (rupees vs paise) pattern already known |
| G-MA-C02 | Double coin deduction | `docs/Bugs/MERCHANT-APP-BUGS.md` | POS coin logic needs review |
| G-MA-C03 | Offline bill loses coin discount | `docs/Bugs/MERCHANT-APP-BUGS.md` | Offline POS flow |
| G-MA-C05 | IDOR on order detail | `docs/Bugs/BACKEND-AUTH.md` | Authz pattern, relates to G-KS-C4 |
| G-MA-C06 | Biometric bypass | `docs/Bugs/BACKEND-AUTH.md` | Auth flow |
| G-MA-C07 | Socket queue lost on crash | `docs/Bugs/FIRE-AND-FORGET.md` | Fire-and-forget pattern |
| G-MA-C09 | Failed offline bills silently dropped | `docs/Bugs/FIRE-AND-FORGET.md` | Silent failure on DLQ exhaustion |
| G-MA-C10 | Batch sync partial failure | `docs/Bugs/MONEY-ATOMICITY.md` | Non-atomic batch = potential double-charge |
| G-MA-C11 | SocketContext.emit dead | `docs/Bugs/FIRE-AND-FORGET.md` | Real-time fire-and-forget |
| G-MA-C12 | Offline queue wrong API paths | `docs/Bugs/API-CONTRACT-MISMATCHES.md` | Path prefix mismatch |
| G-MA-C13 | Cache never invalidated | `docs/Bugs/CACHE-INVALIDATION.md` | Cache invalidation known pattern |
| G-MA-C14 | Pending orders tab = 0 | `docs/Bugs/MERCHANT-APP-BUGS.md` | Status enum mismatch |
| G-MA-H01 | No withdrawal validation | `docs/Bugs/BACKEND-FINANCE.md` | Input validation |
| G-MA-H02 | Payment status 'completed' vs 'paid' | `docs/Bugs/ENUM-FRAGMENTATION.md` | Status enum mismatch |
| G-MA-H06 | Discount % not capped | `docs/Bugs/BACKEND-FINANCE.md` | Business logic |
| G-MA-H07 | Coin award no integer check | `docs/Bugs/BACKEND-FINANCE.md` | Input validation |
| G-MA-H09 | isNaN fails on Infinity | `docs/Bugs/BACKEND-FINANCE.md` | Input validation |
| G-MA-H11 | Offline sync timeout ignored | `docs/Bugs/FIRE-AND-FORGET.md` | Silent timeout |
| G-MA-H17 | Dead letter queue unbounded | `docs/Bugs/FIRE-AND-FORGET.md` | Storage leak |
| G-MA-H28 | OrderStatus duplicated 7x | `docs/Bugs/ENUM-FRAGMENTATION.md` | Enum fragmentation |
| G-MA-H29 | PaymentStatus wrong whitelist | `docs/Bugs/ENUM-FRAGMENTATION.md` | Enum fragmentation |
| G-MA-H30 | CashbackStatus missing values | `docs/Bugs/ENUM-FRAGMENTATION.md` | Enum fragmentation |
| G-MA-H31 | Client-side FSM not synced | `docs/Bugs/FIRE-AND-FORGET.md` | Client-side validation is non-authoritative |
| G-MA-H34 | Status normalization 7x | `docs/Bugs/ENUM-FRAGMENTATION.md` | Enum fragmentation |
| G-MA-H35 | CashbackRequest defined 3x | `docs/Bugs/TYPE-DRIFT.md` | Type fragmentation |
| G-MA-H36 | Product type defined 3x | `docs/Bugs/TYPE-DRIFT.md` | Type fragmentation |
| G-MA-H37 | PaymentStatus 3 definitions | `docs/Bugs/TYPE-DRIFT.md` | Type fragmentation |
| G-MA-H22 | Order type mismatch | `docs/Bugs/TYPE-DRIFT.md` | Order type divergence |
| G-MA-M05 | Offer config no bounds | `docs/Bugs/BACKEND-FINANCE.md` | Input validation |
| G-MA-M08 | Phone validation only length | `docs/Bugs/BACKEND-FINANCE.md` | Input validation |
| G-MA-M19 | Biometric bypass | `docs/Bugs/BACKEND-AUTH.md` | Auth flow |

---

## NEW Cross-Repo Issues (Merchant App → Other Services)

### Issue CR-M1: OrderStatus Enum Completely Fragmented

| Codebase | Values | File | Status |
|----------|--------|------|--------|
| `types/api.ts` (canonical) | placed, confirmed, preparing, ready, out_for_delivery, delivered, cancelled, cancelling, refunded | Gen 10 | — |
| `app/orders/live.tsx` | pending, confirmed, preparing, ready, dispatched, delivered, cancelled, returned | Gen 10 | MISSING placed, extra pending |
| `app/(dashboard)/aggregator-orders.tsx` | pending, accepted, preparing, ready, picked_up, delivered, cancelled | Gen 10 | DIFFERENT set |
| `app/kds/index.tsx` | new, preparing, ready | Gen 10 | SHORT list |
| `app/kds/rez-now-orders.tsx` | pending, confirmed, preparing, ready | Gen 10 | Missing many |
| Gen 1-7 Consumer App | TBD — check `docs/Bugs/CONSUMER-APP-BUGS.md` | Gen 1-7 | — |
| Gen 1-7 Backend | TBD — check `docs/Bugs/BACKEND-BUGS.md` | Gen 1-7 | — |
| Karma Service | `checkout_status`, `verification_status` | Gen 8 | Different enum |
| rez-backend | `OrderStatus` FSM | Backend | Must verify |

**Fix Required:** Create `shared/constants/orderStatus.ts` with canonical values. All 7+ locations in merchant app must import from there. Then verify Gen 1-7 consumer app and backend use the same canonical.

---

### Issue CR-M2: PaymentStatus Three-Way Fragmentation

| Codebase | Values | File |
|----------|--------|------|
| `types/api.ts` (canonical) | pending, awaiting_payment, processing, authorized, paid, failed, refunded, partially_refunded | Gen 10 |
| `utils/paymentValidation.ts` | pending, completed, failed, cancelled | Gen 10 — WRONG |
| `app/(dashboard)/payments.tsx` | 'completed' (UI sends wrong value) | Gen 10 |
| Gen 1-7 Consumer App | TBD — check `docs/Bugs/CONSUMER-APP-BUGS.md` |
| rez-backend | PaymentStatus FSM | Backend |

**Fix Required:** Update paymentValidation.ts whitelist. Fix UI filter 'completed' → 'paid'.

---

### Issue CR-M3: CashbackStatus Missing in Query Hooks

| Codebase | Values | File |
|----------|--------|------|
| `types/api.ts` (canonical) | pending, approved, rejected, paid, expired | Gen 10 |
| `hooks/queries/useCashback.ts` | pending, paid, rejected | Gen 10 — MISSING approved, expired |
| `shared/types/cashback.ts` | pending, approved, rejected, paid, expired, created, reviewed, flagged | Gen 10 |
| Gen 1-7 Consumer App | TBD — check `docs/Bugs/` |
| rez-backend | CashbackStatus FSM | Backend |

**Impact:** UI can never query for 'approved' or 'expired' cashback requests.

---

### Issue CR-M4: Offline Architecture Non-Transactional

This pattern exists across ALL offline flows in Gen 1-7 consumer app AND Gen 10 merchant app:

| Location | Issue | Pattern |
|----------|-------|---------|
| `services/offlinePOSQueue.ts` | Idempotency assigned AFTER INSERT | CRITICAL — double-charge on crash |
| `services/offline.ts` | Queue deduplication missing | Double-tap creates duplicates |
| Gen 1-7 Consumer App | TBD — check `docs/Bugs/` |
| rez-backend | Sync endpoint idempotency | Backend relies on client-side keys |

**Cross-Repo Fix Required:** Create shared `offlineQueue` utility with:
1. Generate idempotency key BEFORE INSERT
2. Per-item ACK (not batch)
3. Dead letter queue with user notification
4. Duplicate detection before enqueue

---

### Issue CR-M5: Real-Time Features Dead Across All Apps

| Codebase | Socket Status | Impact |
|----------|--------------|--------|
| Merchant App (Gen 10) | `SocketContext.emit()` calls non-existent `getSocket()` | ALL real-time dead |
| Consumer App (Gen 1-7) | TBD — check `docs/Bugs/` |
| Admin App (Gen 1-7) | TBD — check `docs/Bugs/` |

**This means:** Order notifications, metrics updates, cashback alerts, waiter calls — all dead across multiple apps. Need a unified SocketService fix.

---

### Issue CR-M6: Coin Redemption Flow Broken End-to-End

| Location | Issue | Gen |
|----------|-------|-----|
| `app/pos/index.tsx` | Coin redemption not in payment payload | Gen 10 |
| `services/offlinePOSQueue.ts` | Coin discount not in offline queue | Gen 10 |
| Consumer App | Coin redemption UI/flow | Gen 1-7 TBD |
| rez-backend | `merchant/pos/bill` coin handling | Backend TBD |

**Root cause:** Coins computed client-side, not sent to backend. Backend issues coins on full bill amount.

---

## Summary: Cross-Repo Gaps

| # | Issue | Severity | Affects |
|---|-------|----------|---------|
| CR-M1 | OrderStatus fragmented across 7+ files + multiple apps | CRITICAL | All apps |
| CR-M2 | PaymentStatus wrong values in merchant + unknown in consumer | HIGH | All apps |
| CR-M3 | CashbackStatus missing values in query hooks | HIGH | Merchant + consumer |
| CR-M4 | Offline architecture non-transactional across all apps | CRITICAL | All offline flows |
| CR-M5 | Real-time features dead across merchant + unknown in others | CRITICAL | All apps |
| CR-M6 | Coin redemption broken end-to-end | CRITICAL | Merchant + consumer + backend |

---

## Priority for Cross-Repo Fixes

| Priority | Action | Owner |
|----------|--------|-------|
| 1 | Create `shared/constants/orderStatus.ts` — canonical enum | All apps import |
| 2 | Fix `SocketContext.emit()` — add `getSocket()` to SocketService | Merchant App |
| 3 | Audit consumer app for SocketService issues (CR-M5) | Consumer App |
| 4 | Create shared `offlineQueue` utility with transaction safety | All apps |
| 5 | Audit consumer app offline POS for same issues | Consumer App |
| 6 | Fix coin redemption end-to-end (G-MA-C02 + C03) | Merchant + Backend |
| 7 | Verify PaymentStatus canonical + fix all consumers | All apps |
