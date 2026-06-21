# 🔧 Fix Guide: HTTP 500 Error pada /kantin/kantin-kejujuran

## 📋 Ringkasan Masalah

**Issue:** Halaman `/kantin/kantin-kejujuran` menampilkan HTTP 500 Internal Server Error  
**Root Cause:** Salah satu dari:
1. RPC function `get_products_by_location()` tidak exist atau belum di-deploy
2. Location `kantin-kejujuran` tidak ada di database
3. Tidak ada inventory data untuk location tersebut
4. RLS policies blocking access

---

## 🔍 DEBUGGING STEPS (WAJIB DILAKUKAN DULU)

### Step 1: Buka Supabase SQL Editor
1. Login ke Supabase Dashboard
2. Pilih project `konsinyasi`
3. Buka tab **SQL Editor**

### Step 2: Jalankan Diagnosis Queries

Copy-paste file ini ke SQL Editor:
```
database/DEBUG-KANTIN-KEJUJURAN-500.sql
```

Jalankan satu per satu dan lihat hasilnya.

---

## 🛠️ FIXES BERDASARKAN HASIL DIAGNOSIS

### ✅ FIX 1: Jika Location Tidak Ada

Jika **Step 1** query di DEBUG file **tidak return data**, jalankan:

```sql
-- Create location for Kantin Kejujuran
INSERT INTO locations (name, qr_code, type, address, is_active)
VALUES (
  'Kantin Kejujuran',
  'kantin-kejujuran',
  'OUTLET',
  'Lokasi Kantin Kejujuran',
  true
)
ON CONFLICT (qr_code) DO UPDATE 
SET is_active = true
RETURNING id, name, qr_code;
```

**Verification:**
- Query harus return 1 row dengan id baru
- Simpan `id` untuk step berikutnya

---

### ✅ FIX 2: Jika RPC Function Tidak Ada

Jika **Step 7** query tidak menemukan function, jalankan migration:

```bash
# Di terminal, navigate ke project root
cd backend

# Run migration via Supabase CLI
supabase db push

# Atau copy-paste dari file ini ke SQL Editor:
backend/migrations/024_smart_product_sorting.sql
```

**Atau manual copy function definition:**

```sql
-- Copy seluruh function dari file ini:
-- backend/migrations/024_smart_product_sorting.sql

-- Dan jalankan di SQL Editor
```

---

### ✅ FIX 3: Jika Tidak Ada Inventory Data

Jika **Step 4** query mengembalikan kosong, ada 2 pilihan:

#### Opsi A: Tambah produk baru untuk kantin

```sql
-- 1. Pertama, get location ID
SELECT id FROM locations WHERE qr_code = 'kantin-kejujuran' LIMIT 1;
-- Catat ID ini → misalnya: 'loc-123-456-789'

-- 2. Get supplier ID (gunakan supplier existing)
SELECT id, business_name FROM suppliers WHERE status = 'APPROVED' LIMIT 1;
-- Catat ID ini → misalnya: 'sup-123-456-789'

-- 3. Create product
INSERT INTO products (name, description, price, supplier_id, status, barcode)
VALUES (
  'Kue Lezat',
  'Kue lezat dari toko',
  50000,
  'sup-123-456-789',  -- Replace dengan supplier ID dari step 2
  'APPROVED',
  'BARCODE001'
)
RETURNING id;
-- Catat product ID → misalnya: 'prod-123-456-789'

-- 4. Create inventory level
INSERT INTO inventory_levels (product_id, location_id, quantity)
VALUES (
  'prod-123-456-789',  -- Replace dengan product ID dari step 3
  'loc-123-456-789',   -- Replace dengan location ID dari step 1
  10  -- Quantity
)
RETURNING id;
```

#### Opsi B: Copy existing inventory ke kantin-kejujuran

```sql
-- Get location IDs
SELECT id, qr_code FROM locations WHERE type = 'OUTLET' ORDER BY qr_code;

-- Misalkan:
-- 'outlet_lobby_a' = loc-111-111-111
-- 'kantin-kejujuran' = loc-222-222-222

-- Copy inventory dari outlet_lobby_a ke kantin-kejujuran
INSERT INTO inventory_levels (product_id, location_id, quantity)
SELECT 
  il.product_id,
  'loc-222-222-222',  -- kantin-kejujuran location ID
  il.quantity
FROM inventory_levels il
WHERE il.location_id = 'loc-111-111-111'  -- outlet_lobby_a
  AND NOT EXISTS (
    SELECT 1 FROM inventory_levels il2
    WHERE il2.product_id = il.product_id
      AND il2.location_id = 'loc-222-222-222'
  );
```

---

### ✅ FIX 4: Jika Permission Error

Jika **Step 8 atau 9** menunjukkan RLS policy issue, jalankan:

