# ReZ Merchant App — LOW Severity Issues

**Generated:** 2026-04-16 | **Severity:** LOW | **Count:** 149

---

## DISPLAY & UI (12 issues)

---

### G-MA-L01: No skeleton loading on app init

**Status:** OPEN
**File:** `app/index.tsx:31-38`
**Source:** sync-auditor, ux-auditor

Bare `Text>Loading...` during `state.isLoading`. No branded spinner, no skeleton loaders, no indication of what's loading.

**Fix:** Replace with branded splash screen or skeleton for first visible screen.

---

### G-MA-L02: MerchantContext no optimistic updates

**Status:** OPEN
**File:** `contexts/MerchantContext.tsx:213-224`
**Source:** sync-auditor

`updateOrderStatus` waits for API round-trip before reflecting change. KDS has optimistic updates; this context doesn't.

---

### G-MA-L03: subscriptionCount metric never decrements

**Status:** OPEN
**File:** `services/api/socket.ts:450-543`
**Source:** sync-auditor

Each `subscribeTo*` call increments `subscriptionCount`. No unsubscribe calls decrement it. Counter grows indefinitely.

---

### G-MA-L04: KDS duplicate room joins on rapid reconnect

**Status:** OPEN
**File:** `app/kds/index.tsx:897-904`
**Source:** sync-auditor

Multiple `join-store` emissions on rapid connect events — no deduplication check.

---

### G-MA-L05: Disabled outline button loses transparent background

**Status:** OPEN
**File:** `components/ui/PrimaryButton.tsx:140`
**Source:** ux-auditor

Already noted in MEDIUM — disabled outline gets gray background, breaking outline aesthetic.

---

### G-MA-L06: ErrorFallback uses hardcoded emoji icon

**Status:** OPEN
**File:** `components/common/ErrorFallback.tsx:144`
**Source:** ux-auditor

Emoji `⚠️` not accessible, not theme-aware.

---

### G-MA-L07: Confirm account number — no real-time match indicator

**Status:** OPEN
**File:** `components/onboarding/BankDetailsForm.tsx:173-187`
**Source:** ux-auditor

Error only shown on form submit. No real-time green checkmark/red indicator.

---

### G-MA-L08: Fee breakdown — large percentages from small denominators

**Status:** OPEN
**File:** `app/(dashboard)/wallet.tsx:708-711, 757-762`
**Source:** ux-auditor

Flex-based proportional bars misleading when values are uneven.

---

### G-MA-L09: Product price display — as any casts

**Status:** OPEN
**File:** `app/(dashboard)/products.tsx:315`
**Source:** ux-auditor

`Number((item as any).pricing?.selling) || Number(item.price) || 0` — silently falls to 0 on unexpected shape.

---

### G-MA-L10: Aggregator orders — externalId truncation crashes on null

**Status:** OPEN
**File:** `app/(dashboard)/orders.tsx:567`
**Source:** ux-auditor

`order.externalId.slice(-8)` — crashes on null/undefined.

---

### G-MA-L11: Web notification banner — dark mode contrast

**Status:** OPEN
**File:** `app/(dashboard)/orders.tsx:1802`
**Source:** ux-auditor

`backgroundColor: '#1E293B'` with white text — poor contrast in web dark mode.

---

### G-MA-L12: Quick bill color scheme hardcoded

**Status:** OPEN
**File:** `app/pos/quick-bill.tsx`
**Source:** ux-auditor

Hardcoded `#7C3AED`, `#EDE9FE`, `#FFF9E6` — not theme-aware.

---

## SECURITY (9 issues)

---

### G-MA-L13: isBiometricAvailable not cached — repeated native calls

**Status:** OPEN
**File:** `utils/biometric.ts:12-21`
**Source:** security-auditor

Called on every `requireBiometric()`. Each triggers `LocalAuthentication.hasHardwareAsync()`. No memoization.

---

### G-MA-L14: Customer search — no query length limit

**Status:** OPEN
**File:** `services/api/coins.ts:96-109`
**Source:** security-auditor

Extremely long search queries could cause DoS on backend search endpoint.

---

### G-MA-L15: Session timeout parseInt fallback to 0 on invalid env

**Status:** OPEN
**File:** `contexts/AuthContext.tsx:345`
**Source:** security-auditor

`parseInt(process.env.SESSION_TIMEOUT || '3600000')` — invalid value silently falls back. `SESSION_TIMEOUT=0` → immediate session expiry.

---

### G-MA-L16: Web token storage in localStorage (XSS accessible)

**Status:** OPEN
**File:** `services/storage.ts:19`
**Source:** security-auditor

`COOKIE_AUTH_ENABLED` defaults to false on web — tokens in localStorage, XSS-accessible.

---

### G-MA-L17: Invitation token in URL path — access log exposure

**Status:** OPEN
**File:** `services/api/team.ts:335-338`
**Source:** security-auditor

Token appears in URL path, logged by proxies/CDNs/servers.

---

### G-MA-L18: Deep link — custom URL scheme instead of universal links

**Status:** OPEN
**File:** `app.config.js:9, 26, 52-57`
**Source:** security-auditor

`rez-merchant://` custom scheme is interceptable. Use universal links (HTTPS) in production.

---

### G-MA-L19: Console logs in AuthContext expose auth flow internals

**Status:** OPEN
**File:** `contexts/AuthContext.tsx:107, 244, 317, 374`
**Source:** security-auditor

`__DEV__` guarded but reveals suspension states, session timeouts, token lifecycle.

---

### G-MA-L20: API base URL silent fallback in production

**Status:** OPEN
**File:** `app.config.js:133`
**Source:** security-auditor

`EXPO_PUBLIC_API_BASE_URL || 'https://rez-api-gateway.onrender.com/api'` — wrong env silently falls back.

---

### G-MA-L21: MIN_PASSWORD_LENGTH: 6 — OWASP violation

**Status:** OPEN
**File:** `constants/teamConstants.ts:321`
**Source:** security-auditor

6-char minimum allows trivial passwords. OWASP recommends 8+ with complexity.

---

## BUSINESS LOGIC & DATA (15 issues)

---

### G-MA-L22: getRecentPayments returns wrong type

**Status:** OPEN
**File:** `services/api/payments.ts:126-128`
**Source:** payment-auditor

Returns `PaymentsResponse` but callers expect `StorePaymentRecord[]`.

---

### G-MA-L23: Analytics fallback hardcodes 6 statuses to 0

