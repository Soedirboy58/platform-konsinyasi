-- ========================================
-- CREATE: Supplier Payment Tracking Table
-- ========================================
-- Purpose: Track manual payments from admin to suppliers
-- This is SEPARATE from automatic wallet crediting (which happens via confirm_payment)
-- This table tracks MANUAL TRANSFER payments for withdrawal requests or manual payouts
-- ========================================

-- Create supplier_payments table
CREATE TABLE IF NOT EXISTS supplier_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES supplier_wallets(id) ON DELETE SET NULL,
    
    -- Payment details
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    payment_reference VARCHAR(100) NOT NULL UNIQUE,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'BANK_TRANSFER',
    
    -- Bank details (for record keeping)
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(50),
    bank_account_holder VARCHAR(200),
    
    -- Supporting documents
    payment_proof_url TEXT,
    notes TEXT,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    -- COMPLETED: Payment successfully sent
    -- FAILED: Payment failed
    -- CANCELLED: Payment cancelled
    
    -- Period covered (optional - for reporting)
    period_start DATE,
    period_end DATE,
    
    -- Audit fields
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX idx_supplier_payments_date ON supplier_payments(payment_date DESC);
CREATE INDEX idx_supplier_payments_reference ON supplier_payments(payment_reference);
CREATE INDEX idx_supplier_payments_status ON supplier_payments(status);
CREATE INDEX idx_supplier_payments_created ON supplier_payments(created_at DESC);

-- Enable RLS
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin can see all payments
CREATE POLICY "Admin can view all supplier payments"
    ON supplier_payments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
            AND profiles.is_active = TRUE
        )
    );

-- Admin can insert payments
CREATE POLICY "Admin can insert supplier payments"
    ON supplier_payments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
            AND profiles.is_active = TRUE
        )
    );

-- Admin can update payments
CREATE POLICY "Admin can update supplier payments"
    ON supplier_payments FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
            AND profiles.is_active = TRUE
        )
    );

-- Suppliers can see their own payments
CREATE POLICY "Suppliers can view their own payments"
    ON supplier_payments FOR SELECT
    TO authenticated
    USING (
        supplier_id IN (
            SELECT id FROM suppliers
            WHERE profile_id = auth.uid()
        )
    );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_supplier_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_supplier_payments_updated_at
    BEFORE UPDATE ON supplier_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_payments_updated_at();

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE supplier_payments IS 'Tracks manual bank transfer payments from admin to suppliers';
COMMENT ON COLUMN supplier_payments.amount IS 'Amount transferred to supplier';
COMMENT ON COLUMN supplier_payments.payment_reference IS 'Unique payment reference number (e.g., TRF-20241113-001-KBI)';
COMMENT ON COLUMN supplier_payments.payment_method IS 'Payment method used (BANK_TRANSFER, CASH, etc)';
COMMENT ON COLUMN supplier_payments.period_start IS 'Start date of commission period covered by this payment';
COMMENT ON COLUMN supplier_payments.period_end IS 'End date of commission period covered by this payment';

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Supplier payments table created successfully!' AS status;
