# Deployment Checklist

**Date:** April 8, 2026  
**Status:** ✅ **READY FOR DEPLOYMENT**  
**Scope:** AdBazaar + Hotel OTA + REZ Backend Integration

---

## Unified QR (menu.rez.money) — Required Before App Store Release

See full guide: [UNIFIED_QR_SETUP.md](UNIFIED_QR_SETUP.md)

- [ ] **Replace SHA256 fingerprint** in `dist/.well-known/assetlinks.json` with actual Android signing cert fingerprint
  - Get from Play Console → App signing → SHA-256, or run `keytool -list -v -keystore release.keystore`
- [ ] **Trigger EAS build** (native config change — OTA will not work)
  ```bash
  eas build --platform ios --profile production
  eas build --platform android --profile production
  ```
- [ ] **Verify `.well-known/` files are live** after Vercel deploy:
  ```bash
  curl -s https://menu.rez.money/.well-known/apple-app-site-association | jq .
  curl -s https://menu.rez.money/.well-known/assetlinks.json | jq .
  ```
  Both must return JSON (not HTML)

---

## Pre-Deployment Phase (Before Code Deployment)

### Environment Setup
- [ ] Generate webhook secrets (AdBazaar, PMS)
  ```bash
  openssl rand -hex 32
  ```
- [ ] Store secrets in vault/secrets manager
  - [ ] ADBAZAAR_WEBHOOK_SECRET
  - [ ] PMS_WEBHOOK_SECRET
  - [ ] REZ_WEBHOOK_URL (Hotel OTA → REZ)
  - [ ] ADBAZAAR_WEBHOOK_URL (REZ → AdBazaar)

- [ ] Verify upstream service URLs
  - [ ] REZ Backend is reachable
  - [ ] Hotel OTA API is reachable
  - [ ] API Gateway is healthy

### Infrastructure Verification
- [ ] Database connectivity (PostgreSQL)
  - [ ] Hotel OTA database is accessible
  - [ ] Migration scripts can run
  
- [ ] Redis connectivity (for scheduled jobs)
  - [ ] Redis instance is running
  - [ ] Connection credentials are correct
  
- [ ] Network/Firewall
  - [ ] Inbound ports open (webhook traffic)
  - [ ] Outbound connectivity to partners
  - [ ] SSL/TLS certificates valid

### Partner Notification
- [ ] Notify AdBazaar team
  - [ ] Shared new webhook secret securely
  - [ ] Confirmed webhook URL: `/api/webhooks/adbazaar/qr-scan`
  - [ ] Request acknowledgment
  
- [ ] Notify PMS providers
  - [ ] For each hotel: shared PMS webhook secret
  - [ ] Confirmed endpoint: `/api/webhooks/pms/*`
  - [ ] Scheduled testing window

---

## Code Deployment Phase

### REZ Backend Deployment

```bash
# 1. Pull latest code
cd rezbackend/rez-backend-master
git pull origin main

# 2. Verify code changes
git log --oneline -5 | grep -i adbazaar  # Should see: Add AdBazaar webhook endpoint

# 3. Install dependencies (if needed)
npm install

# 4. Run linter
npm run lint

# 5. Run tests
npm test

# 6. Build
npm run build

# 7. Deploy to production
# Platform-specific: Render/AWS/etc will auto-deploy on push to main
```

**Post-deployment verification**:
```bash
# 8. Check service is healthy
curl https://api.rez.money/health

# 9. Check logs for startup messages
tail -f logs/server.log | grep -E 'AdBazaar|webhook|listening'

# 10. Test endpoint manually
curl -X POST https://api.rez.money/api/webhooks/adbazaar/qr-scan \
  -H "Content-Type: application/json" \
  -H "X-Signature: test_signature" \
  -d '{"eventId":"test"}'
# Should get: 401 Unauthorized (invalid signature expected)
```

**Status Check**:
- [ ] Code deployed to `imrejaul007/rez-backend` ✅
- [ ] No critical errors in logs
- [ ] Webhook endpoint is accessible
- [ ] Signature verification is working

