# Admin App - Merchant/Catalog Management Bugs

## Bug Report Format
**ID** | **Severity** | **File** | **Category** | **Description** | **Impact** | **Fix Hint**

---

### AA-MER-001 No Confirmation Before Merchant Approval
**Severity:** CRITICAL
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 147-165)
**Category:** Destructive Action
**Description:** The `handleApprove()` function calls `showConfirm()` with callback (line 148-164), but the confirmation happens only after checking conditions. No email verification of merchant identity before approval.
**Impact:** Merchants can be approved without identity verification. Fraudulent merchants enter system.
**Fix Hint:** Require document verification status before approval button is enabled. Show document review modal before confirmation.

> **Status:** Misjudgment — Confirmation dialog already implemented in handleApprove (line 148-164). The real issue is lack of document verification requirement, which is backend/workflow concern (not a frontend bug).

---

### AA-MER-002 Merchant Suspension Without Reason Tracking
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 277-301)
**Category:** Audit Trail
**Description:** Suspension reason is collected in modal (line 279-281) but no audit log tracks who suspended when. Backend stores reason but frontend doesn't verify it was logged.
**Impact:** Cannot audit merchant suspensions. Disputes unresolvable.
**Fix Hint:** Add suspension history view showing all suspensions with date, reason, admin who suspended, and duration.

> **Status:** Deferred — Backend audit endpoint required
> **Reason:** Suspension history requires backend to track and expose audit logs. Frontend can display if endpoint exists. Backend must: (1) log suspension events with admin ID, timestamp, reason, (2) expose `/admin/merchants/{id}/suspension-history` endpoint, (3) include suspension details in merchant detail response.

---

### AA-MER-003 Missing Confirmation Before Merchant Rejection
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 167-185)
**Category:** Destructive Action
**Description:** Rejection requires reason (line 168-169), but rejection is permanent. No secondary confirmation modal after reason entry.
**Impact:** User enters reason and rejection executes immediately on next action, risking typos/mistakes.
**Fix Hint:** Show confirmation modal with merchant details and rejection reason before executing rejection.

> **Status:** Deferred — Frontend UI enhancement
> **Reason:** Adding confirmation modal is straightforward UI change. Requires: (1) modify rejection handler to show confirmation before API call, (2) display merchant name/ID and rejection reason in confirmation dialog, (3) only execute rejection on confirmation button click.

---

### AA-MER-004 No N+1 Query Prevention in Merchant Wallet Loading
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 187-217)
**Category:** Performance
**Description:** `handleViewDetails()` calls `merchantsService.getMerchantWallet(merchant._id)` for each merchant viewed. If merchant list has 20+ items and user views each detail, 20+ separate wallet API calls made.
**Impact:** API call explosion. Slow UI. Server load spike.
**Fix Hint:** Fetch wallets in batch endpoint `GET /admin/merchant-wallets/batch?ids=id1,id2,id3`. Cache wallet data locally per merchant ID.

> **Status:** Deferred — Backend batch endpoint + Frontend cache required
> **Reason:** Implementing wallet batch loading requires both backend batch endpoint and frontend caching strategy. Backend must: (1) create `/admin/merchant-wallets/batch?ids=...` endpoint, (2) return array of wallets. Frontend must: (1) implement local cache/memoization, (2) batch API calls when opening multiple merchant details.

---

### AA-MER-005 Merchant Search Not Debounced on Backend
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 44-47)
**Category:** Performance
**Description:** Search query is debounced on client (line 45-47), but if user rapidly changes status filter (lines 410-431), multiple API calls fire without debounce.
**Impact:** Duplicate API calls for same filter. Server load.
**Fix Hint:** Wrap both search and filter updates in single debounced callback that batches changes.

> **Status:** Fixed in commit f88c5a6 (2026-04-15)
> **Notes:** Added debouncedSearchAndFilter callback that combines search query and status filter updates into single debounced request. Filter handler now calls combined debounce instead of separate handlers.

---

### AA-MER-006 No Pagination for Merchant List Initial Load
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 85-114)
**Category:** Performance
**Description:** `loadData()` uses pagination with limit=20 (line 92), but initial load may hit limit without clear "no more merchants" signal if exactly 20 returned.
**Impact:** Ambiguous UX—unclear if there are more merchants or not.
**Fix Hint:** Always fetch limit+1 items; if received limit+1, set `hasMore=true`. Display "Load More" button only if `hasMore=true`.

