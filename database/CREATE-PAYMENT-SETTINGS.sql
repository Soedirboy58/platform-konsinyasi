-- Create payment_settings table for threshold configuration
-- This table stores global payment configuration for the platform

CREATE TABLE IF NOT EXISTS payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    minimum_payout_amount INTEGER NOT NULL DEFAULT 100000,
    payment_schedule TEXT NOT NULL DEFAULT 'MANUAL' CHECK (payment_schedule IN ('MANUAL', 'WEEKLY_FRIDAY', 'BIWEEKLY', 'MONTHLY')),
    allow_partial_payment BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO payment_settings (
    minimum_payout_amount,
    payment_schedule,
    allow_partial_payment
) VALUES (
    100000, -- Rp 100.000 minimum threshold
    'MANUAL',
    true
) ON CONFLICT DO NOTHING;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_settings_updated_at ON payment_settings(updated_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admin can read payment settings"
    ON payment_settings
    FOR SELECT
    USING (
        auth.jwt() ->> 'email' IN (
            SELECT email FROM profiles WHERE role = 'ADMIN'
        )
    );

CREATE POLICY "Admin can update payment settings"
    ON payment_settings
    FOR UPDATE
    USING (
        auth.jwt() ->> 'email' IN (
            SELECT email FROM profiles WHERE role = 'ADMIN'
        )
    );

-- Grant permissions
GRANT SELECT, UPDATE ON payment_settings TO authenticated;

-- Add helpful comment
COMMENT ON TABLE payment_settings IS 'Global payment configuration for supplier payouts including threshold and schedule';
COMMENT ON COLUMN payment_settings.minimum_payout_amount IS 'Minimum amount (in IDR) before supplier can request payout';
COMMENT ON COLUMN payment_settings.payment_schedule IS 'When admin should pay suppliers: MANUAL, WEEKLY_FRIDAY, BIWEEKLY, MONTHLY';
COMMENT ON COLUMN payment_settings.allow_partial_payment IS 'Whether suppliers can request payout below threshold (subject to admin approval)';
