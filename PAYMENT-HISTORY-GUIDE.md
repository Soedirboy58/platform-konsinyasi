# 💰 Panduan Halaman Riwayat Pembayaran Supplier

## 📋 Overview

Halaman **Riwayat Pembayaran** (`/supplier/payment-history`) adalah halaman baru yang menampilkan detail lengkap setiap penerimaan uang dari penjualan produk supplier di outlet.

### ✨ Fitur Utama

1. **📊 Summary Cards** - KPI metrics penerimaan supplier
2. **🔍 Advanced Filters** - Filter by periode, outlet, produk, dan search
3. **📑 Detailed Table** - Tabel lengkap dengan expand/collapse detail
4. **📥 Export CSV** - Download data ke Excel
5. **📄 Pagination** - Navigasi halaman dengan berbagai ukuran
6. **💡 Transparent Calculation** - Tampilan perhitungan fee dan revenue

---

## 🎯 Fitur Detail

### 1. Summary Cards (KPI)

Menampilkan 3 kartu metrics penting:

#### Card 1: Total Diterima (Hijau)
```typescript
- Nilai: Rp totalRevenue
- Keterangan: "Sudah masuk ke wallet Anda"
- Icon: DollarSign
- Warna: Gradient green (from-green-500 to-green-600)
```

#### Card 2: Total Penjualan (Putih)
```typescript
- Nilai: Rp totalSales
- Detail: "{totalTransactions} transaksi • {totalProducts} produk terjual"
- Icon: TrendingUp (Blue)
```

#### Card 3: Fee Platform (Putih)
```typescript
- Nilai: Rp totalPlatformFee
- Detail: "Rata-rata {percentage}% per transaksi"
- Icon: Receipt (Red)
```

**Perhitungan:**
```typescript
totalRevenue = sum(supplier_revenue dari filtered payments)
totalSales = sum(subtotal dari filtered payments)
totalPlatformFee = sum(commission_amount dari filtered payments)
totalTransactions = unique(transaction_id count)
totalProducts = sum(quantity)
averageOrderValue = totalSales / totalTransactions
```

---

### 2. Filter System

#### Filter 1: Periode (Calendar Icon)
```typescript
- TODAY: Hari ini
- WEEK: 7 hari terakhir
- MONTH: Bulan ini (default)
- YEAR: Tahun ini
- ALL: Semua waktu
```

**Logic:**
- Filter langsung trigger `loadPaymentHistory()` (useEffect)
- Query database dengan `gte('created_at', startDate)`
- Auto-recalculate summary

#### Filter 2: Outlet (Store Icon)
```typescript
- ALL: Semua outlet (default)
- {outlet_id}: Nama outlet tertentu
```

**Logic:**
- Dynamically populated dari unique outlets in payment data
- Filter di client-side setelah data loaded
- Trigger `applyFilters()` via useEffect

#### Filter 3: Produk (Package Icon)
```typescript
- ALL: Semua produk (default)
- {product_id}: Nama produk tertentu
```

**Logic:**
- Dynamically populated dari unique products in payment data
- Filter di client-side
- Trigger `applyFilters()` via useEffect

#### Filter 4: Search (Search Icon)
```typescript
- Placeholder: "Cari produk, outlet, atau kode transaksi..."
- Search fields: product_name, outlet_name, transaction_code
- Case-insensitive
- Real-time filter via useEffect
```

**Kombinasi Filter:**
```typescript
function applyFilters() {
  let filtered = [...payments]
  
  // 1. Filter by outlet
  if (outletFilter !== 'ALL') {
    filtered = filtered.filter(p => p.outlet_id === outletFilter)
  }
  
  // 2. Filter by product
  if (productFilter !== 'ALL') {
    filtered = filtered.filter(p => p.product_id === productFilter)
  }
  
  // 3. Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    filtered = filtered.filter(p => 
      p.product_name.toLowerCase().includes(query) ||
      p.outlet_name.toLowerCase().includes(query) ||
      p.transaction_code.toLowerCase().includes(query)
    )
  }
  
  // Update state & recalculate
  setFilteredPayments(filtered)
  calculateSummary(filtered)
  setCurrentPage(1) // Reset to page 1
}
```

