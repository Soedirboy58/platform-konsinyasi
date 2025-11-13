# 🚨 URGENT FIX: Checkout Error - Action Required!

## ❌ Masalah Saat Ini

User **TIDAK BISA checkout** di PWA Kantin dengan error:
```
Gagal checkout: Checkout gagal: column p.is_active does not exist
```

## 🎯 Root Cause

Function `process_anonymous_checkout` mencoba cek kolom `p.is_active`, tapi **tabel products TIDAK punya kolom ini**. Products hanya punya kolom `status`.

---

## ✅ FIX SEKARANG! (5 Menit)

### Step 1: Buka Supabase SQL Editor

1. Buka browser, ke: https://supabase.com/dashboard/project/rpzoacwlswlhfqaiicho/sql/new
2. Atau:
   - Dashboard Supabase
   - Pilih project `konsinyasi`
   - Klik **SQL Editor** di sidebar kiri
   - Klik **New Query**

### Step 2: Copy & Paste SQL Fix

Copy **SELURUH ISI** file ini:
```
backend/migrations/034_fix_checkout_remove_is_active.sql
```

Atau copy dari sini (scroll ke bawah untuk full SQL)

### Step 3: Execute (RUN)

1. Paste SQL ke editor
2. Klik tombol **RUN** (atau tekan Ctrl+Enter)
3. Tunggu sampai selesai (~2 detik)
4. ✅ Harus muncul: `Migration 034: Fix checkout remove is_active check - COMPLETED!`

### Step 4: Verify

Jalankan query ini untuk cek function sudah ter-update:

```sql
SELECT 
    routine_name,
    routine_type,
    specific_name,
    created
FROM information_schema.routines
WHERE routine_name = 'process_anonymous_checkout';
```

Harus return 1 row dengan `routine_name = process_anonymous_checkout`

---

## 🧪 Test Checkout Sekarang

Setelah migration di-run:

1. **Buka PWA Kantin**:
   ```
   https://platform-konsinyasi-v1-u64csrke7-katalaras-projects.vercel.app/kantin/outlet_lobby_a
   ```

2. **Test Checkout**:
   - Add produk ke cart (contoh: Aneka Roti Manis)
   - Klik "Lanjut ke Pembayaran"
   - ✅ **HARUS BERHASIL** - tidak ada error lagi!
   - Halaman pembayaran QRIS muncul

3. **Verify Transaction Created**:
   ```sql
   SELECT * FROM sales_transactions 
   WHERE created_at > NOW() - INTERVAL '5 minutes'
   ORDER BY created_at DESC;
   ```

---

## 📋 Full SQL Migration (Copy This)

```sql
-- ========================================
-- Migration 034: Fix Checkout - Remove is_active Check
-- ========================================
-- Description: Remove p.is_active check from process_anonymous_checkout
--              because products table doesn't have is_active column
-- Execute: Run this in Supabase SQL Editor immediately
-- Priority: CRITICAL - Blocking checkout functionality
-- ========================================

-- Drop existing function
DROP FUNCTION IF EXISTS process_anonymous_checkout(TEXT, JSONB);

-- Recreate function without is_active check
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
    
    -- Fallback if platform_settings doesn't exist
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
        
        -- Decrease inventory (allow negative for now)
        UPDATE inventory_levels 
        SET quantity = quantity - v_quantity,
            updated_at = NOW()
        WHERE product_id = v_product_id 
          AND location_id = v_location_id;
          
        -- No error if inventory doesn't exist - will be handled by admin
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
        -- User-friendly error message
        RAISE EXCEPTION 'Checkout gagal: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION process_anonymous_checkout(TEXT, JSONB) TO authenticated;

-- ========================================
-- VERIFICATION
-- ========================================

-- Check function exists and signature
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_name = 'process_anonymous_checkout';

-- ========================================
-- SUCCESS
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 034: Fix Checkout - SUCCESS!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Fixed: Removed p.is_active check';
    RAISE NOTICE 'Products table only has status column';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next: Test checkout at /kantin/outlet_lobby_a';
END $$;

SELECT 'Migration 034: Fix checkout remove is_active check - COMPLETED!' AS status;
```

---

## ⏱️ Estimasi Waktu

- **Copy SQL**: 30 detik
- **Run Migration**: 2 detik
- **Test Checkout**: 1 menit
- **TOTAL**: ~2 menit

---

## 📞 Troubleshooting

### Error: "function does not exist"
**Solusi**: Migration belum di-run. Ulangi Step 1-3.

### Error: "permission denied"
**Solusi**: Login sebagai postgres user di Supabase dashboard.

### Checkout masih error setelah migration
**Solusi**: 
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Coba incognito mode
4. Check console browser untuk error message baru

---

## ✅ Success Checklist

- [ ] SQL migration berhasil di-run di Supabase
- [ ] Function `process_anonymous_checkout` sudah ter-update
- [ ] Test checkout di PWA kantin berhasil
- [ ] Transaksi muncul di database
- [ ] Halaman pembayaran QRIS tampil

---

**🚀 SEGERA RUN MIGRATION INI! Checkout currently BROKEN!**
