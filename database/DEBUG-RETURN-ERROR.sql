-- ========================================
-- DEBUG: Return Approval Error
-- ========================================

-- STEP 1: Cek struktur tabel shipment_returns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipment_returns'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- STEP 2: Cek detail retur yang mau di-approve
SELECT *
FROM shipment_returns
WHERE id = '64f35b5f-c2ef-4df0-876d-105f2a05ea3c';

-- STEP 3: Test manual call function approve_return_request
-- Ganti UUID dengan ID retur yang mau di-approve
SELECT approve_return_request(
  '64f35b5f-c2ef-4df0-876d-105f2a05ea3c'::uuid,
  'Test approval'
);

-- STEP 4: Cek items dari retur tersebut (jika ada tabel shipment_return_items)
SELECT *
FROM shipment_return_items
WHERE return_id = '64f35b5f-c2ef-4df0-876d-105f2a05ea3c';
