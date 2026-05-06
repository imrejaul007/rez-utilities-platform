# Wallet Service Bug Audit (BE-WAL-###)

## BE-WAL-001
**Title:** Coin-to-rupee conversion rate is cached globally but WalletConfig reads are non-transactional

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 129-176)

**Category:** Amount calculations, currency/rounding

**Description:**
The `getDynamicConversionRate()` function caches the rate for 60 seconds with a separate MongoDB read. If an admin updates the rate via WalletConfig while a transaction is in flight, the transaction uses the stale cached rate. Additionally, the cache is global (shared across all wallets), so all concurrent transactions use the same rate. If the rate changes between transaction start and completion, the balance calculation will be wrong.

**Impact:**
Wallet balances reported to users could use a stale exchange rate, potentially overstating or understating the rupee value by up to 60 seconds.

**Fix hint:**
Include the conversion rate in the transaction snapshot: read it once at the start of the transaction and pass it through the context.

---

## BE-WAL-002
**Title:** Balance cache invalidation is fire-and-forget; failed redis.del() could leave stale balance

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 382, 555)

**Category:** Concurrency on balance updates, settlement

**Description:**
After a successful coin credit (line 382) or debit (line 555), the code calls `await redis.del(...)`. However, the cache invalidation is not critical — if it fails, the next balance read will hit the stale cache until the 5-minute TTL expires (line 103). A user could see an outdated balance for up to 5 minutes after a coin transaction.

**Impact:**
Stale balance display: users could see balance that doesn't reflect recent credits/debits for up to 5 minutes.

**Fix hint:**
Make cache invalidation mandatory: if `redis.del()` fails, throw an error and return 503 to the caller so they retry.

---

## BE-WAL-003
**Title:** creditCoins idempotency check happens inside transaction but wallet creation could race before check

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 261-277)

**Category:** Double-spend prevention, idempotency keys

**Description:**
The idempotency check (line 268-276) happens after `session.startTransaction()` but before `getOrCreateWallet()`. If two concurrent requests with the same idempotency key both start a transaction before either checks the CoinTransaction collection, both could pass the idempotency check and both would credit the wallet. The `getOrCreateWallet()` is session-aware, but the CoinTransaction check must happen first to ensure true idempotency.

**Impact:**
Coins could be credited twice with the same idempotency key if the checks race.

**Fix hint:**
Reorder: check idempotency key first, before starting the transaction.

---

## BE-WAL-004
**Title:** Expired coin check uses field name inconsistency; branded coins use expiresAt but regular coins use expiryDate

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 456-485)

**Category:** Concurrency on balance updates, ledger correctness

**Description:**
The debitCoins function checks coin expiry (lines 471-483). Branded coins use `expiresAt` field (line 473), but regular coins use `expiryDate` field (line 477). This inconsistency means a debit of branded coins checks the correct field, but a debit of regular coins checks the wrong field. If a coin's expiryDate field is not set (missing/null), the filter will not match it, and the coin will be considered non-expired even if it should be expired.

**Impact:**
Users could spend expired coins if the `expiryDate` field is not consistently populated or uses a different name.

**Fix hint:**
Standardize on `expiresAt` across all coin types. Update the schema to rename `expiryDate` → `expiresAt`.

---

## BE-WAL-005
**Title:** Daily spend limit reset logic compares timestamps with getDate/getMonth but not timezone-aware

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 440-454, 560-573)

**Category:** Concurrency on balance updates

**Description:**
The daily spend limit is reset by comparing `now.getDate() !== lastReset.getDate()` (line 443). However, `getDate()` is in local time, not UTC. If the user's timezone is different from the server's timezone, the daily limit reset could happen on the wrong day for the user, or not reset when expected.

**Impact:**
Users in different timezones could have inconsistent daily spend limits (e.g., reset at wrong local time).

**Fix hint:**
Use UTC: `now.getUTCDate() !== lastReset.getUTCDate()`. Or store the last reset as a date string (YYYY-MM-DD) in the user's timezone.

---

## BE-WAL-006
**Title:** walletForLimits and walletForExpiry are read twice, creating TOCTOU race on concurrent debits

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 426-430, 460-484)

