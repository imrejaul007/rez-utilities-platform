# ADR-001: Development Workspace Strategy

Last updated: 2026-04-08
Status: Accepted

## Decision

Use `npm` workspaces at the `/ReZ Full App` root as a development monorepo, while keeping the existing service repositories independent for source control and deployment.

## Context

The current REZ backend ecosystem has these characteristics:

- multiple backend services already live as separate repos and deploy independently on Render
- the local `/ReZ Full App` directory already behaves like a practical monorepo during development
- several recent bugs were caused by cross-service drift rather than isolated logic errors
- `rez-shared` is a genuine shared package and benefits from first-class local workspace treatment

Moving everything into a single consolidated Git repo would be high disruption and low immediate product value. At the same time, keeping the current local setup completely unmanaged preserves the dependency and tooling drift that caused repeated defects.

## Accepted Approach

### Root strategy

- add a root `package.json` with `npm` workspaces
- treat the root as a development workspace only
- keep each service deployable and scriptable on its own
- keep each GitHub repository and Render deployment boundary intact

### In scope

- `rez-shared`
- `rez-auth-service`
- `rez-wallet-service`
- `rez-order-service`
- `rez-payment-service`
- `rez-merchant-service`
- `rez-catalog-service`
- `rez-search-service`
- `rez-gamification-service`
- `rez-ads-service`
- `rez-marketing-service`
- `rez-api-gateway`

### Out of scope

- `Hotel OTA`
- `rezbackend`
- `rezapp`
- `rezadmin`
- `rezmerchant`
- Hotel PMS code

These remain separate products or delivery units unless a later ADR changes that boundary.

### Deploy model

- each service continues deploying from its own repo
- the workspace is for local development, shared tooling, dependency alignment, and cross-package verification
- no deployment model change is implied by this ADR

## Why This Decision

### Benefits

- preserves the current repo and deploy topology
- reduces local dependency drift
- allows `rez-shared` to be consumed as a proper local workspace package
- enables root-level scripts for install, build, test, and type-check workflows
- creates a path to shared TypeScript and tooling baselines without repo consolidation

### Why `npm` workspaces

- lowest-change path from the current setup
- fits the existing package-manager habits in the repo
- avoids introducing a second major migration decision while the architecture cleanup is still underway

### Why not a single consolidated repo

- high Git/process disruption
- no immediate user-facing value
- would complicate current independent service deployment flows

### Why not keep the current unmanaged local layout

- repeated version drift and inconsistent installs are already proven problems
- shared package usage remains more fragile than it needs to be
- cross-service CI and type validation stay unnecessarily hard

## Consequences

### Positive

- one root install can manage active REZ backend service dependencies locally
- root scripts can standardize dev workflows
- `rez-shared` no longer depends on ad hoc local linking behavior

### Negative

- root lockfile churn will increase
- engineers need to understand the difference between workspace-local development and independent deployment repos
- CI and docs need follow-up work after the workspace is introduced

## Guardrails

- do not remove local service `package.json` scripts
- do not break standalone install/build behavior for any service during migration
- do not pull `Hotel OTA` or mobile apps into the workspace unless separately approved
- do not couple workspace adoption with a merchant-service refactor in the same rollout

## Immediate Follow-Up

1. add a root workspace manifest
2. add root scripts for install, build, and targeted test runs
3. make `rez-shared` a first-class workspace package dependency
4. add a shared TypeScript base config as the next normalization step

## Related Docs

- [ARCHITECTURE_EXECUTION_PLAN.md](/Users/rejaulkarim/Documents/ReZ%20Full%20App/docs/ARCHITECTURE_EXECUTION_PLAN.md)
- [CODEBASE_FIX_CHECKLIST.md](/Users/rejaulkarim/Documents/ReZ%20Full%20App/docs/CODEBASE_FIX_CHECKLIST.md)
