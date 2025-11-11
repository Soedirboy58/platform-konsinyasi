# Migration Execution Guide

## Overview

This guide helps you execute the 8 database migrations in the correct order. These migrations consolidate 40+ SQL files into a clean, professional structure ready for Supabase deployment.

## Prerequisites

- Supabase project created
- Access to Supabase SQL Editor or CLI
- Admin access to your project

## Migration Files

| File | Description | Estimated Time |
|------|-------------|----------------|
| `001_initial_schema.sql` | Core tables (profiles, suppliers, products, etc.) | 2 min |
| `002_wallet_system.sql` | Wallet tables and transactions | 1 min |
| `003_shipment_system.sql` | Stock movements and items | 1 min |
| `004_notification_system.sql` | Notifications and triggers | 2 min |
| `005_rls_policies.sql` | Row Level Security policies | 1 min |
| `006_admin_access.sql` | Admin bypass policies | 1 min |
| `007_functions.sql` | Business logic functions | 1 min |
| `008_schema_updates.sql` | Add missing columns | 1 min |

**Total Time: ~10 minutes**

## Execution Instructions

### Method 1: Supabase Dashboard (Recommended)

1. **Login to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Execute Migrations in Order**

   **Migration 001 - Initial Schema**
   ```bash
   # Copy content from backend/migrations/001_initial_schema.sql
   # Paste into SQL Editor
   # Click "Run" button
   # Wait for "SUCCESS!" message
   ```

   **Migration 002 - Wallet System**
   ```bash
   # Copy content from backend/migrations/002_wallet_system.sql
   # Paste into SQL Editor
   # Click "Run"
   # Verify wallet tables created
   ```

   **Migration 003 - Shipment System**
   ```bash
   # Copy content from backend/migrations/003_shipment_system.sql
   # Paste into SQL Editor
   # Click "Run"
   # Verify stock_movements tables created
   ```

   **Migration 004 - Notification System**
   ```bash
   # Copy content from backend/migrations/004_notification_system.sql
   # Paste into SQL Editor
   # Click "Run"
   # Verify notifications table and triggers created
   ```

   **Migration 005 - RLS Policies**
   ```bash
   # Copy content from backend/migrations/005_rls_policies.sql
   # Paste into SQL Editor
   # Click "Run"
   # Verify policies created (check verification query output)
   ```

   **Migration 006 - Admin Access**
   ```bash
   # Copy content from backend/migrations/006_admin_access.sql
   # Paste into SQL Editor
   # Click "Run"
   # Verify admin policies created
   ```

   **Migration 007 - Functions**
   ```bash
   # Copy content from backend/migrations/007_functions.sql
   # Paste into SQL Editor
   # Click "Run"
   # Verify functions created
   ```

   **Migration 008 - Schema Updates**
   ```bash
   # Copy content from backend/migrations/008_schema_updates.sql
   # Paste into SQL Editor
   # Click "Run"
   # Verify columns added to suppliers table
   ```

4. **Final Verification**
   ```sql
   -- Check all tables exist
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public'
   ORDER BY table_name;
   
   -- Check all functions exist
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public'
   ORDER BY routine_name;
   
   -- Check RLS policies
   SELECT tablename, COUNT(*) as policy_count
   FROM pg_policies 
   WHERE schemaname = 'public'
   GROUP BY tablename
   ORDER BY tablename;
   ```

### Method 2: Supabase CLI

```bash
# Navigate to project directory
cd c:\Users\user\Downloads\Platform\konsinyasi

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref <YOUR_PROJECT_REF>

# Run migrations in order
supabase db execute -f backend/migrations/001_initial_schema.sql
supabase db execute -f backend/migrations/002_wallet_system.sql
supabase db execute -f backend/migrations/003_shipment_system.sql
supabase db execute -f backend/migrations/004_notification_system.sql
supabase db execute -f backend/migrations/005_rls_policies.sql
supabase db execute -f backend/migrations/006_admin_access.sql
supabase db execute -f backend/migrations/007_functions.sql
supabase db execute -f backend/migrations/008_schema_updates.sql
```

## Migration Details

### 001 - Initial Schema

**What it does:**
- Creates core extensions (uuid-ossp, pgcrypto)
- Creates base tables: profiles, suppliers, products, locations, categories, inventory_levels
- Adds indexes for performance
- Creates initial timestamps

**Verification:**
```sql
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM suppliers;
SELECT COUNT(*) FROM products;
```

**Expected output:** Empty tables (0 rows) but tables exist

---

### 002 - Wallet System

**What it does:**
- Creates supplier_wallets table
- Creates wallet_transactions table
- Creates withdrawal_requests table
- Creates sales_transactions table
- Adds temporary RLS policies

**Verification:**
```sql
SELECT * FROM supplier_wallets;
SELECT * FROM wallet_transactions;
```

**Expected output:** Empty tables but structure exists

---

### 003 - Shipment System

**What it does:**
- Creates stock_movements table (shipment header)
- Creates stock_movement_items table (shipment details)
- Links to suppliers, locations, products

**Verification:**
```sql
SELECT * FROM stock_movements;
SELECT * FROM stock_movement_items;
```

**Expected output:** Empty tables

---

### 004 - Notification System

