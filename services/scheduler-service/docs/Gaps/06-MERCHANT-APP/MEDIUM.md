# ReZ Merchant App — MEDIUM Severity Issues

**Generated:** 2026-04-16 | **Severity:** MEDIUM | **Count:** 71

---

## UX & INTERACTION (18 issues)

---

### G-MA-M01: Quick action buttons have no loading state

**Status:** OPEN
**File:** `app/(dashboard)/orders.tsx:361-434`
**Source:** ux-auditor

Accept/Decline/Start Preparing/Mark Ready buttons fire API calls with zero feedback. User sees no spinner during async operation. Success and failure are both silent.

**Fix:** Add loading state per action button:
```tsx
const [accepting, setAccepting] = useState(false);
<Button loading={accepting} onPress={async () => { setAccepting(true); await handleAccept(); setAccepting(false); }}>
```

---

### G-MA-M02: Product status toggle — zero feedback on iOS success

**Status:** OPEN
**File:** `app/(dashboard)/products.tsx:221-258`
**Source:** ux-auditor

Optimistic update reverts on API failure. On iOS, even success path gives no feedback. `platformAlertSimple` called only on failure (line 241), not on success.

**Fix:** Add success feedback for iOS:
```tsx
if (Platform.OS === 'ios') {
  showToast('Status updated');
}
```

---

### G-MA-M03: Login navigation is instantaneous — no loading transition

**Status:** OPEN
**File:** `app/(auth)/login.tsx:34`
**Source:** ux-auditor

`router.replace('/(dashboard)')` is instantaneous. Dashboard fetches multiple endpoints — user sees blank or half-loaded screen.

**Fix:** Show loading/splash before navigation, or add skeleton dashboard:
```tsx
router.replace('/(dashboard)?loading=1'); // dashboard shows skeleton on ?loading
```

---

### G-MA-M04: Quick Bill — no success toast after generate

**Status:** OPEN
**File:** `app/pos/quick-bill.tsx:148`
**Source:** ux-auditor

Button shows spinner but no success toast. Screen transitions to `/pos/payment`. On failure, user sees error alert but amount stays — no clear "retry" affordance.

**Fix:** Add `showToast('Bill generated')` on success before navigation.

---

### G-MA-M05: Offer config — no bounds validation on numeric fields

**Status:** OPEN
**File:** `components/offers/OfferConfigForm.tsx:87-128`
**Source:** ux-auditor

All numeric fields (`value`, `minSpend`, `durationDays`, `budgetCap`) use `parseInt(v) || 0`. No min/max validation. User can enter 0, negative, or astronomically large values. Backend rejection is cryptic.

**Fix:** Add inline validation:
```tsx
if (value < 1 || value > 100) { setFieldError('value', 'Cashback % must be 1-100'); }
if (budgetCap > 1000000) { setFieldError('budgetCap', 'Max budget ₹10,00,000'); }
```

---

### G-MA-M06: Cashback % field — no max value

**Status:** OPEN
**File:** `components/offers/OfferConfigForm.tsx:87-93`
**Source:** ux-auditor

`TextInput` has no `maxLength` or keyboard type constraint. User can type "1000" for cashback percentage.

**Fix:** `keyboardType="number-pad" maxLength={3}` with validation.

---

### G-MA-M07: Customer phone field — no format validation

**Status:** OPEN
**File:** `app/pos/quick-bill.tsx:223-232`
**Source:** ux-auditor

Accepts any string up to 15 characters. No Indian phone format check (must start with 6/7/8/9).

**Fix:** Add regex: `/^[6-9]\d{9}$/`

---

### G-MA-M08: Phone validation — only checks length

**Status:** OPEN
**File:** `app/(auth)/register.tsx:215`
**Source:** ux-auditor

`if (cleaned.length < 10)` — `0000000000` passes. Indian numbers must start with 6, 7, 8, or 9.

**Fix:** `if (!/^[6-9]\d{9}$/.test(cleaned))`

---

### G-MA-M09: Large bill amount — no upper limit

**Status:** OPEN
**File:** `app/pos/quick-bill.tsx:100-113`
**Source:** ux-auditor

`handleKey` limits decimal places but no upper cap. Merchant could enter `₹99,99,99,99,999`.

**Fix:** `if (amount > 999999999) { showAlert('Amount exceeds maximum'); return; }`

