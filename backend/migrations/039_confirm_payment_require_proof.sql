-- ============================================================
-- Migration 039: Update confirm_payment_with_method
-- - Tambah kolom payment_proof_url ke sales_transactions
-- - Tambah parameter p_proof_url untuk bukti bayar customer
-- - Set paid_at saat konfirmasi
-- - Buat bucket customer-proofs (public) untuk anon upload
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom payment_proof_url ke sales_transactions (jika belum ada)
ALTER TABLE sales_transactions
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

-- 2. Drop old signature (2 params)
DROP FUNCTION IF EXISTS confirm_payment_with_method(UUID, TEXT);

-- Recreate with 3rd optional param: proof URL
CREATE OR REPLACE FUNCTION confirm_payment_with_method(
    p_transaction_id UUID,
    p_payment_method TEXT DEFAULT 'QRIS',
    p_proof_url TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transaction_status TEXT;
BEGIN
    SELECT status INTO v_transaction_status
    FROM sales_transactions
    WHERE id = p_transaction_id;

    IF v_transaction_status IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Transaksi tidak ditemukan';
        RETURN;
    END IF;

    IF v_transaction_status != 'PENDING' THEN
        RETURN QUERY SELECT FALSE, 'Transaksi sudah diproses';
        RETURN;
    END IF;

    UPDATE sales_transactions
    SET
        status = 'COMPLETED',
        payment_method = p_payment_method,
        payment_proof_url = COALESCE(p_proof_url, payment_proof_url),
        paid_at = NOW()
    WHERE id = p_transaction_id;

    RETURN QUERY SELECT
        TRUE,
        format('Pembayaran %s berhasil dikonfirmasi', p_payment_method);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION confirm_payment_with_method(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION confirm_payment_with_method(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 3. Storage: buat bucket customer-proofs (PUBLIC) untuk anon upload
-- ============================================================

-- Buat bucket customer-proofs sebagai PUBLIC agar anon bisa upload & baca
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-proofs',
  'customer-proofs',
  TRUE,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- Policy: anon bisa upload ke customer-proofs
DROP POLICY IF EXISTS "Anon can upload customer payment proofs" ON storage.objects;
CREATE POLICY "Anon can upload customer payment proofs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'customer-proofs');

-- Policy: siapapun bisa membaca (public bucket, tapi tambah policy eksplisit)
DROP POLICY IF EXISTS "Public can read customer proofs" ON storage.objects;
CREATE POLICY "Public can read customer proofs"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'customer-proofs');

SELECT 'Migration 039 COMPLETE: payment_proof_url column added, customer-proofs bucket created' AS status;
