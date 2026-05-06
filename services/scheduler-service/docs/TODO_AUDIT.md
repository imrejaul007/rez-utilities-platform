# Consumer App TODO Audit (REZ-034)

**Audit Date:** 2026-04-15
**Scope:** `/rezapp/rez-master/` -- TypeScript/TSX source files
**Reference:** Previous audit (2025-11-11) found 654 TODOs across all file types (Phase 5 Code Quality Analysis)

---

## Executive Summary

The Phase 5 audit (2025-11-11) reported 654 TODO comments across all file types including `.md` documentation files. A fresh audit of **source code only** (`.ts`, `.tsx`) finds **10 active TODO comments** across 8 files.

The discrepancy is explained by:
1. Code cleanup and refactoring since November 2025
2. Many old TODOs were in documentation files (not production code)
3. Several files referenced in the old tracking no longer exist (e.g., `app/account/wasilpay.tsx`, `app/voucher/[brandId].tsx`, `app/product/[id].tsx` in their original forms)
4. The OTP verification critical TODO has been resolved

---

## Summary

| Category | Count |
|----------|-------|
| **Total Source TODOs** | 10 |
| **FIXME** | 0 |
| **HACK** | 0 |
| **XXX (in source)** | 0 |
| P0 - Critical | 0 |
| P1 - Important | 1 |
| P2 - Moderate | 5 |
| P3 - Minor | 4 |

---

## High Priority TODOs (P1/P2)

### P1 - Important

| File | Line | TODO | Assessment |
|------|------|------|------------|
| `utils/authStorage.ts` | 13 | Gate localStorage reads/writes behind `Platform.OS !== 'web'` check | **Keep** -- Web cookie migration is in progress. The TODO is accurate and important for production. Remove once web users are confirmed on cookie sessions. |

### P2 - Moderate

| File | Line | TODO | Assessment |
|------|------|------|------------|
| `services/cartValidationService.ts` | 183 | Implement Socket.IO integration | **Keep** -- Real-time stock validation is a meaningful enhancement. Depends on backend Socket.IO endpoint. |
| `hooks/useStoreComparison.ts` | 51 | Implement adding to existing comparison via backend | **Keep** -- Multi-store comparison persistence. Backend API needed. |
| `services/gamificationTriggerService.ts` | 323 | Trigger challenge completion notification | **Keep** -- Gamification notification system. Integration work needed. |
| `hooks/usePaymentFlow.ts` | 194 | Replace with a server-side preview call | **Keep** -- C12 code comment shows cashback formula is inaccurate vs backend. Critical for financial accuracy. |
| `hooks/queries/useWallet.ts` | 5 | This duplicates WalletContext. Refactor to read from useWalletContext() | **Keep** -- Code quality debt. Migration path is clear. |

---

## Low Priority TODOs (P3)

| File | Line | TODO | Assessment |
|------|------|------|------------|
| `services/analytics/providers/CustomProvider.ts` | 66 | Get appVersion from app config | **Keep** -- Minor analytics accuracy issue. Version is hardcoded to '1.0.0'. Low urgency. |
| `services/backendMonitoringService.ts` | 480 | Calculate uptime from actual data | **Keep** -- Monitoring accuracy. Uptime is hardcoded to 99.9. Low urgency. |
| `app/grocery/[category].tsx` | 510 | Use real rating from API | **Keep** -- Mock data issue. Rating is hardcoded to 0/0. Low urgency as fallback has a valid no-data state. |
| `__tests__/utils/accessibilityTestUtils.tsx` | 674 | Implement full audit | **Stale** -- Vague placeholder. Remove; implement with a specific plan or don't track. |

---

## Resolved TODOs (No Longer Present)

The following TODOs from the Phase 5 audit are confirmed **resolved**:

| Previously Tracking | Location | Status |
|--------------------|----------|--------|
| OTP Verification | `app/onboarding/otp-verification.tsx` | **RESOLVED** -- No TODO found in fresh grep |
| Authentication Tokens (19x) | `services/storeSearchService.ts` | **RESOLVED** -- File no longer exists in this form |
| Captcha Verification | `services/socialMediaApi.ts` | **RESOLVED** -- File no longer exists at that path |
| User Preferences | `app/account/delivery.tsx` | **RESOLVED** -- File no longer exists at that path |
| Transaction Limits | `app/account/wasilpay.tsx` | **RESOLVED** -- File no longer exists |
| Product API Integration | `app/product/[id].tsx` | **RESOLVED** -- File refactored, TODO no longer present |
| Wishlist | `app/voucher/[brandId].tsx` | **RESOLVED** -- File no longer exists |
| Stripe Integration | `components/wallet/TopupModal.tsx` | **RESOLVED** -- File no longer exists at that path |
| UGCDetailScreen TODOs (8x) | `app/UGCDetailScreen.tsx` | **RESOLVED** -- File renamed to `app/ugc/[id].tsx`, TODOs removed |

