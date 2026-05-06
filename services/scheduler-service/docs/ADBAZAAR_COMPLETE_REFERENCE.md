# AdBazaar — Complete Reference Document

Last updated: 2026-04-08
Repo: `imrejaul007/adBazaar` (branch: `main`)
Live: https://ad-bazaar.vercel.app
Stack: Next.js 16 App Router · Supabase (Postgres + Auth + Storage) · Razorpay · Resend · REZ backend integration

---

## 1. What AdBazaar Is

India's first closed-loop offline advertising marketplace. Brands discover physical ad spaces (billboards, transit, local businesses, print, influencer), book end-to-end online, and get real attribution on who saw the ad, scanned the QR code, walked into the store, and bought.

**The REZ loop:** Every booked ad gets a unique QR code. REZ consumers scan it → earn coins → visit the merchant store → attribution is recorded. Vendors see the full funnel.

---

## 2. Architecture

### Tech Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Auth | Supabase Auth (email/password) | Web-native, RLS works automatically, SMS OTP not needed |
| DB | Supabase Postgres | Single DB for users + listings + bookings + attribution |
| Storage | Supabase Storage (`listing-images` bucket, public) | Simple image upload |
| Email | Resend | AdBazaar-specific; SendGrid is REZ backend only |
| Payments | Razorpay | Indian payment gateway, live keys required |
| REZ bridge | `rez_merchant_id` + webhooks | Two auth systems stay independent, talk via webhooks |
| QR | `qrcode` npm package, stored as PNG in Supabase storage | Per-booking, per-poster unique codes |

### User Roles

| Role | Path prefix | What they do |
|------|------------|-------------|
| Vendor | `/vendor/*` | Create listings, manage bookings, upload proof, view analytics |
| Buyer | `/buyer/*` | Browse, inquire, book, manage campaigns, view bookings |
| Admin | `/admin/*` | Approve/reject listings, resolve disputes, platform stats |

### Route Groups

```
src/app/
  (auth)/          → /login, /register, /forgot-password, /reset-password
  (marketplace)/   → /browse, /listing/[id], /vendor/[id]  (public)
  (vendor)/        → /vendor/* (authenticated, role=vendor)
  (buyer)/         → /buyer/* (authenticated, role=buyer)
  (admin)/         → /admin/* (authenticated, role=admin)
  api/             → all API routes
  scan/[slug]/     → QR scan landing page (public)
```

---

## 3. Database Schema

### Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | Supabase auth UID |
| email | TEXT UNIQUE | |
| role | TEXT | `vendor` / `buyer` / `admin` |
| rez_merchant_id | TEXT | Set via `/vendor/rez-connect` |
| bank_account_name | TEXT | Payout — migration 004 |
| bank_account_number | TEXT | Payout — migration 004 |
| bank_ifsc | TEXT | Payout — migration 004 |
| upi_id | TEXT | Payout — migration 004 |

#### `listings`
| Column | Type | Notes |
|--------|------|-------|
| status | TEXT | `draft` / `active` / `paused` / `rejected` |
| rejection_reason | TEXT | Added in migration 003 |
| view_count | INTEGER | Incremented on each listing view |
| qr_enabled | BOOLEAN | Whether listing supports QR attribution |

#### `qr_codes`
| Column | Type | Notes |
|--------|------|-------|
| booking_id | UUID | FK → bookings |
| qr_slug | TEXT UNIQUE | URL slug for scan |
| qr_label | TEXT | Label per poster/creative (migration 006) |
| poster_index | INTEGER | 1-based ordering (migration 006) |
| creative_image_url | TEXT | Optional thumbnail (migration 006) |
| total_scans | INTEGER | All-time counter |
| unique_scanners | INTEGER | Unique IPs counter |
| rez_merchant_id | TEXT | Merchant to credit coins to |
| coins_per_scan | INTEGER | Default 20 |

#### `scan_events`
| Column | Type | Notes |
|--------|------|-------|
| qr_id | UUID | FK → qr_codes |
| user_id | TEXT | REZ user ID (if known) |
| ip_address | TEXT | For anti-gaming (24h cooldown) |
| device_type | TEXT | `mobile`/`desktop`/`tablet` — migration 006 |
| city_derived | TEXT | From IP geolocation — migration 006 |
| rez_coins_credited | BOOLEAN | |
| coins_amount | INTEGER | |

#### `attribution`
| Column | Type | Notes |
|--------|------|-------|
| scan_event_id | UUID | |
| qr_id | UUID | |
| rez_visit_id | TEXT | From REZ webhook |
| rez_purchase_id | TEXT | From REZ webhook |
| revenue_amount | DECIMAL | From REZ webhook |
| visit_timestamp | TIMESTAMPTZ | |
| purchase_timestamp | TIMESTAMPTZ | |

