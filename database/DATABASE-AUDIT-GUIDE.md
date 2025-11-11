# 🔍 DATABASE AUDIT & CLEANUP GUIDE

## 📋 Overview
Complete database scanning and cleanup untuk menghapus duplicate dan redundant objects di Supabase.

---

## 🚀 STEP-BY-STEP EXECUTION

### **STEP 1: Run Audit (Review Only)** ⚠️ SAFE
File: `audit-database-full.sql`

**What it does:**
- ✅ Scan ALL RLS policies (menampilkan duplicate)
- ✅ Scan ALL indexes (menampilkan redundant)
- ✅ Scan ALL functions (menampilkan multiple signatures)
- ✅ Scan ALL triggers (menampilkan duplicate)
- ✅ Scan ALL constraints
- ✅ Summary report

**How to run:**
1. Buka Supabase SQL Editor
2. Copy paste `audit-database-full.sql`
3. Klik **Run**
4. **REVIEW hasilnya** - Lihat mana yang duplicate

**Expected output:**
```
SECTION 1: RLS Policies
- suppliers: 11 policies (too many!)
- profiles: 6 policies (too many!)
- products: 8 policies (too many!)

SECTION 2: Indexes
- Multiple idx_* with similar purposes

SECTION 3: Functions
- create_notification: 4 signatures (duplicate!)
- approve_stock_movement: 2 signatures

SECTION 4: Triggers
- List of all triggers

SECTION 5: Constraints
- List of all constraints

SECTION 6: Summary
- Total RLS Policies: 50+
- Total Indexes: 30+
- Total Functions: 20+
- Total Triggers: 10+
```

---

### **STEP 2: Run Cleanup** ⚠️ DESTRUCTIVE
File: `cleanup-database-full.sql`

**What it does:**
- 🗑️ DROP all duplicate/redundant policies
- 🗑️ DROP duplicate functions
- 🗑️ DROP duplicate triggers
- 🗑️ DROP duplicate indexes
- 🗑️ DROP duplicate constraints
- ✅ CREATE clean, minimal policies (3-4 per table)

**How to run:**
1. **BACKUP DATABASE FIRST!** (Supabase → Database → Backups)
2. Buka Supabase SQL Editor
3. Copy paste `cleanup-database-full.sql`
4. Klik **Run**
5. Wait for completion (might take 1-2 minutes)

**Expected output:**
```
✅ Dropped 30+ redundant policies
✅ Dropped 5+ duplicate functions
✅ Dropped 3+ duplicate triggers
✅ Dropped 5+ duplicate indexes
✅ Created 20 clean policies (4 per main table)

VERIFY:
- suppliers: 4 policies ✅
- profiles: 4 policies ✅
- products: 4 policies ✅
- notifications: 3 policies ✅
- stock_movements: 4 policies ✅

CLEANUP COMPLETE!
```

---

## 📊 BEFORE vs AFTER

### **BEFORE Cleanup:**
```
RLS Policies: 50+
├─ suppliers: 11 policies (redundant!)
├─ profiles: 6 policies (redundant!)
├─ products: 8 policies (redundant!)
└─ Others: 25+ policies

Functions: 20+
├─ create_notification: 4 signatures ❌
├─ approve_stock_movement: 2 signatures ❌
└─ Others: 14+

Triggers: 10+
├─ notify_admin_shipment ❌
├─ trg_notify_shipment ✅ (keep)
└─ Others: 8+
```

### **AFTER Cleanup:**
```
RLS Policies: ~20 (clean!)
├─ suppliers: 4 policies ✅
├─ profiles: 4 policies ✅
├─ products: 4 policies ✅
└─ Others: ~8 policies

Functions: ~10 (clean!)
├─ create_notification: 1 signature ✅
├─ approve_stock_movement: 1 signature ✅
└─ Others: ~8

Triggers: ~5 (clean!)
├─ trg_notify_shipment ✅
├─ trg_notify_shipment_decision ✅
└─ Others: ~3
```

---

## 🎯 WHAT WILL BE CLEANED

### **RLS Policies (Duplicate removal):**
❌ `suppliers_admin_all` → Already covered by `suppliers_select`
❌ `suppliers_insert_own` → Duplicate of `suppliers_insert`
❌ `suppliers_read_own` → Duplicate of `suppliers_select`
❌ `suppliers_update_own` → Duplicate of `suppliers_update`
❌ `profiles_user_insert` → Duplicate of `profiles_insert`
❌ `profiles_user_update` → Duplicate of `profiles_update`
❌ `products_supplier_read_own` → Duplicate of `products_select`
... (30+ more duplicates)

### **Functions (Multiple signatures):**
❌ `create_notification(UUID, VARCHAR, VARCHAR, TEXT, UUID, VARCHAR)` → Old
❌ `create_notification(UUID, TEXT, TEXT, TEXT, UUID)` → Old
❌ `create_notification(UUID, TEXT, TEXT, TEXT)` → Old
✅ Keep: `create_notification(UUID, VARCHAR, VARCHAR, TEXT, UUID)` → Latest

### **Triggers (Duplicate):**
❌ `notify_admin_shipment` → Old
❌ `notify_supplier_shipment` → Old
✅ Keep: `trg_notify_shipment` → Latest
✅ Keep: `trg_notify_shipment_decision` → Latest

### **Indexes (Similar purpose):**
❌ `idx_suppliers_profile` → Less descriptive
❌ `suppliers_profile_idx` → Less descriptive
✅ Keep: `idx_suppliers_profile_id` → Most clear

---

## ⚠️ SAFETY CHECKLIST

Before running cleanup:
- [ ] Run `audit-database-full.sql` first
- [ ] Review audit results
- [ ] **Create manual backup** (Supabase Dashboard → Database → Backups)
- [ ] Test in staging environment (if available)
- [ ] Have rollback plan ready

---

## 🔄 ROLLBACK (If something breaks)

1. **Restore from backup:**
   - Supabase Dashboard → Database → Backups
   - Choose backup before cleanup
   - Click "Restore"

2. **Or re-run original setup:**
   ```sql
   -- Run original schema.sql
   -- Run setup-wallet-and-shipments-SAFE.sql
   -- Run notification-system-SAFE.sql
   ```

---

## 📝 MAINTENANCE SCHEDULE

Recommended frequency:
- **Weekly**: Quick audit (just Section 1 & 6 of audit SQL)
- **Monthly**: Full audit + cleanup
- **After major changes**: Always audit before deploying

---

## ✅ POST-CLEANUP TESTING

After cleanup, test:
1. ✅ Supplier login
2. ✅ Supplier settings update
3. ✅ Product create/update
4. ✅ Shipment submission
5. ✅ Admin approve/reject shipment
6. ✅ Notifications working
7. ✅ Wallet transactions
8. ✅ Sales reporting

---

## 🆘 TROUBLESHOOTING

**Problem:** "Policy doesn't exist" error after cleanup
- **Solution:** Check if table still has at least SELECT policy

**Problem:** "Function doesn't exist" error
- **Solution:** Re-run `notification-system-SAFE.sql`

**Problem:** Supplier can't update settings
- **Solution:** Re-run `cleanup-database-full.sql` STEP 6 only

---

## 📞 SUPPORT

Files created:
1. `audit-database-full.sql` - Scanning tool ✅
2. `cleanup-database-full.sql` - Cleanup tool ✅
3. `DATABASE-AUDIT-GUIDE.md` - This guide ✅

Location: `c:\Users\user\Downloads\Platform\konsinyasi\database\`
