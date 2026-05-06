# ReZ Error Knowledge Base

**Purpose**: Structured capture of every build, deployment, and runtime error with root cause, fix, and prevention.

---

## Schema

Every entry follows `docs/errors/00-SCHEMA.json`:

| Field | Required | Description |
|-------|----------|-------------|
| `error_id` | Yes | `ERR-{TYPE}-{SEQUENCE}` (e.g., `ERR-BUILD-001`) |
| `type` | Yes | `build` \| `deploy` \| `runtime` \| `ci` \| `security` |
| `subtype` | No | Specific error type (see schema) |
| `title` | Yes | Short description (max 80 chars) |
| `service` | Yes | Service name or `multiple` |
| `environment` | No | `production` \| `staging` \| `ci` \| `local` |
| `severity` | No | `critical` \| `high` \| `medium` \| `low` |
| `root_cause` | Yes | Why this happened |
| `fix` | Yes | What was done |
| `prevention` | Yes | How it won't happen again |
| `commit_id` | Yes | Git SHA of fix |
| `pr_number` | No | PR number |
| `issue_number` | No | GitHub issue |
| `date` | Yes | YYYY-MM-DD |
| `recurrence_count` | No | Times this pattern appeared |
| `tags` | No | Searchable labels |
| `logs` | No | Example error lines |
| `status` | Yes | `active` \| `resolved` \| `monitoring` |

---

## Entries by Type

### Build Errors (ERR-BUILD-*)

| error_id | Service | Title | Severity | Date | Status |
|----------|---------|-------|----------|------|--------|
| *(none yet)* | | | | | |

### Deployment Errors (ERR-DEPLOY-*)

| error_id | Service | Title | Severity | Date | Status |
|----------|---------|-------|----------|------|--------|
| *(none yet)* | | | | | |

### Runtime Errors (ERR-RUNTIME-*)

| error_id | Service | Title | Severity | Date | Status |
|----------|---------|-------|----------|------|--------|
| *(none yet)* | | | | | |

### CI Errors (ERR-CI-*)

| error_id | Service | Title | Severity | Date | Status |
|----------|---------|-------|----------|------|--------|
| *(none yet)* | | | | | |

### Security Errors (ERR-SECURITY-*)

| error_id | Service | Title | Severity | Date | Status |
|----------|---------|-------|----------|------|--------|
| *(none yet)* | | | | | |

---

## Most Common Patterns

*Run `npm run error-stats` to generate updated statistics.*

---

## Adding a New Error

1. Create `docs/errors/ERR-{TYPE}-{NNN}.json` following the schema
2. Update `docs/errors/00-INDEX.md` table above
3. Append to `docs/errors/ERRORS.json` (auto-generated registry)
4. Ensure PR includes prevention action (CI rule, test, or validation)
5. Never close a DEPLOY_ERROR issue without a prevention action

---

## Prevention Enforcement

Every DEPLOY_ERROR must have at least ONE prevention:

- `prevention.ci_rule_added` — CI script or validation
- `prevention.test_added` — Test case added
- `prevention.validation_added` — Input validation / type guard
- `prevention.architectural_constraint` — Arch fitness rule
- `prevention.runbook_entry` — Documentation
