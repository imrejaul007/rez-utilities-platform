# REZ — SPRINT TASK REGISTER (Doc 5)
## Week-by-Week Task Breakdown · Phases 1–4 · 10 Weeks
## JIRA-ready · Acceptance Criteria · Estimates · Dependencies
### March 2026

---

## HOW TO USE

- Each task has: ID, track (Frontend/Backend/Admin), estimate, blocker, acceptance criteria
- **Track FE** = REZ app (nuqta-master) or BiZone web (rez_v2)
- **Track BE** = Backend (rez-backend-master)
- **Track AD** = Admin panel (rez-admin-main)
- **Priority** = P0 (ship today) / P1 (this week) / P2 (this sprint)
- Estimates are in hours for a mid-level developer

---
---

# WEEK 1 — STOP THE BLEEDING
## All 8 bug fixes. No new features.

**Sprint goal:** App works correctly for every existing user.

---

### BUG-01 · Fix default region Dubai → Bangalore
**Track:** FE | **Estimate:** 1h | **Priority:** P0

**Files to change:**
1. `nuqta-master/stores/regionStore.ts` — line 38: `'dubai'` → `'bangalore'`
2. `nuqta-master/services/locationService.ts` — lines 30-34: Dubai coords → Bangalore coords
3. `nuqta-master/services/locationService.ts` — lines ~497-501: city fallback

**Acceptance criteria:**
- [ ] Fresh install with no stored preferences shows ₹ currency
- [ ] Location name shows "Bangalore" not "Dubai"
- [ ] Existing users with stored 'dubai' preference are NOT changed
- [ ] Run `npm run test:stores` — all pass

**Zero-break check:** `regionStore._initialize()` reads AsyncStorage first. Existing users unaffected. ✅

---

### BUG-02 · Fix coin button → goes to wallet
**Track:** FE | **Estimate:** 0.5h | **Priority:** P0

**Files to change:**
1. `nuqta-master/app/(tabs)/index.tsx` — `handleCoinPress` line ~457: `/coins` → `/wallet-screen`
2. `nuqta-master/components/homepage/HomeHeader.tsx` — coin `onPress` line ~166: `/coins` → `/wallet-screen`
3. `nuqta-master/app/coins.tsx` — replace entire file with `<Redirect href="/wallet-screen" />`

**Acceptance criteria:**
- [ ] Tapping coin icon in header navigates to wallet-screen
- [ ] `/coins` URL redirects to `/wallet-screen`
- [ ] Wallet screen shows real data (not static images)
- [ ] Back navigation from wallet works correctly

---

### BUG-03 · Fix Deals tab 404
**Track:** FE + BE | **Estimate:** 4h | **Priority:** P0

**Files to create/change:**
1. CREATE `nuqta-master/app/deals/index.tsx` (4h) — see Phase 1.4 in rezv2.md for full component code
2. `nuqta-master/components/navigation/BottomNavigation.tsx` — add `/deals` case to `getActiveTab()`

**Backend check (0.5h):**
- Verify `GET /api/offers/bonus-zone` returns data — should work already
- Verify `GET /api/campaigns/active` exists — if not, check `campaignsRoutes.ts`

**Acceptance criteria:**
- [ ] Deals tab renders campaign cards (not blank)
- [ ] All 5 filter tabs work (All/Cashback/Bank/2×Coins/Festival)
- [ ] Bottom navigation Deals tab shows active state when on this page
- [ ] Empty state shows when no active campaigns
- [ ] Pull to refresh works

---

### BUG-04 · Fix savings streak not firing
**Track:** BE | **Estimate:** 3h | **Priority:** P0

**Files to change:**
1. `rez-backend-master/src/events/gamificationEventBus.ts` — add `'store_payment_confirmed'` to EventType union
2. `rez-backend-master/src/models/UserStreak.ts` — add `'savings'` to streakType enum
3. `rez-backend-master/src/services/streakService.ts` — add savings milestones config:
   ```typescript
   savings: [
     { day: 3,  coins: 20,  label: 'Saving Starter' },
     { day: 7,  coins: 50,  label: 'Week Warrior',  multiplier: 1.05 },
     { day: 21, coins: 150, label: 'Habit Builder',  multiplier: 1.10 },
     { day: 60, coins: 500, label: 'Savings Elite',  multiplier: 1.20 },
   ]
   ```
4. `rez-backend-master/src/events/handlers/streakHandler.ts` — add `store_payment_confirmed` mapping
5. `rez-backend-master/src/controllers/storePaymentController.ts` — add emit after line 1342 (commitTransaction)

**Acceptance criteria:**
- [ ] Make a payment at a store → `GET /api/streak/user` shows `savings.currentStreak` incremented
- [ ] Day 7 payment → coins automatically credited to wallet
- [ ] Streak breaks if no payment for 2+ days
- [ ] Existing streak data not corrupted (additive change)
- [ ] Write test: `npm run test:streak -- --grep "savings streak"`

---

### BUG-05 · Fix 7 niche booking pages use wrong endpoint
**Track:** FE | **Estimate:** 3h (0.5h × 7 files) | **Priority:** P0

**Files to change (all 7):**
1. `nuqta-master/app/beauty/BookAppointment.tsx`
2. `nuqta-master/app/fitness/book/[storeId].tsx`
3. `nuqta-master/app/healthcare/BookDoctor.tsx`
4. `nuqta-master/app/MainCategory/[slug]/BookService.tsx`
5. `nuqta-master/app/fashion/TryAndBuy.tsx`
6. `nuqta-master/app/entertainment/BookTickets.tsx`
7. `nuqta-master/app/education/EnrollClass.tsx`

