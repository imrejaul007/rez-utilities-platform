# REZ Ecosystem Integration Runbook

**Status:** ✅ **READY FOR INTEGRATION**  
**Date:** April 7, 2026  
**Scope:** AdBazaar + Hotel OTA + REZ Backend Integration

---

## Quick Start

### Phase 6.1: API Gateway Optimization
```bash
# Deployed ✅
# Expected: 30-50% latency reduction, 30-40% cache hit rate
Status: LIVE on rez-api-gateway.onrender.com
```

### AdBazaar Integration
```bash
# QR Scan → Coin Credit Flow
POST /api/webhooks/adbazaar/qr-scan
{
  "eventId": "evt_123",
  "eventType": "qr_scan",
  "campaignId": "camp_456",
  "advertiserId": "adv_789",
  "deviceId": "dev_xyz",
  "coinsAwarded": 10
}
```

### Hotel OTA Integration
```bash
# Reservation Confirmation → Coin Award Flow
POST /api/webhooks/pms/reservation-confirmed
{
  "hotelId": "hotel_123",
  "reservationId": "res_456",
  "guestEmail": "guest@example.com",
  "totalPrice": 500,
  "coinsAwarded": 5
}
```

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       REZ Ecosystem                         │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
        ┌───────▼────────┐   │   ┌──────────▼─────────┐
        │   REZ Backend   │   │   │  API Gateway       │
        │ - Core wallet   │   │   │ - Routing          │
        │ - Coin logic    │   │   │ - Caching (Phase 6)│
        │ - User mgmt     │   │   │ - Rate limiting    │
        └────────┬────────┘   │   └────────┬───────────┘
                 │            │            │
         ┌───────┴──────┐     │     ┌──────┴──────┐
         │              │     │     │             │
    ┌────▼──────┐  ┌───▼─────▼──┐  │  ┌──────────▼────┐
    │ AdBazaar  │  │    Hotels    │  │  │ Mobile App    │
    │ - QR scan │  │ - PMS webhook │ │  │ - Consumer    │
    │ - Ads     │  │ - Bookings    │ │  │ - Merchant    │
    │ - Rewards │  │ - Coins       │ │  │ - Admin       │
    └────┬──────┘  └────┬─────────┘  │  └───────────────┘
         │              │            │
         └──────────────┼────────────┘
                        │
              ┌─────────▼──────────┐
              │  Coin Integration  │
              │ - Award coins      │
              │ - Track expiry     │
              │ - Attribution      │
              └────────────────────┘
```

---

## AdBazaar Integration

### Overview
AdBazaar is India's first closed-loop ad marketplace. REZ integration enables:
- **QR Scan → Coin Credit:** Users scan ad QR codes, earn coins
- **Attribution Tracking:** AdBazaar tracks which ads drive visits/purchases
- **Merchant Participation:** REZ merchants can list ad space on AdBazaar

### Integration Points

**1. QR Scan Event Webhook** (AdBazaar → REZ)
```typescript
POST /api/webhooks/adbazaar/qr-scan
Content-Type: application/json
X-Signature: <HMAC-SHA256>

