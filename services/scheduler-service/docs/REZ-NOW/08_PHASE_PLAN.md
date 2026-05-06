# REZ Now — Phased Development Plan (R1-R6)

> Status: **ACTIVE** | Version: 1.0 | Date: 2026-04-14
> Scope: All phases R1 through R6 for the REZ Now universal merchant platform
> Repos: `imrejaul007/rez-now` (frontend) + `rezbackend` (backend)

---

## Overview

REZ Now is a universal QR transaction layer that replaces swipe machines, POS terminals, and WhatsApp catalogs with a zero-cost, AI-powered cloud platform. Every merchant gets `now.rez.money/<slug>`.

**8 super agents** are assigned across 6 phases. This document is the single source of truth for what to build, where, and in what order.

---

## PHASE R1 — Payment Kiosk

**Status: COMPLETE**

### What Was Built

| Component | Repo | Files | Status |
|-----------|------|-------|--------|
| PayDisplay page (merchant side) | rez-now | `app/[storeSlug]/merchant/pay-display/page.tsx` + `PayDisplayClient.tsx` | **BUILT** |
| `payment:received` Socket.IO event | rezbackend | `src/routes/webOrderingRoutes.ts` (emit-payment + today-payments) | **BUILT** |
| `POST /api/web-ordering/store/:slug/emit-payment` | rezbackend | `src/routes/webOrderingRoutes.ts` | **BUILT** |
| `GET /api/web-ordering/store/:slug/today-payments` | rezbackend | `src/routes/webOrderingRoutes.ts` | **BUILT** |
| Payment sound (Web Audio API) | rez-now | in `PayDisplayClient.tsx` | **BUILT** |

### What Is Built But Not Wired

| Component | Repo | Files | Status |
|-----------|------|-------|--------|
| Static QR page (customer side) | rez-now | `app/[storeSlug]/pay/static/page.tsx` | PARTIAL |
| `POST /api/web-ordering/store/:slug/emit-payment` endpoint | rezbackend | `src/routes/webOrderingRoutes.ts` | **BUILT** |
| `GET /api/web-ordering/store/:slug/today-payments` endpoint | rezbackend | `src/routes/webOrderingRoutes.ts` | **BUILT** |
| Wire `emit-payment` into Razorpay webhook | rezbackend | `src/routes/paymentRoutes.ts` | **TODO — BLOCKING** |

### Remaining TODO (R1 Finish)

**Agent**: 1 backend agent, 1 hour.

The `emit-payment` endpoint exists but is not called from the payment webhook. This is the single critical link between a real UPI payment and the merchant's live feed.

**File**: `rezbackend/src/routes/paymentRoutes.ts`

**Change**: Inside the Razorpay webhook handler (when `event === 'payment.captured'`), after the order/payment record is updated, call `emitPaymentReceived(storeSlug, amount, paymentId)`.

```typescript
// Inside paymentRoutes.ts — webhook handler
if (event === 'payment.captured') {
  const payment = payload.payload.payment.entity;
  // ... existing: update DB record ...

  // NEW: wire emit-payment into webhook
  const storeSlug = /* derive from payment.notes.storeSlug or order */;
  await emitPaymentReceived(storeSlug, {
    amount: payment.amount,
    paymentId: payment.id,
    method: payment.method,
    customerName: payment.notes?.customerName || 'Customer',
    timestamp: new Date(),
  });
}
```

**Verification**: Use Razorpay's test mode to simulate a payment. Merchant's pay-display should show the transaction within 2 seconds.

**Dependencies**: None — can ship immediately.

---

## PHASE R2 — Bill Builder

**Status: TODO | Agent: 1 | Complexity: Medium**

### What It Is

Merchant rings up items on a tablet screen (like a traditional cash register) and generates a QR code for the customer to scan and pay. Eliminates the need for a POS machine for multi-item transactions. Works for both REZ merchants and non-REZ merchants.

**Customer flow**: Merchant adds items → customer scans QR → amount pre-filled → customer pays → merchant sees "ding" on pay-display.

**Merchant flow**: Opens `/[storeSlug]/merchant/bill-builder` on tablet → adds items by name/price → taps "Generate QR" → customer scans and pays → transaction appears on pay-display.

### Files to Create

#### Frontend (rez-now)

```
app/[storeSlug]/merchant/bill-builder/
├── page.tsx                    # Server component: SSR store data, auth gate
└── BillBuilderClient.tsx        # Item entry grid, running total, QR generation

lib/store/billStore.ts           # Zustand: items[], subtotal, status, expiresAt

lib/api/bill.ts                  # POST /api/web-ordering/bill, GET /api/web-ordering/bill/:id
```

**`lib/store/billStore.ts`** (Zustand):
```typescript
interface BillStore {
  items: BillItem[];
  subtotal: number;
  total: number;
  billId: string | null;
  status: 'idle' | 'creating' | 'pending' | 'paid' | 'expired';
  expiresAt: Date | null;
  addItem: (name: string, price: number) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, qty: number) => void;
  clearBill: () => void;
  createBill: () => Promise<{ billId: string; qrUrl: string }>;
  checkBillStatus: (billId: string) => Promise<void>;
}
```

