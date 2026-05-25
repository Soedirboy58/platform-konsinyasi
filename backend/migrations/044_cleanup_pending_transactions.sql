-- ============================================================
-- Migration 044: Auto-cleanup Expired PENDING Transactions
-- Jalankan di Supabase SQL Editor
-- ============================================================
-- Masalah yang diselesaikan:
--   Fungsi process_anonymous_checkout() langsung mengurangi stok saat
--   transaksi dibuat (status PENDING). Jika pembayaran tidak pernah
--   dikonfirmasi, stok tetap berkurang selamanya tanpa ada record di laporan.
--
-- Solusi:
--   1. Fungsi cleanup_expired_pending_transactions() — cancel transaksi PENDING
--      yang sudah melebihi batas waktu dan kembalikan stoknya.
--   2. pg_cron job yang menjalankan fungsi ini setiap 30 menit otomatis.
--
-- Syarat pg_cron:
--   Aktifkan dulu di Supabase Dashboard → Database → Extensions → cari "pg_cron" → Enable
-- ============================================================


-- ============================================================
-- BAGIAN 1: Fungsi cleanup
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_pending_transactions(
    p_expire_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
    cancelled_count INTEGER,
    restored_items  INTEGER
) AS $$
DECLARE
    v_tx        RECORD;
    v_item      RECORD;
    v_cancelled INTEGER := 0;
    v_restored  INTEGER := 0;
BEGIN
    -- Loop semua transaksi PENDING yang sudah kadaluarsa
    FOR v_tx IN
        SELECT id, location_id
        FROM sales_transactions
        WHERE status = 'PENDING'
          AND created_at < NOW() - (p_expire_minutes || ' minutes')::INTERVAL
    LOOP
        -- Kembalikan stok untuk setiap item dalam transaksi
        FOR v_item IN
            SELECT product_id, quantity
            FROM sales_transaction_items
            WHERE transaction_id = v_tx.id
        LOOP
            UPDATE inventory_levels
            SET quantity   = quantity + v_item.quantity,
                updated_at = NOW()
            WHERE product_id  = v_item.product_id
              AND location_id = v_tx.location_id;

            v_restored := v_restored + 1;
        END LOOP;

        -- Tandai transaksi sebagai CANCELLED
        UPDATE sales_transactions
        SET status     = 'CANCELLED',
            updated_at = NOW()
        WHERE id = v_tx.id;

        v_cancelled := v_cancelled + 1;
    END LOOP;

    RETURN QUERY SELECT v_cancelled, v_restored;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant ke role authenticated (bisa dipanggil manual oleh admin juga)
GRANT EXECUTE ON FUNCTION cleanup_expired_pending_transactions(INTEGER) TO authenticated;


-- ============================================================
-- BAGIAN 2: Jalankan sekali sekarang — perbaiki stok yang sudah rusak
-- ============================================================

-- Lihat dulu transaksi PENDING yang akan dicancel
SELECT
    st.id,
    st.transaction_code,
    st.created_at,
    st.total_amount,
    COUNT(sti.id)           AS item_count,
    SUM(sti.quantity)       AS total_qty,
    STRING_AGG(p.name, ', ') AS products
FROM sales_transactions st
JOIN sales_transaction_items sti ON sti.transaction_id = st.id
JOIN products p                  ON p.id = sti.product_id
WHERE st.status = 'PENDING'
  AND st.created_at < NOW() - INTERVAL '30 minutes'
GROUP BY st.id, st.transaction_code, st.created_at, st.total_amount
ORDER BY st.created_at;

-- Jalankan cleanup (uncomment setelah review data di atas)
-- SELECT * FROM cleanup_expired_pending_transactions(30);


-- ============================================================
-- BAGIAN 3: Jadwalkan via pg_cron (jalankan setelah aktifkan extension)
-- ============================================================

-- Aktifkan pg_cron dulu:
--   Supabase Dashboard → Database → Extensions → pg_cron → Enable
--
-- Setelah aktif, jalankan query ini:

-- Hapus jadwal lama jika ada (aman: tidak error jika belum terdaftar)
DO $$
BEGIN
    PERFORM cron.unschedule('cleanup-pending-transactions');
EXCEPTION WHEN OTHERS THEN
    -- Job belum ada, lanjutkan
END;
$$;

-- Jadwalkan setiap 10 menit
SELECT cron.schedule(
    'cleanup-pending-transactions',
    '*/10 * * * *',
    'SELECT cleanup_expired_pending_transactions(10)'
);

-- Verifikasi jadwal terdaftar
SELECT jobid, schedule, command, active
FROM cron.job
WHERE jobname = 'cleanup-pending-transactions';


-- ============================================================
-- VERIFIKASI
-- ============================================================

-- Cek fungsi terdaftar
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'cleanup_expired_pending_transactions';

SELECT 'Migration 044: Cleanup Pending Transactions — SUCCESS!' AS status;
