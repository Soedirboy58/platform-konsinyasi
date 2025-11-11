-- ========================================
-- MIGRATION 001: Initial Schema
-- ========================================
-- Description: Core tables for Platform Konsinyasi
-- Dependencies: None (must run first)
-- Tables: profiles, suppliers, locations, categories, products, inventory_levels
-- Rollback: DROP TABLE ... CASCADE (see bottom)
-- ========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- CORE TABLES
-- ========================================

-- 1. Profiles (User Management)
CREATE TABLE IF NOT EXISTS profiles (
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
CREATE TABLE IF NOT EXISTS suppliers (
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
    commission_rate DECIMAL(5,2) DEFAULT 15.00,
    payment_terms INTEGER DEFAULT 7,
    is_approved BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id)
);

-- 3. Locations (OUTLET vs WAREHOUSE)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('OUTLET', 'WAREHOUSE')),
    address TEXT NOT NULL,
    qr_code TEXT UNIQUE,
    coordinates POINT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, type)
);

-- 4. Product Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Products (Unified Catalog)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL CHECK (price > 0),
    cost_price DECIMAL(10,2),
    commission_rate DECIMAL(5,2) DEFAULT 15.00,
    barcode TEXT UNIQUE,
    sku TEXT UNIQUE,
    expiry_duration_days INTEGER NOT NULL DEFAULT 30,
    min_stock_threshold INTEGER DEFAULT 5,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DISCONTINUED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Inventory Levels (Real-time stock per location)
CREATE TABLE IF NOT EXISTS inventory_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, location_id)
);

-- ========================================
-- INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_levels(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory_levels(location_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

-- ========================================
-- PLATFORM SETTINGS
-- ========================================

CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO platform_settings (key, value, description) VALUES
    ('commission_rate', '15.00', 'Default platform commission rate (%)'),
    ('payment_terms_days', '7', 'Default payment cycle (days)'),
    ('min_order_amount', '10000', 'Minimum order amount (IDR)')
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- SUCCESS
-- ========================================

SELECT 'Migration 001: Initial Schema - SUCCESS!' AS status;

-- ========================================
-- ROLLBACK (if needed)
-- ========================================
-- DROP TABLE IF EXISTS inventory_levels CASCADE;
-- DROP TABLE IF EXISTS products CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS locations CASCADE;
-- DROP TABLE IF EXISTS suppliers CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;
-- DROP TABLE IF EXISTS platform_settings CASCADE;
