# CRITICAL-014: Media Service Static Files Served Without Authentication

## Severity: P1 — Security / Information Disclosure

## Date Discovered: 2026-04-16
## Phase: Phase 7 — Security Validation

---

## Issue Summary

The media service uses `express.static()` after the `requireInternalToken` middleware. When the middleware logs a 401, it doesn't return, so `express.static()` continues and serves the file anyway. All uploaded media files are publicly accessible.

---

## Affected Services

| Service | Impact |
|---------|--------|
| `rez-media-events` | All static files publicly accessible |

---

## Code Reference

**File:** `rez-media-events/src/http.ts:122`

```typescript
// 1. Internal token check runs
app.use('/media', requireInternalToken, (req, res, next) => {
  logger.warn('AUTH_FAILED', {
    path: req.path,
    ip: req.ip,
    token: req.headers['x-internal-token']
  });
  // ← NO return statement! Middleware continues to next()
});

// 2. express.static() serves the file anyway
app.use('/media', express.static(path.join(__dirname, '../uploads')));
//    ↑ No auth check before this — file is served
```

**Correct pattern:**
```typescript
// If auth fails, STOP and return
function requireInternalToken(req, res, next) {
  const token = req.headers['x-internal-token'];
  if (!token || !isValidToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });  // ← RETURN
  }
  next();
}
```

---

## Impact

- **All uploaded files are publicly accessible** — user photos, merchant documents, menu images, ID proofs
- **No authentication on media URLs** — anyone with the URL can download files
- **ID proof exposure** — merchant KYC documents may be publicly accessible
- **Revenue loss** — if media URLs are scraped for premium content
- **GDPR/privacy violation** — personal documents publicly available

---

## Root Cause

The middleware was written to **log** unauthorized access instead of **blocking** it. The missing `return` before the 401 response allows the request chain to continue to `express.static()`.

---

## Verification

```bash
# Upload a file and try to access it without auth
curl -I http://media-service.internal/media/user_123/profile.jpg
# Expected: 401 Unauthorized
# Actual: 200 OK with file content
```

---

## Fix Required

1. **Fix the middleware to return:**
   ```typescript
   export function requireInternalToken(req: Request, res: Response, next: NextFunction) {
     const token = req.headers['x-internal-token'];
     if (!token || !isValidToken(token)) {
       logger.warn('UNAUTHORIZED_MEDIA_ACCESS', {
         path: req.path,
         ip: req.ip,
         timestamp: new Date().toISOString()
       });
       return res.status(401).json({ error: 'Unauthorized' });  // ← ADD return
     }
     next();
   }
   ```

2. **Use a dedicated media route with proper auth:**
   ```typescript
   // Only mount static serving on authenticated routes
   app.use('/media/protected', requireInternalToken, express.static(uploadDir));

   // Public thumbnails only (if intentionally public)
   app.use('/media/thumbnails', express.static(thumbDir));
   ```

3. **Add signed URL pattern for time-limited access:**
   ```typescript
   // Generate time-limited signed URLs for media access
   app.get('/media/sign/:filename', requireAuth, (req, res) => {
     const signedUrl = generateSignedUrl(req.params.filename, 300);  // 5 min
     res.json({ url: signedUrl });
   });
   ```

---

## Related Gaps

- [CRITICAL-006-admin-cron-consumer-auth](CRITICAL-006-admin-cron-consumer-auth.md) — Missing auth return
- [CRITICAL-011-internal-service-key-unvalidated](CRITICAL-011-internal-service-key-unvalidated.md) — Same pattern of broken auth
- [CRITICAL-004-karma-auth-404](CRITICAL-004-karma-auth-404.md) — Auth bypass via different mechanism
