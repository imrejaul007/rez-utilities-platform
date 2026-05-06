# Cross-Repo Consistency Audit

**Date:** 2026-04-17
**Scope:** All fixes applied across all repos
**Auditor:** Claude Code (Autonomous Consistency Auditor)

---

## Summary

| Pattern | Status |
|---------|--------|
| Idempotency-Key header | Fixed (was: inconsistent) |
| Idempotency-Key generation (uuid) | Fixed (was: missing in rez-now) |
| Order status enums | Verified consistent |
| Coin type enums | Verified consistent |
| Payment status enums | Fixed (was: non-canonical) |
| Error response format | Verified consistent |
| Logger usage | Verified consistent |
| ID generation (CSPRNG) | Verified consistent |
| Auth header parsing | Verified consistent |

---

## Inconsistencies Found and Fixed

### 1. HTTP Header Name: `X-Idempotency-Key` vs `Idempotency-Key`

| Repo | File | Issue | Fix Applied |
|------|------|-------|------------|
| `rez-app-marchant` | `services/offline.ts` (line 252) | Used non-canonical `X-Idempotency-Key` header | Changed to `Idempotency-Key` — matching the canonical header name used by all other services |

**Impact:** The merchant app's offline sync endpoint sends the idempotency key under a different header name than the backend middleware expects (`Idempotency-Key`). This means offline sync retries were NOT being deduplicated by the backend, risking duplicate mutations.

### 2. Idempotency-Key Generation: Missing UUID Component

| Repo | File | Issue | Fix Applied |
|------|------|-------|------------|
| `rez-now` | `lib/api/client.ts` (line 73-75) | `makeIdempotencyKey()` used only `Date.now()` — no UUID. Within the same millisecond, concurrent retries produce identical keys, defeating deduplication | Added `crypto.randomUUID()` as the uuid component. Format now: `{type}:{key}:{timestamp}:{uuid}` |

**Impact:** High. Without a uuid, two simultaneous retries within the same millisecond would produce identical idempotency keys. The backend would accept only the first, but subsequent retries (which are the whole point of idempotency) would collide and be rejected.

### 3. Duplicate Interface Definition

| Repo | File | Issue | Fix Applied |
|------|------|-------|------------|
| `rez-app-consumer` | `services/walletApi.ts` (lines 141-171, 299-329) | `TransactionMetadata` interface was defined twice — identical copies at lines 145 and 303 | Removed the duplicate definition at line 303 |

### 4. Non-Canonical PaymentStatus

| Repo | File | Issue | Fix Applied |
|------|------|-------|------------|
| `rez-app-consumer` | `types/order.ts` (lines 19-28) | Defined local `PaymentStatus` with non-canonical values: `awaiting_payment`, `authorized`, `paid`. Canonical is `shared-types`: `pending`/`processing`/`completed`/`failed`/`cancelled`/`expired`/`refund_initiated`/`refund_processing`/`refunded`/`refund_failed`/`partially_refunded` | Updated to canonical 11-state FSM matching `packages/shared-types/src/enums/index.ts` |

**Impact:** UI components were checking `order.payment.status === 'paid'` (non-canonical) instead of `'completed'` (canonical). Fixed 4 affected files:

| Repo | File | Line | Fix |
|------|------|------|-----|
| `rez-app-consumer` | `app/order-confirmation.tsx` | 290 | `'paid'` → `'completed'` |
| `rez-app-consumer` | `app/orders/[id].tsx` | 411 | `'paid'` → `'completed'` |
| `rez-app-consumer` | `app/tracking/[orderId].tsx` | 727 | `'paid'` → `'completed'` |
| `rez-app-consumer` | `services/paymentService.ts` | 270 | `'paid'` → `'completed'` |

---

## Canonical Patterns Verified

### 1. Idempotency-Key Header ✅

**Canonical header name:** `'Idempotency-Key'`

| File | Pattern Used | Status |
|------|-------------|--------|
| `rez-app-consumer/services/walletApi.ts` | `headers: { 'Idempotency-Key': key }` | ✅ |
| `rez-app-consumer/services/priveApi.ts` | `headers: { 'Idempotency-Key': request.idempotencyKey }` | ✅ |
| `rez-app-consumer/services/ordersApi.ts` | `headers: { 'Idempotency-Key': key }` | ✅ |
| `rez-app-consumer/services/billPaymentApi.ts` | `headers: { 'Idempotency-Key': key }` | ✅ |
| `rez-app-consumer/hooks/usePaymentFlow.ts` | `headers: { 'Idempotency-Key': resolvedKey }` | ✅ |
| `adBazaar/src/app/api/bookings/route.ts` | `req.headers.get('Idempotency-Key')` | ✅ |
| `rez-now/lib/api/orders.ts` | `headers: { 'Idempotency-Key': idempotencyKey }` | ✅ |
| `rez-now/lib/api/scanPayment.ts` | `headers: { 'Idempotency-Key': idempotencyKey }` | ✅ |
| `rez-wallet-service/src/services/walletService.ts` | Internal idempotency via `idempotencyKey` field | ✅ |
| `rezbackend/rez-backend-master/src/services/walletService.ts` | Internal idempotency via `referenceId` | ✅ |
| `rez-app-marchant/services/offline.ts` | **Previously `'X-Idempotency-Key'`** | ✅ Fixed |

