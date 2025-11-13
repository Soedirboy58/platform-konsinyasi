-- ============================================
-- CREATE CUSTOM ADMIN ACCOUNT
-- Email: delta.sc58@gmail.com
-- Password: 123456
-- Created: 2025-11-12
-- ============================================

-- Step 1: Create auth user
-- Note: Password akan di-hash oleh Supabase Auth
-- Gunakan Supabase Dashboard untuk create user dengan email ini
-- Atau gunakan Supabase CLI: supabase auth signup --email delta.sc58@gmail.com --password 123456

-- Step 2: Get the user_id from auth.users
-- Setelah user dibuat, ambil UUID-nya
-- Query: SELECT id FROM auth.users WHERE email = 'delta.sc58@gmail.com';

-- Step 3: Insert profile dengan role 'ADMIN'
-- REPLACE 'USER_UUID_HERE' dengan UUID yang didapat dari Step 2

-- Example dengan placeholder UUID (HARUS DIGANTI):
INSERT INTO profiles (
  id,
  email,
  full_name,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  'USER_UUID_HERE', -- REPLACE dengan UUID dari auth.users
  'delta.sc58@gmail.com',
  'Delta Admin',
  'ADMIN',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = 'ADMIN',
  is_active = true,
  updated_at = NOW();

-- ============================================
-- ALTERNATIVE: Update existing user to ADMIN
-- Jika user sudah ada tapi role bukan ADMIN
-- ============================================

UPDATE profiles
SET 
  role = 'ADMIN',
  is_active = true,
  updated_at = NOW()
WHERE email = 'delta.sc58@gmail.com';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if user exists in auth.users
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'delta.sc58@gmail.com';

-- Check profile with role
SELECT id, email, full_name, role, is_active 
FROM profiles 
WHERE email = 'delta.sc58@gmail.com';

-- ============================================
-- MANUAL STEPS via Supabase Dashboard
-- ============================================

/*
1. Login ke Supabase Dashboard (supabase.com)
2. Pilih project Anda
3. Go to "Authentication" → "Users"
4. Klik "Add user" (manual)
5. Isi form:
   - Email: delta.sc58@gmail.com
   - Password: 123456
   - Auto Confirm User: ✓ (checked)
6. Klik "Create user"
7. Copy UUID user yang baru dibuat
8. Go to "SQL Editor"
9. Jalankan query UPDATE di atas untuk set role = 'ADMIN'
*/

-- ============================================
-- QUICK FIX: Update any existing user
-- ============================================

-- Jika user delta.sc58@gmail.com sudah ada di auth.users
-- tapi belum ada di profiles atau role salah:

DO $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Get UUID dari auth.users
  SELECT id INTO user_uuid 
  FROM auth.users 
  WHERE email = 'delta.sc58@gmail.com';
  
  IF user_uuid IS NOT NULL THEN
    -- Insert atau update profile
    INSERT INTO profiles (
      id,
      email,
      full_name,
      role,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      user_uuid,
      'delta.sc58@gmail.com',
      'Delta Admin',
      'ADMIN',
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'ADMIN',
      is_active = true,
      updated_at = NOW();
    
    RAISE NOTICE 'Admin account updated successfully for %', 'delta.sc58@gmail.com';
  ELSE
    RAISE NOTICE 'User not found in auth.users. Please create user first via Supabase Dashboard.';
  END IF;
END $$;
