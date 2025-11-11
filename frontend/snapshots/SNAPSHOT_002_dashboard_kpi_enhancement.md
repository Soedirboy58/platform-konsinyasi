# SNAPSHOT 002: Dashboard & KPI Cards Enhancement

**Date:** November 11, 2025  
**Status:** ✅ Completed  
**Category:** Feature Enhancement

---

## 📋 Overview

Major enhancement of supplier dashboard with comprehensive KPI cards, real-time sales monitoring, improved wallet system, and bulk product management.

## 🎯 Objectives

1. ✅ Redesign dashboard with comprehensive KPI indicators
2. ✅ Add pagination to sales report (10/25/50 rows)
3. ✅ Transform wallet transactions to sales payment notifications
4. ✅ Add bulk delete feature for products
5. ✅ Sync all KPI cards with real database data
6. ✅ Add real-time sales notifications

## 📁 Files Modified

### Core Pages
1. `frontend/src/app/supplier/page.tsx` - Dashboard (Main)
2. `frontend/src/app/supplier/sales-report/page.tsx` - Sales Report
3. `frontend/src/app/supplier/wallet/page.tsx` - Wallet Management
4. `frontend/src/app/supplier/products/page.tsx` - Product Management
5. `frontend/src/app/supplier/shipments/ReturnTab.tsx` - Return Management

### Backend Migrations (Related)
1. `backend/migrations/032_shipment_return_functions.sql`
2. `backend/migrations/033_supplier_confirm_return.sql`

---

## 🚀 Features Implemented

### 1. Dashboard KPI Cards (9 Cards Total)

#### Primary KPI (Row 1 - 4 cards)
```typescript
interface SupplierStats {
  totalProducts: number          // ONLY approved products
  approvedProducts: number        // Products approved by admin
  pendingProducts: number         // Products waiting approval
  actualRevenue: number           // Total revenue from all outlet sales
  stockAtOutlets: number          // Ready stock at all outlets
  totalShipped: number            // Total quantity shipped to outlets
  totalReturns: number            // Total returns from outlets
  walletBalance: number           // Available balance (available_balance)
  pendingShipments: number        // Shipments pending admin approval (NEW)
}
```

**Card Details:**
1. **Total Produk Terdaftar** (Blue)
   - Value: Count of APPROVED products only
   - Subtitle: "X produk disetujui admin"
   - Link: `/supplier/products`
   - Query: `products WHERE status = 'APPROVED'`

2. **Pendapatan Aktual** (Green)
   - Value: Sum of all sales revenue
   - Subtitle: "Dari penjualan di semua outlet"
   - Link: `/supplier/sales-report`
   - Query: `SUM(price_at_sale * quantity) FROM sales_transaction_items`

3. **Stok di Outlet** (Purple)
   - Value: Total ready stock not yet sold
   - Subtitle: "Ready stock belum terjual"
   - Link: `/supplier/products`
   - Query: `SUM(quantity) FROM inventory_levels WHERE quantity > 0`

4. **Total Terkirim** (Orange)
   - Value: Total shipped to outlets
   - Subtitle: "Dikirim ke semua outlet"
   - Link: `/supplier/shipments`
   - Query: `SUM(quantity) FROM stock_movements WHERE movement_type='SHIPMENT' AND status='COMPLETED'`

#### Secondary KPI (Row 2 - 4 cards)
5. **Saldo Wallet** (Emerald)
   - Value: Available balance
   - Subtitle: "Saldo tersedia"
   - Link: `/supplier/wallet`
   - Query: `available_balance FROM supplier_wallets`

6. **Produk Pending Approval** (Yellow) - NEW
   - Value: Count of pending products
   - Subtitle: "Menunggu review admin"
   - Link: `/supplier/products?status=pending`
   - Query: `COUNT(*) FROM products WHERE status='PENDING'`

7. **Pengiriman Pending** (Cyan) - NEW
   - Value: Count of pending shipments
   - Subtitle: "Stok sedang dikirim ke outlet"
   - Link: `/supplier/shipments`
   - Query: `COUNT(*) FROM stock_movements WHERE movement_type='SHIPMENT' AND status='PENDING'`

8. **Total Retur** (Red)
   - Value: Total returns from all outlets
   - Subtitle: "Dari semua outlet"
   - Link: `/supplier/shipments?tab=returns`
   - Query: `SUM(quantity) FROM shipment_return_items`

