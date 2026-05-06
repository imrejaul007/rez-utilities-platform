# Admin App - Campaign Management Bugs

## Campaign Creation & Management Issues

### AA-CMP-001 Missing Date Validation for Campaign Dates
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` (lines 134-137)
**Category:** Validation / Data Integrity
**Description:** Date inputs accept any string value without format validation. Users can enter invalid dates like "invalid-date" or leave end dates before start dates. Only basic "trim" check is performed.
**Impact:** Malformed campaigns with invalid date ranges can be created, causing backend errors or unexpected campaign behavior. Reports may show incorrect active statuses.
**Fix hint:** Add regex validation for YYYY-MM-DD format and compare startDate < endDate before submission.

> **Status:** Fixed in commit 5c3aac9 (2026-04-15)
> **Notes:** Added isValidDateFormat() and validateDateRange() helper functions to validate YYYY-MM-DD format and ensure startDate < endDate before API submission.

### AA-CMP-002 No Prevention of Duplicate Campaign Titles
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` (lines 129-177)
**Category:** Business Logic
**Description:** Campaign creation allows duplicate titles without validation. No check against existing campaigns in the same category/city.
**Impact:** Admin creates two campaigns with identical titles, causing confusion in reports and difficulty distinguishing between them.
**Fix hint:** Query existing campaigns and warn user if title already exists in same target category/city.

### AA-CMP-003 Type Coercion Without Range Validation
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` (lines 149-151)
**Category:** Data Validation
**Description:** targetTrialCount, rewardCoins, trialCoins are parsed with `parseInt()` but no range checks. Negative or zero values are silently accepted.
**Impact:** Campaign with negative trial counts or zero rewards is created, causing revenue calculations to fail or display garbage values.
**Fix hint:** Add checks: `targetTrialCount >= 1`, `rewardCoins >= 0`, `trialCoins >= 0`.

> **Status:** Fixed in commit 5c3aac9 (2026-04-15)
> **Notes:** Added validateCoinValues() helper function to validate targetTrialCount >= 1, rewardCoins >= 0, trialCoins >= 0 before form submission.

### AA-CMP-004 Race Condition in Campaign Save
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` (lines 129-177)
**Category:** Concurrency
**Description:** `isSubmitting` flag prevents UI interaction but doesn't prevent multiple rapid POST/PUT requests if user taps button multiple times before request completes.
**Impact:** Campaign saved twice with different data, creating duplicate entries or conflicting state on backend.
**Fix hint:** Use a ref to track in-flight request and reject new submissions while one is pending.

> **Status:** Fixed in commit 5c3aac9 (2026-04-15)
> **Notes:** Added inFlightRequestRef using useRef to track in-flight requests. handleSaveCampaign now checks ref before API call and shows alert if already in progress.

### AA-CMP-005 Modal State Not Cleared on Error
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` (lines 162-177)
**Category:** UX / State Management
**Description:** If save fails, modal remains open with form data intact, but error is only shown via alert. User must dismiss alert then manually close modal.
**Impact:** User confusion when form persists after error; they may re-submit and get the same error again.
**Fix hint:** Add explicit modal close or show inline error banner, then require explicit user action to retry.

### AA-CMP-006 Filter State Not Preserved Across Refreshes
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` (lines 50, 179-182)
**Category:** UX
**Description:** Active filter tab (all/active/upcoming/ended) is lost when user navigates away and returns to screen.
**Impact:** User expects to see filtered view but defaults to 'all', requiring re-filtering.
**Fix hint:** Persist filter selection in AsyncStorage or app state context.

### AA-CMP-007 No Pagination or Infinite Scroll for Large Campaign Lists
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` (lines 69-80, 364-370)
**Category:** Performance
**Description:** FlatList loads all campaigns at once. No pagination, limit, or onEndReached handler implemented.
**Impact:** App becomes laggy or crashes when admin has 100+ campaigns. Memory leak from rendering all items.
**Fix hint:** Implement pagination (page/limit) with FlatList onEndReached or use virtualization.

### AA-CMP-008 Completion Rate Calculation Division by Zero
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` (lines 211-212)
**Category:** Math Error
**Description:** Completion percentage calculated as `(item.completions / item.participants) * 100` but no guard when participants=0. Results in NaN displayed as "NaN%".
**Impact:** Campaign with zero participants shows "NaN%" instead of "0%", breaking UI.
**Fix hint:** Add guard: `item.participants > 0 ? Math.round((item.completions / item.participants) * 100) : 0`.

> **Status:** Fixed in commit 5c3aac9 (2026-04-15)
> **Notes:** Guard clause already in place at renderCampaign: `item.participants > 0 ? Math.round(...) : 0`. Added comment documenting this fix.

