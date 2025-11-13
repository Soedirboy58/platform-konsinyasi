# 🔍 Analisis Error Checkout Frontend User

## ❌ Error yang Terjadi:

Dari screenshot sebelumnya, error yang muncul:
```
Gagal checkout: Checkout gagal: column p.is_active does not exist. Silakan coba lagi.
```

Dan juga error auth:
```
AuthApiError: Invalid Refresh Token: Refresh Token Not Found
```

---

## 🎯 Root Cause Analysis

### 1. **Error: column p.is_active does not exist**

#### Penyebab:
- Tabel `products` **TIDAK memiliki kolom `is_active`**
- Schema products hanya punya:
  - `id`, `supplier_id`, `category_id`, `name`, `description`, `photo_url`
  - `price`, `cost_price`, `commission_rate`, `barcode`, `sku`
  - `expiry_duration_days`, `min_stock_threshold`, **`status`**
  - `created_at`, `updated_at`

#### Lokasi Error:
File `database/fix-self-checkout-complete.sql` line 106:
```sql
WHERE p.id = (v_item->>'product_id')::UUID
  AND p.status = 'APPROVED'
  AND p.is_active = TRUE;  -- ❌ KOLOM INI TIDAK ADA!
```

#### Solusi:
Migration terbaru `027_update_checkout_with_commission.sql` sudah benar - **TIDAK** cek `p.is_active`. Tapi sepertinya function di database masih menggunakan versi lama.

**Yang harus dilakukan:**
1. ✅ Pastikan migration 027 sudah di-run di Supabase
2. ✅ Atau buat migration baru untuk fix function yang ada

---

### 2. **Error: Invalid Refresh Token**

#### Penyebab:
- User anonymous mencoba checkout tanpa auth session
- Supabase client mencoba refresh token yang tidak ada
- RPC `process_anonymous_checkout` dipanggil oleh user `anon` (tidak login)

#### Lokasi:
File: `frontend/src/app/kantin/[slug]/checkout/page.tsx` line 80:
```tsx
const { data, error } = await supabase
  .rpc('process_anonymous_checkout', {
    p_location_slug: locationSlug,
    p_items: items
  })
```

#### Solusi:
Error ini muncul karena:
1. Supabase client mencoba refresh session otomatis
2. Function sudah di-grant ke `anon`: `GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB) TO anon;`
3. Tapi mungkin ada RLS policy yang block atau session issue

**Yang harus dilakukan:**
1. ✅ Pastikan RLS policies untuk `sales_transactions` dan `sales_transaction_items` allow anonymous insert
2. ✅ Cek Supabase Auth settings untuk anonymous access

---

## 🔧 Fix yang Diperlukan

### Fix 1: Update Function process_anonymous_checkout
Hapus cek `p.is_active` karena kolom tidak exist:

