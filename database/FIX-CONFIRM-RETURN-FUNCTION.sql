-- ========================================
-- FIX: Supplier Retur Confirmation Function
-- ========================================
-- Error dari screenshot: column "entity_type" does not exist in activity_logs
-- Solution: Create/update function without activity_logs or with minimal columns
-- ========================================

-- STEP 1: Check if function exists
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_name = 'confirm_return_received_by_supplier';

-- STEP 2: Create/Replace function with SAFE version
CREATE OR REPLACE FUNCTION confirm_return_received_by_supplier(
    p_return_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
    v_supplier_id UUID;
    v_result JSON;
BEGIN
    -- Get return info
    SELECT 
        sr.id,
        sr.supplier_id,
        sr.movement_id,
        sr.status
    INTO v_return
    FROM shipment_returns sr
    WHERE sr.id = p_return_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return not found: %', p_return_id;
    END IF;

    -- Check status - must be APPROVED
    IF v_return.status != 'APPROVED' THEN
        RAISE EXCEPTION 'Return must be APPROVED first. Current status: %', v_return.status;
    END IF;

    -- Get current user (supplier)
    SELECT s.id INTO v_supplier_id
    FROM suppliers s
    WHERE s.profile_id = auth.uid();

    IF v_supplier_id IS NULL THEN
        RAISE EXCEPTION 'Supplier not found for current user';
    END IF;

    -- Verify ownership
    IF v_return.supplier_id != v_supplier_id THEN
        RAISE EXCEPTION 'Unauthorized: You can only confirm your own returns';
    END IF;

    -- Update return status to COMPLETED
    UPDATE shipment_returns
    SET 
        status = 'COMPLETED',
        reviewed_at = NOW()
    WHERE id = p_return_id;

    -- Update stock movement status (if exists)
    IF v_return.movement_id IS NOT NULL THEN
        UPDATE stock_movements
        SET 
            status = 'COMPLETED',
            completed_at = NOW()
        WHERE id = v_return.movement_id;
    END IF;

    -- Try to log activity (optional - won't fail if error)
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_logs') THEN
            -- Check which columns exist
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'activity_logs' 
                AND column_name = 'entity_type'
            ) THEN
                -- Full version with entity_type
                INSERT INTO activity_logs (
                    user_id,
                    action,
                    entity_type,
                    entity_id,
                    description
                ) VALUES (
                    auth.uid(),
                    'CONFIRM_RETURN_RECEIVED',
                    'shipment_return',
                    p_return_id,
                    'Supplier confirmed return received'
                );
            ELSE
                -- Minimal version without entity_type
                INSERT INTO activity_logs (
                    user_id,
                    action,
                    entity_id,
                    description
                ) VALUES (
                    auth.uid(),
                    'CONFIRM_RETURN_RECEIVED',
                    p_return_id,
                    'Supplier confirmed return received'
                );
            END IF;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log error but don't fail the whole function
            RAISE NOTICE 'Activity log failed: %', SQLERRM;
    END;

    -- Try to create notification (optional)
    BEGIN
        -- Notify admin that supplier confirmed return
        INSERT INTO notifications (
            recipient_id,
            title,
            message,
            type
        )
        SELECT 
            p.id,
            'Retur Dikonfirmasi Supplier',
            'Supplier telah mengkonfirmasi penerimaan retur produk',
            'SHIPMENT_RETURN'
        FROM profiles p
        WHERE p.role = 'ADMIN'
        LIMIT 1;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Notification failed: %', SQLERRM;
    END;

    -- Build result
    v_result := json_build_object(
        'success', true,
        'return_id', p_return_id,
        'status', 'COMPLETED',
        'message', 'Return confirmed successfully'
    );

    RETURN v_result;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error confirming return: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: Grant execute permission
GRANT EXECUTE ON FUNCTION confirm_return_received_by_supplier(UUID) TO authenticated;

-- STEP 4: Test the function (will rollback)
DO $$
DECLARE
    v_return_id UUID;
    v_result JSON;
BEGIN
    -- Find first APPROVED return
    SELECT id INTO v_return_id
    FROM shipment_returns
    WHERE status = 'APPROVED'
    LIMIT 1;

    IF v_return_id IS NULL THEN
        RAISE NOTICE '⚠️ No APPROVED returns found for testing';
        RAISE NOTICE 'Function is ready but cannot test without APPROVED return';
        RETURN;
    END IF;

    RAISE NOTICE '🧪 Testing with return ID: %', v_return_id;

    -- Test the function
    BEGIN
        SELECT confirm_return_received_by_supplier(v_return_id) INTO v_result;
        RAISE NOTICE '✅ TEST SUCCESS! Result: %', v_result;
        
        -- Rollback
        RAISE EXCEPTION 'Rollback test';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLERRM NOT LIKE '%Rollback%' THEN
                RAISE NOTICE '❌ TEST FAILED: %', SQLERRM;
            ELSE
                RAISE NOTICE '✅ Test completed (rolled back)';
            END IF;
    END;
END $$;

-- ========================================
-- SUMMARY
-- ========================================

SELECT 
    '✅ Function confirm_return_received_by_supplier ready!' AS status,
    'Supplier can now confirm return receipt' AS info;

-- Show function signature
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'confirm_return_received_by_supplier';
