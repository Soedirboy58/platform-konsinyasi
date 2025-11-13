-- =====================================================
-- DEBUG: Kenapa Data Retur Masih Gagal Dimuat?
-- =====================================================
-- Jalankan query ini satu per satu di Supabase SQL Editor
-- untuk mencari tahu kenapa frontend masih kosong
-- =====================================================

-- ===== STEP 1: BASIC CHECKS =====
-- Cek apakah data masih ada
SELECT 
    '📊 CHECK 1: Data Count' as check_name,
    COUNT(*) as total_returns,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending_returns,
    COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_returns
FROM shipment_returns;

-- Lihat sample data
SELECT 
    '📋 CHECK 2: Sample Data' as check_name,
    id,
    product_id,
    quantity,
    reason,
    status,
    requested_at
FROM shipment_returns
LIMIT 5;

-- ===== STEP 2: RLS STATUS =====
-- Cek apakah RLS masih disabled atau sudah enabled
SELECT 
    '🔒 CHECK 3: RLS Status' as check_name,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '⚠️ RLS ENABLED - might be blocking'
        ELSE '✅ RLS DISABLED - should work'
    END as status_message
FROM pg_tables
WHERE tablename = 'shipment_returns';

-- ===== STEP 3: RLS POLICIES (jika RLS enabled) =====
-- Lihat semua policies yang ada
SELECT 
    '📜 CHECK 4: RLS Policies' as check_name,
    policyname,
    cmd as operation,
    permissive,
    roles,
    CASE 
        WHEN cmd = 'SELECT' THEN '👁️ View Policy'
        WHEN cmd = 'INSERT' THEN '➕ Create Policy'
        WHEN cmd = 'UPDATE' THEN '✏️ Update Policy'
        WHEN cmd = 'DELETE' THEN '🗑️ Delete Policy'
    END as policy_type
FROM pg_policies
WHERE tablename = 'shipment_returns'
ORDER BY cmd, policyname;

-- ===== STEP 4: CHECK USER ROLE =====
-- Cek role user yang sedang login (ganti dengan user ID Anda)
SELECT 
    '👤 CHECK 5: Current User Role' as check_name,
    id as user_id,
    email,
    role,
    full_name,
    CASE 
        WHEN role = 'ADMIN' THEN '✅ Should see all returns'
        WHEN role = 'SUPPLIER' THEN '⚠️ Only see own products returns'
        ELSE '❌ No access to returns'
    END as access_level
FROM profiles
WHERE id = auth.uid(); -- Ini akan otomatis gunakan user yang login

-- ===== STEP 5: TEST QUERY WITH JOINS (seperti di frontend) =====
-- Simulasi query frontend dengan semua JOINs
SELECT 
    '🔍 CHECK 6: Frontend Query Simulation' as check_name,
    sr.id,
    sr.quantity,
    sr.reason,
    sr.status,
    sr.requested_at,
    p.name as product_name,
    l.name as location_name,
    s.business_name as supplier_name
FROM shipment_returns sr
LEFT JOIN products p ON p.id = sr.product_id
LEFT JOIN locations l ON l.id = sr.location_id
LEFT JOIN suppliers s ON s.id = (SELECT supplier_id FROM products WHERE id = sr.product_id)
ORDER BY sr.requested_at DESC
LIMIT 5;

-- ===== STEP 6: CHECK SUPPLIER_ID COLUMN =====
-- Apakah kolom supplier_id ada di shipment_returns?
SELECT 
    '📋 CHECK 7: Table Columns' as check_name,
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name = 'supplier_id' THEN '✅ FOUND - Good!'
        WHEN column_name = 'product_id' THEN '✅ FOUND - Good!'
        ELSE '📝 Info'
    END as note
FROM information_schema.columns
WHERE table_name = 'shipment_returns'
ORDER BY ordinal_position;

-- ===== STEP 7: CHECK FOREIGN KEYS =====
-- Apakah ada FK constraint issues?
SELECT 
    '🔗 CHECK 8: Foreign Keys' as check_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'shipment_returns'
AND tc.constraint_type = 'FOREIGN KEY';

-- ===== STEP 8: TEST DENGAN RLS BYPASS (jika RLS enabled) =====
-- Temporary disable RLS untuk test (ADMIN ONLY)
-- JANGAN LAKUKAN INI KECUALI ANDA ADMIN DATABASE!
-- ALTER TABLE shipment_returns DISABLE ROW LEVEL SECURITY;
-- SELECT COUNT(*) FROM shipment_returns;
-- ALTER TABLE shipment_returns ENABLE ROW LEVEL SECURITY;

-- ===== DIAGNOSTIC SUMMARY =====
SELECT 
    '🎯 DIAGNOSTIC SUMMARY' as summary,
    (SELECT COUNT(*) FROM shipment_returns) as total_data,
    (SELECT rowsecurity FROM pg_tables WHERE tablename = 'shipment_returns') as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'shipment_returns') as total_policies,
    (SELECT role FROM profiles WHERE id = auth.uid()) as current_user_role;

-- =====================================================
-- EXPECTED RESULTS
-- =====================================================
-- CHECK 1: Should show 6 returns (or more if you added data)
-- CHECK 2: Should show sample data with product names
-- CHECK 3: RLS should be DISABLED (false) for testing
-- CHECK 4: Should show policies if RLS enabled
-- CHECK 5: Should show your user role (ADMIN or SUPPLIER)
-- CHECK 6: Should return data with JOINs working
-- CHECK 7: Should show supplier_id column exists
-- CHECK 8: Should show FK relationships

-- =====================================================
-- TROUBLESHOOTING GUIDE
-- =====================================================
-- 
-- IF CHECK 1 returns 0 rows:
--   → Data hilang! Re-run insert queries atau buat return baru
--
-- IF CHECK 3 shows RLS ENABLED:
--   → RLS might be blocking! Check policies in CHECK 4
--   → Try DISABLE-RLS-TEST.sql
--
-- IF CHECK 5 shows wrong role:
--   → Login dengan akun ADMIN yang benar
--
-- IF CHECK 6 returns error:
--   → JOIN issues atau missing columns
--   → Check error message for specific column
--
-- IF CHECK 7 missing supplier_id:
--   → Column doesn't exist, might need migration
--
-- IF everything looks OK but frontend empty:
--   → Check browser console (F12) for errors
--   → Check Network tab for API response
--   → Verify Vercel deployment finished
--
-- =====================================================

-- 🚨 QUICK FIX: Jika RLS enabled, disable sementara
-- ALTER TABLE shipment_returns DISABLE ROW LEVEL SECURITY;

-- 🔄 RE-ENABLE dengan policies yang benar
-- Jalankan file: ENABLE-RLS-FIXED.sql
