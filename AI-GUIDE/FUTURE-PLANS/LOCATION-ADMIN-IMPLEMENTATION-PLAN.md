# 🏗️ LOCATION ADMIN IMPLEMENTATION PLAN

## 📋 Overview

Implementasi sistem multi-admin dimana setiap toko (location) memiliki 1 admin yang bertanggung jawab.

**Scope:**
- 1 Toko = 1 Admin (one-to-one relationship)
- Super Admin = lihat & kelola semua toko
- Location Admin = hanya lihat & kelola 1 toko yang ditugaskan
- Dikonfigurasi dari admin panel

**Complexity:** ⭐⭐ SEDANG  
**Estimated Time:** 2-3 hari kerja (12-15 jam)

---

## 🎯 Requirements

### Functional Requirements
1. Super Admin dapat assign user sebagai admin untuk specific location
2. Location Admin hanya dapat mengakses data dari location yang ditugaskan
3. Super Admin tetap dapat mengakses semua data dari semua location
4. UI untuk assign/unassign admin dari location
5. Dashboard & reports ter-filter otomatis berdasarkan role

### Non-Functional Requirements
- Database-level security (RLS policies)
- No duplicate code (reuse existing pages)
- Easy to maintain & extend
- Performance: minimal query overhead

---

## 🏗️ Architecture Design

### Database Schema Changes

```sql
-- 1. Add columns to locations table
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- 2. Create index for performance
CREATE INDEX idx_locations_admin_user ON locations(admin_user_id);

-- 3. Update role enum (if using enum) or keep as text
-- Existing: 'ADMIN', 'SUPPLIER'
-- New: 'SUPER_ADMIN', 'LOCATION_ADMIN', 'SUPPLIER'
```

### Role Hierarchy

```
SUPER_ADMIN (pusat)
├── Location 1 → LOCATION_ADMIN (user A)
├── Location 2 → LOCATION_ADMIN (user B)
└── Location 3 → LOCATION_ADMIN (user C)
```

### Data Relationship

```
locations table:
┌────────────┬──────────────┬─────────────────┬──────────────┐
│ id         │ name         │ admin_user_id   │ assigned_at  │
├────────────┼──────────────┼─────────────────┼──────────────┤
│ loc-uuid-1 │ Outlet A     │ user-uuid-john  │ 2025-12-01   │
│ loc-uuid-2 │ Outlet B     │ user-uuid-sarah │ 2025-12-02   │
│ loc-uuid-3 │ Outlet C     │ NULL            │ NULL         │
└────────────┴──────────────┴─────────────────┴──────────────┘
```

---

## 📅 Implementation Phases

### **Phase 1: Database & Security (Day 1 - 4-5 hours)**

#### 1.1 Schema Migration
```sql
-- File: database/add-location-admin-system.sql

-- Add columns to locations
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Index
CREATE INDEX IF NOT EXISTS idx_locations_admin_user 
ON locations(admin_user_id);

-- Comment for documentation
COMMENT ON COLUMN locations.admin_user_id IS 
'User assigned as location admin for this location';
```

#### 1.2 RLS Policies Update

**Pattern untuk semua tabel:**
```sql
-- Template RLS policy
CREATE POLICY "policy_name"
ON table_name FOR SELECT
TO authenticated
USING (
  -- Super Admin: full access
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  )
  OR
  -- Location Admin: only their location
  EXISTS (
    SELECT 1 FROM locations 
    WHERE id = table_name.location_id 
    AND admin_user_id = auth.uid()
  )
  OR
  -- Supplier: their own data (existing logic)
  EXISTS (...)
);
```

**Tables yang perlu update:**
1. ✅ sales_transactions
2. ✅ sales_transaction_items
3. ✅ inventory_levels
4. ✅ stock_movements
5. ✅ payment_history (if location-specific)
6. ✅ wallet_transactions (if location-specific)

#### 1.3 Test Queries
```sql
-- Test 1: Super Admin melihat semua
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims.sub = '<super-admin-uuid>';
SELECT * FROM sales_transactions; -- Should return all

-- Test 2: Location Admin hanya lihat 1 location
SET LOCAL request.jwt.claims.sub = '<location-admin-uuid>';
SELECT * FROM sales_transactions; -- Should return only their location
```

---

### **Phase 2: Admin Settings UI (Day 2 - 4-5 hours)**

#### 2.1 Create Location Management Page

**File:** `/admin/locations/manage/page.tsx`

**Features:**
- List all locations
- For each location:
  - Show current admin (if assigned)
  - Dropdown to assign user
  - Button to save assignment
  - Button to remove assignment

**UI Mockup:**
```
┌─────────────────────────────────────────────────┐
│ 🏪 Kelola Admin Toko                            │
├─────────────────────────────────────────────────┤
│                                                  │
│ 📍 Outlet Lobby A                               │
│ Admin Saat Ini: [Dropdown: Pilih User ▼]       │
│ [💾 Simpan]                                     │
│                                                  │
│ 📍 Outlet Lantai 2                              │
│ Admin Saat Ini: John Doe ✓                     │
│ Ditugaskan: 01 Des 2025                         │
│ [✏️ Ubah] [❌ Hapus Assignment]                 │
│                                                  │
│ 📍 Outlet Parkir                                │
│ Admin Saat Ini: Tidak ada                       │
│ [➕ Assign Admin]                               │
└─────────────────────────────────────────────────┘
```

