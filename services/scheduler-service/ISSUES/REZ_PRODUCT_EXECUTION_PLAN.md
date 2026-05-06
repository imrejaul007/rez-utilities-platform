# REZ Product Execution Plan — From Feature App to Habit Platform

**Date:** March 26, 2026
**Prepared by:** Product Team (Strategic Analysis)
**Objective:** Close the gap between REZ's business vision ("default smart spending habit") and current code reality ("feature-rich but unfocused super-app")

---

## Executive Summary

REZ has built impressive infrastructure across 5 apps, 60+ background jobs, 4 coin types, and hundreds of screens. But the core thesis from the business analysis — **"win by becoming a spending habit, not a feature app"** — is being undermined by scope sprawl. This plan prioritizes the **habit formation loop** above all else.

### The Core Problem

```
WHAT THE PDF SAYS REZ MUST BE:
"Before I spend anywhere offline — I check REZ" (Default reflex)

WHAT THE CODE CURRENTLY IS:
A feature-rich platform with cashback + ordering + booking + POS +
fintech + travel + insurance + gold savings + creator economy +
mall + 22 planned vertical apps
```

### The Fix: 4 Phases over 16 weeks

| Phase | Name | Duration | Focus |
|-------|------|----------|-------|
| 0 | Critical Fixes | Week 1-2 | Fix live bugs that break trust |
| 1 | Habit Engine | Week 3-8 | Build the core habit loop |
| 2 | Intelligence Layer | Week 9-12 | Smart spending companion |
| 3 | Growth Mechanics | Week 13-16 | Social proof + viral loops |

---

## PHASE 0: CRITICAL FIXES (Week 1-2)

> These are trust-breaking bugs identified in existing audits. Users and merchants will not form habits on broken infrastructure.

### 0.1 Production Blockers (from FULL_AUDIT_REPORT.md)

| # | Issue | File | Impact |
|---|-------|------|--------|
| 0.1.1 | OTP bypass active when NODE_ENV not set | `rezbackend/src/middleware/auth.ts` | **SECURITY: Anyone can bypass auth** |
| 0.1.2 | Balance calculation backwards in walletPaymentController | `walletPaymentController.ts` | Users see wrong balance |
| 0.1.3 | Error handler placed before routes in server.ts | `server.ts` | All errors swallowed silently |
| 0.1.4 | Dubai region default (India users get AED) | `config/regions.ts` | Wrong currency for Indian users |
| 0.1.5 | Coin button goes to static images instead of wallet | Consumer app navigation | Core feature broken |
| 0.1.6 | Deals tab 404 | Consumer app routing | Discovery broken |
| 0.1.7 | Savings streak not firing | `streakHandler.ts` event wiring | Habit loop broken at source |
| 0.1.8 | Bank details stored in plain text | Merchant model | Security/compliance risk |

### 0.2 Stability Fixes

| # | Issue | Action |
|---|-------|--------|
| 0.2.1 | 30 controllers using raw `res.json()` | Migrate to response helpers for consistent error handling |
| 0.2.2 | Job queue still synchronous in some paths | Verify all reward/cashback paths use BullMQ |
| 0.2.3 | Missing auth tokens in storeSearchService (19 endpoints) | Add auth headers |

**Acceptance Criteria:** All 8 production blockers fixed, deployed, verified. Zero P0 bugs remaining.

---

## PHASE 1: HABIT ENGINE (Week 3-8)

> This is the most important phase. Every task here directly serves one goal: **make users check REZ before every local spend.**

### 1.1 Connect Store Visits to Streak System (Week 3)

**The Gap:** `StoreVisit.complete()` fires NO events. Streaks track logins/orders but NOT physical visits.

**Tasks:**

| # | Task | Files to Modify | Effort |
|---|------|----------------|--------|
| 1.1.1 | Add `visit_completed` and `visit_checked_in` to `ActivityEventType` union | `src/events/gamificationEventBus.ts` | 0.5h |
| 1.1.2 | Add `visit_completed: 'savings'` to `EVENT_TO_STREAK_TYPE` map | `src/events/handlers/streakHandler.ts` | 0.5h |
| 1.1.3 | Emit `visit_completed` event from `storeVisitController` when status → COMPLETED | `src/controllers/storeVisitController.ts` | 1h |
| 1.1.4 | Emit `visit_checked_in` event from `storeVisitController` when status → CHECKED_IN | `src/controllers/storeVisitController.ts` | 0.5h |
| 1.1.5 | Add visit-based streak milestones to `STREAK_MILESTONES.savings` | `src/services/streakService.ts` | 1h |
| 1.1.6 | Add `store_visit` to cashback source enum | `src/models/UserCashback.ts` | 0.5h |
| 1.1.7 | Add visit count to `UserLoyalty` model per-merchant | `src/models/UserLoyalty.ts` | 1h |
| 1.1.8 | Write tests for visit → streak → reward flow | New test file | 2h |

