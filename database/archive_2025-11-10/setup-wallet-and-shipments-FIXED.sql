-- ================================================
-- QUICK SETUP: Wallet & Shipment System (FIXED)
-- Run this ONCE in Supabase SQL Editor
-- ================================================

-- ================================================
-- PART 1: CREATE TABLES
-- ================================================

-- 1. SUPPLIER WALLETS
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

-- Add foreign key separately (in case suppliers table structure varies)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'supplier_wallets_supplier_id_fkey'
  ) THEN
    ALTER TABLE supplier_wallets 
    ADD CONSTRAINT supplier_wallets_supplier_id_fkey 
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. WALLET TRANSACTIONS
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
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'wallet_transactions_wallet_id_fkey'
  ) THEN
    ALTER TABLE wallet_transactions 
    ADD CONSTRAINT wallet_transactions_wallet_id_fkey 
    FOREIGN KEY (wallet_id) REFERENCES supplier_wallets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. WITHDRAWAL REQUESTS
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
  transfer_proof_url TEXT,
  completed_at TIMESTAMPTZ,
  request_ip INET,
  request_device TEXT,
  otp_verified BOOLEAN DEFAULT FALSE,
  otp_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SALES TRANSACTIONS
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
  customer_name VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. STOCK MOVEMENTS
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

