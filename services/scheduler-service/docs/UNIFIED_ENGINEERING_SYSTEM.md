# ReZ Unified Engineering System (UES)

**Purpose**: Single source of truth for how REZ builds, deploys, and learns from every engineering artifact across 20+ repositories.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    rez-devops-config                         │
│  Shared CI/CD workflows (.github/workflows/)                │
│  All repos reference: imrejaul007/rez-devops-config@main  │
└────────────────────────┬───────────────────────────────────┘
                          │ reusable workflows
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                     rez-error-intelligence                    │
│  Central error knowledge base (errors/ERRORS.json)         │
│  Auto-captures failures from all repos via webhook          │
└────────────────────────┬─────────────────────────────────────┘
                          │ error tracking
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                       rez-contracts                          │
│  Shared API schemas, types, Zod validators                  │
│  npm: @imrejaul007/rez-contracts                           │
└────────────────────────┬─────────────────────────────────────┘
                          │ shared types
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                  20+ Service Repositories                    │
│                                                              │
│  APPS          BACKEND       MICROSERVICES      SHARED      │
│  rez-merchant  rezbackend    rez-api-gateway   rez-shared  │
│  rezadmin      RestaurantHub rez-auth-service               │
│  rez-web-menu                rez-wallet-service             │
│  rez-now                    rez-payment-service              │
│  rez-app-consumer           rez-order-service               │
│  adBazaar                   rez-merchant-service             │
│                             rez-catalog-service             │
│                             rez-search-service              │
│                             rez-gamification-service        │
│                             rez-karma-service               │
│                             rez-ads-service                 │
│                             rez-marketing-service           │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Repository Classification

Every repository is tagged by type:

| Tag | Description | Examples |
|-----|-------------|----------|
| 🟢 APPS | User-facing applications | `rez-app-consumer`, `rez-merchant`, `rezadmin`, `rez-now`, `adBazaar`, `rez-web-menu` |
| 🟡 BACKEND | Backend core | `rez-backend-master`, `RestaurantHub` |
| 🔵 MICROSERVICES | Independent services | `rez-auth-service`, `rez-wallet-service`, `rez-payment-service`, `rez-order-service`, `rez-merchant-service`, `rez-catalog-service`, `rez-search-service`, `rez-gamification-service`, `rez-karma-service`, `rez-ads-service`, `rez-marketing-service`, `rez-api-gateway` |
| 🟣 SHARED | Shared packages | `rez-shared` (`@karim4987498/shared`) |
| 🔴 DEVOPS | Infrastructure config | `rez-devops-config` |
| 🟠 INTELLIGENCE | Error tracking | `rez-error-intelligence` |
| 🟤 CONTRACTS | API contracts | `rez-contracts` |

---

## 2. Git Workflow

### Branch Naming

```
feature/<domain>/<short-description>    e.g., feature/wallet/coin-expiry-fix
fix/<domain>/<short-description>        e.g., fix/auth/session-timeout
hotfix/<domain>/<critical-fix>          e.g., hotfix/payment/stripe-webhook
chore/<task>                            e.g., chore/update-deps
docs/<topic>                            e.g., docs/api-contracts
```

### Rules (enforced by branch protection)

- ❌ No direct push to `main`
- ✅ PR required for all changes
- ✅ All CI checks must pass
- ✅ Minimum 1 approval required
- ✅ Branch must be up to date with `main`
- ✅ Admins subject to same rules

### Developer Flow

```bash
# 1. Create branch
git checkout -b feature/wallet/coin-expiry-fix

# 2. Make changes, commit
git add .
git commit -m "fix(wallet): add coin expiry enforcement"

# 3. Push and create PR
git push origin feature/wallet/coin-expiry-fix
# → Create PR on GitHub with template

# 4. After approval and CI pass → Merge to main
# → Auto-deploys via GitHub Actions
```

### PR Requirements

Every PR description **must** include:

```markdown
Fixes #<issue_number>        # Link to GitHub issue

Root Cause:                  # For bugs: WHY did this happen?
Fix:                         # WHAT was changed?
Prevention:                   # HOW will it not happen again?

Checklist:
- [ ] CI passes
- [ ] Architecture fitness tests pass
- [ ] Prevention action added (test, CI rule, or validation)
```

