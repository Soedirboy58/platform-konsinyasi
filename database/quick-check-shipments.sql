-- ========================================
-- QUICK CHECK: Diagnosa Shipments Issue
-- ========================================

-- 1. CEK BERAPA PRODUK YANG APPROVED
SELECT 
  COUNT(*) as total_approved_products,
  COUNT(DISTINCT supplier_id) as suppliers_with_approved_products
FROM products
WHERE status = 'APPROVED';

-- 2. CEK BERAPA PRODUK YANG MASIH PENDING
SELECT 
  COUNT(*) as total_pending_products,
  s.business_name as supplier_name
FROM products p
LEFT JOIN suppliers s ON s.id = p.supplier_id
WHERE p.status = 'PENDING'
GROUP BY s.business_name;

-- 3. CEK APAKAH ADA STOCK MOVEMENTS
SELECT 
  COUNT(*) as total_movements,
  COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
  COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
  COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected
FROM stock_movements;

-- 4. JIKA ADA STOCK MOVEMENTS, TAMPILKAN 5 TERBARU
SELECT 
  sm.id,
  s.business_name,
  l.name as location,
  sm.status,
  sm.created_at,
  (SELECT COUNT(*) FROM stock_movement_items WHERE movement_id = sm.id) as item_count
FROM stock_movements sm
LEFT JOIN suppliers s ON s.id = sm.supplier_id
LEFT JOIN locations l ON l.id = sm.location_id
ORDER BY sm.created_at DESC
LIMIT 5;

-- ========================================
-- INTERPRETATION GUIDE:
-- ========================================

-- SCENARIO A: total_approved_products = 0
-- → ROOT CAUSE: Belum ada produk yang di-approve admin
-- → FIX: Admin harus approve produk dulu di menu "Produk Supplier"

-- SCENARIO B: total_approved_products > 0, tapi total_movements = 0
-- → ROOT CAUSE: Supplier belum submit pengiriman
-- → FIX: Supplier harus kirim produk via menu "Kirim Produk Baru"

-- SCENARIO C: total_movements > 0, pending = 0
-- → ROOT CAUSE: Semua shipments sudah di-approve/reject
-- → FIX: Supplier perlu submit pengiriman baru

-- SCENARIO D: total_movements > 0, pending > 0, tapi UI kosong
-- → ROOT CAUSE: RLS policy blocking admin
-- → FIX: Run fix-shipments-rls.sql

-- ========================================
