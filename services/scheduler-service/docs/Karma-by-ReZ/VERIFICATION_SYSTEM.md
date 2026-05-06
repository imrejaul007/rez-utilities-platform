# Karma by ReZ — Verification System

## 1. Verification Philosophy

> Verification = confidence score, not binary pass/fail.

The system accumulates multiple signals and scores them. High confidence → automatic approval. Low confidence → manual review.

## 2. Signal Weights

| Signal        | Source          | Weight | Type |
|---------------|----------------|--------|------|
| QR check-in   | User scan       | 0.30   | Binary |
| QR check-out  | User scan       | 0.30   | Binary |
| GPS match     | Auto (on scan)  | 0.15   | Score |
| NGO approval  | NGO dashboard   | 0.40   | Binary |
| Photo proof   | User upload     | 0.10   | Binary |

## 3. Confidence Score Formula

```typescript
function calculateConfidenceScore(signals: VerificationSignals): number {
  let score = 0;

  if (signals.qr_in) score += 0.30;
  if (signals.qr_out) score += 0.30;

  // GPS match is a score (0-1), not binary
  score += signals.gps_match * 0.15;

  if (signals.ngo_approved) score += 0.40;

  if (signals.photo_proof) score += 0.10;

  return Math.round(score * 100) / 100;
}

interface VerificationSignals {
  qr_in: boolean;
  qr_out: boolean;
  gps_match: number; // 0-1, distance-based
  ngo_approved: boolean;
  photo_proof: boolean;
}
```

## 4. Approval Thresholds

| Score Range | Status | Action |
|------------|--------|--------|
| >= 0.60    | verified | Auto-approve, create EarnRecord |
| 0.40–0.59  | partial  | Flag for NGO review |
| < 0.40     | rejected | Notify user, no karma |

## 5. Check-In Flow

### QR Check-In
```
User opens Karma app
    ↓
Scans QR code at event venue
    ↓
App sends: userId, eventId, qrCode, gpsCoords
    ↓
Server validates:
  - QR code matches event's checkIn code
  - GPS within radius of event venue
  - User registered for event
    ↓
Record: qrCheckedIn = true, qrCheckedInAt = now, gpsCheckIn = coords
    ↓
Update verificationStatus: 'partial' (or 'verified' if score >= 0.6)
```

### QR Check-Out
```
User scans check-out QR at end of event
    ↓
App sends: userId, eventId, qrCode, gpsCoords
    ↓
Server validates + records
    ↓
Calculate confidence score
    ↓
If score >= 0.6: Create EarnRecord (APPROVED_PENDING_CONVERSION)
If score < 0.6: Flag for NGO review
    ↓
Notify user of status
```

### GPS Check-In (Fallback)
```
If QR scan fails (no internet, QR damaged):
    ↓
App detects location is within event GPS radius
    ↓
Ask user: "Check in via GPS?"
    ↓
Record: gpsCheckIn = true (no QR)
    ↓
Confidence score gets lower weight
    ↓
NGO must approve manually
```

## 6. Edge Cases

### User Forgets to Check Out
```typescript
async function handleForgottenCheckout(eventId: string, bookingId: string) {
  const event = await Event.findById(eventId);
  const booking = await EventBooking.findById(bookingId);

  const eventEndTime = moment(booking.eventDate).add(event.expectedDurationHours, 'hours');

  // If current time > event end + 1 hour grace period
  if (moment().isAfter(moment(eventEndTime).add(1, 'hours'))) {
    // Auto-checkout with partial score
    booking.qrCheckedOut = true;
    booking.qrCheckedOutAt = moment(eventEndTime).toDate(); // retroactive
    booking.verificationStatus = 'partial';
    booking.notes = 'Auto-checkout: user forgot to check out';

    await booking.save();

    // Notify user
    await sendNotification(booking.userId, {
      title: 'Auto check-out recorded',
      body: 'We recorded your check-out. An NGO will verify your attendance.',
    });
  }
}
```

