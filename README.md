# Platform Konsinyasi Terintegrasi v2.0

Platform digital untuk mengelola sistem konsinyasi dengan dua model bisnis terintegrasi:
1. **Kantin Kejujuran (PWA)** - Self-checkout system untuk outlet fisik
2. **Pre-Order E-commerce** - Online ordering platform (coming soon)

## 🚀 Tech Stack

### Backend
- **Database:** Supabase PostgreSQL (15 tables with RLS)
- **Authentication:** Supabase Auth (Email + Role-based)
- **Edge Functions:** Deno runtime (daily-stock-check, notification-dispatcher)
- **Scheduled Jobs:** pg_cron (automated stock checks at 8 AM)
- **Storage:** Supabase Storage (product photos, proofs)

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React hooks (local state)
- **UI Components:** Lucide React icons, Sonner toasts

### Deployment
- **Frontend:** Vercel (serverless)
- **Backend:** Supabase Cloud
- **Edge Functions:** Deno Deploy (via Supabase)

## 📦 Project Structure

```
konsinyasi/
├── database/
│   ├── schema.sql              # 15 tables: profiles, suppliers, products, etc.
│   ├── functions.sql           # Triggers & notification functions
│   ├── rls-policies.sql        # Row Level Security for all tables
│   ├── business-queries.sql    # PWA queries & payment calculations
│   ├── sample-data.sql         # Test data
│   ├── cron-setup.sql          # Automated job configuration
│   └── cron-setup-simple.sql   # Simplified cron (recommended)
├── supabase/
│   └── functions/
│       ├── daily-stock-check/  # Check low stock & expiring products
│       └── notification-dispatcher/  # Send email notifications
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx                    # Landing page
│       │   ├── kantin/[slug]/              # PWA Kantin (shopping cart)
│       │   ├── admin/                      # Admin dashboard (6 pages)
│       │   │   ├── page.tsx                #   - Dashboard
│       │   │   ├── login/page.tsx          #   - Login
│       │   │   ├── suppliers/page.tsx      #   - Supplier approval
│       │   │   ├── products/page.tsx       #   - Product moderation
│       │   │   ├── locations/page.tsx      #   - Location management
│       │   │   └── reports/page.tsx        #   - Sales reports
│       │   └── supplier/                   # Supplier portal (5 pages)
│       │       ├── page.tsx                #   - Dashboard
│       │       ├── login/page.tsx          #   - Auth (login/register)
│       │       ├── products/               #   - Product CRUD
│       │       └── inventory/page.tsx      #   - Stock adjustment
│       ├── lib/
│       │   └── supabase/
│       │       ├── client.ts               # Client-side helper
│       │       └── server.ts               # Server-side helper
│       └── types/
│           └── supabase.ts                 # TypeScript types
├── docs/
│   ├── frontend-architecture.md   # Frontend design decisions
│   └── storage-setup.md           # Storage bucket configuration
├── README.md                      # This file
└── SETUP.md                       # Complete setup guide
```

## ✨ Key Features

### For Admin
- ✅ Approve/reject supplier registrations
- ✅ Moderate product submissions
- ✅ Manage locations (outlets & warehouses)
- ✅ View sales reports & analytics
- ✅ Top 10 products by sales
- ✅ Export data to CSV
- ✅ CRUD operations for locations (QR codes)

### For Suppliers
- ✅ Register & wait for approval
- ✅ Add products (name, price, commission, barcode, expiry)
- ✅ Request inventory adjustments (INCOMING/OUTGOING/CORRECTION)
- ✅ View product status (PENDING/APPROVED/REJECTED)
- ✅ Dashboard with stats (total products, pending approvals, low stock)
- 🔜 Upload product photos
- 🔜 View sales reports

### For Customers (Kantin PWA)
- ✅ Scan QR code to access specific outlet
- ✅ Browse available products
- ✅ Add to cart with stock validation
- ✅ Checkout (self-service)
- 🔜 Payment integration
- 🔜 Offline support (PWA)

### Automated Systems
- ✅ Daily stock check (8 AM via cron)
- ✅ Low stock notifications (< 10 items)
- ✅ Expiry warnings (3 days before expiry)
- ✅ Database triggers for real-time notifications
- 🔜 Email notifications (Resend API)

## 🎯 User Roles