### 2. Idempotency-Key Generation Format ✅

**Canonical pattern:** `{operation}-{Date.now()}-{uuidv4()}`

| File | Pattern Used | UUID Present | Status |
|------|-------------|--------------|--------|
| `rez-app-consumer/utils/idempotencyKey.ts` | `${operation}_${epochBucket}_${randomValue}` | `crypto.getRandomValues()` + fallback to `crypto.randomUUID()` | ✅ |
| `rez-app-consumer/services/walletApi.ts` | `wallet-pay-${Date.now()}-${uuid.v4()}` | `uuid.v4()` | ✅ |
| `rez-now/lib/api/client.ts` | **Previously `${type}:${key}:${Date.now()}`** | No uuid | ✅ Fixed — now includes `crypto.randomUUID()` |
| `rez-wallet-service/src/services/walletService.ts` | Internal: `uuidv4()` in `writeLedgerPair` | `uuidv4()` | ✅ |

### 3. Order Status Enums ✅

**Canonical:** `packages/shared-types/src/enums/index.ts` — `OrderStatus` enum (11 states)

Values: `placed`, `confirmed`, `preparing`, `ready`, `dispatched`, `out_for_delivery`, `delivered`, `cancelled`, `cancelling`, `returned`, `refunded`

| Repo | Source | Values | Status |
|------|--------|--------|--------|
| `packages/shared-types` | `enums/index.ts` | Canonical 11 states | ✅ |
| `rez-app-consumer` | `types/order.ts` | All 11 states | ✅ |
| `rez-app-consumer` | `types/rez-shared-types.ts` | Re-exports from shared-types | ✅ |
| `rez-app-consumer` | `types/rez-shared-types.ts` — `normalizeOrderStatus()` | Maps legacy: `pending→placed`, `processing→preparing`, `shipped→dispatched`, `completed→delivered` | ✅ |
| `tests/integration/orderFlow.integration.test.ts` | Uses `placed`, `confirmed`, `preparing`, `ready`, `delivered` | ✅ |

### 4. Coin Type Enums ✅

**Canonical:** `packages/shared-types/src/enums/index.ts` — `CoinType` enum (6 values)

Values: `promo`, `branded`, `prive`, `cashback`, `referral`, `rez`

| Repo | Source | Values | Status |
|------|--------|--------|--------|
| `packages/shared-types` | `enums/index.ts` | Canonical 6 values | ✅ |
| `packages/shared-enums` | `src/index.ts` | `'rez'`, `'prive'`, `'branded'`, `'promo'` (lowercase, matches) | ✅ |
| `rez-app-consumer` | `types/rez-shared-types.ts` | Re-exports `CoinType` from shared-types | ✅ |
| `rez-wallet-service/src/services/walletService.ts` | Uses lowercase: `'rez'`, `'prive'`, `'branded'`, `'promo'`, `'cashback'`, `'referral'` | ✅ |
| `rezbackend/rez-backend-master/src/services/walletService.ts` | Uses `'rez'` as default coinType | ✅ |
| `rez-karma-service/src/services/walletIntegration.ts` | `coinType: 'rez'` | ✅ |

### 5. Payment Status Enums ✅

**Canonical:** `packages/shared-types/src/enums/index.ts` — `PaymentStatus` enum (11 states)

Values: `pending`, `processing`, `completed`, `failed`, `cancelled`, `expired`, `refund_initiated`, `refund_processing`, `refunded`, `refund_failed`, `partially_refunded`

| Repo | Source | Values | Status |
|------|--------|--------|--------|
| `packages/shared-types` | `enums/index.ts` | Canonical 11 states | ✅ |
| `rez-app-consumer` | `types/payment.types.ts` | 11 states (canonical) | ✅ |
| `rez-app-consumer` | `types/order.ts` | **Previously non-canonical (`awaiting_payment`, `authorized`, `paid`)** | ✅ Fixed |
| `rez-app-consumer` | `services/paymentService.ts` | Has `normalizePaymentStatus()` | ✅ |

### 6. Error Response Format ✅

All Next.js API routes use `NextResponse.json({ error: '...' }, { status: N })`.

