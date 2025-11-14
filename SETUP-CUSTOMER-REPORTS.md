# 🚀 Setup Customer Reports - Step by Step

## ✅ Status Saat Ini
- ✅ Frontend code sudah deploy (commit f269ed5)
- ✅ ReportProductModal component ready
- ✅ Tombol "Laporkan Masalah" sudah ada di catalog
- ⏳ Database migration perlu dijalankan
- ⏳ Storage bucket perlu dibuat
- ⏳ RPC notification functions perlu dibuat

---

## 📋 Step-by-Step Execution

### Step 1: Extend shipment_returns Table (5 menit)

1. **Buka Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/rpzoacwlswlhfqaiicho
   - Login dengan akun Anda

2. **Buka SQL Editor**
   - Sidebar kiri → **SQL Editor**
   - Click **+ New Query**

3. **Copy Paste SQL Migration**
   - Buka file: `database/ADD-CUSTOMER-REPORT-COLUMNS.sql`
   - Copy SEMUA isinya
   - Paste ke SQL Editor

4. **Execute**
   - Click tombol **Run** (atau Ctrl+Enter)
   - Tunggu hingga selesai
   - Harus muncul pesan success: "Success. No rows returned"

5. **Verify**
   ```sql
   -- Jalankan query ini untuk cek kolom baru:
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'shipment_returns'
   AND column_name IN ('source', 'customer_name', 'customer_contact', 'severity');
   ```
   Harus muncul 4 rows (4 kolom baru).

---

### Step 2: Create Notification RPC Functions (5 menit)

1. **Buka SQL Editor lagi**
   - Click **+ New Query**

2. **Copy Paste Notification Functions**
   - Buka file: `database/CREATE-CUSTOMER-REPORT-NOTIFICATIONS.sql`
   - Copy SEMUA isinya
   - Paste ke SQL Editor

3. **Execute**
   - Click **Run**
   - Harus muncul tabel dengan 2 functions:
     - `notify_admin_customer_report`
     - `notify_supplier_customer_report`

4. **Verify**
   ```sql
   -- Test notification function:
   SELECT notify_admin_customer_report(
     gen_random_uuid(), -- dummy return_id
     'Test Product',
     'MEDIUM'
   );
   ```
   Harus success (no error).

---

### Step 3: Create Storage Bucket (2 menit)

1. **Buka Storage**
   - Sidebar kiri → **Storage**
   - Click **Create a new bucket**

2. **Bucket Settings**
   - **Name**: `product-reports`
   - **Public bucket**: ✅ YES (centang)
   - **File size limit**: `5242880` (5MB)
   - **Allowed MIME types**: Leave empty (allow all images)
   
3. **Create Bucket**
   - Click **Create bucket**
   - Bucket `product-reports` harus muncul di list

4. **Set Public Access Policy**
   - Click bucket `product-reports`
   - Tab **Policies**
   - Click **New Policy**
   - **Policy template**: Select "Allow public read access"
   - **Policy name**: `Public Read Access`
   - Click **Review** → **Save Policy**

---

### Step 4: Test Customer Report Flow (10 menit)

#### A. Test dari Customer Catalog

1. **Buka PWA Kantin**
   - URL: `https://platform-konsinyasi-v1.vercel.app/kantin/outlet_lobby_a`
   - (Ganti dengan QR code location yang sesuai)

2. **Pilih Produk**
   - Scroll halaman catalog
   - Pilih produk yang ada

3. **Klik Tombol "⚠️ Laporkan Masalah"**
   - Tombol merah dengan border di bawah tombol "Tambah"

4. **Isi Form**
   - **Jenis Masalah**: Pilih "🚫 Produk Rusak/Cacat"
   - **Tingkat Keparahan**: Pilih "🔴 Critical"
   - **Deskripsi**: Ketik "Test laporan customer - produk rusak"
   - **Upload Foto**: Upload 1-3 foto (optional)
   - **Nama**: Ketik "Test Customer" (optional)
   - **Kontak**: Ketik "08123456789" (optional)

5. **Kirim Laporan**
   - Click **"Kirim Laporan"**
   - Harus muncul toast success: "Laporan berhasil dikirim!"
   - Modal otomatis tutup

