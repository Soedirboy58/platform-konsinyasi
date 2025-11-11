-- ========================================
-- MIGRATION 008: Schema Updates
-- ========================================
-- Description: Add missing columns to existing tables
-- Dependencies: 001_initial_schema.sql
-- Changes: Add contact_person, phone_number, address to suppliers
-- Rollback: See bottom
-- ========================================

-- ================================================
-- ADD MISSING SUPPLIER COLUMNS
-- ================================================

-- Add contact_person column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN contact_person TEXT;
  END IF;
END $$;

-- Add phone_number column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN phone_number TEXT;
  END IF;
END $$;

-- Add address column (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suppliers' AND column_name = 'address'
  ) THEN
    ALTER TABLE suppliers ADD COLUMN address TEXT;
  END IF;
END $$;

-- ================================================
-- VERIFY COLUMNS EXIST
-- ================================================

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'suppliers'
  AND column_name IN ('contact_person', 'phone_number', 'address')
ORDER BY ordinal_position;

-- ================================================
-- SUCCESS
-- ================================================

SELECT 'Migration 008: Schema Updates - SUCCESS!' AS status;
SELECT 'Supplier table now has contact_person, phone_number, and address columns' AS note;

-- ================================================
-- ROLLBACK (if needed)
-- ================================================
/*
ALTER TABLE suppliers DROP COLUMN IF EXISTS contact_person;
ALTER TABLE suppliers DROP COLUMN IF EXISTS phone_number;
ALTER TABLE suppliers DROP COLUMN IF EXISTS address;
*/
