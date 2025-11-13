-- ========================================
-- DEBUG SHIPMENTS FLOW
-- Cek kenapa produk supplier tidak muncul di admin
-- ========================================

-- 1. CEK APAKAH ADA STOCK MOVEMENTS
SELECT 
  sm.id,
  sm.supplier_id,
  sm.location_id,
  sm.movement_type,
  sm.status,
  sm.created_at,
  s.business_name as supplier_name,
  l.name as location_name,
  (SELECT COUNT(*) FROM stock_movement_items smi WHERE smi.movement_id = sm.id) as item_count
FROM stock_movements sm
LEFT JOIN suppliers s ON s.id = sm.supplier_id
LEFT JOIN locations l ON l.id = sm.location_id
ORDER BY sm.created_at DESC
LIMIT 20;

-- 2. CEK STOCK MOVEMENT ITEMS
SELECT 
  smi.id,
  smi.movement_id,
  smi.product_id,
  smi.quantity,
  p.name as product_name,
  p.sku,
  p.status as product_status,
  sm.status as movement_status
FROM stock_movement_items smi
LEFT JOIN products p ON p.id = smi.product_id
LEFT JOIN stock_movements sm ON sm.id = smi.movement_id
ORDER BY smi.created_at DESC
LIMIT 20;

-- 3. CEK PRODUCTS YANG SUDAH APPROVED
SELECT 
  p.id,
  p.name,
  p.sku,
  p.status,
  p.supplier_id,
  s.business_name,
  p.created_at
FROM products p
LEFT JOIN suppliers s ON s.id = p.supplier_id
WHERE p.status = 'APPROVED'
ORDER BY p.created_at DESC
LIMIT 20;

-- 4. CEK PRODUCTS YANG MASIH PENDING
SELECT 
  p.id,
  p.name,
  p.sku,
  p.status,
  p.supplier_id,
  s.business_name,
  p.created_at
FROM products p
LEFT JOIN suppliers s ON s.id = p.supplier_id
WHERE p.status = 'PENDING'
ORDER BY p.created_at DESC
LIMIT 20;

-- 5. CEK RLS POLICIES untuk stock_movements
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
WHERE tablename = 'stock_movements';

-- 6. CEK RLS POLICIES untuk stock_movement_items
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
WHERE tablename = 'stock_movement_items';

-- 7. TEST QUERY SEPERTI DI FRONTEND (Admin perspective)
-- Ini simulasi query yang dipakai di admin/suppliers/shipments/page.tsx
SELECT 
  sm.*,
  s.business_name as supplier_business_name,
  l.name as location_name,
  l.address as location_address,
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
  ) as items
FROM stock_movements sm
LEFT JOIN suppliers s ON s.id = sm.supplier_id
LEFT JOIN locations l ON l.id = sm.location_id
ORDER BY sm.created_at DESC
LIMIT 10;

-- 8. CEK APAKAH PROFILE ADMIN PUNYA ROLE YANG BENAR
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM profiles
WHERE role = 'ADMIN';

-- ========================================
-- DIAGNOSTIC INFO
-- ========================================

-- Cek total data
SELECT 
  'stock_movements' as table_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
  COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
  COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected
FROM stock_movements

UNION ALL

SELECT 
  'products' as table_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
  COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
  COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected
FROM products

UNION ALL

SELECT 
  'suppliers' as table_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
  0 as approved,
  0 as rejected
FROM suppliers;

-- ========================================
-- NOTES:
-- Jalankan query ini di Supabase SQL Editor
-- Hasil akan menunjukkan:
-- 1. Apakah stock movements ada?
-- 2. Apakah items sudah ter-link?
-- 3. Apakah products sudah APPROVED?
-- 4. Apakah RLS policies correct?
-- 5. Apakah admin bisa query data?
-- ========================================