#### 2.2 API Functions

```typescript
// Get all users eligible to be location admin
async function getEligibleUsers() {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('role', ['ADMIN', 'SUPER_ADMIN', 'LOCATION_ADMIN'])
    .order('full_name')
  return data
}

// Assign user to location
async function assignLocationAdmin(locationId: string, userId: string) {
  // 1. Update location
  await supabase
    .from('locations')
    .update({ 
      admin_user_id: userId,
      assigned_at: new Date().toISOString()
    })
    .eq('id', locationId)
  
  // 2. Update user role to LOCATION_ADMIN
  await supabase
    .from('profiles')
    .update({ role: 'LOCATION_ADMIN' })
    .eq('id', userId)
}

// Remove assignment
async function removeLocationAdmin(locationId: string) {
  const { data: location } = await supabase
    .from('locations')
    .select('admin_user_id')
    .eq('id', locationId)
    .single()
  
  // 1. Clear location assignment
  await supabase
    .from('locations')
    .update({ admin_user_id: null, assigned_at: null })
    .eq('id', locationId)
  
  // 2. Optionally change user role back to ADMIN
  // (or keep as LOCATION_ADMIN if they manage multiple locations in future)
}
```

---

### **Phase 3: Auto-Filter Implementation (Day 3 - 4-5 hours)**

#### 3.1 Create Helper Hook

**File:** `/hooks/useLocationFilter.ts`

```typescript
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useLocationFilter() {
  const [locationId, setLocationId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUserLocation() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      setRole(profile?.role || null)
      
      if (profile?.role === 'LOCATION_ADMIN') {
        const { data: location } = await supabase
          .from('locations')
          .select('id')
          .eq('admin_user_id', user.id)
          .single()
        
        setLocationId(location?.id || null)
      }
      
      setLoading(false)
    }
    
    loadUserLocation()
  }, [])

  return { locationId, role, loading, isSuperAdmin: role === 'SUPER_ADMIN' }
}
```

#### 3.2 Update Dashboard Page

**File:** `/admin/page.tsx`

```typescript
'use client'

import { useLocationFilter } from '@/hooks/useLocationFilter'

export default function AdminDashboard() {
  const { locationId, role, loading, isSuperAdmin } = useLocationFilter()
  
  // Build filter object
  const locationFilter = locationId ? { location_id: locationId } : {}
  
  // Apply to all queries
  const { data: transactions } = await supabase
    .from('sales_transactions')
    .select('*')
    .match(locationFilter) // Auto-filter for Location Admin
    .order('created_at', { ascending: false })
  
  const { data: inventory } = await supabase
    .from('inventory_levels')
    .select('*')
    .match(locationFilter)
  
  // Stats juga ter-filter otomatis
  const stats = calculateStats(transactions, inventory)
  
  return (
    <div>
      {/* Show location name for Location Admin */}
      {!isSuperAdmin && locationId && (
        <div className="bg-blue-50 p-4 mb-4 rounded-lg">
          <p className="text-sm text-blue-800">
            🏪 Anda mengelola: <strong>{locationName}</strong>
          </p>
        </div>
      )}
      
      {/* Dashboard content */}
      <StatsCards stats={stats} />
      <TransactionList data={transactions} />
    </div>
  )
}
```

#### 3.3 Update Other Pages

Apply same pattern ke:
- `/admin/transactions/page.tsx`
- `/admin/inventory/page.tsx`
- `/admin/reports/page.tsx`
- `/admin/payments/page.tsx`

---

### **Phase 4: UI Adjustments (Day 3 - 2-3 hours)**

#### 4.1 Hide Menu Items

**File:** `/components/AdminSidebar.tsx`

```typescript
const menuItems = [
  { label: 'Dashboard', href: '/admin', icon: Home },
  { label: 'Transaksi', href: '/admin/transactions', icon: Receipt },
  { label: 'Inventory', href: '/admin/inventory', icon: Package },
  { label: 'Laporan', href: '/admin/reports', icon: FileText },
  { label: 'Pembayaran', href: '/admin/payments', icon: CreditCard },
  
  // Super Admin Only
  { 
    label: 'Kelola Supplier', 
    href: '/admin/suppliers', 
    icon: Users,
    requiredRole: 'SUPER_ADMIN'
  },
  { 
    label: 'Kelola Toko', 
    href: '/admin/locations', 
    icon: Store,
    requiredRole: 'SUPER_ADMIN'
  },
  { 
    label: 'Assign Admin', 
    href: '/admin/locations/manage', 
    icon: UserCog,
    requiredRole: 'SUPER_ADMIN'
  },
  { 
    label: 'Pengaturan', 
    href: '/admin/settings', 
    icon: Settings,
    requiredRole: 'SUPER_ADMIN'
  },
]

// Filter based on user role
const { role } = useLocationFilter()

const visibleMenu = menuItems.filter(item => {
  if (item.requiredRole && role !== item.requiredRole) {
    return false
  }
  return true
})
```

