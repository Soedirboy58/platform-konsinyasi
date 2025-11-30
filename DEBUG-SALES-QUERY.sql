-- ========================================
-- DEBUG: CEK DATA PENJUALAN
-- ========================================
-- Jalankan query ini di Supabase SQL Editor untuk memastikan data ada
-- ========================================

-- 1. Cek semua transaksi penjualan yang COMPLETED
SELECT 
    st.id AS transaction_id,
    st.created_at,
    st.status,
    st.location_id,
    l.name AS location_name
FROM sales_transactions st
LEFT JOIN locations l ON l.id = st.location_id
WHERE st.status = 'COMPLETED'
ORDER BY st.created_at DESC
LIMIT 10;

-- 2. Cek detail items transaksi (tanpa kolom yang mungkin tidak ada)
SELECT 
    sti.*,
    p.name AS product_name,
    s.business_name AS supplier_name,
    st.created_at,
    st.status AS transaction_status
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
JOIN suppliers s ON s.id = p.supplier_id
JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE st.status = 'COMPLETED'
ORDER BY st.created_at DESC
LIMIT 10;

-- 3. Cek struktur kolom sales_transaction_items
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_transaction_items'
ORDER BY ordinal_position;

-- 4. Cek total transaksi per supplier
SELECT 
    s.business_name,
    COUNT(DISTINCT sti.transaction_id) AS total_transactions,
    SUM(sti.quantity) AS total_items_sold,
    SUM(sti.subtotal) AS total_sales,
    SUM(sti.commission_amount) AS total_commission,
    SUM(sti.supplier_revenue) AS total_supplier_revenue
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
JOIN suppliers s ON s.id = p.supplier_id
JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE st.status = 'COMPLETED'
GROUP BY s.id, s.business_name
ORDER BY total_sales DESC;

-- 5. Cek RLS policy untuk sales_transaction_items
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'sales_transaction_items';

-- ========================================
-- EXPECTED RESULTS
-- ========================================
-- Query 1: Harus menampilkan transaksi terakhir Anda (30/11/2025, Pastry)
-- Query 2: Harus menampilkan detail item dengan harga Rp 5.000
-- Query 3: Harus ada kolom unit_price, commission_amount, supplier_revenue
-- Query 4: Harus menampilkan total penjualan per supplier
-- Query 5: Harus menampilkan RLS policies yang aktif

-- ========================================
-- TROUBLESHOOTING
-- ========================================
-- Jika Query 1 KOSONG:
--   → Transaksi tidak tersimpan atau status bukan COMPLETED
--   → Cek di tabel sales_transactions manual

-- Jika Query 2 KOSONG tapi Query 1 ADA:
--   → RLS policy memblokir akses
--   → Cek dengan role yang sesuai (supplier/admin)

-- Jika Query 3 tidak ada kolom commission_amount:
--   → Migration belum dijalankan
--   → Jalankan FIX-PRODUCTION-DATABASE.md

-- Jika Query 4 KOSONG:
--   → Tidak ada transaksi COMPLETED
--   → Atau RLS memblokir JOIN dengan suppliers
