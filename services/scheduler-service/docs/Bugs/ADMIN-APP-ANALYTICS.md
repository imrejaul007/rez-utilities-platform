# Admin App - Analytics & Reports Bugs

## Analytics Dashboard Issues

### AA-ANL-001 Missing Error Handling for Platform Summary API
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx` (lines 190-221)
**Category:** Error Handling
**Description:** Platform summary fetch wrapped in Promise.allSettled but rejected reason is not caught properly. If fetch fails, platformRes.status='rejected' but value is never checked before use.
**Impact:** Null dereference error or silent failure; platform summary never shown even if analytics loads.
**Fix hint:** Add explicit check: if (platformRes.status === 'rejected') return; before accessing value.

> **Status:** Fixed in commit 5c3aac9 (2026-04-15)
> **Notes:** Added explicit check: else if (platformRes.status === 'rejected') to handle platform summary fetch failures gracefully without crashing dashboard.

### AA-ANL-002 Analytics Data Not Loaded on Screen Focus
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx` (lines 229-234)
**Category:** Data Freshness
**Description:** useFocusEffect calls fetchAll but no listener for when admin returns to screen after background. Data stale after 30+ minutes away.
**Impact:** Admin views outdated analytics; last 30 minutes of data missing.
**Fix hint:** Refresh data on focus, or set up auto-refresh timer that resumes when app is focused.

### AA-ANL-003 No Loading Fallback for Stats
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx` (lines 178, 200-202)
**Category:** UX
**Description:** Stats state initialized to null; if dashboardService.getStats() fails, stats remains null. No error state shown separately from loading state.
**Impact:** Empty stats cards shown to user; unclear if data failed to load or is genuinely zero.
**Fix hint:** Use separate error state for stats; show "—" or error message instead of blank.

### AA-ANL-004 User Growth Chart Calculation Error
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx` (lines 144-161)
**Category:** Math Error
**Description:** Bar chart height uses `Math.max((day.newUsers / max) * 100, 4)` which ensures minimum 4% even if day.newUsers is 0. Visual distortion for low-value days.
**Impact:** Charts misleading; tiny growth days appear larger than they are.
**Fix hint:** Remove Math.max constraint or use logarithmic scale.

### AA-ANL-005 Suspicious Activity Severity Colors Hard-coded
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx` (lines 79-98)
**Category:** Maintainability
**Description:** severityColor and severityBg are utility functions with hardcoded color hex strings; not using Colors constant.
**Impact:** Hard to maintain; if theme colors change, suspicious activity colors don't update.
**Fix hint:** Move colors to Colors object and reference them.

### AA-ANL-006 Analytics Service URL Not Validated
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx` (lines 185-192)
**Category:** Error Handling
**Description:** ANALYTICS_SERVICE_URL from env var used without validation. If empty or invalid, fetch() silently fails.
**Impact:** Platform summary never loads; admin never knows analytics service is unreachable.
**Fix hint:** Validate URL format on init; show warning banner if service unreachable.

> **Status:** Fixed in commit 5c3aac9 (2026-04-15)
> **Notes:** Added isAnalyticsUrlValid flag that validates ANALYTICS_SERVICE_URL with regex /^https?:\/\/. Can be used to conditionally show warning banner or skip fetch.

### AA-ANL-007 Role Check Not Guarding Hooks
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx` (lines 174-176, 187-234)
**Category:** Rules of Hooks
**Description:** Comment says "role guard BEFORE hooks" but useFocusEffect is called after. If hasRole throws, hooks count changes and React crashes.
**Impact:** Accessing analytics as non-admin may cause crash instead of access denied screen.
**Fix hint:** Move role check earlier and return early (but Rules of Hooks requires all hooks called always).

### AA-ANL-008 Suspicious Activity Log Not Auto-Refreshing
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx`
**Category:** Data Freshness
**Description:** Suspicious activity shown once on load; doesn't update if new fraud detected while admin viewing.
**Impact:** Admin viewing dashboard misses newly flagged transactions until manual refresh.
**Fix hint:** Set up 30-second poll or WebSocket listener for new suspicious activity.

### AA-ANL-009 Top Merchants Sorting Not Controllable
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx`
**Category:** Missing Feature
**Description:** Top merchants list displayed as-is from API; no sort by revenue, name, or transaction count.
**Impact:** Admin cannot reorder list; must rely on backend order.
**Fix hint:** Add sort selector (revenue desc, name asc, etc.) and sort client-side.

### AA-ANL-010 No Timezone Conversion for Display
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx`, `/rezadmin/app/(dashboard)/revenue-report.tsx`
**Category:** Localization
**Description:** Analytics timestamps and date ranges displayed in UTC/local without indicating timezone. Multi-region platform shows conflicting data.
**Impact:** Admin in Dubai sees analytics for UTC times; confusing for revenue reconciliation.
**Fix hint:** Detect user timezone, convert all dates/times to it, and display timezone label.

