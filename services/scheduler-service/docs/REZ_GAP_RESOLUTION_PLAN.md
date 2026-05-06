# REZ Ecosystem — Gap Resolution & Fix Plan
**Date:** 2026-04-07  
**Author:** Engineering  
**Priority:** Production-critical items first

---

## Table of Contents
1. [Critical Fixes (Do Now)](#1-critical-fixes-do-now)
2. [Infrastructure Gaps](#2-infrastructure-gaps)
3. [Habit Loop Gaps (Product)](#3-habit-loop-gaps-product)
4. [Microservice Migration Gaps](#4-microservice-migration-gaps)
5. [Deployment & DevOps Gaps](#5-deployment--devops-gaps)
6. [Partner Integration Gaps](#6-partner-integration-gaps)
7. [Execution Roadmap](#7-execution-roadmap)

---

## 1. Critical Fixes (Do Now)

### 1.1 rez-shared — Publish to npm
**Problem:** `rez-shared` is declared as `"file:../rez-shared"` in all app `package.json` files. Vercel/Render can't resolve a local path — causes build failures on every new deploy.

**Fix:**
```bash
# Step 1: Publish to npm under @imrejaul007 scope
cd rez-shared
npm login  # use work@rez.money account
npm publish --access public

# Step 2: Replace file:// references in all apps
# In rezmerchant/package.json, rezadmin/package.json, rez-app-marchant/package.json:
"@imrejaul007/rez-shared": "^1.0.0"   # replace "file:../rez-shared"

# Step 3: Run npm install + push all affected repos
```

**Files to update:**
- `rezmerchant/package.json`
- `rezadmin/package.json` 
- `/tmp/rez-app-marchant/package.json` (already patched with inline types as temp fix)
- Any microservice importing from rez-shared

**Owner:** DevOps  
**ETA:** 1 day  
**Risk if ignored:** Every new team member deploy or Vercel redeploy will fail

---

### 1.2 Consumer App — Vercel Deploy Auth
**Problem:** Multiple developers (mukulraj756, others) push to repos and their GitHub account isn't linked to the Vercel project. Vercel blocks deploys with "commit author does not have contributing access."

**Fix:**
```
Option A (Recommended): Add all active contributors to the Vercel project
  Vercel Dashboard → Project → Settings → Git → Add contributor emails

Option B: Set up a GitHub Actions CI/CD pipeline that triggers Vercel deploys
  — decouples commit author from Vercel deploy permission
  — all deploys go through the service account (work@rez.money)
```

**Files to create:**
- `.github/workflows/deploy.yml` in each Vercel-connected repo

**Owner:** DevOps  
**ETA:** 2 hours  
**Risk if ignored:** Every team commit blocks production

---

### 1.3 Order Service — Promote to HTTP Service
**Problem:** `rez-order-service` has full HTTP API code but is running as a BullMQ background worker only on Render. The order state machine and status endpoints aren't reachable via HTTP.

**Fix:**
```bash
# In Render dashboard:
# 1. Change service type from "Background Worker" to "Web Service"
# 2. Set start command: node dist/httpServer.js
# 3. Set PORT env var
# 4. Add to API Gateway routing: /api/orders/* → rez-order-service

# In rez-api-gateway/nginx.conf, add:
location /api/orders/ {
  proxy_pass http://rez-order-service:PORT/;
}
```

**Owner:** Backend  
**ETA:** 1 day  

---

### 1.4 Wallet Double-Entry Ledger — Verify Consistency
**Problem:** `writeLedgerPair()` was added in this session but needs verification that existing wallet balances match the sum of all ledger entries. Any discrepancy = money bug.

**Fix — Run reconciliation script:**
```typescript
// scripts/reconcileWallets.ts
// For each wallet: sum all LedgerEntry credits - debits, compare to balance
// Log any wallet where diff > 0
// Run: ts-node scripts/reconcileWallets.ts --dry-run
```

**Owner:** Backend  
**ETA:** 1 day  

---

## 2. Infrastructure Gaps

### 2.1 MongoDB — No Replica Set for Transactions
**Problem:** MongoDB sessions/transactions require a replica set. If the current cluster is standalone, `walletService.ts` transaction code will silently fail or throw.

**Fix:**
```
1. Confirm Atlas cluster tier supports replica set (M10+)
2. If on M0 (free): upgrade to M10 or restructure wallet ops to use atomic findOneAndUpdate only
3. Test: connect to Atlas URI and run db.adminCommand({replSetGetStatus:1})
```

**Owner:** DevOps/Backend  
**ETA:** 1 day  

---

### 2.2 Redis — No Persistence / Backup
**Problem:** Redis is used for rate limiting, caching, BullMQ jobs, and wallet idempotency keys. If Redis restarts, queued jobs and idempotency windows are lost.

**Fix:**
```
1. Enable Redis AOF persistence (appendonly yes)
2. Set maxmemory-policy = allkeys-lru
3. Add Redis health to /health/ready endpoint
4. Add BullMQ dead-letter queue for failed jobs
```

**Owner:** DevOps  
**ETA:** 2 days  

---

### 2.3 API Gateway — No Retry / Circuit Breaker
**Problem:** If a downstream microservice (wallet, gamification) goes down, the gateway proxies the request and returns a raw 502. No fallback, no circuit breaker.

**Fix:**
```nginx
# In nginx.conf, add upstream health check + retry
upstream wallet_service {
  server rez-wallet-service:PORT max_fails=3 fail_timeout=30s;
}
proxy_next_upstream error timeout http_502 http_503;
proxy_next_upstream_tries 2;
```

Or migrate gateway to Node.js (express-http-proxy) with proper circuit breaker (opossum).

**Owner:** DevOps  
**ETA:** 3 days  

---

### 2.4 No Centralized Logging
**Problem:** Each service logs independently via Winston/Sentry. No way to trace a single request (e.g., an order) across monolith → wallet → gamification → notification.

**Fix:**
```
1. X-Correlation-ID already threaded via nginx — verify all microservices forward it
2. Ship logs to a single sink: Logtail, Datadog, or self-hosted ELK
3. Add correlation ID to all Sentry captures
```

**Owner:** DevOps  
**ETA:** 3 days  

---

## 3. Habit Loop Gaps (Product)

### 3.1 Store Visit → Streak System Not Connected
**Problem:** Users can check in via QR but the visit doesn't increment a visit streak that gives meaningful rewards. The habit loop is broken.

**Fix:**
```
Flow to build:
  QR Scan → POST /api/qr-checkin → 
    Monolith validates → 
    POST rez-gamification-service/visit →
    Streak worker: if streak milestone (7/30/100 days) → award rez coins + badge

Files:
  rezbackend/src/routes/qrCheckin.ts — add gamification call on successful checkin
  rez-gamification-service/src/workers/storeVisitStreakWorker.ts — already exists, verify connected
  rez-gamification-service/src/services/streakService.ts — add milestone coin awards
```

**Owner:** Backend + Gamification  
**ETA:** 2 days  

---

### 3.2 7-Day Cashback Pending Period
**Problem:** Users submit cashback, wait 7 days to see any reward. Kills instant gratification — the #1 reason users don't form the habit.

**Fix options:**
```
Option A (Quick): Show "pending cashback" as a running counter in the wallet UI.
  — User sees coins "coming soon" immediately — reduces anxiety
  — Frontend change only

Option B (Product): Reduce pending period to 48 hours for verified merchants
  — Requires fraud risk assessment
  — Backend: cashbackService.ts — reduce PENDING_PERIOD_MS for verified merchants

Option C (Future): Instant cashback with merchant float reserve
  — Merchant pre-deposits a float
  — Cashback is debited from float instantly
```

**Recommended:** Option A immediately, Option B within 2 weeks.  
**Owner:** Product + Backend  
**ETA:** 1 day (Option A), 2 weeks (Option B)  

---

### 3.3 No REZ Score
**Problem:** Users have no single identity number ("Your REZ Score: 780") that makes them invested. Every loyalty platform that works has a score.

**Fix:**
```typescript
// REZ Score formula (v1):
// score = (totalNuqtaEarned * 0.3) + (visitStreak * 10) + (ordersCompleted * 5) 
//       + (merchantsVisited * 3) + (referrals * 20)
// Capped at 1000, displayed in consumer app homescreen

// Add to rezbackend/src/services/userProfileService.ts:
export function calculateRezScore(user: UserStats): number { ... }

// Add to consumer app homescreen — single prominent number
```

**Owner:** Backend + Consumer App  
**ETA:** 3 days  

---

### 3.4 No Missed Savings Intelligence
**Problem:** Users don't know what they *could have saved* at merchants they visited but didn't use REZ at. This is a powerful behavioral nudge.

**Fix:**
```
1. When user checks location or opens app near a merchant:
   → Push notification: "You were near Café X yesterday. REZ would have saved you ₹45."
2. Weekly summary: "You missed ₹230 in REZ savings last week."

Requires:
  - Location permission (already in consumer app)
  - rez-marketing-service triggered on weekly schedule
  - New "missed_savings" event type in analytics-events
```

**Owner:** Product + Backend  
**ETA:** 1 week  

---

## 4. Microservice Migration Gaps

### 4.1 Current State
| Service | Monolith | Extracted | Traffic Routed |
|---------|----------|-----------|----------------|
| Auth | ✅ | ✅ | ⚠️ Partial (gateway routes /api/auth) |
| Wallet | ✅ | ✅ | ⚠️ Internal calls only |
| Orders | ✅ | ✅ | ❌ Still using monolith |
| Payments | ✅ | ✅ | ⚠️ Partial |
| Gamification | ✅ | ✅ | ✅ Fully routed |
| Search | ✅ | ✅ | ✅ Fully routed |
| Catalog | ✅ | ✅ | ⚠️ Partial |
| Notifications | ✅ | ⚠️ Worker only | ❌ Not HTTP |
| Media | ✅ | ⚠️ Worker only | ❌ Not HTTP |
| Marketing | ✅ | ✅ | ✅ Routed |

### 4.2 Migration Order (Strangler Fig)
```
Phase 1 (Now):
  ✅ Search → Done
  🔄 Orders → Promote to web service (see 1.3)
  🔄 Auth → Complete gateway routing

Phase 2 (2 weeks):
  → Wallet → Route all /api/wallet/* through gateway → wallet-service
  → Payments → Route all /api/payments/* through gateway → payment-service
  → Catalog → Route /api/products/* through gateway → catalog-service

Phase 3 (1 month):
  → Notifications → Promote to HTTP + route
  → Media → Promote to HTTP + route
  → Begin removing duplicate code from monolith
```

---

## 5. Deployment & DevOps Gaps

### 5.1 No CI/CD Pipeline
**Problem:** All pushes go directly to main, no tests run before deploy, no staging environment.

**Fix — Add GitHub Actions to each repo:**
```yaml
# .github/workflows/ci.yml (template for all services)
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm test
      - run: npm run build
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: amondnet/vercel-action@v25  # or trigger Render deploy hook
```

**Priority repos:** rezadmin, rezmerchant, rez-app-marchant, rezbackend  
**ETA:** 2 days  

---

### 5.2 No Environment Parity
**Problem:** No staging environment. All changes go straight to production. One bad commit = production down.

**Fix:**
```
1. Create 'staging' branch on all repos
2. Set Vercel to auto-deploy 'staging' branch to staging.*.rez.money
3. Set Render to have separate staging services
4. All PRs go to staging first, then merge to main
```

**ETA:** 1 week  

---

### 5.3 Secret Management
**Problem:** `.env` files managed manually per developer. No central secret rotation (secretsRotation.ts exists but AWS/Vault integrations are stubs).

**Fix (short term):**
```
1. Use Render's Secret Files / Environment Groups for all services
2. Use Vercel's Environment Variables UI (already partially done)
3. Never commit .env files — add pre-commit hook to block it
```

**Fix (long term):**
```
Implement secretsRotation.ts AWS Secrets Manager integration:
  - rezbackend/src/services/secretsRotation.ts rotateAWSSecret() — currently a stub
  - Integrate: npm install @aws-sdk/client-secrets-manager
  - Replace stub with real RotateSecretCommand call
```

**ETA:** 3 days (short term), 2 weeks (long term)  

---

## 6. Partner Integration Gaps

### 6.1 AdBazaar — REST Integration Not Built
**Problem:** Architecture is designed (QR → coin credit → attribution), but no actual API endpoints exist on REZ side to receive AdBazaar events.

**Fix:**
```typescript
// Add to rezbackend/src/routes/partnerRoutes.ts:

// POST /api/partner/adbazaar/qr-scan
// Body: { qrCode, userId, merchantId, adCampaignId }
// Action: credit brand coins to user, log attribution event

// POST /api/partner/adbazaar/webhook  
// Body: { event: 'visit' | 'purchase', userId, merchantId, amount }
// Action: log to analytics-events, update attribution data
// Auth: HMAC-SHA256 signature verify (shared secret)
```

**ETA:** 2 days  

---

### 6.2 Hotel OTA — Coin Sync Verification
**Problem:** Three-level coin system (OTA + REZ + Hotel brand) was built but the sync between REZ wallet-service and OTA's `rezCoinBalance` column needs end-to-end testing.

**Fix:**
```
Test scenario:
1. User earns 100 nuqta via REZ app
2. User logs into Hotel OTA via SSO
3. OTA calls GET /internal/balance/:userId on rez-wallet-service
4. OTA's rezCoinBalance column updates
5. User sees coins during hotel booking checkout

Run: scripts/testHotelCoinSync.ts
```

**ETA:** 1 day  

---

## 7. Execution Roadmap

### Week 1 — Stop the Bleeding
| Day | Task | Owner |
|-----|------|-------|
| Mon | Publish rez-shared to npm, update all package.json | DevOps |
| Mon | Add Vercel contributors OR set up GitHub Actions deploy | DevOps |
| Tue | Promote Order Service to web service on Render | Backend |
| Tue | Verify MongoDB replica set supports transactions | Backend |
| Wed | Add CI/CD pipeline to rezadmin, rezmerchant, rezbackend | DevOps |
| Wed | Show "pending cashback" counter in consumer app (Option A) | Frontend |
| Thu | Connect QR checkin → gamification streak milestone awards | Backend |
| Fri | Redis persistence + BullMQ dead-letter queues | DevOps |

### Week 2 — Close the Habit Loop
| Day | Task | Owner |
|-----|------|-------|
| Mon | Build REZ Score formula + backend endpoint | Backend |
| Tue | REZ Score on consumer app homescreen | Frontend |
| Wed | Route /api/wallet/* through gateway → wallet-service | DevOps |
| Thu | Build AdBazaar partner endpoints on REZ backend | Backend |
| Fri | Staging environment setup on Vercel + Render | DevOps |

### Week 3 — Intelligence & Retention
| Day | Task | Owner |
|-----|------|-------|
| Mon-Tue | "Missed savings" notification system | Backend + Marketing |
| Wed | Reduce cashback pending to 48h for verified merchants | Backend |
| Thu | AWS Secrets Manager integration (secretsRotation.ts) | Backend |
| Fri | Full reconciliation audit: wallet balances vs ledger | Backend |

### Week 4 — Microservice Graduation
| Day | Task | Owner |
|-----|------|-------|
| Mon-Wed | Route /api/payments/* → payment-service (with fallback) | Backend |
| Thu-Fri | Route /api/products/* → catalog-service | Backend |
| Ongoing | Remove duplicate code from monolith as each route is migrated | Backend |

---

## Appendix A — Files That Need Immediate Attention

| File | Issue | Fix |
|------|-------|-----|
| `rezbackend/src/services/secretsRotation.ts` | rotateAWSSecret/rotateVaultSecret are stubs | Implement real SDK calls |
| `rezbackend/src/config/graphqlSetup.ts` | All resolvers return null/[] — GraphQL is non-functional | Implement or remove |
| `rez-shared/package.json` | Not published to npm | `npm publish` |
| `rez-app-marchant/package.json` | Still has `file:../rez-shared` | Update after npm publish |
| `rezmerchant/package.json` | Same as above | Update after npm publish |
| `rez-api-gateway/nginx.conf` | No circuit breaker | Add retry + upstream health check |
| `rez-order-service` | Render service type = background worker | Promote to web service |

---

## Appendix B — Known Code Bugs Fixed This Session (2026-04-07)

| File | Bug | Fix Applied |
|------|-----|-------------|
| `rez-wallet-service/src/services/walletService.ts` | No isFrozen check on credit path | Fixed |
| `rez-wallet-service/src/services/walletService.ts` | No double-entry ledger | Fixed — writeLedgerPair() |
| `rez-wallet-service/src/routes/internalRoutes.ts` | No idempotency on merchant credit | Fixed — insert-first pattern |
| `rezbackend/src/services/walletService.ts` | isFrozen not checked in atomicWalletCreditReturning | Fixed |
| `rez-auth-service/src/middleware/rateLimiter.ts` | adminLoginLimiter fail-open on Redis down | Fixed — failOpen=false |
| `rez-auth-service/src/services/tokenService.ts` | Empty JWT secret fallback vulnerability | Fixed — throws on empty secret |
| `rez-order-service/src/httpServer.ts` | Status update race condition | Fixed — status filter in findOneAndUpdate |
| `rez-gamification-service/src/workers/*.ts` | Writing to userwallets (wrong collection) | Fixed — now writes to wallets |
| `rez-search-service/src/services/searchService.ts` | isActive: {$ne:false} instead of isActive:true | Fixed |
| `rez-app-marchant/services/api/client.ts` | Importing @imrejaul007/rez-shared (local file dep) | Fixed — inlined types |
| `rez-app-marchant/types/api.ts` | Same rez-shared import | Fixed — inlined types |
| `rezbackend/src/services/secretsRotation.ts` | Wrong redis import | Fixed — use redisService |
| `rez-merchant-service/src/routes/teamPublic.ts` | Wrong field names (invitationToken vs inviteToken) | Fixed |

---

*This document should be reviewed weekly and tasks checked off as completed.*
