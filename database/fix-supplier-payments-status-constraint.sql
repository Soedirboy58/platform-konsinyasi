-- ========================================
-- FIX: Supplier Payments Status Constraint
-- ========================================
-- Purpose: Update status CHECK constraint to support 'COMPLETED'
-- Current: 'PENDING', 'PAID', 'CANCELLED'
-- New: 'PENDING', 'COMPLETED', 'PAID', 'CANCELLED'
-- ========================================

-- Drop existing constraint
ALTER TABLE supplier_payments 
DROP CONSTRAINT IF EXISTS supplier_payments_status_check;

-- Add new constraint with COMPLETED status
ALTER TABLE supplier_payments 
ADD CONSTRAINT supplier_payments_status_check 
CHECK (status IN ('PENDING', 'COMPLETED', 'PAID', 'CANCELLED'));

-- Verify constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'supplier_payments_status_check';

SELECT '✅ Supplier payments status constraint updated!' AS status;