**In each file:**
- Remove: `import { tableBookingApi } from '@/services/tableBookingApi'`
- Add: `import serviceAppointmentApi from '@/services/serviceAppointmentApi'`
- Replace: `tableBookingApi.create({...})` → `serviceAppointmentApi.create({storeId, serviceType, date, time, notes})`

**Acceptance criteria:**
- [ ] Book beauty appointment → appears in `serviceAppointments` collection (not `tableBookings`)
- [ ] Booking confirmation screen shows correct data
- [ ] Coins are issued after booking (25 coins via rewardEngine)
- [ ] Merchant can see booking in their BiZone appointments screen
- [ ] Regression: restaurant table booking still uses `tableBookingApi` (do NOT change)

---

### BUG-06 · Fix profile drawer design + data bugs
**Track:** FE | **Estimate:** 6h | **Priority:** P1

**Files to change:**
1. `nuqta-master/types/profile.types.ts` — add `tier?: string`, `creatorLevel?: number`
2. `nuqta-master/contexts/ProfileContext.tsx` — add tier mapping from `priveTier` field
3. `nuqta-master/data/profileData.ts` — line 82: `/Store` → `/store`; add change_password menu item
4. `nuqta-master/components/profile/ProfileMenuModal.tsx` — 10 changes (see rezv2.md section 1.7)

**Design spec (from rezv2.md 1.7):**
- `MODAL_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 360)` — was 0.88
- Header: dark navy `#1a3a52` → `#0D1F2D` gradient
- Menu background: `#0D1F2D` (dark)
- Menu items: flat dark rows, `hairlineWidth` separator
- Remove: "Quick Actions" title block (lines 815-820)
- Logout: simple red text row, no white card
- Creator level: dynamic from `user.creatorLevel`, not "Level 1"

**Acceptance criteria:**
- [ ] Drawer width feels like a side panel, not a full modal
- [ ] Dark navy header with gold accent for tier badge
- [ ] Creator level shows real data (or "Join Partner Program" if no level)
- [ ] Tier badge shows "REZ Member", "Privé", etc. from backend
- [ ] Change Password appears in menu and navigates to correct page
- [ ] `/store` route works (lowercase)

---

### BUG-07 · Fix three account pages never load data
**Track:** FE | **Estimate:** 2h | **Priority:** P1

**Files to change:**
1. `nuqta-master/app/account/notification-history.tsx` — add `useEffect` with `apiClient.get('/notifications/history')`
2. `nuqta-master/app/account/profile.tsx` — add ImagePicker photo upload (full code in rezv2.md 1.8)
3. `nuqta-master/app/account/delete-account.tsx` — add specific error messages for active orders/wallet balance

**Acceptance criteria:**
- [ ] Notification history page shows real notifications (not always empty)
- [ ] Profile photo can be selected and uploaded
- [ ] Uploading photo shows spinner, success state
- [ ] Delete account shows "You have 2 active orders" not generic error
- [ ] Pull to refresh on notification history re-fetches

---

### BUG-08 · Remove China region, Dubai = Coming Soon
**Track:** FE + BE | **Estimate:** 1.5h | **Priority:** P1

**Files to change:**
1. `nuqta-master/stores/regionStore.ts` — remove 'china' from RegionId type
2. `nuqta-master/components/RegionSelector.tsx` — Dubai = greyed + "Coming Soon" badge
3. `nuqta-master/components/profile/ProfileMenuModal.tsx` — same in REGIONS_DATA
4. `rez-backend-master/src/config/regions.ts` — china.isActive = false, dubai.isActive = false

**Acceptance criteria:**
- [ ] RegionSelector shows only India (active) and Dubai (greyed, "Coming Soon")
- [ ] China does not appear anywhere in the app
- [ ] Dubai tap shows "Coming in 2027" toast
- [ ] `GET /api/location/regions` returns only India (isActive:true)
- [ ] Existing users who had 'china' or 'dubai' selected → fallback to 'bangalore'

---

## WEEK 1 CHECKLIST
- [ ] All 8 bugs fixed and deployed to staging
- [ ] QA sign-off: test each bug fix acceptance criterion
- [ ] No regressions in restaurant table booking, wallet, or auth flows
- [ ] Deploy to production

---
---

# WEEK 2 — LOCATION UPGRADE
## Neighbourhood display + auto-switch + serviceable area

---

### LOC-01 · Add neighbourhood to geocoding
**Track:** BE | **Estimate:** 3h | **Priority:** P1

**Files to change:**
1. `rez-backend-master/src/services/geocodingService.ts`
   - In `reverseGeocodeGoogle()`: add `sublocality_level_1` extraction before city (lines 79-107)
   - In `reverseGeocodeOpenCage()`: extract `neighbourhood || suburb || quarter` (lines 128-145)
2. `nuqta-master/types/location.types.ts` — add optional `neighbourhood?: string` field

**Acceptance criteria:**
- [ ] `POST /api/location/reverse-geocode` for BTM Layout coords returns `neighbourhood: "BTM Layout"`
- [ ] Existing `city` field still populated correctly
- [ ] OpenCage fallback also returns neighbourhood
- [ ] `neighbourhood` field is optional — existing code reading `address.city` unaffected

---

### LOC-02 · Show neighbourhood in header
**Track:** FE | **Estimate:** 1h | **Priority:** P1

