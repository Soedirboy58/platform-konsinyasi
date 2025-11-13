-- ============================================
-- QUICK FIX: Set aris.serdadu3g@gmail.com as ADMIN
-- ============================================
-- Copy & paste query ini ke Supabase Dashboard → SQL Editor
-- Lalu klik "Run"
-- ============================================

-- Option 1: Update existing user to ADMIN
-- (Jika user sudah ada di database)
UPDATE profiles
SET 
  role = 'ADMIN',
  updated_at = NOW()
WHERE email = 'aris.serdadu3g@gmail.com';

-- Verify the update
SELECT id, email, full_name, role
FROM profiles
WHERE email = 'aris.serdadu3g@gmail.com';

-- ============================================
-- HASIL YANG DIHARAPKAN:
-- ============================================
-- Jika berhasil, query akan return:
-- - id: (UUID user Anda)
-- - email: aris.serdadu3g@gmail.com
-- - full_name: (nama Anda)
-- - role: ADMIN
--
-- Setelah itu, coba login lagi di:
-- http://localhost:3000/admin/login
-- Email: aris.serdadu3g@gmail.com
-- Password: 123456
-- ============================================

-- ============================================
-- JIKA USER BELUM ADA DI PROFILES TABLE:
-- ============================================
-- Jalankan query ini untuk create profile baru
-- (Pastikan user sudah ada di auth.users)

DO $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Ambil UUID dari auth.users
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = 'aris.serdadu3g@gmail.com'
  LIMIT 1;
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User tidak ditemukan di auth.users. Silakan create user dulu via Supabase Dashboard → Authentication → Users → Add user';
  END IF;
  
  -- Insert atau update profile
  INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    created_at,
    updated_at
  ) VALUES (
    user_uuid,
    'aris.serdadu3g@gmail.com',
    'Aris Admin',
    'ADMIN',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'ADMIN',
    updated_at = NOW();
  
  RAISE NOTICE 'Admin account berhasil dibuat/diupdate untuk: %', 'aris.serdadu3g@gmail.com';
END $$;

-- Verify
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  au.email_confirmed_at
FROM profiles p
JOIN auth.users au ON au.id = p.id
WHERE p.email = 'aris.serdadu3g@gmail.com';
