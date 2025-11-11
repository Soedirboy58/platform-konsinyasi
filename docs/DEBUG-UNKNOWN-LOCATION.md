# 🔍 Debug: Product Tidak Muncul di Dashboard Customer

## ❌ Problem Identified:

Dari screenshot admin shipments:
- ✅ Produk 1: **Outlet Lobby A** - 10 unit - APPROVED → **AKAN MUNCUL**
- ❌ Produk 2: **Unknown Location** - 15 unit - APPROVED → **TIDAK AKAN MUNCUL**

---

## 🎯 Root Cause:

RPC `get_products_by_location()` memiliki filter:
```sql
WHERE l.qr_code = location_qr_code
  AND il.quantity > 0
  AND p.status = 'APPROVED'
  AND l.is_active = TRUE
  AND l.type = 'OUTLET'
```

**"Unknown Location"** = `location_id` di `inventory_levels` tidak match dengan location manapun, atau:
- Location tidak punya `qr_code` yang valid
- Location `is_active = FALSE`
- Location `type != 'OUTLET'`

---

## 🔧 Quick Fix - Execute in Supabase SQL Editor:

### Step 1: Check Current Inventory Data
```sql
-- Cek inventory yang bermasalah
SELECT 
    il.id as inventory_id,
    p.name as product_name,
    il.quantity,
    il.location_id,
    l.name as location_name,
    l.qr_code,
    l.is_active,
    l.type
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
LEFT JOIN locations l ON l.id = il.location_id
WHERE p.supplier_id IN (
    SELECT id FROM suppliers WHERE business_name = 'Kue Basah'
)
ORDER BY il.created_at DESC;
```

**Expected Output:**
- Row dengan `location_name = NULL` atau `qr_code = NULL` → **Masalahnya di sini!**

---

### Step 2: Get Valid Outlet Location ID
```sql
-- Cek location "Outlet Lobby A"
SELECT 
    id,
    name,
    qr_code,
    type,
    is_active
FROM locations
WHERE qr_code = 'outlet_lobby_a'
  OR name ILIKE '%outlet%lobby%';
```

**Copy `id` dari result ini** (contoh: `abc123-def456-...`)

---

### Step 3: Fix Inventory Location (AUTO LOOKUP - NO MANUAL UUID!)

**COPY-PASTE INI (No need to replace anything!):**
```sql
-- Fix inventory yang 15 unit ke Outlet Lobby A (AUTO LOOKUP)
UPDATE inventory_levels
SET
  location_id = (
    SELECT id 
    FROM locations 
    WHERE qr_code = 'outlet_lobby_a' 
      AND type = 'OUTLET'
      AND is_active = TRUE
    LIMIT 1
  ),
  updated_at = NOW()
WHERE id IN (
  SELECT il.id
  FROM inventory_levels il
  JOIN products p ON p.id = il.product_id
  WHERE p.supplier_id IN (
    SELECT id FROM suppliers WHERE business_name = 'Kue Basah'
  )
  AND il.quantity = 15
  AND (il.location_id IS NULL OR il.location_id NOT IN (
    SELECT id FROM locations WHERE is_active = TRUE
  ))
);

-- Verify fix
SELECT 
    p.name as product_name,
    l.name as location_name,
    l.qr_code,
    il.quantity,
    p.status
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
WHERE p.supplier_id IN (
    SELECT id FROM suppliers WHERE business_name = 'Kue Basah'
)
ORDER BY p.name;
```

**Expected:** Kedua produk sekarang punya `location_name = 'Outlet Lobby A'`

**Alternative - Fix ALL invalid inventory from this supplier:**
```sql
-- Update SEMUA inventory dari "Kue Basah" yang location-nya NULL/invalid
UPDATE inventory_levels
SET
  location_id = (
    SELECT id 
    FROM locations 
    WHERE qr_code = 'outlet_lobby_a' 
    LIMIT 1
  ),
  updated_at = NOW()
WHERE product_id IN (
  SELECT p.id 
  FROM products p
  JOIN suppliers s ON s.id = p.supplier_id
  WHERE s.business_name = 'Kue Basah'
)
AND (
  location_id IS NULL 
  OR location_id NOT IN (SELECT id FROM locations WHERE is_active = TRUE)
);
```

---

### Step 4: Test Customer Dashboard
```sql
-- Simulate customer view
SELECT * FROM get_products_by_location('outlet_lobby_a');
```

**Expected Output:**
```
product_id | name      | price | available_quantity | supplier_name
-----------|-----------|-------|-------------------|---------------
...        | (prod 1)  | ...   | 10                | Kue Basah
...        | (prod 2)  | ...   | 15                | Kue Basah
```

**Jika muncul 2 rows** → ✅ **FIXED!**

---

## 🌐 Test di Browser:

Setelah fix SQL, buka:
```
https://platform-konsinyasi-v1.vercel.app/kantin/outlet_lobby_a
```

**Expected:**
- ✅ Lihat 2 produk dari supplier "Kue Basah"
- ✅ Stock 10 unit dan 15 unit
- ✅ Bisa add to cart

---

## 🛠️ Prevention (Optional):

Tambahkan validation di frontend supplier inventory form:

### File: `frontend/src/app/supplier/inventory/page.tsx`

Find function `handleSubmit` dan tambahkan validation:

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  
  // ADD THIS VALIDATION:
  if (!selectedLocation) {
    toast.error('Pilih lokasi outlet terlebih dahulu!')
    return
  }
  
  // Verify location is active outlet
  const { data: locationCheck } = await supabase
    .from('locations')
    .select('id, type, is_active')
    .eq('id', selectedLocation)
    .single()
  
  if (!locationCheck) {
    toast.error('Location tidak valid!')
    return
  }
  
  if (locationCheck.type !== 'OUTLET') {
    toast.error('Hanya bisa set inventory ke OUTLET, bukan warehouse!')
    return
  }
  
  if (!locationCheck.is_active) {
    toast.error('Location tidak aktif!')
    return
  }
  
  // Continue with existing code...
  const { error } = await supabase
    .from('inventory_levels')
    .upsert({
      product_id: selectedProduct,
      location_id: selectedLocation,
      quantity: quantity
    })
  // ... rest of code
}
```

---

## 📊 Summary:

**Problem:** Inventory ke-2 (15 unit) tidak punya valid `location_id`

**Solution:** Update `inventory_levels.location_id` ke Outlet Lobby A yang valid

**Verification:** Query `get_products_by_location('outlet_lobby_a')` harus return 2 products

**Next:** Test di customer dashboard - kedua produk harus muncul! ✅
