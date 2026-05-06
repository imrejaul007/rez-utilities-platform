# REZ — API CONTRACT SPEC (Doc 4)
## All New + Modified Endpoints for Phases 1–4
## Exact Request/Response JSON · Auth Requirements · Error Codes
### March 2026 | For parallel frontend/backend development

---

## HOW TO USE THIS DOCUMENT

- Every route has: HTTP method, full URL, auth header, request body, success response, error responses
- Frontend devs: mock these responses while backend builds
- Backend devs: match these schemas exactly — frontend depends on these field names
- All dates: ISO 8601 string `"2026-03-20T10:30:00.000Z"`
- All amounts: numbers in ₹ (not paise)
- All coin amounts: integers
- `success: true/false` is on every response

---

## AUTHENTICATION

All authenticated routes require:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

Merchant routes use separate JWT with `role: 'merchant'` claim.
Admin routes use separate JWT with `role: 'admin'` or `role: 'senior_admin'` claim.

---
---

# PHASE 1 — BUG FIX APIs

These are EXISTING routes that need to be verified working correctly after bug fixes.

---

## P1-01 · GET /api/wallet/balance
**Used by:** `wallet-screen.tsx` after coin button fix (U-03)

**Auth:** User JWT required

**Response 200:**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "balance": {
        "total": 1250,
        "available": 1100,
        "pending": 150,
        "cashback": 800,
        "earned": 2400,
        "spent": 1150
      },
      "brandedCoins": [
        {
          "merchantId": "64f3a1b2c3d4e5f6a7b8c9d0",
          "merchantName": "Blue Tokai Coffee",
          "brandName": "Chai Points",
          "balance": 350,
          "logoUrl": "https://cdn.rez.app/merchants/bluetokai.png",
          "expiresAt": "2026-09-20T00:00:00.000Z"
        }
      ],
      "stats": {
        "totalSavedThisMonth": 450,
        "totalSavedAllTime": 3200,
        "streakDays": 7,
        "rank": 142
      }
    }
  }
}
```

**Error 401:** `{ "success": false, "error": "UNAUTHORIZED", "message": "Token expired" }`

---

## P1-02 · GET /api/offers/bonus-zone
**Used by:** `app/deals/index.tsx` (new screen — fix U-04)

**Auth:** User JWT required

**Query params:** `?page=1&limit=20&type=all|cashback|bank|2x_coins|festival`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "_id": "64f3a1b2c3d4e5f6a7b8c9d0",
        "title": "Double Coins Weekend",
        "description": "Earn 2× coins at all restaurants this weekend",
        "type": "2x_coins",
        "badgeText": "2× Coins",
        "imageUrl": "https://cdn.rez.app/campaigns/double-coins.jpg",
        "validFrom": "2026-03-22T00:00:00.000Z",
        "validTo":   "2026-03-23T23:59:59.000Z",
        "multiplier": 2.0,
        "applicableCategories": ["food-dining"],
        "isActive": true,
        "endsInHours": 36
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8,
      "hasMore": false
    }
  }
}
```

---

## P1-03 · POST /api/service-appointments
**Used by:** All 7 niche booking pages after fix U-06

**Auth:** User JWT required

**Request body:**
```json
{
  "storeId": "64f3a1b2c3d4e5f6a7b8c9d0",
  "serviceType": "haircut",
  "serviceId": "64f3a1b2c3d4e5f6a7b8c9d1",
  "date": "2026-03-25",
  "time": "14:30",
  "duration": 45,
  "staffId": "64f3a1b2c3d4e5f6a7b8c9d2",
  "notes": "Prefer female stylist"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "appointment": {
      "_id": "64f3a1b2c3d4e5f6a7b8c9e0",
      "bookingRef": "APT-2026-00142",
      "storeId": "64f3a1b2c3d4e5f6a7b8c9d0",
      "storeName": "Naturals Salon, Koramangala",
      "serviceType": "haircut",
      "serviceName": "Hair Cut + Wash",
      "date": "2026-03-25",
      "time": "14:30",
      "duration": 45,
      "status": "confirmed",
      "coinsEarned": 25,
      "totalAmount": 350,
      "createdAt": "2026-03-20T10:30:00.000Z"
    }
  },
  "message": "Appointment confirmed! You earned 25 REZ coins."
}
```

