-- ================================================
-- DIAGNOSTIC: Check Current RLS Status
-- ================================================

-- Check if RLS is enabled
SELECT 
    schemaname, 
    tablename, 
    rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('suppliers', 'profiles')
ORDER BY tablename;

-- Check existing policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('suppliers', 'profiles')
ORDER BY tablename, policyname;

-- ================================================
-- Test UPDATE permission for current user
-- ================================================

-- This will show if current user can update suppliers table
SELECT 
    current_user AS current_database_user,
    auth.uid() AS current_auth_user,
    EXISTS (
        SELECT 1 FROM suppliers 
        WHERE profile_id = auth.uid()
    ) AS has_supplier_record;
