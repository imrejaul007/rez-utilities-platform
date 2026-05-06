# Production Env Vars — Set These Immediately

**Date noted:** 2026-04-13  
**Action required:** Set in Render / Railway BEFORE next deploy

---

## Critical — Financial Integrity

```
REWARD_REZ_EXPIRY_DAYS=0
```
> REZ coins must never expire. The code defaults to 90 if this is not set. Users lose "permanent" coins after 90 days without this.

```
REWARD_BRANDED_EXPIRY_DAYS=180
```
> Branded coins expire in 6 months per merchant contract. The code defaults to 0 (never expires) if this is not set. Merchants paying for branded coins expect 6-month expiry.

---

## Required for Webhook Delivery (C7 fix)

```
WEBHOOK_SECRET=<generate-a-strong-random-secret>
```
> Used to sign HMAC-SHA256 `X-REZ-Signature` header on cross-app webhook deliveries. Generate with: `openssl rand -hex 32`  
> Set on: `rezbackend` service

---

## Where to Set

| Platform | Path |
|----------|------|
| Render | Dashboard → Service → Environment → Add Env Var |
| Railway | Project → Service → Variables |

Set `REWARD_REZ_EXPIRY_DAYS` and `REWARD_BRANDED_EXPIRY_DAYS` on the **rezbackend** service.  
Set `WEBHOOK_SECRET` on the **rezbackend** service.

---

## Verify After Setting

After the next deploy, call:
```
GET /api/wallet/config
```
Response should include:
```json
{
  "coinExpiryConfig": {
    "rez": 0,
    "branded": 180,
    "prive": 365,
    "promo": 90
  }
}
```
