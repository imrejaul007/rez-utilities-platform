# REZ + AdBazaar Ecosystem — Deployment Guide

> Complete reference for going live: all services, env vars, ports, integration points, and startup order.

---

## 1. Services Overview

| Service | Repo | Port | Purpose |
|---|---|---|---|
| `rezbackend` | rez-backend-master | 5000 | Main API — auth, wallets, coins, orders, visits |
| `rez-ads-service` | imrejaul007/rez-ads-service | 4007 | In-app ad placements (REZ consumer app banners) |
| `rez-marketing-service` | (local) | 4000 | Outbound broadcasts — WhatsApp, push, SMS |
| `adbazaar` | imrejaul007/adBazaar | 3000 | Ad marketplace — vendors, buyers, QR, attribution |
| `rezapp` | rez-master | — | Consumer React Native app |
| `rezmerchant` | rez-merchant-master | — | Merchant React Native app |
| `rezadmin` | rez-admin-main | — | Admin React Native app |

---

## 2. Environment Variables — Complete Reference

### 2.1 REZ Backend (`rezbackend/rez-backend-master/.env`)

```env
# Core
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://...

# JWT (shared across all services)
JWT_SECRET=<your-jwt-secret>

# Redis
REDIS_URL=redis://...

# AdBazaar Integration
ADBAZAAR_INTERNAL_KEY=<shared-secret-generate-random-32-chars>
ADBAZAAR_WEBHOOK_URL=https://adbazaar.in
```

### 2.2 REZ Ads Service (`rez-ads-service/.env`)

```env
PORT=4007
MONGO_URI=mongodb+srv://...         # can share with rezbackend or separate DB
JWT_SECRET=<same-as-rezbackend>     # MUST match rezbackend JWT_SECRET
REDIS_URL=redis://...
INTERNAL_SERVICE_KEY=<internal-key-for-rezbackend-to-call-ads-service>
```

### 2.3 REZ Marketing Service (`rez-marketing-service/.env`)

```env
PORT=4000
MONGO_URI=mongodb+srv://...
JWT_SECRET=<same-as-rezbackend>

# AdBazaar integration
ADBAZAAR_INTERNAL_KEY=<same-as-rezbackend-ADBAZAAR_INTERNAL_KEY>

# Channels
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
FCM_SERVER_KEY=                     # Firebase push notifications
SENDGRID_API_KEY=

REDIS_URL=redis://...
INTERNAL_SERVICE_KEY=<same-key-used-by-rezbackend>
```

### 2.4 AdBazaar (`adbazaar/.env`)

```env
# App
NEXT_PUBLIC_APP_URL=https://adbazaar.in
NODE_ENV=production

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# REZ Integration
REZ_API_BASE_URL=https://api.rezapp.in          # rezbackend URL
REZ_INTERNAL_KEY=<ADBAZAAR_INTERNAL_KEY>        # same key
ADBAZAAR_INTERNAL_KEY=<same-32-char-secret>     # for verifying webhooks FROM rez
ADBAZAAR_WEBHOOK_SECRET=<another-secret>        # for securing visit/purchase webhooks

# Marketing Service
REZ_MARKETING_SERVICE_URL=https://marketing.rezapp.in

# Payments
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...

# Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_API_KEY=

# Notifications
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
SENDGRID_API_KEY=
```

### 2.5 Merchant App (`rezmerchant/.env` or `app.config.js`)

```env
EXPO_PUBLIC_API_URL=https://api.rezapp.in
EXPO_PUBLIC_ADS_SERVICE_URL=https://ads.rezapp.in   # rez-ads-service
```

### 2.6 Consumer App (`rezapp/.env`)

```env
EXPO_PUBLIC_API_URL=https://api.rezapp.in
EXPO_PUBLIC_ADS_SERVICE_URL=https://ads.rezapp.in
```

### 2.7 Admin App (`rezadmin/.env`)

```env
EXPO_PUBLIC_API_URL=https://api.rezapp.in
EXPO_PUBLIC_ADS_SERVICE_URL=https://ads.rezapp.in
```

---

## 3. The One Shared Secret

All services communicate using **one internal key**. Generate it once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set this same value in ALL of these:
- `rezbackend`: `ADBAZAAR_INTERNAL_KEY`
- `rez-marketing-service`: `ADBAZAAR_INTERNAL_KEY`
- `rez-ads-service`: `INTERNAL_SERVICE_KEY`
- `adbazaar`: `ADBAZAAR_INTERNAL_KEY` + `REZ_INTERNAL_KEY`

---

## 4. Integration Points — How Services Talk

### 4.1 QR Scan Loop (AdBazaar → REZ Backend)

```
User scans QR at physical ad
  → GET adbazaar.in/api/qr/scan/{slug}
  → POST {REZ_API_BASE_URL}/api/adbazaar/scan
     Header: x-internal-key: ADBAZAAR_INTERNAL_KEY
     Body: { rezUserId, qrCodeId, merchantId, coinsAmount, scanEventId }
  → REZ credits brand coins to user wallet
  → REZ saves AdBazaarScan record
```