---

### 3. Tabel Pembayaran

#### Kolom Tabel:

| Kolom | Deskripsi | Format | Alignment |
|-------|-----------|--------|-----------|
| **Tanggal** | Tanggal & waktu penjualan | `dd MMM yyyy`<br>`HH:mm` | Left |
| **Kode Transaksi** | Transaction code | Font mono | Left |
| **Produk** | Nama produk | Text | Left |
| **Outlet** | Nama outlet | Text | Left |
| **Qty** | Jumlah terjual | Number | Right |
| **Total Penjualan** | Subtotal (customer bayar) | `Rp #,###` | Right |
| **Fee Platform** | Commission amount | `-Rp #,###` (red) | Right |
| **Anda Terima** | Supplier revenue | `+Rp #,###` (green bold) | Right |
| **Detail** | Expand button | ChevronDown/Up | Center |

#### Row States:

1. **Normal Row** (Hover: bg-gray-50)
   ```tsx
   - Display main transaction info
   - Click expand button to show details
   ```

2. **Expanded Row** (bg-blue-50)
   ```tsx
   Menampilkan:
   - Harga per Unit: Rp {price_per_unit}
   - Tarif Komisi Platform: {commission_rate}%
   - Tanggal Penjualan: Full datetime
   - Status Pembayaran: ✓ Diterima (green)
   
   + Calculation Box (white card):
     Harga Jual (qty × price)     Rp xxx
     Fee Platform (rate%)         - Rp xxx (red)
     ─────────────────────────────────────
     Anda Terima                  Rp xxx (green bold)
   ```

---

### 4. Pagination System

#### Controls:
```typescript
- Items per page selector: 10, 20, 50, 100
- First button: Jump to page 1
- Prev button: Go to previous page
- Page numbers: Show 5 pages (smart positioning)
- Next button: Go to next page
- Last button: Jump to last page
```

#### Display Info:
```
"Menampilkan {start} - {end} dari {total} pembayaran"
```

#### Page Number Logic:
```typescript
if (totalPages <= 5) {
  // Show all pages: 1 2 3 4 5
  pageNum = i + 1
} else if (currentPage <= 3) {
  // Show first 5: 1 2 3 4 5
  pageNum = i + 1
} else if (currentPage >= totalPages - 2) {
  // Show last 5: 96 97 98 99 100
  pageNum = totalPages - 4 + i
} else {
  // Show current ±2: 48 49 [50] 51 52
  pageNum = currentPage - 2 + i
}
```

---

### 5. Export to CSV

#### Button:
```tsx
<button onClick={exportToCSV} className="bg-green-600 text-white">
  <Download /> Export CSV
</button>
```

#### CSV Structure:
```csv
Tanggal,Kode Transaksi,Produk,Outlet,Qty,Harga/Unit,Total Penjualan,Fee Platform,Diterima
12 Nov 2024,TRX001,Nasi Goreng,Kantin A,2,15000,30000,3000,27000
12 Nov 2024,TRX002,Kue Basah,Kantin B,5,8000,40000,4000,36000
```

#### Filename:
```
payment-history-{YYYY-MM-DD}.csv
```

**Logic:**
```typescript
function exportToCSV() {
  const headers = ['Tanggal', 'Kode Transaksi', 'Produk', 'Outlet', 'Qty', 'Harga/Unit', 'Total Penjualan', 'Fee Platform', 'Diterima']
  const rows = filteredPayments.map(p => [
    new Date(p.payment_received_at).toLocaleDateString('id-ID'),
    p.transaction_code,
    p.product_name,
    p.outlet_name,
    p.quantity,
    p.price_per_unit,
    p.total_sale,
    p.platform_fee,
    p.supplier_revenue
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `payment-history-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}
```

---

## 🗄️ Database Query

### Main Query (Optimized with JOIN):

```typescript
const { data: salesData } = await supabase
  .from('sales_transaction_items')
  .select(`
    id,
    quantity,
    price,
    subtotal,
    supplier_revenue,
    commission_amount,
    sales_transactions!inner(
      id,
      transaction_code,
      status,
      created_at,
      locations(
        id,
        name
      )
    ),
    products!inner(
      id,
      name,
      supplier_id
    )
  `)
  .in('product_id', productIds)                               // Only supplier's products
  .eq('sales_transactions.status', 'COMPLETED')              // Only completed sales
  .gte('sales_transactions.created_at', startDate.toISOString()) // Date filter
  .order('sales_transactions(created_at)', { ascending: false })  // Latest first