**Files to change:**
1. `nuqta-master/components/location/LocationDisplay.tsx` — `getLocationText()` (lines 307-341):
   ```typescript
   if (addr.neighbourhood) return addr.neighbourhood;
   if (addr.city) return addr.city;
   ```

**Acceptance criteria:**
- [ ] Header shows "BTM Layout" not "Bangalore" for BTM Layout coordinates
- [ ] Header shows "Bangalore" for coordinates without neighbourhood data
- [ ] Location picker modal shows neighbourhood in search results

---

### LOC-03 · Create serviceabilityCheck utility
**Track:** FE | **Estimate:** 2h | **Priority:** P1

**File to create:** `nuqta-master/utils/serviceabilityCheck.ts`

```typescript
export async function checkAreaServiceability(lat: number, lng: number) {
  try {
    const res = await apiClient.get('/stores/nearby', { lat, lng, radius: 5000, limit: 1 });
    const count = res.data?.stores?.length ?? 0;
    return { isServiceable: count > 0, suggestedMode: count > 0 ? 'near-u' : 'mall' as const };
  } catch {
    return { isServiceable: true, suggestedMode: 'near-u' as const };
  }
}
```

**Wire into `(tabs)/index.tsx`:**
- After location loads, call `checkAreaServiceability(lat, lng)`
- If not serviceable AND activeTab === 'near-u': auto-switch to 'mall'
- Store `isAreaServiceable` in component state

**Acceptance criteria:**
- [ ] User in BTM Layout → Near U tab loads (stores exist)
- [ ] User in area with no stores → auto-switches to Mall tab
- [ ] Auto-switch happens only once per session (use `serviceabilityChecked` flag)
- [ ] Network failure → fail open (assume serviceable)

---

### LOC-04 · Add Coming Soon banner in Near U
**Track:** FE | **Estimate:** 2h | **Priority:** P1

**File to change:** `nuqta-master/components/homepage/NearUTabContent.tsx`

**Banner design:**
```
📍 Near U is coming soon in [neighbourhood || "your area"]
Shop from top brands on REZ Mall meanwhile.
[Mall →] [✕ dismiss]
```
- Yellow `#FFF3CD` background
- Dismissable (stored in AsyncStorage for 7 days)
- Shows only when `isAreaServiceable === false`

**Acceptance criteria:**
- [ ] Banner shows in unserviceable areas with correct neighbourhood name
- [ ] "Mall →" tap switches to Mall tab
- [ ] "✕" dismisses banner and doesn't show again for 7 days
- [ ] Banner never shows in serviceable areas

---

## WEEK 2 CHECKLIST
- [ ] Neighbourhood shows correctly in header for Bangalore suburbs
- [ ] Auto-switch to Mall works in test area with no stores
- [ ] Coming Soon banner tested and styled
- [ ] Deploy to staging and production

---
---

# WEEKS 3-4 — PRIVÉ PHASE 1
## Backend models + routes first (Week 3), frontend (Week 4)

**IMPORTANT:** Set feature flag `FEATURE_PRIVE_CAMPAIGNS=false` before ANY of this ships.

---

### PRIVE-01 · Create PriveCampaign + PrivePostSubmission models
**Track:** BE | **Estimate:** 4h | **Priority:** P1 | **Blocks:** PRIVE-02 through PRIVE-08

**Files to create:**
1. `rez-backend-master/src/models/PriveCampaign.ts` — full schema from rezv2.md Phase 3.2
2. `rez-backend-master/src/models/PrivePostSubmission.ts` — full schema from rezv2.md Phase 3.2

**Required indexes (see Doc 6 for full details):**
```typescript
// PriveCampaign indexes:
PriveCampaignSchema.index({ merchantId: 1, status: 1 });
PriveCampaignSchema.index({ status: 1, validTo: 1 });
PriveCampaignSchema.index({ minPriveTier: 1, status: 1 });

// PrivePostSubmission indexes:
PrivePostSubmissionSchema.index({ campaignId: 1, userId: 1 }, { unique: true });
PrivePostSubmissionSchema.index({ status: 1, submittedAt: -1 });
PrivePostSubmissionSchema.index({ userId: 1, status: 1 });
```

**Acceptance criteria:**
- [ ] `PriveCampaign.create({...})` succeeds with all required fields
- [ ] Duplicate campaignId+userId in PrivePostSubmission throws E11000 (unique index)
- [ ] `npm run test:models` passes
- [ ] No existing models broken (additive change)

---

### PRIVE-02 · Create priveCampaignRoutes.ts (user-facing)
**Track:** BE | **Estimate:** 6h | **Priority:** P1 | **Blocked by:** PRIVE-01

**File to create:** `rez-backend-master/src/routes/priveCampaignRoutes.ts`

**Routes (exact signatures from Doc 4):**
```
GET  /api/prive/campaigns
GET  /api/prive/campaigns/:id
POST /api/prive/campaigns/:id/join
POST /api/prive/campaigns/:id/submit   (multipart)
GET  /api/prive/campaigns/:id/status
GET  /api/prive/earnings
```

**Register in `config/routes.ts`:**
```typescript
app.use(`${API_PREFIX}/prive/campaigns`, priveCampaignRoutes);
```

**Behind feature flag:** wrap all routes with `requireFeatureFlag('priveCampaignsEnabled')`

**Cashback on approval:**
```typescript
// In approveSubmission controller:
await rewardEngine.issue({
  userId, amount: cashbackAmount,
  rewardType: 'prive_campaign', coinType: 'rez',
  source: `prive_campaign:${campaignId}`,
  metadata: { campaignId, merchantId }
});
```

