# 🎯 SIMULASI END-TO-END FLOW - Platform Konsinyasi

**Tanggal:** 12 November 2025  
**Tujuan:** Testing complete flow dari supplier kirim produk sampai update semua dashboard  
**Durasi:** ~30-45 menit

---

## 📋 FLOW DIAGRAM

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  SUPPLIER   │─────→│    ADMIN    │─────→│    USER     │─────→│  DASHBOARD  │
│  Dashboard  │      │  Dashboard  │      │  Dashboard  │      │   UPDATE    │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
     │                     │                     │                     │
     ├─ 1. Add Product     ├─ 2. Approve         ├─ 3. Buy Product    ├─ 4. Real-time
     ├─ Kirim ke admin     ├─ Post to etalase   ├─ Transaction       │    - Admin stats
     └─ Status: PENDING    └─ Status: APPROVED  └─ Payment           └─    - Supplier wallet
                                                                           - User purchase
```

---

## 🎯 QUICK TEST - Customer Self-Checkout (5 Menit)

### **Shortcut untuk testing cepat tanpa setup baru:**

**1. Langsung ke Customer Interface:**
```
http://localhost:3000/kantin/outlet_lobby_a
```

**2. Pilih Produk (yang sudah ada di sample data):**
- Keripik Singkong Balado (Rp 8.500) → Qty: 2
- Kopi Susu Dingin (Rp 7.500) → Qty: 1

**3. Expected Result:**
- Total: Rp 24.500 (16.000 + 7.500)
- Checkout success dengan QRIS atau Cash
- Transaction code generated: `TRX-YYYYMMDD-XXXXX`

**4. Verify Dashboard Update:**
- **Admin** `/admin`: Daily Sales +1, Daily Revenue +Rp 24.500
- **Supplier 1** `/supplier`: Revenue +Rp 14.400 (90% dari Rp 16.000)
- **Supplier 2** `/supplier`: Revenue +Rp 6.750 (90% dari Rp 7.500)

---

## 🚀 TAHAP 1: SUPPLIER - Kirim Produk ke Platform

### **A. Cara 1: Add Product Baru (Jika belum ada produk)**

#### **Login sebagai Supplier**
1. Buka browser: `http://localhost:3000/supplier/login`
2. Login dengan kredensial test:
   - Email: `supplier1@gmail.com`
   - Password: `supplier123`
3. Akan redirect ke `/supplier` (dashboard supplier)

#### **Add New Product**
4. Klik menu **"Products"** atau **"Tambah Produk"**
5. Navigate ke `/supplier/products/new`
6. Isi form produk:

```
Nama Produk:     Kopi Arabica Premium 200g
Kategori:        Food & Beverage (pilih dari dropdown)
Harga:           Rp 85.000
Cost Price:      Rp 60.000
Stok Awal:       0 (akan diisi via shipment)
Deskripsi:       Kopi arabica pilihan dari Gayo, Aceh
Upload Image:    (Upload gambar produk)
```

7. Klik **"Submit Produk"**
8. ✅ Produk tersimpan dengan `status: 'PENDING'`

#### **✅ Checkpoint Supplier Dashboard:**
- Total Products: +1
- Pending Products: +1
- Status badge: Orange "PENDING"
- Message: "Menunggu approval admin"

---

### **B. Cara 2: Kirim Produk via Shipment (Rekomendasi)**

**Untuk produk yang sudah APPROVED, supplier bisa langsung kirim via shipment:**

#### **Create Shipment**
1. Login sebagai supplier (credentials di atas)
2. Navigate ke `/supplier/shipments` atau klik menu "Shipments"
3. Klik **"Buat Pengiriman Baru"**
4. Form pengiriman:
   ```
   Lokasi Tujuan: Lobby Gedung A (pilih dari dropdown)
   Pilih Produk:
     - Keripik Singkong Balado: Qty 10
     - Kopi Susu Dingin: Qty 5
   Catatan: "Pengiriman rutin mingguan"
   ```
5. Klik **"Submit Pengiriman"**
6. ✅ Shipment dibuat dengan `status: 'PENDING'`

#### **✅ Checkpoint Supplier Dashboard:**
- **Pengiriman Pending**: +1
- Status: "Menunggu approval admin"
- Notification: "Pengiriman berhasil diajukan"

