-- ========================================
-- DEBUG: Why Supplier Dashboard & Wallet Shows Empty
-- ========================================
-- Purpose: Find why salesNotifications and salesPayments arrays are empty
-- even though sales records exist
-- ========================================

-- ========================================
-- PART 1: Check Table Structure
-- ========================================

-- Check sales_transaction_items columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_transaction_items'
ORDER BY ordinal_position;

-- ========================================
-- PART 2: Check if supplier_revenue and commission_amount exist
-- ========================================

-- If these columns don't exist, they need to be added
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales_transaction_items' 
        AND column_name = 'supplier_revenue'
    ) THEN
        RAISE NOTICE '❌ MISSING: Column supplier_revenue does not exist!';
        RAISE NOTICE '   Need to run: ALTER TABLE sales_transaction_items ADD COLUMN supplier_revenue DECIMAL(10,2);';
    ELSE
        RAISE NOTICE '✅ Column supplier_revenue exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales_transaction_items' 
        AND column_name = 'commission_amount'
    ) THEN
        RAISE NOTICE '❌ MISSING: Column commission_amount does not exist!';
        RAISE NOTICE '   Need to run: ALTER TABLE sales_transaction_items ADD COLUMN commission_amount DECIMAL(10,2);';
    ELSE
        RAISE NOTICE '✅ Column commission_amount exists';
    END IF;
END $$;

-- ========================================
-- PART 3: Check Sample Data for Aneka Snack
-- ========================================

-- Get supplier ID
DO $$
DECLARE
    v_supplier_id UUID;
    v_product_count INTEGER;
    v_sales_count INTEGER;
BEGIN
    -- Get Aneka Snack supplier
    SELECT id INTO v_supplier_id
    FROM suppliers
    WHERE business_name = 'Aneka Snack';

    IF v_supplier_id IS NULL THEN
        RAISE NOTICE '❌ Supplier "Aneka Snack" not found!';
        RETURN;
    END IF;

    RAISE NOTICE '✅ Supplier ID: %', v_supplier_id;

    -- Count products
    SELECT COUNT(*) INTO v_product_count
    FROM products
    WHERE supplier_id = v_supplier_id AND status = 'APPROVED';

    RAISE NOTICE '📦 Approved Products: %', v_product_count;

    -- Count COMPLETED sales
    SELECT COUNT(*) INTO v_sales_count
    FROM sales_transaction_items sti
    JOIN products p ON p.id = sti.product_id
    JOIN sales_transactions st ON st.id = sti.transaction_id
    WHERE p.supplier_id = v_supplier_id
    AND st.status = 'COMPLETED';

    RAISE NOTICE '💰 COMPLETED Sales: %', v_sales_count;

    -- Show sample sales data
    RAISE NOTICE '📊 Sample Sales Data (showing structure):';
    
    -- This will show what columns actually exist in the data
    FOR v_rec IN 
        SELECT 
            sti.id,
            sti.quantity,
            sti.subtotal,
            p.name as product_name,
            st.status,
            st.created_at
        FROM sales_transaction_items sti
        JOIN products p ON p.id = sti.product_id
        JOIN sales_transactions st ON st.id = sti.transaction_id
        WHERE p.supplier_id = v_supplier_id
        AND st.status = 'COMPLETED'
        LIMIT 3
    LOOP
        RAISE NOTICE '   - Product: %, Qty: %, Subtotal: %, Date: %',
            v_rec.product_name, v_rec.quantity, v_rec.subtotal, v_rec.created_at;
    END LOOP;

END $$;

-- ========================================
-- PART 4: Test the Actual Query Used in Frontend
-- ========================================

-- Dashboard query (page.tsx)
RAISE NOTICE '🔍 Testing Dashboard Query:';

SELECT 
    sti.id,
    sti.quantity,
    sti.supplier_revenue,
    p.name as product_name,
    st.created_at,
    st.status,
    l.name as location_name
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
JOIN sales_transactions st ON st.id = sti.transaction_id
LEFT JOIN locations l ON l.id = st.location_id
WHERE p.supplier_id = (SELECT id FROM suppliers WHERE business_name = 'Aneka Snack')
AND st.status = 'COMPLETED'
ORDER BY st.created_at DESC
LIMIT 5;

-- ========================================
-- PART 5: Check if Price Column Exists
-- ========================================

-- Frontend wallet uses "price" but schema might have "unit_price"
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sales_transaction_items' 
        AND column_name = 'price'
    ) THEN
        RAISE NOTICE '⚠️ Column "price" does not exist, checking for "unit_price"...';
        
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'sales_transaction_items' 
            AND column_name = 'unit_price'
        ) THEN
            RAISE NOTICE '✅ Column "unit_price" exists - frontend should use this instead of "price"';
        END IF;
    ELSE
        RAISE NOTICE '✅ Column "price" exists';
    END IF;
END $$;

-- ========================================
-- SUMMARY
-- ========================================

SELECT '✅ Diagnostic complete! Check logs above for issues.' AS status;
