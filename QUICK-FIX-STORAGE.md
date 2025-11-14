# 🚀 QUICK FIX: Setup Storage & Notifications

## Problem Identified:
✅ Return created successfully  
❌ **Bucket not found** → Photos not uploaded → `proof_photos = []`  
❌ **Notifications failed** → RPC functions use wrong column name

---

## 🔧 Solution (3 Steps):

### Step 1: Create Storage Bucket (CRITICAL)

1. Open **Supabase Dashboard** → **Storage**
2. Click **"New bucket"** button
3. Fill form:
   ```
   Name: product-reports
   Public bucket: ✅ YES (CHECK THIS!)
   File size limit: 5242880
   Allowed MIME types: image/*
   ```
4. Click **"Create bucket"**

### Step 2: Set Storage Policies

After bucket created, go to **SQL Editor** and run:

```sql
-- Policy 1: Public Read
CREATE POLICY "Public can view product report photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-reports');

-- Policy 2: Anonymous Upload (for customers)
CREATE POLICY "Anyone can upload product reports"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'product-reports');

-- Policy 3: Authenticated Upload
CREATE POLICY "Authenticated users can upload product reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-reports');
```

### Step 3: Fix & Run Notification RPC

First, check your notifications table column:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'notifications';
```

**If you see `profile_id`** (most likely), run the FIXED version:

📁 **File: `database/CREATE-CUSTOMER-REPORT-NOTIFICATIONS.sql`** (already updated)

Copy the entire content and run in **SQL Editor**.

**If you see `user_id`**, use original version (no changes needed).

---

## 🧪 Test Again:

After setup complete:

1. Go to `/kantin/[slug]`
2. Click **"😟 Ada Masalah?"**
3. Upload 1-3 photos
4. Submit

**Expected Console Output:**
```
✅ Return created successfully: {...}
📸 Uploaded photo URLs: ["https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/product-reports/..."]
📸 Stored proof_photos: ["https://..."]
```

**No more errors:**
- ✅ No "Bucket not found"
- ✅ No "column user_id does not exist"

**In Admin Modal:**
```
🔍 CUSTOMER Return Data: {...}
📸 proof_photos: ["https://..."]
📸 Type: "object"
📸 Is Array: true
📸 Length: 1

[Modal shows photo gallery]
```

---

## ✅ Verification Checklist:

- [ ] Storage bucket `product-reports` created
- [ ] Bucket is PUBLIC (important!)
- [ ] Storage policies added
- [ ] RPC functions executed (with correct column name)
- [ ] New customer report submitted WITH photos
- [ ] Console shows uploaded photo URLs
- [ ] Admin modal displays photos

---

## 🎯 Summary:

**Root cause:** Infrastructure belum setup
- Missing storage bucket
- Missing RPC functions

**Fix:** Setup storage + run migrations
- Create public bucket
- Add storage policies  
- Run corrected RPC functions

**Result:** Photos akan ter-upload dan muncul di modal! 📸✨

---

Silakan setup bucket dulu, lalu test ulang dengan upload foto baru! 🚀
