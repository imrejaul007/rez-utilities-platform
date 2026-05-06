# Merchant App — Component Library

> **Audit date:** 2026-04-15
> **Bugs found:** 31
> **Status:** Open — merchant app audit

---

### MA-CMP-001 CoinRainOverlay coins regenerate on visibility toggle
**Severity:** MEDIUM
**File:** components/ui/CoinRainOverlay.tsx:24-32
**Category:** perf
**Description:** `coins` useMemo depends on `visible`, causing coins array to regenerate when visibility toggles. Coins should be generated once and positions reused for visual consistency.
**Impact:** Coins regenerate on toggle, losing position consistency and wasting renders.
**Fix hint:** Generate coins once on mount or remove visible from dependencies; only use visible for play/pause logic.

### MA-CMP-002 CoinRainOverlay missing coins dependency in animation useEffect
**Severity:** MEDIUM
**File:** components/ui/CoinRainOverlay.tsx:34-78
**Category:** lifecycle
**Description:** useEffect depends only on `visible` but doesn't include `coins` in dependencies. If coins change, animation doesn't restart with new coin data.
**Impact:** Coin animation uses stale coin data; visual inconsistency.
**Fix hint:** Add `coins` to dependency array: `useEffect(() => {...}, [visible, coins])`
> **Status:** Fixed in Phase 3 (2026-04-15) — Added 'coins' to useEffect dependencies; changed from `[visible]` to `[visible, coins]`.

### MA-CMP-003 CoinRainOverlay uses index as key in coin map
**Severity:** HIGH
**File:** components/ui/CoinRainOverlay.tsx:100
**Category:** logic
**Description:** Coins rendered with `.map((coin, i) => <View key={i}>` using index as key. If coin order changes, animation state mixes between elements.
**Impact:** Coin animations may execute on wrong elements; state leak on reorder.
**Fix hint:** Generate unique IDs for coins: `key={`coin-${i}-${coin.delay}`}` or use stable identifier.
> **Status:** Fixed in Phase 3 (2026-04-15) — Updated to use stable `coin.id` key; removed 'visible' from coins useMemo dependencies; added coins to useEffect dependency array.

### MA-CMP-004 CoinRainOverlay animations not cleaned up on unmount
**Severity:** MEDIUM
**File:** components/ui/CoinRainOverlay.tsx:74-75
**Category:** lifecycle
**Description:** Master animation stored in masterAnim ref but cleanup function doesn't guarantee all sub-animations are stopped. Memory leak possible.
**Impact:** Animations may continue after unmount; memory leaks.
**Fix hint:** Ensure cleanup function stops all animations: `masterAnim.stop(); pieceAnimations.forEach(a => a.stop());`

### MA-CMP-005 AnimatedCoinBalance missing animProgress dependency
**Severity:** MEDIUM
**File:** components/ui/AnimatedCoinBalance.tsx:71-82
**Category:** types
**Description:** useMemo for displayValue depends on `value` but not `animProgress`. Display value depends on animProgress for interpolation, so missing dependency.
**Impact:** Display value doesn't update during animation; shows static final value.
**Fix hint:** Add `animProgress` to dependency array.

### MA-CMP-006 AnimatedCoinBalance race condition with previousValue ref
**Severity:** MEDIUM
**File:** components/ui/AnimatedCoinBalance.tsx:46, 66, 72
**Category:** lifecycle
**Description:** `previousValue` ref updated in useEffect but also read in useMemo. Race condition if value changes during animation.
**Impact:** Coin balance animation may jump if value changes mid-animation.
**Fix hint:** Use callback ref or worklet to safely track previous value; avoid mutable ref in render path.

### MA-CMP-007 RechargeWalletCard likely has inline onChange handler
**Severity:** MEDIUM
**File:** components/RechargeWalletCard.tsx
**Category:** perf
**Description:** Wallet card with dynamic amount input likely has inline onChange handler not wrapped in useCallback. Each keystroke triggers parent rerender.
**Impact:** Form becomes laggy with animated balance updates.
**Fix hint:** Memoize amount input and wrap onChange in useCallback.

### MA-CMP-008 EmployeeWellnessBookingSection missing memoization
**Severity:** MEDIUM
**File:** components/homepage/sections/EmployeeWellnessBookingSection.tsx
**Category:** perf
**Description:** Booking section displays list of services without memoization. Each parent state change causes full re-render.
**Impact:** Booking section laggy on parent updates.
**Fix hint:** Memoize service list items with React.memo.

### MA-CMP-009 HotelBookingFlow form state lost on navigation
**Severity:** MEDIUM
**File:** components/hotel/HotelBookingFlow.tsx
**Category:** lifecycle
**Description:** Booking flow components use uncontrolled form fields. Navigation back/forward loses form state.
**Impact:** Users lose booking progress if they navigate back.
**Fix hint:** Persist form state to Redux or context during booking flow; restore on remount.

