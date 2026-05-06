# Resturistan — Service Documentation & Runbook

> Repo: `github.com/imrejaul007/restaurantapp`
> Source (local): `Resturistan App/restauranthub/`
> Status: ⚠️ Code on GitHub — production deploy pending (Render config ready in `render.yaml`)

---

## 1. Purpose

**Resturistan** (package name `restauranthub`) is a B2B/B2C SaaS platform purpose-built for the restaurant industry. It operates on two simultaneous tracks:

- **B2C — Diner-facing:** Customers browse restaurants, place food orders, track delivery, leave reviews, and interact with a community feed.
- **B2B — Restaurant & Merchant-facing:** Restaurant operators manage their branches, menus, inventory, employees, purchase orders from suppliers, POS sessions, HR/jobs, financial reporting, and subscriptions. Suppliers/vendors list products on a wholesale marketplace.

The platform is deeply integrated with the **REZ ecosystem**. REZ merchants (restaurants) can log in to Resturistan directly using their REZ JWT — no separate account needed — via the **REZ Bridge**. REZ provides wallet balances, credit scores, analytics, and catalog data which Resturistan surfaces inside its dashboards.

**Primary user roles:**

| Role | Description |
|------|-------------|
| `ADMIN` | Platform super-admin |
| `RESTAURANT` | Restaurant operator / merchant |
| `EMPLOYEE` | Restaurant staff member |
| `VENDOR` | B2B supplier/wholesaler |
| `CUSTOMER` | End consumer/diner |

---

## 2. Tech Stack

### Frontend

| App | Framework | Key Libraries |
|-----|-----------|---------------|
| `apps/web` | Next.js 14 (App Router) | React 18, TailwindCSS 3, Radix UI, Framer Motion, TanStack Query v5, React Hook Form, Zod, Chart.js, Recharts, Socket.io-client, Stripe.js, next-i18next, next-pwa |
| `apps/mobile` | React Native (Expo) | EAS Build, Expo SDK |

### Backend Services (all NestJS 10 + TypeScript 5)

| Service | Key Dependencies |
|---------|-----------------|
| `apps/api` | NestJS, Prisma 5, Passport JWT, Argon2, Socket.io, Stripe, Razorpay, Nodemailer, Redis (ioredis), Winston, Prom-client, OpenTelemetry, Apollo/GraphQL |
| `apps/api-gateway` | NestJS, Helmet, Compression, Swagger |
| `apps/auth-service` | NestJS, Passport, Swagger |
| `apps/order-service` | NestJS, Swagger |
| `apps/restaurant-service` | NestJS, Redis microservice transport, Swagger |
| `apps/notification-service` | NestJS, Swagger |

### Database & Infrastructure

| Component | Technology |
|-----------|-----------|
| Primary DB | PostgreSQL (Prisma ORM) |
| Cache | Redis |
| Queues | Redis (NestJS microservice transport) |
| File Storage | Cloudinary |
| Monitoring | Prometheus + Grafana + Alertmanager |
| Observability | OpenTelemetry → Jaeger |
| Error Tracking | Sentry |
| APM | New Relic |

### Monorepo Tooling

| Tool | Role |
|------|------|
| Turborepo 1.11 | Task orchestration (`dev`, `build`, `test`, `lint`) |
| npm workspaces | Package linking |
| Prettier + ESLint | Code formatting & linting |

---

## 3. Monorepo Structure

```
restauranthub/
├── apps/
│   ├── api/                    # Main monolithic NestJS API (port 3000)
│   ├── api-gateway/            # NestJS API Gateway / reverse proxy (port 3002)
│   ├── auth-service/           # Standalone Auth microservice (port 3004)
│   ├── mobile/                 # React Native mobile app (EAS)
│   ├── notification-service/   # Notification microservice (port 3005)
│   ├── order-service/          # Order microservice (port 3006)
│   ├── restaurant-service/     # Restaurant microservice w/ Redis transport (port 3003)
│   └── web/                    # Next.js 14 customer + admin web app (port 3001)
├── packages/
│   ├── db/                     # Prisma schema + seed scripts (shared DB client)
│   ├── rez-client/             # Typed HTTP client for all REZ microservices
│   ├── common/                 # Shared utilities
│   └── scripts/                # Shared build/utility scripts
├── docker/                     # Dockerfiles and compose overrides
├── k8s/ kubernetes/ helm/      # Kubernetes manifests and Helm charts
├── monitoring/                 # Prometheus rules, Grafana dashboards
├── tests/                      # Performance tests (k6, Artillery)
├── turbo.json                  # Turborepo pipeline config
├── render.yaml                 # Render.com deployment config
└── docker-compose.yml          # Local dev compose
```