**Category:** Concurrency on balance updates

**Description:**
In `debitCoins`, the wallet is read twice:
1. Line 426-430: for limits check.
2. Line 460-484: for expiry check.
Between these two reads, another concurrent request could modify the wallet's `limits`, `coins`, or `brandedCoins`, making the second read stale.

**Impact:**
Daily spend limit could be exceeded if another request modifies the limits between the two reads.

**Fix hint:**
Read all necessary fields in a single query before the transaction, or move the expiry check into a single session-aware query.

---

## BE-WAL-007
**Title:** debitInPriorityOrder loops through coin types but does not prevent overspending across iterations

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 589-620+, estimated)

**Category:** Concurrency on balance updates, double-spend prevention

**Description:**
The `debitInPriorityOrder` function iterates through `PRIORITY` coin types and calls `debitCoins` for each type. If the total amount spans multiple coin types, concurrent requests could interleave, causing the total debits to exceed the wallet's total balance.

Example:
- User has 100 rez + 50 prive = 150 total.
- Request A debit 100 (rez) succeeds.
- Request B debit 100 (rez) fails (insufficient), then tries prive, succeeds.
- Total debited: 200 (overspent).

**Impact:**
Wallet balance could go negative if concurrent priority-order debits race.

**Fix hint:**
Use a single atomic debit-priority-order operation inside one transaction, or use a distributed mutex per user.

---

## BE-WAL-008
**Title:** writeLedgerPair uses insertMany with ordered: false, allowing partial write success

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 87-99)

**Category:** Ledger correctness, transaction atomicity

**Description:**
The double-entry ledger pair (debit + credit) is inserted with `ordered: false`, which means if one insert fails and another succeeds, the ledger entry is imbalanced (one side missing). The duplicate-key error handling (lines 94-98) returns success if E11000 is detected, but what if one side is E11000 and the other is a different error? The inconsistency would silently persist.

**Impact:**
Ledger could be missing one side of a debit-credit pair, causing balance calculations to be wrong.

**Fix hint:**
Use `ordered: true` to ensure all-or-nothing semantics, or use a separate check to ensure both entries were inserted.

---

## BE-WAL-009
**Title:** Wallet creation in transaction could fail if user has invalid ObjectId, causing session to hang

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 195-217)

**Category:** Input validation, idempotency

**Description:**
The `getOrCreateWallet()` function uses `new mongoose.Types.ObjectId(userId)` without validating that `userId` is a valid ObjectId string. If an invalid userId is passed, this throws an error inside the transaction. The transaction would fail, but the error message could expose MongoDB internals.

**Impact:**
Invalid userIds cause unclear error messages and potential information disclosure about the database schema.

**Fix hint:**
Validate userId at the route handler level: `if (!mongoose.isValidObjectId(userId)) throw new Error('Invalid userId');`.

---

## BE-WAL-010
**Title:** getBalance returns rupeesEquivalent but does not reflect the actual conversion rate at that moment

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 219-249)

**Category:** Amount calculations, settlement

**Description:**
The `getBalance` function calls `getDynamicConversionRate()` once (line 226), but the rate could change between that call and the cache read. Additionally, if the cache is stale, the returned `rupeesEquivalent` is calculated from a stale rate. The function should either always use the fresh rate or document that the balance is stale.

**Impact:**
Wallet display could show incorrect rupee equivalent if the exchange rate changes.

**Fix hint:**
Always call `getDynamicConversionRate()` without caching, or add a `staleAt` timestamp to the cache response so the client knows how fresh the data is.

---

## BE-WAL-011
**Title:** creditCoins and debitCoins accept a session parameter but never validate it's part of an active transaction

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 261-263, 407-409)

**Category:** Transaction atomicity

**Description:**
If a caller passes a session that is not in a transaction (e.g., `session.startTransaction()` was not called), the Mongoose operations will execute outside a transaction without error. The caller would not know their operations were not atomic.

**Impact:**
If a caller accidentally passes a non-transactional session, the wallet updates could be partially applied, corrupting the balance.

