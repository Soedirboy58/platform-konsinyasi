# 🔄 Fix: Sinkronisasi Pembayaran Supplier

## 🐛 Problem Yang Dilaporkan

1. ✅ **Sudah dilakukan pembayaran dan konfirmasi** → Berhasil
2. ❌ **Riwayat pembayaran belum sinkron** → Masih mock data
3. ❌ **Status kembali ke "Belum Bayar"** → Tidak persist ke database

### Root Cause:
- Tidak ada tabel database untuk menyimpan payment records
- Status PAID/UNPAID hanya tersimpan di local state (hilang saat reload)
- Riwayat pembayaran menggunakan mock data

---

## ✅ Solution Implemented

### 1. **Created Database Table: `supplier_payments`**

**File:** `database/create-supplier-payment-table.sql`

**Purpose:** Track manual bank transfer payments from admin to suppliers

**Schema:**
```sql
CREATE TABLE supplier_payments (
    id UUID PRIMARY KEY,
    supplier_id UUID NOT NULL,
    wallet_id UUID,
    
    -- Payment details
    amount DECIMAL(15,2) NOT NULL,
    payment_reference VARCHAR(100) UNIQUE,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'BANK_TRANSFER',
    
    -- Bank details
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_account_holder VARCHAR(200),
    
    -- Supporting documents
    payment_proof_url TEXT,
    notes TEXT,
    
    -- Status & Period
    status VARCHAR(20) DEFAULT 'COMPLETED',
    period_start DATE,
    period_end DATE,
    
    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features:**
- ✅ Unique payment_reference constraint
- ✅ Period tracking (period_start, period_end)
- ✅ RLS policies for Admin & Supplier
- ✅ Indexes for performance
- ✅ Audit trail (created_by, timestamps)

---

### 2. **Updated Payment Commissions Page**

**File:** `frontend/src/app/admin/payments/commissions/page.tsx`

#### Changes:

**A. Load Payment Records from Database**
```typescript
// Get payment records for the period
const { data: paymentRecords } = await supabase
  .from('supplier_payments')
  .select('supplier_id, amount, payment_date, payment_reference')
  .gte('payment_date', startDate.toISOString().split('T')[0])
  .eq('status', 'COMPLETED')

// Group payments by supplier
const paymentMap = new Map<string, any[]>()
```

**B. Updated Status Logic**
```typescript
// Check if this supplier has been paid in this period
const payments = paymentMap.get(supplierId) || []
const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

// Status logic - UPDATED to check payment records
let status: 'UNPAID' | 'PAID' | 'PENDING' = 'UNPAID'

