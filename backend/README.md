# Backend Directory

This directory contains all backend-related files including database migrations, seed data, test queries, and utility scripts.

## Directory Structure

```
backend/
├── migrations/          # Database migrations (execute in order)
│   ├── 001_initial_schema.sql
│   ├── 002_wallet_system.sql
│   ├── 003_shipment_system.sql
│   ├── 004_notification_system.sql
│   ├── 005_rls_policies.sql
│   ├── 006_admin_access.sql
│   ├── 007_functions.sql
│   └── 008_schema_updates.sql
├── seeds/              # Sample data for development
├── tests/              # Diagnostic and test queries
├── queries/            # Business logic queries
├── archive/            # Old/deprecated files
├── MIGRATION-GUIDE.md  # Complete migration execution guide
└── README.md          # This file
```

## Migrations

The `migrations/` folder contains 8 SQL files that must be executed in numerical order. These files consolidate the entire database schema from 40+ scattered files into a clean, professional structure.

### Migration Files

| File | Purpose | Lines | Time |
|------|---------|-------|------|
| **001_initial_schema.sql** | Core tables (profiles, suppliers, products, locations, categories, inventory) | ~180 | 2 min |
| **002_wallet_system.sql** | Wallet tables (wallets, transactions, withdrawals, sales) | ~130 | 1 min |
| **003_shipment_system.sql** | Stock movements and items | ~80 | 1 min |
| **004_notification_system.sql** | Notifications table and triggers | ~120 | 2 min |
| **005_rls_policies.sql** | Row Level Security policies | ~100 | 1 min |
| **006_admin_access.sql** | Admin bypass policies | ~150 | 1 min |
| **007_functions.sql** | Business logic functions | ~150 | 1 min |
| **008_schema_updates.sql** | Add missing columns | ~60 | 1 min |

**Total:** ~970 lines, ~10 minutes execution time

### How to Execute Migrations

See [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) for complete instructions.

**Quick start:**
1. Open Supabase SQL Editor
2. Copy content from each migration file (001 → 008)
3. Paste and run in order
4. Verify success message after each

### Migration Dependencies

```
001 (Core Schema)
 ├── 002 (Wallet System)
 ├── 003 (Shipment System)
 │    └── 004 (Notifications)
 │         └── 005 (RLS Policies)
 │              └── 006 (Admin Access)
 │                   └── 007 (Functions)
 │                        └── 008 (Schema Updates)
```

## Seeds (Development Data)

The `seeds/` folder will contain SQL scripts to populate tables with sample data for development and testing.

**Planned seed files:**
- `seed_admin.sql` - Create admin user
- `seed_suppliers.sql` - Sample suppliers (5-10)
- `seed_products.sql` - Sample products (20-30)
- `seed_locations.sql` - Sample locations (3-5)
- `seed_inventory.sql` - Sample stock levels

**Usage:**
```bash
# Execute after migrations complete
# Run in Supabase SQL Editor or via CLI
```

## Tests (Diagnostic Queries)

The `tests/` folder will contain diagnostic queries to verify system health and troubleshoot issues.

**Planned test files:**
- `test_rls_policies.sql` - Verify RLS working correctly
- `test_notifications.sql` - Test notification triggers
- `test_wallet_functions.sql` - Test wallet calculations
- `test_shipment_approval.sql` - Test shipment workflow
- `test_admin_access.sql` - Verify admin can access all data

**Usage:**
```sql
-- Copy queries from test files
-- Run in SQL Editor to verify functionality
-- Check output matches expected results
```

## Queries (Business Logic)

The `queries/` folder will contain reusable SQL queries for common business operations.

**Planned query files:**
- `analytics_dashboard.sql` - Admin dashboard stats
- `supplier_revenue.sql` - Calculate supplier earnings
- `inventory_status.sql` - Current stock levels
- `pending_shipments.sql` - Shipments awaiting approval
- `withdrawal_processing.sql` - Process withdrawal requests

**Usage:**
```sql
-- Use these queries in API endpoints
-- Or run manually for reports
```

## Archive (Old Files)

The `archive/` folder will contain old SQL files from the `/database` folder after reorganization is complete. These files are kept for reference but should not be used in production.

**To be moved to archive:**
- All `fix-*.sql` files
- All `setup-*.sql` files
- All `cleanup-*.sql` files
- Old `test-*.sql` files
- Deprecated migration files

## Database Schema Overview

### Core Tables (001_initial_schema.sql)

**Profiles**
- User authentication and role management
- Fields: id, email, full_name, role (ADMIN|SUPPLIER|BUYER)

**Suppliers**
- Business information for suppliers
- Fields: id, profile_id, business_name, bank_account_name, commission_rate

**Products**
- Product catalog
- Fields: id, supplier_id, name, description, price, barcode, status

**Locations**
- Physical outlets/warehouses
- Fields: id, name, address, qr_code

**Categories**
- Product categorization
- Fields: id, name, description

**Inventory Levels**
- Stock tracking per location
- Fields: id, product_id, location_id, quantity

### Wallet System (002_wallet_system.sql)

**Supplier Wallets**
- Balance tracking for each supplier
- Fields: available_balance, pending_balance, total_earned

**Wallet Transactions**
- Transaction log (deposits, withdrawals, adjustments)

**Withdrawal Requests**
- Cash-out requests from suppliers
- Fields: amount, status (PENDING|APPROVED|REJECTED)

**Sales Transactions**
- Revenue records from product sales
- Fields: quantity, selling_price, commission_amount

### Shipment System (003_shipment_system.sql)

