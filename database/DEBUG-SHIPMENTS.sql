-- ========================================
-- DEBUG: Shipments Data Investigation
-- ========================================
-- Untuk menemukan kenapa supplier tidak bisa lihat shipments-nya
-- ========================================

-- STEP 1: Cek ALL shipments yang ada
SELECT 
  id,
  supplier_id,
  location_id,
  movement_type,
  status,
  created_at,
  (SELECT business_name FROM suppliers WHERE id = stock_movements.supplier_id) as supplier_name,
  (SELECT name FROM locations WHERE id = stock_movements.location_id) as location_name
FROM stock_movements
WHERE movement_type = 'SHIPMENT'
ORDER BY created_at DESC
LIMIT 20;

-- STEP 2: Cek supplier "Suplier Snack Kering" (dari screenshot)
SELECT 
  id,
  business_name,
  contact_person,
  phone
FROM suppliers
WHERE business_name ILIKE '%snack%kering%'
   OR business_name ILIKE '%suplier%snack%';

-- STEP 3: Cek shipments dengan items (join ke products untuk lihat supplier)
SELECT 
  sm.id as shipment_id,
  sm.status,
  sm.supplier_id as movement_supplier_id,
  sm.created_at,
  p.name as product_name,
  p.supplier_id as product_supplier_id,
  s.business_name as product_owner,
  smi.quantity
FROM stock_movements sm
LEFT JOIN stock_movement_items smi ON sm.id = smi.movement_id
LEFT JOIN products p ON smi.product_id = p.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
WHERE sm.movement_type = 'SHIPMENT'
ORDER BY sm.created_at DESC
LIMIT 20;

-- STEP 4: Cek apakah supplier_id di stock_movements NULL atau salah
SELECT 
  sm.id,
  sm.supplier_id,
  sm.status,
  COUNT(smi.id) as item_count,
  STRING_AGG(DISTINCT p.supplier_id::text, ', ') as product_suppliers
FROM stock_movements sm
LEFT JOIN stock_movement_items smi ON sm.id = smi.movement_id
LEFT JOIN products p ON smi.product_id = p.id
WHERE sm.movement_type = 'SHIPMENT'
GROUP BY sm.id, sm.supplier_id, sm.status
ORDER BY sm.created_at DESC;

-- STEP 5: FIX - Update supplier_id di stock_movements berdasarkan products
-- Jalankan ini HANYA jika supplier_id di stock_movements NULL atau salah
UPDATE stock_movements sm
SET supplier_id = (
  SELECT DISTINCT p.supplier_id
  FROM stock_movement_items smi
  JOIN products p ON smi.product_id = p.id
  WHERE smi.movement_id = sm.id
  LIMIT 1
)
WHERE sm.movement_type = 'SHIPMENT'
  AND sm.supplier_id IS NULL
RETURNING id, supplier_id, status;

-- STEP 6: Verify hasil fix
SELECT 
  sm.id,
  sm.supplier_id,
  sm.status,
  s.business_name,
  COUNT(smi.id) as items
FROM stock_movements sm
LEFT JOIN suppliers s ON sm.supplier_id = s.id
LEFT JOIN stock_movement_items smi ON sm.id = smi.movement_id
WHERE sm.movement_type = 'SHIPMENT'
GROUP BY sm.id, sm.supplier_id, sm.status, s.business_name
ORDER BY sm.created_at DESC;