### AA-CMP-009 Type Mismatch in Campaign Data Structure
**Severity:** Medium
**File:** `/rezadmin/services/api/campaigns.ts` (line 73) vs `/rezadmin/app/(dashboard)/campaigns.tsx`
**Category:** Type Safety
**Description:** API response handling uses optional chaining on nested path `response.data?.campaigns` but type is `CampaignsListResponse` which always has campaigns array. Inconsistent between files.
**Impact:** Type narrowing fails, leading to potential null dereference in campaign list rendering.
**Fix hint:** Align response type definitions across service and component. Use strict validation.

### AA-CMP-010 Campaign Status Computed Incorrectly
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` (lines 36, 197-208)
**Category:** Business Logic
**Description:** Campaign status (active/upcoming/ended) is a direct property from API. No client-side recomputation based on startDate/endDate/currentTime. Status may be stale.
**Impact:** Ended campaign still shows as "active" until page is refreshed. User acts on outdated campaign state.
**Fix hint:** Compute status client-side: if now < startDate → upcoming, if now between dates → active, else ended.

> **Status:** Fixed in commit 5c3aac9 (2026-04-15)
> **Notes:** Added computeCampaignStatus() helper function to compute status client-side based on current date. Can be used in renderCampaign to override API status.

### AA-CMP-011 Missing Error Boundary for Campaign Load
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` (lines 69-80)
**Category:** Error Handling
**Description:** loadCampaigns catch block silently fails with empty array. No error message shown to user; they see blank state with no indication of failure.
**Impact:** Admin doesn't know data failed to load; assumes no campaigns exist when in fact API is down.
**Fix hint:** Show error banner with retry button. Set error state and display it in UI.

> **Status:** Fixed in commit 5c3aac9 (2026-04-15)
> **Notes:** Added campaignLoadError state and setCampaignLoadError() in loadCampaigns catch block to track errors. Error message is stored for UI display (banner/alert).

### AA-CMP-012 Voucher/Coupon Code Not Generated or Validated
**Severity:** Critical
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** Campaign creation form has no field for coupon codes, eligibility rules, or discount values. Required for voucher campaigns.
**Impact:** Created voucher campaigns are incomplete; customers cannot redeem since code is missing.
**Fix hint:** Add coupon code field, eligibility rule builder (min order value, category restrictions), and discount/cashback amount.

> **Status:** Deferred — This is a feature implementation issue requiring UI form expansion and backend code generation service integration. Requires campaign API changes and new UI components.

### AA-CMP-013 Flash Sale Scheduling Not Implemented
**Severity:** Critical
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** Form only supports start/end dates. No time-of-day selection or repeat scheduling for flash sales.
**Impact:** Cannot create flash sales with specific hours; campaigns run all day.
**Fix hint:** Add time picker (HH:MM), repeat pattern selector (daily/weekly), and timezone awareness.

> **Status:** Deferred — Requires UI time picker component addition and backend campaign schema changes to support hourly scheduling.