---

## 4. App Documentation

### 4.1 `apps/web` — Next.js Customer & Operator Web App

**Port:** 3001 | **Framework:** Next.js 14 App Router

#### Pages / Routes

```
/                          Landing / home page

/auth/
  login                    Email + password login
  signup                   New account registration
  otp-login                OTP-based login
  otp-verification         Verify OTP code
  forgot-password          Request password reset link
  reset-password           Set new password
  reset-confirmation       Post-reset confirmation
  expired-link             Expired link notice
  change-password          Authenticated password change
  role-selection           Choose role after signup
  profile-setup            Initial profile completion
  setup-2fa                Enable two-factor auth
  verify-2fa               Verify TOTP code
  verify-email             Email verification
  social-login             OAuth provider redirect
  account-locked           Account lockout notice
  success                  Auth success redirect

/dashboard/                Restaurant operator main dashboard
  analytics/               Performance charts, KPIs
  billing/                 Subscription & invoices
  community/               Community feed for operators
  delivery/                Delivery tracking
  employees/               Employee list & management
  inventory/               Stock levels & reorder
  jobs/                    Posted vacancies
  kitchen/                 Kitchen display / ticket view
  marketplace/             B2B supplier browse
  menu/                    Menu builder
  orders/                  Incoming orders
  payments/                Payment history
  profile/                 Restaurant profile edit
  reports/                 Financial reports
  reservations/            Table reservations
  settings/                Account settings
  staff/                   Staff scheduling
  statements/              Accounting statements
  tables/                  Table/floor plan management
  transactions/            Transaction ledger

/restaurant/[id]/          Public restaurant detail page
/restaurants/              Diner restaurant browse & search

/vendor/
  [id]/                    Vendor profile page
  dashboard/
    analytics/  community/  onboarding/  orders/
    products/   profile/    reviews/

/admin/
  dashboard/   analytics/  marketplace/  orders/
  payouts/     reports/    restaurants/  settings/
  subscriptions/ system/   users/        vendors/
  verification/

/marketplace/
  browse/  bulk/  cart/  categories/  category/[slug]/
  checkout/  deals/  order-confirmation/  product/[id]/
  search/  services/  supplier/[id]/  trending/
  vendor/[id]/  vendors/  wishlist/  b2b-quote/

/orders/[id]/              Order detail + live tracking
/analytics/                Standalone analytics for operators
  customers/  insights/  reports/  sales/
/community/  /profile/  /cart/  /checkout/
/jobs/  /messages/  /notifications/  /payments/
/settings/  /subscribe/  /support/  /wallet/
/employee/  /training/  /vendor-verification/
```

**Key features:** PWA support, i18n (next-i18next), dark/light theme, real-time order updates (Socket.io), Stripe Elements, TanStack Query for server state, Playwright E2E tests.

---

### 4.2 `apps/mobile` — React Native App

Built with React Native / Expo. Full screen inventory in `ALL_SCREENS_COMPLETE_LIST.md` in the monorepo. Built and distributed via EAS (Expo Application Services).

---

### 4.3 `apps/api` — Main NestJS API

**Port:** 3000 | **Prefix:** `api/v1` | **Swagger:** `GET /docs`

#### Modules & Route Groups

| Module | Prefix | Key Endpoints |
|--------|--------|---------------|
| **Auth** | `auth` | `POST /auth/signup`, `POST /auth/signin`, `POST /auth/logout`, `GET /auth/profile` |
| **REZ Bridge** | `auth` | `POST /auth/rez-bridge` — exchange REZ JWT for RestaurantHub JWT |
| **Users** | `users` | Profile management, GDPR consent (`/users/consent`), REZ webhook (`/users/rez-webhook`) |
| **Orders** | `api/orders` | CRUD + `PUT /api/orders/:id/status` |
| **Marketplace** | `marketplace` | Categories, suppliers, demand signals, RFQ (`POST /marketplace/rfq`) |
| **Jobs** | `jobs` | Post, browse, apply, manage applications, file upload |
| **Analytics** | `analytics` | `GET /analytics/dashboard` (JWT), `GET /analytics/peer-group?city&cuisine` (public) |
| **Fintech** | `fintech` | Credit profile, loan apply, application status, supplier payment |
| **Training** | `training` | Training Academy course management |
| **QR Templates** | `qr-templates` | QR code generation & template management |
| **Health** | — | `GET /api/v1/health` |

