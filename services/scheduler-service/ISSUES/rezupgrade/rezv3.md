# REZ — COMPLETE BIZONE + ADMIN GAP REPORT
## Every Screen Found in v2, Mapped to Current State, Phase-Ordered
### March 2026 | Full Audit

---

## WHAT THIS COVERS

Previous report covered Phase 1-11. This report is the **complete inventory** — every single BiZone and Admin screen from v2, categorised by what's built, what was mentioned but incomplete, and what was missed entirely.

---

# PART A: BIZONE COMPLETE SCREEN INVENTORY
## 219 Designed → 0 Built → Full Gap

---

## GROUP 1: AUTH + ONBOARDING (3 screens)
**Status: 0% built**

| Screen | v2 File | Our Report | Backend API |
|--------|---------|------------|-------------|
| Merchant Signup | `auth/MerchantSignup.jsx` | ✅ Phase 4.1 | POST /merchant/auth/register |
| Business Details | `auth/MerchantBusinessDetails.jsx` | ✅ Phase 4.1 | POST /merchant/onboarding |
| Success/Onboarded | `auth/MerchantSuccess.jsx` | ❌ **MISSING** | GET /merchant/profile |

**MerchantSuccess.jsx** shows: welcome animation, "Your store is live!", first steps checklist (add products, create first offer, download BiZone app). This is critical for merchant activation. **Add to Phase 4.1.**

---

## GROUP 2: DASHBOARD (6 screens)
**Status: 0% built**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| Main Dashboard | `dashboard/MerchantDashboard.jsx` | ✅ Phase 4.1 | 🔴 P1 |
| Analytics | `dashboard/MerchantAnalytics.jsx` | ✅ Phase 4.7 | 🟠 P2 |
| Benchmarks | `dashboard/MerchantBenchmarks.jsx` | ✅ Phase 4.7 | 🟠 P2 |
| Deal Analytics | `dashboard/MerchantDealAnalytics.jsx` | ❌ **MISSING** | 🟠 P2 |
| Multi-Store Overview | `dashboard/MerchantMultiStore.jsx` | ❌ **MISSING** | 🟡 P3 |
| Multi-Store Dashboard | `dashboard/MerchantMultiStoreDashboard.jsx` | ❌ **MISSING** | 🟡 P3 |

**MerchantDealAnalytics.jsx** — per-offer performance: views, saves, redemptions, revenue from offer, coin cost of campaign. Essential once merchants have active offers. **Add to Phase 4.7.**

**MerchantMultiStore + MultiStoreDashboard** — chain management: all branches in one view, aggregate revenue, cross-branch analytics. **Add to Phase 4.9 (advanced).**

---

## GROUP 3: ORDERS (3 screens)
**Status: 0% built**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| Orders Main | `orders/MerchantOrders.jsx` | ✅ Phase 4.3 | 🔴 P1 |
| Multi-Channel Orders | `orders/MerchantOrdersMultiChannel.jsx` | ❌ **MISSING** | 🟠 P2 |
| Purchase Orders | `orders/MerchantPurchaseOrders.jsx` | ❌ **MISSING** | 🟡 P3 |

**MerchantOrdersMultiChannel.jsx** — aggregates orders from REZ + Swiggy + Zomato + website in ONE screen. Every restaurant merchant needs this. Design shows order source badge (🍊 Swiggy, 🔴 Zomato, 🟦 REZ) with unified status flow. **Add to Phase 4.3 after basic orders.**

**MerchantPurchaseOrders.jsx** — orders placed TO suppliers (not from customers). Track incoming stock deliveries. **Add to Phase 4.9.**

---

## GROUP 4: POS (7 screens)
**Status: 0% built**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| Full POS | `pos/MerchantPOS.jsx` | ✅ Phase 4.2 | 🔴 P1 |
| Simple POS | `pos/MerchantSimplePOS.jsx` (advanced/) | ❌ **MISSING** | 🔴 P1 |
| Offline POS | `pos/MerchantOfflinePOS.jsx` | ❌ **MISSING** | 🔴 P1 |
| Offline Sync | `pos/MerchantOfflinePOSSync.jsx` | ❌ **MISSING** | 🔴 P1 |
| Category POS | `pos/MerchantCategoryPOS.jsx` | ❌ **MISSING** | 🟠 P2 |
| POS Integration | `pos/MerchantPOSIntegration.jsx` | ❌ **MISSING** | 🟡 P3 |
| POS Transactions | `pos/MerchantPOSTransactions.jsx` | ❌ **MISSING** | 🟠 P2 |
| Offline Marketing | `pos/MerchantOfflineMarketing.jsx` | ❌ **MISSING** | 🟡 P3 |

**Critical gaps here:**

`MerchantSimplePOS.jsx` — stripped-down POS for single-category merchants (just a café selling coffee, just a salon). Faster than full POS. Add total, enter phone, issue coins. **Add to Phase 4.2.**

`MerchantOfflinePOS.jsx` + `MerchantOfflinePOSSync.jsx` — offline-first: works without internet, queues transactions locally, syncs when back online. Backend already has `/api/merchant/sync`. This is critical for India where connectivity drops. **Add to Phase 4.2.**

`MerchantPOSTransactions.jsx` — transaction history from POS, filterable by date/payment method/cashier. Essential for end-of-day reconciliation. **Add to Phase 4.2.**

`MerchantCategoryPOS.jsx` — POS filtered to a single category (e.g., waiter only sees drinks menu). Role-based POS filtering. **Add Phase 4.9.**

---

## GROUP 5: INVENTORY (10 screens)
**Status: 0% built**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| Inventory Main | `inventory/MerchantInventory.jsx` | ✅ Phase 4.6 | 🟠 P2 |
| Inventory Advanced | `inventory/MerchantInventoryAdvanced.jsx` | ❌ **MISSING** | 🟠 P2 |
| Inventory Forecasting | `inventory/MerchantInventoryForecasting.jsx` | ❌ **MISSING** | 🟡 P3 |
| Inventory Transfer | `inventory/MerchantInventoryTransfer.jsx` | ❌ **MISSING** | 🟡 P3 |
| Auto Restock | `inventory/MerchantAutoRestock.jsx` | ❌ **MISSING** | 🟠 P2 |
| Autopilot | `inventory/MerchantAutopilot.jsx` | ❌ **MISSING** | 🟡 P3 |
| Barcode Generator | `inventory/MerchantBarcodeGenerator.jsx` | ❌ **MISSING** | 🟡 P3 |
| Barcode Scanner | `inventory/MerchantBarcodeScanner.jsx` | ❌ **MISSING** | 🟠 P2 |
| Batch Tracking | `inventory/MerchantBatchTracking.jsx` | ❌ **MISSING** | 🟡 P3 |
| Expiry Dashboard | `inventory/MerchantExpiryDashboard.jsx` | ❌ **MISSING** | 🟠 P2 |

**Key missing inventory screens:**

`MerchantInventoryAdvanced.jsx` — multi-location stock, variant tracking (size/colour), bundle component tracking. Critical for any clothing or electronics merchant. **Add Phase 4.6.**

`MerchantAutoRestock.jsx` — automatic purchase order generation when stock drops below threshold. "When Arabica Coffee < 2kg → auto-create PO to supplier Kitchens of India." **Add Phase 4.6.**

`MerchantExpiryDashboard.jsx` — food/pharma merchants: shows items expiring in 7/14/30 days, suggests promotions to clear stock. **Add Phase 4.6.**

`MerchantBarcodeScanner.jsx` — scan barcode to add/remove stock. Camera-based or Bluetooth scanner. **Add Phase 4.6.**

---

