# REZ Now — Universal Commerce Platform

> Status: **PLANNING** | Version: 2.0 | Date: 2026-04-14
> Vision: REZ Now = UPI QR + POS + AI Commerce for **every** business type
> GitHub: `imrejaul007/rez-now`

---

## 1. The Big Idea

**REZ Now replaces:**
- Swipe machine / POS terminal (₹0 hardware)
- WhatsApp catalog (dynamic, AI-powered)
- Website for every small business (auto-generated from catalog)
- Loyalty card (built-in coins)
- Waiter call bell (built-in kitchen chat)
- Reservation system (built-in table booking)

**One link per merchant: `now.rez.money/<slug>`**
- Scanned by customer → sees store's catalog
- Hums with the power of the full REZ ecosystem

---

## 2. Supported Business Types

Every business on REZ Now fits into one of these types. The UI adapts automatically.

### 2.1 Restaurant / Cafe / Cloud Kitchen
```
Merchant: Has a food menu with categories, items, variants, add-ons
Catalog: Menu items (food + drinks + desserts)
Customer journey: Browse menu → add to cart → checkout → pay → coins earned → WhatsApp receipt
Extras: Table ordering, kitchen chat, waiter call, pre-order scheduling, table reservation
```

### 2.2 Retail / Supermarket / Kirana
```
Merchant: Has physical products (clothes, electronics, groceries, provisions)
Catalog: Products with SKU, variants (size/color/pack), stock count, MRP
Customer journey: Browse catalog → select variant → checkout → pay → coins earned
Extras: Bulk pricing tiers, stock availability, in-store pickup
```

### 2.3 Salon / Beauty / Spa
```
Merchant: Offers services (haircut, facial, massage, grooming)
Catalog: Services with duration, staff assigned, price
Customer journey: Browse services → select staff + time → book appointment → pay deposit → coins earned
Extras: Service packages, recurring appointments, staff profiles with ratings
```

### 2.4 Service Professional (Plumber, Electrician, Tutor, etc.)
```
Merchant: Sells time or expertise
Catalog: Service packages (hourly rate, per-job, consultation)
Customer journey: Browse services → select package → book slot → pay → coins earned
Extras: Location (home visit / online), availability calendar
```

### 2.5 Taxi / Transport / Delivery
```
Merchant: Route-based or distance-based pricing
Catalog: Vehicle type × route/distance matrix
Customer journey: Select pickup/drop → choose vehicle → confirm → pay → coins earned
Extras: Real-time tracking, driver details, trip receipt
```

### 2.6 Healthcare / Clinic
```
Merchant: Consultation or procedure
Catalog: Services with doctor, duration, price
Customer journey: Browse doctors/services → book slot → pay consultation fee → coins earned
Extras: Patient history, appointment reminders via WhatsApp
```

### 2.7 Education / Coaching
```
Merchant: Courses or batches
Catalog: Courses with batches, schedules, faculty, fees
Customer journey: Browse courses → select batch → enroll → pay → coins earned
Extras: Attendance, study material links, AI tutor chatbot
```

### 2.8 Event / Venue Booking
```
Merchant: Hall / lawn / studio space
Catalog: Time slots with capacity, inclusions, pricing
Customer journey: Check availability → select slot → book → pay deposit → coins earned
Extras: Guest count, catering add-ons, decoration packages
```

---

## 3. Universal Catalog Schema

One schema to rule them all. Every business type maps to this.

