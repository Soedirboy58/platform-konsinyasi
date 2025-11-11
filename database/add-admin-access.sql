-- ================================================
-- FIX: Admin Access to All Data
-- ================================================
-- Problem: Admin cannot read supplier data or products
-- Solution: Add admin bypass policies using service role or function

-- ================================================
-- STEP 1: Create helper function to check if user is admin
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
-- STEP 2: Drop existing admin policies (prevent duplicate errors)
-- ================================================

DROP POLICY IF EXISTS "profiles_admin_read" ON profiles;
DROP POLICY IF EXISTS "suppliers_admin_read" ON suppliers;
DROP POLICY IF EXISTS "suppliers_admin_update" ON suppliers;
DROP POLICY IF EXISTS "products_admin_all" ON products;
DROP POLICY IF EXISTS "stock_movements_admin_all" ON stock_movements;
DROP POLICY IF EXISTS "stock_movement_items_admin_all" ON stock_movement_items;

-- ================================================
-- STEP 3: Add admin access policies
-- ================================================

-- PROFILES: Add admin read access
CREATE POLICY "profiles_admin_read" ON profiles
FOR SELECT USING (is_admin());

-- SUPPLIERS: Add admin full access  
CREATE POLICY "suppliers_admin_read" ON suppliers
FOR SELECT USING (is_admin());

CREATE POLICY "suppliers_admin_update" ON suppliers
FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- PRODUCTS: Add admin full access
CREATE POLICY "products_admin_all" ON products
FOR ALL USING (is_admin());

-- STOCK_MOVEMENTS: Add admin full access
CREATE POLICY "stock_movements_admin_all" ON stock_movements
FOR ALL USING (is_admin());

-- STOCK_MOVEMENT_ITEMS: Add admin full access
CREATE POLICY "stock_movement_items_admin_all" ON stock_movement_items
FOR ALL USING (is_admin());

-- ================================================
-- STEP 4: Verify all policies
-- ================================================

SELECT 
    tablename,
    COUNT(*) AS policy_count,
    string_agg(policyname, ', ' ORDER BY policyname) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'suppliers', 'products', 'stock_movements', 'stock_movement_items')
GROUP BY tablename
ORDER BY tablename;

-- ================================================
-- SUCCESS
-- ================================================
SELECT 'SUCCESS: Admin access policies added!' AS status;
