# Quick Fix - Wallet Balance & Sales History

## 🐛 Masalah yang Ditemukan

### 1. Saldo Tersedia Tidak Bertambah
**Status:** Rp 5.500 (seharusnya Rp 44.470 setelah payment Rp 38.970)

**Penyebab:**
- Trigger `handle_supplier_payment()` memiliki bug pada variable handling
- Payment sudah tersave tapi wallet belum ter-update

**Solusi:**
- Created `fix-supplier-payment-notifications-v2.sql` (CORRECTED VERSION)
- Menambahkan **retroactive processing** untuk existing payments dalam 24 jam terakhir
- Auto-fix wallet balance untuk payment yang sudah dibuat tapi belum update wallet

### 2. Riwayat Transaksi Penjualan Kosong
**Status:** "Belum ada transaksi penjualan"

**Penyebab:**
- Belum ada data sales yang COMPLETED
- Atau RLS policy block

**Fungsi Section Ini:**
✅ **PENTING - JANGAN DIHAPUS!**
- Menampilkan DETAIL GRANULAR setiap produk yang terjual
- Transparansi komisi platform per item
- Supplier bisa audit: "Produk X terjual berapa, dapat bersih berapa"

**Berbeda dengan:**
- "Notifikasi Pengiriman Uang" = Transfer bank dari admin ke supplier
- "Riwayat Transaksi Penjualan" = Detail produk yang terjual

---

## 🔧 File yang Diperbaiki

### 1. `fix-supplier-payment-notifications-v2.sql`

**Improvements:**
```sql
-- FIXED: Variable v_supplier_profile_id properly declared
-- ADDED: Retroactive processing for existing payments
DO $$ 
DECLARE
  v_payment RECORD;
BEGIN
  FOR v_payment IN 
    SELECT ... FROM supplier_payments
    WHERE status = 'COMPLETED'
      AND created_at > NOW() - INTERVAL '1 day'
  LOOP
    -- Check if already processed
    IF NOT EXISTS (wallet_transaction with this ref) THEN
      -- Update wallet + create transaction
    END IF;
  END LOOP;
END $$;
```

**Hasil:**
- Existing payment (Rp 38.970) akan ter-process retroactively
- Saldo berubah dari Rp 5.500 → Rp 44.470 ✅

### 2. `frontend/src/app/supplier/wallet/page.tsx`

**Changes:**
- Improved empty state dengan icon Package
- Better description: "Detail setiap produk yang terjual di outlet..."
- Added Package icon import from lucide-react

---

## 🚀 Deployment Steps

### Step 1: Execute New SQL File
```bash
# Execute di Supabase SQL Editor
database/fix-supplier-payment-notifications-v2.sql
```

**Expected Output:**
```
NOTICE: ✅ Retroactively processed payment TRF-20251113-370-AS for Aneka Snack
NOTICE: ✅ Supplier payment notification system configured!

status
✅ Supplier payment notification system ready! Existing payments processed retroactively.
```

### Step 2: Verify Wallet Updated
```sql
-- Check wallet balance
SELECT 
    s.business_name,
    sw.available_balance,
    sw.updated_at
FROM supplier_wallets sw
JOIN suppliers s ON s.id = sw.supplier_id
WHERE s.business_name = 'Aneka Snack';

-- Should show:
-- business_name | available_balance | updated_at
-- Aneka Snack   | 44470            | 2025-11-13 ...
```

### Step 3: Check Wallet Transactions
```sql
SELECT 
    wt.transaction_type,
    wt.amount,
    wt.description,
    wt.balance_after,
    wt.created_at
FROM wallet_transactions wt
JOIN supplier_wallets sw ON sw.id = wt.wallet_id
JOIN suppliers s ON s.id = sw.supplier_id
WHERE s.business_name = 'Aneka Snack'
ORDER BY wt.created_at DESC;

-- Should show:
-- PAYMENT_RECEIVED | 38970 | Pembayaran dari admin - TRF-20251113-370-AS | 44470
```

### Step 4: Test Frontend
1. Refresh `/supplier/wallet`
2. **Verify:** Saldo Tersedia shows Rp 44.470 ✅
3. **Verify:** Notifikasi Pengiriman Uang shows payment card ✅
4. **Verify:** Riwayat Transaksi Penjualan still there (improved empty state) ✅

---

## 📊 Understanding the Sections

### Section 1: Notifikasi Pengiriman Uang dari Admin
**Purpose:** Transfer bank dari admin ke rekening supplier
**Data Source:** `supplier_payments` table
**Example:**
```
+Rp 38.970 [Diterima]
Ref: TRF-20251113-370-AS
Bank: BCA - 1234567890
Tanggal: 12 November 2025
[Lihat Bukti]
```

### Section 2: Riwayat Transaksi Penjualan
**Purpose:** Detail produk yang terjual (item-level)
**Data Source:** `sales_transaction_items` JOIN `sales_transactions`
**Example:**
```
Tanggal      | Produk | Outlet | Qty | Harga Jual | Fee     | Diterima
12 Nov 2025 | Pastry | K001   | 9   | Rp 40.500  | -Rp 405 | +Rp 4.050
12 Nov 2025 | Pizza  | K001   | 2   | Rp 8.000   | -Rp 80  | +Rp 3.600
```

**Why Both Needed:**
- Section 1: Proof admin sudah transfer uang ke bank supplier
- Section 2: Detail breakdown produk apa saja yang terjual (for auditing)

---

## ✅ Test Results Expected

### Before Fix:
- ❌ Saldo: Rp 5.500
- ✅ Payment notification shown
- ⚠️  Empty sales history

### After Fix:
- ✅ Saldo: Rp 44.470 (increased by Rp 38.970)
- ✅ Payment notification shown
- ✅ Sales history with better empty state
- ✅ wallet_transactions record created
- ✅ Trigger working for future payments

---

## 🎯 Next Action for Sales History

**To populate Riwayat Transaksi Penjualan:**

1. Test customer checkout flow:
```
Customer → Kantin → Add products → Checkout
Admin → Confirm payment
```

2. Execute if not done yet:
```sql
-- database/fix-confirm-payment-complete.sql
-- This credits wallet on SALE (different from admin payment)
```

3. Verify data:
```sql
SELECT COUNT(*) 
FROM sales_transaction_items sti
JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE st.status = 'COMPLETED';
-- Should return > 0
```

---

## 🚨 Common Issues

### Issue: Saldo Still Rp 5.500 After Executing SQL
**Solution:**
```sql
-- Manually trigger for specific payment
UPDATE supplier_payments 
SET updated_at = NOW() 
WHERE payment_reference = 'TRF-20251113-370-AS';
-- This will fire the trigger
```

### Issue: Sales History Still Empty
**Diagnosis:**
```sql
-- Check if sales exist
SELECT st.status, COUNT(*) 
FROM sales_transactions st
GROUP BY st.status;

-- If all PENDING, need to confirm payments:
SELECT * FROM confirm_payment('<transaction_id>');
```

---

**Created:** 2025-11-13  
**Files:**
- `database/fix-supplier-payment-notifications-v2.sql` (NEW - CORRECTED)
- `frontend/src/app/supplier/wallet/page.tsx` (UPDATED)

**Priority:** HIGH - Wallet balance critical for supplier trust
