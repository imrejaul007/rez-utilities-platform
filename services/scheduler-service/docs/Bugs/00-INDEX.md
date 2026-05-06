# REZ System Bug Registry — Master Index

## Audit Status Summary (as of 2026-04-15)

| Status | Count | Notes |
|--------|-------|-------|
| ✅ FIXED | 322 | All Audit 7 bugs (74) + 31 deferred bugs fixed in extension sprint (docs 18–21). Total CRITICAL and most HIGH severity bugs resolved |
| ⏳ DEFERRED | ~70 | ~6 migrated to Sprint 1 scripts (docs/migrations/audit7-sprint1/). Remaining deferred items are either: intentional/design-by (8), awaiting product decision (7), needs Phase 2 infra (5), or feature-not-built (3). ~20 fixable ones addressed this sprint. |
| 🔄 MISJUDGMENT | ~20 | Items flagged as bugs that were confirmed NOT real bugs (AS2-C1, FM-15, FM-30, BR-L1, GF-01, GF-03, CS-H7, FL-07, FL-09, TS-L2, TS-M6, CS-M5, TF-05, TF-12, F-M1, C2, ENUM-02, SD-01, SD-05, FM-01) |
| ✅ ALREADY CORRECT | ~8 | False positives confirmed by code review |
| ⚠️ NOT FIXABLE | ~2 | AB-C3 (file doesn't exist), RD-H3 (vulnerable code not found) |
| **TOTAL** | **~342** | Across all 21 bug report files |

All individual bug entries in files 06–20 now have `> **Status:**` badges. Files 01–05 predate the status badge format.

---

**Last Updated:** 2026-04-15
**New:** Migration scripts ready at `docs/migrations/audit7-sprint1/` (7 scripts for Sprint 1 high-priority deferred bugs)
**Audits Completed:**
- Audit 1 (2026-04-12): 4-agent deep code audit — data models, API contracts, enums/business logic, auth/sync
- Audit 2 (2026-04-13, session 1): 6-agent business logic + rule engine audit — cashback, loyalty, booking, wallet/payment, campaign, backend
- Audit 3 (2026-04-13, session 2): 9-agent full-stack forensic deep dive — schema divergence, field mismatches, enums, API contracts, gateway, routes, auth
- Audit 4/5 (2026-04-13): 8-agent comprehensive full-stack audit — backend routes, data models, auth/security, API contracts, frontend completeness, cross-service flows, business logic, TypeScript/UI consistency; + forensic frontend logic, type fragmentation

- Audit 6 (2026-04-14): Cross-service flows + business logic completeness — BullMQ double-consume, inter-service HTTP inventory, admin merchant sync, push stubs, dual webhook endpoints, bill pay/recharge stubs
- Audit 7 (2026-04-14): Shared package (17 bugs) + microservices (12 bugs) + unaudited projects (43 bugs) — all new findings
- Audit 8 (2026-04-15): **Consumer app exhaustive audit** — 10-agent parallel deep-dive across travel, commerce, payments, auth, gamification, discovery, infra, components, API contracts, security. **559 new bugs.** See [CONSUMER-APP-BUGS.md](CONSUMER-APP-BUGS.md) and [CONSUMER-APP-REMEDIATION-PLAN.md](CONSUMER-APP-REMEDIATION-PLAN.md).
- Audit 9 (2026-04-15): **Merchant app exhaustive audit** — 6-agent parallel deep-dive across auth, stores, orders, payments, gamification, discovery, travel, infra, components, API, security, system. **350 new bugs.** See [MERCHANT-APP-BUGS.md](MERCHANT-APP-BUGS.md).
- Audit 10 (2026-04-15): **Admin app exhaustive audit** — 5-agent parallel deep-dive across auth, dashboards, users, merchant mgmt, orders, finance, campaigns, analytics, infra, API, security. **321 new bugs.** See [ADMIN-APP-BUGS.md](ADMIN-APP-BUGS.md).
- Audit 11 (2026-04-15): **Backend exhaustive audit** — 6-agent parallel deep-dive across 15 services (gateway, auth, catalog, merchant, order, payment, wallet, finance, search, gamification, karma, marketing, ads, shared, events). **434 new bugs.** See [BACKEND-BUGS.md](BACKEND-BUGS.md).
- **Unified cross-app plan:** [UNIFIED-REMEDIATION-PLAN.md](UNIFIED-REMEDIATION-PLAN.md) — 1,664 total bugs across all four codebases; 6 phases + 5 parallel tracks; enforces single source of truth for API contracts, payment/order state machines, auth, components, logging, idempotency, audit logging, feature flags.

**Status:** SYSTEM RECOVERY MODE — financial losses, user trust damage, and security exposure in production now

---

## Bug Count Summary

| Tier | Audit 1 | Audit 2 | Audit 3 | Audit 4 | Audit 5 | Audit 6 | Audit 7 | TOTAL |
|------|---------|---------|---------|---------|---------|---------|---------|-------|
| CRITICAL | 8 | 9 | 11 | 6 | 10 | 9 | 16 | **69** |
| HIGH | 13 | 22 | 21 | 14 | 28 | 14 | 30 | **142** |
| MEDIUM | 10 | 12 | 13 | 6 | 24 | 11 | 22 | **98** |
| LOW | 0 | 0 | 2 | 3 | 18 | 7 | 6 | **36** |
| **TOTAL** | **31** | **43** | **47** | **29** | **80** | **41** | **74** | **~345** |

> Note: Bug IDs by audit — Audit 1: C/H/M series. Audit 2: C9-C17, H14-H36, M11-M22. Audit 3: SD, FM, GF, F-C/F-H/F-M, ENUM, API, BR, DM, AS2 prefixes. Audit 4/5: TF, FL, AC2, FE, TS prefixes. Audit 6: CS, BL prefixes. Audit 7: RS, MS, UP/AB/RD/ADS/MRS prefixes. All 21 bug report files present on disk. Counts approximate. **~20 MISJUDGMENT bugs reclassified (confirmed not real bugs). ~70 remain DEFERRED.**

> Note: Bug IDs by audit — Audit 1: C/H/M series. Audit 2: C9-C17, H14-H36, M11-M22. Audit 3: SD, FM, GF, F-C/F-H/F-M, ENUM, API, BR, DM, AS2 prefixes. Audit 4/5: TF, FL, AC2, FE, TS prefixes. Audit 6: CS, BL prefixes. Audit 7: RS, MS, UP/AB/RD/ADS/MRS prefixes. All 20 bug report files present on disk. Counts approximate.

---

## Files in This Folder

### Audit 1 — Code Structure & Data Layer (2026-04-12)
| File | Layer | Bugs |
|------|-------|------|
| [01-DATA-LAYER.md](01-DATA-LAYER.md) | Data models, schema consistency | C1, C2, H6–H8, H11, H13, M5, M6 |
| [02-API-CONTRACTS.md](02-API-CONTRACTS.md) | Routes, payloads, response shapes | H1–H5, M10 |
| [03-ENUMS-BUSINESS-LOGIC.md](03-ENUMS-BUSINESS-LOGIC.md) | Enums, coin system, cashback, streaks | C3, H9–H11, M1, M7–M9 |
| [04-AUTH-SYNC.md](04-AUTH-SYNC.md) | Auth middleware, token handling, data sync | C4–C8, H12, M3, M4 |
| [05-REMEDIATION-PLAN.md](05-REMEDIATION-PLAN.md) | Fix plan for Audit 1 (week-by-week) | All Audit 1 |

### Audit 2 — Business Logic & Rule Engine (2026-04-13, session 1)
| File | Layer | Bugs |
|------|-------|------|
| [06-FINANCIAL-INTEGRITY.md](06-FINANCIAL-INTEGRITY.md) | Payment flow, coin credit, wallet atomicity | C9, C10, H14–H17, H33, M11–M13 |
| [07-BOOKING-CANCELLATION.md](07-BOOKING-CANCELLATION.md) | Booking logic, cancellation, slot atomicity | C16, C17, H18, H19, H21, H35, M17, M18 |
| [08-LOYALTY-GAMIFICATION.md](08-LOYALTY-GAMIFICATION.md) | Visit milestones, streaks, achievement logic | C11, H22–H25, H31, H32, M14 |
| [09-CAMPAIGN-ELIGIBILITY.md](09-CAMPAIGN-ELIGIBILITY.md) | Campaign rules, offer limits, zone eligibility | C14, C15, H26–H28, H34, M15, M16, M19 |
| [10-CALCULATION-MISMATCHES.md](10-CALCULATION-MISMATCHES.md) | Formula inconsistencies, coin value, expiry | C12, C13, H29, H30, H36, M20–M22 |

### Audit 3 — Full-Stack Forensic Deep Dive (2026-04-13, session 2)
| File | Layer | Bug IDs |
|------|-------|---------|
| [06-FORENSIC-DATA-INTEGRITY.md](06-FORENSIC-DATA-INTEGRITY.md) | Cross-service data integrity, enum gaps | F-C1–F-C6, F-H1–F-H11, F-M1–F-M11 |
| [06-SCHEMA-DIVERGENCE.md](06-SCHEMA-DIVERGENCE.md) | MongoDB schema collision across services | SD-01–SD-09 |
| [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md) | Field names, types, nesting across all layers | FM-01–FM-30 |
| [07-FORENSIC-ENUM-MISMATCHES.md](07-FORENSIC-ENUM-MISMATCHES.md) | All enum mismatches across all services | ENUM-01–ENUM-20 |
| [08-FORENSIC-API-CONTRACTS.md](08-FORENSIC-API-CONTRACTS.md) | API contract bugs all services vs all clients | API-01–API-20 |
| [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md) | Gateway routing, frontend null crashes | GF-01–GF-20 |
| [10-BACKEND-ROUTES.md](10-BACKEND-ROUTES.md) | Backend routes, dead mounts, stubs | BR-C1–BR-C2, BR-H1–BR-H4, BR-M1–BR-M5, BR-L1–BR-L4 |
| [11-DATA-MODELS-NEW.md](11-DATA-MODELS-NEW.md) | New data model findings | DM-C1–DM-C4, DM-H1–DM-H5, DM-M1–DM-M6, DM-L1–DM-L5 |
| [12-AUTH-SECURITY-NEW.md](12-AUTH-SECURITY-NEW.md) | New auth and security findings | AS2-C1–AS2-C4, AS2-H1–AS2-H4, AS2-M1–AS2-M5, AS2-L1–AS2-L4 |

### Audit 4/5 — 8-Agent Full-Stack + Forensic Frontend Audit (2026-04-13)
| File | Layer | Bug IDs |
|------|-------|---------|
| [10-BACKEND-ROUTES.md](10-BACKEND-ROUTES.md) | Backend routes, dead mounts, live stubs, duplicate mounts | BR-C1–BR-C2, BR-H1–BR-H4, BR-M1–BR-M5, BR-L1–BR-L4 |
| [11-DATA-MODELS-NEW.md](11-DATA-MODELS-NEW.md) | Data model integrity, cross-service schema conflicts | DM-C1–DM-C4, DM-H1–DM-H5, DM-M1–DM-M6, DM-L1–DM-L5 |
| [12-AUTH-SECURITY-NEW.md](12-AUTH-SECURITY-NEW.md) | Auth, token storage, CORS, RBAC, token refresh | AS2-C1–AS2-C4, AS2-H1–AS2-H4, AS2-M1–AS2-M5, AS2-L1–AS2-L4 |
| [13-API-CONTRACTS-NEW.md](13-API-CONTRACTS-NEW.md) | API contract mismatches — admin/merchant vs backend | AC2-C1–AC2-C3, AC2-H1–AC2-H6, AC2-M1–AC2-M7, AC2-L1–AC2-L3 |
| [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md) | Frontend navigation, incomplete screens, broken forms, state gaps | FE-H1–FE-H12, FE-M1–FE-M10, FE-L1–FE-L5 |
| [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md) | TypeScript safety, null crashes, error boundaries, UI consistency | TS-C1–TS-C2, TS-H1–TS-H8, TS-M1–TS-M7, TS-L1–TS-L5 |

### Cross-Audit Gap Fill (2026-04-14)
| File | Layer | Bug IDs |
|------|-------|---------|
| [15-MISSED-ITEMS-ADDENDUM.md](15-MISSED-ITEMS-ADDENDUM.md) | Gaps confirmed missing from all prior audit files | MA-M1, MA-M2, MA-M3, MA-L1, MA-L2, MA-L3 |

### Audit 6 — Cross-Service Flows + Business Logic Completeness (2026-04-14)
| File | Layer | Bug IDs |
|------|-------|---------|
| [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md) | BullMQ double-consume, admin→merchant sync, inter-service HTTP inventory, orphan events, schema divergence | CS-C1–CS-C5, CS-H1–CS-H8, CS-M1–CS-M6, CS-L1–CS-L4 |
| [17-BUSINESS-LOGIC.md](17-BUSINESS-LOGIC.md) | Push stubs, dual webhook endpoints, bill pay/recharge stubs, payment lifecycle, wallet atomicity, merchant onboarding, settlement | BL-C1–BL-C4, BL-H1–BL-H6, BL-M1–BL-M5, BL-L1–BL-L3 |

### Audit 7 — Shared Package + Microservices + Unaudited Projects (2026-04-14)
| File | Layer | Bug IDs |
|------|-------|---------|
| [18-SHARED-PACKAGE.md](18-SHARED-PACKAGE.md) | rez-shared: circuit breaker, BullMQ connection, axios crash, secrets cache, rate limiter, webhook auth, health check, schema validation | RS-C1–RS-C3, RS-H1–RS-H7, RS-M1–RS-M5, RS-L1–RS-L2 |
| [19-MICROSERVICES.md](19-MICROSERVICES.md) | All microservices: notification worker crash, Sentry handler, Redis auth fail-open, credit score cache, BNPL scoping, campaign orchestrator, ad targeting | MS-C1–MS-C2, MS-H1–MS-H5, MS-M1–MS-M5 |
| [20-UNAUDITED-PROJECTS.md](20-UNAUDITED-PROJECTS.md) | Hotel OTA, adBazaar, Rendez backend, rez-ads-service, rez-marketing-service | UP-C1–UP-C3, UP-H1–UP-H2, AB-C1–AB-C3, RD-C1, RD-H1–RD-H4, RD-M1–RD-M3, ADS-H1–ADS-H5, ADS-M1–ADS-M2, ADS-L1, MRS-C1–MRS-C4, MRS-H1–MRS-H7, MRS-M1–MRS-M3, MRS-L1–MRS-L2 |
| [21-DEFERRED-BACKLOG.md](21-DEFERRED-BACKLOG.md) | All 118 DEFERRED bugs categorized with sprint recommendations | See backlog doc |

---

## CRITICAL Bugs — Fix before any production scaling

### From Audit 1
- **[C1]** Three incompatible schemas writing to `cointransactions` collection → [01-DATA-LAYER.md](01-DATA-LAYER.md#c1)
- **[C2]** `cashback` + `referral` coins invisible in LedgerEntry + Wallet bucket → [01-DATA-LAYER.md](01-DATA-LAYER.md#c2)
- **[C3]** REZ coins silently expire after 90 days (spec: never expire) → [03-ENUMS-BUSINESS-LOGIC.md](03-ENUMS-BUSINESS-LOGIC.md#c3)
- **[C4]** Wallet + Payment services fail OPEN on Redis outage → [04-AUTH-SYNC.md](04-AUTH-SYNC.md#c4)
- **[C5]** Wallet service accepts merchant + admin JWTs for user wallet ops → [04-AUTH-SYNC.md](04-AUTH-SYNC.md#c5)
- **[C6]** Logged-out merchant tokens remain valid in wallet-service → [04-AUTH-SYNC.md](04-AUTH-SYNC.md#c6)
- **[C7]** CrossAppSyncService webhook delivery is dead code → [04-AUTH-SYNC.md](04-AUTH-SYNC.md#c7)
- **[C8]** `syncOrders()` + `syncCashback()` are no-ops returning `success: true` → [04-AUTH-SYNC.md](04-AUTH-SYNC.md#c8)

### From Audit 2
- **[C9]** Coin credit after payment is fire-and-forget — no retry, no DLQ, no flag set → [06-FINANCIAL-INTEGRITY.md](06-FINANCIAL-INTEGRITY.md#c9)
- **[C10]** Merchant double-payout race condition in `payoutRoutes.ts` → [06-FINANCIAL-INTEGRITY.md](06-FINANCIAL-INTEGRITY.md#c10)
- **[C11]** 4 milestone systems contradict each other — display shows 2,000 coins, only 650 awarded at 100 visits → [08-LOYALTY-GAMIFICATION.md](08-LOYALTY-GAMIFICATION.md#c11)
- **[C12]** Frontend cashback preview formula completely wrong — `bill/10` vs backend multiplier engine → [10-CALCULATION-MISMATCHES.md](10-CALCULATION-MISMATCHES.md#c12)
- **[C13]** Coin value contradicted in 3 places: FAQ ₹0.50 vs backend ₹1.00 vs service ₹0.10 → [10-CALCULATION-MISMATCHES.md](10-CALCULATION-MISMATCHES.md#c13)
- **[C14]** Zone offer eligibility (Senior/Women/Birthday) is frontend-only — API enforces nothing → [09-CAMPAIGN-ELIGIBILITY.md](09-CAMPAIGN-ELIGIBILITY.md#c14)
- **[C15]** Offer usage limits never decremented — unlimited redemptions despite configured cap → [09-CAMPAIGN-ELIGIBILITY.md](09-CAMPAIGN-ELIGIBILITY.md#c15)
- **[C16]** `CancellationPolicy` model completely ignored at cancellation — hardcoded 2h for all → [07-BOOKING-CANCELLATION.md](07-BOOKING-CANCELLATION.md#c16)
- **[C17]** Email says "24h free cancellation" but code enforces 2 hours → [07-BOOKING-CANCELLATION.md](07-BOOKING-CANCELLATION.md#c17)

### From Audit 5 (Backend Routes, Data Models, Auth, API Contracts, Frontend, TypeScript)
- **[BR-C1]** 66 merchant route modules imported in monolith but never mounted — dead code + accidental-mount risk → [10-BACKEND-ROUTES.md](10-BACKEND-ROUTES.md#br-c1)
- **[BR-C2]** `pollRoutes` shared router instance at `/api/polls` AND `/api/admin/polls` — no auth separation → [10-BACKEND-ROUTES.md](10-BACKEND-ROUTES.md#br-c2)
- **[DM-C1]** `MerchantWallet` auto-created without required `store` ObjectId field — every new wallet is schema-invalid → [11-DATA-MODELS-NEW.md](11-DATA-MODELS-NEW.md#dm-c1)
- **[DM-C2]** `ref: 'AdminUser'` on two models — model does not exist anywhere — all `.populate()` silently return null → [11-DATA-MODELS-NEW.md](11-DATA-MODELS-NEW.md#dm-c2)
- **[DM-C3]** Order history split: merchant-service writes `statusHistory`, backend writes `timeline` — same MongoDB collection → [11-DATA-MODELS-NEW.md](11-DATA-MODELS-NEW.md#dm-c3)
- **[DM-C4]** `coinType: 'nuqta'` in production MongoDB but not in enum — any `.save()` on legacy doc throws Mongoose validation → [11-DATA-MODELS-NEW.md](11-DATA-MODELS-NEW.md#dm-c4)
- **[AS2-C1]** User JWT blacklist stores raw tokens in Redis — full JWTs exposed in Redis keyspace dump → [12-AUTH-SECURITY-NEW.md](12-AUTH-SECURITY-NEW.md#as2-c1)
- **[AS2-C2]** Admin refresh token endpoint skips Redis blacklist check — forced logout ineffective for admins → [12-AUTH-SECURITY-NEW.md](12-AUTH-SECURITY-NEW.md#as2-c2)
- **[AS2-C3]** Merchant web tokens always in `localStorage` — `COOKIE_AUTH_ENABLED` hardcoded `false` → [12-AUTH-SECURITY-NEW.md](12-AUTH-SECURITY-NEW.md#as2-c3)
- **[AS2-C4]** Admin tokens in `localStorage` on web in dev mode → [12-AUTH-SECURITY-NEW.md](12-AUTH-SECURITY-NEW.md#as2-c4)
- **[AC2-C1]** Admin `getUserWallet` returns `{ user, wallet }` but frontend reads it as flat `UserWallet` — wallet UI blank/crashes → [13-API-CONTRACTS-NEW.md](13-API-CONTRACTS-NEW.md#ac2-c1)
- **[AC2-C2]** Team member login: `user.name` stored as `undefined` — every team member sees blank name → [13-API-CONTRACTS-NEW.md](13-API-CONTRACTS-NEW.md#ac2-c2)
- **[AC2-C3]** Admin `createMerchant` sends `name`/`storeAddress` — backend expects `ownerName`/`businessAddress` — merchant created with empty fields → [13-API-CONTRACTS-NEW.md](13-API-CONTRACTS-NEW.md#ac2-c3)
- **[TS-C1]** `apiClient.get<any>()` used across ALL API services — every response untyped, backend renames silently break frontend → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-c1)
- **[TS-C2]** No per-screen error boundaries — any runtime error in POS/wallet/analytics shows full-app crash screen → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-c2)

### From Audit 6 (Cross-Service Flows & Business Logic)
- **[CS-C1]** BullMQ double-consume on ALL 5 critical queues — coins/settlements/notifications drop ~50% silently → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-c1)
- **[CS-C2]** Admin suspend/reject does NOT reach rez-merchant-service — suspended merchants retain full API access → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-c2)
- **[CS-C3]** Gamification coinledgers dedup key consumed before wallet credit — permanent coin loss on wallet service downtime → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-c3)
- **[CS-C4]** rez-wallet-service upsert stores `storeId` (string) but schema requires `store` (ObjectId) — every new merchant wallet is schema-invalid → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-c4)
- **[CS-C5]** Payment coin credit fire-and-forget with `.catch(() => {})` — coins permanently lost on wallet service restart → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-c5)
- **[BL-C1]** ALL push notification providers are stubs — no push ever delivered to any user device → [17-BUSINESS-LOGIC.md](17-BUSINESS-LOGIC.md#bl-c1)
- **[BL-C2]** Dual Razorpay webhook endpoints — whichever is NOT registered never gets order cancellations → [17-BUSINESS-LOGIC.md](17-BUSINESS-LOGIC.md#bl-c2)
- **[BL-C3]** Bill pay and recharge are permanent stubs — users get 201 but nothing is processed → [17-BUSINESS-LOGIC.md](17-BUSINESS-LOGIC.md#bl-c3)
- **[BL-C4]** Recharge aggregator service throws on any configured call — feature completely non-functional → [17-BUSINESS-LOGIC.md](17-BUSINESS-LOGIC.md#bl-c4)

### From Audit 7 — Shared Package + Microservices + Unaudited Projects ✅ FIXED
- **[RS-C1]** ✅ Circuit breaker `Promise.race` returns `null` on timeout → [18-SHARED-PACKAGE.md](18-SHARED-PACKAGE.md#rs-c1)
- **[RS-C2]** ✅ BullMQ worker discards Redis config → [18-SHARED-PACKAGE.md](18-SHARED-PACKAGE.md#rs-c2)
- **[RS-C3]** ✅ `axios.default.get()` in Vault getter — runtime crash → [18-SHARED-PACKAGE.md](18-SHARED-PACKAGE.md#rs-c3)
- **[MS-C1]** ✅ `results.push` on `Record<string,string>` — push notifications silently fail → [19-MICROSERVICES.md](19-MICROSERVICES.md#ms-c1)
- **[MS-C2]** ✅ Sentry error handler unconditional registration → [19-MICROSERVICES.md](19-MICROSERVICES.md#ms-c2)
- **[AB-C1]** ✅ ALREADY CORRECT — HMAC already used with correct argument order
- **[AB-C3]** ⚠️ NOT FIXABLE — referenced file does not exist in codebase
- **[MRS-C1]** ✅ HTTP 200 sent to Meta before async processing → [20-UNAUDITED-PROJECTS.md](20-UNAUDITED-PROJECTS.md#mrs-c1)
- **[MRS-C2]** ✅ AdBazaar notifications constructed from raw body → [20-UNAUDITED-PROJECTS.md](20-UNAUDITED-PROJECTS.md#mrs-c2)
- **[MRS-C3]** ✅ SMS auth key visible in server logs → [20-UNAUDITED-PROJECTS.md](20-UNAUDITED-PROJECTS.md#mrs-c3)
- **[MRS-C4]** ✅ Email HTML injection — user-controlled message injected without escaping → [20-UNAUDITED-PROJECTS.md](20-UNAUDITED-PROJECTS.md#mrs-c4)

### From Audit 3 (Schema Divergence, Gateway, Type Fragmentation)
- **[SD-01]** `TransactionAuditLog` — same Mongoose model name, two incompatible schemas, same MongoDB collection → [06-SCHEMA-DIVERGENCE.md](06-SCHEMA-DIVERGENCE.md#sd-01)
- **[SD-02]** `Wallet` schema: 3 fields exist only in monolith, zeroed on every wallet-svc write → [06-SCHEMA-DIVERGENCE.md](06-SCHEMA-DIVERGENCE.md#sd-02)
- **[SD-03]** `CoinTransaction.idempotencyKey` non-unique in wallet-svc — coin double-credits possible → [06-SCHEMA-DIVERGENCE.md](06-SCHEMA-DIVERGENCE.md#sd-03)
- **[GF-01]** `POST /api/wallet/confirm-payment` always returns HTTP 501 — Stripe payments broken → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-01)
- **[GF-02]** Monolith payment routes unreachable through gateway when standalone payment service is active → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-02)
- **[GF-04]** `verifyResponse.data.orderId` / `.transactionId` accessed without null guard — checkout crash → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-04)
- **[GF-05]** `response.data.discount` used in arithmetic without null guard — coupon crash at checkout → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-05)
- **[GF-11]** Zod `updateOrderStatusSchema` missing `'out_for_delivery'` — merchant dispatch always 422 → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-11)
- **[GF-12]** Zod `createOfferSchema.offerType`: 5 phantom values pass Zod, 3 valid DB values rejected → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-12)
- **[TF-04]** `bookingType` discriminant: `'table'` (rez-shared) vs `'table_booking'` (backend) — all routing fails → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-04)
- **[TF-08]** Zod `createOfferSchema.offerType` vs `OfferType` TS enum — runtime rejects TS-valid types → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-08)

---

## HIGH Bugs — Fix within sprint

### From Audit 1
- **[H1]** Merchant wallet transaction list always renders empty → [02-API-CONTRACTS.md](02-API-CONTRACTS.md#h1)
- **[H2]** Merchant cashback approve/reject are permanent 404s → [02-API-CONTRACTS.md](02-API-CONTRACTS.md#h2)
- **[H3]** Bulk cashback field name mismatch (`requestIds` vs `cashbackIds`) → [02-API-CONTRACTS.md](02-API-CONTRACTS.md#h3)
- **[H4]** Cashback export HTTP method mismatch (POST vs GET) → [02-API-CONTRACTS.md](02-API-CONTRACTS.md#h4)
- **[H5]** `paymentMethodType` vs `paymentMethod` — services can't interoperate → [02-API-CONTRACTS.md](02-API-CONTRACTS.md#h5)
- **[H6]** `merchant` vs `merchantId` collision breaks wallet uniqueness → [01-DATA-LAYER.md](01-DATA-LAYER.md#h6)
- **[H7]** Two separate Cashback collections, no reconciliation → [01-DATA-LAYER.md](01-DATA-LAYER.md#h7)
- **[H8]** `UserLoyalty.coins.available` is a phantom balance → [01-DATA-LAYER.md](01-DATA-LAYER.md#h8)
- **[H9]** 7-day streak: 200 coins (backend) vs 150 coins (gamification worker) → [03-ENUMS-BUSINESS-LOGIC.md](03-ENUMS-BUSINESS-LOGIC.md#h9)
- **[H10]** IST vs UTC streak timezone bug → [03-ENUMS-BUSINESS-LOGIC.md](03-ENUMS-BUSINESS-LOGIC.md#h10)
- **[H11]** `prive` coins silently reclassified as `rez` in ledger writes → [03-ENUMS-BUSINESS-LOGIC.md](03-ENUMS-BUSINESS-LOGIC.md#h11)
- **[H12]** Merchant web tokens stored in localStorage (XSS risk) → [04-AUTH-SYNC.md](04-AUTH-SYNC.md#h12)
- **[H13]** `Wallet.currency` default mismatch: `'RC'` vs `'REZ_COIN'` → [01-DATA-LAYER.md](01-DATA-LAYER.md#h13)

### From Audit 2
- **[H14]** `walletCredited` flag never set after coin credit — no audit trail → [06-FINANCIAL-INTEGRITY.md](06-FINANCIAL-INTEGRITY.md#h14)
- **[H15]** Reconciliation marks payment `completed` but never credits wallet → [06-FINANCIAL-INTEGRITY.md](06-FINANCIAL-INTEGRITY.md#h15)
- **[H16]** Coin deduction not atomic with payment — no saga/compensation on crash → [06-FINANCIAL-INTEGRITY.md](06-FINANCIAL-INTEGRITY.md#h16)
- **[H17]** `instantRewardService` uses `Date.now()` in referenceId — double coins on retry → [06-FINANCIAL-INTEGRITY.md](06-FINANCIAL-INTEGRITY.md#h17)
- **[H18]** Merchant cancellation triggers no payment refund → [07-BOOKING-CANCELLATION.md](07-BOOKING-CANCELLATION.md#h18)
- **[H19]** Admin cancellation of travel bookings triggers no refund → [07-BOOKING-CANCELLATION.md](07-BOOKING-CANCELLATION.md#h19)
- **[H21]** Slot booking non-atomic: slot counter and booking document are separate DB operations → [07-BOOKING-CANCELLATION.md](07-BOOKING-CANCELLATION.md#h21)
- **[H22]** Single QR check-in fires 3 concurrent gamification event paths → [08-LOYALTY-GAMIFICATION.md](08-LOYALTY-GAMIFICATION.md#h22)
- **[H23]** Achievement worker counts cancelled/pending visits toward milestones → [08-LOYALTY-GAMIFICATION.md](08-LOYALTY-GAMIFICATION.md#h23)
- **[H24]** Streak timezone war: gamification service UTC vs monolith IST → [08-LOYALTY-GAMIFICATION.md](08-LOYALTY-GAMIFICATION.md#h24)
- **[H25]** Streak reset inconsistency: workers reset to 1, cron resets to 0 → [08-LOYALTY-GAMIFICATION.md](08-LOYALTY-GAMIFICATION.md#h25)
- **[H26]** Campaign `userEligible: false` annotation not enforced at redemption → [09-CAMPAIGN-ELIGIBILITY.md](09-CAMPAIGN-ELIGIBILITY.md#h26)
- **[H27]** `minOrderValue` not enforced at deal redemption → [09-CAMPAIGN-ELIGIBILITY.md](09-CAMPAIGN-ELIGIBILITY.md#h27)
- **[H28]** Unapproved merchant offers served to consumers (`adminApproved` not filtered) → [09-CAMPAIGN-ELIGIBILITY.md](09-CAMPAIGN-ELIGIBILITY.md#h28)
- **[H29]** Privé coins missing from `coinUsageOrder` in wallet balance API response → [10-CALCULATION-MISMATCHES.md](10-CALCULATION-MISMATCHES.md#h29)
- **[H30]** Promo coin cap: 20% backend vs 30% consumer app checkout config → [10-CALCULATION-MISMATCHES.md](10-CALCULATION-MISMATCHES.md#h30)
- **[H31]** No code implements loyalty tier auto-upgrade despite thresholds defined → [08-LOYALTY-GAMIFICATION.md](08-LOYALTY-GAMIFICATION.md#h31)
- **[H32]** Three separate visit count stores produce different numbers for same user → [08-LOYALTY-GAMIFICATION.md](08-LOYALTY-GAMIFICATION.md#h32)
- **[H33]** `debitInPriorityOrder` computes `balanceBefore` from stale in-memory variable → [06-FINANCIAL-INTEGRITY.md](06-FINANCIAL-INTEGRITY.md#h33)
- **[H34]** `StoreVoucher` POST/PUT passes `req.body` raw — arbitrary field injection → [09-CAMPAIGN-ELIGIBILITY.md](09-CAMPAIGN-ELIGIBILITY.md#h34)
- **[H35]** Table booking capacity guard non-atomic — phantom reservation on crash → [07-BOOKING-CANCELLATION.md](07-BOOKING-CANCELLATION.md#h35)
- **[H36]** `rez-shared COIN_EXPIRY_DAYS.promo = 7` — contradicts all other configs → [10-CALCULATION-MISMATCHES.md](10-CALCULATION-MISMATCHES.md#h36)

### From Audit 6 (Cross-Service Flows & Business Logic)
- **[CS-H1]** `/achievements/:userId` always shows `total_coins: 0` — wrong balance field, `rezBalance` doesn't exist → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-h1)
- **[CS-H2]** Credit score calls 2 non-existent endpoints — payment-regularity and order-stats are 404s, score uses fabricated defaults → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-h2)
- **[CS-H3]** rez-order-service GET /orders routes completely unauthenticated — full order history publicly readable (BOLA) → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-h3)
- **[CS-H4]** `storevisits` userId queried as string but stored as ObjectId — all visit-based achievements never unlock → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-h4)
- **[CS-H5]** `wallet.merchant_settlement` jobs only invalidate Redis cache — never actually credit merchant wallet (financial loss) → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-h5)
- **[CS-H6]** Admin user suspend does not invalidate rez-merchant-service sessions — suspended users retain merchant access → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-h6)
- **[CS-H7]** cashback queue events listener monitors non-existent queue name — all cashback failures invisible → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-h7)
- **[CS-H8]** No admin route to update merchant business data — admin panel cannot edit merchant profiles → [16-CROSS-SERVICE-FLOWS.md](16-CROSS-SERVICE-FLOWS.md#cs-h8)
- **[BL-H1]** Payment failure sends no user notification — users silently get cancelled orders with no explanation → [17-BUSINESS-LOGIC.md](17-BUSINESS-LOGIC.md#bl-h1)
- **[BL-H2]** rez-payment-service `handleWebhookFailed` does not update order in monolith — orders stuck in `placed` on failed payments → [17-BUSINESS-LOGIC.md](17-BUSINESS-LOGIC.md#bl-h2)
- **[BL-H3]** `dispatched` order status has no push notification — users not notified when order is out for delivery → [17-BUSINESS-LOGIC.md](17-BUSINESS-LOGIC.md#bl-h3)
- **[BL-H4]** Merchant wallet not created on admin approval — lazy creation can fail at first order delivery → [17-BUSINESS-LOGIC.md](17-BUSINESS-LOGIC.md#bl-h4)
- **[BL-H5]** Monolith wallet credit not in MongoDB transaction — Redis lock loss enables double-credit risk → [17-BUSINESS-LOGIC.md](17-BUSINESS-LOGIC.md#bl-h5)
- **[BL-H6]** rez-order-service settlement amount defaults to `0` if event payload missing field — merchant gets ₹0 settlement → [17-BUSINESS-LOGIC.md](17-BUSINESS-LOGIC.md#bl-h6)

### From Audit 3 (Schema Divergence, Field Mismatches, Gateway, Type Fragmentation)
- **[SD-04]** Ghost `User` model in rez-merchant-service: `strict: false` writes arbitrary fields to `users` collection → [06-SCHEMA-DIVERGENCE.md](06-SCHEMA-DIVERGENCE.md#sd-04)
- **[SD-05]** `MerchantWallet.transactions[]` migration half-applied — inconsistent document shapes → [06-SCHEMA-DIVERGENCE.md](06-SCHEMA-DIVERGENCE.md#sd-05)
- **[SD-06]** Payment FSM `VALID_TRANSITIONS` split across two services — race-condition payment states → [06-SCHEMA-DIVERGENCE.md](06-SCHEMA-DIVERGENCE.md#sd-06)
- **[SD-07]** `Wallet.currency` default: `'RC'` (monolith) vs `'REZ_COIN'` (wallet-svc) — mixed values same collection → [06-SCHEMA-DIVERGENCE.md](06-SCHEMA-DIVERGENCE.md#sd-07)
- **[FM-01]** Order delivery fee: 4 different field names across admin/merchant/consumer/shared → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-01)
- **[FM-02]** Order customer field: `order.user` (admin) vs `order.customer` (merchant) — wrong data in both panels → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-02)
- **[FM-03]** `TransactionStatus` `'completed'` (backend) vs `'success'` (consumer UI) — wallet badges always wrong → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-03)
- **[FM-04]** Branded coins: `merchantId/merchantName` vs `storeId/storeName` vs `storePromoCoins` — 3 field sets → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-04)
- **[FM-05]** `wasilCoins` ghost field still read in consumer tracking/confirmation screens → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-05)
- **[FM-06]** `Order.items[].price` vs `.unitPrice` vs `.priceAtPurchase` — total calculation uses wrong field → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-06)
- **[FM-07]** `Offer.validity` vs `Offer.validUntil` vs `Offer.expiryDate` — 3 expiry field names, 1 enforced → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-07)
- **[FM-08]** `Merchant.rating` vs `Merchant.averageRating` — consumer/admin read stale or empty rating → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-08)
- **[FM-09]** `CoinTransaction.userId` vs `.user` — wallet history breaks depending on write path → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-09)
- **[FM-10]** `Booking.userId` vs `Booking.customerId` — booking lookup by user fails on half the documents → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-10)
- **[FM-11]** `Order.merchantId` vs `Order.merchant` (ObjectRef) — join queries fail on one side → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-11)
- **[FM-12]** `Cashback.status` values: `'pending'/'approved'/'rejected'` (backend) vs `'PENDING'/'APPROVED'/'DENIED'` (consumer) → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-12)
- **[FM-13]** `User.loyaltyPoints` vs `User.coinBalance` — two fields for same concept, one always stale → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-13)
- **[FM-14]** `Merchant.isActive` vs `Merchant.status === 'active'` — dual-path activation check, one always stale → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-14)
- **[FM-15]** `Booking.tableNumber` vs `Booking.tableId` — table booking confirmation shows wrong/undefined table → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-15)
- **[FM-16]** `Order.address` (string) vs `Order.deliveryAddress` (object) — address display broken in one flow → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-16)
- **[FM-17]** OTA coin balance in paise, main wallet in rupees — no conversion applied → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-17)
- **[FM-18]** `Payment.razorpayOrderId` vs `Payment.gatewayOrderId` — verification uses wrong field → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-18)
- **[FM-19]** `bookingType` discriminant: `'table'` vs `'table_booking'` (also TF-04) → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-19)
- **[FM-20]** `Merchant.contactEmail` vs `Merchant.email` — merchant contact form sends to wrong field → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-20)
- **[FM-21]** `CoinTransaction.amount` vs `.coins` vs `.value` — 3 amount fields, display reads wrong one → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-21)
- **[FM-22]** `Offer.minimumOrderValue` vs `Offer.minPurchase` vs `Offer.minOrderAmount` — eligibility check uses wrong key → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-22)
- **[FM-23]** `Order.status` FSM states differ between monolith order doc and wallet-svc event handler → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-23)
- **[FM-24]** `User.profilePicture` vs `User.avatar` vs `User.photo` — profile image undefined in 2 of 3 paths → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-24)
- **[FM-25]** `LedgerEntry.debitWalletId` vs `.fromWalletId` — ledger double-entry joins break → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-25)
- **[FM-26]** `Merchant.totalRevenue` vs `Merchant.revenue` — analytics dashboard reads wrong field → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-26)
- **[FM-27]** `Notification.recipientId` vs `.userId` vs `.targetUserId` — notification routing uses wrong field → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-27)
- **[FM-28]** `Voucher.code` (rez-shared) vs `Voucher.voucherCode` (consumer UI) — redemption always fails → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-28)
- **[FM-29]** `Order.discount` (flat number) vs `Order.discountDetails` (object) — discount display broken → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-29)
- **[FM-30]** `User.phone` (monolith) vs `User.phoneNumber` (consumer unified type) — phone lookup fails → [07-FIELD-MISMATCHES.md](07-FIELD-MISMATCHES.md#fm-30)
- **[GF-03]** `flow` field stripped by Joi `stripUnknown:true` — `isSignupFlow` always false → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-03)
- **[GF-06]** `cardOffersResponse.data.discounts[0]` — no array length guard, crash on empty → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-06)
- **[GF-07]** `GET /api/orders/counts` returns `{ active, pending }`, frontend type expects `{ active, past }` → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-07)
- **[GF-08]** `walletPaymentResult` entirely untyped — cast as `any`, no API contract, no fallback → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-08)
- **[GF-09]** Wallet cashback/pending: 4-level fallback — 2 paths never sent by backend → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-09)
- **[GF-10]** `/api/wallet/internal/debit` uses paise — all other wallet APIs use rupees → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-10)
- **[GF-17]** `requireAuth` sets `req.user`, `authenticate` sets `req.userId` — controllers read wrong property → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-17)
- **[GF-18]** OTA SSO: `ota_coin_balance_paise` no null guard — NaN stored as balance on SSO failure → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-18)
- **[TF-01]** `CoinType` has 4/5/6 values across 6 files — `cashback`/`referral` invisible in consumer + wallet-svc → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-01)
- **[TF-02]** `TransactionType` SCREAMING_CASE (consumer) vs lowercase (backend) — wallet display always broken → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-02)
- **[TF-03]** `User.role` consumer type missing `support`, `operator`, `super_admin`; adds fake `moderator` → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-03)
- **[TF-05]** `PaymentStatus` name collision: 10-state FSM vs 8-state order sub-document — wrong statuses allowed/blocked → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-05)
- **[TF-07]** Consumer `Offer._id` vs `Offer.id` in same app — offer actions (like/share/view) break → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-07)
- **[TF-12]** User ID: `_id` (DB/admin), `id` (consumer/merchant/backend API) — cross-service ID lookups get `undefined` → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-12)
- **[TF-17]** `loyaltyTier`: `rezPlusTier` vs `loyaltyTier` vs `subscriptionTier` — 3 fields + 3 value sets for same concept → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-17)

### From Audit 5 (Frontend Completeness & TypeScript Safety)
- **[FE-H1]** Purchase order create wizard: Steps 2–4 never defined, no API call, no submit handler — feature completely non-functional → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h1)
- **[FE-H2]** 3 export buttons in `reports.tsx` are dead no-ops (`onPress={() => {}}`) — Export P&L/GST/Expenses do nothing → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h2)
- **[FE-H3]** Reports P&L/GST/Expenses use hardcoded multipliers (0.6/0.18/0.3) — completely fabricated financial figures → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h3)
- **[FE-H4]** `aov-analytics.tsx` empty catch block — API failure shows blank screen with no error/retry → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h4)
- **[FE-H5]** `growth.tsx` `metricsError` captured but never rendered — silent empty screen on API failure → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h5)
- **[FE-H6]** `bonus-campaigns.tsx` API error silently shows empty list — merchant can't distinguish failure from no data → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h6)
- **[FE-H7]** `discounts/builder.tsx` ignores `userId` nav param — targeted discount becomes generic discount → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h7)
- **[FE-H8]** `purchase-orders/create.tsx` ignores `prefillFromPO` nav param — re-order from existing PO creates blank form → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h8)
- **[FE-H9]** Admin app: 95+ screens with `TextInput` missing `KeyboardAvoidingView` — keyboard covers inputs on all mobile devices → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h9)
- **[FE-H10]** `MerchantContext.products` and direct API calls are two independent data sources — product list always stale → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h10)
- **[FE-H11]** `StoreContext.createStore` bypassed by add/edit screens — store list stale after mutation → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h11)
- **[FE-H12]** `OnboardingContext` auto-save interval never cleared after onboarding completes — unnecessary API calls forever → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h12)
- **[TS-H1]** Non-null assertions (`!`) on async state: `onboardingData.data.businessInfo!`, `storeId!`, `eligibility!` — crash on undefined → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h1)
- **[TS-H2]** Missing optional chaining on deep API object access: `auth.ts:22`, `trends.tsx:239`, `payouts/index.tsx:291`, `settlements:245` → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h2)
- **[TS-H3]** `.map()` called on nullable arrays: `analytics.monthlyTrends.map()`, `Math.max(...forecast.map(...))` crash on undefined → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h3)
- **[TS-H4]** Brand colors hardcoded in 60+ screens — brand purple is two different values (`#7C3AED` vs `#4f46e5`), no design tokens → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h4)
- **[TS-H5]** Admin app missing 8 shared UI components merchant has: `BulkActionBar`, `OfflineBanner`, `CachedImage`, `NotificationCenter`, etc. → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h5)
- **[TS-H6]** `ErrorBoundary` diverges between apps — admin missing `AsyncErrorBoundary`, `useErrorBoundary`, `withErrorBoundary` → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h6)
- **[TS-H7]** `bonus-zone.tsx` `display` type missing `bannerImage`/`partnerLogo` — cast as `any`, fields may be silently dropped by backend → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h7)
- **[TS-H8]** `verifications.tsx` casts `userId` string as `UserInfo` object — all property accesses return `undefined` → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h8)

---

## MEDIUM Bugs — Fix within 2 sprints

### From Audit 1
- **[M1]** No coin expiry job — expired coins show as available → [03-ENUMS-BUSINESS-LOGIC.md](03-ENUMS-BUSINESS-LOGIC.md#m1)
- **[M2]** Admin order status mapper only in frontend → [03-ENUMS-BUSINESS-LOGIC.md](03-ENUMS-BUSINESS-LOGIC.md#m2)
- **[M3]** `getLastSyncDate()` never queries MongoDB — full re-sync after every restart → [04-AUTH-SYNC.md](04-AUTH-SYNC.md#m3)
- **[M4]** `/api/sync/statistics` leaks system-wide stats to any merchant → [04-AUTH-SYNC.md](04-AUTH-SYNC.md#m4)
- **[M5]** `MerchantLoyaltyConfig` duplicated in two services → [01-DATA-LAYER.md](01-DATA-LAYER.md#m5)
- **[M6]** `LoyaltyReward` uses phone + slug as IDs instead of ObjectIds → [01-DATA-LAYER.md](01-DATA-LAYER.md#m6)
- **[M7]** `branded` coins: spec says 6-month expiry, `rewardConfig.ts` defaults to 0 → [03-ENUMS-BUSINESS-LOGIC.md](03-ENUMS-BUSINESS-LOGIC.md#m7)
- **[M8]** No `debitInPriorityOrder()` in monolith — all debits default to `rez` → [03-ENUMS-BUSINESS-LOGIC.md](03-ENUMS-BUSINESS-LOGIC.md#m8)
- **[M9]** Campaign eligibility not centralized → [03-ENUMS-BUSINESS-LOGIC.md](03-ENUMS-BUSINESS-LOGIC.md#m9)
- **[M10]** Cookie auth: merchant web sends cookie, backend reads only Bearer → [02-API-CONTRACTS.md](02-API-CONTRACTS.md#m10)

### From Audit 2
- **[M11]** Finance service bill pay/recharge stubs reachable in production → [06-FINANCIAL-INTEGRITY.md](06-FINANCIAL-INTEGRITY.md#m11)
- **[M12]** Redis rate limiter on wallet debit fails OPEN — unlimited debits on Redis failure → [06-FINANCIAL-INTEGRITY.md](06-FINANCIAL-INTEGRITY.md#m12)
- **[M13]** WalletOperationQueue drain is credits-only — debits hard-fail during Redis outage → [06-FINANCIAL-INTEGRITY.md](06-FINANCIAL-INTEGRITY.md#m13)
- **[M14]** `savings` streak used as proxy for store visit streak — measures wrong thing → [08-LOYALTY-GAMIFICATION.md](08-LOYALTY-GAMIFICATION.md#m14)
- **[M15]** Timezone-naive date handling — IST flash sales expire 5.5h early on UTC server → [09-CAMPAIGN-ELIGIBILITY.md](09-CAMPAIGN-ELIGIBILITY.md#m15)
- **[M16]** Duplicate `campaignROI.ts` + `campaignSimulator.ts` in two services → [09-CAMPAIGN-ELIGIBILITY.md](09-CAMPAIGN-ELIGIBILITY.md#m16)
- **[M17]** OTA bookings have no availability enforcement in the monolith → [07-BOOKING-CANCELLATION.md](07-BOOKING-CANCELLATION.md#m17)
- **[M18]** Merchant can mark booking `completed` from `pending` — state machine bypass → [07-BOOKING-CANCELLATION.md](07-BOOKING-CANCELLATION.md#m18)
- **[M19]** `DiscountRule` PATCH passes `req.body` raw — any field overwritable → [09-CAMPAIGN-ELIGIBILITY.md](09-CAMPAIGN-ELIGIBILITY.md#m19)
- **[M20]** Loyalty state fragmented across 4 collections — no complete history queryable → [10-CALCULATION-MISMATCHES.md](10-CALCULATION-MISMATCHES.md#m20)
- **[M21]** Reward rates and streak milestones hardcoded in service files — no admin control → [10-CALCULATION-MISMATCHES.md](10-CALCULATION-MISMATCHES.md#m21)
- **[M22]** Two parallel merchant payout systems write to different collections — no cross-path lock → [10-CALCULATION-MISMATCHES.md](10-CALCULATION-MISMATCHES.md#m22)

### From Audit 3 (Schema, Gateway, Type Fragmentation)
- **[SD-08]** Duplicate `rez-shared` package in two paths — silent type split on any unmirrored change → [06-SCHEMA-DIVERGENCE.md](06-SCHEMA-DIVERGENCE.md#sd-08)
- **[SD-09]** Merchant model `lastLogin` deprecation inconsistency between monolith and merchant-svc → [06-SCHEMA-DIVERGENCE.md](06-SCHEMA-DIVERGENCE.md#sd-09)
- **[GF-13]** Merchant wallet transaction response envelope mismatch (`data[]` vs `data.transactions`) → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-13)
- **[GF-14]** Gateway `/api/wallet` cache is a no-op for all authenticated requests — wasted memory → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-14)
- **[GF-15]** `/api/notifications` routed to monolith — notification microservice has no HTTP server → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-15)
- **[GF-16]** Wallet service: duplicate path aliases — rate limiters see half the real traffic per path → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-16)
- **[GF-19]** `API_CONTRACTS.md` documents `token` (not `accessToken`) in auth login response → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-19)
- **[GF-20]** `API_CONTRACTS.md` documents `tier: 'diamond'` — value exists nowhere in code or DB → [08-GATEWAY-FRONTEND-BREAKING.md](08-GATEWAY-FRONTEND-BREAKING.md#gf-20)
- **[TF-06]** Consumer `User.email` required in unified types, optional in rez-shared and backend → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-06)
- **[TF-09]** `isSuspended` (canonical) vs `isBanned` (consumer unified type) — suspension state always `undefined` → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-09)
- **[TF-10]** Admin app inlines `rez-shared` types instead of importing the package — will silently drift → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-10)
- **[TF-11]** `OrderDTO.payment.method` uses `'online'`/`'mixed'` — not in DB, not in Zod, not in any frontend type → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-11)
- **[TF-13]** `Order.createdAt`: `Date` (backend models) vs `string` (rez-shared) vs `string | Date` (consumer) → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-13)
- **[TF-14]** `Merchant.phone` required in DB and rez-shared, optional in merchant app type → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-14)
- **[TF-15]** `Merchant.businessAddress` required in DB and rez-shared, optional in merchant app type → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-15)

### From Audit 5 (Frontend Completeness & TypeScript Safety)
- **[FE-M1]** Admin `AlertContext` wraps entire app but `useAlert()` never called anywhere — dead bundle code → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-m1)
- **[FE-M2]** `campaigns/` route group (5 screens) has no navigation entry point — unreachable → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-m2)
- **[FE-M3]** `campaigns/recommendations.tsx` — no API call, no data — static placeholder in production → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-m3)
- **[FE-M4]** 7+ orphan screens with no inbound navigation: `aov-rewards`, `catalog`, `hotel-ota`, `rez-capital`, `gst`, etc. → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-m4)
- **[FE-M5]** `(products)/_layout.tsx` empty group — zero screen files inside, renders nothing → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-m5)
- **[FE-M6]** `customers/index.tsx` redirect loses deep-link params — `/customers?userId=...` drops userId → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-m6)
- **[FE-M7]** `integrations.tsx` — all integration taps show "Coming Soon" alert — feature not implemented → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-m7)
- **[FE-M8]** `promotional-videos.tsx` primary CTA triggers "Coming Soon" alert — screen is useless → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-m8)
- **[FE-M9]** `dine-in/table/[tableId].tsx` inline item add shows "Coming Soon" — dine-in order flow broken → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-m9)
- **[FE-M10]** `campaigns/performance.tsx` modal backdrop `onPress={() => {}}` — users cannot close modal → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-m10)
- **[TS-M1]** `User.featureLevel` schema type `Mixed` but interface says `number` — non-numeric values can be stored → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-m1)
- **[TS-M2]** `offlinePOSQueue.ts` uses `apiClient: any` and `billData as any` — offline payment path completely untyped → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-m2)
- **[TS-M3]** `event-rewards.tsx` casts `config.eventId as AdminEvent` without type guard — crashes when eventId is string → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-m3)
- **[TS-M4]** `broadcast.tsx` uses `res.data as unknown as BroadcastHistoryItem[]` double cast — actual shape unknown → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-m4)
- **[TS-M5]** No `Spacing` token in either app — all padding/margin/gap values are raw numbers, not on 8pt grid → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-m5)
- **[TS-M6]** Admin app missing custom font loading — merchant loads `SpaceMono`, admin uses system font → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-m6)
- **[TS-M7]** 9+ `FlatList`/`SectionList` instances missing `keyExtractor` — list re-render bugs in production → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-m7)

### LOW
- **[TF-16]** `Merchant.verificationStatus` typed as `string` in merchant app — no enum safety, no autocomplete → [09-TYPE-FRAGMENTATION.md](09-TYPE-FRAGMENTATION.md#tf-16)
- **[FE-L1]** Admin `unified-monitor.tsx` registered but unreachable — no inbound navigation → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-l1)
- **[FE-L2]** `app/analytics/_layout.tsx` no back navigation header — users stranded in deep analytics → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-l2)
- **[FE-L3]** Duplicate QR generator routes — `(dashboard)/qr-generator.tsx` and `app/qr-generator/index.tsx` conflict → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-l3)
- **[FE-L4]** `NotificationContext.refreshUnreadCount` doesn't update count on cold start → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-l4)
- **[FE-L5]** `pos-shortcut.tsx` file is unreachable dead code — `href: '/pos'` bypasses screen entirely → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-l5)
- **[TS-L1]** Both apps have hardcoded English strings throughout — no i18n layer → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-l1)
- **[TS-L2]** `ThemeProvider` in two different locations between admin and merchant — no shared theme system → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-l2)
- **[TS-L3]** `catch` blocks use `error: any` instead of `unknown` throughout both apps → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-l3)
- **[TS-L4]** `ProtectedAction.tsx`/`ProtectedRoute.tsx` — optional `permission` prop used with `!` inside — runtime crash if omitted → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-l4)
- **[TS-L5]** Unused exported types in `variants.ts` and `types/notifications.ts` — dead type exports → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-l5)

