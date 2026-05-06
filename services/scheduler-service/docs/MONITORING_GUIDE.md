# Monitoring & Observability Guide

**Date:** April 8, 2026  
**Status:** ✅ **READY FOR DEPLOYMENT**  
**Scope:** Integration monitoring, alerting, and observability

---

## Overview

This guide covers monitoring strategies for the AdBazaar and Hotel OTA integrations, including metrics collection, logging, alerting, and incident response.

---

## Key Metrics to Track

### Webhook Metrics

| Metric | Target | Alert Threshold | Description |
|--------|--------|-----------------|-------------|
| **Success Rate** | >99% | <95% | Percentage of webhooks processed successfully |
| **Latency P50** | <300ms | >500ms | Median webhook processing time |
| **Latency P99** | <1000ms | >2000ms | 99th percentile processing time |
| **Error Rate** | <0.1% | >1% | Percentage of failed webhook requests |
| **Signature Failures** | ~0% | >10 per hour | Invalid HMAC-SHA256 signatures |
| **Duplicate Events** | 0 | Any | Same event processed twice |

### Coin Transaction Metrics

| Metric | Target | Alert Threshold | Description |
|--------|--------|-----------------|-------------|
| **AdBazaar QR Scans/hour** | 100-1000 | <50 or >5000 | Event volume baseline |
| **Hotel Bookings/day** | 10-100 | <5 or >500 | Event volume baseline |
| **Avg Coins Awarded** | 5-50 | <1 or >100 | Check for calculation errors |
| **Coin Expiry Rate** | 5-10% | <1% or >20% | Percentage of coins expired |
| **Failed Coin Credits** | <0.1% | >1% | Database transaction failures |

### System Metrics

| Metric | Target | Alert Threshold | Description |
|--------|--------|-----------------|-------------|
| **Database Response Time** | <100ms | >500ms | Query latency |
| **Redis Response Time** | <50ms | >200ms | Cache latency |
| **API Gateway Latency** | <300ms | >1000ms | Request routing time |
| **Memory Usage** | <80% | >90% | Service memory consumption |
| **CPU Usage** | <70% | >85% | Service CPU usage |
| **Disk Space** | >20% free | <10% free | Available disk space |

---

## Logging Strategy

### Log Levels

```
ERROR   — Critical failures (database errors, invalid signatures, crashes)
WARN    — Warning conditions (slow queries, high latency, near-limit events)
INFO    — Normal operations (webhook received, coins awarded, job completed)
DEBUG   — Detailed debugging (payload dumps, signature details, intermediate steps)
```

### Log Format

All logs should include:
```json
{
  "timestamp": "2026-04-08T12:34:56.789Z",
  "level": "INFO",
  "service": "rez-backend",
  "context": "adbazaar-webhook",
  "eventId": "evt_123",
  "message": "QR scan processed",
  "coinsAwarded": 10,
  "processingTimeMs": 125,
  "userId": "user_456"
}
```

### Key Log Patterns

**AdBazaar Webhook**:
```
[AdBazaar] QR scan webhook received
[AdBazaar] QR scan processed — coins credited
[AdBazaar] Webhook handler error
[AdBazaar] Invalid webhook signature
[AdBazaar] Duplicate scanEventId rejected
```

**Hotel OTA Webhook**:
```
[PMS] Reservation confirmed webhook received
[PMS] Reservation processed — coins awarded
[PMS] Guest check-in webhook received
[PMS] Webhook handler error
[PMS] Invalid webhook signature
```

**Scheduled Jobs**:
```
[Scheduler] Coin Expiry Job started
[Scheduler] Coin Expiry Job completed
[Coin Expiry] 150 coins expired for user_123
[Settlement] Settlement batch 2026-04-08 processing
[Tier Update] User tier updated: basic → silver
```

---

## Log Aggregation & Search

### CloudWatch Logs (AWS)

