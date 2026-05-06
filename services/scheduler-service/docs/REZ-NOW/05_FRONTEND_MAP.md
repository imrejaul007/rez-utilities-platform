# REZ Now — Frontend Map

Generated from `rez-now/`. Next.js 16 App Router, TypeScript strict mode, Tailwind CSS v4, Zustand, Axios, Socket.IO, Razorpay, next-intl.

---

## 1. Page Map

### Route Overview

| Route | File | Auth | Server/Client | Description |
|-------|------|------|---------------|-------------|
| `/` | `app/page.tsx` | Public | Server | Landing: hero, how-it-works, featured stores |
| `/[storeSlug]` | `app/[storeSlug]/page.tsx` + `StorePageClient.tsx` | Public | Server + Client | Store menu or scan-pay |
| `/[storeSlug]/cart` | `app/[storeSlug]/cart/page.tsx` | Public | Client | Cart with coupon |
| `/[storeSlug]/checkout` | `app/[storeSlug]/checkout/page.tsx` | Public | Client | Full checkout flow |
| `/[storeSlug]/order/[orderNumber]` | `app/[storeSlug]/order/[orderNumber]/page.tsx` | Public | Client | Order tracking |
| `/[storeSlug]/order/queued` | `app/[storeSlug]/order/queued/page.tsx` | Public | Client | Offline queue confirmation |
| `/[storeSlug]/pay` | `app/[storeSlug]/pay/page.tsx` | Public | Client | Scan & Pay amount entry |
| `/[storeSlug]/pay/checkout` | `app/[storeSlug]/pay/checkout/page.tsx` | Public | Client | Scan & Pay confirmation |
| `/[storeSlug]/pay/confirm/[paymentId]` | `app/[storeSlug]/pay/confirm/[paymentId]/page.tsx` | Public | Client | Scan & Pay success |
| `/[storeSlug]/history` | `app/[storeSlug]/history/page.tsx` | Public | Client | Store-level order history |
| `/[storeSlug]/bill` | `app/[storeSlug]/bill/page.tsx` | Public | Client | Live bill + split |
| `/[storeSlug]/schedule` | `app/[storeSlug]/schedule/page.tsx` | Public | Client | Standalone schedule |
| `/[storeSlug]/reserve` | `app/[storeSlug]/reserve/page.tsx` + `ReservationClient.tsx` | Public | Server + Client | Reservation flow |
| `/[storeSlug]/staff` | `app/[storeSlug]/staff/page.tsx` + `StaffDashboardClient.tsx` | Public | Server + Client | Staff PIN gate + waiter calls |
| `/[storeSlug]/receipt/[orderNumber]` | `app/[storeSlug]/receipt/[orderNumber]/page.tsx` | Public | Client | Print-friendly receipt |
| `/orders` | `app/orders/page.tsx` + `OrderHistoryClient.tsx` | Protected | Client | Global paginated order history |
| `/profile` | `app/profile/page.tsx` + `ProfileClient.tsx` | Protected | Client | Profile + settings |
| `/wallet` | `app/wallet/page.tsx` + `WalletClient.tsx` | Protected | Server + Client | Coin balance + transactions |
| `/search` | `app/search/page.tsx` + `SearchResultsClient.tsx` | Public | Client | Store search with filters |
| `/offline` | `app/offline/page.tsx` | Public | Client | Offline page with reload |

---

### Page Details

#### `/` — Landing (`app/page.tsx`)
Server component. Calls `getFeaturedStores()` from `lib/api/search.ts`. Renders hero, how-it-works strip, `<SearchSection>`, and featured store cards. No auth.

#### `/[storeSlug]` — Store Page (`app/[storeSlug]/page.tsx` + `StorePageClient.tsx`)
- Server wrapper calls `fetchStore()` with menu-first fallback to scan-pay
- `StorePageClient`: `'use client'`
  - Veg-only filter state
  - Menu search via `useMenuSearch`
  - Scroll-based category nav
  - Real-time availability via `useOrderSocket` (Socket.IO `menu:item-availability`)
  - Shows `<KitchenChatDrawer>` (dynamic import, `ssr: false`) for table customers
  - Renders `<ScanPayPage>` when `!store.hasMenu`
  - `StoreContextProvider` syncs store to `cartStore` via `setStore(store.slug)`

