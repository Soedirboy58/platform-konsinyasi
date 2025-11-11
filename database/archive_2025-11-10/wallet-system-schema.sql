-- ================================================
-- WALLET SYSTEM FOR SUPPLIERS
-- Secure e-wallet with withdrawal management
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
  reference_id UUID, -- Link to sale_id, withdrawal_id, etc
  reference_type VARCHAR(50), -- 'SALE', 'WITHDRAWAL', 'MANUAL'
  metadata JSONB, -- Extra info (product_id, location_id, etc)
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
  
  -- Security fields
  request_ip INET,
  request_device TEXT,
  otp_verified BOOLEAN DEFAULT FALSE,
  otp_verified_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SALES TRANSACTIONS (untuk tracking penjualan produk)
CREATE TABLE IF NOT EXISTS sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  selling_price DECIMAL(15,2) NOT NULL,
  cost_price DECIMAL(15,2) NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 70.00, -- 70% for supplier
  commission_amount DECIMAL(15,2) NOT NULL,
  total_revenue DECIMAL(15,2) NOT NULL,
  sale_date DATE DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50),
  customer_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. WITHDRAWAL LIMITS (per supplier configuration)
CREATE TABLE IF NOT EXISTS withdrawal_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE UNIQUE NOT NULL,
  minimum_withdrawal DECIMAL(15,2) DEFAULT 50000,
  maximum_daily_withdrawal DECIMAL(15,2) DEFAULT 10000000,
  maximum_monthly_withdrawal DECIMAL(15,2) DEFAULT 50000000,
  require_otp BOOLEAN DEFAULT TRUE,
  require_admin_approval BOOLEAN DEFAULT TRUE,
  auto_approve_threshold DECIMAL(15,2) DEFAULT 1000000, -- Auto approve if < 1jt
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- INDEXES for Performance
-- ================================================
CREATE INDEX IF NOT EXISTS idx_supplier_wallets_supplier ON supplier_wallets(supplier_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_supplier ON withdrawal_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_supplier ON sales_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_product ON sales_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON sales_transactions(sale_date DESC);

-- ================================================
-- RLS POLICIES - SECURITY
-- ================================================

-- SUPPLIER WALLETS
ALTER TABLE supplier_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view own wallet"
  ON supplier_wallets FOR SELECT
  USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all wallets"
  ON supplier_wallets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- WALLET TRANSACTIONS
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view own transactions"
  ON wallet_transactions FOR SELECT
  USING (
    wallet_id IN (
      SELECT id FROM supplier_wallets 
      WHERE supplier_id IN (
        SELECT id FROM suppliers WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can view all transactions"
  ON wallet_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Only admins can insert transactions"
  ON wallet_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- WITHDRAWAL REQUESTS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view own requests"
  ON withdrawal_requests FOR SELECT
  USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can create withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (
    supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can cancel own pending requests"
  ON withdrawal_requests FOR UPDATE
  USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
    AND status = 'PENDING'
  )
  WITH CHECK (status = 'CANCELLED');

CREATE POLICY "Admins can view all withdrawal requests"
  ON withdrawal_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can update withdrawal requests"
  ON withdrawal_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- SALES TRANSACTIONS
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view own sales"
  ON sales_transactions FOR SELECT
  USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all sales"
  ON sales_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can insert sales"
  ON sales_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ================================================
-- FUNCTIONS for Business Logic
-- ================================================

-- Function: Process Sale and Credit Wallet
CREATE OR REPLACE FUNCTION process_sale_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance DECIMAL(15,2);
BEGIN
  -- Get or create wallet for supplier
  INSERT INTO supplier_wallets (supplier_id)
  VALUES (NEW.supplier_id)
  ON CONFLICT (supplier_id) DO NOTHING;

  SELECT id, available_balance INTO v_wallet_id, v_current_balance
  FROM supplier_wallets
  WHERE supplier_id = NEW.supplier_id;

  -- Credit commission to pending balance (requires admin approval)
  UPDATE supplier_wallets
  SET 
    pending_balance = pending_balance + NEW.commission_amount,
    total_earned = total_earned + NEW.commission_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Log transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    reference_id,
    reference_type,
    metadata
  ) VALUES (
    v_wallet_id,
    'COMMISSION',
    NEW.commission_amount,
    v_current_balance,
    v_current_balance, -- Available balance doesn't change yet
    'Commission from product sale',
    NEW.id,
    'SALE',
    jsonb_build_object(
      'product_id', NEW.product_id,
      'quantity', NEW.quantity,
      'selling_price', NEW.selling_price
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_process_sale_commission
AFTER INSERT ON sales_transactions
FOR EACH ROW
EXECUTE FUNCTION process_sale_commission();

-- Function: Approve Withdrawal Request
CREATE OR REPLACE FUNCTION approve_withdrawal_request(
  p_request_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_amount DECIMAL(15,2);
  v_wallet_id UUID;
  v_supplier_id UUID;
  v_current_balance DECIMAL(15,2);
BEGIN
  -- Get withdrawal details
  SELECT amount, wallet_id, supplier_id
  INTO v_amount, v_wallet_id, v_supplier_id
  FROM withdrawal_requests
  WHERE id = p_request_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;

  -- Check available balance
  SELECT available_balance INTO v_current_balance
  FROM supplier_wallets
  WHERE id = v_wallet_id;

  IF v_current_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct from wallet
  UPDATE supplier_wallets
  SET 
    available_balance = available_balance - v_amount,
    total_withdrawn = total_withdrawn + v_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Update withdrawal request
  UPDATE withdrawal_requests
  SET 
    status = 'APPROVED',
    reviewed_at = NOW(),
    reviewed_by = p_admin_id,
    admin_notes = p_admin_notes,
    updated_at = NOW()
  WHERE id = p_request_id;

  -- Log transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    reference_id,
    reference_type,
    created_by
  ) VALUES (
    v_wallet_id,
    'WITHDRAWAL',
    v_amount,
    v_current_balance,
    v_current_balance - v_amount,
    'Withdrawal approved by admin',
    p_request_id,
    'WITHDRAWAL',
    p_admin_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Move pending to available balance (admin bulk approve)
CREATE OR REPLACE FUNCTION approve_pending_commissions(
  p_supplier_id UUID,
  p_admin_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  v_wallet_id UUID;
  v_pending_amount DECIMAL(15,2);
  v_current_balance DECIMAL(15,2);
BEGIN
  SELECT id, pending_balance, available_balance
  INTO v_wallet_id, v_pending_amount, v_current_balance
  FROM supplier_wallets
  WHERE supplier_id = p_supplier_id;

  IF v_pending_amount <= 0 THEN
    RETURN 0;
  END IF;

  -- Move from pending to available
  UPDATE supplier_wallets
  SET 
    available_balance = available_balance + pending_balance,
    pending_balance = 0,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Log transaction
  INSERT INTO wallet_transactions (
    wallet_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    reference_type,
    created_by
  ) VALUES (
    v_wallet_id,
    'CREDIT',
    v_pending_amount,
    v_current_balance,
    v_current_balance + v_pending_amount,
    'Commission approved and credited to available balance',
    'COMMISSION_APPROVAL',
    p_admin_id
  );

  RETURN v_pending_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- INITIAL DATA
-- ================================================

-- Create default withdrawal limits for all suppliers
INSERT INTO withdrawal_limits (supplier_id)
SELECT id FROM suppliers
ON CONFLICT (supplier_id) DO NOTHING;

-- Create wallets for all existing suppliers
INSERT INTO supplier_wallets (supplier_id)
SELECT id FROM suppliers
ON CONFLICT (supplier_id) DO NOTHING;

-- ================================================
-- VIEWS for Reporting
-- ================================================

-- Supplier Wallet Summary
CREATE OR REPLACE VIEW supplier_wallet_summary AS
SELECT 
  s.id as supplier_id,
  s.business_name,
  sw.available_balance,
  sw.pending_balance,
  sw.total_earned,
  sw.total_withdrawn,
  (sw.available_balance + sw.pending_balance) as total_balance,
  COUNT(DISTINCT wr.id) FILTER (WHERE wr.status = 'PENDING') as pending_withdrawals,
  COALESCE(SUM(st.commission_amount) FILTER (WHERE st.sale_date >= CURRENT_DATE - INTERVAL '30 days'), 0) as commission_last_30_days
FROM suppliers s
LEFT JOIN supplier_wallets sw ON s.id = sw.supplier_id
LEFT JOIN withdrawal_requests wr ON s.id = wr.supplier_id
LEFT JOIN sales_transactions st ON s.id = st.supplier_id
GROUP BY s.id, s.business_name, sw.available_balance, sw.pending_balance, sw.total_earned, sw.total_withdrawn;

COMMENT ON TABLE supplier_wallets IS 'E-wallet for supplier commission management';
COMMENT ON TABLE wallet_transactions IS 'Immutable audit log of all wallet transactions';
COMMENT ON TABLE withdrawal_requests IS 'Supplier requests to withdraw funds to bank account';
COMMENT ON TABLE sales_transactions IS 'Record of all product sales and commission calculation';
