-- ========================================
-- BUSINESS LOGIC QUERIES
-- ========================================

-- ========================================
-- 1. PWA KANTIN QUERIES
-- ========================================

-- Get products available at specific location (for PWA scanning)
-- Usage: SELECT * FROM get_products_by_location('OUTLET_LOBBY_A');
CREATE OR REPLACE FUNCTION get_products_by_location(location_qr_code TEXT)
RETURNS TABLE (
    product_id UUID,
    name TEXT,
    description TEXT,
    photo_url TEXT,
    price DECIMAL(10,2),
    available_quantity INTEGER,
    barcode TEXT,
    supplier_name TEXT,
    category_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.description,
        p.photo_url,
        p.price,
        il.quantity,
        p.barcode,
        s.business_name,
        c.name
    FROM products p
    JOIN inventory_levels il ON il.product_id = p.id
    JOIN locations l ON l.id = il.location_id
    JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE l.qr_code = location_qr_code
    AND il.quantity > 0
    AND p.status = 'APPROVED'
    AND l.is_active = TRUE
    AND l.type = 'OUTLET'
    ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process kantin sale transaction
CREATE OR REPLACE FUNCTION process_kantin_sale(
    p_location_qr_code TEXT,
    p_items JSONB, -- [{"product_id": "uuid", "quantity": 2, "unit_price": 5000}]
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'CASH',
    p_payment_proof_url TEXT DEFAULT NULL
)
RETURNS TABLE (
    transaction_id UUID,
    transaction_code TEXT,
    total_amount DECIMAL(10,2),
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_location_id UUID;
    v_transaction_id UUID;
    v_transaction_code TEXT;
    v_total_amount DECIMAL(10,2) := 0;
    v_item JSONB;
    v_product_id UUID;
    v_quantity INTEGER;
    v_unit_price DECIMAL(10,2);
    v_available_stock INTEGER;
    v_subtotal DECIMAL(10,2);
BEGIN
    -- Get location ID
    SELECT id INTO v_location_id 
    FROM locations 
    WHERE qr_code = p_location_qr_code AND type = 'OUTLET' AND is_active = TRUE;
    
    IF v_location_id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::DECIMAL(10,2), FALSE, 'Invalid location QR code';
        RETURN;
    END IF;
    
    -- Generate transaction code
    v_transaction_code := 'KNT-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('transaction_seq')::text, 6, '0');
    
    -- Validate all items first
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_unit_price := (v_item->>'unit_price')::DECIMAL(10,2);
        
        -- Check stock availability
        SELECT quantity INTO v_available_stock
        FROM inventory_levels
        WHERE product_id = v_product_id AND location_id = v_location_id;
        
        IF v_available_stock IS NULL OR v_available_stock < v_quantity THEN
            RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::DECIMAL(10,2), FALSE, 
                format('Insufficient stock for product %s. Available: %s, Requested: %s', 
                       v_product_id, COALESCE(v_available_stock, 0), v_quantity);
            RETURN;
        END IF;
        
        v_subtotal := v_quantity * v_unit_price;
        v_total_amount := v_total_amount + v_subtotal;
    END LOOP;
    
    -- Create transaction
    INSERT INTO sales_transactions (
        location_id, transaction_code, customer_name, customer_phone, 
        total_amount, payment_method, payment_proof_url
    )
    VALUES (
        v_location_id, v_transaction_code, p_customer_name, p_customer_phone,
        v_total_amount, p_payment_method, p_payment_proof_url
    )
    RETURNING id INTO v_transaction_id;
    
    -- Process each item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_unit_price := (v_item->>'unit_price')::DECIMAL(10,2);
        v_subtotal := v_quantity * v_unit_price;
        
        -- Insert transaction item
        INSERT INTO sales_transaction_items (
            transaction_id, product_id, quantity, unit_price, subtotal
        )
        VALUES (
            v_transaction_id, v_product_id, v_quantity, v_unit_price, v_subtotal
        );
        
        -- Update inventory
        UPDATE inventory_levels 
        SET quantity = quantity - v_quantity,
            updated_at = NOW()
        WHERE product_id = v_product_id AND location_id = v_location_id;
    END LOOP;
    
    RETURN QUERY SELECT v_transaction_id, v_transaction_code, v_total_amount, TRUE, 'Transaction completed successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create sequence for transaction codes
CREATE SEQUENCE IF NOT EXISTS transaction_seq START 1;

-- ========================================
-- 2. SUPPLIER PAYMENT CALCULATION
-- ========================================

-- Calculate supplier payment for a period
CREATE OR REPLACE FUNCTION calculate_supplier_payment(
    p_supplier_id UUID,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS TABLE (
    supplier_id UUID,
    supplier_name TEXT,
    period_start DATE,
    period_end DATE,
    gross_sales DECIMAL(12,2),
    total_items_sold INTEGER,
    approved_adjustments_deduction DECIMAL(12,2),
    commission_rate DECIMAL(5,2),
    commission_amount DECIMAL(12,2),
    net_payment DECIMAL(12,2)
) AS $$
DECLARE
    v_supplier_name TEXT;
    v_commission_rate DECIMAL(5,2);
    v_gross_sales DECIMAL(12,2) := 0;
    v_total_items INTEGER := 0;
    v_adjustments_deduction DECIMAL(12,2) := 0;
    v_commission_amount DECIMAL(12,2) := 0;
    v_net_payment DECIMAL(12,2) := 0;
BEGIN
    -- Get supplier info
    SELECT s.business_name, s.commission_rate
    INTO v_supplier_name, v_commission_rate
    FROM suppliers s
    WHERE s.id = p_supplier_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supplier not found: %', p_supplier_id;
    END IF;
    
    -- Calculate gross sales from transactions
    SELECT 
        COALESCE(SUM(sti.subtotal), 0),
        COALESCE(SUM(sti.quantity), 0)
    INTO v_gross_sales, v_total_items
    FROM sales_transaction_items sti
    JOIN sales_transactions st ON st.id = sti.transaction_id
    JOIN products p ON p.id = sti.product_id
    WHERE p.supplier_id = p_supplier_id
    AND st.created_at::date BETWEEN p_period_start AND p_period_end
    AND st.status = 'COMPLETED';
    
    -- Calculate approved adjustment deductions
    SELECT COALESCE(SUM(
        CASE 
            WHEN ia.adjustment_type IN ('HILANG', 'RUSAK', 'KADALUWARSA') 
            THEN ABS(ia.quantity_change) * p.price
            ELSE 0
        END
    ), 0)
    INTO v_adjustments_deduction
    FROM inventory_adjustments ia
    JOIN inventory_levels il ON il.id = ia.inventory_level_id
    JOIN products p ON p.id = il.product_id
    WHERE p.supplier_id = p_supplier_id
    AND ia.status = 'APPROVED'
    AND ia.created_at::date BETWEEN p_period_start AND p_period_end
    AND ia.adjustment_type IN ('HILANG', 'RUSAK', 'KADALUWARSA');
    
    -- Calculate commission
    v_commission_amount := v_gross_sales * (v_commission_rate / 100);
    
    -- Calculate net payment
    v_net_payment := v_gross_sales - v_adjustments_deduction - v_commission_amount;
    
    RETURN QUERY SELECT 
        p_supplier_id,
        v_supplier_name,
        p_period_start,
        p_period_end,
        v_gross_sales,
        v_total_items,
        v_adjustments_deduction,
        v_commission_rate,
        v_commission_amount,
        v_net_payment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get detailed sales breakdown for supplier
CREATE OR REPLACE FUNCTION get_supplier_sales_breakdown(
    p_supplier_id UUID,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS TABLE (
    transaction_date DATE,
    location_name TEXT,
    product_name TEXT,
    quantity_sold INTEGER,
    unit_price DECIMAL(10,2),
    subtotal DECIMAL(10,2),
    transaction_code TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        st.created_at::date,
        l.name,
        p.name,
        sti.quantity,
        sti.unit_price,
        sti.subtotal,
        st.transaction_code
    FROM sales_transaction_items sti
    JOIN sales_transactions st ON st.id = sti.transaction_id
    JOIN products p ON p.id = sti.product_id
    JOIN locations l ON l.id = st.location_id
    WHERE p.supplier_id = p_supplier_id
    AND st.created_at::date BETWEEN p_period_start AND p_period_end
    AND st.status = 'COMPLETED'
    ORDER BY st.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 3. INVENTORY MANAGEMENT QUERIES
-- ========================================

-- Get current inventory status by supplier
CREATE OR REPLACE FUNCTION get_supplier_inventory_status(p_supplier_id UUID)
RETURNS TABLE (
    product_name TEXT,
    location_name TEXT,
    location_type TEXT,
    current_stock INTEGER,
    min_threshold INTEGER,
    stock_status TEXT,
    days_since_stocked INTEGER,
    expiry_date DATE,
    days_until_expiry INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name,
        l.name,
        l.type,
        il.quantity,
        p.min_stock_threshold,
        CASE 
            WHEN il.quantity = 0 THEN 'OUT_OF_STOCK'
            WHEN il.quantity <= p.min_stock_threshold THEN 'LOW_STOCK'
            ELSE 'NORMAL'
        END,
        (CURRENT_DATE - il.stocked_at_timestamp::date)::integer,
        (il.stocked_at_timestamp::date + p.expiry_duration_days * INTERVAL '1 day')::date,
        ((il.stocked_at_timestamp::date + p.expiry_duration_days * INTERVAL '1 day') - CURRENT_DATE)::integer
    FROM products p
    JOIN inventory_levels il ON il.product_id = p.id
    JOIN locations l ON l.id = il.location_id
    WHERE p.supplier_id = p_supplier_id
    AND p.status = 'APPROVED'
    AND l.is_active = TRUE
    ORDER BY l.type, l.name, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update inventory stock (for restocking)
CREATE OR REPLACE FUNCTION update_inventory_stock(
    p_product_id UUID,
    p_location_id UUID,
    p_new_quantity INTEGER,
    p_supplier_id UUID,
    p_notes TEXT DEFAULT 'Restock'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_quantity INTEGER;
    v_quantity_change INTEGER;
BEGIN
    -- Verify product belongs to supplier
    IF NOT EXISTS (
        SELECT 1 FROM products 
        WHERE id = p_product_id AND supplier_id = p_supplier_id
    ) THEN
        RAISE EXCEPTION 'Product does not belong to supplier';
    END IF;
    
    -- Get current quantity
    SELECT quantity INTO v_old_quantity
    FROM inventory_levels
    WHERE product_id = p_product_id AND location_id = p_location_id;
    
    IF NOT FOUND THEN
        -- Create new inventory record
        INSERT INTO inventory_levels (product_id, location_id, quantity, stocked_at_timestamp)
        VALUES (p_product_id, p_location_id, p_new_quantity, NOW());
        
        v_quantity_change := p_new_quantity;
    ELSE
        -- Update existing inventory
        UPDATE inventory_levels
        SET quantity = p_new_quantity,
            stocked_at_timestamp = NOW(),
            updated_at = NOW()
        WHERE product_id = p_product_id AND location_id = p_location_id;
        
        v_quantity_change := p_new_quantity - v_old_quantity;
    END IF;
    
    -- Log the adjustment if there's a change
    IF v_quantity_change != 0 THEN
        INSERT INTO inventory_adjustments (
            inventory_level_id, supplier_id, adjustment_type, 
            quantity_change, reason_notes, status
        )
        SELECT 
            il.id, p_supplier_id, 'RESTOCK', 
            v_quantity_change, p_notes, 'APPROVED'
        FROM inventory_levels il
        WHERE il.product_id = p_product_id AND il.location_id = p_location_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 4. REPORTING QUERIES
-- ========================================

-- Daily sales summary
CREATE OR REPLACE FUNCTION get_daily_sales_summary(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    location_name TEXT,
    total_transactions INTEGER,
    total_revenue DECIMAL(12,2),
    total_items_sold INTEGER,
    avg_transaction_value DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.name,
        COUNT(st.id)::integer,
        COALESCE(SUM(st.total_amount), 0),
        COALESCE(SUM(sti_summary.total_quantity), 0)::integer,
        COALESCE(AVG(st.total_amount), 0)
    FROM locations l
    LEFT JOIN sales_transactions st ON st.location_id = l.id 
        AND st.created_at::date = p_date 
        AND st.status = 'COMPLETED'
    LEFT JOIN (
        SELECT 
            sti.transaction_id,
            SUM(sti.quantity) as total_quantity
        FROM sales_transaction_items sti
        GROUP BY sti.transaction_id
    ) sti_summary ON sti_summary.transaction_id = st.id
    WHERE l.type = 'OUTLET' AND l.is_active = TRUE
    GROUP BY l.id, l.name
    ORDER BY l.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Top selling products
CREATE OR REPLACE FUNCTION get_top_selling_products(
    p_start_date DATE,
    p_end_date DATE,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    product_name TEXT,
    supplier_name TEXT,
    total_quantity_sold INTEGER,
    total_revenue DECIMAL(12,2),
    avg_price DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name,
        s.business_name,
        SUM(sti.quantity)::integer,
        SUM(sti.subtotal),
        AVG(sti.unit_price)
    FROM sales_transaction_items sti
    JOIN sales_transactions st ON st.id = sti.transaction_id
    JOIN products p ON p.id = sti.product_id
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE st.created_at::date BETWEEN p_start_date AND p_end_date
    AND st.status = 'COMPLETED'
    GROUP BY p.id, p.name, s.business_name
    ORDER BY SUM(sti.quantity) DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;