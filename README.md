# 🏪 Platform Konsinyasi Katalara

Platform digital manajemen konsinyasi yang menghubungkan supplier, admin toko, dan customer dalam satu ekosistem operasional untuk stok, penjualan, pembayaran, dan pelaporan.

**Version:** `v2.4.0`  
**Status:** ✅ Production Active  
**Last Updated:** 6 Juni 2026  
**Production URL:** [smartvalley.katalara.com](https://smartvalley.katalara.com)  
**Repository:** `Soedirboy58/platform-konsinyasi`  
**Branch:** `main`

## Ringkasan Status

Platform saat ini sudah berjalan di production dengan modul utama admin, supplier, dan self-checkout kantin. Fokus pengembangan terbaru ada pada akurasi saldo supplier berbasis snapshot attribution, perbaikan kolom yang kurang di trigger notifikasi, serta peningkatan UI mobile halaman pembayaran komisi admin.

Domain production aktif: `smartvalley.katalara.com`. Migration 049 (kolom `supplier_id` snapshot di `sales_transaction_items`) sudah dijalankan di production DB. Migration 050 (`paid_at` di `supplier_payments`) perlu segera dijalankan untuk menghapus error konfirmasi pembayaran.

## Update Terakhir (6 Juni 2026)

Update ini berfokus pada integrasi DOKU Checkout tanpa mengganggu alur QRIS yang sudah live:

- ✅ Ditambahkan route baru DOKU Checkout: `frontend/src/app/api/doku/create-payment/route.ts`
- ✅ Ditambahkan tombol customer: "Bayar via DOKU" di `frontend/src/app/kantin/[slug]/checkout/page.tsx`
- ✅ Flow DOKU dipisahkan dari flow QRIS (tidak mengubah jalur QRIS aktif)
- ✅ Ditambahkan mekanisme retry DOKU tanpa membuat transaksi DB ulang (mencegah pengurangan stok ganda)
- ✅ `.env.example` diperbarui dengan `DOKU_IS_SANDBOX=true`
- ⚠️ Pengujian lokal masih terkendala `invalid_client_id` dari DOKU sandbox (indikasi mismatch akun atau produk/credential sandbox belum sinkron)
- ⚠️ Terdapat kejadian `UND_ERR_CONNECT_TIMEOUT` intermiten saat akses endpoint DOKU sandbox

## Progress Terkini

### Yang Sudah Live
- ✅ Admin panel untuk supplier, produk, stok, laporan, pembayaran supplier, settings, dan user admin
- ✅ Supplier portal untuk produk, pengiriman stok, retur, dan histori pembayaran
- ✅ Self-checkout PWA per outlet dengan keranjang, checkout, dan upload bukti pembayaran
- ✅ Outlet customization: logo, brand, gradient, QRIS, carousel slides, homepage banners
- ✅ Notification bell di admin dan supplier layout
- ✅ Admin user management: invite, edit profile, role admin, reset password, delete guard
- ✅ Auth flow admin invite ke halaman set password khusus
- ✅ Supplier signup email verification yang kembali ke login success state
- ✅ Domain production aktif: `smartvalley.katalara.com`
- ✅ Checkout QRIS statis mode manual verification (3 menit upload bukti)
- ✅ Halaman kontrol intervensi penjualan admin di `/admin/payments/control`
- ✅ API admin untuk ubah status transaksi + sinkronisasi stok otomatis
- ✅ SQL toolkit tracking mismatch saldo supplier
- ✅ Migration 048: kolom `priority`, `action_url`, `metadata` di tabel `notifications`
- ✅ Migration 049: kolom `supplier_id` snapshot di `sales_transaction_items` + backfill + update trigger checkout
- ✅ Migration 050: kolom `paid_at` di `supplier_payments` (fix trigger error)
- ✅ Fix akurasi saldo supplier: query snapshot-first di semua view admin & supplier
- ✅ UI mobile `/admin/payments/commissions` diperbarui: card profesional Siap Dibayar & Akumulasi

### Infrastruktur yang Sudah Ada
- ✅ 50 migration SQL di `backend/migrations`
- ✅ Supabase Auth, Storage, PostgreSQL, RLS
- ✅ `pg_cron` untuk auto-cancel pending transaction dan cleanup phantom deduction
- ✅ Template email HTML untuk invite admin, verifikasi email supplier, reset password
- ✅ API route QRIS Midtrans untuk dynamic QR test path

## Status Payment Saat Ini

Status payment perlu dibaca hati-hati agar tidak salah asumsi:

- ✅ Checkout production saat ini masih mendukung alur QRIS outlet/manual upload bukti bayar
- ✅ Auto-verification tidak lagi dipaksakan untuk QRIS statis (hanya aktif jika dynamic QRIS feature flag aktif)
- ✅ Batas waktu verifikasi manual checkout saat ini 3 menit (upload bukti)
- ✅ Struktur database untuk provider payment modern sudah ada (`payment_provider`, `payment_reference`, `payment_qr_string`, `payment_qr_url`, `payment_expired_at`)
- ✅ Route `frontend/src/app/api/create-qris/route.ts` sudah mengarah ke Midtrans QRIS charge
- ⏳ Dynamic QRIS Midtrans belum dianggap fully active di production karena aktivasi gateway dan env provider masih bergantung pada approval atau konfigurasi merchant
- ⏳ Feature flag dynamic QRIS masih dalam mode nonaktif default (`NEXT_PUBLIC_ENABLE_DYNAMIC_QRIS=false`)
- ⏳ DOKU Checkout API sudah terpasang (button + API create payment + webhook), namun belum lulus end-to-end test karena credential sandbox masih ditolak (`invalid_client_id`)
- ❌ Xendit tidak menjadi provider aktif production saat ini meski masih ada jejak eksperimen atau konfigurasi lama di repo

## Intervensi Operasional Penjualan (Baru)

Untuk mitigasi kasus QRIS statis (customer bayar tapi tidak konfirmasi, atau bukti tidak valid), admin sekarang punya kontrol manual transaksi:

- Halaman: `frontend/src/app/admin/payments/control/page.tsx`
- API: `frontend/src/app/api/admin/transactions/control/route.ts`
- DB function: `admin_adjust_sales_transaction()` via migration `backend/migrations/047_admin_adjust_sales_transactions.sql`

Kemampuan utama:

- Tandai transaksi sebagai `COMPLETED` (valid terjual)
- Batalkan transaksi menjadi `CANCELLED` dan kembalikan stok
- Jika transaksi `CANCELLED` diaktifkan lagi ke `COMPLETED`, stok akan dikurangi ulang secara atomik

Ini penting untuk menjaga sinkronisasi stok vs penjualan aktual saat proses pembayaran masih manual.

## Progress Integrasi DOKU (Tahap Awal)

- Route webhook DOKU tersedia di `frontend/src/app/api/doku/notification/route.ts`
- Route `frontend/src/app/api/create-qris/route.ts` sudah provider-aware via `PAYMENT_PROVIDER_ACTIVE`
- Jika provider aktif `DOKU`, route saat ini mengembalikan status progress/fallback (dynamic QR DOKU belum final)
- Jalur fallback QRIS statis/manual tetap berjalan untuk keamanan operasional

## Tracking Mismatch Supplier (Baru)

File audit SQL tersedia untuk melacak mismatch saldo supplier:

- `database/TRACK-SUPPLIER-BALANCE-MISMATCH.sql`

Catatan pemakaian:

- Gunakan target `supplier_id` exact (jangan wildcard nama)
- Tersedia mode grouped untuk beberapa supplier mirip nama tanpa duplikasi
- Fokus angka utama: `total_revenue`, `total_paid`, `expected_pending`, `delta_pending`

## Perubahan Penting Rilis Terbaru

### v2.4.0 (1–4 Juni 2026) - Supplier Balance Accuracy & UI Polish

**Fokus:** Rekonsiliasi saldo supplier, perbaikan schema DB untuk trigger notifikasi, UI mobile commissions.

- Fix mismatch saldo supplier: semua view kini pakai snapshot `supplier_id` dari `sales_transaction_items`
- Migration 049: kolom `supplier_id` di `sales_transaction_items`, backfill dari `products`, update `process_anonymous_checkout()` agar freeze supplier saat transaksi
- Migration 048: tambah `priority`, `action_url`, `metadata` ke tabel `notifications` — fix trigger INSERT gagal
- Migration 050: tambah `paid_at` ke `supplier_payments` — fix error "record new has no field paid_at" saat konfirmasi pembayaran
- `admin/payments/commissions`: logika fetch snapshot-first dengan fallback product mapping
- `supplier/sales-report`: query snapshot agar histori penjualan akurat meski produk berpindah supplier
- `supplier/wallet`: `realTotalEarned` dihitung dari array sales terpadu
- `database/RECONCILE-SUPPLIER-COMMISSION-CARDS.sql`: SQL audit cross-check saldo supplier vs kartu admin
- UI mobile commissions: card "Siap Dibayar" (green gradient header) dan "Akumulasi" (amber border) dirancang ulang — lebih ringkas dan profesional
- Deploy via `npx vercel --prod` dari root repo (bukan subdirektori `frontend/`)
- Kantin checkout: cleanup teks tombol dari emoji/simbol

### v2.3.1 (1 Juni 2026) - Operational Hardening
- Checkout QRIS statis disesuaikan ke mode manual verification default
- Countdown verifikasi manual diset 3 menit
- Ditambahkan copy nominal pembayaran di checkout flow
- Ditambahkan halaman kontrol penjualan manual admin (`/admin/payments/control`)
- Ditambahkan API kontrol transaksi admin (status + sinkron stok)
- Ditambahkan migration 047 untuk fungsi intervensi transaksi
- Perhitungan kartu pembayaran supplier diperbaiki (hindari undercount karena limit default query)
- Dokumentasi SQL tracking mismatch supplier ditambahkan

### v2.3.0 (26-28 Mei 2026) - Core Operational Release

### Admin User Management
- Tab pengelolaan admin di halaman settings
- Edit `full_name`, `phone`, dan `admin_role`
- Invite admin baru via email
- Reset password via service role
- Delete admin dengan proteksi self-delete

### Notification System
- Bell icon di topbar admin dan supplier
- Badge unread count
- Realtime subscribe ke tabel `notifications`
- Trigger notifikasi untuk supplier registration, shipment submitted, dan supplier payment

### Auth Flow Fixes
- Halaman baru `/admin/set-password` untuk proses undangan admin
- Token implicit flow Supabase diparse manual dari URL hash dan di-set via `supabase.auth.setSession()`
- `/admin/layout` membypass auth guard untuk `/admin/login` dan `/admin/set-password`
- `/auth/callback` diarahkan ulang agar supplier signup kembali ke login dan admin invite ke halaman set password

### Domain Migration
- Primary domain pindah ke `smartalley.katalara.com`
- Supabase Site URL diarahkan ke domain baru
- Redirect URL auth menyesuaikan domain production baru

## Dokumentasi Utama

| Dokumen | Isi |
|---------|-----|
| [AI-GUIDE/README.md](AI-GUIDE/README.md) | Panduan utama AI agent: arsitektur, schema, pola kode, auth notes |
| [AI-GUIDE/CHANGELOG.md](AI-GUIDE/CHANGELOG.md) | Riwayat versi dan release notes |
| [AI-GUIDE/DATABASE-SCHEMA.md](AI-GUIDE/DATABASE-SCHEMA.md) | Struktur database, tabel, relasi, RPC |
| [AI-GUIDE/TROUBLESHOOTING.md](AI-GUIDE/TROUBLESHOOTING.md) | Masalah umum dan solusi teknis |
| [docs/development-summary.md](docs/development-summary.md) | Ringkasan progres pengembangan terkini |
| [docs/AI%20Agent%20Guid.md](docs/AI%20Agent%20Guid.md) | Snapshot operasional singkat untuk agent di folder docs |

## Struktur Singkat Project

```text
konsinyasi/
├── frontend/                   # Next.js 14 App Router
│   └── src/app/
│       ├── admin/             # Admin panel
│       ├── supplier/          # Supplier portal
│       ├── kantin/[slug]/     # Self-checkout per outlet
│       ├── auth/              # Auth callback flow
│       └── api/               # Route handlers
├── backend/migrations/        # 001–050 migrations
├── docs/                      # Dokumentasi ringkas & teknis
├── AI-GUIDE/                  # Canonical documentation untuk AI agent
├── database/                  # SQL utilitas / operasional
└── supabase/                  # Email templates
```

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | Next.js 14.2.29, App Router, TypeScript strict, Tailwind CSS |
| Backend | Supabase PostgreSQL, Auth, Storage, RLS |
| UI feedback | Sonner, Lucide React |
| Deployment | Vercel + Supabase Cloud |
| Node | `22.x` |

## Quick Start

```bash
git clone https://github.com/Soedirboy58/platform-konsinyasi.git
cd platform-konsinyasi/frontend
npm install
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:3000`.

## Manual Tasks Yang Masih Pending

### DB Migrations (jalankan di Supabase SQL Editor jika belum)
- [ ] `backend/migrations/046_notification_triggers.sql` — trigger notifikasi (supplier registration, shipment, payment)
- [ ] `backend/migrations/047_admin_adjust_sales_transactions.sql` — fungsi intervensi transaksi admin
- [ ] `backend/migrations/048_fix_notifications_columns_for_triggers.sql` — kolom `priority`, `action_url`, `metadata`
- [x] `backend/migrations/049_add_supplier_snapshot_to_sales_items.sql` — **sudah dijalankan di production**
- [ ] `backend/migrations/050_add_paid_at_to_supplier_payments.sql` — **wajib segera** agar konfirmasi pembayaran tidak error (status eksekusi production perlu verifikasi)

### Konfigurasi
- [ ] Pasang 3 template email HTML di Supabase Dashboard → Authentication → Email Templates
- [ ] Pastikan env `NEXT_PUBLIC_SITE_URL=https://smartvalley.katalara.com` di Vercel
- [ ] Re-invite user admin jika link invite lama sudah kedaluwarsa
- [ ] Aktivasi payment gateway jika ingin memakai dynamic QRIS di production
- [ ] Pastikan kredensial DOKU sandbox berasal dari akun sandbox yang sama (Client ID + Secret Key) di `frontend/.env.local`
- [ ] Verifikasi aktivasi produk DOKU Checkout/Payment Link pada akun sandbox sebelum UAT ulang

### Git / Deploy
- [ ] Push commits lokal ke GitHub — credential `katalaraofficial-cpu` tidak punya akses write ke repo `Soedirboy58/platform-konsinyasi`. Solusi: jalankan `echo "protocol=https`nhost=github.com" | git credential reject` lalu `git push origin main` dan login dengan akun Soedirboy58
- [ ] Setelah push berhasil, Vercel akan auto-deploy dari branch `main`

## Deploy Path Yang Benar (Ops Note)

Riwayat incident deploy sempat terjadi karena project link Vercel mengarah ke akun yang salah. Jalur aman yang dipakai saat ini:

1. Login akun Vercel scope `katalaras-projects`
2. Link project: `platform-konsinyasi`
3. Deploy dari root repo (bukan nested folder yang menimbulkan path ganda)

Command referensi:

```bash
npx vercel whoami
npx vercel project ls --scope katalaras-projects
npx vercel --prod --yes --scope katalaras-projects
```

## Catatan Untuk AI Agent

Mulai dari [AI-GUIDE/README.md](AI-GUIDE/README.md). Dokumen itu adalah sumber utama untuk arsitektur, auth flow, dan pola implementasi. Folder `docs/` dipakai sebagai snapshot operasional dan riwayat kerja yang lebih ringkas.

## Support

- Developer: Katalara Team
- Email: katalaraofficial@gmail.com

© 2026 Katalara. All rights reserved.
