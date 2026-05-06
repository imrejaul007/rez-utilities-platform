# STAYOWN ROUND 2 AUDIT — INDEX

**Audit Date:** 2026-04-17
**Scope:** 8 codebases — fresh code audit (rez-app-consumer, rendez-app, rez-app-admin, rez-backend, rez-karma-service, rez-wallet-service, rez-finance-service, rez-notification-events)

---

## Summary

| Severity | Count | Files |
|----------|-------|-------|
| CRITICAL | 5 | 01-CRITICAL.md |
| HIGH | 11 | 02-HIGH.md |
| MEDIUM | 18 | 03-MEDIUM.md |
| LOW | 10 | 04-LOW.md |
| **TOTAL** | **44** | |

---

## Key Findings

### CRITICAL
- **R2-C1:** `Math.random()` fallback for 2FA backup codes (security — account takeover risk)
- **R2-C2:** `Math.random()` fallback for wishlist item IDs (security — collision)
- **R2-C3:** `Math.random()` fallback for reward popup IDs (functional — dedup bypass)
- **R2-C4:** `JSON.parse` without try-catch on Redis (finance service — crash)
- **R2-C5:** `JSON.parse` without try-catch on Redis (wallet service — crash)

### HIGH
- **R2-H1:** Empty catch on `Share.share()` — silent sharing failure
- **R2-H2:** `parseInt` without radix — 2 instances in guessprice game
- **R2-H3:** Silent analytics failure — `payment-success.tsx`
- **R2-H4:** Silent analytics failure — `booking.tsx`
- **R2-H5:** Token response not validated — sends `Bearer undefined`
- **R2-H6:** Phone `+91` double-prefix — sends `+91+919876543210`
- **R2-H7:** Guest confirmation dot logic wrong — wrong business logic
- **R2-H8:** `setTimeout` never cleared — ChatScreen memory leak
- **R2-H9:** Unbatched `markRead` — race condition, 10 calls on rapid messages
- **R2-H10:** `FlatList.scrollToIndex` silently fails — OnboardingScreen
- **R2-H11:** Unsafe `as unknown as Blob` cast — photo upload silent failure

### CLEAN
- `rez-notification-events/` — No issues found. Well-structured with Zod schemas and proper error handling.
- `rez-karma-service/` — No new issues. Only acceptable `Math.random()` for retry jitter.

---

## Status Summary Table

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| R2-C1 | CRITICAL | Math.random() fallback for 2FA backup codes | ACTIVE |
| R2-C2 | CRITICAL | Math.random() fallback for wishlist item IDs | ACTIVE |
| R2-C3 | CRITICAL | Math.random() fallback for reward popup IDs | ACTIVE |
| R2-C4 | CRITICAL | JSON.parse no try-catch on Redis (finance) | ACTIVE |
| R2-C5 | CRITICAL | JSON.parse no try-catch on Redis (wallet) | ACTIVE |
| R2-H1 | HIGH | Empty catch on Share.share() | ACTIVE |
| R2-H2 | HIGH | parseInt without radix (2x) | ACTIVE |
| R2-H3 | HIGH | Silent analytics failure (payment-success) | ACTIVE |
| R2-H4 | HIGH | Silent analytics failure (booking) | ACTIVE |
| R2-H5 | HIGH | Token response not validated | ACTIVE |
| R2-H6 | HIGH | Phone +91 double-prefix risk | ACTIVE |
| R2-H7 | HIGH | Guest confirmation dot logic wrong | ACTIVE |
| R2-H8 | HIGH | setTimeout never cleared (ChatScreen) | ACTIVE |
| R2-H9 | HIGH | Unbatched markRead race condition | ACTIVE |
| R2-H10 | HIGH | FlatList.scrollToIndex silently fails | ACTIVE |
| R2-H11 | HIGH | Unsafe Blob cast in photo upload | ACTIVE |
| R2-M1 | MEDIUM | Invalid Date crash in plan creation | ACTIVE |
| R2-M2 | MEDIUM | Non-null assertion on selectedMerchant | ACTIVE |
| R2-M3 | MEDIUM | Overly permissive object type in all API methods | ACTIVE |
| R2-M4 | MEDIUM | isExpired fails on null valid_until | ACTIVE |
| R2-M5 | MEDIUM | Unsafe profile cast in ChatScreen | ACTIVE |
| R2-M6 | MEDIUM | Unsafe profile cast in MatchesScreen (x2) | ACTIVE |
| R2-M7 | MEDIUM | console.warn FCM no __DEV__ guard | ACTIVE |
| R2-M8 | MEDIUM | console.warn WS no __DEV__ guard | ACTIVE |
| R2-M9 | MEDIUM | Empty catch around haptic feedback | ACTIVE |
| R2-M10 | MEDIUM | JSON.parse no try-catch at init (wallet) | ACTIVE |
| R2-M11 | MEDIUM | JSON.parse no try-catch at init (finance) | ACTIVE |
| R2-M12 | MEDIUM | Empty catch around attribution write | ACTIVE |
| R2-M13 | MEDIUM | Empty catch around app settings load | ACTIVE |
| R2-M14 | MEDIUM | Math.random() fallback in WishlistContext | ACTIVE |
| R2-M15 | MEDIUM | NaN risk from parseInt on user input | ACTIVE |
| R2-M16 | MEDIUM | photos.length no null guard (ProfileScreen) | ACTIVE |
| R2-M17 | MEDIUM | photos.length no null guard (ProfileDetail) | ACTIVE |
| R2-M18 | MEDIUM | NaN guard missing on division (customerInsights) | ACTIVE |
| R2-L1 | LOW | Double-nested catch pattern | ACTIVE |
| R2-L2 | LOW | Math.random() for retry jitter | ACTIVE |
| R2-L3 | LOW | Math.random() for cashback fallback % | ACTIVE |
| R2-L4 | LOW | Privacy/terms links not implemented | ACTIVE |
| R2-L5 | LOW | Hardcoded version number | ACTIVE |
| R2-L6 | LOW | Sprint comments scattered | ACTIVE |
| R2-L7 | LOW | Hardcoded coin amounts | ACTIVE |
| R2-L8 | LOW | Hardcoded prompt strings | ACTIVE |
| R2-L9 | LOW | unreadCount unbounded | ACTIVE |
| R2-L10 | LOW | Error field inconsistency (error vs message) | ACTIVE |