```bash
# View recent logs
aws logs tail /aws/rez/api --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/rez/api \
  --filter-pattern "ERROR"

# Search for AdBazaar events
aws logs filter-log-events \
  --log-group-name /aws/rez/api \
  --filter-pattern "[..., context=\"adbazaar-webhook\", ...]"

# Search for signature failures
aws logs filter-log-events \
  --log-group-name /aws/rez/api \
  --filter-pattern "signature"
```

### Render Logs

```bash
# SSH into Render service and view logs
curl https://api.onrender.com/logs | tail -100

# Or use Render CLI
render logs --service=rez-backend --tail=100
```

### Local Logs

```bash
# Tail logs
tail -f logs/adbazaar-webhook.log
tail -f logs/pms-webhook.log
tail -f logs/scheduler.log

# Search logs
grep "ERROR" logs/*.log
grep "QR scan" logs/adbazaar-webhook.log | tail -50
grep "coin" logs/*.log | grep -i "expired"
```

---

## Metrics Collection

### Prometheus Metrics

```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

// Webhook metrics
const webhookCounter = new Counter({
  name: 'webhook_requests_total',
  help: 'Total webhook requests',
  labelNames: ['integration', 'status']
});

const webhookLatency = new Histogram({
  name: 'webhook_latency_seconds',
  help: 'Webhook processing latency',
  labelNames: ['integration'],
  buckets: [0.1, 0.3, 0.5, 1.0, 2.0, 5.0]
});

const coinAwardCounter = new Counter({
  name: 'coins_awarded_total',
  help: 'Total coins awarded',
  labelNames: ['source'],
  registers: [register]
});

// Usage
webhookCounter.labels('adbazaar', 'success').inc();
webhookLatency.labels('adbazaar').observe(processingTime);
coinAwardCounter.labels('adbazaar_qr').inc(coinsAwarded);
```

### StatsD Metrics

```typescript
const StatsD = require('node-statsd').StatsD;
const client = new StatsD();

// Webhook metrics
client.increment('webhook.requests', ['integration:adbazaar', 'status:success']);
client.timing('webhook.latency', processingTimeMs, ['integration:adbazaar']);
client.gauge('webhook.queue_size', queueLength, ['integration:adbazaar']);

// Coin metrics
client.increment('coins.awarded', coinsAwarded, ['source:adbazaar_qr']);
client.gauge('coins.expiring', expiringCoinCount, ['days_until:30']);
```

---

## Dashboards & Visualizations

### Key Dashboards

**1. Integration Health Dashboard**
- Webhook success rate (AdBazaar vs PMS)
- Error rate trend (24h)
- Latency percentiles (P50, P95, P99)
- Signature verification failures
- Event volume trend

**2. Coin Metrics Dashboard**
- Coins awarded today (by source)
- Coins expiring this month
- Failed coin credits (count)
- Average coins per transaction
- User breakdown (new vs repeat)

**3. System Health Dashboard**
- API response times (by endpoint)
- Database query latency
- Redis connectivity
- Memory and CPU usage
- Disk space remaining

**4. Business Metrics Dashboard**
- Daily active users (via coin earnings)
- Total coins in circulation
- Coins expired (last 30d)
- Revenue impact (estimated)
- Partner integration status

---

## Alerting Rules

### Critical Alerts (Page On-Call Engineer)

```yaml
# Webhook success rate drops below 95%
- alert: WebhookSuccessRateLow
  expr: rate(webhook_requests_total{status="failure"}[5m]) > 0.05
  for: 5m
  annotations:
    summary: "Webhook success rate below 95%"
    description: "{{ $value }}% of webhooks failing"

# High error rate in signature verification
- alert: SignatureVerificationFailures
  expr: rate(webhook_signature_failures_total[5m]) > 10
  for: 1m
  annotations:
    summary: "High signature verification failures ({{ $value }}/min)"
    description: "Check webhook secrets and integration partner configuration"

# Database connection errors
- alert: DatabaseConnectionError
  expr: database_connection_errors_total > 0
  for: 1m
  annotations:
    summary: "Database connection error"
    description: "Cannot connect to PostgreSQL database"

# Redis connection error
- alert: RedisConnectionError
  expr: redis_connection_up == 0
  for: 1m
  annotations:
    summary: "Redis connection lost"
    description: "Scheduled jobs and caching will be unavailable"

# Scheduled job failure
- alert: ScheduledJobFailure
  expr: job_execution_failures_total > 0
  for: 5m
  annotations:
    summary: "Scheduled job failed: {{ $labels.job }}"
    description: "{{ $value }} consecutive failures"
```

