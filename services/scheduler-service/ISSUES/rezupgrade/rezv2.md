# REZ PLATFORM — COMPLETE UPGRADE REPORT
## REZ App · Merchant App (BiZone) · Admin (HQ) · Backend
## Based on Full Study of Rez_v2 Vision vs Actual Codebase
### March 2026 | Phase-by-Phase | Zero-Break Strategy

---

## STUDY METHODOLOGY

This report is based on:
- **Rez_v2 (Vision):** 1,103 screens across React + Vite web app
- **REZ App (v7):** ~180 routes in React Native (Expo Router)
- **Admin (v6):** 79 screens in React Native admin panel
- **Backend (v6):** 60+ models, 500+ API routes in Node.js/Express
- **BiZone:** 219 screens designed in v2, 0 screens built

Every section shows: **Current Code Location → Problem → Design (from v2) → Upgrade → Connections**

---

## MASTER GAP TABLE

| System | v2 Designed | Actually Built | Gap % |
|--------|------------|----------------|-------|
| REZ User App | 360 screens | ~180 routes | 50% missing |
| Near U mode | Full homepage | ~60% built | 40% missing |
| Mall mode | 7 screens | 6 screens (no social cashback) | 85% feature-complete |
| Cash Store mode | 9 screens | 9 screens | 80% complete |
| Privé mode | 141 screens | ~15 components | 90% missing |
| Wallet system | 21 screens | 13 screens | 38% missing |
| Social layer | 28 screens | 2 partial screens | 93% missing |
| AI features | 12 screens | 1 partial screen | 92% missing |
| Corporate/B2B | 7 screens | 0 screens | 100% missing |
| BiZone Merchant | 219 screens | 0 screens | 100% missing |
| Admin (HQ) | 174 screens | 79 screens | 55% missing |
| Sister Apps | 156 screens | 0 screens | 100% missing |

---
---

# PHASE 1 — CRITICAL BUG FIXES
## "Fix Before Building Anything New" — 2 Weeks

These bugs hit every user on day one. Every dev must stop feature work until these are resolved.

---

## 1.1 · Default Region Dubai Bug

**Severity:** 🔴 CRITICAL — Every new install sees wrong currency

**Current Code:**
```
nuqta-master/stores/regionStore.ts                Line 38: const DEFAULT_REGION: RegionId = 'dubai'
nuqta-master/services/locationService.ts          Lines 30-34: lat=25.2048, lng=55.2708 (Dubai)
rez-backend-master/src/config/regions.ts          Line 106: DEFAULT_REGION = 'bangalore' ✅ correct
```

**Problem:**
Frontend and backend contradict each other. Backend correctly defaults to Bangalore. Frontend overrides to Dubai. Every new user sees AED (د.إ) currency instead of ₹.

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/modes/RezMall.jsx` — all prices shown in ₹ by default. regionStore in v2 has `'bangalore'` as default.

**Fix:**
```typescript
// regionStore.ts line 38:
const DEFAULT_REGION: RegionId = 'bangalore';

// locationService.ts lines 30-34:
latitude: 12.9716, longitude: 77.5946
defaultLocationName: 'Bangalore, India'

// locationService.ts fallback city lines ~497-501:
city: 'Bangalore', state: 'Karnataka', country: 'India'
```

**Zero-Break Strategy:** These are defaults only. Existing users with stored region preference are NOT affected — `regionStore._initialize()` checks AsyncStorage first and only falls back to DEFAULT_REGION if nothing is stored.

**Connects To:**
- Admin `rez-admin-main/(dashboard)/settings.tsx` — admin can manage region configs
- Backend `src/config/regions.ts` — already correct, no change needed
- All price displays via `regionStore.formatPrice()` — auto-corrects after fix

---

## 1.2 · Location Shows City Not Neighbourhood

**Severity:** 🔴 CRITICAL — Makes location feature useless

**Current Code:**
```
rez-backend-master/src/services/geocodingService.ts  Lines 79-107: Google Maps extraction
rez-backend-master/src/services/geocodingService.ts  Lines 128-145: OpenCage extraction
nuqta-master/types/location.types.ts                 Lines 4-11: LocationAddress interface
nuqta-master/components/location/LocationDisplay.tsx  Lines 307-341: getLocationText()
```

**Problem:**
`geocodingService.ts` loops through `address_components` and extracts only `locality` (city = "Bangalore"). Google Maps also returns `sublocality_level_1` ("BTM Layout", "HSR Layout") but this is ignored. `LocationAddress` interface has no `neighbourhood` field. Header always shows "Bangalore" for all 12+ million Bangalore users.

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/core/Home.jsx` line 374: `"🔥 Trending Near You"` — v2 assumes neighbourhood-level location. The location system in v2 stores `neighbourhood` as a separate field.

**Fix (3 files, non-breaking):**

*Backend — `geocodingService.ts`:*
```typescript
// In reverseGeocodeGoogle() forEach loop — add BEFORE city extraction:
if (types.includes('sublocality_level_1') || types.includes('sublocality') 
    || types.includes('neighborhood')) {
  if (!neighbourhood) neighbourhood = component.long_name;
}
// Add to return object: neighbourhood: neighbourhood || undefined
```

*Frontend — `types/location.types.ts`:*
```typescript
export interface LocationAddress {
  address: string;
  neighbourhood?: string;   // NEW
  city: string;
  // ...rest unchanged
}
```

*Frontend — `LocationDisplay.tsx` `getLocationText()`:*
```typescript
// Add at start of city check:
if (addr.neighbourhood) return addr.neighbourhood;
if (addr.city) return addr.city;
```

**Zero-Break Strategy:** `neighbourhood` is optional (`?`). All existing code reading `address.city` continues working unchanged. The field is purely additive.

**Connects To:**
- Admin `hotspot-areas.tsx` — admin-defined hotspot areas show correct neighbourhood names
- Merchant location coordinates unchanged — only display name improves
- U-11 (Coming Soon banner) uses neighbourhood name in its text

---

## 1.3 · Coin Button Goes to Static Images Instead of Wallet

**Severity:** 🔴 CRITICAL — Core CTA broken

**Current Code:**
```
nuqta-master/app/(tabs)/index.tsx        Line 455-461: handleCoinPress → router.push('/coins')
nuqta-master/components/homepage/HomeHeader.tsx  Lines 164-170: coin onPress → '/coins'
nuqta-master/app/coins.tsx              Full file: imports card1.png-card4.png static images
```

**Problem:**
Tapping coin icon navigates to `/coins` which shows 4 decorative PNG cards with no live data. The actual wallet at `/wallet-screen` has full API integration via `walletApi`.

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/wallet/Wallet.jsx` — wallet is mode-aware, showing different UI for Near U / Mall / Cash Store / Privé. All 4 wallet modes connect to live data via `WalletContext`.

**Fix:**
```typescript
// (tabs)/index.tsx line 457: router.push('/wallet-screen')
// HomeHeader.tsx line 166: router.push('/wallet-screen')
// coins.tsx: import { Redirect } from 'expo-router'; export default () => <Redirect href="/wallet-screen" />;
```

**Connects To:**
- `wallet-screen.tsx` → `walletApi` → `GET /api/wallet/balance`
- Admin `user-wallets.tsx` — admin sees same balance data
- Merchant coin issuance flows back to wallet-screen balance

---

## 1.4 · Deals Tab 404

**Severity:** 🔴 CRITICAL — Tapped by every user, goes nowhere

**Current Code:**
```
nuqta-master/app/deals/[campaignId].tsx    EXISTS
nuqta-master/app/deals/                   MISSING index.tsx
nuqta-master/components/navigation/BottomNavigation.tsx  getActiveTab() missing '/deals' case
```

**Problem:**
`deals/` directory has campaign detail but no index. Tapping Deals tab → 404/blank.

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/deals/Deals.jsx` + `SuperDeals.jsx` — Deals page has tabs: All | Cashback | Bank | 2× Coins | Festival. Uses `BonusZoneCard` component. `SuperDeals.jsx` shows time-limited "lightning" deals.

