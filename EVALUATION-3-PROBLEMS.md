# 🔧 Evaluasi & Fix - 3 Masalah Supplier

## 📋 Problem Summary

### **Problem 1: Shipments UI - No Monitoring**
**Issue:** `/supplier/shipments/new` hanya untuk create, tidak ada history/monitoring produk yang sudah dikirim.

**User Request:** "Perlu dibuat tab switch: 1) Proses Pengiriman Produk, 2) Riwayat Pengiriman Produk"

### **Problem 2: Sales Report Not Synced**
**Issue:** Menu "Laporan Penjualan" query dari tabel `sales_transactions` yang **SALAH** (tabel lama untuk supplier-based sales, bukan kantin checkout).

**Current Code:**
```typescript
// ❌ SALAH: Query tabel lama
.from('sales_transactions')
.select('product_id, quantity, selling_price, commission_amount')
.eq('supplier_id', supplier.id)
```

**Should Be:**
```typescript
// ✅ BENAR: Query dari sales_transaction_items
.from('sales_transaction_items')
.select(`
  quantity, price, subtotal, supplier_revenue, commission_amount,
  products!inner(name, supplier_id),
  sales_transactions!inner(status, created_at, transaction_code)
`)
.eq('products.supplier_id', supplier.id)
.eq('sales_transactions.status', 'COMPLETED')
```

### **Problem 3: Inventory Update Tidak Muncul di Dashboard User**
**Issue:** User update stock produk "kue basah" di `/supplier/inventory` tapi tidak muncul di `/kantin/outlet_lobby_a`.

**Possible Causes:**
1. ❌ Inventory adjustment not approved by admin
2. ❌ Product not linked to correct location
3. ❌ RLS policy blocking anonymous read
4. ❌ Frontend cache issue

---

## ✅ Solutions

### **Solution 1: Add Shipments Page with Tabs**

**Create:** `/supplier/shipments/page.tsx` (NEW)

**Features:**
- Tab 1: "Ajukan Pengiriman Baru" (redirect to /new)
- Tab 2: "Riwayat Pengiriman" with table showing:
  - Date, Location, Status, Total Items, Total Quantity
  - Timeline component for each shipment
  - Filter by status (ALL, PENDING, APPROVED, REJECTED)
  - Search by location name

**Update:** Sidebar menu `/supplier/layout.tsx`
- Change href from `/supplier/shipments/new` → `/supplier/shipments`

---

### **Solution 2: Fix Sales Report Query**

**File:** `frontend/src/app/supplier/sales-report/page.tsx`

**Changes:**
```typescript
// OLD QUERY (WRONG):
from('sales_transactions')
  .select('product_id, quantity, selling_price, commission_amount, sale_date')
  .eq('supplier_id', supplier.id)

// NEW QUERY (CORRECT):
from('sales_transaction_items')
  .select(`
    id,
    quantity,
    price,
    subtotal,
    commission_amount,
    supplier_revenue,
    created_at,
    products!inner(id, name, supplier_id),
    sales_transactions!inner(transaction_code, status, created_at)
  `)
  .eq('products.supplier_id', supplier.id)
  .eq('sales_transactions.status', 'COMPLETED')
  .gte('sales_transactions.created_at', startDate)
  .lte('sales_transactions.created_at', endDate)
  .order('sales_transactions.created_at', { ascending: false })
```

**Updated Stats:**
- Total Sales: `SUM(quantity)`
- Total Revenue: `SUM(supplier_revenue)` (already minus commission)
- Total Commission: `SUM(commission_amount)`
- Products Sold: `COUNT(DISTINCT product_id)`

**Updated Summary (Per Product):**
```typescript
productMap.set(product_id, {
  product_name: item.products.name,
  total_quantity: SUM(quantity),
  total_revenue: SUM(supplier_revenue),
  total_commission: SUM(commission_amount),
  last_sale: MAX(created_at)
})
```

---

### **Solution 3: Debug Inventory Update Flow**

**Step-by-Step Diagnosis:**

**A. Check Inventory Adjustment Record**
```sql
-- Did user create adjustment request?
SELECT * FROM inventory_adjustments
WHERE product_id IN (
  SELECT id FROM products WHERE name LIKE '%kue basah%'
)
ORDER BY created_at DESC
LIMIT 5;

-- Expected:
-- status = 'PENDING' → Waiting admin approval
-- status = 'APPROVED' → Should update inventory
-- status = 'REJECTED' → Update failed
```

**B. Check Inventory Levels**
```sql
-- Is inventory_levels updated?
SELECT 
  p.name,
  l.name AS location_name,
  il.quantity,
  il.updated_at
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
WHERE p.name LIKE '%kue basah%'
  AND l.qr_code = 'outlet_lobby_a';

-- Expected: quantity should match user's update
```