**Status:** OPEN
**File:** `services/api/orders.ts:306`
**Source:** payment-auditor

`confirmed`, `preparing`, `ready`, `out_for_delivery`, `returned` all hardcoded to 0.

---

### G-MA-L24: POSService revenue summary — per-page only

**Status:** OPEN
**File:** `services/api/pos.ts:448`
**Source:** payment-auditor

Revenue totals sum only current page, not true total.

---

### G-MA-L25: Cashback rejection sends reason twice

**Status:** OPEN
**File:** `app/(cashback)/[id].tsx:85`
**Source:** payment-auditor

`rejectionReason` as both `rejectionReason` and `notes`.

---

### G-MA-L26: getItemTotal can return NaN

**Status:** OPEN
**File:** `app/(dashboard)/orders/[id].tsx:100-102`
**Source:** security-auditor

`item.total ?? item.subtotal ?? item.totalPrice ?? item.price * item.quantity` — if price is undefined/null, returns NaN.

---

### G-MA-L27: Order item total — NaN guard missing

**Status:** OPEN
**File:** `app/(dashboard)/orders/[id].tsx:100-102`
**Source:** security-auditor

`NaN` passes through to `formatCurrency` → displays "NaN" to user.

---

### G-MA-L28: POSService createMerchantOrder is fire-and-forget

**Status:** OPEN
**File:** `services/api/pos.ts:650-662`
**Source:** security-auditor

Non-fatal error swallowed. Ledger write failures silently lost.

---

### G-MA-L29: Dashboard revenue bar — flex layout misleading

**Status:** OPEN
**File:** `app/(dashboard)/wallet.tsx:1157-1174`
**Source:** ux-auditor

Flex-based bars don't accurately represent proportions with uneven values.

---

### G-MA-L30: No idempotency key on financial operations

**Status:** OPEN
**File:** Multiple financial services
**Source:** security-auditor

Rapid double-taps on "Award Coins" → multiple API calls → multiple awards. No `X-Idempotency-Key` header.

---

### G-MA-L31: Coin award history page — no limit cap

**Status:** OPEN
**File:** `services/api/coins.ts:147-168`
**Source:** security-auditor

`limit` defaults to 20, no maximum enforced. Caller could request `limit: 10000`.

---

### G-MA-L32: Duplicate rejection reason sent twice

**Status:** OPEN
**File:** `app/(cashback)/[id].tsx:85`
**Source:** ux-auditor

`rejectionReason` sent as both `rejectionReason` and `notes` fields.

---

### G-MA-L33: Account number field secureTextEntry

**Status:** OPEN
**File:** `components/onboarding/BankDetailsForm.tsx:169`
**Source:** ux-auditor

`secureTextEntry` masks digits — user can't verify correctness. Banks typically show last 4 only.

---

### G-MA-L34: Aadhar validation requires exactly 12 digits

**Status:** OPEN
**File:** `components/onboarding/BankDetailsForm.tsx:98-102`
**Source:** ux-auditor

`/^[0-9]{12}$/` — rejects formatted input like "1234 5678 9012".

---

### G-MA-L35: Dashboard revenue bar flex width misleading

**Status:** OPEN
**File:** `app/(dashboard)/wallet.tsx:1157-1174`
**Source:** ux-auditor

`flex: stats.netSales` — small values get tiny bars even when representing significant percentages.

---

### G-MA-L36: Stale comment never cleaned up

**Status:** OPEN
**File:** `types/api.ts:171-172`
**Source:** logic-auditor

Comment references backend values (`pending`, `processing`, `paid`) that don't match the actual PaymentStatus type below it.

---

## ARCHITECTURE (14 issues)

---

### G-MA-L37: ProductFilters duplicate definition in same file

**Status:** OPEN
**File:** `types/api.ts:453, 503`
**Source:** logic-auditor

Two separate definitions in the same file. TypeScript uses the latter.

---

### G-MA-L38: Magic numbers not all abstracted

**Status:** OPEN
**Files:** `services/offline.ts:174`, `services/api/products.ts:129`, `services/offlinePOSQueue.ts:239`
**Source:** logic-auditor

Dead letter cutoff (7 days), request timeout (30s), batch size (50) all inlined.

---

### G-MA-L39: Socket pingInterval typed as any

**Status:** OPEN
**File:** `services/api/socket.ts:29`
**Source:** api-auditor

`private pingInterval: any = null` — should be `ReturnType<typeof setInterval> | null`.

---

### G-MA-L40: POS Index renderProduct callback recreated on cart change

**Status:** OPEN
**File:** `app/pos/index.tsx:797-815`
**Source:** sync-auditor

`useCallback` dependencies include `cart` — FlatList re-renders entirely on each cart update.

---

### G-MA-L41: SocketService hardcoded 10s connection timeout

**Status:** OPEN
**File:** `services/api/socket.ts:75-83`
**Source:** sync-auditor

Not configurable per network condition. Fails falsely on slow 2G.

---

### G-MA-L42: emit() silently drops events before socket init

**Status:** OPEN
**File:** `services/api/socket.ts:574-581`
**Source:** sync-auditor

If socket is null (not initialized), event is gone. Not all callers wrap with queueEvent.

---

### G-MA-L43: Hardcoded GST 9% in settlements

**Status:** OPEN
**File:** `app/settlements/index.tsx:247-248`
**Source:** payment-auditor

CGST/SGST hardcoded as 9% — wrong for non-F&B categories.

---

### G-MA-L44: useNetworkStatus — double sync on network restoration

**Status:** OPEN
**File:** `hooks/useNetworkStatus.ts:188-244`
**Source:** sync-auditor

`addEventListener` fires immediately + `fetch()` also fires → `performSync()` called twice.

---

### G-MA-L45: No pagination on POS product catalog

**Status:** OPEN
**File:** `app/pos/index.tsx:400-431`
**Source:** sync-auditor

Catalog hard-capped at 100 products. No load-more, no scroll pagination.

---

### G-MA-L46: KDS order limit 200 — no date filter, no auto-purge

**Status:** OPEN
**File:** `app/kds/index.tsx:803-821`
**Source:** sync-auditor

Busy restaurants fill limit with `ready` orders. New orders dropped.

---

### G-MA-L47: StoreContext redundant loadStores on auth state changes

**Status:** OPEN
**File:** `contexts/StoreContext.tsx:337-347`
**Source:** sync-auditor

`useEffect` dependencies `[authLoading, isAuthenticated, loadStores]` — double call possible during auth transition.