{
  "eventId": "evt_uuid",
  "eventType": "qr_scan",
  "timestamp": "2026-04-07T12:00:00Z",
  "campaignId": "camp_123",
  "advertiserId": "adv_456",
  "deviceId": "dev_uuid",
  "qrCode": "https://adbasaar.com/qr/abc123",
  "location": {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "address": "Delhi, India"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "QR scan credited",
  "coinsAwarded": 10,
  "timestamp": "2026-04-07T12:00:01Z"
}
```

**2. Attribution Event** (REZ → AdBazaar)
```typescript
POST {ADBAZAAR_WEBHOOK_URL}
Content-Type: application/json
X-Signature: <HMAC-SHA256>

{
  "eventType": "visit",
  "userId": "user_123",
  "campaignId": "camp_123",
  "advertiserId": "adv_456",
  "merchantId": "merchant_789",
  "timestamp": "2026-04-07T13:00:00Z",
  "metadata": {
    "source": "adbazaar_qr",
    "deviceId": "dev_uuid"
  }
}
```

### Implementation Checklist

- [ ] Configure `ADBAZAAR_WEBHOOK_SECRET` in rez-backend environment
- [ ] Test webhook signature verification
- [ ] Implement coin credit logic (link deviceId to REZ user)
- [ ] Set up coin expiration policy
- [ ] Send attribution events to AdBazaar webhook
- [ ] Monitor webhook delivery success rate
- [ ] Set up error handling for failed webhook delivery
- [ ] Test end-to-end flow: QR scan → coin credit → visit

### Files
- ✅ `rezbackend/src/services/adBazaarIntegration.ts` (350 lines)
- Status: Committed, ready for endpoint implementation

---

## Hotel OTA Integration

### Overview
Hotel OTA integrates with Property Management Systems (PMS) to:
- **Award Coins on Booking:** Users earn coins when they book hotels
- **Track Coin Expiry:** Coins expire 1 year from award date
- **Attribution Tracking:** Connect hotel bookings to REZ ecosystem

### Integration Points

**1. PMS Webhook Events** (PMS → Hotel OTA → REZ)

**Reservation Confirmed:**
```typescript
POST /api/webhooks/pms/reservation-confirmed
Content-Type: application/json
X-Signature: <HMAC-SHA256>

{
  "eventId": "pms_evt_uuid",
  "eventType": "reservation.confirmed",
  "timestamp": "2026-04-07T12:00:00Z",
  "hotelId": "hotel_123",
  "reservationData": {
    "reservationId": "res_456",
    "guestId": "guest_789",
    "guestEmail": "guest@example.com",
    "guestPhone": "+91-9876543210",
    "checkInDate": "2026-04-15",
    "checkOutDate": "2026-04-17",
    "roomNumber": "401",
    "roomType": "Deluxe Suite",
    "totalPrice": 500,
    "currency": "INR",
    "numberOfGuests": 2,
    "numberOfNights": 2
  }
}
```

**Coin Calculation:**
```
Coins Awarded = floor(totalPrice * 0.01)
Example: ₹500 booking → 5 coins
Minimum booking: ₹50
```

**2. Coin Expiration Tracking**

Database schema includes:
- `coin_expiry`: When coins expire
- `CoinExpirationPolicy`: Configurable expiration rules
- `CoinExpirationSchedule`: Track each coin batch

Example policy:
```typescript
{
  name: "Hotel Coins",
  expirationDays: 365,  // 1 year
  notifyBeforeDays: 30  // Reminder 30 days before
}
```

**3. REZ Notification** (Hotel OTA → REZ)
```typescript
POST {REZ_WEBHOOK_URL}
{
  "eventType": "hotel_booking",
  "hotelId": "hotel_123",
  "reservationId": "res_456",
  "guestEmail": "guest@example.com",
  "coinsAwarded": 5,
  "bookingAmount": 500,
  "timestamp": "2026-04-07T12:00:00Z"
}
```

### Implementation Checklist

- [ ] Run Prisma migration for coin expiry schema
- [ ] Configure PMS webhook endpoints
- [ ] Set `pms_webhook_url` and `pms_webhook_secret` for each hotel
- [ ] Implement coin credit logic
- [ ] Set up coin expiration policy
- [ ] Configure expiration notification (30 days before)
- [ ] Send booking events to REZ webhook
- [ ] Test checkout flow: Booking → coin award → expiration tracking
- [ ] Set up cron job for daily coin expiration checks
- [ ] Monitor webhook failure rates

### Files
- ✅ `prisma/migrations/coin_expiry_and_pms_webhook.sql` (150 lines)
- ✅ `apps/api/src/services/pmsWebhookService.ts` (350 lines)
- Status: Committed, ready for endpoint/cron implementation

---

## Webhook Security

### Signature Verification (HMAC-SHA256)

**AdBazaar Signature:**
```typescript
// Verification
signature = HMAC-SHA256(JSON.stringify(payload), ADBAZAAR_WEBHOOK_SECRET)

// Implementation
import crypto from 'crypto';

function verify(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Environment Variables

**rez-backend:**
```bash
ADBAZAAR_WEBHOOK_SECRET=<secret-key>
ADBAZAAR_WEBHOOK_URL=https://api.adbazaar.com/webhooks/attribution
```

**Hotel OTA:**
```bash
REZ_WEBHOOK_URL=https://api.rez.money/api/webhooks/hotel-attribution
PMS_WEBHOOK_SECRET=<secret-key>
```

---

## Deployment Timeline

### Week 1: AdBazaar Integration
- [ ] Implement `/api/webhooks/adbazaar/qr-scan` endpoint
- [ ] Implement coin credit logic
- [ ] Implement attribution webhook to AdBazaar
- [ ] Testing: QR scan → coin award
- [ ] Deploy to production

### Week 2: Hotel OTA Integration
- [ ] Run Prisma migration
- [ ] Implement `/api/webhooks/pms/*` endpoints
- [ ] Implement coin credit logic
- [ ] Implement expiration cron job
- [ ] Testing: Booking → coin award → expiration
- [ ] Deploy to production

### Week 3: Monitoring & Optimization
- [ ] Monitor webhook delivery rates
- [ ] Track coin award statistics
- [ ] Analyze attribution data
- [ ] Optimize coin calculation
- [ ] Set up alerts for webhook failures

---

## Error Handling

### Webhook Failure Scenarios

| Scenario | Action | Retry |
|----------|--------|-------|
| Invalid signature | Log + 403 | No |
| Database error | Log + 500 | Yes (exponential backoff) |
| User not found | Log + create placeholder | No |
| Coin calculation error | Log + skip | No |
| REZ webhook unreachable | Log + queue for retry | Yes |

### Monitoring

```bash
# Check webhook logs
# AdBazaar
tail -f logs/adbazaar-webhook.log | grep -E '(error|success|signature)'

# Hotel OTA
tail -f logs/pms-webhook.log | grep -E '(reservation|checkin|error)'

# Monitor delivery
curl -s https://api.rez.money/api/admin/webhooks/status
```

---

## Testing

### Manual Testing - AdBazaar QR Scan

```bash
curl -X POST https://api.rez.money/api/webhooks/adbazaar/qr-scan \
  -H "Content-Type: application/json" \
  -H "X-Signature: $(generate_signature)" \
  -d '{
    "eventId": "test_evt_001",
    "eventType": "qr_scan",
    "timestamp": "2026-04-07T12:00:00Z",
    "campaignId": "camp_test",
    "advertiserId": "adv_test",
    "deviceId": "dev_test_001",
    "qrCode": "https://test.adbazaar.com/qr/test",
    "location": {"latitude": 28.6139, "longitude": 77.2090}
  }'
```

### Manual Testing - Hotel Booking

```bash
curl -X POST https://hotelota.api/api/webhooks/pms/reservation-confirmed \
  -H "Content-Type: application/json" \
  -H "X-Signature: $(generate_signature)" \
  -d '{
    "eventId": "pms_evt_001",
    "eventType": "reservation.confirmed",
    "hotelId": "hotel_001",
    "reservationData": {
      "reservationId": "res_001",
      "guestEmail": "test@example.com",
      "totalPrice": 500,
      "checkInDate": "2026-04-15",
      "checkOutDate": "2026-04-17"
    }
  }'
```

### Load Testing

```bash
# AdBazaar webhook load test (100 requests/sec for 1 minute)
ab -n 6000 -c 100 -p payload.json \
  -H "X-Signature: signature" \
  https://api.rez.money/api/webhooks/adbazaar/qr-scan
```

---

## Success Metrics

### AdBazaar Integration
- [ ] QR scan webhook success rate > 99.5%
- [ ] Coin credit latency < 500ms
- [ ] Attribution event delivery > 95%
- [ ] User retention: Coin earners return 2x more often

### Hotel OTA Integration
- [ ] Reservation webhook success rate > 99.5%
- [ ] Coin award within 30 seconds of booking confirmation
- [ ] Coin expiry notifications sent 30 days before expiry
- [ ] User adoption: 20%+ of bookings earn coins

### System Health
- [ ] Zero critical webhook errors
- [ ] <0.1% signature verification failures
- [ ] <1% database transaction failures
- [ ] Webhook delivery latency <500ms p95

---

## Rollback Plan

### AdBazaar Rollback
```bash
# Disable webhook processing
export ADBAZAAR_WEBHOOK_ENABLED=false

# Revert coin credits (manual)
UPDATE Wallet SET coins = coins - <amount> WHERE userId = <id>

# Revert code
git revert <commit-hash>
```

### Hotel OTA Rollback
```bash
# Disable PMS webhook processing
export PMS_WEBHOOK_ENABLED=false

# Revert coin credits
UPDATE Wallet SET coins = coins - <amount> WHERE userId = <id>

# Rollback migration
npx prisma migrate resolve --rolled-back <migration-name>
```

---

## Support & Troubleshooting

### AdBazaar Issues
- **Coins not awarded:** Check signature verification, user lookup
- **Attribution not sent:** Check REZ webhook URL, network connectivity
- **High latency:** Check database performance, coin calculation logic

### Hotel OTA Issues
- **Coins not awarded:** Check PMS webhook format, database schema
- **Expiry not tracked:** Check CoinExpirationSchedule table, cron job
- **Migration failed:** Check Prisma version, database compatibility

---

**Integration Status: READY FOR IMPLEMENTATION** 🚀

All code committed and ready for endpoint implementation and testing.

---

Generated: April 7, 2026  
Prepared By: REZ Development Team (claude-flow)  
Next Review: Post-integration testing
