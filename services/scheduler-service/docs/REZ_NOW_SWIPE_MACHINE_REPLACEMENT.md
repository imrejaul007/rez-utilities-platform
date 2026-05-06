# REZ Now — Swipe Machine Replacement & AI Commerce Platform

> Status: **PLANNING** | Version: 1.0 | Date: 2026-04-14
> Goal: Replace POS/swipe machines with a zero-cost, AI-powered, cloud-managed payment & ordering platform

---

## 1. Vision

**REZ Now = Your phone + REZ Now = Better than a swipe machine.**

A merchant pays ₹0 upfront, ₹0 monthly, and gets:
- Instant payment acceptance (UPI, card, wallet)
- Automatic loyalty / coins
- Customer data (phone, name, order history)
- Kitchen chat / waiter calls
- AI chatbot that answers product questions and takes orders
- Analytics dashboard
- Multi-staff support

A customer pays faster, earns coins, never loses a receipt, and gets a personal AI shopping assistant.

---

## 1b. Two-Tier Merchant Model

REZ Now serves two distinct merchant types, each with a tailored feature set:

### REZ Merchant (Subscriber) — `store.isProgramMerchant === true`
- **Payment Kiosk**: Live QR + transaction feed + "ding" sound
- **Customer loyalty**: Coins earned on every payment, redeemable wallet
- **Full ordering**: Menu browsing, cart, checkout, order tracking
- **Kitchen display**: Live order feed, item status updates
- **AI chatbot**: RAG-powered menu assistant, order taking, recommendations
- **Staff dashboard**: Waiter call queue, multi-staff support
- **Analytics**: Sales dashboard, customer insights, coin economics
- **Consumer app**: Deep links, saved payment methods, order history

### Non-REZ Merchant — `store.isProgramMerchant === false`
- **Payment Kiosk**: Live QR + transaction feed + "ding" sound
- **Order/booking**: Menu or service catalog (display only)
- **No loyalty**: No coins, no wallet, no customer accounts
- **QR on counter**: Customer scans → enters amount → pays → done
- **Bill builder**: Merchant rings up items → QR shows total → customer pays
- **Basic analytics**: Transaction count and daily total only

> The Payment Kiosk is the same page for both types. Feature gates control what appears:
> - `isProgramMerchant` → show "REZ Loyalty Active" card + coin earn messaging
> - `!isProgramMerchant` → show "QR Payment Active" card
>
> The `store.isProgramMerchant` flag on the `Store` model drives all conditional UI.

---

## 2. Competitive Positioning

| Feature | Swipe Machine | Competitors (PhonePe, Paytm QR) | REZ Merchant | Non-REZ Merchant |
|---------|--------------|--------------------------------|--------------|-------------------|
| Hardware cost | ₹1,500-3,000 | ₹0 | ₹0 | ₹0 |
| Monthly fee | ₹0-500 | ₹0 | ₹0 | ₹0 |
| MDR | 1.5-3% | 0% (merchant bears cost) | 0% + coins back | 0% |
| Customer loyalty | None | None | Built-in coins | None |
| Order taking | None | None | Full menu + AI chatbot | None |
| Customer data | None | Limited | Full profile + history | None |
| Kitchen display | Separate ₹5,000 | None | Built-in | None |
| Multi-item billing | Via POS addon | No | Full bill builder | Bill builder |
| AI chatbot | None | None | Yes — product Q&A + orders | None |
| Settlement | T+1 to T+2 | Instant | Instant | Instant |
| Audio confirmation | "Ding" | None | "Ding" + WhatsApp | "Ding" |
| WhatsApp receipt | None | None | Yes | No |

---

## 3. Two Modes — Both Replaces the Swipe Machine

### Mode A: Order & Pay (Restaurants, Cafes, Cloud Kitchens)
Merchant has a menu → customer browses → adds to cart → pays → coins earned
- Full menu browsing
- Kitchen chat
- Table reservations
- Pre-order scheduling

### Mode B: Scan & Pay (Retail, Salon, Services, Small Shops)
Merchant has NO menu → customer scans → enters amount → pays → coins earned *(REZ merchants only)*
- Single or multi-item amount entry
- Bill builder (merchant rings up items)
- Static QR on counter (zero staff involvement)
- Payment Kiosk Mode (merchant display screen)