## GROUP 6: OFFERS (10 screens)
**Status: 0% built**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| Create Offer | `offers/CreateOffer.jsx` | ✅ Phase 4.4 | 🔴 P1 |
| Offers List | `advanced/MerchantOffers.jsx` | ✅ Phase 4.4 | 🔴 P1 |
| Today's Offers | `advanced/MerchantTodaysOffers.jsx` | ❌ **MISSING** | 🟠 P2 |
| Flash Deals | `advanced/MerchantFlashDeals.jsx` | ❌ **MISSING** | 🟠 P2 |
| Lock Price Deals | `advanced/MerchantLockPriceDeals.jsx` | ❌ **MISSING** | 🟡 P3 |
| BOGO Offers | `offers/MerchantBOGOOffers.jsx` | ❌ **MISSING** | 🟠 P2 |
| Birthday Offers | `offers/MerchantBirthdayOffers.jsx` | ❌ **MISSING** | 🟡 P3 |
| Birthday Rewards | `offers/MerchantBirthdayRewards.jsx` | ❌ **MISSING** | 🟡 P3 |
| Cart Abandonment | `offers/MerchantCartAbandonment.jsx` | ❌ **MISSING** | 🟡 P3 |
| Cashback Programs | `offers/MerchantCashbackPrograms.jsx` | ❌ **MISSING** | 🟠 P2 |
| Combo Products | `offers/MerchantComboProducts.jsx` | ❌ **MISSING** | 🟡 P3 |
| Demand Signals | `offers/MerchantDemandSignals.jsx` | ❌ **MISSING** | 🟡 P3 |
| Clearance Sales | `offers/MerchantClearanceSales.jsx` | ❌ **MISSING** | 🟡 P3 |
| Cross-Sell | `offers/MerchantCrossSellSuggestions.jsx` | ❌ **MISSING** | 🟡 P3 |
| Exclusive Programs | `advanced/MerchantExclusivePrograms.jsx` | ❌ **MISSING** | 🟡 P3 |
| Exclusive Deals | `advanced/MerchantExclusiveDeals.jsx` | ❌ **MISSING** | 🟡 P3 |
| Nearby Offers | `advanced/MerchantNearbyOffers.jsx` | ❌ **MISSING** | 🟡 P3 |

**Key missing offer screens:**

`MerchantFlashDeals.jsx` — time-limited urgent offers: "50% off for next 2 hours". Timer-based. Creates urgency. Connects to `AdminTemporalCommerce` (time-slot demand analytics). **Add Phase 4.4.**

`MerchantBOGOOffers.jsx` — Buy One Get One: most popular offer type for restaurants/food. Separate UI from % discount. **Add Phase 4.4.**

`MerchantCashbackPrograms.jsx` — configure per-visit cashback rules. "5% cashback every Tuesday", "10% cashback on 5th visit". **Add Phase 4.4.**

`MerchantTodaysOffers.jsx` — quick daily offer management: copy yesterday's offer, make it live in 1 tap. Reduces friction for daily promotions. **Add Phase 4.4.**

`MerchantDemandSignals.jsx` — shows: "12 users have wishlisted this item", "8 users searched for pizza near you in the last hour". Merchant can create targeted offer immediately. **Add Phase 4.9.**

---

## GROUP 7: CUSTOMERS (8 screens)
**Status: 0% built**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| CRM | `customers/MerchantCRM.jsx` | ✅ Phase 4.8 | 🟠 P2 |
| Appointments | `customers/MerchantAppointments.jsx` | ❌ **MISSING** | 🔴 P1 |
| Booking Calendar | `customers/MerchantBookingCalendar.jsx` | ❌ **MISSING** | 🔴 P1 |
| Class Schedule | `customers/MerchantClassSchedule.jsx` | ❌ **MISSING** | 🟠 P2 |
| Bill Hold | `customers/MerchantBillHold.jsx` | ❌ **MISSING** | 🟠 P2 |
| Bill Management | `customers/MerchantBillManagement.jsx` | ❌ **MISSING** | 🟠 P2 |
| Bill Splitting | `customers/MerchantBillSplitting.jsx` | ❌ **MISSING** | 🟠 P2 |
| Clinic Insurance | `customers/MerchantClinicInsurance.jsx` | ❌ **MISSING** | 🟡 P3 |

**Critical missing here:**

`MerchantAppointments.jsx` — shows all upcoming service appointments (beauty, fitness, healthcare). Calendar + list view. Accept/reschedule/cancel from merchant side. This directly connects to Bug Fix 1.6 (wrong booking endpoint). **This is P1 — Add to Phase 4.3.**

`MerchantBookingCalendar.jsx` — visual calendar of all appointments. Blocked times for maintenance. Staff assignment per slot. **P1 for all service merchants. Add Phase 4.3.**

`MerchantBillHold.jsx` — hold a bill mid-service (e.g., at a restaurant, open tab feature). Common in bars/cafés. **Add Phase 4.2 (POS extension).**

`MerchantBillSplitting.jsx` — merchant-side bill splitting: split a restaurant bill between N customers at the table. Connects to user-side BillSplitting. **Add Phase 4.2.**

---

## GROUP 8: FINANCE (6 screens)
**Status: 0% built — ALL MISSED in our report**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| Merchant Wallet | `advanced/MerchantWallet.jsx` | ✅ Phase 4.5 | 🔴 P1 |
| Accountant Portal | `finance/MerchantAccountantPortal.jsx` | ❌ **MISSING** | 🟠 P2 |
| Accounting | `finance/MerchantAccounting.jsx` | ❌ **MISSING** | 🟠 P2 |
| Cash Drawer | `finance/MerchantCashDrawer.jsx` | ❌ **MISSING** | 🟠 P2 |
| Commission Calculator | `finance/MerchantCommissionCalculator.jsx` | ❌ **MISSING** | 🟠 P2 |
| Credit Ledger | `finance/MerchantCreditLedger.jsx` | ❌ **MISSING** | 🟠 P2 |
| Post Payment Rewards | `finance/MerchantPostPaymentRewards.jsx` | ❌ **MISSING** | 🟠 P2 |
| Settlement Engine | `advanced/MerchantSettlementEngine.jsx` | ❌ **MISSING** | 🟠 P2 |
| Payments | `advanced/MerchantPayments.jsx` | ❌ **MISSING** | 🟠 P2 |
| Failed Payments | `advanced/MerchantFailedPayments.jsx` | ❌ **MISSING** | 🟠 P2 |
| Financials | `advanced/MerchantFinancials.jsx` | ❌ **MISSING** | 🟠 P2 |
| Profit & Loss | `advanced/MerchantProfitLoss.jsx` | ❌ **MISSING** | 🟠 P2 |
| Profit View | `advanced/MerchantProfitView.jsx` | ❌ **MISSING** | 🟡 P3 |
| Daybook | `advanced/MerchantDaybook.jsx` | ❌ **MISSING** | 🟠 P2 |
| Day End Report | `advanced/MerchantDayEndReport.jsx` | ❌ **MISSING** | 🔴 P1 |
| Expense Tracker | `advanced/MerchantExpenseTracker.jsx` | ❌ **MISSING** | 🟠 P2 |

**Entire finance module was MISSED in our report. Critical additions:**

`MerchantDayEndReport.jsx` — end-of-day summary: cash received, card payments, coin redemptions, REZ settlements, net revenue. Every merchant needs this daily. **P1 — Add to Phase 4.5.**

`MerchantCashDrawer.jsx` — physical cash drawer management: opening float, all cash transactions, closing float, variance. Restaurant/retail merchants require this. **Add Phase 4.5.**

`MerchantProfitLoss.jsx` — full P&L: revenue - COGS - platform commission - offers cost = net profit. Monthly view. **Add Phase 4.7 (analytics group).**

`MerchantSettlementEngine.jsx` — settlement breakdown: gross revenue | platform commission | coin cost (REZ-funded) | net payable. Shows when each settlement arrives. **Add Phase 4.5.**

`MerchantPostPaymentRewards.jsx` — configure what coins/rewards fire after payment. "After every ₹500 purchase → auto-issue 50 coins + 1 scratch card". **Add Phase 4.4.**

`MerchantAccountantPortal.jsx` — read-only finance view for external accountants. GST-ready reports, export to Excel/PDF. **Add Phase 4.9.**

`MerchantCommissionCalculator.jsx` — transparency tool: enter an expected order value → see commission breakdown in real time. Builds merchant trust. **Add Phase 4.5.**

---

