-- =====================================================
-- ADD proof_photos column to shipment_returns
-- =====================================================
-- This column stores array of photo URLs uploaded by customer
-- =====================================================

-- Add proof_photos column
ALTER TABLE shipment_returns
ADD COLUMN IF NOT EXISTS proof_photos TEXT[];

-- Add comment
COMMENT ON COLUMN shipment_returns.proof_photos IS 'Array of photo URLs for customer report evidence (max 3 photos)';

-- Verify column added
SELECT 
    '✅ Column Added' as status,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'shipment_returns'
AND column_name = 'proof_photos';

-- =====================================================
-- USAGE
-- =====================================================
-- Run this in Supabase SQL Editor to add proof_photos column
-- This allows customer reports to include photo evidence
-- =====================================================
