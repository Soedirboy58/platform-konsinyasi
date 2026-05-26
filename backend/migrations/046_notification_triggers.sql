-- Migration 046: Notification Triggers for 3 Key Events
-- Events:
--   1. Admin notified when a new mitra (supplier) registers
--   2. Admin notified when mitra submits a shipment to etalase (stock_movements PENDING)
--   3. Mitra notified when admin sends payment (supplier_payments COMPLETED)
-- Run this in Supabase SQL Editor

-- =============================================
-- STEP 1: Expand notifications type CHECK constraint
-- =============================================
DO $$
BEGIN
  -- Drop existing constraint and recreate with new types
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'PRODUCT_APPROVAL',
      'STOCK_ADJUSTMENT',
      'LOW_STOCK',
      'EXPIRY_WARNING',
      'ORDER_UPDATE',
      'PAYMENT',
      'PAYMENT_RECEIVED',
      'PAYMENT_REQUEST',
      'SHIPMENT_APPROVED',
      'SHIPMENT_REJECTED',
      'RETURN_REQUEST',
      'RETURN_APPROVED',
      'RETURN_REJECTED',
      'WITHDRAWAL_REQUEST',
      'SALE',
      'SUPPLIER_REGISTRATION',
      'SHIPMENT_SUBMITTED'
    ));
  RAISE NOTICE '✅ notifications type constraint updated';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️ Could not update constraint: % — continuing anyway', SQLERRM;
END $$;

-- =============================================
-- STEP 2: Trigger — New Mitra Registration → Notify Admins
-- =============================================
CREATE OR REPLACE FUNCTION notify_supplier_registration()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_full_name TEXT;
BEGIN
  -- Get profile name if available
  SELECT full_name INTO v_full_name FROM profiles WHERE id = NEW.profile_id;

  -- Notify all active admins
  FOR v_admin_id IN
    SELECT id FROM profiles WHERE role = 'ADMIN' AND is_active IS NOT FALSE
  LOOP
    INSERT INTO notifications (
      recipient_id, title, message, type, priority, action_url, metadata
    ) VALUES (
      v_admin_id,
      '🏪 Mitra Baru Mendaftar',
      format('"%s" telah mendaftar sebagai mitra baru dan menunggu persetujuan.', NEW.business_name),
      'SUPPLIER_REGISTRATION',
      'HIGH',
      '/admin/suppliers',
      jsonb_build_object(
        'supplier_id', NEW.id,
        'business_name', NEW.business_name,
        'profile_id', NEW.profile_id,
        'registrant_name', COALESCE(v_full_name, '')
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_supplier_registration ON suppliers;
CREATE TRIGGER trigger_notify_supplier_registration
  AFTER INSERT ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION notify_supplier_registration();

-- =============================================
-- STEP 3: Trigger — Mitra Submits Shipment → Notify Admins
-- =============================================
CREATE OR REPLACE FUNCTION notify_shipment_submitted()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_supplier_name TEXT;
  v_location_name TEXT;
BEGIN
  -- Only fire for new PENDING IN shipments
  IF NEW.movement_type != 'IN' OR NEW.status != 'PENDING' THEN
    RETURN NEW;
  END IF;

  -- Get supplier name
  SELECT business_name INTO v_supplier_name
  FROM suppliers WHERE id = NEW.supplier_id;

  -- Get location name
  SELECT name INTO v_location_name
  FROM locations WHERE id = NEW.location_id;

  -- Notify all active admins
  FOR v_admin_id IN
    SELECT id FROM profiles WHERE role = 'ADMIN' AND is_active IS NOT FALSE
  LOOP
    INSERT INTO notifications (
      recipient_id, title, message, type, priority, action_url, metadata
    ) VALUES (
      v_admin_id,
      '📦 Pengajuan Pengiriman Baru',
      format('"%s" mengajukan pengiriman produk ke %s. Mohon review dan setujui.',
        COALESCE(v_supplier_name, 'Mitra'),
        COALESCE(v_location_name, 'etalase')
      ),
      'SHIPMENT_SUBMITTED',
      'HIGH',
      '/admin/suppliers/shipments',
      jsonb_build_object(
        'movement_id', NEW.id,
        'supplier_id', NEW.supplier_id,
        'supplier_name', COALESCE(v_supplier_name, ''),
        'location_id', NEW.location_id,
        'location_name', COALESCE(v_location_name, '')
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_shipment_submitted ON stock_movements;
CREATE TRIGGER trigger_notify_shipment_submitted
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION notify_shipment_submitted();

-- =============================================
-- STEP 4: Trigger — Admin Sends Payment → Notify Mitra
-- =============================================
CREATE OR REPLACE FUNCTION notify_supplier_payment_received()
RETURNS TRIGGER AS $$
DECLARE
  v_profile_id UUID;
  v_business_name TEXT;
BEGIN
  -- Only fire when status becomes COMPLETED
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status = 'COMPLETED') OR
    (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'COMPLETED' AND NEW.status = 'COMPLETED')
  ) THEN
    RETURN NEW;
  END IF;

  -- Get supplier profile
  SELECT profile_id, business_name INTO v_profile_id, v_business_name
  FROM suppliers WHERE id = NEW.supplier_id;

  IF v_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (
    recipient_id, title, message, type, priority, action_url, metadata
  ) VALUES (
    v_profile_id,
    '💰 Pembayaran Diterima',
    format('Admin telah mengirim pembayaran sebesar Rp %s kepada Anda.%s',
      to_char(COALESCE(NEW.net_payment, NEW.amount, 0), 'FM999,999,999'),
      CASE WHEN NEW.payment_reference IS NOT NULL
        THEN ' Ref: ' || NEW.payment_reference
        ELSE ''
      END
    ),
    'PAYMENT_RECEIVED',
    'HIGH',
    '/supplier/wallet',
    jsonb_build_object(
      'payment_id', NEW.id,
      'amount', COALESCE(NEW.net_payment, NEW.amount, 0),
      'payment_reference', COALESCE(NEW.payment_reference, ''),
      'paid_at', COALESCE(NEW.paid_at, NOW())
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_supplier_payment ON supplier_payments;
CREATE TRIGGER trigger_notify_supplier_payment
  AFTER INSERT OR UPDATE ON supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_supplier_payment_received();

-- =============================================
-- VERIFY
-- =============================================
SELECT
  trigger_name,
  event_object_table AS "table",
  event_manipulation AS "event",
  action_timing AS "timing"
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_notify_supplier_registration',
  'trigger_notify_shipment_submitted',
  'trigger_notify_supplier_payment'
)
ORDER BY event_object_table;
