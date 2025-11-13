-- ========================================
-- FIX: Supplier Payment Error
-- ========================================
-- Jalankan ini jika ada error saat klik "Bayar" di admin
-- Error umum: RLS policy, table not exist, constraint violation
-- ========================================

-- 1. Cek apakah table supplier_payments sudah ada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'supplier_payments'
    ) THEN
        RAISE NOTICE '❌ Table supplier_payments BELUM ADA - Jalankan create-supplier-payment-table.sql dulu!';
    ELSE
        RAISE NOTICE '✅ Table supplier_payments sudah ada';
    END IF;
END $$;

-- 2. Cek apakah RLS policy untuk admin sudah ada
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'supplier_payments'
ORDER BY policyname;

-- 3. Test INSERT permission untuk user admin saat ini
DO $$
DECLARE
    v_user_id UUID;
    v_role TEXT;
    v_is_active BOOLEAN;
    v_column_exists BOOLEAN;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE '❌ User belum login!';
        RETURN;
    END IF;
    
    -- Check if is_active column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'is_active'
    ) INTO v_column_exists;
    
    -- Check role (with optional is_active)
    IF v_column_exists THEN
        SELECT role, is_active 
        INTO v_role, v_is_active
        FROM profiles 
        WHERE id = v_user_id;
    ELSE
        SELECT role 
        INTO v_role
        FROM profiles 
        WHERE id = v_user_id;
        v_is_active := TRUE; -- Assume active if column doesn't exist
    END IF;
    
    RAISE NOTICE '📋 Current User Info:';
    RAISE NOTICE '   User ID: %', v_user_id;
    RAISE NOTICE '   Role: %', v_role;
    RAISE NOTICE '   Active: %', v_is_active;
    RAISE NOTICE '   Column is_active exists: %', v_column_exists;
    
    IF v_role = 'ADMIN' THEN
        IF v_is_active = TRUE OR NOT v_column_exists THEN
            RAISE NOTICE '✅ User memiliki akses sebagai ADMIN';
        ELSE
            RAISE NOTICE '❌ User ADMIN tapi tidak aktif (is_active = false)';
        END IF;
    ELSE
        RAISE NOTICE '❌ User BUKAN admin (role: %) - tidak bisa insert payment', v_role;
    END IF;
END $$;

-- 4. Cek supplier_wallets (required for foreign key)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'supplier_wallets'
    ) THEN
        RAISE NOTICE '⚠️ Table supplier_wallets BELUM ADA - wallet_id akan NULL';
    ELSE
        RAISE NOTICE '✅ Table supplier_wallets ada';
        
        -- Count wallets
        DECLARE
            v_wallet_count INT;
        BEGIN
            SELECT COUNT(*) INTO v_wallet_count FROM supplier_wallets;
            RAISE NOTICE '   Total wallets: %', v_wallet_count;
        END;
    END IF;
END $$;

-- ========================================
-- QUICK FIX: Re-create RLS policies jika error
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can view all supplier payments" ON supplier_payments;
DROP POLICY IF EXISTS "Admin can insert supplier payments" ON supplier_payments;
DROP POLICY IF EXISTS "Admin can update supplier payments" ON supplier_payments;

-- Check if is_active column exists before using it in policies
DO $$
DECLARE
    v_has_is_active BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'is_active'
    ) INTO v_has_is_active;
    
    IF v_has_is_active THEN
        -- Create policies WITH is_active check
        EXECUTE '
        CREATE POLICY "Admin can view all supplier payments"
            ON supplier_payments FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = ''ADMIN''
                    AND profiles.is_active = TRUE
                )
            )';
        
        EXECUTE '
        CREATE POLICY "Admin can insert supplier payments"
            ON supplier_payments FOR INSERT
            TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = ''ADMIN''
                    AND profiles.is_active = TRUE
                )
            )';
        
        EXECUTE '
        CREATE POLICY "Admin can update supplier payments"
            ON supplier_payments FOR UPDATE
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = ''ADMIN''
                    AND profiles.is_active = TRUE
                )
            )';
        
        RAISE NOTICE '✅ RLS policies created WITH is_active check';
    ELSE
        -- Create policies WITHOUT is_active check
        EXECUTE '
        CREATE POLICY "Admin can view all supplier payments"
            ON supplier_payments FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = ''ADMIN''
                )
            )';
        
        EXECUTE '
        CREATE POLICY "Admin can insert supplier payments"
            ON supplier_payments FOR INSERT
            TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = ''ADMIN''
                )
            )';
        
        EXECUTE '
        CREATE POLICY "Admin can update supplier payments"
            ON supplier_payments FOR UPDATE
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = ''ADMIN''
                )
            )';
        
        RAISE NOTICE '✅ RLS policies created WITHOUT is_active check (column does not exist)';
    END IF;
END $$;

-- ========================================
-- TEST INSERT
-- ========================================

-- Coba insert dummy data (akan rollback)
DO $$
DECLARE
    v_supplier_id UUID;
    v_user_id UUID;
BEGIN
    -- Get first supplier
    SELECT id INTO v_supplier_id FROM suppliers LIMIT 1;
    
    IF v_supplier_id IS NULL THEN
        RAISE NOTICE '❌ Tidak ada supplier di database!';
        RETURN;
    END IF;
    
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE '❌ User belum login - skip test insert';
        RETURN;
    END IF;
    
    -- Try insert
    BEGIN
        INSERT INTO supplier_payments (
            supplier_id,
            amount,
            payment_reference,
            payment_date,
            payment_method,
            status,
            created_by
        ) VALUES (
            v_supplier_id,
            100000,
            'TEST-' || to_char(NOW(), 'YYYYMMDD-HH24MISS'),
            CURRENT_DATE,
            'BANK_TRANSFER',
            'COMPLETED',
            v_user_id
        );
        
        RAISE NOTICE '✅ TEST INSERT berhasil!';
        
        -- Rollback test data
        ROLLBACK;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ TEST INSERT gagal: %', SQLERRM;
    END;
END $$;

-- ========================================
-- SUMMARY
-- ========================================

SELECT 
    '✅ Diagnostic selesai. Lihat output di atas untuk status.' AS summary;

