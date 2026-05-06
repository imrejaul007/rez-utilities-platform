# SOCKET-IO-001: Socket.IO Event Naming & Connection Drift

**Socket.IO event mismatches across services**
**Services:** rez-backend, rez-consumer-app, rez-merchant-app, rez-notification-events
**Audit Source:** Socket.IO Sweep Agent

---

## CRITICAL (2)

### SOCKET-001: `messaging:new_message` Emitted, `message:received` Listened

**Emitter (backend):**
```typescript
io.to(userId).emit('messaging:new_message', { messageId, content, senderId, timestamp });
```

**Consumer (consumer app):**
```typescript
socket.on('message:received', (data) => { /* handles new messages */ });
```

Backend emits `messaging:new_message`. Consumer app listens for `message:received`. These are **different event names**. Chat messages sent from backend are silently dropped by consumer apps.

**Impact:** User-to-user messaging is completely broken. Messages are sent to the socket server but never received by clients.

---

### SOCKET-002: `@/types/socket.types` Does Not Exist — Build Blocker

**File:** `src/services/socketService.ts`

```typescript
import type { Server, Socket } from '@/types/socket.types';  // FILE DOES NOT EXIST
```

`@/types/socket.types` is imported but the file does not exist. This is a TypeScript build blocker. The service likely falls back to `any` types, eliminating type safety for all socket events.

**Impact:** All socket event payloads are untyped. Any field rename silently breaks consumers. No IDE autocomplete on socket event shapes.

---

## HIGH (4)

### SOCKET-003: Four Naming Conventions Coexist

| Convention | Example | Files |
|-----------|---------|-------|
| `namespace:event` | `messaging:new_message` | `chatRoutes.ts` |
| `event` (plain) | `order:placed` | `paymentRoutes.ts` |
| `snake_case` | `order_placed` | `orderRoutes.ts` |
| `camelCase` | `orderPlaced` | `notificationRoutes.ts` |

No enforced naming convention. Developers choose ad hoc.

**Impact:** No predictability for consumers. Event names must be reverse-engineered from server code.

---

### SOCKET-004: `notification:new` vs `notifications:new` Split

Backend emits `notification:new`. Merchant app may listen for `notifications:new` (plural).

**Impact:** Notification push events silently ignored by apps listening on the wrong event name.

---

### SOCKET-005: Merchant App — `table:assigned` Event Not Emitted

Merchant app registers handler for `table:assigned` event. Backend has no emitter for this event.

**Impact:** Table assignment push notifications never fire. Wait staff doesn't receive table assignments via push.

---

### SOCKET-006: No Acknowledgment Pattern on Critical Events

`order:placed`, `payment:success`, `wallet:debit` events are fire-and-forget. No ACK mechanism.

If a client disconnects and reconnects, it misses critical state updates. No replay or queue mechanism.

**Impact:** Clients can miss order confirmations, payment receipts, and wallet alerts on reconnect.

---

## MEDIUM (3)

### SOCKET-007: Connection Auth — No Token Validation Middleware

Socket.IO connection handler accepts connections without validating JWT in handshake.

```typescript
io.on('connection', (socket) => {  // No auth middleware
  const userId = socket.handshake.auth.userId;  // Trust without verification
});
```

Any network-accessible caller can connect as any user.

---

### SOCKET-008: Room Naming — Inconsistent User ID Format

Backend joins users to rooms using `userId` (MongoDB ObjectId). Merchant app joins using `merchantId`. Admin app uses `adminId`.

Consumers must know the ID format to join correct rooms.

---

### SOCKET-009: Heartbeat/Keepalive — No Ping Interval Configured

No `pingTimeout`/`pingInterval` configured. Default Socket.IO values apply (20s/25s).

On mobile networks with NAT timeouts, sockets may be silently dropped without reconnect.

---

## Status Table

| ID | Severity | Issue | Est Fix |
|----|----------|-------|---------|
| SOCKET-001 | CRITICAL | messaging:new_message vs message:received mismatch | 1h |
| SOCKET-002 | CRITICAL | @/types/socket.types file does not exist | 30m |
| SOCKET-003 | HIGH | Four event naming conventions coexist | 2h |
| SOCKET-004 | HIGH | notification:new vs notifications:new split | 1h |
| SOCKET-005 | HIGH | table:assigned handler but no emitter | 1h |
| SOCKET-006 | HIGH | No ACK on critical events | 2h |
| SOCKET-007 | MEDIUM | Socket auth has no JWT validation | 1h |
| SOCKET-008 | MEDIUM | Room naming inconsistent ID format | 1h |
| SOCKET-009 | MEDIUM | No ping interval / heartbeat config | 30m |
