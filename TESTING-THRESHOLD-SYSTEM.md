# 🚀 Testing Guide: Threshold Payment System

## 📋 Setup Steps

### 1. Jalankan SQL Migration
Buka Supabase SQL Editor dan jalankan file-file berikut secara berurutan:

```sql
-- Step 1: Buat tabel payment_settings
-- File: database/create-payment-settings-table.sql
-- Copy paste semua isi file ke SQL Editor → Run

-- Step 2: Fix RLS policies jika ada error
-- File: database/FIX-SUPPLIER-PAYMENT-ERROR.sql
-- Copy paste semua isi file → Run
```

### 2. Deploy Frontend ke Vercel
```bash
# Di VS Code terminal
cd frontend
vercel --prod
```

---

## 🧪 Test Flow End-to-End

### Test 1: Set Threshold di Admin Settings

1. **Login sebagai Admin**
   - URL: `https://platform-konsinyasi.vercel.app/admin`
   - Email: admin@platform.com (sesuaikan)

2. **Buka Settings → Tab "Komisi & Pembayaran"**
   - URL: `/admin/settings`
   - Scroll ke section "Pengaturan Pembayaran ke Supplier"

3. **Set Threshold**
   - Isi "Minimum Threshold Pencairan": **Rp 50.000** (untuk test, biar mudah)
   - Jadwal Pembayaran: Pilih "Manual"
   - Centang "Izinkan Partial Payment"
   - Klik "Simpan Pengaturan Pembayaran"

4. **Verifikasi**
   - Cek console: Harus muncul toast "✅ Pengaturan pembayaran berhasil disimpan!"
   - Refresh page → Value threshold harus tetap Rp 50.000

**Expected Result:** ✅ Settings tersimpan di database

---

### Test 2: Check Ready-to-Pay Alert

1. **Buka Menu Pembayaran Supplier**
   - URL: `/admin/payments/commissions`
   - Filter periode: "Bulan Ini"

2. **Cek Alert Hijau (Ready to Pay)**
   - Jika ada supplier dengan komisi ≥ Rp 50.000:
     - Harus muncul alert hijau "✅ X supplier READY untuk dibayar!"
     - List supplier dengan nominal komisi
     - Button "💳 Bayar Semua Sekarang"

3. **Cek Alert Kuning (Pending Threshold)**
   - Jika ada supplier dengan komisi < Rp 50.000:
     - Harus muncul alert kuning "X supplier belum mencapai threshold"
     - Total pending threshold

**Expected Result:** 
- ✅ Alert muncul sesuai kondisi
- ✅ Data supplier difilter berdasarkan threshold
- ✅ Total amount dihitung dengan benar

**Screenshot:**
```
┌─────────────────────────────────────────────────────────┐
│ ✅ 2 supplier READY untuk dibayar! [≥ Rp 50.000]       │
│                                                          │
│ Komisi supplier ini sudah mencapai minimum threshold    │
│                                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │ Aneka Snack (12 transaksi)      Rp 65.970       │   │
│ │ Kue Basah Ibu (8 transaksi)     Rp 120.500      │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
│ [💳 Bayar Semua Sekarang - Total: Rp 186.470]          │
└─────────────────────────────────────────────────────────┘
```

---

### Test 3: Ubah Threshold Real-time

1. **Kembali ke Settings**
   - Ubah threshold menjadi **Rp 100.000**
   - Simpan

2. **Kembali ke Payments → Commissions**
   - Refresh page
   - Lihat perubahan alert:
     - Supplier dengan komisi Rp 65.970 sekarang masuk "Pending" (< Rp 100.000)
     - Supplier dengan komisi Rp 120.500 tetap di "Ready" (≥ Rp 100.000)

**Expected Result:** 
- ✅ Filtering berubah dinamis sesuai threshold baru
- ✅ Stats terupdate otomatis

---

### Test 4: Manual Payment (Existing Flow)

1. **Di halaman Commissions**
   - Scroll ke tabel supplier
   - Pilih supplier dengan status "Belum Bayar"
   - Klik button "Bayar"

2. **Modal Payment**
   - Nomor referensi: Auto-generated (contoh: TRF-20241113-001-AS)
   - Tanggal: Hari ini
   - Upload bukti (optional untuk test)
   - Klik "Simpan Pembayaran"

3. **Verifikasi**
   - Status supplier berubah "Sudah Bayar"
   - Hilang dari alert "Ready to Pay"
   - Muncul di tabel dengan badge hijau "Sudah Bayar"

