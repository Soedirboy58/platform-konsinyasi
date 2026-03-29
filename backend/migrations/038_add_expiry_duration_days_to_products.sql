-- ============================================================
-- Migration 038: Add expiry_duration_days to products table
-- Jalankan di Supabase SQL Editor (idempotent - aman dijalankan ulang)
-- ============================================================

-- Tambah kolom expiry_duration_days jika belum ada
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS expiry_duration_days INTEGER DEFAULT 30;

-- Verifikasi
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'expiry_duration_days';
