# Architecture Map — FORENSIC-001

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NGINX API GATEWAY                           │
│                   (rez-api-gateway — NGINX-based)                   │
│  • Strips X-Internal-Token from client requests                     │
│  • Routes 14 merchant paths to monolith (partial strangler fig)     │
│  • BREACH attack mitigated (gzip disabled for auth)                │
│  • MISSING: /search/stores, /home/feed, /recommend/* routes       │
└──────────┬──────────────────┬──────────────────┬───────────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────────┐
│  REZ-BACKEND    │  │   PAYMENT    │  │      WALLET          │
│  (Monolith)     │  │   SERVICE    │  │      SERVICE         │
│                 │  │              │  │                      │
│ Concurrent      │  │ Concurrent   │  │ Concurrent            │
│ writer to ALL   │◄─┤ writer to   │◄─┤ writer to wallets   │
│ collections     │  │ payments     │  │ + transactions        │
│                 │  │              │  │                      │
│ FSM: 11 states │  │ FSM: blocks  │  │ TOCTOU: merchant     │
│ (missing 3)    │  │ failed→pend  │  │ withdrawal race      │
└────────┬────────┘  └──────┬───────┘  └──────────┬───────────┘
         │                   │                      │
         │  ┌────────────────┘                      │
         │  │                                       │
         ▼  ▼  ▼  ┌─────────────────────────────────┐
┌──────────────┐  │         SHARED MONGODB           │
│ ORDER        │  │         CLUSTER (Single DB)       │
│ SERVICE      │  │                                 │
│              │  │  orders, payments, wallets,      │
│ Concurrent   │◄─┤  products, karma_profiles,      │
│ writer to    │  │  settlements — ALL dual-written  │
│ orders       │  │                                 │
│              │  │  No database-level isolation     │
│ FSM: 9 hard-│  │                                 │
│ coded status │  └─────────────────────────────────┘
└──────┬───────┘
       │
       ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  MERCHANT    │   │   CATALOG    │   │    SEARCH   │
│  SERVICE     │   │   SERVICE    │   │   SERVICE   │
│              │   │              │   │              │
│ Queries:     │   │ Concurrent   │   │ Paths NOT   │
│ merchant     │   │ writer to    │   │ routed via  │
│ field       │◄─┤ products     │   │ gateway     │
│ (missing    │   │              │   │              │
│ merchantId) │   │ HMAC key:   │   │ Rate limit: │
│              │   │ runtime-     │   │ fails open  │
│ Settlement: │   │ generated    │   │ on Redis    │
│ excluded    │   │ (BROKEN)     │   │ outage      │
│ ALL mono-   │   │              │   │              │
│ lith orders │   │              │   │              │
└─────────────┘   └──────────────┘   └──────────────┘
       │
       ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│    KARMA     │   │   FINANCE    │   │ NOTIFICATION │
│   SERVICE    │   │   SERVICE    │   │   EVENTS    │
│              │   │              │   │              │
│ Auth: calls  │   │ Silent coin  │   │ No dedup on │
│ /api/auth/   │   │ failure when │   │ event ID    │
│ verify       │   │ wallet svc   │   │              │
│ (404!)       │   │ unreachable  │   │ BullMQ:     │
│              │   │              │   │ removeOn    │
│ 2x karma    │   │ BNPL: OR    │   │ complete    │
│ inflation    │   │ instead of   │   │ + fail      │
│              │   │ AND          │   │ configured  │
│ Compile     │   │              │   │              │
│ error       │   │              │   │              │
└─────────────┘   └──────────────┘   └──────────────┘
                                                   │
       ┌──────────────────────────────────────────┘
       ▼
┌──────────────┐   ┌──────────────┐
│    MEDIA     │   │   AUTH      │
│   EVENTS     │   │   SERVICE   │
│              │   │              │
│ Static files │   │ Defines:     │
│ served with- │   │ /api/auth/  │
│ out auth     │   │ validate    │
│ (missing     │   │              │
│ return!)     │   │ KARMA calls │
│              │   │ /verify     │
│ Firebase:    │   │ (404!)      │
│ JSON on     │   │              │
│ disk        │   │ Admin JWT:   │
└─────────────┘   │ uses consumer│
                  │ secret       │
                  └─────────────┘

REDIS + BullMQ (shared across services):
  • Idempotency keys (SET NX)
  • Mutex locks
  • Rate limiting
  • Job queues: notification, catalog, wallet, media
```

---

## Service Topology

| Service | Port | DB | Redis | HTTP | Queue |
|---------|------|----|-------|------|-------|
| `rez-backend` (monolith) | 5000 | MongoDB | Yes | Express | BullMQ |
| `rez-payment-service` | 3001 | MongoDB | Yes | Express | BullMQ |
| `rez-wallet-service` | 3002 | MongoDB | Yes | Express | BullMQ |
| `rez-order-service` | 3003 | MongoDB | Yes | Express | BullMQ |
| `rez-merchant-service` | 3004 | MongoDB | Yes | Express | — |
| `rez-catalog-service` | 3005 | MongoDB | Yes | Express | BullMQ |
| `rez-search-service` | 3006 | MongoDB | Yes | Express | — |
| `rez-karma-service` | 3007 | MongoDB | Yes | Express | — |
| `rez-finance-service` | 3008 | MongoDB | Yes | Express | — |
| `rez-notification-events` | 3009 | MongoDB | Yes | Express | BullMQ |
| `rez-media-events` | 3010 | MongoDB | Yes | Express | BullMQ |
| `rez-auth-service` | 3011 | MongoDB | Yes | Express | — |
| `rez-api-gateway` | — | — | — | NGINX | — |
| `rez-gamification-service` | 3012 | MongoDB | Yes | Express | BullMQ |
| `rez-scheduler-service` | 3013 | MongoDB | Yes | — | BullMQ |
| `rez-ads-service` | 3014 | MongoDB | Yes | Express | — |

---

## Dual-Write Map

Collections with 2+ concurrent writers:

| Collection | Writer 1 | Writer 2 | Conflict |
|------------|----------|----------|---------|
| `orders` | backend | order-service | Status + payment subdoc |
| `payments` | backend | payment-service | Status + transactionId |
| `wallets` | backend | wallet-service | Balance |
| `merchant_wallets` | backend | wallet-service | Balance |
| `products` | backend | catalog-service | Pricing (original vs mrp) |
| `settlements` | backend | merchant-service | Amount + status |
| `karma_profiles` | — | karma-service | TotalKarma (2x path) |
| `karma_events` | — | karma-service | Type + amount |
| `notifications` | — | notification-events | Read status |

---

## Auth Flow Map

```
Client Request
     │
     ▼
NGINX Gateway (strips X-Internal-Token)
     │
     ▼
Backend/Microservice
     │
     ├─► JWT auth (user endpoints) ──► AUTH SERVICE (/api/auth/validate)
     │                                        ▲
     │                                   KARMA calls
     │                                   /verify (404!)
     │
     ├─► Internal token (service-to-service)
     │    ├─► INTERNAL_SERVICE_TOKENS_JSON ──► scoped tokens (NEW)
     │    └─► INTERNAL_SERVICE_TOKEN ────────► legacy (payment REJECTS)
     │
     └─► HMAC-SHA256 (catalog service) ──► Runtime key (BROKEN)

Admin Cron Jobs ──► Consumer JWT auth (WRONG) ──► Should use admin middleware
```

---

## Strangler Fig Status

| Entity | Monolith | Service | Routed via Gateway | Cutover |
|--------|----------|---------|-------------------|---------|
| Products | ✅ | ✅ | ✅ | 50/50 |
| Orders | ✅ | ✅ | ✅ | Shadow mode |
| Payments | ✅ | ✅ | ❌ | Shadow mode |
| Wallets | ✅ | ✅ | ❌ | Shadow mode |
| Merchants | ✅ | ✅ | ✅ | 14 routes |
| Karma | ❌ | ✅ | ❌ | Complete |
| Settlements | ✅ | ✅ | ❌ | Shadow mode |
| Search | ❌ | ✅ | ❌ | Complete (but not routed) |
| Auth | ✅ | ✅ | ✅ | 50/50 |