### **📸 Screenshot yang perlu dicek:**
- [ ] Form submit success message
- [ ] Product/Shipment muncul di list dengan badge PENDING
- [ ] Dashboard stats updated

---

## 🔍 TAHAP 2: ADMIN - Review & Approve Pengiriman

### **Navigate to Shipments Page**
1. Buka tab baru: `http://localhost:3000/admin/login`
2. Login dengan akun admin:
   - Email: `admin@konsinyasi.com`
   - Password: `admin123`
3. Akan redirect ke `/admin` (dashboard admin)
4. Dari sidebar, klik menu **"Kelola Suppliers"**
5. Pilih submenu **"Kelola Pengiriman"** atau langsung ke `/admin/suppliers/shipments`

### **Tab: Review Pengiriman**

#### **Review Pending Shipment**
6. Tab default akan menampilkan **"Review Pengiriman"**
7. Lihat tabel pengiriman dengan kolom:
   - **Supplier name** & contact person
   - **Lokasi tujuan** (contoh: "Lobby Gedung A")
   - **Jumlah produk** (contoh: "2 item")
   - **Total qty** (contoh: "15 unit")
   - **Status badge**: **PENDING** (yellow)
   - **Tanggal pengiriman**
8. Klik tombol **"Detail"** (biru dengan icon mata)

#### **Detail Shipment Modal**
9. Modal muncul dengan informasi:
   - **Header**: Supplier, Lokasi Tujuan, Status, Tanggal
   - **Catatan** (jika ada): "Pengiriman rutin mingguan"
   - **Tabel Produk**:
     ```
     Produk                    | SKU        | Harga    | Qty | Subtotal
     Keripik Singkong Balado  | SNK-KSB    | Rp 8.500 | 10  | Rp 85.000
     Kopi Susu Dingin         | DRK-KSD    | Rp 7.500 | 5   | Rp 37.500
     ─────────────────────────────────────────────────────────────────
     Total:                                           | 15  | Rp 122.500
     ```

### **A. Scenario: APPROVE Pengiriman**

#### **Approve Action**
10. Klik tombol **"✓ Approve Pengiriman"** (hijau)
11. Konfirmasi: "Approve pengiriman ini? Stok akan ditambahkan ke lokasi tujuan."
12. Klik **OK**
13. ✅ Backend menjalankan RPC `approve_stock_movement()`:
    - Status shipment → **APPROVED**
    - Update `inventory_levels` table:
      - Keripik Singkong Balado di Lobby A: **+10 unit**
      - Kopi Susu Dingin di Lobby A: **+5 unit**
    - **Produk otomatis muncul di etalase kantin** (`/kantin/outlet_lobby_a`)
    - Create notification untuk supplier: "Pengiriman disetujui"
14. Alert: "Pengiriman berhasil di-approve!"
15. Modal close, tabel refresh, status badge → **GREEN** (APPROVED)

#### **Verify Inventory & Etalase**
16. **Cek Inventory**:
    - Go to `/admin/suppliers/products`
    - Filter/cari "Keripik Singkong Balado"
    - Check kolom **"Stock at Outlets"**: Harus bertambah **+10**
17. **Cek Etalase Customer**:
    - Buka tab baru: `http://localhost:3000/kantin/outlet_lobby_a`
    - Produk "Keripik Singkong Balado" **MUNCUL** dan bisa dibeli
    - Stock quantity ter-update

#### **✅ Checkpoint Approve:**
- [ ] Pengajuan Pending: -1
- [ ] Produk Masuk Bulan Ini: +15 unit
- [ ] Inventory levels updated di database
- [ ] Produk muncul di etalase customer

---

### **B. Scenario: REJECT Pengiriman**

#### **Reject Action**
10. Alternatif: Klik tombol **"✗ Tolak Pengiriman"** (merah)
11. Modal muncul: **"Tolak Pengiriman"**
12. Input alasan penolakan (REQUIRED):
    ```
    Contoh: "Produk sudah expired, tanggal kadaluarsa tidak sesuai standar.
    Mohon supplier mengambil kembali produk ini."
    ```
