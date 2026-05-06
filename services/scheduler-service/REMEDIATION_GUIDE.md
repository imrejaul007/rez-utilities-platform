# ReZ Platform - Critical Issues Remediation Guide

**Date**: April 16, 2026  
**Status**: 3 CRITICAL issues requiring immediate fixes  
**Estimated effort**: 2-3 hours including testing

---

## REMEDIATION #1: Fix voucherCode Field Mismatch (CRF-001)

### Step 1: Identify the Issue

**The problem**:
```
FRONTEND                              BACKEND
POST /api/orders                      expects also:
├─ couponCode ✓                       ├─ voucherCode (missing)
├─ redemptionCode ✓                   └─ offerRedemptionCode (missing)
└─ ... 15 other fields
```

### Step 2: Investigation (5 minutes)

Run this to find the validation schema:

```bash
find /sessions/admiring-gracious-gauss/mnt/ReZ\ Full\ App/rezbackend/rez-backend-master/src -name "*.ts" | xargs grep -l "orderSchemas"
```

Look for file containing:
```typescript
export const orderSchemas = {
  createOrder: Joi.object({
    // voucherCode: Joi.string().required(),  ← Is this required?
    // offerRedemptionCode: Joi.string().required(),
  })
}
```

### Step 3: Choose Fix Strategy (5 minutes)

**OPTION A: Backend removes unsupported fields (RECOMMENDED)**

**If**: Backend never actually uses voucherCode or offerRedemptionCode

```typescript
// BAD: orderCreateController.ts current code
const { voucherCode, offerRedemptionCode, ... } = req.body;
// But then these are never used

// GOOD: Remove these lines entirely
const {
  // voucherCode,  // ← DELETE THIS
  // offerRedemptionCode,  // ← DELETE THIS
  couponCode,
  redemptionCode,
  ... // other fields
} = req.body;
```

**Files to update**:
- `/rezbackend/rez-backend-master/src/controllers/orderCreateController.ts:329-334`
  Remove `voucherCode` and `offerRedemptionCode` destructuring

**OPTION B: Frontend sends all required fields (if backend uses them)**

**If**: Backend actually needs voucherCode and offerRedemptionCode

```typescript
// Consumer app ordersApi.ts - UPDATE CreateOrderRequest interface
export interface CreateOrderRequest {
  // ... existing fields ...
  couponCode?: string;
  redemptionCode?: string;
  voucherCode?: string;  // ← ADD THIS
  offerRedemptionCode?: string;  // ← ADD THIS
}
```

**Files to update**:
- `/rez-app-consumer/services/ordersApi.ts:170-210` - Add both fields to CreateOrderRequest

### Step 4: Fix Implementation (20 minutes)

**Choose OPTION A (recommended):**

```typescript
// File: /rezbackend/rez-backend-master/src/controllers/orderCreateController.ts
// Line: ~329-334

// BEFORE:
const {
  deliveryAddress,
  paymentMethod,
  specialInstructions,
  couponCode,
  voucherCode,  // ← REMOVE
  coinsUsed,
  storeId,
  items: requestItems,
  redemptionCode,
  offerRedemptionCode,  // ← REMOVE
  lockFeeDiscount: clientLockFeeDiscount,
  idempotencyKey,
  pickId,
  fulfillmentType: reqFulfillmentType,
  fulfillmentDetails: reqFulfillmentDetails,
} = req.body;

// AFTER:
const {
  deliveryAddress,
  paymentMethod,
  specialInstructions,
  couponCode,
  coinsUsed,
  storeId,
  items: requestItems,
  redemptionCode,
  lockFeeDiscount: clientLockFeeDiscount,
  idempotencyKey,
  pickId,
  fulfillmentType: reqFulfillmentType,
  fulfillmentDetails: reqFulfillmentDetails,
} = req.body;
```

Also check if these are used later in the file and remove those references:
```bash
grep -n "voucherCode\|offerRedemptionCode" /rezbackend/rez-backend-master/src/controllers/orderCreateController.ts
```

If found, remove or replace with nullish coalescing:
```typescript
// BEFORE:
const discountFromVoucher = voucherService.apply(voucherCode, order);

// AFTER: (if truly optional)
const discountFromVoucher = voucherCode ? voucherService.apply(voucherCode, order) : 0;
```

### Step 5: Validation Schema Check (5 minutes)

Find and update validation schema:

```bash
find /rezbackend/rez-backend-master/src -path "*validation*" -name "*.ts" | xargs grep -l "createOrder"
```

Likely file: `/rezbackend/rez-backend-master/src/middleware/validation/orderSchemas.ts`