-- 6. STOCK MOVEMENT ITEMS
CREATE TABLE IF NOT EXISTS stock_movement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'stock_movement_items_movement_id_fkey'
  ) THEN
    ALTER TABLE stock_movement_items 
    ADD CONSTRAINT stock_movement_items_movement_id_fkey 
    FOREIGN KEY (movement_id) REFERENCES stock_movements(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ================================================
-- PART 2: CREATE INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_supplier_wallets_supplier ON supplier_wallets(supplier_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_supplier ON withdrawal_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_supplier ON sales_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_product ON sales_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON sales_transactions(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_supplier ON stock_movements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_location ON stock_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON stock_movements(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement ON stock_movement_items(movement_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_product ON stock_movement_items(product_id);

-- ================================================
-- PART 3: ENABLE RLS
-- ================================================

ALTER TABLE supplier_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movement_items ENABLE ROW LEVEL SECURITY;

-- ================================================
-- PART 4: RLS POLICIES
-- ================================================

-- Clean up existing policies
DROP POLICY IF EXISTS "Suppliers can view own wallet" ON supplier_wallets;
DROP POLICY IF EXISTS "Suppliers can insert own wallet" ON supplier_wallets;
DROP POLICY IF EXISTS "Admins can view all wallets" ON supplier_wallets;
DROP POLICY IF EXISTS "Admins can update wallets" ON supplier_wallets;

DROP POLICY IF EXISTS "Suppliers can view own transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Only admins can insert transactions" ON wallet_transactions;

DROP POLICY IF EXISTS "Suppliers can view own requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Suppliers can create withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Suppliers can cancel own pending requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Admins can view all withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Admins can update withdrawal requests" ON withdrawal_requests;

DROP POLICY IF EXISTS "Suppliers can view own sales" ON sales_transactions;
DROP POLICY IF EXISTS "Admins can view all sales" ON sales_transactions;
DROP POLICY IF EXISTS "Admins can insert sales" ON sales_transactions;

DROP POLICY IF EXISTS "Suppliers can view own shipments" ON stock_movements;
DROP POLICY IF EXISTS "Suppliers can create shipments" ON stock_movements;
DROP POLICY IF EXISTS "Suppliers can cancel pending shipments" ON stock_movements;
DROP POLICY IF EXISTS "Admins can view all shipments" ON stock_movements;
DROP POLICY IF EXISTS "Admins can update shipments" ON stock_movements;

DROP POLICY IF EXISTS "Suppliers can view own shipment items" ON stock_movement_items;
DROP POLICY IF EXISTS "Suppliers can insert shipment items" ON stock_movement_items;
DROP POLICY IF EXISTS "Admins can view all shipment items" ON stock_movement_items;

-- SUPPLIER WALLETS POLICIES
CREATE POLICY "Suppliers can view own wallet"
  ON supplier_wallets FOR SELECT
  TO authenticated
  USING (
    supplier_id IN (
      SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can insert own wallet"
  ON supplier_wallets FOR INSERT
  TO authenticated
  WITH CHECK (
    supplier_id IN (
      SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all wallets"
  ON supplier_wallets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    )
  );

-- WALLET TRANSACTIONS POLICIES
CREATE POLICY "Suppliers can view own transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (
    wallet_id IN (
      SELECT sw.id FROM supplier_wallets sw
      INNER JOIN suppliers s ON sw.supplier_id = s.id
      WHERE s.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage transactions"
  ON wallet_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- WITHDRAWAL REQUESTS POLICIES
CREATE POLICY "Suppliers can view own requests"
  ON withdrawal_requests FOR SELECT
  TO authenticated
  USING (
    supplier_id IN (SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid())
  );

CREATE POLICY "Suppliers can create withdrawal requests"
  ON withdrawal_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    supplier_id IN (SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid())
  );

CREATE POLICY "Suppliers can cancel own pending requests"
  ON withdrawal_requests FOR UPDATE
  TO authenticated
  USING (
    supplier_id IN (SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid())
    AND status = 'PENDING'
  )
  WITH CHECK (status = 'CANCELLED');

CREATE POLICY "Admins can manage withdrawal requests"
  ON withdrawal_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- SALES TRANSACTIONS POLICIES
CREATE POLICY "Suppliers can view own sales"
  ON sales_transactions FOR SELECT
  TO authenticated
  USING (
    supplier_id IN (SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid())
  );

CREATE POLICY "Admins can manage sales"
  ON sales_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- STOCK MOVEMENTS POLICIES
CREATE POLICY "Suppliers can view own shipments"
  ON stock_movements FOR SELECT
  TO authenticated
  USING (
    supplier_id IN (SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid())
  );

CREATE POLICY "Suppliers can create shipments"
  ON stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    supplier_id IN (SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid())
  );

CREATE POLICY "Suppliers can cancel pending shipments"
  ON stock_movements FOR UPDATE
  TO authenticated
  USING (
    supplier_id IN (SELECT s.id FROM suppliers s WHERE s.profile_id = auth.uid())
    AND status = 'PENDING'
  )
  WITH CHECK (status = 'CANCELLED');

CREATE POLICY "Admins can manage shipments"
  ON stock_movements FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- STOCK MOVEMENT ITEMS POLICIES
CREATE POLICY "Suppliers can view own shipment items"
  ON stock_movement_items FOR SELECT
  TO authenticated
  USING (
    movement_id IN (
      SELECT sm.id FROM stock_movements sm
      INNER JOIN suppliers s ON sm.supplier_id = s.id
      WHERE s.profile_id = auth.uid()
    )
  );

CREATE POLICY "Suppliers can insert shipment items"
  ON stock_movement_items FOR INSERT
  TO authenticated
  WITH CHECK (
    movement_id IN (
      SELECT sm.id FROM stock_movements sm
      INNER JOIN suppliers s ON sm.supplier_id = s.id
      WHERE s.profile_id = auth.uid() AND sm.status = 'PENDING'
    )
  );

CREATE POLICY "Admins can manage shipment items"
  ON stock_movement_items FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN')
  );

-- ================================================
-- PART 5: INITIALIZE DATA
-- ================================================

-- Create wallets for existing suppliers
DO $$
DECLARE
  supplier_record RECORD;
  wallet_count INTEGER := 0;
BEGIN
  -- Check if suppliers table exists and has records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
    FOR supplier_record IN SELECT id FROM suppliers
    LOOP
      BEGIN
        INSERT INTO supplier_wallets (supplier_id)
        VALUES (supplier_record.id)
        ON CONFLICT (supplier_id) DO NOTHING;
        
        IF FOUND THEN
          wallet_count := wallet_count + 1;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Warning: Could not create wallet for supplier %: %', supplier_record.id, SQLERRM;
      END;
    END LOOP;
    
    RAISE NOTICE 'Created % new wallet(s) for existing suppliers', wallet_count;
  ELSE
    RAISE NOTICE 'Suppliers table not found - skipping wallet initialization';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Warning: Could not initialize wallets: %', SQLERRM;
END $$;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ================================';
  RAISE NOTICE '✅ SETUP COMPLETE!';
  RAISE NOTICE '✅ ================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  ✓ supplier_wallets';
  RAISE NOTICE '  ✓ wallet_transactions';
  RAISE NOTICE '  ✓ withdrawal_requests';
  RAISE NOTICE '  ✓ sales_transactions';
  RAISE NOTICE '  ✓ stock_movements';
  RAISE NOTICE '  ✓ stock_movement_items';
  RAISE NOTICE '';
  RAISE NOTICE 'Security:';
  RAISE NOTICE '  ✓ RLS enabled on all tables';
  RAISE NOTICE '  ✓ Policies configured for suppliers & admins';
  RAISE NOTICE '';
  RAISE NOTICE 'Ready to use! 🚀';
END $$;