### NGO Doesn't Have Smartphone
```
Solution: Bulk attendance via BizOS (ReZ Merchant)
    ↓
NGO downloads CSV of registered volunteers
    ↓
Checks off attendees on paper during event
    ↓
Uploads completed CSV via BizOS
    ↓
System processes: ngoApproved = true for all
    ↓
Confidence score: QR=missing (0) + NGO=approved (0.4) = 0.4 → partial → needs review
    ↓
Admin reviews and approves
```

### GPS Inaccurate
```
GPS = supporting signal only (weight = 0.15)
    ↓
Never hard-reject based on GPS alone
    ↓
If GPS mismatch but QR + NGO approved: still APPROVED
    ↓
GPS helps boost partial scores to approved
```

### Late Approval
```
NGO approves 3 days after event:
    ↓
EarnRecord already created with status = APPROVED_PENDING_CONVERSION
    ↓
NGO approval updates: ngoApproved = true, confidenceScore recalculated
    ↓
EarnRecord stays in pending batch (no re-trigger)
    ↓
Included in next weekly batch
```

## 7. Fraud Detection

```typescript
async function detectFraudAnomalies(bookingId: string): Promise<FraudAlert[]> {
  const booking = await EventBooking.findById(bookingId);
  const user = await User.findById(booking.userId);
  const alerts: FraudAlert[] = [];

  // Anomaly 1: Same GPS for all check-ins
  const recentBookings = await EventBooking.find({
    userId: user._id,
    qrCheckedInAt: { $gte: moment().subtract(30, 'days').toDate() },
  });

  const gpsLocations = recentBookings.map(b => `${b.gpsCheckIn?.lat},${b.gpsCheckIn?.lng}`);
  const uniqueLocations = new Set(gpsLocations);
  if (uniqueLocations.size <= 2 && recentBookings.length >= 5) {
    alerts.push({ type: 'suspicious_gps', severity: 'high', message: 'User checked in from same locations' });
  }

  // Anomaly 2: Instant check-in/out (impossible travel)
  if (booking.qrCheckedInAt && booking.qrCheckedOutAt) {
    const minutesBetween = moment(booking.qrCheckedOutAt).diff(moment(booking.qrCheckedInAt), 'minutes');
    if (minutesBetween < 5) {
      alerts.push({ type: 'impossible_duration', severity: 'high', message: 'Check-in to check-out in < 5 minutes' });
    }
  }

  // Anomaly 3: Same timestamp from multiple users
  const sameTimestampCount = await EventBooking.countDocuments({
    eventId: booking.eventId,
    qrCheckedInAt: { $gte: moment(booking.qrCheckedInAt).subtract(1, 'minute').toDate(), $lte: moment(booking.qrCheckedInAt).add(1, 'minute').toDate() },
  });
  if (sameTimestampCount > 5) {
    alerts.push({ type: 'batch_fake_signals', severity: 'critical', message: 'Multiple users checked in at identical timestamp' });
  }

  return alerts;
}
```

## 8. Admin Review Dashboard

**Anomalies shown:**
- Pending reviews sorted by anomaly count
- Per-user history
- Per-NGO approval rates (flag NGOs with >10% anomalous approvals)
- Kill switch: pause all conversions if anomaly rate > 5%

## 9. QR Code Generation

```typescript
async function generateEventQRCodes(eventId: string): Promise<{ checkIn: string; checkOut: string }> {
  const event = await KarmaEvent.findById(eventId);
  const secret = process.env.QR_SECRET;

  const checkInPayload = {
    eventId: event._id,
    type: 'check_in',
    ts: Date.now(),
    sig: crypto.createHmac('sha256', secret).update(`${event._id}:check_in:${Date.now()}`).digest('hex').slice(0, 16),
  };

  const checkOutPayload = {
    eventId: event._id,
    type: 'check_out',
    ts: Date.now(),
    sig: crypto.createHmac('sha256', secret).update(`${event._id}:check_out:${Date.now()}`).digest('hex').slice(0, 16),
  };

  event.qrCodes = {
    checkIn: Buffer.from(JSON.stringify(checkInPayload)).toString('base64'),
    checkOut: Buffer.from(JSON.stringify(checkOutPayload)).toString('base64'),
  };

  await event.save();
  return event.qrCodes;
}
```
