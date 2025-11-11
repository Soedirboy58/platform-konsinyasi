-- ========================================
-- MIGRATION 007: Database Functions
-- ========================================
-- Description: Business logic functions
-- Dependencies: All previous migrations
-- Functions: approve_stock_movement, reject_stock_movement
-- Rollback: See bottom
-- ========================================

-- ================================================
-- SHIPMENT APPROVAL FUNCTIONS
-- ================================================

-- Function: Approve Stock Movement
CREATE OR REPLACE FUNCTION approve_stock_movement(
  p_movement_id UUID,
  p_admin_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Verify admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can approve shipments';
  END IF;
  
  -- Update movement status
  UPDATE stock_movements
  SET 
    status = 'APPROVED',
    approved_by = p_admin_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_movement_id
    AND status = 'PENDING';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock movement not found or already processed';
  END IF;
  
  -- Update inventory levels
  INSERT INTO inventory_levels (product_id, location_id, quantity)
  SELECT 
    smi.product_id,
    sm.location_id,
    smi.quantity
  FROM stock_movement_items smi
  JOIN stock_movements sm ON sm.id = smi.movement_id
  WHERE smi.movement_id = p_movement_id
  ON CONFLICT (product_id, location_id)
  DO UPDATE SET 
    quantity = inventory_levels.quantity + EXCLUDED.quantity,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reject Stock Movement
CREATE OR REPLACE FUNCTION reject_stock_movement(
  p_movement_id UUID,
  p_admin_id UUID,
  p_rejection_reason TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Verify admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can reject shipments';
  END IF;
  
  -- Validate reason
  IF p_rejection_reason IS NULL OR LENGTH(TRIM(p_rejection_reason)) = 0 THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;
  
  -- Update movement status
  UPDATE stock_movements
  SET 
    status = 'REJECTED',
    rejection_reason = p_rejection_reason,
    approved_by = p_admin_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_movement_id
    AND status = 'PENDING';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock movement not found or already processed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- WALLET HELPER FUNCTIONS
-- ================================================

-- Function: Get Supplier Wallet Balance
CREATE OR REPLACE FUNCTION get_supplier_wallet_balance(p_supplier_id UUID)
RETURNS TABLE (
  available DECIMAL(15,2),
  pending DECIMAL(15,2),
  total_earned DECIMAL(15,2),
  total_withdrawn DECIMAL(15,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    available_balance,
    pending_balance,
    total_earned,
    total_withdrawn
  FROM supplier_wallets
  WHERE supplier_id = p_supplier_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- UTILITY FUNCTIONS
-- ================================================

-- Function: Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ================================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_movements_updated_at ON stock_movements;
CREATE TRIGGER update_stock_movements_updated_at
  BEFORE UPDATE ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- SUCCESS
-- ================================================

SELECT 'Migration 007: Database Functions - SUCCESS!' AS status;

-- ================================================
-- ROLLBACK (if needed)
-- ================================================
/*
DROP TRIGGER IF EXISTS update_stock_movements_updated_at ON stock_movements;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS get_supplier_wallet_balance(UUID);
DROP FUNCTION IF EXISTS reject_stock_movement(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS approve_stock_movement(UUID, UUID);
*/