```typescript
// BEFORE:
export const orderSchemas = {
  createOrder: Joi.object({
    deliveryAddress: Joi.object(...).required(),
    paymentMethod: Joi.string().required(),
    voucherCode: Joi.string().required(),  // ← DELETE
    offerRedemptionCode: Joi.string().required(),  // ← DELETE
    // ...
  })
}

// AFTER:
export const orderSchemas = {
  createOrder: Joi.object({
    deliveryAddress: Joi.object(...).required(),
    paymentMethod: Joi.string().required(),
    // voucherCode and offerRedemptionCode removed
    // ...
  })
}
```

### Step 6: Testing (10 minutes)

```bash
# Test 1: Order creation succeeds WITHOUT voucherCode
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-1" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "deliveryAddress": { "name": "John", "phone": "9999999999", ... },
    "paymentMethod": "wallet"
  }'
# Expected: 201 Created

# Test 2: Order creation succeeds WITH couponCode/redemptionCode
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-2" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "deliveryAddress": { ... },
    "paymentMethod": "wallet",
    "couponCode": "SAVE10"
  }'
# Expected: 201 Created with discount applied
```

### Step 7: Code Review Checklist

- [ ] Removed voucherCode and offerRedemptionCode from controller destructuring
- [ ] Verified no downstream code uses these fields
- [ ] Updated validation schema to NOT require these fields
- [ ] Tested order creation with and without coupons
- [ ] Confirmed idempotency still works (same Idempotency-Key = same result)

---

## REMEDIATION #2: Add merchantId to Admin Order Response (CRF-002)

### Step 1: Understand the Issue

**The problem**:
```
Admin App expects:          Backend returns:
order.store {               order.store {
  _id: "...",                 _id: "...",
  name: "...",                name: "...",
  merchantId: "..." ← MISSING  logo?: "..."
}                           }
```

### Step 2: Investigation (10 minutes)

Find where orders are fetched and populated:

```bash
# Find admin order controller
find /rezbackend/rez-backend-master/src -path "*admin*" -name "*order*" -type f

# Look for Order.find() calls
grep -r "Order.find\|Order.aggregate" /rezbackend/rez-backend-master/src/controllers/admin/ 2>/dev/null | grep -v "node_modules"

# Look for Order.populate() calls
grep -r "\.populate.*store" /rezbackend/rez-backend-master/src/controllers/ | head -10
```

### Step 3: Locate the Code

Likely in: `/rezbackend/rez-backend-master/src/controllers/orderController.ts` or `/rezbackend/rez-backend-master/src/controllers/admin/orderController.ts`

Look for pattern:
```typescript
const orders = await Order.find({ ... })
  .populate('store', '_id name logo')  // ← merchantId missing
  .lean()
```

### Step 4: Fix Implementation (10 minutes)

**UPDATE the populate call**:

```typescript
// BEFORE:
const orders = await Order.find({ ... })
  .populate('store', '_id name logo')
  .lean();

// AFTER:
const orders = await Order.find({ ... })
  .populate('store', '_id name logo merchantId')
  .lean();
```

**Alternative if using full populate**:

```typescript
// BEFORE:
const orders = await Order.find({ ... })
  .populate('store')  // Gets entire Store doc
  .lean();

// AFTER: (same, but explicitly document it)
const orders = await Order.find({ ... })
  .populate('store')  // Includes merchantId from Store schema
  .lean();
```

### Step 5: Verify Store Schema Has merchantId

Check: `/rezbackend/rez-backend-master/src/models/Store.ts`

```typescript
// Store schema should include:
const StoreSchema = new Schema({
  name: String,
  logo: String,
  merchantId: { type: Schema.Types.ObjectId, ref: 'User' },  // ← Should exist
  // ...
});
```

If merchantId doesn't exist on Store model → **STOP** and consult backend team  
(This would be a data model issue, not just a query issue)

### Step 6: Testing (15 minutes)

```bash
# Test 1: Create orders for 2 different merchants
# (Assume merchant IDs: merchant1 = "641a5c9f8b1234567890abcd", merchant2 = "641a5c9f8b1234567890abce")

curl -X GET "http://localhost:3000/api/admin/orders?merchantId=641a5c9f8b1234567890abcd" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Expected response:
# {
#   "orders": [
#     {
#       "_id": "...",
#       "store": {
#         "_id": "...",
#         "name": "Restaurant A",
#         "merchantId": "641a5c9f8b1234567890abcd"  ← MUST BE PRESENT
#       },
#       ...
#     }
#   ]
# }

# Test 2: Verify merchantId matches request filter
# All returned orders should have store.merchantId === query parameter merchantId
```

### Step 7: Code Review Checklist

- [ ] Added `merchantId` to Store populate() field selection
- [ ] Verified Store schema actually has merchantId field
- [ ] Tested filtering by merchantId → only correct orders returned
- [ ] Tested with 2+ merchants → data correctly isolated
- [ ] Admin UI doesn't break when rendering store.merchantId

---

## REMEDIATION #3: Verify Product Creation Response (CRF-003)

