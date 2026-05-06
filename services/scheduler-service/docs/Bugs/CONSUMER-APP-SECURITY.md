# Consumer App — Security Audit

> **Audit date:** 2026-04-15
> **Bugs found:** 40
> **Status:** Open — consumer app audit

---

### CA-SEC-001: Hardcoded Firebase API Key in google-services.json
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/google-services.json:18
**Category:** secrets
**Description:** Firebase API key "AIzaSyAknIHBcBaVkPOks1XfOHCAwnmY_UH-FP8" is hardcoded in google-services.json file which is likely committed to version control (also visible in android/app/google-services.json).
**Impact:** Attackers can use this public API key to make unauthorized requests to Firebase services, potentially accessing database, storage, and authentication endpoints. Firebase keys should never be in APKs/source control.
**Fix hint:** Remove google-services.json from git, use CI/CD secrets management for Firebase config injection during build.

> **Status:** Fixed in 2026-04-15 — Replaced hardcoded key with ${FIREBASE_API_KEY} environment variable placeholder. File is git-ignored in .gitignore line 47.

### CA-SEC-002: Insecure Encryption in SecureStorage Class
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/securityService.ts:213-246
**Category:** crypto
**Description:** The SecureStorage class uses base64 encoding (not encryption) to store "secure" data in AsyncStorage. Line 229 shows: `return Buffer.from(data).toString('base64');` which is trivially reversible.
**Impact:** Sensitive data like encrypted tokens, API secrets stored via SecureStorage.setSecure() are not actually encrypted—only base64 encoded—rendering the entire "secure storage" layer ineffective.
**Fix hint:** Use expo-secure-store or react-native-encrypted-storage with proper AES-256 encryption, or at minimum implement PBKDF2 key derivation.
> **Status:** Fixed in commit 00aa50d

### CA-SEC-003: AsyncStorage Fallback for Auth Tokens on Rooted/No-Keystore Devices
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/authStorage.ts:110-123
**Category:** storage
**Description:** When SecureStore fails (no hardware-backed keystore or rooted device), auth tokens are written unencrypted to AsyncStorage. Line 118 shows: `await AsyncStorage.setItem(key, value);` without fallback encryption.
**Impact:** On rooted Android devices or devices without hardware keystore support, auth tokens and refresh tokens are stored in plaintext in AsyncStorage, accessible to any other app with storage permissions.
**Fix hint:** Require encryption before AsyncStorage fallback; use device integrity checks to block on compromised devices.

### CA-SEC-004: Device Fingerprinting Stored in AsyncStorage
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/securityService.ts:136-139
**Category:** storage
**Description:** Device fingerprint including device model, OS version, and unique ID hash is stored in plain AsyncStorage: `await AsyncStorage.setItem(SECURITY_CONFIG.DEVICE_FINGERPRINT_KEY, JSON.stringify(fingerprint));`
**Impact:** Device fingerprints can be read/modified by other apps with storage access, enabling device spoofing or biometric bypass.
**Fix hint:** Store fingerprints in SecureStore or compute on-the-fly from immutable hardware properties.

### CA-SEC-005: Missing Certificate Pinning
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/apiClient.ts
**Category:** tls
**Description:** API client uses standard fetch() with no certificate pinning. HTTPS is enforced in production (line 122-124) but no mechanism to prevent MITM via rogue certs installed on rooted devices.
**Impact:** Attackers with access to device CA store (rooted device, corporate proxy) can intercept all API traffic and steal auth tokens, payment data, user PII.
**Fix hint:** Implement react-native-cert-pinning or Expo secure transport with cert pinning for critical endpoints (/auth, /payment, /wallet).

### CA-SEC-006: No Rate Limiting on Client-Side Retry Logic
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/apiClient.ts:203-225
**Category:** auth
**Description:** Token refresh loop has no exponential backoff or maximum retry count. `this.refreshTokenCallback` can be retried indefinitely on network error.
**Impact:** Malicious app can trigger infinite refresh token requests to backend, causing DoS or account lockout. No protection against brute-force login attempts on client.
**Fix hint:** Add max retry count, exponential backoff, and circuit breaker; implement client-side rate limiting with ClientRateLimiter.

