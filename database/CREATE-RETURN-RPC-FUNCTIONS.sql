-- ========================================
-- RPC Functions for Shipment Returns
-- ========================================

-- Function 1: Supplier approve return request
CREATE OR REPLACE FUNCTION approve_return_request(
    p_return_id UUID,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
    v_supplier_id UUID;
BEGIN
    -- Get return info
    SELECT * INTO v_return
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
        review_notes = p_review_notes
    WHERE id = p_return_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Return request approved',
        'return_id', p_return_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Supplier reject return request
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
    
    -- Get return info
    SELECT * INTO v_return
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
        review_notes = p_review_notes
    WHERE id = p_return_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Return request rejected',
        'return_id', p_return_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Supplier confirm return received (product picked up)
CREATE OR REPLACE FUNCTION confirm_return_pickup(
    p_return_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
    v_supplier_id UUID;
BEGIN
    -- Get return info
    SELECT * INTO v_return
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
        completed_at = NOW()
    WHERE id = p_return_id;
    
    -- Reduce inventory at location
    IF v_return.location_id IS NOT NULL THEN
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

-- Function 4: Admin cancel return request
CREATE OR REPLACE FUNCTION cancel_return_request(
    p_return_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
BEGIN
    -- Check admin role
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'ADMIN'
    ) THEN
        RAISE EXCEPTION 'Unauthorized - admin only';
    END IF;
    
    -- Get return info
    SELECT * INTO v_return
    FROM shipment_returns
    WHERE id = p_return_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found';
    END IF;
    
    -- Can only cancel PENDING or APPROVED
    IF v_return.status NOT IN ('PENDING', 'APPROVED') THEN
        RAISE EXCEPTION 'Cannot cancel return with status %', v_return.status;
    END IF;
    
    -- Update return status
    UPDATE shipment_returns
    SET 
        status = 'CANCELLED',
        updated_at = NOW()
    WHERE id = p_return_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Return request cancelled',
        'return_id', p_return_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION approve_return_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_return_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_return_pickup(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_return_request(UUID) TO authenticated;

SELECT '✅ Return RPC functions created!' AS status;
