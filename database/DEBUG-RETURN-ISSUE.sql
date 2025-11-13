-- ========================================
-- DEBUG: Check What's Actually Happening
-- ========================================
-- Jalankan ini untuk debug kenapa data tidak muncul
-- ========================================

-- Step 1: Check if data was inserted
SELECT 
    '1️⃣ CHECK: Ada data di shipment_returns?' AS step;

SELECT 
    id,
    supplier_id,
    product_id,
    quantity,
    reason,
    status,
    requested_at,
    requested_by
FROM shipment_returns
ORDER BY requested_at DESC
LIMIT 5;

-- Step 2: Check RLS policies blocking supplier?
SELECT 
    '2️⃣ CHECK: RLS Policies untuk supplier' AS step;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'shipment_returns'
  AND policyname LIKE '%Supplier%';

-- Step 3: Test supplier can see data (simulation)
SELECT 
    '3️⃣ CHECK: Query yang digunakan frontend supplier' AS step;

-- This simulates what frontend does
-- Replace 'YOUR_SUPPLIER_ID' with actual supplier ID from database
SELECT 
    sr.id,
    sr.product_id,
    sr.quantity,
    sr.reason,
    sr.location_id,
    sr.status,
    sr.requested_at,
    sr.reviewed_at,
    sr.review_notes,
    p.name as product_name,
    p.photo_url,
    l.name as location_name,
    s.id as supplier_id,
    s.business_name
FROM shipment_returns sr
JOIN products p ON p.id = sr.product_id
JOIN suppliers s ON s.id = sr.supplier_id
LEFT JOIN locations l ON l.id = sr.location_id
ORDER BY sr.requested_at DESC;

-- Step 4: Check supplier profile_id mapping
SELECT 
    '4️⃣ CHECK: Supplier profile mapping' AS step;

SELECT 
    s.id as supplier_id,
    s.business_name,
    s.profile_id,
    p.full_name as supplier_name,
    p.role
FROM suppliers s
JOIN profiles p ON p.id = s.profile_id
LIMIT 5;

-- Step 5: Count returns per supplier
SELECT 
    '5️⃣ CHECK: Jumlah retur per supplier' AS step;

SELECT 
    s.business_name,
    s.id as supplier_id,
    COUNT(sr.id) as total_returns,
    COUNT(CASE WHEN sr.status = 'PENDING' THEN 1 END) as pending_returns
FROM suppliers s
LEFT JOIN shipment_returns sr ON sr.supplier_id = s.id
GROUP BY s.id, s.business_name
ORDER BY total_returns DESC;

-- Step 6: Check if notifications were created
SELECT 
    '6️⃣ CHECK: Notifications untuk supplier' AS step;

SELECT 
    n.id,
    n.recipient_id,
    n.title,
    n.message,
    n.type,
    n.read,
    n.created_at,
    p.full_name as recipient_name
FROM notifications n
JOIN profiles p ON p.id = n.recipient_id
WHERE n.type = 'RETURN_REQUEST'
ORDER BY n.created_at DESC
LIMIT 5;

-- SUMMARY
SELECT 
    '═══════════════════════════════════════' AS line,
    'DEBUG SUMMARY' AS title;

SELECT 
    (SELECT COUNT(*) FROM shipment_returns) as total_returns_in_db,
    (SELECT COUNT(*) FROM shipment_returns WHERE status = 'PENDING') as pending_returns,
    (SELECT COUNT(*) FROM suppliers) as total_suppliers,
    (SELECT COUNT(*) FROM notifications WHERE type = 'RETURN_REQUEST') as return_notifications;