#### `notifications`
Created in migration 005. Fields: `user_id`, `type`, `title`, `body`, `link`, `read_at`.

### Migrations (run in order)
```
001_initial_schema.sql        — core tables
002_inquiries_messages.sql    — inquiries + messages
003_missing_columns.sql       — rejection_reason on listings
004_payout_fields.sql         — bank/UPI fields on users
005_notifications.sql         — notifications table
006_qr_analytics.sql          — qr_label, poster_index, device_type, city_derived
```

---

## 4. API Routes

### Public
| Route | Method | Description |
|-------|--------|-------------|
| `/api/listings` | GET | Browse with filters (city, category, q, price) |
| `/api/listings/[id]` | GET | Single listing |
| `/api/listings/[id]/view` | POST | Increment view_count |
| `/api/qr/scan/[slug]` | GET | Record scan, credit coins, redirect to `/scan/[slug]` |
| `/api/reviews` | GET | Public listing reviews |

### Vendor (Bearer token required)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/vendor/listings` | GET, POST | List/create vendor listings |
| `/api/vendor/listings/[id]` | PUT, DELETE | Edit/delete listing |
| `/api/vendor/connect-rez` | POST | Save `rez_merchant_id` |
| `/api/vendor/attribution` | GET | Full attribution report per booking |
| `/api/vendor/analytics` | GET | QR analytics (scans, funnel, cities, devices) |
| `/api/vendor/earnings` | GET | Earnings summary |
| `/api/bookings/[id]/qr` | GET, POST | List/add QR codes per booking |
| `/api/bookings/[id]/proof` | POST | Upload proof of execution |
| `/api/bookings/[id]/proof/approve` | POST | Buyer approves proof |
| `/api/bookings/[id]/messages` | GET, POST | Booking thread messages |
| `/api/inquiries/[id]/quote` | POST | Vendor sends quote |

### Buyer (Bearer token required)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/bookings` | GET, POST | Create booking + Razorpay order |
| `/api/bookings/[id]/verify-payment` | POST | Verify Razorpay payment signature |
| `/api/inquiries` | GET, POST | Create/list inquiries |
| `/api/inquiries/[id]/accept` | POST | Buyer accepts quote → booking created |
| `/api/inquiries/[id]/decline` | POST | Decline inquiry |
| `/api/campaigns` | GET, POST | Campaign management |
| `/api/profile` | GET, PATCH | User profile + payout settings |

### Admin (Bearer token, role=admin)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/listings/[id]/review` | POST | Approve or reject listing |
| `/api/admin/disputes/[id]/resolve` | POST | Resolve disputed booking |

### Webhooks (x-webhook-secret header)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/webhooks/rez-visit` | POST | REZ fires when user visits merchant store |
| `/api/webhooks/rez-purchase` | POST | REZ fires when user makes purchase |

### Internal (x-internal-key header)
| Route | Method | Description |
|-------|--------|-------------|
| `/api/merchant/summary` | GET | REZ backend pulls merchant stats |

### Cron
| Route | Schedule | Description |
|-------|---------|-------------|
| `/api/cron/freshness` | Daily | Decays listing freshness scores |

---

## 5. Key Flows

### QR Scan Attribution Loop
```
User scans QR (physical ad)
  → GET /api/qr/scan/[slug]
  → Check 24h cooldown by IP
  → Insert scan_event (device_type, city from IP, referrer)
  → If REZ user: POST REZ /api/adbazaar/scan → coins credited
  → Increment qr_codes.total_scans (+ unique_scanners if new IP)
  → Redirect to /scan/[slug]?coins=N

Later: REZ fires webhook
  → POST /api/webhooks/rez-visit  → attribution.visit_timestamp
  → POST /api/webhooks/rez-purchase → attribution.revenue_amount
```

### Booking Flow (Buyer)
```
/browse → /listing/[id] → Add to cart (/buyer/cart)
  → POST /api/bookings → Razorpay order created
  → Razorpay payment UI
  → POST /api/bookings/[id]/verify-payment
  → Booking status: inquiry → paid
  → QR code auto-generated (poster_index=1, label=listing title)
```

### Inquiry Flow (Buyer → Vendor quote)
```
/buyer/inquire?listing=[id]
  → POST /api/inquiries
  → Vendor sees in /vendor/inquiries
  → POST /api/inquiries/[id]/quote (vendor sends price)
  → Buyer sees in /buyer/inquiries
  → POST /api/inquiries/[id]/accept → booking created
```

### Multi-QR Per Booking (Vendor)
```
/vendor/bookings → expand booking → QR Codes section
  → Shows all QR codes with scan count
  → "+ Add QR for new poster" → POST /api/bookings/[id]/qr
  → Each QR has label (e.g. "MG Road – Creative B"), poster_index, own QR image
  → View + Download per QR
```

