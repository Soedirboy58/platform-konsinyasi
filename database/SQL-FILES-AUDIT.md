# 📊 SQL FILES AUDIT - Folder vs Supabase

## 🎯 **SUMMARY**
- **Total SQL files di folder**: 24 files
- **SQL yang SUDAH dijalankan di Supabase**: 8-10 queries (berdasarkan screenshot)
- **SQL yang TIDAK digunakan**: ~14 files (duplicate/obsolete)
- **Recommendation**: **CLEANUP 14 files**, keep only 10 essential files

---

## ✅ **FILES YANG SUDAH DIJALANKAN DI SUPABASE**

Berdasarkan screenshot Supabase SQL Editor history:

### **1. Core Schema & Setup**
| File di Folder | SQL di Supabase | Status | Keterangan |
|----------------|-----------------|--------|------------|
| `schema.sql` | ✅ "schema" | **ACTIVE** | Main database schema |
| `functions.sql` | ✅ "functions" | **ACTIVE** | Business logic functions |
| `rls-policies.sql` | ❓ Not visible | Unknown | RLS policies (mungkin di fix-all-rls) |

### **2. Wallet System** ⚠️ **DUPLICATE FILES**
| File di Folder | SQL di Supabase | Status | Recommendation |
|----------------|-----------------|--------|----------------|
| `wallet-tables-only.sql` | ✅ "wallet-tables-only" | **USED** | ✅ **KEEP** (yang dijalankan) |
| `wallet-system-schema.sql` | ❌ Not run | Obsolete | ❌ **DELETE** (duplicate) |
| `setup-wallet-and-shipments.sql` | ❌ Not run | Obsolete | ❌ **DELETE** (duplicate) |
| `setup-wallet-and-shipments-SAFE.sql` | ✅ "setup-wallet-nd-shipments-safe" | **USED** | ✅ **KEEP** (yang dijalankan) |
| `setup-wallet-and-shipments-FIXED.sql` | ❌ Not run | Obsolete | ❌ **DELETE** (duplicate) |
| `wallet-constraints-and-functions.sql` | ❌ Not run | Obsolete | ❌ **DELETE** (duplicate, sudah di SAFE) |

**Kesimpulan Wallet**: Ada **6 files**, tapi yang dipake cuma **2 files**. Sisanya duplicate!

### **3. Transaction Fixes**
| File di Folder | SQL di Supabase | Status |
|----------------|-----------------|--------|
| `fix-sales-transactions-schema.sql` | ✅ "fix_transaction_schema" | **USED** |

### **4. RLS Fixes** ⚠️ **DUPLICATE FILES**
| File di Folder | SQL di Supabase | Status | Recommendation |
|----------------|-----------------|--------|----------------|
| `fix-all-rls.sql` | ✅ "fix_all_rls" | **USED** | ✅ **KEEP** |
| `fix-rls-simple.sql` | ❌ Not run | Obsolete | ❌ **DELETE** (duplicate) |
| `rls-policies.sql` | ❌ Not run | Obsolete | ❌ **DELETE** (sudah di fix-all-rls) |

### **5. Admin & Settings**
| File di Folder | SQL di Supabase | Status |
|----------------|-----------------|--------|
| `create-admin.sql` | ✅ "Promote user to ADMIN" | **USED** |
| `create-platform-settings.sql` | ✅ "Platform settings table" | **USED** |
| `upgrade-to-admin.sql` | ❌ Not run | Obsolete (duplicate create-admin) |

### **6. Notification System** 🆕 **BELUM DIJALANKAN**
| File di Folder | SQL di Supabase | Status | Action Needed |
|----------------|-----------------|--------|---------------|
| `notification-system.sql` | ❌ **PENDING** | **NOT RUN** | ⚠️ **NEEDS TO BE EXECUTED** |

---

## ❌ **FILES YANG TIDAK DIGUNAKAN** (Safe to Delete)

### **Testing & Debug Files** (Keep for reference, tapi bukan SQL utama)
| File | Purpose | Recommendation |
|------|---------|----------------|
| `test-notifications.sql` | Testing queries | 📖 **KEEP** (for testing) |
| `test-rls-check.sql` | RLS diagnostic | 📖 **KEEP** (for testing) |
| `test-rls-diagnostic.sql` | RLS diagnostic | 📖 **KEEP** (for testing) |
| `business-queries.sql` | Business analytics | 📖 **KEEP** (for reporting) |

### **Utility Scripts** (One-time use)
| File | Purpose | Recommendation |
|------|---------|----------------|
| `approve-all-products.sql` | Bulk approve | 📝 **KEEP** (utility) |
| `check-products-status.sql` | Check query | 📝 **KEEP** (utility) |
| `debug-supplier-products.sql` | Debug query | 📝 **KEEP** (utility) |