13. Klik **"Konfirmasi Penolakan"**
14. ✅ Backend menjalankan RPC `reject_stock_movement()`:
    - Status shipment → **REJECTED**
    - Simpan `rejection_reason`
    - **Produk TIDAK masuk inventory**
    - **Produk TIDAK muncul di etalase**
    - Create notification untuk supplier: "Pengiriman ditolak. Alasan: ..."
15. Alert: "Pengiriman berhasil ditolak"
16. Shipment dipindahkan ke tab **"Produk Retur"**

#### **Tab: Produk Retur**
17. Klik tab **"Produk Retur"**
18. Lihat tabel pengiriman yang ditolak:
    - Supplier name & contact (phone number ditampilkan untuk koordinasi)
    - Lokasi tujuan
    - Jumlah produk & qty
    - **Alasan Ditolak** (visible di tabel)
    - Tanggal ditolak
19. Klik **"Detail"** untuk lihat detail lengkap:
    - Info supplier dengan nomor telepon
    - Alasan penolakan (highlighted dalam box merah)
    - List produk yang harus dikembalikan
20. Setelah supplier **mengambil kembali** produk yang ditolak:
    - Klik tombol **"✓ Sudah Diretur"** (hijau)
    - Konfirmasi: "Tandai pengiriman ini sebagai sudah diretur/diambil supplier?"
    - Status berubah → **CANCELLED** (completed return)
    - Entry dihapus dari list retur

#### **✅ Checkpoint Reject:**
- [ ] Status shipment: REJECTED
- [ ] Alasan penolakan tersimpan
- [ ] Muncul di tab "Produk Retur"
- [ ] Supplier menerima notification
- [ ] Produk TIDAK masuk inventory
- [ ] Produk TIDAK muncul di etalase

---

### **Summary TAHAP 2:**

**Admin memiliki 2 keputusan untuk setiap pengiriman:**

| Keputusan | Action | Hasil |
|-----------|--------|-------|
| **APPROVE** | ✓ Setujui pengiriman | • Stok masuk inventory<br>• Produk muncul di etalase<br>• Customer bisa beli<br>• Supplier dapat notif approval |
| **REJECT** | ✗ Tolak pengiriman | • Stok TIDAK masuk<br>• Produk TIDAK di etalase<br>• Masuk list retur<br>• Supplier harus ambil kembali<br>• Admin tandai "Sudah Diretur" setelah diambil |

### **📸 Screenshot yang perlu dicek:**
- [ ] Shipments table dengan filter status & supplier
- [ ] Detail modal dengan product list lengkap
- [ ] Approve: Success message & inventory bertambah
- [ ] Reject: Modal alasan penolakan
- [ ] Tab Produk Retur: List rejected shipments dengan alasan
- [ ] Button "Sudah Diretur" untuk mark as returned

---

## 🛒 TAHAP 3: USER - Browse & Buy Product (Self-Checkout via QR Scan)

### **Customer Scan QR Code**
1. **Customer datang ke outlet/location**
2. **Scan QR Code** yang tersedia di outlet (setiap outlet punya QR unik)
3. Browser otomatis buka: `http://localhost:3000/self-checkout?location_id=[outlet_id]`
4. **TIDAK PERLU LOGIN** - langsung masuk ke etalase

### **Browse Products in Self-Checkout Etalase**
5. Halaman menampilkan:
   - Header: Nama outlet/location
   - Product grid: Semua produk APPROVED dengan stock > 0
6. Cari produk **"Kopi Arabica Premium 200g"**
7. Produk harus **TERLIHAT** di etalase (karena status APPROVED & stocked)

### **Add to Cart & Checkout**
8. Klik produk untuk lihat detail
9. Pilih quantity: **2 unit**
10. Klik **"Tambah ke Keranjang"** atau **"+ Add"**
11. Cart icon di header menunjukkan: **(2)** items
12. Klik cart icon untuk review:
    ```
    Kopi Arabica Premium 200g
    Qty: 2
    Harga satuan: Rp 85.000
    Subtotal: Rp 170.000
    ```
13. Klik **"Checkout"** atau **"Bayar"**

### **Payment Process (QRIS/Cash)**
14. Halaman payment menampilkan:
    - Total: Rp 170.000
    - Metode: **QRIS** (default untuk self-checkout)
