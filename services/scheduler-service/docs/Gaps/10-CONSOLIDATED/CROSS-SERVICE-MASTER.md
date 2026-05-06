# CROSS-SERVICE ISSUES — MASTER LIST

**Date:** 2026-04-16
**Scope:** All cross-repo bugs — issues appearing in multiple places or spanning multiple services

---

## Cross-Reference: Same Bug, Different ID

| Bug Description | IDs Across Audits |
|----------------|-------------------|
| Duplicate const startOfWeek — karma dead | P0-KARMA-001, G-KS-B1, G-KS-C7, F001-C17, NA-HIGH-12 |
| OTP brute-force | BE-MER-OTP-001, G-MA-C6 |
| SSRF auth bypass | SEC-KARMA-SSRF-001, G-KS-C2, F001-C4 |
| Bank details plaintext | SEC-MER-SENS-001, AB-C3 |
| PaymentMachine in-memory | FE-PAY-001, A10-C4, CS-M1 |
| Payment status 'completed' vs 'paid' | FE-PAY-002, CS-E10, G-MA-H02, NA-CRIT-08 |
| Offline idempotency key after INSERT | CS-M12, G-MA-C08 |
| Failed offline bills silently removed | CS-M13, G-MA-C09 |
| Batch sync partial failure | CS-M14, G-MA-C10 |
| Coin redemption not in POS payload | CS-M15, G-MA-C02 |
| Offline bill loses coin discount | CS-M16, G-MA-C03 |
| HMAC key from env var NAME not value | CS-S1, A10-C5, F001-C11 |
| SSE no merchant ownership check | CS-S4, A10-C6 |
| JWT verify no algorithm whitelist | CS-S2 |
| Redis fail-open | CS-S3 |
| Dedup key 1-second collision | CS-M9 |
| Rewards hook idempotency drop | CS-M10 |
| Settlement blind spot (merchant vs merchantId) | F001-C1 |
| Merchant withdrawal TOCTOU | F001-C3 |
| Karma 2x inflation | F001-C5, G-KS-B10 |
| Admin cron consumer auth | F001-C6 |
| FraudFlag missing | F001-C7 |
| Firebase JSON on disk | F001-C12 |
| Order statuses out of sync | F001-C13, CS-E9, CS-E19 |
| Static files unauthenticated | F001-C14 |
| Finance silent coin failure | F001-C15, CS-M10 |
| Karma auth route 404 | F001-C4, G-KS-C2 |
| Internal service key unvalidated | F001-C11, CS-S1 |
| Three payment FSMs | F001-C9 |
| Coin rate divergence | F001-C10 |
| IDOR on order detail | CS-S-M1, G-MA-C5 |
| Biometric bypass | CS-S-M2, G-MA-C6 |
| Gift voucher auth bypass | RZ-B-C1 |
| Payment webhook race | RZ-B-C2, G-MA-C08 |
| Socket read_receipt bypass | RZ-B-C4 |
| rez_user_id spoofable | AB-C1 |
| Payment amount not verified | AB-C5, NA-CRIT-02 |
| Idempotency key missing | AB-C4, G-MA-C08 |
| normalizeLoyaltyTier opposite | CS-E12 |
| CoinType branded_coin vs branded | CS-E15, XREP-12 |
| KarmaEvent type divergence | G-KU-C3, G-CR-X3 |
| KarmaProfile type divergence | G-KU-H1, G-CR-X1 |
| Week boundary locale vs ISO | CS-E18, G-KS-B7 |

---

## Cross-Service Patterns by Root Cause

### RC-3: Fire-and-Forget Financial Operations

**Appears in:** AdBazaar, REZ backend, Karma service, Finance service, Gamification
**Bugs:** CS-M9, CS-M10, CS-M12-16, FE-PAY-002, F001-C15, AB-H3
**Fix Pattern:** Wrap in BullMQ with DLQ, add idempotency keys, fail loudly not silently

### RC-1: No Single Source of Truth (Types/Enums)

**Appears in:** ALL 15+ surfaces and services
**Bugs:** CS-E9-24, P1-ENUM-001/002, G-CR-X1-6, A10-C2, NW-CRIT-010
**Fix Pattern:** Create canonical shared-types package, remove all local duplicates

### RC-4: In-Memory State Machines

**Appears in:** Payment service, Admin app, Order service
**Bugs:** CS-M1, FE-PAY-001, A10-C4, F001-C9
**Fix Pattern:** Persist state to DB, use CAS filters

### RC-6: Duplicate Implementations

**Appears in:** Admin app (82 files), Consumer app, Merchant app
**Bugs:** A10-C2/C3, A10-H2/H3, CR-6, CR-15, G-KU-M6
**Fix Pattern:** Extract to shared packages, remove duplicates

### RC-7: Missing Cache Invalidation

**Appears in:** Consumer app, Merchant app, Admin app
**Bugs:** RS-009, A10-C1, RZ-M-F1, CR-7
**Fix Pattern:** Add `queryClient.invalidateQueries()` to all socket event handlers

### RC-8: Hardcoded Response Shapes

**Appears in:** Consumer app, Merchant app, Admin app
**Bugs:** A10-C8, NA-CRIT-01, G-MA-H28
**Fix Pattern:** Use shared type definitions, validate with Zod

---

## Inter-Service Call Dependencies (From CROSS-SERVICE-CALL-MAP)