**Security layers:**
- Helmet (HSTS, CSP, X-Frame-Options)
- Rate limiting: 100 req/15 min; auth: 5 attempts/15 min; password reset: 3/hour
- CSRF protection (production only)
- JWT via Passport + Argon2 hashing
- Token blacklist (Redis-backed)
- DOMPurify + sanitize-html input sanitization
- Winston structured logging + file rotation
- OpenTelemetry → Jaeger tracing
- Prometheus metrics (prom-client)

---

### 4.4 `apps/api-gateway`

**Port:** 3002 | **Prefix:** `api/v1` | **Health:** `GET /health`

Thin NestJS gateway: unified entry point, Helmet + compression, CORS. Service discovery present but not yet activated.

---

### 4.5 `apps/auth-service`

**Port:** 3004 | Standalone auth microservice. JWT bearer auth, `ValidationPipe`, CORS via `CORS_ORIGIN`. Future extraction target from the monolith.

---

### 4.6 `apps/order-service`

**Port:** 3006 | Standalone order processing microservice. Full lifecycle currently in `apps/api` — this is the extraction target.

---

### 4.7 `apps/restaurant-service`

**Port:** 3003 | Dual-mode: HTTP REST API + Redis-based NestJS microservice (internal events). Redis: `REDIS_HOST:REDIS_PORT`, 5 retries with 3s delay.

---

### 4.8 `apps/notification-service`

**Port:** 3005 | Notification dispatching: in-app, email (Nodemailer), push (via REZ notification-events). JWT bearer auth.

---

## 5. Database Models (`packages/db`)

**Provider:** PostgreSQL | **ORM:** Prisma 5

### Key Enums

| Enum | Values |
|------|--------|
| `UserRole` | ADMIN, RESTAURANT, EMPLOYEE, VENDOR, CUSTOMER |
| `VerificationStatus` | PENDING, VERIFIED, REJECTED |
| `JobStatus` | DRAFT, OPEN, CLOSED, FILLED |
| `ApplicationStatus` | PENDING, REVIEWED, SHORTLISTED, ACCEPTED, REJECTED |
| `OrderStatus` | PENDING, CONFIRMED, PREPARING, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED |
| `PaymentStatus` | PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED |
| `ProductStatus` | ACTIVE, INACTIVE, OUT_OF_STOCK |
| `EmployeeTagType` | POSITIVE, NEGATIVE, NEUTRAL |

### Core Models

| Model | Key Fields |
|-------|-----------|
| `User` | id, email, phone, passwordHash, role, isActive, isVerified, isAadhaarVerified, twoFactorEnabled, lastLoginAt |
| `Profile` | userId (1:1), firstName, lastName, avatar, bio, address, city, state, country, pincode |
| `Session` | userId, token, ipAddress, userAgent, deviceInfo, expiresAt, lastAccessedAt |
| `Restaurant` | userId, name, cuisineType[], licenseNumber, gstNumber, fssaiNumber, panNumber, bankAccountNumber, verificationStatus, rating |
| `Branch` | restaurantId, name, address, city, state, pincode, phone, latitude, longitude |
| `Vendor` | userId, companyName, businessType, gstNumber, verificationStatus, rating |
| `Employee` | userId, restaurantId, branchId, employeeCode, designation, department, aadharNumber, salary, joiningDate |
| `Job` | restaurantId, title, description, requirements[], skills[], salaryMin/Max, location, jobType, status, validTill |
| `JobApplication` | jobId, employeeId, coverLetter, resume, status |
| `Category` | name, slug, parentId (self-relation hierarchy) |
| `Product` | vendorId, restaurantId, categoryId, name, sku, price, comparePrice, costPrice, quantity, unit, gstRate, hsnCode, status, isWholesale, minStock, reorderPoint |
| `Cart` / `CartItem` | restaurantId; cartId, productId, quantity, price |
| `Order` | orderNumber, restaurantId, vendorId, subtotal, gstAmount, totalAmount, status, paymentStatus, creditUsed |
| `OrderItem` | orderId, productId, quantity, price, gstAmount, totalAmount |
| `Transaction` | orderId, restaurantId, vendorId, type (credit/debit/refund), amount, balance |
| `Credit` | restaurantId (1:1), availableCredits, usedCredits, totalCredits, creditLimit |
| `Review` | userId, productId, restaurantId, vendorId, rating (1-5), comment, isVerifiedPurchase |
| `Conversation` / `Message` | participants[], lastMessageAt; conversationId, senderId, content, isRead |
| `Notification` | userId, title, message, type (order/job/message/system), isRead |
| `Post` / `Comment` | userId, title, content, images[], tags[]; postId, userId, content |
| `Document` | restaurantId/vendorId/employeeId, type (license/gst/fssai/pan/aadhar), url, verificationStatus |
| `Subscription` | restaurantId, planName, features, price, billingCycle, startDate, endDate, isActive, autoRenew |

