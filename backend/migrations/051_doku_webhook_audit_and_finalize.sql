-- ========================================
-- Migration 051: DOKU Webhook Audit + Finalize RPC
-- ========================================
-- Purpose:
-- 1) Simpan jejak semua webhook DOKU yang masuk
-- 2) Finalisasi transaksi checkout DOKU secara idempotent di database
-- 3) Hindari downgrade transaksi COMPLETED karena retry/failed event
-- ========================================

CREATE TABLE IF NOT EXISTS doku_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code TEXT,
  doku_transaction_id TEXT,
  doku_status TEXT NOT NULL,
  payment_method TEXT,
  signature_header TEXT,
  request_id TEXT,
  request_timestamp TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_doku_webhook_events_transaction_code
  ON doku_webhook_events(transaction_code);

CREATE INDEX IF NOT EXISTS idx_doku_webhook_events_created_at
  ON doku_webhook_events(created_at DESC);

DROP FUNCTION IF EXISTS process_doku_checkout_notification(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB);

CREATE OR REPLACE FUNCTION process_doku_checkout_notification(
  p_transaction_code TEXT,
  p_doku_status TEXT,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_reference TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_headers JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  final_status TEXT,
  event_id UUID
) AS $$
DECLARE
  v_event_id UUID;
  v_normalized_status TEXT;
  v_transaction_id UUID;
  v_current_status TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_payment_reference TEXT;
BEGIN
  v_normalized_status := UPPER(TRIM(COALESCE(p_doku_status, '')));
  v_payment_reference := COALESCE(NULLIF(TRIM(p_payment_reference), ''), p_transaction_code);

  INSERT INTO doku_webhook_events (
    transaction_code,
    doku_transaction_id,
    doku_status,
    payment_method,
    signature_header,
    request_id,
    request_timestamp,
    payload,
    headers
  ) VALUES (
    NULLIF(TRIM(p_transaction_code), ''),
    NULLIF(TRIM(COALESCE(p_payload->'transaction'->>'id', p_payload->>'transaction_id', '')), ''),
    v_normalized_status,
    NULLIF(TRIM(p_payment_method), ''),
    NULLIF(TRIM(COALESCE(p_headers->>'signature', '')), ''),
    NULLIF(TRIM(COALESCE(p_headers->>'request-id', '')), ''),
    NULLIF(TRIM(COALESCE(p_headers->>'request-timestamp', '')), ''),
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_headers, '{}'::jsonb)
  ) RETURNING id INTO v_event_id;

  IF COALESCE(TRIM(p_transaction_code), '') = '' THEN
    UPDATE doku_webhook_events
    SET processed = TRUE,
        processing_result = 'Ignored: empty transaction_code',
        processed_at = v_now
    WHERE id = v_event_id;

    RETURN QUERY SELECT FALSE, 'Transaction code kosong', NULL::TEXT, v_event_id;
    RETURN;
  END IF;

  SELECT st.id, st.status
  INTO v_transaction_id, v_current_status
  FROM sales_transactions st
  WHERE st.transaction_code = p_transaction_code
  FOR UPDATE;

  IF v_transaction_id IS NULL THEN
    UPDATE doku_webhook_events
    SET processed = TRUE,
        processing_result = 'Ignored: transaction not found',
        processed_at = v_now
    WHERE id = v_event_id;

    RETURN QUERY SELECT TRUE, 'Transaksi tidak ditemukan, event dicatat', NULL::TEXT, v_event_id;
    RETURN;
  END IF;

  IF v_normalized_status IN ('SUCCESS', 'PAID', 'SETTLEMENT', 'COMPLETED', 'CAPTURED') THEN
    IF v_current_status <> 'COMPLETED' THEN
      UPDATE sales_transactions
      SET status = 'COMPLETED',
          payment_provider = 'DOKU',
          payment_method = COALESCE(NULLIF(TRIM(p_payment_method), ''), payment_method, 'DOKU'),
          payment_reference = COALESCE(v_payment_reference, payment_reference, transaction_code),
          payment_paid_at = COALESCE(payment_paid_at, v_now),
          paid_at = COALESCE(paid_at, v_now),
          updated_at = v_now
      WHERE id = v_transaction_id;

      v_current_status := 'COMPLETED';
    END IF;

    UPDATE doku_webhook_events
    SET processed = TRUE,
        processing_result = 'Processed: marked COMPLETED',
        processed_at = v_now
    WHERE id = v_event_id;

    RETURN QUERY SELECT TRUE, 'Pembayaran DOKU diproses sebagai COMPLETED', v_current_status, v_event_id;
    RETURN;
  END IF;

  IF v_normalized_status = 'FAILED' THEN
    UPDATE doku_webhook_events
    SET processed = TRUE,
        processing_result = 'Ignored: FAILED is retryable for Checkout',
        processed_at = v_now
    WHERE id = v_event_id;

    RETURN QUERY SELECT TRUE, 'FAILED diabaikan agar customer bisa retry metode lain', v_current_status, v_event_id;
    RETURN;
  END IF;

  IF v_normalized_status IN ('EXPIRED', 'CANCELLED', 'VOIDED', 'DENIED') THEN
    IF v_current_status = 'COMPLETED' THEN
      UPDATE doku_webhook_events
      SET processed = TRUE,
          processing_result = 'Ignored: transaction already COMPLETED',
          processed_at = v_now
      WHERE id = v_event_id;

      RETURN QUERY SELECT TRUE, 'Event cancel diabaikan karena transaksi sudah COMPLETED', v_current_status, v_event_id;
      RETURN;
    END IF;

    IF v_current_status <> 'CANCELLED' THEN
      UPDATE sales_transactions
      SET status = 'CANCELLED',
          payment_provider = 'DOKU',
          updated_at = v_now
      WHERE id = v_transaction_id;

      v_current_status := 'CANCELLED';
    END IF;

    UPDATE doku_webhook_events
    SET processed = TRUE,
        processing_result = 'Processed: marked CANCELLED',
        processed_at = v_now
    WHERE id = v_event_id;

    RETURN QUERY SELECT TRUE, 'Pembayaran DOKU diproses sebagai CANCELLED', v_current_status, v_event_id;
    RETURN;
  END IF;

  UPDATE doku_webhook_events
  SET processed = TRUE,
      processing_result = 'Ignored: unsupported status ' || v_normalized_status,
      processed_at = v_now
  WHERE id = v_event_id;

  RETURN QUERY SELECT TRUE, 'Status webhook diabaikan', v_current_status, v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_doku_checkout_notification(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB) TO service_role;

SELECT 'Migration 051 COMPLETE: DOKU webhook audit and finalize RPC created' AS status;
