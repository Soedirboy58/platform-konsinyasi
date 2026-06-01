-- ============================================================
-- RECONCILE-SUPPLIER-COMMISSION-CARDS.sql
-- ============================================================
-- Tujuan:
-- Menyamakan angka kartu admin payments/commissions dengan sumber data DB.
--
-- Rumus utama:
-- outstanding = completed_supplier_revenue_alltime - completed_supplier_payment_alltime
--
-- Status:
-- - Siap Dibayar: outstanding >= minimum_threshold
-- - Akumulasi: outstanding > 0 dan < minimum_threshold
-- - Lunas: outstanding <= 0
-- ============================================================

WITH cfg AS (
  SELECT COALESCE(minimum_payout_amount, 50000)::numeric AS minimum_threshold
  FROM payment_settings
  LIMIT 1
),
approved_suppliers AS (
  SELECT
    s.id AS supplier_id,
    s.business_name,
    s.bank_name,
    s.bank_account_number,
    s.bank_account_holder
  FROM suppliers s
  WHERE s.status = 'APPROVED'
),
product_map AS (
  SELECT p.id AS product_id, p.supplier_id
  FROM products p
),
completed_sales AS (
  SELECT
    COALESCE(sti.supplier_id, pm.supplier_id) AS supplier_id,
    st.id AS transaction_id,
    sti.quantity,
    COALESCE(sti.subtotal, 0) AS subtotal,
    COALESCE(sti.commission_amount, 0) AS commission_amount,
    COALESCE(sti.supplier_revenue, GREATEST(0, COALESCE(sti.subtotal, 0) - COALESCE(sti.commission_amount, 0))) AS supplier_revenue
  FROM sales_transaction_items sti
  JOIN sales_transactions st ON st.id = sti.transaction_id
  LEFT JOIN product_map pm ON pm.product_id = sti.product_id
  WHERE st.status = 'COMPLETED'
),
sales_by_supplier AS (
  SELECT
    cs.supplier_id,
    COUNT(DISTINCT cs.transaction_id) AS total_transactions_alltime,
    SUM(cs.quantity) AS products_sold_alltime,
    SUM(cs.subtotal) AS gross_sales_alltime,
    SUM(cs.commission_amount) AS platform_commission_alltime,
    SUM(cs.supplier_revenue) AS supplier_revenue_alltime
  FROM completed_sales cs
  WHERE cs.supplier_id IS NOT NULL
  GROUP BY cs.supplier_id
),
paid_by_supplier AS (
  SELECT
    sp.supplier_id,
    SUM(COALESCE(sp.net_payment, sp.amount, 0)) AS total_paid_alltime
  FROM supplier_payments sp
  WHERE sp.status = 'COMPLETED'
  GROUP BY sp.supplier_id
),
final_rows AS (
  SELECT
    s.supplier_id,
    s.business_name,
    s.bank_name,
    s.bank_account_number,
    s.bank_account_holder,
    COALESCE(sb.total_transactions_alltime, 0) AS total_transactions_alltime,
    COALESCE(sb.products_sold_alltime, 0) AS products_sold_alltime,
    COALESCE(sb.gross_sales_alltime, 0) AS gross_sales_alltime,
    COALESCE(sb.platform_commission_alltime, 0) AS platform_commission_alltime,
    COALESCE(sb.supplier_revenue_alltime, 0) AS supplier_revenue_alltime,
    COALESCE(pb.total_paid_alltime, 0) AS total_paid_alltime,
    COALESCE(sb.supplier_revenue_alltime, 0) - COALESCE(pb.total_paid_alltime, 0) AS outstanding
  FROM approved_suppliers s
  LEFT JOIN sales_by_supplier sb ON sb.supplier_id = s.supplier_id
  LEFT JOIN paid_by_supplier pb ON pb.supplier_id = s.supplier_id
)
SELECT
  f.supplier_id,
  f.business_name,
  f.bank_name,
  f.bank_account_number,
  f.total_transactions_alltime,
  f.products_sold_alltime,
  f.gross_sales_alltime,
  f.platform_commission_alltime,
  f.supplier_revenue_alltime,
  f.total_paid_alltime,
  f.outstanding,
  CASE
    WHEN f.outstanding >= cfg.minimum_threshold THEN 'UNPAID'
    WHEN f.outstanding > 0 THEN 'PENDING'
    ELSE 'PAID'
  END AS card_status,
  cfg.minimum_threshold
FROM final_rows f
CROSS JOIN cfg
ORDER BY f.business_name;
