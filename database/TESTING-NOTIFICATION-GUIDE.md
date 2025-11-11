# 🚀 NOTIFICATION SYSTEM - Testing Guide

## 📋 Prerequisites

✅ SQL script `notification-system.sql` sudah dijalankan di Supabase  
✅ Frontend sudah deployed (shipment KPIs & admin approval page)  
✅ Ada minimal 1 admin account dan 1 supplier account  

---

## 🧪 Testing Workflow

### **STEP 1: Verify Database Setup**

Run di **Supabase SQL Editor**:

```sql
-- Check notifications table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications';

-- Check triggers are active
SELECT tgname, tgrelid::regclass, tgenabled 
FROM pg_trigger 
WHERE tgname IN ('trg_notify_shipment', 'trg_notify_shipment_decision');
```

**Expected Output:**
- Table `notifications` dengan columns: id, recipient_id, type, title, message, reference_id, reference_type, is_read, created_at
- 2 triggers: `trg_notify_shipment` dan `trg_notify_shipment_decision` dengan status ENABLED

---

### **STEP 2: Test Supplier Submit Shipment**

#### **Action:**
1. Login sebagai **Supplier** di frontend
2. Navigate to `/supplier/shipments/new`
3. Fill form:
   - Select location (e.g., "Kantin Pusat")
   - Add products (e.g., "Nasi Goreng" qty 10, "Mie Goreng" qty 15)
   - Add notes: "Test pengiriman untuk verifikasi notification system"
4. Click **Submit**

#### **Verify in Database:**

```sql
-- Check latest shipment
SELECT * FROM stock_movements 
ORDER BY created_at DESC 
LIMIT 1;

-- Check notification created for admins
SELECT 
    n.type,
    n.title,
    n.message,
    p.full_name as admin_name,
    n.is_read,
    n.created_at
FROM notifications n
JOIN profiles p ON n.recipient_id = p.id
WHERE n.type = 'SHIPMENT_SUBMITTED'
ORDER BY n.created_at DESC;
```

**Expected:**
- ✅ Notification dengan `type = 'SHIPMENT_SUBMITTED'`
- ✅ Message: "[Supplier Name] mengajukan pengiriman produk. Silakan review."
- ✅ `recipient_id` = profile_id dari admin(s)
- ✅ `is_read = false`

---

### **STEP 3: Test Admin Dashboard KPIs**

#### **Action:**
1. Login sebagai **Admin**
2. Navigate to `/admin` (dashboard)

#### **Verify:**
- ✅ Alert kuning muncul: "Ada X supplier, Y produk, dan **Z pengiriman** menunggu approval"
- ✅ KPI Card "Pengajuan Pending" menunjukkan angka > 0
- ✅ KPI Card "Pengiriman Hari Ini" menunjukkan +1

#### **Query to Verify:**

```sql
-- Check pending shipments count
SELECT COUNT(*) as pending_count
FROM stock_movements
WHERE status = 'PENDING';

-- Check today's shipments
SELECT COUNT(*) as today_count
FROM stock_movements
WHERE created_at::date = CURRENT_DATE;
```

---

### **STEP 4: Test Admin Approve Shipment**

#### **Action:**
1. Tetap login sebagai **Admin**
2. Navigate to `/admin/shipments`
3. Verify list muncul dengan shipment yang baru disubmit
4. Click **Detail** button
5. Modal muncul dengan detail produk
6. Click **Approve** button (green)

#### **Verify in Database:**

```sql
-- Check shipment status changed
SELECT id, status, approved_at, approved_by
FROM stock_movements
WHERE id = '[SHIPMENT_ID_FROM_STEP2]';

-- Check notification created for supplier
SELECT 
    n.type,
    n.title,
    n.message,
    p.full_name as supplier_name,
    n.is_read
FROM notifications n
JOIN profiles p ON n.recipient_id = p.id
WHERE n.type = 'SHIPMENT_APPROVED'
ORDER BY n.created_at DESC
LIMIT 1;
```

**Expected:**
- ✅ `status = 'APPROVED'`
- ✅ `approved_at` has timestamp
- ✅ `approved_by` = admin user_id
- ✅ Notification created dengan `type = 'SHIPMENT_APPROVED'`
- ✅ Message: "Pengajuan pengiriman Anda telah disetujui oleh admin."
- ✅ `recipient_id` = supplier's profile_id

---

### **STEP 5: Test Supplier Dashboard KPIs Update**

#### **Action:**
1. Logout admin
2. Login sebagai **Supplier** (yang submit shipment tadi)
3. Navigate to `/supplier` (dashboard)

#### **Verify:**
- ✅ KPI Card "Pengiriman Pending" = 0 (berkurang)
- ✅ KPI Card "Pengiriman Disetujui" = +1 (bertambah)
- ✅ KPI Card "Total Produk Terkirim" = +25 (10 + 15 dari step 2)

#### **Query to Verify:**

```sql
-- Check supplier's shipment stats
SELECT 
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
    COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected
FROM stock_movements
WHERE supplier_id = '[SUPPLIER_ID]';

-- Check total products shipped
SELECT SUM(smi.quantity) as total_shipped
FROM stock_movement_items smi
JOIN stock_movements sm ON smi.movement_id = sm.id
WHERE sm.supplier_id = '[SUPPLIER_ID]'
  AND sm.status = 'APPROVED';
```

---

### **STEP 6: Test Admin Reject Shipment**

#### **Action:**
1. Login as **Supplier** again
2. Submit another shipment (repeat Step 2)
3. Login as **Admin**
4. Go to `/admin/shipments`
5. Click **Detail** on new shipment
6. Click **Reject** button (red)
7. Modal muncul dengan textarea
8. Input reason: "Stok gudang penuh, mohon tunggu 3 hari"
9. Click **Konfirmasi Penolakan**

