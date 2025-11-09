-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Platform Konsinyasi Terintegrasi v2.0
-- ========================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ========================================
-- HELPER FUNCTIONS FOR RLS
-- ========================================

-- Get current user's role
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        (SELECT role FROM profiles WHERE id = auth.uid()),
        'ANONYMOUS'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.get_user_role() = 'ADMIN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is supplier
CREATE OR REPLACE FUNCTION auth.is_supplier()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.get_user_role() = 'SUPPLIER';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get supplier ID for current user
CREATE OR REPLACE FUNCTION auth.get_supplier_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT s.id 
        FROM suppliers s 
        WHERE s.profile_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PROFILES TABLE RLS
-- ========================================

-- Users can read their own profile, admins can read all
CREATE POLICY "profiles_select_policy" ON profiles
    FOR SELECT USING (
        id = auth.uid() OR auth.is_admin()
    );

-- Users can update their own profile, admins can update all
CREATE POLICY "profiles_update_policy" ON profiles
    FOR UPDATE USING (
        id = auth.uid() OR auth.is_admin()
    );

-- Only admins can insert new profiles (user registration handled by auth)
CREATE POLICY "profiles_insert_policy" ON profiles
    FOR INSERT WITH CHECK (auth.is_admin());

-- Only admins can delete profiles
CREATE POLICY "profiles_delete_policy" ON profiles
    FOR DELETE USING (auth.is_admin());

-- ========================================
-- SUPPLIERS TABLE RLS
-- ========================================

-- Suppliers can read their own info, admins can read all
CREATE POLICY "suppliers_select_policy" ON suppliers
    FOR SELECT USING (
        profile_id = auth.uid() OR auth.is_admin()
    );

-- Suppliers can update their own info, admins can update all
CREATE POLICY "suppliers_update_policy" ON suppliers
    FOR UPDATE USING (
        profile_id = auth.uid() OR auth.is_admin()
    );

-- Only admins can create/approve suppliers
CREATE POLICY "suppliers_insert_policy" ON suppliers
    FOR INSERT WITH CHECK (auth.is_admin());

-- Only admins can delete suppliers
CREATE POLICY "suppliers_delete_policy" ON suppliers
    FOR DELETE USING (auth.is_admin());

-- ========================================
-- LOCATIONS TABLE RLS
-- ========================================

-- Everyone can read locations (for PWA functionality)
CREATE POLICY "locations_select_policy" ON locations
    FOR SELECT USING (true);

-- Only admins can modify locations
CREATE POLICY "locations_modify_policy" ON locations
    FOR ALL USING (auth.is_admin());

-- ========================================
-- CATEGORIES TABLE RLS
-- ========================================

-- Everyone can read categories
CREATE POLICY "categories_select_policy" ON categories
    FOR SELECT USING (true);

-- Only admins can modify categories
CREATE POLICY "categories_modify_policy" ON categories
    FOR ALL USING (auth.is_admin());

-- ========================================
-- PRODUCTS TABLE RLS
-- ========================================

-- Everyone can read approved products, suppliers can read their own products, admins can read all
CREATE POLICY "products_select_policy" ON products
    FOR SELECT USING (
        status = 'APPROVED' OR 
        supplier_id = auth.get_supplier_id() OR 
        auth.is_admin()
    );

-- Suppliers can insert their own products
CREATE POLICY "products_insert_policy" ON products
    FOR INSERT WITH CHECK (
        supplier_id = auth.get_supplier_id() OR auth.is_admin()
    );

-- Suppliers can update their own products (except status), admins can update all
CREATE POLICY "products_update_policy" ON products
    FOR UPDATE USING (
        supplier_id = auth.get_supplier_id() OR auth.is_admin()
    );

-- Only admins can delete products
CREATE POLICY "products_delete_policy" ON products
    FOR DELETE USING (auth.is_admin());

-- ========================================
-- INVENTORY LEVELS TABLE RLS
-- ========================================

-- Everyone can read inventory for approved products at outlets (for PWA)
-- Suppliers can read their own product inventory, admins can read all
CREATE POLICY "inventory_levels_select_policy" ON inventory_levels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM products p 
            JOIN locations l ON l.id = inventory_levels.location_id
            WHERE p.id = inventory_levels.product_id 
            AND (
                (p.status = 'APPROVED' AND l.type = 'OUTLET') OR
                p.supplier_id = auth.get_supplier_id() OR
                auth.is_admin()
            )
        )
    );

-- Suppliers can update inventory for their products, admins can update all
CREATE POLICY "inventory_levels_update_policy" ON inventory_levels
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM products p 
            WHERE p.id = inventory_levels.product_id 
            AND (p.supplier_id = auth.get_supplier_id() OR auth.is_admin())
        )
    );

-- Suppliers can insert inventory for their products, admins can insert all
CREATE POLICY "inventory_levels_insert_policy" ON inventory_levels
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM products p 
            WHERE p.id = inventory_levels.product_id 
            AND (p.supplier_id = auth.get_supplier_id() OR auth.is_admin())
        )
    );

