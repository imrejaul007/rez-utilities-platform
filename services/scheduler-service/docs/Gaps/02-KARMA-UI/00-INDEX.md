# Gaps: KARMA UI (Consumer App)

**App:** `rez-app-consumer/app/karma/`
**Source:** Deep audit 2026-04-16
**Total Issues:** 47 (7 CRITICAL, 13 HIGH, 24 MEDIUM, 3 LOW)
> Updated 2026-04-16: Added 27 Round 4 findings. Key additions: booking.karmaEarned always undefined (CRITICAL), ngoApproved triple-state rendered as two-state (CRITICAL), NaN crash on null confidenceScore (CRITICAL), scan QR path unguarded (CRITICAL), systematic accessibility gaps, performance re-renders, hardcoded locale

---

## Issues by Category

| Category | CRITICAL | HIGH | MEDIUM | LOW |
|----------|----------|------|--------|-----|
| Functional | 5 | 5 | 3 | 1 |
| Architecture / Type Safety | 1 | 3 | 4 | — |
| Security | — | 1 | 1 | — |
| UX / Flow | — | 2 | 8 | 1 |
| Business Logic | — | 1 | 2 | 1 |
| Accessibility | — | 2 | 3 | 1 |
| Performance | — | 2 | 3 | — |

---

## Files

| File | Description |
|------|-------------|
| `CRITICAL.md` | Runtime crashes, divergent types, fragile check-in logic |
| `HIGH.md` | Type mismatches, missing debounce, stale navigation params |
| `MEDIUM.md` | Empty catch blocks, spinner issues, no real-time sync |
| `LOW.md` | No-op variables, hardcoded placeholders |
| `ROUND4.md` | Round 4 audit: booking field crashes, accessibility, performance, localization (27 issues) |
