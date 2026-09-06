-- ============================================================
-- REPLIKA halaman "Pembayaran Supplier" (read-only, satu query)
-- Menghasilkan angka SAMA dengan /admin/payments/commissions.
-- Semua ALL-TIME, meniru frontend/src/app/admin/payments/commissions/page.tsx
-- Tidak menulis apa pun. Jalankan di Supabase SQL Editor.
--
-- Baris terakhir (supplier = 'TOTAL') = 4 KPI atas:
--   belum_ditransfer  -> "Total Belum Bayar" / "Siap Ditransfer"
--   (akumulasi ada di kolom terpisah, lihat status_bayar = 'Akumulasi')
-- ============================================================

WITH
threshold AS (
  SELECT CASE
           WHEN (SELECT value FROM platform_settings WHERE key = 'min_payout_enabled' LIMIT 1) = 'false'
           THEN 0
           ELSE coalesce((SELECT minimum_payout_amount FROM payment_settings LIMIT 1), 50000)
         END AS min_payout
),
sup AS (
  SELECT id, business_name FROM suppliers WHERE status = 'APPROVED'
),
items AS (
  SELECT
    coalesce(sti.supplier_id,
             (SELECT p.supplier_id FROM products p WHERE p.id = sti.product_id)) AS supplier_id,
    sti.transaction_id,
    sti.subtotal,
    coalesce(sti.commission_amount, 0) AS commission_amount,
    sti.supplier_revenue
  FROM sales_transaction_items sti
  JOIN sales_transactions st ON st.id = sti.transaction_id
  WHERE st.status = 'COMPLETED'
),
earn AS (
  SELECT
    i.supplier_id,
    sum(CASE WHEN i.supplier_revenue IS NOT NULL
             THEN i.supplier_revenue
             ELSE greatest(0, i.subtotal - i.commission_amount) END) AS total_penerimaan,
    count(DISTINCT i.transaction_id)                                 AS transaksi
  FROM items i
  WHERE i.supplier_id IN (SELECT id FROM sup)
  GROUP BY i.supplier_id
),
paid AS (
  SELECT supplier_id, sum(coalesce(net_payment, amount, 0)) AS sudah_ditransfer
  FROM supplier_payments WHERE status = 'COMPLETED'
  GROUP BY supplier_id
),
shipped AS (
  SELECT sm.supplier_id, sum(coalesce(smi.quantity, 0)) AS produk_dikirim
  FROM stock_movements sm
  JOIN stock_movement_items smi ON smi.movement_id = sm.id
  WHERE sm.movement_type = 'IN' AND sm.status IN ('APPROVED', 'COMPLETED')
  GROUP BY sm.supplier_id
),
rows AS (
  SELECT
    s.business_name                                          AS supplier,
    coalesce(sh.produk_dikirim, 0)::bigint                   AS produk_dikirim,
    coalesce(e.transaksi, 0)::bigint                         AS transaksi,
    round(coalesce(e.total_penerimaan, 0))                   AS total_penerimaan,
    round(coalesce(p.sudah_ditransfer, 0))                   AS sudah_ditransfer,
    round(coalesce(e.total_penerimaan, 0) - coalesce(p.sudah_ditransfer, 0)) AS saldo_raw
  FROM sup s
  LEFT JOIN earn    e  ON e.supplier_id  = s.id
  LEFT JOIN paid    p  ON p.supplier_id  = s.id
  LEFT JOIN shipped sh ON sh.supplier_id = s.id
  WHERE coalesce(e.total_penerimaan,0) <> 0 OR coalesce(p.sudah_ditransfer,0) <> 0
),
final AS (
  SELECT
    supplier, produk_dikirim, transaksi, total_penerimaan, sudah_ditransfer,
    greatest(saldo_raw, 0) AS belum_ditransfer,
    CASE
      WHEN greatest(saldo_raw,0) >= (SELECT min_payout FROM threshold) THEN 'Siap Dibayar'
      WHEN saldo_raw > 0.01                                            THEN 'Akumulasi'
      ELSE 'Lunas'
    END AS status_bayar,
    CASE WHEN saldo_raw < -0.01 THEN saldo_raw ELSE 0 END AS overpay_negatif
  FROM rows
),
out AS (
  SELECT 0 AS is_total, supplier, produk_dikirim, transaksi, total_penerimaan,
         sudah_ditransfer, belum_ditransfer, status_bayar, overpay_negatif
  FROM final
  UNION ALL
  SELECT
    1 AS is_total,
    'TOTAL',
    sum(produk_dikirim), sum(transaksi), sum(total_penerimaan),
    sum(sudah_ditransfer),
    coalesce(sum(belum_ditransfer) FILTER (WHERE status_bayar = 'Siap Dibayar'), 0), -- = Total Belum Bayar / Siap Ditransfer
    'Akumulasi: ' || coalesce(sum(belum_ditransfer) FILTER (WHERE status_bayar = 'Akumulasi'), 0)::text,
    count(*)                                                                          -- = Total Supplier
  FROM final
)
SELECT supplier, produk_dikirim, transaksi, total_penerimaan,
       sudah_ditransfer, belum_ditransfer, status_bayar, overpay_negatif
FROM out
ORDER BY is_total, belum_ditransfer DESC, total_penerimaan DESC;
