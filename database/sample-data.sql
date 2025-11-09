-- ========================================
-- SAMPLE DATA FOR TESTING
-- Platform Konsinyasi Terintegrasi v2.0
-- ========================================

-- Note: Run this AFTER schema.sql, functions.sql, and rls-policies.sql

-- ========================================
-- IMPORTANT: Insert sample users into auth.users first
-- ========================================
-- In production, users would be created through Supabase Auth signup
-- For testing, we create them directly in auth.users table

-- Insert into auth.users (requires service role privileges)
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
) VALUES
-- Admin user
(
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@konsinyasi.com',
    crypt('admin123', gen_salt('bf')), -- Password: admin123
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Super Admin"}',
    NOW(),
    NOW(),
    '',
    ''
),
-- Supplier 1
(
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'supplier1@gmail.com',
    crypt('supplier123', gen_salt('bf')), -- Password: supplier123
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Budi Santoso"}',
    NOW(),
    NOW(),
    '',
    ''
),
-- Supplier 2
(
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'supplier2@gmail.com',
    crypt('supplier123', gen_salt('bf')), -- Password: supplier123
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Siti Nurhaliza"}',
    NOW(),
    NOW(),
    '',
    ''
),
-- Buyer
(
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'buyer1@gmail.com',
    crypt('buyer123', gen_salt('bf')), -- Password: buyer123
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ahmad Rizki"}',
    NOW(),
    NOW(),
    '',
    ''
);

-- Now insert profiles (these will be auto-created by trigger in production)
INSERT INTO profiles (id, email, full_name, role) VALUES
('11111111-1111-1111-1111-111111111111', 'admin@konsinyasi.com', 'Super Admin', 'ADMIN');

INSERT INTO profiles (id, email, full_name, phone, role) VALUES
('22222222-2222-2222-2222-222222222222', 'supplier1@gmail.com', 'Budi Santoso', '+6281234567890', 'SUPPLIER'),
('33333333-3333-3333-3333-333333333333', 'supplier2@gmail.com', 'Siti Nurhaliza', '+6281234567891', 'SUPPLIER');

INSERT INTO profiles (id, email, full_name, phone, role) VALUES
('44444444-4444-4444-4444-444444444444', 'buyer1@gmail.com', 'Ahmad Rizki', '+6281234567892', 'BUYER');

-- Insert supplier details
INSERT INTO suppliers (profile_id, business_name, bank_account_name, bank_account_number, bank_name, commission_rate, is_approved) VALUES
('22222222-2222-2222-2222-222222222222', 'Snack Nusantara', 'Budi Santoso', '1234567890', 'Bank BCA', 12.00, TRUE),
('33333333-3333-3333-3333-333333333333', 'Segar Minuman', 'Siti Nurhaliza', '0987654321', 'Bank Mandiri', 15.00, TRUE);

-- Get supplier IDs for reference
-- Supplier 1 ID (will be generated)
-- Supplier 2 ID (will be generated)

-- Let's use variables for cleaner code
DO $$ 
DECLARE 
    supplier1_id UUID;
    supplier2_id UUID;
    category_snack_id UUID;
    category_drink_id UUID;
    location_lobby_a_id UUID;
    location_lobby_b_id UUID;
    location_warehouse_id UUID;
