-- Migration 049: Add supplier snapshot on sales_transaction_items
-- Purpose:
-- 1) Freeze supplier attribution per sold item at transaction time
-- 2) Prevent commission cards from changing when product ownership/data changes later

ALTER TABLE sales_transaction_items
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);

-- Backfill historical rows from current product ownership where snapshot is missing.
UPDATE sales_transaction_items sti
SET supplier_id = p.supplier_id
FROM products p
WHERE sti.supplier_id IS NULL
  AND sti.product_id = p.id;

CREATE INDEX IF NOT EXISTS idx_sales_items_supplier ON sales_transaction_items(supplier_id);

-- Recreate checkout function to store supplier snapshot for new transactions.
DROP FUNCTION IF EXISTS process_anonymous_checkout(TEXT, JSONB);

CREATE FUNCTION process_anonymous_checkout(
    p_location_slug TEXT,
    p_items JSONB
)
RETURNS TABLE (
    transaction_id UUID,
    transaction_code TEXT,
    total_amount DECIMAL(15,2),
    qris_code TEXT,
    qris_image_url TEXT
) AS $$
DECLARE
    v_location_id UUID;
    v_transaction_id UUID;
    v_transaction_code TEXT;
    v_total_amount DECIMAL(15,2) := 0;
    v_item JSONB;
    v_product_id UUID;
    v_supplier_id UUID;
    v_quantity INTEGER;
    v_price DECIMAL(10,2);
    v_subtotal DECIMAL(15,2);
    v_commission_rate DECIMAL(5,2);
    v_commission_amount DECIMAL(15,2);
    v_supplier_revenue DECIMAL(15,2);
    v_qris_code TEXT;
    v_qris_image_url TEXT;
BEGIN
    SELECT l.id, l.qris_code, l.qris_image_url 
    INTO v_location_id, v_qris_code, v_qris_image_url
    FROM locations l
    WHERE l.qr_code = p_location_slug 
      AND l.is_active = TRUE;

    IF v_location_id IS NULL THEN
        RAISE EXCEPTION 'Location not found or inactive';
    END IF;

    SELECT COALESCE(value::DECIMAL, 10.00) INTO v_commission_rate
    FROM platform_settings
    WHERE key = 'commission_rate';

    IF v_commission_rate IS NULL THEN
        v_commission_rate := 10.00;
    END IF;

    v_transaction_code := 'KNT-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_price := (v_item->>'price')::DECIMAL(10,2);
        v_total_amount := v_total_amount + (v_quantity * v_price);
    END LOOP;

    INSERT INTO sales_transactions (
        location_id,
        transaction_code,
        total_amount,
        payment_method,
        status
    )
    VALUES (
        v_location_id,
        v_transaction_code,
        v_total_amount,
        'QRIS',
        'PENDING'
    )
    RETURNING id INTO v_transaction_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_price := (v_item->>'price')::DECIMAL(10,2);
        v_subtotal := v_quantity * v_price;

        SELECT p.supplier_id INTO v_supplier_id
        FROM products p
        WHERE p.id = v_product_id;

        v_commission_amount := ROUND(v_subtotal * (v_commission_rate / 100), 2);
        v_supplier_revenue := v_subtotal - v_commission_amount;

        INSERT INTO sales_transaction_items (
            transaction_id,
            product_id,
            supplier_id,
            quantity,
            price,
            subtotal,
            commission_rate,
            commission_amount,
            supplier_revenue
        )
        VALUES (
            v_transaction_id,
            v_product_id,
            v_supplier_id,
            v_quantity,
            v_price,
            v_subtotal,
            v_commission_rate,
            v_commission_amount,
            v_supplier_revenue
        );

        UPDATE inventory_levels
        SET quantity = quantity - v_quantity,
            updated_at = NOW()
        WHERE product_id = v_product_id
          AND location_id = v_location_id;
    END LOOP;

    RETURN QUERY SELECT
        v_transaction_id,
        v_transaction_code,
        v_total_amount,
        v_qris_code,
        v_qris_image_url;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Checkout gagal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB) TO authenticated;

SELECT 'Migration 049: supplier snapshot on sales items - SUCCESS' AS status;
