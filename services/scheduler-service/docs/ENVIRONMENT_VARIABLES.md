# Environment Variables Documentation

**Date:** April 8, 2026  
**Status:** ✅ **COMPLETE**  
**Scope:** Integration environment variables for AdBazaar and Hotel OTA

---

## Overview

All integration secrets and configuration are managed via environment variables. Use a secure secret management system (AWS Secrets Manager, HashiCorp Vault, or your platform provider) to store these values.

**Never commit secrets to git.**

---

## REZ Backend (rez-backend)

### AdBazaar Integration Variables

```bash
# AdBazaar Webhook Secret
# Used to verify HMAC-SHA256 signatures on incoming QR scan events
ADBAZAAR_WEBHOOK_SECRET=<generate-secure-random-key>

# AdBazaar Attribution Webhook URL
# REZ sends attribution events (visits, purchases) to this endpoint
ADBAZAAR_WEBHOOK_URL=https://api.adbazaar.com/webhooks/attribution

# AdBazaar Internal Key (optional, for service-to-service calls)
# Used if REZ needs to call AdBazaar internal endpoints
ADBAZAAR_INTERNAL_KEY=<generate-secure-random-key>
```

**Generation Script**:
```bash
# Generate a secure random key (32 bytes, 64 hex chars)
openssl rand -hex 32

# Output: 8f7a2c9d4e1b6c3f2a8e9d4c5f3a7b1e9c6d2f4a8b1e3d5f7c9a2b4e6f8d1a
```

**Where to Store**:
- **Render**: Settings → Environment variables
- **AWS**: Secrets Manager → Store secret
- **Vercel**: Settings → Environment variables
- **Local Dev**: `.env` file (never commit)

---

## Hotel OTA (hotel-ota)

### PMS Webhook Integration Variables

```bash
# PMS Webhook Secret
# Used to verify HMAC-SHA256 signatures on incoming PMS events
# Each hotel can have its own secret stored in the database
PMS_WEBHOOK_SECRET=<generate-secure-random-key>

# REZ Webhook URL
# Hotel OTA sends booking events to REZ via this endpoint
REZ_WEBHOOK_URL=https://api.rez.money/api/webhooks/hotel-attribution

# REZ Internal Token (if REZ requires internal auth)
# Used for service-to-service authentication between Hotel OTA and REZ
REZ_INTERNAL_TOKEN=<generate-secure-random-key>

# Hotel OTA Service Port
PORT=3000

# Database Connection
DATABASE_URL=postgresql://user:password@host:5432/hotel_ota_db

# Redis Connection (for scheduled jobs)
REDIS_URL=redis://user:password@host:6379/0
```

**Per-Hotel Configuration** (stored in database):
```sql
UPDATE "Hotel" SET
  pms_webhook_url = 'https://pms.hotelname.com/api/webhook',
  pms_webhook_secret = '<unique-secret-per-hotel>',
  pms_webhook_active = true
WHERE id = 'hotel_id';
```

---

## API Gateway (rez-api-gateway)

### Upstream Service URLs

```bash
# Backend Services (used for routing)
MONOLITH_URL=https://rez-backend-8dfu.onrender.com
SEARCH_SERVICE_URL=https://rez-search-service.onrender.com
AUTH_SERVICE_URL=https://rez-auth-service.onrender.com
PAYMENT_SERVICE_URL=https://rez-payment-service.onrender.com
WALLET_SERVICE_URL=https://rez-wallet-service-36vo.onrender.com
MERCHANT_SERVICE_URL=https://rez-merchant-service-n3q2.onrender.com
ORDER_SERVICE_URL=https://rez-order-service.onrender.com
CATALOG_SERVICE_URL=https://rez-catalog-service-1.onrender.com
MARKETING_SERVICE_URL=https://rez-marketing-service.onrender.com
ANALYTICS_SERVICE_URL=https://rez-analytics-service.onrender.com
GAMIFICATION_SERVICE_URL=https://rez-gamification-service-3b5d.onrender.com
MEDIA_SERVICE_URL=https://rez-media-service.onrender.com

# API Gateway Configuration
PORT=10000
```

---

## Secret Rotation

### Changing AdBazaar Secret

1. **Generate new secret**:
   ```bash
   ADBAZAAR_WEBHOOK_SECRET_NEW=$(openssl rand -hex 32)
   ```

2. **Update in secret manager**:
   - Keep both old and new secrets temporarily
   - Update `ADBAZAAR_WEBHOOK_SECRET` to new value

3. **Notify AdBazaar**:
   - Share new secret via secure channel
   - Confirm they've updated their signing key

4. **Monitor logs**:
   ```bash
   tail -f logs/adbazaar-webhook.log | grep signature
   ```

5. **After 7 days** (grace period):
   - Remove old secret from environment
   - Update documentation

### Changing PMS Secret

**Per-hotel rotation**:
1. Generate new secret for specific hotel
2. Update in database:
   ```sql
   UPDATE "Hotel" SET pms_webhook_secret = '<new-secret>'
   WHERE id = 'hotel_id';
   ```
3. Notify PMS provider
4. Monitor webhook delivery

**Global rotation** (if using shared secret):
1. Create temporary allowlist of both old and new secrets
2. Update code to accept both
3. Notify all integrating hotels
4. Wait for all to update (7-14 days)
5. Deprecate old secret

---

## Validation Checklist

Before deploying to production:

### ✅ AdBazaar Setup
```bash
# 1. Verify webhook secret is set and not empty
echo $ADBAZAAR_WEBHOOK_SECRET | wc -c  # Should be > 64

# 2. Verify webhook URL is valid
curl -s -o /dev/null -w "%{http_code}" $ADBAZAAR_WEBHOOK_URL

# 3. Test signature verification with test payload
PAYLOAD='{"eventId":"test"}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$ADBAZAAR_WEBHOOK_SECRET" | awk '{print $NF}')
echo "Test signature: $SIGNATURE"
```

