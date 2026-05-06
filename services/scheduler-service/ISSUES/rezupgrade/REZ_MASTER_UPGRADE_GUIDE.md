# REZ — MASTER UPGRADE GUIDE
## Every Upgrade · Exact Code Location · Problem · Solution · Cross-System Links
### March 2026 | Based on Full Codebase Audit

---

## HOW TO USE THIS DOCUMENT

Each upgrade entry follows this format:
- **ID** — Unique reference (U-01, U-02...)
- **Priority** — 🔴 Critical / 🟠 High / 🟡 Medium
- **Files** — Exact paths in each repo
- **Problem** — What is broken or missing
- **Upgrade** — Exactly what to build/fix
- **Connects To** — How this links to merchant, admin, or other systems
- **Backend API** — Relevant endpoint(s)

---

## REPOS REFERENCE
```
REZ App (React Native):  nuqta-master/
Backend:                 rez-backend-master/
Admin:                   rez-admin-main/
v2 Vision (React Web):   rez_v2/src/
```

---
---

# PHASE 1 — BUG FIXES (Do First — 2 Weeks)

These are live bugs hitting every user today. Ship before building anything new.

---

## U-01 · Default Region: Dubai Instead of India
**Priority:** 🔴 Critical

### Files
```
nuqta-master/stores/regionStore.ts                    Line 38
nuqta-master/services/locationService.ts              Lines 30–34, 497–501
nuqta-master/.env (or .env.example)
```

### Problem
`stores/regionStore.ts` line 38: `const DEFAULT_REGION: RegionId = 'dubai'`
`locationService.ts` lines 30–34 hardcode Dubai coordinates `(25.2048, 55.2708)` as fallback.
Every new user without stored preferences sees AED currency and Dubai defaults.
Backend `src/config/regions.ts` correctly defaults to `bangalore` — frontend contradicts it.

### Upgrade
```typescript
// stores/regionStore.ts line 38:
const DEFAULT_REGION: RegionId = 'bangalore';  // was 'dubai'

// services/locationService.ts lines 30–34:
defaultLocation: {
  latitude:  12.9716,   // was 25.2048 (Dubai)
  longitude: 77.5946,   // was 55.2708 (Dubai)
},
defaultLocationName: 'Bangalore, India',  // was 'Dubai, UAE'

// lines 497–501 (fallback city):
city:    'Bangalore',   // was 'Dubai'
state:   'Karnataka',   // was 'Dubai'
country: 'India',
```

### Connects To
- **Admin:** No admin change needed — backend `src/config/regions.ts` already has `DEFAULT_REGION = 'bangalore'`
- **Merchant:** Merchant location defaults will also be correct after this fix
- **Currency:** `formatPrice()` in `regionStore.ts` will correctly show ₹ for all new users

---

## U-02 · Location Shows City Not Neighbourhood
**Priority:** 🔴 Critical

### Files
```
rez-backend-master/src/services/geocodingService.ts    Lines 79–107 (Google), 128–145 (OpenCage)
nuqta-master/types/location.types.ts                   Lines 4–11 (LocationAddress interface)
nuqta-master/components/location/LocationDisplay.tsx   Lines 307–341 (getLocationText)
```

### Problem
`geocodingService.ts` extracts `locality` from Google Maps address_components → city = "Bangalore".
`sublocality_level_1` component (which contains "BTM Layout", "HSR Layout") is completely ignored.
`LocationAddress` interface has no `neighbourhood` field.
Header always shows "Bangalore" regardless of exact area.

### Upgrade
**Step 1 — Backend geocodingService.ts:**
```typescript
// In reverseGeocodeGoogle() — add neighbourhood extraction BEFORE city:
let neighbourhood = '';
addressComponents.forEach((component: any) => {
  const types = component.types;
  if (types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood')) {
    if (!neighbourhood) neighbourhood = component.long_name;
  } else if (types.includes('locality') || ...) { city = ...; }
  ...
});
return { ...existing, neighbourhood: neighbourhood || undefined };

// In reverseGeocodeOpenCage():
const neighbourhood = components.neighbourhood || components.suburb 
                    || components.quarter || undefined;
return { ...existing, neighbourhood };
```

**Step 2 — Frontend location.types.ts:**
```typescript
export interface LocationAddress {
  address: string;
  neighbourhood?: string;  // ADD
  city: string;
  ...
}
```

**Step 3 — LocationDisplay.tsx:**
```typescript
// Show neighbourhood first, fall back to city:
if (addr.neighbourhood) return addr.neighbourhood;  // ADD
if (addr.city) return addr.city;
```

### Connects To
- **Admin:** `admin/(dashboard)/hotspot-areas.tsx` — admin-defined hotspot areas will now show correct neighbourhood names in user-facing UI
- **Merchant:** Store discovery (`/api/stores/nearby`) uses coordinates, not area name — not directly affected
- **Near U:** The "Coming Soon in [Area]" banner (U-04) uses this neighbourhood name

---

## U-03 · Coin Button → Static Images Instead of Wallet
**Priority:** 🔴 Critical

### Files
```
nuqta-master/app/(tabs)/index.tsx                     Lines 455–461 (handleCoinPress)
nuqta-master/components/homepage/HomeHeader.tsx        Lines 164–170 (coin onPress)
nuqta-master/app/coins.tsx                             Full file (replace with redirect)
```

### Problem
`handleCoinPress` navigates to `/coins`. `coins.tsx` imports 4 static PNG images (`card1.png`–`card4.png`) and renders them. No API call. No live data. The actual wallet is at `/wallet-screen` with full live data.

### Upgrade
```typescript
// app/(tabs)/index.tsx line 457:
setTimeout(() => router.push('/wallet-screen'), 50);  // was '/coins'

// HomeHeader.tsx line 166:
router.push('/wallet-screen');  // was '/coins'

// app/coins.tsx — replace entire file:
import { Redirect } from 'expo-router';
export default function CoinsRedirect() {
  return <Redirect href="/wallet-screen" />;
}
```

### Connects To
- **Wallet:** `wallet-screen.tsx` uses `walletApi` → `GET /api/wallet/balance` — live data
- **Admin:** `admin/(dashboard)/wallet.tsx`, `user-wallets.tsx` — admin sees same wallet data
- **Merchant:** When merchant issues coins to user, user sees updated balance immediately in wallet-screen

---

## U-04 · Deals Tab 404
**Priority:** 🔴 Critical

### Files
```
nuqta-master/app/deals/                               [MISSING index.tsx]
nuqta-master/components/navigation/BottomNavigation.tsx  getActiveTab() function
```

### Problem
`app/deals/` directory exists with `[campaignId].tsx` but no `index.tsx`. Every user who taps the Deals tab gets a 404/blank screen. `BottomNavigation.tsx` `getActiveTab()` function has no case for `/deals` route.

