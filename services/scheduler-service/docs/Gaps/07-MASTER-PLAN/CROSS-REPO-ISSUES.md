# CROSS-REPO Issues — Fix Once, Affects Multiple

**Date:** 2026-04-16
**Scope:** Issues that span multiple codebases and require a shared fix

---

## CR-1: No Shared API Client — Auth Headers Not Injected

**Appears in:** Rendez Admin (RZ-A-C1), Admin app (Gen 1-7)
**Fix:** Create `src/lib/api.ts` (or `src/lib/apiClient.ts`)

```typescript
// Rendez Admin: src/lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';

export async function adminFetch(path: string, options: RequestInit = {}) {
  const adminKey = typeof window !== 'undefined'
    ? sessionStorage.getItem('rendez_admin_key')
    : '';
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminKey}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  return res.json();
}
```

Then replace all `fetch()` calls with `adminFetch()`.

---

## CR-2: TanStack Query Key Factories Missing

**Appears in:** Consumer app, Merchant app, Admin app, Rendez App
**Fix:** Create `src/utils/queryKeys.ts`

```typescript
// Shared across all apps
export const queryKeys = {
  // Wallet
  wallet: { balance: ['wallet-balance'] as const },
  gifts: {
    all: ['gifts'] as const,
    byTab: (tab: string) => ['gifts', tab] as const,
    received: ['gifts', 'received'] as const,
    sent: ['gifts', 'sent'] as const,
  },
  // Matches
  matches: ['matches'] as const,
  messages: (matchId: string) => ['messages', matchId] as const,
  // Plans
  plans: { feed: (explore: string) => ['plans-feed', explore] as const },
  // Discovery
  discover: ['discover'] as const,
  // Profile
  profile: {
    me: ['profile-me'] as const,
    byId: (id: string) => ['profile', id] as const,
  },
};
```

Then use: `queryClient.invalidateQueries({ queryKey: queryKeys.gifts.byTab(tab) })`

---

## CR-3: Enum Validation Inconsistent

**Appears in:** Rendez Backend, Karma Service, ReZ Backend
**Fix:** Create shared validation helper

```typescript
// src/utils/validateEnum.ts
export function toEnum<T extends string>(
  val: unknown,
  allowed: readonly string[]
): T | undefined {
  return typeof val === 'string' && allowed.includes(val)
    ? (val as T)
    : undefined;
}

export function validateEnum<T extends string>(
  val: unknown,
  allowed: readonly string[],
  errorMessage: string
): T {
  const result = toEnum<T>(val, allowed);
  if (!result) throw new Error(errorMessage);
  return result;
}
```

---

## CR-4: Redis as Sole Source of Truth

**Appears in:** Rendez Backend (booking-match), Karma Service, ReZ Backend
**Fix:** DB table as source of truth, Redis as cache

```typescript
// Source of truth: DB
const booking = await MeetupBooking.findOne({ bookingId });
if (!booking) throw new Error('Booking not found');

// Cache in Redis (optional, with short TTL)
await redis.setex(`booking:${bookingId}`, 3600, booking.matchId);

// Validation from DB, not Redis
if (booking.matchId !== matchId) {
  throw new Error('Booking does not belong to this match');
}
```

---

## CR-5: TanStack Query Installed But Never Initialized

**Appears in:** Rendez Admin
**Fix:** Wrap app in `QueryClientProvider`

```typescript
// src/app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            staleTime: 30000,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// src/app/layout.tsx
import { Providers } from './providers';
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## CR-6: Color Tokens Hardcoded Everywhere

**Appears in:** Consumer, Merchant, Admin, Rendez apps
**Fix:** Shared design tokens in `packages/rez-ui`

```typescript
// packages/rez-ui/src/theme/tokens.ts
export const colors = {
  brand: {
    primary: '#7C3AED',
    secondary: '#4f46e5',
  },
  status: {
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
} as const;
```

---

## CR-7: No Shared API Contract Types

**Appears in:** All apps, all services
**Fix:** `packages/shared-types/src/api/`

```typescript
// packages/shared-types/src/api/wallet.ts
export interface WalletBalanceResponse {
  balance: number;
  currency: string;
  lastUpdated: string;
}

export interface GiftResponse {
  id: string;
  amountPaise: number;
  giftType: 'COIN' | 'MERCHANT_VOUCHER';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}
```

---

## CR-8: Socket.IO Reconnection Pattern Inconsistent

**Appears in:** Consumer, Merchant, Rendez App
**Fix:** Shared `useRealtime.ts` hook

```typescript
// packages/rez-ui/src/hooks/useRealtime.ts
export function useRealtime<T>(
  url: string,
  options: {
    eventName: string;
    onMessage: (data: T) => void;
    reconnectAttempts?: number;
  }
) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io(url, {
      reconnectionAttempts: options.reconnectAttempts ?? 5,
      reconnectionDelay: 2000,
    });

    socketRef.current.on('connect', () => setConnected(true));
    socketRef.current.on('disconnect', () => setConnected(false));
    socketRef.current.on(options.eventName, options.onMessage);
    socketRef.current.on('error', (err) => console.warn('[WS] Error:', err));

    return () => {
      socketRef.current?.off('connect');
      socketRef.current?.off('disconnect');
      socketRef.current?.off(options.eventName);
      socketRef.current?.off('error');
      socketRef.current?.disconnect();
    };
  }, [url, options.eventName]);

  return { connected, socket: socketRef.current };
}
```

---

## CR-9: Referral Code Stored But Never Consumed

**Appears in:** Rendez App (RZ-M-S1), Consumer App
**Fix:** Wire `pending_referral_code` to profile creation

```typescript
// In ProfileSetupScreen.tsx — after successful profile creation:
const pendingCode = await SecureStore.getItemAsync('pending_referral_code');
if (pendingCode) {
  try {
    await referralAPI.apply(pendingCode);
    await SecureStore.deleteItemAsync('pending_referral_code');
  } catch (err) {
    console.warn('Referral code failed:', err);
  }
}
```

---

## CR-10: No Shared `expo-secure-store` TTL / Refresh

**Appears in:** Consumer, Merchant, Rendez App
**Fix:** Shared auth store with refresh token flow

```typescript
// packages/rez-ui/src/stores/authStore.ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const REFRESH_KEY = 'refresh_token';
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function setTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  await SecureStore.setItemAsync(
    `${TOKEN_KEY}_expires`,
    String(Date.now() + TOKEN_TTL)
  );
}

