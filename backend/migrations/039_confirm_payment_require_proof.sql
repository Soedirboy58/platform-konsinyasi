-- ============================================================
-- Migration 039: Update confirm_payment_with_method
-- - Tambah parameter p_proof_url untuk bukti bayar customer
-- - Set paid_at saat konfirmasi
-- - Tambah storage policy untuk upload anon
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Drop old signature (2 params)
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
-- Storage: izinkan anon upload bukti bayar customer
-- Bucket 'payment-proofs' sudah ada, tambah policy untuk anon
-- ============================================================

-- Drop existing anon policy if any (safe to re-run)
DROP POLICY IF EXISTS "Anon can upload customer payment proofs" ON storage.objects;

CREATE POLICY "Anon can upload customer payment proofs"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = 'customer-proofs'
);

-- Anon can read back their own upload (for preview)
DROP POLICY IF EXISTS "Anon can read customer payment proofs" ON storage.objects;

CREATE POLICY "Anon can read customer payment proofs"
ON storage.objects FOR SELECT
TO anon
USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = 'customer-proofs'
);

SELECT 'Migration 039 COMPLETE: confirm_payment_with_method now accepts proof URL' AS status;
