-- =====================================================
-- ADD MISSING SUPPLIER_ID TO SHIPMENT_RETURNS
-- =====================================================
-- Problem: shipment_returns table missing supplier_id column
-- This causes frontend query to fail when trying to JOIN suppliers
-- =====================================================

-- Check if supplier_id exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'supplier_id'
    ) THEN
        RAISE NOTICE '✅ supplier_id already exists - no action needed';
    ELSE
        RAISE NOTICE '⚠️  supplier_id missing - adding now...';
        
        -- Add supplier_id column
        ALTER TABLE shipment_returns 
        ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE;
        
        RAISE NOTICE '✅ supplier_id column added';
        
        -- Backfill supplier_id from products table
        RAISE NOTICE '📝 Backfilling supplier_id from products...';
        
        UPDATE shipment_returns sr
        SET supplier_id = p.supplier_id
        FROM products p
        WHERE sr.product_id = p.id
        AND sr.supplier_id IS NULL;
        
        RAISE NOTICE '✅ Backfill completed';
    END IF;
END $$;

-- Verify the update
SELECT 
    '📊 Verification' as check_name,
    COUNT(*) as total_returns,
    COUNT(supplier_id) as returns_with_supplier,
    COUNT(*) FILTER (WHERE supplier_id IS NULL) as returns_without_supplier
FROM shipment_returns;

-- Show sample data
SELECT 
    '✅ Sample Data' as info,
    sr.id,
    sr.supplier_id,
    s.business_name as supplier,
    p.name as product,
    sr.quantity,
    sr.status
FROM shipment_returns sr
LEFT JOIN suppliers s ON s.id = sr.supplier_id
LEFT JOIN products p ON p.id = sr.product_id
LIMIT 5;

-- =====================================================
-- EXPECTED RESULT
-- =====================================================
-- All shipment_returns should now have supplier_id populated
-- Frontend query should work after this migration
-- =====================================================
