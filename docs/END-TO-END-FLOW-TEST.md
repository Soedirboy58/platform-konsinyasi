# 🔄 End-to-End Flow Synchronization Test Guide

## 📊 Complete Flow Overview

```
SUPPLIER → INPUT PRODUK → ADMIN NOTIFIED → ADMIN APPROVE → CUSTOMER SEE → CUSTOMER BUY → INVENTORY UPDATE
```

---

## ✅ Flow Verification Checklist

### **PHASE 1: Supplier Input Product** 🏭

**Action:**
1. Login sebagai Supplier
2. Buka `/supplier/products/new`
3. Input produk baru dengan detail:
   - Name: "Biskuit Kelapa Original"
   - Price: 15000
   - Category: (optional)
   - Photo: Upload image
   - Min Stock: 10
4. Klik **"Submit Product"**

**Expected Result:**
- ✅ Product tersimpan dengan `status = 'PENDING'`
- ✅ Trigger `notify_new_product()` fired
- ✅ **Admin menerima notifikasi** (cek `notifications` table)

**SQL Verification:**
```sql
-- Check product created
SELECT id, name, status, supplier_id, created_at
FROM products
WHERE name = 'Biskuit Kelapa Original'
ORDER BY created_at DESC
LIMIT 1;

-- Check admin notification sent
SELECT 
    n.title, 
    n.message, 
    n.type, 
    n.created_at,
    p.full_name as admin_name
FROM notifications n
JOIN profiles p ON p.id = n.recipient_id
WHERE n.type = 'PRODUCT_APPROVAL'
  AND n.message LIKE '%Biskuit Kelapa%'
ORDER BY n.created_at DESC;
```

**Code Flow:**
```typescript
// Frontend: supplier/products/new/page.tsx
const { error } = await supabase
  .from('products')
  .insert({
    name, price, supplier_id, 
    status: 'PENDING' // ← Automatically PENDING
  })

// Backend: Trigger fires automatically
// backend/migrations/007_functions.sql
CREATE TRIGGER trigger_notify_new_product
AFTER INSERT ON products
FOR EACH ROW EXECUTE FUNCTION notify_new_product();
```

---

### **PHASE 2: Admin Receives Notification** 🔔

**Action:**
1. Login sebagai Admin
2. Buka `/admin` dashboard
3. Check **notification bell** icon

**Expected Result:**
- ✅ Notification badge shows count
- ✅ Notification list shows: "Produk Baru Menunggu Persetujuan"
- ✅ Click notification → Redirect ke `/admin/products`

**SQL Verification:**
```sql
-- Check all unread admin notifications
SELECT 
    id,
    title,
    message,
    type,
    is_read,
    created_at
FROM notifications
WHERE recipient_id IN (SELECT id FROM profiles WHERE role = 'ADMIN')
  AND is_read = FALSE
ORDER BY created_at DESC;
```

**Code Flow:**
```typescript
// Frontend: admin/dashboard
const { data: notifications } = await supabase
  .from('notifications')
  .select('*')
  .eq('recipient_id', adminUserId)
  .eq('is_read', false)
  .order('created_at', { ascending: false })
```

---

### **PHASE 3: Admin Approves Product** ✅

**Action:**
1. Masih di `/admin/products`
2. Filter **"PENDING"** products
3. Click produk "Biskuit Kelapa Original"
4. Review details
5. Klik **"Approve"**

**Expected Result:**
- ✅ Product `status` changed to `'APPROVED'`
- ✅ Product now visible untuk customer
- ✅ Supplier **tidak** otomatis dapat notifikasi (by design)

**SQL Verification:**
```sql
-- Check product approved
SELECT id, name, status, updated_at
FROM products
WHERE name = 'Biskuit Kelapa Original';

-- Should return: status = 'APPROVED'
```

**Code Flow:**
```typescript
// Frontend: admin/products/page.tsx
async function updateStatus(productId: string, status: 'APPROVED' | 'REJECTED') {
  const { error } = await supabase
    .from('products')
    .update({ 
      status, 
      updated_at: new Date().toISOString() 
    })
    .eq('id', productId)
}
```

**⚠️ CRITICAL**: Product approved **BELUM MUNCUL** di customer dashboard sampai:
- Supplier set inventory di location outlet

---

### **PHASE 4: Supplier Set Inventory to Location** 📦

