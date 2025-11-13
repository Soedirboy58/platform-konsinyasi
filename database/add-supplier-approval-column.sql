-- Add is_approved column to suppliers table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'suppliers' 
        AND column_name = 'is_approved'
    ) THEN
        ALTER TABLE suppliers 
        ADD COLUMN is_approved BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Added is_approved column to suppliers table';
    ELSE
        RAISE NOTICE 'Column is_approved already exists in suppliers table';
    END IF;
END $$;

-- Update existing suppliers to approved if needed
-- Comment this out if you want to manually approve each supplier
-- UPDATE suppliers SET is_approved = TRUE WHERE is_approved IS NULL;
