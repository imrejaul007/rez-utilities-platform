# CFG-MED-001-017: Config / FSM — MEDIUM Issues Summary

**17 MEDIUM issues from Config/FSM/Enum audit**
**Services:** rezbackend, rez-shared, rez-finance-service

---

## CFG-MED-001: `MAX_COIN_USAGE_PCT` Default 100% vs `promoCoin.maxUsagePercentage` 20%

`economicsConfig.ts` sets `MAX_COIN_USAGE_PCT = 100` (100%) while `checkoutConfig.ts` sets `promoCoin.maxUsagePercentage = 20`. The default of 100% contradicts the stated 20% cap.

---

## CFG-MED-002: Cashback Rates Stored as Decimals But Used Inconsistently

`CASHBACK_CONFIG.baseRate: 0.02` (2%), `merchantMaxRate: 0.20` (20%), `default: 0.10` (10%) — all decimals. But the validation at CFG-FSM-004 multiplies by 100, suggesting confusion about whether rates are 0.0-1.0 or 0-100.

---

## CFG-MED-003: MongoDB Pool Sizes Inconsistent Across Services

| Service | maxPoolSize | minPoolSize |
|---------|-------------|-------------|
| rezbackend | 25 | 5 |
| rez-karma-service | 10 | 2 |
| rez-finance-service | 20 | 5 |

No rationale documented. Karma service (`maxPoolSize=10`) may exhaust under load while backend (`maxPoolSize=25`) has larger buffer.

---

## CFG-MED-004: `fetch()` Without Timeout in `alerts.ts`

**File:** `src/config/alerts.ts:248-260`

```typescript
await fetch(slackUrl, {
  method: 'POST',
  body: JSON.stringify({...}),
  // No AbortSignal.timeout() — blocks forever if Slack is slow
});
```

Compare: `jobQueues.ts` correctly uses `signal: AbortSignal.timeout(10000)`.

---

## CFG-MED-005: Redis Sentinel Name Hardcoded as 'mymaster'

**File:** `src/config/redis.ts:62`

```typescript
sentinelName: process.env.REDIS_SENTINEL_NAME || 'mymaster',
```

No env var override validation. Misconfigured sentinel silently falls back.

---

## CFG-MED-006: `toLocaleDateString` Without Explicit Timezone

**File:** `rez-shared/src/utils/date.ts:1-5`

```typescript
new Date(dateStr).toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric'
  // No timezone — server timezone determines output
});
```

On a server in US/Pacific, dates render differently than on IST servers. `regions.ts` stores `timezone: 'Asia/Kolkata'` but this is never used in formatting.

---

## CFG-MED-007: `checkoutConfig.ts` Has Duplicate Hardcoded Coin Configs

**File:** `src/config/checkoutConfig.ts:19-33`

Hardcoded `coins.rezCoin.maxUsagePercentage: 100` and `promoCoin.maxUsagePercentage: 20` duplicate values from `CURRENCY_RULES` and `DEFAULT_PROMO_COINS_CONFIG`. Does not read from env vars — `MERCHANT_MAX_CASHBACK_PCT` from `economicsConfig.ts` is ignored.

---

## CFG-MED-008: `COIN_TYPE_ARRAY` Order Doesn't Match `CURRENCY_RULES.priority`

`COIN_TYPE_ARRAY` orders: `promo > branded > prive > cashback > referral > rez`
`CURRENCY_RULES` priority: `rez(4) > prive(3) > branded(2) > promo(1)` (descending)

The priority field and array order are inverted.

---

## CFG-MED-009: `keepAlive` Comment Says 30s, Code Says 10s

**File:** `src/config/redis-pool.ts:92`

```typescript
keepAlive: 10000, // 10s — shorter than Render's idle timeout
// TCP keep-alive every 30 seconds  ← comment contradicts
```

---

## CFG-MED-010: `PORT` Not in `EnvConfig` Interface But Returned in Config

**File:** `src/config/validateEnv.ts:10-19`

