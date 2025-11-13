# 💰 Fix: Sinkronisasi Pembayaran ke Supplier

## 📋 Problem

Halaman **"Pembayaran ke Supplier"** (`/admin/payments/commissions`) masih menggunakan sistem lama:
- ❌ Query dari tabel `sales` (sudah tidak dipakai)
- ❌ Kalkulasi manual commission (tidak sesuai data aktual)
- ❌ Status hardcoded `UNPAID` (tidak sync dengan wallet)
- ❌ Tidak menggunakan data dari `supplier_wallets`
- ❌ Tidak sync dengan sistem `confirm_payment` yang baru

## ✅ Solution Implemented

### **1. Query Data dari Sistem Baru**

**BEFORE (Broken):**
```typescript
// ❌ Query tabel sales yang sudah tidak dipakai
const { data: sales } = await supabase
  .from('sales')
  .select('id, quantity, total_price, created_at')
  .eq('product.supplier_id', supplier.id)

const totalSales = sales.reduce((sum, sale) => sum + sale.total_price, 0)
const commissionRate = 0.10 // Hardcoded
const platformFee = totalSales * commissionRate
const supplierReceives = totalSales - platformFee
```

**AFTER (Fixed):**
```typescript
// ✅ Query sales_transaction_items + supplier_wallets
const { data: salesItems } = await supabase
  .from('sales_transaction_items')
  .select(`
    id,
    quantity,
    price,
    subtotal,
    supplier_revenue,        // ✅ Actual revenue supplier terima
    commission_amount,       // ✅ Actual commission platform
    product_id,
    sales_transactions!inner(
      id,
      status,
      created_at,
      transaction_code
    )
  `)
  .gte('sales_transactions.created_at', startDate)
  .eq('sales_transactions.status', 'COMPLETED')  // ✅ Only completed

// ✅ Calculate from ACTUAL data
const totalSales = supplierSales.reduce((sum, item) => 
  sum + (item.subtotal || 0), 0
)
const totalRevenue = supplierSales.reduce((sum, item) => 
  sum + (item.supplier_revenue || 0), 0
)
const totalCommission = supplierSales.reduce((sum, item) => 
  sum + (item.commission_amount || 0), 0
)
```

---

### **2. Sync Status dengan Wallet Balance**

**BEFORE (Broken):**
```typescript
// ❌ Hardcoded status
commissionsData.push({
  ...
  status: 'UNPAID', // Always unpaid!
})
```

**AFTER (Fixed):**
```typescript
// ✅ Get wallet balance from supplier_wallets
const { data: suppliers } = await supabase
  .from('suppliers')
  .select(`
    *,
    supplier_wallets(
      available_balance,
      pending_balance
    )
  `)

const walletBalance = supplier.supplier_wallets?.[0]?.available_balance || 0
const pendingBalance = supplier.supplier_wallets?.[0]?.pending_balance || 0

// ✅ Determine status based on wallet vs revenue
let status: 'UNPAID' | 'PAID' | 'PENDING' = 'UNPAID'

if (pendingBalance > 0) {
  status = 'PENDING'        // Ada pending withdrawal
} else if (walletBalance >= totalRevenue) {
  status = 'PAID'           // Wallet sudah terisi otomatis dari sales
} else {
  status = 'UNPAID'         // Belum bayar (seharusnya tidak terjadi jika confirm_payment berjalan)
}
```

---

### **3. Logika Pembayaran Baru**

**Konsep:**
- ✅ Ketika customer bayar → `confirm_payment()` **otomatis** credit wallet supplier
- ✅ Wallet supplier bertambah **real-time** setiap ada penjualan
- ✅ Admin **tidak perlu** manual transfer untuk penjualan online
- ✅ Halaman ini hanya untuk **tracking & verifikasi** saldo

**Status Explained:**

| Status | Kondisi | Arti | Action |
|--------|---------|------|--------|
| **PAID** | `wallet_balance >= total_revenue` | Supplier sudah terima semua revenue dari penjualan periode ini | ✅ No action needed |
| **UNPAID** | `wallet_balance < total_revenue` | Ada gap antara revenue dan wallet (seharusnya tidak terjadi) | ⚠️ Investigate! Might be old data before fix |
| **PENDING** | `pending_balance > 0` | Supplier sudah request withdrawal yang belum diproses | 🕒 Process withdrawal request |

---

## 🎯 How It Works Now

### **Flow Penjualan → Pembayaran:**