---

### G-MA-L48: offlinePOSQueue batch sync no exponential backoff

**Status:** OPEN
**File:** `services/offlinePOSQueue.ts:251-274`
**Source:** sync-auditor

Retry immediately on failure — hammers rate-limited server. No circuit breaker.

---

### G-MA-L49: No audit log ownership filter validation

**Status:** OPEN
**File:** `services/api/audit.ts:77`
**Source:** security-auditor

`userId` filter passed from caller without validation against merchant ownership.

---

### G-MA-L50: createBill excess discount silently discarded

**Status:** OPEN
**File:** `services/api/pos.ts:252`
**Source:** logic-auditor

Rs.1000 discount on Rs.100 order → `Math.max(0, total)` → discount lost, no warning to merchant.

---

### G-MA-L51: Basket size trend edge case division by zero

**Status:** OPEN
**File:** `services/api/dashboard.ts:139`
**Source:** logic-auditor

`lastWeekAvg > 0` guard exists but not `thisWeekAvg === 0 && lastWeekAvg === 0` → shows 0% when should show N/A.

---

### G-MA-L52: Duplicate metric keys trend vs change

**Status:** OPEN
**File:** `services/api/dashboard.ts:31`
**Source:** logic-auditor

`revenue.trend ?? revenue.change ?? raw.revenueGrowth` — semantically different fields populated identically.

---

### G-MA-L53: POS Index renderProduct callback recreated every cart change

**Status:** OPEN
**File:** `app/pos/index.tsx:797`
**Source:** sync-auditor

`[cart, addToCart, promptQty]` dependencies recreate callback on each cart update → full FlatList re-render.

---

### G-MA-L54: POS offline screen no duplicate detection

**Status:** OPEN
**File:** `app/pos/offline.tsx:176-191`
**Source:** sync-auditor

Network blip or double-tap queues two identical bills.

---

### G-MA-L55: offlineService dead letter queue unbounded at 1000

**Status:** OPEN
**File:** `services/offline.ts:42`
**Source:** sync-auditor

Recent 1000 entries persist indefinitely — storage growth.

---

### G-MA-L56: POS offline queue eviction silently drops oldest

**Status:** OPEN
**File:** `services/offlinePOSQueue.ts:62-72`
**Source:** sync-auditor

At 500 bills, oldest silently deleted with zero notification.

---

### G-MA-L57: getPendingOrdersCount redundant pagination fallback

**Status:** OPEN
**File:** `services/api/orders.ts:410-413`
**Source:** api-auditor

`(result as any).pagination?.total` fallback unnecessary — response always has `total`.

---

### G-MA-L58: Register path missing name fallback

**Status:** OPEN
**File:** `services/api/auth.ts:74`
**Source:** logic-auditor

Login has `ownerName || name || 'Team Member'`. Register has no fallback — `name` can be empty string.

---

### G-MA-L59: validatePaymentStatus wrong whitelist — dead code

**Status:** OPEN
**File:** `utils/paymentValidation.ts:79-86`
**Source:** logic-auditor

4-value whitelist, imported but never called. Misdirection risk for future developers.

---

### G-MA-L60: duplicate ROLE_DESCRIPTIONS

**Status:** OPEN
**File:** `constants/roles.ts:69-79`, `services/api/team.ts:99-106`
**Source:** logic-auditor

Same values defined in two places.

---

### G-MA-L61: Dashboard totalCustomersToday=0 triggers wrong fallback

**Status:** OPEN
**File:** `services/api/dashboard.ts:111`
**Source:** logic-auditor

`??` operator: when `totalCustomersToday` is legitimately 0, fallback triggers (0 is falsy).

---

### G-MA-L62: atob() deprecated — malformed JWT silently falls through

**Status:** OPEN
**File:** `contexts/AuthContext.tsx:347-354`
**Source:** security-auditor

Uses browser `atob()`. Malformed JWT caught → returns null → uses 1-hour default. Far-future `exp` tampering undetected.

---

## NEW FINDINGS — Additional Issues Found 2026-04-16

### G-MA-L63: PaymentStatus Defined in 3 Separate Files (MEDIUM)

**Status:** OPEN
**Files:**
- `types/api.ts:174` — 6 values: `pending | awaiting_payment | paid | failed | refunded | partially_refunded`
- `services/api/services.ts:92` — 5 values: `pending | paid | partial | refunded | failed`
- `utils/paymentValidation.ts:34` — 4 values: `pending | completed | failed | cancelled`

**Source:** type-auditor

Three different `PaymentStatus` definitions across the codebase. `partial` and `awaiting_payment` are exclusive to one definition each. `completed` exists only in validation. Callers import from whichever file their import path resolves to — behavior is undefined.

**Fix:** Canonical definition in `types/api.ts`. Remove the other two. All imports must resolve to one source.

---

### G-MA-L64: OrderStatus Defined 3x with Different Values (MEDIUM)

**Status:** OPEN
**Files:**
- `types/api.ts:160` — 9 values: `placed | confirmed | preparing | ready | dispatched | delivered | cancelled | refunded | disputed`
- `app/orders/live.tsx:34` — 9 values: same names but `dispatched` may differ
- `app/(dashboard)/aggregator-orders.tsx:35` — 7 values: `pending | accepted | preparing | ready | picked_up | delivered | cancelled`
- `__tests__/integration/orderFlow.test.ts:6` — 5 values: `pending | preparing | ready | done | cancelled`

**Source:** type-auditor

Same type name in 4 locations with 4 different value sets. `aggregator-orders.tsx` uses aggregator-specific statuses (`accepted`, `picked_up`) that don't exist in the canonical type. Test file uses `done` instead of `delivered`.

**Fix:** Single canonical `OrderStatus` in `types/api.ts`. Aggregator-specific statuses should be `AggregatorOrderStatus` to avoid collision.

---

### G-MA-L65: OnboardingService setInterval Never Cleared on Stop (MEDIUM)

**Status:** OPEN
**File:** `services/api/onboarding.ts:489-504`
**Source:** sync-auditor

`startAutoSave()` sets `setInterval` at 30-second intervals. `stopAutoSave()` calls `clearInterval` — but if the service is destroyed without calling `stopAutoSave()`, the interval runs forever. No `componentWillUnmount` equivalent or service lifecycle cleanup.

**Impact:** Memory leak on hot reload. Auto-save fires indefinitely if onboarding is abandoned mid-flow.