---

### G-MA-M10: OTP paste — not supported on iOS Safari / some Android keyboards

**Status:** OPEN
**File:** `app/(auth)/register.tsx:60-64`
**Source:** ux-auditor

Each digit box accepts one character. Paste from SMS doesn't work.

**Fix:** Add clipboard paste handler:
```tsx
const handlePaste = (text: string) => {
  const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
  digits.split('').forEach((d, i) => setOtp(prev => { const next = [...prev]; next[i] = d; return next; }));
};
```

---

### G-MA-M11: Bank detail update — no summary before biometric

**Status:** OPEN
**File:** `app/(dashboard)/wallet.tsx:538-571`
**Source:** ux-auditor

Biometric prompt shows "Confirm bank details update" but no actual details. Merchant could save wrong account.

**Fix:** Show confirmation screen before biometric:
```tsx
<ConfirmScreen
  title="Confirm Bank Details"
  details={[{ label: 'Account', value: maskedAccount }, { label: 'IFSC', value: ifsc }]}
  onConfirm={() => biometricAuth(...)}
/>
```

---

### G-MA-M12: Withdrawal — no amount confirmation before biometric

**Status:** OPEN
**File:** `app/(dashboard)/wallet.tsx:500-536`
**Source:** ux-auditor

Biometric triggers immediately after amount validation. No "You are about to withdraw ₹X" step.

**Fix:** Add confirmation step:
```tsx
<Alert title="Confirm Withdrawal" message={`Withdraw ₹${formatRupees(amount)} from your wallet?`} />
```

---

### G-MA-M13: Register back press loses OTP without warning

**Status:** OPEN
**File:** `app/(auth)/register.tsx:109`
**Source:** ux-auditor

`handleBack` calls `router.back()` on step 3 (OTP) with no guard. OTP data lost.

**Fix:**
```tsx
const handleBack = () => {
  if (step === 3) {
    showConfirmDialog('Going back will require you to re-enter the OTP. Continue?', () => router.back());
  } else {
    router.back();
  }
};
```

---

### G-MA-M14: Dark mode broken across most screens

**Status:** OPEN
**Files:** `FormInput.tsx`, `FormSelect.tsx`, `ConfirmModal.tsx`, `Alert.tsx`, `PrimaryButton.tsx`, `quick-bill.tsx`, `payment.tsx`, `orders.tsx` notification banner
**Source:** ux-auditor

All components use hardcoded hex colors instead of `Colors[scheme]`.

**Fix:** Replace hardcoded colors with theme-aware constants:
```tsx
// Before
backgroundColor: '#EF4444'
// After
backgroundColor: Colors[colorScheme].error
```

---

### G-MA-M15: Web notification banner — emoji in Text (WCAG violation)

**Status:** OPEN
**File:** `app/(dashboard)/orders.tsx:991-1001`
**Source:** ux-auditor

`'🔔'`, `'📋'`, `'🛎️'`, `'📦'` in Text elements — screen readers announce meaningless Unicode.

**Fix:** Use Ionicons:
```tsx
<Icon name="notifications" size={20} accessibilityLabel="New order notification" />
```

---

### G-MA-M16: FormSelect — modal has no keyboard dismiss

**Status:** OPEN
**File:** `components/forms/FormSelect.tsx:218-226`
**Source:** ux-auditor

Close button missing `accessibilityLabel`. Keyboard users can get trapped.

**Fix:** Add `accessibilityLabel="Close" accessibilityRole="button"` and keyboard dismiss handler.

---

### G-MA-M17: Create Offer Wizard — no step count text in header

**Status:** OPEN
**File:** `app/(dashboard)/create-offer.tsx:198-215`
**Source:** ux-auditor

Wizard has dots but header shows no "Step 2 of 3". Small screens may miss dots.

**Fix:** Add step counter: `<Text>Step {current} of {total}</Text>`

---

### G-MA-M18: Confirm Modal — no visual affordance for backdrop tap

**Status:** OPEN
**File:** `components/common/ConfirmModal.tsx:87`
**Source:** ux-auditor

Modal dismisses on backdrop tap but provides no visual indication.

**Fix:** Add subtle hint or cursor pointer on backdrop.

---

## FUNCTIONAL BUGS (10 issues)

---

