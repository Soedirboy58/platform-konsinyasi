-- ================================================
-- FIX: Create Missing Stock Movement Functions
-- ================================================

-- Drop old versions (if exist)
DROP FUNCTION IF EXISTS approve_stock_movement(UUID);
DROP FUNCTION IF EXISTS approve_stock_movement(UUID, UUID);
DROP FUNCTION IF EXISTS reject_stock_movement(UUID, TEXT);
DROP FUNCTION IF EXISTS reject_stock_movement(UUID, UUID, TEXT);

-- ================================================
-- FUNCTION: Approve Stock Movement
-- ================================================
CREATE OR REPLACE FUNCTION approve_stock_movement(
    p_movement_id UUID,
    p_admin_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    -- Update stock movement status to APPROVED
    UPDATE stock_movements
    SET 
        status = 'APPROVED',
        approved_by = p_admin_id,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_movement_id 
      AND status = 'PENDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movement not found or already processed';
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCTION: Reject Stock Movement
-- ================================================
CREATE OR REPLACE FUNCTION reject_stock_movement(
    p_movement_id UUID,
    p_admin_id UUID,
    p_rejection_reason TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Update stock movement status to REJECTED
    UPDATE stock_movements
    SET 
        status = 'REJECTED',
        approved_by = p_admin_id,
        approved_at = NOW(),
        rejection_reason = p_rejection_reason,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_movement_id 
      AND status = 'PENDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movement not found or already processed';
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- VERIFY: Test functions exist
-- ================================================
SELECT 
    proname AS function_name,
    pg_get_function_identity_arguments(oid) AS arguments
FROM pg_proc
WHERE proname IN ('approve_stock_movement', 'reject_stock_movement')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname, arguments;

-- ================================================
-- SUCCESS
-- ================================================
SELECT 'SUCCESS: Stock movement functions created!' AS status;
