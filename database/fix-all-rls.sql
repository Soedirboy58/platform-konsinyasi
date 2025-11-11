-- Complete RLS Fix - Run All At Once
-- This script fixes all RLS policies for the platform

-- ============================================
-- 1. FIX PRODUCTS TABLE
-- ============================================

DROP POLICY IF EXISTS "products_supplier_read_own" ON products;
DROP POLICY IF EXISTS "products_supplier_insert" ON products;
DROP POLICY IF EXISTS "products_supplier_update_own" ON products;
DROP POLICY IF EXISTS "products_admin_all" ON products;
DROP POLICY IF EXISTS "products_public_read_approved" ON products;

CREATE POLICY "products_supplier_read_own"
ON products FOR SELECT
TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "products_supplier_insert"
ON products FOR INSERT
TO authenticated
WITH CHECK (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

CREATE POLICY "products_supplier_update_own"
ON products FOR UPDATE
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

CREATE POLICY "products_admin_all"
ON products FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'ADMIN'
  )
);

CREATE POLICY "products_public_read_approved"
ON products FOR SELECT
TO public
USING (status = 'APPROVED');

-- ============================================
-- 2. FIX LOCATIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "locations_authenticated_read" ON locations;
DROP POLICY IF EXISTS "locations_admin_all" ON locations;
DROP POLICY IF EXISTS "locations_public_read" ON locations;

CREATE POLICY "locations_authenticated_read"
ON locations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "locations_public_read"
ON locations FOR SELECT
TO public
USING (is_active = TRUE);

CREATE POLICY "locations_admin_all"
ON locations FOR ALL
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

-- ============================================
-- 3. FIX SUPPLIERS TABLE
-- ============================================

DROP POLICY IF EXISTS "suppliers_read_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_admin_all" ON suppliers;

CREATE POLICY "suppliers_read_own"
ON suppliers FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "suppliers_insert_own"
ON suppliers FOR INSERT
TO authenticated
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "suppliers_update_own"
ON suppliers FOR UPDATE
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

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

-- ============================================
-- 4. FIX STORAGE (product-photos)
-- ============================================

DROP POLICY IF EXISTS "product_photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "product_photos_read" ON storage.objects;
DROP POLICY IF EXISTS "product_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "product_photos_delete" ON storage.objects;

CREATE POLICY "product_photos_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-photos');

CREATE POLICY "product_photos_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-photos');

CREATE POLICY "product_photos_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-photos')
WITH CHECK (bucket_id = 'product-photos');

CREATE POLICY "product_photos_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-photos');

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'RLS POLICIES FIXED SUCCESSFULLY!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed tables:';
  RAISE NOTICE '  - products (suppliers can CRUD own, admins all)';
  RAISE NOTICE '  - locations (all authenticated can read)';
  RAISE NOTICE '  - suppliers (suppliers can CRUD own, admins all)';
  RAISE NOTICE '  - storage.objects (authenticated can upload to product-photos)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Make sure bucket "product-photos" exists in Storage';
  RAISE NOTICE '  2. Set bucket to PUBLIC for read access';
  RAISE NOTICE '  3. Test supplier login and product creation';
  RAISE NOTICE '  4. Test admin approval workflow';
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
END $$;
