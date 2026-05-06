# Motion & Interaction Design Audit — Luca Romano
**Date:** March 23, 2026
**Focus:** 100ms feedback, reward delight loops, transition continuity

---

## Executive Summary
Both consumer and merchant apps demonstrate **solid animation foundations** with react-native-reanimated integration. Key strengths: shimmer skeleton loaders, reward popups with spring animations, and pull-to-refresh controls. **Primary gaps:** Button visual feedback inconsistency, missing scale animations on coin earning moments, and no celebratory animations on success screens.

---

## CONSUMER APP (Nuqta) — Key Findings

### ✅ What's Working
1. **Shimmer Skeleton Loaders** (`SkeletonLoader.tsx`)
   - 1.5s smooth shimmer with purple tint (using native driver)
   - Applied to: wallet snapshots, transaction lists, form pages
   - Uses `Animated.loop + interpolate` correctly

2. **Reward Unlock Popup** (`RewardUnlockedPopup.tsx`)
   - Spring entrance animation (scale: 0.9 → 1, damping: 6)
   - Auto-dismiss with smooth exit (250ms fade)
   - Haptic feedback on trigger
   - **But:** No scale pulse on coin amount display after earn event

3. **Pull-to-Refresh**
   - Implemented on home feed & transaction history
   - Standard RefreshControl with tintColor

4. **Core Dependencies**
   - react-native-reanimated: ~3.17.4 ✅
   - react-native-gesture-handler: ~2.24.0 ✅

### ⚠️ Critical Gaps

#### 1. **Button Feedback (HIGH PRIORITY)**
- **Issue:** Pressable components lack activeOpacity or pressed state styles
- **Impact:** Users don't know button was tapped within 100ms
- **Files affected:** `(tabs)/index.tsx`, `PremiumStoreCard.tsx`, many screen headers
- **Example:** Location pill, header action buttons have no visual feedback
- **Fix needed:** Add `android_ripple` and pressed state animations to all Pressable components

#### 2. **Coin Earn Animations (MEDIUM PRIORITY)**
- **Issue:** Balance updates show no visual celebration when coins earned
- **Location:** `wallet-screen.tsx`, wallet display components
- **Current:** Simple text update with no animation
- **Fix needed:** Add 1.0 → 1.2 → 1.0 spring scale animation on coin balance display when new coins earned

#### 3. **Success Screen Celebrations (MEDIUM PRIORITY)**
- **Files:** `payment-success.tsx`, `deal-success.tsx`, `flash-sale-success.tsx`
- **Current:** Static screens with no celebration animation
- **Missing:** Checkmark draw animation, scale bounce, or confetti particle effect
- **Fix needed:** Add animated checkmark (SVG path animation) + scale pop animation

#### 4. **Cart FAB Animation (LOW PRIORITY)**
- **Current:** No bounce-in when items added
- **Fix needed:** Monitor cart item count changes → trigger scale pop when count increases

---

## MERCHANT APP (rez-merchant-master) — Key Findings

### ✅ What's Working
1. **Appointment Drag Animation** (`appointments/calendar.tsx`)
   - Long-press + pan gesture with spring physics
   - Scale: 1 → 1.08, shadow elevation animated
   - Uses `withSpring()` correctly
   - **But:** Spring config not explicitly shown; verify tension/friction values

2. **Package Dependencies**
   - react-native-reanimated: ~3.17.4 ✅
   - react-native-animatable: ^1.4.0 (utility lib for common animations)
   - react-native-gesture-handler: ~2.24.0 ✅

### ⚠️ Critical Gaps

#### 1. **Button Feedback (HIGH PRIORITY)**
- **Issue:** TouchableOpacity & Pressable lack activeOpacity consistency
- **Example:** `appointments/calendar.tsx` line 161 — `activeOpacity={0.8}` hardcoded
- **Fix needed:** Standardize activeOpacity to 0.7 or create PressableButton wrapper

