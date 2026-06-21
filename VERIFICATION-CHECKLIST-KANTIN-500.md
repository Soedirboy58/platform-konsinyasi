# ✅ VERIFICATION CHECKLIST: /kantin/kantin-kejujuran Fix

## 🔍 PRE-FIX VERIFICATION

Before applying any fixes, collect baseline data:

- [ ] Screenshot current 500 error page
- [ ] Check browser console errors (F12)
- [ ] Note time & date of issue
- [ ] List affected locations (only kantin-kejujuran or others too?)

---

## 🧪 DATABASE VERIFICATION

### Check 1: Location Exists
```sql
SELECT id, name, qr_code, type, is_active 
FROM locations 
WHERE qr_code = 'kantin-kejujuran';
```
- [ ] Location found: YES / NO
- [ ] Location ID: _______________
- [ ] type = 'OUTLET': YES / NO
- [ ] is_active = true: YES / NO

**If NO location:**
- [ ] Run FIX 1: Create location
- [ ] Verify location created with correct ID
- [ ] Update location ID in findings below

---

### Check 2: RPC Function Exists
```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'get_products_by_location' 
  AND routine_schema = 'public';
```
- [ ] Function found: YES / NO
- [ ] Function type: _______________

**If NO function:**
- [ ] Run FIX 2: Deploy migration
- [ ] Verify function created successfully
- [ ] Check GRANT permissions set

---

### Check 3: Products Exist
```sql
SELECT COUNT(*) as total 
FROM products 
WHERE status = 'APPROVED';
```
- [ ] Total approved products: _______________
- [ ] Count > 0: YES / NO

**If COUNT = 0:**
- [ ] Admin needs to create & approve products first
- [ ] Cannot proceed with further testing

---

### Check 4: Inventory for Location
```sql
SELECT 
    COUNT(*) as total_inventory,
    SUM(il.quantity) as total_quantity
FROM inventory_levels il
JOIN locations l ON l.id = il.location_id
WHERE l.qr_code = 'kantin-kejujuran';
```
- [ ] Total inventory records: _______________
- [ ] Total quantity: _______________
- [ ] Has data: YES / NO

**If NO inventory:**
- [ ] Run FIX 3: Add inventory
- [ ] Choose Option A (add new products) or B (copy from other location)
- [ ] Verify inventory created with quantities > 0

---

### Check 5: RPC Function Test
```sql
SELECT 
    product_id,
    name,
    price,
    quantity,
    supplier_name
FROM get_products_by_location('kantin-kejujuran')
LIMIT 10;
```
- [ ] Query executes without error: YES / NO
- [ ] Rows returned: _______________ 
- [ ] Products visible: YES / NO / ERROR

**Error Type:**
- [ ] Function not found (42883)
- [ ] Permission denied (42501)
- [ ] Syntax error
- [ ] Other: _______________

**If ERROR:**
- [ ] Check error code
- [ ] Apply corresponding fix
- [ ] Re-test query

---

### Check 6: RPC Permissions
```sql
SELECT 
    grantee,
    privilege_type
FROM role_routine_grants
WHERE routine_name = 'get_products_by_location';
```
- [ ] anon role has EXECUTE: YES / NO
- [ ] authenticated role has EXECUTE: YES / NO

**If NO grants:**
- [ ] Run FIX 4: Grant permissions
- [ ] Re-run this check

---

## 🎨 FRONTEND VERIFICATION

### Browser Console Check (F12)

Open DevTools → Console tab and look for these logs:

**Expected Success Sequence:**
```
✅ 🔍 Loading products for location: kantin-kejujuran
✅ ✅ Location found: Kantin Kejujuran
✅ 📦 Calling RPC: get_products_by_location
✅ ✅ RPC successful, products returned: X
```

- [ ] All 4 logs present: YES / NO
- [ ] No error messages: YES / NO
- [ ] Product count > 0: YES / NO

**If Error Logs:**
- [ ] Note exact error message: _______________
- [ ] Screenshot error stack trace
- [ ] Compare with expected fixes

---

### Page Load Verification

#### V1: Halaman Load Sempurna
- [ ] Page loads without 500 error
- [ ] Loading spinner appears then disappears
- [ ] Header "Kantin Kejujuran" or correct location name visible
- [ ] Product grid appears with products
- [ ] Each product shows:
  - [ ] Product name
  - [ ] Product photo
  - [ ] Price (formatted correctly)
  - [ ] Supplier name
  - [ ] Quantity badge (e.g., "5 unit")

