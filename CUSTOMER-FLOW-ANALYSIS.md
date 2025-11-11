# CUSTOMER FLOW ANALYSIS
**QR-Based Self-Checkout System**  
*Complete Anonymous Purchase Journey*

---

## 📱 CUSTOMER MODULE OVERVIEW

### **Module Structure**
```
frontend/src/app/kantin/[slug]/
├── page.tsx              → Product listing (QR scan landing)
├── checkout/page.tsx     → Checkout & payment
└── success/page.tsx      → Transaction confirmation
```

### **Route Pattern**
- **URL Format**: `/kantin/[location_slug]`
- **Example**: `/kantin/LOKASI_A` or `/kantin/OUTLET_BSD`
- **Access**: No authentication required (anonymous/self-checkout)

---

## 🔄 END-TO-END CUSTOMER JOURNEY

### **STEP 1: QR Code Scan → Product Discovery**
**File**: `kantin/[slug]/page.tsx`  
**RPC Call**: `get_products_by_location(location_qr_code: string)`

#### User Experience:
1. Customer scans QR code at location (printed by admin)
2. Redirected to `/kantin/LOCATION_SLUG`
3. Sees product grid with:
   - Product photo
   - Product name
   - Supplier name
   - Price
   - Stock quantity
   - "Add to cart" button

#### Key Features:
- **Search**: Real-time product name filter
- **Visual Feedback**:
  - ⚡ **URGENT badge** for products with `sort_priority = 1` and stock > 0
  - 🟠 **"Sisa X" badge** for products with stock ≤ 5
  - ❌ **"HABIS" overlay** for out-of-stock products
- **Cart Management**:
  - Add/remove items with +/- buttons
  - Real-time cart counter in header
  - Stock validation (cannot exceed available quantity)
  - Cart data stored in `sessionStorage` (key: `cart_${locationSlug}`)

#### Backend Integration:
```typescript
const { data, error } = await supabase
  .rpc('get_products_by_location', { 
    location_qr_code: locationSlug 
  })
```

**What Admin Needs**:
- ✅ Products must be APPROVED by admin to appear
- ✅ Location must be ACTIVE in locations table
- ✅ Products must have inventory > 0 at that location

---

### **STEP 2: Cart Review → Checkout**
**File**: `kantin/[slug]/checkout/page.tsx`  
**RPC Calls**: 
1. `process_anonymous_checkout(p_location_slug: string, p_items: json[])`
2. `confirm_payment(p_transaction_id: uuid)` (after payment)

#### User Experience:
1. Customer clicks "Lanjut ke Pembayaran" from cart
2. Sees checkout summary:
   - All cart items with quantities
   - Total items count
   - Total amount to pay
3. Clicks "Lanjut ke Pembayaran" button
4. System processes checkout via RPC

#### Backend Integration (Checkout):
```typescript
const items = cart.map(item => ({
  product_id: item.product_id,
  quantity: item.quantity,
  price: item.price
}))

const { data, error } = await supabase
  .rpc('process_anonymous_checkout', {
    p_location_slug: locationSlug,
    p_items: items
  })
```

**RPC Returns**:
```typescript
{
  transaction_id: string
  transaction_code: string
  total_amount: number
  qris_code: string | null
  qris_image_url: string | null
}
```

#### What Happens in Backend:
1. Creates record in `sales_transactions` table
   - Status: 'pending'
   - Payment method: 'qris' or 'cash'
   - Total amount calculated
2. Creates records in `sales_transaction_items` for each product
3. **Deducts inventory** from `inventory_levels` table
4. **Calculates commission** for each supplier (stored in `sales_transaction_items.commission_amount`)
5. Fetches QRIS image URL from `platform_settings` (location-specific)
6. Returns transaction details + QRIS for payment

---

### **STEP 3: Payment Process**
**File**: `kantin/[slug]/checkout/page.tsx` (continued)

#### Payment Options:

**Option A: QRIS Payment**
1. System displays QRIS QR code image
2. Customer can:
   - Scan directly from screen
   - Download QR code (`downloadQRIS()` function)
3. Customer opens e-wallet/banking app
4. Scans/uploads QRIS
5. Confirms payment in their app
6. Returns to checkout page
7. Clicks "✅ Verifikasi Bayar QRIS" button

