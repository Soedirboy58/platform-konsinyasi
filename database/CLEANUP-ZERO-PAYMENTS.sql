-- ========================================
-- CLEANUP: Zero Net Payment Records
-- ========================================
-- Records with net_payment = 0 are legacy data from before the fix
-- These should not appear in payment history
-- ========================================

-- STEP 1: View records that will be affected
SELECT 
  id,
  supplier_id,
  (SELECT business_name FROM suppliers WHERE id = supplier_payments.supplier_id) as supplier_name,
  gross_sales,
  commission_amount,
  net_payment,
  amount,
  payment_reference,
  payment_date,
  status,
  created_at
FROM supplier_payments
WHERE net_payment = 0
AND created_at >= '2025-11-01'
ORDER BY created_at DESC;

-- STEP 2: Option A - Delete these records (PERMANENT)
-- Uncomment if you want to delete completely
/*
DELETE FROM supplier_payments
WHERE net_payment = 0
AND created_at >= '2025-11-01'
RETURNING id, payment_reference, amount;
*/

-- STEP 3: Option B - Mark as CANCELLED (RECOMMENDED - keeps audit trail)
UPDATE supplier_payments
SET 
  status = 'CANCELLED',
  notes = COALESCE(notes || ' | ', '') || 'Cancelled: Zero net_payment (legacy data before fix)'
WHERE net_payment = 0
AND created_at >= '2025-11-01'
AND status = 'COMPLETED'
RETURNING id, payment_reference, supplier_id, amount;

-- STEP 4: Verify - Check what's left
SELECT 
  status,
  COUNT(*) as count,
  SUM(net_payment) as total_net_payment,
  SUM(amount) as total_amount
FROM supplier_payments
WHERE created_at >= '2025-11-01'
GROUP BY status
ORDER BY status;

-- STEP 5: View current COMPLETED payments only
SELECT 
  id,
  (SELECT business_name FROM suppliers WHERE id = supplier_payments.supplier_id) as supplier_name,
  net_payment,
  payment_reference,
  payment_date,
  created_at
FROM supplier_payments
WHERE created_at >= '2025-11-01'
AND status = 'COMPLETED'
AND net_payment > 0
ORDER BY created_at DESC;