export async function getValidToken(): Promise<string | null> {
  const expiresStr = await SecureStore.getItemAsync(`${TOKEN_KEY}_expires`);
  if (!expiresStr) return null;
  const expires = parseInt(expiresStr, 10);
  if (Date.now() < expires) {
    return SecureStore.getItemAsync(TOKEN_KEY);
  }
  // Token expired — use refresh token
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refresh) return null;
  const newTokens = await authAPI.refresh(refresh);
  await setTokens(newTokens.accessToken, newTokens.refreshToken);
  return newTokens.accessToken;
}
```

---

## CR-11: Inline Styles Everywhere

**Appears in:** Admin, Merchant, Consumer, Rendez
**Fix:** Shared `packages/rez-ui` component library

See CR-6 — same shared token approach applies.

---

## CR-12: Duplicate Queue Definitions

**Appears in:** Rendez Backend
**Fix:** Single `src/jobs/queue.ts`

```typescript
// Delete src/workers/giftExpiryWorker.ts queue definitions
// Keep only src/jobs/queue.ts as the single source
```

---

## CR-13: Duplicate FraudService Instantiation

**Appears in:** Rendez Backend
**Fix:** Singleton pattern

```typescript
// src/services/FraudService.ts
export class FraudService {
  private static instance: FraudService;
  static getInstance(): FraudService {
    if (!FraudService.instance) {
      FraudService.instance = new FraudService();
    }
    return FraudService.instance;
  }
}
```

---

## CR-14: OrderStatus Enum Completely Fragmented (Gen 10)

**Appears in:** Merchant App (7 locations), Consumer App (Gen 1-7), Backend
**Fix:** Create `shared/constants/orderStatus.ts`

| Location | Values | Problem |
|----------|--------|---------|
| `types/api.ts` (canonical) | placed, confirmed, preparing, ready, out_for_delivery, delivered, cancelled, cancelling, refunded | CORRECT |
| `app/orders/live.tsx` | pending, confirmed, preparing... | MISSING placed, EXTRA pending |
| `app/(dashboard)/aggregator-orders.tsx` | pending, accepted, preparing, ready... | DIFFERENT set |
| `app/kds/index.tsx` | new, preparing, ready | SHORT list |
| Consumer App (Gen 1-7) | TBD | Needs audit |

**Fix:** Extract to `shared/constants/orderStatus.ts`, update all 7+ import locations.

---

## CR-15: Offline Architecture Non-Transactional Across All Apps

**Appears in:** Merchant App (Gen 10), Consumer App (Gen 1-7)
**Pattern:** Idempotency key assigned AFTER SQLite INSERT → crash = double-charge

**Merchant App specific:**
- `services/offlinePOSQueue.ts:58` — `clientTxnId` assigned after INSERT
- `services/offline.ts:124` — no duplicate detection in queue
- `services/offlinePOSQueue.ts:260` — failed bills silently dropped after 5 retries
- `services/offlinePOSQueue.ts:232` — batch sync not atomic

**Consumer App (Gen 1-7):** TBD — check `docs/Bugs/MERCHANT-APP-BUGS.md`

**Fix:** Create shared `offlineQueue` utility with:
1. Generate idempotency key BEFORE INSERT
2. Per-bill ACK (not batch)
3. Dead letter with user notification
4. Duplicate detection before enqueue

---

## CR-16: Real-Time Features Dead Across Multiple Apps

**Merchant App (Gen 10):** `SocketContext.emit()` calls non-existent `getSocket()`. ALL socket events silently dropped.

**Consumer App (Gen 1-7):** TBD — check for SocketService issues

**Fix (Merchant App):** Add `getSocket()` to SocketService, persist `queueEvent()` to AsyncStorage.

---

## CR-17: Wallet Balance Unit Mismatch (Gen 10)

**Appears in:** Merchant App
**Issue:** `balance.available * 100` displayed → 100x inflation. `formatRupees()` divides by 100, but API already returns rupees.

**Consumer App:** TBD — check if same mismatch exists in consumer wallet display

**Fix:** Determine API unit (rupees vs paise), fix display accordingly. Add unit annotation to type.
