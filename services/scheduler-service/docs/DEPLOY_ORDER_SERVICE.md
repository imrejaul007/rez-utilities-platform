# REZ-018: Deploy rez-order-service to Render

> Status: **BLOCKED — source code not committed to repo** (see Blocker section below)
> Last updated: 2026-04-15

---

## Blocker: Source Code Not Committed

The `rez-order-service` repo at `https://github.com/imrejaul007/rez-order-service` has **no TypeScript source files committed**. Only git internals and root config files (`package.json`, `tsconfig.json`, `render.yaml`) are present. The `src/` directory does not exist in the repo.

**Before deployment can proceed:**

1. Commit all source files to `rez-order-service`:
   ```bash
   cd /Users/rejaulkarim/Documents/ReZ\ Full\ App/rez-order-service
   git add src/ dist/ package.json tsconfig.json render.yaml
   git commit -m "feat: add rez-order-service source code"
   git push origin main
   ```

2. Verify source files are on GitHub:
   ```bash
   git ls-tree -r HEAD --name-only | grep "^src/" | head -20
   # Should list .ts files like src/httpServer.ts, src/worker.ts, etc.
   ```

---

## Render Service Setup (Once Source is Committed)

**GitHub repo:** https://github.com/imrejaul007/rez-order-service
**Branch:** `main`
**Render service name:** `rez-order-service`

### Option A: render.yaml (Recommended after fix)

Push the `render.yaml` to GitHub and Render will auto-deploy. See the render.yaml section below for required fixes.

### Option B: Manual Render Dashboard

1. Go to https://dashboard.render.com
2. Click **New +** → **Web Service**
3. Connect GitHub repo: `imrejaul007/rez-order-service`
4. Set branch: `main`
5. Fill in the fields below.

---

## Render Service Configuration

| Field | Value |
|-------|-------|
| **Name** | `rez-order-service` |
| **Region** | Singapore (or nearest) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/httpServer.js` |
| **Health Check Path** | `/health` |
| **Instance Type** | Starter (free tier) |

### Worker Service (rez-order-worker)

| Field | Value |
|-------|-------|
| **Name** | `rez-order-worker` |
| **Type** | Background Worker |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/worker.js` |

---

## Required Environment Variables

### Group: `rez-core` (required for all services)

| Key | Value / Note | Sync |
|-----|-------------|------|
| `NODE_ENV` | `production` | sync |
| `MONGODB_URI` | From rez-core group | **do not sync** |
| `REDIS_URL` | From rez-core group | **do not sync** |
| `SENTRY_DSN` | From rez-core group | **do not sync** |

### Service-specific

| Key | Value / Note | Sync |
|-----|-------------|------|
| `PORT` | `4005` | sync |
| `ORDERS_CANCEL_ORCHESTRATOR_MODE` | `shadow` | sync |
| `RECEIPT_TOKEN_SECRET` | From per-service vars | **do not sync** |
| `REZ_COIN_TO_RUPEE_RATE` | `1` | sync |

---

## Env Vars Reference (Copy-Paste)

```
NODE_ENV=production
PORT=4005
ORDERS_CANCEL_ORCHESTRATOR_MODE=shadow
REZ_COIN_TO_RUPEE_RATE=1
# --- rez-core (sync: false) ---
MONGODB_URI=mongodb+srv://work_db_user:RmptskyDLFNSJGCA@cluster0.ku78x6g.mongodb.net/rez-app?retryWrites=true&w=majority&appName=Cluster0
REDIS_URL=redis://red-d760rlshg0os73bd8mp0:6379
SENTRY_DSN=https://138c07c22c015d41c23626fce16be643@o4511106544369664.ingest.de.sentry.io/4511106548301904
# --- service-specific (sync: false) ---
RECEIPT_TOKEN_SECRET=3322a7502b47d0aadaf9d236d0441dcb161bb5de34e7df13fbefaf491e054d2c
```

---

## Build & Start Scripts (from package.json)

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/httpServer.js",
    "start:worker": "node dist/worker.js",
    "start:combined": "node dist/index.js",
    "dev": "ts-node src/httpServer.ts"
  }
}
```

**Important:** The `render.yaml` currently says `npm start` but `npm start` runs `node dist/httpServer.js`. Verify the `startCommand` in Render matches `node dist/httpServer.js` (not just `npm start`).

---

## render.yaml Issues (Current vs. Required)

The existing `render.yaml` has several inconsistencies that should be fixed before pushing:

### Issue 1: `startCommand` uses npm (not node)
```yaml
# Current (may not work reliably)
startCommand: npm start

# Fix to explicit node command
startCommand: node dist/httpServer.js
```

### Issue 2: `env` instead of `runtime`
```yaml
# Current
env: node

# Fix
runtime: node
```

### Issue 3: `INTERNAL_SERVICE_TOKENS_JSON` not in reference
```yaml
# Current
- key: INTERNAL_SERVICE_TOKENS_JSON
  sync: false

# The reference env vars do not define INTERNAL_SERVICE_TOKENS_JSON for order-service.
# If the code doesn't require it, remove this line. If it does, verify the var name.
```

### Issue 4: Missing `CORS_ORIGIN` — only `CORS_ORIGIN` is in render.yaml but no value provided
The current render.yaml says:
```yaml
- key: CORS_ORIGIN
  value: https://rez.money,https://merchant.rez.money,https://admin.rez.money
```
This is hardcoded in render.yaml. For production, this should be `sync: false` with the full CORS list from rez-merchant-service's env vars.

### Corrected render.yaml (apply to `rez-order-service/render.yaml`)

```yaml
services:
  - type: web
    name: rez-order-service
    runtime: node
    repo: https://github.com/imrejaul007/rez-order-service
    branch: main
    buildCommand: npm install && npm run build
    startCommand: node dist/httpServer.js
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "4005"
      - key: ORDERS_CANCEL_ORCHESTRATOR_MODE
        value: shadow
      - key: REZ_COIN_TO_RUPEE_RATE
        value: "1"
      - key: MONGODB_URI
        sync: false
      - key: REDIS_URL
        sync: false
      - key: SENTRY_DSN
        sync: false
      - key: RECEIPT_TOKEN_SECRET
        sync: false
      - key: CORS_ORIGIN
        sync: false

  - type: worker
    name: rez-order-worker
    runtime: node
    repo: https://github.com/imrejaul007/rez-order-service
    branch: main
    buildCommand: npm install && npm run build
    startCommand: node dist/worker.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: REDIS_URL
        sync: false
      - key: SENTRY_DSN
        sync: false
```

---

## Link to REZ Dashboard

After deployment, add the service URL to the `rez-service-urls` environment group on Render:

```
ORDER_SERVICE_URL=https://rez-order-service.onrender.com
```

Sync to all services that call the order service (rez-backend, rez-merchant-service, rez-payment-service, etc.).

---

## Troubleshooting

### Health check failing after deploy
Verify the `/health` endpoint exists in `src/httpServer.ts`. If not, the service will return 404 for `GET /health`. Add a health route:

```typescript
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rez-order-service', ts: new Date().toISOString() });
});
```

### Worker not starting
The worker is a separate Render Background Worker service. Ensure it has its own service entry in the Render dashboard and its own env vars (MONGODB_URI, REDIS_URL, SENTRY_DSN).