**Errors:**
- `400 SLOT_UNAVAILABLE` — slot already booked
- `400 STORE_CLOSED` — store not open on that date/time
- `404 STORE_NOT_FOUND`

---

## P1-04 · GET /api/notifications/history
**Used by:** `app/account/notification-history.tsx` (fix U-08)

**Auth:** User JWT required

**Query params:** `?page=1&limit=50`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "64f3a1b2c3d4e5f6a7b8c9e1",
        "type": "coins_earned",
        "title": "25 coins earned!",
        "body": "You earned 25 coins at Blue Tokai Coffee",
        "imageUrl": null,
        "deepLink": "rez://wallet",
        "isRead": false,
        "createdAt": "2026-03-19T14:30:00.000Z"
      }
    ],
    "unreadCount": 3,
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 23,
      "hasMore": false
    }
  }
}
```

---
---

# PHASE 2 — LOCATION SYSTEM APIs

---

## P2-01 · GET /api/stores/nearby
**Used by:** `utils/serviceabilityCheck.ts` (U-11 auto-switch)

**Auth:** User JWT required

**Query params:** `?lat=12.9716&lng=77.5946&radius=5000&limit=1`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "stores": [
      {
        "_id": "64f3a1b2c3d4e5f6a7b8c9f0",
        "name": "Chai Point",
        "category": "food-dining",
        "distance": 340,
        "cashbackPercent": 8,
        "coordinates": { "lat": 12.9698, "lng": 77.5978 }
      }
    ],
    "count": 1,
    "isServiceable": true
  }
}
```

**Response when no stores (area not serviceable):**
```json
{
  "success": true,
  "data": {
    "stores": [],
    "count": 0,
    "isServiceable": false,
    "suggestedMode": "mall"
  }
}
```

---

## P2-02 · GET /api/location/regions
**Used by:** `RegionSelector.tsx` after region cleanup (U-10)

**Auth:** None required (public)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "regions": [
      {
        "id": "bangalore",
        "name": "India",
        "flag": "IN",
        "currency": "INR",
        "currencySymbol": "₹",
        "isActive": true,
        "comingSoon": false
      },
      {
        "id": "dubai",
        "name": "Dubai",
        "flag": "AE",
        "currency": "AED",
        "currencySymbol": "د.إ",
        "isActive": false,
        "comingSoon": true,
        "comingSoonDate": "2027-Q1"
      }
    ]
  }
}
```

---
---

# PHASE 3 — PRIVÉ SOCIAL CASHBACK APIs

## NEW ROUTES — Must be created in `rez-backend-master/src/routes/priveCampaignRoutes.ts`
## Register in `config/routes.ts` as: `app.use('/api/prive/campaigns', priveCampaignRoutes)`

---

## P3-01 · GET /api/prive/campaigns
**Used by:** `app/prive/campaigns/index.tsx`

**Auth:** User JWT required (Prive access checked server-side)

**Query params:** `?status=active|pending|completed&page=1&limit=20&tier=entry|signature|elite`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "_id": "64f3a1b2c3d4e5f6a7b8ca00",
        "merchantId": "64f3a1b2c3d4e5f6a7b8ca01",
        "merchantName": "Smoke House Deli",
        "merchantLogo": "https://cdn.rez.app/merchants/shd.jpg",
        "title": "Valentine's Dining Experience",
        "description": "Dine and share your experience on Instagram for extra cashback",
        "taskType": "dine_post",
        "requirements": {
          "minPurchaseAmount": 1500,
          "postTypes": ["story", "reel"],
          "mustTagBrand": true,
          "minimumFollowers": 1000,
          "hashtagRequired": "#RezPriveDining"
        },
        "reward": {
          "coinAmount": 200,
          "cashbackPercent": 35,
          "cashbackCap": 2000
        },
        "slotsRemaining": 8,
        "totalSlots": 20,
        "validFrom": "2026-03-20T00:00:00.000Z",
        "validTo": "2026-04-20T23:59:59.000Z",
        "minPriveTier": "entry",
        "userStatus": "eligible",
        "userSubmissionStatus": null
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 12, "hasMore": false }
  }
}
```

