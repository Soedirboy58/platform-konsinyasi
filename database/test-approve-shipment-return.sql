-- TEST SCRIPT: approve_shipment_return
-- Tujuan: Uji alur approve_shipment_return yang akan:
-- 1) Membuat entri shipment_returns + items (dummy)
-- 2) Menjalankan approve_shipment_return
-- 3) Memeriksa perubahan pada inventory_levels dan activity_logs
--
-- INSTRUKSI: Ganti semua placeholder UUID di bawah (SUPPLIER_UUID, PRODUCT_UUID_1, PRODUCT_UUID_2,
-- LOCATION_UUID, ADMIN_PROFILE_UUID) dengan UUID nyata dari environment Anda.
-- Jika Anda menggunakan Supabase SQL Editor, jalankan seluruh file sebagai query.
-- Jika Anda menggunakan supabase CLI: supabase db execute -f database/test-approve-shipment-return.sql

BEGIN;

-- --------- CONFIG: Ganti nilai ini ---------
-- Contoh format: 'f320b679-4980-48de-8884-91877779c81e'::uuid
-- Gunakan UUID nyata dari tabel suppliers, products, locations, dan profiles (admin)

-- Ganti placeholder berikut sebelum menjalankan:
-- SUPPLIER_UUID
-- PRODUCT_UUID_1
-- PRODUCT_UUID_2
-- LOCATION_UUID
-- ADMIN_PROFILE_UUID

-- -------------------------------------------

-- 1) Buat return dummy (ID tetap supaya mudah cleanup)
INSERT INTO public.shipment_returns (id, supplier_id, location_id, reason, status, requested_by, requested_at, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'SUPPLIER_UUID'::uuid,
  'LOCATION_UUID'::uuid,
  'Test retur otomatis',
  'PENDING',
  'ADMIN_PROFILE_UUID'::uuid,
  NOW(), NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2) Tambahkan item retur
INSERT INTO public.shipment_return_items (id, return_id, product_id, quantity, created_at)
VALUES
  ('22222222-2222-2222-2222-222222222222'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'PRODUCT_UUID_1'::uuid, 2, NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shipment_return_items (id, return_id, product_id, quantity, created_at)
VALUES
  ('33333333-3333-3333-3333-333333333333'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'PRODUCT_UUID_2'::uuid, 3, NOW())
ON CONFLICT (id) DO NOTHING;

-- 3) Tampilkan inventory sebelum approve
SELECT 'BEFORE: inventory_levels' AS info;
SELECT * FROM public.inventory_levels
WHERE product_id IN ('PRODUCT_UUID_1'::uuid, 'PRODUCT_UUID_2'::uuid)
  AND location_id = 'LOCATION_UUID'::uuid;

-- 4) Jalankan approve (ganti ADMIN_PROFILE_UUID jika perlu)
SELECT approve_shipment_return('11111111-1111-1111-1111-111111111111'::uuid, 'ADMIN_PROFILE_UUID'::uuid) AS approved;

-- 5) Tampilkan inventory setelah approve
SELECT 'AFTER: inventory_levels' AS info;
SELECT * FROM public.inventory_levels
WHERE product_id IN ('PRODUCT_UUID_1'::uuid, 'PRODUCT_UUID_2'::uuid)
  AND location_id = 'LOCATION_UUID'::uuid;

-- 5b) Periksa wallet supplier dan transaksi wallet
SELECT 'AFTER: supplier_wallets' AS info;
SELECT * FROM public.supplier_wallets WHERE supplier_id = 'SUPPLIER_UUID'::uuid;

SELECT 'AFTER: wallet_transactions (reference to return)' AS info;
SELECT * FROM public.wallet_transactions WHERE reference_id = '11111111-1111-1111-1111-111111111111'::uuid ORDER BY created_at DESC;

-- 6) Periksa activity_logs
SELECT 'activity_logs for products' AS info;
SELECT * FROM public.activity_logs
WHERE action = 'APPROVE_RETURN_ADJUST_STOCK'
  AND ( (new_values->>'location_id') = 'LOCATION_UUID' OR (new_values->>'location_id') IS NOT NULL )
ORDER BY created_at DESC
LIMIT 10;

-- 7) Cleanup contoh data (opsional) — uncomment jika ingin menghapus semua baris test
-- DELETE FROM public.activity_logs WHERE action = 'APPROVE_RETURN_ADJUST_STOCK' AND user_id = 'ADMIN_PROFILE_UUID'::uuid;
-- DELETE FROM public.inventory_levels WHERE product_id IN ('PRODUCT_UUID_1'::uuid, 'PRODUCT_UUID_2'::uuid) AND location_id = 'LOCATION_UUID'::uuid AND quantity IN (2,3);
-- DELETE FROM public.shipment_return_items WHERE return_id = '11111111-1111-1111-1111-111111111111'::uuid;
-- DELETE FROM public.shipment_returns WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;

COMMIT;

-- Selesai
SELECT 'TEST SCRIPT COMPLETE' AS status;
