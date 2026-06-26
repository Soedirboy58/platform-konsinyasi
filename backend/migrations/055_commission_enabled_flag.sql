-- Migration 055: Integrate commission_enabled flag into checkout & lost-to-sold RPCs
-- Purpose:
--   1) Respect platform_settings.commission_enabled in process_anonymous_checkout()
--   2) Respect platform_settings.commission_enabled in convert_lost_to_sold()
--   3) Ensure default row for commission_enabled exists
--
-- Behavior:
--   - commission_enabled = 'true'  (default) → potong komisi sesuai commission_rate
--   - commission_enabled = 'false'           → commission_rate dipaksa 0, supplier dapat 100%
--
-- Idempotent: aman dijalankan berulang.

-- =========================================
-- 1. Default platform_settings (idempotent)
-- =========================================
INSERT INTO platform_settings (key, value, description) VALUES
  ('commission_enabled', 'true', 'Aktifkan potongan komisi platform pada setiap transaksi')
ON CONFLICT (key) DO NOTHING;

-- =========================================
-- 2. Recreate process_anonymous_checkout (signature sama dgn migration 053)
-- =========================================
DROP FUNCTION IF EXISTS process_anonymous_checkout(TEXT, JSONB, TEXT);

CREATE FUNCTION process_anonymous_checkout(
    p_location_slug  TEXT,
    p_items          JSONB,
    p_payment_method TEXT DEFAULT 'QRIS'
)
RETURNS TABLE (
    transaction_id   UUID,
    transaction_code TEXT,
    total_amount     DECIMAL(15,2),
    qris_code        TEXT,
    qris_image_url   TEXT
) AS $$
DECLARE
    v_location_id        UUID;
    v_transaction_id     UUID;
    v_transaction_code   TEXT;
    v_subtotal           DECIMAL(15,2) := 0;
    v_total_amount       DECIMAL(15,2) := 0;
    v_item               JSONB;
    v_product_id         UUID;
    v_supplier_id        UUID;
    v_quantity           INTEGER;
    v_price              DECIMAL(10,2);
    v_line_subtotal      DECIMAL(15,2);
    v_commission_enabled BOOLEAN := TRUE;
    v_commission_rate    DECIMAL(5,2);
    v_commission_amount  DECIMAL(15,2);
    v_supplier_revenue   DECIMAL(15,2);
    v_qris_code          TEXT;
    v_qris_image_url     TEXT;

    -- Fee config
    v_fee_enabled        BOOLEAN := FALSE;
    v_qr_fee_rate        DECIMAL(5,3) := 0;
    v_qr_fee_bearer      TEXT := 'NONE';
    v_qr_fee_total       DECIMAL(15,2) := 0;
    v_line_fee           DECIMAL(15,2);
BEGIN
    SELECT l.id, l.qris_code, l.qris_image_url
      INTO v_location_id, v_qris_code, v_qris_image_url
      FROM locations l
     WHERE l.qr_code = p_location_slug
       AND l.is_active = TRUE;

    IF v_location_id IS NULL THEN
        RAISE EXCEPTION 'Location not found or inactive';
    END IF;

    -- Load commission enabled flag
    SELECT (value = 'true') INTO v_commission_enabled
      FROM platform_settings WHERE key = 'commission_enabled';
    v_commission_enabled := COALESCE(v_commission_enabled, TRUE);

    -- Load commission rate
    SELECT COALESCE(value::DECIMAL, 10.00) INTO v_commission_rate
      FROM platform_settings WHERE key = 'commission_rate';
    IF v_commission_rate IS NULL THEN v_commission_rate := 10.00; END IF;

    -- Apply enable flag: kalau dimatikan, paksa rate 0
    IF NOT v_commission_enabled THEN
        v_commission_rate := 0;
    END IF;

    -- Load QR fee config
    SELECT (value = 'true') INTO v_fee_enabled
      FROM platform_settings WHERE key = 'qr_fee_enabled';
    v_fee_enabled := COALESCE(v_fee_enabled, FALSE);

    SELECT COALESCE(value::DECIMAL, 0) INTO v_qr_fee_rate
      FROM platform_settings WHERE key = 'qr_fee_rate';
    v_qr_fee_rate := COALESCE(v_qr_fee_rate, 0);

    SELECT COALESCE(value, 'CUSTOMER') INTO v_qr_fee_bearer
      FROM platform_settings WHERE key = 'qr_fee_bearer';
    v_qr_fee_bearer := COALESCE(v_qr_fee_bearer, 'CUSTOMER');

    -- Disable fee for CASH or when feature off
    IF NOT v_fee_enabled OR UPPER(COALESCE(p_payment_method,'')) = 'CASH' THEN
        v_qr_fee_rate   := 0;
        v_qr_fee_bearer := 'NONE';
    END IF;

    -- Compute subtotal
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_price    := (v_item->>'price')::DECIMAL(10,2);
        v_subtotal := v_subtotal + (v_quantity * v_price);
    END LOOP;

    v_qr_fee_total := ROUND(v_subtotal * (v_qr_fee_rate / 100), 2);

    -- total_amount logic:
    --   CUSTOMER → customer pays subtotal + fee
    --   SUPPLIER / PLATFORM / NONE → customer pays subtotal only (fee absorbed internally)
    IF v_qr_fee_bearer = 'CUSTOMER' THEN
        v_total_amount := v_subtotal + v_qr_fee_total;
    ELSE
        v_total_amount := v_subtotal;
    END IF;

    v_transaction_code := 'KNT-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');

    INSERT INTO sales_transactions (
        location_id, transaction_code, total_amount,
        payment_method, status,
        qr_fee_rate, qr_fee_amount, qr_fee_bearer
    ) VALUES (
        v_location_id, v_transaction_code, v_total_amount,
        UPPER(COALESCE(p_payment_method,'QRIS')), 'PENDING',
        v_qr_fee_rate, v_qr_fee_total, v_qr_fee_bearer
    )
    RETURNING id INTO v_transaction_id;

    -- Insert items with bearer-aware revenue split
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_product_id   := (v_item->>'product_id')::UUID;
        v_quantity     := (v_item->>'quantity')::INTEGER;
        v_price        := (v_item->>'price')::DECIMAL(10,2);
        v_line_subtotal:= v_quantity * v_price;

        SELECT p.supplier_id INTO v_supplier_id
          FROM products p WHERE p.id = v_product_id;

        v_commission_amount := ROUND(v_line_subtotal * (v_commission_rate / 100), 2);

        -- Per-line fee proportional to line_subtotal
        v_line_fee := CASE WHEN v_subtotal > 0
                        THEN ROUND(v_qr_fee_total * (v_line_subtotal / v_subtotal), 2)
                        ELSE 0 END;

        -- Apply bearer adjustment to supplier_revenue / commission
        IF v_qr_fee_bearer = 'SUPPLIER' THEN
            v_supplier_revenue := v_line_subtotal - v_commission_amount - v_line_fee;
        ELSIF v_qr_fee_bearer = 'PLATFORM' THEN
            v_supplier_revenue  := v_line_subtotal - v_commission_amount;
            v_commission_amount := v_commission_amount - v_line_fee;
        ELSE
            -- CUSTOMER or NONE: no impact on internal split
            v_supplier_revenue := v_line_subtotal - v_commission_amount;
        END IF;

        INSERT INTO sales_transaction_items (
            transaction_id, product_id, supplier_id,
            quantity, price, subtotal,
            commission_rate, commission_amount, supplier_revenue
        ) VALUES (
            v_transaction_id, v_product_id, v_supplier_id,
            v_quantity, v_price, v_line_subtotal,
            v_commission_rate, v_commission_amount, v_supplier_revenue
        );

        UPDATE inventory_levels
           SET quantity = quantity - v_quantity, updated_at = NOW()
         WHERE product_id = v_product_id AND location_id = v_location_id;
    END LOOP;

    RETURN QUERY SELECT
        v_transaction_id, v_transaction_code, v_total_amount,
        v_qris_code, v_qris_image_url;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Checkout gagal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB, TEXT) TO authenticated;