### Upgrade
**Create `app/deals/index.tsx`:**
```typescript
import { bonusZoneApi } from '@/services/bonusZoneApi';
import { campaignsApi } from '@/services/campaignsApi';

export default function DealsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const TABS = ['All', 'Cashback', 'Bank', '2× Coins', 'Festival'];

  useEffect(() => {
    Promise.all([
      bonusZoneApi.getBonusCampaigns(),
      campaignsApi.getActiveCampaigns()
    ]).then(([bonus, active]) => {
      setCampaigns([...bonus.data, ...active.data]);
    });
  }, []);
  // Render tabs + BonusZoneCard list
}
```

**Update BottomNavigation.tsx `getActiveTab()`:**
```typescript
case '/deals':
case '/deals/':
case '/bonus-zone':
  return 'deals';
```

### Connects To
- **Backend:** `GET /api/offers/bonus-zone` + `GET /api/campaigns/active`
- **Admin:** `admin/(dashboard)/bonus-zone.tsx` — admin creates deals that appear here
- **Admin:** `admin/(dashboard)/campaigns.tsx` — campaign creation flows to this page
- **Merchant:** Merchants create offers → admin approves → appears in Deals tab

---

## U-05 · Savings Streak Not Triggered by Payments
**Priority:** 🔴 Critical

### Files
```
rez-backend-master/src/events/gamificationEventBus.ts   (add event type)
rez-backend-master/src/models/UserStreak.ts              (add 'savings' type)
rez-backend-master/src/services/streakService.ts         (add savings milestones)
rez-backend-master/src/events/handlers/streakHandler.ts  (map event → streak)
rez-backend-master/src/controllers/storePaymentController.ts  (emit after commit)
```

### Problem
`streakHandler.ts` maps events to streak types but `store_payment_confirmed` is not in the mapping. Users pay in stores, streak never increments. `UserStreak.ts` enum has no `'savings'` type.

### Upgrade
```typescript
// 1. gamificationEventBus.ts — add to EventType union:
| 'store_payment_confirmed'

// 2. UserStreak.ts — add savings to streakType enum:
streakType: { enum: [...existing, 'savings'] }

// 3. streakService.ts — add savings milestones array:
savings: [
  { day: 3,  coins: 20,  label: 'Saving Starter' },
  { day: 7,  coins: 50,  label: 'Week Warrior',  multiplier: 1.05 },
  { day: 21, coins: 150, label: 'Habit Builder',  multiplier: 1.10 },
  { day: 60, coins: 500, label: 'Savings Elite',  multiplier: 1.20 },
]

// 4. streakHandler.ts — add mapping:
case 'store_payment_confirmed':
  await handleStreakUpdate(userId, 'savings', metadata);
  break;

// 5. storePaymentController.ts — after commitTransaction() line 1342:
gamificationEventBus.emit('store_payment_confirmed', {
  userId: transaction.userId,
  metadata: { storeId, amount: transaction.amount, source: 'store_payment' }
});
```

### Connects To
- **Admin:** `admin/(dashboard)/leaderboard-config.tsx` — streak leaderboard uses savings streak data
- **Admin:** `admin/(dashboard)/gamification-economy.tsx` — configure streak milestone coin amounts
- **Merchant:** When customer pays at merchant → streak fires → customer earns streak bonus → merchant sees engagement stats in merchant dashboard
- **User:** `StreaksGamification.tsx` component reads from `GET /api/streak/user` — will auto-update after fix

---

## U-06 · All 7 Service Booking Pages Use Wrong Endpoint
**Priority:** 🔴 Critical

### Files — 7 files need the SAME fix
```
nuqta-master/app/beauty/BookAppointment.tsx
nuqta-master/app/fitness/book/[storeId].tsx         (BookClass)
nuqta-master/app/healthcare/BookDoctor.tsx
nuqta-master/app/MainCategory/[slug]/BookService.tsx (Home Services)
nuqta-master/app/fashion/TryAndBuy.tsx
nuqta-master/app/entertainment/BookTickets.tsx
nuqta-master/app/education/EnrollClass.tsx
```

### Problem
All 7 pages submit to `POST /api/table-bookings` (restaurant table reservation endpoint).
`serviceAppointmentApi.ts` is fully written and targets `POST /api/service-appointments` — the correct endpoint with proper schema — but is never imported by any of these pages.

### Upgrade (same pattern for all 7 files)
```typescript
// REMOVE in each file:
import { tableBookingApi } from '@/services/tableBookingApi';

// ADD in each file:
import serviceAppointmentApi from '@/services/serviceAppointmentApi';

// REPLACE submit call:
// was: await tableBookingApi.create({ ...data, specialRequests: serviceType })
// now:
await serviceAppointmentApi.create({
  storeId,
  serviceType: selectedService,  // field name varies per niche
  date: selectedDate,
  time: selectedTime,
  notes: notes,
});
```

### Connects To
- **Backend:** `POST /api/service-appointments` — correct schema with serviceType, proper model
- **Merchant:** After fix, merchants can see service appointments in their BiZone dashboard (currently they see zero because data goes to wrong collection)
- **Admin:** `admin/(dashboard)/orders.tsx` shows service appointments correctly after fix
- **Coins:** `rewardEngine.issue()` for service booking coins fires correctly from service-appointments endpoint

---

## U-07 · Profile Drawer: Wrong Default + Hardcoded "Level 1"
**Priority:** 🟠 High

### Files
```
nuqta-master/components/profile/ProfileMenuModal.tsx   Line 39, Lines 42–74, Lines 487–694
nuqta-master/data/profileData.ts                       Line 82, missing change-password entry
nuqta-master/types/profile.types.ts                    Lines 4–19
nuqta-master/contexts/ProfileContext.tsx               Lines 59–84
```

### Problem
1. `MODAL_WIDTH = SCREEN_WIDTH * 0.88` — too wide, feels like modal not side panel
2. `COLORS.primary = lightMustard` — gold→navy gradient looks muddy
3. Lines 661 + 685: `"Level 1 • Earn rewards"` hardcoded — never reads real creator tier
4. `profileData.ts` line 82: route `/Store` (capital S) — case-sensitive 404 on some platforms
5. No Change Password link in drawer — the page exists but is unreachable
6. `ProfileContext.tsx` tier mapping missing — `priveTier` never mapped

### Upgrade (summary — full code in REZ_Profile_Complete_Update_Guide.md)
```typescript
// ProfileMenuModal.tsx line 39:
const MODAL_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 360);

// COLORS block — change header to dark navy:
primary:     '#FFCD57',
headerTop:   '#1a3a52',
headerBottom:'#0D1F2D',
surface:     '#0D1F2D',  // dark menu background

// Lines 661 + 685 — replace hardcoded "Level 1":
const creatorLevelNum = (user as any)?.creatorLevel ?? null;
const tierLabel = creatorLevelNum === 3 ? 'Ambassador'
  : creatorLevelNum === 2 ? 'Influencer' : 'Partner';
// show: creatorLevelNum ? `${tierLabel} · Level ${creatorLevelNum}` : 'Join Partner Program'

// profileData.ts line 82:
route: '/store',  // lowercase

// profileData.ts — add change_password item after 'account':
{ id: 'change_password', title: 'Change Password', icon: 'key-outline',
  route: '/account/change-password', isEnabled: true, showArrow: true }

// ProfileContext.tsx — add tier mapping:
tier: (backendUser as any).priveTier === 'elite' ? 'Privé Elite'
  : (backendUser as any).priveTier === 'premium' ? 'Privé'
  : 'REZ Member',
creatorLevel: (backendUser as any).creatorLevel || null,
```

