# Development Summary - Platform Konsinyasi v2.4.0+

**Project:** Platform Konsinyasi Terintegrasi  
**Status:** ✅ Production Active  
**Last Updated:** 6 Juni 2026  
**Primary Domain:** `https://smartvalley.katalara.com`

---

## 1. Snapshot Progres

Platform sudah berada pada fase production aktif untuk operasional inti konsinyasi. Area yang saat ini paling matang adalah admin operations, supplier workflow, outlet-based self-checkout, dan reporting dasar. Perkembangan terbaru berfokus pada stabilitas auth, administrasi internal, dan kesiapan fondasi untuk payment provider yang lebih dinamis.

---

## 2. Riwayat Versi Singkat

| Version | Tanggal | Highlight |
|---------|---------|-----------|
| v2.4.0 | 1–4 Jun 2026 | Supplier balance accuracy (snapshot), migration 048/049/050, UI mobile commissions |
| v2.3.1 | 1 Jun 2026 | Checkout manual verification hardening, admin sales control page, migration 047, supplier card calculation fixes |
| v2.3.0 | 26 Mei 2026 | Admin user management, notification bell, email templates, auth flow fixes, domain migration |
| v2.2.0 | 26 Mei 2026 | Redesign pembayaran supplier ke card view |
| v2.1.0 | 26 Mei 2026 | Fix phantom deduction via migration 044 + cleanup job |
| v2.0.0 | 26 Mei 2026 | Landing page baru, rebrand amber/gold, supplier marquee |
| v1.9.0 | 30 Mar 2026 | Homepage banners, outlet carousel, per-outlet PWA manifest |
| v1.8.0 | 30 Mar 2026 | Migrasi alert/confirm ke toast + confirm dialog |
| v1.7.0 | 29 Mar 2026 | Category system dan QRIS per outlet |
| v1.6.0 | 29 Mar 2026 | Outlet customization |
| v1.5.0 | 28 Mar 2026 | Auto-cancel pending, expiry, payment proof |

Dokumen release detail: [AI-GUIDE/CHANGELOG.md](../AI-GUIDE/CHANGELOG.md)

---

## 3. Modul Yang Sudah Berjalan

### Admin
- Dashboard operasional
- Persetujuan supplier
- Moderasi produk
- Kelola lokasi/outlet
- Laporan penjualan dan stok
- Pembayaran supplier dengan card view
- Banner homepage dan outlet customization
- Manajemen user admin beserta role internal
- Notification bell realtime

### Supplier
- Login, registrasi, verifikasi email
- Dashboard ringkas
- CRUD produk
- Pengiriman stok dan tracking status
- Retur barang
- Histori pembayaran atau komisi
- Notification bell realtime

### Customer / Kantin
- Self-checkout per outlet di `/kantin/[slug]`
- Cart dan checkout flow
- Upload bukti pembayaran
- QRIS per outlet
- Carousel dan branding per outlet
- Dynamic PWA manifest per outlet
- Mode manual verification 3 menit untuk QRIS statis
- Copy nominal pembayaran untuk memudahkan transfer manual

### Admin Finance / Payments
- Card pembayaran supplier dengan status `UNPAID`, `PENDING`, `PAID`
- Halaman kontrol intervensi transaksi: `/admin/payments/control`
- Aksi manual: tandai `COMPLETED` atau `CANCELLED + restore stock`
- SQL diagnostic toolkit mismatch saldo supplier
- UI mobile card "Siap Dibayar" dan "Akumulasi" dirancang ulang (v2.4.0)

---

## 4. Perubahan Terkini Yang Penting Untuk Diingat

### 4.1 Admin Invite & Set Password
- Halaman baru: `frontend/src/app/admin/set-password/page.tsx`
- Invite admin sekarang diarahkan langsung ke halaman client-side tersebut
- Token auth Supabase untuk invite diproses dari URL hash menggunakan `setSession()` manual
- Ini diperlukan karena project Supabase berjalan dengan implicit flow, sedangkan helper Next.js default ke PKCE

### 4.2 Supplier Signup Verification
- Redirect verifikasi email supplier kembali ke `/login?verified=true`
- Callback auth tidak lagi jatuh ke homepage saat profile belum siap dibaca

