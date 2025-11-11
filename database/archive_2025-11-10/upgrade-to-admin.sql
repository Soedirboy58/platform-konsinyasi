-- ============================================
-- UPGRADE USER PERTAMA JADI ADMIN
-- Run di Supabase SQL Editor
-- ============================================

-- Upgrade user pertama (satu-satunya) jadi ADMIN
UPDATE profiles 
SET role = 'ADMIN' 
WHERE id = (
  SELECT id FROM profiles 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- Cek hasilnya
SELECT id, email, full_name, role, created_at 
FROM profiles;

-- Success message
DO $$
DECLARE
    admin_email TEXT;
BEGIN
    SELECT email INTO admin_email
    FROM profiles WHERE role = 'ADMIN'
    LIMIT 1;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅✅✅ USER UPGRADED TO ADMIN! ✅✅✅';
    RAISE NOTICE '';
    RAISE NOTICE 'Admin email: %', admin_email;
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Login at: /admin/login';
    RAISE NOTICE 'Use your email: %', admin_email;
    RAISE NOTICE 'Use your password from registration';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ NOTE: Sekarang user ini bisa login sebagai:';
    RAISE NOTICE '   - Admin di /admin/login';
    RAISE NOTICE '   - Tapi TIDAK bisa login sebagai supplier';
    RAISE NOTICE '   - Kalau mau supplier, buat user baru di /supplier/login';
    RAISE NOTICE '';
END $$;
