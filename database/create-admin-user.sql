-- Create or Update Admin User
-- Run this in Supabase SQL Editor

-- STEP 1: Check all existing users
SELECT 
  id,
  email,
  full_name,
  role,
  is_active,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- STEP 2: Update existing user to be admin (REPLACE EMAIL BELOW!)
-- Uncomment and update with your actual email:

-- UPDATE profiles 
-- SET role = 'ADMIN', is_active = true
-- WHERE email = 'YOUR_EMAIL@example.com';

-- STEP 3: If you need to create new admin user manually in Supabase Dashboard:
-- 1. Go to Authentication > Users
-- 2. Click "Add User"
-- 3. Enter email and password
-- 4. After user created, get the user ID from auth.users
-- 5. Run this (replace USER_ID and EMAIL):

-- INSERT INTO profiles (id, email, full_name, role, is_active)
-- VALUES (
--   'USER_ID_FROM_AUTH',
--   'admin@example.com',
--   'Admin Platform',
--   'ADMIN',
--   true
-- )
-- ON CONFLICT (id) DO UPDATE
-- SET role = 'ADMIN', is_active = true;

-- STEP 4: Verify admin exists
SELECT 
  id,
  email,
  full_name,
  role,
  is_active
FROM profiles
WHERE role = 'ADMIN';