**userStatus values:** `eligible | joined | submitted | approved | rejected | slots_full | expired`

---

## P3-02 · GET /api/prive/campaigns/:id
**Used by:** `app/prive/campaigns/[id].tsx`

**Auth:** User JWT required

**Response 200:**
```json
{
  "success": true,
  "data": {
    "campaign": {
      "_id": "64f3a1b2c3d4e5f6a7b8ca00",
      "merchantId": "64f3a1b2c3d4e5f6a7b8ca01",
      "merchantName": "Smoke House Deli",
      "merchantLogo": "https://cdn.rez.app/merchants/shd.jpg",
      "title": "Valentine's Dining Experience",
      "description": "Dine at Smoke House Deli, capture your experience and post on Instagram.",
      "taskType": "dine_post",
      "taskSteps": [
        "Visit Smoke House Deli and spend minimum ₹1,500",
        "Post an authentic reel or story on Instagram",
        "Tag @smokehousedeli and use #RezPriveDining",
        "Submit your post URL in the REZ app within 48 hours"
      ],
      "requirements": {
        "minPurchaseAmount": 1500,
        "postTypes": ["story", "reel"],
        "mustTagBrand": true,
        "minimumFollowers": 1000,
        "hashtagRequired": "#RezPriveDining"
      },
      "reward": {
        "coinAmount": 200,
        "cashbackPercent": 35,
        "cashbackCap": 2000,
        "estimatedEarning": "Up to ₹525 cashback on ₹1,500 bill"
      },
      "slotsRemaining": 8,
      "totalSlots": 20,
      "budgetRemaining": 48000,
      "validFrom": "2026-03-20T00:00:00.000Z",
      "validTo": "2026-04-20T23:59:59.000Z",
      "minPriveTier": "entry",
      "userStatus": "eligible",
      "userSubmissionStatus": null,
      "examplePosts": [
        "https://cdn.rez.app/campaigns/example1.jpg"
      ]
    }
  }
}
```

---

## P3-03 · POST /api/prive/campaigns/:id/join
**Used by:** `app/prive/campaigns/[id].tsx` (Join Campaign button)

**Auth:** User JWT required

**Request body:** _(empty)_

**Response 200:**
```json
{
  "success": true,
  "data": {
    "joined": true,
    "campaignId": "64f3a1b2c3d4e5f6a7b8ca00",
    "message": "You've joined! Visit Smoke House Deli and post within 30 days.",
    "submissionDeadline": "2026-04-20T23:59:59.000Z"
  }
}
```

**Errors:**
- `400 SLOTS_FULL` — no slots remaining
- `400 TIER_INSUFFICIENT` — user tier below minPriveTier
- `400 ALREADY_JOINED` — user already in this campaign
- `403 PRIVE_ACCESS_REQUIRED` — user not in Prive

---

## P3-04 · POST /api/prive/campaigns/:id/submit
**Used by:** `app/prive/campaigns/submit.tsx`

**Auth:** User JWT required

**Request body (multipart/form-data):**
```
postUrl: "https://www.instagram.com/reel/C4xyz123/"
postScreenshot: [file upload — JPG/PNG ≤5MB]
orderId: "64f3a1b2c3d4e5f6a7b8cb00"   (optional, if user has REZ order)
notes: "Had an amazing experience!"    (optional)
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "submission": {
      "_id": "64f3a1b2c3d4e5f6a7b8cc00",
      "campaignId": "64f3a1b2c3d4e5f6a7b8ca00",
      "status": "pending",
      "submittedAt": "2026-03-25T14:00:00.000Z",
      "estimatedReviewTime": "24-48 hours",
      "coinsAlreadyEarned": 200,
      "pendingCashback": 525
    }
  },
  "message": "Post submitted! We'll review within 24-48 hours and credit your cashback."
}
```

