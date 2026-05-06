# Runtime Health Reports

This folder stores **permanent runtime probe snapshots** for deployed services.

## How to Generate

Run from workspace root:

```bash
./scripts/runtime-health-probe.sh
```

Outputs:

- `YYYY-MM-DD-runtime-probe.md` (dated snapshot)
- `latest-runtime-probe.md` (latest copy)

## Current Focus

- `rez-backend` main health endpoint
- `rez-finance-service` health endpoints (`/health/live`, `/health/ready`, `/health`)
