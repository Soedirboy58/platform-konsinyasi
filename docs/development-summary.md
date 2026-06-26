# Development Summary - Platform Konsinyasi v2.7.0

**Project:** Platform Konsinyasi Terintegrasi  
**Status:** ✅ Production Active  
**Last Updated:** 26 Juni 2026  
**Primary Domain:** `https://smartvalley.katalara.com`

---

## 1. Snapshot Progres

Platform berada pada fase production aktif. Rilis v2.7.0 fokus pada **overhaul navigasi admin** (tab switch pattern menggantikan submenu sidebar di 4 modul utama), penyempurnaan responsiveness mobile (sidebar icon-only, notifikasi clamp viewport, tab icon-only), integrasi penuh toggle `commission_enabled` ke RPC checkout, dan disclosure Fee QR di Laporan Keuangan saat bearer = PLATFORM.

---

## 2. Riwayat Versi Singkat

| Version | Tanggal | Highlight |
|---------|---------|-----------|
| v2.7.0 | 26 Jun 2026 | Migration 055 (`commission_enabled` flag aktif), tab switch pattern (Suppliers/Payments/Reports/Settings), mobile sidebar icon-only, Laporan Keuangan disclosure Fee QR Platform |
| v2.6.0 | 26 Jun 2026 | Migration 053/054 (QR fee dinamis + produk hilang), Admin header theming rollout, revamp tab Komisi |
| v2.5.0 | 21 Jun 2026 | DOKU Checkout live production, migration 051/052, stock reservation fix, env runtime trim |
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
- Header halaman admin bertema seragam (gradient/preset)
- Settings tampilan global untuk tema header

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
- **DOKU Checkout live** — tombol "Bayar via DOKU" di halaman checkout, redirect ke payment page DOKU
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
- Pengaturan komisi + fee QR + threshold toggle terintegrasi di tab Komisi

### Admin Inventory Exception
- Fitur "Produk Hilang" untuk pencatatan selisih stok outlet
- Dapat dikonversi menjadi transaksi terjual atau dibatalkan dengan restore stok

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

### 4.10 DOKU Checkout Integration — LIVE PRODUCTION (21 Juni 2026)

**Status: ✅ Production aktif dengan credential live**

**Route yang aktif:**
- `frontend/src/app/api/doku/create-payment/route.ts` — buat payment link DOKU
- `frontend/src/app/api/doku/notification/route.ts` — webhook handler notifikasi DOKU
- `frontend/src/app/api/doku/test-credentials/route.ts` — diagnostic (diblokir di live mode)
- `frontend/src/app/kantin/[slug]/checkout/page.tsx` — tombol "Bayar via DOKU"

**Credential production:**
- `DOKU_CLIENT_ID`: `BRN-0285-1779716792279`
- `DOKU_SECRET_KEY`: `SK-WXTDR2IyRgWpICWwqTie`
- `DOKU_IS_SANDBOX`: `false`
- Semua disimpan di Vercel production env via `cmd /c "<nul set /p =VALUE"` (tanpa trailing whitespace)

**Masalah yang ditemukan dan diselesaikan:**
1. `Invalid Client-Id` — env Vercel lama masih pakai credential sandbox lama
2. `Invalid Header Signature` — header `Digest` tidak dikirim ke DOKU; fix: `generateSignature()` sekarang mengembalikan `{digest, signature}` dan keduanya dikirim sebagai header
3. Trailing whitespace di Vercel env — semua DOKU env variabel dibaca dengan `.trim()` di runtime (`getEnv()` helper di setiap route)
4. Vercel env pull menunjukkan semua value masih mengandung trailing space meski sudah di-set ulang — root fix ada di runtime trimming

**Gotcha penting — Vercel env trailing space:**
Saat menambah env via `echo "VALUE" | npx vercel env add ...` di PowerShell, value ikut trailing newline. Gunakan:
```
cmd /c "<nul set /p =VALUE | npx vercel env add KEY production --scope katalaras-projects"
```
Meski begitu, runtime sudah toleran karena semua `process.env.DOKU_*` di-trim lewat helper `getEnv()`.

### 4.11 DOKU Stock Reservation & Cancel Restore (21 Juni 2026)

**Masalah:** `process_doku_checkout_notification()` membatalkan transaksi (CANCELLED/EXPIRED) tanpa mengembalikan stok ke `inventory_levels`.

**Root cause terungkap dari data production:**
- Transaksi CANCELLED seharusnya mengembalikan stok (sudah ada di cron 037), tapi webhook DOKU meng-cancel secara langsung melewati cron
- Stok produk Tester Maintance di Outlet Tester sempat salah karena hitungan CANCELLED tanpa cross-check data aktual

**Kalkulasi stok yang benar (per 21 Jun 2026):**
- Total shipment approved masuk ke Outlet Tester: 10 unit (5 + 5)
- Total penjualan COMPLETED: 7 unit
- **Stok benar: 3** (sudah dikoreksi manual)