---

### Hotel OTA Deployment

```bash
# 1. Pull latest code
cd hotel-ota
git pull origin main

# 2. Verify code changes
git log --oneline -5 | grep -i "pms\|webhook\|migration"

# 3. Install dependencies (if needed)
npm install --workspace=apps/api

# 4. Run linter
npm run lint --workspace=apps/api

# 5. Run tests
npm test --workspace=apps/api

# 6. Verify Prisma migration
npm run db:generate

# 7. Build
npm run build --workspace=apps/api

# 8. Deploy
# Platform-specific deployment (Render/AWS will auto-deploy on push)
```

**Post-deployment verification**:
```bash
# 9. Check service is healthy
curl https://hotelota.api/health

# 10. Check logs
tail -f logs/api.log | grep -E 'PMS|webhook|Scheduler'

# 11. Verify migrations were applied
psql $DATABASE_URL -c "SELECT name FROM migrations ORDER BY applied_at DESC LIMIT 5"
# Should include: 20260407_coin_expiry_and_pms_webhook

# 12. Test scheduled jobs initialized
tail -f logs/scheduler.log | grep "initialized successfully"

# 13. Test webhook endpoint
curl -X POST https://hotelota.api/api/webhooks/pms/reservation-confirmed \
  -H "Content-Type: application/json" \
  -H "X-Signature: test_signature" \
  -d '{"eventId":"test"}'
# Should get: 400 Bad Request (invalid payload expected)
```

**Status Check**:
- [ ] Code deployed to `imrejaul007/hotel-ota` ✅
- [ ] Database migrations applied
- [ ] No critical errors in logs
- [ ] Scheduled jobs initialized
- [ ] Webhook endpoints accessible

---

### API Gateway Deployment

```bash
# 1. Pull latest code
cd rez-api-gateway
git pull origin main

# 2. Verify configuration
diff nginx.conf nginx.conf.backup | head -20

# 3. Validate nginx syntax
nginx -t

# 4. Build Docker image
docker build -t rez-api-gateway:latest .

# 5. Deploy (platform-specific)
# Render will auto-deploy on push to main
```

**Post-deployment verification**:
```bash
# 6. Check health endpoint
curl https://rez-api-gateway.onrender.com/health
# Should return: {"status":"ok","service":"rez-api-gateway"}

# 7. Check upstream services status
curl https://rez-api-gateway.onrender.com/health/services
# Should show all upstream service URLs

# 8. Test routing
curl https://rez-api-gateway.onrender.com/api/search/test
# Should route to search service

# 9. Monitor logs for errors
tail -f logs/gateway.log | grep -E 'error|502|503'
```

**Status Check**:
- [ ] Code deployed to `imrejaul007/rez-api-gateway` ✅
- [ ] Nginx configuration is valid
- [ ] Health endpoint responding
- [ ] All upstream services showing

---

## Integration Testing Phase

### AdBazaar Integration Test

```bash
# 1. Generate valid signature
PAYLOAD='{"eventId":"test_001","eventType":"qr_scan","timestamp":"2026-04-08T12:00:00Z","campaignId":"camp_test","advertiserId":"adv_test","deviceId":"dev_test","qrCode":"https://test.adbazaar.com/qr/test","adFormat":"billboard","location":{"latitude":28.6139,"longitude":77.2090},"ipAddress":"203.0.113.42"}'

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$ADBAZAAR_WEBHOOK_SECRET" | awk '{print $NF}')

# 2. Send test webhook
curl -X POST https://api.rez.money/api/webhooks/adbazaar/qr-scan \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d "$PAYLOAD"

# Expected response: 200 OK with coinsAwarded

# 3. Verify in logs
tail -f logs/adbazaar-webhook.log | grep test_001

# 4. Check database (if applicable)
psql $REZDB -c "SELECT * FROM AdBazaarScan WHERE scanEventId = 'test_001' LIMIT 1"
```