**Total: ~7h**

**Result:** Every completed store visit now contributes to savings streak, earns coins, and progresses merchant loyalty.

---

### 1.2 Instant Reward Gratification (Week 3-4)

**The Gap:** Cashback has 7-day pending period. PDF demands "visible coin credit in < 10 seconds."

**Design Decision:** Keep the pending period for large/suspicious transactions, but add instant micro-rewards for verified actions.

**Tasks:**

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 1.2.1 | Create `InstantRewardService` | New service that issues small instant ReZ coins (5-50) on verified events: check-in, QR scan, bill upload, payment confirmation | 4h |
| 1.2.2 | Add `instantReward` field to `StoreVisit` completion flow | When visit completes, instantly credit 10-30 coins via `rewardEngine.issue()` | 2h |
| 1.2.3 | Add post-payment instant coin animation trigger | After Razorpay payment success, immediately show coin earn animation before cashback pending period starts | 3h |
| 1.2.4 | Create `RewardCelebrationModal` component | Confetti + coin count-up + "You saved X!" + "Next milestone in Y visits" | 4h |
| 1.2.5 | Add haptic feedback on coin credit | `expo-haptics` medium impact on every coin earn event | 1h |
| 1.2.6 | Show "Pending Cashback" as a visible growing number | Wallet screen shows pending cashback with countdown to credit date | 2h |

**Total: ~16h**

**Result:** User sees immediate reward on every action. Pending cashback is visible and exciting, not hidden.

---

### 1.3 Simplified Coin UX — "One Balance" Mode (Week 4-5)

**The Gap:** 4 coin types with different rules confuse users. PDF: "Too confusing... skip."

