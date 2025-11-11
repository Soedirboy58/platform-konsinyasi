# 💰 Commission System Audit & Fix

## 📋 Audit Result

**User Question:** "Harga jual Rp 5.000 tetap 5rb, tetapi saat produk habis supplier mendapat 5rb dikali jumlah produk dikurang 10% fee/komisi, apakah kamu sudah sesuaikan seperti itu?"

**Answer:** ❌ **BELUM! System sebelumnya TIDAK mencatat komisi di database.**

---

## 🔍 Problems Found

### **Problem 1: No Commission Tracking in Database**

**Before:**
```typescript
// ❌ Fungsi checkout TIDAK menyimpan komisi
INSERT INTO sales_transaction_items (
    transaction_id, product_id, quantity, price, subtotal
) VALUES (...);
// Missing: commission_rate, commission_amount, supplier_revenue
```

**Impact:**
- ❌ Customer pays Rp 5,000 → Recorded as Rp 5,000 subtotal
- ❌ No record of 10% commission (Rp 500)
- ❌ No record of supplier's actual revenue (Rp 4,500)
- ❌ Dashboard calculated commission **only in frontend** (not permanent)

---

### **Problem 2: Frontend Calculates Commission on the Fly**

**Before:**
```typescript
// ❌ Frontend kalkulasi manual setiap render
const totalRevenue = salesData.reduce(sum + item.subtotal)
const supplierRate = 100 - platformCommissionRate
const estimatedRevenue = (totalRevenue × supplierRate) / 100
```

**Issues:**
- ❌ Calculation not stored in DB
- ❌ If commission rate changes, old transactions miscalculated
- ❌ No audit trail for commission amounts

---

## ✅ Solution Implemented

### **Migration 026: Add Commission Columns**

Added to `sales_transaction_items` table:
```sql
ALTER TABLE sales_transaction_items
ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 10.00 NOT NULL,
ADD COLUMN commission_amount DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
ADD COLUMN supplier_revenue DECIMAL(15,2) DEFAULT 0.00 NOT NULL;
```

**Purpose:**
- `commission_rate`: Platform fee percentage (10%)
- `commission_amount`: Actual commission in Rupiah (subtotal × 10%)
- `supplier_revenue`: What supplier receives (subtotal - commission)

**Backfill:**
```sql
-- Update existing records with 10% commission
UPDATE sales_transaction_items
SET 
    commission_rate = 10.00,
    commission_amount = ROUND(subtotal * 0.10, 2),
    supplier_revenue = ROUND(subtotal * 0.90, 2);
```

---

### **Migration 027: Update Checkout Function**

**New Checkout Flow:**
```sql
CREATE FUNCTION process_anonymous_checkout(...) AS $$
DECLARE
    v_commission_rate DECIMAL(5,2);
    v_commission_amount DECIMAL(15,2);
    v_supplier_revenue DECIMAL(15,2);
BEGIN
    -- Get platform commission rate from settings
    SELECT COALESCE(value::DECIMAL, 10.00) INTO v_commission_rate
    FROM platform_settings
    WHERE key = 'commission_rate';
    
    -- For each item:
    v_subtotal := v_quantity * v_price;  -- Customer pays full
    v_commission_amount := ROUND(v_subtotal * (v_commission_rate / 100), 2);
    v_supplier_revenue := v_subtotal - v_commission_amount;
    
    -- Insert with commission data
    INSERT INTO sales_transaction_items (
        transaction_id, product_id, quantity, price, subtotal,
        commission_rate, commission_amount, supplier_revenue
    ) VALUES (...);
END;
$$;
```

**Example Calculation:**
```
Product: Biskuit Rp 5,000 × 3 unit

Customer Checkout:
├─ Subtotal: Rp 15,000 (customer pays full)
├─ Commission (10%): Rp 1,500 (platform)
└─ Supplier Revenue: Rp 13,500 (90%)

Database Record:
{
  quantity: 3,
  price: 5000,
  subtotal: 15000,          ← Customer pays this
  commission_rate: 10.00,   ← Platform %
  commission_amount: 1500,  ← Platform gets this
  supplier_revenue: 13500   ← Supplier gets this
}
```

---

### **Frontend Update: Use Stored Commission**

**Before:**
```typescript
// ❌ Calculate on every render
const totalRevenue = salesData.reduce(sum + item.subtotal)
const estimatedRevenue = (totalRevenue * 90) / 100
```

**After:**
```typescript
// ✅ Use pre-calculated supplier_revenue
const estimatedRevenue = salesData.reduce(sum + item.supplier_revenue)
```

**Benefits:**
- ✅ Accurate historical data (commission rate at time of sale)
- ✅ No recalculation needed
- ✅ Consistent with database records

---

## 📊 Complete Flow Validation

### **Scenario: Customer Buys 2 Products**

**Products:**
1. Biskuit Kelapa - Rp 5,000 × 2 = Rp 10,000
2. Kopi Sachet - Rp 3,000 × 5 = Rp 15,000

