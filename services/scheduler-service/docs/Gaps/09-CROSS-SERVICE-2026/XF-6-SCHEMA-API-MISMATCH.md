# XF-6 — Schema vs API Column Name Mismatches

**Date:** 2026-04-16
**Family:** XF-6
**Severity:** CRITICAL
**Spans:** AdBazaar (Supabase schema ↔ API routes)

---

## Summary

API routes insert data using column names that don't match the Supabase schema. Every insert/update fails silently or corrupts data. This is a **runtime crash pattern** — TypeScript types compile fine, but Supabase rejects the queries at runtime.

---

## Known Mismatches

### AB-P1 — `messages.body` vs `messages.content`

**Status:** CRITICAL — completely breaks messaging
**File:** `src/app/api/bookings/[id]/messages/route.ts:90-98`

| | Value |
|-|-------|
| **Schema column** | `body TEXT NOT NULL` |
| **API inserts** | `content: content.trim()` |
| **Result** | Every message insert fails — Supabase rejects unknown column |

**Fix (one line):**
```typescript
// Change 'content:' to 'body:'
const { data: message, error } = await supabase.from('messages').insert({
  body: content.trim(), // FIXED
})
```

---

## Audit: All Supabase Inserts vs Schema

### Pattern to Audit

For every `supabase.from('X').insert({...})` call, verify each field name matches the schema at `supabase/migrations/*.sql`.

### Known Inserts (Quick Audit)

| Table | Route | Fields | Status |
|-------|-------|--------|--------|
| `messages` | `bookings/[id]/messages/route.ts` | `content` → should be `body` | **BROKEN** |
| `scan_events` | `qr/scan/[slug]/route.ts` | All fields | Appear correct |
| `bookings` | `bookings/route.ts` | All fields | Appear correct |
| `notifications` | Multiple routes | All fields | Appear correct |
| `attribution` | `webhooks/rez-visit/route.ts` | `booking_id` missing | **Gap AB-D2** |
| `refunds` | `webhooks/razorpay/route.ts` | All fields | Appear correct |

### Pattern: Unvalidated Field Inserts

Many routes insert with client-supplied field names that bypass schema validation:

```typescript
// Broadcast marketing trigger — unvalidated inputs:
await triggerMarketingBroadcast({
  title: broadcastTitle,  // No length/content validation
  body: broadcastBody,    // No max length check
})

// Booking creation — all fields from client:
supabase.from('bookings').insert({
  ...clientData,  // No schema validation
})
```

---

## Fix: Zod Schema Validation at API Boundary

```typescript
import { z } from 'zod'

const messageInsertSchema = z.object({
  body: z.string().min(1).max(5000),
  booking_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  sender_role: z.enum(['buyer', 'vendor', 'admin']),
})

// In API route:
const parsed = messageInsertSchema.safeParse({ body: content.trim(), ... })
if (!parsed.success) {
  return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 })
}
await supabase.from('messages').insert(parsed.data)
```

This ensures:
1. TypeScript types are enforced at compile time
2. Runtime validation catches schema mismatches
3. API returns clear 400 errors instead of silent Supabase failures

---

## Effort Estimate

| Task | Effort | Priority |
|------|--------|----------|
| Fix `messages` column name (AB-P1) | 5 min | CRITICAL |
| Audit all Supabase inserts against schema | 2 hours | CRITICAL |
| Add Zod validation schemas for all API boundaries | 4 hours | HIGH |
| Add integration test suite verifying schema inserts | 4 hours | HIGH |

**Total: ~10 hours**
