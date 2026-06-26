# 📝 CHANGELOG & VERSION HISTORY

> **Catatan perubahan dan riwayat versi Platform Konsinyasi**  
> **Last Updated:** 26 Juni 2026

---

## 📋 VERSION FORMAT

Format: `MAJOR.MINOR.PATCH`

- **MAJOR:** Breaking changes, major new features
- **MINOR:** New features, backward-compatible
- **PATCH:** Bug fixes, minor improvements

---

## 🚀 LATEST VERSION

### **v2.7.0** - 2026-06-26

**Type:** Admin Navigation Overhaul + Commission Toggle Backend + Financial Fee Disclosure  
**Status:** ✅ Production (frontend) / ⚠️ DB migration 055 required

---

#### ✅ Yang Diimplementasikan

**Database:**
- Migration 055: `backend/migrations/055_commission_enabled_flag.sql`
  - Seed default `commission_enabled = 'true'` di `platform_settings`
  - Recreate `process_anonymous_checkout(TEXT,JSONB,TEXT)` agar membaca flag `commission_enabled`; kalau `false`, paksa `commission_rate = 0` (supplier dapat 100%)
  - Recreate `convert_lost_to_sold(UUID,TEXT,TEXT,UUID)` dengan logika yang sama
  - **Status: belum dijalankan di production — wajib eksekusi manual di Supabase SQL Editor**

**Admin Sidebar & Navigation:**
- Tombol Logout dipindah ke bottom sidebar (sticky), terpisah dari menu utama
- Submenu list di sidebar dihapus — navigasi sub-section pindah ke tab switch dalam halaman
- Mobile sidebar: saat unhide jadi `w-16` icon-only rail (sebelumnya full `w-64`); saat hide hilang total (`-translate-x-full`)
- Notifikasi dropdown clamp width ke viewport pada mobile (`w-[calc(100vw-1.5rem)] max-w-sm sm:w-96`)

**Tab Switch Pattern (UI baru, blue-framed gradient badge):**
- Komponen baru: `frontend/src/components/admin/SuppliersTabSwitch.tsx` — 3 tab (Daftar / Produk / Pengiriman & Retur)
- Komponen baru: `frontend/src/components/admin/PaymentsTabSwitch.tsx` — 4 tab (Bayar / Kontrol / Riwayat / Rekonsiliasi)
- Komponen baru: `frontend/src/components/admin/ReportsTabSwitch.tsx` — 4 tab (Dashboard Trafik / Analytics Insight / Penjualan / Keuangan)
- Settings page: nav underline diganti tab switch in-place (7 tab dengan icon-only di <lg)
- Mobile: icon-only, label muncul mulai `sm:` (atau `lg:` untuk settings)
- Active state: gradient `from-blue-600 to-indigo-600` + shadow + border-2 frame biru pada kontainer

**Layout Konsolidasi (smooth transition):**
- `frontend/src/app/admin/suppliers/layout.tsx` — render AdminPageHeader + SuppliersTabSwitch, anak page tinggal konten
- `frontend/src/app/admin/payments/layout.tsx` — sama dengan PaymentsTabSwitch
- `frontend/src/app/admin/reports/layout.tsx` — header + ReportsTabSwitch (judul disesuaikan path)
- `frontend/src/app/admin/analytics/layout.tsx` — header "Analytics Insight" + ReportsTabSwitch
- Semua layout wrap `<div className="overflow-x-hidden">` agar konten tidak bisa di-geser horizontal di mobile
- 4 page modul terkait: `AdminPageHeader` dihapus dari per-page, kontrol `rightSlot` (period selector / export buttons) dipindah jadi toolbar putih di atas konten

**Sidebar Laporan & Analitik:**
- href: `/admin/reports` (Dashboard Trafik) sebagai default landing
- Submenu (Analytics / Sales / Financial) dihapus — sekarang lewat tab switch

**Inner Tab Shipments:**
- Tab Review Pengiriman / Produk Retur / Produk Hilang di `frontend/src/app/admin/suppliers/shipments/page.tsx` dibuat responsive `flex-1`, icon-only di mobile

**Laporan Keuangan — Disclosure Fee QR Platform:**
- `frontend/src/app/admin/reports/financial/page.tsx`: query baru sum `qr_fee_amount` dari `sales_transactions` WHERE `qr_fee_bearer = 'PLATFORM'`
- Section PENDAPATAN: jika ada fee yang ditanggung platform → tampil baris merah "Fee QR (Ditanggung Platform)" sebagai pengurang + baris emerald "Komisi Bersih Platform"
- Pie chart Breakdown Pendapatan: 3 slice (Komisi Net hijau + Fee QR merah + Supplier orange) saat bearer = PLATFORM; tetap 2 slice saat bearer lain
- Net profit & margin sekarang berbasis komisi bersih (setelah fee dikurangi)
- Tidak ada perubahan tampilan saat `qr_fee_bearer` = CUSTOMER/SUPPLIER/NONE

**Frontend Commissions Threshold Toggle Integration:**
- `frontend/src/app/admin/payments/commissions/page.tsx`: baca `min_payout_enabled` dari `platform_settings`; jika `false`, force `localMinThreshold = 0`

#### 🐛 Fix
- Vercel build error: duplicate `<main>` tag di `payments/control/page.tsx` setelah refactor toolbar — digabung jadi satu `<main>`
- TS narrow `never` pada `submenu` setelah penghapusan submenu — explicit cast `submenu: [] as { label: string; href: string }[]`
- Unused imports `AdminPageHeader`, `Menu`, `X` dihapus dari file yang sudah migrasi ke layout-based header

#### ⚠️ Catatan Operasional
- **Wajib jalankan migration 055** di Supabase SQL Editor agar toggle `commission_enabled` benar-benar memengaruhi `process_anonymous_checkout` dan `convert_lost_to_sold`
- Tanpa migration 055, UI toggle di Settings → Komisi tidak akan mengubah hasil potongan komisi di transaksi baru

---

### **v2.6.0** - 2026-06-26

**Type:** Dynamic QR Fee + Lost Products + Admin UI Theming
**Status:** ✅ Production (frontend) / ⚠️ DB migration required

---

#### ✅ Yang Diimplementasikan

**Database & Flow Baru:**
- Migration 053: `backend/migrations/053_qr_fee_dynamic.sql`
  - `sales_transactions` tambah snapshot `qr_fee_rate`, `qr_fee_amount`, `qr_fee_bearer`
  - `process_anonymous_checkout()` menerima `p_payment_method` dan menerapkan fee QR berdasarkan bearer (`CUSTOMER`, `SUPPLIER`, `PLATFORM`, `NONE`)
  - Pengaturan platform: `qr_fee_enabled`, `qr_fee_rate`, `qr_fee_bearer`
- Migration 054: `backend/migrations/054_lost_products.sql`
  - Fitur produk hilang (`status='HILANG'`, `payment_method='LOST'`)
  - RPC `mark_products_lost`, `convert_lost_to_sold`, `cancel_lost`
  - Alur: mark hilang → konversi jadi terjual (CASH/QRIS) atau batalkan + restore stok

