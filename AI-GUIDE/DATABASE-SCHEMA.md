# 🗄️ DATABASE SCHEMA REFERENCE

> **Dokumentasi lengkap struktur database Platform Konsinyasi**  
> **Database:** PostgreSQL via Supabase  
> **Last Updated:** 2 Desember 2025

---

## 📊 TABLE OF CONTENTS

1. [Database Overview](#database-overview)
2. [Table Definitions](#table-definitions)
3. [RPC Functions](#rpc-functions)
4. [Database Triggers](#database-triggers)
5. [RLS Policies](#rls-policies)
6. [Indexes](#indexes)
7. [Relationships Diagram](#relationships-diagram)

---

## 🎯 DATABASE OVERVIEW

**Database Type:** PostgreSQL 15.x  
**Hosting:** Supabase Cloud  
**Project:** konsinyasi  
**Schema:** public (default)

**Key Features:**
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Triggers for automatic calculations
- ✅ Foreign key constraints with CASCADE
- ✅ Check constraints for data integrity
- ✅ Indexes on foreign keys and frequently queried columns

---

## 📋 TABLE DEFINITIONS

### **1. profiles**
**Purpose:** User authentication & role management

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SUPPLIER', 'SUPER_ADMIN', 'LOCATION_ADMIN')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_location_id UUID REFERENCES locations(id) -- For LOCATION_ADMIN (PLANNED)
);
```

**Columns:**
- `id` - UUID, matches auth.users.id
- `email` - User email (unique)
- `full_name` - Display name
- `role` - User role (ADMIN, SUPPLIER, SUPER_ADMIN, LOCATION_ADMIN)
- `created_at` - Registration timestamp
- `assigned_location_id` - For location-specific admins (PLANNED)

**Indexes:**
```sql
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
```

**RLS Policies:**
- Users can read their own profile
- Admins can read all profiles
- Only system can insert (via auth trigger)

---

### **2. suppliers**
**Purpose:** Supplier master data & business information

```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  rejected_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique supplier ID
- `profile_id` - Link to user profile
- `business_name` - Company/business name
- `phone` - Contact number
- `address` - Business address
- `bank_*` - Payment information
- `status` - Approval status (PENDING, APPROVED, REJECTED)
- `rejected_reason` - Reason if rejected

**Indexes:**
```sql
CREATE INDEX idx_suppliers_profile_id ON suppliers(profile_id);
CREATE INDEX idx_suppliers_status ON suppliers(status);
```

**RLS Policies:**
- Suppliers can read/update their own data
- Admins can read/update all suppliers
- Suppliers cannot change their own status

---

### **3. locations**
**Purpose:** Physical store/canteen locations

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  qr_code TEXT UNIQUE NOT NULL,
  qris_code TEXT,
  qris_image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  admin_user_id UUID REFERENCES profiles(id), -- PLANNED: Location admin
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique location ID
- `name` - Store name (e.g., "Kantin Pusat")
- `address` - Physical address
- `qr_code` - Unique QR code for self-checkout
- `qris_code` - QRIS payment code
- `qris_image_url` - URL to QRIS image in storage
- `is_active` - Enable/disable location
- `admin_user_id` - Dedicated admin for this location (PLANNED)

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_locations_qr_code ON locations(qr_code);
CREATE INDEX idx_locations_is_active ON locations(is_active);
```

**RLS Policies:**
- Public can read active locations
- Only admins can insert/update/delete

---

### **4. products**
**Purpose:** Product catalog from suppliers

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(15,2) NOT NULL CHECK (price >= 0),
  image_url TEXT,
  category TEXT,
  barcode TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique product ID
- `supplier_id` - Owner supplier
- `name` - Product name
- `description` - Product description
- `price` - Selling price (must be >= 0)
- `image_url` - URL to product image
- `category` - Product category (e.g., "Makanan", "Minuman")
- `barcode` - Optional barcode
- `status` - Approval status
- `is_active` - Visibility control

**Indexes:**
```sql
CREATE INDEX idx_products_supplier_id ON products(supplier_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_category ON products(category);
```

**RLS Policies:**
- Suppliers can read/update their own products
- Admins can read/update all products
- Public can read approved & active products only

---

### **5. inventory_levels**
**Purpose:** Current stock quantity per product per location

```sql
CREATE TABLE inventory_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  low_stock_threshold INTEGER DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, location_id)
);
```

**Columns:**
- `id` - Unique inventory ID
- `product_id` - Product reference
- `location_id` - Location reference
- `quantity` - Available stock
- `reserved_quantity` - Stock reserved by pending transactions
- `low_stock_threshold` - Alert threshold
- `updated_at` - Last update timestamp

**Constraints:**
- `quantity >= 0` - Cannot go negative
- `reserved_quantity >= 0` - Cannot go negative
- UNIQUE(product_id, location_id) - One record per product per location

**Indexes:**
```sql
CREATE INDEX idx_inventory_product_id ON inventory_levels(product_id);
CREATE INDEX idx_inventory_location_id ON inventory_levels(location_id);
CREATE INDEX idx_inventory_quantity ON inventory_levels(quantity);
```

---

### **6. stock_movements**
**Purpose:** Header table for stock transactions

```sql
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'RETURN', 'ADJUSTMENT')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique movement ID
- `supplier_id` - Supplier reference
- `location_id` - Location reference
- `movement_type` - Type of movement:
  - `IN` - Supplier shipment (barang masuk)
  - `OUT` - Sale (barang keluar)
  - `RETURN` - Return to supplier
  - `ADJUSTMENT` - Stock correction
- `status` - Workflow status
- `notes` - Additional notes
- `created_by` - User who created
- `reviewed_by` - User who reviewed
- `reviewed_at` - Review timestamp

**Indexes:**
```sql
CREATE INDEX idx_stock_movements_supplier_id ON stock_movements(supplier_id);
CREATE INDEX idx_stock_movements_location_id ON stock_movements(location_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_status ON stock_movements(status);
```

**Important:** Movement type `IN` is used for supplier shipments (NOT `SHIPMENT`)

---

### **7. stock_movement_items**
**Purpose:** Detail items in each stock movement

```sql
CREATE TABLE stock_movement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique item ID
- `movement_id` - Parent movement
- `product_id` - Product reference
- `quantity` - Quantity moved
- `notes` - Item-specific notes

**Indexes:**
```sql
CREATE INDEX idx_stock_movement_items_movement_id ON stock_movement_items(movement_id);
CREATE INDEX idx_stock_movement_items_product_id ON stock_movement_items(product_id);
```

---

### **8. sales_transactions**
**Purpose:** Customer purchase transactions

```sql
CREATE TABLE sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  transaction_code TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT CHECK (payment_method IN ('CASH', 'QRIS', 'PENDING')),
  payment_proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);
```

**Columns:**
- `id` - Unique transaction ID
- `location_id` - Location where sale happened
- `transaction_code` - Human-readable code (e.g., "TRX-20250202-001")
- `customer_name` - Optional customer name
- `customer_phone` - Optional customer phone
- `total_amount` - Total transaction value
- `payment_method` - Payment type (CASH, QRIS, PENDING)
- `payment_proof_url` - URL to payment proof image
- `status` - Transaction status
- `created_by` - User who created (null for self-checkout)
- `paid_at` - Payment confirmation timestamp

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_sales_transaction_code ON sales_transactions(transaction_code);
CREATE INDEX idx_sales_transactions_location_id ON sales_transactions(location_id);
CREATE INDEX idx_sales_transactions_status ON sales_transactions(status);
CREATE INDEX idx_sales_transactions_created_at ON sales_transactions(created_at);
```

---

### **9. sales_transaction_items**
**Purpose:** Line items in each sale

```sql
CREATE TABLE sales_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES sales_transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(15,2) NOT NULL CHECK (price >= 0),
  subtotal DECIMAL(15,2) NOT NULL CHECK (subtotal >= 0),
  commission_amount DECIMAL(15,2) NOT NULL DEFAULT 0, -- 10% platform fee
  supplier_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,  -- 90% to supplier
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique item ID
- `transaction_id` - Parent transaction
- `product_id` - Product sold
- `supplier_id` - Product's supplier (for commission split)
- `quantity` - Quantity sold
- `price` - Unit price at time of sale
- `subtotal` - price * quantity
- `commission_amount` - Platform fee (10% of subtotal)
- `supplier_revenue` - Supplier earning (90% of subtotal)

**Indexes:**
```sql
CREATE INDEX idx_sales_items_transaction_id ON sales_transaction_items(transaction_id);
CREATE INDEX idx_sales_items_product_id ON sales_transaction_items(product_id);
CREATE INDEX idx_sales_items_supplier_id ON sales_transaction_items(supplier_id);
```

**Commission Calculation:**
```sql
-- Automatically calculated on insert
commission_amount = subtotal * 0.10  -- 10%
supplier_revenue = subtotal * 0.90   -- 90%
```

---

### **10. supplier_wallets**
**Purpose:** Supplier balance tracking

```sql
CREATE TABLE supplier_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID UNIQUE NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  pending_balance DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (pending_balance >= 0),
  available_balance DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  total_earned DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  total_withdrawn DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (total_withdrawn >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique wallet ID
- `supplier_id` - Owner supplier (unique)
- `pending_balance` - Revenue waiting confirmation
- `available_balance` - Confirmed revenue ready for withdrawal
- `total_earned` - Lifetime earnings
- `total_withdrawn` - Lifetime withdrawals

**Balance Flow:**
```
Sale (PENDING) → pending_balance
Sale (PAID)    → pending_balance - amount, available_balance + amount
Withdrawal     → available_balance - amount, total_withdrawn + amount
Return         → pending_balance - amount, total_earned - amount
```

**Indexes:**
```sql
CREATE UNIQUE INDEX idx_supplier_wallets_supplier_id ON supplier_wallets(supplier_id);
```

---

### **11. wallet_transactions**
**Purpose:** Audit log for wallet changes

```sql
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES supplier_wallets(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('SALE', 'WITHDRAWAL', 'REFUND', 'RETURN_DEDUCTION')),
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique log ID
- `wallet_id` - Wallet reference
- `transaction_type` - Type of transaction:
  - `SALE` - Revenue from sale
  - `WITHDRAWAL` - Supplier withdrawal
  - `REFUND` - Customer refund (deduction)
  - `RETURN_DEDUCTION` - Return accepted (deduction)
- `amount` - Transaction amount (positive or negative)
- `balance_before` - Balance before transaction
- `balance_after` - Balance after transaction
- `description` - Human-readable description
- `reference_id` - ID of related record (sale, withdrawal request, etc.)
- `reference_type` - Type of reference ('sale', 'withdrawal', 'return')
- `created_by` - User who triggered transaction

**Indexes:**
```sql
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX idx_wallet_transactions_reference ON wallet_transactions(reference_id, reference_type);
```

---

### **12. shipment_returns**
**Purpose:** Product return requests (damaged/expired goods)

```sql
CREATE TABLE shipment_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  proof_photos TEXT[], -- Array of image URLs
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  requested_by UUID NOT NULL REFERENCES profiles(id),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Unique return ID
- `supplier_id` - Supplier who will receive the return
- `product_id` - Product being returned
- `location_id` - Location where product is
- `quantity` - Quantity to return
- `reason` - Reason for return (damaged, expired, etc.)
- `proof_photos` - Array of photo URLs
- `status` - Return workflow status:
  - `PENDING` - Awaiting supplier review
  - `APPROVED` - Supplier accepted, awaiting pickup
  - `REJECTED` - Supplier rejected
  - `COMPLETED` - Supplier confirmed pickup
- `requested_by` - Admin who created return
- `reviewed_by` - Supplier who reviewed
- `reviewed_at` - Review timestamp
- `review_notes` - Supplier's review notes

**Indexes:**
```sql
CREATE INDEX idx_shipment_returns_supplier_id ON shipment_returns(supplier_id);
CREATE INDEX idx_shipment_returns_product_id ON shipment_returns(product_id);
CREATE INDEX idx_shipment_returns_location_id ON shipment_returns(location_id);
CREATE INDEX idx_shipment_returns_status ON shipment_returns(status);
```

**Return Workflow:**
```
1. Admin creates return (PENDING)
2. Supplier reviews & approves/rejects
3. If approved → Wallet deducted
4. Supplier picks up product
5. Supplier confirms pickup (COMPLETED) → Inventory reduced
```

---

### **13. payment_settings**
**Purpose:** QRIS payment configuration

```sql
CREATE TABLE payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qris_code TEXT NOT NULL,
  qris_image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns:**
- `id` - Setting ID
- `qris_code` - QRIS payment code
- `qris_image_url` - URL to QRIS image
- `is_active` - Enable/disable QRIS

---

### **14. withdrawal_requests** (PLANNED)
**Purpose:** Supplier withdrawal requests

```sql
CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES supplier_wallets(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  bank_name TEXT NOT NULL,
  bank_account_number TEXT NOT NULL,
  bank_account_holder TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  proof_image_url TEXT,
  rejected_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ⚙️ RPC FUNCTIONS

### **1. process_anonymous_checkout**
**Purpose:** Create transaction from self-checkout cart

```sql
CREATE OR REPLACE FUNCTION process_anonymous_checkout(
  p_location_id UUID,
  p_items JSONB,
  p_total_amount DECIMAL,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL
)
RETURNS JSON
```

**Input:**
```json
{
  "p_location_id": "uuid",
  "p_items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "price": 15000
    }
  ],
  "p_total_amount": 30000,
  "p_customer_name": "John Doe",
  "p_customer_phone": "081234567890"
}
```

**Output:**
```json
{
  "transaction_id": "uuid",
  "transaction_code": "TRX-20250202-001"
}
```

**Logic:**
1. Generate unique transaction code
2. Insert sales_transaction (status = PENDING)
3. For each item:
   - Validate product exists & is active
   - Get supplier_id
   - Calculate commission (10%) & supplier revenue (90%)
   - Insert sales_transaction_items
4. Return transaction details

**Security:** PUBLIC (no auth required for self-checkout)

---

### **2. confirm_payment_with_method**
**Purpose:** Confirm payment and reduce inventory

```sql
CREATE OR REPLACE FUNCTION confirm_payment_with_method(
  p_transaction_id UUID,
  p_payment_method TEXT,
  p_location_id UUID
)
RETURNS JSON
```

**Input:**
```json
{
  "p_transaction_id": "uuid",
  "p_payment_method": "QRIS",
  "p_location_id": "uuid"
}
```

**Logic:**
1. Validate transaction exists & is PENDING
2. Update transaction:
   - status = PAID
   - payment_method = p_payment_method
   - paid_at = NOW()
3. For each transaction item:
   - Reduce inventory quantity
   - Update supplier wallet (pending_balance += supplier_revenue)
   - Log wallet transaction
4. Return success

**Security:** SECURITY DEFINER (system function)

---

### **3. approve_return_request**
**Purpose:** Supplier approves return request

```sql
CREATE OR REPLACE FUNCTION approve_return_request(
  p_return_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSON
```

**Logic:**
1. Get return details
2. Validate supplier owns this return (supplier_id = auth.uid())
3. Update return:
   - status = APPROVED
   - reviewed_by = auth.uid()
   - reviewed_at = NOW()
   - review_notes = p_review_notes
4. Return success

**Security:** SECURITY DEFINER with auth check

---

### **4. reject_return_request**
**Purpose:** Supplier rejects return request

```sql
CREATE OR REPLACE FUNCTION reject_return_request(
  p_return_id UUID,
  p_review_notes TEXT
)
RETURNS JSON
```

**Logic:**
1. Validate supplier owns this return
2. Update status = REJECTED
3. Set review notes & timestamp
4. Return success

---

### **5. confirm_return_pickup**
**Purpose:** Supplier confirms product received

```sql
CREATE OR REPLACE FUNCTION confirm_return_pickup(
  p_return_id UUID
)
RETURNS JSON
```

**Logic:**
1. Validate return is APPROVED
2. Validate supplier owns this return
3. Update status = COMPLETED
4. Reduce inventory quantity
5. Return success

**Security:** SECURITY DEFINER with auth check

---

### **6. get_supplier_dashboard_stats** (Example)
**Purpose:** Get supplier KPIs

```sql
CREATE OR REPLACE FUNCTION get_supplier_dashboard_stats(
  p_supplier_id UUID
)
RETURNS JSON
```

**Returns:**
```json
{
  "total_products": 50,
  "active_products": 45,
  "total_sales": 1500000,
  "pending_balance": 500000,
  "available_balance": 800000
}
```

---

## 🔥 DATABASE TRIGGERS

### **1. handle_return_reduce_pending**
**Purpose:** Auto-deduct wallet when return is approved

```sql
CREATE OR REPLACE FUNCTION handle_return_reduce_pending()
RETURNS TRIGGER AS $$
DECLARE
  v_supplier_id UUID;
  v_product_price DECIMAL;
  v_return_value DECIMAL;
  v_wallet_id UUID;
BEGIN
  -- Only trigger when status changes to APPROVED
  IF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
    -- Get supplier_id directly from NEW
    v_supplier_id := NEW.supplier_id;
    
    -- Get product price
    SELECT price INTO v_product_price
    FROM products
    WHERE id = NEW.product_id;
    
    -- Calculate return value (supplier gets 90% normally)
    v_return_value := NEW.quantity * v_product_price * 0.9;
    
    -- Get wallet_id
    SELECT id INTO v_wallet_id
    FROM supplier_wallets
    WHERE supplier_id = v_supplier_id;
    
    -- Deduct from pending_balance and total_earned
    UPDATE supplier_wallets
    SET 
      pending_balance = pending_balance - v_return_value,
      total_earned = total_earned - v_return_value,
      updated_at = NOW()
    WHERE id = v_wallet_id;
    
    -- Log transaction
    INSERT INTO wallet_transactions (
      wallet_id,
      transaction_type,
      amount,
      balance_before,
      balance_after,
      description,
      reference_id,
      reference_type
    )
    VALUES (
      v_wallet_id,
      'RETURN_DEDUCTION',
      -v_return_value,
      (SELECT pending_balance + v_return_value FROM supplier_wallets WHERE id = v_wallet_id),
      (SELECT pending_balance FROM supplier_wallets WHERE id = v_wallet_id),
      'Deduction for return #' || NEW.id,
      NEW.id,
      'return'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_return_reduce_pending
AFTER UPDATE ON shipment_returns
FOR EACH ROW
EXECUTE FUNCTION handle_return_reduce_pending();
```

**Trigger Event:** AFTER UPDATE on shipment_returns  
**Condition:** Status changes to APPROVED  
**Action:**
1. Calculate return value (quantity * price * 0.9)
2. Deduct from pending_balance
3. Deduct from total_earned
4. Log wallet transaction

---

### **2. auto_create_supplier_wallet**
**Purpose:** Create wallet when supplier is created

```sql
CREATE OR REPLACE FUNCTION auto_create_supplier_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO supplier_wallets (supplier_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_wallet
AFTER INSERT ON suppliers
FOR EACH ROW
EXECUTE FUNCTION auto_create_supplier_wallet();
```

**Trigger Event:** AFTER INSERT on suppliers  
**Action:** Create wallet with default balances (0)

---

### **3. update_inventory_on_sale** (Example - if needed)
**Purpose:** Reduce inventory when sale is confirmed

```sql
-- This logic is handled in confirm_payment_with_method RPC
-- Can be implemented as trigger if preferred
```

---

## 🔒 RLS POLICIES

### **profiles**

```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);
```

---

### **suppliers**

```sql
-- Suppliers can read their own data
CREATE POLICY "Suppliers can read own data"
ON suppliers FOR SELECT
TO authenticated
USING (
  profile_id = auth.uid()
);

-- Admins can read all suppliers
CREATE POLICY "Admins can read all suppliers"
ON suppliers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- Admins can update suppliers
CREATE POLICY "Admins can update suppliers"
ON suppliers FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- Admins can delete suppliers
CREATE POLICY "Admins can delete suppliers"
ON suppliers FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);
```

---

### **products**

```sql
-- Public can read approved & active products
CREATE POLICY "Public can read approved active products"
ON products FOR SELECT
TO anon, authenticated
USING (status = 'APPROVED' AND is_active = TRUE);

-- Suppliers can read their own products
CREATE POLICY "Suppliers can read own products"
ON products FOR SELECT
TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

-- Admins can read all products
CREATE POLICY "Admins can read all products"
ON products FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- Suppliers can insert their own products
CREATE POLICY "Suppliers can insert own products"
ON products FOR INSERT
TO authenticated
WITH CHECK (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

-- Suppliers can update their own products (except status)
CREATE POLICY "Suppliers can update own products"
ON products FOR UPDATE
TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

-- Admins can update all products
CREATE POLICY "Admins can update all products"
ON products FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);
```

---

### **inventory_levels**

```sql
-- Public can read inventory for active products
CREATE POLICY "Public can read inventory"
ON inventory_levels FOR SELECT
TO anon, authenticated
USING (
  product_id IN (
    SELECT id FROM products WHERE status = 'APPROVED' AND is_active = TRUE
  )
);

-- Admins can manage inventory
CREATE POLICY "Admins can manage inventory"
ON inventory_levels FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);
```

---

### **sales_transactions**

```sql
-- Admins can read all transactions
CREATE POLICY "Admins can read all transactions"
ON sales_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- Public can insert (self-checkout)
CREATE POLICY "Public can create transactions"
ON sales_transactions FOR INSERT
TO anon, authenticated
WITH CHECK (TRUE);

-- System can update (via RPC)
CREATE POLICY "System can update transactions"
ON sales_transactions FOR UPDATE
TO authenticated
USING (TRUE);
```

---

### **supplier_wallets**

```sql
-- Suppliers can read their own wallet
CREATE POLICY "Suppliers can read own wallet"
ON supplier_wallets FOR SELECT
TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

-- Admins can read all wallets
CREATE POLICY "Admins can read all wallets"
ON supplier_wallets FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);
```

---

### **shipment_returns**

```sql
-- Admins can manage returns
CREATE POLICY "Admins can manage returns"
ON shipment_returns FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- Suppliers can read their own returns
CREATE POLICY "Suppliers can read own returns"
ON shipment_returns FOR SELECT
TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);

-- Suppliers can update their own returns (approve/reject)
CREATE POLICY "Suppliers can update own returns"
ON shipment_returns FOR UPDATE
TO authenticated
USING (
  supplier_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  )
);
```

---

## 📊 INDEXES

**Performance-Critical Indexes:**

```sql
-- Foreign Keys (MUST HAVE)
CREATE INDEX idx_suppliers_profile_id ON suppliers(profile_id);
CREATE INDEX idx_products_supplier_id ON products(supplier_id);
CREATE INDEX idx_inventory_product_id ON inventory_levels(product_id);
CREATE INDEX idx_inventory_location_id ON inventory_levels(location_id);
CREATE INDEX idx_stock_movements_supplier_id ON stock_movements(supplier_id);
CREATE INDEX idx_stock_movements_location_id ON stock_movements(location_id);
CREATE INDEX idx_sales_transactions_location_id ON sales_transactions(location_id);
CREATE INDEX idx_sales_items_transaction_id ON sales_transaction_items(transaction_id);
CREATE INDEX idx_sales_items_product_id ON sales_transaction_items(product_id);
CREATE INDEX idx_sales_items_supplier_id ON sales_transaction_items(supplier_id);

-- Frequently Queried Columns
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_suppliers_status ON suppliers(status);
CREATE INDEX idx_stock_movements_status ON stock_movements(status);
CREATE INDEX idx_sales_transactions_status ON sales_transactions(status);
CREATE INDEX idx_shipment_returns_status ON shipment_returns(status);

-- Unique Constraints
CREATE UNIQUE INDEX idx_locations_qr_code ON locations(qr_code);
CREATE UNIQUE INDEX idx_sales_transaction_code ON sales_transactions(transaction_code);
CREATE UNIQUE INDEX idx_inventory_product_location ON inventory_levels(product_id, location_id);
```

---

## 🗺️ RELATIONSHIPS DIAGRAM

```
┌─────────────┐
│   profiles  │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
┌──────▼──────┐   ┌──────▼────────┐
│  suppliers  │   │   locations   │
└──────┬──────┘   └───────┬───────┘
       │                  │
       │         ┌────────┴────────┐
       │         │                 │
┌──────▼──────┐  │  ┌──────────────▼───────────┐
│  products   │──┤  │  sales_transactions      │
└──────┬──────┘  │  └──────────────┬───────────┘
       │         │                 │
       │         │  ┌──────────────▼────────────────┐
       │         └─>│  sales_transaction_items      │
       │            └───────────────────────────────┘
       │
       ├─────────────────┐
       │                 │
┌──────▼────────┐ ┌──────▼────────┐
│ inventory_    │ │ stock_        │
│ levels        │ │ movements     │
└───────────────┘ └──────┬────────┘
                         │
                  ┌──────▼────────┐
                  │ stock_        │
                  │ movement_     │
                  │ items         │
                  └───────────────┘

┌─────────────┐
│  suppliers  │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
┌──────▼──────┐   ┌──────▼────────┐
│ supplier_   │   │ shipment_     │
│ wallets     │   │ returns       │
└──────┬──────┘   └───────────────┘
       │
┌──────▼──────┐
│ wallet_     │
│ transactions│
└─────────────┘
```

---

## 🔧 COMMON QUERIES

### **Get Inventory for Location:**
```sql
SELECT 
  p.id,
  p.name,
  p.price,
  p.image_url,
  s.business_name,
  i.quantity,
  i.reserved_quantity
FROM inventory_levels i
JOIN products p ON i.product_id = p.id
JOIN suppliers s ON p.supplier_id = s.id
WHERE i.location_id = 'location-uuid'
  AND p.status = 'APPROVED'
  AND p.is_active = TRUE
  AND i.quantity > 0
ORDER BY p.name;
```

### **Get Supplier Sales Summary:**
```sql
SELECT 
  SUM(sti.supplier_revenue) as total_revenue,
  COUNT(DISTINCT st.id) as total_transactions,
  SUM(sti.quantity) as total_items_sold
FROM sales_transaction_items sti
JOIN sales_transactions st ON sti.transaction_id = st.id
WHERE sti.supplier_id = 'supplier-uuid'
  AND st.status = 'PAID'
  AND st.created_at >= NOW() - INTERVAL '30 days';
```

### **Get Low Stock Products:**
```sql
SELECT 
  p.name,
  l.name as location_name,
  i.quantity,
  i.low_stock_threshold
FROM inventory_levels i
JOIN products p ON i.product_id = p.id
JOIN locations l ON i.location_id = l.id
WHERE i.quantity <= i.low_stock_threshold
  AND p.is_active = TRUE
ORDER BY i.quantity ASC;
```

---

**Document Version:** 1.0  
**Last Updated:** 2 Desember 2025  
**For:** AI Agent Reference