```typescript
// Every sellable thing
interface CatalogItem {
  id: string;
  storeSlug: string;
  type: 'product' | 'service';    // vs 'product' — services have duration

  // Common
  name: string;
  description: string;
  basePrice: number;               // in paise (0 = "price on request")
  currency: 'INR';
  images: string[];               // URLs
  tags: string[];                 // ["popular", "new", "bestseller", "spicy", "gluten-free"]
  isAvailable: boolean;
  availableFrom?: string;          // HH:mm time gate
  availableTo?: string;

  // For FOOD (restaurant/cafe)
  category?: string;              // "Starters", "Mains", "Drinks"
  isVeg?: boolean;
  isEgg?: boolean;
  spiceLevel?: 'mild' | 'medium' | 'spicy' | 'very_spicy';
  customizationGroups?: CustomizationGroup[];  // "Size", "Add-on", "Extras"
  addOns?: AddOn[];              // "Extra cheese +₹30"

  // For RETAIL (products with variants)
  variants?: Variant[];            // { name: "Size", options: ["S","M","L","XL"] }
  sku?: string;
  stock?: number;
  mrp?: number;                  // MRP for comparison display
  bulkPricing?: BulkTier[];       // [{minQty: 10, price: 90}, {minQty: 50, price: 80}]

  // For SERVICES (salon, tutor, plumber)
  durationMinutes?: number;       // 30, 60, 90, 120
  staff?: StaffMember[];          // assigned staff or ["any available"]
  bookingRequiresDeposit?: boolean;
  depositAmount?: number;         // in paise

  // For APPOINTMENT-BASED (salon, clinic, tutoring)
  slots?: TimeSlot[];            // generated from operating hours + duration
  maxBookingsPerSlot?: number;   // capacity per slot
}

interface CustomizationGroup {
  name: string;                  // "Choose size", "Add extras"
  required: boolean;
  maxSelect?: number;             // multi-select cap
  options: {
    name: string;               // "Regular", "Large", "Extra cheese"
    priceAdjustment: number;     // +30 paise
    isDefault?: boolean;
  }[];
}

interface Variant {
  name: string;                 // "Size", "Color", "Pack"
  type: 'swatch' | 'text' | 'button';
  options: {
    value: string;              // "S", "Red", "500ml"
    label: string;              // "Small (S)", "Red", "500ml"
    priceAdjustment: number;     // +0 or +5000 paise
    stock?: number;             // 0 = out of stock
    image?: string;             // for swatches
  }[];
}

interface BulkTier {
  minQuantity: number;
  maxQuantity?: number;
  pricePerUnit: number;         // in paise
}

interface TimeSlot {
  date: string;                  // ISO date
  startTime: string;            // "09:00"
  endTime: string;              // "09:30"
  staffId?: string;
  capacity: number;
  booked: number;
  price: number;                 // may differ from basePrice (peak pricing)
}

// Store-level settings that determine which UI variant shows
interface StoreCatalogConfig {
  storeSlug: string;
  displayMode: 'menu' | 'catalog' | 'services' | 'appointments';
  catalogTitle: string;          // "Our Menu", "Our Collection", "Our Services"
  showPrices: boolean;
  allowWalkin: boolean;         // vs appointment-only
  requiresDeposit: boolean;
  operatingHours: WeeklySchedule;
}
```

---

## 4. Customer-Facing UI — Universal Store Page

The `/[storeSlug]` page adapts based on `displayMode`:

### `displayMode: 'menu'` — Restaurant / Cafe
```
┌─────────────────────────────────┐
│ [Store Logo]  Store Name  ⏰ Open │  ← operating hours badge
│ ⭐ 4.5 (120 reviews)   0.8km    │
├─────────────────────────────────┤
│ 🔍 Search menu...                │
│ [Veg] [Non-Veg] [Bestseller]   │
├─────────────────────────────────┤
│ [Category Tabs: Starters|Mains|...]│
│ ┌─────────────────────────────┐ │
│ │ 🍽️ Butter Chicken    ₹320   │ │  ← item card
│ │    Creamy tomato gravy...    │ │
│ │ [★★★★☆] [Add +]              │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 🌶️ Bhuna Ghosht    ₹350    │ │
│ │    Very spicy. 8 red...     │ │
│ │ [★★★★★] [Add +]              │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ [🛒 Cart (3) ₹820]             │  ← sticky bottom bar
└─────────────────────────────────┘
```

### `displayMode: 'catalog'` — Retail / Kirana
```
┌─────────────────────────────────┐
│ [Store Logo]  General Store  ⏰ Open │
│ ⭐ 4.2 (45 reviews)   1.2km    │
├─────────────────────────────────┤
│ 🔍 Search products...            │
│ [All] [Groceries] [Beverages]   │
├─────────────────────────────────┤
│ [Category: All Products]        │
│ ┌─────────────────────────────┐ │
│ │ [img] Tata Salt 1kg        │ │
│ │       ₹22  [MRP ₹25]       │ │
│ │  Pack: [500g] [1kg] [5kg]  │ │
│ │  Qty: [−] 1 [+]  [Add]     │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ [img] Amul Butter 500g     │ │
│ │       ₹275 [MRP ₹280]      │ │
│ │  Bulk: Buy 5+ @ ₹260 each  │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ [🛒 Cart (1) ₹22]              │
└─────────────────────────────────┘
```

