-- ========================================
-- FIX: Drop and recreate return functions
-- ========================================
-- Error: record "new" has no field "stock_movement_id"
-- Kemungkinan ada function lama yang masih referensi field yang tidak ada
-- ========================================

-- Drop existing functions
DROP FUNCTION IF EXISTS approve_return_request(UUID, TEXT);
DROP FUNCTION IF EXISTS reject_return_request(UUID, TEXT);
DROP FUNCTION IF EXISTS confirm_return_pickup(UUID);

-- Recreate Function 1: Supplier approve return request
CREATE OR REPLACE FUNCTION approve_return_request(
    p_return_id UUID,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
    v_supplier_id UUID;
BEGIN
    -- Get return info (only select needed fields)
    SELECT 
        id,
        supplier_id,
        status,
        product_id,
        quantity,
        location_id
    INTO v_return
    FROM shipment_returns
    WHERE id = p_return_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found';
    END IF;
    
    -- Check status
    IF v_return.status != 'PENDING' THEN
        RAISE EXCEPTION 'Return request already reviewed';
    END IF;
    
    -- Get current supplier
    SELECT id INTO v_supplier_id
    FROM suppliers
    WHERE profile_id = auth.uid();
    
    IF v_supplier_id IS NULL THEN
        RAISE EXCEPTION 'Supplier not found';
    END IF;
    
    -- Check ownership
    IF v_return.supplier_id != v_supplier_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    -- Update return status
    UPDATE shipment_returns
    SET 
        status = 'APPROVED',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_notes = p_review_notes,
        updated_at = NOW()
    WHERE id = p_return_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Return request approved',
        'return_id', p_return_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate Function 2: Supplier reject return request
CREATE OR REPLACE FUNCTION reject_return_request(
    p_return_id UUID,
    p_review_notes TEXT
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
    v_supplier_id UUID;
BEGIN
    -- Validate review notes
    IF p_review_notes IS NULL OR trim(p_review_notes) = '' THEN
        RAISE EXCEPTION 'Rejection reason is required';
    END IF;
    
    -- Get return info (only select needed fields)
    SELECT 
        id,
        supplier_id,
        status
    INTO v_return
    FROM shipment_returns
    WHERE id = p_return_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found';
    END IF;
    
    -- Check status
    IF v_return.status != 'PENDING' THEN
        RAISE EXCEPTION 'Return request already reviewed';
    END IF;
    
    -- Get current supplier
    SELECT id INTO v_supplier_id
    FROM suppliers
    WHERE profile_id = auth.uid();
    
    IF v_supplier_id IS NULL THEN
        RAISE EXCEPTION 'Supplier not found';
    END IF;
    
    -- Check ownership
    IF v_return.supplier_id != v_supplier_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    -- Update return status
    UPDATE shipment_returns
    SET 
        status = 'REJECTED',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_notes = p_review_notes,
        updated_at = NOW()
    WHERE id = p_return_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Return request rejected',
        'return_id', p_return_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate Function 3: Supplier confirm return received (product picked up)
CREATE OR REPLACE FUNCTION confirm_return_pickup(
    p_return_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
    v_supplier_id UUID;
BEGIN
    -- Get return info (only select needed fields)
    SELECT 
        id,
        supplier_id,
        status,
        product_id,
        quantity,
        location_id
    INTO v_return
    FROM shipment_returns
    WHERE id = p_return_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found';
    END IF;
    
    -- Check status
    IF v_return.status != 'APPROVED' THEN
        RAISE EXCEPTION 'Return must be APPROVED first';
    END IF;
    
    -- Get current supplier
    SELECT id INTO v_supplier_id
    FROM suppliers
    WHERE profile_id = auth.uid();
    
    IF v_supplier_id IS NULL THEN
        RAISE EXCEPTION 'Supplier not found';
    END IF;
    
    -- Check ownership
    IF v_return.supplier_id != v_supplier_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    -- Update return status
    UPDATE shipment_returns
    SET 
        status = 'COMPLETED',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_return_id;
    
    -- Reduce inventory at location
    IF v_return.location_id IS NOT NULL AND v_return.product_id IS NOT NULL THEN
        BEGIN
            UPDATE inventory_levels
            SET quantity = quantity - v_return.quantity
            WHERE product_id = v_return.product_id
            AND location_id = v_return.location_id
            AND quantity >= v_return.quantity;
            
            IF NOT FOUND THEN
                RAISE NOTICE 'Could not reduce inventory - insufficient stock';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Inventory reduction failed: %', SQLERRM;
        END;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Return completed - product picked up',
        'return_id', p_return_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION approve_return_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_return_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_return_pickup(UUID) TO authenticated;

SELECT '✅ Return functions fixed - no more stock_movement_id references!' AS status;