**Admin UI/UX Improvement:**
- Diterapkan komponen reusable `AdminPageHeader` dengan tema gradient global
- Pengaturan tema dipindah ke `/admin/settings` tab **Tampilan** (rename dari "Banner Utama")
  - Color picker manual + preset tone
  - Theme disimpan di localStorage dan broadcast event `admin-header-theme-change`
- Rollout banner header seragam ke halaman admin utama:
  - Dashboard, Analytics, Reports index, Reports Sales, Reports Financial
  - Suppliers (daftar/produk/pengiriman-retur)
  - Payments (commissions/control/history/reconciliation)
  - Returns (list/create)

**Settings Komisi/Pembayaran:**
- Tab Komisi diperbarui:
  - Toggle `commission_enabled`
  - Field dan toggle fee QR (`qr_fee_enabled`, `qr_fee_rate`) + simulasi terpadu
  - Toggle minimum threshold (`min_payout_enabled`)
- Simulasi komisi & fee QR menampilkan dampak ke supplier/platform untuk nominal referensi

**Laporan & Navigasi:**
- Sales report: custom date range (start/end), filter chips expandable (Periode/Supplier/Produk), detail filter dipusatkan
- Sidebar admin desktop: mode collapse menjadi icon-only rail (bukan hilang total)
- Analytics: animasi bar chart dan donut untuk tampilan lebih hidup

#### 🐛 Fix Tambahan
- Fix build TypeScript: spread `Map.entries()` diganti `Array.from(...)` (downlevelIteration compatibility)
- Fix build import: menambahkan import `AdminPageHeader` yang hilang di sales report

#### ⚠️ Catatan Operasional
- Jalankan migration 053 dan 054 di Supabase SQL Editor agar fitur fee QR dinamis dan produk hilang aktif penuh di database production
- Frontend sudah siap, namun tanpa migrasi tersebut sebagian alur akan gagal query/RPC

---

### **v2.5.0** - 2026-06-21

**Type:** DOKU Checkout Live Production + Stock Reservation Fix  
**Status:** ✅ Production  
**Deploy:** `npx vercel --prod --scope katalaras-projects`

---

#### ✅ Yang Diimplementasikan

**DOKU Checkout Live:**
- `frontend/src/app/api/doku/create-payment/route.ts` — buat payment link DOKU (HMAC-SHA256 signature, header `Digest` + `Signature`)
- `frontend/src/app/api/doku/notification/route.ts` — webhook handler verifikasi signature + finalisasi transaksi
- `frontend/src/app/api/doku/test-credentials/route.ts` — diagnostic (diblokir di live mode `DOKU_IS_SANDBOX=false`)
- `frontend/src/app/kantin/[slug]/checkout/page.tsx` — tombol ungu "Bayar via DOKU", state loading/error, retry
- Helper `getEnv(name)` di semua route DOKU untuk `.trim()` env variable saat runtime

**Credential Vercel Production (live):**
- `DOKU_CLIENT_ID=BRN-0285-1779716792279`
- `DOKU_SECRET_KEY=SK-WXTDR2IyRgWpICWwqTie`
- `DOKU_IS_SANDBOX=false`
- `DOKU_WEBHOOK_URL=https://smartalley.katalara.com/api/doku/notification`

**Migration 051** — `backend/migrations/051_doku_webhook_audit_and_finalize.sql`
- Tabel `doku_webhook_events` — audit log setiap webhook masuk dari DOKU
- RPC `process_doku_checkout_notification(TEXT,TEXT,TEXT,TEXT,JSONB,JSONB)` — finalisasi transaksi idempotent
- Logika: SUCCESS → COMPLETED; FAILED → dibiarkan (retryable); CANCELLED/EXPIRED → CANCELLED (tanpa downgrade dari COMPLETED)

**Migration 052** — `backend/migrations/052_fix_doku_cancel_restore_stock.sql`
- Perbaikan: saat DOKU memberi status CANCELLED/EXPIRED/VOIDED/DENIED, stok item dikembalikan ke `inventory_levels` sebelum update status transaksi
- Melengkapi logika reservation: stok dipotong saat PENDING, dikembalikan saat cancel, terpotong permanen hanya saat COMPLETED
- **Status: belum dijalankan di production — wajib segera**

**Koreksi stok manual (21 Jun 2026):**
- Stok produk "Tester Maintance" di Outlet Tester dikoreksi ke 3 (total IN 10 - total COMPLETED 7)
- Kesalahan sebelumnya: terdapat 10 transaksi CANCELLED hari testing yang memotong stok tanpa dikembalikan

#### 🐛 Bug yang Ditemukan dan Diselesaikan

| Bug | Penyebab | Fix |
|-----|----------|-----|
| `Invalid Client-Id` | Vercel masih pakai credential sandbox lama | Update env ke credential live via Vercel CLI |
| `Invalid Header Signature` | Header `Digest` tidak dikirim ke DOKU | `generateSignature()` sekarang return `{digest, signature}`, keduanya dikirim |
| Signature tetap invalid setelah fix header | Env Vercel tersimpan dengan trailing whitespace | Helper `getEnv()` dengan `.trim()` di semua route DOKU |
| Stok berkurang tanpa dikembalikan saat cancel DOKU | RPC lama tidak restore stok | Migration 052: loop items + restore inventory sebelum cancel |

#### ⚠️ Catatan Operasional
- Saat menambah env ke Vercel via PowerShell, gunakan `cmd /c "<nul set /p =VALUE | npx vercel env add KEY production"` agar tidak ada trailing newline
- Semua env DOKU di runtime sudah ditrim via `getEnv()` sehingga trailing space tidak merusak HMAC
- Migration 052 **wajib dijalankan** di Supabase SQL Editor sebelum menerima transaksi DOKU live dalam jumlah besar

---

### **v2.4.1** - 2026-06-06

**Type:** DOKU Checkout Integration (Sandbox)  
**Status:** ✅ Completed (dilanjutkan ke v2.5.0)

#### Yang Diimplementasikan
- Route `create-payment`, `notification`, `test-credentials` (awal)
- Tombol "Bayar via DOKU" di halaman checkout
- Signature HMAC format `HMACSHA256=base64` (tanpa prefix lain)
- Override notification URL untuk webhook DOKU

---

### **v2.4.0** - 2026-06-01 s/d 2026-06-04

**Type:** Supplier Balance Accuracy + Schema Fix + UI Polish  
**Status:** ✅ Production (deployed via `npx vercel --prod`)  
**Commits:** `8910572`, `903029f`

---

#### 🎯 Root Problem Yang Diperbaiki
Saldo supplier di kartu admin tidak akurat karena query berbasis `products.supplier_id` saat ini — jika produk berpindah supplier atau dihapus, histori penjualan tersebut tidak ikut terhitung.

---

#### 🗄️ Database Migrations

**Migration 048** — `backend/migrations/048_fix_notifications_columns_for_triggers.sql`
- Menambah kolom `priority TEXT CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT'))`, `action_url TEXT`, `metadata JSONB` ke tabel `notifications`
- Idempotent (`ADD COLUMN IF NOT EXISTS`)
- Tanpa ini, trigger `notify_supplier_payment_received` dari migration 046 gagal INSERT dengan error "column priority does not exist"

