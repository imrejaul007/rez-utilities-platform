# REZ Architecture Execution Plan

Last updated: 2026-04-08
Scope: remaining strategic work after the codebase hardening and bug-fix sweep

## Goal

Turn the remaining repo-level architecture work into an ordered execution plan:

1. choose one workspace/repo strategy
2. normalize core dependency and tooling versions
3. split `rez-merchant-service` into clearer bounded modules
4. clean the root workspace structure so active code and archive material are easier to reason about

This plan is intentionally focused on execution order, rollout safety, and measurable exit criteria.

## Current State

What is already true:

- the highest-risk backend bugs and auth/payment issues have been fixed
- service bootstraps are much more consistent than before
- `rez-shared` builds and publishes a trustworthy package surface in this workspace
- the remaining open work is mostly architectural rather than defect-driven

What is still expensive today:

- package management is fragmented across sibling service repos
- dependency versions drift by service
- CI confidence is uneven because build and test conventions are not uniform
- `rez-merchant-service` has become a large, multi-domain service with high coupling
- the root repo contains active code, docs, audit artifacts, and historical material in a way that increases cognitive load

## Recommended Order

1. workspace/repo strategy
2. dependency and tooling normalization
3. root structure cleanup
4. `rez-merchant-service` modularization

Why this order:

- repo/workspace decisions affect how dependency normalization should be implemented
- dependency normalization is easier before a major merchant-service refactor
- root cleanup is safer once the intended repo boundaries are decided
- merchant modularization benefits from stable tooling and clearer boundaries first

## Workstream 1: Workspace Strategy

Decision record: [ADR-001_DEVELOPMENT_WORKSPACE_STRATEGY.md](/Users/rejaulkarim/Documents/ReZ%20Full%20App/docs/ADR-001_DEVELOPMENT_WORKSPACE_STRATEGY.md)

### Decision

Choose one of these and commit to it:

1. true multi-package workspace
2. explicitly independent service repos with a thin umbrella repo

### Adopted Direction

Use a development monorepo with `npm` workspaces at the root, while keeping service repos and deployments independent.

Active workspace members:

- `rez-auth-service`
- `rez-wallet-service`
- `rez-order-service`
- `rez-payment-service`
- `rez-finance-service`
- `rez-search-service`
- `rez-catalog-service`
- `rez-gamification-service`
- `rez-ads-service`
- `rez-marketing-service`
- `rez-merchant-service`
- `rez-api-gateway`
- `rez-shared`

Keep these out of scope for the workspace unless a later ADR changes that:

- `Hotel OTA`
- `rezbackend`
- `rezapp`
- `rezadmin`
- `rezmerchant`
- Hotel PMS code

### Why this is the best fit

- these services already share contracts, env assumptions, and rollout concerns
- most recent defects were drift defects, not product-feature defects
- this gets workspace benefits without forcing repo consolidation
- `npm` workspaces are the lowest-change path from the current setup

### Phase Steps

1. add one root `package.json` with the adopted workspace membership
2. add root scripts for install, build, and targeted test runs
3. make `rez-shared` a first-class workspace package dependency
4. keep each service deployable on its own with local `package.json` scripts intact
5. introduce shared TypeScript/tooling baselines after the workspace lands

### Exit Criteria

- one documented workspace boundary exists
- one root install produces a consistent dependency tree for all included REZ services
- independent repo/deploy behavior is preserved
- CI can run workspace-aware build/test commands without custom per-service bootstrapping

### Risks

- deploy pipelines may assume standalone install behavior
- lockfile churn will be noisy during the transition

### Mitigation

- do not remove local service scripts during the migration
- migrate CI first in parallel before switching deploy automation

## Workstream 2: Dependency And Tooling Normalization

### Goal

Reduce version drift and align shared engineering conventions.

### Priority Targets

- Express
- Mongoose
- TypeScript
- Node version baseline
- Jest vs `node --test` strategy
- shared lint/format rules
- shared tsconfig base

### Recommendation

Normalize in this order:

1. Node version baseline
2. TypeScript
3. Express
4. Mongoose
5. test runner strategy
6. lint/format config

### Practical Baseline

