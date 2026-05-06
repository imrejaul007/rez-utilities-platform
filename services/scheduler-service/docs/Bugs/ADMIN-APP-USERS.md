# Admin App - User Management Bugs

## Bug Report Format
**ID** | **Severity** | **File** | **Category** | **Description** | **Impact** | **Fix Hint**

---

### AA-USR-001 No Confirmation Before Admin User Deactivation
**Severity:** CRITICAL
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 151-178)
**Category:** Destructive Action
**Description:** The `handleToggleActive` function deactivates admins only for the "is active" path, but when reactivating (lines 166-177), it calls `updateAdmin` without explicit confirmation for state-changing operations on line 167.
**Impact:** Admin accounts can be reactivated without confirmation dialog, bypassing audit controls. Open tickets are not tracked for reactivation.
**Fix Hint:** Add `showConfirm()` before reactivation on line 167; mirror the deactivation confirmation pattern.

> **Status:** Fixed in commit f88c5a6 (2026-04-15)
> **Notes:** Added showConfirm dialog for reactivation path to match deactivation pattern and ensure all state changes require explicit confirmation.

---

### AA-USR-002 Missing Audit Trail for Admin User Creation
**Severity:** HIGH
**File:** `/rezadmin/services/api/adminUsers.ts` (lines 43-51)
**Category:** Audit Trail
**Description:** The `createAdmin()` service method sends a POST request with plaintext password to the backend. No audit logging occurs in the frontend, and no confirmation of who created the admin is captured.
**Impact:** Unauthorized admin accounts can be created without audit trail. Password exposure during transmission not confirmed.
**Fix Hint:** Log admin creation with timestamp and current user ID before/after service call. Add `showConfirm()` with admin details before creation in UI.

> **Status:** Deferred — Backend audit logging + Frontend confirmation UI required
> **Reason:** Admin creation audit requires: (1) frontend confirmation dialog showing admin details before creation, (2) backend to log creation events with creator admin ID, timestamp, (3) expose `/admin/admin-users/audit-log` endpoint. Implement: add confirmation dialog, backend must log to audit table.

---

### AA-USR-003 Password Field Not Masked in Create Admin Modal
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 380-396)
**Category:** Security
**Description:** Password input has `secureTextEntry` property set on line 394, which masks input correctly. However, no password strength indicator or complexity validation beyond 8-character minimum is enforced.
**Impact:** Weak passwords accepted. New admin users could be created with easily guessable credentials.
**Fix Hint:** Add real-time password strength feedback (uppercase, numbers, symbols required). Display validation error immediately in UI.

---

### AA-USR-004 No Permission Check for Admin User Modification
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 131-149)
**Category:** RBAC
**Description:** The `handleEdit()` function calls `adminUsersService.updateAdmin()` without verifying the current user has permission to modify other admins. Only the initial screen (line 569) checks for SUPER_ADMIN role.
**Impact:** Compromised admin account can modify other admins if they reach the edit modal. Role escalation possible.
**Fix Hint:** Add `hasRole(ADMIN_ROLES.SUPER_ADMIN)` check inside `handleEdit()` before API call.

> **Status:** Deferred — Frontend RBAC check + Backend authorization required
> **Reason:** Permission checks require: (1) frontend to check user role before calling updateAdmin, (2) backend to re-validate authorization on update endpoint. Frontend: add `if (!hasRole('SUPER_ADMIN')) throw new Error(...)` before API call. Backend must also enforce permissions.

---

### AA-USR-005 Admin Email Uniqueness Not Validated on Frontend
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 91-101)
**Category:** Validation
**Description:** Email validation only checks format (line 94), not uniqueness. Backend may reject duplicate emails, but no frontend check prevents submission of duplicate email.
**Impact:** Users can fill form with duplicate email and hit API error after network round-trip instead of immediate feedback.
**Fix Hint:** Query backend for email availability before submission, or display error message from API response.

---

