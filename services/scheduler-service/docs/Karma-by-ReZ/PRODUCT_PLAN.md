# Karma by ReZ — Product Plan

> **"Do Good → Earn Karma → Unlock Value"**
> India's Impact Economy Platform

---

## 1. Positioning

**What users think:**
> "I use Karma to do good and get rewarded"

**What actually happens:**
- CSR engine for corporates
- User acquisition funnel for ReZ
- Merchant growth loop

**Positioning:** "India's Impact Economy Platform"

---

## 2. Core Loop

```
User completes real-world good action
    ↓
Earn KarmaPoints (identity layer)
    ↓
Auto-convert to ReZ Coins (value layer)
    ↓
Spend anywhere in ReZ ecosystem
```

---

## 3. 3-Layer Economy

### Layer 1: Action Layer (Karma App)
- Volunteering
- CSR activities
- Impact events

### Layer 2: Identity Layer (KarmaPoints)
- Tracks impact, consistency, trust
- Active Karma (rolling 30-45 days) — drives everything
- Lifetime Karma — identity only

### Layer 3: Value Layer (ReZ Wallet)
- ReZ Coins (universal)
- Branded Coins (merchant-specific)

---

## 4. Conversion System

### Conversion Table (Final)

| Level | Active Karma Range | Conversion Rate |
|-------|-------------------|-----------------|
| L1    | 0–500             | 25%             |
| L2    | 500–2000          | 50%             |
| L3    | 2000–5000         | 75%             |
| L4    | 5000+             | 100%            |

### Decay Mechanism (Tied Directly to Rate)

| No Activity  | Decay  |
|--------------|--------|
| 30 days      | -20%   |
| 45 days      | -40%   |
| 60 days      | -70%   |

**Rule:** Rate = Active Karma level. Decay hits the rate AND level simultaneously. One lever, not two.

### Example
User hits L4 (100% rate), stops activity:
- After 45 days: Active Karma drops → now L2 → Conversion rate = 50%
- No loopholes. No dual systems. Clean.

---

## 5. Verification System (Multi-Layer Confidence Scoring)

### Layers

| Layer | Signal          | Weight   |
|-------|----------------|----------|
| 1     | QR check-in    | High     |
| 1     | QR check-out   | High     |
| 2     | GPS match      | Medium   |
| 3     | NGO approval   | Very High|
| 4     | Photo proof    | Medium   |

**Rule:** Verification = confidence score, not binary pass/fail.

### Real-World Edge Cases

1. **User forgets checkout:** Auto-checkout after X hours, mark "partial completion"
2. **NGO no smartphone:** Bulk upload via BizOS / admin verification
3. **GPS inaccurate:** Use as supporting signal only, don't hard reject

### Confidence Score Calculation

```
score = (qr_in × 0.3) + (qr_out × 0.3) + (gps × 0.15) + (ngo × 0.4) + (photo × 0.1)
if score >= 0.6 → APPROVED
```

---

## 6. Branded Coins — Unit Economics

### CFO Pitch

**For every ₹1 spent in rewards, generate ₹4–6 in gross profit.**

| Metric          | Value                |
|-----------------|----------------------|
| Coins issued    | 100 per user         |
| Face value      | ₹1/coin             |
| Redemption rate | 40%                  |
| AOV             | ₹400                 |
| Gross margin    | 60%                  |
| Cost            | ₹40 (100 × 0.4)     |
| Revenue         | ₹400 × 60% = ₹240   |
| **Net ROI**     | **6x**               |

### Why Better Than Discounts

| Traditional Discount | Karma System         |
|---------------------|---------------------|
| Given to everyone   | Only verified users |
| High leakage        | Controlled redemption|
| No story            | CSR + impact narrative|
| No targeting        | Event-based targeting|

---

## 7. Phase 1 MVP (6 weeks)

### What to Build

- Karma App (basic UI)
- Event listing + join
- QR check-in/out
- NGO manual approval
- KarmaPoints earning
- **Manual conversion** (admin-triggered weekly batch)

### What NOT to Build Yet

- Auto conversion
- Branded coins
- Social feed
- Leaderboards
- AI validation

### Phase 2 (Months 2–4)

- CSR dashboard
- Branded coins
- Auto conversion
- Leaderboards

### Phase 3 (Months 4–6)

- AI fraud detection
- Advanced analytics
- Social feed

---

## 8. Success Metrics

- Event participation rate
- Completion rate
- Cost per volunteer
- Conversion to ReZ usage
- Trust score distribution

---

## 9. GTM Strategy

### City: Bangalore (pilot)

### Step 1: Anchor Supply
- 3 NGOs (signed MoU)
- 1 CSR partner (₹2–5L pilot budget)
- 2 redemption brands

### Step 2: Launch Campaign
- "Do 1 good act → get ₹200 value"

### Step 3: College Push
- Students = early adopters

### Step 4: Scale
- From Bangalore → other cities

---

## 10. Team

- 1 Backend Engineer
- 1 Frontend / Mobile Engineer
- 1 Product/Founder (you driving + QA)
- 6–7 weeks for Phase 1 MVP

---

## 11. Ecosystem Distribution — Cross-App Trust Signals

Karma by ReZ is the **trust identity layer** for the entire ReZ ecosystem. Karma scores flow into other ReZ apps as verified trust signals, creating a compounding network effect.

### How It Works

Other apps fetch karma profiles by `rezUserId` via HTTP — no schema changes, no data sync. The `rezKarmaClient` pattern is copy-paste-ready for any service.

```
GET /api/karma/user/:rezUserId  →  { level, trustScore, eventsCompleted, badges }
```

- 5-second timeout, silent fallback on errors
- 404 = user hasn't used Karma yet (not an error)
- `null` responses handled gracefully in every consuming app

### Rendez Dating App (Live)

Implemented in:
- `Rendez/rendez-backend/src/integrations/rez/rezKarmaClient.ts` — HTTP client
- `Rendez/rendez-backend/src/routes/profile.ts` — enriches profile response
- `Rendez/rendez-app/src/screens/ProfileScreen.tsx` — own profile karma card
- `Rendez/rendez-app/src/screens/ProfileDetailScreen.tsx` — others' profile trust badges

**What users see:**
- Own profile: amber card with `🌍 Karma L3 · 82 trust score · 12 events completed`
- Others' profiles: amber trust badge `🌍 Karma L3 · 82 pts · 12 events` on the profile header
- "Verified meetups" + "Karma level" create a layered trust signal before a first date

### AdBazaar (Next)

Same pattern — karma level on seller profiles:
- `🌍 Karma L3` badge next to seller name
- Trust score displayed on listing pages
- High-karma sellers get a "Verified Impact" label

### Hotel OTA (Next)

Host trust on booking pages:
- `🌍 Karma L4` badge on host profiles
- "12 verified events" as social proof
- Karma level as a ranking factor in host search

### ReZ Admin Dashboard (Live)

Admin-facing karma views:
- Full karma profile lookup
- Batch management
- CSR pool tracking
- Fraud detection flags

### Why This Matters

1. **Cold start solved**: ReZ is the distribution engine — promote Karma inside ReZ, users flow to the Karma app
2. **Trust compounds**: More karma users → more trust signals in every app → higher conversion everywhere
3. **No data coupling**: Each app is independent; karma service is the single source of truth
4. **Earn once, trust everywhere**: One verified event earns karma AND boosts trust in Dating, AdBazaar, Hotels — no duplicate verification
