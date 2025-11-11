-- ========================================
-- Migration 028: Add HPP (Cost of Goods Sold) to Products
-- ========================================
-- Description: Add hpp column to products table for profit calculation
--              Net Profit = (Selling Price - HPP) × Quantity - Commission
-- Execute: After migration 027
-- ========================================

-- Step 1: Add hpp column to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS hpp DECIMAL(10,2) DEFAULT 0.00 NOT NULL CHECK (hpp >= 0);

-- Add comment
COMMENT ON COLUMN products.hpp IS 'Harga Pokok Penjualan (Cost of Goods Sold) per unit';

-- Step 2: Backfill existing products with estimated HPP (70% of selling price as default)
UPDATE products
SET hpp = ROUND(price * 0.70, 2)
WHERE hpp = 0;

-- ========================================
-- VERIFICATION
-- ========================================

-- Check column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name = 'hpp';

-- Check sample data
SELECT 
    id,
    name,
    price AS selling_price,
    hpp,
    (price - hpp) AS gross_profit_per_unit,
    ROUND(((price - hpp) / NULLIF(price, 0) * 100), 2) AS profit_margin_percent
FROM products
WHERE status = 'APPROVED'
LIMIT 10;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 028: Add HPP column to products - SUCCESS!' AS status;