```

**Why JOIN?**
- Single query instead of N+1 queries
- Fetch all related data (transaction, location, product) in one go
- Much faster than separate queries

### Data Transformation:

```typescript
const paymentRecords: PaymentRecord[] = salesData?.map((item: any) => {
  const transaction = item.sales_transactions
  const location = transaction?.locations
  const product = item.products
  const totalSale = item.subtotal || 0
  const supplierRevenue = item.supplier_revenue || 0
  const platformFee = item.commission_amount || 0
  const commissionRate = totalSale > 0 ? platformFee / totalSale : 0.10

  return {
    id: item.id,
    transaction_id: transaction?.id || '',
    transaction_code: transaction?.transaction_code || '',
    product_name: product?.name || 'Unknown',
    product_id: product?.id || '',
    quantity: item.quantity || 0,
    outlet_name: location?.name || 'Unknown',
    outlet_id: location?.id || '',
    price_per_unit: item.price || 0,
    total_sale: totalSale,
    platform_fee: platformFee,
    supplier_revenue: supplierRevenue,
    sold_at: transaction?.created_at || new Date().toISOString(),
    payment_received_at: transaction?.created_at || new Date().toISOString(),
    commission_rate: commissionRate
  }
}) || []
```

---

## 🎨 UI/UX Features

### 1. Empty State:
```tsx
{filteredPayments.length === 0 && (
  <div className="text-center py-12">
    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
    <p className="text-gray-500">Tidak ada data pembayaran</p>
    <p className="text-sm text-gray-400 mt-1">
      Ubah filter atau periode untuk melihat data lain
    </p>
  </div>
)}
```

### 2. Loading State:
```tsx
{loading && (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
  </div>
)}
```

### 3. Color Coding:
- **Green**: Revenue yang diterima supplier (positive)
- **Red**: Fee platform (negative/deduction)
- **Blue**: Informasi netral (total sales, transaksi)
- **Gray**: Metadata (tanggal, outlet, kode)

### 4. Typography:
- **Font Mono**: Transaction codes (easy to read codes)
- **Bold**: Important values (revenue amounts)
- **Small Text**: Secondary info (timestamps, percentages)

### 5. Hover Effects:
- Table rows: `hover:bg-gray-50`
- Buttons: `hover:bg-{color}-700`
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`

---

## 🔗 Navigation

### Menu Item Added:
```typescript
{
  label: 'Riwayat Pembayaran',
  href: '/supplier/payment-history',
  icon: History,
}
```

**Position:** Between "Dompet Saya" and "Management Pengiriman"

### Access Path:
```
Supplier Panel → Riwayat Pembayaran
URL: /supplier/payment-history
```

---

## 📊 Data Flow

```
1. User opens /supplier/payment-history
   ↓
2. loadPaymentHistory() triggered
   ↓
3. Get current user → Get supplier → Get product IDs
   ↓
4. Query sales_transaction_items dengan JOIN
   - Filter: product_id IN (supplier products)
   - Filter: status = 'COMPLETED'
   - Filter: created_at >= startDate
   ↓
5. Transform data ke PaymentRecord[]
   ↓
6. Extract unique outlets & products for filters
   ↓
7. Calculate summary (revenue, sales, fees)
   ↓
8. Display data in table
   ↓
9. User applies filters → applyFilters()
   ↓
10. Re-calculate summary for filtered data
   ↓
11. Update pagination (reset to page 1)
```

---

## ✅ Benefits

### For Suppliers:
1. **Transparansi Penuh** - Lihat detail setiap rupiah yang diterima
2. **Audit Trail** - Track semua penjualan dengan timestamp
3. **Perhitungan Jelas** - Expand row untuk lihat breakdown
4. **Export Data** - Download untuk rekonsiliasi/accounting
5. **Filter Powerful** - Analisis by outlet, produk, atau periode

