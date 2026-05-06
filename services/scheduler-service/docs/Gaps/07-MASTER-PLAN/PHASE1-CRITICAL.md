# PHASE 1 — CRITICAL Issues (ALL Codebases)

**Scope:** Every CRITICAL issue across all 9 codebases
**Target:** Zero CRITICAL bugs before any production scaling
**Timeline:** Weeks 1–3

---

## Rendez App (Gen 9)

### Admin Dashboard — Fix Immediately

| ID | Issue | File | Fix |
|----|-------|------|-----|
| RZ-A-C1 | ALL API calls missing auth header | 9 pages | Add `Authorization: Bearer` to every fetch |
| RZ-A-C2 | No Next.js middleware | No `middleware.ts` | Create edge middleware |
| RZ-A-C3 | API URL mismatch | `dashboard/page.tsx:109` | Unify to `src/lib/api.ts` |
| RZ-A-C4 | System health hardcoded | `dashboard/page.tsx:220` | Real backend health endpoint |

### Backend

| ID | Issue | File | Fix |
|----|-------|------|-----|
| RZ-B-C2 | Payment webhook race — double reward | `webhooks/rez.ts:49` | Atomic check-and-update |
| RZ-B-C1 | Gift voucher auth bypass | `gift.ts:80` | Verify caller owns gift |
| RZ-B-C3 | Query params `as any` | `wallet.ts:32` | Enum validation helper |
| RZ-B-C4 | Socket read_receipt matchId bypass | `socketServer.ts:155` | Verify message belongs to matchId |

### Mobile App

| ID | Issue | File | Fix |
|----|-------|------|-----|
| RZ-M-S1 | Referral code never consumed | `useDeepLink.ts:130` | Wire to profile creation |
| RZ-M-F1 | Gift inbox never refreshes | `GiftInboxScreen.tsx:48` | Fix query key |
| RZ-M-F4 | Photo deletion not synced | `ProfileEditScreen.tsx:129` | Call `deletePhoto` API |
| RZ-M-F3 | Like stale closure | `DiscoverScreen.tsx:302` | Use `getQueryData` |
| RZ-M-E1 | Empty name crash | `ProfileDetailScreen.tsx:191` | Guard `name?.[0]` |

---

## Karma Service (Gen 8)

| ID | Issue | File | Fix |
|----|-------|------|-----|
| G-KS-C1 | Hardcoded QR secret | `verificationEngine.ts:176` | Validate `QR_SECRET` at startup |
| G-KS-C2 | Auth no validation | `auth.ts:41` | Validate response shape |
| G-KS-C3 | jwtSecret unvalidated | `config/index.ts:22` | Add to startup check |
| G-KS-C4 | Privilege escalation | `karmaRoutes.ts:29` | Ownership check |
| G-KS-C5 | Batch stats unauthenticated | `batchRoutes.ts:220` | Add `requireAdminAuth` |
| G-KS-C6 | TimingSafeEqual throws | `verificationEngine.ts:183` | Check length first |
| G-KS-C7 | Idempotency key collision | `earnRecordService.ts:204` | Remove UUID suffix |
| G-KS-C8 | String vs ObjectId bypass | `verifyRoutes.ts:207` | Convert before compare |
| G-KS-C9 | Admin role case-sensitive | `adminAuth.ts:15` | Normalize to lowercase |

---

## Karma UI (Gen 8)

| ID | Issue | File | Fix |
|----|-------|------|-----|
| G-KU-C1 | totalHours runtime crash | `event/[id].tsx:350` | Use `expectedDurationHours` |
| G-KU-C2 | Check-in fragile logic | `event/[id].tsx:176` | Remove redundant status check |
| G-KU-C3 | Type completely divergent | `karmaService.ts:43` | Rename to `KarmaEventClient` |

---

## ReZ Gen 1–7 (Backend)

See [docs/Bugs/00-INDEX.md](../../Bugs/00-INDEX.md) for all CRITICAL bugs. Top 10:

