# Cross-Repo Analysis — Master Index

**Date:** 2026-04-16
**Updated:** 2026-04-16 (Gen 10 merchant + Gen 11 consumer audit added)
**Scope:** All 4 platform codebases + REZ ecosystem services
**Status:** 12 cross-repo issue families across 10 repos/services

---

## Cross-Repo Issue Families

| # | Family | Description | Spans | Severity |
|---|--------|-------------|-------|----------|
| **XF-1** | Fire-and-Forget Coin Credits | REZ coin credit calls are async with no retry, DLQ, or reconciliation | AdBazaar → REZ backend | CRITICAL |
| **XF-2** | `rez_user_id` Spoofing | URL-param user ID passed to REZ API — coin fraud vector | AdBazaar → REZ backend | CRITICAL |
| **XF-3** | Dual Attribution Systems | AdBazaar (Supabase) and REZ (MongoDB) each track attribution independently | AdBazaar ↔ REZ backend | HIGH |
| **XF-4** | Wallet vs Earnings Derivation | REZ has full multi-coin wallet system; AdBazaar derives earnings from bookings table | AdBazaar ↔ REZ ecosystem | HIGH |
| **XF-5** | Notification Architecture Gap | REZ uses BullMQ jobs; AdBazaar uses fire-and-forget DB inserts | AdBazaar | MEDIUM |
| **XF-6** | Schema vs API Column Mismatches | API routes insert columns that don't match the DB schema | AdBazaar | CRITICAL |
| **XF-7** | rez-now Disconnected from Shared | rez-now defines all types locally, zero imports from shared | rez-now → ALL repos | CRITICAL |
| **XF-8** | Payment Terminal State Mismatch | Polling checks 'completed' but backend returns 'paid' | consumer → payment backend | CRITICAL |
| **XF-9** | karma CoinType Split | karma credits 'rez' coins but queries 'karma_points' | karma → wallet | HIGH |
| **XF-10** | Client Controls Security | Bill amount, fraud checks, device fingerprint all client-side | consumer (security) | CRITICAL |
| **XF-11** | Karma Race Condition + Type Fragmentation | Read-modify-write without lock, triple CoinType, TOCTOU profile creation, finance auth fail-open | karma ↔ wallet ↔ shared | CRITICAL/HIGH |

---

## Key Cross-Service Mismatches

### Tech Stack Divergence

| Aspect | REZ Ecosystem | AdBazaar |
|--------|--------------|----------|
| **Database** | MongoDB + Mongoose | Supabase (PostgreSQL) |
| **Auth** | JWT tokens (MongoDB-backed) | Supabase Auth cookies |
| **Queue/Async** | BullMQ + Redis | None (fire-and-forget) |
| **Real-time** | Polling / TanStack Query | None |
| **Payment** | `rez-payment-service` (Redis-backed FSM) | Razorpay Checkout SDK |
| **State Machine** | Distributed across 4+ microservices | Single booking status enum |
| **Shared Types** | `rez-shared` package (drift issues) | Zod schemas (local) |

### Coin System Divergence

| Aspect | REZ Ecosystem | AdBazaar |
|--------|--------------|----------|
| **Coin Types** | 6 types: rez, prive, branded, promo, cashback, referral | 2: scan coins + visit bonus coins |
| **Wallet Model** | Full multi-coin wallet per user (6 balances) | No wallet — REZ API credits directly |
| **Ledger** | Double-entry `LedgerEntry` collection | No ledger |
| **Expiry** | Per-coin-type expiry rules | Not modeled |
| **Attribution** | MongoDB `attribution` collection | Supabase `attribution` + `scan_events` |

### Auth Pattern Divergence

| Aspect | REZ Ecosystem | AdBazaar |
|--------|--------------|----------|
| **User Identity** | `userId` (ObjectId) in JWT claims | `rez_user_id` from URL param (CRITICAL — spoofable) |
| **Session** | JWT Bearer token | Supabase cookie via `@supabase/ssr` |
| **Admin Auth** | `x-internal-token` + capability levels | Manual cookie parsing (fragile) |
| **Middleware** | Per-service JWT validation | Edge middleware via `middleware.ts` |
| **RLS** | Not used | Supabase RLS policies |

---

## Gen 1–7 Cross-Service Legacy (Archived)

For Gen 1–7 cross-service issues (payment/wallet atomicity, enum fragmentation, type drift, API contract mismatches, fire-and-forget patterns), see [../08-CROSS-SERVICE/](../08-CROSS-SERVICE/).

**Key Gen 1–7 patterns that persist into Gen 8–11:**
- RC-3: Fire-and-forget financial ops (XF-1, XF-5)
- RC-18: Three normalizeOrderStatus implementations (CS-E1)
- RC-20: Type drift (CS-T1, CS-T2, TYPE-DRIFT-MATRIX.md)
- PaymentMachine in-memory double-credit (CS-M1)

---

## Gen 11 Consumer App Cross-Repo Findings (2026-04-16)

Full details: [`../06-CONSUMER-AUDIT-2026/05-CROSS-REPO-MISMATCHES.md`](../06-CONSUMER-AUDIT-2026/05-CROSS-REPO-MISMATCHES.md)

