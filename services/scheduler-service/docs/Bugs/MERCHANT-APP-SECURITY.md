# Merchant App — Security Issues

> **Audit date:** 2026-04-15
> **Bugs found:** 25
> **Status:** Open — merchant app security audit

---

### MA-SEC-001 Token Stored in Plain Text in AsyncStorage (Native)
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/utils/authStorage.ts:110-123
**Category:** security
**Description:** On Android with SecureStore unavailable, tokens fall back to AsyncStorage which is not encrypted. Plain-text token readable by any app with READ_EXTERNAL_STORAGE.
**Impact:** Rooted devices: token easily extracted; APK reverse-engineered to read AsyncStorage; complete account compromise.
**Fix hint:** Always require SecureStore; fail explicitly if unavailable on native. Never fall back to unencrypted AsyncStorage for tokens on Android.
**Status:** Fixed in commit (2026-04-15) — Added explicit requirement for SecureStore on native; throws error if unavailable for auth tokens

### MA-SEC-002 Sensitive Data Logged in Development
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/services/authApi.ts:13-17, 298-300
**Category:** security
**Description:** `devLog.log/warn/error()` calls may log user phone, email, OTP placeholder (`'*****'`) but merchant data could be logged if error occurs. Logs visible in Logcat/NSLog.
**Impact:** Rooted devices: sensitive data readable in system logs; developer builds shipped with logging enabled; PII exposure.
**Fix hint:** Remove all `devLog` calls on production builds; use Sentry for errors only; sanitize error messages.

### MA-SEC-003 JWT Token Not Validated After Deserialization
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/services/api/auth.ts:39-44
**Category:** security
**Description:** Token stored without verifying signature or expiration. Malicious server or MITM can inject expired/forged tokens.
**Impact:** Attacker can craft JWT with arbitrary claims; merchant accepts fake token; unauthorized access.
**Fix hint:** Use `jwt-decode` to verify token structure; validate `exp` claim client-side; reject if expired or malformed.
**Status:** Deferred — Requires jwt-decode library addition and token expiration tracking (depends on MA-AUT-023)

### MA-SEC-004 No SSL/TLS Pinning
**Severity:** HIGH
**File:** Services/apiClient across merchant app
**Category:** security
**Description:** API client uses standard HTTPS without SSL pinning. MITM attack possible if device certificate store compromised or user behind intercepting proxy.
**Impact:** MITM attacker can intercept merchant tokens and session data; complete account compromise.
**Fix hint:** Implement SSL pinning using cert hash or public key hash; use libraries like `react-native-ssl-pinning`; pin production API certificate.

### MA-SEC-005 No Root/Jailbreak Detection
**Severity:** MEDIUM
**File:** Merchant app initialization
**Category:** security
**Description:** App does not detect rooted Android or jailbroken iOS. Rooted devices can inject code, hook functions, or extract tokens.
**Impact:** Malware can hook auth functions; tokens extracted from SecureStore; app behavior modified without user awareness.
**Fix hint:** Implement root detection using `expo-jailbreak-detection` or native checks; warn user or deny access on rooted devices.

### MA-SEC-006 Passwords Visible in Memory Longer Than Necessary
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/account/change-password.tsx:81-112
**Category:** security
**Description:** Password state `formData.currentPassword` and `formData.newPassword` held in memory after submit. Could be accessed via React DevTools or memory dump.
**Impact:** Rooted devices can dump app memory; password string recoverable; merchant account compromised.
**Fix hint:** Clear password from state immediately after API call; use `SecureField` component that clears on unmount; consider native password handling.

### MA-SEC-007 No Clipboard Cleanup After Password Paste
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/account/change-password.tsx
**Category:** security
**Description:** If merchant pastes password from clipboard, it remains in system clipboard until overwritten. Attacker app can read clipboard.
**Impact:** If merchant pastes password, malicious app reads clipboard and obtains password; clipboard cleared only when user clears it.
**Fix hint:** After paste detected, schedule clipboard clear: `setTimeout(() => Clipboard.setString(''), 3000)`.

