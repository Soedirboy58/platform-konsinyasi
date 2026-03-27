-- ========================================
-- Migration 035: Fix get_products_by_location
-- ========================================
-- Problem: Filter AND l.type = 'OUTLET' excludes kantin locations
--          causing 0 products to load on marketplace page
-- Fix: Remove type filter, keep only is_active and status checks
-- ========================================

DROP FUNCTION IF EXISTS get_products_by_location(TEXT);

CREATE OR REPLACE FUNCTION get_products_by_location(location_qr_code TEXT)
RETURNS TABLE (
    product_id UUID,
    name TEXT,
    description TEXT,
    photo_url TEXT,
    price DECIMAL(10,2),
    quantity INTEGER,
    barcode TEXT,
    supplier_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.photo_url,
        p.price,
        il.quantity,
        p.barcode,
        s.business_name
    FROM products p
    JOIN inventory_levels il ON il.product_id = p.id
    JOIN locations l ON l.id = il.location_id
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE l.qr_code = location_qr_code
      AND il.quantity > 0
      AND p.status = 'APPROVED'
      AND l.is_active = TRUE
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO authenticated;

-- ========================================
-- DIAGNOSTIC: Cek kenapa produk tidak muncul
-- ========================================

-- 1. Cek semua lokasi aktif dan tipenya
SELECT id, name, qr_code, type, is_active 
FROM locations 
WHERE is_active = TRUE;

-- 2. Cek apakah ada produk APPROVED dengan inventory
SELECT 
    l.name AS location,
    l.qr_code,
    l.type AS location_type,
    COUNT(p.id) AS total_produk,
    SUM(il.quantity) AS total_stok
FROM locations l
JOIN inventory_levels il ON il.location_id = l.id
JOIN products p ON p.id = il.product_id
WHERE p.status = 'APPROVED'
  AND l.is_active = TRUE
  AND il.quantity > 0
GROUP BY l.id, l.name, l.qr_code, l.type;

SELECT 'Migration 035: Fix get_products_by_location - DONE!' AS status;
