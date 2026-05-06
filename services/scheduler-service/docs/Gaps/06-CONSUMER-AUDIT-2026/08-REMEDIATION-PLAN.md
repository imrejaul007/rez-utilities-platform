# Remediation Plan — Consumer App Audit 2026-04-16

**69 total issues: 11 CRITICAL, 24 HIGH, 22 MEDIUM, 12 LOW**
**Root cause estimate: 35+ of 69 resolved by fixing 6 systemic diseases**

---

## Phase 0: Pre-flight — Fix Build Breaks (0-2 days)

> These issues prevent the app from compiling or starting. Fix first.

| ID | Gap | Fix | Effort | Owner |
|----|-----|-----|--------|-------|
| QW-CRIT-02 | NA-CRIT-06 | Import `showToast` in checkout.tsx | 5m | ? |
| QW-CRIT-04 | NA-MED-11 | Remove merge conflict in karmaRoutes.ts | 15m | ? |
| QW-HIGH-05 | NA-HIGH-10 | Create missing `utils/apiUtils.ts` | 1h | ? |
| NA-CRIT-04 | CRITICAL | Wire up `@/types/unified` — 7 files import non-existent type | 2h | ? |

**Exit Criteria:** `npm run build` succeeds without errors.

---

## Phase 1: Financial Integrity (Days 1-5)

> Payment flows, coin calculations, and financial race conditions. These directly cost money.

### 1.1 Payment Flow Hardening

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| QW-CRIT-01 | NA-CRIT-01 | Add onPress to payment method cards | 30m |
| QW-CRIT-03 | NA-CRIT-08 | Fix terminal state check ('paid' missing) | 10m |
| QW-CRIT-05 | NA-CRIT-09 | Replace Math.random() with uuid | 15m |
| NA-CRIT-07 | CRITICAL | Double-tap guard on payment submit | 1h |
| NA-CRIT-10 | CRITICAL | UPI payment — no-op path — wire up or remove | 1h |
| QW-HIGH-09 | NA-HIGH-07 | Integer arithmetic for redemption | 1h |
| QW-HIGH-03 | NA-HIGH-04 | Add Math.max(0) balance guard | 15m |
| QW-HIGH-06 | NA-HIGH-18 | Fix queue button disabled state | 1h |
| QW-MED-03 | NA-LOW-09 | Fix Luhn radix in paymentService | 5m |
| QW-LOW-02 | NA-LOW-06 | Remove duplicate Luhn from paymentService | 15m |

### 1.2 Coin Calculation Canonical Source

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| QW-HIGH-01 | NA-HIGH-01 | Remove double-division in rez-now checkout | 10m |
| QW-HIGH-02 | NA-HIGH-03, XREP-07 | Align karma coinType credit vs query | 30m |
| NA-HIGH-02 | HIGH | Replace flat formula with server-side preview API | 3h |
| NA-HIGH-08 | HIGH | Remove hardcoded day reward values | 1h |
| QW-HIGH-08 | XREP-05, NA-MED-13 | Use isoWeek consistently everywhere | 15m |
| QW-HIGH-07 | NA-MED-12 | Remove duplicate startOfWeek declaration | 5m |
| QW-LOW-03 | NA-LOW-07 | Standardize currency formatter | 30m |

### 1.3 Financial Race Conditions

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| QW-HIGH-04 | NA-HIGH-05 | Fix dedup key to millisecond resolution | 30m |
| NA-HIGH-06 | HIGH | Fix rewardsHook idempotency — two-phase commit | 2h |
| QW-MED-06 | NA-MED-19 | Debounce coin slider | 30m |

**Phase 1 Exit:** Payment flows have guards against double-submit, amounts are validated server-side, coin calculations are canonical or server-verified.

---

## Phase 2: Security Hardening (Days 6-12)

> Bill verification, fraud detection, and token storage. These are fraud vectors.

### 2.1 Bill Verification Security

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| NA-CRIT-02 | CRITICAL | Server-authoritative bill amount — remove client control | 4h |
| QW-HIGH-19 | NA-HIGH-19 | Replace MD5 with SHA-256 for image integrity | 1h |
| QW-HIGH-20 | NA-HIGH-20 | Add userId ownership checks (IDOR fix) | 2h |
| QW-HIGH-22 | NA-HIGH-22 | Change fraud detection to fail-closed | 3h |
| QW-HIGH-23 | NA-HIGH-23 | HMAC-signed device fingerprint | 2h |
| NA-MED-21 | MEDIUM | Fix perceptual hash similarity scoring | 3h |
| QW-CRIT-05 | NA-CRIT-03 | Replace `new Blob()` with TextEncoder (RN compat) | 1h |