**Fix:** Register interval cleanup on service instantiation or add a service lifecycle `destroy()` method.

---

### G-MA-L66: SocketContext Empty Catch Blocks — 3 Instances (MEDIUM)

**Status:** OPEN
**File:** `contexts/SocketContext.tsx:74, 84, 134`
**Source:** security-auditor

Three `.catch(() => {})` silent drops on socket operations:
```typescript
// Line 74: reconnect on app resume
socketService.connect().catch(() => {});

// Line 84: reconnect on app resume  
socketService.connect().catch(() => {});

// Line 134 in socket.ts: join dashboard on every connect
this.joinMerchantDashboard().catch(() => {});
```

**Impact:** Connection failures are invisible. Merchant doesn't know they're disconnected. No retry indicator, no user notification.

**Fix:** Replace with logging and user-facing connection status:
```typescript
socketService.connect().catch((e) => {
  logger.error('Socket reconnect failed', e);
  // Notify user of connection issue
});
```

---

### G-MA-L67: PaymentStatusResponse Interface Has 4 Values vs PaymentStatus Has 6 (MEDIUM)

**Status:** OPEN
**File:** `services/api/pos.ts:85-88`
**Source:** payment-auditor

```typescript
// pos.ts:85-88
export interface PaymentStatusResponse {
  billId: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired'; // 4 values
  paidAt?: string;
}
```

`PaymentStatus` type in `types/api.ts` has 6 values. `PaymentStatusResponse` is a subset. Calling code that expects the full `PaymentStatus` type will crash on `expired` or `awaiting_payment`.

**Fix:** Align `PaymentStatusResponse.status` with `PaymentStatus` type, or use the existing type directly.

---

### G-MA-L68: Product Bulk Export/Import Uses Raw fetch() Bypassing apiClient (MEDIUM)

**Status:** OPEN
**Files:**
- `services/api/products.ts:375` — `fetch(buildApiUrl(...))` for export
- `services/api/products.ts:427` — `fetch(buildApiUrl(...))` for import
- `services/api/products.ts:653` — `fetch(buildApiUrl(...))` for import

**Source:** security-auditor

Three raw `fetch()` calls for bulk product operations. All bypass `apiClient` which provides auth token injection, retry logic, error handling, and request deduplication.

**Impact:** Bulk operations fail silently when auth expires. No automatic token refresh. No retry on network failure.

**Fix:** Wrap in apiClient or add auth/refresh logic to these methods.

---

### G-MA-L69: JSON.parse on API Response Without Try/Catch (LOW)

**Status:** OPEN
**File:** `app/reports/export.tsx:234`
**Source:** logic-auditor

```typescript
const parsed = JSON.parse(body);  // body is fetch response text
if (parsed?.message) msg = parsed.message;
```

`JSON.parse()` on a raw fetch response without try/catch. If the backend returns non-JSON (HTML error page, rate-limit HTML), this throws an unhandled exception.

**Fix:**
```typescript
let msg = 'Export failed';
try {
  const parsed = JSON.parse(body);
  if (parsed?.message) msg = parsed.message;
} catch {
  msg = `Export failed: ${body.slice(0, 100)}`;
}
```

---

### G-MA-L70: storeReview JSON.parse Empty Catch (LOW)

**Status:** OPEN
**File:** `utils/storeReview.ts:17-19`
**Source:** logic-auditor

```typescript
const raw = await AsyncStorage.getItem(REVIEW_KEY);
if (raw) return JSON.parse(raw);
} catch {}
```

Empty catch block silently swallows parse errors. If stored JSON is corrupted, the app shows no review state rather than resetting gracefully.

**Fix:** Log error and return default state:
```typescript
} catch (e) {
  logger.warn('storeReview parse error', e);
  return null;
}
```

---

### G-MA-L71: Math.random() in Variant Helper (Non-Test Data Path) (LOW)

**Status:** OPEN
**File:** `utils/variantHelpers.ts:48-50`
**Source:** logic-auditor

```typescript
if (includeRandomString) {
  const randomString = Math.random()
    .toString(36)
    .substring(2, 2 + randomStringLength)
```

Math.random() used in production code path for generating variant random strings. While the output isn't used for IDs, the values are predictable and reproducible — bad for uniqueness guarantees.

**Fix:** Use `crypto.getRandomValues()` or `uuid`.

---

### G-MA-L72: WhatsApp Deep Link URL Without URL Validation (LOW)

**Status:** OPEN
**File:** `services/api/purchaseOrders.ts:108-116`
**Source:** security-auditor

