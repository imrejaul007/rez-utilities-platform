# CROSS-REFERENCE MATRIX — All Bugs to All Audits

**Generated:** 2026-04-16
**Purpose:** Maps every bug ID to every source audit it appears in

---

## How to Read This Matrix

- **Rows** = unique bug descriptions
- **Columns** = audit source/generation
- **Cell value** = the bug ID used in that specific audit
- **"—"** = not found in that audit
- **Bold** = CRITICAL severity in that audit
- Duplicates across audits are the most important rows to fix first

---

## Master Cross-Reference: CRITICAL Issues

| Bug Description | STAYOWN | Consumer-2026 | Karma | Forensic | Admin | Merchant | Rendez | AdBazaar | NoW |
|----------------|---------|--------------|-------|---------|-------|---------|--------|----------|-----|
| Duplicate const startOfWeek | P0-KARMA-001 | NA-HIGH-12 | G-KS-B1, G-KS-C7 | F001-C17 | — | — | — | — | — |
| PaymentMachine in-memory | FE-PAY-001 | — | — | F001-C9 | A10-C4 | CS-M1 | — | — | — |
| Payment status mismatch | FE-PAY-002 | NA-CRIT-08 | — | — | A10-C4 | G-MA-H02 | — | — | — |
| OTP brute-force | BE-MER-OTP-001 | — | — | — | — | G-MA-C6 | — | — | — |
| SSRF auth bypass | SEC-KARMA-SSRF-001 | — | G-KS-C2 | F001-C4 | — | — | — | — | — |
| Bank details plaintext | SEC-MER-SENS-001 | — | — | — | — | — | — | AB-C3 | — |
| MongoDB injection | SEC-MER-INJECT-001 | — | — | — | — | G-MA-C5 | — | — | — |
| HMAC key env var | CS-S1 | — | — | F001-C11 | A10-C5 | — | — | — | — |
| SSE no ownership | CS-S4 | — | — | — | A10-C6 | — | — | — | — |
| Order status fragmented | F001-C13 | — | — | F001-C13 | — | CS-E19 | — | — | — |
| KarmaEvent type drift | NA-HIGH-03 | NA-HIGH-03 | G-KU-C3 | — | — | — | — | — | — |
| CoinType mismatch | CS-E15 | — | G-KU-H2 | — | — | — | — | — | — |
| Week boundary | CS-E18 | — | G-KS-B7 | — | — | — | — | — | — |
| Math.random() | NA-CRIT-09 | NA-CRIT-09 | — | — | — | — | — | — | NW-CRIT-001 |
| Wallet in AsyncStorage | NA-CRIT-11 | NA-CRIT-11 | — | — | — | — | — | — | — |
| Dedup key collision | CS-M9 | NA-HIGH-05 | — | — | — | — | — | — | — |
| Rewards hook drop | CS-M10 | NA-HIGH-06 | — | F001-C15 | — | — | — | — | — |
| Float precision | FE-PAY-003 | NA-HIGH-07 | — | — | — | — | — | — | — |
| Biometric bypass | CS-S-M2 | — | — | — | — | G-MA-C6 | — | — | — |
| Payment webhook race | RZ-B-C2 | — | — | — | — | — | RZ-B-C2 | — | — |
| Gift voucher auth | RZ-B-C1 | — | — | — | — | — | RZ-B-C1 | — | — |
| Socket read_receipt | RZ-B-C4 | — | — | — | — | — | RZ-B-C4 | — | — |
| rez_user_id spoofable | AB-C1 | — | — | — | — | — | — | AB-C1 | — |
| Payment amount not verified | AB-C5 | NA-CRIT-02 | — | — | — | — | — | AB-C5 | — |
| Idempotency missing | AB-C4 | — | — | — | A10-H12 | — | — | AB-C4 | — |
| normalizeLoyaltyTier | CS-E12 | — | — | F001-C16 | — | — | — | — | — |
| KarmaProfile drift | G-KU-H1 | — | G-KU-H1 | — | — | — | — | — | — |
| settle merchant vs merchantId | F001-C1 | — | — | F001-C1 | — | — | — | — | — |
| Merchant withdrawal TOCTOU | F001-C3 | — | — | F001-C3 | — | — | — | — | — |
| Karma 2x inflation | F001-C5 | — | G-KS-B10 | F001-C5 | — | — | — | — | — |
| Admin cron consumer auth | F001-C6 | — | — | F001-C6 | — | — | — | — | — |
| FraudFlag missing | F001-C7 | — | — | F001-C7 | — | — | — | — | — |
| Firebase JSON on disk | F001-C12 | — | — | F001-C12 | — | — | — | — | — |
| Finance silent failure | F001-C15 | — | — | F001-C15 | — | — | — | — | — |
| JWT verify no alg whitelist | CS-S2 | — | — | — | A10-H9 | — | — | — | — |
| Redis fail-open | CS-S3 | — | — | — | — | — | — | — | — |
| IDOR on order detail | CS-S-M1 | — | — | — | — | G-MA-C5 | — | — | — |
| @/types/unified missing | NA-CRIT-04 | NA-CRIT-04 | — | — | — | — | — | — | — |
| showToast not imported | NA-CRIT-06 | NA-CRIT-06 | — | — | — | — | — | — | — |
| Double-tap no guard | NA-CRIT-07 | NA-CRIT-07 | — | — | — | — | — | — | — |
| new Blob() crash | NA-CRIT-03 | NA-CRIT-03 | — | — | — | — | — | — | — |
| UPI payment silent no-op | NA-CRIT-10 | NA-CRIT-10 | — | — | — | — | — | — | — |
| QR check-in no scan code | NA-CRIT-05 | NA-CRIT-05 | — | — | — | — | — | — | — |
| Payment verification hardcoded | NW-CRIT-002 | — | — | — | — | — | — | — | NW-CRIT-002 |
| Merchant panel no auth | NW-CRIT-003 | — | — | — | — | — | — | — | NW-CRIT-003 |
| Tokens in localStorage | NW-CRIT-014 | NA-HIGH-21 | — | — | — | — | — | — | NW-CRIT-014 |
| Batch stats unauthenticated | G-KS-C5 | — | G-KS-C5 | — | — | — | — | — | — |
| QR secret hardcoded | G-KS-C1 | — | G-KS-C1 | — | — | — | — | — | — |
| jwtSecret unvalidated | G-KS-C3 | — | G-KS-C3 | — | — | — | — | — | — |
| Horizontal privilege escalation | G-KS-C4 | — | G-KS-C4 | — | — | — | — | — | — |
| TimingSafeEqual length bypass | G-KS-C6 | — | G-KS-C6 | — | — | — | — | — | — |
| Auto-checkout no EarnRecord | G-KS-B4 | — | G-KS-B4 | — | — | — | — | — | — |
| offline idempotency key after INSERT | CS-M12 | — | — | — | — | G-MA-C08 | — | — | — |
| failed offline bills removed | CS-M13 | — | — | — | — | G-MA-C09 | — | — | — |
| batch sync partial failure | CS-M14 | — | — | — | — | G-MA-C10 | — | — | — |
| coin redemption not in POS payload | CS-M15 | — | — | — | — | G-MA-C02 | — | — | — |
| offline bill loses coin discount | CS-M16 | — | — | — | — | G-MA-C03 | — | — | — |

