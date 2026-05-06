# STAYOWN ROUND 2 AUDIT — CRITICAL ISSUES

**Audit Date:** 2026-04-17
**Phase:** Round 2 (new findings across 8 codebases)
**Total:** 5 CRITICAL issues

---

### R2-C1 — `Math.random()` Fallback for 2FA Backup Codes

**File:** `rez-app-consumer/stores/securityStore.ts:312`
**Severity:** CRITICAL
**Category:** Security

**Code:**
```typescript
code[j] = Math.floor(Math.random() * 0xFFFFFFFF);
```

**Root Cause:** 2FA backup codes are generated with `Math.random()` as a fallback when the primary `crypto.getRandomValues()` path fails. Comment at line 296-297 explicitly states the fix was applied, but the `Math.random()` fallback still exists. Backup codes are the last-resort account recovery mechanism — predictable codes are a full account takeover vector.

**Fix:** Throw an error instead of falling back to `Math.random()`. Account recovery should fail safely rather than issue guessable codes:
```typescript
if (!crypto || typeof crypto.getRandomValues !== 'function') {
  throw new Error('Secure random generation unavailable — cannot issue backup codes');
}
code[j] = Math.floor(random() * 0xFFFFFFFF);
```

---

### R2-C2 — `Math.random()` Fallback for Wishlist Item IDs

**File:** `rez-app-consumer/stores/wishlistStore.ts:194`
**Severity:** CRITICAL
**Category:** Security / Functional

**Code:**
```typescript
`${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
```

**Root Cause:** Wishlist item IDs are generated with `Math.random()` as a fallback when `crypto.getRandomValues` is unavailable. Predictable IDs allow users to guess and overwrite each other's wishlist entries.

**Fix:** Use `uuid` or `crypto.randomUUID()`. Remove the `Math.random()` fallback entirely:
```typescript
import { v4 as uuidv4 } from 'uuid';
const id = crypto.randomUUID ? crypto.randomUUID() : uuidv4();
```

---

### R2-C3 — `Math.random()` Fallback for Reward Popup IDs

**File:** `rez-app-consumer/contexts/RewardPopupContext.tsx:63`
**Severity:** CRITICAL
**Category:** Functional

**Code:**
```typescript
`reward-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
```

**Root Cause:** Popup deduplication relies on generated IDs. `Math.random()` makes IDs predictable and potentially duplicate — same popup could fire twice or be deduped incorrectly. A comment at line 55 says "FIX: Use crypto.getRandomValues instead" but the fallback was never removed.

**Fix:** Use `crypto.randomUUID()` or `uuid` package:
```typescript
const popupId = crypto.randomUUID ? crypto.randomUUID() : `reward-${Date.now()}-${uuidv4()}`;
```

---

### R2-C4 — `JSON.parse` Without Try-Catch on Redis Cache (Finance Service)

**File:** `rez-finance-service/src/services/creditScoreService.ts:26`
**Severity:** CRITICAL
**Category:** Functional

**Code:**
```typescript
if (cached) return JSON.parse(cached);
```

**Root Cause:** If Redis returns corrupted or malformed data (bit flip, misconfiguration), `JSON.parse` throws an unhandled exception, crashing the entire request. No fallback to recompute the score.

**Fix:** Wrap in try-catch and fall through to recompute:
```typescript
if (cached) {
  try {
    return JSON.parse(cached);
  } catch {
    // Corrupted cache — fall through to recompute
  }
}
```

---

### R2-C5 — `JSON.parse` Without Try-Catch on Redis Cache (Wallet Service)

**File:** `rez-wallet-service/src/services/walletService.ts:231`
**Severity:** CRITICAL
**Category:** Functional

**Code:**
```typescript
if (cached) return JSON.parse(cached);
```

**Root Cause:** Same as R2-C4 — corrupted Redis cache crashes the balance lookup. Users see 500 errors instead of falling back to the database.

**Fix:** Wrap in try-catch; fall through to recompute balance on parse failure:
```typescript
if (cached) {
  try {
    return JSON.parse(cached);
  } catch {
    // Corrupted cache — fall through to recompute
  }
}
```

---

## Status Summary

| ID | Severity | Title | Source | Status |
|----|----------|-------|--------|--------|
| R2-C1 | CRITICAL | Math.random() fallback for 2FA backup codes | Consumer App | ACTIVE |
| R2-C2 | CRITICAL | Math.random() fallback for wishlist item IDs | Consumer App | ACTIVE |
| R2-C3 | CRITICAL | Math.random() fallback for reward popup IDs | Consumer App | ACTIVE |
| R2-C4 | CRITICAL | JSON.parse without try-catch on Redis (finance) | Finance Service | ACTIVE |
| R2-C5 | CRITICAL | JSON.parse without try-catch on Redis (wallet) | Wallet Service | ACTIVE |
