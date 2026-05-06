# REZ Now — Product Truth

> **Status: FOUNDATIONAL** | Version: 1.0 | Date: 2026-04-14
> This is the canonical product definition. Every feature, decision, and roadmap traces back to this document.

---

## What REZ Now IS

**REZ Now = Universal QR-based Transaction Layer for Offline Businesses**

A **no-install, web-based checkout + ordering + interaction system** that sits between **customer ↔ merchant ↔ REZ ecosystem**.

> In simple terms: **REZ Now = "What happens when a customer scans a QR"**

---

## The Core Loop (The Business)

```
Scan → Pay → Earn → Open App → Discover → Return → Repeat
```

Everything traces back to this loop. If any step breaks, the loop breaks.

---

## REZ Now = 5 Core Systems

### 1. Transaction System (Core Engine)
- Scan QR → Pay (UPI, card) → Order (food/services) → Book (slots/reservations)
- **Entry point** — everything starts here

### 2. Commerce Interface (Store Layer)
- Menu / services / customization / add-ons
- AI chat (sales + info)
- WhatsApp ordering
- **Replaces**: menu QR, website, link-in-bio

### 3. Real-Time Interaction System
- Order tracking
- Kitchen chat
- Waiter call
- Payment Kiosk (merchant display)
- **Replaces**: manual coordination, staff dependency

### 4. Offline + Sync Engine
- Works without internet
- IndexedDB queue + background sync
- **Very advanced edge** — stability is critical

### 5. Rewards Entry Layer
- Earn coins on every transaction
- Show cashback instantly
- Connects to REZ App for full wallet + history

---

## The REZ Ecosystem Map

```
Customer
   ↓ (scan QR)
ReZ Now (Web Layer — Transaction + Interaction)
   ↓
Backend (Core System — records everything)
   ↓
┌─────────────┬──────────────┬────────┐
↓             ↓              ↓        ↓
ReZ App    Merchant Panel  Admin   Analytics
(Retention)  (Growth)      (Control) (Insight)
```

### REZ Now (Web) = Transaction + Interaction Layer
- Entry point, zero friction, executes action
- No app required for customer

### REZ App = Retention + Discovery Layer
- Wallet, coins, history
- Nearby deals, repeat usage

### REZ Merchant = Growth + Control Layer
- Manage offers, view customers
- Track revenue, run campaigns

---

## The 3 Binding Threads

Every product in the ecosystem connects through:

| Thread | Why It Matters |
|--------|---------------|
| **Transaction** | The unit of value |
| **User ID** | Unifies across products |
| **Wallet / Coins** | The retention mechanism |

> If these three are inconsistent between web, app, and merchant → **trust breaks → product dies**

---

## What REZ Now is NOT

| NOT | WHY |
|-----|-----|
| A QR menu | Only ordering is table stakes |
| A payment app | Just accepting payment is commodity |
| A standalone product | Only valuable as the entry layer to the ecosystem |

---

## What Makes REZ Now Special

| Feature | PhonePe/Paytm QR | Swipe Machine | REZ Now |
|---------|-----------------|--------------|---------|
| QR Payment | | | |
| Ordering / Menu | | | |
| Wallet / Coins | | | |
| Cashback | | | |
| Discovery loop | | | |
| Real-time ops | Limited | None | Full |
| Works offline | | | |
| Staff dashboard | | | |
| AI chatbot | | | |

---

## Design Principle

Users should feel: **"REZ is one system, not 3 products"**

Not:
- ❌ ReZ Now / ❌ ReZ App / ❌ Merchant

But:
- ✅ REZ — everywhere, everything connected

---

## The 4 Critical Focus Areas

### 1. Perfect the Core Flow
scan → pay → reward

### 2. Ensure Perfect Sync
web ↔ app ↔ merchant (coins, user ID, transaction state)

### 3. Push App Adoption
after every transaction: "track in REZ app"

### 4. Show Merchant Value
repeat customers, not just one-time payers

---

## Feature Priority for Ecosystem Health

| Priority | Feature | Why |
|----------|---------|-----|
| P0 | Payment Kiosk (live feed) | Merchant's daily tool |
| P0 | Coin sync (web → app) | Retention loop |
| P0 | Perfect payment flow | Foundation of trust |
| P1 | AI Chatbot | Commerce layer differentiation |
| P1 | Bill Builder | Universal for all merchant types |
| P2 | Sub-2s settlement | Speed = habit |
| P2 | WhatsApp receipts | Reduces app dependency for notifications |
| P3 | Discovery feed | Long-term retention |
