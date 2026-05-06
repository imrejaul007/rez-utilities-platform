# XF-5 — Notification Architecture Gap

**Date:** 2026-04-16
**Family:** XF-5
**Severity:** MEDIUM
**Spans:** AdBazaar (no queue) ↔ REZ ecosystem (BullMQ)

---

## Summary

REZ ecosystem uses BullMQ + Redis for all async job processing. AdBazaar has no job queue — all async operations are fire-and-forget with no retry mechanism.

---

## REZ Ecosystem: BullMQ Pattern

REZ backend services use BullMQ for:
- Email sending
- Push notifications
- Coin credit/deduction jobs
- Webhook processing
- Scheduled reconciliation jobs

**Pattern:**
```typescript
// Add job to queue
await emailQueue.add('send-verification', { userId, email, token }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: false, // Keep for debugging
})

// Worker processes job
emailWorker.process(async (job) => {
  await sendEmail(job.data.email, job.data.token)
})
```

**Advantages:**
- Failed jobs auto-retry with exponential backoff
- Dead-letter queue for jobs exceeding max attempts
- Dashboard for monitoring queue health
- Jobs survive service restarts

---

## AdBazaar: Fire-and-Forget Notifications

**Standard pattern across all API routes:**
```typescript
// No queue, no retry, failure silently swallowed
Promise.resolve(supabase.from('notifications').insert({...})).then(() => {}).catch(() => {})
```

**Email:**
```typescript
// email.ts
if (!res.ok) {
  console.error('[email] send failed:', err)
}
// Email failure doesn't propagate — booking succeeds silently
```

---

## Fix Architecture

### Short-term: Add Error Logging + Manual DLQ

```typescript
// Before:
Promise.resolve(supabase.from('notifications').insert({...})).then(() => {}).catch(() => {})

// After:
try {
  const { error } = await supabase.from('notifications').insert({...})
  if (error) {
    console.error('[notification] failed:', { error, data: notificationData })
    // Insert into manual DLQ
    await supabase.from('failed_notifications').insert({ ...notificationData, error: error.message })
  }
} catch (err) {
  console.error('[notification] unexpected error:', err)
  await supabase.from('failed_notifications').insert({ ...notificationData, error: String(err) })
}
```

### Medium-term: Supabase Edge Functions as Job Queue

```typescript
// AdBazaar: Trigger a Supabase Edge Function instead of direct insert
// Edge Functions have 60s timeout and can handle retries

// Cron job (runs every 5 min via Vercel Cron):
// 1. SELECT * FROM failed_notifications WHERE attempts < 3
// 2. Retry each notification
// 3. Increment attempts
// 4. If attempts >= 3: flag for manual review
```

### Long-term: Integrate BullMQ into AdBazaar

Since AdBazaar is a Next.js app (not a Node.js service), the best approach is:
1. Use Next.js API routes as BullMQ job producers
2. Connect to shared REZ Redis instance for the queue backend
3. Run BullMQ workers as a separate Node.js service

```typescript
// AdBazaar API route (producer):
import { adBazaarQueue } from '@/lib/bullmq'

export async function POST(req: Request) {
  // ... create booking ...
  await adBazaarQueue.add('booking-confirmed', {
    bookingId: booking.id,
    userId: user.id,
    type: 'email',
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
  return NextResponse.json({ booking })
}
```

---

## Effort Estimate

| Task | Effort | Priority |
|------|--------|----------|
| Replace all fire-and-forget with try/catch + DLQ insert | 3 hours | HIGH |
| Create `failed_notifications` Supabase table | 30 min | HIGH |
| Add cron job for notification retry | 1 hour | HIGH |
| Replace email fire-and-forget with error propagation | 1 hour | HIGH |
| Integrate BullMQ (long-term) | 8 hours | MEDIUM |

**Total: ~6 hours**