### Step 1: Investigation (20 minutes)

**Find the merchant product controller**:

```bash
find /sessions/admiring-gracious-gauss/mnt/ReZ\ Full\ App/rez-merchant-service -name "*product*" -type f | head -10
```

Expected path: `/rez-merchant-service/src/controllers/productController.ts`

**Read the POST endpoint**:

```typescript
export async function createProduct(req: Request, res: Response) {
  const { name, description, price, inventory, cashback, images, ... } = req.body;
  
  // Create product in DB
  const product = await Product.create({ name, description, price, inventory, cashback, images, ... });
  
  // Response
  res.json({ success: true, data: product });
}
```

### Step 2: Analyze Response Schema

**What merchant app SENDS** (from `/rez-app-marchant/services/api/products.ts:32-65`):

```typescript
CreateProductRequest {
  name: string;
  description: string;
  price: number;
  category: string;
  storeId?: string;
  sku?: string;
  inventory: {
    stock: number;
    lowStockThreshold?: number;
    trackInventory?: boolean;
    allowBackorders?: boolean;
  };
  cashback: {
    percentage: number;
    maxAmount?: number;
    isActive?: boolean;
  };
  images?: Array<{
    url: string;
    thumbnailUrl?: string;
    altText?: string;
    sortOrder?: number;
    isMain?: boolean;
  }>;
  status?: 'active' | 'inactive' | 'draft' | 'archived';
  visibility?: 'public' | 'hidden' | 'featured';
  tags?: string[];
  currency?: string;
  shortDescription?: string;
  brand?: string;
  barcode?: string;
  subcategory?: string;
}
```

**What merchant app EXPECTS** in response:
Same fields in Product response (or at least the ones shown in UI)

### Step 3: Check Product Model

Verify `/rez-merchant-service/src/models/Product.ts` includes all fields:

```typescript
const ProductSchema = new Schema({
  // Basic info
  name: { type: String, required: true },
  description: String,
  shortDescription: String,
  price: { type: Number, required: true },
  
  // Categorization
  category: { type: ObjectId, ref: 'Category' },
  subcategory: String,
  
  // Inventory
  inventory: {
    stock: { type: Number, default: 0 },
    lowStockThreshold: Number,
    trackInventory: { type: Boolean, default: true },
    allowBackorders: { type: Boolean, default: false },
  },
  
  // Cashback
  cashback: {
    percentage: Number,
    maxAmount: Number,
    isActive: Boolean,
  },
  
  // Media
  images: [{
    url: String,
    thumbnailUrl: String,
    altText: String,
    sortOrder: Number,
    isMain: Boolean,
  }],
  
  // Metadata
  sku: String,
  barcode: String,
  brand: String,
  status: { type: String, enum: ['active', 'inactive', 'draft', 'archived'] },
  visibility: { type: String, enum: ['public', 'hidden', 'featured'] },
  tags: [String],
  currency: String,
  
  // ... timestamps, store ref, etc
});
```

If any CreateProductRequest field is NOT in schema → **BUG**: Data is not being stored

### Step 4: Fix Implementation (15 minutes)

**If fields are missing from Product model**:

```typescript
// File: /rez-merchant-service/src/models/Product.ts

const ProductSchema = new Schema({
  // ... existing fields ...
  
  // ADD MISSING FIELDS:
  lowStockThreshold: Number,  // If not in inventory sub-doc
  visibility: String,  // Should be enum
  tags: [String],
  currency: { type: String, default: 'INR' },
  brand: String,
  barcode: String,
});
```

**If fields are in model but not returned**:

```typescript
// File: /rez-merchant-service/src/controllers/productController.ts

// BEFORE:
const product = await Product.findById(productId)
  .select('name description price category')  // ← Missing fields!
  .lean();

// AFTER:
const product = await Product.findById(productId)
  // Remove .select() to return all fields
  .lean();

// OR explicitly select all needed fields:
const product = await Product.findById(productId)
  .select('name description price category storeId sku inventory cashback images status visibility tags currency shortDescription brand barcode subcategory')
  .lean();
```

### Step 5: Create Integration Test (10 minutes)

Add test to `/rez-merchant-service/__tests__/controllers/productController.test.ts`:

