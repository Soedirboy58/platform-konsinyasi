-- Migration: 008_add_reviewed_at_stock_movements.sql
-- Purpose: Add missing `reviewed_at` column to `stock_movements` to match frontend queries
-- Run this in Supabase SQL editor or via supabase CLI

BEGIN;

-- Add nullable reviewed_at column if it does not exist yet
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Add index to speed up queries filtering/sorting by reviewed_at
CREATE INDEX IF NOT EXISTS idx_stock_movements_reviewed_at ON public.stock_movements(reviewed_at);

COMMIT;

-- Verification helper
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'stock_movements'
  AND column_name = 'reviewed_at';

-- Status
SELECT 'SUCCESS: reviewed_at column added to stock_movements (if it was missing)' AS status;