**Migration 049** — `backend/migrations/049_add_supplier_snapshot_to_sales_items.sql`
- Menambah kolom `supplier_id UUID REFERENCES suppliers(id)` ke `sales_transaction_items`
- Backfill: `UPDATE sales_transaction_items SET supplier_id = p.supplier_id FROM products p WHERE product_id = p.id`
- Update fungsi `process_anonymous_checkout()` agar menyimpan `supplier_id` saat transaksi checkout berlangsung
- **Sudah dijalankan di production DB**

**Migration 050** — `backend/migrations/050_add_paid_at_to_supplier_payments.sql`
- Menambah kolom `paid_at TIMESTAMPTZ` ke tabel `supplier_payments`
- Fix error: `record "new" has no field "paid_at"` saat konfirmasi pembayaran supplier
- **Belum dijalankan di production — wajib segera**

---

#### 💻 Frontend Changes

**`admin/payments/commissions/page.tsx`**
- Fungsi `fetchSalesItems(includeSupplierId: boolean)` baru
- Saat `includeSupplierId=true`: filter `.in('supplier_id', approvedSupplierIds)` langsung di items
- Fallback ke query lama (via join products) jika kolom snapshot belum ada
- Resolusi: `snapshotSupplierId || mappedSupplierId`
- Fix sort order pembayaran terakhir

**`supplier/sales-report/page.tsx`**
- Pattern `fetchSalesData(useSnapshotSupplierId: boolean)`
- Snapshot-first: `.eq('supplier_id', supplier.id)`
- Fallback: `.eq('products.supplier_id', supplier.id)`

**`supplier/wallet/page.tsx`**
- Pattern `fetchSupplierSalesItems(useSnapshotSupplierId: boolean)`
- `realTotalEarned` dihitung dari array `salesData` terpadu
- Menghapus fetch produk duplikat

**`kantin/[slug]/page.tsx`, `checkout/page.tsx`, `error.tsx`**
- Cleanup teks tombol dari simbol/emoji

**`admin/payments/commissions/page.tsx` — UI Mobile**
- Card "Siap Dibayar" didesain ulang:
  - Header gradient green dengan badge threshold kanan atas
  - Supplier rows dengan dot indicator + truncate nama panjang
  - Baris total transfer + link settings bersebelahan
  - CTA button full-width
- Card "Akumulasi" didesain ulang (terpisah, bukan nested):
  - Header amber kompak dengan badge threshold
  - Setiap baris: nama + nominal + "kurang Rp X"
  - Link "Lihat semua N supplier" jika > 5 item

---

#### 🔍 SQL Utilities

**`database/RECONCILE-SUPPLIER-COMMISSION-CARDS.sql`**
- Query audit komprehensif untuk cross-check saldo supplier vs kartu admin
- Rumus: `outstanding = supplier_revenue_alltime - total_paid_alltime`
- Menggunakan `COALESCE(sti.supplier_id, pm.supplier_id)` untuk kompatibilitas sebelum/sesudah migration 049
- Hasil verifikasi production per 1 Juni 2026: semua kartu valid

---

#### ⚠️ Known Issues & Workarounds

| Issue | Status | Solusi |
|-------|--------|--------|
| `paid_at` error saat konfirmasi pembayaran | ❌ Open | Jalankan migration 050 di Supabase |
| Git push gagal (credential mismatch) | ❌ Open | `git credential reject` lalu login Soedirboy58 |
| Deploy dari `frontend/` dir gagal path ganda | ✅ Diketahui | Selalu jalankan `npx vercel --prod` dari root repo |

---

### **v2.3.1** - 2026-06-01

**Type:** Operational Hardening  
**Status:** ✅ Production

- Checkout QRIS statis ke mode manual verification default
- Countdown verifikasi manual 3 menit
- Copy nominal pembayaran di checkout flow
- Halaman kontrol penjualan manual admin: `/admin/payments/control`
- API kontrol transaksi admin (ubah status + sinkron stok)
- Migration 047: fungsi DB `admin_adjust_sales_transaction()`
- Fix perhitungan kartu supplier (hindari undercount akibat limit query)
- SQL toolkit mismatch saldo supplier

---

### **v2.3.0** - 2026-05-26

---

#### 👥 Admin User Management (Settings → Pengguna Admin)
- Tab "Pengguna Admin" di `/admin/settings` dengan card per user
- **Edit profile**: modal untuk ubah `full_name`, `phone`, `admin_role`
- **Reset password**: tombol kirim link reset via `generateLink({type:'recovery'})` (pakai service role key)
- **Undang admin baru**: modal invite dengan email, nama, role
- **Hapus admin**: dengan guard cegah self-delete
- Tab "Backup" disembunyikan (`hidden` CSS class)
- API route: `GET/POST/DELETE/PATCH /api/admin/users` — semua operasi pakai `SUPABASE_SERVICE_ROLE_KEY`
- Migration 045: kolom `admin_role` pada tabel `profiles` (`MANAGER|PRODUCT|MITRA|FINANCE`)

**RBAC Admin Roles:**
- `MANAGER` — akses semua menu (default jika `admin_role` null)
- `PRODUCT` — hanya Products + laporan terbatas
- `MITRA` — hanya Suppliers + Payments
- `FINANCE` — hanya Reports + Payments

---

#### 🔔 In-App Notification System
- **Bell icon** di topbar admin layout dengan badge unread count (merah)
- **Bell icon** di topbar supplier layout
- Dropdown panel: 30 notifikasi terbaru, timestamp relative, tombol "tandai semua baca"
- Realtime: `supabase.channel` subscribe ke tabel `notifications` WHERE `recipient_id = user.id`
- 3 event trigger (SQL migration 046 — **harus dijalankan manual di Supabase SQL Editor**):
  - `trigger_notify_supplier_registration` — saat supplier baru daftar (INSERT ke `suppliers`)
  - `trigger_notify_shipment_submitted` — saat pengiriman stok masuk (stock_movements INSERT, type=IN, status=PENDING)
  - `trigger_notify_supplier_payment` — saat pembayaran supplier selesai (supplier_payments COMPLETED)
- Tabel `notifications` dengan type CHECK constraint diperluas: `SUPPLIER_REGISTRATION`, `SHIPMENT_SUBMITTED`, `PAYMENT_RECEIVED`

**File migration:** `backend/migrations/046_notification_triggers.sql`  
⚠️ **Wajib dijalankan manual** di Supabase Dashboard → SQL Editor

---

#### 📧 Custom HTML Email Templates
3 template email branded (Katalara brand, HTML + CSS inline):
- `supabase/email-template-invite-user.html` — undangan admin (purple theme)
- `supabase/email-template-confirm-signup.html` — verifikasi email mitra (green theme)
- `supabase/email-template-reset-password.html` — reset password (blue theme)

**Pasang di:** Supabase Dashboard → Authentication → Email Templates  
**SMTP:** Resend.com, host `smtp.resend.com`, port 465, sender `noreply@katalara.com`

---

#### 🔐 Auth Flow Fixes (Invite & Email Verification)