**Fix:**

*Create `app/deals/index.tsx`:*
```typescript
import { bonusZoneApi } from '@/services/bonusZoneApi';
import { campaignsApi } from '@/services/campaignsApi';

const TABS = ['All', 'Cashback', 'Bank', '2× Coins', 'Festival'];

export default function DealsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [activeTab, setActiveTab] = useState('All');

  useEffect(() => {
    Promise.all([
      bonusZoneApi.getBonusCampaigns(),
      campaignsApi.getActiveCampaigns()
    ]).then(([bonus, active]) => {
      setCampaigns([...(bonus.data || []), ...(active.data || [])]);
    });
  }, []);

  const filtered = activeTab === 'All' ? campaigns
    : campaigns.filter(c => c.type === activeTab.toLowerCase());

  return (
    <SafeAreaView>
      {/* Tab row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {TABS.map(tab => (
          <Pressable key={tab} onPress={() => setActiveTab(tab)}>
            <Text>{tab}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {/* Campaign cards */}
      <FlatList data={filtered} renderItem={({ item }) => <BonusZoneCard campaign={item} />} />
    </SafeAreaView>
  );
}
```

*Update `BottomNavigation.tsx` `getActiveTab()`:*
```typescript
case '/deals': case '/bonus-zone': return 'deals';
```

**Connects To:**
- Backend: `GET /api/offers/bonus-zone` + `GET /api/campaigns/active`
- Admin `bonus-zone.tsx` → creates campaigns → appears here
- Admin `campaigns.tsx` → creates campaigns → appears here

---

## 1.5 · Savings Streak Never Triggered by Payments

**Severity:** 🔴 CRITICAL — Core engagement mechanic silently broken

**Current Code:**
```
rez-backend-master/src/events/gamificationEventBus.ts    EventType union
rez-backend-master/src/models/UserStreak.ts              streakType enum
rez-backend-master/src/services/streakService.ts         milestones config
rez-backend-master/src/events/handlers/streakHandler.ts  EVENT_TO_STREAK_TYPE map
rez-backend-master/src/controllers/storePaymentController.ts  Lines 1342 (commitTransaction)
```

**Problem:**
`streakHandler.ts` maps events to streak types. `store_payment_confirmed` is not in the mapping and not in the `EventType` union. Users can pay at stores all day — streak never fires.

**v2 Design Reference:**
`rez_v2/src/pages/GrowthApps/dailystreak/DailyStreakHome.jsx` — streak shows daily savings milestones with tier badges (Starter → Warrior → Builder → Elite). Streak is the primary retention mechanic. `rez_v2/src/contexts/SavingsContext.jsx` tracks savings streak as global state.

**Fix (5 files, all backend):**
```typescript
// 1. gamificationEventBus.ts — add to EventType:
| 'store_payment_confirmed'

// 2. UserStreak.ts — add 'savings' to streakType enum

// 3. streakService.ts — add savings milestones:
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

// 5. storePaymentController.ts after line 1342 (commitTransaction):
gamificationEventBus.emit('store_payment_confirmed', {
  userId: transaction.userId,
  metadata: { storeId, amount: transaction.amount }
});
```

**Connects To:**
- Admin `gamification-economy.tsx` → configure milestone coin amounts
- User `StreaksGamification.tsx` → auto-updates via `GET /api/streak/user`
- Merchant analytics → streak activity per merchant visible

---

## 1.6 · 7 Niche Booking Pages Use Wrong Endpoint

**Severity:** 🔴 CRITICAL — All service bookings go to wrong database collection

**Current Code (7 files — all have same bug):**
```
nuqta-master/app/beauty/BookAppointment.tsx          → POST /api/table-bookings
nuqta-master/app/fitness/book/[storeId].tsx           → POST /api/table-bookings
nuqta-master/app/healthcare/BookDoctor.tsx            → POST /api/table-bookings
nuqta-master/app/MainCategory/[slug]/BookService.tsx  → POST /api/table-bookings
nuqta-master/app/fashion/TryAndBuy.tsx                → POST /api/table-bookings
nuqta-master/app/entertainment/BookTickets.tsx        → POST /api/table-bookings
nuqta-master/app/education/EnrollClass.tsx            → POST /api/table-bookings
nuqta-master/services/serviceAppointmentApi.ts        WRITTEN, NEVER IMPORTED
```

**Problem:**
`serviceAppointmentApi.ts` is fully coded and targets correct endpoint `POST /api/service-appointments` with proper schema. None of the 7 booking pages import or use it. All data goes to restaurant table booking endpoint — structurally wrong model, data effectively lost.

**v2 Design Reference:**
`rez_v2/src/pages/WasilApps/glowzy/GlowzyHome.jsx`, `FitEarn/FitEarnBooking.jsx` etc. — all Wasil vertical apps use a unified `ServiceAppointment` booking flow with `serviceType` field.

**Fix (same pattern for all 7 files):**
```typescript
// Remove: import { tableBookingApi } from '@/services/tableBookingApi';
// Add:
import serviceAppointmentApi from '@/services/serviceAppointmentApi';

// Replace submit:
await serviceAppointmentApi.create({
  storeId, serviceType: selectedService,
  date: selectedDate, time: selectedTime, notes
});
```

**Connects To:**
- BiZone: Merchants can now see bookings in their dashboard (previously invisible)
- Admin `orders.tsx` → service appointments now appear correctly
- U-23 (coin rewards for service bookings) — needed for coins to fire correctly

---

## 1.7 · Profile Drawer: Multiple Design + Data Bugs

**Severity:** 🟠 HIGH — First impression, premium feel destroyed

**Current Code:**
```
nuqta-master/components/profile/ProfileMenuModal.tsx   Line 39: MODAL_WIDTH = 0.88, Line 661+685: "Level 1"
nuqta-master/contexts/ProfileContext.tsx               Lines 59-84: tier not mapped
nuqta-master/data/profileData.ts                       Line 82: route '/Store' (capital S)
nuqta-master/types/profile.types.ts                    Lines 4-19: no tier/creatorLevel field
```

**Problem:**
1. Width 88% — too wide, feels like a modal not a premium side panel
2. Header gradient: lightMustard → nileBlue — creates muddy gold-to-navy look
3. "Level 1 • Earn rewards" hardcoded on lines 661+685
4. Menu background `rgba(247, 250, 252, 0.85)` — cold blue-white, not premium
5. "Quick Actions" title with yellow underline — juvenile
6. `/Store` route (line 82) — case-sensitive 404 on some platforms
7. No Change Password link anywhere in drawer

**v2 Design Reference:**
`rez_v2/src/pages/RezPriveUI/dashboard/PriveHome.jsx` — dark navy `#0D1F2D` background, gold `#FFCD57` accents, compact stats strip, flat dark menu rows with separator lines. Clean. Premium. Intentional.

**Design Upgrade (ProfileMenuModal.tsx):**
```typescript
// Line 39:
const MODAL_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 360);

// COLORS block — replace entirely:
const COLORS = {
  headerTop:    '#1a3a52',
  headerBottom: '#0D1F2D',
  gold:         '#FFCD57',
  surface:      '#0D1F2D',
  textPrimary:  'rgba(255,255,255,0.92)',
  textSecondary:'rgba(255,255,255,0.55)',
  separator:    'rgba(255,255,255,0.08)',
  error:        '#EF4444',
};

// menuContainer: backgroundColor: '#0D1F2D'
// menuItem: flat row, borderBottomWidth: StyleSheet.hairlineWidth
// No boxShadow, no borderRadius 16 per item, no white background cards
// Logout: simple red text row, no white card

// Lines 661+685: replace "Level 1 • Earn rewards" with:
const lvl = (user as any)?.creatorLevel;
const label = lvl === 3 ? 'Ambassador' : lvl === 2 ? 'Influencer' : 'Partner';
// text: lvl ? `${label} · Level ${lvl}` : 'Join Partner Program'
```