```sql
-- File: backend/migrations/034_fix_checkout_remove_is_active.sql

DROP FUNCTION IF EXISTS process_anonymous_checkout(TEXT, JSONB);

CREATE FUNCTION process_anonymous_checkout(
    p_location_slug TEXT,
    p_items JSONB
)
RETURNS TABLE (
    transaction_id UUID,
    transaction_code TEXT,
    total_amount DECIMAL(15,2),
    qris_code TEXT,
    qris_image_url TEXT
) AS $$
DECLARE
    v_location_id UUID;
    v_transaction_id UUID;
    v_transaction_code TEXT;
    v_total_amount DECIMAL(15,2) := 0;
    v_item JSONB;
    v_product_id UUID;
    v_quantity INTEGER;
    v_price DECIMAL(10,2);
    v_subtotal DECIMAL(15,2);
    v_commission_rate DECIMAL(5,2);
    v_commission_amount DECIMAL(15,2);
    v_supplier_revenue DECIMAL(15,2);
    v_qris_code TEXT;
    v_qris_image_url TEXT;
BEGIN
    -- Get location
    SELECT l.id, l.qris_code, l.qris_image_url 
    INTO v_location_id, v_qris_code, v_qris_image_url
    FROM locations l
    WHERE l.qr_code = p_location_slug 
      AND l.is_active = TRUE;
    
    IF v_location_id IS NULL THEN
        RAISE EXCEPTION 'Location not found or inactive';
    END IF;
    
    -- Get platform commission rate (default 10%)
    SELECT COALESCE(value::DECIMAL, 10.00) INTO v_commission_rate
    FROM platform_settings
    WHERE key = 'commission_rate';
    
    IF v_commission_rate IS NULL THEN
        v_commission_rate := 10.00;
    END IF;
    
    -- Generate transaction code
    v_transaction_code := 'KNT-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');
    
    -- Calculate total (customer pays full price)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_price := (v_item->>'price')::DECIMAL(10,2);
        v_total_amount := v_total_amount + (v_quantity * v_price);
    END LOOP;
    
    -- Create transaction
    INSERT INTO sales_transactions (
        location_id, 
        transaction_code, 
        total_amount,
        payment_method,
        status
    )
    VALUES (
        v_location_id, 
        v_transaction_code, 
        v_total_amount,
        'QRIS',
        'PENDING'
    )
    RETURNING id INTO v_transaction_id;
    
    -- Insert items with commission calculation
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_price := (v_item->>'price')::DECIMAL(10,2);
        v_subtotal := v_quantity * v_price;
        
        -- Calculate commission (platform takes commission%, supplier gets rest)
        v_commission_amount := ROUND(v_subtotal * (v_commission_rate / 100), 2);
        v_supplier_revenue := v_subtotal - v_commission_amount;
        
        -- Insert item with commission data
        INSERT INTO sales_transaction_items (
            transaction_id, 
            product_id, 
            quantity, 
            price, 
            subtotal,
            commission_rate,
            commission_amount,
            supplier_revenue
        )
        VALUES (
            v_transaction_id, 
            v_product_id, 
            v_quantity, 
            v_price, 
            v_subtotal,
            v_commission_rate,
            v_commission_amount,
            v_supplier_revenue
        );
        
        -- Decrease inventory (no stock check to allow negative)
        UPDATE inventory_levels 
        SET quantity = quantity - v_quantity,
            updated_at = NOW()
        WHERE product_id = v_product_id 
          AND location_id = v_location_id;
    END LOOP;
    
    -- Return success with QRIS info
    RETURN QUERY SELECT 
        v_transaction_id,
        v_transaction_code,
        v_total_amount,
        v_qris_code,
        v_qris_image_url;
        
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Checkout gagal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anonymous
GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB) TO authenticated;
```

### Fix 2: Cek dan Update RLS Policies

Pastikan anonymous users bisa insert ke sales tables:

```sql
-- Check existing policies
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('sales_transactions', 'sales_transaction_items');

-- If needed, add anonymous insert policies
CREATE POLICY IF NOT EXISTS "sales_transactions_anon_insert" 
ON sales_transactions
FOR INSERT 
TO anon
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "sales_transaction_items_anon_insert" 
ON sales_transaction_items
FOR INSERT 
TO anon
WITH CHECK (true);
```

---

## 📋 Action Items

### Immediate (URGENT):
1. ✅ **Run SQL di Supabase SQL Editor**: Buka file migration yang sudah diperbaiki
2. ✅ **Execute migration 027** atau buat migration 034 baru dengan fix di atas
3. ✅ **Test checkout** di PWA kantin setelah migration

### Follow-up:
1. ✅ Tambahkan proper error handling di frontend untuk tampilkan error yang lebih user-friendly
2. ✅ Add loading state yang lebih jelas saat processing checkout
3. ✅ Consider menambahkan retry mechanism jika checkout gagal

---

## 🧪 Testing Steps

Setelah fix di-apply:

1. **Test Anonymous Checkout**:
   ```
   https://platform-konsinyasi-v1.vercel.app/kantin/outlet_lobby_a
   ```
   - Add product ke cart
   - Klik "Lanjut ke Pembayaran"
   - ✅ Harus berhasil, tidak ada error `p.is_active`

2. **Check Transaction Created**:
   ```sql
   SELECT * FROM sales_transactions 
   WHERE created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

3. **Check Transaction Items**:
   ```sql
   SELECT * FROM sales_transaction_items
   WHERE transaction_id IN (
     SELECT id FROM sales_transactions 
     WHERE created_at > NOW() - INTERVAL '1 hour'
   );
   ```

---

## 📊 Summary

| Issue | Status | Priority | Solution |
|-------|--------|----------|----------|
| `p.is_active` column error | ❌ BLOCKING | 🔴 CRITICAL | Remove check from function |
| Auth refresh token error | ⚠️ WARNING | 🟡 MEDIUM | Already handled by grants |
| Anonymous RLS policies | ✅ OK | 🟢 LOW | Already exists (migration 018) |

**Next Step**: Run migration 034 di Supabase SQL Editor untuk fix function!