---

## Root Causes

1. **No single source of truth** — data models, business rules, and configuration values are defined independently in 3–5 places across services, `rez-shared`, and frontend, all with different values.

2. **Admin config stored but not enforced** — `CancellationPolicy`, `Offer.restrictions.usageLimitPerUser`, `campaign.minOrderValue`, zone eligibility: all configured correctly but the enforcement code was never written.

3. **Frontend calculates what the backend should own** — cashback preview, coin value display, redemption order, promo caps all computed independently in the consumer app using hardcoded formulas that diverge from backend logic.

4. **Fire-and-forget for financial operations** — coin credit after payment, wallet credit flag, instant rewards on check-in all use `.catch(() => {})` with no retry, DLQ, or compensating transaction.

5. **Non-atomic multi-step operations** — slot booking (counter + document), table booking (capacity guard + rollback), merchant payout (check + insert) all split what should be one MongoDB session transaction into two separate operations.

6. **Duplicated event paths without deduplication contracts** — QR check-in fires 3 simultaneous event paths; streak logic runs in 4 separate implementations with different timezone and reset assumptions.

7. **No TypeScript contract at frontend-backend boundary** — `apiClient.get<any>()` used in every service file across both apps. Zero compile-time protection. Backend field renames are invisible until production runtime crashes.

