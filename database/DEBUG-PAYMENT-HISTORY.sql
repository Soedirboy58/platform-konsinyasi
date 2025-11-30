-- ========================================
-- DEBUG: PAYMENT HISTORY ISSUE
-- ========================================
-- Jalankan query ini di Supabase SQL Editor untuk cek data
-- ========================================

-- STEP 1: Cek semua pembayaran hari ini
SELECT 
  id,
  supplier_id,
  (SELECT business_name FROM suppliers WHERE id = supplier_payments.supplier_id) as supplier_name,
  gross_sales,
  commission_amount,
  net_payment,
  amount,
  payment_reference,
  payment_date,
  status,
  created_at
FROM supplier_payments
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;

-- STEP 2: Cek semua pembayaran November 2025
SELECT 
  id,
  supplier_id,
  (SELECT business_name FROM suppliers WHERE id = supplier_payments.supplier_id) as supplier_name,
  net_payment,
  amount,
  payment_reference,
  payment_date,
  status,
  created_at
FROM supplier_payments
WHERE created_at >= '2025-11-01'
ORDER BY created_at DESC;

-- STEP 3: Cek pembayaran dengan status != COMPLETED
SELECT 
  id,
  supplier_id,
  (SELECT business_name FROM suppliers WHERE id = supplier_payments.supplier_id) as supplier_name,
  net_payment,
  payment_reference,
  status,
  created_at
FROM supplier_payments
WHERE created_at >= '2025-11-01'
AND status != 'COMPLETED'
ORDER BY created_at DESC;

-- STEP 4: Cek total pembayaran per supplier November
SELECT 
  s.business_name,
  COUNT(*) as total_payments,
  SUM(sp.net_payment) as total_net_payment,
  SUM(sp.amount) as total_amount,
  MAX(sp.created_at) as last_payment
FROM supplier_payments sp
JOIN suppliers s ON s.id = sp.supplier_id
WHERE sp.created_at >= '2025-11-01'
AND sp.status = 'COMPLETED'
GROUP BY s.business_name
ORDER BY last_payment DESC;

-- STEP 5: Cek data "Manual test insert" yang masih muncul
SELECT 
  id,
  supplier_id,
  (SELECT business_name FROM suppliers WHERE id = supplier_payments.supplier_id) as supplier_name,
  net_payment,
  amount,
  payment_reference,
  status,
  created_at
FROM supplier_payments
WHERE payment_reference LIKE '%MANUAL%'
OR payment_reference LIKE '%test%'
ORDER BY created_at DESC;
