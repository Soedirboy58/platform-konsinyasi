-- ========================================
-- VERIFY: Check Return System Installation
-- ========================================
-- Jalankan ini untuk cek apakah system sudah terinstall
-- ========================================

-- Check 1: Table exists?
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipment_returns')
        THEN '✅ Table shipment_returns EXISTS'
        ELSE '❌ Table shipment_returns NOT FOUND - RUN SETUP-RETURN-SYSTEM-COMPLETE.sql!'
    END AS table_status;

-- Check 2: All columns exist?
SELECT 
    '📋 Current columns in shipment_returns:' AS info;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'shipment_returns'
ORDER BY ordinal_position;

-- Check 3: RPC Functions exist?
SELECT 
    '⚡ RPC Functions:' AS info;

SELECT 
    routine_name,
    CASE 
        WHEN routine_name = 'approve_return_request' THEN '✅ Found'
        WHEN routine_name = 'reject_return_request' THEN '✅ Found'
        WHEN routine_name = 'confirm_return_pickup' THEN '✅ Found'
        WHEN routine_name = 'cancel_return_request' THEN '✅ Found'
        ELSE '?' 
    END AS status
FROM information_schema.routines
WHERE routine_name IN (
    'approve_return_request',
    'reject_return_request', 
    'confirm_return_pickup',
    'cancel_return_request'
)
ORDER BY routine_name;

-- Check 4: Policies exist?
SELECT 
    '🔒 RLS Policies:' AS info;

SELECT 
    policyname,
    cmd,
    '✅ Active' AS status
FROM pg_policies
WHERE tablename = 'shipment_returns'
ORDER BY policyname;

-- Check 5: Triggers exist?
SELECT 
    '🔔 Triggers:' AS info;

SELECT 
    trigger_name,
    event_manipulation,
    '✅ Active' AS status
FROM information_schema.triggers
WHERE event_object_table = 'shipment_returns'
ORDER BY trigger_name;

-- FINAL VERDICT
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipment_returns')
        AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'approve_return_request')
        AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipment_returns')
        THEN '🎉 RETURN SYSTEM FULLY INSTALLED - Ready to use!'
        ELSE '⚠️  INCOMPLETE INSTALLATION - Run SETUP-RETURN-SYSTEM-COMPLETE.sql'
    END AS final_verdict;
