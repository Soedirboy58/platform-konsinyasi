-- ========================================
-- Fix: Add inventory for new products
-- ========================================
-- Run this AFTER executing debug-product-visibility.sql
-- to see which products need inventory
-- ========================================

-- Step 1: Add inventory for ALL approved products that don't have it
INSERT INTO inventory_levels (product_id, location_id, quantity)
SELECT DISTINCT
    p.id AS product_id,
    l.id AS location_id,
    15 AS quantity  -- Set default stock to 15
FROM products p
CROSS JOIN locations l
WHERE p.status = 'APPROVED'
  AND l.type = 'OUTLET'
  AND l.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM inventory_levels il
      WHERE il.product_id = p.id AND il.location_id = l.id
  );

-- Step 2: Verify what was added
SELECT 
    p.name AS product_name,
    l.name AS location_name,
    il.quantity,
    il.created_at
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
WHERE il.created_at >= NOW() - INTERVAL '5 minutes'
ORDER BY il.created_at DESC;

-- Step 3: Test function again
SELECT * FROM get_products_by_location('outlet_lobby_a');

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Fixed: All approved products now have inventory!' AS status;