**Action:**
1. Login sebagai Supplier
2. Buka `/supplier/inventory`
3. Click **"+ Add Inventory"**
4. Select:
   - Product: "Biskuit Kelapa Original"
   - Location: "Outlet Lobby A"
   - Quantity: 50
5. Klik **"Save"**

**Expected Result:**
- ✅ Record created di `inventory_levels` table
- ✅ Product **NOW visible** di customer kantin dashboard
- ✅ Stock = 50 di location tersebut

**SQL Verification:**
```sql
-- Check inventory created
SELECT 
    il.id,
    p.name as product_name,
    l.name as location_name,
    il.quantity,
    il.last_updated
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
WHERE p.name = 'Biskuit Kelapa Original';

-- Should return: quantity = 50, location = 'Outlet Lobby A'
```

**Code Flow:**
```typescript
// Frontend: supplier/inventory/page.tsx
const { error } = await supabase
  .from('inventory_levels')
  .insert({
    product_id: selectedProduct,
    location_id: selectedLocation,
    quantity: quantity
  })

// Or UPDATE if exists
.upsert({
  product_id, location_id, quantity
}, { 
  onConflict: 'product_id,location_id' 
})
```

---

### **PHASE 5: Customer Sees Product** 👀

**Action:**
1. Buka (anonymous/no login): `https://platform-konsinyasi-v1.vercel.app/kantin/outlet_lobby_a`
2. Check product list

**Expected Result:**
- ✅ "Biskuit Kelapa Original" **muncul** di dashboard
- ✅ Price: Rp 15.000
- ✅ Stock: 50
- ✅ Supplier name displayed
- ✅ Category auto-detected (🍪 Kue Kering)

**SQL Verification:**
```sql
-- Simulate RPC call (same as customer dashboard)
SELECT * FROM get_products_by_location('outlet_lobby_a');

-- Should include: Biskuit Kelapa Original with quantity 50
```

**Code Flow:**
```typescript
// Frontend: kantin/[slug]/page.tsx
const { data, error } = await supabase
  .rpc('get_products_by_location', { 
    qr_code_input: 'outlet_lobby_a' 
  })

// Backend: backend/migrations/011_kantin_checkout_function.sql
// RPC filters:
// - status = 'APPROVED'
// - quantity > 0
// - location.is_active = TRUE
```

**⚠️ IMPORTANT**: RPC `get_products_by_location()` hanya return products yang:
1. ✅ `products.status = 'APPROVED'`
2. ✅ `inventory_levels.quantity > 0`
3. ✅ `locations.qr_code = 'outlet_lobby_a'`
4. ✅ `locations.is_active = TRUE`

---

### **PHASE 6: Customer Buys Product** 🛒

**Action:**
1. Di kantin dashboard, click **"🛒 Tambah"** pada "Biskuit Kelapa Original"
2. Quantity di cart = 1
3. Click floating cart button di bottom
4. Click **"Lanjut ke Pembayaran"**
5. Review checkout page
6. Click **"Lanjut ke Pembayaran"** (process_anonymous_checkout)
7. QRIS image muncul
8. Click **"Sudah Bayar"** (confirm_payment)
9. Redirect ke success page

**Expected Result:**
- ✅ Transaction created di `sales_transactions` with `status = 'PENDING'`
- ✅ Transaction items created di `sales_transaction_items`
- ✅ **Inventory decreased**: Stock 50 → 49
- ✅ After confirm: `status = 'PENDING'` → `'COMPLETED'`

**SQL Verification:**
```sql
-- Check transaction created
SELECT 
    id,
    transaction_code,
    location_id,
    total_amount,
    status,
    created_at
FROM sales_transactions
ORDER BY created_at DESC
LIMIT 1;

-- Check transaction items
SELECT 
    sti.id,
    p.name as product_name,
    sti.quantity,
    sti.unit_price,
    sti.subtotal
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
WHERE sti.transaction_id = '<transaction_id_from_above>';

-- Check inventory decreased
SELECT 
    p.name,
    l.name as location,
    il.quantity
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
WHERE p.name = 'Biskuit Kelapa Original'
  AND l.qr_code = 'outlet_lobby_a';

-- Should return: quantity = 49 (decreased by 1)
```

