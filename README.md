# 🏪 Platform Konsinyasi Katalara

Platform digital manajemen konsinyasi yang menghubungkan Supplier, Admin Toko, dan Customer dalam satu ekosistem.

**Version:** `v2.3.0` | **Status:** ✅ Production | **Last Updated:** 26 Mei 2026  
**Repository:** `Soedirboy58/platform-konsinyasi` | **Branch:** `main` (auto-deploy to Vercel)  
**Production URL:** [smartalley.katalara.com](https://smartalley.katalara.com)

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/Soedirboy58/platform-konsinyasi.git
cd platform-konsinyasi

# Install dependencies
cd frontend
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local dengan Supabase credentials

# Run development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

## 📚 Dokumentasi Lengkap

| Dokumen | Isi |
|---------|-----|
| [AI-GUIDE/README.md](AI-GUIDE/README.md) | **📖 Mulai di sini** — arsitektur, schema, role, pola kode |
| [AI-GUIDE/CHANGELOG.md](AI-GUIDE/CHANGELOG.md) | Riwayat versi lengkap (v1.0 → v2.3) |
| [AI-GUIDE/DATABASE-SCHEMA.md](AI-GUIDE/DATABASE-SCHEMA.md) | Semua table, column, RPC, trigger |
| [AI-GUIDE/TROUBLESHOOTING.md](AI-GUIDE/TROUBLESHOOTING.md) | Error umum dan solusinya |
| [AI-GUIDE/PAYMENT-GATEWAY.md](AI-GUIDE/PAYMENT-GATEWAY.md) | Integrasi QRIS & payment gateway |
| [docs/development-summary.md](docs/development-summary.md) | Ringkasan fitur & statistik codebase |
| [PANDUAN-LENGKAP.md](PANDUAN-LENGKAP.md) | Setup, deployment, troubleshooting lengkap |

## 🎯 Fitur Utama

### Admin Panel (`/admin/*`)
- ✅ **Dashboard** — statistik harian, quick actions
- ✅ **Manajemen Supplier** — approval, produk, pengiriman stok, retur
- ✅ **Manajemen Produk** — moderasi, kategori, HPP
- ✅ **Manajemen Lokasi / Outlet** — CRUD, customization (logo, brand, gradient, QRIS)
- ✅ **Laporan Penjualan** — filter tanggal, export CSV
- ✅ **Laporan Stok** — stock movements per supplier
- ✅ **Pembayaran ke Supplier** — card view per-mitra, upload bukti bayar, tracking balance
- ✅ **Settings** — outlet carousel, banner homepage, konfigurasi platform
- ✅ **Manajemen User Admin** — CRUD admin, edit profil & role, kirim undangan, reset password
- ✅ **Notifikasi In-App** — bell icon topbar, badge unread, realtime via Supabase channel

### Supplier Portal (`/supplier/*`)
- ✅ **Dashboard** — ringkasan penjualan & pendapatan
- ✅ **Produk** — CRUD dengan kategori, HPP, expiry
- ✅ **Pengiriman Stok** — kirim barang ke toko, lacak status
- ✅ **Retur Barang** — proses retur dari toko
- ✅ **Laporan Komisi** — history pembayaran dari admin
- ✅ **Notifikasi In-App** — bell icon topbar supplier

### Customer Self-Checkout (`/kantin/[slug]`)
- ✅ **PWA per outlet** — install ke homescreen, buka langsung ke outlet
- ✅ **Filter kategori** — filter produk by category
- ✅ **Cart & Checkout** — upload bukti QRIS
- ✅ **Dynamic QRIS** — gambar QRIS per outlet
- ✅ **Carousel promosi** — slide per outlet

### Platform / Landing Page
- ✅ **Landing page** — hero, feature highlights, CTA portal
- ✅ **Supplier marquee** — carousel infinite-scroll mitra bergabung
- ✅ **Unified login** — satu halaman login untuk semua role
- ✅ **Branding** — amber/gold gradient theme, logo Katalara real

### Infrastruktur
- ✅ **46 Database Migrations** — schema lengkap, RLS, triggers, RPC
- ✅ **pg_cron jobs** — auto-cancel pending (5 mnt) + cleanup phantom deduction (30 mnt)
- ✅ **Toast Notifications** — Sonner di seluruh admin & supplier panel
- ✅ **Storage Supabase** — `outlet-media` (logos, slides, qris, banners), `customer-proofs`
- ✅ **Custom HTML Email Templates** — 3 template branded (invite, signup, reset password)
- ✅ **SMTP via Resend** — sender `noreply@katalara.com`
- ✅ **Auth Flows** — invite admin (implicit flow + manual setSession), supplier email verification

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Frontend** | Next.js 14.2.29 (App Router), TypeScript strict, Tailwind CSS |
| **Backend** | Supabase (PostgreSQL 15, Auth, Storage, RLS) |
| **Deployment** | Vercel (frontend), Supabase Cloud (backend) |
| **Notifikasi UI** | Sonner (toast) |
| **PWA** | next-pwa@5.6.0 (disabled on Vercel, enabled dev only) |
| **Icons** | Lucide React |
| **Node.js** | `22.x` (pinned di `package.json` engines) |

## 📁 Struktur Project

```
konsinyasi/
├── frontend/                   # Next.js 14 App Router
│   ├── src/app/
│   │   ├── page.tsx            # Landing page (+ supplier marquee)
│   │   ├── admin/              # Admin panel (12+ halaman)
│   │   │   ├── payments/commissions/  # Pembayaran ke supplier (card view)
│   │   │   └── settings/       # Outlet & banner management
│   │   ├── supplier/           # Supplier portal (5 halaman)
│   │   ├── kantin/[slug]/      # Self-checkout PWA per outlet
│   │   └── api/kantin-manifest/[slug]/  # Dynamic PWA manifest
│   └── public/                 # Static assets, icons
├── backend/
│   └── migrations/             # 46 SQL migrations (001–046)
├── AI-GUIDE/                   # 📖 Panduan untuk AI Agent
│   ├── README.md               # Overview arsitektur & pola kode
│   ├── CHANGELOG.md            # Riwayat versi lengkap
│   ├── DATABASE-SCHEMA.md      # Schema tabel & RPC
│   ├── TROUBLESHOOTING.md      # Masalah umum & solusi
│   └── FUTURE-PLANS/           # Rencana fitur berikutnya
├── docs/                       # Dokumentasi teknis tambahan
├── database/                   # SQL utility files
├── supabase/                   # Email templates
└── README.md
```

## 🗄️ Database Migrations

46 migrations dari `001_initial_schema.sql` hingga `046_notification_triggers.sql`.  
Jalankan secara berurutan di Supabase SQL Editor atau gunakan `backend/MIGRATION-GUIDE.md`.

**Migrations kritis:**
- `009` — Kantin checkout schema
- `019` — Auto inventory trigger
- `026` — Commission calculation
- `037` — Auto-cancel pending (5 menit)
- `041` — Outlet customization + carousel + traffic analytics
- `043` — Homepage banners table
- `044` — Cleanup phantom deduction (pg_cron 30 menit)
- `045` — kolom `admin_role` pada tabel profiles
- `046` — Notification triggers (3 event: supplier registration, shipment submitted, payment received) ⚠️ **run manual**

## 🤖 Untuk AI Agent

Baca **[AI-GUIDE/README.md](AI-GUIDE/README.md)** terlebih dahulu — berisi:
- Arsitektur lengkap & pola kode yang digunakan
- Business model & role system (ADMIN / SUPPLIER / CUSTOMER)
- Konvensi penamaan & cara query Supabase
- Common patterns untuk tambah fitur baru
- Troubleshooting error yang pernah terjadi

**Supabase Project:** `rpzoacwlswlhfqaiicho`  
**Production Domain:** `smartalley.katalara.com`  
**Vercel Project:** `platform-konsinyasi.vercel.app`

**⚠️ Pending Tasks untuk AI Agent:**
- [ ] Jalankan migration `046_notification_triggers.sql` di Supabase SQL Editor
- [ ] Pasang 3 HTML email template di Supabase Dashboard → Auth → Email Templates
- [ ] Set env var `NEXT_PUBLIC_SITE_URL=https://smartalley.katalara.com` di Vercel
- [ ] Re-invite admin test user (link lama sudah expired)

## 🔗 Links

- **Production:** [smartalley.katalara.com](https://smartalley.katalara.com) *(custom domain)*
- **Vercel:** [platform-konsinyasi.vercel.app](https://platform-konsinyasi.vercel.app)
- **Repository:** [github.com/Soedirboy58/platform-konsinyasi](https://github.com/Soedirboy58/platform-konsinyasi)
- **Supabase Dashboard:** [supabase.com/dashboard/project/rpzoacwlswlhfqaiicho](https://supabase.com/dashboard/project/rpzoacwlswlhfqaiicho)

## 🚀 Quick Start

```bash
git clone https://github.com/Soedirboy58/platform-konsinyasi.git
cd platform-konsinyasi/frontend
npm install
cp .env.example .env.local   # isi NEXT_PUBLIC_SUPABASE_URL + ANON_KEY
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

## 📞 Support

- **Developer:** Katalara Team
- **Email:** katalaraofficial@gmail.com

## 📄 License

© 2026 Katalara. All rights reserved.

---

**📖 AI Agent & Developer: mulai dari [AI-GUIDE/README.md](AI-GUIDE/README.md)**