### G-MA-M19: DocumentUploader — loading state edge case

**Status:** OPEN
**File:** `components/onboarding/DocumentUploader.tsx:144-151`
**Source:** ux-auditor

`setUploading(false)` called on error AND via setTimeout 500ms later. If error occurs before timeout initializes, both fire — fine but fragile.

**Fix:** Clear timeout on error:
```tsx
const progressInterval = setTimeout(() => setUploading(false), 500);
try {
  await upload();
} catch (err) {
  clearTimeout(progressInterval);
  setUploading(false);
}
```

---

### G-MA-M20: wallet.tsx has duplicate style definitions

**Status:** OPEN
**File:** `app/(dashboard)/wallet.tsx` (top + bottom of file)
**Source:** ux-auditor

`getWalletThemedStyles()` (function) AND static `const styles = StyleSheet.create({})` (bottom). `analyticsStyles` defined but never referenced.

**Fix:** Remove dead `analyticsStyles` block. Document which is authoritative.

---

### G-MA-M21: window.alert used for order errors on web

**Status:** OPEN
**File:** `hooks/useOrdersDashboard.ts:297`
**Source:** ux-auditor

`Platform.OS === 'web'` uses `window.alert` — blocking, ugly, bypasses app's alert system.

**Fix:** Use `showAlert` which handles all platforms.

---

### G-MA-M22: BusinessInfoForm handleSubmit never called

**Status:** OPEN
**File:** `components/onboarding/BusinessInfoForm.tsx`
**Source:** ux-auditor

Uses react-hook-form with `control`, sets up watchers, but never calls `handleSubmit`. Form submission path is dead.

**Fix:** Connect `onSubmit={handleSubmit(...)}` to form's submit button, or remove unused RHF setup.

---

### G-MA-M23: Onboarding step 2 is a no-op

**Status:** OPEN
**File:** `services/api/onboarding.ts:134-137`
**Source:** api-auditor

`StoreDetailsStep` switch case has `break` with no API call. User advances past step 2 with no data saved. App close between step 2 and 3 loses all data.

**Fix:** Add API call to persist store details, or validate that parent wizard handles it.

---

### G-MA-M24: Onboarding auto-save stores unvalidated data

**Status:** OPEN
**File:** `services/api/onboarding.ts:489-496`
**Source:** api-auditor

`autoSaveInterval` calls `completeStep()` without calling `validateBusinessInfo()` first. Incomplete data persisted to backend.

**Fix:** Call `validateBusinessInfo()` before auto-save:
```typescript
const errors = validateBusinessInfo(currentStepData);
if (Object.keys(errors).length === 0) {
  completeStep(currentStep, currentStepData);
}
```

---

### G-MA-M25: Register OTP cooldown not reset on Change Number

**Status:** OPEN
**File:** `app/(auth)/register.tsx:506-515`
**Source:** ux-auditor

Pressing "Change Number" resets OTP state but NOT `cooldownRef`. Old cooldown persists — user can't request new OTP immediately.

**Fix:** `cooldownRef.current = null` on "Change Number" press.

---

### G-MA-M26: External ID truncation crashes on null/undefined

**Status:** OPEN
**File:** `app/(dashboard)/orders.tsx:567`
**Source:** ux-auditor

`order.externalId.slice(-8).toUpperCase()` — if `externalId` is null/undefined, this crashes.

**Fix:** `order.externalId?.slice(-8).toUpperCase() ?? 'N/A'`

---

### G-MA-M27: Disabled outline button loses transparent background

**Status:** OPEN
**File:** `components/ui/PrimaryButton.tsx:140`
**Source:** ux-auditor

Disabled outline button gets `backgroundColor: '#E5E7EB'` from the disabled override — breaking the outline aesthetic.

**Fix:** Keep outline transparent for disabled state:
```tsx
...(disabled && variant === 'outline' && { backgroundColor: 'transparent', opacity: 0.5 }),
```

---

### G-MA-M28: ErrorFallback uses hardcoded emoji instead of icon

**Status:** OPEN
**File:** `components/common/ErrorFallback.tsx:144`
**Source:** ux-auditor

Emoji `⚠️` is not theme-aware and fails accessibility.

**Fix:** Use `Ionicons name="warning" size={48}` with theme-aware color.

---

## ARCHITECTURE & TYPE SAFETY (28 issues)