| Role | Access |
|------|--------|
| **ADMIN** | Full access to all features, approval workflows |
| **SUPPLIER** | Product management, inventory adjustments |
| **CUSTOMER** | Browse products, checkout (PWA only) |

## 📊 Database Schema (15 Tables)

1. **profiles** - User info & roles
2. **suppliers** - Supplier business details
3. **locations** - Outlets & warehouses (QR codes)
4. **products** - Product catalog
5. **inventory_levels** - Current stock per location
6. **inventory_adjustments** - Stock change requests
7. **sales_transactions** - PWA checkout records
8. **sales_transaction_items** - Line items
9. **orders** - Pre-order transactions
10. **order_items** - Order line items
11. **shipping_addresses** - Customer addresses
12. **notifications** - In-app notifications
13. **supplier_payments** - Payment tracking
14. **activity_logs** - Audit trail

## 🚦 Status Workflows

### Supplier Status
- `PENDING` → Admin reviews → `APPROVED` / `REJECTED`
- Approved suppliers can add products

### Product Status
- `PENDING` → Admin moderates → `APPROVED` / `REJECTED`
- Only approved products appear in PWA

### Inventory Adjustment Status
- `PENDING` → Admin reviews → `APPROVED` / `REJECTED`
- Approved adjustments update inventory_levels automatically (via trigger)

## 🔐 Security (RLS)

All tables have Row Level Security policies:
- **Suppliers** can only see/edit their own data
- **Customers** can only read approved products
- **Admins** have full access
- **Storage buckets** have separate policies (public/private)

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+
- Supabase account
- Vercel account (optional)

### Quick Start

1. **Clone repository**
   ```bash
   cd konsinyasi
   ```

2. **Setup database**
   - Create Supabase project
   - Run SQL files in order (see [SETUP.md](SETUP.md))

3. **Deploy Edge Functions**
   ```bash
   supabase login
   supabase link --project-ref rpzoacwlswlhfqaiicho
   supabase functions deploy daily-stock-check
   ```

4. **Setup frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local  # Add your Supabase keys
   npm run dev
   ```

5. **Create admin user**
   - Register via app
   - Run SQL: `UPDATE profiles SET role = 'ADMIN' WHERE email = 'your@email.com'`

See **[SETUP.md](SETUP.md)** for detailed instructions.

## 📖 Documentation

- **[SETUP.md](SETUP.md)** - Complete setup guide (database, Edge Functions, deployment)
- **[docs/frontend-architecture.md](docs/frontend-architecture.md)** - Frontend design decisions
- **[docs/storage-setup.md](docs/storage-setup.md)** - Storage bucket configuration & policies

## 🧪 Testing

### Test PWA Kantin
1. Create sample location: `/admin/locations`
2. Add sample products: `/supplier/products/new`
3. Admin approves: `/admin/products`
4. Visit PWA: `/kantin/outlet_lobby_a`

### Test Edge Function
```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_ANON_KEY"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "https://rpzoacwlswlhfqaiicho.supabase.co/functions/v1/daily-stock-check" -Method POST -Headers $headers
```

## 🚀 Deployment

### Frontend (Vercel)
```bash
vercel --prod
```

### Edge Functions (Supabase)
```bash
supabase functions deploy daily-stock-check
supabase functions deploy notification-dispatcher
```

## 📈 Roadmap

### Phase 1: Core Platform ✅
- [x] Database schema (15 tables)
- [x] RLS policies
- [x] Edge Functions deployed
- [x] Admin dashboard (6 pages)
- [x] Supplier portal (5 pages)
- [x] PWA Kantin

### Phase 2: Enhancement 🚧
- [ ] Storage buckets setup
- [ ] Product photo uploads
- [ ] Email notifications (Resend)
- [ ] PWA manifest & service worker
- [ ] Inventory adjustment approval page (admin)

### Phase 3: Pre-Order System 🔜
- [ ] Customer registration
- [ ] Product catalog with search
- [ ] Shopping cart
- [ ] Checkout & payment
- [ ] Order tracking

### Phase 4: Advanced Features 🔮
- [ ] Analytics dashboard
- [ ] Commission calculation automation
- [ ] Payment integration (Midtrans)
- [ ] Real-time inventory updates
- [ ] Mobile app (React Native)

## 📄 License

Proprietary - All rights reserved

---

**Built with ❤️ using Next.js & Supabase**