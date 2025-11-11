-- ================================================
-- TESTING QUERIES for Notification System
-- ================================================
-- Run these queries in Supabase SQL Editor after notification-system.sql is executed

-- ================================================
-- TEST 1: Check All Notifications (Overall View)
-- ================================================
SELECT 
    n.id,
    n.type,
    n.title,
    n.message,
    n.is_read,
    n.created_at,
    p.full_name as recipient_name,
    p.role as recipient_role
FROM notifications n
LEFT JOIN profiles p ON n.recipient_id = p.id
ORDER BY n.created_at DESC
LIMIT 20;

-- ================================================
-- TEST 2: Check Shipment Notifications (All Types)
-- ================================================
SELECT 
    n.type,
    n.title,
    n.message,
    n.reference_id as shipment_id,
    p.full_name as recipient,
    p.role,
    n.is_read,
    n.created_at
FROM notifications n
LEFT JOIN profiles p ON n.recipient_id = p.id
WHERE n.type IN ('SHIPMENT_SUBMITTED', 'SHIPMENT_APPROVED', 'SHIPMENT_REJECTED')
ORDER BY n.created_at DESC;

-- ================================================
-- TEST 3: Check Notifications for ALL Admins
-- ================================================
SELECT 
    p.full_name as admin_name,
    COUNT(n.id) as total_notifications,
    COUNT(CASE WHEN n.is_read = false THEN 1 END) as unread_count,
    COUNT(CASE WHEN n.type = 'SHIPMENT_SUBMITTED' THEN 1 END) as shipment_notifications
FROM profiles p
LEFT JOIN notifications n ON n.recipient_id = p.id
WHERE p.role = 'ADMIN'
GROUP BY p.id, p.full_name
ORDER BY unread_count DESC;

-- ================================================
-- TEST 4: Check Notifications for ALL Suppliers
-- ================================================
SELECT 
    s.business_name,
    p.full_name as supplier_owner,
    COUNT(n.id) as total_notifications,
    COUNT(CASE WHEN n.is_read = false THEN 1 END) as unread_count,
    COUNT(CASE WHEN n.type = 'SHIPMENT_APPROVED' THEN 1 END) as approved_count,
    COUNT(CASE WHEN n.type = 'SHIPMENT_REJECTED' THEN 1 END) as rejected_count
FROM suppliers s
LEFT JOIN profiles p ON s.profile_id = p.id
LEFT JOIN notifications n ON n.recipient_id = p.id
GROUP BY s.id, s.business_name, p.full_name
ORDER BY unread_count DESC;

-- ================================================
-- TEST 5: Check Recent Shipment Submissions with Notifications
-- ================================================
SELECT 
    sm.id as shipment_id,
    sm.status as shipment_status,
    sm.created_at as submitted_at,
    s.business_name as supplier,
    l.name as location,
    COUNT(n.id) as notification_count,
    STRING_AGG(DISTINCT p.full_name, ', ') as notified_admins
FROM stock_movements sm
LEFT JOIN suppliers s ON sm.supplier_id = s.id
LEFT JOIN locations l ON sm.location_id = l.id
LEFT JOIN notifications n ON n.reference_id = sm.id AND n.type = 'SHIPMENT_SUBMITTED'
LEFT JOIN profiles p ON n.recipient_id = p.id
WHERE sm.created_at > NOW() - INTERVAL '7 days'
GROUP BY sm.id, sm.status, sm.created_at, s.business_name, l.name
ORDER BY sm.created_at DESC;

-- ================================================
-- TEST 6: Verify Triggers are Active
-- ================================================
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as is_enabled,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname IN ('trg_notify_shipment', 'trg_notify_shipment_decision')
ORDER BY tgname;

-- ================================================
-- TEST 7: Get Unread Notification Count per User
-- ================================================
SELECT 
    p.full_name,
    p.role,
    COUNT(n.id) as unread_notifications
FROM profiles p
LEFT JOIN notifications n ON n.recipient_id = p.id AND n.is_read = false
GROUP BY p.id, p.full_name, p.role
HAVING COUNT(n.id) > 0
ORDER BY unread_notifications DESC;

-- ================================================
-- TEST 8: Simulate Testing - Manual Notification Creation
-- ================================================
-- Use this to manually test notification creation
-- Replace UUIDs with actual values from your database

/*
-- Example: Create test notification for first admin
SELECT create_notification(
    (SELECT id FROM profiles WHERE role = 'ADMIN' LIMIT 1),
    'SHIPMENT_SUBMITTED',
    'TEST: Pengajuan Pengiriman Baru',
    'Ini adalah test notification. Supplier ABC mengajukan pengiriman.',
    (SELECT id FROM stock_movements LIMIT 1),
    'SHIPMENT'
);
*/

-- ================================================
-- TEST 9: Check Latest Notifications with Full Details
-- ================================================
SELECT 
    n.id,
    n.type,
    n.title,
    n.message,
    n.is_read,
    TO_CHAR(n.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_time,
    p.full_name as recipient,
    p.email as recipient_email,
    p.role as recipient_role,
    CASE 
        WHEN n.reference_type = 'SHIPMENT' THEN 
            (SELECT CONCAT(s.business_name, ' -> ', l.name) 
             FROM stock_movements sm 
             JOIN suppliers s ON sm.supplier_id = s.id 
             JOIN locations l ON sm.location_id = l.id 
             WHERE sm.id = n.reference_id)
        ELSE 'N/A'
    END as shipment_details
FROM notifications n
LEFT JOIN profiles p ON n.recipient_id = p.id
ORDER BY n.created_at DESC
LIMIT 10;

-- ================================================
-- TEST 10: Performance Check - Count Notifications by Type
-- ================================================
SELECT 
    type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN is_read = true THEN 1 END) as read_count,
    COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count,
    MIN(created_at) as first_notification,
    MAX(created_at) as latest_notification
FROM notifications
GROUP BY type
ORDER BY total_count DESC;

-- ================================================
-- CLEANUP (Optional - only if you want to delete test data)
-- ================================================
/*
-- Delete all notifications (WARNING: DESTRUCTIVE)
-- DELETE FROM notifications;

-- Delete only test notifications
-- DELETE FROM notifications WHERE message LIKE '%test%' OR message LIKE '%TEST%';

-- Delete old notifications (older than 30 days)
-- DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
*/