---

### G-MA-M29: CoinDrops.createCoinDrop — no amount validation

**Status:** OPEN
**File:** `services/api/coinDrops.ts:54-57`
**Source:** payment-auditor

`bonusAmount`, `maxClaims`, `maxBonusPerUser` all unvalidated numbers. Negative or infinite values possible.

---

### G-MA-M30: BrandedCoins.awardCoins — no amount validation

**Status:** OPEN
**File:** `services/api/brandedCoins.ts:52-63`
**Source:** payment-auditor

`amount: number` sent without min/max/NaN check.

---

### G-MA-M31: Cashback per-item display uses wrong formula

**Status:** OPEN
**File:** `app/(cashback)/[id].tsx:302`
**Source:** payment-auditor

`cashback.requestedAmount / items.length` assumes equal per-item, but cashback is typically on total.

---

### G-MA-M32: CGST/SGST hardcoded at 9%

**Status:** OPEN
**File:** `app/settlements/index.tsx:247-248`
**Source:** payment-auditor

Hardcoded 9% for F&B. Wrong for other categories (5%, 12%, 18%, 28% GST).

---

### G-MA-M33: Case-sensitive status transition lookup

**Status:** OPEN
**File:** `services/api/orders.ts:80-83`
**Source:** payment-auditor

`fromStatus.toLowerCase() === currentStatus` — if backend returns mixed case, lookup fails silently.

---

### G-MA-M34: Duplicate ROLE_DESCRIPTIONS across two files

**Status:** OPEN
**Files:** `constants/roles.ts:69-79`, `services/api/team.ts:99-106`
**Source:** logic-auditor

Same values defined twice. Updates to one won't reflect in the other.

---

### G-MA-M35: totalCustomersToday === 0 triggers wrong fallback

**Status:** OPEN
**File:** `services/api/dashboard.ts:111`
**Source:** logic-auditor

```typescript
raw.totalCustomersToday ?? returningCustomersToday + newCustomers
// When totalCustomersToday is legitimately 0, ?? fallback triggers (0 is falsy)
// Should be: raw.totalCustomersToday !== undefined ? ... : fallback
```

---

### G-MA-M36: Customer retention total miscalculated

**Status:** OPEN
**File:** `services/api/dashboard.ts:111-113`
**Source:** logic-auditor

`returning + new` ≠ total (excludes inactive, churned).

---

### G-MA-M37: SKU validation fail-open allows duplicates

**Status:** OPEN
**File:** `services/api/products.ts:911`
**Source:** logic-auditor

Returns `isAvailable: true` on network error — duplicates allowed.

---

### G-MA-M38: Auth login vs register — name fallback inconsistency

**Status:** OPEN
**File:** `services/api/auth.ts:30 vs 74`
**Source:** logic-auditor

Login has name fallback. Register path doesn't — produces user with `name: ''` if `ownerName` missing.

---

### G-MA-M39: validatePaymentStatus imported but never called

**Status:** OPEN
**File:** `utils/paymentValidation.ts:79-86`
**Source:** logic-auditor

Wrong-value validator imported in payments.ts but never invoked. Dead weight + misdirection risk.

---

### G-MA-M40: Duplicate metric keys revenue.trend and revenue.change

**Status:** OPEN
**File:** `services/api/dashboard.ts:31-33`
**Source:** logic-auditor

Both populated from identical source data.

---

### G-MA-M41: POSService.getRecentBills — per-page revenue only

**Status:** OPEN
**File:** `services/api/pos.ts:448`
**Source:** payment-auditor

`summary.totalRevenue` sums current page only — not true total.

---

### G-MA-M42: Cashback rejection sends reason twice

**Status:** OPEN
**File:** `app/(cashback)/[id].tsx:85`
**Source:** payment-auditor

`rejectionReason` sent as both `rejectionReason` and `notes` fields.

---

### G-MA-M43: ProductsService search vs query param name

**Status:** OPEN
**File:** `services/api/products.ts:180`
**Source:** api-auditor

Frontend sends `search`, backend may expect `query` or `search`. Needs verification.

---

### G-MA-M44: ProductsService getProducts uses any

**Status:** OPEN
**File:** `services/api/products.ts:190`
**Source:** api-auditor

`apiClient.get<any>(...)` — loses all type safety on products array.

