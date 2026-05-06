# Merchant App — Travel Module (flight, hotel, train, bus, cab)

> **Audit date:** 2026-04-15
> **Bugs found:** 28
> **Status:** Open — merchant app audit
> **Scope:** flight, hotel, bus, train, cab, travel, booking, package, going-out, home-delivery, home-services, healthcare, grocery, beauty, fitness, services

---

### MA-TRV-001 Duplicate description fallback in flight details
**Severity:** LOW
**File:** app/flight/[id].tsx:300
**Category:** logic
**Description:** Line 300 uses `description: productData.description || productData.description ||` with duplicate fallback condition. Should fall back to meaningful default instead of repeating same property.
**Impact:** Dead code that reduces maintainability; logic doesn't match intent.
**Fix hint:** Replace duplicate with proper fallback: `description: productData.description || 'Direct flight with excellent service.'`

### MA-TRV-002 Missing radix parameter in parseInt calls
**Severity:** MEDIUM
**File:** app/flight/[id].tsx:various
**Category:** types
**Description:** Multiple `parseInt()` calls throughout flight, bus, train, and cab modules missing radix parameter. Without radix=10, numbers starting with 0 may be parsed as octal.
**Impact:** Potential parsing errors for numeric specifications (duration, prices, etc).
**Fix hint:** Always use `parseInt(str, 10)` for base-10 parsing.

### MA-TRV-003 useEffect dependency array missing flight data dependency
**Severity:** MEDIUM
**File:** app/flight/[id].tsx:159-161
**Category:** logic
**Description:** `useEffect(() => { if (id) loadFlightDetails(); }, [id])` is correct but `loadFlightDetails` recreates on every render. If flight data changes, listeners aren't notified.
**Impact:** Inefficient re-fetching; potential missed data updates.
**Fix hint:** Wrap loadFlightDetails in useCallback or ensure it's memoized.

### MA-TRV-004 Missing null check before accessing route properties
**Severity:** MEDIUM
**File:** app/flight/[id].tsx:292
**Category:** null-ref
**Description:** Route object constructed as `{ from, to, ... }` but `from` and `to` could be empty strings from failed parsing. Accessing `.substring()` on empty string returns empty.
**Impact:** Could render invalid route codes ("" instead of "ABC").
**Fix hint:** Validate from/to length before substring: `fromCode: (from || 'ORG').substring(0, 3).toUpperCase()`

### MA-TRV-005 Race condition in flight details isMounted checks
**Severity:** MEDIUM
**File:** app/flight/[id].tsx:170-172, 288
**Category:** logic
**Description:** Multiple `if (!isMounted()) return;` guards in loadFlightDetails don't prevent all state updates. If component unmounts between API response and isMounted check, final setFlight still executes.
**Impact:** Stale state updates after unmount; memory leak warning.
**Fix hint:** Check isMounted before EVERY setState call, not just at entry points.

### MA-TRV-006 Missing error boundary for flight booking flow modal
**Severity:** MEDIUM
**File:** app/flight/[id].tsx:~470 (approx modal rendering)
**Category:** error-handling
**Description:** FlightBookingFlow component rendered inside modal without error boundary. If component crashes, modal unmounts leaving blank screen.
**Impact:** Unrecoverable error state during booking.
**Fix hint:** Wrap FlightBookingFlow in `withErrorBoundary()` or error boundary component.

### MA-TRV-007 Missing image validation before rendering
**Severity:** LOW
**File:** app/flight/[id].tsx:249-257
**Category:** validation
**Description:** `processImages()` filters falsy URLs but doesn't validate URL format. Could pass malformed data URIs or invalid URLs.
**Impact:** Could crash image rendering or expose security issues.
**Fix hint:** Add URL validation: `if (!url.startsWith('http')) return null;`

### MA-TRV-008 Unsafe amenities array iteration
**Severity:** LOW
**File:** app/flight/[id].tsx:~660 (amenities render)
**Category:** logic
**Description:** Amenities mapped with `.map((a, i) => <View key={i}>` using index as key. If amenities reorder, React won't track state correctly.
**Impact:** Minor performance issue; state leak on reorder.
**Fix hint:** Use `key={a}` (amenity name) instead of index.

