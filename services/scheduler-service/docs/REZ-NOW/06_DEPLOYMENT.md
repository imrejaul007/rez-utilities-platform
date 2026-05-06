# REZ Now — Deployment & Environment Configuration

> **Status**: Live Production
> **Frontend**: `now.rez.money` — Vercel, bom1 (Mumbai)
> **Backend**: `rezbackend/rez-backend-master/` — Render, Oregon
> **Domain**: `now.rez.money` (Cloudflare-managed)

---

## Table of Contents

1. [Frontend — Vercel](#1-frontend--vercel)
2. [Backend — Render](#2-backend--render)
3. [All Environment Variables](#3-all-environment-variables)
4. [Domain Setup](#4-domain-setup)
5. [Apple Universal Links](#5-apple-universal-links)
6. [Android App Links](#6-android-app-links)
7. [Pre-Deployment Checklist](#7-pre-deployment-checklist)
8. [Post-Deployment Checklist](#8-post-deployment-checklist)
9. [Rollback Procedure](#9-rollback-procedure)

---

## 1. Frontend — Vercel

### 1.1 Project Settings

| Setting | Value |
|---------|-------|
| Framework | Next.js 16 (App Router) |
| Region | `bom1` (Mumbai, India) |
| Build Command | `npm run build` |
| Output Directory | `.next` |
| Install Command | `npm install` |
| Max Function Duration | 30 seconds |

Connect the Git repository: `imrejaul007/rez-now` (or the active remote).

**Important**: Vercel automatically sets `NODE_ENV=production` during deployment builds and `NODE_ENV=test` during preview builds.

### 1.2 Build Settings (vercel.json)

The project ships with a `vercel.json` at the repo root. Verify these settings before deploying:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "regions": ["bom1"],
  "functions": {
    "app/**": { "maxDuration": 30 }
  }
}
```

If the file is missing or modified, restore it. The region `bom1` ensures latency < 50ms for Indian users.

### 1.3 Security Headers (vercel.json)

The `vercel.json` also contains global security headers applied to all routes:

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-XSS-Protection", "value": "1; mode=block" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      {
        "key": "Content-Security-Policy",
        "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; frame-src https://api.razorpay.com; img-src 'self' data: https: blob:; connect-src 'self' https://*.rez.money wss://*.rez.money https://sentry.io; style-src 'self' 'unsafe-inline'"
      }
    ]
  }
]
```

**Do not remove the CSP header.** It is required for:
- Razorpay checkout iframe to load (`checkout.razorpay.com`, `api.razorpay.com`)
- Socket.IO WebSocket connections to `*.rez.money`
- Sentry error reporting
- Image loading from cloud storage

### 1.4 Rewrites for Deep Links (vercel.json)

```json
"rewrites": [
  {
    "source": "/.well-known/assetlinks.json",
    "destination": "/api/assetlinks"
  },
  {
    "source": "/.well-known/apple-app-site-association",
    "destination": "/api/apple-app-site-association"
  }
]
```

These rewrites serve the Android App Links and iOS Universal Links JSON files. Both are also handled by `next.config.ts` headers for correct `Content-Type`.

### 1.5 Environment Variable Groups

Set environment variables in Vercel dashboard under **Settings > Environment Variables**. Use three groups:

| Group | Applies To | Purpose |
|-------|-----------|---------|
| `Production` | Production only | Live secrets and URLs |
| `Preview` | Preview branches | Same as production, different API URL for staging backend |
| `Development` | Local dev via `vercel dev` | Same as preview |

### 1.6 Vercel-Specific Variables (Auto-Set)

These are injected automatically by Vercel — do not set manually:

| Variable | Value | Purpose |
|----------|-------|---------|
| `VERCEL` | `1` | Detects Vercel environment |
| `VERCEL_ENV` | `production` / `preview` / `development` | Environment name |
| `VERCEL_URL` | e.g., `now-xyz.vercel.app` | Preview deployment URL |
| `VERCEL_GIT_PROVIDER` | `github` | Git provider |
| `VERCEL_GIT_REPO_SLUG` | `rez-now` | Repository name |
| `VERCEL_GIT_COMMIT_REF` | branch/commit SHA | Current branch |

### 1.7 Vercel Build Failures — Common Causes

| Error | Fix |
|-------|-----|
| `NEXT_PUBLIC_` vars show wrong values | Ensure they are set in Vercel dashboard, not just `.env` — `.env` is ignored on Vercel for `NEXT_PUBLIC_` vars |
| Sitemap returns 500 | Backend `/api/web-ordering/stores/featured` is unreachable — check `NEXT_PUBLIC_API_URL` |
| Apple/Android deep link returns 503 | Missing `APPLE_TEAM_ID` or `ANDROID_SHA256_CERT_FINGERPRINT` — these are optional |
| CSP blocks Razorpay | Never modify the CSP header; Razorpay domains are whitelisted |
| Build timeout (30s) | `functions.maxDuration` is set to 30s in `vercel.json` — this is the maximum |

---

## 2. Backend — Render

### 2.1 Services

Two services are defined in `render.yaml` (`rezbackend/rez-backend-master/render.yaml`):

#### Service 1: `rez-api` (Web)

| Setting | Value |
|---------|-------|
| Type | Web Service |
| Region | Oregon |
| Plan | Starter |
| Branch | `main` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check | `GET /health` |
| Auto-Deploy | Yes (on push to `main`) |

#### Service 2: `rez-worker` (Worker)

| Setting | Value |
|---------|-------|
| Type | Background Worker |
| Region | Oregon |
| Plan | Starter |
| Branch | `main` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start:worker` |
| Auto-Deploy | Yes (on push to `main`) |

**Important**: Both services must be deployed together. Render deploys services independently — ensure the worker is also deployed after the API deploy completes.

### 2.2 Render-Specific Variables (Auto-Set)

Render automatically injects:

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `production` | Automatically set by Render |
| `PORT` | Dynamic (e.g., `10000`) | Port the web process must listen on |
| `RENDER` | `true` | Detects Render environment |
| `RENDER_SERVICE_ID` | UUID | Unique per deployment |
| `DATABASE_URL` | — | Only set if using Render's managed PostgreSQL (not used here) |

### 2.3 Scaling (Render Starter Plan)

The free/starter Render plan sleeps after 15 minutes of inactivity. This causes cold starts of 30-60 seconds on the first request after sleep.

**Mitigation**: Keep `rez-api` warm with a cron job:

```
URL: https://<your-backend-url>/health
Schedule: every 5 minutes
```

If `rez-api` sleeps mid-transaction, the payment flow breaks. Consider upgrading to a Render paid plan (`starter` at ~$7/month) for always-on instances if payment reliability is critical.

### 2.4 Render Environment Variable Sync

Variables marked `sync: true` in `render.yaml` are pulled from the Render dashboard on every deploy. Variables marked `sync: false` must be set manually in the Render dashboard — they are not read from `render.yaml` for security reasons.

All **secret** variables (`MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, `RAZORPAY_KEY_SECRET`, etc.) are `sync: false`. Set them in:

**Dashboard**: `rez-api > Environment > Environment Variables`

### 2.5 Backend Health Endpoint

The backend exposes `GET /health`. Verify it's working after every deploy:

```bash
curl https://<backend-url>/health
```

Expected response: `{ "status": "ok", "timestamp": "...", "uptime": N }`

If the health endpoint fails, the Vercel build may fail too (if you wire it into the pre-flight checks).

---

## 3. All Environment Variables

### 3.1 Frontend — Vercel (rez-now)

| Variable | Service | Used In | Example Value | Required |
|----------|---------|---------|---------------|----------|
| `NEXT_PUBLIC_API_URL` | Frontend | `lib/api/client.ts`, `lib/api/search.ts`, `app/sitemap.xml/route.ts`, `app/[storeSlug]/opengraph-image.tsx` | `https://api.rezapp.com` | **Required** |
| `NEXT_PUBLIC_SOCKET_URL` | Frontend | `lib/hooks/useOrderSocket.ts`, `components/menu/MenuItem.tsx`, `components/table/KitchenChatDrawer.tsx` | `https://api.rezapp.com` | **Required** |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Frontend | `app/[storeSlug]/checkout/page.tsx`, `app/[storeSlug]/pay/checkout/page.tsx` | `rzp_test_xxxxxxxxxxxxxx` | **Required** |
| `NEXT_PUBLIC_APP_URL` | Frontend | `app/layout.tsx` (metadataBase, canonical), `app/sitemap.xml/route.ts` | `https://now.rez.money` | **Required** |
| `NEXT_PUBLIC_APP_NAME` | Frontend | `app/layout.tsx` (title template, Apple Web App title) | `REZ Now` | Recommended |
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend | `sentry.client.config.ts`, `sentry.edge.config.ts` | `https://xxxxx@sentry.io/xxxxx` | Recommended |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Frontend | `lib/utils/pushNotifications.ts`, `lib/push/webPush.ts` | `(64-char base64 string)` | Optional |
| `NEXT_PUBLIC_ANALYTICS_URL` | Frontend | `lib/analytics/events.ts` | `https://analytics.rez.money` | Optional |
| `APPLE_TEAM_ID` | Frontend | `app/api/apple-app-site-association/route.ts` | `ABCDE12345` | Optional* |
| `IOS_BUNDLE_ID` | Frontend | `app/.well-known/apple-app-site-association/route.ts` | `com.rez.consumer` | Optional* |
| `ANDROID_SHA256_CERT_FINGERPRINT` | Frontend | `app/api/assetlinks/route.ts` | `AA:BB:CC:DD:...` | Optional* |
| `ANDROID_PACKAGE_NAME` | Frontend | `app/.well-known/assetlinks.json/route.ts` | `com.rez.money` | Optional* |
| `NODE_ENV` | Frontend | All files (auto-set by Vercel) | `production` | Auto-set |
| `ANALYZE` | Frontend | `next.config.ts` (bundle analyzer) | `true` | Dev only |

*Required only if Apple Universal Links / Android App Links are configured.

### 3.2 Backend — Render (rez-api + rez-worker)

All backend variables below apply to both `rez-api` and `rez-worker` unless noted.

#### Core Infrastructure

| Variable | Service | Used In | Example Value | Required |
|----------|---------|---------|---------------|----------|
| `MONGODB_URI` | Both | `src/server.ts`, all Mongoose models | `mongodb+srv://user:pass@cluster.mongodb.net/rez` | **Required** |
| `REDIS_URL` | Both | `src/services/QueueService.ts`, `src/services/cashbackService.ts` | `redis://default:pass@valkyrie-redis:6379` | **Required** |
| `PORT` | `rez-api` only | `src/server.ts` (auto-set by Render) | `10000` | Auto-set |
| `NODE_ENV` | Both | All files (auto-set by Render) | `production` | Auto-set |
| `MONGO_MAX_POOL_SIZE` | Both | `src/server.ts` | `10` (API), `5` (Worker) | Set in render.yaml |

#### Authentication & Secrets

| Variable | Service | Used In | Example Value | Required |
|----------|---------|---------|---------------|----------|
| `JWT_SECRET` | Both | Consumer auth routes | `(min 32-char random string)` | **Required** |
| `JWT_REFRESH_SECRET` | Both | Token refresh routes | `(min 32-char random string)` | **Required** |
| `JWT_MERCHANT_SECRET` | Both | `src/merchantroutes/auth.ts` | `(min 32-char random string)` | **Required** |
| `JWT_ADMIN_SECRET` | Both | Admin auth routes | `(min 32-char random string)` | **Required** |
| `JWT_MERCHANT_EXPIRES_IN` | Both | Merchant token expiry | `7d` | Recommended |
| `OTP_HMAC_SECRET` | Both | OTP generation/verification | `(min 32-char random string)` | **Required** (hard exit if missing) |
| `ENCRYPTION_KEY` | Both | PII encryption at rest | `(min 32-char random string)` | **Required** (hard exit if missing) |
| `TOTP_ENCRYPTION_KEY` | Both | Admin TOTP 2FA | `(min 32-char random string)` | **Required** (hard exit if missing) |
| `INTERNAL_SERVICE_TOKEN` | Both | Internal auth for `emit-payment` | `(random string)` | **Required** |
| `INTERNAL_SERVICE_KEY` | Both | `src/services/MarketingSignalService.ts` | `(random string)` | Recommended |

#### Payments

| Variable | Service | Used In | Example Value | Required |
|----------|---------|---------|---------------|----------|
| `RAZORPAY_KEY_ID` | Both | Payment routes | `rzp_test_xxxxxxxxxxxxxx` | **Required** |
| `RAZORPAY_KEY_SECRET` | Both | Payment verification | `xxxxxxxxxxxxxxxxxxxx` | **Required** |
| `RAZORPAY_WEBHOOK_SECRET` | Both | Webhook signature verification | `xxxxxxxxxxxxxxxxxxxx` | **Required** |
| `STRIPE_SECRET_KEY` | Both | `src/services/stripeService.ts` | `sk_live_...` | Optional |
| `STRIPE_WEBHOOK_SECRET` | Both | Stripe webhook verification | `whsec_...` | Optional |
| `STRIPE_PUBLISHABLE_KEY` | `rez-worker` | Stripe public key | `pk_live_...` | Optional |

#### CORS & Frontend URLs

| Variable | Service | Used In | Example Value | Required |
|----------|---------|---------|---------------|----------|
| `CORS_ORIGIN` | `rez-api` | CORS middleware | `https://now.rez.money,https://app.rez.in,https://merchant.rez.in` | **Required** |
| `FRONTEND_URL` | Both | Fallback CORS origin | `https://app.rez.in` | Recommended |
| `MERCHANT_FRONTEND_URL` | Both | Merchant dashboard origin | `https://merchant.rez.in` | Recommended |
| `ADMIN_FRONTEND_URL` | Both | Admin dashboard origin | `https://admin.rez.in` | Recommended |
| `TRUST_PROXY_DEPTH` | `rez-api` | Rate limiting proxy trust | `2` | Set in render.yaml |

#### Notifications & Messaging

| Variable | Service | Used In | Example Value | Required |
|----------|---------|---------|---------------|----------|
| `TWILIO_ACCOUNT_SID` | Both | SMS OTP sending | `ACxxxxxxxxxxxxxxxx` | Recommended |
| `TWILIO_AUTH_TOKEN` | Both | Twilio auth | `xxxxxxxxxxxxxxxxxxxxxxxx` | Recommended |
| `TWILIO_PHONE_NUMBER` | Both | SMS sender number | `+91XXXXXXXXXX` | Recommended |
| `SENDGRID_API_KEY` | Both | Transactional email | `SG.xxxxxxxxxxxxxxxxx` | Recommended |
| `VAPID_PUBLIC_KEY` | Both | `src/services/webPushService.ts` | `(64-char base64)` | Optional |
| `VAPID_PRIVATE_KEY` | Both | `src/services/webPushService.ts` | `(64-char base64)` | Optional |
| `VAPID_EMAIL` | Both | `src/services/webPushService.ts` | `mailto:no-reply@rez.money` | Optional |
| `WHATSAPP_APP_SECRET` | `rez-worker` | WhatsApp webhook verification | `xxxxxxxxxxxxxxxx` | Optional |
| `WHATSAPP_VERIFY_TOKEN` | `rez-worker` | WhatsApp verify token | `xxxxxxxxxxxxxxxx` | Optional |
| `WHATSAPP_STORE_ID` | `rez-worker` | WhatsApp Business ID | `xxxxxxxxxxxxxxxx` | Optional |

#### Media & Storage

| Variable | Service | Used In | Example Value | Required |
|----------|---------|---------|---------------|----------|
| `CLOUDINARY_CLOUD_NAME` | Both | Image uploads | `rez-cloud` | Recommended |
| `CLOUDINARY_API_KEY` | Both | Cloudinary auth | `xxxxxxxxxxxxxxxx` | Recommended |
| `CLOUDINARY_API_SECRET` | Both | Cloudinary auth | `xxxxxxxxxxxxxxxx` | Recommended |
| `FIREBASE_CREDENTIALS_JSON` | `rez-worker` | Firebase push notifications | `{"type":"service_account"...}` | Optional |

#### Rewards & Loyalty Configuration

| Variable | Service | Default | Purpose |
|----------|---------|---------|---------|
| `REWARD_DAILY_COIN_CAP` | Both | `1000` | Max coins earned per day |
| `REWARD_MONTHLY_COIN_CAP` | Both | `50000` | Max coins earned per month |
| `REWARD_MAX_COINS_PER_ORDER` | Both | `500` | Per-order coin cap |
| `REWARD_MAX_CASHBACK_PER_TXN` | Both | `200` | Max cashback per transaction |
| `REWARD_REZ_EXPIRY_DAYS` | Both | `0` (never expires) | REZ coin expiry |
| `REWARD_PROMO_EARN_RATE` | Both | `0.05` | Promo coin earn rate (5%) |
| `REWARD_PROMO_MIN_ORDER` | Both | `200` | Minimum order for promo coins |
| `LOYALTY_TIER_PLATINUM_THRESHOLD` | Both | `10000` | Platinum tier minimum |
| `LOYALTY_TIER_GOLD_THRESHOLD` | Both | `2000` | Gold tier minimum |
| `LOYALTY_TIER_SILVER_THRESHOLD` | Both | `500` | Silver tier minimum |

#### Kill Switches (set to `true` to disable)

| Variable | Service | Purpose |
|----------|---------|---------|
| `REWARD_KILL_SWITCH_ALL` | Both | Disable all rewards |
| `REWARD_KILL_SWITCH_REFERRALS` | Both | Disable referral bonuses |
| `REWARD_KILL_SWITCH_CASHBACK` | Both | Disable cashback |
| `REWARD_KILL_SWITCH_PROMOS` | Both | Disable promo coins |
| `REWARD_KILL_SWITCH_GAMIFICATION` | Both | Disable gamification |
| `REWARD_KILL_SWITCH_DAILY_LOGIN` | Both | Disable daily login bonuses |
| `REWARD_KILL_SWITCH_SIP` | Both | Disable SIP bonuses |

#### External Services

| Variable | Service | Example Value | Required |
|----------|---------|---------------|----------|
| `GAMIFICATION_SERVICE_URL` | Both | `https://rez-gamification-service-3b5d.onrender.com` | Recommended |
| `CATALOG_SERVICE_URL` | Both | `https://rez-catalog.onrender.com` | Optional |
| `MARKETING_SERVICE_URL` | Both | `https://rez-marketing.onrender.com` | Optional |
| `ADBAZAAR_WEBHOOK_URL` | Both | `https://ad-bazaar.vercel.app` | Optional |
| `ADBAZAAR_WEBHOOK_SECRET` | Both | `(secret)` | Optional |

#### Hotel & Travel (OTA Integration)

| Variable | Service | Example Value | Required |
|----------|---------|---------------|----------|
| `REZ_OTA_WEBHOOK_SECRET` | Both | `(secret)` | Optional |
| `REZ_STAY_COMPLETION_BONUS_PCT` | Both | `20` | Optional |
| `TRAVEL_WEBHOOK_SECRET` | Both | `(secret)` | Optional |

#### Deep Link App Configuration (Backend)

| Variable | Service | Used In | Example Value | Required |
|----------|---------|---------|---------------|----------|
| `APPLE_APP_ID` | `rez-api` | `src/server.ts` | `1234567890` | Optional |
| `MERCHANT_APPLE_APP_ID` | `rez-api` | `src/server.ts` | `1234567891` | Optional |
| `ADMIN_APPLE_APP_ID` | `rez-api` | `src/server.ts` | `1234567892` | Optional |
| `ANDROID_SHA256_FINGERPRINT` | `rez-api` | `src/server.ts` | `AA:BB:CC:DD:...` | Optional |
| `MERCHANT_ANDROID_SHA256_FINGERPRINT` | `rez-api` | `src/server.ts` | `AA:BB:CC:DD:...` | Optional |
| `ADMIN_ANDROID_SHA256_FINGERPRINT` | `rez-api` | `src/server.ts` | `AA:BB:CC:DD:...` | Optional |

#### Queue & Worker Configuration

| Variable | Service | Default | Purpose |
|----------|---------|---------|---------|
| `QUEUE_CASHBACK_SHARDS` | Both | `1` | Cashback queue sharding |
| `QUEUE_CONCURRENCY_EMAIL` | Both | `15` | Email queue workers |
| `QUEUE_CONCURRENCY_SMS` | Both | `5` | SMS queue workers |
| `QUEUE_CONCURRENCY_PUSH` | Both | `10` | Push notification workers |
| `QUEUE_CONCURRENCY_CASHBACK` | Both | `5` | Cashback queue workers |
| `QUEUE_CASHBACK_BACKPRESSURE_THRESHOLD` | Both | `2000` | Backpressure limit |
| `WORKER_ROLE` | Both | `critical` (API), `noncritical` (Worker) | Controls which workers start |
| `PROCESS_ROLE` | `rez-api` | `api` / `worker` | Process role routing |
| `ENABLE_CRON` | `rez-api` | `true` | Enable cron jobs on API |
| `NOTIFICATION_WORKER_EXTERNAL` | Both | `true` | Use external notification worker |
| `SHUTDOWN_TIMEOUT_MS` | Both | `15000` | Graceful shutdown timeout |
| `ANALYZE` | Both | `true` | Enable bundle/server analysis |

### 3.3 Cross-Service Variable Mapping

These variables must have **matching values** across frontend and backend:

| Frontend Variable | Backend Variable | Must Match |
|-------------------|-----------------|------------|
| `NEXT_PUBLIC_APP_URL` | `FRONTEND_URL` | Base URL of the web app |
| `NEXT_PUBLIC_SOCKET_URL` | `FRONTEND_URL` (WebSocket) | Socket.IO endpoint |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `RAZORPAY_KEY_ID` | Must be same Razorpay account |

---

## 4. Domain Setup

### 4.1 DNS Records (Cloudflare)

`now.rez.money` is managed on Cloudflare. Add or verify these DNS records:

| Type | Name | Content | Proxy | Purpose |
|------|------|---------|-------|---------|
| CNAME | `now` | `cname.vercel-dns.com` | DNS only (grey) | Points to Vercel — **must not be Proxied** |
| CAA | `now` | `0 issue "letsencrypt.org"` | — | LetsEncrypt certificate |
| CAA | `now` | `0 issue "amazonaws.com"` | — | AWS services (if any) |

**Critical**: The CNAME record for `now` must be set to `cname.vercel-dns.com` with Cloudflare proxy set to **DNS only (grey cloud)**. If the proxy is enabled (orange cloud), Vercel cannot automatically provision an SSL certificate and the site will show a certificate mismatch.

### 4.2 Vercel Domain Configuration

After pushing to Vercel, add the custom domain:

1. Vercel Dashboard > `rez-now` project > **Settings > Domains**
2. Add domain: `now.rez.money`
3. Vercel will automatically detect and verify the CNAME record
4. SSL certificate is provisioned automatically by Vercel (LetsEncrypt)
5. Redirect `www.now.rez.money` to `now.rez.money` (optional)

### 4.3 Subdomains

| Subdomain | Points To | Platform | Purpose |
|-----------|-----------|----------|---------|
| `now.rez.money` | Vercel | Vercel | REZ Now consumer web app |
| `api.rez.money` | Render | Render | REZ Backend API |
| `app.rez.money` | Vercel | Vercel | REZ Consumer app |
| `merchant.rez.money` | Vercel | Vercel | REZ Merchant dashboard |
| `admin.rez.money` | Vercel | Vercel | REZ Admin panel |

---

## 5. Apple Universal Links

Apple Universal Links allow `now.rez.money/<path>` links to open directly in the REZ consumer iOS app instead of Safari.

### 5.1 How It Works

1. iOS app is installed and associated with domain `now.rez.money`
2. User taps a `now.rez.money` link in Safari, WhatsApp, or any app
3. iOS fetches `https://now.rez.money/.well-known/apple-app-site-association`
4. iOS verifies the app bundle ID is in the AASA file
5. If matched: opens the app. If not: opens the link in Safari.

### 5.2 Required Environment Variables

| Variable | Vercel Value | Example |
|----------|-------------|---------|
| `APPLE_TEAM_ID` | Your 10-character Apple Developer Team ID | `ABCDE12345` |
| `IOS_BUNDLE_ID` | Consumer app bundle ID | `com.rez.consumer` |

Find your Team ID at: [developer.apple.com](https://developer.apple.com) > Account > Membership

### 5.3 Generated AASA Response

When both variables are set, `GET /.well-known/apple-app-site-association` returns:

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["ABCDE12345.com.rez.consumer"],
        "components": [
          { "/": "/*", "comment": "All paths on now.rez.money open in REZ consumer app" }
        ]
      }
    ]
  }
}
```

If either variable is missing or is a placeholder, the endpoint returns HTTP 503 with a plain text message.

### 5.4 iOS App Configuration

In your iOS app's `Associated Domains` capability (Xcode or Apple Developer portal):

```
applinks:now.rez.money
```

### 5.5 Testing

1. Install the iOS app on a physical device (Simulator does not support Universal Links)
2. Open Safari, type `now.rez.money/<slug>`
3. The page should redirect to the app. Verify by checking the app's deep link handler receives the URL.

### 5.6 Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 503 returned | `APPLE_TEAM_ID` not set or still placeholder | Set `APPLE_TEAM_ID` in Vercel env vars |
| App doesn't open | Bundle ID mismatch | Verify the bundle ID matches exactly what's in the AASA `appIDs` array |
| App opens but wrong screen | App's URL handling not implemented | Check iOS app's `onOpenURL` handler |
| Works in Safari but not WhatsApp | WhatsApp may cache old AASA | Clear WhatsApp cache or restart device |

---

## 6. Android App Links

Android App Links (formerly Deep Links) allow `now.rez.money/<path>` links to open directly in the REZ consumer Android app.

### 6.1 How It Works

1. Android app is installed with a verified `assetlinks.json` configuration
2. User taps a `now.rez.money` link
3. Android fetches `https://now.rez.money/.well-known/assetlinks.json`
4. Android verifies the SHA256 fingerprint matches the app's signing certificate
5. If matched: opens the app. If not: opens in browser.

### 6.2 Required Environment Variables

| Variable | Vercel Value | Source |
|----------|-------------|--------|
| `ANDROID_SHA256_CERT_FINGERPRINT` | SHA256 fingerprint of your release signing key | Play Console > Setup > App Signing > SHA-256 certificate fingerprint |
| `ANDROID_PACKAGE_NAME` | Android app package name | `com.rez.money` (default, safe to leave) |

### 6.3 Getting the SHA256 Fingerprint

**Option A — From Play Console (recommended for production):**

1. Go to [Play Console](https://play.google.com/console)
2. Select your app > **Setup > App Signing**
3. Copy the **SHA-256 certificate fingerprint** under "App signing key certificate"
4. If you also use a separate upload key, also copy that fingerprint

**Option B — From a local keystore (for testing):**

```bash
keytool -list -v -keystore your-release-keystore.jks -alias your-alias -storepass password -keypass password
```

Look for the `SHA256: XX:XX:XX:...` line.

### 6.4 Generated assetlinks.json Response

When `ANDROID_SHA256_CERT_FINGERPRINT` is set, `GET /.well-known/assetlinks.json` returns:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.rez.money",
      "sha256_cert_fingerprints": ["AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:00:11:22:33:44:55:66:77:88:99"]
    }
  }
]
```

If the fingerprint is a placeholder, the endpoint returns HTTP 503.

### 6.5 Android App Configuration

In your Android app's `AndroidManifest.xml`, add an intent filter:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.BROWSABLE" />
  <category android:name="android.intent.category.DEFAULT" />
  <data
    android:scheme="https"
    android:host="now.rez.money" />
</intent-filter>
```

### 6.6 Testing

```bash
# Use the Android Debug Bridge to test deep links
adb shell am start -a android.intent.action.VIEW \
  -d "https://now.rez.money/test-store"
```

Or use the Firebase App Linking test tool in the Play Console.

### 6.7 Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 503 returned | `ANDROID_SHA256_CERT_FINGERPRINT` not set | Set it in Vercel env vars |
| App doesn't open | Fingerprint mismatch | Ensure you're using the correct fingerprint from Play Console |
| Browser opens instead of app | `autoVerify="true"` missing or verification failed | Check AndroidManifest.xml and verify Digital Asset Links in Play Console |
| Multiple fingerprints | App uses multiple signing keys | Add all fingerprints as separate entries in the array |

---

## 7. Pre-Deployment Checklist

Run through this checklist before every production deployment.

### 7.1 Code & Build

- [ ] All `TODO` comments related to payment wiring are resolved
- [ ] `npm run build` succeeds locally with no TypeScript errors
- [ ] `npm run lint` passes with no errors
- [ ] All test files pass: `npm test` (if tests exist)
- [ ] Playwright e2e tests pass: `npx playwright test`
- [ ] No `console.error` or `console.warn` in production-critical paths
- [ ] No hardcoded URLs (all API/Socket URLs use `NEXT_PUBLIC_` env vars)
- [ ] `vercel.json` is present and has correct region (`bom1`)
- [ ] `vercel.json` CSP header includes all required domains

### 7.2 Environment Variables — Vercel

- [ ] `NEXT_PUBLIC_API_URL` is set to production backend URL (not staging)
- [ ] `NEXT_PUBLIC_SOCKET_URL` is set to production backend URL
- [ ] `NEXT_PUBLIC_RAZORPAY_KEY_ID` is set to **live** Razorpay key (not test)
- [ ] `NEXT_PUBLIC_APP_URL` is set to `https://now.rez.money`
- [ ] `NEXT_PUBLIC_SENTRY_DSN` is set to the `rez-now` Sentry project
- [ ] `APPLE_TEAM_ID` is set (if Apple Universal Links are needed)
- [ ] `ANDROID_SHA256_CERT_FINGERPRINT` is set (if Android App Links are needed)
- [ ] All optional deep-link variables are reviewed and set if applicable
- [ ] `.env` file is NOT committed (it should be in `.gitignore`)

### 7.3 Environment Variables — Render

- [ ] `MONGODB_URI` is set to production MongoDB cluster
- [ ] `REDIS_URL` is set to production Redis/Valkey instance
- [ ] `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_MERCHANT_SECRET`, `JWT_ADMIN_SECRET` are set to unique, random 32+ character strings
- [ ] `OTP_HMAC_SECRET`, `ENCRYPTION_KEY`, `TOTP_ENCRYPTION_KEY` are set
- [ ] `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set to **live** keys
- [ ] `RAZORPAY_WEBHOOK_SECRET` is set and registered in Razorpay dashboard
- [ ] `CORS_ORIGIN` includes `https://now.rez.money`
- [ ] `INTERNAL_SERVICE_TOKEN` matches the value expected by the `emit-payment` caller
- [ ] `SENTRY_DSN` is set to the backend Sentry project
- [ ] No placeholder values remain (e.g., `PLACEHOLDER_`, `TEAMID`, `00:00:00:00`)

### 7.4 Razorpay Dashboard

- [ ] Webhook is registered: `https://api.rezapp.com/api/webhooks/razorpay`
- [ ] Webhook secret matches `RAZORPAY_WEBHOOK_SECRET` in Render
- [ ] Allowed webhook events includes: `payment.captured`, `payment.failed`
- [ ] Live mode is enabled (not just test mode)

### 7.5 Database & Redis

- [ ] MongoDB Atlas cluster is accessible from Render's IP ranges (or allowlist is configured)
- [ ] Redis/Valkey instance is accessible from Render
- [ ] No migration scripts are pending that could cause data loss
- [ ] Database indexes exist for high-frequency queries (order lookups, store slugs)

### 7.6 DNS & Domain

- [ ] `now.rez.money` CNAME points to `cname.vercel-dns.com`
- [ ] Cloudflare proxy is **off** (grey cloud) for the `now` CNAME record
- [ ] Vercel has verified the custom domain `now.rez.money`
- [ ] SSL certificate is active on Vercel
- [ ] `api.rezapp.com` (or actual backend domain) is accessible and returns 200 from `/health`

### 7.7 Monitoring

- [ ] Sentry project `rez-now` is created and `NEXT_PUBLIC_SENTRY_DSN` is correct
- [ ] Sentry project for backend is created and `SENTRY_DSN` is correct
- [ ] Error alerts are configured in Sentry for production errors
- [ ] Render deployment notifications are enabled (email/webhook)

---

## 8. Post-Deployment Checklist

Run through this checklist immediately after every production deployment.

### 8.1 Immediate (First 5 Minutes)

- [ ] **Vercel deploy status**: Verify "Production" deployment shows green checkmark
- [ ] **Health check**: `curl https://now.rez.money/api/health` returns 200
- [ ] **Backend health**: `curl https://api.rezapp.com/health` returns 200
- [ ] **Homepage loads**: Open `https://now.rez.money` in an incognito browser tab
- [ ] **Store page loads**: Navigate to `https://now.rez.money/<test-slug>` — verify menu loads
- [ ] **Sitemap**: `curl https://now.rez.money/sitemap.xml` returns valid XML
- [ ] **No console errors**: Open browser DevTools, check Console tab for red errors

### 8.2 Payment Flow (Critical Path)

- [ ] Add item to cart and proceed to checkout
- [ ] Verify Razorpay checkout modal opens with correct key
- [ ] Complete a test payment with a real UPI account (use `rzp_test_` keys for staging)
- [ ] Verify order confirmation page shows after payment
- [ ] Verify coins are credited to wallet
- [ ] Verify Razorpay webhook was received (check Render logs)

### 8.3 Socket.IO / Real-time

- [ ] Place an order and verify live status updates arrive via WebSocket
- [ ] If Socket.IO disconnects, verify polling fallback works (check Network tab)
- [ ] Payment kiosk (`/merchant/pay-display`) shows live payment events

### 8.4 Deep Links

- [ ] `curl https://now.rez.money/.well-known/apple-app-site-association` returns valid JSON (if `APPLE_TEAM_ID` is set)
- [ ] `curl https://now.rez.money/.well-known/assetlinks.json` returns valid JSON (if `ANDROID_SHA256_CERT_FINGERPRINT` is set)
- [ ] If mobile apps are available, test on physical devices

### 8.5 Performance & Security

- [ ] Run Lighthouse audit on `https://now.rez.money`: Performance > 80, Accessibility > 90
- [ ] Check Vercel Analytics for Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] Verify CSP header is present: `curl -I https://now.rez.money | grep Content-Security-Policy`
- [ ] Verify `X-Frame-Options: DENY` is present
- [ ] Check Sentry dashboard for any spike in errors
- [ ] Check Render dashboard for elevated error rates or p99 latency

### 8.6 Rollout Monitoring (Next 30 Minutes)

- [ ] Monitor Render deployment logs for startup errors
- [ ] Check MongoDB for any failed writes or connection errors
- [ ] Check Redis/Valkey connection count and memory usage
- [ ] If any metric degrades significantly, initiate rollback (see Section 9)

---

## 9. Rollback Procedure

### 9.1 When to Roll Back

Initiate rollback immediately if any of the following are observed:

- Homepage or store pages return 5xx errors
- Payment flow is broken (checkout fails, orders not created)
- Backend health endpoint returns non-200
- Sentry shows a spike of >10% of sessions with errors
- Core Web Vitals degrade below thresholds (LCP > 4s, Error rate > 1%)
- A deployed dependency has a breaking change that was not caught in staging

### 9.2 Frontend Rollback (Vercel)

**Option A — Instant rollback via Vercel Dashboard (recommended):**

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select the `rez-now` project
3. Go to **Deployments** tab
4. Find the previous working deployment (look at "Created" timestamp)
5. Click the **three dots (...)** menu > **Redeploy**
6. Select **Production** — this immediately replaces the current deployment

Vercel keeps the last 10 deployments available for instant redeployment.

**Option B — Git revert:**

```bash
cd rez-now
git revert HEAD          # Creates a revert commit
git push origin main     # Triggers a new Vercel deploy
```

This is slower (5-10 minutes) but cleaner if you need to fix and re-deploy.

### 9.3 Backend Rollback (Render)

**Option A — Instant rollback via Render Dashboard (recommended):**

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Select the `rez-api` service
3. Go to **Deploys** tab
4. Find the previous working deployment
5. Click **Redeploy** next to it

Render keeps the last 5 successful deployments for instant redeployment.

**Important**: Roll back `rez-worker` first, then `rez-api`, to ensure worker compatibility.

**Option B — Restore from a previous commit:**

```bash
cd rezbackend/rez-backend-master
git log --oneline -10   # Find the previous good commit SHA
git checkout <good-sha>
git push origin main     # Triggers Render redeploy
```

This takes 3-5 minutes due to build time.

### 9.4 Database Migration Rollback

If a deployment included a MongoDB migration that caused issues:

1. **Do not attempt to "roll back" a migration** — most migrations are irreversible
2. Write a forward migration to fix the data instead
3. If data integrity is at risk, escalate immediately

### 9.5 Environment Variable Rollback

If a broken deployment was caused by an incorrect environment variable:

1. Go to Vercel Dashboard > `rez-now` > **Settings > Environment Variables**
2. Identify the changed variable
3. Revert it to the previous value
4. Trigger a redeploy (Vercel does not auto-redeploy on env var changes — you must manually redeploy)
5. For Render: go to the service > **Environment** > edit the variable > trigger redeploy

### 9.6 Communication Protocol

If the production incident affects users:

1. Immediately notify the team in Slack/Discord with the rollback status
2. Post an incident banner in the app if possible
3. After rollback, investigate the root cause before re-deploying
4. File a post-mortem report for any incident lasting > 5 minutes

### 9.7 Rollback Verification Checklist

After performing a rollback:

- [ ] Frontend `https://now.rez.money` loads correctly
- [ ] Backend health `https://api.rezapp.com/health` returns 200
- [ ] Payment flow works end-to-end (test with a real payment)
- [ ] No new errors in Sentry
- [ ] Notify team that rollback is complete and system is stable
