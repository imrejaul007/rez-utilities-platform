# System Upgrade Strategy Plan

This document explains the strategy for upgrading the current multi-repo system safely, without breaking live behavior.

Companion documents:
- `FIVE_REPO_DETAILED_AUDIT_REPORT.md`
- `UPGRADE_IMPLEMENTATION_ROADMAP.md`

---

## Stop: Do These First

Before any architectural work begins, four live-danger items must be fixed:

1. **Consumer wallet top-up** — calls admin-only endpoint, blocks all user top-up attempts.
2. **Consumer loyalty credit** — `FashionHeader.js` calls admin-only wallet credit endpoint client-side.
3. **Merchant POS fake-success** — `services/api/pos.ts` fabricates paid state on API failure.
4. **Admin localStorage auth** — XSS anywhere in the admin app = full platform takeover.
   - If cookie migration is not immediate: restrict the admin app to a VPN or IP allowlist now as a compensating control.

These are already broken or dangerous in production. They should not remain while backend changes are underway.

---

## Primary Goal

Upgrade the platform from a fragile, duplicated, partially divergent architecture into a controlled system with:

- one canonical financial orchestration path
- worker and queue observability
- safer browser auth
- shared contracts across repos
- explicit reconciliation and rollback paths

---

## Current Architectural Reality

The current system already has several useful foundations:

- separate API and worker processes in backend
- existing health and readiness endpoints
- BullMQ queues and queue segmentation
- existing feature flags
- existing state machine config files
- `cancelOrderService.ts` now the canonical cancellation path

This means the correct strategy is not a rewrite.

The correct strategy is:
- stabilize
- introduce new behavior behind flags
- dual-run
- compare
- cut over slowly
- remove legacy last

---

## Upgrade Principles

1. No big-bang rewrite
- Old routes and response shapes stay alive until migration is complete.

2. Additive changes first
- New DB fields, indexes, and services are introduced before old ones are removed.

3. Shadow mode before live cutover
- New financial services should run in `shadow` mode first.
- They may compute or log intended behavior, but not mutate live money state.

4. Feature flags gate all risky behavior
- Every major cutover must be reversible by flag.

5. Money logic must be idempotent
- Retries, duplicate callbacks, and worker restarts must not produce double financial side effects.

6. Reconciliation before automation
- First detect and surface drift.
- Then automate remediation after signal quality is proven.

7. Browser auth migration must be dual-mode
- Keep old bearer mode while cookie/session mode is introduced.
- Never force-cut active browser users in one deploy.

---

## Target Architecture

### Financial core

- `PaymentOrchestratorService`
- `RefundOrchestratorService`
- `OrderCancellationService` (partially done — `cancelOrderService.ts` is the foundation)

These services become the only code paths allowed to perform:
- status transition
- wallet mutation
- transaction logging
- ledger writing
- reservation release
- refund effect application

### State model

- Backend state machines become canonical
- Controllers stop writing raw statuses directly
- Clients consume shared generated enums/types

### Worker model

Split workers into:
- critical workers
  - payments
  - rewards
  - merchant-events
- noncritical workers
  - analytics
  - notifications
  - broadcast
  - email

### Browser auth

Move browser surfaces from:
- localStorage token auth

Toward:
- httpOnly cookie or backend-managed session auth

### Contract model

Generate shared financial/order/wallet contracts from backend source types into:
- `packages/rez-shared`

---

## Corrected Upgrade Sequence (1-2 Engineer Reality)

The original roadmap was written as a parallel multi-role plan. This is the serialized version for a 1-2 person team. Each step must complete before the next starts.

### Step 0: Fix live-danger items (do now)

Fix the 4 items listed at the top of this document.

Why first:
- These are already wrong in production. Every day they stay is compounding risk.

### Step 1: Add observability (before any financial changes)

Add:
- Redis reconnect/error metrics
- Queue depth, stalled job, failed job, DLQ metrics
- Readiness endpoint with queue summary
- Money drift counters
- Clearer CORS classification

