-- ================================================
-- STEP 2B (SAFE): Internal Constraints Only
-- Run this after wallet-tables-only.sql
-- No external foreign keys to avoid errors
-- ================================================

-- ================================================
-- PART 1: ADD INDEXES FOR PERFORMANCE
-- ================================================

CREATE INDEX IF NOT EXISTS idx_supplier_wallets_supplier ON supplier_wallets(supplier_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_supplier ON withdrawal_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_supplier ON sales_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_product ON sales_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_date ON sales_transactions(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_supplier ON stock_movements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON stock_movements(status);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement ON stock_movement_items(movement_id);

-- ================================================
-- PART 2: ADD CHECK CONSTRAINTS
-- ================================================

DO $$ 
BEGIN
    -- Supplier wallets checks
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_available_balance_positive' 
        AND conrelid = 'supplier_wallets'::regclass
    ) THEN
        ALTER TABLE supplier_wallets 
        ADD CONSTRAINT check_available_balance_positive 
        CHECK (available_balance >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_pending_balance_positive' 
        AND conrelid = 'supplier_wallets'::regclass
    ) THEN
        ALTER TABLE supplier_wallets 
        ADD CONSTRAINT check_pending_balance_positive 
        CHECK (pending_balance >= 0);
    END IF;

    -- Wallet transactions checks
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_amount_positive' 
        AND conrelid = 'wallet_transactions'::regclass
    ) THEN
        ALTER TABLE wallet_transactions 
        ADD CONSTRAINT check_amount_positive 
        CHECK (amount > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_transaction_type' 
        AND conrelid = 'wallet_transactions'::regclass
    ) THEN
        ALTER TABLE wallet_transactions 
        ADD CONSTRAINT check_transaction_type 
        CHECK (transaction_type IN ('CREDIT', 'DEBIT', 'COMMISSION', 'WITHDRAWAL', 'REFUND', 'ADJUSTMENT'));
    END IF;

    -- Withdrawal requests checks
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_withdrawal_amount_positive' 
        AND conrelid = 'withdrawal_requests'::regclass
    ) THEN
        ALTER TABLE withdrawal_requests 
        ADD CONSTRAINT check_withdrawal_amount_positive 
        CHECK (amount > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_withdrawal_status' 
        AND conrelid = 'withdrawal_requests'::regclass
    ) THEN
        ALTER TABLE withdrawal_requests 
        ADD CONSTRAINT check_withdrawal_status 
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'));
    END IF;

    -- Sales transactions checks
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_sales_quantity_positive' 
        AND conrelid = 'sales_transactions'::regclass
    ) THEN
        ALTER TABLE sales_transactions 
        ADD CONSTRAINT check_sales_quantity_positive 
        CHECK (quantity > 0);
    END IF;

    -- Stock movements checks
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_movement_type' 
        AND conrelid = 'stock_movements'::regclass
    ) THEN
        ALTER TABLE stock_movements 
        ADD CONSTRAINT check_movement_type 
        CHECK (movement_type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_movement_status' 
        AND conrelid = 'stock_movements'::regclass
    ) THEN
        ALTER TABLE stock_movements 
        ADD CONSTRAINT check_movement_status 
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'));
    END IF;

    -- Stock movement items checks
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_stock_quantity_positive' 
        AND conrelid = 'stock_movement_items'::regclass
    ) THEN
        ALTER TABLE stock_movement_items 
        ADD CONSTRAINT check_stock_quantity_positive 
        CHECK (quantity > 0);
    END IF;
END $$;

-- ================================================
-- PART 3: ADD INTERNAL FOREIGN KEY CONSTRAINTS ONLY
-- (Only between wallet tables)
-- ================================================