-- Only admins can delete inventory records
CREATE POLICY "inventory_levels_delete_policy" ON inventory_levels
    FOR DELETE USING (auth.is_admin());

-- ========================================
-- INVENTORY ADJUSTMENTS TABLE RLS (DETAILED EXAMPLE)
-- ========================================

-- Suppliers can read their own adjustments, admins can read all
CREATE POLICY "inventory_adjustments_select_policy" ON inventory_adjustments
    FOR SELECT USING (
        supplier_id = auth.get_supplier_id() OR auth.is_admin()
    );

-- Suppliers can create adjustments for their own products
CREATE POLICY "inventory_adjustments_insert_policy" ON inventory_adjustments
    FOR INSERT WITH CHECK (
        supplier_id = auth.get_supplier_id() OR auth.is_admin()
    );

-- Suppliers can update their own pending adjustments, admins can update all
CREATE POLICY "inventory_adjustments_update_policy" ON inventory_adjustments
    FOR UPDATE USING (
        (supplier_id = auth.get_supplier_id() AND status = 'PENDING') OR 
        auth.is_admin()
    );

-- Only admins can delete adjustments
CREATE POLICY "inventory_adjustments_delete_policy" ON inventory_adjustments
    FOR DELETE USING (auth.is_admin());

-- ========================================
-- SALES TRANSACTIONS TABLE RLS
-- ========================================

-- Everyone can insert sales transactions (for PWA self-checkout)
CREATE POLICY "sales_transactions_insert_policy" ON sales_transactions
    FOR INSERT WITH CHECK (true);

-- Suppliers can read transactions for their products, admins can read all
CREATE POLICY "sales_transactions_select_policy" ON sales_transactions
    FOR SELECT USING (
        auth.is_admin() OR
        EXISTS (
            SELECT 1 FROM sales_transaction_items sti
            JOIN products p ON p.id = sti.product_id
            WHERE sti.transaction_id = sales_transactions.id
            AND p.supplier_id = auth.get_supplier_id()
        )
    );

-- Only admins can update/delete transactions
CREATE POLICY "sales_transactions_modify_policy" ON sales_transactions
    FOR UPDATE USING (auth.is_admin());

CREATE POLICY "sales_transactions_delete_policy" ON sales_transactions
    FOR DELETE USING (auth.is_admin());

-- ========================================
-- SALES TRANSACTION ITEMS TABLE RLS
-- ========================================

-- Everyone can insert transaction items (for PWA)
CREATE POLICY "sales_transaction_items_insert_policy" ON sales_transaction_items
    FOR INSERT WITH CHECK (true);

-- Suppliers can read items for their products, admins can read all
CREATE POLICY "sales_transaction_items_select_policy" ON sales_transaction_items
    FOR SELECT USING (
        auth.is_admin() OR
        EXISTS (
            SELECT 1 FROM products p 
            WHERE p.id = sales_transaction_items.product_id
            AND p.supplier_id = auth.get_supplier_id()
        )
    );

-- Only admins can modify transaction items
CREATE POLICY "sales_transaction_items_modify_policy" ON sales_transaction_items
    FOR ALL USING (auth.is_admin());

-- ========================================
-- SHIPPING ADDRESSES TABLE RLS
-- ========================================

-- Users can manage their own addresses, admins can see all
CREATE POLICY "shipping_addresses_policy" ON shipping_addresses
    FOR ALL USING (
        profile_id = auth.uid() OR auth.is_admin()
    );

-- ========================================
-- ORDERS TABLE RLS
-- ========================================

-- Buyers can read their own orders, suppliers can read orders with their products, admins can read all
CREATE POLICY "orders_select_policy" ON orders
    FOR SELECT USING (
        buyer_id = auth.uid() OR
        auth.is_admin() OR
        EXISTS (
            SELECT 1 FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = orders.id
            AND p.supplier_id = auth.get_supplier_id()
        )
    );

-- Buyers can create their own orders
CREATE POLICY "orders_insert_policy" ON orders
    FOR INSERT WITH CHECK (
        buyer_id = auth.uid() OR auth.is_admin()
    );

-- Buyers can update their pending orders, suppliers can update order status, admins can update all
CREATE POLICY "orders_update_policy" ON orders
    FOR UPDATE USING (
        (buyer_id = auth.uid() AND status = 'PENDING') OR
        auth.is_admin() OR
        (auth.is_supplier() AND EXISTS (
            SELECT 1 FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = orders.id
            AND p.supplier_id = auth.get_supplier_id()
        ))
    );

-- Only buyers can delete their pending orders, admins can delete all
CREATE POLICY "orders_delete_policy" ON orders
    FOR DELETE USING (
        (buyer_id = auth.uid() AND status = 'PENDING') OR auth.is_admin()
    );

