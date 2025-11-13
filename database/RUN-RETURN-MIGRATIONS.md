# 🚀 PANDUAN MENJALANKAN MIGRATION SISTEM RETUR

## ⚠️ URGENT - WAJIB DIJALANKAN SEBELUM TESTING

Sistem retur produk memerlukan 3 file SQL dijalankan di Supabase SQL Editor.

---

## 📋 LANGKAH-LANGKAH

### 1️⃣ Buka Supabase SQL Editor
- Link: https://supabase.com/dashboard/project/rpzoacwlswlhfqaiicho/sql/new
- Pastikan sudah login

### 2️⃣ Jalankan File SQL (URUTAN PENTING!)

#### **STEP 1: Tambah Kolom ke Tabel**
📄 File: `MIGRATE-ADD-RETURN-COLUMNS.sql`

```
1. Copy seluruh isi file
2. Paste ke SQL Editor
3. Klik "Run" atau tekan F5
4. Tunggu muncul pesan:
   ✅ Column migration completed!
   ✅ MIGRATION SUCCESS!
```

**Output yang diharapkan:**
```
🔍 Checking current table structure...
✅ Added column: product_id
✅ Added column: quantity
✅ Added column: location_id
✅ Added column: reason
✅ Added column: proof_photos
✅ Added column: requested_by
✅ Added column: requested_at
✅ Added column: reviewed_by
✅ Added column: reviewed_at
✅ Added column: review_notes
✅ Added column: completed_at
✅ Column migration completed!
📋 Final table structure: ...
📊 Existing data preserved: X records
✅ MIGRATION SUCCESS!
```

---

#### **STEP 2: Setup RLS Policies & Triggers**
📄 File: `CREATE-SHIPMENT-RETURNS-SAFE.sql`

```
1. Copy seluruh isi file
2. Paste ke SQL Editor (bisa tab baru)
3. Klik "Run"
4. Tunggu muncul pesan sukses
```

**Output yang diharapkan:**
```
Policies created
Triggers created
✅ Shipment returns system ready!
```

---

#### **STEP 3: Create RPC Functions**
📄 File: `CREATE-RETURN-RPC-FUNCTIONS.sql`

```
1. Copy seluruh isi file
2. Paste ke SQL Editor
3. Klik "Run"
4. Tunggu muncul pesan:
   ✅ Return RPC functions created!
```

**Functions yang dibuat:**
- `approve_return_request(uuid, text)` - Supplier setujui retur
- `reject_return_request(uuid, text)` - Supplier tolak retur
- `confirm_return_pickup(uuid)` - Supplier konfirmasi produk diambil
- `cancel_return_request(uuid)` - Admin batalkan retur

---

## ✅ VERIFIKASI SUKSES

Setelah menjalankan 3 file, test dengan cara:

1. **Buka Admin Panel** → Dashboard → Quick Actions → "Ajukan Retur Produk"
2. **Pilih produk** → Isi form → Submit
3. **Cek di "Riwayat Retur Produk"** → Status: "⏳ Menunggu Supplier"
4. **Login sebagai Supplier** → Management Pengiriman → Tab "Retur Produk"
5. **Review retur** → Setujui/Tolak
6. **Kembali ke Admin** → Cek status berubah menjadi "✅ Disetujui" atau "❌ Ditolak"

---

## 🔥 TROUBLESHOOTING

### Error: "column XXX does not exist"
- **Penyebab:** STEP 1 belum dijalankan atau gagal
- **Solusi:** Jalankan ulang `MIGRATE-ADD-RETURN-COLUMNS.sql`

### Error: "function XXX does not exist"
- **Penyebab:** STEP 3 belum dijalankan
- **Solusi:** Jalankan `CREATE-RETURN-RPC-FUNCTIONS.sql`

### Data retur tidak muncul di supplier
- **Penyebab:** RLS policies belum dibuat (STEP 2)
- **Solusi:** Jalankan `CREATE-SHIPMENT-RETURNS-SAFE.sql`

### Notification tidak terkirim
- **Penyebab:** Trigger belum dibuat (STEP 2)
- **Solusi:** Jalankan `CREATE-SHIPMENT-RETURNS-SAFE.sql`

---

## 📊 FITUR YANG AKAN AKTIF

✅ Admin dapat mengajukan retur produk rusak/cacat
✅ Supplier menerima notifikasi retur request
✅ Supplier dapat approve/reject retur dengan catatan
✅ Admin melihat status real-time (PENDING → APPROVED → COMPLETED)
✅ Tracking lengkap: requested_at, reviewed_at, completed_at
✅ Check & balance: Admin monitor, Supplier review, sinkron 2 arah
✅ Inventory otomatis berkurang saat pickup confirmed
✅ Notification otomatis ke admin & supplier

---

## 🎯 ALUR LENGKAP SISTEM RETUR

```
1. Admin menemukan produk rusak di etalase
   ↓
2. Admin ajukan retur via /admin/returns/create
   ↓
3. Sistem kirim notification ke supplier
   ↓
4. Supplier buka Management Pengiriman → Tab "Retur Produk"
   ↓
5. Supplier review: APPROVE atau REJECT (wajib isi alasan jika reject)
   ↓
6. Admin dapat lihat status di /admin/returns/list
   ↓
7. Jika APPROVED: Supplier ambil produk → Klik "Konfirmasi Produk Diambil"
   ↓
8. Inventory di lokasi otomatis berkurang
   ↓
9. Status berubah: COMPLETED ✅
```

---

## 📁 LOKASI FILE

Semua file SQL ada di folder:
```
konsinyasi/database/
├── MIGRATE-ADD-RETURN-COLUMNS.sql      (STEP 1)
├── CREATE-SHIPMENT-RETURNS-SAFE.sql    (STEP 2)
└── CREATE-RETURN-RPC-FUNCTIONS.sql     (STEP 3)
```

---

## 🔒 KEAMANAN & DATA

✅ **AMAN untuk dijalankan multiple kali** (idempotent)
✅ **TIDAK menghapus data** yang sudah ada
✅ **TIDAK duplikasi** kolom/function (auto skip jika sudah ada)
✅ **Foreign keys** terlindungi (ON DELETE CASCADE/SET NULL)
✅ **RLS policies** membatasi akses per role

---

## 🎉 SELESAI!

Setelah 3 migration sukses, sistem retur siap digunakan.

**Deployment:** Frontend otomatis deploy di Vercel (~2 menit)

**Testing:** Coba full flow admin → supplier → admin untuk pastikan sinkron!