`runDetailedValidation()` validates PORT, but the returned `EnvConfig` interface does NOT include `PORT`. TypeScript type and runtime value are out of sync.

---

## CFG-MED-011: SLA_THRESHOLDS Missing `delivered`, `cancelled` States

**File:** `src/config/orderStateMachine.ts:113-120`

```typescript
export const SLA_THRESHOLDS: Record<string, number> = {
  placed: 60, confirmed: 30, preparing: 120, ready: 30,
  dispatched: 180, out_for_delivery: 120,
  // delivered, cancelled, cancelling, returned, refunded — all missing
};
```

---

## CFG-MED-012: Service Name Hardcoded as 'user-backend' in Logger

**File:** `src/config/logger.ts:63`

```typescript
defaultMeta: { service: 'user-backend', environment: process.env.NODE_ENV || 'development' }
```

Different services importing this logger all report as `'user-backend'`.

---

## CFG-MED-013: `CACHE_ENABLED !== 'false'` Fragile String Comparison

**File:** `src/config/redis.ts:56`

```typescript
enabled: process.env.CACHE_ENABLED !== 'false'
```

Setting `CACHE_ENABLED=0` (numeric) enables cache. `CACHE_ENABLED=false` (boolean) also enables cache. Only the exact string `'false'` disables it.

---

## CFG-MED-014: Promotional Coin Expiry Days — 90 vs 90 vs 90 (Coincidentally Consistent)

`economicsConfig.ts: CURRENCY_RULES.promo.expiryDays = 90`
`promoCoins.config.ts: DEFAULT_PROMO_COINS_CONFIG.expiry.expiryDays = 90`
`rez-shared/coins.ts: COIN_EXPIRY_DAYS.promo = 90`

Coincidentally all 90, but defined in 3 separate places. One change doesn't propagate.

---

## CFG-MED-015: Reward Kill Switches Not Enforced in Reward Operations

Kill switches (`KILL_SWITCHES`) are defined but never checked before reward operations execute. Have no effect unless explicitly called at service layer.

---

## CFG-MED-016: `validateMerchantPayoutMath` Tolerance Check Relies on Float-to-String Coercion

**File:** `src/config/economicsConfig.ts:172-180`

```typescript
if (Math.abs(netAmount - expectedNet) > tolerance) { ... }
// toFixed(2) rounds 970.501 → 970.50
// netAmount stored as 970.5, expected as '970.50' string
// Math.abs(970.5 - 970.50) = 0 (coerced to same number)
```

Works but relies on implicit coercion — fragile.

---

## CFG-MED-017: `generateSecureSecret` Parameter Ignored — Always Returns 88-Chars

**File:** `src/config/validateEnv.ts:382-384`

```typescript
crypto.randomBytes(length).toString('base64')  // length=64 → 88 chars always
```

The `length` parameter is misleading — output is always 88 chars for any input.

---

## Status Table

| ID | Status | Est Fix |
|----|--------|---------|
| CFG-MED-001 | ACTIVE | 30m |
| CFG-MED-002 | ACTIVE | 1h |
| CFG-MED-003 | ACTIVE | 30m |
| CFG-MED-004 | ACTIVE | 30m |
| CFG-MED-005 | ACTIVE | 15m |
| CFG-MED-006 | ACTIVE | 1h |
| CFG-MED-007 | ACTIVE | 30m |
| CFG-MED-008 | ACTIVE | 1h |
| CFG-MED-009 | ACTIVE | 15m |
| CFG-MED-010 | ACTIVE | 15m |
| CFG-MED-011 | ACTIVE | 1h |
| CFG-MED-012 | ACTIVE | 15m |
| CFG-MED-013 | ACTIVE | 15m |
| CFG-MED-014 | ACTIVE | 2h |
| CFG-MED-015 | ACTIVE | 3h |
| CFG-MED-016 | ACTIVE | 1h |
| CFG-MED-017 | ACTIVE | 30m |