### Warning Alerts (Create Ticket)

```yaml
# Webhook latency elevated
- alert: WebhookLatencyHigh
  expr: histogram_quantile(0.99, webhook_latency_seconds) > 1.0
  for: 10m
  annotations:
    summary: "Webhook latency high (P99: {{ $value }}s)"
    description: "Check database performance and API gateway load"

# Event volume anomaly
- alert: EventVolumeAnomaly
  expr: |
    abs(rate(webhook_requests_total[1h]) - 
        avg_over_time(rate(webhook_requests_total[1h] offset 7d), 7d)) > 
    2 * stddev_over_time(rate(webhook_requests_total[1h] offset 7d), 7d)
  for: 30m
  annotations:
    summary: "Event volume anomaly detected"
    description: "Current: {{ $value }}, Expected: {{ $expected }}"

# High memory usage
- alert: HighMemoryUsage
  expr: memory_usage_percent > 85
  for: 15m
  annotations:
    summary: "Memory usage above 85%"
    description: "Consider scaling up or optimizing memory usage"

# Coin expiration queue backlog
- alert: CoinExpirationBacklog
  expr: job_queue_size{job="coin-expiry"} > 10000
  for: 1h
  annotations:
    summary: "Coin expiration job has backlog"
    description: "{{ $value }} coins waiting to expire"
```

---

## Incident Response

### Signature Verification Failures

**Symptoms**:
- High rate of 401 Unauthorized responses
- Logs show: "Invalid webhook signature"

**Root Causes**:
1. Secret mismatch between vault and environment
2. Partner changed their signing key without notifying
3. Payload encoding difference (JSON vs string)

**Investigation**:
```bash
# 1. Check current secret in logs (masked)
tail -f logs/webhooks.log | grep "signature"

# 2. Compare secrets
echo "Vault: $(vault kv get secret/adbazaar | grep webhook_secret | head -c 10)..."
echo "Env:   $(echo $ADBAZAAR_WEBHOOK_SECRET | head -c 10)..."

# 3. Test with known-good payload
SIGNATURE=$(echo -n '{"eventId":"test"}' | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}')
curl -X POST https://api.rez.money/api/webhooks/adbazaar/qr-scan \
  -H "X-Signature: $SIGNATURE" \
  -d '{"eventId":"test"}'
# Should return 200 (or 400 for bad payload, not 401)
```

**Resolution**:
1. Restart service with correct secret
2. Contact partner for confirmation of their signing key
3. Verify logs show success rate recovering

---

### High Error Rates

**Symptoms**:
- Webhook success rate < 95%
- Error logs showing database or parsing errors

**Investigation**:
```bash
# 1. Check error logs
tail -f logs/webhooks.log | grep ERROR | tail -50

# 2. Count errors by type
grep ERROR logs/webhooks.log | grep -o '"error":"[^"]*"' | sort | uniq -c | sort -rn

# 3. Check database connectivity
curl -s -o /dev/null -w "%{http_code}" $DATABASE_URL/health

# 4. Check API Gateway status
curl https://rez-api-gateway.onrender.com/health

# 5. Check recent code changes
git log --oneline -10
```

**Resolution**:
1. If database error: check connectivity and restart service
2. If parsing error: verify payload format with partner
3. If API Gateway issue: check nginx config and restart
4. Monitor error rate recovery

---

### Duplicate Events

**Symptoms**:
- Same eventId appears multiple times
- Users reporting coins awarded twice