**Option B: Cash Payment**
1. Customer clicks "💵 Bayar Tunai" button
2. Confirmation dialog: "Yakin bayar tunai? Serahkan uang ke kasir."
3. Customer confirms
4. System marks as paid

#### Backend Integration (Payment Confirmation):
```typescript
const { data, error } = await supabase
  .rpc('confirm_payment', {
    p_transaction_id: checkoutResult.transaction_id
  })
```

**RPC Does**:
1. Updates `sales_transactions.status` from 'pending' → 'completed'
2. Updates `sales_transactions.paid_at` to current timestamp
3. **Credits supplier wallets** with commission amounts
4. **Creates notifications** for affected suppliers (new sale)
5. Returns success confirmation

---

### **STEP 4: Success Confirmation**
**File**: `kantin/[slug]/success/page.tsx`  
**Route**: `/kantin/[slug]/success?code=TRX-XXXX`

#### User Experience:
1. Shows green checkmark ✅
2. Displays "Pembayaran Berhasil! Terima kasih atas kejujuran Anda"
3. Shows digital receipt:
   - Transaction code
   - Transaction date/time
   - Item details (name, quantity, unit price, subtotal)
   - Total amount
4. Action buttons:
   - "Kembali ke Menu" (back to product listing)
   - "Cetak Struk" (print receipt)
5. Footer message: *"Kejujuran adalah mata uang yang berlaku di mana-mana"*

#### Backend Integration:
```typescript
// Get transaction
const { data: transData } = await supabase
  .from('sales_transactions')
  .select('id, transaction_code, total_amount, created_at')
  .eq('transaction_code', transactionCode)
  .single()

// Get transaction items
const { data: itemsData } = await supabase
  .from('sales_transaction_items')
  .select(`
    quantity,
    price,
    subtotal,
    products!inner(name)
  `)
  .eq('transaction_id', transData.id)
```

---

## 🔐 DATABASE FLOW

### **Tables Involved**

| Table | Purpose | Updates |
|-------|---------|---------|
| `locations` | Store location info & QR slug | Read only |
| `products` | Product master data | Read only |
| `inventory_levels` | Stock by location | **Deducted on checkout** |
| `sales_transactions` | Transaction header | **Created & updated** |
| `sales_transaction_items` | Transaction line items | **Created** |
| `supplier_wallets` | Supplier earnings | **Credited on payment** |
| `notifications` | Supplier alerts | **Created on payment** |

### **Critical Business Logic**

#### **Inventory Deduction** (on checkout):
```sql
UPDATE inventory_levels
SET quantity = quantity - p_item_quantity
WHERE product_id = p_item_product_id
  AND location_id = p_location_id
```

#### **Commission Calculation** (on checkout):
```sql
-- For each item:
commission_amount = (item_price - product_cost) * quantity
-- Stored in sales_transaction_items.commission_amount
```

#### **Wallet Credit** (on payment confirmation):
```sql
UPDATE supplier_wallets
SET balance = balance + total_commission
WHERE supplier_id = p_supplier_id
```

#### **Notification Creation** (on payment confirmation):
```sql
INSERT INTO notifications (user_id, type, title, message)
VALUES (
  supplier_user_id,
  'sale_completed',
  'Penjualan Baru',
  'Produk [nama] terjual [qty] item di [lokasi]'
)
```

---

## 🎯 WHAT ADMIN NEEDS TO SUPPORT

### **BEFORE Customer Can Buy**

1. ✅ **Approve Supplier**
   - Admin must approve supplier registration
   - Without approval, supplier cannot submit products

2. ✅ **Approve Products**
   - Admin must approve each product submission
   - Only approved products appear in customer view

3. ✅ **Approve Shipment**
   - Supplier creates shipment to location
   - Admin must approve shipment
   - Only then inventory is added to location

4. ✅ **Create & Activate Location**
   - Admin creates location record
   - Generates QR code slug
   - Prints QR code for display at physical location

5. ✅ **Set Up QRIS** (optional)
   - Admin configures QRIS image URL in `platform_settings`
   - Customer can pay via QR code scan

### **AFTER Customer Buys**

1. 📊 **Monitor Sales**
   - View real-time sales transactions
   - See which products are selling
   - Track sales by location
   - Identify top-performing suppliers

2. 💰 **Process Payments**
   - Handle withdrawal requests from suppliers
   - Verify payment confirmations (if manual review needed)
   - Track commission calculations