### AA-USR-006 No Confirmation When Editing Admin Details
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 131-149)
**Category:** Destructive Action
**Description:** Editing admin email, phone, or name triggers direct API call without confirmation dialog.
**Impact:** Accidental modifications to admin contact info without review or audit confirmation.
**Fix Hint:** Add `showConfirm()` with a summary of changes before calling `handleEdit()` on line 135.

---

### AA-USR-007 Inactive Admin List Not Paginated
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 66-77)
**Category:** Performance/UX
**Description:** The `loadAdmins()` function fetches all admin users without pagination. No `limit` or `page` parameters passed to `adminUsersService.listAdmins()`.
**Impact:** N+1 issue if admins list grows. Slow page load with 100+ admins.
**Fix Hint:** Modify `listAdmins()` to accept `page` and `limit` parameters. Implement infinite scroll in FlatList.

---

### AA-USR-008 Missing Last Login Audit for Admin Users
**Severity:** MEDIUM
**File:** `/rezadmin/services/api/adminUsers.ts` (lines 35-41)
**Category:** Audit Trail
**Description:** The `AdminUserProfile` interface includes `lastLogin` field, but no endpoint logs successful admin logins. UI displays `lastLogin` but doesn't track authentication events.
**Impact:** Cannot audit when admins last accessed the system. Inactive admins not identified reliably.
**Fix Hint:** Add login logging call to AuthContext after successful admin authentication. Update `lastLogin` on server.

---

### AA-USR-009 No Prompt Before Batch Admin Status Changes
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 656-670)
**Category:** Destructive Action
**Description:** FlatList renders all admins in a scrollable list. Each admin card has a toggle button for activation/deactivation, but selecting multiple admins for batch actions not supported. However, rapid clicking on toggle buttons can deactivate multiple admins without confirmation delay.
**Impact:** User can accidentally deactivate multiple admins by rapid clicking if modal confirmation is dismissed quickly.
**Fix Hint:** Implement debounce on toggle button (500ms) to prevent accidental rapid actions.

---

### AA-USR-010 Admin User Edit Modal Has No Validation Feedback
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 468-566)
**Category:** Validation
**Description:** Edit modal (lines 483-540) has TextInput fields with no error display, unlike create modal which shows validation errors (lines 337-396).
**Impact:** Users can submit invalid edits (empty first name, malformed email) without feedback.
**Fix Hint:** Port validation logic from `validateCreateForm()` to edit modal. Display errors below each field.

---

### AA-USR-011 Deactivated Admin Open Tickets Not Reassigned Confirmation
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 151-164)
**Category:** Data Integrity
**Description:** Line 155 states "Their open tickets will be unassigned" in confirmation text, but no API call reassigns tickets. Service method `deactivateAdmin()` only deletes/deactivates, not reassign.
**Impact:** Tickets remain orphaned when admin is deactivated. Support queue breaks.
**Fix Hint:** Implement ticket reassignment workflow in backend endpoint `/admin/admin-users/{id}/deactivate` that reassigns tickets before deactivation.

> **Status:** Deferred — Backend ticket reassignment required
> **Reason:** Ticket reassignment requires backend to: (1) find all open tickets assigned to admin, (2) reassign to default queue or another admin, (3) ensure no tickets are orphaned. Backend must implement in `/admin/admin-users/{id}/deactivate` endpoint with transaction to atomically deactivate + reassign tickets.

---

### AA-USR-012 No Role Change Validation in Admin Update
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 55-65)
**Category:** RBAC
**Description:** Edit form only displays email, phone, first/last name. Role cannot be changed in UI, but `adminUsersService.updateAdmin()` accepts role in payload if sent. Possible privilege escalation if API is called directly.
**Impact:** Direct API calls could promote SUPPORT admins to SUPER_ADMIN, bypassing frontend restriction.
**Fix Hint:** Add role selection in edit modal but enforce SUPER_ADMIN-only permission check on backend. Log role changes separately.

