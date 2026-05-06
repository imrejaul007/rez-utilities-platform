# XF-3 — Dual Attribution Tracking Systems

**Date:** 2026-04-16
**Family:** XF-3
**Severity:** HIGH
**Spans:** AdBazaar (Supabase) ↔ REZ backend (MongoDB)

---

## Summary

Both AdBazaar (Supabase) and REZ backend (MongoDB) independently track QR scan attribution. This creates a data synchronization problem: the same user action generates records in two separate databases with no guaranteed consistency.

---

## AdBazaar Attribution System (Supabase)

**Tables:**
- `scan_events` — every QR scan with user, QR, IP, timestamp, coin credit status
- `attribution` — links scan events to visits and purchases via `scan_event_id`
- `qr_codes` — QR metadata including `booking_id` fallback

**Flow:**
1. User scans QR → `scan_events` record created (AdBazaar Supabase)
2. AdBazaar webhook `rez-visit` → `attribution` record (AdBazaar Supabase)
3. AdBazaar webhook `rez-purchase` → `attribution` record updated (AdBazaar Supabase)
4. `booking_id` column in `attribution` populated via `qr_codes.booking_id` fallback

**Known gaps (from [AB-D2](../06-ADBAZAAR/DATA-SYNC.md#AB-D2)):**
- `attribution.booking_id` never directly populated by webhooks
- Attribution linked to bookings via QR code fallback only
- Standalone campaign QR codes (no `booking_id`) are unlinkable

---

## REZ Backend Attribution System (MongoDB)

**Collections:**
- `attributions` — REZ's own attribution records from the REZ app ecosystem
- `scans` — scan events tracked by the REZ backend
- `visits` — visit tracking
- `purchases` — purchase events

**REZ Integration with AdBazaar:**
- REZ backend exposes `/api/adbazaar/scan` — receives scan credit from AdBazaar
- REZ backend has its own `attribution` mapping for its coin/wallet system
- AdBazaar sends `rez_merchant_id` to link the scan to a REZ merchant

---

## The Cross-Repo Gap

| Aspect | AdBazaar (Supabase) | REZ Backend (MongoDB) |
|--------|---------------------|----------------------|
| **User ID** | `rez_user_id` (UUID) | `userId` (ObjectId) |
| **QR Identifier** | `qr.slug` (string) | `campaignId` / `qrCode` |
| **Scan Record** | `scan_events` table | `scans` collection |
| **Attribution Record** | `attribution` table | `attributions` collection |
| **Link Field** | `scan_event_id` (UUID) | `scanId` (ObjectId) |
| **Booking Link** | `booking_id` on `qr_codes` fallback | No booking link |

**Key problem:** A single QR scan creates records in BOTH systems with different IDs. There's no cross-reference between the Supabase `scan_event.id` and the MongoDB `scan._id`.

---

## Fix Architecture

### Short-term: Link AdBazaar scan to REZ user via merchant mapping

```typescript
// AdBazaar: qr/scan/[slug]/route.ts
// When calling REZ API, include the Supabase scan_event.id
const scanEventId = scanEvent.id // Supabase UUID
await fetch(`${REZ_API_BASE_URL}/api/adbazaar/scan`, {
  body: JSON.stringify({
    supabaseScanEventId: scanEventId,
    supabaseUserId: userId,
    merchantId: qr.rez_merchant_id,
    coinsAmount: qr.coins_per_scan,
  })
})

// REZ backend: /api/adbazaar/scan
// Store the Supabase scan ID for cross-reference
await db.collection('scans').insertOne({
  supabaseScanEventId: req.body.supabaseScanEventId,
  supabaseUserId: req.body.supabaseUserId,
  merchantId: req.body.merchantId,
  coinsAmount: req.body.coinsAmount,
  createdAt: new Date(),
})
```

### Medium-term: Unified attribution event bus

```
AdBazaar QR Scan Event
        │
        ▼
┌──────────────────────┐
│  Supabase DB         │  ──► scan_events (AdBazaar)
│  (source of truth)   │
└──────────────────────┘
        │
        ▼ (Supabase Realtime / webhook)
┌──────────────────────┐
│  REZ Backend         │  ──► scans collection (REZ)
│  (consumer)          │
└──────────────────────┘
```

Replace the dual-webhook pattern with a single source of truth (Supabase) + event streaming to REZ.

### Long-term: Single attribution model

Consolidate on ONE attribution system. Options:
1. REZ backend becomes the attribution source of truth; AdBazaar reads from it
2. AdBazaar Supabase becomes the attribution source of truth; REZ backend reads from it via Supabase connection

---

## Related Issues

- [AB-D2](../06-ADBAZAAR/DATA-SYNC.md#AB-D2) — Attribution records never populate `booking_id`
- [AB-B1](../06-ADBAZAAR/BUSINESS-LOGIC.md#AB-B1) — Visit bonus coins promised but never credited
- Gen 1-7: `CROSS-SERVICE-SYNC.md` — sync issues across REZ services

---

## Effort Estimate

| Task | Effort | Priority |
|------|--------|----------|
| Add `supabaseScanEventId` to REZ scan records | 1 hour | HIGH |
| Backfill existing records with scan ID cross-reference | 2 hours | MEDIUM |
| Add `booking_id` population on booking creation | 1 hour | HIGH |
| Replace dual webhook with event streaming | 8 hours | MEDIUM |
| Single attribution model consolidation | 16 hours | LOW (future) |

**Total: ~28 hours**
