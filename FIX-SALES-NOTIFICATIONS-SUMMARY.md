# 🔔 Fix: Sales Notifications & Revenue Tracking

## 📋 Problem Summary

User melakukan transaksi penjualan (5 produk terjual dari stok 75 → 70), tetapi:

### ❌ **Di Dashboard Supplier:**
1. **Tidak ada notifikasi penjualan real-time** - Supplier tidak tahu produknya terjual
2. **Pendapatan aktual tidak berubah** - Meskipun produk terjual, wallet tidak ter-update

### ❌ **Di Dashboard Admin:**
1. **Pendapatan hari ini masih 0** - Seharusnya muncul revenue dari penjualan
2. **KPI "Omset Hari Ini" masih 0** - Tidak menghitung dari sales_transaction_items
3. **Tidak ada notifikasi transaksi baru** - Admin tidak tahu ada penjualan hari ini

---

## 🔍 Root Cause Analysis

### **1. Incomplete `confirm_payment` Function**

**File:** `backend/migrations/012_confirm_payment_function.sql`

**Problem:**
```sql
-- Old function ONLY updates status:
UPDATE sales_transactions
SET status = 'COMPLETED',
    updated_at = NOW()
WHERE id = p_transaction_id;

RETURN QUERY SELECT TRUE, 'Pembayaran dikonfirmasi';
-- ❌ No wallet credit
-- ❌ No supplier notification
-- ❌ No admin notification
```

**Missing Logic:**
- ✗ Tidak credit wallet supplier dengan `supplier_revenue`
- ✗ Tidak create notification untuk supplier
- ✗ Tidak create notification untuk admin
- ✗ Tidak create record di `wallet_transactions`

---

### **2. Wrong Column Names in Supplier Dashboard**

**File:** `frontend/src/app/supplier/page.tsx`

**Problem:**
```typescript
// ❌ WRONG: Column 'price_at_sale' doesn't exist
const { data: salesData } = await supabase
  .from('sales_transaction_items')
  .select('quantity, price_at_sale')  // ❌ Wrong column
  .in('product_id', productIds)

const actualRevenue = salesData?.reduce((sum, item) => 
  sum + (item.quantity * item.price_at_sale), 0  // ❌ Wrong calculation
) || 0
```

**Should be:**
```typescript
// ✅ CORRECT: Use 'supplier_revenue' column
const { data: salesData } = await supabase
  .from('sales_transaction_items')
  .select('quantity, supplier_revenue, sales_transactions!inner(status)')
  .in('product_id', productIds)
  .eq('sales_transactions.status', 'COMPLETED')  // ✅ Only completed

const actualRevenue = salesData?.reduce((sum, item) => 
  sum + (item.supplier_revenue || 0), 0  // ✅ Direct revenue
) || 0
```

---

### **3. Wrong Table/Relation in Admin Dashboard**

**File:** `frontend/src/app/admin/page.tsx`

**Problem:**
```typescript
// ❌ WRONG: 'sales_items' relation doesn't exist
const { data: todaySales } = await supabase
  .from('sales_transactions')
  .select('*, sales_items(quantity, subtotal), products(name), locations(name)')
  //           ^^^^^^^^^^^ Wrong relation name
  .gte('created_at', today.toISOString())

const dailyRevenue = todaySales?.reduce((sum, sale) => {
  const saleTotal = sale.sales_items?.reduce(...)  // ❌ Undefined
  return sum + saleTotal
}, 0) || 0
```

**Should be:**
```typescript
// ✅ CORRECT: Query sales_transaction_items separately
const { data: todaySales } = await supabase
  .from('sales_transactions')
  .select('id, transaction_code, total_amount, created_at')
  .gte('created_at', today.toISOString())
  .eq('status', 'COMPLETED')

const transactionIds = todaySales?.map(t => t.id) || []
const { data: salesItems } = await supabase
  .from('sales_transaction_items')
  .select('transaction_id, quantity, subtotal, commission_amount')
  .in('transaction_id', transactionIds)

const dailyRevenue = salesItems?.reduce((sum, item) => 
  sum + (item.subtotal || 0), 0
) || 0

const dailyCommission = salesItems?.reduce((sum, item) => 
  sum + (item.commission_amount || 0), 0
) || 0
```

---

## ✅ Solutions Implemented

### **Fix 1: Enhanced `confirm_payment` Function**

**Created File:** `database/fix-confirm-payment-complete.sql`

**New Features:**
1. ✅ **Credit Supplier Wallet** - Add `supplier_revenue` to `supplier_wallets.available_balance`
2. ✅ **Create Wallet Transaction** - Record in `wallet_transactions` table
3. ✅ **Notify Supplier** - Create notification: "🎉 Produk Terjual! X unit [product] terjual di [outlet]"
4. ✅ **Notify Admin** - Create notification: "💰 Transaksi Baru di [outlet], Total: Rp X, Komisi: Rp Y"