---

## 4. Payment Kiosk Mode — The Killer Feature

### What It Is
A dedicated screen (tablet/desktop) at the merchant counter showing:
- Static QR code → customers scan and pay
- Live transaction feed (Socket.IO) → merchant sees every payment
- Today's total sales
- Sound alert on each payment

### Why It Replaces the Swipe Machine
- Merchant sees ₹500 received instantly (like "approved" on swipe machine)
- Zero customer self-service — customer scans, pays, leaves
- No staff needed for payments
- Works for ANY business — salon, kirana, restaurant, taxi stand

### User Flows

#### Customer Flow
1. Sees QR code at counter
2. Scans → opens `now.rez.money/<storeSlug>/pay`
3. Amount pre-filled or enters manually
4. Pays via UPI (PhonePe/GPay/Paytm) or saved card
5. Gets WhatsApp receipt instantly
6. Earns coins automatically

#### Merchant Flow
1. Opens `now.rez.money/<storeSlug>/merchant/pay-display` on tablet
2. QR code displayed full-screen, always on
3. Optionally enters amount per transaction
4. Payment arrives → screen flashes green + "ding" sound
5. Transaction appears in feed with amount + time
6. End of day: export daily sales

### Files to Build

```
rez-now/
├── app/[storeSlug]/
│   └── merchant/
│       ├── pay-display/
│       │   ├── page.tsx              ← Server component (SSR store data)
│       │   └── PayDisplayClient.tsx ← Client component
│       ├── bill-builder/
│       │   ├── page.tsx
│       │   └── BillBuilderClient.tsx ← Multi-item bill entry
│       └── dashboard/               ← Already built (staff)
│
rezbackend/
├── src/routes/
│   └── paymentRoutes.ts             ← New: payment status SSE / Socket.IO
└── src/services/
    └── paymentNotifier.ts           ← Socket.IO emit on successful payment
```

---

## 5. Feature Roadmap

### Tier 1 — Core Payment (Replaces Swipe Machine)

| Feature | Description | Status | Files |
|---------|-------------|--------|-------|
| Payment Kiosk Mode | Merchant display with live QR + transaction feed | **TODO** | `merchant/pay-display/*` |
| Payment sound alert | "Ding" on successful payment (Web Audio API) | **TODO** | `PayDisplayClient.tsx` |
| Static counter QR | Always-on QR page — no merchant action needed | **TODO** | `merchant/static-qr/*` |
| Bill builder | Merchant rings up multiple items before QR | **TODO** | `merchant/bill-builder/*` |
| Instant settlement | Payment confirmed → merchant notified in <2s | **TODO** | Socket.IO + SSE |
| Payment feed | Live list of today's transactions | **TODO** | `PayDisplayClient.tsx` |

### Tier 2 — Merchant Operations

| Feature | Description | Status |
|---------|-------------|--------|
| Staff shift management | Track sales per staff member | TODO |
| Cash float management | Cash + digital split | TODO |
| Daily sales export | CSV/PDF end-of-day report | Partially built |
| Thermal printer API | Send receipt to Bluetooth/USB printer | TODO |
| Multi-store support | One merchant, many outlets | Backend: model exists |

### Tier 3 — AI Commerce

| Feature | Description | Status |
|---------|-------------|--------|
| AI Chatbot | Conversational product Q&A + order taking | **TODO** |
| RAG on menu | Claude + merchant's menu as knowledge base | **TODO** |
| AI upsell engine | "People who ordered X also ordered Y" | TODO |
| AI reorder assistant | "Order your usual?" via WhatsApp bot | TODO |

### Tier 4 — Customer Experience

| Feature | Description | Status |
|---------|-------------|--------|
| 1-tap payment | Save UPI/card, pay in one tap | TODO |
| Payment link sharing | Merchant sends payment link via WhatsApp/SMS | TODO |
| NFC tap-to-merchant | Tap phone on NFC tag → open payment | Partially built (Phase 13) |
| Multi-language AI | Chatbot in Hindi + English | TODO |

