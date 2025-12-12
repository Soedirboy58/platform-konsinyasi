-- ========================================
-- TEST: approve_stock_movement Race Condition Fix
-- ========================================
-- Purpose: Verify that the fixed function prevents
--          duplicate inventory additions
-- Date: 2025-12-12
-- ========================================

-- SETUP: Create test data
-- ========================================

DO $$
DECLARE
  v_test_supplier_id UUID;
  v_test_location_id UUID;
  v_test_product_id UUID;
  v_test_movement_id UUID;
  v_admin_id UUID;
BEGIN
  -- Get or create test supplier
  SELECT id INTO v_test_supplier_id
  FROM suppliers
  WHERE business_name = 'TEST_SUPPLIER_RACE_CONDITION'
  LIMIT 1;
  
  IF v_test_supplier_id IS NULL THEN
    INSERT INTO suppliers (business_name, owner_name, phone, address, status)
    VALUES ('TEST_SUPPLIER_RACE_CONDITION', 'Test Owner', '08123456789', 'Test Address', 'APPROVED')
    RETURNING id INTO v_test_supplier_id;
  END IF;

  -- Get or create test location
  SELECT id INTO v_test_location_id
  FROM locations
  WHERE name = 'TEST_LOCATION_RACE_CONDITION'
  LIMIT 1;
  
  IF v_test_location_id IS NULL THEN
    INSERT INTO locations (name, address, type, is_active, qr_code)
    VALUES ('TEST_LOCATION_RACE_CONDITION', 'Test Location', 'OUTLET', TRUE, 'test_race_condition')
    RETURNING id INTO v_test_location_id;
  END IF;

  -- Get or create test product
  SELECT id INTO v_test_product_id
  FROM products
  WHERE name = 'TEST_PRODUCT_RACE_CONDITION'
    AND supplier_id = v_test_supplier_id
  LIMIT 1;
  
  IF v_test_product_id IS NULL THEN
    INSERT INTO products (supplier_id, name, description, photo_url, price, status)
    VALUES (v_test_supplier_id, 'TEST_PRODUCT_RACE_CONDITION', 'Test Product', 'test.jpg', 10000, 'APPROVED')
    RETURNING id INTO v_test_product_id;
  END IF;

  -- Get admin user
  SELECT id INTO v_admin_id
  FROM profiles
  WHERE role = 'ADMIN'
  LIMIT 1;
  
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Create an admin user first.';
  END IF;

  RAISE NOTICE 'Test data created:';
  RAISE NOTICE '  Supplier ID: %', v_test_supplier_id;
  RAISE NOTICE '  Location ID: %', v_test_location_id;
  RAISE NOTICE '  Product ID: %', v_test_product_id;
  RAISE NOTICE '  Admin ID: %', v_admin_id;
END $$;

-- ========================================
-- TEST 1: Single Approval (Should Work)
-- ========================================

DO $$
DECLARE
  v_test_supplier_id UUID;
  v_test_location_id UUID;
  v_test_product_id UUID;
  v_test_movement_id UUID;
  v_admin_id UUID;
  v_inventory_before INTEGER;
  v_inventory_after INTEGER;
BEGIN
  -- Get test IDs
  SELECT id INTO v_test_supplier_id FROM suppliers WHERE business_name = 'TEST_SUPPLIER_RACE_CONDITION';
  SELECT id INTO v_test_location_id FROM locations WHERE name = 'TEST_LOCATION_RACE_CONDITION';
  SELECT id INTO v_test_product_id FROM products WHERE name = 'TEST_PRODUCT_RACE_CONDITION';
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'ADMIN' LIMIT 1;

  -- Clean up previous test data
  DELETE FROM stock_movement_items WHERE movement_id IN (
    SELECT id FROM stock_movements WHERE supplier_id = v_test_supplier_id
  );
  DELETE FROM stock_movements WHERE supplier_id = v_test_supplier_id;
  DELETE FROM inventory_levels WHERE product_id = v_test_product_id AND location_id = v_test_location_id;

  RAISE NOTICE '=== TEST 1: Single Approval ===';

  -- Get initial inventory
  SELECT COALESCE(quantity, 0) INTO v_inventory_before
  FROM inventory_levels
  WHERE product_id = v_test_product_id AND location_id = v_test_location_id;
  
  RAISE NOTICE 'Inventory before: %', v_inventory_before;

  -- Create test shipment
  INSERT INTO stock_movements (supplier_id, location_id, status, movement_type)
  VALUES (v_test_supplier_id, v_test_location_id, 'PENDING', 'IN')
  RETURNING id INTO v_test_movement_id;

  -- Add items to shipment
  INSERT INTO stock_movement_items (movement_id, product_id, quantity)
  VALUES (v_test_movement_id, v_test_product_id, 8);

  RAISE NOTICE 'Created shipment % with 8 units', v_test_movement_id;

  -- Approve shipment
  PERFORM approve_stock_movement(v_test_movement_id, v_admin_id);
  RAISE NOTICE 'Approved shipment';

  -- Get inventory after approval
  SELECT COALESCE(quantity, 0) INTO v_inventory_after
  FROM inventory_levels
  WHERE product_id = v_test_product_id AND location_id = v_test_location_id;
  
  RAISE NOTICE 'Inventory after: %', v_inventory_after;
  RAISE NOTICE 'Expected: % (before) + 8 = %', v_inventory_before, v_inventory_before + 8;

  -- Verify
  IF v_inventory_after = v_inventory_before + 8 THEN
    RAISE NOTICE '✓ TEST 1 PASSED: Inventory correctly increased by 8';
  ELSE
    RAISE EXCEPTION '✗ TEST 1 FAILED: Expected %, got %', v_inventory_before + 8, v_inventory_after;
  END IF;
