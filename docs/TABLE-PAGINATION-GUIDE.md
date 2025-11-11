# 📊 Tutorial Lengkap: Pagination + Checkbox + Bulk Actions

Panduan implementasi fitur pagination (10-25-50), checkbox selection, dan quick actions (Cetak/Hapus/Export) untuk semua tabel.

---

## 🎯 Component Sudah Tersedia

✅ **TableControls.tsx** sudah dibuat di:
```
frontend/src/components/TableControls.tsx
```

Component ini menyediakan:
- ✅ Checkbox "Pilih Semua" / "Deselect All"
- ✅ Pagination (10-25-50 items per page)
- ✅ Previous/Next buttons
- ✅ Page numbers (1, 2, 3, ...)
- ✅ Quick Actions: Cetak, Hapus, Export

---

## 📋 Halaman yang Perlu Diupdate

### ✅ Sudah Selesai:
1. **Admin Shipments** (`/admin/shipments`) - Sudah punya pagination lengkap

### ⏳ Perlu Update:
1. **Admin Products** (`/admin/products`)
2. **Admin Suppliers** (`/admin/suppliers`)
3. **Supplier Products** (`/supplier/products`)
4. **Supplier Inventory** (`/supplier/inventory`)
5. **Admin Reports** (`/admin/reports`) - Optional
6. **Admin Payments** (`/admin/payments`) - Optional

---

## 🚀 Step-by-Step Implementation

### **STEP 1: Import Component**

Tambahkan di bagian atas file (setelah imports lain):

```typescript
import TableControls from '@/components/TableControls'
import { Printer, Trash2, Download } from 'lucide-react' // Jika belum ada
```

---

### **STEP 2: Add State Variables**

Tambahkan state di dalam component (setelah state yang sudah ada):

```typescript
// State untuk pagination
const [currentPage, setCurrentPage] = useState(1)
const [itemsPerPage, setItemsPerPage] = useState(10)

// State untuk selection
const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
```

---

### **STEP 3: Add Pagination Logic**

Tambahkan setelah deklarasi state:

```typescript
// Hitung pagination
const totalPages = Math.ceil(products.length / itemsPerPage) // Ganti 'products' sesuai data
const startIndex = (currentPage - 1) * itemsPerPage
const endIndex = startIndex + itemsPerPage
const paginatedProducts = products.slice(startIndex, endIndex) // Ganti 'products'

// Reset page saat filter berubah
useEffect(() => {
  setCurrentPage(1)
  setSelectedItems(new Set())
}, [filter, itemsPerPage]) // Tambahkan dependencies sesuai filter yang ada
```

---

### **STEP 4: Add Selection Handlers**

Tambahkan functions untuk handle selection:

```typescript
// Select all items di halaman saat ini
const handleSelectAll = () => {
  const newSet = new Set(paginatedProducts.map(item => item.id)) // Ganti 'paginatedProducts'
  setSelectedItems(newSet)
}

// Deselect all
const handleDeselectAll = () => {
  setSelectedItems(new Set())
}

// Toggle single item
const toggleSelect = (id: string) => {
  const newSet = new Set(selectedItems)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  setSelectedItems(newSet)
}
```

---

### **STEP 5: Add Action Handlers**

Tambahkan functions untuk quick actions:

```typescript
// CETAK - Print selected items
const handlePrint = () => {
  const selected = products.filter(item => selectedItems.has(item.id))
  
  // Create print-friendly content
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Data</title>
      <style>
        body { font-family: Arial, sans-serif; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        h1 { text-align: center; }
      </style>
    </head>
    <body>
      <h1>Data Export</h1>
      <p>Total: ${selected.length} items</p>
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Nama</th>
            <th>Harga</th>
            <!-- Tambahkan kolom sesuai kebutuhan -->
          </tr>
        </thead>
        <tbody>
          ${selected.map((item, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${item.name}</td>
              <td>Rp ${item.price.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `
  
  // Open print window
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.print()
  }
}

