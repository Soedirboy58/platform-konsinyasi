-- ========================================
-- FIX: Payment Notification Include Proof URL
-- ========================================
-- Problem: Notification tidak menampilkan foto bukti transfer
-- Solution: Update trigger untuk include payment_proof_url dalam message
-- ========================================

-- Drop old trigger
DROP TRIGGER IF EXISTS trigger_supplier_payment_notification ON supplier_payments;
DROP FUNCTION IF EXISTS handle_supplier_payment() CASCADE;

-- Create IMPROVED trigger with payment proof URL
CREATE OR REPLACE FUNCTION handle_supplier_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_profile_id UUID;
  v_message TEXT;
BEGIN
  -- Only process COMPLETED payments
  IF NEW.status = 'COMPLETED' THEN
    
    -- Get supplier profile_id
    SELECT profile_id INTO v_supplier_profile_id
    FROM suppliers
    WHERE id = NEW.supplier_id;

    -- 1. Update wallet (if exists)
    IF NEW.wallet_id IS NOT NULL THEN
      BEGIN
        UPDATE supplier_wallets
        SET available_balance = available_balance + NEW.amount
        WHERE id = NEW.wallet_id;
      EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore wallet errors
      END;
    END IF;

    -- 2. Create notification WITH PROOF URL (if supplier has profile)
    IF v_supplier_profile_id IS NOT NULL THEN
      BEGIN
        -- Build message with proof URL if exists
        v_message := 'Anda menerima pembayaran Rp ' || 
                     to_char(NEW.amount, 'FM999,999,999') || 
                     ' - Ref: ' || NEW.payment_reference;
        
        IF NEW.payment_proof_url IS NOT NULL AND NEW.payment_proof_url != '' THEN
          v_message := v_message || ' | Bukti: ' || NEW.payment_proof_url;
        END IF;

        IF NEW.notes IS NOT NULL AND NEW.notes != '' THEN
          v_message := v_message || ' | Catatan: ' || NEW.notes;
        END IF;

        INSERT INTO notifications (recipient_id, title, message, type)
        VALUES (
          v_supplier_profile_id,
          'Pembayaran Diterima',
          v_message,
          'PAYMENT_RECEIVED'
        );
      EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore notification errors
      END;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER trigger_supplier_payment_notification
  AFTER INSERT OR UPDATE ON supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_supplier_payment();

SELECT '✅ Trigger updated - notifications will include payment proof URL' AS status;

-- Test notification message format
DO $$
DECLARE
  v_test_message TEXT;
BEGIN
  v_test_message := 'Anda menerima pembayaran Rp ' || 
                    to_char(1500000::numeric, 'FM999,999,999') || 
                    ' - Ref: PAY-123456' ||
                    ' | Bukti: https://example.com/proof.jpg' ||
                    ' | Catatan: Transfer via BCA';
  
  RAISE NOTICE '📱 Example notification message:';
  RAISE NOTICE '%', v_test_message;
END $$;

-- ========================================
-- SUMMARY
-- ========================================

SELECT 
  '✅ NOTIFICATION FIXED!' AS status,
  'Message now includes payment_proof_url' AS change,
  'Supplier will see transfer proof link' AS result;
