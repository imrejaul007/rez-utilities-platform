# Unified Remediation Plan — Consumer, Merchant, Admin, Backend

> **Scope:** All four codebases — `rez-app-consumer`, `rezmerchant`, `rezadmin`, and every `rez-*` backend microservice.
> **Total bugs tracked:** 1,664 across the four codebases.
> **Planning horizon:** ~14 weeks across 6 phases + continuous parallel tracks.
> **North-Star requirement (from user):** *"we need to make sure across all we are using everything same"* — every phase in this plan enforces a **single source of truth** for the behavior being fixed. Drift is the root cause of most of the bugs; eliminating drift is the explicit goal.

---

## Aggregate severity

| Codebase | CRIT | HIGH | MED | LOW | Total | Index |
|----------|-----:|-----:|----:|----:|------:|-------|
| Consumer app | 26 | 103 | 375 | 55 | 559 | [CONSUMER-APP-BUGS.md](CONSUMER-APP-BUGS.md) |
| Merchant app | 14 | 49 | 258 | 29 | 350 | [MERCHANT-APP-BUGS.md](MERCHANT-APP-BUGS.md) |
| Admin app | 25 | 84 | 153 | 59 | 321 | [ADMIN-APP-BUGS.md](ADMIN-APP-BUGS.md) |
| Backend | 13 | 59 | 281 | 80 | 434 | [BACKEND-BUGS.md](BACKEND-BUGS.md) |
| **Total** | **78** | **295** | **1,067** | **223** | **1,664** | — |

---

## Guiding principles (apply to every PR across every codebase)

1. **One source of truth or don't ship.** Before fixing a bug, check whether the same behavior lives in other codebases. If yes, fix it in the shared package and have all four codebases consume it. Never fix the same logic twice.
2. **Money logic is server-only.** Clients compute advisory totals for UI; the backend re-computes and authorizes. Any client-side amount discrepancy closes the request with an error, not a silent correction.
3. **Idempotency on every mutating money call.** UUIDv4 key, stored for ≥24h, returns the same response on retry. No exceptions.
4. **Back-compat first.** API shape changes roll out with version gates + a minimum-supported-version banner in each client app.
5. **One test per fix.** Reproduction test committed (failing) before the fix. No test, no merge.
6. **Bug ID in every commit.** `CA-PAY-012`, `MA-ORD-004`, `AA-FIN-007`, `BE-ORD-019` — enables weekly burn-down.
7. **Close the loop in the audit file.** When merged, append `> **Status:** Fixed in <PR#> (<YYYY-MM-DD>)` under the bug heading.

---

## Cross-cutting "single source of truth" contracts

These are the artifacts that eliminate drift between the four codebases. Each is treated as a first-class deliverable of this plan — not a side effect.

| # | Artifact | Location | Consumed by |
|--:|----------|----------|-------------|
| 1 | **OpenAPI / tRPC schema registry** | `rez-shared/api-contracts/` | All four codebases; hand-rolled types deleted |
| 2 | **Shared enum registry** | `rez-shared/enums/` | Status codes, payment states, order states, role names, severity levels |
| 3 | **Payment state machine** | `rez-shared/state/paymentMachine.ts` | consumer `paymentClient`, merchant `paymentClient`, admin refund flows, backend order/payment services |
| 4 | **Order state machine** | `rez-shared/state/orderMachine.ts` | consumer checkout, merchant order ops, admin order ops, backend order service |
| 5 | **Idempotency key contract** | `rez-shared/idempotency/` | Every mutating API client + every service that receives money/order/wallet mutations |
| 6 | **Auth/session model** | `rez-shared/auth/` | Token storage (SecureStore), refresh rotation, 401 handling, RBAC claim shape |
| 7 | **Shared React Native component library** | `packages/rez-ui/` | consumer, merchant, admin — buttons, inputs, modals, lists, cards |
| 8 | **Logging & telemetry SDK** | `rez-shared/telemetry/` | Redacting logger, Sentry init, PII allowlist — identical across all four codebases |
| 9 | **Feature-flag client** | `rez-shared/flags/` | Every rolled-out fix gates on a flag; admin can percentage-roll |
| 10 | **Audit-log emitter** | `rez-shared/audit/` | Every admin action, every money movement, every state change |

