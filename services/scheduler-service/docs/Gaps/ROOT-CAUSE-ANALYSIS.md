# Root Cause Analysis — FORENSIC-001

## 5 Root Causes Driving 65 Findings

---

## Root Cause 1: Copy-Based Extraction (Not Move-Based)

### Mechanism

The monolith was intended to be "strangled" by extracting services. The correct pattern is:
1. Copy logic to service
2. Route traffic to service
3. **Remove logic from monolith**

Step 3 was never completed. The monolith retained all business logic while services got parallel copies.

### Evidence

```
Every extracted service still has a corresponding
monolith file that implements the same logic:

Service:   rez-payment-service/src/models/Payment.ts   → FSM with VALID_TRANSITIONS
Monolith:  rez-backend/src/models/Payment.ts          → FSM with TRANSITIONS
Shared:    rez-shared/src/paymentStatuses.ts          → FSM with PAYMENT_TRANSITIONS

Result: 3 different FSMs for the same entity
```

### Affected Gaps

- [CRITICAL-008](CRITICAL-008-dual-authority.md) — Dual authority enabled
- [CRITICAL-009](CRITICAL-009-three-payment-fsms.md) — 3 FSMs for payments
- [CRITICAL-013](CRITICAL-013-order-statuses-out-of-sync.md) — 11 vs 14 order statuses
- [CRITICAL-016](CRITICAL-016-returned-progress-mismatch.md) — Duplicate getOrderProgress()
- [HIGH-005](HIGH-005-bulk-order-actions-bypass-fsm.md) — Bulk actions in service bypass monolith FSM

### Fix

Strangler fig cutover: for each entity, use a feature flag to switch ownership entirely to the service, then delete the monolith logic.

---

## Root Cause 2: No Monorepo — Services in Separate Repos

### Mechanism

Services exist as separate GitHub repos under `imrejaul007/`. Each repo can only import from `npm` packages, not from other service source code. This means:

1. FSMs can't be imported — they must be copied
2. Enums can't be imported — they must be duplicated
3. Constants can't be imported — they must be hardcoded
4. Types diverge with every change — no compile-time enforcement

### Evidence

```
┌─────────────────────────────────────────────┐
│  imrejaul007/rez-payment-service            │
│  imrejaul007/rez-wallet-service            │
│  imrejaul007/rez-order-service              │
│  imrejaul007/rez-backend                   │
│                                             │
│  Each repo: isolated, no shared imports     │
│  rez-shared: published npm package          │
│  BUT: different versions published           │
│  AND: services pin different versions       │
└─────────────────────────────────────────────┘
```

### Affected Gaps

- [CRITICAL-009](CRITICAL-009-three-payment-fsms.md) — FSM forks because can't import
- [CRITICAL-013](CRITICAL-013-order-statuses-out-of-sync.md) — Enum forks because can't import
- [CRITICAL-010](CRITICAL-010-coin-rate-divergence.md) — Constants copied instead of imported
- [HIGH-010](HIGH-010-coin-type-normalization-lost.md) — Maps exist in shared but not in service
- [HIGH-011](HIGH-011-loyalty-tier-typo-diamond.md) — Tier normalization in shared, not adopted
- [HIGH-015](HIGH-015-schema-mixed-types-40-models.md) — Mixed types used to avoid type conflicts

### Fix

Move to a monorepo (Nx, Turborepo, orpnpm workspaces). All services import from shared source, not npm packages. Single version of truth for all types, enums, FSMs, and constants.

---

## Root Cause 3: Shared MongoDB Cluster — No Database Isolation

### Mechanism

All services connect to the same MongoDB cluster and database. This was done to avoid migration complexity during the extraction process. The consequence: every collection can be written to by multiple services simultaneously.

### Evidence

```javascript
// Every service uses the same connection string pattern:
// mongodb+srv://user:pass@cluster.mongodb.net/rez_production

// rez-payment-service: db.orders.findOne(...)
// rez-order-service:   db.orders.findOne(...)
// rez-backend:         db.orders.findOne(...)
// rez-merchant-service: db.orders.findOne(...)
```

### Affected Gaps

- [CRITICAL-008](CRITICAL-008-dual-authority.md) — Root cause
- [CRITICAL-001](CRITICAL-001-settlement-blind-spot.md) — merchant vs merchantId query
- [CRITICAL-003](CRITICAL-003-merchant-withdrawal-race-condition.md) — Concurrent wallet writes
- [CRITICAL-005](CRITICAL-005-karma-2x-inflation.md) — Dual increment paths
- [CRITICAL-015](CRITICAL-015-silent-coin-failure.md) — Finance service writes to wallet collection

### Fix

Phase 1: Add entity ownership middleware (which service owns which collection)
Phase 2: Move services to separate databases: `rez_payment`, `rez_order`, etc.
Phase 3: Move to collection prefix isolation: `rez_payments.payments`, `rez_backend.payments`

---

## Root Cause 4: No Shared Schema Registry — Schema.Types.Mixed Everywhere

### Mechanism

The team used `Schema.Types.Mixed` liberally to avoid schema conflicts between services. This created fields where:
- No validation occurs at the database layer
- Types drift silently between services
- Refactoring is impossible without breaking existing data
- 40+ instances across all models

