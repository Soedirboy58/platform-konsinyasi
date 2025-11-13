# Konsep Bisnis Platform Konsinyasi

## 📊 Model Bisnis

### Penjelasan Sistem Konsinyasi
Platform ini beroperasi dengan **model konsinyasi**, di mana:

1. **Supplier** menitipkan produk ke platform/toko
2. **Harga produk** = harga jual final ke customer (sudah ditentukan supplier)
3. Saat produk **terjual**, platform memotong **komisi/fee** untuk operational
4. **Supplier menerima** pembayaran setelah dipotong komisi

### Contoh Perhitungan

```
Harga Jual Produk ke Customer:  Rp 100.000
Komisi Platform (10%):          Rp  10.000 (-)
─────────────────────────────────────────────
Supplier Terima:                Rp  90.000
```

**Penting:** 
- Admin/Platform **TIDAK membayar komisi** ke supplier
- Admin/Platform **MEMOTONG komisi** dari hasil penjualan
- Supplier terima = Harga Jual - Komisi Platform

## 💰 Alur Keuangan

### 1. Produk Masuk (Konsinyasi)
- Supplier titip produk ke toko
- Supplier set harga jual (contoh: Rp 100.000)
- Tidak ada transaksi keuangan

### 2. Produk Terjual
- Customer beli produk Rp 100.000
- Uang masuk ke platform
- Sistem catat: 
  - Total penjualan: Rp 100.000
  - Fee platform (10%): Rp 10.000
  - Terutang ke supplier: Rp 90.000

### 3. Pembayaran ke Supplier
- Admin transfer Rp 90.000 ke rekening supplier
- Upload bukti transfer
- Status pembayaran: PAID
- Platform keep: Rp 10.000 sebagai fee operational

## ⚙️ Pengaturan Komisi

### Default Setting
- **Komisi Platform**: 10% dari harga jual
- **Supplier Terima**: 90% dari harga jual
- **Dapat diubah** di menu: Pengaturan → Pengaturan Komisi

### Simulasi Berbagai Rate

| Komisi Platform | Harga Jual | Fee Platform | Supplier Terima |
|-----------------|------------|--------------|-----------------|
| 5%              | Rp 100.000 | Rp 5.000     | Rp 95.000       |
| 10%             | Rp 100.000 | Rp 10.000    | Rp 90.000       |
| 15%             | Rp 100.000 | Rp 15.000    | Rp 85.000       |
| 20%             | Rp 100.000 | Rp 20.000    | Rp 80.000       |

## 📋 Menu Keuangan & Pembayaran

### 1. Pembayaran Supplier (`/admin/payments/commissions`)
**Fungsi:** Kelola transfer pembayaran ke supplier

**Fitur:**
- List supplier dengan total penjualan
- Kalkulasi otomatis: Total Penjualan - Fee Platform
- Upload bukti transfer (foto/PDF)
- Input nomor referensi transfer
- Filter periode dan status
- Export laporan Excel

**Workflow:**
1. Lihat supplier yang belum dibayar
2. Klik tombol "Bayar"
3. Transfer manual ke rekening supplier (jumlah sudah dipotong komisi)
4. Upload bukti transfer + nomor referensi
5. Status berubah jadi "Sudah Bayar"

### 2. Riwayat Pembayaran (`/admin/payments/history`)
**Fungsi:** History semua transfer yang sudah dilakukan

**Fitur:**
- List pembayaran dengan tanggal, nominal, referensi
- Search by supplier atau nomor referensi
- Filter periode
- Export PDF

### 3. Rekonsiliasi (`/admin/payments/reconciliation`)
**Fungsi:** Cross-check pembayaran vs penjualan

**Fitur:**
- Bandingkan: Total Penjualan vs Yang Diterima Supplier vs Sudah Dibayar
- Status: Matched, Belum Bayar, Kurang Bayar, Lebih Bayar
- Deteksi anomali pembayaran
- Refresh data real-time

## 🎯 Terminologi yang Benar

| ❌ Salah | ✅ Benar |
|----------|----------|
| "Bayar komisi ke supplier" | "Transfer pembayaran ke supplier" |
| "Komisi supplier 10%" | "Fee platform 10%" |
| "Admin bayar 10% komisi" | "Admin potong 10% fee" |
| "Supplier terima komisi" | "Supplier terima 90% dari penjualan" |

## 📊 Laporan Keuangan

### Revenue Platform
```
Total Fee Platform = Σ (Penjualan × Komisi Rate)

Contoh:
- Produk A terjual: Rp 100.000 × 10% = Rp 10.000
- Produk B terjual: Rp 50.000 × 10% = Rp 5.000
─────────────────────────────────────────────────
Total Revenue Platform = Rp 15.000
```

### Pembayaran ke Supplier
```
Transfer ke Supplier = Total Penjualan - Fee Platform

Contoh:
- Total penjualan supplier A: Rp 1.000.000
- Fee platform 10%: Rp 100.000
─────────────────────────────────────────────────
Transfer ke Supplier A = Rp 900.000
```

## 🚀 Roadmap Fitur

### Fase 1 (Current) - Manual
- ✅ Kalkulasi otomatis fee dan transfer amount
- ✅ Upload bukti transfer manual
- ✅ Tracking status pembayaran
- ✅ Rekonsiliasi manual

### Fase 2 - Semi Otomatis
- ⏳ Notifikasi email ke supplier saat pembayaran ready
- ⏳ Generate invoice PDF otomatis
- ⏳ Schedule pembayaran berkala
- ⏳ Dashboard revenue analytics

### Fase 3 - Full Automation
- ⏳ Integrasi payment gateway (Xendit, Midtrans)
- ⏳ Auto transfer ke rekening supplier
- ⏳ Disbursement otomatis sesuai jadwal
- ⏳ E-wallet integration
- ⏳ Tax calculation & reporting

## 📞 Support

Untuk pertanyaan atau masalah terkait pembayaran, hubungi:
- Admin Platform
- Email: support@platform.com
- WhatsApp: +62xxx-xxxx-xxxx
