# Bug Report: Auth & Data Sync Layer (Layer 4)

**Audit Date:** 2026-04-12  
**Layer:** Authentication middleware, token handling, cross-app data synchronization  
**Status:** CRITICAL — security vulnerabilities + sync pipeline doesn't exist

---

## C4 — Wallet + Payment services fail OPEN on Redis outage {#c4}
> **Status:** ✅ FIXED

**Severity:** CRITICAL — financial integrity risk  
**Impact:** Revoked and logged-out tokens can access wallet mutations and payment APIs during any Redis downtime.

**What is happening:**  
`rez-wallet-service/src/middleware/auth.ts` (lines 51–69):
```typescript
try {
  const isBlacklisted = await redis.exists('blacklist:token:' + token);
  if (isBlacklisted) return res.status(401).json({ error: 'Token revoked' });
} catch {
  // Redis unavailable — fail open, do not block request
}
```

`rez-payment-service/src/middleware/auth.ts` (lines 59–77): identical pattern.

The main backend (`auth.ts` line 285) correctly handles this:
```typescript
const failClosed = process.env.NODE_ENV === 'production';
if (failClosed) return res.status(503).json({ error: 'Auth service unavailable' });
```

The wallet and payment microservices have weaker security than the monolith they were split from.

**Files involved:**
- `rez-wallet-service/src/middleware/auth.ts` (lines 51–69)
- `rez-payment-service/src/middleware/auth.ts` (lines 59–77)
- `rezbackend/rez-backend-master/src/middleware/auth.ts` (line 285 — reference implementation)

**Fix:**  
Copy the `failClosed` pattern to both microservices:
```typescript
} catch (err) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({ error: 'Auth service temporarily unavailable' });
  }
  // fail open only in development
}
```

---

## C5 — Wallet service accepts merchant + admin JWTs for user wallet operations {#c5}
> **Status:** ✅ FIXED

**Severity:** CRITICAL — broken privilege boundary  
**Impact:** A merchant with a valid JWT can read and mutate any user's wallet via the wallet-service API.

**What is happening:**  
`rez-wallet-service/src/middleware/auth.ts` (lines 26–40):
```typescript
const secrets = [JWT_SECRET, JWT_MERCHANT_SECRET, JWT_ADMIN_SECRET];
for (const secret of secrets) {
  try {
    decoded = jwt.verify(token, secret);
    break;
  } catch {}
}
```

This tries three secrets in sequence. A merchant token signed with `JWT_MERCHANT_SECRET` successfully passes the wallet-service auth check. There is no subsequent role check to ensure user-wallet endpoints are accessed only by `role: 'user'` tokens.

The main backend's `verifyToken()` (lines 129–157 of `auth.ts`) binds each token type to its correct secret and rejects tokens signed with the wrong secret.

**Files involved:**
- `rez-wallet-service/src/middleware/auth.ts` (lines 26–40)
- `rezbackend/rez-backend-master/src/middleware/auth.ts` (lines 129–157 — reference)

**Fix:**  
Option A: Use only `JWT_SECRET` to verify user-facing wallet endpoints. Add a separate `requireMerchantAuth` middleware for merchant-facing wallet routes that verifies against `JWT_MERCHANT_SECRET`.

