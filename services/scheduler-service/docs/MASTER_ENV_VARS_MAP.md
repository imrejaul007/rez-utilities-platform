# MASTER ENVIRONMENT VARIABLES MAP — REZ Platform

> Last updated: 2026-04-12
> Complete registry of all environment variables across all services and apps.
> NEVER commit actual values. Use Render, Vercel, or a secrets vault.

---

## Variable Registry

### Legend

- **Required** = service will refuse to start without this
- **Optional** = service logs warning and degrades gracefully
- **Where Set** = Render (backend services), Vercel (frontend), local `.env`

---

## 1. Shared / Cross-Service Variables

These variables appear in multiple services with the same meaning.

| Variable | Required? | Example Value | Used In | Notes |
|----------|-----------|---------------|---------|-------|
| `MONGODB_URI` | Yes | `mongodb+srv://user:pass@cluster.mongodb.net/rezdb` | All services | Primary DB connection |
| `REDIS_URL` | Yes | `redis://default:pass@host:6379` | auth, wallet, payment, finance, marketing, gamification | Cache + BullMQ |
| `JWT_SECRET` | Yes | 64-char random hex | auth, wallet, payment, search, finance, merchant, monolith | Consumer JWT signing |
| `JWT_REFRESH_SECRET` | Yes | 64-char random hex | rez-auth-service, monolith | Refresh token signing |
| `JWT_ADMIN_SECRET` | Yes | 64-char random hex | rez-auth-service, monolith | Admin JWT signing |
| `JWT_MERCHANT_SECRET` | Yes | 64-char random hex | rez-auth-service, monolith | Merchant JWT signing |
| `INTERNAL_SERVICE_TOKENS_JSON` | Yes (preferred) | `{"payment":"tok1","finance":"tok2"}` | All services | Scoped inter-service auth |
| `INTERNAL_SERVICE_TOKEN` | Fallback | 64-char random hex | All services | Legacy shared token (being phased out) |
| `NODE_ENV` | No (defaults to `production`) | `production` | All services | Safety default set in server.ts |
| `PORT` | No | `4002` | All services | HTTP listen port |
| `SENTRY_DSN` | No | `https://key@sentry.io/123` | All services | Error tracking |
| `SENTRY_TRACES_SAMPLE_RATE` | No | `0.1` | All services | Sentry tracing rate |
| `CORS_ORIGIN` | No | `https://rez.money,https://admin.rez.money` | All services | Comma-separated allowed origins |

---

## 2. rez-auth-service

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `MONGODB_URI` | Yes | `mongodb+srv://...` | User collection |
| `REDIS_URL` | Yes | `redis://...` | OTP storage, PIN lockout |
| `JWT_SECRET` | Yes | — | Consumer access token |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh token |
| `JWT_ADMIN_SECRET` | Yes | — | Admin access token |
| `JWT_MERCHANT_SECRET` | Yes | — | Merchant access token |
| `OTP_HMAC_SECRET` | Yes | 64-char hex | OTP generation HMAC |
| `INTERNAL_SERVICE_TOKENS_JSON` | Yes | `{...}` | Scoped internal auth |
| `HEALTH_PORT` | No | `4102` | Sidecar health server |
| `CORS_ORIGIN` | No | `https://rez.money,...` | CORS allowed origins |
| `TWILIO_ACCOUNT_SID` | No (OTP provider) | `AC...` | SMS OTP provider |
| `TWILIO_AUTH_TOKEN` | No | — | Twilio auth |
| `TWILIO_PHONE_NUMBER` | No | `+1...` | SMS sender |
| `WHATSAPP_API_KEY` | No | — | WhatsApp OTP channel |

---

