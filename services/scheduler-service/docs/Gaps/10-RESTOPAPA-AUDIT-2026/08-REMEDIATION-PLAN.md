# Gen 14 — Master Remediation Plan

**Generated:** 2026-04-16
**Total Issues:** 85 (15 CRITICAL, 23 HIGH, 30 MEDIUM, 17 LOW)
**Total Estimated Effort:** ~95 hours across 5 phases / 6 weeks
**Approach:** Fix root causes first, then individual issues. Root cause fixes resolve 75% of all bugs.

---

## Grand Summary

| Phase | Focus | Issues | Est. Hours | Timeline |
|-------|-------|--------|-----------|----------|
| **Phase 1** | Dead code wiring + service auth | 7 CRITICAL | ~15h | Week 1 |
| **Phase 2** | Financial atomicity + data sync | 8 CRITICAL + 10 HIGH | ~25h | Week 1-2 |
| **Phase 3** | Type/enum normalization | 23 HIGH | ~20h | Week 2-3 |
| **Phase 4** | Architecture fixes + root diseases | 30 MEDIUM | ~20h | Week 3-5 |
| **Phase 5** | Quick wins + polish | 17 LOW + 12 QW | ~15h | Week 5-6 |

---

## Phase 1: Dead Code Wiring + Service Auth (Week 1)

**Goal:** Make the platform actually work. Many features are implemented but never connected.

### Week 1, Day 1-2: Critical Wiring Fixes (~8h)

| # | Fix | File | Est. | Owner |
|---|-----|------|------|-------|
| 1 | Wire karma HTTP routes (replace 501 stubs) | `routes/index.ts` | 1h | Backend |
| 2 | Restore CrossAppSyncService webhook call | `CrossAppSyncService.ts:261` | 2h | Backend |
| 3 | Implement syncOrders/syncCashback properly | `SyncService.ts:396` | 1h | Backend |
| 4 | Fix karma notification placeholder (uncomment) | `batchService.ts` | 1h | Backend |
| 5 | Fix admin auth bypass (requireAdmin import) | `batchRoutes.ts:8` | 0.5h | Backend |
| 6 | Add `merchantId` to admin order populate | `orderController.ts` | 0.5h | Backend |
| 7 | Add `voucherCode` fields to frontend order | `ordersApi.ts` | 1h | Frontend |
| 8 | Fix IEarnRecord field name mismatch | `karma.ts` or `EarnRecord.ts` | 1h | Backend |

### Week 1, Day 3-5: Service-to-Service Auth (~7h)

| # | Fix | File | Est. | Owner |
|---|-----|------|------|-------|
| 9 | Add JWT auth to wallet service calls | `walletIntegration.ts` | 2h | Backend |
| 10 | Add circuit breaker to auth middleware | `auth.ts:57` | 1h | Backend |
| 11 | Add socket room ownership validation | `socket.ts` | 1h | Frontend |
| 12 | Fix JWT secret test fallback | `setup.ts:11` | 0.5h | Backend |
| 13 | Add `reconnectionAttempts` cap to consumer socket | `realTimeService.ts` | 0.5h | Frontend |
| 14 | Fix requireAdmin undefined | `batchRoutes.ts` | 0.5h | Backend |

**Phase 1 Exit Criteria:** Karma service endpoints return real data. Webhooks fire. Admin merchant filter works. Wallet calls authenticated.

---

## Phase 2: Financial Atomicity + Data Sync (Week 1-2)

**Goal:** Fix the bugs that lose money or corrupt data.

### Financial Atomicity (~12h)

| # | Fix | File | Est. | Owner |
|---|-----|------|------|-------|
| 15 | Remove double karma credit (earnRecordService + karmaService) | Both files | 2h | Backend |
| 16 | Wrap batch pool decrement in transaction | `batchService.ts` | 2h | Backend |
| 17 | Add retry + DLQ to referral credit | `ReferralService.ts` | 2h | Backend |
| 18 | Add idempotency key to referral credit | `ReferralService.ts` | 1h | Backend |
| 19 | Add idempotency key to settlement processor | `payouts.ts` | 2h | Backend |
| 20 | Add third persistence layer for gamification | Gamification service | 2h | Backend |

### Data Sync (~13h)

| # | Fix | File | Est. | Owner |
|---|-----|------|------|-------|
| 21 | Define canonical CoinTransaction schema | shared-types | 4h | Backend |
| 22 | Migrate existing CoinTransaction records | All services | 3h | Backend |
| 23 | Add cashback/referral to wallet coin types | Wallet models | 2h | Backend |
| 24 | Fix wallet service Redis cache invalidation | Cache layer | 2h | Backend |
| 25 | Add event-driven product sync to admin | SyncService | 2h | Backend |

**Phase 2 Exit Criteria:** No double karma credits. No silent financial failures. CoinTransaction has one canonical schema.