**Remove "Quick Actions" section (lines 815-820):**
```tsx
// Delete this entire block:
<View style={styles.quickActionsHeader}>
  <ThemedText style={styles.quickActionsTitle}>Quick Actions</ThemedText>
  <View style={styles.quickActionsTitleLine} />
</View>
```

**Connects To:**
- Backend `GET /api/prive/access` → returns real tier and score
- Admin `prive.tsx` → controls who gets Privé → affects tier badge
- BiZone → creator level set by merchant campaign system

---

## 1.8 · Three Account Pages Never Load Data

**Severity:** 🟠 HIGH

**Current Code:**
```
nuqta-master/app/account/notification-history.tsx    No API call — always shows empty
nuqta-master/app/account/profile.tsx                 No ImagePicker — can't upload photo
nuqta-master/app/account/delete-account.tsx          Generic error messages only
```

**v2 Reference:**
`rez_v2/src/pages/RezUI/account/user-management/` — all 45+ account pages have full API integration. Profile has photo upload via ImagePicker + Cloudinary. Notification history fetches from API.

**Fixes:**

*notification-history.tsx — add useEffect:*
```typescript
useEffect(() => {
  apiClient.get('/notifications/history', { limit: 50 }).then((res: any) => {
    if (res.success) setNotifications(res.data?.notifications || []);
  }).finally(() => setLoading(false));
}, []);
```

*profile.tsx — add photo upload:*
```typescript
import * as ImagePicker from 'expo-image-picker';
const handleAvatarPress = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return;
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true, aspect: [1, 1], quality: 0.75 });
  if (!result.canceled) {
    const fd = new FormData();
    fd.append('profileImage', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'p.jpg' } as any);
    await apiClient.put('/user/profile/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' }});
  }
};
```

**Connects To:**
- Admin `photo-moderation.tsx` → reviews uploaded profile photos
- Drawer `ProfileMenuModal.tsx` → `user?.avatar` automatically shows new photo

---
---

# PHASE 2 — LOCATION SYSTEM UPGRADE
## Week 3

---

## 2.1 · Region Cleanup + Coming Soon

**Current Code:**
```
nuqta-master/stores/regionStore.ts                  type RegionId = 'bangalore' | 'dubai' | 'china'
nuqta-master/components/RegionSelector.tsx          REGIONS array — China fully enabled
nuqta-master/components/profile/ProfileMenuModal.tsx REGIONS_DATA — China + Dubai active
rez-backend-master/src/config/regions.ts            china.isActive = true, dubai.isActive = true
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/core/Home.jsx` — India only. No China. No UAE. The platform is India-first by design. Dubai has a "Coming Soon" treatment in the v2 RegionSelector.

**Design:** RegionSelector shows:
- 🇮🇳 India — active, selectable
- 🇦🇪 Dubai — greyed out, "Coming Soon" badge, not tappable
- China — removed entirely from all UIs

**Fix (4 files):**
```typescript
// regionStore.ts: export type RegionId = 'bangalore' | 'dubai';
// isValidRegion: return ['bangalore', 'dubai'].includes(r);
// Remove china from DEFAULT_CONFIGS

// RegionSelector.tsx:
const REGIONS = [
  { id: 'bangalore', name: 'India', flag: '🇮🇳', comingSoon: false },
  { id: 'dubai', name: 'Dubai', flag: '🇦🇪', description: 'UAE — Coming Soon', comingSoon: true },
];
// Disabled tap + "Coming Soon" badge for Dubai

// backend regions.ts:
china: { ...existing, isActive: false },
dubai: { ...existing, isActive: false },
```

**Connects To:**
- `GET /api/location/regions` → returns only India after backend change
- Admin `settings.tsx` → admin can re-enable Dubai when ready

---

## 2.2 · Auto-Switch to Mall When Area Not Serviceable

**Current Code:**
```
nuqta-master/utils/serviceabilityCheck.ts    DOES NOT EXIST
nuqta-master/app/(tabs)/index.tsx            No serviceability check after location loads
nuqta-master/components/homepage/NearUTabContent.tsx   No "Coming Soon" banner
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/modes/RezMall.jsx` — when users browse Mall, they're always in a "everywhere" mode. v2 `AppContext` has `globalMode` that auto-switches. The `showModeSwitcher` flag in AppContext handles graceful mode transitions.

**Design:** Yellow dismissable banner on Near U tab:
```
📍 Near U is coming soon in BTM Layout
Meanwhile, shop from top brands on REZ Mall.
[Mall →]  [✕]
```

**Fix (create 1 file, modify 2):**

*New `utils/serviceabilityCheck.ts`:*
```typescript
export async function checkAreaServiceability(lat: number, lng: number) {
  try {
    const res = await apiClient.get('/stores/nearby', { lat, lng, radius: 5000, limit: 1 });
    const count = res.data?.stores?.length ?? 0;
    return { isServiceable: count > 0, suggestedMode: count > 0 ? 'near-u' : 'mall' };
  } catch {
    return { isServiceable: true, suggestedMode: 'near-u' };  // fail open
  }
}
```

**Connects To:**
- Backend `GET /api/stores/nearby` — already exists
- Admin `hotspot-areas.tsx` → admin defines serviceable zones
- Mall mode → auto-activated when area has no local stores

---
---

# PHASE 3 — PRIVÉ: THE FULL SOCIAL CASHBACK SYSTEM
## Month 1-2 | Highest Revenue Impact

This is the complete WYLD + Cherry equivalent — but better because REZ has local stores.

---

## 3.1 · Privé Phase 1: Access Gate + Score Display

**Current Code:**
```
nuqta-master/components/prive/PriveSectionContainer.tsx   Shows benefits grid but no score
nuqta-master/components/prive/PriveProgressRing.tsx       Exists but not connected to real API
nuqta-master/hooks/usePriveEligibility.ts                 Returns score from backend but never shown
rez-backend-master/src/services/priveAccessService.ts     Full scoring engine exists
rez-backend-master/src/models/PriveAccess.ts              Full model exists
```

**Problem:**
The entire Privé scoring engine exists in backend. `usePriveEligibility.ts` fetches the score. `PriveProgressRing.tsx` component exists for displaying it. But none of these are connected — score is never shown to the user.

**v2 Design Reference:**
`rez_v2/src/pages/RezPriveUI/tier/PriveTierProgress.jsx` — tier system:
- **Access:** 0 pts, up to 20% rewards, standard campaigns
- **Signature:** 500 pts, up to 45% rewards, priority campaigns
- **Elite:** 2000 pts, up to 75% rewards, paid collaborations, concierge

`rez_v2/src/pages/RezPriveUI/dashboard/PriveHome.jsx` — dark luxury `#1A1A2E` background, gold `#D4AF37` accents, member card with tier badge, monthly earnings, active campaigns count, REZ/Privé/Branded coin split.

**Design for Privé Tab:**
```
┌─────────────────────────────────┐
│  🔐 Privé Member                │  ← dark header
│  Rejaul Karim                   │
│  Signature Tier  •  847/1000    │
│  ████████░░░░  2,800 to Elite   │
├─────────────────────────────────┤
│  ◆ 3,150 Privé  |  8,200 REZ   │  ← coin balances
├─────────────────────────────────┤
│  🔥 3 Active Campaigns          │  ← campaign CTAs
│  📊 ₹2,840 earned this month    │
│  ✅ 47 campaigns completed      │
└─────────────────────────────────┘
```

**Upgrade:**

*Show score in PriveHeaderWrapper.tsx:*
```typescript
const { score, tier, pointsToNext, nextTier } = usePriveEligibility();

<PriveProgressRing score={score} tier={tier} />
<Text>REZ Score: {score}/1000</Text>
<Text>{pointsToNext} pts to {nextTier}</Text>
```

**Connects To:**
- Backend `GET /api/prive/access` → `priveAccessService.checkAccess(userId)` → score + tier
- Admin `prive.tsx` → admin sets tier thresholds, manages access
- Campaign system (3.2) → tier determines which campaigns are visible

---

