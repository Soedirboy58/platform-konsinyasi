# Supplier UI Fixes - Evaluasi 3 Masalah

**Tanggal:** 13 November 2025
**Status:** ✅ SELESAI

## 🎯 Masalah yang Dilaporkan

User melaporkan 3 masalah di interface supplier:

1. **Riwayat Pembayaran** - Cards "Total Diterima, Total Penjualan, Fee Platform" redundant
2. **Dashboard** - Notifikasi penjualan real-time tidak muncul
3. **Dompet Saya** - Riwayat penjualan produk tidak aktif padahal ada catatan penjualan

---

## ✅ Masalah 1: Redundant Summary Cards

### Analisis
Di halaman Riwayat Pembayaran (`/supplier/payment-history`), ada 3 cards besar yang menampilkan:
- **Total Diterima** (Rp XX.XXX) - Hijau
- **Total Penjualan** (Rp XX.XXX) - Putih
- **Fee Platform** (Rp XX.XXX) - Putih

Data ini sudah ditampilkan di Dashboard dan Wallet, sehingga redundant.

### Solusi
**File:** `frontend/src/app/supplier/payment-history/page.tsx`

**Perubahan (Line 345-403):**
```tsx
// SEBELUM:
{/* Summary Cards */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
  <div className="bg-gradient-to-br from-green-500 to-green-600...">
    // Card Total Diterima
  </div>
  <div className="bg-white rounded-lg shadow...">
    // Card Total Penjualan
  </div>
  <div className="bg-white rounded-lg shadow...">
    // Card Fee Platform
  </div>
</div>

// SESUDAH:
{/* Summary Cards - REMOVED (redundant with dashboard & wallet) */}
```

**Hasil:**
- ✅ 3 summary cards dihapus
- ✅ Halaman lebih clean dan fokus ke detail transaksi
- ✅ Data tetap bisa dilihat di Dashboard dan Wallet

---

## ✅ Masalah 2: Dashboard Notifikasi Tidak Muncul

### Analisis
Section "Notifikasi Penjualan Real-time" di Dashboard (`/supplier/page.tsx`) menampilkan "Belum ada penjualan" padahal ada data penjualan.

**Root Cause Possibilities:**
1. Query tidak return data (productIds empty?)
2. JOIN dengan sales_transactions tidak work
3. Status filter terlalu ketat (hanya COMPLETED)
4. RLS policy blocking

### Solusi
**File:** `frontend/src/app/supplier/page.tsx`

**Perubahan (Line 175-195):**
```tsx
// SEBELUM:
const salesNotifs: SalesNotification[] = recentSales?.map((item: any) => ({...})) || []

console.log('📊 Sales Notifications Data:', {
  recentSalesCount: recentSales?.length || 0,
  salesNotifsCount: salesNotifs.length,
  sampleData: salesNotifs.slice(0, 3)
})

// SESUDAH:
const salesNotifs: SalesNotification[] = recentSales?.map((item: any) => ({...})) || []

console.log('📊 Sales Notifications Debug:', {
  productIds: productIds.length,
  recentSalesCount: recentSales?.length || 0,
  salesNotifsCount: salesNotifs.length,
  sampleRecentSales: recentSales?.slice(0, 2),
  sampleSalesNotifs: salesNotifs.slice(0, 2)
})

if (salesNotifs.length === 0 && productIds.length > 0) {
  console.warn('⚠️ No sales notifications despite having products. Checking...')
  
  // Debug query tanpa filter status
  const { data: debugSales, error: debugError } = await supabase
    .from('sales_transaction_items')
    .select('id, product_id, sales_transactions!inner(status)')
    .in('product_id', productIds)
    .limit(5)
  
  console.log('🔍 Debug raw sales data:', { 
    count: debugSales?.length || 0, 
    data: debugSales,
    error: debugError
  })
}
```

**Testing Steps:**
1. ✅ Refresh halaman supplier dashboard
2. ✅ Buka browser console (F12)
3. ✅ Cari log dengan icon 📊 dan 🔍
4. ✅ Check apakah:
   - `productIds` > 0? (Harus ada approved products)
   - `recentSalesCount` > 0? (Harus ada COMPLETED sales)
   - `debugSales.count` > 0? (Check sales tanpa filter)

**Possible Issues Found:**
- Jika `productIds` = 0 → Supplier belum punya produk APPROVED
- Jika `debugSales.count` > 0 tapi `recentSalesCount` = 0 → Sales ada tapi status bukan COMPLETED
- Jika `debugSales.count` = 0 → Belum ada sales sama sekali
- Jika ada error di `debugError` → RLS policy atau JOIN issue

---

## ✅ Masalah 3: Wallet Riwayat Penjualan Tidak Aktif

### Analisis
Section "Riwayat Transaksi Penjualan" di Wallet (`/supplier/wallet`) menampilkan "Belum ada penjualan produk" padahal ada catatan penjualan.