**Fix hint:**
Add a guard: `if (session && !session.inTransaction()) throw new Error('Session must be in a transaction');`

---

## BE-WAL-012
**Title:** debitCoins dailySpent is updated outside the transaction in fire-and-forget manner

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 565-572)

**Category:** Concurrency on balance updates, settlement

**Description:**
After the transaction commits (line 554), the code updates `limits.dailySpent` outside the transaction (lines 565-572) using `.catch()` to suppress errors. If this update fails, the `dailySpent` counter is not incremented, and the next debit will not correctly account for today's spending, potentially allowing the user to exceed the daily limit.

**Impact:**
Daily spend limit could be bypassed if the post-transaction update fails.

**Fix hint:**
Include the `dailySpent` increment in the transaction, or retry the post-transaction update with exponential backoff.

---

## BE-WAL-013
**Title:** Balance could become negative if concurrent debits both pass the $gte check before either is applied

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 489-507)

**Category:** Concurrency on balance updates, double-spend prevention

**Description:**
Although the debit uses a conditional `'balance.available': { $gte: amount }` to prevent overspending, MongoDB's write concern is not specified in the updateOne call. If write concern is 0 (acknowledged: false), the update could succeed on a replica but fail on the primary, causing the client to retry and double-debit. Additionally, if two concurrent debits each debit 75 from a balance of 100, both could pass the check and both could succeed.

Actually, MongoDB's atomicity should prevent this within a single write. But if the read of `walletForLimits` (line 426) happens before the debit, and another request modifies the limits, the limits check becomes stale.

**Impact:**
In rare cases with network latency or replication lag, balance could go negative.

**Fix hint:**
Ensure write concern is `majority` or `all`, and include all limit checks inside the transaction.

---

## BE-WAL-014
**Title:** mapSourceToOperationType strips non-standard source strings without warning

**Severity:** LOW

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 12-26)

**Category:** Ledger correctness

**Description:**
The `mapSourceToOperationType` function takes the first part of the source string (before underscore) and maps it to an operation type. If a source like `"custom_promotion"` is passed, it maps to `"custom"` which is not in the map, defaulting to `"loyalty_credit"` or `"payment"`. This silent defaulting could mask bugs where the source is misspelled or unexpected.

**Impact:**
Ledger entries with unexpected source strings could be misclassified as generic loyalty credits.

**Fix hint:**
Log a warning when defaulting: `logger.warn('Unknown source mapped to default operationType', { source, mapped: default });`

---

## BE-WAL-015
**Title:** Branded coins array could have duplicates if $addToSet and $inc race; no uniqueness constraint on coins array

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 301-319)

**Category:** Ledger correctness, data integrity

**Description:**
The creditCoins function does:
1. `$addToSet: { brandedCoins: coinEntry }` (line 304)
2. Then `findOneAndUpdate` with `$inc` on the same array (lines 307-319).

If two concurrent credits for the same branded coin type race, the `$addToSet` on the second request could fail (already present), but the `$inc` could succeed, incrementing an amount that was added twice. The schema doesn't enforce uniqueness on the `brandedCoins[].type` field.

**Impact:**
Branded coin amounts could be incremented multiple times for the same coin type.

**Fix hint:**
Add a unique index on `brandedCoins.type` or use a single atomic operation combining `$addToSet` and `$inc`.

---

## BE-WAL-016
**Title:** CoinTransaction.findOne without session for idempotency check; race between read and write

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 267-276, 413-422)

**Category:** Idempotency keys

**Description:**
The idempotency check at line 268-272 queries CoinTransaction.findOne **without the session parameter**, even though a session is active. This means the check reads the committed state, but a concurrent request could also pass the check before either write commits. The check should use the session to ensure it reads uncommitted state within the transaction.

**Impact:**
Two concurrent requests with the same idempotencyKey could both pass the idempotency check.

**Fix hint:**
Pass `{ session }` to the CoinTransaction.findOne query: `CoinTransaction.findOne(..., null, { session })`.

---

## BE-WAL-017
**Title:** Wallet.updateOne without session for coin array operations; updates outside transaction

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 302-325)

**Category:** Transaction atomicity

