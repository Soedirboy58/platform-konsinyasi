-- ========================================
-- Platform Konsinyasi Terintegrasi v2.0
-- Database Schema (DDL)
-- ========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- CORE TABLES
-- ========================================

-- 1. Profiles (User Management)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SUPPLIER', 'BUYER')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Suppliers (Extended info for supplier users)
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    business_license TEXT,
    contact_person TEXT,
    phone_number TEXT,
    address TEXT,
    bank_account_name TEXT NOT NULL,
    bank_account_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 15.00, -- Platform commission %
    payment_terms INTEGER DEFAULT 7, -- Days for payment cycle
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(profile_id)
);

-- 3. Locations (OUTLET vs WAREHOUSE)
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('OUTLET', 'WAREHOUSE')),
    address TEXT NOT NULL,
    qr_code TEXT UNIQUE, -- For PWA scanning
    coordinates POINT, -- For future location services
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(name, type)
);

-- 4. Product Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Products (Unified Catalog)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    photo_url TEXT NOT NULL, -- Supabase Storage URL
    price DECIMAL(10,2) NOT NULL CHECK (price > 0),
    cost_price DECIMAL(10,2), -- For margin calculation
    barcode TEXT UNIQUE,
    sku TEXT UNIQUE,
    expiry_duration_days INTEGER NOT NULL DEFAULT 30, -- Product freshness protection
    min_stock_threshold INTEGER DEFAULT 5,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DISCONTINUED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for products table
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_barcode ON products(barcode);

-- ========================================
-- INVENTORY MANAGEMENT
-- ========================================

-- 6. Inventory Levels (Real-time stock per location)
CREATE TABLE inventory_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0), -- For P.O. reservations
    stocked_at_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_counted_at TIMESTAMPTZ, -- For stock opname tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(product_id, location_id)
);

-- Create indexes for inventory_levels table
CREATE INDEX idx_inventory_location ON inventory_levels(location_id);
CREATE INDEX idx_inventory_product ON inventory_levels(product_id);
CREATE INDEX idx_inventory_stocked_at ON inventory_levels(stocked_at_timestamp);

-- 7. Inventory Adjustments (Stock corrections, losses, damages)
CREATE TABLE inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_level_id UUID NOT NULL REFERENCES inventory_levels(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('HILANG', 'RUSAK', 'KADALUWARSA', 'RESTOCK', 'KOREKSI')),
    quantity_change INTEGER NOT NULL, -- Positive for additions, negative for reductions
    reason_notes TEXT NOT NULL,
    proof_url TEXT, -- Supabase Storage URL for evidence photos
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by UUID REFERENCES profiles(id), -- Admin who reviewed
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for inventory_adjustments table
CREATE INDEX idx_adjustments_supplier ON inventory_adjustments(supplier_id);
CREATE INDEX idx_adjustments_status ON inventory_adjustments(status);
CREATE INDEX idx_adjustments_type ON inventory_adjustments(adjustment_type);

-- ========================================
-- TRANSACTION TABLES
-- ========================================

-- 8. Sales Transactions (Model 1: Kantin Kejujuran)
CREATE TABLE sales_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID NOT NULL REFERENCES locations(id),
    transaction_code TEXT UNIQUE NOT NULL, -- Human-readable transaction ID
    customer_name TEXT, -- Optional, for receipt
    customer_phone TEXT, -- Optional
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
    payment_method TEXT DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'TRANSFER', 'EWALLET')),
    payment_proof_url TEXT, -- For non-cash payments
    status TEXT DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for sales_transactions table
CREATE INDEX idx_sales_location ON sales_transactions(location_id);
CREATE INDEX idx_sales_date ON sales_transactions(created_at);
CREATE INDEX idx_sales_status ON sales_transactions(status);

-- 9. Sales Transaction Items
CREATE TABLE sales_transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price > 0),
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal > 0)
);

-- Create indexes for sales_transaction_items table
CREATE INDEX idx_sales_items_transaction ON sales_transaction_items(transaction_id);
CREATE INDEX idx_sales_items_product ON sales_transaction_items(product_id);

-- ========================================
-- PRE-ORDER SYSTEM (Model 2)
-- ========================================

