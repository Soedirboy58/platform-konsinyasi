-- ========================================
-- DIAGNOSTIC: Inventory Discrepancy Analysis
-- ========================================
-- Purpose: Identify inventory records that may have been
--          affected by the race condition bug where
--          approve_stock_movement was called multiple times
-- Date: 2025-12-12
-- ========================================

-- STEP 1: Check for duplicate approved stock movements
-- (Same shipment approved multiple times - should not exist)
SELECT 
  'Duplicate Approved Shipments' AS check_type,
  sm.id,
  sm.supplier_id,
  s.business_name,
  sm.location_id,
  l.name AS location_name,
  sm.approved_by,
  sm.approved_at,
  sm.status,
  COUNT(*) OVER (PARTITION BY sm.id) AS approval_count
FROM stock_movements sm
JOIN suppliers s ON s.id = sm.supplier_id
JOIN locations l ON l.id = sm.location_id
WHERE sm.status = 'APPROVED'
ORDER BY sm.approved_at DESC;

-- ========================================

-- STEP 2: Compare inventory vs sum of approved shipments
-- Shows products where inventory doesn't match shipment total
WITH shipment_totals AS (
  SELECT 
    smi.product_id,
    sm.location_id,
    SUM(smi.quantity) AS total_shipped
  FROM stock_movement_items smi
  JOIN stock_movements sm ON sm.id = smi.movement_id
  WHERE sm.status = 'APPROVED'
  GROUP BY smi.product_id, sm.location_id
),
sales_totals AS (
  SELECT 
    product_id,
    location_id,
    SUM(quantity) AS total_sold
  FROM sales_transactions
  GROUP BY product_id, location_id
)
SELECT 
  'Inventory vs Shipments' AS check_type,
  p.name AS product_name,
  p.barcode,
  s.business_name AS supplier_name,
  l.name AS location_name,
  il.quantity AS current_inventory,
  COALESCE(st.total_shipped, 0) AS total_approved_shipments,
  COALESCE(salt.total_sold, 0) AS total_sales,
  (COALESCE(st.total_shipped, 0) - COALESCE(salt.total_sold, 0)) AS expected_inventory,
  (il.quantity - (COALESCE(st.total_shipped, 0) - COALESCE(salt.total_sold, 0))) AS discrepancy,
  CASE 
    WHEN il.quantity > (COALESCE(st.total_shipped, 0) - COALESCE(salt.total_sold, 0)) 
      THEN 'SURPLUS (Possible Duplicate)'
    WHEN il.quantity < (COALESCE(st.total_shipped, 0) - COALESCE(salt.total_sold, 0))
      THEN 'DEFICIT'
    ELSE 'MATCH'
  END AS status
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN suppliers s ON s.id = p.supplier_id
JOIN locations l ON l.id = il.location_id
LEFT JOIN shipment_totals st ON st.product_id = il.product_id 
  AND st.location_id = il.location_id
LEFT JOIN sales_totals salt ON salt.product_id = il.product_id
  AND salt.location_id = il.location_id
WHERE il.quantity != (COALESCE(st.total_shipped, 0) - COALESCE(salt.total_sold, 0))
ORDER BY ABS(il.quantity - (COALESCE(st.total_shipped, 0) - COALESCE(salt.total_sold, 0))) DESC;

-- ========================================

-- STEP 3: Check for shipment items that may have been processed multiple times
-- by looking at inventory_levels last_updated timestamp vs stock_movements approved_at
SELECT 
  'Shipment Processing Timeline' AS check_type,
  sm.id AS movement_id,
  p.name AS product_name,
  s.business_name AS supplier_name,
  l.name AS location_name,
  smi.quantity AS shipment_quantity,
  il.quantity AS current_inventory,
  sm.approved_at AS shipment_approved_at,
  il.last_updated AS inventory_last_updated,
  EXTRACT(EPOCH FROM (il.last_updated - sm.approved_at)) AS seconds_difference