#### B. Verify di Database

```sql
-- Cek record baru
SELECT 
    id,
    source,
    product_id,
    supplier_id,
    problem_type,
    description,
    severity,
    customer_name,
    customer_contact,
    proof_photos,
    status,
    created_at
FROM shipment_returns
WHERE source = 'CUSTOMER'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- `source` = 'CUSTOMER'
- `problem_type` = 'PRODUCT_DEFECT'
- `severity` = 'CRITICAL'
- `description` = "Test laporan customer - produk rusak"
- `customer_name` = "Test Customer"
- `customer_contact` = "08123456789"
- `proof_photos` = array of storage URLs
- `status` = 'PENDING'

#### C. Verify Notifications Sent

```sql
-- Cek notifikasi admin
SELECT *
FROM notifications
WHERE type = 'CUSTOMER_REPORT'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:**
- Ada notifikasi untuk admin
- Ada notifikasi untuk supplier terkait
- `title` = "Laporan Produk Bermasalah dari Customer"
- `message` berisi nama produk dan severity

#### D. Check Storage

1. Buka Supabase Storage → `product-reports` bucket
2. Harus ada file foto yang di-upload (jika customer upload foto)
3. File naming: `{timestamp}-{random}.{ext}`

#### E. Verify di Admin Dashboard

1. **Login sebagai Admin**
   - URL: `https://platform-konsinyasi-v1.vercel.app/admin/login`

2. **Buka Shipments**
   - Menu: **Suppliers** → **Pengiriman & Retur**
   - URL: `/admin/suppliers/shipments?tab=returns`

3. **Klik Tab "👥 Retur Customer"**
   - Harus ada 1 record baru
   - Badge "CUSTOMER" warna ungu
   - Severity badge "CRITICAL" warna merah
   - Nama customer: "Test Customer"
   - Kontak customer: "08123456789"

4. **Klik Preview**
   - Modal buka dengan detail lengkap
   - Foto customer (jika ada) tampil di gallery
   - Description: "Test laporan customer - produk rusak"

#### F. Verify di Supplier Dashboard

1. **Login sebagai Supplier** (supplier dari produk yang dilaporkan)
   - URL: `https://platform-konsinyasi-v1.vercel.app/supplier/login`

2. **Buka Shipments**
   - Menu: **Pengiriman & Retur**
   - Tab: **Returns**

3. **Check Record**
   - Harus muncul laporan customer
   - Status: PENDING
   - Badge "CUSTOMER" atau indikasi source

4. **Check Notification**
   - Header bell icon harus ada badge count
   - Click bell → ada notifikasi:
     - "Customer Melaporkan Masalah Produk"
     - "Customer melaporkan masalah pada produk Anda: [nama produk]. Admin akan menindaklanjuti."

---

## 🐛 Troubleshooting

### Error: "Column 'source' does not exist"
**Penyebab**: Migration `ADD-CUSTOMER-REPORT-COLUMNS.sql` belum dijalankan  
**Solusi**: Execute Step 1 terlebih dahulu

### Error: "Function notify_admin_customer_report does not exist"
**Penyebab**: RPC functions belum dibuat  
**Solusi**: Execute Step 2

### Error: "Failed to upload photo"
**Penyebab 1**: Bucket `product-reports` belum dibuat  
**Solusi**: Execute Step 3

**Penyebab 2**: Bucket tidak public  
**Solusi**: Set bucket ke public:
1. Storage → product-reports
2. Settings → Make public
3. Atau tambah RLS policy untuk public INSERT

### Photo upload berhasil tapi tidak tampil
**Penyebab**: Bucket policy tidak allow public read  
**Solusi**: 
1. Storage → product-reports → Policies
2. Create policy: Allow public SELECT
3. SQL:
```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-reports');
```

### Modal tidak muncul saat klik "Laporkan Masalah"
**Penyebab**: Component ReportProductModal belum ter-deploy  
**Solusi**: Vercel auto-deploy setelah git push (commit f269ed5)
- Check deployment status: https://vercel.com/soedirboy58/platform-konsinyasi
- Tunggu build selesai (~2 menit)