### Vendor Analytics
```
/vendor/analytics
  → Platform Overview tab: total scans, funnel, device breakdown, top cities
  → Campaign Breakdown tab: per-booking → per-QR expandable
    → Each QR: timeline chart, funnel, devices, cities, all-time vs window stats
  → Filter: campaign selector + time window (7/14/30/60/90 days)
```

### Listing Review (Admin)
```
Vendor submits listing → status=draft
Admin at /admin/dashboard sees pending queue
  → POST /api/admin/listings/[id]/review { action: 'approve' | 'reject', reason? }
  → Approved: status → active (visible on marketplace)
  → Rejected: status stays draft, rejection_reason stored, vendor notified
```

---

## 6. Environment Variables

### Vercel (AdBazaar)
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

RAZORPAY_KEY_ID=rzp_live_xxx
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxx

RESEND_API_KEY=re_xxx

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

REZ_API_BASE_URL=https://api.rezapp.com/api
REZ_INTERNAL_KEY=fa62f9959a629e0ae9f2748c0ce078eb340e3f4eef808d52c52fe4c350d4a5b9

ADBAZAAR_WEBHOOK_SECRET=<openssl rand -hex 32>
ADBAZAAR_INTERNAL_KEY=<openssl rand -hex 32>

NEXT_PUBLIC_APP_URL=https://ad-bazaar.vercel.app
CRON_SECRET=<openssl rand -hex 32>
```

### REZ Backend (Render)
```env
ADBAZAAR_WEBHOOK_URL=https://ad-bazaar.vercel.app
ADBAZAAR_WEBHOOK_SECRET=<same as Vercel>
ADBAZAAR_INTERNAL_KEY=<same as Vercel>
CORS_ORIGIN=...existing...,https://ad-bazaar.vercel.app
```

---

## 7. REZ Backend — Required Endpoints

These must exist on the REZ backend for AdBazaar to function:

### A. Verify Merchant (called at vendor connect time)
```
GET /api/adbazaar/verify-merchant?merchantId=XXX
Headers: x-internal-key: <REZ_INTERNAL_KEY>
Response 200: { valid: true }
Response 404: merchant not found
```
*If this endpoint doesn't exist yet, AdBazaar fails open (accepts any ID).*

### B. Credit Coins on QR Scan
```
POST /api/adbazaar/scan
Headers: x-internal-key: <REZ_INTERNAL_KEY>
Body: {
  rezUserId: string,
  qrCodeId: string,
  merchantId: string,
  coinsAmount: number,
  scanEventId: string,
  adPlacementTitle: string
}
Response 200: { success: true }
```

### C. Fire Visit Webhook (REZ → AdBazaar)
```
POST https://ad-bazaar.vercel.app/api/webhooks/rez-visit
Headers: x-webhook-secret: <ADBAZAAR_WEBHOOK_SECRET>
Body: { rezUserId, merchantId, scanEventId, visitTimestamp }
```

### D. Fire Purchase Webhook (REZ → AdBazaar)
```
POST https://ad-bazaar.vercel.app/api/webhooks/rez-purchase
Headers: x-webhook-secret: <ADBAZAAR_WEBHOOK_SECRET>
Body: { rezUserId, merchantId, scanEventId, purchaseAmount, purchaseTimestamp }
```

---

## 8. Build Patterns (Critical — Never Break These)

| Pattern | Rule |
|---------|------|
| `export const dynamic = 'force-dynamic'` | Required on every server component page that calls Supabase |
| `createServerClient()` | Must be called inside function body, never at module level |
| `useSearchParams()` | Must be inside inner component wrapped in `<Suspense>` |
| Bearer token auth | All API routes: `Authorization: Bearer <token>` → `auth.getUser(token)` |
| Headers typing | `const h: Record<string, string> = {}; if (t) h['Authorization'] = ...` |
| Supabase joins | Returns `{ name: any }[]` (array) — always guard with `Array.isArray()` |

### Known Error → Fix Map
| Error | Fix |
|-------|-----|
| `supabaseUrl is required` at build | `createServerClient()` lazy init inside function |
| `Export supabase doesn't exist` | Use inline `createClient()` inside function (no module-level export) |
| `useSearchParams()` needs Suspense | Extract to inner component, wrap default export in `<Suspense>` |
| `params.id` not awaited | `{ params: Promise<{id:string}> }` + `const {id} = await params` |
| `AbortSignal.timeout` fails | Use `AbortController` + `setTimeout` + `clearTimeout` |

---

## 9. Components