**Checklist**:
- [ ] Webhook signature verification works
- [ ] Event is logged correctly
- [ ] Database record created (if applicable)
- [ ] Response includes coin amount

---

### Hotel OTA Integration Test

```bash
# 1. Generate valid PMS signature
PAYLOAD='{"eventId":"test_pms_001","eventType":"reservation.confirmed","timestamp":"2026-04-08T12:00:00Z","hotelId":"hotel_test","reservationData":{"reservationId":"res_001","guestEmail":"test@example.com","totalPrice":500,"currency":"INR"}}'

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$PMS_WEBHOOK_SECRET" | awk '{print $NF}')

# 2. Send test webhook
curl -X POST https://hotelota.api/api/webhooks/pms/reservation-confirmed \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d "$PAYLOAD"

# Expected response: 200 OK with coinsAwarded: 5

# 3. Verify in logs
tail -f logs/pms-webhook.log | grep test_pms_001

# 4. Check coin expiry schedule (should be set for 1 year out)
psql $HOTELOTA_DB -c "SELECT * FROM CoinExpirationSchedule WHERE id LIKE '%test%' LIMIT 1"
```

**Checklist**:
- [ ] PMS webhook signature verification works
- [ ] Event is logged correctly
- [ ] Coins calculated correctly (₹500 = 5 coins)
- [ ] Coin expiration scheduled (1 year out)

---

### Scheduled Jobs Test

```bash
# 1. Verify coin expiry job scheduled
redis-cli -u $REDIS_URL ZRANGE bull:coin-expiry:repeat 0 -1 WITHSCORES

# 2. Check scheduler logs
tail -f logs/scheduler.log | grep "Coin Expiry\|Settlement\|Tier Update"

# 3. Trigger coin expiry job manually (if needed)
curl -X POST https://hotelota.api/admin/jobs/trigger-coin-expiry \
  -H "X-Internal-Token: $INTERNAL_TOKEN"

# 4. Verify coins were expired
tail -f logs/coin-expiry.log | tail -20
```

**Checklist**:
- [ ] Coin expiry job is scheduled
- [ ] Settlement batch job is scheduled
- [ ] PMS inventory sync is scheduled
- [ ] All jobs showing in Redis queue

---

## Production Validation Phase

### Monitoring Setup
- [ ] Logs are being collected
  - [ ] REZ Backend logs → CloudWatch/LogRocket
  - [ ] Hotel OTA logs → CloudWatch/LogRocket
  - [ ] API Gateway logs → CloudWatch/LogRocket

- [ ] Metrics are being tracked
  - [ ] Webhook latency
  - [ ] Error rates
  - [ ] Signature verification failures
  - [ ] Coin transaction volume

- [ ] Alerts are configured
  - [ ] High error rate (>1%)
  - [ ] Signature verification failures
  - [ ] Database connection errors
  - [ ] Redis connection errors

### Performance Baseline
```bash
# 1. Test webhook latency
for i in {1..10}; do
  time curl -X POST https://api.rez.money/api/webhooks/adbazaar/qr-scan \
    -H "X-Signature: $SIGNATURE" \
    -d "$PAYLOAD"
done

# Should be: <500ms per request (with signature verification)

# 2. Load test (caution: low volume)
ab -n 100 -c 10 -p payload.json \
  -H "X-Signature: $SIGNATURE" \
  https://api.rez.money/api/webhooks/adbazaar/qr-scan
```

**Checklist**:
- [ ] P50 latency < 300ms
- [ ] P99 latency < 1000ms
- [ ] Error rate < 0.1%
- [ ] Database query time < 100ms

---

## Post-Deployment Verification (24 hours)

### System Health
- [ ] All services are running (CPU/Memory normal)
  ```bash
  curl https://api.rez.money/health
  curl https://hotelota.api/health
  curl https://rez-api-gateway.onrender.com/health
  ```

- [ ] Database is healthy
  - [ ] Connection pool status
  - [ ] Query performance
  - [ ] Migration status

- [ ] Redis is healthy
  - [ ] Connection established
  - [ ] Queue status
  - [ ] Job processing