### 4.3 Domain Production
- Domain aktif production: `smartvalley.katalara.com` (diperbarui dari `smartalley.katalara.com`)
- Vercel domain tetap ada sebagai fallback deployment URL
- Supabase Site URL dan redirect auth perlu tetap selaras dengan domain ini

### 4.4 Admin Internal Operations
- Admin role granular: `MANAGER`, `PRODUCT`, `MITRA`, `FINANCE`
- CRUD user admin sudah tersedia dari settings page
- Reset password admin memakai service role API route

### 4.5 Notification System
- Bell icon di admin dan supplier layout
- Realtime subscription ke tabel `notifications`
- Trigger SQL tersedia di migration 046
- **Kolom `priority`, `action_url`, `metadata` wajib ada** — ditambah via migration 048

### 4.6 Manual Sales Control
- API route: `frontend/src/app/api/admin/transactions/control/route.ts`
- UI: `frontend/src/app/admin/payments/control/page.tsx`
- DB function: `admin_adjust_sales_transaction()`
- Migration wajib: `backend/migrations/047_admin_adjust_sales_transactions.sql`

### 4.7 Supplier Balance Accuracy (v2.4.0 — PENTING)
**Akar masalah yang ditemukan:** Kalkulasi saldo supplier berbasis `product.supplier_id` saat ini — jika produk berpindah supplier atau dihapus, histori penjualan hilang dari perhitungan.

**Solusi yang diterapkan:**
- Migration 049: kolom `supplier_id` ditambahkan ke `sales_transaction_items` sebagai **snapshot** pada saat transaksi
- Kolom ini dibackfill dari `products.supplier_id` untuk data historis
- Fungsi `process_anonymous_checkout()` diperbarui untuk mengisi `supplier_id` saat checkout berlangsung
- Semua query di `admin/payments/commissions`, `supplier/sales-report`, dan `supplier/wallet` kini pakai snapshot-first pattern:
  1. Coba query dengan `.eq('supplier_id', ...)` langsung di item
  2. Jika kolom belum ada (error `column does not exist`), fallback ke join via `products.supplier_id`

**File yang diubah:**
- `frontend/src/app/admin/payments/commissions/page.tsx`
- `frontend/src/app/supplier/sales-report/page.tsx`
- `frontend/src/app/supplier/wallet/page.tsx`

**Verifikasi:** `database/RECONCILE-SUPPLIER-COMMISSION-CARDS.sql` — query audit cross-check semua saldo supplier. Hasil verifikasi di production sudah valid per 1 Juni 2026.

### 4.8 supplier_payments Schema Fix (v2.4.0)
- Trigger `notify_supplier_payment_received` (dari migration 046) mencoba baca `NEW.paid_at`
- Kolom `paid_at` tidak ada di tabel `supplier_payments` → error 400 saat konfirmasi pembayaran
- **Fix:** Migration 050 menambah `paid_at TIMESTAMPTZ` ke tabel `supplier_payments`
- File: `backend/migrations/050_add_paid_at_to_supplier_payments.sql`
- **Status:** Perlu dijalankan manual di Supabase SQL Editor

### 4.9 Deploy Workflow
- Deploy production via: `npx vercel --prod` dari **root repo** (`konsinyasi/`), bukan dari `frontend/`
- Jika dijalankan dari `frontend/`, Vercel mendeteksi path ganda (`frontend/frontend`) dan error
- Git push ke GitHub masih terblokir karena credential Windows Credential Manager menyimpan token `katalaraofficial-cpu` yang tidak punya akses write ke `Soedirboy58/platform-konsinyasi`
- Solusi push: `echo "protocol=https\nhost=github.com" | git credential reject` → login ulang dengan Soedirboy58

### 4.10 DOKU Checkout Integration Progress (6 Juni 2026)
- Route baru dibuat: `frontend/src/app/api/doku/create-payment/route.ts`
- Integrasi frontend checkout ditambah: tombol "Bayar via DOKU" pada `frontend/src/app/kantin/[slug]/checkout/page.tsx`
- DOKU flow dipisah dari flow QRIS agar tidak mengganggu operasi payment yang sedang berjalan
- Ditambahkan mekanisme retry DOKU tanpa create transaksi DB baru (menghindari decrement stok berulang)
- Webhook DOKU tetap menggunakan route existing `frontend/src/app/api/doku/notification/route.ts`
- Hasil uji lokal saat ini: request ke DOKU sandbox masih sering `invalid_client_id`; ada juga kejadian `UND_ERR_CONNECT_TIMEOUT` intermiten
- Analisa sementara: akun sandbox aktif dan credential sandbox belum sepenuhnya sinkron di env runtime

