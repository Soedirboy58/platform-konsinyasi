# Supplier Payment Notifications - Complete Guide

## 🎯 Tujuan
Memastikan supplier mendapat notifikasi lengkap saat admin melakukan pembayaran, termasuk:
1. **Notifikasi pembayaran** dengan detail transfer
2. **Bukti transfer** yang bisa dilihat/download
3. **Saldo wallet otomatis bertambah**
4. **Notifikasi penjualan real-time** di dashboard

---

## 📋 Komponen yang Diperbaiki

### 1. Database Trigger (`fix-supplier-payment-notifications.sql`)

**File:** `database/fix-supplier-payment-notifications.sql`

**Fungsi:**
- Trigger otomatis saat admin save payment dengan status COMPLETED
- Update `supplier_wallets.available_balance` (menambah saldo)
- Create record di `wallet_transactions` (audit trail)
- Kirim notifikasi ke supplier dengan data lengkap

**Cara Kerja:**
```sql
INSERT supplier_payments → Trigger fired → 
1. Update wallet balance (+amount)
2. Create wallet transaction
3. Send notification to supplier
```

**Data Notifikasi:**
```json
{
  "payment_id": "uuid",
  "amount": 38970,
  "payment_reference": "TRF-20251113-507-AS",
  "payment_date": "2025-11-12",
  "bank_name": "BCA",
  "payment_proof_url": "https://..."
}
```

---

### 2. Frontend - Dompet Saya (`/supplier/wallet`)

**File:** `frontend/src/app/supplier/wallet/page.tsx`

**Perubahan:**

#### A. Load Payment Notifications
```typescript
// Get payment notifications from admin
const { data: paymentsData } = await supabase
  .from('supplier_payments')
  .select('*')
  .eq('supplier_id', supplier.id)
  .eq('status', 'COMPLETED')
  .order('payment_date', { ascending: false })
  .limit(50)

setPaymentNotifications(paymentsData || [])
```

#### B. Display Notifications
- ✅ Tampilkan jumlah transfer (+Rp xxx.xxx)
- ✅ Payment reference (TRF-YYYYMMDD-XXX-INITIALS)
- ✅ Bank info (nama bank + nomor rekening)
- ✅ Tanggal transfer
- ✅ Catatan dari admin
- ✅ Button "Lihat Bukti" (jika ada payment_proof_url)

#### C. Payment Proof Modal
- Modal popup untuk lihat bukti transfer
- Tombol "Buka di Tab Baru"
- Zoom-able image

---

### 3. RLS Policies

**File:** `database/fix-supplier-payments-rls.sql`

**Policies:**
```sql
-- Supplier can VIEW their own payments
CREATE POLICY "Suppliers can view their own payments"
ON supplier_payments
FOR SELECT
USING (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);
```

---

## 🔄 Flow Pembayaran Lengkap

### Step 1: Admin Bayar Supplier
```
Admin → Pembayaran Supplier → Pilih supplier "Aneka Snack"
→ Klik "Bayar" → Fill form:
  - Ref: TRF-20251113-507-AS (auto-generated)
  - Tanggal: 11/12/2025
  - Upload bukti: quit.png
  - Catatan: "Pembayaran periode Nov 2025"
→ Klik "Simpan Pembayaran"
```

### Step 2: Database Trigger Fired
```sql
1. INSERT INTO supplier_payments (status='COMPLETED')
2. Trigger: handle_supplier_payment()
3. UPDATE supplier_wallets SET available_balance = available_balance + 38970
4. INSERT INTO wallet_transactions (type='PAYMENT_RECEIVED')
5. INSERT INTO notifications (type='PAYMENT_RECEIVED')
```

### Step 3: Supplier Melihat Notifikasi
```
Supplier Login → Dompet Saya → Notifikasi Pengiriman Uang
→ Muncul card baru:
  ┌─────────────────────────────────────┐
  │ +Rp 38.970        [Diterima]       │
  │ Ref: TRF-20251113-507-AS           │
  │ Bank: BCA - 1234567890             │
  │ Tanggal: 12 November 2025          │
  │ Catatan: Pembayaran periode Nov 2025│
  │                     [Lihat Bukti]  │
  └─────────────────────────────────────┘
```

### Step 4: Saldo Wallet Updated
```
Supplier → Dompet Saya → Cards:
┌─────────────────────┐
│ Saldo Tersedia      │
│ Rp 44.470          │ ← BERTAMBAH!
│ [Tarik Dana]        │
└─────────────────────┘
```

---

## 🐛 Debug Notifikasi Penjualan Real-time

**Masalah:** Dashboard supplier tidak muncul notifikasi produk terjual

**Penyebab Potensial:**
1. Query tidak join dengan benar
2. RLS policy block data sales
3. Status transaksi tidak COMPLETED
4. Data sales_transaction_items kosong