BEGIN
    -- Get supplier IDs
    SELECT id INTO supplier1_id FROM suppliers WHERE business_name = 'Snack Nusantara';
    SELECT id INTO supplier2_id FROM suppliers WHERE business_name = 'Segar Minuman';
    
    -- Get category IDs
    SELECT id INTO category_snack_id FROM categories WHERE name = 'Makanan Ringan';
    SELECT id INTO category_drink_id FROM categories WHERE name = 'Minuman';
    
    -- Get location IDs
    SELECT id INTO location_lobby_a_id FROM locations WHERE name = 'Lobby Gedung A';
    SELECT id INTO location_lobby_b_id FROM locations WHERE name = 'Lobby Gedung B';
    SELECT id INTO location_warehouse_id FROM locations WHERE name = 'Warehouse Utama';
    
    -- Insert sample products
    INSERT INTO products (supplier_id, category_id, name, description, photo_url, price, cost_price, barcode, sku, expiry_duration_days, min_stock_threshold, status) VALUES
    -- Supplier 1 products (Snacks)
    (supplier1_id, category_snack_id, 'Keripik Singkong Original', 'Keripik singkong renyah dengan rasa original yang gurih', 'https://picsum.photos/400/300?random=1', 8000.00, 5000.00, '8991234567890', 'SNK-KSO-001', 45, 10, 'APPROVED'),
    (supplier1_id, category_snack_id, 'Keripik Singkong Balado', 'Keripik singkong dengan bumbu balado pedas', 'https://picsum.photos/400/300?random=2', 8500.00, 5200.00, '8991234567891', 'SNK-KSB-001', 45, 8, 'APPROVED'),
    (supplier1_id, category_snack_id, 'Kacang Bawang Kriuk', 'Kacang tanah goreng dengan bumbu bawang', 'https://picsum.photos/400/300?random=3', 6000.00, 3800.00, '8991234567892', 'SNK-KBK-001', 60, 15, 'APPROVED'),
    
    -- Supplier 2 products (Drinks)
    (supplier2_id, category_drink_id, 'Air Mineral 600ml', 'Air mineral kemasan botol 600ml', 'https://picsum.photos/400/300?random=4', 3000.00, 2000.00, '8991234567893', 'DRK-AM6-001', 365, 20, 'APPROVED'),
    (supplier2_id, category_drink_id, 'Teh Kotak Jasmine', 'Teh jasmine dalam kemasan kotak 200ml', 'https://picsum.photos/400/300?random=5', 4500.00, 3200.00, '8991234567894', 'DRK-TKJ-001', 90, 12, 'APPROVED'),
    (supplier2_id, category_drink_id, 'Kopi Susu Dingin', 'Kopi susu kemasan botol 250ml', 'https://picsum.photos/400/300?random=6', 7500.00, 5000.00, '8991234567895', 'DRK-KSD-001', 14, 8, 'APPROVED');
    
    -- Insert inventory levels for outlets
    -- Lobby A inventory
    INSERT INTO inventory_levels (product_id, location_id, quantity, stocked_at_timestamp) 
    SELECT p.id, location_lobby_a_id, 
           CASE 
               WHEN p.name LIKE '%Keripik%' THEN 25
               WHEN p.name LIKE '%Kacang%' THEN 18
               WHEN p.name LIKE '%Air Mineral%' THEN 35
               WHEN p.name LIKE '%Teh%' THEN 15
               WHEN p.name LIKE '%Kopi%' THEN 12
           END,
           NOW() - INTERVAL '2 days'
    FROM products p
    WHERE p.status = 'APPROVED';
    
    -- Lobby B inventory (different quantities)
    INSERT INTO inventory_levels (product_id, location_id, quantity, stocked_at_timestamp)
    SELECT p.id, location_lobby_b_id,
           CASE 
               WHEN p.name LIKE '%Keripik%' THEN 15
               WHEN p.name LIKE '%Kacang%' THEN 22
               WHEN p.name LIKE '%Air Mineral%' THEN 28
               WHEN p.name LIKE '%Teh%' THEN 8  -- This will trigger low stock alert
               WHEN p.name LIKE '%Kopi%' THEN 18
           END,
           NOW() - INTERVAL '1 day'
    FROM products p
    WHERE p.status = 'APPROVED';
    
    -- Warehouse inventory (higher quantities)
    INSERT INTO inventory_levels (product_id, location_id, quantity, stocked_at_timestamp)
    SELECT p.id, location_warehouse_id,
           CASE 
               WHEN p.name LIKE '%Keripik%' THEN 200
               WHEN p.name LIKE '%Kacang%' THEN 150
               WHEN p.name LIKE '%Air Mineral%' THEN 500
               WHEN p.name LIKE '%Teh%' THEN 180
               WHEN p.name LIKE '%Kopi%' THEN 100
           END,
           NOW() - INTERVAL '3 days'
    FROM products p
    WHERE p.status = 'APPROVED';
    
END $$;

-- Insert some sample sales transactions
DO $$
DECLARE
    lobby_a_id UUID;
    lobby_b_id UUID;
    keripik_original_id UUID;
    air_mineral_id UUID;
    teh_kotak_id UUID;
    transaction1_id UUID;
    transaction2_id UUID;