DO $$ 
BEGIN
    -- Wallet transactions -> supplier_wallets (INTERNAL)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_wallet_transactions_wallet'
    ) THEN
        ALTER TABLE wallet_transactions 
        ADD CONSTRAINT fk_wallet_transactions_wallet 
        FOREIGN KEY (wallet_id) REFERENCES supplier_wallets(id) ON DELETE CASCADE;
    END IF;

    -- Withdrawal requests -> supplier_wallets (INTERNAL)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_withdrawal_requests_wallet'
    ) THEN
        ALTER TABLE withdrawal_requests 
        ADD CONSTRAINT fk_withdrawal_requests_wallet 
        FOREIGN KEY (wallet_id) REFERENCES supplier_wallets(id) ON DELETE CASCADE;
    END IF;

    -- Stock movement items -> stock_movements (INTERNAL)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_stock_movement_items_movement'
    ) THEN
        ALTER TABLE stock_movement_items 
        ADD CONSTRAINT fk_stock_movement_items_movement 
        FOREIGN KEY (movement_id) REFERENCES stock_movements(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ================================================
-- PART 4: BUSINESS LOGIC FUNCTIONS
-- ================================================

-- Function 1: Create wallet transaction
CREATE OR REPLACE FUNCTION create_wallet_transaction(
    p_wallet_id UUID,
    p_type VARCHAR,
    p_amount DECIMAL,
    p_description TEXT,
    p_reference_id UUID DEFAULT NULL,
    p_reference_type VARCHAR DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_current_balance DECIMAL;
    v_new_balance DECIMAL;
    v_transaction_id UUID;
BEGIN
    SELECT available_balance INTO v_current_balance
    FROM supplier_wallets WHERE id = p_wallet_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;

    IF p_type IN ('CREDIT', 'COMMISSION', 'REFUND') THEN
        v_new_balance := v_current_balance + p_amount;
    ELSIF p_type IN ('DEBIT', 'WITHDRAWAL') THEN
        v_new_balance := v_current_balance - p_amount;
        IF v_new_balance < 0 THEN
            RAISE EXCEPTION 'Insufficient balance';
        END IF;
    ELSE
        v_new_balance := v_current_balance;
    END IF;

    INSERT INTO wallet_transactions (
        wallet_id, transaction_type, amount, 
        balance_before, balance_after, description,
        reference_id, reference_type, created_by
    ) VALUES (
        p_wallet_id, p_type, p_amount,
        v_current_balance, v_new_balance, p_description,
        p_reference_id, p_reference_type, p_created_by
    ) RETURNING id INTO v_transaction_id;

    UPDATE supplier_wallets
    SET available_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_wallet_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Approve withdrawal request
CREATE OR REPLACE FUNCTION approve_withdrawal_request(
    p_withdrawal_id UUID,
    p_admin_id UUID,
    p_admin_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_wallet_id UUID;
    v_amount DECIMAL;
BEGIN
    SELECT wallet_id, amount 
    INTO v_wallet_id, v_amount
    FROM withdrawal_requests
    WHERE id = p_withdrawal_id AND status = 'PENDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal not found or already processed';
    END IF;

    PERFORM create_wallet_transaction(
        v_wallet_id, 'WITHDRAWAL', v_amount,
        'Pencairan dana', p_withdrawal_id, 'WITHDRAWAL', p_admin_id
    );

    UPDATE withdrawal_requests
    SET status = 'APPROVED',
        reviewed_at = NOW(),
        reviewed_by = p_admin_id,
        admin_notes = p_admin_notes
    WHERE id = p_withdrawal_id;

    UPDATE supplier_wallets
    SET total_withdrawn = total_withdrawn + v_amount
    WHERE id = v_wallet_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Reject withdrawal
CREATE OR REPLACE FUNCTION reject_withdrawal_request(
    p_withdrawal_id UUID,
    p_admin_id UUID,
    p_rejection_reason TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE withdrawal_requests
    SET status = 'REJECTED',
        reviewed_at = NOW(),
        reviewed_by = p_admin_id,
        rejection_reason = p_rejection_reason
    WHERE id = p_withdrawal_id AND status = 'PENDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Withdrawal not found or already processed';
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 4: Record sale with commission
CREATE OR REPLACE FUNCTION record_sale_with_commission(
    p_product_id UUID,
    p_supplier_id UUID,
    p_location_id UUID,
    p_quantity INTEGER,
    p_selling_price DECIMAL,
    p_cost_price DECIMAL,
    p_commission_rate DECIMAL DEFAULT 70.00
) RETURNS UUID AS $$
DECLARE
    v_commission DECIMAL;
    v_revenue DECIMAL;
    v_sale_id UUID;
    v_wallet_id UUID;
BEGIN
    v_revenue := p_selling_price * p_quantity;
    v_commission := v_revenue * (p_commission_rate / 100);

    INSERT INTO sales_transactions (
        product_id, supplier_id, location_id,
        quantity, selling_price, cost_price,
        commission_rate, commission_amount, total_revenue
    ) VALUES (
        p_product_id, p_supplier_id, p_location_id,
        p_quantity, p_selling_price, p_cost_price,
        p_commission_rate, v_commission, v_revenue
    ) RETURNING id INTO v_sale_id;

    SELECT id INTO v_wallet_id
    FROM supplier_wallets WHERE supplier_id = p_supplier_id;

    IF NOT FOUND THEN
        INSERT INTO supplier_wallets (supplier_id)
        VALUES (p_supplier_id) RETURNING id INTO v_wallet_id;
    END IF;

    UPDATE supplier_wallets
    SET pending_balance = pending_balance + v_commission,
        total_earned = total_earned + v_commission
    WHERE id = v_wallet_id;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 5: Approve pending commission
CREATE OR REPLACE FUNCTION approve_pending_commission(
    p_wallet_id UUID,
    p_amount DECIMAL,
    p_admin_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE supplier_wallets
    SET pending_balance = pending_balance - p_amount,
        available_balance = available_balance + p_amount
    WHERE id = p_wallet_id AND pending_balance >= p_amount;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient pending balance';
    END IF;

    INSERT INTO wallet_transactions (
        wallet_id, transaction_type, amount,
        balance_before, balance_after,
        description, created_by
    )
    SELECT p_wallet_id, 'CREDIT', p_amount,
           available_balance - p_amount, available_balance,
           'Komisi disetujui', p_admin_id
    FROM supplier_wallets WHERE id = p_wallet_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 6: Approve stock movement
CREATE OR REPLACE FUNCTION approve_stock_movement(
    p_movement_id UUID,
    p_admin_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE stock_movements
    SET status = 'APPROVED',
        approved_by = p_admin_id,
        approved_at = NOW()
    WHERE id = p_movement_id AND status = 'PENDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movement not found or already processed';
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 7: Reject stock movement
CREATE OR REPLACE FUNCTION reject_stock_movement(
    p_movement_id UUID,
    p_admin_id UUID,
    p_rejection_reason TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE stock_movements
    SET status = 'REJECTED',
        approved_by = p_admin_id,
        approved_at = NOW(),
        rejection_reason = p_rejection_reason
    WHERE id = p_movement_id AND status = 'PENDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movement not found or already processed';
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- SUCCESS
-- ================================================

SELECT 'SUCCESS: All constraints and functions created!' AS status;
