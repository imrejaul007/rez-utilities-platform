# REZ — FEATURE FLAG REGISTER + DEPLOYMENT CHECKLIST (Doc 7)
## All Feature Flags · Where They Live · Who Controls Them · Deploy Order
### March 2026 | Zero-Accidental-Deployment

---

## WHY THIS DOCUMENT EXISTS

Without this document, a developer deploying Phase 3 (Privé campaigns) might:
1. Push code with `priveCampaignRoutes.ts` registered but no campaigns in the database
2. Users hit the endpoint and get 500 errors
3. Or worse: the endpoint works but no admin can review submissions

Feature flags prevent this. Every major feature is OFF by default. Admin turns it ON when ready.

---

## HOW FEATURE FLAGS WORK IN REZ

Flags live in two places:

**1. WalletConfig (MongoDB) — runtime configurable, no redeploy needed:**
```typescript
// rez-backend-master/src/models/WalletConfig.ts
// Path: walletConfig.priveProgramConfig.featureFlags
// Checked via: requireFeatureFlag('flagName') middleware
```

**2. Environment Variables (.env) — deploy-time, requires redeploy:**
```bash
# rez-backend-master/.env
FEATURE_BIZONE_MERCHANT=false
FEATURE_PRIVE_CAMPAIGNS=false
```

**Rule:** Use MongoDB flags for features that need to be toggled quickly (anti-fraud, A/B tests). Use env vars for infrastructure-level toggles that need to go through a deploy.

---
---

# COMPLETE FEATURE FLAG REGISTER

---

## FLAG-01 · `priveCampaignsEnabled`
**Type:** MongoDB (WalletConfig featureFlags)
**Default:** `false`
**Phase:** 3

**What it gates:**
- `GET/POST /api/prive/campaigns/*` — all user-facing campaign routes
- `GET/POST /api/merchant/prive/*` — all merchant campaign routes
- Campaign list section in `app/prive/campaigns/index.tsx`
- Campaign join/submit buttons

**How it's checked in backend:**
```typescript
// In priveCampaignRoutes.ts:
const requireFeatureFlag = (flagName: string) => async (req, res, next) => {
  const config = await WalletConfig.findOne({ singleton: true }).lean();
  const flags = config?.priveProgramConfig?.featureFlags as Record<string, boolean> | undefined;
  if (!flags?.[flagName]) {
    return res.status(403).json({ error: 'FEATURE_NOT_ENABLED', message: 'This feature is not yet available.' });
  }
  next();
};

// Apply to ALL campaign routes:
router.use(requireFeatureFlag('priveCampaignsEnabled'));
```

**How it's checked in frontend:**
```typescript
// nuqta-master/hooks/usePriveEligibility.ts — add:
const { data: config } = await apiClient.get('/api/prive/program-config/public');
const campaignsEnabled = config?.featureFlags?.priveCampaignsEnabled ?? false;
// Pass to PriveSectionContainer — show "Coming Soon" if false
```

**Admin control:** `rez-admin-main/app/(dashboard)/prive.tsx` → Feature Flags tab → toggle "Campaign System"

**Turn ON when:** All Phase 3 tasks (PRIVE-01 through PRIVE-08) pass QA, admin submission queue is live, at least 3 test campaigns created in staging.

---

## FLAG-02 · `bizoneMerchantEnabled`
**Type:** Environment variable
**Default:** `false`
**Phase:** 4

**Location:** `rez-backend-master/.env`
```bash
FEATURE_BIZONE_MERCHANT=false
```

**What it gates:**
- `POST /api/merchant/auth/register` — allow new merchant registrations
- Merchant listing visibility to users (stores need to be approved by admin)
- BiZone merchant app access

**How it's checked:**
```typescript
// rez-backend-master/src/merchantroutes/auth.ts:
// In the register route handler:
if (process.env.FEATURE_BIZONE_MERCHANT !== 'true') {
  return res.status(503).json({ 
    error: 'SERVICE_UNAVAILABLE', 
    message: 'Merchant onboarding is not yet open in your area.' 
  });
}
```

