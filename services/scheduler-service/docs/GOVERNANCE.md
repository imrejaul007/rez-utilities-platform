# Architecture Governance

This document outlines the governance model for maintaining architectural coherence and preventing drift across the RuFlo V3 monorepo.

## Overview

Architecture drift — gradual degradation of design principles through accumulated violations — is prevented through:
1. **Automated fitness tests** running on every PR
2. **Rotating architect-on-call** responsibility
3. **Standardized bug workflow** and SLA
4. **Weekly burn-down dashboard** tracking remediation progress

---

## Architecture Fitness Tests

All 10 tests run automatically on every pull request via `.github/workflows/arch-fitness.yml`.
Tests 1-5 are **hard failures** (block merge); tests 6-10 are **advisory warnings**.
A master runner `scripts/arch-fitness/run-all.sh` executes all tests in sequence.

### Test 1: No Bespoke Buttons
**File**: `scripts/arch-fitness/no-bespoke-buttons.sh`

Enforces centralized UI components. All client apps must import Button from `@rez/rez-ui`, never from local `./Button.tsx`.

- **Exemptions**: `packages/rez-ui` itself, `node_modules`
- **Failure**: Pull request blocked
- **Fix**: Change import from `./Button` to `@rez/rez-ui`

### Test 2: No Console Logs
**File**: `scripts/arch-fitness/no-console-log.sh`

Enforces centralized logging. All logging calls (`console.log|error|warn|info`) must use `rez-shared/telemetry` logger, never direct `console.*` calls.

- **Exemptions**: `packages/rez-shared/telemetry/` itself, `node_modules`, `dist`
- **Failure**: Pull request blocked
- **Fix**: Import logger from `rez-shared/telemetry`

### Test 3: No Bespoke Idempotency
**File**: `scripts/arch-fitness/no-bespoke-idempotency.sh`

Enforces idempotency patterns. Any code using `idempotencyKey` must import from `rez-shared/idempotency`, never define locally.

- **Exemptions**: `node_modules`, `dist`
- **Failure**: Pull request blocked
- **Fix**: Import `idempotencyKey` from `rez-shared/idempotency`

### Test 4: No Bespoke Enums
**File**: `scripts/arch-fitness/no-bespoke-enums.sh`

Enforces enum centralization. All enums must be defined in `rez-shared/enums/` once and imported everywhere; no duplicates allowed.

- **Exemptions**: `rez-shared/enums/` itself, `node_modules`, `dist`
- **Failure**: Pull request blocked
- **Fix**: Use centralized enum from `rez-shared/enums`

### Test 5: No Math.random() for IDs
**File**: `scripts/arch-fitness/no-math-random-for-ids.sh`

Enforces secure ID generation. Variables containing "id", "key", or "token" must never be generated via `Math.random()`.

- **Requirement**: Use `uuid`, `crypto.randomUUID()`, or a proper library
- **Failure**: Pull request blocked
- **Fix**: Replace `Math.random()` with `uuid` or similar

### Test 6: No `as any` Type Assertions
**File**: `scripts/arch-fitness/no-as-any.sh`

Enforces TypeScript type safety. `as any` bypasses the type system and introduces runtime errors.

- **Exemptions**: Test files (`*.test.ts`, `*.spec.ts`), `node_modules`, `dist`
- **Failure**: Pull request blocked
- **Fix**: Define the actual type, or use `as unknown as T` for intentional coercion

### Test 7: Centralized Button Advisory
**File**: `scripts/arch-fitness/centralized-button.sh`

Advisory check for bespoke Button usage. Warns when local Button imports are found outside `@rez/rez-ui`.

- **Severity**: Advisory warning (non-fatal; hard enforcement is Test 1)
- **Fix**: Import from `@rez/rez-ui` for gradual migration

### Test 8: No Bespoke Order Status Strings
**File**: `scripts/arch-fitness/no-bespoke-status.sh`

Advisory check for hardcoded order status literals (`placed`, `confirmed`, etc.) outside `rez-shared/orderStatuses`.

- **Severity**: Advisory warning
- **Fix**: Import `OrderStatus` type and use canonical values from `@rez/shared`

### Test 9: Centralized API Client
**File**: `scripts/arch-fitness/centralized-api-client.sh`