**Solusi:**

### Check 1: Verify Sales Data Exists
```sql
-- Di Supabase SQL Editor
SELECT 
  st.id,
  st.status,
  st.created_at,
  sti.product_id,
  sti.quantity,
  sti.supplier_revenue,
  p.name as product_name,
  l.name as outlet_name
FROM sales_transactions st
JOIN sales_transaction_items sti ON sti.transaction_id = st.id
JOIN products p ON p.id = sti.product_id
JOIN locations l ON l.id = st.location_id
WHERE st.status = 'COMPLETED'
  AND p.supplier_id = '<SUPPLIER_ID_HERE>'
ORDER BY st.created_at DESC
LIMIT 10;
```

### Check 2: Test Frontend Query
```typescript
// In /supplier/page.tsx line 90-105
const { data: recentSales, error } = await supabase
  .from('sales_transaction_items')
  .select(`
    id,
    quantity,
    supplier_revenue,
    products(name),
    sales_transactions!inner(created_at, status, locations(name))
  `)
  .in('product_id', productIds)
  .eq('sales_transactions.status', 'COMPLETED')
  .order('sales_transactions(created_at)', { ascending: false })
  .limit(50)

console.log('Sales query error:', error)
console.log('Sales data count:', recentSales?.length)
```

### Check 3: RLS Policy
```sql
-- Verify supplier can read sales data
SELECT * FROM sales_transaction_items
WHERE product_id IN (
  SELECT id FROM products WHERE supplier_id = auth.uid()
);
```

---

## ✅ Checklist Deployment

### 1. Execute SQL Files (URUTAN PENTING!)
```bash
# 1. Migrate table structure
database/migrate-supplier-payments.sql

# 2. Fix status constraint
database/fix-supplier-payments-status-constraint.sql

# 3. Add RLS policies
database/fix-supplier-payments-rls.sql

# 4. Add payment notification trigger
database/fix-supplier-payment-notifications.sql
```

### 2. Test Flow End-to-End

#### Test 1: Payment Notification
- [ ] Admin bayar supplier (Rp 38.970)
- [ ] Upload bukti transfer
- [ ] Save dengan status COMPLETED
- [ ] Supplier login → Dompet Saya
- [ ] Lihat "Notifikasi Pengiriman Uang"
- [ ] Card baru muncul dengan data lengkap
- [ ] Klik "Lihat Bukti" → Modal terbuka
- [ ] Saldo Tersedia bertambah Rp 38.970

#### Test 2: Sales Notification
- [ ] Customer checkout produk supplier di kantin
- [ ] Admin confirm payment
- [ ] Supplier login → Dashboard
- [ ] Scroll ke "Notifikasi Penjualan Real-time"
- [ ] Tabel terisi dengan transaksi terbaru
- [ ] Data: waktu, produk, outlet, qty, harga

#### Test 3: Wallet Balance
- [ ] Cek saldo awal: Rp 5.500
- [ ] Admin bayar: Rp 38.970
- [ ] Saldo baru: Rp 44.470 ✅
- [ ] Cek wallet_transactions table
- [ ] Ada record type='PAYMENT_RECEIVED'

---

## 📊 Verification Queries

### Check Payment Processed
```sql
SELECT 
  sp.payment_reference,
  sp.amount,
  sp.status,
  sp.payment_date,
  s.business_name,
  sw.available_balance
FROM supplier_payments sp
JOIN suppliers s ON s.id = sp.supplier_id
JOIN supplier_wallets sw ON sw.id = sp.wallet_id
WHERE sp.status = 'COMPLETED'
ORDER BY sp.created_at DESC
LIMIT 5;
```

### Check Wallet Transactions
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
ORDER BY wt.created_at DESC
LIMIT 10;
```

### Check Notifications Sent
```sql
SELECT 
  n.type,
  n.title,
  n.message,
  n.data,
  n.is_read,
  n.created_at,
  p.email
FROM notifications n
JOIN profiles p ON p.id = n.user_id
WHERE n.type = 'PAYMENT_RECEIVED'
ORDER BY n.created_at DESC
LIMIT 5;
```

### Check Sales Notifications
```sql
SELECT 
  sti.id,
  sti.quantity,
  sti.supplier_revenue,
  p.name as product_name,
  l.name as outlet_name,
  st.created_at,
  st.status