## 3.2 · Privé: Brand Campaign System (The Cherry/WYLD Feature)

**Current Code:**
```
rez-backend-master/src/models/PriveMission.ts    Exists — missions, but NOT buy+post flow
rez-backend-master/src/models/PriveOffer.ts      Exists — offers, but NOT campaign tracking
rez-backend-master/src/routes/priveRoutes.ts     Exists — but no campaign endpoints
rez-backend-master/src/routes/admin/priveAdmin.ts  Has missions + offers admin
MISSING: PriveCampaign model, PrivePostSubmission model, campaign routes
```

**Problem:**
Privé has missions and offers but NO "brand campaign" concept — the core Cherry/WYLD mechanic of: buy at brand → post on Instagram → earn ₹ cashback. Neither the model, routes, nor UI exist.

**v2 Design Reference:**
`rez_v2/src/pages/RezPriveUI/campaigns/PriveInvitations.jsx`:
```
Brand invitations show:
- rewardRange: '20-45%'
- actionRequired: 'Dine + Share Story'
- duration: '2 weeks'
```

`rez_v2/src/pages/RezPriveUI/campaigns/PriveCampaignTask.jsx`:
```
Campaign tasks: Visit + Experience | Create Content | Submit Proof | Engage Community
Reward tiers: Base 500 coins | Quality 800 coins | Premium 1,200 coins
```

`rez_v2/src/pages/BiZoneUI/advanced/MerchantPriveModule.jsx`:
```
Merchant creates campaign with:
- Type: Content Creation | Event Hosting | Product Review
- Requirements: Reels count, min views, hashtag
- Budget: ₹50,000
- Deliverables: 3 Reels, 5 Stories, 1 Grid Post
```

**New Models (backend):**

*`rez-backend-master/src/models/PriveCampaign.ts`:*
```typescript
{
  merchantId:  { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  title:       { type: String, required: true },
  taskType:    { enum: ['dine_post','buy_post','visit_post','event_post'] },
  requirements: {
    minPurchaseAmount: Number,
    postTypes:         [{ type: String, enum: ['story','reel','post'] }],
    mustTagBrand:      Boolean,
    minimumFollowers:  { type: Number, default: 500 },
    hashtagRequired:   String,
  },
  reward: {
    coinAmount:       Number,    // instant on purchase
    cashbackPercent:  Number,    // unlocked after post approval
    cashbackCap:      Number,
  },
  slots:        { type: Number },
  slotsUsed:    { type: Number, default: 0 },
  budget:       Number,
  budgetUsed:   { type: Number, default: 0 },
  validFrom:    Date,
  validTo:      Date,
  status:       { enum: ['draft','active','paused','completed'] },
  minPriveTier: { enum: ['entry','signature','elite'] },
}
```

*`rez-backend-master/src/models/PrivePostSubmission.ts`:*
```typescript
{
  campaignId:      { ref: 'PriveCampaign' },
  userId:          { ref: 'User' },
  orderId:         { ref: 'Order', optional: true },
  postUrl:         String,
  postScreenshot:  String,   // Cloudinary URL
  submittedAt:     Date,
  status:          { enum: ['pending','approved','rejected','expired'] },
  reviewedBy:      { ref: 'AdminUser', optional: true },
  cashbackIssued:  { type: Boolean, default: false },
  cashbackAmount:  Number,
}
```

**New Routes:**

*User-facing `rez-backend-master/src/routes/priveCampaignRoutes.ts`:*
```typescript
GET  /api/prive/campaigns            // active campaigns for user's tier
GET  /api/prive/campaigns/:id        // campaign detail
POST /api/prive/campaigns/:id/join   // accept campaign
POST /api/prive/campaigns/:id/submit // submit post proof
GET  /api/prive/campaigns/:id/status // my submission status
GET  /api/prive/earnings             // all campaign earnings history
```

*Merchant `rez-backend-master/src/merchantroutes/priveModule.ts`:*
```typescript
GET  /api/merchant/prive/campaigns               // my campaigns
POST /api/merchant/prive/campaigns               // create campaign
PUT  /api/merchant/prive/campaigns/:id
POST /api/merchant/prive/campaigns/:id/pause
GET  /api/merchant/prive/campaigns/:id/analytics
GET  /api/merchant/prive/submissions             // pending approvals
PUT  /api/merchant/prive/submissions/:id/approve → triggers cashback
PUT  /api/merchant/prive/submissions/:id/reject
```

**Post Approval → Cashback Flow:**
```typescript
// In priveCampaignController.ts approveSubmission():
await rewardEngine.issue({
  userId,
  amount:     cashbackAmount,
  rewardType: 'prive_campaign',
  coinType:   'rez',
  source:     `prive_campaign:${campaign._id}`,
});
// Push notification to user
await notificationService.send(userId, {
  title: '🎉 Cashback Approved!',
  body:  `₹${cashbackAmount} credited for your ${campaign.title} post`,
});
```

**New Frontend Screens (8 screens for Phase 1):**
```
nuqta-master/app/prive/campaigns/index.tsx         Campaign list with tabs: Active | Pending | Completed
nuqta-master/app/prive/campaigns/[id].tsx           Campaign detail: task requirements, reward tiers
nuqta-master/app/prive/campaigns/submit.tsx         Post URL + screenshot upload
nuqta-master/app/prive/campaigns/status.tsx         Verification progress tracker
nuqta-master/app/prive/earnings.tsx                 Earnings history: coins + ₹ cashback
nuqta-master/app/prive/tier.tsx                     Tier progress (extend existing PriveTierProgress)
nuqta-master/services/priveCampaignApi.ts           API client for above routes
```

**Connects To:**
- Admin `prive.tsx` → new "Campaign Submissions" tab for admin to review/approve posts
- Admin `economics.tsx` → platform takes % commission on social cashback budget
- BiZone `MerchantPriveModule.jsx` → merchant creates campaigns, reviews submissions
- `rewardEngine.issue()` → coins credit to user wallet
- Admin `ugc-moderation.tsx` → flagged posts review queue

---

## 3.3 · Privé: Influence Score Visible

**Current Code:**
```
nuqta-master/hooks/usePriveEligibility.ts           Returns score — never displayed
nuqta-master/components/prive/PriveProgressRing.tsx  Exists — not connected
nuqta-master/components/prive/PriveInfluenceHub      Not imported anywhere in app
```

**v2 Design Reference:**
`rez_v2/src/pages/RezPriveUI/influence/PriveInfluenceHub.jsx` — score: 847, level: 'Strong', rank: 'Top 15%', totalReach: 124,500, avgEngagementRate: 7.2%. WYLD-style score dashboard.

**Add to `PriveHeaderWrapper.tsx`:**
```typescript
const { score, tier, pointsToNext } = usePriveEligibility();
// Show score ring + tier label + points to next tier
// Tap → navigate to /prive/tier for full progress breakdown
```

**Connects To:**
- Admin `prive.tsx` → `PUT /api/admin/prive/program-config/tier-thresholds` — admin sets score thresholds
- Campaign system → tier determines visible campaigns

---
---

# PHASE 4 — BIZONE: MERCHANT APP (0 → P1)
## Month 1-2, Runs Parallel with Phase 3

Backend is 60% ready. This is purely a frontend build job.

---

## 4.1 · BiZone Dashboard + Auth

**Status:** Backend ✅ Ready | Frontend ❌ 0%

**Backend APIs (already exist):**
```
POST /api/merchant/auth/register
POST /api/merchant/auth/login
GET  /api/merchant/dashboard
GET  /api/merchant/analytics?period=today|7d|30d
```

**v2 Design Reference:**
`rez_v2/src/pages/BiZoneUI/dashboard/MerchantDashboard.jsx`:
Dashboard cards: Today's Revenue | Active Orders | Coins Issued | Customer Visits | Active Offers | Wallet Balance | Low Stock Alerts | Recent Transactions.

Timeframe selector: Today | Week | Month. Growth % indicators with arrow up/down.

