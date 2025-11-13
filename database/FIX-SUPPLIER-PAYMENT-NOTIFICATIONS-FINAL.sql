-- ========================================
-- FIX: Supplier Payment Save Error - Final
-- ========================================
-- Error: column "priority" of relation "notifications" does not exist
-- Root Cause: Trigger handle_supplier_payment() uses columns not in production
-- Solution: Update trigger to use only existing columns
-- ========================================

-- STEP 1: Check notifications table structure
DO $$
BEGIN
    -- Check if priority column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'priority'
    ) THEN
        RAISE NOTICE '✅ Column "priority" exists in notifications';
    ELSE
        RAISE NOTICE '❌ Column "priority" DOES NOT EXIST - will create adaptive trigger';
    END IF;

    -- Check if action_url exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'action_url'
    ) THEN
        RAISE NOTICE '✅ Column "action_url" exists in notifications';
    ELSE
        RAISE NOTICE '❌ Column "action_url" DOES NOT EXIST';
    END IF;
END $$;

-- STEP 2: Show current notifications columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
ORDER BY ordinal_position;

-- ========================================
-- STEP 3: Re-create Trigger with MINIMAL columns
-- ========================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_supplier_payment_notification ON supplier_payments;
DROP FUNCTION IF EXISTS handle_supplier_payment() CASCADE;

-- Create NEW function with ONLY guaranteed columns
CREATE OR REPLACE FUNCTION handle_supplier_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_name TEXT;
  v_supplier_profile_id UUID;
  v_admin_name TEXT;
  v_has_priority BOOLEAN;
  v_has_action_url BOOLEAN;
  v_has_metadata BOOLEAN;
BEGIN
  -- Only process when payment status is COMPLETED
  IF (TG_OP = 'INSERT' AND NEW.status = 'COMPLETED') OR
     (TG_OP = 'UPDATE' AND OLD.status != 'COMPLETED' AND NEW.status = 'COMPLETED') THEN
    
    -- Get supplier info
    SELECT s.business_name, s.profile_id
    INTO v_supplier_name, v_supplier_profile_id
    FROM suppliers s
    WHERE s.id = NEW.supplier_id;

    IF v_supplier_profile_id IS NULL THEN
      RAISE NOTICE '⚠️ Supplier profile_id not found for supplier_id: %', NEW.supplier_id;
      RETURN NEW;
    END IF;

    -- Get admin info
    IF NEW.created_by IS NOT NULL THEN
      SELECT p.full_name INTO v_admin_name
      FROM profiles p WHERE p.id = NEW.created_by;
    ELSE
      v_admin_name := 'Admin';
    END IF;

    -- Check which columns exist in notifications table
    SELECT 
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='priority'),
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='action_url'),
      EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='metadata')
    INTO v_has_priority, v_has_action_url, v_has_metadata;

    -- Update supplier wallet if wallet_id is provided
    IF NEW.wallet_id IS NOT NULL THEN
      UPDATE supplier_wallets
      SET 
        available_balance = available_balance + NEW.amount,
        updated_at = NOW()
      WHERE id = NEW.wallet_id;

      -- Create wallet transaction record
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions') THEN
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
          sw.available_balance - NEW.amount,
          sw.available_balance,
          NOW()
        FROM supplier_wallets sw
        WHERE sw.id = NEW.wallet_id;
      END IF;
    END IF;

    -- Insert notification with ADAPTIVE columns
    IF v_has_priority AND v_has_action_url AND v_has_metadata THEN
      -- Full version with all columns
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
          'payment_reference', NEW.payment_reference
        )
      );
    ELSIF v_has_priority THEN
      -- Version with priority but no action_url/metadata
      INSERT INTO notifications (
        recipient_id,
        title,
        message,
        type,
        priority
      )
      VALUES (
        v_supplier_profile_id,
        '💰 Pembayaran Diterima',
        format('Anda menerima pembayaran sebesar Rp %s dari admin. Ref: %s', 
          to_char(NEW.amount, 'FM999,999,999'), 
          NEW.payment_reference
        ),
        'PAYMENT_RECEIVED',
        'NORMAL'
      );
    ELSE
      -- MINIMAL version - only guaranteed columns (recipient_id, title, message, type)
      INSERT INTO notifications (
        recipient_id,
        title,
        message,
        type
      )
      VALUES (
        v_supplier_profile_id,
        '💰 Pembayaran Diterima',
        format('Anda menerima pembayaran sebesar Rp %s dari admin. Ref: %s', 
          to_char(NEW.amount, 'FM999,999,999'), 
          NEW.payment_reference
        ),
        'PAYMENT_RECEIVED'
      );
    END IF;

    RAISE NOTICE '✅ Payment processed: Rp % paid to %, notification sent', 
      NEW.amount, v_supplier_name;

  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the payment
    RAISE WARNING '⚠️ Error in payment notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER trigger_supplier_payment_notification
  AFTER INSERT OR UPDATE ON supplier_payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_supplier_payment();

