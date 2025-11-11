-- ================================================
-- FIX: Supplier Settings UPDATE RLS Policy
-- ================================================

-- Drop existing policies
DROP POLICY IF EXISTS "suppliers_select" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert" ON suppliers;

-- Allow suppliers to SELECT their own data
CREATE POLICY "suppliers_select" ON suppliers
FOR SELECT USING (
    profile_id = auth.uid() 
    OR 
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

-- Allow suppliers to UPDATE their own data
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

-- Allow INSERT for new suppliers (during registration)
CREATE POLICY "suppliers_insert" ON suppliers
FOR INSERT WITH CHECK (
    profile_id = auth.uid()
    OR 
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

-- ================================================
-- FIX: Profiles UPDATE RLS Policy
-- ================================================

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;

-- Allow users to SELECT their own profile or admins to SELECT all
CREATE POLICY "profiles_select" ON profiles
FOR SELECT USING (
    id = auth.uid() 
    OR 
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

-- Allow users to UPDATE their own profile
CREATE POLICY "profiles_update" ON profiles
FOR UPDATE USING (
    id = auth.uid()
)
WITH CHECK (
    id = auth.uid()
);

-- Allow INSERT for new users
CREATE POLICY "profiles_insert" ON profiles
FOR INSERT WITH CHECK (
    id = auth.uid()
);

-- ================================================
-- SUCCESS
-- ================================================
SELECT 'SUCCESS: Supplier and Profile RLS policies fixed!' AS status;
