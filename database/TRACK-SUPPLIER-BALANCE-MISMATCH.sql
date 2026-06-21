-- ============================================================
-- TRACK-SUPPLIER-BALANCE-MISMATCH.sql
-- ============================================================
-- Tujuan:
-- 1) Lacak ketidaksesuaian saldo supplier (wallet vs card pembayaran admin)
-- 2) Validasi sumber angka: revenue completed, pembayaran admin, outstanding
--
-- Cara pakai:
-- 1) Jalankan blok 0 untuk lihat kandidat supplier (termasuk ID)
-- 2) Isi supplier_id pada blok 0A (WAJIB exact ID, jangan ILIKE)
-- 3) Jalankan blok 1-5
-- ============================================================

-- ------------------------------------------------------------
-- 0) Cari kandidat supplier (hanya discovery, boleh ILIKE)
-- ------------------------------------------------------------
WITH target AS (
  SELECT id, business_name
  FROM suppliers
  WHERE business_name ILIKE '%BnP%'
)
SELECT * FROM target;


-- ------------------------------------------------------------
-- 0A) SET TARGET SUPPLIER (WAJIB exact ID)
-- ------------------------------------------------------------
-- Ganti UUID di bawah dengan ID supplier yang mau dianalisis.
WITH params AS (
  SELECT '00000000-0000-0000-0000-000000000000'::UUID AS supplier_id
),
target AS (
  SELECT s.id, s.business_name
  FROM suppliers s
  JOIN params p ON p.supplier_id = s.id
)
SELECT * FROM target;


-- ------------------------------------------------------------
-- 1) Ringkasan inti: revenue vs paid vs outstanding
-- ------------------------------------------------------------
WITH target AS (
  SELECT id, business_name
  FROM suppliers
  WHERE id = '00000000-0000-0000-0000-000000000000'::UUID
),
product_ids AS (
  SELECT p.id, p.supplier_id
  FROM products p
  JOIN target t ON t.id = p.supplier_id
),
completed_sales AS (
  SELECT
    sti.transaction_id,
    sti.product_id,
    sti.quantity,
    COALESCE(sti.supplier_revenue, GREATEST(0, sti.subtotal - COALESCE(sti.commission_amount, 0))) AS supplier_revenue,
    st.transaction_code,
    st.status,
    st.created_at,
    st.paid_at,
    st.payment_method,
    st.payment_proof_url
  FROM sales_transaction_items sti
  JOIN sales_transactions st ON st.id = sti.transaction_id
  JOIN product_ids p ON p.id = sti.product_id
  WHERE st.status = 'COMPLETED'
),
payments AS (
  SELECT
    sp.supplier_id,
    sp.id,
    sp.payment_reference,
    sp.payment_date,
    sp.status,
    COALESCE(sp.net_payment, sp.amount, 0) AS paid_amount
  FROM supplier_payments sp
  JOIN target t ON t.id = sp.supplier_id
  WHERE sp.status = 'COMPLETED'
),
wallet AS (
  SELECT
    sw.supplier_id,
    sw.available_balance,
    sw.pending_balance,
    sw.total_earned,
    sw.total_withdrawn
  FROM supplier_wallets sw
  JOIN target t ON t.id = sw.supplier_id
)
SELECT
  t.business_name,
  COALESCE((SELECT SUM(cs.supplier_revenue) FROM completed_sales cs), 0) AS expected_total_revenue,
  COALESCE((SELECT SUM(p.paid_amount) FROM payments p), 0) AS total_paid_by_admin,
  COALESCE((SELECT SUM(cs.supplier_revenue) FROM completed_sales cs), 0)
    - COALESCE((SELECT SUM(p.paid_amount) FROM payments p), 0) AS expected_outstanding,
  COALESCE(w.available_balance, 0) AS wallet_available_balance,
  COALESCE(w.pending_balance, 0) AS wallet_pending_balance,
  COALESCE(w.total_earned, 0) AS wallet_total_earned,
  COALESCE(w.total_withdrawn, 0) AS wallet_total_withdrawn
FROM target t
LEFT JOIN wallet w ON w.supplier_id = t.id;


-- ------------------------------------------------------------
-- 2) Detail transaksi completed (sumber pendapatan supplier)
-- ------------------------------------------------------------
WITH target AS (
  SELECT id
  FROM suppliers
  WHERE id = '00000000-0000-0000-0000-000000000000'::UUID
),
product_ids AS (
  SELECT p.id
  FROM products p
  JOIN target t ON t.id = p.supplier_id
)
SELECT
  st.transaction_code,
  st.status,
  st.created_at,
  st.paid_at,
  st.payment_method,
  st.payment_proof_url,
  SUM(sti.quantity) AS qty,
  SUM(sti.subtotal) AS gross_subtotal,
  SUM(COALESCE(sti.commission_amount, 0)) AS commission_amount,
  SUM(COALESCE(sti.supplier_revenue, GREATEST(0, sti.subtotal - COALESCE(sti.commission_amount, 0)))) AS supplier_revenue
FROM sales_transaction_items sti
JOIN sales_transactions st ON st.id = sti.transaction_id
JOIN product_ids p ON p.id = sti.product_id
WHERE st.status = 'COMPLETED'
GROUP BY st.id, st.transaction_code, st.status, st.created_at, st.paid_at, st.payment_method, st.payment_proof_url
ORDER BY st.created_at DESC;


