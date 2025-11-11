-- ================================================
-- QUICK SETUP: All Required Tables for Wallet & Shipment System
-- Run this ONCE in Supabase SQL Editor
-- ================================================

-- This file combines:
-- 1. Wallet System (wallet-system-schema.sql)
-- 2. Stock Movements (stock-movements-schema.sql)

-- ================================================
-- PART 1: WALLET SYSTEM
-- ================================================

-- 1. SUPPLIER WALLETS TABLE
CREATE TABLE IF NOT EXISTS supplier_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE UNIQUE NOT NULL,
  available_balance DECIMAL(15,2) DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance DECIMAL(15,2) DEFAULT 0 CHECK (pending_balance >= 0),
  total_earned DECIMAL(15,2) DEFAULT 0,
  total_withdrawn DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. WALLET TRANSACTIONS (Immutable Audit Log)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES supplier_wallets(id) ON DELETE CASCADE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('CREDIT', 'DEBIT', 'COMMISSION', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  metadata JSONB,
  created_by UUID REFERENCES profiles(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. WITHDRAWAL REQUESTS
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  wallet_id UUID REFERENCES supplier_wallets(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  admin_notes TEXT,
  transfer_proof_url TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  request_ip INET,
  request_device TEXT,
  otp_verified BOOLEAN DEFAULT FALSE,
  otp_verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SALES TRANSACTIONS
CREATE TABLE IF NOT EXISTS sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  selling_price DECIMAL(15,2) NOT NULL,
  cost_price DECIMAL(15,2) NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 70.00,
  commission_amount DECIMAL(15,2) NOT NULL,
  total_revenue DECIMAL(15,2) NOT NULL,
  sale_date DATE DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50),
  customer_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- PART 2: STOCK MOVEMENTS (SHIPMENTS)
-- ================================================

-- 1. STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  movement_type VARCHAR(10) DEFAULT 'IN' CHECK (movement_type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT')),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. STOCK MOVEMENT ITEMS
CREATE TABLE IF NOT EXISTS stock_movement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID REFERENCES stock_movements(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- INDEXES
-- ================================================

-- Wallet indexes
CREATE INDEX IF NOT EXISTS idx_supplier_wallets_supplier ON supplier_wallets(supplier_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_supplier ON withdrawal_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_supplier ON sales_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_product ON sales_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON sales_transactions(sale_date DESC);

-- Stock movement indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_supplier ON stock_movements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_location ON stock_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON stock_movements(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement ON stock_movement_items(movement_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_product ON stock_movement_items(product_id);

-- ================================================
-- RLS POLICIES - WALLET TABLES
-- ================================================

ALTER TABLE supplier_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;

-- Supplier Wallets
DROP POLICY IF EXISTS "Suppliers can view own wallet" ON supplier_wallets;
CREATE POLICY "Suppliers can view own wallet"
  ON supplier_wallets FOR SELECT
  USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view all wallets" ON supplier_wallets;
CREATE POLICY "Admins can view all wallets"
  ON supplier_wallets FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Wallet Transactions
DROP POLICY IF EXISTS "Suppliers can view own transactions" ON wallet_transactions;
CREATE POLICY "Suppliers can view own transactions"
  ON wallet_transactions FOR SELECT
  USING (wallet_id IN (SELECT id FROM supplier_wallets WHERE supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())));

DROP POLICY IF EXISTS "Admins can view all transactions" ON wallet_transactions;
CREATE POLICY "Admins can view all transactions"
  ON wallet_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "Only admins can insert transactions" ON wallet_transactions;
CREATE POLICY "Only admins can insert transactions"
  ON wallet_transactions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Withdrawal Requests
DROP POLICY IF EXISTS "Suppliers can view own requests" ON withdrawal_requests;
CREATE POLICY "Suppliers can view own requests"
  ON withdrawal_requests FOR SELECT
  USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS "Suppliers can create withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Suppliers can create withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS "Suppliers can cancel own pending requests" ON withdrawal_requests;
CREATE POLICY "Suppliers can cancel own pending requests"
  ON withdrawal_requests FOR UPDATE
  USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()) AND status = 'PENDING')
  WITH CHECK (status = 'CANCELLED');

DROP POLICY IF EXISTS "Admins can view all withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Admins can view all withdrawal requests"
  ON withdrawal_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "Admins can update withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Admins can update withdrawal requests"
  ON withdrawal_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Sales Transactions
DROP POLICY IF EXISTS "Suppliers can view own sales" ON sales_transactions;
CREATE POLICY "Suppliers can view own sales"
  ON sales_transactions FOR SELECT
  USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can view all sales" ON sales_transactions;
CREATE POLICY "Admins can view all sales"
  ON sales_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "Admins can insert sales" ON sales_transactions;
CREATE POLICY "Admins can insert sales"
  ON sales_transactions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- ================================================
-- RLS POLICIES - STOCK MOVEMENTS
-- ================================================

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movement_items ENABLE ROW LEVEL SECURITY;

-- Stock Movements
DROP POLICY IF EXISTS "Suppliers can view own shipments" ON stock_movements;
CREATE POLICY "Suppliers can view own shipments"
  ON stock_movements FOR SELECT
  USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS "Suppliers can create shipments" ON stock_movements;
CREATE POLICY "Suppliers can create shipments"
  ON stock_movements FOR INSERT
  WITH CHECK (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()));

DROP POLICY IF EXISTS "Suppliers can cancel pending shipments" ON stock_movements;
CREATE POLICY "Suppliers can cancel pending shipments"
  ON stock_movements FOR UPDATE
  USING (supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()) AND status = 'PENDING')
  WITH CHECK (status = 'CANCELLED');

DROP POLICY IF EXISTS "Admins can view all shipments" ON stock_movements;
CREATE POLICY "Admins can view all shipments"
  ON stock_movements FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "Admins can update shipments" ON stock_movements;
CREATE POLICY "Admins can update shipments"
  ON stock_movements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- Stock Movement Items
DROP POLICY IF EXISTS "Suppliers can view own shipment items" ON stock_movement_items;
CREATE POLICY "Suppliers can view own shipment items"
  ON stock_movement_items FOR SELECT
  USING (movement_id IN (SELECT id FROM stock_movements WHERE supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())));

DROP POLICY IF EXISTS "Suppliers can insert shipment items" ON stock_movement_items;
CREATE POLICY "Suppliers can insert shipment items"
  ON stock_movement_items FOR INSERT
  WITH CHECK (movement_id IN (SELECT id FROM stock_movements WHERE supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid()) AND status = 'PENDING'));

DROP POLICY IF EXISTS "Admins can view all shipment items" ON stock_movement_items;
CREATE POLICY "Admins can view all shipment items"
  ON stock_movement_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- ================================================
-- INITIALIZE DATA
-- ================================================

-- Create wallets for all existing suppliers
INSERT INTO supplier_wallets (supplier_id)
SELECT id FROM suppliers
WHERE id NOT IN (SELECT supplier_id FROM supplier_wallets)
ON CONFLICT (supplier_id) DO NOTHING;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Setup Complete!';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - supplier_wallets';
  RAISE NOTICE '  - wallet_transactions';
  RAISE NOTICE '  - withdrawal_requests';
  RAISE NOTICE '  - sales_transactions';
  RAISE NOTICE '  - stock_movements';
  RAISE NOTICE '  - stock_movement_items';
  RAISE NOTICE '';
  RAISE NOTICE 'RLS policies enabled for security';
  RAISE NOTICE 'Wallets created for existing suppliers';
END $$;
