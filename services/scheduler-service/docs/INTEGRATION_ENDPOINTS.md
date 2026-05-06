# REZ Integration Endpoints Documentation

**Date:** April 8, 2026  
**Status:** ✅ **PRODUCTION READY**  
**Scope:** AdBazaar + Hotel OTA + REZ Backend Integration

---

## Quick Reference

| Integration | Endpoint | Method | Purpose | Signature |
|-------------|----------|--------|---------|-----------|
| AdBazaar | `/api/webhooks/adbazaar/qr-scan` | POST | QR scan coin credit | HMAC-SHA256 |
| Hotel OTA | `/api/webhooks/pms/reservation-confirmed` | POST | Booking coin award | HMAC-SHA256 |
| Hotel OTA | `/api/webhooks/pms/guest-checkin` | POST | Check-in event | HMAC-SHA256 |
| Hotel OTA | `/api/webhooks/pms/guest-checkout` | POST | Check-out event | HMAC-SHA256 |
| Hotel OTA | `/api/webhooks/pms/reservation-cancelled` | POST | Cancellation refund | HMAC-SHA256 |

---

## AdBazaar Integration

### Endpoint: POST /api/webhooks/adbazaar/qr-scan

**Base URL**: `https://api.rez.money` (or your rez-backend URL)

**Description**: Handles QR code scan events from AdBazaar. Users scan ad QR codes and earn coins based on campaign configuration.

**Authentication**: HMAC-SHA256 signature in `X-Signature` header

**Request Headers**:
```
Content-Type: application/json
X-Signature: <HMAC-SHA256-hex>
```

**Request Body**:
```json
{
  "eventId": "evt_uuid",
  "eventType": "qr_scan",
  "timestamp": "2026-04-08T12:00:00Z",
  "campaignId": "camp_123",
  "advertiserId": "adv_456",
  "deviceId": "dev_uuid",
  "qrCode": "https://adbazaar.com/qr/abc123",
  "adFormat": "billboard",
  "location": {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "address": "Delhi, India"
  },
  "userAgent": "Mozilla/5.0...",
  "ipAddress": "203.0.113.42"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "QR scan credited",
  "coinsAwarded": 10,
  "timestamp": "2026-04-08T12:00:01Z"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing X-Signature
- `400 Bad Request`: Missing required fields (eventId, campaignId, deviceId)
- `500 Internal Server Error`: Processing error

**Signature Verification**:
```typescript
import crypto from 'crypto';

function verifySignature(payload, signature, secret) {
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

**Implementation File**: [`rezbackend/src/routes/adBazaarIntegration.ts`](../rezbackend/rez-backend-master/src/routes/adBazaarIntegration.ts)

**Service File**: [`rezbackend/src/services/adBazaarIntegration.ts`](../rezbackend/rez-backend-master/src/services/adBazaarIntegration.ts)

---

## Hotel OTA Integration

### Endpoint 1: POST /api/webhooks/pms/reservation-confirmed

**Base URL**: `https://hotelota.api` (or your hotel-ota URL)

**Description**: Handles PMS reservation confirmation events. Awards coins to users when they book hotels.

**Coin Calculation**:
```
Coins = floor(totalPrice * 0.01)
Minimum booking: ₹50
Example: ₹500 booking → 5 coins
```

**Request Headers**:
```
Content-Type: application/json
X-Signature: <HMAC-SHA256-hex>
```

**Request Body**:
```json
{
  "eventId": "pms_evt_uuid",
  "eventType": "reservation.confirmed",
  "timestamp": "2026-04-08T12:00:00Z",
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
    "numberOfNights": 2,
    "status": "confirmed"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Reservation confirmed and coins awarded",
  "coinsAwarded": 5
}
```

**Coin Expiration**: Coins expire 1 year from award date. Notification sent 30 days before expiry.

---

### Endpoint 2: POST /api/webhooks/pms/guest-checkin

**Description**: Handles guest check-in events from PMS system.

**Request Body**:
```json
{
  "eventId": "pms_evt_uuid",
  "eventType": "guest.checkin",
  "timestamp": "2026-04-15T14:00:00Z",
  "hotelId": "hotel_123",
  "reservationData": {
    "reservationId": "res_456",
    "guestEmail": "guest@example.com",
    "checkInDate": "2026-04-15"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Check-in processed"
}
```

---

### Endpoint 3: POST /api/webhooks/pms/guest-checkout

**Description**: Handles guest check-out events from PMS system.

**Request Body**:
```json
{
  "eventId": "pms_evt_uuid",
  "eventType": "guest.checkout",
  "timestamp": "2026-04-17T11:00:00Z",
  "hotelId": "hotel_123",
  "reservationData": {
    "reservationId": "res_456",
    "guestEmail": "guest@example.com",
    "checkOutDate": "2026-04-17"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Check-out processed"
}
```

---

### Endpoint 4: POST /api/webhooks/pms/reservation-cancelled

**Description**: Handles reservation cancellations. Refunds coins if already awarded.

**Request Body**:
```json
{
  "eventId": "pms_evt_uuid",
  "eventType": "reservation.cancelled",
  "timestamp": "2026-04-08T15:00:00Z",
  "hotelId": "hotel_123",
  "reservationData": {
    "reservationId": "res_456",
    "guestEmail": "guest@example.com",
    "totalPrice": 500
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Reservation cancelled",
  "coinsAwarded": -5
}
```

**Implementation File**: [`hotel-ota/apps/api/src/routes/pms.routes.ts`](../Hotel\ OTA/apps/api/src/routes/pms.routes.ts)

**Service File**: [`hotel-ota/apps/api/src/services/pmsWebhookService.ts`](../Hotel\ OTA/apps/api/src/services/pmsWebhookService.ts)

---

## Signature Verification (HMAC-SHA256)

All webhook endpoints require HMAC-SHA256 signature verification.

**Algorithm**:
```
signature = HMAC-SHA256(JSON.stringify(payload), webhook_secret)
output format: hex string
comparison: constant-time (crypto.timingSafeEqual)
```

**Implementation Example**:
```typescript
import crypto from 'crypto';

function verifyPMSSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## Error Handling

### Standard Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Event processed |
| 400 | Bad Request | Invalid payload, missing fields |
| 401 | Unauthorized | Invalid or missing signature |
| 409 | Conflict | Duplicate event (idempotency) |
| 500 | Internal Error | Server error, safe to retry |

### Retry Policy

**Recommended for integrators**:
- Implement exponential backoff
- Retry on 5xx errors and network timeouts
- Do NOT retry on 4xx errors (except timeouts)
- Max retries: 3 with 5s, 10s, 30s delays

---

## Testing

### Manual Test - AdBazaar QR Scan

```bash
SIGNATURE=$(echo -n '{payload}' | openssl dgst -sha256 -hmac "your_adbazaar_secret" | awk '{print $NF}')

curl -X POST https://api.rez.money/api/webhooks/adbazaar/qr-scan \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d '{
    "eventId": "test_evt_001",
    "eventType": "qr_scan",
    "timestamp": "2026-04-08T12:00:00Z",
    "campaignId": "camp_test",
    "advertiserId": "adv_test",
    "deviceId": "dev_test_001",
    "qrCode": "https://adbazaar.com/qr/test",
    "adFormat": "billboard",
    "location": {"latitude": 28.6139, "longitude": 77.2090},
    "ipAddress": "203.0.113.42"
  }'
