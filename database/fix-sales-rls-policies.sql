-- ========================================
-- FIX: Add RLS Policies for sales_transaction_items
-- ========================================
-- Problem: Supplier tidak bisa read sales data karena tidak ada RLS policy
-- Solution: Add policy agar supplier bisa read sales dari produk mereka sendiri
-- ========================================

-- Step 1: Drop existing policies if any (cleanup)
DROP POLICY IF EXISTS "suppliers_read_own_sales" ON sales_transaction_items;
DROP POLICY IF EXISTS "admin_read_all_sales" ON sales_transaction_items;
DROP POLICY IF EXISTS "public_no_access" ON sales_transaction_items;

-- Step 2: Enable RLS (if not already enabled)
ALTER TABLE sales_transaction_items ENABLE ROW LEVEL SECURITY;

-- Step 3: Policy - Suppliers can read sales of their own products
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

-- Step 4: Policy - Admin can read all sales
CREATE POLICY "admin_read_all_sales"
ON sales_transaction_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE profiles.id = auth.uid() 
          AND profiles.role = 'ADMIN'
    )
);

-- Step 5: Policy - System can insert (for checkout function)
CREATE POLICY "system_insert_sales"
ON sales_transaction_items
FOR INSERT
TO authenticated, anon
WITH CHECK (true);

-- Step 6: Policy - Admin can update sales (for corrections)
CREATE POLICY "admin_update_sales"
ON sales_transaction_items
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE profiles.id = auth.uid() 
          AND profiles.role = 'ADMIN'
    )
);

-- ========================================
-- VERIFICATION
-- ========================================

-- List all policies
SELECT 
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'sales_transaction_items'
ORDER BY policyname;

-- Test query (should return data if you're logged in as supplier)
SELECT 
    COUNT(*) AS total_sales_items,
    SUM(sti.quantity) AS total_quantity,
    SUM(sti.supplier_revenue) AS total_revenue
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE st.status = 'COMPLETED';

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'RLS policies for sales_transaction_items created successfully!' AS status;
