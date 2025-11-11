-- ========================================
-- Debug: Check why new products not appearing
-- ========================================

-- 1. Check all approved products
SELECT 
    p.id,
    p.name,
    p.status,
    p.supplier_id,
    s.business_name as supplier_name,
    p.created_at
FROM products p
LEFT JOIN suppliers s ON s.id = p.supplier_id
WHERE p.status = 'APPROVED'
ORDER BY p.created_at DESC;

-- 2. Check inventory for each product
SELECT 
    p.name as product_name,
    l.name as location_name,
    il.quantity,
    il.created_at as inventory_created
FROM products p
LEFT JOIN inventory_levels il ON il.product_id = p.id
LEFT JOIN locations l ON l.id = il.location_id
WHERE p.status = 'APPROVED'
ORDER BY p.name, l.name;

-- 3. Check which products are missing inventory
SELECT 
    p.id,
    p.name as product_name,
    p.status,
    CASE 
        WHEN il.id IS NULL THEN '❌ NO INVENTORY'
        WHEN il.quantity = 0 THEN '⚠️ ZERO STOCK'
        ELSE '✅ HAS STOCK'
    END as inventory_status
FROM products p
LEFT JOIN inventory_levels il ON il.product_id = p.id
WHERE p.status = 'APPROVED'
ORDER BY p.created_at DESC;

-- 4. Check what get_products_by_location returns
SELECT * FROM get_products_by_location('outlet_lobby_a');