8. **Incomplete screens shipped as live features** — Purchase order create wizard (4 steps, 0 implemented), export buttons with empty handlers, reports using hardcoded multipliers, "Coming Soon" alerts on primary CTAs. Features appear navigable but are non-functional.

---

## Audit 5 HIGH/MEDIUM Quick Reference

### HIGH
- **[FE-H1]** `purchase-orders/create.tsx` — 4 steps, 0 implemented, no API call → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h1)
- **[FE-H2]** 3 export buttons have `onPress={() => {}}` — dead no-ops → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h2)
- **[FE-H3]** P&L/GST/Expenses use hardcoded multipliers, not real data → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h3)
- **[FE-H4]** `aov-analytics.tsx` empty `catch {}` — blank screen on failure → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h4)
- **[FE-H5]** `growth.tsx` — error captured, never rendered → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h5)
- **[FE-H9]** 95+ admin screens missing `KeyboardAvoidingView` → [14-FRONTEND-COMPLETENESS.md](14-FRONTEND-COMPLETENESS.md#fe-h9)
- **[TS-H1]** Non-null `!` on async state values — crash risk at runtime → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h1)
- **[TS-H2]** Missing optional chaining on deep API response access → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h2)
- **[TS-H3]** `.map()` on nullable API arrays — instant crash on empty response → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h3)
- **[TS-H4]** Hardcoded hex colors, two brand purples, no theme system → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h4)
- **[TS-H5]** Admin missing 8 UI components that merchant has → [15-TYPESCRIPT-UI.md](15-TYPESCRIPT-UI.md#ts-h5)
- **[AC2-H1–H6]** API contract mismatches: updateProfile silent no-op, approvalStatus undefined, Merchant.userId undefined, hardcoded Render URL, buildApiUrl wrong env, all calls unversioned → [13-API-CONTRACTS-NEW.md](13-API-CONTRACTS-NEW.md)
- **[AS2-H1–H4]** Auth: optionalAuth skips logout-all check, admin no token refresh on native, unsafe role cast, concurrent refresh race → [12-AUTH-SECURITY-NEW.md](12-AUTH-SECURITY-NEW.md)
- **[BR-H1]** 7 live document endpoints return empty data (stubs) → [10-BACKEND-ROUTES.md](10-BACKEND-ROUTES.md#br-h1)
- **[BR-H2]** Admin payroll endpoint returns hardcoded zeros → [10-BACKEND-ROUTES.md](10-BACKEND-ROUTES.md#br-h2)
- **[DM-H1–H5]** user.phone virtual used as DB field, profile.phoneNumber doesn't exist, wallet key conflict, wallet stats missing 3 fields, partnerApplicationId unindexed → [11-DATA-MODELS-NEW.md](11-DATA-MODELS-NEW.md)
