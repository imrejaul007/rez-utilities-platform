# REZ API Gateway

Live URL: https://rez-api-gateway.onrender.com
Health check: https://rez-api-gateway.onrender.com/health
Stack: nginx 1.27-alpine, Docker, deployed on Render (Web Service)
Pattern: Strangler Fig — specific paths route to microservices; all other traffic routes to the monolith

---

## Purpose

The API Gateway is the single entry point for all REZ platform traffic. Clients (consumer app, merchant app, admin app, web menu) call one URL (`https://rez-api-gateway.onrender.com`) and nginx routes each request to the appropriate backend service based on the URL path prefix.

This implements the Strangler Fig pattern: microservices are carved out incrementally, each owning a path prefix, while the REZ monolith (`rez-backend`) handles everything else as the catch-all.

---

## How It Works

At container start, `start.sh` runs `envsubst` to replace all `${VAR}` placeholders in `nginx.conf.template` with runtime environment variable values, writing the resolved config to `/etc/nginx/nginx.conf`. nginx then starts in foreground mode (`daemon off`).

```
Client request
  → nginx receives on $PORT (default 10000)
  → Path-based routing matches location block
  → proxy_pass to target service URL
  → Service response returned to client
```

---

## Full Routing Table

| Path Prefix | Target Service | Env Var | Notes |
|-------------|----------------|---------|-------|
| `/api/search` | rez-search-service | `SEARCH_SERVICE_URL` | GET cached 5 min |
| `/api/catalog` | rez-catalog-service | `CATALOG_SERVICE_URL` | GET cached 10 min |
| `/api/orders` | rez-order-service | `ORDER_SERVICE_URL` | No cache, SSE support |
| `/api/merchant` | rez-merchant-service | `MERCHANT_SERVICE_URL` | Merchant rate limit |
| `/api/auth` | rez-auth-service | `AUTH_SERVICE_URL` | Strict rate limit 20r/min |
| `/api/payment` | rez-payment-service | `PAYMENT_SERVICE_URL` | No retry (idempotency) |
| `/api/wallet` | rez-wallet-service | `WALLET_SERVICE_URL` | GET cached 3 min (auth-keyed) |
| `/api/analytics` | rez-analytics-service | `ANALYTICS_SERVICE_URL` | GET cached 15 min |
| `/api/gamification` | rez-gamification-service | `GAMIFICATION_SERVICE_URL` | GET cached 5 min |
| `/api/finance` | rez-finance-service | `FINANCE_SERVICE_URL` | Never cached |
| `/api/admin/` | monolith | `MONOLITH_URL` | Stricter rate limit, no cache |
| `/` (catch-all) | monolith | `MONOLITH_URL` | GET cached 5 min |

### Live Service URLs (from render.yaml)

| Service | URL |
|---------|-----|
| Monolith | https://rez-backend-8dfu.onrender.com |
| Auth | https://rez-auth-service.onrender.com |
| Wallet | https://rez-wallet-service-36vo.onrender.com |
| Payment | https://rez-payment-service.onrender.com |
| Catalog | https://rez-catalog-service-1.onrender.com |
| Order | https://rez-order-service-hz18.onrender.com |
| Analytics | https://analytics-events-37yy.onrender.com |
| Gamification | https://rez-gamification-service-3b5d.onrender.com |
| Marketing | https://rez-marketing-service.onrender.com |
| Finance | https://rez-finance-service.onrender.com |
| Search | https://rez-search-service.onrender.com |
| Media | https://rez-media-events.onrender.com |

---

## Caching Strategy

nginx uses `proxy_cache_path /var/cache/nginx` with a 50 MB keys zone and 100 MB max size.

### Cache Rules by Route

| Route | Cache TTL | Cache Key | Notes |
|-------|-----------|-----------|-------|
| `/api/search` | 5 min | method + URI | Bypassed if `?nocache` or `?refresh` |
| `/api/catalog` | 10 min | method + URI | Less frequent updates |
| `/api/wallet` | 3 min | method + URI + Authorization | Per-user cache to avoid data leaks |
| `/api/analytics` | 15 min | method + URI + Authorization | Analytics data is slower-moving |
| `/api/gamification` | 5 min | method + URI + Authorization | Per-user |
| `/api/finance` | Never | — | `Cache-Control: no-store` enforced |
| `/api/admin/` | Never | — | `proxy_no_cache 1` |
| `/api/orders` | Never | — | Real-time data, SSE streams |
| `/api/payment` | Never | — | Payment routes never cached |
| `/` catch-all | 5 min | method + URI | Only unauthenticated GET requests |

**Cache bypass rules:**
- All non-GET/HEAD methods skip cache by default (`map $request_method $skip_cache`)
- Authenticated requests (`Authorization` header present) skip cache for most routes
- Query parameters `?nocache` or `?refresh` force bypass