### Connects To
- **Prive Backend:** `GET /api/prive/access` → returns `tier`, `accessSource`, `score`
- **Admin:** `admin/(dashboard)/prive.tsx` controls who gets Privé → affects tier badge shown
- **Merchant:** Creator level comes from merchant's "Creator Invitation" action in BiZone

---

## U-08 · No Profile Photo Upload
**Priority:** 🟠 High

### Files
```
nuqta-master/app/account/profile.tsx                  Lines 214–222 (avatar section)
nuqta-master/hooks/useProfile.ts                      uploadProfilePicture() — built, never called
rez-backend-master/src/routes/user/profile.ts         PUT /user/profile/avatar — check exists
```

### Problem
Avatar shows only text initials. Zero `ImagePicker` code anywhere in the app. `useProfile.ts` has `uploadProfilePicture(imageUri)` fully implemented calling `profileApi.uploadProfilePicture()` but no UI ever calls it.

### Upgrade
```typescript
// app/account/profile.tsx — add handler:
import * as ImagePicker from 'expo-image-picker';

const handleAvatarPress = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true, aspect: [1, 1], quality: 0.75,
  });
  if (!result.canceled && result.assets[0]) {
    setIsUploadingPhoto(true);
    const formData = new FormData();
    formData.append('profileImage', {
      uri: result.assets[0].uri, type: 'image/jpeg', name: 'profile.jpg'
    } as any);
    await apiClient.put('/user/profile/avatar', formData,
      { headers: { 'Content-Type': 'multipart/form-data' } });
    setAvatarUri(result.assets[0].uri);
    setIsUploadingPhoto(false);
  }
};

// Wrap existing avatar View in Pressable onPress={handleAvatarPress}
// Show CachedImage if avatarUri or user.profile?.avatar exists
// Add camera badge overlay + spinner during upload
```

### Connects To
- **Backend:** `PUT /api/user/profile/avatar` → uploads to Cloudinary via `CloudinaryService.ts`
- **Admin:** `admin/(dashboard)/photo-moderation.tsx` — admin can review/remove inappropriate profile photos
- **Drawer:** `ProfileMenuModal.tsx` already checks `user?.avatar` — will show photo automatically once uploaded

---

## U-09 · Notification History Page Never Loads
**Priority:** 🟠 High

### Files
```
nuqta-master/app/account/notification-history.tsx    Full file (no API call exists)
```

### Problem
Page renders empty state "No Notifications" always. Zero API call. Backend has `GET /api/notifications/history`.

### Upgrade
```typescript
// Add to notification-history.tsx:
import apiClient from '@/services/apiClient';

const [notifications, setNotifications] = useState<any[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  apiClient.get('/notifications/history', { limit: 50, page: 1 })
    .then((res: any) => {
      if (res.success) setNotifications(res.data?.notifications || []);
    })
    .finally(() => setLoading(false));
}, []);
```

### Connects To
- **Backend:** `GET /api/notifications/history` — already exists
- **Admin:** `admin/(dashboard)/notification-management.tsx` — admin sends notifications → user sees them here

---

## U-10 · Region Cleanup: Remove China, Dubai = Coming Soon
**Priority:** 🟠 High

### Files
```
nuqta-master/stores/regionStore.ts                    Lines type RegionId, isValidRegion()
nuqta-master/components/RegionSelector.tsx            REGIONS array
nuqta-master/components/profile/ProfileMenuModal.tsx  REGIONS_DATA array
rez-backend-master/src/config/regions.ts              china.isActive, dubai.isActive
```

### Problem
China region is fully active everywhere. Dubai shows as live. Both are not operational. A user can switch to China and see CNY prices. User switching to Dubai sees AED.

### Upgrade
```typescript
// regionStore.ts:
export type RegionId = 'bangalore' | 'dubai';  // remove 'china'
function isValidRegion(r: string): r is RegionId {
  return ['bangalore', 'dubai'].includes(r);
}

// RegionSelector.tsx:
const REGIONS = [
  { id: 'bangalore', name: 'India', flag: '🇮🇳', description: 'Bangalore, Mumbai, Delhi & more' },
  { id: 'dubai',     name: 'Dubai', flag: '🇦🇪', description: 'UAE — Coming Soon', comingSoon: true },
];
// Disable Dubai tap, show "Coming Soon" badge

// backend regions.ts:
china:  { ...existing, isActive: false },
dubai:  { ...existing, isActive: false },
// getActiveRegions() already filters by isActive
```

### Connects To
- **Backend:** `GET /api/location/regions` will return only India after setting `isActive: false`
- **Admin:** `admin/(dashboard)/settings.tsx` — admin can re-activate Dubai when ready
- **Merchant:** Merchant onboarding region selection will show only India

---
---

# PHASE 2 — LOCATION SYSTEM (Week 3)

---

## U-11 · Auto-Switch to Mall When Area Not Serviceable
**Priority:** 🟠 High

### Files
```
nuqta-master/utils/serviceabilityCheck.ts             [CREATE NEW]
nuqta-master/app/(tabs)/index.tsx                     Add useEffect after location loads
nuqta-master/components/homepage/NearUTabContent.tsx  Add Coming Soon banner
```

### Problem
Users in areas with zero REZ Near U stores see a completely blank Near U tab. No explanation, no redirection. They assume the app is broken and never return.

### Upgrade
**Create `utils/serviceabilityCheck.ts`:**
```typescript
export async function checkAreaServiceability(lat: number, lng: number) {
  try {
    const res = await apiClient.get('/stores/nearby', 
      { lat, lng, radius: 5000, limit: 1 });
    const count = res.data?.stores?.length ?? 0;
    return { isServiceable: count > 0, suggestedMode: count > 0 ? 'near-u' : 'mall' };
  } catch {
    return { isServiceable: true, suggestedMode: 'near-u' };
  }
}
```

**In `(tabs)/index.tsx` — after location loads:**
```typescript
useEffect(() => {
  if (!currentLocation?.coordinates || serviceabilityChecked) return;
  checkAreaServiceability(lat, lng).then(result => {
    setIsAreaServiceable(result.isServiceable);
    setServiceabilityChecked(true);
    if (!result.isServiceable && activeTab === 'near-u') {
      setActiveTab('mall');  // auto-switch
    }
  });
}, [currentLocation?.coordinates]);
```