```
REZ ecosystem services → dependencies:

payment-service → wallet-service (coin credit)
payment-service → order-service (order status update)
payment-service → notification-service (push notifications)
wallet-service → order-service (coin deduction on order)
wallet-service → merchant-service (merchant credit)
wallet-service → gamification-service (coin operations)
gamification-service → wallet-service (coin debit)
gamification-service → order-service (streak tracking)
finance-service → wallet-service (BNPL settlement, coin credit)
finance-service → payment-service (refund)
karma-service → wallet-service (karma→coin conversion)
karma-service → order-service (event karma)
order-service → payment-service (payment initiation)
order-service → notification-service (order updates)
order-service → gamification-service (order milestones)
merchant-service → wallet-service (settlement, withdrawal)
merchant-service → order-service (order queries)
auth-service → wallet-service (welcome coins)
auth-service → gamification-service (referral coins)
```

---

## Cross-Repo Issues Matrix

### Payment → Wallet

| Issue | Source | Target | Severity |
|-------|--------|--------|----------|
| PaymentMachine in-memory, double credit | payment-service | wallet-service | CRITICAL |
| No idempotency on wallet mutations | admin | wallet-service | HIGH |
| Welcome coins race window | auth-service | wallet-service | HIGH |
| Partial refund idempotency key mutable | payment-service | wallet-service | MEDIUM |
| debitForCoinAward no transaction | gamification | wallet-service | MEDIUM |

### Finance → Wallet/Order

| Issue | Source | Target | Severity |
|-------|--------|--------|----------|
| Finance silent coin failure | finance-service | wallet-service | CRITICAL |
| Rewards hook idempotency silent drop | finance-service | wallet-service | HIGH |
| Finance calls non-existent routes | finance-service | wallet-service | HIGH |
| Finance rewards hook wrong endpoint+fields | finance-service | wallet-service | HIGH |

### Admin → Backend

| Issue | Source | Target | Severity |
|-------|--------|--------|----------|
| HMAC key from env var name | order-service | all internal | CRITICAL |
| SSE no merchant ownership check | order-service | order-service | CRITICAL |
| Redis fail-open outside prod | order-service | auth | CRITICAL |
| JWT alg:none not mitigated | gateway | all consumers | CRITICAL |
| Missing role guards | admin | admin-settings | HIGH |
| Socket null auth on web | admin | all real-time | HIGH |

### Consumer ↔ Backend

| Issue | Source | Target | Severity |
|-------|--------|--------|----------|
| KarmaProfile type drift | consumer | shared | CRITICAL |
| KarmaEvent type drift | consumer | shared | HIGH |
| Consumer uses 'completed' not 'delivered' | consumer | order-service | MEDIUM |
| Bill amount client-controlled | consumer | backend | CRITICAL |

### All Surfaces ↔ Shared Types

| Issue | Source | Target | Severity |
|-------|--------|--------|----------|
| normalizePaymentStatus never used | all surfaces | shared | MEDIUM |
| 3 normalizeOrderStatus implementations | all surfaces | shared | CRITICAL |
| Payment status colors missing 7 states | admin, consumer, merchant | shared | HIGH |
| OrderStatus fragmented 7x in merchant app | merchant app | shared | CRITICAL |

### Karma ↔ Wallet

| Issue | Source | Target | Severity |
|-------|--------|--------|----------|
| Credits 'rez', queries 'karma_points' | karma-service | wallet-service | HIGH |
| Duplicate EarnRecord | karma-service | karma-service | CRITICAL |
| Auto-checkout missing EarnRecord | karma-service | karma-service | CRITICAL |

### AdBazaar → REZ Backend

| Issue | Source | Target | Severity |
|-------|--------|--------|----------|
| rez_user_id spoofable | adBazaar | REZ backend | CRITICAL |
| Visit bonus coins never credited | adBazaar | REZ backend | HIGH |
| No retry queue for coin credit | adBazaar | REZ backend | CRITICAL |
| Payment amount never verified | adBazaar | REZ backend | CRITICAL |

---

## Status Table

| Issue | Severity | Sources | Status |
|-------|----------|---------|--------|
| PaymentMachine in-memory | CRITICAL | 3 | ACTIVE |
| Fire-and-forget coin credits | CRITICAL | 4 | ACTIVE |
| Type/enum fragmentation | CRITICAL | ALL | ACTIVE |
| Offline idempotency gaps | CRITICAL | 4 | ACTIVE |
| HMAC key from env var name | CRITICAL | 3 | ACTIVE |
| Settlement blind spot | CRITICAL | 2 | ACTIVE |
| Karma 2x inflation | CRITICAL | 2 | ACTIVE |
| Payment status mismatches | CRITICAL | 5 | ACTIVE |
| Duplicate const startOfWeek | P0 | 5 | ACTIVE |
| SSE no ownership check | CRITICAL | 2 | ACTIVE |
| JWT verify no alg whitelist | CRITICAL | 1 | ACTIVE |
| Redis fail-open | CRITICAL | 2 | ACTIVE |
| Bank details plaintext | CRITICAL | 2 | ACTIVE |
| MongoDB object injection | CRITICAL | 2 | ACTIVE |
| OTP brute-force | CRITICAL | 2 | ACTIVE |
| SSRF auth bypass | CRITICAL | 3 | ACTIVE |
| Coin type divergence | HIGH | 3 | ACTIVE |
| Week boundary mismatch | MEDIUM | 2 | ACTIVE |