#### `/[storeSlug]/cart` (`app/[storeSlug]/cart/page.tsx`)
- Client component
- Quantity `+`/`-` steppers
- Remove item
- Coupon application via `validateCoupon()`
- Bill summary: subtotal, GST, discount, tip, total
- Empty state
- Validates via `validateCart()` before navigating to checkout

#### `/[storeSlug]/checkout` (`app/[storeSlug]/checkout/page.tsx`)
- Order type: `dine_in`, `takeaway`, `delivery`
- Delivery address form + geolocation (`navigator.geolocation`)
- Tip selector: 0%, 5%, 10%, 15% of subtotal
- Donation toggle
- Wallet balance display
- Coupon input
- Schedule for later (datetime-local input)
- Payment methods: Razorpay, per-app UPI (PhonePe/GPay/Paytm), pay-at-counter
- Offline: calls `queueOrder()` then navigates to `/order/queued`

#### `/[storeSlug]/order/[orderNumber]` (`app/[storeSlug]/order/[orderNumber]/page.tsx`)
- Socket.IO + exponential backoff polling for status
- Coins credit on `completed` via `creditCoins()`
- Push notification banner
- Auto-opens rating modal on `completed`
- Shows: `<LoyaltyWidget>`, `<GoogleMapsReviewCTA>`, `<ShareButton>`, receipt/dispute/cancel modals

#### `/[storeSlug]/order/queued` (`app/[storeSlug]/order/queued/page.tsx`)
- Reads queue count from IndexedDB
- Listens for `ORDER_SYNCED` ServiceWorker message

#### `/[storeSlug]/pay` (`app/[storeSlug]/pay/page.tsx`)
- Amount entry with quick amounts: 100, 200, 500, 1000
- Coin earn preview
- Requires login before proceeding

#### `/[storeSlug]/pay/checkout` (`app/[storeSlug]/pay/checkout/page.tsx`)
- Razorpay + NFC (`<NfcPayButton>`)
- Shows wallet balance
- Redirects if no amount in query param

#### `/[storeSlug]/pay/confirm/[paymentId]` (`app/[storeSlug]/pay/confirm/[paymentId]/page.tsx`)
- Scan & Pay success confirmation
- Credits coins via `creditScanPayCoins(paymentId)`

#### `/[storeSlug]/history` (`app/[storeSlug]/history/page.tsx`)
- Store-level order history
- Reorder flow with store-conflict modal
- Uses `getOrder(orderNumber)` for full details on reorder

#### `/[storeSlug]/bill` (`app/[storeSlug]/bill/page.tsx`)
- Live bill view
- Split-bill: 2–10 people via `<SplitBillModal>`
- `paidCount` tracker
- Share bill link/text
- Checkout CTA

#### `/[storeSlug]/schedule` (`app/[storeSlug]/schedule/page.tsx`)
- Standalone schedule page
- 7-day date picker
- 30-min slot grid based on `store.operatingHours`
- Sets `scheduledFor` in `cartStore`

#### `/[storeSlug]/reserve` (`app/[storeSlug]/reserve/page.tsx` + `ReservationClient.tsx`)
- Server wrapper calls `getAvailability()` to get time slots
- Multi-step: date → party size → time slots → contact → notes → confirmation
- ICS calendar download
- Calls `createReservation()`

#### `/[storeSlug]/staff` (`app/[storeSlug]/staff/page.tsx` + `StaffDashboardClient.tsx`)
- Server wrapper fetches `WaiterCallRecord[]` via `getActiveCalls()`
- PIN gate: 4-digit PIN derived from `storeSlug`
- Waiter call polling: 8s interval
- Acknowledge/resolve actions via `updateCallStatus()`

