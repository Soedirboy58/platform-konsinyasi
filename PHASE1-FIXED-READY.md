# ✅ PHASE 1 MIGRATIONS - FIXED & READY

**Status**: 🟢 **ALL FIXED**  
**Date**: 11 November 2025

---

## 🔧 Problem

Error saat upload `003_revenue_calculations.sql`:
```
ERROR: 42725: function name "get_top_selling_products" is not unique
HINT: Specify the argument list to select the function unambiguously.
```

**Root Cause**: 
- Multiple function overloads tanpa explicit parameter types di GRANT/COMMENT statements
- Postgres tidak bisa distinguish function mana yang dimaksud

---

## ✅ Solution Applied

### **Fixed All 4 Migration Files**:

#### **001_bulk_approval_functions.sql** ✅
- Added `DROP FUNCTION IF EXISTS` for all 5 functions
- Fixed GRANT with explicit types:
  - `bulk_approve_suppliers(UUID[])`
  - `bulk_reject_suppliers(UUID[], TEXT)`
  - `bulk_approve_products(UUID[], UUID)`
  - `bulk_reject_products(UUID[], TEXT)`
  - `bulk_approve_shipments(UUID[])`

#### **002_pagination_helpers.sql** ✅
- Added `DROP FUNCTION IF EXISTS` for all 7 functions
- Auto-fixed GRANT statements via Python script
- All pagination helpers disambiguated

#### **003_revenue_calculations.sql** ✅  
- Added `DROP FUNCTION IF EXISTS` for all 6 functions
- Fixed GRANT with explicit types:
  - `get_platform_revenue(DATE, DATE)`
  - `get_sales_by_location(DATE, DATE, INTEGER)`
  - `get_sales_by_supplier(DATE, DATE, INTEGER)`
  - `get_top_selling_products(DATE, DATE, INTEGER, UUID)` ← **Main culprit**
  - `get_sales_trend(DATE, DATE, UUID)`
  - `get_commission_summary(DATE, DATE)`

#### **004_dashboard_stats.sql** ✅
- Added `DROP FUNCTION IF EXISTS` for all 6 functions
- Fixed GRANT with explicit types:
  - `get_pending_approvals_count()`
  - `get_low_stock_alerts(INTEGER, INTEGER)`
  - `get_out_of_stock_products(UUID, INTEGER)`
  - `get_pending_approvals_details()`
  - `get_admin_dashboard_summary()`
  - `get_supplier_performance_summary(INTEGER)`

---

## 📂 Fixed Files Location

```
backend/migrations/phase1/
├── 001_bulk_approval_functions.sql      ✅ FIXED
├── 002_pagination_helpers.sql           ✅ FIXED
├── 003_revenue_calculations.sql         ✅ FIXED
└── 004_dashboard_stats.sql              ✅ FIXED
```

---

## 🚀 How to Upload

### **Method 1: Supabase SQL Editor** (RECOMMENDED)

1. Buka **Supabase Dashboard** → **SQL Editor**
2. Create new query
3. Copy-paste isi file **satu per satu** dalam urutan:
   - `001_bulk_approval_functions.sql`
   - `002_pagination_helpers.sql`
   - `003_revenue_calculations.sql`
   - `004_dashboard_stats.sql`
4. Klik **Run** untuk setiap file
5. Pastikan ada **"Success. No rows returned"** message

---

## ✅ Verification Steps

### **1. Check Functions Created**

Run di SQL Editor:
```sql
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS signature
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public'
  AND p.proname IN (
    'bulk_approve_products',
    'get_suppliers_paginated',
    'get_platform_revenue',
    'get_top_selling_products',
    'get_low_stock_alerts'
  )
ORDER BY p.proname;
```

**Expected**: 5 functions dengan signature yang jelas

---

### **2. Test via Frontend**

1. Pastikan frontend running: `npm run dev`
2. Buka: `http://localhost:3000/admin/test-phase1`
3. Klik **"Run Tests"**
4. **Expected Result**:
   ```
   ✅ Passed: 8
   ❌ Failed: 0
   
   🎉 All Tests Passed!
   ```

---

## 📊 Functions Summary

| File | Functions | Status |
|------|-----------|--------|
| 001 | 5 bulk operations | ✅ Fixed |
| 002 | 7 pagination helpers | ✅ Fixed |
| 003 | 6 revenue calculations | ✅ Fixed |
| 004 | 6 dashboard stats | ✅ Fixed |
| **TOTAL** | **24 functions** | **✅ ALL READY** |

---

## 🔍 What Changed

**Before**:
```sql
CREATE FUNCTION get_top_selling_products(...)
GRANT EXECUTE ON FUNCTION get_top_selling_products TO authenticated;
-- ❌ Ambiguous if overloads exist
```

**After**:
```sql
DROP FUNCTION IF EXISTS get_top_selling_products(DATE, DATE, INTEGER, UUID);

CREATE FUNCTION get_top_selling_products(...)
GRANT EXECUTE ON FUNCTION get_top_selling_products(DATE, DATE, INTEGER, UUID) TO authenticated;
-- ✅ Explicit signature
```

---

## ⚠️ Important Notes

1. **DROP IF EXISTS is safe** - Won't error if function doesn't exist yet
2. **Upload in order** - 001 → 002 → 003 → 004 (dependencies)
3. **One at a time** - Upload dan test setiap file sebelum next
4. **Test immediately** - Use `/admin/test-phase1` page after upload
5. **No data loss** - Functions only, no table changes

---

## 🎯 Next Steps After Upload

1. ✅ **Verify** - Run test page, ensure 8/8 passed
2. ✅ **Fix Dashboard** - Implement revenue display (Task 3)
3. ✅ **Add Widgets** - Low stock, expired products (Task 4-5)
4. ✅ **Expired System** - Full implementation (Task 6)
5. ✅ **Return UI** - Admin page for returns (Task 7-8)

---

## 🆘 If Still Error

### Error: "function already exists"
```sql
-- Drop manually:
DROP FUNCTION IF EXISTS function_name CASCADE;
```

### Error: "permission denied"
```sql
-- Check function has SECURITY DEFINER:
SELECT prosecdef FROM pg_proc WHERE proname = 'function_name';
-- Should return TRUE
```

### Error: "relation does not exist"
- Some tables might be missing
- Run main schema first: `database/schema.sql`

---

## ✅ READY TO PROCEED!

**Files are fixed and ready to upload.**  
**No more "function not unique" errors expected.**

Silakan upload ke Supabase sekarang! 🚀
