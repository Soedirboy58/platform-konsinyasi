# 📘 MASTER DATABASE MIGRATIONS
## Platform Konsinyasi Katalara - Database Schema v2.0.0

Jalankan migrations ini **SECARA BERURUTAN** untuk membuat database dari nol.

---

## 🎯 URUTAN EKSEKUSI

### Phase 1: Core Tables (User & Auth)
```
01. profiles
02. suppliers
```

### Phase 2: Business Data
```
03. locations
04. products
05. inventory
```

### Phase 3: Transactions
```
06. stock_movements
07. sales_transactions
08. sales_transaction_items
```

### Phase 4: Financial
```
09. supplier_payments
10. commissions
11. payment_settings
12. wallet_transactions
```

### Phase 5: Operations
```
13. shipments
14. shipment_items
15. shipment_returns
16. notifications
```

### Phase 6: Analytics
```
17. customer_reports
```

---

## 📋 DETAIL MIGRATIONS

### Migration 01: Profiles Table
**File:** `01-profiles.sql`
**Purpose:** User profiles (ADMIN/SUPPLIER roles)
**Dependencies:** None (requires auth.users from Supabase)

**Schema:**
- id (UUID, FK to auth.users)
- email (TEXT)
- full_name (TEXT)
- role (TEXT: ADMIN/SUPPLIER)
- created_at, updated_at (TIMESTAMPTZ)

**RLS:** Admin full access, Supplier own record only

---

### Migration 02: Suppliers Table
**File:** `02-suppliers.sql`
**Purpose:** Supplier business information
**Dependencies:** profiles

**Schema:**
- id (UUID PK)
- profile_id (UUID FK → profiles)
- business_name (TEXT)
- business_address (TEXT)
- phone (TEXT)
- bank_account (TEXT)
- is_active (BOOLEAN)
- approved_at (TIMESTAMPTZ)
- created_at, updated_at (TIMESTAMPTZ)

**RLS:** Admin full access, Supplier own record only

---

### Migration 03: Locations Table
**File:** `03-locations.sql`
**Purpose:** Outlet/store locations with QR codes
**Dependencies:** None

**Schema:**
- id (UUID PK)
- name (TEXT)
- code (TEXT UNIQUE)
- qr_code (TEXT) - For self-checkout
- address (TEXT)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)

**RLS:** Admin full access, Public read for active locations

---

### Migration 04: Products Table
**File:** `04-products.sql`
**Purpose:** Product catalog
**Dependencies:** suppliers

**Schema:**
- id (UUID PK)
- supplier_id (UUID FK → suppliers)
- name (TEXT)
- description (TEXT)
- price (DECIMAL)
- category (TEXT)
- image_url (TEXT)
- is_approved (BOOLEAN)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)

**RLS:** Admin full access, Supplier own products, Public read approved

---

### Migration 05: Inventory Table
**File:** `05-inventory.sql`
**Purpose:** Stock levels per location
**Dependencies:** products, locations

**Schema:**
- id (UUID PK)
- product_id (UUID FK → products)
- location_id (UUID FK → locations)
- quantity (INTEGER)
- last_updated (TIMESTAMPTZ)
- created_at (TIMESTAMPTZ)

**RLS:** Admin full access, Supplier own products inventory

**Constraints:**
- UNIQUE(product_id, location_id)
- CHECK(quantity >= 0)

---

### Migration 06: Stock Movements Table
**File:** `06-stock-movements.sql`
**Purpose:** Track all inventory changes
**Dependencies:** products, locations, suppliers

**Schema:**
- id (UUID PK)
- product_id (UUID FK → products)
- location_id (UUID FK → locations)
- supplier_id (UUID FK → suppliers)
- movement_type (TEXT: IN/OUT/RETURN/ADJUSTMENT)
- quantity (INTEGER)
- notes (TEXT)
- reviewed_at (TIMESTAMPTZ)
- reviewed_by (UUID FK → profiles)
- created_at (TIMESTAMPTZ)

**RLS:** Admin full access, Supplier own movements

---

### Migration 07: Sales Transactions Table
**File:** `07-sales-transactions.sql`
**Purpose:** Sales header (checkout sessions)
**Dependencies:** locations