**Errors:**
- `400 POST_URL_INVALID` — URL not a valid Instagram URL
- `400 NOT_JOINED` — user hasn't joined this campaign
- `400 ALREADY_SUBMITTED` — duplicate submission
- `400 CAMPAIGN_EXPIRED`

---

## P3-05 · GET /api/prive/campaigns/:id/status
**Used by:** `app/prive/campaigns/status.tsx`

**Auth:** User JWT required

**Response 200:**
```json
{
  "success": true,
  "data": {
    "submission": {
      "_id": "64f3a1b2c3d4e5f6a7b8cc00",
      "campaignId": "64f3a1b2c3d4e5f6a7b8ca00",
      "campaignTitle": "Valentine's Dining Experience",
      "status": "approved",
      "submittedAt": "2026-03-25T14:00:00.000Z",
      "reviewedAt": "2026-03-26T09:00:00.000Z",
      "cashbackIssued": true,
      "cashbackAmount": 525,
      "coinsEarned": 200,
      "postUrl": "https://www.instagram.com/reel/C4xyz123/",
      "reviewerNote": "Great content! Cashback credited."
    }
  }
}
```

**status values:** `pending | approved | rejected | expired`

---

## P3-06 · GET /api/prive/earnings
**Used by:** `app/prive/earnings.tsx`

**Auth:** User JWT required

**Query params:** `?page=1&limit=20&month=2026-03`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalCashbackEarned": 3450,
      "totalCoinsEarned": 1800,
      "campaignsCompleted": 7,
      "pendingCashback": 525,
      "thisMonth": 975
    },
    "earnings": [
      {
        "_id": "64f3a1b2c3d4e5f6a7b8cc01",
        "type": "campaign_cashback",
        "campaignTitle": "Valentine's Dining Experience",
        "merchantName": "Smoke House Deli",
        "cashbackAmount": 525,
        "coinsAmount": 200,
        "status": "credited",
        "creditedAt": "2026-03-26T09:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 7, "hasMore": false }
  }
}
```

---

## P3-07 · GET /api/prive/access (EXISTING — verify response shape)
**Used by:** `hooks/usePriveEligibility.ts`

**Auth:** User JWT required

**Response 200 — must return these exact fields:**
```json
{
  "success": true,
  "data": {
    "isEligible": true,
    "accessSource": "auto_qualify",
    "tier": "signature",
    "score": 847,
    "scoreBreakdown": {
      "transactions": 280,
      "reviews": 150,
      "referrals": 120,
      "socialScore": 180,
      "engagement": 117
    },
    "nextTier": "elite",
    "pointsToNext": 1153,
    "totalPointsForNextTier": 2000
  }
}
```

---

## P3-08 · NEW MERCHANT ROUTES for Privé Campaigns
## Must be created in `rez-backend-master/src/merchantroutes/priveModule.ts`
## Register as: `app.use('/api/merchant/prive', merchantPriveRoutes)`

### GET /api/merchant/prive/campaigns

**Auth:** Merchant JWT required

**Response 200:**
```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "_id": "64f3a1b2c3d4e5f6a7b8ca00",
        "title": "Valentine's Dining Experience",
        "status": "active",
        "slotsUsed": 12,
        "totalSlots": 20,
        "budgetUsed": 6300,
        "totalBudget": 40000,
        "submissionsPending": 3,
        "submissionsApproved": 9,
        "submissionsRejected": 0,
        "totalReach": 450000,
        "avgEngagement": 7.2,
        "validTo": "2026-04-20T23:59:59.000Z"
      }
    ]
  }
}
```

### POST /api/merchant/prive/campaigns

**Auth:** Merchant JWT required

**Request body:**
```json
{
  "title": "Summer Collection Launch",
  "description": "Post about our new summer collection",
  "taskType": "buy_post",
  "requirements": {
    "minPurchaseAmount": 2000,
    "postTypes": ["reel", "post"],
    "mustTagBrand": true,
    "minimumFollowers": 1000,
    "hashtagRequired": "#RezSummer2026"
  },
  "reward": {
    "coinAmount": 300,
    "cashbackPercent": 40,
    "cashbackCap": 3000
  },
  "totalSlots": 30,
  "budget": 90000,
  "validFrom": "2026-04-01T00:00:00.000Z",
  "validTo": "2026-04-30T23:59:59.000Z",
  "minPriveTier": "entry"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "campaign": {
      "_id": "64f3a1b2c3d4e5f6a7b8ca10",
      "status": "pending_approval",
      "message": "Campaign submitted for admin approval. Usually takes 24 hours."
    }
  }
}
```

### GET /api/merchant/prive/submissions

**Auth:** Merchant JWT required

**Query params:** `?status=pending|approved|rejected&campaignId=<id>&page=1`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "_id": "64f3a1b2c3d4e5f6a7b8cc02",
        "userId": "64f3a1b2c3d4e5f6a7b8cd00",
        "userName": "Priya Sharma",
        "userAvatar": "https://cdn.rez.app/users/priya.jpg",
        "userFollowers": 12500,
        "campaignId": "64f3a1b2c3d4e5f6a7b8ca00",
        "campaignTitle": "Valentine's Dining Experience",
        "postUrl": "https://www.instagram.com/reel/C4xyz123/",
        "postScreenshotUrl": "https://cdn.rez.app/submissions/screenshot123.jpg",
        "submittedAt": "2026-03-25T14:00:00.000Z",
        "status": "pending",
        "estimatedCashback": 525
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 3, "hasMore": false }
  }
}
```

