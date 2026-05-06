# Bug Report: Campaign Logic & Offer Eligibility Enforcement

**Audit Date:** 2026-04-13
**Layer:** Campaign controller, offer service, marketing service, merchant service, consumer app
**Status:** CRITICAL — exclusive offers are accessible to everyone; usage limits are unenforced

---

## C14 — Zone offer eligibility is frontend-only; any authenticated user can fetch Senior/Women/Birthday zone offers via API {#c14}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Zone-exclusive offers (age-gated, gender-gated, birthday-gated) are accessible to all users who know the API endpoint, bypassing all eligibility requirements.

**What is happening:**
Consumer app checks:
```typescript
// senior.tsx:89
isEligible = userAge >= 60 || isVerified || zoneInfo?.userEligible === true

// women.tsx:84
isEligible = user?.profile?.gender === 'female' || zoneInfo?.userEligible === true

// birthday.tsx:92
isEligible = isBirthdayMonth() || zoneInfo?.userEligible === true
```

These checks gate the **UI display only**. The API call `getExclusiveZoneOffers(zone)` behind the button returns ALL offers for the zone to any authenticated user. The backend offer fetch routes do not validate the caller's age, gender, or birthday against the zone's eligibility requirements.

A 25-year-old male user can call `GET /api/offers/zones/senior` directly and receive all senior-exclusive offers. The app would hide this button from them, but the API endpoint is open.

**Files involved:**
- `rezapp/rez-master/app/offers/zones/senior.tsx:89`
- `rezapp/rez-master/app/offers/zones/women.tsx:84`
- `rezapp/rez-master/app/offers/zones/birthday.tsx:92`
- `rezbackend/rez-backend-master/src/routes/offersRoutes.ts` — no eligibility enforcement on zone offer fetch

**Fix:**
Add backend eligibility enforcement on the zone offer fetch endpoint:
```typescript
// GET /api/offers/zones/:zone
router.get('/zones/:zone', auth, async (req, res) => {
  const user = await User.findById(req.userId);
  const eligible = await zoneEligibilityService.checkEligibility(req.params.zone, user);
  if (!eligible) return res.status(403).json({ error: 'Not eligible for this zone' });
  // ... fetch offers
});
```

---

## C15 — Offer usage limits are configured in admin but counters are never decremented — unlimited redemptions {#c15}
> **Status:** ✅ FIXED

**Severity:** CRITICAL
**Impact:** Any offer with a configured `usageLimit` or `usageLimitPerUser` can be redeemed an unlimited number of times. Promo budget can be fully exhausted with no cap.

**What is happening:**
Admin creates an offer with:
```typescript
restrictions: {
  usageLimit: 100,         // max 100 total redemptions
  usageLimitPerUser: 1     // max 1 per user
}
```

Consumer-facing offer routes (`offersRoutes.ts`, `offersController.ts`) and merchant-facing offer routes (`rez-merchant-service/src/routes/deals.ts`) do not:
1. Check current usage count before allowing redemption
2. Decrement or increment the counter on redemption

These fields are stored and displayed in the admin panel but have zero enforcement at runtime.

**Files involved:**
- `rezbackend/rez-backend-master/src/routes/admin/offers.ts:51-55` — `restrictions.usageLimit` defined
- `rezbackend/rez-backend-master/src/services/offerService.ts` — no counter check or decrement
- `rez-merchant-service/src/routes/deals.ts` — no counter check at deal verification

**Fix:**
1. Add an `Offer.usageCount` field (total redemptions)
2. On redemption: atomic `findOneAndUpdate` with `$expr: { $lt: ['$usageCount', '$restrictions.usageLimit'] }` + `$inc: { usageCount: 1 }` — returns null if limit reached
3. For per-user: track in `UserOfferUsage` collection with `{ userId, offerId }` unique index

---

## H26 — Campaign `userEligible: false` annotation does not block redemption {#h26}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Users who are marked ineligible for an exclusive campaign (Privé-only, corporate perks, student zone) can still redeem it by calling the API directly.

**What is happening:**
`campaignController.ts` (lines 68-91) annotates campaigns with `userEligible: true/false` based on program membership. This annotation is used by the frontend to hide/show buttons.

`redeemDeal()` (lines 458-535) checks: `isActive`, `startTime`, `endTime`, `purchaseLimit`. It does **not** re-check `exclusiveToProgramSlug` or the `userEligible` flag at redemption time.

```typescript
// redeemDeal() — missing check:
// if (campaign.exclusiveToProgramSlug) {
//   const membership = await ProgramMembership.findOne({
//     user: userId, program: campaign.exclusiveToProgramSlug, status: 'active'
//   });
//   if (!membership) throw 'Not eligible for this campaign';
// }
```

**Files involved:**
- `rezbackend/rez-backend-master/src/controllers/campaignController.ts:68-91` — annotation only
- `rezbackend/rez-backend-master/src/controllers/campaignController.ts:458-535` — redemption (missing check)

**Fix:**
Add the eligibility check inside `redeemDeal()`:
```typescript
if (campaign.exclusiveToProgramSlug) {
  const membership = await ProgramMembership.findOne({
    user: userId,
    program: campaign.exclusiveToProgramSlug,
    status: 'active'
  });
  if (!membership) throw new AppError('You are not eligible for this campaign', 403);
}
```

---

## H27 — `minOrderValue` not enforced at deal redemption {#h27}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Users can redeem deals on orders below the minimum order value. Merchant receives a customer who spent less than required.

**What is happening:**
`Campaign.minOrderValue` is stored and displayed in the campaign details, but `redeemDeal()` does not validate the user's actual order amount against this field before issuing a redemption code.

Enforcement is left to the merchant verifying manually at POS — which is inconsistent and unenforceable at scale.

