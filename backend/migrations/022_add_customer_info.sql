-- ========================================
-- Migration: Anti-Fraud untuk Manual Payment
-- ========================================
-- Description: Tambah customer_name untuk tracking
-- Execute: After migration 021
-- ========================================

-- Add customer contact columns
ALTER TABLE sales_transactions
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Add admin verification columns (reference profiles, not admins)
ALTER TABLE sales_transactions
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Create index
CREATE INDEX IF NOT EXISTS idx_sales_transactions_status_created 
ON sales_transactions(status, created_at DESC);

-- Add comments
COMMENT ON COLUMN sales_transactions.customer_name IS 'Customer name for manual verification';
COMMENT ON COLUMN sales_transactions.customer_phone IS 'Customer phone for confirmation';
COMMENT ON COLUMN sales_transactions.verified_by IS 'Admin who verified payment';
COMMENT ON COLUMN sales_transactions.verified_at IS 'When payment was verified';

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 022: Anti-fraud columns added - SUCCESS!' AS status;