// EXPORT - Export to CSV
const handleExport = () => {
  const selected = products.filter(item => selectedItems.has(item.id))
  
  // Create CSV content
  const headers = ['No', 'Nama', 'Harga', 'Status'] // Sesuaikan kolom
  const rows = selected.map((item, idx) => [
    idx + 1,
    item.name,
    item.price,
    item.status
  ])
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\\n')
  
  // Download CSV
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `export_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  toast.success(`${selected.length} data berhasil diexport`)
}

// HAPUS - Delete selected items
const handleDelete = async () => {
  if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedItems.size} item?`)) {
    return
  }
  
  try {
    const supabase = createClient()
    
    // Delete each selected item
    const deletePromises = Array.from(selectedItems).map(id =>
      supabase
        .from('products') // Ganti dengan nama tabel yang sesuai
        .delete()
        .eq('id', id)
    )
    
    await Promise.all(deletePromises)
    
    toast.success(`${selectedItems.size} item berhasil dihapus`)
    setSelectedItems(new Set())
    
    // Reload data
    loadProducts() // Ganti dengan function load data yang sesuai
  } catch (error) {
    console.error('Delete error:', error)
    toast.error('Gagal menghapus item')
  }
}
```

---

### **STEP 6: Update Table - Add Checkbox Column**

**Di bagian `<thead>`:**

```tsx
<thead className="bg-gray-50">
  <tr>
    {/* TAMBAHKAN KOLOM CHECKBOX DI AWAL */}
    <th className="px-6 py-3 text-left">
      <input
        type="checkbox"
        checked={selectedItems.size === paginatedProducts.length && paginatedProducts.length > 0}
        onChange={selectedItems.size === paginatedProducts.length ? handleDeselectAll : handleSelectAll}
        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
      />
    </th>
    
    {/* Kolom lainnya tetap seperti semula */}
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
      Nama Produk
    </th>
    {/* ... kolom lainnya */}
  </tr>
</thead>
```

**Di bagian `<tbody>` - Loop items:**

```tsx
<tbody className="bg-white divide-y divide-gray-200">
  {paginatedProducts.map((product) => (  // GANTI products → paginatedProducts
    <tr key={product.id} className="hover:bg-gray-50">
      {/* TAMBAHKAN CELL CHECKBOX DI AWAL */}
      <td className="px-6 py-4">
        <input
          type="checkbox"
          checked={selectedItems.has(product.id)}
          onChange={() => toggleSelect(product.id)}
          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
      </td>
      
      {/* Cell lainnya tetap seperti semula */}
      <td className="px-6 py-4">
        <p className="font-medium text-gray-900">{product.name}</p>
      </td>
      {/* ... cell lainnya */}
    </tr>
  ))}
</tbody>
```

---

### **STEP 7: Add TableControls Component**

Tambahkan setelah closing tag `</table>` tapi masih di dalam container:

```tsx
      </table>
      
      {/* TABLE CONTROLS - PAGINATION & ACTIONS */}
      {products.length > 0 && (
        <TableControls
          // Selection
          selectedCount={selectedItems.size}
          totalCount={paginatedProducts.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          
          // Pagination
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalItems={products.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          
          // Actions
          onPrint={handlePrint}
          onDelete={handleDelete}
          onExport={handleExport}
          
          // Customization (optional)
          showPrint={true}
          showDelete={true}
          showExport={true}
          deleteLabel="Hapus"
        />
      )}
    </div>
  )
}
```

---

## 🎨 Customization Options

### Sembunyikan Action Tertentu:

```tsx
<TableControls
  // ... props lainnya
  showPrint={false}      // Sembunyikan tombol Cetak
  showDelete={false}     // Sembunyikan tombol Hapus
  showExport={true}      // Tampilkan tombol Export
  deleteLabel="Arsipkan" // Ganti label Hapus