```
1. Customer checkout di /kantin/[slug]
   └─> Creates sales_transaction (PENDING)

2. Customer click "Sudah Bayar" (QRIS/Cash)
   └─> Calls confirm_payment(transaction_id)
       ├─> Update transaction status = COMPLETED
       ├─> FOR EACH item in transaction:
       │   ├─> Credit supplier_wallets.available_balance
       │   ├─> Create wallet_transactions record
       │   └─> Create notification for supplier
       └─> Create notification for admin

3. Supplier sees:
   └─> Notification: "🎉 Produk Terjual!"
   └─> Wallet balance increased
   └─> Revenue in dashboard updated

4. Admin sees at /admin/payments/commissions:
   └─> Supplier status = PAID (already credited)
   └─> Total Sales: Customer payment amount
   └─> Transfer ke Supplier: Amount already in wallet
   └─> No manual action needed (already auto-credited)
```

---

## 📊 Display Logic

**Halaman "Pembayaran ke Supplier" sekarang menampilkan:**

### **Stats Cards:**
```typescript
Total Belum Bayar: 
  Sum of commission_amount WHERE status = 'UNPAID'
  // Should be 0 if confirm_payment is working

Total Sudah Bayar:
  Sum of commission_amount WHERE status = 'PAID'
  // Suppliers who have received payment (auto-credited)

Pending Verifikasi:
  Sum of commission_amount WHERE status = 'PENDING'
  // Suppliers with pending withdrawal requests

Total Supplier:
  Count of suppliers with sales in period
```

### **Table Columns:**

| Column | Data Source | Description |
|--------|-------------|-------------|
| **Supplier** | `suppliers.business_name` | Nama supplier + info bank |
| **Total Penjualan** | `SUM(subtotal)` | Total yang dibayar customer |
| **Transfer ke Supplier** | `SUM(supplier_revenue)` | Yang masuk ke wallet (90%) |
| **Transaksi** | `COUNT(DISTINCT transaction_id)` | Jumlah transaksi |
| **Status** | Based on wallet balance | PAID/UNPAID/PENDING |
| **Aksi** | Conditional | Bayar button (if needed) |

---

## 🔧 Debugging

**Check if Data is Loading Correctly:**

1. Open browser console (F12)
2. Navigate to `/admin/payments/commissions`
3. Look for console output:

```javascript
📊 Commissions Data: {
  totalSuppliers: 5,
  commissionsCount: 3,
  sampleData: [
    {
      supplier_id: "...",
      supplier_name: "Kue Basah Ibu",
      total_sales: 45000,           // Customer paid
      commission_amount: 40500,     // Supplier receives (90%)
      products_sold: 9,
      transactions: 3,
      status: "PAID"                 // ✅ Already in wallet
    },
    ...
  ]
}
```

**If commissionsCount = 0:**
- No completed sales in selected period
- Or confirm_payment not executed yet
- Or RLS blocking query

**If status always "UNPAID":**
- Supplier wallet not created (check `supplier_wallets` table)
- Or `confirm_payment` not crediting wallet
- Or old transactions before fix

---

## 🧪 Testing Checklist

### **Step 1: Execute SQL Fix**
```sql
-- Run in Supabase SQL Editor
-- File: database/fix-confirm-payment-complete.sql
```

### **Step 2: Make Test Sale**
1. Navigate to `/kantin/outlet-lobby-a`
2. Add product to cart (from supplier you want to test)
3. Checkout
4. Click "Verifikasi Bayar QRIS"

### **Step 3: Check Supplier Wallet**
```sql
-- Verify wallet was credited
SELECT 
    sw.available_balance,
    sw.pending_balance,
    s.business_name
FROM supplier_wallets sw
JOIN suppliers s ON s.id = sw.supplier_id
ORDER BY sw.updated_at DESC;

-- Expected: available_balance increased
```

### **Step 4: Check Admin Page**
1. Navigate to `/admin/payments/commissions`
2. Select period: "Bulan Ini"
3. Check:
   - ✅ Supplier appears in list
   - ✅ Total Penjualan = Customer payment
   - ✅ Transfer ke Supplier = 90% of sales
   - ✅ Status = **PAID** (green badge)
   - ✅ "Total Sudah Bayar" stat increased

### **Step 5: Verify Wallet Transaction**
```sql
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

-- Expected: New SALE transaction
-- Description: "Penjualan X unit [Product] di [Outlet]"
-- Amount: supplier_revenue (90% of sale)
```

---

## 📈 Business Logic

### **Example Calculation:**

**Scenario:** Customer beli 2 Roti @ Rp 5,000 = Rp 10,000

| Party | Amount | Calculation |
|-------|--------|-------------|
| **Customer Bayar** | Rp 10,000 | Full price |
| **Platform Komisi (10%)** | Rp 1,000 | 10% × Rp 10,000 |
| **Supplier Terima** | Rp 9,000 | 90% × Rp 10,000 |