**In `NearUTabContent.tsx` — add banner:**
```tsx
{!isAreaServiceable && !bannerDismissed && (
  <View style={bannerStyles}>
    <Text>📍 Near U is coming soon in {areaName || 'your area'}</Text>
    <Text>Shop from top brands on REZ Mall meanwhile.</Text>
    <Pressable onPress={() => setActiveTab('mall')}>Mall →</Pressable>
    <Pressable onPress={() => setBannerDismissed(true)}>✕</Pressable>
  </View>
)}
```

### Connects To
- **Backend:** `GET /api/stores/nearby` — already exists, uses store coordinates
- **Admin:** `admin/(dashboard)/hotspot-areas.tsx` — admin defines serviceable hotspot zones; this check respects those zones
- **Merchant:** When a new merchant joins in a new area → banner disappears for users in that area automatically

---
---

# PHASE 3 — PRIVÉ SOCIAL CASHBACK (Month 1-2)

The single biggest competitive differentiator. Cherry + WYLD combined but with local stores.

---

## U-12 · Privé Phase 1: Brand Campaign System
**Priority:** 🔴 Critical for competitive positioning

### Files to CREATE (frontend)
```
nuqta-master/app/prive/campaigns/index.tsx            Campaign list
nuqta-master/app/prive/campaigns/[id].tsx             Campaign detail (task spec)
nuqta-master/app/prive/campaigns/submit.tsx           Post submission form
nuqta-master/app/prive/campaigns/status.tsx           Verification status
nuqta-master/app/prive/earnings.tsx                   Earnings from campaigns
nuqta-master/app/prive/tier.tsx                       Tier progress
nuqta-master/services/priveCampaignApi.ts             [CREATE] API calls
```

### Files to CREATE (backend)
```
rez-backend-master/src/models/PriveCampaign.ts        [CREATE] campaign model
rez-backend-master/src/models/PrivePostSubmission.ts  [CREATE] post submission model
rez-backend-master/src/routes/priveCampaignRoutes.ts  [CREATE] user-facing campaign routes
rez-backend-master/src/controllers/priveCampaignController.ts
rez-backend-master/src/merchantroutes/priveModule.ts  [CREATE] merchant campaign setup
```

### Problem
Privé backend has access control, missions, offers, concierge — but has zero "brand campaign" concept (buy product → post on Instagram → earn ₹ cashback). This is the entire Cherry/WYLD model. Both `PriveMission` and `PriveOffer` models exist but don't cover the UGC purchase-post-earn loop.

### Upgrade

**New `PriveCampaign` model:**
```typescript
// rez-backend-master/src/models/PriveCampaign.ts
{
  merchantId:       { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  title:            String,
  description:      String,
  taskType:         { enum: ['dine_post', 'buy_post', 'visit_post', 'event_post'] },
  requirements: {
    minPurchaseAmount: Number,           // e.g. ₹500
    postTypes:         [String],         // ['story', 'reel', 'post']
    mustTagBrand:      Boolean,
    minimumFollowers:  Number,           // default 500
    hashtagRequired:   String,
  },
  reward: {
    coinAmount:       Number,            // instant on purchase
    cashbackPercent:  Number,            // unlocked after post verification
    cashbackCap:      Number,            // max ₹ per user
  },
  slots:            Number,              // max users
  slotsUsed:        Number,
  budget:           Number,              // total ₹ merchant commits
  budgetUsed:       Number,
  validFrom:        Date,
  validTo:          Date,
  status:           { enum: ['draft', 'active', 'paused', 'completed'] },
  minPriveTier:     { enum: ['entry', 'silver', 'gold', 'elite'] },
}
```

**New `PrivePostSubmission` model:**
```typescript
{
  campaignId:       { ref: 'PriveCampaign' },
  userId:           { ref: 'User' },
  orderId:          { ref: 'Order', optional: true },
  postUrl:          String,              // Instagram/social post URL
  postScreenshot:   String,              // Cloudinary URL
  submittedAt:      Date,
  status:           { enum: ['pending', 'approved', 'rejected', 'expired'] },
  reviewedBy:       { ref: 'AdminUser', optional: true },
  reviewedAt:       Date,
  rejectionReason:  String,
  cashbackIssued:   Boolean,            // false until approved
  cashbackAmount:   Number,
}
```

**New user-facing routes `priveCampaignRoutes.ts`:**
```typescript
GET  /api/prive/campaigns                // active campaigns for eligible user
GET  /api/prive/campaigns/:id            // campaign detail
POST /api/prive/campaigns/:id/join       // accept campaign
POST /api/prive/campaigns/:id/submit     // submit post proof
GET  /api/prive/campaigns/:id/status     // check my submission status
GET  /api/prive/earnings                 // all campaign earnings
```

**New merchant routes `merchantroutes/priveModule.ts`:**
```typescript
GET  /api/merchant/prive/campaigns               // my campaigns
POST /api/merchant/prive/campaigns               // create campaign
PUT  /api/merchant/prive/campaigns/:id           // edit campaign
POST /api/merchant/prive/campaigns/:id/pause     // pause budget
GET  /api/merchant/prive/campaigns/:id/analytics // reach, posts, ROI
GET  /api/merchant/prive/submissions             // pending post approvals
PUT  /api/merchant/prive/submissions/:id/approve
PUT  /api/merchant/prive/submissions/:id/reject
```

**Cashback flow after post approval:**
```typescript
// priveCampaignController.ts — approveSubmission():
await rewardEngine.issue({
  userId:     submission.userId,
  amount:     cashbackAmount,
  rewardType: 'prive_campaign',
  coinType:   'rez',
  source:     `prive_campaign:${campaign._id}`,
  metadata:   { campaignId, merchantId, postUrl: submission.postUrl }
});

// Also notify user via push:
await notificationService.send(userId, {
  title: '🎉 Cashback Approved!',
  body:  `₹${cashbackAmount} credited for your ${campaign.title} post`,
  type:  'prive_campaign_approved',
});
```

### Connects To
- **Admin:** `admin/(dashboard)/prive.tsx` — admin has full submission review queue, can override approvals, set tier eligibility thresholds, view campaign analytics
- **Merchant:** New `BiZone/advanced/MerchantPriveModule.jsx` (needs to be built) — merchant creates campaign, sets budget, reviews post submissions, sees ROI
- **Reward Engine:** `rewardEngine.issue()` with `rewardType: 'prive_campaign'` → `CoinTransaction` → user wallet
- **Admin Economics:** `admin/(dashboard)/economics.tsx` — platform takes commission from merchant's Social Cashback budget (configurable %)
- **Notifications:** `priveNotificationService.ts` — notify user of approval/rejection

---

## U-13 · Privé Influence Score: Make It Visible
**Priority:** 🟠 High

