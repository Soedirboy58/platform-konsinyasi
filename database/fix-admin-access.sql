-- Fix Admin Access to All Tables
-- Ensure admin can read all profiles and products

-- ============================================
-- FIX PROFILES TABLE - Admin can see all profiles
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- Admin can do everything
CREATE POLICY "profiles_admin_all"
ON profiles FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
  )
);

-- Users can read their own profile
CREATE POLICY "profiles_read_own"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ============================================
-- FIX PRODUCTS TABLE - Admin can see all products
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "products_admin_all" ON products;
DROP POLICY IF EXISTS "products_supplier_read" ON products;
DROP POLICY IF EXISTS "products_supplier_insert" ON products;
DROP POLICY IF EXISTS "products_supplier_update" ON products;
DROP POLICY IF EXISTS "products_public_read_approved" ON products;

-- Admin can do everything
CREATE POLICY "products_admin_all"
ON products FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Supplier can read their own products
CREATE POLICY "products_supplier_read"
ON products FOR SELECT
TO authenticated
USING (
  supplier_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'SUPPLIER'
  )
);

-- Supplier can insert their own products
CREATE POLICY "products_supplier_insert"
ON products FOR INSERT
TO authenticated
WITH CHECK (
  supplier_id = auth.uid()
);

-- Supplier can update their own products
CREATE POLICY "products_supplier_update"
ON products FOR UPDATE
TO authenticated
USING (supplier_id = auth.uid())
WITH CHECK (supplier_id = auth.uid());

-- Public can read approved products
CREATE POLICY "products_public_read_approved"
ON products FOR SELECT
TO public
USING (status = 'APPROVED');

-- ============================================
-- FIX SUPPLIERS TABLE - Admin can see all suppliers
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "suppliers_admin_all" ON suppliers;
DROP POLICY IF EXISTS "suppliers_read_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_own" ON suppliers;

-- Admin can do everything
CREATE POLICY "suppliers_admin_all"
ON suppliers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Supplier can read their own record
CREATE POLICY "suppliers_read_own"
ON suppliers FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

-- Supplier can update their own record
CREATE POLICY "suppliers_update_own"
ON suppliers FOR UPDATE
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- ============================================
-- VERIFY
-- ============================================

-- Check if policies are created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('profiles', 'products', 'suppliers')
ORDER BY tablename, policyname;
