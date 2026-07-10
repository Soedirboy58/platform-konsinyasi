# Quick Reference: Inventory Race Condition Fix

## 🚨 The Problem
**Symptom:** Supplier ships 8 units → Storefront shows 22 pcs  
**Cause:** Race condition in approval function  
**Impact:** 2-3x inventory multiplication  

## ✅ The Solution
**What:** Migration 036 + Frontend guards  
**Where:** Database function + Admin shipments page  
**When:** Deploy ASAP (affects inventory accuracy)  

---

## 🚀 Quick Deploy (5 Steps)

### Step 1: Database (5 min)
```sql
-- In Supabase SQL Editor, run:
-- File: backend/migrations/036_fix_approve_stock_movement_race_condition.sql

-- Verify it worked:
SELECT proname, pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'approve_stock_movement';
-- Should show GET DIAGNOSTICS in the code
```

### Step 2: Find Affected Data (5 min)
```sql
-- In Supabase SQL Editor, run:
-- File: database/DIAGNOSTIC-INVENTORY-DISCREPANCY.sql

-- Look for rows where:
-- - status = 'SURPLUS (Possible Duplicate)'
-- - multiplier > 2.0
```

### Step 3: Fix Data (Variable)
```sql
-- For each affected product, manually correct:
UPDATE inventory_levels
SET quantity = <correct_value>, last_updated = NOW()
WHERE product_id = '<id>' AND location_id = '<id>';

-- Example: Product had 22, should be 8:
UPDATE inventory_levels
SET quantity = 8, last_updated = NOW()
WHERE product_id = 'abc-123' AND location_id = 'xyz-789';
```

### Step 4: Deploy Frontend (2 min)
```bash
# Frontend changes are already committed
# Just deploy to Vercel:
git push origin main
# Or use Vercel dashboard to deploy
```

### Step 5: Test (5 min)
```sql
-- In Supabase SQL Editor, run:
-- File: database/TEST-APPROVE-RACE-CONDITION.sql

-- All tests should pass:
-- ✓ TEST 1 PASSED: Single approval works
-- ✓ TEST 2 PASSED: Duplicate blocked
-- ✓ TEST 3 PASSED: Multiple shipments work
```

---

## 🔍 Quick Diagnostic

### Check if Bug Affects You
```sql
-- Count products with suspicious inventory:
SELECT COUNT(*) as affected_products
FROM inventory_levels il
JOIN stock_movement_items smi ON smi.product_id = il.product_id
JOIN stock_movements sm ON sm.id = smi.movement_id
WHERE sm.status = 'APPROVED'
  AND il.quantity > smi.quantity * 1.5  -- More than 1.5x expected
GROUP BY il.product_id, il.location_id;

-- If count > 0, you have affected products
```

### Find Specific Problem Products
```sql
-- Get list of affected products with details:
SELECT 
  p.name,
  il.quantity as actual,
  smi.quantity as expected,
  ROUND(il.quantity::NUMERIC / smi.quantity, 2) as multiplier
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN stock_movement_items smi ON smi.product_id = il.product_id
JOIN stock_movements sm ON sm.id = smi.movement_id
WHERE sm.status = 'APPROVED'
  AND il.quantity > smi.quantity * 1.5
ORDER BY multiplier DESC;
```

---

## 🛠️ Quick Fixes

### If Approval Still Duplicates After Fix
```bash
# 1. Verify migration was applied:
SELECT * FROM pg_proc WHERE proname = 'approve_stock_movement';
# Should contain 'GET DIAGNOSTICS v_updated_rows'

# 2. Check function version:
SELECT obj_description(oid) FROM pg_proc WHERE proname = 'approve_stock_movement';
# Should mention "Fixed race condition in v036"

# 3. Force refresh in app:
# Clear browser cache, hard reload (Ctrl+Shift+R)
```

### If Test Fails
```sql
-- Clean up test data and try again:
DELETE FROM stock_movement_items WHERE movement_id IN (
  SELECT sm.id FROM stock_movements sm
  JOIN suppliers s ON s.id = sm.supplier_id
  WHERE s.business_name = 'TEST_SUPPLIER_RACE_CONDITION'
);

DELETE FROM stock_movements WHERE supplier_id IN (
  SELECT id FROM suppliers WHERE business_name = 'TEST_SUPPLIER_RACE_CONDITION'
);

-- Then re-run: database/TEST-APPROVE-RACE-CONDITION.sql
```

---

## 📊 Monitoring

### Weekly Check (Run Every Monday)
```sql
-- File: database/DIAGNOSTIC-INVENTORY-DISCREPANCY.sql
-- Section: "STEP 2: Compare inventory vs sum of approved shipments"

-- If any rows show:
-- - status = 'SURPLUS (Possible Duplicate)'
-- - discrepancy > 0
-- → Investigate and correct
```

### Real-Time Alert Setup
```sql
-- Create a view for easy monitoring:
CREATE OR REPLACE VIEW inventory_anomalies AS
SELECT 
  p.name,
  il.quantity as actual,
  COALESCE(SUM(smi.quantity), 0) as expected,
  il.quantity - COALESCE(SUM(smi.quantity), 0) as difference
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
LEFT JOIN stock_movement_items smi ON smi.product_id = il.product_id
LEFT JOIN stock_movements sm ON sm.id = smi.movement_id AND sm.status = 'APPROVED'
GROUP BY p.name, il.quantity, il.product_id
HAVING il.quantity != COALESCE(SUM(smi.quantity), 0);

-- Check it:
SELECT * FROM inventory_anomalies WHERE difference > 5;
```

---

## 📞 Troubleshooting

### Issue: "Function not found" error
**Fix:** Run migration 036 first

### Issue: "Permission denied" error  
**Fix:** Use admin/postgres role to run migration

### Issue: Frontend still shows duplicate dialogs
**Fix:** Clear browser cache, deploy latest code

### Issue: Inventory still wrong after fix
**Fix:** This is old data; run diagnostic and manually correct

### Issue: Test fails on cleanup
**Fix:** Test user doesn't have delete permissions; use admin role

---

## 📚 Full Documentation

- **Technical:** `docs/FIX-INVENTORY-RACE-CONDITION.md`
- **Visual:** `docs/RACE-CONDITION-DIAGRAM.md`
- **Summary:** `SOLUTION-SUMMARY.md`

---

## 🆘 Emergency Rollback

If something goes wrong, restore old function:

```sql
-- File: backend/migrations/036_fix_approve_stock_movement_race_condition.sql
-- See "ROLLBACK PROCEDURE" section at bottom
-- Copy and run the rollback SQL provided there
```

---

## ✅ Success Criteria

After deployment, verify:

1. ☐ Migration applied (check with `\df approve_stock_movement`)
2. ☐ All tests pass (run TEST-APPROVE-RACE-CONDITION.sql)
3. ☐ Manual approval works (test in UI)
4. ☐ Button disables during processing (UI feedback)
5. ☐ No duplicate inventory additions (monitor for 24h)

---

## 📞 Support

**Questions?** Check full documentation first:
- Technical details: `docs/FIX-INVENTORY-RACE-CONDITION.md`
- Visual guide: `docs/RACE-CONDITION-DIAGRAM.md`

**Still stuck?** 
- Review PR comments and discussion
- Check Supabase logs for errors
- Verify all migrations up to 036 are applied

---

**Last Updated:** 2025-12-12  
**Version:** 1.0  
**Status:** Production Ready ✅