**Turn ON when:** BiZone P1 screens (BZ-01 through BZ-09) pass QA, admin merchant approval workflow is live, at least 5 test merchants onboarded in staging.

---

## FLAG-03 · `socialCashbackEnabled`
**Type:** MongoDB (WalletConfig featureFlags)
**Default:** `false`
**Phase:** 5

**What it gates:**
- Social Cashback banner in `app/store/[id].tsx`
- Mall brand social cashback section
- `Store.socialCashback.enabled` field is checked before showing banner

**Admin control:** `admin/(dashboard)/prive.tsx` → Social Cashback Settings

**Turn ON when:** Phase 5 Mall Social Cashback complete and tested, at least 2 Mall brands have configured social cashback budgets.

---

## FLAG-04 · `dailyCheckinEnabled`
**Type:** MongoDB (WalletConfig featureFlags)
**Default:** `false`
**Phase:** 6

**What it gates:**
- Daily check-in card in `NearUTabContent.tsx`
- `POST /api/activities/checkin` route

**Admin control:** `admin/(dashboard)/daily-checkin-config.tsx`

**Turn ON when:** NEU-02 complete, checkin route tested, coin amounts configured in admin.

---

## FLAG-05 · `mapViewEnabled`
**Type:** MongoDB (WalletConfig featureFlags)
**Default:** `false`
**Phase:** 6

**What it gates:**
- Map icon in explore section
- `app/explore/map.tsx` route

**Turn ON when:** NEU-03 complete, map performance tested on 500+ store pins without lag.

---

## FLAG-06 · `billSplittingEnabled`
**Type:** MongoDB (WalletConfig featureFlags)
**Default:** `false`
**Phase:** 6

**What it gates:**
- Bill Split option in wallet
- `app/wallet/bill-split.tsx`

**Turn ON when:** NEU-04 complete, backend split route tested end-to-end.

---

## FLAG-07 · `storiesRowEnabled`
**Type:** MongoDB (WalletConfig featureFlags)
**Default:** `false`
**Phase:** 6

**What it gates:**
- `StoriesRow` component in home tab
- When false: shows old WhatsNewBadge

**Turn ON when:** NEU-01 complete, at least 5 What's New stories exist.

---

## FLAG-08 · Coin Kill Switch (not a flag — emergency control)
**Type:** MongoDB (WalletConfig coinManagement.globalKillSwitch)
**Default:** `active: false`
**Phase:** Admin only

**This is NOT a feature flag — it's an emergency brake.**

```typescript
// In coinService.ts — check at start of every coin issuance:
const killSwitch = config?.coinManagement?.globalKillSwitch;
if (killSwitch?.active) {
  const isPausedType = killSwitch.pausedTypes?.includes(coinType);
  if (isPausedType || killSwitch.pausedTypes?.length === 0) {
    logger.warn('Coin issuance blocked by kill switch', { coinType, reason: killSwitch.reason });
    throw new Error('COIN_ISSUANCE_PAUSED');
  }
}
```

**Admin control:** `admin/(dashboard)/coin-overview.tsx` → Emergency Kill Switch

---
---

# DEPLOYMENT CHECKLIST

Use this checklist before every production deploy. Print it. Check it.

---

## PRE-DEPLOY (before every deploy, any phase)
- [ ] All new environment variables added to production `.env`
- [ ] New feature flags added with `default: false` in WalletConfig schema
- [ ] Database indexes created BEFORE code that queries them (see Doc 6)
- [ ] Staging deploy tested for minimum 24 hours
- [ ] Rollback plan documented: what to revert if something breaks

---

## PHASE 1 DEPLOY CHECKLIST (Week 1-2)
- [ ] `regionStore.ts` line 38 changed to `'bangalore'`
- [ ] `locationService.ts` coordinates changed to Bangalore
- [ ] `coins.tsx` replaced with redirect
- [ ] `app/deals/index.tsx` created
- [ ] `BottomNavigation.tsx` updated with `/deals` case
- [ ] All 7 niche booking files updated to use `serviceAppointmentApi`
- [ ] `streakHandler.ts` updated with `store_payment_confirmed` mapping
- [ ] `gamificationEventBus.ts` EventType union updated
- [ ] `storePaymentController.ts` emit added after commitTransaction
- [ ] `UserStreak.ts` 'savings' added to enum
- [ ] Staging: test streak fires after a store payment
- [ ] Staging: test booking goes to correct endpoint
- [ ] Staging: test Deals tab renders
- [ ] Staging: test coin button goes to wallet-screen
- [ ] No regression: restaurant table booking still works
- [ ] No regression: existing wallet balance intact

