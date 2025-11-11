-- ========================================
-- MIGRATION 014: Add QR Code Image Column
-- ========================================
-- Description: Add column for outlet QR code frame image
-- Dependencies: 009_kantin_checkout_schema.sql
-- Purpose: Store printed QR code frame for outlet entrance
-- ========================================

-- Add QR code image URL column
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS qr_code_image_url TEXT;

COMMENT ON COLUMN locations.qr_code_image_url IS 'URL to QR code frame image (printed at outlet entrance)';

-- Verify column added
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'locations' 
  AND column_name = 'qr_code_image_url';

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 014: QR Code Image Column - SUCCESS!' AS status;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================
/*
ALTER TABLE locations DROP COLUMN IF EXISTS qr_code_image_url;
*/
