# 🔍 TROUBLESHOOTING: Supplier Shipment Tidak Muncul di Admin

**Problem:** Supplier sudah kirim produk, tapi tidak muncul di halaman Admin → Suppliers → Pengiriman & Retur

---

## ⚠️ KEMUNGKINAN ROOT CAUSE

### **1. Produk Belum Approved (MOST LIKELY)**
Supplier hanya bisa kirim produk yang **statusnya APPROVED**.

**Cek:**
```sql
SELECT id, name, sku, status, supplier_id
FROM products
WHERE status = 'PENDING'
ORDER BY created_at DESC;
```

**Fix:** Admin harus approve produk dulu di menu **Suppliers → Produk Management**

---

### **2. Stock Movement Tidak Tercreate**
Supplier gagal create stock movement saat submit form.

**Cek:**
```sql
SELECT * FROM stock_movements 
ORDER BY created_at DESC 
LIMIT 10;
```

**Jika kosong:** Ada error di flow supplier. Cek console browser supplier.

**Fix:** Supplier harus submit ulang pengiriman.

---

### **3. RLS Policy Blocking Admin**
Admin tidak punya akses read ke `stock_movements`.

**Cek Policy:**
```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'stock_movements';
```

**Expected:** Harus ada policy:
- `SELECT` untuk `ADMIN` role
- `qual` atau `with_check` allow admin access

**Fix:** Run `database/fix-shipments-rls.sql` (lihat dibawah)

---

### **4. Foreign Key Issue**
`supplier_id` atau `location_id` di stock_movements tidak valid.

**Cek:**
```sql
SELECT 
  sm.id,
  sm.supplier_id,
  sm.location_id,
  s.business_name,
  l.name as location_name
FROM stock_movements sm
LEFT JOIN suppliers s ON s.id = sm.supplier_id
LEFT JOIN locations l ON l.id = sm.location_id
WHERE s.id IS NULL OR l.id IS NULL;
```

**Jika ada data:** Supplier atau location tidak exist.

---

## 🔧 STEP-BY-STEP DEBUGGING

### **STEP 1: Jalankan Diagnostic Query**
Di Supabase SQL Editor, run file:
```
database/debug-shipments-flow.sql
```

Hasil akan tunjukkan:
- ✅ Berapa stock movements yang ada
- ✅ Berapa yang PENDING vs APPROVED
- ✅ Apakah products sudah APPROVED
- ✅ Apakah RLS policies correct

---

### **STEP 2: Cek Console Browser**

**Di Halaman Admin (Pengiriman & Retur):**
1. Buka Chrome DevTools (F12)
2. Tab **Console**
3. Cari error:
   - "RLS policy violation"
   - "permission denied"
   - "Failed to fetch"

**Di Halaman Supplier (Kirim Produk):**
1. Submit pengiriman baru
2. Cek console untuk error
3. Cek Network tab untuk failed requests

---

### **STEP 3: Verify Flow End-to-End**

**A. Cek Produk Supplier Approved:**
```sql
SELECT 
  p.id,
  p.name,
  p.status,
  s.business_name
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
WHERE s.business_name = 'NAMA_SUPPLIER_KAMU'
ORDER BY p.created_at DESC;
```

Expected: Status = `APPROVED`

**B. Login Sebagai Supplier → Kirim Produk:**
1. Menu: Pengiriman → Kirim Produk Baru
2. Pilih produk (hanya muncul yang APPROVED)
3. Masukkan quantity
4. Pilih lokasi tujuan
5. Klik Submit

Expected: Toast "Pengajuan pengiriman berhasil!"

**C. Cek Database:**
```sql
SELECT * FROM stock_movements 
WHERE supplier_id = 'SUPPLIER_ID_KAMU'
ORDER BY created_at DESC
LIMIT 5;
```

Expected: Ada row baru dengan status `PENDING`

**D. Login Sebagai Admin:**
1. Menu: Suppliers → Pengiriman & Retur
2. Tab: Review Pengiriman

Expected: Muncul list pengiriman dengan status PENDING

---

## 🚨 QUICK FIX: RLS Policies

Jika masalahnya RLS (admin tidak bisa baca data), jalankan:

```sql
-- ===================================
-- FIX: Admin Access to Stock Movements
-- ===================================

-- Drop existing policies
DROP POLICY IF EXISTS "admin_select_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "admin_update_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "admin_select_stock_movement_items" ON stock_movement_items;

-- Allow ADMIN to SELECT all stock movements
CREATE POLICY "admin_select_stock_movements"
ON stock_movements
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Allow ADMIN to UPDATE stock movements (for approve/reject)
CREATE POLICY "admin_update_stock_movements"
ON stock_movements
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Allow ADMIN to SELECT stock movement items
CREATE POLICY "admin_select_stock_movement_items"
ON stock_movement_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Verify policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('stock_movements', 'stock_movement_items')
AND policyname LIKE '%admin%';
```

Save sebagai: `database/fix-shipments-rls.sql`

---

## ✅ EXPECTED BEHAVIOR

**Normal Flow:**
1. **Supplier:** Create produk → Status PENDING
2. **Admin:** Approve produk → Status APPROVED
3. **Supplier:** Kirim produk (hanya yg APPROVED) → Create stock movement PENDING
4. **Admin:** Lihat di "Pengiriman & Retur" → Approve/Reject
5. **System:** Update inventory jika approved

---

## 📋 CHECKLIST DEBUG

Isi checklist ini saat debugging:

- [ ] **Produk sudah APPROVED?**
  - SQL: `SELECT * FROM products WHERE status = 'APPROVED'`
  
- [ ] **Supplier bisa kirim produk?**
  - Login supplier → Menu "Kirim Produk Baru"
  - Pilih produk → Submit
  - Ada toast success?
  
- [ ] **Stock movement tercreate?**
  - SQL: `SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT 5`
  - Ada row baru?
  
- [ ] **Admin bisa query stock movements?**
  - Login admin → Menu "Pengiriman & Retur"
  - Console browser ada error?
  
- [ ] **RLS policies correct?**
  - SQL: `SELECT * FROM pg_policies WHERE tablename = 'stock_movements'`
  - Ada policy untuk ADMIN SELECT?

---

## 🎯 NEXT STEPS

**Setelah identify root cause:**

1. **Jika produk belum approved:**
   - Admin approve produk dulu
   - Supplier kirim ulang

2. **Jika RLS issue:**
   - Run `fix-shipments-rls.sql`
   - Refresh halaman admin
   - Data should appear

3. **Jika supplier form error:**
   - Cek console browser supplier
   - Fix error di `CreateShipmentTab.tsx`
   - Test ulang flow

---

**File ini:** `TROUBLESHOOTING-SHIPMENTS.md`
**Created:** 13 November 2025
**Purpose:** Debug kenapa shipments tidak muncul di admin
