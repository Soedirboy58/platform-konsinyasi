# 🚨 URGENT FIX - Sales Report Error

## Root Cause
Kolom `commission_amount` dan `supplier_revenue` **belum ada** di database → Query frontend error karena mencari kolom yang tidak exist.

## 3 Masalah yang Akan Terfix:

### ❌ Problem 1: Sales Report - "Gagal Memuat Data Penjualan"
**Cause:** Frontend query `/supplier/sales-report` mencari kolom `commission_amount` dan `supplier_revenue` yang belum ada di `sales_transaction_items`.

**Error di browser console:**
```
column sales_transaction_items.commission_amount does not exist
column sales_transaction_items.supplier_revenue does not exist
```

### ❌ Problem 2: Produk Terjual = 0 (Padahal Ada Sales)
**Cause:** Dashboard supplier query dari `sales_transaction_items` dengan filter `supplier_revenue` yang belum exist → return empty array.

**Hasil:** Semua KPI supplier = 0 (Total Produk Terjual, Saldo Estimasi, dll)

### ⚠️ Problem 3: Shipments Tab Belum Ada
**Status:** Butuh implementasi baru (30 menit) - NOT blocked by migration.

---

## ✅ SOLUSI: Execute 2 Migrations

### Step 1: Execute Migration 026
**File:** `backend/migrations/026_add_commission_to_sales.sql`

**What it does:**
1. Tambah 3 kolom baru ke `sales_transaction_items`:
   - `commission_rate` (default 10%)
   - `commission_amount` (platform commission)
   - `supplier_revenue` (supplier net revenue after commission)

2. Backfill data existing:
   - Commission 10% dari subtotal
   - Supplier revenue 90% dari subtotal

**Execute:**
```bash
1. Buka Supabase Dashboard → SQL Editor
2. Copy isi file 026_add_commission_to_sales.sql
3. Paste & Execute
4. Check output: Should see "SUCCESS!"
```

**Verification Query:**
```sql
-- Check kolom sudah ada
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'sales_transaction_items' 
  AND column_name IN ('commission_rate', 'commission_amount', 'supplier_revenue');

-- Should return 3 rows
```

---

### Step 2: Execute Migration 027
**File:** `backend/migrations/027_update_checkout_with_commission.sql`

**What it does:**
Update function `process_anonymous_checkout()` untuk calculate commission otomatis saat customer checkout.

**Logic:**
```typescript
// Customer beli 1 produk Rp 5,000
v_subtotal = 5000 * 1 = 5,000           // Customer bayar full
v_commission = 5,000 × 10% = 500        // Platform dapat
v_supplier_revenue = 5,000 - 500 = 4,500  // Supplier dapat
```

**Execute:**
```bash
1. Masih di SQL Editor
2. Copy isi file 027_update_checkout_with_commission.sql
3. Paste & Execute
4. Check output: Should see "SUCCESS!"
```

**Verification Query:**
```sql
-- Check function updated
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'process_anonymous_checkout';

-- Should return 1 row
```

---

## 🎯 After Migration: What Gets Fixed

### ✅ Sales Report Page
- Query akan sukses (kolom sudah exist)
- Menampilkan:
  - Total Produk Terjual (real count)
  - Total Revenue (supplier net after commission)
  - Total Komisi (platform commission)
  - Detail per-product sales

### ✅ Supplier Dashboard
- KPI "Produk Terjual" akan show real number (bukan 0)
- KPI "Saldo Estimasi" akan show real revenue
- Chart "Top Produk Terlaris" akan muncul data
- "Performa Bulanan" akan calculate growth

### ✅ Future Checkouts
- Setiap transaksi baru otomatis calculate commission
- Data tersimpan di 3 kolom: subtotal, commission, supplier_revenue
- Supplier dashboard & sales report langsung update

---

## 📋 Execution Checklist

- [ ] **Execute Migration 026** (add columns + backfill)
- [ ] **Verify columns exist** (run verification query)
- [ ] **Execute Migration 027** (update checkout function)
- [ ] **Verify function updated** (run verification query)
- [ ] **Test Sales Report** (`/supplier/sales-report`)
  - Should load without error
  - Should show real data if ada sales
- [ ] **Test Supplier Dashboard** (`/supplier`)
  - KPI "Produk Terjual" > 0 (if ada sales)
  - KPI "Saldo Estimasi" > 0 (if ada sales)
- [ ] **Test New Checkout** (customer beli produk)
  - Transaction success
  - Check `sales_transaction_items` → commission_amount & supplier_revenue terisi

---

## ⏱️ Estimated Time
- Migration 026: 2 minutes
- Migration 027: 2 minutes
- Testing: 5 minutes
- **Total: ~10 minutes**

---

## 🔄 Next Steps (After Migrations)

### Still Need to Implement: Shipments Tab System
**File to create:** `frontend/src/app/supplier/shipments/page.tsx`

**Design:**
```typescript
// Tab 1: Ajukan Pengiriman (existing functionality)
// Tab 2: Riwayat Pengiriman (NEW - show status timeline)

Query for Tab 2:
SELECT 
  sm.id, sm.created_at, sm.status, sm.location_name,
  smi.quantity, p.name
FROM stock_movements sm
JOIN stock_movement_items smi ON smi.movement_id = sm.id
JOIN products p ON p.id = smi.product_id
WHERE sm.supplier_id = [current_supplier]
ORDER BY sm.created_at DESC;
```

**Status:** Ready to implement (30 minutes) - NOT urgent, can do after migrations.

---

## 🆘 If Still Error After Migrations

### Error: "column does not exist"
**Check:**
```sql
-- Verify columns really added
\d sales_transaction_items

-- Should show commission_rate, commission_amount, supplier_revenue
```

**Fix:** Re-run migration 026

### Error: Sales data still empty
**Check:**
```sql
-- Check if there are actual sales
SELECT COUNT(*) FROM sales_transaction_items;

-- If 0 → No sales data yet (normal if fresh DB)
-- If > 0 → Check RLS policies
```

**Check RLS:**
```sql
-- Supplier should be able to read their own sales
SELECT * FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
WHERE p.supplier_id = '[your_supplier_id]';
```

### Error: Function not updated
**Fix:**
```sql
-- Drop and recreate
DROP FUNCTION IF EXISTS process_anonymous_checkout(TEXT, JSONB);

-- Then re-run migration 027
```

---

## 📞 Support

**Migration Files Location:**
- `backend/migrations/026_add_commission_to_sales.sql`
- `backend/migrations/027_update_checkout_with_commission.sql`

**Frontend Files Using These Columns:**
- `frontend/src/app/supplier/sales-report/page.tsx`
- `frontend/src/app/supplier/page.tsx` (dashboard)

**Expected Result:** Setelah execute kedua migrations, semua error sales report & dashboard KPI = 0 akan fix! 🎉
