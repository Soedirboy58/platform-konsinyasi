-- ================================================
-- CLEANUP: Remove ALL Redundant Policies
-- ================================================
-- This will clean up from 17 policies to just 8 policies

-- Drop ALL suppliers policies (11 policies)
DROP POLICY IF EXISTS "suppliers_admin_all" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_owner_read" ON suppliers;
DROP POLICY IF EXISTS "suppliers_owner_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_public_read_approved" ON suppliers;
DROP POLICY IF EXISTS "suppliers_read_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_user_insert" ON suppliers;

-- Drop ALL profiles policies (6 policies)
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_user_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_user_update" ON profiles;

-- ================================================
-- CREATE: Simple and Clean Policies (Only 8 Total)
-- ================================================

-- ============ SUPPLIERS TABLE (4 policies) ============

-- 1. SELECT: Suppliers can read their own, Admins can read all
CREATE POLICY "suppliers_select" ON suppliers
FOR SELECT USING (
    profile_id = auth.uid() 
    OR 
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

-- 2. INSERT: Only during registration (by owner)
CREATE POLICY "suppliers_insert" ON suppliers
FOR INSERT WITH CHECK (
    profile_id = auth.uid()
);

-- 3. UPDATE: Suppliers can update their own, Admins can update all
CREATE POLICY "suppliers_update" ON suppliers
FOR UPDATE USING (
    profile_id = auth.uid()
    OR 
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
)
WITH CHECK (
    profile_id = auth.uid()
    OR 
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

-- 4. DELETE: Only admins (for future use)
CREATE POLICY "suppliers_delete" ON suppliers
FOR DELETE USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

-- ============ PROFILES TABLE (4 policies) ============

-- 1. SELECT: Users can read their own, Admins can read all
CREATE POLICY "profiles_select" ON profiles
FOR SELECT USING (
    id = auth.uid() 
    OR 
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

-- 2. INSERT: Only during registration
CREATE POLICY "profiles_insert" ON profiles
FOR INSERT WITH CHECK (
    id = auth.uid()
);

-- 3. UPDATE: Users can update their own profile
CREATE POLICY "profiles_update" ON profiles
FOR UPDATE USING (
    id = auth.uid()
)
WITH CHECK (
    id = auth.uid()
);

-- 4. DELETE: Only admins (for future use)
CREATE POLICY "profiles_delete" ON profiles
FOR DELETE USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

-- ================================================
-- VERIFY: Show final policies count
-- ================================================
SELECT 
    tablename,
    COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('suppliers', 'profiles')
GROUP BY tablename
ORDER BY tablename;

-- Show policy details
SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('suppliers', 'profiles')
ORDER BY tablename, cmd, policyname;

-- ================================================
-- SUCCESS
-- ================================================
SELECT 'SUCCESS: Cleaned up from 17 to 8 policies! (4 per table: SELECT, INSERT, UPDATE, DELETE)' AS status;