### 2.2 Token & Auth Security

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| QW-HIGH-21 | NA-HIGH-21 | Move tokens from localStorage to httpOnly cookies | 2h |
| NA-CRIT-11 | CRITICAL | Encrypt wallet balance in AsyncStorage | 1h |
| QW-MED-05 | NA-LOW-08 | Implement isTokenValid() or remove | 20m |

**Phase 2 Exit:** Bill amount is server-authoritative, image integrity uses SHA-256, fraud detection fails closed, tokens are in httpOnly cookies, device fingerprints are server-signed.

---

## Phase 3: Architecture & Type Safety (Days 13-22)

> Shared types, Zustand/Context consolidation, and circuit breakers.

### 3.1 Shared Types Wiring

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| SYS-ROOT-01 | CRITICAL | Add @karim4987498/shared to rez-now deps | 2h |
| XREP-04 | CRITICAL | Replace all local types in rez-now with imports | 4h |
| XREP-01 | HIGH | Canonical WalletBalance in shared | 1h |
| XREP-02 | HIGH | Canonical OrderStatus in shared | 1h |
| XREP-06 | MEDIUM | Canonical PaymentStatus | 1h |
| XREP-11 | HIGH | KarmaProfile → IKarmaProfile alignment | 1h |
| XREP-14 | LOW | CoinTransactionType mapping | 1h |
| XREP-15 | MEDIUM | BookingStatus alignment | 1h |
| XREP-16 | LOW | Add userTimezone to KarmaProfile schema | 1h |

### 3.2 Enum & Normalizer Consolidation

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| SYS-ROOT-06 | HIGH | Extract all shared enums to rez-shared/enums/ | 2h |
| XREP-03 | MEDIUM | Unify normalizeLoyaltyTier (choose: diamond tier or alias) | 1h |
| XREP-09 | CRITICAL | normalizePaymentStatus everywhere | 1h |
| XREP-10 | MEDIUM | Lowercase AddressType everywhere | 1h |
| XREP-12 | HIGH | Canonical CoinType ('branded' vs 'branded_coin') | 1h |

### 3.3 State Management Consolidation

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| SYS-ROOT-04 | HIGH | Consolidate Zustand + Context → ONE source | 16h |
| QW-HIGH-12 | NA-HIGH-12 | Wallet store + context → single source | 4h |
| NA-MED-04 | MEDIUM | Deprecate realTimeService → SocketContext | 2h |

### 3.4 Resilience & Performance

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| SYS-ROOT-05 | HIGH | Circuit breaker pattern (3 fails → 60s fast-fail) | 8h |
| QW-HIGH-15 | NA-HIGH-15 | Add timeout/retry/Sentry to hotelOtaApi | 30m |
| NA-MED-16 | MEDIUM | Change default timeout 30s → 8s | 1h |
| QW-HIGH-16 | NA-HIGH-16 | Replace silent error swallowing with reporting | 4h |
| NA-MED-18 | MEDIUM | Memoize checkout page (609 lines) | 2h |
| NA-MED-06 | MEDIUM | Add sequence numbers to socket messages | 2h |

### 3.5 Type Safety

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| QW-HIGH-14 | NA-HIGH-14 | Replace 56 `any` types with strict interfaces | 8h |
| QW-HIGH-24 | NA-HIGH-24 | Split selectors.ts into per-store files | 2h |
| NA-HIGH-11 | HIGH | Delete deprecated service files | 2h |

**Phase 3 Exit:** All repos import from shared, enums are canonical, state has a single source of truth, all services have circuit breakers and sensible timeouts.

---

## Phase 4: Data Sync & UX Polish (Days 23-30)

> Real-time sync, offline handling, and UI feedback.

### 4.1 Real-time & Sync

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| QW-MED-01 | NA-MED-01 | Fix socket reconnection (use socketRef vs socketState) | 1h |
| NA-MED-02 | MEDIUM | 3 coin sources → single sync-status endpoint | 3h |
| NA-MED-03 | MEDIUM | Offline queue persistence with error events | 2h |
| QW-MED-01 | NA-LOW-04 | clearInterval in usePoints.ts | 10m |
| QW-MED-02 | NA-LOW-05 | removeEventListener in creator-apply.tsx | 10m |