### MA-TRV-009 Missing validation for bus duration calculation
**Severity:** MEDIUM
**File:** app/bus/[id].tsx:210-230 (approx)
**Category:** validation
**Description:** Bus duration parsed from specs but no validation if result is NaN or negative. Falls back to 480 silently.
**Impact:** Could show estimated duration without user awareness.
**Fix hint:** Validate result: `if (isNaN(dur) || dur < 0) { showWarning('Duration estimated'); dur = 480; }`

### MA-TRV-010 Missing null check before accessing bus route match groups
**Severity:** MEDIUM
**File:** app/bus/[id].tsx:196-209 (route parsing)
**Category:** null-ref
**Description:** Route regex patterns have varying capture groups; code accesses `match[2]` without verifying it exists for all patterns.
**Impact:** Could set route.to to undefined for certain route patterns.
**Fix hint:** Check match.length before accessing: `if (match && match.length >= 3) { to = match[2]; }`

### MA-TRV-011 Race condition in train details date handling
**Severity:** MEDIUM
**File:** app/train/[id].tsx:~190 (estimated)
**Category:** logic
**Description:** Train details construct departure/arrival times with calculated values but don't account for timezone. Different regions see wrong times.
**Impact:** Incorrect departure/arrival times displayed in different timezones.
**Fix hint:** Use explicit timezone: `new Date().toLocaleString('en-IN', {...}).`

### MA-TRV-012 Missing validation for cab distance calculation
**Severity:** MEDIUM
**File:** app/cab/[id].tsx:~270 (price calculation)
**Category:** logic
**Description:** `if (pricePerKm && basePrice > 0 && pricePerKm > 0) { distance = basePrice / pricePerKm }` - guards present but distance could be Infinity if pricePerKm is 0.
**Impact:** Could display Infinity distance for cabs.
**Fix hint:** Add check: `if (pricePerKm > 0 && !isFinite(distance)) distance = null;`

### MA-TRV-013 Missing null check before split operation in my-bookings
**Severity:** HIGH
**File:** app/my-bookings.tsx:~350 (formatTime function, estimated)
**Category:** null-ref
**Description:** `formatTime()` splits timeStr on ':' without checking if timeStr is valid. Empty string returns [''] which parseInt('') = NaN.
**Impact:** Can display "NaN:NaN AM/PM" in booking cards.
**Fix hint:** Guard: `if (!timeStr || typeof timeStr !== 'string') return '';`

### MA-TRV-014 Missing optional chaining for booking pricing access
**Severity:** MEDIUM
**File:** app/travel-booking-confirmation.tsx:276, 284, 292 (estimated)
**Category:** null-ref
**Description:** `booking.pricing.basePrice`, `booking.pricing.taxes` accessed without optional chaining. If pricing is null, crashes.
**Impact:** Runtime crash if booking.pricing is falsy.
**Fix hint:** Use optional: `booking.pricing?.basePrice ?? 0`

### MA-TRV-015 Missing email validation in flight booking
**Severity:** MEDIUM
**File:** components/flight/FlightBookingFlow.tsx:~155
**Category:** validation
**Description:** Email validation only checks `.includes('@')` - doesn't validate proper format (no space, domain required, etc).
**Impact:** Accepts invalid emails like "a@" or "a @b.c".
**Fix hint:** Use regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

### MA-TRV-016 Missing validation for return date >= departure date
**Severity:** HIGH
**File:** components/flight/FlightBookingFlow.tsx:~140
**Category:** validation
**Description:** Date validation checks returnDate <= departureDate but only on Next button. User can go back and edit dates; re-submission bypasses check.
**Impact:** Can submit booking with invalid date range.
**Fix hint:** Add real-time validation on date change, not just on step validation.

### MA-TRV-017 Incorrect child/infant pricing calculation
**Severity:** HIGH
**File:** components/flight/FlightBookingFlow.tsx:126
**Category:** logic
**Description:** Children get 75% discount and infants 10% hardcoded, but infants on lap should be free (0 seat). Current logic charges 10% seat cost.
**Impact:** Infants incorrectly charged; incorrect total price.
**Fix hint:** Use conditional: `infants > 0 ? 0 : basePrice * 0.1 * infants` or clarify policy.

### MA-TRV-018 Missing JSON serialization error handling in flight booking
**Severity:** MEDIUM
**File:** components/flight/FlightBookingFlow.tsx:247
**Category:** error-handling
**Description:** `JSON.stringify(customerNotes)` called without try-catch. If data has circular refs, crashes with "Converting circular structure".
**Impact:** Booking submission crashes.
**Fix hint:** Wrap in try-catch or use safe replacer: `JSON.stringify(obj, (k, v) => v === undefined ? null : v)`