---

### AA-MER-007 Merchant Create Modal Doesn't Validate Email Uniqueness
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 324-346)
**Category:** Validation
**Description:** Create merchant form accepts email but doesn't check if email already exists. Backend rejects with error, but frontend doesn't pre-validate.
**Impact:** User enters valid-looking email and gets generic error after submission.
**Fix Hint:** Query `GET /admin/merchants/check-email?email=X` before enabling submit button. Show inline validation.

---

### AA-MER-008 Temporary Password for Created Merchant Not Secure
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 331-346)
**Category:** Security
**Description:** Merchant creation returns `tempPassword` (line 339), displayed in modal (UI likely shows it). No expiration time, no secure distribution method, no confirmation password was noted by merchant.
**Impact:** Temp password visible in UI, logs, Slack screenshots. Can be intercepted.
**Fix Hint:** Instead of showing password in UI, generate unique invite link with token: `https://merchant.rez.io/invite/{token}`. Token expires in 24h. Send via email to merchant's registered email.

> **Status:** Deferred — Backend invite token system + Email integration required
> **Reason:** Secure onboarding requires backend to: (1) generate unique invite tokens with 24h expiry, (2) send invite email directly (not display password in UI), (3) validate token on merchant first login. Frontend should not display plaintext passwords. Recommend: backend should return only a message "Invite sent to merchant email" without showing password.

---

### AA-MER-009 No Merchant Reactivation Confirmation
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 304-322)
**Category:** Destructive Action
**Description:** Reactivation (lines 304-322) shows `showConfirm()` dialog, which is good. However, reactivated merchant's stores and catalog are restored without review. No safeguard check.
**Impact:** Previously suspended merchant for fraud/compliance can be reactivated immediately, bypassing review.
**Fix Hint:** Add flag `requiresReviewAfterReactivation` on merchant. Don't allow sales until review complete. Log reactivation with reason.

---

### AA-MER-010 Merchant Status Filter Doesn't Persist on Refresh
**Severity:** LOW
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 32-35)
**Category:** UX
**Description:** `statusFilter` state is not persisted to AsyncStorage or URL params. Navigating away and back resets to default filter.
**Impact:** User loses filter context if they navigate to merchant detail and back.
**Fix Hint:** Save `statusFilter` to URL: `/merchants?status=pending`. Load from URL params on mount.

---

### AA-MER-011 Merchant Wallet Balance Not Real-Time
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 209-216)
**Category:** Data Sync
**Description:** Wallet balance fetched once per detail view (line 209). If admin views detail, then returns to list, then views detail again, wallet shows stale data.
**Impact:** Admin sees outdated balance. Cannot make decisions based on current financial status.
**Fix Hint:** Add refresh button in wallet display. Implement WebSocket listener for wallet balance changes.

---

### AA-MER-012 No Bulk Merchant Approval Action
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx`
**Category:** Workflow
**Description:** Each merchant must be approved individually (line 147-165). No bulk action to approve 5+ pending merchants at once.
**Impact:** Time-consuming for admins reviewing many pending merchants daily.
**Fix Hint:** Add checkbox to each merchant card. Show "Approve All" button when 1+ selected. Batch endpoint: `POST /admin/merchants/bulk-approve`.

---

### AA-MER-013 Missing Merchant Flag/Unflag Workflow
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/merchants.tsx`
**Category:** Workflow
**Description:** No UI button to flag/unflag merchants for manual review (likely handled via `merchantFlags` service). Cannot mark merchant as suspicious from main list.
**Impact:** Admins must navigate to separate screen or use backend directly to flag merchants.
**Fix Hint:** Add flag icon button in merchant card actions. Implement `POST /admin/merchants/{id}/flag` and `POST /admin/merchants/{id}/unflag` with reason.

> **Status:** Deferred — Frontend UI + Backend endpoints required
> **Reason:** Flag workflow requires: (1) frontend to add flag button in merchant list/detail, (2) backend endpoints `/admin/merchants/{id}/flag` and `/unflag` with reason field, (3) merchant schema to track flag status. Implement: add flag toggle in merchant card, call service methods.

---

