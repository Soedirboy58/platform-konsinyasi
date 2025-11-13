-- ========================================
-- FIX: Admin Cannot See Supplier Shipments
-- Root Cause: RLS policies blocking admin access
-- ========================================

-- DIAGNOSTIC: Check current policies
SELECT 
  policyname,
  cmd,
  roles,
  qual
FROM pg_policies
WHERE tablename = 'stock_movements';

-- ========================================
-- SOLUTION: Add/Fix RLS Policies
-- ========================================

-- 1. DROP existing restrictive policies (if any)
DROP POLICY IF EXISTS "supplier_select_own_movements" ON stock_movements;
DROP POLICY IF EXISTS "admin_select_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "admin_update_stock_movements" ON stock_movements;

-- 2. CREATE comprehensive policies

-- SUPPLIER: Can view their own stock movements
CREATE POLICY "supplier_select_own_movements"
ON stock_movements
FOR SELECT
TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM suppliers
    WHERE profile_id = auth.uid()
  )
);

-- SUPPLIER: Can create their own stock movements
CREATE POLICY "supplier_insert_own_movements"
ON stock_movements
FOR INSERT
TO authenticated
WITH CHECK (
  supplier_id IN (
    SELECT id FROM suppliers
    WHERE profile_id = auth.uid()
  )
);

-- ADMIN: Can view ALL stock movements
CREATE POLICY "admin_select_all_movements"
ON stock_movements
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- ADMIN: Can update stock movements (approve/reject)
CREATE POLICY "admin_update_movements"
ON stock_movements
FOR UPDATE
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

-- ========================================
-- FIX: stock_movement_items policies
-- ========================================

DROP POLICY IF EXISTS "supplier_select_own_items" ON stock_movement_items;
DROP POLICY IF EXISTS "admin_select_all_items" ON stock_movement_items;

-- SUPPLIER: Can view items from their movements
CREATE POLICY "supplier_select_own_items"
ON stock_movement_items
FOR SELECT
TO authenticated
USING (
  movement_id IN (
    SELECT id FROM stock_movements
    WHERE supplier_id IN (
      SELECT id FROM suppliers
      WHERE profile_id = auth.uid()
    )
  )
);

-- SUPPLIER: Can insert items for their movements
CREATE POLICY "supplier_insert_own_items"
ON stock_movement_items
FOR INSERT
TO authenticated
WITH CHECK (
  movement_id IN (
    SELECT id FROM stock_movements
    WHERE supplier_id IN (
      SELECT id FROM suppliers
      WHERE profile_id = auth.uid()
    )
  )
);

-- ADMIN: Can view ALL stock movement items
CREATE POLICY "admin_select_all_items"
ON stock_movement_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- ========================================
-- VERIFY POLICIES
-- ========================================

-- Check stock_movements policies
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%role%ADMIN%' THEN 'ADMIN'
    WHEN qual LIKE '%suppliers%' THEN 'SUPPLIER'
    ELSE 'OTHER'
  END as applies_to
FROM pg_policies
WHERE tablename = 'stock_movements'
ORDER BY policyname;

-- Check stock_movement_items policies
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%role%ADMIN%' THEN 'ADMIN'
    WHEN qual LIKE '%suppliers%' THEN 'SUPPLIER'
    ELSE 'OTHER'
  END as applies_to
FROM pg_policies
WHERE tablename = 'stock_movement_items'
ORDER BY policyname;

-- ========================================
-- TEST: Verify admin can see data
-- ========================================

-- Run this after fixing policies
-- Should return shipments if data exists
SELECT 
  sm.id,
  sm.status,
  s.business_name,
  l.name as location,
  sm.created_at,
  (SELECT COUNT(*) FROM stock_movement_items WHERE movement_id = sm.id) as items
FROM stock_movements sm
LEFT JOIN suppliers s ON s.id = sm.supplier_id
LEFT JOIN locations l ON l.id = sm.location_id
ORDER BY sm.created_at DESC
LIMIT 10;

-- ========================================
-- NOTES:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Refresh admin page after executing
-- 3. Data should appear if shipments exist
-- 4. If still empty, supplier needs to create shipment
-- ========================================
