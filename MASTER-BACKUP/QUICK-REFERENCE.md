# 🚀 QUICK REFERENCE - Platform Konsinyasi
## Panduan Cepat untuk Developer & Admin

---

## 📦 STRUKTUR BACKUP

```
MASTER-BACKUP/
├── README.md ← Panduan utama
├── README-MIGRATIONS.md ← Detail semua migrations
├── 01-CORE-SCHEMA/ ← Schema lengkap
├── 02-MIGRATIONS/ ← 17 migrations terurut
├── 03-PATCHES/ ← 6 patches/hotfixes
├── 04-FUNCTIONS/ ← 6 database functions
├── 05-RLS-POLICIES/ ← Security policies
├── 06-SEEDS/ ← Data awal
└── 07-DOCUMENTATION/ ← Docs lengkap
```

---

## ⚡ QUICK START

### 1. Setup Database Baru (10 menit)

```bash
# Clone repo
git clone https://github.com/Soedirboy58/platform-konsinyasi.git
cd platform-konsinyasi

# Jalankan schema lengkap
psql -h YOUR_SUPABASE_DB_HOST -U postgres -d postgres \
  -f MASTER-BACKUP/01-CORE-SCHEMA/complete-schema.sql

# Seed admin user
psql -h YOUR_SUPABASE_DB_HOST -U postgres -d postgres \
  -f MASTER-BACKUP/06-SEEDS/seed-admin-user.sql
```

### 2. Setup Frontend (5 menit)

```bash
cd frontend
npm install
cp .env.example .env.local

# Edit .env.local dengan Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=

npm run dev
# Open http://localhost:3000
```

### 3. Deploy Production (5 menit)

```bash
# Deploy ke Vercel
cd frontend
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## 📊 DATABASE CHEATSHEET

### Tables (17 total):
```
Auth & Users:
├── profiles
└── suppliers

Business:
├── locations (outlets)
├── products
└── inventory

Transactions:
├── stock_movements
├── sales_transactions
└── sales_transaction_items

Financial:
├── supplier_payments
├── commissions
├── payment_settings
└── wallet_transactions

Operations:
├── shipments
├── shipment_items
├── shipment_returns
└── notifications

Analytics:
└── customer_reports
```

### Quick Queries:

```sql
-- Total products
SELECT COUNT(*) FROM products WHERE is_approved = true;

-- Total sales today
SELECT SUM(total_amount) FROM sales_transactions 
WHERE DATE(created_at) = CURRENT_DATE;

-- Pending supplier payments
SELECT s.business_name, SUM(sp.amount) 
FROM supplier_payments sp
JOIN suppliers s ON sp.supplier_id = s.id
WHERE sp.status = 'PENDING'
GROUP BY s.business_name;

-- Low stock alerts
SELECT p.name, i.quantity, l.name as location
FROM inventory i
JOIN products p ON i.product_id = p.id
JOIN locations l ON i.location_id = l.id
WHERE i.quantity < 10;
```

---

## 🔐 SUPABASE CONFIGURATION

### URL Configuration:
```
Site URL: https://platform-konsinyasi.vercel.app

Redirect URLs:
- https://platform-konsinyasi.vercel.app/auth/callback
- https://platform-konsinyasi.vercel.app/supplier/login
- https://platform-konsinyasi.vercel.app/**
- http://localhost:3000/auth/callback
- http://localhost:3000/supplier/login
- http://localhost:3000/**
```

### Authentication:
```
Email confirmation: ENABLED
JWT expiry: 3600s
Refresh token rotation: ENABLED
```

### Storage Buckets:
```
product-images (public)
proof-photos (public with RLS)
```

---

## 🎯 COMMON TASKS

### Add New Migration:

1. Create file: `MASTER-BACKUP/02-MIGRATIONS/18-new-feature.sql`
2. Write SQL with:
   - CREATE TABLE
   - ADD COLUMN
   - CREATE INDEX
3. Add RLS policies
4. Test in staging
5. Document in README-MIGRATIONS.md
6. Apply to production

### Fix Production Issue:

1. Create patch: `MASTER-BACKUP/03-PATCHES/007-fix-something.sql`
2. Test in staging clone
3. Apply to production
4. Monitor logs
5. Document in change log

### Backup Current State:

```bash
# Export schema only
pg_dump -h db.xxx.supabase.co -U postgres -d postgres \
  --schema-only > schema-backup-$(date +%Y%m%d).sql

# Export with data
pg_dump -h db.xxx.supabase.co -U postgres -d postgres \
  > full-backup-$(date +%Y%m%d).sql
```

---

## 🔧 TROUBLESHOOTING

### "Permission denied" errors:
```sql
-- Check RLS policies
SELECT tablename, policyname FROM pg_policies 
WHERE tablename = 'your_table';

-- Temporarily disable RLS (testing only!)
ALTER TABLE your_table DISABLE ROW LEVEL SECURITY;
```

### Slow queries:
```sql
-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Add missing index
CREATE INDEX idx_table_column ON table_name(column_name);
```

### Foreign key violations:
```sql
-- Check orphaned records
SELECT * FROM child_table 
WHERE parent_id NOT IN (SELECT id FROM parent_table);

-- Fix foreign keys
-- See: MASTER-BACKUP/03-PATCHES/004-fix-foreign-keys.sql
```

---

## 📱 FRONTEND ROUTES

```
Public:
/                        → Landing page
/kantin/[slug]          → Self-checkout (customers)

Admin:
/admin                  → Dashboard
/admin/suppliers        → Supplier management
/admin/products         → Product catalog
/admin/analytics        → Analytics & insights
/admin/reports/*        → Various reports
/admin/payments/*       → Payment processing
/admin/settings         → Platform settings

Supplier:
/supplier               → Dashboard
/supplier/products      → Product management
/supplier/inventory     → Stock management
/supplier/shipments     → Delivery tracking
/supplier/wallet        → Financial overview
/supplier/settings      → Account settings
```

---

## 🎨 KEY FEATURES

✅ **Multi-role Authentication** (Admin, Supplier)  
✅ **Email Verification** dengan Katalara branding  
✅ **Product Management** dengan approval workflow  
✅ **Inventory Tracking** per location  
✅ **Self-Checkout** dengan QR code  
✅ **Payment Processing** dengan wallet system  
✅ **Commission Calculation** otomatis  
✅ **Returns Management** dengan proof photos  
✅ **Analytics Dashboard** dengan charts  
✅ **Reports** (sales, financial, customer)  
✅ **Notifications** real-time  
✅ **PWA Support** (install to home screen)  
✅ **Mobile Responsive**  

---

## 📞 CONTACTS

**Repository:** https://github.com/Soedirboy58/platform-konsinyasi  
**Production:** https://platform-konsinyasi.vercel.app  
**Documentation:** /MASTER-BACKUP/07-DOCUMENTATION/  

**For Support:**
- Technical issues → GitHub Issues
- Database questions → Check DATABASE-SCHEMA.md
- Emergency → Contact admin

---

## 🔄 UPDATE LOG

**Last Update:** 15 November 2024  
**Version:** 2.0.0  
**Status:** Production Ready

**Recent Changes:**
- ✅ PWA support
- ✅ Email verification 
- ✅ QR & Barcode outlets
- ✅ Mobile responsive
- ✅ Master backup archive

---

**© 2024 Katalara - Platform Konsinyasi**
