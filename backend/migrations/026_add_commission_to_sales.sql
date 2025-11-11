-- ========================================
-- Migration: Add Commission Tracking to Sales
-- ========================================
-- Description: Add commission_rate and commission_amount columns to 
--              sales_transaction_items to track per-item commission.
--              Commission is deducted from supplier's revenue, customer pays full price.
-- Execute: After migration 025
-- ========================================

-- Add commission columns to sales_transaction_items
ALTER TABLE sales_transaction_items
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 10.00 NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(15,2) DEFAULT 0.00 NOT NULL CHECK (commission_amount >= 0),
ADD COLUMN IF NOT EXISTS supplier_revenue DECIMAL(15,2) DEFAULT 0.00 NOT NULL CHECK (supplier_revenue >= 0);

-- Add comment
COMMENT ON COLUMN sales_transaction_items.commission_rate IS 'Platform commission rate (e.g., 10 = 10%)';
COMMENT ON COLUMN sales_transaction_items.commission_amount IS 'Platform commission amount = subtotal × (commission_rate / 100)';
COMMENT ON COLUMN sales_transaction_items.supplier_revenue IS 'Supplier revenue after commission = subtotal - commission_amount';

-- ========================================
-- BACKFILL: Update existing records
-- ========================================

-- Calculate commission for existing transactions (assuming 10% default)
UPDATE sales_transaction_items
SET 
    commission_rate = 10.00,
    commission_amount = ROUND(subtotal * 0.10, 2),
    supplier_revenue = ROUND(subtotal * 0.90, 2)
WHERE commission_amount = 0 OR commission_amount IS NULL;

-- ========================================
-- VERIFICATION
-- ========================================

-- Check new columns exist
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sales_transaction_items'
  AND column_name IN ('commission_rate', 'commission_amount', 'supplier_revenue')
ORDER BY ordinal_position;

-- Verify calculation (should show all 3 values correctly)
SELECT 
    id,
    subtotal,
    commission_rate,
    commission_amount,
    supplier_revenue,
    (subtotal - commission_amount) AS calculated_supplier_revenue,
    CASE 
        WHEN ABS(supplier_revenue - (subtotal - commission_amount)) < 0.01 THEN '✓ Correct'
        ELSE '✗ Error'
    END AS validation
FROM sales_transaction_items
LIMIT 10;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 026: Add commission tracking to sales - SUCCESS!' AS status;