#### **Verify in Database:**

```sql
-- Check shipment rejected
SELECT status, rejection_reason
FROM stock_movements
WHERE id = '[NEW_SHIPMENT_ID]';

-- Check notification for supplier
SELECT 
    n.type,
    n.title,
    n.message,
    n.is_read
FROM notifications n
WHERE n.type = 'SHIPMENT_REJECTED'
ORDER BY n.created_at DESC
LIMIT 1;
```

**Expected:**
- ✅ `status = 'REJECTED'`
- ✅ `rejection_reason` = "Stok gudang penuh, mohon tunggu 3 hari"
- ✅ Notification created: "Pengajuan pengiriman Anda ditolak. Alasan: [rejection_reason]"

---

### **STEP 7: Verify All Notifications**

#### **Query:**

```sql
-- Get comprehensive notification view
SELECT 
    n.id,
    n.type,
    n.title,
    n.message,
    n.is_read,
    TO_CHAR(n.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_time,
    p.full_name as recipient,
    p.role as recipient_role
FROM notifications n
LEFT JOIN profiles p ON n.recipient_id = p.id
ORDER BY n.created_at DESC
LIMIT 20;
```

**Expected Table:**

| type | title | recipient | role | is_read |
|------|-------|-----------|------|---------|
| SHIPMENT_REJECTED | Pengiriman Ditolak | Supplier A | SUPPLIER | false |
| SHIPMENT_APPROVED | Pengiriman Disetujui | Supplier A | SUPPLIER | false |
| SHIPMENT_SUBMITTED | Pengajuan Pengiriman Baru | Admin 1 | ADMIN | false |
| SHIPMENT_SUBMITTED | Pengajuan Pengiriman Baru | Admin 2 | ADMIN | false |

---

### **STEP 8: Performance Check**

#### **Query:**

```sql
-- Count notifications by type
SELECT 
    type,
    COUNT(*) as total,
    COUNT(CASE WHEN is_read = true THEN 1 END) as read_count,
    COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count
FROM notifications
GROUP BY type;

-- Check trigger execution speed (optional)
EXPLAIN ANALYZE
INSERT INTO stock_movements (supplier_id, location_id, movement_type, status, notes)
VALUES (
    (SELECT id FROM suppliers LIMIT 1),
    (SELECT id FROM locations LIMIT 1),
    'INCOMING',
    'PENDING',
    'Performance test'
);
```

---

## ✅ Success Criteria

**System is working correctly if:**

1. ✅ Trigger `trg_notify_shipment` fires on INSERT stock_movements
2. ✅ Notifications created for **ALL admins** when supplier submits
3. ✅ Trigger `trg_notify_shipment_decision` fires on UPDATE status
4. ✅ Notification created for **specific supplier** when admin approves/rejects
5. ✅ Dashboard KPIs reflect real-time shipment counts
6. ✅ Admin page shows all shipments with correct status badges
7. ✅ Approve/Reject actions update database and create notifications
8. ✅ No errors in console or SQL logs

---

## 🐛 Troubleshooting

### **Issue 1: Notifications not created**

**Check:**
```sql
-- Verify triggers exist and enabled
SELECT * FROM pg_trigger 
WHERE tgname LIKE '%notify%';

-- Check function exists
SELECT proname FROM pg_proc 
WHERE proname IN ('notify_admins_on_shipment', 'notify_supplier_on_shipment_decision');
```

**Fix:** Re-run `notification-system.sql`

---

### **Issue 2: recipient_id NULL**

**Check:**
```sql
-- Verify suppliers have profile_id
SELECT id, profile_id FROM suppliers WHERE profile_id IS NULL;

-- Verify admins have role
SELECT id, role FROM profiles WHERE role = 'ADMIN';
```

**Fix:** 
```sql
-- Set missing profile_id
UPDATE suppliers SET profile_id = '[PROFILE_ID]' WHERE id = '[SUPPLIER_ID]';

-- Set admin role
UPDATE profiles SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

---

### **Issue 3: Trigger not firing**

**Check:**
```sql
-- Test manual trigger
SELECT notify_admins_on_shipment() FROM stock_movements LIMIT 1;
```

**Fix:** 
```sql
-- Recreate trigger
DROP TRIGGER IF EXISTS trg_notify_shipment ON stock_movements;
CREATE TRIGGER trg_notify_shipment
    AFTER INSERT ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION notify_admins_on_shipment();
```

---

## 📊 Monitoring Queries

Use file: `database/test-notifications.sql` for comprehensive testing queries including:

- TEST 1: Check All Notifications
- TEST 2: Check Shipment Notifications
- TEST 3: Check Notifications for Admins
- TEST 4: Check Notifications for Suppliers
- TEST 5: Recent Shipments with Notifications
- TEST 6: Verify Triggers Active
- TEST 7: Unread Count per User
- TEST 8: Manual Test Creation
- TEST 9: Latest Notifications Full Details
- TEST 10: Performance Check by Type

---

## 🎯 Next Steps

After all tests pass:

1. **Build Notification Bell Component** (Phase 5)
   - Real-time badge count
   - Dropdown list with mark as read
   - Link to reference (shipment detail)

2. **Add to Admin Layout**
   - Bell icon in topbar
   - WebSocket or polling for real-time updates

3. **Add to Supplier Layout** (optional)
   - Same bell component
   - Show shipment approval/rejection notifications

---

**All tests passed? Congratulations! 🎉 Notification system is fully operational.**
