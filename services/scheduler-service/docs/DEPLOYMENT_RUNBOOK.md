# REZ Production Deployment Runbook

**Version:** 1.0  
**Date:** April 7, 2026  
**Status:** PRODUCTION READY 🚀

---

## Pre-Deployment Checklist

### 1. Prerequisites
- [ ] All services build successfully (`npm run build`)
- [ ] All environment variables configured (see below)
- [ ] Database backups created
- [ ] Redis cluster healthy
- [ ] Monitoring and alerting configured
- [ ] Team briefed on rollout plan
- [ ] Rollback plan reviewed

### 2. Environment Configuration

Copy `.env.phase3.example` to `.env` and configure:

```bash
# Essential Services
NODE_ENV=production
PORT=5001 (rezbackend), 4005 (rez-merchant-service)

# Database
MONGODB_URI=mongodb+srv://...
REDIS_HOST=redis-cluster.internal
REDIS_PORT=6379
REDIS_PASSWORD=secure-password

# Job Queues
JOB_QUEUE_CONCURRENCY=8          # Increase for prod
JOB_QUEUE_MAX_RETRIES=5

# Email Service (choose one)
SENDGRID_API_KEY=...             # RECOMMENDED for production
# OR SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
# OR AWS_SES_REGION

# SMS Service (choose one)
TWILIO_ACCOUNT_SID=...           # RECOMMENDED for India
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
# OR AWS_SNS_REGION

# Push Notifications
FIREBASE_CREDENTIALS_JSON=/secure/path/to/firebase.json
# OR ONESIGNAL_API_KEY

# Circuit Breaker
CIRCUIT_BREAKER_THRESHOLD=50
CIRCUIT_BREAKER_RESET=30000

# Webhooks
WEBHOOK_TIMEOUT=10000
WEBHOOK_RETRY_POLICY=exponential
WEBHOOK_SECRET_KEY=long-secure-random-key

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=https://...
```

### 3. Secrets Management

Store sensitive values securely:

```bash
# Option 1: AWS Secrets Manager
SECRETS_SOURCE=aws
AWS_REGION=us-east-1

# Option 2: HashiCorp Vault
SECRETS_SOURCE=vault
VAULT_ADDR=https://vault.internal
VAULT_TOKEN=s.xxxxxxxxxxxxx

# Option 3: Environment Variables (dev/staging only)
SECRETS_SOURCE=env
```

---

## Deployment Steps

### Phase 1: Staging Deployment (24 hours)

```bash
# 1. Build all services
cd rezbackend/rez-backend-master && npm run build
cd rez-merchant-service && npm run build

# 2. Run tests
npm test
npm run test:integration

# 3. Deploy to staging
npm run deploy:staging

# 4. Validate
curl https://staging.rez.money/health/ready
curl https://staging-merchant.rez.money/health/ready
```

### Phase 2: Staging Validation (24 hours)

Monitor metrics for:
- ✅ Health checks passing
- ✅ Order creation working (5+ orders/min)
- ✅ Job queues processing (<100ms latency)
- ✅ Circuit breakers stable (0 opens)
- ✅ Error rate < 0.1%
- ✅ P99 latency < 500ms
- ✅ Webhook delivery success > 95%
- ✅ Zero data loss

**Validation Checklist:**
```bash
# Health checks
curl https://staging.rez.money/health/live
curl https://staging.rez.money/health/ready
curl https://staging.rez.money/health

# Metrics
curl https://staging.rez.money/metrics | grep 'job_queue\|circuit_breaker'

# Job queue status
curl https://staging.rez.money/api/admin/queues/status

# Circuit breaker status
curl https://staging.rez.money/api/admin/breakers/status
```

### Phase 3: Production Deployment (Canary)

```bash
# 1. Tag release
git tag -a v4.0.0 -m "REZ Phase 4: Production Utilities Integration"
git push origin v4.0.0

# 2. Deploy to production (canary: 10%)
npm run deploy:production --canary 10

# 3. Monitor for 1 hour
- Check error rates
- Check latency p99
- Check job queue depth
- Check circuit breaker status

# 4. Increase to 50% if healthy
npm run deploy:production --canary 50

# 5. Monitor for 2 hours

# 6. Full production deployment
npm run deploy:production --canary 100
```

### Phase 4: Production Validation (2-4 hours)

```bash
# Real-world testing
- Create 50+ test orders (validate rate limiting)
- Test email delivery (check logs, inbox)
- Test SMS delivery (real phone numbers)
- Test push notifications
- Trigger webhook events
- Validate error handling

# Production metrics
- Error rate target: < 0.1%
- P99 latency target: < 500ms
- Job queue backlog: < 1000 jobs
- Circuit breaker status: all CLOSED
```