### MA-SEC-008 No Screenshot Prevention
**Severity:** MEDIUM
**File:** Auth screens (login, password change, 2FA)
**Category:** security
**Description:** App allows screenshots on auth screens. Screenshots of OTP, password, 2FA codes could be captured by malware or visible in Recent Apps.
**Impact:** Malware captures screenshot of OTP during registration; attacker completes registration; account takeover.
**Fix hint:** Set `FLAG_SECURE` on Android and `UIImagePickerController.disableDuplicates` on iOS for auth screens; use libraries like `react-native-screens`.

### MA-SEC-009 No Biometric Fallback Protection
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/app/account/two-factor-auth.tsx:75-99
**Category:** security
**Description:** 2FA can be disabled without re-authentication. Attacker can toggle 2FA off to gain permanent access.
**Impact:** If device unlocked or compromised, attacker disables 2FA; merchant cannot re-enable without password.
**Fix hint:** Require password or biometric re-auth before disabling 2FA; show confirmation with 2FA code verification.

### MA-SEC-010 No Rate Limiting on API Calls
**Severity:** MEDIUM
**File:** apiClient.ts, services
**Category:** security
**Description:** No client-side or server-side rate limiting. Malicious merchant or compromised app can spam API endpoints.
**Impact:** API quota exhausted; legitimate requests blocked; DoS attack possible.
**Fix hint:** Implement client-side rate limiting (max N requests per minute per endpoint); server-side limits enforce hard cap.

### MA-SEC-011 Hardcoded API Base URL Possible in Build
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/services/apiClient.ts:104-126
**Category:** security
**Description:** API URL from env var `EXPO_PUBLIC_API_BASE_URL` but if missing, defaults to `localhost:5001`. Dev builds may hardcode localhost.
**Impact:** Release build accidentally points to localhost dev server; merchant data sent to wrong endpoint; data leak.
**Fix hint:** Fail loudly if API URL not set in production; embed URL at build time; use separate .env files per environment.

### MA-SEC-012 No Input Validation on Profile Fields
**Severity:** MEDIUM
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/services/api/auth.ts:171-189
**Category:** validation
**Description:** updateProfile accepts arbitrary JSON from merchant without validation. Could send XSS, SQL injection, or malicious scripts.
**Impact:** Merchant inputs malicious data (e.g., `ownerName: "<img src=x onerror=alert('XSS')>"`); backend stores and renders in admin panel; XSS.
**Fix hint:** Validate profile fields client-side (length, type, regex); sanitize on backend before storage.

### MA-SEC-013 No Merchant KYC Verification Validation
**Severity:** HIGH
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/app/onboarding/
**Category:** validation
**Description:** Onboarding collects KYC docs (ID, bank details, business reg) but no validation of document authenticity or anti-spoofing checks.
**Impact:** Fraudulent merchant provides fake docs; system accepts; fraudulent account created; chargebacks and money laundering risk.
**Fix hint:** Implement OCR-based document verification; use third-party KYC service (e.g., IDology, Jumio); flag suspicious documents for manual review.

### MA-SEC-014 No Bank Account Verification
**Severity:** CRITICAL
**File:** /sessions/admiring-gracious-gauss/mnt/ReZ Full App/rezmerchant/rez-merchant-master/app/onboarding/bank-details.tsx
**Category:** validation
**Description:** Bank account collected but not verified. Merchant can enter arbitrary IFSC/account number; payouts go to wrong account.
**Impact:** Settlements routed to attacker's account instead of merchant; merchant never receives funds; fraudster collects payments.
**Fix hint:** Implement micro-deposit verification (send 2 small deposits, merchant confirms amounts); validate IFSC/account against NPCI NACH.
**Status:** Deferred — Requires integration with NPCI NACH and micro-deposit service (backend feature)

### MA-SEC-015 No PII Encryption in Transit Beyond TLS
**Severity:** MEDIUM
**File:** Services across app
**Category:** security
**Description:** PII (phone, email, bank account, IFSC) sent as JSON over TLS but no additional encryption. TLS downgrade or MITM reads fields.
**Impact:** TLS 1.0 downgrade attack; attacker reads bank details; account takeover or fraud.
**Fix hint:** Implement field-level encryption (AES-256-GCM) for bank account, IFSC, phone; encrypt before JSON.

