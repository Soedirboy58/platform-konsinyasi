# 🔧 FIX PRODUCTION DATABASE - URGENT

## MASALAH DITEMUKAN

**Kolom `commission_amount` dan `supplier_revenue` BELUM ADA di tabel `sales_transaction_items` production!**

Ini menyebabkan:
1. ❌ Admin payment page: Unpaid tidak muncul (totalRevenue = 0)
2. ❌ Supplier notifications: Harga tidak muncul (unit_price tidak ada)

---

## SOLUSI: Jalankan Migration

### LANGKAH 1: Buka Supabase SQL Editor

```
https://supabase.com/dashboard/project/rpzoacwlswlhfqaiicho/sql/new
```

### LANGKAH 2: Copy-Paste & Execute SQL Ini

```sql
-- ========================================
-- ADD COMMISSION TRACKING TO SALES ITEMS
-- ========================================
-- Purpose: Add commission_amount and supplier_revenue columns
-- to sales_transaction_items for proper financial tracking
-- ========================================

-- Check if columns already exist before adding
DO $$ 
BEGIN
    -- Add commission_amount column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_transaction_items' 
        AND column_name = 'commission_amount'
    ) THEN
        ALTER TABLE sales_transaction_items
        ADD COLUMN commission_amount DECIMAL(10,2) DEFAULT 0 CHECK (commission_amount >= 0);
        
        RAISE NOTICE 'Added commission_amount column';
    ELSE
        RAISE NOTICE 'commission_amount column already exists';
    END IF;

    -- Add supplier_revenue column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_transaction_items' 
        AND column_name = 'supplier_revenue'
    ) THEN
        ALTER TABLE sales_transaction_items
        ADD COLUMN supplier_revenue DECIMAL(10,2) DEFAULT 0 CHECK (supplier_revenue >= 0);
        
        RAISE NOTICE 'Added supplier_revenue column';
    ELSE
        RAISE NOTICE 'supplier_revenue column already exists';
    END IF;
END $$;

-- Update existing records to calculate commission
DO $$
DECLARE
    v_commission_rate DECIMAL(5,2) := 10.0;  -- Default 10% commission
    v_updated_count INTEGER;
BEGIN
    -- Try to get platform commission rate if table and column exist
    BEGIN
        SELECT COALESCE(commission_rate, 10.0) INTO v_commission_rate
        FROM platform_settings
        LIMIT 1;
    EXCEPTION
        WHEN undefined_table OR undefined_column THEN
            v_commission_rate := 10.0;
            RAISE NOTICE 'Using default commission rate: 10%%';
    END;
    
    -- Update existing sales_transaction_items that have NULL or 0 commission
    UPDATE sales_transaction_items
    SET 
        commission_amount = ROUND(subtotal * v_commission_rate / 100, 2),
        supplier_revenue = ROUND(subtotal * (100 - v_commission_rate) / 100, 2)
    WHERE commission_amount IS NULL OR commission_amount = 0;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Updated % existing records with commission calculations. Rate: %%', 
        v_updated_count, v_commission_rate;
END $$;

-- Verify results
SELECT 
    'SUCCESS: Commission columns added and data updated!' AS status,
    COUNT(*) AS total_records,
    SUM(subtotal) AS total_sales,
    SUM(commission_amount) AS total_commission,
    SUM(supplier_revenue) AS total_supplier_revenue
FROM sales_transaction_items
WHERE commission_amount > 0;
```

### LANGKAH 3: Click "Run" atau tekan F5

Expected Output:
```
NOTICE:  Added commission_amount column
NOTICE:  Added supplier_revenue column
NOTICE:  Updated 7 existing records with commission calculations. Rate: 10%

status: SUCCESS: Commission columns added and data updated!
total_records: 7
total_sales: 360000.00
total_commission: 36000.00
total_supplier_revenue: 324000.00
```

---

## LANGKAH 4: Verifikasi Schema

Jalankan query ini untuk memastikan kolom sudah ada:

```sql
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_transaction_items'
ORDER BY ordinal_position;
```

Expected columns:
- ✅ id
- ✅ transaction_id
- ✅ product_id
- ✅ quantity
- ✅ unit_price
- ✅ subtotal
- ✅ **commission_amount** (NEW!)
- ✅ **supplier_revenue** (NEW!)

---

## LANGKAH 5: Test di Frontend

1. **Admin Panel:**
   - Buka: https://platform-konsinyasi.vercel.app/admin/payments/commissions
   - Filter: "Unpaid"
   - **Expected:** Aneka Snack, Dapur Bunnara, Aneka Snack A muncul dengan status UNPAID

2. **Supplier Dashboard:**
   - Buka: https://platform-konsinyasi.vercel.app/supplier
   - Scroll ke "Notifikasi Penjualan Real-time"
   - **Expected:** 7 transaksi muncul dengan harga yang benar

---

## TROUBLESHOOTING

### Jika masih tidak muncul setelah migration:

1. **Clear browser cache** (Ctrl+Shift+R)
2. **Hard reload Vercel deployment:**
   ```
   https://vercel.com/katalaras-projects/platform-konsinyasi/deployments
   → Click deployment terakhir → "Redeploy"
   ```

3. **Cek console browser** (F12 → Console tab)
   - Harusnya ada log: "💰 Aneka Snack: { totalRevenue: ..., unpaidAmount: ... }"

---

## ROOT CAUSE ANALYSIS

**Mengapa ini terjadi?**

Database schema tidak lengkap. File migration `add-commission-columns.sql` belum dijalankan di production.

**Timeline:**
1. Nov 2025: Sales transactions dibuat
2. Kolom commission belum ada → data disimpan tanpa commission
3. Admin query mencari `supplier_revenue` → return NULL
4. totalRevenue = 0 → unpaidAmount = 0 → Status = PAID (wrong!)

**Fix:**
- Migration menambahkan kolom
- Update existing data dengan calculation retroactive
- Future transactions akan auto-calculate commission via trigger/function

---

**© 2024 Katalara - Database Migration Fix**
