# SA6: Consumer App State/Data Flow Report
Generated: 2026-04-12 | Branch: audit/recovery-phase

---

## PROVIDER NESTING ORDER (from AppProviders.tsx)

```
1. ErrorBoundary
2. QueryClientProvider (TanStack Query)
3. AuthProvider                         ← EAGER
   4. IdentityHydrator                  ← fires fetchIdentityFromProfile on auth
   5. WalletPrefetcher                  ← seeds TanStack Query cache
   6. DeferredWallet (WalletProvider)   ← EAGER (0ms)
      7. DeferredGamification           ← 500ms delay
         8. LocationProvider            ← EAGER
            9. DeferredSocket           ← 2000ms delay ← CREATES RACE CONDITIONS
               10. DeferredCart         ← EAGER (0ms)
                   11. ThemedNavigation (screens)
```

**Providers NEVER MOUNTED (fall back to empty Zustand stores):**
- `NotificationProvider` — defined, never in AppProviders
- `ProfileProvider` — defined, never in AppProviders
- `WishlistProvider` — defined, never in AppProviders

---

## CONTEXT INVENTORY

| Context | State | API Service | Socket-updated | In tree? |
|---------|-------|-------------|----------------|----------|
| `AuthContext` | `user, isLoading, isAuthenticated, token` | `authApi` | No | ✅ Root |
| `WalletContext` | `walletData, rezBalance, totalBalance, availableBalance, brandedCoins` | `walletApi.getBalance()` | ✅ `coins:awarded`, `wallet:updated` | ✅ Eager |
| `CartContext` | `items[], totalItems, totalPrice, appliedCardOffer, dineInContext` | `cartApi` (full CRUD) | No (offline queue) | ✅ Eager |
| `GamificationContext` | `achievements[], coinBalance{}, challenges[], dailyStreak` | `achievementApi`, `pointsApi`, `challengesApi`, `coinSyncService` | Indirect via syncCoinsFromWallet | ✅ 500ms delay |
| `SocketContext` | `socket, state{connected, reconnecting, reconnectAttempts}` | socket.io-client | Self | ✅ 2000ms delay |
| `LocationContext` | `currentLocation, locationHistory[], permissionStatus` | `locationService` | No | ✅ Eager |
| `PriveContext` | `dashboard, eligibility, programConfig, tier, hasAccess` | `priveApi` | No | ✅ Prive routes only |
| `NotificationContext` | `settings, isLoading` | `userSettingsApi` | Via 5-min poll | ❌ NEVER MOUNTED |
| `ProfileContext` | `user, completionStatus, isModalVisible` | `authApi.updateProfile()` | No | ❌ NEVER MOUNTED |
| `WishlistContext` | `wishlistItems[], isLoading` | `wishlistApi` | Socket (stock) | ❌ NEVER MOUNTED |

---

## CRITICAL BUGS

### BUG-1: Three Contexts Never Mounted — Empty Data on App Start
- `NotificationProvider`, `ProfileProvider`, `WishlistProvider` are defined but never added to `AppProviders`
- Fall back to Zustand stores that **start empty and have no auto-fetch on auth**
- `expo-notifications` `shouldShowAlert/shouldPlaySound` handler is set INSIDE `NotificationProvider.useEffect` — since provider never mounts, **push notification behavior is never configured**
- Files: `utils/setup/AppProviders.tsx`, `contexts/NotificationContext.tsx`, `contexts/ProfileContext.tsx`, `contexts/WishlistContext.tsx`

### BUG-2: Wallet Error State Invisible to Users
- `WalletContextType` has no `error` field
- When `walletApi.getBalance()` throws, error goes to Sentry only — user sees `rezBalance: 0` silently
- Affects 46 screens reading wallet context
- File: `contexts/WalletContext.tsx`

### BUG-3: 2-Second Socket Delay Creates Race Condition
- `DeferredSocket` delays `SocketProvider` by 2000ms
- Screens mounting before socket connects get `noopUnsubscribe` — real-time callbacks silently never fire
- Affects: wishlist stock updates, loyalty point events, order tracking, coin awards in first 2s
- No re-subscribe mechanism after socket connects in most screens

### BUG-4: Coin Balance Has 3 Owners — Only 1 is Socket-Updated
| Source | Socket-updated | Risk |
|--------|----------------|------|
| `WalletContext.rezBalance` | ✅ Yes | Authoritative |
| `GamificationContext.state.coinBalance.total` | Indirect only | Diverges during local mutations |
| `ProfileContext.user.wallet.balance` | ❌ No | Permanently stale after socket events |
- Profile screen shows stale balance; wallet screen shows live balance — same user, different numbers