3. 📦 **Monitor Inventory**
   - Get alerts for low stock
   - Prompt suppliers to restock
   - Approve new shipments to replenish

4. 🔍 **Verify Transactions** (Fraud Prevention)
   - Review suspicious transactions
   - Check payment vs actual inventory movement
   - Handle disputes between customer/supplier

---

## 🚨 CRITICAL ADMIN BOTTLENECKS IN CUSTOMER FLOW

### **HIGH IMPACT ISSUES**

#### **1. Product Approval Bottleneck** ❌
**Problem**: Admin must manually approve each product one-by-one  
**Impact on Customer**: Limited product selection  
**Current Admin UI**: No bulk approve button  
**User Pain Point**: Customer scans QR, sees "Belum ada produk tersedia"

**Solution Needed**:
- ✅ Bulk approve for products from trusted suppliers
- ✅ Auto-approve products from suppliers with good track record
- ✅ Batch approval by category/supplier

---

#### **2. Shipment Approval Delays** ⏱️
**Problem**: Supplier ships products, admin takes days to approve  
**Impact on Customer**: Out of stock products, poor selection  
**Current Admin UI**: Shipments page has good UI but no batch operations  
**User Pain Point**: Customer sees "HABIS" on many products

**Solution Needed**:
- ✅ Bulk approve shipments
- ✅ Email/push notifications for pending shipments
- ✅ SLA tracking (time from shipment submission to approval)
- ✅ Auto-approve from trusted suppliers

---

#### **3. Low Stock Not Visible** 📉
**Problem**: Admin doesn't see which locations are running out  
**Impact on Customer**: Wasted trip to location with limited selection  
**Current Admin UI**: Dashboard shows total inventory, not by location  
**User Pain Point**: Bad customer experience

**Solution Needed**:
- ✅ Dashboard widget: "Low Stock Alerts by Location"
- ✅ Show which products are urgently needed at which locations
- ✅ Prompt suppliers to create shipments for those products

---

#### **4. Payment Processing Blind Spot** 💸
**Problem**: Admin cannot see real-time payment confirmations  
**Impact on Customer**: Confusion if payment doesn't process  
**Current Admin UI**: Payments page shows all zeros (not integrated!)  
**User Pain Point**: Customer pays but system doesn't confirm

**Solution Needed**:
- ✅ **URGENT**: Integrate payments page with actual sales data
- ✅ Show pending vs completed transactions
- ✅ Manual payment verification interface for disputed transactions
- ✅ Real-time payment notifications

---

#### **5. QRIS Setup Missing** 📲
**Problem**: Many locations don't have QRIS configured  
**Impact on Customer**: Can only pay cash (less convenient)  
**Current Admin UI**: No interface to set QRIS per location  
**User Pain Point**: Checkout shows "QRIS belum tersedia"

**Solution Needed**:
- ✅ Add QRIS configuration to Locations page
- ✅ Allow admin to upload/set QRIS image per location
- ✅ Test QRIS display before activation

---

## 📊 CUSTOMER FLOW METRICS ADMIN SHOULD TRACK

### **Conversion Funnel**
```
QR Scans → Products Viewed → Items Added to Cart → Checkout Started → Payment Completed
```

**Current Admin View**: ❌ NOT TRACKED  
**Should Show**:
- How many unique QR scans per location
- Conversion rate from scan → purchase
- Average cart value
- Abandoned cart rate
- Payment method split (QRIS vs cash)

---

### **Product Performance**
- **Top 10 products** (already implemented in Reports)
- **Slow-moving products** (not implemented)
- **Out-of-stock frequency** (how often products hit 0 inventory)
- **Restock velocity** (time from out-of-stock to restocked)

---

### **Location Performance**
- **Sales by location** (not implemented)
- **Customer traffic by location** (not tracked)
- **Average transaction value by location**
- **Top locations for specific product categories**

---

### **Supplier Performance from Customer View**
- **Products with highest sell-through rate**
- **Suppliers with most out-of-stock incidents**
- **Suppliers with fastest restock times**
- **Customer complaints by supplier** (no feedback system yet)

---

## 🔗 INTEGRATION POINTS WITH OTHER MODULES

### **SUPPLIER → ADMIN → CUSTOMER**