### PUT /api/merchant/prive/submissions/:id/approve

**Auth:** Merchant JWT required

**Request body:**
```json
{
  "note": "Great content, authentic post!"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "submissionId": "64f3a1b2c3d4e5f6a7b8cc02",
    "status": "approved",
    "cashbackIssued": 525,
    "coinsIssued": 200,
    "budgetDeducted": 525
  }
}
```

### PUT /api/merchant/prive/submissions/:id/reject

**Request body:**
```json
{
  "reason": "post_removed",
  "note": "The post was removed from Instagram"
}
```

**reason values:** `post_removed | wrong_hashtag | no_brand_tag | minimum_followers_not_met | fraudulent | other`

---
---

# PHASE 4 — BIZONE MERCHANT APIs

## Existing routes — verify they return these exact shapes

---

## P4-01 · POST /api/merchant/auth/register
**Used by:** `BiZoneUI/auth/MerchantSignup.jsx`

**Auth:** None (public)

**Request body:**
```json
{
  "businessName": "The Coffee House",
  "ownerName": "Rahul Sharma",
  "email": "rahul@thecoffeehouse.in",
  "phone": "+919876543210",
  "password": "SecurePass123!",
  "businessType": "restaurant",
  "gstNumber": "29ABCDE1234F1Z5",
  "panNumber": "ABCDE1234F",
  "address": {
    "street": "42, 5th Cross, Koramangala",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560034",
    "coordinates": { "lat": 12.9352, "lng": 77.6245 }
  }
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "merchant": {
      "_id": "64f3a1b2c3d4e5f6a7b8ce00",
      "businessName": "The Coffee House",
      "status": "pending_approval",
      "onboardingStep": "business_details"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  },
  "message": "Account created! Complete your business profile to go live."
}
```

---

## P4-02 · GET /api/merchant/dashboard
**Used by:** `BiZoneUI/dashboard/MerchantDashboard.jsx`

**Auth:** Merchant JWT required

