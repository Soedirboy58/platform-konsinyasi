-- ========================================
-- Migration: Manual Backfill Inventory for All Approved Products
-- ========================================
-- Description: Add inventory entries for all approved products
--              that don't have inventory yet
-- Execute: After migration 020
-- ========================================

-- Add inventory to all approved products at all active outlets
INSERT INTO inventory_levels (product_id, location_id, quantity)
SELECT DISTINCT
    p.id AS product_id,
    l.id AS location_id,
    0 AS quantity
FROM products p
CROSS JOIN locations l
WHERE p.status = 'APPROVED'
  AND l.type = 'OUTLET'
  AND l.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM inventory_levels il
      WHERE il.product_id = p.id AND il.location_id = l.id
  );

-- Show what was added
SELECT 
    p.name AS product_name,
    l.name AS location_name,
    il.quantity
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
WHERE il.created_at >= NOW() - INTERVAL '1 minute'
ORDER BY p.name, l.name;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 021: Manual inventory backfill - SUCCESS!' AS status;
