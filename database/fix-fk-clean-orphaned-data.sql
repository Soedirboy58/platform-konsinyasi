-- ========================================
-- FIX: Clean Orphaned Data FIRST, THEN Create Foreign Keys
-- ========================================

-- STEP 1: Find orphaned records (optional - untuk info saja)
SELECT 
  sm.id,
  sm.location_id,
  sm.supplier_id,
  sm.status,
  sm.created_at,
  CASE 
    WHEN l.id IS NULL THEN '❌ Invalid location'
    ELSE '✅ Valid location'
  END as location_status,
  CASE 
    WHEN s.id IS NULL THEN '❌ Invalid supplier'
    ELSE '✅ Valid supplier'
  END as supplier_status
FROM stock_movements sm
LEFT JOIN locations l ON sm.location_id = l.id
LEFT JOIN suppliers s ON sm.supplier_id = s.id
WHERE l.id IS NULL OR s.id IS NULL;

-- STEP 2: DELETE orphaned records (jika ada)
-- WARNING: Ini akan menghapus data yang tidak valid!
DELETE FROM stock_movement_items
WHERE movement_id IN (
  SELECT sm.id 
  FROM stock_movements sm
  LEFT JOIN locations l ON sm.location_id = l.id
  LEFT JOIN suppliers s ON sm.supplier_id = s.id
  WHERE l.id IS NULL OR s.id IS NULL
);

DELETE FROM stock_movements
WHERE location_id NOT IN (SELECT id FROM locations)
   OR supplier_id NOT IN (SELECT id FROM suppliers);

-- STEP 3: Drop existing constraints
ALTER TABLE stock_movements 
DROP CONSTRAINT IF EXISTS stock_movements_supplier_id_fkey;

ALTER TABLE stock_movements 
DROP CONSTRAINT IF EXISTS stock_movements_location_id_fkey;

ALTER TABLE stock_movement_items 
DROP CONSTRAINT IF EXISTS stock_movement_items_movement_id_fkey;

ALTER TABLE stock_movement_items 
DROP CONSTRAINT IF EXISTS stock_movement_items_product_id_fkey;

-- STEP 4: Create ALL foreign keys
ALTER TABLE stock_movements
ADD CONSTRAINT stock_movements_supplier_id_fkey
FOREIGN KEY (supplier_id)
REFERENCES suppliers(id)
ON DELETE CASCADE;

ALTER TABLE stock_movements
ADD CONSTRAINT stock_movements_location_id_fkey
FOREIGN KEY (location_id)
REFERENCES locations(id)
ON DELETE CASCADE;

ALTER TABLE stock_movement_items
ADD CONSTRAINT stock_movement_items_movement_id_fkey
FOREIGN KEY (movement_id)
REFERENCES stock_movements(id)
ON DELETE CASCADE;

ALTER TABLE stock_movement_items
ADD CONSTRAINT stock_movement_items_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES products(id)
ON DELETE CASCADE;

-- STEP 5: Verify constraints
SELECT
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS references_table,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('stock_movements', 'stock_movement_items')
AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- ========================================
-- EXPECTED: 4 rows
-- ========================================
-- stock_movements     | location_id  | locations
-- stock_movements     | supplier_id  | suppliers
-- stock_movement_items| movement_id  | stock_movements
-- stock_movement_items| product_id   | products

-- ========================================
-- CRITICAL FINAL STEP!
-- ========================================
-- Run this SQL to force Supabase to reload schema:
NOTIFY pgrst, 'reload schema';

-- OR manually refresh via Dashboard:
-- Settings → API → Reload Schema Cache
