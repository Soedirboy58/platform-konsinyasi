-- ========================================
-- MIGRATION 002: Wallet System
-- ========================================
-- Description: Supplier wallets, transactions, withdrawals, sales
-- Dependencies: 001_initial_schema.sql
-- Tables: supplier_wallets, wallet_transactions, withdrawal_requests, sales_transactions
-- Rollback: See bottom
-- ========================================

-- 1. SUPPLIER WALLETS
CREATE TABLE IF NOT EXISTS supplier_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL UNIQUE REFERENCES suppliers(id) ON DELETE CASCADE,
  available_balance DECIMAL(15,2) DEFAULT 0 CHECK (available_balance >= 0),
  pending_balance DECIMAL(15,2) DEFAULT 0 CHECK (pending_balance >= 0),
  total_earned DECIMAL(15,2) DEFAULT 0 CHECK (total_earned >= 0),
  total_withdrawn DECIMAL(15,2) DEFAULT 0 CHECK (total_withdrawn >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. WALLET TRANSACTIONS
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES supplier_wallets(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('CREDIT', 'DEBIT', 'WITHDRAWAL', 'COMMISSION')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type VARCHAR(50),
  metadata JSONB,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. WITHDRAWAL REQUESTS
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES supplier_wallets(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_holder_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SALES TRANSACTIONS
CREATE TABLE IF NOT EXISTS sales_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  selling_price DECIMAL(15,2) NOT NULL CHECK (selling_price > 0),
  cost_price DECIMAL(15,2) NOT NULL CHECK (cost_price >= 0),
  commission_rate DECIMAL(5,2) DEFAULT 70.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_amount DECIMAL(15,2) NOT NULL CHECK (commission_amount >= 0),
  total_revenue DECIMAL(15,2) NOT NULL CHECK (total_revenue >= 0),
  sale_date DATE DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_supplier ON withdrawal_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_supplier ON sales_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_product ON sales_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON sales_transactions(sale_date DESC);

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 002: Wallet System - SUCCESS!' AS status;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================
-- DROP TABLE IF EXISTS sales_transactions CASCADE;
-- DROP TABLE IF EXISTS withdrawal_requests CASCADE;
-- DROP TABLE IF EXISTS wallet_transactions CASCADE;
-- DROP TABLE IF NOT EXISTS supplier_wallets CASCADE;