**Note:** Add `'prive_campaign'` to `RewardType` in `core/rewardEngine.ts`

**Acceptance criteria:**
- [ ] `GET /api/prive/campaigns` requires valid Prive JWT, returns campaigns array
- [ ] `POST /api/prive/campaigns/:id/join` creates submission record with status='joined'
- [ ] `POST /api/prive/campaigns/:id/submit` uploads screenshot to Cloudinary, saves postUrl
- [ ] Approval triggers `rewardEngine.issue()` and push notification
- [ ] All routes behind `FEATURE_PRIVE_CAMPAIGNS` flag
- [ ] Unit tests in `test/prive-campaigns.test.ts`

---

### PRIVE-03 · Create merchantroutes/priveModule.ts
**Track:** BE | **Estimate:** 4h | **Priority:** P1 | **Blocked by:** PRIVE-01

**File to create:** `rez-backend-master/src/merchantroutes/priveModule.ts`

**Routes:**
```
GET  /api/merchant/prive/campaigns
POST /api/merchant/prive/campaigns
PUT  /api/merchant/prive/campaigns/:id
GET  /api/merchant/prive/submissions
PUT  /api/merchant/prive/submissions/:id/approve
PUT  /api/merchant/prive/submissions/:id/reject
```

**Register in `config/routes.ts`:**
```typescript
app.use(`${API_PREFIX}/merchant/prive`, merchantPriveRoutes);
```

**Budget validation on approve:**
```typescript
// Check budgetUsed + estimatedCashback <= budget before approving
if (campaign.budgetUsed + cashbackAmount > campaign.budget) {
  return res.status(400).json({ error: 'BUDGET_EXHAUSTED' });
}
```

**Acceptance criteria:**
- [ ] `POST /api/merchant/prive/campaigns` creates campaign with `status: 'pending_approval'`
- [ ] Merchant approve triggers user cashback via rewardEngine
- [ ] Budget exhaustion check prevents over-spending
- [ ] Merchant cannot approve their own campaign without admin approval first

---

### PRIVE-04 · Add admin Prive submissions review route
**Track:** BE + AD | **Estimate:** 4h | **Priority:** P1 | **Blocked by:** PRIVE-01

**Backend: add to `routes/admin/priveAdmin.ts`:**
```typescript
router.get('/campaign-submissions', requireOperator, getSubmissionsQueue);
router.put('/campaign-submissions/:id/approve', requireOperator, adminApproveSubmission);
router.put('/campaign-submissions/:id/reject', requireOperator, adminRejectSubmission);
```

**Admin screen to create:** `rez-admin-main/app/(dashboard)/prive-submissions.tsx`
- List view with tabs: Pending | Approved | Rejected
- Each card: user info, followers, post screenshot, post URL link, cashback amount, approve/reject buttons
- Batch approve option for efficiency

**Acceptance criteria:**
- [ ] Admin can see pending submissions with fraud score
- [ ] Admin approve triggers cashback (same as merchant approve)
- [ ] Admin reject sends "feedback" push notification to user
- [ ] Stats bar shows: pending count, approved today, total pending cashback

---

### PRIVE-05 · Frontend: Privé score + tier display
**Track:** FE | **Estimate:** 3h | **Priority:** P1 | **Blocked by:** PRIVE-02

**Files to change:**
1. `nuqta-master/hooks/usePriveEligibility.ts` — verify score + tier are exposed from `GET /api/prive/access`
2. `nuqta-master/components/prive/PriveHeaderWrapper.tsx` — connect `PriveProgressRing` to real score
3. `nuqta-master/components/prive/PriveProgressRing.tsx` — verify it accepts `score` and `tier` props

**Design (from v2 PriveHome.jsx):**
```
Score: 847/1000  [████████░░░░]  2,800 to Elite
Tier badge: "Signature"
```

**Acceptance criteria:**
- [ ] Privé tab header shows real score from `GET /api/prive/access`
- [ ] Progress ring animates on load
- [ ] "X points to Elite" shown dynamically
- [ ] Score 0 shows "Start earning to build your REZ score"
- [ ] Non-Prive users see the locked/teaser state

---

### PRIVE-06 · Frontend: Campaign list + detail screens
**Track:** FE | **Estimate:** 8h | **Priority:** P1 | **Blocked by:** PRIVE-02

**Files to create:**
1. `nuqta-master/app/prive/campaigns/index.tsx` — campaign list
2. `nuqta-master/app/prive/campaigns/[id].tsx` — campaign detail
3. `nuqta-master/services/priveCampaignApi.ts` — API client

**Campaign card design:**
```
[Merchant logo]  Smoke House Deli
                 Valentine's Dining Experience
                 📸 Post reel/story  •  Min ₹1,500
[Slots: 8/20]   [Earn: Up to ₹525 cashback]
[Join Campaign]
```

**Campaign detail sections:**
1. Hero: merchant photo, title, reward summary
2. Task steps (numbered list from `campaign.taskSteps`)
3. Requirements: minimum spend, post type, followers needed
4. Reward breakdown: coins earned immediately + cashback on approval
5. How it works (collapsible)
6. Join/Already Joined CTA

**Acceptance criteria:**
- [ ] Campaign list loads from API, shows 3 tabs: Available | Joined | Completed
- [ ] Campaign detail shows all task steps and requirements
- [ ] Join tap calls POST /api/prive/campaigns/:id/join
- [ ] Error states: slots full, tier insufficient, not in Prive
- [ ] Loading skeletons during fetch

