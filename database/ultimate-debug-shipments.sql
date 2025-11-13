-- ========================================
-- ULTIMATE DEBUG: Why Admin See No Shipments
-- ========================================

-- STEP 1: Check if ANY stock_movements exist
SELECT 
  COUNT(*) as total_movements,
  COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
  COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_count
FROM stock_movements;

-- STEP 2: Show ALL stock movements (without RLS)
-- Run this as POSTGRES/ADMIN user (not through Supabase client)
SELECT 
  sm.id,
  sm.supplier_id,
  sm.location_id,
  sm.status,
  sm.created_at,
  s.business_name,
  l.name as location_name
FROM stock_movements sm
LEFT JOIN suppliers s ON s.id = sm.supplier_id
LEFT JOIN locations l ON l.id = sm.location_id
ORDER BY sm.created_at DESC
LIMIT 10;

-- STEP 3: Check RLS is actually applied
SELECT 
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE tablename IN ('stock_movements', 'stock_movement_items');

-- STEP 4: Verify admin user role
SELECT 
  id,
  email,
  role
FROM profiles
WHERE email = 'aris.serdadu3g@gmail.com';

-- STEP 5: Test RLS as admin (simulate frontend query)
-- This tests if RLS allows admin to see data
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "ADMIN_USER_ID_HERE", "role": "authenticated"}';

SELECT 
  sm.id,
  sm.status,
  s.business_name
FROM stock_movements sm
LEFT JOIN suppliers s ON s.id = sm.supplier_id
ORDER BY sm.created_at DESC
LIMIT 5;

-- ========================================
-- INTERPRETATION:
-- ========================================

-- If STEP 1 returns 0:
--   → No shipments in database
--   → Supplier needs to submit shipment

-- If STEP 2 shows data but frontend empty:
--   → RLS blocking admin
--   → Check STEP 3 and STEP 4

-- If tablename rowsecurity = TRUE:
--   → RLS is enabled (correct)
--   → Policies must allow admin SELECT

-- If admin role is NOT 'ADMIN':
--   → Update profile: UPDATE profiles SET role = 'ADMIN' WHERE email = '...'

-- ========================================
