-- Check products status and supplier mapping
-- Run this to see why products not showing in dropdown

-- 1. Check all products with their status and supplier
SELECT 
  p.id,
  p.name,
  p.sku,
  p.status,
  p.supplier_id,
  s.business_name as supplier_name,
  s.status as supplier_status
FROM products p
LEFT JOIN suppliers s ON s.id = p.supplier_id
ORDER BY p.created_at DESC;

-- 2. Count products by status
SELECT 
  status,
  COUNT(*) as total
FROM products
GROUP BY status;

-- 3. Check APPROVED products only
SELECT 
  id,
  name,
  sku,
  supplier_id,
  status
FROM products
WHERE status = 'APPROVED'
ORDER BY name;

-- 4. Check your supplier ID and products
SELECT 
  'Your Supplier ID' as info,
  s.id as supplier_id,
  s.business_name,
  COUNT(p.id) as total_products,
  SUM(CASE WHEN p.status = 'APPROVED' THEN 1 ELSE 0 END) as approved_products,
  SUM(CASE WHEN p.status = 'PENDING' THEN 1 ELSE 0 END) as pending_products
FROM suppliers s
LEFT JOIN products p ON p.supplier_id = s.id
WHERE s.profile_id = auth.uid()
GROUP BY s.id, s.business_name;