**`BillBuilderClient.tsx`** key features:
- Item quick-add buttons (frequent items as one-tap)
- Manual price entry for unknown items
- Quantity stepper per item
- Running subtotal display (sticky)
- "Generate QR" button → calls bill API → shows QR code
- QR stays active for 15 minutes (expire timer shown)
- On payment success → clears bill, plays "ding"

**`app/[storeSlug]/merchant/bill-builder/page.tsx`**:
- Server component that SSR-fetches store name/logo for branding
- PIN-gated (reuse `StaffDashboardClient` auth pattern)

#### Backend (rezbackend)

```
src/models/Bill.ts                # MongoDB Bill model
src/routes/billRoutes.ts           # POST /api/web-ordering/bill, GET /api/web-ordering/bill/:id
```

**`src/models/Bill.ts`**:
```typescript
{
  _id: ObjectId;
  storeSlug: string;
  storeId: ObjectId;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;    // in paise
    total: number;       // quantity * unitPrice
  }>;
  subtotal: number;      // in paise
  total: number;         // in paise (subtotal + additions - discounts)
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  expiresAt: Date;       // createdAt + 15 minutes
  paidAt?: Date;
  paymentId?: string;
  createdBy: string;     // staffId
  createdAt: Date;
}
// Indexes: { storeSlug: 1, status: 1 }, { expiresAt: 1 } (TTL 15min)
```

**`src/routes/billRoutes.ts`**:
- `POST /api/web-ordering/bill` — create bill, set `expiresAt = now + 15min`, return `billId + qrUrl`
- `GET /api/web-ordering/bill/:billId` — return bill if not expired
- `PATCH /api/web-ordering/bill/:billId/status` — update status (called from payment webhook)
- Background job: mark bills as `expired` when `expiresAt < now`

**`POST /api/web-ordering/bill` request**:
```json
{
  "storeSlug": "pizza-palace",
  "items": [{ "name": "Margherita Pizza", "quantity": 2, "unitPrice": 29900 }],
  "createdBy": "staff_123"
}
```

**`POST /api/web-ordering/bill` response**:
```json
{
  "billId": "bill_abc123",
  "qrUrl": "now.rez.money/pizza-palace/pay?billId=bill_abc123&amount=59800",
  "expiresAt": "2026-04-14T12:15:00Z",
  "total": 59800
}
```

**Customer QR page** (`/[storeSlug]/pay?billId=X`):
- Existing `pay/page.tsx` detects `billId` query param
- Pre-fills amount from bill, disables manual edit
- On payment success, marks bill `paid` via webhook
- Both bill and payment confirmation flow simultaneously

### Agent Assignment

| Agent | Tasks |
|-------|-------|
| Agent 1 (Full-stack) | All frontend files + all backend files + wire bill→payment→emit flow |

### Dependencies

- Phase R1 webhook wiring (must complete first — bill payment relies on the same `payment:received` event)

### Integration Points

- Bill paid → `payment:received` socket event (reuse existing) → appears on pay-display
- Bill paid → WhatsApp receipt (reuse existing `whatsappReorderService.ts`)
- Bill paid → coin credit for REZ merchants (reuse existing logic)

### Complexity: Medium

- Zustand store + API layer is well-understood (cartStore pattern exists)
- Bill model is simple (5 fields)
- QR page integration is additive (small change to existing pay page)
- Webhook wiring is the only novel piece

---

## PHASE R3 — AI Chatbot

**Status: TODO | Agents: 2 (1 frontend + 1 backend) | Complexity: Hard**

### What It Is

Every store on REZ Now has an AI-powered conversational assistant. Customers can ask questions about products, place orders via chat, get personalized recommendations, and make reservations — all without touching the UI. The AI reads the store's menu/catalog as context and responds in natural language. Supports both English and Hindi.

**Agent 1 (Frontend)**: Chat widget, drawer, API client, cart integration.
**Agent 2 (Backend)**: RAG service, Claude wrapper, prompt templates, conversation history model, rate limiting.

### Files to Create

#### Frontend (rez-now)

```
components/chat/
├── ChatWidget.tsx               # Floating button (bottom-right) + drawer
├── ChatMessage.tsx              # User + AI message bubbles
├── ChatInput.tsx                # Text input + send button + voice (Web Speech API)
├── OrderSuggestion.tsx           # "Your order: 2x Pizza, 1x Coke — ₹648 [Checkout]"
└── ReservationSuggestion.tsx    # "Book with Dr. Priya at 4 PM? [Confirm]"

lib/api/chat.ts                 # POST /api/ai/chat, GET /api/ai/history, DELETE /api/ai/history

app/api/ai/
└── chat/route.ts                # Edge function: validates request, calls backend
```

**`ChatWidget.tsx`**:
- Floating action button (bottom-right corner), persists across all pages
- On click: opens drawer with conversation history (from localStorage `conversationId`)
- Drawer has: header with store name, scrollable message list, sticky input at bottom
- Adapts per `displayMode`: food shows "order via chat", retail shows "find products", services shows "book via chat"
- Hides on merchant pages (staff/storedashboard) — customer-only
- Toggle: `NEXT_PUBLIC_AI_ENABLED` env var gates the widget

