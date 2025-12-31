# 🐛 TROUBLESHOOTING & DEBUGGING GUIDE

> **Panduan lengkap untuk troubleshooting issues di Platform Konsinyasi**  
> **Last Updated:** 2 Desember 2025

---

## 📋 TABLE OF CONTENTS

1. [Common Issues & Solutions](#common-issues--solutions)
2. [Database Issues](#database-issues)
3. [Frontend Issues](#frontend-issues)
4. [Authentication Issues](#authentication-issues)
5. [RPC Function Errors](#rpc-function-errors)
6. [Deployment Issues](#deployment-issues)
7. [Debugging Tools](#debugging-tools)
8. [Known Bugs](#known-bugs)

---

## 🚨 COMMON ISSUES & SOLUTIONS

### **Issue 1: "movement_type = 'SHIPMENT' returns no data"**

**Symptom:**
```typescript
const { data } = await supabase
  .from('stock_movements')
  .select('*')
  .eq('movement_type', 'SHIPMENT')
// Returns empty array even though data exists
```

**Root Cause:**
Database uses `'IN'` as movement_type for shipments, NOT `'SHIPMENT'`.

**Solution:**
```typescript
// ❌ Wrong
.eq('movement_type', 'SHIPMENT')

// ✅ Correct
.eq('movement_type', 'IN')
```

**Files to Check:**
- `/frontend/src/app/admin/dashboard/page.tsx`
- `/frontend/src/app/supplier/dashboard/page.tsx`
- Any queries filtering stock_movements by type

**How to Verify:**
```sql
-- Check what values actually exist
SELECT DISTINCT movement_type FROM stock_movements;
-- Result: 'IN', 'OUT', 'RETURN', 'ADJUSTMENT' (NOT 'SHIPMENT')
```

---

### **Issue 2: "RPC function returns 400 Bad Request"**

**Symptom:**
```
Error: Failed to fetch
Status: 400 Bad Request
```

**Possible Causes:**

#### **A. Function Doesn't Exist**
```sql
-- Check if function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'your_function_name';
```

**Solution:** Create the function via SQL Editor in Supabase.

#### **B. Wrong Parameters**
```typescript
// ❌ Wrong parameter name
await supabase.rpc('approve_return', {
  return_id: 'uuid'  // Function expects p_return_id
})

// ✅ Correct
await supabase.rpc('approve_return_request', {
  p_return_id: 'uuid',
  p_review_notes: 'OK'
})
```

**Solution:** Check function signature:
```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'approve_return_request';
```

#### **C. Missing Authentication**
```typescript
// Some functions require authenticated user
const { data, error } = await supabase.rpc('secure_function')
// Error if user not logged in
```

**Solution:** Ensure user is authenticated before calling SECURITY DEFINER functions.

---

### **Issue 3: "record 'new' has no field 'field_name'"**

**Symptom:**
```
ERROR: record "new" has no field "stock_movement_id"
Context: PL/pgSQL function handle_return_reduce_pending()
```

**Root Cause:**
Database trigger is referencing a column that doesn't exist in the table.

**Example:**
```sql
-- ❌ Wrong: shipment_returns table has no stock_movement_id column
CREATE FUNCTION handle_return_reduce_pending() AS $$
BEGIN
  SELECT supplier_id INTO v_supplier_id
  FROM stock_movements
  WHERE id = NEW.stock_movement_id;  -- This field doesn't exist!
END;
$$ LANGUAGE plpgsql;
```

**Solution:**
```sql
-- ✅ Correct: Use the field that actually exists
CREATE OR REPLACE FUNCTION handle_return_reduce_pending() AS $$
DECLARE
  v_supplier_id UUID;
BEGIN
  -- Get supplier_id directly from NEW record
  v_supplier_id := NEW.supplier_id;  -- This field exists in shipment_returns
  
  -- Rest of function...
END;
$$ LANGUAGE plpgsql;
```

**How to Check Table Structure:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shipment_returns';
```

**Files to Check:**
- `/database/FIX-TRIGGER-RETURN-REDUCE-PENDING.sql`
- Any custom triggers in database

---

### **Issue 4: "Supplier not found" error in RPC**

**Symptom:**
```sql
-- Running in SQL Editor
SELECT approve_return_request('return-uuid', 'OK');
-- ERROR: Supplier not found
```

**Root Cause:**
Function uses `auth.uid()` which only works with authenticated requests from frontend, NOT in SQL Editor.

```sql
CREATE FUNCTION approve_return_request(...) AS $$
DECLARE
  v_supplier_id UUID;
BEGIN
  -- Get supplier from profile
  SELECT s.id INTO v_supplier_id
  FROM suppliers s
  WHERE s.profile_id = auth.uid();  -- Returns NULL in SQL Editor!
  
  IF v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Solution:**

**For Testing in SQL Editor:**
```sql
-- Option 1: Create test version without auth check
CREATE FUNCTION approve_return_request_test(
  p_return_id UUID,
  p_supplier_id UUID,  -- Pass supplier_id directly
  p_review_notes TEXT
) AS $$
BEGIN
  -- Use p_supplier_id instead of auth.uid()
END;
$$ LANGUAGE plpgsql;

-- Option 2: Use HTTP request from frontend (preferred)
```

**For Production:**
- Always call RPC functions from authenticated frontend
- Never call SECURITY DEFINER functions directly in SQL Editor for testing

---

### **Issue 5: Checkout fails with constraint error**

**Symptom:**
```
Error: new row for relation "inventory_levels" violates check constraint "inventory_levels_quantity_check"
```

**Root Cause:**
Customer refreshed checkout page → function called twice → inventory reduced twice → quantity goes negative.

**Example Flow:**
```
Initial: quantity = 5
1. Customer checkout (qty 5) → pending_transaction → quantity = 5 (reserved)
2. Customer refresh → function called AGAIN → tries quantity = 0
3. Customer confirm payment → quantity = 5 - 5 = 0 ✅
4. Second call executes → quantity = 0 - 5 = -5 ❌ (constraint violation)
```

**Solution: Implement Idempotency Check**

```typescript
'use client'

export default function CheckoutPage() {
  const [hasProcessed, setHasProcessed] = useState(false)
  
  useEffect(() => {
    // Check if already processed
    const processedKey = `checkout_processed_${locationSlug}`
    const alreadyProcessed = sessionStorage.getItem(processedKey)
    
    if (alreadyProcessed) {
      // Redirect to payment page
      router.push(`/kantin/${locationSlug}/payment/${alreadyProcessed}`)
      return
    }
  }, [])
  
  async function handleCheckout() {
    if (hasProcessed) return  // Prevent double submission
    
    setHasProcessed(true)
    
    try {
      const { data, error } = await supabase.rpc('process_anonymous_checkout', {
        p_location_id: locationId,
        p_items: cartItems,
        p_total_amount: total
      })
      
      if (error) throw error
      
      // Save transaction ID to sessionStorage
      sessionStorage.setItem(
        `checkout_processed_${locationSlug}`,
        data.transaction_id
      )
      
      router.push(`/kantin/${locationSlug}/payment/${data.transaction_id}`)
    } catch (error) {
      console.error(error)
      setHasProcessed(false)  // Allow retry on error
    }
  }
  
  // Clear flag after payment success
  function clearProcessedFlag() {
    sessionStorage.removeItem(`checkout_processed_${locationSlug}`)
  }
}
```

**Files Fixed:**
- `/frontend/src/app/kantin/[slug]/checkout/page.tsx`

---

### **Issue 6: RLS Policy blocks legitimate access**

**Symptom:**
```typescript
// Admin trying to read all suppliers
const { data, error } = await supabase.from('suppliers').select('*')
// Returns empty array or only own data
```

**Root Cause:**
RLS policy not configured correctly or admin role not properly set.

**Debug Steps:**

1. **Check user role:**
```sql
SELECT id, email, role FROM profiles WHERE id = auth.uid();
```

2. **Check RLS policies:**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE tablename = 'suppliers';
```

3. **Test policy logic:**
```sql
-- Check if admin check works
SELECT EXISTS (
  SELECT 1 FROM profiles
  WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
);
```

**Solution:**
```sql
-- Recreate policy if broken
DROP POLICY IF EXISTS "Admins can read all suppliers" ON suppliers;

CREATE POLICY "Admins can read all suppliers"
ON suppliers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);
```

---

## 🗄️ DATABASE ISSUES

### **Foreign Key Violation**

**Error:**
```
ERROR: insert or update on table "products" violates foreign key constraint "products_supplier_id_fkey"
Key (supplier_id)=(uuid) is not present in table "suppliers"
```

**Cause:** Trying to insert product with non-existent supplier_id.

**Solution:**
```typescript
// Always validate supplier exists first
const { data: supplier } = await supabase
  .from('suppliers')
  .select('id')
  .eq('id', supplierId)
  .single()

if (!supplier) {
  throw new Error('Supplier not found')
}

// Then insert product
await supabase.from('products').insert({
  supplier_id: supplierId,
  // ...
})
```

---

### **Duplicate Key Error**

**Error:**
```
ERROR: duplicate key value violates unique constraint "locations_qr_code_key"
Key (qr_code)=(ABC123) already exists
```

**Cause:** Trying to insert duplicate unique value.

**Solution:**
```typescript
// Check if QR code already exists
const { data: existing } = await supabase
  .from('locations')
  .select('id')
  .eq('qr_code', qrCode)
  .maybeSingle()

if (existing) {
  throw new Error('QR code already exists')
}

// Or use upsert
await supabase
  .from('locations')
  .upsert({ qr_code: qrCode, ... })
```

---

### **Trigger Not Firing**

**Issue:** Created trigger but it's not executing.

**Debug:**
```sql
-- Check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_return_reduce_pending';

-- Check trigger function
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_return_reduce_pending';

-- Test manually
UPDATE shipment_returns
SET status = 'APPROVED'
WHERE id = 'test-uuid';

-- Check if wallet was updated
SELECT * FROM supplier_wallets WHERE supplier_id = 'supplier-uuid';
```

**Common Issues:**
- Trigger timing wrong (BEFORE vs AFTER)
- Condition not met (IF statement)
- Function has syntax error
- Trigger not enabled

---

## 🎨 FRONTEND ISSUES

### **"Hydration failed" Error**

**Error:**
```
Error: Hydration failed because the initial UI does not match what was rendered on the server
```

**Cause:** Server-rendered HTML doesn't match client-rendered HTML.

**Common Causes:**
1. Using `window`, `localStorage`, or `Date.now()` in render
2. Random values without seed
3. Conditional rendering based on client-only state

**Solution:**
```typescript
// ❌ Wrong
export default function Component() {
  const isClient = typeof window !== 'undefined'
  return <div>{isClient ? 'Client' : 'Server'}</div>
}

// ✅ Correct
'use client'
export default function Component() {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  if (!mounted) return null
  
  return <div>Client-only content</div>
}
```

---

### **Data not loading (shows empty)**

**Symptom:**
Page loads but data doesn't appear, no error shown.

**Debug Steps:**

1. **Check browser console:**
```
F12 → Console tab → Look for errors
```

2. **Check network requests:**
```
F12 → Network tab → Filter: XHR → Look for Supabase requests
```

3. **Add console logs:**
```typescript
useEffect(() => {
  async function loadData() {
    console.log('Loading data...')
    const { data, error } = await supabase
      .from('products')
      .select('*')
    
    console.log('Data:', data)
    console.log('Error:', error)
    
    if (error) {
      console.error('Failed to load:', error)
      return
    }
    
    setProducts(data || [])
  }
  
  loadData()
}, [])
```

4. **Check RLS policies:**
```sql
-- Temporarily disable RLS for testing
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
-- Remember to re-enable after testing!
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

---

### **Image not displaying**

**Issue:** Product images show broken image icon.

**Causes:**
1. Invalid URL
2. CORS issue
3. Image deleted from storage
4. Wrong bucket/path

**Debug:**
```typescript
// Check if URL is valid
console.log('Image URL:', product.image_url)

// Test if image exists
const { data } = await supabase.storage
  .from('products')
  .list()

console.log('Files in storage:', data)

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('products')
  .getPublicUrl('path/to/image.jpg')

console.log('Public URL:', publicUrl)
```

**Solution:**
```typescript
// Use fallback image
<img
  src={product.image_url || '/placeholder.png'}
  onError={(e) => {
    e.currentTarget.src = '/placeholder.png'
  }}
/>
```

---

## 🔐 AUTHENTICATION ISSUES

### **"User not authenticated" but user is logged in**

**Symptom:**
User can see their email, but API calls return "not authenticated".

**Cause:** Session expired or token invalid.

**Solution:**
```typescript
// Force refresh session
const { data: { session }, error } = await supabase.auth.refreshSession()

if (error || !session) {
  // Redirect to login
  router.push('/auth/login')
}
```

---

### **Redirect loop after login**

**Issue:** User logs in, gets redirected, then back to login page infinitely.

**Cause:** Middleware or auth callback not handling redirect properly.

**Check:**
```typescript
// app/auth/callback/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }
  
  // Make sure redirect URL is correct
  return NextResponse.redirect(new URL('/admin/dashboard', request.url))
}
```

---

## 📊 RPC FUNCTION ERRORS

### **"Permission denied for function"**

**Error:**
```
ERROR: permission denied for function approve_return_request
```

**Cause:** Function is SECURITY DEFINER but user doesn't have EXECUTE permission.

**Solution:**
```sql
-- Grant execute permission
GRANT EXECUTE ON FUNCTION approve_return_request(UUID, TEXT)
TO authenticated;

-- Or make function accessible to all
GRANT EXECUTE ON FUNCTION approve_return_request(UUID, TEXT)
TO PUBLIC;
```

---

### **"Function result type mismatch"**

**Error:**
```
ERROR: return type mismatch in function declared to return json
```

**Cause:** Function returns wrong type.

**Solution:**
```sql
-- ❌ Wrong
CREATE FUNCTION my_function()
RETURNS JSON AS $$
BEGIN
  RETURN TRUE;  -- Returning BOOLEAN, not JSON!
END;
$$ LANGUAGE plpgsql;

-- ✅ Correct
CREATE FUNCTION my_function()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql;
```

---

## 🚀 DEPLOYMENT ISSUES

### **Vercel build fails**

**Error:**
```
Error: Failed to compile
Module not found: Can't resolve './components/Component'
```

**Cause:** Case-sensitive import paths (works on Windows, fails on Linux).

**Solution:**
```typescript
// ❌ Wrong (if actual file is Component.tsx)
import Component from './components/component'

// ✅ Correct
import Component from './components/Component'
```

---

### **Environment variables not working in production**

**Issue:** Feature works locally but not on Vercel.

**Cause:** Environment variables not set in Vercel dashboard.

**Solution:**
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add all required variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Redeploy

**Note:** Variables starting with `NEXT_PUBLIC_` are exposed to browser.

---

## 🛠️ DEBUGGING TOOLS

### **1. Supabase SQL Editor**
- Run queries directly
- Check table structure
- Test RPC functions
- View logs

### **2. Browser DevTools**
```
F12 → Console: JavaScript errors
F12 → Network: API requests
F12 → Application: localStorage, sessionStorage, cookies
```

### **3. Supabase Logs**
```
Dashboard → Logs → Postgres Logs
Check for:
- Query errors
- Trigger failures
- Constraint violations
```

### **4. React DevTools**
- Inspect component props
- Check state values
- Profile performance

### **5. PostgreSQL Functions**
```sql
-- Enable function debugging
SET client_min_messages TO DEBUG;

-- View query execution plan
EXPLAIN ANALYZE
SELECT * FROM products WHERE supplier_id = 'uuid';
```

---

## 🐞 KNOWN BUGS

### **1. Return approval sometimes doesn't reduce wallet**
**Status:** ❌ Not Fixed  
**Workaround:** Manually adjust wallet  
**Root Cause:** Trigger timing issue  
**Fix ETA:** Next sprint

### **2. Low stock alert threshold not customizable per product**
**Status:** 💡 Enhancement  
**Workaround:** Set default threshold  
**Planned:** Add to product settings

### **3. Image upload progress not shown**
**Status:** 📋 Planned  
**Workaround:** Use smaller images  
**Planned:** Add progress bar

---

## 📞 GETTING HELP

**When stuck:**

1. **Check this guide first**
2. **Search existing GitHub issues**
3. **Check Supabase logs**
4. **Create detailed issue:**
   ```
   Title: [BUG] Short description
   
   **Environment:**
   - OS: Windows/Mac/Linux
   - Browser: Chrome 120
   - Node: 18.17.0
   
   **Steps to Reproduce:**
   1. Go to...
   2. Click on...
   3. See error
   
   **Expected Behavior:**
   Should...
   
   **Actual Behavior:**
   Instead...
   
   **Screenshots:**
   [Attach if relevant]
   
   **Console Errors:**
   ```
   Paste error logs
   ```
   
   **Additional Context:**
   ...
   ```

---

**Document Version:** 1.0  
**Last Updated:** 2 Desember 2025  
**For:** AI Agent & Developers
