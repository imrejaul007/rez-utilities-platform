# SA8: Code Duplication Inventory + Local Dev Setup
Generated: 2026-04-12 | Branch: audit/recovery-phase

---

## CRITICAL: FINANCIAL — Coin-to-Rupee Rate Divergence

| Service | Source | Default Value |
|---------|--------|---------------|
| `rez-wallet-service` | `COIN_TO_RUPEE_RATE` env var | **0.50** |
| `rezbackend` (monolith) | `REZ_COIN_TO_RUPEE_RATE` env var | **1.00** |

- Same transaction processed by wallet-service yields ₹0.50; same processed by monolith yields ₹1.00
- Env var name also differs — both default to different values if the variable is not set
- **Status: UNRESOLVED — requires business decision on canonical rate and deployment env var audit**

---

## CRITICAL: internalAuth Middleware — 9 Divergent Copies

| Service | File | Token Source | Scope Check | Fail Behavior |
|---------|------|-------------|-------------|---------------|
| rezbackend | `src/middleware/internalAuth.ts` | `INTERNAL_SERVICE_TOKEN` (single) | None | 401 |
| rez-merchant-service | `src/middleware/internalAuth.ts` | `INTERNAL_SERVICE_TOKENS_JSON` (scoped) | Per-service token list | 401 (fixed: now requires X-Internal-Service header) |
| rez-wallet-service | `src/middleware/internalAuth.ts` | `INTERNAL_SERVICE_TOKEN` | None | 401 |
| rez-auth-service | `src/middleware/internalAuth.ts` | `INTERNAL_SERVICE_TOKEN` | None | Passes in dev (no fail-close) |
| rez-order-service | `src/middleware/internalAuth.ts` | `INTERNAL_SERVICE_TOKEN` | None | 401 |
| rez-gamification-service | `src/middleware/internalAuth.ts` | `INTERNAL_SERVICE_TOKEN` | None | 401 |
| rez-notification-events | `src/middleware/internalAuth.ts` | `INTERNAL_SERVICE_TOKEN` | None | Passes if env missing |
| rez-marketing-service | `src/middleware/internalAuth.ts` | `INTERNAL_SERVICE_TOKEN` | None | 401 |
| rez-catalog-service | `src/middleware/internalAuth.ts` | `INTERNAL_SERVICE_TOKEN` | None | 401 |

**Risk**: Logged-out user tokens are accepted by wallet/payment/search/finance microservices because these services only verify the JWT signature — none of them check the Redis token blacklist maintained by rezbackend/rez-auth-service.

---

## CRITICAL: Token Blacklist Not Shared Across Services

- `rez-auth-service` maintains a Redis token blacklist (`tokenBlacklist:*` keys) on logout
- **Only rezbackend checks this blacklist** (in `requireAuth` middleware)
- `rez-wallet-service`, `rez-order-service`, `rez-payment-service`, `rez-gamification-service`, `rez-catalog-service` do NOT check the blacklist
- A logged-out user can make valid API calls to these services until token expiry

---

## CODE DUPLICATION INVENTORY

### Utility Functions Duplicated Across Apps

| Function | Occurrences | Files |
|----------|-------------|-------|
| `formatDate()` | 5+ | rezapp (3 util files) + rezmerchant (2 util files) |
| `formatPrice()` | 7+ | 5 rezapp util files + rezmerchant |
| `formatCurrency()` | 3 | rezapp (2) + rezmerchant (1) |
| `validateEmail()` | 3 | rezapp + rezmerchant (2) |
| `debounce()` | 3 | rezapp (2) + rezadmin (1) |
| `AuthContext` | 3 | One per app, independently implemented |
| `SocketContext` | 2 | rezapp + rezmerchant |

**Recommended fix**: Extract shared utilities to a `rez-shared` npm workspace package.

### Backend Business Constants — Scattered

| Value | File | Risk |
|-------|------|------|
| `taxRate = 0.05` | `orderCreateController.ts:905` | Tax rule change requires multi-file update |
| `FREE_DELIVERY_THRESHOLD = 500` | `orderCreateController.ts:930` | Same |
| `STANDARD_DELIVERY_FEE = 50` | `orderCreateController.ts:930` | Same |
| `COINS_PER_PAISE = 0.05` | `groupBuyRoutes.ts:22` | Inconsistent with main coin rate |
| Platform float ID | `orderCreateController.ts:1653`, `gameService.ts:526,622`, `admin/orders.ts:1190` | 4 hardcoded copies |

---

## LOCAL DEV SETUP

### Port Assignments
| Service | Port |
|---------|------|
| rezbackend (monolith) | 5000 |
| rez-auth-service | 4002 |
| rez-wallet-service | 4004 |
| rez-merchant-service | 4005 |
| rez-order-service | 4001 |
| rez-gamification-service | 4006 |
| rez-notification-events | 4007 (BullMQ worker only, no HTTP) |
| rez-marketing-service | 4008 |
| rez-catalog-service | 4003 |
| rez-payment-service | 4009 |

### Startup Order (dependency-aware)
1. MongoDB + Redis (prerequisites)
2. `rez-auth-service` (4002) — all services depend on JWT verification
3. `rezbackend` (5000) — Socket.IO lives here; token blacklist
4. `rez-wallet-service` (4004)
5. `rez-merchant-service` (4005)
6. `rez-order-service` (4001)
7. `rez-gamification-service` (4006), `rez-catalog-service` (4003), `rez-payment-service` (4009)
8. `rez-marketing-service` (4008), `rez-notification-events` (4007)

### Health Check URLs
- Monolith: `http://localhost:5000/health`
- Auth: `http://localhost:4002/health`
- Wallet: `http://localhost:4004/health`
- Merchant: `http://localhost:4005/health`

### Seed Scripts
```bash
cd rezbackend && npm run seed:dev      # users, merchants, products
cd rezbackend && npm run seed:coins    # coin transactions
cd rezbackend && npm run seed:gamification  # achievements, challenges
```

### Required Env Vars (local)
See `docs/static-analysis/` and `memory/reference_env_vars.md` for full list.
Key vars that diverge between services:
- `COIN_TO_RUPEE_RATE` (wallet-service) vs `REZ_COIN_TO_RUPEE_RATE` (monolith) — must be set consistently
- `INTERNAL_SERVICE_TOKEN` — must be identical across all services
- `JWT_SECRET` — user tokens; must match between rezbackend and rez-auth-service
- `JWT_MERCHANT_SECRET` — merchant tokens; must match between rezbackend and rez-merchant-service
