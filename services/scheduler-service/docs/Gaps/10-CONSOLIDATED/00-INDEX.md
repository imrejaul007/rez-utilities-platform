# CONSOLIDATED MASTER ERROR LIST — ALL AUDITS

**Generated:** 2026-04-17
**Scope:** ALL codebases — 14 audit generations
**Total Issues:** 2,735+ across all repos and services

---

## Master Count

| Source | CRITICAL | HIGH | MEDIUM | LOW | Total |
|--------|----------|------|--------|-----|-------|
| **STAYOWN Round 2 (Gen 12)** | 5 | 11 | 18 | 10 | **44** |
| **STAYOWN (current session)** | 6 | 9 | 13+ | 10+ | 82+ |
| **Consumer App Audit 2026 (Gen 11)** | 11 | 24 | 22 | 12 | **81** |
| **FORENSIC-001 Backend Audit (Gen 13)** | 17 | 15 | 20 | 8 | **60** |
| **ReZ NoW (Gen 12)** | 14 | 15 | 47 | 44 | **120** |
| **RestoPapa Gen 14** | 15 | 23 | 30 | 17 | **85** |
| **AdBazaar (Gen 10)** | 9 | 11 | 11 | 7 | **38** |
| **ReZ Admin App (Gen 10)** | 8 | 17 | 20 | 8 | **53** |
| **Merchant App Gen 10** | 14 | 38 | 62 | 102 | **216** |
| **Rendez Backend (Gen 9)** | 4 | 7 | 12 | 8 | **31** |
| **Rendez App (Gen 9)** | 5 | 8 | 32 | 13 | **58** |
| **Karma Service (Gen 8)** | 10 | 8 | 19 | 6 | **43** |
| **Karma UI (Gen 8)** | 3 | 7 | 17 | 3 | **30** |
| **Rendez Admin (Gen 10)** | 10 | 19 | 19 | 14 | **62** |
| **ReZ Consumer App (Gen 1-7)** | 26 | 103 | 375 | 55 | **559** |
| **ReZ Merchant App (Gen 1-7)** | 14 | 49 | 258 | 29 | **350** |
| **ReZ Admin App (Gen 1-7)** | 25 | 84 | 153 | 59 | **321** |
| **ReZ Backend (Gen 1-7)** | 13 | 59 | 281 | 80 | **434** |
| **Cross-Service (Gen 8-13)** | 12 | 20 | 25 | 10 | **67** |
| **TOTAL** | **221** | **527** | **1,432** | **555** | **2,735+** |

> Note: ~20 bugs reclassified as MISJUDGMENT. ~70 deferred pending product decisions. ~200 genuinely new across all audits.

---

## Files in This Folder

| File | Description |
|------|-------------|
| `00-INDEX.md` | This file — master count and navigation |
| `CRITICAL-MASTER.md` | All CRITICAL bugs consolidated from all sources (~81) |
| `HIGH-MASTER.md` | All HIGH bugs consolidated from all sources (~157) |
| `MEDIUM-MASTER.md` | All MEDIUM bugs consolidated from all sources (~272) |
| `LOW-MASTER.md` | All LOW bugs consolidated from all sources (~244) |
| `CROSS-REF-MATRIX.md` | Which bugs map to which audits |
| `CROSS-SERVICE-MASTER.md` | Cross-repo issues that appear in multiple places |
| `DUPLICATE-MASTER.md` | Same bug appearing under different IDs in different audits |
| `SOLUTION-PLAN-MASTER.md` | Unified fix priority plan across all codebases |
| `../11-STAYOWN-ROUND2/` | 44 new findings from fresh audit (2026-04-17) — CRITICAL through LOW |

---

## CRITICAL Bugs — Consolidated Priority List

### FIRE IMMEDIATELY (Production Impact)