```typescript
describe('Product Creation & Retrieval', () => {
  it('should return all fields when creating a product', async () => {
    const createPayload = {
      name: 'Test Product',
      description: 'A test product',
      shortDescription: 'Short desc',
      price: 100,
      category: categoryId,
      storeId: storeId,
      sku: 'TEST-001',
      barcode: '1234567890',
      brand: 'Test Brand',
      inventory: {
        stock: 50,
        lowStockThreshold: 10,
        trackInventory: true,
        allowBackorders: false,
      },
      cashback: {
        percentage: 5,
        maxAmount: 50,
        isActive: true,
      },
      images: [
        {
          url: 'https://example.com/image.jpg',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          altText: 'Product image',
          sortOrder: 1,
          isMain: true,
        }
      ],
      status: 'active',
      visibility: 'public',
      tags: ['sale', 'popular'],
      currency: 'INR',
    };

    // POST /merchant/products
    const createResponse = await request(app)
      .post('/api/merchant/products')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send(createPayload);

    expect(createResponse.status).toBe(201);
    const { data: createdProduct } = createResponse.body;
    const productId = createdProduct._id;

    // GET /merchant/products/:id
    const getResponse = await request(app)
      .get(`/api/merchant/products/${productId}`)
      .set('Authorization', `Bearer ${merchantToken}`);

    expect(getResponse.status).toBe(200);
    const { data: retrievedProduct } = getResponse.body;

    // VERIFY ALL FIELDS
    expect(retrievedProduct.name).toBe('Test Product');
    expect(retrievedProduct.description).toBe('A test product');
    expect(retrievedProduct.shortDescription).toBe('Short desc');
    expect(retrievedProduct.price).toBe(100);
    expect(retrievedProduct.sku).toBe('TEST-001');
    expect(retrievedProduct.barcode).toBe('1234567890');
    expect(retrievedProduct.brand).toBe('Test Brand');
    expect(retrievedProduct.inventory.stock).toBe(50);
    expect(retrievedProduct.inventory.lowStockThreshold).toBe(10);
    expect(retrievedProduct.cashback.percentage).toBe(5);
    expect(retrievedProduct.images.length).toBe(1);
    expect(retrievedProduct.images[0].url).toBe('https://example.com/image.jpg');
    expect(retrievedProduct.status).toBe('active');
    expect(retrievedProduct.visibility).toBe('public');
    expect(retrievedProduct.tags).toEqual(['sale', 'popular']);
    expect(retrievedProduct.currency).toBe('INR');
  });
});
```

### Step 6: Testing (10 minutes)

```bash
# Run the integration test
npm test -- productController.test.ts

# Manual test with curl
MERCHANT_TOKEN="..."
STORE_ID="641a5c9f8b1234567890abcd"

curl -X POST http://localhost:3001/api/merchant/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  -d '{
    "name": "Test Product",
    "description": "A test",
    "price": 100,
    "category": "641a5c9f8b1234567890abce",
    "storeId": "'$STORE_ID'",
    "inventory": {
      "stock": 50,
      "lowStockThreshold": 10,
      "trackInventory": true,
      "allowBackorders": false
    },
    "cashback": {
      "percentage": 5,
      "maxAmount": 50,
      "isActive": true
    },
    "images": [
      {
        "url": "https://example.com/image.jpg",
        "altText": "Product image",
        "isMain": true
      }
    ],
    "status": "active",
    "visibility": "public",
    "tags": ["sale"],
    "currency": "INR"
  }'

# Verify response includes all fields
# Expected: 201 Created with full product data
```

### Step 7: Code Review Checklist

- [ ] Product model schema includes all CreateProductRequest fields
- [ ] Product controller returns all fields in POST response
- [ ] Integration test verifies all fields present and correct values
- [ ] GET /merchant/products/:id returns same fields as POST response
- [ ] Merchant app can edit product (has data to pre-fill form)

---

## SUMMARY & NEXT STEPS

### Priority Order

1. **CRF-001** (voucherCode field) - 30 minutes
   - Identify validation schema
   - Remove unused fields from controller
   - Test order creation

2. **CRF-002** (merchantId field) - 20 minutes
   - Add merchantId to Store populate()
   - Test admin filtering

3. **CRF-003** (product response schema) - 45 minutes
   - Investigate product controller response
   - Add missing fields to model if needed
   - Write and run integration test

### Checklist Before Merging

```
Pre-Merge QA:
- [ ] All 3 critical issues fixed
- [ ] Unit tests passing (npm test)
- [ ] Integration tests passing
- [ ] End-to-end flow tests passing (manual or automated)
- [ ] Code review approved by team lead
- [ ] All findings in CRITICAL_FINDINGS_SUMMARY.txt addressed

Pre-Production:
- [ ] Run full test suite in staging environment
- [ ] Verify merchant filtering works with 10+ merchants
- [ ] Verify order creation under load (100+ concurrent users)
- [ ] Verify product creation/edit works end-to-end
- [ ] Smoke test all 5 flows (user order, merchant product, etc)
```

### Rollback Plan

If any fix causes regression:

1. Revert the specific commit
2. Open a new ticket to investigate root cause
3. Fix in a new PR with additional test coverage
4. Do NOT merge to main until fully tested

---

**Estimated Total Time**: 2-3 hours including testing  
**Confidence Level**: HIGH (issues clearly identified with file references)  
**Risk**: LOW (fixes are isolated, no architectural changes)
