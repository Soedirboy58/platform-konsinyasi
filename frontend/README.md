# Platform Konsinyasi - Frontend

Next.js 14 application dengan 3 interface:
- **PWA Kantin Kejujuran** - Self-checkout untuk pelanggan
- **Supplier Portal** - Kelola produk & inventory
- **Admin Dashboard** - Manajemen platform

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── kantin/[slug]/     # PWA Kantin
│   │   ├── supplier/           # Supplier Portal
│   │   ├── admin/              # Admin Dashboard
│   │   └── auth/               # Authentication
│   ├── components/             # Reusable components
│   ├── lib/                    # Utilities & helpers
│   └── types/                  # TypeScript types
├── public/                     # Static assets
└── package.json
```

## 🌐 Routes

| Path | Description |
|------|-------------|
| `/` | Landing page dengan navigasi ke 3 aplikasi |
| `/kantin/[slug]` | PWA Kantin dengan slug = QR code lokasi |
| `/supplier` | Portal untuk supplier |
| `/admin` | Dashboard admin |

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase
- **Deployment**: Vercel
- **State**: Zustand
- **Forms**: React Hook Form
- **Icons**: Lucide React
- **Notifications**: Sonner

## 📦 Environment Variables

Sudah dikonfigurasi di `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `NEXT_PUBLIC_APP_URL` - App URL (localhost atau production)

## 🎨 Features

### PWA Kantin (`/kantin/[slug]`)
- ✅ Scan QR code lokasi
- ✅ Browse produk available
- ✅ Add to cart with stock validation
- ✅ Self-checkout
- ✅ Offline-capable (PWA)

### Supplier Portal (`/supplier`)
- 🚧 Login/Register
- 🚧 Product management
- 🚧 Inventory tracking
- 🚧 Sales reports
- 🚧 Payment history

### Admin Dashboard (`/admin`)
- 🚧 User management
- 🚧 Supplier approval
- 🚧 Product moderation
- 🚧 Platform analytics
- 🚧 System settings

## 🔄 Next Steps

1. Install dependencies: `npm install`
2. Run dev server: `npm run dev`
3. Open http://localhost:3000
4. Test PWA: http://localhost:3000/kantin/OUTLET_LOBBY_A

## 📝 Development Notes

- TypeScript errors normal sampai `npm install` dijalankan
- PWA Kantin sudah functional untuk demo
- Supplier & Admin pages coming soon
- Database functions sudah ready di backend