**`ChatMessage.tsx`**:
- User messages: right-aligned, blue bubble
- AI messages: left-aligned, white bubble with avatar
- AI `type: 'order'` → renders as `OrderSuggestion.tsx` component
- AI `type: 'recommendation'` → renders with product card preview
- AI `type: 'reservation'` → renders as `ReservationSuggestion.tsx` component
- AI `type: 'handoff'` → renders with "Connect to staff" button (opens KitchenChatDrawer)

**`OrderSuggestion.tsx`**:
- Shows cart preview: item list + total
- "Add to cart" button → merges items into `cartStore`
- "Keep browsing" dismisses

**`app/api/ai/chat/route.ts`** (Edge function):
```typescript
// Edge runtime — fast cold start
export async function POST(req: Request) {
  const { storeSlug, message, conversationId, customerId } = await req.json();
  // Forward to backend (or call Claude directly if backend unavailable)
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN! },
    body: JSON.stringify({ storeSlug, message, conversationId, customerId }),
  });
  return Response.json(await res.json());
}
```

#### Backend (rezbackend)

```
src/models/AIMessage.ts           # Conversation history model

src/routes/
└── aiRoutes.ts                   # POST /ai/chat, GET /ai/history, DELETE /ai/history/:conversationId

src/services/
├── claudeService.ts              # Claude API wrapper with retry + fallback
├── menuRagService.ts             # Build RAG context from catalog + displayMode
└── aiResponseParser.ts           # Parse Claude output → structured JSON

src/prompts/
├── menuAssistantPrompt.ts        # Food/restaurant system prompt
├── retailAssistantPrompt.ts      # Retail system prompt
├── serviceAssistantPrompt.ts    # Salon/service system prompt
└── bookingAssistantPrompt.ts   # Clinic/appointment system prompt

src/middleware/
└── aiRateLimiter.ts              # 30 msgs/hour per customerId (or IP if anonymous)
```

**`src/models/AIMessage.ts`**:
```typescript
{
  _id: ObjectId;
  conversationId: string;          // UUID from client (localStorage), 30-day TTL
  customerId?: string;             // null if anonymous
  storeSlug: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    type?: 'text' | 'order' | 'recommendation' | 'reservation' | 'handoff';
    metadata?: Record<string, unknown>; // cart items, reservation params
    createdAt: Date;
  }>;
  lastMessage: string;
  updatedAt: Date;
}
// Indexes: { conversationId: 1 }, { storeSlug: 1, customerId: 1 }, { updatedAt: 1 } (TTL 30 days)
```

**`src/routes/aiRoutes.ts`** — core logic:
1. Rate limit check (30 msgs/hour)
2. Fetch `AIMessage` doc by `conversationId` (or create new)
3. `menuRagService.buildContext(storeSlug, displayMode)` — fetch catalog from MongoDB, cache in Redis (TTL 1h)
4. Format system prompt based on `displayMode`
5. Call `claudeService.chat(systemPrompt + conversationHistory + newMessage)`
6. Parse response with `aiResponseParser.parse(output)` → structured `{ type, content, items?, cart?, reservation? }`
7. If `type === 'order'`: verify each item against live menu (prevents hallucination)
8. Save `AIMessage` doc (append user message + assistant response)
9. Return structured response

**`src/services/claudeService.ts`**:
```typescript
async chat(prompt: string, model = 'claude-3-5-sonnet-20241022'): Promise<string> {
  // Retry 3x with exponential backoff
  // Fallback: if Claude down, return "Our assistant is taking a break."
  // Log cost + latency to analytics
}
```

**`src/services/menuRagService.ts`**:
```typescript
async buildContext(storeSlug: string, displayMode: string): Promise<MenuContext> {
  // 1. Check Redis cache: `rag:${storeSlug}`
  // 2. If miss: fetch CatalogItem/MenuItem from MongoDB
  // 3. Format per displayMode:
  //    - menu: categories + items + prices + tags
  //    - catalog: products + variants + stock + MRP
  //    - services: services + duration + staff
  //    - appointments: doctors/services + slots
  // 4. Cache with TTL 3600s
  // 5. Return MenuContext object
}
```

**`src/prompts/menuAssistantPrompt.ts`** (example for food):
```
You are a friendly assistant at {storeName}. Customer writes in {language}.
Answer menu questions, take orders, make recommendations.
Rules:
- NEVER invent items not in the menu
- Keep responses short (3 sentences max)
- Always mention prices in recommendations
- If customer wants human: respond type="handoff"
- Format orders as JSON: { items: [{name, quantity}] }
Menu: {menuContext}
Customer: {message}
```

**`src/middleware/aiRateLimiter.ts`**:
- In-memory Map per `customerId` (or IP if anonymous)
- Track message count per hour
- 429 response with `retryAfter` header if exceeded

### Agent Assignment