### Files
```
nuqta-master/hooks/usePriveEligibility.ts             Lines 71–74 (determineTier)
nuqta-master/components/prive/PriveHeaderWrapper.tsx  (add score display)
nuqta-master/components/prive/PriveProgressRing.tsx   (already exists!)
nuqta-master/app/prive/tier.tsx                       [CREATE or extend]
rez-backend-master/src/services/priveAccessService.ts Lines 36–67 (checkAccess)
```

### Problem
Prive reputation scoring engine exists in backend (`UserReputation` model, `priveAccessService.ts`). Score is calculated. But the user NEVER SEES their score — it's completely hidden. WYLD shows their score prominently (0–1000). Users don't know what to do to level up. `PriveProgressRing.tsx` component exists but isn't connected to real score data.

### Upgrade
```typescript
// hooks/usePriveEligibility.ts — expose score to UI:
const { data } = await apiClient.get('/api/prive/access');
return {
  score:       data.score,          // 0–1000
  tier:        data.tier,           // 'entry'|'silver'|'gold'|'elite'
  scoreLabel:  getScoreLabel(data.score),  // "Building" | "Strong" | "Elite"
  nextTier:    data.nextTier,
  pointsToNext:data.pointsToNext,
};

// PriveHeaderWrapper.tsx — show score ring:
<PriveProgressRing score={eligibility.score} tier={eligibility.tier} />
<Text>Your REZ Score: {eligibility.score}/1000</Text>
<Text>{eligibility.pointsToNext} points to {eligibility.nextTier}</Text>
```

### Connects To
- **Admin:** `admin/(dashboard)/prive.tsx` → `PUT /api/admin/prive/program-config/tier-thresholds` — admin sets score thresholds per tier
- **Admin:** `admin/(dashboard)/prive.tsx` → admin can view/override individual user scores
- **Campaigns:** Campaign `minPriveTier` field checks against this score tier

---
---

# PHASE 4 — BIZONE MERCHANT APP (Month 1-2, parallel with Phase 3)

Backend is 60% ready. Build the frontend at `merchant.rez.app`.

---

## U-14 · BiZone P1: Merchant Dashboard + Auth
**Priority:** 🔴 Critical — merchants are flying blind

### Files to CREATE
```
rez_v2/src/pages/BiZoneUI/auth/MerchantSignup.jsx       (v2 design exists, wire to backend)
rez_v2/src/pages/BiZoneUI/auth/MerchantBusinessDetails.jsx
rez_v2/src/pages/BiZoneUI/dashboard/MerchantDashboard.jsx
```

### Backend APIs — Already Exist
```
POST /api/merchant/auth/register        → create merchant account
POST /api/merchant/auth/login           → JWT token
GET  /api/merchant/dashboard            → revenue today, orders, coins issued
GET  /api/merchant/analytics?period=7d  → weekly stats
```

### Upgrade
Wire the already-designed v2 screens to the backend:
```typescript
// MerchantDashboard.jsx — fetch real data:
const { data } = await merchantApi.get('/dashboard');
// Show: todayRevenue, ordersToday, coinsIssued, activeOffers, 
//        pendingPayouts, topProducts[5], recentTransactions[10]
```

**Dashboard cards to show:**
- Today's Revenue (from `/dashboard`)
- Active Orders count (link to orders)
- REZ Coins issued today
- Customer visits
- Active offers count
- Pending payout amount

### Connects To
- **Admin:** `admin/(dashboard)/merchants.tsx` — admin can see all merchants, approve new signups
- **Admin:** `admin/(dashboard)/merchant-withdrawals.tsx` — admin processes payout requests
- **User:** When merchant is active on BiZone → their store appears in Near U tab for users

---

## U-15 · BiZone P1: Simple POS
**Priority:** 🔴 Critical

### Files to CREATE/WIRE
```
rez_v2/src/pages/BiZoneUI/pos/MerchantSimplePOS.jsx    (v2 design exists)
rez_v2/src/pages/BiZoneUI/pos/MerchantOfflinePOS.jsx   (v2 design exists)
```

### Backend APIs — Already Exist
```
POST /api/merchant/sync              → offline-first POS sync
POST /api/store-payment/create-bill  → create customer bill
POST /api/store-payment/qr-generate  → generate payment QR
GET  /api/merchant/products?pos=true → product catalog for POS
```

### Upgrade
The POS flow:
```
Merchant opens BiZone POS →
Search/scan product → Add to bill →
Select coin discount (if customer wants) →
Generate QR or enter phone number →
Customer scans QR in REZ app →
Payment confirmed →
Coins issued to customer →
Bill saved to backend
```

**Key implementation:**
```typescript
// MerchantSimplePOS.jsx:
// 1. Product search → GET /api/merchant/products?search=query
// 2. Build bill locally (offline-first)
// 3. On checkout → POST /api/store-payment/create-bill
// 4. Show QR for customer → POST /api/store-payment/qr-generate
// 5. Listen for payment confirmation → WebSocket or polling
// 6. On confirm → show coins issued to customer
```

### Connects To
- **User App:** `pay-in-store/enter-amount.tsx` + `pay-in-store/scan-qr.tsx` — user side of QR payment
- **Admin:** `admin/(dashboard)/orders.tsx` — every POS transaction appears as an order
- **Wallet:** `walletService.ts` — coins credited to user wallet after POS payment
- **Streak:** After POS payment → `gamificationEventBus.emit('store_payment_confirmed')` → streak increments (fix U-05)

---

## U-16 · BiZone P1: Orders Management
**Priority:** 🔴 Critical

### Files to CREATE/WIRE
```
rez_v2/src/pages/BiZoneUI/orders/MerchantOrders.jsx       (v2 design exists)
rez_v2/src/pages/BiZoneUI/orders/MerchantOrdersMultiChannel.jsx
```

### Backend APIs — Already Exist
```
GET  /api/merchant/orders?status=pending      → pending orders
GET  /api/merchant/orders?status=preparing    → in-kitchen/in-service
PUT  /api/merchant/orders/:id/status          → update order status
POST /api/merchant/orders/:id/notify-customer → push to customer
```

### Upgrade
```typescript
// MerchantOrders.jsx:
// Real-time orders via WebSocket (already in backend: gamificationSocketService.ts)
// merchant.io socket room → push new orders

// Status flow: 
// pending → accepted → preparing → ready → delivered/completed
// Each status change → customer gets push notification
// Each status change → admin sees updated order status

// Tabs: New (badge count) | Preparing | Ready | Completed | Cancelled
```

### Connects To
- **User:** `shopping/OrderTracking.tsx` — user sees live status updates from merchant
- **Admin:** `admin/(dashboard)/orders.tsx` — admin views all orders across all merchants
- **WebSocket:** `gamificationSocketService.ts` → `realTimeService.emitOrderEvent(merchantId, {...})`
- **Notifications:** `merchantNotificationService.ts` — new order push to merchant device

---

## U-17 · BiZone P1: Create Offer
**Priority:** 🔴 Critical