### Data tidak masuk ke shipment_returns
**Penyebab**: RLS (Row Level Security) blocking  
**Debug**:
```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'shipment_returns';

-- If rowsecurity = true, temporarily disable:
ALTER TABLE shipment_returns DISABLE ROW LEVEL SECURITY;

-- Test submit lagi, lalu re-enable:
ALTER TABLE shipment_returns ENABLE ROW LEVEL SECURITY;
```

### Notification tidak terkirim
**Penyebab**: RPC function error  
**Debug**:
1. Check browser console untuk error message
2. Test RPC di SQL Editor:
```sql
SELECT notify_admin_customer_report(
    gen_random_uuid(),
    'Test Product',
    'MEDIUM'
);
```
3. Check notification table:
```sql
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;
```

---

## ✅ Final Checklist

Setelah setup selesai, pastikan:

- [ ] Execute `ADD-CUSTOMER-REPORT-COLUMNS.sql` ✅
- [ ] Execute `CREATE-CUSTOMER-REPORT-NOTIFICATIONS.sql` ✅
- [ ] Create storage bucket `product-reports` ✅
- [ ] Set bucket to public ✅
- [ ] Test customer submit report ✅
- [ ] Verify data masuk ke `shipment_returns` with `source='CUSTOMER'` ✅
- [ ] Verify notifications sent to admin & supplier ✅
- [ ] Verify photos uploaded to storage ✅
- [ ] Verify admin can see in tab "Retur Customer" ✅
- [ ] Verify supplier can see in returns tab ✅
- [ ] Re-enable RLS (jika sempat disabled) ✅

---

## 🎯 Expected Behavior After Setup

### Customer Experience:
1. Customer buka catalog kantin (PWA)
2. Lihat produk bermasalah (rusak/kadaluarsa/dll)
3. Klik tombol "⚠️ Laporkan Masalah" di card produk
4. Modal muncul dengan form lengkap
5. Pilih jenis masalah, severity, isi deskripsi
6. Upload max 3 foto bukti
7. Optional: isi nama & kontak
8. Klik "Kirim Laporan"
9. Toast success → Modal tutup
10. Customer bisa lanjut belanja atau close app

### Admin Experience:
1. Admin login
2. Ada notification "Laporan Produk Bermasalah dari Customer"
3. Buka menu Suppliers → Pengiriman & Retur
4. Klik tab "👥 Retur Customer"
5. Lihat list semua laporan dari customer
6. Filter by severity (Low/Medium/High/Critical)
7. Badge "CUSTOMER" untuk distinguish dari retur admin
8. Klik "Preview" untuk lihat detail + foto
9. Bisa approve/reject (future: add action buttons)

### Supplier Experience:
1. Supplier login
2. Ada notification "Customer Melaporkan Masalah Produk"
3. Buka menu Pengiriman & Retur → Tab Returns
4. Lihat laporan untuk produk mereka saja
5. Bisa lihat deskripsi, foto bukti, severity
6. Status PENDING (waiting admin review)
7. Setelah admin approve → status jadi APPROVED → supplier proses retur

---

## 📊 Data Flow Summary

```
Customer Report Submission
           ↓
1. Upload photos to storage (product-reports bucket)
           ↓
2. Insert to shipment_returns:
   - source = 'CUSTOMER'
   - status = 'PENDING'
   - product_id, supplier_id
   - problem_type, severity
   - description, proof_photos
   - customer_name, customer_contact (optional)
           ↓
3. Call RPC notify_admin_customer_report()
   → Insert notification for all admins
           ↓
4. Call RPC notify_supplier_customer_report()
   → Insert notification for supplier
           ↓
5. Show success toast to customer
           ↓
Admin sees in: /admin/suppliers/shipments?tab=returns (Tab "Retur Customer")
Supplier sees in: /supplier/shipments?tab=returns
```

---

**Deployment Status**: ✅ All code deployed (commit f269ed5)  
**Database Setup**: ⏳ Pending execution of SQL migrations  
**Ready to Test**: Setelah Step 1-3 selesai

