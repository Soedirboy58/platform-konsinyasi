# 📚 Panduan Lengkap Platform Konsinyasi Katalara

**Versi:** 1.0  
**Terakhir Update:** November 2024  
**Status:** Production Ready

---

## 📖 Daftar Isi

1. [Pengenalan](#1-pengenalan)
2. [Instalasi & Setup](#2-instalasi--setup)
3. [Konfigurasi Database](#3-konfigurasi-database)
4. [Konfigurasi Email](#4-konfigurasi-email)
5. [Deployment](#5-deployment)
6. [Fitur-Fitur Utama](#6-fitur-fitur-utama)
7. [Troubleshooting](#7-troubleshooting)
8. [Backup & Recovery](#8-backup--recovery)

---

## 1. Pengenalan

### Apa itu Platform Konsinyasi?

Platform Konsinyasi Katalara adalah sistem manajemen bisnis konsinyasi yang menghubungkan:
- **Supplier**: Pemasok barang
- **Admin Toko (Outlet)**: Pengelola toko
- **Customer**: Pembeli akhir

### Teknologi Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Deployment**: Vercel
- **PWA**: Progressive Web App enabled

### Fitur Utama

✅ Manajemen Stok & Produk  
✅ Sistem Konsinyasi Otomatis  
✅ Pembayaran & Komisi  
✅ Laporan Penjualan  
✅ Self-Checkout untuk Customer  
✅ Email Verifikasi  
✅ PWA Support (Install ke Home Screen)

---

## 2. Instalasi & Setup

### Prerequisites

```bash
# Node.js v18+ dan npm
node --version  # v18+
npm --version   # v9+

# Git
git --version
```

### Clone Repository

```bash
git clone https://github.com/Soedirboy58/platform-konsinyasi.git
cd platform-konsinyasi
```

### Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend (jika ada)
cd ../backend
npm install
```

### Environment Variables

Buat file `.env.local` di folder `frontend/`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Cara mendapatkan Supabase credentials:**
1. Login ke [supabase.com](https://supabase.com)
2. Pilih project Anda
3. Settings → API
4. Copy **Project URL** dan **anon public** key

### Jalankan Development Server

```bash
cd frontend
npm run dev
```

Buka browser: [http://localhost:3000](http://localhost:3000)

---

## 3. Konfigurasi Database

### Setup Database di Supabase

#### 1️⃣ Buat Project Baru

1. Login ke [Supabase Dashboard](https://app.supabase.com)
2. Klik **New Project**
3. Isi nama project, database password, region

#### 2️⃣ Run Migrations

Migrations ada di folder `MASTER-BACKUP/02-MIGRATIONS/`

**Urutan eksekusi (17 migrations):**

```bash
# Di Supabase Dashboard → SQL Editor → New Query
```

Jalankan file-file ini secara berurutan:

1. `001_initial_schema.sql` - Schema dasar
2. `002_profiles.sql` - User profiles
3. `003_suppliers.sql` - Data supplier
4. `004_products.sql` - Produk & kategori
5. `005_stock_movements.sql` - Pergerakan stok
6. `006_outlets.sql` - Toko/outlet
7. `007_supplier_outlets.sql` - Relasi supplier-outlet
8. `008_sales.sql` - Transaksi penjualan
9. `009_payments.sql` - Pembayaran
10. `010_returns.sql` - Retur barang
11. `011_notifications.sql` - Sistem notifikasi
12. `012_commissions.sql` - Perhitungan komisi
13. `013_reports.sql` - Laporan
14. `014_storage.sql` - File storage (foto produk)
15. `015_rls_policies.sql` - Row Level Security
16. `016_functions.sql` - Database functions
17. `017_indexes.sql` - Performance indexes

#### 3️⃣ Seed Data (Optional)

```sql
-- Insert data contoh untuk testing
-- File: MASTER-BACKUP/06-SEEDS/seed-data.sql
```

#### 4️⃣ Verifikasi Database

```sql
-- Cek semua tabel
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should return 17+ tables
```

---

## 4. Konfigurasi Email

### Setup Email Verifikasi di Supabase

#### 1️⃣ Konfigurasi URL

**Supabase Dashboard → Authentication → URL Configuration**

```
Site URL: https://platform-konsinyasi.vercel.app
```

**Redirect URLs** (tambahkan semua):
```
https://platform-konsinyasi.vercel.app/auth/callback
https://platform-konsinyasi.vercel.app/supplier/login
https://platform-konsinyasi.vercel.app/**
http://localhost:3000/auth/callback
http://localhost:3000/supplier/login
http://localhost:3000/**
```

⚠️ **Penting:** Ganti dengan URL production Anda yang sebenarnya!

#### 2️⃣ Email Template

**Authentication → Email Templates → Confirm signup**

**Subject:**
```
Verifikasi Email - Platform Konsinyasi Katalara
```

**Body (HTML):**
Copy dari file `supabase/email-template-confirm-signup.html`

Atau gunakan template sederhana:

```html
<h2>Selamat Datang di Platform Konsinyasi Katalara! 🎉</h2>

<p>Terima kasih telah mendaftar sebagai <strong>Supplier</strong>.</p>

<p>Klik tombol di bawah untuk verifikasi email Anda:</p>

<a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
  ✅ Verifikasi Email
</a>

<p style="margin-top: 20px; font-size: 13px; color: #666;">
  Link: {{ .ConfirmationURL }}
</p>

<p style="font-size: 12px; color: #999;">
  Link kadaluarsa dalam 24 jam.<br/>
  © 2024 Katalara
</p>
```

#### 3️⃣ Enable Email Confirmation

**Authentication → Settings**

- ✅ **Enable email confirmations**: ON
- ✅ **Secure email change**: ON
- ❌ **Mailer autoconfirm**: OFF

#### 4️⃣ Testing

1. Daftar akun baru di `/supplier/login`
2. Cek email inbox (dan spam folder)
3. Klik link verifikasi
4. Redirect ke login page dengan pesan sukses

---

## 5. Deployment

### Deploy ke Vercel

#### Metode 1: Via Dashboard (Recommended)

1. Login ke [vercel.com](https://vercel.com)
2. Import repository dari GitHub
3. Pilih `platform-konsinyasi`
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
5. Tambahkan Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_APP_URL=https://platform-konsinyasi.vercel.app
   ```
6. Klik **Deploy**

#### Metode 2: Via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd frontend
vercel --prod
```

#### Setup Custom Domain (Optional)

1. Vercel Dashboard → Settings → Domains
2. Add domain: `konsinyasi.katalara.com`
3. Update DNS records (A/CNAME)
4. Update Supabase Site URL dengan domain baru

### Environment Variables Production

**Penting:** Set di Vercel Dashboard → Settings → Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://platform-konsinyasi.vercel.app
```

### Verifikasi Deployment

1. Buka URL production
2. Test login/register
3. Test email verification
4. Test PWA install (Add to Home Screen)
5. Test responsive mobile

---

## 6. Fitur-Fitur Utama

### 6.1 Manajemen Supplier

**Route:** `/supplier/*`

**Fitur:**
- ✅ Registrasi & Login
- ✅ Email Verification
- ✅ Dashboard supplier
- ✅ Upload produk
- ✅ Tracking stok
- ✅ Laporan penjualan
- ✅ Payment history
- ✅ Notifikasi real-time

**Cara Pakai:**
1. Daftar di `/supplier/login`
2. Verifikasi email
3. Complete onboarding
4. Upload produk pertama
5. Assign ke outlet

### 6.2 Manajemen Admin Toko

**Route:** `/admin/*`

**Fitur:**
- ✅ Dashboard toko
- ✅ Kelola produk konsinyasi
- ✅ Input penjualan
- ✅ Returns management
- ✅ Payment ke supplier
- ✅ Laporan harian/bulanan

**Cara Pakai:**
1. Login dengan akun admin
2. Review produk dari supplier
3. Accept/reject produk
4. Input penjualan harian
5. Generate laporan
6. Process payment

### 6.3 Self-Checkout Customer

**Route:** `/customer/checkout`

**Fitur:**
- ✅ Scan barcode/QR
- ✅ Keranjang belanja
- ✅ Pilih metode pembayaran
- ✅ Upload bukti transfer
- ✅ Email konfirmasi

**Cara Pakai:**
1. Customer scan produk
2. Add to cart
3. Checkout
4. Upload bukti pembayaran
5. Selesai

### 6.4 PWA (Progressive Web App)

**Fitur:**
- ✅ Install ke home screen
- ✅ Offline support
- ✅ Fast loading
- ✅ Push notifications (coming soon)

**Cara Install:**
1. Buka website di mobile
2. Tap menu browser (⋮)
3. Pilih "Add to Home Screen"
4. Icon muncul di home screen

**Files:**
- `frontend/public/manifest.json`
- `frontend/public/sw.js` (service worker)
- `frontend/public/offline.html`

---

## 7. Troubleshooting

### Masalah Umum

#### ❌ Email verification tidak sampai

**Solusi:**
1. Cek spam folder
2. Verifikasi Site URL di Supabase
3. Cek Redirect URLs sudah ditambahkan
4. Review email logs di Supabase → Authentication → Logs

#### ❌ Link email redirect ke vercel.com/login

**Penyebab:** Site URL tidak di-set atau salah

**Solusi:**
1. Supabase Dashboard → Authentication → URL Configuration
2. Set Site URL: `https://platform-konsinyasi.vercel.app`
3. Save changes
4. Test register ulang

#### ❌ Build error di Vercel

**Solusi:**
1. Cek environment variables sudah benar
2. Cek `next.config.js` tidak ada error
3. Review build logs di Vercel
4. Test build lokal: `npm run build`

#### ❌ Database connection error

**Solusi:**
1. Verifikasi `NEXT_PUBLIC_SUPABASE_URL`
2. Verifikasi `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Cek Supabase project tidak di-pause
4. Test connection di browser console

#### ❌ PWA tidak muncul "Add to Home Screen"

**Solusi:**
1. Harus HTTPS (localhost atau production)
2. Cek `manifest.json` valid
3. Cek service worker registered
4. Clear browser cache
5. Test di Chrome DevTools → Application → Manifest

### Debug Tools

```bash
# Check logs
npm run dev

# Build test
npm run build

# Type check
npm run type-check

# Lint
npm run lint
```

### Logs & Monitoring

**Supabase Logs:**
- Dashboard → Logs → Postgres Logs
- Dashboard → Authentication → Logs

**Vercel Logs:**
- Dashboard → Deployments → Click deployment → View Logs
- Runtime Logs
- Build Logs

---

## 8. Backup & Recovery

### Struktur Backup

Semua backup ada di folder `MASTER-BACKUP/`

```
MASTER-BACKUP/
├── 01-CORE-SCHEMA/       # Schema database
├── 02-MIGRATIONS/        # 17 migration files
├── 03-PATCHES/           # Patch fixes
├── 04-FUNCTIONS/         # Database functions
├── 05-RLS-POLICIES/      # Security policies
├── 06-SEEDS/             # Sample data
└── 07-DOCUMENTATION/     # Technical docs
```

### Cara Backup Database

#### Manual Backup via Supabase

```bash
# Supabase Dashboard → Database → Backups → Create backup
```

#### Export via SQL

```sql
-- Export semua data
-- Supabase Dashboard → SQL Editor

-- Export schema only
pg_dump --schema-only

-- Export data only
pg_dump --data-only
```

#### Automated Backup (Recommended)

Setup automated daily backup:
1. Supabase Dashboard → Database → Backups
2. Enable **Daily backups**
3. Retention: 7 days (free tier)

### Cara Restore Database

#### Skenario 1: Restore from Scratch

```bash
# 1. Create new Supabase project
# 2. Run migrations from MASTER-BACKUP/02-MIGRATIONS/
# 3. Run functions from 04-FUNCTIONS/
# 4. Apply RLS from 05-RLS-POLICIES/
# 5. Seed data from 06-SEEDS/
```

#### Skenario 2: Restore from Backup

```bash
# Supabase Dashboard → Database → Backups
# Select backup → Restore
```

#### Skenario 3: Restore Specific Table

```sql
-- Export table first
COPY products TO '/tmp/products_backup.csv' CSV HEADER;

-- Restore
COPY products FROM '/tmp/products_backup.csv' CSV HEADER;
```

### Backup Frontend

```bash
# Git commit
git add .
git commit -m "backup: production snapshot $(date +%Y%m%d)"
git push origin main

# Create tag
git tag -a v1.0.0 -m "Production release"
git push origin v1.0.0
```

### Recovery Plan

**Prioritas jika terjadi disaster:**

1. **Database** (Critical)
   - Restore dari Supabase backup
   - Apply latest migrations
   - Verify data integrity

2. **Frontend** (High)
   - Redeploy dari GitHub
   - Restore environment variables
   - Verify routing

3. **Assets** (Medium)
   - Restore from Supabase Storage
   - Re-upload product photos
   - Verify image URLs

4. **Configuration** (High)
   - Restore environment variables
   - Reconfigure Supabase URLs
   - Test email verification

**Recovery Time Objective (RTO):** < 2 hours  
**Recovery Point Objective (RPO):** < 24 hours (daily backup)

---

## 📞 Support

**Developer:** Katalara Team  
**Email:** support@katalara.com  
**GitHub:** [platform-konsinyasi](https://github.com/Soedirboy58/platform-konsinyasi)

---

## 📄 License

© 2024 Katalara. All rights reserved.

---

## 🎉 Selesai!

Panduan ini mencakup semua yang Anda butuhkan untuk:
- ✅ Setup dari nol
- ✅ Deploy ke production
- ✅ Maintain & troubleshoot
- ✅ Backup & recovery

**Next Steps:**
1. Follow setup step-by-step
2. Test di development
3. Deploy ke Vercel
4. Configure Supabase
5. Launch! 🚀