> **Status:** Fixed in commit 5c3aac9 (2026-04-15)
> **Notes:** Added getUserTimezone() and formatDateInTimezone() helper functions to analytics-dashboard.tsx. These can be used to detect device timezone and convert UTC dates to user's timezone.

---

## Revenue Report Issues

### AA-ANL-011 Date Range Validation Too Permissive
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/revenue-report.tsx` (lines 96-100, 214-218)
**Category:** Validation
**Description:** isValidDate only checks regex and getTime(), doesn't validate if end < start or range > 365 days.
**Impact:** User can select end date before start; generates confusing empty report.
**Fix hint:** Add check: endDate > startDate and (endDate - startDate) <= 365 days.

### AA-ANL-012 Store Slug Input Not Validated
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/revenue-report.tsx` (lines 259-265, 184)
**Category:** Validation
**Description:** Store slug used directly in URL without validation. Accepts special chars that break URI.
**Impact:** Invalid store slug causes API 400 or loads wrong store data.
**Fix hint:** Validate slug format (alphanumeric + hyphens only); encode properly with encodeURIComponent.

### AA-ANL-013 CSV Export Missing Data Escaping
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/revenue-report.tsx` (lines 110-148)
**Category:** Data Format
**Description:** CSV builder escapes item.name quotes (line 143) but doesn't escape other fields like date or category if they contain commas or quotes.
**Impact:** CSV parsing breaks if merchant name or item name has comma (e.g., "Salon, Spa & Wellness").
**Fix hint:** Escape all fields: `"${field.replace(/"/g, '""')}"`.

> **Status:** Fixed in commit f88c5a6 (2026-04-15)
> **Notes:** Added escapeCSVField() helper function to escape all CSV fields including commas, quotes, and newlines. Updated buildCSV to use escapeCSVField for all fields.

### AA-ANL-014 No Handling for Empty Daily Revenue
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/revenue-report.tsx` (lines 288-289)
**Category:** Edge Cases
**Description:** If dailyRevenue is empty, maxRevenue defaults to 1. Chart bars still render but appear empty.
**Impact:** Empty chart shown instead of "No data" message; confusing.
**Fix hint:** Check if dailyRevenue.length === 0 and show placeholder message.

### AA-ANL-015 Payment Breakdown Division by Zero
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/revenue-report.tsx` (lines 291-294)
**Category:** Math Error
**Description:** If paymentBreakdown is undefined or both cash and online are 0, pbTotal is 0. cashPct calculation becomes NaN.
**Impact:** Payment method percentage bar shows NaN%; UI broken.
**Fix hint:** Add guard: if (!pb || pbTotal === 0) { cashPct = 50; onlinePct = 50; }.

### AA-ANL-016 Report Data Not Cached; Refetch on Every Filter Change
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/revenue-report.tsx` (lines 243-249)
**Category:** Performance
**Description:** useEffect dependency includes [storeSlug, preset, customFrom, customTo] but doesn't include `loadReport` function ref. Every render triggers new fetch even if deps unchanged.
**Impact:** Multiple redundant API calls; wasted bandwidth and slower response.
**Fix hint:** Wrap loadReport in useCallback and include in dependency array correctly.

### AA-ANL-017 Custom Date Not Reset When Preset Changes
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/revenue-report.tsx` (lines 187-189, 243-249)
**Category:** State Management
**Description:** When admin switches from custom to preset (e.g., week), customFrom/customTo are not cleared. If they switch back to custom, old dates are still there.
**Impact:** Confusing UX; admin thinks they're viewing custom range but actually viewing preset.
**Fix hint:** Clear custom dates when preset changes, or preserve them and restore on custom selection.

### AA-ANL-018 Export Button Disabled Without Feedback
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/revenue-report.tsx` (lines 267-284)
**Category:** UX
**Description:** Export button disabled if data is null (line 268) but no visual feedback (grayed out button) is shown.
**Impact:** User clicks export, nothing happens; they think app is broken.
**Fix hint:** Add disabled state styling or show tooltip "Load a store first".

### AA-ANL-019 Revenue Number Formatting Loss of Precision
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/revenue-report.tsx` (lines 102-106)
**Category:** Data Display
**Description:** formatINR truncates to 1 decimal place (e.g., ₹1.5L) losing actual amount (could be ₹150,000 or ₹159,999).
**Impact:** Admin gets rough estimate instead of exact figure for financial reconciliation.
**Fix hint:** Show full number in tooltip or switch to detailed view; use formatINR only for quick overview.