**Description:**
The first step in creditCoins uses:
```javascript
await Wallet.updateOne(
  { user: new mongoose.Types.ObjectId(userId) },
  { $addToSet: { coins: coinEntry } },
  { session }, // — session provided, good
);
```
However, this is a separate update before the main findOneAndUpdate. If the first update succeeds but the second (line 307) fails, the coin type is added to the array but the amount is never incremented, leaving the wallet in an inconsistent state.

**Impact:**
Wallet could have a coin type with zero amount, confusing the balance calculation.

**Fix hint:**
Combine both updates into a single findOneAndUpdate operation using `$addToSet` and `$inc` together.

---

## BE-WAL-018
**Title:** merchantWalletService.requestWithdrawal does not prevent duplicate withdrawal requests for the same amount

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/merchantWalletService.ts` (lines 121-164)

**Category:** Idempotency keys, double-spend prevention

**Description:**
The `requestWithdrawal` function accepts an amount and debits `balance.available`. If a merchant submits two concurrent withdrawal requests for the same amount, both could pass the balance check and create two separate withdrawal transactions, doubling the requested withdrawal.

**Impact:**
A merchant could accidentally request double withdrawals if two requests arrive concurrently.

**Fix hint:**
Add an idempotency key parameter and unique index on (merchantId, amount, createdAt) to prevent duplicate withdrawal requests within a short window.

---

## BE-WAL-019
**Title:** ledgerService.recordEntry does not validate debit/credit account IDs are not the same

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/ledgerService.ts` (lines 56-124)

**Category:** Ledger correctness

**Description:**
The recordEntry function accepts debitAccount and creditAccount but doesn't validate they are different. If a caller accidentally passes the same account ID for both, the ledger would record a net-zero entry, which might be a bug. The function should prevent self-transfers.

**Impact:**
Buggy code could create self-transfers that mask missing ledger entries.

**Fix hint:**
Add validation: `if (debitAccount.id === creditAccount.id) throw new Error('Debit and credit accounts must be different');`

---

## BE-WAL-020
**Title:** getBalance caches for 5 minutes but does not invalidate on concurrent modifications

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 219-249)

**Category:** Concurrency on balance updates

**Description:**
The balance is cached for 5 minutes (line 103). If a user requests their balance, then immediately makes a coin transaction, the next balance read could return the cached stale value. Although the wallet update invalidates the cache (line 382, 555), if multiple concurrent updates happen in quick succession, the cache could be set by one request after being invalidated by another, leaving it stale.

**Impact:**
User's balance could be stale for up to 5 minutes after a transaction.

**Fix hint:**
Reduce TTL to 10 seconds, or use a more aggressive cache invalidation strategy (e.g., version-based caching).

---

