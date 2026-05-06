# KARMA SERVICE — ERROR HANDLING GAPS

**Service:** `rez-karma-service`
**Date:** 2026-04-16
**Severity:** 4 MEDIUM, 1 LOW

---

## MEDIUM

---

### G-KS-E1 — Silent 0 Return on Wallet Balance Failure

**File:** `src/services/walletIntegration.ts` — lines 116-134
**Severity:** MEDIUM
**Category:** Error Handling / Silent Failure

**Code:**
```typescript
export async function getKarmaBalance(userId: string): Promise<number> {
  // ...
  return response.data.balance?.available ?? 0;
// ...
  return 0; // Returns 0 on any error
}
```

**Root Cause:** Silently returns `0` when wallet service is unreachable. Indistinguishable from "user has no coins."

**Fix:** Return a typed result:
```typescript
export async function getKarmaBalance(userId: string): Promise<{
  balance: number;
  available: boolean;
}> {
  try { ... return { balance: ..., available: true }; }
  catch { return { balance: 0, available: false }; }
}
```

**Status:** ACTIVE

---

### G-KS-E2 — QR Replay Window Doesn't Handle Clock Drift

**File:** `src/engines/verificationEngine.ts` — lines 169-173
**Severity:** MEDIUM
**Category:** Error Handling / Edge Case

**Code:**
```typescript
const fiveMinutesMs = 5 * 60 * 1000;
if (Math.abs(Date.now() - decoded.ts) > fiveMinutesMs) {
  return { valid: false, error: 'QR code has expired' };
}
```

**Root Cause:** `Math.abs(...)` rejects both future and past timestamps. Phone clocks 6+ minutes off from server = all QR codes rejected. Error message is misleading.

**Fix:**
```typescript
const now = Date.now();
const MAX_DRIFT_MS = 10 * 60 * 1000; // 10 minutes to handle clock drift
const MAX_AGE_MS = 5 * 60 * 1000;    // 5 minutes max age
if (decoded.ts > now + MAX_DRIFT_MS || now - decoded.ts > MAX_AGE_MS) {
  return { valid: false, error: 'QR code timestamp is outside acceptable range (clock drift or expired)' };
}
```

**Status:** ACTIVE

---

### G-KS-E3 — Audit Log Write Failures Are Silent for Critical Actions

**File:** `src/services/auditService.ts` — lines 60-67
**Severity:** MEDIUM
**Category:** Error Handling / Silent Failure

**Code:**
```typescript
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try { await AuditLog.create(doc); }
  catch (err) {
    logger.error('[Audit] Failed to write audit log', { entry, err });
    // Silent — admin action proceeds even if audit fails
  }
}
```

**Root Cause:** For critical actions (BATCH_EXECUTE, KILL_SWITCH), audit failures should not be silently swallowed.

**Fix:** For critical actions, throw after audit failure:
```typescript
if (entry.action === 'BATCH_EXECUTE' || entry.action === 'KILL_SWITCH') {
  try { await AuditLog.create(doc); }
  catch (err) {
    logger.error('[Audit] CRITICAL: Failed to write audit log for %s', entry.action);
    throw err;
  }
}
```

**Status:** ACTIVE

---

### G-KS-E4 — `creditUserWallet` Throws No Error on Failure (See G-KS-C9)

**File:** `src/services/walletIntegration.ts`
**Severity:** MEDIUM
**Category:** Error Handling / Silent Failure
**Added:** 2026-04-16

**Root Cause:** Related to G-KS-C9. Even when `creditUserWallet` calls the wrong endpoint and gets an error, the error is not surfaced to the caller. `updateEarnRecordStatus` calls `creditUserWallet` and catches any error silently, so failed coin conversions are completely invisible.

**Fix:** See G-KS-C9 fix. Also add error propagation in `updateEarnRecordStatus`.

**Status:** ACTIVE

---

## LOW

---

### G-KS-E5 — Dead Code: timestamp ?? new Date() Unreachable

**File:** `src/services/auditService.ts` — lines 55-56
**Severity:** LOW
**Category:** Error Handling / Code Quality

**Code:**
```typescript
timestamp: entry.timestamp ?? new Date(), // unreachable
```

**Fix:** Remove the dead fallback.

**Status:** ACTIVE

---

## Status Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| G-KS-E1 | MEDIUM | Silent return 0 on wallet balance failure | ACTIVE |
| G-KS-E2 | MEDIUM | QR replay window doesn't handle clock drift | ACTIVE |
| G-KS-E3 | MEDIUM | Audit log write failures are silent for critical actions | ACTIVE |
| G-KS-E4 | MEDIUM | creditUserWallet throws no error on failure | ACTIVE |
| G-KS-E5 | LOW | Dead code: timestamp ?? new Date() unreachable | ACTIVE |