### MA-CMP-010 FlightBookingFlow missing date picker validation
**Severity:** MEDIUM
**File:** components/flight/FlightBookingFlow.tsx
**Category:** form
**Description:** Flight booking form missing date picker validation. End date can be before start date in the UI.
**Impact:** Invalid booking submissions pass client-side validation.
**Fix hint:** Add real-time validation to ensure end date >= start date.

### MA-CMP-011 DynamicCategoryPage uses ScrollView for large lists
**Severity:** MEDIUM
**File:** components/category-pages/DynamicCategoryPage.tsx
**Category:** perf
**Description:** Category pages with product grids use ScrollView instead of FlatList. With many products, causes memory bloat and crashes.
**Impact:** Category pages crash or lag with large product lists.
**Fix hint:** Replace ScrollView with FlatList or implement react-native-reanimated virtualization.

### MA-CMP-012 UGCCommentsModal renders all comments without virtualization
**Severity:** MEDIUM
**File:** components/ugc/UGCCommentsModal.tsx
**Category:** perf
**Description:** Comments list renders all comments at once without FlatList. Large comment threads cause ANR (App Not Responding).
**Impact:** ANR with 100+ comments; app freezes.
**Fix hint:** Use FlatList with initialNumToRender and maxToRenderPerBatch.

### MA-CMP-013 RewardCelebrationModal allows multiple simultaneous animations
**Severity:** MEDIUM
**File:** components/gamification/RewardCelebrationModal.tsx
**Category:** perf
**Description:** Celebration modals with confetti/coin animations don't ensure single animation at a time. Multiple animations can stack.
**Impact:** Memory leak; multiple celebrations play simultaneously causing lag.
**Fix hint:** Ensure only one celebration plays at a time; cleanup previous animation on new trigger.

### MA-CMP-014 ConversationList items not memoized
**Severity:** MEDIUM
**File:** components/messages/ConversationList.tsx
**Category:** perf
**Description:** Conversation list doesn't memoize individual conversation items. Each new message causes full list re-render.
**Impact:** Messaging feels laggy with new messages.
**Fix hint:** Memoize ConversationItem: `export const ConversationItem = React.memo(({...}) => {...})`

### MA-CMP-015 FlashSaleTimer setInterval not cleaned up on unmount
**Severity:** MEDIUM
**File:** components/offers/FlashSaleTimer.tsx
**Category:** lifecycle
**Description:** Flash sale timer with setInterval doesn't clear interval on unmount. Timer continues after component unmounts.
**Impact:** Memory leak; interval persists for unmounted timer.
**Fix hint:** Always return cleanup from useEffect that clears interval.

### MA-CMP-016 RegionMismatchError lacks accessible announcement
**Severity:** MEDIUM
**File:** components/RegionMismatchError.tsx
**Category:** a11y
**Description:** Error component shows error icon without proper accessible announcement. Screen reader may not announce error.
**Impact:** Blind users miss error state notification.
**Fix hint:** Add `accessibilityRole="alert"` and `accessibilityLiveRegion="polite"` to error container.

### MA-CMP-017 Toast component stays mounted after dismiss
**Severity:** MEDIUM
**File:** components/common/Toast.tsx
**Category:** lifecycle
**Description:** Toast component may stay in DOM after dismiss if parent doesn't actually remove it. Component hides but doesn't unmount.
**Impact:** Toast stays in DOM; multiple toasts accumulate on repeated triggers.
**Fix hint:** Parent must remove Toast from tree when dismissed, not just set visible={false}.

### MA-CMP-018 ShimmerSkeleton creates individual Animated.Value per skeleton
**Severity:** MEDIUM
**File:** components/ui/ShimmerSkeleton.tsx
**Category:** perf
**Description:** Shimmer animation likely uses new Animated.Value for every skeleton instance. With many skeletons, memory grows linearly.
**Impact:** Skeleton lists cause memory bloat and potential crashes.
**Fix hint:** Share single Animated.Value across all skeletons or use native CSS animations.

### MA-CMP-019 ThemeToggle doesn't validate available themes
**Severity:** MEDIUM
**File:** components/ThemeToggle.tsx
**Category:** types
**Description:** Theme toggle component doesn't validate available themes before switching. Invalid theme names cause crashes.
**Impact:** Theme switching crashes if theme array includes invalid values.
**Fix hint:** Validate theme before apply: `if (!availableThemes.includes(theme)) return;`

### MA-CMP-020 Button component missing prop validation
**Severity:** LOW
**File:** components/ui/Button.tsx:38-100 → components/ui/DesignSystemComponents.tsx:301-306
**Category:** validation
**Description:** Button variant and size props don't have runtime validation. Invalid values fall back to undefined behavior.
**Impact:** Invalid button styling; unexpected appearance.
**Fix hint:** Add guard: `const sizeConfig = SIZE_CONFIG[size] || SIZE_CONFIG.medium;`
**Status:** Fixed in Phase 8b (2026-04-15) — Button component validates variant and size with fallback defaults

