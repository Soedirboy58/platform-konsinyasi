-- Migration 054: Lost Products (Produk Hilang)
-- Purpose:
--   1) Allow admin to mark display stock at outlet as LOST (offline inventory check finds discrepancy)
--   2) Lost items reduce inventory_levels (same flow as a real sale)
--   3) Lost items appear in Laporan Penjualan with status='HILANG' and payment_method='LOST'
--   4) Supplier bears 100% of retail value (commission_amount=0, supplier_revenue=0 — no wallet credit)
--   5) Admin can later CONVERT lost -> sold (offline customer paid) or CANCEL (false alarm, stock returns)
--
-- Notes:
--   - sales_transactions has NO check constraint on status, so 'HILANG' is allowed as-is.
--   - payment_method is VARCHAR(50) free-form; 'LOST' as marker.

-- =========================================
-- 1. Audit columns (idempotent)
-- =========================================
ALTER TABLE sales_transactions
  ADD COLUMN IF NOT EXISTS lost_notes          TEXT,
  ADD COLUMN IF NOT EXISTS lost_marked_by      UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS lost_marked_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_converted_by   UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS lost_converted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_resolution     TEXT  -- 'SOLD' | 'CANCELLED' | NULL
    CHECK (lost_resolution IN ('SOLD','CANCELLED') OR lost_resolution IS NULL);

COMMENT ON COLUMN sales_transactions.lost_notes        IS 'Catatan admin saat menandai/menyelesaikan transaksi HILANG';
COMMENT ON COLUMN sales_transactions.lost_resolution   IS 'Hasil penyelesaian transaksi HILANG (SOLD = jadi terjual, CANCELLED = batal, NULL = belum)';

-- =========================================
-- 2. RPC: mark_products_lost
-- =========================================
DROP FUNCTION IF EXISTS mark_products_lost(UUID, JSONB, TEXT, UUID);

CREATE OR REPLACE FUNCTION mark_products_lost(
  p_location_id UUID,
  p_items       JSONB,   -- [{product_id, quantity, price}]
  p_notes       TEXT,
  p_admin_id    UUID
)
RETURNS TABLE(
  success          BOOLEAN,
  message          TEXT,
  transaction_id   UUID,
  transaction_code TEXT,
  total_amount     DECIMAL(15,2)
) AS $$
DECLARE
  v_tx_id            UUID;
  v_tx_code          TEXT;
  v_item             JSONB;
  v_product_id       UUID;
  v_supplier_id      UUID;
  v_quantity         INTEGER;
  v_price            DECIMAL(10,2);
  v_line_subtotal    DECIMAL(15,2);
  v_subtotal         DECIMAL(15,2) := 0;
  v_available        INTEGER;
