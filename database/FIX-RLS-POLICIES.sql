-- ========================================
-- FIX: RLS Policies - Allow proper access
-- ========================================
-- Problem: Data exists but RLS blocking frontend queries
-- Solution: Recreate policies with correct permissions
-- ========================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Admin can view all returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can create returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can update pending returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier can view own returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier can review own returns" ON shipment_returns;

-- ADMIN POLICIES (full access)
CREATE POLICY "Admin can view all returns"
ON shipment_returns FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
    )
);

CREATE POLICY "Admin can create returns"
ON shipment_returns FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
    )
);

CREATE POLICY "Admin can update all returns"
ON shipment_returns FOR UPDATE
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

CREATE POLICY "Admin can delete returns"
ON shipment_returns FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
    )
);

-- SUPPLIER POLICIES (view & update own only)
CREATE POLICY "Supplier can view own returns"
ON shipment_returns FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM suppliers
        WHERE suppliers.id = shipment_returns.supplier_id
        AND suppliers.profile_id = auth.uid()
    )
);

CREATE POLICY "Supplier can update own returns"
ON shipment_returns FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM suppliers
        WHERE suppliers.id = shipment_returns.supplier_id
        AND suppliers.profile_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM suppliers
        WHERE suppliers.id = shipment_returns.supplier_id
        AND suppliers.profile_id = auth.uid()
    )
);

-- Verify policies created
SELECT 
    '✅ RLS Policies Updated!' AS status;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'shipment_returns'
ORDER BY policyname;