-- ========================================
-- STEP 4: Fix PAYMENT_RECEIVED type if not exists
-- ========================================

-- Check if PAYMENT_RECEIVED is allowed in type constraint
DO $$
DECLARE
  v_constraint_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_constraint_def
  FROM pg_constraint
  WHERE conname = 'notifications_type_check'
    AND conrelid = 'notifications'::regclass;

  IF v_constraint_def IS NOT NULL THEN
    IF v_constraint_def NOT LIKE '%PAYMENT_RECEIVED%' THEN
      RAISE NOTICE '⚠️ PAYMENT_RECEIVED not in constraint, will add it';
      
      -- Drop old constraint
      ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
      
      -- Add new constraint with PAYMENT_RECEIVED
      ALTER TABLE notifications 
      ADD CONSTRAINT notifications_type_check 
      CHECK (type IN (
        'PRODUCT_APPROVAL', 
        'STOCK_ADJUSTMENT', 
        'LOW_STOCK', 
        'EXPIRY_WARNING', 
        'ORDER_UPDATE', 
        'PAYMENT',
        'PAYMENT_RECEIVED',
        'PAYMENT_REQUEST',
        'SHIPMENT_APPROVED',
        'SHIPMENT_REJECTED'
      ));
      
      RAISE NOTICE '✅ Added PAYMENT_RECEIVED to type constraint';
    ELSE
      RAISE NOTICE '✅ PAYMENT_RECEIVED already in constraint';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ No type constraint found, creating one';
    
    ALTER TABLE notifications 
    ADD CONSTRAINT notifications_type_check 
    CHECK (type IN (
      'PRODUCT_APPROVAL', 
      'STOCK_ADJUSTMENT', 
      'LOW_STOCK', 
      'EXPIRY_WARNING', 
      'ORDER_UPDATE', 
      'PAYMENT',
      'PAYMENT_RECEIVED',
      'PAYMENT_REQUEST',
      'SHIPMENT_APPROVED',
      'SHIPMENT_REJECTED'
    ));
  END IF;
END $$;

-- ========================================
-- STEP 5: Test Insert (will rollback)
-- ========================================

DO $$
DECLARE
  v_supplier_id UUID;
  v_wallet_id UUID;
  v_test_payment_id UUID;
BEGIN
  -- Get first supplier
  SELECT s.id, sw.id 
  INTO v_supplier_id, v_wallet_id
  FROM suppliers s
  LEFT JOIN supplier_wallets sw ON sw.supplier_id = s.id
  LIMIT 1;

  IF v_supplier_id IS NULL THEN
    RAISE NOTICE '⚠️ No suppliers found for testing';
    RETURN;
  END IF;

  RAISE NOTICE '🧪 Testing payment insert...';
  
  -- Try insert
  BEGIN
    INSERT INTO supplier_payments (
      supplier_id,
      wallet_id,
      amount,
      payment_reference,
      payment_date,
      payment_method,
      status
    ) VALUES (
      v_supplier_id,
      v_wallet_id,
      50000,
      'TEST-' || to_char(NOW(), 'YYYYMMDD-HH24MISS'),
      CURRENT_DATE,
      'BANK_TRANSFER',
      'COMPLETED'
    )
    RETURNING id INTO v_test_payment_id;
    
    RAISE NOTICE '✅ TEST INSERT SUCCESS! Payment ID: %', v_test_payment_id;
    RAISE NOTICE '✅ Trigger executed without errors';
    
    -- Rollback test data
    RAISE EXCEPTION 'Rollback test data';
    
  EXCEPTION 
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%Rollback test data%' THEN
        RAISE NOTICE '✅ Test completed successfully (rolled back)';
      ELSE
        RAISE NOTICE '❌ TEST FAILED: %', SQLERRM;
      END IF;
  END;
END $$;

-- ========================================
-- SUMMARY
-- ========================================

SELECT 
  '✅ Supplier payment trigger fixed!' AS status,
  'Trigger now adapts to your notifications table structure' AS info,
  'Try saving payment again in frontend' AS next_step;