BEGIN
  IF p_location_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Outlet wajib dipilih', NULL::UUID, NULL::TEXT, 0::DECIMAL(15,2);
    RETURN;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN QUERY SELECT FALSE, 'Minimal 1 produk wajib diisi', NULL::UUID, NULL::TEXT, 0::DECIMAL(15,2);
    RETURN;
  END IF;

  -- Validate stock availability first
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := (v_item->>'quantity')::INTEGER;

    SELECT COALESCE(il.quantity, 0) INTO v_available
      FROM inventory_levels il
     WHERE il.product_id = v_product_id AND il.location_id = p_location_id;

    IF v_available IS NULL OR v_available < v_quantity THEN
      RETURN QUERY SELECT FALSE,
        FORMAT('Stok tidak cukup untuk produk %s (tersedia: %s, diminta: %s)',
               v_product_id::TEXT, COALESCE(v_available,0), v_quantity),
        NULL::UUID, NULL::TEXT, 0::DECIMAL(15,2);
      RETURN;
    END IF;

    v_subtotal := v_subtotal + (v_quantity * (v_item->>'price')::DECIMAL(10,2));
  END LOOP;

  v_tx_code := 'LOST-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');

  INSERT INTO sales_transactions (
    location_id, transaction_code, total_amount,
    payment_method, status,
    qr_fee_rate, qr_fee_amount, qr_fee_bearer,
    lost_notes, lost_marked_by, lost_marked_at
  ) VALUES (
    p_location_id, v_tx_code, v_subtotal,
    'LOST', 'HILANG',
    0, 0, 'NONE',
    p_notes, p_admin_id, NOW()
  )
  RETURNING id INTO v_tx_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id    := (v_item->>'product_id')::UUID;
    v_quantity      := (v_item->>'quantity')::INTEGER;
    v_price         := (v_item->>'price')::DECIMAL(10,2);
    v_line_subtotal := v_quantity * v_price;

    SELECT p.supplier_id INTO v_supplier_id
      FROM products p WHERE p.id = v_product_id;

    -- 100% beban supplier: tidak ada credit wallet, commission_amount=0, supplier_revenue=0
    INSERT INTO sales_transaction_items (
      transaction_id, product_id, supplier_id,
      quantity, price, subtotal,
      commission_rate, commission_amount, supplier_revenue
    ) VALUES (
      v_tx_id, v_product_id, v_supplier_id,
      v_quantity, v_price, v_line_subtotal,
      0, 0, 0
    );

    UPDATE inventory_levels
       SET quantity = quantity - v_quantity, updated_at = NOW()
     WHERE product_id = v_product_id AND location_id = p_location_id;
  END LOOP;

  RETURN QUERY SELECT TRUE, 'Produk berhasil ditandai HILANG', v_tx_id, v_tx_code, v_subtotal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_products_lost(UUID, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_products_lost(UUID, JSONB, TEXT, UUID) TO service_role;

-- =========================================
-- 3. RPC: convert_lost_to_sold
--   - Status HILANG -> COMPLETED
--   - Apply normal commission rate so supplier gets revenue (stok TIDAK diutak-atik, sudah dikurangi)
-- =========================================
DROP FUNCTION IF EXISTS convert_lost_to_sold(UUID, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION convert_lost_to_sold(
  p_transaction_id UUID,
  p_payment_method TEXT,   -- 'CASH' | 'QRIS'
  p_notes          TEXT,
  p_admin_id       UUID
)
RETURNS TABLE(
  success      BOOLEAN,
  message      TEXT,
  total_amount DECIMAL(15,2)
) AS $$
DECLARE
  v_status         TEXT;
  v_subtotal       DECIMAL(15,2);
  v_commission_rate DECIMAL(5,2);
BEGIN
  SELECT status, total_amount INTO v_status, v_subtotal
    FROM sales_transactions
   WHERE id = p_transaction_id
   FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Transaksi tidak ditemukan', 0::DECIMAL(15,2);
    RETURN;
  END IF;

  IF v_status <> 'HILANG' THEN
    RETURN QUERY SELECT FALSE, 'Transaksi bukan berstatus HILANG', 0::DECIMAL(15,2);
    RETURN;
  END IF;

  IF UPPER(COALESCE(p_payment_method,'')) NOT IN ('CASH','QRIS') THEN
    RETURN QUERY SELECT FALSE, 'Metode pembayaran harus CASH atau QRIS', 0::DECIMAL(15,2);
    RETURN;
  END IF;

  SELECT COALESCE(value::DECIMAL, 10.00) INTO v_commission_rate
    FROM platform_settings WHERE key = 'commission_rate';
  v_commission_rate := COALESCE(v_commission_rate, 10.00);

  -- Recompute commission & supplier_revenue per item (normal split, no QR fee)
  UPDATE sales_transaction_items
     SET commission_rate   = v_commission_rate,
         commission_amount = ROUND(subtotal * (v_commission_rate / 100), 2),
         supplier_revenue  = subtotal - ROUND(subtotal * (v_commission_rate / 100), 2)
   WHERE transaction_id = p_transaction_id;

  UPDATE sales_transactions
     SET status            = 'COMPLETED',
         payment_method    = UPPER(p_payment_method),
         paid_at           = NOW(),
         lost_resolution   = 'SOLD',
         lost_converted_by = p_admin_id,
         lost_converted_at = NOW(),
         lost_notes        = COALESCE(p_notes, lost_notes),
         updated_at        = NOW()
   WHERE id = p_transaction_id;

  RETURN QUERY SELECT TRUE, 'Transaksi HILANG dikonversi menjadi TERJUAL', v_subtotal;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION convert_lost_to_sold(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION convert_lost_to_sold(UUID, TEXT, TEXT, UUID) TO service_role;

-- =========================================
-- 4. RPC: cancel_lost (rollback)
--   - Status HILANG -> CANCELLED
--   - Kembalikan stok ke inventory_levels
-- =========================================
DROP FUNCTION IF EXISTS cancel_lost(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION cancel_lost(
  p_transaction_id UUID,
  p_notes          TEXT,
  p_admin_id       UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_status      TEXT;
  v_location_id UUID;
BEGIN
  SELECT status, location_id INTO v_status, v_location_id
    FROM sales_transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Transaksi tidak ditemukan';
    RETURN;
  END IF;

  IF v_status <> 'HILANG' THEN
    RETURN QUERY SELECT FALSE, 'Transaksi bukan berstatus HILANG';
    RETURN;
  END IF;

  UPDATE inventory_levels il
     SET quantity = il.quantity + sti.quantity,
         updated_at = NOW()
    FROM sales_transaction_items sti
   WHERE sti.transaction_id = p_transaction_id
     AND il.product_id = sti.product_id
     AND il.location_id = v_location_id;

  UPDATE sales_transactions
     SET status            = 'CANCELLED',
         lost_resolution   = 'CANCELLED',
         lost_converted_by = p_admin_id,
         lost_converted_at = NOW(),
         lost_notes        = COALESCE(p_notes, lost_notes),
         updated_at        = NOW()
   WHERE id = p_transaction_id;

  RETURN QUERY SELECT TRUE, 'Status HILANG dibatalkan, stok dikembalikan';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_lost(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_lost(UUID, TEXT, UUID) TO service_role;

SELECT 'Migration 054: lost products feature - SUCCESS' AS status;