// 1. Check if manual payment exists for this period
if (totalPaid >= totalRevenue) {
  status = 'PAID'
}
// 2. Check if pending withdrawal request
else if (pendingBalance > 0) {
  status = 'PENDING'
}
// 3. Otherwise unpaid
else {
  status = 'UNPAID'
}
```

**C. Save Payment to Database**
```typescript
async function handleSubmitPayment() {
  // Insert payment record
  const { data: payment, error } = await supabase
    .from('supplier_payments')
    .insert({
      supplier_id: selectedCommission.supplier_id,
      wallet_id: wallet?.id || null,
      amount: selectedCommission.commission_amount,
      payment_reference: paymentReference,
      payment_date: paymentDate,
      payment_method: 'BANK_TRANSFER',
      bank_name: selectedCommission.bank_name,
      bank_account_number: selectedCommission.bank_account,
      bank_account_holder: selectedCommission.bank_holder,
      notes: paymentNotes || null,
      status: 'COMPLETED',
      period_start: periodStart.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      created_by: user.id
    })
    .select()
    .single()

  // Reload to get fresh data
  loadCommissions()
}
```

---

### 3. **Updated Payment History Page**

**File:** `frontend/src/app/admin/payments/history/page.tsx`

#### Changes:

**Before (Mock Data):**
```typescript
const mockPayments: PaymentHistory[] = [
  {
    id: '1',
    supplier_name: 'Toko Elektronik Jaya',
    amount: 5000000,
    // ...
  }
]
```

**After (Real Database Query):**
```typescript
async function loadPaymentHistory() {
  const { data, error } = await supabase
    .from('supplier_payments')
    .select(`
      id,
      supplier_id,
      amount,
      payment_reference,
      payment_date,
      payment_method,
      payment_proof_url,
      notes,
      created_at,
      suppliers!inner(
        business_name
      )
    `)
    .gte('payment_date', startDate.toISOString().split('T')[0])
    .eq('status', 'COMPLETED')
    .order('payment_date', { ascending: false })

  const paymentHistory: PaymentHistory[] = (data || []).map(p => ({
    id: p.id,
    supplier_id: p.supplier_id,
    supplier_name: p.suppliers?.business_name || 'Unknown',
    amount: p.amount,
    payment_date: p.payment_date,
    payment_reference: p.payment_reference,
    payment_method: p.payment_method || 'Transfer Bank',
    payment_proof: p.payment_proof_url,
    notes: p.notes,
    created_at: p.created_at
  }))

  setPayments(paymentHistory)
}
```

---

## 🔄 Complete Data Flow

### Before Fix:
```
1. Admin click "Bayar" → Modal opens
2. Admin fill & submit → Save to LOCAL STATE only ❌
3. Refresh page → Status kembali UNPAID ❌
4. Riwayat Pembayaran → Show mock data ❌
```

### After Fix:
```
1. Admin click "Bayar" → Modal opens
   ↓
2. Admin fill payment reference (auto-generated)
   ↓
3. Admin submit → Save to DATABASE ✅
   - INSERT into supplier_payments table
   - Store payment_reference, amount, date, bank details
   - Link to supplier_id
   ↓
4. Reload commissions → Query database ✅
   - Check supplier_payments for PAID status
   - Display correct status based on records
   ↓
5. Riwayat Pembayaran → Load from database ✅
   - SELECT from supplier_payments
   - Join with suppliers table
   - Display real payment history
   ↓
6. Refresh page → Status persist ✅
   - Status PAID tetap karena ada di database
```

---

## 📊 Data Consistency Logic

### Status Determination (Priority Order):

1. **PAID** - Jika `supplier_payments` memiliki record dengan:
   ```typescript
   totalPaid >= totalRevenue
   ```
   
2. **PENDING** - Jika ada withdrawal request:
   ```typescript
   pendingBalance > 0
   ```

3. **UNPAID** - Default jika tidak ada payment record dan no pending

---

## 🗄️ Database Relationships

```
suppliers
    ├── supplier_wallets (1:1)
    │   └── wallet_transactions (1:many)
    │
    └── supplier_payments (1:many) ← NEW TABLE
            ├── Links to supplier_id
            ├── Links to wallet_id (optional)
            └── Tracks manual payments
```

---

## 🚀 Deployment Steps

### Step 1: Execute SQL
```sql
-- In Supabase SQL Editor
-- File: database/create-supplier-payment-table.sql
```

### Step 2: Verify Table Created
```sql
-- Check table exists
SELECT * FROM supplier_payments LIMIT 1;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'supplier_payments';
```

### Step 3: Test Flow
1. Go to Admin → Pembayaran Supplier
2. Click "Bayar" on a supplier
3. Fill payment reference (auto-generated)
4. Submit payment
5. Check status changes to "Sudah Bayar"
6. Refresh page → Status still "Sudah Bayar" ✅
7. Go to Riwayat Pembayaran → See payment record ✅

---

## ✅ Success Criteria

### ✓ Before This Fix (Issues):
- ❌ Payment tidak persist
- ❌ Status kembali UNPAID setelah reload
- ❌ Riwayat pembayaran mock data
- ❌ Tidak ada audit trail

### ✓ After This Fix (Working):
- ✅ Payment tersimpan di database
- ✅ Status PAID persist setelah reload
- ✅ Riwayat pembayaran real data
- ✅ Complete audit trail
- ✅ Payment reference unique constraint
- ✅ Period tracking
- ✅ Bank details stored

---

## 📋 Verification Queries

### Check Payment Records:
```sql
SELECT 
  sp.payment_reference,
  sp.amount,
  sp.payment_date,
  s.business_name as supplier,
  sp.period_start,
  sp.period_end