#### 2. **Loading State Animations (MEDIUM PRIORITY)**
- **Current:** ActivityIndicator spinners on data load screens
- **Fix needed:** Replace with shimmer skeleton loaders for form pages, dashboard cards

#### 3. **Navigation Tab Animation (MEDIUM PRIORITY)**
- **Current:** Bottom tab bar has no spring animation on tab switch
- **Fix needed:** Add scale + fade animation when switching tabs

---

## AUDIT CHECKLIST

| Item | Consumer | Merchant | Status |
|------|----------|----------|--------|
| TouchableOpacity/Pressable visual feedback | ❌ | ⚠️ | Needs 100ms feedback |
| Coin earning scale animation | ❌ | N/A | Missing |
| Scratch card reveal animation | ❌ | N/A | Not found |
| Bottom tab bar spring | ✅ (pull-refresh) | ❌ | Needs work |
| Loading shimmer skeleton | ✅ 3 screens | ❌ | Missing in merchant |
| Success screen celebration | ❌ | N/A | Static screens |
| Pull-to-refresh | ✅ | ✅ (calendar) | Good |
| Animated.Value spring (useNativeDriver: true) | ✅ | ✅ | Good |
| Appointment calendar drag spring | N/A | ✅ | Config needs review |
| Cart FAB bounce | ❌ | N/A | Missing |

---

## Recommended Implementation Order

### Phase 1: Button Feedback (Highest ROI for 100ms targets)
1. Create `components/ui/AnimatedPressable.tsx` wrapper
2. Add `android_ripple` + press state scale animation
3. Apply to all interactive elements in main flows
4. **Estimated time:** 4 hours

### Phase 2: Reward Animations
1. Add coin balance scale animation trigger on earn
2. Enhance reward popup with coin counter animation
3. Add to payment success & referral screens
4. **Estimated time:** 3 hours

### Phase 3: Success Screen Celebration
1. Create `SVGPathAnimation.tsx` for checkmark draw
2. Add scale bounce + fade entrance
3. Apply to payment-success, deal-success, verification-success
4. **Estimated time:** 4 hours

### Phase 4: Merchant Improvements
1. Add shimmer skeletons to dashboard loading states
2. Enhance tab bar with spring animations
3. Verify appointment calendar spring config (tension/friction)
4. **Estimated time:** 3 hours

---

## Spring Physics Baseline (ReZ Standard)

All spring animations should use:
```
tension: 150    // Controls responsiveness
friction: 20    // Controls bounciness (20-25 typical)
mass: 1
```

**Exception:** Rewards popup uses `damping: 6` with custom spring curve (acceptable for UX reason: delight moment).

---

## File Locations for Review

### Consumer App
- `/app/(tabs)/index.tsx` — Home tab with Pressable header buttons
- `/app/wallet-screen.tsx` — Wallet display (coin earning)
- `/app/payment-success.tsx` — Success celebration point
- `/components/gamification/RewardUnlockedPopup.tsx` — Good baseline for celebration UX
- `/components/skeletons/SkeletonLoader.tsx` — Shimmer implementation (solid)

### Merchant App
- `/app/appointments/calendar.tsx` — Drag animation reference
- `/app/(dashboard)/**` — Dashboard screens (need skeleton loaders)
- `/_layout.tsx` — Tab bar configuration

---

## Notes for Implementation

1. **100ms Feedback Rule:** All user interactions (button tap, tab switch, gesture end) must have visual feedback within 100ms. Use `useNativeDriver: true` for animations.

2. **Reward Delight:** When coins earned, trigger a cascading sequence:
   - Coins appear in balance with 1.2x scale bounce
   - Reward popup slides in with spring entrance
   - Haptic feedback triggers
   - Total duration: 800-1000ms

3. **Transition Continuity:** Ensure navigation stack animations don't conflict with gesture animations. Use `useTransitionLayout` to coordinate entering/exiting animations.

4. **Web Support:** Test all animations on web (platform.OS !== 'web' checks are already in place for haptics).

---

**Audit Completed By:** Luca Romano (REZ Motion & Interaction Designer)
**Audit Date:** March 23, 2026