---

## 3. CI/CD Pipeline

### CI Runs on Every PR

Each service has a dedicated CI workflow (`.github/workflows/`):

| Workflow | Services | Path |
|----------|----------|------|
| `backend-ci.yml` | Monolith + microservices (auth, wallet, payment, merchant, order) | [backend-ci.yml](.github/workflows/backend-ci.yml) |
| `rez-catalog-service-ci.yml` | Catalog | [rez-catalog-service-ci.yml](.github/workflows/rez-catalog-service-ci.yml) |
| `rez-search-service-ci.yml` | Search | [rez-search-service-ci.yml](.github/workflows/rez-search-service-ci.yml) |
| `rez-gamification-service-ci.yml` | Gamification | [rez-gamification-service-ci.yml](.github/workflows/rez-gamification-service-ci.yml) |
| `rez-ads-service-ci.yml` | Ads | [rez-ads-service-ci.yml](.github/workflows/rez-ads-service-ci.yml) |
| `rez-marketing-service-ci.yml` | Marketing | [rez-marketing-service-ci.yml](.github/workflows/rez-marketing-service-ci.yml) |
| `rez-karma-service-ci.yml` | Karma | [karma-service-ci.yml](.github/workflows/karma-service-ci.yml) |
| `rez-now-ci.yml` | REZ Now | [rez-now-ci.yml](.github/workflows/rez-now-ci.yml) |
| `rez-app-consumer-ci.yml` | Consumer App | [rez-app-consumer-ci.yml](.github/workflows/rez-app-consumer-ci.yml) |
| `rezmerchant-ci.yml` | Merchant App | [rezmerchant-ci.yml](.github/workflows/rezmerchant-ci.yml) |
| `rezadmin-ci.yml` | Admin Dashboard | [rezadmin-ci.yml](.github/workflows/rezadmin-ci.yml) |
| `web-menu-ci.yml` | Web Menu | [web-menu-ci.yml](.github/workflows/web-menu-ci.yml) |
| `arch-fitness.yml` | Architecture fitness tests | [arch-fitness.yml](.github/workflows/arch-fitness.yml) |
| `security-pentest.yml` | Security scanning | [security-pentest.yml](.github/workflows/security-pentest.yml) |

### CI Stages

1. **Install** — `npm ci`
2. **Type Check** — `tsc --noEmit`
3. **Lint** — `eslint` + `prettier`
4. **Test** — `npm test` with coverage upload
5. **Build** — `npm run build`
6. **Architecture Fitness** — 5 grep-based checks
7. **Security Audit** — `npm audit --audit-level=high`
8. **CI Gate** — all-or-nothing success gate

### Architecture Fitness Tests

| Test | What it checks | Location |
|------|---------------|----------|
| No bespoke buttons | UI imports from `@rez/rez-ui` | [scripts/arch-fitness/no-bespoke-buttons.sh](scripts/arch-fitness/no-bespoke-buttons.sh) |
| No console.* logs | Uses `rez-shared/telemetry` | [scripts/arch-fitness/no-console-log.sh](scripts/arch-fitness/no-console-log.sh) |
| No Math.random() for IDs | Uses `crypto.randomUUID()` | [scripts/arch-fitness/no-math-random-for-ids.sh](scripts/arch-fitness/no-math-random-for-ids.sh) |
| No bespoke idempotency | Uses `rez-shared/idempotency` | [scripts/arch-fitness/no-bespoke-idempotency.sh](scripts/arch-fitness/no-bespoke-idempotency.sh) |
| No bespoke enums | Uses `rez-shared/enums` | [scripts/arch-fitness/no-bespoke-enums.sh](scripts/arch-fitness/no-bespoke-enums.sh) |

---

## 4. Deployment

### Trigger

Push to `main` → GitHub Actions → Deploy

### By Platform

