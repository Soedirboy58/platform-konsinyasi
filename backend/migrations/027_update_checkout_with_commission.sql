-- ========================================
-- Migration: Update Checkout to Calculate Commission
-- ========================================
-- Description: Update process_anonymous_checkout to calculate and store
--              commission per item. Customer pays full price, platform
--              deducts 10% commission, supplier gets 90%.
-- Execute: After migration 026
-- ========================================

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
    v_quantity INTEGER;
    v_price DECIMAL(10,2);
    v_subtotal DECIMAL(15,2);
    v_commission_rate DECIMAL(5,2);
    v_commission_amount DECIMAL(15,2);
    v_supplier_revenue DECIMAL(15,2);
    v_qris_code TEXT;
    v_qris_image_url TEXT;
BEGIN
    -- Get location
    SELECT l.id, l.qris_code, l.qris_image_url 
    INTO v_location_id, v_qris_code, v_qris_image_url
    FROM locations l
    WHERE l.qr_code = p_location_slug 
      AND l.is_active = TRUE;
    
    IF v_location_id IS NULL THEN
        RAISE EXCEPTION 'Location not found or inactive';
    END IF;
    
    -- Get platform commission rate (default 10%)
    SELECT COALESCE(value::DECIMAL, 10.00) INTO v_commission_rate
    FROM platform_settings
    WHERE key = 'commission_rate';
    
    -- Generate transaction code
    v_transaction_code := 'KNT-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');
    
    -- Calculate total (customer pays full price)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_price := (v_item->>'price')::DECIMAL(10,2);
        v_total_amount := v_total_amount + (v_quantity * v_price);
    END LOOP;
    
    -- Create transaction
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
    
    -- Insert items with commission calculation
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_price := (v_item->>'price')::DECIMAL(10,2);
        v_subtotal := v_quantity * v_price;
        
        -- Calculate commission (platform takes 10%, supplier gets 90%)
        v_commission_amount := ROUND(v_subtotal * (v_commission_rate / 100), 2);
        v_supplier_revenue := v_subtotal - v_commission_amount;
        
        -- Insert item with commission data
        INSERT INTO sales_transaction_items (
            transaction_id, 
            product_id, 
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
            v_quantity, 
            v_price, 
            v_subtotal,
            v_commission_rate,
            v_commission_amount,
            v_supplier_revenue
        );
        
        -- Decrease inventory
        UPDATE inventory_levels 
        SET quantity = quantity - v_quantity,
            updated_at = NOW()
        WHERE product_id = v_product_id 
          AND location_id = v_location_id;
    END LOOP;
    
    -- Return success with QRIS info
    RETURN QUERY SELECT 
        v_transaction_id,
        v_transaction_code,
        v_total_amount,
        v_qris_code,
        v_qris_image_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anonymous
GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB) TO anon;

-- ========================================
-- VERIFICATION
-- ========================================

-- Check function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_name = 'process_anonymous_checkout';

-- ========================================
-- EXAMPLE CALCULATION
-- ========================================

-- Example: Customer buys 1 item at Rp 5,000
-- - Customer pays: Rp 5,000 (full price)
-- - Platform commission (10%): Rp 500
-- - Supplier receives: Rp 4,500 (90%)

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 027: Update checkout with commission calculation - SUCCESS!' AS status;
