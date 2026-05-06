# REZ Now — API Contract

> **Status: ACCURATE** | Generated: 2026-04-14 | Domain: `now.rez.money`
> Base URL: `https://api.rezapp.com` | Frontend base: `https://now.rez.money`
> Backend: `rezbackend/rez-backend-master/src/routes/`

---

## Table of Contents

1. [Base URL & Clients](#1-base-url--clients)
2. [Standard Response Envelope](#2-standard-response-envelope)
3. [Error Codes](#3-error-codes)
4. [Auth Patterns & Token Management](#4-auth-patterns--token-management)
5. [Rate Limits](#5-rate-limits)
6. [Frontend API Clients (`lib/api/`)](#6-frontend-api-clients-libapi)
7. [Backend Routes](#7-backend-routes)
8. [Internal & Admin Endpoints](#8-internal--admin-endpoints)
9. [Cross-Service Calls](#9-cross-service-calls)
10. [WebSocket / Socket.IO Events](#10-websocket-socketio-events)

---

## 1. Base URL & Clients

### Environment

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://api.rezapp.com` | Backend base URL (frontend) |
| `NEXT_PUBLIC_SOCKET_URL` | `https://api.rezapp.com` | Socket.IO server (frontend) |

### Axios Clients (`lib/api/client.ts`)

```typescript
// Base URL resolved at runtime
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.rezapp.com';
```

**`publicClient`** — No auth, 15s timeout. Used for all public endpoints.

**`authClient`** — Bearer JWT, 15s timeout, automatic 401 refresh interceptor.
- Reads `rez_access_token` and `rez_refresh_token` from `localStorage`
- On 401: queues in-flight requests, calls `POST /auth/token/refresh`, replays queued requests
- On refresh failure: clears tokens, dispatches `rez:session-expired` CustomEvent

**In-flight GET deduplication**: `deduplicatedGet()` ensures multiple simultaneous identical GET requests share a single network promise.

### Backend Route Mount Points (`routes.ts`)

```
API_PREFIX = process.env.API_PREFIX || '/api'  // e.g. /api

/api/user/auth              → authRoutes.ts
/api/web-ordering           → webOrderingRoutes.ts
/api/store-payment          → storePaymentRoutes.ts
/api/wallet                 → walletRoutes.ts
/api/payment                → paymentRoutes.ts
/api/razorpay               → razorpayRoutes.ts
```

---

## 2. Standard Response Envelope

All API responses follow a consistent envelope.

### Success

```typescript
interface ApiSuccessResponse<T> {
  success: true;
  data?: T;
  message?: string;
}
```

### Error

```typescript
interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;       // machine-readable error code
  error?: string;     // alternate error description
}
```

### HTTP Status Codes

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `201` | Created |
| `400` | Bad request / validation failure |
| `401` | Unauthenticated (missing or invalid token) |
| `403` | Forbidden (valid token but no permission) |
| `404` | Not found |
| `409` | Conflict (e.g. order already cancelled) |
| `429` | Rate limited |
| `500` | Internal server error |

---

## 3. Error Codes

### Auth / Session

| Code | HTTP | Meaning |
|------|------|---------|
| `AUTH_REQUIRED` | 401 | No valid token or session |
| `SESSION_EXPIRED` | 401 | Refresh token invalid or expired |
| `FORBIDDEN` | 403 | Token valid but caller lacks permission |
| `CSRF_MISSING_HEADER` | 403 | Mutation request missing `X-Requested-With: XMLHttpRequest` (non-Bearer callers) |

### Store / Menu

| Code | HTTP | Meaning |
|------|------|---------|
| `STORE_NOT_FOUND` | 404 | Store slug does not exist or inactive |
| `MENU_NOT_FOUND` | 404 | Store has no active menu |
| `INVALID_STORE_SLUG` | 400 | Slug format invalid (`/^[a-z0-9-]{2,60}$/`) |
| `STORE_CLOSED` | 409 | Store is currently closed |
| `RESERVATIONS_DISABLED` | 403 | Store does not accept reservations |

### Order / Payment

| Code | HTTP | Meaning |
|------|------|---------|
| `ORDER_NOT_FOUND` | 404 | Order number invalid or does not exist |
| `INVALID_ORDER_NUMBER` | 400 | Order number format invalid |
| `INVALID_RECEIPT_TOKEN` | 403 | Receipt token does not match |
| `CANCEL_TOO_LATE` | 409 | Order already being prepared — cannot cancel |
| `ALREADY_RATED` | 409 | Order already has a rating |
| `DISPUTE_ALREADY_EXISTS` | 409 | Dispute already filed for this order |
| `PAYMENT_VERIFICATION_FAILED` | 400 | Razorpay signature mismatch |
| `UNSUPPORTED_PURPOSE` | 400 | `purpose` field is not `'order'` |

### Validation

| Code | HTTP | Meaning |
|------|------|---------|
| `MISSING_FIELDS` | 400 | Required fields absent from request body |
| `INVALID_PHONE` | 400 | Phone number format invalid (must be 10 digits) |
| `INVALID_PHONE_FORMAT` | 400 | Phone number does not match `/^[6-9]\d{9}$/` |
| `QUERY_TOO_SHORT` | 400 | Search query less than 2 characters |
| `VALIDATION_ERROR` | 400 | General validation failure |
| `INVALID_COORDS` | 400 | Latitude/longitude must be numbers |
| `INVALID_REQUEST_ID` | 400 | Waiter requestId format invalid (`/^WAITER-[A-Z0-9]+$/`) |
| `CAPACITY_EXCEEDED` | 409 | Not enough table capacity for reservation |

### Rate Limiting

| Code | HTTP | Meaning |
|------|------|---------|
| `RATE_LIMIT` | 429 | Too many requests; retry after delay |

---

## 4. Auth Patterns & Token Management

### Frontend Flow (OTP-based)

```
Customer enters phone → POST /api/user/auth/send-otp (public)
                    → SMS receives 6-digit OTP
                    → POST /api/user/auth/verify-otp (public)
                    → { accessToken, refreshToken, user } stored in localStorage
                    → All subsequent authenticated calls use authClient (Bearer token)
```

### Backend Auth Resolution (Web Ordering)

The web ordering routes support **three** identity resolution strategies (tried in order):

1. **JWT Bearer token** — `Authorization: Bearer <jwt>` on request
2. **Legacy session token** — `X-Session-Token` header or `sessionToken` in body/query
3. **OTP session** — stored in Redis with 10-minute TTL

```typescript
// From webOrderingRoutes.ts: resolveCustomerPhone(req, sessionToken?)
async function resolveCustomerPhone(req, sessionTokenFromBody?) {
  // 1. Try JWT Bearer token
  // 2. Try X-Session-Token header or sessionToken body/query param
  // 3. Try OTP session token
}
```

### PIN-based Auth (returning customers)

```
POST /api/user/auth/verify-pin (public)
Body: { phoneNumber, pin }
Response: { accessToken, refreshToken, user }
```

Note: The frontend `verifyPin()` in `lib/api/auth.ts` calls `/api/user/auth/login-pin` — verify this route exists on the backend if PIN login is required.

### Token Refresh

```
POST /api/auth/token/refresh (public)
Body: { refreshToken: string }
Response: { success, accessToken, refreshToken }
```

authClient interceptor handles 401 automatically. Failed refresh clears tokens and fires `rez:session-expired`.

### Auth Summary Table

| Endpoint | Auth Required | Token Type | Notes |
|----------|--------------|------------|-------|
| `POST /api/user/auth/send-otp` | No | — | Rate-limited: 5/min per IP |
| `POST /api/user/auth/verify-otp` | No | — | Rate-limited: 5/min per IP |
| `POST /api/user/auth/verify-pin` | No | — | Rate-limited: 5/min per IP |
| `POST /api/auth/token/refresh` | No | — | Uses publicClient |
| `GET /api/web-ordering/*` (most) | No | Optional | Auth improves personalization |
| `POST /api/web-ordering/*` | Varies | Optional | CSRF check: Bearer OR `X-Requested-With` |
| `GET /api/web-ordering/profile` | **Yes** | Bearer JWT | Customer profile |
| `POST /api/web-ordering/coins/credit` | **Yes** | Bearer JWT | Coin crediting |
| `GET /api/wallet/balance` | **Yes** | Bearer JWT | Wallet balance |
| `GET /api/web-ordering/loyalty/stamps` | **Yes** | Bearer JWT | Loyalty stamps |
| `POST /api/web-ordering/store/:slug/emit-payment` | **Yes** | Internal token | `requireInternalToken` middleware |
| `GET /api/web-ordering/admin/orders` | **Yes** | Bearer JWT + Admin | Merchant admin only |

### CSRF Protection

All mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`) from **non-Bearer** callers must include:

```
X-Requested-With: XMLHttpRequest
```

Native mobile clients and browser requests using `Authorization: Bearer <token>` are exempt.

---

## 5. Rate Limits

### Backend Rate Limiters (webOrderingRoutes.ts)

| Limiter | Window | Max | Applied To |
|---------|--------|-----|-----------|
| `menuLimiter` | 60s | 120 req | GET menu, store info, availability, recommendations, reviews, coupons, loyalty/status |
| `orderLimiter` | 60s | 10 req | Order creation, tip, donation, receipt, bill split, coin credit, order history |
| `otpLimiter` | 60s | 5 req | Web ordering OTP send |
| `searchLimiter` | 60s | 30 req | `GET /api/web-ordering/search` |
| `analyticsLimiter` | 60s | 30 req | Merchant analytics |
| `writeLimiter` | 60s | 10 req | Rating, dispute, waiter call, bill request, coupon validate, cancellation |
| `reservationLimiter` | 60s | 10 req | Reservation creation |
| `groupLimiter` | 60s | 20 req | Group order operations |
| `broadcastSendLimiter` | 60s | 5 req | Web push broadcast sends |

### Auth Rate Limiters (authRoutes.ts)

| Limiter | Window | Max | Applied To |
|---------|--------|-----|-----------|
| `otpLimiter` | 60s | 5 req | `POST /api/user/auth/send-otp` |
| `verifyOtpLimiter` | 60s | 5 req | `POST /api/user/auth/verify-otp` |
| `pinLimiter` | 60s | 5 req | `POST /api/user/auth/verify-pin` |
| `authLimiter` | 60s | 10 req | Token refresh, PIN verify |
| `securityLimiter` | 60h | 3 req | Password change, account delete, data export |
| `otpPerIpLimiter` | 60s | 5 req | OTP send per IP |

### Financial Rate Limiters

| Limiter | Applied To |
|---------|-----------|
| `financialWriteRateLimit` | All Razorpay create-order, verify, capture calls |
| `bbpsPayLimiter` | BBPS payment operations |

All limiters return standard `RateLimit-*` headers (`standardHeaders: true`).

---

## 6. Frontend API Clients (`lib/api/`)

All functions use the Axios clients from `client.ts`. Import from `@/lib/api/<filename>`.

---

### 6.1 `lib/api/auth.ts`

#### `sendOtp(phone, countryCode?, channel?)`

Sends an OTP to the given phone number.

```typescript
// Signature
async function sendOtp(
  phone: string,
  countryCode = '+91',
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<{ success: true; isNewUser: boolean; hasPIN: boolean; message?: string }>

// HTTP
POST /api/user/auth/send-otp
Body: { phone: string; countryCode: string; channel: 'sms' | 'whatsapp' }
Client: publicClient (no auth)
Rate limit: 5/min per IP
```

#### `verifyOtp(phone, otp, countryCode?)`

Verifies the OTP and returns auth tokens.

```typescript
// Signature
async function verifyOtp(
  phone: string,
  otp: string,
  countryCode = '+91'
): Promise<{ tokens: AuthTokens; user: AuthUser }>

// HTTP
POST /api/user/auth/verify-otp
Body: { phone: string; otp: string; countryCode: string }
Client: publicClient (no auth)
Rate limit: 5/min per IP
Response: { success, accessToken, refreshToken, user: AuthUser }
```

#### `verifyPin(phone, pin, countryCode?)`

Authenticates a returning customer using their 4-6 digit PIN.

```typescript
// Signature
async function verifyPin(
  phone: string,
  pin: string,
  countryCode = '+91'
): Promise<{ tokens: AuthTokens; user: AuthUser }>

// HTTP
POST /api/user/auth/login-pin   // NOTE: frontend calls /login-pin, backend defines /verify-pin — verify routing
Body: { phone: string; pin: string; countryCode: string }
Client: publicClient (no auth)
Rate limit: 5/min per IP
```

#### `refreshToken(token)`

Refreshes the access token using a refresh token.

```typescript
// Signature
async function refreshToken(token: string): Promise<AuthTokens>

// HTTP
POST /api/auth/token/refresh
Body: { refreshToken: string }
Client: publicClient (no auth)
Response: { success, accessToken, refreshToken }
```

---

### 6.2 `lib/api/store.ts`

#### `getStoreMenu(storeSlug)`

Fetches the full store menu with categories, items, table info, and payment methods.

```typescript
// Signature
async function getStoreMenu(storeSlug: string): Promise<StoreMenuResponse>

// Response shape
interface StoreMenuResponse {
  store: StoreInfo;
  categories: MenuCategory[];
  promotions: Array<{ id: string; title: string; image: string | null; description: string }>;
}

// HTTP
GET /api/web-ordering/store/:storeSlug
Client: publicClient (no auth)
Rate limit: menuLimiter (120/min)
Cache: Redis, 5 min TTL (key: web_menu:{slug})
```

#### `getScanPayStore(storeSlug)`

Fetches minimal store info for the Scan & Pay flow (no menu required).

```typescript
// Signature
async function getScanPayStore(storeSlug: string): Promise<StoreInfo>

// HTTP
GET /api/store-payment/store/:storeSlug   // NOTE: frontend calls this, verify backend route path
Client: publicClient (no auth)
```

#### `callWaiter(storeSlug, tableNumber)`

Sends a waiter call notification to the merchant dashboard.

```typescript
// Signature
async function callWaiter(storeSlug: string, tableNumber: string): Promise<void>

// HTTP
POST /api/web-ordering/waiter/call
Body: { storeSlug: string; tableNumber: string }
Client: publicClient (no auth)
Rate limit: writeLimiter (10/min)
```

#### `requestBill(storeSlug, tableNumber)`

Requests the bill for a dine-in table.

```typescript
// Signature
async function requestBill(storeSlug: string, tableNumber: string): Promise<void>

// HTTP
POST /api/web-ordering/bill/request
Body: { storeSlug: string; tableNumber: string }
Client: publicClient (no auth)
Rate limit: writeLimiter (10/min)
```

#### `getRecommendations(storeSlug)`

Returns personalized + popular item recommendations.

```typescript
// Signature
async function getRecommendations(storeSlug: string): Promise<Array<{
  id: string; name: string; price: number; image: string | null;
  isVeg: boolean; description: string; orderCount: number; source: 'personal' | 'popular'
}>>

// HTTP
GET /api/web-ordering/recommendations?storeSlug=:storeSlug
Client: publicClient (no auth)
Rate limit: menuLimiter (120/min)
```

---

### 6.3 `lib/api/cart.ts`

#### `validateCart(storeSlug, items)`

Validates cart items against live menu stock and pricing.

```typescript
// Signature
async function validateCart(storeSlug: string, items: CartItem[]): Promise<{
  validItems: CartItem[];
  unavailableItems: string[];  // item IDs that are unavailable/86'd/price-changed
}>

// HTTP
POST /api/web-ordering/cart/validate
Body: { storeSlug: string; items: CartItem[] }
Client: publicClient (no auth)
Rate limit: menuLimiter (120/min)
```

#### `validateCoupon(couponCode, storeSlug, subtotal)`

Validates a coupon code against the current order subtotal.

```typescript
// Signature
async function validateCoupon(
  couponCode: string,
  storeSlug: string,
  subtotal: number
): Promise<CouponValidateResponse>

// HTTP
POST /api/web-ordering/coupon/validate
Body: { sessionToken?: string; couponCode: string; storeSlug: string; subtotal: number }
Client: authClient (Bearer JWT)
Rate limit: writeLimiter (10/min)
```

#### `getAvailableCoupons(storeSlug)`

Lists active public coupons for a store.

```typescript
// Signature
async function getAvailableCoupons(storeSlug: string): Promise<AvailableCoupon[]>

// HTTP
GET /api/web-ordering/store/:storeSlug/coupons
Client: publicClient (no auth)
Rate limit: menuLimiter (120/min)
Cache: Redis, 60s TTL
```

---

### 6.4 `lib/api/orders.ts`

#### `getOrder(orderNumber)`

Fetches full order details by order number.

```typescript
// Signature
async function getOrder(orderNumber: string): Promise<WebOrder>

// HTTP
GET /api/web-ordering/order/:orderNumber
Client: authClient (Bearer JWT)
Rate limit: orderLimiter (10/min)
Response includes: orderNumber, status, paymentStatus, items, subtotal, taxes, total,
  tableNumber, storeName, createdAt, scheduledFor, googlePlaceId
```

#### `cancelOrder(orderNumber)`

Cancels an order (only if status is `pending_payment` or `confirmed`).

```typescript
// Signature
async function cancelOrder(orderNumber: string): Promise<void>

// HTTP
POST /api/web-ordering/orders/:orderNumber/cancel
Body: { reason: string }          // Note: orders.ts calls with no body, cancellation.ts uses { reason }
Client: authClient (Bearer JWT)   // NOTE: webOrderingRoutes.ts supports { sessionToken, reason } too
Rate limit: writeLimiter (10/min)
FSM: only allowed for status in ['pending_payment', 'confirmed']
```

#### `rateOrder(orderNumber, rating, comment?)`

Submits a 1-5 star rating for a completed order.

```typescript
// Signature
async function rateOrder(orderNumber: string, rating: number, comment: string): Promise<void>

// HTTP
POST /api/web-ordering/orders/:orderNumber/rating
Body: { rating: number; comment?: string }
Client: publicClient (no auth — guest orders can rate)
Headers: X-Requested-With: XMLHttpRequest
Rate limit: writeLimiter (10/min)
FSM: 409 if already rated
```

#### `submitFeedback(orderNumber, feedback)`

Submits structured post-order feedback survey.

```typescript
// Signature
async function submitFeedback(
  orderNumber: string,
  feedback: {
    rating?: number; comment?: string; reason?: string;
    description?: string; isDispute?: boolean;
  }
): Promise<void>

// HTTP
POST /api/web-ordering/order/:orderNumber/feedback
Client: authClient (Bearer JWT)
```

#### `getOrderHistory()`

Returns the customer's complete order history (all stores).

```typescript
// Signature
async function getOrderHistory(): Promise<OrderHistoryItem[]>

// HTTP
GET /api/web-ordering/orders/history
Client: authClient (Bearer JWT)
Rate limit: orderLimiter (10/min)
```

#### `getLoyaltyStamps(storeSlug)`

Returns the loyalty stamp count for a customer at a specific store.

```typescript
// Signature
async function getLoyaltyStamps(storeSlug: string): Promise<StampCard>

// HTTP
GET /api/web-ordering/loyalty/stamps?storeSlug=:storeSlug
Client: authClient (Bearer JWT)
Rate limit: menuLimiter (120/min)
Response: { stamps, stampsRequired: 10, rewardDescription, totalOrders }
```

#### `sendReceipt(orderNumber, via)`

Generates and sends a digital receipt via WhatsApp or email.

```typescript
// Signature
async function sendReceipt(orderNumber: string, via: 'whatsapp' | 'email'): Promise<void>

// HTTP
POST /api/web-ordering/receipt/send
Body: { orderNumber: string; phone?: string; email?: string }
Client: authClient (Bearer JWT)
Rate limit: orderLimiter (10/min)
```

#### `creditCoins(orderNumber)`

Credits REZ Coins to the customer's wallet after a paid order.

```typescript
// Signature
async function creditCoins(orderNumber: string): Promise<{ coinsEarned: number }>

// HTTP
POST /api/web-ordering/coins/credit
Body: { sessionToken?: string; orderNumber: string }
Client: authClient (Bearer JWT)
Rate limit: orderLimiter (10/min)
Condition: order.paymentStatus === 'paid' AND coins not yet credited
```

#### `setOrderStatus(orderNumber, status)`

Updates order status (merchant-side only).

```typescript
// Signature
async function setOrderStatus(orderNumber: string, status: WebOrderStatus): Promise<void>

// HTTP
PUT /api/web-ordering/order/:orderNumber/update-status
Body: { status: WebOrderStatus }
Client: authClient (Bearer JWT)
```

---

### 6.5 `lib/api/orderHistory.ts`

#### `getOrderHistory(page?, limit?)`

Returns paginated order history for the authenticated customer.

```typescript
// Signature
async function getOrderHistory(page = 1, limit = 10): Promise<OrderHistoryResponse>

interface OrderHistoryResponse {
  orders: OrderHistoryItem[];
  pagination: { page: number; limit: number; total: number; hasNext: boolean };
}

interface OrderHistoryItem {
  orderNumber: string;
  storeSlug: string;
  storeName: string;
  storeLogo?: string;
  items: { name: string; quantity: number }[];
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  scheduledFor?: string;
}

// HTTP
GET /api/web-ordering/orders/history?page=:page&limit=:limit
Client: authClient (Bearer JWT)
Rate limit: orderLimiter (10/min)
```

---

### 6.6 `lib/api/payment.ts`

#### `createRazorpayOrder(payload)`

Creates a Razorpay order for menu-based ordering.

```typescript
// Signature
async function createRazorpayOrder(payload: CreateOrderPayload): Promise<RazorpayOrderResponse>

interface CreateOrderPayload {
  storeSlug: string;
  tableNumber?: string;
  orderType?: 'dine_in' | 'takeaway' | 'delivery';
  deliveryAddress?: DeliveryAddress;
  items: CartItem[];
  subtotal: number;
  tip: number;
  donation: number;
  couponCode?: string;
  groupOrderId?: string;
  splitBillId?: string;
  scheduledFor?: string;  // ISO datetime for pre-orders
}

// HTTP
POST /api/web-ordering/razorpay/create-order
Client: authClient (Bearer JWT)
Response: { razorpayOrderId, amount, currency, keyId, orderNumber }
```

#### `verifyPayment(orderNumber, response)`

Verifies the Razorpay payment signature server-side.

```typescript
// Signature
async function verifyPayment(
  orderNumber: string,
  response: RazorpaySuccessResponse
): Promise<{ verified: boolean }>

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// HTTP
POST /api/web-ordering/payment/verify
Body: { orderNumber; razorpayOrderId; razorpayPaymentId; razorpaySignature }
Client: authClient (Bearer JWT)
```

#### `addTip(orderNumber, tipAmount)`

Adds a digital tip to a paid order.

```typescript
// Signature
async function addTip(orderNumber: string, tipAmount: number): Promise<void>

// HTTP
POST /api/web-ordering/tip
Body: { orderNumber: string; tipAmount: number }
Client: authClient (Bearer JWT)
Rate limit: orderLimiter (10/min)
```

#### `addDonation(orderNumber, donationAmount)`

Adds a charity donation to an order.

```typescript
// Signature
async function addDonation(orderNumber: string, donationAmount: number): Promise<void>

// HTTP
POST /api/web-ordering/order/:orderNumber/donate
Body: { donationAmount: number; charityName?: string }
Client: authClient (Bearer JWT)
Rate limit: orderLimiter (10/min)
```

#### `splitBill(storeSlug, total, splitCount)`

Splits a bill equally across `splitCount` people.

```typescript
// Signature
async function splitBill(storeSlug: string, total: number, splitCount: number): Promise<{
  splits: Array<{ name: string; amount: number; paymentLink: string }>;
}>

// HTTP
POST /api/web-ordering/bill/split
Body: { storeSlug: string; total: number; splitCount: number }
Client: authClient (Bearer JWT)
Rate limit: orderLimiter (10/min)
```

---

### 6.7 `lib/api/scanPayment.ts`

#### `createScanPayOrder(storeSlug, amountPaise)`

Creates a Razorpay order for Scan & Pay (no menu ordering).

```typescript
// Signature
async function createScanPayOrder(
  storeSlug: string,
  amountPaise: number
): Promise<ScanPayOrderResponse>

interface ScanPayOrderResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
  paymentId: string;
}

// HTTP
POST /api/store-payment/razorpay/create-order
Client: authClient (Bearer JWT)
Rate limit: paymentInitLimiter (10/min) — from storePaymentRoutes.ts
```

#### `verifyScanPayment(paymentId, response)`

Verifies the Scan & Pay Razorpay payment.

```typescript
// Signature
async function verifyScanPayment(
  paymentId: string,
  response: RazorpaySuccessResponse
): Promise<{ verified: boolean }>

// HTTP
POST /api/store-payment/payment/verify
Body: { paymentId; razorpayOrderId; razorpayPaymentId; razorpaySignature }
Client: authClient (Bearer JWT)
```

#### `creditScanPayCoins(paymentId)`

Credits REZ Coins after a successful Scan & Pay payment.

```typescript
// Signature
async function creditScanPayCoins(paymentId: string): Promise<{ coinsEarned: number }>

// HTTP
POST /api/store-payment/coins/credit
Body: { paymentId: string }
Client: authClient (Bearer JWT)
```

#### `getScanPayHistory()`

Returns the customer's Scan & Pay payment history.

```typescript
// Signature
async function getScanPayHistory(): Promise<StorePayment[]>

// HTTP
GET /api/store-payment/history
Client: authClient (Bearer JWT)
```

---

### 6.8 `lib/api/wallet.ts`

#### `getWalletBalance()`

Returns the customer's REZ coin and rupee wallet balance.

```typescript
// Signature
async function getWalletBalance(): Promise<WalletBalance>

interface WalletBalance {
  coins: number;
  rupees: number;         // coins / 100
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
}

// HTTP
GET /api/wallet/balance
Client: authClient (Bearer JWT)
Rate limit: walletReadLimiter
```

#### `getWalletTransactions(page?, limit?)`

Returns paginated wallet transaction history.

```typescript
// Signature
async function getWalletTransactions(
  page = 1,
  limit = 20
): Promise<{
  transactions: WalletTransaction[];
  pagination: { total: number; page: number; hasMore: boolean };
}>

interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  coinType: string;
  source: string;
  description: string;
  createdAt: string;
}

// HTTP
GET /api/wallet/transactions?page=:page&limit=:limit
Client: authClient (Bearer JWT)
Rate limit: walletReadLimiter
```

---

### 6.9 `lib/api/search.ts`

#### `searchStores(q, limit?, page?)`

Searches stores by name or slug.

```typescript
// Signature
async function searchStores(
  q: string,
  limit = 10,
  page = 1
): Promise<StoreSearchResult[]>

interface StoreSearchResult {
  id: string; name: string; slug: string; logo: string | null;
  storeType: string; category: string; address: string; isOpen: boolean; cuisine?: string;
}

// HTTP
GET /api/web-ordering/search?q=:q&limit=:limit&page=:page
Client: native fetch (no Axios wrapper)
Timeout: 8s
Rate limit: searchLimiter (30/min)
Cache: Redis, 30s TTL
Min query: 2 characters
```

#### `getFeaturedStores()`

Returns up to 8 featured stores for the homepage.

```typescript
// Signature
async function getFeaturedStores(): Promise<StoreSearchResult[]>

// HTTP
GET /api/web-ordering/stores/featured
Client: native fetch (no Axios wrapper)
Timeout: 8s
Cache: 5 min server-side revalidation
```

---

### 6.10 `lib/api/coupons.ts`

#### `getStoreCoupons(storeSlug)`

Lists active coupons for a store.

```typescript
// Signature
async function getStoreCoupons(storeSlug: string): Promise<Coupon[]>

interface Coupon {
  code: string; description: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  minOrderValue?: number;
  maxDiscount?: number;
}

// HTTP
GET /api/web-ordering/store/:storeSlug/coupons
Client: publicClient (no auth)
Rate limit: menuLimiter (120/min)
Cache: Redis, 60s TTL
```

#### `calculateCouponDiscount(coupon, subtotal)`

Client-side discount calculator (no backend call).

```typescript
// Signature
function calculateCouponDiscount(coupon: Coupon, subtotal: number): number
// percent: Math.min(subtotal * value/100, maxDiscount)
// flat:    Math.min(value, subtotal)
```

---

### 6.11 `lib/api/reservations.ts`

#### `getAvailability(storeSlug, date)`

Returns time slot availability for a given date.

```typescript
// Signature
async function getAvailability(storeSlug: string, date: string): Promise<TimeSlot[]>

interface TimeSlot {
  time: string;       // "HH:MM" format
  available: boolean;
  spotsLeft?: number;
}

// HTTP
GET /api/web-ordering/store/:storeSlug/availability?date=YYYY-MM-DD
Client: publicClient (no auth)
Rate limit: menuLimiter (120/min)
Slots: every 30 min from open to close-1h
```

#### `createReservation(storeSlug, payload)`

Creates a table reservation.

```typescript
// Signature
async function createReservation(
  storeSlug: string,
  payload: {
    customerName: string;
    customerPhone: string;
    partySize: number;
    date: string;       // YYYY-MM-DD
    timeSlot: string;   // HH:MM
    notes?: string;
  }
): Promise<ReservationConfirmation>

interface ReservationConfirmation {
  reservationCode: string;   // "RES-XXX" format
  date: string;
  timeSlot: string;
  confirmationMessage: string;
}

// HTTP
POST /api/web-ordering/store/:storeSlug/reserve
Body: as above
Client: publicClient (no auth)
Headers: X-Requested-With: XMLHttpRequest
Rate limit: reservationLimiter (10/min)
Validation: date today..+30 days, partySize 1..20, timeSlot HH:MM
```

---

### 6.12 `lib/api/delivery.ts`

#### `checkDelivery(storeSlug, latitude, longitude)`

Checks if a location is within the store's delivery radius.

```typescript
// Signature
async function checkDelivery(
  storeSlug: string,
  latitude: number,
  longitude: number
): Promise<DeliveryCheck>

interface DeliveryCheck {
  deliverable: boolean;
  fee: number;
  distanceKm: number;
  message?: string;
}

// HTTP
POST /api/web-ordering/store/:storeSlug/check-delivery
Body: { latitude: number; longitude: number }
Client: publicClient (no auth)
Rate limit: menuLimiter (120/min)
Distance: Haversine formula, compared against store.deliveryRadiusKm
```

---

### 6.13 `lib/api/waiter.ts`

#### `callWaiter(storeSlug, tableNumber, reason?)`

Sends a waiter call request from a dine-in table.

```typescript
// Signature
async function callWaiter(
  storeSlug: string,
  tableNumber: string,
  reason?: string
): Promise<WaiterCallResponse>

interface WaiterCallResponse {
  success: boolean;
  requestId: string;   // "WAITER-XXXXXXXX" format
}

// HTTP
POST /api/web-ordering/waiter/call
Body: { storeSlug: string; tableNumber: string; reason?: string }
Client: publicClient (no auth — guest customers can call)
Rate limit: writeLimiter (10/min)
Redis key: waiter:{slug}:{table}:{requestId}
TTL: 5 min (acknowledged), 60s (resolved)
```

#### `getWaiterCallStatus(requestId)`

Polls the current status of a waiter call.

```typescript
// Signature
async function getWaiterCallStatus(requestId: string): Promise<WaiterCallStatusResponse>

interface WaiterCallStatusResponse {
  status: 'pending' | 'acknowledged' | 'resolved';
}

// HTTP
GET /api/web-ordering/waiter/call/:requestId/status?storeSlug=&tableNumber=
Client: publicClient (no auth)
Rate limit: menuLimiter (120/min)
```

---

### 6.14 `lib/api/waiterStaff.ts`

#### `getActiveCalls(storeSlug)`

Returns all active (pending + acknowledged) waiter calls for the staff dashboard.

```typescript
// Signature
async function getActiveCalls(storeSlug: string): Promise<WaiterCallRecord[]>

interface WaiterCallRecord {
  requestId: string;
  tableNumber: string;
  status: 'pending' | 'acknowledged' | 'resolved';
  createdAt: string;
  reason?: string;
  orderNumber?: string;
}

// HTTP
GET /api/web-ordering/store/:storeSlug/waiter-calls
Client: publicClient (no auth)
```

#### `updateCallStatus(requestId, status)`

Updates a waiter call's status (staff taps Acknowledge or Resolve).

```typescript
// Signature
async function updateCallStatus(
  requestId: string,
  status: 'acknowledged' | 'resolved'
): Promise<void>

// HTTP
PATCH /api/web-ordering/waiter/call/:requestId
Body: { status: 'acknowledged' | 'resolved'; storeSlug?: string; tableNumber?: string }
Client: publicClient (no auth)
Rate limit: writeLimiter (10/min)
TTL on Redis after update: 300s (acknowledged), 60s (resolved)
```

---

### 6.15 `lib/api/reviews.ts`

#### `getStoreReviews(storeSlug)`

Returns Google Places reviews for a store.

```typescript
// Signature
async function getStoreReviews(storeSlug: string): Promise<StoreReviews>

interface GoogleReview {
  author: string; rating: number; text: string; time: number; profilePhoto?: string;
}

interface StoreReviews {
  rating: number | null;
  totalRatings: number;
  reviews: GoogleReview[];
}

// HTTP
GET /api/web-ordering/store/:storeSlug/reviews
Client: publicClient (no auth)
Rate limit: menuLimiter (120/min)
Cache: Redis, 24h TTL
Fallback: { rating: null, totalRatings: 0, reviews: [] } if no googlePlaceId or missing GOOGLE_PLACES_API_KEY
```

---

### 6.16 `lib/api/loyalty.ts`

#### `getLoyaltyStatus(storeSlug)`

Returns the customer's stamp count and any active reward at a store.

```typescript
// Signature
async function getLoyaltyStatus(storeSlug: string): Promise<LoyaltyStatus>

interface ActiveReward {
  code: string; description: string; expiresAt: string;
}

interface LoyaltyStatus {
  stamps: number;           // 0..9 (cycles every 10 orders)
  stampsRequired: number;    // 10
  canRedeem: boolean;        // true when stamps === 0 and totalOrders > 0
  activeReward?: ActiveReward;
}

// HTTP
GET /api/web-ordering/store/:storeSlug/loyalty/status
Client: authClient (Bearer JWT)
Rate limit: menuLimiter (120/min)
```

#### `redeemStamps(storeSlug)`

Redeems accumulated stamps for a reward code (Free Dessert).

```typescript
// Signature
async function redeemStamps(storeSlug: string): Promise<RedeemResult>

interface RedeemResult {
  rewardCode: string;
  description: string;
  expiresAt: string;
  alreadyActive?: boolean;  // true if reward was already issued today
}

// HTTP
POST /api/web-ordering/store/:storeSlug/loyalty/redeem
Client: authClient (Bearer JWT)
Rate limit: orderLimiter (10/min)
Reward validity: 24 hours from issuance
Idempotent: returns existing reward if one was already issued today
```

---

### 6.17 `lib/api/profile.ts`

#### `getProfile()`

Returns the authenticated customer's profile with order stats.

```typescript
// Signature
async function getProfile(): Promise<UserProfile>

interface UserProfile {
  name: string; phone: string; email?: string; avatarUrl?: string;
  totalOrders: number; totalSpent: number; joinedAt: string;
}

// HTTP
GET /api/web-ordering/profile
Client: authClient (Bearer JWT)
```

#### `updateProfile(payload)`

Updates the customer's display name.

```typescript
// Signature
async function updateProfile(payload: { name: string }): Promise<UserProfile>

// HTTP
PATCH /api/web-ordering/profile
Body: { name: string }
Client: authClient (Bearer JWT)
Rate limit: writeLimiter (10/min)
```

---

### 6.18 `lib/api/cancellation.ts`

#### `cancelOrder(orderNumber, reason)`

Cancels an order with a reason (dedicated cancellation endpoint).

```typescript
// Signature
async function cancelOrder(
  orderNumber: string,
  reason: string
): Promise<{ success: boolean; refundInitiated: boolean }>

// HTTP
POST /api/web-ordering/orders/:orderNumber/cancel
Body: { reason: string }
Client: authClient (Bearer JWT)
Rate limit: writeLimiter (10/min)
FSM: only allowed for status in ['pending_payment', 'confirmed']
Refund: initiated if paymentStatus === 'paid'
```

---

### 6.19 `lib/api/reorder.ts`

#### `prefillCartFromOrder(orderNumber, storeSlug)`

Fetches a previous order and pre-populates the Zustand cart store.

```typescript
// Signature
async function prefillCartFromOrder(orderNumber: string, storeSlug: string): Promise<boolean>
// Returns true if at least one item was loaded into the cart

// HTTP
GET /api/web-ordering/order/:orderNumber
Client: publicClient (no auth)
Side effect: calls useCartStore.setStore(), clearCart(), addItem() for each item
```

---

## 7. Backend Routes

All backend routes are under `https://api.rezapp.com`. Base paths are mounted from `routes.ts`.

### 7.1 Auth Routes (`/api/user/auth`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/send-otp` | No | otpLimiter (5/min IP) | Send OTP via SMS/WhatsApp |
| POST | `/verify-otp` | No | verifyOtpLimiter (5/min IP) | Verify OTP, return JWT |
| POST | `/refresh-token` | No | authLimiter | Refresh access token |
| POST | `/logout` | Yes | — | Invalidate session |
| GET | `/me` | Yes | — | Current user info |
| PUT | `/profile` | Yes | — | Update user profile |
| PUT | `/change-password` | Yes | securityLimiter (3/60h) | Change password |
| POST | `/set-pin` | Yes | — | Set 4-6 digit PIN |
| POST | `/verify-pin` | No | pinLimiter + authLimiter | PIN login |
| GET | `/has-pin` | Yes | — | Check if user has PIN |
| POST | `/request-email-change` | Yes | securityLimiter | 2-step email change step 1 |
| POST | `/confirm-email-change` | Yes | securityLimiter | 2-step email change step 2 |
| GET | `/me/data-export` | Yes | securityLimiter | GDPR data export |
| DELETE | `/account` | Yes | securityLimiter | Delete account |

### 7.2 Web Ordering Routes (`/api/web-ordering`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/search?q=&limit=&page=` | No | searchLimiter (30/min) | Store search |
| GET | `/stores/featured` | No | menuLimiter (120/min) | Featured stores |
| GET | `/store/:storeSlug` | No | menuLimiter | Full store menu |
| GET | `/store/:storeSlug/menu` | No | menuLimiter | Alias (redirects) |
| POST | `/store/:storeSlug/check-delivery` | No | menuLimiter | Delivery zone check |
| GET | `/store/:storeSlug/availability?date=` | No | menuLimiter | Time slot availability |
| POST | `/store/:storeSlug/reserve` | No | reservationLimiter (10/min) | Create reservation |
| GET | `/store/:storeSlug/coupons` | No | menuLimiter | Available coupons |
| GET | `/store/:storeSlug/reviews` | No | menuLimiter | Google Places reviews |
| GET | `/store/:storeSlug/loyalty/status` | Yes | menuLimiter | Loyalty stamp count |
| POST | `/store/:storeSlug/loyalty/redeem` | Yes | orderLimiter | Redeem stamps |
| GET | `/recommendations?storeSlug=` | No | menuLimiter | Item recommendations |
| GET | `/store/:storeSlug/today-payments` | No | menuLimiter | Payment kiosk data |
| POST | `/store/:storeSlug/emit-payment` | **Internal** | — | Emit Socket.IO event |
| GET | `/otp/send` | No | otpLimiter | Web ordering OTP send |
| POST | `/otp/verify` | No | — | Web ordering OTP verify |
| POST | `/order` | No | orderLimiter | Create web order |
| POST | `/order/:orderNumber/verify-otp` | No | otpLimiter | Verify OTP for anonymous order |
| GET | `/order/:orderNumber` | No | orderLimiter | Get order details |
| POST | `/cart/validate` | No | menuLimiter | Validate cart items |
| POST | `/coupon/validate` | No | writeLimiter | Validate coupon |
| GET | `/orders/history` | Optional | orderLimiter | Paginated order history |
| POST | `/orders/:orderNumber/cancel` | Yes | writeLimiter | Cancel order |
| POST | `/orders/:orderNumber/rating` | No | writeLimiter | Submit rating |
| PATCH | `/order/:orderNumber/update-status` | Yes | — | Update order status (merchant) |
| POST | `/order/:orderNumber/feedback` | Yes | — | Submit feedback |
| POST | `/order/:orderNumber/donate` | Yes | orderLimiter | Add donation |
| POST | `/order/:orderNumber/parcel` | Yes | orderLimiter | Request parcel packing |
| POST | `/receipt/send` | Yes | orderLimiter | Send WhatsApp/email receipt |
| POST | `/tip` | Yes | orderLimiter | Add digital tip |
| POST | `/bill/split` | Yes | orderLimiter | Split bill (equal/by-item/custom) |
| GET | `/bill/:orderNumber/split-status` | No | orderLimiter | Get split status |
| POST | `/bill/request` | No | writeLimiter | Request bill for table |
| POST | `/waiter/call` | No | writeLimiter | Call waiter |
| GET | `/waiter/call/:requestId/status` | No | menuLimiter | Waiter call status |
| GET | `/store/:storeSlug/waiter-calls` | No | — | Staff: active waiter calls |
| PATCH | `/waiter/call/:requestId` | No | writeLimiter | Staff: update call status |
| POST | `/group/create` | No | groupLimiter (20/min) | Create group order |
| POST | `/group/:groupId/join` | No | groupLimiter | Join group order |
| POST | `/group/:groupId/items` | No | groupLimiter | Add item to group |
| POST | `/group/:groupId/finalize` | No | groupLimiter | Finalize group order |
| POST | `/coins/credit` | Yes | orderLimiter | Credit coins for order |
| GET | `/coins/balance` | Optional | — | Coin balance |
| GET | `/loyalty/stamps` | Yes | menuLimiter | Loyalty stamp count |
| GET | `/profile` | Yes | — | Customer profile |
| PATCH | `/profile` | Yes | writeLimiter | Update profile |
| POST | `/push/subscribe` | Yes | orderLimiter | Save Web Push subscription |
| POST | `/store/:storeSlug/broadcast` | Merchant | broadcastLimiter | Send push broadcast |
| GET | `/store/:storeSlug/broadcasts` | Merchant | — | Broadcast history |
| GET | `/store/:storeSlug/analytics` | Merchant | analyticsLimiter | Store analytics |
| PATCH | `/store/:storeSlug/menu/item/:itemId/availability` | Merchant | — | Toggle item availability |
| GET | `/admin/orders` | Admin | — | All orders (admin) |
| GET | `/admin/orders/:orderNumber` | Admin | — | Order detail (admin) |
| GET | `/check-slug/:slug` | No | slugCheckLimiter (60/min) | Check slug availability |

### 7.3 Payment Routes (`/api/payment`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/create-order` | Yes | financialWriteRateLimit | Create Razorpay order |
| POST | `/initiate` | Yes | financialWriteRateLimit | Alias for create-order |
| POST | `/verify` | Yes | financialWriteRateLimit | Verify Razorpay signature |
| POST | `/capture` | Yes | financialWriteRateLimit | Alias for verify |
| GET | `/status/:orderId` | Yes | — | Payment status |
| POST | `/create-checkout-session` | Yes | financialWriteRateLimit | Stripe checkout |
| POST | `/verify-stripe-session` | Yes | financialWriteRateLimit | Verify Stripe session |
| POST | `/verify-stripe-payment` | Yes | financialWriteRateLimit | Verify Stripe payment |
| POST | `/refund` | Yes + SeniorAdmin | financialWriteRateLimit | Create refund |

Note: The web ordering frontend uses `/api/web-ordering/razorpay/create-order` and `/api/web-ordering/payment/verify` — these are handled within `webOrderingRoutes.ts`, not `paymentRoutes.ts`. The `paymentRoutes.ts` handles cross-service payment operations.

### 7.4 Store Payment Routes (`/api/store-payment`)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/lookup/:qrCode` | No | qrLookupLimiter (30/min) | Lookup store by QR |
| GET | `/lookup-by-slug/:storeSlug` | No | qrLookupLimiter | Lookup store by slug |
| POST | `/initiate` | Yes | paymentInitLimiter (10/min) | Initiate Scan & Pay |
| POST | `/confirm` | Yes | — | Confirm Scan & Pay |
| POST | `/cancel` | Yes | — | Cancel Scan & Pay |
| GET | `/history` | Yes | — | User payment history |
| GET | `/details/:paymentId` | Yes | — | Payment details |
| POST | `/razorpay/create-order` | Yes | financialWriteRateLimit | Create Scan & Pay order |
| POST | `/payment/verify` | Yes | — | Verify Scan & Pay payment |
| POST | `/coins/credit` | Yes | — | Credit coins for Scan & Pay |
| GET | `/history/pos` | Yes | — | POS bill history (coins credited) |

### 7.5 Wallet Routes (`/api/wallet`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/balance` | Yes | Wallet balance + tier |
| GET | `/transactions` | Yes | Paginated transactions |
| GET | `/transaction/:id` | Yes | Single transaction |
| GET | `/summary` | Yes | Transaction summary |
| GET | `/transaction-counts` | Yes | Counts by category |
| GET | `/categories` | Yes | Spend breakdown by category |
| GET | `/expiring-coins` | Yes | Coins expiring soon |
| GET | `/coin-rules` | Yes | Current coin earning rules |
| GET | `/recharge/preview` | Yes | Cashback preview |
| GET | `/scheduled-drops` | Yes | Scheduled coin drops |
| GET | `/redemption-suggestions` | Yes | Suggested redemptions |

### 7.6 Razorpay Routes (`/api/razorpay`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/config` | No | Get Razorpay publishable key |
| POST | `/create-order` | Yes | Create Razorpay order |
| POST | `/verify-payment` | Yes | Verify payment signature |
| POST | `/webhook` | No (signature verified) | Razorpay webhook |
| POST | `/refund` | Yes + SeniorAdmin | Create refund |

---

## 8. Internal & Admin Endpoints

### 8.1 Internal Authentication

Internal endpoints use the `requireInternalToken` middleware, which validates the `X-Internal-Token` header against the `INTERNAL_SERVICE_TOKEN` environment variable.

```typescript
// From middleware/internalAuth.ts
function requireInternalToken(req, res, next) {
  const token = req.headers['x-internal-token'];
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}
```

### 8.2 Internal Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/web-ordering/store/:storeSlug/emit-payment` | Internal token | Emits `payment:received` Socket.IO event for Payment Kiosk |
| GET | `/api/user/auth/internal/auth/user:id` | Internal token | Internal user lookup |

### 8.3 Webhook Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks/razorpay` | Signature verified | Canonical Razorpay webhook (preferred) |
| POST | `/api/razorpay/webhook` | Signature verified | Legacy alias — delegates to canonical handler |

Razorpay webhooks receive events:
- `payment.captured` — triggers `emit-payment` + coin credit
- `payment.failed` — marks order as failed

---

## 9. Cross-Service Calls

### 9.1 Web Ordering Service

The web ordering routes (`webOrderingRoutes.ts`) call the following internal services:

| Service | Called By | Operation |
|---------|-----------|-----------|
| **MongoDB / WebOrder model** | All order endpoints | CRUD for orders |
| **MongoDB / Store model** | Menu, availability, recommendations | Store data |
| **MongoDB / Menu model** | Store menu | Menu categories and items |
| **MongoDB / Coupon model** | Coupon validate, store coupons | Coupon lookup |
| **MongoDB / TableReservation model** | Availability, reservations | Reservation CRUD |
| **MongoDB / LoyaltyReward model** | Loyalty redeem | Issue/check rewards |
| **Redis (`redisService`)** | Menu cache, waiter calls, group orders, search cache | TTL-based caching |
| **Socket.IO (`req.app.get('io')`)** | Order status updates, waiter calls, bill requests, payment kiosk | Real-time push |
| **Razorpay API** | Order creation, payment verification | Payment processing |
| **WhatsApp service** | Receipt send, reorder reminders | Notification delivery |
| **Google Places API** | Store reviews | Fetch Google reviews |
| **Web Push service** | Push subscriptions, broadcasts | Browser push notifications |
| **User model** | Coin crediting, profile | User lookup by phone |
| **Wallet model** | Coin balance | Balance queries |

### 9.2 Store Payment Service

The store payment routes (`storePaymentRoutes.ts`) call:

| Service | Called By | Operation |
|---------|-----------|-----------|
| **MongoDB / StorePayment model** | Payment CRUD | Payment records |
| **MongoDB / PosBill model** | POS history | POS bill lookup |
| **Razorpay API** | Payment initiation | QR code / payment order |
| **EmailService** | Invoice email | Send invoice PDF |
| **Socket.IO** | Payment received | Real-time updates |

### 9.3 Wallet Service

The wallet routes (`walletRoutes.ts`) handle:

| Service | Called By | Operation |
|---------|-----------|-----------|
| **MongoDB / Wallet model** | Balance, transactions | Coin/rupee management |
| **MongoDB / User model** | User lookup | Owner verification |

### 9.4 Gamification Service

Called during coin credit operations:

| Service | Called By | Operation |
|---------|-----------|-----------|
| **Gamification microservice** (`GAMIFICATION_SERVICE_URL`) | Coin credit | Earning rules, tier upgrades |
| **Wallet service** | Coin debit/redemption | Coin ledger |

---

## 10. WebSocket / Socket.IO Events

### 10.1 Namespaces

| Namespace | Path | Use Case |
|----------|------|---------|
| Main | `/` (default) | Order status, waiter calls, payment kiosk |
| KDS | `/kds` | Kitchen Display System — item-level status |
| Table | `/table` | Customer-to-staff table chat |

### 10.2 Client-to-Server Events

| Event | Namespace | Direction | Payload | Use Case |
|-------|-----------|----------|---------|----------|
| `order:mark-preparing` | KDS | C→S | `{ orderNumber, itemId? }` | Kitchen marks preparing |
| `order:mark-ready` | KDS | C→S | `{ orderNumber, itemId? }` | Kitchen marks ready |
| `table:message` | Table | C→S | `{ storeSlug, tableNumber, message }` | Customer sends message |
| `join:store` | Main | C→S | `{ storeId }` | Join store room |
| `join:order` | Main | C→S | `{ orderNumber }` | Join order room |

### 10.3 Server-to-Client Events

| Event | Namespace | Direction | Payload | Use Case |
|-------|-----------|-----------|---------|----------|
| `web-order:status-update` | Main | S→C | `{ orderNumber, status }` | Live order status |
| `order:refund-pending` | Main | S→C | `{ orderNumber, customerPhone }` | Refund initiated |
| `payment:received` | Main | S→C | `{ id, amount, customerName, customerPhone, razorpayPaymentId, storeSlug, createdAt }` | Payment Kiosk live feed |
| `menu:item-availability` | Main | S→C | `{ itemId, available }` | Item availability change |
| `web-order:cancelled` | Main | S→C | `{ orderNumber, reason }` | Order cancelled |
| `table:message` | Main (staff room) | S→C | `{ storeSlug, tableNumber, message }` | Staff receives table message |
| `bill:requested` | Main (merchant room) | S→C | `{ tableNumber, sessionId, items, totalAmount, requestedAt }` | Bill request notification |
| `waiter:call` | Main (merchant room) | S→C | waiter call object | New waiter call |

### 10.4 Frontend Hooks

```typescript
// lib/hooks/useOrderSocket.ts
// Subscribes to: web-order:status-update for the current order

// lib/hooks/useOrderPolling.ts
// Fallback when Socket.IO disconnected:
// Exponential backoff: 2s → 4s → 8s → ... → 30s max, max 20 attempts
// GET /api/web-ordering/order/:orderNumber
```

---

## Appendix A: TypeScript Types Summary

```typescript
// From lib/types/index.ts

interface StoreInfo {
  id: string; name: string; slug: string; logo: string | null;
  banner: string | null; address: string; phone: string;
  storeType: StoreType;
  hasMenu: boolean;           // true = Order & Pay; false = Scan & Pay
  isProgramMerchant: boolean; // true = show coins/wallet UI
  isOpen: boolean; nextChangeLabel: string;
  operatingHours: Record<string, { open: string; close: string; closed: boolean } | null>;
  deliveryEnabled: boolean; deliveryRadiusKm: number; deliveryFee: number;
  reservationsEnabled?: boolean; maxTableCapacity?: number;
}

interface MenuCategory { id: string; name: string; sortOrder: number; items: MenuItem[]; }
interface MenuItem {
  id: string; name: string; description: string | null; price: number; // paise
  originalPrice: number | null; isVeg: boolean; isAvailable: boolean;
  spicyLevel: 0 | 1 | 2 | 3; image: string | null;
  customizations?: MenuCustomization[];
}

interface CartItem {
  itemId: string; name: string; price: number; basePrice: number;
  quantity: number; customizations: Record<string, string[]>;
  customizationTotal: number; isVeg: boolean;
}

type WebOrderStatus = 'pending_payment' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

interface WebOrder {
  id: string; orderNumber: string; status: WebOrderStatus;
  items: Array<{ name: string; quantity: number; price: number; customizations?: Record<string, string[]> }>;
  subtotal: number; gst: number; tip: number; donation: number; discount: number; total: number;
  customerPhone: string | null; tableNumber: string | null;
  orderType?: 'dine_in' | 'takeaway' | 'delivery';
  deliveryAddress?: DeliveryAddress; storeSlug: string; storeName: string;
  createdAt: string; updatedAt: string; rating?: number;
}

interface RazorpayOrderResponse {
  razorpayOrderId: string; amount: number; currency: string; keyId: string; orderNumber: string;
}

interface WalletBalance { coins: number; rupees: number; tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null; }
interface WalletTransaction {
  id: string; type: 'credit' | 'debit'; amount: number; coinType: string;
  source: string; description: string; createdAt: string;
}

interface StampCard { totalStamps: number; stampsRequired: number; rewardDescription: string; }
interface ScanPayOrderResponse {
  razorpayOrderId: string; amount: number; currency: string; keyId: string; paymentId: string;
}
```

---

## Appendix B: Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Frontend `verifyPin()` calls `/api/user/auth/login-pin` — backend route is `/verify-pin` | Medium | Verify route mounting or add missing route |
| `history/page.tsx` uses `item.name` as itemId for reorder | Low | Fragile — item names can collide |
| Payment webhook not wired to `emit-payment` | Medium | Manually add to Razorpay webhook handler in `webhookController.ts` |
| `lib/push/webPush.ts` duplicate of `lib/utils/pushNotifications.ts` | Low | Consolidate |
| Receipt email not implemented | Low | TODO in `webOrderingRoutes.ts` — plug in SendGrid/Nodemailer |

---

*Last verified: 2026-04-14. Source files: `rez-now/lib/api/*.ts`, `rezbackend/rez-backend-master/src/routes/{webOrderingRoutes,paymentRoutes,storePaymentRoutes,walletRoutes,authRoutes,razorpayRoutes}.ts`, `rez-now/lib/types/index.ts`.*
