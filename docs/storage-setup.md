# Storage Bucket Configuration

## Create Buckets via Supabase Dashboard

### 1. Navigate to Storage
- Login to [Supabase Dashboard](https://supabase.com/dashboard)
- Select your project: **rpzoacwlswlhfqaiicho**
- Go to **Storage** in left sidebar

### 2. Create Buckets

#### Bucket 1: product-photos
```
Name: product-photos
Public: ✅ Yes (public access for viewing)
File size limit: 5 MB
Allowed MIME types: image/jpeg, image/png, image/webp
```

**Purpose:** Store product photos uploaded by suppliers

#### Bucket 2: adjustment-proofs
```
Name: adjustment-proofs
Public: ❌ No (private, authenticated access only)
File size limit: 10 MB
Allowed MIME types: image/jpeg, image/png, application/pdf
```

**Purpose:** Store proof documents for inventory adjustments

#### Bucket 3: payment-proofs
```
Name: payment-proofs
Public: ❌ No (private, authenticated access only)
File size limit: 10 MB
Allowed MIME types: image/jpeg, image/png, application/pdf
```

**Purpose:** Store payment proof documents from suppliers

---

## Storage Policies (RLS)

Run these SQL queries in **SQL Editor** after creating buckets:

### Policy for product-photos (Public Read, Supplier Write)

```sql
-- Allow public to view product photos
CREATE POLICY "Public can view product photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-photos');

-- Allow authenticated suppliers to upload product photos
CREATE POLICY "Suppliers can upload product photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-photos' AND
  auth.uid() IN (
    SELECT profile_id FROM suppliers WHERE status = 'APPROVED'
  )
);

-- Allow suppliers to update their own product photos
CREATE POLICY "Suppliers can update own product photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-photos' AND
  auth.uid() IN (
    SELECT profile_id FROM suppliers WHERE status = 'APPROVED'
  )
);

-- Allow suppliers to delete their own product photos
CREATE POLICY "Suppliers can delete own product photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-photos' AND
  auth.uid() IN (
    SELECT profile_id FROM suppliers WHERE status = 'APPROVED'
  )
);
```

### Policy for adjustment-proofs (Private)

```sql
-- Allow suppliers to upload adjustment proofs
CREATE POLICY "Suppliers can upload adjustment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'adjustment-proofs' AND
  auth.uid() IN (
    SELECT profile_id FROM suppliers WHERE status = 'APPROVED'
  )
);

-- Allow suppliers to view their own adjustment proofs
CREATE POLICY "Suppliers can view own adjustment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'adjustment-proofs' AND
  (
    auth.uid() IN (
      SELECT profile_id FROM suppliers WHERE status = 'APPROVED'
    ) OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'ADMIN'
    )
  )
);

-- Allow admins to view all adjustment proofs
CREATE POLICY "Admins can view all adjustment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'adjustment-proofs' AND
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'ADMIN'
  )
);
```

### Policy for payment-proofs (Private)

```sql
-- Allow suppliers to upload payment proofs
CREATE POLICY "Suppliers can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs' AND
  auth.uid() IN (
    SELECT profile_id FROM suppliers WHERE status = 'APPROVED'
  )
);

-- Allow suppliers to view their own payment proofs
CREATE POLICY "Suppliers can view own payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND
  (
    auth.uid() IN (
      SELECT profile_id FROM suppliers WHERE status = 'APPROVED'
    ) OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'ADMIN'
    )
  )
);

-- Allow admins to view all payment proofs
CREATE POLICY "Admins can view all payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND
  auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'ADMIN'
  )
);
```

---

## Usage in Frontend

### Upload Product Photo

```typescript
import { createClient } from '@/lib/supabase/client'

async function uploadProductPhoto(file: File, productId: string) {
  const supabase = createClient()
  
  const fileName = `${productId}-${Date.now()}.${file.name.split('.').pop()}`
  const filePath = `products/${fileName}`
  
  const { data, error } = await supabase.storage
    .from('product-photos')
    .upload(filePath, file)
  
  if (error) throw error
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('product-photos')
    .getPublicUrl(filePath)
  
  // Save URL to products table
  await supabase
    .from('products')
    .update({ photo_url: publicUrl })
    .eq('id', productId)
  
  return publicUrl
}
```

### Upload Adjustment Proof

```typescript
async function uploadAdjustmentProof(file: File, adjustmentId: string) {
  const supabase = createClient()
  
  const fileName = `${adjustmentId}-${Date.now()}.${file.name.split('.').pop()}`
  const filePath = `adjustments/${fileName}`
  
  const { data, error } = await supabase.storage
    .from('adjustment-proofs')
    .upload(filePath, file)
  
  if (error) throw error
  
  // Save path to inventory_adjustments table
  await supabase
    .from('inventory_adjustments')
    .update({ proof_document: filePath })
    .eq('id', adjustmentId)
  
  return filePath
}
```

### Get Private File URL (with signed URL)

```typescript
async function getAdjustmentProofUrl(filePath: string) {
  const supabase = createClient()
  
  // Create signed URL (valid for 1 hour)
  const { data, error } = await supabase.storage
    .from('adjustment-proofs')
    .createSignedUrl(filePath, 3600)
  
  if (error) throw error
  
  return data.signedUrl
}
```

---

## File Upload Component Example

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function FileUploadInput({ 
  onUploadComplete 
}: { 
  onUploadComplete: (url: string) => void 
}) {
  const [uploading, setUploading] = useState(false)
  
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return
    
    const file = e.target.files[0]
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Max 5MB')
      return
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Use JPG, PNG, or WebP')
      return
    }
    
    setUploading(true)
    
    try {
      const supabase = createClient()
      const fileName = `${Date.now()}-${file.name}`
      const filePath = `temp/${fileName}`
      
      const { error } = await supabase.storage
        .from('product-photos')
        .upload(filePath, file)
      
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage
        .from('product-photos')
        .getPublicUrl(filePath)
      
      onUploadComplete(publicUrl)
      toast.success('File uploaded!')
    } catch (error: any) {
      toast.error(error.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Upload Photo
      </label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileUpload}
        disabled={uploading}
        className="block w-full text-sm text-gray-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-lg file:border-0
          file:text-sm file:font-semibold
          file:bg-blue-50 file:text-blue-700
          hover:file:bg-blue-100
          disabled:opacity-50"
      />
      {uploading && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
    </div>
  )
}
```

---

## Testing Storage

1. **Create buckets** in Supabase Dashboard → Storage
2. **Run SQL policies** in SQL Editor
3. **Test upload** from supplier product form
4. **Verify access**:
   - Public: Open product photo URL directly in browser
   - Private: Check that direct URL access is denied (403)

---

## Storage Limits (Free Plan)

- **Storage:** 1 GB
- **Bandwidth:** 2 GB/month
- **File size:** 50 MB max per file

For production, consider upgrading to Pro plan for more storage.
