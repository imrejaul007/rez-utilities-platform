# Consumer App — Detailed Remediation Plan

> **Audit:** [CONSUMER-APP-BUGS.md](CONSUMER-APP-BUGS.md)
> **Scope:** `rez-app-consumer` (React Native + Expo Router)
> **Total bugs to resolve:** 559 (26 CRITICAL · 103 HIGH · 375 MEDIUM · 55 LOW)
> **Planning horizon:** ~10 weeks across 5 phases

---

## Guiding principles

1. **Ship fixes in phases ordered by user/business risk**, not by module. A MEDIUM payment bug beats a HIGH cosmetic bug.
2. **Every fix lands with a test** — unit or integration — reproducing the bug before the fix lands. No test, no merge.
3. **Never touch money logic without idempotency + server-side re-validation.** Client-side calculations are UI hints only.
4. **Back-compat first.** Any shape change on the API side must roll out behind a feature flag and version gate, with the mobile app gracefully degrading on older versions.
5. **One bug ID per commit** — the bug ID (e.g. `CA-PAY-012`) goes in the commit message so the audit trail is self-linking.
6. **Close the loop in the audit file.** When a bug is merged, mark it `> **Status:** Fixed in <PR#> (<date>)` so future audits skip it.

---

## Phase 0 — Stabilize foundations (Week 0, parallel)

Preparatory work that unblocks everything else.

- **P0-A Restore build/CI for consumer app.** The audit was forced to rely on source reading because `npm install` timed out. Pin Node/pnpm versions, fix the dep graph, and get `tsc`, `eslint`, `jest`, and `expo doctor` green in CI. **Owner:** platform. **Exit criteria:** `npm ci && npm run build && npm test` passes in <10 min.
- **P0-B Re-run linters with audit context.** Once build is green, re-run TS/ESLint and diff against the audit — every item the tools catch gets auto-closed or re-assigned an ID. Many MEDIUM bugs (missing radix, unused deps, unused variables) will collapse into a single lint fix PR.
- **P0-C Lock a feature-flag rail.** Most fixes change observable behavior. A single flag service (already implicit in `rez-auth-service`) should gate the rollout of every HIGH/CRITICAL fix.
- **P0-D Add release-blocking smoke tests.** Detox or Maestro flows for: login, search → book flight, add-to-cart → checkout → pay, wallet recharge, refund. These act as the acceptance gate for Phases 1–3.

---

## Phase 1 — CRITICAL (Week 1–2) — 26 bugs

Things that leak money, leak PII, or can brick user accounts. No other work should be scheduled against this app until this phase lands.

### 1.1 Money & payments (CA-PAY, CA-SEC)
- Fix every `CRITICAL` payment bug: missing idempotency keys on wallet topup/refund, race conditions between optimistic UI and server confirmation, client-only amount calculations, and double-submit on the checkout button.
- Introduce a single `paymentClient` wrapper (if it does not already exist) that: (a) generates UUIDv4 idempotency keys, (b) retries only on 5xx with the same key, (c) never retries on 4xx, (d) surfaces a terminal state machine (`INIT → PENDING → SUCCESS|FAIL`) that the UI binds to.
- Server-side: every amount MUST be re-computed on the backend before authorization. Client-sent amounts are advisory only.
- Audit files: `CONSUMER-APP-PAYMENTS.md`, `CONSUMER-APP-SECURITY.md`, `CONSUMER-APP-API-CONTRACTS.md`.

### 1.2 Auth & session (CA-AUT, CA-SEC)
- Fix token refresh races, missing logout-on-401, and any path that stores JWTs in `AsyncStorage` without encryption (move to Keychain / EncryptedSharedPreferences via `expo-secure-store`).
- Ensure biometric / PIN gates cannot be bypassed via deep link (re-check every route in `app/`). Deep link handler must consult auth state before mounting protected screens.

### 1.3 PII & logging (CA-SEC)
- Purge all `console.log(user)` / `console.log(token)` / `console.log(card)` paths. Replace with a redacting logger. Ship a runtime guard in production builds that throws on disallowed keys.
- Remove any hardcoded staging URLs, test phone numbers, test OTPs, or dev-only feature flags from shipped bundles.

