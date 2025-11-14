-- =====================================================
-- FORCE FIX RLS - Drop All Policies & Recreate Clean
-- =====================================================
-- Jalankan ini untuk force clean all policies
-- =====================================================

-- Step 1: Get list of ALL policies on shipment_returns
SELECT 
    '📋 Current Policies' as info,
    policyname,
    cmd as operation
FROM pg_policies
WHERE tablename = 'shipment_returns'
ORDER BY policyname;

-- Step 2: DROP ALL POLICIES (comprehensive list)
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'shipment_returns'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON shipment_returns', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
    RAISE NOTICE '✅ All policies dropped';
END $$;

-- Step 3: Verify all policies deleted
SELECT 
    '🔍 Verify Policies Deleted' as check_name,
    COUNT(*) as remaining_policies
FROM pg_policies
WHERE tablename = 'shipment_returns';
-- Expected: 0

-- Step 4: Create NEW simplified policies
CREATE POLICY "admin_select_all"
ON shipment_returns
FOR SELECT
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "admin_insert_all"
ON shipment_returns
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "admin_update_all"
ON shipment_returns
FOR UPDATE
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
)
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "admin_delete_all"
ON shipment_returns
FOR DELETE
TO authenticated
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "supplier_select_own"
ON shipment_returns
FOR SELECT
TO authenticated
USING (
    supplier_id IN (
        SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "supplier_update_own"
ON shipment_returns
FOR UPDATE
TO authenticated
USING (
    supplier_id IN (
        SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
)
WITH CHECK (
    supplier_id IN (
        SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
);

-- Step 5: Verify NEW policies created
SELECT 
    '✅ New Policies Created' as status,
    COUNT(*) as total_policies
FROM pg_policies
WHERE tablename = 'shipment_returns';
-- Expected: 6

SELECT 
    policyname,
    cmd as operation
FROM pg_policies
WHERE tablename = 'shipment_returns'
ORDER BY policyname;

-- Step 6: Check current user role
SELECT 
    '👤 Current User Info' as info,
    auth.uid() as user_id,
    p.role,
    p.email,
    p.full_name
FROM profiles p
WHERE p.id = auth.uid();

-- Step 7: Test query (should return data now)
SELECT 
    '🧪 Test: Can Admin See Data?' as test,
    COUNT(*) as total_returns
FROM shipment_returns;

-- Step 8: Test with JOINs
SELECT 
    '🧪 Test: With JOINs' as test,
    sr.id,
    p.name as product,
    s.business_name as supplier,
    sr.quantity,
    sr.status
FROM shipment_returns sr
LEFT JOIN products p ON p.id = sr.product_id
LEFT JOIN suppliers s ON s.id = sr.supplier_id
LIMIT 3;

-- =====================================================
-- EXPECTED RESULTS
-- =====================================================
-- Step 2: Should show "Dropped policy: ..." for each
-- Step 3: remaining_policies = 0
-- Step 5: total_policies = 6
-- Step 6: role = 'ADMIN'
-- Step 7: total_returns = 8 (your data count)
-- Step 8: Should show 3 rows with product names
-- =====================================================
