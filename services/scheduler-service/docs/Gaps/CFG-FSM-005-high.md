# CFG-HIGH-001-010: Config / FSM / Enum — HIGH Issues Summary

**16 HIGH issues from Config/FSM/Enum audit**
**Services:** rezbackend, rez-shared, rez-karma-service, rez-gamification-service

---

## CFG-HIGH-001: Circuit Breaker Never Recovers — Division by Zero Always Evaluates

**File:** `src/config/circuitBreakerConfig.ts:94-104`

The failure rate calculation `failureRate = (failureCount / (failureCount + successCount)) * 100` fires the comparison every time a failure occurs, regardless of whether recent requests succeeded. The breaker stays open after any failure once `successCount` is 0.

---

## CFG-HIGH-002: `maskSecret(8-char)` Returns Full Secret

**File:** `src/config/validateEnv.ts:389-392`

```typescript
export function maskSecret(secret: string): string {
  if (!secret || secret.length < 8) return '***';
  return secret.substring(0, 4) + '***' + secret.substring(secret.length - 4);
}
// '12345678' → '1234***5678' — full 8-char secret exposed
```

Only secrets strictly shorter than 8 chars are masked. An 8-char secret is fully exposed in logs.

---

## CFG-HIGH-003: Kubernetes DNS Names as Hardcoded Fallback for Service URLs

**File:** `rez-karma-service/src/config/index.ts:14-19`

```typescript
export const authServiceUrl =
  process.env.AUTH_SERVICE_URL || 'http://rez-auth-service:3001';
export const walletServiceUrl =
  process.env.WALLET_SERVICE_URL || 'http://rez-wallet-service:4004';
```

Kubernetes DNS names as defaults means the karma service attempts non-existent hostnames if env vars are missing. No startup validation exists — service starts but calls fail at runtime.

---

## CFG-HIGH-004: Duplicate ErrorCode — `const object` vs TypeScript `enum`

**Files:** `rez-shared/src/constants/errors.ts` + `rez-shared/src/middleware/errorHandler.ts`

Two separate `ErrorCode` definitions:
- `errors.ts`: `const object` form — `AUTH_EXPIRED: 'AUTH_EXPIRED'`
- `errorHandler.ts`: `enum` form — `INVALID_REQUEST = 'INVALID_REQUEST'`

Code importing from different files gets incompatible types.

---

## CFG-HIGH-005: `normalizeLoyaltyTier` Exported Twice With Different DIAMOND Mappings

**Files:** `rez-shared/src/enums.ts` + `rez-shared/src/constants/coins.ts`

- `enums.ts`: `DIAMOND → 'diamond'` (correct)
- `coins.ts`: `DIAMOND → 'platinum'` (incorrect)

Code importing from the wrong file gets incorrect tier normalization.

---

## CFG-HIGH-006: Dead States — `failed_delivery`, `return_requested`, `return_rejected` Have No Transitions

**Files:** `src/config/orderStateMachine.ts` + `rez-shared/src/orderStatuses.ts`

`failed_delivery`, `return_requested`, `return_rejected` are defined in `shared/orderStatuses.ts` but have no corresponding transitions in the backend FSM. These states are unreachable — orders can never enter these states.

---

## CFG-HIGH-007: Phone Number Regex Allows Bare 10-Digit Numbers

**File:** `rez-shared/src/schemas/validationSchemas.ts:32-34`

```typescript
.regex(/^(\+91|91)?[6-9]\d{9}$/)
// Accepts: '919876543210', '+919876543210', '9876543210' (bare 10 digits)
```

Bare 10-digit numbers without country code are ambiguous — accepted without country code prefix.

---

## CFG-HIGH-008: `DAILY_EARNING_CAP_COINS` vs `COIN_EARNING_CAPS.daily` Use Different Env Vars

**Files:** `src/config/economicsConfig.ts` + `src/config/rewardConfig.ts`

- `DAILY_EARNING_CAP_COINS` reads `DAILY_EARNING_CAP_COINS` env var
- `COIN_EARNING_CAPS.daily` reads `REWARD_DAILY_COIN_CAP` env var

Same default value (1000) but different env var names. If set to different values, one service reads one and another reads the other.

---

## CFG-HIGH-009: BullMQ `maxRetriesPerRequest: 3` vs `null` — Blocking Operations Fail

