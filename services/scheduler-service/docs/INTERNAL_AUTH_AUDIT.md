# Internal Auth Audit

Last updated: 2026-04-08
Scope: `rez-auth-service`, `rez-order-service`, `rez-wallet-service`, `rez-payment-service`, `rez-finance-service`, `rez-marketing-service`

## Summary

Core services now support a two-layer internal-auth pattern:

- read `x-internal-token`
- require `x-internal-service`
- resolve the caller token from `INTERNAL_SERVICE_TOKENS_JSON`
- use `crypto.timingSafeEqual` with SHA-256 hashing (equal-length buffers)
- fail closed when env var is missing (`503` — not `403`, so callers know it is a config problem)

That is a stronger baseline than before. The main remaining issue is moving from service-level identity to capability-level scoping for the riskiest internal mutations.

## Confirmed Strengths

- fail-closed behavior in auth, order, wallet, payment, and finance services
- timing-safe comparison used everywhere (`timingSafeEqual` + SHA-256 on both sides)
- core services support scoped caller identity via `x-internal-service` + `INTERNAL_SERVICE_TOKENS_JSON`
- services do not silently bypass internal auth in development
- marketing fails closed and accepts `x-internal-token` while staying backward-compatible with `x-internal-key`
- consistent response baseline: `401` for missing/invalid credentials, `503` for missing server-side config
- 14 source-level access guard tests verify high-risk routes (payment, order, wallet, finance) stay behind middleware
- wallet, order, and finance internal mutation routes have structured `[WalletAudit]` / `[OrderAudit]` / `[InternalAudit]` / `[PartnerAudit]` log entries with correlationId, ip, and caller identity

## Confirmed Gaps

### 1. Capability-level scoping not yet implemented

Current scoping is service-level (who is calling), not capability-level (which operations are allowed). A compromised service token can call any internal endpoint on the target service.

**Risk:** blast radius within a service is not constrained.

**Status:** open.

## Resolved Gaps (this pass)

### Audit logging standardized

All wallet credit/debit/merchant-credit, order status/cancel, and finance bnpl/emi/score/partner-webhook routes now emit structured audit log entries. Source-level guard tests enforce that these remain present.

### Finance partner webhooks moved off shared internal token

Finance partner routes (`/finance/partner/webhook/:partnerId/*`) now use per-partner HMAC-SHA256 verification with `PARTNER_WEBHOOK_SECRET_{PARTNER_ID}` env vars. The raw request body is captured in `express.json`'s `verify` callback and attached as `req.rawBody` for signature validation. `requireInternalToken` is explicitly absent from these routes (enforced by access-guard test).

## Recommended Next Steps

1. Move toward capability-level scoping for the highest-risk internal mutations
2. Extend scoped-token enforcement and audit logging to non-core/internal bridge surfaces

## Source-Level Test Coverage

| Service | Test file |
|---------|-----------|
| `rez-payment-service` | [test/access-guards.test.js](../rez-payment-service/test/access-guards.test.js) |
| `rez-order-service` | [test/access-guards.test.js](../rez-order-service/test/access-guards.test.js) |
| `rez-wallet-service` | [test/access-guards.test.js](../rez-wallet-service/test/access-guards.test.js) |
| `rez-finance-service` | [test/access-guards.test.js](../rez-finance-service/test/access-guards.test.js) |
| `rez-finance-service` | [test/integration-guards.test.js](../rez-finance-service/test/integration-guards.test.js) |

---

## RestaurantHub Integration Auth Surface (added 2026-04-08)

The REZ ↔ RestaurantHub SSO bridge introduces a new auth surface.

### Token Map

| Direction | Token env var | Header | Endpoint |
|-----------|--------------|--------|---------|
| REZ JWT → RH JWT exchange | `REZ_JWT_SECRET` | Bearer body field | `POST /auth/rez-bridge` |
| REZ services → RH inbound webhooks | `INTERNAL_BRIDGE_TOKEN` | `x-internal-token` | `POST /webhooks/rez/*` |
| RH → REZ microservices (outbound) | Scoped token map | `X-Internal-Token` + `X-Internal-Service` | `rez-client` calls |

### Strengths

- Bridge token (`INTERNAL_BRIDGE_TOKEN`) is separate from the outbound service token — scoped blast radius
- Consent tier (0/1/2) gates all data flows — tier 0 users expose no REZ data regardless of auth state
- `rez-client` circuit breaker degrades gracefully without bypassing auth

### Gaps

- `INTERNAL_BRIDGE_TOKEN` is one shared secret for all inbound REZ webhook routes
- No per-webhook-route capability scoping
- Webhook routes do not emit structured audit logs on receipt

### Recommended

1. Add structured audit log entry on every received webhook (caller, route, merchantId, correlationId)
2. Scope `INTERNAL_BRIDGE_TOKEN` per source service once scoped-token rollout is complete
3. Add idempotency key check on webhook routes to prevent replay

Full integration documentation: [REZ_RESTAURANTHUB_INTEGRATION.md](./REZ_RESTAURANTHUB_INTEGRATION.md)
