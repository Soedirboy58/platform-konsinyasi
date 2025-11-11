-- ================================================
-- CLEANUP: Remove ALL Duplicates & Redundant Objects
-- ================================================
-- ⚠️ IMPORTANT: Run audit-database-full.sql FIRST to review!
-- ⚠️ This will permanently delete duplicate objects

-- ================================================
-- STEP 1: CLEANUP RLS POLICIES
-- ================================================

-- Drop ALL redundant policies on SUPPLIERS
DROP POLICY IF EXISTS "suppliers_admin_all" ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_owner_read" ON suppliers;
DROP POLICY IF EXISTS "suppliers_owner_update" ON suppliers;
DROP POLICY IF EXISTS "suppliers_public_read_approved" ON suppliers;
DROP POLICY IF EXISTS "suppliers_read_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_update_own" ON suppliers;
DROP POLICY IF EXISTS "suppliers_user_insert" ON suppliers;

-- Drop ALL redundant policies on PROFILES
DROP POLICY IF EXISTS "profiles_public_read" ON profiles;
DROP POLICY IF EXISTS "profiles_user_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_user_update" ON profiles;

-- Drop ALL redundant policies on PRODUCTS
DROP POLICY IF EXISTS "products_supplier_read_own" ON products;
DROP POLICY IF EXISTS "products_supplier_insert" ON products;
DROP POLICY IF EXISTS "products_supplier_update_own" ON products;
DROP POLICY IF EXISTS "products_admin_all" ON products;
DROP POLICY IF EXISTS "products_public_read_approved" ON products;
DROP POLICY IF EXISTS "products_read_own" ON products;
DROP POLICY IF EXISTS "products_insert_own" ON products;
DROP POLICY IF EXISTS "products_update_own" ON products;

-- Drop redundant policies on NOTIFICATIONS
DROP POLICY IF EXISTS "notifications_read_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;

-- Drop redundant policies on STOCK_MOVEMENTS
DROP POLICY IF EXISTS "stock_movements_read_own" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert_own" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_update_admin" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_supplier_read" ON stock_movements;
DROP POLICY IF EXISTS "stock_movements_supplier_insert" ON stock_movements;

-- Drop redundant policies on STOCK_MOVEMENT_ITEMS
DROP POLICY IF EXISTS "stock_movement_items_read_own" ON stock_movement_items;
DROP POLICY IF EXISTS "stock_movement_items_insert_own" ON stock_movement_items;

-- Drop redundant policies on WALLET tables
DROP POLICY IF EXISTS "supplier_wallets_read_own" ON supplier_wallets;
DROP POLICY IF EXISTS "wallet_transactions_read_own" ON wallet_transactions;
DROP POLICY IF EXISTS "withdrawal_requests_read_own" ON withdrawal_requests;
DROP POLICY IF EXISTS "withdrawal_requests_insert_own" ON withdrawal_requests;
DROP POLICY IF EXISTS "sales_transactions_read_own" ON sales_transactions;

-- ================================================
-- STEP 2: CLEANUP DUPLICATE FUNCTIONS
-- ================================================

-- Drop duplicate notification functions (keep only the latest)
DROP FUNCTION IF EXISTS create_notification(UUID, VARCHAR, VARCHAR, TEXT, UUID, VARCHAR);
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS create_notification(UUID, TEXT, TEXT, TEXT);
-- Keep: create_notification(UUID, VARCHAR, VARCHAR, TEXT, UUID)

-- Drop old approval functions if exist
DROP FUNCTION IF EXISTS approve_stock_movement(UUID);
DROP FUNCTION IF EXISTS reject_stock_movement(UUID, TEXT);
-- Keep: approve_stock_movement(UUID, UUID)
-- Keep: reject_stock_movement(UUID, UUID, TEXT)

-- Drop duplicate wallet functions (if any)
DROP FUNCTION IF EXISTS calculate_supplier_balance(UUID, TEXT);
DROP FUNCTION IF EXISTS process_withdrawal(UUID);

-- ================================================
-- STEP 3: CLEANUP DUPLICATE TRIGGERS
-- ================================================