| Agent | Tasks |
|-------|-------|
| Agent 1 (Frontend) | All frontend files: ChatWidget, ChatMessage, ChatInput, OrderSuggestion, ReservationSuggestion, lib/api/chat.ts, app/api/ai/chat/route.ts |
| Agent 2 (Backend) | All backend files: AIMessage model, aiRoutes.ts, claudeService.ts, menuRagService.ts, aiResponseParser.ts, all prompt templates, aiRateLimiter.ts |

### Dependencies

- Phase R2 (Bill Builder) not required — chatbot works standalone
- `NEXT_PUBLIC_AI_ENABLED` env var must be set
- `CLAUDE_API_KEY` must be set in rezbackend

### Non-Dependent Work (Can Start Now)

- Backend Agent 2 can start immediately on prompt templates, Claude wrapper, and RAG service (they use the existing menu model)
- Frontend Agent 1 can start on ChatWidget component (mock API responses, no backend needed for UI)

### Complexity: Hard

- Claude API integration with retry/fallback patterns
- RAG context building from MongoDB (needs careful caching)
- Response parsing (Claude structured output can be unreliable — always validate orders against live menu)
- Conversation state management across localStorage + backend
- Real-time feel (streaming responses preferred, but polling acceptable for MVP)

---

## PHASE R4 — Sub-2s Settlement

**Status: TODO | Agent: 1 | Complexity: Medium**

### What It Is

Customer taps "Pay" and sees a confirmation screen in under 2 seconds. Currently: payment processing + webhook + DB write + socket emit takes 3-8 seconds. Target: P99 < 2s.