> **Rule:** A fix that touches any of the above MUST land in the shared artifact first, then be pulled into each codebase. A fix that duplicates logic across codebases fails review.

---

## Phase 0 — Stabilize foundations (Week 0, parallel, mandatory prerequisite)

- **P0-A Restore build/CI.** Get `tsc`, `eslint`, `jest`, `expo doctor` (for RN apps) and service-level `npm test` green across all four codebases. Pin Node, pnpm/npm versions. Exit: `npm ci && npm test && npm run build` passes in <15 min for each codebase.
- **P0-B Re-lint against audits.** Run TS/ESLint; cross-check against bug files. Lint-catchable items collapse into sweep PRs (radix, unused vars, `no-floating-promises`).
- **P0-C Bootstrap the 10 shared artifacts** above as empty scaffolds with TODO comments referencing the bugs they will subsume. This locks the target architecture before fixes start.
- **P0-D Release-blocking smoke tests.** Detox/Maestro for each client app's P0 journeys (login, book, pay, refund, admin login, merchant accept order). Pact contract tests for gateway↔each service.
- **P0-E Telemetry.** Wire Sentry + structured logs on every service and every client build. Every Phase 1–3 fix must be verifiable in telemetry after rollout.

---

## Phase 1 — CRITICAL across the stack (Weeks 1–3) — 78 bugs

Nothing else ships until all 78 CRITICAL bugs are closed. Ordered by blast radius.

### 1.1 Backend money & ledger (BE-ORD, BE-PAY, BE-FIN, BE-CAT, BE-MER)
- `BE-ORD` 6 CRITICAL — order lifecycle, inventory reservation, payment coupling, refund trigger.
- `BE-PAY` 1 CRITICAL — replay-attack surface when Redis degraded, amount-precision float bug.
- `BE-CAT` 2 CRITICAL — missing ownership validation on product delete; broken internal auth HMAC.
- `BE-MER` 3 CRITICAL — HMAC secret broken, profile update allows privilege escalation, bank details encryption bypass.
- All 12 backend CRITICALs land behind feature flags; staged rollout (1% → 10% → 100%).
- **Parallel:** Build and populate `rez-shared/state/paymentMachine.ts` and `orderMachine.ts` — these bugs all collapse into invalid state transitions that the machines formalize away.

### 1.2 Client money & auth (CA-PAY, CA-SEC, MA-PAY, MA-SEC, MA-AUT)
- Consumer: 26 CRITICAL across payments, security, auth.
- Merchant: 3 CRIT auth, 3 CRIT payments, 4 CRIT security — overlapping root causes.
- **Shared fixes:**
  - Single `paymentClient` wrapper in `rez-shared` used by both clients. Generates UUIDv4 keys, retries only on 5xx with same key, never on 4xx, exposes `INIT→PENDING→SUCCESS|FAIL` state machine.
  - Single `tokenStore` wrapper (expo-secure-store) — no JWT lands in AsyncStorage anywhere.
  - Single redacting logger — purge every `console.log(user|token|card|bank)` across all three client apps.

### 1.3 Admin blast-radius (AA-AUT, AA-ORD, AA-FIN, AA-CMP, AA-ANL, AA-USR, AA-DSH, AA-MER)
- Admin has 25 CRITICAL. These are uniquely dangerous because one admin action can move thousands of user records.
- **Shared fixes:**
  - Route-level RBAC guard + API-level RBAC — every admin mutation must double-gate.
  - Audit-log emitter wired into every admin action (who/when/why/IP/before/after).
  - Typed-confirmation modal for any destructive action.
  - Two-person approval threshold on payouts and bulk refunds (config in shared enum registry).
  - Idempotency on refund/payout — same key path as consumer/merchant.