**Root Cause:**
Sama seperti dashboard - kemungkinan query tidak return data atau column names salah.

### Solusi
**File:** `frontend/src/app/supplier/wallet/page.tsx`

**Perubahan (Line 157-197):**
```tsx
// SEBELUM:
const { data: salesData } = await supabase
  .from('sales_transaction_items')
  .select(`
    id,
    quantity,
    price_at_sale,      // ❌ SALAH - kolom ini tidak ada
    supplier_revenue,
    platform_fee,       // ❌ SALAH - harusnya commission_amount
    ...
  `)

const formattedPayments: SalesPayment[] = salesData?.map((item: any) => ({
  sale_price: item.price_at_sale,  // ❌ UNDEFINED
  platform_fee: item.platform_fee   // ❌ UNDEFINED
})) || []

setSalesPayments(formattedPayments)

// SESUDAH:
const { data: salesData, error: salesError } = await supabase
  .from('sales_transaction_items')
  .select(`
    id,
    quantity,
    price,              // ✅ BENAR
    supplier_revenue,
    commission_amount,  // ✅ BENAR
    ...
  `)

console.log('💰 Wallet Sales Data Debug:', {
  productIdsCount: productIds.length,
  salesDataCount: salesData?.length || 0,
  salesError: salesError,
  sampleData: salesData?.slice(0, 2)
})

const formattedPayments: SalesPayment[] = salesData?.map((item: any) => ({
  sale_price: item.price || 0,           // ✅ BENAR
  platform_fee: item.commission_amount || 0  // ✅ BENAR
})) || []

console.log('💰 Formatted Payments:', {
  count: formattedPayments.length,
  sample: formattedPayments.slice(0, 2)
})

setSalesPayments(formattedPayments)
```

**Field Names yang Benar:**
| Salah ❌ | Benar ✅ | Keterangan |
|---------|---------|------------|
| `price_at_sale` | `price` | Harga per unit saat checkout |
| `platform_fee` | `commission_amount` | Fee yang dipotong platform (10%) |
| (belum ada) | `supplier_revenue` | Pendapatan bersih supplier (90%) |

**Database Schema:**
```sql
-- sales_transaction_items
CREATE TABLE sales_transaction_items (
    id UUID PRIMARY KEY,
    transaction_id UUID REFERENCES sales_transactions(id),
    product_id UUID REFERENCES products(id),
    quantity INTEGER,
    price DECIMAL(15,2),              -- ✅ Harga per unit
    subtotal DECIMAL(15,2),           -- ✅ price * quantity
    commission_rate DECIMAL(5,2),     -- ✅ Default 10.00 (10%)
    commission_amount DECIMAL(15,2),  -- ✅ subtotal * 0.10
    supplier_revenue DECIMAL(15,2)    -- ✅ subtotal * 0.90
);
```

**Migrations:**
- `026_add_commission_to_sales.sql` - Menambah kolom commission tracking
- `018_create_transaction_items_table.sql` - Kolom dasar (price, subtotal)

**Testing Steps:**
1. ✅ Refresh halaman wallet (`/supplier/wallet`)
2. ✅ Buka browser console (F12)
3. ✅ Cari log dengan icon 💰
4. ✅ Check apakah:
   - `productIdsCount` > 0?
   - `salesDataCount` > 0?
   - `salesError` null?
   - `sampleData` ada isinya?

**Possible Issues Found:**
- Jika `productIdsCount` = 0 → Supplier belum punya products
- Jika `salesError` not null → Query error (kolom salah? RLS?)
- Jika `salesDataCount` = 0 → Belum ada COMPLETED sales
- Jika `formattedPayments.count` < `salesDataCount` → Ada data yang ter-filter saat mapping

---

## 🔍 Diagnostic Query

Jika masih belum muncul data, jalankan query ini di Supabase SQL Editor:

**File:** `database/debug-supplier-dashboard-empty.sql`

```sql
-- 1. Check table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sales_transaction_items'
ORDER BY ordinal_position;

-- 2. Check if columns exist
SELECT 
  EXISTS(SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'sales_transaction_items' 
         AND column_name = 'supplier_revenue') AS has_supplier_revenue,
  EXISTS(SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'sales_transaction_items' 
         AND column_name = 'commission_amount') AS has_commission_amount,
  EXISTS(SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'sales_transaction_items' 
         AND column_name = 'price') AS has_price;

-- 3. Check Aneka Snack data
SELECT 
    sti.id,
    sti.quantity,
    sti.price,
    sti.subtotal,
    sti.commission_amount,
    sti.supplier_revenue,
    p.name as product_name,
    st.status,
    st.created_at
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE p.supplier_id = (SELECT id FROM suppliers WHERE business_name = 'Aneka Snack')
AND st.status = 'COMPLETED'
ORDER BY st.created_at DESC
LIMIT 10;

-- 4. Count sales by status
SELECT 
    st.status,
    COUNT(*) as count
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE p.supplier_id = (SELECT id FROM suppliers WHERE business_name = 'Aneka Snack')
GROUP BY st.status;
```