**The trick**: Show optimistic confirmation immediately (Razorpay's UPI flow is already fast), verify in the background, push via WebSocket when confirmed.

### Changes

#### Frontend (rez-now)

**`components/checkout/PaymentOptions.tsx`** — optimistic confirmation:
- On Razorpay success callback (`.on('payment.success')`):
  1. Immediately show "Payment received! Verifying..." screen
  2. Trigger `createRazorpayOrder` API call (non-blocking, background)
  3. Subscribe to `payment:confirmed` WebSocket event
  4. On `payment:confirmed` event → show green confirmation + coins earned
  5. Timeout (10s) → show "Verifying..." with retry button

**`app/[storeSlug]/pay/confirm/[paymentId]/page.tsx`** — update:
- Replace polling loop with Socket.IO subscription
- Remove existing polling entirely

**`lib/hooks/usePaymentConfirmation.ts`** (new):
```typescript
// Hook: subscribe to payment:confirmed for a given paymentId
// On event: { paymentId, status, coinsEarned, orderNumber }
// Timeout: resolve as "pending" after 10s
```

#### Backend (rezbackend)

**`src/routes/paymentRoutes.ts`** — webhook optimization:
- Move signature verification to a `setImmediate()` call (non-blocking)
- Keep DB writes async
- Emit `payment:confirmed` immediately after DB write commits
- Log end-to-end latency: `Date.now() - webhookReceivedAt`

**`src/config/socketSetup.ts`** — add new event:
```typescript
// New event: payment:confirmed — more specific than payment:received
io.on('connection', (socket) => {
  socket.on('subscribe:payment', (paymentId) => {
    socket.join(`payment:${paymentId}`);
  });
});
// Emit: io.to(`payment:${paymentId}`).emit('payment:confirmed', { paymentId, status, coinsEarned });
```

### Settlement SLA

| Step | Current Latency | Target |
|------|----------------|--------|
| Customer completes UPI flow | 1-3s | 1-3s |
| Razorpay → webhook received | 500ms-2s | 500ms |
| DB write + coin credit | 1-3s | 200ms (async) |
| Socket.IO emit | 100ms | 50ms |
| **Total (P50)** | **4-8s** | **< 2s** |

### Agent Assignment

| Agent | Tasks |
|-------|-------|
| Agent 1 (Full-stack) | All changes above: frontend optimistic UI + backend webhook optimization + Socket.IO new event |

### Dependencies

- Phase R1 webhook wiring must be complete
- Socket.IO infrastructure already exists

### Complexity: Medium

- Mostly refactoring existing payment flow
- New Socket.IO event is additive
- Optimistic UI pattern is well-understood
- Risk: race conditions if payment webhook arrives after customer navigates away

---

## PHASE R5 — Universal Catalog (8 Business Types)

**Status: TODO | Agents: 2 (1 data model + 1 display modes) | Complexity: Hard**

### What It Is

Extend REZ Now beyond restaurants to serve 8 business types: retail, salon, services, clinic, taxi, education, coaching, event venues. The same URL (`now.rez.money/<slug>`) adapts its UI entirely based on the store's `displayMode`.

**Agent 1 (Data Model)**: Universal `CatalogItem` schema, new models, backend routes, catalog service.
**Agent 2 (Display Modes)**: 4 display mode components, adaptation logic in store page, variant selectors.

### Files to Create

#### Backend — Agent 1

```
src/models/
├── CatalogItem.ts            # Universal catalog item (replaces MenuItem for non-food)
├── Service.ts                # For service-type stores
└── Appointment.ts            # For appointment booking

src/routes/
├── catalogRoutes.ts           # CRUD for catalog items
└── appointmentRoutes.ts       # Book/cancel appointment slots

src/services/
└── catalogService.ts          # Build catalog for a store (handles displayMode)
```

**`src/models/CatalogItem.ts`**:
```typescript
{
  _id: ObjectId;
  storeId: ObjectId;
  storeSlug: string;
  type: 'product' | 'service';

  // Common
  name: string;
  description: string;
  basePrice: number;       // in paise (0 = "price on request")
  currency: 'INR';
  images: string[];
  tags: string[];          // ["popular", "new", "bestseller"]
  isAvailable: boolean;

  // Food-specific (for menu displayMode)
  category?: string;
  isVeg?: boolean;
  isEgg?: boolean;
  spiceLevel?: 'mild' | 'medium' | 'spicy' | 'very_spicy';
  customizationGroups?: CustomizationGroup[];
  addOns?: AddOn[];

  // Retail-specific
  variants?: Variant[];
  sku?: string;
  stock?: number;
  mrp?: number;
  bulkPricing?: BulkTier[];

  // Service-specific
  durationMinutes?: number;
  staff?: string[];
  bookingRequiresDeposit?: boolean;
  depositAmount?: number;

  // Appointment-specific
  slots?: TimeSlot[];
  maxBookingsPerSlot?: number;
}
```

**`src/models/Service.ts`**:
```typescript
{
  _id: ObjectId;
  storeId: ObjectId;
  storeSlug: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  staff: Array<{ id: string; name: string; rating: number }>;
  depositRequired: boolean;
  depositAmount: number;
  bufferMinutes: number;   // gap between appointments
}
```

**`src/models/Appointment.ts`**:
```typescript
{
  _id: ObjectId;
  storeId: ObjectId;
  storeSlug: string;
  customerId: string;
  customerPhone: string;
  serviceId: ObjectId;
  staffId?: string;
  date: string;            // ISO date
  startTime: string;      // "09:00"
  endTime: string;         // "09:30"
  status: 'booked' | 'completed' | 'cancelled' | 'no_show';
  depositPaid: boolean;
  depositAmount: number;
  paymentId?: string;
  createdAt: Date;
}
```

**`src/routes/catalogRoutes.ts`**:
- `GET /api/catalog/:storeSlug` — returns catalog items formatted by `displayMode`
- `POST /api/catalog/:storeSlug/items` — create catalog item (merchant)
- `PATCH /api/catalog/:storeSlug/items/:id` — update item (merchant)
- `DELETE /api/catalog/:storeSlug/items/:id` — delete item (merchant)

**`src/services/catalogService.ts`**:
```typescript
async getCatalog(storeSlug: string): Promise<CatalogResponse> {
  const store = await Store.findOne({ slug: storeSlug });
  const items = await CatalogItem.find({ storeSlug, isAvailable: true });

  switch (store.displayMode) {
    case 'menu':      return formatMenuCatalog(items);      // categories + food fields
    case 'catalog':   return formatRetailCatalog(items);    // products + variants + stock
    case 'services':  return formatServiceCatalog(items);  // services + duration + staff
    case 'appointments': return formatAppointmentCatalog(items); // doctors + slots
  }
}
```

#### Frontend — Agent 2

```
app/[storeSlug]/
└── page.tsx                    # Modify: route to correct display component

components/catalog/
├── ProductCard.tsx              # Retail: size/color swatches, stock, MRP badge
├── ServiceCard.tsx              # Services: duration, staff picker, book button
├── AppointmentSlotPicker.tsx    # Appointments: date/time grid with availability
├── VariantSelector.tsx           # Swatch/text/button variant picker
├── BulkPricingBadge.tsx         # "Buy 5+ @ ₹X" tier display
└── CatalogHeader.tsx            # Search + category filter (adapts per type)

components/cart/
├── CartItem.tsx                 # Handles variants, add-ons, service bookings
└── CartSummary.tsx              # Handles deposit for appointments

components/booking/
└── AppointmentFlow.tsx           # Book service → select staff → select slot → pay deposit

lib/utils/
└── catalogUtils.ts              # formatPrice, formatStock, formatDuration, formatVariant

app/[storeSlug]/merchant/catalog/
└── page.tsx + CatalogManagerClient.tsx  # Merchant CRUD for catalog items
```

**`app/[storeSlug]/page.tsx`** — modify:
```typescript
// Currently: checks store.hasMenu → show menu OR scan&pay
// After R5: checks store.displayMode → route to appropriate display
// displayMode: 'menu' | 'catalog' | 'services' | 'appointments'
// For 'catalog'/'services'/'appointments': swap menu components for catalog components
```

**`components/catalog/ProductCard.tsx`** (retail):
- Product image (required for retail, optional for food)
- Name + price + MRP comparison badge ("Save ₹X")
- Variant selector: swatches (color/size) or text options
- Stock indicator: "In stock" / "Only 3 left" / "Out of stock"
- Bulk pricing badge
- Quantity stepper + "Add to cart"

**`components/catalog/ServiceCard.tsx`** (services):
- Service name + description + price
- Duration badge ("60 min")
- Staff picker: show top-rated staff member first, "Any available" option
- "Book Slot" button → opens `AppointmentSlotPicker`

**`components/catalog/AppointmentSlotPicker.tsx`**:
- Date picker: next 7 days
- Time grid: generated from store hours + service duration
- Shows: booked slots (gray), available slots (green)
- "Deposit ₹X to book" — triggers Razorpay payment
- On payment success → create Appointment + send confirmation

**`app/[storeSlug]/merchant/catalog/page.tsx`** (merchant side):
- Table view of catalog items
- Inline edit: name, price, stock, variants
- "Add item" form
- Toggle availability
- Bulk import via CSV

### Agent Assignment

| Agent | Tasks |
|-------|-------|
| Agent 1 (Backend) | CatalogItem, Service, Appointment models + catalogRoutes.ts + appointmentRoutes.ts + catalogService.ts |
| Agent 2 (Frontend) | All display components (ProductCard, ServiceCard, AppointmentSlotPicker, etc.) + store page routing + merchant catalog manager |

### Dependencies

- Phase R2 (Bill Builder) not required — catalog is independent
- Phase R3 (AI Chatbot) not required — chatbot prompt templates can be extended later
- Both agents can start immediately (they work on separate layers)

### Complexity: Hard

- 4 distinct display modes, each with its own component set
- Variant system is complex (swatches, text, button types + price adjustments)
- Appointment slot availability needs real-time calculation
- Merchant catalog manager is a full CRUD interface (non-trivial)
- Backwards compatibility: existing `store.hasMenu` must map to `displayMode: 'menu'`

---

## PHASE R6 — Advanced Features

**Status: TODO | Agents: 2 | Complexity: Medium**

### Feature Set

Four independent features, each can be built in parallel by separate agents:

| Feature | Description | Agent |
|---------|-------------|-------|
| WhatsApp ordering integration | "Message us on WhatsApp" → AI handles ordering | Agent 1 |
| Thermal printer API | Send receipt to Bluetooth/USB printer from staff dashboard | Agent 1 |
| Multi-store management | One merchant manages multiple outlets from one dashboard | Agent 2 |
| Cash + digital split | Merchant enters cash received, system reconciles end-of-day | Agent 2 |

### Feature A: WhatsApp Ordering Integration

**Agent 1 | Complexity: Medium**

**What it is**: Every store gets a WhatsApp Business integration. Customers message the store's WhatsApp number, and an AI chatbot (powered by the same Claude RAG system from Phase R3) handles menu questions, takes orders, and sends payment links.

**Files**:

```
rezbackend/
src/routes/whatsappRoutes.ts        # WhatsApp webhook (incoming messages)
src/services/whatsappAiService.ts   # Route WhatsApp message to Claude
src/services/whatsappOrderService.ts # Convert AI order → REZ order + payment link

src/prompts/whatsappAssistantPrompt.ts  # Adapted prompt for WhatsApp (shorter, no markdown)
```

**Architecture**:
```
WhatsApp message (incoming webhook)
    → whatsappRoutes.ts (verify signature, parse message)
    → whatsappAiService.ts (call Claude with menu RAG)
    → whatsappOrderService.ts (if order type: create order + generate payment link)
    → WhatsApp message (outgoing: response or payment link)
```

**Key consideration**: WhatsApp has strict message templates. Order confirmations must use pre-approved templates (`rez_order_confirmed`, `rez_payment_link`). Free-form AI responses only for within 24h of customer message (session window).

### Feature B: Thermal Printer API

**Agent 1 | Complexity: Medium**

**What it is**: Staff dashboard has a "Print" button on each order. Clicking it sends the receipt to a connected thermal printer (Bluetooth or USB via browser Web Bluetooth / ESC/POS API).

**Files**:

```
rez-now/
components/order/
└── PrintReceipt.tsx            # Print button + ESC/POS formatter + Web Bluetooth print

lib/utils/escpos.ts             # ESC/POS command builder (format: bold, cut, QR, logo)
lib/hooks/useThermalPrinter.ts   # Web Bluetooth device discovery + print job
```

**`lib/utils/escpos.ts`**:
```typescript
// Build raw bytes for common receipt format
function buildReceipt(order: Order): Uint8Array {
  return escpos
    .align('center')
    .size(2).text('REZ NOW')
    .size(1).text(order.storeName)
    .feed(1)
    .align('left')
    .text(`Order #${order.orderNumber}`)
    .text(`Date: ${formatDate(order.createdAt)}`)
    .feed(1)
    .text('--------------------------------')
    .items(order.items.map(i => `${i.name} x${i.qty}  ₹${i.price}`))
    .text('--------------------------------')
    .text(`Total: ₹${order.total}`)
    .feed(1)
    .qr(order.paymentId, { size: 8 })  // QR code of payment ID
    .cut();
}
```

**`useThermalPrinter.ts`**:
- Use Web Bluetooth API to discover ESC/POS-compatible printers
- Fallback: `window.print()` with `@media print` CSS for USB/network printers
- Store selected printer in localStorage

**Integration**:
- Add "Print Receipt" button to `OrderStatusCard` on staff dashboard
- Add "Print KOT (Kitchen Order Ticket)" button to kitchen display

### Feature C: Multi-Store Management

**Agent 2 | Complexity: Medium**

**What it is**: A merchant with multiple outlets (e.g., "Pizza Palace — Koramangala" and "Pizza Palace — Indiranagar") manages all from one dashboard. Select store from dropdown, all views filter to that outlet.

**Files**:

```
rez-now/
app/[storeSlug]/merchant/
└── dashboard/page.tsx + MultiStoreDashboard.tsx  # Store selector dropdown + filtered views