---

## Phase 3: Type + Enum Normalization (Week 2-3)

**Goal:** Fix the root cause. One fix resolves 100+ instances.

### Shared Types + Enums (~20h)

| # | Fix | Files | Est. | Owner |
|---|-----|-------|------|-------|
| 26 | Define canonical status enums in shared-types | All apps | 3h | All |
| 27 | Import canonical enums everywhere (enforce ESLint) | All apps | 4h | All |
| 28 | Align POS bill statuses with canonical schema | `pos.ts` | 1h | Frontend |
| 29 | Remove duplicate TransactionMetadata interface | `walletApi.ts` | 0.25h | Frontend |
| 30 | Import WEEKLY_COIN_CAP from engine | `karmaService.ts` | 0.25h | Backend |
| 31 | Import getConversionRate from engine | `karmaRoutes.ts` | 0.25h | Backend |
| 32 | Remove duplicate startOfWeek computation | `karmaService.ts` | 0.25h | Backend |
| 33 | Add transactionGroupId FK to ledger | Transaction models | 2h | Backend |
| 34 | Remove phantom coins.available balance | `UserLoyalty.ts` | 2h | Backend |
| 35 | Standardize wallet balance response (remove fallbacks) | `coinSyncService.ts` | 1h | Frontend |
| 36 | Remove duplicate delivery field | `ordersApi.ts` | 0.5h | Frontend |

**Phase 3 Exit Criteria:** All enums imported from shared-types. No local enum definitions. No duplicate schemas.

---

## Phase 4: Architecture Fixes (Week 3-5)

**Goal:** Prevent future bugs by fixing the system structure.

### Week 3-4: Architecture Improvements (~15h)

| # | Fix | Files | Est. |
|---|-----|-------|------|
| 37 | Create `no-bespoke-idempotency.sh` fitness test | scripts/ | 2h |
| 38 | Create `no-as-any.sh` fitness test | scripts/ | 2h |
| 39 | Create `canonical-types-only.sh` fitness test | scripts/ | 2h |
| 40 | Create `no-501-routes.sh` fitness test | scripts/ | 1h |
| 41 | Add `transactionGroupId` FK linking fiat/coin | Transaction models | 2h |
| 42 | Replace in-memory SyncHistory with MongoDB | `SyncService.ts` | 0.5h |
| 43 | Add merchantId filter to sync statistics | `sync.ts` | 0.5h |
| 44 | Fix wallet microservice missing fields | `Wallet.ts` | 2h |
| 45 | Remove direct user writes from merchant service | Merchant User model | 2h |

### Week 4-5: Real-Time + Offline (~5h)

| # | Fix | Files | Est. |
|---|-----|-------|------|
| 46 | Add real-time updates to admin dashboard | `rez-app-admin` | 2h |
| 47 | Add rollback to cart optimistic updates | Consumer app | 2h |
| 48 | Add error feedback for offline queue failures | Consumer app | 1h |

**Phase 4 Exit Criteria:** All 5 root cause diseases addressed. Fitness tests prevent regression.

---

## Phase 5: Quick Wins + Polish (Week 5-6)

**Goal:** Clean up the remaining 17 LOW issues and apply all 12 quick wins.

| # | Fix | Est. |
|---|-----|------|
| QW-1 to QW-12 | All quick wins | ~3h total |
| RP-L01 | Normalize order confirmation status | 0.25h |
| RP-L02 | Align creator payout status | 0.25h |
| RP-L07 | Apply IST offset to weekly cap | 0.5h |
| RP-L12 | Add max amount validation | 0.5h |
| RP-L13 | Reject zero-amount transactions | 0.25h |
| RP-L17 | Standardize pagination across endpoints | 1h |

---

## Progress Tracking

After each fix:
1. Mark as **FIXED** in the gap doc's status table
2. Run `npm run burn-down` to update metrics
3. Verify with arch fitness tests: `scripts/arch-fitness/*.sh`
4. Update `docs/BURN_DOWN_DASHBOARD.md`

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| Phase 1 | Breaking karma routes by changing mount path | Test all karma endpoints after change |
| Phase 2 | Transaction changes could cause deadlocks | Add indexes before adding transactions |
| Phase 3 | ESLint enforcement could break builds | Run in warn mode first, then error |
| Phase 4 | Fitness test false positives | Tune thresholds before enforcing |

---

## Dependencies

| Phase | Depends On |
|-------|-----------|
| Phase 2 | Phase 1 complete (routes wired = can test atomicity) |
| Phase 3 | Phase 1 complete (canonical schemas needed) |
| Phase 4 | Phase 3 complete (types/enums normalized) |
| Phase 5 | Phase 4 complete (architecture stable) |

---

**Last Updated:** 2026-04-16
**Total:** ~95h across 6 weeks
**Recommended team:** 1 backend engineer + 1 frontend engineer working in parallel