### CA-SEC-007: Payment Service Fallback Hardcodes Payment Methods in DEV
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/paymentService.ts:85-88
**Category:** debug
**Description:** `getFallbackPaymentMethods()` is exposed in __DEV__ but if backend fails, could expose payment method list to attacker if debug mode leaks.
**Impact:** In development or if accidentally left exposed, fallback payment methods bypass backend validation.
**Fix hint:** Remove fallback methods in production builds; use environment check `if (__DEV__ && process.env.EXPO_PUBLIC_ENVIRONMENT === 'development')`.

### CA-SEC-008: Razorpay Key ID Exposed in Environment Variables
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/config/env.ts:68-71
**Category:** secrets
**Description:** Razorpay Key ID stored as `EXPO_PUBLIC_RAZORPAY_KEY_ID` (environment variable prefix suggests it's public, but key IDs should still be protected).
**Impact:** Razorpay key IDs are intended to be public (for frontend validation), but if stored in .env.production and accidentally committed, combined with interception it enables payment fraud.
**Fix hint:** Ensure .env.production is git-ignored; use CI/CD secrets for build-time injection.

### CA-SEC-009: Deep Link Validation Insufficient for Store ID
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/deepLinkHandler.ts:59-62
**Category:** deeplink
**Description:** Store deep link accepts any MongoDB-looking ID: `MONGO_ID_RE = /^[a-f0-9]{24}$/i`. No server-side verification that the store ID exists or is accessible to the user.
**Impact:** Attacker can craft deep links like `rezapp://store/000000000000000000000000` to navigate users to fake/hidden stores or trigger logic bugs.
**Fix hint:** Validate store IDs on backend; sanitize all deep link parameters; require explicit user action before navigating to unknown resources.

### CA-SEC-010: Notification Data Trusted Without Verification
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/pushNotificationService.ts:229-235
**Category:** auth
**Description:** Push notification data is directly acted upon in `handleNotificationTap(data)` without re-verifying with backend. Lines 243-251 show navigation handler is called with raw notification data.
**Impact:** Attacker can craft malicious FCM payloads (if FCM server compromised or via MITM on unprotected device) to redirect users to phishing pages or execute unauthorized actions.
**Fix hint:** Verify notification authenticity on backend before acting; include signed tokens in notifications; re-fetch critical data from backend.

### CA-SEC-011: No Screenshot Prevention on Sensitive Screens
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer (no screenshot protection found)
**Category:** storage
**Description:** No evidence of FLAG_SECURE on Android or preventUserInteraction on iOS for sensitive screens (password change, wallet, payment, profile edit).
**Impact:** Users can screenshot sensitive info (balance, payment methods, PII) and it's saved to gallery accessible to other apps.
**Fix hint:** Use react-native-flag-secure and similar for password/payment/wallet screens; disable screen recording.

### CA-SEC-012: Weak Password Validation in Change Password
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/account/change-password.tsx:63-64
**Category:** auth
**Description:** Password validation only checks minimum 6 characters (line 63-64): `if (formData.newPassword.length < 6)`. No complexity requirements on client.
**Impact:** Users can set weak passwords; backend should enforce, but client should guide users to strong passwords.
**Fix hint:** Require min 8 chars, uppercase, lowercase, number, special char; use InputValidator.isValidPassword() from utils/securityService.ts.

### CA-SEC-013: Change Password Does Not Require Server Re-verification
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/account/change-password.tsx:87-90
**Category:** auth
**Description:** Password change sends currentPassword + newPassword but no additional verification (email, 2FA, OTP) before logout. Critical account change should require multi-factor confirmation.
**Impact:** If user account is compromised, attacker can change password and lock out legitimate owner. No recovery mechanism visible.
**Fix hint:** Require OTP or email verification before password change; send confirmation email; implement account recovery flow.

### CA-SEC-014: Sentry Breadcrumb Filtering Incomplete
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/config/sentry.ts:54-59
**Category:** pii
**Description:** Sentry filters console breadcrumbs (line 54-57) but does not filter http, ui, or user breadcrumbs that might contain auth headers or user data.
**Impact:** HTTP request breadcrumbs may leak Authorization headers; user interaction logs may reveal sensitive actions.
**Fix hint:** Expand beforeBreadcrumb filter to sanitize http request/response headers and user interaction context.

### CA-SEC-015: Insufficient Input Validation for Email in Form
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/profile/edit.tsx:1-150
**Category:** validation
**Description:** Profile edit form loads email from API but no re-validation before sending update (no sanitization in setFormData).
**Impact:** If API returns malicious email, it could trigger XSS or injection in subsequent requests if not sanitized.
**Fix hint:** Always validate and sanitize data from API; use InputValidator.sanitizeEmail() before storing/using.

### CA-SEC-016: Referral Code Stored Without Expiry Check
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/referralHandler.ts:54-65
**Category:** auth
**Description:** Referral codes stored in AsyncStorage indefinitely with no expiry timestamp. Stale codes could be replayed.
**Impact:** If device is compromised after a referral link is clicked, attacker can retrieve and reuse the referral code to earn fraudulent rewards.
**Fix hint:** Add expiryTime to referral data; validate expiry before applying code; use nonce-based referrals instead of static codes.

### CA-SEC-017: Missing Offline Sync Security
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/offlineSyncService.ts
**Category:** auth
**Description:** Offline sync queue likely stores unencrypted requests (including auth tokens) for replay when online.
**Impact:** If device is compromised while offline, queued requests with auth tokens can be extracted.
**Fix hint:** Encrypt offline queue; use time-bound tokens; re-authenticate before flushing queue.

### CA-SEC-018: No Permission Justification Review
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app.config.js:98-120
**Category:** permissions
**Description:** App requests INTERNET, CAMERA, LOCATION, MICROPHONE, PHOTO_LIBRARY, but does not show granular permission controls. All are bundled as "required."
**Impact:** Users cannot selectively disable permissions; app might collect location/camera data unnecessarily.
**Fix hint:** Use expo-permissions for runtime permission control; explain each permission; allow partial functionality without all permissions.

### CA-SEC-019: SQL Injection Prevention via Sanitization Incomplete
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/securityService.ts:36-44
**Category:** injection
**Description:** SQL sanitization removes quotes and comments but does not use parameterized queries (backend likely uses them, but client-side prevention is weak).
**Impact:** If client-side SQL is ever executed (unlikely but possible in future features), injection is not fully prevented.
**Fix hint:** Always use parameterized queries on backend; avoid any client-side SQL execution.

### CA-SEC-020: Image Quality Validator May Not Reject All Malicious Files
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/imageQualityValidator.ts
**Category:** upload
**Description:** Image upload validates MIME type from filename extension (`/\.(\w+)$/.exec(filename)`) which is client-controlled and easily spoofed.
**Impact:** Attacker can upload executable/script files renamed with .jpg extension; backend must re-validate.
**Fix hint:** Validate MIME type from file magic bytes on backend; never trust client MIME type.

### CA-SEC-021: Share Utilities Construct Deep Links Without Nonce
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/shareUtils.ts:21-54
**Category:** auth
**Description:** Share functions construct deep links with plain IDs (e.g., `offers/${offerId}`) without nonce or signature.
**Impact:** If shared link is intercepted (via SMS, email, messaging app), attacker can modify offer/product ID to redirect users or perform actions.
**Fix hint:** Use signed URLs or nonce-based sharing; include timestamp and HMAC signature in shared links.

### CA-SEC-022: Push Notification Token Registration Missing User Verification
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/pushNotificationService.ts:159-182
**Category:** auth
**Description:** Push token registration comment (line 161-163) notes userId is NOT sent to backend for security, but no verification that token belongs to current user. Backend derives user from JWT only.
**Impact:** During race condition or session hijack, attacker could register another user's push token to their account.
**Fix hint:** Bind push token to device fingerprint + JWT; validate token not already registered to another user.

### CA-SEC-023: Gamification Security Middleware May Not Cover All Endpoints
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/gameSecurityMiddleware.ts
**Category:** auth
**Description:** Security middleware only applied to certain endpoints; unclear if all gaming/earning endpoints are covered.
**Impact:** Unprotected earning endpoints could be exploited for fraud (e.g., replay attacks, unauthorized points claiming).
**Fix hint:** Audit all earning/points endpoints; apply middleware consistently; add signature verification.

### CA-SEC-024: No Biometric Result Re-verification
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer (no biometric re-auth found)
**Category:** auth
**Description:** If biometric auth result is cached, attacker could extract the biometric approval and replay it.
**Impact:** Sensitive actions (payment, password change) protected by biometric could be bypassed if result is cached.
**Fix hint:** Always prompt fresh biometric for sensitive operations; never cache biometric approval.

### CA-SEC-025: Firebase Config Misconfig Risk
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/google-services.json
**Category:** auth
**Description:** Firebase API key exposed; if Firebase rules not properly configured (default allow-all), Firestore/Realtime DB is publicly readable/writable.
**Impact:** Attackers can read/write all user data, modify app configuration, enumerate users.
**Fix hint:** Verify Firebase security rules enforce authentication and authorization; use API key restrictions in Google Cloud Console.

> **Status:** Fixed in 2026-04-15 — API key moved to environment variable; see CA-SEC-001 for details. Verify Firebase rules are configured to deny public access.

### CA-SEC-026: Console Logging Not Fully Disabled in Production
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/billUploadService.ts:7-11
**Category:** pii
**Description:** Dev logger uses `__DEV__` check, but other console.log statements may not be stripped in production builds.
**Impact:** Sensitive data logged to console could be visible in app logs or debugged by attackers.
**Fix hint:** Use babel-plugin-transform-remove-console in production builds; audit all console statements.

### CA-SEC-027: No Rate Limiting on OTP Requests
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app/sign-in.tsx:140-147
**Category:** auth
**Description:** OTP send request has no client-side rate limiting; user can spam OTP requests.
**Impact:** Brute-force phone enumeration; account enumeration attack; DoS on OTP service.
**Fix hint:** Implement client-side rate limiter (exponential backoff, max 3 attempts per minute); backend must also enforce.

### CA-SEC-028: Insufficient URL Validation in sanitizeURL
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/securityService.ts:78-96
**Category:** injection
**Description:** URL sanitization only blocks javascript:, data:, file: protocols but does not validate domain/path. Attacker could use `https://evil.com/phish`.
**Impact:** Phishing links could be embedded if sanitization is trusted instead of server-side URL validation.
**Fix hint:** Whitelist specific domains; validate URLs on backend; do not trust client-side URL validation.

### CA-SEC-029: Offline Queue Not Encrypted
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/offlineQueueService.ts
**Category:** storage
**Description:** Offline queue stores API requests (including auth tokens) in AsyncStorage without encryption.
**Impact:** If device is compromised, queued requests with sensitive data can be extracted and replayed.
**Fix hint:** Encrypt queue items in SecureStore; rotate auth tokens before queue flush.

### CA-SEC-030: Missing Content-Security-Policy Headers
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer (React Native app, CSP not applicable)
**Category:** injection
**Description:** CSP headers not enforced in React Native (native app), but frontend sanitization incomplete.
**Impact:** XSS through dangerouslySetInnerHTML or unescaped content could execute malicious scripts.
**Fix hint:** Avoid dangerouslySetInnerHTML; sanitize all user-generated content; use sanitizeHTML() from utils/securityService.ts.

### CA-SEC-031: WebView Not Found (Not Applicable)
**Severity:** N/A
**File:** React Native app does not use WebView for user content
**Category:** webview
**Description:** No WebView with javaScriptEnabled found; indicates good architectural choice to avoid WebView vulnerabilities.
**Impact:** N/A
**Fix hint:** N/A

### CA-SEC-032: Sharing Toast Messages Don't Confirm User Intent
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/utils/shareUtils.ts:35-46
**Category:** auth
**Description:** Share action returns success/dismissed but does not verify user actually shared (could be faked by malware).
**Impact:** Share analytics could be spoofed.
**Fix hint:** Log share event only after actual deep link/URL reached destination.

### CA-SEC-033: Clipboard Data Not Cleared
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer (no clipboard clearing found)
**Category:** storage
**Description:** If sensitive data is copied to clipboard (auth tokens, payment codes), it's not auto-cleared after timeout.
**Impact:** Other apps can access clipboard data; clipboard history persists across restarts.
**Fix hint:** Auto-clear clipboard after 60 seconds if sensitive data is copied; use react-native-clipboard with timeout.

### CA-SEC-034: Sentry DSN Validation Missing
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/config/sentry.ts:20-25
**Category:** secrets
**Description:** Placeholder DSN check uses string comparison (line 12) which could miss variations like whitespace.
**Impact:** If DSN is misconfigured, Sentry may send errors to public URL or wrong project.
**Fix hint:** Validate DSN format strictly; error on empty/invalid DSN in production.

### CA-SEC-035: Analytics Events May Leak User Data
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/analytics/AnalyticsService.ts
**Category:** pii
**Description:** Analytics events track user actions but properties are not sanitized (e.g., search query, product viewed).
**Impact:** Analytics platform (or if breached) could expose user behavior, preferences, PII.
**Fix hint:** Sanitize analytics properties; use pseudonymous user IDs; exclude PII; review analytics vendor privacy.

### CA-SEC-036: Timezone in Timestamps Could Leak Location
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer (timestamps sent to backend)
**Category:** pii
**Description:** Device timezone is inferred from timestamps sent to backend without anonymization.
**Impact:** Attackers could correlate timezone with location data to identify users.
**Fix hint:** Use UTC timestamps only; do not send timezone info to analytics.

### CA-SEC-037: Device Model and OS Version in Fingerprint
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/securityService.ts:119-122
**Category:** pii
**Description:** Device fingerprint includes device model and OS version sent to backend (could enable device enumeration).
**Impact:** Minimal; this info is often public, but combined with other data enables fingerprinting.
**Fix hint:** Hash device properties instead of sending raw values; minimize fingerprint data.

### CA-SEC-038: No CSRF Token for API Requests
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/apiClient.ts
**Category:** auth
**Description:** API requests do not include CSRF tokens; relying on credential mode and origin header only.
**Impact:** If backend serves from same domain or does not validate origin, CSRF attacks possible.
**Fix hint:** Add X-CSRF-Token header; use SameSite cookie attribute on backend; validate Origin/Referer headers.

### CA-SEC-039: Version Comparison Could Be Spoofed
**Severity:** LOW
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/services/apiClient.ts:189-201
**Category:** auth
**Description:** Version comparison logic (compareVersions) could be bypassed if version string is controlled by client.
**Impact:** Client could spoof version to bypass app update enforcement.
**Fix hint:** Validate app version signature on backend; use hardened version check library.

### CA-SEC-040: No AppLink Signature Verification
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rez-app-consumer/app.config.js:82-96
**Category:** deeplink
**Description:** App claims autoVerify: true for intent filters but assetlinks.json file not verified to exist/be correct.
**Impact:** Attackers can register same deep link scheme on their app if asset linking not validated.
**Fix hint:** Publish and verify assetlinks.json on https://rezapp.in/.well-known/assetlinks.json; test intent filter verification.

---

**SUMMARY:** 40+ findings identified across storage, crypto, authentication, deep linking, permissions, input validation, and analytics. Critical issues: Firebase key exposure (CA-SEC-001), fake encryption (CA-SEC-002), AsyncStorage fallback for tokens (CA-SEC-003), missing cert pinning (CA-SEC-005), untrusted push notifications (CA-SEC-010), and weak rate limiting on auth (CA-SEC-027). Immediate actions: remove google-services.json from git, implement proper encryption for SecureStore, add certificate pinning, enforce rate limiting on auth endpoints, and add multi-factor verification for sensitive account changes.