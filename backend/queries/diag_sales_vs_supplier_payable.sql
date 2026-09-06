-- ============================================================
-- DIAGNOSTIK (read-only): kenapa "Total Transfer ke Supplier"
-- berbeda / lebih besar dari "Total Penjualan" di Laporan Penjualan.
-- Semua query di bawah HANYA SELECT - tidak mengubah data apa pun.
-- Jalankan di Supabase SQL Editor, kirim hasil tiap blok.
-- Catatan kolom: sales_transactions.total_amount, .status, .created_at,
--   .payment_provider (bila ada); sales_transaction_items.subtotal,
--   .commission_amount, .supplier_revenue, .supplier_id, .transaction_id, .product_id
-- ============================================================


-- Q1. ALL-TIME vs 30 HARI: kotor vs komisi vs bagian supplier
--     (bandingkan angka 30 hari dengan "Total Penjualan" Rp 1.203.500)
WITH base AS (
  SELECT sti.subtotal,
         coalesce(sti.commission_amount, 0)                                   AS komisi,
         coalesce(sti.supplier_revenue, sti.subtotal - coalesce(sti.commission_amount,0)) AS bagian_supplier,
         st.created_at
  FROM sales_transaction_items sti
  JOIN sales_transactions st ON st.id = sti.transaction_id
  WHERE st.status = 'COMPLETED'
)
SELECT 'ALL_TIME' AS rentang,
       count(*)               AS baris_item,
       sum(subtotal)          AS kotor,
       sum(komisi)            AS komisi_platform,
       sum(bagian_supplier)   AS bagian_supplier
FROM base
UNION ALL
SELECT '30_HARI',
       count(*), sum(subtotal), sum(komisi), sum(bagian_supplier)
FROM base
WHERE created_at >= now() - interval '30 days';


-- Q2. Total yang SUDAH ditransfer ke supplier (all-time, COMPLETED)
SELECT count(*)                                   AS jml_pembayaran,
       sum(coalesce(net_payment, amount, 0))      AS total_sudah_ditransfer
FROM supplier_payments
WHERE status = 'COMPLETED';


-- Q3. IDENTITAS REKONSILIASI:
--     bagian_supplier_all_time - total_sudah_ditransfer
--     seharusnya = jumlah SEMUA saldo supplier (5 "Siap Dibayar"
--     + 2 "Akumulasi" + sisa yang ~0/negatif).
WITH earn AS (
  SELECT sum(coalesce(sti.supplier_revenue, sti.subtotal - coalesce(sti.commission_amount,0))) AS bagian_supplier
  FROM sales_transaction_items sti
  JOIN sales_transactions st ON st.id = sti.transaction_id
  WHERE st.status = 'COMPLETED'
),
paid AS (
  SELECT sum(coalesce(net_payment, amount, 0)) AS dibayar
  FROM supplier_payments WHERE status = 'COMPLETED'
)
SELECT earn.bagian_supplier,
       paid.dibayar,
       earn.bagian_supplier - coalesce(paid.dibayar,0) AS sisa_utang_total
FROM earn, paid;


-- Q4. APAKAH KOMISI BENAR-BENAR DIPOTONG?
--     Kalau effective_komisi_persen ~ 0 dan bagian_supplier ~ kotor,
--     berarti komisi TIDAK diambil -> ini sebab utama angka membengkak.
SELECT sum(sti.subtotal)                                              AS kotor,
       sum(coalesce(sti.supplier_revenue,0))                          AS bagian_supplier,
       sum(coalesce(sti.commission_amount,0))                         AS komisi,
       round(100.0 * sum(coalesce(sti.commission_amount,0))
             / nullif(sum(sti.subtotal),0), 2)                        AS effective_komisi_persen,
       count(*) FILTER (WHERE sti.supplier_revenue IS NULL)           AS item_tanpa_snapshot_revenue,
       count(*) FILTER (WHERE coalesce(sti.commission_amount,0) = 0)  AS item_komisi_nol
FROM sales_transaction_items sti
JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE st.status = 'COMPLETED';


-- Q5. RINCIAN PER SUPPLIER (harus cocok dengan kartu di layar:
--     BNP2 306.000, BnP 635.375, BNP 3 136.000, Borneo Perkasa 334.050, BnP 1 50.150)
WITH earn AS (
  SELECT coalesce(sti.supplier_id,
                  (SELECT p.supplier_id FROM products p WHERE p.id = sti.product_id)) AS supplier_id,
         sum(coalesce(sti.supplier_revenue, sti.subtotal - coalesce(sti.commission_amount,0))) AS earned
  FROM sales_transaction_items sti
  JOIN sales_transactions st ON st.id = sti.transaction_id
  WHERE st.status = 'COMPLETED'
  GROUP BY 1
),
paid AS (
  SELECT supplier_id, sum(coalesce(net_payment, amount, 0)) AS paid
  FROM supplier_payments WHERE status = 'COMPLETED'
  GROUP BY supplier_id
)
SELECT s.business_name,
       s.status                                   AS supplier_status,
       round(coalesce(e.earned,0))                AS earned_all_time,
       round(coalesce(p.paid,0))                  AS paid_all_time,
       round(coalesce(e.earned,0) - coalesce(p.paid,0)) AS saldo
FROM suppliers s
LEFT JOIN earn e ON e.supplier_id = s.id
LEFT JOIN paid p ON p.supplier_id = s.id
WHERE coalesce(e.earned,0) <> 0 OR coalesce(p.paid,0) <> 0
ORDER BY saldo DESC;


-- Q6. CEK "PHANTOM": sebaran status & channel transaksi.
--     Perhatikan bila ada status = 'COMPLETED' padahal tidak pernah
--     benar-benar dibayar (mis. paid_at NULL), atau jumlah COMPLETED
--     jauh di atas SUCCESS di dashboard DOKU.
SELECT status,
       coalesce(payment_provider, '(none)')       AS provider,
       count(*)                                    AS jml_tx,
       sum(coalesce(total_amount,0))               AS nilai,
       count(*) FILTER (WHERE paid_at IS NULL)     AS tanpa_paid_at
FROM sales_transactions
GROUP BY status, coalesce(payment_provider, '(none)')
ORDER BY jml_tx DESC;


-- Q7. Kontribusi item ber-status 'HILANG' (dihitung di Laporan Penjualan,
--     TIDAK dihitung di saldo supplier) - untuk tahu selisih HILANG.
SELECT count(*)          AS item_hilang,
       sum(sti.subtotal) AS nilai_hilang_kotor
FROM sales_transaction_items sti
JOIN sales_transactions st ON st.id = sti.transaction_id
WHERE st.status = 'HILANG';