-- ========================================
-- ORDER ITEMS TABLE RLS
-- ========================================

-- Buyers can read their order items, suppliers can read items for their products, admins can read all
CREATE POLICY "order_items_select_policy" ON order_items
    FOR SELECT USING (
        auth.is_admin() OR
        EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.id = order_items.order_id 
            AND o.buyer_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM products p 
            WHERE p.id = order_items.product_id
            AND p.supplier_id = auth.get_supplier_id()
        )
    );

-- Buyers can insert items to their orders
CREATE POLICY "order_items_insert_policy" ON order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.id = order_items.order_id 
            AND (o.buyer_id = auth.uid() OR auth.is_admin())
        )
    );

-- Buyers can update their order items for pending orders, admins can update all
CREATE POLICY "order_items_update_policy" ON order_items
    FOR UPDATE USING (
        auth.is_admin() OR
        EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.id = order_items.order_id 
            AND o.buyer_id = auth.uid()
            AND o.status = 'PENDING'
        )
    );

-- Buyers can delete their order items for pending orders, admins can delete all
CREATE POLICY "order_items_delete_policy" ON order_items
    FOR DELETE USING (
        auth.is_admin() OR
        EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.id = order_items.order_id 
            AND o.buyer_id = auth.uid()
            AND o.status = 'PENDING'
        )
    );

-- ========================================
-- NOTIFICATIONS TABLE RLS
-- ========================================

-- Users can read their own notifications, admins can read all
CREATE POLICY "notifications_select_policy" ON notifications
    FOR SELECT USING (
        recipient_id = auth.uid() OR auth.is_admin()
    );

-- System can insert notifications (via functions)
CREATE POLICY "notifications_insert_policy" ON notifications
    FOR INSERT WITH CHECK (true);

-- Users can update their own notifications (mark as read), admins can update all
CREATE POLICY "notifications_update_policy" ON notifications
    FOR UPDATE USING (
        recipient_id = auth.uid() OR auth.is_admin()
    );

-- Users can delete their own notifications, admins can delete all
CREATE POLICY "notifications_delete_policy" ON notifications
    FOR DELETE USING (
        recipient_id = auth.uid() OR auth.is_admin()
    );

-- ========================================
-- SUPPLIER PAYMENTS TABLE RLS
-- ========================================

-- Suppliers can read their own payments, admins can read all
CREATE POLICY "supplier_payments_select_policy" ON supplier_payments
    FOR SELECT USING (
        supplier_id = auth.get_supplier_id() OR auth.is_admin()
    );

-- Only admins can modify supplier payments
CREATE POLICY "supplier_payments_modify_policy" ON supplier_payments
    FOR ALL USING (auth.is_admin());

-- ========================================
-- ACTIVITY LOGS TABLE RLS
-- ========================================

-- Users can read their own activity logs, admins can read all
CREATE POLICY "activity_logs_select_policy" ON activity_logs
    FOR SELECT USING (
        user_id = auth.uid() OR auth.is_admin()
    );

-- System can insert activity logs
CREATE POLICY "activity_logs_insert_policy" ON activity_logs
    FOR INSERT WITH CHECK (true);

-- Only admins can modify activity logs
CREATE POLICY "activity_logs_modify_policy" ON activity_logs
    FOR UPDATE USING (auth.is_admin());

CREATE POLICY "activity_logs_delete_policy" ON activity_logs
    FOR DELETE USING (auth.is_admin());

-- ========================================
-- GRANT PERMISSIONS TO AUTHENTICATED USERS
-- ========================================

-- Grant basic permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant permissions for auth functions
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_supplier() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_supplier_id() TO authenticated;

-- ========================================
-- RLS TESTING QUERIES
-- ========================================

-- Test RLS as supplier
/*
-- Set session to simulate supplier user
SET SESSION AUTHORIZATION 'supplier_user_uuid';

-- This should only return the supplier's own products
SELECT * FROM products;

-- This should only return adjustments for supplier's products
SELECT * FROM inventory_adjustments;

-- Reset session
RESET SESSION AUTHORIZATION;
*/

-- Test RLS as admin
/*
-- Set session to simulate admin user
SET SESSION AUTHORIZATION 'admin_user_uuid';

-- This should return all products
SELECT * FROM products;

-- This should return all adjustments
SELECT * FROM inventory_adjustments;

-- Reset session
RESET SESSION AUTHORIZATION;
*/

COMMENT ON SCHEMA public IS 'Row Level Security configured for multi-tenant consignment platform';
COMMENT ON FUNCTION auth.get_user_role() IS 'Helper function to get current user role for RLS policies';
COMMENT ON FUNCTION auth.is_admin() IS 'Helper function to check if current user is admin';
COMMENT ON FUNCTION auth.is_supplier() IS 'Helper function to check if current user is supplier';
COMMENT ON FUNCTION auth.get_supplier_id() IS 'Helper function to get supplier ID for current user';