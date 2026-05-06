# PHASE 3 — MEDIUM Issues

**Scope:** All MEDIUM issues across all codebases
**Timeline:** Weeks 7–10

---

## Rendez App (Gen 9)

| ID | Issue | File |
|----|-------|------|
| RZ-M-F6 | Chat sends without feedback | `ChatScreen.tsx:75` |
| RZ-M-F7 | Chat lock state wrong states | `ChatScreen.tsx:39` |
| RZ-M-F8 | Meetup auto-advance ignores deps | `MeetupScreen.tsx:64` |
| RZ-M-A1 | Wallet status filter never passed | `api.ts:94` |
| RZ-M-A3 | Voucher QR never rendered | `VoucherScreen.tsx:66` |
| RZ-M-A4 | Unused getState export | `api.ts:64` |
| RZ-M-A5 | Meetup field mismatch | `MeetupScreen.tsx:14` |
| RZ-M-E1a | ChatState untyped string | `ChatScreen.tsx:38` |
| RZ-M-E2a | Plan statuses raw strings | `MyPlansScreen.tsx:13` |
| RZ-M-E3 | Confirmation timestamps not shown | `PlanConfirmScreen.tsx:68` |
| RZ-M-B2 | Booking date whitespace | `MeetupScreen.tsx:161` |
| RZ-M-B3 | Coin conversion double-apply | `GiftInboxScreen.tsx:131` |
| RZ-M-B4 | partySize hardcoded 2 | `MeetupScreen.tsx:72` |
| RZ-M-R1 | Socket no failure handler | `useRealtimeChat.ts:53` |
| RZ-M-R2 | Typing indicator timing | `ChatScreen.tsx:88` |
| RZ-M-R3 | Socket loses messages | `useRealtimeChat.ts:47` |
| RZ-M-R4 | Socket errors swallowed | `useRealtimeChat.ts:91` |
| RZ-M-O1 | No offline queue | `ChatScreen.tsx:103` |
| RZ-M-O2 | Messages refetch on nav | `ChatScreen.tsx:32` |
| RZ-M-O3 | Global retry delay | `App.tsx:7` |
| RZ-M-S3 | JWT atob not in RN | `MatchesScreen.tsx:80` |
| RZ-M-S4 | Deep link no auth guard | `useDeepLink.ts:31` |
| RZ-M-U1 | Profile setup silent fail | `ProfileSetupScreen.tsx:36` |
| RZ-M-U2 | Chat no char count | `ChatScreen.tsx:196` |
| RZ-M-U3 | Share invite silent fail | `ProfileScreen.tsx:25` |
| RZ-M-U4 | Discover no error state | `DiscoverScreen.tsx:297` |
| RZ-M-P1a | Confetti not memoized | `DiscoverScreen.tsx:23` |
| RZ-M-P2 | relativeTime recreated | `MatchesScreen.tsx:46` |
| RZ-M-P3 | SwipeCard not memoized | `DiscoverScreen.tsx:173` |
| RZ-A-M1 | Stats null on 401 | `dashboard/page.tsx:108` |
| RZ-A-M2 | Gift filter partial data | `gifts/page.tsx:190` |
| RZ-A-M3 | Meetup filter no reset | `meetups/page.tsx:59` |
| RZ-A-M4 | Plan cancel failure | `plans/page.tsx:53` |
| RZ-A-M5 | expiresAt auto-overwrite | `coordinator/page.tsx:130` |
| RZ-A-M6 | window.location.href | `login/page.tsx:24` |
| RZ-A-M7 | TanStack Query unused | `layout.tsx` |
| RZ-A-M8 | API path inconsistency | `coordinator/page.tsx:121` |
| RZ-A-M9 | metadata in client component | `layout.tsx:6` |
| RZ-A-M10 | Hardcoded gift types | `gifts/page.tsx:219` |
| RZ-B-M1 | Plan worker no concurrency | `planWorkers.ts:24` |
| RZ-B-M2 | Booking-match Redis only | `MeetupService.ts:52` |
| RZ-B-M3 | Unmatch no cleanup | `MatchService.ts:157` |
| RZ-B-M4 | Coordinator gender | `admin.ts:363` |
| RZ-B-M5 | Inbox no pagination | `MessageRequestService.ts:141` |
| RZ-B-M6 | Trust decay memory | `trustDecayWorker.ts:23` |
| RZ-B-M7 | Silent notification fail | `PlanService.ts:361` |
| RZ-B-M8 | Redis sole source | `MeetupService.ts:52` |
| RZ-B-M9 | Vague accept error | `requests.ts:25` |
| RZ-B-M10 | Unnecessary DB re-fetch | `ExperienceCreditService.ts:70` |
| G-KS-M1 | Rate limit fail-open | `index.ts:39` |
| G-KS-M2 | NoSQL injection risk | `batchRoutes.ts:273` |
| G-KS-M3 | Duplicate const | `weeklyCapEngine.ts` |
| G-KS-M4 | Karma no validation | Multiple |
| G-KS-M5 | Kill switch wrong | `index.ts` |
| G-KS-M6 | Auto-checkout no EarnRecord | `engine.ts` |
| G-KS-M7 | Decay weekly not daily | `worker.ts` |
| G-KS-M8 | GPS discontinuous | `scoring.ts` |
| G-KS-M9 | ISO week mismatch | `scoring.ts` |
| G-KS-M10 | CSR non-atomic | `engine.ts` |
| G-KS-M11 | lastDecayAppliedAt any cast | `schema.ts` |
| G-KS-M12 | Missing compound index | `schema.ts` |
| G-KS-M13 | No batch scheduler lock | `scheduler.ts` |
| G-KS-M14 | Empty catch blocks | All files |
| G-KS-M15 | Return 0 on fail | `wallet.ts` |
| G-KU-M1 | totalHours wrong field | `event/[id].tsx` |
| G-KU-M2 | Booking status mismatch | `event/[id].tsx` |
| G-KU-M3 | Type still divergent | `karmaService.ts` |
| G-KU-M4 | No rapid debounce | Scan screen |
| G-KU-M5 | eventId stale | Karma screens |
| G-KU-M6 | Profile mismatch | `karmaService.ts` |
| G-KU-M7 | Empty catch blocks | Multiple |
| G-KU-M8 | No skeleton loaders | Event list/detail |
| G-KU-M9 | Confetti not memoized | Discover screen |
| G-KU-M10 | relativeTime recreated | Matches screen |
| G-KU-M11 | Chat state untyped | `ChatScreen.tsx` |
| G-KU-M12 | Status raw strings | `MyPlansScreen.tsx` |
| G-KU-M13 | Confirmation no timestamp | `PlanConfirmScreen.tsx` |