15. **Generate QRIS**:
    - System generate QR code untuk payment
    - Customer scan dengan e-wallet (GoPay/OVO/DANA/dll)
16. Atau pilih **"Bayar di Kasir"** (Cash):
    - Tampilkan receipt number
    - Customer bayar ke kasir
    - Kasir confirm payment
17. ✅ Transaction created dengan:
    - `status: 'COMPLETED'`
    - `location_id: [outlet_id]`
    - `payment_method: 'QRIS'` atau `'CASH'`
    - **NO user_id** (anonymous customer)

### **✅ Checkpoint Self-Checkout:**
- QR scan langsung ke etalase (no login required)
- Transaction recorded dengan location_id
- Stock produk berkurang: 50 → 48 unit
- Receipt/struk digital ditampilkan
- Transaction ID generated

### **📸 Screenshot yang perlu dicek:**
- [ ] QR code scan redirect ke self-checkout
- [ ] Etalase menampilkan produk dengan location header
- [ ] Cart dengan 2 items & total correct
- [ ] QRIS payment QR code generated
- [ ] Success page dengan receipt/struk digital

---

## 📊 TAHAP 4: DASHBOARD UPDATE - Real-time Impact

### **A. Admin Dashboard** (`/admin`)

**Refresh atau auto-update:**
1. Daily Sales: +1 transaction
2. Daily Revenue: +Rp 170.000
3. Recent Sales table: Muncul entry baru
   ```
   Product: Kopi Arabica Premium 200g
   Quantity: 2
   Total: Rp 170.000
   Outlet: [nama_outlet]
   Time: Just now
   ```

**KPI Cards Updated:**
- Total Sales: +Rp 170.000
- Products in Stock: Updated (48 unit)

**Navigate to Reports:**
4. Go to `/admin/reports`
5. **Pie Chart**: "Kopi Arabica" should appear
6. **Bar Chart**: Sales trend updated with new data point

**Laporan Penjualan:** (`/admin/reports/sales`)
7. Filter: "Today"
8. Table shows new transaction
9. KPI cards:
   - Total Sales: Rp 170.000
   - Transactions: 1
   - Products Sold: 1
   - Avg Transaction: Rp 170.000

**Laporan Keuangan:** (`/admin/reports/financial`)
10. Total Penjualan: +Rp 170.000
11. Komisi Platform (10%): +Rp 17.000
12. Transfer ke Supplier (90%): +Rp 153.000
13. Laba Bersih: Rp 17.000 (jika belum ada expense)

### **✅ Checkpoint Admin Dashboard:**
- [ ] Header stats updated (Daily Sales & Revenue)
- [ ] Recent sales table shows new entry
- [ ] Charts updated (Pie & Bar)
- [ ] Sales report includes transaction
- [ ] Financial report shows commission split

---

### **B. Supplier Dashboard** (`/supplier`)

**Refresh supplier dashboard:**
1. Login kembali ke akun supplier (yang jual "Kopi Arabica")
2. Navigate to `/supplier`

**Dashboard Updated:**
3. **Actual Revenue**: +Rp 153.000 (90% dari Rp 170.000)
4. **Stock at Outlets**: 48 unit (dari 50)
5. **Sales Notifications**: Entry baru
   ```
   🎉 PENJUALAN BARU!
   Kopi Arabica Premium 200g
   Qty: 2 unit
   Revenue: Rp 153.000 (supplier portion)
   Outlet: [nama_outlet]
   Time: Just now
   ```

**Wallet Updated:** (`/supplier/wallet`)
6. Navigate to wallet page
7. **Available Balance**: +Rp 153.000
8. **Total Earned**: +Rp 153.000
9. Transaction history shows new entry:
   ```
   Type: SALE
   Amount: +Rp 153.000
   Description: Penjualan Kopi Arabica x2
   Date: [timestamp]
   ```

**Inventory Updated:** (`/supplier/inventory`)
10. Navigate to inventory page
11. "Kopi Arabica Premium" stock: **48 unit**
12. Stock movement log:
    ```
    Type: OUT
    Quantity: -2
    Reason: Sold to customer
    Date: [timestamp]
    ```

