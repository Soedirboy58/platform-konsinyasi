-- ========================================
-- ADD COMMISSION TRACKING TO SALES ITEMS
-- ========================================
-- Purpose: Add commission_amount and supplier_revenue columns
-- to sales_transaction_items for proper financial tracking
-- ========================================

-- Check if columns already exist before adding
DO $$ 
BEGIN
    -- Add commission_amount column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_transaction_items' 
        AND column_name = 'commission_amount'
    ) THEN
        ALTER TABLE sales_transaction_items
        ADD COLUMN commission_amount DECIMAL(10,2) DEFAULT 0 CHECK (commission_amount >= 0);
        
        RAISE NOTICE 'Added commission_amount column';
    ELSE
        RAISE NOTICE 'commission_amount column already exists';
    END IF;

    -- Add supplier_revenue column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_transaction_items' 
        AND column_name = 'supplier_revenue'
    ) THEN
        ALTER TABLE sales_transaction_items
        ADD COLUMN supplier_revenue DECIMAL(10,2) DEFAULT 0 CHECK (supplier_revenue >= 0);
        
        RAISE NOTICE 'Added supplier_revenue column';
    ELSE
        RAISE NOTICE 'supplier_revenue column already exists';
    END IF;

    -- Rename unit_price to price for consistency (optional)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_transaction_items' 
        AND column_name = 'unit_price'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_transaction_items' 
        AND column_name = 'price'
    ) THEN
        ALTER TABLE sales_transaction_items
        RENAME COLUMN unit_price TO price;
        
        RAISE NOTICE 'Renamed unit_price to price';
    ELSE
        RAISE NOTICE 'price column already correct or exists';
    END IF;
END $$;

-- Update existing records to calculate commission (if any exist)
DO $$
DECLARE
    v_commission_rate DECIMAL(5,2) := 10.0;  -- Default 10% commission
    v_updated_count INTEGER;
BEGIN
    -- Try to get platform commission rate if table and column exist
    BEGIN
        SELECT COALESCE(commission_rate, 10.0) INTO v_commission_rate
        FROM platform_settings
        LIMIT 1;
    EXCEPTION
        WHEN undefined_table OR undefined_column THEN
            -- Table or column doesn't exist, use default 10%
            v_commission_rate := 10.0;
            RAISE NOTICE 'Using default commission rate: 10%% (platform_settings not available)';
    END;
    
    -- Update existing sales_transaction_items that have NULL or 0 commission
    UPDATE sales_transaction_items
    SET 
        commission_amount = ROUND(subtotal * v_commission_rate / 100, 2),
        supplier_revenue = ROUND(subtotal * (100 - v_commission_rate) / 100, 2)
    WHERE commission_amount IS NULL OR commission_amount = 0;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Updated existing records with commission calculations. Count: %, Rate: %', 
        v_updated_count, v_commission_rate;
END $$;

-- Verify schema
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_transaction_items'
ORDER BY ordinal_position;

SELECT 'Commission columns added successfully! sales_transaction_items schema updated.' AS status;
