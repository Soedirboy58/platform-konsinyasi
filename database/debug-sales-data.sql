-- ========================================
-- DEBUG: Check Sales Data Exist or Not
-- ========================================

-- Step 1: Check if there are ANY sales transactions
SELECT 
    'Total Sales Transactions' AS check_type,
    COUNT(*) AS total_count,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_count,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count
FROM sales_transactions;

-- Step 2: Check sales_transaction_items
SELECT 
    'Total Sales Items' AS check_type,
    COUNT(*) AS total_count,
    SUM(quantity) AS total_quantity,
    SUM(subtotal) AS total_subtotal,
    SUM(commission_amount) AS total_commission,
    SUM(supplier_revenue) AS total_supplier_revenue
FROM sales_transaction_items;

-- Step 3: Check sales by supplier
SELECT 
    s.id AS supplier_id,
    s.business_name,
    COUNT(DISTINCT sti.id) AS total_sales_items,
    SUM(sti.quantity) AS total_quantity_sold,
    SUM(sti.supplier_revenue) AS total_revenue
FROM suppliers s
LEFT JOIN products p ON p.supplier_id = s.id
LEFT JOIN sales_transaction_items sti ON sti.product_id = p.id
LEFT JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE st.status = 'COMPLETED' OR st.status IS NULL
GROUP BY s.id, s.business_name
ORDER BY total_quantity_sold DESC NULLS LAST;

-- Step 4: Check if commission columns exist and have data
SELECT 
    id,
    product_id,
    quantity,
    price,
    subtotal,
    commission_rate,
    commission_amount,
    supplier_revenue,
    created_at
FROM sales_transaction_items
LIMIT 5;

-- Step 5: Check products in inventory that are actually available
SELECT 
    p.id,
    p.name,
    p.supplier_id,
    p.status,
    s.business_name,
    COUNT(il.id) AS locations_count,
    SUM(il.quantity) AS total_stock
FROM products p
JOIN suppliers s ON s.id = p.supplier_id
LEFT JOIN inventory_levels il ON il.product_id = p.id
WHERE p.status = 'APPROVED'
GROUP BY p.id, p.name, p.supplier_id, p.status, s.business_name
ORDER BY s.business_name, p.name;

-- Step 6: Check if there are products visible to customers
SELECT 
    'Products by Location' AS check_type,
    l.name AS location_name,
    COUNT(DISTINCT il.product_id) AS product_count,
    SUM(il.quantity) AS total_stock
FROM locations l
LEFT JOIN inventory_levels il ON il.location_id = l.id
LEFT JOIN products p ON p.id = il.product_id
WHERE p.status = 'APPROVED' AND il.quantity > 0
GROUP BY l.id, l.name;

-- Step 7: Simulate supplier dashboard query
-- Replace 'YOUR_SUPPLIER_ID' with actual supplier_id
DO $$
DECLARE
    v_supplier_id UUID;
BEGIN
    -- Get first supplier
    SELECT id INTO v_supplier_id FROM suppliers LIMIT 1;
    
    RAISE NOTICE 'Checking for supplier: %', v_supplier_id;
    
    -- Check sales for this supplier
    PERFORM 
        COUNT(*) AS sales_count,
        SUM(sti.quantity) AS total_sold,
        SUM(sti.supplier_revenue) AS total_revenue
    FROM sales_transaction_items sti
    JOIN products p ON p.id = sti.product_id
    JOIN sales_transactions st ON st.id = sti.transaction_id
    WHERE p.supplier_id = v_supplier_id
      AND st.status = 'COMPLETED';
END $$;