### MA-TRV-019 Missing hotel checkout date in useEffect dependencies
**Severity:** MEDIUM
**File:** components/hotel/HotelBookingFlow.tsx:~155
**Category:** logic
**Description:** Checkout date set in state but not included in dependent useEffect for burn coin calculation. Calculation uses stale checkout date.
**Impact:** Burn calculation incorrect when checkout date changes.
**Fix hint:** Add checkOutDate to dependency array explicitly.

### MA-TRV-020 Missing null safety for hotel room selection
**Severity:** HIGH
**File:** components/hotel/HotelBookingFlow.tsx:~228
**Category:** validation
**Description:** `handleBookPress` checks `!selectedRoom` but doesn't prevent modal from opening. User proceeds to guest modal with no room selected.
**Impact:** Can create booking with null roomTypeId.
**Fix hint:** Move modal show inside else block or add early return.

### MA-TRV-021 Date boundary condition off by one in hotel booking
**Severity:** MEDIUM
**File:** components/hotel/HotelBookingFlow.tsx:295
**Category:** logic
**Description:** `minimumDate={new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000)}` requires exactly 24h, but same-day check-out at 11am should be valid.
**Impact:** Users cannot book same-day or 0-night stays.
**Fix hint:** Remove +24h offset or set minimumDate to checkInDate itself.

### MA-TRV-022 Missing email validation in hotel booking
**Severity:** MEDIUM
**File:** components/hotel/HotelBookingFlow.tsx:~157
**Category:** validation
**Description:** Email validation missing — only checks trim() but not format.
**Impact:** Accepts invalid emails.
**Fix hint:** Add email regex validation matching flight flow.

### MA-TRV-023 Missing catch handler for Promise.all in hotel detail
**Severity:** HIGH
**File:** app/travel/hotels/[id].tsx:180-187 (estimated)
**Category:** error-handling
**Description:** `Promise.all(getHotelById, getHotelRoomTypes)` has no catch. If one fails, both hotel and rooms remain unset, causing race condition.
**Impact:** Partial loading state with inconsistent UI; room data missing.
**Fix hint:** Add .catch() that sets both hotel and rooms explicitly, or use Promise.allSettled.

### MA-TRV-024 Missing null check for hotel booking API call response
**Severity:** HIGH
**File:** components/hotel/HotelBookingFlow.tsx:215-239
**Category:** error-handling
**Description:** `serviceBookingApi.createBooking()` called without .catch(). If it throws, error is unhandled.
**Impact:** Unhandled promise rejection crashes app.
**Fix hint:** Wrap in try-catch or add .catch() handler.

### MA-TRV-025 Missing validation for coin toggle with zero balance
**Severity:** MEDIUM
**File:** app/travel/hotels/[id].tsx:168-170
**Category:** validation
**Description:** Coin toggle states can be true even if user has 0 balance. Burn calculation requests coins user doesn't have.
**Impact:** Payment calculation includes unavailable coins.
**Fix hint:** When disabling coin toggle, ensure boolean matches available balance.

### MA-TRV-026 Missing special requests length validation
**Severity:** LOW
**File:** app/travel/hotels/[id].tsx:254
**Category:** validation
**Description:** `specialRequests.trim()` has no length limit. API might reject if too long.
**Impact:** Booking fails silently if special requests exceed limit.
**Fix hint:** Limit to 500 chars: `specialRequests.trim().slice(0, 500) || undefined`

### MA-TRV-027 Missing guest name format validation
**Severity:** MEDIUM
**File:** app/travel/hotels/[id].tsx:233
**Category:** validation
**Description:** Guest name validation only checks not empty; allows numbers-only names.
**Impact:** Invalid guest names accepted.
**Fix hint:** Validate: `/^[a-zA-Z\s'-]+$/.test(guestName.trim())`

### MA-TRV-028 Missing isMounted check after booking API call in my-bookings
**Severity:** MEDIUM
**File:** app/my-bookings.tsx:217-226
**Category:** logic
**Description:** `getMyBookings().then(...).catch(...).finally()` has no isMounted guard. setState can execute after unmount.
**Impact:** Memory leak warning if bookings tab unmounts during fetch.
**Fix hint:** Add isMounted check in then/catch handlers before setState.