**Design:** Dark navy `#1a3a52` header, white card grid, gold accent for key metrics. Responsive for mobile + tablet.

**Screens to Build:**
```
rez_v2/src/pages/BiZoneUI/auth/MerchantSignup.jsx       ← wire to POST /merchant/auth/register
rez_v2/src/pages/BiZoneUI/auth/MerchantBusinessDetails.jsx
rez_v2/src/pages/BiZoneUI/dashboard/MerchantDashboard.jsx ← wire to GET /merchant/dashboard
```

**Zero-Break:** Merchant auth uses separate JWT scope from user auth. No conflict.

**Connects To:**
- Admin `merchants.tsx` → admin approves new merchant signups
- Admin `merchant-withdrawals.tsx` → admin processes payout requests
- User Near U → active merchant appears in nearby stores

---

## 4.2 · BiZone POS

**Status:** Backend ✅ Ready (offline-first sync) | Frontend ❌ 0%

**Backend APIs:**
```
POST /api/merchant/sync              → offline-first POS sync
POST /api/store-payment/create-bill
POST /api/store-payment/qr-generate
GET  /api/merchant/products?pos=true
```

**v2 Design Reference:**
`rez_v2/src/pages/BiZoneUI/pos/MerchantPOS.jsx`:
- Product grid with search + category filter
- Cart with quantity controls
- Customer lookup by phone (link to loyalty)
- Coin redemption: shows Promo/Branded/REZ coin balances, enter amount to redeem
- Payment method: UPI | Card | Cash | Mixed
- QR generation for user to scan
- Bill preview with coin discount applied

**POS Flow:**
```
Search/scan product → Add to cart →
Enter customer phone (optional, for loyalty) →
Toggle coin discount (if customer has coins) →
Payment: Generate QR → Wait for scan → Confirm →
Issue coins to customer → Print/SMS receipt
```

**Connects To:**
- User `pay-in-store/scan-qr.tsx` — user side of QR payment
- Streak: `gamificationEventBus.emit('store_payment_confirmed')` fires after POS payment
- Admin `orders.tsx` → all POS transactions appear as orders
- Wallet: coins credited to user immediately after payment

---

## 4.3 · BiZone Orders

**Status:** Backend ✅ Ready | Frontend ❌ 0%

**Backend APIs:**
```
GET  /api/merchant/orders?status=pending|preparing|ready|completed
PUT  /api/merchant/orders/:id/status
POST /api/merchant/orders/:id/notify-customer
```

**v2 Design Reference:**
`rez_v2/src/pages/BiZoneUI/orders/MerchantOrders.jsx`:
Real-time order stream, tabs by status, order card shows: customer name, items, amount, time, fulfillment type (delivery/pickup/dine-in/takeaway).

Status update flow: Pending → Accepted → Preparing → Ready → Delivered

**Real-time via WebSocket:**
```typescript
// merchant.io socket room — backend already emits via gamificationSocketService
// merchant app connects to:
const socket = io(SOCKET_URL, { auth: { token: merchantToken } });
socket.on('new_order', (order) => addOrderToList(order));
socket.on('order_updated', (update) => updateOrderInList(update));
```

**Connects To:**
- User `shopping/OrderTracking.tsx` → user sees live status from merchant
- Admin `orders.tsx` → all orders visible to admin
- BiZone Analytics → order volume feeds into merchant analytics

---

## 4.4 · BiZone: Create Offer

**Status:** Backend ✅ Ready | Frontend ❌ 0%

**Backend APIs:**
```
POST  /api/merchant/offers
GET   /api/merchant/offers
PUT   /api/merchant/offers/:id
PATCH /api/merchant/offers/:id/status  → activate/pause
```

**v2 Design Reference:**
`rez_v2/src/pages/BiZoneUI/offers/CreateOffer.jsx`:
Offer types: Flat discount (₹X off) | % discount | BOGO | Coin multiplier (2×/3× coins) | Locked deal (REZ users only)

Fields: title, type, discount value, min order value, valid from/to, max redemptions, applicable products (all or select).

Preview card shows how offer appears to user before publishing.

**After Creation:**
```
POST /api/merchant/offers → status: 'pending_approval'
Admin receives notification → reviews in admin/offers.tsx
Admin approves → offer becomes active
User sees offer in Near U store page + Deals tab
```

**Connects To:**
- Admin `offers.tsx` → admin approves/rejects merchant offers
- User `store/[id].tsx` → `StoreOffersSection` shows approved offers
- User `deals/index.tsx` → approved offers appear in Deals tab
- Admin `bonus-zone.tsx` → admin can boost merchant offer to Bonus Zone (2× coins)

---

## 4.5 · BiZone Wallet + Payouts

**Status:** Backend ✅ Ready | Frontend ❌ 0%

**Backend APIs:**
```
GET  /api/merchant/wallet
GET  /api/merchant/wallet/transactions
POST /api/merchant/wallet/withdraw-request
GET  /api/merchant/wallet/settlement-history
```

**v2 Design Reference:**
`rez_v2/src/pages/BiZoneUI/advanced/MerchantWallet.jsx`:
Balance card: Available ₹ | Pending Clearance ₹ | Total Earned Month
Transactions list: order ID, gross amount, platform commission (%), net credited
Withdraw button: min ₹500 → bank linked at onboarding

**Connects To:**
- Admin `merchant-withdrawals.tsx` → admin processes withdrawal requests
- Admin `economics.tsx` → admin sets commission rates per merchant category
- BiZone Auth → bank account linked during merchant onboarding

---

## 4.6 · BiZone P2: Inventory + Products

**Status:** Backend ✅ Ready | Frontend ❌ 0%

**Backend APIs:**
```
GET    /api/merchant/products
POST   /api/merchant/products
PUT    /api/merchant/products/:id
PATCH  /api/merchant/products/:id/stock
GET    /api/merchant/products/low-stock
```

**v2 Design Reference:**
`rez_v2/src/pages/BiZoneUI/inventory/MerchantInventory.jsx`:
Product list with stock levels, colour-coded (green/amber/red), low stock alerts, reorder point config. Bulk import via CSV (`MerchantBulkImport.jsx`).

**Connects To:**
- User Mall → product catalog uses merchant inventory
- Admin → merchant product visibility controlled by admin

---

## 4.7 · BiZone P2: Analytics

**Status:** Backend ✅ Ready | Frontend ❌ 0%

**v2 Design Reference:**
`rez_v2/src/pages/BiZoneUI/dashboard/MerchantAnalytics.jsx`:
Charts: Daily revenue (bar) | Orders by type (pie) | Customer retention % | Coins issued vs redeemed | Top products | REZ vs non-REZ customer split

`rez_v2/src/pages/BiZoneUI/dashboard/MerchantBenchmarks.jsx`:
Compare merchant performance to category average. "Your avg order value is 23% above category average."

**Connects To:**
- Admin `AdminMarketingDashboard.jsx` → aggregate view across all merchants
- Prive campaigns analytics appear here after Phase 3

---

## 4.8 · BiZone P2: Staff + CRM

**v2 Design Reference:**
`rez_v2/src/pages/BiZoneUI/advanced/MerchantStaff.jsx` — staff CRUD
`rez_v2/src/pages/BiZoneUI/customers/MerchantCRM.jsx` — RFM customer segments (Champions, At Risk, Loyal, New)
`rez_v2/src/pages/BiZoneUI/advanced/MerchantLoyaltyBuilder.jsx` — custom loyalty programs beyond REZ coins

**Backend APIs (need to create):**
```
POST /api/merchant/staff                     → team.ts route (exists)
GET  /api/merchant/customers/segments        → NEW: RFM segmentation
POST /api/merchant/loyalty/programs          → NEW
```

---

## 4.9 · BiZone P3: Advanced Features (Month 4-6)

These exist in v2 but need backend work first:
- `MerchantKitchenDisplay.jsx` → KDS for restaurant orders
- `MerchantFloorPlan.jsx` → visual table management
- `MerchantGSTSetupWizard.jsx` + `MerchantGSTRExport.jsx` → GST compliance
- `MerchantPayroll.jsx` → staff payroll
- `MerchantWhatsAppBusiness.jsx` → WhatsApp order notifications
- `MerchantMultiStoreDashboard.jsx` → chain management

