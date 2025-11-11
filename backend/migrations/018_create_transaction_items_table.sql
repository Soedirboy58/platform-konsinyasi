-- ========================================
-- Migration: Create sales_transaction_items Table
-- ========================================
-- Description: Table for storing line items in kantin checkout
-- Execute: After migration 017
-- ========================================

-- Create table
CREATE TABLE IF NOT EXISTS sales_transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(15,2) NOT NULL CHECK (price > 0),
    subtotal DECIMAL(15,2) NOT NULL CHECK (subtotal > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction 
ON sales_transaction_items(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_product 
ON sales_transaction_items(product_id);

-- Add comments
COMMENT ON TABLE sales_transaction_items IS 'Line items for kantin checkout transactions';
COMMENT ON COLUMN sales_transaction_items.transaction_id IS 'Reference to parent transaction';
COMMENT ON COLUMN sales_transaction_items.product_id IS 'Product purchased';
COMMENT ON COLUMN sales_transaction_items.quantity IS 'Quantity purchased';
COMMENT ON COLUMN sales_transaction_items.price IS 'Price per unit at time of purchase';
COMMENT ON COLUMN sales_transaction_items.subtotal IS 'quantity * price';

-- ========================================
-- RLS POLICIES
-- ========================================

-- Enable RLS
ALTER TABLE sales_transaction_items ENABLE ROW LEVEL SECURITY;

-- Allow anonymous to insert items
CREATE POLICY "sales_transaction_items_anonymous_insert" 
ON sales_transaction_items
FOR INSERT 
TO anon
WITH CHECK (true);

-- Allow anonymous to read items
CREATE POLICY "sales_transaction_items_anonymous_select" 
ON sales_transaction_items
FOR SELECT 
TO anon
USING (true);

-- ========================================
-- VERIFICATION
-- ========================================

-- Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'sales_transaction_items'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'sales_transaction_items';

-- Check RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'sales_transaction_items';

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 018: sales_transaction_items table created - SUCCESS!' AS status;
