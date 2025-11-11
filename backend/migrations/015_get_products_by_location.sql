-- ========================================
-- Migration: Get Products By Location Function
-- ========================================
-- Description: Create RPC function for customer dashboard to get products at specific location
-- Execute: After migration 011 (kantin checkout)
-- ========================================

-- Drop existing function if any (with different signature)
DROP FUNCTION IF EXISTS get_products_by_location(TEXT);

-- Create function to get products available at specific location
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
      AND l.type = 'OUTLET'
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon (for customer dashboard)
GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO authenticated;

-- ========================================
-- TESTING
-- ========================================

-- Test function
SELECT 
    product_id,
    name,
    price,
    quantity,
    supplier_name
FROM get_products_by_location('outlet_lobby_a');

-- Should return products with:
-- - status = APPROVED
-- - quantity > 0
-- - at active outlet location

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Function get_products_by_location created successfully!' AS status;
