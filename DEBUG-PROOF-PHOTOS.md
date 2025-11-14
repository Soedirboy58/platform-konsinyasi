# 🔍 Debug Checklist: Proof Photos Not Showing

## Status: Debugging

### Changes Made:
1. ✅ Created `ADD-PROOF-PHOTOS-COLUMN.sql` migration
2. ✅ User executed migration in Supabase
3. ✅ User submitted new customer report
4. ❌ Photos still not showing in modal
5. ✅ Added debug console logs (commit c89854c)

---

## 🧪 Testing Steps

### Step 1: Verify Database Column Exists
Go to **Supabase → SQL Editor** and run:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'shipment_returns'
AND column_name = 'proof_photos';
```

**Expected Result:**
```
column_name   | data_type | column_default
proof_photos  | ARRAY     | NULL
```

If **no rows returned**, run migration again:
```sql
ALTER TABLE shipment_returns ADD COLUMN IF NOT EXISTS proof_photos TEXT[];
```

---

### Step 2: Check Storage Bucket Exists
Go to **Supabase → Storage**

**Check:**
- [ ] Bucket `product-reports` exists
- [ ] Bucket is **PUBLIC**
- [ ] Upload permissions are set

**If bucket doesn't exist:**
1. Create new bucket: `product-reports`
2. Set to **Public**
3. Add policy: Allow INSERT for authenticated users
4. Add policy: Allow SELECT for everyone (public read)

---

### Step 3: Submit New Report (After Vercel Deploy)

1. Wait for Vercel deployment to finish (commit c89854c)
2. Open browser console (F12)
3. Go to `/kantin/[slug]` page
4. Click **"😟 Ada Masalah?"** on any product
5. Fill form:
   - Select problem type
   - **Upload 1-3 photos**
   - Click Submit

**Watch Console Logs:**
```
✅ Return created successfully: { ... }
📸 Uploaded photo URLs: ["https://..."]
📸 Stored proof_photos: ["https://..."]
```

**Critical Questions:**
- Are photos uploaded successfully?
- Is `photoUrls` array empty or filled?
- Is `returnData.proof_photos` NULL or has URLs?

---

### Step 4: Check Admin View

1. Go to `/admin/suppliers/shipments?tab=returns`
2. Click **"Laporan Customer"** sub-tab
3. Find the return you just created
4. Click **Eye icon** to open modal

**Watch Console Logs:**
```
🔍 CUSTOMER Return Data: { ... }
📸 proof_photos: ["https://..."] or null
📸 Type: "object"
📸 Is Array: true or false
📸 Length: 3 or undefined
```

**Critical Questions:**
- Is `returnItem.proof_photos` NULL?
- Is it an array?
- Does it have URLs inside?

---

### Step 5: Check Database Directly

Go to **Supabase → Table Editor** → `shipment_returns`

Find the row with `source = 'CUSTOMER'` (latest one)

**Check column values:**
- `proof_photos` = NULL or `["https://..."]`?
- `source` = `'CUSTOMER'`?
- `severity` = `'MEDIUM'` (or other)?

If `proof_photos` is **NULL**, the problem is in **upload/insert phase**.
If `proof_photos` has **URLs**, the problem is in **query/display phase**.

---

## 🔧 Possible Issues & Solutions

### Issue 1: Bucket Doesn't Exist
**Symptom:** Console shows "bucket not found" error

**Solution:**
```sql
-- Create bucket in Supabase Storage
-- OR run photo upload will skip gracefully
```

Photos won't upload, but form will still submit. Modal won't show photos (expected).

---

### Issue 2: Column Doesn't Exist
**Symptom:** Insert fails with "column proof_photos does not exist"

**Solution:**
Run migration:
```sql
ALTER TABLE shipment_returns ADD COLUMN IF NOT EXISTS proof_photos TEXT[];
```

---

### Issue 3: Data Type Mismatch
**Symptom:** proof_photos is stored as string instead of array

**Check in DB:** Does `proof_photos` show as:
- ✅ `["url1", "url2"]` (array) → Good
- ❌ `"[\"url1\", \"url2\"]"` (string) → Bad

**Solution:**
Frontend sends array, Supabase should auto-handle. Check column type:
```sql
SELECT data_type FROM information_schema.columns 
WHERE table_name = 'shipment_returns' AND column_name = 'proof_photos';
-- Should be: ARRAY
```

---

### Issue 4: Query Not Selecting proof_photos
**Symptom:** Console log shows `proof_photos: undefined`

**Current Query (line 651):**
```typescript
.select(`
  *,
  product:products(name, photo_url),
  location:locations(name),
  supplier:suppliers!shipment_returns_supplier_id_fkey(business_name)
`)
```

The `*` should include `proof_photos`. If not, try explicit:
```typescript
.select(`
  id, product_id, supplier_id, location_id, quantity, reason,
  status, source, customer_name, customer_contact, severity,
  proof_photos, requested_at, requested_by, reviewed_at, reviewed_by, review_notes,
  product:products(name, photo_url),
  location:locations(name),
  supplier:suppliers!shipment_returns_supplier_id_fkey(business_name)
`)
```

---

### Issue 5: Modal Condition Not Met
**Check line 1438:**
```typescript
{selectedReturn.proof_photos && selectedReturn.proof_photos.length > 0 && (
```

**Debug:**
- Is `selectedReturn.proof_photos` NULL? → Won't show
- Is it an empty array `[]`? → Won't show
- Is it undefined? → Won't show
- Is it `["url"]`? → Should show

---

## 📝 Next Steps

After Vercel deploys:

1. **Test photo upload** → Check console for upload URLs
2. **Check database** → Verify proof_photos column has data
3. **Open modal** → Check console for returnItem data
4. **Report findings** → Share console log output

**Key Questions to Answer:**
1. Does storage bucket exist?
2. Are photos uploading successfully?
3. Is proof_photos saved to database?
4. Is frontend query retrieving proof_photos?
5. Is modal condition evaluating correctly?

---

## 🎯 Expected Console Output (Success Case)

### On Form Submit:
```
✅ Return created successfully: {
  id: "xxx",
  proof_photos: [
    "https://rpzoacwlswlhfqaiicho.supabase.co/storage/v1/object/public/product-reports/123_456.jpg"
  ],
  source: "CUSTOMER",
  ...
}
📸 Uploaded photo URLs: ["https://..."]
📸 Stored proof_photos: ["https://..."]
```

### On Modal Open:
```
🔍 CUSTOMER Return Data: {
  id: "xxx",
  proof_photos: ["https://..."],
  source: "CUSTOMER",
  ...
}
📸 proof_photos: ["https://..."]
📸 Type: "object"
📸 Is Array: true
📸 Length: 1
```

### In Modal UI:
```
📸 Foto Bukti
[Photo Grid with 1-3 images]
```

---

Share the console output and I'll help identify the exact issue! 🚀
