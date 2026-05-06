# ERR-FORMAT-001: Error Response Format Inconsistencies

**Error format issues across 9 services**
**Services:** All REST API services
**Audit Source:** Error Format Sweep Agent

---

## HIGH (3)

### ERR-FMT-001: `success: false` Missing on Karma Service Error Responses

Some karma-service error handlers return `{ error: '...' }` or `{ message: '...' }` without `success: false`.

```typescript
// Pattern used (inconsistent)
res.status(400).json({ error: 'Invalid karma amount' });

// Expected canonical format
res.status(400).json({ success: false, error: 'Invalid karma amount' });
```

All other services use `{ success: false, ... }` on errors. Karma service breaks the client-side response handler assumption.

**Impact:** Frontend error handling may treat karma-service error responses as successful responses (no `success` field = falsy = handled as error in some interceptors, but not all).

---

### ERR-FMT-002: `message` Field on Success Responses in Auth Service

Auth service returns `message` field on success responses:

```typescript
res.json({ success: true, message: 'OTP sent successfully' });
```

Other services return `{ success: true, data: { ... } }` — no `message` field on success.

Client code that destructures `{ success, data, message }` gets `message: undefined` on non-auth endpoints.

**Impact:** Generic response handler components may display `undefined` messages or throw on auth-service responses.

---

### ERR-FMT-003: Status Code / Body Mismatch — Multiple Services

| Service | Route | Status | Body |
|---------|-------|--------|------|
| karma-service | Some routes | 200 | `{ error: '...' }` |
| payment-service | Webhook | 200 | `{ success: false, ... }` |
| wallet-service | Some routes | 500 | `{ message: '...' }` |
| backend | `/api/health` | 503 | `{ status: 'ok' }` |

- Some services return HTTP 200 with `success: false` in body
- Some return HTTP error codes with `{ message: '...' }` in body
- Health endpoint returns 503 with `{ status: 'ok' }`

**Impact:** Client middleware cannot have a single error detection strategy. Must check both status code AND body field.

---

## MEDIUM (3)

### ERR-FMT-004: No Standard Error Code / Enum

Errors return freeform strings:
```typescript
{ error: 'Invalid amount' }
{ error: 'amount must be positive' }
{ error: 'INVALID_KARMA_AMOUNT' }
{ error: 'Karma amount cannot be negative or zero' }
```

No `errorCode` field. No standardized error code enum. Clients cannot programmatically handle specific error types.

---

### ERR-FMT-005: Zod/Class-Validator Validation Errors — Inconsistent Shape

Validation errors across services have different shapes:
```typescript
// Service A: flat
{ error: 'Validation failed', details: ['email must be valid'] }

// Service B: nested
{ error: 'Validation failed', errors: { email: 'Invalid email format' } }

// Service C: raw
res.status(400).json(validationError.errors)
```

Frontend form handling cannot use a single error display component.

---

### ERR-FMT-006: Stack Traces Exposed in Non-Dev Environments

Some services return full stack traces in error responses:
```typescript
res.status(500).json({ error: err.message, stack: err.stack });
```

Stack traces expose internal file paths, function names, and library versions in production.

---

## Status Table

| ID | Severity | Issue | Est Fix |
|----|----------|-------|---------|
| ERR-FMT-001 | HIGH | karma-service missing success:false on errors | 1h |
| ERR-FMT-002 | HIGH | auth-service message field on success responses | 1h |
| ERR-FMT-003 | HIGH | Status code / body semantic mismatch | 2h |
| ERR-FMT-004 | MEDIUM | No error code enum — freeform strings | 2h |
| ERR-FMT-005 | MEDIUM | Validation error shape inconsistent | 1h |
| ERR-FMT-006 | MEDIUM | Stack traces exposed in production | 30m |