#### `/[storeSlug]/receipt/[orderNumber]` (`app/[storeSlug]/receipt/[orderNumber]/page.tsx`)
- Print-friendly receipt
- WhatsApp/email send
- `window.print()` on desktop
- Shows: subtotal, GST, discount, tip, donation, total

#### `/orders` (`app/orders/page.tsx` + `OrderHistoryClient.tsx`)
- Protected (auth required)
- Global paginated order history: 10 per page
- Skeleton loading states
- Reorder to cart
- Filter by store

#### `/profile` (`app/profile/page.tsx` + `ProfileClient.tsx`)
- Protected
- Editable: name
- Read-only: phone
- Push notification toggle
- Language toggle: EN / HI
- Sign-out
- Stats: total orders, total spent, member since

#### `/wallet` (`app/wallet/page.tsx` + `WalletClient.tsx`)
- Server component checks `rez-auth` cookie for `isLoggedIn: false`, redirects to `/?login=1`
- Balance card with tier display: bronze / silver / gold / platinum
- Transaction history with pagination (20 per page)
- "How coins work" explainer

#### `/search` (`app/search/page.tsx` + `SearchResultsClient.tsx`)
- Debounced 300ms query
- Category filters: all / restaurant / cafe / bakery / salon / spa / retail
- Pagination: 9 per page
- AbortController for request cancellation

#### `/offline` (`app/offline/page.tsx`)
- Offline page with `<ReloadButton>`

---

## 2. Component Inventory

### Shared / UI

**`components/ui/Button.tsx`**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  asChild?: boolean;
}
```
- forwardRef
- Loading spinner state

**`components/ui/Modal.tsx`**
```typescript
interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}
```
- Focus trap
- Body scroll lock
- Focus restoration on close
- Escape key to close

**`components/menu/MenuItem.tsx`**
```typescript
interface MenuItemProps {
  item: MenuItem;
  storeSlug: string;
  onAddToCart: (item: MenuItem, quantity: number, customizations?: MenuCustomization[]) => void;
  isAvailable?: boolean;
}
```
- Listens to Socket.IO `menu:item-availability` events
- Inline `+`/`-` stepper for items with no customizations
- Opens `<CustomizationModal>` for items with `customizations.length > 0`
- Real-time sold-out toggle when `isAvailable === false`

**`components/checkout/PaymentOptions.tsx`**
- Razorpay primary payment option
- Per-app UPI grid: PhonePe, GPay, Paytm, generic UPI
- Pay-at-counter option
- Uses `useRazorpay` hook

**`components/checkout/SplitBillModal.tsx`**
```typescript
interface SplitBillModalProps {
  open: boolean;
  onClose: () => void;
  totalPaise: number;
  onSplit: (splits: BillSplit[]) => void;
}
interface BillSplit {
  person: number;
  amountPaise: number;
  isPaid: boolean;
}
```
- Splits 2–10 people
- Remainder absorbed by first person
- Per-person amount display with paid/unpaid state

**`components/checkout/ScheduleModal.tsx`**
```typescript
interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSchedule: (isoDatetime: string) => void;
  operatingHours?: OperatingHours;
}
```
- `formatScheduledTime(isoDatetime: string): string`
- Today / Tomorrow tabs
- 30-min slot grid
- Next-available slot indicator
- Outputs ISO datetime string

**`components/store/StoreCard.tsx`**
- Used in search results
- Shows: logo, name, type, address, rating, delivery badge

**`components/loyalty/LoyaltyWidget.tsx`**
- Stamp card display
- Redeem CTA

**`components/reviews/GoogleMapsReviewCTA.tsx`**
- Triggered after order completion
- Links to Google Maps review for the store

**`components/notifications/PushPromptBanner.tsx`**
- Auto-dismisses after 10 seconds
- Calls `subscribeToPush()` on accept

**`components/dining/KitchenChatDrawer.tsx`**
- Dynamic import (`ssr: false`)
- Staff-customer real-time chat
- Uses Socket.IO

**`components/payment/NfcPayButton.tsx`**
- Chrome Android NFC tap-to-pay
- Reads NDEF on NFC tap

**`components/modals/RatingModal.tsx`**
- Star rating (1–5)
- Comment textarea
- Submit via `rateOrder()`

**`components/modals/CancelModal.tsx`**
- Reason selection
- Confirm via `cancelOrder()`

---

## 3. State Management (Zustand)

### `lib/store/authStore.ts`

```typescript
interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role?: string;
  isOnboarded?: boolean;
  referralCode?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
  setSession: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  clearSession: () => void;
}
```

- `persist` middleware, but only `user` and `isLoggedIn` are persisted
- Tokens stored separately in `localStorage` via `lib/api/client.ts`: `rez_access_token`, `rez_refresh_token`
- `setSession` also calls `setTokens()` from client.ts
- `clearSession` also calls `clearTokens()` from client.ts

### `lib/store/cartStore.ts`

```typescript
interface CartItem {
  itemId: string;
  name: string;
  price: number;       // paise: base + customizationTotal
  basePrice: number;   // paise
  quantity: number;
  customizations: MenuCustomization[];
  customizationTotal: number; // paise
  isVeg: boolean;
}

