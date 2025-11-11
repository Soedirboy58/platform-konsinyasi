-- ================================================
-- WALLET TABLES ONLY - Run this first
-- ================================================

-- 1. SUPPLIER WALLETS
CREATE TABLE IF NOT EXISTS supplier_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL UNIQUE,
  available_balance DECIMAL(15,2) DEFAULT 0,
  pending_balance DECIMAL(15,2) DEFAULT 0,
  total_earned DECIMAL(15,2) DEFAULT 0,
  total_withdrawn DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. WALLET TRANSACTIONS
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL,
  transaction_type VARCHAR(20) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. WITHDRAWAL REQUESTS
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL,
  wallet_id UUID NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  rejection_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SALES TRANSACTIONS
CREATE TABLE IF NOT EXISTS sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  location_id UUID,
  quantity INTEGER NOT NULL,
  selling_price DECIMAL(15,2) NOT NULL,
  cost_price DECIMAL(15,2) NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 70.00,
  commission_amount DECIMAL(15,2) NOT NULL,
  total_revenue DECIMAL(15,2) NOT NULL,
  sale_date DATE DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL,
  location_id UUID,
  movement_type VARCHAR(10) DEFAULT 'IN',
  status VARCHAR(20) DEFAULT 'PENDING',
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. STOCK MOVEMENT ITEMS
CREATE TABLE IF NOT EXISTS stock_movement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Permissive for now)
ALTER TABLE supplier_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movement_items ENABLE ROW LEVEL SECURITY;

-- Allow all operations for testing
DROP POLICY IF EXISTS "allow_all_supplier_wallets" ON supplier_wallets;
CREATE POLICY "allow_all_supplier_wallets" ON supplier_wallets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_wallet_transactions" ON wallet_transactions;
CREATE POLICY "allow_all_wallet_transactions" ON wallet_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_withdrawal_requests" ON withdrawal_requests;
CREATE POLICY "allow_all_withdrawal_requests" ON withdrawal_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_sales_transactions" ON sales_transactions;
CREATE POLICY "allow_all_sales_transactions" ON sales_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_stock_movements" ON stock_movements;
CREATE POLICY "allow_all_stock_movements" ON stock_movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_stock_movement_items" ON stock_movement_items;
CREATE POLICY "allow_all_stock_movement_items" ON stock_movement_items FOR ALL USING (true) WITH CHECK (true);

-- Done
SELECT 'SUCCESS: All 6 tables created with RLS enabled!' AS status;
