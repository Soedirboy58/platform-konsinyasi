-- ========================================
-- TEMPORARY: Disable RLS for Testing
-- ========================================
-- This will help us confirm if RLS is the problem
-- RUN THIS FIRST, then test frontend
-- ========================================

-- Disable RLS temporarily
ALTER TABLE shipment_returns DISABLE ROW LEVEL SECURITY;

SELECT '⚠️  RLS DISABLED - Frontend should work now!' AS status;
SELECT 'Test frontend, then re-enable with ENABLE ROW LEVEL SECURITY' AS next_step;

-- To re-enable later:
-- ALTER TABLE shipment_returns ENABLE ROW LEVEL SECURITY;
