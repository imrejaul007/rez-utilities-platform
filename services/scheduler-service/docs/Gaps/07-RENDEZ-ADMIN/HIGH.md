# RENDEZ ADMIN — HIGH SEVERITY GAPS

**App:** `rendez-admin/`
**Date:** 2026-04-16
**Severity:** 7 HIGH

---

### RZ-A-H1 — Frontend Counts `checkinCount >= 2`, Backend Counts `rewardStatus === 'TRIGGERED'`

**Status:** OPEN
**Severity:** HIGH
**Impact:** Admin and backend disagree on who qualifies for meetup rewards

**File:** `src/app/meetups/page.tsx:60`

```typescript
// Frontend filter:
const qualifiedUsers = users.filter(u => u.checkinCount >= 2)

// Backend filter (meetup eligibility):
const eligibleUsers = users.filter(u => u.rewardStatus === 'TRIGGERED')

// These return different results
```

**Fix:** Align frontend to use same logic as backend:
```typescript
const eligibleUsers = users.filter(u => u.rewardStatus === 'TRIGGERED')
```

---

### RZ-A-H2 — No Pagination — 100 User Cap With No Indicator

**Status:** OPEN
**Severity:** HIGH
**Impact:** Admin cannot view more than 100 users — pagination missing

**File:** `src/app/users/page.tsx`

```typescript
// Fetches all with no limit/pagination:
const { data: users } = await supabase.from('users').select('*')
// Returns max 100 rows — no way to see more
```

**Fix:** Add pagination controls and cursor-based fetching:
```typescript
const [page, setPage] = useState(0)
const pageSize = 50
const { data: users } = await supabase
  .from('users').select('*').range(page * pageSize, (page + 1) * pageSize - 1)
```

---

### RZ-A-H3 — Every Fetch Has No `response.ok` Check — All Failures Silent

**Status:** OPEN
**Severity:** HIGH
**Impact:** API failures are completely invisible to admin users

**Files:** All pages

```typescript
// Every fetch ignores errors:
const res = await fetch(url)
const data = await res.json() // throws if res not ok
// No try/catch, no error display
```

**Fix:** Add error handling to every fetch:
```typescript
const res = await fetch(url)
if (!res.ok) {
  const err = await res.text()
  setError(`Failed to load data: ${err}`)
  return
}
const data = await res.json()
```

---

### RZ-A-H4 — Dashboard Uses LocalStorage Instead of Supabase Auth

**Status:** OPEN
**Severity:** HIGH
**Impact:** Auth state not shared with Supabase — cookies not set

**File:** `src/app/dashboard/page.tsx`

```typescript
// Stores token in localStorage:
localStorage.setItem('auth_token', token)

// Supabase expects auth in HTTP-only cookies:
const { data: { session } } = await supabase.auth.getSession()
// Returns null — auth state is empty
```

**Fix:** Use Supabase auth for session management:
```typescript
const { data: { session } } = await supabase.auth.getSession()
if (!session) signIn()
```

---

### RZ-A-H5 — Voucher Codes Shown to Users Not Eligible

**Status:** OPEN
**Severity:** HIGH
**Impact:** Users see voucher codes they can't use — broken UX

**File:** `src/app/vouchers/page.tsx`

```typescript
// Shows all vouchers regardless of eligibility:
const { data: vouchers } = await supabase.from('vouchers').select('*')
// No eligibility check before display
```

**Fix:** Filter vouchers by user eligibility:
```typescript
const { data: vouchers } = await supabase
  .from('vouchers').select('*')
  .eq('user_id', userId)
  .lte('min_order_value', user.totalSpent)
```

---

### RZ-A-H6 — Real-time Updates Not Connected to UI

**Status:** OPEN
**Severity:** HIGH
**Impact:** WebSocket connections established but UI never updates

**File:** `src/lib/socket.ts`

```typescript
// Socket connected but no event handlers update React state:
socket.on('order_update', (data) => {
  console.log('order update:', data)
  // MISSING: setOrders(prev => ...)
})
```

**Fix:** Connect socket events to React state:
```typescript
const [orders, setOrders] = useState([])
socket.on('order_update', (data) => {
  setOrders(prev => prev.map(o => o.id === data.id ? data : o))
})
```

---

### RZ-A-H7 — Booking Status Colors Inconsistent With Backend

**Status:** OPEN
**Severity:** HIGH
**Impact:** Admin sees wrong colors for booking states

**File:** `src/app/bookings/page.tsx`

```typescript
// Status to color mapping:
const statusColors = {
  pending: 'yellow',
  confirmed: 'green',
  completed: 'blue',
  cancelled: 'gray'
  // MISSING: 'executing' → blue, 'paid' → orange, 'disputed' → red
}
```

**Fix:** Add all status colors:
```typescript
const statusColors = {
  pending: 'yellow',
  confirmed: 'green',
  paid: 'orange',
  executing: 'blue',
  completed: 'blue',
  disputed: 'red',
  cancelled: 'gray',
  refunded: 'purple'
}
```
