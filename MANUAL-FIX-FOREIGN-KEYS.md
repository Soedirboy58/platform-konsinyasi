# MANUAL FIX: Foreign Keys via Supabase Dashboard

## Problem:
Frontend admin tidak bisa load shipments karena foreign key relationship tidak dikenali oleh Supabase client library.

## Solution: Create Foreign Keys via Supabase Dashboard GUI

### STEP 1: stock_movements → suppliers

1. Buka Supabase Dashboard
2. **Table Editor** → Table `stock_movements`
3. Klik kolom **`supplier_id`**
4. Di panel kanan, cari **"Foreign Key Relation"**
5. Set:
   - **Referenced table**: `suppliers`
   - **Referenced column**: `id`
   - **On delete**: `CASCADE`
6. Save

### STEP 2: stock_movements → locations

1. Masih di table `stock_movements`
2. Klik kolom **`location_id`**
3. Set Foreign Key:
   - **Referenced table**: `locations`
   - **Referenced column**: `id`
   - **On delete**: `CASCADE`
4. Save

### STEP 3: stock_movement_items → stock_movements

1. **Table Editor** → Table `stock_movement_items`
2. Klik kolom **`movement_id`**
3. Set Foreign Key:
   - **Referenced table**: `stock_movements`
   - **Referenced column**: `id`
   - **On delete**: `CASCADE`
4. Save

### STEP 4: stock_movement_items → products

1. Masih di table `stock_movement_items`
2. Klik kolom **`product_id`**
3. Set Foreign Key:
   - **Referenced table**: `products`
   - **Referenced column**: `id`
   - **On delete**: `CASCADE`
4. Save

### STEP 5: CRITICAL - Refresh Schema

**Option A: Via Dashboard**
1. **Settings** → **API**
2. Scroll ke section **"Schema"**
3. Klik **"Reload schema"** atau **"Refresh"**

**Option B: Via SQL**
```sql
NOTIFY pgrst, 'reload schema';
```

### STEP 6: Verify

Run di SQL Editor:
```sql
SELECT
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('stock_movements', 'stock_movement_items')
AND tc.constraint_type = 'FOREIGN KEY';
```

Expected: 4 rows showing all foreign keys

### STEP 7: Test Frontend

1. Hard refresh admin page: Ctrl+Shift+R
2. Data should appear!

---

## Alternative: Drop & Recreate Tables (NUCLEAR OPTION)

If foreign keys still not working, the problem might be table was created without proper relationships from the start.

**DON'T USE THIS unless absolutely necessary - will delete all data!**

---

## Expected Console Error (for debugging):

Check browser console (F12) for exact error:
- "Could not find a relationship..." → Foreign key issue
- "permission denied" → RLS issue
- Other errors → Different problem

Share console screenshot for precise diagnosis.