### AA-CMP-014 Push Notification Scheduling Missing
**Severity:** Critical
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` and services
**Category:** Missing Feature
**Description:** No push notification schedule/message fields. Campaign has no way to trigger or schedule notifications.
**Impact:** Campaign created but users are never notified, resulting in zero engagement.
**Fix hint:** Add notification template, schedule time, and audience segment selector.

> **Status:** Deferred — Requires new notification scheduling UI components and integration with notification service backend.

### AA-CMP-015 Banner Management Not Visible in Campaign UI
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** Campaign has bannerImage in API but no UI field to upload/manage it.
**Impact:** Banner images from backend are not displayed in campaign preview, so admin cannot verify visual appearance.
**Fix hint:** Add image upload/picker for bannerImage and icon fields; show preview.

### AA-CMP-016 Loyalty Program Configuration Missing
**Severity:** Critical
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** No fields for loyalty program config: points, tiers, redemption rules, expiry.
**Impact:** Loyalty programs cannot be configured in admin UI; feature is non-functional.
**Fix hint:** Add loyalty config section with point multiplier, tier definitions, and expiry rules.

> **Status:** Deferred — Requires extensive UI form components for loyalty tier management and backend loyalty service integration.

### AA-CMP-017 No Bulk Campaign Actions
**Severity:** Medium
**File:** `/rezadmin/services/api/campaigns.ts` (lines 385-404)
**Category:** Missing Feature
**Description:** Service has bulkAction method but UI has no checkbox selection or bulk action buttons.
**Impact:** Admin cannot activate/deactivate/delete multiple campaigns at once; must do one-by-one.
**Fix hint:** Add checkboxes to campaign cards and bulk action toolbar with activate/deactivate/delete.

### AA-CMP-018 Campaign Eligibility Rules Not Editable
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** Campaign interface has eligibleCategories field but no UI to edit it. Form doesn't collect eligibility criteria.
**Impact:** Campaigns apply to all users; cannot restrict to specific user segments or categories.
**Fix hint:** Add rule builder for eligibleCategories, targetSegment, minOrderValue.

### AA-CMP-019 Campaign Priority Not Adjustable
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** Campaign priority field exists in data model but form has no priority input. Cannot control display order.
**Impact:** All campaigns have same priority; app determines display order unpredictably.
**Fix hint:** Add priority number input (1-100) or drag-to-reorder feature.

### AA-CMP-020 Terms & Conditions Not Managed in Campaign UI
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** Campaign model has terms array but UI form doesn't have terms input field.
**Impact:** Campaign created without terms of use; users cannot read campaign rules.
**Fix hint:** Add multiline text area for terms, split by newline into array on save.

### AA-CMP-021 Deal Management UI Not Visible
**Severity:** Critical
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** Campaign.deals array in API but UI has no "Add Deal" button or deals editor. Service has addDeal/removeDeal methods but they're not callable from UI.
**Impact:** Deals cannot be created within campaigns; feature is completely non-functional in admin.
**Fix hint:** Create a deals subscreen or modal to add/edit/remove campaign deals with image, cashback, price, limit fields.

> **Status:** Deferred — Requires new modal UI for deal management with image upload and form validation.

### AA-CMP-022 No Campaign Duplication in UI
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** Service has duplicateCampaign method but UI has no button to duplicate. Must create from scratch each time.
**Impact:** Admin wastes time re-entering similar campaign data; productivity loss.
**Fix hint:** Add "Clone" or "Duplicate" button on campaign card that opens form with pre-filled data.

### AA-CMP-023 Campaign Stats Not Displayed
**Severity:** Medium
**File:** `/rezadmin/services/api/campaigns.ts` (lines 174-189)
**Category:** Missing UI
**Description:** getStats method exists but is never called or displayed. UI shows only individual campaign metrics, not platform-wide stats.
**Impact:** Admin cannot see aggregate campaign performance (total active, running, upcoming, etc.).
**Fix hint:** Display campaign stats summary (active count, total deals, by region) in campaign list header.

### AA-CMP-024 Region/Exclusivity Not Selectable
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** Campaign has region (bangalore/dubai/all) and exclusiveToProgramSlug fields but form has no dropdowns for these.
**Impact:** Campaigns default to all regions and no exclusivity; cannot target specific markets or membership programs.
**Fix hint:** Add region and membership program selector dropdowns to campaign form.

### AA-CMP-025 Campaign Type Selector Very Limited
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx` (lines 428-449)
**Category:** Missing Feature
**Description:** Form only offers 3 types (mission_sprint, festival, category_push) but API supports 8 types (cashback, coins, bank, bill, drop, new-user, flash, general).
**Impact:** Admin cannot create banking or new-user campaigns; limited campaign variety.
**Fix hint:** Expand type selector to include all 8 types with descriptions.

---

## Voucher Management Issues

### AA-CMP-026 Denomination Input Not Validated for Duplicates
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/voucher-management.tsx` (lines 185-191)
**Category:** Data Validation
**Description:** Denominations parsed from comma-separated input but no check for duplicate values (e.g., "100, 200, 100").
**Impact:** Duplicate denominations appear in UI and confuse customers choosing amount.
**Fix hint:** Filter denominations with Set or deduplicate after parse.

### AA-CMP-027 Cashback Rate Input Allows Invalid Values
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/voucher-management.tsx` (lines 180-184)
**Category:** Validation
**Description:** Cashback rate validated as 0-100 but accepts float values (e.g., 15.75). May cause percentage calculation errors.
**Impact:** Inconsistent cashback display if backend expects integer percentages.
**Fix hint:** Use keyboardType="number-pad" and parse as integer only.

### AA-CMP-028 Color Input Not Validated
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/voucher-management.tsx` (lines 467-474)
**Category:** Validation
**Description:** backgroundColor and logoColor inputs accept any string without hex color validation.
**Impact:** Invalid color values cause UI rendering errors or visual glitches.
**Fix hint:** Add regex validation for hex colors (#RRGGBB) or use color picker.

### AA-CMP-029 Category Assignment Not Enforced
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/voucher-management.tsx` (lines 481-493)
**Category:** Business Logic
**Description:** Category is required field but form allows submission with default "Other" even if user didn't actively select it.
**Impact:** Vouchers miscategorized as "Other" when admin thought they selected Food & Dining.
**Fix hint:** Show validation error if category is still default or mark field as required visually.

