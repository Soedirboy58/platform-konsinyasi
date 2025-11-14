-- =====================================================
-- QUICK FIX: Disable RLS Temporarily for Testing
-- =====================================================
-- Jalankan ini untuk bypass RLS dan test frontend
-- Setelah confirm data muncul, kita bisa fix policies
-- =====================================================

-- Disable RLS
ALTER TABLE shipment_returns DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT 
    '✅ RLS Disabled' as status,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'shipment_returns';
-- Expected: rls_enabled = false

-- Test query (should work now without any policies)
SELECT 
    '🧪 Test Query' as test,
    COUNT(*) as total_returns
FROM shipment_returns;

-- =====================================================
-- AFTER TESTING:
-- =====================================================
-- 1. Refresh frontend - data should appear
-- 2. If data appears: RLS was the issue
-- 3. Then run FORCE-FIX-RLS-CLEAN.sql to re-enable properly
-- 4. Re-enable RLS:
--    ALTER TABLE shipment_returns ENABLE ROW LEVEL SECURITY;
-- =====================================================
