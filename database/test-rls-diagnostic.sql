-- DIAGNOSTIC: Check RLS Policies & Data
-- Run this to check if RLS is properly configured and if data exists

-- ============================================
-- 1. CHECK EXISTING RLS POLICIES
-- ============================================

-- Check products policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'products'
ORDER BY policyname;

-- Check locations policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'locations'
ORDER BY policyname;

-- Check suppliers policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'suppliers'
ORDER BY policyname;

-- ============================================
-- 2. CHECK DATA EXISTS
-- ============================================

-- Check locations (must have at least 1)
SELECT 
  id, 
  name, 
  type, 
  is_active,
  created_at
FROM locations
ORDER BY created_at DESC;

-- Check products count by status
SELECT 
  status,
  COUNT(*) as total
FROM products
GROUP BY status;

-- Check suppliers count by status
SELECT 
  status,
  COUNT(*) as total
FROM suppliers
GROUP BY status;

-- ============================================
-- 3. CHECK YOUR CURRENT USER
-- ============================================

-- Your current user ID
SELECT auth.uid() as current_user_id;

-- Your profile
SELECT id, email, role, created_at
FROM profiles
WHERE id = auth.uid();

-- Your supplier record (if exists)
SELECT id, business_name, status, created_at
FROM suppliers
WHERE profile_id = auth.uid();

-- ============================================
-- 4. TEST QUERIES (as current user)
-- ============================================

-- All counts in one table (easier to read)
SELECT 
  'products' as table_name,
  COUNT(*) as readable_count
FROM products
UNION ALL
SELECT 
  'locations' as table_name,
  COUNT(*) as readable_count
FROM locations
UNION ALL
SELECT 
  'suppliers' as table_name,
  COUNT(*) as readable_count
FROM suppliers;

-- ============================================
-- EXPECTED RESULTS:
-- ============================================
-- 1. Policies should exist (5+ policies per table)
-- 2. Locations should have at least 1 row
-- 3. Products might be 0 if no one added yet
-- 4. Current user should have profile with role
-- 5. Counts should not return 0 (unless table is empty)
