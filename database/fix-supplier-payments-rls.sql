-- ========================================
-- FIX: Supplier Payments RLS Policies
-- ========================================
-- Purpose: Add RLS policies for supplier_payments table
-- ========================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin can insert supplier payments" ON supplier_payments;
DROP POLICY IF EXISTS "Admin can view all supplier payments" ON supplier_payments;
DROP POLICY IF EXISTS "Admin can update supplier payments" ON supplier_payments;
DROP POLICY IF EXISTS "Admin can delete supplier payments" ON supplier_payments;
DROP POLICY IF EXISTS "Suppliers can view their own payments" ON supplier_payments;

-- Enable RLS (if not already enabled)
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Admin Policies (Full Access)
-- ========================================

-- Admin can INSERT payment records
CREATE POLICY "Admin can insert supplier payments"
ON supplier_payments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Admin can VIEW all payment records
CREATE POLICY "Admin can view all supplier payments"
ON supplier_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Admin can UPDATE payment records
CREATE POLICY "Admin can update supplier payments"
ON supplier_payments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- Admin can DELETE payment records
CREATE POLICY "Admin can delete supplier payments"
ON supplier_payments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'ADMIN'
  )
);

-- ========================================
-- Supplier Policies (Read-Only Own Data)
-- ========================================

-- Suppliers can VIEW their own payment records
CREATE POLICY "Suppliers can view their own payments"
ON supplier_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    JOIN suppliers s ON s.profile_id = p.id
    WHERE p.id = auth.uid()
    AND p.role = 'SUPPLIER'
    AND s.id = supplier_payments.supplier_id
  )
);

-- ========================================
-- Verify Policies
-- ========================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ RLS policies for supplier_payments created successfully!';
END $$;

-- Show all policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'supplier_payments'
ORDER BY policyname;

SELECT '✅ Supplier payments RLS policies configured!' AS status;
