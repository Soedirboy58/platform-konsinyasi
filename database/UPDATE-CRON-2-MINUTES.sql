-- ============================================================
-- Update: Ubah batas waktu cancel PENDING dari 5 → 2 menit
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Update function (interval 5 → 2 menit)
CREATE OR REPLACE FUNCTION cancel_expired_pending_transactions()
RETURNS INTEGER AS $$
DECLARE
    v_cancelled_count INTEGER := 0;
BEGIN
    -- Kembalikan stok untuk transaksi PENDING > 2 menit
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

    -- Cancel transaksi PENDING > 2 menit
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

-- 2. Reschedule cron: */5 → */2 (setiap 2 menit)
SELECT cron.unschedule('cancel-expired-pending-transactions');

SELECT cron.schedule(
    'cancel-expired-pending-transactions',
    '*/2 * * * *',
    $$SELECT cancel_expired_pending_transactions();$$
);

-- 3. Verifikasi jadwal baru
SELECT jobname, schedule, command
FROM cron.job
WHERE jobname = 'cancel-expired-pending-transactions';