**Additional model groups:**
- **POS:** `MenuCategory`, `MenuItem`, `Table`, `PosOrder`, `Customer`, `LoyaltyProgram`
- **Financial:** `Invoice`, `Payment`, `Refund`, `TaxEntry`, `Account`, `JournalEntry`, `Expense`, `Budget`
- **Inventory:** `StockMovement`, `InventoryBatch`, `ReorderRequest`
- **Community:** `ForumPost`, `PostComment`, `PostLike`, `CommunityGroup`, `UserBadge`, `UserReputation`
- **GDPR:** `UserConsent`, `DataExportRequest`, `DataDeletionRequest`, `BlacklistedToken`, `ApiKey`
- **HR:** `Attendance`, `Leave`, `EmployeeTag`, `AuditLog`, `AadhaarVerification`

---

## 6. REZ Integration (`packages/rez-client`)

**Package:** `@restauranthub/rez-client` — NestJS-injectable module imported by `apps/api`.

### Architecture

```
RezClientModule
  └── RezHttpClient             ← base (circuit breaker + retry)
        ├── RezMerchantClient   ← REZ_MERCHANT_SERVICE_URL
        ├── RezAnalyticsClient  ← REZ_ANALYTICS_URL
        ├── RezCatalogClient    ← REZ_CATALOG_URL
        └── RezWalletClient     ← REZ_WALLET_URL
```

### Resilience

- **Circuit breaker:** Opens after 5 consecutive failures; resets after 30s
- **Retry + exponential backoff:** 3 retries, 300ms base delay doubling each attempt
- **Request timeout:** 10s per call
- **Correlation ID:** `X-Correlation-ID` forwarded on all requests
- **Auth:** `X-Internal-Token: REZ_INTERNAL_TOKEN` on every request

### Client Methods

**`RezMerchantClient`:** getMerchant, getMerchantStats, getMerchantStores, getPurchaseOrders, getPurchaseOrderSummary, getStaffShifts, getShiftGaps

**`RezAnalyticsClient`:** Revenue metrics, top products, daily/weekly revenue, food cost metrics, peer benchmarks

**`RezCatalogClient`:** Product catalog, categories, supplier data

**`RezWalletClient`:** getWalletBalance, getTransactions, getMerchantCreditScore

### REZ Auth Bridge (`POST /api/v1/auth/rez-bridge`)

Single sign-on from REZ merchant accounts:

1. Client sends `{ rezToken: "<REZ JWT>" }`
2. Server verifies REZ JWT with `REZ_JWT_SECRET` (HS256)
3. Confirms role is `merchant` or `merchant_admin`
4. Fetches merchant profile from `REZ_BACKEND_URL/merchant/profile`
5. Upserts `User` + `Profile` (linked via `profile.rezMerchantId`)
6. Issues Resturistan-scoped JWT
7. Returns `{ accessToken, user: RezMerchantIdentity, isNewProfile }`

---

## 7. Environment Variables

### Core (all services)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `development` \| `production` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection URL |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_EXPIRES_IN` | No | Token expiry (default: `1d`) |

### `apps/api`

| Variable | Required | Description |
|----------|----------|-------------|
| `API_PORT` | No | Default: `3000` |
| `FRONTEND_URL` / `ALLOWED_ORIGINS` | Yes (prod) | CORS allowed origins |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | Yes | Image storage |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Yes | Stripe payments |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Yes | Razorpay (India) |
| `SMTP_HOST/PORT/USER/PASS` | Yes | Email (Nodemailer) |
| `REZ_JWT_SECRET` | Yes | Shared secret with REZ (for auth bridge) |
| `REZ_BACKEND_URL` | Yes | Default: `https://api.rezapp.com/api` |
| `REZ_INTERNAL_TOKEN` | Yes | Matches `INTERNAL_SERVICE_TOKEN` on REZ |
| `REZ_MERCHANT_SERVICE_URL` | No | rez-merchant-service URL |
| `REZ_ANALYTICS_URL` | No | analytics-events URL |
| `REZ_CATALOG_URL` | No | rez-catalog-service URL |
| `REZ_WALLET_URL` | No | rez-wallet-service URL |
| `SENTRY_DSN` | No | Error tracking |
| `NEW_RELIC_LICENSE_KEY` | No | APM |
| `JAEGER_ENDPOINT` | No | Distributed tracing |

