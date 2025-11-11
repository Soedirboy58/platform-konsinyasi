-- ========================================
-- Migration: Smart Product Sorting for Fair Distribution
-- ========================================
-- Description: Update get_products_by_location to prioritize 
--              less popular products and show out-of-stock items
-- Execute: After migration 023
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
    supplier_name TEXT,
    total_sales INTEGER,  -- New: untuk tracking popularity
    sort_priority INTEGER -- New: untuk custom sorting
) AS $$
BEGIN
    RETURN QUERY
    WITH product_sales AS (
        -- Calculate total sales per product
        SELECT 
            sti.product_id,
            COALESCE(SUM(sti.quantity), 0) AS sales_count
        FROM sales_transaction_items sti
        JOIN sales_transactions st ON st.id = sti.transaction_id
        WHERE st.status = 'COMPLETED'
        GROUP BY sti.product_id
    )
    SELECT 
        p.id,
        p.name,
        p.description,
        p.photo_url,
        p.price,
        il.quantity,
        p.barcode,
        s.business_name,
        COALESCE(ps.sales_count, 0)::INTEGER AS total_sales,
        -- Sort priority logic:
        -- 1. Out of stock (qty = 0) → Priority 3 (bottom)
        -- 2. Low stock (qty <= 5) → Priority 1 (top - urgent!)
        -- 3. Normal stock → Priority 2 (middle)
        CASE 
            WHEN il.quantity = 0 THEN 3
            WHEN il.quantity <= 5 THEN 1
            ELSE 2
        END AS sort_priority
    FROM products p
    JOIN inventory_levels il ON il.product_id = p.id
    JOIN locations l ON l.id = il.location_id
    JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN product_sales ps ON ps.product_id = p.id
    WHERE l.qr_code = location_qr_code
      AND p.status = 'APPROVED'
      AND l.is_active = TRUE
      AND l.type = 'OUTLET'
    ORDER BY 
        sort_priority ASC,           -- Priority groups first
        total_sales ASC,             -- Within group: least sold first
        RANDOM();                    -- Same sales count: random order
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_products_by_location(TEXT) TO authenticated;

-- ========================================
-- SORTING LOGIC EXPLAINED
-- ========================================

-- PRIORITY 1 (TOP): Low Stock (qty 1-5)
--   → Urgent to sell before expired/spoiled
--   → Customer sees these first
--   → Within group: least sold → most sold
--
-- PRIORITY 2 (MIDDLE): Normal Stock (qty > 5)
--   → Healthy inventory
--   → Sorted by: least sold → most sold
--   → Same sales: random order (fair rotation)
--
-- PRIORITY 3 (BOTTOM): Out of Stock (qty = 0)
--   → Still visible with "HABIS" badge
--   → Customer aware product exists
--   → Can check back later

-- EXAMPLE OUTPUT:
-- 1. Pai (qty: 3, sales: 0) ← LOW STOCK, NEVER SOLD
-- 2. Roti (qty: 5, sales: 2) ← LOW STOCK, LESS POPULAR
-- 3. Kue Basah (qty: 15, sales: 5) ← NORMAL STOCK, LESS POPULAR
-- 4. Snack A (qty: 20, sales: 5) ← NORMAL STOCK, SAME SALES (random order)
-- 5. Snack B (qty: 18, sales: 5) ← NORMAL STOCK, SAME SALES (random order)
-- 6. Minuman (qty: 30, sales: 50) ← NORMAL STOCK, POPULAR
-- 7. Kopi (qty: 0, sales: 100) ← OUT OF STOCK (still visible)

-- ========================================
-- VERIFICATION
-- ========================================

SELECT 
    name,
    quantity,
    total_sales,
    sort_priority,
    CASE 
        WHEN sort_priority = 1 THEN '🔴 PRIORITAS TINGGI (Stock Menipis)'
        WHEN sort_priority = 2 THEN '🟢 Normal Stock'
        WHEN sort_priority = 3 THEN '⚫ Habis (Masih Tampil)'
    END AS status_display
FROM get_products_by_location('outlet_lobby_a')
ORDER BY sort_priority, total_sales;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 024: Smart product sorting - SUCCESS!' AS status;
