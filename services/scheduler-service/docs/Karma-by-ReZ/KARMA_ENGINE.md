# Karma by ReZ — Karma Engine Logic

## 1. Core Definitions

### Lifetime Karma
- **Never reduced**
- Used for: Level, reputation, badges
- Accumulated across all time

### Active Karma
- **Rolling 30-45 days**
- Used for: Level, conversion rate, trust score
- Resets to 0 if no activity for 60 days

## 2. Level Thresholds

| Level | Active Karma Range | Conversion Rate | Label |
|-------|-------------------|----------------|-------|
| L1    | 0–499             | 25%            | Starter |
| L2    | 500–1999          | 50%            | Contributor |
| L3    | 2000–4999         | 75%            | Champion |
| L4    | 5000+             | 100%           | Legend |

## 3. Karma Calculation

### On Event Completion

```typescript
function calculateKarmaEarned(event: KarmaEvent, hours: number): number {
  let karma = event.baseKarmaPerHour * hours;

  // Impact multiplier
  karma *= event.impactMultiplier;

  // Difficulty multiplier
  switch (event.difficulty) {
    case 'easy': karma *= 1.0; break;
    case 'medium': karma *= 1.5; break;
    case 'hard': karma *= 2.0; break;
  }

  // Cap at maxKarmaPerEvent
  return Math.min(karma, event.maxKarmaPerEvent);
}
```

### Default Base Values

| Category     | Base Karma/Hour | Impact Multiplier |
|-------------|-----------------|-------------------|
| Environment | 50              | 1.2 (trees planted = tracked) |
| Food        | 40              | 1.0               |
| Health      | 60              | 1.5 (medical)     |
| Education   | 55              | 1.3               |
| Community   | 45              | 1.0               |

## 4. Decay System

### Decay Rules

Decay runs daily via cron job at 00:00 UTC.

```typescript
function applyDailyDecay(profile: KarmaProfile): KarmaProfileDelta {
  const daysSinceLastActivity = daysBetween(profile.lastActivityAt, new Date());

  let decayRate = 0;
  if (daysSinceLastActivity >= 60) {
    decayRate = 0.70; // Reset to near zero
  } else if (daysSinceLastActivity >= 45) {
    decayRate = 0.40;
  } else if (daysSinceLastActivity >= 30) {
    decayRate = 0.20;
  }

  if (decayRate === 0) return { activeKarmaChange: 0, levelChange: false };

  const oldLevel = profile.level;
  const newActiveKarma = Math.floor(profile.activeKarma * (1 - decayRate));

  // Recalculate level based on new active karma
  const newLevel = calculateLevel(newActiveKarma);

  return {
    activeKarmaChange: newActiveKarma - profile.activeKarma,
    levelChange: newLevel !== oldLevel,
    oldLevel,
    newLevel,
  };
}
```

### Level Drop After Decay

```typescript
function calculateLevel(activeKarma: number): 'L1' | 'L2' | 'L3' | 'L4' {
  if (activeKarma >= 5000) return 'L4';
  if (activeKarma >= 2000) return 'L3';
  if (activeKarma >= 500) return 'L2';
  return 'L1';
}
```

## 5. Trust Score

Trust Score (0-100) is calculated from:

| Factor              | Weight | Description |
|--------------------|--------|-------------|
| Completion rate     | 30%    | % of joined events actually completed |
| Approval rate       | 25%    | % of check-ins approved by NGO |
| Consistency         | 20%    | Regularity of participation |
| Impact quality      | 15%    | Based on difficulty of events done |
| Verification signal | 10%    | Strength of verification signals |

```typescript
function calculateTrustScore(profile: KarmaProfile): number {
  const completionRate = profile.eventsJoined > 0
    ? profile.eventsCompleted / profile.eventsJoined
    : 0;

  const approvalRate = profile.checkIns > 0
    ? profile.approvedCheckIns / profile.checkIns
    : 0;

  // Consistency: standard deviation of activity days
  const consistency = calculateConsistencyScore(profile.activityHistory);

  // Average difficulty of events (normalized 0-1)
  const impactQuality = profile.avgEventDifficulty;

  // Average verification signal strength
  const verificationStrength = profile.avgConfidenceScore;

  return Math.round(
    (completionRate * 30) +
    (approvalRate * 25) +
    (consistency * 20) +
    (impactQuality * 15) +
    (verificationStrength * 10)
  );
}
```

## 6. Conversion Calculation

```typescript
interface ConversionInput {
  karmaEarned: number;
  activeKarmaAtApproval: number; // snapshot
  conversionRateAtApproval: number; // snapshot
}

function calculateConversion(input: ConversionInput): number {
  return Math.floor(input.karmaEarned * input.conversionRateAtApproval);
}

function applyCaps(coins: number, profile: KarmaProfile): number {
  // Per-user weekly cap: 300 coins
  const WEEKLY_CAP = 300;
  const weeklyEarned = profile.thisWeekKarmaEarned || 0;
  const weeklyRemaining = Math.max(0, WEEKLY_CAP - weeklyEarned);
  return Math.min(coins, weeklyRemaining);
}
```

## 7. Level-Up Notifications

When active karma crosses a threshold:
- Trigger push notification: "You've leveled up to L3!"
- Award badge if new level
- Log to levelHistory in KarmaProfile

## 8. Event Karma Config

| Event Type    | Base/Hour | Impact Multi | Difficulty | Max/Event |
|---------------|-----------|-------------|-----------|-----------|
| Tree plantation | 50      | 1.2         | easy      | 400       |
| Lake cleanup   | 60        | 1.5         | medium    | 480       |
| Food drive     | 40        | 1.0         | easy      | 320       |
| Medical camp  | 70        | 1.5         | hard      | 560       |
| Teaching       | 55        | 1.3         | medium    | 440       |
| Blood donation | 100       | 2.0         | hard      | 800       |