FROM supplier_payments sp
JOIN suppliers s ON s.id = sp.supplier_id
WHERE sp.status = 'COMPLETED'
ORDER BY sp.payment_date DESC;
```

### Check Total Paid to Each Supplier:
```sql
SELECT 
  s.business_name,
  COUNT(*) as payment_count,
  SUM(sp.amount) as total_paid
FROM supplier_payments sp
JOIN suppliers s ON s.id = sp.supplier_id
WHERE sp.status = 'COMPLETED'
GROUP BY s.id, s.business_name
ORDER BY total_paid DESC;
```

### Check Payment Status Consistency:
```sql
-- For debugging: compare wallet balance vs payment records
SELECT 
  s.business_name,
  sw.available_balance,
  COALESCE(SUM(sp.amount), 0) as total_payments
FROM suppliers s
LEFT JOIN supplier_wallets sw ON sw.supplier_id = s.id
LEFT JOIN supplier_payments sp ON sp.supplier_id = s.id AND sp.status = 'COMPLETED'
GROUP BY s.id, s.business_name, sw.available_balance;
```

---

## 🔧 Configuration

### RLS Policies Applied:

1. **Admin Full Access**
   ```sql
   - SELECT: View all supplier payments
   - INSERT: Create payment records
   - UPDATE: Update payment status/details
   ```

2. **Supplier View Only**
   ```sql
   - SELECT: View their own payments only
   ```

3. **Security**
   - All policies check `profiles.role` and `is_active`
   - Suppliers filtered by `profile_id = auth.uid()`

---

## 📝 Notes

### Important Distinctions:

1. **Automatic Wallet Credit (via confirm_payment)**
   - When customer pays → Wallet auto-credited
   - Tracked in `wallet_transactions` table
   - Type: 'SALE'

2. **Manual Payment Tracking (via supplier_payments)** ← THIS FIX
   - When admin transfers to supplier bank
   - Tracked in `supplier_payments` table
   - Type: 'BANK_TRANSFER'

### These are DIFFERENT flows:
- Wallet credit = Customer → Platform → Wallet (automatic)
- Manual payment = Platform → Supplier Bank (manual transfer)

---

## 🎯 Benefits

1. **Data Persistence** - Status tidak hilang saat reload
2. **Audit Trail** - Complete history of all payments
3. **Reconciliation** - Easy to match payments with bank statements
4. **Reporting** - Generate payment reports by period
5. **Compliance** - Proper record keeping for accounting
6. **Unique Reference** - Prevent duplicate payments

---

## 🐛 Troubleshooting

### Issue: Status masih UNPAID setelah payment
**Check:**
```sql
-- Verify payment record exists
SELECT * FROM supplier_payments 
WHERE supplier_id = 'YOUR_SUPPLIER_ID'
AND status = 'COMPLETED';
```

### Issue: Riwayat pembayaran kosong
**Check:**
1. SQL executed? `SELECT * FROM supplier_payments;`
2. RLS policies aktif? Check Supabase dashboard
3. Period filter terlalu sempit? Try "Semua Waktu"

### Issue: Error saat submit payment
**Check:**
1. User authenticated? Check session
2. Unique constraint violated? Check payment_reference
3. Console log for error details

---

**Files Modified:**
1. ✅ `database/create-supplier-payment-table.sql` (NEW)
2. ✅ `frontend/src/app/admin/payments/commissions/page.tsx` (UPDATED)
3. ✅ `frontend/src/app/admin/payments/history/page.tsx` (UPDATED)

**Deployment Required:**
1. Execute SQL in Supabase
2. Deploy frontend changes
3. Test complete flow

---

**Created:** November 13, 2024  
**Version:** 2.0.0  
**Status:** Ready for Testing
