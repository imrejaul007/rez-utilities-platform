# REZ-017: Deploy rez-ads-service to Render

> Status: READY TO DEPLOY (source committed, render.yaml present)
> Last updated: 2026-04-15

---

## Prerequisites

- GitHub repo: https://github.com/imrejaul007/rez-ads-service
- Branch: `main`
- Source files: committed and pushed
- Health endpoint: `GET /health` (returns `{ status: 'ok', service: 'rez-ads-service' }`)

---

## Render Service Setup

**Render service name:** `rez-ads-service`
**Runtime:** Node.js
**Health check path:** `/health`

### Option A: Connect via render.yaml (Recommended)

The repo already has a `render.yaml` at the root. Push it to GitHub and Render will auto-deploy.

```bash
cd /Users/rejaulkarim/Documents/ReZ\ Full\ App/rez-ads-service
git add render.yaml
git commit -m "chore: add render.yaml for auto-deploy"
git push origin main
```

Render will detect the `render.yaml` and create the service automatically on first push.

### Option B: Manual Render Dashboard

1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Connect GitHub repo: `imrejaul007/rez-ads-service`
4. Set branch: `main`
5. Fill in the fields below.

---

## Render Service Configuration

| Field | Value |
|-------|-------|
| **Name** | `rez-ads-service` |
| **Region** | Singapore (or nearest) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/index.js` |
| **Health Check Path** | `/health` |
| **Instance Type** | Starter (free tier) — upgrade to Starter+ ($7/mo) for production |

---

## Required Environment Variables

### Group: `rez-core` (required for all services)

| Key | Value / Note | Sync |
|-----|-------------|------|
| `NODE_ENV` | `production` | sync |
| `MONGODB_URI` | From rez-core group — MongoDB connection string | **do not sync** |
| `REDIS_URL` | From rez-core group — Redis connection string | **do not sync** |
| `JWT_SECRET` | From rez-core group — used by validateEnv() | **do not sync** |
| `INTERNAL_SERVICE_KEY` | From rez-core group — internal service auth | **do not sync** |
| `SENTRY_DSN` | From rez-core group | **do not sync** |
| `LOG_LEVEL` | `info` | sync |

### Service-specific

| Key | Value / Note | Sync |
|-----|-------------|------|
| `PORT` | `4007` | sync |
| `JWT_MERCHANT_SECRET` | From per-service unique vars — merchant JWT signing | **do not sync** |

---

## Env Vars Reference (Copy-Paste)

```
NODE_ENV=production
PORT=4007
# --- rez-core (sync: false) ---
MONGODB_URI=mongodb+srv://work_db_user:RmptskyDLFNSJGCA@cluster0.ku78x6g.mongodb.net/rez-app?retryWrites=true&w=majority&appName=Cluster0
REDIS_URL=redis://red-d760rlshg0os73bd8mp0:6379
JWT_SECRET=0e4fad97728117c816f6f954aa55e6dbd774208b50831f09471e769e2fcda835c93eedcb8ca4e4cf13f5ee52c96dbe2e1fc9ce8eb2a8fc07eb125dd5997b5bc5
INTERNAL_SERVICE_KEY=fa62f9959a629e0ae9f2748c0ce078eb340e3f4eef808d52c52fe4c350d4a5b9
SENTRY_DSN=https://138c07c22c015d41c23626fce16be643@o4511106544369664.ingest.de.sentry.io/4511106548301904
# --- service-specific (sync: false) ---
JWT_MERCHANT_SECRET=f9c6f4e77a7a477d34f00bc972d2d5da171770ca3ed8647343557286f7a9cad2e56aadef2c5b73bd52e32c7c306dbfac9d8116141981207da866d1881b75de86
```

> **Security note:** `MONGODB_URI`, `REDIS_URL`, `JWT_SECRET`, `INTERNAL_SERVICE_KEY`, `SENTRY_DSN`, and `JWT_MERCHANT_SECRET` are secrets. Set `sync: false` on Render so they are not committed to git history.

---

## Routes

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/health` | GET | None | Health check |
| `/merchant/ads` | ALL | Merchant JWT | Merchant ad management |
| `/admin/ads` | ALL | Admin JWT | Admin review & approval |
| `/ads` | GET | None | Consumer ad serving |

---

## Build & Start Scripts (from package.json)

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "tsc --noEmit"
  }
}
```

---

## Link to REZ Dashboard

After deployment, add the service URL to the `rez-service-urls` environment group on Render:

```
ADS_SERVICE_URL=https://rez-ads-service.onrender.com
```

Then sync that group to all services that call the ads service (rez-backend, rez-merchant-service, etc.).

---

## Troubleshooting

### Service exits on startup
Check logs for `JWT_SECRET is required` — the service calls `validateEnv()` on boot and exits if `JWT_SECRET` is missing.

### Health check failing
The `/health` endpoint returns JSON `{ status: 'ok', service: 'rez-ads-service' }`. If it returns after startup logs, the service is ready.

### Build fails on Render
Ensure `node_modules` is in `.gitignore` — Render must run `npm install` from scratch.
