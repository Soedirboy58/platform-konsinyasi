-- ========================================
-- FIX: Supplier Payment Notifications & Wallet Update (CORRECTED)
-- ========================================
-- Purpose: 
-- 1. Update supplier wallet balance when payment is made
-- 2. Create wallet transaction record for audit trail
-- 3. Send notification to supplier
-- ========================================

-- ========================================
-- PART 1: Create Function to Handle Payment
-- ========================================

CREATE OR REPLACE FUNCTION handle_supplier_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_name TEXT;
  v_supplier_profile_id UUID;
  v_admin_name TEXT;
BEGIN
  -- Only process when payment status is COMPLETED
  IF (TG_OP = 'INSERT' AND NEW.status = 'COMPLETED') OR
     (TG_OP = 'UPDATE' AND OLD.status != 'COMPLETED' AND NEW.status = 'COMPLETED') THEN
    
    -- Get supplier info
    SELECT s.business_name, s.profile_id
    INTO v_supplier_name, v_supplier_profile_id
    FROM suppliers s
    WHERE s.id = NEW.supplier_id;

    -- Get admin info (who created the payment)
    IF NEW.created_by IS NOT NULL THEN
      SELECT p.full_name
      INTO v_admin_name
      FROM profiles p
      WHERE p.id = NEW.created_by;
    ELSE
      v_admin_name := 'Admin';
    END IF;

    -- Update supplier wallet - ADD to available balance
    UPDATE supplier_wallets
    SET 
      available_balance = available_balance + NEW.amount,
      updated_at = NOW()
    WHERE id = NEW.wallet_id;

    -- Create wallet transaction record for audit trail
    INSERT INTO wallet_transactions (
      wallet_id,
      transaction_type,
      amount,
      description,
      balance_before,
      balance_after,
      created_at
    )
    SELECT 
      NEW.wallet_id,
      'PAYMENT_RECEIVED',
      NEW.amount,
      'Pembayaran dari admin - ' || NEW.payment_reference,
      sw.available_balance - NEW.amount,  -- balance BEFORE this payment
      sw.available_balance,                -- balance AFTER this payment
      NOW()
    FROM supplier_wallets sw
    WHERE sw.id = NEW.wallet_id;

    -- Create notification for SUPPLIER
    INSERT INTO notifications (
      recipient_id,
      title,
      message,
      type,
      priority,
      action_url,
      metadata
    )
    VALUES (
      v_supplier_profile_id,
      '💰 Pembayaran Diterima',
      format('Anda menerima pembayaran sebesar Rp %s dari admin. Ref: %s', 
        to_char(NEW.amount, 'FM999,999,999'), 
        NEW.payment_reference
      ),
      'PAYMENT_RECEIVED',
      'NORMAL',
      '/supplier/wallet',
      jsonb_build_object(
        'payment_id', NEW.id,
        'amount', NEW.amount,
        'payment_reference', NEW.payment_reference,
        'payment_date', NEW.payment_date,
        'bank_name', NEW.bank_name,
        'payment_proof_url', NEW.payment_proof_url
      )
    );

    RAISE NOTICE '✅ Payment processed: Rp % paid to %, wallet updated, notification sent', 
      NEW.amount, v_supplier_name;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PART 2: Create Trigger
-- ========================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_supplier_payment_notification ON supplier_payments;

-- Create trigger
CREATE TRIGGER trigger_supplier_payment_notification
  AFTER INSERT OR UPDATE ON supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_supplier_payment();

-- ========================================
-- PART 3: Manual Update for Existing Payment
-- ========================================

-- If payment already exists, manually update wallet
DO $$ 
DECLARE
  v_payment RECORD;
BEGIN
  -- Find recent COMPLETED payments that haven't updated wallet yet
  FOR v_payment IN 
    SELECT 
      sp.id,
      sp.supplier_id,
      sp.wallet_id,
      sp.amount,
      sp.payment_reference,
      s.business_name
    FROM supplier_payments sp
    JOIN suppliers s ON s.id = sp.supplier_id
    WHERE sp.status = 'COMPLETED'
      AND sp.created_at > NOW() - INTERVAL '1 day'
  LOOP
    -- Check if wallet transaction already exists
    IF NOT EXISTS (
      SELECT 1 FROM wallet_transactions 
      WHERE description LIKE '%' || v_payment.payment_reference || '%'
    ) THEN
      -- Update wallet balance
      UPDATE supplier_wallets
      SET available_balance = available_balance + v_payment.amount
      WHERE id = v_payment.wallet_id;
      
      -- Create wallet transaction
      INSERT INTO wallet_transactions (
        wallet_id,
        transaction_type,
        amount,
        description,
        balance_before,
        balance_after
      )
      SELECT 
        v_payment.wallet_id,
        'PAYMENT_RECEIVED',
        v_payment.amount,
        'Pembayaran dari admin - ' || v_payment.payment_reference,
        sw.available_balance - v_payment.amount,  -- balance BEFORE
        sw.available_balance                       -- balance AFTER
      FROM supplier_wallets sw
      WHERE sw.id = v_payment.wallet_id;
      
      RAISE NOTICE '✅ Retroactively processed payment % for %', 
        v_payment.payment_reference, v_payment.business_name;
    END IF;
  END LOOP;
END $$;

-- ========================================
-- PART 4: Verify Setup
-- ========================================

DO $$ 
BEGIN
    RAISE NOTICE '✅ Supplier payment notification system configured!';
    RAISE NOTICE '✅ When admin pays supplier:';
    RAISE NOTICE '   1. Wallet balance updated automatically';
    RAISE NOTICE '   2. Wallet transaction record created';
    RAISE NOTICE '   3. Notification sent to supplier with payment details';
END $$;

-- Show trigger info
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_supplier_payment_notification';

-- Show recent wallet balances
SELECT 
    s.business_name,
    sw.available_balance,
    sw.updated_at
FROM supplier_wallets sw
JOIN suppliers s ON s.id = sw.supplier_id
ORDER BY sw.updated_at DESC
LIMIT 5;

SELECT '✅ Supplier payment notification system ready! Existing payments processed retroactively.' AS status;