**Fix permanen — Migration 052:**
- File: `backend/migrations/052_fix_doku_cancel_restore_stock.sql`
- Saat webhook DOKU memberi status CANCELLED/EXPIRED/VOIDED/DENIED:
  1. Loop semua `sales_transaction_items` untuk transaksi tersebut
  2. Kembalikan stok ke `inventory_levels` per item
  3. Baru update `sales_transactions.status = CANCELLED`
- Idempotent: skip jika status sudah CANCELLED atau sudah COMPLETED
- **Wajib dijalankan di Supabase SQL Editor**

### 4.12 Dynamic QR Fee & Bearer (v2.6.0)
- Migration: `backend/migrations/053_qr_fee_dynamic.sql`
- Menambah pengaturan fee QR dinamis berbasis `platform_settings`:
  - `qr_fee_enabled`
  - `qr_fee_rate`
  - `qr_fee_bearer` (`CUSTOMER|SUPPLIER|PLATFORM|NONE`)
- Menambah snapshot fee pada `sales_transactions`:
  - `qr_fee_rate`, `qr_fee_amount`, `qr_fee_bearer`
- Update `process_anonymous_checkout()` agar menerapkan fee sesuai payment method dan penanggung fee

### 4.13 Produk Hilang (v2.6.0)
- Migration: `backend/migrations/054_lost_products.sql`
- Menambah audit kolom di `sales_transactions` untuk lifecycle kehilangan barang
- Menambah RPC:
  - `mark_products_lost` (tandai kehilangan, stok berkurang, status `HILANG`)
  - `convert_lost_to_sold` (ubah jadi `COMPLETED`, hitung komisi normal)
  - `cancel_lost` (ubah jadi `CANCELLED`, stok dikembalikan)

### 4.14 Standardisasi Admin Header & Settings Komisi (v2.6.0)
- Komponen baru: `frontend/src/components/admin/AdminPageHeader.tsx`
- Rollout ke modul analytics, reports, suppliers, payments, returns, dan settings
- Tab settings "Banner Utama" diubah menjadi "Tampilan" untuk konfigurasi tema header
- Tab Komisi diperbarui dengan:
  - Toggle `commission_enabled`
  - Toggle + rate `qr_fee_enabled`/`qr_fee_rate`
  - Toggle `min_payout_enabled`
  - Simulasi perhitungan komisi dan fee QR

### 4.15 Admin Navigation Overhaul & Tab Switch Pattern (v2.7.0)
- **Tab switch komponen baru** (blue-framed gradient badge, mobile icon-only):
  - `frontend/src/components/admin/SuppliersTabSwitch.tsx` — Daftar / Produk / Pengiriman & Retur
  - `frontend/src/components/admin/PaymentsTabSwitch.tsx` — Bayar / Kontrol / Riwayat / Rekonsiliasi
  - `frontend/src/components/admin/ReportsTabSwitch.tsx` — Dashboard Trafik / Analytics Insight / Penjualan / Keuangan
  - Settings page: 7 tab in-place (Komisi, Outlet, Profil, Notifikasi, Tampilan, Pengguna, Metode Pembayaran)
- **Layout konsolidasi** di `suppliers/`, `payments/`, `reports/`, `analytics/`:
  - `AdminPageHeader` + tab switch dipindah ke `layout.tsx` agar persist antar route sibling (no remount, transisi smooth)
  - Wrapper `overflow-x-hidden` untuk mengunci konten dari geser horizontal di mobile
- **Sidebar**:
  - Tombol Logout dipindah ke bottom sticky, terpisah dari menu
  - Submenu list dihapus seluruhnya — navigasi sub-section pakai tab switch
  - Mobile open: `w-16` icon-only rail; mobile close: hilang total
  - Notifikasi dropdown clamp viewport (`w-[calc(100vw-1.5rem)] max-w-sm sm:w-96`)
- **Inner tab Shipments** (Review/Retur/Hilang) dibuat responsive icon-only di mobile

### 4.16 Commission Enabled Flag (v2.7.0)
- Migration: `backend/migrations/055_commission_enabled_flag.sql`
- Seed default `commission_enabled = 'true'` di `platform_settings`
- `process_anonymous_checkout(TEXT,JSONB,TEXT)` di-recreate untuk membaca flag; kalau `false`, paksa `commission_rate = 0`
- `convert_lost_to_sold(UUID,TEXT,TEXT,UUID)` di-recreate dengan logika yang sama
- **Status:** Belum dijalankan di production — wajib eksekusi manual di Supabase SQL Editor agar toggle Settings → Komisi berfungsi