---

### G-MA-M45: CashbackService getCashbackRequests pagination field mismatch

**Status:** OPEN
**File:** `services/api/cashback.ts:198-207`
**Source:** api-auditor

Uses `payload.items` fallback but primary path expects `payload.redemptions`.

---

### G-MA-M46: getTodayRevenueSummary fallback missing vsYesterday.percentChange

**Status:** OPEN
**File:** `services/api/dashboard.ts:743-752`
**Source:** api-auditor

Fallback object missing required `percentChange` field → `undefined` at runtime.

---

### G-MA-M47: CoinsService search query param name mismatch

**Status:** OPEN
**File:** `services/api/coins.ts:98-99`
**Source:** api-auditor

Frontend sends `?q=`, backend may expect `?query=` or `?search=`.

---

### G-MA-M48: AuthContext UPDATE_MERCHANT stores extra backend fields

**Status:** OPEN
**File:** `contexts/AuthContext.tsx:244, 416`
**Source:** api-auditor

Backend may return fields not in Merchant type — stored silently, creating type/behavior gap.

---

### G-MA-M49: updateStore slug mismatch

**Status:** OPEN
**File:** `contexts/StoreContext.tsx:272-298`
**Source:** api-auditor

After `updateStore` + `setActiveStoreSlug`, context has two different store objects for same store ID.

---

### G-MA-M50: createStore stale closure on stores.length

**Status:** OPEN
**File:** `contexts/StoreContext.tsx:266`
**Source:** api-auditor

`stores.length` in dependency array — primitive snapshot, meaningless.

---

### G-MA-M51: setActiveStoreSlug stale closure on activeStore

**Status:** OPEN
**File:** `contexts/StoreContext.tsx:161-164`
**Source:** api-auditor

`activeStore` in closure can be stale.

---

### G-MA-M52: Socket event handlers cast to any

**Status:** OPEN
**File:** `services/api/socket.ts:258-368`
**Source:** api-auditor

`ServerToClientEvents` and `ClientToServerEvents` types defined but never used for handlers.

---

### G-MA-M53: offlineOrderQueue NetInfo listener not cleaned up

**Status:** OPEN
**File:** `services/api/orderQueue.ts:35-43`
**Source:** api-auditor

`destroy()` never called — listener persists for app lifetime. Multiple listeners on hot reload.

---

### G-MA-M54: MerchantId extraction uses any pattern 6 times

**Status:** OPEN
**File:** `services/api/socket.ts:414-543`
**Source:** api-auditor

`typeof merchantData === 'string' ? merchantData : merchantData?._id || ...` repeated 6 times. Silent `"[object Object]"` routing risk.

---

### G-MA-M55: SocketContext listeners untyped

**Status:** OPEN
**File:** `contexts/SocketContext.tsx:62-66`
**Source:** api-auditor

`status: string` should be `'connected' | 'disconnected' | 'reconnecting'`. `token-expired` listener registered but event never emitted.

---

### G-MA-M56: Token refresh URL silent fallback on invalid env

**Status:** OPEN
**File:** `services/api/client.ts:222-228`
**Source:** api-auditor

`parseInt` fallback on invalid env values — silently uses wrong URL.

---

## SECURITY (1 issue)

---

### G-MA-M57: No email format validation on login before API call

**Status:** OPEN
**File:** `app/(auth)/login.tsx:45-62`
**Source:** security-auditor

`trimmedEmail` checked as falsy but no regex validation. Unnecessary API calls for invalid formats.

**Fix:** Add `if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))`

---

## PERFORMANCE (1 issue)

---

### G-MA-M58: KDS order limit 200 with no date filter or auto-purge

**Status:** OPEN
**File:** `app/kds/index.tsx:803-821`
**Source:** sync-auditor

Busy restaurants accumulate `ready` orders, filling the 200 limit. New orders dropped.

**Fix:** Add date filter and auto-expire old `ready` orders.

---

### G-MA-M59: POS product catalog hard-capped at 100 items

**Status:** OPEN
**File:** `app/pos/index.tsx:400-431`
**Source:** sync-auditor

`loadProducts` requests `limit: 100`. Large catalogs can't see all products via POS.

**Fix:** Add pagination or category-based lazy loading.

---

### G-MA-M60: StoreContext redundant API calls on auth flow