---

## Monitoring Dashboard

### Key Metrics to Monitor

```bash
# REZBackend
GET /metrics

http_requests_total           # Total requests
http_request_duration_seconds # Latency distribution
job_queue_depth               # Pending jobs
circuit_breaker_state         # 0=CLOSED, 1=OPEN, 2=HALF_OPEN
error_rate                    # Percentage of errors
```

### Alerting Rules

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error Rate | > 1% | Page oncall |
| P99 Latency | > 1000ms | Alert, investigate |
| Job Queue Depth | > 5000 | Increase concurrency |
| Circuit Breaker OPEN | Any | Investigate service |
| Database Connection Pool | > 90% | Scale up |
| Memory Usage | > 85% | Restart if safe |

---

## Rollback Plan

### Quick Rollback (< 5 minutes)

```bash
# 1. Identify the issue
kubectl logs -f deployment/rezbackend --tail 100

# 2. Rollback to previous version
kubectl rollout undo deployment/rezbackend
kubectl rollout undo deployment/rez-merchant-service

# 3. Verify health
curl https://rez.money/health/ready
curl https://rez.money/health/live

# 4. Check metrics
# Wait 2-3 minutes for metrics to update
kubectl get pods                           # Check pod status
kubectl top pods                           # Check resource usage
```

### Manual Rollback (if automated fails)

```bash
# 1. Get previous stable version
git log --oneline -5

# 2. Checkout and deploy
git checkout v3.2.0
git push origin v3.2.0
npm run deploy:production

# 3. Validate
curl https://rez.money/health/ready
```

### Data Rollback (if data corruption)

```bash
# 1. Restore from pre-deployment backup
# Contact DevOps team to restore from snapshot

# 2. Verify data integrity
db.orders.aggregate([
  { $group: { _id: null, count: { $sum: 1 } } }
])

# 3. Check for missing data
# Run reconciliation jobs
```

---

## Troubleshooting

### Job Queue Backlog Growing

**Symptoms:** Queue depth increasing, jobs not processing

**Solution:**
```bash
# 1. Check processor logs
kubectl logs -l app=rezbackend -c processor

# 2. Increase concurrency
JOB_QUEUE_CONCURRENCY=16  # Increase from 4

# 3. Check service health
curl https://rez.money/api/admin/queues/status

# 4. If stuck, drain and restart
# Consult with senior engineer
```

### Circuit Breaker OPEN

**Symptoms:** Services degraded, circuit breaker status OPEN

**Solution:**
```bash
# 1. Identify failing service
curl https://rez.money/api/admin/breakers/status
# { "redis": { "state": "OPEN" }, ... }

# 2. Fix underlying issue
# e.g., if Redis is OPEN: restart Redis, check connectivity

# 3. Monitor reset (automatic after 30s)
# Watch circuit breaker status return to CLOSED

# 4. If not recovering, escalate
```

### Email Delivery Failures

**Symptoms:** Emails not sent, SendGrid/SMTP errors

**Solution:**
```bash
# 1. Check email queue logs
kubectl logs -l app=rezbackend | grep -i email

# 2. Verify credentials
echo $SENDGRID_API_KEY    # Should not be empty
echo $SMTP_HOST           # Should be valid SMTP server

# 3. Test service directly
curl -X POST https://rez.money/api/admin/test/email \
  -d '{"to":"test@example.com","subject":"Test"}'

# 4. If persisting, use fallback provider
# Update MAIL_PROVIDER env var, restart pods
```

---

## Post-Deployment

### 1. Announce to Teams
- REZ mobile app team
- REZ web team  
- Merchant app team
- Customer support team

### 2. Monitor for 24 hours
- Check health dashboards hourly
- Monitor error rates
- Check job queue metrics
- Review webhook delivery stats

### 3. Document Issues Found
- Any bugs discovered
- Performance notes
- User feedback
- Optimization opportunities

### 4. Celebrate! 🎉
All Phase 4 deployment complete!

---

## Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Oncall Engineer | [Name] | [Phone] | [Email] |
| DevOps Lead | [Name] | [Phone] | [Email] |
| Product Lead | [Name] | [Phone] | [Email] |

---

## Reference Links

- Health checks: https://rez.money/health/ready
- Metrics: https://rez.money/metrics
- Staging: https://staging.rez.money/health/ready
- Logs: CloudWatch / DataDog dashboard
- Alerts: PagerDuty on-call schedule

---

**Last Updated:** April 7, 2026  
**Next Review:** After production deployment
