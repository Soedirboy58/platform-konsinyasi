-- ========================================
-- FIX OVER-PAYMENT - ADJUSTMENT MANUAL
-- ========================================
-- Jalankan di Supabase SQL Editor untuk koreksi over-payment
-- ========================================

-- STEP 1: CEK DATA OVER-PAYMENT TERLEBIH DAHULU
-- Lihat detail supplier yang over-payment
WITH supplier_sales AS (
  SELECT 
    s.id AS supplier_id,
    s.business_name,
    SUM(sti.subtotal) AS total_sales,
    SUM(sti.subtotal * 0.10) AS total_commission,
    SUM(sti.subtotal * 0.90) AS total_supplier_revenue
  FROM sales_transaction_items sti
  JOIN products p ON p.id = sti.product_id
  JOIN suppliers s ON s.id = p.supplier_id
  JOIN sales_transactions st ON st.id = sti.transaction_id
  WHERE st.status = 'COMPLETED'
    AND st.created_at >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY s.id, s.business_name
),
supplier_payments AS (
  SELECT 
    supplier_id,
    SUM(amount) AS total_paid
  FROM supplier_payments
  WHERE status = 'COMPLETED'
    AND payment_date >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY supplier_id
)
SELECT 
  ss.business_name,
  ss.total_sales,
  ss.total_commission,
  ss.total_supplier_revenue AS should_receive,
  COALESCE(sp.total_paid, 0) AS already_paid,
  COALESCE(sp.total_paid, 0) - ss.total_supplier_revenue AS overpayment
FROM supplier_sales ss
LEFT JOIN supplier_payments sp ON sp.supplier_id = ss.supplier_id
WHERE COALESCE(sp.total_paid, 0) > ss.total_supplier_revenue
ORDER BY overpayment DESC;

-- ========================================
-- STEP 2: PILIH METODE PERBAIKAN
-- ========================================

-- METODE A: TAMBAHKAN KE WALLET BALANCE (KREDIT UNTUK TRANSAKSI BERIKUTNYA)
-- Overpayment dikembalikan ke wallet supplier sebagai kredit

-- Contoh untuk Aneka Snack (overpayment Rp 24,840)
UPDATE supplier_wallets
SET 
  available_balance = available_balance + 24840,
  updated_at = NOW()
WHERE supplier_id = (
  SELECT id FROM suppliers WHERE business_name = 'Aneka Snack'
);

-- Contoh untuk Aneka Snack A (overpayment Rp 81,000)
UPDATE supplier_wallets
SET 
  available_balance = available_balance + 81000,
  updated_at = NOW()
WHERE supplier_id = (
  SELECT id FROM suppliers WHERE business_name = 'Aneka Snack A'
);

-- Log adjustment ke wallet_transactions
INSERT INTO wallet_transactions (
  wallet_id,
  transaction_type,
  amount,
  balance_before,
  balance_after,
  description,
  reference_type,
  created_at
)
SELECT 
  sw.id,
  'ADJUSTMENT',
  24840,
  sw.available_balance - 24840,
  sw.available_balance,
  'Koreksi over-payment periode November 2025',
  'ADJUSTMENT',
  NOW()
FROM supplier_wallets sw
JOIN suppliers s ON s.id = sw.supplier_id
WHERE s.business_name = 'Aneka Snack';

INSERT INTO wallet_transactions (
  wallet_id,
  transaction_type,
  amount,
  balance_before,
  balance_after,
  description,
  reference_type,
  created_at
)
SELECT 
  sw.id,
  'ADJUSTMENT',
  81000,
  sw.available_balance - 81000,
  sw.available_balance,
  'Koreksi over-payment periode November 2025',
  'ADJUSTMENT',
  NOW()
FROM supplier_wallets sw
JOIN suppliers s ON s.id = sw.supplier_id
WHERE s.business_name = 'Aneka Snack A';

