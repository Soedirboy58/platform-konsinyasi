-- Cek definisi semua trigger functions untuk shipment_returns
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'notify_admin_return_reviewed',
    'notify_supplier_return_request',
    'handle_return_reduce_pending',
    'notify_admin_return_review',
    'update_updated_at_column'
);