### Evidence

```typescript
// Products written by catalog-service:
{ pricing: { mrp: 100, discount: 10 } }

// Products written by merchant-service:
{ pricing: { original: 100, discount: 10 } }

// Consumer app expects:
{ pricing: { mrp: 100 } }

// Result: consumer sees undefined for merchant-service products
```

### Affected Gaps

- [HIGH-015](HIGH-015-schema-mixed-types-40-models.md) — 40+ Mixed field instances
- [HIGH-004](HIGH-004-order-invalid-nested-object.md) — Nested object where string expected
- [CRITICAL-007](CRITICAL-007-fraudflag-missing.md) — Model defined but not registered
- [HIGH-008](HIGH-008-order-service-unused-schemas.md) — Zod schemas never applied
- [MEDIUM-018](MEDIUM-001-020-summary.md) — BNPL schema unvalidated

### Fix

1. Audit all Mixed fields with `grep -rn "Schema.Types.Mixed" --include="*.ts"`
2. Replace with typed subdocuments for each field
3. Add migration scripts for existing data
4. Enable `strict: true` in all Mongoose schemas

---

## Root Cause 5: No Cutover Mechanism — Shadow Mode Runs Indefinitely

### Mechanism

Shadow mode was designed as a temporary state during extraction. Instead, it became permanent. Both the monolith and services execute for every operation, indefinitely, with no plan to end it.

### Evidence

```
Shadow mode started:     2025 (extraction began)
Shadow mode continues:  April 2026 (now)
Cutover mechanism:       NONE EXISTS
Feature flag system:    NOT IMPLEMENTED
```

The consequences compound:
- Dual writes create split-brain states
- FSMs evolve independently in each system
- Field names diverge (merchant vs merchantId)
- Testing requires both systems to be validated

### Affected Gaps

- [CRITICAL-008](CRITICAL-008-dual-authority.md) — Cannot resolve without cutover
- [CRITICAL-009](CRITICAL-009-three-payment-fsms.md) — FSMs diverge because both run
- [CRITICAL-001](CRITICAL-001-settlement-blind-spot.md) — Invisible until cutover happens
- [INFO-005](LOW-001-008-summary.md) — No shadow mode feature flag exists
- All 17 Critical findings — all exacerbated by indefinite shadow mode

### Fix

1. Implement per-entity feature flags:
   ```typescript
   const ENTITY_OWNERSHIP = {
     orders: process.env.ORDERS_OWNER || 'order-service', // monolith | order-service
     payments: process.env.PAYMENTS_OWNER || 'payment-service',
     // etc.
   };
   ```

2. Create cutover checklist per entity:
   - [ ] Entity ownership flag points to service only
   - [ ] All monolith routes for this entity return 404 or proxy to service
   - [ ] Load test at 2x peak traffic
   - [ ] Settlement reconciliation passes
   - [ ] Rollback flag tested

3. Prioritize cutover order: karma → settlements → payments → orders → products

---

## Root Cause → Finding Cascade

```
No Monorepo
    ├── FSM forks (CRITICAL-009, CRITICAL-013, CRITICAL-016)
    ├── Enum forks (HIGH-010, HIGH-011)
    └── Constant duplication (CRITICAL-010, CRITICAL-012)
          │
          ▼
Copy-Based Extraction
    ├── Dual writes to same collections (CRITICAL-008)
    │     ├── Settlement blind spot (CRITICAL-001)
    │     ├── TOCTOU race conditions (CRITICAL-003)
    │     └── Dual karma increments (CRITICAL-005)
    ├── Shadow mode (permanent)
    │     ├── FSM divergence (CRITICAL-009)
    │     ├── Status divergence (CRITICAL-013)
    │     └── Field name divergence (CRITICAL-001)
    └── No auth sync
          ├── Karma auth 404 (CRITICAL-004)
          ├── Catalog auth broken (CRITICAL-002)
          └── Admin cron consumer auth (CRITICAL-006)
                │
                ▼
Shared MongoDB Cluster
    ├── No collection isolation (CRITICAL-008)
    ├── Concurrent writes (CRITICAL-003, CRITICAL-005)
    └── Silent failures persist (CRITICAL-015, CRITICAL-007)
          │
          ▼
Schema.Types.Mixed
    ├── 40+ untyped fields (HIGH-015)
    ├── Invalid data shapes (HIGH-004)
    └── Unregistered models (CRITICAL-007)
          │
          ▼
No Cutover Mechanism
    └── Shadow mode runs forever
          └── ALL dual-write issues never resolve
```

---

## Why Fixing Symptoms Won't Work

Addressing individual gaps without addressing root causes:

| Fix | Won't Work Because |
|-----|-------------------|
| Fix settlement query field | New field mismatches will appear as shadow mode continues |
| Fix karma auth endpoint | Next refactor breaks it again — no shared auth abstraction |
| Fix coin rate in payment service | Wallet service diverges next sprint — no shared config |
| Fix TOCTOU race | Another race condition appears in different service |
| Add index to Payment model | Another missing index in another service |

**Conclusion:** The 65 findings are symptoms. The 5 root causes are the disease. Fix the roots, the symptoms resolve automatically.