```
[SUPPLIER SUBMITS PRODUCT]
         ↓
[ADMIN APPROVES PRODUCT] ← Bottleneck if slow
         ↓
[PRODUCT VISIBLE TO CUSTOMER]
         ↓
[SUPPLIER CREATES SHIPMENT TO LOCATION]
         ↓
[ADMIN APPROVES SHIPMENT] ← Bottleneck if slow
         ↓
[INVENTORY ADDED TO LOCATION]
         ↓
[CUSTOMER CAN BUY AT THAT LOCATION]
         ↓
[CUSTOMER COMPLETES PAYMENT]
         ↓
[ADMIN MONITORS TRANSACTION] ← Currently weak
         ↓
[SUPPLIER WALLET CREDITED]
         ↓
[SUPPLIER REQUESTS WITHDRAWAL]
         ↓
[ADMIN PROCESSES WITHDRAWAL] ← Not implemented in UI
```

**Admin's Role**: 
- **Gatekeeper** (approvals)
- **Monitor** (sales, inventory, fraud)
- **Facilitator** (payments, dispute resolution)

---

## 🎨 UX OBSERVATIONS

### **Customer-Facing Strengths** ✅
- Clean, mobile-first design
- Visual feedback (badges, overlays, animations)
- Search functionality
- Real-time stock updates
- Cart persistence (sessionStorage)
- QRIS download option
- Digital receipt

### **Customer-Facing Gaps** ⚠️
- No customer feedback/rating system
- No order history (anonymous checkout)
- No product descriptions (only name/price)
- No product categories visible to customer
- No promotions/discounts
- No wishlist feature
- No notification when out-of-stock products are restocked

---

## 🔧 TECHNICAL OBSERVATIONS

### **Backend RPC Functions Used**

#### **1. get_products_by_location**
**Purpose**: Fetch products available at specific location  
**Parameters**: `location_qr_code: string`  
**Returns**: Array of products with:
- product_id, name, price, quantity, barcode, photo_url
- supplier_name
- total_sales (for popularity sorting)
- sort_priority (1 = urgent, 2 = normal)

**Logic**:
- Joins `products`, `suppliers`, `locations`, `inventory_levels`
- Filters by location QR code
- Only approved products
- Only active suppliers
- Only products with inventory > 0 OR inventory = 0 (to show "HABIS")
- Orders by: sort_priority ASC, total_sales DESC, name ASC

**Where Defined**: Likely in `backend/migrations/027_update_checkout_with_commission.sql`

---

#### **2. process_anonymous_checkout**
**Purpose**: Create transaction and deduct inventory  
**Parameters**: 
- `p_location_slug: string`
- `p_items: json[]` (array of {product_id, quantity, price})

**Returns**: 
- transaction_id, transaction_code, total_amount, qris_code, qris_image_url

**Logic**:
1. Generate unique transaction code (format: TRX-YYYYMMDD-XXXXX)
2. Calculate total amount
3. Get location_id from slug
4. INSERT into `sales_transactions` (status='pending')
5. For each item:
   - Get product cost from products table
   - Calculate commission = (price - cost) * quantity
   - INSERT into `sales_transaction_items`
   - UPDATE `inventory_levels` (deduct quantity)
6. Get QRIS settings from `platform_settings`
7. Return transaction details

**Where Defined**: `backend/migrations/027_update_checkout_with_commission.sql`

---

#### **3. confirm_payment**
**Purpose**: Mark transaction as paid and credit supplier wallets  
**Parameters**: `p_transaction_id: uuid`  
**Returns**: `{success: boolean, message: string}`

**Logic**:
1. Check if transaction exists and is 'pending'
2. UPDATE `sales_transactions.status` = 'completed', `paid_at` = NOW()
3. For each transaction item:
   - Get supplier_id from product
   - UPDATE `supplier_wallets.balance` += commission_amount
4. Create notifications for each supplier (new sale alert)
5. Return success confirmation

**Where Defined**: Likely in same migration as process_anonymous_checkout

---

### **Frontend State Management**

#### **SessionStorage Keys**
- `cart_${locationSlug}`: Cart items for specific location
- Persists across page navigation within checkout flow
- Cleared on successful payment

#### **React State** (kantin/[slug]/page.tsx)
```typescript
const [products, setProducts] = useState<Product[]>([])
const [cart, setCart] = useState<CartItem[]>([])
const [loading, setLoading] = useState(true)
const [locationName, setLocationName] = useState('')
const [selectedCategory, setSelectedCategory] = useState('all')  // Not used
const [searchQuery, setSearchQuery] = useState('')
const [showCart, setShowCart] = useState(false)  // Toggle cart panel
```