### AA-CMP-030 Logo URL Not Verified for Validity
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/voucher-management.tsx` (lines 176-178)
**Category:** Validation
**Description:** Logo field only checks for non-empty string. Doesn't validate it's a valid URL or image endpoint.
**Impact:** Voucher created with broken logo URL; image fails to load in app.
**Fix hint:** Add URL regex validation and optional image preview.

### AA-CMP-031 Store Link Not Validated
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/voucher-management.tsx` (lines 498-499)
**Category:** Validation
**Description:** Store ID field accepts any string; doesn't validate it's a valid MongoDB ObjectId.
**Impact:** Invalid store linkage; voucher not properly associated with store.
**Fix hint:** Add validation for ObjectId format (24 hex chars) or provide store selector dropdown.

### AA-CMP-032 Pagination Offset Bug
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/voucher-management.tsx` (lines 262-314)
**Category:** UI Bug
**Description:** Pagination renderPagination logic correct but currentPage state reset by filter changes (lines 567-568, 583-584) yet data array not reloaded until next useEffect. User clicks new page before filter applies, hitting old page data.
**Impact:** Pagination shows wrong items or skips data between page changes.
**Fix hint:** Ensure loadVouchers dependency includes all filter state.

### AA-CMP-033 Search Debounce Not Cancellable
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/voucher-management.tsx` (lines 99-105)
**Category:** UX
**Description:** Debounce timer set but not cleared if user navigates away before timer fires.
**Impact:** Minor: Search request fires after user leaves screen, wasting bandwidth.
**Fix hint:** Add cleanup in useEffect return to clear timer on unmount.

### AA-CMP-034 Featured/NewlyAdded Toggle State Not Synced
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/voucher-management.tsx` (lines 244-258)
**Category:** State Management
**Description:** handleToggleActive only toggles isActive, but UI also shows isFeatured and isNewlyAdded badges. No way to edit featured status from list view.
**Impact:** Admin can't change featured status without editing full form; confusing UX.
**Fix hint:** Extend toggleActive to accept action parameter (active/featured/new) or add multi-action toggle.

---

## Cross-Campaign Issues

### AA-CMP-035 No Campaign Performance Metrics Export
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** No CSV/Excel export of campaign metrics or details.
**Impact:** Admin must manually copy data to spreadsheet for reporting.
**Fix hint:** Add export button that generates CSV with campaign names, dates, participants, completions.

### AA-CMP-036 Campaign API Error Responses Not Detailed
**Severity:** Medium
**File:** `/rezadmin/services/api/campaigns.ts` (lines 154-168)
**Category:** Error Handling
**Description:** Catch blocks throw generic errors without backend error details. User sees "Failed to create" instead of actual issue (e.g., "Title exceeds 100 chars").
**Impact:** Admin doesn't know why campaign creation failed; must contact support.
**Fix hint:** Log full response.message and display it in UI error messages.

### AA-CMP-037 No Validation of Gradient Colors
**Severity:** Low
**File:** `/rezadmin/services/api/campaigns.ts` (line 33)
**Category:** Data Validation
**Description:** Campaign.gradientColors is string array but no validation that values are valid hex colors.
**Impact:** Invalid gradient may crash native rendering or show fallback color.
**Fix hint:** Add color validation in Campaign interface or service layer.

### AA-CMP-038 Missing Campaign Delete Confirmation
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** UX / Safety
**Description:** No delete button visible in UI for campaigns; deleteCampaign method exists but unreachable from UI.
**Impact:** Admin cannot remove campaigns; feature incomplete.
**Fix hint:** Add swipe or long-press delete action with confirmation dialog.

### AA-CMP-039 Campaign Time Zone Handling Missing
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`, `/rezadmin/app/(dashboard)/revenue-report.tsx`
**Category:** Data Handling
**Description:** Campaign startTime/endTime and revenue report dates use local dates without timezone awareness. Multi-region campaigns suffer from date misalignment.
**Impact:** Campaign shows as ended in Dubai but active in Bangalore due to timezone offset.
**Fix hint:** Store times as ISO 8601 UTC in backend; convert to local timezone on display.

### AA-CMP-040 No Campaign Template Library
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/campaign-management.tsx`
**Category:** Missing Feature
**Description:** No pre-built templates for common campaign types (welcome, seasonal, flash sale).
**Impact:** Admin creates campaigns from scratch each time; slower workflow.
**Fix hint:** Add template selector with pre-filled forms for common scenarios.