---

## 6. AI Chatbot — Full Technical Spec

### Product Vision
Every store on REZ Now has an AI chatbot that:
- Answers questions about products ("Do you have any vegan options?", "What pasta is gluten-free?")
- Takes orders via chat ("Order 2 butter chicken, 1 garlic naan")
- Recommends based on preferences ("You usually order mild spice, here's the mild menu")
- Handles reservations and inquiries
- Works 24/7 in Hindi and English

### Architecture

```
Customer message
      ↓
REZ Now Chat Widget (component/chat/ChatWidget.tsx)
      ↓
POST /api/ai/chat { storeSlug, message, conversationId, customerId }
      ↓
REZbackend AI route (routes/aiRoutes.ts)
      ↓
1. Fetch store menu from MongoDB (cached in Redis, TTL 1h)
2. Build RAG context: relevant menu items, descriptions, prices
3. Format prompt: system prompt + menu context + conversation history
      ↓
Claude API (claude-3-5-sonnet)
      ↓
Structured JSON response:
{
  "type": "text" | "order" | "recommendation" | "reservation" | "handoff"
  "content": "...",
  "orderItems": [...],        ← if type === "order"
  "cart": { items, total },    ← if type === "order"
  "handoffReason": "..."       ← if type === "handoff"
}
      ↓
4a. If order → pre-populate cart via cartStore
4b. If reservation → call existing reservation API
4c. If handoff → open human chat (staff dashboard)
4d. If text/recommendation → display in chat widget
      ↓
Chat Widget displays response
```

### Conversation Flow Example

```
Customer: "what's spicy?"
AI: "🌶️ Our spiciest dish is Butter Chicken (mild). Wait — actually 
     Bhuna Ghosht is much hotter! It's made with 8 dried red chilies 
     and rated 'Very Spicy'. Want me to add it to your order?"

Customer: "yes add 1 bhuna ghosht and 1 garlic naan"
AI: type: "order", items: [{name: "Bhuna Ghosht", qty: 1}, {name: "Garlic Naan", qty: 1}], total: 420

→ REZ Now shows: "Your order is ready! Review cart to checkout"

Customer: "book a table for 4 at 8pm tomorrow"
AI: type: "reservation", ...
→ REZ Now pre-fills reservation form
```

### Files to Build

```
rez-now/
├── components/
│   └── chat/
│       ├── ChatWidget.tsx      ← Floating chat button + drawer
│       ├── ChatMessage.tsx     ← Single message bubble
│       ├── ChatInput.tsx       ← Text input + send
│       └── OrderSuggestion.tsx ← Cart preview in chat
├── lib/api/
│   └── chat.ts                 ← POST /api/ai/chat client
└── app/api/ai/
    └── chat/route.ts           ← AI chat endpoint

rezbackend/
├── src/routes/
│   └── aiRoutes.ts             ← AI chat endpoint
├── src/services/
│   ├── menuRagService.ts       ← Build RAG context from menu
│   └── claudeService.ts         ← Claude API wrapper
└── src/prompts/
    └── menuAssistantPrompt.ts   ← System prompt for menu assistant
```

### API Contract

```typescript
// POST /api/ai/chat
Request: {
  storeSlug: string;
  message: string;           // customer's message
  conversationId?: string;     // from localStorage, for context
  customerId?: string;         // if logged in
  history?: Array<{role: 'user' | 'assistant'; content: string}>;
}

Response: {
  success: true;
  data: {
    type: 'text' | 'order' | 'recommendation' | 'reservation' | 'handoff';
    content: string;           // AI's response
    items?: CartItem[];         // if order
    reservation?: {...};        // if reservation
    cart?: { items: CartItem[]; total: number; };
    conversationId: string;      // for next turn
    suggestedActions?: string[]; // ["Order now", "See menu", "Call staff"]
  };
}

// GET /api/ai/chat/history/:storeSlug/:customerId  (if logged in)
// Returns: Array<{conversationId, messages, lastMessage, updatedAt}>

// DELETE /api/ai/chat/history/:conversationId
// Clears conversation history
```

### RAG Menu Context Format