| Platform | Services | Config |
|----------|----------|--------|
| **Vercel** | `rez-merchant`, `rezadmin`, `rez-web-menu`, `rez-now`, `rez-app-consumer` | [deploy-vercel.yml](.github/workflows/deploy-vercel.yml) |
| **Render** | `rezbackend`, `rez-auth-service`, `rez-wallet-service`, `rez-payment-service`, `rez-order-service`, `rez-merchant-service` | [deploy-render.yml](.github/workflows/deploy-render.yml) |

### Required Secrets (per repo)

```bash
# Vercel (frontend repos)
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Render (backend repos)
RENDER_API_TOKEN
RENDER_SERVICE_ID

# Shared
GH_TOKEN
SLACK_BOT_TOKEN  # for deployment notifications
```

---

## 5. Bug Tracking

### Issue Templates

Every repo has templates in `.github/ISSUE_TEMPLATE/`:

| Template | Use for | Location |
|----------|---------|----------|
| `00-BUG.yml` | Bug reports | [.github/ISSUE_TEMPLATE/00-BUG.yml](.github/ISSUE_TEMPLATE/00-BUG.yml) |
| `01-DEPLOY_ERROR.yml` | Build/deploy/runtime errors | [.github/ISSUE_TEMPLATE/01-DEPLOY_ERROR.yml](.github/ISSUE_TEMPLATE/01-DEPLOY_ERROR.yml) |
| `02-FEATURE.yml` | Feature requests | [.github/ISSUE_TEMPLATE/02-FEATURE.yml](.github/ISSUE_TEMPLATE/02-FEATURE.yml) |

### Required Fields for Bugs

- Severity (Critical / High / Medium / Low)
- Type (Frontend / Backend / Gateway / Auth / Payment / etc.)
- Steps to Reproduce
- Expected vs Actual Result
- Root Cause (filled by engineer)
- Prevention (filled by engineer)

### Bug Workflow

```text
Bug discovered → GitHub Issue created → Engineer assigned
    → Root cause analysis → Fix implemented → PR created
    → CI passes → Merged → Issue closed → BURN_DOWN updated
```

### Burn-Down Dashboard

```bash
npm run burn-down   # Regenerate docs/BURN_DOWN_DASHBOARD.md
```

---

## 6. Error Intelligence System

### Central Error Intelligence

All errors across 20+ repos are tracked in **`rez-error-intelligence`**.

**Error Format**:
```
[REPO][TYPE] Short description
```
Examples:
- `[WALLET][BUILD] Missing mongoose@8.17.2 dependency`
- `[GATEWAY][DEPLOY] Missing API_KEY environment variable`
- `[PAYMENT][RUNTIME] Stripe webhook signature mismatch`

**Error ID Format**: `ERR-{TYPE}-{NNN}`
- `ERR-BUILD-001`, `ERR-DEPLOY-042`, `ERR-RUNTIME-017`, `ERR-CI-003`, `ERR-SECURITY-001`

### Error Knowledge Base

Location: `docs/errors/` (local) + `rez-error-intelligence/errors/` (canonical)

Schema: [docs/errors/00-SCHEMA.json](docs/errors/00-SCHEMA.json)

```bash
# Add a new error
npm run error-add -- --type deploy --title "..." --service ... --root-cause "..." --fix "..." --ci-rule "..."

# List errors
npm run error-kb list --type deploy

# Show statistics
npm run error-stats
```

### Error Capture Flow

```text
Deployment runs
     ↓
Error occurs in CI/Render/Vercel
     ↓
GitHub Issue auto-created in rez-error-intelligence
     (via .github/workflows/capture-error.yml)
     ↓
Engineer investigates → Root Cause + Fix + Prevention
     ↓
Fix PR in source repo
     ↓
PR description: "Fixes rez-error-intelligence#<issue>"
     ↓
Prevention verified in PR checklist
     ↓
Issue closed with ERR-* ID assigned
```

### Prevention Enforcement

Every DEPLOY_ERROR must have **at least one** prevention:

| Prevention | Description |
|-----------|-------------|
| `prevention.ci_rule_added` | CI script or validation added |
| `prevention.test_added` | Test case added |
| `prevention.validation_added` | Input validation at system boundary |
| `prevention.architectural_constraint` | Added to arch fitness rules |
| `prevention.runbook_entry` | Added to docs/runbooks/ |