## 3. rez-wallet-service

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `MONGODB_URI` | Yes | — | Wallet + transaction models |
| `REDIS_URL` | Yes | — | Rate limiting, idempotency |
| `JWT_SECRET` | Yes | — | Consumer auth |
| `INTERNAL_SERVICE_TOKENS_JSON` | Yes | — | Internal credit/debit calls |
| `SENTRY_DSN` | No | — | Error tracking |
| `PORT` | No | `4004` | HTTP port |

---

## 4. rez-payment-service

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `MONGODB_URI` | Yes | — | Payment records |
| `REDIS_URL` | Yes | — | Nonce store (replay prevention), rate limits |
| `JWT_SECRET` | Yes | — | Consumer auth |
| `INTERNAL_SERVICE_TOKENS_JSON` | Yes | — | Internal deduct calls |
| `RAZORPAY_KEY_ID` | Optional | `rzp_live_...` | Razorpay API key (logged warning if missing) |
| `RAZORPAY_KEY_SECRET` | Optional | — | Razorpay API secret |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | — | Webhook HMAC verification |
| `WALLET_SERVICE_URL` | Yes (effectively) | `https://rez-wallet-service-36vo.onrender.com` | Internal coin credit calls |
| `ORDER_SERVICE_URL` | Optional | `https://rez-order-service.onrender.com` | Order amount verification |
| `PORT` | No | `4001` | HTTP port |
| `HEALTH_PORT` | No | `4101` | Sidecar health |

---

## 5. rez-finance-service

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `MONGODB_URI` | Yes | — | Finance transactions |
| `REDIS_URL` | Yes | — | Cache, job queues |
| `JWT_SECRET` | Yes | — | Consumer auth |
| `INTERNAL_SERVICE_TOKENS_JSON` | Yes | — | Internal service calls |
| `WALLET_SERVICE_URL` | Optional | `https://rez-wallet-service-36vo.onrender.com` | Coin award (Phase 2) |
| `FINBOX_API_KEY` | Optional | — | FinBox loan partner (stub mode if missing) |
| `PARTNER_WEBHOOK_SECRET_FINBOX` | Optional | — | FinBox webhook HMAC |
| `ORDER_SERVICE_URL` | Optional | — | User order summary |
| `PORT` | No | `4003` | HTTP port |
| `HEALTH_PORT` | No | `4103` | Sidecar health |

---

## 6. rez-search-service

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `MONGODB_URI` | Yes | — | Search index, history |
| `REDIS_URL` | Yes | — | Search cache |
| `JWT_SECRET` | Yes | — | Optional user auth |
| `WALLET_SERVICE_URL` | Optional | — | Wallet context for personalization |
| `ORDER_SERVICE_URL` | Optional | — | Order context for recommendations |
| `PORT` | No | `4006` | HTTP port |
| `HEALTH_PORT` | No | `4106` | Sidecar health |

---

## 7. rez-merchant-service

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `MONGODB_URI` | Yes | — | Merchant, store, product data |
| `JWT_SECRET` | Optional | — | Consumer JWT (if accepting consumer calls) |
| `MERCHANT_JWT_SECRET` | Yes (either/or) | — | Merchant JWT verification |
| `CORS_ALLOWED_ORIGINS` | No | `https://merchant.rez.money,...` | CORS |
| `INTERNAL_SERVICE_TOKENS_JSON` | No | — | For inbound internal calls |
| `PORT` | No | `4005` | HTTP port |
| `SENTRY_DSN` | No | — | Error tracking |
| `MSG91_API_KEY` | **Yes (production)** | — | SMS OTP delivery. Without this, merchant login returns 503 in production. |
| `MSG91_TEMPLATE_ID` | No | — | MSG91 DLT template ID for OTP messages |
| `TWILIO_ACCOUNT_SID` | No (alternative) | `AC...` | Twilio SMS OTP alternative to MSG91 |
| `TWILIO_AUTH_TOKEN` | No (alternative) | — | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | No (alternative) | `+1...` | Twilio sender number |

---