**Step 1: Customer Checkout**
```
Total: Rp 25,000 (full price)
Customer scans QRIS → Pays Rp 25,000
```

**Step 2: Database Records Created**
```sql
-- sales_transactions
INSERT INTO sales_transactions (
    transaction_code: 'KNT-20251111-143025',
    total_amount: 25000,  -- Customer paid
    status: 'PENDING'
);

-- sales_transaction_items
INSERT INTO sales_transaction_items VALUES
-- Item 1: Biskuit
(quantity: 2, price: 5000, subtotal: 10000,
 commission_rate: 10, commission_amount: 1000, supplier_revenue: 9000),

-- Item 2: Kopi
(quantity: 5, price: 3000, subtotal: 15000,
 commission_rate: 10, commission_amount: 1500, supplier_revenue: 13500);
```

**Step 3: Admin Verifies Payment**
```
Status: PENDING → COMPLETED
```

**Step 4: Supplier Dashboard Updates**
```typescript
// Produk Terjual: 2 + 5 = 7 unit
soldCount = SUM(quantity) = 7

// Saldo Estimasi: Rp 9,000 + Rp 13,500 = Rp 22,500
estimatedRevenue = SUM(supplier_revenue) = 22500

// Platform Commission: Rp 1,000 + Rp 1,500 = Rp 2,500
totalCommission = SUM(commission_amount) = 2500
```

**Validation:**
```
Customer Paid:       Rp 25,000 ✓
Platform Commission: Rp  2,500 (10%) ✓
Supplier Revenue:    Rp 22,500 (90%) ✓
Total:               Rp 25,000 ✓
```

---

## 🎯 Key Points

### **Customer Perspective:**
- ✅ Pays **full price** (Rp 5,000 per item)
- ✅ No hidden fees
- ✅ Price displayed = price paid

### **Platform Perspective:**
- ✅ Earns 10% commission per transaction
- ✅ Commission tracked per item
- ✅ Audit trail for all fees

### **Supplier Perspective:**
- ✅ Sees actual revenue (after commission)
- ✅ Dashboard shows **net income**
- ✅ Historical commission rate preserved

---

## 📁 Files Changed

### **Backend:**
1. `backend/migrations/026_add_commission_to_sales.sql` - **NEW**
   - Add 3 columns to `sales_transaction_items`
   - Backfill existing data with 10% commission

2. `backend/migrations/027_update_checkout_with_commission.sql` - **NEW**
   - Update `process_anonymous_checkout` function
   - Calculate commission per item at checkout time

### **Frontend:**
1. `frontend/src/app/supplier/page.tsx` - **UPDATED**
   - Use `supplier_revenue` instead of calculating `subtotal * 0.9`
   - Monthly growth based on net revenue
   - Top products ranked by supplier revenue

---

## 🚀 Deployment Status

**Frontend:** ✅ **DEPLOYED**
- URL: https://platform-konsinyasi-v1-qjte6gkx0-katalaras-projects.vercel.app
- Build: Success (3 seconds)
- Changes: Dashboard now uses `supplier_revenue`

**Backend:** ⏳ **PENDING** (3 Migrations)
1. Migration 025 - Product curation fields
2. Migration 026 - Commission columns
3. Migration 027 - Checkout with commission

---

## 📋 Required Actions

### **Critical (Wajib Execute):**

**1. Execute Migration 026** (2 minutes)
```sql
-- In Supabase SQL Editor, run:
-- backend/migrations/026_add_commission_to_sales.sql
```
- Adds commission tracking columns
- Backfills existing transactions with 10% commission

**2. Execute Migration 027** (2 minutes)
```sql
-- In Supabase SQL Editor, run:
-- backend/migrations/027_update_checkout_with_commission.sql
```
- Updates checkout function to calculate commission
- New transactions will have commission recorded automatically

### **Testing:**

**3. Test Complete Flow** (10 minutes)
```
Step 1: Customer Checkout
- Buy 1 product: Rp 5,000
- Verify payment: Status COMPLETED

Step 2: Check Database
SELECT * FROM sales_transaction_items 
WHERE transaction_id = '<your_transaction_id>';

Expected:
- subtotal: 5000
- commission_rate: 10.00
- commission_amount: 500
- supplier_revenue: 4500

Step 3: Supplier Dashboard
- Check "Saldo Estimasi" increased by Rp 4,500 (not Rp 5,000)
- Verify "Produk Terjual" count increased
```

---

## ✅ Summary

**Question:** Apakah sistem sudah sesuai? (Harga jual tetap, komisi dipotong dari supplier)

**Answer:** 
- ❌ **SEBELUMNYA:** Tidak! Komisi tidak tercatat di database
- ✅ **SEKARANG:** Sudah benar! 
  - Customer pays Rp 5,000 (full price)
  - Platform gets Rp 500 (10% commission)
  - Supplier receives Rp 4,500 (90% net)
  - Semua tercatat di database

**Status:** ✅ Fixed with Migrations 026 & 027
**Next:** Execute migrations in Supabase to activate