### MA-SEC-016 No Secure Delete of Sensitive Files
**Severity:** MEDIUM
**File:** delete-account.tsx:112-115 (FileSystem.writeAsStringAsync)
**Category:** security
**Description:** When merchant exports data to file, no secure delete after sharing. File remains in cache or Downloads folder.
**Impact:** Merchant exports sensitive data; file left in Downloads; another app/user on shared device reads merchant data.
**Fix hint:** Use `expo-secure-store` or native secure delete; wipe file from disk after sharing; encrypt file on disk.

### MA-SEC-017 No API Versioning Enforcement
**Severity:** MEDIUM
**File:** apiClient.ts
**Category:** security
**Description:** API calls don't include version header. Server could change response format and break auth without notice.
**Impact:** Backend changes break merchant app; authentication fails unexpectedly; no backward compatibility.
**Fix hint:** Add `X-API-Version: v1` header to all requests; validate response structure before using.

### MA-SEC-018 No Request Signing (HMAC)
**Severity:** MEDIUM
**File:** All API requests
**Category:** security
**Description:** Requests not signed with HMAC-SHA256. Attacker can replay requests or modify fields without detection.
**Impact:** Request tampering possible (e.g., change withdrawal amount); replay attack; MITM modifies response.
**Fix hint:** Sign all requests with server-shared secret using HMAC-SHA256; include signature in `X-Signature` header; server validates.

### MA-SEC-019 No Backend Request Timeout Enforcement
**Severity:** MEDIUM
**File:** services
**Category:** security
**Description:** API requests may hang indefinitely. Malicious server or network issue causes request to block forever.
**Impact:** App freezes; user forced to force-quit; DOS attack possible by intentional hang.
**Fix hint:** Set request timeout to 30s (10s for auth endpoints); abort after timeout; show "Request timed out" error.

### MA-SEC-020 No Response Size Limit
**Severity:** MEDIUM
**File:** apiClient.ts
**Category:** security
**Description:** API responses not limited by size. Malicious server can send 1GB response causing OOM crash.
**Impact:** Malicious response causes app crash; DoS attack; device memory exhaustion.
**Fix hint:** Limit response size to max 10MB; abort download if size exceeds limit; validate Content-Length header.

### MA-SEC-021 No Merchant Consent Tracking for Data Sharing
**Severity:** HIGH
**File:** Services
**Category:** security
**Description:** Marketing/analytics tracking enabled by default without explicit consent. Merchant data shared without opt-in.
**Impact:** Merchant PII shared with third parties without consent; GDPR/privacy violation; regulatory fine.
**Fix hint:** Require explicit opt-in before any data sharing; show privacy notice; implement consent management platform.

### MA-SEC-022 No Payment Data Isolation
**Severity:** CRITICAL
**File:** Services across merchant app
**Category:** security
**Description:** Merchant can view other merchants' payment data if API endpoint lacks proper authorization checks.
**Impact:** Merchant A can request data of Merchant B; revenue leakage; breach of competitive data.
**Fix hint:** Enforce user context on all API calls; validate merchantId matches authenticated user; backend must check authorization.
**Status:** Deferred — Requires backend authorization validation (API layer responsibility)

### MA-SEC-023 No Logout on App Background
**Severity:** MEDIUM
**File:** Auth context lifecycle
**Category:** security
**Description:** App does not logout when backgrounded. If merchant leaves app and hands device to someone, they can open app and access account.
**Impact:** Unattended device in background remains logged in; anyone can access merchant account and settings.
**Fix hint:** Implement AppState listener; logout on 'background' event; or require biometric on foreground if away >5 minutes.

### MA-SEC-024 No Sensitive Data Logging at Backend
**Severity:** MEDIUM
**File:** Backend services (out of scope but affects merchant)
**Category:** security
**Description:** Backend may log full request/response including tokens and PII. Logs readable by ops team or attacker if logs compromised.
**Impact:** Tokens leaked in server logs; PII exposure; insider threat.
**Fix hint:** Implement structured logging; sanitize tokens and PII before logging; use redaction library; audit log access.

### MA-SEC-025 No Defense Against Package Tampering
**Severity:** HIGH
**File:** APK/IPA distribution
**Category:** security
**Description:** App binaries not signed or verified. Attacker can tamper with APK and distribute modified version.
**Impact:** Malicious APK steals tokens; collects payment data; phishing APK distributes malware.
**Fix hint:** Sign APK with company key; implement app integrity checks (SafetyNet/Play Integrity API); warn users of unofficial sources.
