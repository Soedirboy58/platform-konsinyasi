-- ========================================
-- BACKFILL: Sync Inventory from Approved Shipments
-- ========================================
-- Problem: Shipments approved before function fix don't have inventory records
-- Solution: Retroactively create inventory from all APPROVED shipments

-- STEP 1: Show approved shipments WITHOUT inventory
SELECT 
    sm.id AS shipment_id,
    sm.created_at,
    sm.approved_at,
    l.name AS location,
    COUNT(smi.id) AS item_count
FROM stock_movements sm
JOIN locations l ON sm.location_id = l.id
LEFT JOIN stock_movement_items smi ON sm.id = smi.movement_id
WHERE sm.status = 'APPROVED'
GROUP BY sm.id, sm.created_at, sm.approved_at, l.name
ORDER BY sm.approved_at DESC;

-- STEP 2: Backfill inventory from all APPROVED shipments
-- This will create/update inventory records
INSERT INTO inventory_levels (product_id, location_id, quantity, created_at, updated_at)
SELECT 
    smi.product_id,
    sm.location_id,
    SUM(smi.quantity)::int AS total_quantity,
    MIN(sm.approved_at) AS created_at,
    NOW() AS updated_at
FROM stock_movements sm
JOIN stock_movement_items smi ON sm.id = smi.movement_id
WHERE sm.status = 'APPROVED'
GROUP BY smi.product_id, sm.location_id
ON CONFLICT (product_id, location_id) 
DO UPDATE SET 
    quantity = inventory_levels.quantity + EXCLUDED.quantity,
    updated_at = NOW();

-- STEP 3: Verify inventory created
SELECT 
    i.id,
    p.name AS product_name,
    l.name AS location_name,
    i.quantity,
    i.created_at
FROM inventory_levels i
JOIN products p ON i.product_id = p.id
JOIN locations l ON i.location_id = l.id
ORDER BY i.created_at DESC;

-- ========================================
-- Expected Result:
-- ========================================
-- You should see inventory records with:
-- - Product name (e.g., "Roti", "Kue Basah", "Snack A")
-- - Location name (e.g., "Outlet Lobby A")
-- - Quantity = 20 (or whatever was approved)
-- ========================================

-- ========================================
-- AFTER THIS:
-- ========================================
-- 1. Refresh dashboard → "Produk Stok Tersedia" should show count
-- 2. Check etalase → Products should appear for sale
-- ========================================
