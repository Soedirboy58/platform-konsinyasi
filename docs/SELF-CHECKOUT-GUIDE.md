# Self-Checkout Implementation Guide

## Overview

Fitur self-checkout untuk Kantin Kejujuran dengan anonymous checkout dan QRIS payment.

## Flow Diagram

```
Customer Scan QR Code (di outlet)
         ↓
/kantin/[slug] - Browse Products
         ↓
Add to Cart (sessionStorage)
         ↓
Click "Checkout"
         ↓
/kantin/[slug]/checkout - Cart Summary
         ↓
Process Checkout (RPC function)
         ↓
Display QRIS Code
         ↓
Customer Click "Sudah Bayar"
         ↓
Confirm Payment (RPC function)
         ↓
/kantin/[slug]/success - Receipt
         ↓
Back to Menu
```

---

## Database Migrations

### Migration 009: Add QRIS Columns

**File:** `backend/migrations/009_kantin_checkout_schema.sql`

**Purpose:** Add QRIS code fields to locations table

**Changes:**
```sql
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS qris_code TEXT,
ADD COLUMN IF NOT EXISTS qris_image_url TEXT;
```

**Execute:** Run in Supabase SQL Editor

---

### Migration 010: Anonymous Checkout RLS

**File:** `backend/migrations/010_anonymous_checkout_rls.sql`

**Purpose:** Allow anonymous users to checkout without login

**Policies Created:**
- `products_anonymous_read` - Read approved products
- `inventory_anonymous_read` - Check stock levels
- `locations_anonymous_read` - Read active outlets
- `sales_transactions_anonymous_insert` - Create transaction
- `sales_items_anonymous_insert` - Create transaction items

**Security:** Only read/insert allowed, no update/delete

---

### Migration 011: Checkout Function

**File:** `backend/migrations/011_kantin_checkout_function.sql`

**Function:** `process_anonymous_checkout(location_slug, items)`

**What it does:**
1. Validate location exists and active
2. Generate transaction code (KNT-YYYYMMDD-XXXXXX)
3. Validate stock for all items
4. Calculate total amount
5. Create transaction (status: PENDING)
6. Create transaction items
7. Decrease inventory
8. Return transaction info + QRIS data

**Parameters:**
```typescript
{
  p_location_slug: string,  // e.g. 'outlet-lobby-a'
  p_items: [
    {
      product_id: string,
      quantity: number,
      price: number
    }
  ]
}
```

**Returns:**
```typescript
{
  transaction_id: string,
  transaction_code: string,
  total_amount: number,
  qris_code: string | null,
  qris_image_url: string | null,
  success: boolean,
  message: string
}
```

---

### Migration 012: Confirm Payment Function

**File:** `backend/migrations/012_confirm_payment_function.sql`

**Function:** `confirm_payment(transaction_id)`

**What it does:**
1. Validate transaction exists
2. Check status is PENDING
3. Update status to COMPLETED
4. Return success message

**Parameters:**
```typescript
{
  p_transaction_id: string
}
```

**Returns:**
```typescript
{
  success: boolean,
  message: string
}
```

---

## Frontend Components

### 1. Kantin Main Page (Updated)

**File:** `frontend/src/app/kantin/[slug]/page.tsx`

**Changes:**
- Added sessionStorage for cart persistence
- Changed checkout to navigate to checkout page
- Added `loadCartFromStorage()` function
- Added `saveCartToStorage()` function
- Changed `checkout()` to `goToCheckout()`

**Key Functions:**
```typescript
// Load cart from sessionStorage on mount
loadCartFromStorage()

// Save cart on every add/remove
saveCartToStorage(cartData)

// Navigate to checkout page
goToCheckout() {
  sessionStorage.setItem(`cart_${locationSlug}`, JSON.stringify(cart))
  router.push(`/kantin/${locationSlug}/checkout`)
}
```

---

### 2. Checkout Page (New)

**File:** `frontend/src/app/kantin/[slug]/checkout/page.tsx`

**Features:**
- Load cart from sessionStorage
- Show cart summary
- Process checkout button
- Display QRIS code after checkout
- "Sudah Bayar" confirmation button

**States:**
```typescript
cart: CartItem[]           // Loaded from sessionStorage
loading: boolean           // Initial load
processing: boolean        // During checkout
checkoutResult: Result     // After successful checkout
confirming: boolean        // During payment confirmation
```