**Stock Movements**
- Shipment header (IN/OUT movements)
- Fields: supplier_id, location_id, movement_type, status

**Stock Movement Items**
- Shipment details (which products, quantities)
- Fields: movement_id, product_id, quantity

### Notification System (004_notification_system.sql)

**Notifications**
- User notifications
- Fields: user_id, title, message, type, is_read

**Triggers:**
- Auto-notify on shipment approval/rejection
- Auto-notify on product approval/rejection

## RLS Policies

### Basic Policies (005_rls_policies.sql)

**Pattern:** Users can only see their own data

- **Profiles:** User sees own profile (`id = auth.uid()`)
- **Suppliers:** Supplier sees own data (`profile_id = auth.uid()`)
- **Products:** Supplier sees own products
- **Inventory:** Location-based access
- **Locations:** Everyone can read

### Admin Bypass (006_admin_access.sql)

**Pattern:** Admin can access all data

- Uses `is_admin()` helper function
- Admin has full access to all tables
- Bypasses restrictive policies from 005

## Database Functions

### Shipment Functions (007_functions.sql)

**approve_stock_movement(movement_id, admin_id)**
- Approves pending shipment
- Updates inventory levels
- Admin-only

**reject_stock_movement(movement_id, admin_id, reason)**
- Rejects pending shipment
- Records rejection reason
- Admin-only

### Wallet Functions (007_functions.sql)

**get_supplier_wallet_balance(supplier_id)**
- Returns wallet balances
- Available, pending, total earned, withdrawn

### Utility Functions (007_functions.sql)

**update_updated_at_column()**
- Auto-updates updated_at on row changes
- Used by triggers

## Adding New Migrations

When you need to add schema changes:

1. **Create new migration file**
   ```
   backend/migrations/009_new_feature.sql
   ```

2. **Use this template:**
   ```sql
   -- ========================================
   -- MIGRATION 009: Feature Name
   -- ========================================
   -- Description: What this migration does
   -- Dependencies: Previous migrations required
   -- ========================================
   
   -- Your SQL here
   
   -- Verification query
   SELECT 'Migration 009: SUCCESS!' AS status;
   
   -- Rollback (if needed)
   /* 
   -- Rollback SQL here
   */
   ```

3. **Test locally first**
   - Run in local Supabase instance
   - Verify no errors
   - Test rollback works

4. **Execute in production**
   - Follow MIGRATION-GUIDE.md process
   - Backup database first
   - Run during low-traffic time

## Development Workflow

### Setting Up Local Environment

1. **Install Supabase CLI**
   ```powershell
   npm install -g supabase
   ```

2. **Initialize Local Supabase**
   ```powershell
   supabase init
   supabase start
   ```

3. **Run Migrations**
   ```powershell
   supabase db execute -f backend/migrations/001_initial_schema.sql
   # Continue for all migrations...
   ```

4. **Load Seed Data** (when available)
   ```powershell
   supabase db execute -f backend/seeds/seed_admin.sql
   # Continue for all seeds...
   ```

### Making Schema Changes

1. Create new migration file (next number in sequence)
2. Test in local Supabase
3. Verify rollback works
4. Commit to git
5. Deploy to production

### Testing

1. Run diagnostic queries from `tests/` folder
2. Verify RLS policies work correctly
3. Test as different user roles (admin, supplier, customer)
4. Check triggers fire correctly

## Production Deployment

### Prerequisites

- Supabase project created
- Admin credentials available
- Database backed up

### Deployment Steps

1. **Backup Current Database**
   ```sql
   -- In Supabase Dashboard → Database → Backups
   -- Create manual backup
   ```

2. **Execute Migrations**
   - Follow [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md)
   - Execute 001 → 008 in order
   - Verify each migration success

3. **Load Production Data** (if needed)
   ```sql
   -- Run seed files or import data
   ```

4. **Verify Deployment**
   - Run test queries
   - Test frontend connection
   - Verify RLS policies working

5. **Monitor**
   - Check Supabase logs
   - Watch for errors
   - Test all user flows

## Troubleshooting

### Common Issues

**"relation already exists"**
- Migration already executed
- Check with: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`

**"function already exists"**
- Function from previous run
- Drop and re-run: `DROP FUNCTION IF EXISTS function_name;`

**"permission denied"**
- Not using service role
- Use Supabase Dashboard (runs as service role)

**"infinite recursion detected"**
- Recursive RLS policy
- Check migration 005, ensure non-recursive policies

See [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) for detailed troubleshooting.

## Maintenance

### Regular Tasks

**Weekly:**
- Check database size
- Review slow queries
- Monitor RLS policy performance

**Monthly:**
- Optimize indexes
- Clean up old notifications
- Archive old transactions

**As Needed:**
- Add new migrations for schema changes
- Update seed data
- Refactor complex queries

## Best Practices

1. **Always backup before migrations**
2. **Test migrations locally first**
3. **Execute migrations in order** (never skip)
4. **Include rollback SQL** in every migration
5. **Document dependencies** in migration headers
6. **Use verification queries** to confirm success
7. **Keep migrations small** (one feature per file)
8. **Never modify old migrations** (create new ones instead)

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [RLS Policy Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Migration Guide](./MIGRATION-GUIDE.md)

## Support

For issues or questions:
1. Check [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) troubleshooting section
2. Review Supabase Dashboard logs
3. Check PostgreSQL documentation
4. Test queries in SQL Editor

---

**Last Updated:** January 2025  
**Database Schema Version:** 1.0  
**Total Migrations:** 8  
**Status:** ✅ Production Ready
