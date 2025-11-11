-- ================================================
-- FIX: Drop conflicting notification functions
-- ================================================

-- Drop ALL versions of create_notification to avoid conflicts
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, UUID, VARCHAR);
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, UUID);
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT);

-- ================================================
-- CREATE: Clean notification function
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
-- SUCCESS
-- ================================================
SELECT 'SUCCESS: Notification function cleaned and recreated!' AS status;