FROM sales_transaction_items sti
JOIN sales_transactions st ON st.id = sti.transaction_id
JOIN products p ON p.id = sti.product_id
JOIN locations l ON l.id = st.location_id
WHERE p.supplier_id IN (
  SELECT id FROM suppliers WHERE business_name = 'Aneka Snack'
)
AND st.status = 'COMPLETED'
ORDER BY st.created_at DESC
LIMIT 20;
```

---

## 🚨 Troubleshooting

### Issue 1: Saldo Tidak Bertambah
**Symptom:** Admin bayar tapi saldo wallet tetap
**Diagnosis:**
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger 
WHERE tgname = 'trigger_supplier_payment_notification';

-- Check if function exists
SELECT * FROM pg_proc 
WHERE proname = 'handle_supplier_payment';
```
**Solution:** Execute `fix-supplier-payment-notifications.sql`

### Issue 2: Notifikasi Tidak Muncul
**Symptom:** Payment save tapi tidak ada notifikasi
**Diagnosis:**
```sql
-- Check notifications table
SELECT COUNT(*) FROM notifications 
WHERE type = 'PAYMENT_RECEIVED';

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'notifications';
```
**Solution:** 
1. Verify trigger fired (check logs)
2. Verify notification inserted
3. Check RLS allows supplier to read

### Issue 3: Sales Real-time Tidak Muncul
**Symptom:** Dashboard kosong di section "Notifikasi Penjualan Real-time"
**Diagnosis:**
```typescript
// Add console.log in loadStats()
console.log('Product IDs:', productIds)
console.log('Recent sales:', recentSales)
console.log('Sales notifs:', salesNotifs)
```
**Solution:**
1. Verify sales_transactions.status = 'COMPLETED'
2. Check products approved
3. Verify RLS policies on sales tables

---

## 📱 User Experience

### Admin Side
```
Pembayaran Supplier → Pilih "Aneka Snack"
→ Status: "Belum Bayar" (Rp 38.970)
→ Klik "Bayar"
→ Modal terbuka:
  - Ref: TRF-20251113-507-AS ✓
  - Tanggal: 11/12/2025
  - Upload bukti: [Choose File] quit.png
  - Catatan: "Pembayaran Nov 2025"
→ Klik "Simpan Pembayaran"
→ Status berubah: "Sudah Bayar" ✅
→ Refresh page → Status tetap "Sudah Bayar" ✅
```

### Supplier Side
```
Dompet Saya → Scroll down
→ Section "Notifikasi Pengiriman Uang dari Admin"
→ Muncul card:
  ┌──────────────────────────────────────┐
  │ +Rp 38.970           [Diterima]     │
  │ Ref: TRF-20251113-507-AS            │
  │ Bank: BCA - 1234567890              │
  │ Tanggal Transfer: 12 November 2025   │
  │ Catatan: Pembayaran Nov 2025        │
  │                      [Lihat Bukti]  │
  └──────────────────────────────────────┘
→ Klik "Lihat Bukti"
→ Modal terbuka dengan gambar bukti transfer
→ [Buka di Tab Baru] [Tutup]
```

```
Dashboard → Scroll to bottom
→ Section "Notifikasi Penjualan Real-time"
→ Table terisi:
  Waktu          | Produk  | Outlet | Qty | Harga    | Total
  13 Nov, 10:30 | Pastry  | K001   | 9   | Rp 4.050 | Rp 36.450
  13 Nov, 09:15 | Pizza   | K001   | 2   | Rp 3.600 | Rp 7.200
```

---

## 🎉 Expected Results

### ✅ Test Success Criteria

1. **Payment Flow:**
   - Admin save payment → Status "Sudah Bayar"
   - Refresh page → Status persist
   - Riwayat Pembayaran shows record

2. **Supplier Notification:**
   - Login as supplier
   - Go to "Dompet Saya"
   - See payment notification card
   - Click "Lihat Bukti" → Image loads
   - Saldo Tersedia increased

3. **Wallet Update:**
   - Before: Rp 5.500
   - Payment: +Rp 38.970
   - After: Rp 44.470
   - wallet_transactions has new record

4. **Sales Real-time:**
   - Dashboard shows sales table
   - Data from COMPLETED transactions
   - Latest sales on top
   - Pagination works

---

## 📄 Files Modified

1. `database/migrate-supplier-payments.sql` - Add missing columns
2. `database/fix-supplier-payments-status-constraint.sql` - Support COMPLETED status
3. `database/fix-supplier-payments-rls.sql` - RLS policies
4. `database/fix-supplier-payment-notifications.sql` - **NEW** Payment trigger
5. `frontend/src/app/supplier/wallet/page.tsx` - Display payment notifications
6. `frontend/src/app/supplier/page.tsx` - Sales real-time (already working)

---

## 🚀 Next Steps

1. Execute all SQL files in order
2. Test payment flow end-to-end
3. Verify notifications appear
4. Check wallet balance updates
5. Debug sales real-time if still empty
6. Deploy to production

---

**Created:** 2025-11-13
**Status:** Ready for Deployment
**Priority:** HIGH - Blocking supplier experience