---

### PRIVE-07 · Frontend: Post submission + status screens
**Track:** FE | **Estimate:** 6h | **Priority:** P1 | **Blocked by:** PRIVE-06

**Files to create:**
1. `nuqta-master/app/prive/campaigns/submit.tsx` — post submission form
2. `nuqta-master/app/prive/campaigns/status.tsx` — verification status tracker

**Submit screen:**
- Text input for Instagram post URL (with validation: must be instagram.com URL)
- ImagePicker for post screenshot (required)
- Optional order reference (for verified purchase link)
- Optional notes field
- Submit button → calls POST /api/prive/campaigns/:id/submit

**Status screen:**
- Visual progress tracker: Submitted → Under Review → Approved/Rejected
- Timer showing review SLA (48 hours)
- If approved: confetti + cashback amount credited
- If rejected: reason + option to resubmit

**Acceptance criteria:**
- [ ] URL validation rejects non-Instagram URLs
- [ ] Screenshot upload shows progress indicator
- [ ] Successful submission → navigates to status screen
- [ ] Status screen auto-refreshes every 30 seconds while pending
- [ ] Approved state shows exact cashback amount credited

---

### PRIVE-08 · Frontend: Earnings history screen
**Track:** FE | **Estimate:** 3h | **Priority:** P2 | **Blocked by:** PRIVE-07

**File to create:** `nuqta-master/app/prive/earnings.tsx`

**Design:** Summary cards at top (total earned, pending, this month), then chronological list of earnings.

**Acceptance criteria:**
- [ ] Earnings list loads from `GET /api/prive/earnings`
- [ ] Summary cards show correct totals
- [ ] Tapping an earning navigates to that campaign's status
- [ ] Empty state: "Complete your first campaign to see earnings here"

---

## WEEKS 3-4 CHECKLIST
- [ ] `FEATURE_PRIVE_CAMPAIGNS=false` in all environments before any deploy
- [ ] PriveCampaign + PrivePostSubmission models created with correct indexes
- [ ] All 6 user routes + 6 merchant routes working (test via Postman)
- [ ] Admin submissions queue screen working
- [ ] Frontend: campaign list, detail, submit, status, earnings screens
- [ ] End-to-end test: join → submit → admin approve → cashback credited
- [ ] Set `FEATURE_PRIVE_CAMPAIGNS=true` in STAGING ONLY for QA
- [ ] Full QA sign-off before setting true in production

---
---

# WEEKS 4-6 — BIZONE P1
## Runs parallel with Privé — separate dev track

---

### BZ-01 · Merchant Auth screens
**Track:** FE (BiZone) | **Estimate:** 6h | **Priority:** P1

**Files to create (in rez_v2/src or new BiZone React Native app):**
1. `auth/MerchantSignup.jsx` — wire to `POST /api/merchant/auth/register`
2. `auth/MerchantBusinessDetails.jsx` — complete profile step
3. `auth/MerchantSuccess.jsx` — welcome + first steps checklist

**MerchantSignup fields:** business name, owner name, email, phone, password, business type dropdown

**MerchantBusinessDetails fields:** GST number (optional), PAN, full address with pin code, Google Maps pin

**MerchantSuccess checklist:**
- [ ] Add your first product or menu item
- [ ] Create your first offer
- [ ] Download BiZone app (QR code to merchant mobile app)

**Acceptance criteria:**
- [ ] Full signup flow completes in under 3 minutes
- [ ] JWT stored securely after successful register + login
- [ ] Business type dropdown: Restaurant | Café | Salon | Fitness | Retail | Healthcare | Other
- [ ] Validation on all required fields with inline error messages
- [ ] "Already have an account? Login" link works

---

### BZ-02 · Merchant Dashboard
**Track:** FE (BiZone) | **Estimate:** 8h | **Priority:** P1 | **Blocked by:** BZ-01

**File to create/wire:** `dashboard/MerchantDashboard.jsx` → `GET /api/merchant/dashboard`

**6 stat cards (from Doc 4 P4-02 response):**
1. Today's Revenue (with vs yesterday)
2. Active Orders (with pending badge)
3. REZ Coins Issued today
4. Customer Visits (new vs returning)
5. Wallet Balance (available)
6. Active Offers count

**Timeframe tabs:** Today | 7 Days | 30 Days

**Recent Transactions list:** last 5 payments with amount, customer phone (masked), coins issued

**Acceptance criteria:**
- [ ] All 6 cards populate from real API data
- [ ] Timeframe switching updates all stats
- [ ] Loading skeleton visible during data fetch
- [ ] Pull to refresh works
- [ ] Revenue shows ₹ format with commas (₹24,500 not 24500)
- [ ] Empty state if no orders today (not broken UI)

---

### BZ-03 · Merchant Simple POS
**Track:** FE (BiZone) | **Estimate:** 10h | **Priority:** P1

**File to create/wire:** `pos/MerchantSimplePOS.jsx`

**POS flow (from v2 design):**
1. Product search → `GET /api/merchant/products?pos=true&search=query`
2. Add to cart (quantity +/−)
3. Customer lookup by phone (optional) → shows coin balance
4. Coin redemption toggle (how many coins to use)
5. Payment method: UPI | Card | Cash
6. Generate QR → `POST /api/store-payment/create-bill`
7. Wait for payment confirmation (poll or WebSocket)
8. Show success: coins issued to customer

