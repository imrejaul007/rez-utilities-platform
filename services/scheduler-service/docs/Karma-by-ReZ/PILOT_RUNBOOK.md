# Karma by ReZ — Pilot Launch Runbook

**Phase:** 8 — Integration, Deployment, and Pilot
**Version:** 1.0.0
**Last Updated:** 2026-04-15

---

## Overview

This runbook covers the end-to-end process for deploying `rez-karma-service` to staging, verifying the full integration chain, and executing the pilot launch with a small beta cohort.

---

## Pre-Launch Checklist

### Infrastructure

- [ ] `rez-karma-service` container image built successfully
- [ ] Service deployed to staging environment
- [ ] Health check passing: `GET /health` returns `{"status":"ok"}`
- [ ] MongoDB: `rez_karma` database created, indexes applied
- [ ] Redis: BullMQ queue `karma-batch-conversion` created
- [ ] ReZ Auth integration verified: JWT validation works
- [ ] ReZ Wallet integration: test credit of 10 coins succeeds
- [ ] ReZ Merchant integration: event lookup returns expected fields

### Data Setup

- [ ] 1 NGO onboarded in BizOS (ReZ Merchant)
- [ ] 1 CSR pool created with budget >= 1000 coins
- [ ] 3 karma-enabled events created with verification config
- [ ] QR codes generated and printed for each event
- [ ] 3 test users created with karma profiles
- [ ] Admin user created with `admin` role

### App / Frontend

- [ ] Karma tab deployed to staging (if separate deploy)
- [ ] Deep links functional: `rez://karma/*`
- [ ] Push notifications configured for karma events
- [ ] QR scanner tested on physical device (iOS + Android)

### Team & Process

- [ ] Admin users trained on batch preview + execute workflow
- [ ] Kill switch procedure documented and tested
- [ ] On-call engineer briefed on rollback procedure
- [ ] Monitoring dashboards set up (error rates, batch counts)

---

## Staging Deployment

### 1. Build and Push Docker Image

```bash
cd rez-karma-service
docker build -t gcr.io/your-project/rez-karma-service:v1.0.0 .
docker push gcr.io/your-project/rez-karma-service:v1.0.0
```

### 2. Deploy to Staging (Render)

1. Go to Render Dashboard → `rez-karma-service` (staging)
2. Update the Docker image to the new tag
3. Set required environment variables:
   - `MONGODB_URI` = staging MongoDB URI
   - `REDIS_URL` = staging Redis URL
   - `AUTH_SERVICE_URL` = staging auth service URL
   - `WALLET_SERVICE_URL` = staging wallet service URL
   - `MERCHANT_SERVICE_URL` = staging merchant service URL
   - `BATCH_CRON_SCHEDULE` = `59 23 * * 0`
   - `JWT_SECRET` = shared JWT secret
   - `INTERNAL_SERVICE_TOKEN` = staging token
4. Click "Deploy"

### 3. Verify Deployment

```bash
# Health check
curl https://karma-staging.your-domain.com/health

# Expected response:
# {"status":"ok","service":"rez-karma-service","timestamp":"...","uptime":...}

# Readiness check (verifies DB + Redis)
curl https://karma-staging.your-domain.com/health/ready
```

### 4. Run Smoke Tests

```bash
export TEST_BASE_URL=https://karma-staging.your-domain.com
cd rez-karma-service
npm test -- __tests__/smoke.test.ts
```

Expected: all tests pass.

---

## Integration Verification

### 1. ReZ Auth Service

```bash
# Verify JWT validation
curl -H "Authorization: Bearer <valid-jwt>" \
  https://karma-staging.your-domain.com/api/karma/user/testuser123

# Expected: 200 (user profile) or 404 (user not found — expected for unknown user)
# Not expected: 401 (would mean auth is broken)
```

### 2. ReZ Wallet Service

```bash
# Manual test: credit coins to a test user
curl -X POST https://wallet-staging.your-domain.com/api/wallet/credit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-token>" \
  -d '{
    "userId": "testuser123",
    "amount": 10,
    "coinType": "rez_coins",
    "source": "karma_pilot_test",
    "description": "Pilot smoke test credit",
    "idempotencyKey": "pilot-smoke-001"
  }'
```

### 3. ReZ Merchant Service

```bash
# Verify karma-enabled event fields are present
curl https://merchant-staging.your-domain.com/api/events/<event-id> \
  -H "Authorization: Bearer <admin-token>"
# Verify response contains: karmaEnabled, karmaRewardPerHour, verificationMode, ngoId
```

---

## Pilot Launch Steps

### Day 0 — Launch Day

1. **Morning (T-2h):** Confirm all pre-launch checks are green
2. **Announce:** Send internal Slack message to beta users
3. **Founders test:** All founders volunteer at the first test event
   - Check in via QR code
   - Participate for >= 1 hour
   - Check out via QR code