**Stale cache:** On upstream error, timeout, or invalid headers, nginx serves stale cached data (`proxy_cache_use_stale error timeout invalid_header updating`).

---

## Rate Limiting

Three rate limit zones are defined:

| Zone | Key | Rate | Burst | Applied To |
|------|-----|------|-------|------------|
| `api_limit` | IP address | 50 req/s | 100 | `/api/search`, `/api/finance`, `/api/analytics`, catch-all |
| `auth_limit` | IP address | 20 req/min | 5 | `/api/auth` (OTP, login) |
| `merchant_limit` | Authorization header | 100 req/s | 50 | `/api/orders`, `/api/merchant`, `/api/wallet`, `/api/gamification`, `/api/admin/` |

All zones return HTTP `429 Too Many Requests` when the limit is exceeded.

---

## CORS Configuration

CORS is handled at the gateway layer. Upstream services strip their own CORS headers to prevent duplicates.

**Allowed origins (regex match):**
```
^https://(rez\.money|www\.rez\.money|menu\.rez\.money|admin\.rez\.money|merchant\.rez\.money|[a-z0-9\-]+\.vercel\.app)$
```

This covers all `*.rez.money` subdomains and all `*.vercel.app` preview/production deployments.

**Allowed methods:** `GET, POST, PUT, PATCH, DELETE, OPTIONS`

**Allowed headers:**
```
Content-Type, Authorization, X-Requested-With, X-CSRF-Token,
X-Rez-Region, X-Device-OS, X-Device-Fingerprint, X-Rez-Signature,
X-Provider-Name, X-App-Version, X-Correlation-ID, X-Request-ID
```

**Preflight:** OPTIONS requests return `204 No Content` immediately without proxying.

**Max-Age:** `86400` (24 hours) — browsers cache preflight results for 24 hours.

---

## Security Headers

Applied to all responses:

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `SAMEORIGIN` (admin routes use `DENY`) |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `X-Cache-Status` | nginx cache hit/miss status (debug aid) |
| `server_tokens` | `off` — nginx version not exposed |

---

## Trace ID Propagation

Every request gets a correlation ID for distributed tracing:

```nginx
set $trace_id $http_x_correlation_id;
if ($trace_id = "") { set $trace_id $request_id; }
proxy_set_header X-Correlation-ID $trace_id;
proxy_set_header X-Request-ID $trace_id;
```

If the client sends `X-Correlation-ID`, that value is forwarded to all upstream services. Otherwise, nginx generates a `$request_id` UUID and uses that. All services should log this header so requests can be traced across the system.

---

## Circuit Breaker / Retry

Passive circuit breaking via `proxy_next_upstream`:

```nginx
proxy_next_upstream error timeout http_502 http_503 http_504;
proxy_next_upstream_tries 2;       # At most 1 retry beyond the first attempt
proxy_next_upstream_timeout 10s;
```

On connection error, timeout, or 502/503/504, nginx retries once, then returns the error to the client.

**Payment routes are exempt:** `/api/payment` sets `proxy_next_upstream off` because a network timeout does not mean the payment transaction failed on the upstream side — retrying a payment is dangerous.

---

## Connection & Performance Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `worker_processes` | `auto` | One worker per CPU core |
| `worker_connections` | `8192` | Max concurrent connections per worker |
| `multi_accept` | `on` | Accept multiple connections per wake-up |
| `use epoll` | `on` | Linux epoll event model |
| `keepalive_timeout` | `65s` | HTTP keep-alive window |
| `proxy_connect_timeout` | `5s` | Upstream connect timeout |
| `proxy_send_timeout` | `30s` | Upstream write timeout |
| `proxy_read_timeout` | `60s` | Upstream read timeout (120s for orders/SSE) |
| `client_max_body_size` | `50M` | Max upload size |
| `gzip` | `on` (level 6) | Compresses JSON/text/JS responses >1 KB |

**Buffer settings** tuned for typical API response sizes (JSON, 10–100 KB):
- `proxy_buffer_size`: 8k
- `proxy_buffers`: 16 × 8k (128 KB total)
- `proxy_busy_buffers_size`: 16k

---

## Logging

Three log formats are defined:

**`main`** (access.log) — compact:
```
$remote_addr [$time_local] "$request" $status $body_bytes_sent $request_time upstream=$upstream_addr cache=$upstream_cache_status
```

**`detailed`** (detailed.log):
```
$remote_addr [$time_local] "$request" $status $body_bytes_sent ${request_time}s upstream=$upstream_addr upstream_time=${upstream_response_time}s cache=$upstream_cache_status bytes_sent=$bytes_sent
```

**`json`** (available but commented out) — structured JSON format for log aggregation tools.

---

## Health Endpoints

| Endpoint | Response |
|----------|----------|
| `GET /health` | `{"status":"ok","service":"rez-api-gateway","timestamp":"..."}` |
| `GET /health/services` | JSON map of all configured upstream service URLs |

