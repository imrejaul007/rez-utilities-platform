# CROSS-SERVICE: Fire-and-Forget — Async Calls with No Retry

**Date:** 2026-04-16
**Updated:** 2026-04-16 (Gen 10 merchant audit added)
**Severity:** CRITICAL across all codebases

---

## All Instances

### ReZ Backend (Gen 1–7)

| ID | File | Operation | Impact |
|----|------|-----------|--------|
| C9 | wallet-service | Coin credit after payment | No retry, no DLQ, no flag set |
| BL-C5 | monolith | Wallet credit not in MongoDB transaction | Redis lock loss = double-credit |
| CS-C5 | payment-service | Coin credit `.catch(() => {})` | Coins permanently lost |
| CS-C3 | gamification | coinledgers dedup key consumed before wallet credit | Permanent coin loss |

### Rendez Backend (Gen 9)

| ID | File | Operation | Impact |
|----|------|-----------|--------|
| RZ-B-H3 | MeetupService.ts | Reward trigger fire-and-forget | User sees "coins incoming" but never arrives |
| RZ-B-H4 | MeetupService.ts | Redis lock expires mid-process | Duplicate reward possible |

### Karma Service (Gen 8)

| ID | File | Operation | Impact |
|----|------|-----------|--------|
| G-KS-E1 | All catch blocks | Empty catch blocks | Errors silently swallowed |

### Merchant App Gen 10 (rezmerchant/)

| ID | File | Operation | Impact |
|----|------|-----------|--------|
| G-MA-C07 | contexts/SocketContext.tsx:110 | Queued socket events lost on crash | In-flight orders vanish when app crashes before sync |
| G-MA-C09 | services/offlinePOSQueue.ts:260 | Failed bills silently removed from queue | Revenue lost with zero trace after 5 failed attempts |
| G-MA-C11 | contexts/SocketContext.tsx:112 | SocketContext.emit calls non-existent getSocket() | Real-time order notifications always dead |
| G-MA-H11 | services/offline.ts:255 | Offline sync timeout ignored | Failed syncs silently continue without retry flag |
| G-MA-H17 | services/offline.ts:42 | Dead letter queue unbounded | Memory grows indefinitely on repeated failures |
| G-MA-H19 | services/api/socket.ts:134 | joinMerchantDashboard silent errors | Merchant never joins their own dashboard room |

---

## The Pattern

```typescript
// WRONG — fire and forget
someAsyncOperation().catch((err) => console.error(err));

// WRONG — missing error handling entirely
someAsyncOperation();
```

## The Fix

```typescript
// Option 1: BullMQ job with retries
await queue.add('job-name', payload, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: true,
  removeOnFail: false, // keep in DLQ for manual review
});

// Option 2: Async with explicit error handling
try {
  await someAsyncOperation();
} catch (err) {
  // Log, retry, or store for later
  await errorQueue.add('failed-job', { err, payload });
}
```

---

## Prevention Checklist

- [ ] Every async money operation must use BullMQ with retries
- [ ] Every async notification must use BullMQ with retries
- [ ] Every async external API call must use BullMQ with retries
- [ ] Empty `catch(() => {})` is banned — ESLint rule `no-empty-catch`
- [ ] DLQ monitoring: alert on any message in DLQ after 1 hour
