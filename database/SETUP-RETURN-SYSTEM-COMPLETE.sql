-- ========================================
-- COMPLETE RETURN SYSTEM SETUP
-- ========================================
-- Gabungan 3 file migration dalam 1 file
-- Jalankan file ini SATU KALI saja di Supabase SQL Editor
-- ========================================

-- ========================================
-- PART 1: Add Missing Columns
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '🚀 Starting Return System Setup...';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PART 1: Checking table structure...';
END $$;

-- Check if table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipment_returns') THEN
        RAISE NOTICE '⚠️  Table shipment_returns does not exist!';
        RAISE NOTICE '   Creating table first...';
        
        CREATE TABLE shipment_returns (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        RAISE NOTICE '✅ Table created!';
    ELSE
        RAISE NOTICE '✅ Table shipment_returns exists';
    END IF;
END $$;

-- Add missing columns
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📝 Adding missing columns...';
    
    -- Add product_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'product_id'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN product_id UUID REFERENCES products(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added: product_id';
    ELSE
        RAISE NOTICE '⏭️  Skip: product_id (exists)';
    END IF;

    -- Add quantity column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'quantity'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0);
        RAISE NOTICE '✅ Added: quantity';
    ELSE
        RAISE NOTICE '⏭️  Skip: quantity (exists)';
    END IF;

    -- Add location_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'location_id'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added: location_id';
    ELSE
        RAISE NOTICE '⏭️  Skip: location_id (exists)';
    END IF;

    -- Add reason column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'reason'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN reason TEXT NOT NULL DEFAULT 'No reason provided';
        RAISE NOTICE '✅ Added: reason';
    ELSE
        RAISE NOTICE '⏭️  Skip: reason (exists)';
    END IF;

    -- Add proof_photos column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'proof_photos'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN proof_photos TEXT[];
        RAISE NOTICE '✅ Added: proof_photos';
    ELSE
        RAISE NOTICE '⏭️  Skip: proof_photos (exists)';
    END IF;

    -- Add requested_by column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'requested_by'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added: requested_by';
    ELSE
        RAISE NOTICE '⏭️  Skip: requested_by (exists)';
    END IF;

    -- Add requested_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'requested_at'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        RAISE NOTICE '✅ Added: requested_at';
    ELSE
        RAISE NOTICE '⏭️  Skip: requested_at (exists)';
    END IF;

    -- Add reviewed_by column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'reviewed_by'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added: reviewed_by';
    ELSE
        RAISE NOTICE '⏭️  Skip: reviewed_by (exists)';
    END IF;

    -- Add reviewed_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'reviewed_at'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN reviewed_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Added: reviewed_at';
    ELSE
        RAISE NOTICE '⏭️  Skip: reviewed_at (exists)';
    END IF;

    -- Add review_notes column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'review_notes'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN review_notes TEXT;
        RAISE NOTICE '✅ Added: review_notes';
    ELSE
        RAISE NOTICE '⏭️  Skip: review_notes (exists)';
    END IF;

    -- Add completed_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN completed_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Added: completed_at';
    ELSE
        RAISE NOTICE '⏭️  Skip: completed_at (exists)';
    END IF;
END $$;

-- ========================================
-- PART 2: Create Indexes
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 PART 2: Creating indexes...';
END $$;

CREATE INDEX IF NOT EXISTS idx_shipment_returns_supplier ON shipment_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_shipment_returns_product ON shipment_returns(product_id);
CREATE INDEX IF NOT EXISTS idx_shipment_returns_status ON shipment_returns(status);
CREATE INDEX IF NOT EXISTS idx_shipment_returns_location ON shipment_returns(location_id);

DO $$
BEGIN
    RAISE NOTICE '✅ Indexes created!';
END $$;

-- ========================================
-- PART 3: RLS Policies
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔒 PART 3: Setting up RLS policies...';
END $$;

-- Enable RLS
ALTER TABLE shipment_returns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin can view all returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can create returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can update pending returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier can view own returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier can review own returns" ON shipment_returns;

-- Admin policies
CREATE POLICY "Admin can view all returns"
ON shipment_returns FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
    )
);

CREATE POLICY "Admin can create returns"
ON shipment_returns FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
    )
);

CREATE POLICY "Admin can update pending returns"
ON shipment_returns FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
    )
);

-- Supplier policies
CREATE POLICY "Supplier can view own returns"
ON shipment_returns FOR SELECT
TO authenticated
USING (
    supplier_id IN (
        SELECT id FROM suppliers
        WHERE profile_id = auth.uid()
    )
);

CREATE POLICY "Supplier can review own returns"
ON shipment_returns FOR UPDATE
TO authenticated
USING (
    supplier_id IN (
        SELECT id FROM suppliers
        WHERE profile_id = auth.uid()
    )
    AND status = 'PENDING'
);

DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies created!';
END $$;

-- ========================================
-- PART 4: Notification Triggers
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔔 PART 4: Creating notification triggers...';
END $$;

-- Drop existing triggers
DROP TRIGGER IF EXISTS notify_supplier_on_return_request ON shipment_returns;
DROP TRIGGER IF EXISTS notify_admin_on_return_reviewed ON shipment_returns;
DROP FUNCTION IF EXISTS notify_supplier_return_request();
DROP FUNCTION IF EXISTS notify_admin_return_reviewed();

-- Function: Notify supplier on new return request
CREATE OR REPLACE FUNCTION notify_supplier_return_request()
RETURNS TRIGGER AS $$
DECLARE
    v_supplier_profile_id UUID;
    v_product_name TEXT;
    v_admin_name TEXT;
BEGIN
    -- Get supplier profile_id
    SELECT profile_id INTO v_supplier_profile_id
    FROM suppliers
    WHERE id = NEW.supplier_id;
    
    -- Get product name
    SELECT name INTO v_product_name
    FROM products
    WHERE id = NEW.product_id;
    
    -- Get admin name
    SELECT full_name INTO v_admin_name
    FROM profiles
    WHERE id = NEW.requested_by;
    
    -- Insert notification
    IF v_supplier_profile_id IS NOT NULL THEN
        INSERT INTO notifications (
            recipient_id,
            title,
            message,
            type,
            entity_type,
            entity_id
        ) VALUES (
            v_supplier_profile_id,
            'Permintaan Retur Produk',
            format('%s mengajukan retur %s pcs %s. Alasan: %s', 
                COALESCE(v_admin_name, 'Admin'),
                NEW.quantity,
                COALESCE(v_product_name, 'produk'),
                NEW.reason
            ),
            'RETURN_REQUEST',
            'SHIPMENT_RETURN',
            NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Notify admin on return reviewed
CREATE OR REPLACE FUNCTION notify_admin_return_reviewed()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id UUID;
    v_product_name TEXT;
    v_supplier_name TEXT;
BEGIN
    -- Only trigger on status change to APPROVED or REJECTED
    IF NEW.status IN ('APPROVED', 'REJECTED') AND OLD.status = 'PENDING' THEN
        -- Get product name
        SELECT name INTO v_product_name
        FROM products
        WHERE id = NEW.product_id;
        
        -- Get supplier name
        SELECT business_name INTO v_supplier_name
        FROM suppliers
        WHERE id = NEW.supplier_id;
        
        -- Get admin who requested
        v_admin_id := NEW.requested_by;
        
        -- Insert notification
        IF v_admin_id IS NOT NULL THEN
            INSERT INTO notifications (
                recipient_id,
                title,
                message,
                type,
                entity_type,
                entity_id
            ) VALUES (
                v_admin_id,
                CASE 
                    WHEN NEW.status = 'APPROVED' THEN 'Retur Disetujui'
                    ELSE 'Retur Ditolak'
                END,
                format('%s %s retur %s pcs %s. Catatan: %s',
                    COALESCE(v_supplier_name, 'Supplier'),
                    CASE WHEN NEW.status = 'APPROVED' THEN 'menyetujui' ELSE 'menolak' END,
                    NEW.quantity,
                    COALESCE(v_product_name, 'produk'),
                    COALESCE(NEW.review_notes, '-')
                ),
                CASE 
                    WHEN NEW.status = 'APPROVED' THEN 'RETURN_APPROVED'
                    ELSE 'RETURN_REJECTED'
                END,
                'SHIPMENT_RETURN',
                NEW.id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER notify_supplier_on_return_request
    AFTER INSERT ON shipment_returns
    FOR EACH ROW
    EXECUTE FUNCTION notify_supplier_return_request();

CREATE TRIGGER notify_admin_on_return_reviewed
    AFTER UPDATE ON shipment_returns
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_return_reviewed();

DO $$
BEGIN
    RAISE NOTICE '✅ Notification triggers created!';
END $$;

-- ========================================
-- PART 5: RPC Functions
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '⚡ PART 5: Creating RPC functions...';
END $$;

-- Function 1: Supplier approve return request
CREATE OR REPLACE FUNCTION approve_return_request(
    p_return_id UUID,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
    v_supplier_id UUID;
BEGIN
    -- Get return info
    SELECT * INTO v_return
    FROM shipment_returns
    WHERE id = p_return_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found';
    END IF;
    
    -- Check status
    IF v_return.status != 'PENDING' THEN
        RAISE EXCEPTION 'Return request already reviewed';
    END IF;
    
    -- Get current supplier
    SELECT id INTO v_supplier_id
    FROM suppliers
    WHERE profile_id = auth.uid();
    
    IF v_supplier_id IS NULL THEN
        RAISE EXCEPTION 'Supplier not found';
    END IF;
    
    -- Check ownership
    IF v_return.supplier_id != v_supplier_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    -- Update return status
    UPDATE shipment_returns
    SET 
        status = 'APPROVED',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_notes = p_review_notes
    WHERE id = p_return_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Return request approved',
        'return_id', p_return_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Supplier reject return request
CREATE OR REPLACE FUNCTION reject_return_request(
    p_return_id UUID,
    p_review_notes TEXT
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
    v_supplier_id UUID;
BEGIN
    -- Validate review notes
    IF p_review_notes IS NULL OR trim(p_review_notes) = '' THEN
        RAISE EXCEPTION 'Rejection reason is required';
    END IF;
    
    -- Get return info
    SELECT * INTO v_return
    FROM shipment_returns
    WHERE id = p_return_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found';
    END IF;
    
    -- Check status
    IF v_return.status != 'PENDING' THEN
        RAISE EXCEPTION 'Return request already reviewed';
    END IF;
    
    -- Get current supplier
    SELECT id INTO v_supplier_id
    FROM suppliers
    WHERE profile_id = auth.uid();
    
    IF v_supplier_id IS NULL THEN
        RAISE EXCEPTION 'Supplier not found';
    END IF;
    
    -- Check ownership
    IF v_return.supplier_id != v_supplier_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    -- Update return status
    UPDATE shipment_returns
    SET 
        status = 'REJECTED',
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        review_notes = p_review_notes
    WHERE id = p_return_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Return request rejected',
        'return_id', p_return_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 3: Supplier confirm return received (product picked up)
CREATE OR REPLACE FUNCTION confirm_return_pickup(
    p_return_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
    v_supplier_id UUID;
BEGIN
    -- Get return info
    SELECT * INTO v_return
    FROM shipment_returns
    WHERE id = p_return_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found';
    END IF;
    
    -- Check status
    IF v_return.status != 'APPROVED' THEN
        RAISE EXCEPTION 'Return must be APPROVED first';
    END IF;
    
    -- Get current supplier
    SELECT id INTO v_supplier_id
    FROM suppliers
    WHERE profile_id = auth.uid();
    
    IF v_supplier_id IS NULL THEN
        RAISE EXCEPTION 'Supplier not found';
    END IF;
    
    -- Check ownership
    IF v_return.supplier_id != v_supplier_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    -- Update return status
    UPDATE shipment_returns
    SET 
        status = 'COMPLETED',
        completed_at = NOW()
    WHERE id = p_return_id;
    
    -- Reduce inventory at location
    IF v_return.location_id IS NOT NULL THEN
        BEGIN
            UPDATE inventory_levels
            SET quantity = quantity - v_return.quantity
            WHERE product_id = v_return.product_id
            AND location_id = v_return.location_id
            AND quantity >= v_return.quantity;
            
            IF NOT FOUND THEN
                RAISE NOTICE 'Could not reduce inventory - insufficient stock';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Inventory reduction failed: %', SQLERRM;
        END;
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Return completed - product picked up',
        'return_id', p_return_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 4: Admin cancel return request
CREATE OR REPLACE FUNCTION cancel_return_request(
    p_return_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_return RECORD;
BEGIN
    -- Check admin role
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'ADMIN'
    ) THEN
        RAISE EXCEPTION 'Unauthorized - admin only';
    END IF;
    
    -- Get return info
    SELECT * INTO v_return
    FROM shipment_returns
    WHERE id = p_return_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Return request not found';
    END IF;
    
    -- Can only cancel PENDING or APPROVED
    IF v_return.status NOT IN ('PENDING', 'APPROVED') THEN
        RAISE EXCEPTION 'Cannot cancel return with status %', v_return.status;
    END IF;
    
    -- Update return status
    UPDATE shipment_returns
    SET 
        status = 'CANCELLED',
        updated_at = NOW()
    WHERE id = p_return_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Return request cancelled',
        'return_id', p_return_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION approve_return_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_return_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_return_pickup(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_return_request(UUID) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE '✅ RPC functions created!';
END $$;

-- ========================================
-- FINAL: Summary
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE '✅ RETURN SYSTEM SETUP COMPLETE!';
    RAISE NOTICE '═══════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Summary:';
    RAISE NOTICE '   ✓ Table structure updated';
    RAISE NOTICE '   ✓ Indexes created';
    RAISE NOTICE '   ✓ RLS policies active';
    RAISE NOTICE '   ✓ Notification triggers ready';
    RAISE NOTICE '   ✓ RPC functions available';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next Steps:';
    RAISE NOTICE '   1. Test admin: /admin/returns/create';
    RAISE NOTICE '   2. Test supplier: Management Pengiriman → Retur';
    RAISE NOTICE '   3. Check sync: Admin → Supplier → Admin';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════';
END $$;

-- Show final table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'shipment_returns'
ORDER BY ordinal_position;
