# REZ Pre-Push Verification Guide

Last updated: 2026-04-09
Scope: active backend workspace before pushing to `main`

## Prerequisites

1. Use Node `22.x` and npm `10.x`.
2. Run commands from the workspace root:
`/Users/rejaulkarim/Documents/ReZ Full App`
3. Ensure local changes are committed or stashed before verification.

## One-Time Workspace Check

1. Confirm active workspace members:
```bash
cat package.json
```
Expected: `rez-web-menu` is not in root `workspaces`.

2. Install dependencies from root:
```bash
npm install
```
Expected: install succeeds. Engine warnings are acceptable only if your local Node is below the required baseline.

## Required Pre-Push Commands

1. Build all workspace packages:
```bash
npm run build
```
Expected: exit code `0`.

2. Run workspace tests:
```bash
npm run test
```
Expected: exit code `0` on a normal local machine.

## If Tests Fail

1. `rez-payment-service` TypeScript error around `getPaymentStatus`:
Verify [paymentService.ts](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-payment-service/src/services/paymentService.ts) returns `Payment.findOne(query)` (not `.lean()` for `IPayment | null` return type).

2. `rez-merchant-service` Jest watchman issue:
`test` script already uses `jest --watchman=false` in [package.json](/Users/rejaulkarim/Documents/ReZ%20Full%20App/rez-merchant-service/package.json).

3. `rez-merchant-service` `EPERM listen 0.0.0.0` in restricted environments:
This is a sandbox/socket restriction, not necessarily a code regression.
Re-run merchant tests on a normal developer machine:
```bash
cd rez-merchant-service
npm test
```

## Optional Package-Level Verification

Use when debugging specific areas:

```bash
npm run build --workspace=rez-payment-service
npm run test --workspace=rez-payment-service
npm run build --workspace=rez-order-service
npm run test --workspace=rez-order-service
npm run build --workspace=rez-wallet-service
npm run test --workspace=rez-wallet-service
```

## 1-Minute Runtime Health Probe (Post-Deploy)

Use this when Render marks a deploy live and you want a fast runtime check:

```bash
BASE_URL="https://rez-marketing-service.onrender.com"

# Liveness (preferred), then fallback
curl -fsS "$BASE_URL/health/live" || curl -fsS "$BASE_URL/health"

# Readiness (preferred), then fallback
curl -fsS "$BASE_URL/health/ready" || curl -fsS "$BASE_URL/health"
```

Expected:
1. HTTP `200` on each command.
2. No restart loop in Render logs.
3. DB/Redis connection logs appear once at boot (not repeatedly reconnecting).

Notes:
1. Some legacy services expose only `/health`.
2. Worker-only services may have separate health ports (for example `:3001`) or no public readiness route.
3. To persist probe output in-repo (instead of temporary files), run:
```bash
./scripts/runtime-health-probe.sh
```
Saved reports: `docs/reports/runtime-health/`

## Exit Criteria Before Push

1. `npm run build` succeeds from root.
2. `npm run test` succeeds from root on a normal local environment.
3. No unintended workspace drift in root `package.json` or `package-lock.json`.
4. No reintroduced per-service `package-lock.json` files for active workspace services.