> **Status:** Deferred — Frontend UI + Backend authorization required
> **Reason:** Role changes require: (1) frontend to restrict role edit UI to SUPER_ADMIN only, (2) backend to reject role changes unless from SUPER_ADMIN, (3) backend to audit role changes separately. Implement: (1) add role selector in edit form with permission check, (2) backend must validate role change permission, (3) log to audit table.

---

### AA-USR-013 No Expiration or Timeout for New Admin Temporary Password
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 103-129)
**Category:** Security
**Description:** Admin user creation returns a temporary password (line 109). No indication of expiration or instruction to user. Password not logged for audit trail.
**Impact:** Temporary password could be exposed in logs, Slack, email. No way to revoke if intercepted.
**Fix Hint:** Implement backend token-based invite system instead of plaintext temporary password. Add 24-hour expiration.

---

### AA-USR-014 Admins List Doesn't Auto-Refresh After Modifications
**Severity:** LOW
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 66-77, 120, 140, 161, 170)
**Category:** UX/Sync
**Description:** After create, edit, or deactivate operations, `loadAdmins()` is called. However, if multiple users edit same admin concurrently, local state may diverge from server.
**Impact:** Stale data shown if another admin modifies same user elsewhere.
**Fix Hint:** Add a sync interval (`setInterval(loadAdmins, 30000)`) or WebSocket listener for admin updates.

---

### AA-USR-015 No Admin User Deletion (Soft Delete Check)
**Severity:** MEDIUM
**File:** `/rezadmin/services/api/adminUsers.ts` (lines 65-70)
**Category:** Data Management
**Description:** The `deactivateAdmin()` method uses HTTP `DELETE` method (line 66). Unclear if this soft-deletes (sets `isActive: false`) or hard-deletes the admin record.
**Impact:** If hard-deleted, audit trail for actions by that admin is lost. Compliance issue.
**Fix Hint:** Verify backend uses soft-delete. Rename method to `deactivateAdmin()` and use POST instead of DELETE. Add `deletedAt` timestamp.

---

### AA-USR-016 Missing Assigned Tickets Display on Admin Row
**Severity:** LOW
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 200-306)
**Category:** UX
**Description:** Admin card displays `assignedTickets` (line 250) but doesn't highlight if admin has high ticket load. No link to view tickets.
**Impact:** Support load imbalance not visible. Difficult to identify over-burdened admins.
**Fix Hint:** Add color-coded badge for ticket count (red if >20, yellow if >10). Link to filtered ticket view for that admin.

---

### AA-USR-017 Phone Number Format Not Validated
**Severity:** LOW
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 398-414)
**Category:** Validation
**Description:** Phone number field (line 413) has `keyboardType="phone-pad"` but no regex validation for format (10-digit, +91 prefix, etc.).
**Impact:** Invalid phone numbers stored (e.g., "abc", "12", symbols). Notification systems fail silently.
**Fix Hint:** Add regex validation: `^[+]?[0-9]{10,}$` for international formats. Show error if invalid.

---

### AA-USR-018 First Name / Last Name Required But Not Enforced on Edit
**Severity:** LOW
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 482-540)
**Category:** Validation
**Description:** Create modal enforces first/last name required (lines 97-98), but edit modal allows empty submission (no validation).
**Impact:** Admin records with null first/last names created via edit. UI shows "A" avatar if names are empty.
**Fix Hint:** Add validation in edit form before submission, reuse `validateEditForm()` logic.

---

### AA-USR-019 No Pagination for Admin List in FlatList
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 656-670)
**Category:** Performance
**Description:** FlatList renders all admins in `admins` state with no pagination. All items rendered at once.
**Impact:** Slow rendering if 500+ admins. Memory leak risk.
**Fix Hint:** Implement `onEndReached` callback on FlatList to load next page. Limit initial load to 20 items.

---

