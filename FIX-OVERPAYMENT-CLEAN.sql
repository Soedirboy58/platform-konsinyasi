-- ========================================
-- FIX OVER-PAYMENT - CLEAN VERSION
-- ========================================
-- Jalankan query ini di Supabase SQL Editor
-- ========================================

-- STEP 1: UPDATE WALLET BALANCE (Aneka Snack)
UPDATE supplier_wallets
SET 
  available_balance = available_balance + 24840,
  updated_at = NOW()
WHERE supplier_id = (
  SELECT id FROM suppliers WHERE business_name = 'Aneka Snack'
);

-- STEP 2: LOG TRANSACTION (Aneka Snack)
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

-- STEP 3: UPDATE WALLET BALANCE (Aneka Snack A)
UPDATE supplier_wallets
SET 
  available_balance = available_balance + 81000,
  updated_at = NOW()
WHERE supplier_id = (
  SELECT id FROM suppliers WHERE business_name = 'Aneka Snack A'
);

-- STEP 4: LOG TRANSACTION (Aneka Snack A)
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

-- DONE! Verify with this query:
SELECT 
  s.business_name,
  sw.available_balance
FROM suppliers s
JOIN supplier_wallets sw ON sw.supplier_id = s.id
WHERE s.business_name IN ('Aneka Snack', 'Aneka Snack A');
