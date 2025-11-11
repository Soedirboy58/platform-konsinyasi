-- TEST SCRIPT: confirm_return_received_by_supplier
-- Tujuan: Uji fungsi confirm_return_received_by_supplier untuk mengubah status APPROVED -> COMPLETED
-- Langkah:
-- 1) Siapkan retur dengan status APPROVED (gunakan retur hasil approve_shipment_return atau buat dummy)
-- 2) Jalankan fungsi confirm_return_received_by_supplier
-- 3) Verifikasi perubahan status dan supplier_received_at
--
-- INSTRUKSI: Ganti placeholder berikut sebelum menjalankan:
-- RETURN_ID: ID retur yang sudah APPROVED
-- SUPPLIER_PROFILE_UUID: profile_id milik supplier (bukan supplier.id)
-- SUPPLIER_ID: id di tabel suppliers
--
-- Jalankan di Supabase SQL Editor atau CLI: supabase db execute -f database/test-confirm-return-received.sql

BEGIN;

-- 1) Tampilkan status awal retur
SELECT 'BEFORE RETURN' AS info; 
SELECT id, supplier_id, status, supplier_received_at, requested_at, reviewed_at
FROM public.shipment_returns
WHERE id = 'RETURN_ID'::uuid;

-- 2) (Opsional) Pastikan supplier yang login akan sesuai auth.uid(), lewati jika pakai UI
-- Untuk test manual dengan SQL editor Anda tidak bisa set auth.uid(); maka fungsi harus diuji via RPC dari aplikasi.
-- Jika ingin pure SQL test, sementara gunakan SECURITY DEFINER override dengan mengganti fungsi, TIDAK disarankan di production.

-- 3) Eksekusi via SELECT (DI SATUAN OPERASIONAL HARUS VIA RPC SUPABASE) — ini hanya simulasi jika auth.uid() cocok
SELECT confirm_return_received_by_supplier('RETURN_ID'::uuid) AS confirm;

-- 4) Verifikasi status berubah jadi COMPLETED
SELECT 'AFTER RETURN' AS info; 
SELECT id, supplier_id, status, supplier_received_at, updated_at
FROM public.shipment_returns
WHERE id = 'RETURN_ID'::uuid;

-- 5) Cek activity_logs (jika ada)
SELECT 'ACTIVITY LOGS (SUPPLIER_CONFIRM_RECEIVED)' AS info;
SELECT entity_id, action, details, created_at
FROM public.activity_logs
WHERE action = 'SUPPLIER_CONFIRM_RECEIVED'
  AND entity_id = 'RETURN_ID'::uuid
ORDER BY created_at DESC;

COMMIT;

SELECT 'TEST CONFIRM RETURN RECEIVED COMPLETE' AS status;
