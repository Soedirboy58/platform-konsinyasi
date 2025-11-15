# 🏪 Platform Konsinyasi Katalara

Platform digital untuk mengelola sistem konsinyasi yang menghubungkan Supplier, Admin Toko, dan Customer.

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

**👉 Lihat [PANDUAN-LENGKAP.md](PANDUAN-LENGKAP.md) untuk:**

1. ✅ Instalasi & Setup
2. ✅ Konfigurasi Database (17 migrations)
3. ✅ Email Verification Setup
4. ✅ Deployment ke Vercel
5. ✅ Troubleshooting
6. ✅ Backup & Recovery

## 🎯 Fitur Utama

- ✅ **Manajemen Supplier** - Registrasi, produk, stok, laporan
- ✅ **Dashboard Admin** - Approval, monitoring, reports
- ✅ **Self-Checkout Customer** - PWA untuk belanja mandiri
- ✅ **Email Verification** - Dengan branding Katalara
- ✅ **Progressive Web App** - Install ke home screen
- ✅ **Real-time Notifications** - Supabase realtime
- ✅ **Payment Tracking** - Komisi otomatis

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Deployment:** Vercel
- **PWA:** next-pwa, Service Worker

## 📁 Struktur Project

```
platform-konsinyasi/
├── frontend/              # Next.js application
├── backend/              # Backend utilities
├── database/             # SQL files (100+)
├── MASTER-BACKUP/        # Structured backup archive
│   ├── 01-CORE-SCHEMA/
│   ├── 02-MIGRATIONS/
│   ├── 03-PATCHES/
│   ├── 04-FUNCTIONS/
│   ├── 05-RLS-POLICIES/
│   ├── 06-SEEDS/
│   └── 07-DOCUMENTATION/
├── supabase/             # Email templates
├── PANDUAN-LENGKAP.md   # 📖 Complete guide
└── README.md            # This file
```

## 🔗 Links

- **Production:** [platform-konsinyasi.vercel.app](https://platform-konsinyasi.vercel.app)
- **Repository:** [github.com/Soedirboy58/platform-konsinyasi](https://github.com/Soedirboy58/platform-konsinyasi)
- **Documentation:** [PANDUAN-LENGKAP.md](PANDUAN-LENGKAP.md)

## 📞 Support

- **Developer:** Katalara Team
- **Email:** support@katalara.com

## 📄 License

© 2024 Katalara. All rights reserved.

---

**📖 Untuk panduan lengkap step-by-step, baca [PANDUAN-LENGKAP.md](PANDUAN-LENGKAP.md)**
