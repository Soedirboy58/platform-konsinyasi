-- ========================================
-- MIGRATION 010: Anonymous Checkout RLS
-- ========================================
-- Description: Allow anonymous users to checkout
-- Dependencies: 005_rls_policies.sql, 009_kantin_checkout_schema.sql
-- Purpose: Enable self-checkout without authentication
-- ========================================

-- ================================================
-- PRODUCTS: Anonymous read access for approved products
-- ================================================

DROP POLICY IF EXISTS "products_anonymous_read" ON products;

CREATE POLICY "products_anonymous_read" ON products
FOR SELECT USING (
  status = 'APPROVED' AND
  auth.role() = 'anon'
);

-- ================================================
-- INVENTORY: Anonymous read access for stock check
-- ================================================

DROP POLICY IF EXISTS "inventory_anonymous_read" ON inventory_levels;

CREATE POLICY "inventory_anonymous_read" ON inventory_levels
FOR SELECT USING (auth.role() = 'anon');

-- ================================================
-- LOCATIONS: Anonymous read access for QRIS
-- ================================================

DROP POLICY IF EXISTS "locations_anonymous_read" ON locations;

CREATE POLICY "locations_anonymous_read" ON locations
FOR SELECT USING (
  is_active = TRUE AND
  type = 'OUTLET' AND
  auth.role() = 'anon'
);

-- ================================================
-- SALES TRANSACTIONS: Anonymous insert for checkout
-- ================================================

DROP POLICY IF EXISTS "sales_transactions_anonymous_insert" ON sales_transactions;

CREATE POLICY "sales_transactions_anonymous_insert" ON sales_transactions
FOR INSERT WITH CHECK (auth.role() = 'anon');

-- ================================================
-- SALES ITEMS: Anonymous insert for checkout
-- ================================================

DROP POLICY IF EXISTS "sales_items_anonymous_insert" ON sales_transaction_items;

CREATE POLICY "sales_items_anonymous_insert" ON sales_transaction_items
FOR INSERT WITH CHECK (auth.role() = 'anon');

-- ================================================
-- VERIFY POLICIES
-- ================================================

SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%anonymous%'
ORDER BY tablename, policyname;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 010: Anonymous Checkout RLS - SUCCESS!' AS status;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================
/*
DROP POLICY IF EXISTS "products_anonymous_read" ON products;
DROP POLICY IF EXISTS "inventory_anonymous_read" ON inventory_levels;
DROP POLICY IF EXISTS "locations_anonymous_read" ON locations;
DROP POLICY IF EXISTS "sales_transactions_anonymous_insert" ON sales_transactions;
DROP POLICY IF EXISTS "sales_items_anonymous_insert" ON sales_transaction_items;
*/