### AA-USR-020 Missing Audit Log Export for Admin Actions
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx`
**Category:** Audit Trail
**Description:** No endpoint or UI to export/view audit log of who created, modified, or deactivated admin users. No audit trail visible in UI.
**Impact:** Compliance violation (SOC2, GDPR). Cannot investigate unauthorized admin modifications.
**Fix Hint:** Add an "Audit Log" tab in admin-users screen. Query `GET /admin/admin-users/audit-log` with filters for date range, action type, admin ID.

> **Status:** Deferred — Backend audit endpoint + Frontend audit log UI required
> **Reason:** Audit log viewing requires: (1) backend to track all admin user changes (create, update, deactivate), (2) expose `/admin/admin-users/audit-log?dateFrom=...&dateTo=...` endpoint, (3) frontend to display audit log tab with filters. Backend must: (1) log all admin changes with actor ID, timestamp, action, (2) return paginated audit logs.

---

### AA-USR-021 Active Tab Summary Counts Not Refreshed After Action
**Severity:** LOW
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 621-654)
**Category:** UX
**Description:** Summary cards showing "Total", "Active", "Inactive" counts are calculated from `admins` state (lines 639, 650). After toggle action completes, summary updates only after `loadAdmins()` refetch.
**Impact:** Summary shows stale counts for 1-2 seconds after user action. Confusing UX.
**Fix Hint:** Optimistically update `admins` state after toggle, then refetch to confirm. Calculate summaries from local state immediately.

---

### AA-USR-022 No Role Display in Admin List Cards
**Severity:** MEDIUM
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 200-306)
**Category:** UX
**Description:** Admin card shows name, email, phone, status, but not the admin's role (SUPER_ADMIN, ADMIN, SUPPORT). Cannot see who has what permissions at a glance.
**Impact:** Cannot audit role distribution. Difficult to identify privilege escalation.
**Fix Hint:** Add role display in admin card header near status badge. Use color-coded role badges (red for SUPER_ADMIN, blue for ADMIN, gray for SUPPORT).

---

### AA-USR-023 Create Admin Modal Doesn't Clear After Success
**Severity:** LOW
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx` (lines 103-129)
**Category:** UX
**Description:** After successful creation (line 110), the form is cleared (lines 111-119), but the modal stays visible if user dismisses alert. They might re-submit if they click "Create Admin" again without closing modal.
**Impact:** Accidental duplicate admin creation if user clicks button twice.
**Fix Hint:** After success alert, immediately close modal: `setShowCreateModal(false)` on line 110. Show success badge in list to confirm creation.

---

### AA-USR-024 No Support Impersonation Audit Log
**Severity:** CRITICAL
**File:** `/rezadmin/services/api/adminUsers.ts`
**Category:** Audit Trail
**Description:** No support impersonation endpoint visible in adminUsers service. No audit trail for when support staff impersonates users.
**Impact:** Support team can impersonate users without audit trail. Compliance/security violation.
**Fix Hint:** Add endpoint `POST /admin/users/{userId}/impersonate` that logs impersonation event with timestamp, admin ID, reason. Return user session token with 1-hour expiration.

---

### AA-USR-025 Missing KYC Review Workflow
**Severity:** HIGH
**File:** `/rezadmin/app/(dashboard)/admin-users.tsx`
**Category:** Workflow
**Description:** No KYC review interface visible in user management screen. KYC status and documents not shown.
**Impact:** Admin cannot approve/reject user KYC from admin panel. Manual process required.
**Fix Hint:** Add KYC section to user detail view. Implement KYC endpoints: `GET /admin/users/{userId}/kyc-status`, `POST /admin/users/{userId}/kyc-approve`, `POST /admin/users/{userId}/kyc-reject`.

> **Status:** Deferred — Frontend KYC UI + Backend endpoints required
> **Reason:** KYC review requires: (1) frontend to add KYC tab in user detail modal, (2) backend endpoints to fetch KYC status and documents, (3) approve/reject endpoints. Backend must: (1) expose `/admin/users/{id}/kyc-status` to get documents and status, (2) implement `/admin/users/{id}/kyc-approve` and `/reject` endpoints with admin audit logging.

---

