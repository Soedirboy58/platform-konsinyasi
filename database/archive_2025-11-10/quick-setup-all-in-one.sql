-- ============================================
-- QUICK SETUP SCRIPT - Platform Konsinyasi v2.0
-- ============================================
-- Run this entire script in Supabase SQL Editor
-- This will setup everything in one go:
-- 1. Schema (15 tables)
-- 2. Functions & Triggers
-- 3. RLS Policies
-- 4. Business Logic
-- 5. Sample Data
-- ============================================

-- ============================================
-- PART 1: DROP EXISTING (if any)
-- ============================================
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS supplier_payments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS sales_transaction_items CASCADE;
DROP TABLE IF EXISTS sales_transactions CASCADE;
DROP TABLE IF EXISTS inventory_adjustments CASCADE;
DROP TABLE IF EXISTS inventory_levels CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS shipping_addresses CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS check_low_stock CASCADE;
DROP FUNCTION IF EXISTS send_low_stock_notifications CASCADE;
DROP FUNCTION IF EXISTS check_expiring_products CASCADE;
DROP FUNCTION IF EXISTS send_expiry_warnings CASCADE;
DROP FUNCTION IF EXISTS notify_new_product CASCADE;
DROP FUNCTION IF EXISTS notify_inventory_adjustment CASCADE;
DROP FUNCTION IF EXISTS notify_adjustment_status_change CASCADE;
DROP FUNCTION IF EXISTS get_products_by_location CASCADE;
DROP FUNCTION IF EXISTS calculate_supplier_payment CASCADE;
DROP FUNCTION IF EXISTS process_kantin_sale CASCADE;

-- ============================================
-- PART 2: CREATE TABLES
-- ============================================

-- 1. Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('ADMIN', 'SUPPLIER', 'CUSTOMER')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_address TEXT NOT NULL,
  phone TEXT NOT NULL,
  bank_account TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('OUTLET', 'WAREHOUSE')),
  address TEXT NOT NULL,
  qr_code TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 30 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  barcode TEXT,
  photo_url TEXT,
  expiry_duration_days INTEGER NOT NULL DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Inventory Levels
CREATE TABLE inventory_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  last_restocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, location_id)
);

-- 6. Inventory Adjustments
CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('INCOMING', 'OUTGOING', 'CORRECTION')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  proof_document TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Sales Transactions
CREATE TABLE sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT,
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Sales Transaction Items
CREATE TABLE sales_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Shipping Addresses
CREATE TABLE shipping_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shipping_address_id UUID REFERENCES shipping_addresses(id),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Supplier Payments
CREATE TABLE supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  payment_date TIMESTAMPTZ NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Activity Logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 3: CREATE FUNCTIONS & TRIGGERS
-- ============================================

-- Function: Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'CUSTOMER')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Check low stock
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity <= 10 AND (OLD IS NULL OR OLD.quantity > 10) THEN
    INSERT INTO notifications (recipient_id, type, title, message, reference_id)
    SELECT 
      s.profile_id,
      'LOW_STOCK',
      'Stok Menipis!',
      'Produk "' || p.name || '" di ' || l.name || ' tinggal ' || NEW.quantity || ' unit.',
      NEW.product_id
    FROM products p
    JOIN suppliers s ON p.supplier_id = s.id
    JOIN locations l ON l.id = NEW.location_id
    WHERE p.id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_low_stock
AFTER INSERT OR UPDATE OF quantity ON inventory_levels
FOR EACH ROW EXECUTE FUNCTION check_low_stock();