### Real Event Processing
- [ ] AdBazaar has sent real QR scan events
  - [ ] Check logs: `tail -f logs/adbazaar-webhook.log | grep "success"`
  - [ ] Verify coins credited
  - [ ] Check signature verification pass rate

- [ ] PMS has sent real reservation events
  - [ ] Check logs: `tail -f logs/pms-webhook.log | grep "success"`
  - [ ] Verify coins awarded
  - [ ] Check coin expiration schedules

### Data Integrity
- [ ] Coin transactions are correctly recorded
  ```sql
  SELECT COUNT(*) as total, COUNT(DISTINCT userId) as unique_users
  FROM CoinTransaction
  WHERE createdAt > now() - interval '24 hours'
    AND source = 'adbazaar_qr' OR source = 'hotel_booking';
  ```

- [ ] No duplicate events processed
  ```sql
  SELECT eventId, COUNT(*) as count
  FROM AdBazaarScan
  WHERE scannedAt > now() - interval '24 hours'
  GROUP BY eventId
  HAVING COUNT(*) > 1;
  ```

- [ ] Coin expiration dates are correct
  ```sql
  SELECT COUNT(*) as total_scheduled,
    COUNT(CASE WHEN expirationDate > now() + interval '365 days' THEN 1 END) as future,
    COUNT(CASE WHEN expirationDate < now() - interval '1 day' THEN 1 END) as past
  FROM CoinExpirationSchedule;
  ```

---

## Rollback Plan

If critical issues found during deployment:

### Immediate Rollback (within 1 hour)
```bash
# REZ Backend
cd rezbackend/rez-backend-master
git revert <commit-hash>
git push origin main
# Render auto-redeploys

# Hotel OTA
cd hotel-ota
git revert <commit-hash>
git push origin main
# Render auto-redeploys

# API Gateway
cd rez-api-gateway
git revert <commit-hash>
git push origin main
# Render auto-redeploys
```

### Disable Integration (if secrets compromised)
```bash
# Disable AdBazaar webhook processing
export ADBAZAAR_WEBHOOK_ENABLED=false

# Disable PMS webhook processing
export PMS_WEBHOOK_ENABLED=false

# Disable scheduled jobs
export JOB_SCHEDULER_ENABLED=false
```

### Database Rollback
```bash
# If Prisma migration caused issues
npx prisma migrate resolve --rolled-back 20260407_coin_expiry_and_pms_webhook

# Verify schema is correct
npx prisma db push --skip-generate
```

---

## Success Criteria

All of the following must be true:

- ✅ All services deployed and healthy (24h no critical errors)
- ✅ AdBazaar webhooks processing successfully (>99% success rate)
- ✅ Hotel OTA webhooks processing successfully (>99% success rate)
- ✅ Scheduled jobs running on time (coin expiry, settlement, etc.)
- ✅ Signature verification working (0 false negatives, <0.1% false positives)
- ✅ Coin transactions correctly recorded and attributed
- ✅ No duplicate event processing
- ✅ Coin expiration dates correctly set (1 year from award)
- ✅ Partner integration partners confirmed receipt (email/Slack)
- ✅ Monitoring and alerting in place
- ✅ Runbooks and documentation complete

---

## Sign-Off

**Backend Engineer**: ___________________ **Date**: ___________

**DevOps Engineer**: ___________________ **Date**: ___________

**Integration Partner Contact**: _________ **Date**: ___________

**Product Lead**: _______________________ **Date**: ___________

---

## Related Documentation

- [INTEGRATION_ENDPOINTS.md](INTEGRATION_ENDPOINTS.md) - API endpoints
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - Secrets and config
- [MONITORING_GUIDE.md](MONITORING_GUIDE.md) - Monitoring setup
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- [INTEGRATION_RUNBOOK.md](INTEGRATION_RUNBOOK.md) - Full runbook

---

**Generated:** April 8, 2026  
**Last Updated:** April 8, 2026  
**Prepared By:** REZ Development Team (claude-flow)
