-- ========================================
-- MIGRATION 011: Kantin Checkout Function
-- ========================================
-- Description: Process anonymous checkout transactions
-- Dependencies: 002_wallet_system.sql, 003_shipment_system.sql
-- Purpose: Handle self-checkout with inventory update
-- ========================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS process_anonymous_checkout(TEXT, JSONB);

-- Create checkout function
CREATE OR REPLACE FUNCTION process_anonymous_checkout(
    p_location_slug TEXT,
    p_items JSONB -- [{"product_id": "uuid", "quantity": 2, "price": 5000}]
)
RETURNS TABLE (
    transaction_id UUID,
    transaction_code TEXT,
    total_amount DECIMAL(10,2),
    qris_code TEXT,
    qris_image_url TEXT,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_location_id UUID;
    v_location_qris TEXT;
    v_location_qris_image TEXT;
    v_transaction_id UUID;
    v_transaction_code TEXT;
    v_total_amount DECIMAL(10,2) := 0;
    v_item JSONB;
    v_product_id UUID;
    v_quantity INTEGER;
    v_price DECIMAL(10,2);
    v_available_stock INTEGER;
    v_subtotal DECIMAL(10,2);
BEGIN
    -- Get location and QRIS info
    SELECT 
        l.id, 
        l.qris_code, 
        l.qris_image_url 
    INTO 
        v_location_id, 
        v_location_qris, 
        v_location_qris_image
    FROM locations l
    WHERE l.qr_code = p_location_slug 
      AND l.type = 'OUTLET' 
      AND l.is_active = TRUE;
    
    IF v_location_id IS NULL THEN
        RETURN QUERY SELECT 
            NULL::UUID, 
            NULL::TEXT, 
            0::DECIMAL(10,2), 
            NULL::TEXT, 
            NULL::TEXT, 
            FALSE, 
            'Outlet tidak ditemukan';
        RETURN;
    END IF;
    
    -- Generate transaction code
    v_transaction_code := 'KNT-' || 
        to_char(NOW(), 'YYYYMMDD') || '-' || 
        LPAD(floor(random() * 999999)::text, 6, '0');
    
    -- Validate all items and calculate total
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_price := (v_item->>'price')::DECIMAL(10,2);
        v_subtotal := v_quantity * v_price;
        
        -- Check stock availability
        SELECT quantity INTO v_available_stock
        FROM inventory_levels
        WHERE product_id = v_product_id 
          AND location_id = v_location_id;
        
        IF v_available_stock IS NULL OR v_available_stock < v_quantity THEN
            RETURN QUERY SELECT 
                NULL::UUID, 
                NULL::TEXT, 
                0::DECIMAL(10,2), 
                NULL::TEXT, 
                NULL::TEXT, 
                FALSE, 
                'Stok tidak cukup untuk produk: ' || v_product_id::TEXT;
            RETURN;
        END IF;
        
        v_total_amount := v_total_amount + v_subtotal;
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
    
    -- Insert transaction items and update inventory
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_price := (v_item->>'price')::DECIMAL(10,2);
        v_subtotal := v_quantity * v_price;
        
        -- Insert item
        INSERT INTO sales_transaction_items (
            transaction_id, 
            product_id, 
            quantity, 
            unit_price, 
            subtotal
        )
        VALUES (
            v_transaction_id, 
            v_product_id, 
            v_quantity, 
            v_price, 
            v_subtotal
        );
        
        -- Decrease inventory
        UPDATE inventory_levels 
        SET quantity = quantity - v_quantity,
            last_updated = NOW()
        WHERE product_id = v_product_id 
          AND location_id = v_location_id;
    END LOOP;
    
    -- Return success with QRIS info
    RETURN QUERY SELECT 
        v_transaction_id,
        v_transaction_code,
        v_total_amount,
        v_location_qris,
        v_location_qris_image,
        TRUE,
        'Checkout berhasil';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB) TO anon;

-- ========================================
-- TEST QUERY
-- ========================================
/*
SELECT * FROM process_anonymous_checkout(
    'outlet-lobby-a',
    '[
        {"product_id": "123e4567-e89b-12d3-a456-426614174000", "quantity": 2, "price": 5000}
    ]'::jsonb
);
*/

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 011: Kantin Checkout Function - SUCCESS!' AS status;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================
/*
DROP FUNCTION IF EXISTS process_anonymous_checkout(TEXT, JSONB);
*/
