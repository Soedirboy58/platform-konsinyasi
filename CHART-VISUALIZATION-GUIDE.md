# 📊 Chart Visualization Guide - Platform Konsinyasi

## Overview
Platform sekarang dilengkapi dengan **visualisasi chart interaktif** yang tersinkronisasi dengan data transaksi aktual dari database.

---

## 🎯 Charts yang Tersedia

### 1️⃣ **Financial Report - Donut Chart (Revenue Breakdown)**
**Lokasi:** `/admin/reports/financial`

**Tampilan:**
- Donut chart menampilkan breakdown pendapatan:
  - 🟢 **Komisi Platform** (hijau) - 10% dari total sales
  - 🟠 **Transfer ke Supplier** (orange) - 90% dari total sales

**Data Source:**
```typescript
// Query dari sales_transaction_items
const totalSales = salesItems.reduce((sum, item) => sum + (item.subtotal || 0), 0)
const platformIncome = salesItems.reduce((sum, item) => sum + (item.commission_amount || 0), 0)
const supplierPayables = salesItems.reduce((sum, item) => sum + (item.supplier_revenue || 0), 0)
```

**Fitur:**
- Hover effect untuk setiap segment
- Percentage display otomatis
- Total sales di center donut
- Legend dengan warna matching

---

### 2️⃣ **Financial Report - Bar Chart (Income vs Expense)**
**Lokasi:** `/admin/reports/financial`

**Tampilan:**
- 3 horizontal bars:
  1. 🟢 **Pendapatan Platform** (green gradient) - 100% baseline
  2. 🔴 **Total Pengeluaran** (red gradient) - relative to income
  3. 🔵 **Laba Bersih** (blue gradient) - net profit

**Metrics:**
- Profit Margin percentage
- Expense Ratio percentage
- Visual comparison dengan width bars

**Formula:**
```typescript
netProfit = platformIncome - totalExpenses
profitMargin = (netProfit / platformIncome) * 100
expenseRatio = (totalExpenses / platformIncome) * 100
```

---

### 3️⃣ **Analytics - Bar Chart (Peak Hours)**
**Lokasi:** `/admin/analytics`

**Tampilan:**
- Horizontal bars untuk 8 jam tersibuk
- Gradient colors:
  - 🔵 **Top hour** - dark blue gradient
  - 💙 **Other hours** - light blue gradient

**Data Points:**
- Jam (00:00 - 23:00)
- Jumlah transaksi (count)
- Total sales (Rp)
- Percentage dari peak hour

**Insight:**
```typescript
// Group by hour
transactions.forEach(t => {
  const hour = new Date(t.created_at).getHours()
  hourlyData[hour] = { count: ++count, sales: sales + t.total_price }
})
```

---

### 4️⃣ **Analytics - Donut Chart (Top 5 Products)**
**Lokasi:** `/admin/analytics`