## GROUP 9: STAFF (9 screens)
**Status: 0% built — Partially mentioned in report**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| Staff Main | `advanced/MerchantStaff.jsx` | ✅ Phase 4.8 | 🟠 P2 |
| Shift Management | `advanced/MerchantShiftManagement.jsx` | ✅ mentioned | 🟠 P2 |
| Staff Roster | `advanced/MerchantStaffRoster.jsx` | ❌ **MISSING** | 🟠 P2 |
| Staff Activity Log | `advanced/MerchantStaffActivityLog.jsx` | ❌ **MISSING** | 🟠 P2 |
| Staff Leaderboard | `advanced/MerchantStaffLeaderboard.jsx` | ❌ **MISSING** | 🟠 P2 |
| Staff Sales | `advanced/MerchantStaffSales.jsx` | ❌ **MISSING** | 🟠 P2 |
| Payroll | `advanced/MerchantPayroll.jsx` | ✅ mentioned | 🟡 P3 |
| Employee Scheduling | `advanced/MerchantEmployeeScheduling.jsx` | ❌ **MISSING** | 🟡 P3 |
| Salesman Commission | `advanced/MerchantSalesmanCommission.jsx` | ❌ **MISSING** | 🟡 P3 |
| Team Management | `advanced/MerchantTeamManagement.jsx` | ❌ **MISSING** | 🟠 P2 |
| User Roles | `advanced/MerchantUserRoles.jsx` | ❌ **MISSING** | 🟠 P2 |
| Staff Activity Log | `advanced/MerchantStaffActivityLog.jsx` | ❌ **MISSING** | 🟠 P2 |

**Key additions:**

`MerchantStaffRoster.jsx` — visual weekly roster: who works which shift. Drag to reassign. **Add Phase 4.8.**

`MerchantStaffSales.jsx` — which staff member made which sales. Performance by employee. Commissions auto-calculated. **Add Phase 4.8.**

`MerchantUserRoles.jsx` — role-based access: Owner (all), Manager (no financials), Cashier (POS only), Waiter (orders only). Security-critical. **Add Phase 4.8.**

`MerchantSalesmanCommission.jsx` — for retail: set % commission per salesperson per product category. **Add Phase 4.9.**

---

## GROUP 10: LOYALTY (4 screens)
**Status: 0% built — Partially mentioned**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| Loyalty Builder | `advanced/MerchantLoyaltyBuilder.jsx` | ✅ Phase 4.8 | 🟠 P2 |
| Loyalty Main | `advanced/MerchantLoyalty.jsx` | ❌ **MISSING** | 🟠 P2 |
| Loyalty Tiers | `advanced/MerchantLoyaltyTiers.jsx` | ❌ **MISSING** | 🟠 P2 |
| Loyalty Offers | `advanced/MerchantLoyaltyOffers.jsx` | ❌ **MISSING** | 🟠 P2 |
| Points Rules | `advanced/MerchantPointsRules.jsx` | ❌ **MISSING** | 🟠 P2 |
| Memberships | `advanced/MerchantMemberships.jsx` | ❌ **MISSING** | 🟠 P2 |
| Subscription Plans | `advanced/MerchantSubscriptionPlans.jsx` | ❌ **MISSING** | 🟡 P3 |
| Subscriptions | `advanced/MerchantSubscriptions.jsx` | ❌ **MISSING** | 🟡 P3 |
| Gamification Rewards | `advanced/MerchantGamificationRewards.jsx` | ❌ **MISSING** | 🟠 P2 |
| Branded Coin Config | `advanced/MerchantBrandedCoinConfig.jsx` | ❌ **MISSING** | 🟠 P2 |

**All missed. Key additions:**

`MerchantBrandedCoinConfig.jsx` — configure BRANDED COINS (the Starbucks Stars equivalent). Merchant sets: earn rate (₹100 = 10 branded coins), redeem rate (50 coins = ₹25 off), coin name/branding. **Add Phase 4.4 — directly tied to Phase 3.1 Prive campaigns.**

`MerchantMemberships.jsx` — create paid membership plans: "Coffee Club ₹299/month → unlimited filter coffee + 15% off all orders". Recurring revenue for merchants. **Add Phase 4.9.**

`MerchantGamificationRewards.jsx` — configure loyalty games: "Visit 5 times → free product", "Spend ₹2000 → unlock VIP tier". **Add Phase 4.8.**

`MerchantLoyaltyTiers.jsx` — set Bronze/Silver/Gold customer tiers based on spend/visits. Each tier gets different benefits. **Add Phase 4.8.**

---

## GROUP 11: MARKETING + SOCIAL (8 screens)
**Status: 0% built — Mostly missed in report**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| Creator Hub | `marketing/MerchantCreatorHub.jsx` | ❌ **MISSING** | 🟠 P2 |
| UGC Campaigns | `advanced/MerchantUGCCampaigns.jsx` | ❌ **MISSING** | 🔴 P1 |
| Campaigns | `marketing/MerchantCampaigns.jsx` | ❌ **MISSING** | 🟠 P2 |
| Content | `marketing/MerchantContent.jsx` | ❌ **MISSING** | 🟡 P3 |
| Contest Builder | `marketing/MerchantContestBuilder.jsx` | ❌ **MISSING** | 🟡 P3 |
| Adzy Hub | `marketing/MerchantAdzyHub.jsx` | ❌ **MISSING** | 🟡 P3 |
| WhatsApp Business | `advanced/MerchantWhatsAppBusiness.jsx` | ✅ mentioned | 🟠 P2 |
| Marketing | `advanced/MerchantMarketing.jsx` | ❌ **MISSING** | 🟠 P2 |
| Marketing Campaigns | `advanced/MerchantMarketingCampaigns.jsx` | ❌ **MISSING** | 🟠 P2 |
| Unified Marketing | `advanced/MerchantUnifiedMarketing.jsx` | ❌ **MISSING** | 🟡 P3 |
| Referral Tracking | `advanced/MerchantReferralTracking.jsx` | ❌ **MISSING** | 🟠 P2 |
| Re-Engagement | `advanced/MerchantReEngagement.jsx` | ❌ **MISSING** | 🟠 P2 |
| Google Ads Manager | `advanced/MerchantGoogleAdsManager.jsx` | ❌ **MISSING** | 🟡 P3 |
| Meta Ads Manager | `advanced/MerchantMetaAdsManager.jsx` | ❌ **MISSING** | 🟡 P3 |
| Offline Marketing | `pos/MerchantOfflineMarketing.jsx` | ❌ **MISSING** | 🟡 P3 |
| Session Tracking | `advanced/MerchantSessionTracking.jsx` | ❌ **MISSING** | 🟡 P3 |

**CRITICAL MISS: MerchantUGCCampaigns.jsx**

This is the merchant-side interface for managing Privé/Social Cashback campaigns. In our Phase 3/Phase 5, we said merchants use `MerchantPriveModule.jsx`. But v2 has TWO separate screens:
- `MerchantPriveModule.jsx` — for high-end Privé brand campaigns (₹50k+ budget)
- `MerchantUGCCampaigns.jsx` — for everyday UGC campaigns (any merchant, any budget)

`MerchantUGCCampaigns.jsx` shows:
```
Tabs: Active | Draft | Completed | Pending Review
Campaign card: "Summer Special Reel Campaign"
  Platform: Instagram, Budget: ₹5,000, Posts: 12/20
  Status: Active, Pending approvals: 3
  [View Submissions] [Edit] [Pause]
```

This is the MAIN merchant interface for social cashback. **Must add to Phase 3 alongside Prive campaigns.**

`MerchantCreatorHub.jsx` — merchant views all their Prive creator partnerships, tracks campaign performance per creator, sends new invitations. **Add Phase 3.**

`MerchantReEngagement.jsx` — automated win-back campaigns: "Customer hasn't visited in 30 days → auto-send WhatsApp with exclusive offer". **Add Phase 4.9.**

`MerchantReferralTracking.jsx` — show which referred customers have visited, referral ROI. **Add Phase 4.8.**

---

## GROUP 12: FOOD-SPECIFIC SCREENS (7 screens)
**Status: 0% built — Entirely missed in report**

