-- ========================================
-- FIX: Complete Self-Checkout System for Kantin
-- ========================================
-- Purpose: Enable anonymous checkout with cash/QRIS payment
-- Creates:
--   1. process_anonymous_checkout() - Create transaction and return QRIS
--   2. confirm_payment_with_method() - Complete transaction with payment method
-- ========================================

-- ========================================
-- PART 1: Create Anonymous Checkout Function
-- ========================================

DROP FUNCTION IF EXISTS process_anonymous_checkout(TEXT, JSONB);

CREATE OR REPLACE FUNCTION process_anonymous_checkout(
    p_location_slug TEXT,  -- This is actually the qr_code from URL
    p_items JSONB  -- Array of {product_id, quantity, price}
)
RETURNS TABLE (
    transaction_id UUID,
    transaction_code TEXT,
    total_amount DECIMAL,
    qris_code TEXT,
    qris_image_url TEXT
) AS $$
DECLARE
    v_location_id UUID;
    v_location_name TEXT;
    v_transaction_id UUID;
    v_transaction_code TEXT;
    v_total_amount DECIMAL(15,2) := 0;
    v_item JSONB;
    v_product RECORD;
    v_subtotal DECIMAL(15,2);
    v_commission_rate DECIMAL(5,2);
    v_qris_code TEXT;
    v_qris_image_url TEXT;
BEGIN
    -- Get location ID from qr_code (slug is actually qr_code in locations table)
    SELECT id, name INTO v_location_id, v_location_name
    FROM locations
    WHERE qr_code = p_location_slug AND is_active = TRUE;
    
    IF v_location_id IS NULL THEN
        RAISE EXCEPTION 'Location not found or inactive: %', p_location_slug;
    END IF;
    
    -- Get commission rate from platform settings (with fallback to 10%)
    BEGIN
        SELECT COALESCE(commission_rate, 10.0) INTO v_commission_rate
        FROM platform_settings
        LIMIT 1;
    EXCEPTION
        WHEN undefined_table OR undefined_column THEN
            v_commission_rate := 10.0;
            RAISE NOTICE 'Using default commission rate: 10%%';
    END;
    
    -- If no platform settings exist, use default 10%
    IF v_commission_rate IS NULL THEN
        v_commission_rate := 10.0;
        RAISE NOTICE 'Using default commission rate: 10%%';
    END IF;
    
    -- Generate transaction code
    v_transaction_code := 'TRX-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                          LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Create sales transaction (PENDING status)
    INSERT INTO sales_transactions (
        location_id,
        transaction_code,
        customer_name,
        total_amount,
        payment_method,
        status,
        created_at
    )
    VALUES (
        v_location_id,
        v_transaction_code,
        'Walk-in Customer',
        0,  -- Will be updated after calculating items
        'PENDING',  -- Will be updated when payment confirmed
        'PENDING',
        NOW()
    )
    RETURNING id INTO v_transaction_id;
    
    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Get product details and check stock
        SELECT 
            p.id,
            p.name,
            p.supplier_id,
            p.price,
            COALESCE(il.quantity, 0) as stock
        INTO v_product
        FROM products p
        LEFT JOIN inventory_levels il ON il.product_id = p.id AND il.location_id = v_location_id
        WHERE p.id = (v_item->>'product_id')::UUID
          AND p.status = 'APPROVED'
          AND p.is_active = TRUE;
        
        IF v_product.id IS NULL THEN
            RAISE EXCEPTION 'Product % not found or inactive', v_item->>'product_id';
        END IF;
        
        -- Check stock availability
        IF v_product.stock < (v_item->>'quantity')::INTEGER THEN
            RAISE EXCEPTION 'Insufficient stock for product %', v_product.name;
        END IF;
        
        -- Calculate amounts
        v_subtotal := v_product.price * (v_item->>'quantity')::INTEGER;
        v_total_amount := v_total_amount + v_subtotal;
        
        -- Create transaction item with commission split
        INSERT INTO sales_transaction_items (
            transaction_id,
            product_id,
            quantity,
            price,
            subtotal,
            commission_amount,
            supplier_revenue
        )
        VALUES (
            v_transaction_id,
            v_product.id,
            (v_item->>'quantity')::INTEGER,
            v_product.price,
            v_subtotal,
            ROUND(v_subtotal * v_commission_rate / 100, 2),  -- Platform commission
            ROUND(v_subtotal * (100 - v_commission_rate) / 100, 2)  -- Supplier revenue
        );
        
        -- Reduce inventory (reserve stock)
        UPDATE inventory_levels
        SET 
            quantity = quantity - (v_item->>'quantity')::INTEGER,
            reserved_quantity = reserved_quantity + (v_item->>'quantity')::INTEGER,
            updated_at = NOW()
        WHERE product_id = v_product.id
          AND location_id = v_location_id;
        
        -- If inventory doesn't exist, create it
        IF NOT FOUND THEN
            RAISE EXCEPTION 'No inventory found for product % at location %', v_product.name, v_location_name;
        END IF;
    END LOOP;
    
    -- Update transaction total
    UPDATE sales_transactions
    SET total_amount = v_total_amount
    WHERE id = v_transaction_id;
    
    -- Get QRIS from location settings
    SELECT qris_code, qris_image_url
    INTO v_qris_code, v_qris_image_url
    FROM locations
    WHERE id = v_location_id;
    
    -- Return transaction details
    RETURN QUERY
    SELECT 
        v_transaction_id,
        v_transaction_code,
        v_total_amount,
        v_qris_code,
        v_qris_image_url;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error
        RAISE NOTICE 'Checkout failed: %. Rolling back transaction.', SQLERRM;
        
        -- PostgreSQL will automatically rollback the transaction on exception
        -- All inventory changes will be reverted
        
        -- Re-raise the exception with user-friendly message
        RAISE EXCEPTION 'Checkout gagal: %. Silakan coba lagi.', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to anonymous users
GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB) TO anon;

-- ========================================
-- PART 2: Enhanced Confirm Payment Function
-- ========================================

DROP FUNCTION IF EXISTS confirm_payment_with_method(UUID, TEXT);

CREATE OR REPLACE FUNCTION confirm_payment_with_method(
    p_transaction_id UUID,
    p_payment_method TEXT DEFAULT 'CASH'  -- CASH, QRIS, EWALLET, TRANSFER
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
    -- Validate payment method
    IF p_payment_method NOT IN ('CASH', 'QRIS', 'EWALLET', 'TRANSFER') THEN
        RETURN QUERY SELECT FALSE, 'Invalid payment method';
        RETURN;
    END IF;
    
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
        RETURN QUERY SELECT FALSE, 'Transaksi sudah diproses atau dibatalkan';
        RETURN;
    END IF;
    
    -- Update transaction status and payment method
    UPDATE sales_transactions
    SET 
        status = 'COMPLETED',
        payment_method = p_payment_method,
        updated_at = NOW()
    WHERE id = p_transaction_id;
    
    -- Move reserved stock to sold (unreserve since payment is confirmed)
    UPDATE inventory_levels il
    SET 
        reserved_quantity = reserved_quantity - sti.quantity,
        updated_at = NOW()
    FROM sales_transaction_items sti
    WHERE sti.transaction_id = p_transaction_id
      AND il.product_id = sti.product_id
      AND il.location_id = v_location_id;
    
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
            s.profile_id,
            s.business_name
        FROM sales_transaction_items sti
        JOIN products p ON p.id = sti.product_id
        JOIN suppliers s ON s.id = p.supplier_id
        WHERE sti.transaction_id = p_transaction_id
    LOOP
        v_supplier_id := v_item.supplier_id;
        v_supplier_profile_id := v_item.profile_id;
        v_product_name := v_item.product_name;
        v_total_commission := v_total_commission + v_item.commission_amount;
        
        -- Create wallet if doesn't exist
        INSERT INTO supplier_wallets (supplier_id, available_balance, pending_balance)
        VALUES (v_supplier_id, 0, 0)
        ON CONFLICT (supplier_id) DO NOTHING;
        
        -- Add to available balance
        UPDATE supplier_wallets
        SET 
            available_balance = available_balance + v_item.supplier_revenue,
            updated_at = NOW()
        WHERE supplier_id = v_supplier_id;
        
        -- Create wallet transaction record
        INSERT INTO wallet_transactions (
            wallet_id,
            transaction_type,
            amount,
            description,
            balance_before,
            balance_after,
            reference_type,
            reference_id,
            created_at
        )
        SELECT 
            sw.id,
            'SALE',
            v_item.supplier_revenue,
            format('Penjualan %s x%s di %s - %s (%s)', 
                v_item.product_name, 
                v_item.quantity,
                v_location_name,
                v_transaction_code,
                p_payment_method
            ),
            sw.available_balance - v_item.supplier_revenue,
            sw.available_balance,
            'SALES_TRANSACTION',
            p_transaction_id,
            NOW()
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
            format('"%s" x%s terjual di %s. Pendapatan Rp %s telah masuk ke dompet Anda. Pembayaran: %s',
                v_item.product_name,
                v_item.quantity,
                v_location_name,
                TO_CHAR(v_item.supplier_revenue, 'FM999,999,999'),
                CASE p_payment_method
                    WHEN 'CASH' THEN 'Tunai'
                    WHEN 'QRIS' THEN 'QRIS'
                    WHEN 'EWALLET' THEN 'E-Wallet'
                    WHEN 'TRANSFER' THEN 'Transfer'
                    ELSE p_payment_method
                END
            ),
            'SALE',
            'NORMAL',
            '/supplier/wallet',
            jsonb_build_object(
                'transaction_id', p_transaction_id,
                'transaction_code', v_transaction_code,
                'product_id', v_item.product_id,
                'quantity', v_item.quantity,
                'revenue', v_item.supplier_revenue,
                'location', v_location_name,
                'payment_method', p_payment_method
            )
        );
        
        RAISE NOTICE 'Credited Rp % to % for %', 
            v_item.supplier_revenue, v_item.business_name, v_item.product_name;
    END LOOP;
    
    -- Notify admins about transaction
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
            format('Transaksi %s senilai Rp %s di %s - Pembayaran: %s. Platform fee: Rp %s',
                v_transaction_code,
                TO_CHAR(v_total_amount, 'FM999,999,999'),
                v_location_name,
                CASE p_payment_method
                    WHEN 'CASH' THEN 'Tunai'
                    WHEN 'QRIS' THEN 'QRIS'
                    WHEN 'EWALLET' THEN 'E-Wallet'
                    WHEN 'TRANSFER' THEN 'Transfer'
                    ELSE p_payment_method
                END,
                TO_CHAR(v_total_commission, 'FM999,999,999')
            ),
            'TRANSACTION',
            'LOW',
            '/admin/transactions',
            jsonb_build_object(
                'transaction_id', p_transaction_id,
                'transaction_code', v_transaction_code,
                'total_amount', v_total_amount,
                'commission', v_total_commission,
                'location', v_location_name,
                'payment_method', p_payment_method
            )
        );
    END LOOP;
    
    RETURN QUERY SELECT 
        TRUE, 
        format('✅ Pembayaran %s berhasil! Kode: %s', 
            CASE p_payment_method
                WHEN 'CASH' THEN 'Tunai'
                WHEN 'QRIS' THEN 'QRIS'
                WHEN 'EWALLET' THEN 'E-Wallet'
                WHEN 'TRANSFER' THEN 'Transfer'
                ELSE p_payment_method
            END,
            v_transaction_code
        );
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to anonymous users
GRANT EXECUTE ON FUNCTION confirm_payment_with_method(UUID, TEXT) TO anon;

