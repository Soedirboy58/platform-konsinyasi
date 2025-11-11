# 🧪 PHASE 1 TESTING GUIDE

## 📋 Testing Plan

Sebelum deploy, kita test dulu semua Phase 1 migrations untuk memastikan:
1. ✅ Semua RPC functions berhasil dibuat
2. ✅ Functions bisa dipanggil dari frontend
3. ✅ Data yang dikembalikan sesuai ekspektasi
4. ✅ Tidak ada error permissions atau security

---

## 🎯 Testing Methods

### **Method 1: Web Interface (RECOMMENDED)** ✅

**URL**: `http://localhost:3000/admin/test-phase1`

**Steps**:
1. Pastikan frontend running (`npm run dev`)
2. Buka browser ke `/admin/test-phase1`
3. Klik "Run Tests"
4. Lihat hasil real-time

**Keuntungan**:
- ✅ Visual interface
- ✅ Real-time results
- ✅ Sample data preview
- ✅ Easy to debug

---

### **Method 2: Supabase SQL Editor** ⚡

**Location**: Supabase Dashboard → SQL Editor

**Quick Test Query**:
```sql
-- Check if functions exist
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN (
  'bulk_approve_products',
  'bulk_reject_products',
  'bulk_approve_suppliers',
  'get_suppliers_paginated',
  'get_products_paginated',
  'get_actual_revenue',
  'get_revenue_by_product',
  'get_pending_approvals_summary',
  'get_low_stock_alerts',
  'get_commission_summary'
)
ORDER BY proname;
```

**Expected Result**: Should return 10 rows (1 per function)

---

### **Method 3: Browser Console** 🔧

**Steps**:
1. Open any admin page
2. Open browser console (F12)
3. Paste this code:

```javascript
const supabase = window.Supabase.createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Test revenue function
const { data, error } = await supabase.rpc('get_actual_revenue', {
  p_start_date: null,
  p_end_date: null
})

console.log('Revenue:', data, error)
```

---

## 📊 Functions to Test

### **1. Bulk Approval Functions** (001_bulk_approval_functions.sql)

| Function | Purpose | Test Input |
|----------|---------|------------|
| `bulk_approve_products` | Approve multiple products | Empty array (dry run) |
| `bulk_reject_products` | Reject multiple products | Empty array (dry run) |
| `bulk_approve_suppliers` | Approve multiple suppliers | Empty array (dry run) |
| `bulk_reject_suppliers` | Reject multiple suppliers | Empty array (dry run) |
| `bulk_approve_shipments` | Approve multiple shipments | Empty array (dry run) |

**Expected**: Functions should exist and return success even with empty arrays

---

### **2. Pagination Helpers** (002_pagination_helpers.sql)

| Function | Purpose | Test Input |
|----------|---------|------------|
| `get_suppliers_paginated` | Paginated supplier list | page=1, size=10 |
| `get_products_paginated` | Paginated product list | page=1, size=10 |
| `get_shipments_paginated` | Paginated shipment list | page=1, size=10 |
| `get_sales_paginated` | Paginated sales list | page=1, size=10 |
| `get_locations_paginated` | Paginated location list | page=1, size=10 |
| `get_payments_paginated` | Paginated payment list | page=1, size=10 |

**Expected**: Should return array with `total_count` and paginated data

---

### **3. Revenue Calculations** (003_revenue_calculations.sql)

| Function | Purpose | Expected Output |
|----------|---------|-----------------|
| `get_actual_revenue` | Total platform revenue | Object with total, count, avg |
| `get_revenue_by_location` | Revenue per location | Array of locations with revenue |
| `get_revenue_by_supplier` | Revenue per supplier | Array of suppliers with revenue |
| `get_revenue_by_product` | Top selling products | Array of products sorted by sales |
| `get_revenue_trend` | Daily/weekly revenue trend | Array with dates and amounts |
| `get_commission_summary` | Commission breakdown | Total commission stats |

**Expected**: Should return numeric values (might be 0 if no sales yet)

---

### **4. Dashboard Stats** (004_dashboard_stats.sql)

| Function | Purpose | Expected Output |
|----------|---------|-----------------|
| `get_pending_approvals_summary` | Count pending items | Object with counts |
| `get_low_stock_alerts` | Products low on stock | Array of products |
| `get_expiring_products_alert` | Products near expiry | Array of products |
| `get_location_performance` | Location metrics | Array of locations |
| `get_supplier_performance` | Supplier metrics | Array of suppliers |
| `get_product_performance` | Product metrics | Array of products |

