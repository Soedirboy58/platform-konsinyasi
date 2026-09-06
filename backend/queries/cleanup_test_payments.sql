-- ============================================================
-- BERSIH-BERSIH pembayaran UJI COBA (read then delete)
-- ============================================================
-- Syarat: saat menguji fitur "Bayar Mitra", isi field Ref dengan
-- prefix 'TEST-' (mis. TEST-20260906-001-TT).
--
-- Jalankan di Supabase SQL Editor. LIHAT dulu (bagian 1),
-- baru HAPUS (bagian 2). Aman diulang.
-- ============================================================

-- ------------------------------------------------------------
-- 1) LIHAT dulu apa yang akan dihapus
-- ------------------------------------------------------------
SELECT id, supplier_id, payment_reference, net_payment, payment_date, created_at
FROM supplier_payments
WHERE payment_reference LIKE 'TEST-%'
ORDER BY created_at DESC;

SELECT a.*
FROM supplier_payment_allocations a
JOIN supplier_payments p ON p.id = a.payment_id
WHERE p.payment_reference LIKE 'TEST-%';

SELECT id, recipient_id, title, created_at, metadata->>'payment_reference' AS ref
FROM notifications
WHERE type = 'PAYMENT_RECEIVED'
  AND metadata->>'payment_reference' LIKE 'TEST-%';


-- ------------------------------------------------------------
-- 2) HAPUS (urutan: alokasi -> notifikasi -> pembayaran)
--    Hilangkan komentar '--' pada 3 perintah di bawah bila yakin.
-- ------------------------------------------------------------
-- DELETE FROM supplier_payment_allocations
--   WHERE payment_id IN (SELECT id FROM supplier_payments WHERE payment_reference LIKE 'TEST-%');

-- DELETE FROM notifications
--   WHERE type = 'PAYMENT_RECEIVED'
--     AND metadata->>'payment_reference' LIKE 'TEST-%';

-- DELETE FROM supplier_payments
--   WHERE payment_reference LIKE 'TEST-%';


-- ------------------------------------------------------------
-- 3) File bukti di Storage TIDAK terhapus lewat SQL.
--    Hapus manual di Supabase Dashboard > Storage > bucket
--    'payment_proofs' > folder 'payment-proofs' > file '<payment_id>_*'.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 4) Verifikasi bersih
-- ------------------------------------------------------------
SELECT count(*) AS sisa_test_payments FROM supplier_payments WHERE payment_reference LIKE 'TEST-%';