**Code Flow:**
```typescript
// Frontend: kantin/[slug]/checkout/page.tsx

// Step 1: Process checkout
const { data } = await supabase
  .rpc('process_anonymous_checkout', {
    p_location_slug: 'outlet_lobby_a',
    p_items: [
      { product_id: '...', quantity: 1, unit_price: 15000 }
    ]
  })

// Backend: backend/migrations/011_kantin_checkout_function.sql
// This function:
// 1. Creates transaction (status=PENDING)
// 2. Creates transaction items
// 3. DECREASES inventory_levels.quantity
// 4. Returns QRIS data

// Step 2: Confirm payment
const { data } = await supabase
  .rpc('confirm_payment', {
    p_transaction_id: transactionId
  })

// Backend: backend/migrations/012_confirm_payment_function.sql
// This function:
// 1. Updates status PENDING → COMPLETED
```

---

## 🔍 Complete Synchronization Verification

### Test Scenario: Full Flow in 10 Minutes

**Setup:**
- 1 Admin account
- 1 Supplier account
- 1 Location: "Outlet Lobby A" (qr_code: `outlet_lobby_a`)

**Steps:**

```
┌─────────────────────────────────────────────────────────────┐
│ TIME  │ WHO      │ ACTION                  │ RESULT          │
├─────────────────────────────────────────────────────────────┤
│ 00:00 │ Supplier │ Create product          │ PENDING         │
│ 00:10 │ System   │ Trigger notification    │ Admin notified  │
│ 00:20 │ Admin    │ Check notification      │ See alert       │
│ 00:30 │ Admin    │ Approve product         │ APPROVED        │
│ 01:00 │ Supplier │ Add inventory (qty=50)  │ Stock set       │
│ 02:00 │ Customer │ Open kantin dashboard   │ Product visible │
│ 02:30 │ Customer │ Add to cart (qty=1)     │ Cart updated    │
│ 03:00 │ Customer │ Checkout                │ Transaction     │
│ 03:10 │ System   │ Decrease inventory      │ Stock = 49      │
│ 03:20 │ Customer │ Confirm payment         │ COMPLETED       │
│ 04:00 │ Verify   │ Check all tables        │ All synced ✅   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Testing SQL Queries (Copy-Paste Ready)

### 1. Check Complete Product Flow
```sql
-- Product status progression
SELECT 
    p.name,
    p.status,
    p.created_at,
    p.updated_at,
    s.business_name as supplier,
    COUNT(DISTINCT il.id) as inventory_locations
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
LEFT JOIN inventory_levels il ON il.product_id = p.id
WHERE p.name LIKE '%Biskuit%'
GROUP BY p.id, p.name, p.status, p.created_at, p.updated_at, s.business_name
ORDER BY p.created_at DESC;
```

### 2. Check Notification Flow
```sql
-- All notifications for product approval
SELECT 
    n.created_at,
    n.title,
    n.message,
    n.type,
    n.is_read,
    p.full_name as recipient,
    p.role
FROM notifications n
JOIN profiles p ON p.id = n.recipient_id
WHERE n.type IN ('PRODUCT_APPROVAL', 'PRODUCT_STATUS_CHANGE')
ORDER BY n.created_at DESC
LIMIT 20;
```

### 3. Check Inventory Sync
```sql
-- Current inventory for all products at outlet
SELECT 
    p.name as product,
    l.name as location,
    il.quantity as stock,
    p.status,
    s.business_name as supplier
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
JOIN suppliers s ON s.id = p.supplier_id
WHERE l.qr_code = 'outlet_lobby_a'
  AND il.quantity > 0
ORDER BY p.name;
```

### 4. Check Customer View (RPC Simulation)
```sql
-- What customer sees at outlet_lobby_a
SELECT * FROM get_products_by_location('outlet_lobby_a');
```

### 5. Check Transaction Flow
```sql
-- Recent transactions with items
SELECT 
    st.transaction_code,
    st.total_amount,
    st.status,
    st.created_at,
    l.name as location,
    COUNT(sti.id) as item_count,
    SUM(sti.quantity) as total_qty
