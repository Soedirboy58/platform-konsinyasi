# Panduan Integrasi Customer Report

## 🎯 Tujuan
Menambahkan tombol "Laporkan Masalah" di halaman katalog customer agar customer bisa melaporkan produk bermasalah.

---

## 📋 Langkah-langkah

### 1. Setup Storage Bucket (WAJIB)
Buka Supabase Dashboard → Storage → Create bucket:
- **Nama bucket**: `product-reports`
- **Public**: ✅ Yes (agar foto bisa diakses)
- **File size limit**: 5MB
- **Allowed MIME types**: `image/*`

### 2. Execute SQL Migrations (WAJIB)
Jalankan di Supabase SQL Editor:

```sql
-- Step 1: Extend shipment_returns table
-- File: database/ADD-CUSTOMER-REPORT-COLUMNS.sql
-- Copy paste semua isinya dan execute

-- Step 2: Create notification functions
-- File: database/CREATE-CUSTOMER-REPORT-NOTIFICATIONS.sql
-- Copy paste semua isinya dan execute
```

### 3. Integrasi ke Halaman Katalog

**Contoh: `/app/customer/catalog/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import ReportProductModal from '@/components/ReportProductModal';
// ... imports lainnya

export default function CatalogPage() {
  // State untuk modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  // Ambil locationId dari context atau state
  const locationId = 'your-location-id'; // Sesuaikan dengan logic Anda

  // Handler untuk membuka modal
  const handleReportClick = (product: any) => {
    setSelectedProduct(product);
    setIsReportModalOpen(true);
  };

  return (
    <div>
      {/* Daftar produk */}
      {products.map((product) => (
        <div key={product.id} className="product-card">
          <img src={product.photo_url} alt={product.name} />
          <h3>{product.name}</h3>
          
          {/* Tombol Laporkan */}
          <button
            onClick={() => handleReportClick(product)}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            ⚠️ Laporkan Masalah
          </button>
        </div>
      ))}

      {/* Modal Report */}
      {selectedProduct && (
        <ReportProductModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            setSelectedProduct(null);
          }}
          product={{
            id: selectedProduct.id,
            name: selectedProduct.name,
            photo_url: selectedProduct.photo_url,
            supplier_id: selectedProduct.supplier_id
          }}
          locationId={locationId}
        />
      )}
    </div>
  );
}
```

---

## 🔧 Alternatif: Integrasi ke Product Detail Page

**File: `/app/customer/products/[id]/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import ReportProductModal from '@/components/ReportProductModal';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // Fetch product data
  const product = useProduct(params.id); // Custom hook
  const locationId = useLocationId(); // Custom hook

  return (
    <div>
      <div className="product-detail">
        <img src={product.photo_url} alt={product.name} />
        <h1>{product.name}</h1>
        <p>{product.description}</p>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button className="bg-blue-500...">
            🛒 Beli Sekarang
          </button>
          
          {/* Tombol Report */}
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600"
          >
            ⚠️ Laporkan Produk Bermasalah
          </button>
        </div>
      </div>

      {/* Modal */}
      <ReportProductModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        product={{
          id: product.id,
          name: product.name,
          photo_url: product.photo_url,
          supplier_id: product.supplier_id
        }}
        locationId={locationId}
      />
    </div>
  );
}
```

---

## 📝 Data Flow

```
Customer clicks "Laporkan" button
    ↓
ReportProductModal opens
    ↓
Customer fills form:
  - Problem type (Rusak/Kadaluarsa/dll)
  - Severity (Low/Medium/High/Critical)
  - Description (required)
  - Photos (max 3)
  - Contact info (optional)
    ↓
Submit clicked
    ↓
1. Upload photos to 'product-reports' bucket
    ↓
2. Insert to shipment_returns:
   - source = 'CUSTOMER'
   - status = 'PENDING'
   - customer_name, customer_contact (if provided)
   - severity, problem_type, description
   - proof_photos (array of URLs)
    ↓
3. Call notification RPCs:
   - notify_admin_customer_report()
   - notify_supplier_customer_report()
    ↓
4. Show success toast
    ↓
5. Close modal
    ↓
Admin sees report in:
  /admin/suppliers/shipments?tab=returns
  (tab "Retur Customer")
    ↓
Supplier sees report in:
  /supplier/shipments?tab=returns
```

---

## ✅ Verifikasi