---

## Performance Issues (MEDIUM priority)

| ID | Codebase | Issue |
|----|----------|-------|
| M7 | Backend | Inbox has no pagination |
| M8 | Backend | Trust decay loads all profiles into memory |
| M1 | Rendez | Plan worker no concurrency |
| M5 | Rendez | Inbox no pagination |
| FE-M1 | Admin | AlertContext dead code |
| FE-M4 | Admin | 7+ orphan screens unreachable |
| FE-M9 | Admin | 95+ screens missing KeyboardAvoidingView |

---

## Data & Sync Issues (MEDIUM priority)

| ID | Codebase | Issue |
|----|----------|-------|
| CS-C3 | Backend | Gamification dedup key before wallet credit |
| SD-02 | Backend | 3 wallet fields zeroed on every write |
| SD-05 | Backend | Wallet transactions migration half-applied |
| D-1 | Rendez | Gift inbox query key mismatch |
| D-2 | Rendez | Gift catalog shared key |
| M4 | Rendez | Stats cached null on 401 |
| M2 | Admin | Gift filter badges partial data |

---

## Prevention Infrastructure Built in Phase 3

1. `src/utils/queryKeys.ts` — centralized query keys
2. `src/utils/socket.ts` — shared Socket.IO hook with reconnection
3. `src/utils/validateEnum.ts` — Zod enum validation
4. `packages/rez-ui` design tokens — shared color/spacing constants
5. `src/hooks/useDebounce.ts` — debounce for scan/typing inputs