### AA-ANL-020 No Handling for API Rate Limit
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/revenue-report.tsx` (lines 212-240)
**Category:** Error Handling
**Description:** If backend returns 429 (too many requests), error is displayed but no retry-after header parsed or exponential backoff implemented.
**Impact:** User doesn't know to wait; if they retry immediately, they hit rate limit again.
**Fix hint:** Parse Retry-After header; show countdown timer before allowing retry.

---

## Funnel Analytics Issues

### AA-ANL-021 Funnel Name Selection State Not Synced with URL
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/funnel-analytics.tsx` (lines 35, 40-75)
**Category:** Navigation
**Description:** Funnel selection (line 35) stored in local state but not reflected in URL. If user bookmarks page, they return to first funnel.
**Impact:** Bookmark doesn't preserve selected funnel.
**Fix hint:** Add funnel query param to URL and read from params.

### AA-ANL-022 Funnel Step Count Not Validated
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/funnel-analytics.tsx` (lines 46-61)
**Category:** Data Validation
**Description:** rawSteps array normalized without checking length. If backend returns 1 step, funnel visualization breaks (no dropoff to calculate).
**Impact:** Single-step funnel shows 0% completion; confusing visualization.
**Fix hint:** Validate steps.length >= 2; show message if insufficient data.

### AA-ANL-023 Dropoff Calculation Rounding Error
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/funnel-analytics.tsx` (lines 54-59)
**Category:** Math Error
**Description:** Dropoff percentage calculated as `Math.round(((prev - current) / prev) * 100)`. If prev=3 and current=1, result is 67%, but rounding can show 0% for very small numbers due to integer math.
**Impact:** Dropoff appears as 0% when it should be >0%; misleading funnel analysis.
**Fix hint:** Use toFixed(1) instead of Math.round() to preserve decimal precision.

### AA-ANL-024 No Funnel Comparison Across Time Periods
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/funnel-analytics.tsx`
**Category:** Missing Feature
**Description:** Funnel data shown for current period only; no date range selector to compare week-over-week or month-over-month.
**Impact:** Admin cannot see if funnel is improving or degrading over time.
**Fix hint:** Add date range picker (today, 7d, 30d, custom) and fetch funnel data for each period.

### AA-ANL-025 Funnel Percentages Not Based on Total
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/funnel-analytics.tsx` (lines 50-53)
**Category:** Data Calculation
**Description:** Percentages calculated as `(count / topCount) * 100` where topCount is first step. Standard funnel shows percentage of previous step, not percentage of total.
**Impact:** Admin misinterprets funnel; thinks 50% completed journey but actually 50% of top step.
**Fix hint:** Clarify in UI labels; add option for "cumulative %" vs "step drop-off %".

### AA-ANL-026 No Segment-Level Funnel Breakdown
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/funnel-analytics.tsx`
**Category:** Missing Feature
**Description:** Funnel shows aggregate only; no breakdown by user segment, platform, city, etc.
**Impact:** Cannot identify which segment has highest/lowest conversion; blind to segment-specific issues.
**Fix hint:** Add segment filter dropdown (all, new users, lapsed, high-value) and fetch funnel per segment.

---

## Marketing Analytics Issues

### AA-ANL-027 KPI Value Type Mismatch
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/marketing-analytics.tsx` (lines 77-100)
**Category:** Type Safety
**Description:** KPICard accepts `value: string | number` but averageOpenRate passed as number. If formatted as percentage, shows as "0.45" instead of "45%".
**Impact:** KPI cards show confusing raw decimals instead of percentages.
**Fix hint:** Add formatting function or pass pre-formatted string; clarify units in type.

### AA-ANL-028 Channel Breakdown Percentages May Not Sum to 100%
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/marketing-analytics.tsx` (lines 51-58)
**Category:** Math Error
**Description:** Channels have individual percentages but no validation they sum to 100%. If backend returns partial data, total is <100%.
**Impact:** Visual percentage bars don't fill screen; confusing layout.
**Fix hint:** Validate percentages sum to 100% or normalize them.

### AA-ANL-029 Campaign Status Not Validated
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/marketing-analytics.tsx` (line 31)
**Category:** Type Safety
**Description:** CampaignStatus type defined as 'active' | 'completed' | 'draft' but API may return other values.
**Impact:** TypeScript doesn't catch mismatches; runtime errors if status is 'paused' or 'scheduled'.
**Fix hint:** Add fallback status handler or validate at service layer.

