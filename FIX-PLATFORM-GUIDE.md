# 🚀 PANDUAN LENGKAP - Fix RLS & Setup Platform

## ⚠️ PENTING: SQL Scripts Harus Dijalankan Dulu!

Platform saat ini mengalami error karena **Row Level Security (RLS)** policies belum di-setup. Ikuti langkah-langkah berikut secara berurutan.

---

## 📋 LANGKAH 1: Jalankan SQL Scripts

### 1.1 Login ke Supabase Dashboard
1. Buka browser → https://supabase.com/dashboard
2. Login dengan akun Anda
3. Pilih project: **rpzoacwlswlhfqaiicho**
4. Klik **SQL Editor** di sidebar kiri

### 1.2 Jalankan SQL Script Utama
1. Buka file: **`database/fix-all-rls.sql`**
2. Copy **SELURUH ISI FILE** (dari DROP POLICY sampai akhir)
3. Paste di SQL Editor Supabase
4. Klik **RUN** atau tekan **Ctrl+Enter**
5. Tunggu sampai muncul notifikasi sukses

**⏱️ Estimasi waktu: 2-3 detik**

---

## 📦 LANGKAH 2: Setup Storage Bucket

### 2.1 Buat Bucket untuk Foto Produk
1. Di Supabase Dashboard, klik **Storage** di sidebar
2. Klik **Create a new bucket**
3. Isi form:
   - **Name:** `product-photos`
   - **Public bucket:** ✅ **Centang ini!** (PENTING)
   - **File size limit:** 5 MB
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp`
4. Klik **Create bucket**

### 2.2 Verifikasi Bucket
1. Setelah bucket dibuat, klik nama bucket `product-photos`
2. Pastikan ada icon **🌐 Public** di sebelah nama bucket
3. Jika tidak ada, klik **⚙️ Settings** → centang **Public bucket** → Save

---

## ✅ LANGKAH 3: Test Platform

### 3.1 Test Sebagai Supplier

**A. Registrasi Supplier Baru**
```
1. Buka: https://platform-konsinyasi-v1-o5zb41hqp-katalaras-projects.vercel.app/supplier/login
2. Klik "Belum punya akun? Daftar"
3. Isi:
   - Nama Lengkap: Test Supplier
   - Email: test@example.com (gunakan email asli!)
   - Password: test123456
4. Submit → Cek email untuk verifikasi
5. Klik link verifikasi di email
6. Kembali ke halaman login → Login
7. Akan masuk ke halaman Onboarding
8. Isi data bisnis:
   - Nama Bisnis: Toko Test
   - Alamat Bisnis: Jl. Test No. 123
   - Nomor Telepon: 08123456789
9. Submit → Masuk dashboard supplier
```

**B. Tambah Produk**
```
1. Di dashboard supplier, klik "Tambah Produk"
2. Isi form produk:
   - Nama: Produk Test
   - Deskripsi: Ini produk test
   - Harga: 50000
   - Komisi: (otomatis terisi dari settings)
   - Upload foto