---
---

# PHASE 5 — MALL: SOCIAL CASHBACK
## Month 2 | Cherry/WYLD Parity

---

## 5.1 · Mall Social Cashback Integration

**Current Code:**
```
nuqta-master/app/store/[id].tsx          No social cashback section
rez-backend-master/src/models/Store.ts   Line 139: serviceArea exists but no socialCashback field
rez-backend-master/src/models/PriveCampaign.ts  DOES NOT EXIST (created in Phase 3)
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/modes/mall/MallBrandDetail.jsx` — brand detail shows: cashback %, "Social Cashback Available" badge when enabled, "Post about your purchase to unlock extra XX% cashback" CTA.

**Add to `Store.ts` model:**
```typescript
socialCashback: {
  enabled:             { type: Boolean, default: false },
  postCashbackPercent: Number,
  postTypes:           [String],
  minimumFollowers:    { type: Number, default: 500 },
  verificationWindow:  { type: Number, default: 48 },
  totalBudget:         Number,
  budgetUsed:          { type: Number, default: 0 },
}
```

**`store/[id].tsx` — add after successful order:**
```tsx
{store.socialCashback?.enabled && userHasPurchased && !hasSubmittedPost && (
  <Pressable onPress={() => router.push(`/prive/campaigns/${campaignId}/submit`)}>
    <View style={socialCashbackBanner}>
      <Text>📸 Post about this purchase</Text>
      <Text>Earn extra {store.socialCashback.postCashbackPercent}% cashback!</Text>
      <Text>Submit your Instagram story/reel within 48 hours</Text>
    </View>
  </Pressable>
)}
```

**Connects To:**
- Prive campaigns (Phase 3.2) — uses same models and post submission flow
- BiZone `MerchantPriveModule.jsx` — merchant enables social cashback, sets budget
- Admin `prive.tsx` — admin reviews post submissions, sets platform commission

---

## 5.2 · Mall Collections + Dedicated Cart

**Current Code:**
```
nuqta-master/components/mall/MallSectionContainer.tsx   No collections concept
nuqta-master/app/cart.tsx                               Generic cart for all modes
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/modes/mall/MallCollection.jsx` — curated collections: "Summer Edit", "Gifting Essentials", "Back to College". Editorial layout with brand mix.

`rez_v2/src/pages/RezUI/modes/mall/MallCart.jsx` — Mall-specific cart: shows coin cashback calculation per item, estimated delivery, brand grouping.

**Add:**
```
nuqta-master/app/mall/collections.tsx    ← new
nuqta-master/app/mall/collection/[id].tsx ← new
```

---
---

# PHASE 6 — NEAR U COMPLETENESS
## Month 2-3

---

## 6.1 · Stories Row (What's New)

**Current Code:**
```
nuqta-master/components/common/WhatsNewBadge.tsx   Text badge "✦ What's New" (6px text!)
nuqta-master/services/whatsNewApi.ts               Full API client — getStories(), getUnseenCount()
nuqta-master/components/whats-new/WhatsNewStoriesFlow.tsx  Full screen works
```

**v2 Design Reference:**
`rez_v2/src/components/home/HomeReels.jsx` — horizontal scrollable circles. Each circle has category icon. Gradient ring = unseen. Grey ring = seen.

**Create `components/whats-new/StoriesRow.tsx`:**
- Horizontal ScrollView of story circles
- Each circle: 60px diameter, gradient ring (unseen) or grey (seen)
- Stores viewed IDs in AsyncStorage
- Tap → opens `WhatsNewStoriesFlow` at that story index

**Remove from `(tabs)/index.tsx`:**
```tsx
// Remove: <WhatsNewBadge onPress={handleWhatsNewPress} variant={...} />
// Add: <StoriesRow variant={tabStyles.whatsNewVariant} />
```

**Connects To:**
- Backend `GET /api/whats-new` → stories list
- Admin `bonus-zone.tsx` → creating campaign auto-generates story (add trigger to `bonusCampaignService.ts`)
- Prive campaign launch → auto-creates story for eligible users

---

## 6.2 · Daily Check-in

**Current Code:**
```
rez-admin-main/(dashboard)/daily-checkin-config.tsx   Admin configures rewards ← EXISTS
nuqta-master/app/                                      No daily-checkin page
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/categories/explore/DailyCheckInPage.jsx` — 30-day calendar strip. Claimed days show coin amount earned. Day 1=5, Day 3=10, Day 7=25, Day 14=50, Day 30=200 coins.

**Create `nuqta-master/app/daily-checkin.tsx`:**
```typescript
POST /api/activities/checkin  → (check if exists, add if not)
// Returns: coins earned today, streak count, next milestone
```

Add "Daily Check-in" card to `NearUTabContent.tsx` above the fold.

**Connects To:**
- Admin `daily-checkin-config.tsx` → admin sets coin amounts
- Streak system → daily check-in can extend savings streak

---

## 6.3 · Map View for Local Stores

**Current Code:**
```
nuqta-master/app/explore/map.tsx   DOES NOT EXIST (F-12 gap from earlier audit)
rez-backend-master/src/routes/locationRoutes.ts   GET /api/location/nearby-stores EXISTS
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/categories/explore/MapViewPage.jsx` — full map with store pins, coin% callout on tap, filter by category.

**Create `app/explore/map.tsx`:**
```typescript
import MapView, { Marker } from 'react-native-maps';
// npx expo install react-native-maps (already listed in F-12 fix)

const { data: stores } = await exploreApi.getNearbyStores(lat, lng, 5000);
// Render map with markers → tap → navigate to /store/[id]
```

**Connects To:**
- Admin `hotspot-areas.tsx` → admin hotspot zones shown as highlighted regions
- Merchant location from store profile → determines map pin position

---

## 6.4 · Bill Splitting

**Current Code:**
```
nuqta-master/app/wallet/                No bill-split page
rez-backend-master/src/routes/         No split route (need to verify)
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/wallet/payments/BillSplitting.jsx` — enter total amount, add friends by phone, split equally or custom amounts, send request, each friend pays their share via REZ wallet.

**Create `nuqta-master/app/wallet/bill-split.tsx`**

**Connects To:**
- `Transfer.ts` model → split creates transfer requests
- Push notifications → friends notified of split request

---

## 6.5 · Friends Activity Feed

**Current Code:**
```
nuqta-master/app/social/          Only upload/reels — no activity feed
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/social/SocialFeed.jsx` — "Priya Sharma saved ₹450 at Zara", "Arjun earned 200 coins at Starbucks". Privacy-aware (only shows with permission). Leaderboard tab.

**Create `nuqta-master/app/social/feed.tsx`:**
```typescript
GET /api/activities/friends   → friends' public saving activities
// Privacy: only shows if user has `preferences.privacy.showActivity = true`
```

---

## 6.6 · Compare Products Feature

**Current Code:**
```
nuqta-master/app/          No compare page
rez-backend-master/src/routes/  /comparisons route EXISTS
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/categories/explore/ComparePage.jsx` — side-by-side product comparison: price, specs, availability, coin cashback %, user ratings.

**Create `nuqta-master/app/explore/compare.tsx`**

---
---

# PHASE 7 — WALLET COMPLETENESS
## Month 2-3

---

## 7.1 · Mode-Aware Wallet

**Current Code:**
```
nuqta-master/app/wallet-screen.tsx    Single wallet screen, no mode awareness
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/wallet/Wallet.jsx` — mode-aware wrapper:
- **Near U mode (WalletModeReZ):** Red + white, "You saved money today" emotion, local pay focus
- **Mall mode (WalletModeMall):** Clean, premium, brand-focused coin display
- **Cash Store mode (WalletModeCashStore):** Cashback focus, pending clearance timeline
- **Privé mode (WalletModePrive):** Dark `#1A1A1A` + gold `#D4AF37`, status/prestige focus