```typescript
interface MenuContext {
  storeName: string;
  storeType: string;
  currency: string;
  categories: Array<{
    name: string;
    items: Array<{
      name: string;
      description: string;
      price: number;
      isVeg: boolean;
      tags: string[];           // ["spicy", "gluten-free", "vegan", "popular"]
      isAvailable: boolean;
      customization?: string[];
    }>;
  }>;
  loyaltyInfo?: {
    earnRate: string;          // "5 coins per ₹10 spent"
    redemption: string;          // "100 coins = ₹1"
  };
}
```

### System Prompt Template

```typescript
const MENU_ASSISTANT_PROMPT = `
You are a friendly, knowledgeable assistant for {storeName}, a {storeType} in India.
You speak in the customer's language (English or Hindi based on their message).
You ONLY answer questions about the menu, prices, availability, and recommendations.
You can take orders by collecting items and confirming quantities.

IMPORTANT RULES:
- Never make up items not in the menu
- If something is not available, say so and suggest alternatives
- Keep responses short and conversational — max 3 sentences for simple questions
- When taking an order, confirm each item before finalizing
- If a customer wants to speak to staff, respond with type "handoff"
- Always mention prices when recommending
- Use Hindi if the customer writes in Hindi
- Format orders as a clear list with prices

MENU CONTEXT:
{menuContext}

CUSTOMER: {customerMessage}
`;
```

---

## 7. Implementation Phases

### Phase R1 — Payment Kiosk (Replace Swipe Machine)

**Goal**: Merchant opens 1 URL on a tablet → sees live payments → never needs swipe machine.

| Task | Repo | Files | Status |
|------|------|-------|--------|
| PayDisplay page (merchant side) | rez-now | `app/[storeSlug]/merchant/pay-display/page.tsx` + `PayDisplayClient.tsx` | **BUILT** |
| Static QR page (customer side) | rez-now | `app/[storeSlug]/pay/static/page.tsx` | TODO |
| `payment:received` Socket.IO event | rezbackend | `src/routes/webOrderingRoutes.ts` (emit-payment + today-payments) | **BUILT** |
| `POST /api/web-ordering/store/:slug/emit-payment` | rezbackend | `src/routes/webOrderingRoutes.ts` | **BUILT** |
| `GET /api/web-ordering/store/:slug/today-payments` | rezbackend | `src/routes/webOrderingRoutes.ts` | **BUILT** |
| Payment sound (Web Audio API) | rez-now | in `PayDisplayClient.tsx` | **BUILT** |
| Wire `emit-payment` into Razorpay webhook | rezbackend | `src/routes/paymentRoutes.ts` | TODO |

### Phase R2 — Bill Builder

**Goal**: Merchant rings up items on tablet → QR shows total → customer pays.

| Task | Repo | Files |
|------|------|-------|
| BillBuilder page | rez-now | `app/[storeSlug]/merchant/bill-builder/page.tsx` + `BillBuilderClient.tsx` |
| Bill state management (Zustand) | rez-now | `lib/store/billStore.ts` |
| Bill-to-cart transfer | rez-now | On payment success, copy bill items to cartStore |
| `POST /api/web-ordering/bill` (create bill) | rezbackend | `src/routes/webOrderingRoutes.ts` |
| `GET /api/web-ordering/bill/:billId` (get bill by id) | rezbackend | `src/routes/webOrderingRoutes.ts` |

### Phase R3 — AI Chatbot

**Goal**: Every store has an AI assistant. Customers ask, order, get recommendations.

| Task | Repo | Files |
|------|------|-------|
| `lib/api/chat.ts` client | rez-now | `lib/api/chat.ts` |
| ChatWidget + ChatDrawer component | rez-now | `components/chat/ChatWidget.tsx` |
| Wire ChatWidget into StorePageClient | rez-now | `StorePageClient.tsx` |
| `POST /api/ai/chat` route | rez-now | `app/api/ai/chat/route.ts` (edge) |
| MenuRagService | rezbackend | `src/services/menuRagService.ts` |
| ClaudeService | rezbackend | `src/services/claudeService.ts` |
| menuAssistantPrompt | rezbackend | `src/prompts/menuAssistantPrompt.ts` |
| `routes/aiRoutes.ts` | rezbackend | full AI route |
| Redis cache for menu context | rezbackend | In `menuRagService.ts` |
| Conversation history | rezbackend | New model `AIMessage` + GET/DELETE routes |
| Order from chat → pre-populate cart | rez-now | In ChatWidget.tsx |
| Handoff to staff | rez-now | `KitchenChatDrawer` already handles |

