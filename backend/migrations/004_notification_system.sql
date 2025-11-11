-- ========================================
-- MIGRATION 004: Notification System
-- ========================================
-- Description: Notifications table and triggers
-- Dependencies: 001_initial_schema.sql, 003_shipment_system.sql
-- Tables: notifications
-- Functions: create_notification, notify_shipment_approved, notify_shipment_rejected
-- Rollback: See bottom
-- ========================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_id) WHERE reference_id IS NOT NULL;

-- ========================================
-- FUNCTIONS
-- ========================================

-- Function: Create Notification
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_type VARCHAR,
  p_title VARCHAR,
  p_message TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (recipient_id, type, title, message, reference_id)
  VALUES (p_recipient_id, p_type, p_title, p_message, p_reference_id)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Function: Notify on shipment approval
CREATE OR REPLACE FUNCTION notify_shipment_approved()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_profile_id UUID;
BEGIN
  IF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
    -- Get supplier's profile_id
    SELECT profile_id INTO v_supplier_profile_id
    FROM suppliers
    WHERE id = NEW.supplier_id;
    
    -- Create notification
    PERFORM create_notification(
      v_supplier_profile_id,
      'SHIPMENT_APPROVED',
      'Pengiriman Disetujui',
      'Pengiriman Anda telah disetujui oleh admin',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger Function: Notify on shipment rejection
CREATE OR REPLACE FUNCTION notify_shipment_rejected()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_profile_id UUID;
BEGIN
  IF NEW.status = 'REJECTED' AND OLD.status != 'REJECTED' THEN
    -- Get supplier's profile_id
    SELECT profile_id INTO v_supplier_profile_id
    FROM suppliers
    WHERE id = NEW.supplier_id;
    
    -- Create notification
    PERFORM create_notification(
      v_supplier_profile_id,
      'SHIPMENT_REJECTED',
      'Pengiriman Ditolak',
      COALESCE('Alasan: ' || NEW.rejection_reason, 'Pengiriman Anda ditolak oleh admin'),
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- TRIGGERS
-- ========================================

DROP TRIGGER IF EXISTS trigger_shipment_approved ON stock_movements;
CREATE TRIGGER trigger_shipment_approved
  AFTER UPDATE ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION notify_shipment_approved();

DROP TRIGGER IF EXISTS trigger_shipment_rejected ON stock_movements;
CREATE TRIGGER trigger_shipment_rejected
  AFTER UPDATE ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION notify_shipment_rejected();

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 004: Notification System - SUCCESS!' AS status;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================
-- DROP TRIGGER IF EXISTS trigger_shipment_rejected ON stock_movements;
-- DROP TRIGGER IF EXISTS trigger_shipment_approved ON stock_movements;
-- DROP FUNCTION IF EXISTS notify_shipment_rejected();
-- DROP FUNCTION IF EXISTS notify_shipment_approved();
-- DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, UUID);
-- DROP TABLE IF EXISTS notifications CASCADE;
