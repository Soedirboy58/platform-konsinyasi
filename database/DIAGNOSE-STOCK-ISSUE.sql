-- ============================================================
-- Diagnosa & Fix: Stok berkurang akibat transaksi PENDING lama
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Cek transaksi PENDING yang masih ada
SELECT 
    st.id,
    st.transaction_code,
    st.status,
    st.created_at,
    NOW() - st.created_at AS umur_transaksi,
    sti.product_id,
    p.name AS nama_produk,
    sti.quantity AS qty_pending
FROM sales_transactions st
JOIN sales_transaction_items sti ON sti.transaction_id = st.id
JOIN products p ON p.id = sti.product_id
WHERE st.status = 'PENDING'
ORDER BY st.created_at DESC;

-- 2. Cek semua transaksi (termasuk CANCELLED & COMPLETED) untuk Garlic Chicken
--    untuk cari tahu kapan stok berkurang
SELECT 
    st.transaction_code,
    st.status,
    st.created_at,
    p.name AS produk,
    sti.quantity AS qty_transaksi
FROM sales_transactions st
JOIN sales_transaction_items sti ON sti.transaction_id = st.id
JOIN products p ON p.id = sti.product_id
WHERE p.name ILIKE '%chicken%' OR p.name ILIKE '%garlic%'
ORDER BY st.created_at DESC
LIMIT 20;

-- 3. Cek stok saat ini semua produk di smart-alley
SELECT 
    p.name AS produk,
    il.quantity AS stok_sekarang,
    l.name AS lokasi
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
WHERE l.qr_code = 'smart-alley'
ORDER BY p.name;

-- 4. Restore stok Garlic Chicken ke 5 (jalankan setelah konfirmasi dari query 2 & 3)
-- UPDATE inventory_levels il
-- SET quantity = 5, updated_at = NOW()
-- FROM products p
-- JOIN locations l ON l.qr_code = 'smart-alley'
-- WHERE il.product_id = p.id 
--   AND il.location_id = l.id
--   AND (p.name ILIKE '%chicken%' OR p.name ILIKE '%garlic%');