### 1.4 Crash & data-loss (CA-INF, CA-CMC)
- Any `CRITICAL` unhandled promise rejection, silent catch-and-swallow in checkout, or `Promise.all` that leaves partial state — these corrupt orders and must be converted to `Promise.allSettled` + explicit error branches.

**Phase 1 exit criteria:** zero CRITICAL bugs open, all P0 smoke tests pass on iOS + Android, a dry-run refund/topup cycle in staging completes with correct idempotent behavior under forced network drop.

---

## Phase 2 — HIGH, user-journey first (Week 3–5) — 103 bugs

Sequenced so the highest-traffic user journeys stabilize before long-tail screens.

### 2.1 Checkout & order journey (CA-CMC, CA-PAY)
- Fix HIGH bugs in cart, checkout, order confirmation, order tracking, and refund initiation. This is the revenue path — stability here gates marketing spend.
- Introduce a `checkoutMachine` (XState or hand-rolled reducer) covering: address → delivery/slot → coupons → payment method → review → submit → polling → success/fail. Every HIGH logic bug in checkout maps to one invalid state/transition that the machine formalizes away.

### 2.2 Travel booking (CA-TRV)
- Fix Promise.all races in flight/hotel/cab/bus/train detail loaders.
- Normalize `parseInt` usage with radix 10 (low-cost sweep).
- Add explicit empty-state UI everywhere a HIGH bug notes "data may render undefined".

### 2.3 Wallet & bills (CA-PAY)
- Race conditions between wallet balance polling and transaction list.
- Bill upload retry/backoff.
- Ensure refund and cashback credits are reconciled against the ledger on the server — the client must NEVER update wallet balance locally.

### 2.4 Auth & onboarding long-tail (CA-AUT)
- All HIGH: KYC upload retry, OTP resend throttling, profile update race against session.

### 2.5 API contract drift (CA-API)
- Every CA-API-### bug is a shape mismatch between mobile and backend. Resolve by: (a) generating types from a single OpenAPI / tRPC source of truth, (b) deleting hand-rolled types, (c) adding contract tests (Pact or similar) in CI. This alone should prevent future API-###-series bugs.

**Phase 2 exit criteria:** zero HIGH bugs in checkout, payments, wallet, auth; Detox smoke tests expanded to cover each HIGH bug's reproduction case.

---

## Phase 3 — HIGH, long-tail + security hardening (Week 6–7)

### 3.1 Gamification, discovery, stores, feed, UGC (CA-GAM, CA-DSC)
- Remaining HIGH logic bugs in rewards calculation, leaderboard pagination, feed cursors, UGC moderation gating.
- Note: any HIGH bug here that affects reward **value** should be treated like a Phase 1 money bug — move it forward.

### 3.2 Security hardening (CA-SEC remaining)
- SSL pinning, jailbreak/root detection posture, clipboard hygiene on sensitive fields, screenshot prevention on payment/OTP screens.
- Deep-link validation (allowlist of paths, parameter schema validation) across all `app/` routes.
- Rate-limit surfaces that currently rely on backend-only throttling (mobile-side debouncing for login, OTP, search).

### 3.3 Infra (CA-INF) — context/store/hook soundness
- Contexts that re-render the whole app on every change → migrate to selector-based access (Zustand selectors, or split contexts).
- Hooks with stale closures and missing deps → systematic sweep guided by the `react-hooks/exhaustive-deps` rule, now that Phase 0 got ESLint running.

**Phase 3 exit criteria:** zero HIGH bugs open across the app; pen-test checklist (OWASP MASVS L1 subset) passes.

---

## Phase 4 — MEDIUM cleanup (Week 8–9) — 375 bugs

Most MEDIUM bugs cluster into a handful of mechanical categories. Batch them.

1. **`parseInt` radix sweep** — single PR, one regex, replace `parseInt(x)` with `parseInt(x, 10)` everywhere outside tests.
2. **Dead-code / duplicate-fallback sweep** — e.g. `a.description || a.description || 'x'` patterns. One codemod PR.
3. **Missing `useCallback` / `useMemo` where deps churn** — scoped to the hottest render paths per React DevTools profiler.
4. **Explicit empty states & skeleton loaders** — UX polish, one screen per PR, owned by design partner.
5. **Accessibility pass (a11y category)** — labels, roles, hitSlop, contrast. Ship behind an `ALLY_V2` flag.
6. **Platform-conditional bugs (iOS vs Android)** — test matrix on both; one PR per platform-specific fix.
7. **Type tightening** — replace `any` with real types once the OpenAPI-generated types land from Phase 2.5.
8. **Component library cleanup (CA-CMP)** — highest-churn, 130 bugs. Break into sub-themes: Buttons, Inputs, Modals, Lists, Cards. One week of focused component work with visual regression tests (Storybook + Chromatic or similar).

