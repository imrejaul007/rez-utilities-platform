# REZ Admin App — LOW Gaps (Gen 10)

**Count:** 8 LOW issues
**App:** `rez-app-admin/` + backend services
**Date:** 2026-04-16

---

## A10-L1 — 677 `__DEV__` Console Statements in Shipped Bundle

**Files:** All 86 `services/api/*.ts`
**Severity:** LOW
**Category:** Security / Info Leakage

**Finding:**
While `__DEV__` guards prevent execution in production, the code text (including string interpolation with sensitive data) remains in the production JS bundle.

**Impact:** Bundle size bloat. Potential information leakage through code inspection.

**Status:** LOW

---

## A10-L2 — Login Error Uses showAlert Instead of Inline Display

**File:** `app/(auth)/login.tsx:47`
**Severity:** LOW
**Category:** UX

**Finding:**
Error shown via native alert dialog instead of inline message below the form.

**Impact:** Alert dismisses and error context is lost.

**Status:** LOW

---

## A10-L3 — Modal Closes Before API Confirms Success

**File:** `app/(dashboard)/orders.tsx:217`
**Severity:** LOW
**Category:** UX

**Finding:**
`setShowStatusModal(false)` is called before `await ordersService.updateOrderStatus()` completes.

**Impact:** Modal closes immediately; if the API call fails, the error alert appears over the closed modal.

**Status:** LOW

---

## A10-L4 — ErrorBoundary.handleReset Reads Stale errorCount

**File:** `components/ErrorBoundary.tsx:84`
**Severity:** LOW
**Category:** Bug

**Finding:**
```ts
this.setState({ errorCount: this.state.errorCount + 1 }); // line 73
if (this.state.errorCount > 3) { // line 84 — reads PREVIOUS state
```

`errorCount` is read before `setState` completes. The "error repeated multiple times" warning fires one cycle late.

**Status:** LOW

---

## A10-L5 — formatNumber Called 4x Per Render Without Memoization

**File:** `app/(dashboard)/index.tsx:193-200`
**Severity:** LOW
**Category:** Performance

**Finding:**
Inline function called 4 times per render without memoization.

**Status:** LOW

---

## A10-L6 — Hardcoded 'en-IN' Locale in Merchants Screen

**File:** `app/(dashboard)/merchants.tsx:262`
**Severity:** LOW
**Category:** i18n

**Finding:**
```ts
new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
```

Should use device locale. Admin in a non-Indian locale sees Indian formatting.

**Status:** LOW

---

## A10-L7 — useRefreshOnFocus Hook Has Anti-Pattern (Unused)

**File:** `hooks/useRefreshOnFocus.ts:4-9`
**Severity:** LOW
**Category:** Code Quality

**Finding:**
Hook exists but is not imported anywhere. If used, the missing dependency array causes infinite effect loop.

**Impact:** Dead code that would cause bugs if imported.

**Status:** LOW

---

## A10-L8 — Offline Auth Bypass Window (5 Minutes)

**File:** `contexts/AuthContext.tsx:242-254`
**Severity:** LOW
**Category:** Security

**Finding:**
Revoked tokens continue operating offline for up to 5 minutes.

**Impact:** Minimal in practice (admin network is typically reliable).

**Status:** LOW — accepted risk
