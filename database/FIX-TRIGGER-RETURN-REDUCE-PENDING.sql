-- ========================================
-- FIX: handle_return_reduce_pending trigger
-- ========================================
-- Error: stock_movement_id tidak ada di tabel shipment_returns
-- Function ini harus diupdate untuk pakai field yang benar
-- ========================================

-- Drop trigger dulu
DROP TRIGGER IF EXISTS trg_return_reduce_pending ON shipment_returns;

-- Recreate function tanpa stock_movement_id
CREATE OR REPLACE FUNCTION handle_return_reduce_pending()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_id UUID;
  v_wallet_id UUID;
  v_supplier_revenue DECIMAL(15,2);
  v_product_price DECIMAL(15,2);
BEGIN
  -- Only trigger when return is APPROVED
  IF NEW.status = 'APPROVED' AND OLD.status = 'PENDING' THEN
    
    -- Get supplier directly from shipment_returns (field sudah ada)
    v_supplier_id := NEW.supplier_id;
    
    -- Get wallet
    SELECT id INTO v_wallet_id
    FROM supplier_wallets
    WHERE supplier_id = v_supplier_id;
    
    -- Get product price
    SELECT price INTO v_product_price
    FROM products
    WHERE id = NEW.product_id;
    
    -- Calculate revenue to deduct (quantity * price * 90%)
    v_supplier_revenue := NEW.quantity * COALESCE(v_product_price, 0) * 0.9;
    
    -- Reduce pending_balance
    IF v_wallet_id IS NOT NULL THEN
      UPDATE supplier_wallets
      SET 
        pending_balance = GREATEST(pending_balance - v_supplier_revenue, 0),
        total_earned = GREATEST(total_earned - v_supplier_revenue, 0),
        updated_at = NOW()
      WHERE id = v_wallet_id;
      
      -- Log transaction
      INSERT INTO wallet_transactions (
        wallet_id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        description,
        reference_id,
        reference_type
      )
      SELECT 
        v_wallet_id,
        'REFUND',
        v_supplier_revenue,
        sw.pending_balance + v_supplier_revenue,
        sw.pending_balance,
        'Pengurangan saldo karena retur produk',
        NEW.id,
        'RETURN'
      FROM supplier_wallets sw
      WHERE sw.id = v_wallet_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER trg_return_reduce_pending
  AFTER UPDATE ON shipment_returns
  FOR EACH ROW
  EXECUTE FUNCTION handle_return_reduce_pending();

SELECT '✅ Trigger fixed - no more stock_movement_id!' AS status;
