-- Migration 050: Add paid_at column to supplier_payments
-- Fix error: record "new" has no field "paid_at" in trigger notify_supplier_payment_received()

ALTER TABLE supplier_payments
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Backfill: set paid_at = updated_at for existing COMPLETED/PAID payments
UPDATE supplier_payments
SET paid_at = COALESCE(paid_at, updated_at, created_at)
WHERE status IN ('COMPLETED', 'PAID')
  AND paid_at IS NULL;

SELECT 'Migration 050 COMPLETE: paid_at column added to supplier_payments' AS status;