**Schema:**
- id (UUID PK)
- location_id (UUID FK → locations)
- total_amount (DECIMAL)
- payment_method (TEXT)
- payment_proof_url (TEXT)
- status (TEXT: PENDING/PAID/CANCELLED)
- created_at (TIMESTAMPTZ)

**RLS:** Admin full access, Location based access

---

### Migration 08: Sales Transaction Items Table
**File:** `08-sales-transaction-items.sql`
**Purpose:** Sales details (line items)
**Dependencies:** sales_transactions, products

**Schema:**
- id (UUID PK)
- transaction_id (UUID FK → sales_transactions)
- product_id (UUID FK → products)
- quantity (INTEGER)
- price (DECIMAL)
- subtotal (DECIMAL)

**RLS:** Inherited from sales_transactions

---

### Migration 09: Supplier Payments Table
**File:** `09-supplier-payments.sql`
**Purpose:** Payment to suppliers
**Dependencies:** suppliers

**Schema:**
- id (UUID PK)
- supplier_id (UUID FK → suppliers)
- amount (DECIMAL)
- period_start (DATE)
- period_end (DATE)
- status (TEXT: PENDING/APPROVED/PAID/REJECTED)
- payment_proof_url (TEXT)
- paid_at (TIMESTAMPTZ)
- created_at, updated_at (TIMESTAMPTZ)

**RLS:** Admin full access, Supplier own payments

---

### Migration 10: Commissions Table
**File:** `10-commissions.sql`
**Purpose:** Platform commission tracking
**Dependencies:** suppliers, sales_transactions

**Schema:**
- id (UUID PK)
- supplier_id (UUID FK → suppliers)
- transaction_id (UUID FK → sales_transactions)
- sale_amount (DECIMAL)
- commission_rate (DECIMAL)
- commission_amount (DECIMAL)
- status (TEXT: PENDING/CALCULATED/PAID)
- created_at (TIMESTAMPTZ)

**RLS:** Admin only

---

### Migration 11: Payment Settings Table
**File:** `11-payment-settings.sql`
**Purpose:** Global payment configuration
**Dependencies:** None

**Schema:**
- id (UUID PK)
- minimum_payout_amount (INTEGER)
- payment_schedule (TEXT)
- allow_partial_payment (BOOLEAN)
- created_at, updated_at (TIMESTAMPTZ)

**RLS:** Admin read/update only

---

### Migration 12: Wallet Transactions Table
**File:** `12-wallet-transactions.sql`
**Purpose:** Supplier wallet movements
**Dependencies:** suppliers

**Schema:**
- id (UUID PK)
- supplier_id (UUID FK → suppliers)
- amount (DECIMAL)
- type (TEXT: SALE/PAYOUT/COMMISSION/RETURN)
- reference_id (UUID)
- balance_after (DECIMAL)
- notes (TEXT)
- created_at (TIMESTAMPTZ)

**RLS:** Admin full access, Supplier own transactions

---

### Migration 13: Shipments Table
**File:** `13-shipments.sql`
**Purpose:** Product delivery tracking
**Dependencies:** suppliers, locations

**Schema:**
- id (UUID PK)
- shipment_number (TEXT UNIQUE)
- supplier_id (UUID FK → suppliers)
- location_id (UUID FK → locations)
- status (TEXT: PENDING/APPROVED/DELIVERED/REJECTED)
- notes (TEXT)
- approved_at (TIMESTAMPTZ)
- approved_by (UUID FK → profiles)
- created_at, updated_at (TIMESTAMPTZ)

**RLS:** Admin full access, Supplier own shipments

---

### Migration 14: Shipment Items Table
**File:** `14-shipment-items.sql`
**Purpose:** Products in shipment
**Dependencies:** shipments, products

**Schema:**
- id (UUID PK)
- shipment_id (UUID FK → shipments)
- product_id (UUID FK → products)
- quantity (INTEGER)
- notes (TEXT)

**RLS:** Inherited from shipments

---

### Migration 15: Shipment Returns Table
**File:** `15-shipment-returns.sql`
**Purpose:** Product returns from outlets
**Dependencies:** shipments, shipment_items, suppliers

**Schema:**
- id (UUID PK)
- shipment_id (UUID FK → shipments)
- shipment_item_id (UUID FK → shipment_items)
- supplier_id (UUID FK → suppliers)
- quantity (INTEGER)
- reason (TEXT)
- proof_photo_url (TEXT)
- status (TEXT: PENDING/CONFIRMED/REJECTED)
- confirmed_at (TIMESTAMPTZ)
- confirmed_by (UUID FK → profiles)
- created_at, updated_at (TIMESTAMPTZ)

