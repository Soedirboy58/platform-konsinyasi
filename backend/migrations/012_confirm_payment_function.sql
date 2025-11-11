-- ========================================
-- MIGRATION 012: Confirm Payment Function
-- ========================================
-- Description: Mark transaction as completed after payment
-- Dependencies: 011_kantin_checkout_function.sql
-- Purpose: Customer confirms "Sudah Bayar"
-- ========================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS confirm_payment(UUID);

-- Create confirm payment function
CREATE OR REPLACE FUNCTION confirm_payment(
    p_transaction_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transaction_status TEXT;
BEGIN
    -- Check transaction exists and is pending
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
    
    -- Update transaction status to completed
    UPDATE sales_transactions
    SET status = 'COMPLETED',
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    RETURN QUERY SELECT TRUE, 'Pembayaran dikonfirmasi';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION confirm_payment(UUID) TO anon;

-- ========================================
-- TEST QUERY
-- ========================================
/*
SELECT * FROM confirm_payment('123e4567-e89b-12d3-a456-426614174000'::UUID);
*/

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 012: Confirm Payment Function - SUCCESS!' AS status;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================
/*
DROP FUNCTION IF EXISTS confirm_payment(UUID);
*/