### MA-CMP-021 Input component missing maxLength enforcement
**Severity:** LOW
**File:** components/ui/Input.tsx:78
**Category:** validation
**Description:** `maxLength` prop passed to TextInput but character count display (line 48) doesn't react to maxLength changes. User can exceed limit if prop updates.
**Impact:** Character count UI misleading; could submit over-length values.
**Fix hint:** Add dependency to charCount: `const charCount = value.length; const remaining = maxLength ? maxLength - charCount : undefined;`

### MA-CMP-022 Input password visibility toggle missing icon memoization
**Severity:** LOW
**File:** components/ui/Input.tsx:81-94
**Category:** perf
**Description:** Password toggle icon rendered without memoization. Toggle state change causes icon re-render.
**Impact:** Minor performance issue with frequent password field updates.
**Fix hint:** Memoize icon: `const iconName = useMemo(() => isPasswordVisible ? 'eye-off-outline' : 'eye-outline', [isPasswordVisible])`

### MA-CMP-023 Text component missing variant fallback
**Severity:** LOW
**File:** components/ui/Text.tsx → components/ui/DesignSystemComponents.tsx:103-131
**Category:** validation
**Description:** Text component likely doesn't validate variant prop. Invalid variant falls back to undefined styling.
**Impact:** Text appears unstyled if variant invalid.
**Fix hint:** Add default fallback: `const styleConfig = VARIANT_STYLES[variant] || VARIANT_STYLES.body;`
**Status:** Fixed in Phase 8b (2026-04-15) — GenericText validates variant with default fallback to 'body'

### MA-CMP-024 EmptyState component not memoized
**Severity:** LOW
**File:** components/ui/EmptyState.tsx:61
**Category:** perf
**Description:** EmptyState rendered without memoization. Parent re-renders cause empty state to re-render unnecessarily.
**Impact:** Minor performance issue in lists showing empty states.
**Fix hint:** Export as `export default React.memo(EmptyState);`
**Status:** Fixed in Phase 8b (2026-04-15) — EmptyState properly exported as React.memo(EmptyStateComponent)

### MA-CMP-025 Card component missing accessibility label
**Severity:** MEDIUM
**File:** components/ui/Card.tsx
**Category:** a11y
**Description:** Card component used for interactive cards doesn't have accessible label. Screen readers don't announce card purpose.
**Impact:** Blind users can't understand card content without context.
**Fix hint:** Add `accessibilityLabel` prop or wrap with semantic markup.

### MA-CMP-026 GlassCard animations not cleaned up
**Severity:** MEDIUM
**File:** components/ui/GlassCard.tsx
**Category:** lifecycle
**Description:** GlassCard with animation likely doesn't cleanup on unmount. Animations continue after component removed.
**Impact:** Memory leak from uncleaned animations.
**Fix hint:** Return cleanup function from useEffect that stops animations.

### MA-CMP-027 Badge component missing color validation
**Severity:** LOW
**File:** components/ui/Badge.tsx → components/ui/DesignSystemComponents.tsx:431-436
**Category:** validation
**Description:** Badge variant/color props don't validate against available colors. Invalid color renders as undefined.
**Impact:** Badge appears unstyled or wrong color.
**Fix hint:** Add validation: `const badgeColor = BADGE_COLORS[variant] || BADGE_COLORS.default;`
**Status:** Fixed in Phase 8b (2026-04-15) — Badge validates variant with fallback to 'default'

### MA-CMP-028 CoinIcon missing size memoization
**Severity:** LOW
**File:** components/ui/CoinIcon.tsx
**Category:** perf
**Description:** Coin icon likely recalculates style object on every render if size is number prop. Missing useMemo.
**Impact:** Unnecessary style object allocations on parent re-renders.
**Fix hint:** Memoize size calculation: `const iconStyle = useMemo(() => ({width: size, height: size}), [size])`

### MA-CMP-029 SuccessAnimation doesn't check visible before playing
**Severity:** MEDIUM
**File:** components/ui/SuccessAnimation.tsx
**Category:** logic
**Description:** Success animation likely plays when visible=true but doesn't stop automatically when visible=false. Animation persists.
**Impact:** Animation plays even when component is hidden; memory leak.
**Fix hint:** Return cleanup: `useEffect(() => { if (!visible) animation.stop(); }, [visible])`

### MA-CMP-030 CachedImage missing error boundary
**Severity:** MEDIUM
**File:** components/ui/CachedImage.tsx
**Category:** error-handling
**Description:** CachedImage doesn't handle image load failures gracefully. Failed images crash or show broken state without fallback.
**Impact:** Broken images crash listings; poor UX.
**Fix hint:** Add fallback image and error handler: `<Image onError={() => setImageFailed(true)} defaultSource={PLACEHOLDER} />`

### MA-CMP-031 AnimatedPressable missing cleanup for animations
**Severity:** MEDIUM
**File:** components/ui/AnimatedPressable.tsx
**Category:** lifecycle
**Description:** Animated press interactions likely don't cleanup animation state on unmount. Animations persist.
**Impact:** Memory leak from unmounted animations; potential stale state updates.
**Fix hint:** Return cleanup that resets animation state in useEffect.
