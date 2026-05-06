# DB-NAMING-001: MongoDB Collection Naming Drift & Dual-Writer Conflicts

**Collection naming issues across 9 services**
**Services:** All MongoDB-backed services
**Audit Source:** DB Collection Naming Sweep Agent

---

## CRITICAL (3)

### DB-NAME-001: 6 Shared Collections Have Dual-Writer Risk

| Collection | Service A | Service B | Conflict |
|-----------|-----------|-----------|---------|
| `orders` | rez-backend | rez-merchant-service | Both write |
| `stores` | rez-backend | rez-catalog-service | Both write |
| `merchants` | rez-backend | rez-merchant-service | Both write |
| `notifications` | rez-backend | rez-notification-events | Both write |
| `wallets` | rez-backend | rez-wallet-service | Both write |
| `payments` | rez-backend | rez-payment-service | Both write |

Each service maintains its own Mongoose model for the same collection. No optimistic locking, no version field, no writeOrdering. Concurrent writes from both services cause last-write-wins data loss.

**Example — Orders:**
```typescript
// rez-backend/models/Order.ts
const OrderSchema = new Schema({ ... });

// rez-merchant-service/models/Order.ts
const OrderSchema = new Schema({ ... });  // Different schema version
```

Both schemas may have different fields, indexes, and validation rules. Writes from one service are not validated against the other's schema.

**Impact:** Data written by one service can be silently corrupted or overwritten by the other. No referential integrity. No transactional boundary across services.

---

### DB-NAME-002: `categories` Collection — Broken Mongoose Plural

Mongoose auto-pluralizes `Category` model as `categories` (correct). But in catalog service, the model is named `Categorys` (typo):

```typescript
mongoose.model('Categorys', categorySchema);  // WRONG: 'Categorys'
```

**Actual collection name:** `categorys` (extra `s`).

**Impact:** Queries against `categories` fail with "collection not found". Catalog service queries never return data.

---

### DB-NAME-003: `activitys` Collection — Broken Mongoose Plural

```typescript
mongoose.model('Activitys', activitySchema);  // WRONG: 'Activitys'
```

**Actual collection name:** `activitys`.

---

## HIGH (3)

### DB-NAME-004: Collection Names Not Standardized — 4 Services Use 4 Names

| Collection | Backend | Merchant | Wallet | Payment |
|-----------|---------|---------|--------|---------|
| Orders | `orders` | `orders` | — | `orders` |
| Users | `users` | — | `users` | — |
| Stores | `stores` | `stores` | — | — |
| Wallets | `wallets` | — | `wallets` | — |

All services use lowercase plural names (correct Mongoose convention). But model files are not centralized — each service re-defines the same models locally.

**Impact:** Schema drift between services. Each service's local model copy can diverge from the canonical schema.

---

### DB-NAME-005: Index Names Not Consistent Across Services

Backend creates index: `{ userId: 1, status: 1, createdAt: -1 }` named `user_status_created`.
Merchant service creates same index named `userId_1_status_1_createdAt_-1` (auto-generated name).

Different index names for the same logical index. Migration scripts targeting one name miss the other.

---

### DB-NAME-006: TTL Indexes — Different Names, Same Purpose

| Service | TTL Index Name | Collection | Field |
|---------|---------------|-----------|-------|
| rez-auth-service | `expiresAt_ttl` | `sessions` | `expiresAt` |
| rez-backend | `session_expire` | `usersessions` | `expiresAt` |
| rez-payment | `ttl_expires` | `payment_sessions` | `expiresAt` |

Three different names for the same pattern.

---

## MEDIUM (4)

### DB-NAME-007: `_id` Field — Some Services Override with `uuid`

Some collections use MongoDB's default `_id` (ObjectId). Others override with `uuid`:

```typescript
_id: { type: String, default: () => crypto.randomUUID() }
```

Cross-collection references assume ObjectId format. UUID-based `_id` values break `$lookup` aggregations.

---

### DB-NAME-008: `createdAt` / `updatedAt` — Not Enforced Universally

Backend models use `timestamps: true`. Some service-local models omit it.

Queries that filter by `createdAt` may fail on collections that never populated the field.

---

### DB-NAME-009: `__v` Version Field — Inconsistent Usage

Some models use Mongoose's `versionKey: '__v'`. Others disable it. When models are shared across services, version-based optimistic locking is unreliable.

---

### DB-NAME-010: Soft-Delete Field Naming Split

Some models use `deletedAt` for soft-delete. Others use `isDeleted`. Others use `active: false`.

```typescript
// Pattern 1
{ deletedAt: { type: Date, default: null } }

// Pattern 2
{ isDeleted: { type: Boolean, default: false } }

// Pattern 3
{ active: { type: Boolean, default: true } }
```

Querying "active" records requires knowing which pattern the target collection uses.

---

## Status Table

| ID | Severity | Issue | Est Fix |
|----|----------|-------|---------|
| DB-NAME-001 | CRITICAL | 6 collections dual-writer risk | 4h |
| DB-NAME-002 | CRITICAL | Categorys broken plural (categorys) | 30m |
| DB-NAME-003 | CRITICAL | Activitys broken plural (activitys) | 30m |
| DB-NAME-004 | HIGH | Model definitions not centralized | 4h |
| DB-NAME-005 | HIGH | Index names inconsistent across services | 2h |
| DB-NAME-006 | HIGH | TTL index names differ across services | 1h |
| DB-NAME-007 | MEDIUM | _id format inconsistency (ObjectId vs UUID) | 2h |
| DB-NAME-008 | MEDIUM | createdAt/updatedAt not universally enforced | 2h |
| DB-NAME-009 | MEDIUM | __v version key inconsistent | 1h |
| DB-NAME-010 | MEDIUM | Soft-delete field naming split (3 patterns) | 2h |