**Acceptance criteria:**
- [ ] Product search works with partial name match
- [ ] Cart shows running total with coin discount applied
- [ ] QR code displays correctly (scannable by user app)
- [ ] Payment confirmation shows within 5 seconds of user scanning
- [ ] Bill reference number shown on success screen
- [ ] "New Bill" resets cart completely

---

### BZ-04 · Merchant Offline POS + Sync
**Track:** FE (BiZone) + BE | **Estimate:** 8h | **Priority:** P1

**Files to create:**
1. `pos/MerchantOfflinePOS.jsx` — same as SimplePOS but works without internet
2. `pos/MerchantOfflinePOSSync.jsx` — sync queue management screen

**Offline-first logic:**
```typescript
// In offline POS:
const saveBillLocally = async (bill) => {
  const queue = await AsyncStorage.getItem('offline_queue') || '[]';
  const parsed = JSON.parse(queue);
  parsed.push({ ...bill, offlineId: Date.now(), synced: false });
  await AsyncStorage.setItem('offline_queue', JSON.stringify(parsed));
};

// Sync when back online:
const syncOfflineQueue = async () => {
  // POST /api/merchant/sync with all unsynced bills
};
```

**Backend:** Verify `POST /api/merchant/sync` accepts array of offline bills

**Acceptance criteria:**
- [ ] Offline POS works with airplane mode ON
- [ ] Bills saved locally while offline
- [ ] When connectivity restored, sync screen shows pending count
- [ ] Manual "Sync Now" button + automatic sync on app foreground
- [ ] Synced bills appear in orders dashboard
- [ ] Conflict handling: if bill already exists (duplicate), skip gracefully

---

### BZ-05 · Merchant Orders Management
**Track:** FE (BiZone) | **Estimate:** 8h | **Priority:** P1

**File to create/wire:** `orders/MerchantOrders.jsx` → connects to:
- `GET /api/merchant/orders` (polling or WebSocket)
- `PUT /api/merchant/orders/:id/status`

**4-tab layout:** New (with badge count) | Preparing | Ready | Completed

**Order card shows:** customer phone (masked), items list, total, order type badge (Dine-in/Delivery/Takeaway), time placed, action buttons

**Status update buttons per tab:**
- New: [Accept] [Reject]
- Preparing: [Ready in X min] → opens estimated time picker
- Ready: [Delivered/Picked Up]

**Acceptance criteria:**
- [ ] New orders appear in real-time (WebSocket or 10s polling)
- [ ] Badge count on "New" tab updates in real-time
- [ ] Status update fires push notification to customer
- [ ] Completed orders show total revenue for the day
- [ ] Empty state per tab (not broken UI)

---

### BZ-06 · Merchant Create Offer
**Track:** FE (BiZone) | **Estimate:** 6h | **Priority:** P1

**File to create/wire:** `offers/CreateOffer.jsx` → `POST /api/merchant/offers`

**5 offer types with dedicated form sections:**
1. Flat discount: title, ₹X off, min order value, date range
2. % discount: title, % off, max discount cap, date range
3. BOGO: title, applicable product, date range
4. Coin multiplier: title, multiplier (2×/3×/5×), date range, hours active
5. Locked deal: title, discount, "REZ users only" toggle

**Preview card:** shows how offer appears to REZ users before publishing

**Acceptance criteria:**
- [ ] All 5 offer types have correct form fields
- [ ] Preview card updates in real-time as form is filled
- [ ] Submit creates offer with `status: 'pending_approval'`
- [ ] Success screen: "Offer submitted! Usually approved within 4 hours."
- [ ] Validation: date range (from must be before to), discount % 1-99, min order ≥ 0

---

### BZ-07 · Merchant Appointments + Booking Calendar
**Track:** FE (BiZone) | **Estimate:** 8h | **Priority:** P1

**Files to create/wire:**
1. `customers/MerchantAppointments.jsx` → `GET /api/merchant/customers/appointments`
2. `customers/MerchantBookingCalendar.jsx` — visual calendar with appointment slots

**Appointments list:**
- Filter by date (date picker)
- Filter by status (confirmed/completed/cancelled)
- Each row: customer name (masked), service, time, staff, amount, status badge

**Booking calendar:**
- Weekly view with time slots
- Filled slots show customer initials
- Tap slot → appointment detail
- "Block time" button (e.g., maintenance)

**Acceptance criteria:**
- [ ] Today's appointments load correctly for a beauty/fitness/healthcare merchant
- [ ] Calendar weekly view renders 8 AM to 9 PM time grid
- [ ] Tapping appointment shows full detail + cancel option
- [ ] Marking as completed updates status + issues customer coins
- [ ] Count badge on "Today" tab

---

### BZ-08 · Merchant Wallet + Day-End Report
**Track:** FE (BiZone) | **Estimate:** 6h | **Priority:** P1

**Files to create/wire:**
1. `advanced/MerchantWallet.jsx` → `GET /api/merchant/wallet`
2. `advanced/MerchantDayEndReport.jsx` → `GET /api/merchant/dashboard` (today period)

**Wallet screen sections:**
- Balance card: Available ₹ | Pending Clearance ₹ | Total Month
- Transactions list (from `GET /api/merchant/wallet/transactions`)
- Withdraw button → min ₹500 → `POST /api/merchant/wallet/withdraw`
- Settlement timeline: when money arrives

**Day-End Report:**
- Total cash collected, card payments, UPI, coin redemptions
- Net revenue after commission
- Coins issued to customers
- Export as PDF button