### `displayMode: 'services'` — Salon / Service
```
┌─────────────────────────────────┐
│ [Logo]  Style Studio  ⏰ Open   │
│ ⭐ 4.8 (89 reviews)   0.5km   │
├─────────────────────────────────┤
│ Our Services                    │
│ ┌─────────────────────────────┐ │
│ │ 💇 Haircut (Gents)         │ │
│ │    30 min  ₹150            │ │
│ │  Staff: [Ravi ★4.9] [Any]  │ │
│ │  [Book Slot →]              │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 💆 Hair Spa                │ │
│ │    60 min  ₹400            │ │
│ │  Staff: [Priya ★4.7] [Any] │ │
│ │  [Book Slot →]              │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### `displayMode: 'appointments'` — Clinic / Tuition
```
┌─────────────────────────────────┐
│ [Logo]  Dr. Sharma Clinic ⏰ Open │
├─────────────────────────────────┤
│ Select Doctor / Service          │
│ ┌─────────────────────────────┐ │
│ │ 👨‍⚕️ Dr. Ankit Sharma          │ │
│ │    MBBS, General Physician  │ │
│ │    15 min free  ₹300       │ │
│ │  [View Slots →]            │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

---

## 5. REZ Ecosystem Integration

### 5.1 Universal QR System

Every store gets **3 QR codes** (merchant generates via rezmerchant dashboard):

| QR | URL | Use |
|----|-----|-----|
| **Order QR** | `now.rez.money/<slug>` | Opens store catalog — for restaurants, retailers |
| **Pay QR** | `now.rez.money/<slug>/pay?amount=X` | Direct payment link — for kirana, services |
| **Table QR** | `now.rez.money/<slug>?table=3` | Table ordering — for dine-in restaurants |

### 5.2 Coin System (Universal)

Coins work for **every** business type:
- Earn: `(amount / 10) * (rate / 100)` coins per ₹10 spent
- Rate varies by store (`baseCashbackPercent`)
- Redeem: 100 coins = ₹1 at any participating store
- Coins are **ecosystem-wide** — earned at restaurant, redeemed at kirana

### 5.3 REZ Consumer App Deep Links

From the REZ app, every store page links back:
- `rezapp://store/<slug>` → opens in REZ app if installed
- `https://now.rez.money/<slug>` → browser fallback
- `rezapp://order/<orderNumber>` → specific order status
- `rezapp://wallet` → coin balance

### 5.4 WhatsApp Integration

Every payment/confirmation sends a WhatsApp receipt:
- Template: `rez_receipt` (pre-approved by Meta)
- Variables: merchant name, amount, coins earned, order number
- Reorder CTA: `now.rez.money/<slug>?reorder=<orderNumber>`

---

## 6. AI Smart Assistant — Universal Commerce AI

The AI assistant works differently depending on the business type:

### Restaurant
```
Customer: "what can i eat for under 200?"
AI: "For under ₹200, I'd recommend our Paneer Tikka (₹180) or Dal 
     Tadka with 4 Roti (₹160). Both are vegetarian and served 
     in 15 minutes. Want me to add either to your order?"

Customer: "add paneer tikka"
AI: → Creates cart: {Paneer Tikka x1, ₹180}
    "Paneer Tikka added! Your cart total is ₹180. 
     Add Naan (+₹40) for a complete meal? 
     [Add Naan] [Checkout ₹180]"
```

### Retail
```
Customer: "do you have jeans for men in size 32?"
AI: "Yes! We have 3 options:
     1. Levi's 511 Slim Fit — ₹2,499 (was ₹3,200)
     2. Roadster Urban — ₹1,299 (was ₹1,800)
     3. Wrangler Regular — ₹1,899

     Which one interests you? I can check stock on the spot."

Customer: "check stock for Levi's in 32"
AI: "Levi's 511 in size 32 is in stock! 
     Also available in: 30, 34, 36. 
     Want me to add it to your cart?"
```

### Salon
```
Customer: "i want a haircut today at 4pm"
AI: "Looking at Dr. Priya's schedule... 
     4:00 PM is available! She's rated 4.9⭐ with 230 reviews.
     Shall I book you in for Haircut with Dr. Priya at 4 PM today?"
```

