# 🔍 Debug: Produk Approved Tidak Muncul di Dashboard

## ✅ Progress So Far:
- ✅ RPC function `get_products_by_location` sudah jalan (no error toast)
- ❌ Products tidak muncul di dashboard customer

---

## 🔧 Debug Steps - Execute di Supabase SQL Editor:

### Step 1: Check Products Status
```sql
-- Cek produk yang sudah APPROVED
SELECT 
    p.id,
    p.name,
    p.status,
    p.price,
    s.business_name as supplier,
    p.created_at
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
WHERE s.business_name = 'Kue Basah'
ORDER BY p.created_at DESC;
```

**Expected:** Harus ada 2 produk dengan `status = 'APPROVED'`

---

### Step 2: Check Inventory Exists
```sql
-- Cek apakah inventory sudah di-set
SELECT 
    p.name as product_name,
    il.quantity,
    il.location_id,
    COALESCE(l.name, '❌ NO LOCATION') as location_name,
    COALESCE(l.qr_code, '❌ NO QR CODE') as qr_code,
    l.is_active,
    l.type
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
LEFT JOIN inventory_levels il ON il.product_id = p.id
LEFT JOIN locations l ON l.id = il.location_id
WHERE s.business_name = 'Kue Basah'
ORDER BY p.name;
```

**Check for:**
- ❌ `inventory_levels` = NULL → **Supplier belum set inventory**
- ❌ `location_name` = '❌ NO LOCATION' → **Location invalid**
- ❌ `quantity` = 0 → **Stock habis**
- ❌ `is_active` = FALSE → **Location tidak aktif**
- ❌ `type` != 'OUTLET' → **Bukan outlet**

---

### Step 3: Check Location 'outlet_lobby_a'
```sql
-- Cek location yang kita cari ada dan aktif
SELECT 
    id,
    name,
    qr_code,
    type,
    is_active,
    address
FROM locations
WHERE qr_code = 'outlet_lobby_a';
```

**Expected:** 
- ✅ Must return 1 row
- ✅ `is_active = TRUE`
- ✅ `type = 'OUTLET'`

---

### Step 4: Simulate Customer View (Test RPC)
```sql
-- Ini yang dipanggil customer dashboard
SELECT * FROM get_products_by_location('outlet_lobby_a');
```

**Expected:** Harus return 2 rows (kedua produk)

**If returns 0 rows** → Ada filter yang tidak terpenuhi!

---

### Step 5: Debug Filter Satu-Satu
```sql
-- Check 1: Products APPROVED?
SELECT COUNT(*) as approved_count
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
WHERE s.business_name = 'Kue Basah'
  AND p.status = 'APPROVED';
-- Expected: 2

-- Check 2: Inventory exists?
SELECT COUNT(*) as inventory_count
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
JOIN inventory_levels il ON il.product_id = p.id
WHERE s.business_name = 'Kue Basah';
-- Expected: 2

-- Check 3: Inventory quantity > 0?
SELECT COUNT(*) as with_stock
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
JOIN inventory_levels il ON il.product_id = p.id
WHERE s.business_name = 'Kue Basah'
  AND il.quantity > 0;
-- Expected: 2

-- Check 4: Location match?
SELECT COUNT(*) as location_match
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
JOIN inventory_levels il ON il.product_id = p.id
JOIN locations l ON l.id = il.location_id
WHERE s.business_name = 'Kue Basah'
  AND l.qr_code = 'outlet_lobby_a';
-- Expected: 2

-- Check 5: Location active?
SELECT COUNT(*) as location_active
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
JOIN inventory_levels il ON il.product_id = p.id
JOIN locations l ON l.id = il.location_id
WHERE s.business_name = 'Kue Basah'
  AND l.qr_code = 'outlet_lobby_a'
  AND l.is_active = TRUE;
-- Expected: 2

-- Check 6: Location type OUTLET?
SELECT COUNT(*) as is_outlet
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
JOIN inventory_levels il ON il.product_id = p.id
JOIN locations l ON l.id = il.location_id
WHERE s.business_name = 'Kue Basah'
  AND l.qr_code = 'outlet_lobby_a'
  AND l.type = 'OUTLET';
-- Expected: 2
```

**Identify which check returns 0** → That's the problem!

---

## 🔧 Quick Fixes Based on Results:

### Fix 1: If inventory doesn't exist (Check 2 = 0)
```sql
-- Get valid location ID
SELECT id FROM locations WHERE qr_code = 'outlet_lobby_a';
-- Copy the ID

-- Manual insert inventory (replace <LOCATION_ID> and <PRODUCT_ID>)
INSERT INTO inventory_levels (product_id, location_id, quantity)
SELECT 
    p.id,
    '<LOCATION_ID>'::uuid,
    10  -- Default quantity
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
WHERE s.business_name = 'Kue Basah'
ON CONFLICT (product_id, location_id) 
DO UPDATE SET quantity = EXCLUDED.quantity;
```

**Better way - Use supplier inventory page:**
1. Login supplier
2. Go to `/supplier/inventory`
3. Click "+ Add Inventory"
4. Set each product → Location: "Outlet Lobby A" → Quantity

---

### Fix 2: If location_id NULL or invalid (Check 4 = 0)
```sql
-- Fix inventory location
UPDATE inventory_levels
SET location_id = (
    SELECT id FROM locations 
    WHERE qr_code = 'outlet_lobby_a' 
    LIMIT 1
)
WHERE product_id IN (
    SELECT p.id FROM products p
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE s.business_name = 'Kue Basah'
);
```

---

### Fix 3: If quantity = 0 (Check 3 = 0)
```sql
-- Update quantity
UPDATE inventory_levels
SET quantity = 10
WHERE product_id IN (
    SELECT p.id FROM products p
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE s.business_name = 'Kue Basah'
)
AND quantity = 0;
```

---

## 🎯 Most Likely Issue:

Based on the shipments screenshot showing "Unknown Location", the problem is probably:

**Inventory tidak punya valid location_id**

Run this fix:
```sql
-- Comprehensive fix for "Kue Basah" products
WITH valid_location AS (
    SELECT id FROM locations 
    WHERE qr_code = 'outlet_lobby_a' 
      AND is_active = TRUE 
      AND type = 'OUTLET'
    LIMIT 1
),
kue_basah_products AS (
    SELECT p.id FROM products p
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE s.business_name = 'Kue Basah'
      AND p.status = 'APPROVED'
)
-- Update or insert inventory
INSERT INTO inventory_levels (product_id, location_id, quantity)
SELECT 
    kbp.id,
    vl.id,
    GREATEST(COALESCE(il.quantity, 10), 10)  -- Min 10 unit
FROM kue_basah_products kbp
CROSS JOIN valid_location vl
LEFT JOIN inventory_levels il ON il.product_id = kbp.id
ON CONFLICT (product_id, location_id) 
DO UPDATE SET 
    quantity = GREATEST(inventory_levels.quantity, 10),
    updated_at = NOW();

-- Verify
SELECT 
    p.name,
    l.name as location,
    il.quantity
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
WHERE p.id IN (SELECT id FROM kue_basah_products);
```

---

## ✅ After Fix - Test Again:

```sql
-- Final verification
SELECT * FROM get_products_by_location('outlet_lobby_a');
```

Should return your products!

Then open: `https://platform-konsinyasi-v1.vercel.app/kantin/outlet_lobby_a`

Products should be visible! 🎉