| Screen | v2 File | Priority |
|--------|---------|----------|
| Menu Management | `advanced/MerchantMenuManagement.jsx` | 🔴 P1 for food |
| Menu Engineering | `advanced/MerchantMenuEngineering.jsx` | 🟠 P2 |
| Seasonal Menu | `advanced/MerchantSeasonalMenu.jsx` | 🟡 P3 |
| Kitchen Display (KDS) | `advanced/MerchantKDS.jsx` | 🟠 P2 |
| Kitchen Display 2 | `advanced/MerchantKitchenDisplay.jsx` | 🟠 P2 |
| Recipe Management | `advanced/MerchantRecipeManagement.jsx` | 🟡 P3 |
| Recipe Costing | `advanced/MerchantRecipeCosting.jsx` | 🟡 P3 |
| Ingredient Tracking | `advanced/MerchantIngredientTracking.jsx` | 🟡 P3 |
| Portion Control | `advanced/MerchantPortionControl.jsx` | 🟡 P3 |
| Table Management | `advanced/MerchantTableManagement.jsx` | 🟠 P2 |
| Table Booking | `advanced/MerchantTableBooking.jsx` | 🔴 P1 for restaurants |
| Floor Plan | `advanced/MerchantFloorPlan.jsx` | 🟠 P2 |
| QR Ordering | `advanced/MerchantQROrdering.jsx` | 🟠 P2 |
| Waiter App | `advanced/MerchantWaiterApp.jsx` | 🟠 P2 |
| Captain App | `multi-store/MerchantCaptainApp.jsx` | 🟠 P2 |
| Rush Hour Mode | `advanced/MerchantRushHourMode.jsx` | 🟡 P3 |
| Waste Management | `advanced/MerchantWasteManagement.jsx` | 🟡 P3 |
| Waste Tracking | `advanced/MerchantWasteTracking.jsx` | 🟡 P3 |

**ENTIRELY MISSED in our report. This is a whole restaurant management system.**

`MerchantMenuManagement.jsx` — CRUD for menu items: add dish, set price, photo, category (Starters/Mains/Desserts), availability by time, GST rate per item, mark as bestseller. **Every restaurant merchant needs this on Day 1. P1.**

`MerchantTableBooking.jsx` + `MerchantTableManagement.jsx` — table reservation system for restaurants. Connects to user's TableReservation.jsx in the user app. **P1 for restaurants. Add Phase 4.3.**

`MerchantKDS.jsx` / `MerchantKitchenDisplay.jsx` — kitchen display system: screen for chef to see incoming orders, mark items ready. Replaces paper tickets. **P2 — Add Phase 4.9.**

`MerchantQROrdering.jsx` — QR codes on each table → customer scans → orders from their phone. Generates table-specific QR, manages table sessions. **P2 — Add Phase 4.9.**

`MerchantWaiterApp.jsx` — waiter-facing mobile interface: see table orders, add to bill, mark items served. `MerchantCaptainApp.jsx` — senior waiter/captain: take orders, manage tables, process payments. **P2 — Add Phase 4.9.**

---

## GROUP 13: BEAUTY/WELLNESS-SPECIFIC (2 screens)
**Status: Entirely missed**

| Screen | v2 File | Priority |
|--------|---------|----------|
| Salon Packages | `advanced/MerchantSalonPackages.jsx` | 🟠 P2 |
| Prescriptions | `advanced/MerchantPrescriptions.jsx` | 🟡 P3 |

`MerchantSalonPackages.jsx` — create packages: "Bridal Package ₹8,000 — blowout + makeup + mehendi". Bundled services with package pricing. **Add Phase 4.9.**

---

## GROUP 14: COMPLIANCE + TAX (4 screens)
**Status: Mentioned but incomplete**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| GST Setup Wizard | `advanced/MerchantGSTSetupWizard.jsx` | ✅ mentioned | 🟠 P2 |
| GST Reports | `advanced/MerchantGSTReports.jsx` | ✅ mentioned | 🟠 P2 |
| GSTR Export | `advanced/MerchantGSTRExport.jsx` | ✅ mentioned | 🟠 P2 |
| HSN Codes | `advanced/MerchantHSNCodes.jsx` | ❌ **MISSING** | 🟠 P2 |
| TDS/TCS Reports | `advanced/MerchantTDSTCSReports.jsx` | ❌ **MISSING** | 🟠 P2 |
| Tax Compliance | `advanced/MerchantTaxCompliance.jsx` | ❌ **MISSING** | 🟠 P2 |
| E-Invoice | `advanced/MerchantEInvoice.jsx` | ❌ **MISSING** | 🟠 P2 |
| Documents | `advanced/MerchantDocuments.jsx` | ❌ **MISSING** | 🟡 P3 |
| Compliance | `advanced/MerchantCompliance.jsx` | ❌ **MISSING** | 🟡 P3 |

`MerchantHSNCodes.jsx` — assign HSN/SAC codes to products/services for correct GST filing. Mandatory for GST-registered merchants. **Add Phase 4.9.**

`MerchantEInvoice.jsx` — e-invoice generation (IRP portal) for B2B orders above ₹5L. Mandatory for eligible merchants. **Add Phase 4.9.**

`MerchantTDSTCSReports.jsx` — TDS/TCS tracking: platform deducts TCS on every settlement. Merchants need this for ITR filing. **Add Phase 4.9.**

---

## GROUP 15: TECH INTEGRATIONS (8 screens)
**Status: Entirely missed**

| Screen | v2 File | Priority |
|--------|---------|----------|
| Integration Hub | `advanced/MerchantIntegrationHub.jsx` | 🟡 P3 |
| Integrations | `advanced/MerchantIntegrations.jsx` | 🟡 P3 |
| Aggregator Bridge | `multi-store/MerchantAggregatorBridge.jsx` | 🟠 P2 |
| Aggregator Reconciliation | `multi-store/MerchantAggregatorReconciliation.jsx` | 🟠 P2 |
| ERP Connector | `advanced/MerchantERPConnector.jsx` | 🟡 P3 |
| POS Integration | `pos/MerchantPOSIntegration.jsx` | 🟡 P3 |
| Hardware Hub | `advanced/MerchantHardwareHub.jsx` | 🟡 P3 |
| Hardware Diagnostics | `advanced/MerchantHardwareDiagnostics.jsx` | 🟡 P3 |
| Integration Health | `advanced/MerchantIntegrationHealth.jsx` | 🟡 P3 |

**`MerchantAggregatorBridge.jsx`** — connects Swiggy/Zomato menus to BiZone. Sync menu, pull orders. This is **P2** — without it, restaurant merchants must manage two separate systems. **Add Phase 4.9.**

`MerchantAggregatorReconciliation.jsx` — reconcile revenue between Swiggy/Zomato commissions vs REZ. Shows net revenue after all platform fees. **Add Phase 4.9.**

---

## GROUP 16: OTHER ADVANCED (Missed entirely)