**Key Logic:**
```sql
FOR v_item IN 
    SELECT 
        sti.supplier_revenue,
        sti.commission_amount,
        p.name AS product_name,
        s.profile_id
    FROM sales_transaction_items sti
    JOIN products p ON p.id = sti.product_id
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE sti.transaction_id = p_transaction_id
LOOP
    -- 1. Credit wallet
    UPDATE supplier_wallets
    SET available_balance = available_balance + v_item.supplier_revenue
    WHERE supplier_id = v_supplier_id;
    
    -- 2. Create wallet transaction
    INSERT INTO wallet_transactions (...)
    VALUES ('SALE', v_item.supplier_revenue, 'Penjualan ...');
    
    -- 3. Notify supplier
    INSERT INTO notifications (...)
    VALUES (v_supplier_profile_id, '🎉 Produk Terjual!', ...);
END LOOP;

-- 4. Notify admin
INSERT INTO notifications (...)
VALUES (v_admin_id, '💰 Transaksi Baru', ...);
```

---

### **Fix 2: Supplier Dashboard Query Fixes**

**Modified File:** `frontend/src/app/supplier/page.tsx`

**Changes:**

1. **Actual Revenue Calculation:**
```typescript
// BEFORE: Wrong column + no status filter
.select('quantity, price_at_sale')
.in('product_id', productIds)

// AFTER: Correct column + filter completed
.select('quantity, supplier_revenue, sales_transactions!inner(status)')
.in('product_id', productIds)
.eq('sales_transactions.status', 'COMPLETED')
```

2. **Top Products Revenue:**
```typescript
// BEFORE: Manual calculation with wrong column
acc[pid].total_revenue += item.quantity * item.price_at_sale

// AFTER: Direct revenue from database
acc[pid].total_revenue += item.supplier_revenue || 0
```

3. **Recent Sales Notifications:**
```typescript
// BEFORE: Wrong column name
price: item.price_at_sale

// AFTER: Correct column
price: item.supplier_revenue || 0
```

---

### **Fix 3: Admin Dashboard Query Fixes**

**Modified File:** `frontend/src/app/admin/page.tsx`

**Changes:**

1. **Query Pattern:**
```typescript
// BEFORE: Wrong nested relation
.select('*, sales_items(quantity, subtotal), ...')
//           ^^^^^^^^^^^ Doesn't exist

// AFTER: Separate queries
const { data: todaySales } = await supabase
  .from('sales_transactions')
  .select('id, transaction_code, total_amount, created_at')
  .eq('status', 'COMPLETED')

const { data: salesItems } = await supabase
  .from('sales_transaction_items')
  .select('transaction_id, quantity, subtotal, commission_amount')
  .in('transaction_id', transactionIds)
```

2. **Revenue Calculation:**
```typescript
// BEFORE: Nested reduce (broken)
const dailyRevenue = todaySales?.reduce((sum, sale) => {
  const saleTotal = sale.sales_items?.reduce(...)  // ❌ Undefined
  return sum + saleTotal
}, 0)

// AFTER: Direct calculation
const dailyRevenue = salesItems?.reduce((sum, item) => 
  sum + (item.subtotal || 0), 0
) || 0
```

3. **Added Commission Tracking:**
```typescript
const dailyCommission = salesItems?.reduce((sum, item) => 
  sum + (item.commission_amount || 0), 0
) || 0

setStats({
  ...
  dailyRevenue: dailyRevenue,
  dailySales: todaySales?.length || 0,
  dailyCommission: dailyCommission  // ✅ New metric
})
```

---

## 📝 Action Plan

### **Step 1: Execute SQL Fix** ⏰ **5 minutes**

1. Open **Supabase Dashboard** → SQL Editor
2. Open file: `database/fix-confirm-payment-complete.sql`
3. Execute SQL
4. Verify success message

**Expected Output:**
```
✅ Fix: confirm_payment now credits wallets and creates notifications - SUCCESS!
```

---

### **Step 2: Test Complete Flow** ⏰ **10 minutes**

#### **A. Make a Test Purchase**

1. Navigate to: `https://your-domain.vercel.app/kantin/outlet-lobby-a`
2. Add 1-2 products to cart
3. Click "Checkout"
4. Click "Lanjut ke Pembayaran"
5. Click "Verifikasi Bayar QRIS" (or "Bayar Tunai")

**Expected Result:**
- ✅ Transaction status = COMPLETED
- ✅ Inventory decreased

---

#### **B. Check Supplier Dashboard**

1. Login as **Supplier** (the one whose products were sold)
2. Navigate to: `/supplier`
3. Verify:
   - ✅ **Pendapatan Aktual** increased (e.g., from Rp 0 → Rp 4,500)
   - ✅ **Notification bell** shows new notification
   - ✅ Click notification: "🎉 Produk Terjual! X unit [product] terjual di [outlet]"