**Query params:** `?period=today|7d|30d|custom&from=2026-03-01&to=2026-03-20`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "period": "today",
    "stats": {
      "revenue": {
        "amount": 24500,
        "growth": 12.5,
        "vsYesterday": 2300
      },
      "orders": {
        "total": 47,
        "pending": 3,
        "completed": 42,
        "cancelled": 2
      },
      "coinsIssued": {
        "amount": 1850,
        "users": 32
      },
      "customers": {
        "total": 42,
        "new": 8,
        "returning": 34
      },
      "avgOrderValue": 521,
      "walletBalance": {
        "available": 87500,
        "pending": 23400
      },
      "activeOffers": 3,
      "lowStockCount": 2
    },
    "recentTransactions": [
      {
        "_id": "64f3a1b2c3d4e5f6a7b8cf00",
        "type": "payment",
        "amount": 850,
        "customerPhone": "+91XXXXXX3210",
        "coinsIssued": 85,
        "timestamp": "2026-03-20T14:25:00.000Z",
        "paymentMethod": "upi"
      }
    ]
  }
}
```

---

## P4-03 · POST /api/store-payment/create-bill
**Used by:** `BiZoneUI/pos/MerchantPOS.jsx` (checkout)

**Auth:** Merchant JWT required

**Request body:**
```json
{
  "items": [
    {
      "productId": "64f3a1b2c3d4e5f6a7b8d000",
      "name": "Flat White",
      "quantity": 2,
      "unitPrice": 180,
      "totalPrice": 360
    },
    {
      "productId": "64f3a1b2c3d4e5f6a7b8d001",
      "name": "Croissant",
      "quantity": 1,
      "unitPrice": 120,
      "totalPrice": 120
    }
  ],
  "subtotal": 480,
  "taxAmount": 28.8,
  "totalAmount": 508.8,
  "customerPhone": "+919876543210",
  "coinsToRedeem": {
    "rez": 50,
    "branded": 0,
    "promo": 0
  },
  "paymentMethod": "qr_pending",
  "orderType": "dine_in",
  "tableNumber": "T5",
  "notes": ""
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "bill": {
      "_id": "64f3a1b2c3d4e5f6a7b8d100",
      "billRef": "BILL-20260320-0047",
      "status": "awaiting_payment",
      "subtotal": 480,
      "taxAmount": 28.8,
      "coinDiscount": 50,
      "finalAmount": 458.8,
      "qrCode": "data:image/png;base64,iVBORw0KGgo...",
      "qrPayload": "upi://pay?pa=rez@ybl&pn=REZ&am=458.80&tr=BILL-20260320-0047",
      "expiresAt": "2026-03-20T15:00:00.000Z"
    }
  }
}
```

---

## P4-04 · GET /api/merchant/orders
**Used by:** `BiZoneUI/orders/MerchantOrders.jsx`

**Auth:** Merchant JWT required

**Query params:** `?status=pending|accepted|preparing|ready|completed|cancelled&page=1&limit=20&date=2026-03-20`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "64f3a1b2c3d4e5f6a7b8d200",
        "orderRef": "ORD-20260320-0047",
        "status": "pending",
        "orderType": "dine_in",
        "tableNumber": "T5",
        "items": [
          { "name": "Flat White", "quantity": 2, "price": 360 },
          { "name": "Croissant",  "quantity": 1, "price": 120 }
        ],
        "subtotal": 480,
        "finalAmount": 458.8,
        "customer": {
          "phone": "+91XXXXXX3210",
          "isRezUser": true,
          "coinsAvailable": 350
        },
        "source": "rez",
        "placedAt": "2026-03-20T14:30:00.000Z",
        "estimatedReadyAt": null
      }
    ],
    "stats": {
      "pending": 3,
      "preparing": 5,
      "ready": 1,
      "completedToday": 38
    },
    "pagination": { "page": 1, "limit": 20, "total": 3, "hasMore": false }
  }
}
```

---

## P4-05 · PUT /api/merchant/orders/:id/status
**Used by:** `BiZoneUI/orders/MerchantOrders.jsx` (status update buttons)

**Auth:** Merchant JWT required

**Request body:**
```json
{
  "status": "preparing",
  "estimatedReadyMinutes": 15,
  "note": ""
}
```

