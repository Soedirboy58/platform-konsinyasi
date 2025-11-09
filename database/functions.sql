-- ========================================
-- Event-Driven Notification Functions
-- ========================================

-- Function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
    p_recipient_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT,
    p_priority TEXT DEFAULT 'NORMAL',
    p_action_url TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO notifications (
        recipient_id, title, message, type, priority, action_url, metadata
    )
    VALUES (
        p_recipient_id, p_title, p_message, p_type, p_priority, p_action_url, p_metadata
    )
    RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- TRIGGER FUNCTIONS FOR NOTIFICATIONS
-- ========================================

-- 1. New Product Registration Notification
CREATE OR REPLACE FUNCTION notify_new_product()
RETURNS TRIGGER AS $$
DECLARE
    supplier_name TEXT;
    admin_id UUID;
BEGIN
    -- Get supplier business name
    SELECT s.business_name INTO supplier_name
    FROM suppliers s
    WHERE s.id = NEW.supplier_id;
    
    -- Notify all admins
    FOR admin_id IN 
        SELECT id FROM profiles WHERE role = 'ADMIN' AND is_active = TRUE
    LOOP
        PERFORM create_notification(
            admin_id,
            'Produk Baru Menunggu Persetujuan',
            format('Supplier %s telah mendaftarkan produk baru "%s". Mohon review dan approve agar bisa mulai dijual.', 
                   supplier_name, NEW.name),
            'PRODUCT_APPROVAL',
            'HIGH',
            format('/admin/products/%s', NEW.id),
            jsonb_build_object(
                'product_id', NEW.id,
                'supplier_id', NEW.supplier_id,
                'product_name', NEW.name
            )
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Inventory Adjustment Notification
CREATE OR REPLACE FUNCTION notify_inventory_adjustment()
RETURNS TRIGGER AS $$
DECLARE
    product_name TEXT;
    location_name TEXT;
    supplier_profile_id UUID;
    admin_id UUID;
BEGIN
    -- Get product and location details
    SELECT p.name, l.name, s.profile_id
    INTO product_name, location_name, supplier_profile_id
    FROM inventory_levels il
    JOIN products p ON p.id = il.product_id
    JOIN locations l ON l.id = il.location_id
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE il.id = NEW.inventory_level_id;
    
    -- Notify admins about new adjustment claim
    IF NEW.adjustment_type IN ('HILANG', 'RUSAK', 'KADALUWARSA') THEN
        FOR admin_id IN 
            SELECT id FROM profiles WHERE role = 'ADMIN' AND is_active = TRUE
        LOOP
            PERFORM create_notification(
                admin_id,
                'Klaim Stok Hilang/Rusak Baru',
                format('Supplier melaporkan %s unit "%s" %s di %s dengan bukti terlampir. Mohon review klaim ini.',
                       ABS(NEW.quantity_change), product_name, 
                       CASE NEW.adjustment_type
                           WHEN 'HILANG' THEN 'hilang'
                           WHEN 'RUSAK' THEN 'rusak'
                           WHEN 'KADALUWARSA' THEN 'kadaluwarsa'
                       END,
                       location_name),
                'STOCK_ADJUSTMENT',
                'HIGH',
                format('/admin/adjustments/%s', NEW.id),
                jsonb_build_object(
                    'adjustment_id', NEW.id,
                    'product_name', product_name,
                    'location_name', location_name,
                    'quantity', ABS(NEW.quantity_change),
                    'type', NEW.adjustment_type
                )
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Adjustment Status Update Notification
CREATE OR REPLACE FUNCTION notify_adjustment_status_change()
RETURNS TRIGGER AS $$
DECLARE
    product_name TEXT;
    location_name TEXT;
    supplier_profile_id UUID;
BEGIN
    -- Only notify on status changes
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Get details
    SELECT p.name, l.name, s.profile_id
    INTO product_name, location_name, supplier_profile_id
    FROM inventory_levels il
    JOIN products p ON p.id = il.product_id
    JOIN locations l ON l.id = il.location_id
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE il.id = NEW.inventory_level_id;
    
    -- Notify supplier about approval/rejection
    IF NEW.status IN ('APPROVED', 'REJECTED') THEN
        PERFORM create_notification(
            supplier_profile_id,
            format('Klaim Stok %s', 
                   CASE NEW.status WHEN 'APPROVED' THEN 'Disetujui' ELSE 'Ditolak' END),
            format('Klaim Anda untuk %s unit "%s" di %s telah %s oleh Admin. %s',
                   ABS(NEW.quantity_change), product_name, location_name,
                   CASE NEW.status WHEN 'APPROVED' THEN 'disetujui' ELSE 'ditolak' END,
                   CASE NEW.status 
                       WHEN 'APPROVED' THEN 'Ini akan diperhitungkan dalam siklus pembayaran berikutnya.'
                       ELSE COALESCE('Alasan: ' || NEW.review_notes, '')
                   END),
            'STOCK_ADJUSTMENT',
            'NORMAL',
            format('/supplier/adjustments/%s', NEW.id),
            jsonb_build_object(
                'adjustment_id', NEW.id,
                'status', NEW.status,
                'product_name', product_name
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- CRON JOB FUNCTIONS (Edge Functions)
-- ========================================

-- 4. Low Stock Alert Function
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TABLE(product_id UUID, location_id UUID, current_stock INTEGER, threshold INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        il.product_id,
        il.location_id,
        il.quantity,
        p.min_stock_threshold
    FROM inventory_levels il
    JOIN products p ON p.id = il.product_id
    JOIN locations l ON l.id = il.location_id
    WHERE il.quantity <= p.min_stock_threshold
    AND il.quantity > 0
    AND p.status = 'APPROVED'
    AND l.type = 'OUTLET'
    AND l.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send low stock notifications
CREATE OR REPLACE FUNCTION send_low_stock_notifications()
RETURNS INTEGER AS $$
DECLARE
    stock_record RECORD;
    supplier_profile_id UUID;
    product_name TEXT;
    location_name TEXT;
    notification_count INTEGER := 0;
BEGIN
    -- Check each low stock item
    FOR stock_record IN SELECT * FROM check_low_stock() LOOP
        -- Get product and supplier details
        SELECT p.name, s.profile_id, l.name
        INTO product_name, supplier_profile_id, location_name
        FROM products p
        JOIN suppliers s ON s.id = p.supplier_id
        JOIN locations l ON l.id = stock_record.location_id
        WHERE p.id = stock_record.product_id;
        
        -- Check if notification was already sent today
        IF NOT EXISTS (
            SELECT 1 FROM notifications 
            WHERE recipient_id = supplier_profile_id 
            AND type = 'LOW_STOCK'
            AND metadata->>'product_id' = stock_record.product_id::text
            AND metadata->>'location_id' = stock_record.location_id::text
            AND created_at::date = CURRENT_DATE
        ) THEN
            -- Send notification
            PERFORM create_notification(
                supplier_profile_id,
                'Stok Produk Menipis',
                format('Stok "%s" Anda di %s tinggal %s unit. Segera lakukan restock.',
                       product_name, location_name, stock_record.current_stock),
                'LOW_STOCK',
                'HIGH',
                format('/supplier/inventory?product=%s&location=%s', 
                       stock_record.product_id, stock_record.location_id),
                jsonb_build_object(
                    'product_id', stock_record.product_id,
                    'location_id', stock_record.location_id,
                    'current_stock', stock_record.current_stock,
                    'threshold', stock_record.threshold
                )
            );
            
            notification_count := notification_count + 1;
        END IF;
    END LOOP;
    
    RETURN notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Expiry Warning Function
CREATE OR REPLACE FUNCTION check_expiring_products()
RETURNS TABLE(
    product_id UUID, 
    location_id UUID, 
    quantity INTEGER, 
    stocked_date DATE,
    expiry_date DATE,
    days_until_expiry INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        il.product_id,
        il.location_id,
        il.quantity,
        il.stocked_at_timestamp::date,
        (il.stocked_at_timestamp::date + p.expiry_duration_days * INTERVAL '1 day')::date,
        EXTRACT(DAY FROM (il.stocked_at_timestamp::date + p.expiry_duration_days * INTERVAL '1 day') - CURRENT_DATE)::integer
    FROM inventory_levels il
    JOIN products p ON p.id = il.product_id
    JOIN locations l ON l.id = il.location_id
    WHERE il.quantity > 0
    AND p.status = 'APPROVED'
    AND l.is_active = TRUE
    AND (il.stocked_at_timestamp::date + p.expiry_duration_days * INTERVAL '1 day') <= (CURRENT_DATE + INTERVAL '3 days')
    AND (il.stocked_at_timestamp::date + p.expiry_duration_days * INTERVAL '1 day') >= CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to send expiry warnings
CREATE OR REPLACE FUNCTION send_expiry_warnings()
RETURNS INTEGER AS $$
DECLARE
    expiry_record RECORD;
    supplier_profile_id UUID;
    product_name TEXT;
    location_name TEXT;
    admin_id UUID;
    notification_count INTEGER := 0;
BEGIN
    -- Check each expiring item
    FOR expiry_record IN SELECT * FROM check_expiring_products() LOOP
        -- Get product and supplier details
        SELECT p.name, s.profile_id, l.name
        INTO product_name, supplier_profile_id, location_name
        FROM products p
        JOIN suppliers s ON s.id = p.supplier_id
        JOIN locations l ON l.id = expiry_record.location_id
        WHERE p.id = expiry_record.product_id;
        
        -- Check if notification was already sent today
        IF NOT EXISTS (
            SELECT 1 FROM notifications 
            WHERE type = 'EXPIRY_WARNING'
            AND metadata->>'product_id' = expiry_record.product_id::text
            AND metadata->>'location_id' = expiry_record.location_id::text
            AND created_at::date = CURRENT_DATE
        ) THEN
            -- Notify supplier
            PERFORM create_notification(
                supplier_profile_id,
                'Produk Akan Kadaluwarsa',
                format('Perhatian: %s unit "%s" di %s akan kadaluwarsa dalam %s hari (%s).',
                       expiry_record.quantity, product_name, location_name, 
                       expiry_record.days_until_expiry, expiry_record.expiry_date),
                'EXPIRY_WARNING',
                'URGENT',
                format('/supplier/inventory?product=%s&location=%s', 
                       expiry_record.product_id, expiry_record.location_id),
                jsonb_build_object(
                    'product_id', expiry_record.product_id,
                    'location_id', expiry_record.location_id,
                    'quantity', expiry_record.quantity,
                    'expiry_date', expiry_record.expiry_date,
                    'days_until_expiry', expiry_record.days_until_expiry
                )
            );
            
            -- Also notify admins
            FOR admin_id IN 
                SELECT id FROM profiles WHERE role = 'ADMIN' AND is_active = TRUE
            LOOP
                PERFORM create_notification(
                    admin_id,
                    'Produk Akan Kadaluwarsa',
                    format('Perhatian: %s unit "%s" di %s akan kadaluwarsa dalam %s hari.',
                           expiry_record.quantity, product_name, location_name, 
                           expiry_record.days_until_expiry),
                    'EXPIRY_WARNING',
                    'HIGH',
                    '/admin/inventory/expiring',
                    jsonb_build_object(
                        'product_id', expiry_record.product_id,
                        'location_id', expiry_record.location_id,
                        'quantity', expiry_record.quantity,
                        'days_until_expiry', expiry_record.days_until_expiry
                    )
                );
            END LOOP;
            
            notification_count := notification_count + 1;
        END IF;
    END LOOP;
    
    RETURN notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- CREATE TRIGGERS
-- ========================================

-- Product registration trigger
DROP TRIGGER IF EXISTS trigger_notify_new_product ON products;
CREATE TRIGGER trigger_notify_new_product
    AFTER INSERT ON products
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_product();

-- Inventory adjustment trigger
DROP TRIGGER IF EXISTS trigger_notify_inventory_adjustment ON inventory_adjustments;
CREATE TRIGGER trigger_notify_inventory_adjustment
    AFTER INSERT ON inventory_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION notify_inventory_adjustment();

-- Adjustment status change trigger
DROP TRIGGER IF EXISTS trigger_notify_adjustment_status_change ON inventory_adjustments;
CREATE TRIGGER trigger_notify_adjustment_status_change
    AFTER UPDATE ON inventory_adjustments
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION notify_adjustment_status_change();

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications 
    SET is_read = TRUE, read_at = NOW()
    WHERE id = notification_id 
    AND recipient_id = user_id
    AND is_read = FALSE;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread notification count
CREATE OR REPLACE FUNCTION get_unread_count(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM notifications
    WHERE recipient_id = user_id AND is_read = FALSE;
    
    RETURN COALESCE(count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;