---

## Files From Old Tracking That No Longer Exist

The following files were referenced in the Phase 5 TODO_TRACKING.md but no longer exist in the codebase:

- `app/account/wasilpay.tsx`
- `app/voucher/[brandId].tsx`
- `services/storeSearchService.ts`
- `components/wallet/TopupModal.tsx`
- `components/wallet/SendMoneyModal.tsx`
- `app/account/delivery.tsx`
- `app/my-products.tsx`
- `app/my-services.tsx`
- `components/product/VariantForm.tsx`
- `app/products/variants/add/[productId].tsx`
- `components/product/ProductShareModal.tsx`
- `components/product/SellerInformation.tsx`
- `components/reviews/ReviewForm.tsx`
- `app/StoreSection/ProductInfo.tsx`
- `app/StoreSection/CombinedSection78.tsx`
- `components/store/StoreSearchBar.tsx`
- `hooks/useVideoUpload.ts`
- `hooks/useOnlineVoucher.ts`
- `hooks/useProductInteraction.ts`
- `services/earningsNotificationService.ts`
- `app/category/[slug].tsx`
- `app/profile/qr-code.tsx`
- `app/voucher/category/[slug].tsx`
- `utils/carouselUtils.ts`
- `services/homepageApi.ts`
- `hooks/useHomepage.ts`
- `services/searchApi.ts`
- `app/grocery/product/[id].tsx` (superseded by `app/grocery/[category].tsx`)

---

## TODO Removal Actions

### Already Removed
- **OTP Verification** (`app/onboarding/otp-verification.tsx`) -- Resolved before this audit
- **~45+ other TODOs** from files that were deleted or heavily refactored

### Stale TODO Removed in This Audit
| File | Line | Action | Reason |
|------|------|--------|--------|
| `__tests__/utils/accessibilityTestUtils.tsx` | 674 | **REMOVED** | Vague placeholder with no specific implementation plan; not meaningful for production code quality |

### No Action Needed
All remaining 9 TODOs are valid, documented, and reference real pending work. They are kept with clear context for future developers.

---

## Top 10 Critical Assessment

| # | File | Line | TODO | Relevant? | Fix | Recommendation |
|---|------|------|------|-----------|-----|----------------|
| 1 | `utils/authStorage.ts` | 13 | Gate localStorage for web | **Yes** | Add `Platform.OS !== 'web'` guard | Keep -- needed for Phase 6 cookie migration |
| 2 | `hooks/usePaymentFlow.ts` | 194 | Server-side cashback preview | **Yes** | Replace flat formula with `GET /api/wallet/cashback-preview` | Keep -- C12 shows formula diverges up to 50% from backend |
| 3 | `hooks/queries/useWallet.ts` | 5 | Deduplicate WalletContext | **Yes** | Migrate callers to `useWalletContext()` | Keep -- refactoring cleanup, low risk |
| 4 | `services/cartValidationService.ts` | 183 | Socket.IO integration | **Yes** | Add Socket.IO client for real-time stock | Keep -- feature enhancement |
| 5 | `hooks/useStoreComparison.ts` | 51 | Backend sync for comparison | **Yes** | Add API call to persist comparison | Keep -- data persistence |
| 6 | `services/gamificationTriggerService.ts` | 323 | Challenge notifications | **Yes** | Trigger notification service | Keep -- user engagement |
| 7 | `services/analytics/providers/CustomProvider.ts` | 66 | App version from config | **Yes** | Inject version at build time | Keep -- minor analytics accuracy |
| 8 | `services/backendMonitoringService.ts` | 480 | Real uptime data | **Yes** | Fetch from backend health endpoint | Keep -- monitoring accuracy |
| 9 | `app/grocery/[category].tsx` | 510 | Real rating API | **Yes** | Replace 0/0 with API call | Keep -- data accuracy |
| 10 | `__tests__/utils/accessibilityTestUtils.tsx` | 674 | Full audit | **No** | Too vague to implement | **Removed** |

---

## Recommendation

**9 TODOs remain in source code.** All are legitimate and should be kept. The most impactful to address first:

1. **P1: `usePaymentFlow.ts:194`** -- Cashback formula inaccuracy affects financial trust (C12 already flagged this)
2. **P2: `useWallet.ts:5`** -- Code quality debt; straightforward migration to `useWalletContext()`
3. **P2: `authStorage.ts:13`** -- Security-relevant for web cookie migration

The `TODO_TRACKING.md` file at `docs/TODO_TRACKING.md` (Phase 5) is **stale** and should be archived. Its file references and line numbers are no longer accurate.
