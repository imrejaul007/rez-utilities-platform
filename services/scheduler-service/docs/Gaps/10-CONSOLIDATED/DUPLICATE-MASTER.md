# DUPLICATE BUGS — Different IDs, Same Issue

**Date:** 2026-04-16

This file maps the same bug to its different IDs across audit generations.
**Why it matters:** Don't fix the same bug twice. One fix resolves multiple IDs.

---

## CRITICAL Duplicates

| Unique Bug | STAYOWN | Consumer | Karma | Forensic | Admin | Merchant | Rendez | AdBazaar | NoW |
|-----------|---------|----------|-------|---------|-------|---------|--------|----------|-----|
| Duplicate const (karma dead) | P0-KARMA-001 | NA-HIGH-12 | G-KS-B1, G-KS-C7 | F001-C17 | — | — | — | — | — |
| PaymentMachine in-memory | FE-PAY-001 | — | — | F001-C9 | A10-C4 | — | — | — | — |
| Payment status mismatch | FE-PAY-002 | NA-CRIT-08 | — | — | A10-C4 | G-MA-H02 | — | — | — |
| OTP brute-force | BE-MER-OTP-001 | — | — | — | — | G-MA-C6 | — | — | — |
| SSRF auth bypass | SEC-KARMA-SSRF-001 | — | G-KS-C2 | F001-C4 | — | — | — | — | — |
| Bank details plaintext | SEC-MER-SENS-001 | — | — | — | — | — | — | AB-C3 | — |
| MongoDB injection | SEC-MER-INJECT-001 | — | — | — | — | G-MA-C5 | — | — | — |
| HMAC key env var | — | — | — | F001-C11 | A10-C5 | — | — | — | — |
| SSE no ownership | — | — | — | — | A10-C6 | — | — | — | — |
| Order status fragmented | — | NA-MED-13 | — | F001-C13 | — | CS-E19 | — | — | — |
| KarmaEvent type drift | — | NA-HIGH-03 | G-KU-C3 | — | — | — | — | — | — |
| CoinType mismatch | — | NA-MED-14 | G-KU-H2 | — | — | — | — | — | — |
| Week boundary | — | NA-MED-13 | G-KS-B7 | — | — | — | — | — | — |
| Math.random() | — | NA-CRIT-09 | — | — | — | — | — | — | NW-CRIT-001 |
| Wallet in AsyncStorage | — | NA-CRIT-11 | — | — | — | — | — | — | — |
| Dedup key collision | — | NA-HIGH-05 | — | — | — | — | — | — | — |
| Rewards hook drop | — | NA-HIGH-06 | — | — | — | — | — | — | — |
| Float precision | — | NA-HIGH-07 | — | — | — | — | — | — | — |
| Biometric bypass | — | — | — | — | — | CS-S-M2 | — | — | — |
| Payment webhook race | — | — | — | — | — | — | RZ-B-C2 | — | — |
| Gift voucher auth | — | — | — | — | — | — | RZ-B-C1 | — | — |
| Socket read_receipt | — | — | — | — | — | — | RZ-B-C4 | — | — |

---

## HIGH Duplicates

| Unique Bug | STAYOWN | Consumer | Karma | Forensic | Admin | Merchant | Rendez | AdBazaar | NoW |
|-----------|---------|----------|-------|---------|-------|---------|--------|----------|-----|
| CoinType 'branded_coin' vs 'branded' | — | XREP-12 | G-KU-H2 | — | — | — | — | — | — |
| normalizeLoyaltyTier conflict | P1-ENUM-002 | NA-MED-14 | — | — | — | — | — | — | — |
| Uncapped deductCoins | FE-PAY-005 | — | — | — | — | — | — | — | — |
| BNPL non-atomic | FE-PAY-006 | — | — | — | — | — | — | — | — |
| Coin rate divergence | — | — | — | F001-C10 | — | — | — | — | — |
| Finance silent failure | — | — | — | F001-C15 | — | — | — | — | — |
| Loyalty tier typo | — | — | — | F001-C16 | — | — | — | — | — |
| Welcome coins race | — | — | — | — | — | — | — | — | — |
| Missing rate limit | — | — | — | — | — | — | — | AB-C2 | — |
| Idempotency missing | — | — | — | — | A10-H12 | — | — | AB-C4 | — |

---

## Pattern: 53 CRITICAL bugs reduce to ~30 unique bugs

Due to cross-audit overlap, the 53 CRITICAL issues actually represent ~30 unique bugs when deduplicated.
The remaining ~23 are genuine unique CRITICAL issues that don't overlap.

---

## Cross-Audit Coverage

| Audit Generation | CRITICALs | Unique New | Overlaps With |
|-----------------|-----------|-----------|-------------|
| Gen 1-7 (ReZ) | 78 | ~60 | Gen 8+ |
| Gen 8 (Karma) | 12 | ~8 | Gen 1-7, Gen 13 |
| Gen 9 (Rendez) | 9 | ~6 | Gen 1-7 |
| Gen 10 (AdBazaar/Merchant/Admin) | 31 | ~20 | Gen 1-7, Gen 8 |
| Gen 11 (Consumer 2026) | 11 | ~6 | Gen 1-7, Gen 8, Gen 10 |
| Gen 12 (ReZ NoW) | 14 | ~10 | Gen 1-7 |
| Gen 13 (FORENSIC-001) | 17 | ~10 | Gen 8, Gen 10, Gen 11 |
| STAYOWN (current) | 6 | ~4 | Gen 8, Gen 11, Gen 13 |

---

## Finding: The Same Bugs Keep Being Found

The root cause analysis reveals that ~40% of bugs across all generations share the same patterns:

1. **Type/enum drift** — Found in Gen 1-7, Gen 8, Gen 10, Gen 11, Gen 12, Gen 13
2. **Fire-and-forget financial ops** — Found in Gen 1-7, Gen 8, Gen 9, Gen 10, Gen 13
3. **In-memory state machines** — Found in Gen 1-7, Gen 10, Gen 13
4. **Missing cache invalidation** — Found in Gen 1-7, Gen 9, Gen 10, Gen 11
5. **Duplicate implementations** — Found in Gen 1-7, Gen 9, Gen 10

**Conclusion:** Fixing the architectural root causes (RC-1 through RC-10) will prevent ~40% of future bugs from being introduced.