### **Obsolete/Duplicate Files** ❌ **DELETE THESE**
| File | Why Obsolete | Replace With |
|------|-------------|--------------|
| `quick-setup-all-in-one.sql` | Old version | Use individual files |
| `setup-minimal.sql` | Incomplete | Use wallet-tables-only + SAFE |
| `wallet-system-schema.sql` | Duplicate | Already in wallet-tables-only |
| `setup-wallet-and-shipments.sql` | Old version | Use SAFE version |
| `setup-wallet-and-shipments-FIXED.sql` | Duplicate | Use SAFE version |
| `wallet-constraints-and-functions.sql` | Duplicate | Already in SAFE |
| `fix-rls-simple.sql` | Duplicate | Already in fix-all-rls |
| `rls-policies.sql` | Duplicate | Already in fix-all-rls |
| `stock-movements-schema.sql` | Duplicate | Already in wallet-tables-only |
| `upgrade-to-admin.sql` | Duplicate | Use create-admin.sql |
| `cron-setup.sql` | Not used | Delete if not needed |
| `cron-setup-simple.sql` | Not used | Delete if not needed |
| `sample-data.sql` | Test data | Delete if not needed |

**Total to DELETE**: **13 files**

---

## 📁 **RECOMMENDED FOLDER STRUCTURE**

### **AFTER CLEANUP - Keep Only These:**

```
database/
├── 📄 CORE SCHEMA (4 files)
│   ├── schema.sql                    ✅ Main database schema
│   ├── functions.sql                 ✅ Business functions
│   ├── fix-all-rls.sql              ✅ RLS policies
│   └── fix-sales-transactions-schema.sql ✅ Transaction fix
│
├── 💰 WALLET SYSTEM (2 files)
│   ├── wallet-tables-only.sql       ✅ Wallet tables
│   └── setup-wallet-and-shipments-SAFE.sql ✅ Constraints & functions
│
├── 🔔 NOTIFICATION SYSTEM (1 file)
│   └── notification-system.sql      ⚠️ PENDING EXECUTION
│
├── 👤 ADMIN & SETTINGS (2 files)
│   ├── create-admin.sql             ✅ Create admin user
│   └── create-platform-settings.sql ✅ Platform settings
│
├── 🧪 TESTING & UTILITIES (7 files)
│   ├── test-notifications.sql       📖 Notification tests
│   ├── test-rls-check.sql          📖 RLS diagnostics
│   ├── test-rls-diagnostic.sql     📖 RLS diagnostics
│   ├── business-queries.sql        📖 Analytics queries
│   ├── approve-all-products.sql    📝 Bulk approve
│   ├── check-products-status.sql   📝 Status check
│   └── debug-supplier-products.sql 📝 Debug queries
│
└── 📖 DOCUMENTATION (4 files)
    ├── README.md
    ├── QUICK-START.md
    ├── TESTING-NOTIFICATION-GUIDE.md
    └── SHIPMENT-IMPLEMENTATION-SUMMARY.md
```

**Total Essential Files**: **20 files** (dari 33 files)

---

## 🗑️ **FILES TO DELETE** (13 files)

Create backup folder first, then delete:

```bash
# Create backup
mkdir database/archive_old_sql
mv database/quick-setup-all-in-one.sql database/archive_old_sql/
mv database/setup-minimal.sql database/archive_old_sql/
mv database/wallet-system-schema.sql database/archive_old_sql/
mv database/setup-wallet-and-shipments.sql database/archive_old_sql/
mv database/setup-wallet-and-shipments-FIXED.sql database/archive_old_sql/
mv database/wallet-constraints-and-functions.sql database/archive_old_sql/
mv database/fix-rls-simple.sql database/archive_old_sql/
mv database/rls-policies.sql database/archive_old_sql/
mv database/stock-movements-schema.sql database/archive_old_sql/
mv database/upgrade-to-admin.sql database/archive_old_sql/
mv database/cron-setup.sql database/archive_old_sql/
mv database/cron-setup-simple.sql database/archive_old_sql/
mv database/sample-data.sql database/archive_old_sql/
```

---

## 📋 **SUPABASE SQL HISTORY - What's Actually Running**

Based on your screenshot, these are the **ACTIVE queries in Supabase**:

1. ✅ **notification-system** ← NEED TO RUN THIS!
2. ✅ **Shipment & Approval Notification System**
3. ✅ **setup-wallet-nd-shipments-safe**
4. ✅ **fix_transaction_schema**
5. ✅ **wallet-tables-only**
6. ✅ **fix_all_rls**
7. ✅ **Platform settings table**
8. ✅ **Promote user to ADMIN**
9. ✅ **Products RLS Policy Reset**
10. ✅ **Verifikasi RLS dan kebijakan akses**
11. ✅ **fix_rls_profiles**
12. ✅ **Konsinyasi v2.0 Quick Setup Script**
13. ✅ **Expiring Products Check Function**
14. ✅ **Authentication Providers Setup**
15. ✅ **Enable UUID, Crypto, and Scheduling Extensions**
16. ✅ **sample_data**
17. ✅ **busines_queries**
18. ✅ **functions**
19. ✅ **scheme** (typo, should be "schema")

