-- Cek semua triggers di tabel shipment_returns
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'shipment_returns'
AND trigger_schema = 'public';

-- Cek function yang dipanggil oleh trigger
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%return%'
AND p.proname LIKE '%trigger%';