FROM stock_movements sm
JOIN stock_movement_items smi ON smi.movement_id = sm.id
JOIN products p ON p.id = smi.product_id
JOIN suppliers s ON s.id = p.supplier_id
JOIN locations l ON l.id = sm.location_id
JOIN inventory_levels il ON il.product_id = smi.product_id 
  AND il.location_id = sm.location_id
WHERE sm.status = 'APPROVED'
  AND sm.approved_at IS NOT NULL
ORDER BY sm.approved_at DESC
LIMIT 50;

-- ========================================

-- STEP 4: Find specific case mentioned in issue (8 units → 22 pcs)
-- Looking for products where inventory is ~2.75x the shipment amount
SELECT 
  'Suspicious Multiplier Pattern' AS check_type,
  p.name AS product_name,
  p.barcode,
  s.business_name AS supplier_name,
  l.name AS location_name,
  smi.quantity AS original_shipment,
  il.quantity AS current_inventory,
  ROUND(il.quantity::NUMERIC / NULLIF(smi.quantity, 0), 2) AS multiplier,
  sm.id AS movement_id,
  sm.approved_at,
  sm.approved_by
FROM stock_movements sm
JOIN stock_movement_items smi ON smi.movement_id = sm.id
JOIN products p ON p.id = smi.product_id
JOIN suppliers s ON s.id = p.supplier_id
JOIN locations l ON l.id = sm.location_id
JOIN inventory_levels il ON il.product_id = smi.product_id 
  AND il.location_id = sm.location_id
WHERE sm.status = 'APPROVED'
  AND il.quantity > smi.quantity  -- Inventory is more than shipped
  AND smi.quantity > 0
ORDER BY (il.quantity::NUMERIC / NULLIF(smi.quantity, 0)) DESC;

-- ========================================

-- STEP 5: Summary statistics
SELECT 
  'Summary Statistics' AS report_type,
  COUNT(DISTINCT sm.id) AS total_approved_shipments,
  COUNT(DISTINCT il.id) AS total_inventory_records,
  COUNT(DISTINCT p.id) AS total_products_with_inventory,
  COUNT(DISTINCT s.id) AS total_suppliers_with_shipments,
  SUM(smi.quantity) AS total_units_shipped,
  SUM(il.quantity) AS total_units_in_inventory
FROM stock_movements sm
LEFT JOIN stock_movement_items smi ON smi.movement_id = sm.id
LEFT JOIN products p ON p.id = smi.product_id
LEFT JOIN suppliers s ON s.id = p.supplier_id
LEFT JOIN inventory_levels il ON il.product_id = smi.product_id
WHERE sm.status = 'APPROVED';

-- ========================================
-- EXPECTED OUTPUT
-- ========================================
-- If the bug affected the system, you should see:
-- 1. Products with inventory > sum of approved shipments - sales
-- 2. Multipliers significantly > 1.0 (e.g., 2.75 for 8→22 case)
-- 3. Timestamps showing rapid updates to the same inventory record
-- ========================================

-- ========================================
-- REMEDIATION QUERY (Use with caution!)
-- ========================================
-- After identifying affected records, you may need to manually
-- correct inventory. This template query shows how:
/*
-- DO NOT RUN without reviewing the diagnostic results first!

UPDATE inventory_levels il
SET 
  quantity = (
    SELECT COALESCE(SUM(smi.quantity), 0) - COALESCE(SUM(st.quantity), 0)
    FROM stock_movement_items smi
    LEFT JOIN stock_movements sm ON sm.id = smi.movement_id
    LEFT JOIN sales_transactions st ON st.product_id = il.product_id 
      AND st.location_id = il.location_id
    WHERE smi.product_id = il.product_id
      AND sm.location_id = il.location_id
      AND sm.status = 'APPROVED'
  ),
  last_updated = NOW()
WHERE il.id IN (
  -- List specific inventory_levels.id values here
  -- after identifying them in the diagnostic queries above
);
*/
