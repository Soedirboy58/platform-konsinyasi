-- ========================================
-- FIX: Wallet Transactions - Add Missing Transaction Types
-- ========================================
-- Purpose: Add 'SALE' and 'PAYMENT_RECEIVED' to transaction_type constraint
-- ========================================

-- Drop existing constraint
ALTER TABLE wallet_transactions 
DROP CONSTRAINT IF EXISTS check_transaction_type;

-- Add new constraint with additional types
ALTER TABLE wallet_transactions 
ADD CONSTRAINT check_transaction_type 
CHECK (transaction_type IN (
  'CREDIT',            -- General credit
  'DEBIT',             -- General debit
  'COMMISSION',        -- Platform commission
  'WITHDRAWAL',        -- Supplier withdrawal
  'REFUND',            -- Refund to customer
  'ADJUSTMENT',        -- Manual adjustment
  'SALE',              -- Revenue from product sales
  'PAYMENT_RECEIVED'   -- Payment from admin to supplier
));

-- Verify constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'check_transaction_type';

SELECT '✅ Wallet transactions constraint updated with SALE and PAYMENT_RECEIVED' AS status;
