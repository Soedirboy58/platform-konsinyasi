-- Migration 053: Dynamic QR Fee with configurable bearer
-- Purpose:
--   1) Add qr_fee snapshot columns to sales_transactions
--   2) Add platform_settings for qr_fee rate, enable flag, and bearer (CUSTOMER/SUPPLIER/PLATFORM)
--   3) Update process_anonymous_checkout to accept payment method and apply fee per bearer
--
-- Historical safety: all existing rows default qr_fee_amount = 0 and qr_fee_bearer = 'NONE'.

-- =========================================
-- 1. Schema additions (idempotent)
-- =========================================
ALTER TABLE sales_transactions
  ADD COLUMN IF NOT EXISTS qr_fee_rate    DECIMAL(5,3)   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qr_fee_amount  DECIMAL(15,2)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qr_fee_bearer  TEXT           NOT NULL DEFAULT 'NONE'
    CHECK (qr_fee_bearer IN ('NONE','CUSTOMER','SUPPLIER','PLATFORM'));

COMMENT ON COLUMN sales_transactions.qr_fee_rate   IS 'Snapshot QR/gateway fee rate in percent (e.g., 0.7 = 0.7%)';
COMMENT ON COLUMN sales_transactions.qr_fee_amount IS 'Computed QR fee in Rupiah for this transaction';
COMMENT ON COLUMN sales_transactions.qr_fee_bearer IS 'Who bears the QR fee at the time of transaction';

-- =========================================
-- 2. Default platform_settings (idempotent)
-- =========================================
INSERT INTO platform_settings (key, value, description) VALUES
  ('qr_fee_enabled', 'false',    'Aktifkan fee QR dinamis pada checkout'),
  ('qr_fee_rate',    '0.7',      'Persentase fee gateway QR (mis. 0.7 = 0.7%)'),
  ('qr_fee_bearer',  'CUSTOMER', 'Penanggung fee QR: CUSTOMER | SUPPLIER | PLATFORM')
ON CONFLICT (key) DO NOTHING;

-- =========================================
-- 3. Recreate process_anonymous_checkout
-- =========================================
DROP FUNCTION IF EXISTS process_anonymous_checkout(TEXT, JSONB);
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

    -- Load commission rate
    SELECT COALESCE(value::DECIMAL, 10.00) INTO v_commission_rate
      FROM platform_settings WHERE key = 'commission_rate';
    IF v_commission_rate IS NULL THEN v_commission_rate := 10.00; END IF;

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

SELECT 'Migration 053: dynamic qr fee with configurable bearer - SUCCESS' AS status;
