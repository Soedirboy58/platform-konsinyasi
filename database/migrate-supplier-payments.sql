-- ========================================
-- ALTER: Supplier Payment Table - Add Missing Columns
-- ========================================
-- Purpose: Add missing columns to existing supplier_payments table
-- This is a SAFE migration that preserves existing data
-- ========================================

-- Check existing table structure first
DO $$ 
BEGIN
    RAISE NOTICE 'Starting migration for supplier_payments table...';
END $$;

-- Add payment_reference column (UNIQUE constraint)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'payment_reference'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN payment_reference VARCHAR(100);
        RAISE NOTICE 'Added column: payment_reference';
    ELSE
        RAISE NOTICE 'Column payment_reference already exists, skipping...';
    END IF;
END $$;

-- Add wallet_id column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'wallet_id'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN wallet_id UUID REFERENCES supplier_wallets(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added column: wallet_id';
    ELSE
        RAISE NOTICE 'Column wallet_id already exists, skipping...';
    END IF;
END $$;

-- Add payment_method column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN payment_method VARCHAR(50) DEFAULT 'BANK_TRANSFER';
        RAISE NOTICE 'Added column: payment_method';
    ELSE
        RAISE NOTICE 'Column payment_method already exists, skipping...';
    END IF;
END $$;

-- Add bank_name column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'bank_name'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN bank_name VARCHAR(100);
        RAISE NOTICE 'Added column: bank_name';
    ELSE
        RAISE NOTICE 'Column bank_name already exists, skipping...';
    END IF;
END $$;

-- Add bank_account_number column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'bank_account_number'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN bank_account_number VARCHAR(50);
        RAISE NOTICE 'Added column: bank_account_number';
    ELSE
        RAISE NOTICE 'Column bank_account_number already exists, skipping...';
    END IF;
END $$;

-- Add bank_account_holder column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'bank_account_holder'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN bank_account_holder VARCHAR(200);
        RAISE NOTICE 'Added column: bank_account_holder';
    ELSE
        RAISE NOTICE 'Column bank_account_holder already exists, skipping...';
    END IF;
END $$;

-- Add payment_proof_url column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'payment_proof_url'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN payment_proof_url TEXT;
        RAISE NOTICE 'Added column: payment_proof_url';
    ELSE
        RAISE NOTICE 'Column payment_proof_url already exists, skipping...';
    END IF;
END $$;

-- Add notes column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'notes'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN notes TEXT;
        RAISE NOTICE 'Added column: notes';
    ELSE
        RAISE NOTICE 'Column notes already exists, skipping...';
    END IF;
END $$;

-- Add period_start column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'period_start'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN period_start DATE;
        RAISE NOTICE 'Added column: period_start';
    ELSE
        RAISE NOTICE 'Column period_start already exists, skipping...';
    END IF;
END $$;

-- Add period_end column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'period_end'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN period_end DATE;
        RAISE NOTICE 'Added column: period_end';
    ELSE
        RAISE NOTICE 'Column period_end already exists, skipping...';
    END IF;
END $$;

-- Add created_by column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN created_by UUID REFERENCES profiles(id);
        RAISE NOTICE 'Added column: created_by';
    ELSE
        RAISE NOTICE 'Column created_by already exists, skipping...';
    END IF;
END $$;

-- Add updated_at column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE supplier_payments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added column: updated_at';
    ELSE
        RAISE NOTICE 'Column updated_at already exists, skipping...';
    END IF;
END $$;

-- ========================================
-- Add Constraints & Indexes
-- ========================================

-- Add UNIQUE constraint to payment_reference if column exists and constraint doesn't
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'payment_reference'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'supplier_payments_payment_reference_key'
    ) THEN
        -- First, ensure no duplicate values exist
        UPDATE supplier_payments 
        SET payment_reference = 'LEGACY-' || id::text
        WHERE payment_reference IS NULL;
        
        -- Add unique constraint
        ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payments_payment_reference_key UNIQUE (payment_reference);
        RAISE NOTICE 'Added UNIQUE constraint on payment_reference';
    ELSE
        RAISE NOTICE 'UNIQUE constraint on payment_reference already exists or column missing, skipping...';
    END IF;
END $$;

-- Create indexes if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_supplier_payments_reference'
    ) THEN
        CREATE INDEX idx_supplier_payments_reference ON supplier_payments(payment_reference);
        RAISE NOTICE 'Created index: idx_supplier_payments_reference';
    ELSE
        RAISE NOTICE 'Index idx_supplier_payments_reference already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_supplier_payments_supplier'
    ) THEN
        CREATE INDEX idx_supplier_payments_supplier ON supplier_payments(supplier_id);
        RAISE NOTICE 'Created index: idx_supplier_payments_supplier';
    ELSE
        RAISE NOTICE 'Index idx_supplier_payments_supplier already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_supplier_payments_date'
    ) THEN
        CREATE INDEX idx_supplier_payments_date ON supplier_payments(payment_date DESC);
        RAISE NOTICE 'Created index: idx_supplier_payments_date';
    ELSE
        RAISE NOTICE 'Index idx_supplier_payments_date already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_supplier_payments_status'
    ) THEN
        CREATE INDEX idx_supplier_payments_status ON supplier_payments(status);
        RAISE NOTICE 'Created index: idx_supplier_payments_status';
    ELSE
        RAISE NOTICE 'Index idx_supplier_payments_status already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_supplier_payments_created'
    ) THEN
        CREATE INDEX idx_supplier_payments_created ON supplier_payments(created_at DESC);
        RAISE NOTICE 'Created index: idx_supplier_payments_created';
    ELSE
        RAISE NOTICE 'Index idx_supplier_payments_created already exists, skipping...';
    END IF;
END $$;

-- ========================================
-- Create/Update Trigger for updated_at
-- ========================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_supplier_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_supplier_payments_updated_at ON supplier_payments;

-- Create new trigger
CREATE TRIGGER trigger_supplier_payments_updated_at
    BEFORE UPDATE ON supplier_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_payments_updated_at();

DO $$ 
BEGIN
    RAISE NOTICE 'Created/Updated trigger: trigger_supplier_payments_updated_at';
END $$;

-- ========================================
-- Add Comments
-- ========================================

COMMENT ON TABLE supplier_payments IS 'Tracks manual bank transfer payments from admin to suppliers';
COMMENT ON COLUMN supplier_payments.amount IS 'Amount transferred to supplier';

-- Add column comments only if column exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'payment_reference'
    ) THEN
        COMMENT ON COLUMN supplier_payments.payment_reference IS 'Unique payment reference number (e.g., TRF-20241113-001-KBI)';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'payment_method'
    ) THEN
        COMMENT ON COLUMN supplier_payments.payment_method IS 'Payment method used (BANK_TRANSFER, CASH, etc)';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'period_start'
    ) THEN
        COMMENT ON COLUMN supplier_payments.period_start IS 'Start date of commission period covered by this payment';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'supplier_payments' AND column_name = 'period_end'
    ) THEN
        COMMENT ON COLUMN supplier_payments.period_end IS 'End date of commission period covered by this payment';
    END IF;
END $$;

-- ========================================
-- Verify Migration
-- ========================================

DO $$ 
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'supplier_payments';
    
    RAISE NOTICE '✅ Migration completed! Total columns in supplier_payments: %', col_count;
END $$;

-- Show current structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'supplier_payments'
ORDER BY ordinal_position;

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

SELECT '✅ Supplier payments table migration completed successfully!' AS status;