Option B: Add role validation after token decode:
```typescript
if (req.path.startsWith('/api/wallet/') && decoded.role !== 'user') {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

---

## C6 — Logged-out merchant tokens remain valid in wallet-service {#c6}
> **Status:** ✅ FIXED

**Severity:** CRITICAL — persistent unauthorized access after logout  
**Impact:** A merchant who logs out retains wallet-service access for the full remaining JWT lifetime (up to 15 minutes default, longer if `JWT_EXPIRES_IN` is higher).

**What is happening:**  
Main backend blacklists merchant tokens with:
```
Redis key: blacklist:merchant:{sha256(token)}
```
(File: `rezbackend/src/middleware/merchantauth.ts` lines 24–29)

Wallet service checks blacklist with:
```
Redis key: blacklist:token:{raw_token}
```
(File: `rez-wallet-service/src/middleware/auth.ts` line 53)

The prefix (`merchant:` vs `token:`) and hashing (`sha256` vs raw) never match. A blacklisted merchant token will never be found by the wallet service.

**Files involved:**
- `rezbackend/rez-backend-master/src/middleware/merchantauth.ts` (lines 24–29)
- `rez-wallet-service/src/middleware/auth.ts` (line 53)

**Fix:**  
Standardize blacklist key format across all services. Recommended: `blacklist:{sha256(token)}` — no role prefix, consistent hashing. Update all services to use this format. Update `blacklistToken()` in the backend to use the same key format.

---

## C7 — CrossAppSyncService webhook delivery is dead code {#c7}
> **Status:** ✅ FIXED

**Severity:** CRITICAL — root cause of "fixing merchant doesn't appear in consumer"  
**Impact:** Every order status update, cashback update, and product update that should flow from merchant app to consumer app is silently discarded. The entire cross-app notification pipeline does not exist.

**What is happening:**  
`rezbackend/rez-backend-master/src/merchantservices/CrossAppSyncService.ts` (lines 261–293):

```typescript
async sendToCustomerApp(webhookUrl: string, event: string, data: any) {
  // Simulated delivery for now
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  console.log(`[CrossAppSync] Simulated webhook delivery: ${event}`);
  
  // ACTUAL HTTP CALL — COMMENTED OUT:
  // const response = await axios.post(webhookUrl, { event, data, timestamp: Date.now() });
  // return response.data;
}
```

Events are enqueued, BullMQ workers exist, routes return success — but no HTTP call is ever made. The `customerAppWebhooks` registration map is also in-memory: cleared on every process restart.

**Files involved:**
- `rezbackend/rez-backend-master/src/merchantservices/CrossAppSyncService.ts` (lines 261–293)

**Fix:**  
1. Uncomment the HTTP call. Add proper error handling and retry via BullMQ (not the in-memory queue).
2. Persist webhook registrations to MongoDB instead of in-memory Map.
3. Add webhook secret verification (HMAC-SHA256 signature on payload).
4. Add dead-letter queue for failed deliveries.

Short-term emergency fix: Return `501 Not Implemented` from all sync endpoints so callers know the feature is not functional.

---

## C8 — `syncOrders()` + `syncCashback()` are no-ops returning `{ success: true }` {#c8}
> **Status:** ✅ FIXED

**Severity:** CRITICAL — false confidence in broken sync  
**Impact:** Any developer or system relying on these endpoints to propagate order/cashback state believes it succeeded when nothing was synced.

**What is happening:**  
`rezbackend/rez-backend-master/src/merchantservices/SyncService.ts` (lines 396–409):
```typescript
case 'orders':
  // sync skipped — managed by user backend
  console.log('Order sync skipped');
  return { synced: 0 };
case 'cashback':
  // sync skipped
  console.log('Cashback sync skipped');
  return { synced: 0 };