```typescript
const url = `whatsapp://send?phone=${phone.replace(/\D/g, '')}&text=${encodeURIComponent(message)}`;
await Linking.openURL(url);
```

Phone number is sanitized with `replace(/\D/g, '')` but no validation that it's a valid Indian number. Malformed phone could redirect to wrong WhatsApp contact. No URL scheme validation beyond `Linking.canOpenURL()`.

**Fix:** Add Indian phone validation before URL construction.

---

### G-MA-L73: debugAuth Decodes JWT Without Verification (LOW)

**Status:** OPEN
**File:** `utils/debugAuth.ts:7-16`
**Source:** security-auditor

JWT decoder uses basic `split('.')` + `atob()` without verifying signature. Comment explicitly states "no verification". Could be used in development to make decisions based on unsigned tokens.

**Fix:** Ensure `debugAuth` is only used for display/logging, never for auth decisions. Guard with `__DEV__`.

---

### G-MA-L74: Chart Mock Data Uses Math.random() in Non-Test File (LOW)

**Status:** OPEN
**File:** `utils/chartHelpers.ts:481`
**Source:** logic-auditor

```typescript
y: Math.random() * (max - min) + min,
```

In production `chartHelpers.ts` — a non-test utility. Used for generating mock/placeholder chart data when real data is unavailable. Predictable output in mock scenarios is acceptable but should be gated behind a mock mode flag.

---

### G-MA-L75: RBAC Example Has Duplicate Order/Payment Interfaces (LOW)

**Status:** OPEN
**Files:**
- `RBAC_INTEGRATION_EXAMPLES.tsx:114` — local `Order` interface
- `RBAC_INTEGRATION_EXAMPLES.tsx:476` — `ProductEditForm` uses `any`
- `RBAC_INTEGRATION_EXAMPLES.tsx:553` — `Ionicons name` cast to `any`
- `RBAC_INTEGRATION_EXAMPLES.tsx:570` — `FormField` prop typed as `value: any`

**Source:** type-auditor

Example file has its own local `Order` interface and heavy `any` usage. While this is example code, it trains developers on anti-patterns.

**Fix:** Use canonical types from `types/api.ts` in examples.

---

### G-MA-L76: Analytics Peak Hours Mock Data Uses Math.random() (LOW)

**Status:** OPEN
**File:** `app/analytics/peak-hours.tsx:62-63`
**Source:** logic-auditor

```typescript
? Math.floor(Math.random() * 40) + 30
: Math.floor(Math.random() * 12);
```

Uses Math.random() for simulated data in analytics visualization. Should be gated behind a mock/demo mode flag, not always executed.

---

### G-MA-L77: Integration Test OrderStatus Values Don't Match Canonical (LOW)

**Status:** OPEN
**File:** `__tests__/integration/orderFlow.test.ts:5-6`
**Source:** type-auditor

```typescript
const ALLOWED_STATUSES = ['pending', 'preparing', 'ready', 'done', 'cancelled'] as const;
type OrderStatus = (typeof ALLOWED_STATUSES)[number];
```

Test uses `done` while canonical type uses `delivered`. Tests pass against wrong values, creating a false sense of correctness.

**Fix:** Import canonical `OrderStatus` from `types/api.ts` in tests.

---

### G-MA-L78: useTeam Error Typing Uses `error: any` (LOW)

**Status:** OPEN
**Files:** `hooks/useTeam.ts:139, 164, 188`
**Source:** type-auditor

```typescript
} catch (error: any) {
  return {
    success: false,
    error: error?.message || 'Unknown error',
  };
```

Catch block explicitly types error as `any`, weakening TypeScript's error type safety. Should be `unknown` with narrowing.

**Fix:**
```typescript
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return { success: false, error: message };
}
```

---

### G-MA-L79: Auth Context Token Expiry Extraction Bypasses Validation (LOW)

**Status:** OPEN
**File:** `contexts/AuthContext.tsx:348-350`
**Source:** security-auditor

```typescript
const payload = JSON.parse(atob(token.split('.')[1]));
return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
```

If JWT payload is not base64-encoded JSON (e.g., attacker tampers with payload), `atob()` and `JSON.parse()` can throw. Catch block returns `null`, silently treating malformed tokens as expired — which happens to be safe but relies on failure. However, the `exp` field is not cryptographically verified.

**Fix:** Verify token with `jwtDecode` from `jwt-decode` package which handles malformed tokens safely.

---

### G-MA-L80: Linearlytic Analytics Deep Link URL Template Without Validation (LOW)

**Status:** OPEN
**File:** `services/api/integrations.ts:125`
**Source:** security-auditor

```typescript
Linking.openURL(urls[platform]).catch(() => {
  if (__DEV__) console.error(`Failed to open ${platform} partner portal`);
});
```

URLs built from config object (`urls[platform]`). No validation that platform is a known key. If `platform` is user-supplied, attacker could inject arbitrary URLs.

**Fix:** Validate platform against a whitelist before looking up URL:
```typescript
const ALLOWED_PLATFORMS = ['zomato', 'swiggy', 'dunzo'] as const;
if (!ALLOWED_PLATFORMS.includes(platform)) return;
```

---

### G-MA-L81: App.tsx Uses `require.context` with `as any` (LOW)

**Status:** OPEN
**File:** `App.tsx:5`
**Source:** type-auditor

```typescript
const ctx = (require as any).context("./app");
```

TypeScript doesn't know about Webpack's `require.context`. The `as any` cast is intentional but defeats TypeScript's type checking on the entire app routing.

**Fix:** Add a type declaration:
```typescript
declare function requireContext(key: string): { keys(): string[]; id: string };
```

---

## NEW FINDINGS — Additional Issues Found 2026-04-16 (Round 2)

### G-MA-L116: Print retry queue unbounded — memory leak on repeated failures

**Status:** OPEN
**File:** `services/printer.ts:253`
**Source:** logic-auditor

```typescript
queuePrintRetry(data: ReceiptData): void {
  this.printRetryQueue.push({
    data,
    attempts: 0,
    lastAttempt: new Date(0),
  });
```

`printRetryQueue.push()` has no max length check. Unlike `OrderQueue` (bounded to 100) and `OfflineQueue` (bounded to 500), the print retry queue grows indefinitely if printing keeps failing. On a device with persistent print failures, this causes unbounded memory growth.

**Fix:** Add max length:
```typescript
if (this.printRetryQueue.length >= this.MAX_RETRY_QUEUE_SIZE) {
  this.printRetryQueue.shift(); // evict oldest
}
this.printRetryQueue.push({...});
```

---

### G-MA-L126: Offline queue push swallows all errors silently

**Status:** OPEN
**File:** `services/offline.ts:154-156`
**Source:** logic-auditor

```typescript
} catch {
  // best-effort queue
}
```

`pushOfflineAction` has an empty catch block. If `getOfflineActions()`, `AsyncStorage.setItem()`, or any other step fails, the action is silently lost. The user sees no error, no retry, and the operation appears to succeed when it was actually dropped.

**Fix:** Log or surface the error:
```typescript
} catch (error) {
  console.error('[OfflineService] Failed to enqueue offline action:', error);
  // Consider pushing to dead letter instead of dropping
}
```

---

### G-MA-L127: getOfflineActions masks parse errors — silently returns empty

**Status:** OPEN
**File:** `services/offline.ts:161-163`
**Source:** logic-auditor

```typescript
} catch {
  return [];
}
```

Corrupted JSON in AsyncStorage (from a crash mid-write, or encoding error) returns `[]` instead of propagating the error. The caller has no way to distinguish "no actions" from "data is corrupted."

**Fix:** Return a result type or throw:
```typescript
} catch (error) {
  console.error('[OfflineService] Failed to parse offline actions:', error);
  return [];
  // Or: throw new Error('Offline action data corrupted', { cause: error });
}
```

---

### G-MA-L128: syncOfflineActions outer catch swallows all errors

**Status:** OPEN
**File:** `services/offline.ts:229-231`
**Source:** logic-auditor

```typescript
} catch {
  // best-effort sync
} finally {
  this.syncInProgress = false;
}
```

If the outer try block throws (e.g., `getOfflineActions()` fails), the entire sync operation silently fails. `successful` and `failed` counts are lost, dead letters are not pushed, and the remaining actions are not persisted.

**Fix:** Log the sync failure:
```typescript
} catch (error) {
  console.error('[OfflineService] Sync failed:', error);
} finally {
  this.syncInProgress = false;
}
```

---

### G-MA-L129: Two empty catch blocks in storeReview.ts

**Status:** OPEN
**File:** `utils/storeReview.ts:17-19, 25-26`
**Source:** logic-auditor

```typescript
const raw = await AsyncStorage.getItem(REVIEW_KEY);
if (raw) return JSON.parse(raw);
} catch {}
// ...
await AsyncStorage.setItem(REVIEW_KEY, JSON.stringify(state));
} catch {}
```

Silent failures on both read and write. Review state can silently fail to load (returning undefined flow) or fail to persist (user changes are lost). These were already noted in G-MA-L70 but the second instance at line 26 was not covered.

**Fix:** Add error handling to both catches.

---

### G-MA-L130: orders.ts unsafe any cast for pagination total

**Status:** OPEN
**File:** `services/api/orders.ts:412`
**Source:** type-auditor

```typescript
return result.total || (result as any).pagination?.total || 0;
```

`(result as any)` bypasses type checking. If `result` has an unexpected shape, this returns `0` instead of surfacing a type mismatch. The caller uses this for `totalPages` calculation (`totalPages = total / limit`), so a type mismatch silently shows 0 pages.

**Fix:** Use a typed response interface:
```typescript
interface OrderListResponse {
  total?: number;
  pagination?: { total?: number };
}
return (result as OrderListResponse).total ?? (result as OrderListResponse).pagination?.total ?? 0;
```

---

### G-MA-L131: settlements.ts NaN risk on zero-page division

**Status:** OPEN
**File:** `services/api/settlements.ts:99`
**Source:** logic-auditor

```typescript
totalPages: rawPagination?.totalPages ?? (typedData as { totalPages?: number }).totalPages ?? 0,
```

Returns `0` when `totalPages` is missing. The caller (`totalPages = Math.ceil(total / limit)`) would get `NaN` if `limit` is `0`. The `limit` fallback is `20` so this path is protected, but the explicit `?? 0` masks missing data.

**Fix:** Return `1` as the minimum, or use a named constant:
```typescript
totalPages: rawPagination?.totalPages ?? (typedData as { totalPages?: number }).totalPages ?? 1,
```

---

### G-MA-L132: customerInsights division by potentially zero avgOrdersPerCustomer

**Status:** OPEN
**File:** `services/api/customerInsights.ts:84`
**Source:** logic-auditor

```typescript
: (d.summary?.avgSpendPerCustomer ?? 0) /
  (d.summary?.avgOrdersPerCustomer ?? 0),