END $$;

-- ========================================
-- TEST 2: Duplicate Approval (Should Fail)
-- ========================================

DO $$
DECLARE
  v_test_supplier_id UUID;
  v_test_location_id UUID;
  v_test_product_id UUID;
  v_test_movement_id UUID;
  v_admin_id UUID;
  v_inventory_before INTEGER;
  v_inventory_after_first INTEGER;
  v_inventory_after_second INTEGER;
  v_error_caught BOOLEAN := FALSE;
BEGIN
  -- Get test IDs
  SELECT id INTO v_test_supplier_id FROM suppliers WHERE business_name = 'TEST_SUPPLIER_RACE_CONDITION';
  SELECT id INTO v_test_location_id FROM locations WHERE name = 'TEST_LOCATION_RACE_CONDITION';
  SELECT id INTO v_test_product_id FROM products WHERE name = 'TEST_PRODUCT_RACE_CONDITION';
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'ADMIN' LIMIT 1;

  RAISE NOTICE '=== TEST 2: Duplicate Approval ===';

  -- Get initial inventory
  SELECT COALESCE(quantity, 0) INTO v_inventory_before
  FROM inventory_levels
  WHERE product_id = v_test_product_id AND location_id = v_test_location_id;
  
  RAISE NOTICE 'Inventory before: %', v_inventory_before;

  -- Create new test shipment
  INSERT INTO stock_movements (supplier_id, location_id, status, movement_type)
  VALUES (v_test_supplier_id, v_test_location_id, 'PENDING', 'IN')
  RETURNING id INTO v_test_movement_id;

  INSERT INTO stock_movement_items (movement_id, product_id, quantity)
  VALUES (v_test_movement_id, v_test_product_id, 10);

  RAISE NOTICE 'Created shipment % with 10 units', v_test_movement_id;

  -- First approval (should succeed)
  PERFORM approve_stock_movement(v_test_movement_id, v_admin_id);
  RAISE NOTICE 'First approval succeeded';

  SELECT COALESCE(quantity, 0) INTO v_inventory_after_first
  FROM inventory_levels
  WHERE product_id = v_test_product_id AND location_id = v_test_location_id;
  
  RAISE NOTICE 'Inventory after first approval: %', v_inventory_after_first;

  -- Second approval (should fail)
  BEGIN
    PERFORM approve_stock_movement(v_test_movement_id, v_admin_id);
    RAISE NOTICE 'Second approval did not raise error - THIS IS BAD!';
  EXCEPTION 
    WHEN OTHERS THEN
      v_error_caught := TRUE;
      RAISE NOTICE 'Second approval correctly raised error: %', SQLERRM;
  END;

  -- Get inventory after attempted second approval
  SELECT COALESCE(quantity, 0) INTO v_inventory_after_second
  FROM inventory_levels
  WHERE product_id = v_test_product_id AND location_id = v_test_location_id;
  
  RAISE NOTICE 'Inventory after second approval attempt: %', v_inventory_after_second;

  -- Verify
  IF v_error_caught AND v_inventory_after_second = v_inventory_after_first THEN
    RAISE NOTICE '✓ TEST 2 PASSED: Second approval blocked, inventory unchanged';
  ELSE
    RAISE EXCEPTION '✗ TEST 2 FAILED: Second approval should have been blocked';
  END IF;