---

## Master Cross-Reference: HIGH Issues

| Bug Description | Consumer-2026 | Karma | Forensic | Admin | Merchant | Rendez | AdBazaar | NoW |
|----------------|--------------|-------|---------|-------|---------|--------|----------|-----|
| Rewards preview 50% inaccurate | NA-HIGH-02 | — | — | — | — | — | — | — |
| karma credits 'rez' queries 'karma_points' | NA-HIGH-03 | G-KU-H2 | — | — | — | — | — | — |
| Dedup key 1-sec collision | NA-HIGH-05 | — | — | — | CS-M9 | — | — | — |
| Rewards hook idempotency drop | NA-HIGH-06 | — | F001-C15 | — | CS-M10 | — | — | — |
| Floating-point truncation | NA-HIGH-07 | — | — | — | — | — | — | — |
| Hardcoded day rewards | NA-HIGH-08 | — | — | — | — | — | — | — |
| Leaderboard rank off-by-one | NA-HIGH-09 | — | — | — | — | — | — | — |
| Missing apiUtils.ts | NA-HIGH-10 | — | — | — | — | — | — | — |
| Duplicate service pairs | NA-HIGH-11 | — | — | — | — | — | — | — |
| Wallet store + context conflict | NA-HIGH-12 | — | — | — | — | — | — | — |
| Duplicate coin calc 4+ locations | NA-HIGH-13 | — | — | — | — | — | — | — |
| 56 any types | NA-HIGH-14 | — | — | — | — | — | — | — |
| hotelOtaApi bypasses infra | NA-HIGH-15 | — | — | — | — | — | — | — |
| Silent error swallowing | NA-HIGH-16 | G-KU-H5 | — | — | — | — | — | — |
| Inconsistent 0-amount | NA-HIGH-17 | — | — | — | — | — | — | — |
| Queue button disabled | NA-HIGH-18 | — | — | — | — | — | — | — |
| MD5 for integrity hash | NA-HIGH-19 | — | — | — | — | — | — | — |
| IDOR on bill/transaction | NA-HIGH-20 | — | — | — | — | — | — | — |
| Auth tokens localStorage | NA-HIGH-21 | — | — | — | — | — | — | NW-CRIT-014 |
| Client fraud fail-open | NA-HIGH-22 | — | — | — | — | — | — | — |
| Device fingerprint AsyncStorage | NA-HIGH-23 | — | — | — | — | — | — | — |
| Circular store imports | NA-HIGH-24 | — | — | — | — | — | — | — |
| Token blacklist fail-open | SEC-AUTH-REDIS-FAIL-001 | — | — | — | — | — | — | — |
| Monolith webhook no verify | FE-PAY-013 | — | — | — | — | — | — | — |
| Math.random() payment IDs | Multiple | — | — | — | — | — | — | NW-CRIT-001 |
| Wallet service URL default | FE-PAY-MISC | — | — | — | — | — | — | — |
| Coin formula factor 10 | — | — | — | — | — | — | — | NW-HIGH-001 |
| Missing mutation invalidation | — | — | — | A10-H1 | — | — | — | — |
| Duplicate CoinDrop types | — | — | — | A10-H2 | — | — | — | — |
| StatusFilter missing 'pending' | — | — | — | A10-H4 | — | — | — | — |
| Payment status colors 7 missing | — | — | — | A10-H5 | — | — | — | — |
| 3 normalizeOrderStatus | — | — | — | A10-H6 | — | — | — | — |
| FSM invalid dispatch→deliver | — | — | — | A10-H7 | — | — | — | — |
| Live monitor missing labels | — | — | — | A10-H8 | — | — | — | — |
| JWT alg:none not mitigated | — | — | — | A10-H9 | — | — | — | — |
| Platform settings no role guard | — | — | — | A10-H10 | — | — | — | — |
| Socket null auth on web | — | — | — | A10-H11 | — | — | — | — |
| Wallet mutations no idempotency | — | — | — | A10-H12 | — | — | — | — |
| Infinity amount validation | — | — | — | A10-H13 | — | — | — | — |
| 82 identical service files | — | — | — | A10-H14 | — | — | — | — |
| Inconsistent stale times | — | — | — | A10-H15 | — | — | — | — |
| Two hasRole implementations | — | — | — | A10-H16 | — | — | — | — |
| roleHierarchy not synced | — | — | — | A10-H17 | — | — | — | — |
| Payment filter 'completed' vs 'paid' | — | — | — | — | G-MA-H02 | — | — | — |
| Cashback no upper bound | — | — | — | — | G-MA-H03 | — | — | — |
| Withdrawal unit paise/rupees | — | — | — | — | G-MA-H04 | — | — | — |
| Wallet balance unit unclear | — | — | — | — | G-MA-H05 | — | — | — |
| Discount % not capped 100% | — | — | — | — | G-MA-H06 | — | — | — |
| Coin award no integer check | — | — | — | — | G-MA-H07 | — | — | — |
| Withdrawal zero-padding | — | — | — | — | G-MA-H08 | — | — | — |
| isNaN fails on Infinity | — | — | — | — | G-MA-H09 | — | — | — |
| SKU validation fail-open | — | — | — | — | G-MA-H10 | — | — | — |
| Offline sync timeout ignored | — | — | — | — | G-MA-H11 | — | — | — |
| Ping interval accumulation | — | — | — | — | G-MA-H12 | — | — | — |
| Socket reconnecting not shown | — | — | — | — | G-MA-H13 | — | — | — |
| Socket subscriptions not restored | — | — | — | — | G-MA-H14 | — | — | — |
| Socket gives up silently | — | — | — | — | G-MA-H15 | — | — | — |
| Offline queue no dedup | — | — | — | — | G-MA-H16 | — | — | — |
| DLQ unbounded | — | — | — | — | G-MA-H17 | — | — | — |
| Permissions dedup flag not reset | — | — | — | — | G-MA-H18 | — | — | — |
| Dashboard join swallows errors | — | — | — | — | G-MA-H19 | — | — | — |
| Buffering flag not cleared | — | — | — | — | G-MA-H20 | — | — | — |
| Sync no internet check | — | — | — | — | G-MA-H21 | — | — | — |
| OrderStatus 4+ files different | — | — | — | — | G-MA-H28 | — | — | — |
| PaymentStatus wrong whitelist | — | — | — | — | G-MA-H29 | — | — | — |
| CashbackStatus missing values | — | — | — | — | G-MA-H30 | — | — | — |
| Client FSM not synced backend | — | — | — | — | G-MA-H31 | — | — | — |
| OrderFilters 3x definitions | — | — | — | — | G-MA-H32 | — | — | — |
| 'viewer' role in schema not type | — | — | — | — | G-MA-H33 | — | — | — |
| Analytics fallback wrong keys | — | — | — | — | G-MA-H34 | — | — | — |
| Status normalization 7x | — | — | — | — | G-MA-H35 | — | — | — |
| CashbackRequest 3x definitions | — | — | — | — | G-MA-H36 | — | — | — |
| Product type 3x definitions | — | — | — | — | G-MA-H37 | — | — | — |
| PaymentStatus 3x definitions | — | — | — | — | G-MA-H38 | — | — | — |
| No wallet balance check gift | — | — | — | — | — | RZ-M-P1 | — | — |
| Gift send no balance invalidate | — | — | — | — | — | RZ-M-F2 | — | — |
| Confirm modal before mutation | — | — | — | — | — | RZ-M-F5 | — | — |
| Query key mismatch gift inbox | — | — | — | — | — | RZ-M-D1 | — | — |
| parseInt age sends NaN | — | — | — | — | — | RZ-M-B1 | — | — |
| Credit invalidation incorrect | — | — | — | — | — | RZ-M-A2 | — | — |
| Age input non-numeric paste | — | — | — | — | — | RZ-M-E2 | — | — |
| deletePhoto never called | — | — | — | — | — | RZ-M-X1 | — | — |
| Meetup date not validated | — | — | — | — | — | RZ-M-B5 | — | — |
| ProfileEdit age never sent | — | — | — | — | — | RZ-M-B8 | — | — |
| HMAC recomputed inline | — | — | — | — | — | RZ-B-H1 | — | — |
| 7 plan routes no ID validation | — | — | — | — | — | RZ-B-H2 | — | — |
| Reward fire-and-forget | — | — | — | — | — | RZ-B-H3 | — | — |
| Redis lock expires during reward | — | — | — | — | — | RZ-B-H4 | — | — |
| Gift expired always returns 200 | — | — | — | — | — | RZ-B-H5 | — | — |
| REZ API after DB commit | — | — | — | — | — | RZ-B-H6 | — | — |
| Unnecessary type cast | — | — | — | — | — | RZ-B-H7 | — | — |
| BlockUser no Message cleanup | — | — | — | — | — | RZ-B-B1 | — | — |
| Referral no distributed lock | — | — | — | — | — | RZ-B-B2 | — | — |
| Referral applyCode no profile check | — | — | — | — | — | RZ-B-B3 | — | — |
| KarmaProfile canonical drift | — | G-KU-H1 | — | — | — | — | — | — |
| CoinType 3-way mismatch | — | G-KU-H2 | — | — | — | — | — | — |
| No rapid-scan debounce | — | G-KU-H3 | — | — | — | — | — | — |
| eventId stale on navigation | — | G-KU-H4 | — | — | — | — | — | — |
| EarnRecord status fallback | — | G-KU-H6 | — | — | — | — | — | — |
| Booking empty object | — | G-KU-H7 | — | — | — | — | — | — |
| Duplicate startOfWeek const | — | G-KS-B1 | — | — | — | — | — | — |
| No karma input validation | — | G-KS-B2 | — | — | — | — | — | — |
| Kill switch wrong status | — | G-KS-B3 | — | — | — | — | — | — |
| Auto-checkout no EarnRecord | — | G-KS-B4 | — | — | — | — | — | — |
| Decay worker weekly not daily | — | G-KS-B5 | — | — | — | — | — | — |
| GPS score discontinuous | — | G-KS-B6 | — | — | — | — | — | — |
| Mixed week boundaries | — | G-KS-B7 | — | — | — | — | — | — |
| CSR pool non-atomic | — | G-KS-B8 | — | — | — | — | — | — |
| createEarnRecord bypasses addKarma | — | G-KS-B9 | — | — | — | — | — | — |
| eventsCompleted double-increment | — | G-KS-B10 | — | — | — | — | — | — |
| eventsJoined never incremented | — | G-KS-B11 | — | — | — | — | — | — |
| avgEventDifficulty never updated | — | G-KS-B12 | — | — | — | — | — | — |
| WEEKLY_COIN_CAP hardcoded | — | G-KS-B13 | — | — | — | — | — | — |
| Coin formula factor 10 | — | — | — | — | — | — | — | NA-HIGH-01 |
| Catalog placeholders no-ops | — | — | — | — | — | — | — | NW-HIGH-001 |
| applyCode undefined function | — | — | — | — | — | — | — | NW-HIGH-002 |
| ReservationSuggestion wrong endpoint | — | — | — | — | — | — | — | NW-HIGH-003 |
| Auth refresh queue swallows | — | — | — | — | — | — | — | NW-HIGH-004 |
| BillStatus lowercase/uppercase | — | — | — | — | — | — | — | NW-HIGH-005 |
| Reconcile double-division | — | — | — | — | — | — | — | NW-HIGH-006 |
| redeemStamps no idempotency | — | — | — | — | — | — | — | NW-HIGH-007 |
| Coupon client-side only | — | — | — | — | — | — | — | NW-HIGH-008 |
| Client-side prices manipulatable | — | — | — | — | — | — | — | NW-HIGH-009 |
| WaiterCallStatus wrong field | — | — | — | — | — | — | — | NW-HIGH-010 |
| Pay-display dedup stale closure | — | — | — | — | — | — | — | NW-HIGH-011 |
| OrderHistoryItem 2x definitions | — | — | — | — | — | — | — | NW-HIGH-012 |
| CancelOrder endpoint inconsistency | — | — | — | — | — | — | — | NW-HIGH-013 |
| verifyPayment no idempotency | — | — | — | — | — | — | — | NW-HIGH-014 |
| pending_payment not in STATUS_STEPS | — | — | — | — | — | — | — | NW-HIGH-015 |
| Coin type normalization lost | HIGH-010 | — | — | — | — | — | — | — |
| Loyalty tier 'DIMAOND' typo | HIGH-011 | — | — | — | — | — | — | — |
| Payment hardcoded coin cap | HIGH-012 | — | — | — | — | — | — | — |
| Authorized state no inbound path | HIGH-013 | — | — | — | — | — | — | — |
| Search paths not routed gateway | HIGH-014 | — | — | — | — | — | — | — |
| 40+ Schema.Types.Mixed models | HIGH-015 | — | — | — | — | — | — | — |
| Payment secret in body | HIGH-001 | — | — | — | — | — | — | — |
| Non-atomic wallet credit | HIGH-002 | — | — | — | — | — | — | — |
| Legacy token incompatibility | HIGH-003 | — | — | — | — | — | — | — |
| Frontend/backend count mismatch | — | — | — | — | — | RZ-A-H1 | — | — |
| No pagination — 100 cap | — | — | — | — | — | RZ-A-H2 | — | — |
| Every fetch no response.ok | — | — | — | — | — | RZ-A-H3 | — | — |
| Dashboard localStorage auth | — | — | — | — | — | RZ-A-H4 | — | — |
| Vouchers to ineligible users | — | — | — | — | — | RZ-A-H5 | — | — |
| Real-time not connected | — | — | — | — | — | RZ-A-H6 | — | — |
| Booking status colors wrong | — | — | — | — | — | RZ-A-H7 | — | — |

