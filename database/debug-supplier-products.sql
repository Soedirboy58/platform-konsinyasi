-- DEBUG: Check approved products for current logged-in supplier
-- Run this when logged in as supplier

-- 1. Your supplier ID
SELECT 
  id as supplier_id,
  business_name,
  status as supplier_status,
  profile_id
FROM suppliers
WHERE profile_id = auth.uid();

-- 2. Your APPROVED products (what frontend should fetch)
SELECT 
  p.id,
  p.name,
  p.barcode,
  p.status,
  p.supplier_id,
  p.created_at
FROM products p
WHERE p.supplier_id IN (
  SELECT id FROM suppliers WHERE profile_id = auth.uid()
)
AND p.status = 'APPROVED'
ORDER BY p.created_at DESC;

-- 3. All your products (including PENDING)
SELECT 
  p.id,
  p.name,
  p.barcode,
  p.status,
  p.supplier_id
FROM products p
WHERE p.supplier_id IN (
  SELECT id FROM suppliers WHERE profile_id = auth.uid()
)
ORDER BY p.status, p.name;

-- 4. Test the exact query frontend uses
-- This should return same as what frontend sees
WITH supplier_info AS (
  SELECT id FROM suppliers WHERE profile_id = auth.uid()
)
SELECT 
  id,
  name,
  barcode
FROM products
WHERE supplier_id = (SELECT id FROM supplier_info)
  AND status = 'APPROVED';
