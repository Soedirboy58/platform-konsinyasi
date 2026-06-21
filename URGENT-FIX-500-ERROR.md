# 🚨 URGENT: HTTP 500 Error - New Issue Detected

## Problem Status
❌ HTTP 500 still showing on BOTH outlets:
- `kantin-kejujuran` - Baru dibuat
- `outlet_a` (atau `a`) - Existing

This means:
- **NOT** specific to kantin-kejujuran
- **Possibly** frontend code issue OR RPC function not accessible
- **Possibly** new outlet created but no inventory data

## What To Check (Priority Order)

### 1️⃣ CHECK: RPC Function Exists & Accessible

Run in Supabase SQL Editor:

```sql
-- Step 1: Does function exist?
SELECT 
    routine_name,
    routine_type,
    routine_schema
FROM information_schema.routines
WHERE routine_name = 'get_products_by_location';

-- Step 2: Test function with known outlet
SELECT * FROM get_products_by_location('outlet_lobby_a');

-- Step 3: Check if new outlet was created
SELECT * FROM locations WHERE qr_code IN ('kantin-kejujuran', 'a', 'outlet_a');

-- Step 4: Check inventory for new outlet
SELECT * FROM inventory_levels 
WHERE location_id IN (
  SELECT id FROM locations 
  WHERE qr_code IN ('kantin-kejujuran', 'a', 'outlet_a')
);
```

---

### 2️⃣ BROWSER CONSOLE ERROR (Press F12)

Open browser dev tools:
- F12 → Console tab
- Hard refresh: Ctrl+Shift+R
- Look for specific error message

This will tell us if:
- ✅ RPC function doesn't exist (error code 42883)
- ✅ Permission issue (error code 42501)
- ✅ No data returned (empty array)
- ✅ Other specific error

---

### 3️⃣ CHECK: Vercel Deployment Status

```bash
# Did the deployment complete successfully?
# Check: https://vercel.com -> platform-konsinyasi -> Deployments

# Key indicators:
✅ Status: READY (not BUILDING, ERROR, or CANCELLED)
✅ Deployment time: ~1-2 minutes
✅ No error messages in logs
```

---

### 4️⃣ POSSIBLE CAUSES

#### Cause A: RPC function doesn't exist
- Migration 015, 023, or 024 not executed
- Function got dropped somehow
- **Fix:** Run migration file

#### Cause B: Vercel deployed wrong code
- Build failed silently
- Frontend still has old code
- **Fix:** Force redeploy from Vercel

#### Cause C: New outlet no inventory
- Outlet created but no products added
- RPC returns empty array (showing "Tidak ada produk")
- **This is OK** - should show "Tidak ada produk" message, not 500 error

#### Cause D: Frontend code broke
- My code change has syntax error
- Deployment only compiled TypeScript but broke at runtime
- **Fix:** Check browser console & revert change

---

## Next Action

**FIRST:** Open F12 console and take screenshot of actual error message

This will point us to exact fix needed.

---

## Deployment History

- ✅ Code pushed to GitHub: ce782b8
- ⏳ Vercel deployment: In progress or completed?
- ❌ Page returns HTTP 500

Need to verify Vercel deployment status and browser console error.