**Status:** OPEN
**File:** `contexts/StoreContext.tsx:337-347`
**Source:** sync-auditor

`loadStores` called on both `authLoading` and `isAuthenticated` changes — double call possible.

---

### G-MA-M61: Double sync on network restoration

**Status:** OPEN
**File:** `hooks/useNetworkStatus.ts:188-244`
**Source:** sync-auditor

`NetInfo.addEventListener` fires immediately + `NetInfo.fetch()` also fires → `performSync()` called twice.

---

### G-MA-M62: FlatList re-renders on every cart change

**Status:** OPEN
**File:** `app/pos/index.tsx:797-815`
**Source:** sync-auditor

`renderProduct` useCallback recreated on every cart change → FlatList re-renders entirely.

**Fix:** Memoize more aggressively or use `React.memo` with proper equality check.

---

## TYPE SYSTEM & ENUM DRIFT (Round 2 Audit)

### G-MA-M63: services.ts defines conflicting PaymentStatus and CashbackStatus locally

**Status:** OPEN
**File:** `services/api/services.ts:85-94`
**Source:** type-auditor

```typescript
export type BookingStatus = 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded' | 'failed';
export type CashbackStatus = 'pending' | 'held' | 'credited' | 'clawed_back';
```

`services.ts` defines its own `PaymentStatus` (5 values) and `CashbackStatus` (4 values) for `MerchantServiceBooking`. These **completely diverge** from the canonical types in `types/api.ts`:

| Type | services.ts | types/api.ts |
|------|------------|-------------|
| PaymentStatus | 5 values: `pending`, `paid`, `partial`, `refunded`, `failed` | 8 values: `pending`, `awaiting_payment`, `processing`, `authorized`, `paid`, `failed`, `refunded`, `partially_refunded` |
| CashbackStatus | 4 values: `pending`, `held`, `credited`, `clawed_back` | 5 values: `pending`, `approved`, `rejected`, `paid`, `expired` |

The values have **no overlap**. If a developer imports `PaymentStatus` from different files, TypeScript won't catch type mismatches between merchant booking payments and regular order payments.

**Fix:** Import canonical types from `types/api.ts` for `MerchantServiceBooking`:
```typescript
import type { PaymentStatus, CashbackStatus } from '../../types/api';
```

---

### G-MA-M64: bonusCampaigns.ts uses `any` as response generic — zero type safety

**Status:** OPEN
**File:** `services/api/bonusCampaigns.ts:81`
**Source:** type-auditor

```typescript
const response = await apiClient.get<any>('bonus-zone/campaigns');
```

No typed response. The API returns `{ campaigns: BonusCampaign[], total: number }` but TypeScript has no knowledge of this shape. Any field rename on the backend silently breaks this code.

**Fix:** Define a typed response:
```typescript
interface BonusCampaignsResponse {
  campaigns: BonusCampaign[];
  total: number;
}
const response = await apiClient.get<BonusCampaignsResponse>('bonus-zone/campaigns');
```

---

### G-MA-M65: notifications.ts unsafe cast for pagination items

**Status:** OPEN
**File:** `services/api/notifications.ts:83`
**Source:** type-auditor

```typescript
const items: Notification[] = Array.isArray(response.data)
  ? response.data
  : ((response.data as any)?.items ?? []);
```

`(response.data as any)?.items` bypasses type checking. If the response shape changes, this silently returns `[]` instead of surfacing a type mismatch.

**Fix:** Define a typed response wrapper:
```typescript
interface NotificationsResponse {
  items?: Notification[];
}
const items: Notification[] = Array.isArray(response.data)
  ? response.data
  : ((response.data as NotificationsResponse)?.items ?? []);
```

---

### G-MA-M66: InvoiceData uses plain string for payment status — not typed

**Status:** OPEN
**File:** `types/documents.ts:138-140`
**Source:** type-auditor

```typescript
payment: {
  method: string;
  status: string;   // ← plain string, not PaymentStatus
  paidAmount?: number;
```

`InvoiceData.payment.status` is a plain `string`. Should use the `PaymentStatus` type from `types/api.ts`. Without the type, invalid status values are accepted at compile time.

**Fix:**
```typescript
import type { PaymentStatus } from './api';

payment: {
  method: string;
  status: PaymentStatus;
  paidAmount?: number;
```

