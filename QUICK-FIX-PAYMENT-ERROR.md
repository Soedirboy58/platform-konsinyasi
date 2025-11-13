# 🔧 QUICK FIX: Error Save Pembayaran Supplier

## 📌 Error yang Dialami
```
❌ Gagal menyimpan pembayaran: column "priority" of relation "notifications" does not exist
```

**Root Cause:** Trigger `handle_supplier_payment()` mencoba insert ke tabel `notifications` dengan kolom yang tidak ada di production database Anda.

---

## ✅ Solusi Cepat (3 Menit)

### Step 1: Buka Supabase SQL Editor
URL: https://supabase.com/dashboard/project/rpzoacwlswlhfqaiicho/sql/new

### Step 2: Copy & Run File Berikut
File: `database/FIX-SUPPLIER-PAYMENT-NOTIFICATIONS-FINAL.sql`

1. Buka file `FIX-SUPPLIER-PAYMENT-NOTIFICATIONS-FINAL.sql` di VS Code
2. Copy **SEMUA ISI FILE** (Ctrl+A, Ctrl+C)
3. Paste ke Supabase SQL Editor
4. Klik **RUN** (atau Ctrl+Enter)

### Step 3: Tunggu Output
Anda akan melihat output seperti ini:

```
✅ Column "priority" exists in notifications
   atau
❌ Column "priority" DOES NOT EXIST - will create adaptive trigger

✅ TEST INSERT SUCCESS! Payment ID: xxx
✅ Trigger executed without errors
✅ Test completed successfully (rolled back)

✅ Supplier payment trigger fixed!
```

### Step 4: Test di Frontend
1. Refresh halaman `/admin/payments/commissions`
2. Klik tombol **"Bayar"** pada supplier
3. Isi form pembayaran
4. Klik **"Simpan Pembayaran"**

**Expected Result:** ✅ Pembayaran berhasil disimpan tanpa error!

---

## 🔍 Apa yang Dilakukan Script?

### 1. Deteksi Kolom Notifications
Script otomatis cek kolom apa saja yang ada di tabel `notifications`:
- `priority` (mungkin tidak ada)
- `action_url` (mungkin tidak ada)
- `metadata` (mungkin tidak ada)

### 2. Buat Trigger Adaptive
Trigger baru akan menyesuaikan dengan kolom yang **benar-benar ada**:

```sql
-- Jika semua kolom ada:
INSERT INTO notifications (recipient_id, title, message, type, priority, action_url, metadata)

-- Jika hanya priority ada:
INSERT INTO notifications (recipient_id, title, message, type, priority)

-- Jika kolom minimal saja (MINIMAL VERSION):
INSERT INTO notifications (recipient_id, title, message, type)
```

### 3. Update Type Constraint
Menambahkan `PAYMENT_RECEIVED` ke list allowed types di tabel notifications.

### 4. Error Handling
Jika ada error di trigger, payment tetap **TERSIMPAN** (tidak gagal total).

---

## 🧪 Verification (Optional)

### Cek Trigger Ada
```sql
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_supplier_payment_notification';
```

Expected:
```
trigger_name                           | event_manipulation | action_timing
---------------------------------------|--------------------|--------------
trigger_supplier_payment_notification  | INSERT             | AFTER
trigger_supplier_payment_notification  | UPDATE             | AFTER
```

### Cek Kolom Notifications
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
ORDER BY ordinal_position;
```

Expected minimal columns:
- `id`
- `recipient_id`
- `title`
- `message`
- `type`
- `is_read`
- `created_at`

---

## 🐛 Troubleshooting

### Error: "function handle_supplier_payment() does not exist"
**Fix:** Script akan create function baru. Jalankan ulang script.

### Error: "relation supplier_payments does not exist"
**Fix:** Jalankan dulu `database/create-supplier-payment-table.sql`

### Payment tersimpan tapi tidak ada notifikasi
**Check:** 
1. Cek tabel `notifications` apakah ada row baru
2. Jika tidak ada, cek logs di Supabase Dashboard → Database → Logs
3. Kemungkinan supplier tidak punya `profile_id` (supplier belum di-link ke profile)

### Test insert masih gagal di script
**Penyebab:** 
- Tidak ada supplier di database
- Kolom `created_by` di payment_settings tidak nullable tapi user tidak login

**Fix:** Login sebagai admin dulu sebelum test.

---

## 📊 Alternative: Manual Fix (Jika Script Gagal)

### 1. Drop Trigger Lama
```sql
DROP TRIGGER IF EXISTS trigger_supplier_payment_notification ON supplier_payments;
DROP FUNCTION IF EXISTS handle_supplier_payment() CASCADE;
```

### 2. Buat Function Minimal (Tanpa Notification)
```sql
CREATE OR REPLACE FUNCTION handle_supplier_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Hanya update wallet, skip notification
  IF (TG_OP = 'INSERT' AND NEW.status = 'COMPLETED') THEN
    IF NEW.wallet_id IS NOT NULL THEN
      UPDATE supplier_wallets
      SET available_balance = available_balance + NEW.amount
      WHERE id = NEW.wallet_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_supplier_payment_notification
  AFTER INSERT ON supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_supplier_payment();
```

Ini akan **skip notification** tapi payment tetap bisa save.

---

## ✅ Success Criteria

Setelah run script, coba lagi:

- [ ] Buka `/admin/payments/commissions`
- [ ] Klik "Bayar" pada supplier
- [ ] Isi form pembayaran dengan complete data
- [ ] Klik "Simpan Pembayaran"
- [ ] **Result:** ✅ Alert "Pembayaran berhasil dicatat!"
- [ ] **Verify:** Status supplier berubah "Sudah Bayar"
- [ ] **Bonus:** Supplier menerima notifikasi (jika kolom lengkap)

---

## 📞 Jika Masih Error

Screenshot full error message (bukan hanya popup) dan kirim:
1. Error message lengkap dari browser console (F12)
2. Error message dari Supabase SQL Editor
3. Output dari query ini:

```sql
-- Show current notifications structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications';

-- Show trigger status
SELECT * FROM information_schema.triggers 
WHERE trigger_name LIKE '%supplier_payment%';
```

---

**Status:** ✅ Fix ready to deploy!  
**File:** `database/FIX-SUPPLIER-PAYMENT-NOTIFICATIONS-FINAL.sql`  
**Time to Fix:** ~3 menit