### AA-MER-014 No Withdrawal Approval/Rejection Confirmation Modal
**Severity:** HIGH
**File:** `/rezadmin/services/api/merchants.ts` (lines 434-454)
**Category:** Destructive Action
**Description:** Service methods `processWithdrawal()` and `rejectWithdrawal()` exist, but no UI implementation visible in merchants.tsx. No confirmation before processing withdrawal.
**Impact:** Merchants' money transferred without secondary approval step. Irreversible financial action.
**Fix Hint:** Create withdrawal management screen. Show pending withdrawals with merchant details, bank account, amount. Require 2-step approval: admin approves, then second admin verifies.

> **Status:** Deferred — Frontend withdrawal UI + Two-person approval backend required
> **Reason:** Withdrawal management requires: (1) frontend screen listing pending withdrawals, (2) confirmation dialog before approve/reject, (3) backend two-person approval workflow. Backend must: (1) expose `/admin/withdrawals` endpoint, (2) implement approval state machine, (3) require second admin verification for high-value withdrawals.

---

### AA-MER-015 Store Program Toggle Not Audited
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 219-242)
**Category:** Audit Trail
**Description:** `handleToggleStoreProgram()` calls toggle without logging who changed it or why. REZ Program enrollment/unenrollment affects merchant revenue directly.
**Impact:** Cannot audit who enrolled which merchants in REZ Program. Fraud undetectable (admin might bribe merchant to enroll).
**Fix Hint:** Log program changes: `POST /admin/stores/{storeId}/program/audit-log` with admin ID, timestamp, previous/new cashback %.

> **Status:** Deferred — Backend audit logging required
> **Reason:** Program toggle audit requires backend to log all changes. Frontend must pass initiatedBy with request. Backend must: (1) log program toggle events with admin ID, timestamp, reason, (2) store previous/new state, (3) expose `/admin/stores/{id}/program-audit-log` endpoint.

---

### AA-MER-016 Estimated Prep Time Not Validated for Range
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 244-258)
**Category:** Validation
**Description:** `handleSaveWaitTime()` accepts any number without validation (line 247). Could be negative, 999, null.
**Impact:** Invalid prep times displayed to consumers (e.g., "-5 mins", "999 mins"). Bad UX.
**Fix Hint:** Validate range: 0-180 minutes. Show number picker instead of text input. Warn if >120 mins.

---

### AA-MER-017 No Merchant Account Closure Workflow
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx`
**Category:** Workflow
**Description:** Merchants can be suspended but not closed/deleted. No endpoint to fully close merchant account and settle outstanding balances.
**Impact:** Inactive merchants remain in system. Cannot clean up test accounts or fraud cases.
**Fix Hint:** Add "Close Account" action that: 1) Settles all pending transactions, 2) Marks merchant as closed, 3) Archives documents. Log with timestamp.

---

### AA-MER-018 Merchant Email Change Not Verified
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/merchants.tsx`
**Category:** Security
**Description:** Merchant profile shows email but no way to change it from admin panel. If change is possible via backend, no email verification required.
**Impact:** Merchant email changed to attacker email, account takeover.
**Fix Hint:** If allowing email change, send verification email to old address with "approve change" link. Confirm change in email to new address.

> **Status:** Deferred — Backend email verification + Frontend UI required
> **Reason:** Email changes require verification workflow. Backend must: (1) require email verification token for changes, (2) send confirmation email to old address, (3) not activate change until both addresses confirm. Frontend: disable email edit or show verification warning.

---