```sql
-- Grant EXECUTE permission
GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO authenticated;

-- Verify
SELECT 
    grantee,
    privilege_type,
    routine_name
FROM role_routine_grants
WHERE routine_name = 'get_products_by_location';
```

---

## 🧪 VERIFICATION STEPS

Setelah menjalankan fix, lakukan verification:

### V1: Test RPC function di SQL Editor

```sql
-- Test dengan location
SELECT * FROM get_products_by_location('kantin-kejujuran');

-- Harus return minimal 1 product dengan columns:
-- product_id | name | description | photo_url | price | quantity | barcode | supplier_name | ...
```

**Expected Result:**
- ✅ Rows returned (jumlah > 0)
- ❌ No rows returned = masalah inventory
- ❌ Error = masalah permission atau function

---

### V2: Test di Frontend

1. **Clear browser cache:**
   - Buka DevTools (F12)
   - Application → Cache → Clear All

2. **Hard refresh page:**
   - `Ctrl+Shift+R` (Windows)
   - Atau buka URL: `https://platform-konsinyasi.vercel.app/kantin/kantin-kejujuran`

3. **Check browser console:**
   - F12 → Console tab
   - Lihat log messages:
     - ✅ `🔍 Loading products for location: kantin-kejujuran`
     - ✅ `✅ Location found: Kantin Kejujuran`
     - ✅ `📦 Calling RPC: get_products_by_location`
     - ✅ `✅ RPC successful, products returned: X`

4. **Expected page behavior:**
   - ✅ Loading spinner hilang
   - ✅ Produk ditampilkan dengan harga & foto
   - ✅ Bisa add to cart
   - ✅ Bisa checkout

---

## 🚀 NEXT STEPS JIKA MASIH ERROR

Jika setelah semua fix masih 500 error:

1. **Check Supabase Logs:**
   - Dashboard → Monitoring → Logs
   - Filter RPC calls
   - Lihat error detail dari function execution

2. **Check Frontend Logs:**
   - Browser DevTools → Console
   - Copy-paste error messages
   - Lihat stack trace

3. **Test Manual Query:**
   ```sql
   -- Test WITHOUT RPC, direct query
   SELECT 
       p.id as product_id,
       p.name,
       p.price,
       il.quantity
   FROM products p
   JOIN inventory_levels il ON il.product_id = p.id
   JOIN locations l ON l.id = il.location_id
   WHERE l.qr_code = 'kantin-kejujuran'
     AND p.status = 'APPROVED'
     AND l.is_active = TRUE
     AND l.type = 'OUTLET';
   ```
   
   Jika query ini return data tapi RPC tidak, maka issue di RPC function.

4. **Redeploy migrations:**
   ```bash
   cd backend
   supabase db pull  # Get latest schema
   supabase db push  # Push all migrations
   ```

---

## 📊 DATABASE SCHEMA CHECK

Pastikan schema ini exist:

### Tables:
- ✅ `locations` - dengan columns: id, name, qr_code, type, is_active
- ✅ `products` - dengan columns: id, name, price, supplier_id, status
- ✅ `inventory_levels` - dengan columns: product_id, location_id, quantity
- ✅ `suppliers` - dengan columns: id, business_name, status

### Function:
- ✅ `get_products_by_location(TEXT)` - return TABLE (product_id, name, ...)

### Permissions:
- ✅ GRANT EXECUTE untuk anon & authenticated roles

---

## 💡 TIPS

1. **Nama location CASE SENSITIVE:**
   - Query: `qr_code = 'kantin-kejujuran'` (lowercase)
   - **NOT** `'Kantin-Kejujuran'` atau `'KANTIN_KEJUJURAN'`

2. **Location type HARUS 'OUTLET':**
   - RPC filter: `WHERE l.type = 'OUTLET'`
   - Location dengan type lain tidak akan muncul

3. **Produk HARUS 'APPROVED':**
   - Status: 'PENDING' atau 'REJECTED' tidak muncul
   - Admin harus approve product dulu

4. **Inventory HARUS exist:**
   - Trigger auto-create inventory saat supplier submit produk
   - Tapi quantity awal = 0
   - Supplier harus update stock di inventory management

---

## ✅ SUCCESS CRITERIA

Ketika semua fixed:
- ✅ RPC returns products tanpa error
- ✅ Halaman load dengan produk visible
- ✅ HTTP 500 diganti dengan UI normal
- ✅ Cart functionality bekerja
- ✅ Checkout bisa dilakukan
- ✅ Sales transaction tercatat

---

## 📞 CONTACT & SUPPORT

Jika masih stuck, collect informasi ini:
1. Screenshot error dari browser console
2. Hasil dari `SELECT * FROM get_products_by_location('kantin-kejujuran');`
3. Hasil dari `SELECT * FROM locations;`
4. Versi migration yang terakhir dijalankan

---

**Last Updated:** 2026-03-27  
**Created For:** Platform Konsinyasi Team