---

### G-MA-M67: bonusCampaigns and notifications services cast response.data to any repeatedly

**Status:** OPEN
**Files:** `services/api/bonusCampaigns.ts:106`, `services/api/notifications.ts`
**Source:** type-auditor

```typescript
// bonusCampaigns.ts:106
return response.data?.campaign || null;
// notifications.ts:83
: ((response.data as any)?.items ?? []);
```

Both files access `.data` fields without typed interfaces. Combined with the `get<any>` generic in bonusCampaigns, this is a complete type-safety bypass across the notification and bonus campaign layers.

**Fix:** Add typed response interfaces for both services.

---

### G-MA-M68: ShippingCarrier enum mixes naming conventions — SCREAMING_CASE and lowercase

**Status:** OPEN
**File:** `types/documents.ts:31-41`
**Source:** type-auditor

```typescript
export enum ShippingCarrier {
  USPS = 'usps',
  UPS = 'ups',
  FEDEX = 'fedex',
  DHL = 'dhl',
  ROYAL_MAIL = 'royal_mail',
  CANADA_POST = 'canada_post',
  AUSTRALIA_POST = 'australia_post',
  OTHER = 'other',
}
```

Enum member names use SCREAMING_CASE (`USPS`, `UPS`, `FEDEX`) but values use lowercase (`'usps'`, `'ups'`). Most other enums in the codebase use consistent naming. This creates confusion and requires `.toLowerCase()` when comparing values from external APIs.

**Fix:** Standardize on lowercase enum names matching the values:
```typescript
export enum ShippingCarrier {
  USPS = 'usps',
  // ...
}
```

---

### G-MA-M69: MerchantServiceBooking has its own BookingStatus — diverges from OrderStatus

**Status:** OPEN
**File:** `services/api/services.ts:85`
**Source:** type-auditor

```typescript
export type BookingStatus = 'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
```

`MerchantServiceBooking` uses `BookingStatus` (7 values) instead of `OrderStatus` (12 values from `types/api.ts`). This means:
- Booking status values (`'assigned'`, `'no_show'`) are not valid `OrderStatus` values
- The two status systems can't be used interchangeably in shared components
- A component expecting `OrderStatus` will reject `BookingStatus` values

**Fix:** Rename to `ServiceBookingStatus` and clearly document its scope, or align with `OrderStatus` where values overlap.

---

## PERFORMANCE & PAGINATION (3 issues)

### G-MA-M70: 12 onboarding/forms use `zodResolver(schema) as any` — full type safety bypass

**Status:** OPEN
**Files:**
- `hooks/useForm.ts:46` — `(zodResolver as any)(schema)`
- `app/onboarding/bank-details.tsx:106` — `zodResolver(bankDetailsSchema) as any`
- `app/onboarding/store-details.tsx:95` — `zodResolver(storeDetailsSchema) as any`
- `app/stores/[id]/edit.tsx:198`
- `app/stores/add.tsx:163`
- `app/stores/[id]/outlets/add.tsx:78`
- `app/stores/[id]/outlets/[outletId].tsx:95`
- `app/stores/[id]/discounts/add.tsx:86`
- `app/stores/[id]/discounts/[discountId].tsx:92`
- `app/stores/[id]/deals/add.tsx:75`
- `app/stores/[id]/deals/[dealId].tsx:75`
- `app/stores/[id]/vouchers/add.tsx:75`
- `app/stores/[id]/vouchers/[voucherId].tsx:92`

**Source:** type-auditor (Round 5)

All use `as any` on the resolver. This means TypeScript cannot catch schema-to-component prop mismatches, wrong field types, or missing required fields. Invalid data passes validation silently.

**Fix:** Type the resolver properly:
```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';

// Infer type from schema
type FormData = z.infer<typeof schema>;
// Then: resolver: zodResolver(schema) as Resolver<FormData>
```

---

### G-MA-M71: `onEndReachedThreshold={0.1}` on products page fires too early

**Status:** OPEN
**File:** `app/(dashboard)/products.tsx:670`
**Source:** performance-auditor (Round 5)

```tsx
onEndReachedThreshold={0.1}
```

`0.1` means the pagination load triggers when the user is 10% from the bottom of the list. On a 100-item product catalog, this fires at ~90 items — well before the user reaches the end. Combined with no debounce, rapid-fire load requests are possible.