| Screen | v2 File | Priority |
|--------|---------|----------|
| Dynamic Pricing | `advanced/MerchantDynamicPricing.jsx` | 🟡 P3 |
| Pricing Intelligence | `advanced/MerchantPricingIntelligence.jsx` | 🟡 P3 |
| Price Engineering | `advanced/MerchantPriceEngineering.jsx` | 🟡 P3 |
| Competitor Pricing | `advanced/MerchantCompetitorPricing.jsx` | 🟡 P3 |
| Upsell Engine | `advanced/MerchantUpsellEngine.jsx` | 🟡 P3 |
| Payment Intents | `advanced/MerchantPaymentIntents.jsx` | 🟠 P2 |
| Payment Links | `advanced/MerchantPaymentLinks.jsx` | 🟠 P2 |
| Payment Reminders | `advanced/MerchantPaymentReminders.jsx` | 🟠 P2 |
| QR Payments | `advanced/MerchantQRPayments.jsx` | 🔴 P1 |
| Soft POS | `advanced/MerchantSoftPOS.jsx` | 🟠 P2 |
| Vouchers | `advanced/MerchantVouchers.jsx` | 🟠 P2 |
| Reviews | `advanced/MerchantReviews.jsx` | 🔴 P1 |
| Review Management | `advanced/MerchantReviewManagement.jsx` | 🔴 P1 |
| Shipping | `advanced/MerchantShipping.jsx` | 🟡 P3 |
| Delivery Bridge | `advanced/MerchantDeliveryBridge.jsx` | 🟡 P3 |
| Delivery Fleet | `advanced/MerchantDeliveryFleet.jsx` | 🟡 P3 |
| Discovery | `advanced/MerchantDiscovery.jsx` | 🟠 P2 |
| Trust Score | `advanced/MerchantTrustScoreDetail.jsx` | 🟠 P2 |
| Token Display | `advanced/MerchantTokenDisplay.jsx` | 🟠 P2 |
| Promotions | `advanced/MerchantPromotionParticipation.jsx` | 🟠 P2 |
| Bulk Import | `advanced/MerchantBulkImport.jsx` | 🟠 P2 |
| Bulk Ordering | `advanced/MerchantBulkOrdering.jsx` | 🟡 P3 |
| Wishlist Demand | `advanced/MerchantWishlistDemand.jsx` | 🟡 P3 |
| Supplier Management | `advanced/MerchantSupplierManagement.jsx` | 🟡 P3 |
| Supplier Contracts | `advanced/MerchantSupplierContracts.jsx` | 🟡 P3 |
| Vendor Portal | `advanced/MerchantVendorPortal.jsx` | 🟡 P3 |
| Returns | `advanced/MerchantReturns.jsx` | 🟠 P2 |
| Quotations | `advanced/MerchantQuotations.jsx` | 🟡 P3 |
| Print Templates | `advanced/MerchantPrintTemplates.jsx` | 🟡 P3 |
| Label Printing | `advanced/MerchantLabelPrinting.jsx` | 🟡 P3 |
| Calendar Sync | `advanced/MerchantCalendarSync.jsx` | 🟡 P3 |
| Holiday Calendar | `advanced/MerchantHolidayCalendar.jsx` | 🟡 P3 |
| Event Check-In | `advanced/MerchantEventCheckIn.jsx` | 🟡 P3 |
| Events | `advanced/MerchantEvents.jsx` | 🟡 P3 |
| Event Stream | `advanced/MerchantEventStream.jsx` | 🟡 P3 |
| Marketplace | `advanced/MerchantMarketplace.jsx` | 🟡 P3 |
| Warehouse | `advanced/MerchantWarehouseManagement.jsx` | 🟡 P3 |
| Multi-Warehouse | `advanced/MerchantMultiWarehouse.jsx` | 🟡 P3 |
| Stock Reconciliation | `advanced/MerchantStockReconciliation.jsx` | 🟡 P3 |
| Stock Transfer | `advanced/MerchantStockTransfer.jsx` | 🟡 P3 |
| Stock Variance | `advanced/MerchantStockVarianceReport.jsx` | 🟡 P3 |
| Store Transfer | `advanced/MerchantStoreTransfer.jsx` | 🟡 P3 |
| Branch Manager | `multi-store/MerchantBranchManager.jsx` | 🟡 P3 |
| Control Plane | `advanced/MerchantControlPlane.jsx` | 🟡 P3 |
| SuperOS Dashboard | `advanced/MerchantSuperOSDashboard.jsx` | 🟡 P3 |
| Data Export | `advanced/MerchantDataExport.jsx` | 🟠 P2 |
| Power Survival | `advanced/MerchantPowerSurvival.jsx` | 🟡 P3 |
| Notifications | `advanced/MerchantNotifications.jsx` | 🟠 P2 |

**Key P1/P2 additions missed:**

`MerchantQRPayments.jsx` — QR-based payment collection. Customer scans merchant's static QR → enters amount → pays. Simpler than dynamic QR. **P1 — Add Phase 4.2.**

`MerchantReviews.jsx` + `MerchantReviewManagement.jsx` — merchant sees all their reviews, can respond, flag abusive ones. **P1 — Add Phase 4.3.**

`MerchantVouchers.jsx` — create discount vouchers (promo codes). Track redemptions. **P2 — Add Phase 4.4.**

`MerchantPaymentLinks.jsx` — generate a payment link: "Pay ₹1,500 for haircut" → share via WhatsApp. Customer clicks → pays. **P2 — Add Phase 4.5.**

`MerchantTrustScoreDetail.jsx` — merchant's trust score: review rating, on-time fulfillment %, dispute resolution. Affects placement in Near U discovery. **P2 — Add Phase 4.7.**

`MerchantDiscovery.jsx` — how customers find this merchant: "32% via Near U search, 25% via Deals tab, 43% via direct link". **P2 — Add Phase 4.7.**

`MerchantDataExport.jsx` — export all data: orders, customers, transactions, offers. CSV/Excel/PDF. Merchant owns their data. **P2 — Add Phase 4.7.**

`MerchantReturns.jsx` — manage customer return requests. Accept/reject/partial refund. Track return reasons. **P2 — Add Phase 4.3.**

`MerchantBulkImport.jsx` — import products via CSV template. Essential for merchants moving from another system. **P2 — Add Phase 4.6.**

`MerchantSoftPOS.jsx` — ultra-simple POS: just a numeric keypad + coin toggle. For markets/pop-up stalls. **P2.**

`MerchantTokenDisplay.jsx` — queue management: issue token numbers to waiting customers. Auto-advance when merchant calls next. **P2 — useful for pharmacies, service centers.**

---

# PART B: ADMIN COMPLETE SCREEN INVENTORY
## 174 Designed → 79 Built → 95 Missing

---

## ADMIN GROUP 1: COIN MANAGEMENT SYSTEM (9 screens)
**Status: 0% built — ENTIRELY MISSING from current admin + our report**

| Screen | v2 File | Priority |
|--------|---------|----------|
| Coin System Overview | `coins/AdminCoinSystemOverview.jsx` | 🔴 P1 |
| Coin Rules Engine | `coins/AdminCoinRulesEngine.jsx` | 🔴 P1 |
| Earning Rule Matrix | `coins/AdminEarningRuleMatrix.jsx` | 🔴 P1 |
| Coin Issuance Control | `coins/AdminCoinIssuanceControl.jsx` | 🔴 P1 |
| Redemption Rules | `coins/AdminRedemptionRules.jsx` | 🟠 P2 |
| Promo Coin Manager | `coins/AdminPromoCoinManager.jsx` | 🟠 P2 |
| Promotion Launcher | `coins/AdminPromotionLauncher.jsx` | 🟠 P2 |
| Coin Events | `coins/AdminCoinEvents.jsx` | 🟠 P2 |
| Emergency Controls | `coins/AdminCoinEmergencyControls.jsx` | 🔴 P1 |

**This entire module was missed and it's P1.**

`AdminCoinSystemOverview.jsx` — real-time view: total REZ coins issued, redeemed, active balance, redemption rate per coin type (REZ/Branded/Promo/Privé). Dashboard for coin economy health.

`AdminCoinRulesEngine.jsx` — configure coin expiry per type (REZ: 365 days, Promo: 30 days, Branded: 90 days), multiplier rules ("Weekend 2× multiplier on REZ coins"), rollover rules.

`AdminEarningRuleMatrix.jsx` — the master matrix of what action → which coin → how much. Every single earning event across all categories (purchases, bill upload, reviews, games, referrals, social, events). Currently this config is hardcoded. This makes it configurable.

`AdminCoinIssuanceControl.jsx` — kill switch: immediately stop issuing specific coin type. Global cap per user per day. Emergency fraud prevention.

`AdminCoinEmergencyControls.jsx` — emergency actions: freeze all coin issuance (exploit detected), bulk recall promo coins, set global daily cap. Must-have for fraud response.

**Backend that needs to be created/extended:**
```
GET  /api/admin/coins/overview      → aggregate coin stats by type
GET  /api/admin/coins/rules         → all earning/expiry rules
POST /api/admin/coins/rules         → create/update rule
GET  /api/admin/coins/events        → real-time coin event stream
POST /api/admin/coins/emergency/pause  → kill switch
```

**Current admin has:** `coin-rewards.tsx`, `coin-gifts.tsx` — these are basic coin actions. The new Coin Management module is a complete economy control center.

