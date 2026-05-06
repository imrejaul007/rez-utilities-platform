# CRITICAL-006: Admin Cron Jobs Use Consumer JWT Auth — Any User Can Fire Admin Jobs

## Severity: P0 — Security / Privilege Escalation

## Date Discovered: 2026-04-16
## Phase: Phase 7 — Security Validation

---

## Issue Summary

Admin-only cron job endpoints (settlement, reports, cleanup) use the same JWT authentication as consumer endpoints. Any authenticated user can trigger administrative operations by calling these endpoints directly.

---

## Affected Services

| Service | Impact |
|---------|--------|
| `rez-backend` (monolith) | Admin cron jobs accessible to all users |

---

## Code Reference

**File:** `rezbackend/rez-backend-master/src/routes/admin.ts`

```typescript
// Uses consumer auth middleware — same JWT as regular user endpoints
router.post('/api/admin/run-settlement',
  requireAuth,  // ← Same middleware as consumer routes
  async (req, res) => {
    // Admin-only logic runs here
    await runSettlementForAllMerchants();
  }
);

router.post('/api/admin/cleanup-old-orders',
  requireAuth,  // ← Same middleware — any user can call
  async (req, res) => {
    await cleanupOrders();
  }
);
```

Compare with correct pattern:
```typescript
router.post('/api/admin/run-settlement',
  requireAdminAuth,  // ← Separate admin-only middleware
  async (req, res) => { /* ... */ }
);
```

---

## Impact

- Any authenticated user can trigger merchant settlements
- Any user can initiate order cleanup operations
- Report generation can be abused
- Potential for data destruction if cleanup endpoints are called repeatedly
- Privilege escalation from `user` to `admin`

---

## Root Cause

The admin routes were created by copy-pasting consumer route patterns. The `requireAuth` middleware was used instead of a role-checking middleware like `requireAdminAuth`.

---

## Verification

```bash
# Any user with a valid consumer JWT can call admin endpoints
curl -X POST https://api.rez.money/api/admin/run-settlement \
  -H "Authorization: Bearer <consumer-jwt>" \
  # Returns 200 instead of 403
```

---

## Fix Required

1. Create an admin-specific auth middleware:
   ```typescript
   async function requireAdminAuth(req, res, next) {
     const token = extractToken(req);
     const decoded = jwt.verify(token, process.env.JWT_SECRET);

     if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
       return res.status(403).json({ error: 'Admin access required' });
     }

     req.user = decoded;
     next();
   }
   ```

2. Replace all admin cron route middleware:
   ```typescript
   router.post('/api/admin/run-settlement',
     requireAdminAuth,  // ← Now enforced
     async (req, res) => { /* ... */ }
   );
   ```

3. Add IP allowlisting for cron job triggers:
   ```typescript
   const ALLOWED_IPS = process.env.ADMIN_CRON_ALLOWED_IPS?.split(',') || [];
   if (!ALLOWED_IPS.includes(req.ip)) {
     return res.status(403).json({ error: 'IP not allowed' });
   }
   ```

4. Use a separate service token for machine-to-machine cron calls instead of JWT

---

## Related Gaps

- [CRITICAL-004-karma-auth-404](CRITICAL-004-karma-auth-404.md) — Auth middleware problems
- [CRITICAL-011-internal-service-key-unvalidated](CRITICAL-011-internal-service-key-unvalidated.md) — Same pattern of missing validation
