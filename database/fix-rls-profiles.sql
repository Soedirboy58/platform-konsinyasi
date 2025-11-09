-- ============================================
-- FIX INFINITE RECURSION IN PROFILES RLS
-- ============================================
-- Run this script in Supabase SQL Editor to fix the infinite recursion error

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;
DROP POLICY IF EXISTS "Public can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Drop helper functions that cause recursion
DROP FUNCTION IF EXISTS auth.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
DROP FUNCTION IF EXISTS auth.is_supplier() CASCADE;
DROP FUNCTION IF EXISTS auth.get_supplier_id() CASCADE;

-- Create NEW simple policies WITHOUT recursive functions
-- Allow anyone to view profiles (needed for registration)
CREATE POLICY "profiles_public_read" ON profiles
    FOR SELECT TO public
    USING (true);

-- Allow users to insert their own profile during registration
CREATE POLICY "profiles_user_insert" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "profiles_user_update" ON profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Profiles RLS policies fixed!';
  RAISE NOTICE '📋 New policies:';
  RAISE NOTICE '   - profiles_public_read: Anyone can view profiles';
  RAISE NOTICE '   - profiles_user_insert: Users can insert own profile';
  RAISE NOTICE '   - profiles_user_update: Users can update own profile';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Registration should work now!';
END $$;