Advisory check for direct `fetch()`, `axios`, or `http` imports outside the centralized API client.

- **Severity**: Advisory warning
- **Fix**: Use `@rez/shared/api-client` or a dedicated service client for all HTTP calls

### Test 10: No JSX Inline Styles
**File**: `scripts/arch-fitness/no-inline-styles.sh`

Advisory check for inline `style={{ ... }}` in JSX, which bypasses the design system.

- **Severity**: Advisory warning
- **Fix**: Use CSS classes from the design system or extract to stylesheets

### Pre-Commit Hooks
**File**: `scripts/arch-fitness/install-hooks.sh`

Installs a git pre-commit hook that runs all fitness tests before every commit.

```bash
# Install hooks
bash scripts/arch-fitness/install-hooks.sh

# Uninstall hooks
bash scripts/arch-fitness/install-hooks.sh --uninstall
```

---

## Architect-On-Call Rotation

### Weekly Rotation

One architect is assigned per week to review and triage new bugs and fitness test violations. Rotation order (recurring each week):

1. **Week 1 (Apr 7–13)**: Architect-A (Lead: Domain Architecture)
2. **Week 2 (Apr 14–20)**: Architect-B (Lead: Security & Data)
3. **Week 3 (Apr 21–27)**: Architect-C (Lead: APIs & Integration)
4. **Week 4 (Apr 28–May 4)**: Architect-D (Lead: Performance & DevOps)
5. *Cycle repeats*

**Current Rotation** (as of 2026-04-15):
- **Week of Apr 14–20**: Architect-B (Security & Data domain)

### On-Call Responsibilities

1. **Daily (10:00 AM standup)**: Review overnight PRs for fitness test violations
2. **Within 3 hours**: Assign violation to owner or document as architectural debt
3. **Within 1 day**: Label new bugs as CRITICAL, HIGH, MEDIUM, or LOW
4. **Within 3 days**: Root-cause analysis + assign owner
5. **Weekly (Friday 4:00 PM)**: Update `BURN_DOWN_DASHBOARD.md` with status

### Escalation Path

1. **Fitness test violation** → Owner fixes within 24 hours or PR blocked
2. **Multiple violations in same domain** → Architect escalates to domain lead
3. **Security-critical violation** → Escalate immediately to Security team
4. **Repeated violations** → Spike scheduled for architectural refactor

---

## Bug Workflow & SLA

All bugs are tracked in `docs/Bugs/*.md` following this format:

```markdown
# Bug Report: {TITLE}

**Status**: OPEN | FIXED | DEFERRED
**Severity**: CRITICAL | HIGH | MEDIUM | LOW
**Domain**: {service-name} | {bounded-context}
**Assigned**: {owner-github-handle} (if claimed)

---

## Description
[Problem summary]

## Impact
[User-facing + system impact]

## Root Cause
[Why this happened]

## Fix
[Solution or proposed fix]

---

## Tracking
- Created: {date}
- Last reviewed: {date}
- Architect-on-call: {rotation-week}
```

### Severity Levels

| Severity | Definition | SLA | Example |
|----------|-----------|-----|---------|
| **CRITICAL** | System down, data corruption, security breach | 1 day assignment | Active transaction corruption, unauthorized access |
| **HIGH** | Feature broken, major data inconsistency | 2 days assignment | Lost wallet balance, failed orders |
| **MEDIUM** | Performance degradation, non-critical bugs | 3 days assignment | Slow search, incorrect enum values |
| **LOW** | Polish, documentation, low-impact | 5 days assignment | Typos, console warnings |

### Workflow Timeline

1. **T+0 (Bug created)**: File added to `docs/Bugs/` by reporter
2. **T+3 hours**: Architect-on-call triages severity + domain
3. **T+1 day**: Owner assigned (CRITICAL → 1 day, HIGH → 2 days, MEDIUM → 3 days)
4. **T+assignment**: Owner posts fix plan in bug comment
5. **T+fix**: PR merged, bug marked FIXED with PR link
6. **Weekly**: Dashboard updated with status

---

## Burn-Down Dashboard

### Generation

```bash
npm run burn-down
```