**Tampilan:**
- Donut chart untuk top 5 produk terpopuler
- 5 warna berbeda:
  - 🟡 Yellow (#eab308)
  - 🟠 Orange (#f97316)
  - 🔴 Red (#ef4444)
  - 🌸 Pink (#ec4899)
  - 🟣 Purple (#a855f7)

**Features:**
- Total sold di center
- Legend dengan truncated product names
- Percentage untuk setiap produk
- Revenue bar chart untuk detail

**Calculation:**
```typescript
const topProducts = popularProducts.slice(0, 5)
const total = topProducts.reduce((sum, p) => sum + p.purchase_count, 0)
const percentage = (product.purchase_count / total) * 100
```

---

## 🔄 Data Synchronization

### Sumber Data
Semua chart menggunakan data **real-time** dari Supabase:

**1. Sales Transactions:**
```sql
SELECT * FROM sales_transaction_items
JOIN sales_transactions ON sales_transactions.id = sales_transaction_items.transaction_id
WHERE sales_transactions.status = 'COMPLETED'
```

**2. Time-Based Filtering:**
```typescript
// Period options
'week'     → last 7 days
'month'    → last 30 days  
'quarter'  → last 90 days
'semester' → last 180 days
'year'     → last 365 days
```

**3. Auto-Refresh:**
- Charts reload when period filter changes
- `useEffect(() => { loadData() }, [period])`

---

## 🎨 Design Pattern

### SVG Donut Chart
```typescript
// Create arc path for donut segments
const createArc = (startAngle, endAngle, outerRadius, innerRadius) => {
  // Convert angles to coordinates
  const start = {
    x: centerX + outerRadius * Math.cos((startAngle - 90) * π / 180),
    y: centerY + outerRadius * Math.sin((startAngle - 90) * π / 180)
  }
  // Return SVG path string
  return `M ${start.x} ${start.y} A ${outerRadius} ${outerRadius} ...`
}
```

### Horizontal Bar Chart
```typescript
// Dynamic width based on percentage
<div 
  className="bg-gradient-to-r from-blue-500 to-blue-600"
  style={{ 
    width: `${(value / maxValue) * 100}%`,
    minWidth: '40px' // Ensure visibility
  }}
>
  <span>{value}</span>
</div>
```

---

## 💡 Business Insights

### Financial Report Insights:
- ✅ **Profit Margin > 20%** → Bisnis sehat
- ⚠️ **Expense Ratio > 80%** → Pertimbangkan efisiensi
- 🚨 **Net Profit < 0** → Bisnis rugi, action needed

### Analytics Insights:
- 📊 **Peak Hours** → Jadwalkan promo/flash sale di jam tersibuk
- 🏆 **Top Products** → Pastikan stok selalu ready
- 🔗 **Bundling** → Produk sering dibeli bersamaan → buat paket

---

## 🚀 Export Features

### CSV Export
```typescript
exportToCSV() {
  const data = [
    ['LAPORAN KEUANGAN'],
    ['Periode:', periodName],
    ['Total Penjualan', formatCurrency(totalSales)],
    ...
  ]
  const csv = data.map(row => row.join(',')).join('\n')
  // Download as .csv file
}
```

### PDF Export
```typescript
exportToPDF() {
  // Generate HTML content
  // Open in new window
  // Trigger browser print dialog
  window.print()
}
```

---

## 📱 Responsive Design

- Desktop (lg): Charts side-by-side dalam grid
- Tablet (md): Charts stack dalam 1 column
- Mobile: Compact view dengan scrollable legends

```typescript
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
  {/* Charts auto-adjust */}
</div>
```

---

## 🎯 Next Improvements

### Potential Enhancements:
1. ⭐ Interactive tooltips on hover
2. ⭐ Drill-down untuk detail per product
3. ⭐ Real-time update tanpa refresh
4. ⭐ Comparison dengan periode sebelumnya
5. ⭐ Export chart sebagai image (PNG)
6. ⭐ Animated transitions saat data berubah

### Advanced Analytics:
- Customer segmentation
- Cohort analysis
- Churn prediction
- Revenue forecasting

---

## 📝 Testing Checklist

- [ ] Chart muncul saat ada data transaksi
- [ ] Empty state saat belum ada data
- [ ] Loading state saat fetch data
- [ ] Period filter berfungsi
- [ ] Export CSV/PDF berhasil
- [ ] Responsive di mobile
- [ ] Colors sesuai design system
- [ ] Percentage calculation correct
- [ ] Hover effects smooth
- [ ] Legend readable (truncate long names)

---

## 🔧 Technical Stack

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS for styling
- SVG for custom charts
- Lucide React icons

**Data Layer:**
- Supabase PostgreSQL
- RLS policies untuk security
- Real-time subscriptions (future)

**Performance:**
- Lazy load charts
- Memoize calculations
- CSS transitions (not JS animations)

---

## 🎓 Documentation References

**Chart Implementation:**
- `frontend/src/app/admin/reports/financial/page.tsx`
- `frontend/src/app/admin/analytics/page.tsx`

**Data Queries:**
- `backend/queries/` (future: move logic to API)

**Design System:**
- Gradient colors dari Tailwind
- Consistent border radius (rounded-lg = 8px)
- Shadow depth (shadow, shadow-lg)

---

**Status:** ✅ IMPLEMENTED & DEPLOYED
**Last Updated:** 2025-11-15
**Commit:** `58952cf - feat: add donut & bar charts for transaction data visualization`