---

## 7. API Contracts

### rez-contracts

Centralized schemas, types, and Zod validators for all services.

```bash
npm install @imrejaul007/rez-contracts
```

```typescript
import { validateTransaction, validateCoinEntry } from '@imrejaul007/rez-contracts/validation';
import type { Transaction, CoinEntry } from '@imrejaul007/rez-contracts/types';

// Validate at system boundary
const result = validateTransaction(incomingData);
if (!result.success) {
  throw new ValidationError(result.error);
}
```

Schemas: [rez-contracts/schemas/](rez-contracts/schemas/)
Types: [rez-contracts/types/](rez-contracts/types/)
Validators: [rez-contracts/validation/](rez-contracts/validation/)

---

## 8. Shared DevOps Infrastructure

### rez-devops-config

Central repository with reusable GitHub Actions workflows. All repos reference these:

```yaml
# In any repo's .github/workflows/ci.yml
ci:
  uses: imrejaul007/rez-devops-config/.github/workflows/ci.yml@main
  with:
    service_name: my-service
    node_version: '20'
    run_tests: true
    run_lint: true
    run_typecheck: true
    run_build: true
    run_arch_fitness: true
    mongodb_service: true
    redis_service: true
  secrets:
    GH_TOKEN: ${{ secrets.GH_TOKEN }}
```

### Reusable Workflows

| Workflow | Purpose | Location |
|----------|---------|----------|
| `ci.yml` | Standard CI pipeline | [rez-devops-config/.github/workflows/ci.yml](rez-devops-config/.github/workflows/ci.yml) |
| `deploy.yml` | Standard deployment | [rez-devops-config/.github/workflows/deploy.yml](rez-devops-config/.github/workflows/deploy.yml) |
| `pr-gate.yml` | PR requirements check | [rez-devops-config/.github/workflows/pr-gate.yml](rez-devops-config/.github/workflows/pr-gate.yml) |

---

## 9. One-Time Setup

Run these once after cloning:

### Step 1: Apply Branch Protection

> **Note**: Branch protection on private repositories requires **GitHub Pro** ($4/mo) or a **GitHub Organization** with paid seats. On the free plan, repository admins can always push directly. CI workflows will still run and enforce quality gates, but they won't block merges.

```bash
export GITHUB_TOKEN=ghp_...   # Personal Access Token with repo scope
bash scripts/setup-branch-protection.sh
```

If you see `⚠ requires GitHub Pro`, either:
1. **Upgrade to GitHub Pro** (recommended for production)
2. **Create a GitHub Organization** and transfer repos — orgs on free tier also lack branch protection
3. **Manual setup**: Go to each repo → Settings → Branches → Add rule → `main`

### Step 2: Configure Repositories

```bash
export GITHUB_TOKEN=ghp_...
bash scripts/setup-repo-config.sh
```

### Step 3: Create New Repos

```bash
export GITHUB_TOKEN=ghp_...
bash scripts/create-new-repo.sh my-new-service microservice
bash scripts/create-new-repo.sh my-new-app nextjs
```

### Step 4: Set GitHub Variables

Set these in each repo's Settings > Variables:

| Variable | Value |
|----------|-------|
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_MERCHANT_PROJECT_ID` | Merchant app project |
| `VERCEL_ADMIN_PROJECT_ID` | Admin project |
| `VERCEL_WEB_MENU_PROJECT_ID` | Web menu project |
| `VERCEL_NOW_PROJECT_ID` | REZ Now project |
| `VERCEL_CONSUMER_PROJECT_ID` | Consumer app project |
| `RENDER_MONOLITH_SERVICE_ID` | Backend monolith |
| `RENDER_AUTH_SERVICE_ID` | Auth service |
| `RENDER_WALLET_SERVICE_ID` | Wallet service |
| `RENDER_PAYMENT_SERVICE_ID` | Payment service |
| `RENDER_ORDER_SERVICE_ID` | Order service |
| `RENDER_MERCHANT_SERVICE_ID` | Merchant service |

---

## 10. Quick Reference

### Essential Commands

```bash
# CI/CD
npm run build           # Build all workspaces
npm run test            # Test all workspaces
npm run lint            # Lint all workspaces
npm run typecheck      # TypeScript check all workspaces