4. Navigate to: `/supplier/wallet`
5. Verify:
   - ✅ **Saldo Tersedia** increased
   - ✅ Transaction appears in wallet history: "Penjualan X unit [product] di [outlet]"

6. Navigate to: `/supplier/sales-report`
7. Verify:
   - ✅ New sale appears in table
   - ✅ Correct quantity and revenue shown

---

#### **C. Check Admin Dashboard**

1. Login as **Admin**
2. Navigate to: `/admin`
3. Verify:
   - ✅ **Pendapatan Hari Ini** shows revenue (e.g., Rp 5,000)
   - ✅ **Penjualan Hari Ini** shows count (e.g., 1 transaksi)
   - ✅ **Notification bell** shows new notification
   - ✅ Click notification: "💰 Transaksi Baru di [outlet], Total: Rp X, Komisi: Rp Y"

4. Navigate to: `/admin/transactions` (if exists)
5. Verify:
   - ✅ Today's transaction appears
   - ✅ Status = COMPLETED

---

### **Step 3: Verify Database Records**

Run these queries in **Supabase SQL Editor:**

```sql
-- 1. Check wallet was credited
SELECT 
    sw.available_balance,
    sw.pending_balance,
    s.business_name
FROM supplier_wallets sw
JOIN suppliers s ON s.id = sw.supplier_id
ORDER BY sw.updated_at DESC;

-- Expected: available_balance increased

-- 2. Check wallet transaction created
SELECT 
    wt.transaction_type,
    wt.amount,
    wt.description,
    wt.created_at,
    s.business_name
FROM wallet_transactions wt
JOIN supplier_wallets sw ON sw.id = wt.wallet_id
JOIN suppliers s ON s.id = sw.supplier_id
WHERE wt.transaction_type = 'SALE'
ORDER BY wt.created_at DESC
LIMIT 5;

-- Expected: New SALE transaction record

-- 3. Check supplier notifications
SELECT 
    n.title,
    n.message,
    n.type,
    n.is_read,
    n.created_at,
    p.full_name,
    p.role
FROM notifications n
JOIN profiles p ON p.id = n.recipient_id
WHERE n.type = 'SALE'
  AND p.role = 'SUPPLIER'
ORDER BY n.created_at DESC
LIMIT 5;

-- Expected: "🎉 Produk Terjual!" notification

-- 4. Check admin notifications
SELECT 
    n.title,
    n.message,
    n.type,
    n.is_read,
    n.created_at,
    p.full_name,
    p.role
FROM notifications n
JOIN profiles p ON p.id = n.recipient_id
WHERE n.type = 'SALE'
  AND p.role = 'ADMIN'
ORDER BY n.created_at DESC
LIMIT 5;

-- Expected: "💰 Transaksi Baru" notification

-- 5. Check sales data integrity
SELECT 
    st.transaction_code,
    st.total_amount,
    st.status,
    st.created_at,
    sti.quantity,
    sti.price,
    sti.subtotal,
    sti.commission_amount,
    sti.supplier_revenue,
    p.name AS product_name,
    s.business_name
FROM sales_transactions st
JOIN sales_transaction_items sti ON sti.transaction_id = st.id
JOIN products p ON p.id = sti.product_id
JOIN suppliers s ON s.id = p.supplier_id
WHERE st.created_at >= CURRENT_DATE
ORDER BY st.created_at DESC;

-- Expected: All commission and revenue calculations correct
```

---

## 🎯 Expected Results After Fix

### **Before Fix:**

| Metric | Supplier | Admin |
|--------|----------|-------|
| Revenue Display | Rp 0 (wrong) | Rp 0 (wrong) |
| Notifications | None | None |
| Wallet Balance | Not updated | N/A |
| Transaction Count | N/A | 0 transaksi |

### **After Fix:**

| Metric | Supplier | Admin |
|--------|----------|-------|
| Revenue Display | ✅ Rp 4,500 (90% of sale) | ✅ Rp 5,000 (total) |
| Notifications | ✅ "🎉 Produk Terjual!" | ✅ "💰 Transaksi Baru" |
| Wallet Balance | ✅ Increased by revenue | N/A |
| Transaction Count | N/A | ✅ 1 transaksi |
| Commission Shown | ✅ Rp 500 (10%) | ✅ Rp 500 (10%) |

---

## 📊 Business Logic Verification

### **Example Sale: Rp 5,000 Product**

| Party | Calculation | Amount |
|-------|-------------|--------|
| **Customer Pays** | Full price | **Rp 5,000** |
| **Platform Commission** | 10% × Rp 5,000 | **Rp 500** |
| **Supplier Receives** | 90% × Rp 5,000 | **Rp 4,500** |

