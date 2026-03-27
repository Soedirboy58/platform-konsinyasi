-- ========================================
-- Migration 036: Add Payment Gateway Columns
-- ========================================
-- Purpose: Tambah kolom untuk integrasi Xendit Dynamic QRIS
-- Kolom ini menyimpan data dari Xendit per transaksi
-- ========================================

ALTER TABLE sales_transactions
  ADD COLUMN IF NOT EXISTS payment_provider     TEXT          DEFAULT NULL,
  -- Nilai: 'XENDIT', 'MIDTRANS', 'MANUAL' (NULL = belum diproses gateway)

  ADD COLUMN IF NOT EXISTS payment_reference    TEXT          DEFAULT NULL,
  -- Xendit QR Code ID, contoh: 'qr_abc123...'

  ADD COLUMN IF NOT EXISTS payment_qr_string    TEXT          DEFAULT NULL,
  -- Raw QRIS string — dipakai oleh qrcode.react untuk generate gambar QR di frontend

  ADD COLUMN IF NOT EXISTS payment_expired_at   TIMESTAMPTZ   DEFAULT NULL,
  -- Kapan QR Xendit expired (default: +15 menit dari created_at transaksi)

  ADD COLUMN IF NOT EXISTS payment_paid_at      TIMESTAMPTZ   DEFAULT NULL;
  -- Timestamp pembayaran diterima dari webhook Xendit

-- Index cepat untuk lookup webhook berdasarkan reference_id (= transaction_code)
CREATE INDEX IF NOT EXISTS idx_sales_transactions_payment_reference
  ON sales_transactions(payment_reference)
  WHERE payment_reference IS NOT NULL;

-- ========================================
-- VERIFIKASI: Cek kolom berhasil ditambah
-- ========================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sales_transactions'
  AND column_name IN (
    'payment_provider',
    'payment_reference', 
    'payment_qr_string',
    'payment_expired_at',
    'payment_paid_at'
  )
ORDER BY column_name;

SELECT 'Migration 036: Add payment gateway columns - DONE!' AS status;