### ✅ Hotel OTA Setup
```bash
# 1. Verify PMS secret is set
echo $PMS_WEBHOOK_SECRET | wc -c

# 2. Verify REZ webhook URL is accessible
curl -s -o /dev/null -w "%{http_code}" $REZ_WEBHOOK_URL

# 3. Verify database migrations are applied
psql $DATABASE_URL -c "\dt" | grep -i "coin_expiry\|pms_webhook"

# 4. Verify Redis connection for scheduled jobs
redis-cli -u $REDIS_URL ping
```

### ✅ API Gateway Setup
```bash
# 1. Verify all upstream URLs are accessible
for url in $MONOLITH_URL $SEARCH_SERVICE_URL $AUTH_SERVICE_URL; do
  curl -s -o /dev/null -w "$url: %{http_code}\n" $url/health
done

# 2. Check nginx configuration
nginx -t

# 3. Verify gateway is responding
curl https://rez-api-gateway.onrender.com/health
```

---

## Secret Management Best Practices

### 1. Use a Secrets Vault
- **AWS Secrets Manager**: Recommended for AWS deployments
- **HashiCorp Vault**: For self-hosted solutions
- **Render Secrets**: Built-in for Render deployments
- **Vercel Secrets**: Built-in for Vercel deployments

### 2. Access Control
```
Secret access should be:
- Restricted to service accounts
- Audited and logged
- Rotated regularly (every 90 days)
- Never exposed in logs
```

### 3. Development vs Production
```
Development (.env):
- Use dummy secrets
- Non-sensitive values only
- Local file, never committed

Production:
- Use vault/secrets manager
- Unique secrets per environment
- Automatic rotation enabled
- No local .env files
```

### 4. Logging
```typescript
// ✅ CORRECT - Never log secrets
logger.info('Webhook received', { eventId, hotelId });

// ❌ WRONG - Exposes secrets
logger.info('Using secret', { secret: WEBHOOK_SECRET });

// ❌ WRONG - Secrets in debug output
console.log(process.env);
```

---

## Emergency Secret Compromise

If a secret is compromised:

### Immediate Actions
1. Generate new secret immediately
2. Update in vault/secrets manager
3. Restart affected services
4. Enable increased logging/monitoring

### Within 1 Hour
1. Audit logs for unauthorized access
2. Check coin transaction history (AdBazaar)
3. Check PMS webhook event logs
4. Document incident details

### Within 24 Hours
1. Notify integration partner (AdBazaar/PMS)
2. Verify no fraudulent events processed
3. Update documentation
4. Brief security team

### Follow-up
1. Post-incident review
2. Update secret rotation policy
3. Improve secret storage/access controls
4. Add monitoring alerts for unexpected activity

---

## Environment Variable Reference Table

| Variable | Required | Service | Purpose | Renewal |
|----------|----------|---------|---------|---------|
| `ADBAZAAR_WEBHOOK_SECRET` | Yes | rez-backend | Verify QR scan events | 90 days |
| `ADBAZAAR_WEBHOOK_URL` | Yes | rez-backend | Send attribution events | Never |
| `ADBAZAAR_INTERNAL_KEY` | No | rez-backend | Internal service calls | 90 days |
| `PMS_WEBHOOK_SECRET` | Yes | hotel-ota | Verify PMS events | 90 days |
| `REZ_WEBHOOK_URL` | Yes | hotel-ota | Send booking events | Never |
| `REZ_INTERNAL_TOKEN` | No | hotel-ota | REZ authentication | 90 days |
| `DATABASE_URL` | Yes | hotel-ota | PostgreSQL connection | On rotation |
| `REDIS_URL` | Yes | hotel-ota | Redis for scheduled jobs | On rotation |

---

## Troubleshooting

### "Invalid Signature" Errors

```
Problem: Webhook signature verification failing

Check:
1. Is the secret in both places the same?
   - Vault/secrets manager
   - Environment variable loaded in container
   
2. Is payload being compared correctly?
   - Must use raw request body (not parsed JSON)
   - Must use exact bytes sent (no re-encoding)
   
3. Is signature algorithm correct?
   - HMAC-SHA256 (not MD5 or SHA1)
   - Hex output format
   
Solution:
1. Compare secrets (first 4 chars): echo $SECRET | head -c 4
2. Test with curl and openssl
3. Check logs for payload differences
4. Regenerate secret and try again
```

### "Environment Variable Not Set"

```
Problem: Service startup fails with missing variable

Check:
1. Is variable defined in platform settings?
   - Render: Settings → Environment
   - Vercel: Settings → Environment variables
   
2. Is variable properly loaded in code?
   - Check: console.log(process.env.VARIABLE_NAME)
   
3. Is service restarted after setting variable?
   - Sometimes requires redeploy

Solution:
1. Set variable in platform UI
2. Redeploy service
3. Verify in logs: [ENV] Variable loaded
```

---

## Related Documentation

- [INTEGRATION_ENDPOINTS.md](INTEGRATION_ENDPOINTS.md) - API endpoints and request/response formats
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Pre-deployment checklist
- [MONITORING_GUIDE.md](MONITORING_GUIDE.md) - Monitoring and alerting
- [INTEGRATION_RUNBOOK.md](INTEGRATION_RUNBOOK.md) - Full integration guide

---

**Generated:** April 8, 2026  
**Last Updated:** April 8, 2026  
**Prepared By:** REZ Development Team (claude-flow)
