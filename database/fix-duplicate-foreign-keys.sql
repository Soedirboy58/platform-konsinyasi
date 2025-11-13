-- ========================================
-- FIX: Remove DUPLICATE Foreign Keys
-- ========================================
-- Error: PGRST201 - More than one relationship found
-- Cause: Multiple FK constraints exist for same column

-- STEP 1: Check ALL existing foreign keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('stock_movements', 'stock_movement_items')
ORDER BY tc.table_name, kcu.column_name;

-- STEP 2: DROP **ALL** foreign keys (clean slate)
-- stock_movements table
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_supplier_id_fkey;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_location_id_fkey;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS fk_stock_movements_supplier;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS fk_stock_movements_location;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_supplier_id_fkey1;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_location_id_fkey1;

-- stock_movement_items table
ALTER TABLE stock_movement_items DROP CONSTRAINT IF EXISTS stock_movement_items_movement_id_fkey;
ALTER TABLE stock_movement_items DROP CONSTRAINT IF EXISTS stock_movement_items_product_id_fkey;
ALTER TABLE stock_movement_items DROP CONSTRAINT IF EXISTS fk_stock_movement_items_movement;
ALTER TABLE stock_movement_items DROP CONSTRAINT IF EXISTS fk_stock_movement_items_product;
ALTER TABLE stock_movement_items DROP CONSTRAINT IF EXISTS stock_movement_items_movement_id_fkey1;
ALTER TABLE stock_movement_items DROP CONSTRAINT IF EXISTS stock_movement_items_product_id_fkey1;

-- STEP 3: Create SINGLE, CLEAN foreign key for each relationship
-- IMPORTANT: Use standard naming convention

-- 1. stock_movements.supplier_id → suppliers.id
ALTER TABLE stock_movements
ADD CONSTRAINT stock_movements_supplier_id_fkey
FOREIGN KEY (supplier_id)
REFERENCES suppliers(id)
ON DELETE CASCADE;

-- 2. stock_movements.location_id → locations.id
ALTER TABLE stock_movements
ADD CONSTRAINT stock_movements_location_id_fkey
FOREIGN KEY (location_id)
REFERENCES locations(id)
ON DELETE CASCADE;

-- 3. stock_movement_items.movement_id → stock_movements.id
ALTER TABLE stock_movement_items
ADD CONSTRAINT stock_movement_items_movement_id_fkey
FOREIGN KEY (movement_id)
REFERENCES stock_movements(id)
ON DELETE CASCADE;

-- 4. stock_movement_items.product_id → products.id
ALTER TABLE stock_movement_items
ADD CONSTRAINT stock_movement_items_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES products(id)
ON DELETE CASCADE;

-- STEP 4: Verify - should show EXACTLY 4 rows (no duplicates)
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('stock_movements', 'stock_movement_items')
ORDER BY tc.table_name, kcu.column_name;

-- Expected result (EXACTLY 4 rows):
-- stock_movements_location_id_fkey  | stock_movements      | location_id  | locations
-- stock_movements_supplier_id_fkey  | stock_movements      | supplier_id  | suppliers
-- stock_movement_items_movement_id_fkey | stock_movement_items | movement_id  | stock_movements
-- stock_movement_items_product_id_fkey  | stock_movement_items | product_id   | products

-- STEP 5: Force Supabase to reload schema
NOTIFY pgrst, 'reload schema';

-- ========================================
-- AFTER THIS:
-- ========================================
-- 1. Wait 10 seconds
-- 2. Hard refresh browser (Ctrl+Shift+R)
-- 3. Data WILL appear!
-- ========================================