interface CartState {
  storeSlug: string | null;
  tableNumber: string | null;
  items: CartItem[];
  groupOrderId: string | null;
  scheduledFor: string | null;
  setStore: (slug: string, tableNumber?: string) => void;
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string, customizations?: MenuCustomization[]) => void;
  updateQuantity: (itemId: string, quantity: number, customizations?: MenuCustomization[]) => void;
  clearCart: () => void;
  setGroupOrderId: (id: string) => void;
  setScheduledFor: (dt: string) => void;
  totalItems: () => number;
  subtotal: () => number;
}
```

- `persist` middleware, key: `'rez-cart'`
- Deduplication key: `cartKey(itemId, customizations)` sorts `customizationGroups` and `selectedOptions` before stringifying
- `totalItems()` and `subtotal()` are derived (no state, computed)
- When `storeSlug` changes (different store), clears cart first

### `lib/store/uiStore.ts`

```typescript
interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UIState {
  loginModalOpen: boolean;
  loginModalCallback: string | null;  // URL to redirect after login
  toastMessage: ToastMessage | null;
  toastType: 'success' | 'error' | 'info';
  showLoginModal: (callbackUrl?: string) => void;
  hideLoginModal: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
}
```

- No `persist` — ephemeral UI state only

---

## 4. Hook Inventory

### `lib/hooks/useOrderSocket.ts`

```typescript
function useOrderSocket(
  orderNumber: string,
  onStatusChange: (status: WebOrderStatus) => void
): { isConnected: boolean }
```

- Connects to `NEXT_PUBLIC_SOCKET_URL`
- Joins Socket.IO room `store-<storeId>`
- Listens for `web-order:status-update` events
- 5 reconnect attempts
- `onStatusChange` called when status updates arrive
- Returns `{ isConnected: boolean }`

### `lib/hooks/useOrderPolling.ts`

```typescript
function useOrderPolling(
  orderNumber: string,
  onStatusChange: (order: WebOrder) => void,
  enabled?: boolean
): void
```

- Exponential backoff: `[2000, 4000, 8000, 16000, 30000]` ms
- Max 20 attempts
- Stops polling on `['completed', 'cancelled']` statuses
- Falls back when Socket.IO not connected
- Calls `getOrder()` per poll

### `lib/hooks/useRazorpay.ts`

```typescript
interface RazorpayOptions {
  key: string;
  amount: number;        // paise
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: { color: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

function useRazorpay(): {
  ready: boolean;
  loadFailed: boolean;
  openPayment: (options: RazorpayOptions) => void;
}
```

- Dynamically loads `https://checkout.razorpay.com/v1/checkout.js`
- `ready` becomes `true` once script loads
- `loadFailed` set on error

### `lib/hooks/useMenuSearch.ts`

```typescript
function useMenuSearch(categories: MenuCategory[]): {
  query: string;
  setQuery: (q: string) => void;
  results: MenuCategory[];
  isSearching: boolean;
}
```

- Debounced client-side filter
- Matches `item.name` and `item.description` (case-insensitive, partial)
- Returns filtered `MenuCategory[]` with filtered `MenuItem[]` per category

---

## 5. Utils Inventory

### `lib/utils/currency.ts`

```typescript
function formatINR(paise: number): string          // "₹45.00"
function formatINRCompact(paise: number): string  // "₹1.2K" etc.
function roundUpRupees(paise: number): number      // rounds to nearest rupee
```

### `lib/utils/storeType.ts`

```typescript
interface StoreUICopy {
  addToCartLabel: string;
  orderConfirmMessage: string;
  preparingMessage: string;
  readyMessage: string;
  itemLabel: string;
  categoryLabel: string;
}
function getUICopy(storeType: StoreType): StoreUICopy
```

- Per-store-type messaging for the 8 `StoreType` values

### `lib/utils/cn.ts`

```typescript
function cn(...inputs: ClassValue[]): string
```

- Classname merger: handles strings, objects, arrays, falsy values

### `lib/utils/upi.ts`

```typescript
interface UPILinkParams {
  pa: string;        // UPI ID
  pn?: string;       // Payee name
  am?: string;       // Amount
  cu?: string;       // Currency (default INR)
  mam?: string;      // Minor unit amount
  tr?: string;       // Transaction ref
  tn?: string;       // Transaction note
  mc?: string;       // Merchant category
  mode?: string;     // Mode (UPI, IMPS, NEFT)
  purpose?: string;
}

interface UPILinks {
  phonePe: string;
  gpay: string;
  paytm: string;
  generic: string;
}

function buildUPILinks(params: UPILinkParams): UPILinks
function isUPIAvailable(): boolean    // Android or iOS only
function openUPIApp(url: string, fallbackUrl?: string, timeoutMs?: number): void
```

### `lib/utils/offlineQueue.ts`

```typescript
// IndexedDB: "rez-now-offline", store: "pending-orders"
interface QueuedOrder {
  id: string;
  storeSlug: string;
  payload: object;
  createdAt: string;
  retryCount: number;
}

function queueOrder(storeSlug: string, payload: object): Promise<string>   // returns id
function getPendingOrders(): Promise<QueuedOrder[]>
function removeOrder(id: string): Promise<void>
function incrementRetry(id: string): Promise<void>  // auto-removes at MAX_RETRIES=3
function getQueueCount(): Promise<number>
function registerBackgroundSync(): Promise<void>     // SW sync tag "sync-orders"
```

### `lib/utils/share.ts`

```typescript
function shareViaWhatsApp(text: string): void
function shareContent(opts: { title: string; text: string; url: string }): Promise<void>
  // Web Share API → clipboard fallback → WhatsApp fallback
function buildStoreShareMessage(storeName: string, storeSlug: string, referralCode?: string): string
function buildOrderShareMessage(storeName: string, orderNumber: string, amountPaise: number): string
```

### `lib/utils/pushNotifications.ts`

```typescript
function subscribeToPush(): Promise<PushSubscription>
function unsubscribeFromPush(): Promise<void>
function urlBase64ToUint8Array(base64String: string): Uint8Array
```

- POSTs subscription to `/api/notifications/push-subscribe`

### `lib/push/webPush.ts`

```typescript
// DUPLICATE: posts to different endpoint
function subscribeToPush(): Promise<PushSubscription>
// POSTs to /api/web-ordering/push/subscribe
```

- Posts to `/api/web-ordering/push/subscribe` instead of `/api/notifications/push-subscribe`

### `lib/analytics/events.ts`

```typescript
interface TrackParams {
  event: string;
  userId?: string;
  properties?: Record<string, unknown>;
}

function track(params: TrackParams): void
  // Fire-and-forget POST to NEXT_PUBLIC_ANALYTICS_URL/api/events
  // Uses keepalive: true

function useTrack(): (params: Omit<TrackParams, 'userId'>) => void
  // Hook that auto-fills userId from authStore
```

Events tracked: `store_viewed`, `menu_item_viewed`, `add_to_cart`, `remove_from_cart`, `cart_viewed`, `checkout_started`, `payment_initiated`, `order_placed`, `order_completed`, `coupon_applied`, `login_started`, `login_completed`, `scan_pay_initiated`, `scan_pay_completed`

---

## 6. API Clients

### `lib/api/client.ts`

```typescript
// Two Axios instances
publicClient: AxiosInstance   // base: NEXT_PUBLIC_API_URL, no auth
authClient: AxiosInstance      // auto-attaches Bearer token

// 401 interceptor: auto-refreshes via publicClient.post('/auth/token/refresh', { refreshToken })
// Queue pattern: concurrent 401s share a single refresh promise

// Token storage
setTokens(accessToken: string, refreshToken: string): void
clearTokens(): void

// In-flight GET deduplication
deduplicatedGet<T>(url: string): Promise<T>

// Dispatches CustomEvent 'rez:session-expired' on unrecoverable auth failure
```

### API Files

| File | Exports |
|------|---------|
| `lib/api/auth.ts` | `sendOtp(phone, countryCode?, channel?)`, `verifyOtp(phone, otp, countryCode?)`, `verifyPin(phone, pin, countryCode?)`, `refreshToken(token)` |
| `lib/api/store.ts` | `getStoreMenu(storeSlug)`, `getScanPayStore(storeSlug)`, `callWaiter(storeSlug, tableNumber)`, `requestBill(storeSlug, tableNumber)` |
| `lib/api/orders.ts` | `getOrder(orderNumber)`, `cancelOrder(orderNumber)`, `rateOrder(orderNumber, rating, comment)`, `submitFeedback(orderNumber, feedback)`, `getOrderHistory()`, `getLoyaltyStamps(storeSlug)`, `sendReceipt(orderNumber, via)`, `creditCoins(orderNumber)`, `setOrderStatus(orderNumber, status)` |
| `lib/api/cart.ts` | `validateCart(storeSlug, items)`, `validateCoupon(couponCode, storeSlug, subtotal)`, `getAvailableCoupons(storeSlug)` |
| `lib/api/payment.ts` | `createRazorpayOrder(payload: CreateOrderPayload)`, `verifyPayment(orderNumber, response)`, `addTip(orderNumber, tipAmount)`, `splitBill(storeSlug, total, splitCount)` |
| `lib/api/wallet.ts` | `getWalletBalance() → WalletBalance`, `getWalletTransactions(page?, limit?)` |
| `lib/api/search.ts` | `searchStores(q, limit?, page?)`, `getFeaturedStores()` — native `fetch`, not Axios |
| `lib/api/profile.ts` | `getProfile()`, `updateProfile({ name })` |
| `lib/api/orderHistory.ts` | `getOrderHistory(page?, limit?)` — paginated version for `/orders` |
| `lib/api/reservations.ts` | `getAvailability(storeSlug, date)`, `createReservation(storeSlug, payload)` |
| `lib/api/scanPayment.ts` | `createScanPayOrder(storeSlug, amountPaise)`, `verifyScanPayment(paymentId, response)`, `creditScanPayCoins(paymentId)` |
| `lib/api/delivery.ts` | `checkDelivery(storeSlug, lat, lng)` |
| `lib/api/cancellation.ts` | `cancelOrder(orderNumber, reason)` |
| `lib/api/reorder.ts` | `prefillCartFromOrder(orderNumber, storeSlug)` — calls `useCartStore.getState()` directly |
| `lib/api/waiter.ts` | `callWaiter(storeSlug, tableNumber, reason?)`, `getWaiterCallStatus(requestId)` |
| `lib/api/waiterStaff.ts` | `getActiveCalls(storeSlug)`, `updateCallStatus(requestId, status)` |
| `lib/api/reviews.ts` | `getStoreReviews(storeSlug)` |
| `lib/api/loyalty.ts` | `getLoyaltyStatus(storeSlug)`, `redeemStamps(storeSlug)` |
| `lib/api/coupons.ts` | `getStoreCoupons(storeSlug)`, `calculateCouponDiscount(coupon, subtotal)` |

---

## 7. Types (`lib/types/index.ts`)

### Core Types

```typescript
type StoreType = 'restaurant' | 'cafe' | 'cloud_kitchen' | 'retail' | 'salon' | 'hotel' | 'service' | 'general'

type WebOrderStatus = 'pending_payment' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
```

### `StoreInfo`

```typescript
interface StoreInfo {
  id: string; name: string; slug: string;
  logo?: string; banner?: string;
  address?: string; phone?: string;
  storeType: StoreType;
  hasMenu: boolean; isProgramMerchant: boolean;
  estimatedPrepMinutes?: number;
  gstEnabled: boolean; gstPercent?: number;
  isOpen: boolean; nextChangeLabel?: string;
  operatingHours?: OperatingHours;
  socialLinks?: SocialLinks;
  gstNumber?: string; fssaiNumber?: string;
  googlePlaceId?: string;
  rewardRules?: RewardRule[];
  activePromos?: Promo[];
  deliveryEnabled: boolean; deliveryRadiusKm?: number; deliveryFee?: number;
  reservationsEnabled: boolean; maxTableCapacity?: number;
}
```

### `WebOrder`

```typescript
interface WebOrder {
  orderNumber: string; status: WebOrderStatus;
  items: OrderItem[]; subtotal: number; gst: number;
  tip: number; donation: number; discount: number; deliveryFee: number; total: number;
  tableNumber?: string; orderType: 'dine_in' | 'takeaway' | 'delivery';
  deliveryAddress?: Address;
  storeSlug: string; storeName: string;
  createdAt: string; updatedAt: string;
  rating?: number;
}
```

### `WalletBalance`

```typescript
interface WalletBalance {
  coins: number;
  rupees: number;   // calculated: coins / 100
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}
```

### `WalletTransaction`

```typescript
interface WalletTransaction {
  id: string; type: 'credit' | 'debit';
  amount: number;   // coins
  description: string;
  createdAt: string;
}
```

### `MenuCategory`, `MenuItem`, `MenuCustomization`

Standard nested menu structure with `customizationGroups[]` and `selectedOptions[]`.

### `CartItem`, `RazorpayOrderResponse`, `RazorpaySuccessResponse`, `CouponValidateResponse`, `AvailableCoupon`, `SplitBillResponse`, `GroupOrder`

As documented in the Cart and Payment sections.

---

## 8. i18n (`messages/`)

Both `en.json` and `hi.json` share 24 namespaces:

| Namespace | Description |
|-----------|-------------|
| `common` | Shared UI strings |
| `nav` | Navigation labels |
| `store` | Store display strings |
| `cart` | Cart labels and messages |
| `checkout` | Checkout flow |
| `delivery` | Delivery address and options |
| `payment` | Payment method labels |
| `order` | Order tracking labels |
| `auth` | Login/OTP strings |
| `waiter` | Waiter call strings |
| `staff` | Staff dashboard |
| `loyalty` | Loyalty stamps and rewards |
| `scan` | Scan & Pay |
| `reviews` | Rating and review |
| `coupon` | Coupon application |
| `search` | Search interface |
| `orders` | Order history |
| `push` | Push notification prompts |
| `cancel` | Cancellation flow |
| `hours` | Operating hours |
| `profile` | Profile settings |
| `errors` | Error messages |
| `reservation` | Table reservation |

Configuration in `i18n.ts` and `i18n/request.ts`. Locale detection and routing handled by `next-intl/middleware` with `localePrefix: 'never'`, `defaultLocale: 'en'`, supported locales `['en', 'hi']`.

---

## 9. Middleware (`middleware.ts`)

```typescript
const PROTECTED_PATHS = ['/profile', '/orders', '/wallet', '/checkout'];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  // 1. Run i18n routing first (next-intl locale detection)
  const i18nResponse = handleI18n(request);
  if (i18nResponse.status !== 200) return i18nResponse;

  // 2. Auth guard on protected paths
  if (isProtectedPath(pathname)) {
    const token =
      request.cookies.get('rez_access_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.redirect(new URL('/?login=1', request.url));
    }
  }

  return i18nResponse;
}

export const config = {
  matcher: ['/((?!_next|api|static|.*\\..*).*)'],
};
```

- Uses `next-intl/middleware` with `localePrefix: 'never'` — locale is never exposed in URLs
- Auth token check: `rez_access_token` cookie **or** `Authorization: Bearer` header
- Unauthenticated access to protected paths redirects to `/?login=1`
- Matcher excludes `_next`, `api`, `static`, and files with extensions

---

## 10. Service Worker (`public/sw.js`)

- Caches: app shell (HTML, CSS, JS), Google Fonts, placeholder images
- `CACHE_NAME = 'rez-now-v1'`
- `offline.html` fallback for navigation failures
- **Background Sync**: registers sync event `'sync-orders'` — replays queued orders from IndexedDB
- **Push Notifications**: `push` event handler using VAPID public key via `PushManager`
- `notificationclick` event: focuses or opens relevant store URL
- **`message` event**: listens for `ORDER_SYNCED` to notify the queued order page

Offline flow:
1. Checkout offline → `queueOrder()` saves to IndexedDB `rez-now-offline`
2. `registerBackgroundSync()` registers SW sync tag `'sync-orders'`
3. When online, SW replays queued orders
4. `ORDER_SYNCED` message posted to all clients
5. Queued page updates its count from IndexedDB

---

## 11. PWA Manifest (`public/manifest.json`)

- `name`: "REZ Now"
- `short_name`: "REZ"
- `start_url`: `/`
- `display`: `standalone`
- `background_color`: `#ffffff`
- `theme_color`: `#4f46e5` (indigo-600)
- `orientation`: `portrait`
- `icons`: PNG/WebP at 72, 96, 128, 144, 152, 192, 384, 512
- `categories`: `['food', 'shopping']`
- Related apps: Android intent for `reznow://`

---

## 12. Key Architectural Notes

### Auth Token Flow
Tokens are stored in `localStorage` (via `setTokens`/`clearTokens` in `client.ts`). The `authStore` persists only `user` and `isLoggedIn`. Both `middleware.ts` and `app/wallet/page.tsx` check for auth via their respective mechanisms.

### Two `getOrderHistory()` Implementations
- `lib/api/orders.ts`: non-paginated — used by store-level history (`/history`)
- `lib/api/orderHistory.ts`: paginated — used by global order history (`/orders`)

### Two `subscribeToPush()` Implementations
- `lib/utils/pushNotifications.ts`: posts to `/api/notifications/push-subscribe`
- `lib/push/webPush.ts`: posts to `/api/web-ordering/push/subscribe`

### Socket.IO Rooms
- `store-<storeId>`: for `web-order:status-update` and `menu:item-availability` events
- `order-<orderNumber>`: for `web-order:status-update` (order-level)

### Store Sync on Route Change
`StoreContextProvider` calls `cartStore.setStore(store.slug)` on mount. If the new `storeSlug` differs from the existing one, `cartStore.clearCart()` is triggered automatically.

### Polling vs Socket
- `useOrderPolling` is the fallback when Socket.IO is not connected
- Both `useOrderPolling` and `useOrderSocket` are used on the order tracking page
- `MenuItem` components also use Socket.IO directly for availability updates
