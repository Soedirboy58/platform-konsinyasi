# 📝 CHANGELOG & VERSION HISTORY

> **Catatan perubahan dan riwayat versi Platform Konsinyasi**  
> **Last Updated:** 30 Maret 2026

---

## 📋 VERSION FORMAT

Format: `MAJOR.MINOR.PATCH`

- **MAJOR:** Breaking changes, major new features
- **MINOR:** New features, backward-compatible
- **PATCH:** Bug fixes, minor improvements

---

## 🚀 LATEST VERSION

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