## 8. rez-marketing-service

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `MONGODB_URI` | Yes | — | Campaign, audience, analytics data |
| `REDIS_URL` | Yes | — | BullMQ campaign queue |
| `INTERNAL_SERVICE_TOKENS_JSON` | Yes | — | All routes are internal-auth gated |
| `INTERNAL_SERVICE_TOKEN` | Fallback | — | Legacy fallback |
| `BACKEND_URL` | No | `https://api.rezapp.com` | Monolith URL for user lookups |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Yes (if WhatsApp configured) | 64-char random | Meta webhook verification. Defaults to `WHATSAPP_NOT_CONFIGURED` — webhook GET challenges will fail until set. |
| `WHATSAPP_API_URL` | Yes (if WhatsApp configured) | `https://graph.facebook.com/v18.0/...` | Meta Cloud API endpoint for outbound messages |
| `WHATSAPP_API_TOKEN` | Yes (if WhatsApp configured) | — | Meta Cloud API Bearer token |
| `PORT` | No | `4000` | HTTP port |
| `SENTRY_DSN` | No | — | Error tracking |

---

## 9. rez-ads-service

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `ADS_MONGO_URI` | Yes (one of three) | — | Primary |
| `MONGO_URI` | Yes (fallback) | — | Alternative name |
| `MONGODB_URI` | Yes (fallback) | — | Alternative name |
| `JWT_SECRET` | Yes | — | Auth verification |
| `INTERNAL_SERVICE_TOKEN` | Optional | — | Internal admin routes |
| `PORT` | No | `4007` | HTTP port |

---

## 10. rez-gamification-service

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `MONGODB_URI` | Yes | — | Achievement, streak records |
| `REDIS_URL` | Yes | — | BullMQ consumer |
| `INTERNAL_SERVICE_TOKEN` | Yes | — | Internal auth middleware |
| `WALLET_SERVICE_URL` | **Yes (required)** | `https://rez-wallet-service-36vo.onrender.com` | Coin credit on achievement/milestone. Without this coins are never deposited. |
| `PORT` | No | `4008` | Health port only |

---

## 11. rez-order-service

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `MONGODB_URI` | Yes | — | Order records |
| `REDIS_URL` | Yes | — | BullMQ |
| `JWT_SECRET` | Yes | — | Auth |
| `INTERNAL_SERVICE_TOKENS_JSON` | Yes | — | Internal access |
| `PORT` | No | `4005` | HTTP (built, not deployed) |

---

## 12. REZ Backend Monolith

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `MONGODB_URI` | Yes | — | All collections |
| `REDIS_URL` | Yes | — | Cache, BullMQ, Socket.IO adapter |
| `JWT_SECRET` | Yes | — | Consumer tokens |
| `JWT_ADMIN_SECRET` | Yes | — | Admin tokens |
| `JWT_MERCHANT_SECRET` | Yes | — | Merchant tokens |
| `RAZORPAY_KEY_ID` | Yes | `rzp_live_...` | Payment gateway |
| `RAZORPAY_KEY_SECRET` | Yes | — | Payment gateway |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | — | Webhook verification |
| `CLOUDINARY_CLOUD_NAME` | Yes | — | Media upload |
| `CLOUDINARY_API_KEY` | Yes | — | Media upload |
| `CLOUDINARY_API_SECRET` | Yes | — | Media upload |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Yes | `/path/to/key.json` | Push notifications |
| `INTERNAL_SERVICE_TOKEN` | Yes | — | Service-to-service auth |
| `AUTH_SERVICE_URL` | No | `https://rez-auth-service.onrender.com` | Auth microservice |
| `WALLET_SERVICE_URL` | No | `https://rez-wallet-service-36vo.onrender.com` | Wallet microservice |
| `PAYMENT_SERVICE_URL` | No | `https://rez-payment-service.onrender.com` | Payment microservice |
| `SEARCH_SERVICE_URL` | No | `https://rez-search-service.onrender.com` | Search microservice |
| `MARKETING_SERVICE_URL` | No | `https://rez-marketing-service.onrender.com` | Marketing microservice |
| `GAMIFICATION_SERVICE_URL` | No | `https://rez-gamification-service-3b5d.onrender.com` | Gamification microservice |
| `ADBAZAAR_WEBHOOK_SECRET` | Yes (for AdBazaar) | — | HMAC webhook verify |
| `ADBAZAAR_WEBHOOK_URL` | Yes (for AdBazaar) | `https://api.adbazaar.com/webhooks/attribution` | Attribution event URL |
| `GIFT_CARD_ENCRYPTION_KEY` | **Yes** | 64-char hex | AES encryption key for gift card codes. Service throws at startup if missing in production. Generate: `openssl rand -hex 32` |
| `APP_URL` | **Yes (for WhatsApp ordering)** | `https://rez.money` | Base URL for WhatsApp payment links. Falls back to `PUBLIC_URL`. Service sends error message to customer if neither is set. |
| `SMTP_HOST` / `SMTP_PORT` | No | — | Email sending |
| `NODE_ENV` | No | `production` | Defaults to production |
| `PORT` | No | `5000` | HTTP port |
| `CORS_ORIGIN` | No | `https://rez.money,...` | CORS |