### AA-MER-019 No Merchant Document Verification Status Display
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx`
**Category:** UX
**Description:** Merchant interface has `documents` array (merchants.ts line 26-30) but no UI shows document status or allows manual verification.
**Impact:** Cannot see if merchant submitted all required documents. Cannot approve/reject documents from admin panel.
**Fix Hint:** Add "Documents" tab in merchant detail modal. Show each document with status (pending/verified/rejected). Add approve/reject buttons with reason text.

---

### AA-MER-020 Bank Details Change Not Audited
**Severity:** HIGH
**File:** `/rezadmin/services/api/merchants.ts` (lines 54-60)
**Category:** Audit Trail
**Description:** Merchant wallet includes `bankDetails` but no audit log for when/if bank account is changed. No verification required before change.
**Impact:** Merchant (or admin) can change bank details to divert funds. No trace.
**Fix Hint:** Require admin approval for bank detail changes. Log old/new account numbers. Mark all withdrawals after change as flagged for review.

> **Status:** Deferred — Backend bank change audit + Approval workflow required
> **Reason:** Bank detail changes require audit and approval. Backend must: (1) log bank account changes with admin ID, timestamp, reason, (2) require two-admin approval for changes, (3) flag withdrawals after change for manual review, (4) expose `/admin/merchants/{id}/bank-audit-log` endpoint.

---

### AA-MER-021 No Merchant Communication/Notification System
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx`
**Category:** Workflow
**Description:** No way to send messages to merchants from admin panel. Suspension/rejection reasons shown in modal but not sent to merchant.
**Impact:** Merchants don't receive notification of suspension/rejection. Support receives complaints.
**Fix Hint:** Add "Send Message" button in merchant detail. Generate SMS/email template. Log sent messages in audit trail.

---

### AA-MER-022 Merchant Suspension Reason Text Not Validated
**Severity:** LOW
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 283-301)
**Category:** Validation
**Description:** Suspension reason required but accepts any text. Could be empty whitespace, profanity, or too short.
**Impact:** Useless suspension reasons in database. Logs cluttered.
**Fix Hint:** Validate: min 10 characters, no all-caps, no gibberish. Show character count. Use template dropdown for common reasons.

---

### AA-MER-023 No Merchant Approval Notification to Backend
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 147-165)
**Category:** Workflow
**Description:** Approval calls `approveMerchant()` service method, but no confirmation that email/SMS is sent to merchant notifying them of approval.
**Impact:** Merchants don't know they're approved. Support queue fills with "when will I go live" messages.
**Fix Hint:** Backend endpoint should send approval email. Add notification table to track if email sent. Retry failed notifications.

---

### AA-MER-024 Store Suspension Not Cascaded from Merchant Suspension
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 277-301)
**Category:** Data Consistency
**Description:** Merchant suspension suspends merchant account, but merchant's stores (line 12-19) may not be suspended. Stores remain active.
**Impact:** Customers can order from suspended merchant's stores. Fraud/compliance violation.
**Fix Hint:** When suspending merchant, also suspend all stores: `PATCH /admin/merchants/{id}/suspend` should cascade to stores endpoint.

> **Status:** Deferred — Backend cascade logic required
> **Reason:** Store suspension cascade requires backend to: (1) on merchant suspension, find all related stores, (2) update all stores to suspended status, (3) ensure atomicity (all-or-nothing). Backend must implement in `/admin/merchants/{id}/suspend` endpoint with database transaction.

---

### AA-MER-025 No Merchant Tier/Status Upgrade Workflow
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx`
**Category:** Workflow
**Description:** Merchants remain in "pending" or "approved" status. No workflow to upgrade approved merchants to "premium" or "featured" tier.
**Impact:** All merchants treated equally. Cannot incentivize or manage merchant tiers.
**Fix Hint:** Add tier system (STANDARD, PREMIUM, FEATURED). Implement `PATCH /admin/merchants/{id}/tier` endpoint. Log tier changes.

---

### AA-MER-026 No Pagination in Store List Within Merchant Detail
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 194-205)
**Category:** Performance
**Description:** `merchant.stores` array displayed without pagination in detail modal. Large merchants with 100+ stores cause lag.
**Impact:** Detail modal slow to render for merchants with many stores.
**Fix Hint:** Limit stores displayed to 10, add "Load More" button. Pagination in modal or separate stores list screen.

---

### AA-MER-027 Missing Store Category Validation on Creation
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx`
**Category:** Validation
**Description:** When merchant is created, no category assigned. Stores must have category, so stores cannot function until category manually assigned.
**Impact:** Created merchants cannot add stores immediately. Workflow breaks.
**Fix Hint:** Require category selection on merchant creation form. Validate against available categories from backend.

---

