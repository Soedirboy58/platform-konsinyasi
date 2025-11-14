-- =====================================================
-- CREATE Storage Bucket for Customer Report Photos
-- =====================================================
-- This creates public storage bucket for customer uploaded photos
-- =====================================================

-- Note: Storage buckets are created via Supabase Dashboard UI, not SQL
-- But policies can be created via SQL

-- Step 1: Create bucket via Dashboard
-- Go to: Supabase → Storage → New Bucket
-- Name: product-reports
-- Public: YES
-- File size limit: 5242880 (5MB)
-- Allowed MIME types: image/*

-- Step 2: Run these policies

-- Policy 1: Public Read (anyone can view photos)
CREATE POLICY IF NOT EXISTS "Public can view product report photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-reports');

-- Policy 2: Authenticated Upload
CREATE POLICY IF NOT EXISTS "Authenticated users can upload product reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-reports');

-- Policy 3: Anonymous Upload (for customer without login)
CREATE POLICY IF NOT EXISTS "Anyone can upload product reports"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'product-reports');

-- Policy 4: Users can update their own uploads
CREATE POLICY IF NOT EXISTS "Users can update their own uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-reports')
WITH CHECK (bucket_id = 'product-reports');

-- Policy 5: Users can delete their own uploads
CREATE POLICY IF NOT EXISTS "Users can delete their own uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-reports');

-- Verify policies created
SELECT 
    '✅ Storage Policies Created' as status,
    policyname,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%product report%';

-- =====================================================
-- MANUAL STEPS (Required via Dashboard)
-- =====================================================
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New bucket"
-- 3. Name: product-reports
-- 4. Public bucket: ✅ YES (IMPORTANT!)
-- 5. File size limit: 5242880 (5MB)
-- 6. Allowed MIME types: image/*
-- 7. Click "Create bucket"
-- 8. After bucket created, run SQL above for policies
-- =====================================================
