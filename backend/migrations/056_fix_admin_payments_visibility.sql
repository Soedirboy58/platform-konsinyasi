-- ============================================================
-- FIX 056: Samakan akses admin untuk data pembayaran supplier
-- ============================================================
-- MASALAH:
--   Admin dengan profiles.is_active = FALSE atau NULL TIDAK BISA
--   melihat baris tabel supplier_payments. Akibatnya halaman
--   /admin/payments/commissions menghitung saldo supplier TANPA
--   mengurangi pembayaran yang sudah ditransfer -> angka membengkak
--   (tampil jutaan, jumlah "Siap Dibayar" jadi lebih banyak).
--
--   Tabel penjualan (sales_transactions, sales_transaction_items)
--   policy-nya HANYA cek role = 'ADMIN' (tanpa is_active), sedangkan
--   supplier_payments cek role = 'ADMIN' AND is_active = TRUE.
--   Ketidakcocokan inilah sumbernya.
--
-- CARA JALAN:
--   Supabase Dashboard > SQL Editor > New query > tempel semua > Run.
--   Aman diulang. Bagian ROLLBACK ada di paling bawah.
-- ============================================================


-- ------------------------------------------------------------
-- LANGKAH 0 (opsional, lihat dulu): siapa saja admin & statusnya
-- ------------------------------------------------------------
-- Jalankan SENDIRI baris di bawah ini lebih dulu untuk melihat data:
--
--   SELECT id, email, role, admin_role, is_active
--   FROM profiles
--   WHERE role = 'ADMIN'
--   ORDER BY is_active NULLS FIRST;
--
-- Kalau ADA akun yang MEMANG sengaja dinonaktifkan, catat email-nya,
-- lalu di LANGKAH 1 ganti perintah UPDATE dengan versi "kecuali akun itu".


BEGIN;

-- ------------------------------------------------------------
-- LANGKAH 1 - Perbaikan cepat: aktifkan semua akun admin yang sah.
-- Kolom is_active dulu ditambahkan tanpa diisi, jadi banyak yang NULL.
-- ------------------------------------------------------------
UPDATE profiles
SET is_active = TRUE
WHERE role = 'ADMIN'
  AND (is_active IS NULL OR is_active = FALSE);

-- Kalau ada admin yang HARUS tetap nonaktif, JANGAN pakai UPDATE di atas.
-- Pakai ini sebagai gantinya (ganti daftar email sesuai kebutuhan):
--
--   UPDATE profiles
--   SET is_active = TRUE
--   WHERE role = 'ADMIN'
--     AND (is_active IS NULL OR is_active = FALSE)
--     AND email NOT IN ('admin-nonaktif@contoh.com');


-- ------------------------------------------------------------
-- LANGKAH 2 - Perbaikan permanen: samakan policy supplier_payments
-- dengan policy data penjualan (cukup cek role = 'ADMIN').
-- Supaya bug yang sama tidak muncul lagi kalau ada akun is_active NULL.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can view all supplier payments" ON supplier_payments;

CREATE POLICY "Admin can view all supplier payments"
  ON supplier_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
    )
  );

COMMIT;


-- ============================================================
-- VERIFIKASI - jalankan setelah COMMIT, periksa hasilnya
-- ============================================================

-- (a) Tidak ada lagi admin yang NULL / FALSE tanpa sengaja:
SELECT id, email, role, admin_role, is_active
FROM profiles
WHERE role = 'ADMIN'
ORDER BY is_active NULLS FIRST;

-- (b) Policy SELECT supplier_payments sekarang TIDAK menyebut is_active:
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'supplier_payments' AND cmd = 'SELECT';

-- (c) Angka acuan yang harus sama untuk SEMUA admin sesudah fix:
SELECT
  count(*)                        AS jumlah_pembayaran_completed,
  coalesce(sum(net_payment), 0)   AS total_net_payment
FROM supplier_payments
WHERE status = 'COMPLETED';

-- (d) Cek apakah masih ada tabel lain yang policy-nya "kunci" pakai is_active
--     (kalau ada baris keluar, laporkan - mungkin perlu diperlakukan sama):
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND qual ILIKE '%is_active%'
  AND qual ILIKE '%role%'
ORDER BY tablename;


-- ============================================================
-- ROLLBACK - kembalikan seperti semula bila perlu
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "Admin can view all supplier payments" ON supplier_payments;
-- CREATE POLICY "Admin can view all supplier payments"
--   ON supplier_payments
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid()
--         AND profiles.role = 'ADMIN'
--         AND profiles.is_active = TRUE
--     )
--   );
-- COMMIT;
-- (Catatan: is_active yang sudah diubah jadi TRUE di LANGKAH 1
--  tidak otomatis dikembalikan - set manual bila memang perlu.)
