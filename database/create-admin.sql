-- ============================================
-- CREATE ADMIN USER
-- Run di Supabase SQL Editor
-- ============================================

-- CARA 1: Upgrade user yang sudah ada jadi ADMIN
-- Ganti 'email_anda@gmail.com' dengan email yang sudah terdaftar

UPDATE profiles 
SET role = 'ADMIN' 
WHERE email = 'email_anda@gmail.com';
-- ⬆️ GANTI email_anda@gmail.com dengan email Anda yang sudah registrasi

-- Cek hasilnya
SELECT id, email, role, created_at 
FROM profiles 
WHERE role = 'ADMIN';

-- ============================================
-- CARA 2: Lihat semua user yang ada (untuk cari email)
-- ============================================

SELECT id, email, full_name, role, created_at 
FROM profiles 
ORDER BY created_at DESC;

-- ============================================
-- CARA 3: Upgrade user terakhir jadi admin (jika lupa email)
-- ============================================

-- UPDATE profiles 
-- SET role = 'ADMIN' 
-- WHERE id = (
--   SELECT id FROM profiles 
--   ORDER BY created_at DESC 
--   LIMIT 1
-- );

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
DECLARE
    admin_count INT;
    admin_email TEXT;
BEGIN
    SELECT COUNT(*), MAX(email) INTO admin_count, admin_email
    FROM profiles WHERE role = 'ADMIN';
    
    IF admin_count > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅ ADMIN USER CREATED!';
        RAISE NOTICE '';
        RAISE NOTICE 'Total admin: %', admin_count;
        RAISE NOTICE 'Admin email: %', admin_email;
        RAISE NOTICE '';
        RAISE NOTICE '🔐 Login at: /admin/login';
        RAISE NOTICE 'Use your email and password';
        RAISE NOTICE '';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '❌ NO ADMIN FOUND!';
        RAISE NOTICE '';
        RAISE NOTICE 'Please update the SQL query above with your email';
        RAISE NOTICE '';
    END IF;
END $$;