`/health` is the Render health check path (configured in `render.yaml`). `/health/services` shows which URLs the gateway is currently routing to — useful for verifying env var injection.

---

## Environment Variables

All variables are injected at container start via `start.sh` → `envsubst`.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `10000` | Port nginx listens on (Render sets this dynamically) |
| `MONOLITH_URL` | `https://rez-backend-8dfu.onrender.com` | REZ monolith catch-all |
| `SEARCH_SERVICE_URL` | `https://rez-search-service.onrender.com` | Search microservice |
| `AUTH_SERVICE_URL` | `https://rez-auth-service.onrender.com` | Auth microservice |
| `PAYMENT_SERVICE_URL` | `https://rez-payment-service.onrender.com` | Payment microservice |
| `WALLET_SERVICE_URL` | `https://rez-wallet-service.onrender.com` | Wallet microservice |
| `MERCHANT_SERVICE_URL` | `https://rez-backend-8dfu.onrender.com` | Merchant (currently monolith) |
| `ORDER_SERVICE_URL` | `https://rez-order-service-hz18.onrender.com` | Order microservice |
| `CATALOG_SERVICE_URL` | `https://rez-catalog-service-1.onrender.com` | Catalog microservice |
| `MARKETING_SERVICE_URL` | `https://rez-marketing-service.onrender.com` | Marketing microservice |
| `ANALYTICS_SERVICE_URL` | `https://analytics-events-37yy.onrender.com` | Analytics microservice |
| `GAMIFICATION_SERVICE_URL` | `https://rez-gamification-service-3b5d.onrender.com` | Gamification microservice |
| `MEDIA_SERVICE_URL` | `https://rez-media-events.onrender.com` | Media events service |
| `FINANCE_SERVICE_URL` | `https://rez-finance-service.onrender.com` | Finance microservice |

---

## Adding a New Route

To add a new microservice route:

1. **Add env var** to `start.sh` with a default URL:
   ```sh
   export NEW_SERVICE_URL="${NEW_SERVICE_URL:-https://rez-new-service.onrender.com}"
   ```

2. **Add the echo line** in `start.sh` for startup log visibility.

3. **Add envsubst variable** to the `envsubst '...'` call in `start.sh`.

4. **Add map block** in `nginx.conf` (in the `http {}` section):
   ```nginx
   map $http_host $new_service_backend {
       default "${NEW_SERVICE_URL}";
   }
   ```

5. **Add location block** in `nginx.conf` (before the catch-all `/` block):
   ```nginx
   location /api/new-service {
       limit_req zone=api_limit burst=50 nodelay;
       proxy_pass $new_service_backend;
       proxy_ssl_server_name on;
   }
   ```

6. **Add env var** to `render.yaml` under `envVars`.

7. Deploy: push to main → Render auto-deploys.

---

## Deployment on Render

**Service type:** Web Service (Docker)
**Dockerfile:** `FROM nginx:1.27-alpine`
**Start command:** `/start.sh`
**Health check path:** `/health`
**Port:** Render injects `$PORT` at runtime (default 10000)

### Deploy steps

1. Push changes to the `rez-api-gateway` repo on the main branch.
2. Render detects the push and rebuilds the Docker image.
3. On container start, `start.sh` substitutes env vars and starts nginx.
4. Render performs a health check on `/health` before routing traffic.

### Updating env vars

Go to the Render dashboard → rez-api-gateway service → Environment → add/edit the variable → click "Save Changes". Render will restart the service automatically.

---

## Troubleshooting

### Gateway returns 502

- The upstream service is down or cold-starting (Render free tier sleeps).
- Check `/health/services` to confirm the URL is correct.
- Check the upstream service's own logs on Render.
- nginx will retry once before returning 502 to the client.

### CORS errors in browser

- Verify the client origin matches the CORS regex (`*.rez.money` or `*.vercel.app`).
- Check that the upstream service is not also sending CORS headers (gateway strips them via `proxy_hide_header`).
- OPTIONS preflight must return 204 — check nginx is running the OPTIONS block.

### Rate limit 429 errors

- Check which zone is triggering: `auth_limit` (20r/min for `/api/auth`), `api_limit` (50r/s general), `merchant_limit` (100r/s per auth token).
- For `/api/auth`, 20 requests/minute per IP is intentional (OTP abuse prevention).

### Cache not working

- Confirm the request is a GET without an `Authorization` header (most routes skip cache for authenticated requests).
- Check `X-Cache-Status` response header: `HIT`, `MISS`, `BYPASS`, `EXPIRED`.
- Append `?nocache=1` to force bypass and verify the upstream response is healthy.

### Checking nginx config syntax

```bash
docker exec <container> nginx -t
```

### Viewing logs

On Render, go to the service → Logs tab. nginx writes to stdout/stderr which Render captures.
