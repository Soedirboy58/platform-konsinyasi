-- ========================================
-- MIGRATION: Add Missing Columns to shipment_returns
-- ========================================
-- Strategy: ALTER TABLE - Preserve existing data
-- Safe: Checks if column exists before adding
-- No duplication: Skips if already exists
-- ========================================

-- STEP 1: Check current structure
DO $$
BEGIN
    RAISE NOTICE '🔍 Checking current table structure...';
END $$;

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'shipment_returns'
ORDER BY ordinal_position;

-- STEP 2: Add missing columns (only if not exists)
DO $$
BEGIN
    -- Add product_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'product_id'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN product_id UUID REFERENCES products(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Added column: product_id';
    ELSE
        RAISE NOTICE '⏭️ Column product_id already exists - skipping';
    END IF;

    -- Add quantity column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'quantity'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0);
        RAISE NOTICE '✅ Added column: quantity';
    ELSE
        RAISE NOTICE '⏭️ Column quantity already exists - skipping';
    END IF;

    -- Add location_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'location_id'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added column: location_id';
    ELSE
        RAISE NOTICE '⏭️ Column location_id already exists - skipping';
    END IF;

    -- Add reason column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'reason'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN reason TEXT NOT NULL DEFAULT 'No reason provided';
        RAISE NOTICE '✅ Added column: reason';
    ELSE
        RAISE NOTICE '⏭️ Column reason already exists - skipping';
    END IF;

    -- Add proof_photos column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'proof_photos'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN proof_photos TEXT[];
        RAISE NOTICE '✅ Added column: proof_photos';
    ELSE
        RAISE NOTICE '⏭️ Column proof_photos already exists - skipping';
    END IF;

    -- Add requested_by column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'requested_by'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added column: requested_by';
    ELSE
        RAISE NOTICE '⏭️ Column requested_by already exists - skipping';
    END IF;

    -- Add requested_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'requested_at'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        RAISE NOTICE '✅ Added column: requested_at';
    ELSE
        RAISE NOTICE '⏭️ Column requested_at already exists - skipping';
    END IF;

    -- Add reviewed_by column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'reviewed_by'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ Added column: reviewed_by';
    ELSE
        RAISE NOTICE '⏭️ Column reviewed_by already exists - skipping';
    END IF;

    -- Add reviewed_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'reviewed_at'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN reviewed_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Added column: reviewed_at';
    ELSE
        RAISE NOTICE '⏭️ Column reviewed_at already exists - skipping';
    END IF;

    -- Add review_notes column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'review_notes'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN review_notes TEXT;
        RAISE NOTICE '✅ Added column: review_notes';
    ELSE
        RAISE NOTICE '⏭️ Column review_notes already exists - skipping';
    END IF;

    -- Add completed_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shipment_returns' AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE shipment_returns 
        ADD COLUMN completed_at TIMESTAMPTZ;
        RAISE NOTICE '✅ Added column: completed_at';
    ELSE
        RAISE NOTICE '⏭️ Column completed_at already exists - skipping';
    END IF;

    RAISE NOTICE '✅ Column migration completed!';
END $$;

-- STEP 3: Show final structure
SELECT 
    '📋 Final table structure:' AS info;

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'shipment_returns'
ORDER BY ordinal_position;

-- STEP 4: Count existing data
SELECT 
    '📊 Existing data preserved:' AS info,
    COUNT(*) as total_records
FROM shipment_returns;

-- ========================================
-- SUMMARY
-- ========================================

SELECT 
    '✅ MIGRATION SUCCESS!' AS status,
    'All missing columns added safely' AS result,
    'No data lost or duplicated' AS guarantee;
