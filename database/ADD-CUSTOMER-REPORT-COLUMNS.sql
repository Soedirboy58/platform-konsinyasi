-- =====================================================
-- EXTEND shipment_returns for Customer Reports
-- =====================================================
-- Instead of creating new table, extend existing one
-- This keeps everything in one place: admin + customer reports
-- =====================================================

-- Add new columns for customer-initiated returns
ALTER TABLE shipment_returns
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'ADMIN',
-- Values: 'ADMIN' (manual admin), 'CUSTOMER' (from catalog report)

ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
-- Optional: For anonymous customer reports

ADD COLUMN IF NOT EXISTS customer_contact VARCHAR(255),
-- Email or phone for follow-up

ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'MEDIUM';
-- Values: 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'

-- Add comment for documentation
COMMENT ON COLUMN shipment_returns.source IS 'Source of return request: ADMIN (manual) or CUSTOMER (catalog report)';
COMMENT ON COLUMN shipment_returns.customer_name IS 'Name of customer who reported (for CUSTOMER source, optional/anonymous)';
COMMENT ON COLUMN shipment_returns.customer_contact IS 'Contact info of customer (email/phone, optional)';
COMMENT ON COLUMN shipment_returns.severity IS 'Severity level of the issue: LOW, MEDIUM, HIGH, CRITICAL';

-- Create index for filtering by source
CREATE INDEX IF NOT EXISTS idx_shipment_returns_source 
ON shipment_returns(source);

-- Backfill existing data as ADMIN source
UPDATE shipment_returns 
SET source = 'ADMIN'
WHERE source IS NULL;

-- Verify changes
SELECT 
    '✅ Columns Added' as status,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'shipment_returns'
AND column_name IN ('source', 'customer_name', 'customer_contact', 'severity')
ORDER BY ordinal_position;

-- Show sample data structure
SELECT 
    '📊 Sample Data Structure' as info,
    id,
    source,
    customer_name,
    severity,
    status,
    reason
FROM shipment_returns
LIMIT 3;

-- =====================================================
-- EXPECTED RESULT
-- =====================================================
-- ✅ 4 new columns added: source, customer_name, customer_contact, severity
-- ✅ All existing data marked as source='ADMIN'
-- ✅ Ready to accept customer reports
-- =====================================================