/>
```

### Pagination Default:

```typescript
const [itemsPerPage, setItemsPerPage] = useState(25) // Default 25 instead of 10
```

---

## 📝 Contoh Lengkap: Admin Products

Lihat file ini untuk contoh implementasi lengkap:
```
frontend/src/app/admin/shipments/page.tsx
```

Halaman ini sudah punya pagination lengkap sebagai referensi.

---

## 🔧 Troubleshooting

### **Error: "Cannot read property 'length' of undefined"**

**Solusi:** Pastikan data sudah diload sebelum pagination:

```typescript
{!loading && products.length > 0 && (
  <TableControls ... />
)}
```

---

### **Checkbox tidak update saat klik**

**Solusi:** Pastikan `toggleSelect` menggunakan `new Set()`:

```typescript
const toggleSelect = (id: string) => {
  const newSet = new Set(selectedItems) // PENTING: new Set()
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  setSelectedItems(newSet)
}
```

---

### **Export CSV error di browser**

**Solusi:** Tambahkan charset UTF-8:

```typescript
const blob = new Blob(['\ufeff' + csvContent], { 
  type: 'text/csv;charset=utf-8;' 
})
```

---

### **Print tidak menampilkan style**

**Solusi:** Tambahkan inline style di printContent atau gunakan CSS print-specific.

---

## 📊 Checklist Implementasi

Gunakan checklist ini untuk setiap halaman:

- [ ] Import `TableControls` component
- [ ] Add state: `currentPage`, `itemsPerPage`, `selectedItems`
- [ ] Add pagination logic: `paginatedProducts`
- [ ] Add selection handlers: `handleSelectAll`, `handleDeselectAll`, `toggleSelect`
- [ ] Add action handlers: `handlePrint`, `handleExport`, `handleDelete`
- [ ] Update table `<thead>`: tambah kolom checkbox
- [ ] Update table `<tbody>`: 
  - Ganti `products.map()` → `paginatedProducts.map()`
  - Tambah cell checkbox di setiap row
- [ ] Add `<TableControls>` component setelah `</table>`
- [ ] Test: Select all, pagination, print, export, delete

---

## 🚀 Priority Implementation Order

Implementasi dalam urutan ini:

### 1️⃣ **Admin Products** (Prioritas Tertinggi)
- File: `frontend/src/app/admin/products/page.tsx`
- Alasan: Halaman paling sering diakses admin
- Estimasi: 15 menit

### 2️⃣ **Admin Suppliers** (Prioritas Tinggi)
- File: `frontend/src/app/admin/suppliers/page.tsx`
- Alasan: Manage supplier adalah core feature
- Estimasi: 15 menit

### 3️⃣ **Supplier Products** (Prioritas Tinggi)
- File: `frontend/src/app/supplier/products/page.tsx`
- Alasan: Supplier perlu manage produk mereka
- Estimasi: 15 menit

### 4️⃣ **Supplier Inventory** (Prioritas Sedang)
- File: `frontend/src/app/supplier/inventory/page.tsx`
- Alasan: Manage stok penting
- Estimasi: 15 menit

### 5️⃣ **Admin Reports** (Optional)
- File: `frontend/src/app/admin/reports/page.tsx`
- Alasan: Nice to have
- Estimasi: 10 menit

### 6️⃣ **Admin Payments** (Optional)
- File: `frontend/src/app/admin/payments/page.tsx`
- Alasan: Nice to have
- Estimasi: 10 menit

**Total Estimasi (1-4):** ~1 jam untuk semua halaman prioritas

---

## 💡 Tips Efisiensi

1. **Copy-Paste dari Shipments:**
   File `admin/shipments/page.tsx` sudah punya implementasi lengkap. Copy struktur pagination dari sana.

2. **Gunakan Find & Replace:**
   - Find: `products.map`
   - Replace: `paginatedProducts.map`

3. **Test di Browser:**
   Setelah setiap perubahan, test langsung di browser untuk memastikan tidak ada error.

4. **Commit Per Halaman:**
   Setelah selesai 1 halaman, commit ke git agar mudah rollback jika ada masalah.

---

## 🎯 Next Steps

Setelah implementasi pagination selesai:

1. ✅ Test semua halaman (select, pagination, actions)
2. ✅ Build: `npm run build`
3. ✅ Deploy: `vercel --prod`
4. ✅ Lanjut ke **Self-Checkout untuk Customer** 🛒

---

## 📞 Support

Jika ada error saat implementasi:
1. Check console browser untuk error message
2. Pastikan semua import sudah benar
3. Pastikan state initialization sudah benar
4. Cek bahwa data yang dipagination ada (tidak undefined)

---

## 📚 Reference Files

- **Component:** `frontend/src/components/TableControls.tsx`
- **Example (Complete):** `frontend/src/app/admin/shipments/page.tsx`
- **Icons:** Already imported from `lucide-react`

---

**Happy Coding! 🚀**

Jika ada pertanyaan atau error, tanyakan saja!