#### **React State** (kantin/[slug]/checkout/page.tsx)
```typescript
const [cart, setCart] = useState<CartItem[]>([])
const [loading, setLoading] = useState(true)
const [processing, setProcessing] = useState(false)  // During checkout
const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null)
const [confirming, setConfirming] = useState(false)  // During payment confirmation
```

---

## 💡 KEY INSIGHTS FOR ADMIN OPTIMIZATION

### **1. Admin is the Primary Bottleneck**
- Customer experience DIRECTLY depends on admin approval speed
- Slow admin = empty shelves = bad customer experience
- **Priority Fix**: Bulk approve products and shipments

---

### **2. Visibility Gap**
- Admin doesn't see what customer sees
- Need "customer view" preview in admin dashboard
- Show which locations have low product variety

---

### **3. Payment System is Weak**
- Payments page not integrated despite backend being ready
- No fraud detection
- No manual payment verification workflow
- **Priority Fix**: Implement payments page fully

---

### **4. No Feedback Loop**
- Admin doesn't know if customers are satisfied
- No way to track quality issues
- No customer complaints/feedback mechanism
- **Future Enhancement**: Customer rating system

---

### **5. Inventory Management is Reactive**
- Admin waits for products to run out
- Should be proactive: predict restocking needs
- **Enhancement**: Auto-alert suppliers when stock < threshold

---

## 🎯 RECOMMENDED ADMIN ENHANCEMENTS (Based on Customer Flow)

### **PHASE 1: Remove Bottlenecks** (URGENT)
1. ✅ **Bulk Product Approval** (suppliers page & products page)
2. ✅ **Bulk Shipment Approval** (shipments page)
3. ✅ **Integrate Payments Page** (show real sales transactions)
4. ✅ **Add Pagination** to suppliers & products pages

### **PHASE 2: Improve Visibility** (HIGH)
5. ✅ **Dashboard Widget**: "Low Stock by Location"
6. ✅ **Dashboard Widget**: "Pending Approvals Summary"
7. ✅ **Sales by Location Report**
8. ✅ **Product Performance by Location**

### **PHASE 3: Proactive Management** (MEDIUM)
9. ✅ **Auto-notifications for low stock** → prompt suppliers
10. ✅ **QRIS Configuration per Location** (in locations page)
11. ✅ **SLA Tracking** (time to approve shipments/products)
12. ✅ **Supplier Trust Score** (enable auto-approve for trusted suppliers)

### **PHASE 4: Analytics & Insights** (LOW)
13. ✅ **Conversion Funnel Tracking** (scan → purchase)
14. ✅ **Abandoned Cart Analytics**
15. ✅ **Customer Traffic Heatmap** (by location & time)
16. ✅ **Predictive Restocking Alerts**

---

## 🚀 NEXT STEPS

1. **Create Unified Business Flow Diagram**
   - Map complete journey: Supplier → Admin → Customer
   - Identify all touchpoints where admin intervenes
   - Highlight bottlenecks with time estimates

2. **Prioritize Admin Enhancements**
   - Based on customer impact (high → low)
   - Based on implementation effort (easy → hard)
   - Create implementation roadmap

3. **Implement Phase 1 Fixes**
   - Bulk approve buttons
   - Payment page integration
   - Pagination for large lists

4. **Build Monitoring Dashboard**
   - Real-time metrics that matter for customer experience
   - Alerts for admin action needed (approvals, low stock)

---

## 📋 CONCLUSION

**Customer module is WELL IMPLEMENTED** with:
- Clean UX/UI
- Proper backend integration
- Stock management
- Payment processing (QRIS + cash)
- Digital receipts

**But customer experience DEPENDS HEAVILY on admin efficiency**:
- Slow product approvals = Limited selection
- Slow shipment approvals = Out of stock
- No payment monitoring = Payment confusion
- No QRIS setup = Cash-only (inconvenient)

**Admin must shift from reactive → proactive**:
- Bulk operations to speed up approvals
- Automated alerts to prevent stockouts
- Real-time payment monitoring
- Predictive analytics for restocking

**The platform's success hinges on optimizing the admin's workflow** to support a smooth supplier-to-customer pipeline. 🎯