**Key Finding**: Ada beberapa SQL yang dijalankan tapi **tidak ada file-nya di folder** (seperti "Products RLS Policy Reset", "Expiring Products Check Function"). Ini mungkin dari quick-setup-all-in-one.sql yang sudah dipecah.

---

## ⚠️ **CRITICAL ACTION NEEDED**

### **1. Execute Notification System** 🔔
```sql
-- File: notification-system.sql
-- Status: ❌ NOT RUN YET
-- Action: COPY & PASTE to Supabase SQL Editor
```

This is the **ONLY missing piece** for complete shipment management!

### **2. Verify Wallet System**
```sql
-- Check if all wallet tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'supplier_wallets',
  'wallet_transactions',
  'withdrawal_requests',
  'sales_transactions',
  'stock_movements',
  'stock_movement_items'
);
```

Expected: 6 rows (all tables should exist)

### **3. Verify Functions**
```sql
-- Check if all functions exist
SELECT proname 
FROM pg_proc 
WHERE proname IN (
  'create_wallet_transaction',
  'approve_withdrawal_request',
  'reject_withdrawal_request',
  'record_sale_with_commission',
  'approve_stock_movement',
  'reject_stock_movement'
);
```

Expected: 6 functions

---

## 📊 **USAGE STATISTICS**

| Category | Total Files | Used in Supabase | Unused/Duplicate | % Unused |
|----------|-------------|------------------|------------------|----------|
| Core Schema | 4 | 4 | 0 | 0% |
| Wallet System | 6 | 2 | 4 | **67%** |
| RLS Fixes | 3 | 1 | 2 | **67%** |
| Admin/Settings | 3 | 2 | 1 | **33%** |
| Notification | 1 | 0 | 0 | **0%** (pending) |
| Testing/Utils | 7 | 0 | 0 | 0% (keep for reference) |
| Setup Scripts | 4 | 0 | 4 | **100%** |
| Cron/Sample | 3 | 0 | 3 | **100%** |
| **TOTAL** | **31** | **9** | **14** | **45%** |

**Nearly HALF of your SQL files are duplicates or obsolete!**

---

## ✅ **ACTION PLAN**

### **Step 1: Backup (5 minutes)**
```bash
cd database
mkdir archive_2025_11_10
mv [obsolete-files] archive_2025_11_10/
```

### **Step 2: Execute Missing SQL (2 minutes)**
1. Open `notification-system.sql`
2. Copy ALL content
3. Paste to Supabase SQL Editor
4. Run → Wait for `SUCCESS: Notification system created!`

### **Step 3: Verify Setup (5 minutes)**
Run verification queries from `QUICK-START.md`:
```sql
-- Verify triggers
SELECT tgname FROM pg_trigger 
WHERE tgname LIKE '%notify%';

-- Verify functions
SELECT proname FROM pg_proc 
WHERE proname LIKE '%notification%';
```

### **Step 4: Clean Folder (Optional)**
Delete or archive the 13 obsolete files.

---

## 🎯 **FINAL RECOMMENDATION**

### **Keep These 20 Files:**
1. ✅ **schema.sql** - Core database
2. ✅ **functions.sql** - Business logic
3. ✅ **fix-all-rls.sql** - Security policies
4. ✅ **fix-sales-transactions-schema.sql** - Transaction fix
5. ✅ **wallet-tables-only.sql** - Wallet tables
6. ✅ **setup-wallet-and-shipments-SAFE.sql** - Wallet functions
7. ✅ **notification-system.sql** - Notification system
8. ✅ **create-admin.sql** - Admin creation
9. ✅ **create-platform-settings.sql** - Settings
10. ✅ **test-notifications.sql** - Testing
11. ✅ **test-rls-check.sql** - Testing
12. ✅ **test-rls-diagnostic.sql** - Testing
13. ✅ **business-queries.sql** - Analytics
14. ✅ **approve-all-products.sql** - Utility
15. ✅ **check-products-status.sql** - Utility
16. ✅ **debug-supplier-products.sql** - Utility
17. ✅ **README.md** - Docs
18. ✅ **QUICK-START.md** - Docs
19. ✅ **TESTING-NOTIFICATION-GUIDE.md** - Docs
20. ✅ **SHIPMENT-IMPLEMENTATION-SUMMARY.md** - Docs

### **Archive/Delete These 13 Files:**
❌ quick-setup-all-in-one.sql  
❌ setup-minimal.sql  
❌ wallet-system-schema.sql  
❌ setup-wallet-and-shipments.sql  
❌ setup-wallet-and-shipments-FIXED.sql  
❌ wallet-constraints-and-functions.sql  
❌ fix-rls-simple.sql  
❌ rls-policies.sql  
❌ stock-movements-schema.sql  
❌ upgrade-to-admin.sql  
❌ cron-setup.sql  
❌ cron-setup-simple.sql  
❌ sample-data.sql  

---

**Summary**: Kamu punya **45% duplicate files**. Setelah cleanup, tinggal **20 essential files** yang mudah di-manage! 🎯
