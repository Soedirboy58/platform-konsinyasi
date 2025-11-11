-- ================================================
-- NOTIFICATION SYSTEM for Shipments & Approvals
-- ================================================
-- SAFE VERSION: No constraint, allows any type value

-- 1. ADD MISSING COLUMN to existing notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS reference_id UUID;

-- 2. DROP old constraint (to remove restrictions)
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_id);

-- 4. Enable RLS (if not already enabled)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications 
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications 
FOR UPDATE USING (true);

-- ================================================
-- FUNCTION: Create Notification
-- ================================================
CREATE OR REPLACE FUNCTION create_notification(
    p_recipient_id UUID,
    p_type VARCHAR,
    p_title VARCHAR,
    p_message TEXT,
    p_reference_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (
        recipient_id, type, title, message, reference_id, is_read
    ) VALUES (
        p_recipient_id, p_type, p_title, p_message, p_reference_id, FALSE
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCTION: Mark Notification as Read
-- ================================================
CREATE OR REPLACE FUNCTION mark_notification_read(
    p_notification_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = p_notification_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCTION: Mark All Notifications as Read for User
-- ================================================
CREATE OR REPLACE FUNCTION mark_all_notifications_read(
    p_recipient_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE notifications
    SET is_read = TRUE
    WHERE recipient_id = p_recipient_id AND is_read = FALSE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- TRIGGER: Auto-notify admins on shipment submit
-- ================================================
CREATE OR REPLACE FUNCTION notify_admins_on_shipment() 
RETURNS TRIGGER AS $$
DECLARE
    admin_record RECORD;
    supplier_name TEXT;
BEGIN
    -- Only trigger on new shipments with PENDING status
    IF (TG_OP = 'INSERT' AND NEW.status = 'PENDING') THEN
        -- Get supplier business name
        SELECT s.business_name INTO supplier_name
        FROM suppliers s
        WHERE s.id = NEW.supplier_id;
        
        -- Notify all admins
        FOR admin_record IN 
            SELECT id FROM profiles WHERE role = 'ADMIN'
        LOOP
            PERFORM create_notification(
                admin_record.id,
                'SHIPMENT_SUBMITTED',
                'Pengajuan Pengiriman Baru',
                supplier_name || ' mengajukan pengiriman produk. Silakan review.',
                NEW.id
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_shipment ON stock_movements;
CREATE TRIGGER trg_notify_shipment
    AFTER INSERT ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION notify_admins_on_shipment();

-- ================================================
-- TRIGGER: Notify supplier on shipment approval/rejection
-- ================================================
CREATE OR REPLACE FUNCTION notify_supplier_on_shipment_decision() 
RETURNS TRIGGER AS $$
DECLARE
    supplier_profile_id UUID;
BEGIN
    -- Only trigger on status change to APPROVED or REJECTED
    IF (TG_OP = 'UPDATE' AND OLD.status = 'PENDING' AND NEW.status IN ('APPROVED', 'REJECTED')) THEN
        -- Get supplier's profile_id
        SELECT profile_id INTO supplier_profile_id
        FROM suppliers
        WHERE id = NEW.supplier_id;
        
        IF NEW.status = 'APPROVED' THEN
            PERFORM create_notification(
                supplier_profile_id,
                'SHIPMENT_APPROVED',
                'Pengiriman Disetujui',
                'Pengajuan pengiriman Anda telah disetujui oleh admin.',
                NEW.id
            );
        ELSIF NEW.status = 'REJECTED' THEN
            PERFORM create_notification(
                supplier_profile_id,
                'SHIPMENT_REJECTED',
                'Pengiriman Ditolak',
                'Pengajuan pengiriman Anda ditolak. Alasan: ' || COALESCE(NEW.rejection_reason, 'Tidak ada keterangan'),
                NEW.id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_shipment_decision ON stock_movements;
CREATE TRIGGER trg_notify_shipment_decision
    AFTER UPDATE ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION notify_supplier_on_shipment_decision();

-- ================================================
-- SUCCESS
-- ================================================
SELECT 'SUCCESS: Notification system created!' AS status;
