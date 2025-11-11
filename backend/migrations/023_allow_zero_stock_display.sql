-- ========================================
-- Migration: Fix get_products_by_location to show products even with 0 stock
-- ========================================
-- Description: Allow products with 0 quantity to appear (show "Habis" in frontend)
--              Actual quantity sync comes from inventory_levels table
-- Execute: After migration 020
-- ========================================

-- Drop and recreate function
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
      AND il.quantity >= 0  -- Changed from > 0 to >= 0 (show even if out of stock)
      AND p.status = 'APPROVED'
      AND l.is_active = TRUE
      AND l.type = 'OUTLET'
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO authenticated;

-- ========================================
-- EXPLANATION
-- ========================================

-- SEBELUM: il.quantity > 0
-- - Produk dengan stock 0 tidak muncul di dashboard customer
-- - Supplier/admin harus update stock dulu baru produk visible
--
-- SEKARANG: il.quantity >= 0
-- - Produk muncul meski stock 0 (frontend tampil "Habis")
-- - Quantity actual sync dari inventory_levels table
-- - Supplier update inventory → otomatis sync ke customer dashboard
--
-- DATA FLOW:
-- 1. Supplier create product → Admin approve
-- 2. Trigger auto-create inventory (qty = 0)
-- 3. Product muncul di customer dashboard (button disabled)
-- 4. Supplier update stock via inventory management
-- 5. Customer dashboard auto-refresh → stock updated

-- ========================================
-- VERIFICATION
-- ========================================

-- Test: Should now return all approved products (even with qty = 0)
SELECT 
    product_id,
    name,
    price,
    quantity,
    supplier_name
FROM get_products_by_location('outlet_lobby_a')
ORDER BY name;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 023: Allow zero-stock products in customer view - SUCCESS!' AS status;