### BUG-5: `GamificationContext.coinBalance.spent` Incorrectly Inferred
- `syncCoinsFromWallet()` infers `coinBalance.spent = totalBalance - availableBalance`
- This is wrong when `totalBalance` includes pending rewards not yet cleared from available
- `lifetimeEarned` and `lifetimeSpent` are hardcoded to `0` (backend doesn't expose them)
- File: `contexts/GamificationContext.tsx:338-348`

### BUG-6: Payment Success Does Not Clear Cart (Deep Link Path)
- `useCheckout.ts` clears cart after successful checkout — correct for normal flow
- `payment-success.tsx` reached via Razorpay callback/deep link never calls `cartActions.clearCart()`
- User sees stale items in cart after payment via callback
- File: `app/payment-success.tsx`

### BUG-7: ProfileContext Fetches Wallet Independently from WalletContext
- When `authUser.wallet.balance` appears empty, `ProfileContext` calls `walletApi.getBalance()` independently
- This copy is stored in local `walletOverride` state and **never receives socket updates**
- File: `contexts/ProfileContext.tsx:164-182`

### BUG-8: Orders Screen Has No Socket Listener
- `WalletContext` listens for `ORDER_LIST_UPDATED` socket event but orders screen doesn't subscribe
- Orders list is stale if another session changes order status
- File: `app/orders/index.tsx`

### BUG-9: Loyalty Redemption Doesn't Refresh Wallet
- After `redeemReward()`, WalletContext.rezBalance is NOT refreshed
- Coin balance shows old value until next wallet poll/socket event
- File: `hooks/useLoyaltyRedemption.ts`

### BUG-10: `GamificationContext` Silently Swallows All Fetch Errors
- `Promise.all` wraps each fetch in `.catch(() => {})` — if achievements, challenges, or coins all fail, `isLoading` goes false but no error is dispatched
- Consumer screens see empty data with no error indicator
- File: `contexts/GamificationContext.tsx:392-435`

---

## STALE DATA BUGS SUMMARY

| ID | File | Mutation | State Refreshed? | Risk |
|----|------|----------|-----------------|------|
| SD-001 | `app/payment-success.tsx` | Payment complete | Cart NOT cleared | Stale cart after deep-link payment |
| SD-002 | `contexts/GamificationContext.tsx:338` | Wallet socket update | GamificationContext infers incorrectly | Wrong coin balance display |
| SD-003 | `contexts/ProfileContext.tsx:164` | Socket wallet update | ProfileContext wallet NOT updated | Stale balance on profile screen |
| SD-004 | `stores/wishlistStore.ts` | App start | No auto-fetch on auth | Empty wishlist on every cold start |
| SD-005 | `contexts/NotificationContext.tsx` | App start | No auto-fetch (provider never mounted) | Empty notification settings |
| SD-006 | `app/BookingsPage.tsx` | External booking cancel | No socket listener | Stale bookings |
| SD-007 | `app/orders/index.tsx` | Socket order update | Orders screen doesn't listen | Stale order statuses |
| SD-008 | `contexts/CartContext.tsx:1041` | Apply coupon failure | Cart state not rolled back | Stale price until reload |

---

## DATA FLOW DIAGRAMS

### Wallet Feature
```
walletApi.getBalance() → WalletContext.fetchWallet()
  → transformWalletResponse() → walletData state
  → walletStore._setFromProvider() (Zustand fallback)
  → 46 screens via useWalletContext() / useRezBalance selectors

Socket: coins:awarded / wallet:updated → refreshWallet()
Error: goes to Sentry only — UI shows rezBalance: 0 silently
```

### Cart Feature
```
cartApi.getCart() → CartContext.loadCart() → cartReducer
  → cartStore._setFromProvider() (Zustand fallback)
  → cart.tsx (useCart), checkout.tsx (useCartActions)

Mutation: addItem → dispatch ADD_ITEM (optimistic) → API → loadCart() (server sync)
Failure: offlineQueueService.addToQueue()
Post-payment: useCheckout clears cart (normal flow only — not deep-link path)
```

### Orders Feature
```
ordersApi.getOrders() → local useState (no context, no store)
  → app/orders/index.tsx (useFocusEffect → loadOrders)
  → app/orders/[id].tsx (standalone)
  → app/tracking/[orderId].tsx (socket subscribeToOrder)

No shared state. No socket on list screen. Stale on external status changes.
```

### Notifications Feature
```
NotificationProvider: NEVER MOUNTED
notificationStore: starts with settings: null
expo-notifications handler: NEVER CONFIGURED (lives inside unmounted provider)

Data loads only when screen explicitly calls refreshSettings()
Push notification configuration (shouldShowAlert, shouldPlaySound): INACTIVE
```
