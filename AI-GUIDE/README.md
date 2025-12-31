# 🤖 AI AGENT GUIDE - Platform Konsinyasi

> **Panduan lengkap untuk AI Agent dalam membangun dan maintain Platform Konsinyasi**  
> **Last Updated:** 2 Desember 2025  
> **Version:** 1.0

---

## 📋 TABLE OF CONTENTS

1. [Platform Overview](#platform-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Key Features](#key-features)
6. [Development Guidelines](#development-guidelines)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)
9. [Future Plans](#future-plans)

---

## 🎯 PLATFORM OVERVIEW

### **Nama Platform:** Platform Konsinyasi  
### **Tujuan:** Sistem manajemen konsinyasi multi-toko untuk supplier dan admin

### **Core Concept:**
Platform marketplace B2B dimana:
- **Supplier** menitipkan produk ke berbagai toko (lokasi)
- **Admin** mengelola toko, transaksi, dan inventory
- **Customer** berbelanja via self-checkout (QR code)
- **System** otomatis hitung komisi dan pembayaran supplier

### **Business Model:**
```
Supplier → Kirim Produk → Toko (Location) → Customer Beli → Platform Fee (10%)
                              ↓
                        Stock Management
                              ↓
                        Sales Transaction
                              ↓
                    Platform: 10% | Supplier: 90%
```

---

## 🛠️ TECH STACK

### **Frontend:**
- **Framework:** Next.js 14.0.4 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **UI Components:** Custom components + Lucide Icons
- **State Management:** React Hooks (useState, useEffect)
- **Forms:** Native HTML5 + client-side validation
- **Notifications:** Sonner (toast)
- **PWA:** next-pwa (Progressive Web App support)

### **Backend:**
- **Database:** PostgreSQL (via Supabase)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (untuk gambar produk, QRIS)
- **API:** Supabase RPC Functions + Edge Functions
- **Security:** Row Level Security (RLS)

### **DevOps:**
- **Hosting:** Vercel (frontend)
- **Database Hosting:** Supabase Cloud
- **Version Control:** Git + GitHub
- **Deployment:** Auto-deploy on push to main branch

### **Repository:**
- GitHub: `Soedirboy58/platform-konsinyasi`
- Branch: `main` (production)

---

## 🏗️ ARCHITECTURE

### **System Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  Next.js 14 App Router + TypeScript + Tailwind CSS         │
├─────────────────────────────────────────────────────────────┤
│  /admin        │  /supplier       │  /kantin/[slug]        │
│  (Admin Panel) │  (Supplier Panel)│  (Self-Checkout)       │
└─────────────────────────────────────────────────────────────┘
                            ↕
                   Supabase Client SDK
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE BACKEND                         │
├─────────────────────────────────────────────────────────────┤
│  Authentication  │  PostgreSQL DB   │  Storage             │
│  (Email/Password)│  (RLS Enabled)   │  (Images)            │
├─────────────────────────────────────────────────────────────┤
│  RPC Functions   │  Edge Functions  │  Realtime (future)   │
└─────────────────────────────────────────────────────────────┘
```

### **Folder Structure:**

```
konsinyasi/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/           # Admin panel routes
│   │   │   ├── supplier/        # Supplier panel routes
│   │   │   ├── kantin/[slug]/   # Self-checkout routes
│   │   │   └── auth/            # Auth callbacks
│   │   ├── components/          # Reusable components
│   │   │   └── ui/              # UI components
│   │   └── lib/
│   │       └── supabase/        # Supabase client
│   ├── public/                  # Static assets
│   └── package.json
├── database/                    # SQL scripts & migrations
├── docs/                        # Documentation
├── AI-GUIDE/                    # Guide untuk AI Agent (THIS FOLDER)
├── backend/                     # RPC functions & queries
└── README.md
```

---

## 🗄️ DATABASE SCHEMA

### **Core Tables:**

#### **1. profiles** (User Management)
```sql
- id: UUID (PK, references auth.users)
- email: TEXT
- full_name: TEXT
- role: TEXT ('ADMIN', 'SUPPLIER', 'SUPER_ADMIN', 'LOCATION_ADMIN')
- created_at: TIMESTAMPTZ
- assigned_location_id: UUID (for LOCATION_ADMIN) -- PLANNED
```

#### **2. suppliers** (Supplier Master Data)
```sql
- id: UUID (PK)
- profile_id: UUID (FK → profiles)
- business_name: TEXT
- phone: TEXT
- address: TEXT
- bank_name: TEXT
- bank_account_number: TEXT
- status: TEXT ('PENDING', 'APPROVED', 'REJECTED')
- created_at: TIMESTAMPTZ
```

#### **3. locations** (Toko/Kantin)
```sql
- id: UUID (PK)
- name: TEXT
- address: TEXT
- qr_code: TEXT (unique, untuk self-checkout)
- qris_code: TEXT (payment)
- qris_image_url: TEXT
- is_active: BOOLEAN
- admin_user_id: UUID (FK → profiles) -- PLANNED
- created_at: TIMESTAMPTZ
```

#### **4. products** (Produk dari Supplier)
```sql
- id: UUID (PK)
- supplier_id: UUID (FK → suppliers)
- name: TEXT
- description: TEXT
- price: DECIMAL(15,2)
- image_url: TEXT
- category: TEXT
- status: TEXT ('PENDING', 'APPROVED', 'REJECTED')
- is_active: BOOLEAN
- created_at: TIMESTAMPTZ
```

#### **5. inventory_levels** (Stock per Lokasi)
```sql
- id: UUID (PK)
- product_id: UUID (FK → products)
- location_id: UUID (FK → locations)
- quantity: INTEGER (CHECK >= 0)
- reserved_quantity: INTEGER
- updated_at: TIMESTAMPTZ
```

#### **6. stock_movements** (Riwayat Pergerakan Stock)
```sql
- id: UUID (PK)
- supplier_id: UUID (FK → suppliers)
- location_id: UUID (FK → locations)
- movement_type: TEXT ('IN', 'OUT', 'RETURN', 'ADJUSTMENT')
- status: TEXT ('PENDING', 'APPROVED', 'COMPLETED')
- notes: TEXT
- created_at: TIMESTAMPTZ
- reviewed_at: TIMESTAMPTZ
```

#### **7. stock_movement_items** (Detail Item per Movement)
```sql
- id: UUID (PK)
- movement_id: UUID (FK → stock_movements)
- product_id: UUID (FK → products)
- quantity: INTEGER
- created_at: TIMESTAMPTZ
```

#### **8. sales_transactions** (Transaksi Penjualan)
```sql
- id: UUID (PK)
- location_id: UUID (FK → locations)
- transaction_code: TEXT (unique)
- customer_name: TEXT
- total_amount: DECIMAL(15,2)
- payment_method: TEXT ('CASH', 'QRIS', 'PENDING')
- status: TEXT ('PENDING', 'PAID', 'CANCELLED')
- created_at: TIMESTAMPTZ
```

#### **9. sales_transaction_items** (Detail Item per Transaksi)
```sql
- id: UUID (PK)
- transaction_id: UUID (FK → sales_transactions)
- product_id: UUID (FK → products)
- quantity: INTEGER
- price: DECIMAL(15,2)
- subtotal: DECIMAL(15,2)
- commission_amount: DECIMAL(15,2) -- 10% platform fee
- supplier_revenue: DECIMAL(15,2)  -- 90% untuk supplier
```

#### **10. supplier_wallets** (Saldo Supplier)
```sql
- id: UUID (PK)
- supplier_id: UUID (FK → suppliers)
- pending_balance: DECIMAL(15,2)   -- Belum dicairkan
- available_balance: DECIMAL(15,2) -- Bisa dicairkan
- total_earned: DECIMAL(15,2)      -- Total earning all time
- updated_at: TIMESTAMPTZ
```

#### **11. wallet_transactions** (Riwayat Transaksi Wallet)
```sql
- id: UUID (PK)
- wallet_id: UUID (FK → supplier_wallets)
- transaction_type: TEXT ('SALE', 'WITHDRAWAL', 'REFUND')
- amount: DECIMAL(15,2)
- balance_before: DECIMAL(15,2)
- balance_after: DECIMAL(15,2)
- description: TEXT
- reference_id: UUID
- reference_type: TEXT
- created_at: TIMESTAMPTZ
```

#### **12. shipment_returns** (Retur Produk Rusak)
```sql
- id: UUID (PK)
- supplier_id: UUID (FK → suppliers)
- product_id: UUID (FK → products)
- location_id: UUID (FK → locations)
- quantity: INTEGER
- reason: TEXT
- status: TEXT ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')
- requested_by: UUID (FK → profiles, admin)
- reviewed_by: UUID (FK → profiles, supplier)
- reviewed_at: TIMESTAMPTZ
- review_notes: TEXT
- created_at: TIMESTAMPTZ
```

### **Key Relationships:**

```
suppliers (1) ──< (N) products
products (1) ──< (N) inventory_levels (N) >── (1) locations
suppliers (1) ──< (N) stock_movements (N) >── (1) locations
locations (1) ──< (N) sales_transactions
sales_transactions (1) ──< (N) sales_transaction_items (N) >── (1) products
suppliers (1) ──── (1) supplier_wallets
supplier_wallets (1) ──< (N) wallet_transactions
```

---

## ✨ KEY FEATURES

### **1. Multi-Role System**

**Current Roles:**
- `ADMIN`: Full access ke admin panel
- `SUPPLIER`: Access ke supplier panel
- `LOCATION_ADMIN`: (PLANNED) Manage 1 specific toko

**Authentication Flow:**
```typescript
Login → Check profile.role → Redirect:
  - ADMIN → /admin/dashboard
  - SUPPLIER → /supplier/dashboard
  - LOCATION_ADMIN → /admin/dashboard (filtered to their location)
```

### **2. Supplier Management**

**Workflow:**
1. Supplier register via `/supplier/onboarding`
2. Admin review di `/admin/suppliers`
3. Admin approve/reject
4. Supplier bisa upload produk
5. Admin approve produk
6. Produk muncul di inventory

**Key Pages:**
- `/admin/suppliers` - List & approve suppliers
- `/supplier/products` - Supplier manage produk
- `/admin/suppliers/products` - Admin review produk

### **3. Inventory Management**

**Stock Movement Types:**
- `IN`: Supplier kirim barang ke toko (shipment)
- `OUT`: Produk terjual
- `RETURN`: Retur barang rusak
- `ADJUSTMENT`: Koreksi stock

**Key Features:**
- Real-time stock tracking per location
- Reserved stock (saat checkout pending)
- Stock alerts (low stock warning)
- Movement history with approval workflow

### **4. Self-Checkout System**

**Flow:**
1. Customer scan QR code toko → `/kantin/{qr_code}`
2. Browse produk, add to cart
3. Checkout → Generate transaction (status PENDING)
4. Show QRIS payment
5. Customer confirm payment
6. Transaction status → PAID
7. Stock auto-reduce, wallet auto-update

**Key Functions:**
- `process_anonymous_checkout()` - Create transaction
- `confirm_payment_with_method()` - Confirm payment & reduce stock

### **5. Commission System**

**Split Revenue:**
- Platform: 10% dari setiap transaksi
- Supplier: 90% masuk ke wallet

**Wallet Flow:**
```
Sale → pending_balance (menunggu konfirmasi)
     → available_balance (bisa ditarik)
     → Withdrawal request → Admin approve → Transfer
```

### **6. Return Management**

**Workflow:**
1. Admin buat return request (produk rusak/kadaluarsa)
2. Supplier review & approve/reject
3. Supplier ambil barang
4. Wallet supplier dikurangi sesuai nilai retur

**Key Functions:**
- Admin: Create return request
- Supplier: Approve/reject/confirm pickup
- Auto-deduct from supplier wallet on approval

---

## 💻 DEVELOPMENT GUIDELINES

### **Coding Standards:**

1. **TypeScript Strict Mode**
   ```typescript
   // ✅ Always type your variables
   const product: Product = { ... }
   
   // ❌ Avoid 'any'
   const data: any = await fetch()
   ```

2. **Component Structure**
   ```typescript
   'use client' // If using hooks or client features
   
   import { useState } from 'react'
   import { Component } from 'lucide-react'
   
   interface Props {
     // Define props
   }
   
   export default function MyComponent({ prop }: Props) {
     // Component logic
   }
   ```

3. **Database Queries**
   ```typescript
   // ✅ Always check for errors
   const { data, error } = await supabase
     .from('table')
     .select('*')
   
   if (error) {
     console.error(error)
     return // Handle error
   }
   
   // ❌ Don't ignore errors
   const { data } = await supabase.from('table').select('*')
   ```

4. **RLS Policies**
   ```sql
   -- Always use RLS for security
   ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "policy_name"
   ON table_name FOR SELECT
   TO authenticated
   USING (
     -- Logic here
   );
   ```

### **File Naming:**
- Components: `PascalCase.tsx` (e.g., `ProductCard.tsx`)
- Pages: `page.tsx` (Next.js App Router)
- Utils: `camelCase.ts` (e.g., `formatCurrency.ts`)
- SQL: `kebab-case.sql` (e.g., `create-admin-user.sql`)

### **Git Workflow:**

```bash
# Feature development
git checkout -b feature/feature-name
# ... make changes
git add .
git commit -m "feat: description"
git push origin feature/feature-name

# Hotfix
git checkout -b hotfix/issue-description
# ... fix
git commit -m "fix: description"
git push origin hotfix/issue-description

# Deploy to production
git checkout main
git merge feature/feature-name
git push origin main  # Auto-deploy via Vercel
```

**Commit Message Convention:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Tests
- `chore:` Maintenance

---

## 🔍 COMMON PATTERNS

### **Pattern 1: Data Fetching with Loading State**

```typescript
const [data, setData] = useState<Type[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  async function loadData() {
    try {
      const supabase = createClient()
      const { data: result, error } = await supabase
        .from('table')
        .select('*')
      
      if (error) throw error
      setData(result || [])
    } catch (error) {
      console.error(error)
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }
  
  loadData()
}, [])
```

### **Pattern 2: Role-Based Access Control**

```typescript
// In page component
const { data: { user } } = await supabase.auth.getUser()
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single()

if (profile?.role !== 'ADMIN') {
  redirect('/unauthorized')
}
```

### **Pattern 3: RPC Function Call**

```typescript
const { data, error } = await supabase.rpc('function_name', {
  p_param1: value1,
  p_param2: value2
})

if (error) {
  console.error('RPC Error:', error)
  toast.error(error.message)
  return
}

toast.success('Success!')
```

### **Pattern 4: File Upload to Storage**

```typescript
const file = event.target.files[0]
const fileExt = file.name.split('.').pop()
const fileName = `${Math.random()}.${fileExt}`
const filePath = `products/${fileName}`

const { error: uploadError } = await supabase.storage
  .from('products')
  .upload(filePath, file)

if (uploadError) throw uploadError

const { data: { publicUrl } } = supabase.storage
  .from('products')
  .getPublicUrl(filePath)

// Save publicUrl to database
```

---

## 🐛 TROUBLESHOOTING

### **Common Issues:**

#### **1. "movement_type = 'SHIPMENT' returns no data"**
**Cause:** Database uses `'IN'` not `'SHIPMENT'`  
**Fix:** Change all queries from `eq('movement_type', 'SHIPMENT')` to `eq('movement_type', 'IN')`

#### **2. "RPC function returns 400 Bad Request"**
**Cause:** Missing function in database or wrong parameters  
**Debug:**
```sql
-- Check if function exists
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'function_name';

-- Check function definition
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'function_name';
```

#### **3. "Supplier not found" error in RPC**
**Cause:** Function uses `auth.uid()` but no user logged in (SQL Editor)  
**Note:** `auth.uid()` only works with authenticated requests from frontend, not in SQL Editor

#### **4. "record 'new' has no field 'field_name'"**
**Cause:** Trigger/function referencing non-existent column  
**Fix:** Update trigger function to use correct column names

#### **5. Checkout fails with inventory constraint error**
**Cause:** Double submission on page refresh  
**Fix:** Implement idempotency check with sessionStorage

---

## 📈 PERFORMANCE BEST PRACTICES

1. **Index Foreign Keys**
   ```sql
   CREATE INDEX idx_table_foreign_key ON table(foreign_key_column);
   ```

2. **Limit Query Results**
   ```typescript
   .select('*')
   .order('created_at', { ascending: false })
   .limit(50)  // Don't fetch all data
   ```

3. **Use Specific Selects**
   ```typescript
   // ✅ Good
   .select('id, name, price')
   
   // ❌ Avoid when possible
   .select('*')
   ```

4. **Batch Operations**
   ```typescript
   // ✅ Good - single query
   await supabase.from('table').insert(items)  // Array
   
   // ❌ Bad - multiple queries
   for (const item of items) {
     await supabase.from('table').insert(item)
   }
   ```

---

## 🎯 FUTURE PLANS

### **Planned Features** (see `/AI-GUIDE/FUTURE-PLANS/`)

1. **Location Admin System**
   - Status: 📋 Planning
   - File: `LOCATION-ADMIN-IMPLEMENTATION-PLAN.md`
   - Timeline: 2-3 days
   - Priority: Medium

2. **Multi-tenancy Enhancement**
   - Granular permissions per location
   - Admin performance dashboard
   - Activity logging

3. **Supplier Enhancements**
   - Product analytics for suppliers
   - Automated inventory alerts
   - Bulk product upload

4. **Customer Features**
   - Order history tracking
   - Loyalty points
   - Digital receipts

---

## 📞 SUPPORT & CONTACTS

**Repository:** https://github.com/Soedirboy58/platform-konsinyasi  
**Database:** Supabase Cloud (konsinyasi project)  
**Deployment:** Vercel (platform-konsinyasi-v1.vercel.app)

---

## 🔐 SECURITY NOTES

### **Critical Security Rules:**

1. ✅ **ALWAYS use RLS** for sensitive tables
2. ✅ **NEVER expose API keys** in frontend code
3. ✅ **ALWAYS validate user input** (both frontend & backend)
4. ✅ **Use SECURITY DEFINER** carefully in RPC functions
5. ✅ **Check user role** before sensitive operations
6. ✅ **Sanitize SQL** in dynamic queries
7. ✅ **Use parameterized queries** to prevent SQL injection

### **Example Secure RPC Function:**

```sql
CREATE OR REPLACE FUNCTION secure_function(p_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- 1. Check authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- 2. Get user role
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid();
  
  -- 3. Check permissions
  IF v_user_role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  
  -- 4. Perform action
  -- ...
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

**Document Version:** 1.0  
**Created:** 2 Desember 2025  
**For:** AI Agent Development Assistant  
**Status:** ✅ Active Reference Document