BEGIN
    -- Get location IDs
    SELECT id INTO lobby_a_id FROM locations WHERE name = 'Lobby Gedung A';
    SELECT id INTO lobby_b_id FROM locations WHERE name = 'Lobby Gedung B';
    
    -- Get some product IDs
    SELECT id INTO keripik_original_id FROM products WHERE name = 'Keripik Singkong Original';
    SELECT id INTO air_mineral_id FROM products WHERE name = 'Air Mineral 600ml';
    SELECT id INTO teh_kotak_id FROM products WHERE name = 'Teh Kotak Jasmine';
    
    -- Sample transaction 1 (Lobby A)
    INSERT INTO sales_transactions (location_id, transaction_code, customer_name, total_amount, payment_method, status, created_at)
    VALUES (lobby_a_id, 'KNT-20241110-000001', 'Anonymous', 19500.00, 'CASH', 'COMPLETED', NOW() - INTERVAL '2 hours')
    RETURNING id INTO transaction1_id;
    
    -- Transaction 1 items
    INSERT INTO sales_transaction_items (transaction_id, product_id, quantity, unit_price, subtotal) VALUES
    (transaction1_id, keripik_original_id, 2, 8000.00, 16000.00),
    (transaction1_id, air_mineral_id, 1, 3000.00, 3000.00);
    
    -- Update inventory after sale
    UPDATE inventory_levels SET quantity = quantity - 2 WHERE product_id = keripik_original_id AND location_id = lobby_a_id;
    UPDATE inventory_levels SET quantity = quantity - 1 WHERE product_id = air_mineral_id AND location_id = lobby_a_id;
    
    -- Sample transaction 2 (Lobby B)
    INSERT INTO sales_transactions (location_id, transaction_code, customer_name, total_amount, payment_method, status, created_at)
    VALUES (lobby_b_id, 'KNT-20241110-000002', 'Pak Joko', 12000.00, 'TRANSFER', 'COMPLETED', NOW() - INTERVAL '1 hour')
    RETURNING id INTO transaction2_id;
    
    -- Transaction 2 items  
    INSERT INTO sales_transaction_items (transaction_id, product_id, quantity, unit_price, subtotal) VALUES
    (transaction2_id, teh_kotak_id, 2, 4500.00, 9000.00),
    (transaction2_id, air_mineral_id, 1, 3000.00, 3000.00);
    
    -- Update inventory after sale
    UPDATE inventory_levels SET quantity = quantity - 2 WHERE product_id = teh_kotak_id AND location_id = lobby_b_id;
    UPDATE inventory_levels SET quantity = quantity - 1 WHERE product_id = air_mineral_id AND location_id = lobby_b_id;
    
END $$;

-- Insert sample inventory adjustments (stock loss claims)
DO $$
DECLARE
    supplier1_id UUID;
    supplier2_id UUID;
    keripik_balado_id UUID;
    kopi_susu_id UUID;
    lobby_a_inventory_id UUID;
    lobby_b_inventory_id UUID;
BEGIN
    SELECT id INTO supplier1_id FROM suppliers WHERE business_name = 'Snack Nusantara';
    SELECT id INTO supplier2_id FROM suppliers WHERE business_name = 'Segar Minuman';
    SELECT id INTO keripik_balado_id FROM products WHERE name = 'Keripik Singkong Balado';
    SELECT id INTO kopi_susu_id FROM products WHERE name = 'Kopi Susu Dingin';
    
    SELECT id INTO lobby_a_inventory_id FROM inventory_levels 
    WHERE product_id = keripik_balado_id AND location_id = (SELECT id FROM locations WHERE name = 'Lobby Gedung A');
    
    SELECT id INTO lobby_b_inventory_id FROM inventory_levels 
    WHERE product_id = kopi_susu_id AND location_id = (SELECT id FROM locations WHERE name = 'Lobby Gedung B');
    
    -- Sample adjustment 1: Lost items
    INSERT INTO inventory_adjustments (
        inventory_level_id, supplier_id, adjustment_type, quantity_change, 
        reason_notes, proof_url, status, created_at
    ) VALUES (
        lobby_a_inventory_id, supplier1_id, 'HILANG', -3,
        'Kemasan robek dan produk berceceran', 
        'https://storage.supabase.co/evidence/lost_items_001.jpg',
        'PENDING', NOW() - INTERVAL '6 hours'
    );
    
    -- Sample adjustment 2: Damaged items (approved)
    INSERT INTO inventory_adjustments (
        inventory_level_id, supplier_id, adjustment_type, quantity_change,
        reason_notes, proof_url, status, reviewed_by, reviewed_at, review_notes
    ) VALUES (
        lobby_b_inventory_id, supplier2_id, 'RUSAK', -2,
        'Botol retak akibat jatuh saat restocking',
        'https://storage.supabase.co/evidence/damaged_items_001.jpg', 
        'APPROVED', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '2 hours',
        'Bukti foto jelas, klaim disetujui'
    );
    
