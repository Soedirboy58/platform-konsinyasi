-- =====================================================
-- RPC FUNCTIONS for Customer Report Notifications
-- =====================================================
-- Functions to send notifications when customer submits report
-- =====================================================

-- Function: Notify Admin of new customer report
CREATE OR REPLACE FUNCTION notify_admin_customer_report(
    p_return_id UUID,
    p_product_name TEXT,
    p_severity VARCHAR(20)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_ids UUID[];
    v_admin_id UUID;
BEGIN
    -- Get all admin profile IDs
    SELECT ARRAY_AGG(id) INTO v_admin_ids
    FROM profiles
    WHERE role = 'ADMIN';

    -- Send notification to each admin
    FOREACH v_admin_id IN ARRAY v_admin_ids
    LOOP
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            link,
            created_at
        ) VALUES (
            v_admin_id,
            'CUSTOMER_REPORT',
            'Laporan Produk Bermasalah dari Customer',
            format('Customer melaporkan masalah (%s) pada produk: %s', p_severity, p_product_name),
            '/admin/suppliers/shipments?tab=returns',
            NOW()
        );
    END LOOP;

    RAISE NOTICE 'Admin notifications sent for return %', p_return_id;
END;
$$;

-- Function: Notify Supplier of customer report
CREATE OR REPLACE FUNCTION notify_supplier_customer_report(
    p_return_id UUID,
    p_supplier_id UUID,
    p_product_name TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_supplier_profile_id UUID;
BEGIN
    -- Get supplier's profile ID
    SELECT profile_id INTO v_supplier_profile_id
    FROM suppliers
    WHERE id = p_supplier_id;

    IF v_supplier_profile_id IS NULL THEN
        RAISE NOTICE 'Supplier profile not found for supplier %', p_supplier_id;
        RETURN;
    END IF;

    -- Send notification to supplier
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        link,
        created_at
    ) VALUES (
        v_supplier_profile_id,
        'CUSTOMER_REPORT',
        'Customer Melaporkan Masalah Produk',
        format('Customer melaporkan masalah pada produk Anda: %s. Admin akan menindaklanjuti.', p_product_name),
        '/supplier/shipments?tab=returns',
        NOW()
    );

    RAISE NOTICE 'Supplier notification sent for return %', p_return_id;
END;
$$;

-- Verify functions created
SELECT 
    '✅ RPC Functions Created' as status,
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('notify_admin_customer_report', 'notify_supplier_customer_report')
ORDER BY proname;

-- =====================================================
-- USAGE EXAMPLE
-- =====================================================
-- After inserting shipment_returns with source='CUSTOMER':
-- 
-- SELECT notify_admin_customer_report(
--     '<return_id>',
--     'Pastel Ayam',
--     'HIGH'
-- );
--
-- SELECT notify_supplier_customer_report(
--     '<return_id>',
--     '<supplier_id>',
--     'Pastel Ayam'
-- );
-- =====================================================