```

But `src/merchantroutes/sync.ts` (lines 239–294) has `POST /orders` and `POST /cashback` routes that call these and return:
```json
{ "success": true, "message": "Orders synced successfully", "result": { "synced": 0 } }
```

The `synced: 0` is in the result but the `success: true` headline masks it.

**Files involved:**
- `rezbackend/rez-backend-master/src/merchantservices/SyncService.ts` (lines 396–409)
- `rezbackend/rez-backend-master/src/merchantroutes/sync.ts` (lines 239–294)

**Fix:**  
Immediate: Change response to `501 Not Implemented` with `{ success: false, message: "Order sync not yet implemented" }`.

Long-term: Implement actual sync logic that copies order state from `MerchantOrder` → `Order` (user-side collection), triggering the consumer app update.

---

## H12 — Merchant web tokens stored in localStorage (XSS risk) {#h12}
> **Status:** ✅ FIXED

**Severity:** HIGH — security  
**Impact:** Any XSS vulnerability in the merchant web app can extract authentication tokens.

**What is happening:**  
`rezmerchant/rez-merchant-master/services/storage.ts` (line 15):
```typescript
const COOKIE_AUTH_ENABLED = false;  // hardcoded
```

When `COOKIE_AUTH_ENABLED = false`, the merchant app uses `AsyncStorage` on web, which maps to `localStorage` — plaintext, XSS-accessible.

The backend supports httpOnly cookies via `extractToken()`. The merchant app opts out explicitly.

**Files involved:**
- `rezmerchant/rez-merchant-master/services/storage.ts` (line 15)
- `rezmerchant/rez-merchant-master/services/client.ts` (lines 122–127)

**Fix:**  
Enable httpOnly cookie auth for the merchant web build. Set `COOKIE_AUTH_ENABLED = typeof document !== 'undefined'` (true on web, false on native where SecureStore is used). Update the backend to ensure cookie extraction is active on merchant routes.

---

## M3 — `getLastSyncDate()` never queries MongoDB — full re-sync after every restart {#m3}
> **Status:** ✅ FIXED

**Severity:** MEDIUM  
**Impact:** Unnecessary full product syncs on every server restart. `getSyncStatus()` returns no last sync date even if syncs ran recently.

**What is happening:**  
`rezbackend/rez-backend-master/src/merchantservices/SyncService.ts` (lines 167–170):
```typescript
getLastSyncDate(type: string): Date | null {
  const history = this.syncHistory.filter(h => h.type === type);
  return history.length > 0 ? history[history.length - 1].completedAt : null;
}
```

`syncHistory` is an in-memory array, cleared on every process restart. The method does NOT query `SyncHistoryModel` (MongoDB). Even though `SyncHistoryModel.create()` is called after each sync (persistence exists), the read path ignores it.

**Fix:**  
Update `getLastSyncDate()` to query MongoDB:
```typescript
async getLastSyncDate(type: string): Promise<Date | null> {
  const record = await SyncHistoryModel.findOne({ type }).sort({ completedAt: -1 });
  return record?.completedAt ?? null;
}
```

---

## M4 — `/api/sync/statistics` leaks system-wide stats to any authenticated merchant {#m4}
> **Status:** ✅ FIXED

**Severity:** MEDIUM — data leakage  
**Impact:** Any authenticated merchant can view aggregate sync statistics for all merchants on the platform.

**What is happening:**  
`rezbackend/rez-backend-master/src/merchantroutes/sync.ts` (lines 188–204):
```typescript
router.get('/statistics', async (req, res) => {
  const stats = await SyncService.getSyncStatistics();  // no merchantId filter
  res.json({ success: true, data: stats });
});
```

Every other route in this file calls `validateMerchantId()` and scopes results to the authenticated merchant. The `/statistics` route omits this filter, returning global system-wide aggregate data.

**Files involved:**
- `rezbackend/rez-backend-master/src/merchantroutes/sync.ts` (lines 188–204)

**Fix:**  
Scope the statistics to the authenticated merchant:
```typescript
const merchantId = req.merchant._id;
const stats = await SyncService.getSyncStatistics(merchantId);
```

---

## Data Sync Architecture — Current State

The system uses a hybrid architecture with critical gaps:

| Mechanism | Used for | Reliability | Status |
|-----------|---------|-------------|--------|
| In-process EventEmitter | Logging, metrics, Socket.IO | Low (lost on crash) | Working |
| BullMQ durable queues | Financial events (ORDER_PAID, wallet.*) | High (retry, DLQ) | Working |
| CrossAppSyncService HTTP | Merchant → Consumer notifications | N/A | **Dead code — not implemented** |
| Direct DB write (SyncService) | Product catalog sync | Medium (15-min polling) | Working but limited |
| Polling `setInterval` | `CrossAppSyncService` update queue | Low (500-record cap, in-memory) | Working but not durable |

### Services without durable sync path
- **Gamification service:** In-process EventEmitter is primary. If it fails and BullMQ enqueue also fails, event is lost (fail-open).
- **Admin dashboard:** No push/invalidation mechanism. Reads from MongoDB directly — sees data eventually, but no real-time updates.
- **Consumer app:** Completely dependent on the dead `CrossAppSyncService` for merchant-originated events.

### GAP: Wallet service Redis cache not invalidated by monolith
When `rez-wallet-service` credits/debits a wallet, it invalidates its own Redis cache keys. The monolith has its own Redis cache for wallets (`wallet:{userId}`, `wallet:balance:{userId}`). The wallet service does not know about the monolith's cache keys and does not invalidate them. After a wallet-service mutation, users see stale balances in the monolith for the duration of the cache TTL.

### GAP: Merchant product updates not real-time in admin
Merchant product changes sync to user-side `Product` model only via:
1. Manual trigger: `POST /api/sync/trigger`
2. Auto-sync: 15-minute default interval

No event is published to notify admin. Admin views of product catalogs can be up to 15 minutes stale.

---

## Token Handling Summary

| App | Native storage | Web storage | Cookie auth | Refresh implemented |
|-----|---------------|-------------|-------------|---------------------|
| Merchant app | SecureStore | AsyncStorage (localStorage) | Disabled (hardcoded) | YES |
| Admin app | SecureStore | localStorage | Enabled in production | YES |
| Backend | — | — | Dual-mode (Bearer + cookie) | YES |
| Wallet service | — | — | Bearer only | N/A (stateless) |
| Payment service | — | — | Bearer only | N/A (stateless) |

**Refresh token security gap:**  
`generateRefreshToken()` in `auth.ts` (line 97) signs only `{ userId }` — no `role` claim. On refresh, the new access token's role is looked up from DB. If a stale cache is used, a demoted user receives a new token with their old elevated role. The refresh controller must explicitly query DB for current role — verify this is happening.