#### 4.2 Conditional Stats Display

```typescript
// Show different stats header based on role
{isSuperAdmin ? (
  <h1>Total dari Semua Toko</h1>
) : (
  <h1>Statistik {locationName}</h1>
)}
```

---

## 🧪 Testing Checklist

### Unit Tests
- [ ] RLS policies prevent cross-location access
- [ ] Super Admin can access all locations
- [ ] Location Admin can only access assigned location
- [ ] Unassigned locations return empty for Location Admin

### Integration Tests
- [ ] Assign admin to location via UI
- [ ] Remove admin assignment via UI
- [ ] Dashboard shows correct filtered data
- [ ] Reports show correct filtered data
- [ ] Menu items hide/show correctly

### Manual Testing Scenarios

**Test as Super Admin:**
- [ ] Can see all transactions from all locations
- [ ] Can see all inventory from all locations
- [ ] Can access Kelola Supplier menu
- [ ] Can access Kelola Toko menu
- [ ] Can assign admin to location

**Test as Location Admin:**
- [ ] Dashboard shows only their location data
- [ ] Transactions filtered to their location
- [ ] Inventory filtered to their location
- [ ] Cannot see Kelola Supplier menu
- [ ] Cannot see Kelola Toko menu
- [ ] Cannot access other location's data (even via direct URL)

**Test Edge Cases:**
- [ ] Location without admin → only Super Admin can see
- [ ] User assigned to location then removed → access revoked
- [ ] User changed from LOCATION_ADMIN to SUPER_ADMIN → access expanded

---

## 📊 Effort Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Phase 1** | Database & RLS | 4-5 hours |
| - Schema migration | 30 min |
| - RLS policies (5 tables) | 2 hours |
| - Testing policies | 1.5 hours |
| **Phase 2** | Settings UI | 4-5 hours |
| - Location management page | 3 hours |
| - Assign/unassign functionality | 1.5 hours |
| - UI polish | 0.5 hour |
| **Phase 3** | Auto-filter | 4-5 hours |
| - useLocationFilter hook | 1 hour |
| - Update dashboard | 1 hour |
| - Update other pages (4 pages) | 2 hours |
| - Testing | 1 hour |
| **Phase 4** | UI Adjustments | 2-3 hours |
| - Hide menu items | 1 hour |
| - Conditional rendering | 1 hour |
| - Polish & bugfix | 0.5-1 hour |
| **TOTAL** | | **14-18 hours** |

**Realistic Timeline:** 2-3 working days

---

## 🚀 Deployment Strategy

### Step 1: Database Migration
```bash
# Run migration on staging
psql -U postgres -d konsinyasi_staging < database/add-location-admin-system.sql

# Verify
psql -U postgres -d konsinyasi_staging -c "
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'locations' 
  AND column_name IN ('admin_user_id', 'assigned_at');
"
```

### Step 2: Deploy Code
```bash
# Deploy to staging
git checkout -b feature/location-admin
git add .
git commit -m "feat: Add location admin system"
git push origin feature/location-admin

# After testing on staging
git checkout main
git merge feature/location-admin
git push origin main
```

### Step 3: Post-Deployment
- [ ] Assign initial admins via UI
- [ ] Test with real users
- [ ] Monitor error logs
- [ ] Gather feedback

---

## 🔮 Future Enhancements

### Phase 2 (Future)
- [ ] Multiple admins per location
- [ ] Granular permissions (read-only, manager, etc)
- [ ] Activity logging (who did what)
- [ ] Admin performance dashboard
- [ ] Notification system for admins

### Phase 3 (Advanced)
- [ ] Multi-location admin (1 admin manages multiple locations)
- [ ] Role hierarchy (Manager > Supervisor > Cashier)
- [ ] Temporary access grants
- [ ] Admin handover workflow

---

## 📝 Notes & Considerations

### Security
- ✅ RLS at database level (not just frontend)
- ✅ No way to bypass via API
- ✅ Role checked on every query
- ⚠️ Need to test edge cases thoroughly

### Performance
- ✅ Indexed foreign keys
- ✅ Minimal query overhead (just 1 extra JOIN)
- ⚠️ Monitor query performance on large datasets

### Maintenance
- ✅ Simple architecture (easy to understand)
- ✅ No code duplication
- ✅ Easy to extend
- ⚠️ Need documentation for future developers

### User Experience
- ✅ Transparent for Super Admin (no change)
- ✅ Clear for Location Admin (see their scope)
- ⚠️ Need onboarding guide for new admins

---

## 📚 References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)

---

**Document Version:** 1.0  
**Last Updated:** 2 Desember 2025  
**Status:** 📋 Planning Phase
