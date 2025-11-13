-- ========================================
-- FIX: Complete confirm_payment Function
-- ========================================
-- Problem: confirm_payment only updates status, doesn't:
--   1. Credit supplier wallets with their revenue
--   2. Create notifications for suppliers about sales
--   3. Create notifications for admin about daily sales
-- ========================================

DROP FUNCTION IF EXISTS confirm_payment(UUID);

CREATE OR REPLACE FUNCTION confirm_payment(
    p_transaction_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_transaction_status TEXT;
    v_location_id UUID;
    v_location_name TEXT;
    v_transaction_code TEXT;
    v_total_amount DECIMAL(15,2);
    v_item RECORD;
    v_supplier_id UUID;
    v_supplier_profile_id UUID;
    v_product_name TEXT;
    v_total_commission DECIMAL(15,2) := 0;
    v_admin_id UUID;
BEGIN
    -- Check transaction exists and is pending
    SELECT 
        st.status, 
        st.location_id, 
        st.transaction_code,
        st.total_amount,
        l.name
    INTO 
        v_transaction_status, 
        v_location_id,
        v_transaction_code,
        v_total_amount,
        v_location_name
    FROM sales_transactions st
    JOIN locations l ON l.id = st.location_id
    WHERE st.id = p_transaction_id;
    
    IF v_transaction_status IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Transaksi tidak ditemukan';
        RETURN;
    END IF;
    
    IF v_transaction_status != 'PENDING' THEN
        RETURN QUERY SELECT FALSE, 'Transaksi sudah diproses';
        RETURN;
    END IF;
    
    -- Update transaction status to completed
    UPDATE sales_transactions
    SET status = 'COMPLETED',
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    -- Process each item: credit wallet + notify supplier
    FOR v_item IN 
        SELECT 
            sti.product_id,
            sti.quantity,
            sti.subtotal,
            sti.supplier_revenue,
            sti.commission_amount,
            p.name AS product_name,
            p.supplier_id,
            s.profile_id
        FROM sales_transaction_items sti
        JOIN products p ON p.id = sti.product_id
        JOIN suppliers s ON s.id = p.supplier_id
        WHERE sti.transaction_id = p_transaction_id
    LOOP
        v_supplier_id := v_item.supplier_id;
        v_supplier_profile_id := v_item.profile_id;
        v_product_name := v_item.product_name;
        v_total_commission := v_total_commission + v_item.commission_amount;
        
        -- Credit supplier wallet
        -- Create wallet if doesn't exist
        INSERT INTO supplier_wallets (supplier_id, available_balance, pending_balance)
        VALUES (v_supplier_id, 0, 0)
        ON CONFLICT (supplier_id) DO NOTHING;
        
        -- Add to available balance
        UPDATE supplier_wallets
        SET available_balance = available_balance + v_item.supplier_revenue,
            updated_at = NOW()
        WHERE supplier_id = v_supplier_id;
        
        -- Create wallet transaction record
        INSERT INTO wallet_transactions (
            wallet_id,
            transaction_type,
            amount,
            description,
            reference_type,
            reference_id
        )
        SELECT 
            sw.id,
            'SALE'::TEXT,
            v_item.supplier_revenue,
            format('Penjualan %s unit "%s" di %s', v_item.quantity, v_product_name, v_location_name),
            'SALE'::TEXT,
            p_transaction_id
        FROM supplier_wallets sw
        WHERE sw.supplier_id = v_supplier_id;
        
        -- Create notification for supplier
        INSERT INTO notifications (
            recipient_id,
            title,
            message,
            type,
            priority,
            action_url,
            metadata
        )
        VALUES (
            v_supplier_profile_id,
            '🎉 Produk Terjual!',
            format('%s unit "%s" terjual di %s. Pendapatan: Rp %s (Komisi platform: Rp %s)', 
                v_item.quantity, 
                v_product_name, 
                v_location_name,
                TRIM(TO_CHAR(v_item.supplier_revenue, '999,999,999')),
                TRIM(TO_CHAR(v_item.commission_amount, '999,999,999'))
            ),
            'SALE',
            'NORMAL',
            format('/supplier/sales-report?code=%s', v_transaction_code),
            jsonb_build_object(
                'transaction_id', p_transaction_id,
                'transaction_code', v_transaction_code,
                'product_name', v_product_name,
                'quantity', v_item.quantity,
                'revenue', v_item.supplier_revenue
            )
        );
    END LOOP;
    
    -- Create notification for ADMIN about new sale
    FOR v_admin_id IN 
        SELECT id FROM profiles WHERE role = 'ADMIN' AND is_active = TRUE
    LOOP
        INSERT INTO notifications (
            recipient_id,
            title,
            message,
            type,
            priority,
            action_url,
            metadata
        )
        VALUES (
            v_admin_id,
            '💰 Transaksi Baru',
            format('Penjualan baru di %s. Total: Rp %s | Komisi platform: Rp %s | Kode: %s', 
                v_location_name,
                TRIM(TO_CHAR(v_total_amount, '999,999,999')),
                TRIM(TO_CHAR(v_total_commission, '999,999,999')),
                v_transaction_code
            ),
            'SALE',
            'NORMAL',
            format('/admin/transactions/%s', p_transaction_id),
            jsonb_build_object(
                'transaction_id', p_transaction_id,
                'transaction_code', v_transaction_code,
                'location_name', v_location_name,
                'total_amount', v_total_amount,
                'commission', v_total_commission
            )
        );
    END LOOP;
    
    RETURN QUERY SELECT TRUE, 'Pembayaran dikonfirmasi. Wallet supplier telah dikreditkan.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION confirm_payment(UUID) TO anon;

-- ========================================
-- VERIFICATION QUERY
-- ========================================
/*
-- After running this, test with a transaction:
SELECT * FROM confirm_payment('YOUR_TRANSACTION_ID'::UUID);

-- Check wallet was credited:
SELECT sw.*, s.business_name
FROM supplier_wallets sw
JOIN suppliers s ON s.id = sw.supplier_id;

-- Check notifications created:
SELECT n.*, p.full_name, p.role
FROM notifications n
JOIN profiles p ON p.id = n.recipient_id
WHERE n.type = 'SALE'
ORDER BY n.created_at DESC
LIMIT 10;

-- Check wallet transactions:
SELECT wt.*, sw.supplier_id
FROM wallet_transactions wt
JOIN supplier_wallets sw ON sw.id = wt.wallet_id
WHERE wt.transaction_type = 'SALE'
ORDER BY wt.created_at DESC
LIMIT 10;
*/

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Fix: confirm_payment now credits wallets and creates notifications - SUCCESS!' AS status;