**C. Test RPC Function**
```sql
-- Does function return updated data?
SELECT * FROM get_products_by_location('outlet_lobby_a')
WHERE name LIKE '%kue basah%';

-- Expected: quantity should show updated value
```

**D. Check Frontend Cache**
```typescript
// In browser console:
localStorage.clear()
sessionStorage.clear()
// Then refresh page
```

**Root Cause Analysis:**

**Most Likely:** ❌ **Inventory adjustment not approved by admin**

**Flow:**
```
1. Supplier: Request inventory adjustment
   ↓ status = PENDING
   
2. Admin: Must approve in /admin/inventory-adjustments
   ↓ status = APPROVED
   
3. Trigger: Update inventory_levels.quantity
   ↓ 
   
4. Customer: See updated stock
```

**Fix:** Admin must login and approve the adjustment request!

---

## 📊 Implementation Status

### **Problem 1: Shipments UI** - ⏳ IN PROGRESS
- [x] Analyze current structure
- [ ] Create `/supplier/shipments/page.tsx` with tabs
- [ ] Update sidebar menu href
- [ ] Test tab switching
- [ ] Deploy

### **Problem 2: Sales Report** - ⏳ IN PROGRESS
- [x] Identify wrong query
- [ ] Rewrite query logic
- [ ] Update stats calculation
- [ ] Update UI display
- [ ] Test with real data
- [ ] Deploy

### **Problem 3: Inventory Update** - 🔍 DIAGNOSIS REQUIRED
- [x] Identify possible causes
- [ ] User runs SQL diagnostic queries
- [ ] Identify root cause
- [ ] Apply fix (likely: admin approval)
- [ ] Test end-to-end

---

## 🚀 Action Plan

### **For Developer (Immediate):**

**1. Fix Sales Report** (15 minutes - CRITICAL)
- Rewrite `loadSalesData()` function
- Update query to use `sales_transaction_items`
- Fix stats and summary calculations
- Deploy

**2. Create Shipments Page** (30 minutes - HIGH PRIORITY)
- Create new page with tab system
- Move existing form to Tab 1
- Create history table in Tab 2
- Update sidebar menu

**3. Deploy Frontend** (2 minutes)
```bash
cd frontend
vercel --prod
```

### **For User (Diagnostic):**

**Check Inventory Issue:**

**Step 1: Open Supabase SQL Editor**
```sql
-- Query 1: Check if adjustment was created
SELECT 
  ia.id,
  ia.status,
  ia.adjustment_type,
  ia.quantity,
  ia.reason,
  ia.created_at,
  p.name AS product_name,
  l.name AS location_name
FROM inventory_adjustments ia
JOIN products p ON p.id = ia.product_id
JOIN locations l ON l.id = ia.location_id
WHERE p.name LIKE '%kue basah%'
ORDER BY ia.created_at DESC;
```

**Expected Result:**
- If empty → User did not create adjustment request
- If status='PENDING' → **Admin needs to approve**
- If status='APPROVED' → Check next query
- If status='REJECTED' → User needs to re-submit

**Step 2: If approved, check inventory**
```sql
-- Query 2: Check current inventory level
SELECT 
  p.name,
  l.name AS location_name,
  il.quantity AS current_stock,
  il.updated_at AS last_update
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
WHERE p.name LIKE '%kue basah%'
  AND l.qr_code = 'outlet_lobby_a';
```

**Expected Result:**
- `current_stock` should match what user entered
- `last_update` should be recent timestamp

**Step 3: If inventory correct, test RPC**
```sql
-- Query 3: Test customer-facing function
SELECT 
  name,
  quantity AS stock,
  price
FROM get_products_by_location('outlet_lobby_a')
WHERE name LIKE '%kue basah%';
```

**Expected Result:**
- `stock` should match inventory_levels.quantity
- If not matching → Function might be using old migration

---

## 🎯 Summary

| Problem | Severity | Status | ETA |
|---------|----------|--------|-----|
| 1. Shipments UI | Medium | In Progress | 30 min |
| 2. Sales Report | **HIGH** | In Progress | 15 min |
| 3. Inventory Update | **CRITICAL** | Needs Diagnosis | TBD |

**Most Likely Root Cause for Problem 3:**
✅ Admin has not approved the inventory adjustment request yet!

**Next Steps:**
1. Fix Sales Report query (developer)
2. Create Shipments page with tabs (developer)
3. User runs diagnostic SQL to identify inventory issue
4. Deploy fixes

**Estimated Total Time:** 45-60 minutes (excluding user diagnosis)
