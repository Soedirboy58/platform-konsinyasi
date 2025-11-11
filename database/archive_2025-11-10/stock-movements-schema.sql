-- ================================================
-- STOCK MOVEMENTS & SHIPMENT TRACKING SYSTEM
-- Track product shipments from suppliers to locations
-- ================================================

-- 1. STOCK MOVEMENTS (Shipments)
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  movement_type VARCHAR(10) DEFAULT 'IN' CHECK (movement_type IN ('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT')),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. STOCK MOVEMENT ITEMS (Shipment Details)
CREATE TABLE IF NOT EXISTS stock_movement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID REFERENCES stock_movements(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- INDEXES
-- ================================================
CREATE INDEX IF NOT EXISTS idx_stock_movements_supplier ON stock_movements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_location ON stock_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON stock_movements(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement ON stock_movement_items(movement_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_product ON stock_movement_items(product_id);

-- ================================================
-- RLS POLICIES
-- ================================================

-- STOCK MOVEMENTS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Suppliers can view their own shipments
CREATE POLICY "Suppliers can view own shipments"
  ON stock_movements FOR SELECT
  USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
  );

-- Suppliers can create shipments
CREATE POLICY "Suppliers can create shipments"
  ON stock_movements FOR INSERT
  WITH CHECK (
    supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
  );

-- Suppliers can cancel their pending shipments
CREATE POLICY "Suppliers can cancel pending shipments"
  ON stock_movements FOR UPDATE
  USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
    AND status = 'PENDING'
  )
  WITH CHECK (status = 'CANCELLED');

-- Admins can view all shipments
CREATE POLICY "Admins can view all shipments"
  ON stock_movements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Admins can update shipments
CREATE POLICY "Admins can update shipments"
  ON stock_movements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- STOCK MOVEMENT ITEMS
ALTER TABLE stock_movement_items ENABLE ROW LEVEL SECURITY;

-- Suppliers can view items of their shipments
CREATE POLICY "Suppliers can view own shipment items"
  ON stock_movement_items FOR SELECT
  USING (
    movement_id IN (
      SELECT id FROM stock_movements 
      WHERE supplier_id IN (
        SELECT id FROM suppliers WHERE profile_id = auth.uid()
      )
    )
  );

-- Suppliers can insert items when creating shipments
CREATE POLICY "Suppliers can insert shipment items"
  ON stock_movement_items FOR INSERT
  WITH CHECK (
    movement_id IN (
      SELECT id FROM stock_movements 
      WHERE supplier_id IN (
        SELECT id FROM suppliers WHERE profile_id = auth.uid()
      )
      AND status = 'PENDING'
    )
  );

-- Admins can view all items
CREATE POLICY "Admins can view all shipment items"
  ON stock_movement_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ================================================
-- FUNCTIONS
-- ================================================

-- Function: Approve Shipment and Update Inventory
CREATE OR REPLACE FUNCTION approve_shipment(
  p_movement_id UUID,
  p_admin_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Update shipment status
  UPDATE stock_movements
  SET 
    status = 'APPROVED',
    approved_by = p_admin_id,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_movement_id AND status = 'PENDING';

  -- Update inventory levels for each item
  FOR v_item IN 
    SELECT product_id, quantity, movement_id
    FROM stock_movement_items
    WHERE movement_id = p_movement_id
  LOOP
    -- Get location from movement
    DECLARE
      v_location_id UUID;
    BEGIN
      SELECT location_id INTO v_location_id
      FROM stock_movements
      WHERE id = p_movement_id;

      -- Insert or update inventory level
      INSERT INTO inventory_levels (product_id, location_id, quantity)
      VALUES (v_item.product_id, v_location_id, v_item.quantity)
      ON CONFLICT (product_id, location_id)
      DO UPDATE SET quantity = inventory_levels.quantity + EXCLUDED.quantity;
    END;
  END LOOP;

  -- Mark as completed
  UPDATE stock_movements
  SET 
    status = 'COMPLETED',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_movement_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reject Shipment
CREATE OR REPLACE FUNCTION reject_shipment(
  p_movement_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE stock_movements
  SET 
    status = 'REJECTED',
    approved_by = p_admin_id,
    approved_at = NOW(),
    rejection_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_movement_id AND status = 'PENDING';

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- VIEWS
-- ================================================

-- View: Shipment Summary with Details
CREATE OR REPLACE VIEW shipment_summary AS
SELECT 
  sm.id,
  sm.supplier_id,
  s.business_name as supplier_name,
  sm.location_id,
  l.name as location_name,
  sm.movement_type,
  sm.status,
  sm.notes,
  sm.created_at,
  sm.approved_at,
  sm.completed_at,
  COUNT(smi.id) as total_items,
  SUM(smi.quantity) as total_quantity,
  p.full_name as approved_by_name
FROM stock_movements sm
LEFT JOIN suppliers s ON sm.supplier_id = s.id
LEFT JOIN locations l ON sm.location_id = l.id
LEFT JOIN stock_movement_items smi ON sm.id = smi.movement_id
LEFT JOIN profiles p ON sm.approved_by = p.id
GROUP BY sm.id, s.business_name, l.name, p.full_name;

COMMENT ON TABLE stock_movements IS 'Track shipments and stock movements from suppliers to locations';
COMMENT ON TABLE stock_movement_items IS 'Details of products in each shipment';
