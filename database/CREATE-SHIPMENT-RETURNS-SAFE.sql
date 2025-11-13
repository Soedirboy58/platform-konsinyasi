-- ========================================
-- CREATE: Shipment Returns System (SAFE VERSION)
-- ========================================
-- Purpose: Handle manual return requests from admin for damaged/defective products
-- Flow: Admin → Request Return → Supplier Review → Approve/Reject
-- Version: Safe - skips if already exists
-- ========================================

-- STEP 1: Create shipment_returns table (if not exists)
CREATE TABLE IF NOT EXISTS shipment_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Return details
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    
    -- Location info
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    
    -- Return reason
    reason TEXT NOT NULL,
    proof_photos TEXT[], -- Array of image URLs
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING: Waiting supplier approval
    -- APPROVED: Supplier approved, ready for pickup
    -- REJECTED: Supplier rejected the return
    -- COMPLETED: Supplier confirmed received
    -- CANCELLED: Admin cancelled the request
    
    -- Timestamps
    requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    
    review_notes TEXT, -- Supplier notes when approving/rejecting
    
    completed_at TIMESTAMPTZ,
    
    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (skip if exists)
CREATE INDEX IF NOT EXISTS idx_shipment_returns_supplier ON shipment_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_shipment_returns_product ON shipment_returns(product_id);
CREATE INDEX IF NOT EXISTS idx_shipment_returns_status ON shipment_returns(status);
CREATE INDEX IF NOT EXISTS idx_shipment_returns_requested ON shipment_returns(requested_at DESC);

-- Enable RLS
ALTER TABLE shipment_returns ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Admin can view all returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can create returns" ON shipment_returns;
DROP POLICY IF EXISTS "Admin can update pending returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier can view their returns" ON shipment_returns;
DROP POLICY IF EXISTS "Supplier can review returns" ON shipment_returns;

-- RLS Policies
-- Admin can see all returns
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

-- Admin can create returns
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

-- Admin can update their own returns (before reviewed)
CREATE POLICY "Admin can update pending returns"
    ON shipment_returns FOR UPDATE
    TO authenticated
    USING (
        status = 'PENDING'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'ADMIN'
        )
    );

-- Supplier can see their own returns
CREATE POLICY "Supplier can view their returns"
    ON shipment_returns FOR SELECT
    TO authenticated
    USING (
        supplier_id IN (
            SELECT id FROM suppliers
            WHERE profile_id = auth.uid()
        )
    );

-- Supplier can update status of their returns
CREATE POLICY "Supplier can review returns"
    ON shipment_returns FOR UPDATE
    TO authenticated
    USING (
        supplier_id IN (
            SELECT id FROM suppliers
            WHERE profile_id = auth.uid()
        )
    );

-- STEP 2: Create updated_at trigger (drop first if exists)
DROP TRIGGER IF EXISTS trigger_shipment_returns_updated_at ON shipment_returns;

CREATE TRIGGER trigger_shipment_returns_updated_at
    BEFORE UPDATE ON shipment_returns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- STEP 3: Create notification trigger for new return requests
DROP TRIGGER IF EXISTS trigger_notify_supplier_return ON shipment_returns;
DROP FUNCTION IF EXISTS notify_supplier_return_request() CASCADE;

CREATE OR REPLACE FUNCTION notify_supplier_return_request()
RETURNS TRIGGER AS $$
DECLARE
    v_supplier_profile_id UUID;
    v_product_name TEXT;
BEGIN
    -- Get supplier profile_id
    SELECT profile_id INTO v_supplier_profile_id
    FROM suppliers
    WHERE id = NEW.supplier_id;
    
    -- Get product name
    SELECT name INTO v_product_name
    FROM products
    WHERE id = NEW.product_id;
    
    -- Create notification
    IF v_supplier_profile_id IS NOT NULL THEN
        BEGIN
            INSERT INTO notifications (recipient_id, title, message, type)
            VALUES (
                v_supplier_profile_id,
                'Permintaan Retur Produk',
                'Admin mengajukan retur ' || NEW.quantity || 'x ' || v_product_name || '. Alasan: ' || NEW.reason,
                'RETURN_REQUEST'
            );
        EXCEPTION WHEN OTHERS THEN
            -- Ignore notification errors
            RAISE NOTICE 'Notification failed: %', SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_supplier_return
    AFTER INSERT ON shipment_returns
    FOR EACH ROW
    WHEN (NEW.status = 'PENDING')
    EXECUTE FUNCTION notify_supplier_return_request();

-- STEP 4: Create notification trigger for return review
DROP TRIGGER IF EXISTS trigger_notify_admin_return_review ON shipment_returns;
DROP FUNCTION IF EXISTS notify_admin_return_review() CASCADE;

CREATE OR REPLACE FUNCTION notify_admin_return_review()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_id UUID;
    v_product_name TEXT;
    v_status_text TEXT;
BEGIN
    -- Only trigger when status changes from PENDING
    IF OLD.status = 'PENDING' AND NEW.status != 'PENDING' THEN
        -- Get product name
        SELECT name INTO v_product_name
        FROM products
        WHERE id = NEW.product_id;
        
        -- Get requesting admin ID
        v_admin_id := NEW.requested_by;
        
        -- Set status text
        v_status_text := CASE 
            WHEN NEW.status = 'APPROVED' THEN 'menyetujui'
            WHEN NEW.status = 'REJECTED' THEN 'menolak'
            ELSE 'mengupdate'
        END;
        
        -- Create notification to admin
        IF v_admin_id IS NOT NULL THEN
            BEGIN
                INSERT INTO notifications (recipient_id, title, message, type)
                VALUES (
                    v_admin_id,
                    'Review Retur Produk',
                    'Supplier ' || v_status_text || ' retur ' || NEW.quantity || 'x ' || v_product_name || 
                    CASE WHEN NEW.review_notes IS NOT NULL THEN '. Catatan: ' || NEW.review_notes ELSE '' END,
                    'RETURN_REVIEW'
                );
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Notification failed: %', SQLERRM;
            END;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_admin_return_review
    AFTER UPDATE ON shipment_returns
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_return_review();

-- STEP 5: Grant permissions
GRANT SELECT, INSERT, UPDATE ON shipment_returns TO authenticated;

-- ========================================
-- SUMMARY
-- ========================================

SELECT 
    '✅ Shipment Returns System Ready!' AS status,
    'Admin can now request returns for damaged products' AS info;

-- Show table info
SELECT 
    'Table: shipment_returns' AS info,
    COUNT(*) as total_columns
FROM information_schema.columns
WHERE table_name = 'shipment_returns';

-- Show policies
SELECT 
    policyname,
    cmd as operation
FROM pg_policies
WHERE tablename = 'shipment_returns'
ORDER BY policyname;

-- Count existing returns
SELECT 
    'Existing returns:' AS info,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
    COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
    COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed
FROM shipment_returns;