| ID | Issue | Impact |
|----|-------|--------|
| C9 | Coin credit fire-and-forget | User loses coins |
| C10 | Merchant double-payout race | Financial loss |
| CS-C1 | BullMQ double-consume | ~50% events lost |
| CS-C5 | Payment coin credit silent fail | Coins lost |
| AS2-C1 | Raw JWTs in Redis | Token exposure |
| SD-03 | Idempotency key non-unique | Double credits |
| BL-C1 | Push notification stubs | No notifications |
| BL-C2 | Dual Razorpay webhooks | Missing cancellations |
| GF-01 | Payment always 501 | Payments broken |
| C3 | REZ coins silently expire | Coins lost |

---

## Cross-Service CRITICAL

| ID | Issue | Fix Location |
|----|-------|--------------|
| CS-C1 | BullMQ double-consume on 5 queues | All BullMQ workers |
| CS-C5 | Payment coin credit fire-and-forget | payment-service |
| SD-03 | Wallet idempotency non-unique | wallet-service |
| CR-4 | Redis as sole source of truth | Multiple services |

---

## ReZ Merchant App — Gen 10 (2026-04-16)

### Financial (Fix Before Release)

| ID | Issue | File | Fix |
|----|-------|------|-----|
| G-MA-C01 | Wallet balance ×100 inflation | `app/payouts/index.tsx:276` | Remove `* 100` from balance display |
| G-MA-C02 | Double coin deduction | `app/pos/index.tsx:711` | Add coinRedemption to payment payload |
| G-MA-C03 | Offline bill loses coin discount | `app/pos/index.tsx:658` | Add coinDiscountApplied to offline queue |
| G-MA-C04 | Cart cleared before SQLite write | `app/pos/index.tsx:658` | Move setCart() to after write confirms |

### Security (Fix Before Release)

| ID | Issue | File | Fix |
|----|-------|------|-----|
| G-MA-C05 | IDOR: order detail no ownership check | `app/(dashboard)/orders/[id].tsx:117` | Attach storeId to API call |
| G-MA-C06 | Biometric bypass on unavailable devices | `utils/biometric.ts:52` | Return error on unavailable, require PIN |

### Data Loss (Fix Before Release)

| ID | Issue | File | Fix |
|----|-------|------|-----|
| G-MA-C07 | Socket queue lost on crash | `contexts/SocketContext.tsx:110` | Persist queue to AsyncStorage |
| G-MA-C08 | Offline idempotency after INSERT | `services/offlinePOSQueue.ts:58` | Generate clientTxnId BEFORE INSERT |
| G-MA-C09 | Failed offline bills silently dropped | `services/offlinePOSQueue.ts:260` | Move to unrecoverable with notification |
| G-MA-C10 | Batch sync no atomicity | `services/offlinePOSQueue.ts:232` | Per-bill ACK, remove batch |

### Functional (Fix Before Release)

| ID | Issue | File | Fix |
|----|-------|------|-----|
| G-MA-C11 | Socket emit calls non-existent method | `contexts/SocketContext.tsx:112` | Add getSocket() + queueEvent to SocketService |
| G-MA-C12 | Offline queue wrong API paths | `services/offline.ts:332` | Fix all paths to `merchant/*` |
| G-MA-C13 | Cache never invalidated | `services/offline.ts:69` | Call cacheData() after mutations |
| G-MA-C14 | Pending orders tab always zero | `hooks/useOrdersDashboard.ts:222` | Use 'placed' not 'pending' |

### Merchant App Fix Order

```
Day 1:    G-MA-C01 → G-MA-C05 → G-MA-C11
Day 2:    G-MA-C02 → G-MA-C03 → G-MA-C04
Day 3:    G-MA-C06 → G-MA-C07 → G-MA-C08
Day 4:    G-MA-C09 → G-MA-C10 → G-MA-C12
Day 5:    G-MA-C13 → G-MA-C14
```

---

## Fix Order

```
Week 1:   RZ-A-C1 → RZ-B-C2 → RZ-M-S1 → G-KS-C1 → G-KS-C2
Week 2:   RZ-B-C1 → RZ-B-C3 → G-KS-C3 → G-KS-C4 → G-KS-C5
Week 3:   Remaining Karma → ReZ mobile → Gen 1-7 critical
```

---

## Prevention: What Gets Built During Phase 1

1. Shared `src/lib/api.ts` in admin dashboard
2. BullMQ job infrastructure in backend
3. MongoDB session transaction pattern in wallet-service
4. Idempotency key contract in `rez-shared`
5. Zod enum validation helper in `rez-shared`