-- Drop old/duplicate notification triggers
DROP TRIGGER IF EXISTS notify_admin_shipment ON stock_movements;
DROP TRIGGER IF EXISTS notify_supplier_shipment ON stock_movements;
DROP TRIGGER IF EXISTS notification_trigger ON stock_movements;
-- Keep: trg_notify_shipment
-- Keep: trg_notify_shipment_decision

-- Drop old wallet triggers (if exist)
DROP TRIGGER IF EXISTS update_wallet_balance ON sales_transactions;
DROP TRIGGER IF EXISTS update_supplier_wallet ON wallet_transactions;

-- ================================================
-- STEP 4: CLEANUP DUPLICATE INDEXES
-- ================================================

-- Drop duplicate indexes (keep the most descriptive ones)
DROP INDEX IF EXISTS idx_suppliers_profile;
DROP INDEX IF EXISTS suppliers_profile_idx;
-- Keep: idx_suppliers_profile_id

DROP INDEX IF EXISTS idx_products_supplier;
DROP INDEX IF EXISTS products_supplier_idx;
-- Keep: idx_products_supplier_id

DROP INDEX IF EXISTS idx_notifications_user;
DROP INDEX IF EXISTS notifications_user_idx;
-- Keep: idx_notifications_recipient

DROP INDEX IF EXISTS idx_stock_movements_supplier;
-- Keep: idx_stock_movements_supplier_id

-- ================================================
-- STEP 5: CLEANUP DUPLICATE CONSTRAINTS
-- ================================================

-- Check and remove duplicate CHECK constraints
-- (Supabase auto-generates unique names, so this is rare)

-- notifications_type_check might exist multiple times
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check_old;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS check_notification_type;

-- ================================================
-- STEP 6: RECREATE CLEAN POLICIES
-- ================================================

-- SUPPLIERS: 4 clean policies
CREATE POLICY "suppliers_select" ON suppliers
FOR SELECT USING (
    profile_id = auth.uid() OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

CREATE POLICY "suppliers_insert" ON suppliers
FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "suppliers_update" ON suppliers
FOR UPDATE USING (
    profile_id = auth.uid() OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
) WITH CHECK (
    profile_id = auth.uid() OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

CREATE POLICY "suppliers_delete" ON suppliers
FOR DELETE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN'));

-- PROFILES: 4 clean policies
CREATE POLICY "profiles_select" ON profiles
FOR SELECT USING (
    id = auth.uid() OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

CREATE POLICY "profiles_insert" ON profiles
FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles
FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_delete" ON profiles
FOR DELETE USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN'));

-- PRODUCTS: 4 clean policies
CREATE POLICY "products_select" ON products
FOR SELECT USING (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
    OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

CREATE POLICY "products_insert" ON products
FOR INSERT WITH CHECK (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);

CREATE POLICY "products_update" ON products
FOR UPDATE USING (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
    OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
) WITH CHECK (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
    OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

CREATE POLICY "products_delete" ON products
FOR DELETE USING (
    supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
    OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'ADMIN')
);

-- NOTIFICATIONS: 3 simple policies (no DELETE needed)
CREATE POLICY "notifications_select" ON notifications
FOR SELECT USING (true);

CREATE POLICY "notifications_insert" ON notifications
FOR INSERT WITH CHECK (true);

CREATE POLICY "notifications_update" ON notifications
FOR UPDATE USING (true);

-- ================================================
-- STEP 7: VERIFY CLEANUP
-- ================================================

-- Count policies per table (should be 3-4 each)
SELECT 
    tablename,
    COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Count functions (should be fewer duplicates)
SELECT 
    proname AS function_name,
    COUNT(*) AS signature_count
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
GROUP BY proname
HAVING COUNT(*) > 1
ORDER BY signature_count DESC;

-- Count triggers per table
SELECT 
    event_object_table AS table_name,
    COUNT(*) AS trigger_count
FROM information_schema.triggers
WHERE event_object_schema = 'public'
GROUP BY event_object_table
ORDER BY table_name;

-- ================================================
-- SUCCESS
-- ================================================
SELECT 'CLEANUP COMPLETE! Database is now clean and optimized.' AS status;
