# 🧪 TESTING MANUAL RETURN SYSTEM - STEP BY STEP

## ⚠️ CURRENT STATUS
- **Database**: RLS DISABLED (via DISABLE-RLS-TEST.sql)
- **Data Exists**: 6 returns in `shipment_returns` table (verified via DEBUG-RETURN-ISSUE.sql)
- **Frontend**: Deployed to Vercel (commit: d52ac5d)
- **Integration**: Added sub-tabs to existing Returns tab

---

## 📍 EXACT URLS TO TEST

### Admin Side:
1. **Main Returns Page** (now with sub-tabs):
   - URL: `https://platform-konsinyasi-v1.vercel.app/admin/suppliers/shipments?tab=returns`
   - What to see: Two sub-tabs:
     - "Pengiriman Ditolak" - Rejected shipments from stock_movements
     - "Retur Produk Rusak" - Manual returns from shipment_returns (NEW!)

2. **Create Manual Return**:
   - URL: `https://platform-konsinyasi-v1.vercel.app/admin/returns/create`
   - Use this to add more return requests

3. **Standalone Return List** (alternative view):
   - URL: `https://platform-konsinyasi-v1.vercel.app/admin/returns/list`
   - Shows all returns with filtering and search

### Supplier Side:
1. **Review Return Requests**:
   - URL: `https://platform-konsinyasi-v1.vercel.app/supplier/shipments?tab=returns`
   - Should show pending return requests for supplier's products

---

## 🧪 TEST PROCEDURE

### TEST 1: Verify Data Visible with RLS DISABLED

**Expected**: Data should now appear in frontend since RLS is off

1. **Login as Admin** to platform-konsinyasi-v1.vercel.app
2. **Navigate to**: `/admin/suppliers/shipments?tab=returns`
3. **Click**: "Retur Produk Rusak" sub-tab
4. **Expected Result**: 
   - ✅ Should see 6 return requests (Pastel, Roti Manis, Bolu from Aneka Snack)
   - ✅ All with status PENDING
   - ✅ All with reason "Produk rusak/cacat"
   - ✅ Dates: 13 Nov 2025

5. **If data appears**: RLS was the blocker → Proceed to TEST 2
6. **If still empty**: Frontend query has other issues → Check browser console

### TEST 2: Check Browser Console

1. **Open browser DevTools** (F12)
2. **Go to Console tab**
3. **Refresh** `/admin/suppliers/shipments?tab=returns`
4. **Look for**:
   - `🔍 Loading manual returns from shipment_returns...`
   - `✅ Manual returns loaded: 6` (or number)
   - `📊 Returns data:` [array of objects]
   - ❌ Any Supabase errors (permission denied, column not found, etc.)

5. **If you see errors**: Copy exact error message
6. **If no errors but empty**: Issue with React state or rendering

### TEST 3: Login as Supplier

1. **Login as Supplier** (Aneka Snack account)
2. **Navigate to**: `/supplier/shipments?tab=returns`
3. **Expected Result**:
   - ✅ Should see return requests for their products (Pastel, Roti Manis, Bolu)
   - ✅ Status: PENDING (waiting for supplier review)
   - ✅ Actions: Approve/Reject buttons

4. **Click "Review"** on one return
5. **Try to Approve or Reject**
6. **Check**: Does status update? Do notifications send?

### TEST 4: Re-enable RLS and Test Again

**Purpose**: Verify policies work correctly

1. **Run SQL**: `database/ENABLE-RLS-FIXED.sql` in Supabase SQL Editor
2. **Verify**: `SELECT * FROM pg_tables WHERE tablename = 'shipment_returns';` shows `rowsecurity = true`
3. **Refresh admin page**: `/admin/suppliers/shipments?tab=returns`
4. **Expected**: Data STILL appears (policies allow admin access)
5. **Refresh supplier page**: `/supplier/shipments?tab=returns`
6. **Expected**: Supplier sees ONLY their products' returns

---

## 🔍 DEBUG CHECKLIST

