# Karma by ReZ — Development Plan

8 phases, 8 agents working in parallel. Each agent owns one phase completely.

---

## Phase 1: Karma Service Foundation + Data Models
**Agent: backend-1 | Week 1 | Output: `rez-karma-service/src/`**

Complete karma service scaffold:
- Package.json, tsconfig, dockerfile
- MongoDB models: EarnRecord, Batch, CSRPool, KarmaProfile, KarmaEvent
- Index.ts server bootstrap
- Health + metrics endpoints
- Config: env vars, MongoDB, Redis connections
- Basic auth middleware (ReZ Auth integration)
- Tests: model unit tests

---

## Phase 2: Karma Engine + Level System
**Agent: backend-2 | Week 2 | Output: `rez-karma-service/src/engines/` + `rez-karma-service/src/services/`**

Karma calculation engine:
- Karma calculation (baseKarma × hours × impactMultiplier × difficulty)
- Level calculation (L1–L4 from active karma)
- Decay system (daily cron, 20%/40%/70% decay)
- Trust score calculation
- Conversion rate logic
- Caps enforcement (per-user weekly cap)
- Tests: karma engine unit tests

---

## Phase 3: Verification Engine
**Agent: backend-3 | Week 2–3 | Output: `rez-karma-service/src/engines/verification.ts` + `rez-karma-service/src/routes/verify.ts`**

Verification system:
- Confidence score calculation
- QR check-in/checkout validation
- GPS proximity check
- Fraud anomaly detection
- Verification routes: POST /verify/checkin, /verify/checkout
- EarnRecord creation pipeline
- Tests: verification engine tests

---

## Phase 4: Batch Conversion System
**Agent: backend-4 | Week 3 | Output: `rez-karma-service/src/workers/` + `rez-karma-service/src/services/batchService.ts` + `rez-karma-service/src/routes/batchRoutes.ts`**

Batch conversion:
- Weekly batch scheduler (cron: Sunday 23:59)
- Batch creation from APPROVED_PENDING_CONVERSION records
- Admin preview endpoint
- Batch execute with idempotency
- Guardrails: pool check, caps, anomaly flags
- Kill switch
- Audit log
- Tests: batch system tests

---

## Phase 5: Merchant Service Extensions
**Agent: backend-5 | Week 2 | Output: `rez-merchant-service/src/routes/karma.ts` + model extensions**

ReZ Merchant extensions:
- New karma event model
- karma.ts routes: create event, approve volunteer, bulk approve
- Event model extensions: karmaEnabled, verificationMode, confidenceWeights
- EventBooking model extensions: verification fields
- NGO dashboard endpoints
- CSR pool management
- Tests: merchant karma route tests

---

## Phase 6: ReZ App (Consumer) — Karma Tab
**Agent: frontend-1 | Week 5 | Output: `rez-app-consumer/src/app/karma/`**

ReZ Consumer app Karma tab:
- Home: event feed, nearby events, karma snapshot
- Explore: filters, search, categories
- Event Detail: join, map, impact, rewards
- Check-in: QR scanner (camera + GPS fallback)
- My Karma: level, active/lifetime karma, history, badges
- Wallet: karma points balance, conversion history, ReZ coins
- Notifications: karma earned, level up, conversion complete
- Deep links: ReZ → Karma app integration

---

## Phase 7: Admin Dashboard
**Agent: frontend-2 | Week 4–5 | Output: `rezadmin/src/karma/`**

Admin panel for Karma:
- Dashboard: karma stats, event metrics, coin flow
- Batch management: list, preview, execute, kill switch
- NGO management: onboarding, approval rates, anomalies
- Event moderation: review flagged events
- CSR pool management: create pools, allocate budgets, track usage
- Fraud dashboard: anomaly flags, per-NGO rates, kill switch
- Audit log viewer

---

## Phase 8: Integration + Deployment + Pilot
**Agent: devops | Week 6 | Output: docker-compose, env configs, test scripts, pilot runbook**

Infrastructure and go-live:
- Docker compose for karma service
- Environment variable configs
- CI/CD pipeline (GitHub Actions)
- Load testing
- Smoke tests (end-to-end flow)
- Pilot runbook (step-by-step launch checklist)
- Monitoring: error rates, batch execution, anomaly rates
- Rollback plan

---

## Phase 9: Cross-App Trust Signal Integration ✅ Done
**Output: Rendez dating app + ecosystem integration pattern**

Karma profile data flows into other ReZ apps as trust signals. Pattern: `rezKarmaClient` fetches karma by `rezUserId`, app backends enrich responses, frontends surface karma.

### Rendez Dating App (COMPLETE)

**Backend:**
- `rez-karma-service/src/integrations/rez/rezKarmaClient.ts` — HTTP client (5s timeout, silent fallback)
- `rendez-backend/src/routes/profile.ts` — `GET /profile/:id` enriches with karma fields in parallel
- `rendez-backend/src/config/env.ts` — `KARMA_SERVICE_URL` env var

**Frontend:**
- `ProfileScreen.tsx` — Own profile: amber karma card with level, trust score, events completed
- `ProfileDetailScreen.tsx` — Others' profiles: amber trust badge in profile header

**Karma fields surfaced:**
```typescript
karma: {
  karmaScore: number,       // 0-100 trust score
  karmaLevel: 'L1'|'L2'|'L3'|'L4',
  karmaEventsCompleted: number,
  karmaBadges: Array<{ id, name, icon }>,
}
```

### AdBazaar, Hotel OTA, ReZ App (same pattern)

Any app can add trust signals with 3 steps:
1. Add `KARMA_SERVICE_URL` to env config
2. Create `rezKarmaClient.ts` (copy the pattern — 15 lines)
3. Call `getKarmaProfile(rezUserId)` at the right response enrichment point

No Prisma schema changes needed. No data sync. No coupling.