**Flow:**
1. Load cart from sessionStorage
2. Show cart summary + total
3. User clicks "Lanjut ke Pembayaran"
4. Call `process_anonymous_checkout()`
5. Show QRIS code + transaction code
6. User scans QRIS and pays
7. User clicks "Sudah Bayar"
8. Call `confirm_payment()`
9. Clear cart from sessionStorage
10. Redirect to success page

---

### 3. Success Page (New)

**File:** `frontend/src/app/kantin/[slug]/success/page.tsx`

**Features:**
- Get transaction code from URL query
- Load transaction details from database
- Show receipt with items
- Print button
- Back to menu button

**Query Parameter:**
```
/kantin/outlet-lobby-a/success?code=KNT-20250110-000123
```

**Data Fetched:**
```typescript
// From sales_transactions
transaction_code, total_amount, created_at

// From sales_transaction_items + products
product_name, quantity, unit_price, subtotal
```

---

## Setup Instructions

### 1. Execute Database Migrations

```bash
# In Supabase SQL Editor, run in order:
1. backend/migrations/009_kantin_checkout_schema.sql
2. backend/migrations/010_anonymous_checkout_rls.sql
3. backend/migrations/011_kantin_checkout_function.sql
4. backend/migrations/012_confirm_payment_function.sql
```

### 2. Add QRIS to Locations

```sql
-- Update your location with QRIS data
UPDATE locations
SET 
  qris_code = 'YOUR_QRIS_CODE_STRING',
  qris_image_url = 'https://your-bucket/qris-lobby-a.png'
WHERE qr_code = 'outlet-lobby-a';
```

**Option A:** Static QRIS string (for manual display)
**Option B:** QRIS image URL (recommended, easier to scan)

### 3. Upload QRIS Image (Optional)

If using image:

1. Go to Supabase Storage
2. Create bucket `qris-codes` (public)
3. Upload QRIS PNG/JPG files
4. Copy public URL
5. Update location with URL

### 4. Deploy Frontend

```bash
cd frontend
npm run build
vercel --prod
```

---

## Testing Flow

### Test 1: Browse Products

1. Open: `https://yourapp.vercel.app/kantin/outlet-lobby-a`
2. Should see: Products from that outlet
3. Check: Stock quantities showing
4. Verify: No login required

### Test 2: Add to Cart

1. Click "Tambah" on a product
2. Should see: Cart footer appears
3. Check: Item count badge on cart icon
4. Verify: Cart persists on page reload (sessionStorage)

### Test 3: Cart Management

1. Click + button → quantity increases
2. Click - button → quantity decreases
3. Remove last item → cart footer disappears
4. Refresh page → cart still there

### Test 4: Checkout Flow

1. Click "Checkout (X item)"
2. Navigate to: `/kantin/outlet-lobby-a/checkout`
3. Should see: Cart summary
4. Click: "Lanjut ke Pembayaran"
5. Should see: 
   - Transaction code (KNT-YYYYMMDD-XXXXXX)
   - QRIS code/image
   - "Sudah Bayar" button

### Test 5: Payment Confirmation

1. Click: "Sudah Bayar"
2. Navigate to: `/kantin/outlet-lobby-a/success?code=...`
3. Should see:
   - Success message
   - Receipt with items
   - Transaction code
   - Total amount
4. Check database:
   - Transaction status = COMPLETED
   - Inventory decreased

### Test 6: Inventory Update

```sql
-- Before checkout
SELECT product_id, quantity 
FROM inventory_levels 
WHERE location_id = 'YOUR_LOCATION_ID';

-- After checkout (should be less)
SELECT product_id, quantity 
FROM inventory_levels 
WHERE location_id = 'YOUR_LOCATION_ID';
```

---

## Troubleshooting

### Issue: "Keranjang kosong" error

**Cause:** SessionStorage cleared or different browser

**Solution:** Add items to cart again

### Issue: "Stok tidak cukup" error

**Cause:** Inventory level is 0 or less than cart quantity

**Solution:** 
1. Check inventory: `SELECT * FROM inventory_levels WHERE product_id = '...'`
2. Add stock via admin dashboard or direct SQL

### Issue: QRIS not showing

**Cause:** Location doesn't have QRIS data

**Solution:**
```sql
UPDATE locations
SET qris_image_url = 'YOUR_QRIS_URL'
WHERE qr_code = 'outlet-lobby-a';
```

