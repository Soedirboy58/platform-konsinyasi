# 🚀 SQL Execution Order

Execute SQL files dalam urutan ini di Supabase SQL Editor untuk memperbaiki semua masalah.

## ⚠️ CRITICAL - Execute Sekarang (URUTAN PENTING!)

### 1️⃣ **add-supplier-columns.sql** ⏱️ 1 menit
**PRIORITY: HIGHEST - Execute FIRST**

**Problem:** 
- Supplier settings gagal save
- Error: "Could not find the 'address' column"

**What it does:**
```sql
ALTER TABLE suppliers ADD COLUMN contact_person TEXT;
ALTER TABLE suppliers ADD COLUMN phone_number TEXT;
ALTER TABLE suppliers ADD COLUMN address TEXT;
```

**How to execute:**
1. Open Supabase Dashboard → SQL Editor
2. Copy ALL content from `add-supplier-columns.sql`
3. Paste and click **Run**
4. Expected output: `SUCCESS: Supplier columns added!`

**Test after:**
- Login supplier → Pengaturan → Edit data → Simpan
- Should show: ✅ "Pengaturan berhasil disimpan"

---

### 2️⃣ **fix-recursive-rls.sql** ⏱️ 2 menit
**PRIORITY: HIGH - Execute SECOND**

**Problem:**
- Login fails with "infinite recursion detected in policy"
- Onboarding crashes

**What it does:**
- Drops 30+ recursive RLS policies
- Creates 6 simple non-recursive policies
- Uses only `auth.uid()`, no subqueries

**How to execute:**
1. Copy ALL content from `fix-recursive-rls.sql`
2. Paste in Supabase SQL Editor → Run
3. Expected: `SUCCESS: Non-recursive policies created!`

**Test after:**
- Admin login → Should succeed
- Supplier login → Should succeed
- Supplier onboarding → Should save

---

### 3️⃣ **add-admin-access.sql** ⏱️ 2 menit
**PRIORITY: HIGH - Execute THIRD**

**Problem:**
- Admin cannot read supplier/product data
- Admin dashboard shows "Unknown Supplier", "0 jenis", "0 qty"

**What it does:**
- Creates `is_admin()` helper function
- Adds 6 admin bypass policies for all tables
- Admin can read/write ALL data

**How to execute:**
1. Copy ALL content from `add-admin-access.sql`
2. Paste in Supabase SQL Editor → Run
3. Expected: `SUCCESS: Admin access policies added!`

**Test after:**
- Admin login → Kelola Pengiriman
- Should show: Real supplier names, product counts, quantities

---

### 4️⃣ **fix-stock-movement-functions.sql** ⏱️ 1 menit
**PRIORITY: MEDIUM - Execute FOURTH**

**Problem:**
- Admin approve/reject buttons don't work
- Error: "function not found"

**What it does:**
```sql
CREATE FUNCTION approve_stock_movement(p_movement_id, p_admin_id)
CREATE FUNCTION reject_stock_movement(p_movement_id, p_admin_id, p_rejection_reason)
```

**How to execute:**
1. Copy ALL content from `fix-stock-movement-functions.sql`
2. Paste → Run
3. Expected: 2 functions created

**Test after:**
- Admin → Kelola Pengiriman → Detail → Approve/Reject
- Should work without errors

---

### 5️⃣ **fix-notification-functions.sql** ⏱️ 1 menit
**PRIORITY: MEDIUM - Execute FIFTH**

**Problem:**
- Supplier submit shipment fails
- Error: "function create_notification is not unique"

**What it does:**
- Drops 4 duplicate function signatures
- Keeps only 1 correct signature

**How to execute:**
1. Copy ALL → Paste → Run
2. Expected: Duplicates removed

**Test after:**
- Supplier → Buat Pengiriman Baru → Submit
- Should succeed

---

### 6️⃣ **notification-system-SAFE.sql** ⏱️ 2 menit
**PRIORITY: LOW - Execute SIXTH (Optional)**

**Problem:**
- No auto-notifications when shipment approved/rejected

**What it does:**
- Creates notification triggers
- Auto-notify admin when supplier submits
- Auto-notify supplier when admin approves/rejects

**How to execute:**
1. Copy ALL → Paste → Run
2. Expected: Triggers created

---

## 📋 Quick Verification Checklist

After executing all SQL files:

### ✅ Admin Tests
- [ ] Login admin → No infinite recursion error
- [ ] Kelola Pengiriman → Shows real supplier names
- [ ] Kelola Pengiriman → Shows product counts (e.g., "5 jenis")
- [ ] Kelola Pengiriman → Shows quantities (e.g., "100 unit")
- [ ] Detail → Click Approve → Works
- [ ] Detail → Click Reject → Works
- [ ] Detail (REJECTED status) → Shows Delete button

### ✅ Supplier Tests
- [ ] Login supplier → No infinite recursion error
- [ ] Pengaturan → Edit nama/telepon/alamat → Simpan → Success toast
- [ ] Buat Pengiriman Baru → Submit → Success
- [ ] Dashboard → Shows shipment timeline

---

## 🔧 Troubleshooting

### Error: "policy already exists"
**Fix:** SQL file already handles this with `DROP POLICY IF EXISTS`

### Error: "column does not exist"
**Fix:** Execute `add-supplier-columns.sql` first

### Error: "function not unique"
**Fix:** Execute `fix-notification-functions.sql`

### Error: "infinite recursion"
**Fix:** Execute `fix-recursive-rls.sql`

---

## 📊 Before vs After

| Issue | Before | After |
|-------|--------|-------|
| Supplier settings | ❌ Error: column not found | ✅ Saves successfully |
| Admin login | ❌ Infinite recursion | ✅ Login works |
| Supplier login | ❌ Infinite recursion | ✅ Login works |
| Admin shipments | ❌ "Unknown Supplier", "0 jenis" | ✅ Real data shows |
| Admin approve/reject | ❌ Function not found | ✅ Works |
| Supplier submit | ❌ Function not unique | ✅ Works |
| Notifications | ❌ Not working | ✅ Auto-notify |

---

## 🎯 Summary

**Total SQL files:** 6  
**Execution time:** ~10 minutes  
**Priority order:** 1 → 2 → 3 → 4 → 5 → 6

**Must execute (1-3)** to fix critical issues.  
**Optional (4-6)** to enable full functionality.

---

## 📞 Support

If you encounter errors:
1. Check Supabase SQL Editor output
2. Copy exact error message
3. Check which SQL file caused the error
4. Verify execution order was followed