# Bug tracking
npm run burn-down       # Generate burn-down dashboard
npm run error-add       # Add new error to knowledge base
npm run error-stats     # Show error statistics

# DevOps setup
bash scripts/setup-branch-protection.sh
bash scripts/setup-repo-config.sh
bash scripts/create-new-repo.sh <name> <type>
```

### Burn-Down Dashboard

Generated at: `docs/BURN_DOWN_DASHBOARD.md`

```bash
npm run burn-down   # Regenerate weekly
```

### Architecture Fitness

```bash
# Run locally
bash scripts/arch-fitness/no-bespoke-buttons.sh
bash scripts/arch-fitness/no-console-log.sh
bash scripts/arch-fitness/no-bespoke-idempotency.sh
bash scripts/arch-fitness/no-bespoke-enums.sh
bash scripts/arch-fitness/no-math-random-for-ids.sh
```

### Bug Fix Workflow

```text
1. Create issue: docs/Bugs/{NN}-{TITLE}.md
2. Create fix branch: fix/<domain>/<description>
3. Fix in source code
4. Add test case
5. Add prevention (CI rule / validation / arch fitness)
6. PR → CI → Review → Merge
7. Update BURN_DOWN_DASHBOARD.md
```

---

## 11. Governance

See [CLAUDE.md](CLAUDE.md) for:

- **Architectural Fitness Tests** — 5 enforceable rules
- **Bug Workflow** — structured bug → fix → prevention lifecycle
- **Escalation Matrix** — when to escalate, who to involve
- **Developer Rules** — code standards and conventions

---

## 12. What Was Built

| Component | Location | Status |
|-----------|----------|--------|
| GitHub Issue templates (BUG, DEPLOY_ERROR, FEATURE) | `.github/ISSUE_TEMPLATE/` | ✅ |
| GitHub PR template with root cause/fix/prevention | `.github/PULL_REQUEST_TEMPLATE.md` | ✅ |
| Error knowledge base (schema + registry + management script) | `docs/errors/` | ✅ |
| Central devops config repo | `rez-devops-config/` | ✅ |
| Central error intelligence repo | `rez-error-intelligence/` | ✅ |
| Central contracts repo | `rez-contracts/` | ✅ |
| CI for missing services (catalog, search, gamification, ads, marketing, now, consumer-app) | `.github/workflows/` | ✅ |
| Master deployment workflows (Vercel + Render) | `.github/workflows/deploy-*.yml` | ✅ |
| Branch protection + repo config setup scripts | `scripts/setup-*.sh` | ✅ |
| New repo creation script | `scripts/create-new-repo.sh` | ✅ |
| This documentation | `docs/UNIFIED_ENGINEERING_SYSTEM.md` | ✅ |

---

## 13. Deployment System — Setup

### Vercel (Frontend)

1. Go to [Vercel Dashboard](https://vercel.com)
2. Create projects for each app
3. Copy Project IDs to GitHub repo Settings > Variables
4. Add `VERCEL_TOKEN` to GitHub repo Settings > Secrets
5. Workflows auto-deploy on push to `main`

### Render (Backend)

1. Go to [Render Dashboard](https://render.com)
2. Create Web Services for each backend service
3. Copy Service IDs to GitHub repo Settings > Variables
4. Add `RENDER_API_KEY` to GitHub repo Settings > Secrets
5. Workflows auto-deploy on push to `main` via Render API

### GitHub Actions Secrets

Each repo needs these secrets (Settings > Secrets > Actions):

```
VERCEL_TOKEN         — Vercel API token
VERCEL_ORG_ID        — Vercel org ID
VERCEL_*_PROJECT_ID  — Per-app project IDs
RENDER_API_KEY       — Render API key
SLACK_BOT_TOKEN      — Slack notifications
GH_TOKEN             — GitHub token (use secrets.GITHUB_TOKEN)
```
