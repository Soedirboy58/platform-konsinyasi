-- Migration 035: Fix approve_shipment_inventory function
-- This migration improves the shipment approval process to properly update inventory levels
-- Date: 2025-12-11

-- Drop the old approve_stock_movement function if it exists
DROP FUNCTION IF EXISTS approve_stock_movement() CASCADE;

-- Create the improved approve_shipment_inventory function
CREATE OR REPLACE FUNCTION approve_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- When a shipment is approved, update the inventory levels
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    
    -- Update inventory for each item in the shipment
    WITH shipment_items AS (
      SELECT 
        si.product_id,
        si.quantity,
        s.warehouse_id,
        s.consignee_id
      FROM shipment_items si
      INNER JOIN shipments s ON s.id = si.shipment_id
      WHERE s.id = NEW.id
    )
    UPDATE inventory
    SET 
      available_quantity = available_quantity - si.quantity,
      reserved_quantity = reserved_quantity + si.quantity,
      updated_at = NOW()
    FROM shipment_items si
    WHERE inventory.product_id = si.product_id
      AND inventory.warehouse_id = si.warehouse_id;
    
    -- Update shipment status timestamps
    NEW.approved_at = NOW();
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for the approve_stock_movement function if it doesn't exist
DROP TRIGGER IF EXISTS trigger_approve_stock_movement ON shipments;

CREATE TRIGGER trigger_approve_stock_movement
BEFORE UPDATE ON shipments
FOR EACH ROW
EXECUTE FUNCTION approve_stock_movement();

-- Backfill script: Sync inventory from already-approved shipments
-- This ensures historical data is properly reflected in inventory levels
BEGIN;

-- Create temporary table to track items that need backfilling
CREATE TEMP TABLE approved_shipment_items AS
SELECT DISTINCT
  si.product_id,
  s.warehouse_id,
  SUM(si.quantity) as total_quantity
FROM shipment_items si
INNER JOIN shipments s ON s.id = si.shipment_id
WHERE s.status = 'approved'
  AND s.approved_at IS NOT NULL
GROUP BY si.product_id, s.warehouse_id;

-- Update inventory levels based on approved shipments
UPDATE inventory
SET 
  available_quantity = available_quantity - asi.total_quantity,
  reserved_quantity = reserved_quantity + asi.total_quantity,
  updated_at = NOW()
FROM approved_shipment_items asi
WHERE inventory.product_id = asi.product_id
  AND inventory.warehouse_id = asi.warehouse_id
  AND available_quantity > 0;

-- Log the backfill operation
INSERT INTO migration_logs (migration_number, description, executed_at)
VALUES (
  35,
  'Backfilled inventory levels from approved shipments',
  NOW()
);

COMMIT;

-- Add index for better performance on shipment queries
CREATE INDEX IF NOT EXISTS idx_shipments_status_approved_at 
ON shipments(status, approved_at);

CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id 
ON shipment_items(shipment_id);

-- Verify the migration completed successfully
SELECT 
  COUNT(*) as total_approved_shipments,
  SUM(COALESCE(si.quantity, 0)) as total_items_in_approved_shipments
FROM shipments s
LEFT JOIN shipment_items si ON s.id = si.shipment_id
WHERE s.status = 'approved';
