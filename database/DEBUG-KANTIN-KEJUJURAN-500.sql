-- ========================================
-- DEBUG: HTTP 500 Error on /kantin/kantin-kejujuran
-- ========================================
-- Purpose: Diagnose why page returns 500 error
-- Last Updated: 2026-03-27
-- ========================================

-- STEP 1: Check if location exists
SELECT 
    id,
    name,
    qr_code,
    type,
    is_active,
    created_at
FROM locations
WHERE qr_code = 'kantin-kejujuran'
   OR name ILIKE '%kantin%kejujuran%'
   OR LOWER(qr_code) = LOWER('kantin-kejujuran');

-- Expected: Should return 1 row
-- If empty: Location doesn't exist, need to create it

---

-- STEP 2: Check all active outlets
SELECT 
    id,
    name,
    qr_code,
    type,
    is_active
FROM locations
WHERE is_active = TRUE
  AND type = 'OUTLET'
ORDER BY name;

---

-- STEP 3: Count approved products
SELECT 
    COUNT(*) as total_approved,
    COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved_count,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected_count
FROM products;

---

-- STEP 4: Check inventory levels for kantin-kejujuran
SELECT 
    p.id as product_id,
    p.name,
    p.price,
    il.quantity,
    l.qr_code,
    l.name as location_name,
    l.type,
    l.is_active,
    s.business_name,
    p.status
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
JOIN suppliers s ON s.id = p.supplier_id
WHERE l.qr_code = 'kantin-kejujuran'
   OR LOWER(l.qr_code) = LOWER('kantin-kejujuran')
ORDER BY p.name;

-- Expected: Should show products with quantity
-- If empty: No inventory at this location

---

-- STEP 5: Test RPC function directly
SELECT * FROM get_products_by_location('kantin-kejujuran');

-- Expected: Should return products
-- If error: Function has issue or doesn't exist
-- If empty: No products match filter criteria

---

-- STEP 6: Test with other locations
SELECT * FROM get_products_by_location('outlet_lobby_a');

-- Expected: Should return products if data exists
-- Helps determine if function works at all

---

-- STEP 7: Check function exists and permissions
SELECT 
    routine_name,
    routine_type,
    data_type,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'get_products_by_location'
  AND routine_schema = 'public';

-- Expected: Should find the function
-- If empty: Function not created yet

---

-- STEP 8: Check if RLS policies blocking access
SELECT 
    policyname,
    tablename,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('products', 'inventory_levels', 'locations', 'suppliers')
ORDER BY tablename, policyname;

---

-- STEP 9: Check RPC function grants
SELECT 
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_name LIKE '%get_products_by_location%'
   OR table_name = 'products'
   OR table_name = 'inventory_levels';

---

-- STEP 10: Manual test - Get products without RPC
-- This is what the RPC should return
SELECT 
    p.id as product_id,
    p.name,
    p.description,
    p.photo_url,
    p.price,
    il.quantity,
    p.barcode,
    s.business_name
FROM products p
JOIN inventory_levels il ON il.product_id = p.id
JOIN locations l ON l.id = il.location_id
JOIN suppliers s ON s.id = p.supplier_id
WHERE l.qr_code = 'kantin-kejujuran'
  AND p.status = 'APPROVED'
  AND l.is_active = TRUE
  AND l.type = 'OUTLET'
ORDER BY p.name;

---

-- ========================================
-- FIXES BASED ON FINDINGS
-- ========================================

-- FIX 1: If location doesn't exist, create it
-- INSERT INTO locations (name, qr_code, type, address, is_active)
-- VALUES ('Kantin Kejujuran', 'kantin-kejujuran', 'OUTLET', 'Lokasi Kantin Kejujuran', true);

-- FIX 2: If function doesn't exist, run migration 015 in backend/migrations/
-- Or copy function definition from migration 024

-- FIX 3: If no inventory, need to add products and create inventory_levels
-- See backend/migrations/021_manual_inventory_backfill.sql

-- FIX 4: If RLS blocking, add grant:
-- GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO anon;
-- GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO authenticated;
