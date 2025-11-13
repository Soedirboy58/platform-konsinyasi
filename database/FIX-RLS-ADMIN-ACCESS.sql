-- =====================================================
-- FIX RLS POLICIES - ENSURE ADMIN ACCESS
-- =====================================================
-- Problem: RLS enabled dengan 10 policies, mungkin blocking admin
-- Solution: Simplify policies, ensure admin can access all
-- =====================================================

-- Step 1: Check current user (untuk debugging)
SELECT 
    '👤 Current User' as info,
    auth.uid() as user_id,
    p.email,
    p.role,
    p.full_name
FROM profiles p
WHERE p.id = auth.uid();

-- Step 2: Drop all existing policies (clean slate)
DROP POLICY IF EXISTS "Admin full access - SELECT" ON shipment_returns;
DROP POLICY IF EXISTS "Admin full access - INSERT" ON shipment_returns;
DROP POLICY IF EXISTS "Admin full access - UPDATE" ON shipment_returns;
DROP POLICY IF EXISTS "Admin full access - DELETE" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can view all returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can create returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can update all returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can delete returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can update pending returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier can view own returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier can update own returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier can review own returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier view their returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier update their returns" ON shipment_returns;

-- Step 3: Create SIMPLE admin policies (no complex subqueries)
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

-- Step 4: Create supplier policies (can view/update their products' returns)
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

-- Step 5: Verify policies created
SELECT 
    '✅ Policies Updated' as status;

SELECT 
    policyname as policy,
    cmd as operation,
    CASE 
        WHEN policyname LIKE 'admin%' THEN '👨‍💼 Admin'
        WHEN policyname LIKE 'supplier%' THEN '🏪 Supplier'
        ELSE '❓ Other'
    END as user_type
FROM pg_policies
WHERE tablename = 'shipment_returns'
ORDER BY user_type, cmd;

-- Step 6: Test query as admin (should work now)
SELECT 
    '🧪 Test Query - Admin View' as test,
    COUNT(*) as total_returns,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
    COUNT(*) FILTER (WHERE status = 'APPROVED') as approved
FROM shipment_returns;

-- Step 7: Test with JOINs (like frontend)
SELECT 
    '🧪 Test Query - With JOINs' as test,
    sr.id,
    p.name as product,
    s.business_name as supplier,
    l.name as location,
    sr.quantity,
    sr.status
FROM shipment_returns sr
LEFT JOIN products p ON p.id = sr.product_id
LEFT JOIN suppliers s ON s.id = sr.supplier_id
LEFT JOIN locations l ON l.id = sr.location_id
ORDER BY sr.requested_at DESC
LIMIT 3;

-- =====================================================
-- EXPECTED RESULTS
-- =====================================================
-- ✅ All old policies dropped (clean slate)
-- ✅ 6 new policies created (4 admin + 2 supplier)
-- ✅ Test queries return data (not empty due to RLS)
-- ✅ Admin can see ALL returns
-- ✅ Supplier can see ONLY their returns
-- =====================================================

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================
-- IF test queries return 0 rows:
--   1. Check auth.uid() returns your user ID
--   2. Check your role in profiles table = 'ADMIN'
--   3. Try query without RLS: SET row_security = off;
--
-- IF still issues after running this:
--   Run: ALTER TABLE shipment_returns DISABLE ROW LEVEL SECURITY;
--   Then frontend should work while we debug policies
-- =====================================================