**Root cause yang ditemukan:**
- Supabase project menggunakan **implicit flow** (`#access_token=...` di hash), bukan PKCE
- `@supabase/auth-helpers-nextjs` v0.8.7 default `flowType: 'pkce'` → mengabaikan hash fragment
- Route handler server-side (`/auth/callback`) tidak dapat membaca hash (tidak dikirim ke server)
- Admin layout `checkAuth()` redirect ke login sebelum token diproses

**Fixes yang diterapkan:**

1. **`/admin/set-password/page.tsx`** (NEW)
   - Halaman set password untuk admin yang diundang
   - Parse hash fragment manual: `new URLSearchParams(window.location.hash.substring(1))`
   - Panggil `supabase.auth.setSession({ access_token, refresh_token })` langsung
   - State: `loading` → `ready` (form) atau `error` (expired/invalid)
   - Timeout fallback 15 detik

2. **`/admin/layout.tsx`** — bypass auth guard
   - `checkAuth()` early return jika `pathname === '/admin/set-password'`
   - Render condition: `loading || pathname === '/admin/login' || pathname === '/admin/set-password'` → langsung render children

3. **`/api/admin/users/route.ts`** — invite redirectTo
   - `redirectTo: ${new URL(request.url).origin}/admin/set-password`
   - Gunakan request origin (bukan hardcoded) agar cocok domain yang dipakai

4. **`/auth/callback/route.ts`** — perbaikan logika callback
   - Admin role → selalu redirect ke `/admin/set-password` (bukan `/admin`)
   - Default fallback diubah dari homepage ke `/login`
   - Handle `next` param untuk future PKCE use

5. **`/login/page.tsx`** — signup email verification
   - `emailRedirectTo` ditambah `?type=signup` agar callback tahu jenis alur

**Supabase URL Configuration (sudah dikonfigurasi):**
- Site URL: `https://smartalley.katalara.com`
- Redirect URLs: `https://smartalley.katalara.com/**`, `/auth/callback`, `/admin/set-password`

---

#### 🌐 Domain Migration
- Produksi pindah dari `platform-konsinyasi.vercel.app` → **`smartalley.katalara.com`**
- Supabase Site URL diupdate ke `https://smartalley.katalara.com`
- Env var `NEXT_PUBLIC_SITE_URL` perlu diset di Vercel: `https://smartalley.katalara.com`

---

**Files Changed:**
- `frontend/src/app/admin/settings/page.tsx` — edit user, reset password, hide backup tab
- `frontend/src/app/admin/layout.tsx` — notification bell, RBAC sidebar, set-password bypass
- `frontend/src/app/supplier/layout.tsx` — notification bell
- `frontend/src/app/admin/set-password/page.tsx` — NEW: halaman set password invite
- `frontend/src/app/auth/callback/route.ts` — perbaikan logika redirect
- `frontend/src/app/login/page.tsx` — fix emailRedirectTo
- `frontend/src/app/api/admin/users/route.ts` — CRUD admin users API
- `backend/migrations/046_notification_triggers.sql` — NEW (manual run required)
- `supabase/email-template-*.html` — 3 HTML email templates (NEW)

**Migration Required:** ✅ Yes (045 auto-applied, 046 manual)  
**Breaking Changes:** ❌ No

---



**Type:** UX Improvement Release  
**Status:** ✅ Production

**Improvements:**

#### 💳 Admin Pembayaran ke Supplier — Card View Redesign
- Halaman `/admin/payments/commissions` dirombak total dari tabel → card per-supplier
- Setiap card menampilkan:
  - Avatar supplier (inisial warna) + nama + info bank + status badge
  - Panel split 🔴 **Belum Ditransfer** (outstanding balance) | 🟢 **Sudah Ditransfer** (all-time paid)
  - Stats row: Produk Dikirim (dari `stock_movements` type=IN) | Total Transaksi | Total Revenue
  - Tombol Bayar (status=UNPAID, outstanding ≥ threshold) / indikator akumulasi (PENDING) / lunas (PAID)
- Interface `Commission` diperluas dengan 4 field baru: `total_revenue_alltime`, `total_paid_alltime`, `products_shipped`, `total_transactions_alltime`
- Query baru `stock_movements` (type=IN, status APPROVED/COMPLETED) + `shippedMap` untuk hitung produk dikirim
- `all_time_unique_transactions` via `Set` dari `sales_transaction.id`
- Modal "Upload Bukti Pembayaran" tetap tidak berubah
- Grid: `1 col mobile → 2 col md → 3 col xl`

**Database Migrations:**
- Tidak ada migrasi baru di versi ini

**Files Changed:**
- `/frontend/src/app/admin/payments/commissions/page.tsx` — full UI rewrite (table → card grid), interface extension, new queries

**Migration Required:** ❌ No  
**Breaking Changes:** ❌ No

---

### **v2.1.0** - 2026-05-26

**Type:** Bug Fix Release  
**Status:** ✅ Production

**Bug Fixes:**

#### 🐛 Phantom Deduction — Stok Berkurang Tanpa Transaksi Tercatat
- **Root Cause:** `process_anonymous_checkout()` langsung mengurangi stok saat transaksi dibuat (status=PENDING). Jika pembayaran tidak pernah dikonfirmasi, stok tetap berkurang permanen tanpa masuk laporan.
- **Gejala:** Stok berkurang bertahap tanpa ada transaksi di laporan penjualan.
- **Fix Migration 044:**
  1. Fungsi `cleanup_expired_pending_transactions(p_expire_minutes INTEGER DEFAULT 30)` — cancel semua transaksi PENDING yang melewati batas waktu dan kembalikan stok (`inventory_levels.quantity` di-increment kembali per item).
  2. `pg_cron` job baru: `SELECT cleanup_expired_pending_transactions(30)` dijadwalkan tiap 30 menit.
- **Syarat:** Extension `pg_cron` harus aktif di Supabase Dashboard → Database → Extensions → pg_cron.
- **Returns:** `TABLE(cancelled_count INTEGER, restored_items INTEGER)` untuk logging.

**Database Migrations:**
- Migration 044: Fungsi `cleanup_expired_pending_transactions` + pg_cron job tiap 30 menit

**Files Changed:**
- `/backend/migrations/044_cleanup_pending_transactions.sql` — NEW

**Migration Required:** ✅ Yes (044)  
**Breaking Changes:** ❌ No

---

### **v2.0.0** - 2026-05-26

**Type:** Major Feature + Rebrand Release  
**Status:** ✅ Production

**New Features:**

#### 🏠 Landing Page Baru + Unified Login
- Homepage baru (`/`) dengan hero section, feature highlights, dan CTA portal
- Unified login page menggantikan login terpisah per role
- Routing disesuaikan — login admin/supplier diarahkan ke unified page
- Hapus card "Kantin PWA" dari homepage (pelanggan via QR fisik saja)

#### 🎨 Color Theme Rebrand — Amber/Gold
- Seluruh platform rebrand dari warna sky-blue → amber/gold gradient
- Primary gradient: `amber-500` → `yellow-600` (`#f59e0b` → `#d97706`)
- Berlaku di header admin panel, tombol CTA, badge, dan aksen UI
- Konsistensi visual antara landing page, admin panel, dan supplier portal