**Design Decision:** Keep the 4-type architecture (it's powerful), but add a simplified presentation layer.

**Tasks:**

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 1.3.1 | Create `SimplifiedWalletView` component | Shows ONE number: "Your REZ Balance: 2,450 coins (= Rs.2,450)" with a small "Details" link to the full wallet | 4h |
| 1.3.2 | Add `walletDisplayMode` user preference | `simple` (default for new users) or `detailed` (power users) | 2h |
| 1.3.3 | Implement `autoApplyBestCoins` at checkout | Already exists in `getCoinUsageOrder()` — surface it as "REZ will automatically use your best coins" message at checkout | 2h |
| 1.3.4 | Add "You saved X" summary after every transaction | Post-payment screen shows: coins used, coins earned, net savings, all in one simple card | 3h |
| 1.3.5 | Create coin expiry nudge banner | On home screen: "47 coins expiring in 3 days — use them at nearby stores" with direct link to nearby merchants | 3h |
| 1.3.6 | Simplify wallet tab bar | Default to: Overview / History / Expiring Soon (hide Gift Cards, Scheduled Drops, Store Gift Cards behind "More") | 2h |

**Total: ~16h**

**Result:** New users see one number. Power users can toggle to full detail. Nobody is confused.

---

### 1.4 Visit Progress Visualization (Week 5-6)

**The Gap:** Visit-tier loyalty exists in backend but has no compelling front-end presence.

**Tasks:**

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 1.4.1 | Create `StreakFireIcon` component | Animated flame icon (Lottie) showing current streak count, visible on home screen header | 3h |
| 1.4.2 | Create `VisitProgressBar` component | "3/5 visits to unlock Gold at BrewCafe" with animated progress ring | 4h |
| 1.4.3 | Create `MerchantLoyaltyCard` component | Shows tier (Bronze/Silver/Gold/Platinum), visits count, next tier threshold, coin multiplier | 4h |
| 1.4.4 | Add `StreakBreakWarning` push notification | "Your 7-day savings streak is at risk! Visit any REZ merchant to keep it alive" — trigger at 8 PM if no activity that day | 3h |
| 1.4.5 | Add `MilestoneUnlock` celebration screen | Full-screen animation when user reaches a new tier at any merchant | 4h |
| 1.4.6 | Add streak + tier cards to home screen | Between discovery sections, show: current streak, closest milestone, expiring coins | 3h |
| 1.4.7 | Add "Visit History" timeline view | Calendar-style view showing visit dots, streaks highlighted, with total savings per period | 4h |

**Total: ~25h**

**Result:** Users can SEE their progress everywhere. Streak psychology drives repeat visits.

---

### 1.5 Strategic Push Notification System (Week 6-7)

**The Gap:** Notifications bypass `NotificationService`, no behavioral categories, no geo-triggers.

**Tasks:**

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 1.5.1 | Extend `Notification.category` enum | Add: `opportunity`, `progress`, `loss`, `achievement`, `insight` | 1h |
| 1.5.2 | Route all streak/location notifications through `NotificationService` | Replace direct `pushNotificationService.sendPushToUser()` calls in `streakService` and `personalizedNotificationJob` | 3h |
| 1.5.3 | Register Android notification channels | `opportunity` (custom sound), `progress`, `loss` (urgent), `achievement` (celebration sound), `insight` | 2h |
| 1.5.4 | Create `OpportunityNotificationJob` | Cron every 2h during 10AM-9PM: for users with location permission, find merchants within 500m with active offers, send "Save Rs.90 at BrewCafe 120m away" | 6h |
| 1.5.5 | Create `ProgressNudgeJob` | Daily at 6PM: find users 1-2 actions away from a milestone, send "1 more visit to unlock Gold tier!" | 4h |
| 1.5.6 | Create `LossPreventionJob` | Daily at 8PM: streak break warnings + coin expiry warnings (already exists, route through NotificationService) | 2h |
| 1.5.7 | Create `AchievementNotificationHandler` | On milestone/badge unlock events, send celebration push with deep link to achievement screen | 2h |
| 1.5.8 | Implement notification frequency caps per category | Max per day: opportunity=2, progress=1, loss=1, achievement=unlimited, insight=1 | 2h |
| 1.5.9 | Add notification preference screen per category | Let users toggle each category on/off | 3h |

**Total: ~25h**

**Result:** Every notification has strategic purpose. Users get the right nudge at the right time.

---

### 1.6 "Check REZ Before Paying" Flow (Week 7-8)

**The Gap:** No clear UX pattern that teaches the habit of checking REZ before spending.

**Tasks:**

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 1.6.1 | Create `PayInStoreScanFlow` as primary home action | Big "Scan & Save" button on home screen. Tap → camera opens → scan merchant QR → instantly see: offer available, coins to earn, loyalty progress | 6h |
| 1.6.2 | Add `NearbyOffers` widget to home screen | Always-visible carousel: "Save Rs.X at Y" for 5 nearest merchants with active offers | 4h |
| 1.6.3 | Create `PrePaymentSummary` screen | Before any payment: show current balance, coins to earn, streak status, tier progress — all in one glance | 4h |
| 1.6.4 | Add `PostPaymentSummary` screen | After payment: coins earned (animated), total lifetime savings, streak updated, next milestone preview | 4h |
| 1.6.5 | Create onboarding flow teaching the habit | 3-screen tutorial: "1. See offers nearby → 2. Pay & earn → 3. Level up & unlock more" | 3h |
| 1.6.6 | Add "Savings Reminder" widget (Android) | Expo widget showing daily savings opportunity count | 4h |

**Total: ~25h**

**Phase 1 Total: ~114h (~3 engineers x 6 weeks)**

---

## PHASE 2: INTELLIGENCE LAYER (Week 9-12)

> Transform REZ from "cashback app" to "smart spending companion."

### 2.1 Smart Spending Dashboard (Week 9-10)

**The Gap:** `savingsInsights` has 3 basic fields. PDF demands full spending intelligence.

**Tasks:**

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 2.1.1 | Extend `ISavingsInsights` interface | Add: `topCategory`, `topMerchant`, `monthlyTrend[12]`, `weeklySpend`, `savedVsAvgUser` (percentile), `potentialSavings`, `favoriteStores[5]` | 3h |
| 2.1.2 | Create `SpendingInsightsService` | Aggregation pipeline on `CoinTransaction` + `Order` collections: category breakdown, merchant frequency, time-of-week patterns, peer comparison | 8h |
| 2.1.3 | Create `SmartSpendingDashboard` screen | Consumer app screen: monthly spend donut chart by category, savings score gauge, trend line, top merchants, peer percentile | 8h |
| 2.1.4 | Add "Monthly Savings Report" push | 1st of each month: "You saved Rs.X in [month]. That's more than Y% of REZ users!" | 3h |
| 2.1.5 | Create `SpendingInsightsCard` home widget | On home screen: "This week: Rs.2,340 spent, Rs.380 saved, 16% savings rate" | 3h |
| 2.1.6 | Cache insights in Redis | 1-hour TTL per user, invalidated on new transaction | 2h |

**Total: ~27h**

---

### 2.2 Missed Savings Engine (Week 10-11)

**The Gap:** No "you could have saved X" system exists.

**Tasks:**

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 2.2.1 | Create `MissedSavingsService` | When user makes a payment NOT through REZ (detected via bill upload or bank statement): calculate what they would have earned if they used REZ | 6h |
| 2.2.2 | Create `MissedSavings` model | Store: `userId`, `estimatedSavings`, `merchantCategory`, `date`, `alternativeMerchants[]` | 2h |
| 2.2.3 | Add "Missed Savings" section to Smart Spending Dashboard | "You could have saved Rs.1,200 more this month" with breakdown by category | 4h |
| 2.2.4 | Create `MissedSavingsNotification` job | Weekly summary: "Last week you missed Rs.340 in savings. Here are 3 REZ merchants near your usual spots" | 4h |
| 2.2.5 | Add "If you had used REZ" calculation to bill upload flow | After bill upload: "If this merchant was on REZ, you would have earned X coins" | 3h |
| 2.2.6 | Create "Savings Opportunity Map" | Map view showing nearby merchants colored by potential savings amount (heat map style) | 6h |

**Total: ~25h**

---

### 2.3 REZ Score — Universal Savings Score (Week 11-12)

**The Gap:** `UserReputation` exists but is Prive-only. No public-facing composite score.

**Tasks:**

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 2.3.1 | Create `RezScore` model | Composite score (0-999) from: savings rate (30%), visit frequency (25%), streak consistency (20%), merchant diversity (15%), community contribution (10%) | 4h |
| 2.3.2 | Create `RezScoreService` | Daily recalculation job. Uses existing data: `CoinTransaction`, `StoreVisit`, `UserStreak`, `UserLoyalty`, `Review` | 6h |
| 2.3.3 | Create `RezScoreCard` component | Circular gauge showing score, tier name, trend arrow (up/down vs last month) | 4h |
| 2.3.4 | Define score tiers | 0-199: Beginner, 200-399: Smart Saver, 400-599: Super Saver, 600-799: Elite Saver, 800-999: Legend | 1h |
| 2.3.5 | Add score to user profile | Visible on profile page and optionally on social shares | 2h |
| 2.3.6 | Create "Score Boosters" suggestions | "Visit 2 more stores this week to boost your score by ~30 points" | 4h |
| 2.3.7 | Add peer percentile | "Your score is higher than 72% of users in your area" | 3h |

**Total: ~24h**

---

### 2.4 Area & Campus Leaderboards (Week 12)

**The Gap:** Leaderboards are global only. PDF demands area/campus/city boards.

**Tasks:**

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 2.4.1 | Add `scopeType` and `scopeId` to `LeaderboardConfig` | `scopeType: 'global' | 'city' | 'area' | 'campus'`, `scopeId: ObjectId` | 2h |
| 2.4.2 | Create `Area` and `Campus` models | `Area`: city + neighborhood + polygon. `Campus`: name + institution + location | 3h |
| 2.4.3 | Add user area/campus affiliation | `User.profile.areaId`, `User.profile.campusId` (set during onboarding or from location) | 2h |
| 2.4.4 | Modify leaderboard aggregation pipeline | Filter `CoinTransaction` by users within the scope's area/campus | 4h |
| 2.4.5 | Create `AreaLeaderboard` screen | Tab: My Area / My Campus / My City / Global | 4h |
| 2.4.6 | Add "Area Champion" badge | Weekly winner of area leaderboard gets a special badge | 2h |
| 2.4.7 | Create leaderboard share card | Shareable image: "I'm #3 in [Area Name] this week on REZ!" | 3h |

**Total: ~20h**

**Phase 2 Total: ~96h (~3 engineers x 4 weeks)**

---

## PHASE 3: GROWTH MECHANICS (Week 13-16)

> Turn habit users into growth engines.

### 3.1 Social Proof & Sharing (Week 13-14)

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 3.1.1 | Create `SavingsShareCard` | Beautiful shareable image: "I saved Rs.4,320 this month with REZ" + QR code + referral link | 4h |
| 3.1.2 | Add "Share Your Score" to REZ Score | One-tap share to WhatsApp/Instagram stories | 3h |
| 3.1.3 | Create "Savings Milestone" auto-share prompts | At Rs.1000, 5000, 10000, 25000 lifetime savings: prompt to share | 3h |
| 3.1.4 | Add merchant review → social share flow | After writing a review, prompt: "Share this on Instagram and earn 10 coins" | 3h |
| 3.1.5 | Create "Streak Achievement" shareable | "I'm on a 30-day savings streak on REZ!" | 2h |

**Total: ~15h**

---

### 3.2 Merchant-Driven Growth (Week 14-15)

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 3.2.1 | Create `MerchantGrowthDashboard` | Show merchant: "REZ brought you X repeat customers this month" with data | 6h |
| 3.2.2 | Add "Recommend REZ" toolkit for merchants | Printable QR poster, table tent design, sticker template — all from merchant app | 4h |
| 3.2.3 | Create merchant-triggered push to loyal customers | Merchant can send "Special offer for our loyal REZ customers" to users who visited 3+ times | 4h |
| 3.2.4 | Add "Merchant Advocacy Score" | Track how many users a merchant brings to REZ through their QR/posters | 3h |
| 3.2.5 | Create "Featured Merchant" program | Top advocates get featured placement in discovery feed | 3h |

**Total: ~20h**

---

### 3.3 Habit Reinforcement Loops (Week 15-16)

| # | Task | Detail | Effort |
|---|------|--------|--------|
| 3.3.1 | Create "Weekly Savings Challenge" | Auto-generated: "Save Rs.500 this week across 3 different merchants" | 6h |
| 3.3.2 | Add "Unlock Merchants" mechanic | After 10 total visits: unlock "Premium Offers" section. After 20: "VIP Cashback" rates | 4h |
| 3.3.3 | Create "Savings Goals" feature | User sets monthly savings target. Progress tracked. Celebration on hit | 5h |
| 3.3.4 | Add "Smart Suggestion" based on time/location | "It's lunchtime! Save Rs.80 at 3 restaurants near you" | 4h |
| 3.3.5 | Create "Savings Streak Freeze" purchasable item | Spend 100 coins to protect streak for 1 day (already exists in backend, add UI) | 2h |
| 3.3.6 | Add end-of-day savings summary notification | "Today you saved Rs.120 across 2 visits. Your streak is now 12 days!" | 3h |

**Total: ~24h**

**Phase 3 Total: ~59h (~2 engineers x 4 weeks)**

---

## PHASE 4: STRATEGIC DE-SCOPING (Ongoing, starts Week 1)

> The PDF explicitly warns: "Do NOT try to become everything immediately." The code has already expanded into fintech, travel, insurance, gold — all before achieving habit.

### Features to HIDE (not delete) Behind Feature Flags

These features should be built but hidden from the main navigation until the core habit loop proves itself (D7 retention > 40%):

| Feature | Current Status | Action | Flag Name |
|---------|---------------|--------|-----------|
| Gold Savings / SIP | Routes + models built | Hide from consumer app nav | `FEATURE_GOLD_SAVINGS` |
| Insurance Plans | Routes + models built | Hide from consumer app nav | `FEATURE_INSURANCE` |
| Travel Services | Full routes built | Hide from consumer app nav | `FEATURE_TRAVEL` |
| Financial Services / Lending | Routes built | Hide from consumer app nav | `FEATURE_FINANCIAL_SERVICES` |
| Mall / Brand Aggregation | Full sub-app built | Move to "Explore" section, not primary nav | `FEATURE_MALL` |
| Creator Economy | Full creator profiles | Hide until 10k DAU | `FEATURE_CREATOR` |
| Group Buying | Model exists | Hide | `FEATURE_GROUP_BUY` |
| Price Tracking/Alerts | Model exists | Hide | `FEATURE_PRICE_TRACKING` |
| Product Comparison | Screen exists | Hide | `FEATURE_PRODUCT_COMPARE` |

### Primary Navigation Should Be:

```
Bottom Tab Bar (5 tabs only):
1. Home (discovery + nearby offers + streak + savings widget)
2. Scan & Save (QR scan → pay → earn)
3. Explore (nearby merchants, map, search)
4. Wallet (simplified view, one number)
5. Profile (score, streaks, achievements, settings)
```

### Kill "Tab Overload"

Current app has tabs for: Home, Earn, Play, Explore, Profile + floating wallet.
Reduce to 5 focused tabs. Move "Play" games into Profile > Achievements. Move "Earn" actions into contextual prompts throughout the app.

---

## EXECUTION METRICS

### North Star Metric
**"Check-Before-Pay Rate"** = % of users who open REZ within 30 minutes before making a local payment

### Phase 1 Success Metrics (Week 8)

| Metric | Current (est.) | Target |
|--------|---------------|--------|
| D1 retention | ~30% | 50% |
| D7 retention | ~15% | 30% |
| Avg transactions/user/week | ~0.5 | 2 |
| Streak maintenance rate (7-day) | ~5% | 20% |
| Coin redemption rate | ~10% | 35% |
| Reward visibility (users who see coin animation) | Unknown | 90% |

### Phase 2 Success Metrics (Week 12)

| Metric | Target |
|--------|--------|
| D7 retention | 40% |
| D30 retention | 20% |
| Smart Spending Dashboard views/week | 3x per active user |
| REZ Score awareness | 70% of active users have seen their score |
| Users maintaining 14+ day streak | 15% of MAU |

### Phase 3 Success Metrics (Week 16)

| Metric | Target |
|--------|--------|
| Organic installs (from shares) | 20% of total installs |
| Merchant advocacy score > 0 | 30% of active merchants |
| Weekly challenge completion | 25% of WAU |
| Users with "Check-Before-Pay" habit | 15% of MAU |

---

## TEAM ALLOCATION RECOMMENDATION

| Role | Phase 0 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|---------|
| Backend Engineer (Senior) | Bug fixes | Streak connection, instant rewards, notification jobs | Insights service, score engine, leaderboard upgrade | Challenge engine, suggestion engine |
| Backend Engineer (Mid) | Bug fixes | Cashback flow, reward service | Missed savings service, area models | Merchant growth dashboard |
| Frontend Engineer (Senior) | Bug fixes | Simplified wallet, celebration modal, home screen redesign | Smart spending dashboard, score card | Share cards, weekly challenges |
| Frontend Engineer (Mid) | Bug fixes | Visit progress UI, streak icon, notification preferences | Missed savings UI, area leaderboard | Merchant toolkit, savings goals |
| Product Designer | -- | Habit loop UX, simplified wallet, celebration animations | Dashboard design, score visual | Share card templates, challenge UX |
| QA Engineer | Regression | Streak flow testing, notification testing | Score calculation verification | End-to-end habit loop testing |

**Total team: 4 engineers + 1 designer + 1 QA = 6 people for 16 weeks**

---

## DEPENDENCY MAP

```
Phase 0 (bugs) ──→ Phase 1.1 (visits→streaks)
                       │
                       ├──→ Phase 1.2 (instant rewards) ──→ Phase 1.4 (progress UI)
                       │                                         │
                       ├──→ Phase 1.3 (simple wallet)           │
                       │                                         │
                       └──→ Phase 1.5 (notifications) ──────────┘
                                    │                            │
                                    └──→ Phase 1.6 (habit flow) ─┘
                                              │
                              ┌───────────────┼────────────────┐
                              │               │                │
                        Phase 2.1        Phase 2.3        Phase 2.4
                     (dashboard)        (REZ score)    (area boards)
                              │               │                │
                              └───→ Phase 2.2 ┘                │
                              (missed savings)                 │
                                      │                        │
                              ┌───────┴────────────────────────┘
                              │
                        Phase 3 (growth)
```

---

## WHAT NOT TO BUILD (Strategic Restraint)

These are features the PDF analysis or competitive comparison suggested, but should NOT be prioritized now:

| Feature | Why Not Now |
|---------|------------|
| Concern-based beauty recommendations (vs Luzo) | Vertical depth before horizontal breadth. Wait for Glowzy niche app launch |
| Multi-station KDS routing (vs Petpooja) | Enterprise feature. Current single-station KDS is sufficient for SMB merchants |
| Group dining / bill splitting (vs Dineout) | Nice-to-have, not habit-forming |
| Card/payment optimization suggestions | Requires bank integrations. Phase 5+ |
| AI recommendation engine | Need data first. Build after 10k MAU |
| ONDC integration | Regulatory complexity. Phase 5+ |
| WhatsApp commerce bot | Interesting but premature optimization |
| 22 vertical niche apps (Dinezy, FitEarn, Grocify...) | ONLY launch after core habit proven in main app |

---

## RISK REGISTER

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Simplifying wallet confuses power users | Medium | Medium | Toggle between simple/detailed mode |
| Notification spam causes uninstalls | High | High | Strict per-category caps, preference screen |
| Streak mechanics feel manipulative | Medium | Medium | Allow streak freeze, don't punish harshly |
| Merchants don't push REZ to customers | High | Critical | Merchant growth dashboard showing ROI |
| Feature flag complexity grows unmanageable | Medium | Medium | Monthly flag cleanup reviews |
| Team resists de-scoping existing features | High | Medium | Frame as "hide" not "delete" — code stays |

---

## APPENDIX A: Existing Planning Docs Status

| Document | Status | Relation to This Plan |
|----------|--------|----------------------|
| `rezv2.md` | Active (50% of v2 built) | This plan supersedes feature priorities; bug fixes align |
| `REZ_MASTER_UPGRADE_GUIDE.md` | Active (Phases 1-4) | Phase 0 here = their Week 1 bug fixes |
| `REZ_DOC5_SPRINT_TASKS.md` | Active (10-week plan) | This plan extends beyond their scope |
| `REZ_10_10_TECH_UPGRADE.md` | Active (tech excellence) | Complementary — run in parallel |
| `FULL_AUDIT_REPORT.md` | 128 bugs found | Phase 0 addresses the critical 8 |
| `RETENTION_AUDIT_CARLOS.md` | Implemented | Streak freeze + notification jobs = foundation for Phase 1.5 |
| `MOTION_AUDIT_LUCA.md` | Gaps identified | Phase 1.2 (celebration modal) addresses animation gaps |

---

## APPENDIX B: Files That Need Changes (Quick Reference)

### Backend — New Files to Create
```
src/services/instantRewardService.ts
src/services/spendingInsightsService.ts
src/services/missedSavingsService.ts
src/services/rezScoreService.ts
src/models/RezScore.ts
src/models/MissedSavings.ts
src/models/Area.ts
src/models/Campus.ts
src/jobs/opportunityNotificationJob.ts
src/jobs/progressNudgeJob.ts
src/jobs/monthlyInsightsJob.ts
src/jobs/weeklyChallengeJob.ts
src/jobs/rezScoreCalculationJob.ts
src/routes/insightsRoutes.ts
src/routes/rezScoreRoutes.ts
src/controllers/insightsController.ts
src/controllers/rezScoreController.ts
```

### Backend — Existing Files to Modify
```
src/events/gamificationEventBus.ts (add visit events)
src/events/handlers/streakHandler.ts (add visit→savings mapping)
src/controllers/storeVisitController.ts (emit events)
src/models/UserLoyalty.ts (add visit count)
src/models/UserCashback.ts (add store_visit source)
src/models/Wallet.ts (extend ISavingsInsights)
src/models/Notification.ts (extend category enum)
src/models/LeaderboardConfig.ts (add scopeType/scopeId)
src/services/streakService.ts (add visit milestones)
src/services/notificationService.ts (add new categories)
src/services/leaderboardService.ts (add area filtering)
src/services/cashbackService.ts (instant credit path)
```

### Consumer App — New Screens/Components to Create
```
app/smart-spending.tsx (dashboard)
app/rez-score.tsx (score screen)
app/savings-goals.tsx
app/area-leaderboard.tsx
components/SimplifiedWalletView.tsx
components/StreakFireIcon.tsx
components/VisitProgressBar.tsx
components/MerchantLoyaltyCard.tsx
components/RewardCelebrationModal.tsx
components/SpendingInsightsCard.tsx
components/RezScoreCard.tsx
components/SavingsShareCard.tsx
components/NearbyOffersCarousel.tsx
components/PrePaymentSummary.tsx
components/PostPaymentSummary.tsx
```

### Consumer App — Existing Files to Modify
```
app/(tabs)/_layout.tsx (simplify to 5 tabs)
app/(tabs)/index.tsx (add streak, savings widgets)
app/wallet/index.tsx (add simple mode toggle)
app/account/push-notifications.tsx (add per-category toggles)
```

---

*This plan focuses REZ on the one thing that matters: making users feel stupid paying without REZ. Everything else is a feature. This is the habit.*