**Fix:** Use `0.3` (the standard threshold) or add debouncing:
```tsx
const loadMoreDebounced = useCallback(
  debounce(() => loadProducts(nextPage), 500),
  [loadProducts]
);
```

---

### G-MA-M72: `validateField` chains optional calls on `as any` cast schema

**Status:** OPEN
**File:** `hooks/useForm.ts:210-212`
**Source:** type-auditor (Round 5)

```typescript
await (schema as any).pick?.({ [fieldName]: true })?.parseAsync?.({ [fieldName]: value });
```

The `as any` cast removes all type guarantees, then chained optional chaining (`?.`) hides any runtime errors. If `schema` is not a Zod schema (wrong type injected), all three method calls silently no-op and `validateField` returns `valid: true`.

**Fix:** Type the schema parameter:
```typescript
async function validateField(
  fieldName: keyof T,
  value: T[keyof T],
  schema: ZodType<T>
): Promise<{ valid: boolean; error: string | null }> {
  const fieldSchema = schema.pick({ [fieldName]: true } as any);
  const result = await fieldSchema.safeParseAsync({ [fieldName]: value });
  if (result.success) return { valid: true, error: null };
  return { valid: false, error: result.error.errors[0]?.message || 'Invalid' };
}
```

---

### G-MA-M73: Wrong ID Passed to setItemQty in Quantity Modal

**Status:** OPEN
**File:** `app/pos/index.tsx` (line ~516)
**Source:** Deep POS audit

**Code:**
```typescript
const n = parseInt(qtyInputValue, 10);
if (!isNaN(n) && n >= 0) setItemQty(qtyModalProduct.id, n); // ← uses product.id, not cartId
```

**Issue:** The modal's `qtyModalProduct` tracks the `product.id` but `setItemQty` expects a `cartId`. For cart items with modifiers (which have different cartIds from the product ID), the edit targets the wrong item or does nothing. Works by accident for items without modifiers.

**Fix:** Track the `cartId` (or `existing?.cartId`) in the modal state, not just the product ID.

---

### G-MA-M74: Auto-Sync Failure Silently Swallowed

**Status:** OPEN
**File:** `app/pos/offline.tsx` (lines 137-144)
**Source:** Deep POS audit

**Code:**
```typescript
if (nowOnline && wasOnline === false) {
  syncOfflineQueue(apiClient, activeStore?._id || '')
    .then(({ synced }) => { if (synced > 0) { /* ... */ } })
    .catch(() => {}); // ← ALL failures silently dropped
}
```

**Issue:** If auto-sync fails (server error, auth expired), the user sees zero feedback. Bills may have synced, partially synced, or not at all. No indication of failure.

**Fix:** Show a toast on sync failure. At minimum, update the queue count so user can see if items disappeared.

---

### G-MA-M75: Type-Unsafe getOfflineQueue Result Causes Runtime Crash

**Status:** OPEN
**File:** `app/pos/offline.tsx` (lines 141, 154)
**Source:** Deep POS audit

**Code:**
```typescript
setQueue(posService.getOfflineQueue()); // ← return type unknown
```

**Issue:** If `getOfflineQueue()` returns `null` instead of `QueuedBill[]`, `setQueue(null)` sets queue state to a non-array. The `reduce()` at line 361 crashes with "reduce of undefined".

**Fix:** Guard with `Array.isArray()` or ensure `getOfflineQueue()` always returns `QueuedBill[]`.

---

### G-MA-M76: Detached setTimeout Retry Loses Bills on Failure

**Status:** OPEN
**File:** `services/offlinePOSQueue.ts` (lines 86-98)
**Source:** Deep POS audit

**Code:**
```typescript
} else if (errMsg.includes('database is locked')) {
  setTimeout(() => {
    try {
      db.runSync(...);
    } catch (retryError) {
      console.error('[OfflinePOSQueue] Enqueue retry failed:', retryError);
    }
  }, 500);
} // ← function returns BEFORE setTimeout fires
```

**Issue:** The retry fires after the enqueue function has already returned. The caller thinks the enqueue succeeded. If the retry ALSO fails, the bill is permanently lost with no recovery.

**Fix:** Convert to an async retry mechanism that the caller awaits, so the call site knows if enqueue succeeded or failed.