END $$;

-- Insert sample shipping address
INSERT INTO shipping_addresses (profile_id, label, recipient_name, phone, address_line_1, city, province, postal_code, is_default)
VALUES ('44444444-4444-4444-4444-444444444444', 'Rumah', 'Ahmad Rizki', '+6281234567892', 'Jl. Sudirman No. 123', 'Jakarta Selatan', 'DKI Jakarta', '12190', TRUE);

-- Insert sample notifications
DO $$
DECLARE
    supplier1_profile_id UUID := '22222222-2222-2222-2222-222222222222';
    supplier2_profile_id UUID := '33333333-3333-3333-3333-333333333333';
    admin_profile_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
    -- Low stock notification for supplier 2
    INSERT INTO notifications (recipient_id, title, message, type, priority, is_read, created_at) VALUES
    (supplier2_profile_id, 'Stok Produk Menipis', 'Stok "Teh Kotak Jasmine" Anda di Lobby Gedung B tinggal 6 unit. Segera lakukan restock.', 'LOW_STOCK', 'HIGH', FALSE, NOW() - INTERVAL '30 minutes');
    
    -- Pending adjustment review for admin
    INSERT INTO notifications (recipient_id, title, message, type, priority, is_read, created_at) VALUES
    (admin_profile_id, 'Klaim Stok Hilang Baru', 'Supplier Snack Nusantara melaporkan 3 unit "Keripik Singkong Balado" hilang di Lobby Gedung A dengan bukti terlampir. Mohon review klaim ini.', 'STOCK_ADJUSTMENT', 'HIGH', FALSE, NOW() - INTERVAL '6 hours');
    
    -- Approved adjustment notification for supplier 2
    INSERT INTO notifications (recipient_id, title, message, type, priority, is_read, created_at) VALUES
    (supplier2_profile_id, 'Klaim Stok Disetujui', 'Klaim Anda untuk 2 unit "Kopi Susu Dingin" di Lobby Gedung B telah disetujui oleh Admin. Ini akan diperhitungkan dalam siklus pembayaran berikutnya.', 'STOCK_ADJUSTMENT', 'NORMAL', FALSE, NOW() - INTERVAL '2 hours');
    
END $$;

-- Test queries to verify sample data
SELECT 'Sample data inserted successfully!' as status;

-- Quick verification queries
SELECT 'Products per supplier:' as info;
SELECT s.business_name, COUNT(p.id) as product_count
FROM suppliers s
LEFT JOIN products p ON p.supplier_id = s.id
GROUP BY s.id, s.business_name;

SELECT 'Inventory levels per location:' as info;
SELECT l.name, l.type, COUNT(il.id) as items_count, SUM(il.quantity) as total_quantity
FROM locations l
LEFT JOIN inventory_levels il ON il.location_id = l.id
GROUP BY l.id, l.name, l.type
ORDER BY l.type, l.name;

SELECT 'Sales summary:' as info;
SELECT COUNT(*) as transaction_count, SUM(total_amount) as total_revenue
FROM sales_transactions
WHERE status = 'COMPLETED';

SELECT 'Pending adjustments:' as info;
SELECT COUNT(*) as pending_adjustments
FROM inventory_adjustments
WHERE status = 'PENDING';

COMMENT ON SCHEMA public IS 'Sample data loaded for Platform Konsinyasi Terintegrasi v2.0';