| Component | Path | Description |
|-----------|------|-------------|
| `NotificationBell` | `src/components/NotificationBell.tsx` | Bell icon, unread badge, dropdown. Used in all 3 layouts. Silently skips if not authenticated. |
| `MessageThread` | `src/components/booking/MessageThread.tsx` | In-booking message thread for vendor↔buyer |
| `Badge` | `src/components/ui/Badge.tsx` | Status badge (success/warning/error/info/default) |
| `ReviewActions` | `src/app/(admin)/admin/dashboard/ReviewActions.tsx` | Approve/reject buttons for admin |
| `DisputeActions` | `src/app/(admin)/admin/dashboard/DisputeActions.tsx` | Resolve dispute buttons |
| `QrManager` | Inline in vendor bookings page | Multi-QR per booking: list, add, view, download |

---

## 10. Vendor Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/vendor/dashboard` | Stats, REZ connect banner, performance, recent bookings |
| Listings | `/vendor/listings` | All listings with status, success banners |
| New Listing | `/vendor/listings/new` | 4-step form (basic, pricing, media, advanced) |
| Edit Listing | `/vendor/listings/[id]/edit` | Edit all listing fields |
| Bookings | `/vendor/bookings` | All bookings, proof upload, multi-QR manager, messages |
| Inquiries | `/vendor/inquiries` | Incoming buyer inquiries, send quote |
| Earnings | `/vendor/earnings` | Payout summary, payout method card |
| Attribution | `/vendor/attribution` | Full scan→visit→purchase funnel per booking |
| QR Analytics | `/vendor/analytics` | Platform overview + per-QR breakdown with timeline/funnel/cities/devices |
| REZ Connect | `/vendor/rez-connect` | Link REZ merchant account |
| Profile | `/vendor/profile` | Name, company, payout settings (bank + UPI) |

---

## 11. Buyer Pages

| Page | Path | Description |
|------|------|-------------|
| Browse | `/browse` | Search, filter by city/category/price |
| Listing Detail | `/listing/[id]` | Full listing, reviews, inquire/book CTAs |
| Inquire | `/buyer/inquire?listing=[id]` | Send inquiry with budget + dates |
| Cart | `/buyer/cart` | Staged booking with duration selector, Razorpay |
| Bookings | `/buyer/bookings` | All bookings, proof approval, assign to campaign |
| Inquiries | `/buyer/inquiries` | Incoming quotes, accept/decline |
| Campaigns | `/buyer/campaigns` | Group bookings into campaigns |
| Profile | `/buyer/profile` | Account settings |

---

## 12. Admin Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/admin/dashboard` | Stats, pending listings queue, disputes, recent bookings |
| All Listings | `/admin/listings` | Full listings table with approve/reject |
| All Bookings | `/admin/bookings` | All bookings with status filter |
| All Users | `/admin/users` | User table with vendor/buyer stats |
| Platform Stats | `/admin/stats` | GMV, scan counts, attribution stats |
| QR Scan Log | `/admin/qr-scans` | Recent 100 scan events |

---

## 13. Go-Live Checklist

### Ops (manual steps)
- [ ] Create Supabase project, copy URL/anon/service_role keys
- [ ] Run all 6 migrations in SQL Editor (001 → 006)
- [ ] Create `listing-images` storage bucket (Public: ON)
- [ ] Add all env vars to Vercel → Redeploy
- [ ] Add `ADBAZAAR_WEBHOOK_URL/SECRET/INTERNAL_KEY` to REZ backend on Render
- [ ] Add `https://ad-bazaar.vercel.app` to `CORS_ORIGIN` on REZ backend
- [ ] Get live Razorpay keys (currently test keys)
- [ ] Sign up at resend.com, get `RESEND_API_KEY`
- [ ] Build 2 REZ backend endpoints: `verify-merchant` + `/api/adbazaar/scan`
- [ ] Wire 2 REZ webhook callers: `rez-visit` + `rez-purchase`

### Test loop
1. Register vendor → connect REZ merchant ID
2. Create listing → admin approves
3. Buyer browses → books listing → pays
4. QR code generated automatically
5. Vendor adds more QR codes (per poster) in bookings page
6. Scan QR → coins credited → see analytics in `/vendor/analytics`
7. REZ user visits store → webhook fires → attribution updates

---

## 14. Brand Identity

**Name:** AdBazaar — "Ad" (advertising) + "Bazaar" (Indian marketplace)  
**Positioning:** India's ad marketplace with proof  
**Visual:** Dark mode (#0f0f0f), Amber (#f59e0b) accent, heavy font weights  
**Differentiator:** Only ad marketplace where scanning a physical ad rewards the consumer with REZ loyalty coins — creating a measurable scan → visit → purchase loop

**Tagline options:**
- "Book it. Prove it."
- "Every ad, measured."
- "Offline ads. Online accountability."