**RLS:** Admin full access, Supplier own returns

---

### Migration 16: Notifications Table
**File:** `16-notifications.sql`
**Purpose:** System notifications
**Dependencies:** profiles

**Schema:**
- id (UUID PK)
- user_id (UUID FK → profiles)
- type (TEXT)
- title (TEXT)
- message (TEXT)
- reference_id (UUID)
- is_read (BOOLEAN)
- created_at (TIMESTAMPTZ)

**RLS:** User own notifications only

---

### Migration 17: Customer Reports Table
**File:** `17-customer-reports.sql`
**Purpose:** Analytics & reporting data
**Dependencies:** locations, sales_transactions

**Schema:**
- id (UUID PK)
- location_id (UUID FK → locations)
- transaction_id (UUID FK → sales_transactions)
- customer_type (TEXT)
- age_group (TEXT)
- gender (TEXT)
- product_category (TEXT)
- purchase_amount (DECIMAL)
- created_at (TIMESTAMPTZ)

**RLS:** Admin only

---

## 🔧 FUNCTIONS & TRIGGERS

### Function 01: Update Inventory on Sale
**File:** `func-01-update-inventory-on-sale.sql`
**Trigger:** AFTER INSERT ON sales_transaction_items
**Action:** Decrease inventory quantity

### Function 02: Calculate Commission
**File:** `func-02-calculate-commission.sql`
**Trigger:** AFTER INSERT ON sales_transaction_items
**Action:** Create commission record

### Function 03: Update Wallet Balance
**File:** `func-03-update-wallet-balance.sql`
**Trigger:** AFTER INSERT ON wallet_transactions
**Action:** Update supplier balance

### Function 04: Send Notification
**File:** `func-04-send-notification.sql`
**Type:** Stored procedure
**Purpose:** Create notification for user

### Function 05: Approve Shipment
**File:** `func-05-approve-shipment.sql`
**Type:** RPC function
**Purpose:** Approve shipment & update inventory

### Function 06: Confirm Return
**File:** `func-06-confirm-return.sql`
**Type:** RPC function
**Purpose:** Confirm return & adjust inventory

---

## 📊 INDEXES FOR PERFORMANCE

```sql
-- Frequently queried columns
CREATE INDEX idx_products_supplier_id ON products(supplier_id);
CREATE INDEX idx_products_is_approved ON products(is_approved) WHERE is_approved = true;
CREATE INDEX idx_inventory_product_location ON inventory(product_id, location_id);
CREATE INDEX idx_sales_transactions_location ON sales_transactions(location_id);
CREATE INDEX idx_sales_transaction_items_product ON sales_transaction_items(product_id);
CREATE INDEX idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX idx_supplier_payments_status ON supplier_payments(status);
CREATE INDEX idx_commissions_supplier ON commissions(supplier_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_reviewed ON stock_movements(reviewed_at);
```

---

## 🔐 STORAGE BUCKETS

### Bucket 01: product-images
```sql
-- Public bucket with 5MB limit
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Policy: Anyone can view
CREATE POLICY "Public read product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

-- Policy: Suppliers can upload own
CREATE POLICY "Suppliers can upload product images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'product-images' AND
  auth.jwt() ->> 'role' = 'SUPPLIER'
);
```

### Bucket 02: proof-photos
```sql
-- Public bucket for payment/return proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('proof-photos', 'proof-photos', true);

-- Similar RLS policies
```

---

## ✅ VERIFICATION QUERIES

```sql
-- Check all tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';

-- Check foreign keys
SELECT conname, conrelid::regclass, confrelid::regclass 
FROM pg_constraint 
WHERE contype = 'f';

-- Check indexes
SELECT indexname, tablename FROM pg_indexes 
WHERE schemaname = 'public';
```

---

## 🚀 QUICK DEPLOY SCRIPT

```bash
# Run all migrations
for file in MASTER-BACKUP/02-MIGRATIONS/*.sql; do
  psql -h db.xxx.supabase.co -U postgres -d postgres -f "$file"
done
```

---

**© 2024 Katalara - Database Schema Documentation**