```

### Manual Test - Hotel PMS Reservation

```bash
SIGNATURE=$(echo -n '{payload}' | openssl dgst -sha256 -hmac "your_pms_secret" | awk '{print $NF}')

curl -X POST https://hotelota.api/api/webhooks/pms/reservation-confirmed \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIGNATURE" \
  -d '{
    "eventId": "pms_evt_001",
    "eventType": "reservation.confirmed",
    "timestamp": "2026-04-08T12:00:00Z",
    "hotelId": "hotel_001",
    "reservationData": {
      "reservationId": "res_001",
      "guestEmail": "test@example.com",
      "guestPhone": "+91-9876543210",
      "checkInDate": "2026-04-15",
      "checkOutDate": "2026-04-17",
      "roomNumber": "401",
      "roomType": "Deluxe Suite",
      "totalPrice": 500,
      "currency": "INR",
      "numberOfGuests": 2,
      "numberOfNights": 2,
      "status": "confirmed"
    }
  }'
```

---

## Monitoring & Logging

All webhook events are logged with:
- Event ID
- Integration name
- Event type
- Timestamp
- Processing status (success/failure)
- Error messages if applicable

**Log Search**:
```bash
# AdBazaar webhooks
tail -f logs/adbazaar-webhook.log | grep -E '(qr_scan|error)'

# PMS webhooks
tail -f logs/pms-webhook.log | grep -E '(reservation|checkin|checkout|error)'

# Combined webhook activity
tail -f logs/webhooks.log | grep 'signature\|error\|success'
```

---

## Health Check Endpoints

**API Gateway Health**:
```bash
curl https://rez-api-gateway.onrender.com/health
```

**REZ Backend Health**:
```bash
curl https://api.rez.money/health
```

**Hotel OTA Health**:
```bash
curl https://hotelota.api/health
```

---

## Related Documentation

- [INTEGRATION_RUNBOOK.md](INTEGRATION_RUNBOOK.md) - Full integration guide with deployment timeline
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - All required environment variables
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Pre-deployment checklist
- [MONITORING_GUIDE.md](MONITORING_GUIDE.md) - Monitoring and alerting setup
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and fixes
- [PHASE_6_API_GATEWAY_OPTIMIZATION.md](PHASE_6_API_GATEWAY_OPTIMIZATION.md) - API Gateway optimization details

---

**Generated:** April 8, 2026  
**Last Updated:** April 8, 2026  
**Prepared By:** REZ Development Team (claude-flow)