### AA-ANL-030 Campaign Sent Count Interpretation Unclear
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/marketing-analytics.tsx` (lines 52)
**Category:** Metrics Definition
**Description:** totalCampaignsSent label could mean "number of campaigns sent" or "total messages sent". Ambiguous without context.
**Impact:** Admin confused about metric meaning; may misinterpret growth.
**Fix hint:** Rename to "Total Messages Sent" or "Campaigns Launched" + clarify in help text.

### AA-ANL-031 Recent Campaigns List Not Sorted
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/marketing-analytics.tsx` (lines 57)
**Category:** UX
**Description:** recentCampaigns array displayed as-is; no sort by creation date or status.
**Impact:** "Recent" campaigns may not be most recent; misleading label.
**Fix hint:** Sort by createdAt descending and limit to 10 most recent.

### AA-ANL-032 Open Rate Calculation Incomplete
**Severity:** High
**File:** `/rezadmin/app/(dashboard)/marketing-analytics.tsx` (lines 52-54)
**Category:** Metrics Definition
**Description:** averageOpenRate shown as single number but no context for sent vs delivered vs opened counts. Cannot verify calculation.
**Impact:** Admin cannot trust metric; no way to validate accuracy.
**Fix hint:** Add detailed breakdown card showing sent, delivered, opened, clicked counts.

### AA-ANL-033 No Drill-Down Into Campaign Details
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/marketing-analytics.tsx`
**Category:** Missing Feature
**Description:** Campaign row shown (id, name, status, sent count) but no tap handler to drill into campaign details or message template.
**Impact:** Admin sees summary but cannot view campaign content or edit; incomplete feature.
**Fix hint:** Add onPress to campaign row that navigates to campaign detail screen.

### AA-ANL-034 Channel Icons Hardcoded
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/marketing-analytics.tsx` (lines 61-71)
**Category:** Maintainability
**Description:** CHANNEL_DISPLAY hardcoded with icon/color mappings; adding new channel requires code change.
**Impact:** New channel types cannot be added without developer work.
**Fix hint:** Move to config file or fetch from backend; add fallback icon.

### AA-ANL-035 No Time Series Data for Campaign Volume
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/marketing-analytics.tsx`
**Category:** Missing Feature
**Description:** Campaign volume shown as recent list only; no chart of campaigns sent over time.
**Impact:** Cannot see if campaign frequency increasing or stable.
**Fix hint:** Add time-series bar chart (campaigns per day/week) to complement list view.

---

## Cross-Analytics Issues

### AA-ANL-036 Date Format Inconsistency Across Screens
**Severity:** High
**File:** Multiple analytics files (revenue-report, analytics-dashboard, etc.)
**Category:** Data Handling
**Description:** Analytics dashboard uses toISODate (YYYY-MM-DD) but some API responses return ISO 8601 with time (2024-01-15T00:00:00Z). Format parsing fails in places.
**Impact:** Date mismatches; off-by-one errors in date filtering.
**Fix hint:** Standardize all date handling to use ISO 8601; parse with date-fns consistently.

### AA-ANL-037 No Loading State for Chart Rendering
**Severity:** Medium
**File:** `/rezadmin/app/(dashboard)/revenue-report.tsx`, merchant-plan-analytics.tsx
**Category:** UX
**Description:** Charts load asynchronously but no skeleton loader or spinner shown while fetching data.
**Impact:** Screen appears blank until data arrives; poor perceived performance.
**Fix hint:** Add skeleton loaders for stat cards and charts.

### AA-ANL-038 Analytics Service URL Environment Variable Not Documented
**Severity:** Low
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx` (line 185)
**Category:** Configuration
**Description:** EXPO_PUBLIC_ANALYTICS_SERVICE_URL used but not mentioned in .env.example or docs.
**Impact:** Developers don't know to configure this; analytics features silently fail.
**Fix hint:** Add to .env.example and add configuration guide.

### AA-ANL-039 No Caching of Analytics Data
**Severity:** Medium
**File:** All analytics screens
**Category:** Performance
**Description:** Every tab/filter change triggers full API call. No client-side caching or memoization.
**Impact:** High API usage; slower navigation and battery drain.
**Fix hint:** Implement data caching with expiry (5-10 min) or use React Query.

### AA-ANL-040 Report Scheduling Not Implemented
**Severity:** Critical
**File:** All analytics screens
**Category:** Missing Feature
**Description:** No UI to schedule recurring analytics reports or email digests.
**Impact:** Admin must manually run reports daily; cannot automate.
**Fix hint:** Add report scheduler with email template, frequency (daily/weekly), and recipient list.

