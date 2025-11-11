-- ================================================
-- MINIMAL SETUP: Wallet & Shipment System
-- Run this if the FIXED version still has errors
-- ================================================

-- ================================================
-- STEP 1: CREATE TABLES ONLY (NO FOREIGN KEYS YET)
-- ================================================

CREATE TABLE IF NOT EXISTS supplier_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL UNIQUE,
  available_balance DECIMAL(15,2) DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance DECIMAL(15,2) DEFAULT 0 CHECK (pending_balance >= 0),
  total_earned DECIMAL(15,2) DEFAULT 0,
  total_withdrawn DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('CREDIT', 'DEBIT', 'COMMISSION', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL,
  wallet_id UUID NOT NULL,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  rejection_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  supplier_id UUID NOT NULL,
  location_id UUID,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
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

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL,
  location_id UUID,
  movement_type VARCHAR(10) DEFAULT 'IN' CHECK (movement_type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT')),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- STEP 2: CREATE INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_supplier_wallets_supplier ON supplier_wallets(supplier_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_supplier ON withdrawal_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_supplier ON sales_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_supplier ON stock_movements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement ON stock_movement_items(movement_id);

-- ================================================
-- STEP 3: ENABLE RLS
-- ================================================

ALTER TABLE supplier_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movement_items ENABLE ROW LEVEL SECURITY;

-- ================================================
-- STEP 4: CREATE BASIC RLS POLICIES
-- ================================================

-- SUPPLIER WALLETS
DROP POLICY IF EXISTS "supplier_wallets_select" ON supplier_wallets;
CREATE POLICY "supplier_wallets_select" ON supplier_wallets FOR SELECT USING (true);

DROP POLICY IF EXISTS "supplier_wallets_insert" ON supplier_wallets;
CREATE POLICY "supplier_wallets_insert" ON supplier_wallets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "supplier_wallets_update" ON supplier_wallets;
CREATE POLICY "supplier_wallets_update" ON supplier_wallets FOR UPDATE USING (true);

-- WALLET TRANSACTIONS
DROP POLICY IF EXISTS "wallet_transactions_select" ON wallet_transactions;
CREATE POLICY "wallet_transactions_select" ON wallet_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "wallet_transactions_insert" ON wallet_transactions;
CREATE POLICY "wallet_transactions_insert" ON wallet_transactions FOR INSERT WITH CHECK (true);

-- WITHDRAWAL REQUESTS
DROP POLICY IF EXISTS "withdrawal_requests_select" ON withdrawal_requests;
CREATE POLICY "withdrawal_requests_select" ON withdrawal_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "withdrawal_requests_insert" ON withdrawal_requests;
CREATE POLICY "withdrawal_requests_insert" ON withdrawal_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "withdrawal_requests_update" ON withdrawal_requests;
CREATE POLICY "withdrawal_requests_update" ON withdrawal_requests FOR UPDATE USING (true);

-- SALES TRANSACTIONS
DROP POLICY IF EXISTS "sales_transactions_select" ON sales_transactions;
CREATE POLICY "sales_transactions_select" ON sales_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "sales_transactions_insert" ON sales_transactions;
CREATE POLICY "sales_transactions_insert" ON sales_transactions FOR INSERT WITH CHECK (true);

-- STOCK MOVEMENTS
DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT USING (true);

DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "stock_movements_update" ON stock_movements;
CREATE POLICY "stock_movements_update" ON stock_movements FOR UPDATE USING (true);

-- STOCK MOVEMENT ITEMS
DROP POLICY IF EXISTS "stock_movement_items_select" ON stock_movement_items;
CREATE POLICY "stock_movement_items_select" ON stock_movement_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "stock_movement_items_insert" ON stock_movement_items;
CREATE POLICY "stock_movement_items_insert" ON stock_movement_items FOR INSERT WITH CHECK (true);

-- ================================================
-- SUCCESS
-- ================================================

SELECT 'Setup Complete! Tables created with basic RLS policies.' AS message;
