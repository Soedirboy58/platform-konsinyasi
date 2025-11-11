-- ========================================
-- MIGRATION 006: Admin Access Policies
-- ========================================
-- Description: Admin bypass policies for all tables
-- Dependencies: 005_rls_policies.sql
-- Notes: Uses is_admin() helper function
-- Rollback: See bottom
-- ========================================

-- ================================================
-- STEP 1: Create helper function
-- ================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'ADMIN'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- STEP 2: Drop existing admin policies
-- ================================================

DROP POLICY IF EXISTS "profiles_admin_read" ON profiles;
DROP POLICY IF EXISTS "suppliers_admin_read" ON suppliers;
DROP POLICY IF EXISTS "suppliers_admin_update" ON suppliers;
DROP POLICY IF EXISTS "products_admin_all" ON products;
DROP POLICY IF EXISTS "stock_movements_admin_all" ON stock_movements;
DROP POLICY IF EXISTS "stock_movement_items_admin_all" ON stock_movement_items;
DROP POLICY IF EXISTS "notifications_admin_read" ON notifications;
DROP POLICY IF EXISTS "wallets_admin_all" ON supplier_wallets;
DROP POLICY IF EXISTS "transactions_admin_read" ON wallet_transactions;
DROP POLICY IF EXISTS "withdrawals_admin_all" ON withdrawal_requests;
DROP POLICY IF EXISTS "sales_admin_read" ON sales_transactions;

-- ================================================
-- STEP 3: Create admin bypass policies
-- ================================================

-- PROFILES: Admin can read all profiles
CREATE POLICY "profiles_admin_read" ON profiles
FOR SELECT USING (is_admin());

-- SUPPLIERS: Admin can read and update all suppliers
CREATE POLICY "suppliers_admin_read" ON suppliers
FOR SELECT USING (is_admin());

CREATE POLICY "suppliers_admin_update" ON suppliers
FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- PRODUCTS: Admin has full access
CREATE POLICY "products_admin_all" ON products
FOR ALL USING (is_admin());

-- STOCK MOVEMENTS: Admin has full access
CREATE POLICY "stock_movements_admin_all" ON stock_movements
FOR ALL USING (is_admin());

-- STOCK MOVEMENT ITEMS: Admin has full access
CREATE POLICY "stock_movement_items_admin_all" ON stock_movement_items
FOR ALL USING (is_admin());

-- NOTIFICATIONS: Admin can read all notifications
CREATE POLICY "notifications_admin_read" ON notifications
FOR SELECT USING (is_admin());

-- SUPPLIER WALLETS: Admin has full access
CREATE POLICY "wallets_admin_all" ON supplier_wallets
FOR ALL USING (is_admin());

-- WALLET TRANSACTIONS: Admin can read all transactions
CREATE POLICY "transactions_admin_read" ON wallet_transactions
FOR SELECT USING (is_admin());

-- WITHDRAWAL REQUESTS: Admin has full access
CREATE POLICY "withdrawals_admin_all" ON withdrawal_requests
FOR ALL USING (is_admin());

-- SALES TRANSACTIONS: Admin can read all sales
CREATE POLICY "sales_admin_read" ON sales_transactions
FOR SELECT USING (is_admin());

-- INVENTORY LEVELS: Admin has full access
CREATE POLICY "inventory_admin_all" ON inventory_levels
FOR ALL USING (is_admin());

-- LOCATIONS: Admin has full access
CREATE POLICY "locations_admin_all" ON locations
FOR ALL USING (is_admin());

-- CATEGORIES: Admin has full access
CREATE POLICY "categories_admin_all" ON categories
FOR ALL USING (is_admin());

-- ================================================
-- STEP 4: Verify policies
-- ================================================

SELECT 
    tablename,
    COUNT(*) AS policy_count,
    string_agg(policyname, ', ' ORDER BY policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%admin%'
GROUP BY tablename
ORDER BY tablename;

-- ================================================
-- SUCCESS
-- ================================================

SELECT 'Migration 006: Admin Access Policies - SUCCESS!' AS status;
SELECT 'Admin users now have bypass access to all tables' AS note;

-- ================================================
-- ROLLBACK (if needed)
-- ========================================
/*
DROP POLICY IF EXISTS "profiles_admin_read" ON profiles;
DROP POLICY IF EXISTS "suppliers_admin_read" ON suppliers;
DROP POLICY IF EXISTS "suppliers_admin_update" ON suppliers;
DROP POLICY IF EXISTS "products_admin_all" ON products;
DROP POLICY IF EXISTS "stock_movements_admin_all" ON stock_movements;
DROP POLICY IF EXISTS "stock_movement_items_admin_all" ON stock_movement_items;
DROP POLICY IF EXISTS "notifications_admin_read" ON notifications;
DROP POLICY IF EXISTS "wallets_admin_all" ON supplier_wallets;
DROP POLICY IF EXISTS "transactions_admin_read" ON wallet_transactions;
DROP POLICY IF EXISTS "withdrawals_admin_all" ON withdrawal_requests;
DROP POLICY IF EXISTS "sales_admin_read" ON sales_transactions;
DROP POLICY IF EXISTS "inventory_admin_all" ON inventory_levels;
DROP POLICY IF EXISTS "locations_admin_all" ON locations;
DROP POLICY IF EXISTS "categories_admin_all" ON categories;
DROP FUNCTION IF EXISTS is_admin();
*/
