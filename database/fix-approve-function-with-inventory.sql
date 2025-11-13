-- ================================================
-- FIX: approve_stock_movement - ADD INVENTORY LOGIC
-- ================================================
-- Problem: Function only updates status, doesn't create inventory records
-- Solution: Create/update inventory when approving shipment

DROP FUNCTION IF EXISTS approve_stock_movement(UUID, UUID);

CREATE OR REPLACE FUNCTION approve_stock_movement(
    p_movement_id UUID,
    p_admin_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_supplier_id UUID;
    v_location_id UUID;
    v_item RECORD;
BEGIN
    -- Get movement details
    SELECT supplier_id, location_id
    INTO v_supplier_id, v_location_id
    FROM stock_movements
    WHERE id = p_movement_id AND status = 'PENDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movement not found or already processed';
    END IF;

    -- Update stock movement status to APPROVED
    UPDATE stock_movements
    SET 
        status = 'APPROVED',
        approved_by = p_admin_id,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_movement_id;

    -- Process each item: CREATE or UPDATE inventory
    FOR v_item IN 
        SELECT product_id, quantity
        FROM stock_movement_items
        WHERE movement_id = p_movement_id
    LOOP
        -- Check if inventory record exists
        IF EXISTS (
            SELECT 1 FROM inventory_levels
            WHERE product_id = v_item.product_id
              AND location_id = v_location_id
        ) THEN
            -- UPDATE: Add to existing stock
            UPDATE inventory_levels
            SET 
                quantity = quantity + v_item.quantity,
                updated_at = NOW()
            WHERE product_id = v_item.product_id
              AND location_id = v_location_id;
        ELSE
            -- INSERT: Create new inventory record
            INSERT INTO inventory_levels (
                product_id,
                location_id,
                quantity,
                created_at,
                updated_at
            ) VALUES (
                v_item.product_id,
                v_location_id,
                v_item.quantity,
                NOW(),
                NOW()
            );
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- VERIFY: Test function
-- ================================================
SELECT 
    proname AS function_name,
    pg_get_function_identity_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'approve_stock_movement'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ================================================
-- NOTES:
-- ================================================
-- After running this SQL:
-- 1. Approve a shipment
-- 2. Check inventory table: SELECT * FROM inventory;
-- 3. Product should appear in dashboard "Produk Stok Tersedia"
-- 4. Product should appear in etalase with available quantity
-- ================================================