### If data NOT showing in admin view:
- [ ] Check RLS is disabled: Run `SELECT rowsecurity FROM pg_tables WHERE tablename = 'shipment_returns';` (should be FALSE)
- [ ] Verify data exists: Run `SELECT COUNT(*) FROM shipment_returns;` (should be 6)
- [ ] Check browser console for errors
- [ ] Verify logged in as ADMIN role: Check `profiles` table
- [ ] Check network tab: Is the query being sent? What's the response?
- [ ] Check Vercel deployment: Latest commit deployed? (d52ac5d or newer)

### If data showing but not updating:
- [ ] Check RPC functions exist: `SELECT proname FROM pg_proc WHERE proname LIKE '%return%';`
- [ ] Check notification triggers: `SELECT tgname FROM pg_trigger WHERE tgname LIKE '%return%';`
- [ ] Test RPC directly: `SELECT approve_return_request('<return_id>', '<supplier_id>');`

### If supplier NOT seeing returns:
- [ ] Verify supplier logged in: Check auth.uid()
- [ ] Check supplier's products: `SELECT id FROM products WHERE supplier_id = '<supplier_id>';`
- [ ] Verify returns linked to their products: `SELECT * FROM shipment_returns WHERE product_id IN (...);`
- [ ] Check RLS policies: Supplier policy should allow viewing their products' returns

---

## 📊 EXPECTED DATA (from previous debug)

You should see these returns in the system:

| Product | Supplier | Quantity | Reason | Status | Date |
|---------|----------|----------|--------|--------|------|
| Pastel | Aneka Snack | ? | Produk rusak/cacat | PENDING | 2025-11-13 |
| Roti Manis | Aneka Snack | ? | Produk rusak/cacat | PENDING | 2025-11-13 |
| Bolu | Aneka Snack | ? | Produk rusak/cacat | PENDING | 2025-11-13 |
| (3 more records) | Aneka Snack | ? | Produk rusak/cacat | PENDING | 2025-11-13 |

Total: **6 returns**, **5 PENDING**, **10 notifications sent**

---

## 🚨 WHAT TO REPORT

### If Working:
✅ "Data muncul di admin Returns tab (Retur Produk Rusak)"
✅ "Supplier bisa lihat return requests di tab returns"
✅ "Approve/Reject berfungsi"

### If NOT Working:
❌ Share exact error from browser console
❌ Share screenshot of empty page
❌ Confirm RLS status: `SELECT rowsecurity FROM pg_tables WHERE tablename = 'shipment_returns';`
❌ Confirm data exists: `SELECT COUNT(*) FROM shipment_returns;`

---

## 🎯 SUCCESS CRITERIA

**Test Passed If**:
1. ✅ Admin sees 6 return requests in "Retur Produk Rusak" sub-tab
2. ✅ Supplier sees their products' return requests in supplier portal
3. ✅ Clicking "Review" shows product details, quantity, reason
4. ✅ Approve/Reject buttons work and update status
5. ✅ Notifications sent to supplier when admin creates return
6. ✅ After re-enabling RLS, data still visible to correct users

---

## 🔧 NEXT STEPS BASED ON RESULTS

### If TEST 1 PASSES (data visible with RLS off):
→ **Action**: Run `ENABLE-RLS-FIXED.sql` to re-enable RLS with correct policies
→ **Reason**: Confirms RLS was the blocker, now we have working policies

### If TEST 1 FAILS (still empty with RLS off):
→ **Action**: Check browser console, share exact error
→ **Reason**: Issue is NOT RLS, could be query, auth, or frontend bug

### If TEST 3 FAILS (supplier can't see):
→ **Action**: Debug supplier_id matching and RLS supplier policy
→ **Reason**: Supplier access depends on product ownership

### If TEST 4 FAILS (empty after re-enabling RLS):
→ **Action**: Review policies, check auth.uid() matches profile ID
→ **Reason**: RLS policies might still need adjustment

---

## 📝 NOTES

- RLS currently **DISABLED** for isolation testing
- Frontend deployed with **sub-tabs integration** (commit d52ac5d)
- Data confirmed exists via **DEBUG-RETURN-ISSUE.sql**
- Original confusion: Created new pages but user using old page at different URL
- Solution: Integrated `shipment_returns` query into existing Returns tab with sub-tabs

---

**Last Updated**: After fixing URL mismatch and integrating manual returns into existing page
**Status**: Ready for testing - RLS disabled, frontend deployed with integration