---

## ADMIN GROUP 2: MERCHANT INTELLIGENCE (5 screens)
**Status: 0% built — Missed in report**

| Screen | v2 File | Priority |
|--------|---------|----------|
| Merchant Intelligence | `merchants/AdminMerchantIntelligence.jsx` | 🟠 P2 |
| Merchant Packages | `merchants/AdminMerchantPackages.jsx` | 🟠 P2 |
| Merchant Profit Engine | `merchants/AdminMerchantProfitEngine.jsx` | 🟠 P2 |
| Merchant SuperOS | `merchants/AdminMerchantSuperOS.jsx` | 🟠 P2 |
| Merchant Tier Config | `merchants/AdminMerchantTierConfig.jsx` | 🔴 P1 |
| Merchant Trust Score | `merchants/AdminMerchantTrustScore.jsx` | 🟠 P2 |
| Merchants Main | `merchants/AdminMerchants.jsx` | Partial in v6 |

`AdminMerchantTierConfig.jsx` — **P1**. Configures merchant tiers (Free → Pro → Enterprise) with commission rates per tier per coin type:
```
Free: Commission 20% (REZ 7% + Branded 5% + to-REZ 8%)
Pro:  Commission 15% (REZ 8% + Branded 7% + to-REZ 0%)
```
Without this, commission structure is hardcoded and can't change per merchant.

`AdminMerchantSuperOS.jsx` — HQ/Regional/Category manager views. Shows merchant health across all regions, active rate, revenue, order volumes. Regional managers see only their city.

`AdminMerchantIntelligence.jsx` — AI insights: "Bangalore food merchants will see 30% lower revenue next week — school holidays. Suggest: push special kids' menu offers."

**Backend needed:**
```
GET  /api/admin/merchant-tiers              → tier config
PUT  /api/admin/merchant-tiers/:tier        → update tier commission
GET  /api/admin/merchants/intelligence      → AI-powered insights
GET  /api/admin/merchants/superOS?region=X  → regional view
```

---

## ADMIN GROUP 3: CONTENT MANAGEMENT (9 screens)
**Status: 0% built — Partially mentioned**

| Screen | v2 File | Our Report | Priority |
|--------|---------|------------|----------|
| UGC Moderation | `content/AdminUGCManagement.jsx` | ✅ mentioned | 🔴 P1 |
| UGC Review | `content/AdminUGCReview.jsx` | ❌ **MISSING** | 🔴 P1 |
| Social Feed Control | `content/AdminSocialFeedControl.jsx` | ❌ **MISSING** | 🟠 P2 |
| Social Impact | `content/AdminSocialImpact.jsx` | Exists in v6 | 🟠 P2 |
| Social Impact Verification | `content/AdminSocialImpactVerification.jsx` | ❌ **MISSING** | 🟠 P2 |
| Social Integration | `content/AdminSocialIntegration.jsx` | ❌ **MISSING** | 🟡 P3 |
| Content | `content/AdminContent.jsx` | ❌ **MISSING** | 🟡 P3 |
| Content Moderation | `content/AdminContentModeration.jsx` | ❌ **MISSING** | 🟠 P2 |
| Creator Content | `content/AdminCreatorContent.jsx` | ❌ **MISSING** | 🟠 P2 |
| Creator Payouts | `content/AdminCreatorPayouts.jsx` | ❌ **MISSING** | 🔴 P1 |

`AdminUGCReview.jsx` — **P1, directly needed for Phase 3 Prive campaigns**. Review submitted posts (Instagram screenshots): approve/reject cashback, flag policy violations, add reviewer notes. Batch review workflow.

`AdminCreatorPayouts.jsx` — **P1**. Process cashback payouts to creators who completed Prive/UGC campaigns. Shows pending payouts, total owed, process via UPI/bank. Without this, the social cashback flow is incomplete.

`AdminSocialFeedControl.jsx` — control the in-app social feed algorithm. Configure weights: recency (25%), engagement (30%), relevance (20%), quality (15%), diversity (10%). Toggle feed algorithm parameters in real-time.

`AdminSocialImpactVerification.jsx` — verify social impact event completions (charity events, community activities). Separate from social cashback.

`AdminContentModeration.jsx` — AI-assisted content moderation queue. Flags inappropriate content for human review.

**Backend needed:**
```
GET  /api/admin/ugc/pending         → pending campaign submissions
PUT  /api/admin/ugc/:id/approve|reject
GET  /api/admin/creator-payouts/pending
POST /api/admin/creator-payouts/:id/process
GET  /api/admin/social-feed/algorithm-config
PUT  /api/admin/social-feed/algorithm-config
```

---

## ADMIN GROUP 4: MARKETING ORCHESTRATION (12 screens)
**Status: 0% built — Entirely missed**

| Screen | v2 File | Priority |
|--------|---------|----------|
| Marketing Orchestrator | `marketing/AdminMarketingOrchestrator.jsx` | 🟠 P2 |
| Campaign Approval | `marketing/AdminCampaignApproval.jsx` | 🔴 P1 |
| Campaign Builder | `marketing/AdminCampaignBuilder.jsx` | 🟠 P2 |
| Campaigns | `marketing/AdminCampaigns.jsx` | Partial in v6 |
| Email Marketing | `marketing/AdminEmailMarketing.jsx` | 🟠 P2 |
| Email Template Builder | `marketing/AdminEmailTemplateBuilder.jsx` | 🟠 P2 |
| Email Templates | `marketing/AdminEmailTemplates.jsx` | 🟠 P2 |
| Marketing Main | `marketing/AdminMarketing.jsx` | 🟠 P2 |
| Multi-Channel Marketing | `marketing/AdminMultiChannelMarketing.jsx` | 🟡 P3 |
| SMS Campaigns | `marketing/AdminSMSCampaigns.jsx` | 🟠 P2 |
| SMS Templates | `marketing/AdminSMSTemplates.jsx` | 🟠 P2 |
| Barter Campaigns | `marketing/AdminBarterCampaigns.jsx` | 🟡 P3 |

`AdminCampaignApproval.jsx` — **P1**. Review and approve/reject merchant campaign submissions before they go live. Currently campaigns auto-publish or admin has no queue. This is the proper approval workflow.

`AdminCampaignBuilder.jsx` — admin creates platform-wide campaigns (Diwali Cashback, Summer Sale). Different from merchant campaigns — these are REZ-funded. **P2.**

`AdminEmailMarketing.jsx` + `AdminEmailTemplateBuilder.jsx` — send targeted email campaigns to user segments. "Inactive users → re-engagement email with 2× coins offer." **P2.**

`AdminSMSCampaigns.jsx` — SMS to specific user segments. "Users near Koramangala → flash deal SMS". **P2.**

---

## ADMIN GROUP 5: ANALYTICS DASHBOARDS (10 screens)
**Status: 0% built — Our report mentioned them but missed detail**

| Screen | v2 File | Priority |
|--------|---------|----------|
| Analytics Dashboard | `dashboards/AdminAnalyticsDashboard.jsx` | 🟠 P2 |
| Content Dashboard | `dashboards/AdminContentDashboard.jsx` | 🟠 P2 |
| Finance Dashboard | `dashboards/AdminFinanceDashboard.jsx` | 🔴 P1 |
| Global Dashboard | `dashboards/AdminGlobalDashboard.jsx` | 🟠 P2 |
| Marketing Dashboard | `dashboards/AdminMarketingDashboard.jsx` | 🟠 P2 |
| Operations Dashboard | `dashboards/AdminOperationsDashboard.jsx` | 🟠 P2 |
| Regional Dashboard | `dashboards/AdminRegionalDashboard.jsx` | 🟠 P2 |
| Support Dashboard | `dashboards/AdminSupportDashboard.jsx` | 🟠 P2 |
| Ecosystem Analytics | `dashboards/AdminEcosystemAnalytics.jsx` | 🟡 P3 |
| AI Insights | `analytics/AdminAIInsights.jsx` | 🟡 P3 |
| AI Recommendations | `analytics/AdminAIRecommendations.jsx` | 🟡 P3 |
| AI Moderation Queue | `analytics/AdminAIModerationQueue.jsx` | 🟠 P2 |
| Predictive Analytics | `analytics/AdminPredictiveAnalytics.jsx` | 🟡 P3 |
| Heatmaps | `analytics/AdminHeatmaps.jsx` | 🟡 P3 |
| Session Replay | `analytics/AdminSessionReplay.jsx` | 🟡 P3 |

