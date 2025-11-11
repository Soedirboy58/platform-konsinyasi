# 🔧 PHASE 1 MIGRATION - FIX APPLIED

**Issue**: Function name not unique error  
**Cause**: Multiple function overloads without explicit parameter types in GRANT/COMMENT  
**Solution**: Added DROP statements + explicit parameter types

---

## ✅ FIXED FILES

### **001_bulk_approval_functions.sql**
- ✅ Added DROP statements for all 5 functions
- ✅ Fixed GRANT with explicit parameter types:
  - `bulk_approve_suppliers(UUID[])`
  - `bulk_reject_suppliers(UUID[], TEXT)`
  - `bulk_approve_products(UUID[], UUID)`
  - `bulk_reject_products(UUID[], TEXT)`
  - `bulk_approve_shipments(UUID[])`

### **003_revenue_calculations.sql**  
- ✅ Added DROP statements for all 6 functions
- ✅ Fixed GRANT/COMMENT with explicit parameter types:
  - `get_platform_revenue(DATE, DATE)`
  - `get_sales_by_location(DATE, DATE, INTEGER)`
  - `get_sales_by_supplier(DATE, DATE, INTEGER)`
  - `get_top_selling_products(DATE, DATE, INTEGER, UUID)` ← **Main culprit**
  - `get_sales_trend(DATE, DATE, UUID)`
  - `get_commission_summary(DATE, DATE)`

### **002_pagination_helpers.sql**
- ⚠️ PARTIALLY FIXED (needs manual completion)
- ✅ Added DROP statements
- ⏳ Need to fix all GRANT statements with parameter types

---

## 📝 What Changed

**Before** (Ambiguous):
```sql
CREATE OR REPLACE FUNCTION get_top_selling_products(
  p_start_date DATE DEFAULT NULL,
  ...
)

GRANT EXECUTE ON FUNCTION get_top_selling_products TO authenticated;
-- ❌ Postgres doesn't know which overload!
```

**After** (Explicit):
```sql
DROP FUNCTION IF EXISTS get_top_selling_products(DATE, DATE, INTEGER, UUID);

CREATE OR REPLACE FUNCTION get_top_selling_products(
  p_start_date DATE DEFAULT NULL,
  ...
)

GRANT EXECUTE ON FUNCTION get_top_selling_products(DATE, DATE, INTEGER, UUID) TO authenticated;
-- ✅ Clear which function to grant!
```

---

## 🚀 Next Steps

1. **Upload Fixed Files** to Supabase:
   - ✅ `001_bulk_approval_functions.sql` - READY
   - ✅ `003_revenue_calculations.sql` - READY
   - ⏳ `002_pagination_helpers.sql` - Need to complete GRANT fixes
   - ⏳ `004_dashboard_stats.sql` - Not checked yet

2. **Test Again**:
   - Run `/admin/test-phase1` page
   - Should now pass without "function not unique" errors

3. **If Still Error**:
   - Run diagnostic query to find remaining duplicates
   - Drop old overloads manually if needed

---

## 🔍 Diagnostic Query

If you still get errors, run this in Supabase SQL Editor:

```sql
-- Find all overloaded functions
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS signature
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public'
  AND p.proname LIKE 'get_%'
GROUP BY p.proname, p.oid
HAVING COUNT(*) OVER (PARTITION BY p.proname) > 1
ORDER BY p.proname;
```

This will show all functions with multiple overloads.

---

## ⚠️ Important Notes

- DROP IF EXISTS is safe - won't error if function doesn't exist
- Must specify parameter types exactly: `DATE` not `date`, `INTEGER` not `int`
- DEFAULT values don't matter for GRANT/DROP - only parameter types
- If you manually created functions before, those old versions will be dropped

---

## ✅ Ready to Upload

Files `001` and `003` are now safe to upload to Supabase.  
File `002` needs GRANT statement fixes first (I'll complete this).  
File `004` should be checked for same issue.

---

**Status**: 🟡 IN PROGRESS  
**Next**: Complete fix for 002 and 004, then re-upload all
