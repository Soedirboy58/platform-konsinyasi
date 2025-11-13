# Supplier Dashboard & Wallet - Debug Steps

## Masalah Yang Ditemukan

Dari console log browser:
```
⚠️ No sales notifications despite having products. Checking...
🔍 Debug raw sales data: Object (tapi isinya tidak terlihat)
💰 Wallet Sales Data Debug: Object (tapi isinya tidak terlihat)
Error loading payments: Object (error di payment-history page)
```

## Langkah Debug

### Step 1: Buka Console dan Expand Objects

Setelah refresh halaman supplier, di browser console:

1. Cari log dengan emoji 📊 (Dashboard)
2. Cari log dengan emoji 💰 (Wallet)  
3. **KLIK** pada "Object" untuk melihat isinya
4. Screenshot atau copy hasilnya

### Step 2: Check Yang Perlu Dilihat

Dari log dashboard (📊):
- `Product IDs count` = berapa? (harus > 0)
- `Recent sales count` = berapa? (harusnya > 0 kalau ada sales)
- `Sales notifs count` = berapa? (ini yang harusnya muncul)
- Kalau `Recent sales count = 0`, cek `Debug raw sales data`

Dari log wallet (💰):
- `Product IDs count` = berapa?
- `Sales data count` = berapa?
- `Sales error` = null atau ada error?
- `Sample data` = array kosong atau ada isinya?

### Step 3: Kemungkinan Penyebab

#### A. Tidak Ada Sales COMPLETED
Jika `Recent sales count = 0` dan `Debug raw sales data count = 0`:
- Artinya: Tidak ada transaksi dengan status COMPLETED
- Solusi: Test beli produk di kantin, lalu admin confirm payment

#### B. RLS Policy Blocking
Jika `Debug raw sales data count > 0` tapi `Recent sales count = 0`:
- Artinya: Data ada, tapi JOIN dengan products atau locations gagal
- Penyebab: RLS policy memblock supplier untuk read products/locations
- Solusi: Run SQL untuk fix RLS

#### C. Column Name Salah
Jika ada error "column does not exist":
- Field `price` tidak ada (seharusnya `unit_price`)
- Field `commission_amount` tidak ada (belum migrate)
- Field `supplier_revenue` tidak ada (belum migrate)

### Step 4: SQL Diagnostic (Run di Supabase)

```sql
-- Check apakah Aneka Snack punya sales
SELECT 
    COUNT(*) as total_sales,
    COUNT(DISTINCT st.id) as total_transactions,
    SUM(sti.quantity) as total_items
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE p.supplier_id = (
    SELECT id FROM suppliers WHERE business_name = 'Aneka Snack'
)
AND st.status = 'COMPLETED';

-- Check columns yang ada
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'sales_transaction_items'
ORDER BY ordinal_position;

-- Test query seperti frontend
SELECT 
    sti.id,
    sti.quantity,
    sti.price,
    sti.supplier_revenue,
    sti.commission_amount,
    p.name as product_name,
    st.created_at,
    st.status,
    l.name as location_name
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
JOIN sales_transactions st ON st.id = sti.transaction_id
LEFT JOIN locations l ON l.id = st.location_id
WHERE p.supplier_id = (
    SELECT id FROM suppliers WHERE business_name = 'Aneka Snack'
)
AND st.status = 'COMPLETED'
LIMIT 5;
```

### Step 5: Kemungkinan Fix

#### Jika Migration Belum Jalan:
```sql
-- Run migration 026 untuk add commission columns
-- File: backend/migrations/026_add_commission_to_sales.sql
```

#### Jika RLS Blocking:
```sql
-- Allow supplier to read their sales via products
CREATE POLICY "suppliers_read_own_sales_items"
ON sales_transaction_items
FOR SELECT
TO authenticated
USING (
    product_id IN (
        SELECT id FROM products 
        WHERE supplier_id IN (
            SELECT id FROM suppliers WHERE profile_id = auth.uid()
        )
    )
);
```

## Yang Sudah Diperbaiki di Code

✅ **Payment History Page**
- Removed redundant summary cards

✅ **Dashboard Page (page.tsx)**
- Added detailed console.log
- Query already correct (uses supplier_revenue, commission_amount)

✅ **Wallet Page**  
- Fixed column names: `price` (not `price_at_sale`), `commission_amount` (not `platform_fee`)
- Added detailed console.log

## Next Steps

1. **Refresh browser** dan lihat console log yang baru (lebih detail)
2. **Expand Objects** di console untuk lihat isi data
3. **Screenshot** atau copy hasil log
4. **Share** hasil log untuk diagnostic lebih lanjut

Kalau semua data ada tapi masih tidak muncul di UI, kemungkinan besar:
- Migration 026 belum di-run (kolom `supplier_revenue` dan `commission_amount` belum ada)
- RLS policy memblock supplier untuk join dengan `products` atau `locations`