#### 🖼️ Logo Katalara — Gambar Real
- Logo di navbar/header kini menggunakan gambar asli dari Supabase Storage
- Menggantikan SVG inline placeholder sebelumnya
- URL logo: `https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/outlet-media/logos/katalara-logo.png`
- Fallback: teks "Katalara" jika gambar gagal load

#### 🎠 Supplier Marquee — Mitra Bergabung
- Bagian "Outlet Bergabung" di landing page diganti menjadi marquee carousel infinite-scroll
- Menampilkan logo + nama semua supplier yang sudah APPROVED dari database (query real-time)
- Auto-scroll horizontal dua arah, seamless loop
- Fallback placeholder jika supplier belum ada logo

**Database Migrations:**
- Tidak ada migrasi baru di versi ini (menggunakan data existing dari tabel `suppliers`)

**Files Changed:**
- `/frontend/src/app/page.tsx` — landing page hero, rebrand amber/gold, logo Katalara real, supplier marquee
- `/frontend/src/app/admin/login/page.tsx` atau unified login — unified login route
- Berbagai komponen header/navbar — amber/gold theme

**Migration Required:** ❌ No  
**Breaking Changes:** ❌ No (routing backward-compatible)

---

### **v1.9.0** - 2026-03-30

**Type:** Feature + UX Release  
**Status:** ✅ Production

**New Features:**

#### 🎠 Homepage Dynamic Carousel + Admin Banner Management
- Carousel halaman utama kini dinamis — dikelola dari tab "Banner Utama" di `/admin/settings`
- **Default behavior:** Tampil 3 slide intro Katalara saat belum ada banner dari admin
- **Mode dinamis:** Aktif saat admin menambah ≥1 banner aktif → tampil banner admin + kartu outlet aktif otomatis (auto-appended)
- Tabel baru `homepage_banners` (Migration 043) untuk menyimpan konten banner
- Upload gambar banner tersimpan di `outlet-media/banners/`
- Quick-add shortcut: klik outlet aktif → form otomatis terisi dengan branding outlet
- Color picker gradient + live preview di form banner

#### 🔐 Admin Email Protection di Supplier Login
- Akun ADMIN/SUPER_ADMIN tidak bisa login di halaman `/supplier/login`
- Jika admin mencoba login → `signOut()` dipanggil + toast error ditampilkan
- Berlaku juga di flow registrasi supplier

#### 🏠 Homepage Portal Restructuring
- Removed "Kantin PWA" card dari homepage — kini hanya 2 portal: Supplier + Admin
- Pelanggan diarahkan via QR code fisik toko
- Ditambahkan info hint QR code di bawah portal

#### 📱 Per-Outlet PWA Manifest
- Setiap outlet punya manifest PWA sendiri → install ke homescreen langsung buka outlet tersebut
- `start_url = /kantin/[slug]`, `scope = /kantin/[slug]`, `theme_color` dari `header_color_from`
- Route baru: `GET /api/kantin-manifest/[slug]` (server-side, fetch Supabase)
- Layout baru: `/kantin/[slug]/layout.tsx` override `<link rel="manifest">`

#### 🔧 Footer & Branding Cleanup
- Removed referensi GitHub dan Vercel dari footer
- Tambah jam operasional: Senin–Jumat 08.00–17.00 WIB
- Tagline ramah pengguna menggantikan "Built with Next.js & Supabase"
- Copyright year diperbaiki: 2024 → 2026
- Email kontak diupdate: `katalaraofficial@gmail.com`

**Database Migrations:**
- Migration 043: Tabel `homepage_banners` + RLS anon/authenticated + index sort + storage policy `outlet_media_banner_insert`

**Files Changed:**
- `/frontend/src/app/page.tsx` — Dynamic carousel, STATIC_SLIDES default (3 intro Katalara), fetch logic
- `/frontend/src/app/admin/settings/page.tsx` — Tab "Banner Utama" dengan CRUD lengkap + quick-add outlet
- `/frontend/src/app/supplier/login/page.tsx` — Blokir ADMIN/SUPER_ADMIN login di supplier portal
- `/frontend/src/app/kantin/[slug]/layout.tsx` — **NEW:** Per-outlet metadata + dynamic manifest link
- `/frontend/src/app/api/kantin-manifest/[slug]/route.ts` — **NEW:** Dynamic PWA manifest per outlet
- `/backend/migrations/043_homepage_banners.sql` — **NEW:** homepage_banners table

**Migration Required:** ✅ Yes (043)  
**Breaking Changes:** ❌ No

---

### **v1.8.0** - 2026-03-30

**Type:** UI/UX Polish Release  
**Status:** ✅ Production

**Improvements:**

#### 🎨 Admin Alert → Toast + ConfirmDialog (All Admin Pages)
- **Root Cause:** `alert()` dan `confirm()` native browser tidak sesuai design system — blokir UI, tidak bisa dimodifikasi
- **Fix:** Semua admin pages kini pakai `toast` dari Sonner + `ConfirmDialog` komponen
- **Pattern:** Semua konfirmasi destruktif (delete, bulk delete) wajib pakai `ConfirmDialog` dengan `variant="danger"`
- **Affected Pages:**
  - `/admin/suppliers/page.tsx` — approve, reject, delete supplier + bulk approve/reject/delete
  - `/admin/suppliers/shipments/page.tsx` — mark as returned (ReturnsTab)
  - `/admin/settings/page.tsx` — hapus slide karousel, hapus outlet

#### 📊 Sales Report — Hapus Horizontal Scroll
- **Root Cause:** Tabel menggunakan `overflow-x-auto` + `min-w-full` → muncul scrollbar horizontal di desktop
- **Fix:** Ganti ke `w-full table-fixed` + setiap `<th>` dapat lebar persentase eksplisit
- **Column widths:** Tanggal 13%, Produk 30%, Supplier 13%, Qty 5%, Harga 10%, Total 10%, Payment 9%, Bukti 10%
- **File:** `/frontend/src/app/admin/reports/sales/page.tsx`

#### 🎨 Kantin — Warna Produk Dinamis
- **Root Cause:** Button dan elemen di halaman outlet masih menggunakan warna hardcoded `red-600`, `orange-600`
- **Fix:** Cart badge, harga, counter, tombol Tambah, dan border "Ada Masalah?" kini pakai `headerColorFrom`/`headerColorTo` dari settings outlet
- **File:** `/frontend/src/app/kantin/[slug]/page.tsx`

**Database Migrations:**
- Tidak ada migrasi baru di versi ini

**Files Changed:**
- `/frontend/src/app/admin/suppliers/page.tsx` — toast + ConfirmDialog
- `/frontend/src/app/admin/suppliers/shipments/page.tsx` — toast + ConfirmDialog (ReturnsTab)
- `/frontend/src/app/admin/settings/page.tsx` — ConfirmDialog untuk hapus slide & outlet
- `/frontend/src/app/admin/reports/sales/page.tsx` — table-fixed layout
- `/frontend/src/app/kantin/[slug]/page.tsx` — dynamic header colors

**Migration Required:** ❌ No  
**Breaking Changes:** ❌ No

---

### **v1.7.0** - 2026-03-29

**Type:** Feature Release  
**Status:** ✅ Production

