# Cross-Repo Unified Fixes

**Date:** 2026-04-16
**Scope:** Issues that span multiple repos or require coordinated deployment
**Total:** 6 cross-repo families
**Estimated Effort:** ~35 hours

---

## XF-1: Fire-and-Forget Coin Credits

**Problem:** REZ coin credit calls fail silently across AdBazaar and Gen 1–7 ecosystem.

**Unified Fix:** Dead-letter queue pattern across all services.

### Step 1: AdBazaar — Create `failed_coin_credits` table

```sql
CREATE TABLE failed_coin_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_event_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  coins_amount INTEGER NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  next_retry TIMESTAMPTZ,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'retrying', 'manual_review', 'resolved')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Step 2: AdBazaar — Add retry cron

```typescript
// src/app/api/cron/retry-coin-credits/route.ts
// Vercel Cron: every 15 minutes

export async function GET() {
  const { data: failures } = await supabase
    .from('failed_coin_credits')
    .select('*')
    .eq('status', 'pending')
    .lt('next_retry', new Date().toISOString())
    .limit(100)

  for (const failure of failures ?? []) {
    try {
      const res = await fetch(`${REZ_API_BASE_URL}/api/adbazaar/scan`, {
        method: 'POST',
        body: JSON.stringify({
          supabaseScanEventId: failure.scan_event_id,
          supabaseUserId: failure.user_id,
          merchantId: failure.merchant_id,
          coinsAmount: failure.coins_amount,
        })
      })
      if (res.ok) {
        await supabase.from('failed_coin_credits')
          .update({ status: 'resolved' })
          .eq('id', failure.id)
        await supabase.from('scan_events')
          .update({ rez_coins_credited: true })
          .eq('id', failure.scan_event_id)
      } else {
        throw new Error(`REZ API returned ${res.status}`)
      }
    } catch (err) {
      const attempts = failure.attempts + 1
      const nextRetry = new Date(Date.now() + Math.pow(2, attempts) * 60000)
      await supabase.from('failed_coin_credits')
        .update({
          attempts,
          last_attempt: new Date().toISOString(),
          next_retry: nextRetry.toISOString(),
          status: attempts >= 5 ? 'manual_review' : 'pending',
          error_message: String(err),
        })
        .eq('id', failure.id)
    }
  }
  return NextResponse.json({ processed: failures?.length ?? 0 })
}
```

### Step 3: REZ Backend — Wrap all coin operations in BullMQ

See [XF-1-FIRE-AND-FORGET.md](../09-CROSS-SERVICE-2026/XF-1-FIRE-AND-FORGET.md)

---

## XF-2: `rez_user_id` Spoofing

**Problem:** Attacker can credit coins to any REZ user via URL parameter.

**Unified Fix:** Server-side user resolution + HMAC signing.

### AdBazaar Changes

```typescript
// src/app/api/qr/scan/[slug]/route.ts

// 1. Extract user from session (not URL param)
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
}

// 2. Sign the request with HMAC
import { createHmac } from 'crypto'
const payload = JSON.stringify({
  supabaseUserId: user.id,
  merchantId: qr.rez_merchant_id,
  coinsAmount: qr.coins_per_scan,
  timestamp: Date.now(),
})
const signature = createHmac('sha256', process.env.REZ_WEBHOOK_SECRET!)
  .update(payload).digest('hex')

// 3. Call REZ API with signed payload
const rezRes = await fetch(`${REZ_API_BASE_URL}/api/adbazaar/scan`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Signature': signature,
  },
  body: payload,
})
```

### REZ Backend Changes

```typescript
// REZ backend: /api/adbazaar/scan

import { createHmac, timingSafeEqual } from 'crypto'

function verifySignature(body: string, signature: string): boolean {
  const expected = createHmac('sha256', process.env.REZ_WEBHOOK_SECRET!)
    .update(body).digest('hex')
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export default async function handler(req, res) {
  const signature = req.headers['x-signature']
  const rawBody = req.rawBody // need rawBody enabled

  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const { supabaseUserId, merchantId, coinsAmount, timestamp } = JSON.parse(rawBody)

  // Validate timestamp (reject > 5 min old)
  if (Date.now() - timestamp > 5 * 60 * 1000) {
    return res.status(400).json({ error: 'Request expired' })
  }

  // Resolve REZ user from Supabase user
  const rezUserId = await resolveRezUserId(supabaseUserId)
  if (!rezUserId) {
    return res.status(400).json({ error: 'User not found' })
  }

  // Credit coins
  await creditCoins(rezUserId, merchantId, coinsAmount)
  return res.json({ success: true })
}
```

---

## XF-3: Dual Attribution Systems

**Problem:** AdBazaar (Supabase) and REZ (MongoDB) each track attribution independently.

**Unified Fix:** Cross-reference IDs, populate `booking_id` on attribution.

See [XF-3-ATTRIBUTION-DUAL.md](../09-CROSS-SERVICE-2026/XF-3-ATTRIBUTION-DUAL.md) for full details.

---

## XF-4: Wallet vs Earnings Derivation

**Problem:** REZ has full wallet system; AdBazaar derives earnings from bookings.

**Unified Fix:** Add `vendor_ledger` table + atomic operations.

See [XF-4-WALLET-EARNINGS-MISMATCH.md](../09-CROSS-SERVICE-2026/XF-4-WALLET-EARNINGS-MISMATCH.md) for full details.

---

## XF-5: Notification Architecture Gap

**Problem:** AdBazaar has no job queue; REZ uses BullMQ.

**Unified Fix:** DLQ pattern for notifications + cron retry.

See [XF-5-NOTIFICATION-GAP.md](../09-CROSS-SERVICE-2026/XF-5-NOTIFICATION-GAP.md) for full details.

---

## XF-6: Schema vs API Column Mismatches

**Problem:** API routes insert columns that don't match Supabase schema.

**Unified Fix:** Audit all inserts + Zod validation.

See [XF-6-SCHEMA-API-MISMATCH.md](../09-CROSS-SERVICE-2026/XF-6-SCHEMA-API-MISMATCH.md) for full details.

---

## Coordinated Deployment Requirements

| Fix | Requires REZ Backend Change | Requires AdBazaar Change | Deployment Order | Status |
|-----|---------------------------|-------------------------|-----------------|--------|
| ~~XF-1: Coin credit DLQ~~ | No | Yes | AdBazaar first | **FIXED** (PR #6) |
| XF-2: HMAC signing | Yes | Yes | Both simultaneously |
| XF-3: Attribution linking | No | Yes | AdBazaar first |
| XF-4: Vendor ledger | No | Yes | AdBazaar first |
| XF-5: Notification DLQ | No | Yes | AdBazaar first |
| XF-6: Schema audit | No | Yes | AdBazaar first |

**XF-2 is the only fix requiring coordinated deployment** — both AdBazaar and REZ backend must be updated simultaneously. All other cross-repo fixes can be deployed to AdBazaar independently.

---

## Effort Summary

| Fix | Hours | Priority |
|-----|-------|----------|
| ~~XF-1: Coin credit DLQ~~ | 3 | ~~CRITICAL~~ **FIXED** |
| XF-2: HMAC signing | 4 | CRITICAL |
| XF-3: Attribution linking | 2 | HIGH |
| XF-4: Vendor ledger | 5 | HIGH |
| XF-5: Notification DLQ | 3 | HIGH |
| XF-6: Schema audit + Zod | 4 | CRITICAL |
| **TOTAL** | **21 hours** | |
