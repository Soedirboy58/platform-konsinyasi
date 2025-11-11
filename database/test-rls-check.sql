-- ============================================
-- TEST SCRIPT - CEK APAKAH RLS SUDAH FIX
-- Run di Supabase SQL Editor
-- ============================================

-- 1. Cek apakah helper functions masih ada (HARUS KOSONG!)
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'auth'
AND routine_name IN ('get_user_role', 'is_admin', 'is_supplier', 'get_supplier_id');

-- Hasil HARUS KOSONG! Jika masih ada, berarti fix belum jalan!

-- 2. Cek policies di table profiles (HARUS ADA 3 SAJA)
SELECT 
    policyname,
    cmd as command_type,
    qual as using_expression
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname;

-- Hasil HARUS:
-- profiles_public_read (SELECT)
-- profiles_user_insert (INSERT) 
-- profiles_user_update (UPDATE)

-- 3. Cek policies di table suppliers (HARUS ADA 4 SAJA)
SELECT 
    policyname,
    cmd as command_type
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'suppliers'
ORDER BY policyname;

-- Hasil HARUS:
-- suppliers_owner_read (SELECT)
-- suppliers_owner_update (UPDATE)
-- suppliers_public_read_approved (SELECT)
-- suppliers_user_insert (INSERT)

-- 4. Cek apakah masih ada policies dengan nama "Admins" (HARUS KOSONG!)
SELECT 
    tablename,
    policyname
FROM pg_policies
WHERE schemaname = 'public' 
AND policyname LIKE '%Admins%'
ORDER BY tablename, policyname;

-- Hasil HARUS KOSONG! Jika masih ada, policies lama belum dihapus!

-- ============================================
-- INTERPRETASI HASIL:
-- ============================================
-- ✅ Query 1 = KOSONG → Helper functions sudah dihapus
-- ❌ Query 1 = ADA DATA → Helper functions masih ada, fix BELUM jalan!
--
-- ✅ Query 2 = 3 rows → Profiles policies sudah benar
-- ❌ Query 2 = lebih dari 3 → Policies lama masih ada
--
-- ✅ Query 3 = 4 rows → Suppliers policies sudah benar  
-- ❌ Query 3 = lebih dari 4 → Policies lama masih ada
--
-- ✅ Query 4 = KOSONG → Semua policies recursive sudah dihapus
-- ❌ Query 4 = ADA DATA → Policies recursive masih ada!
-- ============================================