-- ------------------------------------------------------------
-- 3) Detail pembayaran admin ke supplier
-- ------------------------------------------------------------
SELECT
  sp.id,
  sp.payment_reference,
  sp.payment_date,
  sp.status,
  sp.bank_name,
  sp.bank_account_number,
  COALESCE(sp.amount, 0) AS amount,
  COALESCE(sp.net_payment, 0) AS net_payment,
  sp.created_at
FROM supplier_payments sp
JOIN suppliers s ON s.id = sp.supplier_id
WHERE s.id = '00000000-0000-0000-0000-000000000000'::UUID
ORDER BY sp.payment_date DESC NULLS LAST, sp.created_at DESC;


-- ------------------------------------------------------------
-- 4) Cek transaksi PENDING lama yang berpotensi bikin selisih stok
-- ------------------------------------------------------------
WITH target AS (
  SELECT id
  FROM suppliers
  WHERE id = '00000000-0000-0000-0000-000000000000'::UUID
),
product_ids AS (
  SELECT p.id
  FROM products p
  JOIN target t ON t.id = p.supplier_id
)
SELECT
  st.transaction_code,
  st.status,
  st.created_at,
  EXTRACT(EPOCH FROM (NOW() - st.created_at)) / 60 AS pending_minutes,
  SUM(sti.quantity) AS qty
FROM sales_transaction_items sti
JOIN sales_transactions st ON st.id = sti.transaction_id
JOIN product_ids p ON p.id = sti.product_id
WHERE st.status = 'PENDING'
GROUP BY st.id, st.transaction_code, st.status, st.created_at
ORDER BY st.created_at ASC;


-- ------------------------------------------------------------
-- 5) Quick diagnosis output (single row)
-- ------------------------------------------------------------
WITH target AS (
  SELECT id, business_name
  FROM suppliers
  WHERE id = '00000000-0000-0000-0000-000000000000'::UUID
),
product_ids AS (
  SELECT p.id
  FROM products p
  JOIN target t ON t.id = p.supplier_id
),
rev AS (
  SELECT COALESCE(SUM(COALESCE(sti.supplier_revenue, GREATEST(0, sti.subtotal - COALESCE(sti.commission_amount, 0)))), 0) AS total_revenue
  FROM sales_transaction_items sti
  JOIN sales_transactions st ON st.id = sti.transaction_id
  JOIN product_ids p ON p.id = sti.product_id
  WHERE st.status = 'COMPLETED'
),
paid AS (
  SELECT COALESCE(SUM(COALESCE(sp.net_payment, sp.amount, 0)), 0) AS total_paid
  FROM supplier_payments sp
  JOIN target t ON t.id = sp.supplier_id
  WHERE sp.status = 'COMPLETED'
),
wallet AS (
  SELECT COALESCE(sw.pending_balance, 0) AS wallet_pending
  FROM supplier_wallets sw
  JOIN target t ON t.id = sw.supplier_id
)
SELECT
  t.business_name,
  r.total_revenue,
  p.total_paid,
  (r.total_revenue - p.total_paid) AS expected_pending,
  COALESCE(w.wallet_pending, 0) AS wallet_pending,
  (COALESCE(w.wallet_pending, 0) - (r.total_revenue - p.total_paid)) AS delta_pending
FROM target t
CROSS JOIN rev r
CROSS JOIN paid p
LEFT JOIN wallet w ON TRUE;


-- ------------------------------------------------------------
-- 6) Optional: overview semua supplier mirip nama (grouped, no duplicate)
-- ------------------------------------------------------------
WITH targets AS (
  SELECT s.id, s.business_name
  FROM suppliers s
  WHERE s.business_name ILIKE '%BnP%'
),
product_map AS (
  SELECT p.id AS product_id, p.supplier_id
  FROM products p
  JOIN targets t ON t.id = p.supplier_id
),
rev AS (
  SELECT
    pm.supplier_id,
    SUM(COALESCE(sti.supplier_revenue, GREATEST(0, sti.subtotal - COALESCE(sti.commission_amount, 0)))) AS total_revenue
  FROM sales_transaction_items sti
  JOIN sales_transactions st ON st.id = sti.transaction_id
  JOIN product_map pm ON pm.product_id = sti.product_id
  WHERE st.status = 'COMPLETED'
  GROUP BY pm.supplier_id
),
paid AS (
  SELECT sp.supplier_id, SUM(COALESCE(sp.net_payment, sp.amount, 0)) AS total_paid
  FROM supplier_payments sp
  JOIN targets t ON t.id = sp.supplier_id
  WHERE sp.status = 'COMPLETED'
  GROUP BY sp.supplier_id
),
wallet AS (
  SELECT sw.supplier_id, COALESCE(sw.pending_balance, 0) AS wallet_pending
  FROM supplier_wallets sw
  JOIN targets t ON t.id = sw.supplier_id
)
SELECT
  t.id AS supplier_id,
  t.business_name,
  COALESCE(r.total_revenue, 0) AS total_revenue,
  COALESCE(p.total_paid, 0) AS total_paid,
  COALESCE(r.total_revenue, 0) - COALESCE(p.total_paid, 0) AS expected_pending,
  COALESCE(w.wallet_pending, 0) AS wallet_pending,
  COALESCE(w.wallet_pending, 0) - (COALESCE(r.total_revenue, 0) - COALESCE(p.total_paid, 0)) AS delta_pending
FROM targets t
LEFT JOIN rev r ON r.supplier_id = t.id
LEFT JOIN paid p ON p.supplier_id = t.id
LEFT JOIN wallet w ON w.supplier_id = t.id
ORDER BY t.business_name;