**New Features:**

#### 🏷️ Category System
- **Admin Products:** Dropdown kategori saat tambah/edit produk (preset: Makanan, Minuman, Snack, Makanan Ringan, Kue & Roti, Buah Segar, Frozen Food, Lainnya)
- **Supplier Products:** Dropdown kategori yang sama di supplier panel
- **Outlet Self-Checkout:** Filter chip kategori di halaman produk customer (`/kantin/[slug]`)
- **RPC Update:** `get_products_by_location` kini return kolom `category` dan sort berdasarkan kategori
- **Migration 042:** Recreate `get_products_by_location` dengan `category` + ORDER BY `p.category, p.name`

#### 🖼️ QRIS Upload per Outlet
- Upload gambar QRIS langsung di settings outlet (bukan global)
- Gambar tersimpan di `outlet-media/qris/{outletId}.{ext}`
- Tampil di halaman self-checkout customer

#### 🎨 Outlet Button Color Theming
- Tombol aksi di card outlet (di halaman settings) menggunakan warna gradient dari `header_color_from`/`header_color_to`
- Konsisten dengan branding outlet di halaman customer

**Database Migrations:**
- Migration 042: `get_products_by_location` returns `category`, ordered by category

**Files Changed:**
- `/frontend/src/app/admin/suppliers/products/page.tsx` — tambah category dropdown
- `/frontend/src/app/supplier/products/page.tsx` — tambah category dropdown
- `/frontend/src/app/kantin/[slug]/page.tsx` — filter chip kategori, QRIS dari outlet
- `/frontend/src/app/admin/settings/page.tsx` — QRIS upload button per outlet
- `/backend/migrations/042_add_category_to_products_rpc.sql` — baru

**Migration Required:** ✅ Yes (042)  
**Breaking Changes:** ❌ No

---

### **v1.6.0** - 2026-03-29

**Type:** Feature Release  
**Status:** ✅ Production

**New Features:**

#### 🏪 Outlet Customization
- **Logo outlet:** Upload logo per outlet, tersimpan di `outlet-media/logos/`
- **Brand name:** Nama merek custom untuk outlet (tampil di header halaman customer)
- **Header gradient:** Pilih warna gradient header (`header_color_from`, `header_color_to`)
- **Default colors:** `#dc2626` (red-600) → `#ea580c` (orange-600)

#### 🎠 Carousel Slide Management
- Admin bisa tambah/edit/hapus slide gambar per outlet
- Konfigurasi: title, subtitle, link_url, sort_order, is_active
- Slide tampil di atas produk halaman customer
- Gambar tersimpan di `outlet-media/slides/`

#### 📊 Traffic Analytics
- Track page_view, cart_add, checkout_start per outlet
- Tabel `outlet_page_views` menyimpan event anonim dari halaman customer
- Accessible dari admin panel (per outlet stats)

#### 🗄️ Storage Bucket outlet-media
- Public bucket `outlet-media` dibuat otomatis via migration 041
- File size limit: 5MB
- Supported types: JPEG, PNG, GIF, WebP
- Paths: `logos/`, `slides/`, `qris/`

**Database Migrations:**
- Migration 041: Kolom kustomisasi di `locations`, tabel `outlet_page_views`, tabel `outlet_carousel_slides`, bucket `outlet-media`, RLS policies

**Files Changed:**
- `/frontend/src/app/admin/settings/page.tsx` — outlet customization UI, carousel management
- `/frontend/src/app/kantin/[slug]/page.tsx` — tampilkan carousel, gunakan brand name & header gradient
- `/backend/migrations/041_outlet_customization_carousel_traffic.sql` — baru

**Migration Required:** ✅ Yes (041)  
**Breaking Changes:** ❌ No

---

### **v1.5.0** - 2026-03-28

**Type:** Feature Release  
**Status:** ✅ Production

**New Features:**

#### 💳 Dynamic QRIS per Transaksi (Migration 036)
- Mendukung integrasi payment gateway (Xendit, Midtrans, Manual)
- Kolom baru di `sales_transactions`: `payment_provider`, `xendit_invoice_id`, `xendit_qr_id`, `xendit_callback_token`, `xendit_expiry_at`
- Fondasi untuk Xendit Dynamic QRIS per transaksi

#### ⏰ Auto-Cancel Pending Transactions (Migration 037)
- Transaksi PENDING yang tidak dibayar dalam 5 menit otomatis di-cancel
- Function `cancel_expired_pending_transactions()` — dipanggil via cron (pg_cron atau Edge Function)
- Stok otomatis dikembalikan saat cancel

#### 📅 Product Expiry Duration (Migration 038)
- Kolom `expiry_duration_days INTEGER DEFAULT 30` di tabel `products`
- Admin & supplier bisa set masa kadaluarsa produk
- Digunakan untuk alert stok kadaluarsa

#### 📸 Payment Proof Required (Migration 039)
- Kolom `payment_proof_url TEXT` di `sales_transactions`
- Function `confirm_payment_with_method` diupdate untuk simpan bukti bayar
- Bucket `customer-proofs` dibuat untuk upload bukti bayar anonim

#### 🕐 paid_at Timestamp (Migration 040)
- Kolom `paid_at TIMESTAMPTZ` di `sales_transactions`
- Diisi otomatis saat payment dikonfirmasi
- Digunakan untuk laporan penjualan dan analitik

**Database Migrations:**
- Migration 036: Kolom payment gateway di sales_transactions
- Migration 037: Function auto-cancel + function cancel_single_transaction
- Migration 038: Kolom expiry_duration_days di products
- Migration 039: Kolom payment_proof_url + update confirm_payment_with_method + bucket customer-proofs
- Migration 040: Kolom paid_at + fix confirm_payment_with_method

**Files Changed:**
- `/frontend/src/app/kantin/[slug]/checkout/page.tsx` — QRIS timer 30 menit, countdown
- `/frontend/src/app/kantin/[slug]/payment/[id]/page.tsx` — upload bukti bayar
- `/backend/migrations/036_add_payment_gateway_columns.sql` — baru
- `/backend/migrations/037_auto_cancel_pending_transactions.sql` — baru
- `/backend/migrations/038_add_expiry_duration_days_to_products.sql` — baru
- `/backend/migrations/039_confirm_payment_require_proof.sql` — baru
- `/backend/migrations/040_add_paid_at_to_sales_transactions.sql` — baru

**Migration Required:** ✅ Yes (036–040)  
**Breaking Changes:** ❌ No

---

### **v1.4.0** - 2026-03-28

**Type:** Critical Bug Fix Release  
**Status:** ✅ Production

**Bug Fixes:**

#### 🔴 Vercel Build Failure (CRITICAL)
- **Root Cause 1:** `next-pwa@5.6.0` + Node.js 22+ menyebabkan `RangeError: Maximum call stack size exceeded` di fase "Collecting build traces" via `micromatch`
- **Root Cause 2:** `"engines": { "node": ">=18.0.0" }` menyebabkan Vercel auto-upgrade ke Node.js 24.x yang memperparah crash
- **Root Cause 3:** Next.js `14.0.4` punya bug di `collect-build-traces.js` → `shouldIgnore` → `micromatch.isMatch` overflow
- **Fix:** Upgrade Next.js `14.0.4` → `14.2.29`, pin Node.js ke `22.x`, disable next-pwa di Vercel via `process.env.VERCEL`

