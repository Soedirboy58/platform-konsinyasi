-- QUICK FIX: Approve all pending products
-- Use this ONLY for development/testing

UPDATE products
SET status = 'APPROVED'
WHERE status = 'PENDING';

-- Check result
SELECT 
  status,
  COUNT(*) as total
FROM products
GROUP BY status;