### 4.2 UX Improvements

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| NA-MED-05 | MEDIUM | OfflineBanner component | 1h |
| QW-HIGH-10 | NA-MED-17 | Haptic feedback on flash-sale/deal success | 30m |
| QW-LOW-04 | NA-LOW-01 | Create CopyButton component | 1h |
| QW-HIGH-10 | NA-MED-19 | Debounce coin slider | 30m |
| QW-MED-04 | NA-MED-07 | Lowercase AddressType | 15m |
| QW-LOW-01 | NA-LOW-10 | Debounce CoinTogglesSection | 30m |

### 4.3 Validation & Error Handling

| ID | Gap | Fix | Effort |
|----|-----|-----|--------|
| QW-HIGH-17 | NA-HIGH-17 | Consistent validateAmount utility | 1h |
| NA-MED-20 | MEDIUM | sanitizeNumber returns ValidationResult | 1h |
| QW-MED-04 | NA-MED-20 | ValidateResult for amount input | 30m |

**Phase 4 Exit:** Socket reconnections work after token refresh, offline queue persists reliably, all screens have proper loading/error/feedback states.

---

## Phase 5: Systemic Root Fixes (Days 31-45)

> The 6 architectural diseases that generate 35+ of the 69 issues.

| Root | Issues | Fix | Effort |
|------|--------|-----|--------|
| SYS-ROOT-01: rez-now disconnected | 5+ | Add @karim4987498/shared + replace all local types | 8h |
| SYS-ROOT-02: No canonical coin calc | 6+ | coinCalculationService in rez-shared | 4h |
| SYS-ROOT-03: Client trusts itself | 6+ | Server-authoritative security decisions | 12h |
| SYS-ROOT-04: Dual store+context | 6+ | ONE source per data type | 16h |
| SYS-ROOT-05: No circuit breaker | 5+ | Centralized apiClient + circuit breakers | 8h |
| SYS-ROOT-06: Enum fragmentation | 7+ | rez-shared/enums/ as canonical source | 6h |

**Total systemic: ~54 hours**

---

## Resource Summary

| Phase | Issues Addressed | Estimated Hours | Duration |
|-------|-----------------|---------------|---------|
| Phase 0: Pre-flight | 4 | 3.5h | 0-2 days |
| Phase 1: Financial | 18 | 12h | Days 1-5 |
| Phase 2: Security | 11 | 20h | Days 6-12 |
| Phase 3: Architecture | 25 | 55h | Days 13-22 |
| Phase 4: Sync & UX | 12 | 14h | Days 23-30 |
| Phase 5: Systemic Roots | 35+ | 54h | Days 31-45 |
| **Total** | **69 + systemic** | **~159 hours** | **~9 weeks** |

---

## Immediate Actions (Before End of Day)

1. **NA-CRIT-06** — Add `showToast` import to `checkout.tsx` (5 minutes)
2. **NA-MED-11** — Remove merge conflict markers in `karmaRoutes.ts` (15 minutes)
3. **NA-CRIT-08 / XREP-09** — Add `'paid'` to payment terminal state check (10 minutes)
4. **NA-CRIT-09** — Replace `Math.random()` with `uuid` (15 minutes)
5. **NA-CRIT-01** — Add `onPress` to payment method cards (30 minutes)

---

## Risk & Dependencies

| Risk | Mitigation |
|------|-----------|
| Bill amount server-authoritative change requires backend API change | Coordinate with payment service team before Phase 2 |
| Shared types changes may break consumers | Incremental: add aliases first, deprecate later |
| Circuit breaker may break existing retry logic | Wrap existing retries, don't remove until tested |
| Token storage change (httpOnly cookies) requires backend support | Coordinate with auth service team |
| SYS-ROOT-04 (Zustand/Context) is 16h with high refactor risk | Do in Phase 5 after other phases stabilize |

---

## Governance

- Fitness tests in `.github/workflows/arch-fitness.yml` run on every PR
- No new bespoke enums allowed (lint rule enforced)
- No new `any` types allowed in store files
- All financial calculations must use the canonical service or server-verified
- All security decisions must be server-authoritative (enforced in code review)