---

## 13. API Gateway (rez-api-gateway)

The gateway is nginx-based. Configuration is environment-driven.

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `MONOLITH_URL` | Yes | `https://rez-backend-8dfu.onrender.com` | Backend monolith |
| `SEARCH_SERVICE_URL` | Yes | `https://rez-search-service.onrender.com` | Search service |
| `AUTH_SERVICE_URL` | Yes | `https://rez-auth-service.onrender.com` | Auth service |
| `PAYMENT_SERVICE_URL` | Yes | `https://rez-payment-service.onrender.com` | Payment service |
| `WALLET_SERVICE_URL` | Yes | `https://rez-wallet-service-36vo.onrender.com` | Wallet service |
| `MERCHANT_SERVICE_URL` | Yes | `https://rez-merchant-service-n3q2.onrender.com` | Merchant service |
| `ORDER_SERVICE_URL` | Optional | `https://rez-order-service.onrender.com` | Order service |
| `CATALOG_SERVICE_URL` | Optional | `https://rez-catalog-service-1.onrender.com` | Catalog service |
| `MARKETING_SERVICE_URL` | Optional | `https://rez-marketing-service.onrender.com` | Marketing service |
| `GAMIFICATION_SERVICE_URL` | Optional | `https://rez-gamification-service-3b5d.onrender.com` | Gamification service |
| `MEDIA_SERVICE_URL` | Optional | — | Media events service |
| `ANALYTICS_SERVICE_URL` | Optional | `https://analytics-events-37yy.onrender.com` | Analytics service |
| `PORT` | No | `10000` | Gateway listen port |

---

## 14. Consumer App (nuqta-master)

Expo app — env vars set as Expo environment variables or in `app.config.js`.

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `EXPO_PUBLIC_API_URL` | Yes | `https://api.rezapp.com` | Backend base URL |
| `EXPO_PUBLIC_AUTH_SERVICE_URL` | No | `https://rez-auth-service.onrender.com` | Direct auth calls |
| `EXPO_PUBLIC_WALLET_SERVICE_URL` | No | `https://rez-wallet-service-36vo.onrender.com` | Direct wallet calls |
| `EXPO_PUBLIC_PAYMENT_SERVICE_URL` | No | `https://rez-payment-service.onrender.com` | Direct payment calls |
| `EXPO_PUBLIC_FINANCE_SERVICE_URL` | No | `https://rez-finance-service.onrender.com` | Direct finance calls |
| `EXPO_PUBLIC_SEARCH_SERVICE_URL` | No | `https://rez-search-service.onrender.com` | Direct search calls |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | Yes | `rzp_live_...` | Client-side Razorpay |
| `EXPO_PUBLIC_SENTRY_DSN` | No | — | Mobile error tracking |