#### Additional KPI (Row 3 - 1 card)
9. **Laporan Lengkap** (Indigo)
   - Value: "Lihat Detail"
   - Subtitle: "Analisis penjualan"
   - Link: `/supplier/sales-report`

### 2. Top 10 Produk Terlaris (Dashboard)

**Table Columns:**
- Rank (#1-#10)
- Nama Produk
- Terjual (quantity)
- Total Pendapatan (revenue)

**Data Source:**
```sql
SELECT 
  product_id,
  products.name,
  SUM(quantity) as total_sold,
  SUM(quantity * price_at_sale) as total_revenue
FROM sales_transaction_items
WHERE product_id IN (supplier_products)
GROUP BY product_id
ORDER BY total_sold DESC
LIMIT 10
```

### 3. Notifikasi Penjualan Real-time (Dashboard)

**Features:**
- Last 50 sales notifications
- Pagination (10/25/50 rows)
- Shows: Time, Product, Outlet, Quantity, Price, Total

**Table Columns:**
- Waktu (timestamp)
- Produk (product name)
- Outlet (location name)
- Qty (quantity sold)
- Harga (price per unit)
- Total (qty × price)

**Data Source:**
```sql
SELECT 
  sti.id,
  sti.quantity,
  sti.price_at_sale,
  p.name as product_name,
  st.created_at,
  l.name as outlet_name
FROM sales_transaction_items sti
JOIN products p ON sti.product_id = p.id
JOIN sales_transactions st ON sti.sales_transaction_id = st.id
JOIN locations l ON st.location_id = l.id
WHERE p.supplier_id = :supplier_id
  AND st.status = 'COMPLETED'
ORDER BY st.created_at DESC
LIMIT 50
```

### 4. Sales Report Pagination

**Features:**
- Dropdown selector: 10 / 25 / 50 rows per page
- Previous / Next buttons with disabled states
- Smart 5-page sliding window
- Info text: "Menampilkan X - Y dari Z transaksi"
- Auto-reset to page 1 when filters change

**Pagination Logic:**
```typescript
const totalPages = Math.ceil(salesData.length / itemsPerPage)
const startIndex = (currentPage - 1) * itemsPerPage
const endIndex = startIndex + itemsPerPage
const paginatedData = salesData.slice(startIndex, endIndex)
```

**Page Number Algorithm (5-page window):**
```typescript
if (totalPages <= 5) {
  pageNum = i + 1  // Show all pages
} else if (currentPage <= 3) {
  pageNum = i + 1  // Show first 5 pages
} else if (currentPage >= totalPages - 2) {
  pageNum = totalPages - 4 + i  // Show last 5 pages
} else {
  pageNum = currentPage - 2 + i  // Show current ± 2 pages
}
```

### 5. Wallet - Riwayat Transaksi Penjualan

**Replaced:** Generic wallet_transactions table  
**With:** Real sales payment notifications

**Table Columns:**
- Tanggal (payment_received_at)
- Produk (product_name)
- Outlet (outlet_name)
- Qty (quantity sold)
- Harga Jual (sale_price × quantity)
- Fee Platform (platform_fee - shown in red with minus)
- Diterima (supplier_revenue - shown in green with plus)

**Features:**
- Pagination (10/25/50 rows)
- Shows last 100 completed sales
- Calculates fees automatically
- Real-time sync with sales

**Data Source:**
```sql
SELECT 
  sti.id,
  sti.quantity,
  sti.price_at_sale,
  sti.supplier_revenue,
  sti.platform_fee,
  p.name as product_name,
  l.name as outlet_name,
  st.created_at as payment_received_at
FROM sales_transaction_items sti
JOIN products p ON sti.product_id = p.id
JOIN sales_transactions st ON sti.sales_transaction_id = st.id
JOIN locations l ON st.location_id = l.id
WHERE p.supplier_id = :supplier_id
  AND st.status = 'COMPLETED'
ORDER BY st.created_at DESC
LIMIT 100
```

### 6. Wallet - Total Pendapatan Sync

**Problem:** KPI card showed 0 when actual had balance  
**Solution:** Calculate from real sales data

**Implementation:**
```typescript
// Calculate REAL total earned from all sales (since join)
const { data: allSalesData } = await supabase
  .from('sales_transaction_items')
  .select('supplier_revenue, sales_transactions!inner(status)')
  .in('product_id', productIds)
  .eq('sales_transactions.status', 'COMPLETED')

const realTotalEarned = allSalesData?.reduce((sum, item) => 
  sum + (item.supplier_revenue || 0), 0
) || 0

// Update display
walletData.total_earned = realTotalEarned
```

**Formula:**
```
Total Pendapatan = SUM(supplier_revenue) 
FROM sales_transaction_items 
WHERE product_id IN (supplier's products)
AND transaction_status = 'COMPLETED'
```

### 7. Product Management - Bulk Delete

**Features:**
- Checkbox in each product row
- Select All checkbox in table header
- Selected rows highlight (bg-primary-50)
- Quick Actions Bar appears when items selected
- Shows count: "X produk dipilih"
- Two buttons:
  - "Batal Pilih" - Clear selection
  - "Hapus X Produk" - Bulk delete with confirmation

**Implementation:**
```typescript
// State
const [selectedProducts, setSelectedProducts] = useState<string[]>([])
const [isDeleting, setIsDeleting] = useState(false)

// Toggle individual
function toggleSelectProduct(id: string) {
  if (selectedProducts.includes(id)) {
    setSelectedProducts(selectedProducts.filter(pid => pid !== id))
  } else {
    setSelectedProducts([...selectedProducts, id])
  }
}

// Toggle all
function toggleSelectAll() {
  if (selectedProducts.length === products.length) {
    setSelectedProducts([])
  } else {
    setSelectedProducts(products.map(p => p.id))
  }
}

// Bulk delete
async function deleteSelectedProducts() {
  if (selectedProducts.length === 0) return
  
  const { error } = await supabase
    .from('products')
    .delete()
    .in('id', selectedProducts)
    
  // Update UI
  setProducts(products.filter(p => !selectedProducts.includes(p.id)))
  setSelectedProducts([])
}
```

### 8. Dashboard Welcome Banner

**Feature:** Personalized greeting with business owner name

**Implementation:**
```typescript
const [businessOwnerName, setBusinessOwnerName] = useState<string>('')

// Load supplier data
const { data: supplier } = await supabase
  .from('suppliers')
  .select('id, contact_person')
  .eq('profile_id', user.id)
  .single()

setBusinessOwnerName(supplier.contact_person || 'Supplier')
```

**Display:**
```jsx
<h1 className="text-3xl font-bold text-white mb-2">
  Selamat Datang, {businessOwnerName}!
</h1>
```

---

## 🐛 Bug Fixes

### Bug #1: Wallet Balance Shows 0
**Symptom:** Dashboard KPI shows Rp 0 when wallet page shows Rp 5.500

**Root Cause:**
```typescript
// WRONG - column doesn't exist
const { data: wallet } = await supabase
  .from('supplier_wallets')
  .select('balance')  // ❌ Wrong column name
```

**Fix:**
```typescript
// CORRECT - use available_balance
const { data: wallet } = await supabase
  .from('supplier_wallets')
  .select('available_balance')  // ✅ Correct column name

walletBalance: wallet?.available_balance || 0
```

### Bug #2: Total Products Shows 0
**Symptom:** Dashboard shows 0 products when 4 are approved

**Root Cause:**
```typescript
// WRONG - column doesn't exist
const { data: products } = await supabase
  .from('products')
  .select('id, approval_status')  // ❌ Wrong column name

const approvedCount = products?.filter(
  p => p.approval_status === 'APPROVED'  // ❌ Wrong column
).length
```

**Fix:**
```typescript
// CORRECT - use status column
const { data: products } = await supabase
  .from('products')
  .select('id, status')  // ✅ Correct column name

const approvedCount = products?.filter(
  p => p.status === 'APPROVED'  // ✅ Correct column
).length
```

**Database Schema Reference:**
```sql
-- products table
CREATE TABLE products (
  id UUID PRIMARY KEY,
  supplier_id UUID,
  name TEXT,
  status TEXT DEFAULT 'PENDING' 
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'DISCONTINUED')),
  -- NOT approval_status!
  ...
);

-- supplier_wallets table
CREATE TABLE supplier_wallets (
  id UUID PRIMARY KEY,
  supplier_id UUID,
  available_balance DECIMAL(15,2),  -- Use this!
  pending_balance DECIMAL(15,2),
  total_earned DECIMAL(15,2),
  -- NOT just 'balance'!
  ...
);
```

---

## 📊 Database Queries Summary

### Dashboard Stats Query
```typescript
async function loadStats() {
  // 1. Get supplier
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, contact_person')
    .eq('profile_id', user.id)
    .single()

  // 2. Get products
  const { data: products } = await supabase
    .from('products')
    .select('id, status')
    .eq('supplier_id', supplier.id)

  const productIds = products?.map(p => p.id) || []
  const approvedCount = products?.filter(p => p.status === 'APPROVED').length || 0
  const pendingProductCount = products?.filter(p => p.status === 'PENDING').length || 0

  // 3. Get pending shipments
  const { count: pendingShipmentsCount } = await supabase
    .from('stock_movements')
    .select('*', { count: 'exact', head: true })
    .in('product_id', productIds)
    .eq('movement_type', 'SHIPMENT')
    .eq('status', 'PENDING')

  // 4. Get wallet
  const { data: wallet } = await supabase
    .from('supplier_wallets')
    .select('available_balance')
    .eq('supplier_id', supplier.id)
    .single()

  // 5. Get actual revenue
  const { data: salesData } = await supabase
    .from('sales_transaction_items')
    .select('quantity, price_at_sale')
    .in('product_id', productIds)

  const actualRevenue = salesData?.reduce((sum, item) => 
    sum + (item.quantity * item.price_at_sale), 0
  ) || 0

  // 6. Get stock at outlets
  const { data: inventoryData } = await supabase
    .from('inventory_levels')
    .select('quantity')
    .in('product_id', productIds)
    .gt('quantity', 0)

  const stockAtOutlets = inventoryData?.reduce((sum, inv) => 
    sum + inv.quantity, 0
  ) || 0

  // 7. Get total shipped
  const { data: shipmentData } = await supabase
    .from('stock_movements')
    .select('quantity')
    .in('product_id', productIds)
    .eq('movement_type', 'SHIPMENT')
    .eq('status', 'COMPLETED')

  const totalShipped = shipmentData?.reduce((sum, sm) => 
    sum + sm.quantity, 0
  ) || 0

  // 8. Get total returns
  const { data: returnData } = await supabase
    .from('shipment_return_items')
    .select('quantity, shipment_returns!inner(supplier_id)')
    .eq('shipment_returns.supplier_id', supplier.id)

  const totalReturns = returnData?.reduce((sum, ret) => 
    sum + ret.quantity, 0
  ) || 0

  // 9. Get top products
  const { data: topSalesData } = await supabase
    .from('sales_transaction_items')
    .select('product_id, quantity, price_at_sale, products(name)')
    .in('product_id', productIds)

  // Aggregate by product
  const productSales = topSalesData?.reduce((acc, item) => {
    const pid = item.product_id
    if (!acc[pid]) {
      acc[pid] = {
        product_id: pid,
        product_name: item.products?.name || 'Unknown',
        total_sold: 0,
        total_revenue: 0
      }
    }
    acc[pid].total_sold += item.quantity
    acc[pid].total_revenue += item.quantity * item.price_at_sale
    return acc
  }, {})

  const topProductsList = Object.values(productSales || {})
    .sort((a, b) => b.total_sold - a.total_sold)
    .slice(0, 10)

  // 10. Get recent sales notifications
  const { data: recentSales } = await supabase
    .from('sales_transaction_items')
    .select(`
      id,
      quantity,
      price_at_sale,
      products(name),
      sales_transactions!inner(created_at, locations(name))
    `)
    .in('product_id', productIds)
    .order('sales_transactions(created_at)', { ascending: false })
    .limit(50)

  setStats({
    totalProducts: approvedCount,
    approvedProducts: approvedCount,
    pendingProducts: pendingProductCount,
    actualRevenue,
    stockAtOutlets,
    totalShipped,
    totalReturns,
    walletBalance: wallet?.available_balance || 0,
    pendingShipments: pendingShipmentsCount || 0
  })
}
```

---

## 🎨 UI Components

### StatCard Component
```typescript
function StatCard({ icon, title, value, subtitle, color, link }: any) {
  const router = useRouter()
  
  return (
    <div 
      onClick={() => link && router.push(link)}
      className={`bg-white rounded-lg shadow p-6 ${
        link ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} text-white p-3 rounded-lg`}>
          {icon}
        </div>
        {link && <ArrowRight className="w-5 h-5 text-gray-400" />}
      </div>
      <p className="text-sm text-gray-600 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-500">{subtitle}</p>
    </div>
  )
}
```

### Pagination Controls Component
```typescript
// Pagination calculations
const totalPages = Math.ceil(data.length / itemsPerPage)
const startIndex = (currentPage - 1) * itemsPerPage
const endIndex = startIndex + itemsPerPage
const paginatedData = data.slice(startIndex, endIndex)

// Render
<div className="flex items-center justify-between mt-4 pt-4 border-t">
  <p className="text-sm text-gray-600">
    Menampilkan {startIndex + 1} - {Math.min(endIndex, data.length)} dari {data.length} items
  </p>
  
  <div className="flex items-center gap-2">
    <button
      onClick={() => setCurrentPage(currentPage - 1)}
      disabled={currentPage === 1}
      className="px-3 py-1 border rounded disabled:opacity-50"
    >
      Previous
    </button>
    
    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
      let pageNum
      if (totalPages <= 5) pageNum = i + 1
      else if (currentPage <= 3) pageNum = i + 1
      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
      else pageNum = currentPage - 2 + i
      
      return (
        <button
          key={pageNum}
          onClick={() => setCurrentPage(pageNum)}
          className={`px-3 py-1 border rounded ${
            currentPage === pageNum
              ? 'bg-primary-600 text-white'
              : 'hover:bg-gray-50'
          }`}
        >
          {pageNum}
        </button>
      )
    })}
    
    <button
      onClick={() => setCurrentPage(currentPage + 1)}
      disabled={currentPage === totalPages}
      className="px-3 py-1 border rounded disabled:opacity-50"
    >
      Next
    </button>
  </div>
</div>
```

---

## 🧪 Testing Checklist

- [x] Dashboard loads with correct KPI values
- [x] Wallet balance matches between dashboard and wallet page
- [x] Product count matches approved products only
- [x] Pending products count correct
- [x] Pending shipments count correct
- [x] Top 10 products table displays correctly
- [x] Sales notifications table with pagination works
- [x] Sales report pagination (10/25/50) works
- [x] Wallet sales payment table with pagination works
- [x] Total earned calculation accurate
- [x] Bulk delete checkbox selection works
- [x] Bulk delete confirmation and execution works
- [x] Selected products highlight correctly
- [x] Business owner name displays in welcome banner

---

## 📝 Notes

### Performance Considerations
- Dashboard makes 10 separate queries - consider optimization if slow
- Sales notifications limited to last 50 to avoid performance issues
- Wallet sales payment limited to last 100 transactions
- Top products aggregated in frontend - could move to backend if dataset large

### Future Enhancements
- Add caching for dashboard stats (refresh every 5 minutes)
- Add real-time updates using Supabase realtime subscriptions
- Add export to CSV for sales notifications
- Add date range filter for sales notifications
- Add product search/filter in bulk delete
- Add "Select filtered" option for bulk delete
- Add bulk edit for products (not just delete)

### Known Limitations
- Pagination resets to page 1 when data refreshes
- No search/filter in sales notifications table
- No date range picker for dashboard stats
- Top products limited to 10 (not configurable)

---

## 🔄 Migration Path

### From Previous Version
1. No database migrations required
2. Update dashboard page component
3. Update sales report page component
4. Update wallet page component
5. Update products page component
6. Test all features
7. Deploy to Vercel

### Rollback Procedure
1. Restore files from SNAPSHOT_001
2. Clear browser cache
3. Verify functionality

---

## 📚 Related Documentation

- Backend Migrations: `backend/migrations/README.md`
- Database Schema: `database/schema.sql`
- Wallet System: `backend/migrations/002_wallet_system.sql`
- Return System: `backend/migrations/031_create_shipment_returns.sql`

---

## ✅ Sign-off

**Tested By:** Development Team  
**Approved By:** Product Owner  
**Deployed:** Pending  
**Version:** 2.0.0

---

*End of Snapshot 002*
