-- ========================================
-- Migration: Add Product Curation Fields
-- ========================================
-- Description: Add category, tags, and notes fields to products table
--              to help admin curate and categorize products better
-- Execute: After migration 024
-- ========================================

-- Add new columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category) WHERE category IS NOT NULL;

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON COLUMN products.category IS 'Product category for admin curation (e.g., Snacks, Drinks, Food)';
COMMENT ON COLUMN products.tags IS 'Comma-separated tags for product attributes (e.g., halal, organic, spicy)';
COMMENT ON COLUMN products.notes IS 'Additional notes from supplier for admin review (allergens, certificates, etc)';

-- ========================================
-- VERIFICATION
-- ========================================

-- Check new columns exist
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('category', 'tags', 'notes')
ORDER BY ordinal_position;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 025: Add product curation fields - SUCCESS!' AS status;