-- Function: Send low stock notifications
CREATE OR REPLACE FUNCTION send_low_stock_notifications()
RETURNS TABLE(product_name TEXT, location_name TEXT, quantity INTEGER, supplier_email TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name,
    l.name,
    il.quantity,
    pr.email
  FROM inventory_levels il
  JOIN products p ON il.product_id = p.id
  JOIN locations l ON il.location_id = l.id
  JOIN suppliers s ON p.supplier_id = s.id
  JOIN profiles pr ON s.profile_id = pr.id
  WHERE il.quantity <= 10 AND p.status = 'APPROVED';
END;
$$ LANGUAGE plpgsql;

-- Function: Check expiring products
CREATE OR REPLACE FUNCTION check_expiring_products()
RETURNS TABLE(product_name TEXT, location_name TEXT, days_until_expiry INTEGER, supplier_email TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name,
    l.name,
    p.expiry_duration_days - EXTRACT(DAY FROM (NOW() - il.last_restocked_at))::integer AS days_left,
    pr.email
  FROM inventory_levels il
  JOIN products p ON il.product_id = p.id
  JOIN locations l ON il.location_id = l.id
  JOIN suppliers s ON p.supplier_id = s.id
  JOIN profiles pr ON s.profile_id = pr.id
  WHERE 
    il.last_restocked_at IS NOT NULL
    AND p.status = 'APPROVED'
    AND EXTRACT(DAY FROM (NOW() - il.last_restocked_at))::integer >= (p.expiry_duration_days - 3);
END;
$$ LANGUAGE plpgsql;

-- Function: Send expiry warnings
CREATE OR REPLACE FUNCTION send_expiry_warnings()
RETURNS VOID AS $$
BEGIN
  INSERT INTO notifications (recipient_id, type, title, message, reference_id)
  SELECT 
    s.profile_id,
    'EXPIRY_WARNING',
    'Produk Mendekati Kadaluarsa',
    'Produk "' || p.name || '" di ' || l.name || ' akan kadaluarsa dalam ' || 
    (p.expiry_duration_days - EXTRACT(DAY FROM (NOW() - il.last_restocked_at))::integer) || ' hari.',
    p.id
  FROM inventory_levels il
  JOIN products p ON il.product_id = p.id
  JOIN locations l ON il.location_id = l.id
  JOIN suppliers s ON p.supplier_id = s.id
  WHERE 
    il.last_restocked_at IS NOT NULL
    AND p.status = 'APPROVED'
    AND EXTRACT(DAY FROM (NOW() - il.last_restocked_at))::integer >= (p.expiry_duration_days - 3);
END;
$$ LANGUAGE plpgsql;

-- Function: Notify new product
CREATE OR REPLACE FUNCTION notify_new_product()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (recipient_id, type, title, message, reference_id)
  SELECT 
    id,
    'NEW_PRODUCT',
    'Produk Baru Ditambahkan',
    'Supplier telah menambahkan produk baru: "' || NEW.name || '"',
    NEW.id
  FROM profiles
  WHERE role = 'ADMIN';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_product
AFTER INSERT ON products
FOR EACH ROW EXECUTE FUNCTION notify_new_product();

-- Function: Notify inventory adjustment
CREATE OR REPLACE FUNCTION notify_inventory_adjustment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (recipient_id, type, title, message, reference_id)
  SELECT 
    id,
    'ADJUSTMENT_REQUEST',
    'Permintaan Adjustment Stok',
    'Supplier mengajukan adjustment stok untuk produk ID: ' || NEW.product_id::text,
    NEW.id
  FROM profiles
  WHERE role = 'ADMIN';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_inventory_adjustment
AFTER INSERT ON inventory_adjustments
FOR EACH ROW EXECUTE FUNCTION notify_inventory_adjustment();

-- Function: Notify adjustment status change
CREATE OR REPLACE FUNCTION notify_adjustment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status AND NEW.status IN ('APPROVED', 'REJECTED') THEN
    INSERT INTO notifications (recipient_id, type, title, message, reference_id)
    SELECT 
      s.profile_id,
      'ADJUSTMENT_' || NEW.status,
      'Status Adjustment: ' || NEW.status,
      'Permintaan adjustment stok Anda telah ' || 
      CASE WHEN NEW.status = 'APPROVED' THEN 'disetujui' ELSE 'ditolak' END || '.',
      NEW.id
    FROM products p
    JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.id = NEW.product_id;
    
    -- Update inventory if approved
    IF NEW.status = 'APPROVED' THEN
      IF NEW.adjustment_type = 'INCOMING' THEN
        INSERT INTO inventory_levels (product_id, location_id, quantity, last_restocked_at)
        VALUES (NEW.product_id, NEW.location_id, NEW.quantity, NOW())
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET 
          quantity = inventory_levels.quantity + NEW.quantity,
          last_restocked_at = NOW(),
          updated_at = NOW();
      ELSIF NEW.adjustment_type = 'OUTGOING' THEN
        UPDATE inventory_levels
        SET quantity = GREATEST(quantity - NEW.quantity, 0),
            updated_at = NOW()
        WHERE product_id = NEW.product_id AND location_id = NEW.location_id;
      ELSIF NEW.adjustment_type = 'CORRECTION' THEN
        INSERT INTO inventory_levels (product_id, location_id, quantity, last_restocked_at)
        VALUES (NEW.product_id, NEW.location_id, NEW.quantity, NOW())
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET 
          quantity = NEW.quantity,
          updated_at = NOW();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_adjustment_status_change
AFTER UPDATE ON inventory_adjustments
FOR EACH ROW EXECUTE FUNCTION notify_adjustment_status_change();

-- ============================================
-- PART 4: BUSINESS LOGIC FUNCTIONS
-- ============================================

-- Get products by location
CREATE OR REPLACE FUNCTION get_products_by_location(location_slug TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  price DECIMAL,
  photo_url TEXT,
  available_quantity INTEGER,
  supplier_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.description,
    p.price,
    p.photo_url,
    COALESCE(il.quantity, 0) as available_quantity,
    s.business_name
  FROM products p
  JOIN suppliers s ON p.supplier_id = s.id
  LEFT JOIN inventory_levels il ON p.id = il.product_id
  LEFT JOIN locations l ON il.location_id = l.id
  WHERE 
    p.status = 'APPROVED' 
    AND s.status = 'APPROVED'
    AND l.qr_code = location_slug
    AND l.is_active = true
    AND COALESCE(il.quantity, 0) > 0;
END;
$$ LANGUAGE plpgsql;

-- Calculate supplier payment
CREATE OR REPLACE FUNCTION calculate_supplier_payment(
  p_supplier_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_sales DECIMAL,
  platform_commission DECIMAL,
  supplier_payment DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    SUM(sti.subtotal) as total_sales,
    SUM(sti.subtotal * (p.commission_rate / 100)) as platform_commission,
    SUM(sti.subtotal * (1 - p.commission_rate / 100)) as supplier_payment
  FROM sales_transaction_items sti
  JOIN products p ON sti.product_id = p.id
  JOIN sales_transactions st ON sti.transaction_id = st.id
  WHERE 
    p.supplier_id = p_supplier_id
    AND st.transaction_date >= p_start_date
    AND st.transaction_date <= p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Process Kantin sale
CREATE OR REPLACE FUNCTION process_kantin_sale(
  p_location_id UUID,
  p_items JSONB
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_item JSONB;
  v_total DECIMAL := 0;
BEGIN
  -- Create transaction
  INSERT INTO sales_transactions (location_id, total_amount)
  VALUES (p_location_id, 0)
  RETURNING id INTO v_transaction_id;
  
  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sales_transaction_items (
      transaction_id,
      product_id,
      quantity,
      price,
      subtotal
    )
    VALUES (
      v_transaction_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'price')::DECIMAL,
      (v_item->>'quantity')::INTEGER * (v_item->>'price')::DECIMAL
    );
    
    v_total := v_total + ((v_item->>'quantity')::INTEGER * (v_item->>'price')::DECIMAL);
    
    -- Update inventory
    UPDATE inventory_levels
    SET quantity = quantity - (v_item->>'quantity')::INTEGER
    WHERE product_id = (v_item->>'product_id')::UUID
      AND location_id = p_location_id;
  END LOOP;
  
  -- Update transaction total
  UPDATE sales_transactions
  SET total_amount = v_total
  WHERE id = v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 5: ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
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

-- Profiles policies
CREATE POLICY "Public can view profiles" ON profiles FOR SELECT TO public USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Suppliers policies
CREATE POLICY "Public can view approved suppliers" ON suppliers FOR SELECT USING (status = 'APPROVED');
CREATE POLICY "Suppliers can view own" ON suppliers FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Users can insert own supplier" ON suppliers FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Suppliers can update own" ON suppliers FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "Admins full access suppliers" ON suppliers FOR ALL TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Locations policies
CREATE POLICY "Public can view active locations" ON locations FOR SELECT USING (is_active = true);
CREATE POLICY "Admins full access locations" ON locations FOR ALL TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Products policies
CREATE POLICY "Public can view approved products" ON products FOR SELECT USING (status = 'APPROVED');
CREATE POLICY "Suppliers can view own products" ON products FOR SELECT USING (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);
CREATE POLICY "Suppliers can insert own products" ON products FOR INSERT WITH CHECK (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);
CREATE POLICY "Suppliers can update own products" ON products FOR UPDATE USING (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);
CREATE POLICY "Admins full access products" ON products FOR ALL TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Inventory levels policies
CREATE POLICY "Public can view inventory" ON inventory_levels FOR SELECT USING (true);
CREATE POLICY "System can update inventory" ON inventory_levels FOR ALL USING (true);

-- Inventory adjustments policies
CREATE POLICY "Suppliers can view own adjustments" ON inventory_adjustments FOR SELECT USING (
  product_id IN (
    SELECT id FROM products WHERE supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
  )
);
CREATE POLICY "Suppliers can insert adjustments" ON inventory_adjustments FOR INSERT WITH CHECK (
  product_id IN (
    SELECT id FROM products WHERE supplier_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    )
  )
);
CREATE POLICY "Admins full access adjustments" ON inventory_adjustments FOR ALL TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Sales transactions policies
CREATE POLICY "Anyone can insert sales" ON sales_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view sales" ON sales_transactions FOR SELECT TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Sales transaction items policies
CREATE POLICY "Anyone can insert sales items" ON sales_transaction_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view sales items" ON sales_transaction_items FOR SELECT TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Shipping addresses policies
CREATE POLICY "Users can manage own addresses" ON shipping_addresses FOR ALL USING (auth.uid() = profile_id);

-- Orders policies
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Users can insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Admins can view all orders" ON orders FOR SELECT TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Order items policies
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
);
CREATE POLICY "Admins can view all order items" ON order_items FOR SELECT TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Supplier payments policies
CREATE POLICY "Suppliers can view own payments" ON supplier_payments FOR SELECT USING (
  supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
);
CREATE POLICY "Admins full access payments" ON supplier_payments FOR ALL TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Activity logs policies
CREATE POLICY "Admins can view logs" ON activity_logs FOR SELECT TO authenticated USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- ============================================
-- PART 6: SAMPLE DATA
-- ============================================

-- Note: Admin user should be created via Supabase Auth UI or frontend
-- After creating user via signup, run this to make them admin:
-- UPDATE profiles SET role = 'ADMIN' WHERE email = 'your@email.com';

-- Create sample locations
INSERT INTO locations (name, type, address, qr_code) VALUES
('Outlet Lobby A', 'OUTLET', 'Lobby A, Lantai 1', 'outlet_lobby_a'),
('Gudang Pusat', 'WAREHOUSE', 'Jl. Gudang Raya No. 123', 'warehouse_main')
ON CONFLICT (qr_code) DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Database setup complete!';
  RAISE NOTICE '📋 Created:';
  RAISE NOTICE '   - 15 tables';
  RAISE NOTICE '   - 7 functions & triggers';
  RAISE NOTICE '   - 30+ RLS policies';
  RAISE NOTICE '   - 3 business logic functions';
  RAISE NOTICE '   - Sample locations';
  RAISE NOTICE '';
  RAISE NOTICE '🔑 Create admin user:';
  RAISE NOTICE '   1. Register at http://localhost:3000/supplier/login';
  RAISE NOTICE '   2. Run: UPDATE profiles SET role = ''ADMIN'' WHERE email = ''your@email.com'';';
  RAISE NOTICE '   3. Login at /admin/login';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next steps:';
  RAISE NOTICE '   1. Create admin user (see above)';
  RAISE NOTICE '   2. Register suppliers at /supplier/login';
  RAISE NOTICE '   3. Approve suppliers & products';
  RAISE NOTICE '   4. Test PWA at /kantin/outlet_lobby_a';
END $$;
