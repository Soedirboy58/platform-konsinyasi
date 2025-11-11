-- Migration: 032_shipment_return_functions.sql
-- Tujuan: Membuat fungsi DB untuk approve/reject shipment_returns dan notifikasi
-- Jalankan di Supabase SQL editor atau via supabase CLI

BEGIN;

-- Hapus fungsi lama jika ada
DROP FUNCTION IF EXISTS approve_shipment_return(UUID, UUID);
DROP FUNCTION IF EXISTS reject_shipment_return(UUID, UUID, TEXT);

-- Fungsi: approve_shipment_return
CREATE OR REPLACE FUNCTION approve_shipment_return(
  p_return_id UUID,
  p_admin_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_supplier_profile UUID;
  v_location UUID;
  rec RECORD;
  v_supplier_id UUID;
  v_total_refund NUMERIC := 0;
  v_wallet_id UUID;
BEGIN
  -- Update status return
  UPDATE public.shipment_returns
  SET status = 'APPROVED',
      reviewed_by = p_admin_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_return_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return tidak ditemukan atau sudah diproses';
  END IF;

  -- Ambil profile_id penerima notifikasi (supplier)
  SELECT s.id, s.profile_id INTO v_supplier_id, v_supplier_profile
  FROM public.suppliers s
  JOIN public.shipment_returns r ON r.supplier_id = s.id
  WHERE r.id = p_return_id
  LIMIT 1;

  -- Buat notifikasi untuk supplier jika fungsi tersedia
  IF v_supplier_profile IS NOT NULL THEN
    PERFORM create_notification(
      v_supplier_profile,
      'Retur Produk Disetujui',
      'Permintaan retur Anda telah disetujui oleh admin',
      FORMAT('return_id=%s', p_return_id),
      p_admin_id
    );
  END IF;

  -- Penyesuaian stok otomatis: tambahkan quantity kembali ke inventory_levels pada lokasi retur jika tersedia
  SELECT location_id INTO v_location FROM public.shipment_returns WHERE id = p_return_id LIMIT 1;

  IF v_location IS NOT NULL THEN
    FOR rec IN SELECT product_id, quantity FROM public.shipment_return_items WHERE return_id = p_return_id LOOP
      -- Update existing inventory level jika ada
      UPDATE public.inventory_levels
      SET quantity = quantity + rec.quantity,
          updated_at = NOW()
      WHERE product_id = rec.product_id AND location_id = v_location;

      IF NOT FOUND THEN
        -- Buat baris inventori baru jika belum ada
        INSERT INTO public.inventory_levels(id, product_id, location_id, quantity, stocked_at_timestamp, created_at, updated_at)
        VALUES (gen_random_uuid(), rec.product_id, v_location, rec.quantity, NOW(), NOW(), NOW());
      END IF;

      -- Catat activity log (skip jika tabel/kolom tidak sesuai)
      BEGIN
        INSERT INTO public.activity_logs(id, user_id, action, table_name, record_id, new_values, created_at)
        VALUES (gen_random_uuid(), p_admin_id, 'APPROVE_RETURN_ADJUST_STOCK', 'inventory_levels', rec.product_id, jsonb_build_object('added_quantity', rec.quantity, 'location_id', v_location), NOW());
      EXCEPTION WHEN undefined_column OR undefined_table THEN
        NULL; -- skip log jika activity_logs tidak punya kolom new_values atau tabel tidak ada
      END;
    END LOOP;
  END IF;

  -- PENYESUAIAN FINANSIAL: Hitung total refund berdasarkan harga produk dan credit ke dompet supplier
  SELECT COALESCE(SUM((p.price)::NUMERIC * ri.quantity), 0) INTO v_total_refund
  FROM public.shipment_return_items ri
  LEFT JOIN public.products p ON p.id = ri.product_id
  WHERE ri.return_id = p_return_id;

  IF v_total_refund > 0 THEN
    -- ambil atau buat wallet supplier
    SELECT id INTO v_wallet_id FROM public.supplier_wallets WHERE supplier_id = v_supplier_id LIMIT 1;
    IF v_wallet_id IS NULL THEN
      INSERT INTO public.supplier_wallets (id, supplier_id, created_at, updated_at)
      VALUES (gen_random_uuid(), v_supplier_id, NOW(), NOW())
      RETURNING id INTO v_wallet_id;
    END IF;

    -- Gunakan helper create_wallet_transaction jika tersedia
    BEGIN
      PERFORM create_wallet_transaction(v_wallet_id, 'CREDIT', v_total_refund, FORMAT('Refund retur %s', p_return_id), p_return_id, 'RETURN', p_admin_id);
    EXCEPTION WHEN undefined_function THEN
      -- Jika helper tidak ada, lakukan manual insert dan update
      INSERT INTO public.wallet_transactions(id, wallet_id, transaction_type, amount, balance_before, balance_after, description, reference_id, reference_type, created_by, created_at)
      VALUES (gen_random_uuid(), v_wallet_id, 'CREDIT', v_total_refund, 0, v_total_refund, FORMAT('Refund retur %s', p_return_id), p_return_id, 'RETURN', p_admin_id, NOW());

      UPDATE public.supplier_wallets
      SET available_balance = COALESCE(available_balance,0) + v_total_refund,
          updated_at = NOW()
      WHERE id = v_wallet_id;
    END;

    -- Catat activity log untuk refund (skip jika tabel/kolom tidak sesuai)
    BEGIN
      INSERT INTO public.activity_logs(id, user_id, action, table_name, record_id, new_values, created_at)
      VALUES (gen_random_uuid(), p_admin_id, 'APPROVE_RETURN_FINANCIAL_ADJUST', 'supplier_wallets', v_wallet_id, jsonb_build_object('amount', v_total_refund, 'return_id', p_return_id), NOW());
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      NULL; -- skip log
    END;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fungsi: reject_shipment_return
CREATE OR REPLACE FUNCTION reject_shipment_return(
  p_return_id UUID,
  p_admin_id UUID,
  p_rejection_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_supplier_profile UUID;
BEGIN
  -- Update status return
  UPDATE public.shipment_returns
  SET status = 'REJECTED',
      reviewed_by = p_admin_id,
      reviewed_at = NOW(),
      rejection_reason = p_rejection_reason,
      updated_at = NOW()
  WHERE id = p_return_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return tidak ditemukan atau sudah diproses';
  END IF;

  -- Ambil profile_id penerima notifikasi (supplier)
  SELECT s.profile_id INTO v_supplier_profile
  FROM public.suppliers s
  JOIN public.shipment_returns r ON r.supplier_id = s.id
  WHERE r.id = p_return_id
  LIMIT 1;

  -- Buat notifikasi untuk supplier jika fungsi tersedia
  IF v_supplier_profile IS NOT NULL THEN
    PERFORM create_notification(
      v_supplier_profile,
      'Retur Produk Ditolak',
      'Permintaan retur Anda telah ditolak oleh admin',
      FORMAT('return_id=%s; reason=%s', p_return_id, p_rejection_reason),
      p_admin_id
    );
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- Verifikasi: Daftarkan fungsi yang baru dibuat
SELECT proname, pg_get_function_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE proname IN ('approve_shipment_return','reject_shipment_return');

SELECT 'SUCCESS: Fungsi approve_shipment_return and reject_shipment_return dibuat' AS status;
