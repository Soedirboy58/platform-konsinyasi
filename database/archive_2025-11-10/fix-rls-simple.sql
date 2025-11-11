-- SIMPLE RLS FIX - Very Permissive (Development Only)
-- This allows ALL authenticated users to access everything
-- Use this if the complex policies are causing issues

-- ============================================
-- 1. PRODUCTS - Allow all authenticated
-- ============================================

DROP POLICY IF EXISTS "products_supplier_read_own" ON products;
DROP POLICY IF EXISTS "products_supplier_insert" ON products;
DROP POLICY IF EXISTS "products_supplier_update_own" ON products;
DROP POLICY IF EXISTS "products_admin_all" ON products;
DROP POLICY IF EXISTS "products_public_read_approved" ON products;
DROP POLICY IF EXISTS "products_read_all" ON products;
DROP POLICY IF EXISTS "products_write_all" ON products;

-- Simple: authenticated users can do everything
CREATE POLICY "products_read_all"
ON products FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "products_write_all"
ON products FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- 2. LOCATIONS - Allow all authenticated
-- ============================================

DROP POLICY IF EXISTS "locations_authenticated_read" ON locations;
DROP POLICY IF EXISTS "locations_admin_all" ON locations;
DROP POLICY IF EXISTS "locations_public_read" ON locations;
DROP POLICY IF EXISTS "locations_read_all" ON locations;
DROP POLICY IF EXISTS "locations_write_all" ON locations;

-- Simple: authenticated users can do everything
CREATE POLICY "locations_read_all"
ON locations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "locations_write_all"
ON locations FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- 3. SUPPLIERS - Allow all authenticated
-- ============================================

DROP POLICY IF EXISTS "suppliers_read_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_admin_all" ON suppliers;
DROP POLICY IF EXISTS "suppliers_read_all" ON suppliers;
DROP POLICY IF EXISTS "suppliers_write_all" ON suppliers;

-- Simple: authenticated users can do everything
CREATE POLICY "suppliers_read_all"
ON suppliers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "suppliers_write_all"
ON suppliers FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- 4. STORAGE - Allow all authenticated
-- ============================================

DROP POLICY IF EXISTS "product_photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "product_photos_read" ON storage.objects;
DROP POLICY IF EXISTS "product_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "product_photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "storage_all" ON storage.objects;

-- Simple: authenticated can do everything
CREATE POLICY "storage_all"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'product-photos')
WITH CHECK (bucket_id = 'product-photos');

-- Public can read
CREATE POLICY "product_photos_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-photos');

-- ============================================
-- SUCCESS
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'SIMPLE RLS APPLIED - All authenticated can access';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'This is for DEVELOPMENT ONLY';
  RAISE NOTICE 'All authenticated users can now read/write:';
  RAISE NOTICE '  - products';
  RAISE NOTICE '  - locations';
  RAISE NOTICE '  - suppliers';
  RAISE NOTICE '  - storage (product-photos)';
  RAISE NOTICE '';
  RAISE NOTICE 'Test: Login as supplier and check dropdowns';
  RAISE NOTICE '================================================';
END $$;