### 1.4 Foundational auth (BE-AUTH HIGH, acts as Phase 1 dependency)
- Although BE-AUTH has 0 CRITICAL flagged, 7 HIGHs around token rotation and session invalidation gate every client fix. Pulled forward into Phase 1.

**Phase 1 exit criteria:**
- 0 CRITICAL open across all four codebases.
- Shared `paymentMachine`, `orderMachine`, `tokenStore`, `idempotency`, `auditLog`, `redactingLogger` artifacts in production use — at least one consumer per codebase each.
- Smoke tests green on iOS + Android (consumer + merchant) and admin web/desktop.
- Staged refund + wallet recharge in staging survives forced network drop with correct idempotent behavior.

---

## Phase 2 — HIGH, revenue paths first (Weeks 4–6) — 295 bugs

Sequenced so the highest-traffic user journeys stabilize before long-tail screens.

### 2.1 Order/checkout spine (CA-CMC, MA-ORD, AA-ORD, BE-ORD, BE-PAY)
- All HIGH bugs in checkout, cart, order confirmation, tracking, refund initiation across consumer + merchant + admin + backend.
- Adoption of the shared `orderMachine` — every HIGH logic bug here collapses into an invalid state/transition that the machine prevents.
- Contract tests (Pact) between each client and backend order/payment services become blocking.

### 2.2 Wallet, finance, settlement (CA-PAY, MA-PAY, AA-FIN, BE-WAL, BE-FIN, BE-PAY)
- HIGH bugs around balance races, ledger consistency, settlement reconciliation, payout approval flows.
- Ledger atomicity — every wallet mutation goes through a single stored-procedure-style transaction boundary.
- Client apps NEVER update wallet balance locally. The server is the only writer.

### 2.3 Auth & onboarding long-tail (CA-AUT, MA-AUT, AA-AUT, BE-AUTH)
- OTP throttling, KYC upload retry, refresh token rotation, session invalidation, 2FA for admin.
- Shared `authClient` used by all three client apps.

### 2.4 Merchant operations (MA-STR, MA-ORD, AA-MER, BE-MER, BE-CAT)
- Merchant store management, catalog CRUD, admin approvals.
- Eliminate per-merchant N+1 queries and missing pagination bounds (admin + backend).

### 2.5 API contract drift (CA-API, MA-API, AA-API, BE-SHR, BE-GW)
- Every `*-API-###` bug is a shape mismatch. Resolve by:
  1. Generate types from the single OpenAPI/tRPC registry (Phase 0 scaffold).
  2. Delete all hand-rolled response types across all four codebases.
  3. Pact contract tests in CI on every service and every client.

**Phase 2 exit criteria:**
- 0 HIGH in checkout, payments, wallet, auth, admin money ops.
- OpenAPI registry is the only source of types; all client codebases build green off generated types.
- Pact CI running on all client↔service pairs.

---

## Phase 3 — HIGH, long-tail + security hardening (Weeks 7–8)

### 3.1 Gamification, discovery, UGC (CA-GAM, MA-GAM, CA-DSC, MA-DSC, BE-GAM, BE-KAR, BE-MKT, BE-ADS, BE-SRC)
- Remaining HIGH logic bugs in rewards calculation, leaderboards, coupon eligibility, campaign targeting, feed cursors.
- Any HIGH that affects reward **value** is treated as a Phase 1 money bug — pull forward.

### 3.2 Admin analytics + campaigns (AA-ANL, AA-CMP, AA-DSH)
- HIGH timezone bugs, cohort calculation, export safety, campaign date validation.
- Single shared `dateTime` utility (IANA timezone aware) across all four codebases.

### 3.3 Security hardening (CA-SEC, MA-SEC, AA-SEC, BE-GW, BE-AUTH)
- SSL pinning, jailbreak/root detection, clipboard hygiene, screenshot prevention on payment/OTP/admin screens.
- Deep-link allowlist + parameter schema validation across all `app/` routes on both client apps.
- Admin: CSP, SRI, X-Content-Type-Options, session-timeout warnings, anomaly detection on admin logins.
- Gateway: fail-closed rate-limiter fallback (no more "Redis down → unlimited requests"); webhook signature verification with replay protection.