| Gap | Title | Crosses | Severity |
|-----|-------|---------|---------|
| XREP-01 | WalletBalance has 3 different shapes | rez-now → rez-shared → wallet | CRITICAL |
| XREP-02 | WebOrderStatus 6 vs OrderStatus 15 | rez-now → rez-shared | CRITICAL |
| XREP-03 | normalizeLoyaltyTier conflicting | rez-shared (internal) | MEDIUM |
| XREP-04 | rez-now has zero shared imports | rez-now → ALL repos | CRITICAL |
| XREP-05 | Week boundary locale vs ISO | karma service (internal) | MEDIUM |
| XREP-06 | PaymentStatusResult 6 vs PaymentStatus 10 | rez-now → rez-shared | MEDIUM |
| XREP-07 | karma credits 'rez' but queries 'karma_points' | karma → wallet | HIGH |
| XREP-09 | Payment status 'completed' vs 'paid' | consumer → payment backend | CRITICAL |
| XREP-10 | AddressType SCREAMING_CASE vs lowercase | consumer → shared | MEDIUM |
| XREP-11 | KarmaProfile 14 vs IKarmaProfile 20 fields | consumer → karma backend | HIGH |
| XREP-12 | CoinType 'branded_coin' vs 'branded' | consumer → shared | HIGH |
| XREP-14 | WalletTransaction.type simplified vs rich | rez-now → wallet | LOW |
| XREP-15 | BookingStatus 4 vs 9 values | consumer → shared | MEDIUM |
| XREP-16 | userTimezone in engine but not schema | karma service (internal) | LOW |

**6 Root Systemic Diseases** (causing 35+ issues): [`../06-CONSUMER-AUDIT-2026/06-SYSTEMIC-ROOTS.md`](../06-CONSUMER-AUDIT-2026/06-SYSTEMIC-ROOTS.md)

---

## Gen 10 Merchant App Cross-Service Findings (2026-04-16)

Added to existing cross-service documents via merchant app audit. Crosses: merchant app (rezmerchant/) ↔ backend services.

| Doc | Additions | New Issues |
|-----|-----------|-----------|
| MONEY-ATOMICITY.md | CS-M12–CS-M16 | 5 CRITICAL: offline idempotency, silent bill drop, batch non-atomic, coin redemption not in payload, offline coin discount loss |
| API-CONTRACT-MISMATCHES.md | CS-A-M1–CS-A-M6 | 6 HIGH: Order type mismatch, profile name mapping, socialMedia wrong path, export bypasses apiClient, getVisitStats throws, storeId never sent |
| SECURITY-ROOT-CAUSE.md | CS-S-M1–CS-S-M2 | 2 CRITICAL: IDOR on order detail, biometric bypass when hardware unavailable |
| FIRE-AND-FORGET.md (08-CROSS-SERVICE) | G-MA-C07, C09, C11, H11, H17, H19 | 6 instances: socket queue lost, failed bills silent drop, dead SocketContext, sync timeout ignored, DLQ unbounded, joinDashboard silent errors |

**Cross-repo patterns confirmed in Gen 10:** Same-bug-multiple-repos (PaymentStatus 'completed'/'paid', OrderStatus 7x, Math.random(), biometric bypass, IDOR, fire-and-forget, offline queue non-transactional). Full cross-repo matrix: [CROSS-REPO-UNIFIED.md](CROSS-REPO-UNIFIED.md)

---

## Documents in This Section

| File | Description |
|------|-------------|
| **[CROSS-REPO-UNIFIED.md](CROSS-REPO-UNIFIED.md)** | **Master cross-repo analysis** — all 11 codebases, 33 cross-repo issue families, fix priority |
| [ENUM-FRAGMENTATION.md](ENUM-FRAGMENTATION.md) | Status enum fragmentation (24 issues, Gen 1-11, updated with Gen 10 merchant) |
| [TYPE-DRIFT.md](TYPE-DRIFT.md) | Type drift across repos (13 issues, Gen 1-11, updated with Gen 10 merchant) |
| [MONEY-ATOMICITY.md](MONEY-ATOMICITY.md) | Payment/wallet double-credit risks |
| [API-CONTRACT-MISMATCHES.md](API-CONTRACT-MISMATCHES.md) | Frontend/backend field mismatches |
| [SECURITY-ROOT-CAUSE.md](SECURITY-ROOT-CAUSE.md) | 12 security root cause patterns |
| [TYPE-DRIFT-MATRIX.md](TYPE-DRIFT-MATRIX.md) | Type/enum mismatches across all repos |
| [CROSS-REP-TYPE-CONSISTENCY.md](CROSS-REP-TYPE-CONSISTENCY.md) | **28 new type/enum mismatches** (3 CRIT, 8 HIGH, 9 MED, 8 LOW) — 2026-04-17 full scan |
| [CROSS-SERVICE-CALL-MAP.md](CROSS-SERVICE-CALL-MAP.md) | Which service calls which, and what breaks if it fails |
| [XF-1-FIRE-AND-FORGET.md](XF-1-FIRE-AND-FORGET.md) | Fire-and-forget coin credit calls |
| [XF-2-USER-SPOOFING.md](XF-2-USER-SPOOFING.md) | `rez_user_id` spoofing vector |
| [XF-3-ATTRIBUTION-DUAL.md](XF-3-ATTRIBUTION-DUAL.md) | Two independent attribution tracking systems |
| [XF-4-WALLET-EARNINGS-MISMATCH.md](XF-4-WALLET-EARNINGS-MISMATCH.md) | REZ wallet vs AdBazaar derived earnings |
| [XF-5-NOTIFICATION-GAP.md](XF-5-NOTIFICATION-GAP.md) | BullMQ jobs vs fire-and-forget inserts |
| [XF-6-SCHEMA-API-MISMATCH.md](XF-6-SCHEMA-API-MISMATCH.md) | Column name mismatches across all Supabase-backed APIs |

---

## Adding Cross-Repo Issues

1. Identify which two or more codebases are involved
2. Assign an `XF-N` family number
3. Document in the appropriate `XF-N-*.md` file
4. Update this index
5. Add to the master plan under the appropriate phase