END $$;

-- ========================================
-- TEST 3: Rapid Sequential Approvals
-- ========================================

DO $$
DECLARE
  v_test_supplier_id UUID;
  v_test_location_id UUID;
  v_test_product_id UUID;
  v_admin_id UUID;
  v_movement_ids UUID[];
  v_inventory_initial INTEGER;
  v_inventory_final INTEGER;
  v_expected INTEGER;
  i INTEGER;
BEGIN
  -- Get test IDs
  SELECT id INTO v_test_supplier_id FROM suppliers WHERE business_name = 'TEST_SUPPLIER_RACE_CONDITION';
  SELECT id INTO v_test_location_id FROM locations WHERE name = 'TEST_LOCATION_RACE_CONDITION';
  SELECT id INTO v_test_product_id FROM products WHERE name = 'TEST_PRODUCT_RACE_CONDITION';
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'ADMIN' LIMIT 1;

  RAISE NOTICE '=== TEST 3: Rapid Sequential Approvals ===';

  -- Get initial inventory
  SELECT COALESCE(quantity, 0) INTO v_inventory_initial
  FROM inventory_levels
  WHERE product_id = v_test_product_id AND location_id = v_test_location_id;
  
  RAISE NOTICE 'Initial inventory: %', v_inventory_initial;

  -- Create 5 shipments
  FOR i IN 1..5 LOOP
    DECLARE
      v_movement_id UUID;
    BEGIN
      INSERT INTO stock_movements (supplier_id, location_id, status, movement_type)
      VALUES (v_test_supplier_id, v_test_location_id, 'PENDING', 'IN')
      RETURNING id INTO v_movement_id;

      INSERT INTO stock_movement_items (movement_id, product_id, quantity)
      VALUES (v_movement_id, v_test_product_id, 5);

      v_movement_ids := array_append(v_movement_ids, v_movement_id);
      RAISE NOTICE 'Created shipment % (5 units)', i;
    END;
  END LOOP;

  -- Approve all shipments rapidly
  FOREACH v_movement_id IN ARRAY v_movement_ids LOOP
    PERFORM approve_stock_movement(v_movement_id, v_admin_id);
    RAISE NOTICE 'Approved shipment %', v_movement_id;
  END LOOP;

  -- Get final inventory
  SELECT COALESCE(quantity, 0) INTO v_inventory_final
  FROM inventory_levels
  WHERE product_id = v_test_product_id AND location_id = v_test_location_id;
  
  v_expected := v_inventory_initial + 25;  -- 5 shipments × 5 units
  
  RAISE NOTICE 'Final inventory: %', v_inventory_final;
  RAISE NOTICE 'Expected: %', v_expected;

  -- Verify
  IF v_inventory_final = v_expected THEN
    RAISE NOTICE '✓ TEST 3 PASSED: All shipments processed correctly (% + 25 = %)', v_inventory_initial, v_inventory_final;
  ELSE
    RAISE EXCEPTION '✗ TEST 3 FAILED: Expected %, got %', v_expected, v_inventory_final;
  END IF;
END $$;

-- ========================================
-- CLEANUP
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '=== CLEANUP ===';
  
  DELETE FROM stock_movement_items WHERE movement_id IN (
    SELECT sm.id FROM stock_movements sm
    JOIN suppliers s ON s.id = sm.supplier_id
    WHERE s.business_name = 'TEST_SUPPLIER_RACE_CONDITION'
  );
  
  DELETE FROM stock_movements WHERE supplier_id IN (
    SELECT id FROM suppliers WHERE business_name = 'TEST_SUPPLIER_RACE_CONDITION'
  );
  
  DELETE FROM inventory_levels WHERE product_id IN (
    SELECT id FROM products WHERE name = 'TEST_PRODUCT_RACE_CONDITION'
  );
  
  DELETE FROM products WHERE name = 'TEST_PRODUCT_RACE_CONDITION';
  DELETE FROM locations WHERE name = 'TEST_LOCATION_RACE_CONDITION';
  DELETE FROM suppliers WHERE business_name = 'TEST_SUPPLIER_RACE_CONDITION';
  
  RAISE NOTICE 'Test data cleaned up';
END $$;

-- ========================================
-- SUMMARY
-- ========================================

SELECT 
  '=== ALL TESTS COMPLETED ===' AS summary,
  'If you see this message without errors, all tests passed!' AS result;
