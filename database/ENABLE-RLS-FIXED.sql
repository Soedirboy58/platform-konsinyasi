-- ================================================
-- RE-ENABLE RLS WITH FIXED POLICIES
-- ================================================
-- This script re-enables RLS on shipment_returns table
-- with simplified, working policies for admin and supplier access
-- Run this after testing with RLS disabled confirmed the issue
-- ================================================

-- Step 1: Re-enable RLS on shipment_returns
ALTER TABLE shipment_returns ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies (clean slate)
DROP POLICY IF EXISTS "Admin can view all returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can create returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can update returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier can view their returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier can update their returns" ON shipment_returns;

-- Step 3: Create simplified admin policies
-- Admin can view all return requests
CREATE POLICY "Admin full access - SELECT"
ON shipment_returns FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Admin can insert new return requests
CREATE POLICY "Admin full access - INSERT"
ON shipment_returns FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Admin can update return requests
CREATE POLICY "Admin full access - UPDATE"
ON shipment_returns FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Step 4: Create simplified supplier policies
-- Supplier can view returns for their products
CREATE POLICY "Supplier view their returns"
ON shipment_returns FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM products p
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = shipment_returns.product_id
    AND s.profile_id = auth.uid()
  )
);

-- Supplier can update their return requests (for approval/rejection)
CREATE POLICY "Supplier update their returns"
ON shipment_returns FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM products p
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = shipment_returns.product_id
    AND s.profile_id = auth.uid()
  )
);

-- ================================================
-- VERIFICATION QUERIES
-- ================================================

-- Check RLS status
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'shipment_returns';

-- List all policies
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
WHERE tablename = 'shipment_returns'
ORDER BY policyname;

-- ================================================
-- TESTING QUERIES (Run as authenticated user)
-- ================================================

-- Test 1: Admin should see all returns
-- SELECT COUNT(*) as total_returns FROM shipment_returns;

-- Test 2: Supplier should see only their products' returns
-- SELECT 
--   sr.*,
--   p.name as product_name,
--   s.business_name
-- FROM shipment_returns sr
-- JOIN products p ON p.id = sr.product_id
-- JOIN suppliers s ON s.id = p.supplier_id;

-- ================================================
-- NOTES
-- ================================================
-- ✅ RLS re-enabled after testing confirmed data exists
-- ✅ Simplified policies without complex subqueries
-- ✅ Admin has full access (SELECT, INSERT, UPDATE)
-- ✅ Supplier can view/update only their products' returns
-- ✅ Policies use EXISTS with JOINs for better performance
-- 
-- If frontend still shows empty:
-- 1. Check browser console for Supabase errors
-- 2. Verify auth.uid() matches profile in profiles table
-- 3. Check user role is 'ADMIN' or supplier profile_id matches
-- 4. Test queries directly in Supabase SQL Editor while logged in
-- ================================================
