-- ========================================
-- VERIFY: Shipment Data Exists But Not Showing
-- ========================================

-- 1. CEK APAKAH STOCK MOVEMENTS ADA DI DATABASE
SELECT 
  sm.id,
  sm.supplier_id,
  sm.location_id,
  sm.movement_type,
  sm.status,
  sm.created_at,
  s.business_name as supplier_name,
  l.name as location_name
FROM stock_movements sm
LEFT JOIN suppliers s ON s.id = sm.supplier_id
LEFT JOIN locations l ON l.id = sm.location_id
WHERE sm.status = 'PENDING'
ORDER BY sm.created_at DESC;

-- 2. CEK STOCK MOVEMENT ITEMS
SELECT 
  smi.id,
  smi.movement_id,
  smi.product_id,
  smi.quantity,
  p.name as product_name,
  sm.status as movement_status
FROM stock_movement_items smi
LEFT JOIN products p ON p.id = smi.product_id
LEFT JOIN stock_movements sm ON sm.id = smi.movement_id
WHERE sm.status = 'PENDING'
ORDER BY smi.created_at DESC;

-- 3. CEK APAKAH ADMIN PUNYA AKSES (Test RLS)
-- Ganti 'ADMIN_EMAIL' dengan email admin Anda
SELECT 
  p.id,
  p.email,
  p.role,
  CASE 
    WHEN p.role = 'ADMIN' THEN 'Admin should see ALL data'
    ELSE 'Not admin - will see limited data'
  END as expected_access
FROM profiles p
WHERE p.email = 'aris.serdadu3g@gmail.com';

-- 4. TEST EXACT QUERY DARI FRONTEND
-- Ini query yang dipanggil oleh loadShipments()
SELECT 
  sm.*,
  json_build_object(
    'business_name', s.business_name,
    'profile', json_build_object('full_name', pr.full_name)
  ) as supplier,
  json_build_object(
    'name', l.name,
    'address', l.address
  ) as location,
  (
    SELECT json_agg(json_build_object(
      'id', smi.id,
      'product_id', smi.product_id,
      'quantity', smi.quantity,
      'product', json_build_object(
        'name', p.name,
        'sku', p.sku,
        'price', p.price
      )
    ))
    FROM stock_movement_items smi
    LEFT JOIN products p ON p.id = smi.product_id
    WHERE smi.movement_id = sm.id
  ) as stock_movement_items
FROM stock_movements sm
LEFT JOIN suppliers s ON s.id = sm.supplier_id
LEFT JOIN profiles pr ON pr.id = s.profile_id
LEFT JOIN locations l ON l.id = sm.location_id
ORDER BY sm.created_at DESC
LIMIT 10;

-- ========================================
-- EXPECTED RESULTS:
-- ========================================

-- Query 1 should show: "Snack A" shipment to "Outlet Lobby A" with PENDING status
-- Query 2 should show: Items with product_name = "Snack A", quantity = 10
-- Query 3 should show: Admin with role = 'ADMIN'
-- Query 4 should return: Complete shipment data with nested JSON

-- ========================================
-- IF QUERY 1-2 RETURN DATA:
-- ========================================
-- Data EXISTS in database
-- Problem is: Frontend not fetching OR RLS blocking

-- SOLUTION:
-- 1. Check browser console for errors
-- 2. Check Network tab for failed API calls
-- 3. Verify RLS policies allow admin SELECT

-- ========================================
-- IF QUERY 1-2 RETURN EMPTY:
-- ========================================
-- Data NOT in database
-- Problem is: Supplier submission failed OR saving to wrong table

-- SOLUTION:
-- 1. Check supplier console for errors when submitting
-- 2. Verify supplier form is POSTing to stock_movements table
-- 3. Check if data went to different table (kantin_shipments?)

-- ========================================
