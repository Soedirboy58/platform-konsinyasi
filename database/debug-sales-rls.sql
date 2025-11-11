-- ========================================
-- CHECK RLS POLICIES: sales_transaction_items
-- ========================================

-- Step 1: Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename = 'sales_transaction_items';

-- Step 2: List all policies on sales_transaction_items
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
WHERE tablename = 'sales_transaction_items'
ORDER BY policyname;

-- Step 3: Check if supplier can read their own sales
-- This is what the frontend query does
SELECT 
    sti.id,
    sti.product_id,
    sti.quantity,
    sti.commission_amount,
    sti.supplier_revenue,
    p.name AS product_name,
    p.supplier_id,
    st.status,
    st.created_at
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE st.status = 'COMPLETED'
LIMIT 5;

-- Step 4: Check if there's a policy blocking supplier access
-- Common issue: RLS enabled but no policy for suppliers to read their own data

-- Check what policies should exist:
SELECT 
    'Expected Policy' AS type,
    'suppliers_read_own_sales' AS policy_name,
    'Suppliers can view sales of their own products' AS purpose,
    'SELECT' AS command,
    'EXISTS (SELECT 1 FROM products WHERE products.id = sales_transaction_items.product_id AND products.supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()))' AS check_clause;

-- Step 5: If no supplier policy exists, here's the fix:
/*
CREATE POLICY "suppliers_read_own_sales"
ON sales_transaction_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM products 
        WHERE products.id = sales_transaction_items.product_id 
          AND products.supplier_id IN (
              SELECT id 
              FROM suppliers 
              WHERE profile_id = auth.uid()
          )
    )
);
*/
