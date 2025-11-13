-- ========================================
-- FIX RLS: ULTIMATE SOLUTION
-- Admin MUST be able to see ALL stock_movements
-- ========================================

-- STEP 1: Disable RLS temporarily to test (DEBUGGING ONLY)
-- ALTER TABLE stock_movements DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE stock_movement_items DISABLE ROW LEVEL SECURITY;

-- STEP 2: Drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on stock_movements
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'stock_movements') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON stock_movements';
    END LOOP;
    
    -- Drop all policies on stock_movement_items
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'stock_movement_items') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON stock_movement_items';
    END LOOP;
END $$;

-- STEP 3: Create SIMPLE and CLEAR policies

-- ============= STOCK_MOVEMENTS =============

-- Policy 1: Suppliers can SELECT their own movements
CREATE POLICY "suppliers_read_own_movements"
ON stock_movements
FOR SELECT
TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

-- Policy 2: Suppliers can INSERT their own movements  
CREATE POLICY "suppliers_create_movements"
ON stock_movements
FOR INSERT
TO authenticated
WITH CHECK (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

-- Policy 3: ADMIN can SELECT ALL movements
CREATE POLICY "admin_read_all_movements"
ON stock_movements
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'ADMIN'
  )
);

-- Policy 4: ADMIN can UPDATE movements (approve/reject)
CREATE POLICY "admin_update_movements"
ON stock_movements
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'ADMIN'
  )
);

-- ============= STOCK_MOVEMENT_ITEMS =============

-- Policy 5: Suppliers can SELECT items from their movements
CREATE POLICY "suppliers_read_own_items"
ON stock_movement_items
FOR SELECT
TO authenticated
USING (
  movement_id IN (
    SELECT id FROM stock_movements 
    WHERE supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
  )
);

-- Policy 6: Suppliers can INSERT items for their movements
CREATE POLICY "suppliers_create_items"
ON stock_movement_items
FOR INSERT
TO authenticated
WITH CHECK (
  movement_id IN (
    SELECT id FROM stock_movements 
    WHERE supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
  )
);

-- Policy 7: ADMIN can SELECT ALL items
CREATE POLICY "admin_read_all_items"
ON stock_movement_items
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'ADMIN'
  )
);

-- ========================================
-- VERIFY: Check policies created correctly
-- ========================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  substring(qual::text, 1, 100) as condition
FROM pg_policies
WHERE tablename IN ('stock_movements', 'stock_movement_items')
ORDER BY tablename, policyname;

-- ========================================
-- TEST: Verify admin can query (run as admin user)
-- ========================================

SELECT 
  sm.id,
  sm.status,
  s.business_name,
  l.name as location,
  sm.created_at
FROM stock_movements sm
LEFT JOIN suppliers s ON s.id = sm.supplier_id
LEFT JOIN locations l ON l.id = sm.location_id
WHERE sm.status = 'PENDING'
ORDER BY sm.created_at DESC;

-- Expected: Should return 3 PENDING shipments
-- 1. Snack A - 10 unit
-- 2. Roti - 20 unit
-- 3. Kue Basah - 10 unit

-- ========================================
-- CRITICAL: Make sure admin profile has correct role
-- ========================================

SELECT id, email, role 
FROM profiles 
WHERE email = 'aris.serdadu3g@gmail.com';

-- Expected: role = 'ADMIN'
-- If not, run: UPDATE profiles SET role = 'ADMIN' WHERE email = 'aris.serdadu3g@gmail.com';

-- ========================================