```

`avgOrdersPerCustomer` can be `0` (new store, no orders). Dividing by `0` produces `Infinity`. The result is assigned directly to `averageLTV` with no guard. `Infinity` serialized to JSON and sent to the UI renders as the string `"Infinity"`.

**Fix:** Guard against zero divisor:
```typescript
const avgOrders = d.summary?.avgOrdersPerCustomer ?? 0;
averageLTV: avgOrders > 0
  ? (d.summary?.avgSpendPerCustomer ?? 0) / avgOrders
  : 0,
```

---

### G-MA-L133: Math.random() for local promotion IDs in promotions page

**Status:** OPEN
**File:** `app/stores/[id]/promotions.tsx:42`
**Source:** logic-auditor

```typescript
return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
```

Generates local promotion IDs with `Math.random()`. Same pattern as G-MA-L71, G-MA-L74, G-MA-L76 — `Math.random()` is not cryptographically secure. If local promotions are confused with server-persisted promotions, collisions are possible.

**Fix:** Use `uuid` or `crypto.randomUUID()`.

---

### G-MA-L134: Math.random() for list item keys in recent orders

**Status:** OPEN
**File:** `app/pos/recent-orders.tsx:113`
**Source:** logic-auditor

```typescript
keyExtractor={(item) => item.billId || item._id || Math.random().toString()}
```

`Math.random()` used as fallback key. This causes all rendered items to get new keys on every render, breaking React's reconciliation — items are always treated as new, causing re-mounts instead of re-renders. Visible performance degradation and lost animation state.

**Fix:** Use stable ID:
```typescript
keyExtractor={(item, index) => item.billId || item._id || `recent-order-${index}`}
```

---

### G-MA-L135: Math.random() for campaign list keys

**Status:** OPEN
**File:** `app/campaigns/performance.tsx:75`
**Source:** logic-auditor

```typescript
return c._id || c.id || String(Math.random());
```

Same issue as G-MA-L134 — `Math.random()` as fallback key causes unnecessary re-mounts on every render cycle.

**Fix:** Use stable index fallback.

---

### G-MA-L117: sessionTimeout callback invoked without null check

**Status:** NOT A BUG
**File:** `services/sessionTimeout.ts:83`
**Source:** logic-auditor

```typescript
if (this.onTimeoutCallback) await this.onTimeoutCallback();
```

The `onTimeoutCallback` property is typed as `(() => Promise<void>) | undefined` and is checked before invocation — this is correct. **Not a bug.** The pattern is properly guarded.

**Note:** Confirmed safe. No fix needed.

---

### G-MA-L118: Offline queue overflow silently drops actions after warning

**Status:** OPEN
**File:** `services/offline.ts:141-150`
**Source:** logic-auditor

```typescript
if (existingActions.length > this.MAX_QUEUE_LENGTH) {
  const overflowCount = existingActions.length - this.MAX_QUEUE_LENGTH;
  const dropped = existingActions.splice(0, overflowCount);
  await this.pushToDeadLetter(
    dropped.map((item) => ({
      ...item,
      failedAt: Date.now(),
      lastError: 'Queue capacity exceeded before sync',
    }))
  );
}
await AsyncStorage.setItem(this.OFFLINE_ACTIONS_KEY, JSON.stringify(existingActions));
```

The overflow logic is correct (actions are moved to dead letter), but: (1) `pushToDeadLetter` is awaited inside the same try block — if it fails, the overflowed actions are lost. (2) The `splice` modifies `existingActions` before `pushToDeadLetter` completes.

**Fix:** Wrap overflow in its own try/catch and don't modify array until dead letter push succeeds:
```typescript
if (overflowCount > 0) {
  const toDrop = existingActions.splice(0, overflowCount);
  try {
    await this.pushToDeadLetter(toDrop.map(item => ({ ...item, ...deadLetterMeta })));
  } catch (e) {
    console.error('[OfflineService] Failed to push overflow to dead letter:', e);
  }
}
```

---

### G-MA-L119: syncOfflineActions non-atomic dual-write

**Status:** OPEN
**File:** `services/offline.ts:227-228`
**Source:** logic-auditor

```typescript
await AsyncStorage.setItem(this.OFFLINE_ACTIONS_KEY, JSON.stringify(remainingActions));
await this.pushToDeadLetter(deadLetters);
```

Two separate `AsyncStorage.setItem` calls in sequence. If the first succeeds but the second fails (disk full, crash), dead letter records are lost. `remainingActions` are persisted but the failure counts (`successful`, `failed`) are not returned.

**Fix:** Use a single atomic write:
```typescript
await AsyncStorage.setItem(this.OFFLINE_ACTIONS_KEY, JSON.stringify({
  remaining: remainingActions,
  deadLetters,
  syncedAt: Date.now(),
}));
```

---

### G-MA-L139: Multiple Date.now() calls in pushOfflineAction allows timestamp drift

**Status:** OPEN
**File:** `services/offline.ts:128-136`
**Source:** logic-auditor

```typescript
const now = Date.now();
this.actionSequence += 1;
const offlineAction: OfflineAction = {
  ...action,
  id: `offline_${now}_${this.actionSequence}`,
  idempotencyKey: `offline-${now}-${this.actionSequence}`,
  timestamp: now,
```

Here `now` is called once and reused — **this is correct.** The issue is that in `syncOfflineActions`, `Date.now()` is called for each dead letter entry at line 218, potentially with different timestamps across items processed in the same batch.

**Note:** Not a significant issue but noted for consistency.

---

### G-MA-L140: pending-approval.tsx email field accepts arbitrary URL to Linking.openURL

**Status:** OPEN
**File:** `app/onboarding/pending-approval.tsx:170, 173, 176`
**Source:** security-auditor

```typescript
Linking.openURL('mailto:support@rez.in?subject=Onboarding%20Rejection%20Query').catch(() => {});
Linking.openURL(`mailto:${option.value}`);
Linking.openURL(`tel:${option.value}`);
Linking.openURL(option.value);
```

Three calls at lines 173, 176 use `option.value` directly from config. If `option.value` is an arbitrary string (not validated), `Linking.openURL(option.value)` could open any URL. The `mailto:` and `tel:` schemes are relatively safe, but the third call at line 176 passes `option.value` without any scheme validation.

**Fix:** Validate URL before opening:
```typescript
const isAllowed = url.startsWith('https://') || url.startsWith('http://');
if (!isAllowed) return;
Linking.openURL(option.value);
```

---

### G-MA-L141: onboarding.ts file upload has no MIME type validation

**Status:** OPEN
**File:** `services/api/onboarding.ts:240-245`
**Source:** security-auditor

```typescript
formData.append('document', fileToUpload as any);
// No MIME type check on fileToUpload
```

File uploads for KYC documents (`fileToUpload`) have no MIME type validation. A user could upload executables, scripts, or other dangerous file types. The backend likely validates this, but defense-in-depth requires client-side validation too.

**Fix:** Validate MIME type:
```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
if (!ALLOWED_TYPES.includes(fileToUpload.type)) {
  throw new Error('Invalid file type. Allowed: JPEG, PNG, WebP, PDF');
}
```

---

### G-MA-L142: OfflineService actionSequence is in-memory — resets on app restart

**Status:** OPEN
**File:** `services/offline.ts:29`
**Source:** logic-auditor

```typescript
private actionSequence: number = 0;
```

`actionSequence` is a simple counter initialized to `0` on service instantiation. After app restart, it resets. Combined with `Date.now()` for IDs, this means `idempotencyKey = offline-${Date.now()}-${this.actionSequence}` could collide with IDs from the previous session if the timestamp has the same millisecond (unlikely but possible on fast devices or emulators).

**Fix:** Use a UUID generator for idempotency keys instead of timestamp + sequence.

---

### G-MA-L143: customerInsights.ts unsafe type cast on avgOrdersPerCustomer division

**Status:** OPEN
**File:** `services/api/customerInsights.ts:81-85`
**Source:** logic-auditor

```typescript
const repeatVisitRate: number = d.retention?.repeatCustomerRate ?? 0;
// ...
averageLTV: d.ltv?.averageLTV ??
  (d.summary?.avgSpendPerCustomer ?? 0) /
  (d.summary?.avgOrdersPerCustomer ?? 0),
```

`avgOrdersPerCustomer` could be `0`. The chain `?? 0` means a store with `avgOrdersPerCustomer = 0` produces `Infinity` for `averageLTV`. This is sent directly to the UI.

**Fix:** Add zero-guard (see G-MA-L132).

---

### G-MA-L144: AsyncStorage stores sensitive notification data in cleartext

**Status:** OPEN
**File:** `hooks/useNotificationBadge.ts:87, 97-99`
**Source:** security-auditor

```typescript
await AsyncStorage.setItem(storageKey, JSON.stringify(data));
// ...
const data = JSON.parse(stored);
```

Notification badge counts are stored in `AsyncStorage` — accessible to any app on rooted/jailbroken devices. While counts alone are low-sensitivity, the `storageKey` pattern means an attacker could enumerate all stored notification data.

**Fix:** Store only non-sensitive data in AsyncStorage. Move any identifiable data to SecureStore.

---

### G-MA-L145: Non-null assertion on cartId causes runtime crash

**Status:** OPEN
**File:** `app/pos/index.tsx:520`
**Source:** logic-auditor

```typescript
const existing = cart.find(item => item.cartId! === cartId);
```

`item.cartId!` uses a non-null assertion. If `cartId` is `undefined` (e.g., newly added item without assigned ID), the assertion fails at runtime. The `find` call throws a TypeScript error if `cartId` is `null` or `undefined` at the strict level.

**Fix:** Remove non-null assertion, add guard:
```typescript
if (!cartId) return false;
const existing = cart.find(item => item.cartId === cartId);
```

---

### G-MA-L146: cacheData failure silently swallowed

**Status:** OPEN
**File:** `services/offline.ts:78-83`
**Source:** logic-auditor

```typescript
try {
  await AsyncStorage.setItem(key, JSON.stringify(data));
} catch {
  // best-effort
}
```

`cacheData()` wraps its write in an empty catch. If storage is full, corrupted, or quota-exceeded, the cache miss is silent. The caller has no indication that caching failed. On subsequent reads, `getCachedData()` may return stale or missing data with no signal.

**Fix:** Log the error:
```typescript
} catch (error) {
  console.warn('[OfflineService] cacheData failed:', error);
}
```

---

### G-MA-L147: socketService accessed via `as any` — type safety bypass

**Status:** OPEN
**File:** `contexts/SocketContext.tsx:112`
**Source:** type-auditor

```typescript
const ss = socketService as any;
const socket = ss.getSocket?.();
```

`socketService` is cast to `any` to access `getSocket()`. This bypasses all TypeScript type checking on the entire `ss` object. Any typo in property names (e.g., `ss.getSockt()`) silently creates `undefined` without compile-time error.

**Fix:** Define the required method on `SocketService` or use a typed interface:
```typescript
interface SocketServicePublic {
  getSocket(): Socket | null;
  isConnected(): boolean;
}
const ss = socketService as SocketServicePublic;
```

---

### G-MA-L148: Biometric check caches result across app lifetime — stale on device unlock

**Status:** OPEN
**File:** `utils/biometric.ts:22`
**Source:** security-auditor

```typescript
let cachedAvailable: boolean | null = null;
export async function isBiometricAvailable(): Promise<boolean> {
  if (cachedAvailable !== null) return cachedAvailable;
  cachedAvailable = await LocalAuthentication.hasHardwareAsync();
  return cachedAvailable;
}
```

`isBiometricAvailable()` caches the result forever. On devices where biometric enrollment can change (user adds/removes fingerprint/face after app launch), the cached result becomes stale. A device that had no biometrics at launch (returns false, cached) but later enrolls biometrics would still return false until app restart.

**Fix:** Add a TTL or explicit refresh mechanism:
```typescript
export async function isBiometricAvailable(refresh = false): Promise<boolean> {
  if (!refresh && cachedAvailable !== null) return cachedAvailable;
  cachedAvailable = await LocalAuthentication.hasHardwareAsync();
  return cachedAvailable;
}
```

---

### G-MA-L149: console.error in production error handlers

**Status:** OPEN
**Files:**
- `services/offline.ts:1054` — `console.error('[OfflineService] Failed to enqueue offline action:', error);`
- `services/offline.ts:1078` — `console.error('[OfflineService] Failed to parse offline actions:', error);`
- `services/offline.ts:1105` — `console.error('[OfflineService] Sync failed:', error);`
- `services/offline.ts:1296` — `console.error('[OfflineService] Failed to push overflow to dead letter:', e);`
- `services/offlinePOSQueue.ts:83` — `console.error('[OfflinePOSQueue] Failed to enqueue bill:', e);`

**Source:** logic-auditor

Raw `console.error` used in multiple production error handlers. These bypass the centralized `rez-shared/telemetry` logger that provides structured logging, log level control, and shipping to observability backends.

**Fix:** Replace with:
```typescript
import { logger } from 'rez-shared/telemetry';
logger.error('[OfflineService] Failed to enqueue offline action', { error });
```

---

### G-MA-L112: config/api.ts throws on startup if env vars missing — no graceful fallback

**Status:** OPEN
**File:** `config/api.ts:36, 70`
**Source:** logic-auditor

```typescript
throw new Error(`[MERCHANT API] FATAL: Production API URL must use HTTPS. Got: ${url}`);
throw new Error(`[MERCHANT API] FATAL: Production Socket URL must use HTTPS. Got: ${url}`);
```

App crashes on startup if `API_BASE_URL` or `SOCKET_URL` env vars are missing or don't use HTTPS. In development or staging, this prevents testing with local backends.

**Fix:** Allow HTTP in non-production:
```typescript
if (process.env.NODE_ENV === 'production' && !url.startsWith('https://')) {
  throw new Error(...);
}
```

---

### G-MA-L113: attendance/index.tsx captures stale date in empty useEffect dependency array

**Status:** OPEN
**File:** `app/team/attendance/index.tsx:13-15`
**Source:** logic-auditor (Round 5)

```typescript
const today = new Date().toISOString().split('T')[0]; // Line 13 — captured at component mount