---

## Coverage Summary by Audit

| Audit | CRITICALs Found | HIGHs Found | MEDIUMs Found | Total |
|-------|---------------|------------|--------------|-------|
| STAYOWN (Gen 14) | 6 | 9 | 13+ | 28+ |
| Consumer Audit 2026 (Gen 11) | 11 | 24 | 22 | 57 |
| FORENSIC-001 (Gen 13) | 17 | 15 | 20 | 52 |
| ReZ NoW (Gen 12) | 14 | 15 | 35 | 64 |
| AdBazaar (Gen 10) | 9 | 11 | 11 | 31 |
| ReZ Admin (Gen 10) | 8 | 17 | 20 | 45 |
| Merchant App (Gen 10) | 14 | 38 | 56 | 108 |
| Rendez Backend (Gen 9) | 4 | 10 | 10 | 24 |
| Rendez App (Gen 9) | 5 | 10 | 20 | 35 |
| Karma Service (Gen 8) | 10 | 9 | 19 | 38 |
| Karma UI (Gen 8) | 3 | 7 | 7 | 17 |
| Cross-Service (Gen 8-13) | 12 | 20 | 25 | 57 |
| Payment/Financial (standalone) | 5 | 8 | 4 | 17 |
| Real-Time Sync (standalone) | 4 | 6 | 8 | 18 |
| ReZ Consumer App (Gen 1-7) | 26 | 103 | 375 | 504 |
| ReZ Merchant App (Gen 1-7) | 14 | 49 | 258 | 321 |
| ReZ Admin App (Gen 1-7) | 25 | 84 | 153 | 262 |