### Files to CREATE/WIRE
```
rez_v2/src/pages/BiZoneUI/offers/CreateOffer.jsx         (v2 design exists)
rez_v2/src/pages/BiZoneUI/offers/MerchantTodaysOffers.jsx
```

### Backend APIs — Already Exist
```
POST /api/merchant/offers           → create offer
GET  /api/merchant/offers           → my offers
PUT  /api/merchant/offers/:id       → edit offer
PATCH /api/merchant/offers/:id/status → activate/pause
```

### Upgrade
```typescript
// CreateOffer.jsx — offer types to support:
// 1. Flat discount: ₹50 off on ₹500+
// 2. % discount:   20% off today only
// 3. BOGO:         Buy 1 Get 1 on [product]
// 4. Coin multiplier: 3× coins for next 2 hours
// 5. Locked deal:  Only REZ users

// After creation → POST /api/merchant/offers
// Admin must approve before it goes live (admin/(dashboard)/offers.tsx)
// Once live → appears in Near U deals section for nearby users
```

### Connects To
- **Admin:** `admin/(dashboard)/offers.tsx` — admin approves/rejects merchant offers
- **User:** `deals/index.tsx` (U-04) — approved offers appear in Deals tab
- **User:** `store/[id].tsx` → `StoreOffersSection` — offers appear on store page
- **Bonus Zone:** `admin/(dashboard)/bonus-zone.tsx` — admin can promote merchant offer to Bonus Zone (double coins)

---

## U-18 · BiZone P1: Merchant Wallet + Payouts
**Priority:** 🔴 Critical

### Files to CREATE/WIRE
```
rez_v2/src/pages/BiZoneUI/advanced/MerchantWallet.jsx    (v2 design exists)
rez_v2/src/pages/BiZoneUI/finance/MerchantSettlementEngine.jsx
```

### Backend APIs — Already Exist
```
GET  /api/merchant/wallet                    → balance, pending, settled
GET  /api/merchant/wallet/transactions       → transaction history
POST /api/merchant/wallet/withdraw-request   → request payout
GET  /api/merchant/wallet/settlement-history → past settlements
```

### Upgrade
```typescript
// MerchantWallet.jsx:
// Show: Available balance | Pending clearance | Total earned this month
// Transactions list with: order ID, amount, commission deducted, net credited
// Withdraw button → minimum ₹500 → POST /api/merchant/wallet/withdraw-request
// Bank account linked during onboarding (MerchantBusinessDetails)
```

### Connects To
- **Admin:** `admin/(dashboard)/merchant-withdrawals.tsx` — admin processes withdrawal requests, marks as paid
- **Admin:** `admin/(dashboard)/economics.tsx` — admin sets commission rates per merchant category
- **User:** Indirectly — merchant revenue funds coin cashback economy

---

## U-19 · BiZone P2: Inventory Management
**Priority:** 🟠 High

### Files to CREATE/WIRE
```
rez_v2/src/pages/BiZoneUI/inventory/MerchantInventory.jsx
rez_v2/src/pages/BiZoneUI/inventory/MerchantLowStockAlerts.jsx
rez_v2/src/pages/BiZoneUI/advanced/MerchantProducts.jsx
```

### Backend APIs — Already Exist
```
GET    /api/merchant/products               → product list with stock
POST   /api/merchant/products               → create product
PUT    /api/merchant/products/:id           → update product
PATCH  /api/merchant/products/:id/stock     → update stock level
GET    /api/merchant/products/low-stock     → items below reorder point
```

### Connects To
- **User:** When stock hits 0 → `StockNotification.ts` model → `GET /api/stock-notifications` sends user "back in stock" alert
- **Admin:** `admin/(dashboard)/merchants.tsx` → admin can view merchant inventory status
- **Mall:** Products from BiZone inventory feed into Mall product catalog

---

## U-20 · BiZone P2: Analytics Dashboard
**Priority:** 🟠 High

### Files to CREATE/WIRE
```
rez_v2/src/pages/BiZoneUI/dashboard/MerchantAnalytics.jsx
rez_v2/src/pages/BiZoneUI/dashboard/MerchantBenchmarks.jsx
```

### Backend APIs — Already Exist
```
GET /api/merchant/analytics?period=7d    → revenue, orders, customers
GET /api/merchant/analytics/customers    → repeat vs new, top customers
GET /api/merchant/analytics/products     → best sellers, dead stock
GET /api/merchant/metrics                → real-time metrics
```

### Charts to show:
- Daily revenue bar chart (7d / 30d / 90d)
- Orders by fulfillment type (dine-in/delivery/pickup)
- Coins issued vs redeemed (loyalty health)
- Top 5 products
- Customer repeat rate %
- REZ vs non-REZ customer split

### Connects To
- **Admin:** `admin/(dashboard)/AdminMarketingDashboard` — admin sees aggregate across all merchants
- **Prive Campaigns:** Campaign ROI (posts created, reach, conversions) appears in analytics after U-12

---
---

# PHASE 5 — MALL: SOCIAL CASHBACK (Month 2)

---

## U-21 · Mall: Social Cashback (Cherry/WYLD Feature)
**Priority:** 🔴 Critical competitive feature

### Files
```
nuqta-master/app/store/[id].tsx                       Add "Social Cashback Available" banner
nuqta-master/components/mall/MallSectionContainer.tsx  Add social cashback filter tab
nuqta-master/app/prive/campaigns/submit.tsx            (reuse from U-12)
rez-backend-master/src/models/Store.ts                 Add socialCashback config field
rez-backend-master/src/models/PriveCampaign.ts         (from U-12, set taskType=buy_post)
```

### Problem
Mall brands (Zara, Nykaa, Sony) earn coins on purchase. No way for brand to say "post about this and earn extra ₹ cashback" — the Cherry/WYLD model. Neither frontend nor backend supports this.

### Upgrade

**Add to `Store.ts` model:**
```typescript
socialCashback: {
  enabled:              { type: Boolean, default: false },
  postCashbackPercent:  { type: Number },    // e.g. 40% extra if user posts
  postTypes:            [{ type: String, enum: ['story','reel','post'] }],
  minimumFollowers:     { type: Number, default: 500 },
  verificationWindow:   { type: Number, default: 48 },  // hours to submit post
  totalBudget:          Number,
  budgetUsed:           { type: Number, default: 0 },
}
```

**`store/[id].tsx` — add Social Cashback banner after purchase:**
```tsx
{store.socialCashback?.enabled && userHasPurchased && !hasSubmittedPost && (
  <Pressable onPress={() => router.push(`/prive/campaigns/${campaignId}/submit`)}>
    <View style={socialCashbackBanner}>
      <Text>📸 Post about your purchase</Text>
      <Text>Earn extra {store.socialCashback.postCashbackPercent}% cashback!</Text>
      <Text>Submit your Instagram story within 48 hours</Text>
    </View>
  </Pressable>
)}
```