-- 10. Shipping Addresses
CREATE TABLE shipping_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- "Home", "Office", etc.
    recipient_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address_line_1 TEXT NOT NULL,
    address_line_2 TEXT,
    city TEXT NOT NULL,
    province TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for shipping_addresses table
CREATE INDEX idx_addresses_profile ON shipping_addresses(profile_id);

-- 11. Orders (Model 2: Pre-Order E-commerce)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id UUID NOT NULL REFERENCES profiles(id),
    order_number TEXT UNIQUE NOT NULL, -- Human-readable order number
    shipping_address_id UUID NOT NULL REFERENCES shipping_addresses(id),
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal > 0),
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
    payment_method TEXT CHECK (payment_method IN ('TRANSFER', 'COD', 'EWALLET')),
    payment_proof_url TEXT,
    tracking_number TEXT,
    estimated_delivery_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for orders table
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(created_at);

-- 12. Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price > 0),
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal > 0)
);

-- Create indexes for order_items table
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ========================================
-- NOTIFICATION SYSTEM
-- ========================================

-- 13. Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('PRODUCT_APPROVAL', 'STOCK_ADJUSTMENT', 'LOW_STOCK', 'EXPIRY_WARNING', 'ORDER_UPDATE', 'PAYMENT')),
    priority TEXT DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    is_read BOOLEAN DEFAULT FALSE,
    action_url TEXT, -- Deep link for action
    metadata JSONB, -- Additional data for the notification
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Create indexes for notifications table
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ========================================
-- FINANCIAL TRACKING
-- ========================================

-- 14. Supplier Payments
CREATE TABLE supplier_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    gross_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
    adjustments_deduction DECIMAL(12,2) NOT NULL DEFAULT 0, -- Approved losses
    commission_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    net_payment DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
    payment_proof_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- Create indexes for supplier_payments table
CREATE INDEX idx_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX idx_payments_period ON supplier_payments(period_start, period_end);
CREATE INDEX idx_payments_status ON supplier_payments(status);

-- ========================================
-- AUDIT & LOGGING
-- ========================================

-- 15. Activity Logs
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for activity_logs table
CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_table ON activity_logs(table_name);
CREATE INDEX idx_activity_created ON activity_logs(created_at);

-- ========================================
-- TRIGGERS FOR AUTO-UPDATES
-- ========================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory_levels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- INITIAL DATA SEEDS
-- ========================================

-- Insert default categories
INSERT INTO categories (name, description) VALUES
('Makanan Ringan', 'Snacks, keripik, biskuit'),
('Minuman', 'Air mineral, jus, kopi instan'),
('Makanan Instan', 'Mie instan, roti, sandwich'),
('Perlengkapan', 'ATK, masker, sanitizer');

-- Insert sample locations
INSERT INTO locations (name, type, address, qr_code) VALUES
('Lobby Gedung A', 'OUTLET', 'Lantai 1 Gedung A', 'OUTLET_LOBBY_A'),
('Lobby Gedung B', 'OUTLET', 'Lantai 1 Gedung B', 'OUTLET_LOBBY_B'),
('Kantin Lantai 3', 'OUTLET', 'Lantai 3 Gedung A', 'OUTLET_L3_A'),
('Warehouse Utama', 'WAREHOUSE', 'Jl. Industri No. 123', 'WAREHOUSE_MAIN');

COMMENT ON TABLE profiles IS 'User management dengan role-based access';
COMMENT ON TABLE suppliers IS 'Extended info untuk supplier users';
COMMENT ON TABLE locations IS 'OUTLET untuk kantin, WAREHOUSE untuk P.O.';
COMMENT ON TABLE products IS 'Katalog terpadu untuk kedua model bisnis';
COMMENT ON TABLE inventory_levels IS 'Real-time stock per lokasi';
COMMENT ON TABLE inventory_adjustments IS 'Track stok hilang/rusak dengan bukti foto';
COMMENT ON TABLE sales_transactions IS 'Model 1: Transaksi kantin kejujuran';
COMMENT ON TABLE orders IS 'Model 2: Pre-order e-commerce';
COMMENT ON TABLE notifications IS 'Event-driven notification system';