components/merchant/
├── StoreSwitcher.tsx              # Dropdown: "Switch outlet"
└── MultiStoreAnalytics.tsx        # Combined analytics across outlets

lib/api/merchant.ts               # GET /api/merchant/stores, GET /api/merchant/aggregate-stats
```

**Backend** (rezbackend):
```
src/routes/merchantRoutes.ts      # GET /api/merchant/stores (all outlets for logged-in merchant)
src/models/Store.ts               # Add: { parentMerchantId, outletName }
```

**Behavior**:
- Merchant logs in → `GET /api/merchant/stores` returns all outlets
- Dropdown in header: "Pizza Palace — Koramangala | Indiranagar | HSR"
- All stats, orders, catalog views filter to selected outlet
- "All outlets" view: combined totals with per-outlet breakdown table

### Feature D: Cash + Digital Split

**Agent 2 | Complexity: Medium**

**What it is**: End-of-day reconciliation. Merchant enters total cash collected, system calculates digital total from transactions, shows discrepancy, and flags mismatches.

**Files**:

```
rez-now/
app/[storeSlug]/merchant/
├── reconcile/page.tsx + ReconcileClient.tsx   # Cash entry + reconciliation view
└── components/CashEntryForm.tsx               # Input: cash in drawer, expected vs actual