-- =========================================
-- 3. Recreate convert_lost_to_sold (signature sama dgn migration 054)
-- =========================================
DROP FUNCTION IF EXISTS convert_lost_to_sold(UUID, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION convert_lost_to_sold(
  p_transaction_id UUID,
  p_payment_method TEXT,   -- 'CASH' | 'QRIS'
  p_notes          TEXT,
  p_admin_id       UUID
)
RETURNS TABLE(
  success      BOOLEAN,
  message      TEXT,
  total_amount DECIMAL(15,2)
) AS $$
DECLARE
  v_status              TEXT;
  v_subtotal            DECIMAL(15,2);
  v_commission_enabled  BOOLEAN := TRUE;
  v_commission_rate     DECIMAL(5,2);
BEGIN
  SELECT status, total_amount INTO v_status, v_subtotal
    FROM sales_transactions
   WHERE id = p_transaction_id
   FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Transaksi tidak ditemukan', 0::DECIMAL(15,2);
    RETURN;
  END IF;

  IF v_status <> 'HILANG' THEN
    RETURN QUERY SELECT FALSE, 'Transaksi bukan berstatus HILANG', 0::DECIMAL(15,2);
    RETURN;
  END IF;

  IF UPPER(COALESCE(p_payment_method,'')) NOT IN ('CASH','QRIS') THEN
    RETURN QUERY SELECT FALSE, 'Metode pembayaran harus CASH atau QRIS', 0::DECIMAL(15,2);
    RETURN;
  END IF;

  SELECT (value = 'true') INTO v_commission_enabled
    FROM platform_settings WHERE key = 'commission_enabled';
  v_commission_enabled := COALESCE(v_commission_enabled, TRUE);

  SELECT COALESCE(value::DECIMAL, 10.00) INTO v_commission_rate
    FROM platform_settings WHERE key = 'commission_rate';
  v_commission_rate := COALESCE(v_commission_rate, 10.00);

  IF NOT v_commission_enabled THEN
    v_commission_rate := 0;
  END IF;

  -- Recompute commission & supplier_revenue per item (normal split, no QR fee)
  UPDATE sales_transaction_items
     SET commission_rate   = v_commission_rate,
         commission_amount = ROUND(subtotal * (v_commission_rate / 100), 2),
         supplier_revenue  = subtotal - ROUND(subtotal * (v_commission_rate / 100), 2)
   WHERE transaction_id = p_transaction_id;

  UPDATE sales_transactions
     SET status            = 'COMPLETED',
         payment_method    = UPPER(p_payment_method),
         paid_at           = NOW(),
         lost_resolution   = 'SOLD',
         lost_converted_by = p_admin_id,
         lost_converted_at = NOW(),
         lost_notes        = COALESCE(p_notes, lost_notes),
         updated_at        = NOW()
   WHERE id = p_transaction_id;

  RETURN QUERY SELECT TRUE, 'Transaksi HILANG dikonversi menjadi TERJUAL', v_subtotal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION convert_lost_to_sold(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION convert_lost_to_sold(UUID, TEXT, TEXT, UUID) TO service_role;

SELECT 'Migration 055: commission_enabled flag integrated - SUCCESS' AS status;
