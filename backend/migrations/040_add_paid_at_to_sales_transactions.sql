-- ============================================================
-- Migration 040: Add paid_at column + fix confirm_payment function
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom paid_at (jika belum ada)
ALTER TABLE sales_transactions
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 2. Recreate confirm_payment_with_method (dengan paid_at)
DROP FUNCTION IF EXISTS confirm_payment_with_method(UUID, TEXT);
DROP FUNCTION IF EXISTS confirm_payment_with_method(UUID, TEXT, TEXT);

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
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = p_transaction_id;

    RETURN QUERY SELECT
        TRUE,
        format('Pembayaran %s berhasil dikonfirmasi', p_payment_method);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION confirm_payment_with_method(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION confirm_payment_with_method(UUID, TEXT, TEXT) TO authenticated;

-- Backward compat: 2-param wrapper
DROP FUNCTION IF EXISTS confirm_payment(UUID);
CREATE OR REPLACE FUNCTION confirm_payment(p_transaction_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
BEGIN
    RETURN QUERY SELECT * FROM confirm_payment_with_method(p_transaction_id, 'CASH', NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION confirm_payment(UUID) TO anon;
GRANT EXECUTE ON FUNCTION confirm_payment(UUID) TO authenticated;

SELECT 'Migration 040 COMPLETE: paid_at column added, confirm_payment_with_method fixed' AS status;