### 4.17 Financial Report — QR Fee Platform Disclosure (v2.7.0)
- `frontend/src/app/admin/reports/financial/page.tsx`:
  - Query baru: sum `qr_fee_amount` dari `sales_transactions` WHERE `qr_fee_bearer = 'PLATFORM'` pada window tanggal aktif
  - Section PENDAPATAN: baris merah "Fee QR (Ditanggung Platform)" + baris emerald "Komisi Bersih Platform" muncul hanya saat fee > 0
  - Pie chart Breakdown Pendapatan: 3 slice (Komisi Net + Fee QR + Supplier) saat bearer = PLATFORM; tetap 2 slice saat bearer lain
  - Net profit & margin direkomputasi pakai komisi bersih (setelah fee dikurangi)
- Tidak ada perubahan saat `qr_fee_bearer` = CUSTOMER / SUPPLIER / NONE

---

## 5. Status Payment & QRIS

### Yang Sudah Siap
- QRIS outlet/manual aktif di flow checkout
- Bukti pembayaran customer disimpan dan diverifikasi lewat alur yang sudah ada
- Struktur database untuk provider payment modern sudah tersedia
- API route Midtrans: `frontend/src/app/api/create-qris/route.ts`

### Yang Sudah Siap (Update 21 Jun 2026)
- **DOKU Checkout live** — tombol checkout, redirect payment DOKU, webhook handler, audit log
- Migration 051: tabel `doku_webhook_events` + RPC `process_doku_checkout_notification()`
- Migration 052: restore stok saat DOKU cancel/expired

### Yang Sudah Siap (Update 26 Jun 2026)
- Dynamic QR fee configuration end-to-end (frontend + migration 053)
- Lost products operation flow (frontend + migration 054)
- Admin header theming dan settings tampilan

### Yang Belum Final di Production
- Dynamic QRIS feature flag nonaktif (`NEXT_PUBLIC_ENABLE_DYNAMIC_QRIS=false`)
- Migration 052 belum dijalankan di Supabase — perlu dieksekusi manual
- Migration 053 belum dijalankan di Supabase — perlu dieksekusi manual
- Migration 054 belum dijalankan di Supabase — perlu dieksekusi manual
- Xendit hanya jejak eksperimen lama, bukan jalur aktif

---

## 6. Statistik Teknis

### Backend
- 54 migration SQL di `backend/migrations` (001–054)
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

- [ ] **URGENT** Jalankan migration `052_fix_doku_cancel_restore_stock.sql` di Supabase SQL Editor agar DOKU cancel restore stok otomatis
- [ ] Jalankan migration `053_qr_fee_dynamic.sql` agar fee QR dinamis aktif di database production
- [ ] Jalankan migration `054_lost_products.sql` agar flow Produk Hilang aktif penuh
- [ ] **URGENT** Jalankan migration `055_commission_enabled_flag.sql` agar toggle `commission_enabled` di Settings → Komisi efektif di RPC checkout & lost-to-sold
- [ ] Pastikan migration `046_notification_triggers.sql` sudah dijalankan di environment production yang aktif
- [ ] Jalankan migration `047_admin_adjust_sales_transactions.sql` sebelum operasional halaman kontrol manual penjualan
- [ ] Jalankan migration `050_add_paid_at_to_supplier_payments.sql` jika belum dieksekusi di production
- [ ] Pasang template email HTML di Supabase Dashboard
- [ ] Test transaksi DOKU live end-to-end: checkout → payment DOKU → konfirmasi webhook → status COMPLETED di DB
- [ ] Verifikasi tabel `doku_webhook_events` terisi saat transaksi live berhasil

---

## 8. Rekomendasi Update Berikutnya

1. Jalankan migration 052, 053, dan 054 di Supabase agar flow DOKU cancel restore, fee QR dinamis, dan Produk Hilang aktif penuh.
2. Lakukan test end-to-end transaksi live DOKU: checkout → bayar → konfirmasi webhook → cek `doku_webhook_events`.
3. Validasi simulasi dan hasil real transaksi untuk semua bearer fee QR (`CUSTOMER`, `SUPPLIER`, `PLATFORM`, `NONE`).
4. Rapikan abstraction payment provider agar Midtrans dan DOKU memakai kontrak service yang sama.
5. Tambahkan audit log permanen untuk intervensi manual transaksi admin dan resolution Produk Hilang.

---

## 9. Canonical Sources

- [AI-GUIDE/README.md](../AI-GUIDE/README.md) untuk arsitektur dan pola pengembangan
- [AI-GUIDE/CHANGELOG.md](../AI-GUIDE/CHANGELOG.md) untuk histori rilis
- [README.md](../README.md) untuk ringkasan repo dan status terkini

---

**Current Assessment:** Platform sudah menambah fondasi operasional penting: fee QR dinamis, fitur Produk Hilang, dan standardisasi UI admin. DOKU checkout live tetap stabil, namun migrasi 052/053/054 harus dijalankan agar semua capability backend aktif penuh di production.  
**Recommended Next Focus:** jalankan migration 052/053/054 → validasi transaksi QRIS per bearer fee → uji flow Produk Hilang (mark/convert/cancel) end-to-end.