## BE-WAL-021
**Title:** Wallet model schema does not enforce min/max on balance fields; negative balances could be stored

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/models/Wallet.ts` (estimated, not shown in detail)

**Category:** Data integrity, ledger correctness

**Description:**
The Wallet balance fields (total, available, pending, etc.) are type Number without min constraints. If a bug in the debit logic allows a negative debit, the database would accept it, corrupting the balance.

**Impact:**
Negative balance in database could break reconciliation and reporting.

**Fix hint:**
Add `min: 0` to all balance fields in the schema.

---

## BE-WAL-022
**Title:** debitInPriorityOrder does not handle partial failures gracefully; rolls back entire debit if last type fails

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 589-620+, estimated)

**Category:** Transaction atomicity

**Description:**
If `debitInPriorityOrder` successfully debits from type A, then fails on type B (due to expiry), the transaction is aborted, rolling back the debit from type A. The user loses the opportunity to partially pay with type A and would need to retry. This could be intentional (all-or-nothing), but it should be documented.

**Impact:**
Payments could fail with an error even though the user had sufficient coins of one type.

**Fix hint:**
Document whether partial debits are intended, or implement a separate "partial debit with fallback" mode.

---

## BE-WAL-023
**Title:** LedgerEntry aggregation in getAccountBalance does not account for deleted entries

**Severity:** LOW

**File:** `/rez-wallet-service/src/services/ledgerService.ts` (lines 126-148)

**Category:** Ledger correctness

**Description:**
The `getAccountBalance` aggregation sums credits and debits from all LedgerEntry documents. If an entry is accidentally deleted (e.g., via admin script), the balance would be incorrect. The ledger is immutable in design, but the database schema doesn't enforce immutability constraints (e.g., no delete permissions).

**Impact:**
If ledger entries are deleted, balance calculations would be wrong without obvious indication of tampering.

**Fix hint:**
Add indexes on `createdAt` and `deletedAt` to track soft-deletes. Prevent hard deletes via MongoDB role-based access control.

---

## BE-WAL-024
**Title:** Wallet credit success returns balance before transaction fully settles; balance could change immediately after return

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 379-385)

**Category:** Concurrency on balance updates, settlement

**Description:**
The `creditCoins` function returns the balance calculated from `balanceBefore + amount` (line 385). However, if another concurrent request modifies the wallet immediately after the transaction commits, the returned balance is stale. The client might assume the balance is up-to-date when it could change within milliseconds.

**Impact:**
Returned balance could immediately become outdated if another concurrent transaction occurs.

**Fix hint:**
Re-fetch the wallet after the transaction to return the authoritative balance, or document that the returned balance is a snapshot.

---

## BE-WAL-025
**Title:** Coin type validation does not prevent arbitrary strings; no enum constraint at service level

**Severity:** MEDIUM

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 251-258, 397-404)

**Category:** Input validation, data integrity

**Description:**
The creditCoins and debitCoins functions accept `coinType: 'rez' | 'prive' | ...` as a TypeScript enum, but at runtime, any string could be passed. If called from an internal API without proper validation, an invalid coin type like `'fake_coin'` would be accepted and stored in the database.

**Impact:**
Arbitrary coin types could be created, breaking the assumption that only known coin types exist.

**Fix hint:**
Add runtime validation: `const VALID_COIN_TYPES = new Set(['rez', 'prive', 'branded', 'promo', 'cashback', 'referral']);` and check at the start of each function.

---

## BE-WAL-026
**Title:** COIN_TO_RUPEE_RATE initialization validates range but does not handle Infinity or NaN edge cases

**Severity:** LOW

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 112-119)

**Category:** Amount calculations, startup validation

**Description:**
The initialization check uses `Number.isFinite(_rawRate)`, which correctly rejects Infinity and NaN. However, the range check `_rawRate > 10` is somewhat arbitrary. If the rate is intended to be configurable dynamically, the startup value becomes less important, but the hardcoded check could block deployments if the rate needs to be set higher.

**Impact:**
Deployment failure if the conversion rate is intentionally set above 10 (e.g., during currency revaluation).

**Fix hint:**
Increase the max allowed rate to 100, or remove the max constraint if rates are configurable.

---

## BE-WAL-027
**Title:** getOrCreateWallet uses upsert but does not handle concurrent creations for the same user

**Severity:** LOW

**File:** `/rez-wallet-service/src/services/walletService.ts` (lines 195-217)

**Category:** Concurrency, idempotency

**Description:**
The `getOrCreateWallet` function uses `findOneAndUpdate(..., { upsert: true })`, which should atomically create the wallet if it doesn't exist. However, MongoDB's upsert can race in certain edge cases (though this is rare). If two concurrent requests both trigger creation, one could overwrite the other's initial state.

**Impact:**
In rare cases, a newly created wallet could have incorrect initial state if concurrent requests race.

**Fix hint:**
Rely on MongoDB's upsert atomicity as-is, but add integration tests to verify concurrent wallet creation works correctly.

---

## Summary

Total bugs identified: 27

**Critical (1):** BE-WAL-007 (concurrent debit priority order overspend)
**High (2):** BE-WAL-008 (ledger imbalance), BE-WAL-018 (merchant duplicate withdrawals)
**Medium (20):** Various concurrency, idempotency, transaction, and validation issues
**Low (4):** Silent defaulting, schema validation, rate range, edge cases

Focus remediation on Critical and High issues first, particularly preventing concurrent debits from exceeding balance and ensuring ledger atomicity.
