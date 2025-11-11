-- ========================================
-- Migration: Auto-create inventory when product approved
-- ========================================
-- Description: Trigger to automatically create inventory_levels
--              entry when product is approved by admin
-- Execute: After migration 018
-- ========================================

-- Create function for trigger
CREATE OR REPLACE FUNCTION auto_create_inventory_on_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_location_id UUID;
BEGIN
    -- Only proceed if status changed to APPROVED
    IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status != 'APPROVED') THEN
        
        -- Get first active outlet location
        SELECT id INTO v_location_id
        FROM locations
        WHERE type = 'OUTLET' 
          AND is_active = TRUE
        ORDER BY created_at ASC
        LIMIT 1;
        
        -- If location found, create inventory entry
        IF v_location_id IS NOT NULL THEN
            -- Check if inventory already exists
            IF NOT EXISTS (
                SELECT 1 FROM inventory_levels 
                WHERE product_id = NEW.id 
                  AND location_id = v_location_id
            ) THEN
                -- Create inventory with default quantity
                INSERT INTO inventory_levels (
                    product_id,
                    location_id,
                    quantity
                ) VALUES (
                    NEW.id,
                    v_location_id,
                    0  -- Start with 0, supplier needs to add stock
                );
                
                RAISE NOTICE 'Auto-created inventory for product % at location %', NEW.id, v_location_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_create_inventory ON products;

CREATE TRIGGER trigger_auto_create_inventory
    AFTER INSERT OR UPDATE OF status ON products
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_inventory_on_approval();

-- ========================================
-- VERIFICATION
-- ========================================

-- Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_auto_create_inventory';

-- ========================================
-- BACKFILL: Create inventory for existing approved products
-- ========================================

-- Create inventory for products that are already approved but missing inventory
INSERT INTO inventory_levels (product_id, location_id, quantity)
SELECT DISTINCT
    p.id AS product_id,
    l.id AS location_id,
    0 AS quantity
FROM products p
CROSS JOIN locations l
WHERE p.status = 'APPROVED'
  AND l.type = 'OUTLET'
  AND l.is_active = TRUE
  AND NOT EXISTS (
      SELECT 1 FROM inventory_levels il
      WHERE il.product_id = p.id AND il.location_id = l.id
  );

-- Report how many were backfilled
SELECT 
    COUNT(*) AS backfilled_count,
    'inventory entries created for existing approved products' AS description
FROM inventory_levels il
WHERE il.created_at >= NOW() - INTERVAL '1 minute';

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 019: Auto-create inventory trigger - SUCCESS!' AS status;
