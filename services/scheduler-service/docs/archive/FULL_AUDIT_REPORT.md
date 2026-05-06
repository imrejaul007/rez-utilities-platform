# ReZ Full App — Complete Code Audit Report
**Date:** March 22, 2026  
**Auditor:** Senior Dev Team (20-year experience deep audit)  
**Scope:** Admin App, Merchant App, Backend API  
**Total Bugs Found:** 128

---

## Summary by App

| App | Repo | CRITICAL | HIGH | MEDIUM | LOW | Total |
|-----|------|----------|------|--------|-----|-------|
| Admin | `rez-app-admin` | 3 | 8 | 19 | 1 | **33** |
| Merchant | `rez-app-marchant` | 1 | 12 | 24 | 8 | **45** |
| Backend | `rez-backend` | 2 | 9 | 30 | 9 | **50** |
| **TOTAL** | | **6** | **29** | **73** | **18** | **128** |

---

## 🔴 CRITICAL Bugs (Fix Immediately — Production Risk)

### Admin App
| ID | File | Issue |
|----|------|-------|
| ADMIN-001 | `app/_layout.tsx:70-72` | Role validation crashes if `user.role` is undefined — auth guard fails |
| ADMIN-005 | `services/api/apiClient.ts:121-142` | Token refresh retry has no abort signal — request hangs forever |
| ADMIN-009 | `services/api/auth.ts:40-50` | Frontend hardcoded role list can reject valid admins (out of sync with backend) |

### Merchant App
| ID | File | Issue |
|----|------|-------|
| MERCH-028 | `config/api.ts:6-20` | Hardcoded fallback URL routes ALL traffic to unknown server if env vars missing |

### Backend
| ID | File | Issue |
|----|------|-------|
| BACK-018 | `src/controllers/authController.ts:362-367` | OTP bypass (123xxx) active in production if NODE_ENV not set — account takeover |
| BACK-019 | `src/controllers/authController.ts:281-283` | OTP value returned in API response in dev mode — real OTP exposed to client |

---

## 🟠 HIGH Bugs

### Admin App (8)
| ID | File | Issue |
|----|------|-------|
| ADMIN-002 | `contexts/AuthContext.tsx:105-107` | useEffect stale closure — checkStoredToken recreated every render |
| ADMIN-003 | `contexts/AuthContext.tsx:162-163` | 100ms arbitrary delay doesn't guarantee storage writes complete |
| ADMIN-004 | `services/api/apiClient.ts:113` | clearTimeout called twice — resource confusion |
| ADMIN-007 | `services/api/apiClient.ts:196-227` | FormData not cleared on failure — memory leak |
| ADMIN-008 | `services/api/apiClient.ts:245-246` | Upload retry reuses consumed FormData stream — sends empty body |
| ADMIN-017 | `hooks/useAdminSocket.ts:86-96` | Socket listeners accumulate on mount/unmount cycles |
| ADMIN-019 | `services/storage.ts:37-42` | Data deleted from AsyncStorage before SecureStore write verified — data loss |
| ADMIN-029 | `config/api.ts:14-19` | Hardcoded fallback URL silently routes to wrong backend |

### Merchant App (12)
| ID | File | Issue |
|----|------|-------|
| MERCH-001 | `contexts/AuthContext.tsx:209-220` | clearInvalidTokens permanently disabled |
| MERCH-002 | `contexts/AuthContext.tsx:253-256` | checkStoredToken not in useCallback |
| MERCH-005 | `services/api/client.ts:130-145` | Refresh subscriber queue grows unbounded — memory leak |
| MERCH-006 | `services/api/client.ts:110-125` | Concurrent 401s leave queued requests hanging forever |
| MERCH-008 | `contexts/StoreContext.tsx:40-56` | loadStores/activeStore circular dependency — infinite re-render risk |
| MERCH-010 | `contexts/StoreContext.tsx:195-198` | eslint-disable hiding circular dependency bug |
| MERCH-011 | `hooks/useRealTimeUpdates.ts:48-53` | connectingRef not reset on unmount — permanently blocks reconnection |
| MERCH-012 | `hooks/useRealTimeUpdates.ts:130-160` | Duplicate socket listeners from flag set too late |
| MERCH-019 | `services/api/products.ts:100-130` | AbortController not cleaned up on error — resource accumulation |
| MERCH-022 | `hooks/useFormPersistence.ts:155-170` | Race condition between debounce and auto-save — concurrent writes |
| MERCH-039 | `contexts/AuthContext.tsx:295-315` | Concurrent refreshPermissions calls race — wrong final state |
| MERCH-044 | `services/api/client.ts:155-165` | isTokenInvalid permanently blocks all requests after one failure |

### Backend (9)
| ID | File | Issue |
|----|------|-------|
| BACK-001 | `src/server.ts:169-177` | Error handler before routes — route errors not caught |
| BACK-007 | `src/middleware/csrf.ts:114` | CSRF validates length only — malformed tokens accepted |
| BACK-011 | `src/middleware/validation.ts:36` | Passwords/tokens logged in plain text to info logs |
| BACK-022 | `src/controllers/orderCancelController.ts:70-91` | Order ownership race condition |
| BACK-024 | `src/controllers/walletPaymentController.ts:159` | Balance calculation backwards — wrong transaction history |
| BACK-030 | `src/routes/paymentRoutes.ts:56-59` | Webhook endpoints need HMAC not JWT auth |
| BACK-033 | `src/controllers/authController.ts:413` | refereeWallet declared but never used — incomplete implementation |
| BACK-034 | `src/middleware/auth.ts:204-209` | HTTP 423 for lockout breaks many clients |
| BACK-019 | `src/controllers/authController.ts:281-283` | OTP exposed in API response |

---

## 📋 All Issues by GitHub Repo

### Admin App — github.com/imrejaul007/rez-app-admin
Issues #1–#33 (ADMIN-001 through ADMIN-033)

### Merchant App — github.com/imrejaul007/rez-app-marchant  
Issues #1–#45 (MERCH-001 through MERCH-045)

### Backend — github.com/imrejaul007/rez-backend
Issues #1–#50 (BACK-001 through BACK-050)

---

## Bug Categories

| Category | Count | Notes |
|----------|-------|-------|
| React Hooks violations | 18 | Missing deps, stale closures, missing useCallback |
| Security | 12 | OTP bypass, credential logging, CSRF, hardcoded URLs |
| Memory Leaks | 10 | Event listeners, FormData, AbortController |
| Error Handling | 14 | Silent failures, swallowed errors |
| Race Conditions | 9 | Token refresh, concurrent saves, missing locks |
| TypeScript Safety | 8 | as-any casts, missing types |
| Logic Bugs | 15 | Wrong calculations, backwards conditions |
| Configuration | 12 | Hardcoded values, missing env validation |
| Database/API | 10 | Missing indexes, wrong status codes |
| Code Quality | 20 | Duplicate code, dead code, inconsistencies |

---

## Priority Fix Order

1. **BACK-018** — Remove OTP bypass ASAP
2. **BACK-019** — Stop returning OTP in response  
3. **BACK-011** — Stop logging passwords to info logs
4. **MERCH-028 / ADMIN-029** — Remove hardcoded production URLs
5. **BACK-001** — Move error handler after routes
6. **BACK-030** — Fix webhook authentication
7. **BACK-024** — Fix wallet balance calculation (financial bug)
8. **ADMIN-001** — Fix role validation null crash
9. **MERCH-006 / MERCH-044** — Fix hanging requests after 401
10. **ADMIN-019** — Fix data loss in storage migration