`AdminFinanceDashboard.jsx` — **P1**. Real-time financial overview: GMV, platform commission earned today, pending payouts, coin economy cost, net revenue. Current admin/index.tsx shows basic stats — this is the full finance view.

`AdminAIModerationQueue.jsx` — **P2**. AI flags suspicious content/activity for human review. Queue of flagged items: posts, reviews, coin abuse attempts, fraud signals.

`AdminRegionalDashboard.jsx` — **P2**. City-by-city view: Bangalore vs Mumbai vs Delhi performance. Region managers see only their city. Essential for scale.

---

## ADMIN GROUP 6: OPERATIONS INTELLIGENCE (5 screens)
**Status: 0% built — Entirely missed**

| Screen | v2 File | Priority |
|--------|---------|----------|
| Ops Intelligence | `operations/AdminOpsIntelligence.jsx` | 🟠 P2 |
| City Dashboard | `operations/OperationsCityDashboard.jsx` | 🟠 P2 |
| Dispute Resolution | `operations/AdminDisputeResolution.jsx` | 🔴 P1 |
| Fraud Detection | `operations/AdminFraudDetection.jsx` | 🔴 P1 |
| Fraud Main | `operations/AdminFraud.jsx` | Partial v6 |
| Offline Reconciliation | `operations/AdminOfflineReconciliation.jsx` | 🟠 P2 |
| Internal Ops | `operations/AdminInternalOps.jsx` | 🟡 P3 |
| Support Main | `operations/AdminSupport.jsx` | Partial v6 |

`AdminDisputeResolution.jsx` — **P1**. Formal dispute handling: user files dispute on cashback → admin reviews transaction → approve/reject claim → auto-process outcome. Current `disputes.tsx` is basic. This is the full workflow with SLA timers.

`AdminFraudDetection.jsx` — **P1**. Real-time fraud monitoring: coin farming patterns, fake review rings, account sharing, abnormal redemption velocity. AI-powered flags with one-click ban/shadow-throttle.

`AdminOpsIntelligence.jsx` — **P2**. AI-powered "what to do right now": "Bangalore Lunch Rush demand spiking — push 3× coin offer to 5km radius", "Mumbai food delivery complaints up 40% — investigate quality."

`OperationsCityDashboard.jsx` — **P2**. City operations manager view: merchants, active users, pending onboarding, today's GMV, support tickets, events.

---

## ADMIN GROUP 7: FINANCE (9 screens)
**Status: Partial — Most missed**

| Screen | v2 File | v6 Equivalent | Priority |
|--------|---------|---------------|----------|
| Settlement Commission | `finance/AdminSettlementCommission.jsx` | economics.tsx (partial) | 🔴 P1 |
| Bank Reconciliation | `finance/AdminBankReconciliation.jsx` | ❌ MISSING | 🟠 P2 |
| Cashback | `finance/AdminCashback.jsx` | cashback-rules.tsx (partial) | 🟠 P2 |
| Cashback Rates | `finance/AdminCashbackRates.jsx` | cashback-rules.tsx | 🟠 P2 |
| Payments | `finance/AdminPayments.jsx` | ❌ MISSING | 🟠 P2 |
| Wallet Analytics | `finance/AdminWalletAnalytics.jsx` | wallet.tsx (partial) | 🟠 P2 |
| Transactions | `finance/AdminTransactions.jsx` | ❌ MISSING | 🟠 P2 |
| Bank Offers | `finance/AdminBankOffers.jsx` | bank-offers.tsx ✅ | ✅ exists |
| Wallet Main | `finance/AdminWallet.jsx` | wallet.tsx ✅ | ✅ exists |

`AdminSettlementCommission.jsx` — **P1**. Complete settlement management: GMV by region/category, commission rates, pending settlements, bulk process payouts. Current `economics.tsx` only shows economics config — this is the live settlement operations screen.

`AdminBankReconciliation.jsx` — **P2**. Match REZ transaction records against bank statements. Identify discrepancies. Essential for finance team.

`AdminTransactions.jsx` — **P2**. Master transaction ledger: every payment, coin issuance, withdrawal across all users and merchants. Filter/search/export.

---

## ADMIN GROUP 8: INFRASTRUCTURE (10 screens)
**Status: 0% built — Entirely missed**

| Screen | v2 File | Priority |
|--------|---------|----------|
| API Monitoring | `infrastructure/AdminAPIMonitoring.jsx` | 🟠 P2 |
| API Quotas | `infrastructure/AdminAPIQuotas.jsx` | 🟡 P3 |
| Background Jobs | `infrastructure/AdminBackgroundJobs.jsx` | 🟠 P2 |
| Platform Health | `infrastructure/AdminPlatformHealth.jsx` | 🟠 P2 |
| Logs | `infrastructure/AdminLogs.jsx` | 🟠 P2 |
| Webhooks | `infrastructure/AdminWebhookManager.jsx` | 🟡 P3 |
| GMB Sync | `infrastructure/AdminGMBSync.jsx` | 🟡 P3 |
| POS Integration | `infrastructure/AdminPOSIntegration.jsx` | 🟡 P3 |
| Integrations | `infrastructure/AdminIntegrations.jsx` | 🟡 P3 |
| Language Manager | `infrastructure/AdminLanguageManager.jsx` | 🟡 P3 |
| Language Switcher | `infrastructure/AdminLanguageSwitcher.jsx` | 🟡 P3 |

`AdminAPIMonitoring.jsx` — **P2**. Live API health: endpoints, request count, avg response time, error rate. Shows: /api/payments/process at 96.5% success → needs attention.

`AdminBackgroundJobs.jsx` — **P2**. Monitor cron jobs: streak refresh, prive reputation refresh, settlement processing, expired coin cleanup. See last run time, next run, failure count.

`AdminPlatformHealth.jsx` — **P2**. System uptime dashboard: all services (auth/payments/coins/notifications/AI/fraud) green/yellow/red.

`AdminGMBSync.jsx` — **P3**. Sync merchant data to Google My Business. When merchant updates hours/photos in BiZone → auto-updates Google Maps listing.

---

## ADMIN GROUP 9: SPECIALIZED SYSTEMS (6 screens)
**Status: 0% built — Entirely missed**

| Screen | v2 File | Priority | What It Does |
|--------|---------|----------|--------------|
| Prive Management | `specialized/prive/AdminPriveManagement.jsx` | 🔴 P1 | Applications, tier management, submissions |
| Adzy Dashboard | `specialized/adzy/AdzyDashboard.jsx` | 🟡 P3 | REZ's own ad platform management |
| Adzy Ad Inventory | `specialized/adzy/AdzyAdInventory.jsx` | 🟡 P3 | Banner/push ad slots, pricing, fill rates |
| Rabtul Dashboard | `specialized/rabtul/RabtulDashboard.jsx` | 🟡 P3 | Backend system health (Rabtul = REZ tech OS) |
| Rabtul API Gateway | `specialized/rabtul/RabtulAPIGateway.jsx` | 🟡 P3 | API rate limits, quotas, partner access |
| Rabtul Coin Ledger | `specialized/rabtul/RabtulCoinLedger.jsx` | 🟡 P3 | Immutable audit log of all coin movements |
| Rabtul AIRA Engine | `specialized/rabtul/RabtulAIRAEngine.jsx` | 🟡 P3 | AI recommendation engine config |

`AdminPriveManagement.jsx` — **P1, directly needed for Phase 3**. Full Prive application workflow: pending applications list, eligibility scorecard per applicant, approve/reject with notes, manage active members by tier, suspension, override tier.

**Adzy System (P3):**
Adzy is REZ's native ad platform. Merchants pay to promote their offers as "sponsored" in Near U search results. `AdzyDashboard.jsx` shows: total ad revenue, active campaigns, CPM/CPC rates, fill rates. `AdzyAdInventory.jsx` manages available ad slots: banner positions on home screen, push notification slots, search result boosts.

