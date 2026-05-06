# Gaps: CROSS-SERVICE TYPE & ENUM ALIGNMENT

**Date:** 2026-04-16
**Purpose:** Document where local types, enums, and contracts diverge from the canonical shared-types package

---

## Files

| File | Description |
|------|-------------|
| `TYPE-DIVERGENCE.md` | Local type definitions vs canonical IKarmaProfile, IKarmaEvent |
| `ENUM-MISMATCH.md` | Status/string enum mismatches across services |
| `CROSS-SERVICE-MATRIX.md` | Issue → existing audit doc cross-reference |

---

## Summary

| Gap | Local | Canonical | Severity | Impact |
|-----|-------|-----------|----------|--------|
| G-CR-X1 | KarmaProfile (14 fields) | IKarmaProfile (20 fields) | HIGH | Missing `_id`, `eventsJoined`, `checkIns`, `approvedCheckIns`, date types |
| G-CR-X2 | `branded_coin` | `branded` | HIGH | Branded coin config fails to match — wrong styling |
| G-CR-X3 | EarnRecord status (consistent) | EarnRecordStatus (consistent) | GOOD | No mismatch — both use uppercase snake_case |
| G-CR-X4 | KarmaEvent (27 fields) | IKarmaEvent (15 fields) | CRITICAL | Types share almost no fields in common |
| G-CR-X5 | `Booking.status: 'checked_in'` | Unknown canonical | MEDIUM | snake_case vs kebab-case risk |
| G-CR-X7 | `Level` | `KarmaLevel` | HIGH | Name divergence, same values — backend exports `Level` not `KarmaLevel` |
| G-CR-X8 | `ConversionRate` | `KarmaConversionRate` | MEDIUM | Name divergence, same values |
| G-CR-X7b | IKarmaEvent (canonical) | 15 fields missing/renamed | CRITICAL | Canonical `baseKarmaPerHour` = local `karmaReward`; `difficulty` is `number` vs union; `startTime`/`endTime`/`location`/`isActive` missing from canonical |
| G-CR-X9 | IEarnRecord (canonical) | 8 fields missing + wrong shape | CRITICAL | Canonical `verificationSignals` = `{qr_verified,face_verified,manual_override}` vs local `{qr_in,qr_out,ngo_approved,photo_proof}` |
| G-CR-X10 | `IConversionBatch` | No local equivalent | HIGH | Canonical `IConversionBatch` is different concept from local `IBatch` |
| G-CR-X11 | `KarmaProfileDelta` | Not exported | MEDIUM | Returned by `applyDailyDecay` but not in types |
| G-CR-X12 | `ILevelInfo.benefits: string[]` | Missing | LOW | Benefits array not in local types |
| G-CR-X13 | `VerificationStatus` (canonical) | Different values | MEDIUM | Canonical: `PENDING/APPROVED/REJECTED` vs local: `PENDING/PARTIAL/VERIFIED/REJECTED` |
| G-CR-X14 | `CSRPoolStatus`, `ApprovalStatus` | Not exported | LOW | Exists in canonical but not exported |
| G-CR-X15 | `IKarmaProfile.updatedAt: Date` | Missing | MEDIUM | Schema has `timestamps: true` but canonical missing `updatedAt` |
| G-CR-X16 | `getMyEvents` uses invalid status | `'upcoming'`/`'past'` not in KarmaEventStatus | MEDIUM | Backend returns empty results for valid user queries |
| G-CR-X17 | History endpoint returns conversion data | Consumer expects earn records | HIGH | Backend returns `{ karmaConverted, coinsEarned }` not `{ records: EarnRecord[] }` |
| G-CR-X18 | `gps_match` stored as boolean | Consumer expects 0-1 number | HIGH | Backend converts `>= 0.5` to boolean, precision lost |
| G-CR-X19 | EarnRecord missing `eventName` | Consumer expects string | HIGH | Backend never populates eventName on earn records |
| G-CR-X20 | `nextLevelAt` nullable on backend | Consumer declares non-nullable | HIGH | L4 users get null, TypeScript says `number` |
| G-CR-X21 | `levelHistory` returned by backend | Consumer has no such field | MEDIUM | Data silently discarded at runtime |
| G-CR-X22 | Consumer sends `page`, backend ignores | No pagination metadata | MEDIUM | Backend returns flat array, consumer expects `{ records, total, page, pages }` |
| G-CR-X23 | Error response shapes inconsistent | All routes use different shapes | MEDIUM | karmaRoutes uses `{ error }`, others use `{ success, message }` |
| G-CR-X24 | HTTP 207 Multi-Status unhandled | apiClient treats 207 as error | MEDIUM | Partial batch success returns 207, consumer shows error |
| G-CR-X25 | Verify routes missing `message` field | Consumer expects string | MEDIUM | Generic "Scan failed" errors instead of specific messages |
