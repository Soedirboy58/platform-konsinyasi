-- ============================================================
-- Migration 042: Add category to get_products_by_location RPC
-- Jalankan di Supabase SQL Editor
-- ============================================================

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
    supplier_name TEXT,
    category TEXT
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
        s.business_name,
        p.category
    FROM products p
    JOIN inventory_levels il ON il.product_id = p.id
    JOIN locations l ON l.id = il.location_id
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE l.qr_code = location_qr_code
      AND il.quantity > 0
      AND p.status = 'APPROVED'
      AND l.is_active = TRUE
    ORDER BY
        CASE WHEN p.category IS NULL THEN 1 ELSE 0 END,
        p.category,
        p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO authenticated;

SELECT 'Migration 042 COMPLETE: category added to get_products_by_location RPC' AS status;
