-- ========================================
-- Migration 047: Admin Manual Sales Control
-- ========================================
-- Purpose:
-- 1) Allow admin to manually set transaction status (COMPLETED/CANCELLED)
-- 2) Keep inventory consistent when status is changed manually
--
-- Notes:
-- - Checkout flow reduces stock when transaction is created (PENDING).
-- - Moving CANCELLED -> COMPLETED must reduce stock again.
-- - Moving PENDING/COMPLETED -> CANCELLED must restore stock.
-- ========================================

DROP FUNCTION IF EXISTS admin_adjust_sales_transaction(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION admin_adjust_sales_transaction(
  p_transaction_id UUID,
  p_target_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  previous_status TEXT,
  new_status TEXT,
  stock_adjusted_items INTEGER
) AS $$
DECLARE
  v_prev_status TEXT;
  v_location_id UUID;
  v_adjusted_items INTEGER := 0;
BEGIN
  IF p_target_status NOT IN ('COMPLETED', 'CANCELLED') THEN
    RETURN QUERY SELECT FALSE, 'Target status tidak valid', NULL::TEXT, NULL::TEXT, 0;
    RETURN;
  END IF;

  SELECT st.status, st.location_id
  INTO v_prev_status, v_location_id
  FROM sales_transactions st
  WHERE st.id = p_transaction_id
  FOR UPDATE;

  IF v_prev_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Transaksi tidak ditemukan', NULL::TEXT, NULL::TEXT, 0;
    RETURN;
  END IF;

  IF v_prev_status = p_target_status THEN
    RETURN QUERY SELECT TRUE, 'Status sudah sama, tidak ada perubahan', v_prev_status, p_target_status, 0;
    RETURN;
  END IF;

  IF p_target_status = 'CANCELLED' THEN
    -- Restore stock for PENDING/COMPLETED that are being cancelled.
    IF v_prev_status IN ('PENDING', 'COMPLETED') THEN
      UPDATE inventory_levels il
      SET
        quantity = il.quantity + sti.quantity,
        updated_at = NOW()
      FROM sales_transaction_items sti
      WHERE sti.transaction_id = p_transaction_id
        AND il.product_id = sti.product_id
        AND il.location_id = v_location_id;

      GET DIAGNOSTICS v_adjusted_items = ROW_COUNT;
    END IF;

    UPDATE sales_transactions
    SET
      status = 'CANCELLED',
      paid_at = NULL,
      updated_at = NOW()
    WHERE id = p_transaction_id;

    RETURN QUERY SELECT TRUE, 'Transaksi dibatalkan dan stok disesuaikan', v_prev_status, 'CANCELLED', v_adjusted_items;
    RETURN;
  END IF;

  -- p_target_status = COMPLETED
  -- If transaction was cancelled before, stock must be reduced again.
  IF v_prev_status = 'CANCELLED' THEN
    UPDATE inventory_levels il
    SET
      quantity = il.quantity - sti.quantity,
      updated_at = NOW()
    FROM sales_transaction_items sti
    WHERE sti.transaction_id = p_transaction_id
      AND il.product_id = sti.product_id
      AND il.location_id = v_location_id;

    GET DIAGNOSTICS v_adjusted_items = ROW_COUNT;
  END IF;

  UPDATE sales_transactions
  SET
    status = 'COMPLETED',
    payment_method = COALESCE(payment_method, 'QRIS'),
    paid_at = COALESCE(paid_at, NOW()),
    updated_at = NOW()
  WHERE id = p_transaction_id;

  RETURN QUERY SELECT TRUE, 'Transaksi ditandai sebagai terjual', v_prev_status, 'COMPLETED', v_adjusted_items;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION admin_adjust_sales_transaction(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_adjust_sales_transaction(UUID, TEXT, TEXT) TO service_role;

SELECT 'Migration 047 COMPLETE: admin_adjust_sales_transaction created' AS status;
