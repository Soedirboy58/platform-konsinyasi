-- Quick diagnostic untuk HTTP 500 error
-- Run ini di Supabase SQL Editor untuk check apakah RPC ada

-- ✅ STEP 1: Check if function exists
SELECT 
    routine_name,
    routine_schema,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_name = 'get_products_by_location'
AND routine_schema = 'public';

-- ✅ STEP 2: If found, test it with existing outlet
-- (ganti 'outlet_lobby_a' dengan outlet yang sudah ada di system)
SELECT * FROM get_products_by_location('outlet_lobby_a');

-- ✅ STEP 3: Check new outlets that were created
SELECT id, name, qr_code, type, is_active FROM locations 
ORDER BY created_at DESC LIMIT 5;

-- ✅ STEP 4: Check if kantin-kejujuran has any products
SELECT 
    l.id, l.name, l.qr_code,
    COUNT(il.product_id) as product_count,
    SUM(il.quantity) as total_quantity
FROM locations l
LEFT JOIN inventory_levels il ON il.location_id = l.id
WHERE l.qr_code IN ('kantin-kejujuran', 'a', 'outlet_a')
GROUP BY l.id, l.name, l.qr_code;

-- ✅ STEP 5: Manual test - Get products for kantin-kejujuran WITHOUT RPC
SELECT 
    p.id as product_id,
    p.name,
    p.price,
    il.quantity,
    s.business_name
FROM products p
JOIN inventory_levels il ON il.product_id = p.id
JOIN locations l ON l.id = il.location_id
JOIN suppliers s ON s.id = p.supplier_id
WHERE l.qr_code = 'kantin-kejujuran'
AND p.status = 'APPROVED'
AND l.is_active = TRUE
AND l.type = 'OUTLET';
