# XF-1 — Fire-and-Forget Coin Credits (Cross-Repo)

**Date:** 2026-04-16
**Family:** XF-1
**Severity:** CRITICAL
**Spans:** AdBazaar → REZ backend + Gen 1-7 REZ ecosystem

---

## Summary

Fire-and-forget async calls plague both AdBazaar and the existing REZ ecosystem. This pattern appears in 3 forms:

1. **REZ coin credit calls** (AdBazaar → REZ backend): No retry, no DLQ, silent failure
2. **Notification inserts** (AdBazaar): DB insert failures silently swallowed
3. **Email sends** (AdBazaar): HTTP failure logged but not propagated

This cross-repo issue family connects directly to Gen 1-7 bug `RC-3` (fire-and-forget for financial operations).

---

## AdBazaar: REZ Coin Credit Fire-and-Forget

**File:** `src/app/api/qr/scan/[slug]/route.ts:106-131`

```typescript
try {
  const rezRes = await fetch(`${REZ_API_BASE_URL}/api/adbazaar/scan`, ...)
  if (rezRes.ok) { ... }
} catch { /* fire and forget */ }
```

**Impact:**
- `scan_events.rez_coins_credited: false` recorded when API fails — but no retry
- No dead-letter queue
- No reconciliation job
- User never receives coins; no notification

**Related issues:**
- [AB-D1](../06-ADBAZAAR/DATA-SYNC.md#AB-D1) — No real-time sync, notifications fire-and-forget
- [AB-D4](../06-ADBAZAAR/DATA-SYNC.md#AB-D4) — REZ coin credit has no retry queue
- [AB-B1](../06-ADBAZAAR/BUSINESS-LOGIC.md#AB-B1) — Visit bonus coins never credited (same call path)
- [AB-H3](../06-ADBAZAAR/SECURITY.md#AB-H3) — Fire-and-forget promises swallow all errors

---

## Gen 1-7: Coin Credit Fire-and-Forget

From `docs/Bugs/06-FINANCIAL-INTEGRITY.md`:

```typescript
// coin credit call — failure silently swallowed
promise.then(() => {}).catch(() => {})
```

The REZ backend's `coin credit` operations were wrapped in fire-and-forget promises with no retry mechanism.

---

## Fix Architecture

### Layer 1: AdBazaar — REZ Coin Credit Retry Queue

```
┌─────────────────────────────────────────────────────────┐
│  QR Scan API                                            │
│  1. Insert scan_event with rez_coins_credited: false    │
│  2. Async: call REZ /api/adbazaar/scan                 │
│     - If SUCCESS: update scan_event.rez_coins_credited  │
│     - If FAIL: insert into failed_coin_credits table    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase: failed_coin_credits table                   │
│  Fields: scan_event_id, user_id, coins, attempts,       │
│          last_attempt, next_retry, status               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Cron: retry-failed-coin-credits (every 15 min)         │
│  1. SELECT * FROM failed_coin_credits                  │
│     WHERE next_retry <= NOW() AND status = 'pending'    │
│     LIMIT 100                                           │
│  2. For each: call REZ API                            │
│  3. On success: DELETE from failed_coin_credits        │
│  4. On failure: increment attempts, set next_retry       │
│  5. After 5 failures: status = 'manual_review'         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Alert: if manual_review count > threshold → Slack      │
└─────────────────────────────────────────────────────────┘
```

### Layer 2: Replace Fire-and-Forget Notifications

```typescript
// BEFORE (fire and forget):
Promise.resolve(supabase.from('notifications').insert({...})).then(() => {}).catch(() => {})

// AFTER (proper async with logging):
try {
  const { error } = await supabase.from('notifications').insert({...})
  if (error) {
    console.error('[notification] insert failed:', error)
    // Consider: dead-letter queue or retry
  }
} catch (err) {
  console.error('[notification] unexpected error:', err)
}
```

### Layer 3: BullMQ Integration (Long-term)

For the REZ ecosystem, integrate BullMQ for all financial operations:
- All coin credit/deduction calls become BullMQ jobs
- Failed jobs auto-retry with exponential backoff
- Dead-letter queue for jobs exceeding max retries
- Dashboard for monitoring job status

---

## Effort Estimate

| Task | Effort | Priority |
|------|--------|----------|
| Create `failed_coin_credits` Supabase table | 30 min | CRITICAL |
| Add proper try/catch with logging in QR scan API | 15 min | CRITICAL |
| Create Supabase cron for retry job | 1 hour | CRITICAL |
| Replace all fire-and-forget notification inserts | 2 hours | HIGH |
| Add Slack alert for manual_review threshold | 30 min | MEDIUM |
| REZ backend: wrap coin credits in BullMQ jobs | 4 hours | HIGH (REZ backend) |

**Total: ~8 hours**

---

## FIXED (2026-04-17)

Implemented in `imrejaul007/AdBazaar` PR #6 (`fix/dlq-xf1-fire-and-forget-coin-credits`):

| Task | Status | File |
|------|--------|------|
| Create `failed_coin_credits` Supabase table | **FIXED** | `supabase/migrations/010_add_failed_coin_credits.sql` |
| Add DLQ insert on REZ API failure in POST handler | **FIXED** | `src/app/api/qr/scan/[slug]/route.ts` |
| Create cron retry route with exponential backoff | **FIXED** | `src/app/api/cron/retry-coin-credits/route.ts` |
| Add vercel.json cron config (every 15 min) | **FIXED** | `vercel.json` |

The cron route runs every 15 minutes, queries rows where `status IN ('pending', 'retrying')` and `next_retry <= NOW()`, retries the REZ API, and on success marks `status = resolved` and updates `scan_events.rez_coins_credited = true`. Exponential backoff: 2^attempts * 60s (1m, 2m, 4m, 8m, 16m). After 5 failed attempts, moves to `manual_review`.
