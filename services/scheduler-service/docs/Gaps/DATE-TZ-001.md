# DATE-TZ-001: Date/Timezone Handling & Correlation ID Issues

**Date, timezone, and ID generation issues**
**Services:** All services
**Audit Source:** Date/Timezone Sweep Agent

---

## CRITICAL (2)

### DATE-001: `Math.random()` Used for Correlation IDs — Security Violation

**File:** Multiple services — `requestId` / `correlationId` generation

```typescript
const correlationId = `req_${Math.random().toString(36).substring(2)}`;
```

`Math.random()` is **not cryptographically secure**. Correlation IDs generated this way are predictable. An attacker who observes one correlation ID can predict subsequent IDs and correlate their requests across time.

This is a security audit violation. All correlation ID generation must use `crypto.randomBytes()` or `crypto.randomUUID()`.

**Impact:** Request traceability can be spoofed. Logs can be polluted by predictable correlation IDs. Compliance audit trails can be manipulated.

---

### DATE-002: `toLocaleDateString()` Without Explicit Timezone

```typescript
new Date(timestamp).toLocaleDateString('en-IN');
// Output: "16/04/2026" — uses LOCAL browser/server timezone
// User in US sees: "15/04/2026" (one day behind)
```

All `toLocaleDateString()` calls across services lack explicit timezone:

```typescript
.toLocaleDateString('en-IN')           // Missing TZ
.toLocaleDateString('en-US')           // Missing TZ
.toLocaleString()                       // Missing TZ
.toISOString().split('T')[0]            // OK (UTC)
moment(date).format('DD/MM/YYYY')       // Moment without TZ
```

**Impact:** Date displays differ between server and client timezones. Date-based filters (e.g., "today's orders") return different results on server vs client. Analytics dashboards show wrong dates for international users.

---

## HIGH (3)

### DATE-003: Cron Jobs Without Timezone Suffix — Server TZ Dependency

```typescript
cron.schedule('0 9 * * *', () => {
  // Runs at 9:00 AM SERVER TIME, not UTC or IST
});
```

No timezone specification on `node-cron` schedules. All cron jobs run at whatever timezone the server is configured in. If the server migrates to a different region, all scheduled jobs shift by the timezone difference.

**Impact:** Daily batch jobs (offer refresh, karma expiry, settlement) run at unpredictable times relative to business hours. A server in `America/Los_Angeles` runs 9 AM PST = 10:30 PM IST. Settlement jobs that should run at midnight IST run at 12:30 PM PST instead.

---

### DATE-004: `new Date()` Parsing of Client Timestamps — Ambiguous Input

```typescript
const date = new Date(req.body.timestamp);
```

Client-supplied ISO 8601 strings like `"2026-04-16"` are parsed as UTC midnight. But if the client sends `"2026-04-16T09:00"` without a Z suffix, Node.js may interpret it as local time, creating ±N hours offset.

**Impact:** Order timestamps, review timestamps, and check-in times differ between client log and server DB by the server's UTC offset.

---

### DATE-005: No `createdAt` Consistency Between Server Time and DB Write

MongoDB `timestamps: true` sets `createdAt` at server write time. Client-side code also sets `createdAt` from `Date.now()`. If the two run on different servers (unlikely now, but in multi-region future), `createdAt` could differ from the server timestamp by milliseconds.

More critically: some endpoints receive a `timestamp` from the client and write it as-is, bypassing the schema's `timestamps: true`.

---

## MEDIUM (3)

### DATE-006: TTL Indexes Without Explicit TTL on Date Fields

TTL indexes are set on `expiresAt` fields with different expiration interpretations:

```typescript
// Service A
{ expiresAt: 1 }, { expireAfterSeconds: 0 }
// TTL deletes when expiresAt < now

// Service B
{ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }
// TTL on createdAt with 7-day TTL
```

If `expiresAt` is computed as `createdAt + duration`, DST transitions can cause off-by-one-hour or off-by-one-day drift.

---

### DATE-007: Duration Math Without Moment/date-fns — Manual Day Calculations

```typescript
const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
```

Manual millisecond math ignores leap seconds, leap years, and DST transitions. For long durations (>30 days), drift accumulates.

---

### DATE-008: Date Display Format Inconsistent Across UIs

| Location | Format |
|---------|--------|
| Backend API responses | ISO 8601 (`2026-04-16T09:30:00.000Z`) |
| Merchant app | `DD/MM/YYYY HH:mm` |
| Consumer app | `MMM 16, 2026` |
| Admin dashboard | `04/16/2026 9:30 AM` |
| Notification templates | `16th April 2026` |

No canonical date format standard. Frontend components each implement their own formatting.

---

## Status Table

| ID | Severity | Issue | Est Fix |
|----|----------|-------|---------|
| DATE-001 | CRITICAL | Math.random() for correlation IDs | 30m |
| DATE-002 | CRITICAL | toLocaleDateString without timezone | 2h |
| DATE-003 | HIGH | Cron jobs without TZ suffix | 1h |
| DATE-004 | HIGH | new Date() on ambiguous client timestamps | 1h |
| DATE-005 | HIGH | createdAt inconsistency server vs client | 1h |
| DATE-006 | MEDIUM | TTL index DST drift | 1h |
| DATE-007 | MEDIUM | Manual duration math without date library | 2h |
| DATE-008 | MEDIUM | Date display format inconsistent | 2h |