**Database Records:**
```sql
-- sales_transaction_items:
subtotal = 5000
commission_rate = 10.00
commission_amount = 500
supplier_revenue = 4500

-- supplier_wallets:
available_balance += 4500

-- wallet_transactions:
amount = 4500
transaction_type = 'SALE'

-- notifications (supplier):
"🎉 Produk Terjual! 1 unit [Product] terjual di [Outlet]. 
 Pendapatan: Rp 4,500 (Komisi platform: Rp 500)"

-- notifications (admin):
"💰 Transaksi Baru di [Outlet]. 
 Total: Rp 5,000 | Komisi platform: Rp 500 | Kode: KNT-..."
```

---

## 🚨 Troubleshooting

### **Issue: Wallet Not Credited**

**Diagnosis:**
```sql
-- Check if confirm_payment was called
SELECT status, updated_at 
FROM sales_transactions 
WHERE transaction_code = 'KNT-...'
AND status = 'COMPLETED';
```

**If PENDING:** User didn't click "Verifikasi Bayar"
**If COMPLETED but no wallet:** Old function still active, re-run SQL

---

### **Issue: No Notifications Created**

**Diagnosis:**
```sql
-- Check if notifications table exists
SELECT COUNT(*) FROM notifications WHERE type = 'SALE';

-- Check if supplier has profile_id
SELECT s.id, s.profile_id, p.full_name
FROM suppliers s
LEFT JOIN profiles p ON p.id = s.profile_id
WHERE s.id = 'YOUR_SUPPLIER_ID';
```

**If profile_id NULL:** Supplier registration incomplete
**If 0 notifications:** Function error, check logs

---

### **Issue: Admin Dashboard Still Shows 0**

**Diagnosis:**
```sql
-- Check if sales exist today
SELECT COUNT(*), SUM(total_amount)
FROM sales_transactions
WHERE created_at >= CURRENT_DATE
  AND status = 'COMPLETED';

-- Check if sales_transaction_items has data
SELECT COUNT(*), SUM(subtotal), SUM(commission_amount)
FROM sales_transaction_items sti
JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE st.created_at >= CURRENT_DATE
  AND st.status = 'COMPLETED';
```

**If COUNT = 0:** No completed sales today, make test purchase
**If COUNT > 0 but dashboard shows 0:** Hard refresh (Ctrl+Shift+R)

---

## 📁 Files Modified

| File | Type | Changes |
|------|------|---------|
| `database/fix-confirm-payment-complete.sql` | **NEW** | Complete rewrite of confirm_payment function |
| `frontend/src/app/supplier/page.tsx` | **MODIFIED** | Fixed 3 queries: actualRevenue, topProducts, recentSales |
| `frontend/src/app/admin/page.tsx` | **MODIFIED** | Fixed query pattern + added dailyCommission |

---

## ✅ Success Criteria

**Fix is successful when:**

1. ✅ User melakukan checkout → Supplier **langsung menerima notifikasi**
2. ✅ Wallet supplier **otomatis bertambah** dengan revenue (bukan full price)
3. ✅ Admin **menerima notifikasi** setiap ada transaksi baru
4. ✅ Dashboard admin **menampilkan pendapatan hari ini** dengan benar
5. ✅ Dashboard supplier **menampilkan pendapatan aktual** dengan benar
6. ✅ Komisi platform **terhitung dan tercatat** di database
7. ✅ Wallet transactions **terekam** untuk audit trail

---

## 🔄 Next Steps (Optional)

### **1. Email Notifications** (Future Enhancement)
- Send email to supplier when product sold
- Send daily sales summary to admin
- Use Supabase Edge Functions + SendGrid

### **2. Push Notifications** (Future Enhancement)
- Use Firebase Cloud Messaging
- Real-time alerts on mobile devices

### **3. Sales Analytics** (Future Enhancement)
- Daily/weekly/monthly revenue charts
- Top selling products dashboard
- Commission tracking per period

---

## 📞 Support

**If issues persist after following this guide:**

1. Check Supabase logs for function errors
2. Verify RLS policies allow data insertion
3. Confirm user roles are correct (ADMIN vs SUPPLIER)
4. Check browser console for frontend errors

**Common Mistakes:**
- ❌ Forgetting to execute SQL file in Supabase
- ❌ Not hard-refreshing frontend after SQL changes
- ❌ Testing with PENDING transaction (must be COMPLETED)
- ❌ Using wrong user role (supplier checking admin dashboard)

---

**Status:** ✅ **READY TO DEPLOY**

**Estimated Fix Time:** 15 minutes (5 min SQL + 10 min testing)

**Risk Level:** 🟢 **LOW** - Only adds functionality, doesn't break existing

**Rollback Plan:** Drop new function, revert to old `confirm_payment` (simple UPDATE only)