---

## PHASE 2 DEPLOY CHECKLIST (Week 3)
- [ ] `geocodingService.ts` returns `neighbourhood` field
- [ ] `location.types.ts` has optional `neighbourhood?` field
- [ ] `LocationDisplay.tsx` checks neighbourhood before city
- [ ] `serviceabilityCheck.ts` utility created
- [ ] `(tabs)/index.tsx` calls serviceability check after location load
- [ ] `NearUTabContent.tsx` Coming Soon banner added
- [ ] Region cleanup: china removed, dubai = coming soon
- [ ] Backend `regions.ts` china.isActive = false
- [ ] Staging: verify neighbourhood shows for BTM Layout
- [ ] Staging: test Coming Soon banner in area with no stores
- [ ] Staging: verify China not accessible via API

---

## PHASE 3 DEPLOY CHECKLIST (Weeks 3-6)

### Step 1 — Backend only (DO NOT set flag to true yet):
- [ ] `PriveCampaign.ts` model created and exported from `models/index.ts`
- [ ] `PrivePostSubmission.ts` model created and exported
- [ ] All indexes created (see Doc 6 DB-04, DB-05 index list)
- [ ] `priveCampaignRoutes.ts` created with `requireFeatureFlag('priveCampaignsEnabled')`
- [ ] Routes registered in `config/routes.ts`
- [ ] `merchantroutes/priveModule.ts` created
- [ ] `'prive_campaign'` added to RewardType enum
- [ ] `WalletConfig.featureFlags.priveCampaignsEnabled` field added (default: false)
- [ ] Unit tests passing: `npm test -- --grep "prive-campaign"`
- [ ] Postman collection tested: all 12 routes return expected responses
- [ ] Admin route `GET /api/admin/prive/campaign-submissions` created
- [ ] `prive-submissions.tsx` admin screen created

### Step 2 — Frontend (DO NOT set flag yet):
- [ ] `services/priveCampaignApi.ts` created
- [ ] `app/prive/campaigns/index.tsx` created — shows "Coming Soon" when flag is false
- [ ] `app/prive/campaigns/[id].tsx` created
- [ ] `app/prive/campaigns/submit.tsx` created
- [ ] `app/prive/campaigns/status.tsx` created
- [ ] `app/prive/earnings.tsx` created
- [ ] PriveProgressRing connected to real `score` from API

### Step 3 — QA on staging:
- [ ] Set `priveCampaignsEnabled = true` in STAGING WalletConfig
- [ ] End-to-end test: create campaign (merchant) → admin approve campaign → user joins → user submits → admin approves submission → cashback credited to user wallet
- [ ] Test: duplicate submission rejected (E11000)
- [ ] Test: tier-insufficient error shown correctly
- [ ] Test: budget exhaustion prevents over-approval
- [ ] QA sign-off from product

### Step 4 — Production:
- [ ] Deploy all backend + frontend changes (flag still false in prod)
- [ ] Create 3 real test campaigns in production (internal team only)
- [ ] Set `priveCampaignsEnabled = true` in production WalletConfig
- [ ] Monitor: watch error logs for 2 hours after activation
- [ ] Monitor: check coin issuance dashboard for anomalies

---

## PHASE 4 DEPLOY CHECKLIST (Weeks 4-6)

### Backend:
- [ ] `GET /api/merchant/customers/appointments` route created (or verified)
- [ ] `ServiceAppointment` model has all required indexes (Doc 6 DB-08)
- [ ] Verify `GET /api/merchant/dashboard` returns all required fields (Doc 4 P4-02)
- [ ] Verify `POST /api/store-payment/create-bill` works correctly
- [ ] WalletConfig `coinManagement` section added (Doc 6 DB-09)