### Connects To
- **Prive Campaigns:** Uses the same `PriveCampaign` + `PrivePostSubmission` models from U-12
- **BiZone:** `MerchantPriveModule.jsx` — merchant toggles `socialCashback.enabled`, sets budget
- **Admin:** `admin/(dashboard)/prive.tsx` — admin approves submissions, sets platform commission on social cashback
- **Admin:** `admin/(dashboard)/ugc-moderation.tsx` — admin reviews flagged posts

---
---

# PHASE 6 — NEAR U COMPLETENESS (Month 2-3)

---

## U-22 · Stories Row: Instagram-style What's New
**Priority:** 🟠 High

### Files
```
nuqta-master/components/whats-new/StoriesRow.tsx       [CREATE]
nuqta-master/app/whats-new.tsx                          Add startIndex param
nuqta-master/components/whats-new/WhatsNewStoriesFlow.tsx  Add startIndex prop
nuqta-master/app/(tabs)/index.tsx                       Add <StoriesRow>, remove WhatsNewBadge
```

### Problem
"What's New" is a tiny `"✦ What's New"` text badge in the header. Nobody notices it. The full-screen stories viewer works well. The API returns stories. Just needs a proper entry point.

### Upgrade
Create `StoriesRow.tsx` — horizontal scrollable circles with gradient rings (unseen) / grey (seen). Each circle tap opens `whats-new.tsx?startIndex=N`. See full code in REZ_Header_CoinWallet_WhatsNew_Fix.md.

### Connects To
- **Admin:** `admin/(dashboard)/bonus-zone.tsx` — when admin creates a deal → auto-creates a What's New story (add trigger to `bonusCampaignService.ts`)
- **Backend:** `GET /api/whats-new?includeViewed=true` + `POST /api/whats-new/:id/view`
- **Prive:** When a Prive campaign launches → auto-creates a What's New story for eligible users

---

## U-23 · Service Appointment Coins: Zero for Any Booking
**Priority:** 🟠 High

### Files
```
rez-backend-master/src/routes/serviceAppointments.ts    Post-create handler
rez-backend-master/src/core/rewardEngine.ts             issue() call to add
```

### Problem
After fixing the wrong endpoint (U-06), appointments will go to the correct place. But the reward engine is never called — no coins are issued for any service booking (beauty, healthcare, fitness, home services).

### Upgrade
```typescript
// In serviceAppointmentController.ts — after appointment is created:
await rewardEngine.issue({
  userId:      appointment.userId,
  amount:      25,  // configurable
  rewardType:  'service_booking',
  coinType:    'rez',
  source:      `service_appointment:${appointment._id}`,
  metadata:    { storeId: appointment.storeId, serviceType: appointment.serviceType }
});
```

### Connects To
- **Admin:** `admin/(dashboard)/coin-rewards.tsx` — admin sets coin amount per service type
- **Admin:** `admin/(dashboard)/gamification-economy.tsx` — service booking coins count toward user tier
- **Merchant:** Merchant's booking count increases → appears in their analytics
- **Streak:** Service booking can trigger a "wellness streak" variant (configurable)

---

## U-24 · Wallet: 4 Priority Missing Sub-screens
**Priority:** 🟠 High

### Files to CREATE
```
nuqta-master/app/wallet/request-money.tsx     Request ₹ from friend
nuqta-master/app/wallet/limits.tsx            Daily/monthly spend limits
nuqta-master/app/wallet/auto-recharge.tsx     Auto top-up rules
nuqta-master/app/wallet/bill-split.tsx        Split bill with friends
```

### Backend APIs — Already Exist
```
POST /api/wallet/transfer      → send money to friend
GET  /api/wallet/limits        → current limits
PUT  /api/wallet/limits        → update limits
POST /api/wallet/split         → create split bill request
```

### Connects To
- **Admin:** `admin/(dashboard)/wallet-config.tsx` — admin sets global wallet limits
- **Admin:** `admin/(dashboard)/wallet-adjustment.tsx` — admin can manually adjust user wallets
- **User:** Bill splitting creates a `Transfer` model entry → shows in transaction history for all parties

---

## U-25 · Daily Check-in
**Priority:** 🟡 Medium

### Files
```
nuqta-master/app/daily-checkin.tsx            [CREATE or extend existing bonus-zone]
nuqta-master/components/homepage/NearUTabContent.tsx  Add checkin card
rez-backend-master/src/routes/admin/dailyCheckinConfig.ts  (exists)
```

### Upgrade
Simple 7-day calendar strip. Day 1 = 5 coins, Day 7 = 50 coins, Day 30 = 200 coins.
Call `POST /api/activities/checkin` (check if this route exists, otherwise add to activities routes).

### Connects To
- **Admin:** `admin/(dashboard)/daily-checkin-config.tsx` — admin configures coin amounts per day milestone
- **Gamification:** Check-in fires `gamificationEventBus.emit('daily_checkin', {...})` → can trigger streak

---

## U-26 · Map View for Local Stores
**Priority:** 🟡 Medium

### Files
```
nuqta-master/app/explore/map.tsx              [CREATE] — was identified as F-12 gap
```

### Backend APIs — Already Exist
```
GET /api/stores/nearby?lat=X&lng=Y&radius=5000
```

### Upgrade
```typescript
// app/explore/map.tsx using react-native-maps:
import MapView, { Marker } from 'react-native-maps';
// Fetch nearby stores → render markers with coin% callout
// Tap marker → navigate to store/[id]
```

### Connects To
- **Admin:** `admin/(dashboard)/hotspot-areas.tsx` — admin-defined hotspot areas shown as highlighted zones on map
- **Merchant:** Merchant's coordinates (from store profile) determine their map pin position

---
---

# PHASE 7 — TRUST + AI FEATURES (Month 3)

---

## U-27 · Trust Passport: Visible Credit + KYC UI
**Priority:** 🟠 High

### Files to CREATE
```
nuqta-master/app/trust-passport.tsx          Trust score, tiers, verification status
nuqta-master/app/trust-credit.tsx            Credit limit, pay-later usage
nuqta-master/components/account/TrustScoreCard.tsx
```

### What v2 has designed (rez_v2/src/pages/RezUI/core/TrustCredit.jsx):
- Score 0–1000 with tier: Bronze/Silver/Gold/Platinum/Diamond
- Credit limit by tier: Bronze ₹5k → Diamond unlimited
- Pay-later: 7–30 day repayment window
- Verification: Phone ✓, Email ✓, Aadhaar ✓, PAN ✓, Bank ?, Selfie ✓

### Backend APIs — Check/Create
```
GET  /api/user/trust-score          → UserReputation model (used by Prive too)
GET  /api/user/credit-limit         → based on trust score
GET  /api/user/kyc-status           → verification status per document
POST /api/user/kyc/submit           → submit Aadhaar/PAN
```

### Connects To
- **Prive:** Same `UserReputation` model feeds both Trust Score and Prive access — one score, two uses
- **Admin:** `admin/(dashboard)/verifications.tsx` — admin reviews KYC submissions
- **Merchant:** Higher trust users get lower commission rates on Mall orders (admin-configured)