**status transitions allowed:** `pending→accepted`, `accepted→preparing`, `preparing→ready`, `ready→completed`, `any→cancelled`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "orderId": "64f3a1b2c3d4e5f6a7b8d200",
    "status": "preparing",
    "notificationSent": true,
    "estimatedReadyAt": "2026-03-20T14:45:00.000Z"
  }
}
```

---

## P4-06 · POST /api/merchant/offers
**Used by:** `BiZoneUI/offers/CreateOffer.jsx`

**Auth:** Merchant JWT required

**Request body:**
```json
{
  "title": "50% OFF on All Pizzas",
  "description": "Get 50% off on all pizza orders above ₹400",
  "type": "percentage",
  "discountValue": 50,
  "minOrderValue": 400,
  "maxDiscountAmount": 300,
  "applicableTo": "all",
  "productIds": [],
  "validFrom": "2026-03-21T00:00:00.000Z",
  "validTo":   "2026-03-21T23:59:59.000Z",
  "maxRedemptions": 100,
  "isRezUsersOnly": true,
  "coinMultiplier": null
}
```

**type values:** `flat_discount | percentage | bogo | coin_multiplier | locked_deal`

**Response 201:**
```json
{
  "success": true,
  "data": {
    "offer": {
      "_id": "64f3a1b2c3d4e5f6a7b8d300",
      "title": "50% OFF on All Pizzas",
      "status": "pending_approval",
      "message": "Offer submitted for admin review. Usually approved within 4 hours."
    }
  }
}
```

---

## P4-07 · GET /api/merchant/wallet
**Used by:** `BiZoneUI/advanced/MerchantWallet.jsx`

**Auth:** Merchant JWT required

**Response 200:**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "availableBalance": 87500,
      "pendingClearance": 23400,
      "totalEarnedThisMonth": 124500,
      "lastSettlementDate": "2026-03-18T00:00:00.000Z",
      "nextSettlementDate": "2026-03-25T00:00:00.000Z",
      "bankAccount": {
        "bankName": "HDFC Bank",
        "accountLast4": "4521",
        "ifsc": "HDFC0001234",
        "isVerified": true
      },
      "commissionRate": 15.0
    }
  }
}
```

---

## P4-08 · POST /api/merchant/wallet/withdraw
**Used by:** `BiZoneUI/advanced/MerchantWallet.jsx` (withdrawal)

**Auth:** Merchant JWT required

**Request body:**
```json
{
  "amount": 50000,
  "bankAccountId": "64f3a1b2c3d4e5f6a7b8d400"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "withdrawalId": "WD-2026-00089",
    "amount": 50000,
    "status": "processing",
    "estimatedCreditTime": "2-3 business days",
    "requestedAt": "2026-03-20T15:00:00.000Z"
  }
}
```

**Errors:**
- `400 BELOW_MINIMUM` — amount below ₹500 minimum
- `400 INSUFFICIENT_BALANCE` — amount exceeds available balance
- `400 BANK_NOT_VERIFIED` — bank account not verified yet

---

## P4-09 · GET /api/merchant/customers/appointments
**Used by:** `BiZoneUI/customers/MerchantAppointments.jsx` (NEW ROUTE — create in merchantroutes)

**Auth:** Merchant JWT required

**Query params:** `?date=2026-03-20&status=confirmed|completed|cancelled&page=1`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "_id": "64f3a1b2c3d4e5f6a7b8e000",
        "bookingRef": "APT-2026-00142",
        "customer": {
          "name": "Priya Singh",
          "phone": "+91XXXXXX4321",
          "isRegular": true,
          "visitCount": 8
        },
        "serviceType": "haircut",
        "serviceName": "Hair Cut + Wash",
        "date": "2026-03-20",
        "time": "14:30",
        "duration": 45,
        "staffAssigned": "Meena",
        "status": "confirmed",
        "amount": 350,
        "coinsToEarn": 25
      }
    ],
    "todayCount": 12,
    "completedToday": 7,
    "pagination": { "page": 1, "limit": 20, "total": 5, "hasMore": false }
  }
}
```

---
---

# ADMIN NEW APIs

## These must be created in `rez-backend-master/src/routes/admin/`

---

## A-01 · GET /api/admin/prive/submissions (NEW)
**Used by:** `rez-admin-main/app/(dashboard)/prive-submissions.tsx` (new screen)

**Auth:** Admin JWT required

**Query params:** `?status=pending|approved|rejected&campaignId=<id>&page=1&limit=20`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "_id": "64f3a1b2c3d4e5f6a7b8cc02",
        "userId": "64f3a1b2c3d4e5f6a7b8cd00",
        "userName": "Priya Sharma",
        "userTier": "signature",
        "userFollowers": 12500,
        "merchantName": "Smoke House Deli",
        "campaignTitle": "Valentine's Dining Experience",
        "postUrl": "https://www.instagram.com/reel/C4xyz123/",
        "postScreenshotUrl": "https://cdn.rez.app/submissions/screenshot123.jpg",
        "submittedAt": "2026-03-25T14:00:00.000Z",
        "status": "pending",
        "estimatedCashback": 525,
        "fraudScore": 12,
        "autoFlags": []
      }
    ],
    "stats": {
      "pending": 47,
      "approvedToday": 23,
      "rejectedToday": 3,
      "totalPendingCashback": 24675
    },
    "pagination": { "page": 1, "limit": 20, "total": 47, "hasMore": true }
  }
}
```

