-- ========================================
-- Migration 037: Auto-Cancel Pending Transactions
-- ========================================
-- Description: Transaksi PENDING yang tidak dibayar dalam 5 menit
--              akan otomatis di-cancel dan stok dikembalikan.
-- Execute: Run this in Supabase SQL Editor
-- ========================================

-- -------------------------------------------------------
-- 1. Function: cancel_expired_pending_transactions
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION cancel_expired_pending_transactions()
RETURNS INTEGER AS $$
DECLARE
    v_cancelled_count INTEGER := 0;
BEGIN
    -- Step 1: Kembalikan stok untuk semua transaksi PENDING > 2 menit
    UPDATE inventory_levels il
    SET 
        quantity = il.quantity + sti.quantity,
        updated_at = NOW()
    FROM sales_transaction_items sti
    JOIN sales_transactions st ON st.id = sti.transaction_id
    WHERE st.status = 'PENDING'
      AND st.created_at < NOW() - INTERVAL '2 minutes'
      AND il.product_id = sti.product_id
      AND il.location_id = st.location_id;

    -- Step 2: Update status transaksi PENDING > 2 menit → CANCELLED
    UPDATE sales_transactions
    SET 
        status = 'CANCELLED',
        updated_at = NOW()
    WHERE status = 'PENDING'
      AND created_at < NOW() - INTERVAL '2 minutes';

    GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;

    RETURN v_cancelled_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION cancel_expired_pending_transactions() TO service_role;

-- -------------------------------------------------------
-- 2. Setup pg_cron job (jalankan setiap 5 menit)
--    Requires pg_cron extension (tersedia di Supabase)
-- -------------------------------------------------------

-- Enable pg_cron extension (jika belum aktif)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hapus job lama jika ada
SELECT cron.unschedule('cancel-expired-pending-transactions')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cancel-expired-pending-transactions'
);

-- Buat cron job baru: setiap 2 menit
SELECT cron.schedule(
    'cancel-expired-pending-transactions',
    '*/2 * * * *',   -- setiap 2 menit
    $$SELECT cancel_expired_pending_transactions();$$
);

-- -------------------------------------------------------
-- 3. Verifikasi
-- -------------------------------------------------------

-- Cek function terbuat
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'cancel_expired_pending_transactions';

-- Cek cron job terdaftar
SELECT jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'cancel-expired-pending-transactions';

-- Test manual (opsional — output: jumlah transaksi yang di-cancel)
-- SELECT cancel_expired_pending_transactions();
