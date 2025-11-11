-- ========================================
-- MIGRATION 009: Kantin Checkout Schema
-- ========================================
-- Description: Add QRIS payment fields to locations table
-- Dependencies: 001_initial_schema.sql
-- Purpose: Enable static QRIS for anonymous checkout
-- ========================================

-- Add QRIS fields to locations table
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS qris_code TEXT,
ADD COLUMN IF NOT EXISTS qris_image_url TEXT;

COMMENT ON COLUMN locations.qris_code IS 'Static QRIS code string for payment';
COMMENT ON COLUMN locations.qris_image_url IS 'URL to QRIS image (from storage bucket)';

-- Verify columns added
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'locations' 
  AND column_name IN ('qris_code', 'qris_image_url');

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 009: Kantin Checkout Schema - SUCCESS!' AS status;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================
/*
ALTER TABLE locations DROP COLUMN IF EXISTS qris_code;
ALTER TABLE locations DROP COLUMN IF EXISTS qris_image_url;
*/