**Sales Report:** (`/supplier/sales-report`)
13. Navigate to sales report
14. Table shows new transaction
15. Charts updated with latest sale

### **✅ Checkpoint Supplier Dashboard:**
- [ ] Actual Revenue increased by Rp 153.000
- [ ] Wallet balance shows +Rp 153.000
- [ ] Stock reduced to 48 units
- [ ] Sales notification appears
- [ ] Transaction in history

---

## 🔄 TAHAP 5: Reverse Flow - Supplier Request Withdrawal

### **Supplier Withdraw Request**
1. Login sebagai supplier
2. Navigate to `/supplier/wallet`
3. Current balance: Rp 153.000
4. Klik **"Withdraw"** atau **"Tarik Dana"**
5. Form withdraw:
   ```
   Amount: Rp 150.000
   Bank: BCA
   Account Number: 1234567890
   Account Name: [supplier_name]
   ```
6. Submit request
7. ✅ Status: `PENDING_APPROVAL`

### **Admin Review Withdrawal**
8. Login ke admin: `/admin/payments`
9. Section **"Withdraw Requests"**
10. Entry baru muncul:
    ```
    Supplier: [supplier_name]
    Amount: Rp 150.000
    Bank: BCA - 1234567890
    Status: PENDING
    Actions: [Approve] [Reject]
    ```
11. Klik **"Approve"**
12. Confirm approval
13. ✅ Payment processed

### **Supplier Wallet Updated**
14. Back to supplier `/supplier/wallet`
15. **Available Balance**: Rp 3.000 (153.000 - 150.000)
16. **Transaction History**:
    ```
    Type: WITHDRAWAL
    Amount: -Rp 150.000
    Status: COMPLETED
    Bank: BCA - 1234567890
    Date: [timestamp]
    ```

### **✅ Checkpoint Withdrawal Flow:**
- [ ] Withdraw request created
- [ ] Admin sees pending request
- [ ] Approval successful
- [ ] Supplier balance updated
- [ ] Transaction history recorded

---

## 📝 DATA VALIDATION CHECKLIST

### **Test Data Reference (dari sample-data.sql)**

**Login Credentials:**
- Admin: `admin@konsinyasi.com` / `admin123`
- Supplier 1 (Snack): `supplier1@gmail.com` / `supplier123` → "Snack Nusantara"
- Supplier 2 (Minuman): `supplier2@gmail.com` / `supplier123` → "Segar Minuman"

**Test Locations dengan QR Code:**
- Lobby Gedung A → QR Slug: `outlet_lobby_a` → URL: `/kantin/outlet_lobby_a`
- Lobby Gedung B → QR Slug: `outlet_lobby_b` → URL: `/kantin/outlet_lobby_b`
- Warehouse Utama → QR Slug: `warehouse_main` → URL: `/kantin/warehouse_main`

**Test Products (Already APPROVED in sample data):**
- Keripik Singkong Original (Rp 8.000) - Supplier: Snack Nusantara
- Keripik Singkong Balado (Rp 8.500) - Supplier: Snack Nusantara
- Kacang Bawang Kriuk (Rp 6.000) - Supplier: Snack Nusantara
- Air Mineral 600ml (Rp 3.000) - Supplier: Segar Minuman
- Teh Kotak Jasmine (Rp 4.500) - Supplier: Segar Minuman
- Kopi Susu Dingin (Rp 7.500) - Supplier: Segar Minuman

**Initial Inventory (Lobby A):**
- Keripik Singkong: 25 unit
- Kacang Bawang: 18 unit
- Air Mineral: 35 unit
- Teh Kotak: 15 unit
- Kopi Susu: 12 unit

---

### **Database Tables to Check:**

**1. products**
```sql
SELECT * FROM products 
WHERE name = 'Kopi Arabica Premium 200g';
-- Check: status = 'APPROVED', is_displayed = true
```

**2. sales_transactions**
```sql
SELECT * FROM sales_transactions 
ORDER BY created_at DESC LIMIT 5;
-- Check: transaction_code, total_amount, status = 'completed'
```

**3. sales_transaction_items**
```sql
SELECT sti.*, p.name 
FROM sales_transaction_items sti
JOIN products p ON p.id = sti.product_id
WHERE sti.transaction_id = '[transaction_id]';
-- Check: quantity, price, commission_amount
```