**Files involved:**
- `rezbackend/rez-backend-master/src/controllers/campaignController.ts:458-535` — `redeemDeal()` missing min order check

**Fix:**
The deal redemption should accept an `orderAmount` parameter and validate:
```typescript
if (campaign.minOrderValue && orderAmount < campaign.minOrderValue) {
  throw new AppError(`Minimum order of ₹${campaign.minOrderValue} required`, 400);
}
```

---

## H28 — Unapproved merchant offers served to consumers in offer feed {#h28}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** Merchant-created offers that are pending or rejected by admin are visible to consumers.

**What is happening:**
Admin-created offers have `adminApproved: true` set automatically. Merchant-created offers default to `adminApproved: false/absent` until admin approves.

Consumer-facing offer listing endpoints do not filter on `adminApproved: true`. A merchant can create an offer with false terms or a fraudulent discount, and consumers see it immediately before any admin review.

**Files involved:**
- `rezbackend/rez-backend-master/src/routes/admin/offers.ts:356` — `adminApproved: true` set for admin offers
- Consumer offer listing routes — no `adminApproved: true` filter

**Fix:**
Add `adminApproved: true` to all consumer-facing offer queries:
```typescript
Offer.find({ status: 'active', adminApproved: true, ...otherFilters })
```

---

## H34 — `StoreVoucher` POST and PUT pass `req.body` raw — arbitrary field injection possible {#h34}
> **Status:** ✅ FIXED

**Severity:** HIGH
**Impact:** A merchant can inject arbitrary fields into voucher documents, including system fields like `usageCount`, `isActive`, or `merchantId`.

**What is happening:**
`rez-merchant-service/src/routes/storeVouchers.ts`:
```typescript
// POST /
await StoreVoucher.create({ ...req.body, merchantId }); // ← no sanitization

// PUT /:id
await StoreVoucher.findByIdAndUpdate(id, { $set: req.body }); // ← any field writable
```

Compare to `discounts.ts` which uses `pickDiscountFields()` allow-list — `storeVouchers.ts` has no equivalent.

**Files involved:**
- `rez-merchant-service/src/routes/storeVouchers.ts:33,40`

**Fix:**
```typescript
function pickVoucherFields(body: any) {
  return pick(body, ['code', 'discountType', 'discountValue', 'validFrom', 'validTo',
    'usageLimit', 'minOrderValue', 'description', 'isActive']);
}
// POST:  StoreVoucher.create({ ...pickVoucherFields(req.body), merchantId })
// PUT:   findByIdAndUpdate(id, { $set: pickVoucherFields(req.body) })
```

---

## M15 — Timezone-naive date handling for regional campaigns — IST flash sales may expire 5.5 hours early {#m15}
> **Status:** ⏳ DEFERRED — timezone-aware campaign dates require admin UI changes and migration; tracked for Phase 2

**Severity:** MEDIUM
**Impact:** A flash sale configured to end "at midnight IST" expires at 6:30 PM IST (midnight UTC) on a UTC server. Users see the campaign end 5.5 hours before the advertised time.

**What is happening:**
All campaign date comparisons use `new Date()` (server UTC) vs stored ISO dates. No timezone-aware library is used. No `moment-timezone`, `luxon`, or `date-fns-tz` usage found in campaign code.

For India-targeted campaigns with a specific IST end time, admin must manually calculate the UTC offset when setting the end date — an error-prone manual step with no guardrail.

**Files involved:**
- `rezbackend/rez-backend-master/src/controllers/campaignController.ts` — date comparisons
- `rezbackend/rez-backend-master/src/services/couponService.ts` — `validFrom`/`validTo` comparisons

**Fix:**
1. Store all campaign dates as UTC (required)
2. Add a timezone field to the campaign creation form in admin: `timezone: 'Asia/Kolkata'` (default)
3. When admin sets a date, display the UTC equivalent before saving
4. Document the expectation that all dates in the DB are UTC

---

## M16 — Duplicate `campaignROI.ts` and `campaignSimulator.ts` exist in both merchant service and monolith {#m16}
> **Status:** ⏳ DEFERRED — route ownership decision required; tracked as tech debt cleanup

**Severity:** MEDIUM
**Impact:** Any fix or enhancement to campaign ROI/simulator logic must be applied in two places. They will diverge.

**What is happening:**
Identical files exist at:
- `rez-merchant-service/src/routes/campaignROI.ts`
- `rezbackend/rez-backend-master/src/merchantroutes/campaignROI.ts`

And:
- `rez-merchant-service/src/routes/campaignSimulator.ts`
- `rezbackend/rez-backend-master/src/merchantroutes/campaignSimulator.ts`

**Fix:**
Determine which service should own these routes. If the merchant service is the canonical owner, remove the monolith copies and ensure merchant service routes are properly authenticated. Add a redirect or deprecation notice if the monolith routes are still in use.

---

## M19 — `DiscountRule` PATCH endpoint passes `req.body` raw — any field overwritable {#m19}
> **Status:** ⏳ DEFERRED — field allowlist for PATCH tracked with merchant service security hardening

**Severity:** MEDIUM
**Impact:** A merchant can overwrite system fields on a discount rule (e.g., set `isActive: true` on an expired rule, or modify `merchantId`).

**What is happening:**
`rez-merchant-service/src/routes/discountRules.ts` line 55:
```typescript
await DiscountRule.findByIdAndUpdate(id, { $set: req.body }); // no allow-list
```

The `POST /` handler validates `name`, `type`, `value`, `validFrom`, `validTo` on creation. The PATCH handler applies any field.

**Files involved:**
- `rez-merchant-service/src/routes/discountRules.ts:55`

**Fix:**
Add a `pickDiscountRuleFields()` allow-list for the PATCH handler matching the POST validation fields.
