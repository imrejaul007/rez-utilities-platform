# Gaps: RENDEZ MOBILE APP

**App:** `rendez-app/` (Expo/React Native/Expo Router/Zustand/TanStack Query)
**Source:** Deep audit 2026-04-16 (Rendez monorepo)
**Total Issues:** 58 (5 CRITICAL, 11 HIGH, 32 MEDIUM, 13 LOW) — +12 from deep screen audit +4 from authStore audit

---

## Issues by Category

| Category | CRITICAL | HIGH | MEDIUM | LOW |
|----------|----------|------|--------|-----|
| Functional | 3 | 4 | 9 | 1 |
| Security | 1 | 1 | 2 | 2 |
| Data & Sync | 1 | 1 | 2 | 1 |
| API Contract | — | 1 | 4 | — |
| Business Logic | — | 2 | 5 | — |
| Real-Time | — | — | 3 | — |
| Offline / Sync | — | 1 | 2 | 2 |
| UX / Flow | — | — | 5 | 2 |
| Performance | — | — | 3 | 1 |
| Architecture | — | 1 | — | — |

---

## Files

| File | Description |
|------|-------------|
| `CRITICAL.md` | Runtime crashes, referral system broken, cache invalidation, stale closures |
| `HIGH.md` | Balance check missing, age NaN, photo deletion, wallet sync |
| `MEDIUM.md` | Socket issues, input validation, query optimization, API contract mismatches |
| `LOW.md` | Unused code, memoization, unused variables |

---

## Quick Reference

| ID | Severity | Title | Location |
|----|----------|-------|----------|
| RZ-M-F1 | CRITICAL | Gift inbox query key invalidation wrong — never refreshes | `GiftInboxScreen.tsx:48` |
| RZ-M-F3 | CRITICAL | Like mutation uses stale closure over `feed` array | `DiscoverScreen.tsx:302` |
| RZ-M-F4 | CRITICAL | Photo removal local-only — never synced to backend | `ProfileEditScreen.tsx:129` |
| RZ-M-S1 | CRITICAL | Referral code stored but never consumed | `useDeepLink.ts:130` |
| RZ-M-E1 | CRITICAL | `profile.name[0]` crashes on empty profile | `ProfileDetailScreen.tsx:191` |
| RZ-M-P1 | HIGH | No wallet balance check before sending gift | `GiftPickerScreen.tsx:45` |
| RZ-M-B1 | HIGH | `parseInt(age)` sends NaN to backend on text paste | `ProfileSetupScreen.tsx:49` |
| RZ-M-A2 | HIGH | Experience credit consumption not properly invalidated | `CreatePlanScreen.tsx:128` |
| RZ-M-X1 | HIGH | `deletePhoto` API defined but never called | `api.ts:102` |
| RZ-M-R1 | MEDIUM | Socket reconnection with no failure handler | `useRealtimeChat.ts:53` |
| RZ-M-O1 | MEDIUM | No offline queue for chat messages | `ChatScreen.tsx:103` |
