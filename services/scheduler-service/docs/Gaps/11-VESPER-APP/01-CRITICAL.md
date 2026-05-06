# Vesper App — CRITICAL Issues

**Date:** 2026-04-16
**Source:** Full codebase audit of `vesper-app/` (React Native + Node.js server)
**Total:** 3 CRITICAL issues

---

## VS-C1 — `jwt.verify()` Without `algorithms` Option — Algorithm Confusion Attack

**Files:** `server/src/utils/jwt.ts:48, 59, 78`

```ts
// Line 48 — verifyAccessToken
const payload = jwt.verify(token, ACCESS_TOKEN_SECRET as string) as TokenPayload;

// Line 59 — verifyRefreshToken
payload = jwt.verify(token, REFRESH_TOKEN_SECRET as string) as TokenPayload;

// Line 78 — revokeRefreshToken
const payload = jwt.verify(token, REFRESH_TOKEN_SECRET as string) as TokenPayload;
```

**Finding:** All three `jwt.verify()` calls omit the `algorithms` option. Without `algorithms: ['HS256']`, `jsonwebtoken` accepts tokens with `alg: 'none'`, stripping the signature entirely. An attacker can forge any token by setting `alg: 'none'` and providing no signature.

**Impact:** Token forgery. Any user can impersonate any other user by crafting a JWT with `alg: 'none'`. Full account takeover.

**Fix:**
```ts
const payload = jwt.verify(token, ACCESS_TOKEN_SECRET as string, {
  algorithms: ['HS256'],
}) as TokenPayload;
```

**Also affects:** Same pattern in `rez-finance-service/src/middleware/auth.ts:37` and `rez-scheduler-service/src/middleware/auth.ts:36`.

**Category:** Security — Authentication Bypass

---

## VS-C2 — OrderStatus Enum Incompatible with REZ Canonical

**File:** `server/src/types/index.ts:12`

```ts
export type OrderStatus = 'pending' | 'confirmed' | 'processing' |
  'shipped' | 'delivered' | 'cancelled' | 'returned';
```

**Finding:** Vesper defines its own `OrderStatus` independently. The canonical REZ `OrderStatus` (from `rez-shared`) uses `'placed'`, `'preparing'`, `'out_for_delivery'`, `'dispatched'` — none of which appear in the vesper definition. Values like `'processing'` and `'shipped'` don't exist in the canonical set.

**Crosses:** vesper-app server → REZ shared types

**Impact:** If vesper orders are ever synced to the REZ ecosystem, all order status queries return empty sets. Status filters don't match. Order history is corrupted.

**Fix:** Import from canonical shared package or align with canonical enum values.

**Category:** Data Integrity / Cross-Platform

---

## VS-C3 — PaymentStatus Enum Incompatible with REZ Canonical

**File:** `server/src/types/index.ts:17`

```ts
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
```

**Finding:** Vesper uses `'success'` as the terminal success state. The canonical REZ `PaymentStatus` uses `'paid'`. The canonical also includes `'awaiting_payment'`, `'processing'`, `'authorized'`, `'partially_refunded'`, `'expired'`, `'cancelled'` — none of which vesper handles.

**Crosses:** vesper-app server → REZ shared types

**Impact:** Payment success/failure detection always fails when syncing with REZ. `'success'` is never `'paid'`. Payment history shows zero successful transactions.

**Fix:** Replace with canonical `PaymentStatus` from shared package.

**Category:** Data Integrity / Cross-Platform

---

## Summary

| ID | Title | Severity | File | Est. | Status |
|----|-------|---------|------|------|--------|
| VS-C1 | `jwt.verify()` without algorithms | CRITICAL | `server/src/utils/jwt.ts:48,59,78` | 10m | ACTIVE |
| VS-C2 | OrderStatus incompatible with REZ canonical | CRITICAL | `server/src/types/index.ts:12` | 2h | ACTIVE |
| VS-C3 | PaymentStatus incompatible with REZ canonical | CRITICAL | `server/src/types/index.ts:17` | 1h | ACTIVE |