**Database Records:**
```sql
-- sales_transaction_items:
subtotal = 10000
commission_rate = 10.00
commission_amount = 1000
supplier_revenue = 9000

-- supplier_wallets (after confirm_payment):
available_balance += 9000

-- wallet_transactions:
transaction_type = 'SALE'
amount = 9000
description = 'Penjualan 2 unit "Roti" di Outlet Lobby A'
```

**Admin Dashboard (`/admin/payments/commissions`):**
```
Supplier: Kue Basah Ibu
Total Penjualan: Rp 10,000
Transfer ke Supplier: Rp 9,000 ✅ (Already in wallet)
Status: PAID (green badge)
```

---

## 🚨 Important Notes

### **1. Automatic Payment vs Manual Payment**

**OLD System (Before Fix):**
- Admin must manually transfer to supplier bank
- Track payment with "Upload Bukti Transfer"
- Status starts as UNPAID

**NEW System (After Fix):**
- **Automatic:** Wallet credited when customer pays
- **No manual transfer** needed for online sales
- Status automatically PAID when wallet credited

**Manual Payment Still Needed For:**
- Withdrawal requests (supplier wants to cash out)
- Adjustments (refunds, compensations)
- Old transactions before system upgrade

---

### **2. Status Logic Clarification**

| Old Data (Before Fix) | New Data (After Fix) |
|-----------------------|----------------------|
| Status always UNPAID | Status automatically PAID |
| Need manual transfer | Already auto-credited |
| Check at commissions page | Check at supplier wallet |

**Migration Note:**
- Old transactions (before SQL fix) may show UNPAID
- This is correct - they were never auto-credited
- Can either:
  - Manually transfer (use "Bayar" button + upload proof)
  - Or mark as reconciled/archived

---

### **3. When to Use "Bayar" Button**

**Use "Bayar" button for:**
- ✅ Old transactions before system fix
- ✅ Manual adjustments
- ✅ Compensations for damaged goods
- ✅ Processing withdrawal requests

**DON'T use for:**
- ❌ New online sales (auto-credited)
- ❌ Transactions already showing PAID status

---

## 🔄 Withdrawal Flow (Future)

**When supplier requests withdrawal:**

1. Supplier clicks "Tarik Saldo" at `/supplier/wallet`
2. Creates `withdrawal_requests` record
3. `supplier_wallets.available_balance` → `pending_balance`
4. Admin sees at `/admin/payments/reconciliation`
5. Admin processes (manual bank transfer)
6. Admin clicks "Approve Withdrawal"
7. `pending_balance` → 0
8. Supplier receives bank transfer

---

## 📁 Files Modified

| File | Changes |
|------|---------|
| `frontend/src/app/admin/payments/commissions/page.tsx` | ✅ Query from sales_transaction_items + supplier_wallets<br>✅ Auto-determine status from wallet balance<br>✅ Show actual commission calculations<br>✅ Added debug console.log |

---

## ✅ Success Criteria

**Fix is successful when:**

1. ✅ `/admin/payments/commissions` shows suppliers with sales
2. ✅ "Total Penjualan" matches actual customer payments
3. ✅ "Transfer ke Supplier" shows correct revenue (90%)
4. ✅ Status shows **PAID** for new transactions (auto-credited)
5. ✅ Console log shows correct data structure
6. ✅ No manual "Bayar" button needed for new sales
7. ✅ Stats cards show correct totals

---

## 🎯 Next Steps

### **Immediate (After SQL Execution):**
1. Execute `fix-confirm-payment-complete.sql`
2. Make test purchase
3. Check `/admin/payments/commissions`
4. Verify status = PAID

### **Optional Enhancements:**
1. Add withdrawal request handling
2. Add payment history export
3. Add reconciliation report
4. Add email notification for payments

---

## 🆘 Troubleshooting

### **Issue: All suppliers show UNPAID**

**Cause:** `confirm_payment` not executed or wallet not credited

**Solution:**
```sql
-- Check if function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'confirm_payment';

-- If not exist, run fix-confirm-payment-complete.sql
```

---

### **Issue: commissionsCount = 0**

**Cause:** No completed sales in period

**Solution:**
1. Change period filter to "Semua Waktu"
2. Or make test purchase
3. Or check RLS policies

---

### **Issue: Total Sales doesn't match reality**

**Cause:** Filter or query issue

**Solution:**
Check console.log for actual data:
```javascript
📊 Commissions Data: {
  commissionsCount: X,
  sampleData: [...]  // Check if numbers are correct
}
```

---

**Status:** ✅ **READY TO TEST**

**Dependencies:** Must execute `fix-confirm-payment-complete.sql` first!

**Impact:** Makes payment tracking automatic and accurate!
