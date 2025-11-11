-- ================================================
-- FIX: Remove Infinite Recursion in RLS Policies
-- ================================================
-- Problem: Policies use subquery that references the same table
-- Solution: Simplify policies to avoid recursion

-- ================================================
-- STEP 1: Drop ALL existing policies
-- ================================================

-- Profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
DROP POLICY IF EXISTS "profiles_user_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_user_update" ON profiles;

-- Suppliers
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete" ON suppliers;
DROP POLICY IF EXISTS "suppliers_admin_all" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_owner_read" ON suppliers;
DROP POLICY IF EXISTS "suppliers_owner_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_public_read_approved" ON suppliers;
DROP POLICY IF EXISTS "suppliers_read_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_user_insert" ON suppliers;

-- Drop policies by new names (prevent duplicate error)
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "suppliers_select_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_own" ON suppliers;

-- ================================================
-- STEP 2: Create SIMPLE non-recursive policies
-- ================================================

-- ============ PROFILES TABLE ============
-- Simple: Users can only access their own profile
-- No subqueries, no recursion

CREATE POLICY "profiles_select_own" ON profiles
FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============ SUPPLIERS TABLE ============
-- Simple: Suppliers can only access their own data
-- No subqueries, no recursion

CREATE POLICY "suppliers_select_own" ON suppliers
FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "suppliers_insert_own" ON suppliers
FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "suppliers_update_own" ON suppliers
FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- ================================================
-- STEP 3: Enable RLS
-- ================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- ================================================
-- STEP 4: Verify policies
-- ================================================

SELECT 
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'suppliers')
ORDER BY tablename, policyname;

-- ================================================
-- SUCCESS
-- ================================================
SELECT 'SUCCESS: Non-recursive policies created!' AS status;