### 4.2 Attribution Webhooks (REZ Backend → AdBazaar)

```
User visits merchant store (tracked by REZ)
  → POST {ADBAZAAR_WEBHOOK_URL}/api/webhooks/rez-visit
     Header: x-webhook-secret: ADBAZAAR_WEBHOOK_SECRET
     Body: { rezUserId, merchantId, scanEventId, visitTimestamp }

User makes purchase
  → POST {ADBAZAAR_WEBHOOK_URL}/api/webhooks/rez-purchase
     Header: x-webhook-secret: ADBAZAAR_WEBHOOK_SECRET
     Body: { rezUserId, merchantId, scanEventId, purchaseAmount, purchaseTimestamp }
```

### 4.3 Broadcast Trigger (AdBazaar → REZ Marketing Service)

```
Brand books WhatsApp/influencer ad on AdBazaar
  → POST {REZ_MARKETING_SERVICE_URL}/adbazaar/broadcast
     Header: x-internal-key: ADBAZAAR_INTERNAL_KEY
     Body: { adBazaarBookingId, rezMerchantId, channel, segment, title, body, qrCodeUrl, coinsPerScan }
  → rez-marketing-service sends to REZ users
  → GET {REZ_MARKETING_SERVICE_URL}/adbazaar/status/{broadcastId}  ← check status
```

### 4.4 In-App Ads (REZ Apps → rez-ads-service)

```
Consumer/Merchant/Admin apps call:
  GET  {ADS_SERVICE_URL}/merchant/ads          ← merchant manages ads
  GET  {ADS_SERVICE_URL}/admin/ads             ← admin reviews ads
  GET  {ADS_SERVICE_URL}/ads/serve?placement=  ← consumer app serves ad
  POST {ADS_SERVICE_URL}/ads/impression        ← track impression
  POST {ADS_SERVICE_URL}/ads/click             ← track click
```

---

## 5. Database Setup

### AdBazaar (Supabase)

1. Create project at supabase.com
2. Run migration:
```bash
# In Supabase SQL editor, paste contents of:
adbazaar/supabase/migrations/001_initial_schema.sql
```
3. Copy Project URL + anon key + service role key to `.env`

### All REZ services (MongoDB)

All REZ services can share one MongoDB Atlas cluster with separate databases:
- `rez-main` — rezbackend
- `rez-ads` — rez-ads-service (or use rez-main)
- `rez-marketing` — rez-marketing-service (or use rez-main)

---

## 6. Deployment Order (Go-Live Sequence)

```
1. MongoDB Atlas — create cluster, get connection strings
2. Redis — create Redis Cloud instance, get URL
3. Supabase — create project, run SQL migration
4. Deploy rezbackend (port 5000) — core API must be first
5. Deploy rez-ads-service (port 4007)
6. Deploy rez-marketing-service (port 4000)
7. Deploy adbazaar (Vercel recommended — Next.js)
8. Build + publish rezapp (consumer) to App Store / Play Store
9. Build + publish rezmerchant to App Store / Play Store
10. Build + publish rezadmin to App Store / Play Store
```

### Recommended hosting

| Service | Recommended Platform |
|---|---|
| rezbackend | Railway / Render / AWS EC2 |
| rez-ads-service | Railway / Render |
| rez-marketing-service | Railway / Render |
| adbazaar | Vercel (Next.js native) |
| MongoDB | MongoDB Atlas |
| Redis | Redis Cloud / Upstash |
| File storage | Cloudinary / AWS S3 |

---

## 7. Health Check URLs

Once deployed, verify all services are running:

```bash
# REZ Backend
curl https://api.rezapp.in/health

# REZ Ads Service
curl https://ads.rezapp.in/health

# REZ Marketing Service
curl https://marketing.rezapp.in/health

# AdBazaar
curl https://adbazaar.in/api/health  # (add this route if needed)

# Test AdBazaar → REZ integration
curl -X POST https://api.rezapp.in/api/adbazaar/webhook-test \
  -H "x-internal-key: YOUR_ADBAZAAR_INTERNAL_KEY"
```

---

## 8. Feature Flags (what's live vs pending)

| Feature | Status | Notes |
|---|---|---|
| QR scan → REZ coins | ✅ Built | Needs env vars set |
| In-app ads (banners) | ✅ Built | rez-ads-service |
| Merchant broadcast campaigns | ✅ Built | rez-marketing-service |
| AdBazaar marketplace | ✅ Built | Needs Supabase + Razorpay |
| Visit attribution webhooks | ✅ Built | Needs ADBAZAAR_WEBHOOK_SECRET |
| Purchase attribution | ✅ Built | Needs webhook injection in visit controller |
| AdBazaar → broadcast trigger | ✅ Built | Needs REZ_MARKETING_SERVICE_URL |
| Razorpay escrow payments | ⚠️ Partial | Order creation in /api/bookings needs wiring |
| Google Maps in marketplace | ⚠️ Pending | Placeholder in browse page, needs API key |
| Real file upload (images) | ⚠️ Pending | Using URL inputs for now, needs Cloudinary/S3 |

---

*Last updated: April 2026*