FROM sales_transactions st
JOIN locations l ON l.id = st.location_id
LEFT JOIN sales_transaction_items sti ON sti.transaction_id = st.id
GROUP BY st.id, st.transaction_code, st.total_amount, st.status, st.created_at, l.name
ORDER BY st.created_at DESC
LIMIT 10;
```

### 6. Check Inventory Changes After Sale
```sql
-- Track inventory changes for specific product
SELECT 
    p.name,
    l.name as location,
    il.quantity as current_stock,
    il.last_updated,
    -- Calculate total sold today
    (
        SELECT COALESCE(SUM(sti.quantity), 0)
        FROM sales_transaction_items sti
        JOIN sales_transactions st ON st.id = sti.transaction_id
        WHERE sti.product_id = p.id
          AND st.location_id = l.id
          AND DATE(st.created_at) = CURRENT_DATE
          AND st.status = 'COMPLETED'
    ) as sold_today
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
WHERE p.name LIKE '%Biskuit%'
  AND l.qr_code = 'outlet_lobby_a';
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: Product Approved but Not Visible in Kantin
**Symptom:** Admin approved, tapi customer dashboard kosong

**Check:**
```sql
-- Is inventory set?
SELECT 
    p.name,
    p.status,
    il.quantity,
    il.location_id
FROM products p
LEFT JOIN inventory_levels il ON il.product_id = p.id
WHERE p.name = 'Biskuit Kelapa Original';
```

**Solution:**
- Supplier must add inventory to location
- Go to `/supplier/inventory` → Add inventory

---

### Issue 2: Notification Not Received
**Symptom:** Admin tidak dapat notif saat supplier submit produk

**Check:**
```sql
-- Check trigger exists
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_notify_new_product';

-- Check function exists
SELECT proname FROM pg_proc 
WHERE proname = 'notify_new_product';
```

**Solution:**
- Re-run migration: `backend/migrations/007_functions.sql`

---

### Issue 3: Inventory Not Decreasing
**Symptom:** Customer checkout tapi stock tidak berkurang

**Check:**
```sql
-- Check if process_anonymous_checkout updates inventory
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
WHERE p.proname = 'process_anonymous_checkout';
```

**Expected:** Function should have:
```sql
UPDATE inventory_levels
SET quantity = quantity - item_quantity
WHERE product_id = ... AND location_id = ...;
```

**Solution:**
- Re-run migration: `backend/migrations/011_kantin_checkout_function.sql`

---

### Issue 4: RLS Blocking Anonymous Access
**Symptom:** Customer dashboard error: "permission denied for table products"

**Check:**
```sql
-- Check anon policies exist
SELECT 
    tablename, 
    policyname, 
    roles, 
    cmd
FROM pg_policies
WHERE tablename IN ('products', 'inventory_levels', 'locations')
  AND roles @> ARRAY['anon'];
```

**Solution:**
- Re-run migration: `backend/migrations/010_anonymous_checkout_rls.sql`

---

## 📊 Success Metrics

After full flow test, verify:

- ✅ **Product Creation**: Supplier can create → Status PENDING
- ✅ **Notification**: Admin receives notification within 1 second
- ✅ **Approval**: Admin can approve → Status APPROVED
- ✅ **Inventory**: Supplier can set stock per location
- ✅ **Visibility**: Customer sees ONLY approved products with stock > 0
- ✅ **Purchase**: Customer can checkout anonymously
- ✅ **Stock Update**: Inventory decreases immediately after checkout
- ✅ **Transaction**: Status PENDING → COMPLETED after payment confirm
- ✅ **Receipt**: Customer gets transaction code & can view success page

---

## 🎯 Full Synchronization Confirmed

**All flows connected:**

```
┌──────────────┐
│   SUPPLIER   │
│  (Create)    │
└──────┬───────┘
       │ INSERT products
       ▼
┌──────────────┐
│   TRIGGER    │
│notify_new_   │
│  product()   │
└──────┬───────┘
       │ INSERT notifications
       ▼
┌──────────────┐
│    ADMIN     │
│  (Approve)   │
└──────┬───────┘
       │ UPDATE products.status
       ▼
┌──────────────┐
│   SUPPLIER   │
│(Add Inventory)│
└──────┬───────┘
       │ INSERT inventory_levels
       ▼
┌──────────────┐
│   CUSTOMER   │
│  (View RPC)  │
└──────┬───────┘
       │ get_products_by_location()
       ▼
┌──────────────┐
│   CUSTOMER   │
│ (Checkout)   │
└──────┬───────┘
       │ process_anonymous_checkout()
       │ → UPDATE inventory_levels
       ▼
┌──────────────┐
│   CUSTOMER   │
│  (Confirm)   │
└──────┬───────┘
       │ confirm_payment()
       │ → UPDATE sales_transactions.status
       ▼
     ✅ DONE
```

**All synchronized!** ✨

---

## 🚀 Ready for Production Testing

Next action: Run complete test dengan data real!