- one root `.nvmrc` or equivalent runtime declaration
- one base `tsconfig`
- one preferred test model for new services
- one dependency review for all Express consumers before any major upgrade

### Important Note

Do not force every existing service onto the same test runner in one pass if the migration itself would reduce confidence. Standardize the default for new work first, then move older services in batches.

### Exit Criteria

- one documented Node baseline
- one documented TypeScript baseline
- one shared tsconfig base adopted by the included services
- Express major-version drift removed across the REZ services inside the workspace boundary
- CI enforces the chosen baselines

## Workstream 3: Root Structure Cleanup

### Goal

Make the root workspace easier to navigate and safer to operate in.

### Proposed Layout Direction

- `/services` or `/apps` for active REZ services
- `/shared` or `/packages` for `rez-shared`
- `/products` for Hotel OTA and similar product code that is intentionally separate
- `/docs` for living documentation
- `/archives` for historical material, old reports, or snapshots not needed for daily work

### Cleanup Rules

- do not move deploy-critical code without updating paths in CI/deploy config
- separate living docs from audit snapshots
- keep generated or one-off investigation material out of the main developer path

### Exit Criteria

- a new engineer can identify active code vs supporting docs vs archived material quickly
- root-level noise is reduced
- repo search results are less polluted by historical artifacts

## Workstream 4: Merchant Service Modularization

### Goal

Reduce the change surface and coupling inside `rez-merchant-service` without forcing an immediate microservice split.

### Recommendation

Start with modularization inside the existing deployment unit.

Suggested bounded modules:

- orders and fulfillment
- merchant settings and profile
- catalog/menu operations
- loyalty and customer growth
- analytics and reporting
- media and content
- operations and staffing
- finance and settlements

### Phase Steps

1. produce a route-to-domain inventory
2. define module folders and ownership boundaries
3. move route registration behind domain entrypoints
4. extract shared middleware and model utilities
5. add domain-level tests around the riskiest modules first

### What Not To Do First

- do not start by splitting into multiple deployable services
- do not start with wholesale model rewrites
- do not mix dependency normalization and merchant modularization in the same large PR

### Exit Criteria

- the main bootstrap file no longer directly wires every domain inline
- route and business logic are grouped by domain
- engineers can change one merchant domain with lower regression risk in others

## Suggested Milestones

### Milestone A: Repo Foundation

- record workspace ADR
- add root workspace manifest
- document migration rules

### Milestone B: Baseline Normalization

- align Node and TypeScript
- add shared tsconfig base
- align Express majors
- add root CI commands

### Milestone C: Root Cleanup

- move active code into clearer top-level structure
- isolate archives and investigation artifacts
- update docs to reflect the new layout

### Milestone D: Merchant Modularization

- create domain modules
- move route wiring behind domain entrypoints
- add domain-focused tests

## Recommended First 30 Days

Week 1:

- publish workspace ADR
- write migration RFC
- inventory service scripts, deploy assumptions, and Node versions

Week 2:

- add root workspace scaffolding
- add shared tsconfig base
- standardize root build/test entrypoints

Week 3:

- align TypeScript and Node baselines
- remove the highest-value dependency drift
- start root structure cleanup

Week 4:

- produce merchant-service domain map
- begin internal modularization with route registration cleanup

## Success Metrics

- root install/build/test becomes predictable
- dependency drift findings stop reappearing in audits
- cross-service fixes require fewer duplicated changes
- merchant-service PRs become smaller and easier to review
- onboarding time drops because repo boundaries are clearer

## Explicit Non-Goals

- no immediate rewrite of every service
- no forced migration of Hotel OTA or Hotel PMS into the REZ backend workspace unless separately approved
- no premature microservice split of `rez-merchant-service`

## Next Recommended Action

Start with a short architecture decision record that answers:

1. which directories belong in the active REZ backend workspace
2. which package manager/workspace model will be used
3. which services remain intentionally outside that boundary

That decision is now recorded in [ADR-001_DEVELOPMENT_WORKSPACE_STRATEGY.md](/Users/rejaulkarim/Documents/ReZ%20Full%20App/docs/ADR-001_DEVELOPMENT_WORKSPACE_STRATEGY.md). The next implementation step is to add the root workspace manifest and shared root scripts.