### For Platform:
1. **Trust Building** - Supplier percaya dengan transparansi
2. **Reduce Support** - Supplier self-service untuk cek payment
3. **Data Analytics** - Supplier bisa analisis sendiri
4. **Accountability** - Semua payment tercatat jelas

---

## 🚀 Testing Checklist

### ✅ Functional Tests:

- [ ] Load data with different periods (TODAY, WEEK, MONTH, YEAR, ALL)
- [ ] Filter by outlet → Check filtered correctly
- [ ] Filter by product → Check filtered correctly
- [ ] Search by product name → Results match
- [ ] Search by outlet name → Results match
- [ ] Search by transaction code → Results match
- [ ] Combine filters → All filters apply together
- [ ] Change items per page → Pagination updates
- [ ] Navigate pages → Data shows correctly
- [ ] Expand row → Details display correctly
- [ ] Collapse row → Details hide
- [ ] Export CSV → File downloads with correct data
- [ ] Summary cards → Numbers match filtered data
- [ ] Empty state → Shows when no data

### ✅ Performance Tests:

- [ ] Load 100+ records → No lag
- [ ] Apply filters → Instant response (client-side)
- [ ] Change period → Query completes < 2 seconds
- [ ] Export large dataset → CSV generates successfully

### ✅ UI Tests:

- [ ] Mobile responsive → Table scrolls horizontally
- [ ] Desktop layout → All columns visible
- [ ] Hover states → Row highlights
- [ ] Button states → Disabled when appropriate
- [ ] Color coding → Green/red/blue consistent
- [ ] Loading spinner → Shows during data fetch

---

## 🐛 Troubleshooting

### Issue: No data showing
**Check:**
1. Supplier has products in database?
2. Products have completed sales?
3. Date filter too restrictive? Try "ALL"
4. Check console for error messages

### Issue: Filter not working
**Check:**
1. Data actually loaded? (check `payments` state)
2. Filter values match data? (outlet_id, product_id)
3. Check `applyFilters()` function logic

### Issue: Summary numbers wrong
**Check:**
1. Using filtered data? Should use `filteredPayments` not `payments`
2. Calculation logic correct? Check `calculateSummary()`
3. Number format issues? Check toLocaleString()

### Issue: Export CSV empty
**Check:**
1. Using `filteredPayments` not `payments`?
2. Browser blocking download? Check popup blocker
3. Data structure matches headers?

---

## 📝 Next Improvements (Future)

1. **Advanced Analytics**
   - Chart: Revenue trend over time
   - Chart: Top selling products
   - Chart: Performance by outlet

2. **Bulk Actions**
   - Select multiple payments
   - Bulk export selected
   - Generate invoice/receipt

3. **Notifications**
   - Real-time update when new payment received
   - Daily/weekly email summary

4. **Integration**
   - Auto-sync to accounting software
   - API untuk download data programmatically

---

## 🎯 Success Criteria

✅ **Halaman berhasil jika:**

1. ✅ Supplier bisa lihat SEMUA pembayaran yang diterima
2. ✅ Data akurat 100% match dengan database
3. ✅ Filter bekerja dengan cepat (< 100ms)
4. ✅ Export CSV berhasil download
5. ✅ Perhitungan transparant dan jelas
6. ✅ UI responsive di mobile & desktop
7. ✅ Loading time < 2 detik untuk 1000 records

---

## 🔐 Security

1. **Row Level Security (RLS)**
   - Supplier hanya lihat payment mereka sendiri
   - Filter by `product_id IN (supplier_products)`

2. **Data Privacy**
   - No customer personal data exposed
   - Only transaction metadata visible

3. **Auth Check**
   - Redirect to login if not authenticated
   - Check supplier profile exists

---

## 📞 Support

Jika ada issue dengan halaman Riwayat Pembayaran:

1. Check browser console for errors
2. Verify database connection working
3. Test with different filters/periods
4. Contact platform admin if data missing

---

**Created:** November 13, 2024  
**Version:** 1.0.0  
**Author:** Platform Development Team