---

## A-02 · PUT /api/admin/prive/submissions/:id/approve (NEW)

**Auth:** Admin JWT (operator role minimum)

**Request body:**
```json
{
  "note": "Authentic post, good engagement"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "submissionId": "64f3a1b2c3d4e5f6a7b8cc02",
    "status": "approved",
    "cashbackIssued": 525,
    "coinsIssued": 200,
    "userId": "64f3a1b2c3d4e5f6a7b8cd00",
    "notificationSent": true
  }
}
```

---

## A-03 · GET /api/admin/coins/overview (NEW)
**Used by:** `AdminCoinSystemOverview.jsx`

**Auth:** Admin JWT required

**Response 200:**
```json
{
  "success": true,
  "data": {
    "coinTypes": {
      "rez": {
        "totalIssued": 12500000,
        "totalRedeemed": 8900000,
        "activeBalance": 3600000,
        "usersHolding": 145678,
        "redemptionRate": 71.2,
        "issuedToday": 45600,
        "redeemedToday": 32100
      },
      "branded": {
        "totalIssued": 5400000,
        "totalRedeemed": 3200000,
        "activeBalance": 2200000,
        "usersHolding": 89234,
        "redemptionRate": 59.3,
        "issuedToday": 12300,
        "redeemedToday": 8900
      },
      "promo": {
        "totalIssued": 890000,
        "totalRedeemed": 750000,
        "activeBalance": 140000,
        "usersHolding": 23456,
        "redemptionRate": 84.3,
        "issuedToday": 5600,
        "redeemedToday": 8900
      },
      "prive": {
        "totalIssued": 230000,
        "totalRedeemed": 89000,
        "activeBalance": 141000,
        "usersHolding": 4521,
        "redemptionRate": 38.7,
        "issuedToday": 2300,
        "redeemedToday": 890
      }
    },
    "killSwitchActive": false,
    "dailyIssuanceCap": 500000,
    "issuedTodayTotal": 65800
  }
}
```

---

## A-04 · POST /api/admin/coins/emergency/pause (NEW)
**Used by:** `AdminCoinEmergencyControls.jsx` kill switch

**Auth:** Senior Admin JWT required

**Request body:**
```json
{
  "coinTypes": ["promo"],
  "reason": "Exploit detected — promo coin farming via referral loop",
  "durationHours": 24
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "paused": ["promo"],
    "reason": "Exploit detected — promo coin farming via referral loop",
    "pausedUntil": "2026-03-21T15:00:00.000Z",
    "auditLogId": "64f3a1b2c3d4e5f6a7b8f000"
  }
}
```

---
---

# COMMON ERROR RESPONSE FORMAT

All errors follow this format:
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message for display",
  "field": "fieldName",
  "details": {}
}
```

**Standard HTTP codes:**
- `400` — Bad request (validation error, business logic error)
- `401` — Not authenticated
- `403` — Authenticated but not authorized (wrong role, feature flag off)
- `404` — Resource not found
- `409` — Conflict (duplicate, already exists)
- `429` — Rate limited
- `500` — Server error (never expose stack traces)

---

*REZ API Contract Spec (Doc 4) · March 2026*
*30 endpoints documented · Phases 1–4 · Frontend/backend parallel development*