| Priority | ID | Title | Source | Fix Effort |
|---------|----|-------|--------|-----------|
| 1 | P0-KARMA-001 | Duplicate `const startOfWeek` — karma service dead | STAYOWN + F001-C17 + G-KS-B1 | 5 min |
| 2 | FE-PAY-001 | Monolith webhook no event deduplication | STAYOWN + F001-C9 + CS-M1 | 30 min |
| 3 | FE-PAY-002 | PaymentMachine in-memory — no cross-request protection | STAYOWN + A10-C4 + CS-M1 | 30 min |
| 4 | BE-MER-OTP-001 | OTP brute-force — merchant accounts hackable | STAYOWN + G-MA-C6 | 30 min |
| 5 | SEC-KARMA-SSRF-001 | SSRF + auth bypass in karma service | STAYOWN + G-KS-C2 + F001-C4 | 15 min |
| 6 | SEC-MER-SENS-001 | Bank details plaintext — GDPR/RBI violation | STAYOWN + AB-C3 | 2 hours |
| 7 | SEC-MER-INJECT-001 | MongoDB object injection — prototype pollution | STAYOWN + G-MA-C5 | 30 min |
| 8 | CS-M12 | Offline idempotency key assigned AFTER INSERT | Gaps/MONEY + G-MA-C08 | 1 hour |
| 9 | CS-M13 | Failed offline bills silently removed | Gaps/MONEY + G-MA-C09 | 1 hour |
| 10 | CS-M14 | Batch sync partial failure re-sends ALL | Gaps/MONEY + G-MA-C10 | 2 hours |
| 11 | CS-M15 | Coin redemption not in POS payment payload | Gaps/MONEY + G-MA-C02 | 2 hours |
| 12 | CS-M16 | Offline bill loses coin discount entirely | Gaps/MONEY + G-MA-C03 | 1 hour |
| 13 | NA-CRIT-02 | Bill amount client-controlled — fraud vector | STAYOWN/CONSUMER + G-MA-C02 | 4 hours |
| 14 | NA-CRIT-03 | `new Blob()` crashes on iOS/Android | STAYOWN/CONSUMER | 30 min |
| 15 | NA-CRIT-04 | `@/types/unified` doesn't exist — build fails | STAYOWN/CONSUMER | 4 hours |
| 16 | NA-CRIT-06 | `showToast` never imported — blocks checkout | STAYOWN/CONSUMER | 5 min |
| 17 | NA-CRIT-07 | Double-tap on payment submit — no guard | STAYOWN/CONSUMER | 30 min |
| 18 | NA-CRIT-08 | Payment polling `'completed'` vs `'paid'` — 90s hang | STAYOWN + CS-E10 | 30 min |
| 19 | NA-CRIT-09 | `Math.random()` for ID generation | STAYOWN/CONSUMER | 10 min |
| 20 | NA-CRIT-11 | Wallet balance in plain AsyncStorage | STAYOWN/CONSUMER | 2 hours |
| 21 | F001-C1 | Settlement blind spot — merchant vs merchantId | FORENSIC-001 | 2 hours |
| 22 | F001-C2 | Catalog service auth broken (HMAC key) | FORENSIC-001 | 30 min |
| 23 | F001-C3 | Merchant withdrawal TOCTOU race condition | FORENSIC-001 | 1 hour |
| 24 | F001-C4 | Karma auth route 404 (wrong endpoint) | FORENSIC-001 + G-KS-C2 | 15 min |
| 25 | F001-C5 | Karma 2x inflation — double increment | FORENSIC-001 + G-KS-B10 | 1 hour |
| 26 | F001-C6 | Admin cron uses consumer JWT auth | FORENSIC-001 | 1 hour |
| 27 | F001-C7 | FraudFlag model missing — silent drop | FORENSIC-001 | 2 hours |
| 28 | F001-C11 | Internal service key unvalidated | FORENSIC-001 + CS-S1 | 15 min |
| 29 | F001-C12 | Firebase JSON on disk | FORENSIC-001 | 1 hour |
| 30 | F001-C13 | Order statuses out of sync (14 vs 11) | FORENSIC-001 + CS-E9 | 3 hours |
| 31 | F001-C14 | Static files served without auth | FORENSIC-001 | 30 min |
| 32 | F001-C15 | Finance service silent coin failure | FORENSIC-001 + CS-M10 | 2 hours |
| 33 | AB-C1 | `rez_user_id` spoofable via URL query | ADBAZAAR | 30 min |
| 34 | AB-C5 | Payment amount never verified server-side | ADBAZAAR | 1 hour |
| 35 | NW-CRIT-001 | Idempotency key uses Date.now() | REZ-NOW | 30 min |
| 36 | NW-CRIT-002 | Payment verification hardcoded to { verified: true } | REZ-NOW | 30 min |
| 37 | NW-CRIT-003 | Merchant panel zero auth — /merchant/* unprotected | REZ-NOW | 2 hours |
| 38 | A10-C5 | HMAC key from env var NAME not value | REZ-ADMIN | 15 min |
| 39 | A10-C6 | SSE order stream no merchant ownership check | REZ-ADMIN + CS-S4 | 30 min |
| 40 | RZ-B-C1 | Gift voucher authorization bypass | RENDEZ-BACKEND | 30 min |
| 41 | RZ-B-C2 | Payment webhook race — double reward | RENDEZ-BACKEND + G-MA-C08 | 1 hour |
| 42 | RZ-B-C4 | Socket read_receipt bypasses matchId check | RENDEZ-BACKEND | 30 min |
| 43 | CS-S-M1 | IDOR on order detail — no ownership check | MERCHANT-APP | 30 min |
| 44 | CS-S-M2 | Biometric auth bypass when hardware unavailable | MERCHANT-APP | 1 hour |
| 45 | F001-C8 | Dual authority — 2+ writers to same data | FORENSIC-001 | Architecture |
| 46 | F001-C9 | Three payment FSMs — root cause | FORENSIC-001 + CS-E9 | Architecture |
| 47 | F001-C10 | Coin rate divergence hardcoded 1:1 vs env | FORENSIC-001 | 1 hour |
| 48 | G-KS-C1 | Hardcoded default QR secret | KARMA-SERVICE | 10 min |
| 49 | G-KS-C3 | jwtSecret unvalidated at startup | KARMA-SERVICE | 5 min |
| 50 | G-KS-C4 | Horizontal privilege escalation | KARMA-SERVICE | 10 min |
| 51 | G-KS-C5 | Batch stats endpoint unauthenticated | KARMA-SERVICE | 5 min |
| 52 | G-KS-C6 | TimingSafeEqual throws on length mismatch | KARMA-SERVICE | 5 min |
| 53 | G-KS-C7 | Idempotency key collision | KARMA-SERVICE + G-MA-C08 | 10 min |

### Total CRITICAL: ~81 individual issues (many overlap across sources)

> See `CRITICAL-MASTER.md` for the complete list including 14 ReZ NoW CRITICALs (NW-CRIT-001, NW-CRIT-004–013) and 15 RestoPapa CRITICALs (RP-C01–C15).

---

## Cross-Reference: Which Bugs Appear Under Different IDs

See `DUPLICATE-MASTER.md` for the full mapping.

Key overlaps:
- P0-KARMA-001 = G-KS-B1 = G-KS-C7 duplicate = F001-C17 = NA-HIGH-12 (same duplicate const bug)
- BE-MER-OTP-001 = G-MA-C6 (same OTP brute-force)
- SEC-KARMA-SSRF-001 = G-KS-C2 = F001-C4 (same SSRF auth bypass)
- SEC-MER-SENS-001 = AB-C3 (bank details plaintext)
- FE-PAY-001 = A10-C4 = CS-M1 (PaymentMachine in-memory)
- FE-PAY-002 = CS-E10 (payment status `'completed'` vs `'paid'`)
- CS-M12/M13/M14 = G-MA-C08/C09/C10 (offline POS issues)
- CS-S1 = A10-C5 = F001-C11 (HMAC key from env name)

---

## Root Cause Summary

These 29 root causes generate the most bugs:

| # | Root Cause | Bugs It Creates | Fix |
|---|-----------|----------------|-----|
| RC-1 | No single source of truth for types/enums | 100+ | Canonical shared-types package |
| RC-2 | Frontend computes what backend should own | 50+ | Move logic to backend |
| RC-3 | Fire-and-forget for financial ops | 30+ | BullMQ + idempotency keys |
| RC-4 | In-memory state machines | 20+ | Persist to DB with CAS |
| RC-5 | No TypeScript contract at boundary | 40+ | Zod + shared types |
| RC-6 | Copy-paste without shared abstraction | 80+ | Extract to shared packages |
| RC-7 | TanStack Query cache invalidation missing | 30+ | `queryClient.invalidateQueries` |
| RC-8 | Shared MongoDB — no DB-level isolation | 15+ | Separate DBs per service |
| RC-9 | No monorepo — services in separate repos | 20+ | Monorepo with shared packages |
| RC-10 | Three competing FSM definitions | 15+ | Single canonical FSM package |

---

## Next Steps

1. Read `CRITICAL-MASTER.md` — fix all 81 CRITICAL bugs (~15 min each)
2. Read `HIGH-MASTER.md` — tackle 157 HIGH bugs (~1 hr each)
3. Read `MEDIUM-MASTER.md` — address 272 MEDIUM bugs (~30 min each)
4. Read `LOW-MASTER.md` — backlog 244 LOW issues (~15 min each)
5. Read `../11-STAYOWN-ROUND2/` — 44 new findings from 2026-04-17 audit
6. Read `CROSS-REF-MATRIX.md` — avoid fixing the same bug twice
7. Read `CROSS-SERVICE-MASTER.md` — understand cross-repo patterns
8. Read `SOLUTION-PLAN-MASTER.md` — get the unified fix roadmap
9. Start with the **5-minute fixes** (P0-KARMA-001, NA-CRIT-06, G-KS-C3, G-KS-C5, G-KS-C6)

---

**Last Updated:** 2026-04-17 (added StayOwn Round 2 audit — 44 new findings)
**Consolidated by:** StayOwn Audit Session