**Acceptance criteria:**
- [ ] Wallet balance shows correctly
- [ ] Withdrawal request sends and shows "processing" status
- [ ] Day-end report tallies match orders total
- [ ] PDF export generates (use react-native-print or similar)

---

### BZ-09 · Merchant Review Management
**Track:** FE (BiZone) | **Estimate:** 4h | **Priority:** P1

**File to create/wire:** `advanced/MerchantReviews.jsx` → `GET /api/merchant/reviews`

**Review card:** star rating, review text, customer name (masked), date, reply box

**Acceptance criteria:**
- [ ] All reviews load with star ratings
- [ ] Merchant can type and submit a reply
- [ ] 5-star reviews highlighted
- [ ] Average rating shown at top
- [ ] Flag button for abusive reviews

---

## WEEKS 4-6 CHECKLIST
- [ ] Merchant can sign up, complete profile, see "store is live"
- [ ] Dashboard shows real data with all 6 stat cards
- [ ] Simple POS: product → cart → QR → payment confirmed → coins issued
- [ ] Offline POS works in airplane mode and syncs on reconnect
- [ ] Orders: real-time updates, status flow working
- [ ] Create Offer: all 5 types work, pending approval status
- [ ] Appointments: list and calendar for service merchants
- [ ] Wallet: balance, transactions, withdrawal
- [ ] Reviews: list, reply, flag
- [ ] End-to-end: merchant creates offer → admin approves → user sees offer in Deals tab

---
---

# WEEKS 7-8 — ADMIN COMPLETIONS
## Coin management system + Prive approval queue + Campaign approval

---

### ADM-01 · Admin: Coin System Overview
**Track:** AD | **Estimate:** 5h | **Priority:** P1

**File to create:** `rez-admin-main/app/(dashboard)/coin-overview.tsx`
- 4 coin type cards (REZ/Branded/Promo/Privé) with: total issued, redeemed, active balance, redemption rate
- Real-time issued/redeemed today
- Kill switch toggle (calls `POST /api/admin/coins/emergency/pause`)

**Acceptance criteria:**
- [ ] All 4 coin types shown with correct data from `GET /api/admin/coins/overview`
- [ ] Kill switch requires confirmation dialog before activating
- [ ] Kill switch shows reason text field
- [ ] Page auto-refreshes every 30 seconds

---

### ADM-02 · Admin: Coin Rules Engine
**Track:** AD + BE | **Estimate:** 8h | **Priority:** P1

**Backend:** Create `GET/PUT /api/admin/coins/rules` endpoints
**Admin file to create:** `rez-admin-main/app/(dashboard)/coin-rules.tsx`

**3 tabs:**
1. Expiry rules: per coin type — days, rollover allowed, warning days
2. Multiplier rules: name, coin type, multiplier, conditions, validity
3. Daily caps: per user, per day, per transaction

**Acceptance criteria:**
- [ ] Expiry rules save and are used by `coinService.ts`
- [ ] Weekend 2× multiplier can be created and activated
- [ ] Daily cap change takes effect on next transaction (not retroactive)
- [ ] All changes create audit log entries

---

### ADM-03 · Admin: Campaign Approval Queue
**Track:** AD | **Estimate:** 4h | **Priority:** P1

**File to create:** `rez-admin-main/app/(dashboard)/campaign-approval.tsx`

**Connects to:** `GET /api/admin/merchants/offers?status=pending_approval`

**Shows:** offer title, merchant name, offer type, discount value, date range, [Approve] [Reject] buttons

**Acceptance criteria:**
- [ ] Pending campaigns list loads (offers with status=pending_approval)
- [ ] Approve → status becomes 'active', merchant notified, offer visible to users
- [ ] Reject → reason required, merchant notified
- [ ] Batch approve (select all + approve)

---

### ADM-04 · Admin: Merchant Tier Config
**Track:** AD + BE | **Estimate:** 6h | **Priority:** P1

**Backend:** Create `GET/PUT /api/admin/merchant-tiers` endpoint
**Admin file to create:** `rez-admin-main/app/(dashboard)/merchant-tier-config.tsx`

**3 tiers:** Free (default) | Pro | Enterprise

**Per tier config:**
- Commission: total % + breakdown (REZ coins % + Branded coins % + to-REZ %)
- Features enabled (BiZone modules)
- Monthly fee (₹0 for Free)

**Acceptance criteria:**
- [ ] Current commission rates visible and editable
- [ ] Change takes effect on next settlement cycle (not retroactive)
- [ ] Audit trail: who changed what, when
- [ ] Individual merchant override: assign specific merchant to a specific tier

---

### ADM-05 · Admin: Finance Dashboard + Settlement
**Track:** AD | **Estimate:** 6h | **Priority:** P1

**File to create:** `rez-admin-main/app/(dashboard)/finance-dashboard.tsx`

**Connects to:** existing `GET /api/admin/dashboard` + new settlement endpoints

**Shows:**
- Today's GMV (₹)
- Platform commission earned
- Pending merchant payouts
- Coin economy cost (coins issued × ₹0.01 effective cost)
- Net platform revenue

**Settlement section:**
- Pending withdrawal requests list
- Approve/process individual or batch

**Acceptance criteria:**
- [ ] All financial KPIs load from API
- [ ] Merchant payout list filterable by status
- [ ] "Process All Pending" batch action
- [ ] Settlement creates audit log

---