**Rabtul System (P3):**
Rabtul appears to be the internal name for REZ's tech platform layer. `RabtulDashboard.jsx` = system health monitor (similar to Datadog). `RabtulCoinLedger.jsx` = immutable blockchain-style audit log of all coin transactions. `RabtulAIRAEngine.jsx` = recommendation algorithm config (AIRA = AI Recommendation Architecture).

---

## ADMIN GROUP 10: USERS + TRUST (5 screens)
**Status: Partial — 3 screens missed**

| Screen | v2 File | v6 Equivalent | Priority |
|--------|---------|---------------|----------|
| Users Main | `users/AdminUsers.jsx` | users.tsx ✅ | ✅ exists |
| User Management | `users/AdminUserManagement.jsx` | admin-users.tsx ✅ | ✅ exists |
| User Trust Score | `users/AdminUserTrustScore.jsx` | ❌ MISSING | 🔴 P1 |
| Habit Engine | `users/AdminUserHabitEngine.jsx` | ❌ MISSING | 🟠 P2 |
| Reported Content | `users/AdminUserReportedContent.jsx` | ❌ MISSING | 🟠 P2 |

`AdminUserTrustScore.jsx` — **P1**. View/manage individual user trust scores. See score breakdown, manually adjust if needed, set shadow-throttling for suspicious users, block/unblock. Directly enables Phase 8 (Trust Passport) on the admin side.

`AdminUserHabitEngine.jsx` — **P2**. Configure habit-forming mechanics per user segment: "After 3 purchases → trigger savings streak". View habit adoption metrics: % of users who check in daily, streak length distribution.

`AdminUserReportedContent.jsx` — **P2**. Queue of content reported by users (reviews, social posts, profile photos). Review and action (remove/dismiss/warn).

---

## ADMIN GROUP 11: PLATFORM TOOLS MISSED (from platform/ folder)

**Already mentioned in our report but incomplete — these need specific detail:**

| Screen | What's Needed | Priority |
|--------|--------------|----------|
| AdminTemporalCommerce | Flash deal timing by time-of-day demand patterns | 🟠 P2 |
| AdminCreditEngine | Credit limit config per trust tier | 🟠 P2 |
| AdminCollegeCorporateModule | Verify institutions + corporate accounts | 🟡 P3 |
| AdminCityLockEngine | Geographic deal locking (deals only in specific city) | 🟡 P3 |
| AdminCitySupplyLock | Restrict supply to cities based on merchant density | 🟡 P3 |
| AdminCompetitiveDefense | Track competitor offers, auto-counter with better deal | 🟡 P3 |
| AdminDiscountBuckets | Pre-approved discount ranges per merchant category | 🟠 P2 |
| AdminMandatoryOffers | REZ-guaranteed offers every merchant must honor | 🟠 P2 |
| AdminFounderVault | Founder-locked admin controls (nuclear options) | 🟡 P3 |
| AdminGovernmentConsole | DPDP compliance, data requests from authorities | 🟡 P3 |

`AdminTemporalCommerce.jsx` — time-slot-based demand management. Shows demand by hour (Early Bird: 35%, Morning Rush: 75%, Lunch Peak: 95%). Admin can push targeted coin offers to fill demand in low-hours. Surge coin multipliers during peak hours. **P2.**

`AdminDiscountBuckets.jsx` — admin pre-approves discount ranges: "Pizza merchants can offer 10-40% off, not more". Prevents merchants from offering 90% off to game the system. **P2.**

`AdminMandatoryOffers.jsx` — offers that every eligible merchant must honor. "Platform-funded: All REZ users get 5% cashback at any restaurant on Tuesdays". Admin creates → auto-applies to all qualifying merchants. **P2.**

---

# REVISED PHASE MAP

Based on complete analysis, here's what needs to be added/moved:

## Phase 4 P1 ADDITIONS (previously missed, now moved to P1):
```
MerchantQRPayments.jsx              ← P1: Basic payment collection
MerchantSimplePOS.jsx               ← P1: Simplified POS for small merchants
MerchantOfflinePOS.jsx              ← P1: Critical for India connectivity
MerchantOfflinePOSSync.jsx          ← P1: Required with offline POS
MerchantPOSTransactions.jsx         ← P1: End-of-day reconciliation
MerchantDayEndReport.jsx            ← P1: Every merchant needs daily summary
MerchantMenuManagement.jsx          ← P1: Restaurant merchants can't operate without this
MerchantTableBooking.jsx            ← P1: Restaurant table management
MerchantAppointments.jsx            ← P1: Service merchants need booking calendar
MerchantBookingCalendar.jsx         ← P1: Visual booking management
MerchantReviews.jsx                 ← P1: Merchants must respond to reviews
MerchantSuccess.jsx                 ← P1: Onboarding completion screen
MerchantUGCCampaigns.jsx            ← P1: Main social cashback merchant interface
```

## Admin P1 ADDITIONS (previously missed):
```
AdminCoinSystemOverview.jsx         ← P1: Coin economy health dashboard
AdminCoinRulesEngine.jsx            ← P1: Configurable coin rules
AdminEarningRuleMatrix.jsx          ← P1: Master earning config matrix
AdminCoinIssuanceControl.jsx        ← P1: Kill switch for fraud
AdminCoinEmergencyControls.jsx      ← P1: Emergency fraud response
AdminMerchantTierConfig.jsx         ← P1: Commission structure per tier
AdminPriveManagement.jsx            ← P1: Prive applications + submissions
AdminCreatorPayouts.jsx             ← P1: Process social cashback payouts
AdminUGCReview.jsx                  ← P1: Review post submissions
AdminCampaignApproval.jsx           ← P1: Approve merchant campaigns
AdminFinanceDashboard.jsx           ← P1: Real-time financial overview
AdminDisputeResolution.jsx          ← P1: Formal dispute workflow
AdminFraudDetection.jsx             ← P1: AI fraud monitoring
AdminUserTrustScore.jsx             ← P1: User trust score management
AdminSettlementCommission.jsx       ← P1: Settlement processing operations
```

---

# FINAL COMPLETE COUNT

## BiZone (Merchant App)
| Category | Screens |
|----------|---------|
| Auth + Onboarding | 3 |
| Dashboard + Analytics | 6 |
| Orders | 3 |
| POS | 7 |
| Inventory | 10 |
| Offers | 17 |
| Customers + Bookings | 8 |
| Finance | 16 |
| Staff | 11 |
| Loyalty + Branded Coins | 10 |
| Marketing + Social | 16 |
| Food-Specific | 18 |
| Beauty/Wellness | 2 |
| Compliance + Tax | 9 |
| Tech Integrations | 9 |
| Other Advanced | 30+ |
| **TOTAL** | **175+ screens** |

**P1 BiZone (must ship by Month 2):** 25 screens
**P2 BiZone (ship by Month 3-4):** 60 screens
**P3 BiZone (ship by Month 5-6):** 90+ screens

## Admin (HQ)
| Category | v6 Built | Missing |
|----------|---------|---------|
| Dashboards (10) | 1 | 9 |
| Coin Management (9) | 0 | 9 |
| Merchant Intelligence (7) | 1 | 6 |
| Content/UGC (10) | 2 | 8 |
| Marketing (12) | 1 | 11 |
| Analytics AI (10) | 0 | 10 |
| Operations (8) | 2 | 6 |
| Finance (9) | 3 | 6 |
| Infrastructure (11) | 1 | 10 |
| Specialized (6) | 0 | 6 |
| Users/Trust (5) | 2 | 3 |
| Platform (40+) | 19 | 21+ |
| **TOTAL** | **79** | **95+** |

**P1 Admin (needed for Phase 3-4 to work):** 15 screens
**P2 Admin:** 40 screens
**P3 Admin:** 40+ screens

---

*REZ Complete Gap Report · March 2026*
*219 BiZone screens + 174 Admin screens fully catalogued*
*Every screen mapped: current state, v2 design reference, priority, connections*