4. **NGO approval:** Approve volunteer attendance in BizOS
5. **Verify earn record:** Check MongoDB `earnrecords` collection for new record with status `APPROVED_PENDING_CONVERSION`
6. **Execute batch:** Admin triggers batch preview + execute
7. **Verify coins:** Confirm coins appear in ReZ Wallet
8. **Verify notification:** Push notification sent to user
9. **Monitoring:** Watch Grafana for error rate < 0.1%

### Day 1–7 — Soft Launch

- Limit to internal team + 10 beta users
- Monitor daily: pending batches, error rates, conversion rates
- Collect user feedback via in-app prompt
- Review anomaly flags each morning

### Week 2+ — Expand

- Open to 50 users
- Partner with 1 NGO for real events
- Run first real batch conversion

---

## Batch Execution Workflow (Admin)

### Preview a Batch

```bash
curl https://karma-staging.your-domain.com/api/karma/batch/<batch-id>/preview \
  -H "Authorization: Bearer <admin-jwt>"
```

Review the response:
- `summary.totalRecords` — number of earn records
- `summary.totalEstimated` — total coins to be issued
- `anomalies` — any red flags to review
- `records` — sample of top 50 records

### Execute a Batch

```bash
curl -X POST https://karma-staging.your-domain.com/api/karma/batch/<batch-id>/execute \
  -H "Authorization: Bearer <admin-jwt>"
```

Monitor the response:
- `results.success` — successfully converted records
- `results.failed` — failed conversions (check `results.errors`)

---

## Rollback Procedure

If a critical bug is discovered:

### Step 1: Activate Kill Switch

```bash
curl -X POST https://karma-staging.your-domain.com/api/karma/batch/kill-switch \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Critical bug discovered — rolling back"}'
```

This sets all `READY` batches to `PAUSED`. No new conversions will process.

### Step 2: Disable Karma Tab (App Config)

Update the app config flag:
```
FEATURE_KARMA_ENABLED=false
```

### Step 3: Fix and Redeploy

1. Fix the bug in code
2. Tag new image: `v1.0.1`
3. Redeploy on Render
4. Verify health check passes

### Step 4: Resume

After redeployment, pending batches can be processed:
- Review the paused batch list
- Confirm fix is safe
- Resume with `POST /api/karma/batch/<id>/execute`

---

## Monitoring & Alerts

### Key Metrics to Watch

| Metric | Normal Range | Alert Threshold |
|--------|-------------|----------------|
| Error rate (5xx) | < 0.1% | > 1% |
| Health check failures | 0 | > 1 consecutive |
| Batch execution time | < 30s | > 120s |
| MongoDB connection pool | < 5 | > 8 |
| Redis latency (p99) | < 50ms | > 500ms |
| Auth service calls (5xx) | < 0.1% | > 1% |
| Wallet service calls (5xx) | < 0.1% | > 1% |

### Log Queries

```bash
# All errors in the last hour
grep '"level":"error"' /var/log/rez-karma-service.log | tail -100

# Batch execution events
grep 'batch_execute' /var/log/rez-karma-service.log

# Auth failures
grep 'Invalid token' /var/log/rez-karma-service.log
```

---

## MongoDB Indexes

Run these in the MongoDB shell to create required indexes:

```javascript
use rez_karma;

// KarmaProfile indexes
db.karmaprofiles.createIndex({ "userId": 1 }, { unique: true });
db.karmaprofiles.createIndex({ "level": 1 });
db.karmaprofiles.createIndex({ "lifetimeKarma": -1 });

// EarnRecord indexes
db.earnrecords.createIndex({ "userId": 1, "createdAt": -1 });
db.earnrecords.createIndex({ "status": 1, "approvedAt": 1 });
db.earnrecords.createIndex({ "batchId": 1 });
db.earnrecords.createIndex({ "eventId": 1 });
db.earnrecords.createIndex({ "idempotencyKey": 1 }, { unique: true });

// Batch indexes
db.batches.createIndex({ "status": 1 });
db.batches.createIndex({ "weekStart": -1 });
db.batches.createIndex({ "csrPoolId": 1, "weekStart": 1 });

// CSRPool indexes
db.csrpools.createIndex({ "campaignId": 1 });
db.csrpools.createIndex({ "corporateId": 1 });
db.csrpools.createIndex({ "status": 1 });
```

---

## Environment Matrix

| Environment | URL | MongoDB | Notes |
|-------------|-----|---------|-------|
| Local | `http://localhost:3009` | `localhost:27017` | Dev |
| Staging | `https://karma-staging.your-domain.com` | Staging cluster | Beta |
| Production | `https://karma.your-domain.com` | Production cluster | Live |

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| Backend / DevOps | [Your Name] | [email / Slack] |
| App / Mobile | [Your Name] | [email / Slack] |
| Ops / NGO Relations | [Your Name] | [email / Slack] |
| Escalation (24/7) | [Your Name] | [phone / PagerDuty] |