---

## 15. Merchant App (rez-merchant-master)

| Variable | Required? | Example Value | Notes |
|----------|-----------|---------------|-------|
| `EXPO_PUBLIC_API_URL` | Yes | `https://api.rezapp.com` | Backend base URL |
| `EXPO_PUBLIC_MERCHANT_SERVICE_URL` | No | `https://rez-merchant-service-n3q2.onrender.com` | Direct merchant calls |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | No | — | Merchant payment |

---

## 16. Hotel OTA

| Variable | Required? | Notes |
|----------|-----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `REDIS_URL` | Yes | Scheduled jobs |
| `PMS_WEBHOOK_SECRET` | Yes | Per-hotel PMS webhook verify |
| `REZ_WEBHOOK_URL` | Yes | `https://api.rez.money/api/webhooks/hotel-attribution` |
| `REZ_INTERNAL_TOKEN` | Yes | REZ service-to-service auth |
| `PORT` | No | `3000` |

---

## 17. AdBazaar

| Variable | Required? | Notes |
|----------|-----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side Supabase admin |
| `RAZORPAY_KEY_ID` | Yes | Payment gateway |
| `RAZORPAY_KEY_SECRET` | Yes | Payment gateway |
| `GOOGLE_MAPS_API_KEY` | Yes | Location services |
| `REZ_WEBHOOK_URL` | Yes | REZ attribution webhook |
| `REZ_WEBHOOK_SECRET` | Yes | HMAC signing for REZ events |

---

## Secret Generation

```bash
# Generate a 64-character hex secret (32 bytes)
openssl rand -hex 32

# Generate JWT secrets (use separate commands for each)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_ADMIN_SECRET=$(openssl rand -hex 32)
JWT_MERCHANT_SECRET=$(openssl rand -hex 32)
OTP_HMAC_SECRET=$(openssl rand -hex 32)

# GiftCard encryption key (required in rez-backend)
GIFT_CARD_ENCRYPTION_KEY=$(openssl rand -hex 32)

# WhatsApp webhook verify token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=$(openssl rand -hex 32)

# Generate internal service tokens (one per calling service)
INTERNAL_SERVICE_TOKENS_JSON='{"payment":"'$(openssl rand -hex 32)'","finance":"'$(openssl rand -hex 32)'","search":"'$(openssl rand -hex 32)'","marketing":"'$(openssl rand -hex 32)'"}'
```

## Critical Render Env Vars (Must Set Before Deploy)

| Service | Variable | Action |
|---------|----------|--------|
| `rez-gamification-service` | `WALLET_SERVICE_URL` | Set to `https://rez-wallet-service-36vo.onrender.com` — coins never credited without this |
| `rez-merchant-service` | `MSG91_API_KEY` | Set MSG91 key — merchant OTP login returns 503 without this |
| `rez-merchant-service` | `MSG91_TEMPLATE_ID` | Set DLT template ID for MSG91 |
| `rez-backend` | `GIFT_CARD_ENCRYPTION_KEY` | Generate with `openssl rand -hex 32` — service refuses to start without this |
| `rez-backend` | `APP_URL` | Set to `https://rez.money` — WhatsApp ordering payment links broken without this |
| `rez-marketing-service` | `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Set before enabling Meta webhook — all GET challenges fail otherwise |

## Security Notes

1. Never commit `.env` files. They are `.gitignore`d by default.
2. `firebase-service-account.json` contains private credentials — never commit. Use a mounted secret or Render secret file.
3. `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` must be rotated if ever exposed.
4. `INTERNAL_SERVICE_TOKENS_JSON` replaces the old shared `INTERNAL_SERVICE_TOKEN`. Services that support scoped tokens will use this map; others fall back to the shared token during migration.