---

## 5. Status Payment & QRIS

### Yang Sudah Siap
- QRIS outlet/manual aktif di flow checkout
- Bukti pembayaran customer disimpan dan diverifikasi lewat alur yang sudah ada
- Struktur database untuk provider payment modern sudah tersedia
- API route Midtrans: `frontend/src/app/api/create-qris/route.ts`

### Yang Belum Final di Production
- Dynamic QRIS feature flag nonaktif (`NEXT_PUBLIC_ENABLE_DYNAMIC_QRIS=false`)
- Integrasi DOKU Checkout sudah diimplementasikan di codebase namun belum lolos UAT end-to-end karena validasi credential sandbox
- Xendit hanya jejak eksperimen lama, bukan jalur aktif

---

## 6. Statistik Teknis

### Backend
- 50 migration SQL di `backend/migrations` (001–050)
- 20+ tabel utama dan pendukung
- RLS aktif untuk tabel inti
- Trigger, function, dan cleanup jobs untuk inventory dan transaksi
- `pg_cron` untuk auto-cancel dan cleanup pending transaction

### Frontend
- Next.js 14.2.29 App Router
- 20+ halaman lintas admin, supplier, public, dan checkout
- Route handler untuk auth callback, manifest PWA, dan create QRIS
- Sonner dipakai untuk toast dan feedback UI

### Deployment
- Frontend: Vercel
- Backend: Supabase Cloud
- Primary domain: `smartvalley.katalara.com`
- Scope Vercel aktif: `katalaras-projects`
- Safe deploy command: `npx vercel --prod --yes --scope katalaras-projects`

---

## 7. Manual Tasks / Follow-up Operasional

- [ ] Pastikan migration `046_notification_triggers.sql` sudah dijalankan di environment production yang aktif
- [ ] Jalankan migration `047_admin_adjust_sales_transactions.sql` sebelum operasional halaman kontrol manual penjualan
- [ ] Jalankan migration `050_add_paid_at_to_supplier_payments.sql` jika belum dieksekusi di production
- [ ] Pasang template email HTML di Supabase Dashboard
- [ ] Pastikan env `NEXT_PUBLIC_SITE_URL` mengarah ke domain production baru
- [ ] Re-invite akun admin uji jika pengujian masih memakai link lama
- [ ] Sinkronkan credential DOKU sandbox (Client ID + Secret Key) dari akun sandbox yang sama di `frontend/.env.local`
- [ ] Konfirmasi aktivasi produk DOKU Checkout/Payment Link untuk akun sandbox yang dipakai UAT
- [ ] Putuskan strategi gateway: tetap Midtrans-only, tambah abstraction multi-provider, atau migrasi provider

---

## 8. Rekomendasi Update Berikutnya

1. Rapikan abstraction payment provider agar Midtrans dan DOKU memakai kontrak service yang sama.
2. Finalisasi UAT DOKU sandbox hingga redirect `payment_url` dan callback sukses tervalidasi.
3. Tambahkan audit log permanen untuk intervensi manual transaksi admin.
4. Sinkronkan dokumen lama lain di folder `docs/` yang masih menyebut status fase awal development.

---

## 9. Canonical Sources

- [AI-GUIDE/README.md](../AI-GUIDE/README.md) untuk arsitektur dan pola pengembangan
- [AI-GUIDE/CHANGELOG.md](../AI-GUIDE/CHANGELOG.md) untuk histori rilis
- [README.md](../README.md) untuk ringkasan repo dan status terkini

---

**Current Assessment:** stabil untuk operasional inti dengan mitigasi manual transaksi sudah tersedia, namun integrasi payment provider dinamis masih tahap transisi.  
**Recommended Next Focus:** integrasi DOKU + audit log intervensi manual + penyelarasan dokumen historis tersisa.
