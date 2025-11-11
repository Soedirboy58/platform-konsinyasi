-- ========================================
-- MIGRATION 003: Shipment System
-- ========================================
-- Description: Stock movements and shipment items
-- Dependencies: 001_initial_schema.sql
-- Tables: stock_movements, stock_movement_items
-- Rollback: See bottom
-- ========================================

-- 1. STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  movement_type VARCHAR(10) DEFAULT 'IN' CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
  notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. STOCK MOVEMENT ITEMS
CREATE TABLE IF NOT EXISTS stock_movement_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(movement_id, product_id)
);

-- ========================================
-- INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_stock_movements_supplier ON stock_movements(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_location ON stock_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_status ON stock_movements(status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement ON stock_movement_items(movement_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_product ON stock_movement_items(product_id);

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 003: Shipment System - SUCCESS!' AS status;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================
-- DROP TABLE IF EXISTS stock_movement_items CASCADE;
-- DROP TABLE IF EXISTS stock_movements CASCADE;