**Phase 4 exit criteria:** MEDIUM count <50, no component in the shared lib has >3 open MEDIUM bugs.

---

## Phase 5 — LOW & hygiene (Week 10) — 55 bugs

- Naming, formatting, unused imports, minor comment typos, redundant conditions.
- Typically closed by enabling stricter lint rules and running `--fix`.
- Finish with a **depreview** pass: every `console.log`, `// TODO`, `// FIXME`, and `@ts-ignore` gets either a ticket or a deletion.

---

## Parallel tracks (ongoing)

- **T-A Observability.** Wire Sentry (or equivalent) to capture every rejection, with source maps. Every bug fix should be verifiable in production telemetry. Start at Phase 0, continuous.
- **T-B Contract tests.** Pact-style tests between consumer and each backend microservice (auth, wallet, payment, order, gamification). Start in Phase 2.5, continuous.
- **T-C Component visual regression.** Storybook snapshots for every shared component. Start in Phase 4.
- **T-D Release discipline.** Two-week EAS release trains; CRITICAL/HIGH ship out-of-band as hotfixes. Start at Phase 1.

---

## Ownership matrix (suggested)

| Track | Lead | Supporting |
|-------|------|-----------|
| Payments + Wallet | Payments squad | Backend payment service owner |
| Checkout + Orders | Commerce squad | Backend order service owner |
| Travel verticals | Travel squad | Each vertical service owner |
| Auth + Security | Platform/security | Mobile lead |
| Gamification + Discovery | Growth squad | Gamification & content services |
| Component library + a11y | Design systems | All squads contribute fixes |
| API contracts | Platform | All backend service owners |
| Build / CI / tooling | Platform | — |

---

## Progress tracking

- Each bug ID gets a row in the Bugs folder file. When closed, append `> **Status:** Fixed in <PR> (<YYYY-MM-DD>)` beneath the `### [CA-XXX-###]` heading.
- `CONSUMER-APP-BUGS.md` totals should be regenerated weekly from the files by a CI job; a drop in counts is the primary progress signal.
- A burn-down chart (CRITICAL/HIGH/MEDIUM/LOW over time) should be rendered in the engineering weekly review.

---

## Out of scope (intentionally)

- Backend service bug fixes not surfaced by the mobile client. Those live in the other audit files (`10-BACKEND-ROUTES.md`, `13-API-CONTRACTS-NEW.md`, etc.). Mobile fixes coordinate with them but are tracked separately.
- Merchant and admin apps — a parallel exhaustive audit is planned for those, to follow this one.
- Refactoring that is not motivated by a specific bug. Architectural rework (Expo Router v3, state management migration, etc.) is proposed separately; it must not be smuggled into bug-fix PRs.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Hidden CRITICAL bugs that only appear with live traffic | M | H | Phased rollout with feature flags; staged % rollout on EAS. |
| API contract changes break older app versions | M | H | Version gating in the gateway; minimum-supported-version banner in the app. |
| Component library PRs cause visual regressions | H | M | Mandatory Chromatic/Storybook visual diffs before merge. |
| CI not actually green — audit relied on source reading | H | H | Phase 0 is the hard prerequisite. No fix merges until CI is green. |
| Bugs found during fix work are not captured | M | M | Every discovered bug gets an ID and appended to the relevant file in the same PR. |

---

## Definition of done (per bug)

1. Reproduction test is committed (failing) before the fix.
2. Fix is committed with the bug ID in the commit message.
3. Test passes; full suite passes; `tsc` clean; `eslint` clean.
4. Bug entry in `docs/Bugs/CONSUMER-APP-*.md` is updated with `> **Status:** Fixed in <PR> (<date>)`.
5. If the bug touched a user-visible path, release notes are updated.
6. If the bug touched a backend contract, the corresponding backend audit file is cross-linked.