**Expected Result:** 
- ✅ Payment tersimpan ke `supplier_payments` table
- ✅ Status update di frontend
- ✅ Ready-to-pay list terupdate

---

### Test 5: Batch Payment (Future - Currently Shows Alert)

1. **Klik "💳 Bayar Semua Sekarang"**
   - Saat ini akan muncul alert: "Batch payment untuk X supplier (Total: Rp ...)"
   - Ini placeholder untuk fitur batch payment yang akan diimplementasi

**Expected Result:** 
- ✅ Alert muncul dengan data yang benar
- ⏳ TODO: Implement batch payment modal & logic

---

## 🐛 Common Issues & Fixes

### Issue 1: "Table payment_settings does not exist"
**Fix:** Jalankan `database/create-payment-settings-table.sql` di Supabase

### Issue 2: "new row violates row-level security policy"
**Fix:** Jalankan `database/FIX-SUPPLIER-PAYMENT-ERROR.sql` untuk fix RLS policies

### Issue 3: Threshold tidak load (tetap Rp 100.000 default)
**Fix:** 
1. Cek Supabase table `payment_settings` ada isinya
2. Cek browser console untuk error fetch
3. Pastikan RLS policy allow admin SELECT

### Issue 4: Ready-to-pay alert tidak muncul padahal ada supplier
**Check:**
1. Supplier status harus "UNPAID" (bukan "PAID")
2. Komisi supplier ≥ threshold yang diset
3. Filter periode: Pastikan ada transaksi di periode yang dipilih

### Issue 5: Data tidak update setelah ubah threshold
**Fix:** Refresh page atau clear browser cache

---

## 📊 Verification Queries (Supabase SQL Editor)

### Check Payment Settings
```sql
SELECT * FROM payment_settings;
```

Expected:
```
minimum_payout_amount | payment_schedule | allow_partial_payment
---------------------|------------------|---------------------
100000.00            | MANUAL           | true
```

### Check Suppliers Ready to Pay (This Month)
```sql
WITH monthly_sales AS (
  SELECT 
    p.supplier_id,
    s.business_name,
    SUM(sti.supplier_revenue) as commission_amount
  FROM sales_transaction_items sti
  JOIN sales_transactions st ON st.id = sti.transaction_id
  JOIN products p ON p.id = sti.product_id
  JOIN suppliers s ON s.id = p.supplier_id
  WHERE st.status = 'COMPLETED'
    AND st.created_at >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY p.supplier_id, s.business_name
)
SELECT 
  business_name,
  commission_amount,
  CASE 
    WHEN commission_amount >= (SELECT minimum_payout_amount FROM payment_settings LIMIT 1) 
    THEN '✅ READY TO PAY'
    ELSE '⏳ PENDING THRESHOLD'
  END as status
FROM monthly_sales
ORDER BY commission_amount DESC;
```

### Check Recent Payments
```sql
SELECT 
  sp.payment_reference,
  sp.amount,
  sp.payment_date,
  s.business_name as supplier,
  sp.status
FROM supplier_payments sp
JOIN suppliers s ON s.id = sp.supplier_id
ORDER BY sp.created_at DESC
LIMIT 10;
```

---

## ✅ Success Criteria

- [ ] Tabel `payment_settings` berhasil dibuat
- [ ] Admin bisa set/update threshold di Settings
- [ ] Alert "Ready to Pay" muncul untuk supplier ≥ threshold
- [ ] Alert "Pending Threshold" muncul untuk supplier < threshold
- [ ] Filtering supplier berubah dinamis saat threshold diubah
- [ ] Manual payment masih berfungsi normal
- [ ] Status payment update setelah bayar
- [ ] Stats cards menampilkan angka yang benar

---

## 🔜 Next Steps (Future Enhancement)

1. **Implement Batch Payment Modal**
   - Form untuk upload bukti transfer batch
   - List semua supplier yang akan dibayar
   - Save multiple payment records sekaligus

2. **Email Reminder System**
   - Cron job untuk kirim email based on schedule
   - Template email dengan list ready-to-pay suppliers

3. **Payment History Analytics**
   - Chart timeline pembayaran
   - Export Excel dengan data lengkap
   - Filter by date range, supplier, amount

4. **Supplier Dashboard**
   - Supplier bisa lihat komisi mereka
   - Progress bar ke threshold
   - Request partial payment button (jika allowed)

---

**Happy Testing! 🎉**

Kalau ada issue, screenshot error dan kirim ke saya untuk debug.
