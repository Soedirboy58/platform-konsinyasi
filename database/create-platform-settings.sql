-- ============================================
-- CREATE PLATFORM SETTINGS TABLE
-- Run di Supabase SQL Editor
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "platform_settings_public_read" ON platform_settings;
DROP POLICY IF EXISTS "platform_settings_admin_all" ON platform_settings;

-- Create platform_settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only public can read
CREATE POLICY "platform_settings_public_read" ON platform_settings
    FOR SELECT TO public
    USING (true);

CREATE POLICY "platform_settings_admin_all" ON platform_settings
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Insert default settings
INSERT INTO platform_settings (key, value, description) VALUES
  ('commission_rate', '30', 'Komisi platform dalam persen'),
  ('platform_name', 'Platform Konsinyasi', 'Nama platform'),
  ('min_stock_alert', '10', 'Minimum stok untuk alert')
ON CONFLICT (key) DO NOTHING;

-- Show current settings
SELECT key, value, description FROM platform_settings;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'PLATFORM SETTINGS TABLE READY!';
    RAISE NOTICE 'commission_rate: 30 percent';
    RAISE NOTICE 'You can now access /admin/settings';
END $$;