---

## U-28 · AI Smart Search + Recommendations
**Priority:** 🟡 Medium

### Files to CREATE
```
nuqta-master/app/search/ai-search.tsx         Already has route! Wire it up
nuqta-master/components/ai/AIAssistant.tsx    Floating AI chat button
```

### Backend APIs — Check/Create
```
POST /api/recommendations/smart-search    → semantic search across stores + products
GET  /api/recommendations/for-you        → personalised feed
POST /api/recommendations/ai-assistant   → chat-style shopping assistant
```

### Connects To
- **Admin:** `admin/(dashboard)/explore.tsx` — admin sees search trends, popular queries
- **Merchant:** High-relevance stores appear higher in AI search results (trust score + rating weight)

---
---

# PHASE 8 — ADMIN COMPLETIONS

The Admin panel (rez-admin-main) already has ~50 screens but several are broken or missing (from REZ_Admin_Readiness_Report.md).

---

## U-29 · Admin: Review Moderation (A-01)
**Priority:** 🔴 Critical

### Files
```
rez-admin-main/app/(dashboard)/              [CREATE review-moderation.tsx]
rez-backend-master/src/routes/admin/         [CREATE reviews.ts admin route]
```

### Problem
No backend route, no frontend screen for admin to moderate written reviews. Users can post any review with no moderation.

### Upgrade
```typescript
// New backend route src/routes/admin/reviews.ts:
GET  /api/admin/reviews          → list with status filter
GET  /api/admin/reviews/stats    → counts by status
PUT  /api/admin/reviews/:id/approve
PUT  /api/admin/reviews/:id/reject

// New admin screen review-moderation.tsx:
// Show: review text, star rating, store name, user, date
// Actions: Approve / Reject (with reason) / Flag
```

### Connects To
- **User:** `my-reviews.tsx` — approved reviews appear; rejected ones show "under review" status
- **Merchant:** `MerchantReviewManagement.jsx` — merchant sees approved reviews on their store page
- **Trust Score:** Review approval feeds into user's Trust Score (reviewQuality pillar)

---

## U-30 · Admin: Engagement Config Live Data (A-02)
**Priority:** 🟠 High

### Files
```
rez-admin-main/app/(dashboard)/engagement-config.tsx    Currently shows hardcoded static data
rez-backend-master/src/routes/admin/                    GET /api/admin/engagement-config exists?
```

### Problem
`engagement-config.tsx` shows hardcoded numbers. Never calls any API. Admin thinks they're configuring things but nothing saves.

### Upgrade
```typescript
// Create services/api/engagementConfig.ts in admin:
export const getEngagementConfig = () => 
  apiClient.get('/admin/engagement-config');
export const updateEngagementConfig = (data: any) =>
  apiClient.put('/admin/engagement-config', data);

// engagement-config.tsx: replace hardcoded data with API calls
useEffect(() => { getEngagementConfig().then(setConfig); }, []);
const handleSave = async () => { await updateEngagementConfig(config); };
```

### Connects To
- **Streak:** Engagement config includes streak milestone rewards — saving here immediately affects what users earn
- **Games:** Daily coin limits, game reward multipliers set here
- **User App:** `(tabs)/earn` — earn page shows configuration that comes from this admin screen

---

## U-31 · Admin: Approval Queue Screen (A-04)
**Priority:** 🟠 High

### Files
```
rez-admin-main/app/(dashboard)/             [CREATE pending-approvals.tsx]
```

### Connects To
- **Prive Campaigns (U-12):** Post submissions awaiting approval appear here
- **Merchant Offers (U-17):** New merchant offers needing approval
- **Social Impact:** Social impact event registrations
- **Reviews (U-29):** Reviews flagged for review

---
---

# CROSS-SYSTEM WIRING SUMMARY

How every major system connects to admin and merchant:

```
USER ACTION                  → BACKEND              → MERCHANT SEES        → ADMIN SEES
─────────────────────────────────────────────────────────────────────────────────────────
Pay at store                 → storePaymentRoutes   → BiZone Orders        → admin/orders
Book service appointment     → serviceAppointments  → BiZone Bookings      → admin/orders
Buy Mall product             → orderRoutes          → BiZone Orders        → admin/orders
Post on Instagram (Prive)    → priveCampaignRoutes  → BiZone PriveModule   → admin/prive (approve)
Earn coins                   → rewardEngine.issue() → BiZone Analytics     → admin/economics
Redeem coins                 → walletService        → BiZone Wallet        → admin/user-wallets
Write a review               → reviewRoutes         → BiZone Reviews       → admin/review-moderation
Check in to social event     → socialImpactService  → N/A (platform event) → admin/social-impact
Refer a friend               → referralRoutes       → N/A                  → admin/referrals
Daily streak check-in        → streakRoutes         → N/A                  → admin/gamification-economy
Get Prive access             → priveAccessService   → N/A                  → admin/prive (access mgmt)
```

---

# BUILD ORDER

```
WEEK 1-2  — Phase 1: All 10 bug fixes (U-01 through U-10)
WEEK 3    — Phase 2: Location (U-11)
WEEK 4-6  — Phase 4: BiZone P1 (U-14, U-15, U-16, U-17, U-18) — merchant unblocked
WEEK 7-10 — Phase 3: Prive Phase 1 (U-12, U-13) — Cherry/WYLD feature live
WEEK 11-12— Phase 5: Mall Social Cashback (U-21)
MONTH 3   — Phase 6: Near U completeness (U-22–U-26)
MONTH 4   — Phase 7: Trust + AI (U-27, U-28)
MONTH 4-5 — Phase 8: Admin completions (U-29–U-31)
MONTH 5-6 — Phase 4 P2: BiZone advanced (U-19, U-20 + inventory, staff, GST)
```

---

# FILE COUNT SUMMARY

| Phase | New Files | Modified Files | Backend New | Backend Modified |
|-------|-----------|---------------|-------------|-----------------|
| Phase 1 (Bugs) | 1 | 12 | 1 | 4 |
| Phase 2 (Location) | 1 | 3 | 1 | 1 |
| Phase 3 (Prive) | 8 | 4 | 5 | 3 |
| Phase 4 (BiZone) | 15 | 0 | 5 | 8 |
| Phase 5 (Mall Social) | 1 | 3 | 2 | 1 |
| Phase 6 (Near U) | 6 | 3 | 2 | 2 |
| Phase 7 (Trust/AI) | 3 | 1 | 3 | 1 |
| Phase 8 (Admin) | 3 | 1 | 2 | 1 |
| **TOTAL** | **38** | **27** | **21** | **21** |

---

*REZ Master Upgrade Guide · March 2026*
*31 upgrade items · 8 phases · Full cross-system connection map*
*From bug fixes to BiZone merchant app to Prive Social Cashback*
