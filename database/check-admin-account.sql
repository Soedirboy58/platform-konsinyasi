-- Check and Fix Admin Account
-- Find your admin account and set role to ADMIN

-- Step 1: Check current admin accounts
SELECT 
  id,
  email,
  role,
  business_name,
  status,
  created_at
FROM profiles
WHERE role = 'ADMIN' OR email ILIKE '%admin%'
ORDER BY created_at DESC;

-- Step 2: If you need to make someone admin, uncomment and update email below:
-- UPDATE profiles 
-- SET role = 'ADMIN', status = 'APPROVED'
-- WHERE email = 'YOUR_ADMIN_EMAIL@example.com';

-- Step 3: Verify the update
-- SELECT id, email, role, status FROM profiles WHERE role = 'ADMIN';