3. Submit
4. Cek: TIDAK ADA ERROR RLS ✅
5. Produk muncul dengan status PENDING
```

**C. Ajukan Pengiriman**
```
1. Klik "Ajukan Pengiriman"
2. Pilih produk dari dropdown ✅ (harus muncul produk)
3. Masukkan jumlah: 100
4. Klik "Tambah"
5. Pilih lokasi tujuan ✅ (harus muncul lokasi)
6. Submit pengajuan
7. Success! ✅
```

### 3.2 Test Sebagai Admin

**A. Login Admin**
```
1. Buka: https://platform-konsinyasi-v1-o5zb41hqp-katalaras-projects.vercel.app/admin/login
2. Login dengan akun admin Anda
```

**B. Approve Supplier**
```
1. Di dashboard admin, lihat card "Suppliers"
2. Harus ada badge merah dengan angka pending ✅
3. Klik card "Kelola Suppliers"
4. Filter: PENDING
5. Lihat supplier baru yang mendaftar
6. Klik "Approve" → Supplier disetujui ✅
```

**C. Approve Product**
```
1. Di dashboard admin, lihat card "Products"
2. Harus ada badge merah dengan angka pending ✅
3. Klik card "Kelola Products"
4. Filter: PENDING
5. Klik "Detail" pada produk
6. Review detail produk
7. Klik "Approve Product" → Produk disetujui ✅
```

---

## 🔧 TROUBLESHOOTING

### ❌ Error: "Failed to load resource: 400"
**Penyebab:** RLS policies belum dijalankan  
**Solusi:** Jalankan `database/fix-all-rls.sql` di Supabase SQL Editor

### ❌ Error: "Photo upload failed: new row violates row-level security policy"
**Penyebab:** Bucket `product-photos` belum dibuat atau belum public  
**Solusi:**
1. Buat bucket `product-photos` di Supabase Storage
2. Pastikan **Public = TRUE**
3. Jalankan lagi `database/fix-all-rls.sql`

### ❌ Produk tidak muncul di dropdown "Ajukan Pengiriman"
**Penyebab:** Produk belum di-approve oleh admin  
**Solusi:**
1. Login sebagai admin
2. Approve produk di menu "Kelola Products"
3. Refresh halaman supplier

### ❌ Lokasi tidak muncul di dropdown
**Penyebab:** Belum ada lokasi aktif di database atau RLS policy belum jalan  
**Solusi:**
1. Jalankan `database/fix-all-rls.sql`
2. Admin buat lokasi baru di menu "Kelola Locations"

### ❌ Badge pending suppliers tidak muncul di admin
**Penyebab:** Supplier lama tidak punya status PENDING  
**Solusi:**
1. Daftar supplier baru (setelah fix) akan otomatis status PENDING
2. Atau update manual di database:
```sql
UPDATE suppliers SET status = 'PENDING' WHERE status IS NULL;
```

---

## 📊 Checklist Success

Setelah semua langkah di atas, platform harus berjalan normal:

### Supplier Dashboard:
- ✅ Bisa login/register tanpa error
- ✅ Bisa tambah produk + upload foto
- ✅ Bisa ajukan pengiriman (produk & lokasi muncul)
- ✅ Dashboard menampilkan statistik

### Admin Dashboard:
- ✅ Card suppliers menampilkan pending count
- ✅ Card products menampilkan pending count
- ✅ Bisa approve/reject supplier
- ✅ Bisa approve/reject product
- ✅ Bisa manage payments
- ✅ Bisa manage settings

---

## 🔗 Links Penting

**Production URL:**  
https://platform-konsinyasi-v1-o5zb41hqp-katalaras-projects.vercel.app

**Supabase Dashboard:**  
https://supabase.com/dashboard/project/rpzoacwlswlhfqaiicho

**SQL Scripts:**
- Main fix: `database/fix-all-rls.sql` ⭐ (JALANKAN INI DULU)
- Products only: `database/fix-products-rls-v2.sql`
- Locations only: `database/fix-locations-rls-v2.sql`
- Suppliers only: `database/fix-suppliers-rls.sql`
- Storage only: `database/fix-storage-rls.sql`

---

## 💡 Tips

1. **Selalu gunakan email asli** saat registrasi (Gmail, Yahoo, dll)
2. **Cek email spam** jika link verifikasi tidak masuk
3. **Refresh browser** setelah approve supplier/product
4. **Test di incognito mode** jika ada cache issue
5. **Buka console browser** (F12) untuk lihat error detail

---

## 📞 Support

Jika masih ada error setelah menjalankan semua langkah:
1. Screenshot error di browser console (F12)
2. Screenshot error di network tab (F12 → Network)
3. Share detail langkah yang sudah dilakukan

---

**Last Updated:** 2025-11-10  
**Platform Version:** v1.0  
**Database:** Supabase (rpzoacwlswlhfqaiicho)  
**Hosting:** Vercel