### Phase R4 — Fast Payment (Sub-2s Settlement)

**Goal**: Customer taps pay → sees confirmation in <2 seconds.

| Task | Description |
|------|-------------|
| Optimistic UI | Show "Payment received" immediately on razorpay success callback, before server verify |
| Background verify | Move signature verification to a non-blocking background job |
| WebSocket push | `payment:confirmed` event replaces polling |
| Settlement SLA | Target: P99 < 2s from razorpay webhook to Socket.IO emit |

---

## 8. Backend Models (New)

```typescript
// Bill — merchant rings up items, generates QR for total
// src/models/Bill.ts
{
  _id: ObjectId;
  storeSlug: string;
  storeId: ObjectId;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;    // in paise
    total: number;        // in paise
  }>;
  subtotal: number;       // in paise
  total: number;         // in paise (subtotal + any additions)
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  expiresAt: Date;        // bills expire after 15 minutes
  paidAt?: Date;
  paymentId?: string;
  createdBy: string;     // staffId if multi-staff
  createdAt: Date;
}

// AIMessage — stores chat history for RAG context
// src/models/AIMessage.ts
{
  _id: ObjectId;
  conversationId: string;   // UUID, stored in customer localStorage
  customerId?: string;        // set if logged in
  storeSlug: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    type?: 'text' | 'order' | 'recommendation' | 'reservation' | 'handoff';
    metadata?: Record<string, unknown>;  // cart items, etc.
    createdAt: Date;
  }>;
  lastMessage: string;
  updatedAt: Date;
}
{
  indexes: [
    { conversationId: 1 },
    { storeSlug: 1, customerId: 1 },
    { updatedAt: 1 },  // TTL: 30 days
  ]
}
```

---

## 9. Environment Variables (New)

```env
# REZ Now (rez-now)
NEXT_PUBLIC_RAZORPAY_KEY_ID=               # Razorpay key (already exists)
CLAUDE_API_KEY=                            # Anthropic API key for AI chatbot
NEXT_PUBLIC_AI_ENABLED=true                # Toggle AI chatbot on/off

# REZ Backend (rezbackend)
CLAUDE_API_KEY=                            # Anthropic API key
AI_MODEL=claude-3-5-sonnet-20241022       # Model to use
AI_MAX_TOKENS=1024                         # Max response tokens
AI_TEMPERATURE=0.7                        # Creativity vs accuracy
MENU_CONTEXT_CACHE_TTL=3600               # Redis TTL for menu RAG context (1h)
AI_CONVERSATION_TTL_DAYS=30               # Auto-delete conversations after 30 days
```

---

## 10. Error Handling

| Error | User-Facing Message | Action |
|-------|---------------------|--------|
| AI service down | "Our assistant is taking a break. Browse the menu directly." | Fall back to no chatbot |
| Menu fetch fails | "Can't load menu right now." | Retry with exponential backoff |
| Conversation too long | (auto-truncate oldest messages) | Keep last 20 turns |
| Customer says "speak to human" | "Connecting you to our staff..." | Handoff via KitchenChatDrawer |
| Payment timeout | "Payment timed out. Try again." | Clear pending bill state |
| Bill expired (15min) | "This bill has expired. Please ask the merchant to create a new one." | Delete expired bills |

---

## 11. Security

- AI chat is **not** trained on customer data — each store's context is isolated
- Conversation history is scoped per `storeSlug + customerId` — no cross-store data leakage
- AI responses are **validated** before any action (order/reservation) — cart items verified against live menu
- Rate limit: 30 AI chat messages per customer per hour
- Banned topics: the AI is instructed to say "I can only help with menu questions" for off-topic queries
- No PII stored in AI conversation logs — only `conversationId + storeSlug`