## WEEKS 7-8 CHECKLIST
- [ ] Coin overview dashboard working with kill switch
- [ ] Coin rules engine configurable by admin
- [ ] Campaign approval queue clears pending offers
- [ ] Merchant tier config saves and applies
- [ ] Finance dashboard shows real revenue data
- [ ] All admin changes create audit log entries

---
---

# WEEKS 9-10 — NEAR U COMPLETENESS + POLISH

---

### NEU-01 · Stories Row (What's New)
**Track:** FE | **Estimate:** 4h | **Priority:** P2

**File to create:** `nuqta-master/components/whats-new/StoriesRow.tsx`

**Design:**
- Horizontal ScrollView of 60px circles
- Gradient ring = unseen content, grey ring = seen
- ViewedIds stored in AsyncStorage

**Acceptance criteria:**
- [ ] Stories Row renders below header in Near U tab
- [ ] Gradient ring shows for unviewed stories
- [ ] Tap opens WhatsNewStoriesFlow at correct startIndex
- [ ] Viewed state persists across app restarts
- [ ] Old WhatsNewBadge text completely removed

---

### NEU-02 · Daily Check-in
**Track:** FE + BE | **Estimate:** 4h | **Priority:** P2

**Files:**
1. Create `nuqta-master/app/daily-checkin.tsx`
2. Add `POST /api/activities/checkin` if not exists (check `activityRoutes.ts`)

**30-day calendar strip design:**
- Day 1=5 coins, Day 3=10, Day 7=25, Day 14=50, Day 30=200
- Claimed days show checkmark + coin amount
- Today's day highlighted with CTA button

**Acceptance criteria:**
- [ ] Calendar shows 30-day grid
- [ ] Claiming awards correct coins per day milestone
- [ ] Cannot claim same day twice
- [ ] Missed days show as blank (no retroactive claiming)
- [ ] Streak count shown

---

### NEU-03 · Map View for Local Stores
**Track:** FE | **Estimate:** 6h | **Priority:** P2

**File to create:** `nuqta-master/app/explore/map.tsx`
**Package:** `npx expo install react-native-maps`

**Map features:**
- User's current location pin
- Store pins with category color coding
- Cashback % callout bubble on tap
- Filter by category buttons
- Tap → navigate to `/store/[id]`

**Acceptance criteria:**
- [ ] Map loads centered on user's current location
- [ ] Nearby stores (5km radius) shown as pins
- [ ] Cashback callout visible on pin tap
- [ ] Category filter shows/hides relevant pins
- [ ] Permissions handled gracefully (location denied state)

---

### NEU-04 · Bill Splitting (Wallet)
**Track:** FE + BE | **Estimate:** 5h | **Priority:** P2

**File to create:** `nuqta-master/app/wallet/bill-split.tsx`
**Backend:** Verify `POST /api/wallet/split` exists (check walletRoutes.ts)

**Flow:**
1. Enter total bill amount
2. Add friends by phone number (+ from contacts)
3. Split equally or enter custom amounts
4. Each person gets REZ notification to pay their share

**Acceptance criteria:**
- [ ] Split created and each participant notified
- [ ] Splitting creates Transfer records in DB
- [ ] Payment status shows: pending/paid per person
- [ ] Creator can send reminder to unpaid participants

---

### NEU-05 · Wallet Mode-Aware UX
**Track:** FE | **Estimate:** 3h | **Priority:** P2

**File to change:** `nuqta-master/app/wallet-screen.tsx`

**Mode detection:** use `activeTab` from home tab store

**Visual changes per mode:**
- Near U (red + white): "You saved ₹450 today" hero message
- Mall (clean + premium): brand cashback breakdown
- Privé (dark + gold): prestige/exclusive language, Privé coin display
- Cash Store (teal): pending cashback timeline

**Acceptance criteria:**
- [ ] Wallet header language changes per active mode
- [ ] Privé mode shows dark background with gold accents
- [ ] Coin type displayed prominently matches mode
- [ ] No functional changes — data is the same, only presentation changes

---

## WEEKS 9-10 CHECKLIST
- [ ] Stories Row replaces What's New badge
- [ ] Daily check-in works and awards coins
- [ ] Map view shows stores near user
- [ ] Bill splitting creates transfer requests
- [ ] Wallet mode-aware UX works for all 4 modes
- [ ] All features behind feature flags
- [ ] Full regression test of all Phase 1-4 features
- [ ] Performance test: app startup time < 3 seconds
- [ ] Final QA + production deploy

---
---

# TASK SUMMARY TABLE

| Week | Tasks | FE | BE | AD | Priority |
|------|-------|----|----|----|----------|
| 1 | 8 bug fixes | 5 | 3 | 0 | P0/P1 |
| 2 | Location (4 tasks) | 3 | 1 | 0 | P1 |
| 3 | Privé backend (4 tasks) | 0 | 4 | 1 | P1 |
| 4 | Privé frontend (4 tasks) | 4 | 0 | 0 | P1 |
| 4-5 | BiZone auth + dashboard + POS (3 tasks) | 3 | 0 | 0 | P1 |
| 5-6 | BiZone orders + offers + appointments + wallet (6 tasks) | 6 | 0 | 0 | P1 |
| 7-8 | Admin completions (5 tasks) | 0 | 2 | 3 | P1 |
| 9-10 | Near U completeness (5 tasks) | 5 | 1 | 0 | P2 |
| **Total** | **39 tasks** | **26** | **11** | **4** | |

---

*REZ Sprint Task Register (Doc 5) · March 2026*
*39 tasks · 10 weeks · Full acceptance criteria · No guesswork*