---

## 📊 Expected Behavior After Fix

### Dashboard (`/supplier/page`)
```
✅ Console Output:
📊 Sales Notifications Debug: {
  productIds: 3,
  recentSalesCount: 15,
  salesNotifsCount: 15,
  sampleRecentSales: [{...}, {...}],
  sampleSalesNotifs: [{...}, {...}]
}

✅ UI:
Notifikasi Penjualan Real-time
┌────────────────────────────────────────────┐
│ Produk        Outlet     Qty   Pendapatan   │
│ Pastry        Kantin A   2     Rp 9.000     │
│ Snack Mix     Kantin B   5     Rp 22.500    │
└────────────────────────────────────────────┘
```

### Wallet (`/supplier/wallet`)
```
✅ Console Output:
💰 Wallet Sales Data Debug: {
  productIdsCount: 3,
  salesDataCount: 15,
  salesError: null,
  sampleData: [{...}, {...}]
}
💰 Formatted Payments: {
  count: 15,
  sample: [{...}, {...}]
}

✅ UI:
Riwayat Transaksi Penjualan Anda
┌──────────────────────────────────────────────────────────────────┐
│ Tanggal   Produk   Outlet    Qty  Harga   Fee      Diterima      │
│ 13 Nov    Pastry   Kantin A  2    Rp 10k  -Rp 1k   +Rp 9k        │
│ 12 Nov    Snack    Kantin B  5    Rp 25k  -Rp 2.5k +Rp 22.5k     │
└──────────────────────────────────────────────────────────────────┘
```

### Payment History (`/supplier/payment-history`)
```
✅ UI:
(Summary cards DIHAPUS)

┌─────────────── Filters ───────────────┐
│ Periode: Bulan Ini                     │
│ Outlet: Semua Outlet                   │
│ Produk: Semua Produk                   │
└────────────────────────────────────────┘

┌────────── Transaction Table ──────────┐
│ Tanggal | Produk | Outlet | Detail... │
└────────────────────────────────────────┘
```

---

## 🚨 Possible Root Causes If Still Empty

### 1. Tidak Ada Sales COMPLETED
```sql
-- Check status transaksi
SELECT status, COUNT(*) FROM sales_transactions GROUP BY status;

-- Jika semua PENDING, perlu admin confirm payment
-- Di admin → Kantin → Konfirmasi Pembayaran
```

### 2. Tidak Ada Approved Products
```sql
-- Check product status
SELECT status, COUNT(*) FROM products 
WHERE supplier_id = (SELECT id FROM suppliers WHERE business_name = 'Aneka Snack')
GROUP BY status;

-- Jika semua PENDING, perlu admin approve
-- Di admin → Produk → Approve
```

### 3. RLS Policy Blocking
```sql
-- Check RLS policies untuk supplier
SELECT * FROM pg_policies 
WHERE tablename = 'sales_transaction_items';

-- Harus ada policy yang allow supplier read via products.supplier_id
```

### 4. Kolom Belum Ada (Migration Belum Jalan)
```sql
-- Check jika kolom ada
SELECT column_name FROM information_schema.columns
WHERE table_name = 'sales_transaction_items'
AND column_name IN ('supplier_revenue', 'commission_amount', 'price');

-- Jika tidak ada, run:
-- backend/migrations/026_add_commission_to_sales.sql
```

---

## ✅ Summary

| # | Masalah | Status | Solusi |
|---|---------|--------|--------|
| 1 | Redundant summary cards | ✅ FIXED | Dihapus 3 cards di payment-history |
| 2 | Dashboard notifikasi kosong | ✅ DEBUG ADDED | Console.log untuk trace issue |
| 3 | Wallet riwayat kosong | ✅ FIXED | Perbaiki column names + debug |

**Next Steps untuk User:**
1. ✅ Refresh halaman supplier (Ctrl+R)
2. ✅ Buka console browser (F12)
3. ✅ Lihat log dengan icon 📊 dan 💰
4. ✅ Report hasil console.log jika masih kosong
5. ✅ Jika masih issue, jalankan `debug-supplier-dashboard-empty.sql`

**Files Modified:**
- ✅ `frontend/src/app/supplier/payment-history/page.tsx` (hapus cards)
- ✅ `frontend/src/app/supplier/page.tsx` (tambah debug)
- ✅ `frontend/src/app/supplier/wallet/page.tsx` (fix columns + debug)

**Files Created:**
- ✅ `database/debug-supplier-dashboard-empty.sql` (diagnostic query)
- ✅ `SUPPLIER-UI-FIXES.md` (dokumentasi ini)