-- ========================================
-- PART 3: Backward Compatibility - Keep Old Function
-- ========================================

-- Keep old confirm_payment for backward compatibility
-- But now it calls the new function with default CASH
DROP FUNCTION IF EXISTS confirm_payment(UUID);

CREATE OR REPLACE FUNCTION confirm_payment(
    p_transaction_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
BEGIN
    -- Call new function with CASH as default
    RETURN QUERY
    SELECT * FROM confirm_payment_with_method(p_transaction_id, 'CASH');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION confirm_payment(UUID) TO anon;

-- ========================================
-- PART 4: Verify Setup
-- ========================================

DO $$ 
BEGIN
    RAISE NOTICE 'Self-checkout system configured!';
    RAISE NOTICE 'Functions created:';
    RAISE NOTICE '   1. process_anonymous_checkout(location_slug, items)';
    RAISE NOTICE '   2. confirm_payment_with_method(transaction_id, payment_method)';
    RAISE NOTICE '   3. confirm_payment(transaction_id) - backward compatible';
    RAISE NOTICE '';
    RAISE NOTICE 'Payment methods supported: CASH, QRIS, EWALLET, TRANSFER';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '   - Automatic stock reservation';
    RAISE NOTICE '   - Commission calculation (10%%)';
    RAISE NOTICE '   - Wallet crediting for suppliers';
    RAISE NOTICE '   - Notifications for suppliers and admins';
    RAISE NOTICE '   - QRIS code retrieval from location';
END $$;

-- Show function signatures
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_name IN ('process_anonymous_checkout', 'confirm_payment_with_method', 'confirm_payment')
ORDER BY routine_name;

SELECT 'Self-checkout system ready! Frontend can now process cash and QRIS payments.' AS status;