Runs `scripts/burn-down.ts` which:
- Scans `docs/Bugs/*.md` for status, severity, domain metadata
- Calculates per-domain fix rate (burndown %)
- Generates `docs/BURN_DOWN_DASHBOARD.md`

### Interpretation

**Example:**

```
| Domain | Total | Fixed | Critical | High | Burndown % |
|--------|-------|-------|----------|------|-----------|
| data-layer | 15 | 3 | 5 | 7 | 20% |
| auth | 8 | 8 | 0 | 0 | 100% |
```

- **data-layer**: 20% complete; 12 bugs remain; 5 critical
- **auth**: Complete; ready to release

### Weekly Review

Every Friday 4:00 PM:
1. Generate fresh dashboard: `npm run burn-down`
2. Identify domains with <50% burndown (high-risk)
3. Escalate CRITICAL bugs >3 days old
4. Update `BURN_DOWN_DASHBOARD.md` in repo
5. Post dashboard snapshot to team Slack

---

## CI/CD Integration

### Pre-Merge Checks

All PRs must pass:
1. **Build**: `npm run build` succeeds
2. **Tests**: `npm test` passes (>80% coverage)
3. **Lint**: `npm run lint` zero violations
4. **Fitness**: All 10 tests pass (tests 1-5 hard block, 6-10 advisory)

### Fitness Test Waiver Process

If a violation is necessary (rare), document in PR:

```markdown
## Fitness Test Waiver

- Test: no-bespoke-buttons
- Reason: [specific, time-limited reason]
- Duration: [e.g., "2 weeks until refactor PR #123 lands"]
- Approver: [security-architect or domain-lead]
- PR: [link to fix PR]
```

---

## Anti-Drift Mechanics

### Pattern Enforcement

| Pattern | Rule | Where enforced |
|---------|------|-----------------|
| Button imports | Must use `@rez/rez-ui` | Fitness test 1 (hard) |
| Logging | Must use `rez-shared/telemetry` | Fitness test 2 (hard) |
| Idempotency | Must use `rez-shared/idempotency` | Fitness test 3 (hard) |
| Enums | Centralized in `rez-shared/enums` | Fitness test 4 (hard) |
| ID generation | `uuid` or `crypto.randomUUID()` | Fitness test 5 (hard) |
| Type safety | No `as any` without justification | Fitness test 6 (hard) |
| Button imports | Migrate to `@rez/rez-ui` | Fitness test 7 (advisory) |
| Order statuses | Use canonical types from shared | Fitness test 8 (advisory) |
| HTTP clients | Use centralized API client | Fitness test 9 (advisory) |
| JSX styles | Use design system classes | Fitness test 10 (advisory) |

### Recovery from Drift

If drift is detected (multiple violations in one domain):

1. **Triage** (Architect): Categorize violations by root cause
2. **Plan** (Domain Lead): Design refactor spike
3. **Spike** (Team): 1-2 week focused effort to centralize
4. **Verify** (CI): All fitness tests pass
5. **Document** (Architect): Update this file with lessons learned

---

## Accountability

### Developer Responsibility
- Keep local code aligned with established patterns
- Review fitness test output on every PR
- Fix violations immediately; don't merge with waivers

### Architect-On-Call Responsibility
- Triage new bugs within 3 hours
- Route violations to domain leads
- Escalate repeated offenders
- Update dashboard weekly

### Domain Lead Responsibility
- Unblock team when patterns conflict with requirements
- Schedule refactor spikes if violations exceed 5% per domain
- Mentor team on patterns via code review

### Release Manager Responsibility
- Verify zero CRITICAL open bugs before release
- Check burn-down >90% for affected domains
- Require fitness test pass on all code going to production

---

## References

- Fitness tests: `scripts/arch-fitness/` (10 tests total)
- ESLint rules: `.eslintrc.cjs` (TypeScript safety + no console)
- Burn-down script: `scripts/burn-down.ts`
- Bugs tracker: `docs/Bugs/`
- Dashboard: `docs/BURN_DOWN_DASHBOARD.md`
- Architecture: `docs/ARCHITECTURE.md`

---

**Last Updated**: 2026-04-17 (added tests 6-10 + ESLint config + run-all.sh)
**Next Rotation Review**: 2026-04-22