**Expected**: Should return counts and metrics (might be 0 initially)

---

## ✅ Success Criteria

### **All Tests Pass** 🎉
- All 8 functions respond without error
- Data structures match expected schema
- No permission denied errors
- No null/undefined unexpected values

### **If Tests Fail** ❌

**Error: "function does not exist"**
- ❌ Migrations not executed yet
- 🔧 **Solution**: Copy-paste migration files to Supabase SQL Editor

**Error: "permission denied"**
- ❌ RLS policies blocking access
- 🔧 **Solution**: Check SECURITY DEFINER in function definition

**Error: "column does not exist"**
- ❌ Database schema mismatch
- 🔧 **Solution**: Run schema.sql or check table structure

**Error: "null value"**
- ⚠️ No data in tables yet (might be OK)
- 🔧 **Solution**: Verify with sample data insert

---

## 🚀 Execution Checklist

### **Pre-Testing**
- [ ] Frontend running (`npm run dev`)
- [ ] Supabase project accessible
- [ ] Admin logged in
- [ ] Phase 1 migration files ready

### **Execute Migrations** (If not done yet)
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Copy `001_bulk_approval_functions.sql` → Run
- [ ] Copy `002_pagination_helpers.sql` → Run
- [ ] Copy `003_revenue_calculations.sql` → Run
- [ ] Copy `004_dashboard_stats.sql` → Run
- [ ] Verify "Success" message for each

### **Run Tests**
- [ ] Open `/admin/test-phase1` in browser
- [ ] Click "Run Tests"
- [ ] Wait for all 8 tests to complete
- [ ] Check summary: Should be 8/8 passed

### **Post-Testing**
- [ ] Screenshot test results
- [ ] Note any warnings or unexpected data
- [ ] Ready to proceed with frontend implementation

---

## 📸 Expected Test Results

```
✅ Passed: 8
❌ Failed: 0
⏳ Testing: 0

✅ bulk_approve_products() - Returned object
✅ get_suppliers_paginated() - Returned 10 records
✅ get_products_paginated() - Returned 10 records
✅ get_actual_revenue() - Returned object
✅ get_revenue_by_product() - Returned 10 products
✅ get_pending_approvals_summary() - Returned object
✅ get_low_stock_alerts() - Returned 5 alerts
✅ get_commission_summary() - Returned object

🎉 All Tests Passed!
Phase 1 migrations berhasil! Siap untuk implementasi frontend.
```

---

## 🔄 Next Steps After Testing

1. ✅ **If all tests pass**:
   - Proceed to Task 2: Fix Dashboard Revenue
   - Implement frontend components
   - Test each feature incrementally

2. ❌ **If some tests fail**:
   - Debug specific function
   - Check migration execution logs
   - Verify RLS policies
   - Re-run migrations if needed

3. ⚠️ **If data is zero/empty**:
   - Normal for fresh database
   - Create sample data for realistic testing
   - Test again with actual data

---

## 📞 Troubleshooting

### Problem: Cannot access /admin/test-phase1

**Solution**:
```bash
cd frontend
npm run dev
# Open http://localhost:3000/admin/test-phase1
```

### Problem: All tests fail with "function does not exist"

**Solution**:
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy-paste each migration file
4. Run one by one
5. Check for success messages

### Problem: Permission denied errors

**Solution**:
Check function has `SECURITY DEFINER`:
```sql
CREATE OR REPLACE FUNCTION function_name()
RETURNS ...
SECURITY DEFINER  -- ← This line important!
SET search_path = public
LANGUAGE plpgsql
```

---

## 📊 Sample Test Data (Optional)

If you want realistic test results, insert sample data:

```sql
-- Insert test supplier
INSERT INTO suppliers (business_name, business_type, business_address, phone, status)
VALUES ('Test Supplier', 'manufacturer', 'Jl. Test No. 1', '081234567890', 'APPROVED')
RETURNING id;

-- Insert test product
INSERT INTO products (name, description, price, commission_rate, status, supplier_id)
VALUES ('Test Product', 'Sample product', 25000, 0.20, 'APPROVED', '<supplier_id>')
RETURNING id;

-- Insert test inventory
INSERT INTO inventory_levels (product_id, location_id, quantity)
VALUES ('<product_id>', '<location_id>', 10);
```

---

## ✅ Testing Complete!

Once all tests pass, update todo:
- [x] Test Phase 1 Backend Migrations
- [ ] Fix Dashboard Revenue Calculation
- [ ] Add Dashboard Widgets
- [ ] ...

**Ready to proceed with frontend implementation!** 🚀
