# Cross-Service Call Map

**Date:** 2026-04-16
**Scope:** All inter-service calls and what breaks if they fail

---

## AdBazaar → REZ Backend

### QR Scan: Coin Credit

```
AdBazaar QR Scan API
    │
    ├──► Supabase: insert scan_event (blocking — must succeed)
    │         If FAIL: 500, scan not recorded, no redirect
    │
    └──► REZ Backend: POST /api/adbazaar/scan
              If TIMEOUT (10s): scan recorded, coins NOT credited
              If 5xx: scan recorded, coins NOT credited
              If 4xx: scan recorded, coins NOT credited, no retry
              If SUCCESS: coins credited to REZ user

              ⚠️ No retry, no DLQ, no reconciliation
              ⚠️ `scan_event.rez_coins_credited` stays false
```

### Webhooks: REZ Visit/Purchase Attribution

```
REZ Backend
    │
    ├──► AdBazaar: POST /webhooks/rez-visit
    │         If FAIL: REZ has no retry — attribution lost
    │
    └──► AdBazaar: POST /webhooks/rez-purchase
              If FAIL: REZ has no retry — attribution lost
```

---

## REZ Ecosystem Internal

### Order → Wallet (Coin Credit)

```
rez-order-service              rez-wallet-service           rezbackend
      │                              │                           │
      ├──► Credit coins ───────────►│                           │
      │      If FAIL: order succeeds │                           │
      │      coins never credited    │                           │
      │                              │                           │
      │                      ┌──────┴──────┐                    │
      │                      │ Redis state  │                    │
      │                      │ wallet._id  │                    │
      │                      └──────┬──────┘                    │
      │                             │                           │
      │                      ┌──────┴──────┐                    │
      └──► Wallet created? ──►│  MongoDB    │◄───────────────────┘
                             │  (async)    │
                             └─────────────┘
```

**Known issues:**
- C9: Coin credit fire-and-forget — wallet service may be down, coins credited anyway (RC-3)
- C10: Merchant double-payout race — two simultaneous completions both pay out
- SD-02: Wallet schema truncated — categoryBalances, limits, settings always null

---

## AdBazaar → External Services

| Call | Timeout | Failure Behavior | Retry? |
|------|---------|-----------------|--------|
| Razorpay Order Create | 10s | Booking not created | Manual retry |
| Razorpay Payment Verify | 10s | Payment not confirmed | Manual retry |
| Razorpay Refund | 30s | Refund not processed | Manual retry |
| REZ Coin Credit | 10s | Coins not credited | **No retry** |
| Email (Resend) | 10s | Email not sent | **No retry** |
| Google Maps Geocoding | 5s | Map markers fail | No retry |
| Supabase DB | — | 500 error | Auto-retry via Supabase |

---

## What Should Have Dead-Letter Queues

| Operation | Current Behavior | Should Be |
|-----------|-----------------|-----------|
| REZ coin credit | Silently fails, flagged in DB | DLQ → retry 3x → manual review |
| Notification insert | Silently fails | DLQ → retry 3x → Slack alert |
| Email send | Logged, not retried | DLQ → retry 3x → manual review |
| Attribution webhook | No retry from REZ side | REZ should implement DLQ |
| Booking status update | No retry | DLQ → retry 3x |

---

## Effort Estimate

| Task | Effort | Priority |
|------|--------|----------|
| Add DLQ for REZ coin credits (AdBazaar side) | 2 hours | CRITICAL |
| Add DLQ for notification inserts | 2 hours | HIGH |
| REZ backend: add DLQ for wallet calls | 4 hours | HIGH |
| REZ backend: add DLQ for attribution webhooks | 2 hours | HIGH |
| Add circuit breaker for external calls | 4 hours | MEDIUM |
| Add health checks for all external dependencies | 3 hours | MEDIUM |

**Total: ~17 hours**