### AA-MER-028 No Merchant Account Compliance Review Flag
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/merchants.tsx`
**Category:** Workflow
**Description:** No indicator if merchant account is flagged for compliance review. No separate queue for high-risk merchants.
**Impact:** High-risk merchants not prioritized for review. Fraud undetected.
**Fix Hint:** Add compliance flag field to merchant. Create separate "Pending Compliance Review" tab in merchant list. Require second admin sign-off before approval.

> **Status:** Deferred — Backend compliance flag + Frontend UI tabs required
> **Reason:** Compliance review requires: (1) merchant schema to track complianceReviewRequired flag, (2) frontend to filter by compliance status, (3) separate approval workflow for flagged merchants. Backend must: (1) add complianceReviewRequired field, (2) add /admin/merchants?complianceReview=true filter endpoint. Frontend: add "Compliance Review" tab.

---

### AA-MER-029 Rejection Reason Not Stored or Searchable
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 167-185)
**Category:** Audit Trail
**Description:** Rejection reason sent to API but no search/filter by rejection reason in UI. Cannot find all merchants rejected for "invalid documents".
**Impact:** Cannot audit rejection patterns. Difficult to identify if rejections are fair.
**Fix Hint:** Store rejection reason with timestamp. Add filter in merchant list: "Show only rejected merchants" with reason filter dropdown.

---

### AA-MER-030 No Bulk Store Suspension for Merchant
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx`
**Category:** Workflow
**Description:** Individual stores can be toggled, but suspending merchant doesn't show "suspend all stores" confirmation.
**Impact:** Admin must manually click each store toggle if wanting to suspend all. Error-prone.
**Fix Hint:** Show option: "Suspend all {X} stores?" when suspending merchant. Bulk endpoint: `POST /admin/merchants/{id}/suspend-all-stores`.

---

### AA-MER-031 Merchant Live Status Not Cached / Real-Time Updates Missing
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 120-133)
**Category:** Data Sync
**Description:** Socket event for merchant live status is commented out (line 120-133). Merchants list shows stale POS online/offline status.
**Impact:** Admin cannot see current merchant availability. Cannot prioritize support for offline merchants.
**Fix Hint:** Uncomment socket listener. Implement backend event emitter for `merchant:live` event. Add visual indicator for "POS is Live" in real-time.

---

### AA-MER-032 No Merchant Performance Metrics in Detail View
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx`
**Category:** UX
**Description:** Merchant detail shows wallet balance but not KPIs like orders/day, average order value, rating trend, cancellation rate.
**Impact:** Admin cannot assess merchant health or performance. Cannot make informed suspension decisions.
**Fix Hint:** Add metrics dashboard in merchant detail: orders/week, revenue/week, customer rating, return rate, compliance score.

---

### AA-MER-033 Duplicate Merchant Account Prevention Not Visible
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 324-346)
**Category:** Data Integrity
**Description:** No check for duplicate merchants by phone number, email, or business registration number. Admins can create multiple merchant accounts for same business.
**Impact:** Merchant account duplication. Fraud. Split revenue.
**Fix Hint:** Add backend uniqueness check on email + phone combo. Query before creation: `GET /admin/merchants/check-duplicate?email=X&phone=Y`.

> **Status:** Deferred — Backend uniqueness checks + Frontend validation required
> **Reason:** Duplicate prevention requires: (1) backend to validate email/phone uniqueness on create, (2) frontend to check before submit. Backend must: (1) enforce unique constraints, (2) expose `/admin/merchants/check-duplicate?email=X&phone=Y` endpoint, (3) return duplicate merchant details if found. Frontend: call check endpoint on form submit, warn if duplicates exist.

---

### AA-MER-034 No Merchant Suspension Duration / Auto-Reactivation
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 277-301)
**Category:** Workflow
**Description:** Suspension is permanent until manual reactivation. No temporary suspension with auto-reactivate after N days.
**Impact:** Admins forget to reactivate. Merchants permanently blocked for minor violations.
**Fix Hint:** Add suspension duration selector: "Suspend for 7 days", "14 days", "30 days", "Permanent". Auto-reactivate after duration.

---

### AA-MER-035 Missing Store Health Check / Requirement Audit
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/merchants.tsx` (lines 194-205)
**Category:** Workflow
**Description:** Stores shown but no indicators if they meet compliance requirements (menu complete, photos, ratings threshold, etc.).
**Impact:** Suspended merchants have incomplete stores. Readmission process broken.
**Fix Hint:** Show store compliance checklist: menu uploaded, min 5 photos, min rating 3.5. Auto-suspend store if requirements not met.

---