#### 🔴 Checkout 500 Internal Error (CRITICAL)
- **Root Cause:** Frontend memanggil `process_anonymous_checkout` dengan parameter salah: `p_location_id` (UUID) padahal function butuh `p_location_slug` (TEXT). Juga mengirim `p_total_amount` yang tidak ada di signature.
- **Fix:** Ubah RPC call ke `{ p_location_slug: locationSlug, p_items: items }`
- **File:** `/frontend/src/app/kantin/[slug]/checkout/page.tsx`

#### 🔴 Produk Tidak Tampil di Marketplace (CRITICAL)
- **Root Cause 1:** SQL function `get_products_by_location` punya filter `AND l.type = 'OUTLET'` — lokasi bernama `kantin-kejujuran` memiliki type berbeda
- **Root Cause 2:** URL yang dipakai `/kantin/outlet_lobby_a` tidak cocok dengan `qr_code` database = `kantin-kejujuran`
- **Fix SQL:** Hapus filter `l.type = 'OUTLET'` dari function (Migration 035)
- **Fix URL:** Gunakan `/kantin/kantin-kejujuran` yang sesuai qr_code di database

#### 🟡 `useSearchParams()` Error di Next.js 14.2 (MEDIUM)
- **Root Cause:** Next.js 14.2 mewajibkan `useSearchParams()` dibungkus `<Suspense>` saat static generation
- **Affected Pages:** `/admin/suppliers/products`, `/admin/suppliers/shipments`, `/supplier/login`
- **Fix:** Pisahkan komponen utama → `XxxContent()`, bungkus dengan `<Suspense>` di default export

**Database Migrations:**
- Migration 034: Fix `process_anonymous_checkout` — hapus `p.is_active` check (kolom tidak ada), fix `confirm_payment_with_method` (hapus `reserved_quantity`)
- Migration 035: Fix `get_products_by_location` — hapus filter `l.type = 'OUTLET'`

**Files Changed:**
- `/frontend/next.config.js` — disable next-pwa on Vercel
- `/frontend/package.json` — Next.js 14.0.4→14.2.29, pin node 22.x
- `/frontend/package-lock.json` — updated
- `/frontend/src/app/kantin/[slug]/checkout/page.tsx` — fix RPC params
- `/frontend/src/app/admin/suppliers/products/page.tsx` — Suspense wrap
- `/frontend/src/app/admin/suppliers/shipments/page.tsx` — Suspense wrap
- `/frontend/src/app/supplier/login/page.tsx` — Suspense wrap
- `/backend/migrations/034_fix_checkout_remove_is_active.sql` — baru
- `/backend/migrations/035_fix_get_products_by_location.sql` — baru
- `/vercel.json` — tambah NODE_OPTIONS env

**Migration Required:** ✅ Yes (034 & 035)  
**Breaking Changes:** ❌ No

---

### **v1.3.0** - 2025-12-02

**Type:** Minor Release  
**Status:** ✅ Production

**New Features:**
- ✨ Permanent delete for REJECTED suppliers
- ✨ REJECTED status added to supplier workflow
- ✨ Bulk delete for rejected suppliers
- ✨ Enhanced supplier stats (Total, Approved, Pending, Rejected)

**Improvements:**
- 🎨 Updated supplier management UI with status badges
- 🎨 Improved confirmation dialogs with warnings
- 📊 Added 4th stats card for rejected suppliers

**Bug Fixes:**
- 🐛 Fixed checkout double submission on page refresh
- 🐛 Fixed return approval error (stock_movement_id issue)
- 🐛 Fixed shipment KPI queries (SHIPMENT → IN)

**Database Changes:**
```sql
-- No schema changes in this version
-- Updated supplier status enum to support 'REJECTED'
-- Fixed trigger: handle_return_reduce_pending
```

**Files Changed:**
- `/frontend/src/app/admin/suppliers/page.tsx`
- `/frontend/src/app/kantin/[slug]/checkout/page.tsx`
- `/database/FIX-TRIGGER-RETURN-REDUCE-PENDING.sql`
- `/database/CREATE-RETURN-RPC-FUNCTIONS.sql`

**Migration Required:** ❌ No  
**Breaking Changes:** ❌ No

---

## 📚 PREVIOUS VERSIONS

### **v1.2.0** - 2025-12-01

**Type:** Minor Release

**New Features:**
- ✨ Return management system for damaged/expired products
- ✨ Supplier return approval workflow
- ✨ Automatic wallet deduction on return approval
- ✨ Return pickup confirmation

**Database Changes:**
```sql
-- New table: shipment_returns
CREATE TABLE shipment_returns (...);

-- New RPC functions
CREATE FUNCTION approve_return_request(...);
CREATE FUNCTION reject_return_request(...);
CREATE FUNCTION confirm_return_pickup(...);

-- New trigger
CREATE TRIGGER trigger_return_reduce_pending
AFTER UPDATE ON shipment_returns
FOR EACH ROW
EXECUTE FUNCTION handle_return_reduce_pending();
```

**Files Added:**
- `/database/CREATE-SHIPMENT-RETURNS.sql`
- `/database/CREATE-RETURN-RPC-FUNCTIONS.sql`
- `/frontend/src/app/admin/returns/page.tsx`
- `/frontend/src/app/supplier/returns/page.tsx`

**Migration Required:** ✅ Yes (run CREATE-SHIPMENT-RETURNS.sql)  
**Breaking Changes:** ❌ No

---

### **v1.1.0** - 2025-11-28

**Type:** Minor Release

**New Features:**
- ✨ Self-checkout system for customers
- ✨ QR code-based location access
- ✨ QRIS payment integration
- ✨ Anonymous transaction processing

**Improvements:**
- 🎨 Improved checkout flow UX
- 📊 Added transaction code generation
- 🔒 Added payment confirmation workflow

**Database Changes:**
```sql
-- Added qr_code to locations
ALTER TABLE locations ADD COLUMN qr_code TEXT UNIQUE;

-- Added transaction_code to sales_transactions
ALTER TABLE sales_transactions ADD COLUMN transaction_code TEXT UNIQUE;

-- New RPC function
CREATE FUNCTION process_anonymous_checkout(...);
```

**Files Added:**
- `/frontend/src/app/kantin/[slug]/page.tsx`
- `/frontend/src/app/kantin/[slug]/checkout/page.tsx`
- `/frontend/src/app/kantin/[slug]/payment/[id]/page.tsx`

**Migration Required:** ✅ Yes  
**Breaking Changes:** ❌ No

---

### **v1.0.0** - 2025-11-20

**Type:** Major Release - Initial Launch

**Features:**
- ✅ Multi-role authentication (ADMIN, SUPPLIER)
- ✅ Supplier onboarding & approval workflow
- ✅ Product management with approval
- ✅ Inventory tracking per location
- ✅ Stock movement tracking
- ✅ Sales transaction management
- ✅ Commission system (10% platform, 90% supplier)
- ✅ Supplier wallet system
- ✅ Admin dashboard with KPIs
- ✅ Supplier dashboard