### Test Scenario:
1. Customer buka katalog/detail produk
2. Klik tombol "Laporkan Masalah"
3. Modal terbuka dengan form lengkap
4. Pilih problem type: PRODUCT_DEFECT
5. Pilih severity: HIGH
6. Isi description: "Produk rusak, kemasan penyok"
7. Upload 2 foto (max 3)
8. Isi nama & kontak (opsional)
9. Klik "Kirim Laporan"
10. Loading → Success toast → Modal tutup

### Check Database:
```sql
-- Cek record baru
SELECT 
    id,
    source,
    customer_name,
    customer_contact,
    severity,
    problem_type,
    description,
    proof_photos,
    status,
    created_at
FROM shipment_returns
WHERE source = 'CUSTOMER'
ORDER BY created_at DESC
LIMIT 1;

-- Cek notifications terkirim
SELECT * FROM notifications
WHERE type = 'CUSTOMER_REPORT'
ORDER BY created_at DESC
LIMIT 5;
```

### Check Storage:
- Buka Supabase Storage → `product-reports` bucket
- Harus ada 2 file gambar dengan nama unik (timestamp-based)

### Check Admin Dashboard:
- Login sebagai admin
- Buka `/admin/suppliers/shipments?tab=returns`
- Klik tab "👥 Retur Customer"
- Harus muncul 1 record baru dengan badge "CUSTOMER"
- Severity badge warna orange (HIGH)
- Ada nama & kontak customer
- Klik "Preview" untuk lihat detail + foto

### Check Supplier Dashboard:
- Login sebagai supplier (yang produknya dilaporkan)
- Buka `/supplier/shipments?tab=returns`
- Harus muncul 1 record baru
- Ada notification badge di header

---

## 🚨 Troubleshooting

### Error: "Failed to upload photo"
- **Penyebab**: Bucket 'product-reports' belum dibuat
- **Solusi**: Buat bucket di Supabase Storage

### Error: "Function notify_admin_customer_report does not exist"
- **Penyebab**: RPC functions belum dijalankan
- **Solusi**: Execute `CREATE-CUSTOMER-REPORT-NOTIFICATIONS.sql`

### Error: "Column 'source' does not exist"
- **Penyebab**: Migration belum dijalankan
- **Solusi**: Execute `ADD-CUSTOMER-REPORT-COLUMNS.sql`

### Modal tidak muncul
- **Penyebab**: State `isReportModalOpen` tidak ter-update
- **Solusi**: Check console.log, pastikan setState dipanggil

### Data tidak muncul di admin
- **Penyebab**: Filter tab salah atau RLS masih disabled
- **Solusi**: Check filter `.filter(r => r.source === 'CUSTOMER')` dan re-enable RLS

---

## 🎨 UI Enhancements (Opsional)

### 1. Badge "Laporkan" dengan counter
```tsx
<button className="relative">
  ⚠️ Laporkan
  {reportCount > 0 && (
    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
      {reportCount}
    </span>
  )}
</button>
```

### 2. Floating Action Button (FAB)
```tsx
<button 
  className="fixed bottom-6 right-6 bg-red-500 text-white p-4 rounded-full shadow-lg hover:bg-red-600 z-50"
  onClick={() => setIsReportModalOpen(true)}
>
  ⚠️ Laporkan Masalah
</button>
```

### 3. Quick Report dari Cart
Tambahkan opsi "Laporkan" di setiap item di keranjang untuk produk yang sudah dibeli.

---

## 📦 Checklist Deploy

- [ ] Execute `ADD-CUSTOMER-REPORT-COLUMNS.sql`
- [ ] Execute `CREATE-CUSTOMER-REPORT-NOTIFICATIONS.sql`
- [ ] Create `product-reports` storage bucket
- [ ] Integrate `ReportProductModal` ke catalog page
- [ ] Test customer submit report
- [ ] Verify data masuk ke database dengan source='CUSTOMER'
- [ ] Verify notifications terkirim ke admin & supplier
- [ ] Verify photos tersimpan di storage
- [ ] Verify admin bisa lihat di tab "Retur Customer"
- [ ] Verify supplier bisa lihat di tab returns
- [ ] Re-enable RLS dengan execute `FORCE-FIX-RLS-CLEAN.sql`
- [ ] Test lagi dengan RLS enabled
- [ ] Git commit & push
- [ ] Deploy to Vercel

---

**Status**: ReportProductModal component sudah siap, tinggal integrasi & setup database.