### BiZone frontend:
- [ ] Merchant signup → business details → success flow complete
- [ ] Dashboard with all 6 stat cards wired to API
- [ ] Simple POS: product → cart → QR → payment → success
- [ ] Offline POS: works in airplane mode, syncs on reconnect
- [ ] Orders: real-time updates, status flow complete
- [ ] Create Offer: all 5 types, pending approval status
- [ ] Appointments: list and calendar for service merchants
- [ ] Wallet: balance, withdrawal request
- [ ] Reviews: list, reply, flag

### Admin:
- [ ] Campaign approval queue (`campaign-approval.tsx`) working
- [ ] Merchant approval workflow: admin approves → store goes live
- [ ] `coin-overview.tsx` with kill switch

### Set flag:
- [ ] Set `FEATURE_BIZONE_MERCHANT=true` in staging `.env`
- [ ] Full merchant onboarding flow tested by internal team
- [ ] Minimum 5 test merchants onboarded in staging
- [ ] QA sign-off
- [ ] Set `FEATURE_BIZONE_MERCHANT=true` in production
- [ ] Monitor: merchant signup rate, POS transaction success rate

---

## PHASE 6 DEPLOY CHECKLIST (Weeks 9-10)
- [ ] Stories Row: `storiesRowEnabled = false` until 5+ stories exist
- [ ] Stories Row: set `storiesRowEnabled = true` after stories created
- [ ] Daily Check-in: `dailyCheckinEnabled = false` until coin config done
- [ ] Daily Check-in: admin configures rewards in `daily-checkin-config.tsx`
- [ ] Daily Check-in: set `dailyCheckinEnabled = true`
- [ ] Map View: `mapViewEnabled = false` until performance tested
- [ ] Map View: performance test with 500+ merchant pins
- [ ] Map View: set `mapViewEnabled = true` if <2 second load time

---
---

# ROLLBACK PROCEDURES

### If a feature causes errors after deployment:

**For MongoDB feature flags (instant rollback, no redeploy):**
```javascript
// From MongoDB Atlas console or admin panel:
db.walletconfigs.updateOne(
  { singleton: true },
  { $set: { 'priveProgramConfig.featureFlags.priveCampaignsEnabled': false } }
)
// Feature disabled in < 30 seconds, no redeploy needed
```

**For environment variable flags (requires redeploy):**
```bash
# Set FEATURE_BIZONE_MERCHANT=false in .env
# Redeploy backend (5-10 minutes)
```

**For code bugs (full rollback):**
```bash
# Git revert to previous tag:
git revert HEAD --no-edit
git push origin main
# CI/CD deploys previous version
```

### Emergency: coin issuance exploit detected
```javascript
// From admin panel (coin-overview.tsx) — or directly in MongoDB:
db.walletconfigs.updateOne(
  { singleton: true },
  { $set: { 
    'coinManagement.globalKillSwitch.active': true,
    'coinManagement.globalKillSwitch.pausedTypes': ['promo'],  // or all types
    'coinManagement.globalKillSwitch.reason': 'Promo coin farming exploit detected',
    'coinManagement.globalKillSwitch.activatedAt': new Date(),
    'coinManagement.globalKillSwitch.expiresAt': new Date(Date.now() + 24*60*60*1000)
  }}
)
// Coin issuance for 'promo' type stops within 1 minute (cache refresh)
```

---

# ENVIRONMENT VARIABLES REFERENCE

All env vars that must exist in production before any Phase 3-4 deploy:

```bash
# rez-backend-master/.env

# Existing (verify these are correct):
MONGODB_URI=<production mongo URI>
JWT_SECRET=<production secret>
CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>

# Phase 4 — BiZone:
FEATURE_BIZONE_MERCHANT=false          # Set true when BiZone ready

# Useful for staging/production split:
NODE_ENV=production
API_PREFIX=/api
```

---

*REZ Feature Flag Register + Deployment Checklist (Doc 7) · March 2026*
*8 feature flags · Complete deploy checklists for all 4 phases · Emergency rollback procedures*