**Files:** `src/config/jobQueues.ts` vs `src/config/bullmq-connection.ts`

- `jobQueues.ts`: `maxRetriesPerRequest: 3`
- `bullmq-connection.ts`: `maxRetriesPerRequest: null`

BullMQ requires `null` for blocking commands (BRPOP). With `maxRetriesPerRequest: 3`, blocking operations would fail after 3 retries instead of blocking indefinitely.

---

## CFG-HIGH-010: `camelToSnake` Fails on Consecutive Capitals

**File:** `rez-shared/src/utils/caseNormalization.ts:52-54`

```typescript
export function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
// 'myURLParser' → 'my_u_r_l_parser' (wrong)
// Should be: 'my_url_parser'
```

---

## CFG-HIGH-011: `normalizeCase` Fails on Single-Character All-Caps Input

**File:** `rez-shared/src/utils/caseNormalization.ts:70-86`

```typescript
normalizeCase('A')  // → 'a' (wrong — single-char enum becomes lowercase)
```

---

## CFG-HIGH-012: `generateSecureSecret` Returns 88-Char Base64 Regardless of Input Length

**File:** `src/config/validateEnv.ts:382-384`

```typescript
export function generateSecureSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('base64');
}
// length=64 → 88-char output (always 88 chars for any length)
```

---

## CFG-HIGH-013: `getOfferValue` Returns Percentage or Amount Depending on Field Availability

**File:** `rez-shared/src/utils/caseNormalization.ts:138-148`

```typescript
const value =
  (offer.value as number) ??
  (offer.cashbackPercentage as number) ??  // returns %, not amount
  (offer.discountValue as number) ??
  (offer.cashbackAmount as number) ??
  (offer.offerValue as number) ?? 0;
```

If `value` is 0 and `cashbackPercentage` is 10, returns `10` (percentage) where an amount is expected.

---

## CFG-HIGH-014: No `'diamond'` Entry in `SOURCE_TO_CATEGORY`

**File:** `src/config/earningsCategories.ts:7-44`

44 entries in `SOURCE_TO_CATEGORY` but no entry for `'diamond'` tier purchases. Diamond users see blank category in earnings UI.

---

## CFG-HIGH-015: `EVENT_TO_METRICS` Event Names Not Validated Against `ORDER_STATUSES`

**File:** `src/config/achievementMetrics.ts:194-210`

`order_delivered` event mapped to metrics, but FSM uses `delivered` state. No validation ties event names to actual status strings.

---

## CFG-HIGH-016: Kill Switches Defined But Not Enforced

**File:** `src/config/rewardConfig.ts:209-218`

```typescript
export const KILL_SWITCHES = {
  allRewards: process.env.REWARD_KILL_SWITCH_ALL === 'true',
  // ...
};
```

Defined but never checked at service/controller layer. Have no effect.

---

## Status Table

| ID | Status | Category | Est Fix |
|----|--------|----------|---------|
| CFG-HIGH-001 | ACTIVE | Circuit breaker bug | 1h |
| CFG-HIGH-002 | ACTIVE | Security / logging | 30m |
| CFG-HIGH-003 | ACTIVE | Config / deployment | 30m |
| CFG-HIGH-004 | ACTIVE | Duplicate definitions | 1h |
| CFG-HIGH-005 | ACTIVE | Enum / tier mapping | 30m |
| CFG-HIGH-006 | ACTIVE | FSM / dead states | 2h |
| CFG-HIGH-007 | ACTIVE | Validation | 30m |
| CFG-HIGH-008 | ACTIVE | Config duplication | 1h |
| CFG-HIGH-009 | ACTIVE | BullMQ inconsistency | 1h |
| CFG-HIGH-010 | ACTIVE | Utility bug | 30m |
| CFG-HIGH-011 | ACTIVE | Utility bug | 30m |
| CFG-HIGH-012 | ACTIVE | Utility bug | 30m |
| CFG-HIGH-013 | ACTIVE | Ambiguous return type | 30m |
| CFG-HIGH-014 | ACTIVE | Missing data mapping | 1h |
| CFG-HIGH-015 | ACTIVE | FSM / validation | 1h |
| CFG-HIGH-016 | ACTIVE | Dead code / kill switches | 2h |