### Service
```
Customer: "my AC is not cooling, can someone visit tomorrow?"
AI: "Our AC repair service visits between 9 AM - 8 PM.
     We have slots available tomorrow (Apr 15):
     - 10:00 - 12:00  (₹350 visit charge)
     - 2:00 - 4:00     (₹350 visit charge)
     
     Diagnosis is free if you proceed with repair. 
     Should I book the 10 AM slot?"
```

### Technical Architecture (Same for All Types)

```typescript
// The AI receives context based on the store's displayMode
interface AIContext {
  store: Store;
  catalog: CatalogItem[];
  displayMode: 'menu' | 'catalog' | 'services' | 'appointments';
  customerHistory?: OrderHistoryItem[];   // if logged in
  storePolicies: {
    refundPolicy?: string;
    cancellationPolicy?: string;
    deliveryAreas?: string[];
  };
}

// System prompt is selected based on displayMode
const SYSTEM_PROMPTS = {
  menu: FOOD_ASSISTANT_PROMPT,       // food-specific: spice, veg/nonveg, wait time
  catalog: RETAIL_ASSISTANT_PROMPT,  // retail-specific: size, stock, MRP, bulk pricing
  services: SERVICE_ASSISTANT_PROMPT,// service-specific: duration, staff, availability
  appointments: BOOKING_ASSISTANT_PROMPT, // booking-specific: slot availability, doctor info
};
```

---

## 7. Payment Kiosk Mode — The Swipe Machine Killer

### Merchant Display (`/[storeSlug]/merchant/pay-display`)

A tablet/TV screen at the counter that shows:

```
┌──────────────────────────────────────────────┐
│           ✦ STYLE STUDIO ✦                     │
│         Now accepting payments                 │
│                                              │
│    ┌──────────────────────────────────┐     │
│    │                                  │     │
│    │         [ QR CODE ]              │     │
│    │    Scan to pay ₹0.00           │     │
│    │                                  │     │
│    │   [Amount Input] [₹500]        │     │
│    │                                  │     │
│    └──────────────────────────────────┘     │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │ LIVE PAYMENTS                            │ │
│  ├─────────────────────────────────────────┤ │
│  │ ✓ ₹320  received  12:34 PM              │ │
│  │ ✓ ₹150  received  12:31 PM              │ │
│  │ ✓ ₹85   received  12:28 PM              │ │
│  └─────────────────────────────────────────┘ │
│                                              │
│  Today's Total: ₹2,847   |  Transactions: 12  │
└──────────────────────────────────────────────┘
```

### Customer QR Page (`/[storeSlug]/pay/static`)

Full-screen payment page — customer scans and pays:
- Amount pre-filled if merchant set it
- OR manual amount entry
- Payment via UPI (PhonePe/GPay/Paytm) or Razorpay
- WhatsApp receipt on success
- Coins earned automatically

---

## 8. Complete File Manifest

### What's Already Built (Phases 1–13)

```
rez-now/
├── app/[storeSlug]/               # Restaurant Order & Pay
│   ├── page.tsx                    Menu browsing
│   ├── cart/page.tsx              Cart
│   ├── checkout/page.tsx            Checkout
│   ├── order/[orderNumber]/        Order confirmation
│   ├── pay/                       # Scan & Pay
│   │   ├── page.tsx               Amount entry
│   │   ├── checkout/page.tsx      Payment
│   │   └── confirm/              Payment confirmation
│   ├── reserve/                   Table reservation
│   ├── schedule/                  Pre-order scheduling
│   ├── staff/                    Staff dashboard
│   └── history/                  Per-store order history
├── app/
│   ├── orders/                    Global order history
│   ├── profile/                  Customer profile
│   ├── wallet/                   Coin balance + transactions
│   ├── search/                   Store search
│   └── offline/                  Offline fallback
├── components/
│   ├── menu/                      MenuItem, CartSummaryBar, CategoryNav
│   ├── checkout/                  PaymentOptions, SplitBillModal, CouponInput
│   ├── order/                    RatingModal, LoyaltyWidget, CancelOrderModal
│   ├── table/                    KitchenChatDrawer
│   ├── payment/                  NfcPayButton
│   ├── ui/                      Toast, OfflineBanner, PushPromptBanner
│   └── store/                   StoreCard, GoogleReviews
└── lib/
    ├── api/                      17 API modules
    ├── store/                    authStore, cartStore, uiStore
    └── hooks/                   useOrderSocket, useRazorpay, useNfc

rezbackend/
├── src/routes/webOrderingRoutes.ts  # Core ordering + payment routes
├── src/models/
│   ├── WebOrder.ts
│   ├── TableReservation.ts
│   └── BroadcastLog.ts
├── src/config/socketSetup.ts      # Real-time events
└── src/services/
    ├── whatsappReorderService.ts  # WhatsApp receipts
    └── webPushService.ts           # Push notifications
```

