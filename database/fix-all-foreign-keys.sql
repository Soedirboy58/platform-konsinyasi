-- ========================================
-- FIX ALL FOREIGN KEYS: Stock Movements
-- ========================================

-- STEP 1: Drop existing constraints (jika ada)
ALTER TABLE stock_movements 
DROP CONSTRAINT IF EXISTS stock_movements_supplier_id_fkey;

ALTER TABLE stock_movements 
DROP CONSTRAINT IF EXISTS stock_movements_location_id_fkey;

ALTER TABLE stock_movement_items 
DROP CONSTRAINT IF EXISTS stock_movement_items_movement_id_fkey;

ALTER TABLE stock_movement_items 
DROP CONSTRAINT IF EXISTS stock_movement_items_product_id_fkey;

-- STEP 2: Create ALL foreign keys

-- 1. stock_movements → suppliers
ALTER TABLE stock_movements
ADD CONSTRAINT stock_movements_supplier_id_fkey
FOREIGN KEY (supplier_id)
REFERENCES suppliers(id)
ON DELETE CASCADE;

-- 2. stock_movements → locations
ALTER TABLE stock_movements
ADD CONSTRAINT stock_movements_location_id_fkey
FOREIGN KEY (location_id)
REFERENCES locations(id)
ON DELETE CASCADE;

-- 3. stock_movement_items → stock_movements
ALTER TABLE stock_movement_items
ADD CONSTRAINT stock_movement_items_movement_id_fkey
FOREIGN KEY (movement_id)
REFERENCES stock_movements(id)
ON DELETE CASCADE;

-- 4. stock_movement_items → products
ALTER TABLE stock_movement_items
ADD CONSTRAINT stock_movement_items_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES products(id)
ON DELETE CASCADE;

-- STEP 3: Verify ALL constraints created
SELECT
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('stock_movements', 'stock_movement_items')
AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- ========================================
-- Expected Result:
-- ========================================
-- stock_movements     | location_id  | locations           | id
-- stock_movements     | supplier_id  | suppliers           | id
-- stock_movement_items| movement_id  | stock_movements     | id
-- stock_movement_items| product_id   | products            | id

-- ========================================
-- CRITICAL: After running this, you MUST refresh Supabase
-- ========================================
-- Go to Supabase Dashboard → API Settings → Click "Refresh Schema Cache"
-- OR just wait 1-2 minutes for auto-refresh

-- ========================================
