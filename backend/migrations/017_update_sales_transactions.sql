-- ========================================
-- Migration: Update sales_transactions for Kantin Checkout
-- ========================================
-- Description: Add transaction_code and status columns
-- Execute: After migration 011
-- ========================================

-- Add transaction_code column
ALTER TABLE sales_transactions 
ADD COLUMN IF NOT EXISTS transaction_code TEXT UNIQUE;

-- Add status column
ALTER TABLE sales_transactions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING' 
CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED'));

-- Add total_amount column (for kantin checkout)
ALTER TABLE sales_transactions 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15,2);

-- Add updated_at column
ALTER TABLE sales_transactions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for transaction_code
CREATE INDEX IF NOT EXISTS idx_sales_transactions_code 
ON sales_transactions(transaction_code) WHERE transaction_code IS NOT NULL;

-- Create index for status
CREATE INDEX IF NOT EXISTS idx_sales_transactions_status 
ON sales_transactions(status);

-- Make some columns nullable for kantin checkout (no supplier involved)
ALTER TABLE sales_transactions 
ALTER COLUMN supplier_id DROP NOT NULL,
ALTER COLUMN product_id DROP NOT NULL,
ALTER COLUMN cost_price DROP NOT NULL,
ALTER COLUMN commission_rate DROP DEFAULT,
ALTER COLUMN commission_amount DROP NOT NULL,
ALTER COLUMN total_revenue DROP NOT NULL;

-- Add comments
COMMENT ON COLUMN sales_transactions.transaction_code IS 'Unique transaction code for kantin checkout (e.g., KNT-20250110-123456)';
COMMENT ON COLUMN sales_transactions.status IS 'Transaction status: PENDING, COMPLETED, CANCELLED';
COMMENT ON COLUMN sales_transactions.total_amount IS 'Total transaction amount for kantin checkout';

-- ========================================
-- VERIFICATION
-- ========================================

-- Check columns
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'sales_transactions'
  AND column_name IN ('transaction_code', 'status', 'total_amount', 'updated_at')
ORDER BY column_name;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 017: sales_transactions schema update - SUCCESS!' AS status;