### Files to Build (New Platform)

#### Phase R1 — Universal Catalog + Retail Support

```
rez-now/
├── app/[storeSlug]/
│   └── page.tsx                    ← Adapts UI based on displayMode ('menu'|'catalog'|'services'|'appointments')
├── components/catalog/
│   ├── ProductCard.tsx            ← For retail: size/color swatches, stock, MRP
│   ├── ServiceCard.tsx             ← For services: duration, staff, book button
│   ├── AppointmentSlotPicker.tsx  ← For appointments: date/time grid
│   ├── VariantSelector.tsx         ← Swatch/text variant picker
│   ├── BulkPricingBadge.tsx       ← "Buy 5+ @ ₹X" tier display
│   └── CatalogHeader.tsx           ← Search + category filter (adapts per type)
├── components/cart/
│   ├── CartItem.tsx               ← Handles variants, add-ons, service bookings
│   └── CartSummary.tsx           ← Handles deposits for appointments
├── components/booking/
│   └── AppointmentFlow.tsx         ← Book service → select staff → select slot → pay deposit
└── lib/utils/catalogUtils.ts    ← Format price, stock, variants for display

rezbackend/
├── src/models/CatalogItem.ts      ← Universal catalog item model
├── src/models/Service.ts           ← For service-type stores
├── src/models/Appointment.ts      ← For appointment booking
├── src/routes/catalogRoutes.ts    ← CRUD for catalog items
├── src/routes/appointmentRoutes.ts ← Book/cancel appointment slots
└── src/services/catalogService.ts  ← Build catalog for a store
```

#### Phase R2 — Payment Kiosk + Bill Builder

```
rez-now/
├── app/[storeSlug]/
│   └── merchant/
│       ├── pay-display/
│       │   ├── page.tsx
│       │   └── PayDisplayClient.tsx  ← Live QR + transaction feed + Web Audio ding
│       └── bill-builder/
│           ├── page.tsx
│           └── BillBuilderClient.tsx  ← Multi-item entry → generates bill → QR code
├── lib/store/billStore.ts            ← Zustand: items[], total, status
└── lib/api/bill.ts                 ← POST /api/web-ordering/bill, GET /api/web-ordering/bill/:id

rezbackend/
├── src/models/Bill.ts               ← Merchant-created bills
├── src/routes/billRoutes.ts         ← Create, get, expire bills
├── src/config/socketSetup.ts         ← Add 'payment:received' → emit to staff:<slug> room
└── src/services/paymentNotifier.ts   ← On payment webhook: emit Socket.IO event
```

#### Phase R3 — Universal AI Assistant

```
rez-now/
├── components/chat/
│   ├── ChatWidget.tsx              ← Floating button + drawer (adapts per displayMode)
│   ├── ChatMessage.tsx             ← User + AI message bubbles
│   ├── ChatInput.tsx               ← Text input + voice button (Web Speech API)
│   ├── CartPreview.tsx             ← "Your cart looks good! [Checkout]" inline
│   └── AppointmentSuggestion.tsx   ← "Book 4 PM with Dr. Priya?" inline
├── lib/api/chat.ts                 ← POST /api/ai/chat
└── app/api/ai/chat/route.ts       ← Edge function → calls backend AI route

rezbackend/
├── src/routes/aiRoutes.ts           ← POST /ai/chat, GET /ai/history, DELETE /ai/history/:id
├── src/services/
│   ├── claudeService.ts            ← Claude API wrapper with retry + fallback
│   ├── menuRagService.ts            ← Build RAG context from catalog + displayMode
│   └── aiResponseParser.ts         ← Parse Claude output → structured JSON
├── src/prompts/
│   ├── foodAssistantPrompt.ts
│   ├── retailAssistantPrompt.ts
│   ├── serviceAssistantPrompt.ts
│   └── bookingAssistantPrompt.ts
├── src/models/AIMessage.ts          ← Conversation history (TTL 30 days)
└── src/middleware/
    └── aiRateLimiter.ts             ← 30 msgs/hour per customer
```