**Investigation**:
```bash
# Find duplicate events
SELECT eventId, COUNT(*) as count
FROM AdBazaarScan
WHERE scannedAt > now() - interval '1 hour'
GROUP BY eventId
HAVING COUNT(*) > 1
ORDER BY count DESC;

# Check for duplicates by payload
SELECT payload, COUNT(*) as count
FROM WebhookLog
WHERE timestamp > now() - interval '1 hour'
GROUP BY payload
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

**Resolution**:
1. Verify idempotency key is implemented
2. Check if partner is retrying webhook sends
3. Contact partner to stop retries
4. Dedup database records if needed:
   ```sql
   DELETE FROM AdBazaarScan
   WHERE id NOT IN (
     SELECT MAX(id) FROM AdBazaarScan
     GROUP BY eventId
   );
   ```

---

### Scheduled Job Failures

**Symptoms**:
- Coin expiration jobs not running
- Coins not expiring on schedule

**Investigation**:
```bash
# 1. Check Redis queue status
redis-cli -u $REDIS_URL ZRANGE bull:coin-expiry:repeat 0 -1 WITHSCORES

# 2. Check job logs
tail -f logs/scheduler.log | grep "coin-expiry"

# 3. Check for stuck jobs
redis-cli -u $REDIS_URL ZRANGE bull:coin-expiry:active 0 -1

# 4. Check job execution history
SELECT * FROM job_logs WHERE job_name = 'coin-expiry' ORDER BY executed_at DESC LIMIT 20;
```

**Resolution**:
1. Restart job scheduler
2. Check Redis connectivity
3. Verify job definition is correct
4. Manually trigger job if needed:
   ```bash
   curl -X POST https://hotelota.api/admin/jobs/trigger-coin-expiry \
     -H "X-Internal-Token: $TOKEN"
   ```

---

## On-Call Runbook

### First Response (Within 5 minutes)

1. **Check alert details**
   - What metric triggered?
   - What's the current value vs threshold?
   - When did it start?

2. **Assess impact**
   - Are users affected?
   - Is revenue impacted?
   - Can we wait for root cause or need emergency fix?

3. **Quick checks**
   ```bash
   # Health endpoints
   curl https://api.rez.money/health
   curl https://hotelota.api/health
   curl https://rez-api-gateway.onrender.com/health
   
   # Recent errors
   tail -f logs/webhooks.log | grep ERROR | head -20
   
   # Error rate
   curl https://metrics.example.com/query?metric=webhook_error_rate
   ```

4. **Notify team**
   - Post to #incidents Slack channel
   - Tag service owner
   - Provide initial assessment

### Escalation (Within 30 minutes)

1. **Gather more data**
   - Full error logs
   - Metrics graphs (1h view)
   - Recent code changes
   - Partner communication

2. **Implement temporary mitigation**
   - Disable webhooks if they're causing issues
   - Scale up resources if load-related
   - Rollback if recent code change caused issue

3. **Root cause analysis**
   - What changed recently?
   - Are all services affected or just one?
   - Is it a configuration issue or code bug?

### Resolution & Communication

1. **Fix the issue**
   - Code fix or revert
   - Configuration change
   - Database repair
   - Partner coordination

2. **Verify recovery**
   ```bash
   # Monitor error rate
   tail -f metrics.log | grep error_rate
   
   # Test functionality
   curl -X POST https://api.rez.money/api/webhooks/adbazaar/qr-scan \
     -H "X-Signature: $SIGNATURE" \
     -d "$PAYLOAD"
   ```

3. **Communicate status**
   - Post to #incidents when resolved
   - Provide brief summary of issue
   - Mention next steps (post-mortem, monitoring improvement)

---

## Post-Incident Checklist

After any incident:

- [ ] Document root cause
- [ ] Update runbook/documentation if needed
- [ ] Create monitoring alert to prevent recurrence
- [ ] Identify systemic improvements
- [ ] Schedule post-mortem (if significant)
- [ ] Update escalation procedures if needed

---

## Related Documentation

- [INTEGRATION_ENDPOINTS.md](INTEGRATION_ENDPOINTS.md) - Endpoint specifications
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Deployment verification
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and fixes
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - Configuration reference

---

**Generated:** April 8, 2026  
**Last Updated:** April 8, 2026  
**Prepared By:** REZ Development Team (claude-flow)