### 3.4 Events pipeline & notifications (BE-EVT, BE-SHR)
- Event schema validation, DLQ handling, push/email/SMS routing, idempotent consumers.
- Ordering guarantees on money-moving events.

### 3.5 Infra soundness (CA-INF, MA-INF, AA-INF)
- Context-over-render fixes → selector-based access.
- Stale-closure sweep guided by `react-hooks/exhaustive-deps` (ESLint now running from Phase 0).
- `Promise.all → Promise.allSettled` where partial failure would corrupt state.

**Phase 3 exit criteria:**
- 0 HIGH open across all four codebases.
- OWASP MASVS L1 subset passes for client apps; admin passes an admin-specific pen-test checklist.

---

## Phase 4 — MEDIUM cleanup (Weeks 9–11) — 1,067 bugs

Most MEDIUMs cluster into mechanical categories. Batch them across codebases.

1. **`parseInt` radix sweep** — single codemod PR per codebase.
2. **Duplicate-fallback / dead-code sweep** — `x || x || 'y'` patterns, unused imports.
3. **Empty states + skeleton loaders** — one screen per PR, driven by the new shared component library.
4. **Memoization sweep** — React Profiler-guided `useCallback`/`useMemo` on hot render paths (all three client apps).
5. **Accessibility pass** — labels, roles, hitSlop, contrast — behind `A11Y_V2` flag.
6. **Platform-conditional (iOS vs Android)** — one PR per platform-specific fix, visual diff required.
7. **Type tightening** — replace `any` with generated types once OpenAPI registry lands.
8. **Component library cleanup (CA-CMP 130, MA-CMP 31)** — break into Buttons/Inputs/Modals/Lists/Cards sub-themes; visual regression (Chromatic).
9. **Admin analytics math** — period-over-period comparisons, cohort analysis, anomaly detection.
10. **Search quality (BE-SRC 27 MEDIUM)** — ranking fixes, typo tolerance, geo search, pagination.

**Phase 4 exit criteria:**
- MEDIUM count <200 across all four codebases combined.
- No single file has >3 open MEDIUMs.
- Shared component library has visual-regression coverage on every exported component.

---

## Phase 5 — LOW & hygiene (Week 12) — 223 bugs

- Naming, formatting, unused imports, typos, redundant conditions.
- Enable stricter lint rules (`no-explicit-any`, `consistent-return`, `no-unused-vars`) and run `--fix`.
- Finish with **depreview**: every remaining `console.log`, `// TODO`, `// FIXME`, `@ts-ignore` gets either a ticket or a deletion.

---

## Phase 6 — Drift prevention & governance (Weeks 13–14, then continuous)

These controls stop the next audit from finding 1,664 bugs again.

1. **Architecture fitness tests** in CI that fail the build if:
   - A client codebase defines a type that already exists in the shared registry.
   - A client codebase imports directly from another client codebase instead of through `rez-shared`/`packages/rez-ui`.
   - A money-mutating endpoint lacks an idempotency key.
   - A service handler lacks a contract test.
2. **Shared-package ownership rotation** — one owner per shared artifact, rotating quarterly, responsible for preventing drift.
3. **Weekly audit burn-down dashboard** — CRIT/HIGH/MED/LOW over time, regenerated from the bug files by a CI job.
4. **Audit re-run cadence** — a static-analysis bot runs the audit heuristics nightly and opens new `*-###` bug entries when it finds regressions.
5. **ADR for every shared artifact** — the OpenAPI registry, state machines, component library each get an ADR so future teams know the "why".

---

## Parallel tracks (continuous, start Week 0)

