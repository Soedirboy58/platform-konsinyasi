-- ========================================
-- CREATE: Payment Settings Table
-- ========================================
-- Purpose: Menyimpan konfigurasi pembayaran ke supplier
-- Fitur: Minimum threshold, jadwal pembayaran, auto-payment settings
-- ========================================

-- Create payment_settings table (singleton table - hanya 1 row)
CREATE TABLE IF NOT EXISTS payment_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Threshold settings
    minimum_payout_amount DECIMAL(15,2) NOT NULL DEFAULT 100000,
    -- Minimum komisi yang harus dicapai supplier sebelum bisa dibayar
    -- Default: Rp 100.000
    
    -- Payment schedule settings
    payment_schedule VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    -- MANUAL: Admin bayar kapan saja (no schedule)
    -- WEEKLY_FRIDAY: Setiap Jumat
    -- BIWEEKLY: Tanggal 1 & 15
    -- MONTHLY: Akhir bulan
    
    payment_day INTEGER, -- Untuk MONTHLY: 1-31
    reminder_time TIME DEFAULT '14:00:00',
    -- Waktu kirim email reminder (jika ada jadwal)
    
    -- Auto-payment settings (future feature)
    auto_payment_enabled BOOLEAN DEFAULT FALSE,
    auto_payment_provider VARCHAR(50), -- BANK_API, PAYMENT_GATEWAY, etc
    
    -- Notification settings
    notify_admin_email BOOLEAN DEFAULT TRUE,
    notify_supplier_email BOOLEAN DEFAULT TRUE,
    admin_email TEXT,
    
    -- Partial payment settings
    allow_partial_payment BOOLEAN DEFAULT TRUE,
    -- Apakah supplier bisa request pembayaran sebagian sebelum threshold?
    
    -- Metadata
    last_updated_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure only 1 row exists
    CONSTRAINT single_row_only CHECK (id = uuid_generate_v4())
);

-- Insert default settings
INSERT INTO payment_settings (
    minimum_payout_amount,
    payment_schedule,
    reminder_time,
    auto_payment_enabled,
    notify_admin_email,
    notify_supplier_email,
    allow_partial_payment
) VALUES (
    100000, -- Rp 100.000 default threshold
    'MANUAL',
    '14:00:00',
    FALSE,
    TRUE,
    TRUE,
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_settings_updated ON payment_settings(updated_at DESC);

-- Enable RLS
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admin can view settings
CREATE POLICY "Admin can view payment settings"
    ON payment_settings FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- Admin can update settings
CREATE POLICY "Admin can update payment settings"
    ON payment_settings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- Suppliers can view settings (read-only - untuk tahu threshold)
CREATE POLICY "Suppliers can view payment settings"
    ON payment_settings FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN suppliers s ON s.profile_id = p.id
            WHERE p.id = auth.uid()
        )
    );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_settings_updated_at
    BEFORE UPDATE ON payment_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_settings_updated_at();

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE payment_settings IS 'Singleton table untuk konfigurasi pembayaran ke supplier';
COMMENT ON COLUMN payment_settings.minimum_payout_amount IS 'Minimum komisi yang harus dicapai supplier untuk masuk ready-to-pay list';
COMMENT ON COLUMN payment_settings.payment_schedule IS 'Jadwal pembayaran: MANUAL, WEEKLY_FRIDAY, BIWEEKLY, MONTHLY';
COMMENT ON COLUMN payment_settings.allow_partial_payment IS 'Allow supplier request partial payment sebelum mencapai threshold';

-- ========================================
-- SUCCESS
-- ========================================

SELECT 
    'Payment settings table created successfully!' AS status,
    minimum_payout_amount,
    payment_schedule,
    allow_partial_payment
FROM payment_settings
LIMIT 1;