---

## Key Insights

### 1. Same Bugs Found Across Multiple Audits

~40% of bugs appear in 2+ audits under different IDs. The most-frequently-replicated bugs:

| Bug | Found In | Fix Impact |
|-----|---------|-----------|
| Payment status 'completed' vs 'paid' | 5 audits | Fix once, resolve 5 IDs |
| HMAC key from env var name | 3 audits | Fix once, resolve 3 IDs |
| Duplicate const startOfWeek | 5 audits | Fix once, resolve 5 IDs |
| Offline idempotency issues | 4 audits | Fix once, resolve 4 IDs |
| Type/enum fragmentation | ALL audits | Ongoing — needs canonical package |

### 2. Root Causes by Audit Generation

| Generation | Most Common Root Cause |
|------------|----------------------|
| Gen 1-7 (early) | In-memory state, no transactions |
| Gen 8 (Karma) | Fire-and-forget, missing validation |
| Gen 9 (Rendez) | Missing auth checks, race conditions |
| Gen 10 (Admin/Merchant) | Type duplication, cache invalidation |
| Gen 11 (Consumer 2026) | Client-controlled financial data |
| Gen 12 (NoW) | Missing idempotency, enum drift |
| Gen 13 (Forensic) | Silent failures, no DLQ |

### 3. Fix Leverage

One fix in a shared package resolves bugs across multiple apps:

| Fix Location | Resolves |
|-------------|---------|
| `@rez/shared-types` enum package | 15+ enum/type bugs |
| `rez-shared/idempotency` | 10+ dedup bugs |
| `rez-shared/cache` (TanStack Query hooks) | 8+ invalidation bugs |
| `BullMQ + DLQ` pattern | 8+ fire-and-forget bugs |
| `Zod` at API boundaries | 12+ type mismatch bugs |

---

**Last Updated:** 2026-04-16
