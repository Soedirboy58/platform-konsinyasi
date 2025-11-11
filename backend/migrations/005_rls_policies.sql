-- ========================================
-- MIGRATION 005: RLS Policies (Basic)
-- ========================================
-- Description: Row Level Security policies for all tables
-- Dependencies: All previous migrations (001-004)
-- Notes: Simple non-recursive policies, admin bypass in 006
-- Rollback: See bottom
-- ========================================

-- ================================================
-- ENABLE RLS ON ALL TABLES
-- ================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ================================================
-- DROP OLD POLICIES (Clean slate)
-- ================================================

-- Profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- Suppliers
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_select_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_own" ON suppliers;

-- Products
DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;

-- Stock Movements
DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_update" ON stock_movements;

-- ================================================
-- CREATE BASIC RLS POLICIES (Non-recursive)
-- ================================================

-- PROFILES: Users can read/update their own profile
CREATE POLICY "profiles_select_own" ON profiles
FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- SUPPLIERS: Suppliers can read/update their own data
CREATE POLICY "suppliers_select_own" ON suppliers
FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "suppliers_insert_own" ON suppliers
FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "suppliers_update_own" ON suppliers
FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- PRODUCTS: Suppliers can manage their own products
CREATE POLICY "products_select_own" ON products
FOR SELECT USING (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);

CREATE POLICY "products_insert_own" ON products
FOR INSERT WITH CHECK (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);

CREATE POLICY "products_update_own" ON products
FOR UPDATE USING (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);

-- STOCK MOVEMENTS: Suppliers can manage their own shipments
CREATE POLICY "stock_movements_select_own" ON stock_movements
FOR SELECT USING (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);

CREATE POLICY "stock_movements_insert_own" ON stock_movements
FOR INSERT WITH CHECK (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);

-- STOCK MOVEMENT ITEMS: Access through parent stock_movement
CREATE POLICY "stock_movement_items_select" ON stock_movement_items
FOR SELECT USING (
  movement_id IN (
    SELECT id FROM stock_movements 
    WHERE supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  )
);

CREATE POLICY "stock_movement_items_insert" ON stock_movement_items
FOR INSERT WITH CHECK (
  movement_id IN (
    SELECT id FROM stock_movements 
    WHERE supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  )
);

-- NOTIFICATIONS: Users can read their own notifications
CREATE POLICY "notifications_select_own" ON notifications
FOR SELECT USING (recipient_id = auth.uid());

-- WALLETS: Suppliers can read their own wallet
CREATE POLICY "supplier_wallets_select_own" ON supplier_wallets
FOR SELECT USING (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);

-- WALLET TRANSACTIONS: Suppliers can read their own transactions
CREATE POLICY "wallet_transactions_select_own" ON wallet_transactions
FOR SELECT USING (
  wallet_id IN (
    SELECT id FROM supplier_wallets 
    WHERE supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
  )
);

-- WITHDRAWAL REQUESTS: Suppliers can manage their own withdrawals
CREATE POLICY "withdrawal_requests_own" ON withdrawal_requests
FOR ALL USING (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);

-- SALES TRANSACTIONS: Suppliers can read their own sales
CREATE POLICY "sales_transactions_select_own" ON sales_transactions
FOR SELECT USING (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);

-- LOCATIONS: Public read for active locations
CREATE POLICY "locations_public_read" ON locations
FOR SELECT USING (is_active = true);

-- CATEGORIES: Public read
CREATE POLICY "categories_public_read" ON categories
FOR SELECT USING (true);

-- ================================================
-- SUCCESS
-- ================================================

SELECT 'Migration 005: RLS Policies (Basic) - SUCCESS!' AS status;
SELECT 'Note: Admin bypass policies will be added in Migration 006' AS note;

-- ================================================
-- ROLLBACK (if needed)
-- ================================================
-- Execute this to disable RLS and drop all policies:
/*
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels DISABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movement_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
*/
