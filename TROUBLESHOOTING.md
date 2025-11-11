# 🔍 TROUBLESHOOTING - Products & Locations Tidak Muncul

## ❌ MASALAH:
Dropdown "Pilih Produk" dan "Pilih Lokasi" masih kosong setelah run `fix-all-rls.sql`

---

## 🎯 LANGKAH TROUBLESHOOTING

### **Step 1: Diagnostic Check**

Jalankan file ini di Supabase SQL Editor:
```
database/test-rls-diagnostic.sql
```

**Hasil yang diharapkan:**
- ✅ RLS policies muncul (minimal 2-3 policies per table)
- ✅ Locations table punya minimal 1 row
- ✅ Current user punya profile dengan role
- ✅ Count queries return angka (bukan 0 atau error)

**Jika GAGAL:**
Lanjut ke Step 2

---

### **Step 2: Try Simple RLS (Development)**

File `fix-all-rls.sql` terlalu ketat. Coba yang lebih permisif:

Jalankan file ini di Supabase SQL Editor:
```
database/fix-rls-simple.sql
```

File ini membuat **ALL authenticated users** bisa akses semua data (untuk development).

**Setelah run:**
1. Refresh browser (Ctrl + Shift + R)
2. Test dropdown lagi
3. Jika berhasil → masalahnya di RLS policy yang terlalu ketat

---

### **Step 3: Check Data Exists**

Buka Supabase Dashboard → Table Editor

**Check table `locations`:**
```sql
SELECT * FROM locations;
```

**Jika KOSONG:**
Admin harus buat lokasi dulu!

1. Login sebagai admin
2. Buka: `/admin/locations`
3. Tambah lokasi baru:
   - Name: Kantin Pusat
   - Type: OUTLET
   - Address: Jl. Test
   - is_active: TRUE

**Check table `products`:**
```sql
SELECT * FROM products WHERE status = 'APPROVED';
```

**Jika KOSONG:**
Belum ada produk yang di-approve!

1. Login sebagai supplier
2. Tambah produk
3. Login sebagai admin
4. Approve produk di `/admin/products`

---

### **Step 4: Check Browser Console**

Buka browser console (F12) dan perhatikan error:

**Error 400 - Check ini:**
```
Products query error: Object
Load products error: Object
```

**Kemungkinan penyebab:**
1. RLS policies belum jalan
2. User tidak authenticated
3. Query JOIN error

**Solusi:**
- Run `fix-rls-simple.sql`
- Logout → Login lagi
- Hard refresh (Ctrl + Shift + R)

---

### **Step 5: Manual Query Test**

Di Supabase SQL Editor, run sebagai current user:

```sql
-- Set your auth context (ganti dengan user ID Anda)
-- SELECT auth.uid(); -- Get your ID first

-- Test query products
SELECT id, name, sku 
FROM products 
WHERE status = 'APPROVED'
LIMIT 5;

-- Test query locations
SELECT id, name, type
FROM locations
WHERE is_active = TRUE
LIMIT 5;
```

**Jika return data:**
✅ RLS OK, data ada, masalah di frontend

**Jika error:**
❌ RLS masih block, run `fix-rls-simple.sql`

---

## 🔧 QUICK FIX CHECKLIST

### ✅ **Sudah Dilakukan:**
- [ ] Run `fix-all-rls.sql` di Supabase
- [ ] Bucket `product-photos` dibuat (Public = TRUE)
- [ ] Logout → Login lagi
- [ ] Hard refresh browser (Ctrl + Shift + R)

### ⏳ **Belum Dilakukan (Coba ini):**
- [ ] Run `test-rls-diagnostic.sql` → lihat hasilnya
- [ ] Run `fix-rls-simple.sql` → RLS lebih permisif
- [ ] Check locations table → harus ada minimal 1 row
- [ ] Check products table → harus ada yang APPROVED
- [ ] Test manual query di SQL Editor

---

## 📋 COMMON ISSUES

### **Issue 1: Locations kosong**
**Solusi:** Admin buat lokasi di `/admin/locations`

### **Issue 2: Products kosong**
**Solusi:** 
1. Supplier tambah produk
2. Admin approve di `/admin/products`

### **Issue 3: RLS terlalu ketat**
**Solusi:** Run `fix-rls-simple.sql` untuk development

### **Issue 4: User tidak authenticated**
**Solusi:** Logout → Login lagi → Check session

### **Issue 5: Browser cache**
**Solusi:** Hard refresh (Ctrl + Shift + R) atau incognito mode

---

## 🎯 ACTION PLAN

**DO THIS NOW:**

1. **Run diagnostic:**
   ```
   database/test-rls-diagnostic.sql
   ```
   Copy hasil ke chat

2. **Run simple RLS:**
   ```
   database/fix-rls-simple.sql
   ```

3. **Check data:**
   - Locations: Harus ada minimal 1 row
   - Products: Harus ada yang APPROVED

4. **Test lagi:**
   - Logout → Login
   - Hard refresh
   - Check dropdown

**Jika masih gagal, share screenshot:**
- Console error (F12)
- Network tab error
- SQL diagnostic result