### Issue: RLS policy error on checkout

**Cause:** Anonymous policies not applied

**Solution:** Re-run migration 010

```sql
-- Verify policies exist
SELECT * FROM pg_policies 
WHERE policyname LIKE '%anonymous%';
```

### Issue: Function not found

**Cause:** Function not created or wrong schema

**Solution:**
```sql
-- Check if function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('process_anonymous_checkout', 'confirm_payment');

-- Re-run migrations 011 and 012
```

---

## Security Considerations

### ✅ What's Protected:

1. **Anonymous Read Only** - Can only read approved products
2. **No Profile Access** - Can't see user/supplier data
3. **Insert Only** - Can create transactions but not modify
4. **Stock Validation** - Function checks stock before allowing purchase
5. **No Delete** - Anonymous users can't delete anything

### ⚠️ Potential Risks:

1. **Spam Transactions** - Anonymous users can create many pending transactions
   - **Mitigation:** Add rate limiting at API level
   - **Mitigation:** Cleanup pending transactions older than 1 hour

2. **Stock Race Condition** - Two customers might buy last item simultaneously
   - **Mitigation:** Use PostgreSQL transactions (already implemented)
   - **Mitigation:** Check stock in function before committing

3. **Fake "Sudah Bayar"** - User can confirm without actually paying
   - **Mitigation:** This is the "Kejujuran" (honesty) system design
   - **Mitigation:** Admin can verify transactions manually
   - **Future:** Integrate with payment gateway for auto-verify

---

## Admin Monitoring

### View All Transactions

```sql
SELECT 
  t.transaction_code,
  l.name as location_name,
  t.total_amount,
  t.status,
  t.created_at
FROM sales_transactions t
JOIN locations l ON l.id = t.location_id
ORDER BY t.created_at DESC;
```

### View Transaction Details

```sql
SELECT 
  p.name as product_name,
  sti.quantity,
  sti.unit_price,
  sti.subtotal,
  s.business_name as supplier
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
JOIN suppliers s ON s.id = p.supplier_id
WHERE sti.transaction_id = 'TRANSACTION_ID';
```

### Cleanup Old Pending Transactions

```sql
-- Delete pending transactions older than 24 hours
DELETE FROM sales_transactions
WHERE status = 'PENDING'
  AND created_at < NOW() - INTERVAL '24 hours';
```

---

## Future Enhancements

### Phase 2: Payment Integration

- Integrate with payment gateway (Midtrans, Xendit)
- Auto-generate dynamic QRIS per transaction
- Auto-verify payment status
- Webhook for payment confirmation

### Phase 3: Analytics

- Dashboard for outlet performance
- Best selling products
- Revenue per location
- Hourly sales patterns

### Phase 4: Customer Experience

- Product search
- Category filter
- Product photos from suppliers
- Nutrition info
- Allergen warnings

---

## File Structure

```
backend/migrations/
├── 009_kantin_checkout_schema.sql      (40 lines)
├── 010_anonymous_checkout_rls.sql      (90 lines)
├── 011_kantin_checkout_function.sql    (180 lines)
└── 012_confirm_payment_function.sql    (50 lines)

frontend/src/app/kantin/[slug]/
├── page.tsx                  (Updated - 280 lines)
├── checkout/
│   └── page.tsx             (New - 250 lines)
└── success/
    └── page.tsx             (New - 180 lines)
```

**Total:** 
- 4 SQL migrations (~360 lines)
- 3 frontend pages (~710 lines)
- **Grand Total:** ~1070 lines

---

## Summary

✅ **Complete Features:**
- Anonymous checkout (no login required)
- Cart persistence (sessionStorage)
- Stock validation
- QRIS payment display
- Transaction tracking
- Receipt generation
- Inventory auto-update

🎯 **Business Benefits:**
- Fast checkout experience
- No registration friction
- Supports honesty system concept
- Full transaction tracking
- Automated inventory management
- Scalable to multiple outlets

📊 **Technical Quality:**
- Clean separation (DB migrations + Frontend)
- Minimal code duplication
- Proper error handling
- RLS security enabled
- Transaction safety (PostgreSQL)
- Mobile-responsive UI

---

**Implementation Status:** ✅ COMPLETE

**Ready for Testing:** YES

**Estimated Testing Time:** 30 minutes

**Production Ready:** After successful testing