---

#### V2: Product Display
- [ ] Minimal 1 product visible: YES / NO
- [ ] Product count correct: _______________
- [ ] All products are APPROVED: YES / NO
- [ ] No out-of-context products showing: YES / NO
- [ ] Sorting correct (low stock first): YES / NO

---

#### V3: Search & Filter
- [ ] Search box functional: YES / NO
- [ ] Type "kue" shows only matching products: YES / NO
- [ ] Clear search shows all again: YES / NO

---

#### V4: Add to Cart
- [ ] Click "Add to Cart" on product: YES / NO
- [ ] Success toast appears: YES / NO
- [ ] Cart counter updates: YES / NO
- [ ] Product added with correct price/quantity: YES / NO

---

#### V5: Cart Operations
- [ ] Open cart side panel: YES / NO
- [ ] Show cart items correctly: YES / NO
- [ ] Increment/decrement quantity: YES / NO
- [ ] Remove item from cart: YES / NO
- [ ] Total price calculates correctly: YES / NO

---

#### V6: Checkout Flow
- [ ] Click "Checkout" button: YES / NO
- [ ] Navigates to checkout page: YES / NO
- [ ] Cart items preserved: YES / NO
- [ ] Customer info form shows: YES / NO
- [ ] Can enter name/phone/email: YES / NO
- [ ] Can select payment method: YES / NO
- [ ] Can complete checkout: YES / NO

---

#### V7: Transaction Created
```sql
SELECT id, location_id, status, total_price 
FROM sales_transactions 
WHERE status = 'COMPLETED'
ORDER BY created_at DESC 
LIMIT 1;
```
- [ ] Latest transaction exists: YES / NO
- [ ] Transaction status = COMPLETED: YES / NO
- [ ] Total price correct: YES / NO
- [ ] Location ID matches: YES / NO

---

## 🔄 REGRESSION TESTING

Pastikan fixes tidak break fitur lain:

### Other Locations
```sql
SELECT qr_code FROM locations WHERE type = 'OUTLET' AND is_active = TRUE;
```
- [ ] Test 1st location: YES / NO - Working: YES / NO
- [ ] Test 2nd location: YES / NO - Working: YES / NO
- [ ] Test 3rd location: YES / NO - Working: YES / NO

### Admin Dashboard
- [ ] Admin can view all locations: YES / NO
- [ ] Admin can view sales transactions: YES / NO
- [ ] Admin can view inventory: YES / NO
- [ ] Admin can manage products: YES / NO

### Supplier Dashboard
- [ ] Supplier can manage products: YES / NO
- [ ] Supplier can manage inventory: YES / NO
- [ ] Supplier can view sales: YES / NO

---

## 📋 FINAL VERIFICATION SUMMARY

### Completion Checklist
- [ ] Database fixes completed
- [ ] All diagnostics passed
- [ ] Frontend loads correctly
- [ ] Products display properly
- [ ] Cart functionality works
- [ ] Checkout completes successfully
- [ ] Transaction recorded in database
- [ ] No regressions in other areas
- [ ] Browser console clean (no errors)
- [ ] Page performance acceptable

### Ready for Production?
- [ ] All checks passed: ✅ YES / ❌ NO
- [ ] Sign-off by: _______________
- [ ] Date: _______________
- [ ] Time: _______________

---

## 📸 DOCUMENTATION

Collect evidence of successful fix:

- [ ] Screenshot of page with products
- [ ] Screenshot of successful transaction in database
- [ ] Browser console logs (successful sequence)
- [ ] Timestamp of fix completion

---

## 🚨 ROLLBACK PLAN (If Something Goes Wrong)

If fix causes issues:

1. [ ] Revert frontend changes:
   ```bash
   git checkout HEAD -- frontend/src/app/kantin/[slug]/page.tsx
   ```

2. [ ] Revert database changes:
   ```bash
   supabase db reset  # Reset to last known good state
   # Or run specific rollback SQL
   ```

3. [ ] Redeploy previous working version

4. [ ] Notify team of issue

---

## 📞 ESCALATION PATH

If unable to fix:

1. **Level 1:** Check logs & console errors
2. **Level 2:** Run debug queries & identify root cause
3. **Level 3:** Contact database admin
4. **Level 4:** Review migrations & schema
5. **Level 5:** Escalate to senior engineer

---

**Checklist Version:** 1.0  
**Last Updated:** 2026-03-27  
**Checked By:** _______________  
**Date:** _______________