Why second:
- You cannot safely migrate what you cannot observe.
- Phase 2 (orchestrator) should never cut over live traffic without dashboards showing drift.

### Step 2: Build canonical financial orchestrator in shadow mode only

Build `PaymentOrchestratorService`, `RefundOrchestratorService` behind a flag set to `shadow`.

Why third:
- This is the core long-term fix. Shadow mode means it computes and logs without mutating live money state.
- Do not flip to `live` until drift comparison confirms parity.

### Step 3: Enforce canonical state transitions

Once orchestrators exist, route all status writes through them.

Why fourth:
- Once orchestrators exist, raw status writes become dangerous.

### Step 4: Harden accounting layer

Make wallet + coin transaction + ledger atomic. Enforce idempotency constraints.

Why fifth:
- Ledger and wallet drift is the deepest trust problem.

### Step 5: Split worker blast radius

Separate critical workers (payments, rewards, merchant-events) from noncritical workers (analytics, notifications, broadcast, email).

Why sixth:
- Once business correctness is better, make async processing more resilient.

### Step 6: Migrate browser auth

Move browser surfaces off localStorage tokens to httpOnly cookie/session auth, in dual mode.

Why seventh:
- Important, but safer after backend and critical client flows are stabilized.
- Admin app should be behind VPN/IP restriction until this is done.

### Step 7: Adopt shared contracts

Generate shared financial/order/wallet contracts from backend source types.

Why last:
- Works best once canonical backend states are stable enough to export.

### Step 8: Remove legacy behavior

Remove old paths only after shadow/live comparisons and reconciliation show parity.

Why last:
- Only remove old paths after shadow/live comparisons and reconciliation show parity.

---

## Change Categories And How To Roll Them Out

### Category A: Pure observability

Examples:
- metrics
- health/readiness detail
- logging improvements

Rollout:
- deploy directly
- verify dashboards

Risk:
- low

### Category B: Client guardrails

Examples:
- disabling broken buttons
- removing fake-success fallbacks

Rollout:
- client release after backend is ready to support the intended replacement path

Risk:
- low-medium

### Category C: Financial behavior changes

Examples:
- top-up orchestration
- refund orchestration
- cancellation orchestration

Rollout:
- `disabled`
- `shadow`
- internal-only `live`
- partial rollout
- full rollout

Risk:
- high

### Category D: Security migrations

Examples:
- browser auth migration
- receipt verification

Rollout:
- dual mode first
- usage telemetry
- old mode removal last

Risk:
- medium-high

---

## Safe Rollback Rules

### For financial changes

- Flip feature flag from `live` to `shadow` or `disabled`
- Keep legacy controllers alive until after reconciliation confirms parity

### For worker changes

- Scale down new worker groups
- Re-enable previous worker topology

### For auth migration

- Continue accepting bearer token mode until cookie/session mode is proven stable

### For shared contracts

- Consumers can temporarily fall back to their local handwritten types

---

## What Success Looks Like

You know the upgrade succeeded when:

- wallet top-up has one authoritative backend path
- refunds cannot exceed refundable amount
- all critical worker failures are visible in dashboards
- Redis flaps do not silently stall critical financial processing
- app, admin, merchant, and web no longer drift badly on payment/order states
- browser surfaces do not depend on localStorage refresh tokens
- support can identify drift from reconciliation data instead of customer complaints

---

## Non-Goals

The first safe upgrade should not aim to:

- rewrite every controller
- replace all queues at once
- replace all auth models in one release
- force all clients to adopt new contracts simultaneously
- remove all legacy code before parity is proven

---

## Strategic Recommendation

The smartest path is:

1. fix live-danger items first — they are already wrong
2. add observability before touching live money paths
3. build orchestrators in shadow mode — do not cut over until drift comparison is visible
4. migrate money logic before UI cleanup
5. migrate security posture before scale optimization
6. remove legacy last