**4. inventory_levels**
```sql
SELECT il.*, p.name, l.name as location_name
FROM inventory_levels il
JOIN products p ON p.id = il.product_id
JOIN locations l ON l.id = il.location_id
WHERE p.name = 'Kopi Arabica Premium 200g';
-- Check: quantity berkurang setelah checkout
```

**5. supplier_wallets**
```sql
SELECT sw.*, s.business_name
FROM supplier_wallets sw
JOIN suppliers s ON s.id = sw.supplier_id
ORDER BY sw.updated_at DESC;
-- Check: balance bertambah setelah payment confirmed
```

**6. notifications**
```sql
SELECT n.*, p.full_name
FROM notifications n
JOIN profiles p ON p.id = n.user_id
ORDER BY n.created_at DESC LIMIT 10;
-- Check: notifikasi penjualan baru ke supplier
```

---

## 🐛 TROUBLESHOOTING

### **Issue: Produk tidak muncul di etalase user**
**Check:**
- [ ] Product status = 'APPROVED'
- [ ] Product is_displayed = true
- [ ] Product stock > 0
- [ ] Supplier status = 'APPROVED'

### **Issue: Dashboard stats tidak update**
**Fix:**
- Refresh halaman (F5)
- Check browser console for errors
- Verify database connection
- Check Supabase RLS policies

### **Issue: Transaction gagal**
**Check:**
- [ ] Stock cukup
- [ ] Payment method valid
- [ ] User authentication valid
- [ ] Database constraints tidak error

### **Issue: Wallet balance salah**
**Debug:**
```sql
-- Total expected from sales
SELECT SUM(total_price * 0.9) as expected_balance
FROM sales
WHERE supplier_id = [id];

-- Compare with wallet
SELECT available_balance FROM wallets WHERE supplier_id = [id];
```

---

## ✅ SUCCESS CRITERIA

Simulasi dianggap **SUKSES** jika:

- [x] Supplier dapat add product & status PENDING
- [x] Admin menerima notifikasi pending product
- [x] Admin dapat approve & post to etalase
- [x] User dapat melihat produk di etalase
- [x] User dapat checkout & bayar
- [x] Transaction tercatat di database
- [x] Admin dashboard ter-update (sales, revenue, charts)
- [x] Supplier dashboard ter-update (revenue, stock, wallet)
- [x] Inventory berkurang sesuai qty
- [x] Wallet balance bertambah (90% dari sales)
- [x] Withdrawal request berjalan lancar
- [x] Semua data konsisten di database

---

## 📊 EXPECTED RESULTS (Summary)

### **After Complete Flow:**

**Admin Dashboard:**
- Daily Sales: 1 transaction
- Daily Revenue: Rp 170.000
- Commission Earned: Rp 17.000

**Supplier Dashboard:**
- Products: 1 approved
- Stock: 48 units (dari 50)
- Revenue: Rp 153.000
- Wallet: Rp 3.000 (after withdraw Rp 150.000)

**User:**
- Purchase completed
- 2 units of Kopi Arabica
- Total paid: Rp 170.000

**Database:**
- products: 1 row (APPROVED)
- sales: 1 row (transaction)
- inventory: 48 quantity
- wallet_transactions: 2 rows (SALE, WITHDRAWAL)
- wallets: balance = 3000

---

## 🎬 NEXT STEPS AFTER SIMULASI

### **If Simulasi Success:**
1. ✅ Deploy frontend to Vercel
2. ✅ Setup production environment variables
3. ✅ Test with real Supabase production database
4. ✅ Invite real suppliers for beta testing
5. ✅ Monitor performance & fix bugs

### **If Issues Found:**
1. Document specific errors
2. Check database logs
3. Review RLS policies
4. Debug step-by-step
5. Fix & re-test

---

## 📞 SUPPORT

**Documentation:** BACKUP-ADMIN-FRONTEND.md  
**Database Schema:** database/schema.sql  
**Questions:** Check conversation history  

**Ready to start simulasi?** 🚀

Follow tahap 1-5 secara berurutan dan checklist setiap checkpoint!