**What it does:**
- Creates notifications table
- Creates create_notification() function
- Adds triggers for auto-notify on:
  - Shipment approved
  - Shipment rejected
  - Product approved
  - Product rejected

**Verification:**
```sql
SELECT * FROM notifications;
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'create_notification';
```

**Expected output:** 
- Empty notifications table
- create_notification function exists

---

### 005 - RLS Policies

**What it does:**
- Creates is_admin() helper function
- Creates non-recursive RLS policies for:
  - Profiles (users see own profile)
  - Suppliers (suppliers see own data)
  - Products (suppliers see own products)
  - Inventory (location-based access)
  - Locations (authenticated read)

**Verification:**
```sql
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename;
```

**Expected output:** 
- profiles: 1 policy
- suppliers: 1 policy
- products: 1 policy
- inventory_levels: 1 policy
- locations: 1 policy

---

### 006 - Admin Access

**What it does:**
- Adds admin bypass policies using is_admin()
- Admin can read/update all tables
- Admin full access to:
  - All profiles
  - All suppliers
  - All products
  - All stock movements
  - All notifications
  - All wallet data

**Verification:**
```sql
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public' AND policyname LIKE '%admin%'
GROUP BY tablename;
```

**Expected output:** All tables have admin policies

---

### 007 - Functions

**What it does:**
- Creates approve_stock_movement() function
- Creates reject_stock_movement() function
- Creates get_supplier_wallet_balance() function
- Creates update_updated_at_column() function
- Adds triggers for auto-updating timestamps

**Verification:**
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

**Expected output:** 
- approve_stock_movement
- reject_stock_movement
- get_supplier_wallet_balance
- update_updated_at_column
- create_notification
- is_admin

---

### 008 - Schema Updates

**What it does:**
- Adds contact_person column to suppliers
- Adds phone_number column to suppliers
- Adds address column to suppliers

**Verification:**
```sql
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'suppliers' 
  AND column_name IN ('contact_person', 'phone_number', 'address');
```

**Expected output:** 3 rows (all columns exist)

---

## Troubleshooting

### Error: "relation already exists"

**Cause:** Migration already executed or table exists from old schema

**Solution:**
```sql
-- Check which tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- If old schema exists, backup then drop:
-- WARNING: This deletes all data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Then re-run migrations from 001
```

### Error: "function already exists"

**Cause:** Function from previous migration

**Solution:**
```sql
-- Drop existing function
DROP FUNCTION IF EXISTS function_name;

-- Re-run migration
```

### Error: "policy already exists"

**Cause:** Policy from previous run

**Solution:**
```sql
-- Drop existing policy
DROP POLICY IF EXISTS "policy_name" ON table_name;

-- Re-run migration
```

### Error: "permission denied"

**Cause:** Not logged in as admin or service role

**Solution:**
- Ensure you're using Supabase Dashboard (runs as service role)
- Or use Supabase CLI with admin credentials

### Error: "infinite recursion detected"

**Cause:** Recursive RLS policy

**Solution:**
- Check migration 005 for recursive policies
- Ensure policies only use auth.uid(), not subqueries referencing same table
- Use is_admin() function instead of inline checks

## Rollback Procedure

Each migration file includes rollback SQL at the bottom. To rollback:

1. **Find rollback section** in migration file
2. **Uncomment rollback SQL**
3. **Execute in SQL Editor**
4. **Verify cleanup**

Example rollback for migration 008:
```sql
ALTER TABLE suppliers DROP COLUMN IF EXISTS contact_person;
ALTER TABLE suppliers DROP COLUMN IF EXISTS phone_number;
ALTER TABLE suppliers DROP COLUMN IF EXISTS address;
```

**⚠️ Warning:** Rollback may delete data. Backup before rolling back!

## Post-Migration Tasks

After all migrations complete:

1. **Create Admin User**
   ```sql
   -- Insert admin profile (replace UUID with your auth.users ID)
   INSERT INTO profiles (id, email, full_name, role)
   VALUES ('YOUR_AUTH_USER_ID', 'admin@example.com', 'Admin User', 'ADMIN');
   ```

2. **Test RLS Policies**
   - Login as admin → Should see all data
   - Login as supplier → Should see only own data
   - Login as customer → Should see public data only

3. **Verify Triggers Work**
   ```sql
   -- Create test supplier
   -- Create test product
   -- Update product status to 'APPROVED'
   -- Check notifications table for auto-notification
   ```

4. **Update .env File**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_KEY
   ```

## Success Criteria

✅ All 8 migrations executed without errors  
✅ All tables exist (15+ tables)  
✅ All functions exist (6+ functions)  
✅ RLS policies active (20+ policies)  
✅ Triggers working (4+ triggers)  
✅ Admin can access all data  
✅ Suppliers can access own data only  
✅ Frontend connects successfully  

## Support

If you encounter issues:

1. Check Supabase logs (Dashboard → Logs)
2. Review migration verification queries
3. Check RLS policy status
4. Test with service_role key temporarily

## Next Steps

After migrations complete:

1. ✅ Run seed data (optional): `backend/seeds/`
2. ✅ Run tests: `backend/tests/`
3. ✅ Deploy frontend to Vercel
4. ✅ Proceed to self-checkout feature implementation

---

**Migration Guide Version:** 1.0  
**Last Updated:** January 2025  
**Total Migrations:** 8  
**Estimated Completion:** 10 minutes
