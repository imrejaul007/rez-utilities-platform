# Unified QR Setup Guide

**Feature:** REZ Unified QR — One QR code for Pay In Store (app) + Web Menu (browser)  
**Date:** April 2026  
**Status:** Code shipped — requires two manual steps before going live

---

## How It Works

A single `https://menu.rez.money/<storeSlug>` URL is encoded in every store QR:

| Customer scans with... | Result |
|---|---|
| REZ app installed (iOS/Android) | OS intercepts URL → app opens → Pay In Store (coins, offers, EMI) |
| Phone browser (no app) | Web Menu loads in browser → OTP auth → Razorpay payment |
| Desktop browser | Web Menu loads normally |

---

## ⚠️ Required Manual Steps Before Go-Live

### Step 1 — Android: Replace SHA256 Fingerprint

File: `dist/.well-known/assetlinks.json` (in `rez-web-menu` repo)

Replace the placeholder with your real Android signing certificate fingerprint:

```json
"sha256_cert_fingerprints": [
  "REPLACE_WITH_ACTUAL_SHA256_CERT_FINGERPRINT"
]
```

**How to get the fingerprint:**

Option A — From Play Console:
1. Go to Play Console → your app → Setup → App signing
2. Copy the **SHA-256 certificate fingerprint** under "App signing key certificate"

Option B — From local keystore:
```bash
keytool -list -v -keystore your-release.keystore -alias your-alias
# Look for "SHA256:" under Certificate fingerprints
```

Option C — From EAS:
```bash
eas credentials
# Select Android → Production → view signing certificate SHA-256
```

The format should look like: `AB:CD:EF:12:34:...` (colons between each byte pair)

---

### Step 2 — iOS + Android: Trigger a New Native Build

The `associatedDomains` (iOS) and `intentFilters` (Android) changes in `app.config.js` are **native config** — they cannot be delivered via OTA update. A full EAS build is required.

```bash
cd rezapp/nuqta-master

# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

After the build, submit to stores and release. Until the new build is installed, the universal link routing (app intercept) will not work — the web menu fallback still works fine.

---

### Step 3 — Verify Universal Link Config is Live on Vercel

After deploying `rez-web-menu`, confirm Apple and Google can reach the config files:

```bash
# Apple verification
curl -s https://menu.rez.money/.well-known/apple-app-site-association | jq .

# Google verification
curl -s https://menu.rez.money/.well-known/assetlinks.json | jq .
```

Both should return JSON (not HTML). If you see HTML, the Vercel rewrite rule is catching these paths — check `vercel.json`.

Apple also has a validation tool:
```
https://app-site-association.cdn-apple.com/a/v1/menu.rez.money
```

---

## What Each File Does

| File | Purpose |
|---|---|
| `dist/.well-known/apple-app-site-association` | Tells iOS "when menu.rez.money/* is opened, route to money.rez.app" |
| `dist/.well-known/assetlinks.json` | Tells Android "when menu.rez.money/* is opened, route to money.rez.app" |
| `vercel.json` | Serves `.well-known/` with `Content-Type: application/json` and excludes it from the SPA rewrite |
| `dist/index.html` (smart banner) | Shows "Open in App" banner to mobile users who open the web menu; tries deep link, falls back to browser |
| `rezapp/nuqta-master/app.config.js` | Registers `menu.rez.money` as associated domain (iOS) and intent filter (Android) |
| `rezapp/nuqta-master/app/_layout.tsx` | Handles incoming `menu.rez.money/<slug>` URL → looks up store → navigates to Pay In Store |
| `rezbackend/src/routes/storePaymentRoutes.ts` | `GET /store-payment/lookup-by-slug/:storeSlug` — used by the app deep link handler |
| `rezbackend/src/services/qrCodeService.ts` | QR codes now encode `https://menu.rez.money/<slug>` instead of old JSON payload |

---

## QR Code Format Change

**Old format** (still supported for backward compatibility):
```json
{"type": "REZ_STORE_PAYMENT", "code": "REZ-STORE-XXXX", "v": "1.0"}
```

**New format:**
```
https://menu.rez.money/<storeSlug>
```

All existing printed QR codes (old format) will continue to work. The backend `lookupStoreByQR` handles all three formats: URL, JSON, and direct code string.

---

## Merchant App Changes

In the merchant QR screen, the separate "Payment QR" and "Menu QR" tabs have been replaced with a single **"Store QR"** tab. The QR displayed is the unified `menu.rez.money/<slug>` URL. Table-specific QRs remain separate (they encode table numbers for the dine-in flow).

---

## Consumer App Deep Link Flow

```
User scans QR with phone camera
        ↓
OS sees https://menu.rez.money/<slug>
        ↓
REZ app installed?
   YES → OS opens app
         ↓ app/_layout.tsx handleDeepLink()
         ↓ regex matches menu.rez.money/<slug>
         ↓ GET /store-payment/lookup-by-slug/<slug>
         ↓ navigate to /pay-in-store/enter-amount
   NO  → browser opens
         ↓ rez-web-menu SPA loads
         ↓ smart banner shown (if mobile)
         ↓ customer orders/pays via web flow
```

---

## Tier System (Free vs REZ Merchant Program)

The web menu QR works for all stores regardless of tier:
- **Free tier** — basic QR payment + ordering, standard Razorpay MDR, no coins
- **REZ Merchant Program** — full feature set: coins, loyalty, analytics, group orders, coupons, feedback

Coin earning (shown in Pay In Store enter-amount screen) only displays if `store.rewardRules.baseCashbackPercent > 0`, which is only set for program merchants.

---

## Troubleshooting

**Universal link not opening app (iOS):**
1. Check `apple-app-site-association` is accessible at `https://menu.rez.money/.well-known/apple-app-site-association`
2. Confirm bundle ID in the file matches `money.rez.app`
3. Ensure the new EAS build (with `applinks:menu.rez.money`) is installed
4. Note: universal links don't work when tapping from Safari — they work when tapping from Messages, Notes, other apps

**Universal link not opening app (Android):**
1. Check `assetlinks.json` is accessible
2. Confirm the SHA256 fingerprint matches your production signing key
3. Ensure the new EAS build (with `intentFilters`) is installed
4. Android verifies assetlinks.json at install time — reinstalling is required after changing the fingerprint

**Smart banner not appearing:**
- Banner only shows on mobile user agents
- Banner is suppressed on cart/checkout/order/confirm/receipt/payment paths
- Banner is suppressed after the user dismisses it (sessionStorage key `rez_banner_dismissed`)
- Banner requires a valid slug (≥2 chars) in the URL path
