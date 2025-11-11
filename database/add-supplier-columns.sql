-- ================================================
-- ADD MISSING SUPPLIER COLUMNS
-- ================================================
-- Problem: Frontend expects address, contact_person, phone_number
-- Solution: Add these columns to suppliers table

-- ================================================
-- STEP 1: Add missing columns
-- ================================================

-- Add contact_person column
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS contact_person TEXT;

-- Add phone_number column
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add address column
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS address TEXT;

-- ================================================
-- STEP 2: Verify columns exist
-- ================================================

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'suppliers'
ORDER BY ordinal_position;

-- ================================================
-- SUCCESS
-- ================================================
SELECT 'SUCCESS: Supplier columns added!' AS status;
