# CROSS-SERVICE GAPS — Gen 1–7 Issues Spanning Multiple Repositories

> **⚠️ DEPRECATED — Gen 1-7 cross-service issues are now archived here.**
> **For active cross-service analysis, see [../09-CROSS-SERVICE-2026/](../09-CROSS-SERVICE-2026/)** which covers Gen 8–11 plus consolidated root cause analysis.
> For the unified fix plan across ALL codebases, see [../08-MASTER-PLAN/00-INDEX.md](../08-MASTER-PLAN/00-INDEX.md).

**Date:** 2026-04-16
**Scope:** Gen 1–7 issues that exist across multiple codebases — fix once in shared location

---

## Files

| File | Description |
|------|-------------|
| `00-INDEX.md` | This file — overview |
| `API-CONTRACT-MISMATCHES.md` | Frontend expects vs backend returns across all apps |
| `ENUM-FRAGMENTATION.md` | Status string mismatches across all codebases |
| `TYPE-DRIFT.md` | Local types vs shared-types package |
| `FIRE-AND-FORGET.md` | Async calls with no retry/DLQ |
| `MONEY-ATOMICITY.md` | Payment/wallet/ledger double-credit risks |

---

## Cross-Repo Issue Summary

| # | Issue | Appears In | Fix Location |
|---|-------|-----------|--------------|
| CR-1 | TanStack Query key factories missing | Consumer, Merchant, Admin, Rendez App | `src/utils/queryKeys.ts` |
| CR-2 | No shared API client — auth headers not injected | Admin, Rendez Admin | `src/lib/apiClient.ts` |
| CR-3 | Enum validation inconsistent | Rendez Backend, Karma Service | `src/utils/validateEnum.ts` |
| CR-4 | Redis as sole source of truth | Rendez Backend, Karma Service, ReZ Backend | DB table + Redis cache |
| CR-5 | TanStack Query installed but unused | Rendez Admin | `src/app/layout.tsx` |
| CR-6 | Color tokens hardcoded in 60+ screens | Consumer, Merchant, Admin | `packages/rez-ui` design tokens |
| CR-7 | No shared API contract types | All apps, all services | `packages/shared-types` |
| CR-8 | Socket.IO reconnection pattern inconsistent | Consumer, Merchant, Rendez App | Shared `useRealtime.ts` hook |
| CR-9 | Referral code stored but never consumed | Rendez App, Consumer App | Profile creation flow |
| CR-10 | No shared `expo-secure-store` TTL/refresh | Consumer, Merchant, Rendez App | `src/lib/authStore.ts` |
| CR-11 | Inline styles everywhere — no design system | Admin, Merchant, Consumer | `packages/rez-ui` |
| CR-12 | Duplicate queue definitions | Rendez Backend | Single `src/jobs/queue.ts` |
| CR-13 | Duplicate FraudService instantiation | Rendez Backend | Singleton pattern |