---

## 9. Implementation Priority

| Priority | Feature | Why It Matters | Impact |
|----------|---------|----------------|--------|
| **P0** | Universal catalog schema | Foundation — enables ALL business types | 🔴 Critical |
| **P0** | Retail display mode | Kirana/supermarket = massive TAM in India | 🔴 Critical |
| **P0** | Payment Kiosk | The swipe machine killer — merchant's #1 reason to switch | 🔴 Critical |
| **P1** | Service/appointment mode | Salon + clinic = high-frequency, high-value | 🟡 High |
| **P1** | AI Chatbot (food) | Demoable, impressive, drives adoption | 🟡 High |
| **P1** | Bill Builder | Retail + kirana need multi-item billing | 🟡 High |
| **P2** | AI Chatbot (retail + services) | Same widget, different prompts | 🟢 Medium |
| **P2** | WhatsApp AI bot | "Message us on WhatsApp" → AI handles | 🟢 Medium |
| **P3** | Taxi / transport mode | Niche, complex | ⚪ Low |
| **P3** | Education / event mode | Niche, complex | ⚪ Low |

---

## 10. Backend Schema Summary

```typescript
// ── Universal Catalog Item ────────────────────────────────────────────────────
CatalogItem {
  storeId, storeSlug,
  type: 'product' | 'service',
  name, description, basePrice,
  images[],
  tags[], isAvailable,
  
  // Food-specific
  category?, isVeg?, spiceLevel?,
  customizationGroups[], addOns[],
  
  // Retail-specific  
  variants[], sku?, stock?, mrp?, bulkPricing[],
  
  // Service-specific
  durationMinutes?, staff[], bookingRequiresDeposit?, depositAmount?,
  
  // Appointment-specific
  slots[], maxBookingsPerSlot?,
}

// ── Bill (merchant creates, customer pays via QR) ──────────────────────────
Bill {
  storeId, storeSlug,
  items: [{name, quantity, unitPrice, total}],
  subtotal, total,
  status: 'pending' | 'paid' | 'expired',
  expiresAt,
  createdBy,   // staffId
  paidAt?, paymentId?
}

// ── Appointment (service booking) ──────────────────────────────────────────
Appointment {
  storeId, storeSlug,
  customerId, customerPhone,
  serviceId, staffId,
  date, startTime, endTime,
  status: 'booked' | 'completed' | 'cancelled',
  depositPaid: boolean,
  depositAmount?,
  paymentId?
}

// ── AI Conversation ──────────────────────────────────────────────────────────
AIMessage {
  conversationId,
  storeSlug,
  customerId?,        // null if anonymous
  messages: [{role, content, type, metadata, createdAt}],
  updatedAt           // TTL index: 30 days
}
```

---

## 11. Environment Variables (Complete)

```env
# rez-now
NEXT_PUBLIC_API_URL=https://api.rezapp.com
NEXT_PUBLIC_RAZORPAY_KEY_ID=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
NEXT_PUBLIC_APP_URL=https://now.rez.money
NEXT_PUBLIC_CONSUMER_APP_SCHEME=rezapp          # For deep links
NEXT_PUBLIC_AI_ENABLED=true
NEXT_PUBLIC_DEFAULT_DISPLAY_MODE=menu             # 'menu' | 'catalog' | 'services' | 'appointments'

# rezbackend
JWT_SECRET=
WEB_JWT_SECRET=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
WHATSAPP_REORDER_ENABLED=true
VAPID_SUBJECT=mailto:support@rez.money
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
RAZORPAY_KEY_SECRET=

# AI (Phase R3)
CLAUDE_API_KEY=
AI_MODEL=claude-3-5-sonnet-20241022
AI_MAX_TOKENS=1024
AI_TEMPERATURE=0.7
MENU_CONTEXT_CACHE_TTL=3600
AI_CONVERSATION_TTL_DAYS=30

# Deep links (Phase R1)
IOS_BUNDLE_ID=com.rez.money
APPLE_TEAM_ID=XXXXXXXXXX
ANDROID_PACKAGE_NAME=com.rez.money
ANDROID_SHA256_CERT_FINGERPRINT=   # Get from Play Console
```