**Upgrade `wallet-screen.tsx`:**
```typescript
const { activeTab } = useHomeTabStore();
// Render different header color/tone based on activeTab
// Near U: savings-focused language
// Mall: brand cashback language
// Cash Store: pending cashback timeline
// Privé: prestige/exclusive language
```

---

## 7.2 · Missing Wallet Sub-Screens

**v2 Reference → Create in v7:**
```
WalletAutoRecharge.jsx → nuqta-master/app/wallet/auto-recharge.tsx
  Backend: PUT /api/wallet/settings (autoRecharge config)

WalletLimits.jsx → nuqta-master/app/wallet/limits.tsx
  Backend: GET/PUT /api/wallet/limits (daily/monthly caps)

WalletRequestMoney.jsx → nuqta-master/app/wallet/request-money.tsx
  Backend: POST /api/wallet/transfer (request type)

BillSplitting.jsx → nuqta-master/app/wallet/bill-split.tsx
  Backend: POST /api/wallet/split (NEW)

CoinSystemGuide.jsx → nuqta-master/app/wallet/coin-guide.tsx
  Static explainer: REZ coin vs Promo vs Branded vs Privé
```

---
---

# PHASE 8 — TRUST SYSTEM + AI FEATURES
## Month 3

---

## 8.1 · Trust Passport + Credit UI

**Current Code:**
```
rez-backend-master/src/models/UserReputation.ts   EXISTS — full scoring model
rez-backend-master/src/services/priveAccessService.ts  Uses reputation for Prive
nuqta-master/app/                                  No trust-passport or trust-credit page
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/core/TrustCredit.jsx`:
- Score 0–1000, tiers: Bronze/Silver/Gold/Platinum/Diamond
- Credit limits: Bronze ₹5k → Platinum ₹1L → Diamond unlimited
- Pay-later: 7-day (Bronze) → 30-day (Gold) → 60-day (Platinum)
- Score breakdown: Transaction History | Payment Behaviour | Review Quality | Account Age | Verification | Community

`rez_v2/src/pages/RezUI/core/TrustPassport.jsx`:
- Verification checklist: Phone ✅ | Email ✅ | Aadhaar ✅ | PAN ✅ | Bank ❌ | Selfie ✅
- Each verification adds +15 to +50 trust points

**Create:**
```
nuqta-master/app/trust-passport.tsx    Trust score, verification status
nuqta-master/app/trust-credit.tsx      Credit limit, pay-later usage
nuqta-master/components/account/TrustScoreCard.tsx
```

**Backend APIs (check/create):**
```
GET  /api/user/trust-score     → UserReputation model (same as Prive score)
GET  /api/user/credit-limit    → based on trust score tier
GET  /api/user/kyc-status      → KYC verification per document
POST /api/user/kyc/submit      → submit Aadhaar/PAN/selfie
```

**Connects To:**
- Admin `verifications.tsx` → admin reviews KYC submissions
- Admin `AdminCreditEngine.jsx` (v2 — needs to be built in admin) → admin manages credit limits
- Prive → same `UserReputation` feeds both trust score and Prive access

---

## 8.2 · AI Shopping Assistant

**Current Code:**
```
nuqta-master/app/search/ai-search.tsx   Route exists — partial UI
rez-backend-master/src/routes/recommendations  EXISTS — basic recommendations
```

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/ai/AIShoppingAssistant.jsx` — conversational AI chat:
Quick actions: "Find best deals" | "Gift suggestions" | "Compare products"
Natural language: "Find me a coffee shop within 2km with outdoor seating"

`rez_v2/src/pages/RezUI/ai/AIPriceComparison.jsx` — price tracker with AI prediction:
"Samsung Galaxy S24 is expected to drop ₹5,000 in 2-3 days (87% confidence)"

`rez_v2/src/pages/DiscoveryApps/air/AIRHome.jsx` — standalone AI discovery app (future phase):
Conversational interface for all REZ discovery. "Where can I use my 500 coins?"

**Phase 1 — Wire existing `search/ai-search.tsx`:**
```typescript
POST /api/recommendations/smart-search
// Semantic search + context (user's coin balance, location, preferences)
// Returns: stores + products + deals ranked by relevance
```

**Future — Full AI Assistant:**
```
nuqta-master/app/ai/assistant.tsx   Chat interface using Claude API
// Context: user's wallet balance, recent purchases, location, preferences
```

---
---

# PHASE 9 — EXCLUSIVE SEGMENTS
## Month 3-4

---

## 9.1 · Student Zone

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/exclusive/StudentZone.jsx`:
Verified students get extra 10% cashback at food, entertainment, shopping categories.
Verification: Upload college ID → auto-verify via `VerifiedInstitution.ts` model (EXISTS in backend).

**Create:**
```
nuqta-master/app/exclusive/student-zone.tsx
nuqta-master/app/profile/verification.tsx   (Already exists! Wire to VerifiedInstitution)
```

**Backend:**
```
POST /api/user/verify-student    → uses VerifiedInstitution model
GET  /api/user/student-deals     → filtered deals with student discount
```

**Connects To:**
- Admin `special-profiles.tsx` → admin manages special profile verifications
- Admin `institutions.tsx` → admin manages verified institutions list

---

## 9.2 · Corporate Perks

**v2 Design Reference:**
`rez_v2/src/pages/RezUI/corporate/CorporateAccount.jsx`:
Company account: 150 employees, ₹4.5L monthly spend, Enterprise tier.
`CorporateTeamManagement.jsx`: add/remove team members, role assignments.
`CorporateBulkOrders.jsx`: bulk orders for company events.

**Phase 1 (3 screens):**
```
nuqta-master/app/corporate/account.tsx
nuqta-master/app/corporate/team.tsx
nuqta-master/app/corporate/orders.tsx
```

**Backend:** `POST /api/user/corporate/register` (NEW), `GET /api/user/corporate/perks`

---
---

# PHASE 10 — ADMIN COMPLETIONS
## Throughout Phases 3-6

---

## 10.1 · Missing Admin Screens (95 screens from v2 not in v6)

**Priority additions:**

**A-01: Review Moderation (🔴 Critical)**
```
rez-admin-main/app/(dashboard)/review-moderation.tsx  [CREATE]
rez-backend-master/src/routes/admin/reviews.ts         [CREATE]
Routes: GET /admin/reviews | PUT /admin/reviews/:id/approve|reject
```

**A-02: Engagement Config Live Data (🟠 High)**
```
rez-admin-main/app/(dashboard)/engagement-config.tsx  [FIX — currently hardcoded]
Create services/api/engagementConfig.ts in admin
Wire to GET/PUT /api/admin/engagement-config
```

**A-03: Approval Queue (🟠 High)**
```
rez-admin-main/app/(dashboard)/pending-approvals.tsx  [CREATE]
Aggregates: Prive post submissions + merchant offers + KYC requests + reviews
```

**A-04: BiZone Campaign Submissions (🔴 Critical — needed for Phase 3)**
```
rez-admin-main/app/(dashboard)/prive-submissions.tsx  [CREATE]
Routes: GET /admin/prive/submissions | PUT approve|reject
```

**A-05: Trust/Credit Engine (🟠 High)**
```
rez-admin-main/app/(dashboard)/credit-engine.tsx   [CREATE — v2: AdminCreditEngine.jsx]
Configure credit limits per trust tier, pay-later rules
```

**A-06: Region Config (🟠 High)**
```
rez-admin-main/app/(dashboard)/region-config.tsx   [CREATE — v2: AdminRegionConfig.jsx]
Enable/disable regions, set coming soon dates
```

**A-07: Influencer Approval (🟠 High)**
```
rez-admin-main/app/(dashboard)/influencer-approval.tsx  [CREATE — v2: AdminInfluencerApproval.jsx]
Review Prive applications, approve/reject with notes
```

