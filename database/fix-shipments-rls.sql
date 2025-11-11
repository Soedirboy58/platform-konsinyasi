-- ========================================
-- Fix RLS Policies for Shipments Feature
-- ========================================
-- Description: Add missing RLS policies for locations and stock_movements
--              to allow suppliers to view locations and manage their shipments
-- Execute: Run this in Supabase SQL Editor
-- ========================================

-- ========================================
-- LOCATIONS TABLE - Allow all authenticated users to read
-- ========================================

-- Drop old policies
DROP POLICY IF EXISTS "locations_authenticated_read" ON locations;
DROP POLICY IF EXISTS "locations_public_read" ON locations;
DROP POLICY IF EXISTS "locations_admin_all" ON locations;

-- Enable RLS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read locations (needed for suppliers)
CREATE POLICY "locations_authenticated_read"
ON locations FOR SELECT
TO authenticated
USING (true);

-- Allow public to read active locations (for self-checkout)
CREATE POLICY "locations_public_read"
ON locations FOR SELECT
TO anon
USING (is_active = TRUE);

-- Allow admins full access
CREATE POLICY "locations_admin_all"
ON locations FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- ========================================
-- STOCK_MOVEMENTS TABLE - Supplier access to own shipments
-- ========================================

-- Drop old policies
DROP POLICY IF EXISTS "stock_movements_supplier_read" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_supplier_insert" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_admin_all" ON stock_movements;

-- Enable RLS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Suppliers can read their own shipments
CREATE POLICY "stock_movements_supplier_read"
ON stock_movements FOR SELECT
TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM suppliers
    WHERE profile_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Suppliers can create shipments (INSERT)
CREATE POLICY "stock_movements_supplier_insert"
ON stock_movements FOR INSERT
TO authenticated
WITH CHECK (
  supplier_id IN (
    SELECT id FROM suppliers
    WHERE profile_id = auth.uid()
  )
);

-- Admins can do everything
CREATE POLICY "stock_movements_admin_all"
ON stock_movements FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- ========================================
-- STOCK_MOVEMENT_ITEMS TABLE - Allow suppliers to manage their items
-- ========================================

-- Drop old policies
DROP POLICY IF EXISTS "stock_movement_items_supplier_read" ON stock_movement_items;
DROP POLICY IF EXISTS "stock_movement_items_supplier_insert" ON stock_movement_items;
DROP POLICY IF EXISTS "stock_movement_items_admin_all" ON stock_movement_items;

-- Enable RLS
ALTER TABLE stock_movement_items ENABLE ROW LEVEL SECURITY;

-- Suppliers can read items from their shipments
CREATE POLICY "stock_movement_items_supplier_read"
ON stock_movement_items FOR SELECT
TO authenticated
USING (
  movement_id IN (
    SELECT id FROM stock_movements
    WHERE supplier_id IN (
      SELECT id FROM suppliers
      WHERE profile_id = auth.uid()
    )
  )
  OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Suppliers can create items for their shipments
CREATE POLICY "stock_movement_items_supplier_insert"
ON stock_movement_items FOR INSERT
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

-- Admins can do everything
CREATE POLICY "stock_movement_items_admin_all"
ON stock_movement_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- ========================================
-- VERIFICATION
-- ========================================

-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('locations', 'stock_movements', 'stock_movement_items')
ORDER BY tablename, policyname;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Fix Shipments RLS Policies - SUCCESS!' AS status;