useEffect(() => { loadAttendance(); }, []); // Line 15 — empty deps
```

`today` is captured at component mount (React's initial render time). The `useEffect` has empty dependencies, so it only runs once. If the component remounts on a different day (e.g., app backgrounded overnight, device wakes), `today` is stale — attendance is loaded for the wrong date.

**Fix:** Move `today` inside the effect:
```typescript
useEffect(() => {
  const today = new Date().toISOString().split('T')[0];
  loadAttendance(today);
}, []);
```

---

### G-MA-L114: 250+ TouchableOpacity components lack accessibility props — a11y gaps

**Status:** OPEN
**Files:** All 250 files containing TouchableOpacity across the codebase
**Source:** ux-auditor (Round 5)

3071 TouchableOpacity usages across 250 files. Of these, only ~40 files have any `accessibilityRole` or `accessibilityLabel` props. The majority have neither:
- No `accessibilityRole` — screen readers can't announce what the element does
- No `accessibilityLabel` — screen readers have no text description
- No `accessibilityHint` — users don't know what happens on activation

**Impact:** App is inaccessible to visually impaired users on iOS VoiceOver and Android TalkBack.

**Fix:** Audit all interactive TouchableOpacity components. Add at minimum:
```tsx
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel="Accept order"
  onPress={handleAccept}
>
```
Priority files to fix first: orders, products, and checkout screens.

---

### G-MA-L115: client.ts localhost fallback in production code path comment

**Status:** OPEN
**File:** `services/api/client.ts:19-24`
**Source:** logic-auditor (Round 5)

```typescript
// In production EXPO_PUBLIC_MERCHANT_SERVICE_URL MUST be set. In dev, localhost is used.
//   2. localhost:4005 in dev (no nginx)
process.env.EXPO_PUBLIC_MERCHANT_SERVICE_URL || (__DEV__ ? 'http://localhost:3007/api' : null);
```

While the `__DEV__` guard prevents localhost from being used in production builds, the comment structure is misleading — line 24 reads as if `localhost:4005` is the second fallback option, but the code uses `localhost:3007`. Comment and code are out of sync. A developer reading this might misdiagnose issues.

**Fix:** Sync the comment with the actual fallback:
```typescript
// In production EXPO_PUBLIC_MERCHANT_SERVICE_URL MUST be set. In dev, localhost:3007 is used.
```