lib/api/reconcile.ts              # POST /api/reconcile, GET /api/reconcile/:storeSlug/:date

rezbackend/
src/routes/reconcileRoutes.ts      # POST /api/reconcile, GET /api/reconcile/:storeSlug/:date
src/services/reconcileService.ts   # Calculate expected, detect discrepancies
```

**`ReconcileClient.tsx`**:
- Shows: total digital transactions today (from `today-payments` API)
- Input: "Cash in drawer" — merchant enters manually
- Calculates: `digital + cash = expected total`
- If `cash entered !== expected cash`: shows discrepancy in red
- "Lock & Export" button: marks day reconciled, exports CSV
- Flag for review if discrepancy > 5% of total

**`src/services/reconcileService.ts`**:
```typescript
interface Reconciliation {
  date: string;
  storeSlug: string;
  totalDigital: number;
  totalCash: number;
  expectedCash: number;
  discrepancy: number;            // entered - expected
  discrepancyPercent: number;
  status: 'open' | 'reconciled' | 'flagged';
  transactions: Transaction[];     // for CSV export
}
```

### Agent Assignment

| Agent | Tasks |
|-------|-------|
| Agent 1 | WhatsApp ordering integration + Thermal printer API |
| Agent 2 | Multi-store management + Cash + digital split |

### Dependencies

- WhatsApp integration: requires WhatsApp Business API credentials (separate Meta approval process) — can build UI/routes, webhook needs credentials
- Thermal printer: works standalone, no backend changes needed
- Multi-store: requires `parentMerchantId` field on Store model (additive migration)
- Cash reconciliation: uses existing `today-payments` API, no new backend model needed

---

## Critical Path

### Sequential Dependencies (Must Build in Order)

```
R1 webhook wiring ──┐
                   ├─ R4 Sub-2s Settlement (needs R1 webhook to optimize)
                   │
R2 Bill Builder ───┤
                   │
R3 AI Chatbot ─────┤── R6 WhatsApp ordering (reuses Phase R3 RAG service)
                   │
R5 Universal Catalog ── R6 Multi-store (uses displayMode from R5)
```

### Visual Critical Path

```
[R1 webhook] ────────── [R4 Settlement]
      │
      └─ [R2 Bill Builder] ── [R5 Universal Catalog] ── [R6 Multi-store]
                              │