- **T-A Observability.** Sentry on every service + every client build with source maps. Every bug fix verified in telemetry post-rollout.
- **T-B Contract tests.** Pact between each client and each backend service; blocks merges that break the registry.
- **T-C Component visual regression.** Chromatic/Storybook on the shared `packages/rez-ui` library.
- **T-D Release discipline.** Two-week EAS trains for mobile; nightly service deploys; CRITICAL/HIGH ship out-of-band as hotfixes with feature-flag kill switches.
- **T-E Data migration readiness.** Backfills for any column/state added by these fixes are scripted, dry-run on staging, and run online (no full-table locks).

---

## Ownership matrix

| Track | Lead squad | Supporting | Primary bug files |
|-------|-----------|-----------|-------------------|
| Shared API contracts | Platform | All service owners | `*-API-*`, `BE-SHR` |
| Payments & wallet & ledger | Payments | Finance, Commerce | `*-PAY-*`, `BE-WAL`, `BE-FIN` |
| Order & checkout | Commerce | Payments | `CA-CMC`, `MA-ORD`, `AA-ORD`, `BE-ORD` |
| Travel verticals | Travel | Each vertical owner | `CA-TRV`, `MA-TRV` |
| Auth & security | Platform/Security | Mobile leads | `*-AUT-*`, `*-SEC-*`, `BE-AUTH` |
| Merchant & catalog | Merchant + Catalog | Commerce | `MA-STR`, `AA-MER`, `BE-MER`, `BE-CAT` |
| Admin operations | Admin tools squad | Finance, Support | `AA-*` (all) |
| Gamification & growth | Growth | Marketing | `*-GAM-*`, `BE-KAR`, `BE-MKT`, `BE-ADS` |
| Search & discovery | Search | Growth | `*-DSC-*`, `BE-SRC` |
| Events pipeline | Platform | All services | `BE-EVT` |
| Component library & a11y | Design systems | All squads contribute | `*-CMP-*` |
| Build/CI/tooling | Platform | — | Phase 0 work |

---

## Definition of Done (per bug, per codebase)

1. Reproduction test committed (failing) before the fix.
2. Fix committed with bug ID in commit message.
3. If the fix touches logic that lives in another codebase, fix lands in `rez-shared` first and is consumed everywhere.
4. Full suite passes; `tsc` clean; `eslint` clean; Pact contract tests pass if backend↔client.
5. Feature flag added if behavior-changing; default off until Phase exit.
6. Bug entry updated with `> **Status:** Fixed in <PR#> (<YYYY-MM-DD>)`.
7. Release notes updated if user-visible.
8. Post-rollout verification: bug no longer appears in Sentry / contract-test failures for 72h.

---

## Risk register (plan-level)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Shared artifacts become a bottleneck | M | H | Rotating ownership + ADR-driven design; parallel feature branches allowed but merge-gated on contract tests. |
| Older app versions break on new API shape | M | H | Minimum-supported-version banner; version gate in gateway; rolling additive changes before breaking changes. |
| Admin CRITICAL fix leaks PII or breaks ops | L | H | Staged admin rollout by role group; audit-log replay tested in staging. |
| Burn-down stalls at MEDIUM | H | M | Dedicate one sprint purely to mechanical sweeps (Phase 4 sub-phases are time-boxed). |
| Lint/TS regressions re-introduced | H | M | Pre-commit hooks + CI required check; no `--no-verify` merges. |
| Hidden CRIT bugs only visible under load | M | H | Canary 1%→10%→100% rollout per flag; auto-rollback on SLO breach. |

---

## Out of scope (intentionally)

- Greenfield features not driven by a specific bug.
- Architectural rework beyond what's required to implement the 10 shared artifacts (e.g., switching state managers, router versions) — propose separately.
- Apps outside the four codebases (`Hotel OTA`, `Resturistan App`, `Rendez`, `rez-now`, `adBazaar`, `rez-web-menu`, `rezapp`) — scoped for a follow-up audit pass.

---

## Progress tracking

- Every bug file is the source of truth for its domain's status.
- A weekly CI job regenerates severity tallies from the bug files and posts a burn-down graph to the engineering weekly review.
- Slipping a phase exit by more than 1 week triggers a review with the ownership leads listed above.