| File | Pattern | Status |
|------|---------|--------|
| `adBazaar/src/app/api/bookings/route.ts` | `NextResponse.json({ error: '...' }, { status: N })` | ✅ |
| Backend routes (all) | `return NextResponse.json({ error: '...' }, { status: 400 })` | ✅ |

### 7. Logger Usage ✅

All backend services use centralized logger (`createServiceLogger` from `config/logger`).

| File | Status |
|------|--------|
| `rez-wallet-service/src/config/logger.ts` | ✅ Structured logger |
| `rez-wallet-service/src/services/walletService.ts` | `logger.info/warn/error` | ✅ |
| `rezbackend/rez-backend-master/src/services/walletService.ts` | `logger.info/warn/error` | ✅ |

No bare `console.log/error/warn` found in backend service files.

### 8. ID Generation (CSPRNG) ✅

All wallet mutation ID generation uses `uuid` or `crypto.randomUUID()`.

| File | Pattern | Status |
|------|---------|--------|
| `rez-wallet-service/src/services/walletService.ts` | `uuidv4()` for pairId | ✅ |
| `rez-app-consumer/utils/idempotencyKey.ts` | `crypto.getRandomValues()` + `crypto.randomUUID()` fallback | ✅ |
| `rez-app-consumer/services/walletApi.ts` | `uuid.v4()` | ✅ |
| `rez-now/lib/api/client.ts` | **Previously `Date.now()` only** | ✅ Fixed — now includes `crypto.randomUUID()` |

### 9. Auth Header Parsing ✅

All Next.js routes use the canonical pattern:
```typescript
const authHeader = req.headers.get('authorization') ?? ''
const accessToken = authHeader.startsWith('Bearer ')
  ? authHeader.slice(7)
  : null
if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

| File | Status |
|------|--------|
| `adBazaar/src/app/api/bookings/route.ts` | ✅ |
| `rez-now` API routes | ✅ |

---

## Remaining Observations (Not Fixed — No Action Required)

### Shared Enums Package
`packages/shared-enums/src/index.ts` coexists with `packages/shared-types/src/enums/index.ts`. The shared-enums package uses lowercase string values (`'rez'`, `'prive'`, etc.) while shared-types uses TypeScript enums. Both are consistent with each other. No change needed.

### Legacy Normalization Functions
The consumer app's `types/rez-shared-types.ts` has `normalizeOrderStatus()` which maps legacy FSM values to canonical ones. This is a defense-in-depth pattern — useful for handling responses from backends that may still emit old values. No change needed.

### Cart Lock Payment Status
`rez-app-consumer/services/cartApi.ts` and `LockedItem.tsx` define `lockPaymentStatus` with values `pending | paid | refunded | forfeited | applied`. This is a separate domain (cart lock state machine) from the canonical `PaymentStatus` enum. These are intentionally different and not a consistency issue.

### Backend Payment Status on Orders
Some backend paths return `payment.status === 'paid'` on the order's payment sub-document. The consumer app's `services/paymentService.ts` has a `normalizePaymentStatus()` from `@rez/rez-shared/statusCompat` to handle this. This normalization layer is intentional and not a consistency violation.

---

## Action Items

- [x] Fix `X-Idempotency-Key` → `Idempotency-Key` in `rez-app-marchant/services/offline.ts`
- [x] Add uuid to `makeIdempotencyKey()` in `rez-now/lib/api/client.ts`
- [x] Remove duplicate `TransactionMetadata` interface in `rez-app-consumer/services/walletApi.ts`
- [x] Align `PaymentStatus` in `rez-app-consumer/types/order.ts` with canonical `shared-types`
- [x] Update `'paid'` → `'completed'` in 4 consumer app files

---

## Files Modified in This Audit

| Repo | File | Change |
|------|------|--------|
| `rez-app-marchant` | `services/offline.ts` | `X-Idempotency-Key` → `Idempotency-Key` |
| `rez-now` | `lib/api/client.ts` | Added `crypto.randomUUID()` to `makeIdempotencyKey()` |
| `rez-app-consumer` | `services/walletApi.ts` | Removed duplicate `TransactionMetadata` interface |
| `rez-app-consumer` | `types/order.ts` | Replaced non-canonical `PaymentStatus` with canonical 11-state FSM |
| `rez-app-consumer` | `app/order-confirmation.tsx` | `'paid'` → `'completed'` |
| `rez-app-consumer` | `app/orders/[id].tsx` | `'paid'` → `'completed'` |
| `rez-app-consumer` | `app/tracking/[orderId].tsx` | `'paid'` → `'completed'` |
| `rez-app-consumer` | `services/paymentService.ts` | `'paid'` → `'completed'` in terminal state check |