### `apps/web`

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_SITE_URL` | Yes | Web app URL |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe frontend key |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Yes | Razorpay frontend key |
| `NEXT_PUBLIC_SOCKET_URL` | No | WebSocket server URL |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Frontend error tracking |

### Microservice ports

| Service | Var | Default |
|---------|-----|---------|
| `auth-service` | `AUTH_SERVICE_PORT` | 3004 |
| `restaurant-service` | `RESTAURANT_SERVICE_PORT` | 3003 |
| `order-service` | `PORT` | 3006 |
| `notification-service` | `PORT` | 3005 |
| `api-gateway` | `API_GATEWAY_PORT` | 3002 |

---

## 8. Local Development

### Prerequisites

- Node.js 18+, npm 9+, Docker Desktop

### Setup

```bash
cd "Resturistan App/restauranthub"
npm install
npm run docker:up           # PostgreSQL + Redis
npm run db:migrate          # prisma migrate dev
npm run db:seed             # seed data
npm run dev                 # all apps
# web  → http://localhost:3001
# api  → http://localhost:3000/api/v1
# docs → http://localhost:3000/docs
```

### Port Map

| Service | Port |
|---------|------|
| `apps/web` | 3001 |
| `apps/api` | 3000 |
| `apps/api-gateway` | 3002 |
| `apps/auth-service` | 3004 |
| `apps/restaurant-service` | 3003 |
| `apps/notification-service` | 3005 |
| `apps/order-service` | 3006 |
| PostgreSQL | 5432 |
| Redis | 6379 |

### Useful Commands

```bash
cd apps/api && npx prisma studio    # DB GUI
npm run test                         # all tests
npm run perf:k6:load                 # k6 load test
npm run monitoring:up                # Grafana :3003, Prometheus :9090
npm run format                       # Prettier
```

---

## 9. Deployment

### Render (`render.yaml`)

| Service | Type | Build / Start |
|---------|------|---------------|
| `restauranthub-web` | Web (Node) | `next build` + `next start -p 3001` |
| `restauranthub-api` | Web (Node) | `nest build` + `node dist/main`, port 10000 |
| `restauranthub-redis` | Redis | Managed |
| `restauranthub-db` | PostgreSQL | Managed Starter |

### Docker

```bash
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec api npm run db:migrate
```

### Kubernetes

Manifests in `k8s/`, `kubernetes/`, Helm charts in `helm/`.

### Mobile (EAS)

```bash
eas build --platform all
eas submit
eas update --branch production --message "vX.X"
```

---

## 10. Troubleshooting

**Database fails:** Check `DATABASE_URL` and run `npm run docker:up`. Verify: `docker-compose ps`.

**`REZ_JWT_SECRET required`:** Add to `.env` — must match the REZ backend's JWT secret. For dev without REZ: comment out `RezBridgeModule` in `app.module.ts`.

**Redis refused:** Run `npm run redis:up`. `restaurant-service` requires Redis for microservice transport.

**Rate limit 429 (auth):** Auth limited to 5 req/15min in production. Override with `AUTH_RATE_LIMIT_MAX_REQUESTS` in dev.

**CSRF errors (POST blocked):** Fetch CSRF token: `GET /api/v1/csrf-token → { csrfToken }`. Send as `X-CSRF-Token` header.

**REZ Bridge 503:** `REZ_BACKEND_URL/merchant/profile` unreachable. Circuit breaker opens after 5 failures, resets after 30s.

**Prisma migration error:**
```bash
cd apps/api && npx prisma migrate reset   # WARNING: destroys data
npm run db:migrate                        # deploy pending migrations only
```

---

## References

- Prisma schema: `packages/db/prisma/schema.prisma`
- REZ client: `packages/rez-client/src/`
- Monorepo docs: `Resturistan App/restauranthub/docs/`
- Deployment config: `Resturistan App/restauranthub/render.yaml`
- Screen mapping: `Resturistan App/restauranthub/docs/SCREEN_TO_ENDPOINT_MAPPING.md`
