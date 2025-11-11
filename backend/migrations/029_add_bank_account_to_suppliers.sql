-- ========================================
-- Migration 029: Add Bank Account to Suppliers
-- ========================================
-- Description: Add bank account information for payment tracking
-- Execute: After migration 028
-- ========================================

-- Step 1: Add bank account fields to suppliers table
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;

-- Add comments
COMMENT ON COLUMN suppliers.bank_name IS 'Nama bank untuk transfer pembayaran';
COMMENT ON COLUMN suppliers.bank_account_number IS 'Nomor rekening supplier';
COMMENT ON COLUMN suppliers.bank_account_holder IS 'Nama pemilik rekening';

-- ========================================
-- VERIFICATION
-- ========================================

-- Check columns exist
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'suppliers'
  AND column_name IN ('bank_name', 'bank_account_number', 'bank_account_holder')
ORDER BY column_name;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 029: Add bank account fields to suppliers - SUCCESS!' AS status;
