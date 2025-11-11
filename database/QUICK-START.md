# 🚀 QUICK START - Shipment Notification System

## ⚡ 3-Step Activation

### **STEP 1: Execute SQL** (2 minutes)

1. Open **Supabase Dashboard**
2. Click **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy paste entire content dari: `database/notification-system.sql`
5. Click **Run** (or Ctrl+Enter)
6. ✅ Wait for: `SUCCESS: Notification system created!`

---

### **STEP 2: Verify Setup** (1 minute)

Run this query in SQL Editor:

```sql
-- Quick verification
SELECT 
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE '%notify%') as triggers_count,
  (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%notification%') as functions_count,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'notifications') as columns_count;
```

**Expected Output:**
```
triggers_count: 2
functions_count: 3
columns_count: 8
```

✅ If numbers match → System ready!

---

### **STEP 3: Test Live** (5 minutes)

1. **Login as Supplier** → https://[YOUR-DOMAIN]/supplier/shipments/new
2. Submit pengiriman (any products)
3. **Check notification created:**
   ```sql
   SELECT * FROM notifications 
   WHERE type = 'SHIPMENT_SUBMITTED' 
   ORDER BY created_at DESC LIMIT 1;
   ```
4. **Login as Admin** → https://[YOUR-DOMAIN]/admin/shipments
5. Click **Detail** → Click **Approve**
6. **Check supplier notification:**
   ```sql
   SELECT * FROM notifications 
   WHERE type = 'SHIPMENT_APPROVED' 
   ORDER BY created_at DESC LIMIT 1;
   ```

✅ If notifications exist → **FULLY WORKING!** 🎉

---

## 📊 Dashboard URLs

| Role | Dashboard | Shipment Management |
|------|-----------|---------------------|
| **Supplier** | `/supplier` | `/supplier/shipments/new` |
| **Admin** | `/admin` | `/admin/shipments` |

---

## 🔍 Quick Troubleshooting

### ❌ Error: "column user_id does not exist"
**Fix**: You ran old version. Re-copy `notification-system.sql` and run again.

### ❌ Notifications not created
**Check triggers:**
```sql
SELECT tgname, tgenabled FROM pg_trigger 
WHERE tgname IN ('trg_notify_shipment', 'trg_notify_shipment_decision');
```
**Both should show**: `tgenabled = 'O'` (enabled)

### ❌ recipient_id is NULL
**Check supplier profile:**
```sql
SELECT id, profile_id FROM suppliers WHERE profile_id IS NULL;
```
**Fix if needed:**
```sql
UPDATE suppliers SET profile_id = '[PROFILE_ID]' WHERE id = '[SUPPLIER_ID]';
```

---

## 📖 Full Documentation

- **Complete Guide**: `database/TESTING-NOTIFICATION-GUIDE.md`
- **Testing Queries**: `database/test-notifications.sql`
- **Full Summary**: `database/SHIPMENT-IMPLEMENTATION-SUMMARY.md`

---

## ✅ Success Checklist

- [ ] SQL executed without errors
- [ ] 2 triggers active
- [ ] 3 functions created
- [ ] Supplier submits shipment → Admin gets notification
- [ ] Admin approves → Supplier gets notification
- [ ] Dashboard KPIs show correct counts

---

**All green? System is LIVE! 🚀**

**Need help?** Check `TESTING-NOTIFICATION-GUIDE.md` for detailed troubleshooting.