**Initial Database Schema:**
```sql
-- Core tables
CREATE TABLE profiles (...);
CREATE TABLE suppliers (...);
CREATE TABLE locations (...);
CREATE TABLE products (...);
CREATE TABLE inventory_levels (...);
CREATE TABLE stock_movements (...);
CREATE TABLE stock_movement_items (...);
CREATE TABLE sales_transactions (...);
CREATE TABLE sales_transaction_items (...);
CREATE TABLE supplier_wallets (...);
CREATE TABLE wallet_transactions (...);

-- RLS policies
-- Triggers
-- Indexes
```

**Technology Stack:**
- Next.js 14.0.4 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Auth + Storage)
- Vercel (Hosting)

**Migration Required:** ✅ Yes (initial setup)  
**Breaking Changes:** N/A (first version)

---

## 🔄 MIGRATION GUIDE

### **How to Upgrade:**

#### **From v1.2.0 to v1.3.0:**
```bash
# No database migration needed
# Just deploy new code

git pull origin main
npm install
npm run build
# Vercel auto-deploys
```

#### **From v1.1.0 to v1.2.0:**
```sql
-- Run in Supabase SQL Editor
\i database/CREATE-SHIPMENT-RETURNS.sql
\i database/CREATE-RETURN-RPC-FUNCTIONS.sql
```

#### **From v1.0.0 to v1.1.0:**
```sql
-- Add QR code to locations
ALTER TABLE locations ADD COLUMN qr_code TEXT UNIQUE;
UPDATE locations SET qr_code = gen_random_uuid()::text WHERE qr_code IS NULL;

-- Add transaction code
ALTER TABLE sales_transactions ADD COLUMN transaction_code TEXT UNIQUE;

-- Create RPC function
\i database/CREATE-ANONYMOUS-CHECKOUT.sql
```

---

## 📊 FEATURE TIMELINE

```
Nov 2025: v1.0.0 - Initial Release
  ├─ Core platform features
  ├─ Admin & Supplier panels
  └─ Basic inventory management

Nov 2025: v1.1.0 - Self-Checkout
  ├─ QR code system
  ├─ Anonymous checkout
  └─ QRIS payment

Dec 2025: v1.2.0 - Return Management
  ├─ Return requests
  ├─ Supplier approval workflow
  └─ Automatic wallet deduction

Dec 2025: v1.3.0 - Supplier Management Enhancement
  ├─ Permanent delete
  ├─ REJECTED status
  └─ Bulk operations

Planned: v1.4.0 - Location Admin System
  ├─ LOCATION_ADMIN role
  ├─ Location-specific access
  └─ Enhanced RLS policies

Planned: v2.0.0 - Major Update
  ├─ Withdrawal request system
  ├─ Supplier analytics
  └─ Performance improvements
```

---

## 🐛 BUG FIXES LOG

### **Critical Bugs Fixed:**

#### **v1.3.0 Fixes:**
1. **Checkout Double Submission**
   - Issue: Page refresh caused duplicate transactions
   - Fix: Added sessionStorage idempotency check
   - File: `/frontend/src/app/kantin/[slug]/checkout/page.tsx`

2. **Return Approval Error**
   - Issue: Trigger referenced non-existent field `stock_movement_id`
   - Fix: Changed to use `NEW.supplier_id` directly
   - File: `/database/FIX-TRIGGER-RETURN-REDUCE-PENDING.sql`

3. **Shipment KPI Wrong Data**
   - Issue: Query used `movement_type = 'SHIPMENT'` (wrong)
   - Fix: Changed to `movement_type = 'IN'` (correct)
   - Files: Dashboard pages

#### **v1.2.0 Fixes:**
1. **Wallet Not Updating**
   - Issue: Sales not updating pending_balance
   - Fix: Added trigger for automatic update

2. **RLS Policy Too Restrictive**
   - Issue: Suppliers couldn't read own products
   - Fix: Updated RLS policy

---

## 📝 DEPRECATION NOTICES

### **Deprecated in v1.3.0:**
- ❌ None

### **Deprecated in v1.2.0:**
- ❌ None

### **Planned Deprecations:**
- ⚠️ `payment_settings` table (will merge to `locations`)

---

## 🔮 UPCOMING FEATURES

### **Next Release (v1.4.0):**
- Location Admin System
- Enhanced RLS policies
- Location-specific permissions

### **Future Releases:**
- Withdrawal request management (v1.5.0)
- Supplier analytics dashboard (v1.6.0)
- Bulk product upload (v1.7.0)
- Customer loyalty program (v2.0.0)

---

## 📞 VERSION SUPPORT

| Version | Status | Support Until | Notes |
|---------|--------|---------------|-------|
| v1.3.0 | ✅ Current | Active | Latest stable |
| v1.2.0 | ⚠️ Deprecated | 2025-12-31 | Upgrade recommended |
| v1.1.0 | ❌ Unsupported | 2025-11-30 | Security updates only |
| v1.0.0 | ❌ Unsupported | 2025-11-30 | No longer maintained |

---

## 🔐 SECURITY UPDATES

### **v1.3.0 Security:**
- ✅ All dependencies updated
- ✅ No known vulnerabilities
- ✅ RLS policies reviewed

### **v1.2.0 Security:**
- ✅ Fixed RLS bypass in products table
- ✅ Updated auth callback handling

---

## 📄 RELEASE NOTES TEMPLATE

```markdown
## vX.Y.Z - YYYY-MM-DD

**Type:** Major/Minor/Patch Release  
**Status:** Production/Beta/Alpha

### New Features
- ✨ Feature 1
- ✨ Feature 2

### Improvements
- 🎨 Improvement 1
- 🎨 Improvement 2

### Bug Fixes
- 🐛 Fix 1
- 🐛 Fix 2

### Database Changes
```sql
-- SQL changes here
```

### Files Changed
- `/path/to/file1`
- `/path/to/file2`

### Migration Required
- [ ] Yes / [x] No
- Steps: ...

### Breaking Changes
- [ ] Yes / [x] No
- Details: ...

### Contributors
- @username1
- @username2
```

---

## 📊 STATISTICS

**Total Releases:** 4  
**Total Features:** 25+  
**Total Bug Fixes:** 8  
**Total Files Changed:** 100+  
**Lines of Code:** ~15,000+

**Release Frequency:**
- Nov 2025: 3 releases
- Dec 2025: 1 release (so far)

**Average Time Between Releases:** ~7 days

---

## 🎯 VERSIONING POLICY

We follow **Semantic Versioning (SemVer)**:

- **MAJOR (X.0.0):** Breaking changes, API changes
- **MINOR (0.X.0):** New features, backward-compatible
- **PATCH (0.0.X):** Bug fixes, minor improvements

**Release Types:**
- **Stable:** Fully tested, production-ready
- **Beta:** Feature-complete, final testing
- **Alpha:** Early preview, may have bugs

**Support Policy:**
- Latest version: Full support
- Previous minor: Security updates for 3 months
- Older versions: No support

---

**Document Version:** 1.0  
**Last Updated:** 2 Desember 2025  
**Maintained By:** Development Team