[R3 AI Chatbot] ─────────────┴──── [R6 WhatsApp ordering]
```

### Parallelization Map

| Phases That Can Run Concurrently | Why |
|---------------------------------|-----|
| R2 (Bill Builder) and R3 (AI Chatbot) | Separate repos (frontend split is clean), shared only by being rez-now projects |
| R3 (Backend) and R2 (Frontend) | Backend Agent 2 can start immediately on prompts/Claude wrapper with existing menu model |
| R5 Backend (Agent 1) and R3 Frontend (Agent 1) | Different layers, no shared files |
| R6 Features A+B and R6 Features C+D | Independent feature sets |
| R4 (Settlement) and R5 (Catalog) | R4 touches payment flow, R5 touches catalog — zero overlap |

### Optimal 8-Agent Execution Plan

| Wave | Agents | Work |
|------|--------|------|
| **Wave 1** | Agent A | R1 webhook wiring finish (1-2 hours, backend only) |
| **Wave 1** | Agent B | R2 Bill Builder (full-stack, 3-4 days) |
| **Wave 1** | Agent C | R3 AI Chatbot Backend (prompts, Claude, RAG, conversation model, 3-4 days) |
| **Wave 1** | Agent D | R3 AI Chatbot Frontend (ChatWidget, API client, 2-3 days) |
| **Wave 2** | Agent E | R5 Universal Catalog Backend (models, routes, catalog service, 4-5 days) |
| **Wave 2** | Agent F | R5 Universal Catalog Frontend (4 display components, store page routing, 4-5 days) |
| **Wave 3** | Agent G | R4 Sub-2s Settlement (full-stack, 2-3 days) — starts after Wave 1 Agent A |
| **Wave 4** | Agent H1 | R6 WhatsApp ordering + Thermal printer (3-4 days) |
| **Wave 4** | Agent H2 | R6 Multi-store + Cash reconciliation (3-4 days) |

### Total Estimated Timeline

| Phase | Agents | Estimated Time |
|-------|--------|---------------|
| R1 finish (webhook) | 1 backend | 1-2 hours |
| R2 Bill Builder | 1 | 3-4 days |
| R3 AI Chatbot | 2 (parallel frontend + backend) | 3-4 days |
| R4 Sub-2s Settlement | 1 | 2-3 days |
| R5 Universal Catalog | 2 (parallel backend + frontend) | 4-5 days |
| R6 Advanced Features | 2 (parallel) | 3-4 days |

**Total**: ~8 super-agent-days of work, ~15-20 calendar days if staggered optimally.

---

## Summary: All Files by Phase

### Phase R1 Finish
```
rezbackend/
src/routes/paymentRoutes.ts       # Wire emit-payment into webhook
```

### Phase R2 — Bill Builder
```
rez-now/
app/[storeSlug]/merchant/bill-builder/
├── page.tsx
└── BillBuilderClient.tsx
lib/store/billStore.ts
lib/api/bill.ts

rezbackend/
src/models/Bill.ts
src/routes/billRoutes.ts
```

### Phase R3 — AI Chatbot
```
rez-now/
components/chat/
├── ChatWidget.tsx
├── ChatMessage.tsx
├── ChatInput.tsx
├── OrderSuggestion.tsx
└── ReservationSuggestion.tsx
lib/api/chat.ts
app/api/ai/chat/route.ts

rezbackend/
src/models/AIMessage.ts
src/routes/aiRoutes.ts
src/services/claudeService.ts
src/services/menuRagService.ts
src/services/aiResponseParser.ts
src/prompts/menuAssistantPrompt.ts
src/prompts/retailAssistantPrompt.ts
src/prompts/serviceAssistantPrompt.ts
src/prompts/bookingAssistantPrompt.ts
src/middleware/aiRateLimiter.ts
```

### Phase R4 — Sub-2s Settlement
```
rez-now/
components/checkout/PaymentOptions.tsx    # Optimistic UI
app/[storeSlug]/pay/confirm/[paymentId]/page.tsx  # Socket.IO subscription
lib/hooks/usePaymentConfirmation.ts       # New hook

rezbackend/
src/routes/paymentRoutes.ts               # Non-blocking webhook
src/config/socketSetup.ts                 # payment:confirmed event
```

### Phase R5 — Universal Catalog
```
rezbackend/
src/models/CatalogItem.ts
src/models/Service.ts
src/models/Appointment.ts
src/routes/catalogRoutes.ts
src/routes/appointmentRoutes.ts
src/services/catalogService.ts

rez-now/
app/[storeSlug]/page.tsx                  # Display mode routing
components/catalog/
├── ProductCard.tsx
├── ServiceCard.tsx
├── AppointmentSlotPicker.tsx
├── VariantSelector.tsx
├── BulkPricingBadge.tsx
└── CatalogHeader.tsx
components/cart/
├── CartItem.tsx
└── CartSummary.tsx
components/booking/AppointmentFlow.tsx
lib/utils/catalogUtils.ts
app/[storeSlug]/merchant/catalog/
├── page.tsx
└── CatalogManagerClient.tsx
```

### Phase R6 — Advanced Features
```
rezbackend/
src/routes/whatsappRoutes.ts
src/services/whatsappAiService.ts
src/services/whatsappOrderService.ts
src/prompts/whatsappAssistantPrompt.ts
src/routes/merchantRoutes.ts              # Multi-store
src/routes/reconcileRoutes.ts
src/services/reconcileService.ts

rez-now/
components/order/PrintReceipt.tsx
lib/utils/escpos.ts
lib/hooks/useThermalPrinter.ts
components/merchant/
├── StoreSwitcher.tsx
└── MultiStoreAnalytics.tsx
lib/api/merchant.ts
lib/api/reconcile.ts
app/[storeSlug]/merchant/
├── dashboard/page.tsx + MultiStoreDashboard.tsx
└── reconcile/page.tsx + ReconcileClient.tsx
    components/CashEntryForm.tsx
```
