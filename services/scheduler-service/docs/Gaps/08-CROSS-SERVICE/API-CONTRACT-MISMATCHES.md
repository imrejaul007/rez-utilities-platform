# CROSS-SERVICE: API Contract Mismatches

**Date:** 2026-04-16
**Severity:** HIGH across all codebases

---

## Known Mismatches

### Admin App → Backend

| ID | Frontend Expects | Backend Returns | Crash? |
|----|-----------------|---------------|---------|
| AC2-C1 | Flat `UserWallet` | `{ user, wallet }` nested | Blank UI |
| AC2-C2 | `user.name` | Stored as `undefined` | Blank name |
| AC2-C3 | `name`, `storeAddress` | Expects `ownerName`, `businessAddress` | Empty fields |

### Consumer App → Backend

| ID | Frontend Expects | Backend Returns | Crash? |
|----|-----------------|---------------|---------|
| CA-API-001 | `transactionId` | Returns different field | Crash |
| CA-API-002 | `amount` | Returns `amountPaise` | Wrong values |
| CA-API-003 | `order.status` | Returns numeric enum | Display broken |

### Rendez Admin → Backend

| ID | Frontend Expects | Backend Returns | Impact |
|----|-----------------|---------------|--------|
| RZ-A-H1 | `applicantCount: number` | `_count: { applications: N }` | Undefined |
| RZ-A-L4 | `f.profile?.name` | `f.user?.name` | "—" shown |
| RZ-A-H2 | `checkinCount >= 2` | `rewardStatus === 'TRIGGERED'` | Wrong KPI |

### Rendez Mobile → Backend

| ID | Frontend Expects | Backend Returns | Impact |
|----|-----------------|---------------|--------|
| RZ-M-A1 | `status` filter param | Filter never passed | No filtering |
| RZ-M-A3 | `qr_code_url` | Fetched but not rendered | No QR code |
| RZ-M-A5 | `merchant.name` | API returns `merchant_id` | Name shows undefined |

---

## Prevention

1. **Use shared types** — all API responses typed from `packages/shared-types`
2. **Add Pact contract tests** — each service publishes contracts, clients verify
3. **Add Zod schema validation** at API boundary — reject unexpected shapes
4. **Create `src/types/api.ts`** — typed response shapes for every endpoint

---

## Status: ACTIVE