**A-08: Mode Control (🟡 Medium)**
```
rez-admin-main/app/(dashboard)/mode-control.tsx  [CREATE — v2: AdminModeControl.jsx]
Enable/disable app modes globally, force mode for specific regions
```

**A-09: WhatsApp Templates (🟡 Medium)**
```
rez-admin-main/app/(dashboard)/whatsapp-templates.tsx  [CREATE — v2: AdminWhatsAppTemplates.jsx]
Order notifications, coin credit alerts, campaign invitations
```

**A-10: Analytics Dashboards (🟡 Medium)**
```
v2 has: AdminAnalyticsDashboard, AdminEcosystemAnalytics, AdminHeatmaps, 
        AdminPredictiveAnalytics, AdminSessionReplay, AdminCohortAnalysis
v6 has: index.tsx (basic dashboard)
These 6 admin screens need to be built in v6 using existing backend analytics routes
```

---
---

# PHASE 11 — SISTER APPS (Month 5-6)

These are standalone mini-apps that live inside REZ but have their own complete experience.

---

## 11.1 · Wasil Vertical Apps (22 apps)

**v2 Reference:** `rez_v2/src/pages/WasilApps/`

Priority order based on user demand:
1. **Dinezy** — restaurant discovery + table booking + food ordering (2 screens built in v2)
2. **FitEarn** — gym/studio booking + workout tracking (5 screens built in v2)
3. **Glowzy** — beauty salon booking + products (1 screen built in v2)
4. **Grocify** — grocery quick commerce (1 screen built in v2)
5. **MediEarn** — pharmacy + doctor + health tracking (6 screens planned)

These are essentially Wasil = "Near U verticals with a branded experience". Each Wasil app:
- Has its own home screen inside REZ
- Uses the same REZ wallet + coins
- Connects to the same merchant backend
- Shows vertical-specific UI (Dinezy has table maps, FitEarn has workout logs)

**Implementation:** Each Wasil app lives at a route in the REZ app:
```
nuqta-master/app/dinezy/     ← Dinezy
nuqta-master/app/fitearn/    ← FitEarn
nuqta-master/app/glowzy/     ← Glowzy
```

Backend: All use existing merchant/store/order APIs. Just filtered by `storeType`.

---

## 11.2 · Discovery Apps

**v2 Reference:** `rez_v2/src/pages/DiscoveryApps/`

1. **AI-R** (`AIRHome.jsx`) — AI-first discovery, conversational interface for finding stores/deals
2. **CoinHunt** (`CoinHuntMap.jsx`) — gamified deal hunting, physical QR codes at locations
3. **LocalEdge** (`LocalEdgeHome.jsx`) — hyperlocal deals, neighbourhood-specific

These integrate with the REZ economy but have distinct UX.

---

## 11.3 · Growth Apps

**v2 Reference:** `rez_v2/src/pages/GrowthApps/`

- **ReferralX** — advanced referral tracking with multi-level rewards
- **BuzzLoop** (full social feed, 15 screens) — in-app social network, post about purchases
- **SpinWin** — daily spin wheel
- **DailyStreak** — streak gamification standalone
- **CampusConnect** — college-specific challenges + leaderboard
- **SquadGoals** — group savings challenges

---
---

# ZERO-BREAK STRATEGY

How to build all this without breaking existing functionality:

## Rule 1: Feature Flags First
Before building any major new feature, add it to `feature-flags.tsx` in admin.
```typescript
// rez-backend-master/src/models/WalletConfig.ts or similar
// or backend/.env:
FEATURE_PRIVE_CAMPAIGNS=false  // flip to true when ready to launch
FEATURE_BIZONE_MERCHANT=false
FEATURE_SOCIAL_CASHBACK=false
```

Admin can enable features region-by-region, user-by-user, or globally.

## Rule 2: Additive Models Only
Every new model field is `optional` and has a `default` value.
```typescript
// Good (non-breaking):
socialCashback?: { enabled: boolean; /* ... */ }

// Bad (breaking):
socialCashback: { enabled: boolean; /* required! */ }
```

Existing documents without the field → `store.socialCashback === undefined` → treated as disabled.

## Rule 3: New Routes, Not Modified Routes
Never change the signature of an existing API endpoint.
Add new endpoints instead. Use versioning if needed (`/v2/`).
```
/api/prive/campaigns   ← new route
// Not modifying /api/prive/access which already exists and is used
```

## Rule 4: Lazy Load New Screens
New screens added to `app/(tabs)/index.tsx` use `React.lazy`:
```typescript
const PriveCampaigns = React.lazy(() => import('@/app/prive/campaigns'));
// Only loads when user navigates there
// Won't affect initial app load time
```

## Rule 5: Test on Staging First
Every phase ships to staging environment first.
Run full test checklist before production deploy.
Rollback plan: Feature flags can disable any new feature instantly.

---
---

# COMPLETE BUILD TIMELINE

```
WEEK 1-2   Phase 1: All 8 bug fixes (U-01 to U-08)
           → App now works correctly for all existing users

WEEK 3     Phase 2: Location upgrades (neighbourhood, auto-switch)
           → Location feels useful, not generic

WEEK 4-6   Phase 4: BiZone P1 (Dashboard, Auth, POS, Orders, Offers, Wallet)
           → Merchants can finally manage their stores
           PARALLEL: Phase 3.1: Prive access gate + score display

WEEK 7-10  Phase 3.2: Prive Brand Campaigns + post submission
           → Social Cashback live — Cherry/WYLD feature
           Phase 5: Mall Social Cashback integration

WEEK 11-14 Phase 6: Near U completeness (Stories, Check-in, Map, Bill Split)
           Phase 10: Admin gaps (Review Moderation, Approval Queue, Prive Submissions)

MONTH 4    Phase 7: Wallet completeness + mode-aware wallet
           Phase 8: Trust Passport + AI Smart Search
           Phase 4 P2: BiZone Inventory + Analytics + Staff

MONTH 5    Phase 9: Exclusive segments (Student Zone, Corporate)
           Phase 4 P3: BiZone advanced (GST, Kitchen Display, WhatsApp)
           Phase 10: Admin analytics dashboards

MONTH 6    Phase 11: Sister apps (Dinezy, FitEarn, Glowzy Phase 1)
           Growth Apps: BuzzLoop social feed
           Discovery: AI-R conversational interface
```

---
---

# FINAL SUMMARY TABLE

| Phase | Screens | Priority | Impact | Time |
|-------|---------|----------|--------|------|
| 1: Bug Fixes | 0 new, fix 12 existing | 🔴 P0 | Every user affected | 2 weeks |
| 2: Location | 1 new, fix 3 | 🔴 P1 | User trust + retention | 1 week |
| 3: Privé Social Cashback | 8 new | 🔴 P1 | Revenue + competition | 4 weeks |
| 4: BiZone P1 | 8 new | 🔴 P1 | Merchant onboarding | 3 weeks |
| 5: Mall Social Cashback | 2 new | 🔴 P1 | Cherry/WYLD parity | 1 week |
| 6: Near U completeness | 7 new | 🟠 P2 | Engagement + retention | 3 weeks |
| 7: Wallet completeness | 5 new | 🟠 P2 | Financial feature depth | 2 weeks |
| 8: Trust + AI | 4 new | 🟠 P2 | Premium differentiation | 3 weeks |
| 9: Exclusive Segments | 6 new | 🟡 P3 | B2B + segment marketing | 2 weeks |
| 10: Admin Completions | 10 new | 🟠 P2 | Operations efficiency | 4 weeks |
| 11: Sister Apps | 15+ new | 🟡 P3 | Vertical depth | 6 weeks |

**Total New Screens:** ~66 user-facing + 10 admin + 8 BiZone = **84 new screens**
**Total Modified:** ~27 existing screens
**Backend New:** ~21 models/routes
**Backend Modified:** ~21 existing routes

---

*REZ Platform Complete Upgrade Report · March 2026*
*Full study of Rez_v2 (1,103 screens) vs Actual REZ + Admin + Backend*
*11 phases · Zero-break strategy · Every screen, model, route, and connection mapped*