> **Status:** Deferred — Requires new report scheduling UI and backend job scheduler service integration.

### AA-ANL-041 Cohort Analysis Missing
**Severity:** Critical
**File:** Analytics screens
**Category:** Missing Feature
**Description:** No cohort analysis view (user cohorts by signup date, retention tracking).
**Impact:** Cannot analyze user retention or lifecycle metrics.
**Fix hint:** Create cohort-retention table showing % of users from each cohort still active.

> **Status:** Deferred — Requires new cohort analysis UI screen and backend cohort calculation service.

### AA-ANL-042 KPI Definitions Not Customizable
**Severity:** Medium
**File:** All analytics screens
**Category:** Missing Feature
**Description:** KPI metrics (GMV, conversion, etc.) hard-coded; admin cannot define custom KPIs.
**Impact:** Cannot track business-specific metrics (e.g., "trials per merchant").
**Fix hint:** Add KPI builder allowing admins to define formulas and visualizations.

### AA-ANL-043 No Alerts/Anomaly Detection
**Severity:** Medium
**File:** All analytics screens
**Category:** Missing Feature
**Description:** No system to alert admin when metric drops significantly or behaves anomalously.
**Impact:** Admin doesn't notice issues until manually checking; lost revenue opportunity.
**Fix hint:** Implement threshold-based alerts (e.g., "GMV dropped >30%" → send alert).

### AA-ANL-044 No Data Export Formats Beyond CSV
**Severity:** Low
**File:** Revenue report only
**Category:** Missing Feature
**Description:** Only CSV export; no JSON, Excel, or PDF.
**Impact:** Limited integration with other tools; non-technical users struggle with CSV.
**Fix hint:** Add JSON export (for APIs) and PDF report generation.

### AA-ANL-045 Timezone Selection Not Stored
**Severity:** High
**File:** Multiple analytics screens
**Category:** Persistence
**Description:** Timezone selected per session but not saved in user preferences. Resets on app restart.
**Impact:** Admin with non-local timezone must reset preference daily.
**Fix hint:** Save timezone preference in user profile; restore on app load.

### AA-ANL-046 No Comparison Mode (Period-over-Period)
**Severity:** Medium
**File:** All analytics screens
**Category:** Missing Feature
**Description:** Cannot compare current period (e.g., Jan) with previous period (Dec) side-by-side.
**Impact:** Admin manually exports two reports to compare; inefficient.
**Fix hint:** Add "Compare with previous period" toggle; show delta metrics.

### AA-ANL-047 Analytics Data Not Validated Against Schema
**Severity:** Medium
**File:** `/rezadmin/services/api/` analytics calls
**Category:** Data Validation
**Description:** API responses not validated against interface schema. Backend could return malformed data.
**Impact:** Runtime errors if API response structure changes.
**Fix hint:** Use runtime validation library (zod, yup) to validate responses.

### AA-ANL-048 No Real-Time Analytics Updates
**Severity:** Medium
**File:** All analytics screens
**Category:** Missing Feature
**Description:** Data refreshed on pull-to-refresh only; no WebSocket or polling for real-time updates.
**Impact:** Analytics always 5+ minutes behind; not suitable for real-time decision making.
**Fix hint:** Implement WebSocket connection or set up 30-second auto-refresh.

### AA-ANL-049 Report Names Not User-Customizable
**Severity:** Low
**File:** Analytics screens
**Category:** Missing Feature
**Description:** Reports generated with fixed names (e.g., "Revenue Report") with no way to save custom report names.
**Impact:** Admin creates 10 similar reports and cannot distinguish them.
**Fix hint:** Add "Save as custom report" dialog allowing custom name and description.

### AA-ANL-050 Analytics Permission Scoping Not Enforced
**Severity:** Critical
**File:** `/rezadmin/app/(dashboard)/analytics-dashboard.tsx` (line 176)
**Category:** Security
**Description:** Only checks hasRole(ADMIN_ROLES.ADMIN). Should allow finance/analyst roles to view reports. No row-level filtering (merchant A cannot see merchant B data).
**Impact:** Non-admins cannot access analytics. Admins see all merchants' data even if they should only manage subset.
**Fix hint:** Add granular role checks; implement data filtering per user's merchant scope.

> **Status:** Partially Fixed in commit TBD (2026-04-15)
> **Notes:** Extended role check to include FINANCE_ADMIN and ANALYST roles (line 176-179). Row-level data filtering per user scope is deferred as it requires backend changes to return user-scoped data.