-- ========================================
-- METODE B: BUAT PAYMENT REVERSAL (PEMBATALAN SEBAGIAN)
-- Batalkan sebagian payment yang berlebih
-- ========================================
-- ⚠️ METODE INI SKIP - Schema supplier_payments tidak konsisten
-- ⚠️ Gunakan METODE A (wallet adjustment) saja yang lebih aman
-- ⚠️ JANGAN JALANKAN INI

/*
-- Cek payment records yang akan dibalik
SELECT 
  sp.*,
  s.business_name
FROM supplier_payments sp
JOIN suppliers s ON s.id = sp.supplier_id
WHERE s.business_name IN ('Aneka Snack', 'Aneka Snack A')
ORDER BY sp.created_at DESC;
*/

-- ========================================
-- METODE C: HAPUS PAYMENT TERAKHIR (JIKA SALAH INPUT)
-- HATI-HATI: Hanya jika payment terakhir memang salah total
-- ⚠️ JANGAN JALANKAN INI - Hanya untuk dokumentasi
-- ========================================

/*
-- Cek payment terakhir
SELECT * FROM supplier_payments 
WHERE supplier_id IN (
  SELECT id FROM suppliers 
  WHERE business_name IN ('Aneka Snack', 'Aneka Snack A')
)
ORDER BY created_at DESC
LIMIT 5;

-- Jika yakin payment terakhir salah, soft delete:
-- Ganti 'payment-id-yang-salah' dengan UUID asli dari query di atas
UPDATE supplier_payments
SET 
  status = 'CANCELLED',
  notes = COALESCE(notes, '') || ' | CANCELLED: Over-payment correction ' || TO_CHAR(NOW(), 'YYYY-MM-DD')
WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'; -- Ganti dengan ID asli
*/

-- ========================================
-- STEP 3: VERIFIKASI SETELAH PERBAIKAN
-- ========================================

-- Jalankan ulang query step 1 untuk memastikan over-payment sudah hilang
WITH supplier_sales AS (
  SELECT 
    s.id AS supplier_id,
    s.business_name,
    SUM(sti.subtotal * 0.90) AS total_supplier_revenue
  FROM sales_transaction_items sti
  JOIN products p ON p.id = sti.product_id
  JOIN suppliers s ON s.id = p.supplier_id
  JOIN sales_transactions st ON st.id = sti.transaction_id
  WHERE st.status = 'COMPLETED'
    AND st.created_at >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY s.id, s.business_name
),
supplier_payments AS (
  SELECT 
    supplier_id,
    SUM(amount) AS total_paid
  FROM supplier_payments
  WHERE status = 'COMPLETED'
    AND payment_date >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY supplier_id
)
SELECT 
  ss.business_name,
  ss.total_supplier_revenue AS should_receive,
  COALESCE(sp.total_paid, 0) AS already_paid,
  COALESCE(sp.total_paid, 0) - ss.total_supplier_revenue AS difference
FROM supplier_sales ss
LEFT JOIN supplier_payments sp ON sp.supplier_id = ss.supplier_id
ORDER BY ss.business_name;

-- Expected result: difference should be 0 or close to 0 (< 0.01)

-- ========================================
-- REKOMENDASI
-- ========================================

-- ✅ METODE A (RECOMMENDED - GUNAKAN INI): 
--    - Paling aman dan sudah tested
--    - Tidak menghapus history
--    - Supplier dapat kredit untuk transaksi berikutnya
--    - Transparan di wallet_transactions
--    - Tidak tergantung schema supplier_payments

-- ⚠️ METODE B (SKIP - Schema tidak konsisten):
--    - Tabel supplier_payments memiliki schema yang berbeda di production
--    - Gunakan Metode A saja

-- ❌ METODE C (Tidak recommended):
--    - Hanya jika benar-benar salah input
--    - Bisa kehilangan audit trail
--    - Risk data integrity

-- ========================================
-- PENCEGAHAN KE DEPAN
-- ========================================

-- 1. Validasi payment amount sebelum save
-- 2. Tampilkan warning jika amount > unpaid_amount
-- 3. Lock payment form setelah submit
-- 4. Tambah confirmation dialog dengan summary
