# ENUM-DRIFT-001: Enum Inconsistencies Across Services

**Enum drift issues across 9 services**
**Services:** rez-backend, rez-payment-service, rez-wallet-service, rez-merchant-service, rez-catalog-service, rez-karma-service, rez-gamification-service
**Audit Source:** Enum Consistency Sweep Agent

---

## CRITICAL (2)

### ENUM-001: `ORDER_STATUS` — Backend Has 14, Payment Service Has 11

**Backend (correct, canonical):**
```typescript
ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up',
  'delivered', 'cancelled', 'refunded', 'failed', 'failed_delivery',
  'return_requested', 'return_rejected', 'completed', 'partially_refunded']
// 14 statuses
```

**Payment Service:**
```typescript
const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up',
  'delivered', 'cancelled', 'refunded', 'failed', 'failed_delivery', 'completed']
// 11 statuses — MISSING: return_requested, return_rejected, partially_refunded
```

`partially_refunded` has **no outbound FSM path** in payment-service — it is a dead state. Once an order enters `partially_refunded`, no handler exists to transition it further.

**Impact:** Payment-service cannot process return flows. Orders in `return_requested` or `return_rejected` are invisible to the payment state machine. `partially_refunded` is an unrecoverable terminal state.

---

### ENUM-002: `USER_TIERS` — Backend Missing `diamond`, Gamification Has `platinum`

**Backend (`shared-types/src/enums/user.ts`):**
```typescript
USER_TIERS = ['bronze', 'silver', 'gold', 'platinum']
```

**Gamification service:**
```typescript
coins = { BRONZE: 0, SILVER: 5000, GOLD: 20000, PLATINUM: 50000, DIAMOND: 100000 }
```

Gamification has a `DIAMOND` tier. Backend has no `diamond` in `USER_TIERS`. User model in backend does not support a `diamond` tier.

**Impact:** Users who earn DIAMOND status in gamification are stored as `platinum` in the canonical user model. Rank promotions can silently regress when read from backend.

---

## HIGH (3)

### ENUM-003: `PAYMENT_STATUS` — Missing `partially_refunded` in Payment Service

Payment service `PAYMENT_STATUS` enum has no `partially_refunded` entry. Backend order model supports it, but payment service cannot represent it.

**Impact:** Partial refund operations fail or require workarounds.

---

### ENUM-004: `ORDER_STATUS` in Catalog Service — Only 6 Values

Catalog service defines a subset: `['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']`.

Catalog service cannot represent: `picked_up`, `delivered`, `refunded`, `failed`, `failed_delivery`, `return_requested`, `return_rejected`, `partially_refunded`.

**Impact:** Order status cross-service queries return mismatched enum values.

---

### ENUM-005: `LOYALTY_TIER` vs `USER_TIERS` Dual Definition

`LOYALTY_TIER` defined in `rez-merchant-service` with same values as `USER_TIERS` (bronze/silver/gold/platinum). `rez-gamification-service` has `DIAMOND` as 5th tier.

Two enum sources for the same domain concept.

**Impact:** Tier comparisons across services may fail silently. No single source of truth.

---

## MEDIUM (4)

### ENUM-006: `KarmaEarnSource` — Source Strings Inconsistent

Karma service uses string literals for earn sources: `'checkin'`, `'review'`, `'referral'`, `'purchase'`, etc. No centralized enum.

**Impact:** Typo-prone string literals. `'checkin'` vs `'check_in'` would create separate, unmerged karma records.

---

### ENUM-007: `KarmaRedeemStatus` — Inconsistent State Names

Karma redeem uses `'pending'`, `'approved'`, `'rejected'`, `'completed'`. Wallet transaction status uses `'completed'`, `'failed'`, `'pending'`, `'settled'`.

Different services use different vocabulary for the same states.

---

### ENUM-008: `NotificationType` — Backend vs Notification Service Mismatch

Backend defines: `ORDER_PLACED`, `ORDER_CONFIRMED`, `ORDER_DELIVERED`, `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PROMOTION`, `REFERRAL_EARNED`.

Notification service may have additional or renamed types not reflected in backend.

---

### ENUM-009: `TransactionType` — Wallet vs Finance vs Karma

Wallet: `earn`, `redeem`, `transfer`, `refund`, `cashback`, `expiry`
Finance/BNPL: `disbursement`, `repayment`, `interest`, `penalty`, `waiver`
Karma: `karma_earn`, `karma_redeem`

Three parallel enum definitions for monetary transactions across services.

---

## Status Table

| ID | Severity | Issue | Est Fix |
|----|----------|-------|---------|
| ENUM-001 | CRITICAL | ORDER_STATUS 14 vs 11, partially_refunded dead state | 2h |
| ENUM-002 | CRITICAL | USER_TIERS missing diamond, gamification has platinum | 1h |
| ENUM-003 | HIGH | PAYMENT_STATUS missing partially_refunded | 1h |
| ENUM-004 | HIGH | Catalog ORDER_STATUS only 6 values | 1h |
| ENUM-005 | HIGH | LOYALTY_TIER dual definition | 30m |
| ENUM-006 | MEDIUM | KarmaEarnSource string literals, no enum | 1h |
| ENUM-007 | MEDIUM | KarmaRedeemStatus inconsistent naming | 30m |
| ENUM-008 | MEDIUM | NotificationType backend vs notification-service mismatch | 1h |
| ENUM-009 | MEDIUM | TransactionType triple definition | 2h |
